// Two-way Lenia layer: Bert Chan's Lenia rule made mass-conserving, carried by the water and pushing it back.
//
// One generation (every `stepsPerGen` physics steps), after applying the eraser:
//   1. advect the field by the water velocity u* (semi-Lagrangian, Catmull-Rom)
//   2. classic Lenia growth dA = clip(A + dt G(K * A), 0, 1) - A
//   3. make it conserving: dA_c = dA - A G_s(dA) / G_s(A) with a Gaussian of sigma 2R, then rescale the
//      total exactly to the mass before the generation
//   4. push the water: the apparent mass flux J = A v (v = normal velocity of the density front) gives a
//      force dipole f = push (J - G_R * J), whose net force is zero, like a real microswimmer
// Placed creatures first live in a hidden "nursery" field while they are revealed on screen, then are
// moved into the tank unchanged. The NumPy reference of steps 1-3 is dev/make_reference.py.
import { kernel, buildPipelines, bindGroup, WG } from './gpu.js';
import { SPECIES } from './species.js';

const HALO = 32;             // the fast growth convolution reads a (16 + 2 HALO)^2 tile from workgroup memory
const TW = 16 + 2 * HALO;
const MAX_R = HALO + 0.99;   // taps lie strictly inside R, so every |dx|, |dy| <= HALO
const NURSE_SLOTS = 8;

const LP = /* wgsl */`
struct LP {
  nTaps: u32, pad0: u32, dt: f32, m: f32,
  s: f32, adv: f32, pad1: f32, eraseX: f32,
  eraseY: f32, eraseR: f32, force: f32, sigmaC: f32,
  sigmaF: f32, pad2: f32, pad3: f32, pad4: f32,
};
// Lenia growth (Chan's polynomial "quad4" bump; both species use it)
fn growth(u: f32) -> f32 {
  let d = u - lp.m;
  let q = max(0.0, 1.0 - d * d / (9.0 * lp.s * lp.s));
  return q * q * q * q * 2.0 - 1.0;
}
fn wrapD(d: vec2f) -> vec2f { return d - size() * floor(d / size() + 0.5); }
`;
const F = 'array<f32>', V2 = 'array<vec2f>', V4 = 'array<vec4f>', LPB = ['lp', 'LP', 'r'];
const k = (bindings, body, extra = '') => kernel([...bindings, LPB], body, LP + extra);

// separable Gaussian blur of a vec2 field along one axis, sigma taken from lp.<field>, truncated at 3 sigma.
// Symmetric taps are summed in pairs and the weights exp(-k^2 / 2s^2) come from a recurrence
// (w_k = w_{k-1} a^(2k-1), a = exp(-1 / 2s^2)) instead of one exp() per tap.
const blur = (axis, field) => {
  const at = (o) => (axis === 'x' ? `Jin[cell(x + ${o}, y)]` : `Jin[cell(x, y + ${o})]`);
  return k([['Jin', V2, 'r'], ['Jout', V2, 'rw']], `
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= P.W || g.y >= P.H) { return; }
  let x = i32(g.x); let y = i32(g.y);
  let sg = lp.${field};
  let r = i32(ceil(3.0 * sg));
  let a = exp(-0.5 / (sg * sg));
  let a2 = a * a;
  var w = 1.0; var ratio = a;
  var acc = ${at(0)}; var wsum = 1.0;
  for (var i = 1; i <= r; i++) {
    w *= ratio; ratio *= a2;
    acc += w * (${at('i')} + ${at('-i')}); wsum += 2.0 * w;
  }
  Jout[g.y * P.W + g.x] = acc / wsum;
}`);
};

// growth dA of the classic rule; D = dA, J = (A, dA) for the redistribution blur
const GROW_TAIL = `
  let a = B[c];
  let dA = clamp(a + lp.dt * growth(u), 0.0, 1.0) - a;
  D[c] = dA;
  J[c] = vec2f(a, dA);`;

