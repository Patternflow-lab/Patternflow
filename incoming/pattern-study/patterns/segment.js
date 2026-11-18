// ===== Patternflow pattern =====
// Title:   Segment
// Family:  geometry
// Idea:    One disc is cut by a straight edge in the middle of the dark, and its size, where the edge crosses it and which way the edge faces are the knobs, with nothing else on the panel.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 142
// Round:   144
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Cut=-1..1, Turn=0..1
//
// Knob 1: Hue. The colour of the disc, turned round the wheel.
// Knob 2: Size. How wide the whole disc is before it is cut, from 22 LEDs across at the left to 62 at the right, which is as wide as the panel; the knob's 2 is 49.
// Knob 3: Cut. Where the straight edge crosses the disc, from a thin cap by the far rim at the left, through a half disc in the middle, to the whole disc with a small flat at the right.
// Knob 4: Turn. Which way the flat edge faces, once round from straight up at the left and back to straight up at the right; the knob's 0.06 is just right of up.

const W = 64;
const H = 128;
const RAD = Math.PI / 180;

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
  params.r = 23;
  params.c = 0;
  params.nx = 0;
  params.ny = -1;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swells the disc a few percent, slides the edge a little and rocks it.
  let r = (11 + (20 * k[1]) / 3) * (1 + 0.05 * Math.sin(t * 0.47));
  r = r > 31.5 ? 31.5 : r;
  let cut = 0.75 * k[2] + 0.06 * Math.sin(t * 0.37 + 1);
  cut = cut < -0.8 ? -0.8 : cut > 0.8 ? 0.8 : cut;
  params.r = r;
  // The edge lies this far from the middle, along the way it faces; the disc is what is left on the other side.
  params.c = cut * r;
  const a = (360 * k[3] + 5 * Math.sin(t * 0.31 + 2)) * RAD;
  params.nx = Math.sin(a);
  params.ny = -Math.cos(a);
  hsv(k[0] + 0.76, 0.8, 1, params.col, 0);
}

export function draw(display, params, time) {
  const r = params.r;
  const c = params.c;
  const nx = params.nx;
  const ny = params.ny;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      // The signed distance to the disc and to the side of the edge it keeps, negative inside both.
      const rim = Math.sqrt(dx * dx + dy * dy) - r;
      const edge = dx * nx + dy * ny - c;
      let m = 0.5 - (rim > edge ? rim : edge);
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
