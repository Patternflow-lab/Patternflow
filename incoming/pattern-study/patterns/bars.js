// ===== Patternflow pattern =====
// Title:   Bars
// Family:  geometry
// Idea:    A few upright bars of one thickness stand the same gap apart in the middle of the dark, and how many there are, how thick and how far apart are the knobs, with nothing else on the panel.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 138
// Round:   140
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=0..3, Thickness=-1..1, Gap=-1..1
//
// Knob 1: Hue. The colour of the bars, turned round the wheel.
// Knob 2: Count. How many bars there are, from 1 at the left to 7 at the right, rounded to a whole number; the knob's 2 is 5.
// Knob 3: Thickness. How thick each bar is, from 2.6 LEDs at the left to 11.6 at the right; its 0 is 5.5.
// Knob 4: Gap. How far apart the bars stand, from 1 LED at the left to 8 at the right; the knob's 0.06 is 4.7. When the row would run wider than the panel the gaps close up until it fits, so past that point the knob stops opening them.

const W = 64;
const H = 128;
const BAR_H = 80;
const FIT = 58;

function hsv(h, s, v, out, at) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[at] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[at + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[at + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

export function setup(params) {
  params.t = 0;
  params.n = 5;
  params.th = 6;
  params.gap = 3.5;
  params.x0 = 10;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  let n = Math.round(1 + 2 * k[1]);
  n = n < 1 ? 1 : n > 7 ? 7 : n;
  // The slow breath thickens and thins the bars and breathes the gaps a few percent.
  let th = 5.5 * Math.exp(0.75 * k[2]) * (1 + 0.07 * Math.sin(t * 0.47));
  let gap = (4.5 + 3.5 * k[3]) * (1 + 0.07 * Math.sin(t * 0.37 + 1));
  // Count and thickness are what the knobs say. The gaps give way when the row would be wider than the panel.
  if (n * th > FIT) th = FIT / n;
  if (n * th + (n - 1) * gap > FIT) gap = n > 1 ? (FIT - n * th) / (n - 1) : 0;
  params.n = n;
  params.th = th;
  params.gap = gap;
  params.x0 = (W - (n * th + (n - 1) * gap)) / 2;
  hsv(k[0] + 0.12, 0.85, 1, params.col, 0);
}

export function draw(display, params, time) {
  const n = params.n;
  const th = params.th;
  const pitch = params.th + params.gap;
  const x0 = params.x0;
  const col = params.col;
  const y0 = (H - BAR_H) / 2;
  for (let y = 0; y < H; y++) {
    // How much of this row the bars' height covers.
    let vy = Math.min(y + 1, y0 + BAR_H) - Math.max(y, y0);
    vy = vy < 0 ? 0 : vy;
    for (let x = 0; x < W; x++) {
      let m = 0;
      if (vy > 0) {
        // How much of this column the bars cover: the one or two bars it touches, by the share of the LED each fills.
        const i0 = Math.floor((x - x0) / pitch);
        for (let i = i0; i <= i0 + 1; i++) {
          if (i < 0 || i >= n) continue;
          const bx = x0 + i * pitch;
          const cover = Math.min(x + 1, bx + th) - Math.max(x, bx);
          if (cover > 0) m += cover;
        }
        m = m > 1 ? 1 : m;
        m *= vy;
      }
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
