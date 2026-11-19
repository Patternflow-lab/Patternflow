// ===== Patternflow pattern =====
// Title:   Reprise
// Family:  geometry
// Idea:    One square stands left of the middle of the dark panel and a knob walks it up, out through the ceiling and in again at the floor: the knob holds for three clicks where the square's top edge first touches the ceiling, and one click on a strip of it is lying along the floor as a second piece.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 181
// Round:   183
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Lift=-21..27, Aside=-0.2..1
//
// Knob 1: Hue. The colour of the square, all the way round the wheel from a sky blue.
// Knob 2: Size. The side of the square, 14 LEDs at the bottom of the knob to 35 at the top; it opens at 28.
// Knob 3: Lift. How far the square has gone up, in clicks, 48 of them. One turn of the whole knob is one trip round the panel's height, 128 LEDs, so its two ends are the same picture. Where it opens the square's top edge is 33 LEDs below the ceiling. Turn up 12 clicks and the edge touches the ceiling: the knob holds there for three clicks. The click after that, a strip of the square is lying along the floor and the square is two pieces. Every click either side of the hold walks it 2.8 LEDs.
// Knob 4: Aside. Which way along the panel the square stands, from near the left wall at the bottom of the knob to near the right wall at the top. It never goes through a side wall. It opens at 0.06, left of the middle.

const W = 64;
const H = 128;
// The knob has 48 clicks, and the hold takes three of them: the square stands still for two clicks after the first.
const CLICKS = 48;
const HOLD = 33;
const OPEN = 21;
// LEDs a click walks the square, outside the hold: the way round is the panel's height.
const STEP = H / (CLICKS - 2);
const SAT = 0.75;
const PEAK = 0.95;
// The first colour: a sky blue.
const BASE = 0.55;

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

// How much of the LED between p and p + 1 the span from lo to hi covers.
function span(lo, hi, p) {
  const v = (hi < p + 1 ? hi : p + 1) - (lo > p ? lo : p);
  return v < 0 ? 0 : v;
}

// Clicks past the place where the square's top edge first touches the ceiling: below zero before it, zero for the three clicks of the hold, above zero after.
function travel(q) {
  if (q <= HOLD) return q - HOLD;
  if (q <= HOLD + 2) return 0;
  return q - HOLD - 2;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.mx = new Float32Array(W);
  params.my = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const s = 14 + 7 * clamp(k[1], 0, 3);
  // Where the square's top edge is, going round the panel's height. At the hold it is on the ceiling, and the size needs no sum: the edge is at 0 whatever the side is.
  const way = -STEP * travel(clamp(k[2], -OPEN, CLICKS - OPEN) + OPEN);
  const top = way - H * Math.floor(way / H);
  const aside = clamp((k[3] + 0.2) / 1.2, 0, 1);
  const left = 4 + aside * (W - s - 8);
  // The square leaves by the ceiling and comes back by the floor, so each row is covered by the square or by its copy one round the panel above.
  for (let x = 0; x < W; x++) params.mx[x] = span(left, left + s, x);
  for (let y = 0; y < H; y++) params.my[y] = Math.min(1, span(top, top + s, y) + span(top - H, top - H + s, y));
  hsv(k[0] + BASE + 0.02 * Math.sin(t * 0.43), SAT, PEAK * (0.84 + 0.16 * Math.sin(t * 1.2 + 2.1)), params.col);
}

export function draw(display, params, time) {
  const { col, mx, my } = params;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = mx[x] * my[y];
      display.setPixel(x, y, col[0] * c, col[1] * c, col[2] * c);
    }
  }
}
