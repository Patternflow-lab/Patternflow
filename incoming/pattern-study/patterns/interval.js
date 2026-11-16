// ===== Patternflow pattern =====
// Title:   Interval
// Family:  geometry
// Idea:    A column of discs on a bare dark ground, and the four knobs are the colour, how many discs there are, how the gap between neighbours grows from the top of the column to the bottom, and how far the discs' size follows that growth: the gaps run from even to the narrowest one closing to nothing, where the two discs on that end touch at a point.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 153
// Round:   155
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=0..3, Ratio=-1..1, Follow=0..1
//
// Knob 1: Hue. The colour of the discs, all the way round the wheel from amber.
// Knob 2: Count. How many discs stand in the column, 3 at 0 to 7 at 3 as a whole number; its 2 is 6. The column always covers the same 112 LEDs, so more discs means narrower gaps.
// Knob 3: Ratio. How the gaps between neighbours change down the column, each gap wider than the one above it by the same step. At 0.375 the gaps are all the same and the knob holds there for three clicks. Turned up, the gaps narrow toward the bottom until, from 0.917, the lowest gap is 0 and the last two discs touch. Turned down, the gaps narrow toward the top until, at -0.917, the top two discs touch. Its 0 is a column whose top gap is 0.58 of the bottom one.
// Knob 4: Follow. How far each disc's size goes the way the gaps go, the big discs where the gaps are wide. At 0 every disc is 13 LEDs across. At 1 the size leans the way the gaps lean, twice as fast, until the big end is 1.85 times and the small end 0.15 times as wide; where the gaps are even it does nothing. Its 0.06 is nearly nothing.

const W = 64;
const H = 128;
const CX = W / 2;
// The column covers the same stretch of the panel whatever the knobs say, 8 LEDs in from the top to 8 LEDs in from the bottom.
const SPAN = 112;
const TOP = (H - SPAN) / 2;
// How wide each disc is when its size follows nothing.
const THICK = 13;
// How much of its own size a disc can lose or gain when the size follows the gaps all the way.
const SWAY = 0.85;
// One click of a knob that has 48 clicks over -1..1. The even place and the two ends of the ratio are whole clicks from the knob's middle.
const CLICK = 2 / 48;
const EVEN = 9 * CLICK;
const SHUT = 1 - 2 * CLICK;

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

// How far the gaps lean for a knob at k: 0 where they are all the same (held for three clicks at EVEN), 1 where the lowest gap has closed, -1 where the top one has. Each end holds for the last two clicks of the knob.
function lean(k) {
  const a0 = EVEN - CLICK;
  const a1 = EVEN + CLICK;
  if (k <= -SHUT) return -1;
  if (k <= a0) return -(a0 - k) / (a0 + SHUT);
  if (k <= a1) return 0;
  if (k <= SHUT) return (k - a1) / (SHUT - a1);
  return 1;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.n = 6;
  params.top = new Float32Array(7);
  params.thick = new Float32Array(7);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  let n = Math.round(3 + (4 * clamp(k[1], 0, 3)) / 3);
  n = n < 3 ? 3 : n > 7 ? 7 : n;
  params.n = n;
  const x = lean(clamp(k[2], -1, 1));
  // The size leans twice as fast as the gaps do and stops leaning at half way, so that it shows well before the gaps are far from even.
  const follow = SWAY * clamp(k[3], 0, 1) * clamp(2 * x, -1, 1);
  // The sizes lean one way and the gaps the same way, both in steps of the same size from one end of the column to the other, so what they add up to is the same whatever the knobs say.
  let sum = 0;
  for (let j = 0; j < n; j++) {
    const v = 1 - (2 * j) / (n - 1);
    params.thick[j] = THICK * (1 + follow * v);
    sum += params.thick[j];
  }
  const mean = (SPAN - sum) / (n - 1);
  let y = TOP;
  for (let j = 0; j < n; j++) {
    params.top[j] = y;
    const u = n > 2 ? 1 - (2 * j) / (n - 2) : 0;
    y += params.thick[j] + (j < n - 1 ? mean * (1 + x * u) : 0);
  }
  // Neither the gaps nor the discs move on the clock, so the gaps are even and the last gap shuts exactly where the knob says. The colour wanders a few degrees and the light swells and falls, all the discs together, only so the panel is never quite still.
  hsv(k[0] + 0.08 + 0.03 * Math.sin(t * 0.43), 0.9, 0.86 + 0.14 * Math.sin(t * 0.93 + 1), params.col);
}

export function draw(display, params, time) {
  const { n, top, thick, col } = params;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // A disc covers an LED by how far its rim is from the LED's middle, as a clamped half-LED ramp. Discs only touch, so an LED is covered by one of them or shared by two neighbours.
      let m = 0;
      for (let j = 0; j < n; j++) {
        const r = thick[j] / 2;
        const dy = y + 0.5 - (top[j] + r);
        if (dy > r + 1 || dy < -r - 1) continue;
        const dx = x + 0.5 - CX;
        let a = 0.5 - (Math.sqrt(dx * dx + dy * dy) - r);
        a = a < 0 ? 0 : a > 1 ? 1 : a;
        m += a;
      }
      m = m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
