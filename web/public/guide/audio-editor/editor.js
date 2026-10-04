// Patternflow Audio — the mapping editor.
//
// One module, no chrome.* and no fetch. It stands on two things:
//
//   PFMap (mapping.js)   the model: defaults, what a stored mapping is turned
//                        into, the curves, the level-to-knob chain.
//   window.PFAdapter     the SOURCE: the extension's is editor-adapter.js, the
//                        panel's is console/_audio_in_adapter.js. This file
//                        moves to the panel verbatim; only the adapter differs.
//
// The model, in one sentence: a band is a BOX drawn on the live spectrum
// (width = the frequencies it listens to, height = the level window it maps),
// and a RESPONSE CURVE that turns position-in-window into position-in-output-
// range. Curves bake to a 33-point table on save; the analysis side — and
// the firmware — only interpolates, and never learns what a bezier is.
//
// THE ADAPTER CONTRACT. The source owns its limits, its axis, its defaults
// and where a level sits in a window; the editor draws what it is told and
// asks rather than assumes.
//
//   loadConfig() -> Promise<config | null>
//       { autoRange, smoothing, attack, bands[4] }, each band { hzMin, hzMax,
//       inMin, inMax, gain, outMin, outMax, muted, curve, lut }. Levels are
//       0..1 along the source's own level axis. null means NOTHING IS STORED
//       (a first run): the editor then starts from PFMap's defaults. A source
//       that could not read must not answer null - it keeps the promise open
//       until it can; the editor stays inert meanwhile.
//   caps() -> asked once, after loadConfig() has settled
//       hzMin, hzMax    the ends of the frequency axis
//       db              [bottom, top]: the dB at 0 and at 1 of the level axis
//       levelMax        the highest a window's top edge is stored, 0..1
//       hzGap           the narrowest band the source stores, in Hz
//       top(lo)         the lowest top edge it stores over a bottom at `lo`
//       bottom(hi)      the highest bottom edge it stores under a top at `hi`
//     Only hzMin and hzMax are required; the rest default to an axis with no
//     dB printed on it, the whole axis, and PFMap.MIN_WINDOW.
//   saveConfig(config) -> Promise    store it and hand it to what is mapping
//   resetBand(i, config) -> Promise<config>
//       band i back to the SOURCE's default. Answers the whole mapping as it
//       now stands (as loadConfig would); the editor takes that and does not
//       save it back.
//   resetAll(button)    optional: the source's own "reset everything", where it
//                       has one. The editor then shows Reset mapping beside
//                       the knob's own Reset and calls this with the button
//                       pressed (for PFConfirm); what comes back goes in
//                       through onConfig. A source without it has no such
//                       button.
//   onConfig(fn)        optional: fn(config) replaces the editor's copy without
//                       saving it (after a reset the source did by itself)
//   onFrame(fn)         fn(frame), about ten times a second while there is
//                       something to show. Called once, when the editor is up.
//       levels[4]       each band's level, 0..1 on the level axis. Empty or
//                       missing = nothing is being heard: no level line, no
//                       cursor.
//       spectrum[64]    log-spaced over hzMin..hzMax, same axis
//       env[4]          { lo, hi } per band while auto range has a learned
//                       envelope; missing, or null for that band, otherwise
//                       (the stored window is drawn, dashed). "Learned" is
//                       the source's to say: what a band has while it has
//                       heard nothing is not an envelope and is not sent, for
//                       a drag that takes the windows over by hand seeds each
//                       window from what is sent here.
//       pos[4]          where each level sits in its window, 0..1, AS THE
//                       MAPPER COMPUTED IT: the curve's input
//       outputs[4]      what each knob is being sent
//       db              optional [bottom, top] when this frame's levels are on
//                       another axis than caps().db (the phone app's)
//     pos and outputs are what make the cursor and the readout true. A frame
//     without them (one the source did not map itself) gets the editor's own
//     arithmetic: PFMap.position / PFMap.output on the frame's levels.

'use strict';

const A = window.PFAdapter;
const { clamp01, PRESETS, evalCurve, bakeLut } = PFMap;

// What the source says about itself. Read once the mapping is in (the panel
// learns its frequency range from the same reply), so nothing above init()
// may use it at load.
let CAPS = null;
let DECADES = 1;
let TICKS = [];

function readCaps() {
  const c = A.caps();
  CAPS = {
    hzMin: c.hzMin, hzMax: c.hzMax,
    db: c.db || null,
    levelMax: c.levelMax || 1,
    hzGap: c.hzGap || 0,
    top: c.top || ((lo) => lo + PFMap.MIN_WINDOW),
    bottom: c.bottom || ((hi) => hi - PFMap.MIN_WINDOW)
  };
  DECADES = Math.log10(CAPS.hzMax / CAPS.hzMin);
  // Inner gridlines only — the endpoints are drawn from CAPS, so the same
  // axis code serves the extension's 20–20k and the microphone's 31–8k.
  TICKS = [[50, '50'], [100, '100'], [200, '200'], [500, '500'],
    [1000, '1k'], [2000, '2k'], [5000, '5k'], [10000, '10k']]
    .filter(([hz]) => hz > CAPS.hzMin * 1.15 && hz < CAPS.hzMax * 0.87);
}

const clampHz = (v) => Math.max(CAPS.hzMin, Math.min(CAPS.hzMax, Number(v) || CAPS.hzMin));

// What the editor DRAWS: the curve itself where there is one (a table would
// round a step's corner), the model's answer otherwise.
function bandCurveValue(band, u) {
  return band.curve ? evalCurve(band.curve, u) : PFMap.curveValue(band, u);
}

// ── state ───────────────────────────────────────────────────────────────

// The mapping being edited (null until init() has it), and the knob selected.
let cfg = null;
let sel = 0;
let frame = {};
let saveTimer = 0;

// Every edit saves itself, 150 ms after the last one of a burst.
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 150);
}

// Save now what is waiting to be saved. Also on the way out of the page, so
// an edit made in the last 150 ms is not left behind.
function flush() {
  if (!saveTimer) return null;
  clearTimeout(saveTimer);
  saveTimer = 0;
  return A.saveConfig(cfg);
}
window.addEventListener('pagehide', flush);

// The source's copy replaces the editor's: after a reset. Not saved back.
function applyConfig(raw) {
  cfg = PFMap.normalizeConfig(raw, CAPS);
  syncAutoToggle();
  syncDamping();
  selectBand(sel);
}

function touchCurve(band, curve) {
  band.curve = curve;
  band.lut = bakeLut(curve);
}

