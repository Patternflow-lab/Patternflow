// ===== Patternflow pattern =====
// Title:   Surface Quasigeostrophic
// Family:  noise
// Idea:    Buoyancy theta on the panel's own 64 by 128 torus is carried by the flow it makes itself, psi_hat = -theta_hat / |k|, so its contours pile into steep fronts that curl into spirals, while a weak random stirring at one scale and a drag at the largest keep it going with no period and a gentle wind carries it across, in deep blue, azure and mint with the steepest fronts lit pale.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: surface quasi-geostrophic (SQG) flow: the equation of Blumen (1978) for the buoyancy on the boundary of a flow of uniform potential vorticity, its fronts and turbulence studied by Held, Pierrehumbert, Garner and Swanson (J. Fluid Mech., 1995), the family psi_hat = -theta_hat / |k|^alpha of Pierrehumbert, Held and Swanson (1994), all from memory; solved with Fourier modes and the two-thirds rule of Orszag (1971, from memory) and an integrating-factor form of the three-stage SSP Runge-Kutta scheme of Shu and Osher (1988, from memory)
// Round:   115
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.6..3, Scale=-1..1, Alpha=1..2
//
// Knob 1: Hue. Adds its value to the hue of every stop of the ramp, so one full turn comes back. At 0 theta runs from deep blue (hue 0.68, value 0.30) through azure and cyan to pale green (0.32, saturation 0.25), and the steepest fronts go paler and brighter. At 0.25 the ramp is rose (0.93) to magenta to violet to pale azure, at 0.5 olive (0.18) to orange to red to pale magenta, at 0.75 spring green to lime to pale orange. Hues from red to yellow-green are lifted to a value of at least 0.48 and lose 45 percent of their saturation, so the dark end does not go brown. No LED has a brightest channel under 63 at any hue.
// Knob 2: Flow. The time scale of everything. Each frame sets the model time per second so that the rms speed of the water is 2.5 LEDs a second per unit of Flow: 1.5 at 0.6, 5 at the opening 2 (median 3.9, the fastest 1 percent above 11.7) and 7.5 at 3, whatever the other knobs say. A mean wind of 1.75 LEDs a second per unit of Flow carries the whole field along, 3.5 at the opening, a crossing of the 64 LED width in 18 s. Its heading is 0.3 radians plus two slow swings of 0.9 and 0.55 radians (periods of 459 s and 1065 s at Flow 2). The stirring rides the wind too, so the wind moves things and changes nothing else.
// Knob 3: Scale. The wavelength the stirring works at: kappa_f = 3.6 / 1.55 to the Scale, in units of 2 pi / 64 LEDs, a wavelength of 11.5 LEDs at -1, 17.8 at 0 and 27.6 at 1. The drag below half of kappa_f follows it. Along a 64 LED line theta changes sign 9.3 times at -1, 7.7 at 0 and 5.9 at 1, and the mean |grad theta| over the rms of theta is 0.45, 0.36 and 0.30 per LED. At -1 the panel holds many small mint plateaus, at 1 fewer and wider ones with long thin arms between them.
// Knob 4: Alpha. The exponent of the kernel, psi_hat = -theta_hat / |k|^alpha, scaled so theta and speed agree at kappa 6. At 1 it is SQG. At 2 it is two-dimensional Euler flow with theta as the vorticity, where the velocity is smoother: the rms of theta over the rms speed is 1.0 at 1, 0.68 at 1.5 and 0.42 at 2, and theta changes sign along a 64 LED line 7.5, 8.8 and 9.9 times. The picture keeps its fronts (mean |grad theta| 0.42 against 0.35 at 1) and shows more round vortices with dark cores.

