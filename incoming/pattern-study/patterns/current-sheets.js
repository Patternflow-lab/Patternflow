// ===== Patternflow pattern =====
// Title:   Current Sheets
// Family:  physics
// Idea:    draft
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft
// Round:   118
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Field=-1..1

const W = 64, H = 128;
const NX = 64, NY = 128, N = NX * NY, LX = 64, LY = 128, DX = LX / NX;
const { floor, sqrt, sin, cos, exp, log, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- radix-2 FFT ----------------------------------------------------------------------------
// The forward transform is e^(-i k x); the inverse flips the sign and leaves the 1/n to the caller. Only the columns with |n_x| <= 21 hold modes
// inside the circle of k kept, so the 2-D transform runs its column pass on those 43 of 64 and its row pass on all 128 rows.
function plan(n) {
  const lg = Math.round(Math.log2(n)), rev = new Uint16Array(n), tc = new Float64Array(n), ts = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) if (i & (1 << b)) r |= 1 << (lg - 1 - b);
    rev[i] = r;
  }
  for (let h = 1; h < n; h <<= 1)
    for (let k = 0; k < h; k++) (tc[h + k] = cos((PI * k) / h)), (ts[h + k] = -sin((PI * k) / h));
  return { n, rev, tc, ts };
}
const PX = plan(NX), PY = plan(NY);
const TR = new Float64Array(NY), TI = new Float64Array(NY), SR = new Float64Array(NX), SI = new Float64Array(NX);
const COLS = [];
for (let x = 0; x < NX; x++) if (abs(x < NX / 2 ? x : x - NX) <= floor(TAU / 3 / DX / (TAU / LX))) COLS.push(x);

