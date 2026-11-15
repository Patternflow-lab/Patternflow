// ===== Patternflow pattern =====
// Title:   Miquel Corners
// Family:  geometry
// Idea:    Mark a point on each side of a triangle, cut off the three corners, and the circles round those three corner triangles always meet at one common point, wherever on the sides the marks are put.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Miquel's theorem (Auguste Miquel, 1838), original, pattern round 138
// Round:   140
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Base=0..3, Right=-1..1, Left=0..1
//
// Knob 1: Hue. Turns the colours round the wheel. The three corners and their circles are a third of a turn apart.
// Knob 2: Base. Where the mark on the bottom side stands, from the lower left corner at the left to the lower right corner at the right, a sixth in from either end; the knob's 2 is three fifths of the way along.
// Knob 3: Right. Where the mark on the right side stands, from the lower right corner up to the top one, again a sixth in from either end; its 0 is the middle.
// Knob 4: Left. Where the mark on the left side stands, from a quarter of the way down from the top corner at the left to four fifths of the way down at the right; the knob's 0.06 is just over a quarter.

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

// The centre of the circle through three points.
function circum(ax, ay, bx, by, cx, cy, out, at) {
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)) || 1e-6;
  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  out[at] = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  out[at + 1] = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
}

export function setup(params) {
  params.t = 0;
  // Corners A (top), B (lower left), C (lower right), then the marks D on BC, E on CA and F on AB, and the common point M.
  params.p = new Float32Array(14);
  // The centres and radii of the three circles.
  params.c = new Float32Array(9);
  params.col = new Float32Array(3 * 7);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const p = params.p;
  // The slow breath walks each mark a few LEDs along its side and sways the top corner.
  const ax = 32 + 1.6 * Math.sin(t * 0.27);
  const ay = 28;
  const bx = 11;
  const by = 98;
  const cx = 53;
  const cy = 98;
  const d = Math.min(0.9, Math.max(0.1, 1 / 6 + (2 / 3) * (k[1] / 3) + 0.022 * Math.sin(t * 0.43)));
  const e = Math.min(0.9, Math.max(0.1, 0.5 + (1 / 3) * k[2] + 0.025 * Math.sin(t * 0.37 + 1)));
  const f = Math.min(0.9, Math.max(0.1, 0.25 + 0.55 * k[3] + 0.025 * Math.sin(t * 0.31 + 2)));
  p[0] = ax;
  p[1] = ay;
  p[2] = bx;
  p[3] = by;
  p[4] = cx;
  p[5] = cy;
  p[6] = bx + d * (cx - bx);
  p[7] = by + d * (cy - by);
  p[8] = cx + e * (ax - cx);
  p[9] = cy + e * (ay - cy);
  p[10] = ax + f * (bx - ax);
  p[11] = ay + f * (by - ay);
  const c = params.c;
  // The circle through A, E, F, the one through B, F, D and the one through C, D, E.
  circum(p[0], p[1], p[8], p[9], p[10], p[11], c, 0);
  circum(p[2], p[3], p[10], p[11], p[6], p[7], c, 3);
  circum(p[4], p[5], p[6], p[7], p[8], p[9], c, 6);
  for (let i = 0; i < 3; i++) {
    const px = i === 0 ? p[0] : i === 1 ? p[2] : p[4];
    const py = i === 0 ? p[1] : i === 1 ? p[3] : p[5];
    const dx = px - c[i * 3];
    const dy = py - c[i * 3 + 1];
    c[i * 3 + 2] = Math.sqrt(dx * dx + dy * dy);
  }
  // The second place circles one and two cross, other than F: F turned over the line between their centres.
  const lx = c[3] - c[0];
  const ly = c[4] - c[1];
  const ll = lx * lx + ly * ly || 1e-6;
  const tt = ((p[10] - c[0]) * lx + (p[11] - c[1]) * ly) / ll;
  p[12] = 2 * (c[0] + tt * lx) - p[10];
  p[13] = 2 * (c[1] + tt * ly) - p[11];
  const col = params.col;
  for (let i = 0; i < 3; i++) {
    hsv(k[0] + 0.02 + i / 3, 0.85, 0.7, col, i * 3);
    hsv(k[0] + 0.02 + i / 3, 0.4, 1, col, 9 + i * 3);
  }
}

