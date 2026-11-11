// ===== Patternflow pattern =====
// Title:   Quasipattern
// Family:  geometry
// Idea:    Twelve waves on two rings of wavenumber, one 1.93 times the other, lock each other's phases into a dodecagonal quasi-pattern with no repeating cell, and a dispersive phase push keeps the field turbulent, so rosettes of dots flip, tear and re-form across the panel for good (a dynamical field, not a tiling).
// Author:  patternflow-lab
// Date:    2026-11-11
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: quasi-patterns of Faraday waves, W. Stuart Edwards and Stephan Fauve (1994), and the two-length-scale model of them, Ron Lifshitz and Dean Petrich (1997), here as the amplitude equations of its twelve waves
// Round:   129
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.8..3, Scale=-1..1, Drift=0..1
//
// Knob 1: Hue. Turns the colour ramp round the wheel; at 0 the dots are pale yellow on a teal and indigo ground.
// Knob 2: Speed. How fast the weave runs, from 0.8 to 3 times the model's own pace.
// Knob 3: Scale. The wavelength of the coarse ring in LEDs, 10.5 exp(0.2 Scale): 8.6 at -1, 10.5 at the opening 0, 12.8 at 1. The fine ring is 1.93 times finer.
// Knob 4: Drift. How hard the waves' phases are pushed round, beta = 0.1 + 0.5 Drift. Low, the dots keep their rings and shift a few at a time; high, rosettes tear sooner and the dots stretch into short bars.

const W = 64, H = 128, N = W * H;
const CS = 2, WC = W / CS, HC = H / CS, NC = WC * HC;
const { floor, sqrt, sin, cos, atan2, exp, max, min, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const Q = 2 * cos(PI / 12); // 1.932: the wavenumber of the fine ring over the coarse one

// ---- radix-2 FFT ----------------------------------------------------------------------------
function plan(n) {
  const lg = Math.round(Math.log2(n)), rev = new Uint16Array(n), c = new Float64Array(n / 2), s = new Float64Array(n / 2);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) if (i & (1 << b)) r |= 1 << (lg - 1 - b);
    rev[i] = r;
  }
  for (let i = 0; i < n / 2; i++) (c[i] = cos((TAU * i) / n)), (s[i] = -sin((TAU * i) / n));
  return { n, rev, c, s };
}
const PX = plan(WC), PY = plan(HC);
const TR = new Float64Array(HC), TI = new Float64Array(HC);
function fft(p, re, im, o, inv) {
  const { n, rev, c, s } = p, sg = inv ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[o + i];
      re[o + i] = re[o + j];
      re[o + j] = t;
      t = im[o + i];
      im[o + i] = im[o + j];
      im[o + j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let i = o; i < o + n; i += len)
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const wr = c[t], wi = sg * s[t], a = i + k, b = a + half;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
  }
}
function fft2(re, im, inv) {
  for (let y = 0; y < HC; y++) fft(PX, re, im, y * WC, inv);
  for (let x = 0; x < WC; x++) {
    for (let y = 0; y < HC; y++) (TR[y] = re[y * WC + x]), (TI[y] = im[y * WC + x]);
    fft(PY, TR, TI, 0, inv);
    for (let y = 0; y < HC; y++) (re[y * WC + x] = TR[y]), (im[y * WC + x] = TI[y]);
  }
}