// In place on re[o .. o+n), im[o .. o+n), which are already in bit-reversed order; sg is -1 for the forward transform and +1 for the inverse.
function butterflies(p, re, im, sg) {
  const { n, tc, ts } = p;
  for (let i = 0; i < n; i += 4) {
    const r0 = re[i], i0 = im[i], r1 = re[i + 1], i1 = im[i + 1], r2 = re[i + 2], i2 = im[i + 2], r3 = re[i + 3], i3 = im[i + 3];
    const ar = r0 + r1, ai = i0 + i1, br = r0 - r1, bi = i0 - i1, cr = r2 + r3, ci = i2 + i3, dr = r2 - r3, di = i2 - i3;
    const er = -sg * di, ei = sg * dr;
    re[i] = ar + cr;
    im[i] = ai + ci;
    re[i + 2] = ar - cr;
    im[i + 2] = ai - ci;
    re[i + 1] = br + er;
    im[i + 1] = bi + ei;
    re[i + 3] = br - er;
    im[i + 3] = bi - ei;
  }
  for (let h = 4; h < n; h <<= 1)
    for (let i = 0; i < n; i += h << 1)
      for (let k = 0; k < h; k++) {
        const wr = tc[h + k], wi = -sg * ts[h + k], a = i + k, b = a + h;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
}
function rowFFT(re, im, y, sg) {
  const o = y * NX, rev = PX.rev;
  for (let i = 0; i < NX; i++) (SR[i] = re[o + rev[i]]), (SI[i] = im[o + rev[i]]);
  butterflies(PX, SR, SI, sg);
  for (let i = 0; i < NX; i++) (re[o + i] = SR[i]), (im[o + i] = SI[i]);
}
function colFFT(re, im, x, sg) {
  const rev = PY.rev;
  for (let y = 0; y < NY; y++) (TR[y] = re[rev[y] * NX + x]), (TI[y] = im[rev[y] * NX + x]);
  butterflies(PY, TR, TI, sg);
  for (let y = 0; y < NY; y++) (re[y * NX + x] = TR[y]), (im[y * NX + x] = TI[y]);
}
// Forward or inverse, in place. After a forward transform only the kept columns are meaningful; an inverse transform expects zero in the others.
function fft2(re, im, inv) {
  const sg = inv ? 1 : -1;
  if (inv) {
    for (const x of COLS) colFFT(re, im, x, sg);
    for (let y = 0; y < NY; y++) rowFFT(re, im, y, sg);
  } else {
    for (let y = 0; y < NY; y++) rowFFT(re, im, y, sg);
    for (const x of COLS) colFFT(re, im, x, sg);
  }
}

// ---- the plasma -----------------------------------------------------------------------------
const KC = TAU / 3 / DX; // radius of the circle of k kept: the two-thirds rule
const NU = 0.1; // viscosity = resistivity, LED^2 per model second
const NU4 = 0.04; // hyperviscosity, LED^4 per model second
const MU0 = 0.5; // friction on the longest waves, per model second
const KMU = 0.08; // and the k where it has fallen to a half
const DTMAX = 0.075; // longest step, model seconds
const KFMAX = 0.8; // forced modes live below this k
const TAUF = 3; // forcing correlation time, model seconds
const FA = 0.05; // forcing strength
const B0REF = 1.3, B0RANGE = 2.4; // mean field at Field 0, and its factor per unit of Field
const L0 = 24, LRANGE = 1.7; // forced wavelength at Scale 0, LEDs, and its factor per unit of Scale
const SPACING = 6; // line spacing at the mean field strength, LEDs
const OPEN = [0, 2, 0, 0.06];

// The modes kept, 2855 of 8192, in a compact list; MIDX is each one's place in the transform arrays, MJ its mirror's place in the list.
const KX = new Float64Array(NX), KY = new Float64Array(NY);
for (let x = 0; x < NX; x++) KX[x] = (TAU * (x < NX / 2 ? x : x - NX)) / LX;
for (let y = 0; y < NY; y++) KY[y] = (TAU * (y < NY / 2 ? y : y - NY)) / LY;
const ML = [];
for (let y = 0; y < NY; y++)
  for (let x = 0; x < NX; x++) {
    const k2 = KX[x] * KX[x] + KY[y] * KY[y];
    if (k2 > 0 && k2 < KC * KC) ML.push(y * NX + x);
  }
const NM = ML.length, MIDX = Int32Array.from(ML), MMIR = new Int32Array(NM), MJ = new Int32Array(NM);
const KXc = new Float64Array(NM), KYc = new Float64Array(NM), K2c = new Float64Array(NM), IK2c = new Float64Array(NM);
{
  const at = new Int32Array(N).fill(-1);
  for (let j = 0; j < NM; j++) at[MIDX[j]] = j;
  for (let j = 0; j < NM; j++) {
    const p = MIDX[j], x = p % NX, y = (p - x) / NX;
    KXc[j] = KX[x];
    KYc[j] = KY[y];
    K2c[j] = KX[x] * KX[x] + KY[y] * KY[y];
    IK2c[j] = 1 / K2c[j];
    MMIR[j] = ((NY - y) % NY) * NX + ((NX - x) % NX);
    MJ[j] = at[MMIR[j]];
  }
}
// the modes that stand for a pair, and the forced ones: half plane, |k| < KFMAX
const HJ = [], FJ = [];
for (let j = 0; j < NM; j++) {
  if (MJ[j] > j) HJ.push(j);
  if (K2c[j] < KFMAX * KFMAX && (KYc[j] > 0 || (KYc[j] === 0 && KXc[j] > 0))) FJ.push(j);
}
const NH = HJ.length, NF = FJ.length;

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

function setup(params) {
  const f = () => new Float64Array(N), m = () => new Float64Array(NM);
  const S = {
    t: 0, acc: 0, warm: false, hue: 0, ft: 0.033, js: 0.5, bm: 2, jb: new Float32Array(N), ramp: new Float32Array(64 * 3), lutHue: -1,
    kf: 0.26, kft: 0.26, b0: B0REF, b0t: B0REF, fa: FA, alpha: 0, dtq: 0, kdt: -1,
    wr: m(), wi: m(), ar: m(), ai: m(),
    xwr: m(), xwi: m(), xar: m(), xai: m(),
    n1wr: m(), n1wi: m(), n1ar: m(), n1ai: m(),
    n2wr: m(), n2wi: m(), n2ar: m(), n2ai: m(),
    c1r: f(), c1i: f(), c2r: f(), c2i: f(), fr: f(), fi: f(), er: f(), ei: f(),
    dec: m(), ch: m(), sh: m(),
    zr: new Float64Array(NF), zi: new Float64Array(NF), fwr: new Float64Array(NF), fwi: new Float64Array(NF),
    xc: new Float64Array(NX), xs: new Float64Array(NX), yc: new Float64Array(NY), ys: new Float64Array(NY),
    ph: [Math.random() * TAU, Math.random() * TAU, Math.random() * TAU, Math.random() * TAU],
  };
  for (let i = 0; i < NF; i++) (S.zr[i] = gauss() * sqrt(0.5)), (S.zi[i] = gauss() * sqrt(0.5));
  params.s = S;
  return S;
}

// Enforce a(-k) = conj a(k) on one complex field.
function sym(re, im) {
  for (let i = 0; i < NH; i++) {
    const j = HJ[i], m = MJ[j], a = 0.5 * (re[j] + re[m]), b = 0.5 * (im[j] - im[m]);
    re[j] = a;
    im[j] = b;
    re[m] = a;
    im[m] = -b;
  }
}

// The nonlinear terms. With u = z x grad psi, b = z x grad a, omega = lap psi and j = lap a (so div u = div b = 0),
//   d omega/dt = -(u.grad)omega + (b.grad)j = -[(dyy - dxx)(u_x u_y - b_x b_y) - dxy((u_y^2 - u_x^2) - (b_y^2 - b_x^2))]    (the curl of the Reynolds and Maxwell stresses)
//   d a/dt     = -u.grad a = u_y b_x - u_x b_y.
// The uniform field B0 is not in here; it is in the linear part. Two inverse transforms bring u and b to the grid, two real fields in each, and two forward
// transforms take the products back. All fields are sums, not means: a field on the grid is its transform divided by N.
function rhs(S, wr, wi, ar, ai, nwr, nwi, nar, nai) {
  const { c1r, c1i, c2r, c2i, fr, fi, er, ei } = S, sc = 1 / N;
  c1r.fill(0);
  c1i.fill(0);
  c2r.fill(0);
  c2i.fill(0);
  for (let j = 0; j < NM; j++) {
    const p = MIDX[j], kx = KXc[j], ky = KYc[j], ik = IK2c[j] * sc;
    // u_x^ + i u_y^ = (kx + i ky) w^ / k^2, b_x^ + i b_y^ = -(kx + i ky) a^
    c1r[p] = ik * (kx * wr[j] - ky * wi[j]);
    c1i[p] = ik * (kx * wi[j] + ky * wr[j]);
    c2r[p] = -sc * (kx * ar[j] - ky * ai[j]);
    c2i[p] = -sc * (kx * ai[j] + ky * ar[j]);
  }
  fft2(c1r, c1i, true);
  fft2(c2r, c2i, true);
  for (let p = 0; p < N; p++) {
    const ux = c1r[p], uy = c1i[p], bx = c2r[p], by = c2i[p];
    fr[p] = ux * uy - bx * by;
    fi[p] = uy * uy - ux * ux - (by * by - bx * bx);
    er[p] = uy * bx - ux * by;
    ei[p] = 0;
  }
  fft2(fr, fi, false);
  fft2(er, ei, false);
  for (let j = 0; j < NM; j++) {
    const p = MIDX[j], m = MMIR[j], kx = KXc[j], ky = KYc[j];
    // P^ = (F(k) + conj F(-k)) / 2, Q^ = (F(k) - conj F(-k)) / 2i
    const pr = 0.5 * (fr[p] + fr[m]), pi = 0.5 * (fi[p] - fi[m]);
    const qr = 0.5 * (fi[p] + fi[m]), qi = -0.5 * (fr[p] - fr[m]);
    const a = ky * ky - kx * kx, b = kx * ky;
    nwr[j] = -(a * pr - b * qr);
    nwi[j] = -(a * pi - b * qi);
    nar[j] = 0.5 * (er[p] + er[m]);
    nai[j] = 0.5 * (ei[p] - ei[m]);
  }
}

// exp(L dt/2) on (w, a): the damping and the Alfven rotation by theta = (B0 . k) dt/2, which for the pair p = w/k, q = k a is
// d/dt (p, q) = (-i Omega q, -i Omega p) - gamma (p, q) with Omega = B0 . k.
function lin(S, ow_r, ow_i, oa_r, oa_i, wr, wi, ar, ai) {
  const { ch, sh } = S;
  for (let j = 0; j < NM; j++) {
    const c = ch[j], s = sh[j], k2 = K2c[j], ik2 = IK2c[j];
    const w0 = wr[j], w1 = wi[j], a0 = ar[j], a1 = ai[j];
    ow_r[j] = c * w0 + s * k2 * a1;
    ow_i[j] = c * w1 - s * k2 * a0;
    oa_r[j] = c * a0 + s * ik2 * w1;
    oa_i[j] = c * a1 - s * ik2 * w0;
  }
}

function constants(S, dt) {
  const dth = 0.5 * dt, bx = S.b0 * sin(S.alpha), by = S.b0 * cos(S.alpha);
  if (dt !== S.kdt) {
    S.kdt = dt;
    for (let j = 0; j < NM; j++) {
      const k2 = K2c[j], k = sqrt(k2);
      S.dec[j] = exp(-(NU * k2 + NU4 * k2 * k2 + MU0 / (1 + (k / KMU) ** 4)) * dth);
    }
  }
  const { xc, xs, yc, ys } = S;
  for (let x = 0; x < NX; x++) (xc[x] = cos(bx * KX[x] * dth)), (xs[x] = sin(bx * KX[x] * dth));
  for (let y = 0; y < NY; y++) (yc[y] = cos(by * KY[y] * dth)), (ys[y] = sin(by * KY[y] * dth));
  for (let j = 0; j < NM; j++) {
    const p = MIDX[j], x = p % NX, y = (p - x) / NX;
    const c = xc[x] * yc[y] - xs[x] * ys[y], s = xs[x] * yc[y] + xc[x] * ys[y];
    S.ch[j] = S.dec[j] * c;
    S.sh[j] = S.dec[j] * s;
  }
}

// Ornstein-Uhlenbeck forcing of the vorticity on the long modes, through a window of width 0.22 in ln k round kf.
function forcing(S, dt) {
  const r = exp(-dt / TAUF), q = sqrt(1 - r * r), kf = S.kf, { zr, zi, fwr, fwi } = S;
  for (let i = 0; i < NF; i++) {
    zr[i] = zr[i] * r + q * gauss() * sqrt(0.5);
    zi[i] = zi[i] * r + q * gauss() * sqrt(0.5);
    const j = FJ[i], k = sqrt(K2c[j]), l = log(k / kf), w = S.fa * N * k * exp(-0.5 * (l / 0.22) ** 2);
    fwr[i] = w * zr[i];
    fwi[i] = w * zi[i];
  }
}
function addForce(S, nwr, nwi) {
  const { fwr, fwi } = S;
  for (let i = 0; i < NF; i++) {
    const j = FJ[i], m = MJ[j];
    nwr[j] += fwr[i];
    nwi[j] += fwi[i];
    nwr[m] += fwr[i];
    nwi[m] -= fwi[i];
  }
}

// One step of dt model seconds: Lawson midpoint, the damping and the Alfven rotation exact, the rest second order.
function step(S, dt) {
  S.alpha = ALPHA[0] * sin(ALPHA[1] * S.t + S.ph[0]) + ALPHA[2] * sin(ALPHA[3] * S.t + S.ph[1]);
  constants(S, dt);
  forcing(S, dt);
  const { wr, wi, ar, ai, xwr, xwi, xar, xai, n1wr, n1wi, n1ar, n1ai, n2wr, n2wi, n2ar, n2ai } = S;
  rhs(S, wr, wi, ar, ai, n1wr, n1wi, n1ar, n1ai);
  addForce(S, n1wr, n1wi);
  // w = E v (kept in n1's place later), then x = w + dt/2 E N1
  lin(S, xwr, xwi, xar, xai, wr, wi, ar, ai);
  lin(S, n2wr, n2wi, n2ar, n2ai, n1wr, n1wi, n1ar, n1ai);
  for (let j = 0; j < NM; j++) {
    n1wr[j] = xwr[j];
    n1wi[j] = xwi[j];
    n1ar[j] = xar[j];
    n1ai[j] = xai[j];
    xwr[j] += 0.5 * dt * n2wr[j];
    xwi[j] += 0.5 * dt * n2wi[j];
    xar[j] += 0.5 * dt * n2ar[j];
    xai[j] += 0.5 * dt * n2ai[j];
  }
  rhs(S, xwr, xwi, xar, xai, n2wr, n2wi, n2ar, n2ai);
  addForce(S, n2wr, n2wi);
  for (let j = 0; j < NM; j++) {
    n1wr[j] += dt * n2wr[j];
    n1wi[j] += dt * n2wi[j];
    n1ar[j] += dt * n2ar[j];
    n1ai[j] += dt * n2ai[j];
  }
  lin(S, wr, wi, ar, ai, n1wr, n1wi, n1ar, n1ai);
  sym(wr, wi);
  sym(ar, ai);
  S.t += dt;
}

// The mean field leans from the long axis by alpha = 0.14 sin(0.0113 t) + 0.09 sin(0.0271 t), t in model seconds, a slow sway that keeps the lines
// at the sides of the panel moving as well as those in the middle.
const ALPHA = [0.14, 0.0113, 0.09, 0.0271];

function energy(S) {
  let ek = 0, em = 0;
  for (let j = 0; j < NM; j++) {
    ek += IK2c[j] * (S.wr[j] * S.wr[j] + S.wi[j] * S.wi[j]);
    em += K2c[j] * (S.ar[j] * S.ar[j] + S.ai[j] * S.ai[j]);
  }
  return [ek / (2 * N * N), em / (2 * N * N)];
}

// A first state at about the strength the forced field settles to: the forced modes with random phases, u and b both near 1.4 LEDs per model second.
function seed(S) {
  S.wr.fill(0);
  S.wi.fill(0);
  S.ar.fill(0);
  S.ai.fill(0);
  for (let i = 0; i < NF; i++) {
    const j = FJ[i], m = MJ[j], k = sqrt(K2c[j]), g = exp(-0.5 * (log(k / S.kf) / 0.3) ** 2);
    S.wr[j] = S.wr[m] = g * k * gauss();
    S.wi[j] = g * k * gauss();
    S.wi[m] = -S.wi[j];
    S.ar[j] = S.ar[m] = (g / k) * gauss();
    S.ai[j] = (g / k) * gauss();
    S.ai[m] = -S.ai[j];
  }
  const [ek, em] = energy(S), su = 1.4 / sqrt(2 * ek), sb = 1.3 / sqrt(2 * em);
  for (let j = 0; j < NM; j++) {
    S.wr[j] *= su;
    S.wi[j] *= su;
    S.ar[j] *= sb;
    S.ai[j] *= sb;
  }
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  const ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.2, 5);
  S.ft = ft;
  S.hue = cl(k[0], 0, 1);
  S.b0t = B0REF * pow(B0RANGE, cl(k[3], -1, 1));
  S.kft = TAU / (L0 * pow(LRANGE, cl(k[2], -1, 1)));
  if (!S.warm) {
    S.warm = true;
    S.kf = S.kft;
    S.b0 = S.b0t;
    seed(S);
    for (let i = 0; i < 100; i++) step(S, 0.08);
  }
  S.kf += (S.kft - S.kf) * (1 - exp(-ft / 0.5));
  S.b0 += (S.b0t - S.b0) * (1 - exp(-ft / 0.4));
  // model seconds per step: a frame's worth at this Flow, held to steps of 2^(1/32) so that the damping factors are kept from frame to frame
  S.dtq = pow(2, Math.round((log(cl(flow / 30, 0.002, DTMAX)) / Math.LN2) * 32) / 32);
  S.acc = min(S.acc + ft * flow, 8 * S.dtq);
  while (S.acc >= S.dtq) {
    S.acc -= S.dtq;
    step(S, S.dtq);
  }
}

