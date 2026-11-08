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
const PX = plan(NX), PY = plan(NY);
const TR = new Float64Array(NY), TI = new Float64Array(NY);

// In place on re[o .. o+n), im[o .. o+n). The forward transform is e^(-i k x); inv flips the sign and leaves the 1/n to the caller.
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
  for (let y = 0; y < NY; y++) fft(PX, re, im, y * NX, inv);
  for (let x = 0; x < NX; x++) {
    for (let y = 0; y < NY; y++) (TR[y] = re[y * NX + x]), (TI[y] = im[y * NX + x]);
    fft(PY, TR, TI, 0, inv);
    for (let y = 0; y < NY; y++) (re[y * NX + x] = TR[y]), (im[y * NX + x] = TI[y]);
  }
}

// ---- the plasma -----------------------------------------------------------------------------
const KC = TAU / 3 / DX; // radius of the circle of k kept: the two-thirds rule
const NU = 0.1; // viscosity = resistivity, LED^2 per model second
const NU4 = 0.04; // hyperviscosity, LED^4 per model second
const MU0 = 0.5; // friction on the longest waves, per model second
const KMU = 0.08; // and the k where it has fallen to a half
const DTMAX = 0.07; // longest step, model seconds
const KFMAX = 0.8; // forced modes live below this k
const SPACING = 4.4; // line spacing at the mean field strength, LEDs
const TAUF = 3; // forcing correlation time, model seconds

const KX = new Float64Array(NX), KY = new Float64Array(NY);
for (let x = 0; x < NX; x++) KX[x] = (TAU * (x < NX / 2 ? x : x - NX)) / LX;
for (let y = 0; y < NY; y++) KY[y] = (TAU * (y < NY / 2 ? y : y - NY)) / LY;
const K2 = new Float64Array(N), IK2 = new Float64Array(N), MIR = new Int32Array(N), KXP = new Float64Array(N), KYP = new Float64Array(N);
const MASK = new Uint8Array(N);
for (let y = 0; y < NY; y++)
  for (let x = 0; x < NX; x++) {
    const p = y * NX + x, k2 = KX[x] * KX[x] + KY[y] * KY[y];
    K2[p] = k2;
    KXP[p] = KX[x];
    KYP[p] = KY[y];
    IK2[p] = k2 > 0 ? 1 / k2 : 0;
    MIR[p] = ((NY - y) % NY) * NX + ((NX - x) % NX);
    MASK[p] = k2 > 0 && k2 < KC * KC ? 1 : 0;
  }
// the forced modes: half plane, |k| < KFMAX
const FP = [], FM = [];
for (let y = 0; y < NY; y++)
  for (let x = 0; x < NX; x++) {
    const p = y * NX + x;
    if (MASK[p] && K2[p] < KFMAX * KFMAX && (KY[y] > 0 || (KY[y] === 0 && KX[x] > 0))) (FP.push(p), FM.push(MIR[p]));
  }
const NF = FP.length;

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

function setup(params) {
  const f = () => new Float64Array(N);
  const S = {
    t: 0, acc: 0, warm: false, hue: 0, ft: 0.033, js: 0.5, bm: 2, ramp: new Float32Array(64 * 3), lutHue: -1, kf: 0.26, kft: 0.26, b0: 2, fa: 0.05, dtq: 0, kdt: -1, alpha: 0, b0t: 2,
    wr: f(), wi: f(), ar: f(), ai: f(),
    xwr: f(), xwi: f(), xar: f(), xai: f(),
    n1wr: f(), n1wi: f(), n1ar: f(), n1ai: f(),
    n2wr: f(), n2wi: f(), n2ar: f(), n2ai: f(),
    c1r: f(), c1i: f(), c2r: f(), c2i: f(), fr: f(), fi: f(), er: f(), ei: f(),
    dec: f(), gam: f(), ch: f(), sh: f(),
    zr: new Float64Array(NF), zi: new Float64Array(NF), fwr: new Float64Array(NF), fwi: new Float64Array(NF),
    xc: new Float64Array(NX), xs: new Float64Array(NX), yc: new Float64Array(NY), ys: new Float64Array(NY),
    ph: [Math.random() * TAU, Math.random() * TAU, Math.random() * TAU, Math.random() * TAU],
  };
  for (let i = 0; i < NF; i++) (S.zr[i] = gauss() * sqrt(0.5)), (S.zi[i] = gauss() * sqrt(0.5));
  params.s = S;
  return S;
}

// Enforce a(-k) = conj a(k) on one complex field, zero the mean and everything outside the circle.
function sym(re, im) {
  for (let p = 0; p < N; p++) {
    if (!MASK[p]) {
      re[p] = 0;
      im[p] = 0;
      continue;
    }
    const m = MIR[p];
    if (m > p) {
      const a = 0.5 * (re[p] + re[m]), b = 0.5 * (im[p] - im[m]);
      re[p] = a;
      im[p] = b;
      re[m] = a;
      im[m] = -b;
    }
  }
}

