// ===== Patternflow pattern =====
// Title:   Stile
// Family:  geometry
// Idea:    One thick upright line stands to one side of a ground lit to the same brightness, and the four knobs are the colour, the thickness, how far round the colour wheel the ground's colour is from the line's, and how much darker the ground is: turned round to the same colour the line is gone into the ground, and the knob holds there for three clicks.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 179
// Round:   181
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Girth=0..3, Tone=-1..1, Shade=0.06..1
//
// Knob 1: Hue. The colour of the line, all the way round the wheel from green; the ground's colour goes round with it.
// Knob 2: Girth. How thick the line is, 4 LEDs at 0 to 22 at 3; its 2 is 16. It stands 108 LEDs tall with its middle 14 LEDs right of the panel's middle, and the thickness grows on both sides of that.
// Knob 3: Tone. How far round the colour wheel the ground's colour stands from the line's. At -1 and at 1 it is half a turn, the opposite colour. Moving the knob up from -1 the ground comes round to the line's colour, and at 0.708 it is the same colour and the line is gone; the knob holds there for three clicks (0.667 to 0.75). Past that the ground goes round the other way, back to the opposite colour at 1. Its 0 is 141 degrees short of the same colour, sixteen clicks before the hold.
// Knob 4: Shade. How much darker the ground is than the line: the same brightness at 0.06, where the knob opens, and 0.28 of it at 1. Dimmed, the line stays in view even where the colours are the same.

const W = 64;
const H = 128;
// The line's middle column, right of the panel's middle at 32, and the rows it runs between.
const LX = 46;
const TOP = 10;
const BOTTOM = H - 10;
// One click of a knob that has 48 clicks over -1..1. The place the knob holds at is a whole number of clicks from its middle, and it holds for the click either side as well.
const CLICK = 2 / 48;
const STOP = 17;
// The line and the ground are lit to this much of full, under half so the whole panel lit stays inside the current budget.
const LEVEL = 0.46;
const SAT = 0.85;
// The first colour: a green, so the open ground comes out a pink red.
const BASE = 0.36;

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

// How far round the wheel, in turns, the ground's colour stands from the line's for a knob at k: half a turn back at -1, none for the three clicks at STOP, half a turn on at 1. Each side comes round fast at first and slows, so the open ground is already well away.
function turn(k) {
  const d = k / CLICK - STOP;
  const run = Math.abs(d) - 1;
  if (run <= 1e-6) return 0;
  const room = d < 0 ? STOP + 23 : 23 - STOP;
  const x = Math.min(1, run / room);
  const a = 0.5 * (1 - Math.pow(1 - x, 3));
  return d < 0 ? -a : a;
}

export function setup(params) {
  params.t = 0;
  params.line = new Float32Array(3);
  params.gr = new Float32Array(3);
  params.girth = 16;
  params.cx = new Float32Array(W);
  params.cy = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  params.girth = 4 + 6 * clamp(k[1], 0, 3);
  // The thickness and the place do not move on the clock. The colour wanders a few degrees, and the light swells and falls over the line and the ground together, so when the two are the same colour they stay the same colour.
  const hue = k[0] + BASE + 0.02 * Math.sin(t * 0.43);
  const light = LEVEL * (0.92 + 0.08 * Math.sin(t * 0.61 + 1));
  // The knob opens at its least, so the ground starts as bright as the line.
  const dim = (clamp(k[3], 0.06, 1) - 0.06) / 0.94;
  hsv(hue, SAT, light, params.line);
  hsv(hue + turn(clamp(k[2], -1, 1)), SAT, light * (1 - 0.72 * dim), params.gr);
}

export function draw(display, params, time) {
  const { line, gr, cx, cy } = params;
  const half = params.girth / 2;
  for (let x = 0; x < W; x++) cx[x] = span(LX - half, LX + half, x);
  for (let y = 0; y < H; y++) cy[y] = span(TOP, BOTTOM, y);
  const dr = line[0] - gr[0];
  const dg = line[1] - gr[1];
  const db = line[2] - gr[2];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // The ground plus the difference scaled by how much of the LED the line covers: when the two colours are equal the difference is zero and the line is not there.
      const c = cx[x] * cy[y];
      display.setPixel(x, y, gr[0] + dr * c, gr[1] + dg * c, gr[2] + db * c);
    }
  }
}
