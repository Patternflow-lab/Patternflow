// ===== Patternflow pattern =====
// Title:   Echelon
// Family:  geometry
// Idea:    Five squares stand side by side with no gap in the low part of a bare dark ground, each one step lower than the one on its left, and the four knobs are the colour, how many squares there are, how big the step between neighbours is and how much one step is out of line: at no step the row is one plain band, and at a step of one square the neighbours touch only at the corners, so one piece becomes five.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 171
// Round:   173
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=0..2, Step=-24..24, Kink=0.06..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from green.
// Knob 2: Count. How many squares stand in the row, 3 at 0 to 5 at 2, where it opens. Each is 12 LEDs on a side, so the row is 36 LEDs wide at three and 60 at five.
// Knob 3: Step. How far each square stands from the one on its left, one click a step of the knob. The knob opens with each square 8.6 LEDs lower than its left neighbour, so they overlap by 3.4 LEDs and the row climbs down to the right. Turned up the steps shrink a little over a LED a click, and three clicks hold the row level as one band. On up each square stands higher than the last, and the last three clicks hold the step at the squares' own side, 12 LEDs, where neighbours touch at the corners only. Turned down from where it opens the steps grow slowly and stop short of a whole side.
// Knob 4: Kink. How much the step in the middle of the row drops further than the others, from nothing where it opens to one whole side, 12 LEDs, at the top. Where it opens the row breaks in two a third of the way up the knob.

const W = 64;
const H = 128;
// The squares are 12 LEDs on a side and the row stands across the middle of the panel with its middle 84 LEDs down from the top.
const S = 12;
const CY = 84;
// The Step knob has 48 clicks over its range. KC are the clicks at the corners of the step and KD the step in LEDs there, a minus step putting each square lower than the one on its left. The level row holds for clicks 33 to 35 and the corner touch for 46 to 48, each two equal values in a row and the click after. Into the level hold the step goes 1.04 LEDs a click for eight clicks; between the holds it goes 1.09. The knob opens at click 24, nine clicks below the level hold.
const KC = [0, 24, 25, 33, 35, 46, 48];
const KD = [-10.2, -8.62, -8.32, 0, 0, S, S];
const STEP_LO = -24;
const STEP_HI = 24;
const KINK_LO = 0.06;

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

// The step in LEDs for a knob a number of clicks from its low end.
function stepAt(c) {
  for (let i = 1; i < KC.length; i++) {
    if (c <= KC[i]) return KD[i - 1] + ((KD[i] - KD[i - 1]) * (c - KC[i - 1])) / (KC[i] - KC[i - 1]);
  }
  return KD[KD.length - 1];
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.light = 1;
  params.n = 5;
  params.x0 = 2;
  params.top = new Float32Array(5);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = 3 + Math.round(clamp(k[1], 0, 2));
  params.n = n;
  params.x0 = (W - n * S) / 2;
  const step = stepAt(clamp(k[2], STEP_LO, STEP_HI) - STEP_LO);
  const kink = (S * (clamp(k[3], KINK_LO, 1) - KINK_LO)) / (1 - KINK_LO);
  // The kink sits on the step into the square right of the middle and drops the same way the row drops where it opens.
  const p = Math.floor((n - 1) / 2);
  // Heights go up the panel, so a step up is a smaller y. Each square's top is the one before it less the step.
  let y = 0;
  const top = params.top;
  for (let j = 0; j < n; j++) {
    if (j > 0) y -= step - (j === p + 1 ? kink : 0);
    top[j] = y;
  }
  // The row is held so the first and last squares sit evenly about the middle line.
  const mid = (top[0] + top[n - 1]) / 2;
  for (let j = 0; j < n; j++) top[j] += CY - S / 2 - mid;
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.82 + 0.18 * Math.sin(t * 0.83 + 1.1);
  hsv(k[0] + 0.33, 0.85, params.light, params.c);
}

export function draw(display, params, time) {
  const { n, x0, top, c } = params;
  for (let x = 0; x < W; x++) {
    const j = Math.floor((x - x0) / S);
    if (j < 0 || j >= n) {
      for (let y = 0; y < H; y++) display.setPixel(x, y, 0, 0, 0);
      continue;
    }
    const lo = top[j];
    for (let y = 0; y < H; y++) {
      const m = span(lo, lo + S, y);
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
