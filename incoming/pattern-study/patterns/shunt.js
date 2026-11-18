// ===== Patternflow pattern =====
// Title:   Shunt
// Family:  geometry
// Idea:    A stack of short bars with a gap between each stands in the middle of a bare dark ground, and the four knobs are the colour, how many bars are in the stack, how far one of them has been pushed sideways and which one it is: pushed to the left it stops with its end on the left wall, pushed to the right it stops with its end on the right wall, and in between it simply crosses the panel.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 165
// Round:   167
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=1..4, Push=-0.77..0.23, Which=-0.2..1
//
// Knob 1: Hue. The colour of the bars, all the way round the wheel from yellow.
// Knob 2: Count. How many bars stand in the stack, 4 at 1 to 7 at 4; its 2 is five. Each is 24 LEDs long and 12 thick with 4 LEDs between, so the stack is 60 LEDs tall at four and 108 at seven.
// Knob 3: Push. How far the chosen bar has been pushed sideways. The knob opens with the bar 10 LEDs to the right of the stack. Pushed on to the right it holds for the last three clicks with its end on the right wall. Turned the other way it comes back through the stack, level with the others in the middle of the knob, and holds for the first three clicks with its end on the left wall. The eight clicks before each wall move it 1.1 LEDs each and the clicks between them a little less.
// Knob 4: Which. Which bar is pushed, counted from the top: the first at the bottom of the knob and the last at the top of it. The knob opens on the second.

const W = 64;
const H = 128;
// Each bar is 24 LEDs long and 12 thick, with 4 LEDs between neighbours, and the stack stands in the middle of the panel.
const LEN = 24;
const THICK = 12;
const GAP = 4;
const X0 = (W - LEN) / 2;
// Level with the others the bar's end is 20 LEDs from either wall.
const REACH = X0;
// The Push knob has 48 clicks over its range of one. KC are the clicks at the corners of the push and KD the push in LEDs there. The first three and the last three clicks hold the bar with its end on the left and on the right wall, which is two equal values in a row. The eight clicks before each wall move the bar 1.1 LEDs each and the 28 between them carry it the other 22.4 LEDs.
const KC = [0, 2, 10, 38, 46, 48];
const KD = [-REACH, -REACH, -REACH + 8.8, REACH - 8.8, REACH, REACH];
const PUSH_LO = -0.77;
const PUSH_HI = 0.23;
const WHICH_LO = -0.2;

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

// How far the bar has been pushed, for a knob a number of clicks from its low end.
function pushAt(c) {
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
  params.top = 28;
  params.which = 1;
  params.push = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = 4 + Math.round(clamp(k[1], 1, 4) - 1);
  params.n = n;
  params.top = (H - (n * THICK + (n - 1) * GAP)) / 2;
  const clicks = (clamp(k[2], PUSH_LO, PUSH_HI) - PUSH_LO) * 48;
  params.push = pushAt(clicks);
  const f = (clamp(k[3], WHICH_LO, 1) - WHICH_LO) / (1 - WHICH_LO);
  params.which = Math.min(n - 1, Math.floor(f * n));
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.82 + 0.18 * Math.sin(t * 0.67 + 0.2);
  hsv(k[0] + 0.17, 0.85, params.light, params.c);
}

export function draw(display, params, time) {
  const { n, top, which, push, c } = params;
  for (let y = 0; y < H; y++) {
    const j = Math.floor((y - top) / (THICK + GAP));
    const into = y - top - j * (THICK + GAP);
    const on = j >= 0 && j < n && into < THICK;
    const lo = X0 + (j === which ? push : 0);
    for (let x = 0; x < W; x++) {
      const m = on ? span(lo, lo + LEN, x) : 0;
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
