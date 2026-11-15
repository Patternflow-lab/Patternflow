// ===== Patternflow pattern =====
// Title:   Polygon
// Family:  geometry
// Idea:    One regular polygon stands on the dark, and how many sides it has, how big it is and how far it is turned are the knobs, with nothing else on the panel.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 140
// Round:   142
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Sides=5..12, Turn=0..1
//
// Knob 1: Hue. The colour of the polygon, turned round the wheel.
// Knob 2: Size. How far the corners stand from the middle, from 12 LEDs at the left to 31 at the right; the knob's 2 is 25.
// Knob 3: Sides. How many sides it has, from 5 at the left to 12 at the right, in whole steps; the knob's 0 is held at 5.
// Knob 4: Turn. How far the polygon is turned about its middle, from a corner straight up at the left to 144 degrees at the right, which is two turns of a pentagon's symmetry; its 0.06 is 9 degrees.

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
  params.r = 19;
  params.turn = 0;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swells the polygon a few percent and rocks it a few degrees about its middle.
  params.n = Math.round(k[2]);
  params.r = Math.min((12 + (19.5 * k[1]) / 3) * (1 + 0.07 * Math.sin(t * 0.47)), 31.5);
  params.turn = ((144 * k[3] + 6 * Math.sin(t * 0.31 + 2)) * Math.PI) / 180;
  hsv(k[0] + 0.12, 0.6, 1, params.col, 0);
}

export function draw(display, params, time) {
  const n = params.n;
  const r = params.r;
  const turn = params.turn;
  const col = params.col;
  // Half the angle one side takes, and the point its first corner is at.
  const an = Math.PI / n;
  const period = 2 * an;
  const ax = r * Math.cos(an);
  const ay = r * Math.sin(an);
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      const len = Math.sqrt(dx * dx + dy * dy);
      // The angle of this LED from straight up, clockwise, less the turn, folded into one side of the polygon.
      let bn = Math.atan2(dx, -dy) - turn;
      bn = ((bn % period) + period) % period - an;
      const sb = Math.sin(bn);
      const px = len * Math.cos(bn) - ax;
      // The LED measured from the first corner, then slid back along the side to the nearest point of it.
      let py = len * (sb < 0 ? -sb : sb) - ay;
      const lo = -py;
      py += lo < 0 ? 0 : lo > ay ? ay : lo;
      const d = Math.sqrt(px * px + py * py);
      // Negative inside the polygon.
      const sd = px < 0 ? -d : d;
      let m = 0.5 - sd;
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
