// ===== Patternflow pattern =====
// Title:   Salt Fingers
// Family:  ocean
// Idea:    Warm salty water over cold fresh water is stable in density, yet heat leaves a displaced parcel ten times faster than salt does, so the interface breaks into tall alternating plumes, fresh cool ones rising and salty warm ones sinking, solved as two-dimensional double-diffusive flow in a box with fixed background gradients and drawn as the salt anomaly in teal and vermilion over deep blue with a pale seam where it is steepest, and the plumes tilt, pinch, drip and re-form for as long as it runs.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Salt fingers: Stern (1960, from memory) on the instability of warm salty water over cold fresh; the perpetual salt fountain of Stommel, Arons and Blanchard (1956, from memory); a gradient-periodic box, in which T', S' and the stream function are periodic about constant background gradients, as Radko used for finger simulations (2003, and with Smith 2012, both from memory); the flux ratio gamma = alpha F_T / beta F_S after Schmitt (1979, from memory); integrating-factor Adams-Bashforth stepping (Lawson, 1967, from memory) with the two-thirds rule (Orszag, 1971, from memory)
// Round:   118
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Ratio=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the Oklab hue of every stop of the colour ramp except the one at zero salt, so the deep blue between plumes stays and one full turn comes back. At 0 the fresh rising water runs from deep blue through teal (hue 200 to 228 degrees, lightness 0.50 at the middle stop, 0.95 at the top) to ice, and the salty sinking water from crimson (hue 8, lightness 0.45) through vermilion to peach (hue 62, lightness 0.94). The two ramps stay about 180 degrees apart at every setting (0.3 is magenta against green, 0.5 orange against teal) because each keeps nearly one hue, and the ramp is joined in Oklab a and b so that a turn goes through grey and not through a rainbow. The colour scale is 2.2 rms of S' followed over about 8 s, raised to the power 1.3 so the middle stays dark; the stop at zero salt is deep blue (lightness 0.29). The temperature layer moves the lightness by up to 0.04 and the hue by up to 18 degrees where the salt anomaly is small.
// Knob 2: Flow. Model time per panel second: 0.6 time units per unit of the knob at the opening, so 1.2 at 2, times h / 1.05 and (R / 2.2)^1.85 so that the pace of the picture does not change with Scale or Ratio (h is the LED pitch in d, below, and the second factor is the fall of the rms speed with R, measured). Over 90 s the plumes' rms speed is 1.4 LEDs a second up the panel at 0.5, 5.8 at 2 and 11.7 at 4 (across the panel 0.5, 2.0 and 4.0), 5.8 at Ratio -1, 0 and 1, 4.2 at Scale -1 and 6.2 at Scale 1. The model's steps are fixed in size, so a slow frame runs more of them (at most 8). Cost per frame in Node: 0.4 ms to step at 0.5, 1.6 at 2 and 3.4 at 4, and 0.9 ms to draw.
// Knob 3: Scale. The wavelength of the fastest-growing finger in LEDs, 8 times 1.55 to the knob: 5.2 at -1, 8 at 0, 12.4 at 1, which sets the LED pitch h = 1.63, 1.05 and 0.68 d. The plumes on the panel are wider than that, as saturated fingers are: the distance from a salty maximum to the next fresh one (first minimum of the autocorrelation of S' across the panel, 90 s) is 4, 6 and 9 LEDs, so 16, 11 and 7 plumes across, and the spectral centroid of S' is at a wavelength of 10.6, 12.7 and 17.1 LEDs. The pitch follows the knob with a time constant of 0.6 s, and the fingers need a few growth times (5.8 model time units, 4.7 panel seconds, at the opening) to settle to a new width.
// Knob 4: Ratio. R = alpha T_z / (beta S_z), the stabilising temperature gradient over the destabilising salt gradient, 2.2 times 1.4 to the knob: 1.57 at -1, 2.25 at the opening and 3.08 at 1. The fingers exist for R below 1 / tau = 10. The fastest linear growth rate is 0.307, 0.173 and 0.099 per time unit, the rms vertical speed of the saturated state 4.7, 2.4 and 1.4 d per time unit, and the flux ratio 0.76, 0.72 and 0.69. At -1 the plumes are shorter and the picture is busy with small drips, at 1 they are longer, wider and calmer; the top end still never settles (recur 0.68 over 900 s).

