// ===== Patternflow pattern =====
// Title:   Rossby Adjustment
// Family:  sim
// Idea:    Bumps of random size and sign fall on a rotating shallow sea, each sheds a ring of waves and leaves a round lens that turns, drifts, merges or pairs off while new rings run across them.
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: geostrophic adjustment (Carl-Gustaf Rossby, 1937 and 1938) in the rotating shallow water equations on an f-plane torus, pseudo-spectral
// Round:   125
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Rain=-1..1
//
// Knob 1: Hue. test.
// Knob 2: Flow. test.
// Knob 3: Scale. test.
// Knob 4: Rain. test.

const W = 64, H = 128, N = W * H, WM = W - 1, HM = H - 1;
const { floor, ceil, abs, sqrt, exp, log, cos, sin, tanh, PI, min, max, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];

const CFG = {
  f: 1.0, // Coriolis parameter, 1 per model second
  lr: 8.5, // Rossby radius at Scale 0, LEDs
  lrBase: 1.41, // Scale multiplies it by lrBase to the knob
  dtMax: 0.12, // longest step, model seconds
  cut: 1.8, // rad per LED, the filter on the nonlinear terms
  nu: 0.02, // viscosity, LED^2 per model second
  nu4: 0.05, // and the fourth-order one
  nud: 1.5, // extra damping of the waves (divergence), LED^2 per model second
  muW: 0.02, // drag on the waves
  muP: 0.04, // drag on the balanced flow at small scales, per model second
  muL: 0.06, // and an extra damping of the balanced flow at the largest scales
  kL: 0.1, // that is, below this wavenumber
  rain: 0.45, // bumps per model second at Rain 0
  rainBase: 2.2,
  ampLo: 0.1,
  ampHi: 0.25,
  pre: 40,
};

// ---- radix-2 FFT, rows contiguous, columns by butterflies across rows ----
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
const PW = plan(W), PH = plan(H);
function fftRows(re, im, inv) {
  const { n, rev, c, s } = PW, sg = inv ? -1 : 1;
  for (let y = 0; y < H; y++) {
    const o = y * W;
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
}
function fftCols(re, im, inv) {
  const { n, rev, c, s } = PH, sg = inv ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      const a = i * W, b = j * W;
      for (let x = 0; x < W; x++) {
        let t = re[a + x];
        re[a + x] = re[b + x];
        re[b + x] = t;
        t = im[a + x];
        im[a + x] = im[b + x];
        im[b + x] = t;
      }
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const wr = c[t], wi = sg * s[t], a = (i + k) * W, b = a + half * W;
        for (let x = 0; x < W; x++) {
          const xr = re[b + x] * wr - im[b + x] * wi, xi = re[b + x] * wi + im[b + x] * wr;
          re[b + x] = re[a + x] - xr;
          im[b + x] = im[a + x] - xi;
          re[a + x] += xr;
          im[a + x] += xi;
        }
      }
  }
}
function fft2(re, im, inv) {
  fftRows(re, im, inv);
  fftCols(re, im, inv);
}

const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());

// ---- wavenumbers of the torus ----
// QI: modes with the same |nx| and |ny| share a frequency, so the tables that cost a cos and an exp are kept per (|nx|, |ny|)
const NQ = (W / 2 + 1) * (H / 2 + 1);
const KX = new Float64Array(N), KY = new Float64Array(N), K2 = new Float64Array(N), FIL = new Float64Array(N);
const MIR = new Int32Array(N), QI = new Int32Array(N), K2Q = new Float64Array(NQ);
for (let j = 0; j < H; j++)
  for (let i = 0; i < W; i++) {
    const p = j * W + i, nx = i < W / 2 ? i : i - W, ny = j < H / 2 ? j : j - H;
    KX[p] = (TAU * nx) / W;
    KY[p] = (TAU * ny) / H;
    K2[p] = KX[p] * KX[p] + KY[p] * KY[p];
    MIR[p] = ((H - j) & HM) * W + ((W - i) & WM);
    QI[p] = abs(nx) * (H / 2 + 1) + abs(ny);
    K2Q[QI[p]] = K2[p];
    FIL[p] = exp(-36 * pow(sqrt(K2[p]) / CFG.cut, 16));
  }

