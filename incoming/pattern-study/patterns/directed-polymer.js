// ===== Patternflow pattern =====
// Title:   Directed Polymer
// Family:  noise
// Idea:    A directed polymer steps down the standing panel one row at a time from the top centre to the bottom centre through a field of random energies shown as dim dots, the glow at each LED is the probability that the polymer passes there, worked every frame from forward and backward partition functions in log space, and the zero-temperature geodesic is drawn white on top, so as the field slowly turns into a fresh one the cloud braids, splits round two valleys and pours from one into the other while the white line jumps and leaves a fading trace of where it was.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the directed polymer in a random medium (David Huse and Christopher Henley, 1985; Mehran Kardar, 1985), its transverse wandering L^(2/3) (David Huse, Christopher Henley and Daniel Fisher, 1985), the Kardar-Parisi-Zhang equation that its free energy obeys (Mehran Kardar, Giorgio Parisi and Yi-Cheng Zhang, 1986), pattern round 103
// Round:   103
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Beta=-1..1, End=0..1
//
// Knob 1: Hue. Turns the picture round the wheel. At 0 the cloud is cyan, the energies under it blue-violet dots and the geodesic white with a hint of azure; at 0.25 the cloud is violet over rose dots, at 0.5 red over yellow-green, at 0.75 lime over teal.
// Knob 2: Speed. How fast the field of energies turns into a fresh one, 0.25 x Speed radians a second of the turn A cos t + Q sin t: at 2 the field is a new one every 3.1 s and the geodesic's trace fades in 0.56 s; at 0.2 a new field takes 31 s, at 3 it takes 2.1 s.
// Knob 3: Beta. The inverse temperature, 1.3 x 4^Beta. At the opening 0 it is 1.3: across row 64 the cloud has a median spread of 3.1 LEDs and about 12 LEDs lit, and in a typical field 28 of the 128 rows hold two strands with a fifth of the polymer or more each, the widest pair 8 LEDs apart and in one field of ten 17 or more. At -1 it is 0.33 and the cloud is a lens 4.5 LEDs either side of its middle, nearly the random walk's 4.6, which the field moves by only 2 LEDs; at 1 it is 5.2 and the cloud draws in to 0.7 LEDs under the white line.
// Knob 4: End. How far the end may stray from the bottom centre. Below 0.08, and so at the opening 0.06, it is pinned to column 32. Above, the end pays an energy (x - 32)^2 / 2s^2 with s = 60 ((End - 0.08) / 0.89)^2 LEDs: 2.2 at 0.25, 13 at 0.5, 34 at 0.75. From 0.97 the end is free on the whole bottom row, the point-to-line polymer, and the geodesic's end wanders 14 to 16 LEDs from the middle.

// A directed polymer is a path that goes down one row at a time, a step
// down-left, down or down-right, from a fixed start. Every site holds an
// independent energy E, standard Gaussian, and a path is weighted by
// exp(beta H), H the energy it collects plus a potential V at its end.
// Huse and Henley (1985) and Kardar (1985) took it as a model of a domain
// wall pinned by impurities, and its log partition function is a discrete
// Kardar-Parisi-Zhang equation in the row number as time.
//
// Every frame the pattern sums over all paths. Forward, F at a site is the
// log of the summed weight of paths from the top centre to it; backward, B
// is the same from it to the bottom row, end potential included. Both are
// log-sum-exp recursions over three neighbours, so no number overflows at
// any beta. The probability that the polymer passes a site is
// exp(F + B - beta E - log Z), its energy being counted in both. Every path
// crosses every row once, so each row's probabilities sum to 1; setup()
// checks that, that the forward and backward log Z agree, and that log Z /
// beta at beta = 40 lies above the geodesic's H by no more than
// 127 log 3 / 40 = 3.49, before the cloud is drawn. In the study's run the
// sums and the two log Z agree within 1e-13, and the gap at beta 40 is 0.005.
//
// At beta = infinity only the path of largest H counts, the last-passage
// geodesic, worked by the same recursion with max in place of log-sum-exp
// and traced back. Its transverse wandering grows as L^(2/3) (Huse, Henley
// and Fisher, 1985), not the L^(1/2) of a random walk. With these steps and
// Gaussian energies on a lattice wide enough to have no walls, the end of a
// free geodesic is 4.5, 7.3, 11.5, 18.4, 29.5 and 44.8 LEDs off centre (rms)
// after 16 to 512 rows, a fitted exponent of 0.666; the midpoint of a pinned
// one gives 0.677. On this panel, 64 wide, the geodesic from column 32 to
// column 32 has its midpoint 2.4, 3.6, 5.9 and 10.1 LEDs off centre over
// 16, 32, 64 and 128 rows, 0.695, where the random walk would be 4.6 at
// 128. The thermal cloud's mean width squared grows as L itself (2.1, 4.2,
// 8.3 and 19.7 at beta 1.3): most rows have one thin strand, and the width
// comes from the rare frames with two valleys of nearly equal free energy,
// the droplets of Daniel Fisher and David Huse (1991), L^(2/3) apart.
//
// The field turns as A cos t + Q sin t with A and Q independent standard
// Gaussian fields, which is again a standard Gaussian field at every t; at
// a quarter turn A carries no weight and is replaced by a fresh field.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, exp, log, sqrt, cos, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const X0 = 32, XE = 32;
const NEG = -1e30;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

