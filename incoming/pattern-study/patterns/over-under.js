// ===== Patternflow pattern =====
// Title:   Over Under
// Family:  textile
// Idea:    Two sets of ribbons cross at right angles on a black ground and at every crossing one of them lies over the other by a single rule, the same count of crossings over and then under, so a count of one gives the checked plain weave and a longer count slides it into diagonal ribs.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: weaving drafts, where plain weave is over one under one and twill is a longer run stepped one place at every row, original, pattern round 132
// Round:   132
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pitch=0..4, Float=1..4, Fill=0..1
//
// Knob 1: Hue. Turns the colour of the upright ribbons round the wheel; the flat ones keep half a wheel from them.
// Knob 2: Pitch. The distance from one ribbon to the next, from 7 LEDs to 20.
// Knob 3: Float. How many crossings in a row a ribbon rides over before it goes under for as many. At 1 it is the plain weave, a check; at 2 and 3 it steps one place a row into diagonal ribs; at 4 the ribs are four crossings wide.
// Knob 4: Fill. How much of its pitch a ribbon takes. At the left of the knob a little more than half, so the black ground shows through every crossing; at the right it is nearly all, and the ribbons close up.

const W = 64;
const H = 128;

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
  params.pitch = 13;
  params.run = 1;
  params.fill = 0.62;
  params.warp = new Float32Array(3);
  params.weft = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  params.pitch = (7 + 3.25 * k[1]) * (1 + 0.03 * Math.sin(params.t * 0.45));
  params.run = Math.max(1, Math.min(4, Math.round(k[2])));
  params.fill = 0.6 + 0.38 * k[3] + 0.025 * Math.sin(params.t * 0.6 + 1);
  hsv(k[0] + 0.07, 0.85, 1, params.warp);
  hsv(k[0] + 0.55, 0.85, 1, params.weft);
}

const sm = (e) => (e <= 0 ? 0 : e >= 1 ? 1 : e * e * (3 - 2 * e));

export function draw(display, params, time) {
  const p = params.pitch;
  const fill = params.fill;
  const run = params.run;
  const period = 2 * run;
  const half = (fill * p) / 2;
  for (let y = 0; y < H; y++) {
    const gy = (y + 0.5 - H / 2) / p + 0.5;
    const j = Math.floor(gy);
    const dy = (gy - j - 0.5) * p;
    for (let x = 0; x < W; x++) {
      const gx = (x + 0.5 - W / 2) / p + 0.5;
      const i = Math.floor(gx);
      const dx = (gx - i - 0.5) * p;
      const warpOver = (((i + j) % period) + period) % period < run;
      // Distance from the middle of each ribbon, and how far inside its edge this LED sits.
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      let col;
      let v = 0;
      if (warpOver) {
        const cover = half - ax + 0.5;
        if (cover > 0) {
          col = params.warp;
          // A rounded ribbon: bright along its middle, darker toward its edges, and a little dimmer where it dips at the ends of the cell.
          v = (0.5 + 0.5 * Math.cos((ax / half) * 1.35)) * (0.84 + 0.16 * (1 - Math.pow(ay / (p / 2), 3)));
          v *= cover > 1 ? 1 : cover;
        } else {
          const under = half - ay + 0.5;
          if (under > 0) {
            col = params.weft;
            // The ribbon beneath darkens where it goes under the one on top.
            const shade = 0.3 + 0.7 * sm((ax - half) / 1.8);
            v = (0.5 + 0.5 * Math.cos((ay / half) * 1.35)) * shade * (under > 1 ? 1 : under);
          }
        }
      } else {
        const cover = half - ay + 0.5;
        if (cover > 0) {
          col = params.weft;
          v = (0.5 + 0.5 * Math.cos((ay / half) * 1.35)) * (0.84 + 0.16 * (1 - Math.pow(ax / (p / 2), 3)));
          v *= cover > 1 ? 1 : cover;
        } else {
          const under = half - ax + 0.5;
          if (under > 0) {
            col = params.warp;
            const shade = 0.3 + 0.7 * sm((ay - half) / 1.8);
            v = (0.5 + 0.5 * Math.cos((ax / half) * 1.35)) * shade * (under > 1 ? 1 : under);
          }
        }
      }
      if (v > 0) display.setPixel(x, y, col[0] * v, col[1] * v, col[2] * v);
      else display.setPixel(x, y, 0, 0, 0);
    }
  }
}
