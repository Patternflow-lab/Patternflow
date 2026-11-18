// ===== Patternflow pattern =====
// Title:   Abreast
// Family:  geometry
// Idea:    Two upright lines side by side on a bare dark ground, a thick one beside a thinner one, and the four knobs are the colour, the thick line's width, how far apart the two stand and how much thinner the second is: they come together until their edges meet, then overlap with the overlap switched off, then the thin one lies wholly inside the thick one and shows as a slit.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 150
// Round:   152
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Thick=0..4, Meet=-1..1, Thinner=0..1
//
// Knob 1: Hue. The colour of both lines, all the way round the wheel from amber.
// Knob 2: Thick. The width of the thick line, 3 LEDs at 0 to 19 LEDs at 4; its 2 is 11 LEDs. The thin line keeps its share of that width. Both are 104 LEDs tall.
// Knob 3: Meet. How the two stand to each other, the pair always centred on the panel. From -1 they are far apart; at 0.125 their edges meet and the knob holds there for three clicks; then the overlap goes dark and the two are left as two slivers that thin out as the thin line slides into the thick one; at 0.79 the thin line's far edge lies on the thick one's and the knob holds again for three clicks; past that the thin line is a slit wholly inside the thick one, and at 1 the slit is in the middle. Its 0 leaves a few LEDs of dark between them.
// Knob 4: Thinner. How much thinner the second line is than the first: at 0 it is 0.76 of the thick width, at 1 it is 0.2. Its 0.06 is 0.73.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = H / 2;
// How tall both lines are.
const LENGTH = 104;
// One click of a knob that has 48 clicks over -1..1. The two places the knob holds at are whole clicks from its middle.
const CLICK = 2 / 48;
const TOUCH = 3 * CLICK;
const INSIDE = 19 * CLICK;

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

// How far apart the two middles stand for a knob at k. Far at -1, `touch` once the edges meet (held for three clicks), `inside` once the thin line's far edge lies on the thick one's (held again), and 0 at 1 where the two share a middle.
function apart(k, touch, inside, far) {
  const a0 = TOUCH - CLICK;
  const a1 = TOUCH + CLICK;
  const b0 = INSIDE - CLICK;
  const b1 = INSIDE + CLICK;
  if (k <= a0) return far + ((touch - far) * (k + 1)) / (a0 + 1);
  if (k <= a1) return touch;
  if (k <= b0) return touch + ((inside - touch) * (k - a1)) / (b0 - a1);
  if (k <= b1) return inside;
  return inside * (1 - (k - b1) / (1 - b1));
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.thick = 11;
  params.thin = 8;
  params.gap = 9.5;
  params.ax = new Float32Array(W);
  params.bx = new Float32Array(W);
  params.ix = new Float32Array(W);
  params.along = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const thick = 3 + 4 * clamp(k[1], 0, 4);
  const thin = thick * (0.76 - 0.56 * clamp(k[3], 0, 1));
  params.thick = thick;
  params.thin = thin;
  // The thick line is the one that reaches the panel's side first, so it sets how far apart they can stand: two LEDs from the side wall when it is as far as it goes.
  params.gap = apart(clamp(k[2], -1, 1), (thick + thin) / 2, (thick - thin) / 2, W - 4 - thick);
  // Neither line's width or place moves on the clock, so that the two meet exactly where the knob says. The colour wanders a few degrees and the light swells and falls, both lines together, only so the panel is never quite still.
  hsv(k[0] + 0.1 + 0.03 * Math.sin(t * 0.43), 0.9, 0.92 + 0.08 * Math.sin(t * 0.61 + 1), params.col);
}

export function draw(display, params, time) {
  const ht = params.thick / 2;
  const hn = params.thin / 2;
  // The thick line stands on the left, the thin one on the right, the pair's middles equally far from the middle of the panel.
  const xt = CX - params.gap / 2;
  const xn = CX + params.gap / 2;
  const { ax, bx, ix, along, col } = params;
  // Where the two lines overlap across the panel.
  const lo = Math.max(xt - ht, xn - hn);
  const hi = Math.min(xt + ht, xn + hn);
  for (let x = 0; x < W; x++) {
    ax[x] = span(xt - ht, xt + ht, x);
    bx[x] = span(xn - hn, xn + hn, x);
    ix[x] = hi > lo ? span(lo, hi, x) : 0;
  }
  for (let y = 0; y < H; y++) along[y] = span(CY - LENGTH / 2, CY + LENGTH / 2, y);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // What the two lines cover of this LED, less the overlap counted twice, so the overlap is dark and two lines that only meet at an edge show no seam.
      let m = (ax[x] + bx[x] - 2 * ix[x]) * along[y];
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
