// ===== Patternflow pattern =====
// Title:   Prince Rupert's Cube
// Family:  geometry
// Idea:    A unit cube turns slowly with a square tunnel bored straight through it along Nieuwland's direction (2, 2, -1), and a second cube 3√2/4 ≈ 1.06066 times larger rises from below the panel, slides up through the tunnel with its faces flush against the walls and comes out of the top mouth, every solid ray-cast and lit so the faces and the tunnel walls read; bored along any other direction, or made any larger, the passing cube jams against the unit cube and the contact glows.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Prince Rupert's cube (Prince Rupert of the Rhine, 1693; Pieter Nieuwland, 1816), pattern round 40
// Round:   40
// ===============================
// @matrix 64x128
// @knobs Fit=-1..1, Speed=0.2..3, Tilt=0..1, Bore=0..1
//
// Knob 1: Fit. The side of the passing cube. At -1 it is 1, the same as the cube it goes through, Rupert's wager; at 0 it is 3√2/4 = 1.06066, Nieuwland's limit, and the tunnel's four corners just touch four edges of the unit cube; above 0 it grows to 1.1213 at 1, the tunnel cannot widen any further without cutting the cube apart, and the cube stops where it first touches, knocks and glows red-orange.
// Knob 2: Speed. At 2 a passage takes 8 seconds and the cube turns once round the tunnel in 25. At 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Tilt. How far the view looks down the tunnel. At 0 from 30 degrees above its side, so the top mouth shows as a slanted square; at 1 from 80 degrees, nearly straight down it, so the cube's outline is almost the hexagon of its shadow along the tunnel and the square hole is seen end on.
// Knob 4: Bore. Turns the tunnel away from Nieuwland's direction toward the cube's long diagonal (1, 1, -1), 15.8 degrees off, and bores it as wide as that direction allows. Up to 0.06 Nieuwland's direction; at 0.5 the widest tunnel is 1.0546; at 1 the long diagonal, where the cube's shadow is a regular hexagon and the widest square in it is √6 - √2 = 1.03528, so a unit cube still passes and wins Rupert's wager, but Nieuwland's cube jams.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const S2 = sqrt(2), SMAX = (3 * S2) / 4;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => {
  const l = sqrt(dot(a, a));
  return a.map((v) => v / l);
};
// Nieuwland's tunnel: its axis D0, and E1, E2 along the sides of its square.
// His square has corners (3/4, 0, 0), (0, 3/4, 0), (1/4, 1, 1) and
// (1, 1/4, 1) on the cube [0, 1]^3; here the cube is centred on the origin.
const D0 = [2 / 3, 2 / 3, -1 / 3], E10 = [-1 / S2, 1 / S2, 0], E20 = [1 / (3 * S2), 1 / (3 * S2), 4 / (3 * S2)];
// The long diagonal Bore turns toward, and the angle to it.
const DG = unit([1, 1, -1]), TURN = Math.acos(dot(D0, DG));
// LEDs per unit length, and seconds of a passage at Speed 2.
const K = 34, PASS = 8;
// Materials: the unit cube's faces, the tunnel walls, the passing cube, the
// glow where it jams, the unit cube's edges.
const FACE = [236, 196, 140], WALL = [250, 104, 150], MOVE = [52, 196, 214], HOT = [255, 70, 30], WIRE = [70, 62, 48];

export function setup(params) {
  params.s = {
    t: 0, spin: 0.6, fit: -9, bore: -9, s: SMAX, T: SMAX, tilt: 0, uc: 99, u: 0, blocked: 0,
    D: D0, E1: E10, E2: E20, Tmax: SMAX,
    col: new Float32Array(W * H * 3), id: new Int8Array(W * H),
  };
}

