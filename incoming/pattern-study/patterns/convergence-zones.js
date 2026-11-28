// ===== Patternflow pattern =====
// Title:   Convergence Zones
// Family:  soundchannel
// Idea:    PLACEHOLDER
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: PLACEHOLDER original code, pattern round 274
// Round:   274
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Source=0..4, Channel=-1..1, Pitch=-1..1
//
// Knob 1: PLACEHOLDER
// Knob 2: PLACEHOLDER
// Knob 3: PLACEHOLDER
// Knob 4: PLACEHOLDER

const W = 64, H = 128;
const { floor, sqrt, exp, sin, cos, min, max, abs, log, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ------------------------------------------------------------------ the sea
const ND = 128;            // depth samples, one per LED row
const N = 2 * ND;          // the odd extension that makes the surface a pressure release
const LG = 8;              // log2 N
const ZMAX = 5000;         // m, the bottom of the grid and of the panel
const DZ = ZMAX / ND;      // 39.06 m a row
const C0 = 1500;           // m/s, the reference speed (the speed on the axis)
const BW = 1300;           // m, the Munk scale depth
const ZAX = 1300;          // m, the axis
const EPS0 = 0.00737;      // Munk's canonical strength
const RANGE = 150000;      // m across the 64 columns
const IWA = 0.002;        // internal-wave amplitude in sound speed over c
const NSTEP = 256;         // range steps, four a column
const ZABS = 4650;         // m, where the absorbing bottom begins
const SPF = 96;            // range steps a frame
const TS = 1.3;            // how fast the sea wanders
const NMAX = 160;          // steps the window can slide, 94 km
const DR = RANGE / NSTEP;  // m a step, 586
const NF = 3;              // frequencies averaged
const QF = (NSTEP * NF) / SPF; // frames to a solve, at least
const LREF = 1000;         // m, the depth over which an even spread would read 0 dB

// ------------------------------------------------------------------ fft without the bit reversal
const TWR = new Float64Array(N / 2), TWI = new Float64Array(N / 2);
for (let i = 0; i < N / 2; i++) {
  TWR[i] = cos((-TAU * i) / N);
  TWI[i] = sin((-TAU * i) / N);
}
const REV = new Uint16Array(N);
for (let i = 0; i < N; i++) {
  let r = 0;
  for (let b = 0; b < LG; b++) if (i & (1 << b)) r |= 1 << (LG - 1 - b);
  REV[i] = r;
}
// decimation in frequency: natural order in, bit reversed out
function fftF(re, im) {
  for (let len = N; len >= 2; len >>= 1) {
    const half = len >> 1, step = N / len;
    for (let i = 0; i < N; i += len) {
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half, wr = TWR[k * step], wi = TWI[k * step];
        const dr = re[a] - re[b], di = im[a] - im[b];
        re[a] += re[b];
        im[a] += im[b];
        re[b] = dr * wr - di * wi;
        im[b] = dr * wi + di * wr;
      }
    }
  }
}
// decimation in time, conjugate twiddles: bit reversed in, natural out (no 1/N: the filter carries it)
function fftI(re, im) {
  for (let len = 2; len <= N; len <<= 1) {
    const half = len >> 1, step = N / len;
    for (let i = 0; i < N; i += len) {
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half, wr = TWR[k * step], wi = -TWI[k * step];
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

const TB = 4096;
const TCOS = new Float64Array(TB), TSIN = new Float64Array(TB);
for (let i = 0; i < TB; i++) {
  TCOS[i] = cos((TAU * i) / TB);
  TSIN[i] = sin((TAU * i) / TB);
}
const NM = 4;              // internal-wave modes
const MV = [6, 9, 13, 19], ML = [38000, 26000, 17000, 12000], MT = [83, 57, 41, 29], MA = [1, 0.8, 0.7, 0.6];
const VM = [];
for (let i = 0; i < NM; i++) VM.push(new Float64Array(ND));
const EZ = new Float64Array(ND), ZC = new Float64Array(ND), GZ1 = new Float64Array(ND), GZ2 = new Float64Array(ND), GZ3 = new Float64Array(ND); // exp(-2 z / B), the depths, the depth shapes of the eddies
for (let j = 0; j < ND; j++) {
  ZC[j] = (j + 0.5) * DZ;
  EZ[j] = exp((-2 * ZC[j]) / BW);
  GZ1[j] = exp(-((ZC[j] - 600) * (ZC[j] - 600)) / (2 * 450 * 450));
  GZ2[j] = exp(-((ZC[j] - 1700) * (ZC[j] - 1700)) / (2 * 700 * 700));
  GZ3[j] = exp(-((ZC[j] - 1000) * (ZC[j] - 1000)) / (2 * 380 * 380));
  for (let i = 0; i < NM; i++) VM[i][j] = sin((PI * MV[i] * ZC[j]) / ZMAX) * exp(-ZC[j] / 1800);
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const ph = [];
  for (let i = 0; i < 40; i++) ph.push(TAU * Math.random());
  ph[0] = -0.5 * PI - 0.5 + 1.0 * Math.random(); // start with the source shallow
  ph[1] = -0.3 + 0.6 * Math.random();
  ph[2] = -0.3 + 0.6 * Math.random();
  ph[33] = -0.5 * PI + 0.1 * Math.random();
  ph[34] = -0.5 * PI + 0.1 * Math.random();
  ph[5] = 0.3 * Math.random();
  ph[6] = 0.3 * Math.random();
  ph[21] = 0.3 * Math.random();
  params.s = {
    t: 0,
    k: null,
    ph,
    re: new Float64Array(N), im: new Float64Array(N),
    vr: new Float64Array(N), vi: new Float64Array(N),
    kr: new Float64Array(N), ki: new Float64Array(N),
    ab: new Float64Array(ND),
    rec: new Float64Array((NSTEP + NMAX) * ND),
    step: 0, fi: 0, q: 0, qf: QF,
    sp: null,   // parameters of the solve in progress
    row: new Float64Array(ND), db: new Float32Array(W * H), hist: new Int32Array(240), hi: 0,
    P: new Float32Array(W * H), Q: new Float32Array(W * H), D: new Float32Array(W * H),
    lut: new Float32Array(9 * 1024 * 3),
    ready: false,
  };
}

// the drivers of the sea, all sums of sines that do not divide
function drivers(S, K) {
  const t = S.t * TS, p = S.ph;
  // the source depth is z = 60 + 1240 u^2 m, u from the knob and a wander that carries it from near the surface to the axis
  const wz = 0.5 * sin((TAU * t) / 52.7 + p[0]) + 0.35 * sin((TAU * t) / 83.9 + p[1]) + 0.25 * sin((TAU * t) / 37.1 + p[2]);
  const u = cl(cl(K[1], 0, 4) / 4 + 0.5 * wz, 0, 1);
  const zs = 60 + 1240 * u * u;
  const f0 = 22 * Math.pow(2, 1.15 * cl(K[3], -1, 1));
  const f = f0 * (1 + 0.2 * sin((TAU * t) / 37.1 + p[3]) + 0.12 * sin((TAU * t) / 53.9 + p[4]));
  const we = 0.5 * sin((TAU * t) / 91 + p[5]) + 0.35 * sin((TAU * t) / 63 + p[6]) + 0.25 * sin((TAU * t) / 43 + p[21]);
  const eps = EPS0 * Math.pow(2, cl(K[2], -1, 1) + 1.3 * we);
  const za0 = ZAX + 260 * (0.6 * sin((TAU * t) / 113 + p[22]) + 0.4 * sin((TAU * t) / 71 + p[23]));
  const e1 = 0.008 * sin((TAU * t) / 121 + p[13]), e2 = 0.007 * sin((TAU * t) / 149 + p[14]), e3 = 0.01 * sin((TAU * t) / 77 + p[26]);
  const r0 = 44000 * (1 + 0.6 * sin((TAU * t) / 101 + p[33]) + 0.4 * sin((TAU * t) / 67 + p[34]));
  const n0 = cl(round(r0 / DR), 0, NMAX);
  const sig = (4.4 + 1.1 * sin((TAU * t) / 59 + p[35]) + 0.6 * sin((TAU * t) / 83 + p[36])) * (PI / 180);
  const wn = 38 + 4 * sin((TAU * t) / 97 + p[37]) + 3 * sin((TAU * t) / 41 + p[38]);
  return { sig, wn, n0, nTot: NSTEP + n0, r0: n0 * DR, zs, f, eps, za0, t, p, e1, e2, e3, iw: IWA * (1 + 0.5 * sin((TAU * t) / 157 + p[20])) };
}

function beginSolve(S, K, fi) {
  if (fi === 0) S.sp = drivers(S, K);
  const sp = S.sp;
  // the frequencies of a solve spread 13 percent either side of the drifting one
  const f = sp.f * (1 + 0.13 * (fi - (NF - 1) / 2) / ((NF - 1) / 2));
  const k0 = (TAU * f) / C0, dr = DR;
  sp.k0 = k0;
  sp.dr = dr;
  // starter: a Gaussian of the source's beam width and its mirror image, scaled to unit energy
  const w = 1 / (k0 * sp.sig), re = S.re, im = S.im;
  let e = 0;
  for (let j = 0; j < ND; j++) {
    const z = ZC[j];
    const g = exp(-((z - sp.zs) * (z - sp.zs)) / (2 * w * w)) - exp(-((z + sp.zs) * (z + sp.zs)) / (2 * w * w));
    re[j] = g;
    re[N - 1 - j] = -g;
    im[j] = 0;
    im[N - 1 - j] = 0;
    e += g * g * DZ;
  }
  const sc = 1 / sqrt(max(e, 1e-12));
  for (let j = 0; j < N; j++) re[j] *= sc;
  // kinetic step, in bit reversed order, with the low-pass and the 1/N
  const dk = TAU / (N * DZ), kmax = 0.85 * (PI / DZ);
  for (let p = 0; p < N; p++) {
    const m = REV[p], mm = m < N / 2 ? m : m - N, kz = mm * dk;
    const ph = (-kz * kz * dr) / (2 * k0), lp = abs(kz) > kmax ? 0 : 1 / N;
    S.kr[p] = lp * cos(ph);
    S.ki[p] = lp * sin(ph);
  }
  // the absorbing bottom
  const alpha0 = 3.5e-4;
  for (let j = 0; j < ND; j++) {
    const z = ZC[j];
    let a = 0;
    if (z > ZABS) {
      const q = (z - ZABS) / (ZMAX - ZABS);
      a = alpha0 * q * q;
    }
    S.ab[j] = exp(-a * dr);
  }
  S.step = 0;
}

const AM = new Float64Array(NM);
function marchSteps(S, n) {
  const sp = S.sp, re = S.re, im = S.im, vr = S.vr, vi = S.vi, kr = S.kr, ki = S.ki, ab = S.ab, rec = S.rec;
  const p = sp.p, t = sp.t, k0dr = sp.k0 * sp.dr;
  n = min(n, sp.nTot - S.step);
  for (let s = 0; s < n; s++) {
    const st = S.step, r = st * sp.dr;
    // record the intensity
    const o = st * ND;
    for (let j = 0; j < ND; j++) rec[o + j] += re[j] * re[j] + im[j] * im[j];
    // the sea at this range: the axis wanders with range, slowly sliding, and so does the strength
    const za = sp.za0 + 110 * cos((TAU * r) / 95000 + (TAU * t) / 83 + p[7]) + 70 * cos((TAU * r) / 57000 - (TAU * t) / 61 + p[8]);
    const ep = sp.eps * (1 + 0.12 * cos((TAU * r) / 130000 + (TAU * t) / 117 + p[9]));
    // three eddies slide across the range, each a patch of warm or cold water
    const rc1 = RANGE * (0.5 + 0.75 * sin((TAU * t) / 97 + p[11])), rc2 = RANGE * (0.5 + 0.75 * sin((TAU * t) / 67 + p[12]));
    const rc3 = RANGE * (0.5 + 0.8 * sin((TAU * t) / 53 + p[25]));
    const rw = r - sp.r0, x1 = (rw - rc1) / 28000, x2 = (rw - rc2) / 22000, x3 = (rw - rc3) / 14000;
    for (let i = 0; i < NM; i++) AM[i] = sp.iw * MA[i] * cos((TAU * r) / ML[i] + (TAU * t) / MT[i] + p[15 + i]);
    const ae1 = sp.e1 * exp(-x1 * x1), ae2 = sp.e2 * exp(-x2 * x2), ae3 = sp.e3 * exp(-x3 * x3);
    const g = exp((2 * za) / BW), c1 = (-2 * za) / BW - 1;
    for (let j = 0; j < ND; j++) {
      const u = ep * (c1 + (2 * ZC[j]) / BW + g * EZ[j]) + ae1 * GZ1[j] + ae2 * GZ2[j] + ae3 * GZ3[j] + AM[0] * VM[0][j] + AM[1] * VM[1][j] + AM[2] * VM[2][j] + AM[3] * VM[3][j];
      const a1 = 1 + u, q = (1 / (a1 * a1) - 1) * 0.5;
      const idx = round(k0dr * q * (TB / TAU)) & (TB - 1);
      const m = ab[j], cr = TCOS[idx] * m, ci = TSIN[idx] * m;
      const xr = re[j], xi = im[j], yr = xr * cr - xi * ci, yi = xr * ci + xi * cr;
      re[j] = yr;
      im[j] = yi;
      re[N - 1 - j] = -yr;
      im[N - 1 - j] = -yi;
    }
    fftF(re, im);
    for (let m = 0; m < N; m++) {
      const a = re[m], b = im[m];
      re[m] = a * kr[m] - b * ki[m];
      im[m] = a * ki[m] + b * kr[m];
    }
    fftI(re, im);
    S.step = st + 1;
  }
}

// the recorded intensities of the solve → the level of each LED, 0 to 1
function finishField(S, out, first) {
  const rec = S.rec, per = NSTEP / W, row = S.row, db = S.db, hist = S.hist;
  hist.fill(0);
  for (let x = 0; x < W; x++) {
    const sc = S.sp.n0 + (x + 0.5) * per - 0.5;
    const s0 = floor(sc) - 3;
    for (let j = 0; j < ND; j++) {
      let a = 0, ws = 0;
      for (let q = s0; q < s0 + 8; q++) {
        const wq = 1 - abs(q - sc) / 2.5;
        if (wq <= 0) continue;
        const qq = cl(q, 0, S.sp.nTot - 1);
        a += wq * rec[qq * ND + j];
        ws += wq;
      }
      row[j] = a / (ws * NF);
    }
    for (let j = 0; j < ND; j++) {
      const a = row[j > 0 ? j - 1 : 0], b = row[j], c = row[j < ND - 1 ? j + 1 : j];
      const I = 0.2 * a + 0.6 * b + 0.2 * c;
      const d = 4.3429448 * log(I * LREF + 1e-9);
      db[j * W + x] = d;
      hist[cl(floor((d + 80) * 2), 0, 239)]++;
    }
  }
  // the window follows the loud 3 percent of the picture
  let acc = 0, b = 239;
  for (; b > 0; b--) {
    acc += hist[b];
    if (acc >= 0.03 * W * H) break;
  }
  const hi = b / 2 - 80 + 4;
  S.hi = first ? hi : S.hi + (hi - S.hi) * 0.25;
  const wn = S.sp.wn, lo = S.hi - wn;
  for (let p = 0; p < W * H; p++) {
    const v = cl((db[p] - lo) / wn, 0, 1);
    out[p] = v * v;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
  } else {
    const al = 1 - exp(-d / 0.18);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  S.t += d;
  if (!S.ready) {
    // the first picture is a whole solve at once
    S.rec.fill(0);
    for (let fi = 0; fi < NF; fi++) {
      beginSolve(S, S.k, fi);
      marchSteps(S, S.sp.nTot);
    }
    finishField(S, S.Q, true);
    S.P.set(S.Q);
    S.D.set(S.Q);
    S.fi = 0;
    S.q = 0;
    S.ready = true;
    S.rec.fill(0);
    beginSolve(S, S.k, 0);
    return;
  }
  marchSteps(S, SPF);
  S.q++;
  if (S.step >= S.sp.nTot) {
    S.fi++;
    if (S.fi >= NF) {
      // a solve is done: it becomes the target, the start is what is on the panel now
      finishField(S, S.Q);
      S.P.set(S.D);
      S.qf = max(QF, S.q);
      S.q = 0;
      S.fi = 0;
      S.rec.fill(0);
    }
    beginSolve(S, S.k, S.fi);
  }
}

// ------------------------------------------------------------------ drawing
const C = [0, 0, 0];
const NHS = 9, HSTEP = 0.03; // hue slices of the palette, 0.03 of a turn apart, round the base
function buildLut(S, h0) {
  // anchors of the colour ramp: value, hue offset, saturation, brightness; the last is amber
  const A = [
    [0.0, 0.04, 0.93, 0.15],
    [0.18, 0.025, 0.92, 0.3],
    [0.4, 0.0, 0.9, 0.6],
    [0.64, -0.04, 0.82, 0.88],
    [0.8, -0.07, 0.5, 1.0],
    [0.9, -0.09, 0.14, 1.0],
    [1.0, -0.47, 0.6, 1.0],
  ];
  for (let sl = 0; sl < NHS; sl++) {
    const hb = h0 + (sl - (NHS - 1) / 2) * HSTEP;
    const cols = A.map((a) => {
      hsv(hb + a[1], a[2], a[3], C);
      return [C[0], C[1], C[2]];
    });
    const o = sl * 1024 * 3;
    for (let i = 0; i < 1024; i++) {
      const v = i / 1023;
      let k = 0;
      while (k < A.length - 2 && v > A[k + 1][0]) k++;
      const f = cl((v - A[k][0]) / (A[k + 1][0] - A[k][0]), 0, 1);
      for (let c = 0; c < 3; c++) S.lut[o + i * 3 + c] = cols[k][c] * (1 - f) + cols[k + 1][c] * f;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const t = S.t * TS, ph = S.ph, K = S.k, h0 = 0.585 + cl(K[0], 0, 1) + 0.05 * sin((TAU * t) / 113 + ph[10]) + 0.03 * sin((TAU * t) / 71 + ph[24]);
  const gain = 1 + 0.07 * sin((TAU * t) / 137 + ph[31]) + 0.05 * sin((TAU * t) / 59 + ph[32]);
  buildLut(S, h0);
  const e = min(1, S.q / S.qf), P = S.P, Q = S.Q, D = S.D, lut = S.lut;
  hsv(h0 - 0.08, 0.25, 1, C);
  const sr = C[0], sg = C[1], sb = C[2];
  // the hue changes across the picture: a slow gradient from the surface to the deep, and two waves that travel
  const w1 = (TAU * t) / 89 + ph[27], w2 = -(TAU * t) / 61 + ph[28], w3 = (TAU * t) / 47 + ph[29], w4 = -(TAU * t) / 29 + ph[30], hm = (NHS - 1) / 2;
  for (let y = 0; y < H; y++) {
    const sf = y === 0 ? 0.8 : y === 1 ? 0.3 : 0;
    const dy = 0.05 * (y / (H - 1)) - 0.02;
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const v0 = P[p] + (Q[p] - P[p]) * e;
      D[p] = v0;
      const v = cl(v0 + 0.06 * sin(TAU * (x / 44 - y / 120) + w3) + 0.05 * sin(TAU * (x / 23 + y / 75) + w4) + 0.1, 0, 1);
      const d = dy + 0.02 * sin(TAU * (x / 52 + y / 170) + w1) + 0.015 * sin(TAU * (x / 31 - y / 110) + w2);
      const hs = cl(d / HSTEP + hm, 0, NHS - 1.001), h0i = floor(hs), hf = hs - h0i;
      const vi = (v * 1023) | 0, i1 = (h0i * 1024 + vi) * 3, i2 = i1 + 3072;
      let r = lut[i1] + (lut[i2] - lut[i1]) * hf, g = lut[i1 + 1] + (lut[i2 + 1] - lut[i1 + 1]) * hf, b = lut[i1 + 2] + (lut[i2 + 2] - lut[i1 + 2]) * hf;
      if (sf > 0) {
        r = r * (1 - sf) + sr * sf;
        g = g * (1 - sf) + sg * sf;
        b = b * (1 - sf) + sb * sf;
      }
      display.setPixel(x, y, min(255, (r * gain * 255) | 0), min(255, (g * gain * 255) | 0), min(255, (b * gain * 255) | 0));
    }
  }
}
