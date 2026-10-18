// WebGPU engine: lattice Boltzmann water (D2Q9, TRT collision with Guo forcing, as in Microcosmos),
// passive flow particles, the Lenia layer, and rendering.
import { kernel, buildPipelines, bindGroup, WG } from './gpu.js';
import { FLUID_RENDER, TRACER_RENDER } from './render.js';
import { LeniaLayer } from './lenia.js';
import { GlassLayer } from './glass.js';

export const FLUID_DEFAULTS = { viscosity: 0.1, maxV: 0.2 };
const LAMBDA_TRT = 0.25;     // TRT "magic" parameter
const MAX_TRACERS = 65536;

// omega+ = 1 / (3 nu + 1/2) clipped to [0, 1.9]; omega- from the TRT magic parameter
function omegas(viscosity) {
  const EPS = 1.1920929e-7;
  const wp = Math.min(Math.max(1 / (3 * viscosity + 0.5), 0), 1.9);
  const tp = 1 / Math.max(wp, EPS) - 0.5;
  const wm = 1 / (LAMBDA_TRT / Math.max(tp, EPS) + 0.5);
  return [wp, wm];
}

const D2Q9 = /* wgsl */`
const CX = array<f32, 9>(0., 1., 0., -1., 0., 1., -1., -1., 1.);
const CY = array<f32, 9>(0., 0., 1., 0., -1., 1., 1., -1., -1.);
const CXI = array<i32, 9>(0, 1, 0, -1, 0, 1, -1, -1, 1);
const CYI = array<i32, 9>(0, 0, 1, 0, -1, 1, 1, -1, -1);
const WT = array<f32, 9>(4./9., 1./9., 1./9., 1./9., 1./9., 1./36., 1./36., 1./36., 1./36.);
const OPP = array<u32, 9>(0u, 3u, 4u, 1u, 2u, 7u, 8u, 5u, 6u);
// stirring brush: a Gaussian body force around the pointer
fn brushForce(c: u32) -> vec2f {
  if (P.brushOn == 0u) { return vec2f(0.0); }
  let p = vec2f(f32(c % P.W) + 0.5, f32(c / P.W) + 0.5);
  var d = p - vec2f(P.brushX, P.brushY);
  d = d - size() * floor(d / size() + 0.5);
  return vec2f(P.brushFX, P.brushFY) * exp(-dot(d, d) / (P.brushR * P.brushR));
}`;

const V2 = 'array<vec2f>', V4 = 'array<vec4f>', F = 'array<f32>';

