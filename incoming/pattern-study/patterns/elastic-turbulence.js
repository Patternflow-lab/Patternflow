// ===== Patternflow pattern =====
// Title:   Elastic Turbulence
// Family:  sim
// Idea:    A polymer solution with almost no inertia is solved as a Stokes flow on the panel's own 64 by 128 torus, its stress the conformation tensor of finitely extensible chains and a wandering large-scale force the only stirring, and drawn as how far the chains are stretched, so thin white-hot filaments wind into hooks and spirals between dark relaxed fluid, warm where the fluid turns one way and cool where it turns the other, and keep stretching, folding and re-forming for as long as it runs.
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Elastic turbulence in a polymer solution at Reynolds number far under one (Groisman and Steinberg, Nature 2000); its two-dimensional numerics in a periodic box (Berti and Boffetta, 2010; Gupta and Vincenzi, 2019; Thomases and Shelley, 2007 and 2009); Oldroyd-B (1950) and FENE-P (Peterlin, 1966; Bird, Dotson and Johnson, 1980); the conformation tensor carried as its symmetric square root (Balci, Thomases, Renardy and Doering, 2011) where Fattal and Kupferman (2004) take its logarithm; semi-Lagrangian transport (Robert, 1981); an Ornstein-Uhlenbeck force (1930); Oklab (Ottosson, 2020); every name and year here is from memory
// Round:   119
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Weissenberg=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the Oklab hue of every stop of both ramps but the dark base, so one turn comes back. At 0 the cool ramp (fluid turning one way) runs from deep indigo (6, 19, 53) through blue (22, 84, 169) and azure (28, 176, 211) to ice (177, 236, 239) and white, the warm one from plum (40, 6, 34) through crimson (160, 22, 62) and orange (246, 115, 44) to pale gold (253, 219, 146), and they stay about 200 degrees apart at every setting (0.25 rose and lilac against gold and lime, 0.5 amber against teal, 0.75 green against violet). The base does not turn, the stops are joined in a and b so that a turn goes through grey, and a dark yellow-green, which is olive, is lifted by at most 0.12 in lightness.
// Knob 2: Flow. Model time per panel second: 0.5 per unit of the knob times the forcing wavenumber over 0.2, so the speed in LEDs does not follow Scale: 0.25 at 0.5, 1.0 at the opening 2, 2.0 at 4. The rms speed at Scale 0 is 1.04, 4.08 and 8.39 LEDs a second. Flow only sets how many steps of the fixed size 0.05 run in a frame (0.17 to 1.7), so the state after the same number of steps is the same bit for bit at 0.5, 2 and 4 (largest difference 0 over 1500 steps) and the statistics cannot depend on it; the last two steps are mixed on the panel. Cost in Node: 0.8 ms a frame at 0.5 and Scale 1, 2.6 at the opening, 6.7 at 4 and Scale -1, plus 0.2 to draw; the first frame runs 6 time units from rest, 0.45 s.
// Knob 3: Scale. The wavenumber of the force, 0.2 times 1.3 to the minus knob per LED: a wavelength of 24.2 LEDs at -1, 31.4 at 0 and 40.8 at 1. All 81 lattice modes under |k| 0.5 are kept and weighted by a bump of width 0.3 kf, 30, 18 and 11 of them above half weight at -1, 0 and 1, scaled so that the rms shear of the force alone stays 1. The 1/e length of ln tr C across the panel and down is 3.4 and 3.1 LEDs at -1, 4.2 and 3.9 at 0, 5.9 and 5.5 at 1 (mean of 90 s), and the speed is 4.35, 4.08 and 4.21 LEDs a second: the cells change size and the pace does not. It follows the knob with a time constant of 1.2 s.
// Knob 4: Weissenberg. Wi = lam gamma0, 1.8 times 3 to the knob: 0.6 at -1, 1.9 at the opening, 5.4 at 1 (same smoothing). gamma0 is the rms shear that the force alone makes in a Newtonian fluid of the total viscosity, 1 by construction (1.06 and 1.13 measured over 150 s for two seeds, which is the sampling of the force). Mean tr C is 2.62, 6.70 and 19.05, the share of the panel over 10 is 0.1, 16.5 and 59.0 per cent, the speed 4.74, 4.08 and 3.49 LEDs a second. The picture is drawn between percentiles of the frame, so Wi shows as shape and not as brightness: smooth cells with a few short arcs at 0.6, hooks and spirals at 1.9, broad ribbons over most of the panel at 5.4.

