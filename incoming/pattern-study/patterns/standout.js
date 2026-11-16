// ===== Patternflow pattern =====
// Title:   Standout
// Family:  geometry
// Idea:    A column of equal squares stands evenly down the middle of a bare dark panel and one of them is bigger than the rest, and the four knobs are the colour, how many squares there are, how much bigger the odd one is and which one it is: the size knob holds where the odd square just touches the squares either side of it.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 155
// Round:   157
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=0..4, Grow=-1..1, Which=-1..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from violet.
// Knob 2: Count. How many squares there are, 3 at 0 to 7 at 4, rounded to a whole number; its 2 is 5. The column keeps to the panel, so the squares get smaller as there are more of them: 20 LEDs a side for 3, 12 for 5, 8 for 7, a step of 30, 20 and 14 LEDs from one middle to the next.
// Knob 3: Grow. How much bigger the odd square is than the others: the same size at -1, and past the middle its edges reach the squares either side of it. They touch at 0.208 and the knob holds there for three clicks, from 0.167 to 0.25. Past that it overlaps them and the overlap goes dark, up to a third of a square deep at 1. Its 0 is four clicks short of the touch.
// Knob 4: Which. Which square is the odd one: the top one at -1, the bottom one at 1 and the middle one at about 0. With an even count the middle is a square off one way or the other; its 0.06 is that.

const W = 64;
const H = 128;
// One click of a knob that has 48 clicks over -1..1. The odd square touches its neighbours five clicks past the knob's middle, and the knob holds for a click either side.
const CLICK = 2 / 48;
const STOP = 5 * CLICK;
// For 3 to 7 squares: the side of one, and the step down the column from one middle to the next. Both are even, so every middle is on a line between two LEDs and every edge falls between two LEDs. The odd square touches its neighbours when it is two steps wide less one square, 40 LEDs for 3 squares and 28 for 5, and they sit edge to edge with no LED of the gap left.
const SIZE = [20, 16, 12, 10, 8];
const STEP = [30, 24, 20, 16, 14];

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

// How wide the odd square is, in LEDs, for a knob at c: as wide as the others at -1, exactly the touching width all through the held clicks, and a little past it at 1. Between those it runs straight, so it is the touching width nowhere else.
function oddSize(c, size, touch, most) {
  const a0 = STOP - CLICK;
  const a1 = STOP + CLICK;
  if (c >= a0 - 1e-6 && c <= a1 + 1e-6) return touch;
  if (c < a0) return size + ((touch - size) * (c + 1)) / (a0 + 1);
  return touch + ((most - touch) * (c - a1)) / (1 - a1);
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.m = new Float32Array(W * H);
  params.n = 5;
  params.size = 12;
  params.step = 20;
  params.odd = 2;
  params.big = 28;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = clamp(Math.round(3 + clamp(k[1], 0, 4)), 3, 7);
  const size = SIZE[n - 3];
  const step = STEP[n - 3];
  const touch = 2 * step - size;
  params.n = n;
  params.size = size;
  params.step = step;
  params.big = oddSize(clamp(k[2], -1, 1), size, touch, touch + 0.6 * size);
  // Which square, counted from the top: the middle one at 0, the first at -1 and the last at 1.
  const mid = (n - 1) / 2;
  params.odd = clamp(Math.round(mid + clamp(k[3], -1, 1) * mid), 0, n - 1);
  // Neither the sizes nor the places move on the clock, so the touch means exactly touching. The colour wanders a few degrees and the light swells and falls, all the squares together, only so the panel is never quite still.
  hsv(k[0] + 0.74 + 0.03 * Math.sin(t * 0.41), 0.8, 0.86 + 0.14 * Math.sin(t * 0.57 + 2), params.col);
}

export function draw(display, params, time) {
  const { n, size, step, odd, big, col, m } = params;
  m.fill(0);
  for (let i = 0; i < n; i++) {
    const r = (i === odd ? big : size) / 2;
    const cx = W / 2;
    const cy = H / 2 + (i - (n - 1) / 2) * step;
    const ya = Math.max(0, Math.floor(cy - r));
    const yb = Math.min(H - 1, Math.ceil(cy + r) - 1);
    const xa = Math.max(0, Math.floor(cx - r));
    const xb = Math.min(W - 1, Math.ceil(cx + r) - 1);
    for (let y = ya; y <= yb; y++) {
      const cover = span(cy - r, cy + r, y);
      for (let x = xa; x <= xb; x++) {
        // How much of this LED the square covers. Where two squares cover the same LED the LED goes dark, so the two still read as two.
        const c = cover * span(cx - r, cx + r, x);
        const v = m[y * W + x];
        m[y * W + x] = v + c - 2 * v * c;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = m[y * W + x];
      display.setPixel(x, y, col[0] * v, col[1] * v, col[2] * v);
    }
  }
}
