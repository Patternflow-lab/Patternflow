// ===== Patternflow pattern =====
// Title:   Form Constants
// Family:  sim
// Idea:    A neural field with fatigue is solved on an unrolled visual cortex and drawn back through the complex logarithm onto the panel, so the stripes the field makes on the cortex read as tunnels, funnels, spirals and cobwebs around the centre, running and turning for as long as it runs.
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: neural field with lateral inhibition and fatigue (Hugh Wilson and Jack Cowan, 1972 and 1973; Shun-ichi Amari, 1977; from memory), geometric hallucinations from its pattern formation on the cortex (Bard Ermentrout and Jack Cowan, 1979; Paul Bressloff, Jack Cowan, Martin Golubitsky, Peter Thomas and Matthew Wiener, 2001; from memory), the complex logarithm as the map from retina to cortex (Eric Schwartz, 1980, from memory), the form constants (Heinrich Kluever, 1926, from memory), pattern round 127
// Round:   127
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=1..3.5, Spokes=-1..1, Lattice=0..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the hue of the ramp.
// Knob 2: Pace. The clock.
// Knob 3: Spokes. The cortical wavelength.
// Knob 4: Lattice. The bias that tips stripes towards spots.

const { floor, ceil, sqrt, sin, cos, exp, log, abs, min, max, PI, pow, atan2, tanh } = Math;
const W = 64, H = 128, N = W * H;
const NT = 128, NS = 64, NC = NT * NS; // cortex: theta (periodic, 128 cells) by s (periodic, 64 cells)
const TAU = 2 * PI;
const HC = TAU / NT;                   // one cell, in radians of theta and in units of s
const LS = NS * HC;                    // length of the s axis (pi)
const KS = TAU / LS;                   // spacing of the wavenumbers along s (2)
const R0 = 3.5;                        // core radius of the map, LEDs
const CX = 32, CY = 64;                // the centre of the map, a corner of four LEDs
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- model constants. Time is in units of the activity's decay time.
const TAU_B = 4;                   // fatigue time
const C_FAT = 0.8;                 // fatigue drive: db/dt = (C a - b) / TAU_B
const G_H = 1 + 1 / TAU_B;         // gain at which the mode at the kernel's peak starts to oscillate (kernel peak normalised to 1)
const EPS0 = 0.3;                  // how far above it the field runs, on average
const RHO2 = 4;                    // (sigma_inhibition / sigma_excitation) squared
const DT = 0.12;                   // step
const RATE0 = 3.6;                 // time units a second at Pace 2
const NOISE = 0.03;

function fftTables(n) {
  const c = new Float64Array(n / 2), s = new Float64Array(n / 2), rev = new Uint16Array(n);
  for (let k = 0; k < n / 2; k++) { c[k] = cos((TAU * k) / n); s[k] = sin((TAU * k) / n); }
  let bits = 0;
  while (1 << bits < n) bits++;
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
    rev[i] = r;
  }
  return { n, c, s, rev };
}
const FT = fftTables(NT), FS = fftTables(NS);

