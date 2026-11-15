// ===== Patternflow pattern =====
// Title:   Triangle
// Family:  geometry
// Idea:    One triangle stands on the dark, and the width of its base, its height and how far its tip leans to one side are the knobs, with nothing else on the panel.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 140
// Round:   142
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Base=0..3, Height=-1..1, Lean=-1..1
//
// Knob 1: Hue. The colour of the triangle, turned round the wheel.
// Knob 2: Base. How wide the bottom edge is, from 8 LEDs at the left to 58 at the right; the knob's 2 is 41.
// Knob 3: Height. How tall the triangle is, from 10 LEDs at the left to 114 at the right; its 0 is 62.
// Knob 4: Lean. Where the tip stands above the base, from over its left end at the left, through the middle, to over its right end at the right.

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
  // Three corners: the base's left and right ends, then the tip.
  params.ax = 12;
  params.ay = 95;
  params.bx = 52;
  params.by = 95;
  params.cx = 32;
  params.cy = 33;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swells the base a few percent, stretches the height a little and rocks the tip to either side.
  const base = (8 + (50 * k[1]) / 3) * (1 + 0.07 * Math.sin(t * 0.47));
  const height = (62 + 52 * k[2]) * (1 + 0.03 * Math.sin(t * 0.37 + 1));
  const lean = k[3] + 0.1 * Math.sin(t * 0.31 + 2);
  params.ax = W / 2 - base / 2;
  params.bx = W / 2 + base / 2;
  params.ay = H / 2 + height / 2;
  params.by = params.ay;
  params.cx = W / 2 + (lean * base) / 2;
  params.cy = H / 2 - height / 2;
  hsv(k[0] + 0.2, 0.78, 1, params.col, 0);
}

export function draw(display, params, time) {
  const ax = params.ax;
  const ay = params.ay;
  const bx = params.bx;
  const by = params.by;
  const cx = params.cx;
  const cy = params.cy;
  const col = params.col;
  // The three sides as vectors, and the side the corners wind round.
  const e0x = bx - ax;
  const e0y = by - ay;
  const e1x = cx - bx;
  const e1y = cy - by;
  const e2x = ax - cx;
  const e2y = ay - cy;
  const l0 = e0x * e0x + e0y * e0y;
  const l1 = e1x * e1x + e1y * e1y;
  const l2 = e2x * e2x + e2y * e2y;
  const wind = e0x * e2y - e0y * e2x < 0 ? -1 : 1;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      // The distance from this LED to each side, and which side of it the LED stands on.
      let v0x = px - ax;
      let v0y = py - ay;
      let u = (v0x * e0x + v0y * e0y) / l0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      let qx = v0x - e0x * u;
      let qy = v0y - e0y * u;
      let d = qx * qx + qy * qy;
      let side = wind * (v0x * e0y - v0y * e0x);
      v0x = px - bx;
      v0y = py - by;
      u = (v0x * e1x + v0y * e1y) / l1;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      qx = v0x - e1x * u;
      qy = v0y - e1y * u;
      let dd = qx * qx + qy * qy;
      d = dd < d ? dd : d;
      let ss = wind * (v0x * e1y - v0y * e1x);
      side = ss < side ? ss : side;
      v0x = px - cx;
      v0y = py - cy;
      u = (v0x * e2x + v0y * e2y) / l2;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      qx = v0x - e2x * u;
      qy = v0y - e2y * u;
      dd = qx * qx + qy * qy;
      d = dd < d ? dd : d;
      ss = wind * (v0x * e2y - v0y * e2x);
      side = ss < side ? ss : side;
      // Negative inside the triangle, positive outside.
      const sd = side > 0 ? -Math.sqrt(d) : Math.sqrt(d);
      let m = 0.5 - sd;
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
