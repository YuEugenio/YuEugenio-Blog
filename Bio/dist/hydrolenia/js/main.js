// HydroLenia — UI: canvas interaction (stir / spawn / erase), the two glass orbs (tools, parameters), the frame loop.
import { Engine, FLUID_DEFAULTS } from './engine.js';
import { SCENE_SCALE } from './glass.js';
import { SPECIES } from './species.js';
import { rle2arr } from './lenia.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const canvas = $('#gpu');

const STEPS_PER_FRAME = 8;   // physics steps per rendered frame
const GRID_CELLS = 512 * 432; // lattice cells in the tank (its shape follows the window); fewer on slow GPUs
const MIN_CELLS = 48000;
const FRAME_BUDGET_MS = 18;   // a frame slower than this at start-up shrinks the tank (an M-series Mac needs ~13-16 ms)
const TRACERS = 12000;

const S = { engine: null, tool: 'spawn', species: SPECIES[0], pointer: null, cells: GRID_CELLS, placedAt: -1e9 };

async function boot() {
  resizeCanvas();
  try {
    S.engine = await Engine.create(canvas);
  } catch (err) {
    $('#fatal-msg').textContent = err.message;
    $('#fatal-hint').textContent = unsupportedHint();
    $('#fatal').classList.remove('hidden');
    return;
  }
  const e = S.engine;
  e.lost.then((info) => {
    if (info.reason === 'destroyed') return;
    $('#fatal h2').textContent = 'The GPU was reset';
    $('#fatal-msg').textContent = `The browser stopped the WebGPU device (${info.message || 'device lost'}). Reload the page to continue.`;
    $('#fatal .card').insertAdjacentHTML('beforeend', '<div class="row buttons"><button onclick="location.reload()">Reload</button></div>');
    $('#fatal').classList.remove('hidden');
  });
  e.resizeGrid(...gridSize(S.cells));
  e.seedTracers(TRACERS);
  bindPanel();
  bindCanvas();
  await calibrate();
  new ResizeObserver(onResize).observe(document.body);
  requestAnimationFrame(loop);
  setInterval(updateHint, 400);
}