// What the field is. A torus of 64 by 128 cells, one to an LED, and time in units of 1 / gamma0. C is the 2 by 2 conformation tensor of the chains, L = [[u_x, u_y], [v_x, v_y]]:
//   C_t + u.grad C = L C + C L^T - (f C - I) / lam,   f = (LL - 2) / (LL - tr C),   LL = 200      (FENE-P in two dimensions: f = 1 at rest, tr C stays under LL)
//   beta lap u - grad p + div tau + F = 0,   tau = ((1 - beta) / lam) (f C - I),   div u = 0,   beta = 0.6      (no inertia)
// The flow is solved in Fourier space with u = (psi_y, -psi_x) and beta k^4 psi = (ky^2 - kx^2) tau_xy - kx ky (tau_yy - tau_xx) + curl F: the stress goes in through one transform as tau_xy + i (tau_yy - tau_xx),
// the velocity and its gradient come back through three, a filter exp(-36 r^16) of the radius r (the cut is 1) takes the highest modes and there is no mean flow. F is 81 modes of wavevector (nx / 64, ny / 128) whose complex amplitudes
// wander, Ornstein-Uhlenbeck with a correlation time of 8, so nothing repeats and nothing stops. C is carried as S = C^(1/2), so any look-up of S gives a positive semi-definite S S. One step of 0.05: the flow of the
// last two steps extrapolated to its middle, each cell traced back along it (bilinear at the middle point), S there by cubic Lagrange held between the smallest and largest of the four nearest nodes, then relax half a
// step, stretch (C -> F C F^T, F = exp(L dt), exact, det F = 1, with L at the middle of the path), relax half a step (C+ = e C + (1 - e) I / f, e = exp(-f dt / lam), f taken at the middle of the step from a backward-Euler
// estimate of its end; backward Euler alone for a cell within 0.1 per cent of LL), take the root, solve the flow. The flow follows that Stokes solution with a lag of 0.5, y' = (g - y) / 0.5, stepped exactly for a g that is
// linear over the step: a small inertia, there for the reason in the last block. The picture is e = ln(tr C / 2) / ln(LL / 2) between its 6th and 99.5th percentile of the frame (followed over 6 s), to the power 1.8; the
// sign of the vorticity v_x - u_y, as tanh of it over its rms, mixes the cool and the warm ramp.
//
// What was checked, with the file's own step (scripts of mine, not in the repo):
// - Steady simple shear of one cell (lam 4) against the FENE-P cubic f^3 - f^2 = 2 Wi^2 / LL (my derivation, C_yy = 1/f, C_xy = Wi / f^2, C_xx = (1 + 2 Wi^2 / f^2) / f): largest relative error of the components at dt 0.05
//   is 6.7e-6 at Wi 0.5, 2.1e-5 at 5, 1.6e-4 at 20, 8.4e-4 at 50, a quarter of that for each halving; at LL 1e12 against Oldroyd-B (C_xy = Wi, C_xx = 1 + 2 Wi^2) 6.5e-6. Backward Euler for the relaxation was first order, 5.4e-3 at Wi 2.
// - Laminar Kolmogorov flow with the stress in, one force mode (wavelength 42.7): the shear rate against the exact steady profile of beta g + (1 - beta) g / f(lam g) = force shear cos(ky) is within 2e-4 of its peak at Wi 0.5 to 10 (lam g).
// - Step halving from 0.2 to 0.0125, smooth start, force off, against 0.003125: second order without the look-up (error ratios 4.2, 4.0, 4.2, errors 2.6e-3 down to 5.8e-6); with it 3.4 then 2.4 (1.1e-4 at 0.05 down to 1.9e-5):
//   the cubic look-up costs the same at every step, so its error grows as steps shrink.
// - Positive definiteness and bound, 16 runs of 300 s with the knobs thrown to their ends and between every 0.5 to 10 s: smallest det C 0.25, largest tr C 160 (LL 200), largest |L| 3.8; no cell used backward Euler alone, none was
//   held at the cap on |L| of 12 and none was non-finite.
// - Long runs through update(): open 3 h (10806 time units), Flow 4 and Scale -1 for 2 h (18726, the fastest clock), the min set 1 h (1176), the max set 2 h (11083). Largest tr C 98, 91, 27, 157, smallest det C 0.68, 0.46,
//   0.94, 0.58, |L| never over 3.6, nothing non-finite, no cell at backward Euler alone or at the cap. Mean tr C by quarter 6.99, 7.08, 7.00, 7.07 (open, last over first 1.012), 6.99 to 7.04 (fast, 1.002), 2.66 to 2.67 (min, 1.003),
//   20.22, 20.01, 20.04, 20.16 (max, 0.997); the share over 10 sits at 18.2 to 18.6, 18.2 to 18.5, 0.1 and 60.0 to 60.4 per cent with a spread over time of 4, 3, 0.1 and 6; kinetic energy last over first quarter 0.99, 0.99, 0.99, 1.00.
// - div u from the spectrum 9e-15 (4.7e-15 of the largest gradient), the gradients against spectral derivatives of u and v 1.1e-14, 4e-15 left imaginary. The state lives in the plane and each flow solve builds Hermitian spectra
//   from scratch (the stress by the packed extraction, the force as a mode and its conjugate), so there is nothing to drift. A second Stokes solve (three stress components apart, force and curl as vectors) agrees to 1.1e-14 in u and v.
// - The look-up on a Gaussian ridge at 0.1 to 0.5 LED a step: sigma 2.5 LEDs loses 10 per cent of its peak in 5 time units, sigma 1.5 loses 28, sigma 1 loses 45 (effective diffusivity 0.03 to 0.6 LED^2 per time unit, more for the narrow and fast).
// - The same force over the same box on 128 by 256 cells: ln tr C at the same places correlates 0.989 with this grid after 40 time units, the peak tr C is 61 against 50, the means agree (tr C 6.70 and 6.70, strain rate 0.790 and 0.793).
// - Not chaotic by itself: with the same force a kick of 7e-5 in ln tr C is 0.03, 0.13 and 0.28 ten time units on (partly the restart of the lag) and 1e-2, 3e-2 and 4e-2 a hundred on, at Wi 0.6, 1.9 and 5.4. The laminar
//   flow of one force mode is stable below Wi 3.5 and its x-dependent noise grows above that at 0.05 per time unit at most, so the force carries the variety.
// - flowcheck, 240 s, six sets: recur 0.64 to 0.76, dim 0.84 to 0.94, quiet 0.75 to 0.91, last quarter dim over 0.65 and quiet over 0.57, luma 0.8 to 9.9 per cent first to last quarter; 900 s: open 0.676, 0.944, 0.944.
//
// What failed first. With the flow solved from the stress of the same step and no lag, a few cells passed tr C 100 to 120 of LL 200 and |L| then doubled every step to NaN, within 2 to 17 time units in every run (the stress f C grows as
// 1 / (LL - tr C), so the coupling is stiff). The lag of 0.5 and a step of 0.05 stop it; at a step of 0.1 the start from rest at lam 12 failed in 11 of 40 seeds, at 0.05 in 1 of 60. So lam comes in over the first 4.8 time units, and a hold
// of |L| at 12 stays in the file, which never acted. The first palette had a hue wrap (green fringes) and an olive wash at Hue 0.25 to 0.5. The first flowcheck of the max set ended in NaN from that start at 0.1.
// What was not checked: the literature values, the grid at other settings, and any real Navier-Stokes flow; the lag is a stand-in.

