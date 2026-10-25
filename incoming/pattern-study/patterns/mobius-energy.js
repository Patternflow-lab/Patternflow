// ===== Patternflow pattern =====
// Title:   Möbius Energy
// Family:  topology
// Idea:    A knotted tube, crumpled by wringing the space around it, relaxes under the gradient flow of the Möbius energy, which blows up where strands approach, so it untangles only as far as its knot type allows: an unknot opens into a circle, a trefoil into its three-lobed shape, and a trace below logs the energy falling.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Möbius energy of knots (Jun O'Hara, 1991; Michael Freedman, Zheng-Xu He and Zhenghan Wang, 1994), pattern round 48
// Round:   48
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Knot=0..4, Crumple=0..1
//
// Knob 1: Hue. The colour that walks along the tube. At 0 it runs from cyan through blue to violet and back round the loop; at 0.25 from violet through pink to orange, at 0.5 from red through yellow to green, at 0.75 from yellow-green to sky blue.
// Knob 2: Speed. At 2 the flow takes 50 steps a second; a crumpled trefoil opens in 7 to 11 s, the unknot in 5 to 8 s, the others in 9 to 30 s, then the knot holds 2 s and crumples over 2.5 s. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Knot. 0 the trefoil 3_1, 1 the figure-eight 4_1, 2 the cinquefoil 5_1, 3 the three-twist knot 5_2, 4 the unknot. Turning it starts the new knot crumpled.
// Knob 4: Crumple. How hard space is deformed before each relaxation: a stretch along one axis, a wring about it and two twists about axes through the knot. At 0.06 the stretch is 1.8 times, the wring 3.9 rad each way and the twists 3.2 rad; at 0.5 2.6 times, 6 and 5 rad; at 1 3.4 times, 8.4 and 7 rad. It stops if two strands come within half a bead spacing.
// Buttons: K1 tap crumples the knot again now.

