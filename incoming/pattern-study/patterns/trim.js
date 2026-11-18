// ===== Patternflow pattern =====
// Title:   Trim
// Family:  geometry
// Idea:    Two upright lines on a bare dark panel, a thick one a little left of the middle and a thinner one farther to the right, and the four knobs are the colour, the thick line's width, how far right the thin one stands and how thick it is next to the first: the knob holds at the one place where the two balance, with the light as a whole centred on the panel.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 152
// Round:   154
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Width=0..3, Reach=-1..1, Weight=0..1
//
// Knob 1: Hue. The colour of both lines, all the way round the wheel from green.
// Knob 2: Width. The width of the thick line, 5 LEDs at 0 to 14 LEDs at 3; its 2 is 11 LEDs. Its middle stays 10 LEDs left of the middle of the panel, so it only grows round that place. Both lines are 100 LEDs tall.
// Knob 3: Reach. How far right of the middle of the panel the thin line stands, 3 LEDs from the middle at -1 to the right-hand wall at 1. At 0.125 the light of the two lines together is centred on the panel exactly: the thin line's lesser width is made up for by its longer arm, and the knob holds there for three clicks. Its 0 is two clicks short of that.
// Knob 4: Weight. How thick the thin line is next to the thick one: its width is 0.5 of the thick one's at 0 and 0.9 at 1; its 0.06 is 0.52. The thinner it is, the farther out it has to stand to balance, so this knob moves the balance place as well as the line.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = H / 2;
// How tall both lines are.
const LENGTH = 100;
// How far left of the middle of the panel the thick line's middle stands.
const LEFT = 10;
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

// How far right of the middle the thin line stands for a knob at k: `near` at -1, `balance` all through the held clicks, `far` at 1.
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
  params.thick = 11;
  params.thin = 5.8;
  params.out = 19;
  params.ax = new Float32Array(W);
  params.bx = new Float32Array(W);
  params.along = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const thick = 5 + 3 * clamp(k[1], 0, 3);
  const share = 0.5 + 0.4 * clamp(k[3], 0, 1);
  const thin = thick * share;
  params.thick = thick;
  params.thin = thin;
  // Both lines are as tall as each other, so what each adds up to goes with its width. The thin line balances the thick one LEFT LEDs to the left when its own middle is LEFT / share to the right. That is the place the knob holds at.
  const balance = LEFT / share;
  // Near, the thin line's left edge is 3 LEDs right of the middle, clear of the thick one. Far, its right edge is 2 LEDs from the wall.
  params.out = reach(clamp(k[2], -1, 1), thin / 2 + 3, balance, W / 2 - 2 - thin / 2);
  // Neither line's width or place moves on the clock, so the balance stays exactly where the knob says. The colour wanders a few degrees and the light swells and falls, both lines together, only so the panel is never quite still.
  hsv(k[0] + 0.3 + 0.03 * Math.sin(t * 0.43), 0.85, 0.88 + 0.12 * Math.sin(t * 0.61 + 1), params.col);
}

export function draw(display, params, time) {
  const ht = params.thick / 2;
  const hn = params.thin / 2;
  const xt = CX - LEFT;
  const xn = CX + params.out;
  const { ax, bx, along, col } = params;
  for (let x = 0; x < W; x++) {
    ax[x] = span(xt - ht, xt + ht, x);
    bx[x] = span(xn - hn, xn + hn, x);
  }
  for (let y = 0; y < H; y++) along[y] = span(CY - LENGTH / 2, CY + LENGTH / 2, y);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // The two lines never touch, so each LED is covered by one of them or neither.
      let m = (ax[x] + bx[x]) * along[y];
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