// ---- colour ---------------------------------------------------------------------------------
function oklab2rgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const e = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
  return [e(r), e(g), e(bb)];
}
function fit(L, a, b) {
  for (let k = 0; k < 40; k++) {
    const c = oklab2rgb(L, a, b), y = (c[0] * 77 + c[1] * 150 + c[2] * 29) / 256;
    if (c.every((v) => v >= 0 && v <= 1 && y + (v - y) * 1.62 >= -0.01 && y + (v - y) * 1.62 <= 1.01)) return c;
    a *= 0.96;
    b *= 0.96;
  }
  return oklab2rgb(L, a, b).map((v) => cl(v, 0, 1));
}
// current ramp: [place, L, C, h]
const RAMP = [
  [0, 0.34, 0.1, 285],
  [0.25, 0.55, 0.14, 255],
  [0.5, 0.78, 0.12, 205],
  [0.75, 0.88, 0.14, 90],
  [1, 0.99, 0.02, 90],
];
const NR = 64;
function buildRamp(S, hue) {
  S.lutHue = hue;
  for (let i = 0; i < NR; i++) {
    const v = i / (NR - 1);
    let j = 1;
    while (j < RAMP.length - 1 && v > RAMP[j][0]) j++;
    const A = RAMP[j - 1], B = RAMP[j], t = cl((v - A[0]) / (B[0] - A[0]), 0, 1);
    const L = A[1] + (B[1] - A[1]) * t, C = A[2] + (B[2] - A[2]) * t, h = (A[3] + (B[3] - A[3]) * t + hue * 360) * (PI / 180);
    const c = fit(L, C * cos(h), C * sin(h));
    S.ramp[i * 3] = c[0];
    S.ramp[i * 3 + 1] = c[1];
    S.ramp[i * 3 + 2] = c[2];
  }
}