// ── main plot geometry ──────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
const plotCanvas = $('plot');
const pctx = plotCanvas.getContext('2d');
const M = { l: 48, r: 6, t: 26, b: 40 };
// The plot area inside those margins, css px.
let PW = 0, PH = 0;

// A finger, not a mouse: what it has to land on is made larger, here and in
// the stylesheet. EDGE is how far from a box's edge still grabs it, GRIP the
// square drawn on a corner or a curve handle, REACH how far from a curve
// handle still grabs that.
const COARSE = matchMedia('(pointer: coarse)').matches;
const EDGE = COARSE ? 18 : 7;
const GRIP = COARSE ? 11 : 7;
const REACH = COARSE ? 22 : 12;

// What the toolbar says beside the Auto range switch, in each of its two
// states (syncAutoToggle). The first, as a mouse has it, is also written in
// editor.html in the hint's own place: unseen until the mapping is in, and
// there so that its lines are already taken and the plot under it does not
// move when the words arrive.
const HINT_AUTO = 'Each box follows the loudness of what it hears. '
  + (COARSE ? 'Switch Auto range off to set a height by hand.' : 'Drag a top or bottom edge to take all four over by hand.');
const HINT_HAND = 'Width: the frequencies a knob listens to. Height: the quiet-to-loud range mapped onto it.';

// The plot's box is the stylesheet's (#plot in editor.css: as wide as the
// page, 45% of the window tall between 240 and 400 px, 260 at the most at the
// phone width), so it has its size before this file has run and nothing below
// it moves when the mapping arrives. That is the one rule for its height
// (Preview's scope is the same box). Here the height is only snapped to a
// whole pixel, so the canvas is not resampled, and the pixels are made.
function sizePlot() {
  plotCanvas.style.height = '';
  const cssW = plotCanvas.clientWidth, cssH = plotCanvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  plotCanvas.width = Math.round(cssW * dpr);
  plotCanvas.height = Math.round(cssH * dpr);
  plotCanvas.style.height = cssH + 'px';
  pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  PW = cssW - M.l - M.r;
  PH = cssH - M.t - M.b;
}

const xOf = (hz) => M.l + PW * (Math.log10(clampHz(hz) / CAPS.hzMin) / DECADES);
const hzOf = (x) => clampHz(CAPS.hzMin * Math.pow(10, DECADES * ((x - M.l) / PW)));
const yOf = (v) => M.t + (1 - clamp01(v)) * PH;
const vOf = (y) => clamp01(1 - (y - M.t) / PH);

// The level axis is the source's own dB: [bottom, top], or null when it gave
// none. The frame may be on another axis than the source's usual one (see the
// contract). Every level the editor prints goes through these, so the axis,
// the knob's heading and the curve's labels are in one unit.
const axisDb = () => frame.db || CAPS.db;
const minus = (n) => String(Math.round(n)).replace('-', '−');

// A height on the level axis, 0..1, as dB: '−43'. '' on an axis without dB.
function dbText(v) {
  const db = axisDb();
  return db ? minus(db[0] + v * (db[1] - db[0])) : '';
}

// A line every 10 dB: [[v, label]].
function dbLines() {
  const db = axisDb();
  const lines = [];
  if (!db) return lines;
  for (let d = Math.ceil(db[0] / 10) * 10; d <= db[1]; d += 10) {
    lines.push([(d - db[0]) / (db[1] - db[0]), minus(d)]);
  }
  return lines;
}

// Canvas colors come from the page's CSS variables, read fresh each paint so
// a theme toggle repaints correctly. The extension page is the cream
// instrument; the panel's console wraps the same module in its own tokens.
// Three of them are also painted see-through, which takes the colour apart:
// --led, --rule and --ink have to be written #rrggbb on every surface.
function theme() {
  const s = getComputedStyle(document.body);
  const v = (name) => s.getPropertyValue(name).trim();
  const alpha = (name) => {
    const n = parseInt(v(name).slice(1), 16);
    return (a) => `rgba(${n >> 16}, ${n >> 8 & 255}, ${n & 255}, ${a})`;
  };
  return {
    field: v('--field'),
    cream: v('--cream'),
    ink: v('--ink'),
    muted: v('--muted'),
    faint: v('--faint'),
    rule: v('--rule'),
    led: v('--led'),
    ledA: alpha('--led'),
    ruleA: alpha('--rule'),
    inkA: alpha('--ink')
  };
}

// The envelope auto range is mapping band `index` through right now, or null:
// auto range is off, the source has not learned one, or what it sent has no
// height (a panel that has never heard anything).
function liveEnv(index) {
  const env = cfg.autoRange && frame.env && frame.env[index];
  return env && env.hi > env.lo ? { lo: clamp01(env.lo), hi: clamp01(env.hi) } : null;
}

// The window a band is drawn with: the breathing envelope while auto range
// has one, the band's own hand-set window otherwise. Auto range without an
// envelope yet shows the stored window (dashed), never a made-up one.
function bandWindow(index) {
  const band = cfg.bands[index];
  return liveEnv(index) || { lo: band.inMin, hi: band.inMax };
}

// Is anything being heard? Without levels there is no line and no cursor.
const hearing = () => !!(frame.levels && frame.levels.length);

// Where band `index`'s level sits in its window, 0..1: the mapper's own
// figure when the frame carries it, the model's arithmetic when it does not.
function bandPos(index) {
  if (frame.pos && frame.pos.length) return clamp01(frame.pos[index]);
  return PFMap.position(frame.levels[index] || 0, cfg.bands[index], liveEnv(index));
}

// A window the source would store as it is: the top no higher than it keeps
// one, the two edges no closer than it keeps them.
function fitWindow(band) {
  band.inMin = Math.max(0, Math.min(band.inMin, CAPS.bottom(CAPS.levelMax)));
  band.inMax = Math.min(CAPS.levelMax, Math.max(band.inMax, CAPS.top(band.inMin)));
}