// ---- the state: vorticity z, divergence d and height h (in units of the rest depth), as spectra ----
const mkV = () => ({ zr: new Float64Array(N), zi: new Float64Array(N), dr: new Float64Array(N), di: new Float64Array(N), hr: new Float64Array(N), hi: new Float64Array(N) });
const NAMES = ["zr", "zi", "dr", "di", "hr", "hi"];

// ---- tables that depend on the Rossby radius ----
function setRadius(S, lr) {
  S.lr = lr;
  const f = CFG.f, c2 = f * f * lr * lr;
  S.c2 = c2;
  for (let p = 0; p < N; p++) {
    S.cK[p] = c2 * K2[p];
    S.iw2[p] = 1 / (f * f + c2 * K2[p]);
  }
  for (let q = 0; q < NQ; q++) {
    const k2 = K2Q[q], k4 = k2 * k2, kl2 = k2 * lr * lr;
    S.dW[q] = CFG.muW + (CFG.nu + CFG.nud) * k2 + CFG.nu4 * k4;
    S.dP[q] = CFG.muP * (kl2 / (1 + kl2)) + CFG.nu * k2 + CFG.nu4 * k4 + CFG.muL * exp(-k2 / (CFG.kL * CFG.kL));
  }
  S.tauF = S.tauH = -1;
}
// propagator for a time tau: the waves turn at w = sqrt(f^2 + c^2 k^2) and decay at dW, the balanced part decays at dP
function setTables(S, tau) {
  const f = CFG.f;
  for (let pass = 0; pass < 2; pass++) {
    const T = pass ? S.TH : S.TF, t = pass ? 0.5 * tau : tau;
    for (let q = 0; q < NQ; q++) {
      const w = sqrt(f * f + S.c2 * K2Q[q]), eW = exp(-S.dW[q] * t), ph = w * t, sn = sin(ph);
      T.eP[q] = exp(-S.dP[q] * t);
      T.aC[q] = eW * cos(ph);
      T.aS[q] = (eW * sn) / w;
      T.aW[q] = eW * w * sn;
    }
  }
  S.tauF = tau;
}
// out = sc * E_T (a + kb b) (+ out when add)
function prop(S, T, a, b, kb, out, add, sc) {
  const f = CFG.f, { cK, iw2 } = S, { eP, aC, aS, aW } = T;
  for (let c = 0; c < 2; c++) {
    const zA = c ? a.zi : a.zr, dA = c ? a.di : a.dr, hA = c ? a.hi : a.hr;
    const zB = b ? (c ? b.zi : b.zr) : zA, dB = b ? (c ? b.di : b.dr) : dA, hB = b ? (c ? b.hi : b.hr) : hA;
    const zO = c ? out.zi : out.zr, dO = c ? out.di : out.dr, hO = c ? out.hi : out.hr;
    const k = b ? kb : 0;
    for (let p = 1; p < N; p++) {
      const z = zA[p] + k * zB[p], d = dA[p] + k * dB[p], h = hA[p] + k * hB[p], q = QI[p];
      const P = z - f * h, A = f * z + cK[p] * h;
      const P1 = eP[q] * P, d1 = aC[q] * d + aS[q] * A, A1 = aC[q] * A - aW[q] * d;
      const w2 = iw2[p];
      const h1 = (A1 - f * P1) * w2, z1 = (cK[p] * P1 + f * A1) * w2;
      if (add) {
        zO[p] += sc * z1;
        dO[p] += sc * d1;
        hO[p] += sc * h1;
      } else {
        zO[p] = sc * z1;
        dO[p] = sc * d1;
        hO[p] = sc * h1;
      }
    }
    zO[0] = dO[0] = hO[0] = 0;
  }
}

