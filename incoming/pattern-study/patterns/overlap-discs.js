// ===== Patternflow pattern =====
// Title:   Overlap Discs
// Family:  light
// Idea:    Three discs of coloured light lie on one another, and wherever two overlap the panel adds their light into a colour neither disc has, white where all three do.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: additive colour mixing of three primaries (Thomas Young, 1802; James Clerk Maxwell, 1855), drawn as three overlapping discs, pattern round 130
// Round:   130
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0.4..4, Turn=-1..1, Spread=0..0.2
//
// Knob 1: Hue. Turns the three colours around the wheel together, a third of a turn apart.
// Knob 2: Size. The radius of every disc, from a dot of 4 LEDs to a disc wider than the panel.
// Knob 3: Turn. Turns the three discs round the middle of the panel, half a turn each way from the start.
// Knob 4: Spread. How far each disc sits from the middle against its own radius, from all three on one spot (a white disc) to well apart.

const W = 64;
const H = 128;

function hsv(h, s, v, out, o) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(9);
  params.x = new Float32Array(3);
  params.y = new Float32Array(3);
  params.r = 20;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // At 0 the three colours would be pure red, green and blue; a shade round the wheel avoids a bare red.
  const hue = k[0] + 0.04;
  for (let i = 0; i < 3; i++) hsv(hue + i / 3, 1, 1, params.col, i * 3);
  params.r = k[1] * 10;
  // The trio sways a little about where the knobs put it, and breathes in and out.
  const turn = k[2] * Math.PI + 0.18 * Math.sin(params.t * 0.4);
  const spread = k[3] * 10 * params.r * (1 + 0.1 * Math.sin(params.t * 0.57 + 1));
  for (let i = 0; i < 3; i++) {
    const a = turn - Math.PI / 2 + (i * Math.PI * 2) / 3;
    params.x[i] = W / 2 + spread * Math.cos(a);
    params.y[i] = H / 2 + spread * Math.sin(a);
  }
}

export function draw(display, params, time) {
  const r = params.r;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let pr = 0;
      let pg = 0;
      let pb = 0;
      for (let i = 0; i < 3; i++) {
        const dx = x + 0.5 - params.x[i];
        const dy = y + 0.5 - params.y[i];
        const cov = r + 0.5 - Math.sqrt(dx * dx + dy * dy);
        if (cov <= 0) continue;
        const c = cov > 1 ? 1 : cov;
        pr += params.col[i * 3] * c;
        pg += params.col[i * 3 + 1] * c;
        pb += params.col[i * 3 + 2] * c;
      }
      display.setPixel(x, y, Math.min(255, pr), Math.min(255, pg), Math.min(255, pb));
    }
  }
}
