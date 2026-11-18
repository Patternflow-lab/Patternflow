// ===== Patternflow pattern =====
// Title:   Lune
// Family:  geometry
// Idea:    Two discs, a big one above a smaller one, on a bare dark ground, and the four knobs are the colour, the big one's size, how far apart the two stand and how much smaller the second is: they come together until their rims touch, then overlap with the overlap switched off, so two crescents are left, then the small one lies wholly inside the big one.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 150
// Round:   152
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..4, Meet=-1..1, Smaller=0..1
//
// Knob 1: Hue. The colour of both discs, all the way round the wheel from rose.
// Knob 2: Size. The diameter of the big disc, 16 LEDs at 0 to 56 LEDs at 4; its 2 is 36 LEDs. The small disc keeps its share of that diameter.
// Knob 3: Meet. How the two stand to each other, the pair always centred on the panel. From -1 they are far apart; at 0.125 their rims touch and the knob holds there for three clicks; then the overlap goes dark and the two are left as two crescents (lunes) that thin out as the small disc slides into the big one; at 0.79 the small disc touches the big one's rim from inside and the knob holds again for three clicks; past that the small disc is a hole wholly inside the big one, and at 1 the two share a middle. Its 0 leaves a few LEDs of dark between them.
// Knob 4: Smaller. How much smaller the second disc is than the first: at 0 its diameter is 0.76 of the big one's, at 1 it is 0.2. Its 0.06 is 0.73.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = H / 2;
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

// How far apart the two middles stand for a knob at k. Far at -1, `touch` once the rims meet (held for three clicks), `inside` once the small disc touches the big one's rim from inside (held again), and 0 at 1 where the two share a middle.
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
  params.big = 36;
  params.small = 26.2;
  params.gap = 31;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const big = 16 + 10 * clamp(k[1], 0, 4);
  const small = big * (0.76 - 0.56 * clamp(k[3], 0, 1));
  params.big = big;
  params.small = small;
  // The big disc is the one that reaches the panel's end first, so it sets how far apart they can stand: two LEDs from the top wall when it is as far as it goes.
  params.gap = apart(clamp(k[2], -1, 1), (big + small) / 2, (big - small) / 2, H - 4 - big);
  // Neither disc's size or place moves on the clock, so that the two meet exactly where the knob says. The colour wanders a few degrees and the light swells and falls, both discs together, only so the panel is never quite still.
  hsv(k[0] + 0.96 + 0.03 * Math.sin(t * 0.43), 0.8, 0.92 + 0.08 * Math.sin(t * 0.61 + 1), params.col);
}

export function draw(display, params, time) {
  const rb = params.big / 2;
  const rs = params.small / 2;
  // The big disc stands above, the small one below, the pair's middles equally far from the middle of the panel.
  const yb = CY - params.gap / 2;
  const ys = CY + params.gap / 2;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const dyb = y + 0.5 - yb;
    const dys = y + 0.5 - ys;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX;
      let a = 0.5 - (Math.sqrt(dx * dx + dyb * dyb) - rb);
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      let b = 0.5 - (Math.sqrt(dx * dx + dys * dys) - rs);
      b = b < 0 ? 0 : b > 1 ? 1 : b;
      // What both discs cover of this LED. Between the two middles the rims face each other, as when the discs only touch, and what one leaves the other takes; outside them the rims run the same way, as when one disc lies inside the other, and the smaller cover lies within the larger.
      let both;
      if (dyb * dys < 0) both = a + b - 1 > 0 ? a + b - 1 : 0;
      else both = a < b ? a : b;
      // Lit where one disc is and the other is not, so the overlap is dark.
      const m = a + b - 2 * both;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
