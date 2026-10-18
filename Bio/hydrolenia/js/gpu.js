// Shared WGSL header and helpers for building compute kernels.

export const WG = 64;   // workgroup size for 1D kernels

// Simulation parameters shared by every kernel (binding 0)
export const HEADER = /* wgsl */`
struct Params {
  W: u32, H: u32, nTracers: u32, brushOn: u32,
  omegaP: f32, omegaM: f32, maxV: f32, tracerSpeed: f32,
  brushX: f32, brushY: f32, brushFX: f32, brushFY: f32,
  brushR: f32, seed: f32, pad0: f32, pad1: f32,
};
@group(0) @binding(0) var<uniform> P: Params;

const EPS: f32 = 1.1920929e-7;

fn size() -> vec2f { return vec2f(f32(P.W), f32(P.H)); }
fn wrapPos(p: vec2f) -> vec2f { let s = size(); return p - s * floor(p / s); }
fn imod(a: i32, n: i32) -> i32 { return ((a % n) + n) % n; }
fn cell(x: i32, y: i32) -> u32 { return u32(imod(y, i32(P.H))) * P.W + u32(imod(x, i32(P.W))); }
`;

// bindings: [name, wgslType, access]  access: 'r' | 'rw'  (bound from 1 upwards)
export function kernel(bindings, body, extra = '') {
  const decl = bindings.map(([name, type, access], i) =>
    `@group(0) @binding(${i + 1}) var<storage, ${access === 'r' ? 'read' : 'read_write'}> ${name}: ${type};`).join('\n');
  return { bindings, code: HEADER + decl + '\n' + extra + '\n' + body };
}

// Compile a table of kernels into compute pipelines with explicit bind group layouts.
export function buildPipelines(device, kernels) {
  const pipes = {}, layouts = {};
  for (const [name, k] of Object.entries(kernels)) {
    const entries = [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }];
    k.bindings.forEach(([, , access], i) => entries.push({
      binding: i + 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: access === 'r' ? 'read-only-storage' : 'storage' },
    }));
    layouts[name] = device.createBindGroupLayout({ entries });
    pipes[name] = device.createComputePipeline({
      label: name, layout: device.createPipelineLayout({ bindGroupLayouts: [layouts[name]] }),
      compute: { module: device.createShaderModule({ code: k.code, label: name }), entryPoint: 'main' },
    });
  }
  return { pipes, layouts };
}

// Bind group for kernel `name`: binding 0 = params, then the buffers named in its bindings
export function bindGroup(device, kernels, layouts, name, params, buffers) {
  const entries = [{ binding: 0, resource: { buffer: params } }];
  kernels[name].bindings.forEach(([bname], i) => {
    if (!buffers[bname]) throw new Error(`${name}: missing buffer ${bname}`);
    entries.push({ binding: i + 1, resource: { buffer: buffers[bname] } });
  });
  return device.createBindGroup({ layout: layouts[name], entries, label: name });
}
