// ===== Patternflow pattern =====
// Title:   Rhombus
// Family:  geometry
// Idea:    One four-sided shape set by its two diagonals on a bare dark ground, a rhombus when they cut each other in half and a kite when one is slid along the other.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 141
// Round:   143
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Across=0..3, Down=-1..1, Cross=-1..1
//
// Knob 1: Hue. The colour of the shape, all the way round the wheel.
// Knob 2: Across. The diagonal that lies across the panel, from 12 LEDs at 0 to 60 LEDs at 3. The knob's 2 is 44.
// Knob 3: Down. The diagonal that stands up the panel, from 30 LEDs at -1 to 120 LEDs at 1. At 0 it is 75.
// Knob 4: Cross. Where the across diagonal meets the down one, measured from the top: a fifth of the way down at -1, in the middle at 0, four fifths down at 1.

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
  // The four corners, top, right, bottom, left, as x then y.
  params.px = new Float32Array(4);
  params.py = new Float32Array(4);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // At 0 the hue knob would open on red; the shape starts on violet.
  hsv(k[0] + 0.72, 0.8, 1, params.col);
  // The across diagonal breathes by a few percent on a slow clock, and the down one on another that never meets it.
  // The knobs set the lengths; this only keeps the edges from being quite still.
  const across = (12 + 16 * k[1]) * (1 + 0.06 * Math.sin(params.t * 0.57));
  const down = (75 + 45 * k[2]) * (1 + 0.04 * Math.sin(params.t * 0.39 + 1.3));
  const cross = 0.5 + 0.3 * k[3];
  // The shape stands with the middle of its height on the middle of the panel, whatever Cross does.
  const top = H / 2 - down / 2;
  const meet = top + cross * down;
  params.px[0] = W / 2;
  params.py[0] = top;
  params.px[1] = W / 2 + across / 2;
  params.py[1] = meet;
  params.px[2] = W / 2;
  params.py[2] = top + down;
  params.px[3] = W / 2 - across / 2;
  params.py[3] = meet;
}

// Signed distance from a point to the convex four-cornered shape: negative inside, positive outside.
function quad(x, y, px, py) {
  let best = 1e9;
  let inside = true;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) & 3;
    const ex = px[j] - px[i];
    const ey = py[j] - py[i];
    const vx = x - px[i];
    const vy = y - py[i];
    let t = (vx * ex + vy * ey) / (ex * ex + ey * ey);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = vx - ex * t;
    const qy = vy - ey * t;
    const d2 = qx * qx + qy * qy;
    if (d2 < best) best = d2;
    // The corners go round clockwise on the panel, so inside is to the right of every edge.
    if (ex * vy - ey * vx < 0) inside = false;
  }
  const d = Math.sqrt(best);
  return inside ? -d : d;
}

export function draw(display, params, time) {
  const col = params.col;
  const px = params.px;
  const py = params.py;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cov = 0.5 - quad(x + 0.5, y + 0.5, px, py);
      if (cov <= 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const m = cov > 1 ? 1 : cov;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
