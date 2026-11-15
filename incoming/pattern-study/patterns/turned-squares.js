// ===== Patternflow pattern =====
// Title:   Turned Squares
// Family:  geometry
// Idea:    A lattice of squares in which every square is turned a little further than the one beside it, so the turning alone folds a flat grid into waves of corners and the squares swell into one another as they grow.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 131
// Round:   131
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Turn=0..5, Cell=0..1, Size=0..0.2
//
// Knob 1: Hue. Turns the colour of every square round the wheel; a square's colour also follows its own angle.
// Knob 2: Turn. How far each square is turned past its neighbour, from none (a plain grid) to a quarter turn over four squares.
// Knob 3: Cell. The width of one cell of the lattice, from 11 LEDs to 28.
// Knob 4: Size. The side of a square against its cell, from a small square lost in its cell to one a good deal bigger than it.

const W = 64;
const H = 128;

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
  params.hue = 0.55;
  params.step = 0.15;
  params.cell = 11;
  params.size = 0.7;
  params.buf = new Float32Array(W * H * 3);
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  params.hue = k[0] + 0.55;
  params.step = k[1] * 0.0785 * (1 + 0.08 * Math.sin(params.t * 0.5));
  params.cell = 11 + 17 * k[2];
  params.size = (0.4 + 5 * k[3]) * (1 + 0.04 * Math.sin(params.t * 0.43 + 1));
}

export function draw(display, params, time) {
  const buf = params.buf;
  buf.fill(0);
  const c = params.cell;
  const half = (params.size * c) / 2;
  const n = Math.ceil(H / c / 2) + 1;
  const m = Math.ceil(W / c / 2) + 1;
  const col = params.col;
  for (let j = -n; j <= n; j++) {
    for (let i = -m; i <= m; i++) {
      const cx = W / 2 + i * c;
      const cy = H / 2 + j * c;
      if (cx < -c * 1.2 || cx > W + c * 1.2 || cy < -c * 1.2 || cy > H + c * 1.2) continue;
      const ang = params.step * Math.sqrt(i * i + j * j);
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const turn = ((ang / (Math.PI / 2)) % 1 + 1) % 1;
      hsv(params.hue + turn * 0.5, 0.85, 0.95, col, 0);
      const reach = half * 1.5 + 2;
      const xa = Math.max(0, Math.floor(cx - reach));
      const xb = Math.min(W - 1, Math.ceil(cx + reach));
      const ya = Math.max(0, Math.floor(cy - reach));
      const yb = Math.min(H - 1, Math.ceil(cy + reach));
      for (let y = ya; y <= yb; y++) {
        for (let x = xa; x <= xb; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const px = Math.abs(dx * ca + dy * sa) - half;
          const py = Math.abs(-dx * sa + dy * ca) - half;
          const ox = px > 0 ? px : 0;
          const oy = py > 0 ? py : 0;
          const d = Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(px, py), 0);
          // A bright edge one LED wide, over a dim body.
          const edge = 1 - Math.abs(d + 0.5);
          const body = 0.5 - d;
          let v = 0;
          if (edge > 0) v = edge;
          if (body > 0) v = Math.max(v, Math.min(1, body) * 0.4);
          if (v <= 0) continue;
          // Light adds up but never past full: the more squares cross a LED, the nearer white.
          const p = (y * W + x) * 3;
          buf[p] += (255 - buf[p]) * (col[0] / 255) * v;
          buf[p + 1] += (255 - buf[p + 1]) * (col[1] / 255) * v;
          buf[p + 2] += (255 - buf[p + 2]) * (col[2] / 255) * v;
        }
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(255, buf[p]), Math.min(255, buf[p + 1]), Math.min(255, buf[p + 2]));
    }
  }
}
