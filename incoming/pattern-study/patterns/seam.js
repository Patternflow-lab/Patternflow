// ===== Patternflow pattern =====
// Title:   Seam
// Family:  geometry
// Idea:    Two squares of one side stand one on the other with no gap on a bare dark ground, and the four knobs are the first colour, the side, how far round the colour wheel the second square's colour is from the first, and how much darker the second is: turned round to the same colour the seam between them is gone and the pair is one rectangle, and at the ends of the knob the two colours are opposite.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 156
// Round:   158
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..4, Turn=-1..1, Dim=0..1
//
// Knob 1: Hue. The colour of the upper square, all the way round the wheel from sky blue.
// Knob 2: Size. The side of both squares, 16 LEDs at 0 to 60 LEDs at 4; its 2 is 38 LEDs, so the pair stands 38 wide and 76 tall.
// Knob 3: Turn. How far round the colour wheel the lower square's colour stands from the upper one's. At -1 and at 1 it is half a turn, the opposite colour; moving the knob from -1 the lower colour comes round to the upper one, and at 0.375 it is the same colour and the knob holds there for three clicks, with the seam gone; past that it goes round the other way, back to the opposite colour at 1. Its 0 is 45 degrees short of the same colour.
// Knob 4: Dim. How much darker the lower square is than the upper one: the same light at 0, a quarter of it at 1. Its 0.06 leaves 95.5 percent of it.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = H / 2;
// One click of a knob that has 48 clicks over -1..1. The place the knob holds at is a whole number of clicks from its middle.
const CLICK = 2 / 48;
const SAME = 9 * CLICK;

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

// How far round the wheel, in turns, the second colour stands from the first for a knob at k: half a turn back at -1, none at SAME where it holds for three clicks, half a turn on at 1.
function turn(k) {
  const d = k - SAME;
  if (Math.abs(d) <= CLICK + 1e-6) return 0;
  if (d < 0) return (-0.5 * (-d - CLICK)) / (SAME + 1 - CLICK);
  return (0.5 * (d - CLICK)) / (1 - SAME - CLICK);
}

export function setup(params) {
  params.t = 0;
  params.a = new Float32Array(3);
  params.b = new Float32Array(3);
  params.side = 38;
  params.cx = new Float32Array(W);
  params.ra = new Float32Array(H);
  params.rb = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  params.side = 16 + 11 * clamp(k[1], 0, 4);
  // The size and the place of the squares do not move on the clock, so the seam stays where the colours change. The colour wanders a few degrees and the light swells and falls, both squares together, only so the panel is never quite still.
  const hue = k[0] + 0.55 + 0.03 * Math.sin(t * 0.43);
  const light = 0.92 + 0.08 * Math.sin(t * 0.61 + 1);
  hsv(hue, 0.85, light, params.a);
  hsv(hue + turn(clamp(k[2], -1, 1)), 0.85, light * (1 - 0.75 * clamp(k[3], 0, 1)), params.b);
}

export function draw(display, params, time) {
  const s = params.side;
  const { cx, ra, rb, a, b } = params;
  for (let x = 0; x < W; x++) cx[x] = span(CX - s / 2, CX + s / 2, x);
  // The upper square ends on the middle row line and the lower one starts there, so no LED holds both colours.
  for (let y = 0; y < H; y++) {
    ra[y] = span(CY - s, CY, y);
    rb[y] = span(CY, CY + s, y);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ma = cx[x] * ra[y];
      const mb = cx[x] * rb[y];
      display.setPixel(x, y, a[0] * ma + b[0] * mb, a[1] * ma + b[1] * mb, a[2] * ma + b[2] * mb);
    }
  }
}
