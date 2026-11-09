// ===== Patternflow pattern =====
// Title:   Sea Sparkle
// Family:  microbe
// Idea:    A restless bloom of glowing plankton flashes wherever the water is sheared hardest, so threads of blue light run along the strained seams between the eddies, glints crackle on them, and the glow is carried off, stretched and left fading in curling trails while new threads light behind it.
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Bioluminescence of dinoflagellates such as Noctiluca scintillans, which flash when the water round them is sheared past a threshold (work of Michael Latz, Jim Rohr and co-workers, 1990s, from memory), over forced two-dimensional turbulence solved pseudo-spectrally on a torus (Robert Kraichnan, 1967, from memory), the glow carried by the flux-form scheme of Shear Billows
// Round:   122
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Afterglow=-1..1
//
// Knob 1: Hue. Turns every colour of the water round the grey axis by the knob times 360 degrees; at 0 the sea is deep blue, the threads electric blue and their knots near white.
// Knob 2: Flow. Model seconds per panel second, 0.32 times the knob: 0.16 at 0.5, 0.64 at the opening 2, 1.28 at 4. The water moves at 4.5 LEDs per model second rms, so 2.9 LEDs a second at the opening. The glow is 0.81 correlated with itself half a second on, 0.57 a second on, 0.30 two seconds on and 0.12 four seconds on.
// Knob 3: Scale. The wavelength the water is stirred at, 2 pi over 0.3 times 1.5 to the minus the knob: 14 LEDs at -1, 21 at 0, 31 at 1. The stirring is scaled so that the water keeps the same speed (4.5 LEDs per model second rms at all three), and the strain, which goes with speed over size, falls from 3.0 at -1 to 2.1 and 1.46 per model second.
// Knob 4: Afterglow. How long the light lasts once lit, 1.5 model seconds times 2.4 to the knob: 0.63 at -1, 1.5 at 0, 3.6 at 1, which is 1.0, 2.3 and 5.6 panel seconds at the opening Flow. Short gives bare threads (the glow is over 0.3 on 2.7 per cent of the panel), long gives wide wakes (12.8 per cent; 6.3 at the opening).

