// ===== Patternflow pattern =====
// Title:   Diffusion Front
// Family:  fractal
// Idea:    Every LED is a lattice site with a fixed random number and is occupied while that number is below the concentration of a dye diffusing up from the bottom row, erfc(h / 2 sqrt(Dt)); the occupied sites joined to the source glow pale cyan to deep blue with the concentration, a site that has just joined flashes white, islands not joined glow violet, and the cluster's outer boundary, the diffusion front, is drawn gold: a fractal hull that climbs as the square root of time and sits where the concentration is 0.5927, the percolation threshold, until the source shuts, the cluster is cut from it, the dye drains out and a fresh lattice starts.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: diffusion fronts and gradient percolation (Bernard Sapoval, Michel Rosso and Jean-François Gouyet, 1985), pattern round 50
// Round:   50
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Hop=0..1, Islands=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the cluster runs from pale cyan at the front to deep blue at the source, the front is gold and the islands violet; at 0.25 the cluster runs from grey violet to magenta, the front is mint and the islands brick red; at 0.5 the cluster runs from brown to amber, the front is pale blue and the islands olive; at 0.75 the cluster is green, the front pink and the islands teal.
// Knob 2: Speed. At 2 the front is 28 rows up after a quarter of a second, 55 after one second, 78 after two and 121 after 4.8, as the square root of time; it holds half a second, the source shuts and the dye drains for a second, so a run lasts 6.3 seconds. At 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Hop. How often each site draws a new random number. At 0 the lattice is frozen, the gradient percolation of one fixed lattice, and the front only climbs; at 0.5 each site draws again once a second on average and at 1 twice, so the occupied sites flicker like hopping particles, islands join the cluster and fall away, and the front shivers as it climbs.
// Knob 4: Islands. How bright the occupied sites that are not joined to the source glow. At 0 they are dark and only the cluster joined to the source shows; at the opening 0.06 they glow violet at 113 of 255, at 0.25 at 196 and at 1 at 237, nearly as bright as the front.
// Buttons: K1 tap starts a fresh lattice.

const W = 64, H = 128, N = W * H;
const { floor, exp, sqrt, abs, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// erfc(x) to 1.2e-7 (Numerical Recipes' Chebyshev fit).
function erfc(x) {
  const z = abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

// The front sits where p = 0.5927, at h = 0.3778 L with L = 2 sqrt(D t).
// A run grows L from L0 to L1 in GROW seconds (at Speed 2) with L^2 growing
// evenly in time, holds, shuts the source and drains for DRAIN seconds, then
// starts again on a fresh lattice.
const L1 = 320, L0 = 10, GROW = 4.8, HOLD = 0.5, DRAIN = 1.0, PC = 0.5927;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, hop: 0, isl: 0.06, c: 0, L: L0, runs: 0,
    u: new Float32Array(N), occ: new Uint8Array(N), A: new Uint8Array(N), B: new Uint8Array(N), hull: new Uint8Array(N),
    join: new Float32Array(N), q: new Int32Array(N), p: new Float64Array(H), glow: new Float32Array(N * 3), ease: 1,
    // Front sites and their mean height in rows, kept for checking the
    // front against the threshold.
    nHull: 0, hf: 0,
  };
  fresh(params.s);
}

function fresh(S) {
  for (let i = 0; i < N; i++) S.u[i] = Math.random();
  S.join.fill(-1);
  S.c = 0;
  S.runs++;
}

