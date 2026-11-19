// ===== Patternflow pattern =====
// Title:   Concolor
// Family:  geometry
// Idea:    One square stands in the middle of a ground lit to the same brightness, and the four knobs are the colour, the size, how far round the colour wheel the ground's colour is from the square's, and how much darker the ground is: turned round to the same colour the square is gone into the ground, and the knob holds there for three clicks.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 179
// Round:   181
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Ground=-1..1, Dim=0.06..1
//
// Knob 1: Hue. The colour of the square, all the way round the wheel from rose; the ground's colour goes round with it.
// Knob 2: Size. The side of the square, 22 LEDs at 0 to 52 at 3; its 2 is 42. It stays in the middle of the panel.
// Knob 3: Ground. How far round the colour wheel the ground's colour stands from the square's, 7.5 degrees a click. At 0.625 it is the same colour and the square is gone; the knob holds there for three clicks (0.583 to 0.667). Below that the ground is turned back from the square's colour and above it turned on. Its 0 is 105 degrees back, fourteen clicks below the hold; at -1 it is 285 degrees back and at 1 it is 60 on.
// Knob 4: Dim. How much darker the ground is than the square: the same brightness at 0.06, where the knob opens, and 0.28 of it at 1. Dimmed, the square stays in view even where the colours are the same.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = H / 2;
// One click of a knob that has 48 clicks over -1..1. The place the knob holds at is a whole number of clicks from its middle, and it holds for the click either side as well.
const CLICK = 2 / 48;
const STOP = 15;
// The square and the ground are lit to this much of full, under half so the whole panel lit stays inside the current budget.
const LEVEL = 0.46;
const SAT = 0.85;
// The first colour: a rose, so the open ground comes out a blue.
const BASE = 0.93;

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

// How far round the wheel, in turns, the ground's colour stands from the square's for a knob at k: none for the three clicks at STOP, and from there a 48th of a turn for each click further, back below and on above, so every click turns the ground by the same 7.5 degrees.
function turn(k) {
  const d = k / CLICK - STOP;
  const run = Math.abs(d) - 1;
  if (run <= 1e-6) return 0;
  return (d < 0 ? -run : run) / 48;
}

export function setup(params) {
  params.t = 0;
  params.sq = new Float32Array(3);
  params.gr = new Float32Array(3);
  params.side = 42;
  params.cx = new Float32Array(W);
  params.cy = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  params.side = 22 + 10 * clamp(k[1], 0, 3);
  // The size and the place do not move on the clock. The colour wanders a few degrees, and the light swells and falls over the square and the ground together, so when the two are the same colour they stay the same colour.
  const hue = k[0] + BASE + 0.02 * Math.sin(t * 0.43);
  const light = LEVEL * (0.92 + 0.08 * Math.sin(t * 0.61 + 1));
  // The knob opens at its least, so the ground starts as bright as the square.
  const dim = (clamp(k[3], 0.06, 1) - 0.06) / 0.94;
  hsv(hue, SAT, light, params.sq);
  hsv(hue + turn(clamp(k[2], -1, 1)), SAT, light * (1 - 0.72 * dim), params.gr);
}

export function draw(display, params, time) {
  const { sq, gr, cx, cy } = params;
  const half = params.side / 2;
  for (let x = 0; x < W; x++) cx[x] = span(CX - half, CX + half, x);
  for (let y = 0; y < H; y++) cy[y] = span(CY - half, CY + half, y);
  const dr = sq[0] - gr[0];
  const dg = sq[1] - gr[1];
  const db = sq[2] - gr[2];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // The ground plus the difference scaled by how much of the LED the square covers: when the two colours are equal the difference is zero and the square is not there.
      const c = cx[x] * cy[y];
      display.setPixel(x, y, gr[0] + dr * c, gr[1] + dg * c, gr[2] + db * c);
    }
  }
}