// What the field is. A torus of 64 by 128 cells, one to an LED, with the vorticity w (u = (psi_y, -psi_x), w = -lap psi) and a glow c between 0 and 1 that goes with the flow, in model seconds:
//   w_t + u.grad w = -nu k^2 w - nu4 k^4 w - mu w + stir,   nu 0.03, nu4 0.004, mu 0.1
//   c_t + u.grad c = g q (1 - c) - c / tau,   q = max(0, |S| - 1.5 S_rms) / S_rms,  g = 2.6
// |S| = sqrt((u_x - v_y)^2 + (u_y + v_x)^2) is the strain rate, the rate at which the water is deformed without turning, which is what a dinoflagellate answers to: it is nought in the rigid core of a vortex and largest in the seams between eddies. S_rms is its rms over the panel,
// followed with a time constant of ten steps, so that the threshold is the same share of the strain at every Scale. stir is complex Gaussian noise, 0.03 sqrt(dt) a step, on the half plane of modes with 0.12 < k < 1, weighted in log k as a Gaussian of width 0.35
// round the wavenumber of Scale and by k, so that it is the velocity that is forced evenly. The flow is Shu and Osher's third order scheme at a step of 0.05 with the product cut by exp(-36 (k / 1.8)^16); the glow goes with the velocity on the cell faces in x, y, x
// sweeps of the flux-form second order upwind scheme with the monotonised central limiter, as in Shear Billows, in as many substeps as keep a crossing under 0.45. Flashes: a second field f, not carried by the flow, jumps to 0.65 to 1 on a cell with the chance
// 3 c^2 min(2, |S| / S_rms) a second, and goes out in a fifth of a second. The picture is 1.1 c^0.6 + 0.14 tanh(|S| / 2 S_rms) + 0.5 f on a five-stop ramp from (8, 28, 88) to (238, 253, 255). Before the first frame 30 model seconds run, with the light in the last 10.
//
// What was checked, with this file's own functions and scripts of mine, not in the repo:
// - The strain against direct sums over the modes at five points of a developed flow: they agree to 5e-15 (the file adds the cut, and so does the sum).
// - The convective term against direct sums for a smooth field (random modes below k 0.55, no dissipation) at five points: -u.grad w agrees to 2.3e-4 of itself, which is what the cut takes off at k of 1.1.
// - The speed of the water at 10 to 60 s through update(): 4.35 to 4.75 LEDs per model second rms in seven sets of knobs (the opening; all least; all most; Scale and Afterglow at each end).
// - flowcheck, 240 s, six sets (open; all minimum; all maximum; three random): recur 0.67 to 0.79, dim 0.90 to 0.94, quiet 0.76 to 0.91; the last quarter dim 0.81 to 0.89 and quiet 0.50 to 0.78; luma first to last quarter within 2.2 per cent. The opening: recur 0.732, dim 0.899, quiet 0.812.
//   900 s (recur, dim, quiet): open 0.653, 0.934, 0.870; all minimum 0.688, 0.951, 0.868; all maximum 0.625, 0.970, 0.943; the last quarter dim 0.89 to 0.95 and quiet 0.74 to 0.92. Measured on this file under its name, which seeds the stirring and the flashes.
// - Cost: 1.5 to 7.3 ms a frame in Node (update and draw), and a start that runs 30 model seconds before the first frame.
//
// What failed first. 1. The first stirring was round k 0.42 (15 LEDs) with drag 0.25 and a threshold of 1 rms: the glow filled the panel with curls three to five LEDs long and the picture was blue smoke with nothing to hold on to. 2. Stirring at k 0.8 and drag 0.07 made the same smoke dimmer,
// since the energy did not climb to bigger scales in two minutes. 3. A threshold of 2.5 rms lit almost nothing; 1.5 with the stirring at 0.35 gave the long bright strokes this file has. 4. The first palette started at (6, 20, 64) and the mean luma was 29 to 45 (Rec. 709) in the three sets, so a dim panel
// went dimmer; with the gain, ramp and curve here it is 47 to 96. 5. The stirring forced the vorticity evenly, which puts more speed into the big eddies; weighting it by k to force the velocity evenly holds the water at 4.5 LEDs per model second at every Scale. 6. The water first ran at 6.3 LEDs per model second, too quick for a glow to be followed; noise 0.03 brought it to 4.5.
// What was not checked: the flash of a real dinoflagellate is a few tenths of a second long and cells that have flashed are spent for a while, and neither is in this (the glow only decays); the water is two-dimensional, where the sea is not; the threshold in real water is in tens of inverse seconds, and none of this is scaled to it; a finer grid than 64 by 128.

const W = 64, H = 128, N = W * H, WM = W - 1, HM = H - 1;
const { floor, ceil, abs, sqrt, exp, log, cos, sin, tanh, PI, min, max, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];

