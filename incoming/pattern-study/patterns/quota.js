// ===== Patternflow pattern =====
// Title:   Quota
// Family:  geometry
// Idea:    Two squares, one above the other, on a bare dark ground, that always add up to the same area, with the four knobs for the colour, that total, which of the two has the bigger share and how the pair lines up, and the share knob holds where the two are the same size.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 151
// Round:   153
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..4, Share=-1..1, Align=0..1
//
// Knob 1: Hue. The colour of both squares, all the way round the wheel from green.
// Knob 2: Size. How much there is to share. The two areas always add up to twice the square of the side each square has when they are the same size: that side is 16 LEDs at 0 to 44 LEDs at 4, and its 2 is 30 LEDs.
// Knob 3: Share. Which square has more of it. At -1 the top one has 88 percent of the area and the bottom one 12; as the knob turns up the top one gives area to the bottom one, so that what one gains the other loses. At 0.125 the two have the same area, are the same size, and the knob holds there for three clicks; past that the bottom one has more, down to 12 percent for the top one at 1. Its 0 is three clicks before the even place.
// Knob 4: Align. How the two stand to each other from side to side. At 0 their middles are on one line down the panel; as it turns up they slide left until, at 1, their left edges are on one line, three LEDs from the left wall. Its 0.06 is nearly centred.

const W = 64;
const H = 128;
const CX = W / 2;
// The middle of each square's half of the panel: each square has a 64 by 64 half to itself and never meets the other.
const CY1 = H / 4;
const CY2 = (3 * H) / 4;
// One click of a knob that has 48 clicks over -1..1. The even place is a whole number of clicks from the knob's middle.
const CLICK = 2 / 48;
const EVEN = 3 * CLICK;
// The share of the area the top square has with the knob at -1; the bottom one has what is left, and the knob's other end gives it the same the other way round.
const MOST = 0.88;
// Where the left edges stand when they are lined up.
const WALL = 3;

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

// The top square's share of the total area for a knob at k. `MOST` at -1, one half over the three clicks that hold at EVEN, and 1 - MOST at 1.
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
  params.s1 = 30.9;
  params.s2 = 29.1;
  params.x1 = 16;
  params.x2 = 16.5;
  params.ax = new Float32Array(W);
  params.bx = new Float32Array(W);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The side each has when they are even. A square's side is the root of its area, so a share s of the total is a side of side * sqrt(2 s), and the two areas add up to 2 side * side whatever the knob does.
  const side = 16 + 7 * clamp(k[1], 0, 4);
  const s = share(clamp(k[2], -1, 1));
  const s1 = side * Math.sqrt(2 * s);
  const s2 = side * Math.sqrt(2 * (1 - s));
  const lined = clamp(k[3], 0, 1);
  params.s1 = s1;
  params.s2 = s2;
  // Each square's left edge goes from the place that centres it to the one wall edge they share.
  params.x1 = (1 - lined) * (CX - s1 / 2) + lined * WALL;
  params.x2 = (1 - lined) * (CX - s2 / 2) + lined * WALL;
  // Neither square's size or place moves on the clock, so the two are the same size exactly where the knob holds. The colour wanders a few degrees and the light swells and falls, both squares together, only so the panel is never quite still.
  hsv(k[0] + 0.3 + 0.03 * Math.sin(t * 0.43), 0.85, 0.92 + 0.08 * Math.sin(t * 0.61 + 1), params.col);
}

export function draw(display, params, time) {
  const { s1, s2, x1, x2, ax, bx, col } = params;
  for (let x = 0; x < W; x++) {
    ax[x] = span(x1, x1 + s1, x);
    bx[x] = span(x2, x2 + s2, x);
  }
  for (let y = 0; y < H; y++) {
    const ay = span(CY1 - s1 / 2, CY1 + s1 / 2, y);
    const by = span(CY2 - s2 / 2, CY2 + s2 / 2, y);
    for (let x = 0; x < W; x++) {
      // The squares are in different halves, so no LED has both.
      const m = ax[x] * ay + bx[x] * by;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
