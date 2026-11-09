// ===== Patternflow pattern =====
// Title:   Floating Foam
// Family:  ocean
// Idea:    Foam on a restless water surface is swept by a flow that also converges and spreads, so its density piles into thin bright seams where the surface flow runs together and thins out in the dark pools between, and the seams keep tearing, closing and bending along the flow
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Lagrangian clustering of floaters on a compressible surface flow (Sommerer and Ott, Nature 1993; Cressman, Davoudi, Goldburg and Schumacher, New Journal of Physics 2004; Schumacher and Eckhardt, Europhysics Letters 2002); the flow is a random field of Fourier modes in the style of Kraichnan, and the density is carried in flux form by a MUSCL scheme with the monotonised central limiter (van Leer, 1977)
// Round:   121
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Compression=-1..1
//
// Knob 1: Hue. Turns every colour of the ramp round the grey axis by the knob times 360 degrees; at 0 the foam runs from deep navy through blue and teal to near white.
// Knob 2: Flow. Model seconds per panel second, so the speed in LEDs a second and how fast the seams form and move; the shape of the picture at one model time does not change.
// Knob 3: Scale. The wavelength where the flow has most of its energy, 30 LEDs at 0 and 1.4 to the minus the knob times that: seams a hand's width apart at 1, a pool wide at -1.
// Knob 4: Compression. The share of the flow's energy in the part that converges and spreads rather than the part that turns: 0.15 at -1, 0.5 at the opening, 0.85 at 1; at 0.15 the seams are soft and wide.

const W = 64, H = 128, N = W * H, WM = W - 1, HM = H - 1;
const { floor, ceil, abs, sqrt, exp, log, cos, sin, PI, min, max, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];

