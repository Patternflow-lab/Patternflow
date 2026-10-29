// ===== Patternflow pattern =====
// Title:   Multiplicative Chaos
// Family:  noise
// Idea:    A log-correlated Gaussian field X on the panel's 64 by 128 lattice, reaching a quarter of an LED, is drawn as a deep blue relief lit from the upper left, and its Gaussian multiplicative chaos exp(gamma X - gamma^2 E[X^2] / 2), each LED's share of the frame's mass, glows over it from rose through gold to white: at gamma 1 the glow is a gold lace over the high ground that holds half the mass on about 78 LEDs, and as gamma rises past the critical value 2 it drains onto one or two white points on the highest ground, while every mode of the field wanders slowly so the lace drifts, splits and gathers somewhere else.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Gaussian multiplicative chaos (Jean-Pierre Kahane, "Sur le chaos multiplicatif", Ann. Sci. Math. Québec 9, 1985), its critical gamma = sqrt(2d) and thick points as reviewed by Rémi Rhodes and Vincent Vargas (Probability Surveys 11, 2014), pattern round 70
// Round:   70
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Gamma=1..2.5, Cutoff=0..1
//
// Knob 1: Hue. Turns relief and glow round the wheel together: at 0 a deep blue relief under a glow that runs rose, orange, gold to white; at 0.25 a magenta relief under green, at 0.5 a yellow one under sky blue, at 0.75 a green one under magenta.
// Knob 2: Speed. Every mode of the field wanders as its own Ornstein-Uhlenbeck process, smoothed in time. At 2 the longest wave, 128 rows, forgets itself in 8 s and the finest, with the octaves below the LED, in 1.6 s; at 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Gamma. From 1 to 2.5, critical at 2. Averaged over 20 fields: at 1 a third of the LEDs glow (each holds more than 0.14 of an even share), the brightest 1% hold 52% of the mass and half of it lies on 78 LEDs, where X is near gamma E[X^2]; at 1.6 9% glow, 1% hold 90% and half sits on 6 LEDs; at 2 5% glow and half sits on 3; at 2.4 2% glow and one or two LEDs hold half. Past 1.3 the mass stops following gamma E[X^2] up and freezes on the field's highest LEDs, which on this lattice stand at 1.47 E[X^2], short of the 2 E[X^2] the maximum tends to as a lattice grows.
// Knob 4: Cutoff. The finest scale the field reaches, epsilon = 2^(6 (k - 0.06) - 2) LEDs: at the opening 0.06 a quarter of an LED, the two octaves below the LED drawn LED by LED, so relief and glow are grainy at every LED; at 0.39 one LED, the field blurred to its lattice modes and the lace turned into soft gold clouds; 4 LEDs at 0.72 and 12.5 at 1, where the field is a few hills and 95% of the LEDs glow a dim rust red, the measure close to even.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, exp, log, cos, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- FFT, radix 2, in place, on rows of 64 and columns of 128.
const CT = new Float64Array(64), ST = new Float64Array(64);
for (let i = 0; i < 64; i++) (CT[i] = cos((2 * PI * i) / 128)), (ST[i] = sin((2 * PI * i) / 128));
function revTable(n) {
  const r = new Int32Array(n), b = Math.log2(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let k = 0; k < b; k++) if (i & (1 << k)) v |= 1 << (b - 1 - k);
    r[i] = v;
  }
  return r;
}
const REV64 = revTable(64), REV128 = revTable(128);
function fft(re, im, n, off, step, rev) {
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      const a = off + i * step, b = off + j * step;
      let t = re[a];
      re[a] = re[b];
      re[b] = t;
      t = im[a];
      im[a] = im[b];
      im[b] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, ts = 128 / len;
    for (let s = 0; s < n; s += len)
      for (let k = 0; k < half; k++) {
        const wr = CT[k * ts], wi = ST[k * ts];
        const a = off + (s + k) * step, b = a + half * step;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
  }
}
function fft2(re, im) {
  for (let y = 0; y < H; y++) fft(re, im, W, y * W, 1, REV64);
  for (let x = 0; x < W; x++) fft(re, im, H, x, W, REV128);
}

