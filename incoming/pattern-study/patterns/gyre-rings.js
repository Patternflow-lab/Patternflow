// ===== Patternflow pattern =====
// Title:   Gyre Rings
// Family:  ocean
// Idea:    draft
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft
// Round:   124
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.8..4, Scale=-1..1, Wind=-1..1
//
// Knob 1: Hue. draft
// Knob 2: Flow. draft
// Knob 3: Scale. draft
// Knob 4: Wind. draft

const W = 64, H = 128;
const { floor, ceil, max, min, abs, sqrt, exp, log, pow, sin, cos, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Cells are LEDs: NX by NY. The stream function psi and the vorticity zeta live on the cell corners,
// (NX + 1) by (NY + 1) of them, with psi = 0 on the four walls. Row j counts northward from the south wall.
const NX = W, NY = H, SX = NX + 1, NVT = SX * (NY + 1);
const MX = NX - 1, MY = NY - 1, NM = MX * MY; // interior corners, which is the number of sine modes

const CFG = {
  beta: 1, // planetary vorticity gradient: model units are LEDs and tu, so beta is 1
  d0: 2.0, // Munk width at Scale -1, LEDs
  d1: 3.1, // and at Scale 1
  wn0: 5.0, // wind: delta_I / delta_M at Wind 0
  wnr: 1.12, // ratio per unit of Wind
  rf: 0.3, // bottom friction in units of beta delta_M
  nz: 1.8, // the gusts, as a share of the wind curl amplitude
  nzTau: 0.2, // their correlation time, tu
  nzK: 0.57, // their wavenumber in units of 1 / sqrt(delta_M)
  tc: 0.5, // share of the relaxation target that is a step at the middle latitude, the rest a ramp
  tw: 0.3, // width of the step, as a share of half the panel
  tauT: 3, // relaxation of the temperature, tu
  vel: 5, // peak jet speed per unit of Flow, LEDs per second
  ukf: 3, // peak jet speed over beta (delta_I)^2
  cfl: 0.5, // (|u| + |v|) h per step
  warm: 700, // steps of hidden warm-up
  base: 0.0,
  v0: 0.36, // brightest channel at the cold end, of 255
  v1: 0.95, // and at the warm end
  vg: 0.8, // exponent of the ramp between
  vs: 0.32, // how far the shading takes it either way, as a share
  sa: 0.6, // lightness given to the temperature anomaly
  sw: 1.2, // anomaly over its block scale that saturates it
  sz: 0.6, // lightness given to the vorticity
  ss: 1.0, // and to the speed
  sk: 1.2, // speed over the rms speed that saturates it
  zfl: 0.15, // share of the panel's mean square vorticity every block gets at least
  zk: 1.2, // vorticity over its scale that saturates the shading
};

// ---------------------------------------------------------------- sine transform
function plan(n) {
  const sw = [], tw = new Float64Array(2 * n);
  let lg = 0;
  while (1 << lg < n) lg++;
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) if (i & (1 << b)) r |= 1 << (lg - 1 - b);
    if (r > i) sw.push(i, r);
  }
  for (let h = 1; h < n; h <<= 1)
    for (let k = 0; k < h; k++) {
      tw[2 * (h - 1 + k)] = cos((PI * k) / h);
      tw[2 * (h - 1 + k) + 1] = -sin((PI * k) / h);
    }
  return { n, sw: Int32Array.from(sw), tw };
}
function fft1(re, im, P) {
  const n = P.n, sw = P.sw, tw = P.tw;
  for (let p = 0; p < sw.length; p += 2) {
    const i = sw[p], j = sw[p + 1];
    let t = re[i];
    re[i] = re[j];
    re[j] = t;
    t = im[i];
    im[i] = im[j];
    im[j] = t;
  }
  for (let a = 0; a < n; a += 4) {
    const x0r = re[a], x0i = im[a], x1r = re[a + 1], x1i = im[a + 1];
    const x2r = re[a + 2], x2i = im[a + 2], x3r = re[a + 3], x3i = im[a + 3];
    const t0r = x0r + x1r, t0i = x0i + x1i, t1r = x0r - x1r, t1i = x0i - x1i;
    const t2r = x2r + x3r, t2i = x2i + x3i, t3r = x2r - x3r, t3i = x2i - x3i;
    re[a] = t0r + t2r;
    im[a] = t0i + t2i;
    re[a + 2] = t0r - t2r;
    im[a + 2] = t0i - t2i;
    re[a + 1] = t1r + t3i;
    im[a + 1] = t1i - t3r;
    re[a + 3] = t1r - t3i;
    im[a + 3] = t1i + t3r;
  }
  for (let half = 4; half < n; half <<= 1) {
    const len = half << 1, w0 = 2 * (half - 1);
    for (let s = 0; s < n; s += len)
      for (let k = 0; k < half; k++) {
        const a = s + k, b = a + half, c = tw[w0 + 2 * k], d = tw[w0 + 2 * k + 1];
        const br = re[b], bi = im[b], xr = br * c - bi * d, xi = br * d + bi * c, ar = re[a], ai = im[a];
        re[b] = ar - xr;
        im[b] = ai - xi;
        re[a] = ar + xr;
        im[a] = ai + xi;
      }
  }
}
const PX = plan(2 * NX), PY = plan(2 * NY);
const XR = new Float64Array(2 * NX), XI = new Float64Array(2 * NX), YR = new Float64Array(2 * NY), YI = new Float64Array(2 * NY);

