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
const CFG = { G0: 7e-5, DT: 0.2, R0: 6, JH: 0.002, KH: 0.5, WH: 0.2, LAM: 0.02, MMIN: 600, MMAX: 1100, TIN: 10, VMAX: 0.2, NSEED: 4, WARM: 150, SGF: 1.0, KS: 2.0, GS: 0.1, PS: 8, TOP: 20, R0T: 0.3, CAP: 30, GCAP: 0.1 };

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
function abs(v) {
  return v < 0 ? -v : v;
}

// ---- the field ------------------------------------------------------------------------------
// Everything is kept in scaled units: x' = x / s, so Scale only changes K2 (times s^2) in the drift and the Poisson kernel, the band the
// sea is injected in, and how big the lumps are laid in; G, the injection rates and the lumps' masses are per scaled area.
function setup(params) {
  const S = {
    t: 0, warm: false, hue: 0, s: 1, g: 1, R: 6, kdt: 0, kG: 0, ks: 0, dt: CFG.DT, sum: N, nb: 0, bs: 0, hueDone: -1,
    re: new Float64Array(N), im: new Float64Array(N), tr: new Float64Array(N), ti: new Float64Array(N),
    K2: new Float64Array(N), Dr: new Float64Array(N), Di: new Float64Array(N), Pk: new Float64Array(N), SP: new Float64Array(N),
    bh: [], lumps: [], gx: new Float64Array(64), gy: new Float64Array(64), cx: new Float64Array(64), sx: new Float64Array(64), cy: new Float64Array(64), sy: new Float64Array(64),
  };
  for (let y = 0; y < H; y++) {
    const ny = y < H / 2 ? y : y - H, ky = (TAU * ny) / H;
    for (let x = 0; x < W; x++) {
      const nx = x < W / 2 ? x : x - W, kx = (TAU * nx) / W, p = y * W + x, k2 = kx * kx + ky * ky;
      S.K2[p] = k2;
      S.SP[p] = CFG.GS * pow(k2 / (CFG.KS * CFG.KS), CFG.PS / 2);
    }
  }
  params.s = S;
  return S;
}
function constants(S) {
  const G = S.g * CFG.G0;
  if (G !== S.kG || S.s !== S.ks) {
    S.kG = G;
    const s2 = S.s * S.s;
    for (let p = 0; p < N; p++) S.Pk[p] = S.K2[p] > 0 ? (-4 * PI * G) / (S.K2[p] * s2) : 0;
  }
  if (abs(S.dt - S.kdt) > 0.003 * S.dt || S.s !== S.ks) {
    S.kdt = S.dt;
    const s2 = S.s * S.s;
    for (let p = 0; p < N; p++) {
      const th = 0.5 * S.dt * S.K2[p] * s2, d = exp(-S.dt * S.SP[p]);
      S.Dr[p] = (d * cos(th)) / N;
      S.Di[p] = (-d * sin(th)) / N;
    }
  }
  if (S.s !== S.ks) {
    S.ks = S.s;
    S.bh.length = 0;
    for (let p = 1; p < N; p++) if (abs(sqrt(S.K2[p]) * S.s - CFG.KH) < CFG.WH) S.bh.push(p);
  }
}
// One step: free flight in k space (with the sea's fresh waves laid in), then the kick of the potential.
function step(S) {
  const { re, im, tr, ti, Dr, Di, Pk } = S, dt = S.dt;
  fft2(re, im, false);
  for (let p = 0; p < N; p++) {
    const a = re[p], b = im[p], kr = Dr[p], ki = Di[p];
    re[p] = a * kr - b * ki;
    im[p] = a * ki + b * kr;
  }
  const nh = S.bh.length, eh = sqrt((CFG.JH * dt) / (2 * nh));
  for (let i = 0; i < nh; i++) {
    const p = S.bh[i];
    re[p] += eh * gauss();
    im[p] += eh * gauss();
  }
  fft2(re, im, true);
  lumps(S, dt);
  let sum = 0;
  for (let p = 0; p < N; p++) {
    const r = re[p] * re[p] + im[p] * im[p];
    tr[p] = r;
    ti[p] = 0;
    sum += r;
  }
  S.sum = sum;
  const nrm = sqrt(N / sum);
  fft2(tr, ti, false);
  for (let p = 0; p < N; p++) {
    tr[p] *= Pk[p];
    ti[p] *= Pk[p];
  }
  fft2(tr, ti, true);
  const sc = (dt * nrm * nrm) / N, cap = CFG.CAP / (nrm * nrm), gc = CFG.GCAP * dt;
  for (let p = 0; p < N; p++) {
    const th = tr[p] * sc, c = cos(th), s = sin(th), r = re[p] * re[p] + im[p] * im[p];
    let a = re[p] * nrm, b = im[p] * nrm;
    if (r > cap) {
      const f = exp(-gc * (r / cap - 1));
      a *= f;
      b *= f;
    }
    re[p] = a * c + b * s;
    im[p] = b * c - a * s;
  }
}
// A lump is a Gaussian density with sigma sg (scaled units), a phase gradient (vx, vy), laid in coherently over TIN model time units.
function newLump(S, x, y, age) {
  const M = CFG.MMIN + (CFG.MMAX - CFG.MMIN) * Math.random(), r = sqrt(0.6 / (S.kG * M)), sg = (r / 1.1774) * CFG.SGF;
  const v = CFG.VMAX * sqrt(Math.random()), a = Math.random() * TAU;
  S.lumps.push({ x, y, sg, A: sqrt(M / (TAU * sg * sg)), vx: v * cos(a), vy: v * sin(a), age });
}
function layLump(S, L, f) {
  const { re, im, gx, gy, cx, sx, cy, sy } = S, s = S.s, sig = L.sg * s, R = min(31, Math.ceil(3.4 * sig)), A = L.A * f;
  const x0 = floor(L.x), y0 = floor(L.y), vx = L.vx / s, vy = L.vy / s;
  for (let d = -R; d <= R; d++) {
    const dx = x0 + d - L.x, dy = y0 + d - L.y;
    gx[d + R] = exp(-(dx * dx) / (4 * sig * sig));
    gy[d + R] = exp(-(dy * dy) / (4 * sig * sig));
    cx[d + R] = cos(vx * dx);
    sx[d + R] = sin(vx * dx);
    cy[d + R] = cos(vy * dy);
    sy[d + R] = sin(vy * dy);
  }
  for (let dy = -R; dy <= R; dy++) {
    const y = (y0 + dy + H) % H, gyv = A * gy[dy + R];
    for (let dx = -R; dx <= R; dx++) {
      const x = (x0 + dx + W) % W, g = gyv * gx[dx + R], p = y * W + x;
      re[p] += g * (cx[dx + R] * cy[dy + R] - sx[dx + R] * sy[dy + R]);
      im[p] += g * (sx[dx + R] * cy[dy + R] + cx[dx + R] * sy[dy + R]);
    }
  }
}
function lumps(S, dt) {
  S.nb -= dt;
  while (S.nb < 0) {
    S.nb += -log(1 - Math.random()) / (CFG.LAM / (S.s * S.s));
    newLump(S, Math.random() * W, Math.random() * H, 0);
  }
  for (let i = S.lumps.length - 1; i >= 0; i--) {
    const L = S.lumps[i];
    layLump(S, L, min(dt, CFG.TIN - L.age) / CFG.TIN);
    L.age += dt;
    if (L.age >= CFG.TIN - 1e-9) S.lumps.splice(i, 1);
  }
}
function initField(S) {
  const { re, im, K2 } = S;
  for (let p = 0; p < N; p++) {
    const a = K2[p] > 0 ? exp(-((sqrt(K2[p]) * S.s - CFG.KH) ** 2) / (2 * CFG.WH * CFG.WH)) : 0;
    re[p] = a * gauss();
    im[p] = a * gauss();
  }
  fft2(re, im, true);
  let s = 0;
  for (let p = 0; p < N; p++) s += re[p] * re[p] + im[p] * im[p];
  s = sqrt((0.6 * N) / s);
  for (let p = 0; p < N; p++) (re[p] *= s), (im[p] *= s);
  S.nb = -log(1 - Math.random()) / (CFG.LAM / (S.s * S.s));
  for (let i = 0, n = Math.round(CFG.NSEED / (S.s * S.s)); i < n; i++) {
    newLump(S, Math.random() * W, Math.random() * H, 0);
    layLump(S, S.lumps.pop(), 1);
  }
}

