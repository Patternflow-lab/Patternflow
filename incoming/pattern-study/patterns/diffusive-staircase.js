// ===== Patternflow pattern =====
// Title:   Diffusive Staircase
// Family:  ocean
// Idea:    Cold fresh water over warm salty water is stable in density, yet heat leaks across a thin interface faster than salt (a hundred times faster in the sea, ten here), so the interface stays sharp and drives convection on both sides, and the stack settles into a thermohaline staircase, solved as two-dimensional double-diffusive flow in a box with fixed background gradients and drawn as four well-mixed layers, each dyed by the salt it holds, deep blue at the top, teal, magenta, coral at the bottom, a pale seam on every interface, plumes of one layer pushing up into the next as domes, and from time to time two layers sliding into one and a new interface freezing in.
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Double-diffusive convection of the diffusive kind: Turner (1965, from memory) for the staircase under cold fresh water over warm salty and its flux ratio, Baines and Gill (1969, from memory) for the oscillatory instability, which exists for 1 < R_rho < (Pr + 1) / (Pr + tau); layer formation and merging in a gradient-periodic box, in which T', S' and the stream function are periodic about constant background gradients, after Radko (2003, J. Fluid Mech. 497, from memory); the exact 3 by 3 propagator per Fourier mode, integrating-factor Adams-Bashforth stepping (Lawson, 1967, from memory) and the two-thirds rule (Orszag, 1971, from memory) as in Salt Fingers; colour in OKLab (Bjorn Ottosson, 2020, from memory), pattern round 124
// Round:   126
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.5..6, Layers=-1..1, Ratio=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the Oklab hue of every stop of the dye ramp, so one full turn comes back. At 0 the freshest water at the top is deep blue (hue 262, lightness 0.40), then teal (215), magenta (335) and coral at the bottom (hue 15, lightness 0.62). Dark orange, olive and brown are mud on the panel: where a color's hue falls between 25 and 150 degrees its lightness is lifted by up to 0.16, which makes it peach, gold or lime (0.25 gives gold at the bottom over a mauve top, 0.5 peach over green, 0.75 green over blue and violet).
// Knob 2: Pace. Model time units per panel second, Pace times h / 2 (h is the LED pitch in d, below): 0.5 gives 0.53, the opening 2 gives 2.1, 6 gives 4.1 because a frame takes at most 8 steps (the step is 0.016 to 0.023 time units with the plumes at 10 to 15 d per time unit). The rms vertical speed of the water is 2.7 d per time unit, so 2.7 LEDs a second (5 rows a second up the panel) at the opening. Cost per frame in Node, mean over 90 s with drawing: 1.2 ms at 0.5, 3.3 at 2 and 4.5 at 6, and the first frame takes the 8 time units of spin-up from the seeded stack, 0.4 to 0.6 s in Node.
// Knob 3: Layers. How tall the box is in layers of 32 d: h = 32 L / 64 d per LED for L from 3.0 at -1 through 4.2 at the opening to 4.4 at 1, so 1.5, 2.1 and 2.2 d. Below L = 3.8 (the knob at -0.33) the stack seeds as three layers (32 to 40 d thick), above as four (30 to 35 d). With the knob moving, a stack with fewer layers than it asks for gets a new interface in the thickest layer wherever one is 58 d or more, and one with more loses its weakest, eased in over 25 time units. A layer is 43 rows tall at three layers and 32 at four.
// Knob 4: Ratio. R_rho = beta |S_z| / (alpha |T_z|), the stabilising salt gradient over the destabilising heat gradient, 1.5 times 1.18 to the knob: 1.27 at -1, 1.51 at the opening 0.06 and 1.77 at 1. It enters only the buoyancy. The interface is 7.9 to 8.4 d thick at all three (3.8 to 4.0 LEDs at half height, so 8 rows), its peak gradient 4 to 5 times the background. At -1 the layers are lively: plumes cross the interface as domes, the rms w inside a layer is 3.6 and the first merge came at about 1000 time units. At 1 they stay apart: the rms w is 3.4 and four layers kept all four through 1500 time units at 1.7 (1800 at the opening).