// DST-I of the MY rows of MX values, two rows to one complex transform of the odd extension: the sine
// coefficients of the first row are minus half the imaginary part, those of the second half the real part.
// Input src[so + r * ss + c], output dst[d0 + r * ds + c]. Not scaled: the inverse is the same call times 4 / (NX NY).
function passX(src, so, ss, dst, d0, ds) {
  for (let r = 0; r < MY; r += 2) {
    const a = so + r * ss, b = a + ss, two = r + 1 < MY;
    XR[0] = 0;
    XI[0] = 0;
    XR[NX] = 0;
    XI[NX] = 0;
    for (let c = 0; c < MX; c++) {
      const u = src[a + c], v = two ? src[b + c] : 0;
      XR[c + 1] = u;
      XI[c + 1] = v;
      XR[2 * NX - 1 - c] = -u;
      XI[2 * NX - 1 - c] = -v;
    }
    fft1(XR, XI, PX);
    const oa = d0 + r * ds, ob = oa + ds;
    for (let c = 0; c < MX; c++) {
      dst[oa + c] = -0.5 * XI[c + 1];
      if (two) dst[ob + c] = 0.5 * XR[c + 1];
    }
  }
}
function passY(src, so, ss, dst, d0, ds) {
  for (let c = 0; c < MX; c += 2) {
    const two = c + 1 < MX;
    YR[0] = 0;
    YI[0] = 0;
    YR[NY] = 0;
    YI[NY] = 0;
    for (let r = 0, p = so + c; r < MY; r++, p += ss) {
      const u = src[p], v = two ? src[p + 1] : 0;
      YR[r + 1] = u;
      YI[r + 1] = v;
      YR[2 * NY - 1 - r] = -u;
      YI[2 * NY - 1 - r] = -v;
    }
    fft1(YR, YI, PY);
    for (let r = 0, p = d0 + c; r < MY; r++, p += ds) {
      dst[p] = -0.5 * YI[r + 1];
      if (two) dst[p + 1] = 0.5 * YR[r + 1];
    }
  }
}
const SC = 4 / (NX * NY);

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

// ---------------------------------------------------------------- the model
function deltaOf(k) {
  return CFG.d0 * pow(CFG.d1 / CFG.d0, (cl(k, -1, 1) + 1) / 2);
}
function wnOf(k) {
  return CFG.wn0 * pow(CFG.wnr, cl(k, -1, 1));
}

