// ===== Patternflow pattern =====
// Title:   Norm Rings
// Family:  geometry
// Idea:    Bands of equal width round the middle of the panel, each the set of points whose x to the power p plus y to the power p is the same, so one exponent turns the rings from a four-pointed star through a diamond and a circle to a rounded square and at last a plain square.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Lame curves, the level lines of the p-norm (Gabriel Lame, 1818, year from memory), the superellipse (Piet Hein, 1959, year from memory), original, pattern round 132
// Round:   132
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Shape=0..4, Rings=0..1, Stretch=-1..1
//
// Knob 1: Hue. Turns the first band's colour round the wheel; each band outward is a step further round.
// Knob 2: Shape. The exponent that sets what the rings are. At 0 it is 0.55 and the rings are four-pointed stars; at 0.7 it is 1 and they are diamonds; at 1.5 it is 2 and they are ellipses; at 2 it is 3.2, the rounded squares it opens on; at 4 it is 18 and they are rectangles with the corners only just taken off.
// Knob 3: Rings. How many bands fit between the middle and the side of the panel, from 4 to 10.
// Knob 4: Stretch. How tall the rings are against how wide, from a little over square on the left of the knob to two and a half times as tall on the right. The panel is twice as tall as wide.

const W = 64;
const H = 128;

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

export function setup(params) {
  params.t = 0;
  params.hue = 0.88;
  params.p = 3.2;
  params.lam = 10;
  params.asp = 1.65;
  params.phase = 0;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  params.hue = k[0] + 0.88;
  params.p = Math.exp(-0.6 + 0.88 * k[1]) * (1 + 0.03 * Math.sin(params.t * 0.31 + 2));
  params.lam = 32 / (4 + 6 * k[2]);
  params.asp = 1.65 * Math.pow(1.55, k[3] - 0.06);
  params.phase = 0.14 * Math.sin(params.t * 0.55);
}

export function draw(display, params, time) {
  const p = params.p;
  const lam = params.lam;
  const asp = params.asp;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const v = Math.abs(y + 0.5 - H / 2) / asp;
    const vp = Math.pow(v, p);
    for (let x = 0; x < W; x++) {
      const u = Math.abs(x + 0.5 - W / 2);
      const n = Math.pow(Math.pow(u, p) + vp, 1 / p);
      const t = n / lam - params.phase;
      const band = Math.floor(t);
      const f = t - band;
      // How steeply the norm climbs here, in LEDs, so the seam keeps one width all round.
      const nn = n > 1e-6 ? n : 1e-6;
      const gx = Math.pow(u / nn, p - 1);
      const gy = Math.pow(v / nn, p - 1) / asp;
      const grad = Math.max(0.25, Math.sqrt(gx * gx + gy * gy));
      const edge = (Math.min(f, 1 - f) * lam) / grad;
      let k = edge - 0.4 + 0.5;
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      // Each band is brightest on its inner edge and dims outward.
      const shade = 1 - 0.38 * f;
      hsv(params.hue + band * 0.085, 0.88, shade, col);
      display.setPixel(x, y, col[0] * k, col[1] * k, col[2] * k);
    }
  }
}