function formatHz(hz) {
  return hz >= 1000 ? (hz / 1000).toFixed(hz >= 9950 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(Math.round(hz));
}

// ── main plot drawing ───────────────────────────────────────────────────

// Everything written on a canvas: 11 px, in --muted. (10 px in --faint, as it
// was, is 2.3:1 on the extension's cream; the axis and the one number that
// says what the knob gets were the least legible text on the page.)
const MONO = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function drawPlot() {
  const T = theme();
  const W = M.l + PW + M.r, H = M.t + PH + M.b;
  pctx.clearRect(0, 0, W, H);
  pctx.fillStyle = T.field;
  pctx.fillRect(0, 0, W, H);

  // grid
  pctx.font = MONO;
  pctx.strokeStyle = T.ruleA(0.55);
  pctx.fillStyle = T.muted;
  pctx.lineWidth = 1;
  for (const [v, label] of dbLines()) {
    const y = Math.round(yOf(v)) + 0.5;
    if (v > 0 && v < 1) {
      pctx.beginPath(); pctx.moveTo(M.l, y); pctx.lineTo(M.l + PW, y); pctx.stroke();
    }
    pctx.textAlign = 'right';
    pctx.fillText(label, M.l - 8, y + 3);
  }
  // The two units, once each, in the margin the level labels are in: dB heads
  // their column, Hz starts the row of frequencies.
  pctx.textAlign = 'right';
  if (axisDb()) pctx.fillText('dB', M.l - 8, M.t - 9);
  pctx.fillText('Hz', M.l - 8, M.t + PH + 16);
  pctx.textAlign = 'center';
  for (const [hz, label] of TICKS) {
    const x = Math.round(xOf(hz)) + 0.5;
    pctx.beginPath(); pctx.moveTo(x, M.t); pctx.lineTo(x, M.t + PH); pctx.stroke();
    pctx.fillText(label, x, M.t + PH + 16);
  }
  pctx.textAlign = 'left';
  pctx.fillText(formatHz(CAPS.hzMin), M.l, M.t + PH + 16);
  pctx.textAlign = 'right';
  pctx.fillText(formatHz(CAPS.hzMax), M.l + PW, M.t + PH + 16);
  pctx.strokeStyle = T.rule;
  pctx.beginPath(); pctx.moveTo(M.l, M.t + PH + 0.5); pctx.lineTo(M.l + PW, M.t + PH + 0.5); pctx.stroke();

  // spectrum staircase
  const spec = frame.spectrum || [];
  if (spec.length > 1) {
    pctx.fillStyle = T.inkA(0.14);
    pctx.beginPath();
    pctx.moveTo(M.l, yOf(spec[0]));
    const bw = PW / spec.length;
    for (let i = 0; i < spec.length; i++) {
      const y = yOf(spec[i]);
      pctx.lineTo(M.l + i * bw, y);
      pctx.lineTo(M.l + (i + 1) * bw, y);
    }
    pctx.lineTo(M.l + PW, M.t + PH);
    pctx.lineTo(M.l, M.t + PH);
    pctx.closePath();
    pctx.fill();
  }

  // boxes
  cfg.bands.forEach((band, i) => {
    const win = bandWindow(i);
    const x0 = xOf(band.hzMin), x1 = xOf(band.hzMax);
    const yTop = yOf(win.hi), yBot = yOf(win.lo);
    const isSel = i === sel;
    const stroke = isSel ? T.led : (band.muted ? T.faint : T.ink);
    const alpha = band.muted ? 0.04 : (isSel ? 0.12 : 0.07);

    pctx.fillStyle = T.ledA(alpha);
    pctx.fillRect(x0, yTop, x1 - x0, yBot - yTop);

    pctx.strokeStyle = stroke;
    pctx.lineWidth = isSel ? 1.5 : 1;
    pctx.beginPath(); pctx.moveTo(x0, yTop); pctx.lineTo(x0, yBot); pctx.stroke();
    pctx.beginPath(); pctx.moveTo(x1, yTop); pctx.lineTo(x1, yBot); pctx.stroke();
    if (cfg.autoRange) pctx.setLineDash([5, 4]);
    pctx.beginPath(); pctx.moveTo(x0, yTop); pctx.lineTo(x1, yTop); pctx.stroke();
    pctx.beginPath(); pctx.moveTo(x0, yBot); pctx.lineTo(x1, yBot); pctx.stroke();
    pctx.setLineDash([]);

    // The live level, as a line across the box: how far through its window
    // the band is, which is what the curve is fed and so what the knob gets.
    // It is the mapper's position and not the level's height on the axis: the
    // two differ wherever the mapper is not linear in this axis (the panel
    // maps linear amplitude on a dB axis, and auto range squelches the floor),
    // and a line drawn at the height says "fires" where the knob does not.
    // Resting, it sits on the bottom edge; at full scale, on the top.
    if (hearing()) {
      const ly = Math.max(yTop + 1.5, Math.min(yBot - 1.5, yBot - bandPos(i) * (yBot - yTop)));
      pctx.strokeStyle = T.led;
      pctx.lineWidth = 2;
      pctx.beginPath();
      pctx.moveTo(x0 + 1, ly);
      pctx.lineTo(x1 - 1, ly);
      pctx.stroke();
    }

    if (isSel) {
      pctx.fillStyle = T.field;
      pctx.strokeStyle = T.ink;
      pctx.lineWidth = 1;
      for (const [cx, cy] of [[x0, yTop], [x1, yTop], [x0, yBot], [x1, yBot]]) {
        pctx.fillRect(cx - GRIP / 2, cy - GRIP / 2, GRIP, GRIP);
        pctx.strokeRect(cx - GRIP / 2, cy - GRIP / 2, GRIP, GRIP);
      }
    }
  });

  placeTags();
}

// Band N drives knob N, and is named after it everywhere: K1..K4. A tag sits
// ON its box's top edge, outside the box: auto range can make a box thinner
// than the tag, which would otherwise cover it and its level line. It starts
// at the box's left edge, and stops at the plot's right one: on a phone the
// highest knob's box is narrower than its tag, which was cut off there.
function placeTags() {
  const T = theme();
  cfg.bands.forEach((band, i) => {
    const tag = $('tag' + i);
    const win = bandWindow(i);
    tag.classList.toggle('sel', i === sel);
    tag.classList.toggle('mutedTag', band.muted);
    tag.querySelector('.tagText').textContent = 'K' + (i + 1) + (band.muted ? ' muted' : '');
    drawGlyph(tag.querySelector('canvas'), band, 18, 12, T.ink);
    tag.style.left = Math.round(Math.min(xOf(band.hzMin), M.l + PW + M.r - tag.offsetWidth - 1)) + 'px';
    tag.style.top = Math.round(yOf(win.hi) - 21) + 'px';
  });
}

// The tiny curve glyph on tags, tabs and shapes. Its box (w x h css px) is the
// stylesheet's, so a glyph that is not drawn yet already has its size; here
// only the pixels are made.
function drawGlyph(canvas, band, w, h, color) {
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== w * dpr) {
    canvas.width = w * dpr; canvas.height = h * dpr;
  }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  g.strokeStyle = color;
  g.lineWidth = 1.4;
  g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    const v = bandCurveValue(band, u);
    const x = 2 + u * (w - 4);
    const y = h - 2 - v * (h - 4);
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
}

