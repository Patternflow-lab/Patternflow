// ===== Patternflow pattern =====
// Title:   Verso
// Family:  geometry
// Idea:    One tall triangle stands in the dark and a knob walks a vertical crease across it from the right, folding its right side over onto the rest: the knob holds for three clicks where the crease is under the apex and the folded side lies exactly on the rest, so the bright front is gone and a dim right triangle is all that is left.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 183
// Round:   185
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Crease=-25..23, Slant=0.06..1
//
// Knob 1: Hue. The colour of the triangle, all the way round the wheel from a violet. The folded side shows its back, the same colour at 40 percent.
// Knob 2: Size. The triangle's base, 24 LEDs at the bottom of the knob to 42 at the top; it opens at 36. It is 2.1 times as tall as the base is long.
// Knob 3: Crease. Where the vertical crease stands, in clicks, 48 of them; the side of the triangle to the right of the crease is folded over to the left. Where it opens the crease is 8.7 LEDs right of the apex and a dim corner 9 LEDs wide lies folded at the bottom right. Turn up 9 clicks and the crease is under the apex: the folded side lies exactly on the rest, the bright front is gone and the knob holds there for three clicks. Eight clicks either side of the hold walk the crease 1.05 LEDs each, and the folded edge walks twice that. Past the hold the crease goes left of the apex and the folded side hangs out to the left as a dim shape. Further from the hold the walk is slower.
// Knob 4: Slant. How far the crease leans, 0 to 10 degrees. Its top stays level with the apex and its lower end swings left, toward the part that stays, so the fold gets deeper. It opens at 0.06, upright. At the hold the front stays gone at every slant, and the dim shape grows a wing to the left.

const W = 64;
const H = 128;
// The knob has 48 clicks. The crease stands under the apex for three of them.
const CLICKS = 48;
const HOLD = 34;
const OPEN = 25;
// LEDs a click walks the crease in the eight clicks beside the hold.
const STEP = 1.05;
const NEAR = 8;
// The panel's centre is 32. The apex is a little right of it, so that the picture with its right side folded away stands near the middle.
const APEX = 40;
const TALL = 2.1;
const BACK = 0.4;
const SAT = 0.75;
const PEAK = 0.95;
// The first colour: a violet.
const BASE = 0.78;
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

// LEDs the crease stands right of the apex at click q: above zero before the hold, zero for its three clicks, below zero after. Past the eight near clicks the walk slows and ends short of where the folded side would meet the left wall.
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

// The triangle's coverage and the folded side's coverage at every LED, by sixteen samples each.
function fold(params, w, tall, cx, theta) {
  const top = H / 2 - tall / 2;
  const nx = -Math.cos(theta);
  const ny = -Math.sin(theta);
  const eps = 1e-7;
  const inside = (x, y) => {
    const f = (y - top) / tall;
    return f >= -eps && f <= 1 + eps && Math.abs(x - APEX) <= w * f + eps;
  };
  params.lum.fill(0);
  const y0 = Math.max(0, Math.floor(top) - 1);
  const y1 = Math.min(H, Math.ceil(top + tall) + 1);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < W; x++) {
      let front = 0;
      let back = 0;
      for (let j = 0; j < SUB; j++) {
        for (let i = 0; i < SUB; i++) {
          const px = x + (i + 0.5) / SUB;
          const py = y + (j + 0.5) / SUB;
          // Only the left of the crease is paper: the right side has been folded over it.
          const d = (px - cx) * nx + (py - top) * ny;
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
  const w = (24 + 6 * size) / 2;
  const tall = TALL * 2 * w;
  const q = clamp(k[2], -OPEN, CLICKS - OPEN) + OPEN;
  const theta = ((clamp(k[3], 0.06, 1) - 0.06) / 0.94) * (10 * Math.PI) / 180;
  const key = size + "," + q + "," + theta;
  if (key !== params.key) {
    params.key = key;
    fold(params, w, tall, APEX + offset(q, Math.max(0.92 * w, STEP * NEAR + 0.4), (APEX - w) / 2 - 0.4), theta);
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