// ---- The field's modes on the 64 x 128 torus, so it wraps round left to
// right and top to bottom. Mode (m, n) has the eigenvalue LA of minus the
// lattice Laplacian and standard deviation sqrt(2 pi / (LA N)), the
// discrete Gaussian free field scaled so its covariance goes as log(1 / r):
// C(r) - C(2r) comes to 0.71, 0.71 and 0.68 for r = 1, 2 and 4 LEDs against
// log 2 = 0.69, and E[X^2] to 4.99. In that normalisation the critical gamma
// is sqrt(2d) = 2. The modes are complex, so one transform gives two
// independent fields, its real and imaginary parts; the real one is drawn.
const LA = new Float64Array(N), AMP = new Float64Array(N), TAU = new Float64Array(N);
for (let n = 0; n < H; n++)
  for (let m = 0; m < W; m++) {
    const i = n * W + m, l = 4 - 2 * cos((2 * PI * m) / W) - 2 * cos((2 * PI * n) / H);
    LA[i] = l;
    AMP[i] = i ? sqrt((2 * PI) / (l * N)) : 0;
  }
// Each mode's time constant against the longest wave's: the finest lattice
// mode turns over five times as fast, and so do the octaves below the LED.
const LMIN = 4 - 2 * cos((2 * PI) / H) - 2;
for (let i = 1; i < N; i++) TAU[i] = (LMIN / LA[i]) ** 0.2;
const TAUF = (LMIN / 8) ** 0.2;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// Standard normal deviates, drawn once and then picked at random. The table
// is moved to mean 0 and variance 1: a table mean of 0.01 picked 8,192
// times a frame would add up, through every mode at once, into a bump.
const NT = new Float64Array(8192);
function fillNormals() {
  let m = 0, v = 0;
  for (let i = 0; i < 8192; i += 2) {
    const a = sqrt(-2 * log(1 - Math.random())), b = 2 * PI * Math.random();
    NT[i] = a * cos(b);
    NT[i + 1] = a * sin(b);
    m += NT[i] + NT[i + 1];
  }
  m /= 8192;
  for (let i = 0; i < 8192; i++) v += (NT[i] -= m) ** 2;
  v = sqrt(v / 8192);
  for (let i = 0; i < 8192; i++) NT[i] /= v;
}
const gauss = () => NT[(Math.random() * 8192) | 0];

export function setup(params) {
  fillNormals();
  const S = (params.s = {
    hue: 0, speed: 2, gam: 1, cut: 0, eps: -1, qd: -1, vl: 1, vf: 0,
    zr: new Float64Array(N), zi: new Float64Array(N), ar: new Float64Array(N), ai: new Float64Array(N),
    fz: new Float64Array(N), fa: new Float64Array(N),
    Q: new Float64Array(N), Z: new Float64Array(N), R: new Float64Array(N), F: new Float64Array(N),
    re: new Float64Array(N), im: new Float64Array(N), X: new Float64Array(N),
    rel: new Float64Array(RT * 3), glo: new Float64Array(GT * 4), th: -1,
  });
  // Each mode starts in its stationary law: the filtered value has variance
  // 2/3 and covariance 2/3 with the process it filters.
  const start = (z, a) => {
    for (let i = 0; i < N; i++) {
      z[i] = gauss();
      a[i] = (2 / 3) * z[i] + 0.4714 * gauss();
    }
  };
  start(S.zr, S.ar);
  start(S.zi, S.ai);
  start(S.fz, S.fa);
  return S;
}

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] ?? 2, 0.2, 3);
  S.gam = cl(k[2] ?? 1, 0, 3);
  S.cut = cl(k[3] ?? 0.06, 0, 1);
  // The cutoff epsilon in LEDs. Below one LED the lattice modes are all kept
  // and the octaves between epsilon and the LED, log(1 / epsilon) of
  // variance, are drawn as an independent normal at each LED: at a quarter
  // of an LED they carry 1.39 of the field's 6.37. Above it the lattice
  // modes are blurred by a Gaussian of width epsilon.
  const eps = 2 ** (6 * (S.cut - 0.06) - 2);
  if (eps !== S.eps) {
    S.eps = eps;
    const e2 = max(0, eps * eps - 1 / 16);
    let v = 0;
    for (let i = 1; i < N; i++) {
      const f = exp((-LA[i] * e2) / 2);
      S.F[i] = AMP[i] * f * sqrt(1.5);
      v += (AMP[i] * f) ** 2;
    }
    S.vl = v;
    S.vf = max(0, log(1 / eps));
  }
  // Ornstein-Uhlenbeck steps seen through an exponential filter of half the
  // time constant, which smooths each path in time; the filter leaves 2/3 of
  // the variance, which F gives back. The longest wave's time constant is
  // 8 s at Speed 2.
  const qd = (d * S.speed) / (8 * 2);
  if (qd !== S.qd) {
    S.qd = qd;
    for (let i = 1; i < N; i++) {
      const q = exp(-qd / TAU[i]);
      S.Q[i] = q;
      S.Z[i] = sqrt(1 - q * q);
      S.R[i] = q * q;
    }
    const q = exp(-qd / TAUF);
    S.fq = q;
    S.fzz = sqrt(1 - q * q);
    S.fr = q * q;
  }
  const { zr, zi, ar, ai, Q, Z, R, F, re, im, fz, fa, X } = S;
  for (let i = 1; i < N; i++) {
    zr[i] = zr[i] * Q[i] + Z[i] * gauss();
    zi[i] = zi[i] * Q[i] + Z[i] * gauss();
    ar[i] = ar[i] * R[i] + zr[i] * (1 - R[i]);
    ai[i] = ai[i] * R[i] + zi[i] * (1 - R[i]);
    re[i] = ar[i] * F[i];
    im[i] = ai[i] * F[i];
  }
  re[0] = im[0] = 0;
  fft2(re, im);
  const sf = sqrt(S.vf * 1.5), fq = S.fq, fzz = S.fzz, fr = S.fr;
  for (let i = 0; i < N; i++) {
    fz[i] = fz[i] * fq + fzz * gauss();
    fa[i] = fa[i] * fr + fz[i] * (1 - fr);
    X[i] = re[i] + sf * fa[i];
  }
}