function gauss() {
  const u = 1 - Math.random(), v = Math.random();
  return sqrt(-2 * log(u)) * cos(2 * PI * v);
}

function fresh(a) {
  for (let i = 0; i < N; i++) a[i] = gauss();
}

// log(exp(a) + exp(b) + exp(c)), with NEG as log 0.
function lse3(a, b, c) {
  if (a >= b && a >= c) return a <= NEG ? NEG : a + log(1 + exp(b - a) + exp(c - a));
  if (b >= c) return b + log(1 + exp(a - b) + exp(c - b));
  return c + log(1 + exp(a - c) + exp(b - c));
}

// Forward and backward log partition functions at inverse temperature
// beta, the passage probability P, and the geodesic; returns the backward
// and forward log Z and the geodesic's H for the check.
function solve(S, beta) {
  const { E, F, B, P, G, D, V, path } = S;
  for (let x = 0; x < W; x++) F[x] = x === X0 ? beta * E[x] : NEG;
  for (let y = 1; y < H; y++) {
    const o = y * W, p = o - W;
    for (let x = 0; x < W; x++) {
      const l = lse3(x > 0 ? F[p + x - 1] : NEG, F[p + x], x < W - 1 ? F[p + x + 1] : NEG);
      F[o + x] = l <= NEG ? NEG : l + beta * E[o + x];
    }
  }
  const last = (H - 1) * W;
  for (let x = 0; x < W; x++) B[last + x] = V[x] <= NEG ? NEG : beta * (E[last + x] + V[x]);
  for (let y = H - 2; y >= 0; y--) {
    const o = y * W, n = o + W;
    for (let x = 0; x < W; x++) {
      const l = lse3(x > 0 ? B[n + x - 1] : NEG, B[n + x], x < W - 1 ? B[n + x + 1] : NEG);
      B[o + x] = l <= NEG ? NEG : l + beta * E[o + x];
    }
  }
  const logZ = B[X0];
  for (let i = 0; i < N; i++) {
    const f = F[i], b = B[i];
    const a = f <= NEG || b <= NEG ? NEG : f + b - beta * E[i] - logZ;
    P[i] = a < S.cut ? 0 : exp(a);
  }
  let fz = NEG;
  for (let x = 0; x < W; x++) if (V[x] > NEG) fz = lse3(fz, F[last + x] + beta * V[x], NEG);
  // Last passage: the path of largest energy plus end potential.
  for (let x = 0; x < W; x++) G[x] = x === X0 ? E[x] : NEG;
  for (let y = 1; y < H; y++) {
    const o = y * W, p = o - W;
    for (let x = 0; x < W; x++) {
      let m = G[p + x], d = 0;
      if (x > 0 && G[p + x - 1] > m) { m = G[p + x - 1]; d = -1; }
      if (x < W - 1 && G[p + x + 1] > m) { m = G[p + x + 1]; d = 1; }
      G[o + x] = m <= NEG ? NEG : m + E[o + x];
      D[o + x] = d;
    }
  }
  let bx = XE, bv = NEG;
  for (let x = 0; x < W; x++) {
    if (V[x] <= NEG) continue;
    const v = G[last + x] + V[x];
    if (v > bv) { bv = v; bx = x; }
  }
  for (let y = H - 1, x = bx; y >= 0; y--) {
    path[y] = x;
    x += D[y * W + x];
  }
  return { logZ, fz, top: bv };
}