// ---- the model ------------------------------------------------------------------------------
// psi = sum over n of Re[ a_n e^{i u_n.x} + b_n e^{i v_n.x} ], with u_n the coarse ring's six wave vectors at 30 degree steps, k0 (cos 30n, sin 30n), and
// v_n the fine ring's, Q k0 (cos(15 + 30n), sin(15 + 30n)). a_n and b_n are complex envelopes on a grid of half the panel's resolution: they vary on the scale
// of a few wavelengths, and the carriers are drawn exactly, so no wave is rounded to the torus. Written as 12 modes a_0..a_5, b_0..b_5 with a_{n+6} = conj a_n,
//   u_n + u_{n+1} = v_n              (two coarse waves 30 degrees apart add to a fine one)
//   v_n + v_{n+5} = u_{n+3}          (two fine waves 150 degrees apart add to a coarse one)
// and each such triad feeds the product of two modes into the third, alpha a_n a_{n+1} into b_n, alpha b_n conj(a_{n+1}) into a_n, and so on. That is what ties
// the phases: of the six phases only four stay free, two that slide the weave and two (the phason) that rearrange it.
//   d a / dt = (1 + i zeta) (- c ((2 k0 kappa_par + kappa^2) / k0^2)^2) a + (mu + m(x, t) mu) a + alpha (triads) - (1 + i beta) a ((1 - g) |a|^2 + g S_a + d S_b) + noise
// kappa is the envelope's own wavevector and kappa_par its part along the wave; the same with Q k0 for b. The 1 + i beta pushes every phase round at a rate that
// grows with the local intensity, and the i zeta turns the phase of whatever spreads, so a smooth state is unstable and dislocations are born all the time: the
// weave is a turbulence of its own phases, and the state is not the minimum of anything. m is a slow random control field; see control().
// The linear part is taken implicitly in Fourier space and the rest explicitly, so one step is 25 transforms of 32 by 64.
const MU = 0.3, CC = 0.8, ALPHA = 0.9, GAM = 0.5, DLT = 0.5, NOISE = 0.012;
const ZETA = 2; // how far the envelope's spreading turns its phase
const MMAMP = 1.0; // how far the control field m moves the growth rate, as a share of MU
const MTAU = 80; // its memory, model time units
const MCUT = 0.36; // it holds only wavevectors below this, rad per LED: patches 17 LEDs across and up
// the phase push of each mode swells and fades on its own slow beat, so no two modes turn at one rate for long and the weave has no period
const BMOD = 0.7;
const BW = [0.0113, 0.0171, 0.0239, 0.0307, 0.0379, 0.0431, 0.0523, 0.0589, 0.0661, 0.0733, 0.0809, 0.0887];
const RATE = 3; // model time units a panel second at Speed 1
const HMAX = 0.45;
const LAM0 = 10.5; // the coarse ring's wavelength in LEDs at the opening Scale
const OPEN = [0, 2, 0, 0.06];

function setup(params) {
  const f = () => new Float64Array(NC);
  const S = {
    re: [], im: [], nr: [], ni: [], ga: [], kx: new Float64Array(WC), ky: new Float64Array(HC),
    L: [], car: [], sar: [], lam: LAM0, lamK: -1, warm: false, hue: 0, speed: 2, beta: -0.12, rng: 0x9e3779b9, t: 0,
    psi: new Float64Array(N), p1: new Float64Array(N), sd: 0.5, tr: new Float64Array(N), ti: new Float64Array(N),
  };
  for (let i = 0; i < 12; i++) (S.re[i] = f()), (S.im[i] = f()), (S.nr[i] = f()), (S.ni[i] = f()), (S.ga[i] = f()), (S.L[i] = f()), (S.car[i] = new Float32Array(N)), (S.sar[i] = new Float32Array(N));
  S.kx = new Float64Array(NC);
  S.ky = new Float64Array(NC);
  S.mr = new Float64Array(NC);
  S.mi = new Float64Array(NC);
  S.mm = new Float64Array(NC);
  S.mIdx = [];
  for (let y = 0; y < HC; y++)
    for (let x = 0; x < WC; x++) {
      S.kx[y * WC + x] = (TAU * (x < WC / 2 ? x : x - WC)) / (WC * CS);
      S.ky[y * WC + x] = (TAU * (y < HC / 2 ? y : y - HC)) / (HC * CS);
      if (S.kx[y * WC + x] ** 2 + S.ky[y * WC + x] ** 2 < MCUT * MCUT && (x || y)) S.mIdx.push(y * WC + x);
    }
  params.s = S;
  return S;
}