// 2. growth: periodic convolution over the kernel's non-zero taps (dx, dy, w). The fast version reads the
//    neighbourhood from a workgroup-memory tile (TW^2 floats = 25.6 KB); devices that only offer the WebGPU
//    minimum of 16 KB use the direct version, which reads it from the storage buffer (same sums, same result).
const GROW_TILED = k([['B', F, 'r'], ['D', F, 'rw'], ['J', V2, 'rw'], ['taps', V4, 'r']], `
var<workgroup> tile: array<f32, ${TW * TW}>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) g: vec3u, @builtin(local_invocation_index) li: u32,
                                         @builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) l: vec3u) {
  let ox = i32(wg.x) * 16 - ${HALO}; let oy = i32(wg.y) * 16 - ${HALO};
  for (var i = li; i < ${TW * TW}u; i += 256u) { tile[i] = B[cell(ox + i32(i % ${TW}u), oy + i32(i / ${TW}u))]; }
  workgroupBarrier();
  if (g.x >= P.W || g.y >= P.H) { return; }
  let c = g.y * P.W + g.x;
  let base = i32(l.y + ${HALO}u) * ${TW} + i32(l.x + ${HALO}u);
  var u = 0.0;
  for (var i = 0u; i < lp.nTaps; i++) { let t = taps[i]; u += t.z * tile[base + i32(t.y) * ${TW} + i32(t.x)]; }
  ${GROW_TAIL}
}`);
const GROW_DIRECT = k([['B', F, 'r'], ['D', F, 'rw'], ['J', V2, 'rw'], ['taps', V4, 'r']], `
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= P.W || g.y >= P.H) { return; }
  let c = g.y * P.W + g.x;
  var u = 0.0;
  for (var i = 0u; i < lp.nTaps; i++) { let t = taps[i]; u += t.z * B[cell(i32(g.x) + i32(t.x), i32(g.y) + i32(t.y))]; }
  ${GROW_TAIL}
}`);
const TILE_BYTES = TW * TW * 4;

