// ===== Patternflow pattern =====
// Title:   Hem
// Family:  geometry
// Idea:    One bar lies across the dark panel and a knob walks it up into the ceiling, where a crease turns the part above the panel back down: the knob holds for three clicks where the middle of the bar is on the ceiling, the turned half lies exactly on the rest, so the bright front is gone and a dim bar half as thick is all that is left.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 183
// Round:   185
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Height=-19..29, Slant=0.06..1
//
// Knob 1: Hue. The colour of the bar, all the way round the wheel from a teal. The turned part shows its back, the same colour at 40 percent.
// Knob 2: Size. The bar's thickness, 16 LEDs at the bottom of the knob to 34 at the top; it opens at 28. Its length stays 62 LEDs.
// Knob 3: Height. How high the bar stands, in clicks, 48 of them; the crease is the ceiling, and whatever of the bar is above it is turned back down. Where it opens the middle of the bar is 9.5 LEDs below the ceiling and its top edge is already through, so a dim strip 4.5 LEDs thick hangs from the ceiling over the bright bar. Turn up 9 clicks and the middle of the bar is on the ceiling: the turned half lies exactly on the rest, the bright front is gone and the knob holds there for three clicks. Every click either side of the hold walks the bar 1.05 LEDs. Past the hold the bar goes on up and its dim copy comes down from the ceiling, until the whole bar is turned and slides away down the panel.
// Knob 4: Slant. How far the bar leans, 0 to 10 degrees, turning about the middle of its left end with the right end rising into the ceiling, so more of it is turned. It opens at 0.06, level. At the hold the front stays gone at every slant.

const W = 64;
const H = 128;
// The knob has 48 clicks. The middle of the bar is on the ceiling for three of them.
const CLICKS = 48;
const HOLD = 28;
const OPEN = 19;
// LEDs a click walks the bar.
const STEP = 1.05;
const LONG = 62;
const BACK = 0.4;
const SAT = 0.75;
const PEAK = 0.95;
// The first colour: a teal.
const BASE = 0.48;
const SUB = 4;

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

// LEDs the middle of the bar is below the ceiling at click q: above zero before the hold, zero for its three clicks, below zero after.
function drop(q) {
  if (q < HOLD) return STEP * (HOLD - q);
  if (q <= HOLD + 2) return 0;
  return -STEP * (q - HOLD - 2);
}

export function setup(params) {
  params.t = 0;
  params.key = "";
  params.col = new Float32Array(3);
  params.lum = new Float32Array(W * H);
}

// The bar's coverage and the turned part's coverage at every LED, by sixteen samples each.
function fold(params, thick, mid, theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const eps = 1e-7;
  // The bar's own axes, turning about the middle of its left end: along it, falling to the right, and across it.
  const left = (W - LONG) / 2;
  const inside = (x, y) => {
    const along = (x - left) * c + (y - mid) * s;
    const across = -(x - left) * s + (y - mid) * c;
    return along >= -eps && along <= LONG + eps && Math.abs(across) <= thick / 2 + eps;
  };
  params.lum.fill(0);
  const reach = LONG * Math.abs(s) + (thick / 2) * c;
  // The bar is above or below the ceiling; its turned copy is as far below as the bar is above.
  const y1 = clamp(Math.ceil(Math.abs(mid) + reach) + 1, 0, H);
  for (let y = 0; y < y1; y++) {
    for (let x = 0; x < W; x++) {
      let front = 0;
      let back = 0;
      for (let j = 0; j < SUB; j++) {
        for (let i = 0; i < SUB; i++) {
          const px = x + (i + 0.5) / SUB;
          const py = y + (j + 0.5) / SUB;
          // The crease is the ceiling: what is above it is turned down to the same place below it.
          if (inside(px, -py)) back++;
          else if (inside(px, py)) front++;
        }
      }
      params.lum[y * W + x] = (front + BACK * back) / (SUB * SUB);
    }
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const size = clamp(k[1], 0, 3);
  const thick = 16 + 6 * size;
  const q = clamp(k[2], -OPEN, CLICKS - OPEN) + OPEN;
  const theta = -((clamp(k[3], 0.06, 1) - 0.06) / 0.94) * (10 * Math.PI) / 180;
  const key = size + "," + q + "," + theta;
  if (key !== params.key) {
    params.key = key;
    fold(params, thick, drop(q), theta);
  }
  // One colour and one breath for both faces, so the crease is the only seam.
  hsv(k[0] + BASE + 0.02 * Math.sin(t * 0.43), SAT, PEAK * (0.84 + 0.16 * Math.sin(t * 1.2 + 2.1)), params.col);
}

export function draw(display, params, time) {
  const { col, lum } = params;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = lum[y * W + x];
      display.setPixel(x, y, col[0] * c, col[1] * c, col[2] * c);
    }
  }
}