// xorshift: the noise needs a lot of numbers a frame
function rnd(S) {
  let x = S.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  S.rng = x >>> 0;
  return S.rng / 4294967296 - 0.5;
}

// Wavevectors, the implicit linear factors and the drawing tables for a coarse wavelength lam in LEDs.
function retune(S, lam) {
  S.lamK = lam;
  const k0 = TAU / lam;
  for (let i = 0; i < 12; i++) {
    const fine = i >= 6, n = i % 6, ang = (PI / 6) * n + (fine ? PI / 12 : 0), kk = fine ? Q * k0 : k0, cx = cos(ang), sy = sin(ang), L = S.L[i];
    for (let p = 0; p < NC; p++) {
      const kp = S.kx[p] * cx + S.ky[p] * sy, g = (2 * kk * kp + S.kx[p] * S.kx[p] + S.ky[p] * S.ky[p]) / (kk * kk);
      L[p] = -CC * g * g;
    }
    // the carriers, about the middle of the panel
    const car = S.car[i], sar = S.sar[i];
    for (let y = 0, p = 0; y < H; y++)
      for (let x = 0; x < W; x++, p++) {
        const th = kk * (cx * (x - W / 2) + sy * (y - H / 2));
        car[p] = cos(th);
        sar[p] = sin(th);
      }
  }
}

// A control field m(x, t) of unit spread that moves the growth rate from place to place: patches of the panel where the weave is a little stronger or weaker, never the same
// two minutes running. Each of its low Fourier modes is an Ornstein-Uhlenbeck process; the field is their inverse transform.
function control(S, h) {
  const { mr, mi, mm, tr, ti } = S, d = exp(-h / MTAU), sq = sqrt(1 - d * d);
  for (const p of S.mIdx) {
    mr[p] = mr[p] * d + sq * 3 * rnd(S);
    mi[p] = mi[p] * d + sq * 3 * rnd(S);
  }
  tr.set(mr);
  ti.set(mi);
  fft2(tr, ti, true);
  let s2 = 0;
  for (let p = 0; p < NC; p++) s2 += tr[p] * tr[p];
  const sc = 1 / (sqrt(s2 / NC) + 1e-9);
  for (let p = 0; p < NC; p++) mm[p] = tr[p] * sc;
}

