// ===== Patternflow pattern =====
// Title:   Concentric
// Family:  geometry
// Idea:    A few round walls of one thickness stand one inside the other round the middle of the dark, and how many there are, how thick each wall is and how far out the last one stands are the knobs, with nothing else on the panel.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 146
// Round:   148
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=0..3, Wall=-1..1, Reach=-1..1
//
// Knob 1: Hue. The colour of the rings, turned round the wheel.
// Knob 2: Count. How many rings there are, from 2 at the left to 7 at the right, rounded to a whole number; the knob's 2 is 5. The rings share one outer edge, so more of them stand closer together, and the count stops where the walls would run into each other.
// Knob 3: Wall. How thick each ring is, from 1.5 LEDs at the left to the whole step between two rings less 1.5 LEDs at the right, so the gap never closes; its 0 is halfway.
// Knob 4: Reach. How far from the middle the outer edge of the last ring stands, from 18.7 LEDs at the left to 30.8 at the right; its 0.06 is 24.4.

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
  params.pitch = 4.9;
  params.wall = 2.4;
  params.reach = 24.4;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swells the whole stack of rings and thickens the walls a few percent.
  const reach = 24 * Math.exp(0.25 * k[3]) * (1 + 0.03 * Math.sin(t * 0.47));
  let n = Math.round(2 + 1.5 * k[1]);
  n = n < 2 ? 2 : n > 7 ? 7 : n;
  // Rings closer than 3.3 LEDs would run together, so a short reach holds fewer of them.
  const fit = Math.floor(reach / 3.3);
  if (n > fit) n = fit < 2 ? 2 : fit;
  const pitch = reach / n;
  let wall = 1.5 + (pitch - 3) * (0.5 + 0.5 * k[2]);
  wall *= 1 + 0.06 * Math.sin(t * 0.37 + 1);
  wall = wall > pitch - 1.3 ? pitch - 1.3 : wall;
  params.n = n;
  params.pitch = pitch;
  params.wall = wall;
  params.reach = reach;
  // At 0 the hue knob would open on red; the rings start on blue.
  hsv(k[0] + 0.62, 0.8, 1, params.col, 0);
}

export function draw(display, params, time) {
  const n = params.n;
  const pitch = params.pitch;
  const wall = params.wall;
  const col = params.col;
  const edge = params.reach + 2;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      const r = Math.sqrt(dx * dx + dy * dy);
      let c = 0;
      if (r < edge) {
        // Ring j has its outer edge j pitches out and is one wall thick. An LED between two edges can touch the ring just inside it or the one just outside.
        let j = Math.ceil(r / pitch);
        j = j < 1 ? 1 : j;
        for (let i = j - 1; i <= j; i++) {
          if (i < 1 || i > n) continue;
          let m = 0.5 - (Math.abs(r - (i * pitch - wall / 2)) - wall / 2);
          m = m < 0 ? 0 : m > 1 ? 1 : m;
          if (m > c) c = m;
        }
      }
      display.setPixel(x, y, col[0] * c, col[1] * c, col[2] * c);
    }
  }
}