const W = 64, H = 128, N = W * H;
const { floor, round, ceil, min, max, abs, sqrt, sin, cos, exp, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const rnd = (a, b) => a + (b - a) * Math.random();

// A closed polygon of NB beads x_i. With l_i the mean of the two edges at
// bead i and D(i, j) the shorter way round from i to j,
//   E = sum over i != j of (1 / |x_i - x_j|^2 - 1 / D(i, j)^2) l_i l_j,
// O'Hara's integral on the beads: blind to size, 4 on a round circle, its
// least value (Freedman, He and Wang). The flow keeps each edge's length, so
// l_i and D stay put and a step follows the exact gradient. Added: a barrier
// between edges nearer than the mean edge, which beads cannot see cross, and
// bending stiffness, as E is blind to inversions of space too and lets a
// relaxed knot drift. A step is kept only if the sum went down.
const NB = 120, N3 = NB * 3;
// The (2,3) and (2,5) torus knots, the figure-eight, the Lissajous knot 5_2
// (frequencies 3, 2, 7, phases 0.7, 0.2, 0) and a bent circle.
const tor = (p, q, r) => (t) => [(2 + cos(q * t)) * cos(p * t), (2 + cos(q * t)) * sin(p * t), sin(r * t)];
const KNOTS = [tor(2, 3, 3), tor(3, 2, 4), tor(2, 5, 5), (t) => [cos(3 * t + 0.7), cos(2 * t + 0.2), cos(7 * t)], (t) => [cos(t), sin(t), 0.25 * sin(2 * t)]];
// LEDs a unit and the tube's radius for each knot.
const ZOOM = [28, 22, 24, 15, 27], TUBE = [2.6, 2.3, 2.1, 1.8, 2.7];
// Steps a second at Speed 2, a bead's largest move in one, crumple and hold s.
const SPS = 50, VCAP = 0.0055, CRT = 2.5, HOLD = 2;
// Barrier weight; bending, BEND L times the integral of curvature squared
// (7.9 on a circle: weaker, 4_1 and 5_2 pull a clasp tight by a big loop,
// which E alone prices the same); the stretch at Crumple 0.
const BAR = 2, BEND = 0.2, STR = 1.7;
// The knot's middle row; the trace's rows.
const KY = 50, TY0 = 100, TY1 = 124, TN = 64;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Fourier tables along the curve; mode k is smoothed by k^-2.5.
const KM = 32, CS = new Float64Array(NB * (KM + 1)), SN = new Float64Array(NB * (KM + 1)), PK = new Float64Array(KM + 1);
for (let k = 1; k <= KM; k++) {
  for (let i = 0; i < NB; i++) (CS[k * NB + i] = cos((TAU * k * i) / NB)), (SN[k * NB + i] = sin((TAU * k * i) / NB));
  PK[k] = 2 / (k * k * sqrt(k));
}

function centre(X) {
  let a = 0, b = 0, c = 0;
  for (let i = 0; i < N3; i += 3) (a += X[i]), (b += X[i + 1]), (c += X[i + 2]);
  (a /= NB), (b /= NB), (c /= NB);
  for (let i = 0; i < N3; i += 3) (X[i] -= a), (X[i + 1] -= b), (X[i + 2] -= c);
}

// Edge lengths into LE, running sums into CUM; returns the length.
const LE = new Float64Array(NB), CUM = new Float64Array(NB + 1);
function lengths(X) {
  for (let i = 0; i < NB; i++) {
    const o = i * 3, q = ((i + 1) % NB) * 3;
    LE[i] = sqrt((X[q] - X[o]) ** 2 + (X[q + 1] - X[o + 1]) ** 2 + (X[q + 2] - X[o + 2]) ** 2);
    CUM[i + 1] = CUM[i] + LE[i];
  }
  return CUM[NB];
}

// Knot k's beads, evened along it, centred, the furthest one unit out.
function nice(k, X, Y) {
  for (let i = 0; i < NB; i++) X.set(KNOTS[k]((TAU * i) / NB), i * 3);
  for (let g = 0; g < 6; g++) resample(X, Y), X.set(Y);
  centre(X);
  let r = 0;
  for (let i = 0; i < N3; i += 3) r = max(r, X[i] ** 2 + X[i + 1] ** 2 + X[i + 2] ** 2);
  for (let i = 0; i < N3; i++) X[i] /= sqrt(r);
}

// Edges i and j: their distance, and in SD where along each the closest
// points lie and the vector between them.
const SD = new Float64Array(5);
function segd(X, i, j) {
  const p = i * 3, pe = ((i + 1) % NB) * 3, r = j * 3, re = ((j + 1) % NB) * 3;
  const d1x = X[pe] - X[p], d1y = X[pe + 1] - X[p + 1], d1z = X[pe + 2] - X[p + 2];
  const d2x = X[re] - X[r], d2y = X[re + 1] - X[r + 1], d2z = X[re + 2] - X[r + 2];
  const rx = X[p] - X[r], ry = X[p + 1] - X[r + 1], rz = X[p + 2] - X[r + 2];
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * rx + d2y * ry + d2z * rz;
  const c = d1x * rx + d1y * ry + d1z * rz, b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b;
  let s = den > 1e-18 ? cl((b * f - c * e) / den, 0, 1) : 0, t = (b * s + f) / e;
  if (t < 0) (t = 0), (s = cl(-c / a, 0, 1));
  else if (t > 1) (t = 1), (s = cl((b - c) / a, 0, 1));
  const wx = rx + d1x * s - d2x * t, wy = ry + d1y * s - d2y * t, wz = rz + d1z * s - d2z * t;
  (SD[0] = s), (SD[1] = t), (SD[2] = wx), (SD[3] = wy), (SD[4] = wz);
  return sqrt(wx * wx + wy * wy + wz * wz);
}

// E, plus BAR (h / d - 1)^2 for edges sharing no bead d < h apart (h the
// mean edge), plus BEND L sum 2 (1 - cos a_i) / l_i over the turns a_i; with
// G, the gradient for fixed edge lengths. DM is left the least distance
// between edges sharing no bead, or h if that is more: beads further apart
// than two longest edges and h have edges more than h apart.
let DM = 0;
const dmin = (X) => (energy(X, null), DM);
function energy(X, G) {
  const L = lengths(X), h = L / NB, near = (2 * max(...LE) + h) ** 2;
  if (G) G.fill(0);
  let E = 0, B = 0;
  DM = h;
  for (let i = 0; i < NB; i++) {
    const wi = (LE[(i + NB - 1) % NB] + LE[i]) / 2, xi = X[i * 3], yi = X[i * 3 + 1], zi = X[i * 3 + 2];
    for (let j = i + 1; j < NB; j++) {
      const dx = xi - X[j * 3], dy = yi - X[j * 3 + 1], dz = zi - X[j * 3 + 2], r2 = dx * dx + dy * dy + dz * dz, wj = (LE[j - 1] + LE[j]) / 2;
      let a = CUM[j] - CUM[i];
      if (a > L - a) a = L - a;
      E += (1 / r2 - 1 / (a * a)) * wi * wj;
      if (j === i + 1 || (i === 0 && j === NB - 1)) continue;
      if (G) {
        const f = (-4 * wi * wj) / (r2 * r2);
        (G[i * 3] += f * dx), (G[i * 3 + 1] += f * dy), (G[i * 3 + 2] += f * dz);
        (G[j * 3] -= f * dx), (G[j * 3 + 1] -= f * dy), (G[j * 3 + 2] -= f * dz);
      }
      if (r2 > near) continue;
      const d = segd(X, i, j);
      if (d < DM) DM = d;
      if (d >= h) continue;
      B += BAR * (h / d - 1) ** 2;
      if (!G) continue;
      const f = (-2 * BAR * (h / d - 1) * h) / (d * d * d), s = SD[0], t = SD[1], i1 = ((i + 1) % NB) * 3, j1 = ((j + 1) % NB) * 3;
      for (let c = 0; c < 3; c++) {
        const w = f * SD[2 + c];
        (G[i * 3 + c] += w * (1 - s)), (G[i1 + c] += w * s), (G[j * 3 + c] -= w * (1 - t)), (G[j1 + c] -= w * t);
      }
    }
  }
  for (let i = 0; i < NB; i++) {
    const i0 = (i + NB - 1) % NB, a = i0 * 3, o = i * 3, q = ((i + 1) % NB) * 3;
    const l0 = LE[i0], l1 = LE[i], k = (BEND * L * 2) / (l0 + l1), u = 1 / (l0 * l1);
    let dot = 0;
    for (let c = 0; c < 3; c++) dot += (X[o + c] - X[a + c]) * (X[q + c] - X[o + c]);
    B += k * 2 * (1 - dot * u);
    if (G)
      for (let c = 0; c < 3; c++) {
        const p = X[o + c] - X[a + c], n = X[q + c] - X[o + c], g = -2 * k * u;
        (G[a + c] -= g * n), (G[o + c] += g * (n - p)), (G[q + c] += g * p);
      }
  }
  return 2 * E + B;
}

// Projects a motion V onto those keeping every edge's length: V less
// J^T (J J^T)^-1 J V, J J^T cyclic tridiagonal, solved by Sherman-Morrison.
const UE = new Float64Array(N3), TA = new Float64Array(NB), TB = new Float64Array(NB), TR = new Float64Array(NB);
const TY = new Float64Array(NB), TZ = new Float64Array(NB), TW = new Float64Array(NB), TU = new Float64Array(NB);
function thomas(d, o, r, x) {
  TW[0] = d[0];
  x[0] = r[0];
  for (let i = 1, m; i < NB; i++) (m = o[i - 1] / TW[i - 1]), (TW[i] = d[i] - m * o[i - 1]), (x[i] = r[i] - m * x[i - 1]);
  x[NB - 1] /= TW[NB - 1];
  for (let i = NB - 2; i >= 0; i--) x[i] = (x[i] - o[i] * x[i + 1]) / TW[i];
}
function tangent(X, V) {
  for (let e = 0; e < NB; e++) for (let c = 0, q = ((e + 1) % NB) * 3; c < 3; c++) UE[e * 3 + c] = X[q + c] - X[e * 3 + c];
  for (let e = 0; e < NB; e++) {
    const o = e * 3, q = ((e + 1) % NB) * 3;
    TA[e] = 2 * (UE[o] ** 2 + UE[o + 1] ** 2 + UE[o + 2] ** 2);
    TB[e] = -(UE[o] * UE[q] + UE[o + 1] * UE[q + 1] + UE[o + 2] * UE[q + 2]);
    TR[e] = UE[o] * (V[q] - V[o]) + UE[o + 1] * (V[q + 1] - V[o + 1]) + UE[o + 2] * (V[q + 2] - V[o + 2]);
  }
  const g = -TA[0], bn = TB[NB - 1];
  (TA[0] -= g), (TA[NB - 1] -= (bn * bn) / g), TU.fill(0), (TU[0] = g), (TU[NB - 1] = bn);
  thomas(TA, TB, TR, TY);
  thomas(TA, TB, TU, TZ);
  const k = (TY[0] + (bn * TY[NB - 1]) / g) / (1 + TZ[0] + (bn * TZ[NB - 1]) / g);
  for (let e = 0; e < NB; e++) TY[e] -= k * TZ[e];
  for (let i = 0; i < NB; i++) {
    const e0 = (i + NB - 1) % NB;
    for (let c = 0; c < 3; c++) V[i * 3 + c] -= TY[e0] * UE[e0 * 3 + c] - TY[i] * UE[i * 3 + c];
  }
}

// Smooths G into D: modes up to 32 (the rest are under 1/5000), so long
// bends move as fast as short ones (E's order is 3). Projected before and
// after, the step still goes downhill.
const FA = new Float64Array(KM + 1), FB = new Float64Array(KM + 1);
function smooth(G, D) {
  D.fill(0);
  for (let c = 0; c < 3; c++) {
    for (let k = 1; k <= KM; k++) {
      let a = 0, b = 0;
      for (let i = 0, o = k * NB; i < NB; i++) (a += G[i * 3 + c] * CS[o + i]), (b += G[i * 3 + c] * SN[o + i]);
      (FA[k] = a * PK[k]), (FB[k] = b * PK[k]);
    }
    for (let k = 1; k <= KM; k++) for (let i = 0, o = k * NB; i < NB; i++) D[i * 3 + c] += FA[k] * CS[o + i] + FB[k] * SN[o + i];
  }
}

// Puts each edge e back to length ell[e], to 1e-8.
function edges(X, ell) {
  for (let s = 0, worst = 1; s < 40 && worst > 1e-8; s++) {
    worst = 0;
    for (let n = 0; n < NB; n++) {
      const i = s & 1 ? NB - 1 - n : n, o = i * 3, q = ((i + 1) % NB) * 3, h = ell[i];
      const dx = X[q] - X[o], dy = X[q + 1] - X[o + 1], dz = X[q + 2] - X[o + 2], l = sqrt(dx * dx + dy * dy + dz * dz), f = (0.5 * (l - h)) / l;
      worst = max(worst, abs(l - h) / h);
      (X[o] += f * dx), (X[o + 1] += f * dy), (X[o + 2] += f * dz);
      (X[q] -= f * dx), (X[q + 1] -= f * dy), (X[q + 2] -= f * dz);
    }
  }
}

// The rule that keeps the knot: beads move in straight lines from X to Y by
// at most dm / 4, dm the least edge distance in X. No point of an edge moves
// more than its beads, so edges sharing no bead stay dm / 2 apart all the
// way: no strand passes through another. Returns the share of the move
// allowed; with cut, Y is held to it.
function guard(X, Y, cut, dm) {
  let d = 0;
  for (let i = 0; i < N3; i += 3) d = max(d, (Y[i] - X[i]) ** 2 + (Y[i + 1] - X[i + 1]) ** 2 + (Y[i + 2] - X[i + 2]) ** 2);
  d = sqrt(d);
  if (d <= 0.25 * dm) return 1;
  const f = (0.25 * dm) / d;
  if (cut) for (let i = 0; i < N3; i++) Y[i] = X[i] + (Y[i] - X[i]) * f;
  return f;
}

// Slides the beads along the polygon to even spacing, into Y.
function resample(X, Y) {
  const L = lengths(X), h = L / NB;
  let s0 = 0;
  for (let b = 0; b < NB; b++) s0 += CUM[b] - b * h;
  s0 /= NB;
  for (let b = 0, lo = 0; b < NB; b++) {
    const s = (((s0 + b * h) % L) + L) % L;
    if (s < CUM[lo]) lo = 0;
    while (lo < NB - 1 && CUM[lo + 1] <= s) lo++;
    const u = (s - CUM[lo]) / LE[lo], o = lo * 3, q = ((lo + 1) % NB) * 3;
    for (let c = 0; c < 3; c++) Y[b * 3 + c] = X[o + c] + (X[q + c] - X[o + c]) * u;
  }
}

// Evens the beads, guarded, until two edges would come within half an edge.
function even(S, rounds, dX = dmin(S.X)) {
  const X = S.X, Y = S.Y;
  for (let g = 0; g < rounds; g++) {
    resample(X, Y);
    guard(X, Y, true, dX);
    const dY = dmin(Y);
    if (dY < (0.5 * lengths(Y)) / NB) break;
    X.set(Y);
    centre(X);
    dX = dY;
  }
  return dX;
}

// The crumple: a stretch along an axis (volume kept), a wring about it and
// two twists about axes through beads. A twist turns points round its axis
// by an angle set by their distance from it and height along it, so the
// turn back undoes it: all are diffeomorphisms of R^3, the knot stays.
const dir = () => {
  const u = rnd(-1, 1), a = rnd(0, TAU), s = sqrt(1 - u * u);
  return [s * cos(a), s * sin(a), u];
};
function newTwists(S) {
  const X = S.X, A = 3 + 4 * S.crumple, sg = () => (Math.random() < 0.5 ? -1 : 1);
  let rg = 0;
  for (let i = 0; i < N3; i++) rg += X[i] * X[i];
  rg = sqrt(rg / NB);
  const a = dir();
  S.st = { a, k: log(STR * (1 + S.crumple)) };
  // The wring turns each slice across the axis whole, -A to A along it.
  S.tw = [{ c: [0, 0, 0], a, sr: 2 * rg, sz: 0.8 * rg, A: 1.2 * A * sg(), w: 1 }];
  for (let k = 0; k < 2; k++) {
    const b = floor(rnd(0, NB)) * 3;
    S.tw.push({ c: [X[b], X[b + 1], X[b + 2]], a: dir(), sr: rnd(0.4, 0.6) * rg, sz: rnd(0.5, 0.8) * rg, A: A * rnd(0.85, 1.15) * sg(), w: 0 });
  }
}

function twist(S, X, Y, f) {
  Y.set(X);
  const sa = S.st.a, g = exp(S.st.k * f), q = 1 / sqrt(g);
  for (let i = 0; i < N3; i += 3) {
    const z = Y[i] * sa[0] + Y[i + 1] * sa[1] + Y[i + 2] * sa[2];
    for (let c = 0; c < 3; c++) Y[i + c] = Y[i + c] * q + z * (g - q) * sa[c];
  }
  for (const T of S.tw) {
    const [cx, cy, cz] = T.c, [ax, ay, az] = T.a, ir = 1 / (T.sr * T.sr), iz = 1 / T.sz;
    for (let i = 0; i < N3; i += 3) {
      const rx = Y[i] - cx, ry = Y[i + 1] - cy, rz = Y[i + 2] - cz, z = rx * ax + ry * ay + rz * az;
      const qx = rx - z * ax, qy = ry - z * ay, qz = rz - z * az, zz = z * iz;
      const th = f * T.A * exp(-(qx * qx + qy * qy + qz * qz) * ir) * (T.w ? Math.tanh(zz) : exp(-zz * zz)), c = cos(th), s = sin(th);
      Y[i] = cx + z * ax + qx * c + (ay * qz - az * qy) * s;
      Y[i + 1] = cy + z * ay + qy * c + (az * qx - ax * qz) * s;
      Y[i + 2] = cz + z * az + qz * c + (ax * qy - ay * qx) * s;
    }
  }
}

// Crumples on from share a to b in guarded pieces, evening after each;
// stops if two edges would come within half an edge. Returns where it got.
function crumpleTo(S, a, b) {
  const X = S.X, Y = S.Y;
  let sub = b - a, dX = dmin(X);
  for (let n = 0; a < b - 1e-9 && n < 200; n++) {
    const f = min(sub, b - a);
    twist(S, X, Y, sm(a + f) - sm(a));
    const g = guard(X, Y, false, dX);
    if (g < 1) {
      sub = f * g * 0.8;
      continue;
    }
    const dY = dmin(Y);
    if (dY < (0.5 * lengths(Y)) / NB) return 1;
    X.set(Y);
    dX = even(S, 1, dY);
    a += f;
    sub = f * 1.5;
  }
  return a > 1 - 1e-6 ? 1 : a;
}

function begin(S) {
  nice(S.knot, S.X, S.Y);
  S.L0 = lengths(S.X);
  newTwists(S);
  crumpleTo(S, 0, 1);
  relax(S);
  frame(S, 1);
}

// The flow starts at the first length (the zoom undoes it), edges fixed.
function relax(S) {
  const f = S.L0 / lengths(S.X);
  for (let i = 0; i < N3; i++) S.X[i] *= f;
  centre(S.X);
  lengths(S.X);
  S.ell.set(LE);
  S.phase = S.t = S.tc = 0;
  S.E = S.Ec = energy(S.X, null);
  S.tau = 1e-5;
}

// One step: gradient, projected, smoothed, projected; cut to the guard,
// halved until the energy falls, kept only then.
function step(S) {
  const { X, Y, G, D } = S;
  energy(X, G);
  const dm = DM;
  tangent(X, G);
  smooth(G, D);
  tangent(X, D);
  let m = 0;
  for (let i = 0; i < N3; i += 3) m = max(m, D[i] * D[i] + D[i + 1] * D[i + 1] + D[i + 2] * D[i + 2]);
  let k = min(S.tau, VCAP / (sqrt(m) + 1e-30));
  for (let tries = 0; tries < 12; tries++) {
    for (let i = 0; i < N3; i++) Y[i] = X[i] - k * D[i];
    edges(Y, S.ell);
    centre(Y);
    const g = guard(X, Y, false, dm);
    if (g < 1) {
      k *= g * 0.9;
      continue;
    }
    const E = energy(Y, null);
    if (E < S.E) {
      X.set(Y);
      S.E = E;
      S.tau = k * 1.3;
      return;
    }
    k *= 0.5;
  }
  S.tau = max(k, 1e-12);
}

// A smoothed view along the thinnest axis, the longest up the panel, by
// power steps on C and tr - C.
function frame(S, d) {
  const X = S.X, C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < N3; i += 3) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a * 3 + b] += X[i + a] * X[i + b];
  const tr = C[0] + C[4] + C[8], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], unit = (w) => w.map((x) => x / (Math.hypot(...w) || 1));
  const it = (v, sh) => {
    for (let k = 0; k < 3; k++) v = unit([0, 1, 2].map((a) => sh * v[a] + (sh ? -1 : 1) * (C[a * 3] * v[0] + C[a * 3 + 1] * v[1] + C[a * 3 + 2] * v[2])));
    return v;
  };
  const k = min(1, d * 1.2), pull = (e, v) => unit(e.map((x, a) => x + (v[a] * (dot(e, v) < 0 ? -1 : 1) - x) * k));
  const e3 = pull(S.e3, it(S.e3, tr)), e2 = pull(S.e2, it(S.e2, 0)), p = dot(e2, e3);
  S.e3 = e3;
  S.e2 = unit(e2.map((x, a) => x - p * e3[a]));
  S.e1 = [S.e2[1] * e3[2] - S.e2[2] * e3[1], S.e2[2] * e3[0] - S.e2[0] * e3[2], S.e2[0] * e3[1] - S.e2[1] * e3[0]];
}