// The right side of the nonlinear part into nr, ni; coarse space. AR..BI are the 12 modes of one point with their conjugates, ER..FI what the triads add.
const AR = new Float64Array(12), AI = new Float64Array(12), BR = new Float64Array(12), BI = new Float64Array(12);
const ER = new Float64Array(12), EI = new Float64Array(12), FR = new Float64Array(12), FI = new Float64Array(12);
function nonlinear(S) {
  const re = S.re, im = S.im, nr = S.nr, ni = S.ni;
  for (let p = 0; p < NC; p++) {
    let sa = 0, sb = 0;
    for (let n = 0; n < 6; n++) {
      AR[n] = re[n][p];
      AI[n] = im[n][p];
      AR[n + 6] = AR[n];
      AI[n + 6] = -AI[n];
      BR[n] = re[n + 6][p];
      BI[n] = im[n + 6][p];
      BR[n + 6] = BR[n];
      BI[n + 6] = -BI[n];
      sa += AR[n] * AR[n] + AI[n] * AI[n];
      sb += BR[n] * BR[n] + BI[n] * BI[n];
    }
    ER.fill(0);
    EI.fill(0);
    FR.fill(0);
    FI.fill(0);
    for (let n = 0; n < 12; n++) {
      const n1 = (n + 1) % 12, n5 = (n + 5) % 12, n3 = (n + 3) % 12;
      // u_n + u_{n+1} = v_n
      let pr = AR[n] * AR[n1] - AI[n] * AI[n1], pi = AR[n] * AI[n1] + AI[n] * AR[n1];
      FR[n] += ALPHA * pr;
      FI[n] += ALPHA * pi;
      // a_n += alpha b_n conj(a_{n+1}); a_{n+1} += alpha b_n conj(a_n)
      pr = BR[n] * AR[n1] + BI[n] * AI[n1];
      pi = BI[n] * AR[n1] - BR[n] * AI[n1];
      ER[n] += ALPHA * pr;
      EI[n] += ALPHA * pi;
      pr = BR[n] * AR[n] + BI[n] * AI[n];
      pi = BI[n] * AR[n] - BR[n] * AI[n];
      ER[n1] += ALPHA * pr;
      EI[n1] += ALPHA * pi;
      // v_n + v_{n+5} = u_{n+3}
      pr = BR[n] * BR[n5] - BI[n] * BI[n5];
      pi = BR[n] * BI[n5] + BI[n] * BR[n5];
      ER[n3] += ALPHA * pr;
      EI[n3] += ALPHA * pi;
      // b_n += alpha a_{n+3} conj(b_{n+5}); b_{n+5} += alpha a_{n+3} conj(b_n)
      pr = AR[n3] * BR[n5] + AI[n3] * BI[n5];
      pi = AI[n3] * BR[n5] - AR[n3] * BI[n5];
      FR[n] += ALPHA * pr;
      FI[n] += ALPHA * pi;
      pr = AR[n3] * BR[n] + AI[n3] * BI[n];
      pi = AI[n3] * BR[n] - AR[n3] * BI[n];
      FR[n5] += ALPHA * pr;
      FI[n5] += ALPHA * pi;
    }
    for (let n = 0; n < 6; n++) {
      const ia = AR[n] * AR[n] + AI[n] * AI[n], ib = BR[n] * BR[n] + BI[n] * BI[n];
      const mu = MMAMP * MU * S.mm[p], ga = (1 - GAM) * ia + GAM * sa + DLT * sb - mu, gb = (1 - GAM) * ib + GAM * sb + DLT * sa - mu;
      nr[n][p] = ER[n] - ga * AR[n];
      ni[n][p] = EI[n] - ga * AI[n];
      nr[n + 6][p] = FR[n] - gb * BR[n];
      ni[n + 6][p] = FI[n] - gb * BI[n];
      S.ga[n][p] = ga;
      S.ga[n + 6][p] = gb;
    }
  }
}

function step(S, h) {
  S.t += h;
  control(S, h);
  nonlinear(S);
  const sq = NOISE * sqrt(h);
  for (let i = 0; i < 12; i++) {
    const re = S.re[i], im = S.im[i], nr = S.nr[i], ni = S.ni[i], L = S.L[i], tr = S.tr, ti = S.ti;
    for (let p = 0; p < NC; p++) {
      tr[p] = re[p] + h * nr[p] + sq * rnd(S);
      ti[p] = im[p] + h * ni[p] + sq * rnd(S);
    }
    fft2(tr, ti, false);
    for (let p = 0; p < NC; p++) {
      // 1 / (1 - h (mu + (1 + i zeta) lam)): the dispersive part of the linear operator turns the envelope as it spreads
      const base = 1 - h * (MU + L[p]), hz = h * ZETA * L[p], d = 1 / (NC * (base * base + hz * hz)), a = base * d, b = hz * d, xr = tr[p], xi = ti[p];
      tr[p] = xr * a - xi * b;
      ti[p] = xr * b + xi * a;
    }
    fft2(tr, ti, true);
    // the phase push, 1 + i beta on the cubic term, is applied as an exact turn of the angle beta h ga, so a big beta cannot make the step blow up
    const ga = S.ga[i], hb = h * S.beta * (1 + BMOD * sin(S.t * BW[i] + 1.7 * i));
    for (let p = 0; p < NC; p++) {
      const th = -hb * ga[p], c = cos(th), sn = sin(th);
      re[p] = tr[p] * c - ti[p] * sn;
      im[p] = tr[p] * sn + ti[p] * c;
    }
  }
}

