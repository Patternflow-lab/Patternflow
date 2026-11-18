// ===== Patternflow pattern =====
// Title:   Varignon Nest
// Family:  geometry
// Idea:    Join the midpoints of the sides of any four sided shape and you get a parallelogram of half the area, and joining the midpoints of that gives another, so a quadrilateral whose corners and diagonals you move holds a nest of ever smaller parallelograms, each half the area of the one outside it.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Varignon's theorem, that the midpoints of the sides of any quadrilateral are the corners of a parallelogram (Pierre Varignon, published 1731), original, pattern round 137
// Round:   137
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Cross=0..3, Angle=-1..1, Ratio=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. The colour also runs a little round it from the outer shape to the innermost.
// Knob 2: Cross. Where the two diagonals cross each other, from near one end of the long diagonal and near the middle of the short one at the left to the opposite at the right; the knob's 2 is a place nearer the right. Only the outer shape moves. The parallelogram of midpoints inside it keeps its shape, because it depends only on the diagonals' lengths and directions.
// Knob 3: Angle. The angle between the two diagonals, from 52 degrees at the left to 128 degrees at the right. In the middle it is a right angle, and the first parallelogram is a rectangle.
// Knob 4: Ratio. The short diagonal against the long one, from a third at the left to equal at the right. Where the two are equal the first parallelogram is a rhombus, and with a right angle too it is a square.

const W = 64;
const H = 128;
const LEVELS = 12;

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
  params.n = 8;
  params.vx = new Float32Array((LEVELS + 1) * 4);
  params.vy = new Float32Array((LEVELS + 1) * 4);
  params.ex = new Float32Array((LEVELS + 1) * 4);
  params.ey = new Float32Array((LEVELS + 1) * 4);
  params.ec = new Float32Array((LEVELS + 1) * 4);
  params.col = new Float32Array((LEVELS + 1) * 3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swings the crossing, the angle between the diagonals and the short diagonal's length a little.
  const cross = (2 * k[1]) / 3 - 1 + 0.13 * Math.sin(t * 0.43 + 1);
  const theta = ((90 + 38 * k[2]) * Math.PI) / 180 + 0.07 * Math.sin(t * 0.57);
  const ratio = (0.6 + 0.4 * k[3]) * (1 + 0.07 * Math.sin(t * 0.37 + 2));
  const p = 0.5 + 0.32 * cross;
  const q = 0.5 - 0.2 * cross;
  // The long diagonal points down the panel; the short one is turned from it by the angle between them.
  const d2x = ratio * Math.sin(theta);
  const d2y = ratio * Math.cos(theta);
  const vx = params.vx;
  const vy = params.vy;
  // The corners in order round the shape, taken from where the diagonals cross.
  vx[0] = 0;
  vy[0] = -p;
  vx[1] = -q * d2x;
  vy[1] = -q * d2y;
  vx[2] = 0;
  vy[2] = 1 - p;
  vx[3] = (1 - q) * d2x;
  vy[3] = (1 - q) * d2y;
  // The shape is moved and scaled so that it just fits the panel.
  let x0 = vx[0];
  let x1 = vx[0];
  let y0 = vy[0];
  let y1 = vy[0];
  for (let i = 1; i < 4; i++) {
    if (vx[i] < x0) x0 = vx[i];
    if (vx[i] > x1) x1 = vx[i];
    if (vy[i] < y0) y0 = vy[i];
    if (vy[i] > y1) y1 = vy[i];
  }
  const mx = (x0 + x1) * 0.5;
  const my = (y0 + y1) * 0.5;
  const sx = 30 / Math.max(0.001, (x1 - x0) * 0.5);
  const sy = 62 / Math.max(0.001, (y1 - y0) * 0.5);
  const s = Math.min(sx, sy);
  for (let i = 0; i < 4; i++) {
    vx[i] = W / 2 + (vx[i] - mx) * s;
    vy[i] = H / 2 + (vy[i] - my) * s;
  }
  // Each level's corners are the midpoints of the level outside it.
  let area = 0;
  for (let lv = 0; lv <= LEVELS; lv++) {
    const o = lv * 4;
    if (lv > 0) {
      const u = (lv - 1) * 4;
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        vx[o + i] = (vx[u + i] + vx[u + j]) * 0.5;
        vy[o + i] = (vy[u + i] + vy[u + j]) * 0.5;
      }
    }
    let a = 0;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      a += vx[o + i] * vy[o + j] - vx[o + j] * vy[o + i];
    }
    if (lv === 0) area = Math.abs(a) * 0.5;
    const sgn = a > 0 ? 1 : -1;
    // Each side as a line whose value is the distance in LEDs, positive on the inside.
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const bx = vx[o + j] - vx[o + i];
      const by = vy[o + j] - vy[o + i];
      const len = Math.max(0.0001, Math.sqrt(bx * bx + by * by));
      params.ex[o + i] = (-sgn * by) / len;
      params.ey[o + i] = (sgn * bx) / len;
      params.ec[o + i] = (sgn * (-bx * vy[o + i] + by * vx[o + i])) / len;
    }
  }
  // Every level has half the area of the one outside it, so the levels run out when they are a few LEDs across.
  params.n = Math.max(2, Math.min(LEVELS, Math.floor(Math.log(area / 2.5) / Math.LN2)));
  for (let lv = 0; lv <= LEVELS; lv++) {
    const f = lv / LEVELS;
    const v = lv % 2 === 0 ? 0.3 + 0.35 * f : 0.5 + 0.5 * f;
    hsv(k[0] + 0.6 + 0.05 * lv, 0.85 - 0.3 * f, v, params.col, lv * 3);
  }
}

export function draw(display, params, time) {
  const n = params.n;
  const ex = params.ex;
  const ey = params.ey;
  const ec = params.ec;
  const col = params.col;
  const vx = params.vx;
  const vy = params.vy;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let lv = 0; lv <= n; lv++) {
        const o = lv * 4;
        // The distance to the nearest side; the levels lie one inside another, so the first that misses ends it.
        let d = ex[o] * px + ey[o] * py + ec[o];
        for (let i = 1; i < 4; i++) {
          const e = ex[o + i] * px + ey[o + i] * py + ec[o + i];
          if (e < d) d = e;
        }
        let c = d + 0.5;
        if (c <= 0) break;
        if (c > 1) c = 1;
        r += (col[lv * 3] - r) * c;
        g += (col[lv * 3 + 1] - g) * c;
        b += (col[lv * 3 + 2] - b) * c;
      }
      // The first parallelogram's corners are the midpoints of the outer shape's sides, and they are marked.
      for (let i = 4; i < 8; i++) {
        const dx = px - vx[i];
        const dy = py - vy[i];
        const q = dx * dx + dy * dy;
        if (q < 6.5) {
          let c = 2 - Math.sqrt(q);
          if (c > 1) c = 1;
          if (c > 0) {
            r += (255 - r) * c;
            g += (240 - g) * c;
            b += (225 - b) * c;
          }
        }
      }
      display.setPixel(x, y, r, g, b);
    }
  }
}
