// ===== Patternflow pattern =====
// Title:   Gatefold
// Family:  geometry
// Idea:    One square stands against the left wall and a knob walks a vertical crease across it from the right, folding its right side back over the rest: the knob holds for three clicks where the crease is in the middle, the folded edge lands on the wall and the folded side lies exactly on the rest, so the bright front is gone and a dim half-width block is all that is left.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 183
// Round:   185
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Crease=-15..33, Slant=0.06..1
//
// Knob 1: Hue. The colour of the square, all the way round the wheel from a pink. The folded side shows its back, the same colour at 40 percent.
// Knob 2: Size. The square's side, 28 LEDs at the bottom of the knob to 52 at the top; it opens at 44. Its left side stays on the wall.
// Knob 3: Crease. Where the vertical crease stands, in clicks, 48 of them; the side of the square to the right of the crease is folded over to the left. Where it opens the crease is 9.1 LEDs right of the middle of the square, a bright strip 18 LEDs wide stands against the wall and a dim strip lies folded beside it. Turn up 9 clicks and the crease is in the middle: the folded edge lies on the wall, the bright strip is gone and the knob holds there for three clicks. Eight clicks either side of the hold walk the crease 1.05 LEDs each, and the folded edge walks twice that. Past the hold the crease goes left of the middle and the folded edge goes through the wall, so the dim block gets narrower. Further from the hold the walk is slower.
// Knob 4: Slant. How far the crease leans, 0 to 10 degrees, about a point on the panel's floor, with its top swinging right toward the folded side. It opens at 0.06, upright, which is the only slant where the hold leaves no front.

const W = 64;
const H = 128;
// The knob has 48 clicks. The crease stands in the middle of the square for three of them.
const CLICKS = 48;
const HOLD = 24;
const OPEN = 15;
// LEDs a click walks the crease in the eight clicks beside the hold.
const STEP = 1.05;
const NEAR = 8;
const BACK = 0.4;
const SAT = 0.75;
const PEAK = 0.95;
// The first colour: a pink.
const BASE = 0.92;
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

// LEDs the crease stands right of the middle of the square at click q: above zero before the hold, zero for its three clicks, below zero after. Past the eight near clicks the walk slows, and it ends with 3 LEDs of fold on the right and 4 LEDs of block at the wall.
function offset(q, far, post) {
  if (q < HOLD) {
    const m = HOLD - q;
    return m <= NEAR ? STEP * m : STEP * NEAR + ((far - STEP * NEAR) * (m - NEAR)) / (HOLD - NEAR);
  }
  if (q <= HOLD + 2) return 0;
  const m = q - HOLD - 2;
  return -(m <= NEAR ? STEP * m : STEP * NEAR + ((post - STEP * NEAR) * (m - NEAR)) / (CLICKS - HOLD - 2 - NEAR));
}

export function setup(params) {
  params.t = 0;
  params.key = "";
  params.col = new Float32Array(3);
  params.lum = new Float32Array(W * H);
}

// The square's coverage and the folded side's coverage at every LED, by sixteen samples each.
function fold(params, s, cx, theta) {
  const top = H / 2 - s / 2;
  const bottom = H / 2 + s / 2;
  const nx = -Math.cos(theta);
  const ny = -Math.sin(theta);
  const eps = 1e-7;
  const inside = (x, y) => x >= -eps && x <= s + eps && y >= top - eps && y <= bottom + eps;
  params.lum.fill(0);
  const y0 = Math.max(0, Math.floor(top) - 1);
  const y1 = Math.min(H, Math.ceil(bottom) + 1);
  const x1 = Math.min(W, Math.ceil(s) + 1);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < x1; x++) {
      let front = 0;
      let back = 0;
      for (let j = 0; j < SUB; j++) {
        for (let i = 0; i < SUB; i++) {
          const px = x + (i + 0.5) / SUB;
          const py = y + (j + 0.5) / SUB;
          // Only the left of the crease is paper: the right side has been folded over it.
          const d = (px - cx) * nx + (py - H) * ny;
          if (d <= 0) continue;
          if (inside(px - 2 * d * nx, py - 2 * d * ny)) back++;
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
  const s = 28 + 8 * size;
  const q = clamp(k[2], -OPEN, CLICKS - OPEN) + OPEN;
  const theta = ((clamp(k[3], 0.06, 1) - 0.06) / 0.94) * (10 * Math.PI) / 180;
  const key = size + "," + q + "," + theta;
  if (key !== params.key) {
    params.key = key;
    fold(params, s, s / 2 + offset(q, s / 2 - 3, s / 2 - 4), theta);
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
