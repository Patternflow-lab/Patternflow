// ===== Patternflow pattern =====
// Title:   Harmonic Shelf
// Family:  geometry
// Idea:    Squares whose sides fall off as one over their number stand in a row on a shelf, biggest first, and when the shelf is full the next row starts, so one exponent decides whether the shelves keep coming or the last squares crowd into a single row.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the harmonic series and the p-series, whose partial sums of one over n to the p diverge for p up to 1 and settle for p above 1 (Nicole Oresme, c. 1360; Leonhard Euler, 1737), original, pattern round 135
// Round:   135
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Power=0..4, First=-1..1, Start=0..1
//
// Knob 1: Hue. Turns the colours round the wheel. Each shelf is a little further round the wheel than the one above.
// Knob 2: Power. The exponent p, so that square n has a side of the first side divided by n to the p. At the left every square is as big as the first and they stand in a grid; the knob's 2 is p of one, the harmonic series, whose widths never add up to a finite row; at the right p is two and the squares fall off so fast that the last ones crowd into one row.
// Knob 3: First. How long the side of the first square is, from 34 LEDs to 62; the middle is 46.
// Knob 4: Start. Where the series starts. At the left it starts at one, and the second square is half the first at p of one. Turned up, the series starts further along, so the squares fall off more slowly and stand nearly level, down to the start at twelve.

const W = 64;
const H = 128;
const GAP = 1;
const PLANK = 1;
const MAX = 200;
const SMALLEST = 1.4;

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
  params.hue = 0;
  params.n = 0;
  params.rows = 0;
  params.offset = 0;
  // Each square: left, top, side, number, shelf. Each shelf: the y where its plank starts.
  params.sx = new Float32Array(MAX);
  params.sy = new Float32Array(MAX);
  params.ss = new Float32Array(MAX);
  params.sj = new Int16Array(MAX);
  params.sr = new Int16Array(MAX);
  params.plank = new Float32Array(MAX);
  params.buf = new Float32Array(W * H * 3);
  params.rgb = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  params.hue = k[0];
  // The slow breath moves the exponent and the first side a little, so the squares near a shelf's end slide in and out.
  const p = (k[1] / 2) * (1 + 0.025 * Math.sin(t * 0.41)) + 0.012 * Math.sin(t * 0.29 + 2);
  const first = 46 * Math.pow(1.35, k[2]) * (1 + 0.02 * Math.sin(t * 0.37 + 1));
  const n0 = Math.pow(12, k[3]) * (1 + 0.02 * Math.sin(t * 0.23 + 4));
  const sx = params.sx;
  const sy = params.sy;
  const ss = params.ss;
  const sj = params.sj;
  const sr = params.sr;
  let j = 0;
  let n = 0;
  let rows = 0;
  let top = 0;
  while (top < H && n < MAX) {
    const s0 = first * Math.pow(n0 / (n0 + j), p);
    if (s0 < SMALLEST) break;
    const h = Math.min(s0, 63);
    let x = 0;
    while (n < MAX) {
      const raw = first * Math.pow(n0 / (n0 + j), p);
      const s = Math.min(raw, 63);
      if (raw < SMALLEST || (x > 0 && x + s > W)) break;
      sx[n] = x;
      sy[n] = top + h - s;
      ss[n] = s;
      sj[n] = j;
      sr[n] = rows;
      n++;
      j++;
      x += s + GAP;
    }
    params.plank[rows] = top + h;
    rows++;
    top += h + PLANK + GAP + 1;
  }
  params.n = n;
  params.rows = rows;
  const total = rows > 0 ? params.plank[rows - 1] + PLANK : 0;
  params.offset = total < H ? (H - total) / 2 : 0;
}

export function draw(display, params, time) {
  const buf = params.buf;
  const rgb = params.rgb;
  const hue = params.hue;
  const oy = params.offset;
  hsv(hue + 0.55, 0.6, 0.05, rgb, 0);
  const br = rgb[0];
  const bg = rgb[1];
  const bb = rgb[2];
  for (let i = 0; i < W * H; i++) {
    buf[i * 3] = br;
    buf[i * 3 + 1] = bg;
    buf[i * 3 + 2] = bb;
  }
  // The planks, a faint line under each shelf.
  for (let r = 0; r < params.rows; r++) {
    hsv(hue + 0.55 + 0.05 * r, 0.6, 0.22, rgb, 0);
    const y0 = params.plank[r] + oy;
    const y1 = y0 + PLANK;
    for (let iy = Math.max(0, Math.floor(y0)); iy < Math.min(H, Math.ceil(y1)); iy++) {
      const cy = Math.max(0, Math.min(iy + 1, y1) - Math.max(iy, y0));
      for (let ix = 0; ix < W; ix++) {
        const o = (iy * W + ix) * 3;
        buf[o] += (rgb[0] - buf[o]) * cy;
        buf[o + 1] += (rgb[1] - buf[o + 1]) * cy;
        buf[o + 2] += (rgb[2] - buf[o + 2]) * cy;
      }
    }
  }
  const half = GAP / 2;
  for (let n = 0; n < params.n; n++) {
    const par = params.sj[n] % 2;
    const r = params.sr[n];
    // A light square and a dim one by turns, and the hue a little further on for each shelf.
    if (par === 0) hsv(hue + 0.52 + 0.05 * r, 0.75, 1, rgb, 0);
    else hsv(hue + 0.59 + 0.05 * r, 0.85, 0.58, rgb, 0);
    const x0 = params.sx[n] + half;
    const x1 = params.sx[n] + params.ss[n] - half;
    const y0 = params.sy[n] + oy + half;
    const y1 = params.sy[n] + oy + params.ss[n] - half;
    for (let iy = Math.max(0, Math.floor(y0)); iy < Math.min(H, Math.ceil(y1)); iy++) {
      const cy = Math.max(0, Math.min(iy + 1, y1) - Math.max(iy, y0));
      for (let ix = Math.max(0, Math.floor(x0)); ix < Math.min(W, Math.ceil(x1)); ix++) {
        const cx = Math.max(0, Math.min(ix + 1, x1) - Math.max(ix, x0));
        const a = cx * cy;
        const o = (iy * W + ix) * 3;
        buf[o] += (rgb[0] - buf[o]) * a;
        buf[o + 1] += (rgb[1] - buf[o + 1]) * a;
        buf[o + 2] += (rgb[2] - buf[o + 2]) * a;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, buf[o], buf[o + 1], buf[o + 2]);
    }
  }
}
