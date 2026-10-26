// ===== Patternflow pattern =====
// Title:   Andrews Curves
// Family:  data
// Idea:    Forty synthetic points in five dimensions, three Gaussian clusters of 13 and one outlier, each become Andrews' curve f(t) = x1/sqrt 2 + x2 sin t + x3 cos t + x4 sin 2t + x5 cos 2t with t running down the panel, so the clusters hang as three braided bundles and the outlier strays, and as a grand tour turns the data the bundles twist past each other while the shaded gap between the outlier's white curve and its neighbour's keeps one root mean square, the fixed bar along the bottom.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Andrews plots (David F. Andrews, 1972), turned by the grand tour (Daniel Asimov, 1985), pattern round 56
// Round:   56
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Spread=0.12..0.6, Dims=5..9
//
// Knob 1: Hue. Turns the three clusters round the wheel together. At 0 they are cyan, violet and green; at 0.25 indigo, rose and cyan; at 0.5 rose, green and blue. The marked pair stays white with a grey gap, and the wheel skips orange and yellow, which read brown and olive on the faint edges of the curves.
// Knob 2: Speed. How fast the grand tour turns. At 2 each of the ten coordinate planes of five dimensions turns at its own rate between 0.10 and 0.20 radians a second, the rates linearly independent so the tour never repeats; 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Spread. Each cluster's standard deviation in every coordinate, as a share of R, the distance from the middle to a cluster centre; the centres stand R sqrt 3 = 1.73 R apart and the outlier 1.72 R from each. At 0.12 a point lies on average 0.26 R from its centre in five dimensions and the bundles are tight ropes; at 0.6 it lies 1.3 R off, the clusters overlap and the curves spread into one tangle.
// Knob 4: Dims. The data's dimension, 5 to 9; each two coordinates past the first add a harmonic, so the curves run to cos 2t at 5, cos 3t at 7 and cos 4t at 9 and the braids wind tighter. The clusters differ only in the first five coordinates, the rest is spread, and the gap's bar is 14.6 LEDs at 5, 12.6 at 7 and 11.3 at 9, held to three decimals through a minute of touring at each (the axis narrows as the dimension grows).