// in-place radix-2 transform of n values at re[off..], im[off..]; sg = -1 forward, +1 inverse (neither scaled)
function fft1(re, im, off, T, sg) {
  const n = T.n, rev = T.rev, tc = T.c, ts = T.s;
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[off + i]; re[off + i] = re[off + j]; re[off + j] = t;
      t = im[off + i]; im[off + i] = im[off + j]; im[off + j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0, w = 0; k < half; k++, w += step) {
        const wr = tc[w], wi = sg * ts[w];
        const a = off + i + k, b = a + half;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
}
const CR = new Float64Array(NS), CI = new Float64Array(NS);
function fft2(re, im, sg) {
  for (let j = 0; j < NS; j++) fft1(re, im, j * NT, FT, sg);
  for (let i = 0; i < NT; i++) {
    for (let j = 0; j < NS; j++) { CR[j] = re[j * NT + i]; CI[j] = im[j * NT + i]; }
    fft1(CR, CI, 0, FS, sg);
    for (let j = 0; j < NS; j++) { re[j * NT + i] = CR[j]; im[j * NT + i] = CI[j]; }
  }
}

// tanh by table
const TN = 4096, TR = 8;
const TT = new Float32Array(TN + 2);
for (let i = 0; i <= TN + 1; i++) TT[i] = tanh(((i / TN) * 2 - 1) * TR);
function tnh(x) {
  const q = (x + TR) * (TN / (2 * TR));
  if (q <= 0) return -1;
  if (q >= TN) return 1;
  const i = q | 0, f = q - i;
  return TT[i] + (TT[i + 1] - TT[i]) * f;
}

function newState() {
  return {
    ar: new Float64Array(NC), ai: new Float64Array(NC), br: new Float64Array(NC), bi: new Float64Array(NC),
    zr: new Float64Array(NC), zi: new Float64Array(NC), rr: new Float64Array(NC), ri: new Float64Array(NC),
    ap: new Float32Array(NC), ac: new Float32Array(NC), tmp: new Float32Array(NC),
    cls: new Uint16Array(NC), conj: new Int32Array(NC),
    e11: new Float64Array(33 * 65), e12: new Float64Array(33 * 65), e21: new Float64Array(33 * 65), e22: new Float64Array(33 * 65),
    pa: new Float64Array(33 * 65), pb: new Float64Array(33 * 65), wk: new Float64Array(33 * 65),
    kc: 8, kcDone: -1, acc: 0, t: 0, steps: 0, rms: 0.5, pace: 2,
    lut: new Uint8Array(3 * 512), hueDone: -999, lattice: 0,
    pixStart: null, smpIdx: null, smpW: null,
  };
}

function initIndex(S) {
  for (let j = 0; j < NS; j++)
    for (let i = 0; i < NT; i++) {
      const m = j < NS / 2 ? j : j - NS, n = i < NT / 2 ? i : i - NT;
      S.cls[j * NT + i] = abs(m) * 65 + abs(n);
      S.conj[j * NT + i] = ((NS - j) % NS) * NT + ((NT - i) % NT);
    }
}

// Kernel: difference of two gaussians, sigma_i = 2 sigma_e, area balanced; Fourier transform normalised to 1 at its peak kc.
function buildSpectrum(S, kc) {
  const xpk = (2 * log(RHO2)) / (RHO2 - 1);
  const wpk = exp(-xpk / 2) - exp((-xpk * RHO2) / 2);
  const sig2 = xpk / (kc * kc);
  const g0 = G_H * (1 + EPS0);
  for (let am = 0; am <= 32; am++)
    for (let an = 0; an <= 64; an++) {
      const k2 = an * an + KS * am * (KS * am), x = sig2 * k2;
      const w = (exp(-x / 2) - exp((-x * RHO2) / 2)) / wpk;
      const c = am * 65 + an;
      S.wk[c] = w;
      const g = g0 * w;
      // M = L dt, L = [[-1 + g, -g], [C / tau, -1 / tau]]
      const m11 = (-1 + g) * DT, m12 = -g * DT, m21 = (C_FAT / TAU_B) * DT, m22 = (-1 / TAU_B) * DT;
      let e11 = 1, e12 = 0, e21 = 0, e22 = 1; // sum of M^k / k!
      let p11 = 1, p21 = 0;                  // sum of M^k / (k+1)! first column
      let t11 = 1, t12 = 0, t21 = 0, t22 = 1; // M^k
      let f = 1;
      for (let k = 1; k <= 10; k++) {
        const n11 = t11 * m11 + t12 * m21, n12 = t11 * m12 + t12 * m22, n21 = t21 * m11 + t22 * m21, n22 = t21 * m12 + t22 * m22;
        t11 = n11; t12 = n12; t21 = n21; t22 = n22;
        f *= k;
        e11 += t11 / f; e12 += t12 / f; e21 += t21 / f; e22 += t22 / f;
        p11 += t11 / (f * (k + 1)); p21 += t21 / (f * (k + 1));
      }
      S.e11[c] = e11; S.e12[c] = e12; S.e21[c] = e21; S.e22[c] = e22;
      S.pa[c] = (DT * p11 * w) / NC;
      S.pb[c] = (DT * p21 * w) / NC;
    }
  S.kcDone = kc;
}

function gauss() {
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.7320508;
}

// one step of the field: u = a - b by the inverse transform, the nonlinearity, the forward transform, the exponential update
function step(S) {
  const { ar, ai, br, bi, zr, zi, rr, ri, cls, e11, e12, e21, e22, pa, pb } = S;
  for (let i = 0; i < NC; i++) {
    zr[i] = ar[i] - br[i] - ai[i];
    zi[i] = ai[i] - bi[i] + ar[i];
  }
  fft2(zr, zi, 1); // real part u = a - b, imaginary part a
  const t = S.t;
  const eps = EPS0 * (1 + 0.35 * sin(0.0731 * t + 1.1) + 0.2 * sin(0.0317 * t + 0.4));
  const pb0 = S.lattice;
  const p = cl(pb0 + 0.2 * sin(0.0523 * t + 2.3) * (0.3 + pb0) + 0.12 * sin(0.0211 * t), 0, 0.7);
  const beta = 0.5 * log((1 + p) / (1 - p));
  const gEff = G_H * (1 + eps), G = gEff / (1 - p * p), g0 = G_H * (1 + EPS0);
  const sn = NOISE / sqrt(DT);
  const ac = S.ap; // reuse: the old previous becomes the new current
  S.ap = S.ac;
  S.ac = ac;
  for (let i = 0; i < NC; i++) {
    const u = zr[i];
    ac[i] = zi[i];
    rr[i] = G * (tnh(u + beta) - p) - g0 * u + sn * gauss();
    ri[i] = 0;
  }
  fft2(rr, ri, -1);
  for (let i = 0; i < NC; i++) {
    const c = cls[i], xr = ar[i], xi = ai[i], yr = br[i], yi = bi[i], Rr = rr[i], Ri = ri[i];
    ar[i] = e11[c] * xr + e12[c] * yr + pa[c] * Rr;
    ai[i] = e11[c] * xi + e12[c] * yi + pa[c] * Ri;
    br[i] = e21[c] * xr + e22[c] * yr + pb[c] * Rr;
    bi[i] = e21[c] * xi + e22[c] * yi + pb[c] * Ri;
  }
  S.t += DT;
  S.steps++;
  if (S.steps % 25 === 0) {
    const cj = S.conj;
    for (let i = 0; i < NC; i++) {
      const j = cj[i];
      if (j < i) continue;
      const mr = 0.5 * (ar[i] + ar[j]), mi = 0.5 * (ai[i] - ai[j]);
      ar[i] = ar[j] = mr; ai[i] = mi; ai[j] = -mi;
      const nr = 0.5 * (br[i] + br[j]), ni = 0.5 * (bi[i] - bi[j]);
      br[i] = br[j] = nr; bi[i] = ni; bi[j] = -ni;
    }
  }
}

// ---- retina to cortex: for each LED the cortex cells it covers, with weights (area average over the LED, bilinear in the cortex)
function buildMap(S) {
  const start = new Int32Array(N + 1);
  const idx = [], wts = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      start[p] = idx.length;
      const dx0 = x + 0.5 - CX, dy0 = y + 0.5 - CY, r = max(0.7, sqrt(dx0 * dx0 + dy0 * dy0));
      const foot = max(1 / (r * HC), r / ((r * r + R0 * R0) * HC));
      const ns = cl(ceil(foot), 1, 8), wsub = 1 / (ns * ns);
      for (let sy = 0; sy < ns; sy++)
        for (let sx = 0; sx < ns; sx++) {
          const dx = x + (sx + 0.5) / ns - CX, dy = y + (sy + 0.5) / ns - CY;
          const s = 0.5 * log((dx * dx + dy * dy + R0 * R0) / (R0 * R0));
          let th = atan2(dy, dx);
          if (th < 0) th += TAU;
          const fi = th / HC, fj = s / HC;
          const i0 = floor(fi), j0 = min(floor(fj), NS - 2), ax = fi - i0, ay = fj - j0;
          const i1 = (i0 + 1) % NT, ii0 = i0 % NT;
          idx.push(j0 * NT + ii0, j0 * NT + i1, (j0 + 1) * NT + ii0, (j0 + 1) * NT + i1);
          wts.push(wsub * (1 - ax) * (1 - ay), wsub * ax * (1 - ay), wsub * (1 - ax) * ay, wsub * ax * ay);
        }
    }
  start[N] = idx.length;
  S.pixStart = start;
  S.smpIdx = Int32Array.from(idx);
  S.smpW = Float32Array.from(wts);
}