// ---- colour ---------------------------------------------------------------------------------
const NL = 512, MTOP = 3.4;
const STOPS = [[0, 0.22, 0.09, 285], [0.28, 0.36, 0.15, 295], [0.52, 0.52, 0.2, 335], [0.74, 0.7, 0.17, 385], [0.9, 0.85, 0.14, 440], [1, 0.96, 0.05, 455]];
function oklab2rgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const e = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
  return [e(r), e(g), e(bb)];
}
function fit(L, C, h) {
  for (let k = 0; k < 40; k++) {
    const c = oklab2rgb(L, C * cos(h), C * sin(h)), y = (c[0] * 77 + c[1] * 150 + c[2] * 29) / 256;
    if (c.every((v) => v >= 0 && v <= 1 && y + (v - y) * 1.62 >= -0.01 && y + (v - y) * 1.62 <= 1.01)) return c;
    C *= 0.96;
  }
  return oklab2rgb(L, C * cos(h), C * sin(h)).map((v) => cl(v, 0, 1));
}
function buildLut(S, hue) {
  S.hueDone = hue;
  const lut = (S.lut = S.lut || new Float32Array(NL * 3)), top = log(1 + CFG.TOP / CFG.R0T);
  for (let i = 0; i < NL; i++) {
    const m = (i / (NL - 1)) * MTOP, u = cl(log(1 + (m * m) / CFG.R0T) / top, 0, 1);
    let j = 0;
    while (j < STOPS.length - 2 && u > STOPS[j + 1][0]) j++;
    const a = STOPS[j], b = STOPS[j + 1], f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
    const hh = a[3] + (b[3] - a[3]) * f + hue * 360;
    const c = fit(a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, (hh * PI) / 180);
    lut[i * 3] = c[0];
    lut[i * 3 + 1] = c[1];
    lut[i * 3 + 2] = c[2];
  }
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  S.hue = cl(k[0], 0, 1);
  S.R = CFG.R0 * cl(k[1], 0.2, 8) * 0.5;
  S.s = pow(1.45, cl(k[2], -1, 1));
  S.g = pow(2.2, cl(k[3], -1, 1));
  if (!S.warm) {
    S.warm = true;
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
  if (abs(S.hue - S.hueDone) > 0.0015) buildLut(S, S.hue);
  const { re, im, lut } = S, kq = (NL - 1) / MTOP;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const m = sqrt(re[p] * re[p] + im[p] * im[p]), i = (min(m * kq, NL - 1) | 0) * 3;
      display.setPixel(x, y, lut[i] * 255, lut[i + 1] * 255, lut[i + 2] * 255);
    }
}
