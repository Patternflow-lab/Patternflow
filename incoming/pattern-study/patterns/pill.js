// ===== Patternflow pattern =====
// Title:   Pill
// Family:  geometry
// Idea:    One rectangle stands on a bare dark ground, and its width, its height and how round its corners are, from sharp to a full capsule, are the knobs.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 143
// Round:   145
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Width=0..3, Height=-1..1, Round=-1..1
//
// Knob 1: Hue. The colour of the shape, turned round the wheel.
// Knob 2: Width. How wide the shape is, from 16 LEDs at the left to 58 at the right; the knob's 2 is 44.
// Knob 3: Height. How tall it is, from 20 LEDs at the left to 120 at the right; its 0 is 70.
// Knob 4: Round. How much of the shorter side's half the corners take, from sharp at -1 to a full capsule at 1. Its 0.06 is a little over half.

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
  params.hw = 21;
  params.hh = 38;
  params.r = 11;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // The slow breath swells the width a few percent, so the two long sides are never quite still.
  const w = (16 + (42 * k[1]) / 3) * (1 + 0.06 * Math.sin(params.t * 0.47));
  const h = 70 + 50 * k[2];
  params.hw = w / 2;
  params.hh = h / 2;
  // The corner radius is a share of the shorter half side, so at 1 the short ends are half circles whatever the size.
  const share = (k[3] + 1) / 2;
  params.r = share * (params.hw < params.hh ? params.hw : params.hh);
  // At 0 the hue knob would open on red; the shape starts on cyan.
  hsv(k[0] + 0.5, 0.85, 1, params.col, 0);
}

export function draw(display, params, time) {
  const hw = params.hw;
  const hh = params.hh;
  const r = params.r;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      // A rectangle shrunk by r on every side, grown back by r: its corners are quarter circles of radius r.
      const qx = (dx < 0 ? -dx : dx) - (hw - r);
      const qy = (dy < 0 ? -dy : dy) - (hh - r);
      const ox = qx > 0 ? qx : 0;
      const oy = qy > 0 ? qy : 0;
      const m0 = qx > qy ? qx : qy;
      const sd = Math.sqrt(ox * ox + oy * oy) + (m0 < 0 ? m0 : 0) - r;
      let m = 0.5 - sd;
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
