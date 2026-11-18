// ===== Patternflow pattern =====
// Title:   Riser
// Family:  geometry
// Idea:    Five upright bars stand side by side with no gap down the middle of a bare dark ground, each one a step higher than the bar on its left, and the four knobs are the colour, how many bars there are, how big the step between neighbours is and how much one step is out of line: at no step the bars are one plain band, and at a step of one bar's height either way they touch only at the corners and run from floor to ceiling.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 171
// Round:   173
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=0..2, Step=-26..22, Kink=0.06..1
//
// Knob 1: Hue. The colour of the bars, all the way round the wheel from rose.
// Knob 2: Count. How many bars stand in the row, 3 at 0 to 5 at 2, where it opens. Each is 8 LEDs wide and 22 tall, so the row is 24 LEDs wide at three and 40 at five.
// Knob 3: Step. How far each bar stands above the bar on its left, one click a step of the knob. The knob opens with each bar 9.1 LEDs higher than its left neighbour, so both ends of the row climb to the right. Turned down the steps shrink, a little over a LED a click for the last eight clicks, and three clicks hold the bars level as one band. On down each bar stands lower than the last, and the first three clicks hold the step at a bar's height, 22 LEDs, where neighbours touch at the corners only. Turned up from where it opens the steps grow slowly and then a little over a LED a click, and the last three clicks hold the step at a bar's height the other way.
// Knob 4: Kink. How much the step in the middle of the row climbs further than the others, from nothing where it opens to 16 LEDs at the top.

const W = 64;
const H = 128;
// The bars are 8 LEDs wide and 22 tall, and the row's middle is the middle of the panel. A row of five stepped by one height is 110 LEDs tall, and with the kink at the top of its knob 126.
const BW = 8;
const BH = 22;
const CY = 64;
const KINK = 16;
// The Step knob has 48 clicks over its range. KC are the clicks at the corners of the step and KD the step in LEDs there, a plus step putting each bar higher than the one on its left. The corner touch below holds for clicks 0 to 2, the level band for 15 to 17 and the corner touch above for 46 to 48, each two equal values in a row and the click after. Between the first two holds a click goes 1.69 LEDs. The eight clicks after the band and the eight before the top go 1.1 LEDs each, and the thirteen between them 0.34. The knob opens at click 26, nine clicks above the band and twenty below the top.
const KC = [0, 2, 15, 17, 25, 38, 46, 48];
const KD = [-BH, -BH, 0, 0, 8.8, BH - 8.8, BH, BH];
const STEP_LO = -26;
const STEP_HI = 22;
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
  params.x0 = 12;
  params.top = new Float32Array(5);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = 3 + Math.round(clamp(k[1], 0, 2));
  params.n = n;
  params.x0 = (W - n * BW) / 2;
  const step = stepAt(clamp(k[2], STEP_LO, STEP_HI) - STEP_LO);
  const kink = (KINK * (clamp(k[3], KINK_LO, 1) - KINK_LO)) / (1 - KINK_LO);
  // The kink sits on the step into the bar right of the middle.
  const p = Math.floor((n - 1) / 2);
  // Heights go up the panel, so a step up is a smaller y.
  let y = 0;
  const top = params.top;
  for (let j = 0; j < n; j++) {
    if (j > 0) y -= step + (j === p + 1 ? kink : 0);
    top[j] = y;
  }
  // The row is held so the first and last bars sit evenly about the middle of the panel.
  const mid = (top[0] + top[n - 1]) / 2;
  for (let j = 0; j < n; j++) top[j] += CY - BH / 2 - mid;
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.82 + 0.18 * Math.sin(t * 0.83 + 2.3);
  hsv(k[0] + 0.93, 0.85, params.light, params.c);
}

export function draw(display, params, time) {
  const { n, x0, top, c } = params;
  for (let x = 0; x < W; x++) {
    const j = Math.floor((x - x0) / BW);
    if (j < 0 || j >= n) {
      for (let y = 0; y < H; y++) display.setPixel(x, y, 0, 0, 0);
      continue;
    }
    const lo = top[j];
    for (let y = 0; y < H; y++) {
      const m = span(lo, lo + BH, y);
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
