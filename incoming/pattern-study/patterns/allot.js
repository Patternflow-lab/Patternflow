// ===== Patternflow pattern =====
// Title:   Allot
// Family:  geometry
// Idea:    Two triangles with their top corners up, one above the other, on a bare dark ground, that always add up to the same area, with the four knobs for the colour, that total, which of the two has the bigger share and how the pair lines up, and the share knob holds where the two are the same size.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 151
// Round:   153
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..4, Share=-1..1, Align=0..1
//
// Knob 1: Hue. The colour of both triangles, all the way round the wheel from violet.
// Knob 2: Size. How much there is to share. The two areas always add up to twice the area of the triangle each has when they are the same size: that triangle's base is 22 LEDs at 0 to 45 LEDs at 4, and its 2 is 33.5 LEDs. Its sides are as long as its base.
// Knob 3: Share. Which triangle has more of it. At -1 the top one has 88 percent of the area and the bottom one 12; as the knob turns up the top one gives area to the bottom one, so that what one gains the other loses. At 0.125 the two have the same area, are the same size, and the knob holds there for three clicks; past that the bottom one has more, down to 12 percent for the top one at 1. Its 0 is three clicks before the even place.
// Knob 4: Align. How the two stand to each other from side to side. At 0 their middles are on one line down the panel; as it turns up they slide left until, at 1, their bottom left corners are on one line, three LEDs from the left wall. Its 0.06 is nearly centred.

const W = 64;
const H = 128;
const CX = W / 2;
// The middle of each triangle's half of the panel: each has a 64 by 64 half to itself and never meets the other.
const CY1 = H / 4;
const CY2 = (3 * H) / 4;
// One click of a knob that has 48 clicks over -1..1. The even place is a whole number of clicks from the knob's middle.
const CLICK = 2 / 48;
const EVEN = 3 * CLICK;
// The share of the area the top triangle has with the knob at -1; the bottom one has what is left, and the knob's other end gives it the same the other way round.
const MOST = 0.88;
// Where the left corners stand when they are lined up.
const WALL = 3;
// The height of an equilateral triangle in bases.
const TALL = 0.8660254;

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

// The top triangle's share of the total area for a knob at k. `MOST` at -1, one half over the three clicks that hold at EVEN, and 1 - MOST at 1.
function share(k) {
  const a0 = EVEN - CLICK;
  const a1 = EVEN + CLICK;
  if (k <= a0) return 0.5 + ((MOST - 0.5) * (a0 - k)) / (a0 + 1);
  if (k <= a1) return 0.5;
  return 0.5 - ((MOST - 0.5) * (k - a1)) / (1 - a1);
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.b1 = 34.5;
  params.b2 = 32.5;
  params.x1 = 16;
  params.x2 = 17;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The base each has when they are even. Equilateral triangles are all alike, so the area goes with the square of the base: a share s of the total is a base of base * sqrt(2 s), and the two areas add up to the same whatever the knob does.
  const base = 22 + 5.75 * clamp(k[1], 0, 4);
  const s = share(clamp(k[2], -1, 1));
  const b1 = base * Math.sqrt(2 * s);
  const b2 = base * Math.sqrt(2 * (1 - s));
  const lined = clamp(k[3], 0, 1);
  params.b1 = b1;
  params.b2 = b2;
  // Each triangle's left corner goes from the place that centres it to the one wall edge they share.
  params.x1 = (1 - lined) * (CX - b1 / 2) + lined * WALL;
  params.x2 = (1 - lined) * (CX - b2 / 2) + lined * WALL;
  // Neither triangle's size or place moves on the clock, so the two are the same size exactly where the knob holds. The colour wanders a few degrees and the light swells and falls, both triangles together, only so the panel is never quite still; the triangles light fewer LEDs than squares do, so the swell is wider.
  hsv(k[0] + 0.72 + 0.03 * Math.sin(t * 0.43), 0.85, 0.88 + 0.12 * Math.sin(t * 0.61 + 1), params.col);
}

export function draw(display, params, time) {
  const { b1, b2, col } = params;
  // Each triangle's box is centred on the middle of its half: the top corner is half the height above it, the base half below.
  const h1 = b1 * TALL;
  const h2 = b2 * TALL;
  const apex1 = CY1 - h1 / 2;
  const apex2 = CY2 - h2 / 2;
  const base1 = CY1 + h1 / 2;
  const base2 = CY2 + h2 / 2;
  const mid1 = params.x1 + b1 / 2;
  const mid2 = params.x2 + b2 / 2;
  // The two leaning sides as lines. A side's unit normal is TALL across and a half along, because the side is as long as the base.
  const ny = 0.5;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      // Distance from each side, positive outside; a triangle covers the LED by how far the nearest of its three sides is, as a clamped half-LED ramp.
      const q1 = px - mid1;
      let d = py - base1;
      let e = -TALL * q1 - ny * (py - apex1);
      if (e > d) d = e;
      e = TALL * q1 - ny * (py - apex1);
      if (e > d) d = e;
      let a = 0.5 - d;
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      const q2 = px - mid2;
      d = py - base2;
      e = -TALL * q2 - ny * (py - apex2);
      if (e > d) d = e;
      e = TALL * q2 - ny * (py - apex2);
      if (e > d) d = e;
      let b = 0.5 - d;
      b = b < 0 ? 0 : b > 1 ? 1 : b;
      const m = a + b;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