// ---- colour
function lin(L, a, b, o) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  o[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  o[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  o[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const GAM = new Float32Array(4097);
for (let k = 0; k <= 4096; k++) {
  const x = k / 4096;
  GAM[k] = 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
}
const gam = (x) => GAM[x <= 0 ? 0 : x >= 1 ? 4096 : (x * 4096 + 0.5) | 0];
const STOPS = [
  [0.0, 0.2, 0.12, 275],
  [0.25, 0.36, 0.2, 290],
  [0.5, 0.52, 0.2, 355],
  [0.75, 0.74, 0.17, 55],
  [0.92, 0.9, 0.15, 95],
  [1.0, 0.97, 0.05, 100],
];
const TMP = [0, 0, 0];
function buildLut(S, shift) {
  const lut = S.lut;
  for (let q = 0; q < 512; q++) {
    const t = q / 511;
    let n = 1;
    while (n < STOPS.length - 1 && STOPS[n][0] < t) n++;
    const A = STOPS[n - 1], B = STOPS[n], u = (t - A[0]) / (B[0] - A[0]), w = u * u * (3 - 2 * u);
    const L = A[1] + (B[1] - A[1]) * w;
    let C = A[2] + (B[2] - A[2]) * w;
    let dh = B[3] - A[3];
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    const h = ((A[3] + dh * w + shift) * PI) / 180;
    for (let it = 0; it < 8; it++) {
      lin(L, C * cos(h), C * sin(h), TMP);
      if (TMP[0] >= -0.002 && TMP[1] >= -0.002 && TMP[2] >= -0.002 && TMP[0] <= 1.002 && TMP[1] <= 1.002 && TMP[2] <= 1.002) break;
      C *= 0.9;
    }
    lin(L, C * cos(h), C * sin(h), TMP);
    lut[3 * q] = gam(TMP[0]);
    lut[3 * q + 1] = gam(TMP[1]);
    lut[3 * q + 2] = gam(TMP[2]);
  }
  S.hueDone = shift;
}

const KNOB = [0, 2, 0, 0.06];
function targets(k) {
  return {
    pace: cl(k[1], 1, 3.5) / 2,
    kc: 10.4 * pow(1.732, cl(k[2], -1, 1)),
    lattice: 0.55 * cl(k[3], 0, 1),
  };
}

export function setup(params, knobValues) {
  const S = (params.s = newState());
  const tg = targets(knobValues || KNOB);
  S.pace = tg.pace;
  S.kc = tg.kc;
  S.lattice = tg.lattice;
  initIndex(S);
  buildSpectrum(S, S.kc);
  buildMap(S);
  buildLut(S, 0);
  // a small band-limited seed
  for (let i = 0; i < NC; i++) { S.rr[i] = 0.3 * gauss(); S.ri[i] = 0; }
  fft2(S.rr, S.ri, -1);
  for (let i = 0; i < NC; i++) {
    const c = S.cls[i];
    S.ar[i] = (S.rr[i] * S.wk[c]) / NC;
    S.ai[i] = (S.ri[i] * S.wk[c]) / NC;
  }
  for (let i = 0; i < 500; i++) step(S);
  S.rms = 0.5;
}

export function update(dt, input, params) {
  const k = input.knobValues || KNOB;
  if (!params.s) setup(params, k);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  const hue = cl(k[0], 0, 1) * 360;
  if (abs(hue - S.hueDone) > 0.5) buildLut(S, hue);
  if (d <= 0) return;
  const tg = targets(k), f = 1 - exp(-4 * d);
  S.pace += (tg.pace - S.pace) * f;
  S.lattice += (tg.lattice - S.lattice) * f;
  S.kc += (tg.kc - S.kc) * f;
  if (abs(S.kc - S.kcDone) > 0.004 * S.kc) buildSpectrum(S, S.kc);
  S.acc += d * RATE0 * S.pace;
  let guard = 0;
  while (S.acc >= DT && guard++ < 8) {
    step(S);
    S.acc -= DT;
  }
  const al = S.acc / DT, ap = S.ap, ac = S.ac, tmp = S.tmp;
  let ss = 0;
  for (let i = 0; i < NC; i++) {
    const v = ap[i] + (ac[i] - ap[i]) * al;
    tmp[i] = v;
    ss += v * v;
  }
  const r = sqrt(ss / NC);
  if (!(r < 1e6)) { setup(params, k); return; }
  S.rms += (r - S.rms) * (1 - exp(-d / 1.5));
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const lut = S.lut, tmp = S.tmp, st = S.pixStart, si = S.smpIdx, sw = S.smpW;
  const g = 0.9 / max(1e-6, S.rms);
  for (let p = 0; p < N; p++) {
    let v = 0;
    for (let q = st[p], e = st[p + 1]; q < e; q++) v += sw[q] * tmp[si[q]];
    const t = tanh(v * g);
    const q = ((0.5 + 0.5 * t) * 511 + 0.5) | 0;
    display.setPixel(p & 63, p >> 6, lut[3 * q], lut[3 * q + 1], lut[3 * q + 2]);
  }
}