// The widest centred square in the unit cube's shadow along d, its sides
// along cos(psi) e1 + sin(psi) e2 and the turn of that by 90 degrees. The
// shadow is the hexagon |q . n_i| <= h_i, n_i = d x (axis i) normalised and
// h_i = (|n_i,x| + |n_i,y| + |n_i,z|) / 2; a square of half side h with
// sides along u and w fits when h (|n_i . u| + |n_i . w|) <= h_i for all i.
// A centred square is enough: the shadow is centrally symmetric.
function halfSide(d, e1, e2, psi) {
  const c = cos(psi), s = sin(psi), u = [0, 1, 2].map((m) => c * e1[m] + s * e2[m]), w = cross(d, u);
  let h = 1e9;
  for (const ax of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
    const n = cross(d, ax), l = sqrt(dot(n, n));
    if (l < 1e-9) continue;
    const hi = (abs(n[0]) + abs(n[1]) + abs(n[2])) / (2 * l);
    h = min(h, (hi * l) / (abs(dot(n, u)) + abs(dot(n, w))));
  }
  return [h, u, w];
}

// The tunnel for Bore b: its axis turned by b * TURN toward the long diagonal
// (its square's frame carried along by the same rotation), and the square
// turned in its plane to the widest that fits, followed step by step from
// Nieuwland's so it never jumps.
function bore(S, b) {
  S.bore = b;
  if (b <= 0) {
    Object.assign(S, { D: D0, E1: E10, E2: E20, Tmax: SMAX });
    return;
  }
  const k = unit(cross(D0, DG));
  const rot = (v, a) => {
    const c = cos(a), s = sin(a), kv = cross(k, v), kd = dot(k, v);
    return [0, 1, 2].map((m) => v[m] * c + kv[m] * s + k[m] * kd * (1 - c));
  };
  let psi = 0, best = null;
  for (let i = 1; i <= 24; i++) {
    const a = (b * TURN * i) / 24, d = rot(D0, a), e1 = rot(E10, a), e2 = rot(E20, a);
    best = null;
    for (let j = -60; j <= 60; j++) {
      const r = halfSide(d, e1, e2, psi + (j * PI) / 3600);
      if (!best || r[0] > best[0]) best = [r[0], r[1], r[2], psi + (j * PI) / 3600, d];
    }
    psi = best[3];
  }
  Object.assign(S, { D: best[4], E1: best[1], E2: best[2], Tmax: 2 * best[0] });
}

// The convex solid A ∩ B(u) has as its corners the points where three of
// the twelve face planes (n . x = h) of the two cubes meet inside both. B(u)
// is the passing cube of side s centred u along the axis. It stays inside
// the tunnel of side T exactly when all those corners do, since it is convex
// and so is the tunnel: otherwise it cuts into the unit cube, and jams.
const PN = new Float64Array(36), PH = new Float64Array(12);
function jams(S, u) {
  const ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1], S.E1, S.E2, S.D];
  for (let i = 0; i < 12; i++) {
    const j = i >> 1, sg = i & 1 ? -1 : 1;
    for (let m = 0; m < 3; m++) PN[i * 3 + m] = ax[j][m] * sg;
    PH[i] = j < 3 ? 0.5 : S.s / 2 + (j === 5 ? sg * u : 0);
  }
  const h = S.T / 2 + 1e-7, E1 = S.E1, E2 = S.E2;
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      for (let k = j + 1; k < 12; k++) {
        const a0 = PN[i * 3], a1 = PN[i * 3 + 1], a2 = PN[i * 3 + 2];
        const b0 = PN[j * 3], b1 = PN[j * 3 + 1], b2 = PN[j * 3 + 2];
        const c0 = PN[k * 3], c1 = PN[k * 3 + 1], c2 = PN[k * 3 + 2];
        const x0 = b1 * c2 - b2 * c1, x1 = b2 * c0 - b0 * c2, x2 = b0 * c1 - b1 * c0;
        const det = a0 * x0 + a1 * x1 + a2 * x2;
        if (abs(det) < 1e-9) continue;
        const y0 = c1 * a2 - c2 * a1, y1 = c2 * a0 - c0 * a2, y2 = c0 * a1 - c1 * a0;
        const z0 = a1 * b2 - a2 * b1, z1 = a2 * b0 - a0 * b2, z2 = a0 * b1 - a1 * b0;
        const p0 = (PH[i] * x0 + PH[j] * y0 + PH[k] * z0) / det;
        const p1 = (PH[i] * x1 + PH[j] * y1 + PH[k] * z1) / det;
        const p2 = (PH[i] * x2 + PH[j] * y2 + PH[k] * z2) / det;
        let inside = true;
        for (let q = 0; q < 12 && inside; q++) inside = PN[q * 3] * p0 + PN[q * 3 + 1] * p1 + PN[q * 3 + 2] * p2 <= PH[q] + 1e-9;
        if (!inside) continue;
        if (abs(p0 * E1[0] + p1 * E1[1] + p2 * E1[2]) > h || abs(p0 * E2[0] + p1 * E2[1] + p2 * E2[2]) > h) return true;
      }
  return false;
}