const KERNELS = {
  // density, clamped velocity u, and the force-shifted velocity u* = u + F / (2 rho)
  // with F = brush force + Lenia push (lf)
  macro: kernel([['f', F, 'r'], ['rho', F, 'rw'], ['vel', V2, 'rw'], ['lf', V2, 'r']], `
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= P.W || g.y >= P.H) { return; }
  let c = g.y * P.W + g.x;
  let HW = P.W * P.H;
  var r = 0.0;
  var m = vec2f(0.0);
  for (var i = 0u; i < 9u; i++) {
    let fi = max(f[i * HW + c], EPS);
    r += fi;
    m += vec2f(CX[i], CY[i]) * fi;
  }
  let density = max(r, 0.1);
  var u = m / density;
  u = u * min(1.0, P.maxV / (sqrt(dot(u, u) + EPS) + EPS));
  rho[c] = density;
  vel[c] = u + 0.5 * (brushForce(c) * density + lf[c]) / density;
}`, D2Q9),

  // TRT collision with Guo forcing, fused with pull streaming
  collide: kernel([['fIn', F, 'r'], ['fOut', F, 'rw'], ['rho', F, 'r'], ['vel', V2, 'r'], ['lf', V2, 'r']], `
@compute @workgroup_size(16, 16) fn main(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= P.W || g.y >= P.H) { return; }
  let c = g.y * P.W + g.x;
  let HW = P.W * P.H;
  let wp = P.omegaP;
  let wm = P.omegaM;
  for (var i = 0u; i < 9u; i++) {
    let s = cell(i32(g.x) - CXI[i], i32(g.y) - CYI[i]);
    let fi = max(fIn[i * HW + s], EPS);
    let fo = max(fIn[OPP[i] * HW + s], EPS);
    let r = rho[s];
    let us = vel[s];
    let Fs = brushForce(s) * r + lf[s];
    let usq = dot(us, us);
    let eu = CX[i] * us.x + CY[i] * us.y;
    let eF = CX[i] * Fs.x + CY[i] * Fs.y;
    let uF = dot(us, Fs);
    let feqI = r * WT[i] * (1.0 + 3.0 * eu + 4.5 * eu * eu - 1.5 * usq);
    let feqO = r * WT[i] * (1.0 - 3.0 * eu + 4.5 * eu * eu - 1.5 * usq);
    let rawI = WT[i] * (3.0 * (eF - uF) + 9.0 * eu * eF);
    let rawO = WT[i] * (3.0 * (-eF - uF) + 9.0 * eu * eF);
    let post = fi - wp * (0.5 * (fi + fo) - 0.5 * (feqI + feqO))
                  - wm * (0.5 * (fi - fo) - 0.5 * (feqI - feqO))
                  + (1.0 - 0.5 * wp) * 0.5 * (rawI + rawO)
                  + (1.0 - 0.5 * wm) * 0.5 * (rawI - rawO);
    fOut[i * HW + c] = max(post, EPS);
  }
}`, D2Q9),

  // flow particles advected by u* (bilinear, periodic), respawned now and then
  tracers: kernel([['tr', V4, 'rw'], ['vel', V2, 'r']], `
fn uAt(p: vec2f) -> vec2f {
  let q = p - 0.5; let f0 = floor(q); let t = q - f0;
  let x = i32(f0.x); let y = i32(f0.y);
  return mix(mix(vel[cell(x, y)], vel[cell(x + 1, y)], t.x), mix(vel[cell(x, y + 1)], vel[cell(x + 1, y + 1)], t.x), t.y);
}
fn hash(n: u32) -> f32 {
  var x = n * 747796405u + 2891336453u;
  x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
  return f32((x >> 22u) ^ x) / 4294967296.0;
}
@compute @workgroup_size(${WG}) fn main(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x; if (i >= P.nTracers) { return; }
  var t = tr[i];
  let u = uAt(t.xy);
  t = vec4f(wrapPos(t.xy + u * P.tracerSpeed), t.z + 1.0, length(u));
  if (t.z > 600.0 + 600.0 * hash(i + u32(t.z))) {
    t = vec4f(hash(i * 3u + u32(P.seed)) * f32(P.W), hash(i * 7u + 1u + u32(P.seed * 7.0)) * f32(P.H), 0.0, 0.0);
  }
  tr[i] = t;
}`),
};

export class Engine {
  static async create(canvas) {
    if (!navigator.gpu) throw new Error('WebGPU is not available in this browser.');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter found.');
    const device = await adapter.requestDevice({
      requiredLimits: {
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxBufferSize: adapter.limits.maxBufferSize,
        maxComputeWorkgroupStorageSize: Math.min(32768, adapter.limits.maxComputeWorkgroupStorageSize),
      },
    });
    device.onuncapturederror = (ev) => console.error('[WebGPU]', ev.error.message);
    device.pushErrorScope('validation');
    const e = new Engine(device, canvas);
    const err = await device.popErrorScope();
    if (err) throw new Error('WebGPU pipeline creation failed:\n' + err.message);
    return e;
  }

  constructor(device, canvas) {
    this.device = device;
    this.lost = device.lost;
    this.canvas = canvas;
    this.fluid = { ...FLUID_DEFAULTS };
    this.W = 0; this.H = 0;
    this.parity = 0;
    this.nTracers = 0;
    this.showTracers = true;
    this.brush = { on: false, x: 0, y: 0, fx: 0, fy: 0, r: 8 };
    // mode: 0 off, 1 speed, 2 vorticity; theme: 0 Ocean, 1 Magma, 2 Neon; leniaPal: 0 Aurora, 1 Dream, 2 Prism
    this.view = { mode: 1, theme: 2, gain: 0.6, leniaPal: 0 };
    this.glassShapes = [];   // liquid-glass UI shapes in canvas px, set by the UI every frame (see glass.js)
    this.b = {
      params: this._buf(64, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST),
      view: this._buf(48, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST),
      tr: this._buf(MAX_TRACERS * 16),
    };
    ({ pipes: this.pipes, layouts: this.layouts } = buildPipelines(device, KERNELS));
    if (canvas) this._buildRender();
    this.lenia = new LeniaLayer(this);
  }