function start(params, k) {
  const S = {
    psi: new Float64Array(NVT), zeta: new Float64Array(NVT), g: new Float64Array(NVT),
    qh: new Float64Array(NM), ph: new Float64Array(NM), t1: new Float64Array(NM), Fh: new Float64Array(NM),
    G: [new Float64Array(NM), new Float64Array(NM), new Float64Array(NM)],
    Lam: new Float64Array(NM), lam: new Float64Array(NM), ninv: new Float64Array(NM),
    nm: [], nw: null, xi: null,
    hs: [1, 1], nstep: 0, t: 0, umax: 100,
    delta: 0, wn: 0, W0: 0, A: 0,
    TW: NX + 4, T: new Float64Array((NX + 4) * (NY + 4)), T1: new Float64Array((NX + 4) * (NY + 4)),
    UF: new Float64Array(SX * NY), VF: new Float64Array(NX * (NY + 1)), FX: new Float64Array(SX * NY), FY: new Float64Array(NX * (NY + 1)),
    Ts: new Float64Array(NY), hue: 0, lutHue: -1, lut: null, env: new Float64Array(32), envT: new Float64Array(32),
    kd: k[2], kw: k[3],
  };
  params.s = S;
  for (let n = 0; n < MY; n++)
    for (let m = 0; m < MX; m++) {
      const L = 4 * sin(((m + 1) * PI) / (2 * NX)) ** 2 + 4 * sin(((n + 1) * PI) / (2 * NY)) ** 2;
      S.Lam[n * MX + m] = L;
      S.ninv[n * MX + m] = -1 / L;
    }
  // modes the gusts may use: wavenumber up to 0.9 per LED
  for (let n = 0; n < MY; n++)
    for (let m = 0; m < MX; m++) {
      const kx = ((m + 1) * PI) / NX, ky = ((n + 1) * PI) / NY;
      if (kx * kx + ky * ky < 0.81) S.nm.push(n * MX + m);
    }
  S.nw = new Float64Array(S.nm.length);
  S.xi = new Float64Array(S.nm.length);
  for (let j = 0; j < NY; j++) {
    const y = (j + 0.5 - NY / 2) / (NY / 2);
    S.Ts[j] = 0.5 - 0.5 * ((1 - CFG.tc) * y + CFG.tc * tanh(y / CFG.tw));
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) S.T[(j + 2) * S.TW + i + 2] = S.Ts[j];
  ghost(S.T, S.TW);
  setParams(S, k[2], k[3]);
  initial(S);
  for (let n = 0; n < CFG.warm; n++) {
    const h = cl(CFG.cfl / S.umax, 0.0001, 0.004);
    step(S, h, n > CFG.warm / 3);
  }
}

// delta_M, wind and gusts from Scale and Wind. A = beta delta^3, curl amplitude W0 = wn^3 A / (beta NX): the
// Sverdrup transport that a Munk layer carries has the inertial width delta_I = wn delta_M.
function setParams(S, kd, kw) {
  const delta = deltaOf(kd), wn = wnOf(kw);
  S.delta = delta;
  S.wn = wn;
  const A = CFG.beta * delta ** 3;
  S.W0 = (wn ** 3 * A * CFG.beta) / NX;
  if (abs(A - S.A) > 0.002 * A) {
    S.A = A;
    const rf = CFG.rf * CFG.beta * delta;
    for (let q = 0; q < NM; q++) S.lam[q] = rf + A * S.Lam[q];
    const k0 = CFG.nzK / sqrt(delta);
    for (let q = 0; q < S.nm.length; q++) {
      const L = S.Lam[S.nm[q]], kk = sqrt(L), z = (kk - k0) / (0.45 * k0);
      S.nw[q] = exp(-z * z);
    }
  }
  // wind forcing in the sine basis, for unit curl; scaled when used
  if (!S.Fu) {
    const f = new Float64Array(NVT);
    for (let j = 1; j < NY; j++) for (let i = 1; i < NX; i++) f[j * SX + i] = -sin((TAU * j) / NY);
    S.Fu = new Float64Array(NM);
    passX(f, SX + 1, SX, S.t1, 0, MX);
    passY(S.t1, 0, MX, S.Fu, 0, MX);
    for (let q = 0; q < NM; q++) S.Fu[q] *= SC;
  }
}

