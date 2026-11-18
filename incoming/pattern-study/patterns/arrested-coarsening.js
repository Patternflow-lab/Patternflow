// ===== Patternflow pattern =====
// Title:   Arrested Coarsening
// Family:  sim
// Idea:    Amber and teal liquids that do not mix are stirred in two-dimensional turbulence on the panel's own 64 by 128 torus: left alone each would coarsen into one domain, but the stirring breaks the domains as fast as surface tension rounds them up, so droplets stretch, pinch off, collide and merge at a size that holds for ever, while a marker carried by the same flow marbles the inside of each liquid.
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Cahn-Hilliard equation for a mixture that separates in two (John Cahn and John Hilliard, 1958, from memory), coupled to the flow it drives through the capillary force, "Model H" (Pierre Hohenberg and Bertrand Halperin, 1977, from memory); the arrest of coarsening by the inverse energy cascade of two-dimensional turbulence (Prasad Perlekar, Nairita Pal and Rahul Pandit, Scientific Reports, 2017, from memory), after arrested phase separation in a chaotic flow (Ludovic Berthier, Jean-Louis Barrat and Jorge Kurchan, 2001, from memory); the two-thirds rule for a pseudo-spectral method (Steven Orszag, 1971, from memory); exponential time differencing with Adams-Bashforth extrapolation (Steven Cox and Paul Matthews, 2002, from memory); a marker carried semi-Lagrangian (Jos Stam, 1999, from memory); colour mixed in OKLab (Bjorn Ottosson, 2020, from memory); pattern round 120, made on the creator's turn of 8 November toward fields that flow for ever
// Round:   120
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Stir=0.8..3.2, Scale=-1..1, Fraction=0.25..0.75
//
// Knob 1: Hue. Turns the two liquids round the colour wheel together, 122 degrees apart in OKLab hue. At 0 the first is amber (hue 78) and the second a deep teal (200); at 0.25 they are mint and violet, at 0.5 periwinkle and copper, at 0.75 pink and olive. In the warm hues the dark liquid comes up in lightness by as much as 0.2, so that it does not go brown. One turn of the knob comes back to where it started.
// Knob 2: Stir. The power of the random stirring. Its rms is FA = (K2 / 2)^0.75 LEDs a second squared, 0.5 at 0.8, 1 at 2 and 1.42 at 3.2, and the capillary coefficient follows as the 1.3 power of it. At Fraction 0.25 and Scale 0 the water's rms speed is 1.0 LEDs a second at 0.8, 1.9 at 2 and 2.7 at 3.2, and the area-weighted radius of the amber droplets is 11.7 LEDs at 0.8, 8.5 at 2 and 7.4 at 3.2 (means over 60 to 240 s).
// Knob 3: Scale. The wavelength of the stirring and, with it, the size of the droplets: 64 / k_f with k_f = 4.5 x 2^(-0.6 K3) whole waves across the width, 14 LEDs at 0, 9.4 at -1 and 21.5 at 1. Below 0 the stirring also grows as (k_f / 4.5)^1.2, 1.65 times at -1; above 0 the capillary coefficient rises as 2^(2.2 K3), 4.6 times at 1. At Stir 2 and Fraction 0.25 the droplet radius is 7.1 LEDs at -1, 8.5 at 0 and 11.9 at 1, and the water's rms speed 2.7, 1.9 and 2.1 LEDs a second.
// Knob 4: Fraction. The volume fraction of the amber liquid: amber drops in teal at 0.25, a labyrinth at 0.5, teal drops in amber at 0.75. Nothing in the flow or the dynamics changes the mean of phi. The knob adds a source, (target - mean) / 3 s (at most 0.25 a second) times (1 - phi^2) / mean(1 - phi^2), that lives only where the liquids meet, so the interfaces move and the two bulk values stay at plus and minus one. A swing from 0.25 to 0.75 passes the 50:50 mix after 2 s and is within a tenth of the end after 7 s, with phi staying between -1.01 and 1.00.

