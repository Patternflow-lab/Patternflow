// ===== Patternflow pattern =====
// Title:   Klein's Sails
// Family:  number
// Idea:    The integer lattice flows along hyperbolas under the real powers of an integer matrix that fixes the line y = ax and its conjugate, with the X of the two lines standing lengthwise on the panel, and in each corner of the X the boundary of the convex hull of the lattice points, Klein's sail, slides along itself, its corners on the convergents of a towards y = ax, until after one unit of flow every point and every corner sits where another one was and the loop closes.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Klein's sails of continued fractions (Felix Klein, 1895), periodic continued fractions of quadratic irrationals (Joseph-Louis Lagrange, 1770), pattern round 65
// Round:   65
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Number=0..5, Zoom=10..22
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the sail below the line y = ax and its copy through the centre are azure, the other two rose, the two lines a near-white lilac and the lattice points dim teal with short tails along their hyperbolas.
// Knob 2: Speed. The flow in hyperbolic angle, 0.32 a second at 2, so a point keeps its product of distances to the two lines and moves 37% further out along y = ax each second. One loop takes log e seconds over 0.32: 5.5 s for the square root of 2, 3.0 s for the golden ratio. At 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Number. Which quadratic irrational a, with its continued fraction and the matrix M that loops the flow: 0 the square root of 2 = [1; 2, 2, ...] with M = [[3, 2], [4, 3]], 1 the golden ratio [1; 1, 1, ...] with [[1, 1], [1, 2]], 2 the square root of 3 = [1; 1, 2, 1, 2, ...] with [[2, 1], [3, 2]], 3 the square root of 5 = [2; 4, 4, ...] with [[9, 4], [20, 9]], 4 the square root of 7 = [2; 1, 1, 1, 4, ...] with [[8, 3], [21, 8]], 5 (1 + square root of 13) / 2 = [2; 3, 3, ...] with [[4, 3], [9, 7]]. A sail edge runs through a_k - 1 lattice points between its corners, and its a_k is written beside it when there is room.
// Knob 4: Zoom. LEDs between neighbouring lattice points, 10 to 22. At 10 the panel is 6.4 lattice steps wide and each sail keeps two or three corners on it for the square root of 2, four for the golden ratio; at 22 it is 2.9 steps wide with one or two corners a sail, and an edge is long enough to count the lattice points along it.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, sqrt, exp, log, atan, cos, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return out;
}

// a is the larger root of a^2 = P a + Q, and the unit e = A + B a of Z[a]
// is the fundamental one. Multiplying by e in the basis 1, a is the integer
// matrix [[A, B], [B Q, A + B P]] whose determinant is the norm of e; it
// sends (1, a) to e (1, a) and (1, a') to e' (1, a'). With norm -1 it swaps
// two corners of the X, so the flow loops on its square.
const NUMS = [
  { P: 0, Q: 2, A: 1, B: 1 },
  { P: 1, Q: 1, A: 0, B: 1 },
  { P: 0, Q: 3, A: 2, B: 1 },
  { P: 0, Q: 5, A: 2, B: 1 },
  { P: 0, Q: 7, A: 8, B: 3 },
  { P: 1, Q: 3, A: 1, B: 1 },
];

