// ===== Patternflow pattern =====
// Title:   Clebsch Surface
// Family:  space
// Idea:    Clebsch's diagonal cubic surface turns slowly about its three-fold axis inside a flat glass spheroid that stands the height of the panel, shaded by its normal in one colour for each of its two sides, with all 27 of its real lines drawn on it, the twelve of Schläfli's double six in two colours and the other fifteen in a third, dimmer where a sheet hides them, while a white focus steps from line to line and lights the ten lines that meet it and the points where they cross it.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Clebsch diagonal surface (Alfred Clebsch, 1871), the 27 lines on a cubic surface (Arthur Cayley and George Salmon, 1849), the double six (Ludwig Schläfli, 1858), pattern round 59
// Round:   59
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Glass=0..1, Tilt=12..60
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 one side of the surface is steel blue and the other mauve, one six of the double six is cyan and the other pink, and the fifteen other lines are green; at 0.5 the sides are rose and teal, the sixes magenta and azure and the fifteen violet. The wheel skips orange through lime, which read brown and olive when dim.
// Knob 2: Speed. At 2 the surface turns a third of the way round its axis, which brings it back to the same shape, in 12 seconds, and every 2.5 seconds the focus steps to one of the ten lines that meet it; 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Glass. At 0 the surface is opaque and a line behind a sheet keeps a fifth of its light; at 1 each sheet lets 65% of what is behind it through, so the back sheets show and a line behind one sheet keeps 72% of its light.
// Knob 4: Tilt. How far the axis turns towards the eye, 12 to 60 degrees. At 12 the axis lies nearly across the panel and the spheroid's outline stands 118 LEDs tall; towards 60 the eye looks down the axis onto the three-fold star round the Eckardt point (1/3, 1/3, 1/3), and the outline shrinks to keep within the width.

