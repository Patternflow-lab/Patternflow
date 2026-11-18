// ===== Patternflow pattern =====
// Title:   Chasing Corners
// Family:  geometry
// Idea:    Every corner of a rectangle walks a fixed share of the way along its side towards the next corner, and the rectangle of those four new corners walks on again, so one share, taken over and over, winds the panel into a spiral of bands.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: four bugs chasing one another round a square, taken one step at a time (pursuit curves are Pierre Bouguer's, 1732), pattern round 131
// Round:   131
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Share=0..4, Rings=0..1, Squeeze=0.06..0.5
//
// Knob 1: Hue. Turns the colour of the bands round the wheel, and a band's colour follows how deep it sits.
// Knob 2: Share. How far along its side each corner walks, from a sliver (nearly the same rectangle again and again) to half (a diamond in each rectangle).
// Knob 3: Rings. How many rectangles are drawn inside one another, from 10 to 64.
// Knob 4: Squeeze. The height of the first rectangle, from the panel's whole height down to its width, a square 62 LEDs on a side.

const W = 64;
const H = 128;
const MAXN = 64;

function hsv(h, s, v, out, o) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

export function setup(params) {
  params.t = 0;
  params.n = 12;
  // Each ring is four edges, each edge a unit normal (pointing out) and an offset.
  params.ex = new Float32Array(MAXN * 4);
  params.ey = new Float32Array(MAXN * 4);
  params.ec = new Float32Array(MAXN * 4);
  params.col = new Float32Array(MAXN * 3);
  params.px = new Float32Array(4);
  params.py = new Float32Array(4);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const hue = k[0] + 0.58;
  const share = (0.04 + 0.46 * Math.pow(k[1] / 4, 1.2)) * (1 + 0.07 * Math.sin(params.t * 0.4));
  const n = Math.round(10 + 54 * k[2]);
  params.n = n;
  const hh = 62 + 64 * (1 - (k[3] - 0.06) / 0.44);
  const px = params.px;
  const py = params.py;
  px[0] = 1; py[0] = H / 2 - hh / 2;
  px[1] = W - 1; py[1] = H / 2 - hh / 2;
  px[2] = W - 1; py[2] = H / 2 + hh / 2;
  px[3] = 1; py[3] = H / 2 + hh / 2;
  for (let r = 0; r < n; r++) {
    for (let e = 0; e < 4; e++) {
      const ax = px[e];
      const ay = py[e];
      const bx = px[(e + 1) % 4];
      const by = py[(e + 1) % 4];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      // Clockwise on screen, so the outward normal of A to B is (dy, -dx).
      const nx = (by - ay) / len;
      const ny = -(bx - ax) / len;
      params.ex[r * 4 + e] = nx;
      params.ey[r * 4 + e] = ny;
      params.ec[r * 4 + e] = -(nx * ax + ny * ay);
    }
    const ox = [px[0], px[1], px[2], px[3]];
    const oy = [py[0], py[1], py[2], py[3]];
    for (let e = 0; e < 4; e++) {
      px[e] = ox[e] + share * (ox[(e + 1) % 4] - ox[e]);
      py[e] = oy[e] + share * (oy[(e + 1) % 4] - oy[e]);
    }
    hsv(hue + (r / n) * 0.45, 0.86, r % 2 ? 0.6 : 0.96, params.col, r * 3);
  }
}

export function draw(display, params, time) {
  const n = params.n;
  const ex = params.ex;
  const ey = params.ey;
  const ec = params.ec;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = x + 0.5;
      const fy = y + 0.5;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let q = 0; q < n; q++) {
        let d = -1e9;
        for (let e = 0; e < 4; e++) {
          const v = ex[q * 4 + e] * fx + ey[q * 4 + e] * fy + ec[q * 4 + e];
          if (v > d) d = v;
        }
        const cov = 0.5 - d;
        if (cov <= 0) break;
        const c = cov > 1 ? 1 : cov;
        r += (col[q * 3] - r) * c;
        g += (col[q * 3 + 1] - g) * c;
        b += (col[q * 3 + 2] - b) * c;
      }
      display.setPixel(x, y, r, g, b);
    }
  }
}
