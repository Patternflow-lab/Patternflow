// ===== Patternflow pattern =====
// Title:   Runnel
// Family:  geometry
// Idea:    A dashed upright line runs from the ceiling to the floor close by the left wall of a bare dark panel and its dashes flow down it, and the four knobs are the colour, how fast they flow, how wide the gaps between them are and how much every other dash is longer than its neighbours: turned to its top end, the gaps shut, the dashes join into one line from wall to wall and the flow can no longer be seen.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 169
// Round:   171
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0..3, Close=-36..12, Uneven=0..1
//
// Knob 1: Hue. The colour of the line, all the way round the wheel from cyan.
// Knob 2: Pace. How fast the dashes flow down: still at 0, about 12 LEDs a second at its 2. A slow clock speeds them up and holds them back by up to half, and a second clock 1.618 times as fast as the first is added to it, so the flow never settles into one beat.
// Knob 3: Close. How wide the gaps between the dashes are, counted in clicks. Each dash and the gap after it take 40 LEDs whatever the knob does. At -36 the gaps are 36 LEDs and the dashes 4; the knob opens at 0 with gaps of 15.2. From 2 every click shuts 1.75 LEDs, and at 10 the gaps are gone: the dashes are one line from the ceiling to the floor and nothing on the panel moves. The knob holds there for the three clicks 10, 11 and 12.
// Knob 4: Uneven. How much every other dash is longer than the dash after it, each dash keeping its middle and every gap its width: none at 0, 5 per cent either way at 0.06 where the knob opens, and at 1 the long dashes are 1.9 times the even length and the short ones a tenth of it.

const W = 64;
const H = 128;
// The line stands 6 LEDs off the left wall and is 8 LEDs wide.
const LEFT = 6;
const WIDE = 8;
// One dash and the gap after it, in LEDs along the line.
const STEP = 40;
// The Close knob, in clicks. The gaps are shut from SHUT to the top end, and the eight clicks before SHUT each shut NEAR LEDs.
const SHUT = 10;
const NEAR = 1.75;
const LOW = -36;
// The widest gap, at the bottom of the knob, leaves a dash of 4 LEDs.
const WIDEST = STEP - 4;
// How many LEDs a second the dashes flow at a Pace of 1, and how fast the slow clocks run there, in radians a second. The second clock runs PHI times as fast as the first.
const SPEED = 6;
const RATE = 0.1;
const PHI = 1.6180339887;
// How much of the speed the slow clocks take and give back.
const SWAY = 0.5;
const UNEVEN = 0.9;

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

// The gap between dashes for a click of the Close knob.
function gapAt(c) {
  if (c >= SHUT) return 0;
  const near = SHUT - 8;
  if (c >= near) return NEAR * (SHUT - c);
  return NEAR * 8 + ((near - c) * (WIDEST - NEAR * 8)) / (near - LOW);
}

// How much of the line from 0 to x is lit, for dashes a and b with a gap g after each; the pattern repeats every 2 * STEP.
function lit(x, a, b, g) {
  const P = 2 * STEP;
  const n = Math.floor(x / P);
  const r = x - n * P;
  let v;
  if (r < a) v = r;
  else if (r < a + g) v = a;
  else if (r < a + g + b) v = r - g;
  else v = a + b;
  return n * (a + b) + v;
}

export function setup(params) {
  params.flow = 0;
  params.pa = 0;
  params.pb = 0;
  params.rgb = new Float32Array(3);
  params.cx = new Float32Array(W);
  for (let x = 0; x < W; x++) params.cx[x] = span(LEFT, LEFT + WIDE, x);
  params.cy = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const pace = clamp(k[1], 0, 3);
  params.pa += dt * RATE * pace;
  params.pb += dt * RATE * PHI * pace;
  const sway = 1 + (SWAY * (Math.sin(params.pa) + 0.6 * Math.sin(params.pb))) / 1.6;
  params.flow += dt * SPEED * pace * sway;
  const g = gapAt(clamp(k[2], LOW, 12));
  const dash = STEP - g;
  const u = UNEVEN * clamp(k[3], 0, 1);
  const a = dash * (1 + u);
  const b = dash * (1 - u);
  // Each dash keeps its middle where it was, so both gaps beside a long dash move along by half of what it gained.
  const o = (a - dash) / 2;
  hsv(k[0] + 0.5, 0.85, 0.96, params.rgb);
  // The dashes flow down: an LED at row y shows the pattern at y less the distance flowed.
  const { cy, flow } = params;
  for (let y = 0; y < H; y++) {
    const x = y - flow + o;
    cy[y] = lit(x + 1, a, b, g) - lit(x, a, b, g);
  }
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
