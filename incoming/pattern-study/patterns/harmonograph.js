// ===== Patternflow pattern =====
// Title:   Harmonograph
// Family:  line
// Idea:    Pendulums swinging at almost a simple ratio draw a figure that never quite closes, and as they run down it winds itself into the centre.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 128x64
// @knobs Hue=0..1, Speed=0.25..4, Ratio=0..7, Damping=0.02..0.4
//
// Knob 1: Hue. The colour of the fresh line; older line turns a little round the wheel as it fades.
// Knob 2: Speed. How fast the pen travels; a slow pen's line lasts longer.
// Knob 3: Ratio. Walks the pendulums through 1:2, 2:3, 3:4, 3:5, 1:3, 2:5, 1:4 and 4:5; between two steps the pair drifts further out of tune.
// Knob 4: Damping. How quickly the swing dies away; low keeps one figure turning for two minutes, high spirals in within seconds.
// Buttons: K1 tap gives the pendulums a fresh push.

const W = 128;
const H = 64;
const RATIOS = [1, 2, 2, 3, 3, 4, 3, 5, 1, 3, 2, 5, 1, 4, 4, 5];

function hsvInto(out, o, h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 ? v : k === 1 ? q : k === 2 ? p : k === 3 ? p : k === 4 ? t : v) * 255;
  out[o + 1] = (k === 0 ? t : k === 1 ? v : k === 2 ? v : k === 3 ? q : k === 4 ? p : p) * 255;
  out[o + 2] = (k === 0 ? p : k === 1 ? p : k === 2 ? t : k === 3 ? v : k === 4 ? v : q) * 255;
}

// The phosphor: bright fresh line in the chosen hue, fading and turning as it ages.
function buildLut(params, hue) {
  const lut = params.lut;
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    hsvInto(lut, i * 3, hue - (1 - v) * 0.14, 0.92 - 0.12 * v * v, Math.pow(v, 1.15));
  }
  params.lutHue = hue;
}

function push(params) {
  params.s = 0;
  params.amp = 0.88 + Math.random() * 0.12;
  params.p1 = Math.random() * Math.PI * 2;
  params.p2 = Math.random() * Math.PI * 2;
  params.p3 = Math.random() * Math.PI * 2;
  params.turn = 0.12 + Math.random() * 0.16;
  params.sign = Math.random() < 0.5 ? -1 : 1;
}

export function setup(params) {
  params.buf = new Float32Array(W * H);
  params.lut = new Float32Array(256 * 3);
  params.lutHue = -1;
  params.pen = new Float32Array(2);
  params.head = new Float32Array(3);
  params.hue = 0;
  params.warm = false;
  push(params);
}

// Where the pen is after s seconds of swing.
function penAt(params, s, out) {
  const w = params.w;
  const d = Math.exp(-params.damp * s) * params.amp;
  const a = params.fa * w;
  const b = params.fb * w;
  const r = a * (1 + params.detune * params.sign);
  const t = params.turn;
  // Lateral pendulums in x and y, y a little out of tune with x, and a rotary one
  // turning the paper at nearly x's rate.
  const yb = b * (1 - params.detune * 0.5 * params.sign);
  out[0] = W / 2 - 0.5 + 60 * d * ((1 - t) * Math.sin(a * s + params.p1) + t * Math.sin(r * s + params.p3));
  out[1] = H / 2 - 0.5 + 29.5 * d * ((1 - t) * Math.sin(yb * s + params.p2) + t * Math.cos(r * s + params.p3));
}

// A faint wide haze under the line, so it glows rather than sits on the black.
function haze(buf, x, y, v) {
  const x0 = Math.ceil(x - 2.4);
  const y0 = Math.ceil(y - 2.4);
  for (let yy = y0; yy <= y0 + 4; yy++) {
    if (yy < 0 || yy >= H) continue;
    const dy = yy - y;
    for (let xx = x0; xx <= x0 + 4; xx++) {
      if (xx < 0 || xx >= W) continue;
      const dx = xx - x;
      const w = (1 - (dx * dx + dy * dy) / 5.76) * v;
      const i = yy * W + xx;
      if (w > buf[i]) buf[i] = w;
    }
  }
}