const W = 64, H = 128, N = W * H;
const { floor, ceil, max, abs, sqrt, exp, log, pow, sin, cos, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// What the field is. A scalar theta, the buoyancy on the surface of a stratified fluid or the
// temperature of the sea surface, lives on a torus 64 LEDs wide and 128 tall and obeys
//   d theta / dt + u . grad theta = F - D theta,   u = (-psi_y, psi_x),   psi_hat = -theta_hat / |k|.
// The flow u is made by theta itself through the kernel 1 / |k|, which reaches far, where the
// 1 / |k|^2 of two-dimensional Euler flow does not. That one change is why theta piles into
// fronts. F is a weak random stirring in a band of wavenumbers, D a drag on the largest scales
// and a hyperviscosity at the smallest. Nothing else draws the picture: no target, no noise
// layer, no pattern. Drag and hyperviscosity scale with the rms speed of the
// moment. The stirring does not, so the rms of theta settles where stirring and drag balance, and
// the picture keeps its shape at every Flow and Alpha.
//
// Checks, each run on this file:
// 1. With forcing, drag, hyperviscosity and wind off, over 2 model time units, sum |theta_hat|^2
//    changed by -1.4e-6 in 49 steps and -3.8e-7 in 79 steps, and the energy sum |theta_hat|^2 / |k|
//    by -1.6e-7 and -3.9e-8. Both are conserved by the truncated equations, so what is left is the
//    time stepping.
// 2. Halving the step on a run with drag, hyperviscosity and wind: the error against a run at
//    one eighth of the step was 4.8e-6, 5.9e-7 and 6.5e-8 for 39, 78 and 156 steps, as the rms
//    of the difference in theta_hat over the rms of theta_hat. The ratios 8.1 and 9.0 are third order.
// 3. div u = 0 is exact: u and v both come from psi_hat with i ky and -i kx, so i kx u_hat +
//    i ky v_hat vanishes mode by mode, and transforming u and v back gives a residual of 6e-15
//    relative to |kx u_hat|. A central difference on the panel grid does not see that: it gives
//    a divergence of 5.9e-2 of the rms of |grad u|, 8.3e-3 with only the modes below kappa 8,
//    2.3e-3 below 4 and 5.5e-4 below 2. It falls with the square of the wavenumber, as the
//    stencil's truncation error does, so what it measures is the stencil.
// 4. The spectrum of theta, shell sums of |theta_hat|^2 averaged over 300 s of panel time, falls
//    as kappa^-2.0 between kappa 10 and 20 at Scale 0 (-2.2 between 8 and 18) and -2.0 between 10
//    and 20 at Scale 1 (-2.2 between 5 and 14, -2.0 between 6 and 16). The theory of the
//    forward cascade asks for -5/3. The measured slope is steeper, which is what a field of
//    fronts gives (a step has -2), and the range is a factor of 2 in kappa wide: the retained
//    modes end at kappa 21.
// Not checked: a run at half the resolution.
//
// What a front is here. The steepest fronts of the field, 15 per frame over 12 frames, rise from
// 10 to 90 percent of their jump in 4.25 LEDs (median; 2 at the 10th percentile, 5.5 at the 90th),
// a jump of 3.8 rms of theta at a peak slope of 1.25 rms per LED. On the panel the same fronts go
// from 10 to 90 percent of their brightness in 1.75 LEDs (1.25 and 5), because the tone curve
// below is steep where theta crosses its middle.

// ---- the grid -------------------------------------------------------------------------------
// The box is 64 LEDs wide and 128 tall, one grid step an LED either way. A mode (m, n) has
// kx = K0 m and ky = K0 n / 2 with K0 = 2 pi / 64, so kappa^2 = m^2 + (n / 2)^2 measures both
// axes in the same unit. Modes with kappa above KC = 21 are dropped after every product. For a
// quadratic term that is exact: two retained modes make at most |m| = 42 and |n| = 84, which
// alias to |m| >= 22 or |n| >= 44, outside the retained disc.
const K0 = TAU / W, KC = 21, KMAX = K0 * KC;

// The tunables. Model time is the time of the equations above, in units where theta is a speed
// in LEDs per model time. Every rate marked "urs" is multiplied by the rms speed of the moment
// times K0, so the picture does not depend on how loud the stirring has made the field. The
// rms of theta settles near 1.3 and the stirring is 0.015 of it per model time unit.
const CFG = {
  kf0: 3.6, // wavenumber the stirring works at, Scale 0; Scale divides it by 1.55 per unit
  kref: 6, // wavenumber where the kernel is normalised, so theta and speed agree there for every Alpha
  nuc: 3, // hyperviscous rate at kappa = KC, urs, of order 2 up = 16
  up: 8,
  sigma: 0.015, // rms of the stirring F over all its modes, theta units per model time
  tauf: 20, // correlation time of F, model time
  band: 0.25, // width of the stirred band over kf
  mu: 0.01, // drag rate, urs times kf, on kappa below kd * kf
  kd: 0.5,
  speed: 2.5, // LEDs a second of rms speed per unit of Flow
  wind: 1.75, // mean wind, LEDs a second per unit of Flow
  al0: 0.3, // its heading, radians, before the two swings
  kb: 10, // centre of the band of wavenumbers added back to sharpen the picture
  beta: 0.15, // and how much of it, in value, per rms of the band
  tone: 0.45, // the tone curve: theta over its rms, divided by this, then x / sqrt(1 + x^2)
  gam: 1.3, // power on the result, so the middle of the ramp is darker
  fv: 0.55, // value added on a front
  f0: 0.8, // a front starts where |grad theta| is this multiple of its mean
  f1: 3.5, // and is complete at this one
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
const kfOf = (s) => CFG.kf0 * pow(1.55, -cl(s, -1, 1));

// First frame: a random-phase field (the stirred band at unit amplitude over a red tail) is run
// for 20 model time units, at most 400 steps, so that the fronts stand when the picture starts.
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
  advance(S, 20, 400);
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

// A random-phase field: the stirred band at unit amplitude and a red tail below it.
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
// psi_hat = -G theta_hat, G = (kappa / kref)^(1 - alpha) / (K0 kappa), so u_hat + i v_hat =
// G (kx + i ky) theta_hat. Because u and v are real, they come out of one complex transform, and
// theta_x and theta_y out of another. The product u theta_x + v theta_y goes back through a third.
// S.umax and S.urms are read off the field on the way.
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
  // The stirring: an Ornstein-Uhlenbeck process in each mode of the band, carried by the wind.
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
// times the step stays under 1.1, where the scheme's limit is 1.73. With a cap on the number of
// steps the run stops when the cap is reached, short of Ht.
function advance(S, Ht, cap) {
  if (!cap) {
    const n = max(1, ceil((Ht * S.umax * KMAX) / 1.1));
    for (let i = 0; i < n; i++) step(S, Ht / n);
    return;
  }
  for (let t = 0, n = 0; t < Ht && n < cap; n++) {
    const h = Math.min(Ht - t, 1.1 / (S.umax * KMAX));
    step(S, h);
    t += h;
  }
}

// ---- the frame ------------------------------------------------------------------------------
export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.6, 3);
  prepare(S, cl(k[3], 1, 2), kfOf(k[2]));
  S.hue = k[0];
  // Model time per panel second c holds the rms speed at CFG.speed LEDs a second per unit of Flow.
  // urs follows the rms speed with a lag of two model time units, and sets the rates.
  const c = cl((flow * CFG.speed) / S.urms, 0.05, 20), Ht = ft * c;
  S.urs += (S.urms - S.urs) * (1 - exp(-Ht * 0.5));
  // The wind swings slowly in heading, on two rates with no common period; its model value is
  // its panel value over c.
  S.tp += (ft * flow) / 2;
  const al = CFG.al0 + 0.9 * sin(0.0137 * S.tp + 1.1) + 0.55 * sin(0.0059 * S.tp + 4.0), wu = (CFG.wind * flow) / c;
  S.ux = wu * cos(al);
  S.uy = wu * sin(al);
  advance(S, Ht);
  render(S);
}