const CFG = {
  urms: 1.8, // rms speed of the flow, LEDs per model second
  lam0: 30, // wavelength of the energy peak at Scale 0, LEDs
  sig: 0.45, // width of the energy bump in ln k
  tau: 12, // the foam relaxes to its mean density over this many model seconds
  dif: 0.04, // diffusivity, LED^2 per model second
  ouT: 4, // correlation time of the wandering of each mode's frequency, model seconds
  ouS: 0.35, // its rms as a share of the mode's own frequency
  smin: 0.2, // a mode's wave speed is between smin and smax times the rms speed, either way
  smax: 0.9,
  pre: 40, // model seconds before the first frame
  cfl: 0.45,
  eps: 0.05, // density floor under the logarithm that is drawn
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

// ---- the flow: lattice modes of the torus, half of the plane, each with a solenoidal and a compressive part ----
function makeModes() {
  const M = { n: 0, ix: [], iy: [], kx: [], ky: [], km: [] };
  for (let ny = 0; ny < H / 2; ny++)
    for (let nx = -W / 2; nx < W / 2; nx++) {
      if (ny === 0 && nx <= 0) continue;
      const kx = (TAU * nx) / W, ky = (TAU * ny) / H, km = sqrt(kx * kx + ky * ky);
      if (km < 0.08 || km > 0.75) continue;
      M.ix.push(nx & WM), M.iy.push(ny), M.kx.push(kx), M.ky.push(ky), M.km.push(km);
    }
  const n = (M.n = M.ix.length);
  for (const key of ["kx", "ky", "km"]) M[key] = Float64Array.from(M[key]);
  M.ix = Int32Array.from(M.ix);
  M.iy = Int32Array.from(M.iy);
  M.phS = new Float64Array(n);
  M.phP = new Float64Array(n);
  M.wS = new Float64Array(n);
  M.wP = new Float64Array(n);
  M.eS = new Float64Array(n);
  M.eP = new Float64Array(n);
  M.wt = new Float64Array(n);
  for (let m = 0; m < n; m++) {
    M.phS[m] = TAU * Math.random();
    M.phP[m] = TAU * Math.random();
    const sp = (CFG.smin + (CFG.smax - CFG.smin) * Math.random()) * CFG.urms * M.km[m];
    M.wS[m] = (Math.random() < 0.5 ? -1 : 1) * sp;
    const sq = (CFG.smin + (CFG.smax - CFG.smin) * Math.random()) * CFG.urms * M.km[m];
    M.wP[m] = (Math.random() < 0.5 ? -1 : 1) * sq;
  }
  return M;
}

function setBand(M, kf) {
  let sum = 0;
  for (let m = 0; m < M.n; m++) {
    const z = log(M.km[m] / kf) / CFG.sig;
    sum += M.wt[m] = exp(-0.5 * z * z);
  }
  const a = sqrt((2 * CFG.urms * CFG.urms) / sum);
  for (let m = 0; m < M.n; m++) M.wt[m] = a * sqrt(M.wt[m]);
}

function wander(M, mt) {
  const d = exp(-mt / CFG.ouT), q = sqrt(1 - d * d);
  for (let m = 0; m < M.n; m++) {
    const sa = CFG.ouS * abs(M.wS[m]), sb = CFG.ouS * abs(M.wP[m]);
    M.eS[m] = M.eS[m] * d + sa * q * gauss();
    M.eP[m] = M.eP[m] * d + sb * q * gauss();
    M.phS[m] += (M.wS[m] + M.eS[m]) * mt;
    M.phP[m] += (M.wP[m] + M.eP[m]) * mt;
  }
}

// the velocity on the faces: U[j * W + i] between cell i and i + 1 of row j, V[j * W + i] between row j and j + 1 of column i
function synth(S) {
  const { M, re, im, U, V } = S, as = sqrt(1 - S.c), ap = sqrt(S.c);
  for (let pass = 0; pass < 2; pass++) {
    re.fill(0);
    im.fill(0);
    for (let m = 0; m < M.n; m++) {
      const a = M.wt[m], km = M.km[m], kx = M.kx[m], ky = M.ky[m];
      const sr = a * as * cos(M.phS[m]), si = a * as * sin(M.phS[m]);
      const pr = a * ap * cos(M.phP[m]), pi = a * ap * sin(M.phP[m]);
      // x component (ky s + kx p) / km, y component (-kx s + ky p) / km
      let vr, vi, hs;
      if (pass === 0) {
        vr = (sr * ky + pr * kx) / km;
        vi = (si * ky + pi * kx) / km;
        hs = 0.5 * kx;
      } else {
        vr = (-sr * kx + pr * ky) / km;
        vi = (-si * kx + pi * ky) / km;
        hs = 0.5 * ky;
      }
      const cs = cos(hs), sn = sin(hs), o = M.iy[m] * W + M.ix[m];
      re[o] = vr * cs - vi * sn;
      im[o] = vr * sn + vi * cs;
    }
    fft2(re, im, true);
    const T = pass === 0 ? U : V;
    let mx = S.umax;
    for (let p = 0; p < N; p++) {
      T[p] = re[p];
      const v = abs(re[p]);
      if (v > mx) mx = v;
    }
    S.umax = mx;
  }
}

// ---- the foam: density carried in flux form, second order upwind with the monotonised central limiter ----
const SL = new Float64Array(max(W, H) + 2), FX = new Float64Array(max(W, H) + 2);
const mc = (a, b) => {
  if (a * b <= 0) return 0;
  const s = a > 0 ? 1 : -1, x = abs(a), y = abs(b), z = 0.5 * (x + y);
  return s * min(2 * x, 2 * y, z);
};
function sweepX(R, U, dt) {
  for (let j = 0; j < H; j++) {
    const o = j * W;
    for (let i = 0; i < W; i++) SL[i] = mc(R[o + i] - R[o + ((i - 1) & WM)], R[o + ((i + 1) & WM)] - R[o + i]);
    for (let i = 0; i < W; i++) {
      const u = U[o + i], ip = (i + 1) & WM, nu = u * dt;
      FX[i] = u > 0 ? u * (R[o + i] + 0.5 * (1 - nu) * SL[i]) : u * (R[o + ip] - 0.5 * (1 + nu) * SL[ip]);
    }
    for (let i = 0; i < W; i++) R[o + i] -= dt * (FX[i] - FX[(i - 1) & WM]);
  }
}
function sweepY(R, V, dt) {
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < H; j++) SL[j] = mc(R[j * W + i] - R[((j - 1) & HM) * W + i], R[((j + 1) & HM) * W + i] - R[j * W + i]);
    for (let j = 0; j < H; j++) {
      const v = V[j * W + i], jp = (j + 1) & HM, nu = v * dt;
      FX[j] = v > 0 ? v * (R[j * W + i] + 0.5 * (1 - nu) * SL[j]) : v * (R[jp * W + i] - 0.5 * (1 + nu) * SL[jp]);
    }
    for (let j = 0; j < H; j++) R[j * W + i] -= dt * (FX[j] - FX[(j - 1) & HM]);
  }
}
function relax(S, dt) {
  const { R, T } = S, d = CFG.dif * dt, g = dt / CFG.tau;
  for (let j = 0; j < H; j++) {
    const o = j * W, u = ((j - 1) & HM) * W, w = ((j + 1) & HM) * W;
    for (let i = 0; i < W; i++) {
      const p = o + i, l = o + ((i - 1) & WM), r = o + ((i + 1) & WM);
      T[p] = R[p] + d * (R[l] + R[r] + R[u + i] + R[w + i] - 4 * R[p]) + g * (1 - R[p]);
    }
  }
  for (let p = 0; p < N; p++) R[p] = T[p] < 1e-4 ? 1e-4 : T[p];
}
function step(S, dt) {
  sweepX(S.R, S.U, 0.5 * dt);
  sweepY(S.R, S.V, dt);
  sweepX(S.R, S.U, 0.5 * dt);
  relax(S, dt);
}