export function setup(params) {
  params.s = {
    knot: -1, phase: 0, t: 0, acc: 0, rock: 0, cr: 0,
    X: new Float64Array(N3), Y: new Float64Array(N3), G: new Float64Array(N3), D: new Float64Array(N3), ell: new Float64Array(NB),
    hist: new Float32Array(TN).fill(NaN), ht: 0,
    e1: [1, 0, 0], e2: [0, 1, 0], e3: [0, 0, 1],
    zb: new Float32Array(N), buf: new Float32Array(N * 3), col: new Float32Array(NB * 3), scr: new Float32Array(NB * 4),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  [S.hue, S.speed, S.crumple] = [cl(kv[0], 0, 1), cl(kv[1], 0.2, 3), cl(kv[3], 0, 1)];
  const knot = round(cl(kv[2], 0, 4));
  if (knot !== S.knot) {
    S.knot = knot;
    S.hist.fill(NaN);
    begin(S);
  }
  const ds = (d * S.speed) / 2;
  S.rock += ds;
  if (input.btnPressed && input.btnPressed[0] && S.phase !== 2) (S.phase = 2), (S.cr = 0), newTwists(S);
  S.t += ds;
  if (S.phase === 0) {
    S.acc += ds * SPS;
    for (; S.acc >= 1; S.acc--) step(S);
    // Relaxed once half a second takes less than 0.05% off the energy.
    if ((S.tc += ds) >= 0.5) {
      if (S.Ec - S.E < 0.0005 * S.E && S.t > 3) (S.phase = 1), (S.t = 0);
      S.Ec = S.E;
      S.tc = 0;
    }
    if (S.t > 40) (S.phase = 1), (S.t = 0);
  } else if (S.phase === 1) {
    // While it holds, the beads are spaced out evenly again.
    even(S, 2);
    S.E = energy(S.X, null);
    if (S.t > HOLD) (S.phase = 2), (S.cr = 0), newTwists(S);
  } else {
    S.cr = crumpleTo(S, S.cr, min(1, S.cr + ds / CRT));
    S.E = energy(S.X, null);
    if (S.cr >= 1) relax(S);
  }
  frame(S, ds);
  // A trace sample every quarter second.
  if ((S.ht += ds) >= 0.25) {
    (S.ht -= 0.25), S.hist.copyWithin(0, 1), (S.hist[TN - 1] = log(S.E));
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.knot < 0) return;
  const { zb, buf, col, scr, X, e1, e2, e3 } = S;
  zb.fill(1e9), buf.fill(0);
  // The view rocks 0.6 rad and nods 0.3.
  const ra = 0.6 * sin((TAU * S.rock) / 13), rb = 0.3 * sin((TAU * S.rock) / 9.1), ca = cos(ra), sa = sin(ra), cb = cos(rb), sb = sin(rb);
  const zoom = ZOOM[S.knot] * (S.L0 / lengths(X)), tr = TUBE[S.knot], CAM = 5;
  for (let i = 0; i < NB; i++) {
    const o = i * 3, x = X[o], y = X[o + 1], z = X[o + 2];
    let u = e1[0] * x + e1[1] * y + e1[2] * z, v = e2[0] * x + e2[1] * y + e2[2] * z, w = e3[0] * x + e3[1] * y + e3[2] * z;
    [u, w] = [u * ca + w * sa, -u * sa + w * ca];
    [v, w] = [v * cb + w * sb, -v * sb + w * cb];
    const p = CAM / (CAM + w);
    (scr[i * 4] = 31.5 + u * zoom * p), (scr[i * 4 + 1] = KY - v * zoom * p), (scr[i * 4 + 2] = w * zoom), (scr[i * 4 + 3] = tr * p);
    // The hue walks a third of the wheel along the curve and back.
    hsv(0.5 + S.hue + 0.34 * (0.5 - 0.5 * cos((TAU * i) / NB)), 0.8, 1, col, o);
  }
  // Light from the upper left and in front, and the half vector for the shine.
  const lx = -0.451, ly = -0.551, lz = -0.702, hx = -0.245, hy = -0.299, hz = -0.922;
  for (let i = 0; i < NB; i++) {
    const a = i * 4, b = ((i + 1) % NB) * 4, ax = scr[a], ay = scr[a + 1], az = scr[a + 2], bx = scr[b], by = scr[b + 1], bz = scr[b + 2];
    let tx = bx - ax, ty = by - ay, tz = bz - az;
    const tl = sqrt(tx * tx + ty * ty + tz * tz) || 1, m = max(1, ceil(Math.hypot(bx - ax, by - ay) / 0.7)), ci = i * 3, cj = ((i + 1) % NB) * 3;
    (tx /= tl), (ty /= tl), (tz /= tl);
    for (let q = 0; q < m; q++) {
      const f = q / m, sx = ax + (bx - ax) * f, sy = ay + (by - ay) * f, sz = az + (bz - az) * f, rp = scr[a + 3] + (scr[b + 3] - scr[a + 3]) * f;
      const cr = col[ci] + (col[cj] - col[ci]) * f, cg = col[ci + 1] + (col[cj + 1] - col[ci + 1]) * f, cbl = col[ci + 2] + (col[cj + 2] - col[ci + 2]) * f;
      // Nearer is brighter: the back of the knot at about 60%.
      const fog = 0.8 - 0.2 * cl(sz / 30, -1, 1);
      const R = rp + 1, x0 = max(0, floor(sx - R)), x1 = min(W - 1, ceil(sx + R)), y0 = max(0, floor(sy - R)), y1 = min(H - 1, ceil(sy + R));
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const nx = x + 0.5 - sx, ny = y + 0.5 - sy, d2 = nx * nx + ny * ny, p = y * W + x;
          if (d2 >= R * R) continue;
          if (d2 >= rp * rp) {
            // A dark rim a little behind: it cuts the gap in a strand below.
            const z = sz + rp * 0.9;
            if (z < zb[p]) (zb[p] = z), (buf[p * 3] = buf[p * 3 + 1] = buf[p * 3 + 2] = 0);
            continue;
          }
          const nz = sqrt(rp * rp - d2), z = sz - nz;
          if (z >= zb[p]) continue;
          zb[p] = z;
          // The sphere's normal less its part along the tube.
          let Nx = nx / rp, Ny = ny / rp, Nz = -nz / rp;
          const dn = Nx * tx + Ny * ty + Nz * tz;
          (Nx -= dn * tx), (Ny -= dn * ty), (Nz -= dn * tz);
          const nl = sqrt(Nx * Nx + Ny * Ny + Nz * Nz) || 1;
          const lam = max(0, (Nx * lx + Ny * ly + Nz * lz) / nl), sp = max(0, (Nx * hx + Ny * hy + Nz * hz) / nl) ** 18, v = fog * (0.3 + 0.75 * lam);
          (buf[p * 3] = cr * v + sp * 0.7), (buf[p * 3 + 1] = cg * v + sp * 0.7), (buf[p * 3 + 2] = cbl * v + sp * 0.7);
        }
    }
  }
  // The trace: log E over the last 16 s, a line over a faint fill.
  let lo = 1e9, hi = -1e9, py = -1;
  for (let i = 0; i < TN; i++) if (S.hist[i] === S.hist[i]) (lo = min(lo, S.hist[i])), (hi = max(hi, S.hist[i]));
  if (hi - lo < 0.4) hi = lo + 0.4;
  const tc = col.subarray(90, 93);
  for (let i = 0; i < TN; i++) {
    const v = S.hist[i];
    if (v !== v) continue;
    const y = round(TY1 - ((v - lo) / (hi - lo)) * (TY1 - TY0)), ya = py < 0 ? y : min(y, py + 1), yb = py < 0 ? y : max(y, py - 1);
    for (let yy = min(ya, y); yy <= TY1; yy++) {
      const p = yy * W + i, f = yy <= max(yb, y) ? (i === TN - 1 ? 1 : 0.6) : 0.16;
      if (zb[p] < 1e9) continue;
      (buf[p * 3] = tc[0] * f), (buf[p * 3 + 1] = tc[1] * f), (buf[p * 3 + 2] = tc[2] * f);
    }
    py = y;
  }
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    if (buf[o] + buf[o + 1] + buf[o + 2] < 0.02) continue;
    // Each channel in steps of 4 of 255.
    display.setPixel(p % W, (p / W) | 0, min(255, round(buf[o] * 63.75) * 4), min(255, round(buf[o + 1] * 63.75) * 4), min(255, round(buf[o + 2] * 63.75) * 4));
  }
}