// What the field is. Two liquids that do not mix, phi = +1 (amber) and phi = -1 (teal), on a torus 64 LEDs wide and 128 tall, the panel's own grid, in the flow
// u = (psi_y, -psi_x) that they and a random stirring make between them:
//   phi_t + u.grad phi = M del^2 mu,   mu = phi^3 - phi - xi^2 del^2 phi                          (Cahn and Hilliard)
//   w_t + u.grad w = nu del^2 w - alpha w + Cap curl(-phi grad mu) + curl f,   del^2 psi = -w    (Model H, as a vorticity equation)
// xi = 1.4 LEDs, M = 6 LED^2/s, nu = 0.25 LED^2/s, alpha = 0.2/s, Cap = 4 at the opening. mu is zero on phi = tanh(x / (sqrt 2 xi)), whose surface tension is
// sigma = 2 sqrt2 xi / 3 = 1.32 and whose 10 to 90 percent width is 4.4 LEDs. f is a random force in a ring of wavenumbers round k_f, each mode an Ornstein-Uhlenbeck
// process with a correlation time of 1.2 s, so it never repeats; alpha stops the inverse cascade at a finite scale. The capillary torque is written as the curl of the
// Korteweg stress, Cap xi^2 [d_xy (phi_x^2 - phi_y^2) - (d_xx - d_yy)(phi_x phi_y)], the same torque without mu. A marker c, carried by the flow and pulled back
// with a time constant of 4 s to a pattern of seven drifting large waves, tints each liquid with the filaments of its own flow; it takes no part in the dynamics.
//
// How it is solved. Pseudo-spectral, the modes inside a circle of 18 whole waves across the width kept (3.6 LEDs, inside the two-thirds rule for the quadratic terms),
// six transforms a step with two real fields in each. The linear terms are exact (viscosity, drag, a hyperviscosity reaching 3/s at the cut, M xi^2 k^4 and a
// stabilising M (STAB - 1) k^2 for phi); the rest goes through exponential time differencing with a third-order Adams-Bashforth extrapolation, one step a frame (two or
// three when the fastest water would move more than 0.7 LED in one). The spectrum is put back to F(-k) = conj F(k) every step: without that, round-off in the imaginary
// part grows at the spinodal rate M / (4 xi^2) and ruins the mean. setup stirs the field for 5.5 s of flow time, so it opens on a picture already in motion.
//
// Checks on this file, times in panel seconds.
// 1. Mean of phi, source off: it moved by 0 in 900 s at the opening knobs (the k = 0 tendency is below 1.3e-17 a step), and by 0 with Cap 0 and no flow.
// 2. A static drop, relaxed for 40 s with no stirring. The phi = 0 contour has radius 6.8, 10.3 and 14.6 LEDs; the profile fits tanh((R - r) / a) with a = 2.12, 2.04, 2.00
//    (theory 1.98), rms error 0.031, 0.022, 0.018. The pressure inside minus outside, from the Poisson equation for the divergence of the Korteweg force, is 0.746, 0.501
//    and 0.355. Cap sigma / R is 0.744, 0.501 and 0.358 with the tension the drop has (1.257, 1.291, 1.304) and 0.781, 0.513 and 0.363 with 1.320 of a flat interface.
// 3. An ellipse with axes 17 and 8 LEDs, no stirring: aspect ratio 2.13, 2.27, 2.14, 1.87, 1.45, 1.10 at 0, 2, 5, 10, 20, 40 s; with Cap 0 (diffusion only) 2.13, 2.28,
//    2.21, 2.09, 1.86, 1.54.
// 4. Free energy mean((phi^2 - 1)^2 / 4 + xi^2 |grad phi|^2 / 2). With no stirring and no flow it did not rise once in 601 samples 0.1 s apart (0.1440 to 0.0927 in 60 s);
//    with the flow, Cap F plus the kinetic energy fell from 0.536 to 0.311 without a rise.
// 5. Coarsening from the same start at Fraction 0.5, at 10, 30, 100, 300 and 900 s (means over 20 s). L1 = 64 / <k> of the structure factor, L_I = 2 / mean|grad phi|.
//    No stirring, no flow: L1 21, 24, 29, 40, 46; L_I 11.2, 12.7, 15.4, 23.0, 27.9. No stirring, with the capillary flow: L1 22, 26, 33, 44, 53; L_I 11.8, 13.8, 17.7, 25.7, 32.5.
//    Stirred as at the opening: L1 18.5, 19.5, 21.7, 23.6, 20.9; L_I 10.4, 10.8, 11.5, 12.4, 11.3.
// 6. Step size: the relative error of phi_hat after 2 s against a run at 1/480 s is 1.2e-3, 3.1e-4, 7.9e-5 and 1.9e-5 for steps of 1/15, 1/30, 1/60 and 1/120 s. The
//    ratios 3.8, 3.9 and 4.1 are second order, because a run starts with no history. A constant right-hand side gives its exact steady state at any step.
// 7. Spectrum of the water at the opening over 300 s: 38 percent of the energy is at wavenumbers up to 3 (shells of whole waves across the width; k_f = 4.5), 53 at 4 and 5, 9 above.
// 8. Cost in Node: update 2.8 ms, draw 0.4, setup 0.4 s. One step a frame for 120 s at the opening and at three corners of the knobs (fastest |u| + |v| 7 to 18 LEDs a
//    second; a second step starts at 21).
// Not checked: a finer grid, other box shapes, the dependence of the arrested size on the Reynolds number. The flowcheck numbers are in the pull request.
//
// What it does not do. Both liquids have one density and one viscosity and nothing falls or rises: a symmetric emulsion and no more. In the flow the interface is wider than
// the equilibrium profile (the gradient of phi at its core is 0.84 of tanh's, median; 0.63 and 0.95 at the 10th and 90th percentile). A droplet that gets too small dissolves
// (Ostwald ripening) and shows as a pale smudge for a few seconds. At the weakest stirring and Fraction 0.5 the labyrinth is not quite arrested: L_I goes 14.8 to 17.5 over 900 s
// at Scale 1 and 13.5 to 18.3 at Scale -1 (means over 150 s), and a longer run was not made. The marker is carried semi-Lagrangian, so its finest filaments are smoother than
// the flow made them.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, exp, sqrt, abs, cos, sin, PI, log2, pow, log, round, tanh } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ---- tunables. Lengths are LEDs, times seconds.
const KU = TAU / W; // rad per LED of one whole-number wave across the width
const KC = 18; // retained wavenumber, in whole waves across the width: a wavelength of 3.6 LEDs
const XI = 1.4; // interface length of the free energy: the profile is tanh(x / (sqrt(2) XI))
const MOB = 6; // mobility M of phi
const STAB = 3; // linear stabilisation of the cubic term, taken out of the explicit part and put into the exact one
const CAP = 4; // capillary coefficient at Scale 0 and Stir 2: the body force is -CAP phi grad(mu)
const CAPS = 1.3; // how fast CAP follows the stirring, so that a weakly stirred tank does not coarsen to one domain
const CAPX = 0.8; // how fast CAP follows Scale below its middle, octaves per unit of the knob
const CAPY = 2.2; // and above it
const NU = 0.25; // viscosity
const ALPHA = 0.2; // linear drag on the vorticity, 1/s
const HV = 3; // extra damping at the highest retained wavenumber, 1/s, rising as the eighth power of k / KC
const TAUF = 1.2; // correlation time of the stirring, s
const KF = 4.5; // wavenumber of the stirring at Scale 0, in whole waves across the width: a wavelength of 14 LEDs
const KFX = 0.6; // how fast KF follows Scale, octaves per unit of the knob
const FAX = 1.2; // how fast the stirring grows with k_f above KF
const FA = 1.0; // rms of the stirring in velocity units, LEDs/s^2, at Stir 2: the vorticity forcing is FA k_f
const CFLMAX = 0.7; // the largest |u| + |v| times a step, LEDs

