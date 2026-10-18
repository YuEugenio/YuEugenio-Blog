// Liquid glass, drawn in WebGPU over the rendered scene so it can really refract it.
//
// The scene (water + Lenia + flow particles) is rendered into a texture; this pass copies it to the screen and,
// inside each glass shape, samples it through a lens: near the rim the samples are pulled from further out
// (refraction), separately per colour channel (dispersion fringes), with a light frost, a Fresnel rim, a
// specular edge, a faint thin-film sheen and a soft drop shadow. Shapes are rounded rectangles in canvas
// pixels, optionally fused with a shrinking circle ("blob") so a button flows open like a liquid.
// The scene texture is rendered at `scale` x the canvas resolution (the water and Lenia are smooth) and
// upscaled here; the glass itself is drawn at full resolution. The UI lowers `scale` on slow GPUs.

const MAX_SHAPES = 2;         // the tools orb and the parameters orb
export const SCENE_SCALE = 0.6;     // default render scale of the scene

const SHADER = /* wgsl */`
struct Shape {
  rect: vec4f,   // x0, y0, x1, y1 (canvas px)
  p: vec4f,      // corner radius, tint (darkening for legibility), blob radius, -
  blob: vec4f,   // blob centre x, y, smooth-union width, -
};
struct Glass { size: vec2f, n: u32, dpr: f32, s: array<Shape, ${MAX_SHAPES}> };   // size = canvas px
@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var<uniform> G: Glass;

@vertex fn vs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  let xy = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u)) * 2.0 - 1.0;
  return vec4f(xy, 0.0, 1.0);
}

// signed distance to the shape (negative inside)
fn sd(p: vec2f, sh: Shape) -> f32 {
  let c = 0.5 * (sh.rect.xy + sh.rect.zw);
  let hs = max(0.5 * (sh.rect.zw - sh.rect.xy), vec2f(0.5));
  let r = min(sh.p.x, min(hs.x, hs.y));
  let q = abs(p - c) - hs + r;
  var d = length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
  if (sh.p.z > 0.5) {   // smooth union with the blob circle
    let db = length(p - sh.blob.xy) - sh.p.z;
    let k = sh.blob.z;
    let h = clamp(0.5 + 0.5 * (db - d) / k, 0.0, 1.0);
    d = mix(db, d, h) - k * h * (1.0 - h);
  }
  return d;
}
fn tap(p: vec2f) -> vec3f { return textureSampleLevel(scene, samp, p / G.size, 0.0).rgb; }
fn spectral(h: f32) -> vec3f { return 0.5 + 0.5 * cos(6.2831853 * (h + vec3f(0.0, 0.33, 0.67))); }

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let p = pos.xy;
  var col = tap(p);
  // soft shadows under every shape
  for (var i = 0u; i < G.n; i++) {
    let sh = G.s[i];
    let d = sd(p, sh);
    if (d > 0.0) { col *= 1.0 - 0.32 * exp(-d / (14.0 * G.dpr)); }
  }
  for (var i = 0u; i < G.n; i++) {
    let sh = G.s[i];
    let d = sd(p, sh);
    if (d > 1.0) { continue; }
    let e = 1.0;
    let nrm = normalize(vec2f(sd(p + vec2f(e, 0.0), sh) - sd(p - vec2f(e, 0.0), sh),
                              sd(p + vec2f(0.0, e), sh) - sd(p - vec2f(0.0, e), sh)) + vec2f(1e-6));   // outward
    let hs = 0.5 * (sh.rect.zw - sh.rect.xy);
    let bevel = max(2.0, min(18.0 * G.dpr, max(min(hs.x, hs.y), sh.p.z) * 0.8));
    let edge = 1.0 - clamp(-d / bevel, 0.0, 1.0);          // 1 at the rim, 0 in the flat interior
    let bend = edge * edge;
    // refraction: near the rim, look further outwards (the lens bends the outside in); per channel = dispersion
    let off = nrm * (28.0 * G.dpr) * bend;
    let fr = 1.1 * G.dpr;                                   // light frost: 4-tap rotated kernel
    let o1 = vec2f(fr, 0.4 * fr); let o2 = vec2f(-0.4 * fr, fr);
    var g = vec3f(0.0);
    let ks = vec3f(1.0, 1.09, 1.18);
    for (var c = 0; c < 3; c++) {
      let q = p + off * ks[c];
      let v = 0.25 * (tap(q + o1) + tap(q - o1) + tap(q + o2) + tap(q - o2));
      g[c] = v[c];
    }
    g = g * (1.0 - sh.p.y) + vec3f(0.03);                  // tint for legibility, a breath of white
    // Fresnel rim + specular edge lit from the top-left, weaker bounce on the far side
    let L = normalize(vec2f(-0.55, -0.85));
    let rim = pow(edge, 6.0);
    g += vec3f(1.0) * (0.07 * pow(edge, 2.5) + rim * (0.7 * max(dot(nrm, L), 0.0) + 0.22 * max(dot(nrm, -L), 0.0)));
    // thin-film sheen along the rim
    g += spectral(atan2(nrm.y, nrm.x) * 0.32 + edge * 1.4) * pow(edge, 4.0) * 0.08;
    col = mix(col, g, clamp(0.5 - d, 0.0, 1.0));
  }
  return vec4f(col, 1.0);
}`;

export class GlassLayer {
  constructor(device, format) {
    this.device = device;
    this.format = format;
    this.w = 0; this.h = 0;
    this.scale = SCENE_SCALE;
    this.uniform = device.createBuffer({ size: 16 + 48 * MAX_SHAPES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
    this.layout = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
    ] });
    const module = device.createShaderModule({ code: SHADER, label: 'glass' });
    this.pipe = device.createRenderPipeline({
      label: 'glass', layout: device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
      vertex: { module, entryPoint: 'vs' }, fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
  }

  // the scene texture follows the canvas size (times `scale`); returns the view the scene is rendered into
  sceneView(cw, ch) {
    const w = Math.max(1, Math.round(cw * this.scale)), h = Math.max(1, Math.round(ch * this.scale));
    if (w !== this.w || h !== this.h) {
      this.tex?.destroy();
      this.w = w; this.h = h;
      this.tex = this.device.createTexture({ size: [w, h], format: this.format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      this.view = this.tex.createView();
      this.bg = this.device.createBindGroup({ layout: this.layout, entries: [
        { binding: 0, resource: this.view }, { binding: 1, resource: this.sampler }, { binding: 2, resource: { buffer: this.uniform } },
      ] });
    }
    return this.view;
  }

  // shapes: [{ x0, y0, x1, y1, r, tint, blobR, bx, by, k }] in canvas px
  draw(enc, target, shapes, cw, ch, dpr) {
    const n = Math.min(shapes.length, MAX_SHAPES);
    const buf = new ArrayBuffer(16 + 48 * MAX_SHAPES), f = new Float32Array(buf), u = new Uint32Array(buf);
    f[0] = cw; f[1] = ch; u[2] = n; f[3] = dpr;
    shapes.slice(0, n).forEach((s, i) => f.set([s.x0, s.y0, s.x1, s.y1, s.r, s.tint, s.blobR, 0, s.bx, s.by, s.k, 0], 4 + 12 * i));
    this.device.queue.writeBuffer(this.uniform, 0, buf);
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: target, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
    pass.setPipeline(this.pipe); pass.setBindGroup(0, this.bg); pass.draw(3);
    pass.end();
  }
}