const KERNELS = {
  // 0. eraser (before the mass is counted, so wiped matter is really removed and not rescaled back)
  erase: k([['A', F, 'rw']], `
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= P.W || g.y >= P.H) { return; }
  let d = wrapD(vec2f(f32(g.x) + 0.5, f32(g.y) + 0.5) - vec2f(lp.eraseX, lp.eraseY));
  if (dot(d, d) < lp.eraseR * lp.eraseR) { A[g.y * P.W + g.x] = 0.0; }
}`),

  // 1. advect by u* (Catmull-Rom); densities may exceed 1 in the conserving rule
  advect: k([['A', F, 'r'], ['B', F, 'rw'], ['vel', V2, 'r']], `
fn wc(t: f32) -> vec4f {
  let t2 = t * t; let t3 = t2 * t;
  return vec4f((-t3 + 2.0 * t2 - t) / 2.0, (3.0 * t3 - 5.0 * t2 + 2.0) / 2.0, (-3.0 * t3 + 4.0 * t2 + t) / 2.0, (t3 - t2) / 2.0);
}
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= P.W || g.y >= P.H) { return; }
  let c = g.y * P.W + g.x;
  var v = A[c];
  if (lp.adv != 0.0) {
    let sp = vec2f(f32(g.x), f32(g.y)) - vel[c] * lp.adv;
    let f0 = floor(sp);
    let wx = wc(sp.x - f0.x); let wy = wc(sp.y - f0.y);
    let x0 = i32(f0.x) - 1; let y0 = i32(f0.y) - 1;
    var acc = 0.0;
    for (var j = 0; j < 4; j++) {
      var row = 0.0;
      for (var i = 0; i < 4; i++) { row += wx[i] * A[cell(x0 + i, y0 + j)]; }
      acc += wy[j] * row;
    }
    v = max(acc, 0.0);
  }
  B[c] = v;
}`),

  // 3. redistribution blur (sigma 2R), apply, total mass
  blurCX: blur('x', 'sigmaC'),
  blurCY: blur('y', 'sigmaC'),
  // A = max(B + dA_c, 0); J = A v with v = -dA_c grad B / |grad B|^2 (front velocity, capped at 1 cell/gen);
  // per-workgroup partial sums of the new total
  apply: k([['B', F, 'r'], ['D', F, 'r'], ['Jb', V2, 'r'], ['A', F, 'rw'], ['J', V2, 'rw'], ['partB', F, 'rw']], `
var<workgroup> part: array<f32, 256>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) g: vec3u, @builtin(local_invocation_index) li: u32,
                                         @builtin(workgroup_id) wg: vec3u, @builtin(num_workgroups) nw: vec3u) {
  var v = 0.0;
  if (g.x < P.W && g.y < P.H) {
    let x = i32(g.x); let y = i32(g.y);
    let c = g.y * P.W + g.x;
    let b = B[c];
    let dAc = D[c] - b * Jb[c].y / (Jb[c].x + 1e-6);
    v = max(b + dAc, 0.0);
    A[c] = v;
    let gr = 0.5 * vec2f(B[cell(x + 1, y)] - B[cell(x - 1, y)], B[cell(x, y + 1)] - B[cell(x, y - 1)]);
    var fv = -dAc * gr / (dot(gr, gr) + 1e-3);
    let sp = length(fv);
    if (sp > 1.0) { fv = fv / sp; }
    J[c] = v * fv;
  }
  part[li] = v;
  workgroupBarrier();
  for (var st = 128u; st > 0u; st >>= 1u) { if (li < st) { part[li] += part[li + st]; } workgroupBarrier(); }
  if (li == 0u) { partB[wg.y * nw.x + wg.x] = part[0]; }
}`),
  // per-workgroup partial sums of the total before the generation
  sum: k([['A', F, 'r'], ['partA', F, 'rw']], `
var<workgroup> sh: array<f32, 256>;
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) g: vec3u, @builtin(local_invocation_index) li: u32,
                                         @builtin(workgroup_id) wg: vec3u, @builtin(num_workgroups) nw: vec3u) {
  var v = 0.0;
  if (g.x < P.W && g.y < P.H) { v = A[g.y * P.W + g.x]; }
  sh[li] = v;
  workgroupBarrier();
  for (var st = 128u; st > 0u; st >>= 1u) { if (li < st) { sh[li] += sh[li + st]; } workgroupBarrier(); }
  if (li == 0u) { partA[wg.y * nw.x + wg.x] = sh[0]; }
}`),
  // tot = (total before, total after)
  total: k([['partA', F, 'r'], ['partB', F, 'r'], ['tot', F, 'rw']], `
var<workgroup> sa: array<f32, 256>;
var<workgroup> sb: array<f32, 256>;
@compute @workgroup_size(256) fn main(@builtin(local_invocation_index) li: u32) {
  let n = ((P.W + 15u) / 16u) * ((P.H + 15u) / 16u);
  var a = 0.0; var b = 0.0;
  for (var i = li; i < n; i += 256u) { a += partA[i]; b += partB[i]; }
  sa[li] = a; sb[li] = b;
  workgroupBarrier();
  for (var st = 128u; st > 0u; st >>= 1u) { if (li < st) { sa[li] += sa[li + st]; sb[li] += sb[li + st]; } workgroupBarrier(); }
  if (li == 0u) { tot[0] = sa[0]; tot[1] = sb[0]; }
}`),
  rescale: k([['A', F, 'rw'], ['tot', F, 'r']], `
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= P.W || g.y >= P.H) { return; }
  let c = g.y * P.W + g.x;
  A[c] = max(0.0, A[c] * select(1.0, tot[0] / tot[1], tot[1] > 0.0));
}`),

  // 4. push: f = push (J - G_R * J)
  blurFX: blur('x', 'sigmaF'),
  blurFY: blur('y', 'sigmaF'),
  force: k([['J', V2, 'r'], ['Jb', V2, 'r'], ['lf', V2, 'rw']], `
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= P.W || g.y >= P.H) { return; }
  let c = g.y * P.W + g.x;
  lf[c] = lp.force * (J[c] - Jb[c]);
}`),

  // nursery: move the cells within a creature's disc (info = cx, cy, r) into the tank
  adopt: k([['A', F, 'rw'], ['Nn', F, 'rw'], ['info', V4, 'r']], `
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= P.W || g.y >= P.H) { return; }
  let c = g.y * P.W + g.x;
  let d = wrapD(vec2f(f32(g.x) + 0.5, f32(g.y) + 0.5) - info[0].xy);
  if (length(d) < info[0].z) { A[c] = A[c] + Nn[c]; Nn[c] = 0.0; }
}`),
  // display = tank + nursery revealed by an expanding soft disc per pending creature + a fading glow at
  // the drop point (visual only). rev[i] = (cx, cy, r, seed); r <= 0 -> unused
  display: k([['A', F, 'r'], ['Nn', F, 'r'], ['disp', F, 'rw'], ['rev', V4, 'r']], `
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= P.W || g.y >= P.H) { return; }
  let c = g.y * P.W + g.x;
  var m = 0.0; var seed = 0.0;
  for (var i = 0; i < ${NURSE_SLOTS}; i++) {
    let r = rev[i];
    if (r.z <= 0.0) { continue; }
    let dl = length(wrapD(vec2f(f32(g.x) + 0.5, f32(g.y) + 0.5) - r.xy));
    let soft = max(3.0, 0.45 * r.z);
    m = max(m, 1.0 - smoothstep(r.z - soft, r.z, dl));
    let sg = 2.5 + 0.35 * r.z;
    seed = max(seed, r.w * exp(-0.5 * dl * dl / (sg * sg)));
  }
  disp[c] = A[c] + m * Nn[c] + seed;
}`),
  // paste a pattern (max-blend): stamp = [x0, y0, w, h, values...]
  stamp: k([['A', F, 'rw'], ['stamp', F, 'r']], `
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) g: vec3u) {
  let w = u32(stamp[2]); let h = u32(stamp[3]);
  if (g.x >= w * h) { return; }
  let c = cell(i32(stamp[0]) + i32(g.x % w), i32(stamp[1]) + i32(g.x / w));
  A[c] = max(A[c], stamp[4u + g.x]);
}`),
};