// ---- radix-2 FFT, in place on (re, im) at off, off + st, off + 2 st, ...
function plan(n) {
  const lg = log2(n), rev = new Uint16Array(n), c = new Float64Array(n >> 1), s = new Float64Array(n >> 1);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) r |= ((i >> b) & 1) << (lg - 1 - b);
    rev[i] = r;
  }
  for (let i = 0; i < n >> 1; i++) (c[i] = cos((TAU * i) / n)), (s[i] = sin((TAU * i) / n));
  return { n, rev, c, s, br: new Float64Array(n), bi: new Float64Array(n) };
}
function fft1(P, re, im, off, st, sign) {
  const { n, rev, c, s, br, bi } = P;
  for (let i = 0; i < n; i++) {
    const j = off + rev[i] * st;
    br[i] = re[j];
    bi[i] = im[j];
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let a0 = 0; a0 < n; a0 += size)
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const wr = c[t], wi = sign * s[t], a = a0 + k, b = a + half;
        const xr = br[b] * wr - bi[b] * wi, xi = br[b] * wi + bi[b] * wr;
        br[b] = br[a] - xr;
        bi[b] = bi[a] - xi;
        br[a] += xr;
        bi[a] += xi;
      }
  }
  for (let i = 0; i < n; i++) (re[off + i * st] = br[i]), (im[off + i * st] = bi[i]);
}
const COLS = [];
for (let x = 0; x < W; x++) if ((x < W / 2 ? x : W - x) <= KC) COLS.push(x);
// Only the columns with |kx| <= KC can be non-zero: going forward the y transforms run after the x ones on those
// alone, going back before them. Neither direction divides by N.
function fft2(S, re, im, sign) {
  if (sign < 0) for (let y = 0; y < H; y++) fft1(S.px, re, im, y * W, 1, sign);
  for (let t = 0; t < COLS.length; t++) fft1(S.py, re, im, COLS[t], W, sign);
  if (sign > 0) for (let y = 0; y < H; y++) fft1(S.px, re, im, y * W, 1, sign);
}

function randn() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

