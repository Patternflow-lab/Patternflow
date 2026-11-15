// ===== Patternflow pattern =====
// Title:   Viviani Wedges
// Family:  geometry
// Idea:    However a point is moved about inside a regular polygon, the distances from it to the sides always add up to the same length, so the wedges it cuts the polygon into trade size with one another while the bar of their distances laid end to end stays exactly as long.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Viviani's theorem, that for a point inside an equilateral triangle the distances to the three sides sum to the triangle's height, and its extension to every regular polygon (Vincenzo Viviani, 17th century), original, pattern round 137
// Round:   137
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Reach=0..3, Turn=-1..1, Sides=3..8
//
// Knob 1: Hue. Turns the colours round the wheel. Each side of the polygon has a colour of its own, spaced round the wheel, and its wedge and its part of the bar share it.
// Knob 2: Reach. How far the point stands from the middle, from the middle itself at the left, where all the wedges are the same size, to nine tenths of the way to the sides at the right; the knob's 2 is three fifths. Close to a side the wedge on it thins to a sliver and the others fatten.
// Knob 3: Turn. The point's direction from the middle, a whole turn from the left end to the right. The distances trade places as the point goes round, and the bar's colours slide along it.
// Knob 4: Sides. How many sides the polygon has, from 3 to 8, rounded to a whole number. At 3 it is the equilateral triangle of the theorem.

const W = 64;
const H = 128;
const NMAX = 8;
const R = 30;
const BX0 = 4;
const BX1 = 60;
const BY0 = 86;
const BY1 = 114;

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
  params.n = 3;
  params.a = R / 2;
  params.cy = 50;
  params.px = 0;
  params.py = 0;
  // Per side: the outward normal, the corner it starts at (from the point), the distance to it and the foot of the perpendicular.
  params.nx = new Float32Array(NMAX);
  params.ny = new Float32Array(NMAX);
  params.wx = new Float32Array(NMAX + 1);
  params.wy = new Float32Array(NMAX + 1);
  params.wl = new Float32Array(NMAX + 1);
  params.d = new Float32Array(NMAX);
  params.start = new Float32Array(NMAX + 1);
  params.wedge = new Float32Array(NMAX * 3);
  params.bar = new Float32Array(NMAX * 3);
  params.rgb = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  let n = Math.round(k[3]);
  n = n < 3 ? 3 : n > NMAX ? NMAX : n;
  params.n = n;
  const a = R * Math.cos(Math.PI / n);
  params.a = a;
  // The polygon is centred in the upper part of the panel; a triangle hangs lower than its middle because it is not as deep as it is tall.
  params.cy = 43 + (R - a) * 0.5;
  // The slow breath walks the point a few LEDs about its place.
  const rho = Math.min(0.92, Math.max(0, (0.9 * k[1]) / 3 + 0.05 * Math.sin(t * 0.47)));
  const psi = Math.PI * k[2] + 0.6 + 0.16 * Math.sin(t * 0.39 + 1);
  const pxr = rho * a * Math.cos(psi);
  const pyr = rho * a * Math.sin(psi);
  params.px = pxr;
  params.py = pyr;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const phi = -Math.PI / 2 + (2 * Math.PI * i) / n;
    params.wx[i] = R * Math.cos(phi) - pxr;
    params.wy[i] = R * Math.sin(phi) - pyr;
    const nphi = phi + Math.PI / n;
    params.nx[i] = Math.cos(nphi);
    params.ny[i] = Math.sin(nphi);
    params.d[i] = a - (params.nx[i] * pxr + params.ny[i] * pyr);
    total += params.d[i];
  }
  params.wx[n] = params.wx[0];
  params.wy[n] = params.wy[0];
  for (let i = 0; i <= n; i++) params.wl[i] = Math.max(0.001, Math.sqrt(params.wx[i] * params.wx[i] + params.wy[i] * params.wy[i]));
  let run = 0;
  for (let i = 0; i < n; i++) {
    params.start[i] = run / total;
    run += params.d[i];
    hsv(k[0] + 0.03 + i / n, 0.85, 0.78, params.wedge, i * 3);
    hsv(k[0] + 0.03 + i / n, 0.85, 0.78, params.bar, i * 3);
  }
  params.start[n] = 1;
}