const { floor, exp, sqrt, sin, cos, log, PI, min, max, pow, tanh } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ---- grid: 64 across (x), 128 down (y), one cell to an LED, a torus ----
const W = 64, H = 128, N = W * H, WM = W - 1, HM = H - 1;

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

// ---- the model (equations in the header) ----
const BETA = 0.6, LLMAX = 200; // solvent share of the viscosity, and LL
const CO = new Float64Array(3), CS = new Float64Array(3); // results of the local update and of the root
// Relaxation over delta = dt / lam. Backward Euler, C+ = (C + delta I) / (1 + f delta), has f from LL delta f^2 + (LL - s - LL delta) f - (LL - 2) = 0 (s = tr C);
// the exponential at f of the mean of the two traces is the answer used.
let NBE = 0, NCAP = 0; // cells that used backward Euler alone, and cells whose velocity gradient was held at LCAP
const LCAP = 12, LCAP2 = LCAP * LCAP;
function relax(cxx, cxy, cyy, delta, LL) {
  const s = cxx + cyy, B = LL - s - LL * delta, sq = sqrt(B * B + 4 * LL * delta * (LL - 2));
  const fb = B > 0 ? (2 * (LL - 2)) / (B + sq) : (sq - B) / (2 * LL * delta), inv = 1 / (1 + fb * delta), sb = (s + 2 * delta) * inv, sm = 0.5 * (s + sb);
  if (sm < LL * 0.999) {
    const f = (LL - 2) / (LL - sm), x = f * delta;
    // g = (1 - e^-x) / x, from its series when x is small
    const g = x < 0.25 ? 1 - x * (0.5 - x * (1 / 6 - x * (1 / 24 - x * (1 / 120 - x / 720)))) : (1 - exp(-x)) / x, e = 1 - x * g, c = delta * g;
    if (e * s + 2 * c < LL) {
      CO[0] = e * cxx + c;
      CO[1] = e * cxy;
      CO[2] = e * cyy + c;
      return;
    }
  }
  NBE++;
  CO[0] = (cxx + delta) * inv;
  CO[1] = cxy * inv;
  CO[2] = (cyy + delta) * inv;
}
// The stretch, C -> F C F^T with F = exp(L dt) = c I + sn L, since L has no trace and L L = q2 I.
function stretch(cxx, cxy, cyy, l11, l12, l21, dt) {
  const q2 = l11 * l11 + l12 * l21, x2 = q2 * dt * dt;
  let c, sn;
  if (x2 < 0.25 && x2 > -0.25) {
    // cosh and sinh(x) / x of x = q dt, as series in x2 = x^2 (a rotation, q2 < 0, is the same series with x2 negative)
    c = 1 + x2 * (0.5 + x2 * (1 / 24 + x2 * (1 / 720 + x2 / 40320)));
    sn = dt * (1 + x2 * (1 / 6 + x2 * (1 / 120 + x2 * (1 / 5040 + x2 / 362880))));
  } else if (x2 > 0) {
    const q = sqrt(q2), e = exp(q * dt), ei = 1 / e;
    c = 0.5 * (e + ei);
    sn = (0.5 * (e - ei)) / q;
  } else {
    const w = sqrt(-q2);
    c = cos(w * dt);
    sn = sin(w * dt) / w;
  }
  const f11 = c + sn * l11, f12 = sn * l12, f21 = sn * l21, f22 = c - sn * l11;
  const t11 = f11 * cxx + f12 * cxy, t12 = f11 * cxy + f12 * cyy, t21 = f21 * cxx + f22 * cxy, t22 = f21 * cxy + f22 * cyy;
  CO[0] = t11 * f11 + t12 * f12;
  CO[1] = t11 * f21 + t12 * f22;
  CO[2] = t21 * f21 + t22 * f22;
}
// One local update: relax half a step, stretch a whole one, relax half a step.
function local(cxx, cxy, cyy, l11, l12, l21, dt, lam, LL) {
  const dl = (0.5 * dt) / lam;
  relax(cxx, cxy, cyy, dl, LL);
  stretch(CO[0], CO[1], CO[2], l11, l12, l21, dt);
  relax(CO[0], CO[1], CO[2], dl, LL);
}
// The symmetric square root of a 2 by 2 positive definite matrix: S = (C + sqrt(det C) I) / sqrt(tr C + 2 sqrt(det C)).
function sqrtm(cxx, cxy, cyy) {
  const d = cxx * cyy - cxy * cxy, s = d > 1e-300 ? sqrt(d) : 0, t = 1 / sqrt(cxx + cyy + 2 * s);
  CS[0] = (cxx + s) * t;
  CS[1] = cxy * t;
  CS[2] = (cyy + s) * t;
}

