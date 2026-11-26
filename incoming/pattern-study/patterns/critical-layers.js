// ===== Patternflow pattern =====
// Title:   Critical Layers
// Family:  stratosphere
// Idea:    A height section of the equatorial stratosphere, longitude across and altitude up: broad bands of westerly wind in amber and easterly wind in blue slide down the panel and reverse, driven by pale cream phase lines of an eastward and a westward wave that climb from the bottom, lean, crowd together and dissolve exactly where the wind catches up with their speed.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the quasi-biennial oscillation of the tropical stratospheric wind, found by Richard Reed and by Roland Ebdon about 1960 (from memory), explained as waves handing momentum to the mean flow at their critical levels by Richard Lindzen and James Holton (1968) and by Holton and Lindzen (1972) (from memory), solved as a one-dimensional mean-flow model with a wave-flux integral in the manner of R. Alan Plumb (1977) (from memory); original code, pattern round 261
// Round:   261
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flux=0.8..4, Wavenumber=3..7, Asymmetry=-1..1
//
// Knob 1: Hue.
// Knob 2: Flux.
// Knob 3: Wavenumber.
// Knob 4: Asymmetry.

const W = 64, H = 128, NZ = 128;
const { floor, sqrt, abs, exp, sin, cos, pow, min, max, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the model
const NU = 8; // eddy diffusion of the wind, rows^2 per second
const HS = 40; // density scale height in rows
const A0 = 0.03; // wave damping, per row at calm wind and phase speed 1
const EPS = 1e-3;
const STEP = 1 / 30;
const WAVES = [
  { c: 1, w: 1, vis: 0.95, kf: 1 },
  { c: -1, w: 1, vis: 0.95, kf: 1 },
  { c: 0.45, w: 1, vis: 0.4, kf: 0.7 },
  { c: -0.45, w: 1, vis: 0.4, kf: 0.7 },
  { c: 2.2, w: 0.35, vis: 0.6, kf: 0.9 },
  { c: -2.2, w: 0.35, vis: 0.6, kf: 0.9 },
];
const NW = WAVES.length;
const NV = NW; // all are drawn
const AF = 0.62; // how far K4 tilts the forcing toward one direction
const CX = 3.2; // columns a second the phase of a wave of speed 1 travels
const NB = 0.2094; // buoyancy frequency, rad per row at speed 1: vertical wavelength 30 rows

function randn() {
  return (Math.random() + Math.random() + Math.random() + Math.random() + Math.random() + Math.random() - 3) * 1.4142;
}

function makeState() {
  const S = {
    ready: false, t: 0, acc: 0, kn: [0, 2, 3, 0.06],
    U: new Float64Array(NZ), acc1: new Float64Array(NZ), rho: new Float64Array(NZ),
    F: [], Fn: [], ab: [], nz: [], ph: [], phase: [],
    f0: 0.9, asym: 0, kS: 3 * TAU / W,
    sa: new Float64Array(NZ), sb: new Float64Array(NZ), sc: new Float64Array(NZ), sd: new Float64Array(NZ),
    ub: 0,
    // drawing rows
    Phi: [], Amp: [], Cb: [], Sb: [], Ig: [], Glow: new Float32Array(NZ), glw: new Float32Array(NZ),
    cxc: new Float32Array(W * NW), sxc: new Float32Array(W * NW), env: new Float32Array(W * NW), ep: [],
    lut: new Float32Array(3 * 521), hueAt: -1, hueMat: new Float32Array(9), seed: [],
  };
  for (let i = 0; i < NW; i++) {
    S.F.push(new Float64Array(NZ));
    S.Fn.push(new Float64Array(NZ));
    S.ab.push(new Float64Array(NZ));
    S.nz.push(0);
    S.ph.push(Math.random() * TAU);
    S.phase.push(Math.random() * TAU);
    S.ep.push(Math.random() * TAU);
    S.Phi.push(new Float32Array(NZ));
    S.Amp.push(new Float32Array(NZ));
    S.Cb.push(new Float32Array(NZ));
    S.Sb.push(new Float32Array(NZ));
    S.Ig.push(new Float32Array(NZ));
  }
  for (let j = 0; j < NZ; j++) S.rho[j] = exp(-j / HS);
  for (let k = 0; k < 6; k++) S.seed.push(Math.random() * TAU);
  for (let j = 0; j < NZ; j++) S.U[j] = 0.02 * sin(j / 9 + S.seed[0]);
  // the implicit diffusion matrix is constant: factor it once
  const r = NU * STEP;
  for (let j = 0; j < NZ; j++) {
    S.sa[j] = -r; // lower
    S.sb[j] = 1 + 2 * r; // diagonal
    S.sc[j] = -r; // upper
  }
  S.sb[0] = 1; S.sc[0] = 0;
  S.sa[NZ - 1] = -2 * r;
  for (let j = 1; j < NZ; j++) {
    const m = S.sa[j] / S.sb[j - 1];
    S.sb[j] -= m * S.sc[j - 1];
    S.sd[j] = m;
  }
  return S;
}

export function setup(params) {
  params.s = makeState();
}

function step(S) {
  const U = S.U, acc = S.acc1, rho = S.rho, t = S.t;
  const TC = 10, NS = 0.8;
  acc.fill(0);
  const fl = S.f0;
  for (let i = 0; i < NW; i++) {
    const wv = WAVES[i], c = wv.c, a = A0 * abs(c);
    S.nz[i] += (-S.nz[i] * STEP) / TC + sqrt((2 * STEP) / TC) * NS * randn();
    const fac = 1 + 0.7 * tanh(S.nz[i] / 0.8);
    const dirf = c > 0 ? 1 + AF * S.asym : 1 - AF * S.asym;
    let f = fl * wv.w * dirf * fac;
    const F = S.F[i], ab = S.ab[i], Fn = S.Fn[i];
    const sg = c > 0 ? 1 : -1;
    Fn[0] = fl * wv.w * dirf; // the flux the source asks for, noise aside
    for (let j = 0; j < NZ - 1; j++) {
      F[j] = f;
      const d = c - 0.5 * (U[j] + U[j + 1]);
      let tau = a / (d * d + EPS);
      if (tau > 30) tau = 30;
      const e = exp(-tau);
      ab[j] = 1 - e;
      const fo = f * e;
      acc[j] += (sg * (f - fo)) / (0.5 * (rho[j] + rho[j + 1]));
      f = fo;
      Fn[j + 1] = Fn[j] * exp(-a / (c * c));
    }
    F[NZ - 1] = f;
    ab[NZ - 1] = 0;
  }
  // the semi-annual push at the top
  const sao = 0.14 * sin((TAU * t) / 17 + S.seed[1]) * (0.7 + 0.3 * sin((TAU * t) / 53 + S.seed[2]));
  for (let j = 0; j < NZ; j++) acc[j] += sao * exp(-(NZ - 1 - j) / 12);
  // the wind at the tropopause is not quite still
  S.ub = 0.26 * (0.6 * sin((TAU * t) / 53 + S.seed[3]) + 0.4 * sin((TAU * t) / 31 + S.seed[4]));
  // implicit diffusion (Thomas)
  const rh = S.acc1; // reuse: rh = U + dt acc
  for (let j = 0; j < NZ; j++) rh[j] = U[j] + STEP * acc[j];
  rh[0] = S.ub;
  for (let j = 1; j < NZ; j++) rh[j] -= S.sd[j] * rh[j - 1];
  U[NZ - 1] = rh[NZ - 1] / S.sb[NZ - 1];
  for (let j = NZ - 2; j >= 0; j--) U[j] = (rh[j] - S.sc[j] * U[j + 1]) / S.sb[j];
  for (let j = 0; j < NZ; j++) U[j] = cl(U[j], -1.3, 1.3);
  S.t += STEP;
}

function control(S, kn, d) {
  const f0 = 0.38 * cl(kn[1], 0.8, 4);
  const k = 1 - exp(-d / 1.5);
  S.f0 += (f0 - S.f0) * k;
  S.asym += (cl(kn[3], -1, 1) - S.asym) * k;
}

function preroll(S, kn) {
  S.f0 = 0.38 * cl(kn[1], 0.8, 4);
  S.asym = cl(kn[3], -1, 1);
  S.kS = (cl(kn[2], 3, 7) * TAU) / W;
  const n = 3000 + floor(Math.random() * 2000);
  for (let k = 0; k < n; k++) step(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 2, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  if (!S.ready) {
    S.ready = true;
    preroll(S, kn);
  }
  control(S, kn, d);
  const kt = (cl(kn[2], 3, 7) * TAU) / W;
  S.kS += (kt - S.kS) * (1 - exp(-d / 0.8));
  S.acc += d;
  while (S.acc >= STEP) {
    S.acc -= STEP;
    step(S);
  }
  for (let i = 0; i < NW; i++) {
    S.phase[i] += S.kS * WAVES[i].kf * WAVES[i].c * CX * d;
    S.ep[i] += d * (0.11 + 0.037 * i) * (i & 1 ? -1 : 1); // the zonal envelope of each wave drifts at its own pace
  }
}

// ---- the picture
const RAMP = [
  [-1.0, 72, 152, 255],
  [-0.75, 38, 108, 238],
  [-0.5, 28, 74, 188],
  [-0.25, 24, 48, 124],
  [-0.08, 24, 34, 72],
  [0.0, 28, 30, 54],
  [0.08, 62, 46, 34],
  [0.25, 124, 84, 36],
  [0.5, 196, 122, 36],
  [0.75, 244, 160, 42],
  [1.0, 255, 192, 72],
];
const CREAM = [255, 246, 224];

function hueLut(S, hue) {
  if (S.hueAt === hue) return;
  const A = -TAU * hue, c = cos(A), s = sin(A), m = S.hueMat;
  m[0] = 0.213 + c * 0.787 - s * 0.213; m[1] = 0.715 - c * 0.715 - s * 0.715; m[2] = 0.072 - c * 0.072 + s * 0.928;
  m[3] = 0.213 - c * 0.213 + s * 0.143; m[4] = 0.715 + c * 0.285 + s * 0.14; m[5] = 0.072 - c * 0.072 - s * 0.283;
  m[6] = 0.213 - c * 0.213 - s * 0.787; m[7] = 0.715 - c * 0.715 + s * 0.715; m[8] = 0.072 + c * 0.928 + s * 0.072;
  const lut = S.lut;
  let k = 0;
  for (let n = 0; n <= 520; n++) {
    const u = -1.3 + (n / 520) * 2.6;
    const uc = cl(u, -1, 1);
    while (k < RAMP.length - 2 && uc > RAMP[k + 1][0]) k++;
    const a = RAMP[k], b = RAMP[k + 1], tt = cl((uc - a[0]) / (b[0] - a[0]), 0, 1);
    const r = a[1] + (b[1] - a[1]) * tt, g = a[2] + (b[2] - a[2]) * tt, bl = a[3] + (b[3] - a[3]) * tt;
    lut[n * 3] = cl(r * m[0] + g * m[1] + bl * m[2], 0, 255);
    lut[n * 3 + 1] = cl(r * m[3] + g * m[4] + bl * m[5], 0, 255);
    lut[n * 3 + 2] = cl(r * m[6] + g * m[7] + bl * m[8], 0, 255);
  }
  S.hueAt = hue;
}

// per level: the phase of each wave, its amplitude, and the constants the pixel loop needs
function prepare(S) {
  const U = S.U;
  const sig = 0.85;
  const u2 = cl(S.kn[1], 0.8, 4) / 4;
  S.Glow.fill(0);
  for (let i = 0; i < NV; i++) {
    const wv = WAVES[i], c = wv.c, a = A0 * c * c, k = S.kS * wv.kf, k2 = k * k;
    const Phi = S.Phi[i], Amp = S.Amp[i], Cb = S.Cb[i], Sb = S.Sb[i], Ig = S.Ig[i];
    const dirf = c > 0 ? 1 + AF * S.asym : 1 - AF * S.asym;
    const bright = wv.vis * sqrt(cl(dirf, 0.05, 2)) * (0.62 + 0.38 * u2);
    const F = S.F[i], Fn = S.Fn[i], ab = S.ab[i];
    let phi = 0;
    for (let j = 0; j < NZ; j++) {
      let d = c - U[j];
      const ad = abs(d);
      if (ad < 0.05) d = d < 0 ? -0.05 : 0.05;
      const m = -NB / d;
      if (j > 0) phi += 0.5 * (m + S.mPrev);
      S.mPrev = m;
      Phi[j] = phi + S.phase[i];
      Cb[j] = cos(Phi[j]);
      Sb[j] = sin(Phi[j]);
      const g2 = k2 + m * m, g = sqrt(g2);
      Ig[j] = 1 / (g2 * sig * sig);
      const ar = sqrt(cl(F[j] / (Fn[j] + 1e-9), 0, 1));
      Amp[j] = bright * ar * sm(1.55, 0.85, g);
      S.Glow[j] += ar * sm(0.12, 0.6, ab[j]) * (0.5 + 0.5 * bright);
    }
  }
  // blur the glow a little so it is a seam and not a hair
  const gl = S.Glow, o = S.glw;
  for (let j = 0; j < NZ; j++) {
    const a1 = gl[max(0, j - 2)], a2 = gl[max(0, j - 1)], a3 = gl[j], a4 = gl[min(NZ - 1, j + 1)], a5 = gl[min(NZ - 1, j + 2)];
    o[j] = (a1 + 2 * a2 + 3 * a3 + 2 * a4 + a5) / 9;
  }
  for (let i = 0; i < NV; i++) {
    const kk = S.kS * WAVES[i].kf;
    for (let x = 0; x < W; x++) {
      S.cxc[i * W + x] = cos(kk * (x - 31.5));
      S.sxc[i * W + x] = sin(kk * (x - 31.5));
      S.env[i * W + x] = 0.4 + 0.6 * sm(-0.5, 0.7, cos((TAU * (x - 31.5)) / (86 - 9 * i) + S.ep[i]));
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  hueLut(S, cl(S.kn[0], 0, 1));
  prepare(S);
  const U = S.U, lut = S.lut, cxc = S.cxc, sxc = S.sxc, glw = S.glw;
  const ETA = 1.6, USTRIPE = 0.14;
  for (let y = 0; y < H; y++) {
    const j = H - 1 - y;
    for (let x = 0; x < W; x++) {
      let L = 0, du = 0, eta = 0;
      for (let i = 0; i < NV; i++) {
        const A = S.Amp[i][j];
        if (A < 0.01) continue;
        const cx = cxc[i * W + x], sx = sxc[i * W + x], en = S.env[i * W + x];
        const cb = S.Cb[i][j], sb = S.Sb[i][j];
        const cth = cx * cb - sx * sb, sth = sx * cb + cx * sb;
        du += USTRIPE * A * cth;
        eta += ETA * A * sth;
        const q = (1 - cth) * S.Ig[i][j];
        if (q < 14) {
          const v = A * en * (exp(-q) + 0.2 * exp(-0.2 * q));
          L = L + v - L * v;
        }
      }
      let jj = j + eta;
      jj = jj < 0 ? 0 : jj > NZ - 1.001 ? NZ - 1.001 : jj;
      const j0 = jj | 0, fj = jj - j0;
      const u = (U[j0] * (1 - fj) + U[j0 + 1] * fj) + du;
      const li = ((cl(u, -1.3, 1.3) + 1.3) * 200 + 0.5) | 0;
      let r = lut[li * 3], g = lut[li * 3 + 1], b = lut[li * 3 + 2];
      const gv = glw[j] * 0.3;
      if (gv > 0.01) { r += (CREAM[0] - r) * gv; g += (CREAM[1] - g) * gv; b += (CREAM[2] - b) * gv; }
      if (L > 0.01) { const a = L > 1 ? 1 : L; r += (CREAM[0] - r) * a; g += (CREAM[1] - g) * a; b += (CREAM[2] - b) * a; }
      display.setPixel(x, y, r | 0, g | 0, b | 0);
    }
  }
}
