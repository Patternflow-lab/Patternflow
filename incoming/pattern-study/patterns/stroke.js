// ===== Patternflow pattern =====
// Title:   Stroke
// Family:  geometry
// Idea:    One straight line right across a bare dark ground, and the four knobs are its colour, its thickness, its angle and how far it sits from the middle.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 139
// Round:   141
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Thick=0..4, Angle=-1..1, Place=-1..1
//
// Knob 1: Hue. The colour of the line, all the way round the wheel.
// Knob 2: Thick. How wide the line is, from 2 LEDs at 0 to 14 LEDs at 4.
// Knob 3: Angle. The line turns about the middle of the panel through half a turn: rising 60 degrees at -1, falling 30 degrees at 0, and at 1 back to the rising 60 degrees it started from.
// Knob 4: Place. The line slides sideways to its own direction, from the one edge of the panel at -1 to the other at 1, whatever its angle.

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
  params.col = [255, 40, 190];
  params.thick = 8;
  params.nx = 0;
  params.ny = 1;
  params.off = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // At 0 the hue knob would open on red; the line starts a long way round the wheel, on pink.
  hsv(k[0] + 0.88, 0.9, 1, params.col);
  params.thick = 2 + 3 * k[1];
  // Falling 30 degrees to the right at 0 (y runs down the panel), and the knob turns it 90 degrees either way.
  const a = (30 + 90 * k[2]) * (Math.PI / 180);
  // The unit vector across the line, at a right angle to its direction.
  params.nx = -Math.sin(a);
  params.ny = Math.cos(a);
  // The panel reaches 32|nx| + 64|ny| either side of its middle in the line's sideways direction, so
  // the knob walks the line from one edge to the other at any angle and it is never pushed off the panel.
  const reach = 0.96 * (32 * Math.abs(params.nx) + 64 * Math.abs(params.ny));
  // The line slides a LED to either side and back on a slow clock, so its edges are never quite still.
  // The knob sets the place.
  params.off = reach * k[3] + Math.sin(params.t * 0.57);
}

export function draw(display, params, time) {
  const col = params.col;
  const half = params.thick / 2;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      const d = Math.abs(dx * params.nx + dy * params.ny - params.off) - half;
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