  _buf(size, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC) {
    return this.device.createBuffer({ size: Math.max(16, Math.ceil(size / 16) * 16), usage });
  }

  // (Re)allocate the grid and put the water at rest
  resizeGrid(W, H) {
    const b = this.b;
    for (const k of ['fA', 'fB', 'rho', 'vel', 'lf', 'lenA', 'lenB', 'lenDisp']) b[k]?.destroy();
    this.W = W; this.H = H;
    const HW = W * H;
    b.fA = this._buf(9 * HW * 4); b.fB = this._buf(9 * HW * 4);
    b.rho = this._buf(HW * 4); b.vel = this._buf(HW * 8); b.lf = this._buf(HW * 8);
    b.lenA = this._buf(HW * 4); b.lenB = this._buf(HW * 4); b.lenDisp = this._buf(HW * 4);
    const bg = (name, map) => bindGroup(this.device, KERNELS, this.layouts, name, b.params, { ...b, ...map });
    this.bg = {
      macro: [bg('macro', { f: b.fA }), bg('macro', { f: b.fB })],
      collide: [bg('collide', { fIn: b.fA, fOut: b.fB }), bg('collide', { fIn: b.fB, fOut: b.fA })],
      tracers: bg('tracers', {}),
    };
    if (this.ctx) this._bindRender();
    this._writeParams(1);   // the Lenia stamp kernel needs the grid size before the first step
    this.resetFluid();
    this.lenia.onResize();
  }

  resetFluid() {
    const HW = this.W * this.H;
    const w = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
    const f = new Float32Array(9 * HW);
    for (let i = 0; i < 9; i++) f.fill(w[i], i * HW, (i + 1) * HW);
    this.device.queue.writeBuffer(this.b.fA, 0, f);
    this.device.queue.writeBuffer(this.b.fB, 0, f);
    this.device.queue.writeBuffer(this.b.vel, 0, new Float32Array(2 * HW));
    this.device.queue.writeBuffer(this.b.rho, 0, new Float32Array(HW).fill(1));
    this.parity = 0;
  }

  seedTracers(count) {
    this.nTracers = Math.min(count, MAX_TRACERS);
    const t = new Float32Array(this.nTracers * 4);
    for (let i = 0; i < this.nTracers; i++) {
      t[4 * i] = Math.random() * this.W; t[4 * i + 1] = Math.random() * this.H; t[4 * i + 2] = Math.random() * 400;
    }
    this.device.queue.writeBuffer(this.b.tr, 0, t);
  }

  _writeParams(tracerSpeed) {
    const [wp, wm] = omegas(this.fluid.viscosity);
    const br = this.brush;
    const buf = new ArrayBuffer(64), u = new Uint32Array(buf), f = new Float32Array(buf);
    u[0] = this.W; u[1] = this.H; u[2] = this.nTracers; u[3] = br.on ? 1 : 0;
    f[4] = wp; f[5] = wm; f[6] = this.fluid.maxV; f[7] = tracerSpeed;
    f[8] = br.x; f[9] = br.y; f[10] = br.fx; f[11] = br.fy;
    f[12] = br.r; f[13] = Math.random() * 1000;
    this.device.queue.writeBuffer(this.b.params, 0, buf);
  }

  encodeSteps(enc, steps) {
    const L = this.lenia;
    this._writeParams(steps);
    if (L.on) L.writeParams(); else if (L.forceDirty) L.clearForce();
    const cells = [Math.ceil(this.W / 16), Math.ceil(this.H / 16)];
    const pass = enc.beginComputePass();
    const run = (name, bg, x, y = 1) => { pass.setPipeline(this.pipes[name]); pass.setBindGroup(0, bg); pass.dispatchWorkgroups(x, y); };
    for (let k = 0; k < steps; k++) {
      run('macro', this.bg.macro[this.parity], ...cells);
      run('collide', this.bg.collide[this.parity], ...cells);
      this.parity ^= 1;
      if (L.on) L.afterStep(pass);
    }
    if (this.showTracers && this.nTracers) run('tracers', this.bg.tracers, Math.ceil(this.nTracers / WG));
    pass.end();
  }

