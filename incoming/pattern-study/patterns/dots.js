// ===== Patternflow pattern =====
// Title:   Dots
// Family:  geometry
// Idea:    A few round dots of one size are strung evenly down the middle of the dark, and how many there are, how big each is and how far the string reaches are the knobs, with nothing else on the panel.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 142
// Round:   144
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=0..3, Size=-1..1, Reach=-1..1
//
// Knob 1: Hue. The colour of the dots, turned round the wheel.
// Knob 2: Count. How many dots there are, from 2 at the left to 7 at the right, rounded to a whole number; the knob's 2 is 5.
// Knob 3: Size. How wide each dot is, from 7 LEDs at the left to 24 at the right; its 0 is 13.
// Knob 4: Reach. How far apart the first dot and the last stand, centre to centre, from 45 LEDs at the left to 96 at the right; the dots keep the same gap between them along the way, and when they would touch they run together. The knob's 0.06 is 68.

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
  params.r = 6.5;
  params.pitch = 17;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  let n = Math.round(2 + 1.5 * k[1]);
  n = n < 2 ? 2 : n > 7 ? 7 : n;
  // The slow breath swells the dots and stretches the string a few percent.
  const d = 13 * Math.exp(0.62 * k[2]) * (1 + 0.07 * Math.sin(t * 0.47));
  const reach = 66 * Math.exp(0.38 * k[3]) * (1 + 0.05 * Math.sin(t * 0.37 + 1));
  params.n = n;
  params.r = d / 2;
  params.pitch = reach / (n - 1);
  hsv(k[0] + 0.97, 0.8, 1, params.col, 0);
}

export function draw(display, params, time) {
  const n = params.n;
  const r = params.r;
  const pitch = params.pitch;
  const col = params.col;
  const top = H / 2 - ((n - 1) * pitch) / 2;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      // The dots are the same size and run together where they touch, so the LED takes the one that covers most of it.
      let m = 0;
      for (let i = 0; i < n; i++) {
        const dy = py - (top + i * pitch);
        let c = r + 0.5 - Math.sqrt(dx * dx + dy * dy);
        c = c < 0 ? 0 : c > 1 ? 1 : c;
        if (c > m) m = c;
      }
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
