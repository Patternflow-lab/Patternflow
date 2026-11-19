// ===== Patternflow pattern =====
// Title:   Tincture
// Family:  geometry
// Idea:    One triangle stands in the upper half of a ground lit to the same brightness, and the four knobs are the colour, the size, how far round the colour wheel the ground's colour is from the triangle's, and how much darker the ground is: turned round to the same colour the triangle is gone into the ground, and the knob holds there for three clicks.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 179
// Round:   181
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Spread=0..3, Wash=-1..1, Dusk=0.06..1
//
// Knob 1: Hue. The colour of the triangle, all the way round the wheel from teal; the ground's colour goes round with it.
// Knob 2: Spread. The base of the triangle, 22 LEDs at 0 to 58 at 3; its 2 is 46, and its height is the same as its base. The apex points up and the middle of its weight stays 46 LEDs from the top edge.
// Knob 3: Wash. How far round the colour wheel the ground's colour stands from the triangle's. At -1 and at 1 it is half a turn, the opposite colour. Moving the knob up from -1 the ground comes round to the triangle's colour, and at -0.583 it is the same colour and the triangle is gone; the knob holds there for three clicks (-0.625 to -0.542). Past that the ground goes round the other way, back to the opposite colour at 1. Its 0 is 131 degrees short of the same colour on that side, thirteen clicks after the hold.
// Knob 4: Dusk. How much darker the ground is than the triangle: the same brightness at 0.06, where the knob opens, and 0.28 of it at 1. Dimmed, the triangle stays in view even where the colours are the same.

const W = 64;
const H = 128;
const CX = W / 2;
// The middle of the triangle's weight stays this far down from the top edge.
const MID = 46;
// One click of a knob that has 48 clicks over -1..1. The place the knob holds at is a whole number of clicks from its middle, and it holds for the click either side as well.
const CLICK = 2 / 48;
const STOP = -14;
// The triangle and the ground are lit to this much of full, under half so the whole panel lit stays inside the current budget.
const LEVEL = 0.46;
const SAT = 0.85;
// The first colour: a teal, so the open ground comes out a magenta.
const BASE = 0.48;

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

// How far round the wheel, in turns, the ground's colour stands from the triangle's for a knob at k: half a turn back at -1, none for the three clicks at STOP, half a turn on at 1. Each side comes round fast at first and slows, so the open ground is already well away.
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
  params.tri = new Float32Array(3);
  params.gr = new Float32Array(3);
  params.base = 46;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  params.base = 22 + 12 * clamp(k[1], 0, 3);
  // The size and the place do not move on the clock. The colour wanders a few degrees, and the light swells and falls over the triangle and the ground together, so when the two are the same colour they stay the same colour.
  const hue = k[0] + BASE + 0.02 * Math.sin(t * 0.43);
  const light = LEVEL * (0.92 + 0.08 * Math.sin(t * 0.61 + 1));
  // The knob opens at its least, so the ground starts as bright as the triangle.
  const dim = (clamp(k[3], 0.06, 1) - 0.06) / 0.94;
  hsv(hue, SAT, light, params.tri);
  hsv(hue + turn(clamp(k[2], -1, 1)), SAT, light * (1 - 0.72 * dim), params.gr);
}

export function draw(display, params, time) {
  const { tri, gr } = params;
  // The height is the base. The apex is two thirds of the height above the middle of the weight and the base line a third below it.
  const a = params.base / 2;
  const h = params.base;
  const apex = MID - (2 * h) / 3;
  const floor = MID + h / 3;
  const len = Math.sqrt(a * a + h * h);
  const dr = tri[0] - gr[0];
  const dg = tri[1] - gr[1];
  const db = tri[2] - gr[2];
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    const down = py - apex;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - CX;
      // How far inside each of the three sides the LED's middle is: the base, then the two slanted sides.
      const inBase = floor - py;
      const inLeft = (h * px + a * down) / len;
      const inRight = (-h * px + a * down) / len;
      let d = inBase < inLeft ? inBase : inLeft;
      d = d < inRight ? d : inRight;
      let c = 0.5 + d;
      c = c < 0 ? 0 : c > 1 ? 1 : c;
      // The ground plus the difference scaled by cover: when the two colours are equal the difference is zero and the triangle is not there.
      display.setPixel(x, y, gr[0] + dr * c, gr[1] + dg * c, gr[2] + db * c);
    }
  }
}