// What the field is. Perturbations T', s' and a stream function psi (u = -psi_z, w = psi_x, x across, z up) about linear background gradients that fall with
// height, in the units d = (nu kappa_T / (g alpha |T_z|))^(1/4), d^2 / kappa_T, with T in |T_z| d and the salt as s = (beta / alpha) S / R_rho in the same unit, so
// both backgrounds have slope -1 and the density ratio sits in the buoyancy alone:
//   T_t + J(psi, T') - w = lap T',   s_t + J(psi, s') - w = tau lap s',   zeta_t + J(psi, zeta) = Pr (T' - R_rho s')_x + Pr lap zeta,   zeta = lap psi.
// Pr = 7, tau = 0.1 (0.01 in the sea; at 0.1 a salt interface is 8 d thick, which 64 modes resolve), R_rho from knob 4. The box is 64 h by 64 h: 64 by 64 modes, the
// 2/3 rule (|m|, |n| <= 21), and the panel's 128 rows are the same box stretched by two in z by zero-padding the spectrum, so a model cell is two rows. The solver
// is Salt Fingers' with the sign of both background gradients turned: the linear terms of (w, T, s) in each mode are one 3 by 3 matrix, exponentiated exactly,
// the advective terms go through Adams-Bashforth 3 on top of it with the step from a ladder 0.004 2^(l/2) that keeps k_max (max|u| + max|w|) dt under 0.6, s gets a
// grid-scale damping 3 (kk)^8 per time unit, and conjugate symmetry is restored every step. The modes with no x variation are the layer profiles of T' and s'.
//
// The stack. The slope of s' in a layer is +1 and a drop at each interface, so the x-mean of s' is a sawtooth, and G = 1 - ds'/dz is 0 in a mixed layer and
// peaks at an interface. What 64 by 64 modes and 15 minutes allow, measured with this solver in its first form (the salt in its own unit S = R_rho s, the same equations), without the keeper below:
// - Noise alone does not make the picture. At R_rho = 1.1 (the oscillatory instability exists below (Pr + 1) / (Pr + tau) = 1.127) layers form after 350 to 500
//   time units, 2 to 4 interfaces, but they end as two turbulent layers with rms s' 30 and w up to 70 d per time unit, thick interfaces and the step at its floor of
//   0.004. At 1.12 the box convects weakly (rms s' 2 after 1500 time units) with no layers, and at 1.13 it decays. So the stack is seeded: the first frame is a
//   sawtooth of 3 or 4 layers with the noise of an 8 time unit spin-up.
// - A seeded stack is a finite-amplitude state, and it needs thick layers. Four layers of 32 d (h = 2) stood 700 to 1500 time units at R_rho 1.2 to 1.7, four of 30 d
//   stood 800 at 1.5, but four of 27 d (h = 1.7) had stopped convecting by 700 time units, six of 21 d at 1.25 and 1.5 within 200 to 600, five of 25.6 d at 2 by 400, and four of 32 d
//   at 2 and 3 by 600. 40 d layers (h = 2.5) merged by 700 and 48 d layers (h = 3) went numerically unstable. Five layers of 32 d in the 64 cells (h = 2.5) keep only a
//   weak interface (G 2 to 2.5). So the panel holds three or four layers, not eight.
// - Layers merge, and nothing makes new ones. Four layers of 32 d at R_rho 1.5 went to three at 1400 time units, two at 2000 and one at 3600, and the one layer kept
//   its interface for good (s' rms 50). At 1.2 the first merge came at 900, at 1.7 none in 1500, and a stack of three at 1.6 kept all three for 1500. Pulling the x-mean
//   of T' and s' back toward the background at 0.0005 to 0.001 per time unit kept the layers and merged them anyway, and at 0.002 killed them.
// The keeper (keep, twice a panel second) is the part that is not the model. It reads G from the x-means, and when a stack has fewer interfaces than knob 3 asks
// for for 12 panel seconds and one layer is 58 d or more it eases in a new interface in the middle of the thickest, +d on the lower half of that layer and -d on the
// upper (d a quarter of its thickness), by pulling the mean modes of T' and s' toward that profile at 0.15 per time unit for 25 time units. A stack with more than the
// knob asks for loses its weakest interface the same way after 3 panel seconds, and one with none, or with no convection (rms w under 0.4), is seeded again. Only
// the x-means are touched, the model does the rest. In 900 s of panel time it fired 0 times at the opening and at the minimum place, 11 times at Ratio -1 with Pace 6 (3600 time units) and 7 times at the
// maximum place (4500 time units).
//
// What was checked, with the file's own step:
// - Linear growth. A single mode at amplitude 1e-9 grows (or decays) at the real part of the root of (s + Pr k2)(s + k2)(s + tau k2) + Pr c [R (s + k2) - (s + tau k2)] = 0
//   with the largest real part (c = kx^2 / k2, the grid damping included), a pair with Im s about 0.8 to 1.9. Measured against it, in per time unit: R_rho 1.05 mode (4,0) 0.07237 against
//   0.07244, 1.1 (3,1) 0.028695 against 0.028694, 1.1 (5,2) 0.028406 against 0.028369, 1.12 (6,0) -0.037083 against -0.037105, 1.14 (4,0) -0.025703 against -0.025683, 1.3
//   (3,1) -0.049263 against -0.049268 and 1.5 (2,0) -0.02518 against -0.02554. The boundary 1.127 is the k -> 0 value: at 1.12 the mode with k = 0.39 d^-1 decays.
// - Variance budget. Over 6 to 9 time units of a developed stack, the change of <T'^2> / 2 and <s'^2> / 2 against the integral of <w T'> - <|grad T'|^2> and
//   <w s'> - tau <|grad s'|^2> - damping, at the file's own steps: -2.5173 against -2.5170 and -1.6320 against -1.6319 (R_rho 1.5, four layers), -1.0696 against -1.0659 and
//   -1.0621 against -1.0575 (1.3, three layers). The advection conserves both variances to the step's order and the exchange with w has the sign of the equations above.
// - Flux ratio. R_rho <w s'> / <w T'> = beta F_S / (alpha F_T) in the layer interiors (G < 0.4, 200 time units) is 0.37, 0.38 and 0.38 at R_rho 1.3, 1.5 and 1.7 with four layers
//   and 0.37 with three at 1.5. The laboratory and the ocean give 0.1 to 0.3 (from memory) at tau = 0.01, so tau = 0.1 runs the salt leak above the observed range, and
//   the interface is 8 d thick at every R_rho: width at half peak 3.8 to 4.0 cells (7.9 to 8.4 d at h = 2.1, 6.1 d at 1.6), peak G 4.2 to 4.7 (6.0 at h = 1.6).
// - Staying alive. Over 900 s of panel time the opening knob place, the minimum, the maximum and R_rho 1.27 at Pace 6 ran without a reset, a blow-up or a dead stack; a walk
//   of the four knobs to a random place every 20 s for 600 s did the same (mean 5.9 ms a frame, no state restarted). The opening place held four layers until 840 s, when one merge came (1770 time units), and the minimum held three throughout; at
//   Ratio -1 and Pace 6 the count went between 3 and 4 eleven times, at the maximum place between 4 and 3 or 2. The largest w in any of them was 22 d per time unit and the
//   smallest rms w 2.0.
//
// The picture. The colour is the salt of the layer: a = mean(s')/(64 h) + 1 - z/(128 rows), 0 at the fresh top and 1 at the salty bottom, which in a stack is one value
// per layer, plus 6 times the local anomaly of s' over the x-mean, so a plume carries the dye of the layer it came from into the next as a dome. The ramp runs deep blue,
// teal, magenta, coral; the lightness rises by up to 0.22 with the anomaly (rms over about 8 s, 1.8 times it for full), and a pixel where G = 1 - ds'/dz passes 1.8 to 4.5 is
// pulled toward white by up to 0.7, a pale seam on every interface and on the sheared fronts of the domes.

