// ===== Patternflow pattern =====
// Title:   Ambiguity Function
// Family:  ambiguity
// Idea:    draft
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft, original code, pattern round 275
// Round:   275
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pulses=0..4, Chirp=-1..1, Scale=-1..1
//
// Knob 1: Hue. draft
// Knob 2: Pulses. draft
// Knob 3: Chirp. draft
// Knob 4: Scale. draft

const W = 64, H = 128, CW = W + 1, CH = H + 1;
const { floor, ceil, round, sqrt, exp, log, sin, cos, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

const CELL = 800;           // LED^2 per unit of time x bandwidth
const MAXN = 9;             // chips in the train, at most
const KM = MAXN - 1;
const NK = 2 * KM + 1;

// ---------------------------------------------------------------- colour
function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
const RAMP = [
  [0.665, 0.82, 0.34, 0],
  [0.640, 0.88, 0.44, 0],
  [0.600, 0.92, 0.54, 1],
  [0.545, 0.92, 0.62, 1],
  [0.490, 0.88, 0.70, 1],
  [0.390, 0.78, 0.80, 1],
  [0.225, 0.72, 0.92, 1],
  [0.170, 0.12, 1.00, 1],
];
const NB = RAMP.length;
const COL = new Float64Array(NB * 3), CUM = new Float64Array((NB + 1) * 3);
function buildRamp(hue) {
  const o = [0, 0, 0];
  for (let b = 0; b < NB; b++) {
    const R = RAMP[b];
    hsv(R[0] + hue * R[3], R[1], R[2], o);
    COL[b * 3] = o[0] * 255; COL[b * 3 + 1] = o[1] * 255; COL[b * 3 + 2] = o[2] * 255;
  }
  for (let b = 0; b < NB; b++) for (let c = 0; c < 3; c++) CUM[(b + 1) * 3 + c] = CUM[b * 3 + c] + COL[b * 3 + c];
}
const IC = [0, 0, 0];
function cumAt(s) {
  // the integral of the staircase of band colours from 0 to s; the first and last colours run on past the ends
  let b = s < 0 ? 0 : s >= NB ? NB - 1 : s | 0;
  const f = s - b;
  IC[0] = CUM[b * 3] + COL[b * 3] * f;
  IC[1] = CUM[b * 3 + 1] + COL[b * 3 + 1] * f;
  IC[2] = CUM[b * 3 + 2] + COL[b * 3 + 2] * f;
}

// ---------------------------------------------------------------- the field
const TRE = new Float64Array(NK * CW), TIM = new Float64Array(NK * CW);
const P3 = new Float64Array(CW), RE = new Float64Array(CW), IM = new Float64Array(CW);
const PW = new Float64Array(CW * CH);
const SL = new Float32Array(W * H);
const CR = new Float64Array(MAXN), CI = new Float64Array(MAXN);
const PR = new Float64Array(NK * MAXN), PI2 = new Float64Array(NK * MAXN);
const ER = new Float64Array(MAXN), EI = new Float64Array(MAXN);

// power of the ambiguity function of a train of chirped Gaussian chips, normalised to 1 at the origin
function field(N, T, t0, sh, q, tp) {
  const c = ((PI * t0 * t0) / CELL) * sh;   // chip chirp, set so that the ridge leans at the slope sh
  const m = min(MAXN, ceil(N - 0.5 - 1e-9));
  const t02 = t0 * t0;
  // chip amplitudes and phases
  let en = 0;
  for (let n = 0; n < m; n++) {
    const hs = sin((PI * (n + 0.5)) / N), w = 1 - tp + tp * hs * hs, ph = PI * q * n * n;
    CR[n] = w * cos(ph); CI[n] = w * sin(ph);
    en += w * w;
  }
  // c_n conj(c_{n-k}) for every lag k
  for (let k = -(m - 1); k <= m - 1; k++)
    for (let n = max(0, k); n <= min(m - 1, m - 1 + k); n++) {
      const a = CR[n], b = CI[n], cc = CR[n - k], d = CI[n - k], o = (k + KM) * MAXN + n;
      PR[o] = a * cc + b * d; PI2[o] = b * cc - a * d;
    }
  const kx = (PI * t02) / CELL, a1 = (PI * T) / CELL;
  for (let i = 0; i < CW; i++) {
    const yc = i - 32, xi = kx * yc;
    P3[i] = exp((-xi * xi) / (2 * t02));
    const a = a1 * yc; // nu T
    for (let n = 0; n < m; n++) { ER[n] = cos(TAU * a * n); EI[n] = sin(TAU * a * n); }
    const cb = cos(PI * a), sb = sin(PI * a);
    for (let k = -(m - 1); k <= m - 1; k++) {
      let sr = 0, si = 0;
      const o0 = (k + KM) * MAXN;
      for (let n = max(0, k); n <= min(m - 1, m - 1 + k); n++) {
        const pr = PR[o0 + n], pi = PI2[o0 + n];
        sr += pr * ER[n] - pi * EI[n]; si += pr * EI[n] + pi * ER[n];
      }
      // times e^{-j pi k nu T}
      const ph = -PI * k * a, rr = cos(ph), ri = sin(ph);
      TRE[(k + KM) * CW + i] = sr * rr - si * ri;
      TIM[(k + KM) * CW + i] = sr * ri + si * rr;
    }
  }
  // energy: the value at the origin
  let e0r = 0, e0i = 0;
  const g1 = 1 + c * c;
  for (let k = -(m - 1); k <= m - 1; k++) {
    const A = exp((-g1 * k * k * T * T) / (2 * t02));
    e0r += A * TRE[(k + KM) * CW + 32]; e0i += A * TIM[(k + KM) * CW + 32];
  }
  const inv = 1 / (e0r * e0r + e0i * e0i);
  const beta = (c * PI) / CELL;
  for (let j = 0; j <= 64; j++) {
    const yr = j - 64, reach = 3.75 * t0;
    RE.fill(0); IM.fill(0);
    for (let kk = max(-(m - 1), ceil((yr - reach) / T)); kk <= min(m - 1, floor((yr + reach) / T)); kk++) {
      const u = yr - kk * T;
      const P1 = exp((-g1 * u * u) / (2 * t02));
      const rate = exp(-beta * u);
      let p2 = P1 * exp(beta * u * 32);
      const row = (kk + KM) * CW;
      for (let i = 0; i < CW; i++) {
        const a = p2 * P3[i];
        RE[i] += a * TRE[row + i]; IM[i] += a * TIM[row + i];
        p2 *= rate;
      }
    }
    const base = j * CW;
    for (let i = 0; i < CW; i++) PW[base + i] = (RE[i] * RE[i] + IM[i] * IM[i]) * inv;
  }
  // point symmetry about the origin at corner (32, 64)
  for (let j = 0; j < 64; j++)
    for (let i = 0; i < CW; i++) PW[(128 - j) * CW + (64 - i)] = PW[j * CW + i];
}

// ---------------------------------------------------------------- state
export function setup(params) {
  const ph = [];
  for (let i = 0; i < 40; i++) ph.push(TAU * Math.random());
  params.s = { t: 0, k: null, ph, hue: -9 };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  S.t += d;
}

const LDB = 40, PWR = 0.62;

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const T = S.t, k = S.k, p = S.ph;
  const sn = (per, i) => sin((TAU * T) / per + p[i]);
  if (abs(S.hue - k[0]) > 0.0005) { buildRamp(k[0]); S.hue = k[0]; }

  const Nk = 2.2 + 1.2 * cl(k[1], 0, 4);
  const N = cl(1.9 + (Nk - 1.9) * (0.3 + 1.4 * (0.5 + 0.34 * sn(53, 0) + 0.16 * sn(29, 1))), 1.2, MAXN - 0.6);
  const sh = 2 * k[2] + 1.6 * sn(41, 2) + 0.8 * sn(23.7, 3);
  const Tp = 38 * pow(2, 0.8 * k[3]) * (1 + 0.2 * sn(37, 4) + 0.1 * sn(59, 5));
  const r = 0.3 + 0.08 * sn(47, 6) + 0.04 * sn(71, 7);
  const q = 0.4 * k[2] + 0.2 * sn(61, 8) + 0.1 * sn(31, 9);
  const tp = 0.86 + 0.08 * sn(79, 10) + 0.04 * sn(19, 11);
  render(display, N, Tp, Tp * r, sh, q, tp);
}

