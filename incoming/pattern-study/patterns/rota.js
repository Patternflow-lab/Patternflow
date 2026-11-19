// ===== Patternflow pattern =====
// Title:   Rota
// Family:  geometry
// Idea:    One circle stands in the upper part of the dark panel and a knob walks it round to the right, out through the right wall and in again at the left: the knob holds for three clicks where the circle's edge first touches the right wall, and one click on a slice of it is standing at the left wall as a second piece.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 181
// Round:   183
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Pass=-16..32, Height=-0.2..1
//
// Knob 1: Hue. The colour of the circle, all the way round the wheel from a coral.
// Knob 2: Size. The circle's width, 14 LEDs at the bottom of the knob to 38 at the top; it opens at 30. At 38 it is still 26 LEDs narrower than the panel.
// Knob 3: Pass. How far the circle has gone round to the right, in clicks, 48 of them. One turn of the whole knob is one trip round the panel, 64 LEDs, so its two ends are the same picture. Where it opens the circle's middle is 27 LEDs from the left wall. Turn up 16 clicks and the circle's edge touches the right wall: the knob holds there for three clicks. The click after that, a slice of the circle stands at the left wall and the circle is two pieces. Every click either side of the hold walks it 1.4 LEDs.
// Knob 4: Height. How high the circle stands, from near the top at the bottom of the knob to near the floor at the top. It never goes through the ceiling or the floor. It opens at 0.06, in the upper part of the panel.

const W = 64;
const H = 128;
// The knob has 48 clicks, and the hold takes three of them: the circle stands still for two clicks after the first.
const CLICKS = 48;
const HOLD = 32;
const OPEN = 16;
// LEDs a click walks the circle, outside the hold: the way round is the panel's width.
const STEP = W / (CLICKS - 2);
const SAT = 0.75;
const PEAK = 0.95;
// The first colour: a coral.
const BASE = 0.03;

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

// Clicks past the place where the circle's edge first touches the right wall: below zero before it, zero for the three clicks of the hold, above zero after.
function travel(q) {
  if (q <= HOLD) return q - HOLD;
  if (q <= HOLD + 2) return 0;
  return q - HOLD - 2;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.dx = new Float32Array(W);
  params.r = 15;
  params.cy = 40;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const r = 7 + 4 * clamp(k[1], 0, 3);
  // Where the circle's middle is, going round the panel's width. At the hold its edge is on the right wall, and the size is in the sum: a bigger circle's middle is further from the wall.
  const way = W - r + STEP * travel(clamp(k[2], -OPEN, CLICKS - OPEN) + OPEN);
  const cx = way - W * Math.floor(way / W);
  const up = clamp((k[3] + 0.2) / 1.2, 0, 1);
  params.r = r;
  params.cy = r + 4 + up * (H - 2 * r - 8);
  // The middle is where the circle's edge was, so a column is as far from the circle as from whichever of its three copies, one round the panel either side, is nearest.
  for (let x = 0; x < W; x++) {
    const a = Math.abs(x + 0.5 - cx);
    const b = Math.abs(x + 0.5 - cx + W);
    const c = Math.abs(x + 0.5 - cx - W);
    params.dx[x] = a < b ? (a < c ? a : c) : b < c ? b : c;
  }
  // Nothing on the panel moves on the clock but the light, which swells and falls, and the colour, which wanders a few degrees.
  hsv(k[0] + BASE + 0.02 * Math.sin(t * 0.43), SAT, PEAK * (0.84 + 0.16 * Math.sin(t * 1.2 + 0.4)), params.col);
}

export function draw(display, params, time) {
  const { col, dx, r, cy } = params;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - cy;
    for (let x = 0; x < W; x++) {
      const c = clamp(r + 0.5 - Math.hypot(dx[x], dy), 0, 1);
      display.setPixel(x, y, col[0] * c, col[1] * c, col[2] * c);
    }
  }
}