const CFG = {
  nu: 0.03, // viscosity, LED^2 per model second
  hyp: 0.004, // and the fourth-order one
  fric: 0.1, // drag on every mode
  noise: 0.03, // forcing, vorticity per sqrt(model second)
  dt: 0.05,
  cfl: 0.45,
  pre: 30, // model seconds before the first frame
  thr: 1.5, // strain over its rms at which the light starts
  gain: 2.6,
  spark: 3, // flashes per second of a cell with the glow at 1 and the strain at its rms
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
const KX = new Float64Array(N), KY = new Float64Array(N), K2 = new Float64Array(N), FIL = new Float64Array(N), NS = [];
for (let j = 0; j < H; j++)
  for (let i = 0; i < W; i++) {
    const p = j * W + i, nx = i < W / 2 ? i : i - W, ny = j < H / 2 ? j : j - H;
    KX[p] = (TAU * nx) / W;
    KY[p] = (TAU * ny) / H;
    K2[p] = KX[p] * KX[p] + KY[p] * KY[p];
    FIL[p] = exp(-36 * pow(sqrt(K2[p]) / 1.8, 16));
    const km = sqrt(K2[p]);
    if (km > 0.12 && km < 1.0 && (ny > 0 || (ny === 0 && nx > 0))) NS.push([p, ((H - j) & HM) * W + ((W - i) & WM), km]);
  }
// half-cell shifts that put the velocity on the faces of the foam-style grid, for the dye
const CXH = new Float64Array(N), SXH = new Float64Array(N), CYH = new Float64Array(N), SYH = new Float64Array(N);
for (let p = 0; p < N; p++) (CXH[p] = cos(0.5 * KX[p])), (SXH[p] = sin(0.5 * KX[p])), (CYH[p] = cos(0.5 * KY[p])), (SYH[p] = sin(0.5 * KY[p]));
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
    const d = nu * K2[p] + hy * K2[p] * K2[p] + fr;
    oR[p] = -ar[p] * inv * FIL[p] - d * wr[p];
    oI[p] = -ai[p] * inv * FIL[p] - d * wi[p];
  }
}

// the strain rate, |S| = sqrt((u_x - v_y)^2 + (u_y + v_x)^2) = sqrt((2 psi_xy)^2 + (psi_yy - psi_xx)^2)
function strain(S) {
  const { wr, wi, ar, ai } = S;
  for (let p = 0; p < N; p++) {
    const k2 = K2[p];
    if (k2 === 0) {
      ar[p] = ai[p] = 0;
      continue;
    }
    const sr = wr[p] / k2, si = wi[p] / k2, a = -2 * KX[p] * KY[p], b = KX[p] * KX[p] - KY[p] * KY[p];
    ar[p] = (a * sr - b * si) * FIL[p];
    ai[p] = (a * si + b * sr) * FIL[p];
  }
  fft2(ar, ai, true);
  let e = 0;
  for (let p = 0; p < N; p++) {
    const m = sqrt(ar[p] * ar[p] + ai[p] * ai[p]);
    S.sm[p] = m;
    e += m * m;
  }
  const r = sqrt(e / N);
  S.srms = S.srms ? S.srms + (r - S.srms) * 0.1 : r;
}

function step(S, withLight) {
  const dt = CFG.dt, { wr, wi, k1r, k1i, k2r, k2i, tr, ti, c } = S;
  if (withLight) {
    const um = faces(S), n = max(1, ceil((um * dt) / CFG.cfl)), ds = dt / n;
    for (let i = 0; i < n; i++) {
      sweepX(c, S.U, 0.5 * ds);
      sweepY(c, S.V, ds);
      sweepX(c, S.U, 0.5 * ds);
    }
    // the light: flashes where the strain is past its threshold, fades
    const sc = CFG.thr * S.srms, isr = 1 / max(1e-6, S.srms), g = CFG.gain * dt, f = dt / S.tau;
    for (let p = 0; p < N; p++) {
      const q = max(0, S.sm[p] - sc) * isr;
      c[p] = cl(c[p] + g * q * (1 - c[p]) - f * c[p], 0, 1);
    }
  }
  rhs(S, wr, wi, k1r, k1i);
  for (let p = 0; p < N; p++) (tr[p] = wr[p] + dt * k1r[p]), (ti[p] = wi[p] + dt * k1i[p]);
  rhs(S, tr, ti, k2r, k2i);
  for (let p = 0; p < N; p++) (tr[p] = 0.75 * wr[p] + 0.25 * (tr[p] + dt * k2r[p])), (ti[p] = 0.75 * wi[p] + 0.25 * (ti[p] + dt * k2i[p]));
  rhs(S, tr, ti, k2r, k2i);
  for (let p = 0; p < N; p++) (wr[p] = (wr[p] + 2 * (tr[p] + dt * k2r[p])) / 3), (wi[p] = (wi[p] + 2 * (ti[p] + dt * k2i[p])) / 3);
  const q = CFG.noise * sqrt(dt);
  for (let m = 0; m < NS.length; m++) {
    const gr = q * S.nw[m] * gauss(), gi = q * S.nw[m] * gauss(), p = NS[m][0], pm = NS[m][1];
    wr[p] += gr;
    wi[p] += gi;
    wr[pm] += gr;
    wi[pm] -= gi;
  }
  wr[0] = wi[0] = 0;
  S.time += dt;
}

