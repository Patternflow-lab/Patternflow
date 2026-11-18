// ===== Patternflow pattern =====
// Title:   Spiral Defect Chaos
// Family:  wave
// Idea:    The generalised Swift-Hohenberg equation with a mean flow runs on the panel's own 64 by 128 torus at about five LEDs a wavelength, and the convection rolls it makes, pearl lines on ink tinted by the way they run, bend into curls, tear at defects and never settle.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: spiral defect chaos of Rayleigh-Benard convection (Stephen Morris, Eberhard Bodenschatz, David Cannell and Guenter Ahlers, 1993, the experiment) in the generalised Swift-Hohenberg equation with mean flow (Jack Swift and Pierre Hohenberg, 1977, the equation; Hao-wen Xi, James Gunton and Jorge Vinals, 1993, the mean flow and the spiral defect chaos in the model), all from memory; solved with Fourier modes (James Cooley and John Tukey, 1965, from memory), the linear part exactly in an integrating-factor step (Steven Cox and Paul Matthews, 2002, from memory), the advection by Heun's rule, and the local terms split off and solved point by point (Gilbert Strang, 1968, from memory); pattern round 116, made on the creator's turn of 8 November toward fields that flow for ever
// Round:   116
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.3..3, Scale=-0.5..1.3, Heat=-1..1
//
// Knob 1: Hue. Adds its value to the hue of both ramps, so one turn comes back. At 0 a stripe that runs up and down the panel goes from navy to ice (hue 0.62 to 0.50) and one that runs across it from plum to rose (0.80 to 0.96), and at an angle the two ramps are mixed in RGB, so the middle is grey. At 0.25 the pair is lilac against olive cream, at 0.5 pink-white against mint on dark green and at 0.75 green-white against periwinkle. The ramps are given as hue, saturation and Rec. 601 luma, so both are as bright at every tone and at every Hue (ink 0.09, pearl 0.97), and a warm hue in the dark half is lifted and loses up to 45 percent of its saturation, so no ink goes brown. At no Hue is an LED's brightest channel under 34 of 255, and the darkest luma is 29.
// Knob 2: Flow. The clock. Each frame the model time per panel second is set so that the rms speed of the stripes along their normals stays at 0.5 LEDs a second per unit of Flow. The speed is read off the frames: the rms of the change of psi (each frame over its own rms) over the rms of |grad psi|, divided by the model time between them. A frame that moves more than 2.5 times the running value cannot stop the clock, so a knob thrown across its range does not freeze the picture. Model time is held to 1.6 a frame, 48 a second at 30 fps, to keep a frame under 12 ms. At the opening Scale and Heat, |psi_t| over |grad psi| where |grad psi| is above 0.7 of its rms, over 0.5 s, has a median of 0.09, 0.29, 0.57 and 0.82 LEDs a second at Flow 0.3, 1, 2 and 3 (rms 0.15, 0.49, 0.96 and 1.38; the fastest 1 percent above 0.46, 1.5, 2.9 and 4.1), and the model runs 2.9, 10.9, 21 and 33 time units a second. At Heat -1 the pattern is slower for the same model time and the cap is reached near Flow 1.6: the median is 0.24, 0.38 and 0.43 LEDs a second at Flow 1, 1.5 and 2, and 0.43 again at 3.
// Knob 3: Scale. The roll wavelength. The model's wavelength, 2 pi, is lam = 5.4 times 1.28 to the Scale LEDs: 4.77 at -0.5, 5.40 at 0, 6.91 at 1 and 7.44 at 1.3. The chaotic state keeps its rolls at a mean wavenumber of 1.12 to 1.16 (the mean of kappa weighted by |psi_hat|^2, in units of the model's own), so the stripes lie 4.26 LEDs apart at -0.5, 4.76 at 0, 6.01 at 1 and 6.44 at 1.3: 15.0, 13.4, 10.6 and 9.9 rolls across the 64 LEDs. Along a 64 LED row psi changes sign 19.9, 17.5, 14.4 and 13.7 times. The low end is 4.3 LEDs because below it a stripe is two LEDs of pearl against two of ink, and the retained modes end at 1.57 times the model's roll wavenumber there. The same box holds fewer wavelengths as Scale rises, so at Heat 0.06 the picture has 55, 39, 22 and 18 points where the direction of the stripes is singular (defined below), and at 1.3 a few large curls fill the panel.
// Knob 4: Heat. eps, how far above onset: 0.69 times 1.72 to the Heat, 0.40 at -1, 0.71 at the opening and 1.19 at 1. At Scale 0 the rms of psi is 0.42, 0.54 and 0.67, the stripes are 4.95, 4.76 and 4.57 LEDs apart, the direction of the stripes is singular at 19, 39 and 54 points, and the coherence of the direction (0 to 1, smoothed over one wavelength) is 0.53, 0.35 and 0.22. At -1 long rolls bend slowly between grains that meet at an angle. At 1 the stripes break into short pieces and dots. The low end is 0.40 and no lower because at 0.35, at Scale 1 or more, the count of singular points sat at zero for runs of up to 4000 model time units (about 80 s) before new ones came.

