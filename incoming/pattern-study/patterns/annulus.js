// ===== Patternflow pattern =====
// Title:   Annulus
// Family:  geometry
// Idea:    One ring stands on the dark, and its outer size, how thick its wall is and where it stands from top to bottom are the knobs, with nothing else on the panel.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 140
// Round:   142
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Wall=-1..1, Down=-1..1
//
// Knob 1: Hue. The colour of the ring, turned round the wheel.
// Knob 2: Size. How wide the outside of the ring is, from 14 LEDs at the left to 58 at the right; the knob's 2 is 43.
// Knob 3: Wall. How thick the ring is, from a thin line at the left, near half its radius in the middle, to a wall that leaves only a small hole at the right.
// Knob 4: Down. Where the ring stands from top to bottom, from touching the top edge at the left to touching the bottom edge at the right; its 0.06 is just below the middle.

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
  params.cx = W / 2;
  params.cy = H / 2;
  params.mid = 15;
  params.half = 5;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swells the ring a few percent and lets it drift a LED or two.
  const r = Math.min(((14 + (44 * k[1]) / 3) / 2) * (1 + 0.06 * Math.sin(t * 0.47)), 31);
  // The wall is a share of the radius, kept at least a LED and a bit thick and never to the very middle.
  let wall = (0.46 + 0.38 * k[2]) * r;
  wall = wall < 1.3 ? 1.3 : wall > r - 1 ? r - 1 : wall;
  // The ring is the band between the outer edge and the inner edge: its middle line and half its thickness.
  params.mid = r - wall / 2;
  params.half = wall / 2;
  params.cx = W / 2 + 1.6 * Math.sin(t * 0.41 + 1);
  params.cy = H / 2 + k[3] * (H / 2 - r) + 1.6 * Math.sin(t * 0.33 + 2);
  hsv(k[0] + 0.74, 0.62, 1, params.col, 0);
}

export function draw(display, params, time) {
  const cx = params.cx;
  const cy = params.cy;
  const mid = params.mid;
  const half = params.half;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - cy;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      // The distance to the ring's middle line, less half its thickness: negative inside the wall.
      let m = half + 0.5 - Math.abs(Math.sqrt(dx * dx + dy * dy) - mid);
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