  // ------------------------------------------------------------------ rendering
  _buildRender() {
    const d = this.device;
    this.ctx = this.canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.ctx.configure({ device: d, format: this.format, alphaMode: 'opaque' });
    const mk = (code, label, nStorage, blend) => {
      const entries = [0, 1].map((binding) => ({ binding, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }));
      for (let i = 0; i < nStorage; i++) entries.push({ binding: 2 + i, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } });
      const layout = d.createBindGroupLayout({ entries });
      const module = d.createShaderModule({ code, label });
      const pipe = d.createRenderPipeline({
        label, layout: d.createPipelineLayout({ bindGroupLayouts: [layout] }),
        vertex: { module, entryPoint: 'vs' },
        fragment: { module, entryPoint: 'fs', targets: [{ format: this.format, blend }] },
        primitive: { topology: 'triangle-list' },
      });
      return { layout, pipe };
    };
    const additive = { color: { srcFactor: 'src-alpha', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } };
    this.rp = { fluid: mk(FLUID_RENDER, 'fluid', 2), tracers: mk(TRACER_RENDER, 'tracers', 1, additive) };
    this.glass = new GlassLayer(d, this.format);
  }

  _bindRender() {
    const rbg = (rp, bufs) => this.device.createBindGroup({
      layout: rp.layout,
      entries: [{ binding: 0, resource: { buffer: this.b.params } }, { binding: 1, resource: { buffer: this.b.view } },
        ...bufs.map((buf, i) => ({ binding: 2 + i, resource: { buffer: buf } }))],
    });
    this.rbg = { fluid: rbg(this.rp.fluid, [this.b.vel, this.b.lenDisp]), tracers: rbg(this.rp.tracers, [this.b.tr]) };
  }

  // the tank covers the whole canvas (centred; scaled so there are no empty margins, cropping a sliver if
  // the window's aspect ratio differs from the grid's)
  viewTransform() {
    const cw = this.canvas.width, ch = this.canvas.height;
    const s = Math.max(cw / this.W, ch / this.H);            // pixels per cell
    const sx = 2 * s / cw, sy = 2 * s / ch;
    return { s, sx, sy, ox: -this.W / 2 * sx, oy: -this.H / 2 * sy };
  }

  // canvas pixel -> lattice cell coordinates
  screenToWorld(px, py) {
    const t = this.viewTransform();
    return [((px / this.canvas.width) * 2 - 1 - t.ox) / t.sx, ((py / this.canvas.height) * 2 - 1 - t.oy) / t.sy];
  }

  render(enc) {
    const t = this.viewTransform(), v = this.view;
    const buf = new ArrayBuffer(48), f = new Float32Array(buf), u = new Uint32Array(buf);
    f[0] = t.sx; f[1] = t.sy; f[2] = t.ox; f[3] = t.oy;
    u[4] = v.mode; f[5] = v.gain; u[6] = v.theme; u[7] = this.lenia.on ? 1 : 0; f[8] = v.leniaPal;
    this.device.queue.writeBuffer(this.b.view, 0, buf);
    // the scene goes into a texture, then the glass pass puts it on screen and refracts it inside the UI shapes
    const scene = this.glass.sceneView(this.canvas.width, this.canvas.height);
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: scene, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
    });
    pass.setPipeline(this.rp.fluid.pipe); pass.setBindGroup(0, this.rbg.fluid); pass.draw(3);
    if (this.showTracers && this.nTracers) { pass.setPipeline(this.rp.tracers.pipe); pass.setBindGroup(0, this.rbg.tracers); pass.draw(6, this.nTracers); }
    pass.end();
    this.glass.draw(enc, this.ctx.getCurrentTexture().createView(), this.glassShapes, this.canvas.width, this.canvas.height,
      this.canvas.width / Math.max(1, this.canvas.clientWidth));
  }

  frame(steps) {
    const enc = this.device.createCommandEncoder();
    this.lenia.gensPerFrame = steps / this.lenia.stepsPerGen;
    this.encodeSteps(enc, steps);
    if (this.lenia.on) this.lenia.encodeDisplay(enc);
    this.render(enc);
    this.device.queue.submit([enc.finish()]);
  }
}