function setNoise(S, kn) {
  let e = 0;
  for (let m = 0; m < NS.length; m++) {
    const z = log(NS[m][2] / kn) / 0.35;
    S.nw[m] = exp(-0.5 * z * z) * NS[m][2]; // vorticity forcing weighted by k, so the energy goes in at kn
    e += S.nw[m] * S.nw[m];
  }
  const a = sqrt(NS.length / (e || 1)) * (kn / 0.3); // the same velocity forcing at every scale
  for (let m = 0; m < NS.length; m++) S.nw[m] *= a;
}

const knOf = (v) => 0.3 * pow(1.5, -cl(v, -1.2, 1.2));
const tauOf = (v) => 1.5 * pow(2.4, cl(v, -1.2, 1.2));

function start(params, k) {
  const mk = () => new Float64Array(N);
  const S = {
    wr: mk(), wi: mk(), ar: mk(), ai: mk(), br: mk(), bi: mk(), k1r: mk(), k1i: mk(), k2r: mk(), k2i: mk(), tr: mk(), ti: mk(),
    U: mk(), V: mk(), c: mk(), sm: mk(), fl: new Float32Array(N), nw: new Float64Array(NS.length), srms: 0,
    kn: knOf(k[2]), tau: tauOf(k[3]), hue: 0, lutHue: -9, lut: new Uint8Array(256 * 3), acc: 0, time: 0, ready: false,
  };
  params.s = S;
  setNoise(S, S.kn);
  for (let t = 0; t < CFG.pre; t += CFG.dt) {
    if (((t / CFG.dt) | 0) % 4 === 0) strain(S);
    step(S, t > CFG.pre - 10);
  }
  S.ready = true;
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.1, 8);
  S.hue = cl(k[0], 0, 1);
  const f = 1 - exp(-ft / 0.5);
  S.kn += (knOf(k[2]) - S.kn) * f;
  S.tau += (tauOf(k[3]) - S.tau) * f;
  setNoise(S, S.kn);
  S.acc += ft * flow * 0.32;
  let steps = 0;
  while (S.acc >= CFG.dt && steps < 24) {
    if (steps === 0) strain(S);
    step(S, true);
    S.acc -= CFG.dt;
    steps++;
  }
  if (steps === 24) S.acc = min(S.acc, CFG.dt);
  strain(S);
  // the flashes: a cell lights up for an instant, where the glow is and the water is sheared, and goes out in a fifth of a second
  const dec = exp(-ft / 0.2), rate = CFG.spark * ft, isr = 1 / max(1e-6, S.srms), { fl, c, sm } = S;
  for (let p = 0; p < N; p++) {
    let f = fl[p] * dec;
    if (Math.random() < rate * c[p] * c[p] * min(2, sm[p] * isr)) f = 0.65 + 0.35 * Math.random();
    fl[p] = f;
  }
  if (!isFinite(S.wr[1] + S.c[N >> 1])) start(params, k);
}

// ---- colour ----
const STOPS = [
  [0.0, 8, 28, 88],
  [0.25, 12, 62, 164],
  [0.5, 30, 132, 236],
  [0.75, 104, 216, 255],
  [1.0, 238, 253, 255],
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
  const { c, sm, fl, lut } = S, isr = 1 / max(1e-6, S.srms);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const b = cl(1.1 * pow(c[p], 0.6) + 0.14 * tanh(sm[p] * isr * 0.5) + 0.5 * fl[p], 0, 1);
      const o = ((b * 255 + 0.5) | 0) * 3;
      display.setPixel(x, y, lut[o], lut[o + 1], lut[o + 2]);
    }
}
