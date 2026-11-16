// ===== Patternflow pattern =====
// Title:   Twain
// Family:  geometry
// Idea:    Two upright lines of one width stand side by side with no gap on a bare dark ground, and the four knobs are the first colour, the width, how far round the colour wheel the right line's colour is from the first, and how much darker the right one is: turned round to the same colour the seam between them is gone and the pair is one wide line, and at the ends of the knob the two colours are opposite.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 156
// Round:   158
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Width=0..3, Turn=-1..1, Dim=0.06..1
//
// Knob 1: Hue. The colour of the left line, all the way round the wheel from green.
// Knob 2: Width. The width of both lines, 2 LEDs at 0 to 14 LEDs at 3; its 2 is 10 LEDs, so the pair stands 20 wide and 104 tall.
// Knob 3: Turn. How far round the colour wheel the right line's colour stands from the left one's. At -1 and at 1 it is half a turn, the opposite colour; moving the knob from -1 the right colour comes round to the left one, and at 0.375 it is the same colour and the knob holds there for three clicks, with the seam gone; past that it goes round the other way, back to the opposite colour at 1. Its 0 is 45 degrees short of the same colour.
// Knob 4: Dim. How much darker the right line is than the left line: the same light at 0.06, where the knob opens, and a quarter of it at 1.

const W = 64;
const H = 128;
const CX = W / 2;
// The lines run from the 12th row to the 116th.
const TOP = 12;
const BOTTOM = H - 12;
// One click of a knob that has 48 clicks over -1..1. The place the knob holds at is a whole number of clicks from its middle.
const CLICK = 2 / 48;
const SAME = 9 * CLICK;

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

// How far round the wheel, in turns, the second colour stands from the first for a knob at k: half a turn back at -1, none at SAME where it holds for three clicks, half a turn on at 1.
function turn(k) {
  const d = k - SAME;
  if (Math.abs(d) <= CLICK + 1e-6) return 0;
  if (d < 0) return (-0.5 * (-d - CLICK)) / (SAME + 1 - CLICK);
  return (0.5 * (d - CLICK)) / (1 - SAME - CLICK);
}

export function setup(params) {
  params.t = 0;
  params.a = new Float32Array(3);
  params.b = new Float32Array(3);
  params.width = 10;
  params.ca = new Float32Array(W);
  params.cb = new Float32Array(W);
  params.ry = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  params.width = 2 + 4 * clamp(k[1], 0, 3);
  // The width and the place of the lines do not move on the clock, so the seam stays where the colours change. The colour wanders a few degrees and the light swells and falls, both lines together, only so the panel is never quite still.
  const hue = k[0] + 0.3 + 0.03 * Math.sin(t * 0.43);
  const light = 0.92 + 0.08 * Math.sin(t * 0.61 + 1);
  // The knob opens at its least, so the two start in the same light and the seam between them is only a change of colour.
  const dim = (clamp(k[3], 0.06, 1) - 0.06) / 0.94;
  hsv(hue, 0.85, light, params.a);
  hsv(hue + turn(clamp(k[2], -1, 1)), 0.85, light * (1 - 0.75 * dim), params.b);
}

export function draw(display, params, time) {
  const w = params.width;
  const { ca, cb, ry, a, b } = params;
  // The left line ends on the middle column line and the right one starts there, so no LED holds both colours.
  for (let x = 0; x < W; x++) {
    ca[x] = span(CX - w, CX, x);
    cb[x] = span(CX, CX + w, x);
  }
  for (let y = 0; y < H; y++) ry[y] = span(TOP, BOTTOM, y);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ma = ca[x] * ry[y];
      const mb = cb[x] * ry[y];
      display.setPixel(x, y, a[0] * ma + b[0] * mb, a[1] * ma + b[1] * mb, a[2] * ma + b[2] * mb);
    }
  }
}
