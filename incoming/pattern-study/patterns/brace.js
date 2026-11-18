// ===== Patternflow pattern =====
// Title:   Brace
// Family:  geometry
// Idea:    Four upright lines stand side by side low on a bare dark ground, evenly spaced, and the four knobs are the colour, how thick the lines are, how far the neighbours have drawn together in pairs and how much thinner one of each pair is: turned one way the left two touch and the right two touch, so four lines are two, and turned the other way the middle two touch, so four lines are three.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 162
// Round:   164
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Thick=0..3, Pair=-1..1, Thin=0.06..1
//
// Knob 1: Hue. The colour of the lines, all the way round the wheel from violet.
// Knob 2: Thick. How thick the lines are, 3.5 LEDs at 0 to 5.75 LEDs at 3; its 2 is 5 LEDs. The lines are 72 LEDs tall and the gaps do not change with it, so the four stand 56 LEDs wide at its 2.
// Knob 3: Pair. How far the neighbours have drawn together. At 0 the four stand evenly spaced. Turned up, the left two draw together and the right two draw together until each pair touches, and the knob stops there with two pieces on the panel. Turned down, the middle two draw together until they touch, and the knob stops there with three pieces. The lines draw in slowly while they are far apart and by a little over one LED a click for the last eight clicks before they touch; the last three clicks at either end hold the touching picture.
// Knob 4: Thin. How much thinner the first line of the left pair and the first of the right pair are, the same as the others at the bottom of the knob, where it opens, and two fifths as thick at 1.

const W = 64;
const H = 128;
const CX = W / 2;
// The lines stand low: they run from the 50th row to the 122nd, so the top of the panel is bare.
const TOP = 50;
const BOTTOM = 122;
// The gap between neighbours when the four stand evenly spaced, in LEDs.
const G = 12;
// The Pair knob has 48 clicks over its range, 24 from its middle to either end. The last three clicks at each end hold the picture, so a pair has been touching since 22 clicks out.
const REACH = 22;
// In the last eight clicks before a pair touches the gap closes a little over one LED a click. The very last click closes 2.1 LEDs, so a whole row of LEDs is dark between the two and they count as two pieces until the click they touch.
const FIRST = 2.1;
const FAST = 1.05;
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
  if (u <= 1) return FIRST * u;
  const near = FIRST + FAST * (NEAR - 1);
  if (u <= NEAR) return FIRST + FAST * (u - 1);
  return near + ((G - near) * (u - NEAR)) / (REACH - NEAR);
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.light = 1;
  params.lo = new Float32Array(4);
  params.hi = new Float32Array(4);
  params.col = new Float32Array(W);
  params.row = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const thick = 3.5 + 0.75 * clamp(k[1], 0, 3);
  const thin = 1 - 0.6 * ((clamp(k[3], 0.06, 1) - 0.06) / 0.94);
  const size = [thick * thin, thick, thick * thin, thick];
  const clicks = clamp(k[2], -1, 1) * 24;
  const gap = pairGap(clicks);
  // Turned up the left two and the right two draw together and the gap between the pairs takes what they leave, so the row keeps its width. Turned down the middle two draw together and the outer gaps share what is left.
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
  let x = CX - total / 2;
  for (let i = 0; i < 4; i++) {
    params.lo[i] = x;
    params.hi[i] = x + size[i];
    x += size[i] + gaps[i];
  }
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.85 + 0.15 * Math.sin(t * 0.61 + 1);
  hsv(k[0] + 0.78, 0.85, params.light, params.c);
}

export function draw(display, params, time) {
  const { lo, hi, col, row, c } = params;
  // Lines that touch share the column between them and no LED holds more than one whole.
  for (let x = 0; x < W; x++) col[x] = span(lo[0], hi[0], x) + span(lo[1], hi[1], x) + span(lo[2], hi[2], x) + span(lo[3], hi[3], x);
  for (let y = 0; y < H; y++) row[y] = span(TOP, BOTTOM, y);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = col[x] * row[y];
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
