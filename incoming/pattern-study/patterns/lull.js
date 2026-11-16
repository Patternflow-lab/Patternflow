// ===== Patternflow pattern =====
// Title:   Lull
// Family:  geometry
// Idea:    Two upright lines of one width stand side by side with no gap on a bare dark ground, and the clock slowly turns the right line's colour round the wheel from the left one's and back, easing almost to a stop where the two are the same colour and the seam between them is gone, with the knobs for the first colour, how fast the clock runs, how far round the wheel it swings and how much darker the right line is.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 157; Twain (pattern round 158) with the clock turning its colour knob
// Round:   159
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0..3, Swing=-1..1, Dim=0.06..1
//
// Knob 1: Hue. The colour of the left line, all the way round the wheel from green.
// Knob 2: Pace. How fast the clock runs: nothing at 0, where the right line holds whatever colour it has, and a swing of about half a minute at its 2. Two clocks run at once, one 1.618 times as fast as the other, and no whole numbers divide that, so the colours never come back to the same sequence.
// Knob 3: Swing. How far round the wheel the right line's colour goes either side of the left one's: a quarter of the way to the opposite colour at -1, all the way to it at 1. Its 0 is a little over half. Both lines lose light as the colours part, three quarters of it at the opposite colours, so the pair is brightest, one wide line, whenever the clock passes the middle of the swing, and there it is slowest.
// Knob 4: Dim. How much darker the right line is than the left line: the same light at 0.06, where the knob opens, and a quarter of it at 1. Anything above 0.06 leaves a seam in the light when the colours meet.

const W = 64;
const H = 128;
const CX = W / 2;
// The lines run from the 12th row to the 116th, and each is 10 LEDs wide.
const TOP = 12;
const BOTTOM = H - 12;
const WIDTH = 10;
// How many radians a second the first clock runs at the knob's 1. The second runs PHI times as fast.
const RATE = 0.1;
const PHI = 1.6180339887;
// How hard the sum is bent towards 0: 1 would leave it alone, 2 would hold it nearly still there.
const DWELL = 1.6;

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

// Keeps the sign of s and raises its size to DWELL, so the value moves slowest where it is 0.
function bend(s) {
  return s < 0 ? -Math.pow(-s, DWELL) : Math.pow(s, DWELL);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// How much of the LED between p and p + 1 the span from lo to hi covers.
function span(lo, hi, p) {
  const v = (hi < p + 1 ? hi : p + 1) - (lo > p ? lo : p);
  return v < 0 ? 0 : v;
}

export function setup(params) {
  params.t = 0;
  // The clocks start part of the way through, so the right line opens a way round the wheel and turning back towards the left one's colour.
  params.pa = -1.4;
  params.pb = -1.0;
  params.a = new Float32Array(3);
  params.b = new Float32Array(3);
  params.ca = new Float32Array(W);
  params.cb = new Float32Array(W);
  params.ry = new Float32Array(H);
  for (let x = 0; x < W; x++) {
    params.ca[x] = span(CX - WIDTH, CX, x);
    params.cb[x] = span(CX, CX + WIDTH, x);
  }
  for (let y = 0; y < H; y++) params.ry[y] = span(TOP, BOTTOM, y);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const pace = clamp(k[1], 0, 3);
  params.pa += dt * RATE * pace;
  params.pb += dt * RATE * PHI * pace;
  // The two clocks added and scaled to -1..1. Bending it keeps the sign and makes it move slowest where it is 0, which is the middle of the swing.
  const s = (Math.sin(params.pa) + 0.6 * Math.sin(params.pb)) / 1.6;
  const swing = 0.25 + 0.75 * ((clamp(k[2], -1, 1) + 1) / 2);
  // Turns round the wheel: half a turn is the opposite colour, at the end of the swing.
  const turn = 0.5 * swing * bend(s);
  // The pair loses light as the colours part, three quarters of it at the opposite colours, and is brightest where they meet. Both lines lose the same, so it is only the colour that makes the seam.
  const away = Math.sin(Math.PI * turn);
  const lose = 1 - 0.75 * away * away;
  // The knob opens at its least, so the two start in the same light and the seam between them is only a change of colour.
  const dim = (clamp(k[3], 0.06, 1) - 0.06) / 0.94;
  const hue = k[0] + 0.3;
  hsv(hue, 0.85, 0.96 * lose, params.a);
  hsv(hue + turn, 0.85, 0.96 * lose * (1 - 0.75 * dim), params.b);
}

export function draw(display, params, time) {
  const { ca, cb, ry, a, b } = params;
  // The left line ends on the middle column line and the right one starts there, so no LED holds both colours.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ma = ca[x] * ry[y];
      const mb = cb[x] * ry[y];
      display.setPixel(x, y, a[0] * ma + b[0] * mb, a[1] * ma + b[1] * mb, a[2] * ma + b[2] * mb);
    }
  }
}