const MIR = new Int32Array(N), KX = new Float64Array(N), KY = new Float64Array(N), FILT = new Float64Array(N);
for (let j = 0; j < H; j++)
  for (let i = 0; i < W; i++) {
    const p = j * W + i, ni = i < W / 2 ? i : i - W, nj = j < H / 2 ? j : j - H;
    MIR[p] = ((H - j) % H) * W + ((W - i) % W);
    KX[p] = (TAU * ni) / W;
    KY[p] = (TAU * nj) / H;
    const r2 = pow(ni / (W / 2), 2) + pow(nj / (H / 2), 2);
    FILT[p] = ni === -W / 2 || nj === -H / 2 || (!ni && !nj) ? 0 : exp(-36 * pow(r2, 8));
  }

const mk = () => new Float64Array(N);
function makeState() {
  // S = (a, b, d) and the next S; the flow u, v, l11 l12 l21 (the gradient) and the one before (p...), the Stokes solution it lags (g...), its extrapolation (e...), the transforms
  const S = { t: 0, dtp: 0, lam: 4, tauU: 0.5, LL: LLMAX, beta: BETA, modes: [], force: true, ou: true, steps: 0 };
  for (const k of "a b d a2 b2 d2 u v l11 l12 l21 pu pv p11 p12 p21 gu gv g11 g12 g21 eu ev e11 e12 e21 zr zi ar ai br bi cr ci".split(" ")) S[k] = mk();
  return S;
}

// ---- forcing: lattice modes under |k| KMAX, complex Ornstein-Uhlenbeck amplitudes, weighted by a bump about kf ----
const KMAX = 0.5, KXN = 5, KYN = 10, TAUF = 8;
const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
function makeModes() {
  const m = [];
  for (let ni = 0; ni <= KXN; ni++)
    for (let nj = -KYN; nj <= KYN; nj++) {
      if (ni === 0 && nj <= 0) continue;
      const kx = (TAU * ni) / W, ky = (TAU * nj) / H, k2 = kx * kx + ky * ky;
      if (k2 > KMAX * KMAX) continue;
      m.push({ p: ((nj + H) % H) * W + ni, pm: ((H - nj) % H) * W + ((W - ni) % W), kx, ky, k2, k: sqrt(k2), zr: gauss() * sqrt(0.5), zi: gauss() * sqrt(0.5), w: 0 });
    }
  return m;
}
function setBand(S, kf) {
  let s2 = 0;
  for (const m of S.modes) {
    m.w = exp(-0.5 * pow((m.k / kf - 1) / 0.3, 2));
    s2 += m.w * m.w;
  }
  S.cf = sqrt(2 / s2);
}
function forceOU(S, dt) {
  const e = exp(-dt / TAUF), s = sqrt(1 - e * e) * sqrt(0.5);
  for (const m of S.modes) {
    m.zr = m.zr * e + s * gauss();
    m.zi = m.zi * e + s * gauss();
  }
}

