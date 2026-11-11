// ===== Patternflow pattern =====
// Title:   Fuzzy Dark Matter
// Family:  physics
// Idea:    DRAFT
// Author:  patternflow-lab
// Date:    2026-11-11
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft
// Round:   128
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Epoch=0.5..4, Scale=-1..1, Pull=-1..1
//
// Knob 1: Hue. draft
// Knob 2: Epoch. draft
// Knob 3: Scale. draft
// Knob 4: Pull. draft

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, exp, log, min, max, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];

// tunables (draft)
const CFG = { G0: 5e-5, DT: 0.2, R0: 6, JH: 0.002, KH: 0.5, WH: 0.2, LAM: 0.02, MMIN: 600, MMAX: 1100, TIN: 10, VMAX: 0.2, NSEED: 4, WARM: 150 };

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
function gauss() {
  let u = Math.random();
  while (u < 1e-12) u = Math.random();
  return sqrt(-2 * log(u)) * cos(TAU * Math.random());
}

// ---- the field ------------------------------------------------------------------------------
function setup(params, k) {
  const S = {
    t: 0, acc: 0, warm: false, hue: 0, s: 1, g: 1, G: 0, R: 3, kdt: 0, kG: 0, dt: CFG.DT,
    re: new Float64Array(N), im: new Float64Array(N), phi: new Float64Array(N), tr: new Float64Array(N), ti: new Float64Array(N),
    K2: new Float64Array(N), Dr: new Float64Array(N), Di: new Float64Array(N), Pk: new Float64Array(N), RHO: new Float32Array(N),
    bh: [], bs: 0, lumps: [], nb: 0, gx: new Float64Array(64), gy: new Float64Array(64), cx: new Float64Array(64), sx: new Float64Array(64), cy: new Float64Array(64), sy: new Float64Array(64),
  };
  for (let y = 0; y < H; y++) {
    const ny = y < H / 2 ? y : y - H, ky = (TAU * ny) / H;
    for (let x = 0; x < W; x++) {
      const nx = x < W / 2 ? x : x - W, kx = (TAU * nx) / W;
      S.K2[y * W + x] = kx * kx + ky * ky;
    }
  }
  params.s = S;
  return S;
}
function bands(S) {
  S.bs = S.s;
  S.bh = [];
  for (let p = 1; p < N; p++) {
    const kk = sqrt(S.K2[p]) * S.s;
    if (abs(kk - CFG.KH) < CFG.WH) S.bh.push(p);
  }
}
function abs(v) {
  return v < 0 ? -v : v;
}
function constants(S) {
  const G = S.g * CFG.G0 / pow(S.s, 4);
  if (G !== S.kG) {
    S.kG = G;
    for (let p = 0; p < N; p++) S.Pk[p] = S.K2[p] > 0 ? (-4 * PI * G) / S.K2[p] : 0;
  }
  if (abs(S.dt - S.kdt) > 0.003 * S.dt) {
    S.kdt = S.dt;
    for (let p = 0; p < N; p++) {
      const th = 0.5 * S.dt * S.K2[p];
      S.Dr[p] = cos(th) / N;
      S.Di[p] = -sin(th) / N;
    }
  }
  if (abs(S.s - S.bs) > 0.01) bands(S);
}
function step(S) {
  const { re, im, tr, ti, phi, Dr, Di, Pk } = S, dt = S.dt;
  fft2(re, im, false);
  for (let p = 0; p < N; p++) {
    const a = re[p], b = im[p], kr = Dr[p], ki = Di[p];
    re[p] = a * kr - b * ki;
    im[p] = a * ki + b * kr;
  }
  // fresh waves in
  const nh = S.bh.length, eh = sqrt((CFG.JH * dt) / (2 * nh));
  for (let i = 0; i < nh; i++) {
    const p = S.bh[i];
    re[p] += eh * gauss();
    im[p] += eh * gauss();
  }
  fft2(re, im, true);
  lumps(S, dt);
  // gravity: lap phi = 4 pi G (rho - mean)
  let sum = 0;
  for (let p = 0; p < N; p++) {
    const r = re[p] * re[p] + im[p] * im[p];
    tr[p] = r;
    ti[p] = 0;
    sum += r;
  }
  const nrm = sqrt(N / sum);
  fft2(tr, ti, false);
  for (let p = 0; p < N; p++) {
    tr[p] *= Pk[p];
    ti[p] *= Pk[p];
  }
  fft2(tr, ti, true);
  const sc = 1 / N;
  for (let p = 0; p < N; p++) {
    const th = dt * tr[p] * sc * nrm * nrm, c = cos(th), s = sin(th), a = re[p] * nrm, b = im[p] * nrm;
    re[p] = a * c + b * s;
    im[p] = b * c - a * s;
  }
}
// A lump is a Gaussian density with sigma sg, amplitude A, a phase gradient (vx, vy); it is laid in over TIN model time units.
function newLump(S, x, y, full) {
  const M = CFG.MMIN + (CFG.MMAX - CFG.MMIN) * Math.random(), G = S.kG, r = sqrt(0.6 / (G * M)), sg = r / 1.1774;
  const v = CFG.VMAX * sqrt(Math.random()), a = Math.random() * TAU;
  S.lumps.push({ x, y, sg, A: sqrt(M / (TAU * sg * sg)), vx: v * cos(a), vy: v * sin(a), age: full ? CFG.TIN : 0, M });
}
function lumps(S, dt) {
  S.nb -= dt;
  while (S.nb < 0) {
    S.nb += -log(1 - Math.random()) / CFG.LAM;
    newLump(S, Math.random() * W, Math.random() * H, false);
  }
  const { re, im, gx, gy, cx, sx, cy, sy } = S;
  for (let i = S.lumps.length - 1; i >= 0; i--) {
    const L = S.lumps[i], f = min(dt / CFG.TIN, (CFG.TIN - L.age) / CFG.TIN), R = min(30, Math.ceil(3.4 * L.sg)), A = L.A * f;
    const x0 = floor(L.x), y0 = floor(L.y);
    for (let d = -R; d <= R; d++) {
      const dx = x0 + d - L.x, dy = y0 + d - L.y;
      gx[d + R] = exp(-(dx * dx) / (4 * L.sg * L.sg));
      gy[d + R] = exp(-(dy * dy) / (4 * L.sg * L.sg));
      cx[d + R] = cos(L.vx * dx);
      sx[d + R] = sin(L.vx * dx);
      cy[d + R] = cos(L.vy * dy);
      sy[d + R] = sin(L.vy * dy);
    }
    for (let dy = -R; dy <= R; dy++) {
      const y = (y0 + dy + H) % H, gyv = A * gy[dy + R];
      for (let dx = -R; dx <= R; dx++) {
        const x = (x0 + dx + W) % W, g = gyv * gx[dx + R], p = y * W + x;
        const cr = cx[dx + R] * cy[dy + R] - sx[dx + R] * sy[dy + R], ci = sx[dx + R] * cy[dy + R] + cx[dx + R] * sy[dy + R];
        re[p] += g * cr;
        im[p] += g * ci;
      }
    }
    L.age += dt;
    if (L.age >= CFG.TIN - 1e-9) S.lumps.splice(i, 1);
  }
}
function initField(S) {
  const { re, im, tr, ti, K2 } = S;
  for (let p = 0; p < N; p++) {
    const kk = sqrt(K2[p]) * S.s;
    const a = kk > 0 ? exp(-((kk - CFG.KH) ** 2) / (2 * CFG.WH * CFG.WH)) : 0;
    re[p] = a * gauss();
    im[p] = a * gauss();
  }
  fft2(re, im, true);
  let s = 0;
  for (let p = 0; p < N; p++) s += re[p] * re[p] + im[p] * im[p];
  s = sqrt(N / s);
  s = sqrt(0.6 * N / (N)) * s;
  for (let p = 0; p < N; p++) (re[p] *= s), (im[p] *= s);
  S.nb = -log(1 - Math.random()) / CFG.LAM;
  for (let i = 0; i < CFG.NSEED; i++) newLump(S, Math.random() * W, Math.random() * H, true);
  // lay the seeded lumps in at full strength at once
  for (const L of S.lumps) {
    const f = 1;
    const R = min(30, Math.ceil(3.4 * L.sg)), x0 = floor(L.x), y0 = floor(L.y);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const x = (x0 + dx + W) % W, y = (y0 + dy + H) % H, p = y * W + x, ddx = x0 + dx - L.x, ddy = y0 + dy - L.y;
      const g = L.A * f * exp(-(ddx * ddx + ddy * ddy) / (4 * L.sg * L.sg)), ph = L.vx * ddx + L.vy * ddy;
      re[p] += g * cos(ph);
      im[p] += g * sin(ph);
    }
  }
  S.lumps.length = 0;
}

