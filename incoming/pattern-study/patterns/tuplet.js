// ===== Patternflow pattern =====
// Title:   Tuplet
// Family:  geometry
// Idea:    Six upright bars stand side by side from wall to wall across the top of a bare dark ground, evenly spaced, and the four knobs are the colour, how tall the bars are, how the six are grouped and how far the right bar stands off from its group: turned one way the neighbours draw together in twos until each two touch, so six pieces are three, and turned the other way they draw together in threes, so six pieces are two.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 191
// Round:   193
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tall=0..3, Group=-1..1, Loose=0.06..1
//
// Knob 1: Hue. The colour of the bars, all the way round the wheel from yellow.
// Knob 2: Tall. How tall the bars are, 24 LEDs at 0 to 60 LEDs at 3; its 2 is 48 LEDs. Their tops stay on the 12th row and they grow downward. The bars are 4 LEDs thick whatever the knob says, and the first has its left side on the left wall and the last its right side on the right wall.
// Knob 3: Group. How the six are grouped. At 0 they stand evenly spaced, 8 LEDs apart. Turned down, the first and second draw together, the third and fourth, the fifth and sixth, until each two touch, and the knob stops there with three pieces on the panel. Turned up, the first three draw together and the last three, and the knob stops there with two pieces. The gaps between the groups take what the groups leave, so the row keeps its width. The gaps inside a group close by a little over a quarter of an LED a click, and the last click closes 2.1 LEDs at once; the last two clicks at either end hold the touching picture.
// Knob 4: Loose. How far the right bar stands off from its group, not at all at the bottom of the knob, where it opens. Turned up, the gap on its left is wider than the others by up to 10 LEDs and the five on the left close ranks to make the room. That gap never closes, so at the stops the right group is one bar short: four pieces in twos, three in threes.

const W = 64;
const H = 128;
const N = 6;
// The bars are 4 LEDs thick and their tops are on the 12th row.
const THICK = 4;
const TOP = 12;
// The gap that spaces six bars evenly from wall to wall.
const EVEN = (W - N * THICK) / (N - 1);
// The Group knob has 48 clicks over its range, 24 from its middle to either end. The last two clicks at each end hold the picture, so the groups have been touching since 23 clicks out.
const REACH = 23;
// The last click closes 2.1 LEDs, so two whole columns of LEDs are dark inside a group until the click it closes. Six bars leave 8 LEDs to a gap on a panel 64 LEDs wide, so the clicks before it share the 5.9 LEDs that are left.
const FIRST = 2.1;
// The widest the Loose knob opens the gap on the left of the right bar, in even gaps.
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

// The gap inside a group, for a knob a number of clicks short of the click the groups touch. It is never wider than the gap the row rests at.
function inGap(short, rest) {
  if (short <= 0) return 0;
  if (short <= 1) return (rest < FIRST ? rest : FIRST) * short;
  if (rest <= FIRST) return rest;
  return FIRST + ((rest - FIRST) * (short - 1)) / (REACH - 1);
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.tall = 48;
  params.lo = new Float32Array(N);
  params.col = new Float32Array(W);
  params.row = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  params.tall = 24 + 12 * clamp(k[1], 0, 3);
  const loose = ((clamp(k[3], 0.06, 1) - 0.06) / 0.94) * LOOSE * EVEN;
  // The loose gap takes its room from the other four, a fifth each.
  const rest = EVEN - loose / (N - 1);
  const clicks = clamp(k[2], -1, 1) * 24;
  const gap = inGap(REACH - Math.abs(clicks), rest);
  const room = (N - 1) * EVEN - loose;
  // In twos the first, third and fifth gaps close and the second and fourth share what is left. In threes all but the third close and the third takes what is left.
  const between = clicks < 0 ? (room - 3 * gap) / 2 : room - 4 * gap;
  let x = 0;
  for (let i = 0; i < N; i++) {
    params.lo[i] = x;
    let g = gap;
    if (clicks < 0 ? i === 1 || i === 3 : i === 2) g = between;
    if (i === N - 2) g += loose;
    x += THICK + g;
  }
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  hsv(k[0] + 1 / 6, 0.85, 0.88 + 0.12 * Math.sin(params.t * 0.71 + 1), params.c);
}

export function draw(display, params, time) {
  const { lo, tall, col, row, c } = params;
  // Bars that touch share the column between them and no LED holds more than one whole.
  for (let x = 0; x < W; x++) {
    let v = 0;
    for (let i = 0; i < N; i++) v += span(lo[i], lo[i] + THICK, x);
    col[x] = v;
  }
  for (let y = 0; y < H; y++) row[y] = span(TOP, TOP + tall, y);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = col[x] * row[y];
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