// ---- the flow: Stokes in Fourier space from the stress and the force (header) ----
function flow(S, dt) {
  const { a, b, d, zr, zi, ar, ai, br, bi, cr, ci } = S, LL = S.LL, G = (1 - S.beta) / S.lam, iN = 1 / N;
  for (let p = 0; p < N; p++) {
    const sa = a[p], sb = b[p], sd = d[p], cxx = sa * sa + sb * sb, cxy = sb * (sa + sd), cyy = sb * sb + sd * sd;
    const s = min(cxx + cyy, LL * (1 - 1e-9)), g = (G * (LL - 2)) / (LL - s);
    zr[p] = g * cxy;
    zi[p] = g * (cyy - cxx);
  }
  fft2(zr, zi, false);
  for (let p = 0; p < N; p++) {
    const q = MIR[p], kx = KX[p], ky = KY[p], k2 = kx * kx + ky * ky;
    if (!FILT[p]) {
      ar[p] = ai[p] = 0;
      continue;
    }
    const tr = zr[p] + zr[q], ti = zi[p] - zi[q], nr = zi[p] + zi[q], ni = zr[q] - zr[p];
    ar[p] = (0.5 * iN) * ((ky * ky - kx * kx) * tr - kx * ky * nr);
    ai[p] = (0.5 * iN) * ((ky * ky - kx * kx) * ti - kx * ky * ni);
  }
  if (S.force) {
    if (S.ou) forceOU(S, dt);
    for (const m of S.modes) {
      const amp = 0.5 * m.k2 * S.cf * m.w; // a = k^2 g, the coefficient of cos is a / 2 at k and at -k
      const xr = amp * m.zr, xi = amp * m.zi;
      ar[m.p] += xr;
      ai[m.p] += xi;
      ar[m.pm] += xr;
      ai[m.pm] -= xi;
    }
  }
  const ib = 1 / S.beta;
  for (let p = 0; p < N; p++) {
    const f = FILT[p];
    if (!f) {
      br[p] = bi[p] = cr[p] = ci[p] = 0;
      continue;
    }
    const kx = KX[p], ky = KY[p], k2 = kx * kx + ky * ky, c = (ib * f) / (k2 * k2), pr = ar[p] * c, pi = ai[p] * c;
    // u = i ky psi, v = -i kx psi, L11 = -kx ky psi, L12 = -ky^2 psi, L21 = kx^2 psi; A = u + i L11, B = v + i L12
    const l11r = -kx * ky * pr, l11i = -kx * ky * pi, l12r = -ky * ky * pr, l12i = -ky * ky * pi;
    ar[p] = -ky * pi - l11i;
    ai[p] = ky * pr + l11r;
    br[p] = kx * pi - l12i;
    bi[p] = -kx * pr + l12r;
    cr[p] = kx * kx * pr;
    ci[p] = kx * kx * pi;
  }
  fft2(ar, ai, true);
  fft2(br, bi, true);
  fft2(cr, ci, true);
  // the new flow follows its Stokes solution g (read off the transforms) with a lag tauU, y' = (g - y) / tauU, stepped exactly for a g that is
  // linear over the step; it is written over the flow of the step before, which moves back one place
  const Y = [S.u, S.v, S.l11, S.l12, S.l21], PY = [S.pu, S.pv, S.p11, S.p12, S.p21], GG = [S.gu, S.gv, S.g11, S.g12, S.g21], SRC = [ar, br, ai, bi, cr];
  const h = dt / S.tauU, ee = dt > 0 ? exp(-h) : 0, c1 = dt > 0 ? 1 - ee : 0, c2 = dt > 0 ? 1 - c1 / h : 1;
  for (let k = 0; k < 5; k++) {
    const y = Y[k], out = PY[k], g0 = GG[k], g1 = SRC[k];
    for (let p = 0; p < N; p++) {
      out[p] = ee * y[p] + c1 * g0[p] + c2 * (g1[p] - g0[p]);
      g0[p] = g1[p];
    }
  }
  [S.u, S.v, S.l11, S.l12, S.l21, S.pu, S.pv, S.p11, S.p12, S.p21] = [...PY, ...Y];
}