// ---- colour ---------------------------------------------------------------------------------
const NL = 1024, RHOTOP = 24, RHO0 = 0.3;
const STOPS = [
  [0, 0.1, 0.07, 0.3],
  [0.22, 0.24, 0.1, 0.52],
  [0.45, 0.62, 0.12, 0.6],
  [0.7, 0.95, 0.42, 0.36],
  [0.88, 1.0, 0.78, 0.38],
  [1, 1.0, 0.97, 0.85],
];
function ramp(u) {
  let j = 0;
  while (j < STOPS.length - 2 && u > STOPS[j + 1][0]) j++;
  const a = STOPS[j], b = STOPS[j + 1], f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
  return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
}
function buildLut(S, hue) {
  S.hueDone = hue;
  const lut = (S.lut = S.lut || new Float32Array(NL * 3)), cs = cos(TAU * hue), sn = sin(TAU * hue);
  for (let i = 0; i < NL; i++) {
    const m = (i / (NL - 1)) * 3.2; // |psi|
    const rho = m * m;
    const u = log(1 + rho / RHO0) / log(1 + RHOTOP / RHO0);
    const c = ramp(cl(u, 0, 1));
    const y = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    const I = 0.596 * c[0] - 0.274 * c[1] - 0.322 * c[2], Q = 0.211 * c[0] - 0.523 * c[1] + 0.312 * c[2];
    const I2 = I * cs - Q * sn, Q2 = I * sn + Q * cs;
    lut[i * 3] = cl(y + 0.956 * I2 + 0.621 * Q2, 0, 1);
    lut[i * 3 + 1] = cl(y - 0.272 * I2 - 0.647 * Q2, 0, 1);
    lut[i * 3 + 2] = cl(y - 1.106 * I2 + 1.703 * Q2, 0, 1);
  }
}