function splat(buf, x, y, v) {
  const x0 = Math.ceil(x - 1.2);
  const y0 = Math.ceil(y - 1.2);
  for (let yy = y0; yy <= y0 + 2; yy++) {
    if (yy < 0 || yy >= H) continue;
    const dy = yy - y;
    for (let xx = x0; xx <= x0 + 2; xx++) {
      if (xx < 0 || xx >= W) continue;
      const dx = xx - x;
      const w = (1 - (dx * dx + dy * dy) / 1.44) * v;
      const i = yy * W + xx;
      if (w > buf[i]) buf[i] = w;
    }
  }
}

// Draws the pen's path from swing time s0 to s1. With tau, older stretches come out
// dimmer, the same as if they had been fading on the panel since the pen passed.
function trace(params, s0, s1, tau) {
  const buf = params.buf;
  const pen = params.pen;
  const n = Math.max(2, Math.ceil((s1 - s0) * 24 * Math.max(params.fa, params.fb) * params.w));
  penAt(params, s0, pen);
  let px = pen[0];
  let py = pen[1];
  for (let i = 1; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    penAt(params, s, pen);
    const v = tau > 0 ? Math.exp(-(s1 - s) / tau) : 1;
    const dx = pen[0] - px;
    const dy = pen[1] - py;
    const m = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.5));
    for (let j = 1; j <= m; j++) {
      const x = px + (dx * j) / m;
      const y = py + (dy * j) / m;
      if (j % 2 === 0 || j === m) haze(buf, x, y, 0.18 * v);
      splat(buf, x, y, v);
    }
    px = pen[0];
    py = pen[1];
  }
  params.x = px;
  params.y = py;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.hue = k[0];
  const speed = Math.max(0.05, k[1]);
  const pick = Math.max(0, Math.min(7, k[2]));
  const step = Math.round(pick);
  params.fa = RATIOS[step * 2];
  params.fb = RATIOS[step * 2 + 1];
  // On a step the pair is a hair out of tune; halfway to the next it is much further out.
  params.detune = 0.012 + Math.abs(pick - step) * 0.05;
  params.damp = k[3] * 0.6;
  // The faster pendulum swings once a second whatever the ratio, so a busy figure takes longer to draw.
  params.w = (Math.PI * 2) / Math.max(params.fa, params.fb);
  dt = Math.min(dt, 0.1);
  if (params.lutHue !== params.hue) buildLut(params, params.hue);
  if (input.btnPressed && input.btnPressed[0]) push(params);

  // A slow pen keeps its line longer, so it still lays down a whole figure.
  const tau = 6 * Math.sqrt(2 / speed);
  // Speed 2 runs the swing in real time.
  const sd = (dt * speed) / 2;
  if (!params.warm) {
    // Open mid-swing, with the last six seconds of it already on the panel.
    params.warm = true;
    trace(params, 0, 6, (tau * speed) / 2);
    params.s = 6;
    return;
  }
  const buf = params.buf;
  const fade = Math.exp(-dt / tau);
  for (let i = 0; i < buf.length; i++) buf[i] *= fade;
  trace(params, params.s, params.s + sd, 0);
  params.s += sd;
  // When the swing has run down to a small knot, push again.
  if (Math.exp(-params.damp * params.s) * params.amp < 0.2) push(params);
}

export function draw(display, params, time) {
  const buf = params.buf;
  const lut = params.lut;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = buf[y * W + x];
      const i = Math.min(255, Math.floor(v * 255)) * 3;
      display.setPixel(x, y, lut[i], lut[i + 1], lut[i + 2]);
    }
  }
  // The pen itself, a little paler than its line.
  const head = params.head;
  hsvInto(head, 0, params.hue, 0.3, 1);
  const hx = Math.round(params.x);
  const hy = Math.round(params.y);
  if (hx >= 0 && hx < W && hy >= 0 && hy < H) display.setPixel(hx, hy, head[0], head[1], head[2]);
}