// What the field is. Perturbations T', S' and a stream function psi (u = -psi_z, w = psi_x, x across, z up) about linear background gradients, in the units d =
// (nu kappa_T / (g alpha T_z))^(1/4), d^2 / kappa_T, with T in T_z d and S in (alpha / beta) T_z d:
//   T_t + J(psi, T') + w = lap T',   S_t + J(psi, S') + w / R = tau lap S',   zeta_t + J(psi, zeta) = Pr (T' - S')_x + Pr lap zeta,   zeta = lap psi.
// Pr = nu / kappa_T = 7, tau = kappa_S / kappa_T = 0.1 (0.01 in the ocean; at 0.1 the salt field is resolved on 64 cells and the flux ratio stays in the observed
// 0.4 to 0.8), R above. The box is 64 h by 64 h: 64 by 64 modes, the 2/3 rule (|m|, |n| <= 21, 1848 modes kept), and the panel's 128 rows are the same box
// stretched by two in z by zero-padding the spectrum, so a plume is twice as long in LEDs as in the box and as wide as it is. The linear terms of (w, T, S) in
// each mode (diffusion, the buoyancy that drives w, and the w that carries the background gradients) are one 3 by 3 matrix, exponentiated exactly, and the
// advective terms go through Adams-Bashforth 3 on top of it (Lawson's integrating factor), with the step picked from a ladder 0.008 2^(l/2) so that
// k_max (max|u| + max|w|) dt stays under 0.6. Modes with no x variation carry psi, so a mean shear can grow. S gets a grid-scale damping 3 (kk)^8 per time unit, kk
// the mode's radius in units of the cut. Conjugate symmetry is restored after every step. The first frame runs 14 time units from a seed of
// eigenvectors in the fastest-growing band: 340 to 640 steps and 0.2 to 0.55 s across the knobs (451 steps, 0.4 s at the opening).
//
// The picture. S' is the colour (ramp in Knob 1), T' the faint second layer that keeps the voids from being black, and a pixel whose salt gradient (central
// differences, in colour scales per LED) passes 0.3 to 0.75 is pulled toward white by up to 0.8, a pale seam on the steepest fronts and the sheared edges of tongues.
//
// What was checked, with the file's own step:
// - Linear growth. A single mode at amplitude 1e-9 grows at the largest root of (s + Pr k2)(s + k2)(s + tau k2) + Pr c [(s + tau k2) - (s + k2) / R] = 0
//   (c = kx^2 / k2) to a relative 3e-13 or better over 20 cases (R 1.6, 2.2, 3; fastest wavelength 5, 8, 12 LEDs; modes (8,0), (8,3), (5,0), (13,6)), with the
//   damping included in the root. It lowers the finger's own rate by 0.9 per cent (0.1783 to 0.1766 at the opening). The static limit gives the unstable band
//   k^4 < 1/(tau R) - 1, upper edge 1.363 d^-1 at R = 2.245, and the cubic's zero is at 1.363. The fastest wavelength is 8.38 d at R = 2.245, 1.33 times the
//   2 pi d = 6.28 d one reads off the scales.
// - The advective terms. Against a direct convolution over all kept mode pairs, on a random state: T, S and w terms agree to 2.4e-15, 2.0e-15 and 1.6e-15
//   relative. With the linear terms off, the tendencies of <T'^2>, <S'^2>, the energy and the enstrophy are 1e-16 of themselves, and over 4 time units the
//   largest drift of the four is 5e-5 at dt = 0.008, 6e-5 at 0.016, 5e-4 at 0.023 and 2e-3 at 0.032.
// - Time step. Against dt = 0.0005, the state of a developed run after 2 time units differs by 2.8e-2 (dt 0.032), 2.7e-3 (0.016), 7.9e-4 (0.008) and
//   2.1e-4 (0.004), second order once the two lower-order start-up steps are counted (the ladder starts again at a change of step).
// - Resolution. The same box on 128 by 128 modes (R = 2.2, 8 LEDs) at damping 3 and 0.3: rms w 2.80 and 2.67, rms S' 8.5 and 8.1, flux ratio 0.69 and 0.68.
//   On 64 by 64: 2.54, 7.9 and 0.73 at damping 3, 2.04, 6.1 and 0.63 at 0.3, 1.97, 5.8 and 0.59 with none. So the shipped grid and damping run 9 per cent
//   under the finer grid in w and 7 in S', and without damping the salt spectrum does not fall toward the cut (19 per cent of its peak at kk 1, 0.8 per cent
//   with damping 3). At the opening the damping takes 50 per cent of the S' variance the run dissipates (64 per cent at R = 1.57), physical diffusion the rest. The grid is coarser at Scale -1 (h = 1.63 d) and finer at 1 (0.68 d), and not checked there beyond the runs below.
// - Finger width. At the opening the first minimum of the autocorrelation of S' across the panel is at 6 LEDs, a wavelength of 12, against 8 for the fastest
//   linear finger and 6.0 for 2 pi d. A finger is 1.5 times the linear wavelength once it saturates.
// - Flux ratio. gamma = <w T'> / <w S'> = alpha F_T / beta F_S is 0.72 at the opening over 900 s (0.76 at R 1.57, 0.69 at 3.08), inside the observed 0.4 to 0.8.
// - Staying irregular. No imposed shear was needed. The plain system saturates as tall fingers that burst, then as plumes, and does not settle at any R in
//   the knob's range. Variance of S' by quarter of 900 s: 57.9, 56.2, 54.7, 57.0 at the opening (last over first 0.98), 27.2, 27.5, 28.8, 27.7 with Flow 4, Scale 1 and
//   Ratio 1 (1.02). The part of the variance in the means over x (layers) is 2 to 6 per cent, so no staircase forms.
// - Staying alive. The linear growth rate is positive at every R the knob reaches, so the state cannot decay; a state scaled by 1e-3 grows back to rms 6
//   in 50 s unaided. If rms S' ever falls under 0.25 (it is 3.7 to 13 in the runs) or a speed passes 80, the field is cleared and the first-frame run is
//   done again (0.36 s once). Zeroing the state by hand did that.

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
// Fields are perturbations T', S' and the stream function psi about linear background gradients, in the units d, d^2/kappa_T, with T in T_z d
// and S in (alpha / beta) T_z d. The state of a Fourier mode is (w, T, S), w = psi_x; the modes with no x variation carry psi in the w slot.
const PR = 7; // Prandtl number nu / kappa_T
const TAUD = 0.1; // diffusivity ratio kappa_S / kappa_T
const HYP_R = 3, HYP_P = 8; // grid-scale damping on S: rate HYP_R (kk)^HYP_P per time unit, kk the mode radius in units of the cut
const DT0 = 0.008, NLV = 8; // time step ladder: DT0 2^(l/2)
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