const LW = 6, W = 1 << LW, H = W, N = W * H, HD = 2 * H, ND = W * HD;
const { floor, ceil, sqrt, sin, cos, exp, abs, min, max, pow, PI } = Math;
const TAU2 = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const IM = floor(W / 3), JM = floor(H / 3); // modes kept: |m| <= IM along x, |n| <= JM along z (the two-thirds rule)

// ---- radix-2 FFT, rows contiguous, columns by butterflies across rows -----------------------------
function plan(n) {
  const lg = Math.round(Math.log2(n)), rev = new Uint16Array(n), c = new Float64Array(n / 2), s = new Float64Array(n / 2);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) if (i & (1 << b)) r |= 1 << (lg - 1 - b);
    rev[i] = r;
  }
  for (let i = 0; i < n / 2; i++) (c[i] = cos((TAU2 * i) / n)), (s[i] = -sin((TAU2 * i) / n));
  return { n, rev, c, s };
}
const PW = plan(W), PD = plan(HD);
function fftRows(re, im, nrows, inv) {
  const { n, rev, c, s } = PW, sg = inv ? -1 : 1;
  for (let y = 0; y < nrows; y++) {
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
function fftCols(re, im, p, inv) {
  const { n, rev, c, s } = p, sg = inv ? -1 : 1;
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
  fftRows(re, im, H, inv);
  fftCols(re, im, PW, inv);
}

// ---- the model ------------------------------------------------------------------------------------
// Perturbations T', s' and the stream function psi about linear background gradients that fall with height (cold fresh water on top), in the units
// d = (nu kappa_T / (g alpha |T_z|))^(1/4), d^2 / kappa_T, with T in |T_z| d and the salt as s = (beta / alpha) S / R_rho in the same unit, so
// both backgrounds have slope -1 and the density ratio R_rho shows up in the buoyancy alone. The state of a Fourier mode is (w, T, s), w = psi_x.
const PR = 7; // Prandtl number nu / kappa_T
const TAUD = 0.1; // diffusivity ratio kappa_S / kappa_T
const HYP_R = 3, HYP_P = 8; // grid-scale damping on s: rate HYP_R (kk)^HYP_P per time unit, kk the mode radius in units of the cut
const DT0 = 0.004, NLV = 11; // time step ladder: DT0 2^(l/2)
const CFL_UP = 0.45, CFL_OK = 0.6, CFL_DN = 0.8;

// kept modes
const NZ = [], ZL = [];
for (let j = 0; j < H; j++)
  for (let i = 0; i < W; i++) {
    const ni = i < W / 2 ? i : i - W, nj = j < H / 2 ? j : j - H;
    if (abs(ni) <= IM && abs(nj) <= JM && (ni || nj)) (ni ? NZ : ZL).push(j * W + i);
  }
const ALL = Int32Array.from([...NZ, ...ZL]), NN = NZ.length, NA = ALL.length;
const MIR = new Int32Array(N), QOFF = new Int32Array(N), K0X = new Float64Array(N), K0Z = new Float64Array(N);
for (let j = 0; j < H; j++)
  for (let i = 0; i < W; i++) {
    const p = j * W + i, ni = i < W / 2 ? i : i - W, nj = j < H / 2 ? j : j - H;
    MIR[p] = ((H - j) % H) * W + ((W - i) % W);
    QOFF[p] = (min(abs(ni), IM) * (JM + 1) + min(abs(nj), JM)) * 9;
    K0X[p] = (TAU2 * ni) / W;
    K0Z[p] = (TAU2 * nj) / H;
  }
const NQ = (IM + 1) * (JM + 1);

// 3x3 matrix exponential, scaling and squaring
const mTA = new Float64Array(9), mTB = new Float64Array(9), mTC = new Float64Array(9), mTD = new Float64Array(9);
function mm(a, b, o) {
  const a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7], a8 = a[8];
  const b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3], b4 = b[4], b5 = b[5], b6 = b[6], b7 = b[7], b8 = b[8];
  o[0] = a0 * b0 + a1 * b3 + a2 * b6;
  o[1] = a0 * b1 + a1 * b4 + a2 * b7;
  o[2] = a0 * b2 + a1 * b5 + a2 * b8;
  o[3] = a3 * b0 + a4 * b3 + a5 * b6;
  o[4] = a3 * b1 + a4 * b4 + a5 * b7;
  o[5] = a3 * b2 + a4 * b5 + a5 * b8;
  o[6] = a6 * b0 + a7 * b3 + a8 * b6;
  o[7] = a6 * b1 + a7 * b4 + a8 * b7;
  o[8] = a6 * b2 + a7 * b5 + a8 * b8;
}
function expm3(M, t, out) {
  let nrm = 0;
  for (let i = 0; i < 3; i++) nrm = max(nrm, abs(M[3 * i]) + abs(M[3 * i + 1]) + abs(M[3 * i + 2]));
  nrm *= t;
  const sq = nrm > 0.5 ? ceil(Math.log2(nrm / 0.5)) : 0, f = t / pow(2, sq);
  for (let i = 0; i < 9; i++) (mTA[i] = M[i] * f), (mTB[i] = (i % 4 ? 0 : 1) + mTA[i]), (mTC[i] = mTA[i]);
  for (let n = 2; n <= 12; n++) {
    mm(mTC, mTA, mTD);
    for (let i = 0; i < 9; i++) (mTC[i] = mTD[i] / n), (mTB[i] += mTC[i]);
  }
  for (let s = 0; s < sq; s++) {
    mm(mTB, mTB, mTD);
    for (let i = 0; i < 9; i++) mTB[i] = mTD[i];
  }
  for (let i = 0; i < 9; i++) out[i] = mTB[i];
}

const mkF = () => ({ wr: new Float64Array(N), wi: new Float64Array(N), tr: new Float64Array(N), ti: new Float64Array(N), sr: new Float64Array(N), si: new Float64Array(N) });

