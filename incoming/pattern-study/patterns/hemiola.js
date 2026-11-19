// ===== Patternflow pattern =====
// Title:   Hemiola
// Family:  geometry
// Idea:    Six squares stand in a column right of the middle of a bare dark ground, evenly spaced from near the ceiling to near the floor, and the four knobs are the colour, how big the squares are, how the six are grouped and how far the bottom square stands off from its group: turned one way the neighbours draw together in twos until each two touch, so six pieces are three, and turned the other way they draw together in threes, so six pieces are two.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 191
// Round:   193
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Group=-1..1, Loose=0.06..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from cyan.
// Knob 2: Size. The side of the squares, 5 LEDs at 0 to 11 LEDs at 3; its 2 is 9 LEDs. The top of the first square and the bottom of the last stay where they are, 124 LEDs apart, so bigger squares stand closer: the gap is 14 LEDs at its 2.
// Knob 3: Group. How the six are grouped. At 0 they stand evenly spaced. Turned down, the first and second draw together, the third and fourth, the fifth and sixth, until each two touch, and the knob stops there with three pieces on the panel. Turned up, the first three draw together and the last three, and the knob stops there with two pieces. The gaps between the groups take what the groups leave, so the column keeps its length. The gaps inside a group close slowly while they are wide and by a little over one LED a click for the last eight clicks; the last two clicks at either end hold the touching picture.
// Knob 4: Loose. How far the bottom square stands off from its group, not at all at the bottom of the knob, where it opens. Turned up, the gap above the bottom square is wider than the others by up to one and a quarter of the even gap and the five above close ranks to make the room. That gap never closes, so at the stops the bottom group is one square short: four pieces in twos, three in threes.

const W = 64;
const H = 128;
const N = 6;
// The column runs from the 2nd row to the 126th whatever the size of the squares.
const TOP = 2;
const BOTTOM = 126;
// The column stands right of the panel's middle.
const CX = 41.5;
// The Group knob has 48 clicks over its range, 24 from its middle to either end. The last two clicks at each end hold the picture, so the groups have been touching since 23 clicks out.
const REACH = 23;
// The last click closes 2.1 LEDs, so two whole rows of LEDs are dark inside a group until the click it closes. The seven clicks before it close 1.05 LEDs each.
const FIRST = 2.1;
const FAST = 1.05;
const NEAR = 8;
// The widest the Loose knob opens the gap above the bottom square, in even gaps.
const LOOSE = 1.25;

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

// The gap inside a group, for a knob a number of clicks short of the click the groups touch. It is never wider than the gap the column rests at.
function inGap(short, rest) {
  if (short <= 0) return 0;
  let gap;
  if (short <= 1) gap = FIRST * short;
  else if (short <= NEAR) gap = FIRST + FAST * (short - 1);
  else {
    const near = FIRST + FAST * (NEAR - 1);
    gap = near + ((rest - near) * (short - NEAR)) / (REACH - NEAR);
  }
  return gap < rest ? gap : rest;
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.side = 9;
  params.lo = new Float32Array(N);
  params.col = new Float32Array(W);
  params.row = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const side = 5 + 2 * clamp(k[1], 0, 3);
  // The gap that spaces six squares evenly from TOP to BOTTOM.
  const even = (BOTTOM - TOP - N * side) / (N - 1);
  const loose = ((clamp(k[3], 0.06, 1) - 0.06) / 0.94) * LOOSE * even;
  // The loose gap takes its room from the other four, a fifth each.
  const rest = even - loose / (N - 1);
  const clicks = clamp(k[2], -1, 1) * 24;
  const gap = inGap(REACH - Math.abs(clicks), rest);
  const room = (N - 1) * even - loose;
  // In twos the first, third and fifth gaps close and the second and fourth share what is left. In threes all but the third close and the third takes what is left.
  const between = clicks < 0 ? (room - 3 * gap) / 2 : room - 4 * gap;
  let y = TOP;
  for (let i = 0; i < N; i++) {
    params.lo[i] = y;
    let g = gap;
    if (clicks < 0 ? i === 1 || i === 3 : i === 2) g = between;
    if (i === N - 2) g += loose;
    y += side + g;
  }
  params.side = side;
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  hsv(k[0] + 0.5, 0.85, 0.86 + 0.14 * Math.sin(params.t * 1.1 + 0.4), params.c);
}

export function draw(display, params, time) {
  const { lo, side, col, row, c } = params;
  for (let x = 0; x < W; x++) col[x] = span(CX - side / 2, CX + side / 2, x);
  // Squares that touch share the row between them and no LED holds more than one whole.
  for (let y = 0; y < H; y++) {
    let v = 0;
    for (let i = 0; i < N; i++) v += span(lo[i], lo[i] + side, y);
    row[y] = v;
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = col[x] * row[y];
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