// ---- state
function mkF() {
  const a = () => new Float64Array(N);
  return { r: a(), i: a(), nr: a(), ni: a(), p1r: a(), p1i: a(), p2r: a(), p2i: a() };
}
function newState() {
  const F = () => new Float64Array(N);
  const S = {
    px: plan(W), py: plan(H),
    kx: F(), ky: F(), k2: F(), ik2: F(), kk: F(), neg: new Int32Array(N), keep: null,
    w: mkF(), p: mkF(), kc: new Map(),
    // work arrays: three inverse transforms and three forward ones
    ar: F(), ai: F(), br: F(), bi: F(), cr: F(), ci: F(), dr: F(), di: F(), er: F(), ei: F(), gr: F(), gi: F(),
    // physical fields at the start of the last step
    om: F(), ph: F(), phx: F(), phy: F(), uu: F(), vv: F(),
    fr: F(), fi: F(), ring: null, wring: null,
    h1: 0, h2: 0, steps: 0, vmax: 1,
    stir: 1, kf: KF, target: -0.5, src: 0, cap: CAP,
    C: new Float32Array(N), C2: new Float32Array(N), c0: new Float32Array(N), cm: [], ex: new Float64Array(8 * W * 2), ey: new Float64Array(8 * H * 2),
    lut: [new Float32Array(3 * 256), new Float32Array(3 * 256)], hueDone: -1,
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, jx = x < W / 2 ? x : x - W, jy = y < H / 2 ? y : y - H;
      S.kx[i] = KU * jx;
      S.ky[i] = (KU * jy) / 2;
      S.k2[i] = S.kx[i] * S.kx[i] + S.ky[i] * S.ky[i];
      S.ik2[i] = S.k2[i] > 0 ? 1 / S.k2[i] : 0;
      S.kk[i] = sqrt(jx * jx + (jy * jy) / 4);
      S.neg[i] = ((H - y) % H) * W + ((W - x) % W);
    }
  const keep = [];
  for (let i = 0; i < N; i++) if (S.kk[i] <= KC) keep.push(i);
  S.keep = Int32Array.from(keep);
  S.hf = Int32Array.from(keep.filter((i) => i < S.neg[i]));
  S.sf = Int32Array.from(keep.filter((i) => i === S.neg[i]));
  return S;
}

// ---- the right-hand sides of both equations
// omega_t = -div(u omega) + Cap xi^2 [d_xy (phi_x^2 - phi_y^2) - (d_xx - d_yy)(phi_x phi_y)] + forcing  (+ linear terms, exact)
// phi_t   = -u.grad phi + src - M k^2 (phi^3 - STAB phi)^  (+ linear terms, exact)
function tend(S) {
  const { keep, kx, ky, ik2, neg, ar, ai, br, bi, cr, ci, dr, di, er, ei, gr, gi, w, p } = S, nk = keep.length;
  ar.fill(0);
  ai.fill(0);
  br.fill(0);
  bi.fill(0);
  cr.fill(0);
  ci.fill(0);
  for (let t = 0; t < nk; t++) {
    const i = keep[t], wr = w.r[i], wi = w.i[i], pr = p.r[i], pi = p.i[i], q = ik2[i], a = kx[i], b = ky[i];
    ar[i] = wr - pi;
    ai[i] = wi + pr;
    br[i] = (wr * a - wi * b) * q;
    bi[i] = (wr * b + wi * a) * q;
    cr[i] = -a * pi - b * pr;
    ci[i] = a * pr - b * pi;
  }
  fft2(S, ar, ai, 1);
  fft2(S, br, bi, 1);
  fft2(S, cr, ci, 1);
  // mean of 1 - phi^2, for the volume-fraction source
  let n1 = 0;
  for (let k = 0; k < N; k++) n1 += 1 - ai[k] * ai[k];
  n1 = max(n1 / N, 0.02);
  const sr = S.src / n1;
  let vm = 0;
  for (let k = 0; k < N; k++) {
    const om = ar[k], ph = ai[k], u = br[k], v = bi[k], fx = cr[k], fy = ci[k];
    S.om[k] = om;
    S.ph[k] = ph;
    S.phx[k] = fx;
    S.phy[k] = fy;
    S.uu[k] = u;
    S.vv[k] = v;
    dr[k] = u * om;
    di[k] = v * om;
    er[k] = fx * fx - fy * fy;
    ei[k] = fx * fy;
    gr[k] = u * fx + v * fy - sr * (1 - ph * ph);
    gi[k] = ph * ph * ph;
    const sp = abs(u) + abs(v);
    if (sp > vm) vm = sp;
  }
  S.vmax = vm;
  fft2(S, dr, di, -1);
  fft2(S, er, ei, -1);
  fft2(S, gr, gi, -1);
  const iN = 1 / N, cx = S.cap * XI * XI;
  for (let t = 0; t < nk; t++) {
    const i = keep[t], j = neg[i], a = kx[i], b = ky[i];
    // u omega and v omega
    const fxr = (dr[i] + dr[j]) * 0.5, fxi = (di[i] - di[j]) * 0.5, fyr = (di[i] + di[j]) * 0.5, fyi = -(dr[i] - dr[j]) * 0.5;
    let nr = a * fxi + b * fyi, ni = -(a * fxr + b * fyr);
    // capillary torque: A = phi_x^2 - phi_y^2, B = phi_x phi_y
    const Ar = (er[i] + er[j]) * 0.5, Ai = (ei[i] - ei[j]) * 0.5, Br = (ei[i] + ei[j]) * 0.5, Bi = -(er[i] - er[j]) * 0.5;
    const c1 = -a * b, c2 = a * a - b * b;
    nr += cx * (c1 * Ar + c2 * Br);
    ni += cx * (c1 * Ai + c2 * Bi);
    w.nr[i] = nr * iN + S.fr[i];
    w.ni[i] = ni * iN + S.fi[i];
    // phi: T = u.grad phi - src, C = phi^3
    const Tr = (gr[i] + gr[j]) * 0.5, Ti = (gi[i] - gi[j]) * 0.5, Cr = (gi[i] + gi[j]) * 0.5, Ci = -(gr[i] - gr[j]) * 0.5;
    const mk = MOB * S.k2[i];
    p.nr[i] = (-Tr - mk * (Cr - STAB * p.r[i] * N)) * iN;
    p.ni[i] = (-Ti - mk * (Ci - STAB * p.i[i] * N)) * iN;
  }
}