// ---- the nonlinear terms ----
//   z_t = - div(z u), d_t = dx(z v) - dy(z u) - lap K, h_t = - div(h u), K = (u^2 + v^2) / 2
// u and v from z and d by the stream function and the velocity potential. Two inverse transforms (u + iv and z + ih),
// three forward ones (zu + izv, hu + ihv and K), the pairs separated by the mirror mode.
function rhs(S, V, O) {
  const { ar, ai, br, bi, cr, ci } = S, inv = 1 / N;
  for (let p = 0; p < N; p++) {
    const k2 = K2[p];
    if (k2 === 0) {
      ar[p] = ai[p] = 0;
    } else {
      const kx = KX[p], ky = KY[p], i2 = 1 / k2, zr = V.zr[p], zi = V.zi[p], dr = V.dr[p], di = V.di[p];
      const ur = (-ky * zi + kx * di) * i2, ui = (ky * zr - kx * dr) * i2;
      const vr = (kx * zi + ky * di) * i2, vi = (-kx * zr - ky * dr) * i2;
      ar[p] = ur - vi;
      ai[p] = ui + vr;
    }
    br[p] = V.zr[p] - V.hi[p];
    bi[p] = V.zi[p] + V.hr[p];
  }
  fft2(ar, ai, true);
  fft2(br, bi, true);
  for (let p = 0; p < N; p++) {
    const u = ar[p], v = ai[p], z = br[p], h = bi[p];
    ar[p] = z * u;
    ai[p] = z * v;
    br[p] = h * u;
    bi[p] = h * v;
    cr[p] = 0.5 * (u * u + v * v);
    ci[p] = 0;
  }
  fft2(ar, ai, false);
  fft2(br, bi, false);
  fft2(cr, ci, false);
  for (let p = 1; p < N; p++) {
    const m = MIR[p], kx = KX[p], ky = KY[p], fl = FIL[p] * inv;
    // F1 = z u, F2 = z v
    const f1r = 0.5 * (ar[p] + ar[m]), f1i = 0.5 * (ai[p] - ai[m]);
    const f2r = 0.5 * (ai[p] + ai[m]), f2i = -0.5 * (ar[p] - ar[m]);
    // G1 = h u, G2 = h v
    const g1r = 0.5 * (br[p] + br[m]), g1i = 0.5 * (bi[p] - bi[m]);
    const g2r = 0.5 * (bi[p] + bi[m]), g2i = -0.5 * (br[p] - br[m]);
    // N_z = -i (kx F1 + ky F2)
    const xr = kx * f1r + ky * f2r, xi = kx * f1i + ky * f2i;
    O.zr[p] = xi * fl;
    O.zi[p] = -xr * fl;
    // N_d = i (kx F2 - ky F1) + k^2 K
    const yr = kx * f2r - ky * f1r, yi = kx * f2i - ky * f1i;
    O.dr[p] = (-yi + K2[p] * cr[p]) * fl;
    O.di[p] = (yr + K2[p] * ci[p]) * fl;
    // N_h = -i (kx G1 + ky G2)
    const wr = kx * g1r + ky * g2r, wi = kx * g1i + ky * g2i;
    O.hr[p] = wi * fl;
    O.hi[p] = -wr * fl;
  }
  for (const nm of NAMES) O[nm][0] = 0;
}

function combine(out, a, b, kb) {
  for (const nm of NAMES) {
    const o = out[nm], x = a[nm], y = b[nm];
    for (let p = 0; p < N; p++) o[p] = x[p] + kb * y[p];
  }
}

// Lawson's form of Kutta's third order scheme: the linear part, waves and damping, goes in exactly
function step(S, tau) {
  if (abs(S.tauF - tau) > 1e-9) setTables(S, tau);
  const { U, K1, K2v, K3, V1, V2 } = S;
  rhs(S, U, K1);
  combine(V1, U, K1, 0.5 * tau);
  prop(S, S.TH, V1, null, 0, V2, false, 1);
  rhs(S, V2, K2v);
  prop(S, S.TF, U, K1, -tau, V1, false, 1);
  prop(S, S.TH, K2v, null, 0, V1, true, 2 * tau);
  rhs(S, V1, K3);
  prop(S, S.TF, U, K1, tau / 6, V2, false, 1);
  prop(S, S.TH, K2v, null, 0, V2, true, (2 * tau) / 3);
  for (const nm of NAMES) {
    const o = U[nm], a = V2[nm], b = K3[nm];
    for (let p = 0; p < N; p++) o[p] = a[p] + (tau / 6) * b[p];
  }
  S.time += tau;
}

