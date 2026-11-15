// ===== Patternflow pattern =====
// Title:   Half Turn Quad
// Family:  geometry
// Idea:    Any four sided shape, however lopsided or dented, covers the whole panel with no gap and no overlap when copies of it are turned half way about the middles of its sides, and the four corners then meet at every point, so their angles add up to a full turn.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the tiling of the plane by any quadrilateral through half turns about the midpoints of its sides, a school-geometry fact old enough to have no name, original, pattern round 138
// Round:   140
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Lean=0..3, Taper=-1..1, Dent=0..1
//
// Knob 1: Hue. Turns the colours round the wheel. Each of the four sides has a colour of its own, and so has each of the four corners.
// Knob 2: Lean. Slides the top side of the shape sideways against the bottom one, from a quarter of the bottom side to the left to a quarter to the right; the knob's 2 is just under a tenth to the right. The whole tiling shears with it.
// Knob 3: Taper. The top side as long as the bottom side times a number from a quarter at the left to one and a half at the right; its 0 is three fifths. At one it is a parallelogram and at the right end the shape is wider at the top.
// Knob 4: Dent. Pushes the far top corner in towards the opposite corner. Past about three quarters of the way it goes through the diagonal and the shape is an arrowhead with a corner pointing in, which still tiles.

const W = 64;
const H = 128;
const S = 25;
const OX = 32;
const OY = 64;

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
  // The shape's corners A, B, C, D in LEDs, then the sum A + B, the two diagonals, the middle of the shape, and the middle of its half turn.
  params.vx = new Float32Array(4);
  params.vy = new Float32Array(4);
  params.m = new Float32Array(16);
  // The colours of the four sides, of the four corners and of the shape and its half turned copy.
  params.col = new Float32Array(3 * 10);
  params.q = new Float32Array(2);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath leans the shape, tapers it a little and turns the whole tiling a few degrees.
  const lean = (k[1] - 1.5) * 0.17 + 0.05 * Math.sin(t * 0.43);
  const wt = 0.6 * Math.exp(0.9 * k[2] + 0.07 * Math.sin(t * 0.37 + 1));
  const dent = Math.max(0, k[3] + 0.03 * Math.sin(t * 0.31 + 2));
  // A is the bottom left corner and the corners go round to D at the top left. The unit is one bottom side.
  let ax = -0.5;
  let ay = 0.5;
  const bx = 0.5;
  const by = 0.5;
  const dx = lean - 0.5 * wt;
  const dy = -0.5;
  let cx = lean + 0.5 * wt;
  let cy = -0.5;
  // The far top corner C walks towards the middle of the diagonal BD and a third as far again past it.
  const mx = (bx + dx) / 2;
  const my = (by + dy) / 2;
  cx += dent * 1.35 * (mx - cx);
  cy += dent * 1.35 * (my - cy);
  const gx = (ax + bx + cx + dx) / 4;
  const gy = (ay + by + cy + dy) / 4;
  const th = 0.05 * Math.sin(t * 0.29);
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  const ux = [ax, bx, cx, dx];
  const uy = [ay, by, cy, dy];
  const vx = params.vx;
  const vy = params.vy;
  for (let i = 0; i < 4; i++) {
    const x = (ux[i] - gx) * S;
    const y = (uy[i] - gy) * S;
    vx[i] = OX + cs * x - sn * y;
    vy[i] = OY + sn * x + cs * y;
  }
  const m = params.m;
  // 0,1: A + B   2,3: e1 = C - A   4,5: e2 = D - B   6: 1 over the cross product of e1 and e2   7,8: the middle of the shape   9,10: the middle of its half turned copy
  m[0] = vx[0] + vx[1];
  m[1] = vy[0] + vy[1];
  m[2] = vx[2] - vx[0];
  m[3] = vy[2] - vy[0];
  m[4] = vx[3] - vx[1];
  m[5] = vy[3] - vy[1];
  const cr = m[2] * m[5] - m[3] * m[4];
  m[6] = 1 / (Math.abs(cr) < 1 ? (cr < 0 ? -1 : 1) : cr);
  m[7] = (vx[0] + vx[1] + vx[2] + vx[3]) / 4;
  m[8] = (vy[0] + vy[1] + vy[2] + vy[3]) / 4;
  m[9] = m[0] - m[7];
  m[10] = m[1] - m[8];
  const c = params.col;
  for (let i = 0; i < 4; i++) hsv(k[0] + 0.03 + i * 0.25, 0.85, 1, c, i * 3);
  for (let i = 0; i < 4; i++) hsv(k[0] + 0.155 + i * 0.25, 0.3, 1, c, 12 + i * 3);
  hsv(k[0] + 0.1, 0.55, 0.3, c, 24);
  hsv(k[0] + 0.6, 0.55, 0.3, c, 27);
}