// Exponential time differencing with a third-order Adams-Bashforth extrapolation of the nonlinear part N (Cox and Matthews, 2002; Hochbruck and
// Ostermann, 2010, both from memory): v' = L v + N  gives  v1 = e^{Lh} v + h phi1 N_n + J1 a1 + (J2 + h1 J1) a2, where a1 and a2 are the first and
// second divided differences of N over the last three steps, J1 = h^2 phi2(Lh), J2 = 2 h^3 phi3(Lh). A constant N gives v = -N / L exactly, at any
// step: the stiff modes of phi keep the right steady state, which an integrating factor does not.
function phis(z, o) {
  if (abs(z) < 0.06) {
    o[0] = 1 + z * (1 / 2 + z * (1 / 6 + z * (1 / 24 + z * (1 / 120 + z / 720))));
    o[1] = 1 / 2 + z * (1 / 6 + z * (1 / 24 + z * (1 / 120 + z * (1 / 720 + z / 5040))));
    o[2] = 1 / 6 + z * (1 / 24 + z * (1 / 120 + z * (1 / 720 + z * (1 / 5040 + z / 40320))));
  } else {
    const e = exp(z);
    o[0] = (e - 1) / z;
    o[1] = (e - 1 - z) / (z * z);
    o[2] = (e - 1 - z - (z * z) / 2) / (z * z * z);
  }
}
function coefs(S, h) {
  let K = S.kc.get(h);
  if (K) return K;
  if (S.kc.size > 5) S.kc.clear();
  const A = () => new Float64Array(N);
  K = { w: { E: A(), P1: A(), J1: A(), J2: A() }, p: { E: A(), P1: A(), J1: A(), J2: A() } };
  const o = [0, 0, 0];
  for (let t = 0; t < S.keep.length; t++) {
    const i = S.keep[t], q = S.k2[i], r = S.kk[i] / KC, r2 = r * r, r4 = r2 * r2;
    for (let f = 0; f < 2; f++) {
      const L = f ? -MOB * ((STAB - 1) * q + XI * XI * q * q) : -(NU * q + ALPHA + HV * r4 * r4), z = L * h, C = f ? K.p : K.w;
      phis(z, o);
      C.E[i] = exp(z);
      C.P1[i] = h * o[0];
      C.J1[i] = h * h * o[1];
      C.J2[i] = 2 * h * h * h * o[2];
    }
  }
  S.kc.set(h, K);
  return K;
}
function etd(S, F, C, h) {
  const h1 = S.h1, h2 = S.h2, o1 = h1 ? 1 / h1 : 0, o3 = h2 ? 1 / h2 : 0, o2 = h1 && h2 ? 1 / (h1 + h2) : 0;
  const { keep, hf, sf, neg } = S, nk = keep.length;
  for (let t = 0; t < nk; t++) {
    const i = keep[t], e = C.E[i], p1 = C.P1[i], j1 = C.J1[i], j2 = C.J2[i] + h1 * j1;
    const nr = F.nr[i], ni = F.ni[i], a1r = (nr - F.p1r[i]) * o1, a1i = (ni - F.p1i[i]) * o1;
    const a2r = (a1r - (F.p1r[i] - F.p2r[i]) * o3) * o2, a2i = (a1i - (F.p1i[i] - F.p2i[i]) * o3) * o2;
    F.r[i] = e * F.r[i] + p1 * nr + j1 * a1r + j2 * a2r;
    F.i[i] = e * F.i[i] + p1 * ni + j1 * a1i + j2 * a2i;
    F.p2r[i] = F.p1r[i];
    F.p2i[i] = F.p1i[i];
    F.p1r[i] = nr;
    F.p1i[i] = ni;
  }
  // A field that is real has a spectrum with F(-k) = conj F(k). The spinodal growth of phi would lift the tiny
  // departure from that (round-off) at 0.25 a second, so each step puts it back.
  for (let t = 0; t < hf.length; t++) {
    const i = hf[t], j = neg[i], r = 0.5 * (F.r[i] + F.r[j]), m = 0.5 * (F.i[i] - F.i[j]);
    F.r[i] = F.r[j] = r;
    F.i[i] = m;
    F.i[j] = -m;
  }
  for (let t = 0; t < sf.length; t++) F.i[sf[t]] = 0;
}

