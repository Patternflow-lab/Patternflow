// ===== Patternflow pattern =====
// Title:   Slab
// Family:  geometry
// Idea:    One rectangle on a bare dark ground, and the four knobs are its colour, its width, its height and how far it has turned.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 139
// Round:   141
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Width=0..4, Height=-1..1, Turn=0..1
//
// Knob 1: Hue. The colour of the rectangle, all the way round the wheel.
// Knob 2: Width. The short side, from a 6 LED strip at 0 to 46 LEDs at 4, which leaves 9 LEDs of dark either side.
// Knob 3: Height. The long side, from 8 LEDs at -1 to 104 LEDs at 1, which leaves 12 LEDs of dark above and below.
// Knob 4: Turn. The rectangle turns about the middle of the panel, half a turn from 0 to 1, where it lies where it stood.

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
  params.col = [255, 160, 20];
  params.w = 26;
  params.h = 56;
  params.a = 0.2;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // At 0 the hue knob would open on red; the rectangle starts a little round the wheel, on amber.
  hsv(k[0] + 0.1, 0.9, 1, params.col);
  // Each side breathes by a few percent, the two on their own slow clocks that never meet.
  // It is only enough that the edges are never quite still. The knobs set the sizes.
  params.w = (6 + 10 * k[1]) * (1 + 0.05 * Math.sin(params.t * 0.61));
  params.h = (56 + 48 * k[2]) * (1 + 0.05 * Math.sin(params.t * 0.43 + 1.3));
  params.a = k[3] * Math.PI;
}

export function draw(display, params, time) {
  const hw = params.w / 2;
  const hh = params.h / 2;
  const c = Math.cos(params.a);
  const s = Math.sin(params.a);
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      // The pixel in the rectangle's own frame, then its distance to the nearest edge.
      const u = dx * c + dy * s;
      const v = -dx * s + dy * c;
      const qx = Math.abs(u) - hw;
      const qy = Math.abs(v) - hh;
      const ox = qx > 0 ? qx : 0;
      const oy = qy > 0 ? qy : 0;
      const d = Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0);
      const cov = 0.5 - d;
      if (cov <= 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const m = cov > 1 ? 1 : cov;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