function initial(S) {
  const { psi, W0, delta } = S, beta = CFG.beta;
  for (let j = 1; j < NY; j++) {
    const F = -W0 * sin((TAU * j) / NY);
    for (let i = 1; i < NX; i++) {
      const e = exp(-i / (2 * delta)), th = (sqrt(3) * i) / (2 * delta);
      const bl = e * (cos(th) + sin(th) / sqrt(3));
      psi[j * SX + i] = (F / beta) * (i - NX) + (F / beta) * NX * bl;
    }
  }
  // a wave on the middle latitude to start the jet meandering
  for (let j = 1; j < NY; j++)
    for (let i = 1; i < NX; i++) {
      const y = (j - NY / 2) / (NY / 2), env = exp(-(y * y) / 0.08);
      psi[j * SX + i] += 0.5 * W0 * NX * 0.15 * env * sin(((3 * PI) / NX) * i + 1) * sin((PI * i) / NX) * cos(3 * y);
    }
  lap(S);
  for (let j = 1; j < NY; j++) for (let i = 1; i < NX; i++) S.g[j * SX + i] = S.zeta[j * SX + i];
  passX(S.g, SX + 1, SX, S.t1, 0, MX);
  passY(S.t1, 0, MX, S.qh, 0, MX);
  for (let q = 0; q < NM; q++) S.qh[q] *= SC;
}

function lap(S) {
  const { psi, zeta } = S;
  for (let j = 1; j < NY; j++) {
    let p = j * SX + 1;
    for (let i = 1; i < NX; i++, p++) zeta[p] = psi[p - 1] + psi[p + 1] + psi[p - SX] + psi[p + SX] - 4 * psi[p];
  }
}
function solvePsi(S) {
  const { qh, ph, ninv, t1, psi } = S;
  for (let q = 0; q < NM; q++) ph[q] = qh[q] * ninv[q];
  passX(ph, 0, MX, t1, 0, MX);
  passY(t1, 0, MX, psi, SX + 1, SX);
}
// -J(psi, zeta) - beta psi_x on the corners, Arakawa's Jacobian (1966): energy and enstrophy are conserved by the scheme
function tendency(S) {
  const { psi, zeta, g } = S, beta = CFG.beta;
  lap(S);
  let um = 0;
  for (let j = 1; j < NY; j++) {
    let p = j * SX + 1;
    for (let i = 1; i < NX; i++, p++) {
      const pE = psi[p + 1], pW = psi[p - 1], pN = psi[p + SX], pS = psi[p - SX];
      const pNE = psi[p + SX + 1], pNW = psi[p + SX - 1], pSE = psi[p - SX + 1], pSW = psi[p - SX - 1];
      const zE = zeta[p + 1], zW = zeta[p - 1], zN = zeta[p + SX], zS = zeta[p - SX];
      const zNE = zeta[p + SX + 1], zNW = zeta[p + SX - 1], zSE = zeta[p - SX + 1], zSW = zeta[p - SX - 1];
      const jpp = (pE - pW) * (zN - zS) - (pN - pS) * (zE - zW);
      const jpx = pE * (zNE - zSE) - pW * (zNW - zSW) - pN * (zNE - zNW) + pS * (zSE - zSW);
      const jxp = pNE * (zN - zE) - pSW * (zW - zS) - pNW * (zN - zW) + pSE * (zE - zS);
      g[p] = -(jpp + jpx + jxp) / 12 - (beta * (pE - pW)) / 2;
      const a = abs(pE - pW) + abs(pN - pS);
      if (a > um) um = a;
    }
  }
  S.umax = max(um / 2, 1);
}