function forceStep(S, h) {
  const d = exp(-h / TAUF), s = sqrt(1 - d * d);
  const { ring, wring, neg } = S;
  for (let t = 0; t < ring.length; t++) {
    const i = ring[t], j = neg[i], a = wring[t] * S.stir * s * 0.7071;
    S.fr[i] = d * S.fr[i] + a * randn();
    S.fi[i] = d * S.fi[i] + a * randn();
    S.fr[j] = S.fr[i];
    S.fi[j] = -S.fi[i];
  }
}

function buildRing(S) {
  const half = [], wt = [];
  const dk = 1.6;
  let n = 0;
  for (let t = 0; t < S.keep.length; t++) {
    const i = S.keep[t];
    const x = i % W, y = (i / W) | 0;
    const jy = y < H / 2 ? y : y - H, jx = x < W / 2 ? x : x - W;
    const q = (S.kk[i] - S.kf) / dk, g = exp(-0.5 * q * q);
    if (g < 0.02) continue;
    n++;
    if (jy > 0 || (jy === 0 && jx > 0)) (half.push(i)), wt.push(g);
  }
  // rms of the forcing field = FA * stir: every mode (both halves) has E|F|^2 = (FA g)^2 / sum g^2
  let sg = 0;
  for (const g of wt) sg += 2 * g * g;
  S.ring = Int32Array.from(half);
  S.wring = Float64Array.from(wt.map((g) => (FA * pow(max(1, S.kf / KF), FAX) * KU * S.kf * g) / sqrt(sg)));
}

// ---- the marker. A second scalar c carried by the same flow (semi-Lagrangian, midpoint back-trace, Catmull-Rom look-up) and
// pulled slowly back to a large-scale pattern c0 that drifts, so it never goes uniform. It paints the flow inside each liquid.
const CTAU = 4; // relaxation time of c towards c0, s
function bil(f, fi, fj) {
  const i0 = floor(fi), j0 = floor(fj), a = fi - i0, b = fj - j0;
  const x0 = i0 & (W - 1), x1 = (i0 + 1) & (W - 1), r0 = (j0 & (H - 1)) * W, r1 = ((j0 + 1) & (H - 1)) * W;
  return (f[r0 + x0] * (1 - a) + f[r0 + x1] * a) * (1 - b) + (f[r1 + x0] * (1 - a) + f[r1 + x1] * a) * b;
}
function cub(f, fi, fj) {
  const i1 = floor(fi), j1 = floor(fj), tx = fi - i1, ty = fj - j1;
  const xa = (i1 - 1) & (W - 1), xb = i1 & (W - 1), xc = (i1 + 1) & (W - 1), xd = (i1 + 2) & (W - 1);
  const t2 = tx * tx, t3 = t2 * tx;
  const ax = -0.5 * t3 + t2 - 0.5 * tx, bx = 1.5 * t3 - 2.5 * t2 + 1, cx = -1.5 * t3 + 2 * t2 + 0.5 * tx, dx = 0.5 * t3 - 0.5 * t2;
  const s2 = ty * ty, s3 = s2 * ty;
  const ay = -0.5 * s3 + s2 - 0.5 * ty, by = 1.5 * s3 - 2.5 * s2 + 1, cy = -1.5 * s3 + 2 * s2 + 0.5 * ty, dy = 0.5 * s3 - 0.5 * s2;
  const ra = ((j1 - 1) & (H - 1)) * W, rb = (j1 & (H - 1)) * W, rc = ((j1 + 1) & (H - 1)) * W, rd = ((j1 + 2) & (H - 1)) * W;
  const va = ax * f[ra + xa] + bx * f[ra + xb] + cx * f[ra + xc] + dx * f[ra + xd];
  const vb = ax * f[rb + xa] + bx * f[rb + xb] + cx * f[rb + xc] + dx * f[rb + xd];
  const vc = ax * f[rc + xa] + bx * f[rc + xb] + cx * f[rc + xc] + dx * f[rc + xd];
  const vd = ax * f[rd + xa] + bx * f[rd + xb] + cx * f[rd + xc] + dx * f[rd + xd];
  const r = ay * va + by * vb + cy * vc + dy * vd;
  const p = f[rb + xb], q = f[rb + xc], w = f[rc + xb], z = f[rc + xc];
  const lo = min(min(p, q), min(w, z)), hi = max(max(p, q), max(w, z));
  return r < lo ? lo : r > hi ? hi : r;
}
// the target pattern: a few whole-number waves, each with its own slow phase drift
function patternC0(S, h) {
  const { cm, ex, ey, c0 } = S;
  for (let m = 0; m < cm.length; m++) {
    const q = cm[m];
    q.ph = (q.ph + q.fr * h) % TAU;
    for (let x = 0; x < W; x++) (ex[m * 2 * W + 2 * x] = cos((TAU * q.jx * x) / W)), (ex[m * 2 * W + 2 * x + 1] = sin((TAU * q.jx * x) / W));
    for (let y = 0; y < H; y++) (ey[m * 2 * H + 2 * y] = q.a * cos((TAU * q.jy * y) / H + q.ph)), (ey[m * 2 * H + 2 * y + 1] = q.a * sin((TAU * q.jy * y) / H + q.ph));
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let m = 0; m < cm.length; m++) v += ex[m * 2 * W + 2 * x] * ey[m * 2 * H + 2 * y] - ex[m * 2 * W + 2 * x + 1] * ey[m * 2 * H + 2 * y + 1];
      c0[y * W + x] = v;
    }
}
function advectC(S, h) {
  const { C, C2, uu, vv, c0 } = S, r = 1 - exp(-h / CTAU);
  patternC0(S, h);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = y * W + x, xm = x - 0.5 * h * uu[k], ym = y - 0.5 * h * vv[k];
      const u = bil(uu, xm, ym), v = bil(vv, xm, ym);
      const c = cub(C, x - h * u, y - h * v);
      C2[k] = c + (c0[k] - c) * r;
    }
  S.C = C2;
  S.C2 = C;
}