// d (in 1/16 LED) -> profile of a line 0.7 LED wide and of the glow round it
const NPR = 192, LINE = new Float32Array(NPR), GLOW = new Float32Array(NPR);
for (let i = 0; i < NPR; i++) {
  const d = i / 16;
  LINE[i] = exp(-0.5 * (d / 0.7) ** 2);
  GLOW[i] = exp(-d / 2.2);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  if (S.lutHue !== S.hue) buildRamp(S, S.hue);
  const { c1r, c1i, c2r, c2i, ramp, ar, ai } = S, sc = 1 / N;
  c1r.fill(0);
  c1i.fill(0);
  c2r.fill(0);
  c2i.fill(0);
  for (let j = 0; j < NM; j++) {
    const p = MIDX[j], k2 = K2c[j], kx = KXc[j], ky = KYc[j];
    c1r[p] = (ar[j] + k2 * ai[j]) * sc;
    c1i[p] = (ai[j] - k2 * ar[j]) * sc;
    c2r[p] = (ky * ai[j] - kx * ar[j]) * sc;
    c2i[p] = (-ky * ar[j] - kx * ai[j]) * sc;
  }
  fft2(c1r, c1i, true);
  fft2(c2r, c2i, true);
  // a = c1r, j = c1i, b_x = c2r, b_y = c2i
  const b0 = S.b0, bx0 = b0 * sin(S.alpha), by0 = b0 * cos(S.alpha), ca = cos(S.alpha), sa = sin(S.alpha);
  let sj = 0, sb = 0;
  for (let p = 0; p < N; p++) {
    sj += c1i[p] * c1i[p];
    const bx = bx0 + c2r[p], by = by0 + c2i[p];
    sb += sqrt(bx * bx + by * by);
  }
  const rate = 1 - exp(-S.ft / 6);
  S.js += (sqrt(sj / N) - S.js) * rate;
  S.bm += (sb / N - S.bm) * rate;
  const delta = S.bm * SPACING, ij = 1 / (2.2 * S.js), jb = S.jb;
  // |j| with a 3 x 3 average, so that the colour of a line changes smoothly along it
  for (let y = 0; y < H; y++) {
    const y0 = ((y + H - 1) % H) * W, y1 = y * W, y2 = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const xm = (x + W - 1) % W, xp = (x + 1) % W;
      jb[y1 + x] = (abs(c1i[y0 + xm]) + abs(c1i[y0 + x]) + abs(c1i[y0 + xp]) + abs(c1i[y1 + xm]) + 2 * abs(c1i[y1 + x]) + abs(c1i[y1 + xp]) + abs(c1i[y2 + xm]) + abs(c1i[y2 + x]) + abs(c1i[y2 + xp])) / 10;
    }
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const bx = bx0 + c2r[p], by = by0 + c2i[p], bm = sqrt(bx * bx + by * by) + 1e-6;
      const at = c1r[p] + b0 * (ca * (x - 31.5) - sa * (y - 63.5)), phi = at / delta, f = phi - floor(phi + 0.5);
      const di = min(NPR - 1, (abs(f) * delta * 16 / bm) | 0);
      const jn = cl(jb[p] * ij, 0, 1), o = ((jn * (NR - 1) + 0.5) | 0) * 3;
      const g3 = phi * 3, f3 = g3 - floor(g3 + 0.5), d3 = min(NPR - 1, (abs(f3) * delta * 16 / (3 * bm)) | 0);
      const v = min(1, LINE[di] * (0.7 + 0.3 * jn) + 0.3 * LINE[d3] + GLOW[di] * (0.05 + 0.5 * jn * jn)) * 255;
      display.setPixel(x, y, v * ramp[o], v * ramp[o + 1], v * ramp[o + 2]);
    }
}