// ── main plot interaction ───────────────────────────────────────────────

let drag = null;

function hitTest(x, y) {
  // Selected band's edges win first — reaching for a handle should not
  // reselect the neighbour underneath it.
  const order = [sel, ...cfg.bands.map((_, i) => i).filter((i) => i !== sel)];
  for (const i of order) {
    const band = cfg.bands[i];
    const win = bandWindow(i);
    const x0 = xOf(band.hzMin), x1 = xOf(band.hzMax);
    const yTop = yOf(win.hi), yBot = yOf(win.lo);
    const insideX = x > x0 - EDGE && x < x1 + EDGE;
    const insideY = y > yTop - EDGE && y < yBot + EDGE;
    if (!insideX || !insideY) continue;
    // An edge is grabbed from EDGE px outside it, and from inside too, but
    // never from further in than a third of the box: the middle third of
    // even the smallest box stays "move", so a fat edge cannot swallow it.
    const inX = Math.min(EDGE, (x1 - x0) / 3), inY = Math.min(EDGE, (yBot - yTop) / 3);
    const nearL = x <= x0 + inX, nearR = x >= x1 - inX;
    // Under a finger, in auto range, a top or bottom edge is not a handle:
    // with a finger's EDGE those two zones are a quarter of the plot, and a
    // thumb that only meant to scroll the page took all four knobs over (see
    // takeOver). There the touch scrolls, or moves the box if it is inside it;
    // a height is set by hand after the Auto range switch is put off.
    const tall = !(COARSE && cfg.autoRange);
    const nearT = tall && y <= yTop + inY, nearB = tall && y >= yBot - inY;
    // Corners first — a grab there resizes both axes at once.
    if (nearL && nearT) return { band: i, mode: 'tl' };
    if (nearR && nearT) return { band: i, mode: 'tr' };
    if (nearL && nearB) return { band: i, mode: 'bl' };
    if (nearR && nearB) return { band: i, mode: 'br' };
    if (nearL) return { band: i, mode: 'l' };
    if (nearR) return { band: i, mode: 'r' };
    if (nearT) return { band: i, mode: 't' };
    if (nearB) return { band: i, mode: 'b' };
    if (x > x0 && x < x1 && y > yTop && y < yBot) return { band: i, mode: 'move' };
  }
  return null;
}

// Dragging a breathing edge is the gesture that says "I'll take it from
// here": auto range switches off, and every band's window is seeded from the
// envelope it was just breathing at, so nothing jumps. A band with no live
// envelope keeps the window it had (and a source sends none for a band that
// has learned nothing: seeded from silence, a window is a sliver at the floor
// that any sound pegs at its top). This is the ONLY thing that writes an
// envelope into a window: the Auto range switch itself just goes back to the
// hand-set windows, so trying auto costs nothing. With a mouse only: see
// hitTest.
function takeOver() {
  cfg.bands.forEach((band, i) => {
    const env = liveEnv(i);
    if (!env) return;
    band.inMin = env.lo;
    band.inMax = env.hi;
    fitWindow(band);
  });
  cfg.autoRange = false;
  syncAutoToggle();
}

function plotPointer(event) {
  const rect = plotCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

// A FINGER ON A CANVAS. One that lands on something draggable is a drag, and
// the page must not scroll under it; one that misses is the browser's, so the
// page still scrolls from anywhere else on the plot. That cannot be said with
// touch-action, which is per element and not per touch (`none` made the plot
// a trap no swipe got out of; `pan-y` would give the browser the vertical
// drag of a top or bottom edge, and it takes it with a pointercancel that
// preventDefault on pointerdown does not stop). What does decide it per touch
// is a touchstart listener that is not passive: prevented, that touch never
// scrolls and its pointer events run to the end. `hits(x, y)` says whether
// the point, in the canvas's own px, is on something.
function dragOnHit(canvas, hits) {
  canvas.addEventListener('touchstart', (event) => {
    const rect = canvas.getBoundingClientRect();
    const touch = event.changedTouches[0];
    if (hits(touch.clientX - rect.left, touch.clientY - rect.top)) event.preventDefault();
  }, { passive: false });
}
dragOnHit(plotCanvas, hitTest);

plotCanvas.addEventListener('pointerdown', (event) => {
  const { x, y } = plotPointer(event);
  const hit = hitTest(x, y);
  if (!hit) return;
  if (hit.band !== sel) selectBand(hit.band);
  // Armed, not moving: a press selects. Nothing is moved, resized or taken
  // over until the pointer has travelled SLOP px, so a tap (or the jitter of
  // one) changes nothing.
  drag = { ...hit, startX: x, startY: y, live: false };
  plotCanvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});

const SLOP = 4;

plotCanvas.addEventListener('pointermove', (event) => {
  const { x, y } = plotPointer(event);
  if (!drag) {
    const hit = hitTest(x, y);
    plotCanvas.style.cursor = !hit ? 'default'
      : hit.mode === 'move' ? 'move'
      : (hit.mode === 'tl' || hit.mode === 'br') ? 'nwse-resize'
      : (hit.mode === 'tr' || hit.mode === 'bl') ? 'nesw-resize'
      : (hit.mode === 'l' || hit.mode === 'r') ? 'ew-resize' : 'ns-resize';
    return;
  }
  const band = cfg.bands[drag.band];
  if (!drag.live) {
    if (Math.hypot(x - drag.startX, y - drag.startY) < SLOP) return;
    // A top or bottom edge of a box in auto range (or a corner, which is one
    // too): this drag takes over. ('move' has neither letter in it.)
    if (cfg.autoRange && /[tb]/.test(drag.mode)) takeOver();
    const win = bandWindow(drag.band);
    Object.assign(drag, { live: true, hzMin: band.hzMin, hzMax: band.hzMax, lo: win.lo, hi: win.hi });
  }
  // The narrowest box, as a frequency ratio.
  const MINR = 1.12;

  if (drag.mode === 'move') {
    // Translate in log-frequency: the box keeps its RATIO width, which is
    // what a log axis means by "same size somewhere else".
    const shift = (x - drag.startX) / PW * DECADES;
    let ratio = Math.pow(10, shift);
    ratio = Math.max(CAPS.hzMin / drag.hzMin, Math.min(CAPS.hzMax / drag.hzMax, ratio));
    band.hzMin = drag.hzMin * ratio;
    band.hzMax = Math.max(drag.hzMax * ratio, band.hzMin + CAPS.hzGap);
    if (!cfg.autoRange) {
      const dv = vOf(y) - vOf(drag.startY);
      const span = drag.hi - drag.lo;
      band.inMin = Math.max(0, Math.min(CAPS.levelMax - span, drag.lo + dv));
      band.inMax = band.inMin + span;
      fitWindow(band);
    }
  } else {
    // Edges and corners share the same four moves; a corner just does two.
    // Each edge stops where the source would stop it, so what is drawn is
    // what is stored and nothing moves on the next load.
    if (drag.mode.includes('l')) band.hzMin = Math.max(CAPS.hzMin, Math.min(hzOf(x), band.hzMax / MINR, band.hzMax - CAPS.hzGap));
    if (drag.mode.includes('r')) band.hzMax = Math.min(CAPS.hzMax, Math.max(hzOf(x), band.hzMin * MINR, band.hzMin + CAPS.hzGap));
    if (drag.mode.includes('t')) band.inMax = Math.min(CAPS.levelMax, Math.max(vOf(y), CAPS.top(band.inMin)));
    if (drag.mode.includes('b')) band.inMin = Math.max(0, Math.min(vOf(y), CAPS.bottom(band.inMax)));
  }
  drawPlot();
  drawCurve();
  renderChips();
  renderSettings();
});

const releasePlot = () => {
  if (!drag) return;
  const moved = drag.live;
  drag = null;
  if (moved) persist();
};
plotCanvas.addEventListener('pointerup', releasePlot);
plotCanvas.addEventListener('pointercancel', releasePlot);

// ── curve panel ─────────────────────────────────────────────────────────

const curveCanvas = $('curve');
const cctx = curveCanvas.getContext('2d');
const CM = { l: 34, r: 10, t: 12, b: 26 };
let CW = 0, CH = 0;
let curveDrag = null;

// The curve's box is the stylesheet's too (#curve: 356 px wide where there is
// room, the width of its row where there is not, 218 tall). The pointer maths
// below go by CW and CH, so any size works.
function sizeCurve() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = curveCanvas.clientWidth, cssH = 218;
  curveCanvas.width = cssW * dpr; curveCanvas.height = cssH * dpr;
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  CW = cssW - CM.l - CM.r; CH = cssH - CM.t - CM.b;
}

