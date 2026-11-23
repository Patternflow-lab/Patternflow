// ===== Patternflow pattern =====
// Title:   Cavity Modes
// Family:  lasermode
// Idea:    The red light a laser cavity puts on a screen, a sum of Hermite-Gauss modes of one order whose phases drift against each other, so that a grid of lobes folds into bright loops, rings and spiral arms as a cylindrical-lens converter turns the grid into the donut modes.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Hermite-Gaussian and Laguerre-Gaussian resonator modes (Herwig Kogelnik and Tingye Li, 1966, from memory), the astigmatic mode converter that turns one into the other (M. W. Beijersbergen and colleagues, 1993, from memory), geometric modes of a degenerate cavity as spin coherent states (Yung-Fu Chen and Kai-Feng Huang, 2003, from memory), pattern round 225
// Round:   225
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Order=1..3, Converter=-1..1, Drift=-1..1
//
// Knob 1: Hue.
// Knob 2: Order.
// Knob 3: Converter.
// Knob 4: Drift.

const W = 64, H = 128, NPIX = W * H;
const { floor, sqrt, exp, sin, cos, pow, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

const NMIN = 2, NMAX = 18, KMAX = NMAX + 1;
const PI4 = pow(PI, -0.25), SQRT2 = sqrt(2);
// Tone map from the dark screen to the white-hot core: black, ruby, red, red-orange, orange, white.
const STOPS = [
  [0.0, 0, 0, 0],
  [0.12, 30, 0, 5],
  [0.32, 125, 0, 14],
  [0.52, 220, 12, 10],
  [0.72, 255, 78, 8],
  [0.88, 255, 160, 70],
  [1.0, 255, 238, 215],
];
const NPAL = 1024;

// Recurrence weights of the Hermite functions: phi(m+1) = A1 x phi(m) - A2 phi(m-1).
const A1 = new Float64Array(KMAX + 1), A2 = new Float64Array(KMAX + 1);
for (let m = 0; m <= KMAX; m++) {
  A1[m] = sqrt(2 / (m + 1));
  A2[m] = sqrt(m / (m + 1));
}

// The eigenvectors of Jx for the spin N/2 that the modes of order N make up, found by
// Jacobi sweeps once per order. Turning the converter by an angle is then
// V diag(exp(-i angle mu)) V^T, with mu running from -N/2 to N/2.
const jxCache = [];
function jxBasis(N) {
  if (jxCache[N]) return jxCache[N];
  const K = N + 1;
  const A = new Float64Array(K * K), V = new Float64Array(K * K);
  for (let k = 0; k < K; k++) V[k * K + k] = 1;
  for (let k = 0; k < N; k++) A[k * K + k + 1] = A[(k + 1) * K + k] = 0.5 * sqrt((N - k) * (k + 1));
  for (let sweep = 0; sweep < 40; sweep++) {
    let off = 0;
    for (let p = 0; p < K; p++) for (let q = p + 1; q < K; q++) off += A[p * K + q] * A[p * K + q];
    if (off < 1e-24) break;
    for (let p = 0; p < K; p++)
      for (let q = p + 1; q < K; q++) {
        const apq = A[p * K + q];
        if (abs(apq) < 1e-15) continue;
        const th = (A[q * K + q] - A[p * K + p]) / (2 * apq);
        const t = (th >= 0 ? 1 : -1) / (abs(th) + sqrt(th * th + 1));
        const c = 1 / sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < K; k++) {
          const a = A[k * K + p], b = A[k * K + q];
          A[k * K + p] = c * a - s * b;
          A[k * K + q] = s * a + c * b;
        }
        for (let k = 0; k < K; k++) {
          const a = A[p * K + k], b = A[q * K + k];
          A[p * K + k] = c * a - s * b;
          A[q * K + k] = s * a + c * b;
        }
        for (let k = 0; k < K; k++) {
          const a = V[k * K + p], b = V[k * K + q];
          V[k * K + p] = c * a - s * b;
          V[k * K + q] = s * a + c * b;
        }
      }
  }
  const order = [];
  for (let r = 0; r < K; r++) order.push(r);
  order.sort((a, b) => A[a * K + a] - A[b * K + b]);
  const S = new Float64Array(K * K);
  for (let r = 0; r < K; r++) for (let k = 0; k < K; k++) S[k * K + r] = V[k * K + order[r]];
  return (jxCache[N] = S);
}

