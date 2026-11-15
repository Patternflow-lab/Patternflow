// ===== Patternflow pattern =====
// Title:   Triangle
// Family:  geometry
// Idea:    One triangle on a bare dark ground, and the four knobs are its colour, the length of its base, its height and how far across the panel its top corner stands.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 139
// Round:   141
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Base=0..4, Height=-1..1, Top=-1..1
//
// Knob 1: Hue. The colour of the triangle, all the way round the wheel.
// Knob 2: Base. The flat bottom side, from 12 LEDs at 0 to 54 LEDs at 4, always centred across the panel.
// Knob 3: Height. From the base up to the top corner, 12 LEDs at -1 to 112 LEDs at 1.
// Knob 4: Top. The top corner slides across the panel from 30 LEDs left of the middle at -1 to 30 right of it at 1. The base stays where it is.

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
  params.col = [190, 255, 20];
  // The three corners: left and right ends of the base, then the top.
  params.ax = 15;
  params.ay = 95;
  params.bx = 49;
  params.by = 95;
  params.cx = 34;
  params.cy = 33;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // At 0 the hue knob would open on red; the triangle starts a little round the wheel, on lime.
  hsv(k[0] + 0.22, 0.9, 1, params.col);
  // Base and height each breathe by a few percent, on their own slow clocks that never meet.
  // It is only enough that the edges are never quite still. The knobs set the lengths.
  const base = (12 + 10.5 * k[1]) * (1 + 0.07 * Math.sin(params.t * 0.59));
  const height = (62 + 50 * k[2]) * (1 + 0.07 * Math.sin(params.t * 0.41 + 1.1));
  params.ax = W / 2 - base / 2;
  params.bx = W / 2 + base / 2;
  params.ay = H / 2 + height / 2;
  params.by = params.ay;
  params.cx = W / 2 + 30 * k[3];
  params.cy = H / 2 - height / 2;
}

// Signed distance from a point to the triangle's edge: negative inside, positive outside.
function triangle(px, py, p) {
  const e0x = p.bx - p.ax;
  const e0y = p.by - p.ay;
  const e1x = p.cx - p.bx;
  const e1y = p.cy - p.by;
  const e2x = p.ax - p.cx;
  const e2y = p.ay - p.cy;
  const v0x = px - p.ax;
  const v0y = py - p.ay;
  const v1x = px - p.bx;
  const v1y = py - p.by;
  const v2x = px - p.cx;
  const v2y = py - p.cy;
  let t = (v0x * e0x + v0y * e0y) / (e0x * e0x + e0y * e0y);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  let qx = v0x - e0x * t;
  let qy = v0y - e0y * t;
  let dist = qx * qx + qy * qy;
  t = (v1x * e1x + v1y * e1y) / (e1x * e1x + e1y * e1y);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  qx = v1x - e1x * t;
  qy = v1y - e1y * t;
  let d2 = qx * qx + qy * qy;
  if (d2 < dist) dist = d2;
  t = (v2x * e2x + v2y * e2y) / (e2x * e2x + e2y * e2y);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  qx = v2x - e2x * t;
  qy = v2y - e2y * t;
  d2 = qx * qx + qy * qy;
  if (d2 < dist) dist = d2;
  // Which side of each edge the point is on, signed so that the inside of the triangle is positive on all three.
  const turn = e0x * e2y - e0y * e2x > 0 ? 1 : -1;
  const c0 = turn * (v0x * e0y - v0y * e0x);
  const c1 = turn * (v1x * e1y - v1y * e1x);
  const c2 = turn * (v2x * e2y - v2y * e2x);
  const inside = c0 > 0 && c1 > 0 && c2 > 0;
  return inside ? -Math.sqrt(dist) : Math.sqrt(dist);
}

export function draw(display, params, time) {
  const col = params.col;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cov = 0.5 - triangle(x + 0.5, y + 0.5, params);
      if (cov <= 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const m = cov > 1 ? 1 : cov;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