// ------------------------------------------------------------------ CPU side
// RLE pattern decoder (Chan's LeniaND.py Board.rle2arr, 2D)
function ch2val(c) {
  if (c === '.' || c === 'b') return 0;
  if (c === 'o') return 255;
  if (c.length === 1) return c.charCodeAt(0) - 65 + 1;
  return (c.charCodeAt(0) - 112) * 24 + (c.charCodeAt(1) - 65 + 25);
}
export function rle2arr(st) {
  const rows = []; let row = []; let last = '', count = '';
  for (const ch of st.replace(/!$/, '') + '$') {
    if (ch >= '0' && ch <= '9') count += ch;
    else if ('pqrstuvwxy@'.includes(ch)) last = ch;
    else {
      const n = count ? parseInt(count, 10) : 1;
      if (last + ch === '$') { rows.push(row); for (let i = 1; i < n; i++) rows.push([]); row = []; }
      else { const v = ch2val(last + ch) / 255; for (let i = 0; i < n; i++) row.push(v); }
      last = ''; count = '';
    }
  }
  const w = Math.max(...rows.map((r) => r.length));
  return { w, h: rows.length, data: rows.map((r) => [...r, ...new Array(w - r.length).fill(0)]) };
}

// non-zero taps (dx, dy, w) of the normalised kernel shell (LeniaND.py kernel_shell, quad4 core as both species use)
function kernelTaps(R, b) {
  const taps = []; let sum = 0;
  const r = Math.ceil(R);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const D = Math.hypot(dx, dy) / R;
      if (D >= 1) continue;
      const Br = b.length * D;
      const w = (4 * (Br % 1) * (1 - Br % 1)) ** 4 * b[Math.min(Math.floor(Br), b.length - 1)];
      if (w > 0) { taps.push([dx, dy, w]); sum += w; }
    }
  }
  const out = new Float32Array(taps.length * 4);
  taps.forEach(([dx, dy, w], i) => out.set([dx, dy, w / sum, 0], 4 * i));
  return out;
}

