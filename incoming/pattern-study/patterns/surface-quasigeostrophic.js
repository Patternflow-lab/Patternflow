// ===== Patternflow pattern =====
// Title:   Surface Quasigeostrophic
// Family:  noise
// Idea:    DRAFT
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: DRAFT
// Round:   115
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=1.5..4, Scale=-1..1, Alpha=1..2
//
// Knob 1: Hue. DRAFT
// Knob 2: Flow. DRAFT
// Knob 3: Scale. DRAFT
// Knob 4: Alpha. DRAFT

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, abs, sqrt, exp, log, pow, sin, cos, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the grid -------------------------------------------------------------------------------
// The box is 64 LEDs wide and 128 tall, one grid step an LED either way. A mode (m, n) has
// kx = K0 m and ky = K0 n / 2 with K0 = 2 pi / 64, so kappa^2 = m^2 + (n / 2)^2 measures both
// axes in the same unit. Modes with kappa above KC = 21 are dropped after every product. For a
// quadratic term that is exact: two retained modes make at most |m| = 42 and |n| = 84, which
// alias to |m| >= 22 or |n| >= 44, outside the retained disc.
const K0 = TAU / W, KC = 21, KMAX = K0 * KC;

// The tunables. Rates carry the rms speed of the moment (urs) times K0, so the shape of the
// picture does not depend on how loud the forcing has made the field.
const CFG = {
  kf0: 3.6, // forcing wavenumber at Scale 0 (wavelength 64 / 3.6 = 18 LEDs); Scale divides it by 1.65 per unit
  kref: 6, // wavenumber where the kernel is normalised, so theta and speed agree there for every Alpha
  nuc: 3, // hyperviscous rate at kappa = KC, order 2 p = 16
  up: 8,
  sigma: 0.03, // rms of the forcing
  tauf: 8, // correlation time of the forcing, model time
  band: 0.25, // width of the forced band over kf
  mu: 0.03, // large-scale drag, times kf, below kd * kf
  kd: 0.3,
  speed: 3.5, // LEDs a second of rms speed per unit of Flow
  wind: 3, // mean wind, LEDs a second per unit of Flow
  al0: 0.3, // its heading, radians, plus two slow swings
  kb: 10, // centre of the band that sharpens the picture
  beta: 0.15, // and how much of it is added
  tone: 1.1,
  f0: 0.8,
  f1: 3.5,
};

// ---- Fourier transforms ---------------------------------------------------------------------
function table(n) {
  const rev = new Int32Array(n), wr = new Float64Array(n / 2), wi = new Float64Array(n / 2);
  let lg = 0;
  while (1 << lg < n) lg++;
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) if (i & (1 << b)) r |= 1 << (lg - 1 - b);
    rev[i] = r;
  }
  for (let k = 0; k < n / 2; k++) {
    wr[k] = cos((TAU * k) / n);
    wi[k] = -sin((TAU * k) / n);
  }
  return { n, rev, wr, wi };
}
const T64 = table(64), T128 = table(128);

