// ===== Patternflow pattern =====
// Title:   Fenestra
// Family:  geometry
// Idea:    One square stands low and right on a bare dark ground with a diamond cut out of it, and the four knobs are the colour, how big the square is, how wide the diamond has grown and how far it sits to the left or right of the middle: the diamond widens until its four points reach the four sides, and the square, one piece until then, is four corner triangles.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 163
// Round:   165
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Diamond=-32..16, Shift=-0.88..1
//
// Knob 1: Hue. The colour of the square, all the way round the wheel from violet.
// Knob 2: Size. The side of the square, 46 LEDs at 0 to 55 LEDs at 3; its 2 is 52 LEDs.
// Knob 3: Diamond. How far across the diamond is from point to point, counted in clicks: it opens ten clicks short of reaching the sides. Turned up the diamond widens, slowly at first and by a little over one LED of point a click for the last eight clicks, until it is a little wider than the square and its four points have cut through the four sides. The knob holds that picture for three clicks, four corner triangles on the panel, then the diamond goes on widening for the last four clicks. Turned down it shrinks to a small diamond.
// Knob 4: Shift. How far the diamond sits left or right of the middle of the square, to the right at the top of the knob and to the left at the bottom, 4 LEDs at most; where it opens it is dead centre.

const W = 64;
const H = 128;
// The square stands low and right of the middle, so the top of the panel and a strip on the left are bare. It is the biggest of the three.
const CX = 36;
const CY = 98;
// Knob 3 is counted in clicks and the knob has 48 of them. It opens at 0, ten clicks before the diamond reaches the sides: clicks 10, 11 and 12 are the cut picture.
const HOLD = 10;
const HOLD_END = 12;
// The diamond's points are one LED wide, so a point that only touches a side leaves two half-lit LEDs that hold the corners together. It has to be two LEDs wider than the square before the points have cut right through.
const LIFT = 2;
// The smallest the diamond gets, in LEDs across.
const PIN = 6;

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

// How wide the diamond is for a knob a number of clicks from where it opens, for a square this wide. Before it reaches the sides, the wall between a point and its side thins by 2.05 LEDs on the last click, which keeps a whole lit row between the two and so keeps the square one piece up to that click, and by 1.05 LEDs a click for the seven before it.
function diamondWidth(clicks, side) {
  let wide;
  if (clicks > HOLD_END) wide = side + LIFT + 2.1 * (clicks - HOLD_END);
  else if (clicks >= HOLD) wide = side + LIFT;
  else {
    const u = HOLD - clicks;
    const wall = u <= 1 ? 2.05 * u : u <= 8 ? 2.05 + 1.05 * (u - 1) : 9.4 + 0.3 * (u - 8);
    wide = side + LIFT - 2 * wall;
  }
  return wide < PIN ? PIN : wide;
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.light = 1;
  params.side = 52;
  params.half = 24;
  params.hx = CX;
  params.col = new Float32Array(W);
  params.row = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const side = 46 + 3 * clamp(k[1], 0, 3);
  params.side = side;
  params.half = diamondWidth(clamp(k[2], -32, 16), side) / 2;
  // The shift knob opens at 0.06, so 0.06 is the middle of its travel and the diamond sits dead centre there.
  params.hx = CX + 4 * clamp((k[3] - 0.06) / 0.94, -1, 1);
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.85 + 0.15 * Math.sin(t * 0.61 + 1.3);
  hsv(k[0] + 0.78, 0.6, params.light, params.c);
}

export function draw(display, params, time) {
  const { side, half, hx, col, row, c } = params;
  for (let x = 0; x < W; x++) col[x] = span(CX - side / 2, CX + side / 2, x);
  for (let y = 0; y < H; y++) row[y] = span(CY - side / 2, CY + side / 2, y);
  const SQRT_HALF = Math.SQRT1_2;
  for (let y = 0; y < H; y++) {
    const dy = Math.abs(y + 0.5 - CY);
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x + 0.5 - hx);
      // The square, less the diamond, which is a whole LED dark when it is a whole LED inside. The diamond's edge sits at 45 degrees, so the distance to it is the sum of the two offsets less its half-width, over the root of two.
      const sd = (dx + dy - half) * SQRT_HALF;
      let hole = 0.5 - sd;
      hole = hole < 0 ? 0 : hole > 1 ? 1 : hole;
      const m = col[x] * row[y] * (1 - hole);
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