const cxOf = (u) => CM.l + clamp01(u) * CW;
const cyOf = (v) => CM.t + (1 - clamp01(v)) * CH;

function drawCurve() {
  const T = theme();
  const band = cfg.bands[sel];
  const W = CM.l + CW + CM.r, H = CM.t + CH + CM.b;
  cctx.clearRect(0, 0, W, H);

  cctx.fillStyle = T.cream;
  cctx.fillRect(CM.l, CM.t, CW, CH);
  cctx.strokeStyle = T.rule;
  cctx.lineWidth = 1;
  cctx.strokeRect(CM.l + 0.5, CM.t + 0.5, CW - 1, CH - 1);
  cctx.strokeStyle = T.ruleA(0.5);
  cctx.beginPath(); cctx.moveTo(cxOf(0.5), CM.t); cctx.lineTo(cxOf(0.5), CM.t + CH); cctx.stroke();
  cctx.beginPath(); cctx.moveTo(CM.l, cyOf(0.5)); cctx.lineTo(CM.l + CW, cyOf(0.5)); cctx.stroke();

  // curve
  cctx.strokeStyle = T.ink;
  cctx.lineWidth = 2;
  cctx.lineCap = 'round';
  cctx.beginPath();
  const steps = band.curve && band.curve.type === 'steps';
  const N = steps ? 200 : 64;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const v = bandCurveValue(band, u);
    const x = cxOf(u), y = cyOf(v);
    if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
  }
  cctx.stroke();

  // bezier handles
  if (band.curve && band.curve.type === 'bezier') {
    const c = band.curve;
    cctx.strokeStyle = T.faint;
    cctx.setLineDash([2, 3]);
    cctx.beginPath(); cctx.moveTo(cxOf(0), cyOf(c.y0)); cctx.lineTo(cxOf(c.p1x), cyOf(c.p1y)); cctx.stroke();
    cctx.beginPath(); cctx.moveTo(cxOf(1), cyOf(c.y1)); cctx.lineTo(cxOf(c.p2x), cyOf(c.p2y)); cctx.stroke();
    cctx.setLineDash([]);
    cctx.fillStyle = T.led;
    cctx.strokeStyle = T.ink;
    cctx.lineWidth = 1;
    for (const [hx, hy] of [[c.p1x, c.p1y], [c.p2x, c.p2y]]) {
      cctx.fillRect(cxOf(hx) - GRIP / 2, cyOf(hy) - GRIP / 2, GRIP, GRIP);
      cctx.strokeRect(cxOf(hx) - GRIP / 2, cyOf(hy) - GRIP / 2, GRIP, GRIP);
    }
  }

  // live cursor: where the music is on this curve right now, and (top
  // left) what that is: the level heard, in the axis's dB, -> the knob's
  // value. The position and the value are the mapper's own figures when the
  // frame has them.
  const win = bandWindow(sel);
  if (hearing()) {
    const u = bandPos(sel);
    const v = bandCurveValue(band, u);
    cctx.strokeStyle = T.led;
    cctx.setLineDash([3, 3]);
    cctx.lineWidth = 1;
    cctx.beginPath(); cctx.moveTo(cxOf(u), CM.t + CH); cctx.lineTo(cxOf(u), cyOf(v)); cctx.stroke();
    cctx.setLineDash([]);
    cctx.fillStyle = T.led;
    cctx.beginPath(); cctx.arc(cxOf(u), cyOf(v), 4.5, 0, Math.PI * 2); cctx.fill();
    const out = frame.outputs && frame.outputs.length ? frame.outputs[sel] : PFMap.output(band, u);
    const heard = dbText(frame.levels[sel] || 0);
    cctx.font = MONO;
    cctx.fillStyle = T.muted;
    cctx.textAlign = 'left';
    cctx.fillText((heard && heard + ' dB ') + '→ ' + Number(out).toFixed(2), CM.l + 6, CM.t + 12);
  }

  // labels: along the bottom the window this curve is spread over, quiet end
  // to loud end, in the plot's dB (auto range keeps moving it, so it gets the
  // word); up the side the two ends of the output range.
  const lo = dbText(win.lo);
  cctx.font = MONO;
  cctx.fillStyle = T.muted;
  cctx.textAlign = 'left';
  cctx.fillText(cfg.autoRange ? 'auto range' : lo, CM.l, CM.t + CH + 16);
  cctx.textAlign = 'right';
  cctx.fillText(cfg.autoRange || !lo ? '' : dbText(win.hi) + ' dB', CM.l + CW, CM.t + CH + 16);
  cctx.fillText(band.outMax.toFixed(2), CM.l - 6, CM.t + 8);
  cctx.fillText(band.outMin.toFixed(2), CM.l - 6, CM.t + CH);
}

