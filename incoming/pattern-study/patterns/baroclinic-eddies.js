// ===== Patternflow pattern =====
// Title:   Baroclinic Eddies
// Family:  weather
// Idea:    draft
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft
// Round:   120
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Shear=1.5..4, Scale=-1..1, Drag=-1..1
//
// Knob 1: Hue. draft
// Knob 2: Shear. draft
// Knob 3: Scale. draft
// Knob 4: Drag. draft

const W = 64, H = 128, N = W * H; // the panel and the picture
const GW = 32, GH = 64, GN = GW * GH; // the grid the equations are solved on
const { floor, ceil, max, min, abs, sqrt, exp, log, pow, sin, cos, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the grid -------------------------------------------------------------------------------
// A mode (m, n) has kx = K0 m and ky = K0 n / 2, K0 = 2 pi / 64 per LED, so kappa^2 = m^2 + (n/2)^2.
// Modes above kappa KC are dropped after every product.
const K0 = TAU / W, KC = 8, KMAX = K0 * KC;

const CFG = {
  ld: 3.3, // deformation radius at Scale 0, LEDs
  ldr: 1.3, // factor per unit of Scale
  beta: 0.1, // beta over kd^2 U
  rate: 0.4, // bottom drag at Drag 0, per model time, over kd U
  rdr: 1.4, // factor per unit of Drag
  relax: 0.3, // thermal relaxation of the interface, per model time, over kd U
  drift: 1, // steering wind, over U
  clock: 1.5, // model time per panel second per unit of Shear
  nuc: 3, // hyperviscous rate at kappa = KC, per model time
  up: 8,
  e0: 12, // energy the flow settles at, Drag 0, Scale 0
  pre: 25, // model time of the pre-run
  bands: 4, // isotherm bands over the panel height
  g: 1.8, // sharpness of the colour step at a band edge
  core: 0.18, // depth of the thin isotherm line down the middle of each air mass
  cw: 0.03, // its width, in bands
  f0: 1.3, // a front starts to glow where |grad T| is this multiple of the mean gradient
  f1: 2.6, // and glows fully here
  fw: 0.6, // how far toward white a front goes
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

// A grid of w columns and h rows. Only the columns that carry modes (|m| <= KC) are transformed
// along the columns.
function grid(w, h) {
  const cols = [];
  for (let j = 0; j < w; j++) if (abs(j < w / 2 ? j : j - w) <= KC) cols.push(j);
  return { w, h, Tw: table(w), Th: table(h), cols, cr: new Float64Array(h), ci: new Float64Array(h) };
}
const GS = grid(GW, GH), GF = grid(W, H);

// Modes at their slots (zero elsewhere) to the field, unnormalised.
function ifft2(G, re, im) {
  const { w, h, Tw, Th, cols, cr, ci } = G;
  for (const j of cols) {
    for (let i = 0, p = j; i < h; i++, p += w) {
      cr[i] = re[p];
      ci[i] = im[p];
    }
    fft1(ci, cr, 0, Th);
    for (let i = 0, p = j; i < h; i++, p += w) {
      re[p] = cr[i];
      im[p] = ci[i];
    }
  }
  for (let i = 0; i < h; i++) fft1(im, re, i * w, Tw);
}

// A complex field to its modes, unnormalised, at the retained columns only.
function fft2(G, re, im) {
  const { w, h, Tw, Th, cols, cr, ci } = G;
  for (let i = 0; i < h; i++) fft1(re, im, i * w, Tw);
  for (const j of cols) {
    for (let i = 0, p = j; i < h; i++, p += w) {
      cr[i] = re[p];
      ci[i] = im[p];
    }
    fft1(cr, ci, 0, Th);
    for (let i = 0, p = j; i < h; i++, p += w) {
      re[p] = cr[i];
      im[p] = ci[i];
    }
  }
}

// ---- the modes ------------------------------------------------------------------------------
// SLOT is a mode's place on the solving grid, FLOT its place on the picture's grid, PAR the mode
// (-m, -n), whose coefficient is the complex conjugate because the field is real.
const SLOT = [], FLOT = [], KX = [], KY = [], KAP = [], KK = [], PAR = [];
{
  const at = new Map();
  for (let n = -GH / 2 + 1; n < GH / 2; n++)
    for (let m = -KC; m <= KC; m++) {
      const k2 = m * m + (n * n) / 4;
      if (k2 > KC * KC || m < 0 || (m === 0 && n <= 0)) continue;
      for (const [a, b] of [[m, n], [-m, -n]]) {
        at.set(a + "," + b, SLOT.length);
        SLOT.push(((b + GH) % GH) * GW + ((a + GW) % GW));
        FLOT.push(((b + H) % H) * W + ((a + W) % W));
        KX.push(K0 * a);
        KY.push((K0 * b) / 2);
        KAP.push(sqrt(k2));
        KK.push(K0 * K0 * k2);
      }
    }
  for (let q = 0; q < SLOT.length; q += 2) {
    PAR.push(q + 1, q);
  }
}
const M = SLOT.length;

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

// ---- the state ------------------------------------------------------------------------------
// Two layers of equal depth, q1 and q2 the potential vorticity departures of the upper (mean wind
// +U) and lower (-U) layer, stored as one array of 2 M modes each for real and imaginary parts.
const OPEN = [0, 2, 0, 0.06];
const rateOf = (k) => CFG.rate * pow(CFG.rdr, cl(k[3], -1, 1));
const ldOf = (k) => CFG.ld * pow(CFG.ldr, cl(k[2], -1, 1));

function build(params, k) {
  const v2 = () => new Float64Array(2 * M), gf = () => new Float64Array(GN), full = () => new Float64Array(N);
  const S = {
    qr: v2(), qi: v2(),
    n0r: v2(), n0i: v2(), n1r: v2(), n1i: v2(), n2r: v2(), n2i: v2(),
    u1r: v2(), u1i: v2(), u2r: v2(), u2i: v2(),
    ehr: v2(), ehi: v2(),
    psr: v2(), psi: v2(), wsr: v2(), wsi: v2(),
    ar: gf(), ai: gf(), br: gf(), bi: gf(), cr: gf(), ci: gf(), dr: gf(), di: gf(), pr: gf(), pi: gf(),
    fr: full(), fi: full(),
    kd: 0, F: 0, beta: 0, r: 0, kap: 0, U: 1, umax: 0, t: 0,
    tau: full(), hue: 0, lutHue: -1, lut: new Uint8Array(LUT * 3),
  };
  params.s = S;
  prepare(S, ldOf(k), rateOf(k));
  // Random phases, an amplitude that peaks near kappa 2.5, scaled to the energy the drag settles at.
  for (let l = 0; l < 2; l++)
    for (let q = 0; q < M; q += 2) {
      const o = l * M + q, a = KAP[q] * exp(-(KAP[q] * KAP[q]) / 12);
      S.qr[o] = S.qr[o + 1] = a * gauss();
      S.qi[o] = a * gauss();
      S.qi[o + 1] = -S.qi[o];
    }
  const e0 = energy(S), sc = sqrt((CFG.e0 * pow(CFG.rate / S.r * S.kd, 3.2)) / e0);
  for (let q = 0; q < 2 * M; q++) {
    S.qr[q] *= sc;
    S.qi[q] *= sc;
  }
  nonlin(S, S.qr, S.qi, S.n0r, S.n0i);
  advance(S, 0, CFG.pre);
}

// Stream functions of the state, into S.psr and S.psi.
function invert(S) {
  const { qr, qi, psr, psi, F } = S;
  for (let q = 0; q < M; q++) {
    const k2 = KK[q], det = 1 / (k2 * (k2 + 2 * F));
    const a1 = qr[q], b1 = qi[q], a2 = qr[M + q], b2 = qi[M + q];
    psr[q] = -((k2 + F) * a1 + F * a2) * det;
    psi[q] = -((k2 + F) * b1 + F * b2) * det;
    psr[M + q] = -(F * a1 + (k2 + F) * a2) * det;
    psi[M + q] = -(F * b1 + (k2 + F) * b2) * det;
  }
}

// Kinetic plus available potential energy, E = sum over modes of K^2 |psi_bt|^2 + (K^2 + kd^2) |tau|^2.
function energy(S) {
  invert(S);
  const { psr, psi, kd } = S;
  let e = 0;
  for (let q = 0; q < M; q++) {
    const br = psr[q] + psr[M + q], bi = psi[q] + psi[M + q], tr = psr[q] - psr[M + q], ti = psi[q] - psi[M + q];
    e += 0.25 * (KK[q] * (br * br + bi * bi) + (KK[q] + kd * kd) * (tr * tr + ti * ti));
  }
  return e;
}

// What depends on the knobs. A change of the deformation radius keeps the stream functions and
// re-forms the PV from them.
function prepare(S, ld, rate) {
  const kd = 1 / ld, F = 0.5 * kd * kd;
  if (S.F !== F) {
    if (S.F > 0) {
      invert(S);
      const dF = F - S.F;
      for (let q = 0; q < M; q++) {
        const p1r = S.psr[q], p1i = S.psi[q], p2r = S.psr[M + q], p2i = S.psi[M + q];
        S.qr[q] += dF * (p2r - p1r);
        S.qi[q] += dF * (p2i - p1i);
        S.qr[M + q] += dF * (p1r - p2r);
        S.qi[M + q] += dF * (p1i - p2i);
      }
    }
    S.F = F;
    S.kd = kd;
  }
  S.beta = CFG.beta * kd * kd;
  S.r = rate * kd;
  S.kap = CFG.relax * kd;
}

// ---- one evaluation of the right side --------------------------------------------------------
// out = -J(psi_i, q_i) - B_i d psi_i / dx + drag + relaxation, B_1 = beta + kd^2 U, B_2 = beta - kd^2 U.
function nonlin(S, tr, ti, outR, outI) {
  const { ar, ai, br, bi, cr, ci, dr, di, pr, pi, wsr: psr, wsi: psi, F } = S;
  ar.fill(0);
  ai.fill(0);
  br.fill(0);
  bi.fill(0);
  cr.fill(0);
  ci.fill(0);
  dr.fill(0);
  di.fill(0);
  for (let q = 0; q < M; q++) {
    const k2 = KK[q], det = 1 / (k2 * (k2 + 2 * F)), o = SLOT[q], x = KX[q], y = KY[q];
    const a1 = tr[q], b1 = ti[q], a2 = tr[M + q], b2 = ti[M + q];
    const p1r = -((k2 + F) * a1 + F * a2) * det, p1i = -((k2 + F) * b1 + F * b2) * det;
    const p2r = -(F * a1 + (k2 + F) * a2) * det, p2i = -(F * b1 + (k2 + F) * b2) * det;
    psr[q] = p1r;
    psi[q] = p1i;
    psr[M + q] = p2r;
    psi[M + q] = p2i;
    ar[o] = -(x * p1r - y * p1i);
    ai[o] = -(x * p1i + y * p1r);
    cr[o] = -(x * p2r - y * p2i);
    ci[o] = -(x * p2i + y * p2r);
    br[o] = -(y * a1 + x * b1);
    bi[o] = x * a1 - y * b1;
    dr[o] = -(y * a2 + x * b2);
    di[o] = x * a2 - y * b2;
  }
  ifft2(GS, ar, ai);
  ifft2(GS, br, bi);
  ifft2(GS, cr, ci);
  ifft2(GS, dr, di);
  let um = 0;
  for (let p = 0; p < GN; p++) {
    const u1 = ar[p], v1 = ai[p], u2 = cr[p], v2 = ci[p];
    pr[p] = u1 * br[p] + v1 * bi[p];
    pi[p] = u2 * dr[p] + v2 * di[p];
    const s = max(abs(u1) + abs(v1), abs(u2) + abs(v2));
    if (s > um) um = s;
  }
  S.umax = um;
  fft2(GS, pr, pi);
  const sc = -0.5 / GN, B1 = S.beta + S.kd * S.kd * S.U, B2 = S.beta - S.kd * S.kd * S.U;
  for (let q = 0; q < M; q++) {
    const o = SLOT[q], o2 = SLOT[PAR[q]], fr = pr[o], fi = pi[o], gr = pr[o2], gi = pi[o2], x = KX[q];
    // P1 = (F + conj F')/2, P2 = (F - conj F')/(2 i)
    const P1r = (fr + gr) * sc, P1i = (fi - gi) * sc, P2r = (fi + gi) * sc, P2i = -(fr - gr) * sc;
    const hr = S.kap * F * (psr[q] - psr[M + q]), hi = S.kap * F * (psi[q] - psi[M + q]);
    outR[q] = P1r + B1 * x * psi[q] + hr;
    outI[q] = P1i - B1 * x * psr[q] + hi;
    outR[M + q] = P2r + B2 * x * psi[M + q] + S.r * KK[q] * psr[M + q] - hr;
    outI[M + q] = P2i - B2 * x * psr[M + q] + S.r * KK[q] * psi[M + q] - hi;
  }
}

// One step of h: integrating-factor three-stage SSP Runge-Kutta. L = -nu_k - i kx (U_l + drift).
function step(S, h) {
  const { qr, qi, n0r, n0i, n1r, n1i, n2r, n2i, u1r, u1i, u2r, u2i, ehr, ehi } = S;
  const M2 = 2 * M;
  for (let l = 0; l < 2; l++) {
    const Ul = (l === 0 ? S.U : -S.U) + CFG.drift * S.U;
    for (let q = 0; q < M; q++) {
      const o = l * M + q;
      const lr = -CFG.nuc * pow(KAP[q] / KC, CFG.up);
      const ph = -KX[q] * Ul * h, ex = exp(0.5 * lr * h);
      ehr[o] = ex * cos(0.5 * ph);
      ehi[o] = ex * sin(0.5 * ph);
    }
  }
  nonlin(S, qr, qi, n0r, n0i);
  for (let q = 0; q < M2; q++) {
    const a = ehr[q], b = ehi[q], e1r = a * a - b * b, e1i = 2 * a * b;
    const xr = qr[q] + h * n0r[q], xi = qi[q] + h * n0i[q];
    u1r[q] = e1r * xr - e1i * xi;
    u1i[q] = e1r * xi + e1i * xr;
  }
  nonlin(S, u1r, u1i, n1r, n1i);
  for (let q = 0; q < M2; q++) {
    const a = ehr[q], b = ehi[q], r2 = 1 / (a * a + b * b), mr = a * r2, mi = -b * r2;
    const xr = u1r[q] + h * n1r[q], xi = u1i[q] + h * n1i[q];
    u2r[q] = 0.75 * (a * qr[q] - b * qi[q]) + 0.25 * (mr * xr - mi * xi);
    u2i[q] = 0.75 * (a * qi[q] + b * qr[q]) + 0.25 * (mr * xi + mi * xr);
  }
  nonlin(S, u2r, u2i, n2r, n2i);
  for (let q = 0; q < M2; q++) {
    const a = ehr[q], b = ehi[q], e1r = a * a - b * b, e1i = 2 * a * b;
    const xr = u2r[q] + h * n2r[q], xi = u2i[q] + h * n2i[q];
    const yr = (e1r * qr[q] - e1i * qi[q]) / 3 + (2 / 3) * (a * xr - b * xi);
    const yi = (e1r * qi[q] + e1i * qr[q]) / 3 + (2 / 3) * (a * xi + b * xr);
    qr[q] = yr;
    qi[q] = yi;
  }
  S.t += h;
}

// Model time Ht in equal steps, none longer than the fastest eddy allows. With upto, steps of
// that length until S.t reaches it.
function advance(S, Ht, upto) {
  const hmax = 1.1 / ((S.umax + 0.2 * S.U) * KMAX);
  if (upto) {
    while (S.t < upto) step(S, min(0.5, 1.1 / ((S.umax + 0.2 * S.U) * KMAX)));
    return;
  }
  const n = max(1, ceil(Ht / hmax));
  for (let i = 0; i < n; i++) step(S, Ht / n);
}

// ---- the frame ------------------------------------------------------------------------------
export function setup(params, knobValues) {
  params.s = null;
  if (knobValues) build(params, knobValues);
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) build(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  prepare(S, ldOf(k), rateOf(k));
  if (ft > 0) advance(S, ft * CFG.clock * cl(k[1], 1.5, 4));
  render(S);
}

// The interface height (the temperature) on the picture's grid.
function render(S) {
  invert(S);
  const { fr, fi, psr, psi } = S;
  fr.fill(0);
  fi.fill(0);
  for (let q = 0; q < M; q++) {
    const o = FLOT[q];
    fr[o] = 0.5 * (psr[q] - psr[M + q]);
    fi[o] = 0.5 * (psi[q] - psi[M + q]);
  }
  ifft2(GF, fr, fi);
  S.tau.set(fr);
}

// ---- the colour -----------------------------------------------------------------------------
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
const RGB = [0, 0, 0];
const LUT = 1024;
const HW = 0.115, HC = 0.585, SMIN = 0.12, SMAX = 0.9, YMIN = 0.42;

// A band of isotherms is one turn of the table: warm to cold and back, the edges where it
// passes through a pale seam.
function palette(S) {
  if (S.lutHue === S.hue) return;
  S.lutHue = S.hue;
  const tg = tanh(CFG.g);
  for (let i = 0; i < LUT; i++) {
    const s = tanh(CFG.g * sin((TAU * i) / LUT)) / tg, a = pow(abs(s), 1.3);
    hsv((s > 0 ? HW : HC) + S.hue, SMIN + (SMAX - SMIN) * a, 1, RGB);
    const y = 0.299 * RGB[0] + 0.587 * RGB[1] + 0.114 * RGB[2];
    const w = y < YMIN ? (YMIN - y) / (1 - y) : 0;
    const u = i / LUT, d = min(abs(u - 0.25), abs(u - 0.75)), line = 1 - CFG.core * exp(-(d * d) / (2 * CFG.cw * CFG.cw));
    for (let c = 0; c < 3; c++) S.lut[i * 3 + c] = ((RGB[c] + (1 - RGB[c]) * w) * 255 * line) | 0;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  const tau = S.tau, lut = S.lut, ph = CFG.bands / H;
  for (let y = 0; y < H; y++) {
    const yu = (y + 1) & (H - 1), yd = (y + H - 1) & (H - 1), yn = H - 1 - y;
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const tx = 0.5 * (tau[y * W + ((x + 1) & (W - 1))] - tau[y * W + ((x + W - 1) & (W - 1))]);
      const ty = 0.5 * (tau[yu * W + x] - tau[yd * W + x]);
      const f = sm(CFG.f0, CFG.f1, sqrt(tx * tx + (1 + ty) * (1 + ty))) * CFG.fw;
      let u = ph * (yn - tau[p]);
      u -= floor(u);
      const i = ((u * LUT) | 0) * 3;
      display.setPixel(x, y, (lut[i] + (255 - lut[i]) * f) | 0, (lut[i + 1] + (255 - lut[i + 1]) * f) | 0, (lut[i + 2] + (255 - lut[i + 2]) * f) | 0);
    }
  }
}