function makeState() {
  const S = {
    t: 0, acc: 0, R: 1.4, h: 2, ver: 0, bR: 0, bh: 0, lv: 5, ord: 0, up: 0, umax: 0, wmax: 0, wrms: 5, ready: false,
    X: mkF(), N0: mkF(), H1: mkF(), H2: mkF(),
    ar: new Float64Array(N), ai: new Float64Array(N), br: new Float64Array(N), bi: new Float64Array(N), cr: new Float64Array(N), ci: new Float64Array(N),
    E: [], Ever: new Int32Array(NLV).fill(-1),
    pr: new Float64Array(ND), pi: new Float64Array(ND), hue: 0, sref: 0, Rt: 1.4, ht: 2, lt: 4, fk: 3, dirty: false, lutHue: -1,
    SS: new Float32Array(ND), mean: new Float32Array(HD), nz: null, cool: 0, next: 0, dead: 0, nl: 0, low: 0, high: 0, nt: 4, ev: [0, 0, 0],
  };
  for (let l = 0; l < NLV; l++) S.E.push(new Float64Array(NQ * 9));
  return S;
}

// The propagators of one time step for every |m|, |n|: exp(M dt) with M the 3 x 3 matrix of the linear terms of (w, T, s),
//   w_t = -Pr k2 w + Pr c (T - R s),  T_t = -k2 T + w,  s_t = -(tau k2 + hyper) s + w,
// and for the modes with no x variation just the diagonal.
function tables(S, l) {
  if (S.Ever[l] === S.ver) return S.E[l];
  S.Ever[l] = S.ver;
  const E = S.E[l], dt = DT0 * pow(2, l / 2), ih2 = 1 / (S.h * S.h), M = new Float64Array(9), out = new Float64Array(9);
  for (let a = 0; a <= IM; a++)
    for (let b = 0; b <= JM; b++) {
      const q = (a * (JM + 1) + b) * 9, kx2 = pow((TAU2 * a) / W, 2) * ih2, kz2 = pow((TAU2 * b) / H, 2) * ih2, k2 = kx2 + kz2;
      const kk = sqrt((a / IM) * (a / IM) + (b / JM) * (b / JM)), rs = TAUD * k2 + HYP_R * pow(kk, HYP_P);
      if (k2 === 0) {
        for (let i = 0; i < 9; i++) E[q + i] = i % 4 ? 0 : 1;
        continue;
      }
      M.fill(0);
      M[0] = -PR * k2;
      M[4] = -k2;
      M[8] = -rs;
      if (a) {
        const c = kx2 / k2;
        M[1] = PR * c;
        M[2] = -PR * c * S.R;
        M[3] = 1;
        M[6] = 1;
      }
      expm3(M, dt, out);
      for (let i = 0; i < 9; i++) E[q + i] = out[i];
    }
  return E;
}

// The advective terms: N_T = -div(u T), N_s = -div(u s), and for the vorticity (d_xz)(u^2 - w^2) + (d_zz - d_xx)(u w), u = -psi_z, w = psi_x.
function evalN(S, O) {
  const { X, ar, ai, br, bi, cr, ci } = S, ih = 1 / S.h;
  ar.fill(0);
  ai.fill(0);
  br.fill(0);
  bi.fill(0);
  for (let m = 0; m < NN; m++) {
    const p = ALL[m], f = -K0Z[p] / K0X[p], wr = X.wr[p], wi = X.wi[p];
    ar[p] = f * wr - wi;
    ai[p] = f * wi + wr;
    br[p] = X.tr[p] - X.si[p];
    bi[p] = X.ti[p] + X.sr[p];
  }
  for (let m = NN; m < NA; m++) {
    const p = ALL[m], kz = K0Z[p] * ih;
    ar[p] = kz * X.wi[p];
    ai[p] = -kz * X.wr[p];
    br[p] = X.tr[p] - X.si[p];
    bi[p] = X.ti[p] + X.sr[p];
  }
  fft2(ar, ai, true);
  fft2(br, bi, true);
  let um = 0, wm = 0, ww = 0;
  for (let p = 0; p < N; p++) {
    const u = ar[p], w = ai[p], T = br[p], Sv = bi[p];
    if (u > um) um = u;
    else if (-u > um) um = -u;
    if (w > wm) wm = w;
    else if (-w > wm) wm = -w;
    ww += w * w;
    ar[p] = u * T;
    ai[p] = w * T;
    br[p] = u * Sv;
    bi[p] = w * Sv;
    cr[p] = u * u - w * w;
    ci[p] = u * w;
  }
  S.umax = um;
  S.wmax = wm;
  S.wrms = sqrt(ww / N);
  fft2(ar, ai, false);
  fft2(br, bi, false);
  fft2(cr, ci, false);
  const s1 = ih / N;
  for (let m = 0; m < NA; m++) {
    const p = ALL[m], q = MIR[p], kx = K0X[p], kz = K0Z[p];
    let a = ar[p], b = ai[p], c = ar[q], d = ai[q];
    const uTr = a + c, uTi = b - d, wTr = b + d, wTi = c - a;
    a = br[p];
    b = bi[p];
    c = br[q];
    d = bi[q];
    const uSr = a + c, uSi = b - d, wSr = b + d, wSi = c - a;
    a = cr[p];
    b = ci[p];
    c = cr[q];
    d = ci[q];
    const Pr_ = a + c, Pi_ = b - d, Qr = b + d, Qi = c - a;
    // each extracted part carries a factor 2, folded into the scales below (0.5 s1, 0.5 s2)
    O.tr[p] = 0.5 * s1 * (kx * uTi + kz * wTi);
    O.ti[p] = -0.5 * s1 * (kx * uTr + kz * wTr);
    O.sr[p] = 0.5 * s1 * (kx * uSi + kz * wSi);
    O.si[p] = -0.5 * s1 * (kx * uSr + kz * wSr);
    if (m < NN) {
      const k2 = kx * kx + kz * kz, g = 0.5 * s1 * kx / k2;
      // N_zeta = (1/h^2) [ -kx kz F(P2) + (kx^2 - kz^2) F(Q) ] ; w_t = -i kx / k2 N_zeta
      const zr = -kx * kz * Pr_ + (kx * kx - kz * kz) * Qr, zi = -kx * kz * Pi_ + (kx * kx - kz * kz) * Qi;
      O.wr[p] = g * zi;
      O.wi[p] = -g * zr;
    } else {
      O.wr[p] = (0.5 * Qr) / N;
      O.wi[p] = (0.5 * Qi) / N;
    }
  }
}