// Which handle of the selected knob's curve is at this point: 'p1', 'p2', or
// nothing (only a bezier has handles).
function curveHit(x, y) {
  const c = cfg.bands[sel].curve;
  if (!c || c.type !== 'bezier') return null;
  const near = (hx, hy) => Math.hypot(x - cxOf(hx), y - cyOf(hy)) < REACH;
  return near(c.p1x, c.p1y) ? 'p1' : near(c.p2x, c.p2y) ? 'p2' : null;
}
dragOnHit(curveCanvas, curveHit);

curveCanvas.addEventListener('pointerdown', (event) => {
  const rect = curveCanvas.getBoundingClientRect();
  curveDrag = curveHit(event.clientX - rect.left, event.clientY - rect.top);
  if (!curveDrag) return;
  curveCanvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});

curveCanvas.addEventListener('pointermove', (event) => {
  if (!curveDrag) return;
  const rect = curveCanvas.getBoundingClientRect();
  const u = clamp01((event.clientX - rect.left - CM.l) / CW);
  const v = clamp01(1 - (event.clientY - rect.top - CM.t) / CH);
  const band = cfg.bands[sel];
  const c = band.curve;
  if (curveDrag === 'p1') { c.p1x = u; c.p1y = v; }
  else { c.p2x = u; c.p2y = v; }
  c.id = 'custom';
  band.lut = bakeLut(c);
  drawCurve();
  renderPresetChips();
  placeTags();
});

const releaseCurve = () => {
  if (!curveDrag) return;
  curveDrag = null;
  persist();
  renderChips();
};
curveCanvas.addEventListener('pointerup', releaseCurve);
curveCanvas.addEventListener('pointercancel', releaseCurve);

// ── presets, steps, settings column ─────────────────────────────────────

function renderPresetChips() {
  const band = cfg.bands[sel];
  const id = band.curve ? (band.curve.id || 'custom') : null;
  document.querySelectorAll('.preset').forEach((el) => {
    el.classList.toggle('on', el.dataset.p === id);
    el.setAttribute('aria-pressed', el.dataset.p === id);
  });
  // One line under the shapes, and only when it is true: a knob that has no
  // shape is on the source's default response (nothing to fix, so nothing is
  // asked), and only a bezier has handles to drag.
  $('curveHint').textContent = !band.curve ? 'This knob uses the default response.'
    : band.curve.type === 'bezier' ? 'Drag the two handles for a custom shape.' : '';
  $('stepsRow').hidden = !(band.curve && band.curve.type === 'steps');
  if (band.curve && band.curve.type === 'steps') $('stepsN').textContent = String(band.curve.n);
  document.querySelectorAll('.preset canvas').forEach((canvas) => {
    const preset = PRESETS[canvas.parentElement.dataset.p];
    drawGlyph(canvas, { curve: preset, gain: 1 }, 40, 24, theme().ink);
  });
}

document.querySelectorAll('.preset').forEach((el) => {
  el.addEventListener('click', () => {
    const preset = PRESETS[el.dataset.p];
    if (!preset) return;
    touchCurve(cfg.bands[sel], structuredClone(preset));
    drawCurve();
    renderPresetChips();
    placeTags();
    renderChips();
    persist();
  });
});

$('stepsMinus').addEventListener('click', () => stepsAdjust(-1));
$('stepsPlus').addEventListener('click', () => stepsAdjust(1));
function stepsAdjust(delta) {
  const band = cfg.bands[sel];
  if (!band.curve || band.curve.type !== 'steps') return;
  band.curve.n = Math.max(2, Math.min(8, band.curve.n + delta));
  band.curve.id = band.curve.n === 2 ? 'gate' : 'steps';
  band.lut = bakeLut(band.curve);
  drawCurve();
  renderPresetChips();
  placeTags();
  renderChips();
  persist();
}

// The selected knob's card: which knob, what it listens to (its frequencies,
// and its window in the plot's dB unless auto range is setting that), its
// output range and its mute. The knob's name is also on its Reset and in
// Preview's legend.
function renderSettings() {
  const band = cfg.bands[sel];
  const lo = dbText(band.inMin);
  $('bandName').textContent = 'Knob ' + (sel + 1);
  $('bandMeta').textContent = formatHz(band.hzMin) + ' – ' + formatHz(band.hzMax) + ' Hz'
    + (cfg.autoRange ? ' · auto range' : lo && ' · ' + lo + ' to ' + dbText(band.inMax) + ' dB');
  $('outLabel').textContent = band.outMin.toFixed(2) + ' – ' + band.outMax.toFixed(2);
  const w = $('outTrack').clientWidth - 10;
  $('outLo').style.left = (5 + band.outMin * w) + 'px';
  $('outHi').style.left = (5 + band.outMax * w) + 'px';
  $('outFill').style.left = (5 + band.outMin * w) + 'px';
  $('outFill').style.width = Math.max(0, (band.outMax - band.outMin) * w) + 'px';
  $('muteToggle').classList.toggle('on', band.muted);
  $('muteToggle').setAttribute('aria-pressed', band.muted);
  $('resetBand').textContent = 'Reset K' + (sel + 1);
  $('pvOut').textContent = 'K' + (sel + 1) + ' output';
}

document.querySelectorAll('.outPreset').forEach((el) => {
  el.addEventListener('click', () => {
    const band = cfg.bands[sel];
    band.outMin = Number(el.dataset.lo);
    band.outMax = Number(el.dataset.hi);
    renderSettings(); drawCurve(); renderChips(); persist();
  });
});