// Largest real root of (s + Pr k2)(s + k2)(s + tau k2) + Pr c [(s + tau k2) - (s + k2) / R] = 0, the growth rate of a mode with c = kx^2 / k2.
function growth(R, k2, c) {
  const a1 = PR * k2, a2 = k2, a3 = TAUD * k2;
  const A = a1 + a2 + a3, B = a1 * a2 + a1 * a3 + a2 * a3 + PR * c * (1 - 1 / R), C = a1 * a2 * a3 + PR * c * (a3 - k2 / R);
  let s = 4;
  for (let i = 0; i < 60; i++) {
    const d = (3 * s + 2 * A) * s + B, f = ((s + A) * s + B) * s + C;
    s -= f / d;
  }
  return s;
}
// The wavenumber of the fastest-growing finger, an elevator mode (c = 1), by golden section.
function kFast(R) {
  let a = 0.3, b = 1.4;
  const g = 0.6180339887;
  for (let i = 0; i < 40; i++) {
    const x1 = b - g * (b - a), x2 = a + g * (b - a);
    if (growth(R, x1 * x1, 1) > growth(R, x2 * x2, 1)) b = x2;
    else a = x1;
  }
  return 0.5 * (a + b);
}

const mkF = () => ({ wr: new Float64Array(N), wi: new Float64Array(N), tr: new Float64Array(N), ti: new Float64Array(N), sr: new Float64Array(N), si: new Float64Array(N) });

