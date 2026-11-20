// ===== Patternflow pattern =====
// Title:   Prise
// Family:  geometry
// Idea:    Two squares hang side by side from the ceiling as one bar and a circle comes up from below onto the seam between them: one knob drives it up, the squares ride apart over its shoulders, and the knob holds where both squares sit in the top corners with the circle caught between them, too wide to go on.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 195
// Round:   197
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=1..4, Rise=-36..12, Lag=0.06..1
//
// Knob 1: Hue. The colour of all three shapes, all the way round the wheel from a periwinkle blue.
// Knob 2: Size. The side of each square, 16 LEDs at the bottom of the knob to 22 at the top; it opens at 18. The circle is always 2 LEDs wider than the gap the squares can open, 34 LEDs across beside the smallest squares and 22 beside the largest, 30 as it opens.
// Knob 3: Rise. How far the circle has come up, in clicks, 48 of them. For the first 26 it comes up the dark towards the bar, 3 LEDs a click, and at the 26th its top meets the seam. From there every click lifts it and the squares part over it, and they part faster than it rises, because the top of a circle is blunt. It opens 10 clicks in. For the eight clicks before the walls each square goes 1.05 LEDs a click, and the last three clicks are one picture: both squares against the walls.
// Knob 4: Lag. How much less the right square gives way than the left, from the same to not at all. The circle drifts left as it comes up, the left square reaches its wall first and the right one makes up the rest, so the hold is the same picture wherever this knob is. It opens at 0.06, which is no lag.

const W = 64;
const H = 128;
// The knob has 48 clicks. The circle's top meets the seam at one and the squares are at the walls for the last three.
const CLICKS = 48;
const HOLD = 46;
const OPEN = 36;
const TOUCH = 26;
// LEDs a click moves each square in the eight clicks before the hold.
const STEP = 1.05;
const NEAR = 8;
// LEDs a click brings the circle up before it touches.
const CLIMB = 3;
// The circle is this much wider than the widest gap, so it never goes through.
const OVER = 2;
const SAT = 0.5;
const PEAK = 0.95;
// The first colour: a periwinkle blue.
const BASE = 0.63;

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

// Adds a disc, each LED by how far inside the rim its middle is.
function disc(lum, cx, cy, r) {
  for (let y = Math.max(0, Math.floor(cy - r - 1)); y < Math.min(H, Math.ceil(cy + r + 1)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r - 1)); x < Math.min(W, Math.ceil(cx + r + 1)); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      lum[y * W + x] += clamp(r - d + 0.5, 0, 1);
    }
  }
}

function lay(params, s, q, lag) {
  const far = W / 2 - s;
  const r = far + OVER / 2;
  const p = spread(q, far);
  // The left square takes the larger share until it is at its wall; the right one makes up the rest.
  const left = Math.min(far, p * (1 + lag));
  const right = 2 * p - left;
  const mid = W / 2 + (right - left) / 2;
  // The squares' inner bottom corners sit on the rim, so the circle's middle is this far below their bottom edge.
  const below = Math.sqrt(r * r - p * p);
  const lum = params.lum;
  lum.fill(0);
  rect(lum, W / 2 - left - s, W / 2 - left, 0, s);
  rect(lum, W / 2 + right, W / 2 + right + s, 0, s);
  disc(lum, mid, s + below + Math.max(0, TOUCH - q) * CLIMB, r);
  for (let j = 0; j < lum.length; j++) if (lum[j] > 1) lum[j] = 1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const s = 14 + 2 * clamp(k[1], 1, 4);
  const q = clamp(k[2], -OPEN, CLICKS - OPEN) + OPEN;
  const lag = (clamp(k[3], 0.06, 1) - 0.06) / 0.94;
  const key = s + "," + q + "," + lag;
  if (key !== params.key) {
    params.key = key;
    lay(params, s, q, lag);
  }
  // One colour and one breath for all three shapes.
  hsv(k[0] + BASE + 0.02 * Math.sin(t * 0.41), SAT, PEAK * (0.84 + 0.16 * Math.sin(t * 1.15 + 2.2)), params.col);
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
