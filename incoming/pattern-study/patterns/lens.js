// ===== Patternflow pattern =====
// Title:   Lens
// Family:  geometry
// Idea:    Two equal circles overlap and only the part they share is lit, a lens on a bare dark ground, and the knobs are its colour, its length, how round it is and how far it is turned.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 141
// Round:   143
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Length=0..3, Round=-1..1, Turn=0..1
//
// Knob 1: Hue. The colour of the lens, all the way round the wheel.
// Knob 2: Length. Tip to tip, from 24 LEDs at 0 to 112 LEDs at 3. The knob's 2 is 83.
// Knob 3: Round. How fat the lens is across its middle, as a share of its length: a thin blade a tenth as wide as long at -1, a little over half as wide at 0, a full circle at 1.
// Knob 4: Turn. Half a turn about the middle of the panel, from upright at the left to upright again at the right.

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
  params.col = [255, 255, 255];
  // The two circles: their common radius, how far each centre sits from the middle across the lens, and the turn.
  params.r = 60;
  params.off = 30;
  params.c = 1;
  params.s = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // At 0 the hue knob would open on red; the lens starts on a cool blue-green.
  hsv(k[0] + 0.5, 0.85, 1, params.col);
  // The length breathes by a few percent on a slow clock. It is only enough that the tips are never quite still.
  const len = (24 + (88 * k[1]) / 3) * (1 + 0.05 * Math.sin(params.t * 0.53));
  // The share of the length the lens is wide across its middle: 0.1 as a blade, 1 as a full circle.
  const round = 0.1 + 0.9 * ((k[2] + 1) / 2);
  const half = (len * round) / 2;
  // Two circles of radius r, each centre r - half from the middle, share a lens half wide and len / 2 long.
  // A chord of len and a bulge of half give r = ((len / 2)^2 + half^2) / (2 half).
  params.r = ((len / 2) * (len / 2) + half * half) / (2 * half);
  params.off = params.r - half;
  const a = k[3] * Math.PI;
  params.c = Math.cos(a);
  params.s = Math.sin(a);
}

export function draw(display, params, time) {
  const col = params.col;
  const r = params.r;
  const off = params.off;
  const c = params.c;
  const s = params.s;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      // The LED in the lens's own frame: u across the lens, v along it.
      const u = c * dx + s * dy;
      const v = -s * dx + c * dy;
      // Distance to each circle's edge. The lens is the part inside both.
      const d1 = Math.sqrt((u + off) * (u + off) + v * v) - r;
      const d2 = Math.sqrt((u - off) * (u - off) + v * v) - r;
      const d = d1 > d2 ? d1 : d2;
      let m = 0.5 - d;
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