// ---- Drawing. The relief: the field's height t = X / sd tints and lifts
// it, and its slope toward the upper left (the sum of the two central
// differences, halved) shades it. The glow: lm, the log of the LED's share
// of the frame's mass against an even share, read from LO (e^-2, 0.14 of an
// even share) to HI (e^3.5, 33 times one).
const KS = 0.4, KB = 0.16, LO = -2, HI = 3.5;
// Relief colours over t from -3 to 3 in 64 steps; glow colours, with the
// glow's own weight a and what is left of the relief k, over 256 steps.
const RT = 64, GT = 256;
function tables(S) {
  const c = [0, 0, 0];
  for (let j = 0; j < RT; j++) {
    hsv(0.64 + S.hue - 0.03 * ((6 * j) / (RT - 1) - 3), 0.85, 1, c);
    S.rel[j * 3] = c[0];
    S.rel[j * 3 + 1] = c[1];
    S.rel[j * 3 + 2] = c[2];
  }
  for (let j = 0; j < GT; j++) {
    const w = j / (GT - 1), a = min(1, 0.25 + 1.2 * w);
    hsv(0.93 + S.hue + 0.22 * min(1, w * 1.25), 1 - w ** 4, 0.45 + 0.55 * w, c);
    S.glo[j * 4] = 255 * a * c[0];
    S.glo[j * 4 + 1] = 255 * a * c[1];
    S.glo[j * 4 + 2] = 255 * a * c[2];
    S.glo[j * 4 + 3] = 1 - 0.85 * a;
  }
  S.th = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.th !== S.hue) tables(S);
  const X = S.X, g = S.gam, rel = S.rel, glo = S.glo, isd = 1 / sqrt(S.vl + S.vf), ts = (RT - 1) / 6;
  // Each LED's share of the frame's mass: the log of the mean density is
  // taken off, summed from the largest value down so it cannot overflow.
  // The constant -g^2 E[X^2] / 2 of the chaos cancels in the share.
  let mx = -1e9;
  for (let i = 0; i < N; i++) if (X[i] > mx) mx = X[i];
  let sum = 0;
  for (let i = 0; i < N; i++) sum += exp(g * (X[i] - mx));
  const off = g * mx + log(sum / N), gw = (GT - 1) / (HI - LO);
  for (let y = 0; y < H; y++) {
    const r0 = y * W, ru = ((y + H - 1) & 127) * W, rd = ((y + 1) & 127) * W;
    for (let x = 0; x < W; x++) {
      const p = r0 + x, v = X[p];
      const sh = (X[r0 + ((x + W - 1) & 63)] - X[r0 + ((x + 1) & 63)] + X[ru + x] - X[rd + x]) * 0.5;
      const t = v * isd, tj = cl(((t + 3) * ts) | 0, 0, RT - 1) * 3;
      const val = 255 * cl(0.38 + KB * t + KS * sh, 0.02, 1);
      let r = rel[tj] * val, gg = rel[tj + 1] * val, b = rel[tj + 2] * val;
      const lm = g * v - off;
      if (lm > LO) {
        const q = min(GT - 1, ((lm - LO) * gw) | 0) * 4, k = glo[q + 3];
        r = r * k + glo[q];
        gg = gg * k + glo[q + 1];
        b = b * k + glo[q + 2];
      }
      display.setPixel(x, y, r > 255 ? 255 : r | 0, gg > 255 ? 255 : gg | 0, b > 255 ? 255 : b | 0);
    }
  }
}
