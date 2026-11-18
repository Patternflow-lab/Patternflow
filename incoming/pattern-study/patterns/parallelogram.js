// ===== Patternflow pattern =====
// Title:   Parallelogram
// Family:  geometry
// Idea:    One parallelogram with upright sides stands on a bare dark ground, and its width, the length of its upright sides and how far its right side is slid down past its left are the knobs.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 144
// Round:   146
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Width=0..3, Side=-1..1, Slide=-1..1
//
// Knob 1: Hue. The colour of the shape, turned round the wheel.
// Knob 2: Width. How far apart the two upright sides stand, from 10 LEDs at the left to 52 at the right; the knob's 2 is 38.
// Knob 3: Side. How long each upright side is, from 14 LEDs at the left to 74 at the right; its 0 is 44.
// Knob 4: Slide. How far the right side is slid down past the left one, from not at all at the left (a plain rectangle) to as far as the panel allows at the right; its 0.06 is just over half way.

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
  // Four edges as lines nx * x + ny * y = c, with the normal pointing out of the shape.
  params.edge = new Float32Array(12);
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swells the width a few percent and breathes the slide a little more, so the shape is never quite still.
  const w = (10 + (42 * k[1]) / 3) * (1 + 0.07 * Math.sin(t * 0.47));
  const side = 44 + 30 * k[2];
  // The slide is a share of one and a half widths, which is a lean of about 56 degrees at the end of the knob. The panel's 128 rows cap it.
  const share = (0.5 + 0.5 * k[3]) * (1 + 0.1 * Math.sin(t * 0.37 + 1));
  const room = 124 - side;
  let drop = share * 1.5 * w;
  drop = drop > room ? room : drop < 0 ? 0 : drop;
  // The shape sits in the middle of the panel, its width and its slid height together.
  const x0 = W / 2 - w / 2;
  const x1 = W / 2 + w / 2;
  const yl = (H - side - drop) / 2;
  const vx = [x0, x1, x1, x0];
  const vy = [yl, yl + drop, yl + drop + side, yl + side];
  const mx = (x0 + x1) / 2;
  const my = yl + (drop + side) / 2;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    let nx = vy[j] - vy[i];
    let ny = vx[i] - vx[j];
    const len = Math.sqrt(nx * nx + ny * ny) || 1;
    nx /= len;
    ny /= len;
    let c = nx * vx[i] + ny * vy[i];
    // Turn the normal to point away from the middle.
    if (nx * mx + ny * my > c) {
      nx = -nx;
      ny = -ny;
      c = -c;
    }
    params.edge[i * 3] = nx;
    params.edge[i * 3 + 1] = ny;
    params.edge[i * 3 + 2] = c;
  }
  // At 0 the hue knob would open on red; the shape starts on amber.
  hsv(k[0] + 0.12, 0.85, 1, params.col, 0);
}

export function draw(display, params, time) {
  const e = params.edge;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      // The farthest any of the four lines puts the LED outside: negative inside the shape.
      let sd = e[0] * px + e[1] * py - e[2];
      const d1 = e[3] * px + e[4] * py - e[5];
      const d2 = e[6] * px + e[7] * py - e[8];
      const d3 = e[9] * px + e[10] * py - e[11];
      if (d1 > sd) sd = d1;
      if (d2 > sd) sd = d2;
      if (d3 > sd) sd = d3;
      let m = 0.5 - sd;
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