function knobs(S, ft, k) {
  S.hue = k[0];
  S.speed = cl(k[1], 0.8, 3);
  const lt = LAM0 * exp(0.2 * cl(k[2], -1, 1)), a = 1 - exp(-ft / 0.3);
  S.lam += (lt - S.lam) * a;
  if (abs(S.lam - S.lamK) > 0.01 * S.lamK) retune(S, S.lam);
  S.beta = -(0.1 + 0.5 * cl(k[3], 0, 1));
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  const ft = cl(dt || 0, 0, 0.1);
  if (!S.warm) {
    S.warm = true;
    S.lam = LAM0 * exp(0.2 * cl(k[2], -1, 1));
    retune(S, S.lam);
    for (let i = 0; i < 12; i++)
      for (let p = 0; p < NC; p++) (S.re[i][p] = 0.4 * rnd(S)), (S.im[i][p] = 0.4 * rnd(S));
    knobs(S, 10, k);
    for (let i = 0; i < 240; i++) step(S, 0.6);
  }
  knobs(S, ft, k);
  const h = ft * RATE * S.speed, n = max(1, Math.ceil(h / HMAX - 1e-9));
  for (let i = 0; i < n; i++) step(S, h / n);
}

// ---- colour ---------------------------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The envelopes are known at every second pixel in each direction: even pixels take the coarse value, odd ones the mean of the two neighbours.
function field(S, i, out, car, sar) {
  const re = S.re[i], im = S.im[i];
  for (let y = 0; y < H; y++) {
    const cy = y >> 1, cy1 = ((cy + 1) % HC), odd = y & 1;
    for (let x = 0; x < W; x++) {
      const cx = x >> 1, cx1 = (cx + 1) % WC, p = y * W + x;
      let ar, ai;
      if (!odd && !(x & 1)) (ar = re[cy * WC + cx]), (ai = im[cy * WC + cx]);
      else if (!odd) (ar = 0.5 * (re[cy * WC + cx] + re[cy * WC + cx1])), (ai = 0.5 * (im[cy * WC + cx] + im[cy * WC + cx1]));
      else if (!(x & 1)) (ar = 0.5 * (re[cy * WC + cx] + re[cy1 * WC + cx])), (ai = 0.5 * (im[cy * WC + cx] + im[cy1 * WC + cx]));
      else (ar = 0.25 * (re[cy * WC + cx] + re[cy * WC + cx1] + re[cy1 * WC + cx] + re[cy1 * WC + cx1])), (ai = 0.25 * (im[cy * WC + cx] + im[cy * WC + cx1] + im[cy1 * WC + cx] + im[cy1 * WC + cx1]));
      out[p] += ar * car[p] - ai * sar[p];
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  const psi = S.psi, p1 = S.p1;
  psi.fill(0);
  p1.fill(0);
  for (let i = 0; i < 6; i++) field(S, i, p1, S.car[i], S.sar[i]);
  for (let i = 6; i < 12; i++) field(S, i, psi, S.car[i], S.sar[i]);
  let s2 = 0;
  for (let p = 0; p < N; p++) {
    psi[p] += p1[p];
    s2 += psi[p] * psi[p];
  }
  const sd = sqrt(s2 / N) + 1e-6;
  S.sd += (sd - S.sd) * 0.1;
  const out = [0, 0, 0], h0 = S.hue + 0.6;
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const u = psi[p] / S.sd, w = p1[p] / S.sd;
      const body = sstep(-1.7, 0.9, u), peak = sstep(0.4, 2.3, u);
      const v = 255 * (0.1 + 0.55 * body + 0.35 * peak);
      hsv(h0 - 0.46 * sstep(-0.8, 2.2, u) + 0.05 * cl(w, -1.5, 1.5), 0.9 - 0.55 * peak, 1, out, 0);
      display.setPixel(x, y, v * out[0], v * out[1], v * out[2]);
    }
}