// What the field is. psi on a torus 64 LEDs wide and 128 tall, one grid cell an LED, in units where the rolls' wavenumber is 1 (a wavelength is 2 pi long and Scale says how many LEDs that is), obeys
//   psi_t + g_m U . grad psi = eps psi - (lap + 1)^2 psi - g2 psi^2 - psi^3,
//   lap zeta = psi_x (lap psi)_y - psi_y (lap psi)_x,   U = (zeta_y, -zeta_x).
// psi is the temperature, or the vertical velocity at mid depth, of a layer heated from below and seen from above, and it is what the panel shows, as a shadowgraph shows the same lines. The first line is the Swift-Hohenberg equation with a quadratic term that tells up from down (g2 = 0.35). The advection by U is the mean flow: zeta is the vertical vorticity that curved rolls drive and U the flow across the layer it makes. With g_m = 0 the rolls coarsen into a labyrinth that freezes. The mean flow is what keeps this one moving, and nothing else is added to keep it alive: no noise, no slow change of eps.
// The values I remember for the model of Xi and others are eps 0.7, g2 0.35 and g_m 50 in a box 30 or more wavelengths across (from memory). eps and g2 are kept, and g_m is 3 here. The box is 9 to 15 wavelengths across and what the mean flow does depends on the size of the structure it is fed, so I found g_m by running it, the opening Scale and Heat, 1400 model time units a run and 61 samples:
//   g_m              0     1.5    2     2.5    3     4     6     10    20    50
//   corr after 60    0.95  0.81  0.55  0.25  0.13  0.05  0.04  0.03  0.03  0.03   (correlation of psi after 60 time units)
//   rms of psi       0.61  0.59  0.57  0.55  0.54  0.51  0.46  0.41  0.33  0.23
//   singular points  30    31    28    36    38    43    50    56    61    62     (+-1/2 points of the stripe direction, both signs)
// At 3 the rolls stay long and curve (coherence 0.35) and the picture is new in 60 time units. At 50 the stripes break into dots and worms about one wavelength long (coherence 0.14), which is another picture. The sign matters. With the mean flow the other way, g_m = -3, it stabilises: the correlation of the picture 20 s apart is 0.08, 0.58, 0.46, 0.97 and 0.99 at 40, 100, 160, 220 and 280 s. With g_m = 0 it is 0.94 at 40 s and 1.00 from 220 s on, with 24 to 26 singular points that do not move, after 13500 model time units in 300 s (the clock speeds up when the picture stalls). With g_m = 3 it stays between -0.11 and 0.08 in every sample of 900 s.
// A singular point is a place where the direction of the stripes, from the structure tensor of grad psi smoothed with a Gaussian of half a wavelength, turns by +-pi around a square of four LEDs: a disclination of charge +-1/2. A roll that ends, a dislocation, shows as a pair of opposite sign close together, and a spiral or a target as two of the same sign. At the opening there are 19.7 of each sign per frame, 12 pairs of opposite sign closer than 1.2 wavelengths and 0.4 of two plus signs (0.2 of two minus signs): the picture is mostly roll ends and bends, with a spiral core now and then. That is what this box gives. Real spiral defect chaos wants a box more than 30 wavelengths across, and this one is 13.
// How it is solved. The modes are those with kappa^2 = m^2 + (n / 2)^2 up to 21^2 (2751 of them, kappa in units of 2 pi / 64 LEDs, a disc of radius 2.06 rad per LED, two thirds of Nyquist), kept as complex coefficients with the mirror mode (-m, -n) their conjugate. Wavenumbers in model units are lam m / 64 and lam n / 128. One step of h model time is
//   the linear part, eps - (1 - k^2)^2, exactly, by exp(L h);
//   the advection -g_m U . grad psi by Heun's rule in integrating-factor form, with U built from psi at the start of the step and held for the second stage;
//   the two local terms by their exact solutions at each point, psi_t = -g2 psi^2 giving psi / (1 + g2 h psi) and psi_t = -psi^3 giving psi / sqrt(1 + 2 h psi^2), on a 128 by 256 array, then cut back to the retained modes.
// That is Lie splitting, first order in h, and what is drawn is the state after the local step. The step is the shorter of 0.4 / eps (0.56 at the opening, 1.0 at Heat -1) and the one that keeps h max|g_m U| 1.5 under 0.6, the Courant number at the ring of modes (the modes above it are damped by the linear part). Transforms are radix-2 (first two stages as one radix-4 pass), 2D with the column transforms only for the columns that carry modes, and two real fields share one complex transform wherever the algebra lets them.
// Why the local terms are on the 128 by 256 array. The two thirds rule makes psi^2 exact on the LED grid but not psi^3: three modes of kappa 15 add up to 45, which wraps to -19 and lands inside the retained disc. At four to five LEDs a wavelength that error pulls the rolls onto the rows and columns of the LEDs: a first version with the cubic term on the LED grid gave domains of straight rolls, horizontal against vertical, at 4.4 LEDs, and the same equation with the cubic term exact gave the labyrinth. The mean flow needs only quadratic products and stays on the LED grid.
// The conjugate symmetry of the modes is imposed again after every step. Rounding breaks it by 1e-15, and the part that is not symmetric sees no cubic saturation and grows at the rate eps: it went from 5e-15 at model time 10 to 7e-3 at 50 and the field blew up at 60.
//
// Checks, each run on this file.
// 1. The mean flow of psi = a cos x + b cos 2y (8 LEDs a wavelength) against the analytic U = (12/5 ab sin x cos 2y, -6/5 ab cos x sin 2y) from lap zeta = J = -6 ab sin x sin 2y: largest error 1.7e-14 on a largest |U| of 0.84. U comes from a stream function, so div U is zero mode by mode.
// 2. Growth of a single mode of amplitude 1e-8 over 12 time units against eps - (1 - k^2)^2, for k from 0.6 to 1.2: the rate agrees to 1e-10 at eps 0.35 and 0.65, and to 5e-5 at 1.2, where the mode has grown to 0.02 by the end.
// 3. Straight rolls at k = 1 (13 rolls across, lam = 64 / 13) with g2 = 0, saturated amplitude A against the amplitude equation A = sqrt(4 eps / 3): at eps 0.2, 0.4917, 0.5038, 0.5121 and 0.5143 for h 0.6, 0.3, 0.1 and 0.05 against 0.5164; at eps 0.35, 0.6277, 0.6544, 0.6733 and 0.6782 against 0.6831. The error halves with h, as first order in h says, and is 0.4 and 0.7 percent at h 0.05. With g2 = 0.1 the amplitude equation with the mean mode and the cos 2kx harmonic gives 0.5210 and 0.6905 and the run 0.5166 and 0.6806 at h 0.05; the harmonic at kappa 26 lies outside the retained disc, which costs about 4 percent of the g2^2 term.
// 4. psi^2 and psi^3 computed on the LED grid against the 128 by 256 array, from the real pattern, relative rms over the retained modes: psi^2 differs by 4e-16 at every Scale, psi^3 by 10 percent at lam 4.77, 2.7 at 5.40 and 0.05 at 7.44.
// 5. Halving the step from the opening state against a run at 1/512 of the time: over 2 time units the error is 1.05e-1, 5.45e-2, 2.75e-2, 1.35e-2 and 6.4e-3 for h 0.5 down to 0.031, ratios 1.92, 1.98, 2.04 and 2.13; over 8 units 4.5e-1, 3.0e-1, 1.8e-1, 9.2e-2 and 4.5e-2 for h 2 down to 0.125. First order, as the splitting is.
// 6. Statistics at the opening against the step, 2400 model time units a run: rms of psi 0.566, 0.556 and 0.517 for h 0.0375, 0.15 and 0.6; singular points 43.2, 42.4 and 36.5; stripe speed 0.054, 0.051 and 0.044 LEDs per model time unit; correlation after 60 units 0.07, 0.08 and 0.17. The picture takes steps of 0.35 to 0.56 at the opening, so the deviation from the limit is less than the 9 percent of amplitude, 15 of singular points and 19 of speed that h 0.6 gives (the clock makes up the speed). An earlier unsplit version of this solver (third-order Runge-Kutta, the cubic term on the 128 by 256 array, h 0.3, 4.4 LEDs a wavelength, eps 0.5) gave an rms of psi of 0.504 and 52 singular points where the split one gave 0.499 and 51 at h 0.1.
// 7. The g_m table above, the sign of g_m and g_m = 0, all run on this file.
// 8. 900 s at the opening, a frame every 20 s: rms of psi 0.539 throughout, 28 to 54 singular points (mean 39), correlation 20 s apart between -0.11 and 0.08.
// Not checked: a run with more modes or on a finer grid than the LEDs (the disc stops at kappa 21, which is 1.3 to 1.6 times the roll wavenumber and cuts the top of the unstable band at the lowest Scale and highest Heat); defect statistics against the published ones, which I do not remember; the lifetime of a spiral; second order in h; and whether g_m = 3 is where the model of Xi and others would sit in a box this small.
//
// What the picture adds that is not in the equation. The sign: the bright lines are where psi is lowest (psi read as temperature, the cold down-flow), and psi has no skew to speak of here (skewness -0.04). The tone, tanh(0.9 x) on (psi - mean) / rms. The two ramps and the mixing between them by the direction of the stripes (cos 2 theta of the smoothed structure tensor, period pi), and the sine of twice the angle as a brightening of mid-tones by up to 25 percent. The clock of Flow. The 120 model time units run from noise of amplitude 0.002 before the first frame (0.5 to 0.8 s). The maps from the knobs to lam and eps. The file is 33 KB, 19 KB of it code and 14 KB this header.