// ---- look-up: bilinear for the smooth velocity, cubic for S ----
const BI = new Int32Array(4), BW = new Float64Array(2);
function locate(x, y) {
  const ix = floor(x), iy = floor(y), r0 = (iy & HM) * W, r1 = ((iy + 1) & HM) * W, x0 = ix & WM, x1 = (ix + 1) & WM;
  BW[0] = x - ix;
  BW[1] = y - iy;
  BI[0] = r0 + x0;
  BI[1] = r0 + x1;
  BI[2] = r1 + x0;
  BI[3] = r1 + x1;
}
function samp(F) {
  const t0 = F[BI[0]] + (F[BI[1]] - F[BI[0]]) * BW[0], t1 = F[BI[2]] + (F[BI[3]] - F[BI[2]]) * BW[0];
  return t0 + (t1 - t0) * BW[1];
}
const XI = new Int32Array(4), YR = new Int32Array(4), WX = new Float64Array(4), WY = new Float64Array(4);
function locate4(x, y) {
  const ix = floor(x), iy = floor(y);
  let t = x - ix;
  WX[0] = (-t * (t - 1) * (t - 2)) / 6;
  WX[1] = ((t + 1) * (t - 1) * (t - 2)) / 2;
  WX[2] = (-(t + 1) * t * (t - 2)) / 2;
  WX[3] = ((t + 1) * t * (t - 1)) / 6;
  t = y - iy;
  WY[0] = (-t * (t - 1) * (t - 2)) / 6;
  WY[1] = ((t + 1) * (t - 1) * (t - 2)) / 2;
  WY[2] = (-(t + 1) * t * (t - 2)) / 2;
  WY[3] = ((t + 1) * t * (t - 1)) / 6;
  for (let k = 0; k < 4; k++) {
    XI[k] = (ix + k - 1) & WM;
    YR[k] = ((iy + k - 1) & HM) * W;
  }
}
function cubic(F) {
  const x0 = XI[0], x1 = XI[1], x2 = XI[2], x3 = XI[3], wx0 = WX[0], wx1 = WX[1], wx2 = WX[2], wx3 = WX[3];
  const o0 = YR[0], o1 = YR[1], o2 = YR[2], o3 = YR[3];
  const q = F[o1 + x1], r = F[o1 + x2], s = F[o2 + x1], w = F[o2 + x2];
  const v =
    WY[0] * (wx0 * F[o0 + x0] + wx1 * F[o0 + x1] + wx2 * F[o0 + x2] + wx3 * F[o0 + x3]) +
    WY[1] * (wx0 * F[o1 + x0] + wx1 * q + wx2 * r + wx3 * F[o1 + x3]) +
    WY[2] * (wx0 * F[o2 + x0] + wx1 * s + wx2 * w + wx3 * F[o2 + x3]) +
    WY[3] * (wx0 * F[o3 + x0] + wx1 * F[o3 + x1] + wx2 * F[o3 + x2] + wx3 * F[o3 + x3]);
  const lo = min(min(q, r), min(s, w)), hi = max(max(q, r), max(s, w));
  return v < lo ? lo : v > hi ? hi : v;
}

// ---- one step ----
function step(S, dt) {
  const { a, b, d, a2, b2, d2, u, v, l11, l12, l21, pu, pv, p11, p12, p21, eu, ev, e11, e12, e21 } = S, lam = S.lam, LL = S.LL;
  const r = S.dtp > 0 ? dt / (2 * S.dtp) : 0, hd = 0.5 * dt;
  [[u, pu, eu], [v, pv, ev], [l11, p11, e11], [l12, p12, e12], [l21, p21, e21]].forEach(([y, py, ex]) => {
    for (let p = 0; p < N; p++) ex[p] = y[p] + (y[p] - py[p]) * r;
  });
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      locate(x - hd * eu[p], y - hd * ev[p]);
      let um = samp(eu), vm = samp(ev);
      locate(x - hd * um, y - hd * vm);
      um = samp(eu);
      vm = samp(ev);
      let g11 = samp(e11), g12 = samp(e12), g21 = samp(e21);
      const gg = g11 * g11 + g12 * g12 + g21 * g21;
      if (gg > LCAP2) {
        const k = LCAP / sqrt(gg);
        (g11 *= k), (g12 *= k), (g21 *= k);
        NCAP++;
      }
      locate4(x - dt * um, y - dt * vm);
      const sa = cubic(a), sb = cubic(b), sd = cubic(d);
      local(sa * sa + sb * sb, sb * (sa + sd), sb * sb + sd * sd, g11, g12, g21, dt, lam, LL);
      sqrtm(CO[0], CO[1], CO[2]);
      a2[p] = CS[0];
      b2[p] = CS[1];
      d2[p] = CS[2];
    }
  [S.a, S.b, S.d, S.a2, S.b2, S.d2] = [a2, b2, d2, a, b, d];
  S.t += dt;
  S.dtp = dt;
  S.steps++;
  flow(S, dt);
}