// what to tell people whose browser cannot run WebGPU
function unsupportedHint() {
  const ua = navigator.userAgent;
  if (!window.isSecureContext) return 'WebGPU only works on secure pages: open HydroLenia over https:// (or on localhost).';
  if (navigator.gpu) return 'This browser supports WebGPU but found no usable GPU (as in the iOS Simulator, a virtual machine, or with a blocked graphics driver). Try a real device with up-to-date system and browser.';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'On iPhone and iPad it needs iOS / iPadOS 26 or later.';
  if (/Android/.test(ua)) return 'On Android, use a recent Google Chrome (Android 12 or later, with a supported GPU).';
  if (/Firefox\//.test(ua)) return 'This Firefox has no WebGPU on this system yet. Use Google Chrome, Microsoft Edge, or Safari 26+.';
  if (/Linux/.test(ua)) return 'On Linux, Chrome may need WebGPU switched on: chrome://flags → “Unsafe WebGPU Support” → Enabled, then restart. A recent GPU driver is needed too.';
  return 'Use a recent Google Chrome, Microsoft Edge, or Safari 26+.';
}

// Slow GPUs get a smaller tank: time a few frames at full size and scale the cell count to the frame budget.
async function calibrate() {
  const e = S.engine;
  const frame = async () => { e.frame(STEPS_PER_FRAME); await e.device.queue.onSubmittedWorkDone(); };
  for (let i = 0; i < 4; i++) await frame();   // warm-up: pipeline compilation, caches
  const t0 = performance.now();
  for (let i = 0; i < 8; i++) await frame();
  const ms = (performance.now() - t0) / 8;
  if (ms > FRAME_BUDGET_MS) {
    S.cells = Math.max(MIN_CELLS, Math.round(GRID_CELLS * FRAME_BUDGET_MS / ms));
    rebuildGrid();
  }
}

function rebuildGrid() {
  const e = S.engine;
  e.resizeGrid(...gridSize(S.cells));
  e.seedTracers(e.nTracers);
}

// a big change of the window's shape (e.g. rotating a phone) rebuilds the tank to match it
let rebuildTimer = 0;
function onResize() {
  resizeCanvas();
  const e = S.engine;
  if (Math.abs(Math.log((canvas.clientWidth / Math.max(1, canvas.clientHeight)) / (e.W / e.H))) > 0.2) {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(rebuildGrid, 400);
  }
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}

// tank shaped like the window (multiples of 16) with about `cells` cells
function gridSize(cells) {
  const a = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const r16 = (x) => Math.max(64, Math.round(x / 16) * 16);
  return [r16(Math.sqrt(cells * a)), r16(Math.sqrt(cells / a))];
}

// While running, the scene's render resolution follows the frame rate: lowered when frames come too slowly,
// raised back (up to the default) when there is headroom.
let lastT = 0, avgDt = 16.7, lastAdapt = 0;
function adaptRenderScale(t) {
  if (lastT && t - lastT < 100 && !document.hidden) avgDt += 0.05 * ((t - lastT) - avgDt);
  lastT = t;
  if (t - lastAdapt < 1000) return;
  lastAdapt = t;
  const g = S.engine.glass;
  if (avgDt > 20 && g.scale > 0.35) g.scale = Math.max(0.35, g.scale - 0.1);
  else if (avgDt < 14 && g.scale < SCENE_SCALE) g.scale = Math.min(SCENE_SCALE, g.scale + 0.05);
}

function loop(t) {
  adaptRenderScale(t);
  updateBrush();
  updateGlass();
  S.engine.frame(STEPS_PER_FRAME);
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------------ canvas interaction
function worldXY(ev) {
  const r = canvas.getBoundingClientRect(), k = canvas.width / r.width;
  return S.engine.screenToWorld((ev.clientX - r.left) * k, (ev.clientY - r.top) * k);
}
const screenCells = (cssPx) => cssPx * (window.devicePixelRatio || 1) / S.engine.viewTransform().s;
const rndAngle = () => Math.random() * Math.PI * 2;

function bindCanvas() {
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    // while a card is open, a tap outside it only folds the cards away; the water reacts once all are closed
    if (document.querySelector('.morph.open')) { closeOrbs(); return; }
    try { canvas.setPointerCapture(ev.pointerId); } catch { /* already released */ }
    const [x, y] = worldXY(ev);
    S.pointer = { x0: x, y0: y, x, y, px: x, py: y, last: [x, y], painted: false, mode: { interact: 'stir', spawn: 'spawn', erase: 'erase' }[S.tool] };
    if (S.tool === 'interact') canvas.classList.add('dragging');
    if (S.tool === 'erase') eraseAt(x, y);
  });
  canvas.addEventListener('pointermove', (ev) => {
    const p = S.pointer;
    if (!p) return;
    const [x, y] = worldXY(ev);
    p.x = x; p.y = y;
    if (p.mode === 'erase') eraseAt(x, y);
    if (p.mode === 'spawn' && ev.shiftKey && Math.hypot(x - p.last[0], y - p.last[1]) > 30) {
      place(x, y, Math.atan2(y - p.last[1], x - p.last[0]));
      p.last = [x, y]; p.painted = true;
    }
  });
  const end = () => {
    const p = S.pointer;
    if (!p) return;
    if (p.mode === 'spawn' && !p.painted) {
      const dx = p.x - p.x0, dy = p.y - p.y0;
      place(p.x0, p.y0, Math.hypot(dx, dy) > 2 ? Math.atan2(dy, dx) : rndAngle());
    }
    S.engine.brush.on = false;
    S.engine.lenia.erase.on = false;
    S.pointer = null;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
}

// stirring: pointer velocity (cells/step) becomes a Gaussian body force, clamped for LBM stability
function updateBrush() {
  const p = S.pointer, b = S.engine.brush;
  if (!p || p.mode !== 'stir') { b.on = false; return; }
  const W = S.engine.W, H = S.engine.H;
  let dx = p.x - p.px, dy = p.y - p.py;
  dx -= W * Math.round(dx / W); dy -= H * Math.round(dy / H);
  p.px = p.x; p.py = p.y;
  let fx = dx / STEPS_PER_FRAME * 0.06, fy = dy / STEPS_PER_FRAME * 0.06;
  const m = Math.hypot(fx, fy), lim = 0.004;
  if (m > lim) { fx *= lim / m; fy *= lim / m; }
  Object.assign(b, { on: true, x: p.x, y: p.y, fx, fy, r: Math.max(4, screenCells(40)) });
}

function place(x, y, angle) {
  const L = S.engine.lenia;
  if (!L.on) setLeniaOn(true);
  L.place(S.species, x, y, angle);
  S.placedAt = performance.now();
  $('#hint').classList.remove('show');   // start fading out right away, while the creature blooms
}

// ------------------------------------------------------------------ empty-tank hint
const EMPTY_MASS = 2;   // below this total mass the tank counts as empty
const hintText = () => (S.tool === 'spawn' ? 'Touch the water to bring Lenia to life' : 'Hold the button on the left to pick a Lenia');
async function updateHint() {
  const L = S.engine.lenia;
  let empty = false;
  if (L.on && !L.nurse.some((n) => n.active) && performance.now() - S.placedAt > 1500) {
    const m = await L.readMass();
    if (m === null) return;
    empty = m < EMPTY_MASS;
  }
  const h = $('#hint');
  if (empty) h.textContent = hintText();
  h.classList.toggle('show', empty);
}

function eraseAt(x, y) {
  Object.assign(S.engine.lenia.erase, { on: true, x, y, r: Math.max(3, screenCells(30)) });
}

// ------------------------------------------------------------------ panel
const FMT = {
  visc: (v) => (10 ** v).toPrecision(2), x: (v) => v.toFixed(2) + '×', f2: (v) => v.toFixed(2), f3: (v) => v.toFixed(3),
  int: (v) => v.toFixed(0), k: (v) => (v / 1000).toFixed(0) + 'k', sec: (v) => v.toFixed(2) + 's',
};
function paintRange(el) {
  el.style.setProperty('--fill-pct', (el.value - el.min) / (el.max - el.min) * 100 + '%');
  el.parentElement.querySelector('output').textContent = FMT[el.dataset.fmt](+el.value);
}
const controls = [];
function range(sel, fmt, get, set) {
  const el = $(sel);
  el.dataset.fmt = fmt;
  el.addEventListener('input', () => { set(+el.value); paintRange(el); });
  el.sync = () => { el.value = get(); paintRange(el); };
  controls.push(el);
}
function seg(sel, get, set) {
  const el = $(sel);
  el.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) { set(+b.dataset.v); el.sync(); } });
  el.sync = () => el.querySelectorAll('button').forEach((b) => b.classList.toggle('active', +b.dataset.v === get()));
  controls.push(el);
}
function toggle(sel, get, set) {
  const el = $(sel);
  el.addEventListener('change', () => set(el.checked));
  el.sync = () => { el.checked = get(); };
  controls.push(el);
}
const syncControls = () => controls.forEach((c) => c.sync());

