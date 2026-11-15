// ===== Patternflow pattern =====
// Title:   Ring
// Family:  geometry
// Idea:    One ring on a bare dark ground, and the four knobs are its colour, its size, how thick its wall is and how far it is squashed from a circle into an oval.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 139
// Round:   141
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..4, Wall=-1..1, Squash=0..1
//
// Knob 1: Hue. The colour of the ring, all the way round the wheel.
// Knob 2: Size. The diameter the ring has as a circle, from 14 LEDs at 0 to 50 LEDs at 4. Squashing keeps the area, so this size holds.
// Knob 3: Wall. How thick the band is, from 2 LEDs at -1 to 15 LEDs at 1, and 5.5 at 0. A wall as thick as the ring is wide fills it in.
// Knob 4: Squash. A tall oval at 0, a true circle at 0.5, a wide oval at 1. The ring stays in the middle of the panel.

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
  params.col = [150, 40, 255];
  params.a = 11;
  params.b = 24;
  params.wall = 5.5;
}

// Distance from a point to an oval's edge with half-axes a and b, near enough to a true distance
// close to the edge. Negative inside.
function oval(dx, dy, a, b) {
  const k0 = Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
  const k1 = Math.sqrt((dx * dx) / (a * a * a * a) + (dy * dy) / (b * b * b * b));
  return k1 < 1e-9 ? -Math.min(a, b) : (k0 * (k0 - 1)) / k1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // At 0 the hue knob would open on red; the ring starts a long way round the wheel, on violet.
  hsv(k[0] + 0.74, 0.9, 1, params.col);
  // The size breathes by a few percent so both edges are never quite still. The knob sets the size.
  const radius = ((14 + 9 * k[1]) / 2) * (1 + 0.06 * Math.sin(params.t * 0.57));
  // The ratio of the two half-axes runs 0.64 to 1.57 either side of the circle, and a times b stays the radius squared.
  const s = Math.exp(0.9 * (k[3] - 0.5));
  params.a = radius * s;
  params.b = radius / s;
  // The wall runs 2 LEDs to 15 at the ends of the knob, 5.5 in the middle.
  params.wall = 5.5 * Math.pow(2.8, k[2]);
}

export function draw(display, params, time) {
  const col = params.col;
  const a = params.a;
  const b = params.b;
  // The hole is an oval of its own, the outer oval's half-axes less the wall. When the wall
  // eats a half-axis there is no hole and the oval is solid.
  const ia = a - params.wall;
  const ib = b - params.wall;
  const hole = ia > 0.3 && ib > 0.3;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      let d = oval(dx, dy, a, b);
      if (hole) {
        const inner = -oval(dx, dy, ia, ib);
        if (inner > d) d = inner;
      }
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