// theta and a band-passed copy of it go out through one transform: theta_hat + i w theta_hat
// gives theta in the real part and w theta in the imaginary part, w a bump of width 0.35 CFG.kb
// around CFG.kb. The band is the detail of the picture, added back to the value in draw().
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

// Theta over its rms goes through the tone curve (CFG.tone, CFG.gam) to a place on a ramp of
// hue, saturation and value stops. Where |grad theta| is large, on a front, the colour loses half
// its saturation and gains value, and the band-passed detail is added to the value, never taking
// it under 0.25.
const STOPS = [
  [0, 0.68, 0.72, 0.3],
  [0.35, 0.6, 0.72, 0.5],
  [0.65, 0.5, 0.62, 0.72],
  [0.88, 0.42, 0.36, 0.95],
  [1, 0.32, 0.26, 1],
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
      const h = a[1] + (b[1] - a[1]) * t + hue;
      // Orange and yellow go brown when dark: from hue 0 to 0.2 they come up in value and lose saturation.
      const hh = h - floor(h), warm = sm(0.25, 0.1, abs(hh - 0.1));
      lut[i * 3] = h;
      lut[i * 3 + 1] = (a[2] + (b[2] - a[2]) * t) * (1 - 0.45 * warm);
      lut[i * 3 + 2] = max(a[3] + (b[3] - a[3]) * t, 0.3 + 0.18 * warm);
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
    const x = th / CFG.tone, i = (pow(0.5 + 0.5 * (x / sqrt(1 + x * x)), CFG.gam) * 255) | 0;
    hsv(lut[i * 3], lut[i * 3 + 1] * (1 - 0.5 * fr), cl(lut[i * 3 + 2] * (0.85 + 0.15 * fr) + CFG.fv * fr + d[p] * dinv, 0.25, 1), RGB);
    display.setPixel(p & 63, p >> 6, (RGB[0] * 255) | 0, (RGB[1] * 255) | 0, (RGB[2] * 255) | 0);
  }
}