function step(S, h) {
  const K = coefs(S, h);
  forceStep(S, h);
  tend(S);
  advectC(S, h);
  etd(S, S.w, K.w, h);
  etd(S, S.p, K.p, h);
  S.h2 = S.h1;
  S.h1 = h;
  S.steps++;
}

// ---- one frame of flow time. The steps are short enough that the fastest water moves at most CFL of a wavelength's inverse.
function advance(S, dt) {
  const n = max(1, min(3, ceil((dt * S.vmax) / CFLMAX)));
  for (let j = 0; j < n; j++) step(S, dt / n);
}

function respin(S) {
  const { ar, ai, keep, kk } = S;
  // phi: noise filtered round wavenumber 4.5 and squeezed through tanh, shifted until its mean is the fraction asked for
  for (let k = 0; k < N; k++) (ar[k] = Math.random() * 2 - 1), (ai[k] = 0);
  fft2(S, ar, ai, -1);
  let z = 0;
  for (let t = 0; t < keep.length; t++) {
    const i = keep[t], q = kk[i] / 4.5, g = q * exp(-q * q);
    ar[i] *= g;
    ai[i] *= g;
    z += ar[i] * ar[i] + ai[i] * ai[i];
  }
  const g0 = 1 / sqrt(z);
  for (let t = 0, i; t < keep.length; t++) (i = keep[t]), (ar[i] *= g0), (ai[i] *= g0);
  const mask = new Uint8Array(N);
  for (let t = 0; t < keep.length; t++) mask[keep[t]] = 1;
  for (let i = 0; i < N; i++) if (!mask[i]) (ar[i] = 0), (ai[i] = 0);
  fft2(S, ar, ai, 1);
  const nz = Float64Array.from(ar);
  let lo = -6, hi = 6;
  for (let it = 0; it < 30; it++) {
    const b = 0.5 * (lo + hi);
    let m = 0;
    for (let k = 0; k < N; k++) m += tanh(2.2 * nz[k] + b);
    if (m / N < S.target) lo = b;
    else hi = b;
  }
  const b = 0.5 * (lo + hi);
  for (let k = 0; k < N; k++) (ar[k] = tanh(2.2 * nz[k] + b)), (ai[k] = 0);
  fft2(S, ar, ai, -1);
  for (let t = 0; t < keep.length; t++) {
    const i = keep[t];
    S.p.r[i] = ar[i] / N;
    S.p.i[i] = ai[i] / N;
  }
  S.p.i[0] = 0;
  S.w.r.fill(0);
  S.w.i.fill(0);
  S.fr.fill(0);
  S.fi.fill(0);
  for (const F of [S.w, S.p]) for (const a of [F.nr, F.ni, F.p1r, F.p1i, F.p2r, F.p2i]) a.fill(0);
  S.h1 = S.h2 = 0;
  S.vmax = 4;
  // the forcing starts at its stationary spread: an Ornstein-Uhlenbeck step of infinite length
  forceStep(S, Infinity);
  for (let t = 0; t < S.ring.length; t++) {
    const i = S.ring[t], j = S.neg[i], k2 = S.k2[i], a = 1 / (1 / TAUF + NU * k2 + ALPHA);
    S.w.r[i] = S.fr[i] * a;
    S.w.i[i] = S.fi[i] * a;
    S.w.r[j] = S.w.r[i];
    S.w.i[j] = -S.w.i[i];
  }
  for (let k = 0; k < N; k++) S.C[k] = 0;
  patternC0(S, 0);
  for (let k = 0; k < N; k++) S.C[k] = S.c0[k];
  // five and a half seconds of flow time in steps of 1/20 s
  for (let n = 0; n < 110; n++) advance(S, 0.05);
}

