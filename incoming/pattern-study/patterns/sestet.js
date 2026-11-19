// ===== Patternflow pattern =====
// Title:   Sestet
// Family:  geometry
// Idea:    Six small squares stand in a row down the panel's diagonal on a bare dark ground, from the top right to the bottom left, evenly spaced, and the four knobs are the colour, how big the squares are, how the six are grouped and how far the top square stands off from its group: turned one way the neighbours slide along the diagonal in twos until each two touch, so six pieces are three, and turned the other way they slide together in threes, so six pieces are two.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 191
// Round:   193
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Group=-1..1, Loose=0.06..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from magenta.
// Knob 2: Size. The side of the squares, 4 LEDs at 0 to 10 LEDs at 3; its 2 is 8 LEDs. The top of the first square and the bottom of the last stay where they are, 108 LEDs apart, so bigger squares stand closer: each stands 12 LEDs below the one before it at its 2, and half as far to the left as it is down.
// Knob 3: Group. How the six are grouped. At 0 they stand evenly spaced. Turned down, the first and second slide together along the diagonal, the third and fourth, the fifth and sixth, until each two touch along half a side, and the knob stops there with three pieces on the panel. Turned up, the first three slide together and the last three, and the knob stops there with two pieces. The gaps between the groups take what the groups leave, so the row keeps its length. The gaps inside a group close slowly while they are wide and by a little over one LED a click for the last eight clicks; the last two clicks at either end hold the touching picture.
// Knob 4: Loose. How far the top square stands off from its group, not at all at the bottom of the knob, where it opens. Turned up, the gap below the top square is wider than the others by up to one and a half of the even gap and the five below close ranks to make the room. That gap never closes, so at the stops the top group is one square short: four pieces in twos, three in threes.

const W = 64;
const H = 128;
const N = 6;
// The row runs from the 10th row to the 118th whatever the size of the squares, and its first square has its right side on the 61st column.
const TOP = 10;
const BOTTOM = 118;
const RIGHT = 61;
// The Group knob has 48 clicks over its range, 24 from its middle to either end. The last two clicks at each end hold the picture, so the groups have been touching since 23 clicks out.
const REACH = 23;
// The last click closes 2.1 LEDs, so two whole rows of LEDs are dark inside a group until the click it closes. The seven clicks before it close 1.05 LEDs each.
const FIRST = 2.1;
const FAST = 1.05;
const NEAR = 8;
// The widest the Loose knob opens the gap below the top square, in even gaps.
const LOOSE = 1.5;

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

// The gap inside a group, measured down the panel, for a knob a number of clicks short of the click the groups touch. It is never wider than the gap the row rests at.
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
  params.side = 8;
  params.lo = new Float32Array(N);
  params.m = new Float32Array(W * H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const side = 4 + 2 * clamp(k[1], 0, 3);
  // The gap, measured down the panel, that spaces six squares evenly from TOP to BOTTOM.
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
    if (i === 0) g += loose;
    y += side + g;
  }
  params.side = side;
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  hsv(k[0] + 5 / 6, 0.85, 0.85 + 0.15 * Math.sin(params.t * 1.25), params.c);
}

export function draw(display, params, time) {
  const { lo, side, m, c } = params;
  m.fill(0);
  for (let i = 0; i < N; i++) {
    // A square stands half as far to the left of the first as it stands below it: the panel is twice as tall as it is wide.
    const top = lo[i];
    const right = RIGHT - (top - TOP) / 2;
    const left = right - side;
    const y1 = Math.min(H - 1, Math.floor(top + side));
    const x1 = Math.min(W - 1, Math.floor(right));
    for (let y = Math.max(0, Math.floor(top)); y <= y1; y++) {
      const v = span(top, top + side, y);
      if (v <= 0) continue;
      // Squares that touch share the row between them and no LED holds more than one whole.
      for (let x = Math.max(0, Math.floor(left)); x <= x1; x++) m[y * W + x] += v * span(left, right, x);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = m[y * W + x];
      display.setPixel(x, y, c[0] * v, c[1] * v, c[2] * v);
    }
  }
}