// a Gaussian bump of height amp (in rest depths), half-height radius rad, at (x0, y0): its spectrum, mean left out
function addBump(S, amp, rad, x0, y0) {
  const sg = rad / 1.1774, a = (amp * TAU * sg * sg) / N, V = S.U;
  const ex = new Float64Array(W), ey = new Float64Array(H), exs = new Float64Array(W), eys = new Float64Array(H);
  for (let i = 0; i < W; i++) {
    const nx = i < W / 2 ? i : i - W, kx = (TAU * nx) / W;
    ex[i] = cos(kx * x0);
    exs[i] = -sin(kx * x0);
  }
  for (let j = 0; j < H; j++) {
    const ny = j < H / 2 ? j : j - H, ky = (TAU * ny) / H;
    ey[j] = cos(ky * y0);
    eys[j] = -sin(ky * y0);
  }
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const p = j * W + i;
      if (p === 0) continue;
      const g = a * exp(-0.5 * K2[p] * sg * sg), cr = ex[i] * ey[j] - exs[i] * eys[j], ci = ex[i] * eys[j] + exs[i] * ey[j];
      V.hr[p] += g * cr;
      V.hi[p] += g * ci;
    }
}

function rainRate(k) {
  return CFG.rain * pow(CFG.rainBase, cl(k, -1.2, 1.2));
}
function nextDrop(S, rate) {
  S.next = S.time - log(1 - Math.random()) / rate;
}
function drop(S) {
  const sgn = Math.random() < 0.5 ? -1 : 1, size = pow(3, Math.random() - 0.5) * 1.0, rad = S.lr * (0.5 + Math.random());
  const amp = sgn * (CFG.ampLo + (CFG.ampHi - CFG.ampLo) * Math.random());
  addBump(S, amp, rad, Math.random() * W, Math.random() * H);
}

const lrOf = (v) => CFG.lr * pow(CFG.lrBase, cl(v, -1.2, 1.2));

function newState(lr) {
  const mk = () => new Float64Array(N);
  const tb = () => ({ eP: new Float64Array(NQ), aC: new Float64Array(NQ), aS: new Float64Array(NQ), aW: new Float64Array(NQ) });
  const S = {
    U: mkV(), K1: mkV(), K2v: mkV(), K3: mkV(), V1: mkV(), V2: mkV(),
    ar: mk(), ai: mk(), br: mk(), bi: mk(), cr: mk(), ci: mk(),
    cK: mk(), iw2: mk(), dW: new Float64Array(NQ), dP: new Float64Array(NQ), TF: tb(), TH: tb(),
    lr: lr, c2: 0, tauF: -1, time: 0, next: 0, acc: 0, ready: false, rate: 1,
    pz: new Float64Array(N), ph: new Float64Array(N), hue: 0, lutHue: -9, lut: new Uint8Array(NB * NS * 3), qs: 0.06, gs: 20,
  };
  setRadius(S, lr);
  return S;
}

function physical(S) {
  const { ar, ai, U } = S;
  for (let p = 0; p < N; p++) {
    ar[p] = U.zr[p] - U.hi[p];
    ai[p] = U.zi[p] + U.hr[p];
  }
  fft2(ar, ai, true);
  let q2 = 0, g2 = 0;
  const f = CFG.f;
  for (let p = 0; p < N; p++) {
    S.pz[p] = ar[p];
    S.ph[p] = ai[p];
    const q = (1 + ar[p] / f) / (1 + ai[p]) - 1;
    q2 += q * q;
    const hx = ai[(p & ~WM) + ((p + 1) & WM)] - ai[(p & ~WM) + ((p - 1) & WM)], hy = ai[(p + W) & (N - 1)] - ai[(p - W) & (N - 1)];
    g2 += hx * hx + hy * hy;
  }
  S.qr = sqrt(q2 / N);
  S.gr = sqrt(g2 / N);
}