export function setup(params) {
  const S = (params.s = newState());
  S.stir = 1;
  S.kf = KF;
  buildRing(S);
  S.cm = [];
  for (let m = 0; m < 7; m++) {
    let jx, jy, kk;
    do {
      jx = round((Math.random() * 2 - 1) * 5);
      jy = round((Math.random() * 2 - 1) * 10);
      kk = sqrt(jx * jx + (jy * jy) / 4);
    } while (kk < 1.4 || kk > 5.5);
    S.cm.push({ jx, jy, ph: Math.random() * TAU, fr: TAU * (0.015 + 0.03 * Math.random()), a: 0.9 / sqrt(7) * (0.7 + 0.6 * Math.random()) * 0.9 });
  }
  respin(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.25];
  const h = cl(dt || 0, 0, 0.1);
  if (h <= 0) return;
  S.stir = pow(cl(k[1], 0.8, 3.2) / 2, 0.75);
  const sc = cl(k[2], -1, 1);
  S.cap = CAP * pow(2, (sc < 0 ? CAPX : CAPY) * sc) * pow(S.stir, CAPS);
  const kf = KF * pow(2, -KFX * sc);
  if (abs(kf - S.kf) > 0.02) {
    S.kf += (kf - S.kf) * (1 - exp(-3 * h));
    buildRing(S);
  }
  S.target = 2 * cl(k[3], 0.25, 0.75) - 1;
  S.src = cl((S.target - S.p.r[0]) / 3, -0.25, 0.25);
  const hue = cl(k[0], 0, 1) * 360;
  if (abs(hue - S.hueDone) > 0.5) buildLut(S, hue);
  advance(S, h);
  // never reached in the runs below: if a value ever went bad, start the field over rather than stay dark
  if (!isFinite(S.p.r[0] + S.w.r[1] + S.vmax)) setup(params);
}

// ---- colour. OKLab (Ottosson 2020, constants from memory): each liquid has its own run of lightness and hue along the marker c.
function lin(L, a, b, o) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  o[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  o[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  o[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const GAM = new Float32Array(4097);
for (let k = 0; k <= 4096; k++) {
  const x = k / 4096;
  GAM[k] = 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
}
const gam = (x) => GAM[x <= 0 ? 0 : x >= 1 ? 4096 : (x * 4096 + 0.5) | 0];
const TMP = [0, 0, 0];
const LIQ = [
  // L, chroma, hue (degrees), how far the marker moves L and the hue
  [0.8, 0.15, 78, 0.15, 24],
  [0.58, 0.1, 200, 0.2, 28],
];
function buildLut(S, shift) {
  for (let q = 0; q < 2; q++) {
    const [L0, C0, H0, dL, dH] = LIQ[q], lut = S.lut[q];
    for (let n = 0; n < 256; n++) {
      const c = (n / 255) * 2 - 1;
      const hd = H0 + shift + dH * c;
      let dh = ((hd - 60) % 360 + 360) % 360;
      if (dh > 180) dh -= 360;
      const warm = exp(-(dh * dh) / 3600);
      const L = L0 + dL * c + (q ? 0.2 * warm : 0.04 * warm);
      let C = C0;
      const h = (hd * PI) / 180;
      for (let it = 0; it < 8; it++) {
        lin(L, C * cos(h), C * sin(h), TMP);
        if (TMP[0] >= -0.002 && TMP[1] >= -0.002 && TMP[2] >= -0.002 && TMP[0] <= 1.002 && TMP[1] <= 1.002 && TMP[2] <= 1.002) break;
        C *= 0.9;
      }
      lut[3 * n] = L;
      lut[3 * n + 1] = C * cos(h);
      lut[3 * n + 2] = C * sin(h);
    }
  }
  S.hueDone = shift;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.steps) return;
  const o = [0, 0, 0], { ph, C, lut } = S, A = lut[0], B = lut[1];
  for (let k = 0; k < N; k++) {
    const f = cl(ph[k], -1, 1), t = sm(-0.5, 0.5, f), gx = S.phx[k], gy = S.phy[k];
    // an interface in equilibrium has |grad phi| sqrt(2) xi = 1 - phi^2; a blob of half-mixed liquid does not, and does not glow
    const e = min(1 - f * f, sqrt(gx * gx + gy * gy) * 2.1 * XI), g = e * e * e * e * 0.92;
    const n = 3 * round((cl(C[k], -1, 1) * 0.5 + 0.5) * 255);
    let L = B[n] + (A[n] - B[n]) * t, a = B[n + 1] + (A[n + 1] - B[n + 1]) * t, b = B[n + 2] + (A[n + 2] - B[n + 2]) * t;
    L += g * (0.97 - L);
    a *= 1 - 0.85 * g;
    b *= 1 - 0.85 * g;
    lin(L, a, b, o);
    display.setPixel(k % W, (k / W) | 0, gam(o[0]), gam(o[1]), gam(o[2]));
  }
}