// Sets the end potential V from the End knob: pinned, a Gaussian window or free.
function endPotential(S, e) {
  const s = e < 0.08 || e >= 0.97 ? 0 : 60 * ((e - 0.08) / 0.89) ** 2;
  for (let x = 0; x < W; x++) S.V[x] = e >= 0.97 ? 0 : s === 0 ? (x === XE ? 0 : NEG) : -0.5 * ((x - XE) / s) ** 2;
}

export function setup(params) {
  const S = {
    hue: 0, speed: 2, beta: 1.3, phi: 0, ok: false, cut: NEG,
    A: new Float32Array(N), Q: new Float32Array(N), E: new Float32Array(N),
    F: new Float64Array(N), B: new Float64Array(N), P: new Float64Array(N), G: new Float64Array(N), D: new Int8Array(N),
    V: new Float64Array(W), path: new Int16Array(H), trail: new Float32Array(N),
  };
  params.s = S;
  fresh(S.A);
  fresh(S.Q);
  S.E.set(S.A);
  // The checks: rows sum to 1, forward and backward log Z agree, and the
  // cold limit brackets the geodesic.
  endPotential(S, 0);
  const r = solve(S, 1.3);
  let err = abs(r.fz - r.logZ);
  for (let y = 0; y < H; y++) {
    let sum = 0;
    for (let x = 0; x < W; x++) sum += S.P[y * W + x];
    err = max(err, abs(sum - 1));
  }
  const cold = solve(S, 40), gap = cold.logZ / 40 - cold.top;
  S.err = err;
  S.gap = gap;
  // From here on, a site the polymer passes less than once in 3,000 is left at 0.
  S.cut = -8;
  S.ok = err < 1e-9 && gap >= -1e-9 && gap <= (127 * log(3)) / 40;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.beta = 1.3 * exp(log(4) * cl(k[2] || 0, -1, 1));
  endPotential(S, cl(k[3] == null ? 0.06 : k[3], 0, 1));
  S.phi += d * 0.25 * S.speed;
  if (S.phi >= PI / 2) {
    S.phi -= PI / 2;
    const t = S.A;
    S.A = S.Q;
    S.Q = t;
    fresh(S.Q);
  }
  const c = cos(S.phi), s = sin(S.phi), E = S.E, A = S.A, Q = S.Q;
  for (let i = 0; i < N; i++) E[i] = A[i] * c + Q[i] * s;
  solve(S, S.beta);
  // Where the geodesic was: a trace that fades in 0.56 s at Speed 2.
  const fade = exp(-d * S.speed * 0.9), T = S.trail;
  for (let i = 0; i < N; i++) T[i] *= fade;
  for (let y = 0; y < H; y++) T[y * W + S.path[y]] = 1;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const h0 = 0.5 + S.hue;
  const cloud = hsv(h0, 0.75, 1), field = hsv(h0 + 0.2, 0.45, 1), line = hsv(h0 + 0.08, 0.12, 1);
  const { E, P, path, trail } = S;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // The energies: dim dots where E is above 0.7, 22 to 62 of 255.
      const f = E[i] > 0.7 ? 22 + cl((E[i] - 0.7) / 2, 0, 1) * 40 : 0;
      // The cloud: P^0.4, so a strand that holds a tenth of the polymer is still 100 of 255.
      const q = P[i], p = S.ok && q > 0.002 ? q ** 0.4 * 255 : 0;
      const t = path[y] === x ? 255 : trail[i] * 150;
      let r = field[0] * f + cloud[0] * p, g = field[1] * f + cloud[1] * p, b = field[2] * f + cloud[2] * p;
      r = r * (1 - t / 255) + line[0] * t;
      g = g * (1 - t / 255) + line[1] * t;
      b = b * (1 - t / 255) + line[2] * t;
      display.setPixel(x, y, round(cl(r, 0, 255)), round(cl(g, 0, 255)), round(cl(b, 0, 255)));
    }
}
