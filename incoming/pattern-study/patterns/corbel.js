// ===== Patternflow pattern =====
// Title:   Corbel
// Family:  geometry
// Idea:    Four short bars lie stacked with no gap in the upper part of a bare dark ground, each one a step to the right of the bar above it, and the four knobs are the colour, how many bars there are, how big the step between neighbours is and how much one step is out of line: at no step the stack is one plain block, and at a step of one bar's length the bars touch only at the corners and reach from wall to wall.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 171
// Round:   173
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=1..3, Step=-24..24, Kink=0.06..1
//
// Knob 1: Hue. The colour of the bars, all the way round the wheel from sky blue.
// Knob 2: Count. How many bars are in the stack, 3 at 1 to 5 at 3; its 2 is four. The bars are 8 LEDs thick and 20, 16 and 12 LEDs long for three, four and five, so a stack stepped by one length is 60, 64 and 60 LEDs wide and four reach from wall to wall.
// Knob 3: Step. How far each bar stands to the side of the bar above it, one click a step of the knob. The knob opens with each bar 9.45 LEDs right of the one above, so four bars overlap by 6.55 LEDs and the stack leans down to the right. Turned up the steps shrink more than a LED a click, and three clicks hold the stack as one block. On up each bar stands left of the one above, and the last three clicks hold the step at a bar's length, where the bars touch at the corners only and the stack spans the panel. Turned down from where it opens the steps grow a little.
// Knob 4: Kink. How much the step in the middle of the stack leans further than the others, from nothing where it opens to a whole bar's length at the top. Where it opens the stack of four breaks in two a little before halfway up the knob, and at every count and every step it stays between the walls.

const W = 64;
const H = 128;
// The bars are 8 LEDs thick and the top bar's top edge is 16 LEDs below the ceiling, so the stack hangs from there.
const T = 8;
const TOP = 16;
// The bars' length for three, four and five. Each is a whole even number of LEDs, so the block and the corner touch both fall on whole LEDs and no half-lit column joins two bars that touch at a corner.
const LENGTH = [20, 16, 12];
// The Step knob has 48 clicks over its range. KC are the clicks at the corners of the step, and the step in LEDs there comes from the bar's length in layout(): a minus step puts each bar right of the one above. The block holds for clicks 33 to 35 and the corner touch for 46 to 48, each two equal values in a row and the click after. The knob opens at click 24, nine clicks below the block, and the nine clicks between go at least 1.05 LEDs each. Between the holds a click goes a length over eleven, 1.45 LEDs for four bars.
const KC = [0, 24, 33, 35, 46, 48];
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

// The step in LEDs at each corner of KC, for bars of length len.
function layout(len) {
  const open = -Math.max(9.45, len / 2);
  return [open - 0.5, open, 0, 0, len, len];
}

function stepAt(c, kd) {
  for (let i = 1; i < KC.length; i++) {
    if (c <= KC[i]) return kd[i - 1] + ((kd[i] - kd[i - 1]) * (c - KC[i - 1])) / (KC[i] - KC[i - 1]);
  }
  return kd[kd.length - 1];
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.light = 1;
  params.n = 4;
  params.len = 16;
  params.top = TOP;
  params.left = new Float32Array(5);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = 2 + Math.round(clamp(k[1], 1, 3));
  const len = LENGTH[n - 3];
  params.n = n;
  params.len = len;
  const step = stepAt(clamp(k[2], STEP_LO, STEP_HI) - STEP_LO, layout(len));
  const kink = (len * (clamp(k[3], KINK_LO, 1) - KINK_LO)) / (1 - KINK_LO);
  // The kink sits on the step into the bar below the middle and leans the same way the stack leans where it opens.
  const p = Math.floor((n - 1) / 2);
  let x = 0;
  const left = params.left;
  for (let j = 0; j < n; j++) {
    if (j > 0) x -= step - (j === p + 1 ? kink : 0);
    left[j] = x;
  }
  // The stack is held so the top and bottom bars sit evenly about the middle of the panel.
  const mid = (left[0] + left[n - 1]) / 2;
  for (let j = 0; j < n; j++) left[j] += W / 2 - len / 2 - mid;
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.8 + 0.2 * Math.sin(t * 0.83 + 0.4);
  hsv(k[0] + 0.56, 0.75, params.light, params.c);
}

export function draw(display, params, time) {
  const { n, len, top, left, c } = params;
  for (let y = 0; y < H; y++) {
    const j = Math.floor((y - top) / T);
    if (j < 0 || j >= n) {
      for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
      continue;
    }
    const lo = left[j];
    for (let x = 0; x < W; x++) {
      const m = span(lo, lo + len, x);
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
