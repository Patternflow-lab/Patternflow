// ===== Patternflow pattern =====
// Title:   Bulge Checks
// Family:  geometry
// Idea:    A two-colour checkerboard seen through one round lens in the middle of the panel, so every square keeps its four straight-sided neighbours but swells where the lens is strongest and sits at its true size outside it, and a pinch instead of a bulge squeezes the same squares small.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the checkerboard bent by a radial map, as in Victor Vasarely's Vega series (1968, year from memory), original, pattern round 133
// Round:   133
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Bulge=0..2.5, Checks=-1..1, Turn=0..1
//
// Knob 1: Hue. Turns the light squares round the wheel; the dark ones sit just over half a wheel from them.
// Knob 2: Bulge. How strongly the lens bends the board. At the left it pinches, and the squares in the middle are half their size; a little right of a quarter of the knob the board is flat; at the right the middle square is as wide as the panel.
// Knob 3: Checks. The size of a square away from the lens, from 7 LEDs to 19; the middle is 12.
// Knob 4: Turn. How far the board is turned under the lens, from square to the panel to 45 degrees.

const W = 64;
const H = 128;
const LENS = 38;

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
  params.m = 0.67;
  params.cell = 12;
  params.cos = 1;
  params.sin = 0;
  params.light = new Float32Array(3);
  params.dark = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // The lens scales the board toward the middle by one minus m at the centre and by nothing far away: m below 0 pinches, above 0 bulges.
  params.m = Math.max(-0.6, Math.min(0.94, -0.5 + 0.585 * k[1])) * (1 + 0.06 * Math.sin(params.t * 0.4));
  params.cell = 12 * Math.pow(1.6, k[2]);
  const turn = (k[3] * 45 + 1.2 * Math.sin(params.t * 0.3 + 1)) * (Math.PI / 180);
  params.cos = Math.cos(turn);
  params.sin = Math.sin(turn);
  hsv(k[0] + 0.1, 0.8, 1, params.light);
  hsv(k[0] + 0.66, 0.9, 0.3, params.dark);
}

export function draw(display, params, time) {
  const m = params.m;
  const cell = params.cell;
  const cs = params.cos;
  const sn = params.sin;
  const light = params.light;
  const dark = params.dark;
  const inv = 1 / cell;
  const lens2 = 1 / (LENS * LENS);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let on = 0;
      // Four samples to a LED, so the curved edges come out smooth.
      for (let s = 0; s < 4; s++) {
        const px = x + 0.25 + 0.5 * (s & 1) - W / 2;
        const py = y + 0.25 + 0.5 * (s >> 1) - H / 2;
        const g = 1 - m * Math.exp(-(px * px + py * py) * lens2);
        const qx = px * g;
        const qy = py * g;
        const u = (qx * cs + qy * sn) * inv;
        const v = (-qx * sn + qy * cs) * inv;
        on += (Math.floor(u) + Math.floor(v)) & 1;
      }
      const c = on / 4;
      display.setPixel(
        x,
        y,
        dark[0] + (light[0] - dark[0]) * c,
        dark[1] + (light[1] - dark[1]) * c,
        dark[2] + (light[2] - dark[2]) * c
      );
    }
  }
}