// ---------------------------------------------------------------- the temperature
function ghost(T, Wd) {
  const Hd = NY + 4;
  for (let j = 2; j < NY + 2; j++) {
    const o = j * Wd;
    T[o] = T[o + 1] = T[o + 2];
    T[o + Wd - 1] = T[o + Wd - 2] = T[o + Wd - 3];
  }
  for (let i = 0; i < Wd; i++) {
    T[i] = T[Wd + i] = T[2 * Wd + i];
    T[(Hd - 1) * Wd + i] = T[(Hd - 2) * Wd + i] = T[(Hd - 3) * Wd + i];
  }
}
function lim(a, b) {
  const ab = a * b;
  return ab > 0 ? (2 * ab) / (a + b) : 0;
}
// the face fluxes of T for the velocity UF, VF: van Leer's limited upwind values
function fluxes(S, T) {
  const { TW, UF, VF, FX, FY } = S;
  for (let j = 0; j < NY; j++) {
    const row = (j + 2) * TW + 2;
    for (let i = 1; i < NX; i++) {
      const p = row + i, u = UF[j * SX + i];
      let f;
      if (u >= 0) f = T[p - 1] + 0.5 * lim(T[p - 1] - T[p - 2], T[p] - T[p - 1]);
      else f = T[p] - 0.5 * lim(T[p] - T[p - 1], T[p + 1] - T[p]);
      FX[j * SX + i] = u * f;
    }
  }
  for (let j = 1; j < NY; j++) {
    const row = (j + 2) * TW + 2;
    for (let i = 0; i < NX; i++) {
      const p = row + i, v = VF[j * NX + i];
      let f;
      if (v >= 0) f = T[p - TW] + 0.5 * lim(T[p - TW] - T[p - 2 * TW], T[p] - T[p - TW]);
      else f = T[p] - 0.5 * lim(T[p] - T[p - TW], T[p + TW] - T[p]);
      FY[j * NX + i] = v * f;
    }
  }
}
// Flux form on the cells, the fluxes from the corner differences of psi, so the discrete divergence of every cell is
// zero and the walls pass nothing. Two stages of Heun's SSP Runge-Kutta, then the relaxation.
function tracer(S, h) {
  const { TW, UF, VF, FX, FY, psi, T, T1, Ts } = S;
  for (let j = 0; j < NY; j++) for (let i = 1; i < NX; i++) UF[j * SX + i] = psi[j * SX + i] - psi[(j + 1) * SX + i];
  for (let j = 1; j < NY; j++) for (let i = 0; i < NX; i++) VF[j * NX + i] = psi[j * SX + i + 1] - psi[j * SX + i];
  fluxes(S, T);
  for (let j = 0; j < NY; j++) {
    const row = (j + 2) * TW + 2;
    for (let i = 0; i < NX; i++) {
      const p = row + i;
      T1[p] = T[p] - h * (FX[j * SX + i + 1] - FX[j * SX + i] + FY[(j + 1) * NX + i] - FY[j * NX + i]);
    }
  }
  ghost(T1, TW);
  fluxes(S, T1);
  const rl = h / CFG.tauT;
  for (let j = 0; j < NY; j++) {
    const row = (j + 2) * TW + 2, ts = Ts[j];
    for (let i = 0; i < NX; i++) {
      const p = row + i;
      const t2 = T1[p] - h * (FX[j * SX + i + 1] - FX[j * SX + i] + FY[(j + 1) * NX + i] - FY[j * NX + i]);
      const v = 0.5 * (T[p] + t2);
      T[p] = v + rl * (ts - v);
    }
  }
  ghost(T, TW);
}

