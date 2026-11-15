// ===== Patternflow pattern =====
// Title:   Disc
// Family:  geometry
// Idea:    One disc on a bare dark ground, and the four knobs are its colour, its diameter and where its middle sits across and down the panel.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 139
// Round:   141
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..4, Across=-1..1, Down=-1..1
//
// Knob 1: Hue. The colour of the disc, all the way round the wheel.
// Knob 2: Size. The diameter, from 8 LEDs at 0 to 56 LEDs at 4, which leaves 4 LEDs of dark either side when it sits in the middle.
// Knob 3: Across. The middle of the disc from the left edge at -1 to the right edge at 1.
// Knob 4: Down. The middle of the disc from the top edge at -1 to the bottom edge at 1. Near either edge the panel cuts the disc.

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
  params.col = [30, 220, 255];
  params.r = 16;
  params.cx = 32;
  params.cy = 64;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // At 0 the hue knob would open on red; the disc starts a little round the wheel, on cyan.
  hsv(k[0] + 0.5, 0.9, 1, params.col);
  // The diameter breathes by a few percent so the edge is never quite still. The knob sets the size.
  params.r = ((8 + 12 * k[1]) / 2) * (1 + 0.07 * Math.sin(params.t * 0.57));
  params.cx = W / 2 + (W / 2) * k[2];
  params.cy = H / 2 + (H / 2) * k[3];
}

export function draw(display, params, time) {
  const col = params.col;
  const r = params.r;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - params.cy;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - params.cx;
      const cov = 0.5 - (Math.sqrt(dx * dx + dy * dy) - r);
      if (cov <= 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const m = cov > 1 ? 1 : cov;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
