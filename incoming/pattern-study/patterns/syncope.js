// ===== Patternflow pattern =====
// Title:   Syncope
// Family:  geometry
// Idea:    Seven squares stand in a column on the left of the panel and one knob trades their size between the odd ones and the even ones, so every other square shrinks to nothing: at the end of the knob four squares, or three, are left, and the knob holds there for three clicks.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 173
// Round:   175
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=0..2, Balance=-11..37, Stray=0.06..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from amber.
// Knob 2: Count. How many squares stand in the column, five in the lower half of the knob and seven in the upper half; it opens on seven. They are 20 LEDs on a side at five and 14 at seven, and the column fills the height of the panel either way.
// Knob 3: Balance. How the size is shared between the odd squares (the 1st, 3rd, 5th and 7th, counted from the top) and the even ones. It opens with the odd squares about two thirds of the even in size. Turned down, the odd squares shrink, a LED or so across 8 clicks on, and are gone for the last three clicks of the knob, which hold: only the even squares are left. Turned up, they grow until all are alike 13 clicks on. Past that the even squares shrink the same way and are gone at the top of the knob, held for three clicks. The eight clicks next to each hold change the small squares by more than a LED a click.
// Knob 4: Stray. How far the even squares have moved to the right of the column, up to 28 LEDs. It opens with them in line.

const W = 64;
const H = 128;
// Knob 3 has 48 clicks and opens 11 above its bottom.
const OPEN = 11;
const STRAY_MAX = 28;
// The column's middle, counted from the left wall.
const COLUMN = 20;
// Side, in LEDs, at five squares and at seven: full size, and the size 8 clicks from a hold. The spacing from one square's middle to the next is 24 and 18.
const FULL = [20, 14];
const KNEE = [10, 8.5];
const PITCH = [24, 18];

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

// The side of a square that is u clicks from a hold: nothing at the hold, more than a LED a click for the next eight, then slower up to full size 22 clicks out.
function grow(u, full, knee) {
  if (u <= 0) return 0;
  if (u <= 8) return (knee * u) / 8;
  if (u >= 22) return full;
  return knee + ((full - knee) * (u - 8)) / 14;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.m = new Float32Array(W * H);
  params.n = 7;
  params.odd = 14;
  params.even = 14;
  params.stray = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = k[1] < 1 ? 5 : 7;
  const w = n === 5 ? 0 : 1;
  const c = clamp(k[2] + OPEN, 0, 48);
  params.n = n;
  // Counted from the top, the first square is odd. At the bottom of the knob the odd ones are gone and at the top the even ones are.
  params.odd = c <= 24 ? grow(c - 2, FULL[w], KNEE[w]) : FULL[w];
  params.even = c >= 24 ? grow(46 - c, FULL[w], KNEE[w]) : FULL[w];
  params.stray = (STRAY_MAX * clamp(k[3] - 0.06, 0, 0.94)) / 0.94;
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.1 + 0.02 * Math.sin(t * 0.41), 0.86, 0.84 + 0.16 * Math.sin(t * 0.63 + 0.7), params.col);
}

export function draw(display, params, time) {
  const { col, m, n, odd, even, stray } = params;
  m.fill(0);
  const w = n === 5 ? 0 : 1;
  for (let i = 0; i < n; i++) {
    const s = i % 2 === 0 ? odd : even;
    if (s < 0.05) continue;
    const cx = COLUMN + (i % 2 === 1 ? stray : 0);
    const cy = H / 2 + (i - (n - 1) / 2) * PITCH[w];
    const xa = cx - s / 2;
    const xb = cx + s / 2;
    const ya = cy - s / 2;
    const yb = cy + s / 2;
    const x0 = Math.max(0, Math.floor(xa));
    const x1 = Math.min(W - 1, Math.floor(xb));
    const y0 = Math.max(0, Math.floor(ya));
    const y1 = Math.min(H - 1, Math.floor(yb));
    for (let y = y0; y <= y1; y++) {
      const ay = span(ya, yb, y);
      for (let x = x0; x <= x1; x++) m[y * W + x] = ay * span(xa, xb, x);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = m[y * W + x];
      display.setPixel(x, y, col[0] * a, col[1] * a, col[2] * a);
    }
  }
}
