// ===== Patternflow pattern =====
// Title:   Ceva Walk
// Family:  geometry
// Idea:    Cut each side of a triangle at a point and the three lines from the corners to those points meet in one point exactly when the three ratios of the cut sides multiply to 1, which a walk of three steps, each as long as one ratio's logarithm, shows by coming back to where it began.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ceva's theorem on lines through the corners of a triangle (Giovanni Ceva, 1678, De lineis rectis), original, pattern round 139
// Round:   139
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, First=0..3, Second=-1..1, Slip=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. The three lines from the corners take three colours a third of the wheel apart, and each step of the walk below takes the colour of its line.
// Knob 2: First. Where the first cut sits on the left side of the triangle, as the ratio of its two pieces; the knob's start is the first piece longer. The line to the opposite corner and the first step of the walk move with it.
// Knob 3: Second. Where the second cut sits on the bottom side. Turned down, the cut runs to the left corner and the second step of the walk goes backward.
// Knob 4: Slip. How far the third cut sits from the place where the three lines meet. At its start the third cut is exactly there and the walk below closes; either way off it, the three lines stop meeting and cut a small white triangle between them, and the walk ends beside where it began.

const W = 64;
const H = 128;
// The triangle's corners, in LEDs: A at the top, B bottom left, C bottom right.
const AX = 29;
const AY = 8;
const BX = 5;
const BY = 83;
const CX = 59;
const CY = 75;
// The walk: it starts on this column, and a step of 1 in the logarithm is this many LEDs.
const WALK_X = 32;
const STEP = 11;

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
  // The three feet of the lines: F on AB, D on BC, E on CA.
  params.fx = new Float32Array(3);
  params.fy = new Float32Array(3);
  // The three places two of the lines cross: AD with BE, BE with CF, CF with AD.
  params.ix = new Float32Array(3);
  params.iy = new Float32Array(3);
  // The walk: where it stands after 0, 1, 2 and 3 steps.
  params.wx = new Float32Array(4);
  params.col = new Float32Array(18);
}