// ---------------------------------------------------------------- one step
// Adams-Bashforth 3 with the weights of the actual steps (Lagrange through the last three tendencies), damping
// taken implicitly, so a steady state of the damped balance is exact.
function abWeights(h, h1, h2) {
  const hh = h * h, h3 = hh * h;
  return [
    (h3 / 3 + ((2 * h1 + h2) * hh) / 2 + h1 * (h1 + h2) * h) / (h1 * (h1 + h2)),
    -(h3 / 3 + ((h1 + h2) * hh) / 2) / (h1 * h2),
    (h3 / 3 + (h1 * hh) / 2) / ((h1 + h2) * h2),
  ];
}
function step(S, h, doT) {
  const { qh, G, Fh, lam, t1, Fu, nm, nw, xi } = S;
  solvePsi(S);
  if (doT) tracer(S, h);
  tendency(S);
  passX(S.g, SX + 1, SX, t1, 0, MX);
  const g0 = G[2];
  passY(t1, 0, MX, g0, 0, MX);
  G[2] = G[1];
  G[1] = G[0];
  G[0] = g0;
  const A0 = G[0], A1 = G[1], A2 = G[2];
  if (S.nstep < 2)
    for (let q = 0; q < NM; q++) {
      A1[q] = A0[q];
      A2[q] = A0[q];
    }
  const w = abWeights(h, S.hs[0], S.hs[1]), w0 = w[0] * SC, w1 = w[1] * SC, w2 = w[2] * SC, hw = h * S.W0;
  for (let q = 0; q < NM; q++) qh[q] = (qh[q] + w0 * A0[q] + w1 * A1[q] + w2 * A2[q] + hw * Fu[q]) / (1 + lam[q] * h);
  // gusts: an Ornstein-Uhlenbeck forcing of the curl on a band of modes
  const rho = exp(-h / CFG.nzTau), sg = sqrt(1 - rho * rho) * CFG.nz * S.W0;
  for (let q = 0; q < nm.length; q++) {
    xi[q] = rho * xi[q] + sg * nw[q] * gauss();
    qh[nm[q]] += h * xi[q];
  }
  S.hs[1] = S.hs[0];
  S.hs[0] = h;
  S.nstep++;
  S.t += h;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1);
  const f = 1 - exp(-ft / 0.3);
  S.kd += (cl(k[2], -1, 1) - S.kd) * f;
  S.kw += (cl(k[3], -1, 1) - S.kw) * f;
  setParams(S, S.kd, S.kw);
  S.hue = k[0];
  // the clock: the peak jet speed is vel LEDs a second per unit of Flow
  const ujet = CFG.ukf * CFG.beta * (S.wn * S.delta) ** 2;
  const rate = (CFG.vel * cl(k[1], 0.8, 4)) / ujet;
  const Ht = ft * rate;
  const n = max(1, ceil((Ht * S.umax) / CFG.cfl));
  for (let i = 0; i < n; i++) step(S, Ht / n, true);
  if (!(S.umax < 3000)) params.s = null;
}

