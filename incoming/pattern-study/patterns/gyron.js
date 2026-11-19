// ===== Patternflow pattern =====
// Title:   Gyron
// Family:  geometry
// Idea:    One right triangle stands low on the dark panel with its upright side to the left and a knob walks it to the left, out through the left wall and in again at the right: the knob holds for three clicks where the upright side first touches the left wall, and one click on a tall strip of the triangle is standing at the right wall as a second piece.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 181
// Round:   183
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Draw=-16..32, Rise=0..1
//
// Knob 1: Hue. The colour of the triangle, all the way round the wheel from a green.
// Knob 2: Size. The triangle's base, 12 LEDs at the bottom of the knob to 33 at the top; it opens at 26. Its upright side is 1.7 times as tall as the base is long.
// Knob 3: Draw. How far the triangle has gone round to the left, in clicks, 48 of them. One turn of the whole knob is one trip round the panel, 64 LEDs, so its two ends are the same picture. Where it opens the upright side stands 28 LEDs from the left wall. Turn up 20 clicks and the side touches the left wall: the knob holds there for three clicks. The click after that, the side's edge is a tall strip at the right wall and the triangle is two pieces. Every click either side of the hold walks it 1.4 LEDs.
// Knob 4: Rise. How high the triangle stands, from near the floor at the bottom of the knob to near the ceiling at the top. It never goes through the ceiling or the floor. It opens at 0.06, standing low on the panel.

const W = 64;
const H = 128;
// The knob has 48 clicks, and the hold takes three of them: the triangle stands still for two clicks after the first.
const CLICKS = 48;
const HOLD = 36;
const OPEN = 16;
// LEDs a click walks the triangle, outside the hold: the way round is the panel's width.
const STEP = W / (CLICKS - 2);
const SAT = 0.75;
const PEAK = 0.95;
// The first colour: a green.
const BASE = 0.3;
// How tall the upright side is, as many times as the base is long.
const TALL = 1.7;

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

// Clicks past the place where the upright side first touches the left wall: below zero before it, zero for the three clicks of the hold, above zero after.
function travel(q) {
  if (q <= HOLD) return q - HOLD;
  if (q <= HOLD + 2) return 0;
  return q - HOLD - 2;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.base = 24;
  params.tall = 40;
  params.x0 = 30;
  params.floor = 119;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const base = 12 + 7 * clamp(k[1], 0, 3);
  const tall = TALL * base;
  // Where the upright side is, going round the panel's width, to the left. At the hold it is on the left wall, whatever the size.
  const way = -STEP * travel(clamp(k[2], -OPEN, CLICKS - OPEN) + OPEN);
  params.x0 = way - W * Math.floor(way / W);
  params.base = base;
  params.tall = tall;
  params.floor = H - 4 - clamp(k[3], 0, 1) * (H - 8 - tall);
  hsv(k[0] + BASE + 0.02 * Math.sin(t * 0.43), SAT, PEAK * (0.84 + 0.16 * Math.sin(t * 1.2 + 4.2)), params.col);
}

// How much of the LED at (x, y) the triangle covers, from how far the LED's middle is inside its three sides: half an LED inside is a whole LED.
function cover(x, y, x0, floor, base, tall, norm) {
  const left = x + 0.5 - x0;
  const down = floor - y - 0.5;
  const slant = (1 - (left / base + down / tall)) * norm;
  const d = Math.min(left, down, slant);
  return d >= 0.5 ? 1 : d <= -0.5 ? 0 : d + 0.5;
}

export function draw(display, params, time) {
  const { col, base, tall, x0, floor } = params;
  // The long side runs from the top of the upright side to the end of the base. A point's distance in from it is its slant sum times this.
  const norm = 1 / Math.sqrt(1 / (base * base) + 1 / (tall * tall));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // The triangle and its copy one round the panel to the right: the copy is the one that stands at the right wall once the triangle has gone out at the left.
      const a = cover(x, y, x0, floor, base, tall, norm);
      const b = cover(x, y, x0 - W, floor, base, tall, norm);
      const c = a > b ? a : b;
      display.setPixel(x, y, col[0] * c, col[1] * c, col[2] * c);
    }
  }
}