function setLeniaOn(on) {
  const L = S.engine.lenia;
  L.on = on;
  if (!on) L.clearForce();
  syncControls();
}

function bindPanel() {
  const e = S.engine, L = e.lenia, v = e.view;
  toggle('#l-on', () => L.on, setLeniaOn);
  seg('#l-pal', () => v.leniaPal, (x) => { v.leniaPal = x; });
  range('#l-scale', 'x', () => L.scale, (x) => L.setRule(L.species, x));
  range('#l-coupling', 'f2', () => L.coupling, (x) => { L.coupling = x; });
  range('#l-reveal', 'sec', () => L.revealSeconds, (x) => { L.revealSeconds = x; });
  range('#l-spg', 'int', () => L.stepsPerGen, (x) => { L.stepsPerGen = x; });
  range('#l-push', 'f2', () => L.push, (x) => { L.push = x; });
  range('#p-visc', 'visc', () => Math.log10(e.fluid.viscosity), (x) => { e.fluid.viscosity = 10 ** x; });
  range('#p-maxv', 'f3', () => e.fluid.maxV, (x) => { e.fluid.maxV = x; });
  seg('#v-mode', () => v.mode, (x) => { v.mode = x; });
  seg('#v-theme', () => v.theme, (x) => { v.theme = x; });
  range('#v-gain', 'f2', () => v.gain, (x) => { v.gain = x; });
  toggle('#v-tracers', () => e.showTracers, (x) => { e.showTracers = x; });
  range('#v-tcount', 'k', () => e.nTracers, (x) => e.seedTracers(x));
  $('#l-clear').addEventListener('click', () => { L.clear(); toast('Lenia cleared'); });
  $('#btn-fluid-reset').addEventListener('click', () => { Object.assign(e.fluid, FLUID_DEFAULTS); syncControls(); });
  $('#panel-close').addEventListener('click', () => closeOrbs());
  buildToolMenu();
  holdToOpen($('#tools'), { onMove: hoverItem, onRelease: releaseOnItem });
  holdToOpen($('#panel'));
  syncControls();
  setTool('spawn', SPECIES[0]);   // open ready to place creatures
}

