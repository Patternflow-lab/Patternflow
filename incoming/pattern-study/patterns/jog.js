// ===== Patternflow pattern =====
// Title:   Jog
// Family:  geometry
// Idea:    Five squares stand stacked with no gap in a column left of the middle of a bare dark ground, and the four knobs are the colour, how many squares are in the column, how far one of them has slid sideways out of the column and which one it is: at no slide the column is one plain band, and at a slide of one square the moved one touches its neighbours only at the corners, so one piece becomes three.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 165
// Round:   167
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=0..4, Slide=-0.9..0.1, Which=0..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from blue-green.
// Knob 2: Count. How many squares stand in the column, 3 at 0 to 7 at 4; its 2 is five. Each is 16 LEDs on a side and they touch, so the column is 48 LEDs tall at 3 and 112 at 7.
// Knob 3: Slide. How far the chosen square has slid sideways out of the column. The knob opens with the square 26 LEDs to the right, clear of the column. Turned down it comes in and the three clicks at the square's own width, 16 LEDs, hold it touching its neighbours at the corners only. Turned on down it overlaps them and the steps along its sides shrink until, after three more clicks that hold it, it sits in line and the column is a plain band. Past that it slides out to the left and holds again at one width.
// Knob 4: Which. Which square slides, counted from the top: the first at the bottom of the knob and the last at the top of it. The knob opens on the first, at the end, so that the others stay one piece.

const W = 64;
const H = 128;
// The squares are 16 LEDs on a side. The column's left edge is X0, so a square that slides a whole width to the left still stands clear of the wall.
const S = 16;
const X0 = 17;
// The Slide knob has 48 clicks over its range of one. KC are the clicks at the corners of the slide and KD the slide in LEDs there: -16 and then 0 and then 16 each hold for three clicks, which is two equal values in a row. The clicks near each hold slide the square more than one LED each. Past the right hold the square keeps going, about one LED a click, and has gone 30.8 LEDs by the top of the knob, which brings it to the right wall.
const KC = [0, 2, 15, 17, 32, 34, 48];
const KD = [-S, -S, 0, 0, S, S, 30.84];
const SLIDE_LO = -0.9;
const SLIDE_HI = 0.1;
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

// How far the square has slid, for a knob a number of clicks from its low end.
function slideAt(c) {
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
  params.top = 24;
  params.which = 1;
  params.slide = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = 3 + Math.round(clamp(k[1], 0, 4));
  params.n = n;
  params.top = (H - n * S) / 2;
  const clicks = (clamp(k[2], SLIDE_LO, SLIDE_HI) - SLIDE_LO) * 48;
  params.slide = slideAt(clicks);
  const f = (clamp(k[3], WHICH_LO, 1) - WHICH_LO) / (1 - WHICH_LO);
  params.which = Math.min(n - 1, Math.floor(f * n));
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.82 + 0.18 * Math.sin(t * 0.61 + 1.3);
  hsv(k[0] + 0.5, 0.85, params.light, params.c);
}

export function draw(display, params, time) {
  const { n, top, which, slide, c } = params;
  for (let y = 0; y < H; y++) {
    const j = Math.floor((y - top) / S);
    const on = j >= 0 && j < n;
    const lo = X0 + (j === which ? slide : 0);
    for (let x = 0; x < W; x++) {
      const m = on ? span(lo, lo + S, x) : 0;
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