function symmetrize(X) {
  for (let m = 0; m < NA; m++) {
    const p = ALL[m], q = MIR[p];
    if (q < p) continue;
    let a = X.wr[p], b = X.wi[p], c = X.wr[q], d = X.wi[q], mr = 0.5 * (a + c), mi = 0.5 * (b - d);
    (X.wr[p] = mr), (X.wi[p] = mi), (X.wr[q] = mr), (X.wi[q] = -mi);
    (a = X.tr[p]), (b = X.ti[p]), (c = X.tr[q]), (d = X.ti[q]), (mr = 0.5 * (a + c)), (mi = 0.5 * (b - d));
    (X.tr[p] = mr), (X.ti[p] = mi), (X.tr[q] = mr), (X.ti[q] = -mi);
    (a = X.sr[p]), (b = X.si[p]), (c = X.sr[q]), (d = X.si[q]), (mr = 0.5 * (a + c)), (mi = 0.5 * (b - d));
    (X.sr[p] = mr), (X.si[p] = mi), (X.sr[q] = mr), (X.si[q] = -mi);
  }
}

// One step of the Adams-Bashforth integrating-factor scheme (Lawson): X' = E (X + dt (c0 N + c1 H1' + c2 H2')), where the histories are kept
// already carried forward by E. Order 1 and 2 at the start and after a change of step.
function step(S) {
  evalN(S, S.N0);
  const om = (2.06 / S.h) * (S.umax + S.wmax);
  let l = S.lv;
  if (DT0 * pow(2, l / 2) * om > CFL_DN) {
    while (l > 0 && DT0 * pow(2, l / 2) * om > CFL_OK) l--;
    S.ord = 0;
    S.up = 0;
  } else if (l < NLV - 1 && DT0 * pow(2, (l + 1) / 2) * om < CFL_UP) {
    if (++S.up > 40) (l++, (S.ord = 0), (S.up = 0));
  } else S.up = 0;
  S.lv = l;
  const dt = DT0 * pow(2, l / 2), E = tables(S, l), { X, N0, H1, H2 } = S;
  const c0 = S.ord === 0 ? 1 : S.ord === 1 ? 1.5 : 23 / 12, c1 = S.ord === 0 ? 0 : S.ord === 1 ? -0.5 : -16 / 12, c2 = S.ord >= 2 ? 5 / 12 : 0;
  for (let m = 0; m < NA; m++) {
    const p = ALL[m], q = QOFF[p];
    const e0 = E[q], e1 = E[q + 1], e2 = E[q + 2], e3 = E[q + 3], e4 = E[q + 4], e5 = E[q + 5], e6 = E[q + 6], e7 = E[q + 7], e8 = E[q + 8];
    let a = X.wr[p] + dt * (c0 * N0.wr[p] + c1 * H1.wr[p] + c2 * H2.wr[p]);
    let b = X.tr[p] + dt * (c0 * N0.tr[p] + c1 * H1.tr[p] + c2 * H2.tr[p]);
    let c = X.sr[p] + dt * (c0 * N0.sr[p] + c1 * H1.sr[p] + c2 * H2.sr[p]);
    X.wr[p] = e0 * a + e1 * b + e2 * c;
    X.tr[p] = e3 * a + e4 * b + e5 * c;
    X.sr[p] = e6 * a + e7 * b + e8 * c;
    a = X.wi[p] + dt * (c0 * N0.wi[p] + c1 * H1.wi[p] + c2 * H2.wi[p]);
    b = X.ti[p] + dt * (c0 * N0.ti[p] + c1 * H1.ti[p] + c2 * H2.ti[p]);
    c = X.si[p] + dt * (c0 * N0.si[p] + c1 * H1.si[p] + c2 * H2.si[p]);
    X.wi[p] = e0 * a + e1 * b + e2 * c;
    X.ti[p] = e3 * a + e4 * b + e5 * c;
    X.si[p] = e6 * a + e7 * b + e8 * c;
    // histories carried forward: H2 <- E H1, H1 <- E N0
    a = H1.wr[p];
    b = H1.tr[p];
    c = H1.sr[p];
    H2.wr[p] = e0 * a + e1 * b + e2 * c;
    H2.tr[p] = e3 * a + e4 * b + e5 * c;
    H2.sr[p] = e6 * a + e7 * b + e8 * c;
    a = H1.wi[p];
    b = H1.ti[p];
    c = H1.si[p];
    H2.wi[p] = e0 * a + e1 * b + e2 * c;
    H2.ti[p] = e3 * a + e4 * b + e5 * c;
    H2.si[p] = e6 * a + e7 * b + e8 * c;
    a = N0.wr[p];
    b = N0.tr[p];
    c = N0.sr[p];
    H1.wr[p] = e0 * a + e1 * b + e2 * c;
    H1.tr[p] = e3 * a + e4 * b + e5 * c;
    H1.sr[p] = e6 * a + e7 * b + e8 * c;
    a = N0.wi[p];
    b = N0.ti[p];
    c = N0.si[p];
    H1.wi[p] = e0 * a + e1 * b + e2 * c;
    H1.ti[p] = e3 * a + e4 * b + e5 * c;
    H1.si[p] = e6 * a + e7 * b + e8 * c;
  }
  symmetrize(X);
  if (S.nz) nudge(S, dt);
  if (S.ord < 2) S.ord++;
  S.t += dt;
  return dt;
}