// The track is dragged sideways and lets the page scroll up and down
// (touch-action: pan-y). A touch that turns out to be a scroll ends in
// pointercancel after it has already moved the handle a little: that puts
// back what the press found and saves nothing.
let outDrag = null;
$('outTrack').addEventListener('pointerdown', (event) => {
  const band = cfg.bands[sel];
  const rect = $('outTrack').getBoundingClientRect();
  const v = clamp01((event.clientX - rect.left - 5) / (rect.width - 10));
  outDrag = { lo: Math.abs(v - band.outMin) < Math.abs(v - band.outMax), was: [band.outMin, band.outMax] };
  $('outTrack').setPointerCapture(event.pointerId);
  event.preventDefault();
});
$('outTrack').addEventListener('pointermove', (event) => {
  if (!outDrag) return;
  const band = cfg.bands[sel];
  const rect = $('outTrack').getBoundingClientRect();
  const v = clamp01((event.clientX - rect.left - 5) / (rect.width - 10));
  if (outDrag.lo) band.outMin = Math.min(v, band.outMax - PFMap.MIN_OUT);
  else band.outMax = Math.max(v, band.outMin + PFMap.MIN_OUT);
  renderSettings(); drawCurve();
});
$('outTrack').addEventListener('pointerup', () => {
  if (outDrag) { outDrag = null; persist(); }
});
$('outTrack').addEventListener('pointercancel', () => {
  if (!outDrag) return;
  [cfg.bands[sel].outMin, cfg.bands[sel].outMax] = outDrag.was;
  outDrag = null;
  renderSettings(); drawCurve();
});

$('muteToggle').addEventListener('click', () => {
  const band = cfg.bands[sel];
  band.muted = !band.muted;
  renderSettings(); renderChips(); drawPlot(); persist();
});

// Reset band asks the SOURCE for its default: the editor has no table of its
// own, so this and the source's own "reset everything" cannot disagree.
// Whatever is waiting to be saved goes first, so the reset is the last word.
$('resetBand').addEventListener('click', async () => {
  await flush();
  const next = await A.resetBand(sel, cfg);
  if (next) applyConfig(next);
});

// The source's own "reset everything", where it has one (see the contract):
// the button is in the page, hidden, and only such a source brings it out.
if (A.resetAll) {
  $('resetMap').hidden = false;
  $('resetMap').addEventListener('click', function () { A.resetAll(this); });
}

// ── the knobs, as tabs under the plot ───────────────────────────────────

function renderChips() {
  cfg.bands.forEach((band, i) => {
    const chip = $('chip' + i);
    chip.classList.toggle('sel', i === sel);
    chip.setAttribute('aria-pressed', i === sel);
    chip.classList.toggle('mutedChip', band.muted);
    chip.querySelector('.chipHz').textContent = formatHz(band.hzMin) + '–' + formatHz(band.hzMax);
    drawGlyph(chip.querySelector('canvas'), band, 18, 12, theme().muted);
  });
}

for (let i = 0; i < 4; i++) {
  $('chip' + i).addEventListener('click', () => selectBand(i));
}

function selectBand(index) {
  sel = Math.max(0, Math.min(3, index));
  drawPlot();
  drawCurve();
  renderPresetChips();
  renderSettings();
  renderChips();
}

// ── preview ─────────────────────────────────────────────────────────────
//
// Ableton-style: synthetic test signals through the SELECTED knob's whole
// chain - window, glide ballistics, curve, output range - drawn as a
// scrolling scope. What the knob will do, audible music not required.
//
// The scope takes the plot's place while it runs (#pv lies over it: a test
// signal needs no spectrum), so everything it demonstrates - attack and
// damping above it, the knobs, the curve and the output range below - stays
// live around it. The Preview button, right under it, closes it again; so
// does Escape.

const pv = $('pv');
const pvScope = $('pvScope');
const pvCtx = pvScope.getContext('2d');
// The scope's box, css px: whatever the layer gives it (see pvSize).
let pvW = 0, pvH = 0;
let pvSig = 'pulse';
let pvRaf = 0;
let pvTimer = 0;
let pvT = 0;
let pvLast = 0;
let pvLevel = 0;
const PV_SECONDS = 4;
const PV_STEP = 1 / 30;
let pvIn = [];
let pvOut = [];

function pvSignal(t) {
  if (pvSig === 'pulse') {
    // A kick every 0.8 s: one sharp burst, then near-silence. The tail the
    // output shows comes from the glide, which is the point of the demo.
    const phase = t % 0.8;
    const spike = phase < 0.06 ? 0.85 : 0;
    return clamp01(spike + 0.07 + (Math.random() - 0.5) * 0.03);
  }
  if (pvSig === 'noisy') {
    const spike = (t % 1.7) < 0.06 ? 0.5 : 0;
    return clamp01(0.30 + 0.10 * Math.sin(t * 1.3) + (Math.random() - 0.5) * 0.22 + spike);
  }
  // swell
  return clamp01(0.45 + 0.35 * Math.sin(t * Math.PI * 2 * 0.35) + (Math.random() - 0.5) * 0.04);
}

function pvChain(sig) {
  // Mirror the live pipeline: asymmetric glide on the LEVEL, then window,
  // curve, output range.
  // (Both alphas are already inside 0.05..0.9: the model holds them there on
  // load and the two sliders cannot leave it.)
  const a = pvLevel < sig ? cfg.attack : cfg.smoothing;
  pvLevel += (sig - pvLevel) * a;
  const band = cfg.bands[sel];
  // The model's own two functions. In auto range the test signal is taken
  // as already sitting in its envelope.
  return PFMap.output(band, PFMap.position(pvLevel, band, cfg.autoRange ? { lo: 0, hi: 1 } : null));
}

function pvDraw() {
  const T = theme();
  const w = pvW, h = pvH;
  pvCtx.clearRect(0, 0, w, h);
  pvCtx.strokeStyle = T.ruleA(0.5);
  pvCtx.lineWidth = 1;
  for (const v of [0.25, 0.5, 0.75]) {
    const y = Math.round(h - v * h) + 0.5;
    pvCtx.beginPath(); pvCtx.moveTo(0, y); pvCtx.lineTo(w, y); pvCtx.stroke();
  }
  const trace = (arr, color, width) => {
    pvCtx.strokeStyle = color;
    pvCtx.lineWidth = width;
    pvCtx.beginPath();
    for (let i = 0; i < arr.length; i++) {
      const x = (i / (PV_SECONDS / PV_STEP)) * w;
      const y = h - clamp01(arr[i]) * h;
      if (i === 0) pvCtx.moveTo(x, y); else pvCtx.lineTo(x, y);
    }
    pvCtx.stroke();
  };
  trace(pvIn, T.faint, 1.2);
  trace(pvOut, T.led, 2);
}

