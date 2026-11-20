// ===== Patternflow pattern =====
// Title:   Shim
// Family:  geometry
// Idea:    Six squares stand stacked in one column against the right wall and a square turned on its corner comes in from the left wall at the seam between the third and the fourth: one knob drives its corner in, the two halves of the column slide apart up and down its edges, and the knob holds where the column's ends meet the ceiling and the floor and the corner can go no further.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 195
// Round:   197
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Reach=-36..12, Lag=0.06..1
//
// Knob 1: Hue. The colour of every shape, all the way round the wheel from a coral.
// Knob 2: Size. The square that comes in, by its diagonal: 34 LEDs at the bottom of the knob to 52 at the top; it opens at 46. The column's squares stay 16 LEDs a side.
// Knob 3: Reach. How far the corner has come in, in clicks, 48 of them. For the first 24 it comes out of the left wall towards the column, 0.75 LEDs a click, and at the 24th it meets the seam. From there every click drives it in and the halves apart, each half going as far as the corner does. It opens 12 clicks in. For the eight clicks before the ceiling and the floor each half goes 1.05 LEDs a click, and the last three clicks are one picture: the column's ends against the ceiling and the floor.
// Knob 4: Lag. How much less the upper half gives way than the lower, from the same to not at all. The corner slides downwards as it comes in, the lower half reaches the floor first and the upper one makes up the rest, so the hold is the same picture wherever this knob is. It opens at 0.06, which is no lag.

const W = 64;
const H = 128;
// The knob has 48 clicks. The corner meets the seam at one and the column's ends are at the ceiling and the floor for the last three.
const CLICKS = 48;
const HOLD = 46;
const OPEN = 36;
const TOUCH = 24;
// LEDs a click moves each half in the eight clicks before the hold.
const STEP = 1.05;
const NEAR = 8;
// LEDs a click brings the corner in before it touches.
const CREEP = 0.75;
const SIDE = 16;
const COUNT = 6;
const HALF = (COUNT / 2) * SIDE;
const FAR = H / 2 - HALF;
// The column's left edge. Its right edge is the right wall.
const LEFT = W - SIDE;
const SAT = 0.62;
const PEAK = 0.95;
// The first colour: a coral.
const BASE = 0.02;

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

// LEDs each half has gone from the seam at click q, when both give way alike.
function spread(q) {
  if (q >= HOLD) return FAR;
  if (q >= HOLD - NEAR) return FAR - STEP * (HOLD - q);
  if (q <= TOUCH) return 0;
  return ((FAR - STEP * NEAR) * (q - TOUCH)) / (HOLD - NEAR - TOUCH);
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

// Adds a square standing on its corner, half its diagonal r, each LED by how far inside the nearest edge its middle is.
function diamond(lum, cx, cy, r) {
  for (let y = Math.max(0, Math.floor(cy - r - 1)); y < Math.min(H, Math.ceil(cy + r + 1)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r - 1)); x < Math.min(W, Math.ceil(cx + r + 1)); x++) {
      const d = r - Math.abs(x + 0.5 - cx) - Math.abs(y + 0.5 - cy);
      lum[y * W + x] += clamp(d * Math.SQRT1_2 + 0.5, 0, 1);
    }
  }
}

function lay(params, r, q, lag) {
  const p = spread(q);
  // The lower half takes the larger share until it is on the floor; the upper one makes up the rest.
  const down = Math.min(FAR, p * (1 + lag));
  const up = 2 * p - down;
  const mid = H / 2 + (down - up) / 2;
  const tip = LEFT + p - Math.max(0, TOUCH - q) * CREEP;
  const lum = params.lum;
  lum.fill(0);
  rect(lum, LEFT, LEFT + SIDE, H / 2 - up - HALF, H / 2 - up);
  rect(lum, LEFT, LEFT + SIDE, H / 2 + down, H / 2 + down + HALF);
  diamond(lum, tip - r, mid, r);
  for (let j = 0; j < lum.length; j++) if (lum[j] > 1) lum[j] = 1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const r = 17 + 3 * clamp(k[1], 0, 3);
  const q = clamp(k[2], -OPEN, CLICKS - OPEN) + OPEN;
  const lag = (clamp(k[3], 0.06, 1) - 0.06) / 0.94;
  const key = r + "," + q + "," + lag;
  if (key !== params.key) {
    params.key = key;
    lay(params, r, q, lag);
  }
  // One colour and one breath for every shape.
  hsv(k[0] + BASE + 0.02 * Math.sin(t * 0.45), SAT, PEAK * (0.84 + 0.16 * Math.sin(t * 1.25 + 2.0)), params.col);
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
