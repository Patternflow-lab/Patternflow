// ===== Patternflow pattern =====
// Title:   Defile
// Family:  geometry
// Idea:    A row of squares longer than the panel lies across the upper part of the dark, and one knob pushes it right through the frame: squares leave at the right wall cut and come in at the left cut, and the knob holds wherever the left square meets the left wall just as the right square meets the right wall, three whole squares and nothing cut.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 180
// Round:   182
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..5, Pass=-24..24, Widen=-1..1
//
// Knob 1: Hue. The colour of the squares, a pale tint all the way round the wheel from amber.
// Knob 2: Size. The squares' side, 14 LEDs at the bottom of the knob to 19 at the top. It opens at 16. The step from one square to the next is half of what the panel's width leaves after one square, so three squares always fill it exactly: 25 LEDs at 14, 24 at 16, 22.5 at 19.
// Knob 3: Pass. How far the row has been pushed right, counted in clicks, 18 clicks to the step. Where it opens the row is half a step off, a square cut at each wall. Turn either way and in 9 clicks the left square sits on the left wall and the right one on the right wall, held for three clicks; past that the next square comes in cut. The row goes 2.4 steps from the bottom of the knob to the top and every click moves it more than a LED.
// Knob 4: Widen. How unevenly the row is stepped. Where it opens the steps are even. Turn up and they go narrow, wide, narrow, wide along the row; turn down and wide, narrow. Each two add up to two even steps, so the holds stay where they are. At either end the narrow gap is 2 LEDs where the squares open, and the wide gap never grows enough for two squares to stand clear of both walls.

const W = 64;
const H = 128;
// The row's middle, a third of the way down.
const CY = 44;
// Steps from the left square to the right one when the row fits.
const K = 2;
// Clicks to a step, and the clicks the two holds start on.
const PER = 18;
const HOLD_A = 13;
const HOLD_B = 33;

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

// How many steps the row has gone at a click of the Pass knob. Whole numbers are the holds: clicks 13 to 15 hold at none, clicks 33 to 35 hold at one.
function phaseAt(q) {
  if (q <= HOLD_A) return (q - HOLD_A) / PER;
  if (q <= HOLD_A + 2) return 0;
  if (q <= HOLD_B) return (q - HOLD_A - 2) / PER;
  if (q <= HOLD_B + 2) return 1;
  return 1 + (q - HOLD_B - 2) / PER;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.s = 16;
  params.lefts = new Float32Array(8);
  params.count = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const s = 14 + clamp(k[1], 0, 5);
  const step = (W - s) / K;
  const gap = step - s;
  // The most the steps may part: the narrow gap keeps 2 LEDs, the narrow step keeps 19 LEDs so a click beside a hold still moves the row more than a LED, and the wide step stays 2 LEDs short of letting two whole squares stand clear of both walls, which takes a step of twice the side.
  const most = Math.min(0.75 * gap, gap - 2, step - 19, 2 * s - step - 2);
  // The knob opens at 0.06, and that is even. Up from there the steps part one way and down from there the other.
  const u = clamp(k[3], -1, 1) - 0.06;
  const e = (most * u) / (u > 0 ? 0.94 : 1.06);
  // The step after square i: narrow, wide, and again. Any two in a row add up to two even steps.
  const st = (i) => step + (i % 2 === 0 ? -e : e);
  // The left edge of square i, counted from square 0's.
  const at = (i) => {
    const whole = Math.floor(i / K);
    let p = whole * K * step;
    for (let j = whole * K; j < i; j++) p += st(j);
    return p;
  };
  const phase = phaseAt(clamp(k[2], -24, 24) + 24);
  // At a whole phase n, square -n sits on the left wall. In between the row slides by that square's step.
  const g = -phase;
  const i0 = Math.floor(g);
  const shift = -(at(i0) + (g - i0) * st(i0));
  let count = 0;
  for (let i = i0 - 2; i <= i0 + K + 3 && count < 8; i++) {
    const left = shift + at(i);
    if (left + s > 0 && left < W) params.lefts[count++] = left;
  }
  params.s = s;
  params.count = count;
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.12 + 0.02 * Math.sin(t * 0.37), 0.65, 0.84 + 0.16 * Math.sin(t * 0.9 + 0.7), params.col);
}

export function draw(display, params, time) {
  const { s, lefts, count, col } = params;
  const top = CY - s / 2;
  for (let y = 0; y < H; y++) {
    const my = span(top, top + s, y);
    for (let x = 0; x < W; x++) {
      let m = 0;
      if (my > 0) for (let c = 0; c < count; c++) m += span(lefts[c], lefts[c] + s, x);
      m = m > 1 ? my : m * my;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