// In place, forward (e^-i), on re[o .. o+n) and im[o .. o+n). Calling it with the two arrays
// swapped gives the unnormalised inverse.
function fft1(re, im, o, T) {
  const n = T.n, rev = T.rev, wr = T.wr, wi = T.wi;
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
    for (let s = 0; s < n; s += len) {
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const a = o + s + k, b = a + half;
        const c = wr[t], d = wi[t];
        const xr = re[b] * c - im[b] * d, xi = re[b] * d + im[b] * c;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

const COL = [], CR = new Float64Array(H), CI = new Float64Array(H); // columns that carry modes
for (let j = 0; j < W; j++) {
  const m = j < 32 ? j : j - W;
  if (abs(m) <= KC) COL.push(j);
}

// The spectrum (modes at their grid slots, zero elsewhere) to the field, unnormalised.
function ifft2(re, im) {
  for (const j of COL) {
    for (let i = 0, p = j; i < H; i++, p += W) {
      CR[i] = re[p];
      CI[i] = im[p];
    }
    fft1(CI, CR, 0, T128);
    for (let i = 0, p = j; i < H; i++, p += W) {
      re[p] = CR[i];
      im[p] = CI[i];
    }
  }
  for (let i = 0; i < H; i++) fft1(im, re, i * W, T64);
}

// A real field in re (im is overwritten) to its modes, unnormalised. Two rows go through one
// complex transform.
const ZR = new Float64Array(W), ZI = new Float64Array(W);
function fft2real(re, im) {
  for (let a = 0; a < H / 2; a++) {
    const oa = a * W, ob = (a + H / 2) * W;
    for (let j = 0; j < W; j++) {
      ZR[j] = re[oa + j];
      ZI[j] = re[ob + j];
    }
    fft1(ZR, ZI, 0, T64);
    for (let j = 0; j < W; j++) {
      const q = (W - j) & (W - 1), zr = ZR[j], zi = ZI[j], qr = ZR[q], qi = ZI[q];
      re[oa + j] = 0.5 * (zr + qr);
      im[oa + j] = 0.5 * (zi - qi);
      re[ob + j] = 0.5 * (zi + qi);
      im[ob + j] = -0.5 * (zr - qr);
    }
  }
  for (const j of COL) {
    for (let i = 0, p = j; i < H; i++, p += W) {
      CR[i] = re[p];
      CI[i] = im[p];
    }
    fft1(CR, CI, 0, T128);
    for (let i = 0, p = j; i < H; i++, p += W) {
      re[p] = CR[i];
      im[p] = CI[i];
    }
  }
}

// ---- the modes ------------------------------------------------------------------------------
// Only the retained modes are stored. IDX is a mode's slot in the full array, PAR the slot of
// its mirror (-m, -n), whose coefficient is the complex conjugate because the field is real.
const IDX = [], KX = [], KY = [], KAP = [], PAR = [];
{
  const at = new Map();
  for (let i = 0; i < H; i++)
    for (let j = 0; j < W; j++) {
      const n = i < 64 ? i : i - H, m = j < 32 ? j : j - W, k2 = m * m + (n * n) / 4;
      if (k2 > KC * KC || (m === 0 && n === 0)) continue;
      at.set(i * W + j, IDX.length);
      IDX.push(i * W + j);
      KX.push(K0 * m);
      KY.push((K0 * n) / 2);
      KAP.push(sqrt(k2));
    }
  for (let q = 0; q < IDX.length; q++) {
    const i = floor(IDX[q] / W), j = IDX[q] % W;
    PAR.push(at.get(((H - i) % H) * W + ((W - j) % W)));
  }
}
const M = IDX.length;

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

// ---- the state ------------------------------------------------------------------------------
const OPEN = [0, 2, 0, 0.06];
const kfOf = (s) => CFG.kf0 * pow(1.65, -cl(s, -1, 1));

function start(params, k) {
  const vec = () => new Float64Array(M), full = () => new Float64Array(N);
  const S = {
    tr: vec(), ti: vec(), // theta, the retained modes
    ar: full(), ai: full(), br: full(), bi: full(), pr: full(), pi: full(), // transform work
    n0r: vec(), n0i: vec(), n1r: vec(), n1i: vec(), n2r: vec(), n2i: vec(), // the three stages
    u1r: vec(), u1i: vec(), u2r: vec(), u2i: vec(),
    ehr: vec(), ehi: vec(), // exp(L h / 2)
    G: vec(), mu: vec(), ea: vec(), fr: vec(), fi: vec(), // kernel, drag shape, forcing shape and state
    alpha: -1, kf: -1, umax: 1, urms: 1, urs: 1, t: 0, tp: 0, ux: 0, uy: 0,
    field: full(), det: full(), sig: 1, dsig: 1, hue: 0, lutHue: -1, lut: new Float64Array(256 * 3), grad: full(),
  };
  params.s = S;
  prepare(S, cl(k[3], 1, 2), kfOf(k[2]));
  init(S);
  nonlin(S, S.tr, S.ti, S.n0r, S.n0i);
  S.urs = S.urms;
  advance(S, 20);
}

// What depends on the knobs: the kernel (Alpha) and the forced band and drag (Scale).
function prepare(S, alpha, kf) {
  if (alpha !== S.alpha) {
    S.alpha = alpha;
    for (let q = 0; q < M; q++) S.G[q] = pow(KAP[q] / CFG.kref, 1 - alpha) / (K0 * KAP[q]);
  }
  if (kf !== S.kf) {
    S.kf = kf;
    let s2 = 0;
    for (let q = 0; q < M; q++) {
      const r = (KAP[q] - kf) / (CFG.band * kf), a = exp(-0.5 * r * r);
      S.ea[q] = a;
      s2 += a * a;
      S.mu[q] = 0.5 * (1 - tanh((KAP[q] - CFG.kd * kf) / (0.2 * CFG.kd * kf)));
    }
    const nrm = 1 / sqrt(s2);
    for (let q = 0; q < M; q++) S.ea[q] *= nrm;
  }
}

// A random-phase field: the forced band at unit amplitude and a red tail below it.
function init(S) {
  const { tr, ti, ea } = S;
  for (let q = 0; q < M; q++) {
    if (PAR[q] < q) {
      tr[q] = tr[PAR[q]];
      ti[q] = -ti[PAR[q]];
      continue;
    }
    const a = ea[q] + 0.04 * pow(KAP[q] / S.kf, -1.3) * (KAP[q] < 2 * S.kf ? 1 : 0), ph = TAU * Math.random();
    tr[q] = a * cos(ph);
    ti[q] = a * sin(ph);
  }
}

// ---- one evaluation of the right side --------------------------------------------------------
// out = -(u . grad theta) + F at the retained modes. The velocity is u = (-psi_y, psi_x) with
// psi_hat = -G theta_hat, so u_hat + i v_hat = G (kx + i ky) theta_hat, and u and v come out of one
// transform, theta_x and theta_y out of another. The product goes back through a third.
function nonlin(S, tr, ti, outR, outI) {
  const { ar, ai, br, bi, pr, pi, G, fr, fi } = S;
  ar.fill(0);
  ai.fill(0);
  br.fill(0);
  bi.fill(0);
  for (let q = 0; q < M; q++) {
    const a = tr[q], b = ti[q], o = IDX[q], g = G[q], x = KX[q], y = KY[q];
    const s = x * b + y * a, d = x * a - y * b;
    ar[o] = g * d;
    ai[o] = g * s;
    br[o] = -s;
    bi[o] = d;
  }
  ifft2(ar, ai);
  ifft2(br, bi);
  let um = 0, e2 = 0;
  for (let p = 0; p < N; p++) {
    const u = ar[p], v = ai[p];
    pr[p] = u * br[p] + v * bi[p];
    const s = abs(u) + abs(v);
    if (s > um) um = s;
    e2 += u * u + v * v;
  }
  S.umax = um;
  S.urms = sqrt(e2 / N);
  fft2real(pr, pi);
  const sc = -1 / N;
  for (let q = 0; q < M; q++) {
    outR[q] = pr[IDX[q]] * sc + fr[q];
    outI[q] = pi[IDX[q]] * sc + fi[q];
  }
}

// One step of h model time: the integrating-factor form of the three-stage SSP Runge-Kutta
// (Shu and Osher, 1988). The linear part is taken exactly: L = -(drag + hyperviscosity) for the
// decay and -i k.U for a mean wind U, which turns each mode's phase and never limits the step.
function step(S, h) {
  const { tr, ti, n0r, n0i, n1r, n1i, n2r, n2i, u1r, u1i, u2r, u2i, ehr, ehi } = S;
  // the forcing: an Ornstein-Uhlenbeck process in each mode of the band, carried by the wind
  const rho = exp(-h / CFG.tauf), sg = CFG.sigma * sqrt(1 - rho * rho), ur = S.urs * K0;
  for (let q = 0; q < M; q++) {
    const lr = -ur * (CFG.mu * S.kf * S.mu[q] + CFG.nuc * pow(KAP[q] / KC, 2 * CFG.up));
    const ph = -(KX[q] * S.ux + KY[q] * S.uy) * h, ex = exp(0.5 * lr * h);
    ehr[q] = ex * cos(0.5 * ph);
    ehi[q] = ex * sin(0.5 * ph);
    const p = PAR[q];
    if (p >= q) {
      const a = sg * S.ea[q], c = rho * cos(ph), d = rho * sin(ph), x = S.fr[q], y = S.fi[q];
      S.fr[q] = c * x - d * y + a * gauss();
      S.fi[q] = c * y + d * x + a * gauss();
      if (p !== q) {
        S.fr[p] = S.fr[q];
        S.fi[p] = -S.fi[q];
      }
    }
  }
  nonlin(S, tr, ti, n0r, n0i);
  for (let q = 0; q < M; q++) {
    const a = ehr[q], b = ehi[q], e1r = a * a - b * b, e1i = 2 * a * b;
    const xr = tr[q] + h * n0r[q], xi = ti[q] + h * n0i[q];
    u1r[q] = e1r * xr - e1i * xi;
    u1i[q] = e1r * xi + e1i * xr;
  }
  nonlin(S, u1r, u1i, n1r, n1i);
  for (let q = 0; q < M; q++) {
    const a = ehr[q], b = ehi[q], r2 = 1 / (a * a + b * b), mr = a * r2, mi = -b * r2; // exp(-L h / 2)
    const xr = u1r[q] + h * n1r[q], xi = u1i[q] + h * n1i[q];
    u2r[q] = 0.75 * (a * tr[q] - b * ti[q]) + 0.25 * (mr * xr - mi * xi);
    u2i[q] = 0.75 * (a * ti[q] + b * tr[q]) + 0.25 * (mr * xi + mi * xr);
  }
  nonlin(S, u2r, u2i, n2r, n2i);
  for (let q = 0; q < M; q++) {
    const a = ehr[q], b = ehi[q], e1r = a * a - b * b, e1i = 2 * a * b;
    const xr = u2r[q] + h * n2r[q], xi = u2i[q] + h * n2i[q];
    const yr = (e1r * tr[q] - e1i * ti[q]) / 3 + (2 / 3) * (a * xr - b * xi);
    const yi = (e1r * ti[q] + e1i * tr[q]) / 3 + (2 / 3) * (a * xi + b * xr);
    tr[q] = yr;
    ti[q] = yi;
  }
  S.t += h;
}

// Model time Ht in steps no longer than the speed allows: |u| + |v| times the largest wavenumber
// times the step stays under 1.1, where the scheme's limit is 1.73.
function advance(S, Ht) {
  const n = max(1, ceil((Ht * S.umax * KMAX) / 1.1));
  for (let i = 0; i < n; i++) step(S, Ht / n);
}

// ---- the frame ------------------------------------------------------------------------------
export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 1.5, 4);
  prepare(S, cl(k[3], 1, 2), kfOf(k[2]));
  S.hue = k[0];
  // Model time per panel second holds the rms speed at CFG.speed LEDs a second per unit of Flow.
  const c = cl((flow * CFG.speed) / S.urms, 0.05, 20), Ht = ft * c;
  S.urs += (S.urms - S.urs) * (1 - exp(-Ht * 0.5));
  // The wind swings slowly in heading, on two rates with no common period.
  S.tp += (ft * flow) / 2;
  const al = CFG.al0 + 0.9 * sin(0.0137 * S.tp + 1.1) + 0.55 * sin(0.0059 * S.tp + 4.0), wu = (CFG.wind * flow) / c;
  S.ux = wu * cos(al);
  S.uy = wu * sin(al);
  advance(S, Ht);
  render(S);
}