const gcd = (a, b) => {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
const mul = (m, v) => [m[0] * v[0] + m[1] * v[1], m[2] * v[0] + m[3] * v[1]];

function prepare(num) {
  const { P, Q, A, B } = num, root = sqrt(P * P + 4 * Q);
  const al = (P + root) / 2, al2 = (P - root) / 2;
  let M = [A, B, B * Q, A + B * P], e = A + B * al;
  if (M[0] * M[3] - M[1] * M[2] < 0) (M = [M[0] * M[0] + M[1] * M[2], M[0] * M[1] + M[1] * M[3], M[2] * M[0] + M[3] * M[2], M[2] * M[1] + M[3] * M[3]]), (e *= e);
  const Mi = [M[3], -M[1], -M[2], M[0]];
  // Eigen-coordinates: n = u (1, a) + w (1, a').
  const den = al - al2;
  const eig = (x, y) => [(y - al2 * x) / den, (al * x - y) / den];
  // The corners of the X: K1 holds u > 0, w > 0 (the positive x axis, below
  // y = a x), K2 holds u > 0, w < 0 (above it); K3 and K4 are their negatives.
  const sails = [];
  for (const sign of [1, -1]) {
    const pts = [];
    const R = 40;
    for (let x = -R; x <= R; x++)
      for (let y = -R; y <= R; y++) {
        const [u, w] = eig(x, y);
        if (u > 0 && sign * w > 0) pts.push([u, sign * w, x, y]);
      }
    pts.sort((p, q) => p[0] - q[0]);
    // The lower left hull in (u, w): a point that does not lie lower than the
    // last corner is inside the hull plus the corner's quadrant, and a corner
    // that the next point sees on its far side is no corner. The turn is read
    // from the integer coordinates, so points on an edge never count as
    // corners by a rounding error.
    const hull = [];
    for (const p of pts) {
      if (hull.length && p[1] >= hull[hull.length - 1][1]) continue;
      while (hull.length >= 2) {
        const o = hull[hull.length - 2], a = hull[hull.length - 1];
        const c = (a[2] - o[2]) * (p[3] - o[3]) - (a[3] - o[3]) * (p[2] - o[2]);
        if (sign * c >= 0) hull.pop();
        else break;
      }
      hull.push(p);
    }
    // One period: from the corner nearest the middle of the corner of the X
    // to its image under M, which is again a corner.
    let i0 = 0;
    for (let i = 1; i < hull.length; i++) if (abs(log(hull[i][0] / hull[i][1])) < abs(log(hull[i0][0] / hull[i0][1]))) i0 = i;
    const to = mul(M, [hull[i0][2], hull[i0][3]]);
    let j = i0 + 1;
    while (j < hull.length && !(hull[j][2] === to[0] && hull[j][3] === to[1])) j++;
    const period = hull.slice(i0, j).map((p) => [p[2], p[3]]);
    // The whole sail, as far as the flow can bring it onto the panel.
    const verts = [];
    for (let k = -6; k <= 6; k++) {
      let m = [1, 0, 0, 1];
      for (let s = 0; s < abs(k); s++) {
        const n = k > 0 ? M : Mi;
        m = [n[0] * m[0] + n[1] * m[2], n[0] * m[1] + n[1] * m[3], n[2] * m[0] + n[3] * m[2], n[2] * m[1] + n[3] * m[3]];
      }
      for (const v of period) verts.push(mul(m, v));
    }
    sails.push(verts.map((v) => [...v, ...eig(v[0], v[1])]));
  }
  // The K2 corner's bisector stands straight up.
  const th1 = atan(al), th2 = atan(al2), gam = PI / 2 - (th1 + th2 + PI) / 2;
  return { al, al2, e, le: log(e), M, eig, sails, cg: cos(gam), sg: sin(gam), th1, th2 };
}

export function setup(params) {
  params.s = { idx: -1, num: null, t: 0, buf: new Float32Array(W * H * 3), tail: new Float32Array(W * H), hue: -1, cols: [] };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const idx = cl(round(kv[2]), 0, NUMS.length - 1);
  if (idx !== S.idx) {
    S.idx = idx;
    S.num = NUMS[idx].prep || (NUMS[idx].prep = prepare(NUMS[idx]));
    S.t = 0;
    S.tail.fill(0);
  }
  S.zoom = cl(kv[3], 10, 22);
  S.t += (d * 0.16 * cl(kv[1], 0.2, 3)) / S.num.le;
  S.t -= floor(S.t);
  S.dt = d;
  if (kv[0] !== S.hue) {
    S.hue = kv[0];
    const h = kv[0] + 0.56;
    S.cols = [hsv(h, 0.7, 1, [0, 0, 0]), hsv(h + 0.36, 0.55, 1, [0, 0, 0]), hsv(h + 0.2, 0.18, 0.88, [0, 0, 0]), hsv(h - 0.06, 0.55, 0.62, [0, 0, 0])];
  }
}

// Lights a soft line from (x0, y0) to (x1, y1), its value kept where higher.
function seg(buf, x0, y0, x1, y1, wid, rgb, k) {
  if ((x0 < -2 && x1 < -2) || (x0 > W + 1 && x1 > W + 1) || (y0 < -2 && y1 < -2) || (y0 > H + 1 && y1 > H + 1)) return;
  const X0 = max(0, floor(min(x0, x1) - wid)), X1 = min(W - 1, ceil(max(x0, x1) + wid));
  const Y0 = max(0, floor(min(y0, y1) - wid)), Y1 = min(H - 1, ceil(max(y0, y1) + wid));
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1e-9;
  for (let y = Y0; y <= Y1; y++)
    for (let x = X0; x <= X1; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, t = cl((px * dx + py * dy) / l2, 0, 1);
      const ex = px - t * dx, ey = py - t * dy, a = cl(wid / 2 + 0.5 - sqrt(ex * ex + ey * ey), 0, 1) * k;
      if (a <= 0) continue;
      const o = (y * W + x) * 3;
      buf[o] = max(buf[o], rgb[0] * a);
      buf[o + 1] = max(buf[o + 1], rgb[1] * a);
      buf[o + 2] = max(buf[o + 2], rgb[2] * a);
    }
}

function dot(buf, cx, cy, r, rgb, k) {
  const X0 = max(0, floor(cx - r - 1)), X1 = min(W - 1, floor(cx + r + 1)), Y0 = max(0, floor(cy - r - 1)), Y1 = min(H - 1, floor(cy + r + 1));
  for (let y = Y0; y <= Y1; y++)
    for (let x = X0; x <= X1; x++) {
      const ex = x + 0.5 - cx, ey = y + 0.5 - cy, a = cl(r + 0.5 - sqrt(ex * ex + ey * ey), 0, 1) * k;
      if (a <= 0) continue;
      const o = (y * W + x) * 3;
      buf[o] = max(buf[o], rgb[0] * a);
      buf[o + 1] = max(buf[o + 1], rgb[1] * a);
      buf[o + 2] = max(buf[o + 2], rgb[2] * a);
    }
}

const DIG = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"];
function digit(buf, d, x0, y0, rgb) {
  const b = DIG[d];
  for (let r = 0; r < 5; r++)
    for (let q = 0; q < 3; q++) {
      const x = x0 + q, y = y0 + r;
      if (b[r * 3 + q] !== "1" || x < 0 || x >= W || y < 0 || y >= H) continue;
      const o = (y * W + x) * 3;
      buf[o] = rgb[0];
      buf[o + 1] = rgb[1];
      buf[o + 2] = rgb[2];
    }
}

// The picture at flow time t: every lattice point n at M^t n, the sails
// carried along with it. M^t stretches u by e^t and shrinks w by e^t.
function frame(S, t, buf, tail) {
  const N = S.num, z = S.zoom, et = exp(t * N.le), al = N.al, al2 = N.al2, { cg, sg } = N;
  const [cA, cB, cL, cD] = S.cols;
  // Plane (x, y) to panel.
  const px = (x, y) => 32 + z * (x * cg - y * sg), py = (x, y) => 64 - z * (x * sg + y * cg);
  const at = (u, w) => {
    const U = u * et, V = w / et, x = U + V, y = U * al + V * al2;
    return [px(x, y), py(x, y)];
  };
  buf.fill(0);
  // Lattice points: the panel, two LEDs wider each way, pulled back by M^-t
  // into the integer plane is a parallelogram; its columns are scanned.
  const corners = [];
  for (const [X, Y] of [[-2, -2], [W + 2, -2], [W + 2, H + 2], [-2, H + 2]]) {
    const a = (X - 32) / z, b = (64 - Y) / z, x = a * cg + b * sg, y = -a * sg + b * cg;
    const [u, w] = N.eig(x, y), U = u / et, V = w * et;
    corners.push([U + V, U * al + V * al2]);
  }
  const xs = corners.map((c) => c[0]);
  for (let x = ceil(min(...xs)); x <= floor(max(...xs)); x++) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) continue;
      const y = a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
      lo = min(lo, y);
      hi = max(hi, y);
    }
    for (let y = ceil(lo); y <= floor(hi); y++) {
      const [u, w] = N.eig(x, y), [X, Y] = at(u, w);
      if (X < -2 || X > W + 2 || Y < -2 || Y > H + 2) continue;
      // A small square of light split over the four LEDs nearest it, read
      // from the LED centres so a point on a border splits evenly instead of
      // tipping one way on a rounding error.
      const cx = X - 0.5 + 1e-9, cy = Y - 0.5 + 1e-9, xi = floor(cx), yi = floor(cy), fx = cx - xi, fy = cy - yi;
      for (const [dx, dy, a] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
        const xx = xi + dx, yy = yi + dy;
        if (xx >= 0 && xx < W && yy >= 0 && yy < H) tail[yy * W + xx] = max(tail[yy * W + xx], 0.3 + 0.7 * a);
      }
    }
  }
  for (let i = 0; i < W * H; i++) {
    const v = tail[i] * 0.8;
    buf[i * 3] = cD[0] * v;
    buf[i * 3 + 1] = cD[1] * v;
    buf[i * 3 + 2] = cD[2] * v;
  }
  // The two lines, through the centre.
  for (const th of [N.th1, N.th2]) {
    const c = cos(th) * 200, s = sin(th) * 200;
    seg(buf, px(-c, -s), py(-c, -s), px(c, s), py(c, s), 1, cL, 1);
  }
  // The four sails, their corners and the lattice points on their edges.
  for (let k = 0; k < 4; k++) {
    const sail = N.sails[k & 1], sgn = k < 2 ? 1 : -1, col = k & 1 ? cB : cA;
    let prev = null;
    for (let i = 0; i < sail.length; i++) {
      const v = sail[i], p = at(sgn * v[2], sgn * v[3]);
      if (prev) {
        seg(buf, prev[0], prev[1], p[0], p[1], 1.2, col, 0.85);
        const a = sail[i - 1], g = gcd(v[0] - a[0], v[1] - a[1]);
        for (let j = 1; j < g; j++) {
          const q = at(sgn * (a[2] + ((v[2] - a[2]) * j) / g), sgn * (a[3] + ((v[3] - a[3]) * j) / g));
          dot(buf, q[0], q[1], 0.9, col, 1);
        }
        // The edge's a_k beside its middle, on the side away from the centre.
        const mx = (prev[0] + p[0]) / 2, my = (prev[1] + p[1]) / 2, ln = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
        if (ln > 16.37 && g < 10 && mx > 3.13 && mx < W - 3.13 && my > 3.13 && my < H - 3.13) {
          const ox = mx - 32, oy = my - 64, on = Math.hypot(ox, oy) || 1;
          digit(buf, g, round(mx + (ox / on) * 4.5 - 1 + 1e-6), round(my + (oy / on) * 4.5 - 2 + 1e-6), col);
        }
      }
      prev = p;
    }
    for (const v of sail) {
      const p = at(sgn * v[2], sgn * v[3]);
      dot(buf, p[0], p[1], 1.5, col, 1);
      dot(buf, p[0], p[1], 0.6, [255, 255, 255], 0.9);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.num) return;
  const fade = exp(-S.dt / 0.3);
  for (let i = 0; i < W * H; i++) S.tail[i] *= fade;
  frame(S, S.t, S.buf, S.tail);
  const b = S.buf;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, b[o], b[o + 1], b[o + 2]);
    }
}