// start: C = I, the flow of that state
function reset(S) {
  S.a.fill(1);
  S.b.fill(0);
  S.d.fill(1);
  S.t = 0;
  S.dtp = 0;
  S.steps = 0;
  for (const k of ["gu", "gv", "g11", "g12", "g21"]) S[k].fill(0);
  flow(S, 0);
  S.pu.set(S.u);
  S.pv.set(S.v);
  S.p11.set(S.l11);
  S.p12.set(S.l12);
  S.p21.set(S.l21);
}

// ---- the picture: e and the vorticity of the last two steps, and the percentiles of e ----
const NQ = 128, hist = new Int32Array(NQ);
function shade(S) {
  const { a, b, d, l12, l21 } = S, il = 1 / log(S.LL / 2);
  [S.eA, S.eB, S.wA, S.wB] = [S.eB, S.eA, S.wB, S.wA];
  const { eB, wB } = S;
  hist.fill(0);
  let om = 0, bad = 0;
  for (let p = 0; p < N; p++) {
    const sa = a[p], sb = b[p], sd = d[p], tr = sa * sa + 2 * sb * sb + sd * sd, w = l21[p] - l12[p];
    const e = cl(log(tr * 0.5) * il, 0, 0.9999);
    if (!(tr < 1e6)) bad = 1;
    eB[p] = e;
    wB[p] = w;
    hist[(e * NQ) | 0]++;
    om += w * w;
  }
  let c = 0, q0 = 0, q1 = NQ;
  for (let k = 0; k < NQ; k++) {
    c += hist[k];
    if (c < 0.06 * N) q0 = k + 1;
    if (c < 0.995 * N) q1 = k + 1;
  }
  S.q0 = q0 / NQ;
  S.q1 = max(q1 / NQ, S.q0 + 0.1);
  S.om = sqrt(om / N) + 1e-9;
  return bad;
}

