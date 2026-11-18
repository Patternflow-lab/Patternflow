// ===== Patternflow pattern =====
// Title:   Caesura
// Family:  geometry
// Idea:    A row of upright bars stands evenly across the middle of a bare dark panel and one gap opens between two neighbours and parts it into two groups, and the four knobs are the colour, how many bars there are, how wide the gap opens and where in the row it falls: the gap knob holds where the gap is exactly one cell wide and the row is a full row with one bar missing.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 154
// Round:   156
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=0..4, Gap=-1..1, Split=-1..1
//
// Knob 1: Hue. The colour of the bars, all the way round the wheel from sky blue.
// Knob 2: Count. How many bars there are, 3 at 0 to 7 at 4, rounded to a whole number; its 2 is 5. A cell, one bar and the room after it, gets narrower as the row gets longer: 14 LEDs across for 3 bars, 9 for 5, 7 for 7. A bar is 6 LEDs thick for 3 bars, 5 for 5 and 3 for 7, and 84 LEDs tall.
// Knob 3: Gap. How far the one gap opens, in LEDs across: no extra room between the two groups at -1, one cell at 0.25 and a cell and three quarters at 1. Each click opens it by a third of an LED or so, but at 0.25 the row is a full row of one more bar with one of them taken out, and the knob holds there for three clicks. Its 0 is five clicks short of that.
// Knob 4: Split. Where the gap falls, in whole bars: between the last two at -1, about the middle at 0 and between the first two (at the left end) at 1. With an odd count the middle is a bar off one way or the other; its 0.06 is that.

const W = 64;
const H = 128;
// One click of a knob that has 48 clicks over -1..1. The one-cell gap is six clicks from the knob's middle, and the knob holds for a click either side of it.
const CLICK = 2 / 48;
const STOP = 6 * CLICK;
// The room the row has across the panel at its widest, and how tall the bars stand.
const FIT = 60;
const LEN = 84;

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

// How wide the gap is, in LEDs along the row's own step, for a knob at c: none at -1, one cell exactly all through the held clicks, a cell and three quarters at 1. Between those it runs straight, so it is one cell nowhere else.
function gapAt(c, cell) {
  const a0 = STOP - CLICK;
  const a1 = STOP + CLICK;
  if (c >= a0 - 1e-6 && c <= a1 + 1e-6) return cell;
  if (c < a0) return (cell * (c + 1)) / (a0 + 1);
  return cell + (0.75 * cell * (c - a1)) / (1 - a1);
}

// A bar is about half a cell thick, and an odd or even number of LEDs as the row needs so that the full row, and with it the held click, lands on whole LEDs.
function widthFor(n, p) {
  const w = Math.round(p / 2);
  return (n * p + w) % 2 ? w - 1 : w;
}

// The biggest cell, as its whole number of LEDs across, that still lets the row open its gap all the way and stay on the panel.
function cellFor(n) {
  for (let p = 20; p > 3; p--) {
    if ((n - 1) * p + 1.75 * p + widthFor(n, p) <= FIT) return p;
  }
  return 3;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.m = new Float32Array(W);
  params.n = 5;
  params.p = 9;
  params.w = 5;
  params.g = 7;
  params.before = 2;
  params.x0 = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = clamp(Math.round(3 + clamp(k[1], 0, 4)), 3, 7);
  const p = cellFor(n);
  const w = widthFor(n, p);
  const g = gapAt(clamp(k[2], -1, 1), p);
  // How many bars stand to the left of the gap: half the row, a half-bar off the middle when the count is odd, and one more or one fewer for each step along the knob.
  const half = n / 2;
  params.n = n;
  params.p = p;
  params.w = w;
  params.g = g;
  params.before = clamp(Math.round(half - clamp(k[3], -1, 1) * (half - 1)), 1, n - 1);
  // The row is centred on the panel as a whole, the gap and all, so opening the gap moves the two groups apart.
  params.x0 = (W - ((n - 1) * p + g + w)) / 2;
  // Neither the bars' places nor the gap move on the clock, so the held click means exactly one cell. The colour wanders a few degrees and the light swells and falls, all the bars together, only so the panel is never quite still.
  hsv(k[0] + 0.55 + 0.03 * Math.sin(t * 0.43), 0.85, 0.88 + 0.12 * Math.sin(t * 0.61 + 1), params.col);
}

export function draw(display, params, time) {
  const { n, p, w, g, before, x0, col, m } = params;
  // How much of each column the bars cover: the one or two bars it touches, by the share of the LED each fills. Bars past the gap stand one gap further along.
  m.fill(0);
  for (let i = 0; i < n; i++) {
    const lo = x0 + i * p + (i >= before ? g : 0);
    for (let x = Math.max(0, Math.floor(lo)); x <= Math.min(W - 1, Math.floor(lo + w)); x++) m[x] += span(lo, lo + w, x);
  }
  const y0 = (H - LEN) / 2;
  for (let y = 0; y < H; y++) {
    const inside = y >= y0 && y < y0 + LEN ? 1 : 0;
    for (let x = 0; x < W; x++) {
      const v = (m[x] > 1 ? 1 : m[x]) * inside;
      display.setPixel(x, y, col[0] * v, col[1] * v, col[2] * v);
    }
  }
}
