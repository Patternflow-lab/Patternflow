// ===== Patternflow pattern =====
// Title:   Measure
// Family:  geometry
// Idea:    Five squares stand in rows against the left wall and one knob narrows the frame they fill, and where the frame is exactly three squares wide the first row is one solid bar and the next click sends its last square down to the row below.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 185
// Round:   187
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Frame=-25..23, Skew=0.06..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from a cyan.
// Knob 2: Size. The side of each square, 12 LEDs at the bottom of the knob to 18 at the top; it opens at 16. The frame at the hold is always three sides wide.
// Knob 3: Frame. How wide the frame is, in clicks, 48 of them; its left side is the left wall and turning up narrows it. It opens with 4.3 LEDs between the squares of the first row. Eight clicks on, the gaps have shut and the three squares are one bar, as wide as the frame; the knob holds there for three clicks. The click after, the frame is one LED too narrow for three, the third square goes down to the second row and the two left in the first spread across the frame.
// Knob 4: Skew. How far each row stands to the right of the one above it, 0 to 16 LEDs, held back where the panel's right edge would cut a square. It opens at 0.06, which is no skew.

const W = 64;
const H = 128;
// The knob has 48 clicks. The frame is three squares wide for three of them.
const CLICKS = 48;
const HOLD = 34;
const OPEN = 25;
// LEDs a click narrows the frame in the eight clicks beside the hold.
const STEP = 1.05;
const NEAR = 8;
const COUNT = 5;
const PER = 3;
// The empty rows between one row and the next.
const GAP_V = 4;
const SAT = 0.75;
const PEAK = 0.95;
// The first colour: a cyan.
const BASE = 0.5;
const SKEW = 16;

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// LEDs the frame has gone from the hold after m clicks: a click each for eight, then the walk slows and ends at far.
function reach(m, far, rest) {
  return m <= NEAR ? STEP * m : STEP * NEAR + ((far - STEP * NEAR) * (m - NEAR)) / rest;
}

// The frame's width in LEDs at click q, wider than three squares before the hold, three squares for its three clicks and narrower after.
function frame(q, hold, wide, narrow) {
  if (q < HOLD) return hold + reach(HOLD - q, wide, HOLD - NEAR);
  if (q <= HOLD + 2) return hold;
  return hold - reach(q - HOLD - 2, narrow, CLICKS - HOLD - 2 - NEAR);
}

export function setup(params) {
  params.t = 0;
  params.key = "";
  params.col = new Float32Array(3);
  params.lum = new Float32Array(W * H);
}

// Adds the share of each LED a rectangle covers.
function rect(lum, x0, x1, y0, y1) {
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) {
    const oy = Math.min(y + 1, y1) - Math.max(y, y0);
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) {
      const ox = Math.min(x + 1, x1) - Math.max(x, x0);
      lum[y * W + x] += ox * oy;
    }
  }
}

// Three squares to a row while they fit the frame, two to a row once they do not. The squares are spread edge to edge across the frame, and a short last row keeps the gaps of the rows above it.
function lay(params, s, w, skew) {
  const n = w >= PER * s ? PER : PER - 1;
  const gap = (w - n * s) / (n - 1);
  const rows = Math.ceil(COUNT / n);
  const height = rows * s + (rows - 1) * GAP_V;
  const top = Math.round(H / 2 - height / 2);
  params.lum.fill(0);
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const cols = Math.min(n, COUNT - i);
    const right = (cols - 1) * (s + gap) + s;
    const shift = Math.min(skew * r, W - right);
    const y0 = top + r * (s + GAP_V);
    for (let c = 0; c < cols; c++, i++) {
      const x0 = c * (s + gap) + shift;
      rect(params.lum, x0, x0 + s, y0, y0 + s);
    }
  }
  for (let j = 0; j < params.lum.length; j++) if (params.lum[j] > 1) params.lum[j] = 1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const s = 12 + 2 * clamp(k[1], 0, 3);
  const q = clamp(k[2], -OPEN, CLICKS - OPEN) + OPEN;
  const skew = ((clamp(k[3], 0.06, 1) - 0.06) / 0.94) * SKEW;
  const key = s + "," + q + "," + skew;
  if (key !== params.key) {
    params.key = key;
    const hold = PER * s;
    // The widest the frame goes is the panel; the narrowest keeps two squares in a row with a gap of at least 1.5 LEDs.
    const wide = Math.min(22, W - hold);
    const narrow = Math.min(12, hold - (2 * s + 1.5));
    lay(params, s, frame(q, hold, wide, narrow), skew);
  }
  // One colour and one breath for every square.
  hsv(k[0] + BASE + 0.02 * Math.sin(t * 0.43), SAT, PEAK * (0.84 + 0.16 * Math.sin(t * 1.2 + 2.1)), params.col);
}

export function draw(display, params, time) {
  const { col, lum } = params;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = lum[y * W + x];
      display.setPixel(x, y, col[0] * c, col[1] * c, col[2] * c);
    }
  }
}