// Occupancy from p(h), the cluster joined to the source row (4-neighbour),
// the empty sites joined to the open top (8-neighbour), and the hull: the
// cluster's sites that touch that open emptiness.
function percolate(S) {
  const { u, occ, A, B, hull, q, p } = S;
  for (let y = 0; y < H; y++) {
    const py = p[y], o = y * W;
    for (let x = 0; x < W; x++) occ[o + x] = u[o + x] < py ? 1 : 0;
  }
  A.fill(0);
  let t = 0;
  for (let x = 0, o = (H - 1) * W; x < W; x++) if (occ[o + x]) (A[o + x] = 1), (q[t++] = o + x);
  for (let k = 0; k < t; k++) {
    const i = q[k], x = i % W;
    if (x > 0 && occ[i - 1] && !A[i - 1]) (A[i - 1] = 1), (q[t++] = i - 1);
    if (x < W - 1 && occ[i + 1] && !A[i + 1]) (A[i + 1] = 1), (q[t++] = i + 1);
    if (i >= W && occ[i - W] && !A[i - W]) (A[i - W] = 1), (q[t++] = i - W);
    if (i + W < N && occ[i + W] && !A[i + W]) (A[i + W] = 1), (q[t++] = i + W);
  }
  B.fill(0);
  t = 0;
  for (let x = 0; x < W; x++) if (!occ[x]) (B[x] = 1), (q[t++] = x);
  for (let k = 0; k < t; k++) {
    const i = q[k], x = i % W, y = (i - x) / W;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= H) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= W) continue;
        const j = yy * W + xx;
        if (!occ[j] && !B[j]) (B[j] = 1), (q[t++] = j);
      }
    }
  }
  let nh = 0, sh = 0;
  for (let i = 0; i < N; i++) {
    let f = 0;
    if (A[i]) {
      const x = i % W;
      f = i < W || (x > 0 && B[i - 1]) || (x < W - 1 && B[i + 1]) || B[i - W] || (i + W < N && B[i + W]) ? 1 : 0;
      if (f) (nh++), (sh += H - 1 - (i - x) / W);
    }
    hull[i] = f;
  }
  S.nHull = nh;
  S.hf = nh ? sh / nh : 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.hop = cl(k[2], 0, 1);
  S.isl = cl(k[3], 0, 1);
  const d = (cl(dt || 0, 0, 0.1) * S.speed) / 2;
  S.ease = 1 - exp(-d / 0.08);
  if (input.btnPressed && input.btnPressed[0]) fresh(S);
  S.c += d;
  if (S.c > GROW + HOLD + DRAIN) fresh(S);
  // L^2 = 4 D t grows evenly; once the source shuts at GROW + HOLD, the
  // profile is the same erfc less one started at the moment of shutting
  // (the source row held at zero from then on), so the source row empties
  // at once and the rest drains out through it.
  const K = (L1 * L1 - L0 * L0) / GROW, ts = GROW + HOLD;
  S.L = sqrt(L0 * L0 + K * S.c);
  const Ls = S.c > ts ? sqrt(K * (S.c - ts)) : 0;
  for (let y = 0; y < H; y++) {
    const h = H - 1 - y;
    S.p[y] = erfc(h / S.L) - (Ls > 0 ? erfc(h / Ls) : 0);
  }
  // Hop: each site draws a new random number at this rate a second.
  if (S.hop > 0) {
    const r = 1 - exp(-2 * S.hop * d);
    for (let i = 0; i < N; i++) if (Math.random() < r) S.u[i] = Math.random();
  }
  percolate(S);
  const { A, join } = S;
  for (let i = 0; i < N; i++) {
    if (A[i]) {
      if (join[i] < 0) join[i] = S.c;
    } else join[i] = -1;
  }
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return i === 0 ? [v, t, p] : i === 1 ? [q, v, p] : i === 2 ? [p, v, t] : i === 3 ? [p, q, v] : i === 4 ? [t, p, v] : [v, p, q];
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { occ, A, hull, join, p, glow } = S;
  const hu = S.hue;
  const front = hsv(hu + 0.12, 0.35, 1), flash = hsv(hu + 0.5, 0.05, 1), isl = hsv(hu + 0.78, 0.7, 1);
  const il = (255 * S.isl) / (S.isl + 0.075);
  for (let y = 0; y < H; y++) {
    // The cluster is lit by the concentration where it stands: dim at the
    // front, where p is near the threshold, bright near the source.
    const sy = pow(cl((p[y] - PC) / (1 - PC), 0, 1), 0.8), lv = 255 * (0.45 + 0.55 * sy);
    const c = hsv(hu + 0.5 + 0.12 * sy, 0.4 + 0.5 * sy, 1);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let r = 0, g = 0, b = 0;
      if (hull[i]) (r = 255 * front[0]), (g = 255 * front[1]), (b = 255 * front[2]);
      else if (A[i]) {
        // A site that has just joined flashes pale and settles in half a second.
        const a = cl((S.c - join[i]) / 0.5, 0, 1), v = 255 * (1 - a), w = lv * a;
        r = flash[0] * v + c[0] * w;
        g = flash[1] * v + c[1] * w;
        b = flash[2] * v + c[2] * w;
      } else if (occ[i]) (r = il * isl[0]), (g = il * isl[1]), (b = il * isl[2]);
      // Each LED eases towards its colour in about a tenth of a second, so a
      // cluster cut from the source sinks to island colour instead of
      // switching.
      const o = i * 3, e = S.ease;
      glow[o] += (r - glow[o]) * e;
      glow[o + 1] += (g - glow[o + 1]) * e;
      glow[o + 2] += (b - glow[o + 2]) * e;
      display.setPixel(x, y, glow[o], glow[o + 1], glow[o + 2]);
    }
  }
}