function makeState() {
  const S = {
    t: 0, acc: 0, R: 2.2, h: 1, ver: 0, bR: 0, bh: 0, lv: 4, ord: 0, up: 0, umax: 0, wmax: 0, srms: 1, ready: false,
    X: mkF(), N0: mkF(), H1: mkF(), H2: mkF(),
    ar: new Float64Array(N), ai: new Float64Array(N), br: new Float64Array(N), bi: new Float64Array(N), cr: new Float64Array(N), ci: new Float64Array(N),
    E: [], Ever: new Int32Array(NLV).fill(-1),
    pr: new Float64Array(ND), pi: new Float64Array(ND), hue: 0, sref: 0, fk: 2, Rt: 2.2, lt: 8, lam: 8, dirty: false, lutHue: -1,
    SS: new Float32Array(ND), TT: new Float32Array(ND),
  };
  for (let l = 0; l < NLV; l++) S.E.push(new Float64Array(NQ * 9));
  return S;
}

// The propagators of one time step for every |m|, |n|: exp(M dt) with M the 3 x 3 matrix of the linear terms of (w, T, S),
//   w_t = -Pr k2 w + Pr c (T - S),  T_t = -k2 T - w,  S_t = -(tau k2 + hyper) S - w / R,
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
        M[2] = -PR * c;
        M[3] = -1;
        M[6] = -1 / S.R;
      }
      expm3(M, dt, out);
      for (let i = 0; i < 9; i++) E[q + i] = out[i];
    }
  return E;
}

// The advective terms: N_T = -div(u T), N_S = -div(u S), and for the vorticity (d_xz)(u^2 - w^2) + (d_zz - d_xx)(u w), u = -psi_z, w = psi_x.
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
  let um = 0, wm = 0, ss = 0;
  for (let p = 0; p < N; p++) {
    const u = ar[p], w = ai[p], T = br[p], Sv = bi[p];
    if (u > um) um = u;
    else if (-u > um) um = -u;
    if (w > wm) wm = w;
    else if (-w > wm) wm = -w;
    ss += Sv * Sv;
    ar[p] = u * T;
    ai[p] = w * T;
    br[p] = u * Sv;
    bi[p] = w * Sv;
    cr[p] = u * u - w * w;
    ci[p] = u * w;
  }
  S.umax = um;
  S.wmax = wm;
  S.srms = sqrt(ss / N);
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
  if (S.ord < 2) S.ord++;
  S.t += dt;
  return dt;
}

