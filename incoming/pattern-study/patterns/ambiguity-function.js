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

const CELL0 = 800;          // LED^2 per unit of time x bandwidth, at its centre
const MAXN = 9;             // chips in the train, at most

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
// The chips sit at t = (n >> 1) P + (n & 1) T1: two interleaved trains of period P, the odd one T1 late.
// Pairs of chips then fall into three sets by their offset: 0 (even-even and odd-odd), +T1 and -T1 (even-odd and odd-even),
// each on a lattice of period P. T1 = P / 2 is the plain train of spacing P / 2.
const KP = 4, NKP = 2 * KP + 1, NSET = 3, NT = NSET * NKP;
const TRE = new Float64Array(NT * CW), TIM = new Float64Array(NT * CW);
const H0R = new Float64Array(NT), H0I = new Float64Array(NT), USED = new Uint8Array(NT);
const P3 = new Float64Array(CW), RE = new Float64Array(CW), IM = new Float64Array(CW);
const PW = new Float64Array(CW * CH);
const SL = new Float32Array(W * H);
const CR = new Float64Array(MAXN), CI = new Float64Array(MAXN), TN = new Float64Array(MAXN);
const ER = new Float64Array(MAXN), EI = new Float64Array(MAXN);
const NPAIR = MAXN * MAXN;
const PIX = new Int32Array(NPAIR), PA = new Int32Array(NPAIR), PB = new Int32Array(NPAIR), PWR2 = new Float64Array(NPAIR), PWI2 = new Float64Array(NPAIR);

// power of the ambiguity function of a train of chirped Gaussian chips, normalised to 1 at the origin (ox, oy), in corner coordinates
function field(N, P, rho, t0, sh, q, tp, ox, oy, CELL) {
  const c = ((PI * t0 * t0) / CELL) * sh;   // chip chirp, set so that the ridge leans at the slope sh
  const m = min(MAXN, ceil(N - 0.5 - 1e-9));
  const t02 = t0 * t0, g1 = 1 + c * c, T1 = rho * P;
  for (let n = 0; n < m; n++) {
    const hs = sin((PI * (n + 0.5)) / N), w = 1 - tp + tp * hs * hs, ph = PI * q * n * n;
    CR[n] = w * cos(ph); CI[n] = w * sin(ph);
    TN[n] = (n >> 1) * P + (n & 1) * T1;
  }
  // c_n conj(c_m) for every ordered pair, filed under its set and its lag
  USED.fill(0); H0R.fill(0); H0I.fill(0); TRE.fill(0); TIM.fill(0);
  let np = 0;
  for (let n = 0; n < m; n++)
    for (let l = 0; l < m; l++) {
      const e = (n & 1) - (l & 1), idx = (e === 0 ? 0 : e === 1 ? 1 : 2) * NKP + ((n >> 1) - (l >> 1)) + KP;
      const wr = CR[n] * CR[l] + CI[n] * CI[l], wi = CI[n] * CR[l] - CR[n] * CI[l];
      PIX[np] = idx; PA[np] = n; PB[np] = l; PWR2[np] = wr; PWI2[np] = wi; np++;
      USED[idx] = 1; H0R[idx] += wr; H0I[idx] += wi;
    }
  // the value at the origin, which is the energy of the waveform
  let e0r = 0, e0i = 0;
  for (let s = 0; s < NSET; s++) {
    const off = s === 0 ? 0 : s === 1 ? T1 : -T1;
    for (let k = -KP; k <= KP; k++) {
      const idx = s * NKP + k + KP;
      if (!USED[idx]) continue;
      const d = k * P + off, A = exp((-g1 * d * d) / (2 * t02));
      e0r += A * H0R[idx]; e0i += A * H0I[idx];
    }
  }
  const inv = 1 / (e0r * e0r + e0i * e0i);
  const kx = (PI * t02) / CELL, w1 = PI / CELL;
  for (let i = 0; i < CW; i++) {
    const yc = i - ox, xi = kx * yc;
    P3[i] = exp((-xi * xi) / (2 * t02));
    for (let n = 0; n < m; n++) { ER[n] = cos(w1 * yc * TN[n]); EI[n] = sin(w1 * yc * TN[n]); }
    for (let p = 0; p < np; p++) {
      const a = PA[p], b = PB[p], er = ER[a] * ER[b] - EI[a] * EI[b], ei = ER[a] * EI[b] + EI[a] * ER[b];
      const o = PIX[p] * CW + i;
      TRE[o] += PWR2[p] * er - PWI2[p] * ei; TIM[o] += PWR2[p] * ei + PWI2[p] * er;
    }
  }
  const beta = (c * PI) / CELL, reach = 3.75 * t0;
  for (let j = 0; j < CH; j++) {
    const yr = j - oy;
    RE.fill(0); IM.fill(0);
    for (let s = 0; s < NSET; s++) {
      const off = s === 0 ? 0 : s === 1 ? T1 : -T1;
      for (let kk = max(-KP, ceil((yr - off - reach) / P)); kk <= min(KP, floor((yr - off + reach) / P)); kk++) {
        const idx = s * NKP + kk + KP;
        if (!USED[idx]) continue;
        const u = yr - kk * P - off;
        const P1 = exp((-g1 * u * u) / (2 * t02));
        const rate = exp(-beta * u);
        let p2 = P1 * exp(beta * u * ox);
        const row = idx * CW;
        for (let i = 0; i < CW; i++) {
          const a = p2 * P3[i];
          RE[i] += a * TRE[row + i]; IM[i] += a * TIM[row + i];
          p2 *= rate;
        }
      }
    }
    const base = j * CW;
    for (let i = 0; i < CW; i++) PW[base + i] = (RE[i] * RE[i] + IM[i] * IM[i]) * inv;
  }
}

