// ===== Patternflow pattern =====
// Title:   Chamfer
// Family:  geometry
// Idea:    One rectangle on a bare dark ground with its four corners cut off by straight lines, and the four knobs are its colour, its size and how far along the top and down the side each cut reaches.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 147
// Round:   149
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..4, Across=-1..1, Down=-1..1
//
// Knob 1: Hue. The colour of the shape, all the way round the wheel.
// Knob 2: Size. The whole rectangle grows with its proportions kept, 20 LEDs wide and 30 tall at 0 to 58 wide and 87 tall at 4; its 2 is 39 wide and 58.5 tall.
// Knob 3: Across. How far each cut runs along the top and bottom edges, from nothing at -1 to half the width at 1, where the top and the bottom come to a point.
// Knob 4: Down. How far each cut runs down the left and right edges, from nothing at -1 to half the height at 1, where the left and the right come to a point.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = H / 2;

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
  params.col = [255, 190, 25];
  params.hw = 19.5;
  params.hh = 29.5;
  params.cx = 10;
  params.cy = 15;
  params.len = 18;
  params.c0 = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // At 0 the hue knob would open on red; the shape starts a little round the wheel, on amber.
  hsv(k[0] + 0.12, 0.92, 1, params.col);
  // The size breathes a few percent on a slow clock, only so the edges are never quite still. The cuts keep their share of it.
  const hw = (10 + 4.75 * k[1]) * (1 + 0.05 * Math.sin(params.t * 0.47));
  const hh = 1.5 * hw;
  const cx = (hw * (k[2] + 1)) / 2;
  const cy = (hh * (k[3] + 1)) / 2;
  params.hw = hw;
  params.hh = hh;
  params.cx = cx;
  params.cy = cy;
  // Taking the corner at (hw, hh), the cut runs from (hw - cx, hh) to (hw, hh - cy). Its line is cy x + cx y = c0, and the rectangle is on the side where cy x + cx y is smaller.
  params.len = Math.sqrt(cx * cx + cy * cy);
  params.c0 = cy * hw + cx * hh - cx * cy;
}

export function draw(display, params, time) {
  const col = params.col;
  const hw = params.hw;
  const hh = params.hh;
  const cx = params.cx;
  const cy = params.cy;
  const len = params.len;
  const c0 = params.c0;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - CY;
    const ay = dy < 0 ? -dy : dy;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX;
      const ax = dx < 0 ? -dx : dx;
      // The rectangle's four sides and the four cuts are half planes. The shape is where they all hold, so a point's signed distance is the largest of them.
      let sd = ax - hw;
      const sy = ay - hh;
      if (sy > sd) sd = sy;
      if (len > 0.05) {
        const sc = (cy * ax + cx * ay - c0) / len;
        if (sc > sd) sd = sc;
      }
      const cov = 0.5 - sd;
      if (cov <= 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const m = cov > 1 ? 1 : cov;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
