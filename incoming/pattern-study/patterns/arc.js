// ===== Patternflow pattern =====
// Title:   Arc
// Family:  geometry
// Idea:    One piece of a ring stands on a bare dark ground, and how far round it runs, how thick the band is and which way it faces are the knobs.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 143
// Round:   145
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Span=0..3, Thickness=-1..1, Turn=0..1
//
// Knob 1: Hue. The colour of the band, turned round the wheel.
// Knob 2: Span. How far round the ring the band runs, from a short 40 degrees at the left to 340 at the right; the knob's 2 is 240.
// Knob 3: Thickness. How deep the band is, growing inward from the outer edge, from 2.8 LEDs at the left to 20 at the right; its 0 is 7.5. The hole in the middle never closes.
// Knob 4: Turn. Which way the middle of the band faces, once round from straight up at the left and back to straight up at the right; its 0.06 is just right of up.

const W = 64;
const H = 128;
const RAD = Math.PI / 180;
// The outer edge is a circle of 60 LEDs on the middle of the panel, so the band never leaves the 64 LEDs of width.
const OUTER = 30;

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
  params.half = 120 * RAD;
  params.inner = 22;
  params.bx = 0;
  params.by = -1;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath opens and closes the band a few degrees, swells it a little and rocks it about the middle.
  const span = 40 + (300 * k[1]) / 3 + 8 * Math.sin(t * 0.43);
  params.half = (span > 340 ? 340 : span < 30 ? 30 : span) * 0.5 * RAD;
  params.inner = OUTER - 7.5 * Math.pow(2.7, k[2]) * (1 + 0.12 * Math.sin(t * 0.53 + 1));
  const a = (360 * k[3] + 10 * Math.sin(t * 0.31 + 2)) * RAD;
  params.bx = Math.sin(a);
  params.by = -Math.cos(a);
  // At 0 the hue knob would open on red; the band starts on green.
  hsv(k[0] + 0.38, 0.85, 1, params.col, 0);
}

export function draw(display, params, time) {
  const half = params.half;
  const inner = params.inner;
  const bx = params.bx;
  const by = params.by;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      const r = Math.sqrt(dx * dx + dy * dy);
      // The LED's angle from the way the band faces, 0 to 180 degrees whichever side it is on.
      const along = dx * bx + dy * by;
      const across = Math.abs(-dx * by + dy * bx);
      const e = Math.atan2(across, along) - half;
      // Distance to the two straight ends: out along the radius, negative inside the span.
      const q = e < 0 ? -e : e;
      const s = r * Math.sin(q > 1.5708 ? 1.5708 : q);
      const sideEnds = e < 0 ? -s : s;
      const radial = inner - r > r - OUTER ? inner - r : r - OUTER;
      const sd = radial > sideEnds ? radial : sideEnds;
      let m = 0.5 - sd;
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