function hsv(h, s, v) {
  h -= floor(h);
  const i = floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const k = i % 6;
  return [k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p, k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p, k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p];
}

// The palette, indexed by intensity over the peak, rebuilt when the hue knob moves.
function palette(P, h0) {
  P.hc = h0;
  for (let i = 0; i < NPAL; i++) {
    const x = i / (NPAL - 1), v = pow(x, 0.5);
    let s = 1;
    while (s < STOPS.length - 1 && STOPS[s][0] < v) s++;
    const a = STOPS[s - 1], b = STOPS[s], f = (v - a[0]) / (b[0] - a[0]);
    const r = (a[1] + (b[1] - a[1]) * f) / 255, g = (a[2] + (b[2] - a[2]) * f) / 255, bl = (a[3] + (b[3] - a[3]) * f) / 255;
    const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), d = mx - mn;
    let h = 0;
    if (d > 0) h = mx === r ? ((g - bl) / d + 6) % 6 : mx === g ? (bl - r) / d + 2 : (r - g) / d + 4;
    const c = hsv(h / 6 + h0, mx > 0 ? d / mx : 0, mx);
    P.pal[i * 3] = c[0] * 255;
    P.pal[i * 3 + 1] = c[1] * 255;
    P.pal[i * 3 + 2] = c[2] * 255;
  }
}

export function setup(params) {
  params.t = 0;
  params.tk = 7.3;
  params.tr = 3.1;
  params.phi = 0.9;
  params.cr = new Float64Array(KMAX);
  params.ci = new Float64Array(KMAX);
  params.dr = new Float64Array(KMAX);
  params.di = new Float64Array(KMAX);
  params.fx = new Float64Array(W * KMAX);
  params.fy = new Float64Array(H * KMAX);
  params.act = new Int32Array(KMAX);
  params.wr = new Float64Array(KMAX);
  params.wi = new Float64Array(KMAX);
  params.I = new Float32Array(NPIX);
  params.idx = new Uint16Array(NPIX);
  params.pal = new Float32Array(NPAL * 3);
  params.peak = 0;
  params.hc = -9;
}

// The state of the cavity at order N: amplitudes on the modes HG(N-k, k), k = 0..N,
// with a bell of width sigma about a centre k0 that wanders, a phase step of phi
// between neighbours (the Gouy phase difference of the two axes) and a chirp.
// Then the converter turns the whole thing by alpha.
function state(P, N, sigma, k0, kappa, ripple, alpha) {
  const K = N + 1, { cr, ci, dr, di } = P;
  let tot = 0;
  for (let k = 0; k < K; k++) {
    const d = k - k0;
    const rho = 0.35 + 0.5 * ((k * 0.6180339887) % 1), ph = TAU * ((k * 0.7548776662) % 1);
    const a = exp(-(d * d) / (4 * sigma * sigma)) * (1 + ripple * sin(rho * P.tr + ph));
    const f = k * P.phi + 0.5 * kappa * d * d;
    dr[k] = a * cos(f);
    di[k] = a * sin(f);
    tot += a * a;
  }
  const nrm = 1 / sqrt(tot);
  const V = jxBasis(N);
  for (let k = 0; k < K; k++) {
    cr[k] = 0;
    ci[k] = 0;
  }
  for (let r = 0; r < K; r++) {
    let sr = 0, si = 0;
    for (let l = 0; l < K; l++) {
      sr += V[l * K + r] * dr[l];
      si += V[l * K + r] * di[l];
    }
    const mu = r - N / 2, c = cos(alpha * mu), s = sin(alpha * mu);
    const tr = (sr * c + si * s) * nrm, ti = (si * c - sr * s) * nrm;
    for (let k = 0; k < K; k++) {
      cr[k] += V[k * K + r] * tr;
      ci[k] += V[k * K + r] * ti;
    }
  }
}