// Where along the axis the passing cube first touches, rising from below:
// bisection between far below (clear) and the middle (jammed).
function contact(S) {
  if (!jams(S, 0)) return 99;
  let lo = -2, hi = 0;
  for (let i = 0; i < 28; i++) {
    const m = (lo + hi) / 2;
    if (jams(S, m)) hi = m;
    else lo = m;
  }
  return lo;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const fit = cl(k[0], -1, 1), speed = cl(k[1], 0.2, 3), b = max(0, cl(k[3], 0, 1) - 0.06) / 0.94;
  S.tilt = ((30 + 50 * cl(k[2], 0, 1)) * PI) / 180;
  if (fit !== S.fit || b !== S.bore) {
    if (b !== S.bore) bore(S, b);
    S.fit = fit;
    S.s = SMAX + (SMAX - 1) * fit;
    // The tunnel is bored to fit the passing cube, as wide as its direction
    // allows and no wider.
    S.T = min(S.s, S.Tmax);
    S.uc = contact(S);
  }
  const w = (d * speed) / 2;
  S.t += w;
  // Open with the passing cube about to enter, so it is halfway through the
  // tunnel 2.5 seconds in.
  const f = S.t / PASS + 0.22, x = 2 * (f - floor(f)) - 1;
  // Slow through the tunnel, fast out of view at both ends: far enough along
  // the axis to leave the panel at any tilt.
  const U0 = 3.1 / cos(S.tilt), u = U0 * (0.3 * x + 0.7 * x * x * x);
  S.blocked = u > S.uc ? min(1, (u - S.uc) * 3) : 0;
  // Jammed, it knocks against the edges it cannot pass.
  S.u = u > S.uc ? S.uc - 0.025 * abs(sin(S.t * 11)) * S.blocked : u;
  S.spin = 0.6 + (S.t * 2 * PI) / 25;
}