const W = 64, H = 128, NP = W * H;
const { floor, min, max, abs, sqrt, sin, cos, exp, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The data: three synthetic Gaussian clusters of PER points each in up to
// DMAX dimensions, and one outlier. Cluster centres sit R from the middle,
// 120 degrees apart, so any two are R sqrt 3 apart.
const DMAX = 9, PER = 13, NC = 3, N = NC * PER + 1, R = 1;
// Tour radians a second at Speed 1.
const RATE = 0.11;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Dim orange and yellow read brown and olive, so the wheel skips them.
const wheel = (h) => 0.18 + 0.85 * (h - 0.18 - floor(h - 0.18));

function gauss() {
  const u = Math.random() || 1e-9, v = Math.random();
  return sqrt(-2 * Math.log(u)) * cos(2 * PI * v);
}

export function setup(params) {
  // Two orthonormal directions in the first five coordinates carry the
  // triangle of centres; a third, square to both, carries the outlier.
  const basis = [];
  for (let k = 0; k < 3; k++) {
    const v = new Float64Array(DMAX);
    for (let i = 0; i < 5; i++) v[i] = gauss();
    for (const b of basis) {
      let d = 0;
      for (let i = 0; i < DMAX; i++) d += v[i] * b[i];
      for (let i = 0; i < DMAX; i++) v[i] -= d * b[i];
    }
    let n = 0;
    for (let i = 0; i < DMAX; i++) n += v[i] * v[i];
    for (let i = 0; i < DMAX; i++) v[i] /= sqrt(n);
    basis.push(v);
  }
  const centre = [], z = [];
  for (let c = 0; c < NC; c++) {
    const a = (2 * PI * c) / NC, v = new Float64Array(DMAX);
    for (let i = 0; i < DMAX; i++) v[i] = R * (cos(a) * basis[0][i] + sin(a) * basis[1][i]);
    centre.push(v);
  }
  // Each point keeps its own standard normal draw; Spread scales it.
  for (let p = 0; p < N; p++) {
    const v = new Float64Array(DMAX);
    for (let i = 0; i < DMAX; i++) v[i] = gauss();
    z.push(v);
  }
  // Asimov's torus method: every coordinate plane turns at its own rate,
  // the rates linearly independent over the rationals (fractional parts of
  // square roots of primes), so the product of turns wanders densely
  // through all rotations.
  const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151];
  const rate = [];
  for (let i = 0, k = 0; i < DMAX; i++) for (let j = i + 1; j < DMAX; j++, k++) rate.push([i, j, 0.3 + 0.7 * (sqrt(primes[k]) % 1)]);
  // Sines and cosines of each row's t, for the harmonics.
  const trig = new Float64Array(H * DMAX);
  for (let r = 0; r < H; r++) {
    const t = -PI + (2 * PI * (r + 0.5)) / H;
    trig[r * DMAX] = 1 / Math.SQRT2;
    for (let i = 1; i < DMAX; i++) {
      const k = (i + 1) >> 1;
      trig[r * DMAX + i] = i & 1 ? sin(k * t) : cos(k * t);
    }
  }
  // The outlier stands 1.4 R from the middle, square to the centres' plane,
  // and is marked together with the member of the first cluster nearest to
  // it at the opening Spread.
  const outlier = basis[2].map((x) => 1.4 * R * x);
  let near = 0, best = 1e9;
  for (let p = 0; p < PER; p++) {
    let d2 = 0;
    for (let i = 0; i < 5; i++) d2 += (centre[0][i] + 0.12 * z[p][i] - outlier[i]) ** 2;
    if (d2 < best) (best = d2), (near = p);
  }
  params.s = {
    centre, z, outlier, rate, trig, tau: 0,
    hue: 0, speed: 2, spread: 0.12, d: 5,
    Q: new Float64Array(DMAX * DMAX), x: new Float64Array(N * DMAX), y: new Float64Array(N * DMAX),
    f: new Float32Array(N * H), acc: new Float32Array(NP * 3), col: new Float32Array(NC * 3 + 3), pair: [near, N - 1],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0.12, 5], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.spread = cl(kv[2], 0.12, 0.6);
  S.d = cl(round(kv[3]), 5, DMAX);
  S.tau += d * S.speed * RATE;
}

// The tour's rotation of the first D coordinates at time tau: the turns of
// every plane among them, taken in a fixed order.
function tour(S, D) {
  const Q = S.Q;
  Q.fill(0);
  for (let i = 0; i < D; i++) Q[i * DMAX + i] = 1;
  for (const [i, j, w] of S.rate) {
    if (j >= D) continue;
    const a = w * S.tau, c = cos(a), s = sin(a);
    for (let k = 0; k < D; k++) {
      const qi = Q[i * DMAX + k], qj = Q[j * DMAX + k];
      Q[i * DMAX + k] = c * qi - s * qj;
      Q[j * DMAX + k] = s * qi + c * qj;
    }
  }
}

