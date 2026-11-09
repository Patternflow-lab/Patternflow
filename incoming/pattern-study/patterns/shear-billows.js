// ===== Patternflow pattern =====
// Title:   Shear Billows
// Family:  sim
// Idea:    Layers of fluid slide past each other at different speeds, each seam rolls up into a row of curling billows that pair, wind up and smear out, and the layers are pulled straight again so a new row curls up from the wreck
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kelvin-Helmholtz instability of a shear layer (Helmholtz, 1868; Kelvin, 1871) in two dimensions, pseudo-spectral on a torus; the forced shear layer with a relaxed mean profile as in Corcos and Sherman (1984) and Winant and Browand (1974) for the pairing of billows
// Round:   121
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Layers=-1..1
//
// Knob 1: Hue.
// Knob 2: Flow.
// Knob 3: Scale.
// Knob 4: Layers.

const W = 64, H = 128, N = W * H, WM = W - 1, HM = H - 1;
const { floor, ceil, abs, sqrt, exp, log, cos, sin, tanh, PI, min, max, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];

const CFG = {
  u0: 4.0, // speed of a band, LEDs per model second
  wanderS: 0.35, // rms of the slow wandering of a band's speed, as a share of u0
  wanderT: 25, // its correlation time
  dl: 2.2, // half thickness of a seam at Scale 0, LEDs (tanh)
  nu: 0.03, // viscosity, LED^2 per model second
  hyp: 0.004, // and the fourth-order one
  fric: 0.15, // drag on every eddy, not on the mean shear, so that no vortex grows past a seam's row
  relU: 0.3, // the mean shear is pulled back to its profile at this rate
  relC: 0.3, // and so is the dye
  noise: 0.01, // forcing of small eddies, vorticity per sqrt(model second)
  dt: 0.05,
  pre: 30,
  cfl: 0.45,
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
const KX = new Float64Array(N), KY = new Float64Array(N), K2 = new Float64Array(N), FIL = new Float64Array(N), NS = []; // NS: half the plane of the modes that are stirred
for (let j = 0; j < H; j++)
  for (let i = 0; i < W; i++) {
    const p = j * W + i, nx = i < W / 2 ? i : i - W, ny = j < H / 2 ? j : j - H;
    KX[p] = (TAU * nx) / W;
    KY[p] = (TAU * ny) / H;
    K2[p] = KX[p] * KX[p] + KY[p] * KY[p];
    const r = sqrt(K2[p]) / 1.8; // the cut: 1.8 rad per LED, 0.6 of the Nyquist
    FIL[p] = exp(-36 * pow(r, 16));
    const km = sqrt(K2[p]);
    if (nx !== 0 && km > 0.1 && km < 0.5 && (ny > 0 || (ny === 0 && nx > 0))) NS.push([p, ((H - j) & HM) * W + ((W - i) & WM)]);
  }

// half-cell shifts that put the velocity on the faces of the foam-style grid, for the dye
const CXH = new Float64Array(N), SXH = new Float64Array(N), CYH = new Float64Array(N), SYH = new Float64Array(N);
for (let p = 0; p < N; p++) (CXH[p] = cos(0.5 * KX[p])), (SXH[p] = sin(0.5 * KX[p])), (CYH[p] = cos(0.5 * KY[p])), (SYH[p] = sin(0.5 * KY[p]));
// the table of e^(-i ky y) over a column, for the spectrum of a profile
const TC = new Float64Array(H * H), TS = new Float64Array(H * H);
for (let j = 0; j < H; j++) for (let y = 0; y < H; y++) (TC[j * H + y] = cos((TAU * (j < H / 2 ? j : j - H) * y) / H)), (TS[j * H + y] = -sin((TAU * (j < H / 2 ? j : j - H) * y) / H));

// ---- the layers: n bands, each with a speed and a dye value, seams of half thickness dl ----
const step1 = (z) => 0.5 * (1 + tanh(z));
function profiles(S) {
  const { n, dl, Ub, Cb, u0, c0 } = S, Lb = H / n;
  for (let y = 0; y < H; y++) {
    let u = 0, c = 0;
    for (let b = 0; b < n; b++) {
      const yy = ((((y - b * Lb + 0.5 * H) % H) + H) % H) - 0.5 * H, chi = step1(yy / dl) * step1((Lb - yy) / dl);
      u += Ub[b] * chi;
      c += Cb[b] * chi;
    }
    u0[y] = u;
    c0[y] = c;
  }
  let m = 0;
  for (let y = 0; y < H; y++) m += u0[y] / H;
  for (let y = 0; y < H; y++) u0[y] -= m;
  // spectrum of the target mean vorticity, -d u0 / dy, on the kx = 0 column
  for (let j = 0; j < H; j++) {
    let ar = 0, ai = 0;
    for (let y = 0; y < H; y++) (ar += u0[y] * TC[j * H + y]), (ai += u0[y] * TS[j * H + y]);
    ar /= H;
    ai /= H;
    const ky = KY[j * W]; // -i ky (ar + i ai) = ky ai - i ky ar
    S.w0r[j] = ky * ai;
    S.w0i[j] = -ky * ar;
  }
}
function setBands(S, n) {
  S.n = n;
  S.Ub = new Float64Array(n);
  S.wb = new Float64Array(n);
  S.Cb = new Float64Array(n);
  for (let b = 0; b < n; b++) {
    S.Cb[b] = b % 2 ? -0.8 : 0.8;
    S.wb[b] = gauss() * CFG.wanderS;
  }
  if (n % 2) S.Cb[n - 1] = 0;
}
function wander(S, mt) {
  const d = exp(-mt / CFG.wanderT), q = sqrt(1 - d * d);
  for (let b = 0; b < S.n; b++) {
    S.wb[b] = S.wb[b] * d + CFG.wanderS * q * gauss();
    S.Ub[b] = CFG.u0 * ((b % 2 ? -0.8 : 0.8) + S.wb[b]);
  }
}

// ---- the flow ----
function rhs(S, wr, wi, oR, oI) {
  const { ar, ai, br, bi } = S;
  for (let p = 0; p < N; p++) {
    const k2 = K2[p];
    if (k2 === 0) {
      ar[p] = ai[p] = 0;
    } else {
      const sr = wr[p] / k2, si = wi[p] / k2;
      ar[p] = KX[p] * sr - KY[p] * si;
      ai[p] = KY[p] * sr + KX[p] * si;
    }
    br[p] = -KX[p] * wi[p] - KY[p] * wr[p];
    bi[p] = KX[p] * wr[p] - KY[p] * wi[p];
  }
  fft2(ar, ai, true);
  fft2(br, bi, true);
  for (let p = 0; p < N; p++) {
    ar[p] = ar[p] * br[p] + ai[p] * bi[p];
    ai[p] = 0;
  }
  fft2(ar, ai, false);
  const inv = 1 / N, nu = CFG.nu, hy = CFG.hyp, fr = CFG.fric;
  for (let p = 0; p < N; p++) {
    const d = nu * K2[p] + hy * K2[p] * K2[p] + ((p & WM) === 0 ? 0 : fr);
    oR[p] = -ar[p] * inv * FIL[p] - d * wr[p];
    oI[p] = -ai[p] * inv * FIL[p] - d * wi[p];
  }
}
function faces(S) {
  const { wr, wi, ar, ai, U, V } = S;
  for (let p = 0; p < N; p++) {
    const k2 = K2[p];
    if (k2 === 0) {
      ar[p] = ai[p] = 0;
      continue;
    }
    const sr = wr[p] / k2, si = wi[p] / k2;
    const ur = -KY[p] * si, ui = KY[p] * sr, vr = KX[p] * si, vi = -KX[p] * sr;
    const Ar = ur * CXH[p] - ui * SXH[p], Ai = ur * SXH[p] + ui * CXH[p];
    const Br = vr * CYH[p] - vi * SYH[p], Bi = vr * SYH[p] + vi * CYH[p];
    ar[p] = Ar - Bi;
    ai[p] = Ai + Br;
  }
  fft2(ar, ai, true);
  let mx = 0.5;
  for (let p = 0; p < N; p++) {
    U[p] = ar[p];
    V[p] = ai[p];
    const a = abs(ar[p]), b = abs(ai[p]);
    if (a > mx) mx = a;
    if (b > mx) mx = b;
  }
  return mx;
}

// ---- the dye: flux form, second order upwind with the monotonised central limiter ----
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

function step(S) {
  const dt = CFG.dt, { wr, wi, k1r, k1i, k2r, k2i, tr, ti, c } = S;
  // the dye goes with the velocity at the start of the step
  const um = faces(S), n = max(1, ceil((um * dt) / CFG.cfl)), ds = dt / n;
  for (let i = 0; i < n; i++) {
    sweepX(c, S.U, 0.5 * ds);
    sweepY(c, S.V, ds);
    sweepX(c, S.U, 0.5 * ds);
  }
  // Shu and Osher's third order scheme
  rhs(S, wr, wi, k1r, k1i);
  for (let p = 0; p < N; p++) (tr[p] = wr[p] + dt * k1r[p]), (ti[p] = wi[p] + dt * k1i[p]);
  rhs(S, tr, ti, k2r, k2i);
  for (let p = 0; p < N; p++) (tr[p] = 0.75 * wr[p] + 0.25 * (tr[p] + dt * k2r[p])), (ti[p] = 0.75 * wi[p] + 0.25 * (ti[p] + dt * k2i[p]));
  rhs(S, tr, ti, k2r, k2i);
  for (let p = 0; p < N; p++) (wr[p] = (wr[p] + 2 * (tr[p] + dt * k2r[p])) / 3), (wi[p] = (wi[p] + 2 * (ti[p] + dt * k2i[p])) / 3);
  // the mean shear back to its profile, small eddies stirred
  const a = CFG.relU * dt;
  for (let j = 0; j < H; j++) {
    const p = j * W;
    wr[p] += a * (S.w0r[j] - wr[p]);
    wi[p] += a * (S.w0i[j] - wi[p]);
  }
  const q = CFG.noise * sqrt(dt);
  for (let m = 0; m < NS.length; m++) {
    const [p, pm] = NS[m], gr = q * gauss(), gi = q * gauss();
    wr[p] += gr;
    wi[p] += gi;
    wr[pm] += gr;
    wi[pm] -= gi;
  }
  wr[0] = wi[0] = 0;
  // dye: the mean of each row back to its profile, a little diffusion
  const rc = CFG.relC * dt, dd = 0.02 * dt;
  for (let j = 0; j < H; j++) {
    let m = 0;
    const o = j * W;
    for (let i = 0; i < W; i++) m += c[o + i];
    const sh = rc * (S.c0[j] - m / W);
    for (let i = 0; i < W; i++) c[o + i] += sh;
  }
  const t = S.t2;
  for (let j = 0; j < H; j++) {
    const o = j * W, u = ((j - 1) & HM) * W, w = ((j + 1) & HM) * W;
    for (let i = 0; i < W; i++) {
      const p = o + i;
      t[p] = c[p] + dd * (c[o + ((i - 1) & WM)] + c[o + ((i + 1) & WM)] + c[u + i] + c[w + i] - 4 * c[p]);
    }
  }
  c.set(t);
  S.time += dt;
}

function start(params, k) {
  const mk = () => new Float64Array(N);
  const S = {
    wr: mk(), wi: mk(), ar: mk(), ai: mk(), br: mk(), bi: mk(), k1r: mk(), k1i: mk(), k2r: mk(), k2i: mk(), tr: mk(), ti: mk(),
    U: mk(), V: mk(), c: mk(), t2: mk(), om: new Float32Array(N), os: 0,
    u0: new Float64Array(H), c0: new Float64Array(H), w0r: new Float64Array(H), w0i: new Float64Array(H),
    n: 0, dl: dlOf(k[2]), hue: 0, lutHue: -9, lut: new Uint8Array(256 * 3), acc: 0, time: 0, ready: false,
  };
  params.s = S;
  setBands(S, nOf(k[3]));
  wander(S, 1000);
  profiles(S);
  // start from the profile with the seams already wavy
  for (let j = 0; j < H; j++) {
    const o = j * W;
    for (let i = 0; i < W; i++) {
      let d = 0;
      for (let m = 2; m <= 4; m++) d += 1.6 * sin((TAU * m * i) / W + 2.1 * m * m);
      const y = ((((j + d) % H) + H) % H);
      const y0 = floor(y), f = y - y0;
      S.c[o + i] = S.c0[y0] * (1 - f) + S.c0[(y0 + 1) & HM] * f;
    }
  }
  for (let j = 0; j < H; j++) (S.wr[j * W] = S.w0r[j]), (S.wi[j * W] = S.w0i[j]);
  for (let t = 0; t < CFG.pre; t += CFG.dt) {
    if (((t / CFG.dt) | 0) % 10 === 0) (wander(S, 0.5), profiles(S));
    step(S);
  }
  S.ready = true;
}
const dlOf = (v) => CFG.dl * pow(1.35, cl(v, -1.2, 1.2));
const nOf = (v) => cl(floor(4.6 + 1.5 * cl(v, -1.2, 1.2)), 3, 6);

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.1, 8);
  S.hue = cl(k[0], 0, 1);
  S.dl += (dlOf(k[2]) - S.dl) * (1 - exp(-ft / 0.5));
  const nt = nOf(k[3]);
  if (nt !== S.n) {
    const old = S.n;
    setBands(S, nt);
    wander(S, 1000);
    if (old) S.acc += 0;
  }
  S.acc += ft * flow;
  let steps = 0;
  while (S.acc >= CFG.dt && steps < 24) {
    if (steps === 0) (wander(S, S.acc), profiles(S));
    step(S);
    S.acc -= CFG.dt;
    steps++;
  }
  if (steps === 24) S.acc = min(S.acc, CFG.dt);
  // the vorticity, for the light and shade
  S.ar.set(S.wr);
  S.ai.set(S.wi);
  fft2(S.ar, S.ai, true);
  let e = 0;
  for (let p = 0; p < N; p++) e += S.ar[p] * S.ar[p];
  S.os = S.os ? S.os + (sqrt(e / N) - S.os) * 0.05 : sqrt(e / N);
  for (let p = 0; p < N; p++) S.om[p] = S.ar[p];
  const chk = S.wr[1] + S.c[N >> 1];
  if (!isFinite(chk)) start(params, k);
}

// ---- colour ----
const STOPS = [
  [0.0, 60, 40, 146],
  [0.22, 116, 58, 160],
  [0.45, 196, 70, 130],
  [0.68, 250, 135, 120],
  [0.85, 255, 200, 140],
  [1.0, 255, 244, 200],
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
  const { c, lut } = S, il = 1 / max(1e-6, S.os);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const o = ((cl((c[p] + 0.24 * tanh(S.om[p] * il) + 1.1) / 2.2, 0, 1) * 255 + 0.5) | 0) * 3;
      display.setPixel(x, y, lut[o], lut[o + 1], lut[o + 2]);
    }
}
