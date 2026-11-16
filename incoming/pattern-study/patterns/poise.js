// ===== Patternflow pattern =====
// Title:   Poise
// Family:  geometry
// Idea:    A big disc stands up and to the left of the middle of a bare dark panel and a smaller one down and to the right of it, both on the panel's own diagonal, and the four knobs are the colour, the big one's size, how far down the diagonal the small one stands and how big it is next to the big one: the knob holds at the one place where the two balance, with the light as a whole centred on the panel.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 152
// Round:   154
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Reach=-1..1, Weight=0..1
//
// Knob 1: Hue. The colour of both discs, all the way round the wheel from amber.
// Knob 2: Size. The diameter of the big disc, 15 LEDs at 0 to 33 LEDs at 3; its 2 is 27 LEDs. Its middle stays 16 LEDs from the middle of the panel, up and to the left, so it only grows round that place.
// Knob 3: Reach. How far from the middle of the panel the small disc stands, along the line through the middle and the panel's corner (one LED across for every two down): from just clear of the big disc at -1 to the right-hand wall at 1. At 0.125 the light of the two discs together is centred on the panel exactly: the small disc's lesser area is made up for by its longer arm, and the knob holds there for three clicks. Its 0 is two clicks short of that.
// Knob 4: Weight. How big the small disc is next to the big one: its diameter is 0.72 of the big one's at 0 and 0.92 at 1; its 0.06 is 0.73. The lighter it is, the farther out it has to stand to balance, so this knob moves the balance place as well as the disc.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = H / 2;
// The panel's diagonal, one LED across for every two down, as a unit step.
const DX = 1 / Math.sqrt(5);
const DY = 2 / Math.sqrt(5);
// How far from the middle of the panel, up the diagonal, the big disc's middle stands.
const BACK = 16;
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

// What a disc of radius r adds up to when each LED lights by how much of it the rim leaves: the area, and a sliver (pi / 12) the soft rim adds.
function weight(r) {
  return Math.PI * r * r + Math.PI / 12;
}

// How far along the diagonal the small disc stands for a knob at k: `near` at -1, `balance` all through the held clicks, `far` at 1.
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
  params.rb = 13.5;
  params.rs = 9.9;
  params.out = 30;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const rb = (15 + 6 * clamp(k[1], 0, 3)) / 2;
  const share = 0.72 + 0.2 * clamp(k[3], 0, 1);
  const rs = rb * share;
  params.rb = rb;
  params.rs = rs;
  // The small disc balances the big one BACK LEDs up the diagonal when its own middle is BACK times the big one's weight over its own weight down it. That is the place the knob holds at.
  const balance = (BACK * weight(rb)) / weight(rs);
  // Near, the two discs are 4 LEDs apart rim to rim (and never past the middle of the panel). Far, the small disc is 2 LEDs from the right-hand wall or the bottom wall, whichever it reaches first.
  const near = Math.max(3, rb + rs + 4 - BACK);
  const far = Math.min((W / 2 - 2 - rs) / DX, (H / 2 - 2 - rs) / DY);
  params.out = reach(clamp(k[2], -1, 1), near, balance, far);
  // Neither disc's size or place moves on the clock, so the balance stays exactly where the knob says. The colour wanders a few degrees and the light swells and falls, both discs together, only so the panel is never quite still.
  hsv(k[0] + 0.1 + 0.03 * Math.sin(t * 0.43), 0.85, 0.88 + 0.12 * Math.sin(t * 0.61 + 1), params.col);
}

export function draw(display, params, time) {
  const { rb, rs, col } = params;
  const bx = CX - BACK * DX;
  const by = CY - BACK * DY;
  const sx = CX + params.out * DX;
  const sy = CY + params.out * DY;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // How much of this LED each disc covers, from its distance to the disc's middle. The two never touch, so the two add.
      const db = Math.hypot(x + 0.5 - bx, y + 0.5 - by);
      const ds = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
      const a = rb + 0.5 - db;
      const b = rs + 0.5 - ds;
      let m = (a > 0 ? (a > 1 ? 1 : a) : 0) + (b > 0 ? (b > 1 ? 1 : b) : 0);
      m = m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