// Adds wt times the intensity of the field at order N to P.I.
function addField(P, N, wt, sx, sy) {
  const K = N + 1, { fx, fy, cr, ci, act, wr, wi, I } = P;
  for (let i = 0; i < W; i++) {
    const xi = (i - (W - 1) / 2) * sx, e = PI4 * exp(-0.5 * xi * xi), b = i * K;
    let p0 = e, p1 = SQRT2 * xi * e;
    fx[b + N] = p0;
    if (N >= 1) fx[b + N - 1] = p1;
    for (let m = 1; m < N; m++) {
      const p2 = A1[m] * xi * p1 - A2[m] * p0;
      fx[b + N - m - 1] = p2;
      p0 = p1;
      p1 = p2;
    }
  }
  for (let j = 0; j < H; j++) {
    const eta = (j - (H - 1) / 2) * sy, e = PI4 * exp(-0.5 * eta * eta), b = j * K;
    let p0 = e, p1 = SQRT2 * eta * e;
    fy[b] = p0;
    if (N >= 1) fy[b + 1] = p1;
    for (let m = 1; m < N; m++) {
      const p2 = A1[m] * eta * p1 - A2[m] * p0;
      fy[b + m + 1] = p2;
      p0 = p1;
      p1 = p2;
    }
  }
  let na = 0;
  for (let k = 0; k < K; k++) if (cr[k] * cr[k] + ci[k] * ci[k] > 1e-6) act[na++] = k;
  for (let j = 0; j < H; j++) {
    const yb = j * K;
    for (let a = 0; a < na; a++) {
      const k = act[a], g = fy[yb + k];
      wr[a] = cr[k] * g;
      wi[a] = ci[k] * g;
    }
    for (let i = 0; i < W; i++) {
      const xb = i * K;
      let re = 0, im = 0;
      for (let a = 0; a < na; a++) {
        const g = fx[xb + act[a]];
        re += wr[a] * g;
        im += wi[a] * g;
      }
      I[j * W + i] += wt * (re * re + im * im);
    }
  }
}

export function update(dt, input, P) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  const u = cl((kv[3] + 1) / 2, 0, 1);
  const s = 0.04 + 1.6 * pow(u, 1.6);
  P.t += d;
  P.tk += d * s;
  P.tr += d * s;
  P.phi += d * s * (0.9 + 0.4 * sin(0.37 * P.tk + 1.1) + 0.25 * sin(0.113 * P.tk + 4));
  const alpha = ((cl(kv[2], -1, 1) + 1) / 2) * (PI / 2);
  const Nc = cl(8 * kv[1] - 6, NMIN, NMAX);
  let nl = floor(Nc);
  const b = nl >= NMAX ? 0 : smooth((Nc - nl - 0.35) / 0.3);
  const sigma = 0.38 + 2.05 * u, ripple = 0.3;
  const tk = P.tk;
  const kappa = 0.55 * sin(0.77 * tk + 2) + 0.3 * sin(0.241 * tk + 0.4) + 0.15 * sin(1.31 * tk);
  const wob = 0.1 * sin(0.31 * tk + 0.9) + 0.05 * sin(0.53 * tk + 2.4) + 0.03 * sin(0.89 * tk + 4.1);
  const breathe = 1 + 0.025 * sin(0.41 * P.t + 1) + 0.015 * sin(0.173 * P.t);
  const asp = 1.45 + 0.55 * sin(alpha);
  P.I.fill(0);
  for (let pass = 0; pass < 2; pass++) {
    const wt = pass === 0 ? 1 - b : b, N = nl + pass;
    if (wt <= 0) continue;
    const R = sqrt(2 * N + 2), sy = (breathe * R) / 64, sx = asp * sy;
    state(P, N, sigma, N * (0.72 + wob), kappa, ripple, alpha);
    addField(P, N, wt, sx, sy);
  }
  let mx = 0;
  const { I } = P;
  for (let i = 0; i < NPIX; i++) if (I[i] > mx) mx = I[i];
  if (P.peak <= 0) P.peak = mx;
  else P.peak += (mx - P.peak) * (1 - exp(-d / (mx > P.peak ? 0.15 : 1.2)));
  const inv = (NPAL - 1) / (P.peak * 0.6);
  const { idx } = P;
  for (let i = 0; i < NPIX; i++) {
    const v = I[i] * inv;
    idx[i] = v >= NPAL - 1 ? NPAL - 1 : v | 0;
  }
  const h0 = kv[0];
  if (abs(h0 - P.hc) > 1e-4) palette(P, h0);
}

export function draw(display, P) {
  const { idx, pal } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = idx[y * W + x] * 3;
      display.setPixel(x, y, pal[o], pal[o + 1], pal[o + 2]);
    }
}
