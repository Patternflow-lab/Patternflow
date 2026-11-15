// ===== Patternflow pattern =====
// Title:   Ratio Table
// Family:  geometry
// Idea:    The columns of a table grow by one ratio and its rows by another, so every cell is its column's width by its row's height, and the cells where the two lengths agree, the squares, light up along a line the two ratios choose.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: a geometric progression for each side, drawn as a multiplication table of rectangles, pattern round 131
// Round:   131
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Across=0..4, Down=0..4, First=0..0.2
//
// Knob 1: Hue. Turns the colour of the whole table round the wheel; a cell's colour also follows how far it sits from the corner.
// Knob 2: Across. The ratio between one column's width and the next, from 1.06 (columns nearly alike) to 1.46.
// Knob 3: Down. The ratio between one row's height and the next, from 1.12 to 1.48.
// Knob 4: First. The side of the smallest cell, in the top left corner, from 1.5 LEDs to 12.

const W = 64;
const H = 128;
const MAXC = 80;

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
  params.hue = 0.1;
  params.bx = new Float32Array(MAXC);
  params.by = new Float32Array(MAXC);
  params.nx = 0;
  params.ny = 0;
  params.rx = 1.26;
  params.ry = 1.12;
  params.w0 = 4.6;
  params.col = new Float32Array(3);
  params.ci = new Int16Array(W);
  params.cc = new Float32Array(W);
  params.rj = new Int16Array(H);
  params.rc = new Float32Array(H);
}

// Cumulative edges of cells whose sizes start at w0 and grow by r, until the panel's length is passed.
function edges(out, w0, r, len) {
  let pos = 0;
  let w = w0;
  let n = 0;
  out[0] = 0;
  while (pos < len && n < MAXC - 1) {
    pos += w;
    w *= r;
    n++;
    out[n] = pos;
  }
  return n;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  params.hue = k[0] + 0.1;
  params.rx = 1.06 + 0.1 * k[1];
  params.ry = 1.12 + 0.09 * k[2];
  // The whole table breathes in and out a little about its corner.
  params.w0 = (1.5 + 52.5 * k[3]) * (1 + 0.03 * Math.sin(params.t * 0.5));
  params.nx = edges(params.bx, params.w0, params.rx, W);
  params.ny = edges(params.by, params.w0, params.ry, H);
}

export function draw(display, params, time) {
  const bx = params.bx;
  const by = params.by;
  const nx = params.nx;
  const ny = params.ny;
  // Per pixel column: which table column it is in, and how far in from the nearest edge, kept as a cover of the cell.
  const ci = params.ci;
  const cc = params.cc;
  const rj = params.rj;
  const rc = params.rc;
  const gap = 0.9;
  let i = 0;
  for (let x = 0; x < W; x++) {
    const fx = x + 0.5;
    while (i < nx - 1 && bx[i + 1] <= fx) i++;
    const w = bx[i + 1] - bx[i];
    const d = Math.min(fx - bx[i], bx[i + 1] - fx);
    // Cells under three LEDs lose their gap, so the corner is a colour and not a mesh.
    const g = gap * Math.min(1, Math.max(0, (w - 1.5) / 2.5));
    ci[x] = i;
    cc[x] = Math.min(1, Math.max(0, d - g / 2 + 0.5));
  }
  let j = 0;
  for (let y = 0; y < H; y++) {
    const fy = y + 0.5;
    while (j < ny - 1 && by[j + 1] <= fy) j++;
    const h = by[j + 1] - by[j];
    const d = Math.min(fy - by[j], by[j + 1] - fy);
    const g = gap * Math.min(1, Math.max(0, (h - 1.5) / 2.5));
    rj[y] = j;
    rc[y] = Math.min(1, Math.max(0, d - g / 2 + 0.5));
  }
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const j2 = rj[y];
    const h = by[j2 + 1] - by[j2];
    for (let x = 0; x < W; x++) {
      const cov = cc[x] * rc[y];
      if (cov <= 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const i2 = ci[x];
      const w = bx[i2 + 1] - bx[i2];
      // A square is a cell whose width and height agree; the further they part, the dimmer the cell.
      const l = Math.log(w / h);
      const square = Math.exp(-(l * l) / (2 * 0.22 * 0.22));
      hsv(params.hue + 0.6 * (i2 / nx + j2 / ny) * 0.5, 0.9 - 0.4 * square, 0.3 + 0.7 * square, col, 0);
      display.setPixel(x, y, col[0] * cov, col[1] * cov, col[2] * cov);
    }
  }
}