// ---- the mean profile: layers, interfaces, and what is done about them ----------------------------
// The x-averages of T' and s' are the modes with no x variation, ZL. Their profile along z (64 values, in d) is a sawtooth when layers stand:
// slope +1 inside a layer, where the background is cancelled, and a drop at each interface.
const NJ = 2 * JM + 1;
const CZ = new Float64Array(NJ * H), SZ = new Float64Array(NJ * H);
for (let n = -JM; n <= JM; n++)
  for (let z = 0; z < H; z++) {
    CZ[(n + JM) * H + z] = cos((TAU2 * n * z) / H);
    SZ[(n + JM) * H + z] = sin((TAU2 * n * z) / H);
  }
const modeAt = (n) => ((n + H) % H) * W; // the index of the mode (0, n)
// A real profile f[z] (cells) to the coefficients of the modes (0, n), smoothed by a gaussian of width sg cells. Returns [re, im] of length NJ.
function profModes(f, sg) {
  const re = new Float64Array(NJ), im = new Float64Array(NJ);
  for (let n = -JM; n <= JM; n++) {
    if (!n) continue;
    let cr = 0, ci = 0;
    for (let z = 0; z < H; z++) {
      cr += f[z] * CZ[(n + JM) * H + z];
      ci -= f[z] * SZ[(n + JM) * H + z];
    }
    const d = exp(-0.5 * pow((TAU2 * n * sg) / H, 2)) / H;
    re[n + JM] = cr * d;
    im[n + JM] = ci * d;
  }
  return [re, im];
}
// The profile of s' (which = 1) or T' (0) along z, from the state.
function profile(S, which, out) {
  const X = S.X, xr = which ? X.sr : X.tr, xi = which ? X.si : X.ti;
  for (let z = 0; z < H; z++) out[z] = 0;
  for (let n = -JM; n <= JM; n++) {
    if (!n) continue;
    const p = modeAt(n), a = xr[p], b = xi[p];
    for (let z = 0; z < H; z++) out[z] += a * CZ[(n + JM) * H + z] - b * SZ[(n + JM) * H + z];
  }
  return out;
}
// The sawtooth of nl layers, interface after interface starting at cell z0, in d.
function sawtooth(nl, z0, h) {
  const f = new Float64Array(H), hc = H / nl;
  let m = 0;
  for (let z = 0; z < H; z++) {
    const u = (((z - z0) % hc) + hc) % hc;
    f[z] = h * (u - 0.5 * hc + 0.5);
    m += f[z];
  }
  for (let z = 0; z < H; z++) f[z] -= m / H;
  return f;
}
const SPF = new Float64Array(H), GP = new Float64Array(H);
// Interfaces: the maxima of G = 1 - ds'/dz that pass IF_G. G is 1 where the background gradient stands, 0 in a mixed layer and 3 or more at an interface. Returns their cells.
function interfaces(S) {
  profile(S, 1, SPF);
  const h = S.h, pk = [];
  for (let z = 0; z < H; z++) GP[z] = 1 - (SPF[(z + 1) % H] - SPF[(z + H - 1) % H]) / (2 * h);
  for (let z = 0; z < H; z++) {
    if (GP[z] < IF_G) continue;
    let top = true;
    for (let k = 1; k <= 3 && top; k++) if (GP[(z + k) % H] > GP[z] || GP[(z + H - k) % H] >= GP[z]) top = false;
    if (top) pk.push(z);
  }
  // two maxima closer than 7 cells are one thick interface: the weaker is dropped
  for (let again = pk.length > 1; again; ) {
    again = false;
    for (let i = 0; i < pk.length && pk.length > 1; i++) {
      const j = (i + 1) % pk.length;
      if ((pk[j] - pk[i] + H) % H < 7) {
        pk.splice(GP[pk[i]] < GP[pk[j]] ? i : j, 1);
        again = pk.length > 1;
        break;
      }
    }
  }
  return pk;
}
// Pull the mean profiles toward a target (re, im pairs for T' and s') at rate per time unit for a time.
function startNudge(S, tT, tS, rate, time) {
  S.nz = { tT, tS, rate, left: time };
}
function nudge(S, dt) {
  const nz = S.nz, X = S.X, a = 1 - exp(-nz.rate * dt);
  for (let n = -JM; n <= JM; n++) {
    if (!n) continue;
    const p = modeAt(n), k = n + JM;
    X.tr[p] += a * (nz.tT[0][k] - X.tr[p]);
    X.ti[p] += a * (nz.tT[1][k] - X.ti[p]);
    X.sr[p] += a * (nz.tS[0][k] - X.sr[p]);
    X.si[p] += a * (nz.tS[1][k] - X.si[p]);
  }
  nz.left -= dt;
  if (nz.left <= 0) S.nz = null;
}
// Called twice a panel second. A stack that has lost its layers is rebuilt. One with fewer layers than the Layers knob asks for, where a layer is
// thick enough to hold two, gets a new interface in the middle of the thickest one, and one with more loses its weakest interface, both eased
// in over 25 time units. The mismatch has to last (12 panel seconds to add, 3 to remove) so that a merge is seen before it is undone.
function keep(S, nt) {
  const pk = interfaces(S), n = pk.length, h = S.h;
  S.nl = n;
  if (S.nz || S.t < S.cool) return;
  const X = S.X;
  if (S.wrms < DEAD_W || n === 0) {
    if (++S.dead < 4) return;
    S.dead = 0;
    if (S.wrms < DEAD_W) kick(S, 0.3);
    S.ev[2]++;
    const m = profModes(sawtooth(nt, floor(Math.random() * H), h), SIGI);
    startNudge(S, m, m, 0.12, 40);
    S.cool = S.t + 60;
    return;
  }
  S.dead = 0;
  S.low = n < nt ? S.low + 1 : 0;
  S.high = n > nt ? S.high + 1 : 0;
  const f = new Float64Array(H);
  if (S.low >= SPLIT_AFTER) {
    let gap = 0, at = 0;
    for (let i = 0; i < n; i++) {
      const g = (pk[(i + 1) % n] - pk[i] + H) % H || H;
      if (g > gap) (gap = g), (at = pk[i]);
    }
    if (gap * h < SPLIT * HL) return;
    S.ev[0]++;
    const d = (gap * h) / 4;
    for (let z = 0; z < H; z++) {
      const o = (z - at + H) % H;
      f[z] = o > 0 && o < gap ? (o < gap / 2 ? d : -d) : 0;
    }
  } else if (S.high >= 6 && n > 1) {
    // the weakest interface: the jump of the total salt across 6 cells, and the two layers it separates take their mean
    let jw = 1e9, iw = 0;
    for (let i = 0; i < n; i++) {
      const z = pk[i], j = SPF[(z + 3) % H] - SPF[(z + H - 3) % H] - 6 * h;
      if (-j < jw) (jw = -j), (iw = i);
    }
    jw = max(jw, 0);
    S.ev[1]++;
    const z0 = pk[(iw + n - 1) % n], z1 = pk[iw], z2 = pk[(iw + 1) % n];
    const a = (z1 - z0 + H) % H || H, b = (z2 - z1 + H) % H || H;
    for (let z = 0; z < H; z++) {
      const o = (z - z0 + H) % H;
      f[z] = o < a ? (-b / (a + b)) * jw : o < a + b ? (a / (a + b)) * jw : 0;
    }
  } else return;
  const m = profModes(f, SIGI), tT = [new Float64Array(NJ), new Float64Array(NJ)], tS = [new Float64Array(NJ), new Float64Array(NJ)];
  for (let k = -JM; k <= JM; k++) {
    if (!k) continue;
    const p = modeAt(k), j = k + JM;
    tT[0][j] = X.tr[p] + m[0][j];
    tT[1][j] = X.ti[p] + m[1][j];
    tS[0][j] = X.sr[p] + m[0][j];
    tS[1][j] = X.si[p] + m[1][j];
  }
  startNudge(S, tT, tS, 0.15, 25);
  S.cool = S.t + 40;
  S.low = S.high = 0;
}

