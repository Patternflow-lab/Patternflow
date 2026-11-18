// ===== Patternflow pattern =====
// Title:   Ellipse
// Family:  geometry
// Idea:    One ellipse stands on a bare dark ground, and the length of its long axis, how much shorter its short axis is and which way the long axis points are the knobs.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 144
// Round:   146
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Long=0..3, Short=-1..1, Turn=0..1
//
// Knob 1: Hue. The colour of the shape, turned round the wheel.
// Knob 2: Long. How long the long axis is, from 26 LEDs at the left to 58 at the right; the knob's 2 is 47. It never passes the panel's 64 LEDs of width, so the ellipse fits at every turn.
// Knob 3: Short. How long the short axis is as a share of the long one, from a thin 12 percent at the left to a true circle at the right; its 0 is 56 percent.
// Knob 4: Turn. Which way the long axis points, from straight up at the left through level at the half way mark to straight up again at the right; its 0.06 is just off upright.

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
  params.a = 23;
  params.b = 13;
  params.c = 1;
  params.s = 0;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath lengthens the long axis and the short one a few percent each and rocks the ellipse a few degrees.
  const long = (26 + (32 * k[1]) / 3) * (1 + 0.07 * Math.sin(t * 0.47));
  let share = (0.56 + 0.44 * k[2]) * (1 + 0.06 * Math.sin(t * 0.37 + 1));
  share = share < 0.12 ? 0.12 : share > 1 ? 1 : share;
  const a = long / 2;
  params.a = a;
  params.b = a * share;
  const turn = ((180 * k[3] + 8 * Math.sin(t * 0.31 + 2)) * Math.PI) / 180;
  params.c = Math.cos(turn);
  params.s = Math.sin(turn);
  // At 0 the hue knob would open on red; the ellipse starts on azure.
  hsv(k[0] + 0.58, 0.8, 1, params.col, 0);
}

export function draw(display, params, time) {
  const a = params.a;
  const b = params.b;
  const c = params.c;
  const s = params.s;
  const col = params.col;
  const a2 = a * a;
  const b2 = b * b;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      // The LED in the ellipse's own frame: u along the long axis, v across it. At turn 0 the long axis stands up the panel.
      const u = s * dx + c * dy;
      const v = c * dx - s * dy;
      // The first order distance to an ellipse, negative inside.
      const k0 = Math.sqrt((u * u) / a2 + (v * v) / b2);
      const k1 = Math.sqrt((u * u) / (a2 * a2) + (v * v) / (b2 * b2));
      const sd = k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -b;
      let m = 0.5 - sd;
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
