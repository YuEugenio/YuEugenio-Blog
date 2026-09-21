/** Local WebGL reconstruction of ochyai.dev's fluid/glass background.
 * The reference shader constants are preserved in src/shaders.
 * Two floating-point targets retain pointer momentum between frames.
 */
export async function startFluid(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
  if (!gl) throw new Error('WebGL is unavailable; showing the original still texture.');
  const float = gl.getExtension('OES_texture_float');
  const floatLinear = gl.getExtension('OES_texture_float_linear');
  const half = gl.getExtension('OES_texture_half_float');
  const halfLinear = gl.getExtension('OES_texture_half_float_linear');
  const candidates = [
    half && { type: half.HALF_FLOAT_OES, filter: halfLinear ? gl.LINEAR : gl.NEAREST },
    float && { type: gl.FLOAT, filter: floatLinear ? gl.LINEAR : gl.NEAREST },
  ].filter(Boolean);
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const resolution = mobile ? 128 : 256;
  const scale = mobile ? .6 : .75 * Math.min(devicePixelRatio, 2);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // Match the shader's fade endpoint. Below this point the displayed CG frame
  // is frozen: no pointer forces, simulation, animated lights or grain.
  const readingStart = .4;
  let width, height, frame = 0, stopped = false, scroll = 0, readingMode = false;
  const pointer = { x: .5, y: .5, vx: 0, vy: 0 };
  const shaders = await Promise.all(['fullscreen.vert', 'fluid.frag', 'light.frag'].map(async name => {
    const response = await fetch(new URL(`./shaders/${name}`, import.meta.url));
    if (!response.ok) throw new Error(`Cannot load shader ${name}`);
    return response.text();
  }));
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  const vertex = compile(gl.VERTEX_SHADER, shaders[0]);
  function program(source, names) {
    const fragment = compile(gl.FRAGMENT_SHADER, source);
    const handle = gl.createProgram();
    gl.attachShader(handle, vertex); gl.attachShader(handle, fragment); gl.linkProgram(handle);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(handle));
    return { handle, attribute: gl.getAttribLocation(handle, 'a'),
      uniforms: Object.fromEntries(names.map(name => [name, gl.getUniformLocation(handle, name)])) };
  }
  const simulation = program(shaders[1], ['prev', 'tx', 'ms', 'msV', 'asp']);
  const lighting = program(shaders[2], ['tex', 'field', 'T', 'asp', 'iAsp', 'scrl']);
  gl.deleteShader(vertex);
  function target(format) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, resolution, resolution, 0, gl.RGBA, format.type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, format.filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, format.filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const buffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteTexture(texture); gl.deleteFramebuffer(buffer); return null;
    }
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { texture, buffer };
  }
  let read, write;
  for (const format of candidates) {
    read = target(format);
    if (read) { write = target(format); break; }
  }
  if (!read || !write) throw new Error('Floating-point framebuffers unavailable.');
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve; image.onerror = () => reject(new Error('Background texture failed to load.'));
    image.src = new URL('../assets/bg.png', import.meta.url).href;
  });
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // DOM images start at the top-left, while WebGL textures start at the
  // bottom-left. Flip once during upload so the source file and the rendered
  // background keep the same visual orientation.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  function resize() {
    width = innerWidth; height = innerHeight;
    canvas.width = Math.floor(width * scale); canvas.height = Math.floor(height * scale);
    onScroll();
    requestRender();
  }
  function onPointer(event) {
    const x = event.clientX / width, y = 1 - event.clientY / height;
    if (readingMode || reducedMotion.matches) {
      pointer.vx = 0; pointer.vy = 0;
    } else {
      pointer.vx += (x - pointer.x - pointer.vx) * .35;
      pointer.vy += (y - pointer.y - pointer.vy) * .35;
    }
    pointer.x = x; pointer.y = y;
  }
  function updateMotionState() {
    canvas.dataset.motion = readingMode ? 'static' : reducedMotion.matches ? 'reduced' : 'interactive';
  }
  function onScroll() {
    scroll = window.scrollY / (height || 1);
    const nextMode = scroll >= readingStart;
    const changed = nextMode !== readingMode;
    if (changed) { pointer.vx = 0; pointer.vy = 0; }
    readingMode = nextMode;
    updateMotionState();
    // Brightness is constant throughout the reading region; scrolling farther
    // down does not redraw or evolve the frozen background.
    if (changed || !readingMode) requestRender();
  }
  function draw(program) {
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(program.attribute);
    gl.vertexAttribPointer(program.attribute, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  let elapsed = 0, previous = performance.now();
  function requestRender() {
    if (!stopped && !frame && !document.hidden) {
      previous = performance.now();
      frame = requestAnimationFrame(render);
    }
  }
  function onVisibilityChange() {
    if (document.hidden) {
      cancelAnimationFrame(frame); frame = 0;
    } else requestRender();
  }
  function onMotionChange() {
    pointer.vx = 0; pointer.vy = 0;
    updateMotionState(); requestRender();
  }
  function render(now) {
    frame = 0;
    if (stopped || document.hidden) return;
    const animated = !readingMode && !reducedMotion.matches;
    if (animated) {
      elapsed += Math.min((now - previous) / 1000, .1);
      gl.bindFramebuffer(gl.FRAMEBUFFER, write.buffer);
      gl.viewport(0, 0, resolution, resolution);
      gl.useProgram(simulation.handle);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, read.texture);
      const s = simulation.uniforms;
      gl.uniform1i(s.prev, 0); gl.uniform2f(s.tx, 1 / resolution, 1 / resolution);
      gl.uniform2f(s.ms, pointer.x, pointer.y);
      gl.uniform2f(s.msV, pointer.vx, pointer.vy);
      gl.uniform1f(s.asp, width / height); draw(simulation);
      [read, write] = [write, read]; pointer.vx *= .85; pointer.vy *= .85;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height); gl.useProgram(lighting.handle);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, read.texture);
    const l = lighting.uniforms;
    gl.uniform1i(l.tex, 0); gl.uniform1i(l.field, 1); gl.uniform1f(l.T, elapsed);
    gl.uniform1f(l.asp, width / height); gl.uniform1f(l.iAsp, image.width / image.height);
    gl.uniform1f(l.scrl, scroll); draw(lighting);
    previous = now;
    if (animated) frame = requestAnimationFrame(render);
  }
  function dispose() {
    stopped = true; cancelAnimationFrame(frame);
    document.removeEventListener('pointermove', onPointer);
    window.removeEventListener('resize', resize); window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    reducedMotion.removeEventListener('change', onMotionChange);
    for (const t of [read, write]) { gl.deleteTexture(t.texture); gl.deleteFramebuffer(t.buffer); }
    gl.deleteTexture(texture); gl.deleteBuffer(quad);
    gl.deleteProgram(simulation.handle); gl.deleteProgram(lighting.handle);
  }
  resize();
  document.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('resize', resize);
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
  reducedMotion.addEventListener('change', onMotionChange);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); dispose(); }, { once: true });
  canvas.addEventListener('webglcontextrestored', () => startFluid(canvas).catch(console.error), { once: true });
  canvas.dataset.renderer = 'webgl';
  requestRender();
  return dispose;
}