export function draw(display, params, time) {
  const n = params.n;
  const a = params.a;
  const cy = params.cy;
  const pxr = params.px;
  const pyr = params.py;
  const nx = params.nx;
  const ny = params.ny;
  const wx = params.wx;
  const wy = params.wy;
  const wl = params.wl;
  const d = params.d;
  const start = params.start;
  const wedge = params.wedge;
  const bar = params.bar;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    const ry = py - cy;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      const rx = px - W / 2;
      let r = 0;
      let g = 0;
      let b = 0;
      if (py >= BY0 && py < BY1 && px >= BX0 && px < BX1) {
        // The distances laid end to end: the bar always runs the whole width, however they are shared out.
        const u = (px - BX0) / (BX1 - BX0);
        let i = 0;
        while (i < n - 1 && u >= start[i + 1]) i++;
        let m = 1;
        const dl = (u - start[i]) * (BX1 - BX0);
        const dr = (start[i + 1] - u) * (BX1 - BX0);
        const e = Math.min(i > 0 ? dl : 9, i < n - 1 ? dr : 9);
        if (e < 1) m = 0.25 + 0.75 * e;
        r = bar[i * 3] * m;
        g = bar[i * 3 + 1] * m;
        b = bar[i * 3 + 2] * m;
      } else if (
        (py >= BY1 + 3 && py < BY1 + 4 && px >= BX0 && px < BX1) ||
        (py >= BY1 + 1.5 && py < BY1 + 5.5 && ((px >= BX0 && px < BX0 + 1) || (px >= BX1 - 1 && px < BX1)))
      ) {
        // A rule under the bar, the length it keeps.
        r = 150;
        g = 150;
        b = 160;
      } else {
        // Inside the polygon: the distance to the nearest side tells whether, and the point's own corners tell which wedge.
        let dp = 99;
        for (let i = 0; i < n; i++) {
          const e = a - (nx[i] * rx + ny[i] * ry);
          if (e < dp) dp = e;
        }
        let c = dp + 0.5;
        if (c > 0) {
          if (c > 1) c = 1;
          const qx = rx - pxr;
          const qy = ry - pyr;
          let w = 0;
          for (let i = 0; i < n; i++) {
            if (wx[i] * qy - wy[i] * qx >= 0 && wx[i + 1] * qy - wy[i + 1] * qx < 0) {
              w = i;
              break;
            }
          }
          // A dark seam along the two rays that bound the wedge.
          const s0 = (wx[w] * qy - wy[w] * qx) / wl[w];
          const s1 = -(wx[w + 1] * qy - wy[w + 1] * qx) / wl[w + 1];
          let s = s0 < s1 ? s0 : s1;
          s = s < 0 ? 0 : s > 1 ? 1 : s;
          const m = (0.3 + 0.7 * s) * c;
          r = wedge[w * 3] * m;
          g = wedge[w * 3 + 1] * m;
          b = wedge[w * 3 + 2] * m;
          // The perpendiculars from the point to the sides, and the point.
          let best = 0;
          for (let i = 0; i < n; i++) {
            let tt = (qx * nx[i] + qy * ny[i]) / d[i];
            tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
            const ex = qx - tt * d[i] * nx[i];
            const ey = qy - tt * d[i] * ny[i];
            const ce = 1.3 - Math.sqrt(ex * ex + ey * ey);
            if (ce > best) best = ce;
          }
          const cp = 2.2 - Math.sqrt(qx * qx + qy * qy);
          if (cp > best) best = cp;
          if (best > 0) {
            if (best > 1) best = 1;
            r += (255 - r) * best;
            g += (245 - g) * best;
            b += (235 - b) * best;
          }
        }
      }
      display.setPixel(x, y, r, g, b);
    }
  }
}