// ---- start ----------------------------------------------------------------------------------------
// Convection to start with: noise in w, T and s at a few wavelengths.
function kick(S, amp) {
  const X = S.X;
  for (let m = 0; m < NN; m++) {
    const p = ALL[m], ni = Math.round((K0X[p] * W) / TAU2), nj = Math.round((K0Z[p] * H) / TAU2);
    const kk = sqrt((ni / IM) * (ni / IM) + (nj / JM) * (nj / JM));
    if (kk > 0.5) continue;
    X.wr[p] += amp * (Math.random() - 0.5);
    X.wi[p] += amp * (Math.random() - 0.5);
    X.tr[p] += amp * (Math.random() - 0.5);
    X.ti[p] += amp * (Math.random() - 0.5);
    X.sr[p] += amp * (Math.random() - 0.5);
    X.si[p] += amp * (Math.random() - 0.5);
  }
  symmetrize(X);
}
function spin(S, nl) {
  for (const f of [S.X, S.N0, S.H1, S.H2]) for (const key in f) f[key].fill(0);
  S.ord = 0;
  S.lv = 5;
  S.t = 0;
  S.acc = 0;
  S.nz = null;
  S.cool = 0;
  S.dead = 0;
  kick(S, 0.4);
  const m = profModes(sawtooth(nl, floor(Math.random() * H), S.h), SIGI), X = S.X;
  for (let k = -JM; k <= JM; k++) {
    if (!k) continue;
    const p = modeAt(k), j = k + JM;
    X.tr[p] = X.sr[p] = m[0][j];
    X.ti[p] = X.si[p] = m[1][j];
  }
  while (S.t < PRE) step(S);
  S.cool = S.t + 20;
  S.next = S.t;
}

// ---- the pattern ----------------------------------------------------------------------------------
const OPEN = [0, 2, 0, 0.06];
const LAY0 = 4.2, RMID = 1.5, RSPAN = 1.18; // Layers: the box is LAY0 layer thicknesses of HL tall at the opening; Ratio: R = RMID RSPAN^knob
const NSW = 3.8; // Layers below this stands as three layers, above as four
const HL = 32; // the thickness of a layer in d: layers a little thinner than 30 d at R = 1.5 stopped convecting within 200 time units in the runs below
const SPLIT = 1.8, SPLIT_AFTER = 24, IF_G = 1.7, SIGI = 1.5, DEAD_W = 0.4;
const PRE = 8, MAXSTEPS = 8;

export function setup(params) {
  params.s = makeState();
  return params.s;
}

function targets(S, k) {
  S.fk = cl(k[1], 0.1, 8);
  const kl = cl(k[2], -1.2, 1.2);
  S.lt = kl < 0 ? LAY0 + 1.2 * kl : LAY0 + 0.2 * kl; // layers' worth of box: 3.0 at -1, 4.2 at 0, 4.4 at 1
  S.ht = (HL * S.lt) / H;
  S.nt = S.lt < NSW ? 3 : 4;
  S.Rt = RMID * pow(RSPAN, cl(k[3], -1.2, 1.2));
  S.hue = cl(k[0], 0, 1);
}
// R and the pitch follow the knobs; the tables are rebuilt only when either has moved by 0.2 percent.
function follow(S, f) {
  S.R += (S.Rt - S.R) * f;
  S.h += (S.ht - S.h) * f;
  if (abs(S.R - S.bR) > 0.002 * S.R || abs(S.h - S.bh) > 0.002 * S.h || !S.bh) {
    S.bR = S.R;
    S.bh = S.h;
    S.ver++;
  }
}
function advance(S, ft) {
  follow(S, 1 - exp(-ft / 0.8));
  S.acc += ft * S.fk * (S.h / 2);
  let n = 0;
  while (n < MAXSTEPS) {
    const dt = DT0 * pow(2, S.lv / 2);
    if (S.acc < dt) break;
    S.acc -= step(S);
    n++;
  }
  if (n === MAXSTEPS) S.acc = min(S.acc, 0.05);
  S.dirty = true;
  if (S.t >= S.next) {
    S.next = S.t + 0.5 * S.fk;
    keep(S, S.nt);
  }
  // A state that has gone bad starts over. It does not happen in the runs below.
  if (!(S.wmax < 120)) spin(S, S.nt);
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  targets(S, k);
  if (!S.ready) {
    S.ready = true;
    S.R = S.Rt;
    S.h = S.ht;
    follow(S, 1);
    spin(S, S.nt);
  }
  advance(S, cl(dt || 0, 0, 0.1));
}