// theta and its band-passed copy go out through one transform: theta_hat + i w theta_hat.
function render(S) {
  const { ar, ai, tr, ti } = S;
  ar.fill(0);
  ai.fill(0);
  let s1 = 0, s2 = 0;
  for (let q = 0; q < M; q++) {
    const r = (KAP[q] - CFG.kb) / (0.35 * CFG.kb), w = exp(-r * r), a = tr[q], b = ti[q];
    ar[IDX[q]] = a - w * b;
    ai[IDX[q]] = b + w * a;
    s1 += a * a + b * b;
    s2 += w * w * (a * a + b * b);
  }
  ifft2(ar, ai);
  S.sig = sqrt(s1);
  S.dsig = sqrt(s2);
  const f = S.field, d = S.det;
  for (let p = 0; p < N; p++) {
    f[p] = ar[p];
    d[p] = ai[p];
  }
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// theta, squeezed through tanh, picks a place on a ramp of hue, saturation and value stops.
// Where |grad theta| is large, a front, the colour loses saturation and gains value.
const STOPS = [
  [0, 0.66, 0.85, 0.3],
  [0.3, 0.6, 0.9, 0.48],
  [0.6, 0.5, 0.75, 0.7],
  [0.85, 0.4, 0.35, 0.95],
  [1, 0.16, 0.4, 1],
];
const RGB = [0, 0, 0];

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const f = S.field, d = S.det, gr = S.grad, lut = S.lut, hue = cl(S.hue, 0, 1);
  const inv = 1 / S.sig, dinv = CFG.beta / S.dsig;
  if (S.lutHue !== hue) {
    S.lutHue = hue;
    for (let i = 0; i < 256; i++) {
      const x = i / 255;
      let j = 1;
      while (j < STOPS.length - 1 && x > STOPS[j][0]) j++;
      const a = STOPS[j - 1], b = STOPS[j], t = cl((x - a[0]) / (b[0] - a[0]), 0, 1);
      lut[i * 3] = a[1] + (b[1] - a[1]) * t + hue;
      lut[i * 3 + 1] = a[2] + (b[2] - a[2]) * t;
      lut[i * 3 + 2] = a[3] + (b[3] - a[3]) * t;
    }
  }
  let gs = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const dx = f[y * W + ((x + 1) & 63)] - f[y * W + ((x + 63) & 63)];
      const dy = f[((y + 1) & 127) * W + x] - f[((y + 127) & 127) * W + x];
      gr[p] = sqrt(dx * dx + dy * dy);
      gs += gr[p];
    }
  gs = N / gs; // the mean of gr is 1
  for (let p = 0; p < N; p++) {
    const th = f[p] * inv, fr = sm(CFG.f0, CFG.f1, gr[p] * gs);
    const i = ((0.5 + 0.5 * tanh(th / CFG.tone)) * 255) | 0;
    hsv(lut[i * 3], lut[i * 3 + 1] * (1 - 0.5 * fr), cl(lut[i * 3 + 2] * (0.85 + 0.15 * fr) + 0.45 * fr + d[p] * dinv, 0.25, 1), RGB);
    display.setPixel(p & 63, p >> 6, (RGB[0] * 255) | 0, (RGB[1] * 255) | 0, (RGB[2] * 255) | 0);
  }
}
