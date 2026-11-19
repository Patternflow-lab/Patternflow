// ===== Patternflow pattern =====
// Title:   Tandem
// Family:  geometry
// Idea:    Two squares stand side by side with a gap between them on a bare dark panel and swing up and down, each on its own clock, and the four knobs are the colour, how fast the left one swings, how much faster or slower the right one swings and how far the right one sits below the left: where the two clocks run at the same pace the squares move as one body and the step between their tops never changes.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 177
// Round:   179
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0..3, Ratio=-35..13, Step=0..1
//
// Knob 1: Hue. The colour of both squares, all the way round the wheel from sky blue.
// Knob 2: Pace. How fast the left square swings: still at 0, once every 8 seconds at its 2, and every 5.3 seconds at 3.
// Knob 3: Ratio. How much faster the right square swings than the left, counted in clicks. At the bottom it takes 0.618 times the left one's pace and at the top 1.618 times, the golden ratio either way, with every click in between the same step on a log scale. The three clicks -12, -11 and -10 hold it at exactly the left one's pace: the two squares then swing as one, and the step between their tops stays what Step sets. The knob opens ten clicks above the hold, where the right square swings 1.233 times as fast and drifts away from the left one and back again. The click either side of the hold drifts it nearly 4 LEDs apart every swing, and turned back onto the hold it falls into step at once.
// Knob 4: Step. How far below the left square the right one hangs when the two keep the same pace: level at 0, 1.4 LEDs at 0.06 where the knob opens, and 24 LEDs at 1, past the bottom of the left square.

const W = 64;
const H = 128;
// Each square is 22 LEDs; the left one starts 6 columns in and the right one 8 columns after it.
const SIDE = 22;
const LEFT = 6;
const RIGHT = 36;
// The left square's top swings 30 LEDs either side of row 34, from row 4 to row 64.
const MID = 34;
const SWING = 30;
const STEP = 24;
// One swing of the left square takes 16 / Pace seconds.
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

// The right clock's pace over the left one's for a click of the Ratio knob.
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
  params.a = new Float32Array(H);
  params.b = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const r = ratioAt(clamp(k[2], -35, 13));
  const step = dt * RATE * clamp(k[1], 0, 3);
  params.turn += step;
  // The right square's clock is the left one's turn and what it has gained on it, the ratio less 1 of
  // every step. With the knobs left alone that is the left one's turn times the ratio. On the hold the
  // gain is cleared, so the two come back in step at the set Step instead of keeping whatever gap they
  // had, and a click off the hold starts the drift from there instead of jumping.
  params.gain = r === 1 ? 0 : params.gain + step * (r - 1);
  const y1 = MID + SWING * Math.sin(params.turn);
  const y2 = MID + STEP * clamp(k[3], 0, 1) + SWING * Math.sin(params.turn + params.gain);
  hsv(k[0] + 0.55, 0.8, 0.95, params.rgb);
  for (let y = 0; y < H; y++) {
    params.a[y] = span(y1, y1 + SIDE, y);
    params.b[y] = span(y2, y2 + SIDE, y);
  }
}

export function draw(display, params, time) {
  const { a, b, rgb } = params;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = x >= LEFT && x < LEFT + SIDE ? a[y] : x >= RIGHT && x < RIGHT + SIDE ? b[y] : 0;
      display.setPixel(x, y, rgb[0] * m, rgb[1] * m, rgb[2] * m);
    }
  }
}
