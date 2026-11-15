// ===== Patternflow pattern =====
// Title:   Disc
// Family:  geometry
// Idea:    One disc sits on the dark, and its size and its place across and down the panel are the knobs, with nothing else on the panel.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 138
// Round:   140
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Across=-1..1, Down=-1..1
//
// Knob 1: Hue. The colour of the disc, turned round the wheel.
// Knob 2: Size. How wide the disc is, from 10 LEDs at the left to 56 at the right; the knob's 2 is 41.
// Knob 3: Across. Where the disc stands from side to side, from touching the left edge at the left to touching the right edge at the right, whatever its size.
// Knob 4: Down. Where it stands from top to bottom, from touching the top edge at the left to touching the bottom edge at the right; its 0.06 is just below the middle.

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
  params.r = 20;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swells the disc a few percent and lets it drift a LED or two.
  const r = ((10 + (46 * k[1]) / 3) / 2) * (1 + 0.05 * Math.sin(t * 0.47));
  const rr = Math.min(r, 31);
  params.r = rr;
  params.cx = W / 2 + k[2] * (W / 2 - rr) + 1.6 * Math.sin(t * 0.41 + 1);
  params.cy = H / 2 + k[3] * (H / 2 - rr) + 1.6 * Math.sin(t * 0.33 + 2);
  hsv(k[0] + 0.55, 0.7, 1, params.col, 0);
}

export function draw(display, params, time) {
  const cx = params.cx;
  const cy = params.cy;
  const r = params.r;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - cy;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      let m = r + 0.5 - Math.sqrt(dx * dx + dy * dy);
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