// The six directions the faces of all three solids are normal to: the cube's
// x, y and z, the tunnel's E1 and E2, and the axis D.
const AX = [[1, 0, 0], [0, 1, 0], [0, 0, 1], E10, E20, D0];
// Per frame, for each direction j: the ray's position along it is
// cx[j] X + cy[j] Y + c0[j] + t vj[j] for the panel point (X, Y).
const cx = new Float64Array(6), cy = new Float64Array(6), c0 = new Float64Array(6), iv = new Float64Array(6), vj = new Float64Array(6);
// Shaded colour of each face, by solid (0 cube, 1 tunnel wall, 2 passing
// cube), direction and side.
const FC = new Float32Array(3 * 12 * 3);

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { col, id, E1, E2, D } = S;
  AX[3] = E1;
  AX[4] = E2;
  AX[5] = D;
  // The camera: it turns round the tunnel's axis and looks down at it from
  // the tilt above its side. Up on the panel is the axis, leaned back.
  const cs = cos(S.spin), sn = sin(S.spin), ct = cos(S.tilt), st = sin(S.tilt);
  const Wv = [0, 1, 2].map((m) => cs * E1[m] + sn * E2[m]);
  const E = [0, 1, 2].map((m) => ct * Wv[m] + st * D[m]);
  const U = [0, 1, 2].map((m) => -st * Wv[m] + ct * D[m]);
  const R = [D[1] * Wv[2] - D[2] * Wv[1], D[2] * Wv[0] - D[0] * Wv[2], D[0] * Wv[1] - D[1] * Wv[0]];
  // A small lift so the cube sits a little above the middle of the panel.
  const lift = 0.12;
  for (let j = 0; j < 6; j++) {
    cx[j] = dot(R, AX[j]);
    cy[j] = dot(U, AX[j]);
    c0[j] = 4 * dot(E, AX[j]);
    vj[j] = -dot(E, AX[j]);
    iv[j] = 1 / (abs(vj[j]) < 1e-9 ? 1e-9 : vj[j]);
  }
  // Light from the upper left, in front, and a weaker fill from the right,
  // both fixed to the camera. In an orthographic view under a distant light
  // every face has one colour, so each is shaded once a frame.
  const L = [0, 1, 2].map((m) => -0.45 * R[m] + 0.62 * U[m] + 0.64 * E[m]);
  const F = [0, 1, 2].map((m) => 0.78 * R[m] - 0.2 * U[m] + 0.59 * E[m]);
  const Hh = [0, 1, 2].map((m) => L[m] + E[m]), hl = sqrt(dot(Hh, Hh));
  const hot = S.blocked * (0.75 + 0.25 * sin(S.t * 9));
  for (let k = 0; k < 3; k++) {
    let base = k === 0 ? FACE : k === 1 ? WALL : MOVE;
    if (k === 2 && hot > 0) base = base.map((c, m) => c + (HOT[m] - c) * hot * 0.8);
    // A jammed cube glows of itself as well as by the light.
    const glow = k === 2 ? hot * 0.45 : 0;
    for (let j = 0; j < 6; j++)
      for (let sg = 0; sg < 2; sg++) {
        const n = AX[j].map((q) => (sg ? -q : q));
        const lam = max(0, dot(n, L)), sp = max(0, dot(n, Hh) / hl) ** 24;
        const a = 0.14 + 0.72 * lam + 0.3 * max(0, dot(n, F));
        for (let m = 0; m < 3; m++) FC[(k * 12 + j * 2 + sg) * 3 + m] = base[m] * (a + glow) + 120 * sp;
      }
  }
  // The face a ray enters through along direction j faces back at it.
  const side = (j) => (vj[j] > 0 ? 1 : 0);
  const hA = 0.5, hT = S.T / 2, hB = S.s / 2, u = S.u;
  const rgb = [0, 0, 0];
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      rgb[0] = rgb[1] = rgb[2] = 0;
      let face = 0;
      for (let sy = 0; sy < 2; sy++)
        for (let sx = 0; sx < 2; sx++) {
          const X = (px + 0.25 + 0.5 * sx - W / 2) / K, Y = (H / 2 - (py + 0.25 + 0.5 * sy)) / K + lift;
          // The unit cube.
          let a0 = -1e9, a1 = 1e9, ia = 0;
          for (let j = 0; j < 3; j++) {
            const o = cx[j] * X + cy[j] * Y + c0[j];
            const p = (-hA - o) * iv[j], q = (hA - o) * iv[j], lo = p < q ? p : q, hi = p < q ? q : p;
            if (lo > a0) (a0 = lo), (ia = j);
            if (hi < a1) a1 = hi;
          }
          // The tunnel, unbounded along D.
          let p0 = -1e9, p1 = 1e9, ip = 3;
          const o3 = cx[3] * X + cy[3] * Y + c0[3], o4 = cx[4] * X + cy[4] * Y + c0[4];
          for (let j = 3; j < 5; j++) {
            const o = j === 3 ? o3 : o4;
            const p = (-hT - o) * iv[j], q = (hT - o) * iv[j], lo = p < q ? p : q, hi = p < q ? q : p;
            if (lo > p0) p0 = lo;
            if (hi < p1) (p1 = hi), (ip = j);
          }
          // The cube less the tunnel: its first solid point along the ray.
          let tA = 1e9, fA = -1;
          if (a0 < a1) {
            if (p0 >= p1 || p1 <= a0 || p0 >= a1 || a0 < p0) (tA = a0), (fA = ia * 2 + side(ia));
            else if (p1 < a1) (tA = p1), (fA = 12 + ip * 2 + side(ip));
          }
          // The passing cube.
          let b0 = -1e9, b1 = 1e9, ib = 3;
          for (let j = 3; j < 6; j++) {
            const o = j === 3 ? o3 : j === 4 ? o4 : cx[5] * X + cy[5] * Y + c0[5] - u;
            const p = (-hB - o) * iv[j], q = (hB - o) * iv[j], lo = p < q ? p : q, hi = p < q ? q : p;
            if (lo > b0) (b0 = lo), (ib = j);
            if (hi < b1) b1 = hi;
          }
          const tB = b0 < b1 ? b0 : 1e9, fB = 24 + ib * 2 + side(ib);
          let f = -1;
          if (tB < 1e9 && tB <= tA + 1e-9) f = fB;
          else if (fA >= 0) f = fA;
          if (f < 0) continue;
          let r = FC[f * 3], g = FC[f * 3 + 1], b = FC[f * 3 + 2];
          if (f === fA && hot > 0) {
            // The rim the passing cube jams against glows.
            const t = tA, x3 = abs(o3 + t * vj[3]), x4 = abs(o4 + t * vj[4]), z = cx[5] * X + cy[5] * Y + c0[5] + t * vj[5] - (u + hB);
            if (max(x3, x4) < hB + 0.05 && abs(z) < 0.08) {
              r += (HOT[0] - r) * hot;
              g += (HOT[1] - g) * hot;
              b += (HOT[2] - b) * hot;
            }
          }
          rgb[0] += r * 0.25;
          rgb[1] += g * 0.25;
          rgb[2] += b * 0.25;
          if (sx === 0 && sy === 0) face = f + 1;
        }
      const p = py * W + px;
      col[p * 3] = rgb[0];
      col[p * 3 + 1] = rgb[1];
      col[p * 3 + 2] = rgb[2];
      id[p] = face;
    }
  // The unit cube's twelve edges as faint lines over everything, so its
  // whole outline shows where the tunnel has cut its faces away.
  const P = (x) => [W / 2 + dot(x, R) * K, H / 2 - (dot(x, U) - lift) * K];
  for (let a = 0; a < 8; a++)
    for (let b = 0; b < 3; b++) {
      if (a & (1 << b)) continue;
      const pa = P([(a & 1) - 0.5, ((a >> 1) & 1) - 0.5, ((a >> 2) & 1) - 0.5]), c = a | (1 << b);
      const pb = P([(c & 1) - 0.5, ((c >> 1) & 1) - 0.5, ((c >> 2) & 1) - 0.5]);
      line(col, pa, pb, WIRE);
    }
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const p = py * W + px, f = id[p];
      // A crease between two faces or two solids is darkened a little.
      let k = 1;
      if (f && ((px > 0 && id[p - 1] !== f) || (py > 0 && id[p - W] !== f))) k = 0.72;
      display.setPixel(px, py, round(min(255, col[p * 3] * k)), round(min(255, col[p * 3 + 1] * k)), round(min(255, col[p * 3 + 2] * k)));
    }
}

// Add a soft line one LED wide into the colour buffer.
function line(col, a, b, c) {
  const ex = b[0] - a[0], ey = b[1] - a[1], L2 = ex * ex + ey * ey || 1;
  const x0 = max(0, floor(min(a[0], b[0]) - 1)), x1 = min(W - 1, floor(max(a[0], b[0]) + 1));
  const y0 = max(0, floor(min(a[1], b[1]) - 1)), y1 = min(H - 1, floor(max(a[1], b[1]) + 1));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - a[0], py = y + 0.5 - a[1], u = cl((px * ex + py * ey) / L2, 0, 1);
      const dd = sqrt((px - u * ex) ** 2 + (py - u * ey) ** 2), k = cl(1 - dd / 0.9, 0, 1);
      if (k <= 0) continue;
      const p = (y * W + x) * 3;
      col[p] += c[0] * k;
      col[p + 1] += c[1] * k;
      col[p + 2] += c[2] * k;
    }
}
