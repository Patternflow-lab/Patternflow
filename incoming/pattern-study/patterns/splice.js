// ===== Patternflow pattern =====
// Title:   Splice
// Family:  geometry
// Idea:    Two thick upright lines of one width and one length stand side by side left of the middle of a bare dark ground and overlap along their whole length, each lit at half strength, and the four knobs are the colour, the width, how bright the strip they share is and how far apart they stand: the strip runs from dark to the two lights added together, and where it is as bright as one line the two edges inside are gone and the pair is one wider line.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 166
// Round:   168
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Width=0..3, Overlap=-36..12, Apart=0..1
//
// Knob 1: Hue. The colour of both lines, all the way round the wheel from mint.
// Knob 2: Width. The width of both lines, 10 LEDs at 0 to 22 LEDs at 3; its 2 is 18 LEDs. They stay 96 LEDs long.
// Knob 3: Overlap. How bright the strip the two lines share is, counted in clicks from where it opens. A line alone is lit at half strength. At the bottom of the knob the strip is dark and two thinner lines are left with a slit between them. At the top it is the two lights added, twice as bright as a line. It opens with the strip a little over half as bright again as a line. Twelve clicks down it is exactly as bright as a line, the two edges inside are gone and the pair is one wider line, and the knob holds that picture for three clicks. The first click past it either way moves the strip by a fifth of a line's light, so the edges are back at once.
// Knob 4: Apart. How far apart the two lines stand. Where it opens, a third of each line's width lies under the other, 6 LEDs of 18. Turned up, the lines draw apart until the strip is a ninth of a width.

const W = 64;
const H = 128;
// The pair stands left of the middle of the panel, so a strip on the right is bare. Both lines run from 16 LEDs below the top to 16 above the bottom.
const CX = 24;
const TOP = 16;
const BOTTOM = 112;
// Knob 3 is counted in clicks and the knob has 48 of them, 36 below where it opens and 12 above. Clicks -14, -13 and -12 are the picture with no edges inside.
const LOW = -36;
const HIGH = 12;
const HOLD = -14;
const HOLD_END = -12;
// One click either side of that picture the strip is this much of a line's light brighter or darker. At the dimmest of the breath that is 21 of the 255 steps an LED has, and five steps, an even share of the knob, left the edges too faint to see.
const STEP = 0.22;

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

// How bright the shared strip is, in lines' worth of light, for a knob this many clicks from where it opens: 0 at the bottom, 1 on the three held clicks, 2 at the top.
function shared(clicks) {
  if (clicks < HOLD) {
    const u = HOLD - clicks;
    return u <= 1 ? 1 - STEP * u : (1 - STEP) * (1 - (u - 1) / (HOLD - 1 - LOW));
  }
  if (clicks <= HOLD_END) return 1;
  const u = clicks - HOLD_END;
  return u <= 1 ? 1 + STEP * u : 1 + STEP + ((1 - STEP) * (u - 1)) / (HIGH - HOLD_END - 1);
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.width = 18;
  params.ax = 9;
  params.bx = 21;
  params.extra = -0.4;
  params.col = new Float32Array(W);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const width = 10 + 4 * clamp(k[1], 0, 3);
  // The second line stands two thirds of a width to the right where the knob opens, so a third of each lies under the other, and eight ninths of a width at the top of the knob.
  const dx = width * (2 / 3 + ((clamp(k[3], 0, 1) - 0.06) / 0.94) * (2 / 9));
  params.width = width;
  params.ax = CX - (width + dx) / 2;
  params.bx = params.ax + dx;
  // What the strip gets on top of the two lines' own light. Both lines are drawn everywhere they stand, so the strip starts at two lines' worth.
  params.extra = shared(clamp(k[2], LOW, HIGH)) - 2;
  // Nothing on the panel moves on the clock. Its light swells and falls, both lines and the strip together, so the panel is never quite still. A line is lit at half of that, which leaves room for two.
  const light = 0.88 + 0.12 * Math.sin(t * 0.63 - 0.1);
  hsv(k[0] + 0.44, 0.7, 0.5 * light, params.c);
}

export function draw(display, params, time) {
  const { width, ax, bx, extra, c, col } = params;
  // Both lines have the same top and bottom, so one number for each column is the whole picture.
  for (let x = 0; x < W; x++) col[x] = span(ax, ax + width, x) + span(bx, bx + width, x) + extra * span(bx, ax + width, x);
  for (let y = 0; y < H; y++) {
    const lit = y >= TOP && y < BOTTOM ? 1 : 0;
    for (let x = 0; x < W; x++) {
      const m = col[x] * lit;
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