// The nonlinear terms. With u = z x grad psi, b = z x grad a, omega = lap psi, j = lap a:
//   d omega/dt = -(u.grad omega) + (b.grad j) = -[(dyy - dxx)(u_x u_y - b_x b_y) ... ] written as stress, and d a/dt = u_y b_x - u_x b_y.
// Two inverse transforms bring u and b to the grid (two real fields in each), and two forward transforms take back the products.
function rhs(S, wr, wi, ar, ai, nwr, nwi, nar, nai) {
  const { c1r, c1i, c2r, c2i, fr, fi, er, ei } = S, sc = 1 / N;
  for (let p = 0; p < N; p++) {
    const ky = KYP[p] * IK2[p] * sc, kx = KXP[p] * IK2[p] * sc, kxx = KXP[p] * sc, kyy = KYP[p] * sc;
    // u_x^ = i ky w / k2, u_y^ = -i kx w / k2 ; pack u_x^ + i u_y^
    const uxr = -ky * wi[p], uxi = ky * wr[p], uyr = kx * wi[p], uyi = -kx * wr[p];
    c1r[p] = uxr - uyi;
    c1i[p] = uxi + uyr;
    // b_x^ = -i ky a^, b_y^ = i kx a^
    const bxr = kyy * ai[p], bxi = -kyy * ar[p], byr = -kxx * ai[p], byi = kxx * ar[p];
    c2r[p] = bxr - byi;
    c2i[p] = bxi + byr;
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
  for (let p = 0; p < N; p++) {
    if (!MASK[p]) {
      nwr[p] = nwi[p] = nar[p] = nai[p] = 0;
      continue;
    }
    const m = MIR[p], kx = KXP[p], ky = KYP[p];
    // P^ = (F(k) + conj F(-k)) / 2, Q^ = (F(k) - conj F(-k)) / 2i
    const pr = 0.5 * (fr[p] + fr[m]), pi = 0.5 * (fi[p] - fi[m]);
    const qr = 0.5 * (fi[p] + fi[m]), qi = -0.5 * (fr[p] - fr[m]);
    const a = ky * ky - kx * kx, b = kx * ky;
    nwr[p] = -(a * pr - b * qr);
    nwi[p] = -(a * pi - b * qi);
    nar[p] = 0.5 * (er[p] + er[m]);
    nai[p] = 0.5 * (ei[p] - ei[m]);
  }
}

// exp(L dt/2) on (w, a): damping gam and the Alfven rotation by theta = (B0 . k) dt/2.
function lin(S, ow_r, ow_i, oa_r, oa_i, wr, wi, ar, ai) {
  const { ch, sh } = S;
  for (let p = 0; p < N; p++) {
    const c = ch[p], s = sh[p], k2 = K2[p], ik2 = IK2[p];
    const w0 = wr[p], w1 = wi[p], a0 = ar[p], a1 = ai[p];
    ow_r[p] = c * w0 + s * k2 * a1;
    ow_i[p] = c * w1 - s * k2 * a0;
    oa_r[p] = c * a0 + s * ik2 * w1;
    oa_i[p] = c * a1 - s * ik2 * w0;
  }
}

function constants(S, dt) {
  S.b0 = S.b0t;
  const dth = 0.5 * dt, bx = S.b0 * sin(S.alpha), by = S.b0 * cos(S.alpha);
  if (dt !== S.kdt) {
    S.kdt = dt;
    for (let p = 0; p < N; p++) {
      const k2 = K2[p], k = sqrt(k2), g = NU * k2 + NU4 * k2 * k2 + MU0 / (1 + (k / KMU) ** 4);
      S.gam[p] = g;
      S.dec[p] = exp(-g * dth);
    }
  }
  const { xc, xs, yc, ys } = S;
  for (let x = 0; x < NX; x++) (xc[x] = cos(bx * KX[x] * dth)), (xs[x] = sin(bx * KX[x] * dth));
  for (let y = 0; y < NY; y++) (yc[y] = cos(by * KY[y] * dth)), (ys[y] = sin(by * KY[y] * dth));
  for (let y = 0, p = 0; y < NY; y++)
    for (let x = 0; x < NX; x++, p++) {
      const c = xc[x] * yc[y] - xs[x] * ys[y], s = xs[x] * yc[y] + xc[x] * ys[y], d = S.dec[p];
      S.ch[p] = d * c;
      S.sh[p] = d * s;
    }
}

// Ornstein-Uhlenbeck forcing of the vorticity on the long modes, a log-normal window of width 0.22 round kf.
function forcing(S, dt) {
  const r = exp(-dt / TAUF), q = sqrt(1 - r * r), kf = S.kf, { zr, zi, fwr, fwi } = S;
  for (let i = 0; i < NF; i++) {
    zr[i] = zr[i] * r + q * gauss() * sqrt(0.5);
    zi[i] = zi[i] * r + q * gauss() * sqrt(0.5);
    const p = FP[i], k = sqrt(K2[p]), l = log(k / kf), w = S.fa * N * k * exp(-0.5 * (l / 0.22) ** 2);
    fwr[i] = w * zr[i];
    fwi[i] = w * zi[i];
  }
}
function addForce(S, nwr, nwi) {
  const { fwr, fwi } = S;
  for (let i = 0; i < NF; i++) {
    const p = FP[i], m = FM[i];
    nwr[p] += fwr[i];
    nwi[p] += fwi[i];
    nwr[m] += fwr[i];
    nwi[m] -= fwi[i];
  }
}

// One step of dt model seconds: Lawson midpoint, the damping and the Alfven rotation exact, the rest second order.
function step(S, dt) {
  constants(S, dt);
  forcing(S, dt);
  const { wr, wi, ar, ai, xwr, xwi, xar, xai, n1wr, n1wi, n1ar, n1ai, n2wr, n2wi, n2ar, n2ai } = S;
  rhs(S, wr, wi, ar, ai, n1wr, n1wi, n1ar, n1ai);
  addForce(S, n1wr, n1wi);
  // w = E v (kept in x), then x <- w + dt/2 E N1
  lin(S, xwr, xwi, xar, xai, wr, wi, ar, ai);
  lin(S, n2wr, n2wi, n2ar, n2ai, n1wr, n1wi, n1ar, n1ai);
  for (let p = 0; p < N; p++) {
    n1wr[p] = xwr[p];
    n1wi[p] = xwi[p];
    n1ar[p] = xar[p];
    n1ai[p] = xai[p];
    xwr[p] += 0.5 * dt * n2wr[p];
    xwi[p] += 0.5 * dt * n2wi[p];
    xar[p] += 0.5 * dt * n2ar[p];
    xai[p] += 0.5 * dt * n2ai[p];
  }
  rhs(S, xwr, xwi, xar, xai, n2wr, n2wi, n2ar, n2ai);
  addForce(S, n2wr, n2wi);
  for (let p = 0; p < N; p++) {
    n1wr[p] += dt * n2wr[p];
    n1wi[p] += dt * n2wi[p];
    n1ar[p] += dt * n2ar[p];
    n1ai[p] += dt * n2ai[p];
  }
  lin(S, wr, wi, ar, ai, n1wr, n1wi, n1ar, n1ai);
  sym(wr, wi);
  sym(ar, ai);
  S.t += dt;
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || [0, 2, 0, 0.06];
  const ft = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.ft = ft;
  S.b0t = 2 * pow(2.2, cl(k[3], -1, 1));
  S.kft = TAU / (24 * pow(1.7, cl(k[2], -1, 1)));
  S.kf += (S.kft - S.kf) * (1 - exp(-ft / 0.5));
  if (!S.warm) {
    S.warm = true;
    S.kf = S.kft;
    S.b0 = S.b0t;
    for (let i = 0; i < NF; i++) {
      const p = FP[i], m = FM[i], q = sqrt(K2[p]), a = 0.3 * N * exp(-0.5 * (log(q / S.kf) / 0.3) ** 2);
      S.wr[p] = S.wr[m] = a * (Math.random() - 0.5) * q;
      S.wi[p] = a * (Math.random() - 0.5) * q;
      S.wi[m] = -S.wi[p];
      S.ar[p] = S.ar[m] = (a * 0.3 * (Math.random() - 0.5)) / q;
      S.ai[p] = (a * 0.3 * (Math.random() - 0.5)) / q;
      S.ai[m] = -S.ai[p];
    }
    for (let i = 0; i < 300; i++) step(S, 0.0667);
  }
  const K2k = cl(k[1], 0.2, 5);
  const target = cl(K2k / 30, 0.002, DTMAX);
  S.dtq = pow(2, Math.round((log(target) / Math.LN2) * 32) / 32);
  S.acc = min(S.acc + ft * K2k, 8 * S.dtq);
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
  for (let p = 0; p < N; p++) {
    const k2 = K2[p], kx = KXP[p], ky = KYP[p];
    c1r[p] = (ar[p] + k2 * ai[p]) * sc;
    c1i[p] = (ai[p] - k2 * ar[p]) * sc;
    c2r[p] = (ky * ai[p] - kx * ar[p]) * sc;
    c2i[p] = (-ky * ar[p] - kx * ai[p]) * sc;
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
  const delta = S.bm * SPACING, ij = 1 / (2.2 * S.js);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const bx = bx0 + c2r[p], by = by0 + c2i[p], bm = sqrt(bx * bx + by * by) + 1e-6;
      const at = c1r[p] + b0 * (ca * (x - 31.5) - sa * (y - 63.5)), phi = at / delta, f = phi - floor(phi + 0.5);
      const di = min(NPR - 1, (abs(f) * delta * 16 / bm) | 0);
      const jn = cl(abs(c1i[p]) * ij, 0, 1), o = ((jn * (NR - 1) + 0.5) | 0) * 3;
      const v = min(1, LINE[di] * (0.7 + 0.3 * jn) + GLOW[di] * (0.06 + 0.5 * jn * jn)) * 255;
      display.setPixel(x, y, v * ramp[o], v * ramp[o + 1], v * ramp[o + 2]);
    }
}
