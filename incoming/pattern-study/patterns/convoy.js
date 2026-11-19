// ===== Patternflow pattern =====
// Title:   Convoy
// Family:  geometry
// Idea:    A row of squares longer than the panel runs down the panel's diagonal from the top left corner to the bottom right, and one knob pushes it along: squares leave through the bottom right corner cut and come in at the top left cut, and the knob holds wherever the first square meets the left wall just as the last meets the right wall, four whole squares and nothing cut.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 180
// Round:   182
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Pass=-24..24, Widen=-1..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from green.
// Knob 2: Size. The squares' side, 12.5 LEDs at the bottom of the knob to 18.5 at the top. It opens at 16.5. The squares' middles sit on the line from corner to corner, 1 LED across for every 2 down, and the step across from one to the next is a third of what the panel's width leaves after one square, so four squares always reach from wall to wall: 17.2 LEDs across at 12.5, 15.8 at 16.5, 15.2 at 18.5.
// Knob 3: Pass. How far the row has been pushed down the diagonal, counted in clicks, 18 clicks to the step. Where it opens the row is half a step off, a square cut in each corner. Turn either way and in 9 clicks the first square sits on the left wall and the last on the right wall, held for three clicks; past that the next square comes in cut. The row goes 2.4 steps from the bottom of the knob to the top and every click moves it more than a LED down the diagonal, more than half a LED across.
// Knob 4: Widen. How unevenly the row is stepped. Where it opens the steps are even. Turn up and they go narrow, even, wide along the row; turn down and wide, even, narrow. Each three add up to three even steps, so the holds stay where they are. At either end the narrowest still keeps the square past each end out of the corner at a hold.

const W = 64;
const H = 128;
// Steps from the first square to the last when the row fits.
const K = 3;
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
  params.lefts = new Float32Array(10);
  params.count = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const s = 12.5 + 2 * clamp(k[1], 0, 3);
  const step = (W - s) / K;
  // The most the steps may part. A square past either end is out of the frame at a hold only if its step across is at least three quarters of the side: it leaves by the corner, so the top wall hides it before the side wall would. The narrowest step keeps half a LED more than that, and the widest stays a LED short of letting three whole squares stand clear of the corners, which takes a step of one and a half sides.
  const most = Math.min(step - 0.75 * s - 0.5, 1.5 * s - step - 1);
  // The knob opens at 0.06, and that is even. Up from there the steps part one way and down from there the other.
  const u = clamp(k[3], -1, 1) - 0.06;
  const e = (most * u) / (u > 0 ? 0.94 : 1.06);
  // The step across after square i: narrow, even, wide, and again. Any three in a row add up to three even steps.
  const st = (i) => step + e * ((((i % K) + K) % K) - 1);
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
  for (let i = i0 - 2; i <= i0 + K + 3 && count < 10; i++) {
    const left = shift + at(i);
    // A square's middle is on the diagonal, twice as far down as across.
    const top = 2 * (left + s / 2) - s / 2;
    if (left + s > 0 && left < W && top + s > 0 && top < H) params.lefts[count++] = left;
  }
  params.s = s;
  params.count = count;
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.36 + 0.02 * Math.sin(t * 0.43), 0.75, 0.95 * (0.86 + 0.14 * Math.sin(t * 0.9 + 2.1)), params.col);
}

export function draw(display, params, time) {
  const { s, lefts, count, col } = params;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 0;
      for (let c = 0; c < count; c++) {
        const left = lefts[c];
        const top = 2 * left + s / 2;
        const my = span(top, top + s, y);
        if (my > 0) m += my * span(left, left + s, x);
      }
      if (m > 1) m = 1;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
