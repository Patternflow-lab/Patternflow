// ===== Patternflow pattern =====
// Title:   Yoke
// Family:  geometry
// Idea:    Four squares stand in a column left of the middle of a bare dark ground, evenly spaced, and the four knobs are the colour, how big the squares are, how far the neighbours have drawn together in pairs and how much smaller one of each pair is: turned one way the top two touch and the bottom two touch, so four pieces are two, and turned the other way the middle two touch, so four pieces are three.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 162
// Round:   164
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Pair=-1..1, Small=0..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from amber.
// Knob 2: Size. The side of the squares, 10 LEDs at 0 to 17.5 LEDs at 3; its 2 is 15 LEDs. The gaps do not change with it, so the column is 104 LEDs tall at its 2.
// Knob 3: Pair. How far the neighbours have drawn together. At 0 the four stand evenly spaced. Turned up, the top two draw together and the bottom two draw together until each pair touches, and the knob stops there with two pieces on the panel. Turned down, the middle two draw together until they touch, and the knob stops there with three pieces. The squares draw in slowly while they are far apart and by a little over one LED a click for the last eight clicks before they touch; the last three clicks at either end hold the touching picture.
// Knob 4: Small. How much smaller the second square of the top pair and the second of the bottom pair are, the same size as the others at 0 and two fifths of the side at 1. It opens at 0.06.

const W = 64;
const H = 128;
// The column stands left of the middle, so the right of the panel is bare.
const CX = 22;
const CY = H / 2;
// The gap between neighbours when the four stand evenly spaced, in LEDs.
const G = 15;
// The Pair knob has 48 clicks over its range, 24 from its middle to either end. The last three clicks at each end hold the picture, so a pair has been touching since 22 clicks out.
const REACH = 22;
// In the last eight clicks before a pair touches, the gap closes this many LEDs a click.
const FAST = 1.1;
const NEAR = 8;

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

// The gap of the pair the knob is drawing together, for a knob a number of clicks from its middle. It is nothing for the last three clicks.
function pairGap(clicks) {
  const u = REACH - Math.abs(clicks);
  if (u <= 0) return 0;
  if (u <= NEAR) return FAST * u;
  return FAST * NEAR + ((G - FAST * NEAR) * (u - NEAR)) / (REACH - NEAR);
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.light = 1;
  params.size = new Float32Array(4);
  params.lo = new Float32Array(4);
  params.hi = new Float32Array(4);
  params.col = [new Float32Array(W), new Float32Array(W), new Float32Array(W), new Float32Array(W)];
  params.row = [new Float32Array(H), new Float32Array(H), new Float32Array(H), new Float32Array(H)];
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const side = 10 + 2.5 * clamp(k[1], 0, 3);
  const small = 1 - 0.6 * clamp(k[3], 0, 1);
  const size = params.size;
  size[0] = side;
  size[1] = side * small;
  size[2] = side;
  size[3] = side * small;
  const clicks = clamp(k[2], -1, 1) * 24;
  const gap = pairGap(clicks);
  // Turned up the top two and the bottom two draw together and the gap between the pairs takes what they leave, so the column keeps its length. Turned down the middle two draw together and the outer gaps share what is left.
  let g12 = gap;
  let g23 = 3 * G - 2 * gap;
  let g34 = gap;
  if (clicks < 0) {
    g23 = gap;
    g12 = g34 = (3 * G - gap) / 2;
  }
  const gaps = [g12, g23, g34, 0];
  let total = 0;
  for (let i = 0; i < 4; i++) total += size[i] + gaps[i];
  let y = CY - total / 2;
  for (let i = 0; i < 4; i++) {
    params.lo[i] = y;
    params.hi[i] = y + size[i];
    y += size[i] + gaps[i];
  }
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.85 + 0.15 * Math.sin(t * 0.61 + 1);
  hsv(k[0] + 0.12, 0.85, params.light, params.c);
}

export function draw(display, params, time) {
  const { size, lo, hi, col, row, c } = params;
  for (let i = 0; i < 4; i++) {
    for (let x = 0; x < W; x++) col[i][x] = span(CX - size[i] / 2, CX + size[i] / 2, x);
    for (let y = 0; y < H; y++) row[i][y] = span(lo[i], hi[i], y);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Squares that touch share the row between them and no LED holds more than one whole.
      const m = col[0][x] * row[0][y] + col[1][x] * row[1][y] + col[2][x] * row[2][y] + col[3][x] * row[3][y];
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
