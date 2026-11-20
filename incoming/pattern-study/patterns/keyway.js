// ===== Patternflow pattern =====
// Title:   Keyway
// Family:  geometry
// Idea:    Two upright plates in the panel's own proportions, each with a long slot in its middle, lie one on the other, and one knob slides one of them across the other along the panel's diagonal: the panel is dark only where the two slots overlap, a window that keeps the slot's shape as it shrinks into a corner, and the knob holds where the slots fit and at both ends where they have parted and the window is gone.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 194
// Round:   196
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Slot=0..3, Slide=-13..35, Unlike=0.06..1
//
// Knob 1: Hue. The colour of both plates, all the way round the wheel from rose. The two are one colour, so where they overlap they read as one sheet and only the stepped outline tells them apart.
// Knob 2: Slot. The width of the slots, 8 LEDs at the bottom of the knob, 12 where it opens at 2 and 12.8 at the top. A slot is twice as tall as it is wide and a plate is three times its slot each way, so each rim covers the other plate's slot until the two slots part. At the top of the knob the sliding plate fits into a corner of the panel on the click the slots part.
// Knob 3: Slide. How far the sliding plate is off the one that stays put, along the panel's diagonal, counted in clicks. On the bottom three clicks it is a slot's width to the left and a slot's height up, the slots meet only at a corner and there is no window. The next click brings it 2 LEDs across and 4 down and a window 2 LEDs by 4 opens at that corner; each click from there is half a LED across and 1 LED down, and it opens ten clicks on with the window 7 LEDs by 14. Click 23 closes the last step and the two plates are one, the slot whole; the knob holds there for three clicks. Past that the plate goes on down and to the right the same way and the window shrinks into the opposite corner, gone on the top three clicks.
// Knob 4: Unlike. How unlike the two plates are. It opens at the bottom, where they are the same. Turned up, the plate that stays put grows to a quarter bigger and the sliding one shrinks by a quarter, slots and all. Then no click fits: the small slot is whole for a few clicks either side of the middle, and at the ends the small plate has slid off the far corner of the big slot and left an L of dark there.

const W = 64;
const H = 128;
// The middle of the plate that stays put.
const CX = 32;
const CY = 64;
// Knob 3 has 48 clicks and opens on click OPEN.
const OPEN = 13;
// The clicks where the slide turns a corner: shut, the first window, the fit, and the same again on the way out.
const QS = [0, 2, 3, 23, 25, 45, 46, 48];
// The first click off a shut end moves the plate this many LEDs across and on to the next LED boundary, and twice as far down, whatever the size, so the window that opens has two whole dark columns in it.
const STEP = 2;
// How much bigger the last knob makes one plate and smaller the other.
const UNLIKE = 0.25;
// Plate, plate, the two plates' overlap, the two slots' overlap, a slot, that slot under the other plate, and the same pair for the other slot.
const SIGN = [1, 1, -1, -1, -1, 1, -1, 1];

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

// How many LEDs across the sliding plate is off the other on click q, for slots s LEDs wide. It is twice as many down. At -s and s the two slots meet at a corner only, at 0 they fit.
function slideAt(D, q, s) {
  const edge = CX - s / 2;
  const step = STEP + Math.ceil(edge) - edge;
  D[0] = D[1] = -s;
  D[2] = step - s;
  D[3] = D[4] = 0;
  D[5] = s - step;
  D[6] = D[7] = s;
  if (q <= QS[0]) return D[0];
  for (let i = 1; i < 8; i++) if (q <= QS[i]) return D[i - 1] + ((D[i] - D[i - 1]) * (q - QS[i - 1])) / (QS[i] - QS[i - 1]);
  return D[7];
}

// How much of each LED along one side of the panel the stretch from lo to hi covers.
function spans(out, at, n, lo, hi) {
  for (let p = 0; p < n; p++) {
    const v = (hi < p + 1 ? hi : p + 1) - (lo > p ? lo : p);
    out[at + p] = v > 0 ? v : 0;
  }
}

// Rectangle i runs from x0 to x1 and from y0 to y1. One that ends before it starts covers nothing.
function put(P, i, x0, x1, y0, y1) {
  spans(P.cols, i * W, W, x0, x1);
  spans(P.rows, i * H, H, y0, y1);
}

// The lit share of every LED. A plate lights what it covers outside its own slot, so an LED is dark inside the two plates only where both slots are, or where one slot has come out from under the other plate.
function paint(P, s, k, d) {
  // Half the width of each slot. A slot is twice as tall as it is wide.
  const a = (s * (1 + k)) / 2;
  const b = (s * (1 - k)) / 2;
  // The sliding plate goes 2 LEDs down for each LED across, the slope of the panel's diagonal.
  const bx = CX + d;
  const by = CY + 2 * d;
  const max = Math.max;
  const min = Math.min;
  // The plates are three times their slots each way.
  const ax0 = CX - 3 * a;
  const ax1 = CX + 3 * a;
  const ay0 = CY - 6 * a;
  const ay1 = CY + 6 * a;
  const bx0 = bx - 3 * b;
  const bx1 = bx + 3 * b;
  const by0 = by - 6 * b;
  const by1 = by + 6 * b;
  put(P, 0, ax0, ax1, ay0, ay1);
  put(P, 1, bx0, bx1, by0, by1);
  put(P, 2, max(ax0, bx0), min(ax1, bx1), max(ay0, by0), min(ay1, by1));
  put(P, 3, max(CX - a, bx - b), min(CX + a, bx + b), max(CY - 2 * a, by - 2 * b), min(CY + 2 * a, by + 2 * b));
  put(P, 4, CX - a, CX + a, CY - 2 * a, CY + 2 * a);
  put(P, 5, max(CX - a, bx0), min(CX + a, bx1), max(CY - 2 * a, by0), min(CY + 2 * a, by1));
  put(P, 6, bx - b, bx + b, by - 2 * b, by + 2 * b);
  put(P, 7, max(bx - b, ax0), min(bx + b, ax1), max(by - 2 * b, ay0), min(by + 2 * b, ay1));
  const { cols, rows, cover } = P;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let i = 0; i < 8; i++) v += SIGN[i] * cols[i * W + x] * rows[i * H + y];
      cover[y * W + x] = clamp(v, 0, 1);
    }
  }
}

export function setup(params) {
  params.t = 0;
  params.rgb = new Float32Array(3);
  params.P = { cols: new Float32Array(8 * W), rows: new Float32Array(8 * H), cover: new Float32Array(W * H) };
  params.D = new Float32Array(8);
  params.key = "";
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const z = clamp(k[1], 0, 3);
  const s = z < 2 ? 8 + 2 * z : 12 + 0.8 * (z - 2);
  // The last knob opens at 0.06, the bottom of its travel, where the two plates are the same.
  const unlike = UNLIKE * clamp((k[3] - 0.06) / 0.94, 0, 1);
  const d = slideAt(params.D, clamp(k[2], -OPEN, 48 - OPEN) + OPEN, s);
  const key = s + "/" + unlike + "/" + d;
  if (key !== params.key) {
    params.key = key;
    paint(params.P, s, unlike, d);
  }
  // Nothing on the panel moves on the clock. The light swells and falls a little so the panel is never quite still.
  const breath = 0.9 + 0.1 * Math.sin(t * 0.97 + 0.72);
  hsv(k[0] + 0.93, 0.5, 0.88 * breath, params.rgb);
}

export function draw(display, params, time) {
  const { rgb } = params;
  const { cover } = params.P;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = cover[y * W + x];
      display.setPixel(x, y, rgb[0] * c, rgb[1] * c, rgb[2] * c);
    }
  }
}
