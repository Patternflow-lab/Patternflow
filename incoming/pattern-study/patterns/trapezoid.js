// ===== Patternflow pattern =====
// Title:   Trapezoid
// Family:  geometry
// Idea:    One trapezoid stands on the dark, and the length of its bottom edge, the length of its top edge and its height are the knobs, with nothing else on the panel.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 140
// Round:   142
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Bottom=0..3, Top=-1..1, Height=-1..1
//
// Knob 1: Hue. The colour of the trapezoid, turned round the wheel.
// Knob 2: Bottom. How long the bottom edge is, from 14 LEDs at the left to 58 at the right; the knob's 2 is 43.
// Knob 3: Top. How long the top edge is, from 6 LEDs at the left to 58 at the right; its 0 is 32. Equal to the bottom, the shape is a rectangle, and longer than the bottom it stands wider at the top.
// Knob 4: Height. How tall the trapezoid is, from 12 LEDs at the left to 100 at the right; its 0.06 is 59.

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
  params.rb = 21;
  params.rt = 16;
  params.he = 29;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swells the bottom edge, draws the top edge in and out and stretches the height, each a few percent.
  const bottom = (14 + (44 * k[1]) / 3) * (1 + 0.06 * Math.sin(t * 0.47));
  const top = (32 + 26 * k[2]) * (1 + 0.08 * Math.sin(t * 0.31 + 2));
  const height = (56 + 44 * k[3]) * (1 + 0.04 * Math.sin(t * 0.37 + 1));
  // Half lengths, and the shape's middle sits on the middle of the panel.
  params.rb = Math.min(bottom, 62) / 2;
  params.rt = Math.min(top, 62) / 2;
  params.he = height / 2;
  hsv(k[0] + 0.46, 0.7, 1, params.col, 0);
}

export function draw(display, params, time) {
  const r1 = params.rb;
  const r2 = params.rt;
  const he = params.he;
  const col = params.col;
  // The slanted side as a vector from the bottom corner to the top corner, and its length squared.
  const k1x = r2;
  const k1y = he;
  const k2x = r2 - r1;
  const k2y = 2 * he;
  const k2d = k2x * k2x + k2y * k2y;
  for (let y = 0; y < H; y++) {
    // Up is positive, so the bottom edge is at negative y.
    const py = H / 2 - (y + 0.5);
    for (let x = 0; x < W; x++) {
      const px = Math.abs(x + 0.5 - W / 2);
      // The distance to the flat edges: how far past the wider of the two half lengths it stands, and past the height.
      const edge = py < 0 ? r1 : r2;
      const cax = px - (px < edge ? px : edge);
      const cay = Math.abs(py) - he;
      // The distance to the slanted side.
      let u = ((k1x - px) * k2x + (k1y - py) * k2y) / k2d;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const cbx = px - k1x + k2x * u;
      const cby = py - k1y + k2y * u;
      const inside = cbx < 0 && cay < 0;
      const da = cax * cax + cay * cay;
      const db = cbx * cbx + cby * cby;
      const d = Math.sqrt(da < db ? da : db);
      let m = 0.5 - (inside ? -d : d);
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
