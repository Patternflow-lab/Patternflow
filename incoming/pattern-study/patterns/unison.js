// ===== Patternflow pattern =====
// Title:   Unison
// Family:  geometry
// Idea:    One wide rectangle stands low on a bare dark panel and its top side and bottom side swing up and down, each on its own clock, so it stretches and squashes, and the four knobs are the colour, how fast the top side swings, how much faster or slower the bottom side swings and how tall the rectangle is when both keep the same pace: there the rectangle stops changing shape and moves up and down as one body.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 177
// Round:   179
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0..3, Ratio=-35..13, Height=0..1
//
// Knob 1: Hue. The colour of the rectangle, all the way round the wheel from yellow green.
// Knob 2: Pace. How fast the top side swings: still at 0, once every 8 seconds at its 2, and every 5.3 seconds at 3.
// Knob 3: Ratio. How much faster the bottom side swings than the top, counted in clicks. At the bottom it takes 0.618 times the top side's pace and at the top 1.618 times, the golden ratio either way, with every click in between the same step on a log scale. The three clicks -12, -11 and -10 hold it at exactly the top side's pace: the rectangle then keeps one height and moves up and down whole. The knob opens ten clicks above the hold, where the bottom side swings 1.233 times as fast and the rectangle stretches and squashes. The click either side of the hold changes its height by 1.6 LEDs more every swing, and turned back onto the hold it takes the set height at once.
// Knob 4: Height. How tall the rectangle is when both sides keep the same pace: 36 LEDs at 0, 38 at 0.06 where the knob opens, and 68 at 1. It is 52 LEDs wide, and each side swings 12 LEDs either way, so out of step it is never less than 12 LEDs tall.

const W = 64;
const H = 128;
// The rectangle is 52 LEDs wide and starts 6 columns in.
const LEFT = 6;
const WIDE = 52;
// The bottom side swings 12 LEDs either side of row 112, from row 100 to row 124.
const FLOOR = 112;
const SWING = 12;
const LOW = 36;
const HIGH = 68;
// One swing of the top side takes 16 / Pace seconds.
const RATE = (2 * Math.PI) / 16;
// Knob 3: the hold runs from HOLD_LO to HOLD_HI clicks, and 23 clicks each side of it reach the golden ratio.
const HOLD_LO = -12;
const HOLD_HI = -10;
const SIDE_CLICKS = 23;
const PHI = 1.6180339887;

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

// The bottom clock's pace over the top one's for a click of the Ratio knob.
function ratioAt(c) {
  let u = 0;
  if (c > HOLD_HI) u = (c - HOLD_HI) / SIDE_CLICKS;
  else if (c < HOLD_LO) u = (c - HOLD_LO) / SIDE_CLICKS;
  return Math.pow(PHI, u);
}

export function setup(params) {
  params.turn = 0;
  params.gain = 0;
  params.rgb = new Float32Array(3);
  params.cy = new Float32Array(H);
  params.cx = new Float32Array(W);
  for (let x = 0; x < W; x++) params.cx[x] = span(LEFT, LEFT + WIDE, x);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const r = ratioAt(clamp(k[2], -35, 13));
  const step = dt * RATE * clamp(k[1], 0, 3);
  params.turn += step;
  const tall = LOW + (HIGH - LOW) * clamp(k[3], 0, 1);
  // The bottom side's clock is the top side's turn and what it has gained on it, the ratio less 1 of
  // every step. With the knobs left alone that is the top side's turn times the ratio. On the hold the
  // gain is cleared, so the rectangle comes back to the set height instead of keeping whatever height
  // it had, and a click off the hold starts from there instead of jumping.
  params.gain = r === 1 ? 0 : params.gain + step * (r - 1);
  const top = FLOOR - tall + SWING * Math.sin(params.turn);
  const bottom = FLOOR + SWING * Math.sin(params.turn + params.gain);
  hsv(k[0] + 0.2, 0.8, 0.95, params.rgb);
  for (let y = 0; y < H; y++) params.cy[y] = span(top, bottom, y);
}

export function draw(display, params, time) {
  const { cx, cy, rgb } = params;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = cx[x] * cy[y];
      display.setPixel(x, y, rgb[0] * m, rgb[1] * m, rgb[2] * m);
    }
  }
}