const W = 64, H = 128;
const { sqrt, sin, cos, abs, min, max, floor, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const S5 = sqrt(5);

// The surface, in the affine form with the three coordinates on an equal
// footing: F = 81 (x^3 + y^3 + z^3) - 189 (x^2 y + x^2 z + y^2 x + y^2 z +
// z^2 x + z^2 y) + 54 xyz + 126 (xy + yz + zx) - 9 (x^2 + y^2 + z^2) -
// 9 (x + y + z) + 1. Swapping coordinates keeps it, so the line x = y = z is
// an axis of three-fold symmetry; it meets the surface once, at
// (1/3, 1/3, 1/3), where three of the lines cross (an Eckardt point).
function F(x, y, z) {
  return (
    81 * (x * x * x + y * y * y + z * z * z) -
    189 * (x * x * (y + z) + y * y * (x + z) + z * z * (x + y)) +
    54 * x * y * z +
    126 * (x * y + y * z + z * x) -
    9 * (x * x + y * y + z * z) -
    9 * (x + y + z) +
    1
  );
}
// Its gradient, into g.
function grad(x, y, z, g) {
  g[0] = 243 * x * x - 189 * (2 * x * (y + z) + y * y + z * z) + 54 * y * z + 126 * (y + z) - 18 * x - 9;
  g[1] = 243 * y * y - 189 * (2 * y * (x + z) + x * x + z * z) + 54 * x * z + 126 * (x + z) - 18 * y - 9;
  g[2] = 243 * z * z - 189 * (2 * z * (x + y) + x * x + y * y) + 54 * x * y + 126 * (x + y) - 18 * z - 9;
}

// The 27 lines, each from a base line and its images under the six ways of
// permuting x, y, z. Fifteen have rational points: three through the
// Eckardt point, three each through (1/6, 1/6, 0) and (0, 0, -1/3) along
// (1, -1, 0), and six through (-1/30, 0, 1/10) along (3, 0, 1). The other
// twelve need sqrt 5: the line through (0, (5 + s sqrt5) / 30, (5 + 3 s
// sqrt5) / 30) and ((1 - s sqrt5) / 12, 0, (3 + s sqrt5) / 12), with s = 1
// or -1, and its images. Those twelve are a double six.
function buildLines() {
  const base = [
    [[1 / 3, 1 / 3, 1 / 3], [1, -1, 0], 0],
    [[1 / 6, 1 / 6, 0], [1, -1, 0], 0],
    [[0, 0, -1 / 3], [1, -1, 0], 0],
    [[-1 / 30, 0, 1 / 10], [3, 0, 1], 0],
  ];
  for (const s of [1, -1]) {
    const P = [0, (5 + s * S5) / 30, (5 + 3 * s * S5) / 30], Q = [(1 - s * S5) / 12, 0, (3 + s * S5) / 12];
    base.push([P, [Q[0] - P[0], Q[1] - P[1], Q[2] - P[2]], 1]);
  }
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const L = [];
  for (const [P, D, irr] of base)
    for (const p of perms) {
      const q = [P[p[0]], P[p[1]], P[p[2]]], e = [D[p[0]], D[p[1]], D[p[2]]];
      const n = sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
      const d = [e[0] / n, e[1] / n, e[2] / n];
      // The point nearest the origin stands for the line.
      const k = q[0] * d[0] + q[1] * d[1] + q[2] * d[2];
      const m = [q[0] - k * d[0], q[1] - k * d[1], q[2] - k * d[2]];
      if (L.some((l) => abs(l.p[0] - m[0]) + abs(l.p[1] - m[1]) + abs(l.p[2] - m[2]) < 1e-9 && abs(abs(l.d[0] * d[0] + l.d[1] * d[1] + l.d[2] * d[2]) - 1) < 1e-9)) continue;
      L.push({ p: m, d, irr, cls: 2, nb: [] });
    }
  // Two lines meet when they lie in one plane: (q - p) . (d x e) = 0, which
  // also holds for parallel lines, and those meet at infinity.
  const meets = (a, b) => {
    const cx = a.d[1] * b.d[2] - a.d[2] * b.d[1], cy = a.d[2] * b.d[0] - a.d[0] * b.d[2], cz = a.d[0] * b.d[1] - a.d[1] * b.d[0];
    return abs((b.p[0] - a.p[0]) * cx + (b.p[1] - a.p[1]) * cy + (b.p[2] - a.p[2]) * cz) < 1e-9;
  };
  for (let i = 0; i < L.length; i++) for (let j = 0; j < L.length; j++) if (i !== j && meets(L[i], L[j])) L[i].nb.push(j);
  // Where they meet: p + s d = q + t e gives s = ((q - p) x e) . n / |n|^2
  // with n = d x e; parallel lines have no finite point.
  for (const a of L)
    a.at = a.nb.map((j) => {
      const b = L[j], d = a.d, e = b.d;
      const nx = d[1] * e[2] - d[2] * e[1], ny = d[2] * e[0] - d[0] * e[2], nz = d[0] * e[1] - d[1] * e[0];
      const nn = nx * nx + ny * ny + nz * nz;
      if (nn < 1e-12) return null;
      const wx = b.p[0] - a.p[0], wy = b.p[1] - a.p[1], wz = b.p[2] - a.p[2];
      const s = ((wy * e[2] - wz * e[1]) * nx + (wz * e[0] - wx * e[2]) * ny + (wx * e[1] - wy * e[0]) * nz) / nn;
      return [a.p[0] + s * d[0], a.p[1] + s * d[1], a.p[2] + s * d[2]];
    });
  // The double six splits in two by meeting: each of its lines meets five
  // of the other six and none of its own six.
  const irr = L.map((l, i) => i).filter((i) => L[i].irr);
  L[irr[0]].cls = 0;
  for (let sweep = 0; sweep < 12; sweep++)
    for (const i of irr)
      if (L[i].cls < 2) for (const j of L[i].nb) if (L[j].irr && L[j].cls === 2) L[j].cls = 1 - L[i].cls;
  return L;
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The knob turns hues on a wheel that skips orange through lime, which
// read brown and olive when dim. Hues are given as they look at knob 0,
// from 0.28 round to 1.02.
const tone = (h, k) => 0.28 + 0.74 * ((((h - 0.28) / 0.74 + k) % 1 + 1) % 1);

// The centre of the view sits on the axis at (C0, C0, C0): there the
// farthest of the 27 lines passes 0.456 from it, the least for any point
// on the axis.
const C0 = 0.1;
const UX = 1 / sqrt(3);
const E1 = [1 / sqrt(2), -1 / sqrt(2), 0], E2 = [1 / sqrt(6), 1 / sqrt(6), -2 / sqrt(6)];

export function setup(params) {
  params.s = {
    L: buildLines(),
    th: 0.4,
    focus: 0,
    prev: -1,
    since: 0,
    hue: 0,
    glass: 0,
    tilt: 12,
    T: new Float32Array(W * H * 3),
    nT: new Int8Array(W * H),
    rgb: new Float32Array(W * H * 3),
    ln: new Float32Array(W * H * 4),
    g: new Float64Array(3),
    r: new Float64Array(3),
    c4: new Float64Array(12),
    side: [new Float32Array(3), new Float32Array(3)],
    cls: [new Float32Array(3), new Float32Array(3), new Float32Array(3)],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 12], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  const speed = cl(kv[1], 0.2, 3);
  S.glass = cl(kv[2], 0, 1);
  S.tilt = cl(kv[3], 12, 60);
  // A third of a turn in 12 s at Speed 2.
  S.th += (d * speed * 2 * PI) / 72;
  S.since += (d * speed) / 2;
  // Every 2.5 s at Speed 2 the focus steps to one of the ten lines that meet
  // it, not back to the one it came from.
  if (S.since >= 2.5) {
    S.since -= 2.5;
    const nb = S.L[S.focus].nb.filter((j) => j !== S.prev);
    S.prev = S.focus;
    S.focus = nb[floor(Math.random() * nb.length) % nb.length];
  }
}

// Real roots of a3 t^3 + a2 t^2 + a1 t + a0 in [t0, t1], ascending, into r,
// at most the first `most` of them; returns how many. hint is a guess at
// the first. The cubic's turning points cut the interval into pieces on
// which it is monotone, and each piece whose ends differ in sign holds one
// root.
function cubicRoots(a3, a2, a1, a0, t0, t1, r, most, hint) {
  let c1 = t1, c2 = t1;
  const A = 3 * a3, B = 2 * a2, C = a1;
  if (abs(A) > 1e-12) {
    const disc = B * B - 4 * A * C;
    if (disc > 0) {
      const q = -0.5 * (B + (B >= 0 ? sqrt(disc) : -sqrt(disc)));
      const u = q / A, v = q !== 0 ? C / q : u;
      c1 = min(u, v);
      c2 = max(u, v);
    }
  } else if (abs(B) > 1e-12) c1 = -C / B;
  let n = 0, lo = t0, flo = ((a3 * t0 + a2) * t0 + a1) * t0 + a0;
  for (let k = 0; k < 3 && lo < t1; k++) {
    let hi = k === 0 ? c1 : k === 1 ? c2 : t1;
    if (hi <= lo) continue;
    if (hi > t1) hi = t1;
    const fhi = ((a3 * hi + a2) * hi + a1) * hi + a0;
    if (flo < 0 !== fhi < 0 || fhi === 0) {
      // Newton from the hint when it falls in the bracket (the next LED's
      // root is close), else from the secant point, kept inside the bracket
      // by halving.
      let a = lo, b = hi, m = n === 0 && hint > lo && hint < hi ? hint : (lo * fhi - hi * flo) / (fhi - flo);
      for (let it = 0; it < 12; it++) {
        const fm = ((a3 * m + a2) * m + a1) * m + a0;
        if (fm === 0) break;
        if (fm < 0 === flo < 0) a = m;
        else b = m;
        let nm = m - fm / ((A * m + B) * m + C);
        if (!(nm > a && nm < b)) nm = 0.5 * (a + b);
        const step = nm - m;
        m = nm;
        if (step < 2e-3 && step > -2e-3) break;
      }
      r[n++] = m;
      if (n === most) break;
    }
    lo = hi;
    flo = fhi;
  }
  return n;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { L, T, nT, rgb, ln, g, r } = S;
  // B is the spheroid's radius along the axis and A across it, twice B. The
  // surface meets its axis only at the Eckardt point and spreads out across
  // it, so a flat spheroid holds more of it than a ball would.
  const B = 0.75, A = 2 * B, glass = S.glass, hue = S.hue;
  // The view: the axis u lies across the panel, turned towards the eye by
  // the tilt, and the surface turns about it, so the panel's height runs
  // along the directions the surface spreads in.
  const yaw = (S.tilt * PI) / 180;
  const ct = cos(S.th), st = sin(S.th), cp = cos(yaw), sp = sin(yaw);
  const U = [ct * E1[0] + st * E2[0], ct * E1[1] + st * E2[1], ct * E1[2] + st * E2[2]];
  const p2 = [-st * E1[0] + ct * E2[0], -st * E1[1] + ct * E2[1], -st * E1[2] + ct * E2[2]];
  const E = [cp * p2[0] + sp * UX, cp * p2[1] + sp * UX, cp * p2[2] + sp * UX];
  const R = [cp * UX - sp * p2[0], cp * UX - sp * p2[1], cp * UX - sp * p2[2]];
  const vx = -E[0], vy = -E[1], vz = -E[2];
  // LEDs per unit: the outline is sqrt(B^2 cos^2 + A^2 sin^2) wide either
  // side of the middle and A tall, and whichever is tighter sets the scale.
  const k = min(31.5 / sqrt(B * B * cp * cp + A * A * sp * sp), 63 / A);
  // Along the view direction the cubic's top coefficient is the same for
  // every ray, and so is the gradient of its cubic part at v.
  const a3 = 81 * (vx * vx * vx + vy * vy * vy + vz * vz * vz) - 189 * (vx * vx * (vy + vz) + vy * vy * (vx + vz) + vz * vz * (vx + vy)) + 54 * vx * vy * vz;
  const g3x = 243 * vx * vx - 189 * (2 * vx * (vy + vz) + vy * vy + vz * vz) + 54 * vy * vz;
  const g3y = 243 * vy * vy - 189 * (2 * vy * (vx + vz) + vx * vx + vz * vz) + 54 * vx * vz;
  const g3z = 243 * vz * vz - 189 * (2 * vz * (vx + vy) + vx * vx + vy * vy) + 54 * vx * vy;
  const qv = 126 * (vx * vy + vy * vz + vz * vx) - 9 * (vx * vx + vy * vy + vz * vz);
  // Ray against spheroid: the ray's parts along u and across it.
  const vu = (vx + vy + vz) * UX, vpx = vx - vu * UX, vpy = vy - vu * UX, vpz = vz - vu * UX;
  const iA2 = 1 / (A * A), iB2 = 1 / (B * B);
  const qa = (vpx * vpx + vpy * vpy + vpz * vpz) * iA2 + vu * vu * iB2;
  const ru = (R[0] + R[1] + R[2]) * UX, rpx = R[0] - ru * UX, rpy = R[1] - ru * UX, rpz = R[2] - ru * UX;

  // The light comes from up and to the left of the eye.
  const lx0 = -0.45, ly0 = 0.6, lz0 = 0.66;
  const Lx = lx0 * R[0] + ly0 * U[0] + lz0 * E[0], Ly = lx0 * R[1] + ly0 * U[1] + lz0 * E[1], Lz = lx0 * R[2] + ly0 * U[2] + lz0 * E[2];
  const hn = 1 / sqrt((Lx + E[0]) ** 2 + (Ly + E[1]) ** 2 + (Lz + E[2]) ** 2);
  const Hx = (Lx + E[0]) * hn, Hy = (Ly + E[1]) * hn, Hz = (Lz + E[2]) * hn;
  // The two sides: where F > 0 and where F < 0.
  const side = S.side;
  hsv(tone(0.6, hue), 0.5, 1, side[0], 0);
  hsv(tone(0.8, hue), 0.38, 1, side[1], 0);
  // Each sheet lets through this much of what is behind it. An opaque
  // surface needs only the first sheet along each ray: a line behind it is
  // dimmed the same however many more there are.
  const pass = glass * 0.65, most = pass > 0 ? 3 : 1;

  // Every surface point the ray through each LED meets inside the spheroid,
  // t measured from the plane through the centre: the cubic F(o + t v) =
  // a3 t^3 + a2 t^2 + a1 t + a0, a1 the gradient at o along v and a2 from
  // the polarised cubic part. Along a row a0 is a cubic in the column, a1 a
  // quadratic and a2 linear, so after four columns each is carried by its
  // differences.
  const c4 = S.c4;
  for (let py = 0, p = 0; py < H; py++) {
    const sy = (H / 2 - py - 0.5) / k;
    for (let j = 0; j < 4; j++) {
      const sx = (j + 0.5 - W / 2) / k;
      const ox = C0 + sx * R[0] + sy * U[0], oy = C0 + sx * R[1] + sy * U[1], oz = C0 + sx * R[2] + sy * U[2];
      grad(ox, oy, oz, g);
      c4[j] = F(ox, oy, oz);
      c4[4 + j] = g[0] * vx + g[1] * vy + g[2] * vz;
      c4[8 + j] = g3x * ox + g3y * oy + g3z * oz + qv;
    }
    // The ray against the spheroid, qa t^2 + qb t + qc = 0, with qb linear
    // and qc quadratic in sx along the row.
    const hx = sy * U[0], hy = sy * U[1], hz = sy * U[2], hu = (hx + hy + hz) * UX;
    const hpx = hx - hu * UX, hpy = hy - hu * UX, hpz = hz - hu * UX;
    const qb0 = 2 * ((hpx * vpx + hpy * vpy + hpz * vpz) * iA2 + hu * vu * iB2), qbx = 2 * ((rpx * vpx + rpy * vpy + rpz * vpz) * iA2 + ru * vu * iB2);
    const qc0 = (hpx * hpx + hpy * hpy + hpz * hpz) * iA2 + hu * hu * iB2 - 1;
    const qcx = 2 * ((hpx * rpx + hpy * rpy + hpz * rpz) * iA2 + hu * ru * iB2), qcxx = (rpx * rpx + rpy * rpy + rpz * rpz) * iA2 + ru * ru * iB2;
    let a0 = c4[0], d01 = c4[1] - c4[0], d02 = c4[2] - 2 * c4[1] + c4[0];
    const d03 = c4[3] - 3 * c4[2] + 3 * c4[1] - c4[0];
    let a1 = c4[4], d11 = c4[5] - c4[4];
    const d12 = c4[6] - 2 * c4[5] + c4[4];
    let a2 = c4[8];
    const d21 = c4[9] - c4[8];
    let hint = NaN;
    for (let px = 0; px < W; px++, p++) {
      if (px > 0) {
        a0 += d01;
        d01 += d02;
        d02 += d03;
        a1 += d11;
        d11 += d12;
        a2 += d21;
      }
      const o = p * 3;
      rgb[o] = rgb[o + 1] = rgb[o + 2] = 0;
      nT[p] = -1;
      const sx = (px + 0.5 - W / 2) / k, qb = qb0 + qbx * sx, qc = qc0 + (qcx + qcxx * sx) * sx;
      const disc = qb * qb - 4 * qa * qc;
      if (disc <= 0) {
        hint = NaN;
        continue;
      }
      const sq = sqrt(disc), t0 = (-qb - sq) / (2 * qa), t1 = (-qb + sq) / (2 * qa);
      // A faint glass shell where the ray grazes the spheroid.
      const sk = (t1 - t0) * k, rim = sk < 8 ? 0.2 * (1 - sk / 8) * (1 - sk / 8) : 0;
      rgb[o] = rim * 0.6;
      rgb[o + 1] = rim * 0.75;
      rgb[o + 2] = rim;
      const ox = C0 + sx * R[0] + hx, oy = C0 + sx * R[1] + hy, oz = C0 + sx * R[2] + hz;
      const n = cubicRoots(a3, a2, a1, a0, t0, t1, r, most, hint);
      hint = n > 0 ? r[0] : NaN;
      nT[p] = n;
      let through = 1, cr = 0, cg = 0, cb = 0;
      for (let i = 0; i < n; i++) {
        const t = (T[o + i] = r[i]);
        if (through < 0.02) continue;
        grad(ox + t * vx, oy + t * vy, oz + t * vz, g);
        const nl = sqrt(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]) || 1;
        let nx = g[0] / nl, ny = g[1] / nl, nz = g[2] / nl;
        // Which side faces the eye: the gradient points to F > 0.
        const facing = nx * E[0] + ny * E[1] + nz * E[2], col = side[facing > 0 ? 0 : 1];
        if (facing < 0) (nx = -nx), (ny = -ny), (nz = -nz);
        const dif = max(0, nx * Lx + ny * Ly + nz * Lz);
        let sp2 = max(0, nx * Hx + ny * Hy + nz * Hz);
        sp2 *= sp2;
        sp2 *= sp2;
        sp2 *= sp2;
        const spec = 0.45 * sp2 * sp2 * sp2;
        // Depth cue: the far side of the spheroid is dimmer.
        const fog = 1 - 0.5 * cl((t + A) / (2 * A), 0, 1);
        const lum = (0.13 + 0.42 * dif + 0.25 * abs(facing)) * fog, a = through * (1 - pass);
        cr += a * (col[0] * lum + spec);
        cg += a * (col[1] * lum + spec);
        cb += a * (col[2] * lum + spec);
        through *= pass;
      }
      rgb[o] = rgb[o] * through + cr;
      rgb[o + 1] = rgb[o + 1] * through + cg;
      rgb[o + 2] = rgb[o + 2] * through + cb;
    }
  }

  // The lines, sampled every LED. A sample is a point of the surface, and
  // the sheets the ray through its LED meets before it hide it. The LED's
  // centre is up to half an LED off the line, so the sample's depth is
  // carried there along the surface's tangent plane before comparing.
  ln.fill(0);
  const plot = (X, Y, Z, cr, cg, cb, base, hid, wide, reach, top) => {
    const sx = X * R[0] + Y * R[1] + Z * R[2], sy = X * U[0] + Y * U[1] + Z * U[2], tz = X * vx + Y * vy + Z * vz;
    const fx = W / 2 + sx * k - 0.5, fy = H / 2 - sy * k - 0.5;
    const cx = round(fx), cy = round(fy);
    if (cx < 0 || cx >= W || cy < 0 || cy >= H) return;
    const pc = cy * W + cx, n = nT[pc];
    let m = 0;
    if (n > 0) {
      grad(X + C0, Y + C0, Z + C0, g);
      const gv = g[0] * vx + g[1] * vy + g[2] * vz;
      let tc = tz;
      if (abs(gv) > 1e-6 * (abs(g[0]) + abs(g[1]) + abs(g[2]))) {
        const dsx = (cx - fx) / k, dsy = (fy - cy) / k;
        tc -= ((g[0] * R[0] + g[1] * R[1] + g[2] * R[2]) * dsx + (g[0] * U[0] + g[1] * U[1] + g[2] * U[2]) * dsy) / gv;
      }
      for (let i = 0; i < n; i++) if (T[pc * 3 + i] < tc - 0.03) m++;
    }
    const fog = 1 - 0.5 * cl((tz + A) / (2 * A), 0, 1);
    const a = base * fog * (m === 0 ? 1 : hid + (1 - hid) * pass ** m * glass);
    // Laid over the LEDs it is near, a soft disc of radius about
    // sqrt(1.2 / wide) LEDs.
    for (let yy = cy - reach; yy <= cy + reach; yy++) {
      if (yy < 0 || yy >= H) continue;
      for (let xx = cx - reach; xx <= cx + reach; xx++) {
        if (xx < 0 || xx >= W) continue;
        const ex = xx - fx, ey = yy - fy, w = cl(1.2 - (ex * ex + ey * ey) * wide, 0, 1) * a, q = (yy * W + xx) * 4;
        if (top) {
          // Laid on top of what is there.
          const o = ln[q + 3], b = o > 0 ? 1 - w : 0;
          ln[q] = ln[q] * b + cr * (1 - b);
          ln[q + 1] = ln[q + 1] * b + cg * (1 - b);
          ln[q + 2] = ln[q + 2] * b + cb * (1 - b);
          ln[q + 3] = max(o, w);
        } else if (w > ln[q + 3]) {
          ln[q + 3] = w;
          ln[q] = cr;
          ln[q + 1] = cg;
          ln[q + 2] = cb;
        }
      }
    }
  };
  // Line colours: the two sixes of the double six, then the fifteen.
  const cls = S.cls;
  hsv(tone(0.5, hue), 0.85, 1, cls[0], 0);
  hsv(tone(0.95, hue), 0.75, 1, cls[1], 0);
  hsv(tone(0.3, hue), 0.7, 1, cls[2], 0);
  // The focus and the ten lines that meet it are lit; the other sixteen,
  // skew to it, are dimmed. The focus turns white over 0.3 s, and where it
  // runs behind a sheet it keeps half its light, the others a fifth.
  const F0 = S.focus, nbs = L[F0].nb, fin = min(1, S.since / 0.3);
  // Where a line enters and leaves the spheroid, as s along it, into S.s0
  // and S.s1.
  const span = (P, D) => {
    const wx = P[0] - C0, wy = P[1] - C0, wz = P[2] - C0, wu = (wx + wy + wz) * UX, du = (D[0] + D[1] + D[2]) * UX;
    const wpx = wx - wu * UX, wpy = wy - wu * UX, wpz = wz - wu * UX, dpx = D[0] - du * UX, dpy = D[1] - du * UX, dpz = D[2] - du * UX;
    const qa2 = (dpx * dpx + dpy * dpy + dpz * dpz) * iA2 + du * du * iB2;
    const qb2 = 2 * ((wpx * dpx + wpy * dpy + wpz * dpz) * iA2 + wu * du * iB2);
    const qc2 = (wpx * wpx + wpy * wpy + wpz * wpz) * iA2 + wu * wu * iB2 - 1;
    const disc = qb2 * qb2 - 4 * qa2 * qc2;
    if (disc <= 0) return false;
    S.s0 = (-qb2 - sqrt(disc)) / (2 * qa2);
    S.s1 = (-qb2 + sqrt(disc)) / (2 * qa2);
    return true;
  };
  for (let li = 0; li < L.length; li++) {
    const l = L[li], P = l.p, D = l.d;
    if (!span(P, D)) continue;
    const s0 = S.s0, s1 = S.s1, isF = li === F0;
    const base = isF || nbs.includes(li) ? 1 : 0.3, wh = isF ? 0.7 * fin : 0;
    const col = cls[l.irr ? l.cls : 2];
    const cr = col[0] + (1 - col[0]) * wh, cg = col[1] + (1 - col[1]) * wh, cb = col[2] + (1 - col[2]) * wh;
    const steps = max(2, round((s1 - s0) * k));
    for (let e = 0; e <= steps; e++) {
      const s = s0 + ((s1 - s0) * e) / steps;
      plot(P[0] - C0 + s * D[0], P[1] - C0 + s * D[1], P[2] - C0 + s * D[2], cr, cg, cb, base, isF ? 0.5 : 0.2, isF ? 0.5 : 1.3, 1, false);
    }
  }
  // The points where the ten meet the focus, white, those inside the
  // spheroid; a line parallel to the focus meets it at infinity.
  for (const X of L[F0].at) {
    if (!X) continue;
    const x = X[0] - C0, y = X[1] - C0, z = X[2] - C0, u = (x + y + z) * UX;
    const px = x - u * UX, py = y - u * UX, pz = z - u * UX;
    if ((px * px + py * py + pz * pz) * iA2 + u * u * iB2 >= 1) continue;
    plot(x, y, z, 1, 1, 1, fin, 0.5, 0.3, 2, true);
  }

  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const o = p * 3, q = p * 4, w = ln[q + 3];
      display.setPixel(
        x,
        y,
        (255 * cl(rgb[o] * (1 - w) + ln[q] * w, 0, 1)) | 0,
        (255 * cl(rgb[o + 1] * (1 - w) + ln[q + 1] * w, 0, 1)) | 0,
        (255 * cl(rgb[o + 2] * (1 - w) + ln[q + 2] * w, 0, 1)) | 0,
      );
    }
}
