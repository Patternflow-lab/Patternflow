// ===== Patternflow pattern =====
// Title:   Slab
// Family:  geometry
// Idea:    One rectangle stands in the middle of the dark, and its width, its height and its turn are the knobs, with nothing else on the panel.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 138
// Round:   140
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Width=0..3, Height=-1..1, Turn=0..1
//
// Knob 1: Hue. The colour of the rectangle, turned round the wheel.
// Knob 2: Width. How wide the rectangle is, from 10 LEDs at the left to 58 at the right; the knob's 2 is 42.
// Knob 3: Height. How tall it is, from 14 LEDs at the left to 110 at the right; its 0 is 62.
// Knob 4: Turn. How far it is turned about its middle, from upright at the left to a quarter turn at the right.

const W = 64;
const H = 128;

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
  params.hw = 20;
  params.hh = 30;
  params.c = 1;
  params.s = 0;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swells the width a few percent and rocks the rectangle a few degrees.
  const w = (10 + (48 * k[1]) / 3) * (1 + 0.06 * Math.sin(t * 0.47));
  const h = 62 + 48 * k[2];
  const a = ((90 * k[3] + 4 * Math.sin(t * 0.31 + 2)) * Math.PI) / 180;
  params.hw = w / 2;
  params.hh = h / 2;
  params.c = Math.cos(a);
  params.s = Math.sin(a);
  hsv(k[0] + 0.99, 0.78, 1, params.col, 0);
}

export function draw(display, params, time) {
  const hw = params.hw;
  const hh = params.hh;
  const c = params.c;
  const s = params.s;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      // The LED in the rectangle's own frame, and its signed distance to the rectangle, negative inside.
      const u = c * dx + s * dy;
      const v = -s * dx + c * dy;
      const qx = Math.abs(u) - hw;
      const qy = Math.abs(v) - hh;
      const ox = qx > 0 ? qx : 0;
      const oy = qy > 0 ? qy : 0;
      const sd = Math.sqrt(ox * ox + oy * oy) + (qx > qy ? (qx < 0 ? qx : 0) : qy < 0 ? qy : 0);
      let m = 0.5 - sd;
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