function advance(S, mt) {
  wander(S.M, mt);
  S.umax = 0.5;
  synth(S);
  const n = max(1, ceil((S.umax * mt) / CFG.cfl)), dt = mt / n;
  for (let i = 0; i < n; i++) step(S, dt);
}

function start(params, k) {
  const S = {
    M: makeModes(),
    re: new Float64Array(N),
    im: new Float64Array(N),
    U: new Float64Array(N),
    V: new Float64Array(N),
    R: new Float64Array(N),
    T: new Float64Array(N),
    Q: new Float32Array(N >> 2),
    umax: 1,
    kf: 0,
    c: 0.5,
    hue: 0,
    lutHue: -9,
    lut: new Uint8Array(256 * 3),
    lo: 0,
    hi: 1,
    ready: false,
  };
  params.s = S;
  S.R.fill(1);
  for (let p = 0; p < N; p++) S.R[p] = 1 + 0.2 * (Math.random() - 0.5);
  S.kf = kfOf(k[2]);
  S.c = cOf(k[3]);
  setBand(S.M, S.kf);
  for (let t = 0; t < CFG.pre; t += 0.5) advance(S, 0.5);
  quant(S, true);
  S.ready = true;
}
const kfOf = (v) => TAU / (CFG.lam0 * pow(1.4, -cl(v, -1.2, 1.2)));
const cOf = (v) => cl(0.5 + 0.35 * cl(v, -1.2, 1.2), 0.1, 0.9);

// 4th and 99.5th percentile of ln(R + eps), from every fourth cell, followed slowly
function quant(S, first) {
  const { R, Q } = S;
  for (let p = 0, q = 0; p < N; p += 4, q++) Q[q] = log(R[p] + CFG.eps);
  Q.sort();
  const lo = Q[floor(Q.length * 0.04)], hi = Q[floor(Q.length * 0.995)];
  if (first) (S.lo = lo), (S.hi = hi);
  return [lo, hi];
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.1, 8);
  S.hue = cl(k[0], 0, 1);
  const f = 1 - exp(-ft / 0.5);
  S.kf += (kfOf(k[2]) - S.kf) * f;
  S.c += (cOf(k[3]) - S.c) * f;
  setBand(S.M, S.kf);
  advance(S, ft * flow);
  if (!isFinite(S.R[0] + S.R[N >> 1] + S.R[N - 1])) return start(params, k);
  const [lo, hi] = quant(S, false), g = 1 - exp(-ft / 4);
  S.lo += (lo - S.lo) * g;
  S.hi += (hi - S.hi) * g;
}

// ---- colour ----
const STOPS = [
  [0.0, 6, 12, 44],
  [0.22, 10, 38, 112],
  [0.48, 14, 92, 168],
  [0.7, 40, 188, 204],
  [0.88, 190, 245, 236],
  [1.0, 255, 255, 250],
];
function buildLut(S, hue) {
  const a = hue * TAU, c = cos(a), s = sin(a), k1 = (1 - c) / 3, k2 = sqrt(1 / 3) * s;
  const m = [c + k1, k1 - k2, k1 + k2, k1 + k2, c + k1, k1 - k2, k1 - k2, k1 + k2, c + k1];
  for (let i = 0; i < 256; i++) {
    const b = i / 255;
    let j = 0;
    while (j < STOPS.length - 2 && b > STOPS[j + 1][0]) j++;
    const A = STOPS[j], B = STOPS[j + 1], t = cl((b - A[0]) / (B[0] - A[0]), 0, 1);
    const r = A[1] + (B[1] - A[1]) * t, g = A[2] + (B[2] - A[2]) * t, bl = A[3] + (B[3] - A[3]) * t;
    S.lut[i * 3] = cl(m[0] * r + m[1] * g + m[2] * bl, 0, 255);
    S.lut[i * 3 + 1] = cl(m[3] * r + m[4] * g + m[5] * bl, 0, 255);
    S.lut[i * 3 + 2] = cl(m[6] * r + m[7] * g + m[8] * bl, 0, 255);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.lutHue !== S.hue) (S.lutHue = S.hue), buildLut(S, S.hue);
  const { R, lut } = S, il = 1 / max(1e-6, S.hi - S.lo);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const b = cl((log(R[p] + CFG.eps) - S.lo) * il, 0, 1), o = ((b * 255 + 0.5) | 0) * 3;
      display.setPixel(x, y, lut[o], lut[o + 1], lut[o + 2]);
    }
}