// Splat a point onto its four nearest LEDs, adding colour c scaled by a.
function splat(acc, x, y, c, o, a) {
  const fx = x - 0.5, fy = y - 0.5, ix = floor(fx), iy = floor(fy), tx = fx - ix, ty = fy - iy;
  for (let dy = 0; dy < 2; dy++) {
    const yy = iy + dy;
    if (yy < 0 || yy >= H) continue;
    const wy = dy ? ty : 1 - ty;
    for (let dx = 0; dx < 2; dx++) {
      const xx = ix + dx;
      if (xx < 0 || xx >= W) continue;
      const w = (dx ? tx : 1 - tx) * wy * a, p = (yy * W + xx) * 3;
      acc[p] += c[o] * w;
      acc[p + 1] += c[o + 1] * w;
      acc[p + 2] += c[o + 2] * w;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const D = S.d, { x, y, f, acc, trig, Q, col } = S;
  // The observations in their own coordinates.
  for (let p = 0; p < N; p++)
    for (let i = 0; i < DMAX; i++) {
      const base = p < NC * PER ? S.centre[floor(p / PER)][i] + S.spread * S.z[p][i] : S.outlier[i];
      x[p * DMAX + i] = i < D ? base : 0;
    }
  tour(S, D);
  for (let p = 0; p < N; p++)
    for (let i = 0; i < D; i++) {
      let v = 0;
      for (let k = 0; k < D; k++) v += Q[i * DMAX + k] * x[p * DMAX + k];
      y[p * DMAX + i] = v;
    }
  // Andrews' curves: f(t) = y1 / sqrt 2 + y2 sin t + y3 cos t + y4 sin 2t + ...
  // By Cauchy-Schwarz |f| is at most |y| sqrt(D / 2), and a turn keeps |y|,
  // so the axis is fixed for each D: R sqrt(D / 2), the most a centre's
  // curve can reach, is 22 LEDs either side of the middle.
  const sc = 22 / (R * sqrt(D / 2));
  for (let p = 0; p < N; p++)
    for (let r = 0; r < H; r++) {
      let v = 0;
      for (let i = 0; i < D; i++) v += y[p * DMAX + i] * trig[r * DMAX + i];
      f[p * H + r] = W / 2 + v * sc;
    }
  // Cyan, violet and green at Hue 0.
  for (let c = 0; c < NC; c++) hsv(wheel(0.58 + S.hue + [0, 0.27, 0.73][c]), 0.8, 1, col, c * 3);
  col[9] = col[10] = col[11] = 1;
  acc.fill(0);
  const [pa, pb] = S.pair;
  // The gap between the two marked curves, shaded faintly.
  for (let r = 0; r < H; r++) {
    const a = f[pa * H + r], b = f[pb * H + r], lo = max(0, Math.ceil(min(a, b))), hi = min(W - 1, floor(max(a, b)));
    for (let c = lo; c <= hi; c++) {
      const o = (r * W + c) * 3;
      acc[o] += 0.1;
      acc[o + 1] += 0.1;
      acc[o + 2] += 0.12;
    }
  }
  for (let p = 0; p < N; p++) {
    const ci = p < NC * PER ? floor(p / PER) * 3 : 9, mark = p === pa || p === pb;
    const a = mark ? 0.7 : 0.2;
    for (let r = 0; r + 1 < H; r++) {
      const xa = f[p * H + r], xb = f[p * H + r + 1], len = Math.hypot(xb - xa, 1), m = Math.ceil(len * 3);
      for (let e = 0; e < m; e++) splat(acc, xa + ((xb - xa) * e) / m, r + 0.5 + e / m, col, mark ? 9 : ci, ((a * len) / m) * 3);
    }
  }
  // Parseval: the mean of (f_x - f_y)^2 over t is |x - y|^2 / 2, and a
  // turn keeps |x - y|, so the gap's root mean square over the 128 rows
  // (exact for these few harmonics) never moves while the curves do. It is
  // measured from the drawn curves each frame and laid as a bar, that many
  // LEDs long, across the bottom two rows with a dark row above.
  let ss = 0;
  for (let r = 0; r < H; r++) ss += (f[pa * H + r] - f[pb * H + r]) ** 2;
  const half = sqrt(ss / H) / 2;
  for (let c = 0; c < W; c++) {
    const e = half - abs(c + 0.5 - W / 2);
    if (e < -2) continue;
    for (let r = H - 3; r < H; r++) {
      const o = (r * W + c) * 3;
      acc[o] = acc[o + 1] = acc[o + 2] = r === H - 3 ? 0 : cl(e + 0.5, 0, 1);
    }
  }
  // Where curves pile up the light saturates on the brightest channel and
  // the others follow in proportion, so a dense bundle glows in its own
  // colour instead of washing to white.
  for (let p = 0, o = 0; p < NP; p++, o += 3) {
    const m = max(acc[o], acc[o + 1], acc[o + 2]), k = m > 0 ? (255 * (1 - exp(-2.2 * m))) / m : 0;
    display.setPixel(p % W, (p / W) | 0, (acc[o] * k) | 0, (acc[o + 1] * k) | 0, (acc[o + 2] * k) | 0);
  }
}
