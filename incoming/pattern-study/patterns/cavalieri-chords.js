// ===== Patternflow pattern =====
// Title:   Cavalieri Chords
// Family:  geometry
// Idea:    A disc cut into thin horizontal chords has the same area however you slide the chords sideways, so the same stack is drawn three times down the panel, as the round disc, as a leaning stack and as a wavy one, and every copy holds exactly the same bars.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Cavalieri's principle, that two shapes cut by every parallel line into pieces of equal length have equal area (Bonaventura Cavalieri, Geometria indivisibilibus, 1635; the same rule is Zu Chongzhi and Zu Geng's principle for volumes, c. 500), original, pattern round 138
// Round:   138
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Lean=0..2.5, Slices=-1..1, Waves=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. The colour also runs a little round it from the top chord to the bottom one, so the same chord can be found in all three shapes.
// Knob 2: Lean. How far the middle shape's chords are slid sideways, in step with their height, from leaning one way at the left to leaning the other at the right. The knob's 2 is a lean to the right. At the middle of the range the lean is gone and the middle shape is the disc again.
// Knob 3: Slices. How many chords the disc is cut into, from 4 to 24; the knob's start is 14. With few chords it is a stepped stack, with many it is a smooth disc.
// Knob 4: Waves. How many waves the bottom shape's slide makes from top to bottom, from a gentle bend near the left to two and a half waves at the right; the knob's start is one and a half. Every chord keeps its length, so the area stays the same.

const W = 64;
const H = 128;
const R = 18;
const TOP = [2, 46, 90];
const MAXN = 24;

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
  params.n = 14;
  params.slice = 2 * R / 14;
  // For each of the three shapes and each chord: where its middle is and how long it is.
  params.mid = new Float32Array(3 * MAXN);
  params.half = new Float32Array(MAXN);
  params.col = new Float32Array(MAXN * 3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = Math.round(14 + 10 * k[2]);
  const th = (2 * R) / n;
  params.n = n;
  params.slice = th;
  // The slow breath leans the middle stack a little more and less and slides the waves along.
  const lean = 12 * (2 * (k[1] / 2.5) - 1) * (1 + 0.22 * Math.sin(t * 0.43 + 1));
  const waves = 1.5 + 1.2 * (k[3] - 0.06);
  const phase = 0.6 + 1.3 * Math.sin(t * 0.29);
  for (let i = 0; i < n; i++) {
    // The chord's height from the middle of the disc, from -1 at the top to 1 at the bottom, and its half length there.
    const y = (-R + (i + 0.5) * th) / R;
    params.half[i] = R * Math.sqrt(Math.max(0, 1 - y * y));
    params.mid[i] = 0;
    params.mid[MAXN + i] = lean * y;
    params.mid[2 * MAXN + i] = 9 * Math.sin(Math.PI * waves * y + phase);
    const f = n > 1 ? i / (n - 1) : 0;
    hsv(k[0] + 0.55 + 0.32 * f, 0.78, i % 2 === 0 ? 0.5 : 0.95, params.col, i * 3);
  }
}

export function draw(display, params, time) {
  const n = params.n;
  const th = params.slice;
  const mid = params.mid;
  const half = params.half;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    // Which of the three shapes this row belongs to, if any.
    let fig = -1;
    for (let f = 0; f < 3; f++) {
      if (py >= TOP[f] - 0.5 && py <= TOP[f] + 2 * R + 0.5) fig = f;
    }
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      let r = 3;
      let g = 3;
      let b = 8;
      if (fig >= 0) {
        const rel = py - TOP[fig];
        let i = Math.floor(rel / th);
        if (i < 0) i = 0;
        else if (i >= n) i = n - 1;
        const yt = TOP[fig] + i * th;
        const yb = yt + th;
        const xl = W / 2 + mid[fig * MAXN + i] - half[i];
        const xr = W / 2 + mid[fig * MAXN + i] + half[i];
        let cx = Math.min(px - xl, xr - px) + 0.5;
        let cy = Math.min(py - yt, yb - py) + 0.7;
        if (cx > 1) cx = 1;
        if (cy > 1) cy = 1;
        const cv = cx > 0 && cy > 0 ? cx * cy : 0;
        if (cv > 0) {
          r += (col[i * 3] - r) * cv;
          g += (col[i * 3 + 1] - g) * cv;
          b += (col[i * 3 + 2] - b) * cv;
        }
      }
      display.setPixel(x, y, r, g, b);
    }
  }
}
