// ===== Patternflow pattern =====
// Title:   Wedge
// Family:  geometry
// Idea:    Two squares stand side by side as one bar and a tall triangle comes down point first onto the seam between them: one knob drives it in, the squares slide apart along its flanks, and the knob holds where both squares meet the side walls and the triangle can go no deeper.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 195
// Round:   197
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Depth=-36..12, Lag=0.06..1
//
// Knob 1: Hue. The colour of all three shapes, all the way round the wheel from a spring green.
// Knob 2: Size. The side of each square, 12 LEDs at the bottom of the knob to 18 at the top; it opens at 16. The triangle stays 56 LEDs long and 44.8 wide.
// Knob 3: Depth. How far the triangle has come down, in clicks, 48 of them. For the first 24 it comes down the dark towards the bar, 1.5 LEDs a click, and at the 24th its point meets the seam. From there every click drives the point in and the squares apart, each square going 0.4 LEDs for every LED of depth. It opens 12 clicks in. For the eight clicks before the walls each square goes 1.05 LEDs a click, and the last three clicks are one picture: both squares against the walls.
// Knob 4: Lag. How much less the left square gives way than the right, from the same to not at all. The triangle leans over to the right as it comes down, the right square reaches its wall first and the left one makes up the rest, so the hold is the same picture wherever this knob is. It opens at 0.06, which is no lag.

const W = 64;
const H = 128;
// The knob has 48 clicks. The point meets the seam at one and the squares are at the walls for the last three.
const CLICKS = 48;
const HOLD = 46;
const OPEN = 36;
const TOUCH = 24;
// LEDs a click moves each square in the eight clicks before the hold.
const STEP = 1.05;
const NEAR = 8;
// LEDs a click brings the triangle down before it touches.
const FALL = 1.5;
// The triangle: half its width over its length, and its length.
const TAN = 0.4;
const LENGTH = 56;
const COS = 1 / Math.sqrt(1 + TAN * TAN);
// The row the squares' top edge stands on.
const TOP = 72;
const SAT = 0.7;
const PEAK = 0.95;
// The first colour: a spring green.
const BASE = 0.39;

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

// LEDs each square has gone from the seam at click q, when both give way alike. far is the way to the wall.
function spread(q, far) {
  if (q >= HOLD) return far;
  if (q >= HOLD - NEAR) return far - STEP * (HOLD - q);
  if (q <= TOUCH) return 0;
  return ((far - STEP * NEAR) * (q - TOUCH)) / (HOLD - NEAR - TOUCH);
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

// Adds a triangle with its point down at (ax, ay) and its base LENGTH above, each LED by how far inside the nearest edge its middle is.
function wedge(lum, ax, ay) {
  const top = ay - LENGTH;
  for (let y = Math.max(0, Math.floor(top)); y < Math.min(H, Math.ceil(ay)); y++) {
    const cy = y + 0.5;
    const half = (ay - cy) * TAN;
    const under = clamp(cy - top + 0.5, 0, 1);
    for (let x = Math.max(0, Math.floor(ax - half - 1)); x < Math.min(W, Math.ceil(ax + half + 1)); x++) {
      const side = clamp((half - Math.abs(x + 0.5 - ax)) * COS + 0.5, 0, 1);
      lum[y * W + x] += Math.min(side, under);
    }
  }
}

function lay(params, s, q, lag) {
  const far = W / 2 - s;
  const p = spread(q, far);
  // The right square takes the larger share until it is at its wall; the left one makes up the rest.
  const right = Math.min(far, p * (1 + lag));
  const left = 2 * p - right;
  const mid = W / 2 + (right - left) / 2;
  const lum = params.lum;
  lum.fill(0);
  rect(lum, W / 2 - left - s, W / 2 - left, TOP, TOP + s);
  rect(lum, W / 2 + right, W / 2 + right + s, TOP, TOP + s);
  wedge(lum, mid, TOP + p / TAN - Math.max(0, TOUCH - q) * FALL);
  for (let j = 0; j < lum.length; j++) if (lum[j] > 1) lum[j] = 1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const s = 12 + 2 * clamp(k[1], 0, 3);
  const q = clamp(k[2], -OPEN, CLICKS - OPEN) + OPEN;
  const lag = (clamp(k[3], 0.06, 1) - 0.06) / 0.94;
  const key = s + "," + q + "," + lag;
  if (key !== params.key) {
    params.key = key;
    lay(params, s, q, lag);
  }
  // One colour and one breath for all three shapes.
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
