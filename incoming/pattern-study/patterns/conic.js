// ===== Patternflow pattern =====
// Title:   Conic
// Family:  geometry
// Idea:    One conic section filled in on a bare dark ground, a circle that the eccentricity knob stretches into an ellipse, then a parabola, then a hyperbola, with the focus held still.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Apollonius of Perga, conic sections (c. 200 BC), as a focus and an eccentricity
// Round:   143
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Eccentricity=0..5, Width=-1..1, Turn=-1..1
//
// Knob 1: Hue. The colour of the shape, all the way round the wheel.
// Knob 2: Eccentricity. A circle at 0, an egg at the knob's 2 (0.78), a parabola that runs off the panel at 3.33 (exactly 1), and past that the arms of a hyperbola, spreading wider up to 1.22 at 5. The knob is spaced so the egg keeps getting longer at an even pace until it leaves.
// Knob 3: Width. How wide the shape is across the line through the focus, from 14 LEDs at -1 to 34 LEDs at 1. At 0 it is 24. The focus stays put, so the more eccentric the shape, the longer it runs.
// Knob 4: Turn. A full turn of the shape about its focus: opening upward at -1, downward at 0 and upward again at 1.

const W = 64;
const H = 128;
// The focus stands in the upper third, where the shape has the whole panel to open into.
const FX = 32;
const FY = 40;

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
  params.col = [255, 255, 255];
  params.e = 0.9;
  params.l = 20;
  params.ux = 0;
  params.uy = -1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // At 0 the hue knob would open on red; the shape starts on gold.
  hsv(k[0] + 0.12, 0.85, 1, params.col);
  // The squared eccentricity is the knob's own, 0.3 for each step. The length of the ellipse, 2 l / (1 - e^2), then grows evenly with it.
  params.e = Math.sqrt(0.3 * k[1]);
  // The width across the focus stays where the Width knob puts it, whatever the eccentricity. Half of it is
  // l, the semi-latus rectum, and the nearest point of the curve is l / (1 + e) from the focus.
  // It breathes by a few percent on a slow clock, so the curve is never quite still.
  params.l = (12 + 5 * k[2]) * (1 + 0.08 * Math.sin(params.t * 0.47));
  const a = k[3] * Math.PI;
  // The axis points from the focus toward the nearest point of the curve. At 0 it points up the panel.
  params.ux = Math.sin(a);
  params.uy = -Math.cos(a);
}

export function draw(display, params, time) {
  const col = params.col;
  const e = params.e;
  const l = params.l;
  const ux = params.ux;
  const uy = params.uy;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - FY;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - FX;
      const r = Math.sqrt(dx * dx + dy * dy);
      // The conic is every point with r + e u = l, where u is the distance along the axis. Inside is below that.
      const u = dx * ux + dy * uy;
      const f = r + e * u - l;
      // Divide by the slope of f to get a distance in LEDs. The slope is 1 + e^2 + 2 e cos(angle from the axis), squared.
      const g2 = 1 + e * e + (r > 0.001 ? (2 * e * u) / r : 2 * e);
      const d = g2 > 0.0001 ? f / Math.sqrt(g2) : f;
      let m = 0.5 - d;
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