export function update(dt, input, params) {
  const S = params.s || setup(params, OPEN), k = input.knobValues || OPEN;
  S.hue = cl(k[0], 0, 1);
  S.R = CFG.R0 * cl(k[1], 0.2, 8) * 0.5;
  S.s = pow(1.4, cl(k[2], -1, 1));
  S.g = pow(3, cl(k[3], -1, 1));
  if (!S.warm) {
    S.warm = true;
    bands(S);
    constants(S);
    initField(S);
    for (let i = 0; i < CFG.WARM; i++) step(S);
  }
  const d = cl(dt || 0, 0, 0.1);
  const dm = d * S.R, n = max(1, Math.ceil(dm / CFG.DT - 1e-9));
  S.dt = dm / n;
  if (dm <= 0) return;
  constants(S);
  for (let i = 0; i < n; i++) step(S);
  S.t += dm;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  if (!S.lut || S.hueDone === undefined || abs(S.hue - S.hueDone) > 0.0015) buildLut(S, S.hue);
  const { re, im, lut } = S;
  const kq = (NL - 1) / 3.2;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const m = sqrt(re[p] * re[p] + im[p] * im[p]);
      const i = (min(m * kq, NL - 1) | 0) * 3;
      display.setPixel(x, y, lut[i] * 255, lut[i + 1] * 255, lut[i + 2] * 255);
    }
}
