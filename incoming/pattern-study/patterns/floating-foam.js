// ===== Patternflow pattern =====
// Title:   Floating Foam
// Family:  ocean
// Idea:    Foam on a restless water surface is swept by a flow that converges and spreads as well as turns, so its density piles up into thin bright seams where the surface flow runs together and thins out in dark pools between, and the seams keep tearing, closing and bending along the flow
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Clustering of floaters on a compressible surface flow (Sommerer and Ott, Science 1993; Cressman, Davoudi, Goldburg and Schumacher, New Journal of Physics 2004); a random kinematic flow of lattice Fourier modes with wandering phases, the kind of model Kraichnan began (1968) with a finite correlation time; the density carried in flux form by a second order upwind scheme with the monotonised central limiter (van Leer, 1977)
// Round:   121
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Compression=-1..1
//
// Knob 1: Hue. Turns every colour of the ramp round the grey axis by the knob times 360 degrees; at 0 the foam runs from deep navy through blue and teal to near white.
// Knob 2: Flow. Model seconds per panel second, so the speed in LEDs a second and how fast the seams form and move: the rms speed is 1.8 LEDs per model second, 0.9 at 0.5, 3.6 at the opening 2 and 7.2 at 4. The picture at one model time does not depend on it.
// Knob 3: Scale. The wavelength where the flow has most of its energy, 30 LEDs times 1.4 to the minus the knob: 42 at -1, 30 at 0 and 21 at 1. The seams are 2.8 LEDs wide at half height at -1, 2.4 at 0 and 2.2 at 1 (medians).
// Knob 4: Compression. The share c of the flow's energy in the part that converges and spreads rather than the part that turns, 0.5 plus 0.35 times the knob: 0.15 at -1, 0.52 at the opening and 0.85 at 1. At 0.15 the seams are 3.2 LEDs wide and the density is less spread out (sd of ln(rho + 0.05) 0.73, against 1.00 at the opening and 1.06 at 1); at 0.85 the seams are 2.1 wide.

// What the field is. A torus of 64 by 128 cells, one to an LED, carrying the density rho of floaters, mean 1, in model seconds:
//   rho_t + div(rho u) = D lap rho + (1 - rho) / tau,   D = 0.04 LED^2 per model second, tau = 12
// u = sqrt(1 - c) u_s + sqrt(c) u_p. Each of 185 lattice modes of the torus (half the plane, 0.08 < k < 0.75 rad per LED) has a part u_s = (ky, -kx) / k that turns and a part u_p = (kx, ky) / k that converges
// and spreads, each with its own phase. The energy of a mode goes as exp(-(ln(k / kf) / 0.45)^2 / 2), 2 pi / kf the Scale wavelength, scaled so that the rms speed is 1.8 at every Scale and Compression. A phase turns at 0.2 to 0.9
// of 1.8 k, either way, and that rate wanders (Ornstein-Uhlenbeck, correlation time 4, rms 0.35 of itself), so the phases random-walk and nothing comes round again. Once a frame the modes go through an inverse FFT with a half-cell
// phase shift, which gives the velocity on the faces of the cells (two transforms with the pair packed in one). The density moves in x, y, x sweeps (Strang) of the flux-form scheme in as many substeps as keep a crossing of
// one cell under 0.45, then relaxes and diffuses (floor 1e-4). The picture is ln(rho + 0.05) between its 4th and 99.5th percentile (followed over 4 s) on a six-stop ramp (navy, blue, teal, cyan, ice, white) turned by Hue.
//
// What was checked, with the file's own sweep (scripts of mine, not in the repo):
// - One sinusoidal velocity u = A sin(kx) along x on the 64 cells (A 0.8, k = 2 pi / 64), the x sweep alone at a step of 0.1, against the density the characteristics give (tan(kx/2) = tan(kx0/2) e^(Akt), rho = dx0/dx):
//   at A k t = 0.63, 1.10 and 1.49 the sink cell holds 1.869, 2.988 and 4.412 against 1.872, 2.988 and 4.397, the relative L2 error over the row is 2.3, 4.6 and 7.3 per cent, and the mass stays 1 to twelve places.
// - 900 s at the opening: the mean density is 1 + 1e-12 from 100 s on (1 + 2e-5 after the 40 s before the first frame, which the relaxation takes out), the smallest cell 0.053 (the floor never acts), the largest 34 to 108, sd of
//   ln(rho + 0.05) 0.98 to 1.04 at 20, 100, 300 and 900 s, 9.5 to 11.4 per cent of the cells above 2, and the brightest 2 per cent of the cells hold 25 to 33 per cent of the foam. Nothing drifts.
// - The flow at the opening: the rms speed is 1.80; over the grid the divergence takes 52.1 per cent of div^2 + curl^2 where c is 0.521.
// - Seams, by the full width at half height between the density 1 and the peak, along x and y, 10,213 seams over 120 s: quartiles 1.9, 2.4 and 3.1 LEDs at the opening. Compression -1 and 1: median 3.2 and 2.1. Scale -1 and 1: 2.8 and 2.2.
//   Two cells is about what the scheme can hold.
// - flowcheck, 240 s, six sets (open; all minimum; all maximum; three random): recur 0.73 to 0.82, dim 0.86 to 0.97, quiet 0.70 to 0.92, last quarter dim 0.68 to 0.93 and quiet 0.53 to 0.84, luma -1.7 to +2.4 per cent first to last quarter.
//   900 s (recur, dim, quiet): open 0.741, 0.974, 0.929; all minimum 0.754, 0.927, 0.786; all maximum 0.733, 0.987, 0.964. Measured on this file under its name, which seeds the phases.
// - Cost: 1.3 to 2.1 ms a frame in Node (update and draw), the worst of 300 frames 3.7 ms at the opening and 4.0 at the maximum, the start 0.24 s.
//
// What failed first. On led.png the pools between seams of the first ramp, whose darkest stop was (4, 8, 30), showed nearly off; the ramp now starts at (6, 12, 44).
// What was not checked: a grid finer than 64 by 128 (a seam is two cells wide, so it is the grid that sets it); the correlation dimension of the clusters against the literature; a surface flow taken from a real three-dimensional
// flow. The spectrum, the wave speeds and the correlation time are my choices, and the relaxation at 1 / 12 a second, which makes and removes foam, is the picture's own.

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
