// ===== Patternflow pattern =====
// Title:   Steps
// Family:  geometry
// Idea:    One flight of steps stands lit on a bare dark ground, and how many steps it is cut into, how far it runs and how high it climbs are the knobs.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 145
// Round:   147
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Steps=0..3, Run=-1..1, Rise=-1..1
//
// Knob 1: Hue. The colour of the steps, turned round the wheel.
// Knob 2: Steps. How many steps the flight is cut into, from 2 at the left to 7 at the right; the knob's 2 is 5. The run and the rise stay put, so more steps are smaller steps.
// Knob 3: Run. How far the flight runs across, from 24 LEDs at the left to 58 at the right; its 0 is 41.
// Knob 4: Rise. How high it climbs, from 24 LEDs at the left to 120 at the right; its 0.06 is 75.

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
  params.n = 5;
  params.run = 41;
  params.rise = 75;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  params.n = 2 + Math.round((5 * k[1]) / 3);
  // The slow breath swells the run a few percent, so the risers are never quite still.
  params.run = (41 + 17 * k[2]) * (1 + 0.07 * Math.sin(params.t * 0.47));
  params.rise = 72 + 48 * k[3];
  // At 0 the hue knob would open on red; the steps start on yellow.
  hsv(k[0] + 0.14, 0.85, 1, params.col, 0);
}

// Signed distance from a point to a rectangle with half sides hw and hh, negative inside.
function box(dx, dy, hw, hh) {
  const qx = (dx < 0 ? -dx : dx) - hw;
  const qy = (dy < 0 ? -dy : dy) - hh;
  const ox = qx > 0 ? qx : 0;
  const oy = qy > 0 ? qy : 0;
  const m = qx > qy ? qx : qy;
  return Math.sqrt(ox * ox + oy * oy) + (m < 0 ? m : 0);
}

export function draw(display, params, time) {
  const n = params.n;
  const tread = params.run / n;
  const riser = params.rise / n;
  const left = W / 2 - params.run / 2;
  const right = W / 2 + params.run / 2;
  const floor = H / 2 + params.rise / 2;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      // Step i is a block that runs from its own tread to the right edge and stands (i + 1) risers tall. The flight is all of them together.
      let sd = 1e9;
      for (let i = 0; i < n; i++) {
        const l = left + i * tread;
        const hh = ((i + 1) * riser) / 2;
        const d = box(px - (l + right) / 2, py - (floor - hh), (right - l) / 2, hh);
        if (d < sd) sd = d;
      }
      let m = 0.5 - sd;
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