// ---- colour: two ramps in Oklab from a dark base ----
const RGB = [0, 0, 0];
// Oklab to linear sRGB in RGB; the colour is in gamut when every channel is within e of [0, 1]
function lin(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  RGB[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  RGB[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  RGB[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const inside = (e) => RGB[0] > -e && RGB[0] < 1 + e && RGB[1] > -e && RGB[1] < 1 + e && RGB[2] > -e && RGB[2] < 1 + e;
// the colour with its chroma pulled in until sRGB can show it
function okLab(L, a0, b0) {
  for (let i = 0; i <= 20; i++) {
    const k = 1 - i / 20;
    lin(L, a0 * k, b0 * k);
    if (i === 20 || inside(0.002)) return;
  }
}
const enc = (v) => ((((v = cl(v, 0, 1)) <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055) * 255 + 0.5) | 0);
// stops [v, L, C, hue] of the warm ramp (w = +1) and of the cool one (w = -1). The stop at zero does not turn with Hue, so the dark between
// the filaments stays a deep indigo or plum at every setting.
const WARM = [[0, 0.2, 0.07, 335], [0.3, 0.46, 0.17, 12], [0.62, 0.7, 0.18, 45], [0.88, 0.9, 0.1, 85], [1, 0.99, 0.03, 100]];
const COOL = [[0, 0.2, 0.07, 265], [0.3, 0.46, 0.15, 258], [0.62, 0.7, 0.13, 220], [0.88, 0.9, 0.06, 200], [1, 0.99, 0.02, 200]];
const NW = 17, LUT = new Uint8Array(NQ * NW * 3);
// the largest chroma sRGB holds at lightness L and hue h (radians), by bisection
function cmax(L, h) {
  let lo = 0, hi = 0.4;
  for (let i = 0; i < 12; i++) {
    const c = 0.5 * (lo + hi);
    lin(L, c * cos(h), c * sin(h));
    if (inside(0)) lo = c;
    else hi = c;
  }
  return lo;
}
// the stops of a ramp as [v, L, a, b]: Hue is added to the hue of every stop but the one at zero, and the lightness of a stop is raised, never
// lowered and by at most 0.12, until its hue can hold 85 per cent of its chroma (a dark yellow-green is olive, so it comes up to a lighter lime).
// The colours between two stops are joined in a and b, so a turn of Hue goes through grey and not through the rainbow.
function stops(st, hue) {
  return st.map(([v, L0, C, h0]) => {
    const h = ((h0 + (v > 0 ? hue : 0)) * PI) / 180;
    let L = L0;
    while (L < L0 + 0.12 && cmax(L, h) < 0.85 * C) L += 0.015;
    return [v, L, C * cos(h), C * sin(h)];
  });
}
function ramp(sl, v, o) {
  let j = 1;
  while (j < sl.length - 1 && v > sl[j][0]) j++;
  const A = sl[j - 1], B = sl[j], t = cl((v - A[0]) / (B[0] - A[0]), 0, 1);
  o[0] = A[1] + (B[1] - A[1]) * t;
  o[1] = A[2] + (B[2] - A[2]) * t;
  o[2] = A[3] + (B[3] - A[3]) * t;
}
const RA = [0, 0, 0], RB = [0, 0, 0];
function buildLut(hue) {
  const sw = stops(WARM, hue * 360), sc = stops(COOL, hue * 360);
  for (let i = 0; i < NQ; i++) {
    const v = i / (NQ - 1);
    ramp(sw, v, RA);
    ramp(sc, v, RB);
    for (let k = 0; k < NW; k++) {
      const m = k / (NW - 1);
      okLab(RB[0] + (RA[0] - RB[0]) * m, RB[1] + (RA[1] - RB[1]) * m, RB[2] + (RA[2] - RB[2]) * m);
      const o = (i * NW + k) * 3;
      LUT[o] = enc(RGB[0]);
      LUT[o + 1] = enc(RGB[1]);
      LUT[o + 2] = enc(RGB[2]);
    }
  }
}

// ---- the pattern ----
const OPEN = [0, 2, 0, 0.06];
const DT0 = 0.05, MAXSTEPS = 6, CLOCK = 0.5, KF0 = 0.2, PRE = 6; // step, most steps a frame, model time a second per unit of Flow, kf at Scale 0, start-up time
const LAM0 = 1.8, LAMB = 3, KFB = 1.3, GAM = 1.8; // Wi = LAM0 LAMB^knob, kf = KF0 KFB^-knob, contrast power
const GT = new Float64Array(256).map((_, i) => pow(i / 255, GAM)); // the contrast curve

export function setup(params) {
  const S = makeState();
  S.modes = makeModes();
  Object.assign(S, { eA: new Float32Array(N), eB: new Float32Array(N), wA: new Float32Array(N), wB: new Float32Array(N), acc: 0, ready: false, lutHue: -1, hue: 0, flowk: 2, lamT: 3, kfT: KF0, elo: 0.1, ehi: 0.7, om: 1, q0: 0.1, q1: 0.7, nbad: 0 });
  params.s = S;
  return S;
}
function spin(S) {
  setBand(S, S.kfT);
  reset(S);
  shade(S);
  shade(S);
  // lam is let in over the first 0.8 of the run: from rest the first stretch has nothing to push back
  while (S.t < PRE) {
    S.lam = S.lamT * (0.1 + 0.9 * sm(0, 0.8 * PRE, S.t));
    step(S, DT0);
  }
  S.lam = S.lamT;
  shade(S);
  shade(S);
}
export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN, ft = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.flowk = cl(k[1], 0.1, 8);
  S.lamT = LAM0 * pow(LAMB, cl(k[3], -1.2, 1.2));
  S.kfT = KF0 * pow(KFB, -cl(k[2], -1.2, 1.2));
  if (!S.ready) {
    S.ready = true;
    S.kf = S.kfT;
    S.elo = S.q0 = 0.1;
    spin(S);
    S.elo = S.q0;
    S.ehi = S.q1;
  }
  const f = 1 - exp(-ft / 1.2);
  S.lam += (S.lamT - S.lam) * f;
  S.kf += (S.kfT - S.kf) * f;
  setBand(S, S.kf);
  S.acc += ft * CLOCK * S.flowk * (S.kf / KF0);
  let n = 0;
  while (S.acc >= DT0 && n < MAXSTEPS) {
    step(S, DT0);
    S.acc -= DT0;
    n++;
    // a state that has gone bad starts again from rest (it does not happen in any run below)
    if (shade(S)) {
      S.nbad++;
      spin(S);
      break;
    }
  }
  if (n === MAXSTEPS) S.acc = min(S.acc, DT0);
  const g = 1 - exp(-ft / 6);
  S.elo += (S.q0 - S.elo) * g;
  S.ehi += (S.q1 - S.ehi) * g;
}
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.lutHue !== S.hue) {
    S.lutHue = S.hue;
    buildLut(S.hue);
  }
  const { eA, eB, wA, wB } = S, ph = cl(S.acc / DT0, 0, 1), il = 1 / (S.ehi - S.elo), lo = S.elo, iw = 1.2 / S.om;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const e = eA[p] + (eB[p] - eA[p]) * ph, w = wA[p] + (wB[p] - wA[p]) * ph;
      const v = GT[(cl((e - lo) * il, 0, 1) * 255) | 0], m = tanh(w * iw) * 0.5 + 0.5, o = ((((v * (NQ - 1) + 0.5) | 0) * NW) + ((m * (NW - 1) + 0.5) | 0)) * 3;
      display.setPixel(x, y, LUT[o], LUT[o + 1], LUT[o + 2]);
    }
}