function render(display, N, Tp, t0, sh, q, tp) {
  field(N, Tp, t0, sh, q, tp);
  const sc = 1 / LDB;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = y * CW + x;
      const pw = 0.25 * (PW[a] + PW[a + 1] + PW[a + CW] + PW[a + CW + 1]);
      const L = pw > 1e-5 ? 4.3429 * log(pw) : -50;
      SL[y * W + x] = NB * (1 - pow(cl(-L, 0, LDB) * sc, PWR));
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = y * W + x;
      const xl = x > 0 ? a - 1 : a, xr = x < W - 1 ? a + 1 : a, yu = y > 0 ? a - W : a, yd = y < H - 1 ? a + W : a;
      const gx = 0.5 * (SL[xr] - SL[xl]), gy = 0.5 * (SL[yd] - SL[yu]);
      const h = max(0.04, 0.75 * sqrt(gx * gx + gy * gy));
      const s = SL[a];
      cumAt(s + h);
      const r1 = IC[0], g1 = IC[1], b1 = IC[2];
      cumAt(s - h);
      const inv = 1 / (2 * h);
      display.setPixel(
        x, y,
        cl(((r1 - IC[0]) * inv + 0.5) | 0, 0, 255),
        cl(((g1 - IC[1]) * inv + 0.5) | 0, 0, 255),
        cl(((b1 - IC[2]) * inv + 0.5) | 0, 0, 255)
      );
    }
}