// Signed distance to a triangle, negative inside, the largest of the signed distances to its three sides.
function triDist(px, py, ax, ay, bx, by, cx, cy) {
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const sg = area > 0 ? 1 : -1;
  let m = -1e9;
  for (let e = 0; e < 3; e++) {
    const x0 = e === 0 ? ax : e === 1 ? bx : cx;
    const y0 = e === 0 ? ay : e === 1 ? by : cy;
    const x1 = e === 0 ? bx : e === 1 ? cx : ax;
    const y1 = e === 0 ? by : e === 1 ? cy : ay;
    const ex = x1 - x0;
    const ey = y1 - y0;
    const l = Math.sqrt(ex * ex + ey * ey) || 1;
    const dd = -(sg * (ex * (py - y0) - ey * (px - x0))) / l;
    if (dd > m) m = dd;
  }
  return m;
}

function segDist(px, py, x0, y0, x1, y1) {
  const sx = x1 - x0;
  const sy = y1 - y0;
  let tt = ((px - x0) * sx + (py - y0) * sy) / (sx * sx + sy * sy || 1);
  tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
  const ex = px - x0 - tt * sx;
  const ey = py - y0 - tt * sy;
  return Math.sqrt(ex * ex + ey * ey);
}

export function draw(display, params, time) {
  const p = params.p;
  const c = params.c;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      let r = 0;
      let g = 0;
      let b = 0;
      // The three discs, faint, added as light.
      let lr = 1;
      let lg = 1;
      let lb = 1;
      for (let i = 0; i < 3; i++) {
        const dx = px - c[i * 3];
        const dy = py - c[i * 3 + 1];
        const rr = Math.sqrt(dx * dx + dy * dy);
        let wd = c[i * 3 + 2] + 0.5 - rr;
        if (wd > 0) {
          if (wd > 1) wd = 1;
          const a = 0.2 * wd;
          lr *= 1 - (col[i * 3] / 255) * a;
          lg *= 1 - (col[i * 3 + 1] / 255) * a;
          lb *= 1 - (col[i * 3 + 2] / 255) * a;
        }
      }
      r = (1 - lr) * 255;
      g = (1 - lg) * 255;
      b = (1 - lb) * 255;
      // The three corner triangles, each in the colour of its circle.
      for (let i = 0; i < 3; i++) {
        const dc = i === 0 ? triDist(px, py, p[0], p[1], p[8], p[9], p[10], p[11]) : i === 1 ? triDist(px, py, p[2], p[3], p[10], p[11], p[6], p[7]) : triDist(px, py, p[4], p[5], p[6], p[7], p[8], p[9]);
        let w = 0.5 - dc;
        if (w > 0) {
          if (w > 1) w = 1;
          r += (col[i * 3] - r) * w;
          g += (col[i * 3 + 1] - g) * w;
          b += (col[i * 3 + 2] - b) * w;
        }
      }
      // The three circles' own lines, pale.
      for (let i = 0; i < 3; i++) {
        const dx = px - c[i * 3];
        const dy = py - c[i * 3 + 1];
        const rr = Math.sqrt(dx * dx + dy * dy);
        let wl = 1.15 - Math.abs(rr - c[i * 3 + 2]);
        if (wl > 0) {
          if (wl > 1) wl = 1;
          r += (col[9 + i * 3] - r) * wl;
          g += (col[10 + i * 3] - g) * wl;
          b += (col[11 + i * 3] - b) * wl;
        }
      }
      // The triangle itself, in a thin grey line.
      let dl = Math.min(segDist(px, py, p[0], p[1], p[2], p[3]), segDist(px, py, p[2], p[3], p[4], p[5]), segDist(px, py, p[4], p[5], p[0], p[1]));
      dl = 1.05 - dl;
      if (dl > 0) {
        if (dl > 1) dl = 1;
        r += (215 - r) * dl;
        g += (215 - g) * dl;
        b += (225 - b) * dl;
      }
      // The marks on the sides, and the point all three circles share.
      let dot = 0;
      for (let i = 3; i < 6; i++) {
        const dx = px - p[i * 2];
        const dy = py - p[i * 2 + 1];
        const dd = 2.3 - Math.sqrt(dx * dx + dy * dy);
        if (dd > dot) dot = dd;
      }
      const mx = px - p[12];
      const my = py - p[13];
      const dm = 3.1 - Math.sqrt(mx * mx + my * my);
      if (dm > dot) dot = dm;
      if (dot > 0) {
        if (dot > 1) dot = 1;
        r += (255 - r) * dot;
        g += (250 - g) * dot;
        b += (240 - b) * dot;
      }
      display.setPixel(x, y, r, g, b);
    }
  }
}
