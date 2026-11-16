// ===== Patternflow pattern =====
// Title:   Frame
// Family:  geometry
// Idea:    One rectangle stands on a bare dark ground with nothing inside it but dark, and its width, how thick its wall is and its height are the knobs.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 143
// Round:   145
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Width=0..3, Wall=-1..1, Height=-1..1
//
// Knob 1: Hue. The colour of the frame, turned round the wheel.
// Knob 2: Width. How wide the frame is, from 16 LEDs at the left to 60 at the right; the knob's 2 is 45.
// Knob 3: Wall. How thick the four walls are, from 2 LEDs at the left to 18 at the right; its 0 is 6. A wall never eats the hole: it stops 2 LEDs short of the middle.
// Knob 4: Height. How tall the frame is, from 32 LEDs at the left to 120 at the right; its 0 is 76.

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
  params.hw = 22;
  params.hh = 38;
  params.wall = 6;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // The slow breath swells the width a few percent, so the two upright walls are never quite still.
  const w = (16 + (44 * k[1]) / 3) * (1 + 0.05 * Math.sin(params.t * 0.47));
  const h = 76 + 44 * k[3];
  params.hw = w / 2;
  params.hh = h / 2;
  const wall = 6 * Math.pow(3, k[2]);
  const room = (w < h ? w : h) / 2 - 2;
  params.wall = wall > room ? room : wall;
  // At 0 the hue knob would open on red; the frame starts on magenta.
  hsv(k[0] + 0.86, 0.8, 1, params.col, 0);
}

// Signed distance from a point to a rectangle with half sides hw and hh on the middle of the panel, negative inside.
function box(dx, dy, hw, hh) {
  const qx = (dx < 0 ? -dx : dx) - hw;
  const qy = (dy < 0 ? -dy : dy) - hh;
  const ox = qx > 0 ? qx : 0;
  const oy = qy > 0 ? qy : 0;
  const m = qx > qy ? qx : qy;
  return Math.sqrt(ox * ox + oy * oy) + (m < 0 ? m : 0);
}

export function draw(display, params, time) {
  const hw = params.hw;
  const hh = params.hh;
  const iw = hw - params.wall;
  const ih = hh - params.wall;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      // The frame is inside the outer rectangle and outside the inner one.
      const outer = box(dx, dy, hw, hh);
      const hole = -box(dx, dy, iw, ih);
      const sd = outer > hole ? outer : hole;
      let m = 0.5 - sd;
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
