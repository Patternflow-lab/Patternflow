// ===== Patternflow pattern =====
// Title:   Lacuna
// Family:  geometry
// Idea:    A row of squares stands evenly along the panel's diagonal, from the upper right to the lower left, on a bare dark panel and one gap opens between two neighbours and parts it into two groups, and the four knobs are the colour, how many squares there are, how wide the gap opens and where in the row it falls: the gap knob holds where the gap is exactly one cell wide and the row is a full row with one square missing.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 154
// Round:   156
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=0..4, Gap=-1..1, Split=-1..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from pink.
// Knob 2: Count. How many squares there are, 3 at 0 to 7 at 4, rounded to a whole number; its 2 is 5. A cell, one square and the room after it, is one step along the row of 1 LED across for every 2 down, and gets smaller as the row gets longer: 10 LEDs across and 20 down for 3, 8 and 16 for 5, 6 and 12 for 7. Each square is 18 LEDs on a side for 3, 14 for 5 and 10 for 7.
// Knob 3: Gap. How far the one gap opens, in LEDs across: no extra room between the two groups at -1, one cell at 0.25 and a cell and three quarters at 1. Each click opens it by a third of an LED or so, but at 0.25 the row is a full row of one more square with one of them taken out, and the knob holds there for three clicks. Its 0 is five clicks short of that.
// Knob 4: Split. Where the gap falls, in whole squares: between the last two at -1, about the middle at 0 and between the first two (at the upper end) at 1. With an odd count the middle is a square off one way or the other; its 0.06 is that.

const W = 64;
const H = 128;
// One click of a knob that has 48 clicks over -1..1. The one-cell gap is six clicks from the knob's middle, and the knob holds for a click either side of it.
const CLICK = 2 / 48;
const STOP = 6 * CLICK;
// The room the row has across and down the panel at its longest.
const FIT_X = 60;
const FIT_Y = 116;

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

// Square is an even number of LEDs across, so its middle is on a line between two LEDs and every square covers the LEDs the same way. It is 0.78 of the distance between two neighbours' middles, which are a cell apart: a LEDs across and 2a down.
function sizeFor(a) {
  return 2 * Math.round(0.87 * a);
}

// The biggest cell, as its whole number of LEDs across, that still lets the row open its gap all the way and stay on the panel.
function cellFor(n) {
  for (let a = 16; a > 2; a--) {
    const reach = (n - 1) * a + 1.75 * a;
    if (reach + sizeFor(a) <= FIT_X && 2 * reach + sizeFor(a) <= FIT_Y) return a;
  }
  return 2;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.m = new Float32Array(W * H);
  params.n = 5;
  params.a = 8;
  params.s = 14;
  params.g = 7;
  params.before = 2;
  params.x0 = 0;
  params.y0 = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = clamp(Math.round(3 + clamp(k[1], 0, 4)), 3, 7);
  const a = cellFor(n);
  const s = sizeFor(a);
  const g = gapAt(clamp(k[2], -1, 1), a);
  // How many squares stand before the gap, counting from the upper end: half the row, a half-square off the middle when the count is odd, and one more or one fewer for each step along the knob.
  const half = n / 2;
  params.n = n;
  params.a = a;
  params.s = s;
  params.g = g;
  params.before = clamp(Math.round(half - clamp(k[3], -1, 1) * (half - 1)), 1, n - 1);
  // The row is centred on the panel as a whole, the gap and all, so opening the gap moves the two groups apart.
  const reach = (n - 1) * a + g;
  params.x0 = (W - (reach + s)) / 2;
  params.y0 = (H - (2 * reach + s)) / 2;
  // Neither the squares' places nor the gap move on the clock, so the held click means exactly one cell. The colour wanders a few degrees and the light swells and falls, all the squares together, only so the panel is never quite still.
  hsv(k[0] + 0.88 + 0.03 * Math.sin(t * 0.43), 0.85, 0.88 + 0.12 * Math.sin(t * 0.61 + 1), params.col);
}

export function draw(display, params, time) {
  const { n, a, s, g, before, x0, y0, col, m } = params;
  m.fill(0);
  for (let i = 0; i < n; i++) {
    // How far along the row this square stands: a cell for each one before it, and the gap once it is past the gap. The row runs from the upper right to the lower left.
    const along = i * a + (i >= before ? g : 0);
    const left = W - (x0 + s + along);
    const top = y0 + 2 * along;
    const xa = Math.max(0, Math.floor(left));
    const xb = Math.min(W - 1, Math.floor(left + s));
    for (let y = Math.max(0, Math.floor(top)); y <= Math.min(H - 1, Math.floor(top + s)); y++) {
      const cover = span(top, top + s, y);
      for (let x = xa; x <= xb; x++) m[y * W + x] += cover * span(left, left + s, x);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = m[y * W + x];
      v = v > 1 ? 1 : v;
      display.setPixel(x, y, col[0] * v, col[1] * v, col[2] * v);
    }
  }
}