// pattern resampled by `scale` and rotated by `angle` (bilinear), as a stamp centred on (cx, cy)
function makeStamp(cells, cx, cy, scale, angle) {
  const { w, h, data } = cells;
  const at = (i, j) => (i >= 0 && j >= 0 && i < w && j < h ? data[j][i] : 0);
  const sample = (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
    return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
  };
  const size = Math.ceil(Math.hypot(w, h) * scale) + 2;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const out = new Float32Array(4 + size * size);
  out.set([Math.round(cx - size / 2), Math.round(cy - size / 2), size, size]);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const px = i + 0.5 - size / 2, py = j + 0.5 - size / 2;
      const qx = (ca * px + sa * py) / scale + w / 2 - 0.5, qy = (-sa * px + ca * py) / scale + h / 2 - 0.5;
      out[4 + j * size + i] = Math.min(1, Math.max(0, sample(qx, qy)));
    }
  }
  return out;
}

export class LeniaLayer {
  constructor(engine) {
    this.e = engine;
    this.on = true;
    this.species = SPECIES[0];
    this.scale = 1.5;          // kernel radius R = species R x scale lattice cells
    this.coupling = 1;         // how strongly the water carries Lenia (1 = moves with the fluid)
    this.stepsPerGen = 8;      // physics steps per Lenia generation
    this.push = 1;             // how strongly Lenia's motion pushes the water (0 = carried only)
    this.revealSeconds = 0.6;  // wall-clock time over which a placed creature is revealed
    this.gensPerFrame = 1;     // set by the frame loop
    this.counter = 0;
    this.erase = { on: false, x: 0, y: 0, r: 0 };
    this.forceDirty = false;
    const buf = (n) => engine._buf(n);
    this.b = {
      taps: buf(16 * 16384), lp: buf(64), stamp: buf(4 * (4 + 512 * 512)), rev: buf(16 * NURSE_SLOTS),
      partA: buf(4 * 16384), partB: buf(4 * 16384), tot: buf(16),
    };
    this.nurse = Array.from({ length: NURSE_SLOTS }, () => ({ info: buf(16), active: false }));
    this.tiled = engine.device.limits.maxComputeWorkgroupStorageSize >= TILE_BYTES;
    this.kernels = { ...KERNELS, grow: this.tiled ? GROW_TILED : GROW_DIRECT };
    ({ pipes: this.pipes, layouts: this.layouts } = buildPipelines(engine.device, this.kernels));
    this.setRule(this.species, this.scale);
  }