function inQuad(x, y, vx, vy) {
  let c = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    if (vy[i] > y !== vy[j] > y && x < ((vx[j] - vx[i]) * (y - vy[i])) / (vy[j] - vy[i]) + vx[i]) c = !c;
  }
  return c;
}

// Looks for the copy of the shape, or of its half turned copy, that holds the LED: first among the copies lying nearest in the lattice the two diagonals make, then further out.
// Returns 0 for the shape, 1 for the half turned copy and -1 for none, and leaves the LED's place in the shape's own frame in params.q.
function locate(px, py, params) {
  const m = params.m;
  const vx = params.vx;
  const vy = params.vy;
  const e1x = m[2];
  const e1y = m[3];
  const e2x = m[4];
  const e2y = m[5];
  for (let reach = 1; reach <= 3; reach++) {
    for (let pass = 0; pass < 2; pass++) {
      const rx = px - (pass === 0 ? m[7] : m[9]);
      const ry = py - (pass === 0 ? m[8] : m[10]);
      const n0 = Math.round((rx * e2y - ry * e2x) * m[6]);
      const m0 = Math.round((e1x * ry - e1y * rx) * m[6]);
      for (let i = -reach; i <= reach; i++) {
        for (let j = -reach; j <= reach; j++) {
          // The ring of copies already tried at a smaller reach is skipped.
          if (reach > 1 && i > 1 - reach && i < reach - 1 && j > 1 - reach && j < reach - 1) continue;
          let tx = px - ((n0 + i) * e1x + (m0 + j) * e2x);
          let ty = py - ((n0 + i) * e1y + (m0 + j) * e2y);
          if (pass === 1) {
            tx = m[0] - tx;
            ty = m[1] - ty;
          }
          if (inQuad(tx, ty, vx, vy)) {
            params.q[0] = tx;
            params.q[1] = ty;
            return pass;
          }
        }
      }
    }
  }
  return -1;
}

export function draw(display, params, time) {
  const vx = params.vx;
  const vy = params.vy;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      // Which copy covers this LED, and where the LED falls in the frame of the shape.
      const found = locate(px, py, params);
      const qx = params.q[0];
      const qy = params.q[1];
      let r = 0;
      let g = 0;
      let b = 0;
      if (found >= 0) {
        // Measured in the frame of the shape itself: the nearest side and how far, and the nearest corner.
        let dmin = 99;
        let edge = 0;
        let cmin = 99;
        let corner = 0;
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) & 3;
          const sx = vx[j] - vx[i];
          const sy = vy[j] - vy[i];
          const ll = sx * sx + sy * sy || 1;
          let tt = ((qx - vx[i]) * sx + (qy - vy[i]) * sy) / ll;
          tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
          const ex = qx - vx[i] - tt * sx;
          const ey = qy - vy[i] - tt * sy;
          const dd = Math.sqrt(ex * ex + ey * ey);
          if (dd < dmin) {
            dmin = dd;
            edge = i;
          }
          const cx = qx - vx[i];
          const cy = qy - vy[i];
          const cd = Math.sqrt(cx * cx + cy * cy);
          if (cd < cmin) {
            cmin = cd;
            corner = i;
          }
        }
        const f = found === 0 ? 24 : 27;
        r = col[f];
        g = col[f + 1];
        b = col[f + 2];
        // A soft glow in the colour of the nearest side, and a line of it on the side itself.
        let gl = 1 - dmin / 6;
        gl = gl < 0 ? 0 : gl;
        gl = gl * gl * 0.3;
        r += (col[edge * 3] - r) * gl;
        g += (col[edge * 3 + 1] - g) * gl;
        b += (col[edge * 3 + 2] - b) * gl;
        let ln = 1.15 - dmin;
        if (ln > 0) {
          if (ln > 1) ln = 1;
          r += (col[edge * 3] - r) * ln;
          g += (col[edge * 3 + 1] - g) * ln;
          b += (col[edge * 3 + 2] - b) * ln;
        }
        // The corner, in a colour of its own: four of them meet at every point.
        let cd = 3.5 - cmin;
        if (cd > 0) {
          if (cd > 1) cd = 1;
          r += (col[12 + corner * 3] - r) * cd;
          g += (col[13 + corner * 3] - g) * cd;
          b += (col[14 + corner * 3] - b) * cd;
        }
      }
      display.setPixel(x, y, r, g, b);
    }
  }
}