// ------------------------------------------------------------------ glass orbs
// An orb opens on press-and-hold; while still holding, slide onto a menu item and release to pick it
// (releasing without sliding keeps it open, to tap an item). Touching the water closes the orbs again.
const HOLD_MS = 350;
const SLIDE_PX = 8;   // movement after opening that counts as sliding to an item
function holdToOpen(el, { onMove, onRelease } = {}) {
  let timer = 0, pid = null, x0 = 0, y0 = 0, sliding = false;
  el.addEventListener('pointerdown', (ev) => {
    if (el.classList.contains('open') || ev.button !== 0) return;
    pid = ev.pointerId; x0 = ev.clientX; y0 = ev.clientY; sliding = false;
    try { el.setPointerCapture(pid); } catch { /* already released */ }
    el.classList.add('pressing');
    timer = setTimeout(() => { el.classList.remove('pressing'); openOrb(el); }, HOLD_MS);
  });
  el.addEventListener('pointermove', (ev) => {
    if (ev.pointerId !== pid || !el.classList.contains('open')) return;
    sliding ||= Math.hypot(ev.clientX - x0, ev.clientY - y0) > SLIDE_PX;
    if (sliding) onMove?.(ev);
  });
  const end = (ev) => {
    if (ev.pointerId !== pid) return;
    pid = null;
    clearTimeout(timer);
    el.classList.remove('pressing');
    if (el.classList.contains('open') && sliding) onRelease?.(ev);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('contextmenu', (ev) => ev.preventDefault());
}
function openOrb(el) {
  const menu = el.querySelector('.menu');
  if (menu) el.style.setProperty('--open-h', menu.scrollHeight + 'px');
  el.classList.add('open');
}
function closeOrbs() {
  $$('.morph').forEach((el) => el.classList.remove('open', 'pressing'));
  $$('#tools .item.hot').forEach((b) => b.classList.remove('hot'));
}
const itemAt = (ev) => document.elementFromPoint(ev.clientX, ev.clientY)?.closest('#tools .item');
function hoverItem(ev) {
  const it = itemAt(ev);
  $$('#tools .item').forEach((b) => b.classList.toggle('hot', b === it));
}
function releaseOnItem(ev) {
  const it = itemAt(ev);
  $$('#tools .item.hot').forEach((b) => b.classList.remove('hot'));
  if (it) pickItem(it);
}
function pickItem(it) {
  setTool(it.dataset.tool, SPECIES.find((sp) => sp.code === it.dataset.code));
  closeOrbs();
}

// liquid-glass outlines, drawn by js/glass.js. Each frame a card's outline springs toward its DOM element (a
// circle when closed, the card when open). The four edges spring independently, so the far edge lags and the
// shape stretches like a liquid; on opening, the button's circle stays fused to the growing card and drains away.
const SPRING = { k: 320, c: 26 };            // slightly under-damped: a small settle
const BLOB = { k: 70, c: 15 };
const OPEN_RADIUS = { tools: 26, panel: 28 };
const TINT = { tools: 0.3, panel: 0.45, closed: 0.08 };   // darkening behind text, for legibility
const glassState = new Map();
let glassT = performance.now();
function updateGlass() {
  const now = performance.now(), dt = Math.min(1 / 30, (now - glassT) / 1000);
  glassT = now;
  const px = canvas.width / Math.max(1, canvas.clientWidth);
  const spring = (x, v, target, { k, c }) => { v += (k * (target - x) - c * v) * dt; return [x + v * dt, v]; };
  const shapes = [];
  for (const el of $$('.morph')) {
    const open = el.classList.contains('open'), b = el.getBoundingClientRect();
    let tgt = [b.left, b.top, b.right, b.bottom, open ? OPEN_RADIUS[el.id] : b.width / 2];
    if (!open && el.classList.contains('pressing')) {   // pressed: the glass swells
      const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2, h = b.width * 0.56;
      tgt = [cx - h, cy - h, cx + h, cy + h, h];
    }
    let st = glassState.get(el);
    if (!st) { st = { x: tgt.slice(), v: [0, 0, 0, 0, 0], open, blob: null, tint: TINT.closed, tv: 0 }; glassState.set(el, st); }
    if (open && !st.open) st.blob = { x: (st.x[0] + st.x[2]) / 2, y: (st.x[1] + st.x[3]) / 2, r: (st.x[2] - st.x[0]) / 2, v: 0 };
    if (!open) st.blob = null;
    st.open = open;
    for (let i = 0; i < 5; i++) [st.x[i], st.v[i]] = spring(st.x[i], st.v[i], tgt[i], SPRING);
    [st.tint, st.tv] = spring(st.tint, st.tv, open ? TINT[el.id] : TINT.closed, SPRING);
    if (st.blob) { [st.blob.r, st.blob.v] = spring(st.blob.r, st.blob.v, 0, BLOB); if (st.blob.r < 0.5) st.blob = null; }
    shapes.push({
      x0: st.x[0] * px, y0: st.x[1] * px, x1: st.x[2] * px, y1: st.x[3] * px, r: Math.max(0, st.x[4]) * px, tint: st.tint,
      blobR: st.blob ? st.blob.r * px : 0, bx: st.blob ? st.blob.x * px : 0, by: st.blob ? st.blob.y * px : 0, k: 34 * px,
    });
  }
  S.engine.glassShapes = shapes;
}

// left menu: Stir, Erase, then one entry per species (picking a species means placing it)
function buildToolMenu() {
  const box = $('#species-items');
  for (const sp of SPECIES) {
    const b = document.createElement('button');
    b.className = 'item'; b.dataset.tool = 'spawn'; b.dataset.code = sp.code; b.title = `${sp.name} — ${sp.blurb}`;
    b.innerHTML = `<canvas width="64" height="64"></canvas><span>${sp.name.split(' ')[0]}</span>`;
    thumbnail(b.querySelector('canvas'), sp);
    box.appendChild(b);
  }
  $$('#tools .item').forEach((b) => b.addEventListener('click', () => pickItem(b)));
}
// greyscale pattern thumbnail
function thumbnail(cv, sp) {
  const c = sp._cells ||= rle2arr(sp.cells);
  const ctx = cv.getContext('2d'), img = ctx.createImageData(cv.width, cv.height);
  const s = Math.min(cv.width / c.w, cv.height / c.h) * 0.92;
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      const i = Math.floor((x - cv.width / 2) / s + c.w / 2), j = Math.floor((y - cv.height / 2) / s + c.h / 2);
      const v = i >= 0 && j >= 0 && i < c.w && j < c.h ? Math.min(1, c.data[j][i]) : 0;
      const k = 4 * (y * cv.width + x);
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = 255 * Math.min(1, v * 1.6);
    }
  }
  ctx.putImageData(img, 0, 0);
}

// current tool (and species, for spawn); the closed orb shows it
function setTool(tool, species) {
  S.tool = tool;
  if (species) S.species = species;
  $$('#tools .item').forEach((b) => b.classList.toggle('active',
    b.dataset.tool === tool && (tool !== 'spawn' || b.dataset.code === S.species.code)));
  canvas.classList.toggle('spawn', tool === 'spawn');
  canvas.classList.toggle('erase', tool === 'erase');
  if ($('#hint').classList.contains('show')) $('#hint').textContent = hintText();
  const face = $('#tools-face'), cur = $('#tools .item.active');
  face.replaceChildren();
  if (tool === 'spawn') {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    cv.getContext('2d').drawImage(cur.querySelector('canvas'), 0, 0);
    face.appendChild(cv);
  } else face.appendChild(cur.querySelector('svg').cloneNode(true));
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

window.hydrolenia = S;   // debugging handle (console)
boot();
