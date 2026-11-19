// ===== Patternflow pattern =====
// Title:   Cortege
// Family:  geometry
// Idea:    A column of circles longer than the panel stands down the middle of the dark, and one knob pushes it down through the frame: circles leave at the bottom wall cut and come in at the top cut, and the knob holds wherever the top circle meets the top wall just as the bottom circle meets the bottom wall, four whole circles and nothing cut.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 180
// Round:   182
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Pass=-24..24, Widen=-1..1
//
// Knob 1: Hue. The colour of the circles, all the way round the wheel from azure.
// Knob 2: Size. The circles' diameter, 22 LEDs at the bottom of the knob to 28 at the top. It opens at 26. The step from one circle to the next is a third of what the panel's height leaves after one circle, so four circles always fill it exactly: 35.3 LEDs at 22, 34 at 26, 33.3 at 28.
// Knob 3: Pass. How far the column has been pushed down, counted in clicks, 18 clicks to the step. Where it opens the column is half a step off, a circle cut at each wall. Turn either way and in 9 clicks the top circle sits on the top wall and the bottom one on the bottom wall, held for three clicks; past that the next circle comes in cut. The column goes 2.4 steps from the bottom of the knob to the top and every click moves it more than a LED.
// Knob 4: Widen. How unevenly the column is stepped. Where it opens the steps are even. Turn up and they go narrow, even, wide, narrow, even, wide down the column; turn down and wide, even, narrow. Each three add up to three even steps, so the holds stay where they are. At either end the narrow gap is 2 LEDs where the circles open, and the wide gap never grows enough for three circles to stand clear of both walls.

const W = 64;
const H = 128;
const CX = 32;
// Steps from the top circle to the bottom one when the column fits.
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

// How many steps the column has gone at a click of the Pass knob. Whole numbers are the holds: clicks 13 to 15 hold at none, clicks 33 to 35 hold at one.
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
  params.d = 26;
  params.tops = new Float32Array(8);
  params.count = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const d = 22 + 2 * clamp(k[1], 0, 3);
  const step = (H - d) / K;
  const gap = step - d;
  // The most the steps may part: the narrow gap keeps 2 LEDs, and the wide step stays 2 LEDs short of letting three whole circles stand clear of both walls, which takes a step of twice the diameter.
  const most = Math.min(0.75 * gap, gap - 2, 2 * d - step - 2);
  // The knob opens at 0.06, and that is even. Up from there the steps part one way and down from there the other.
  const u = clamp(k[3], -1, 1) - 0.06;
  const e = (most * u) / (u > 0 ? 0.94 : 1.06);
  // The step after circle i: narrow, even, wide, and again. Any three in a row add up to three even steps.
  const st = (i) => step + e * ((((i % K) + K) % K) - 1);
  // The top edge of circle i, counted from circle 0's.
  const at = (i) => {
    const whole = Math.floor(i / K);
    let p = whole * K * step;
    for (let j = whole * K; j < i; j++) p += st(j);
    return p;
  };
  const phase = phaseAt(clamp(k[2], -24, 24) + 24);
  // At a whole phase n, circle -n sits on the top wall. In between the column slides by that circle's step.
  const g = -phase;
  const i0 = Math.floor(g);
  const shift = -(at(i0) + (g - i0) * st(i0));
  let count = 0;
  for (let i = i0 - 2; i <= i0 + K + 3 && count < 8; i++) {
    const top = shift + at(i);
    if (top + d > -1 && top < H + 1) params.tops[count++] = top;
  }
  params.d = d;
  params.count = count;
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.58 + 0.02 * Math.sin(t * 0.41), 0.75, 0.95 * (0.88 + 0.12 * Math.sin(t * 0.9 + 1.3)), params.col);
}

export function draw(display, params, time) {
  const { d, tops, count, col } = params;
  const r = d / 2;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    // At most two circles reach a row, where one ends and the next begins.
    let a = -1e9;
    let b = -1e9;
    for (let c = 0; c < count; c++) {
      if (py > tops[c] - 1 && py < tops[c] + d + 1) {
        if (a < -1e8) a = tops[c] + r;
        else b = tops[c] + r;
      }
    }
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX;
      const m = clamp(r - Math.min(Math.hypot(dx, py - a), Math.hypot(dx, py - b)) + 0.5, 0, 1);
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