// ---------------------------------------------------------------- state
export function setup(params) {
  const ph = [];
  for (let i = 0; i < 48; i++) ph.push(TAU * Math.random());
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
  S.t += d * 1.6;
}

const LDB = 40, PWR = 0.62;
// the floor: three plane waves of level, drawn
const FX = new Float64Array(3 * W * 2), FY = new Float64Array(3 * H * 2);
const FOG = new Float64Array(W * H);
function fog(T, p) {
  for (let w = 0; w < 3; w++) {
    const lam = [34, 47, 61][w] * (1 + 0.2 * sin((TAU * T) / (79 + 11 * w) + p[30 + w]));
    const th = p[33 + w] + 0.7 * sin((TAU * T) / (97 + 13 * w) + p[36 + w]), ph = p[39 + w] + (TAU * T) / (43 + 9 * w) * (w & 1 ? -1 : 1);
    const kx = (TAU / lam) * cos(th), ky = (TAU / lam) * sin(th);
    for (let x = 0; x < W; x++) { FX[(w * W + x) * 2] = sin(kx * (x - 32) + ph); FX[(w * W + x) * 2 + 1] = cos(kx * (x - 32) + ph); }
    for (let y = 0; y < H; y++) { FY[(w * H + y) * 2] = sin(ky * (y - 64)); FY[(w * H + y) * 2 + 1] = cos(ky * (y - 64)); }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let w = 0; w < 3; w++) s += FX[(w * W + x) * 2] * FY[(w * H + y) * 2 + 1] + FX[(w * W + x) * 2 + 1] * FY[(w * H + y) * 2];
      FOG[y * W + x] = exp(0.23026 * (FOGL + FOGA * s));
    }
}
let FOGL = -28.5, FOGA = 3.2;

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const T = S.t, k = S.k, p = S.ph;
  const sn = (per, i) => sin((TAU * T) / per + p[i]);
  const hue = k[0] + 0.06 * sn(97, 16) + 0.03 * sn(53.7, 17);
  if (abs(S.hue - hue) > 0.0005) { buildRamp(hue); S.hue = hue; }

  const Nk = 3.2 + 1.0 * cl(k[1], 0, 4);
  const N = cl(1.9 + (Nk - 1.9) * (0.1 + 0.9 * (0.5 + 0.38 * sn(53, 0) + 0.2 * sn(29, 1))), 1.2, MAXN - 0.6);
  const sh = 1.2 * k[2] + 1.8 * sn(41, 2) + 0.9 * sn(23.7, 3);
  const Tp = 38 * pow(2, 0.8 * k[3]) * (1 + 0.28 * sn(37, 4) + 0.14 * sn(59, 5));
  const r = 0.32 + 0.1 * sn(47, 6) + 0.05 * sn(71, 7);
  const q = 0.4 * k[2] + 0.26 * sn(61, 8) + 0.14 * sn(31, 9);
  const tp = 0.8 + 0.14 * sn(79, 10) + 0.06 * sn(19, 11);
  const ox = 32 + 14 * sn(83, 12) + 6 * sn(47.3, 13), oy = 64 + 30 * sn(101, 14) + 12 * sn(61.7, 15);
  const cell = CELL0 * pow(2, 0.6 * sn(67, 18) + 0.4 * sn(39.3, 19));
  const rho = 0.5 - 0.22 * sm(0.2, 0.8, 0.5 + 0.4 * sn(73, 20) + 0.3 * sn(37.7, 21));
  fog(T, p);
  render(display, N, 2 * Tp, rho, Tp * r, sh, q, tp, ox, oy, cell);
}

function render(display, N, P, rho, t0, sh, q, tp, ox, oy, cell) {
  field(N, P, rho, t0, sh, q, tp, ox, oy, cell);
  const sc = 1 / LDB;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = y * CW + x;
      const pw = 0.25 * (PW[a] + PW[a + 1] + PW[a + CW] + PW[a + CW + 1]) + FOG[y * W + x];
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
