// ===== Patternflow pattern =====
// Title:   Chimera Sea
// Family:  rhythm
// Idea:    Every LED is the same phase oscillator pulled by all the LEDs within a radius, with the pull's phase lag a little short of a quarter turn, and the sheet splits by itself into islands that move in step and a sea whose phases scatter.
// Author:  patternflow-lab
// Date:    2026-11-11
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: nonlocal Kuramoto-Sakaguchi sheet, chimera states (Yoshiki Kuramoto and Dorjsuren Battogtokh, 2002; Daniel Abrams and Steven Strogatz, 2004; Hidetsugu Sakaguchi and Kuramoto, 1986; spiral-wave chimeras Shima and Kuramoto, 2004, Martens, Laing and Strogatz, 2010; all from memory)
// Round:   128
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.8..3, Scale=-1..1, Lag=-1..1
//
// Knob 1: Hue. Turns the colours.
// Knob 2: Speed. Time.
// Knob 3: Scale. Coupling radius.
// Knob 4: Lag. Phase lag.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, atan2, exp, min, max, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

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
const PX = plan(W), PY = plan(H);
const TR = new Float64Array(H), TI = new Float64Array(H);

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
  for (let y = 0; y < H; y++) fft(PX, re, im, y * W, inv);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) (TR[y] = re[y * W + x]), (TI[y] = im[y * W + x]);
    fft(PY, TR, TI, 0, inv);
    for (let y = 0; y < H; y++) (re[y * W + x] = TR[y]), (im[y * W + x] = TI[y]);
  }
}

// ---- the sheet ------------------------------------------------------------------------------
const DTMAX = 0.3; // largest model step, time units
const PREROLL = 300; // steps of DTMAX run before the first frame
const RATE = 2; // model time units a panel second at Speed 1
const OPEN = [0, 2, 0, 0.06];

function setup(params) {
  const f = () => new Float64Array(N);
  const S = {
    th: f(), tp: f(), f1: f(), f2: f(), c1: f(), s1: f(), z1r: f(), z1i: f(), c2: f(), s2: f(), z2r: f(), z2i: f(),
    G: f(), Gi: f(), R: 0, Rk: -1, beta: 0.15, om: 0, ca: 0, sa: 0, hue: 0, speed: 2, warm: false, t: 0,
  };
  params.s = S;
  return S;
}

// The disc kernel G, 1 inside radius R and falling to 0 across one LED, normalised to sum 1 (so a state in step has |Z| = 1), laid out from the origin
// with its wrap round the torus. It is even, so its transform is real; S.G keeps that transform divided by N, ready for the inverse.
function disc(R, g) {
  let sum = 0;
  for (let y = 0; y < H; y++) {
    const dy = y < H / 2 ? y : y - H;
    for (let x = 0; x < W; x++) {
      const dx = x < W / 2 ? x : x - W, w = cl(R + 0.5 - sqrt(dx * dx + dy * dy), 0, 1);
      g[y * W + x] = w;
      sum += w;
    }
  }
  for (let p = 0; p < N; p++) g[p] /= sum;
}
function kernel(S) {
  const g = S.G, gi = S.Gi;
  disc(S.R, g);
  gi.fill(0);
  fft2(g, gi, false);
  for (let p = 0; p < N; p++) g[p] /= N;
  S.Rk = S.R;
}

// d theta / dt = om - Im(e^{i(theta + alpha)} conj(Z)), Z = G * e^{i theta}; alpha = pi/2 - beta.
function deriv(S, th, out, c, s, zr, zi) {
  const G = S.G, ca = S.ca, sa = S.sa, om = S.om;
  for (let p = 0; p < N; p++) {
    c[p] = zr[p] = cos(th[p]);
    s[p] = zi[p] = sin(th[p]);
  }
  fft2(zr, zi, false);
  for (let p = 0; p < N; p++) (zr[p] *= G[p]), (zi[p] *= G[p]);
  fft2(zr, zi, true);
  for (let p = 0; p < N; p++) out[p] = om - ((s[p] * ca + c[p] * sa) * zr[p] - (c[p] * ca - s[p] * sa) * zi[p]);
}

// One Heun step of h.
function step(S, h) {
  const { th, tp, f1, f2 } = S;
  deriv(S, th, f1, S.c1, S.s1, S.z1r, S.z1i);
  for (let p = 0; p < N; p++) tp[p] = th[p] + h * f1[p];
  deriv(S, tp, f2, S.c2, S.s2, S.z2r, S.z2i);
  for (let p = 0; p < N; p++) th[p] += 0.5 * h * (f1[p] + f2[p]);
}