// ---- start ----------------------------------------------------------------------------------------
function seed(S, amp) {
  const X = S.X, k0 = kFast(S.R);
  for (let m = 0; m < NA; m++) {
    const p = ALL[m], ni = round0(K0X[p] * W / TAU2), nj = round0(K0Z[p] * H / TAU2);
    const kx = K0X[p] / S.h, kz = K0Z[p] / S.h, k2 = kx * kx + kz * kz;
    if (!ni) continue;
    const c = kx * kx / k2, sg = growth(S.R, k2, c);
    const band = exp(-pow((sqrt(k2) - k0) / (0.22 * k0), 2)) * exp(-pow(nj / 5, 2));
    const re = Math.random() - 0.5, im = Math.random() - 0.5, f = amp * band;
    const rs = TAUD * k2;
    // eigenvector (w, T, S) = (1, -1/(k2 + s), -1/(R (rs + s)))
    X.wr[p] = f * re;
    X.wi[p] = f * im;
    X.tr[p] = (-f * re) / (k2 + sg);
    X.ti[p] = (-f * im) / (k2 + sg);
    X.sr[p] = (-f * re) / (S.R * (rs + sg));
    X.si[p] = (-f * im) / (S.R * (rs + sg));
  }
  symmetrize(X);
}
const round0 = (v) => Math.round(v);

// ---- the pattern ----------------------------------------------------------------------------------
const OPEN = [0, 2, 0, 0.06];
const RMID = 2.2, RSPAN = 1.4; // Ratio knob: R_rho = RMID RSPAN^knob
const LAM0 = 8, LAMB = 1.55; // Scale knob: the fastest finger's wavelength in LEDs is LAM0 LAMB^knob
const MAXSTEPS = 8, FLOWC = 0.6, H0 = 1.05, WEXP = 1.85; // Flow knob: model time units per panel second per unit of knob at the opening

export function setup(params) {
  params.s = makeState();
  return params.s;
}

function targets(S, k) {
  S.fk = cl(k[1], 0.1, 8);
  S.Rt = RMID * pow(RSPAN, cl(k[3], -1.2, 1.2));
  S.lt = LAM0 * pow(LAMB, cl(k[2], -1.2, 1.2));
  S.hue = cl(k[0], 0, 1);
}
// R and the finger wavelength follow the knobs; the tables are rebuilt only when either has moved by 0.2 percent.
function follow(S, f) {
  S.R += (S.Rt - S.R) * f;
  S.lam += (S.lt - S.lam) * f;
  const h = (TAU2 / kFast(S.R)) / S.lam;
  if (abs(S.R - S.bR) > 0.002 * S.R || abs(h - S.bh) > 0.002 * h || !S.bh) {
    S.bR = S.R;
    S.bh = S.h = h;
    S.ver++;
  }
}
// The pace of the panel does not depend on Scale or Ratio: a model time unit is worth h / H0 (R / RMID)^WEXP of them, the first because one LED is h
// lengths and the second because the rms speed of the fingers goes as R^-WEXP (measured between R = 1.57 and 3.08).
function advance(S, ft) {
  follow(S, 1 - exp(-ft / 0.6));
  S.acc += ft * FLOWC * S.fk * (S.h / H0) * pow(S.R / RMID, WEXP);
  let n = 0;
  while (n < MAXSTEPS) {
    const dt = DT0 * pow(2, S.lv / 2);
    if (S.acc < dt) break;
    S.acc -= step(S);
    n++;
  }
  if (n === MAXSTEPS) S.acc = min(S.acc, 0.05);
  S.dirty = true;
  // A state that has gone bad, or has died away, starts over from the seed. Neither happens in the runs below.
  if (!(S.wmax < 80) || !(S.srms > 0.25)) spin(S);
}

