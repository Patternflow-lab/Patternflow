// ===== Patternflow pattern =====
// Title:   Sine
// Family:  line
// Idea:    One sine curve runs down the middle of the dark from the top of the panel to the bottom, and how far it swings, how long each wave is and how thick the line is are the knobs, with nothing else on the panel.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 142
// Round:   144
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Swing=0..3, Wave=-1..1, Thickness=-1..1
//
// Knob 1: Hue. The colour of the line, turned round the wheel.
// Knob 2: Swing. How far the line swings to either side of the middle, from 2 LEDs at the left to 24 at the right; the knob's 2 is 16.7.
// Knob 3: Wave. How long one wave is, from 32 LEDs at the left, through 64 in the middle, to 128 at the right, which is the whole height of the panel; each step of the knob doubles it.
// Knob 4: Thickness. How thick the line is, from 3 LEDs at the left to 12 at the right; the knob's 0.06 is 6.3.

const W = 64;
const H = 128;
// The curve is kept as a point for every row, and this many rows beyond the top and the bottom so it runs off the panel.
const PAD = 16;
const N = H + 2 * PAD + 1;
const TAU = Math.PI * 2;

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
  params.half = 3;
  params.xs = new Float32Array(N);
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swells and eases the swing and thickness a few percent and slides the wave a little along the panel.
  let amp = (2 + (22 * k[1]) / 3) * (1 + 0.07 * Math.sin(t * 0.47));
  amp = amp > 24 ? 24 : amp;
  const lambda = 64 * Math.exp(0.693 * k[2]);
  const th = 6 * Math.exp(0.693 * k[3]) * (1 + 0.06 * Math.sin(t * 0.37 + 1));
  const phase = 0.4 + 0.3 * Math.sin(t * 0.31 + 2);
  const w = TAU / lambda;
  const xs = params.xs;
  for (let j = 0; j < N; j++) xs[j] = W / 2 + amp * Math.sin(w * (j - PAD) + phase);
  params.half = th / 2;
  hsv(k[0] + 0.36, 0.8, 1, params.col, 0);
}

export function draw(display, params, time) {
  const xs = params.xs;
  const half = params.half;
  const col = params.col;
  // Only the stretch of the curve within the line's half thickness (and a little more) of a row can touch it.
  const reach = half + 1.5;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    let j0 = Math.floor(py - reach) + PAD;
    let j1 = Math.ceil(py + reach) + PAD;
    j0 = j0 < 0 ? 0 : j0;
    j1 = j1 > N - 2 ? N - 2 : j1;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      // The distance to the nearest piece of the curve, taken one row at a time.
      let best = 1e9;
      for (let j = j0; j <= j1; j++) {
        const ax = xs[j];
        const ay = j - PAD;
        const dx = xs[j + 1] - ax;
        let u = ((px - ax) * dx + (py - ay)) / (dx * dx + 1);
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        const ex = px - (ax + u * dx);
        const ey = py - (ay + u);
        const d2 = ex * ex + ey * ey;
        if (d2 < best) best = d2;
      }
      let m = half + 0.5 - Math.sqrt(best);
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