function start(params, k) {
  const S = newState(lrOf(k[2]));
  params.s = S;
  S.rate = rainRate(k[3]);
  nextDrop(S, 4 * S.rate);
  const n = ceil(CFG.pre / CFG.dtMax);
  for (let i = 0; i < n; i++) {
    while (S.next <= S.time) (drop(S), nextDrop(S, 4 * S.rate));
    step(S, CFG.dtMax);
  }
  nextDrop(S, S.rate);
  S.ready = true;
  physical(S);
  S.qe = S.qr;
  S.ge = S.gr;
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.1, 8);
  S.hue = cl(k[0], 0, 1);
  const lt = lrOf(k[2]);
  if (abs(lt - S.lr) > 1e-4) setRadius(S, S.lr + (lt - S.lr) * (1 - exp(-ft / 0.5)));
  S.rate = rainRate(k[3]);
  let rest = ft * flow;
  const n = max(1, ceil(rest / CFG.dtMax - 1e-9)), tau = rest / n;
  if (rest > 1e-9) {
    for (let i = 0; i < n; i++) {
      step(S, tau);
      while (S.next <= S.time) (drop(S), nextDrop(S, S.rate));
    }
  }
  physical(S);
  // the colour and light gains follow the rms of the potential vorticity and of the slope, slowly
  const ea = 1 - exp(-ft / 8);
  S.qe += (S.qr - S.qe) * ea;
  S.ge += (S.gr - S.ge) * ea;
  S.qs = max(0.012, 4 * S.qe);
  S.gs = 1.6 * S.ge;
  if (!isFinite(S.pz[N >> 1] + S.ph[N >> 2])) start(params, k);
}

// ---- colour: the balanced part (potential vorticity) picks the metal, the slope of the surface lights it ----
// stops over b = 0 (a hollow, turning the way a low turns), 0.5 (flat sea) and 1 (a hill)
const STOPS = [
  [0.0, 118, 92, 176],
  [0.3, 156, 138, 172],
  [0.5, 182, 172, 160],
  [0.7, 226, 192, 124],
  [1.0, 250, 206, 100],
];
const DBG = 0;
const NB = 64, NS = 64;
function buildLut(S, hue) {
  const a = hue * TAU, c = cos(a), s = sin(a), k1 = (1 - c) / 3, k2 = sqrt(1 / 3) * s;
  const m = [c + k1, k1 - k2, k1 + k2, k1 + k2, c + k1, k1 - k2, k1 - k2, k1 + k2, c + k1];
  for (let ib = 0; ib < NB; ib++) {
    const b = ib / (NB - 1);
    let j = 0;
    while (j < STOPS.length - 2 && b > STOPS[j + 1][0]) j++;
    const A = STOPS[j], B = STOPS[j + 1], t = cl((b - A[0]) / (B[0] - A[0]), 0, 1);
    const r0 = A[1] + (B[1] - A[1]) * t, g0 = A[2] + (B[2] - A[2]) * t, b0 = A[3] + (B[3] - A[3]) * t;
    for (let is = 0; is < NS; is++) {
      const sh = (is / (NS - 1)) * 2 - 1;
      const mul = 1 + 0.42 * sh, spec = cl((sh - 0.5) / 0.5, 0, 1) * 0.3;
      let r = r0 * mul + (255 - r0 * mul) * spec, g = g0 * mul + (244 - g0 * mul) * spec, bl = b0 * mul + (214 - b0 * mul) * spec;
      const o = (ib * NS + is) * 3;
      S.lut[o] = cl(m[0] * r + m[1] * g + m[2] * bl, 0, 255);
      S.lut[o + 1] = cl(m[3] * r + m[4] * g + m[5] * bl, 0, 255);
      S.lut[o + 2] = cl(m[6] * r + m[7] * g + m[8] * bl, 0, 255);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.lutHue !== S.hue) (S.lutHue = S.hue), buildLut(S, S.hue);
  const { ph, pz, lut } = S, f = CFG.f, gq = 1 / S.qs, gs = S.gs;
  for (let y = 0; y < H; y++) {
    const j = HM - y, o = j * W, ou = ((j + 1) & HM) * W, od = ((j - 1) & HM) * W; // the model's y runs up the panel
    for (let x = 0; x < W; x++) {
      const p = o + x, hx = ph[o + ((x + 1) & WM)] - ph[o + ((x - 1) & WM)], hy = ph[od + x] - ph[ou + x];
      const q = (1 + pz[p] / f) / (1 + ph[p]) - 1;
      const g = hx + hy, b = DBG === 1 ? 0.5 : 0.5 - 0.5 * tanh(q * gq), sh = DBG === 2 ? 0 : g / (abs(g) + gs);
      const lo = ((((b * (NB - 1) + 0.5) | 0) * NS + (((sh + 1) * 0.5 * (NS - 1) + 0.5) | 0)) * 3);
      display.setPixel(x, y, lut[lo], lut[lo + 1], lut[lo + 2]);
    }
  }
}