// ---------------------------------------------------------------- colour
const RGB = [0, 0, 0];
function srgb(x) {
  return x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055;
}
function oklab(L, C, h) {
  for (let it = 0; it < 24; it++) {
    const a = C * cos((h * PI) / 180), b = C * sin((h * PI) / 180);
    const l = pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    if ((r >= -0.002 && r <= 1.002 && g >= -0.002 && g <= 1.002 && bl >= -0.002 && bl <= 1.002) || C < 0.004) {
      RGB[0] = cl(srgb(cl(r, 0, 1)), 0, 1);
      RGB[1] = cl(srgb(cl(g, 0, 1)), 0, 1);
      RGB[2] = cl(srgb(cl(bl, 0, 1)), 0, 1);
      return;
    }
    C *= 0.93;
  }
}
// temperature stops, cold to warm: lightness, chroma, hue in degrees
const STOPS = [
  [0.0, 0.34, 0.12, 262],
  [0.3, 0.5, 0.11, 240],
  [0.5, 0.72, 0.1, 195],
  [0.72, 0.84, 0.12, 110],
  [1.0, 0.82, 0.15, 75],
];
const NT = 128, NS = 25;
function buildLut(S, hue) {
  const lut = new Uint8Array(NT * NS * 3);
  for (let i = 0; i < NT; i++) {
    const x = i / (NT - 1);
    let a = 1;
    while (a < STOPS.length - 1 && x > STOPS[a][0]) a++;
    const s0 = STOPS[a - 1], s1 = STOPS[a], u = sm(0, 1, cl((x - s0[0]) / (s1[0] - s0[0]), 0, 1));
    const L = s0[1] + (s1[1] - s0[1]) * u, C = s0[2] + (s1[2] - s0[2]) * u, hh = s0[3] + (s1[3] - s0[3]) * u + hue * 360;
    oklab(L, C, hh);
    // the colour keeps its hue and the ratios of its channels, and the brightest channel is set directly: it is what the
    // panel's dim end and the eye's sense of a change both follow, which is no longer a thing of the ramp's lightness
    const mx = max(RGB[0], RGB[1], RGB[2], 0.01), vb = CFG.v0 + (CFG.v1 - CFG.v0) * pow(x, CFG.vg);
    for (let j = 0; j < NS; j++) {
      const k = (vb * (1 + (CFG.vs * (j - 12)) / 12)) / mx * 255;
      const o = (i * NS + j) * 3;
      lut[o] = min(255, (RGB[0] * k + 0.5) | 0);
      lut[o + 1] = min(255, (RGB[1] * k + 0.5) | 0);
      lut[o + 2] = min(255, (RGB[2] * k + 0.5) | 0);
    }
  }
  S.lut = lut;
  S.lutHue = hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const hue = S.hue + CFG.base;
  if (abs(S.lutHue - hue) > 0.002) buildLut(S, hue);
  const { T, TW, Ts, zeta, lut, env, envT, UF, VF } = S;
  // the scales of the vorticity and of the temperature anomaly, one value to every 16 by 16 block, each floored by a
  // share of the whole panel's, so the shading shows what the water is doing in the quiet corners as in the jet
  env.fill(0);
  envT.fill(0);
  let tot = 0, totT = 0;
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const p = j * SX + i, z = (zeta[p] + zeta[p + 1] + zeta[p + SX] + zeta[p + SX + 1]) * 0.25, d = T[(j + 2) * TW + i + 2] - Ts[j];
      env[(j >> 4) * 4 + (i >> 4)] += z * z;
      envT[(j >> 4) * 4 + (i >> 4)] += d * d;
      tot += z * z;
      totT += d * d;
    }
  let sp2 = 0;
  for (let p = 0; p < NVT; p += 5) sp2 += UF[p % (SX * NY)] * UF[p % (SX * NY)] + VF[p % (NX * (NY + 1))] * VF[p % (NX * (NY + 1))];
  const isp = 1 / (CFG.sk * sqrt((sp2 / (NVT / 5)) * 1) + 1e-6);
  const fl = (CFG.zfl * tot) / NVT, flT = (CFG.zfl * totT) / NVT;
  for (let b = 0; b < 32; b++) {
    env[b] = sqrt(env[b] / 256 + fl) * CFG.zk;
    envT[b] = sqrt(envT[b] / 256 + flT) * CFG.sw;
  }
  for (let py = 0; py < H; py++) {
    const j = NY - 1 - py, fy = cl((j + 0.5) / 16 - 0.5, 0, 6.999), by = fy | 0, ty = fy - by;
    for (let px = 0; px < W; px++) {
      const fx = cl((px + 0.5) / 16 - 0.5, 0, 2.999), bx = fx | 0, tx = fx - bx, e0 = by * 4 + bx;
      const en = (env[e0] * (1 - tx) + env[e0 + 1] * tx) * (1 - ty) + (env[e0 + 4] * (1 - tx) + env[e0 + 5] * tx) * ty;
      const et = (envT[e0] * (1 - tx) + envT[e0 + 1] * tx) * (1 - ty) + (envT[e0 + 4] * (1 - tx) + envT[e0 + 5] * tx) * ty;
      const t = cl(T[(j + 2) * TW + px + 2], 0, 1);
      const p = j * SX + px;
      const z = (zeta[p] + zeta[p + 1] + zeta[p + SX] + zeta[p + SX + 1]) * 0.25 / en;
      const uc = UF[j * SX + px] + UF[j * SX + px + 1], vc = VF[j * NX + px] + VF[(j + 1) * NX + px];
      const sh = CFG.sa * tanh((t - Ts[j]) / et) + CFG.sz * tanh(z) + CFG.ss * (tanh(0.5 * sqrt(uc * uc + vc * vc) * isp) - 0.4);
      const si = cl(12 + 12 * sh + 0.5, 0, NS - 1) | 0, ti = (t * (NT - 1) + 0.5) | 0, o = (ti * NS + si) * 3;
      display.setPixel(px, py, lut[o], lut[o + 1], lut[o + 2]);
    }
  }
}
