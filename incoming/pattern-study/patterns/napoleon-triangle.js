// ===== Patternflow pattern =====
// Title:   Napoleon Triangle
// Family:  geometry
// Idea:    Stand an isosceles triangle with a 120 degree top on every side of any triangle and the three tops are the corners of an equilateral one, however lopsided the triangle you started with, and it stays equilateral when you flatten the triangle to a line and flip it over.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Napoleon's theorem, that the centres of the equilateral triangles raised on the sides of any triangle form an equilateral triangle (attributed to Napoleon Bonaparte; the first printed statement is W. Rutherford, 1825), original, pattern round 138
// Round:   138
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Lean=0..3, Height=-1..1, Angle=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. The three triangles on the sides take three colours a third of the wheel apart.
// Knob 2: Lean. Where the top corner of the base triangle stands over its base, from far past the left end to far past the right end; the knob's 2 is a place right of the middle. The two bottom corners stay put.
// Knob 3: Height. How high the top corner stands over the base. Near the left end it passes through the flat triangle, where all three corners lie on one line, and comes out the other side with the triangle turned over; the knob's start is a tall triangle.
// Knob 4: Angle. The angle at the foot of each triangle raised on a side. At 30 degrees, the knob's start, the top is a 120 degree corner and the three tops make an equilateral triangle, drawn in white; away from it they stop being equilateral. Below 0 the triangles are raised inwards.

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
  // The six points: the three corners of the base triangle, then the top raised on A to B, on B to C and on C to A.
  params.px = new Float32Array(6);
  params.py = new Float32Array(6);
  // Four triangles, three edges each: the base, then the three raised ones. Each edge is a line whose value is the distance in LEDs, positive inside.
  params.ex = new Float32Array(12);
  params.ey = new Float32Array(12);
  params.ec = new Float32Array(12);
  params.ok = new Float32Array(4);
  params.sx = new Float32Array(6);
  params.sy = new Float32Array(6);
  params.col = new Float32Array(12);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath moves the top corner of the base triangle a little, sideways and up and down.
  const c = k[1] - 1.5 + 0.16 * Math.sin(t * 0.43 + 1);
  const h = 2.2 + 2.4 * k[2] + 0.16 * Math.sin(t * 0.37 + 2);
  const beta = ((30 + 42 * (k[3] - 0.06)) * Math.PI) / 180;
  const tb = Math.tan(beta);
  const px = params.px;
  const py = params.py;
  px[0] = -1;
  py[0] = 0;
  px[1] = 1;
  py[1] = 0;
  px[2] = c;
  py[2] = -h;
  // Each side's top stands over its middle, on the outward side, half the side times the tangent of the angle at its foot away.
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    const dx = px[j] - px[i];
    const dy = py[j] - py[i];
    px[3 + i] = (px[i] + px[j]) * 0.5 - dy * 0.5 * tb;
    py[3 + i] = (py[i] + py[j]) * 0.5 + dx * 0.5 * tb;
  }
  // The whole figure is moved and scaled so that it just fits the panel.
  let x0 = px[0];
  let x1 = px[0];
  let y0 = py[0];
  let y1 = py[0];
  for (let i = 1; i < 6; i++) {
    if (px[i] < x0) x0 = px[i];
    if (px[i] > x1) x1 = px[i];
    if (py[i] < y0) y0 = py[i];
    if (py[i] > y1) y1 = py[i];
  }
  const mx = (x0 + x1) * 0.5;
  const my = (y0 + y1) * 0.5;
  const s = Math.min(28 / Math.max(0.001, (x1 - x0) * 0.5), 58 / Math.max(0.001, (y1 - y0) * 0.5));
  const sx = params.sx;
  const sy = params.sy;
  for (let i = 0; i < 6; i++) {
    sx[i] = W / 2 + (px[i] - mx) * s;
    sy[i] = H / 2 + (py[i] - my) * s;
  }
  // The four triangles, as corner indices.
  const tri = [0, 1, 2, 0, 1, 3, 1, 2, 4, 2, 0, 5];
  for (let q = 0; q < 4; q++) {
    const a = tri[q * 3];
    const b = tri[q * 3 + 1];
    const d = tri[q * 3 + 2];
    const idx = [a, b, d];
    let area = 0;
    for (let i = 0; i < 3; i++) {
      const u = idx[i];
      const v = idx[(i + 1) % 3];
      area += sx[u] * sy[v] - sx[v] * sy[u];
    }
    params.ok[q] = Math.abs(area) > 0.5 ? 1 : 0;
    const sgn = area > 0 ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      const u = idx[i];
      const v = idx[(i + 1) % 3];
      const bx = sx[v] - sx[u];
      const by = sy[v] - sy[u];
      const len = Math.max(0.0001, Math.sqrt(bx * bx + by * by));
      params.ex[q * 3 + i] = (-sgn * by) / len;
      params.ey[q * 3 + i] = (sgn * bx) / len;
      params.ec[q * 3 + i] = (sgn * (-bx * sy[u] + by * sx[u])) / len;
    }
  }
  hsv(k[0] + 0.62, 0.45, 0.3, params.col, 0);
  for (let i = 0; i < 3; i++) hsv(k[0] + 0.03 + 0.333 * i, 0.72, 0.82, params.col, 3 + i * 3);
}