// The first frame has to show fingers already: a seed in the fastest-growing band, then PRE model time units at the starting knobs.
function spin(S) {
  for (const f of [S.X, S.N0, S.H1, S.H2]) for (const key in f) f[key].fill(0);
  S.ord = 0;
  S.lv = 3;
  S.srms = 1;
  S.t = 0;
  S.acc = 0;
  seed(S, 0.5);
  while (S.t < PRE) step(S);
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  targets(S, k);
  if (!S.ready) {
    S.ready = true;
    S.R = S.Rt;
    S.lam = S.lt;
    follow(S, 1);
    spin(S);
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
// stops of the S ramp, [position -1..1, L, C, hue]: -1 is the freshest rising water, +1 the saltiest sinking
const STOPS = [
  [-1, 0.95, 0.03, 200],
  [-0.62, 0.78, 0.1, 207],
  [-0.3, 0.5, 0.12, 228],
  [0, 0.29, 0.06, 262],
  [0.3, 0.45, 0.14, 8],
  [0.62, 0.7, 0.15, 30],
  [1, 0.94, 0.06, 62],
];
const NV = 128, NT = 8;
const LUT = new Uint8Array(NV * NT * 3);
function buildLut(hue) {
  // every stop but the one at zero salt turns by the knob; the ramp is joined in Oklab a and b, so a turn of the hue goes through grey and not through a rainbow
  const lab = STOPS.map(([x, L, C, h]) => {
    const r = ((h + (x ? hue * 360 : 0)) * PI) / 180;
    return [x, L, C * cos(r), C * sin(r)];
  });
  for (let v = 0; v < NV; v++) {
    const x = (v / (NV - 1)) * 2 - 1, ax = abs(x);
    let j = 1;
    while (j < lab.length - 1 && x > lab[j][0]) j++;
    const a = lab[j - 1], b = lab[j], t = cl((x - a[0]) / (b[0] - a[0]), 0, 1);
    for (let u = 0; u < NT; u++) {
      const tt = (u / (NT - 1)) * 2 - 1; // the temperature layer: -1 cold, +1 warm, felt most where the salt anomaly is small
      const w = tt * (1 - ax), L = a[1] + (b[1] - a[1]) * t + 0.04 * w, ca = a[2] + (b[2] - a[2]) * t, cb = a[3] + (b[3] - a[3]) * t;
      const r = (18 * PI * w) / 180, cr = cos(r), sr = sin(r);
      okLab(L, ca * cr - cb * sr, ca * sr + cb * cr, RGB);
      const o = (v * NT + u) * 3;
      LUT[o] = enc(RGB[0]);
      LUT[o + 1] = enc(RGB[1]);
      LUT[o + 2] = enc(RGB[2]);
    }
  }
}

// T and S on the panel's 64 by 128 grid: the 64 by 64 spectrum is zero-padded along z, so the stretch is a spectral interpolation.
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
  const SS = S.SS, TT = S.TT;
  let s2 = 0;
  for (let q = 0; q < ND; q++) {
    TT[q] = pr[q];
    SS[q] = pi[q];
    s2 += pi[q] * pi[q];
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
  const { SS, TT } = S, is = 1 / (CS * S.sref), it = 1 / (CT * S.sref), ge = 0.5 * is;
  for (let y = 0; y < HD; y++) {
    const z = HD - 1 - y, zu = ((z + 1) & (HD - 1)) * W, zd = ((z + HD - 1) & (HD - 1)) * W;
    for (let x = 0; x < W; x++) {
      const q = z * W + x;
      let v = cl(SS[q] * is, -1, 1);
      const t = cl(TT[q] * it, -1, 1);
      v = v < 0 ? -pow(-v, GAM) : pow(v, GAM);
      const o = (((v + 1) * 0.5 * (NV - 1) + 0.5) | 0) * NT + (((t + 1) * 0.5 * (NT - 1) + 0.5) | 0);
      // the seam: where the salt field is steepest the colour is pulled toward white
      const gx = (SS[z * W + ((x + 1) & (W - 1))] - SS[z * W + ((x + W - 1) & (W - 1))]) * ge, gz = (SS[zu + x] - SS[zd + x]) * ge;
      const e = sm(E0, E1, sqrt(gx * gx + gz * gz)) * EW;
      const r = LUT[o * 3], g = LUT[o * 3 + 1], b = LUT[o * 3 + 2];
      display.setPixel(x, y, r + (255 - r) * e, g + (255 - g) * e, b + (255 - b) * e);
    }
  }
}
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const CS = 2.2, CT = 2.2, PRE = 14, GAM = 1.3, E0 = 0.3, E1 = 0.75, EW = 0.8;
