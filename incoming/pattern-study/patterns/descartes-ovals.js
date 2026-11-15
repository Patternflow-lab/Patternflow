// ===== Patternflow pattern =====
// Title:   Descartes Ovals
// Family:  geometry
// Idea:    Two pins stand on the panel's middle line and every curve drawn is where a distance to one pin plus a multiple of the distance to the other stays the same, so a multiple of one is the gardener's ellipse, none is a circle round a single pin, and minus one is a hyperbola.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the ovals of René Descartes, La Géométrie (1637, year from memory), original, pattern round 134
// Round:   134
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Apart=0..3, Rings=-1..1, String=0..1
//
// Knob 1: Hue. Turns the colours round the wheel. Each ring takes the next hue on a little.
// Knob 2: Apart. How far apart the two pins are, from none (every curve a circle round both) to 48 LEDs; the knob's 2 is 32.
// Knob 3: Rings. The gap between neighbouring curves, from 4.7 LEDs to 10.5 far from the pins; the middle is 7.
// Knob 4: String. The multiple of the second distance. At the left it is 1, so the curves are ellipses that all pass round both pins; in the middle it is 0 and they are circles round the top pin alone; at the right it is minus 1 and they are hyperbolas.

const W = 64;
const H = 128;
const LINE = 1.3;

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
  params.apart = 32;
  params.m = 0.88;
  params.step = 13;
  params.hue = 0;
  params.line = new Float32Array(3);
  params.fill = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  params.apart = Math.max(0, 16 * k[1] + 1.4 * Math.sin(t * 0.6));
  params.m = Math.max(-1, Math.min(1, 1 - 2 * k[3] + 0.03 * Math.sin(t * 0.45 + 1)));
  const gap = 7 * Math.pow(1.5, k[2]);
  // Far from the pins the gap between curves is the step over one plus the multiple, so the step carries that factor.
  params.step = gap * (1 + Math.max(params.m, 0));
  params.hue = k[0];
}

export function draw(display, params, time) {
  const D = params.apart;
  const m = params.m;
  const step = params.step;
  const hue = params.hue;
  const line = params.line;
  const fill = params.fill;
  const cx = W / 2;
  const y1 = H / 2 - D / 2;
  const y2 = H / 2 + D / 2;
  const half = (LINE + 1) / 2;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    const e1 = py - y1;
    const e2 = py - y2;
    for (let x = 0; x < W; x++) {
      const ex = x + 0.5 - cx;
      const d1 = Math.sqrt(ex * ex + e1 * e1);
      const d2 = Math.sqrt(ex * ex + e2 * e2);
      const f = d1 + m * d2;
      // The pins are on the level the oval through the second pin sits on, so one ring always passes through both of them.
      const level = (f - D) / step;
      const n = Math.round(level);
      // The gradient of the distance sum turns the gap between levels into LEDs, so a ring is one width everywhere.
      const gx = (d1 > 0.001 ? ex / d1 : 0) + m * (d2 > 0.001 ? ex / d2 : 0);
      const gy = (d1 > 0.001 ? e1 / d1 : 0) + m * (d2 > 0.001 ? e2 / d2 : 0);
      let g = Math.sqrt(gx * gx + gy * gy);
      if (g < 0.25) g = 0.25;
      const away = (Math.abs(level - n) * step) / g;
      let a = half - away;
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      hsv(hue + 0.5 + 0.03 * Math.floor(level), 0.75, 0.2, fill, 0);
      hsv(hue + 0.5 + 0.03 * n, 0.65, 1, line, 0);
      let r = fill[0] + (line[0] - fill[0]) * a;
      let gr = fill[1] + (line[1] - fill[1]) * a;
      let b = fill[2] + (line[2] - fill[2]) * a;
      // The pins are two white dots.
      const near = Math.min(d1, d2);
      let p = 2.4 - near;
      if (p > 0) {
        p = p > 1 ? 1 : p;
        r += (250 - r) * p;
        gr += (250 - gr) * p;
        b += (250 - b) * p;
      }
      display.setPixel(x, y, r, gr, b);
    }
  }
}
