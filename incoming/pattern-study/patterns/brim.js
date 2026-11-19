// ===== Patternflow pattern =====
// Title:   Brim
// Family:  geometry
// Idea:    A row of equal squares hangs from the top of the panel and one knob grows them, and where they fill the row from wall to wall they are one solid band and the next click sends the last one down to a row of its own.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 185
// Round:   187
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=1..4, Size=-25..23, Align=0.06..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from a gold.
// Knob 2: Count. How many squares, 3 at the bottom of the knob to 6 at the top. It opens on four, which are 16 LEDs on a side when they fill the row from wall to wall.
// Knob 3: Size. How big the squares are, in clicks, 48 of them. It opens at 20 LEDs, with three squares in the first row and the last one alone below. Turning down, the squares shrink until at 16 LEDs the four are one band against both walls; the knob holds there for three clicks. The click after, they have grown past the wall and one drops below. Further down, the four stand apart.
// Knob 4: Align. Where the lone square of the second row stands, from under the first of the row above at 0.06 to against the right wall at 1.

const W = 64;
const H = 128;
// The knob has 48 clicks. The squares fill the row exactly for three of them.
const CLICKS = 48;
const HOLD = 14;
const OPEN = 25;
const NEAR = 8;
// The first row hangs this far from the top of the panel.
const TOP = 12;
// The empty rows between one row and the next.
const GAP_V = 4;
const SAT = 0.8;
const PEAK = 0.95;
// The first colour: a gold.
const BASE = 0.12;

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

// How far the size has gone from the hold after m clicks: step each for eight clicks, then the walk slows and ends at far.
function reach(m, step, far, rest) {
  const st = Math.min(step, far / NEAR);
  return m <= NEAR ? st * m : st * NEAR + ((far - st * NEAR) * (m - NEAR)) / rest;
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

// All the squares in one row while they fit it, one fewer to a row once they do not. They are spread wall to wall, and the short last row keeps the gaps of the row above it and stands where align says.
function lay(params, count, s, align) {
  const n = s > W / count + 1e-9 ? count - 1 : count;
  const gap = (W - n * s) / (n - 1);
  const rows = Math.ceil(count / n);
  params.lum.fill(0);
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const cols = Math.min(n, count - i);
    const width = cols * s + (cols - 1) * gap;
    const shift = r === rows - 1 && rows > 1 ? align * (W - width) : 0;
    const y0 = TOP + r * (s + GAP_V);
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
  const count = 2 + Math.round(clamp(k[1], 1, 4));
  const q = clamp(k[2], -OPEN, CLICKS - OPEN) + OPEN;
  const align = (clamp(k[3], 0.06, 1) - 0.06) / 0.94;
  const key = count + "," + q + "," + align;
  if (key !== params.key) {
    params.key = key;
    // The size at which the row is full, and how far the walk may go either side of it: down to 0.7 of it, and up until the next fewer squares would fill the row, but not quite.
    const full = W / count;
    const step = 0.35 * (full / 16);
    const down = 0.3 * full;
    const up = 0.8 * (W / (count - 1) - full);
    let s = full;
    if (q < HOLD) s = full - reach(HOLD - q, step, down, HOLD - NEAR);
    else if (q > HOLD + 2) s = full + reach(q - HOLD - 2, step, up, CLICKS - HOLD - 2 - NEAR);
    lay(params, count, s, align);
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