  // called by Engine.resizeGrid once the grid buffers exist
  onResize() {
    const e = this.e, HW = e.W * e.H, b = this.b;
    for (const key of ['D', 'J', 'Jt', 'Jb', 'nA', 'nB']) b[key]?.destroy();
    b.D = e._buf(HW * 4); b.J = e._buf(HW * 8); b.Jt = e._buf(HW * 8); b.Jb = e._buf(HW * 8);
    b.nA = e._buf(HW * 4); b.nB = e._buf(HW * 4);
    const bg = (name, map) => bindGroup(e.device, this.kernels, this.layouts, name, e.b.params, map);
    // the same rule bound to a field pair: the tank (lenA/lenB) or the nursery (nA/nB)
    const rule = (A, B) => ({
      erase: bg('erase', { A, lp: b.lp }),
      sum: bg('sum', { A, partA: b.partA, lp: b.lp }),
      advect: bg('advect', { A, B, vel: e.b.vel, lp: b.lp }),
      grow: bg('grow', { B, D: b.D, J: b.J, taps: b.taps, lp: b.lp }),
      blurCX: bg('blurCX', { Jin: b.J, Jout: b.Jt, lp: b.lp }),
      blurCY: bg('blurCY', { Jin: b.Jt, Jout: b.Jb, lp: b.lp }),
      apply: bg('apply', { B, D: b.D, Jb: b.Jb, A, J: b.J, partB: b.partB, lp: b.lp }),
      total: bg('total', { partA: b.partA, partB: b.partB, tot: b.tot, lp: b.lp }),
      rescale: bg('rescale', { A, tot: b.tot, lp: b.lp }),
      blurFX: bg('blurFX', { Jin: b.J, Jout: b.Jt, lp: b.lp }),
      blurFY: bg('blurFY', { Jin: b.Jt, Jout: b.Jb, lp: b.lp }),
      force: bg('force', { J: b.J, Jb: b.Jb, lf: e.b.lf, lp: b.lp }),
      stamp: bg('stamp', { A, stamp: b.stamp, lp: b.lp }),
    });
    this.bg = rule(e.b.lenA, e.b.lenB);
    this.bgN = rule(b.nA, b.nB);
    this.bgAdopt = this.nurse.map((n) => bg('adopt', { A: e.b.lenA, Nn: b.nA, info: n.info, lp: b.lp }));
    this.bgDisplay = bg('display', { A: e.b.lenA, Nn: b.nA, disp: e.b.lenDisp, rev: b.rev, lp: b.lp });
    this.clear();
  }

  setRule(species, scale = this.scale) {
    this.species = species; this.scale = scale;
    this.R = Math.max(2, Math.min(MAX_R, species.R * scale));
    const taps = kernelTaps(this.R, species.b);
    this.nTaps = taps.length / 4;
    this.e.device.queue.writeBuffer(this.b.taps, 0, taps);
  }

  writeParams() {
    const s = this.species, buf = new ArrayBuffer(64), u = new Uint32Array(buf), f = new Float32Array(buf);
    u[0] = this.nTaps; f[2] = 1 / s.T; f[3] = s.m;
    f[4] = s.s; f[5] = this.stepsPerGen * this.coupling; f[7] = this.erase.x;
    f[8] = this.erase.y; f[9] = this.erase.r; f[10] = this.push / this.stepsPerGen; f[11] = 2 * this.R;
    f[12] = Math.max(1, this.R);
    this.e.device.queue.writeBuffer(this.b.lp, 0, buf);
  }

  // called once per physics step inside Engine.encodeSteps
  afterStep(pass) {
    if (++this.counter >= this.stepsPerGen) { this.counter = 0; this.encodeGen(pass); }
  }

  encodeGen(pass) {
    const nursing = this.nurse.some((x) => x.active);
    if (nursing) this._encodeRule(pass, this.bgN, false);
    this._encodeRule(pass, this.bg, true);
    if (nursing) this._encodeAdopt(pass);
  }

  // one generation on the field pair bound in `bg`; only the tank pushes the water
  _encodeRule(pass, bg, tank) {
    const cx = Math.ceil(this.e.W / 16), cy = Math.ceil(this.e.H / 16);
    const run = (name, x = cx, y = cy) => { pass.setPipeline(this.pipes[name]); pass.setBindGroup(0, bg[name]); pass.dispatchWorkgroups(x, y); };
    if (this.erase.on) run('erase');
    run('sum');
    run('advect');
    run('grow');
    run('blurCX'); run('blurCY');
    run('apply');
    run('total', 1, 1);
    run('rescale');
    if (tank && (this.push !== 0 || this.forceDirty)) { run('blurFX'); run('blurFY'); run('force'); }
    if (tank) this.forceDirty = this.push !== 0;
  }

