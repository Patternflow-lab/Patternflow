// ===== Patternflow pattern =====
// Title:   Stagger
// Family:  geometry
// Idea:    A row of upright rectangles stands side by side across the low part of a bare dark ground with no gap between them, and the four knobs are the colour, how many share the row, how far one of them has risen out of the row and which one it is: at no rise the row is one plain band, and at a rise of one rectangle's height the moved one touches its neighbours only at the corners, so one piece becomes three.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 165
// Round:   167
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=0..4, Rise=-0.9..0.1, Which=0..1
//
// Knob 1: Hue. The colour of the rectangles, all the way round the wheel from violet.
// Knob 2: Count. How many rectangles share the row, 3 at 0 to 7 at 4; its 2 is five. The row stays 60 LEDs wide and 24 tall, so each is 20 LEDs wide at three and 8 at seven. Its 2 is 12 LEDs.
// Knob 3: Rise. How far the chosen rectangle has risen out of the row. The knob opens with it 35 LEDs up, standing clear of the row. Turned down it comes in and the three clicks at its own height, 24 LEDs, hold it touching its neighbours at the corners only. Turned on down it overlaps them and the steps above and below it shrink until, after three more clicks that hold it, it sits in line and the row is a plain band. Past that it sinks below the row and holds again at one height. The row sits with its bottom edge 24 LEDs above the floor, so at the bottom of the knob the rectangle stands on the floor.
// Knob 4: Which. Which rectangle rises, counted from the left: the first at the bottom of the knob and the last at the top of it. The knob opens on the first, at the end, so that the others stay one piece.

const W = 64;
const H = 128;
// The row is 60 LEDs wide whatever the count, 24 tall, with its bottom edge 24 LEDs above the floor.
const ROW = 60;
const TALL = 24;
const BASE = H - 24;
// The Rise knob has 48 clicks over its range of one. KC are the clicks at the corners of the rise, and KD the rise in LEDs there: -24, then 0, then 24, each held for three clicks, which is two equal values in a row. Between the holds the rectangle crosses its own height in fourteen clicks, 1.7 LEDs each. Past the top hold it keeps going, 1.2 LEDs a click, and is 40.8 LEDs up at the top of the knob.
const KC = [0, 2, 16, 18, 32, 34, 48];
const KD = [-TALL, -TALL, 0, 0, TALL, TALL, TALL + 16.8];
const RISE_LO = -0.9;
const RISE_HI = 0.1;
const WHICH_LO = 0;

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

// How far the rectangle has risen, for a knob a number of clicks from its low end.
function riseAt(c) {
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
  params.wide = 12;
  params.left = 2;
  params.which = 1;
  params.rise = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = 3 + Math.round(clamp(k[1], 0, 4));
  params.n = n;
  params.wide = Math.floor(ROW / n);
  params.left = (W - n * params.wide) / 2;
  const clicks = (clamp(k[2], RISE_LO, RISE_HI) - RISE_LO) * 48;
  params.rise = riseAt(clicks);
  const f = (clamp(k[3], WHICH_LO, 1) - WHICH_LO) / (1 - WHICH_LO);
  params.which = Math.min(n - 1, Math.floor(f * n));
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.82 + 0.18 * Math.sin(t * 0.53 + 2.1);
  hsv(k[0] + 0.84, 0.85, params.light, params.c);
}

export function draw(display, params, time) {
  const { n, wide, left, which, rise, c } = params;
  for (let y = 0; y < H; y++) {
    const inRow = span(BASE - TALL, BASE, y);
    const inRaised = span(BASE - TALL - rise, BASE - rise, y);
    for (let x = 0; x < W; x++) {
      const j = Math.floor((x - left) / wide);
      const m = j < 0 || j >= n ? 0 : j === which ? inRaised : inRow;
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