function seg(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  let u = ((x - ax) * dx + (y - ay) * dy) / Math.max(0.0001, dx * dx + dy * dy);
  if (u < 0) u = 0;
  else if (u > 1) u = 1;
  const ex = x - (ax + dx * u);
  const ey = y - (ay + dy * u);
  return Math.sqrt(ex * ex + ey * ey);
}

export function draw(display, params, time) {
  const ex = params.ex;
  const ey = params.ey;
  const ec = params.ec;
  const ok = params.ok;
  const col = params.col;
  const sx = params.sx;
  const sy = params.sy;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      let r = 3;
      let g = 3;
      let b = 8;
      for (let q = 0; q < 4; q++) {
        if (ok[q] === 0) continue;
        const o = q * 3;
        let d = ex[o] * px + ey[o] * py + ec[o];
        const e1 = ex[o + 1] * px + ey[o + 1] * py + ec[o + 1];
        const e2 = ex[o + 2] * px + ey[o + 2] * py + ec[o + 2];
        if (e1 < d) d = e1;
        if (e2 < d) d = e2;
        let cv = d + 0.5;
        if (cv <= 0) continue;
        if (cv > 1) cv = 1;
        r += (col[q * 3] - r) * cv;
        g += (col[q * 3 + 1] - g) * cv;
        b += (col[q * 3 + 2] - b) * cv;
      }
      // The triangle of the three tops, in white, and its corners.
      let dl = seg(px, py, sx[3], sy[3], sx[4], sy[4]);
      const d2 = seg(px, py, sx[4], sy[4], sx[5], sy[5]);
      const d3 = seg(px, py, sx[5], sy[5], sx[3], sy[3]);
      if (d2 < dl) dl = d2;
      if (d3 < dl) dl = d3;
      let cw = 1.5 - dl;
      if (cw > 0) {
        if (cw > 1) cw = 1;
        r += (255 - r) * cw;
        g += (250 - g) * cw;
        b += (240 - b) * cw;
      }
      for (let i = 3; i < 6; i++) {
        const dx = px - sx[i];
        const dy = py - sy[i];
        const q = dx * dx + dy * dy;
        if (q < 9) {
          let cd = 2.6 - Math.sqrt(q);
          if (cd > 1) cd = 1;
          if (cd > 0) {
            r += (255 - r) * cd;
            g += (250 - g) * cd;
            b += (240 - b) * cd;
          }
        }
      }
      display.setPixel(x, y, r, g, b);
    }
  }
}