  // adopt nursing creatures whose reveal is over; the last one also sweeps any remaining nursery matter
  _encodeAdopt(pass) {
    const cx = Math.ceil(this.e.W / 16), cy = Math.ceil(this.e.H / 16), now = performance.now();
    this.nurse.forEach((x, i) => {
      if (!x.active || now - x.t0 < this.revealSeconds * 1000) return;
      if (!this.nurse.some((y) => y !== x && y.active)) this.e.device.queue.writeBuffer(x.info, 0, new Float32Array([x.cx, x.cy, 1e9, 0]));
      pass.setPipeline(this.pipes.adopt); pass.setBindGroup(0, this.bgAdopt[i]); pass.dispatchWorkgroups(cx, cy);
      x.active = false;
    });
  }

  // composite tank + revealed nursery into the buffer the renderer reads (once per frame)
  encodeDisplay(enc) {
    const rev = new Float32Array(4 * NURSE_SLOTS), now = performance.now();
    this.nurse.forEach((x, i) => {
      if (!x.active) return;
      const t = Math.min(1, (now - x.t0) / (this.revealSeconds * 1000));
      const s = t * t * t * (t * (t * 6 - 15) + 10);   // smootherstep
      rev.set([x.cx, x.cy, x.R * (0.04 + 0.96 * s), 0.9 * (1 - s) ** 2], 4 * i);
    });
    this.e.device.queue.writeBuffer(this.b.rev, 0, rev);
    const pass = enc.beginComputePass();
    pass.setPipeline(this.pipes.display); pass.setBindGroup(0, this.bgDisplay);
    pass.dispatchWorkgroups(Math.ceil(this.e.W / 16), Math.ceil(this.e.H / 16));
    pass.end();
  }

  // place a creature; switching species switches the tank's rule
  place(species, x, y, angle = 0) {
    if (species !== this.species) this.setRule(species, this.scale);
    species._cells ||= rle2arr(species.cells);
    const st = makeStamp(species._cells, x, y, this.scale, angle);
    const slot = this.nurse.find((n) => !n.active);
    if (!slot || this.revealSeconds <= 0) { this._stamp(st, this.bg.stamp); return; }
    // it lives in the nursery from now on; the adoption disc covers the creature plus how far it can
    // glide (~0.35 cells/gen) during the reveal
    this._stamp(st, this.bgN.stamp);
    const w = st[2], h = st[3];
    const travel = 0.35 * this.revealSeconds * 60 * this.gensPerFrame;
    Object.assign(slot, { active: true, t0: performance.now(), cx: st[0] + w / 2, cy: st[1] + h / 2, R: 0.5 * Math.hypot(w, h) + 6 + travel });
    this.e.device.queue.writeBuffer(slot.info, 0, new Float32Array([slot.cx, slot.cy, slot.R, 0]));
  }

  _stamp(st, bg) {
    this.e.device.queue.writeBuffer(this.b.stamp, 0, st);
    const enc = this.e.device.createCommandEncoder(), pass = enc.beginComputePass();
    pass.setPipeline(this.pipes.stamp); pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(st[2] * st[3] / WG));
    pass.end();
    this.e.device.queue.submit([enc.finish()]);
  }

  clearForce() {
    this.e.device.queue.writeBuffer(this.e.b.lf, 0, new Float32Array(this.e.W * this.e.H * 2));
    this.forceDirty = false;
  }

  clear() {
    const z = new Float32Array(this.e.W * this.e.H);
    for (const buf of [this.e.b.lenA, this.e.b.lenB, this.b.nA, this.b.nB]) this.e.device.queue.writeBuffer(buf, 0, z);
    this.clearForce();
    this.nurse.forEach((x) => { x.active = false; });
  }
}
