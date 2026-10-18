// Render shaders: the water (speed / vorticity colour maps) with the Lenia layer drawn on top as a
// "dream neon" liquid, and the flow particles.
import { HEADER } from './gpu.js';

const RENDER_HEADER = HEADER + /* wgsl */`
// mode: 0 off, 1 speed, 2 vorticity; theme: 0 Ocean, 1 Magma, 2 Neon; pal: 0 Aurora, 1 Dream, 2 Prism
struct View { scale: vec2f, offset: vec2f, mode: u32, gain: f32, theme: u32, lenia: u32, pal: f32 };
@group(0) @binding(1) var<uniform> V: View;
`;

export const FLUID_RENDER = RENDER_HEADER + /* wgsl */`
@group(0) @binding(2) var<storage, read> vel: array<vec2f>;
@group(0) @binding(3) var<storage, read> len: array<f32>;
struct VO { @builtin(position) pos: vec4f, @location(0) world: vec2f };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VO {
  // full-screen triangle; lattice coordinate recovered from the inverse view transform
  let xy = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u)) * 2.0 - 1.0;
  var o: VO;
  o.pos = vec4f(xy, 0.0, 1.0);
  o.world = (vec2f(xy.x, -xy.y) - V.offset) / V.scale;
  return o;
}
fn uAt(p: vec2f) -> vec2f {
  let q = p - 0.5; let f0 = floor(q); let t = q - f0;
  let x = i32(f0.x); let y = i32(f0.y);
  return mix(mix(vel[cell(x, y)], vel[cell(x + 1, y)], t.x), mix(vel[cell(x, y + 1)], vel[cell(x + 1, y + 1)], t.x), t.y);
}

// ---- water colour maps
fn magma(t: f32) -> vec3f {   // polynomial fit of matplotlib's magma
  let c0 = vec3f(-0.002136485, -0.000749655, -0.005386127); let c1 = vec3f(0.2516605, 0.6775232, 2.494026);
  let c2 = vec3f(8.353717, -3.577719, 0.3144679); let c3 = vec3f(-27.66873, 14.26473, -13.64921);
  let c4 = vec3f(52.17614, -27.94361, 12.94416); let c5 = vec3f(-50.76852, 29.04658, 4.23415);
  let c6 = vec3f(18.65570, -11.48977, -5.601961);
  return clamp(c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6))))), vec3f(0.0), vec3f(1.0));
}
fn ocean(t: f32) -> vec3f {   // dark teal microscope look
  return mix(vec3f(0.015, 0.03, 0.05), vec3f(0.25, 0.85, 0.95), pow(clamp(t, 0.0, 1.0), 0.8))
       + vec3f(0.9, 0.95, 1.0) * pow(clamp(t - 0.7, 0.0, 1.0) * 3.0, 2.0) * 0.3;
}
fn diverge(t: f32) -> vec3f {
  let a = clamp(t, -1.0, 1.0);
  return vec3f(0.03, 0.035, 0.05) + select(vec3f(0.25, 0.55, 1.0), vec3f(1.0, 0.42, 0.25), a > 0.0) * pow(abs(a), 0.7);
}
// neon: near-black water, electric indigo -> blue -> cyan, glowing iso-speed contours
fn neonWater(t: f32) -> vec3f {
  let s = clamp(t, 0.0, 1.5);
  var c = mix(vec3f(0.004, 0.003, 0.014), vec3f(0.12, 0.015, 0.32), smoothstep(0.04, 0.45, s));
  c = mix(c, vec3f(0.02, 0.34, 1.0), smoothstep(0.4, 0.9, s));
  c = mix(c, vec3f(0.55, 0.98, 1.0), smoothstep(0.95, 1.45, s));
  let line = 1.0 - smoothstep(0.0, 0.06, abs(fract(s * 4.0) - 0.5));
  return c + vec3f(0.15, 0.45, 1.0) * line * smoothstep(0.1, 0.6, s) * 0.28;
}
fn neonDiverge(t: f32) -> vec3f {
  let a = clamp(t, -1.0, 1.0);
  let c = select(vec3f(0.0, 0.75, 1.0), vec3f(0.5, 0.12, 1.0), a > 0.0);
  return vec3f(0.006, 0.004, 0.02) + c * 0.8 * pow(abs(a), 0.7) + vec3f(0.8, 0.9, 1.0) * pow(max(abs(a) - 0.8, 0.0) * 5.0, 2.0) * 0.2;
}

// ---- Lenia "dream neon" shading
fn hash2(q: vec2f) -> f32 { return fract(sin(dot(q, vec2f(127.1, 311.7))) * 43758.5453); }
fn vnoise(q: vec2f) -> f32 {
  let i = floor(q); let f = fract(q); let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2f(1.0, 0.0)), u.x), mix(hash2(i + vec2f(0.0, 1.0)), hash2(i + vec2f(1.0, 1.0)), u.x), u.y);
}
fn lenAt(p: vec2f) -> f32 {
  let q = p - 0.5; let f0 = floor(q); let t = q - f0;
  let x = i32(f0.x); let y = i32(f0.y);
  return mix(mix(len[cell(x, y)], len[cell(x + 1, y)], t.x), mix(len[cell(x, y + 1)], len[cell(x + 1, y + 1)], t.x), t.y);
}
fn lenN(p: vec2f) -> f32 { return clamp(lenAt(p), 0.0, 1.5); }
fn lenNear(p: vec2f) -> f32 { return clamp(len[cell(i32(floor(p.x)), i32(floor(p.y)))], 0.0, 1.5); }
fn palMode() -> u32 { return u32(V.pal + 0.5); }
fn spectral(h: f32) -> vec3f { return 0.5 + 0.5 * cos(6.2831853 * (h + vec3f(0.0, 0.33, 0.67))); }
// Aurora: ultraviolet -> blue-violet -> electric blue -> cyan -> aurora green, mirrored so the hue never jumps
fn auroraPal(h: f32) -> vec3f {
  let t = abs(fract(h * 0.5) * 2.0 - 1.0);
  var c = mix(vec3f(0.46, 0.12, 1.0), vec3f(0.30, 0.22, 1.0), smoothstep(0.0, 0.25, t));
  c = mix(c, vec3f(0.08, 0.45, 1.0), smoothstep(0.25, 0.5, t));
  c = mix(c, vec3f(0.05, 0.88, 1.0), smoothstep(0.5, 0.75, t));
  return mix(c, vec3f(0.22, 1.0, 0.68), smoothstep(0.75, 1.0, t));
}
fn dreamPal(h: f32) -> vec3f {
  if (palMode() == 2u) { return mix(vec3f(0.86, 0.9, 1.0), spectral(h), 0.12); }   // Prism: pearl white
  if (palMode() == 1u) {   // Dream: coral pink -> magenta -> violet -> electric blue -> cyan -> pale gold
    return clamp(vec3f(0.6, 0.45, 0.7) + vec3f(0.45, 0.4, 0.35) * cos(6.2831853 * (h + vec3f(0.0, 0.25, 0.45))), vec3f(0.0), vec3f(1.0));
  }
  return auroraPal(h);
}
// colour of the Lenia "liquid" at one point: marbled iridescent body, specular, Fresnel rim, white-hot core
fn dreamBody(x: vec2f) -> vec3f {
  let c = lenN(x);
  if (c < 0.002) { return vec3f(0.0); }
  let e = 1.25;
  let gr = vec2f(lenN(x + vec2f(e, 0.0)) - lenN(x - vec2f(e, 0.0)), lenN(x + vec2f(0.0, e)) - lenN(x - vec2f(0.0, e))) / (2.0 * e);
  let m5 = vnoise(x * 0.14);
  let marble = vnoise((x + 3.0 * vec2f(m5, vnoise(x.yx * 0.14))) * 0.06);
  let hue = 1.4 * vnoise(x * 0.008) + 1.1 * marble + 0.3 * c + 0.1 * atan2(gr.y, gr.x) / 6.2831853;
  let inten = smoothstep(0.02, 0.35, c);
  let N = normalize(vec3f(-gr * 9.0, 1.0));
  let s1 = pow(max(dot(N, normalize(vec3f(0.3, -0.5, 2.0))), 0.0), 70.0);
  let s2 = pow(max(dot(N, normalize(vec3f(-0.45, 0.3, 1.9))), 0.0), 40.0);
  let fres = pow(1.0 - max(N.z, 0.0), 2.5);
  let core = pow(clamp((c - 0.55) / 0.6, 0.0, 1.0), 1.5);
  if (palMode() == 2u) {   // Prism: white-hot dense matter, thin matter and hollows sink into deep blue
    var pc = mix(vec3f(0.06, 0.16, 1.0) * 0.9, vec3f(0.42, 0.55, 1.0), smoothstep(0.04, 0.16, c));
    pc = mix(pc, vec3f(1.0, 0.98, 1.0), smoothstep(0.12, 0.45, c));
    pc *= inten * (1.0 + 0.6 * smoothstep(0.5, 1.0, c));
    pc += vec3f(1.0) * (s1 * 0.8 + s2 * 0.35) * inten;
    pc += vec3f(0.35, 0.5, 1.0) * fres * 0.6 * smoothstep(0.0, 0.2, c);
    return pc;
  }
  var col = pow(dreamPal(hue), vec3f(1.15)) * 1.25 * inten * (0.55 + 0.6 * min(c, 1.0));
  let warm = palMode() == 1u;
  col += (select(vec3f(0.85, 0.95, 1.0), vec3f(1.0, 0.97, 0.92), warm) * s1 * 1.1 + select(vec3f(0.7, 0.8, 1.0), vec3f(0.8, 0.9, 1.0), warm) * s2 * 0.55) * inten;
  col += dreamPal(hue * 1.7 + 0.3) * fres * 1.4 * smoothstep(0.0, 0.2, c);
  return col * (1.0 - core * 0.6) + select(vec3f(0.85, 0.93, 1.0), vec3f(1.0, 0.97, 1.0), warm) * core * 0.75;
}
// liquid shading + RGB dispersion along the gradient (rainbow fringes) + double soft halo; static
fn leniaDream(p0: vec2f, water: vec3f) -> vec3f {
  var probe = lenNear(p0);   // cheap early-out: nothing within ~12 cells
  for (var k = 0; k < 8; k++) {
    let a = f32(k) * 0.785398;
    probe = max(probe, lenNear(p0 + 12.0 * vec2f(cos(a), sin(a))));
    probe = max(probe, lenNear(p0 + 6.0 * vec2f(cos(a + 0.39), sin(a + 0.39))));
  }
  if (probe < 0.003) { return water; }
  let p = p0 + (vec2f(vnoise(p0 * 0.035), vnoise(p0 * 0.035 + vec2f(9.2, 3.1))) - 0.5) * 3.0;   // static domain warp
  let c = lenN(p);
  let e = 1.25;
  let gr = vec2f(lenN(p + vec2f(e, 0.0)) - lenN(p - vec2f(e, 0.0)), lenN(p + vec2f(0.0, e)) - lenN(p - vec2f(0.0, e))) / (2.0 * e);
  let dir = gr / (length(gr) + 1e-4) * select(0.65, 0.8, palMode() == 2u);
  let mid = dreamBody(p); let outer = dreamBody(p + dir); let inner = dreamBody(p - dir);
  // Aurora: green out / blue in (fringes stay cyan-violet); Dream: red out / blue in; Prism: thin magenta / cyan rims
  var col = select(vec3f(mid.r, outer.g, inner.b), vec3f(outer.r, mid.g, inner.b), palMode() >= 1u);
  if (palMode() == 2u) { col = vec3f(mix(mid.r, outer.r, 0.4), mix(mid.g, inner.g, 0.3), mix(mid.b, outer.b, 0.2)); }
  var h1 = 0.0; var h2 = 0.0;
  for (var k = 0; k < 8; k++) {
    let a = f32(k) * 0.785398;
    h1 += lenN(p + 4.5 * vec2f(cos(a), sin(a)));
    h2 += lenN(p + 10.0 * vec2f(cos(a + 0.39), sin(a + 0.39)));
  }
  let glow = (smoothstep(0.0, 0.5, h1 / 8.0) * 0.42 + smoothstep(0.0, 0.5, h2 / 8.0) * 0.2) * 1.5;
  var gcol = pow(dreamPal(1.4 * vnoise(p * 0.008) + 0.7 * vnoise(p * 0.03) + 0.15), vec3f(1.3));
  if (palMode() == 2u) { gcol = vec3f(0.22, 0.42, 1.0) * 1.2; }
  col += gcol * glow * (1.0 - 0.6 * smoothstep(0.0, 0.35, c));
  // on the brighter Ocean / Magma water, darken the water under and around the creature so the neon reads
  var base = water;
  if (V.theme != 2u) { base = water * (1.0 - 0.7 * clamp(max(smoothstep(0.0, 0.3, c), glow * 0.8), 0.0, 1.0)); }
  return base + col;
}

@fragment fn fs(i: VO) -> @location(0) vec4f {
  let p = i.world;
  let neon = V.theme == 2u;
  var col = select(vec3f(0.035, 0.04, 0.055), vec3f(0.006, 0.004, 0.02), neon);
  if (V.mode == 1u) {          // speed
    let s = length(uAt(p)) / max(P.maxV, 1e-6) * V.gain;
    if (neon) { col = neonWater(s); } else { col = select(ocean(s), magma(clamp(s, 0.0, 1.0)), V.theme == 1u); }
  } else if (V.mode == 2u) {   // vorticity  du_y/dx - du_x/dy
    let dx = uAt(p + vec2f(1.0, 0.0)) - uAt(p - vec2f(1.0, 0.0));
    let dy = uAt(p + vec2f(0.0, 1.0)) - uAt(p - vec2f(0.0, 1.0));
    let w = 0.5 * (dx.y - dy.x) / max(P.maxV, 1e-6) * 6.0 * V.gain;
    col = select(diverge(w), neonDiverge(w), neon);
  }
  if (V.lenia != 0u) { col = leniaDream(p, col); }
  return vec4f(col, 1.0);
}`;

export const TRACER_RENDER = RENDER_HEADER + /* wgsl */`
@group(0) @binding(2) var<storage, read> tr: array<vec4f>;
struct VO { @builtin(position) pos: vec4f, @location(0) a: f32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) i: u32) -> VO {
  var corners = array<vec2f, 6>(vec2f(-1., -1.), vec2f(1., -1.), vec2f(1., 1.), vec2f(-1., -1.), vec2f(1., 1.), vec2f(-1., 1.));
  let t = tr[i];
  let q = (t.xy + corners[vi] * 0.35) * V.scale + V.offset;
  var o: VO;
  o.pos = vec4f(q.x, -q.y, 0.0, 1.0);
  o.a = clamp(t.z / 40.0, 0.0, 1.0) * clamp(0.25 + t.w / max(P.maxV, 1e-6), 0.0, 1.0);
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4f { return select(vec4f(0.85, 0.95, 1.0, i.a * 0.55), vec4f(0.35, 0.8, 1.0, i.a * 0.45), V.theme == 2u); }`;
