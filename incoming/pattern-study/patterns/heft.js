// ===== Patternflow pattern =====
// Title:   Heft
// Family:  geometry
// Idea:    A big square stands just above the middle of a bare dark panel and a smaller one hangs far below it, and the four knobs are the colour, the big one's size, how far down the small one stands and how big it is next to the big one: the knob holds at the one place where the two balance, with the light as a whole centred on the panel.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 152
// Round:   154
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Reach=-1..1, Weight=0..1
//
// Knob 1: Hue. The colour of both squares, all the way round the wheel from blue.
// Knob 2: Size. The side of the big square, 14 LEDs at 0 to 32 LEDs at 3; its 2 is 26 LEDs. Its middle stays 20 LEDs above the middle of the panel, so it only grows round that place.
// Knob 3: Reach. How far below the middle of the panel the small square stands, 3 LEDs under the middle at -1 to the far wall at 1. At 0.125 the light of the two squares together is centred on the panel exactly: the small square's lesser area is made up for by its longer arm, and the knob holds there for three clicks. Its 0 is two clicks short of that.
// Knob 4: Weight. How big the small square is next to the big one: its side is 0.68 of the big one's at 0 and 0.9 at 1; its 0.06 is 0.69. The lighter it is, the farther out it has to stand to balance, so this knob moves the balance place as well as the square.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = H / 2;
// How far above the middle of the panel the big square's middle stands.
const UP = 20;
// One click of a knob that has 48 clicks over -1..1. The balance place is three clicks from the knob's middle, and the knob holds for a click either side of it.
const CLICK = 2 / 48;
const BALANCE = 3 * CLICK;

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

// How far below the middle the small square stands for a knob at k: `near` at -1, `balance` all through the held clicks, `far` at 1.
function reach(k, near, balance, far) {
  const a0 = BALANCE - CLICK;
  const a1 = BALANCE + CLICK;
  if (k <= a0) return near + ((balance - near) * (k + 1)) / (a0 + 1);
  if (k <= a1) return balance;
  return balance + ((far - balance) * (k - a1)) / (1 - a1);
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.big = 26;
  params.small = 18;
  params.down = 40;
  params.ax = new Float32Array(W);
  params.bx = new Float32Array(W);
  params.ay = new Float32Array(H);
  params.by = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const big = 14 + 6 * clamp(k[1], 0, 3);
  const share = 0.68 + 0.22 * clamp(k[3], 0, 1);
  const small = big * share;
  params.big = big;
  params.small = small;
  // Area goes with the square of the side, so the small square balances the big one UP LEDs above the middle when its own middle is UP / share^2 below it. That is the place the knob holds at.
  const balance = UP / (share * share);
  // Near, the small square's top edge is 3 LEDs under the middle, clear of the big one. Far, its bottom edge is 2 LEDs from the wall.
  params.down = reach(clamp(k[2], -1, 1), small / 2 + 3, balance, H / 2 - 2 - small / 2);
  // Neither square's size or place moves on the clock, so the balance stays exactly where the knob says. The colour wanders a few degrees and the light swells and falls, both squares together, only so the panel is never quite still.
  hsv(k[0] + 0.56 + 0.03 * Math.sin(t * 0.43), 0.85, 0.88 + 0.12 * Math.sin(t * 0.61 + 1), params.col);
}

export function draw(display, params, time) {
  const hb = params.big / 2;
  const hs = params.small / 2;
  const yb = CY - UP;
  const ys = CY + params.down;
  const { ax, bx, ay, by, col } = params;
  for (let x = 0; x < W; x++) {
    ax[x] = span(CX - hb, CX + hb, x);
    bx[x] = span(CX - hs, CX + hs, x);
  }
  for (let y = 0; y < H; y++) {
    ay[y] = span(yb - hb, yb + hb, y);
    by[y] = span(ys - hs, ys + hs, y);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // The two squares never touch, so each LED is covered by one of them or neither.
      let m = ax[x] * ay[y] + bx[x] * by[y];
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