// ---- colour ---------------------------------------------------------------------------------------
function okLab(L, a0, b0, out) {
  for (let k = 1; k >= 0; k -= 0.05) {
    const a = a0 * k, b = b0 * k;
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    if (k < 0.01 || (r > -0.002 && r < 1.002 && g > -0.002 && g < 1.002 && bb > -0.002 && bb < 1.002)) {
      out[0] = r;
      out[1] = g;
      out[2] = bb;
      return;
    }
  }
}
const enc = (v) => {
  v = cl(v, 0, 1);
  return ((v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055) * 255 + 0.5) | 0;
};
const RGB = [0, 0, 0];
// stops of the dye ramp, [position 0..1, L, C, hue]: 0 is the freshest water at the top, 1 the saltiest at the bottom
const STOPS = [
  [0, 0.4, 0.12, 262],
  [0.33, 0.55, 0.11, 215],
  [0.66, 0.55, 0.16, 335],
  [1, 0.62, 0.15, 15],
];
const NV = 96, NT = 9;
const LUT = new Uint8Array(NV * NT * 3);
function buildLut(hue) {
  const lab = STOPS.map(([x, L, C, h]) => {
    const r = ((h + hue * 360) * PI) / 180;
    return [x, L, C * cos(r), C * sin(r)];
  });
  for (let v = 0; v < NV; v++) {
    const x = v / (NV - 1);
    let j = 1;
    while (j < lab.length - 1 && x > lab[j][0]) j++;
    const a = lab[j - 1], b = lab[j], t = cl((x - a[0]) / (b[0] - a[0]), 0, 1);
    for (let u = 0; u < NT; u++) {
      const lift = u / (NT - 1); // plume heads and fronts lighter
      let L = a[1] + (b[1] - a[1]) * t + 0.22 * lift, ca = a[2] + (b[2] - a[2]) * t, cb = a[3] + (b[3] - a[3]) * t;
      // dark orange, olive and brown are mud on the panel: between hue 25 and 150 the lightness is lifted by up to 0.16, which makes them peach, gold and lime
      const hd = (Math.atan2(cb, ca) * 180) / PI, w = sm(25, 55, hd) * (1 - sm(120, 150, hd));
      L = min(0.9, L + 0.16 * w);
      okLab(L, ca * (1 - 0.4 * lift), cb * (1 - 0.4 * lift), RGB);
      const o = (v * NT + u) * 3;
      LUT[o] = enc(RGB[0]);
      LUT[o + 1] = enc(RGB[1]);
      LUT[o + 2] = enc(RGB[2]);
    }
  }
}

// s' on the panel's 64 by 128 grid: the 64 by 64 spectrum is zero-padded along z, so the stretch is a spectral interpolation.
function fields(S) {
  const { pr, pi, X } = S;
  pr.fill(0);
  pi.fill(0);
  for (let m = 0; m < NA; m++) {
    const p = ALL[m], i = p & (W - 1), j = p >> LW, o = (j < H / 2 ? j : j + H) * W + i;
    pr[o] = X.tr[p] - X.si[p];
    pi[o] = X.ti[p] + X.sr[p];
  }
  fftRows(pr, pi, HD, true);
  fftCols(pr, pi, PD, true);
  const SS = S.SS, mean = S.mean;
  let s2 = 0;
  for (let z = 0; z < HD; z++) {
    let m = 0;
    for (let x = 0; x < W; x++) m += pi[z * W + x];
    mean[z] = m / W;
    for (let x = 0; x < W; x++) {
      const v = pi[z * W + x];
      SS[z * W + x] = v;
      s2 += (v - mean[z]) * (v - mean[z]);
    }
  }
  return sqrt(s2 / ND);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.dirty) {
    S.dirty = false;
    const rms = fields(S);
    S.sref = S.sref ? S.sref + (rms - S.sref) * 0.004 : rms;
  }
  if (S.lutHue !== S.hue) {
    S.lutHue = S.hue;
    buildLut(S.hue);
  }
  const { SS, mean } = S, h = S.h, L = H * h, dz = 0.5 * h, ia = 1 / L, ik = 1 / (CA * S.sref);
  for (let y = 0; y < HD; y++) {
    const z = HD - 1 - y, zu = ((z + 1) & (HD - 1)) * W, zd = ((z + HD - 1) & (HD - 1)) * W;
    const am = mean[z] * ia + 1 - z / HD; // the salt of the layer here: 0 at the fresh top, 1 at the salty bottom
    for (let x = 0; x < W; x++) {
      const q = z * W + x, an = SS[q] - mean[z];
      const a = cl(am + an * KA * ia, 0, 1);
      const lift = cl(abs(an) * ik, 0, 1);
      // the seam: where the salt rises steeply with depth the colour is pulled toward white
      const g = 1 - (SS[zu + x] - SS[zd + x]) / (2 * dz);
      const e = sm(E0, E1, g) * EW;
      const o = (((a * (NV - 1) + 0.5) | 0) * NT + ((lift * (NT - 1) + 0.5) | 0)) * 3;
      const r = LUT[o], gg = LUT[o + 1], b = LUT[o + 2];
      display.setPixel(x, y, r + (255 - r) * e, gg + (255 - gg) * e, b + (255 - b) * e);
    }
  }
}
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const KA = 6, CA = 1.8, E0 = 1.8, E1 = 4.5, EW = 0.7;
