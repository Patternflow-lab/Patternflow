// ===== Patternflow pattern =====
// Title:   Oculus
// Family:  geometry
// Idea:    One square stands high and left on a bare dark ground with a round hole cut in it, and the four knobs are the colour, how big the square is, how wide the hole has grown and how far it sits above or below the middle: the hole widens until it touches all four sides at once, and the square, one piece until then, is four corners.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 163
// Round:   165
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Hole=-32..16, Shift=-0.88..1
//
// Knob 1: Hue. The colour of the square, all the way round the wheel from azure.
// Knob 2: Size. The side of the square, 40 LEDs at 0 to 52 LEDs at 3; its 2 is 48 LEDs.
// Knob 3: Hole. How wide the round hole is, counted in clicks: it opens ten clicks short of touching. Turned up the hole widens, slowly at first and by a little over one LED of rim a click for the last eight clicks, until it is as wide as the square and touches all four sides at once. The knob holds that picture for three clicks, four corners on the panel, then the hole goes on widening for the last four clicks. Turned down it shrinks to a pinhole.
// Knob 4: Shift. How far the hole sits off the middle of the square, up at the top of the knob and down at the bottom, 4 LEDs at most; where it opens it is dead centre.

const W = 64;
const H = 128;
// The square stands high and left of the middle, so the bottom of the panel and a strip on the right are bare.
const CX = 28;
const CY = 38;
// Knob 3 is counted in clicks and the knob has 48 of them. It opens at 0, ten clicks before the hole touches the sides: clicks 10, 11 and 12 are the touching picture.
const HOLD = 10;
const HOLD_END = 12;
// The smallest the hole gets, in LEDs across.
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

// How wide the hole is for a knob a number of clicks from where it opens, for a square this wide. Before it touches, the wall between the hole and a side thins by 2.05 LEDs on the last click, which keeps a whole dark row between the two and so keeps the square one piece up to that click, and by 1.05 LEDs a click for the seven before it.
function holeWidth(clicks, side) {
  let wide;
  if (clicks > HOLD_END) wide = side + 2.1 * (clicks - HOLD_END);
  else if (clicks >= HOLD) wide = side;
  else {
    const u = HOLD - clicks;
    const wall = u <= 1 ? 2.05 * u : u <= 8 ? 2.05 + 1.05 * (u - 1) : 9.4 + 0.3 * (u - 8);
    wide = side - 2 * wall;
  }
  return wide < PIN ? PIN : wide;
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.light = 1;
  params.side = 48;
  params.radius = 14;
  params.hy = CY;
  params.col = new Float32Array(W);
  params.row = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const side = 40 + 4 * clamp(k[1], 0, 3);
  params.side = side;
  params.radius = holeWidth(clamp(k[2], -32, 16), side) / 2;
  // The shift knob opens at 0.06, so 0.06 is the middle of its travel and the hole sits dead centre there.
  params.hy = CY - 4 * clamp((k[3] - 0.06) / 0.94, -1, 1);
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.85 + 0.15 * Math.sin(t * 0.53 + 0.5);
  hsv(k[0] + 0.52, 0.7, params.light, params.c);
}

export function draw(display, params, time) {
  const { side, radius, hy, col, row, c } = params;
  for (let x = 0; x < W; x++) col[x] = span(CX - side / 2, CX + side / 2, x);
  for (let y = 0; y < H; y++) row[y] = span(CY - side / 2, CY + side / 2, y);
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - hy;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX;
      // The square, less the hole, which is a whole LED dark when it is a whole LED inside.
      const sd = Math.sqrt(dx * dx + dy * dy) - radius;
      let hole = 0.5 - sd;
      hole = hole < 0 ? 0 : hole > 1 ? 1 : hole;
      const m = col[x] * row[y] * (1 - hole);
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