// Where the line through (ax, ay) and (bx, by) crosses the line through (cx, cy) and (dx, dy).
function cross(ax, ay, bx, by, cx, cy, dx, dy, at, ox, oy) {
  const r1x = bx - ax;
  const r1y = by - ay;
  const r2x = dx - cx;
  const r2y = dy - cy;
  let den = r1x * r2y - r1y * r2x;
  if (Math.abs(den) < 0.0001) den = den < 0 ? -0.0001 : 0.0001;
  const u = ((cx - ax) * r2y - (cy - ay) * r2x) / den;
  ox[at] = ax + r1x * u;
  oy[at] = ay + r1y * u;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The logarithms of the three ratios. The first two are set by the knobs, the third by Ceva's rule that the three multiply to 1,
  // less the slip, which is what the fourth knob adds to the sum. The slow breath moves the first two a little.
  const l1 = 0.9 * (k[1] - 1) + 0.12 * Math.sin(t * 0.43 + 0.5);
  const l2 = -0.7 + 1.1 * k[2] + 0.12 * Math.sin(t * 0.31 + 2.1);
  const slip = 1.2 * (k[3] - 0.06);
  const l3 = slip - l1 - l2;
  const r1 = Math.exp(l1);
  const r2 = Math.exp(l2);
  const r3 = Math.exp(l3);
  // F divides AB with AF : FB = r1, D divides BC with BD : DC = r2, E divides CA with CE : EA = r3.
  const t1 = r1 / (1 + r1);
  const t2 = r2 / (1 + r2);
  const t3 = r3 / (1 + r3);
  const fx = params.fx;
  const fy = params.fy;
  fx[0] = AX + (BX - AX) * t1;
  fy[0] = AY + (BY - AY) * t1;
  fx[1] = BX + (CX - BX) * t2;
  fy[1] = BY + (CY - BY) * t2;
  fx[2] = CX + (AX - CX) * t3;
  fy[2] = CY + (AY - CY) * t3;
  // The line from A goes to D (foot 1), from B to E (foot 2), from C to F (foot 0).
  const ix = params.ix;
  const iy = params.iy;
  cross(AX, AY, fx[1], fy[1], BX, BY, fx[2], fy[2], 0, ix, iy);
  cross(BX, BY, fx[2], fy[2], CX, CY, fx[0], fy[0], 1, ix, iy);
  cross(CX, CY, fx[0], fy[0], AX, AY, fx[1], fy[1], 2, ix, iy);
  const wx = params.wx;
  wx[0] = WALK_X;
  wx[1] = wx[0] + l1 * STEP;
  wx[2] = wx[1] + l2 * STEP;
  wx[3] = wx[2] + l3 * STEP;
  const col = params.col;
  hsv(k[0] + 0.03, 0.74, 0.95, col, 0);
  hsv(k[0] + 0.363, 0.74, 0.95, col, 3);
  hsv(k[0] + 0.697, 0.74, 0.95, col, 6);
  hsv(k[0] + 0.62, 0.4, 0.2, col, 9);
  hsv(k[0] + 0.62, 0.35, 0.5, col, 12);
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

function edge(x, y, ax, ay, bx, by) {
  return ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / Math.hypot(bx - ax, by - ay);
}

export function draw(display, params, time) {
  const fx = params.fx;
  const fy = params.fy;
  const ix = params.ix;
  const iy = params.iy;
  const wx = params.wx;
  const col = params.col;
  // The sign of the corner order tells which side of an edge is inside.
  const sgn = edge(CX, CY, AX, AY, BX, BY) > 0 ? 1 : -1;
  const rowY = [98, 109, 120];
  for (let y = 0; y < H; y++) {
    const yy = y + 0.5;
    for (let x = 0; x < W; x++) {
      const xx = x + 0.5;
      let r = 3;
      let g = 3;
      let b = 8;
      // The triangle's body, a dark tint, and its three sides, a little lighter.
      const e0 = sgn * edge(xx, yy, AX, AY, BX, BY);
      const e1 = sgn * edge(xx, yy, BX, BY, CX, CY);
      const e2 = sgn * edge(xx, yy, CX, CY, AX, AY);
      let ev = e0 < e1 ? e0 : e1;
      if (e2 < ev) ev = e2;
      let cb = ev + 0.5;
      if (cb > 0) {
        if (cb > 1) cb = 1;
        r += (col[9] - r) * cb;
        g += (col[10] - g) * cb;
        b += (col[11] - b) * cb;
      }
      const ds = Math.min(seg(xx, yy, AX, AY, BX, BY), seg(xx, yy, BX, BY, CX, CY), seg(xx, yy, CX, CY, AX, AY));
      let cs = 1.3 - ds;
      if (cs > 0) {
        if (cs > 1) cs = 1;
        r += (col[12] - r) * cs;
        g += (col[13] - g) * cs;
        b += (col[14] - b) * cs;
      }
      // The three lines: from A to D, from B to E, from C to F, each in its own colour.
      for (let i = 0; i < 3; i++) {
        const sx = i === 0 ? AX : i === 1 ? BX : CX;
        const sy = i === 0 ? AY : i === 1 ? BY : CY;
        const f = i === 0 ? 1 : i === 1 ? 2 : 0;
        const d = seg(xx, yy, sx, sy, fx[f], fy[f]);
        let cl = 1.5 - d;
        if (cl > 0) {
          if (cl > 1) cl = 1;
          r += (col[i * 3] - r) * cl;
          g += (col[i * 3 + 1] - g) * cl;
          b += (col[i * 3 + 2] - b) * cl;
        }
      }
      // The feet of the lines, in the colour of their line.
      for (let i = 0; i < 3; i++) {
        const f = i === 0 ? 1 : i === 1 ? 2 : 0;
        const ex = xx - fx[f];
        const ey = yy - fy[f];
        const q = ex * ex + ey * ey;
        if (q < 12) {
          let cd = 2.9 - Math.sqrt(q);
          if (cd > 1) cd = 1;
          if (cd > 0) {
            r += (col[i * 3] - r) * cd;
            g += (col[i * 3 + 1] - g) * cd;
            b += (col[i * 3 + 2] - b) * cd;
          }
        }
      }
      // Where the lines cross: three white dots, which become one when they meet, and the triangle they cut.
      const dw = Math.min(seg(xx, yy, ix[0], iy[0], ix[1], iy[1]), seg(xx, yy, ix[1], iy[1], ix[2], iy[2]), seg(xx, yy, ix[2], iy[2], ix[0], iy[0]));
      let cw = 1.1 - dw;
      for (let i = 0; i < 3; i++) {
        const ex = xx - ix[i];
        const ey = yy - iy[i];
        const q = ex * ex + ey * ey;
        if (q < 9) {
          const cd = 2.5 - Math.sqrt(q);
          if (cd > cw) cw = cd;
        }
      }
      if (cw > 0) {
        if (cw > 1) cw = 1;
        r += (250 - r) * cw;
        g += (246 - g) * cw;
        b += (236 - b) * cw;
      }
      // The walk, below the triangle: three bars, each from where the step before it ended to where it ends.
      if (yy > 90) {
        for (let i = 0; i < 3; i++) {
          const dy = Math.abs(yy - rowY[i]);
          if (dy > 4.5) continue;
          const a0 = wx[i];
          const a1 = wx[i + 1];
          const lo = a0 < a1 ? a0 : a1;
          const hi = a0 < a1 ? a1 : a0;
          let hc = Math.min(xx + 0.5, hi + 0.5) - Math.max(xx - 0.5, lo - 0.5);
          let vc = 4.5 - dy;
          if (hc > 0 && vc > 0) {
            if (hc > 1) hc = 1;
            if (vc > 1) vc = 1;
            const cv = hc * vc;
            r += (col[i * 3] - r) * cv;
            g += (col[i * 3 + 1] - g) * cv;
            b += (col[i * 3 + 2] - b) * cv;
          }
        }
        // A thin line joins each step's end to the start of the next, and the column the walk began on is a white line.
        let cl = 0;
        for (let i = 1; i < 3; i++) {
          const dx = Math.abs(xx - wx[i]);
          if (yy > rowY[i - 1] + 4 && yy < rowY[i] - 4 && dx < 1.1) {
            const c2 = 1.1 - dx;
            if (c2 > cl) cl = c2 * 0.7;
          }
        }
        const d0 = Math.abs(xx - WALK_X);
        if (yy > 92 && yy < 127 && d0 < 0.9) {
          const c3 = (0.9 - d0) * 1.1;
          if (c3 > cl) cl = c3;
        }
        if (cl > 0) {
          if (cl > 1) cl = 1;
          r += (250 - r) * cl;
          g += (246 - g) * cl;
          b += (236 - b) * cl;
        }
      }
      display.setPixel(x, y, r, g, b);
    }
  }
}
