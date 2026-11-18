// ===== Patternflow pattern =====
// Title:   Cut Squares
// Family:  geometry
// Idea:    One rectangle is cut into the biggest square that fits, then the rest into the biggest square that fits, and so on down to the last LED, so its two side lengths alone decide how many squares there are and how they wind.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Euclid's algorithm drawn as squares (Euclid, Elements VII, about 300 BC); whirling squares of the golden rectangle, pattern round 130
// Round:   130
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Ratio=0..7, Round=0..1, Gap=0..0.2
//
// Knob 1: Hue. Turns the whole set of squares around the colour wheel together.
// Knob 2: Ratio. The long side of the rectangle against its short side, from a single square at 0 through the golden rectangle at 2 to two squares exactly at about 3.2, and on to a thin tall strip at 7.
// Knob 3: Round. The corners of every square, from sharp at 0 to a full disc at 1.
// Knob 4: Gap. The dark line between squares, from none to three LEDs wide.

const W = 64;
const H = 128;
const MAX = 18;

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
  params.sq = new Float32Array(MAX * 4);
  params.col = new Float32Array(MAX * 3);
  params.buf = new Float32Array(W * H * 3);
  params.n = 0;
  params.ratio = 1.6;
  params.hue = 0.5;
  params.round = 0;
  params.gap = 0.9;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // At 0 the hue knob would open on red; the first square starts a little round the wheel.
  params.hue = k[0] + 0.56;
  // The golden ratio sits at knob 2. It breathes a little, so a still picture is never quite still.
  params.ratio = (1 + 0.309 * k[1]) * (1 + 0.012 * Math.sin(params.t * 0.55));
  params.round = k[2];
  params.gap = k[3] * 15;

  // The rectangle: 64 wide while it is no taller than two squares, then as tall as the panel and narrowing.
  const r = params.ratio;
  const w = r <= 2 ? W : H / r;
  const h = r <= 2 ? W * r : H;
  let x0 = (W - w) / 2;
  let x1 = x0 + w;
  let y0 = (H - h) / 2;
  let y1 = y0 + h;

  // Cut the biggest square off the end of the longer side. The cuts turn clockwise round
  // the rectangle (top, right, bottom, left) as far as the long side allows.
  let side = 0;
  let n = 0;
  while (n < MAX) {
    const rw = x1 - x0;
    const rh = y1 - y0;
    const s = Math.min(rw, rh);
    if (s < 0.9) break;
    const tall = rh >= rw;
    // A tall rest is cut at its top or bottom, a wide one at its right or left.
    while (tall ? side % 2 === 1 : side % 2 === 0) side = (side + 1) % 4;
    const q = params.sq;
    if (side === 0) {
      q[n * 4] = x0; q[n * 4 + 1] = y0; q[n * 4 + 2] = x1; q[n * 4 + 3] = y0 + s;
      y0 += s;
    } else if (side === 2) {
      q[n * 4] = x0; q[n * 4 + 1] = y1 - s; q[n * 4 + 2] = x1; q[n * 4 + 3] = y1;
      y1 -= s;
    } else if (side === 1) {
      q[n * 4] = x1 - s; q[n * 4 + 1] = y0; q[n * 4 + 2] = x1; q[n * 4 + 3] = y1;
      x1 -= s;
    } else {
      q[n * 4] = x0; q[n * 4 + 1] = y0; q[n * 4 + 2] = x0 + s; q[n * 4 + 3] = y1;
      x0 += s;
    }
    side = (side + 1) % 4;
    n++;
  }
  params.n = n;
  for (let i = 0; i < n; i++) {
    // A square under 2 LEDs fades in as it grows, so the smallest cuts never pop.
    const size = Math.min(params.sq[i * 4 + 2] - params.sq[i * 4], params.sq[i * 4 + 3] - params.sq[i * 4 + 1]);
    const fade = Math.min(1, (size - 0.9) / 1.2);
    hsv(params.hue + i * 0.19, 0.88, (0.96 - (i % 2) * 0.12) * fade, params.col, i * 3);
  }
}

export function draw(display, params, time) {
  const buf = params.buf;
  buf.fill(0);
  const gap = params.gap;
  for (let i = 0; i < params.n; i++) {
    const q = params.sq;
    const cx = (q[i * 4] + q[i * 4 + 2]) / 2;
    const cy = (q[i * 4 + 1] + q[i * 4 + 3]) / 2;
    const hx = (q[i * 4 + 2] - q[i * 4]) / 2 - gap / 2;
    const hy = (q[i * 4 + 3] - q[i * 4 + 1]) / 2 - gap / 2;
    if (hx <= 0.05 || hy <= 0.05) continue;
    const rad = params.round * Math.min(hx, hy);
    const r = params.col[i * 3];
    const g = params.col[i * 3 + 1];
    const b = params.col[i * 3 + 2];
    const xa = Math.max(0, Math.floor(cx - hx - 1));
    const xb = Math.min(W - 1, Math.ceil(cx + hx + 1));
    const ya = Math.max(0, Math.floor(cy - hy - 1));
    const yb = Math.min(H - 1, Math.ceil(cy + hy + 1));
    for (let y = ya; y <= yb; y++) {
      const dy = Math.abs(y + 0.5 - cy) - (hy - rad);
      for (let x = xa; x <= xb; x++) {
        const dx = Math.abs(x + 0.5 - cx) - (hx - rad);
        const ox = dx > 0 ? dx : 0;
        const oy = dy > 0 ? dy : 0;
        const d = Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(dx, dy), 0) - rad;
        const cov = 0.5 - d;
        if (cov <= 0) continue;
        const c = cov > 1 ? 1 : cov;
        const p = (y * W + x) * 3;
        buf[p] += r * c;
        buf[p + 1] += g * c;
        buf[p + 2] += b * c;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(255, buf[p]), Math.min(255, buf[p + 1]), Math.min(255, buf[p + 2]));
    }
  }
}