function pvTick(now) {
  if (pv.hidden) return;
  if (!pvLast) pvLast = now;
  // Wall-clock scheduling, not per-frame increments: a throttled tab still
  // simulates the RIGHT amount of time when frames do arrive (capped per
  // frame so a background stint cannot demand thousands of steps at once).
  const target = pvT + (now - pvLast) / 1000;
  pvLast = now;
  let budget = 60;
  while (pvT < target && budget-- > 0) {
    pvT += PV_STEP;
    const sig = pvSignal(pvT);
    pvIn.push(sig);
    pvOut.push(pvChain(sig));
    const cap = PV_SECONDS / PV_STEP;
    if (pvIn.length > cap) { pvIn.shift(); pvOut.shift(); }
  }
  if (budget < 0) pvT = target;
  pvDraw();
  pvSchedule();
}

// rAF when the surface is live, a timer backstop when it is throttled or
// hidden - the preview keeps moving either way.
function pvSchedule() {
  pvRaf = requestAnimationFrame(pvTick);
  clearTimeout(pvTimer);
  pvTimer = setTimeout(() => {
    cancelAnimationFrame(pvRaf);
    pvTick(performance.now());
  }, 300);
}

// The scope draws into the box the stylesheet gives it: what is left of the
// plot's box under the row of test signals. No size of its own.
function pvSize() {
  const dpr = window.devicePixelRatio || 1;
  pvW = pvScope.clientWidth; pvH = pvScope.clientHeight;
  pvScope.width = pvW * dpr; pvScope.height = pvH * dpr;
  pvCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// On, off: the one switch. The button says which it is (aria-pressed).
function pvSet(on) {
  pv.hidden = !on;
  $('openPreview').setAttribute('aria-pressed', on);
  cancelAnimationFrame(pvRaf);
  clearTimeout(pvTimer);
  if (!on) return;
  pvSize();
  pvIn = []; pvOut = []; pvT = 0; pvLast = 0; pvLevel = 0;
  pvSchedule();
}

$('openPreview').addEventListener('click', () => pvSet(pv.hidden));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !pv.hidden) pvSet(false);
});
document.querySelectorAll('.pvSig').forEach((el) => {
  el.addEventListener('click', () => {
    pvSig = el.dataset.s;
    document.querySelectorAll('.pvSig').forEach((x) => x.classList.toggle('on', x === el));
  });
});

// ── auto toggle, status, wiring ─────────────────────────────────────────

// The switch, and beside it the one thing to know about the boxes in the mode
// it is in.
function syncAutoToggle() {
  $('autoToggle').classList.toggle('on', cfg.autoRange);
  $('autoToggle').setAttribute('aria-pressed', cfg.autoRange);
  $('autoHint').textContent = cfg.autoRange ? HINT_AUTO : HINT_HAND;
}

// The switch only switches: off goes back to the windows set by hand, which
// auto range never touched. (Dragging an edge is what keeps an envelope.)
$('autoToggle').addEventListener('click', () => {
  cfg.autoRange = !cfg.autoRange;
  syncAutoToggle();
  drawPlot(); drawCurve(); renderSettings();
  persist();
});

// Damping = the level smoothing the analysis already runs (an EMA on each
// band, before the window and curve). Right means calmer: the slider's 0..1
// maps to alpha 0.9..0.05, so a gentle word scale replaces a number nobody
// would know the direction of. It smooths the INPUT level, not the output —
// gate and steps curves stay crisp, their trigger just stops flickering.
const DAMP_WORDS = [[0.25, 'tight'], [0.5, 'balanced'], [0.75, 'smooth'], [1.01, 'glassy']];
const ATK_WORDS = [[0.25, 'snap'], [0.5, 'quick'], [0.75, 'soft'], [1.01, 'lazy']];

const dampWord = (v) => DAMP_WORDS.find(([top]) => v < top)[1];

function syncDamping() {
  const v = clamp01((0.9 - cfg.smoothing) / 0.85);
  $('damping').value = v;
  $('dampingWord').textContent = dampWord(v);
  const k = clamp01((0.9 - cfg.attack) / 0.85);
  $('attack').value = k;
  $('attackWord').textContent = ATK_WORDS.find(([top]) => k < top)[1];
}

$('attack').addEventListener('input', () => {
  const v = clamp01($('attack').value);
  cfg.attack = 0.9 - v * 0.85;
  $('attackWord').textContent = ATK_WORDS.find(([top]) => v < top)[1];
  persist();
});

$('damping').addEventListener('input', () => {
  const v = clamp01($('damping').value);
  cfg.smoothing = 0.9 - v * 0.85;
  $('dampingWord').textContent = dampWord(v);
  persist();
});

// Everything drawn is sized from the page, so a window made narrower (half a
// screen beside the music, a phone turned round) is measured again.
window.addEventListener('resize', () => {
  if (!cfg) return;
  sizePlot();
  sizeCurve();
  if (!pv.hidden) pvSize();
  drawPlot();
  drawCurve();
  renderSettings();
});

// An in-page "are you sure": the first press arms the button and makes it ask,
// a second press within four seconds answers yes. A second press that comes
// within half a second of the first is the same double click or double tap,
// not an answer to a question nobody has had time to read: it is ignored, and
// the button stays armed. window.confirm is not used anywhere on these pages:
// the phone app shows /audio-in in a WebView that has none (it answers "no"
// without showing anything). Use:
//   if (!PFConfirm(button, 'Reset everything? Press again')) return;
window.PFConfirm = function (button, ask) {
  if (button._armed) {
    if (Date.now() - button._at < 500) return false;
    clearTimeout(button._armed);
    button._armed = 0;
    button.textContent = button._label;
    return true;
  }
  button._label = button.textContent;
  button.textContent = ask;
  button._at = Date.now();
  button._armed = setTimeout(() => {
    button._armed = 0;
    button.textContent = button._label;
  }, 4000);
  return false;
};

(async function init() {
  const stored = await A.loadConfig();
  readCaps();
  cfg = PFMap.normalizeConfig(stored, CAPS);
  sizePlot();
  sizeCurve();
  syncAutoToggle();
  syncDamping();
  selectBand(0);
  // The attribute, not the property: a browser too old to know `inert` would
  // keep the attribute, and with it what the stylesheet hides before the
  // first mapping.
  $('ed').removeAttribute('inert');
  if (A.onConfig) A.onConfig(applyConfig);
  A.onFrame((state) => {
    const was = String(axisDb());
    frame = state || {};
    // A frame on another level axis (`db` in the contract) changes the dB the
    // card prints, not only the plot's labels.
    if (String(axisDb()) !== was) renderSettings();
    drawPlot();
    drawCurve();
  });
})();