// Knobs to parameters: R and beta follow the knobs with a 0.3 s lag, so turning one moves the sheet's state along instead of jumping it.
function params_(S, ft, k) {
  S.hue = k[0];
  S.speed = cl(k[1], 0.8, 3);
  const Rt = 8 * exp(0.4 * cl(k[2], -1, 1)), bt = 0.145 * exp(0.5 * cl(k[3], -1, 1)), a = 1 - exp(-ft / 0.3);
  S.R += (Rt - S.R) * a;
  S.beta += (bt - S.beta) * a;
  if (abs(S.R - S.Rk) > 0.03) kernel(S);
  S.ca = sin(S.beta);
  S.sa = cos(S.beta);
  S.om = S.sa;
}

function advance(S, ft, k) {
  params_(S, ft, k);
  const h = ft * RATE * S.speed, n = max(1, Math.ceil(h / DTMAX - 1e-9));
  for (let i = 0; i < n; i++) step(S, h / n);
  S.t += h;
  for (let p = 0; p < N; p++) if (S.th[p] > 100 || S.th[p] < -100) S.th[p] -= TAU * Math.round(S.th[p] / TAU);
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  if (!S.warm) {
    S.warm = true;
    S.R = 8 * exp(0.4 * cl(k[2], -1, 1));
    S.beta = 0.145 * exp(0.5 * cl(k[3], -1, 1));
    // A smooth random start (40 waves of up to 8 cycles across the panel's height) under white noise.
    for (let m = 0; m < 40; m++) {
      const kx = (TAU * (floor(Math.random() * 9) - 4)) / W, ky = (TAU * (floor(Math.random() * 17) - 8)) / H, ph = Math.random() * TAU, am = 2 * Math.random() - 1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) S.th[y * W + x] += am * cos(kx * x + ky * y + ph);
    }
    for (let p = 0; p < N; p++) S.th[p] += (Math.random() - 0.5) * PI;
    kernel(S);
    params_(S, 10, k);
    for (let i = 0; i < PREROLL; i++) step(S, DTMAX);
  }
  advance(S, cl(dt || 0, 0, 0.1), k);
}

// ---- colour ---------------------------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
const LUT = new Float32Array(1024 * 3);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// 1-2-1 blur on the torus of a (re, im) pair, in place, through tmp.
function blur(a, b, tm) {
  for (const f of [a, b]) {
    for (let y = 0; y < H; y++) {
      const o = y * W;
      for (let x = 0; x < W; x++) tm[o + x] = 0.25 * f[o + (x + W - 1) % W] + 0.5 * f[o + x] + 0.25 * f[o + (x + 1) % W];
    }
    for (let y = 0; y < H; y++) {
      const o = y * W, om = ((y + H - 1) % H) * W, op = ((y + 1) % H) * W;
      for (let x = 0; x < W; x++) f[o + x] = 0.25 * tm[om + x] + 0.5 * tm[o + x] + 0.25 * tm[op + x];
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  const D = params.dbg || {};
  const { z1r, z1i } = S, h0 = S.hue + (D.h0 ?? 0.66);
  const HA = D.HA ?? 0.19, VB = D.VB ?? 0.18, SA = D.SA ?? 0.82, VM = D.VM ?? 0.8;
  for (let i = 0; i < 1024; i++) {
    const u = (i / 1024) * TAU;
    hsv(h0 + HA * cos(u), SA, VM + VB * sin(u), LUT, i * 3);
  }
  const lo = D.lo ?? 0.3, hi = D.hi ?? 0.78, vmin = D.vmin ?? 0.22, sm = D.sm ?? 1, sg = D.sg ?? 0.9;
  const bc = S.bc || (S.bc = new Float64Array(N)), bs = S.bs || (S.bs = new Float64Array(N)), tm = S.tm || (S.tm = new Float64Array(N));
  bc.set(S.c1);
  bs.set(S.s1);
  for (let i = 0; i < sm; i++) blur(bc, bs, tm);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      let u = atan2(bs[p], bc[p]) / TAU;
      u -= floor(u);
      const m = sqrt(bc[p] * bc[p] + bs[p] * bs[p]);
      const z = sqrt(z1r[p] * z1r[p] + z1i[p] * z1i[p]);
      let v = vmin + (1 - vmin) * sstep(lo, hi, z);
      if (sg) v *= 1 - sg + sg * Math.pow(m, 0.5);
      v *= 255;
      const o = ((u * 1024) | 0) * 3;
      display.setPixel(x, y, v * LUT[o], v * LUT[o + 1], v * LUT[o + 2]);
    }
}
