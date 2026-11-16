// ===== Patternflow pattern =====
// Title:   Dashes
// Family:  line
// Idea:    One dashed line runs through the middle of the dark at a slant, and how long each dash is, how wide the gap between two dashes is and which way the line points are the knobs, with nothing else on the panel.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 146
// Round:   148
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Dash=0..3, Gap=-1..1, Turn=0..1
//
// Knob 1: Hue. The colour of the dashes, turned round the wheel.
// Knob 2: Dash. How long each dash is, from 4 LEDs at the left to 44 at the right; each step of the knob multiplies it by 2.2, and the knob's 2 is 19.8. The dashes are 8 LEDs thick, and the knobs leave that alone.
// Knob 3: Gap. How wide the gap between one dash and the next is, from 3.7 LEDs at the left to 22 at the right; its 0 is 9.
// Knob 4: Turn. Which way the line points, half a turn from the left to the right of the knob. A line looks the same turned round, so the two ends are the same picture; the knob's 0.06 is 21.6 degrees right of straight up.

const W = 64;
const H = 128;
const RAD = Math.PI / 180;
// A dash is 8 LEDs thick, and the knobs leave that alone.
const THICK = 8;

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
  params.dash = 20;
  params.pitch = 29;
  params.ux = 0.37;
  params.uy = -0.93;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swells the dashes and the gaps a few percent and rocks the line, so the dashes away from the middle slide a little and nothing is ever quite still.
  const dash = 4 * Math.exp(0.8 * k[1]) * (1 + 0.04 * Math.sin(t * 0.47));
  const gap = 9 * Math.exp(0.9 * k[2]) * (1 + 0.04 * Math.sin(t * 0.37 + 1));
  const turn = (180 * (k[3] + 0.06) + 3 * Math.sin(t * 0.31 + 2)) * RAD;
  params.dash = dash;
  params.pitch = dash + gap;
  // The direction the line runs, as a step on the panel: sin right and cos up.
  params.ux = Math.sin(turn);
  params.uy = -Math.cos(turn);
  // At 0 the hue knob would open on red; the dashes start on orange.
  hsv(k[0] + 0.07, 0.8, 1, params.col, 0);
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
  const hd = params.dash / 2;
  const ht = THICK / 2;
  const pitch = params.pitch;
  const ux = params.ux;
  const uy = params.uy;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      // s runs along the line from the middle of the panel and q across it.
      const s = dx * ux + dy * uy;
      const q = -dx * uy + dy * ux;
      // One dash stands in the middle and the rest every pitch along the line, and the nearest one is the only one this LED can touch: the gap is wider than the soft edge.
      const m = Math.round(s / pitch);
      const sd = box(s - m * pitch, q, hd, ht);
      let c = 0.5 - sd;
      c = c < 0 ? 0 : c > 1 ? 1 : c;
      display.setPixel(x, y, col[0] * c, col[1] * c, col[2] * c);
    }
  }
}