const W = 64, H = 128, N = W * H;
const { floor, ceil, max, min, abs, sqrt, exp, log, pow, sin, cos, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const KC = 21; // retained modes: kappa^2 = m^2 + (n / 2)^2 <= KC^2, kappa in units of 2 pi / 64 LEDs

const CFG = {
  gm: 3, // mean flow strength g_m
  g2: 0.35, // quadratic coefficient
  lam0: 5.4, // roll wavelength in LEDs at Scale 0
  lamr: 1.28, // and the ratio per unit of Scale
  eps0: 0.69, // eps at Heat 0
  epsr: 1.72, // and the ratio per unit of Heat
  eh: 0.4, // the longest step is eh / eps, 0.56 at the opening, up to 1.2, model time
  cfl: 0.6, // Courant limit of the advection on a step
  kcfl: 1.5, // the wavenumber it is taken at, at most: the modes above are damped by the linear part
  speed: 0.5, // rms stripe speed, LEDs a second per unit of Flow
  preroll: 120, // model time run before the first frame
  gain: 0.9, // tone: tanh(gain x) on psi over its rms
  mix: 0.8, // how far the stripe direction pulls the colour toward the cool or the warm ramp
  lit: 0.25, // how much the other diagonal brightens a stripe
};

// ---- Fourier transforms ---------------------------------------------------------------------
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

// In place, forward (e^-i), on re[o .. o+n) and im[o .. o+n). With the two arrays swapped it
// is the unnormalised inverse. The first two stages are one radix-4 pass with no multiplies.
function fft1(re, im, o, P) {
  const n = P.n, sw = P.sw, tw = P.tw;
  for (let p = 0; p < sw.length; p += 2) {
    const i = o + sw[p], j = o + sw[p + 1];
    let t = re[i];
    re[i] = re[j];
    re[j] = t;
    t = im[i];
    im[i] = im[j];
    im[j] = t;
  }
  for (let a = o; a < o + n; a += 4) {
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
    for (let s = o; s < o + n; s += len)
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

// The 2D transforms of a GW x GH array whose modes lie in the columns |m| <= KC only, so the
// column transforms skip the rest. ifft2: modes at their slots to a complex field, unnormalised.
// ifft2real: the same for a spectrum with the symmetry of a real field, giving the real field
// in out, two rows to a complex transform. fft2real: a real field in re to its modes (re, im),
// unnormalised, the same pairing.
function fftset(GW, GH) {
  const PW = plan(GW), PH = plan(GH), COL = [];
  for (let j = 0; j < GW; j++) if (abs(j < GW / 2 ? j : j - GW) <= KC) COL.push(j);
  const CR = new Float64Array(GH), CI = new Float64Array(GH), ZR = new Float64Array(GW), ZI = new Float64Array(GW);
  const cols = (re, im, inv) => {
    for (const j of COL) {
      for (let i = 0, p = j; i < GH; i++, p += GW) {
        CR[i] = re[p];
        CI[i] = im[p];
      }
      if (inv) fft1(CI, CR, 0, PH);
      else fft1(CR, CI, 0, PH);
      for (let i = 0, p = j; i < GH; i++, p += GW) {
        re[p] = CR[i];
        im[p] = CI[i];
      }
    }
  };
  return {
    GN: GW * GH,
    ifft2(re, im) {
      cols(re, im, true);
      for (let i = 0; i < GH; i++) fft1(im, re, i * GW, PW);
    },
    ifft2real(re, im, out) {
      cols(re, im, true);
      for (let a = 0; a < GH / 2; a++) {
        const oa = a * GW, ob = (a + GH / 2) * GW;
        for (let j = 0; j < GW; j++) {
          ZR[j] = re[oa + j] - im[ob + j];
          ZI[j] = im[oa + j] + re[ob + j];
        }
        fft1(ZI, ZR, 0, PW);
        for (let j = 0; j < GW; j++) {
          out[oa + j] = ZR[j];
          out[ob + j] = ZI[j];
        }
      }
    },
    fft2real(re, im) {
      for (let a = 0; a < GH / 2; a++) {
        const oa = a * GW, ob = (a + GH / 2) * GW;
        for (let j = 0; j < GW; j++) {
          ZR[j] = re[oa + j];
          ZI[j] = re[ob + j];
        }
        fft1(ZR, ZI, 0, PW);
        for (let j = 0; j < GW; j++) {
          const q = (GW - j) & (GW - 1), zr = ZR[j], zi = ZI[j], qr = ZR[q], qi = ZI[q];
          re[oa + j] = 0.5 * (zr + qr);
          im[oa + j] = 0.5 * (zi - qi);
          re[ob + j] = 0.5 * (zi + qi);
          im[ob + j] = -0.5 * (zr - qr);
        }
      }
      cols(re, im, false);
    },
  };
}
const F1 = fftset(W, H), F2 = fftset(2 * W, 2 * H);

// ---- the modes ------------------------------------------------------------------------------
// Only the retained modes are stored. IDX is a mode's slot on the 64 x 128 array, IDXP its slot
// on the 128 x 256 array the local terms are computed on, PAR the slot of its mirror (-m, -n),
// whose coefficient is the complex conjugate because the field is real.
const IDX = [], IDXP = [], MM = [], NN = [], PAR = [];
{
  const at = new Map();
  for (let n = -2 * KC; n <= 2 * KC; n++)
    for (let m = -KC; m <= KC; m++) {
      if (m * m + (n * n) / 4 > KC * KC) continue;
      at.set(m * 1000 + n, IDX.length);
      IDX.push(((n + H) % H) * W + ((m + W) % W));
      IDXP.push(((n + 2 * H) % (2 * H)) * (2 * W) + ((m + 2 * W) % (2 * W)));
      MM.push(m);
      NN.push(n);
    }
  for (let q = 0; q < IDX.length; q++) PAR.push(at.get(-MM[q] * 1000 - NN[q]));
}
const M = IDX.length;

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

// ---- the state ------------------------------------------------------------------------------
const OPEN = [0, 2, 0, 0.06];
const lamOf = (s) => CFG.lam0 * pow(CFG.lamr, cl(s, -0.5, 1.3));
const epsOf = (s) => CFG.eps0 * pow(CFG.epsr, cl(s, -1, 1));

function start(params, k) {
  const vec = () => new Float64Array(M), full = () => new Float64Array(N), big = () => new Float64Array(4 * N);
  const S = {
    tr: vec(), ti: vec(), n0r: vec(), n0i: vec(), n1r: vec(), n1i: vec(), u1r: vec(), u1i: vec(), // modes and stages
    kx: vec(), ky: vec(), k2: vec(), L: vec(), E: vec(), // wavenumbers (model units), growth rate, exp(L h)
    ar: full(), ai: full(), br: full(), bi: full(), pr: full(), pi: full(), cr: full(), ci: full(), ux: full(), uy: full(),
    qr: big(), qi: big(), qf: big(), // the 2x grid
    lam: -1, eps: -1, vmax: 0, kmax: 1, t: 0,
    f: full(), fp: full(), tc: full(), ts: full(), oa: new Float64Array(N / 4), ob: new Float64Array(N / 4), oe: new Float64Array(N / 4), ot: new Float64Array(N / 4), have: 0, vs: 0.025, sd: 1, sdp: 1, mean: 0, meanp: 0, hue: 0, lutHue: -1, lut: new Float64Array(2 * 256 * 3),
  };
  params.s = S;
  prepare(S, lamOf(k[2]), epsOf(k[3]));
  for (let q = 0; q < M; q++) {
    if (PAR[q] < q) {
      S.tr[q] = S.tr[PAR[q]];
      S.ti[q] = -S.ti[PAR[q]];
    } else if (PAR[q] !== q) {
      S.tr[q] = 0.002 * gauss();
      S.ti[q] = 0.002 * gauss();
    }
  }
  advance(S, 2, 0.1);
  advance(S, CFG.preroll, min(0.8, CFG.eh / S.eps));
  render(S, 0);
}

// What depends on the knobs: the wavenumbers in model units (k_c = 1), and so L.
function prepare(S, lam, eps) {
  if (lam === S.lam && eps === S.eps) return;
  S.lam = lam;
  S.eps = eps;
  for (let q = 0; q < M; q++) {
    const x = (lam * MM[q]) / 64, y = (lam * NN[q]) / 128, d = 1 - x * x - y * y;
    S.kx[q] = x;
    S.ky[q] = y;
    S.k2[q] = x * x + y * y;
    S.L[q] = eps - d * d;
  }
  S.kmax = (lam * KC) / 64;
}

// ---- the equation ---------------------------------------------------------------------------
// out = -g_m U . grad psi at the retained modes. With doU the mean flow is rebuilt from psi,
// otherwise the one from the last rebuild is used.
function advect(S, tr, ti, outR, outI, doU) {
  const { ar, ai, br, bi, pr, pi, cr, ci, ux, uy, kx, ky, k2 } = S;
  ar.fill(0);
  ai.fill(0);
  for (let q = 0; q < M; q++) {
    const a = tr[q], b = ti[q], o = IDX[q], x = kx[q], y = ky[q];
    ar[o] = -x * b - y * a;
    ai[o] = x * a - y * b;
  }
  F1.ifft2(ar, ai); // psi_x, psi_y
  if (doU) {
    br.fill(0);
    bi.fill(0);
    for (let q = 0; q < M; q++) {
      const a = tr[q], b = ti[q], o = IDX[q], x = kx[q], y = ky[q], d = 1 - k2[q];
      br[o] = d * (-x * b - y * a);
      bi[o] = d * (x * a - y * b);
    }
    F1.ifft2(br, bi); // r_x, r_y with r = lap psi + psi
    for (let p = 0; p < N; p++) pr[p] = ar[p] * bi[p] - ai[p] * br[p]; // J = psi_x r_y - psi_y r_x
    F1.fft2real(pr, pi);
    cr.fill(0);
    ci.fill(0);
    for (let q = 0; q < M; q++) {
      if (k2[q] === 0) continue;
      const o = IDX[q], s = -1 / (N * k2[q]), zr = pr[o] * s, zi = pi[o] * s;
      cr[o] = kx[q] * zr - ky[q] * zi;
      ci[o] = kx[q] * zi + ky[q] * zr;
    }
    F1.ifft2(cr, ci); // U = (zeta_y, -zeta_x)
    let vm = 0;
    for (let p = 0; p < N; p++) {
      const a = cr[p] * CFG.gm, b = ci[p] * CFG.gm, v = abs(a) + abs(b);
      ux[p] = a;
      uy[p] = b;
      if (v > vm) vm = v;
    }
    S.vmax = vm;
  }
  for (let p = 0; p < N; p++) pr[p] = -(ux[p] * ar[p] + uy[p] * ai[p]);
  F1.fft2real(pr, pi);
  for (let q = 0; q < M; q++) {
    outR[q] = pr[IDX[q]] / N;
    outI[q] = pi[IDX[q]] / N;
  }
}

// psi_t = -g2 psi^2 and then psi_t = -psi^3, each solved exactly point by point over h, on the
// 128 x 256 array so that the products have no aliasing, then cut back to the retained modes.
function local(S, h) {
  const { qr, qi, qf, tr, ti } = S;
  const g = CFG.g2 * h, GN = F2.GN;
  qr.fill(0);
  qi.fill(0);
  for (let q = 0; q < M; q++) {
    qr[IDXP[q]] = tr[q];
    qi[IDXP[q]] = ti[q];
  }
  F2.ifft2real(qr, qi, qf);
  for (let p = 0; p < GN; p++) {
    const v = qf[p], w = 1 + g * v;
    qf[p] = v / sqrt(w * w + 2 * h * v * v);
  }
  F2.fft2real(qf, qi);
  for (let q = 0; q < M; q++) {
    tr[q] = qf[IDXP[q]] / GN;
    ti[q] = qi[IDXP[q]] / GN;
  }
}

// One step of h: the linear part exactly, the advection by Heun's rule in integrating-factor
// form with the mean flow of the start of the step, then the local terms.
function step(S, h) {
  const { tr, ti, n0r, n0i, n1r, n1i, u1r, u1i, L, E } = S;
  for (let q = 0; q < M; q++) E[q] = exp(L[q] * h);
  advect(S, tr, ti, n0r, n0i, true);
  for (let q = 0; q < M; q++) {
    u1r[q] = E[q] * (tr[q] + h * n0r[q]);
    u1i[q] = E[q] * (ti[q] + h * n0i[q]);
  }
  advect(S, u1r, u1i, n1r, n1i, false);
  for (let q = 0; q < M; q++) {
    tr[q] = E[q] * tr[q] + 0.5 * h * (E[q] * n0r[q] + n1r[q]);
    ti[q] = E[q] * ti[q] + 0.5 * h * (E[q] * n0i[q] + n1i[q]);
  }
  local(S, h);
  // The field is real, so a mode and its mirror are conjugates. The rounding in the transforms
  // does not keep them so, and the part that is not grows at the rate of the roll modes.
  for (let q = 0; q < M; q++) {
    const p = PAR[q];
    if (p < q) continue;
    if (p === q) {
      ti[q] = 0;
      continue;
    }
    const a = 0.5 * (tr[q] + tr[p]), b = 0.5 * (ti[q] - ti[p]);
    tr[q] = tr[p] = a;
    ti[q] = b;
    ti[p] = -b;
  }
  S.t += h;
}

// Model time Ht, in nearly equal steps no longer than hmax and no longer than the mean flow
// allows, with the mean flow the last step measured.
function advance(S, Ht, hmax) {
  for (let left = Ht; left > 1e-9; ) {
    const hc = min(hmax, CFG.cfl / (max(S.vmax, 0.05) * min(S.kmax, CFG.kcfl)));
    const h = left / ceil(left / hc - 1e-9);
    step(S, h);
    left -= h;
  }
}

// ---- the frame ------------------------------------------------------------------------------
export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1);
  prepare(S, lamOf(k[2]), epsOf(k[3]));
  S.hue = k[0];
  // Model time per panel second c holds the rms stripe speed at CFG.speed LEDs a second per
  // unit of Flow, from the speed the last frame measured.
  const c = cl((cl(k[1], 0.3, 3) * CFG.speed) / S.vs, 2, 80), Ht = min(ft * c, 1.6);
  if (Ht > 0) advance(S, Ht, min(1.2, CFG.eh / S.eps));
  render(S, Ht);
  if (!(S.sd < 20)) {
    params.s = null; // a blown field, which has not happened in any run: begin again
    update(dt, input, params);
  }
}

// psi on the LEDs, its rms, and the rms stripe speed from the change since the last frame.
function render(S, Ht) {
  const { ar, ai, f, fp, tr, ti } = S;
  ar.fill(0);
  ai.fill(0);
  for (let q = 0; q < M; q++) {
    ar[IDX[q]] = tr[q];
    ai[IDX[q]] = ti[q];
  }
  F1.ifft2real(ar, ai, f);
  let m = 0;
  for (let p = 0; p < N; p++) m += f[p];
  m /= N;
  let s2 = 0;
  for (let p = 0; p < N; p++) s2 += (f[p] - m) * (f[p] - m);
  S.mean = m;
  S.sd = sqrt(s2 / N) || 1;
  if (S.have && Ht > 0) {
    // Both frames over their own rms, so that a field growing or fading as a whole is not read as motion.
    const a = 1 / S.sd, b = 1 / S.sdp;
    let d2 = 0, g2 = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const p = y * W + x, dx = f[y * W + ((x + 1) & 63)] - f[y * W + ((x + 63) & 63)], dy = f[((y + 1) & 127) * W + x] - f[((y + 127) & 127) * W + x];
        g2 += 0.25 * (dx * dx + dy * dy) * a * a;
        const d = (f[p] - m) * a - (fp[p] - S.meanp) * b;
        d2 += d * d;
      }
    // A frame that changes more than 2.5 times the running speed (a knob thrown across its range) cannot stop the clock.
    const v = min(sqrt(d2 / g2) / Ht, 2.5 * S.vs);
    S.vs += (v - S.vs) * (1 - exp(-Ht / 10));
  }
  fp.set(f);
  S.meanp = m;
  S.sdp = S.sd;
  S.have = 1;
  orient(S);
}

// The orientation of the stripes. gx, gy of psi go into the structure tensor, pooled 2 by 2 and
// blurred three times by a box of 3 cells (a Gaussian of 2.8 LEDs); cos 2 theta and sin 2 theta
// times the coherence come out per LED, tc and ts, by bilinear lookup.
function orient(S) {
  const { f, oa, ob, oe, ot, tc, ts } = S, HW = W / 2, HH = H / 2;
  for (let y = 0; y < HH; y++)
    for (let x = 0; x < HW; x++) {
      let a = 0, b = 0, e = 0;
      for (let k = 0; k < 4; k++) {
        const X = 2 * x + (k & 1), Y = 2 * y + (k >> 1);
        const gx = f[Y * W + ((X + 1) & 63)] - f[Y * W + ((X + 63) & 63)], gy = f[((Y + 1) & 127) * W + X] - f[((Y + 127) & 127) * W + X];
        a += gx * gx - gy * gy;
        b += 2 * gx * gy;
        e += gx * gx + gy * gy;
      }
      oa[y * HW + x] = a;
      ob[y * HW + x] = b;
      oe[y * HW + x] = e;
    }
  for (const v of [oa, ob, oe])
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < HH; y++) {
        const r = y * HW;
        for (let x = 0; x < HW; x++) ot[r + x] = (v[r + ((x + HW - 1) % HW)] + v[r + x] + v[r + ((x + 1) % HW)]) / 3;
      }
      for (let y = 0; y < HH; y++)
        for (let x = 0; x < HW; x++) v[y * HW + x] = (ot[((y + HH - 1) % HH) * HW + x] + ot[y * HW + x] + ot[((y + 1) % HH) * HW + x]) / 3;
    }
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / 2 - 0.5, j0 = floor(v), ty = v - j0, r0 = ((j0 + HH) % HH) * HW, r1 = ((j0 + 1 + HH) % HH) * HW;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / 2 - 0.5, i0 = floor(u), tx = u - i0, c0 = (i0 + HW) % HW, c1 = (i0 + 1 + HW) % HW;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      const e = w00 * oe[r0 + c0] + w10 * oe[r0 + c1] + w01 * oe[r1 + c0] + w11 * oe[r1 + c1] + 1e-9;
      tc[y * W + x] = (w00 * oa[r0 + c0] + w10 * oa[r0 + c1] + w01 * oa[r1 + c0] + w11 * oa[r1 + c1]) / e;
      ts[y * W + x] = (w00 * ob[r0 + c0] + w10 * ob[r0 + c1] + w01 * ob[r1 + c0] + w11 * ob[r1 + c1]) / e;
    }
  }
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Two ramps from ink to pearl, tone on the way, given as hue, saturation and luma (Rec. 601) of
// each stop, so that the two have the same brightness at every tone and at every Hue. A stripe
// that runs up and down the panel takes the cool ramp (navy to ice) and one that runs across it
// the warm ramp (plum to rose); between the two they are mixed in RGB, so the middle is a neutral grey and
// never a green. The sine of twice the angle sets how bright a stripe stands, as if the light
// came from one side.
const STOPS = [
  [
    [0, 0.62, 0.62, 0.09],
    [0.45, 0.58, 0.42, 0.3],
    [0.8, 0.52, 0.2, 0.74],
    [1, 0.5, 0.08, 0.97],
  ],
  [
    [0, 0.8, 0.55, 0.09],
    [0.45, 0.85, 0.4, 0.3],
    [0.8, 0.92, 0.2, 0.74],
    [1, 0.96, 0.1, 0.97],
  ],
];
const RGB = [0, 0, 0];

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const f = S.f, lut = S.lut, hue = cl(S.hue, 0, 1), tc = S.tc, ts = S.ts;
  if (S.lutHue !== hue) {
    S.lutHue = hue;
    for (let r = 0; r < 2; r++)
      for (let i = 0; i < 256; i++) {
        const x = i / 255, st = STOPS[r];
        let j = 1;
        while (j < st.length - 1 && x > st[j][0]) j++;
        const a = st[j - 1], b = st[j], t = cl((x - a[0]) / (b[0] - a[0]), 0, 1);
        const h = a[1] + (b[1] - a[1]) * t + hue, hh = h - floor(h), warm = sm(0.2, 0.08, abs(hh - 0.16));
        const sat = (a[2] + (b[2] - a[2]) * t) * (1 - 0.45 * warm), luma = max(a[3] + (b[3] - a[3]) * t, 0.12 + 0.1 * warm);
        hsv(h, sat, 1, RGB);
        const v = min(1, luma / (0.299 * RGB[0] + 0.587 * RGB[1] + 0.114 * RGB[2]));
        hsv(h, sat, v, RGB);
        const o = (r * 256 + i) * 3;
        lut[o] = RGB[0];
        lut[o + 1] = RGB[1];
        lut[o + 2] = RGB[2];
      }
  }
  const inv = 1 / S.sd, m = S.mean;
  for (let p = 0; p < N; p++) {
    const x = -(f[p] - m) * inv, i = (cl(0.5 + 0.5 * tanh(CFG.gain * x), 0, 1) * 255) | 0;
    const w = cl(0.5 - CFG.mix * tc[p], 0, 1), lit = 1 + CFG.lit * ts[p] * (1 - abs(2 * i / 255 - 1));
    const a = i * 3, b = (256 + i) * 3;
    display.setPixel(
      p & 63,
      p >> 6,
      (cl((lut[a] + w * (lut[b] - lut[a])) * lit, 0, 1) * 255) | 0,
      (cl((lut[a + 1] + w * (lut[b + 1] - lut[a + 1])) * lit, 0, 1) * 255) | 0,
      (cl((lut[a + 2] + w * (lut[b + 2] - lut[a + 2])) * lit, 0, 1) * 255) | 0,
    );
  }
}
