// ===== Patternflow pattern =====
// Title:   Baroclinic Eddies
// Family:  weather
// Idea:    A two-layer atmosphere on the panel's own torus, kept warm to the south and cold to the north by a mean wind shear, grows waves that steepen into fronts and curl into cut-off eddies, while a cloud carried by the upper wind is drawn into hooks, spirals and thin wisps over amber and azure air masses that never come back.
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: two-layer quasi-geostrophic flow with a uniform vertical shear on a doubly periodic box: baroclinic instability (Jule Charney, 1947; Eric Eady, 1949), the two-layer model and its instability criterion (Norman Phillips, 1951), baroclinic turbulence in a periodic box (Rick Salmon, 1980; Kerry Smith and Geoffrey Vallis, 2002), the relaxation of the temperature toward an imposed gradient (Isaac Held and Max Suarez, 1994), all from memory; Fourier modes with the two-thirds rule (Steven Orszag, 1971) and an integrating-factor three-stage SSP Runge-Kutta (Chi-Wang Shu and Stanley Osher, 1988), semi-Lagrangian transport (Andre Robert, 1981), all from memory; the transforms and the stepper reworked from Surface Quasigeostrophic, round 115
// Round:   120
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Shear=1.5..4, Scale=-1..1, Drag=-1..1
//
// Knob 1: Hue. Adds the knob to the OKLab hue of both air masses, so one turn comes back. Each air mass keeps one lightness and chroma (warm 0.84 and 0.17, cold 0.68 and 0.16), cut to fit the display, so no hue goes neon or dim. At 0 the air is amber and azure; at 0.12 lime and violet, at 0.25 mint and orchid, at 0.4 sky blue and coral, at 0.5 periwinkle and ochre, at 0.75 rose and emerald. Over hues sampled every 0.05 the dimmest table entry has a brightest channel of 164 and a luma of 120 of 255, and the isotherm line takes 18 percent off that.
// Knob 2: Shear. The mean wind U that holds the temperature gradient, and so the clock: model time per panel second is 1.5 times the knob, 3 at the opening 2, 2.25 at 1.5 and 6 at 4. Drag and relaxation are given in units of kd U, so the knob changes the pace and the wind speeds, not the kind of weather. At the opening the winds have an rms speed of 2.7 U (8 LEDs a second), the mean panel maximum of |u| + |v| is 10.7 U (32 LEDs a second), and a steering wind of 1 U carries the picture east at 3 LEDs a second. Waves grow by a factor e in 5.8 s. A frame takes at most 8 steps; past that the weather runs slower than the clock.
// Knob 3: Scale. The deformation radius Ld = 3.3 x 1.3^Scale LEDs: 2.54, 3.3 and 4.29. The fastest growing wave is 9.76 Ld long, 24.8, 32.2 and 41.9 LEDs, two waves across the 64 LED width at 0. Measured over 900 s at the opening drag the energy-weighted wavelength of the flow is 33.2, 43.0 and 49.1 LEDs at -1, 0 and 1. Turning the knob keeps the stream functions and re-forms the potential vorticity from them, so the picture changes by degrees.
// Knob 4: Drag. Bottom drag on the lower layer, r = 0.4 x 1.4^Drag x kd U: 0.29 at -1, 0.41 at the opening, 0.56 at 1. Thermal relaxation stays at 0.3 kd U. The mean energy over 900 s at Shear 2 is 31.2 U^2 at -1, 14.8 at the opening and 5.3 at 1, and the isotherms stand 11.3, 8.6 and 5.1 LEDs (rms) off the places the mean gradient gives them. At -1 the bands fold over each other and shed many eddies; at 1 they run as long waves with a few.

// What the field is. Two layers of air of equal depth lie on a torus 64 LEDs wide (x, east, to the right) and 128 tall (y,
// north, up the panel). The upper layer has a mean wind +U and the lower -U. By thermal wind balance that shear is a
// temperature gradient of U per LED across the panel, warm at the bottom and cold at the top, and the tilt is a store of
// potential energy that a wave can release. With stream functions psi_1, psi_2, F = kd^2 / 2 and kd = 1 / Ld, the potential
// vorticity is q_1 = del^2 psi_1 + F (psi_2 - psi_1) and q_2 = del^2 psi_2 + F (psi_1 - psi_2). Its departures from the
// mean flow obey
//   d q_i / dt + (U_i + c) d q_i / dx + J(psi_i, q_i) + B_i d psi_i / dx = - kappa s_i - r del^2 psi_2 (layer 2 only) - nu_k q_i,
//   B_1 = beta + kd^2 U,  B_2 = beta - kd^2 U,  s_i = F (psi_j - psi_i),  nu_k = 3 (kappa / 8)^8 per model time.
// B_i is the gradient of the layer's mean PV, beta plus the tilt of the interface; the two have opposite signs when beta
// is under kd^2 U, which is the instability. s_i is the stretching part of q_i, so kappa relaxes the interface back toward
// the imposed tilt (the Newtonian cooling of Held and Suarez). r is bottom drag. c is a steering wind, the same in both
// layers, which moves the picture and nothing else. Nothing is stirred in: the shear is the only source. The temperature
// is the interface height tau = (psi_1 - psi_2) / 2 added to the mean tilt, T = -U y + tau.
// The scheme. Fourier modes with m 2 pi / 64 across and n 2 pi / 128 up, kappa^2 = m^2 + n^2 / 4 up to 8, wavelengths down
// to 8 LEDs, on a 32 x 64 grid of 2 x 2 LED cells. The two-thirds rule is exact: two modes of 8 make at most 16, which
// aliases to 16 or more, outside the retained 8. Two inverse transforms per frame put tau and the upper wind on the
// panel's 64 x 128 grid. The step is the integrating-factor form of the three-stage SSP Runge-Kutta: the mean winds, the
// steering wind and the hyperviscosity go in exactly. A step is at most 1.1 over the fastest eddy's |u| + |v| times the
// largest wavenumber, and a frame takes 1 to 8 of them.
// What keeps it going. With bottom drag alone the energy never settled: at r = 0.15 kd U an early trial on the 64 x 128
// grid reached E = 200, 80 to 95 percent of it barotropic, with gusts of 50 U, and at r = 8 kd U it was still doubling
// every 50 time units at t = 300, since drag acts on the relative vorticity of one layer and the damped linear problem
// stays unstable. The relaxation of the interface bounds it. Beta stays at 0.1 kd^2 U: at 0.4 a trial went to stiff zonal
// bands. E falls about as r^-2.6 between 0.29 and 0.56 kd U. The pre-run starts from random phases scaled to that energy.
// The picture. The arrays are read from the bottom row up, so north is up the panel and the map is right-handed: an
// earlier version read the model's y down the panel and drew the temperature anomaly against the wrong sign of the mean
// tilt. The isotherm a point sits on is y - tau / U LEDs up from the bottom; four bands fit the 128 rows, so
// phase = 4 (y - tau / U) / 128 is periodic over the edges. s = tanh(g sin 2 pi phase) / tanh g gives amber for s > 0 and
// azure for s < 0, pale where s = 0, with g = 2.2 times |grad T| over 1.2 times the mean gradient (cut to 0.7 to 2.4), so a
// seam is sharpest where isotherms crowd. A thin darker line (18 percent) runs down the middle of each air mass. |grad T|
// over its mean had a median of 1.2 and a 99th percentile of 2.3 at E = 9 and 2.7 at E = 33, so fronts in T are soft;
// the cloud carries the fine structure.
// The cloud is a tracer c on the 64 x 128 grid, d c / dt + (U + c_steer + u_1) . grad c = - (c - s) / 8, carried by the
// upper layer's wind (its mean wind, the steering wind and the wind of psi_1, from the same modes) in semi-Lagrangian
// midpoint steps with a Catmull-Rom lookup clamped to the local extremes, so c stays in [0, 1] and nothing rings. The
// source is s = smoothstep(0.65, 1.2, n + 0.22 warm + 1.3 front): n is five large waves that wander at their own rates,
// warm is the amber side of the colour, front is |grad T| from 1.4 to 2.2 times the mean. The cloud is stirred for 13
// model time units before the first frame. It is drawn toward white, by at most 0.85, after twice and a half of its
// departure from a blur of itself is added, which lifts thin wisps over broad cloud; a front glows by at most 0.3.
//
// What was checked, on this file's solver (the harnesses are not in the repository).
// 1. Linear growth. A single mode of amplitude 1e-9 against sigma = kx sqrt(U^2 K^4 (4 F^2 - K^4) - beta^2 F^2) / (K^2 (K^2 + 2 F)),
//    derived here from the 2 x 2 problem for layers +-U, over a window after a spin-up of 8 / sigma. Ld 3.3: mode (2,0)
//    0.125507 against 0.125511 at steps of 0.2; at steps of 0.4 (1,0) 0.99938, (3,0) 0.99963, (2,2) 0.99983 of the formula, and
//    (2,0) with beta / (kd^2 U) = 0.3, 0.6, 0.7 0.99964, 0.99902, 0.99793. At Ld 2.54, K / kd = 0.997, (4,0) is 0.99708,
//    0.99966, 0.99996 at steps of 0.4, 0.2, 0.1. For beta = 0 the fastest wave has k = 0.6435 kd, a wavelength of 9.76 Ld
//    (32.2 LEDs at the opening, two waves on the torus) and sigma = (sqrt 2 - 1) kd U = 0.1255. The margin is K = kd, not
//    sqrt 2 kd, since F_1 = F_2 = F gives K^2 = 2 F = kd^2: (4,0) at 0.997 grows at 0.01982, (5,0) at 1.247 held its
//    amplitude to 0.05 percent per 150 time units. Phillips' criterion beta < F (U_1 - U_2) = kd^2 U: the fastest mode of
//    the torus, by the eigenvalues of every mode's 2 x 2 matrix, has sigma 0.1255, 0.1154, 0.0947, 0.0527, 0.0373, 0.0180 at
//    beta / (kd^2 U) = 0, 0.3, 0.5, 0.8, 0.9, 0.97 and 0 at 1 and 1.05; the code gives them to 3e-5 at steps of 0.1 and
//    0.23 percent at 0.4.
// 2. Energy. With U = 0, beta = 0 and no drag, relaxation or viscosity, E changed over 20 time units from E = 10 by -2.6e-3,
//    -4.7e-4, -4.6e-5, -6.7e-6 at steps of 0.2, 0.1, 0.05, 0.025 (the pattern runs at a CFL of about 1.1). With the shear and
//    no friction, E(t) - E(0) from E = 0.02 to 3 against the integral of 2 kd^2 U <v tau> (the conversion of the tilt, v the
//    barotropic northward wind): 2.99234 and 2.99235 at steps of 0.04, 2.98372 and 2.98372 at 0.01. The heat flux was
//    positive in all but 3 of 807 steps. On the panel's arrays, the upper wind's northward component times tau, averaged over
//    the panel, was positive at all 179 samples of a 900 s run (mean 9.7 at the opening).
// 3. Time stepping. From a developed state, 2 time units against 1024 steps: relative error 7.8e-5, 1.0e-5, 1.3e-6, 1.6e-7,
//    2.0e-8 for 10, 20, 40, 80, 160 steps, a ratio of 7.8 to 8.0 per halving. The pattern takes about 15.
// 4. The steering wind. Runs from one state with and without c, 9 time units: they differ by the shift c t = 4.5 LEDs to 4.7e-14.
// 5. Resolution. In 3000 time units at the opening, mean E is 11.1, 14.9 and 16.0 with the modes cut at kappa 6, 8 and 10,
//    isotherm displacement 7.54, 8.48 and 8.74 LEDs, so 8 loses 7 percent of the energy against 10 and 6 loses 31. The shell
//    at the cut-off holds 2.9e-5 of the peak shell's energy at the opening, 1.5e-4 at the smallest Ld and lowest drag.
// 6. Steady state, 900 s, Scale 0, Shear 2, mean of E (min to max), barotropic kinetic share of E, energy-weighted
//    wavelength, rms isotherm displacement: opening 14.8 (4.8 to 31), 0.42, 43.0 LEDs, 8.6; Drag -1 31.2 (12 to 77), 0.53,
//    46.8, 11.3; Drag 1 5.3 (2.6 to 11), 0.42, 36.8, 5.1; at Drag 0.06 Scale -1 11.3 (6.5 to 18), 0.42, 33.2, 5.9; Scale 1
//    14.8 (5.1 to 51), 0.51, 49.1, 9.9. No NaN or blow-up at any corner, nor in four runs of 600 s with the knobs jumped at
//    random every 3 s (E 2.05 to 54.7).
// 7. The cloud over 900 s: c stayed between 0 and 0.9834 in all samples (every 5 s), with a mean of 0.263 at the opening
//    (0.271 in the first quarter, 0.256 in the last) and 16.5 percent of the panel above 0.5; at Shear 4, Drag -1 the mean
//    was 0.325 and 24.5 percent; at Shear 1.5, Scale 1, Drag 1 it was 0.231 and 13.7.
// 8. Cost, each run on its own. A frame (update and draw) takes 2.86 ms at the opening, 3.14 with every knob at its minimum
//    and 3.85 at its maximum; the first frame, with its 14 time units of pre-run and 13 of cloud, 155 to 385 ms.
//
// Weak spots. The shear is imposed, not set by the eddies, so there is no equilibrated mean state and no jet, and energy goes
// as a steep power of drag. The fields are smooth (the energy spectrum falls as kappa^-4.6 to -5.6 between 3 and 6), so
// fronts in T do not sharpen into lines; the fine structure is the cloud's, a passive tracer with a rule for a source, not
// microphysics, and semi-Lagrangian transport smooths its thinnest wisps to 2 or 3 LEDs. The picture is statistically
// steady, not a life cycle: curled fronts, spirals and cut-off eddies come and go, but nothing occludes on purpose. Four
// isotherm bands is a choice of contour interval; at Drag -1 the bands fold narrow.

const W = 64, H = 128, N = W * H; // the panel and the picture
const GW = 32, GH = 64, GN = GW * GH; // the grid the equations are solved on
const { floor, ceil, max, min, abs, sqrt, exp, log, pow, sin, cos, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the grid -------------------------------------------------------------------------------
// A mode (m, n) has kx = K0 m and ky = K0 n / 2, K0 = 2 pi / 64 per LED, so kappa^2 = m^2 + (n/2)^2.
// Modes above kappa KC are dropped after every product.
const K0 = TAU / W, KC = 8, KMAX = K0 * KC;

// The tunables. Model time is the time of the equations above, in units where U = 1 LED per time unit. Rates marked "over
// kd U" are multiplied by kd U, so a change of Shear or Scale leaves the kind of weather alone.
const CFG = {
  ld: 3.3, // deformation radius at Scale 0, LEDs
  ldr: 1.3, // factor per unit of Scale
  beta: 0.1, // beta over kd^2 U
  rate: 0.4, // bottom drag at Drag 0, per model time, over kd U
  rdr: 1.4, // factor per unit of Drag
  relax: 0.3, // thermal relaxation of the interface, per model time, over kd U
  drift: 1, // steering wind, over U
  clock: 1.5, // model time per panel second per unit of Shear
  nuc: 3, // hyperviscous rate at kappa = KC, per model time
  up: 8, // power of kappa / KC in the hyperviscosity
  e0: 14, // energy the flow settles at, Drag 0, Scale 0
  pre: 14, // model time of the pre-run
  spin: 22, // steps of 0.6 the cloud is stirred before the first frame
  tc: 8, // relaxation time of the cloud toward its source, model time
  n0: 0.65, // the source: cloud starts where noise + warmth + front passes this
  n1: 1.2, // and is complete here
  cw1: 0.22, // weight of the warm air in it
  cf: 1.3, // weight of the fronts in it
  sf0: 1.4, // a front for the source starts at this |grad T| over the mean
  sf1: 2.2, // and is complete here
  c0: 0.2, // cloud below this value is not shown
  c1: 0.8, // and fully shown above this one
  ud: 2.5, // how much of the cloud's departure from its blur is added
  cg: 1.6, // w -> w (cg + (1 - cg) w): cg 1 is linear, 2 puts everything on the bright wisps
  cmax: 0.85, // how far toward white full cloud goes
  bands: 4, // isotherm bands over the panel height
  g: 2.2, // sharpness of the colour step at a band edge where |grad T| is the mean
  gref: 1.2, // it grows with |grad T| over this, between glo and ghi times g
  glo: 0.7,
  ghi: 2.4,
  hw: 0.225, // OKLab hue of the warm air, in turns (amber), and
  hc: 0.68, // of the cold air (azure)
  lw: 0.84, // lightness and chroma of the warm air,
  cw2: 0.17,
  lc: 0.68, // of the cold air,
  cc: 0.16,
  ls: 0.93, // and of a seam
  cs: 0.05,
  core: 0.18, // depth of the thin isotherm line down the middle of each air mass
  cw: 0.03, // its width, in bands
  f0: 1.3, // a front starts to glow where |grad T| is this multiple of the mean gradient
  f1: 2.6, // and glows fully here
  fw: 0.3, // how far toward white a front goes
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

// A grid of w columns and h rows. Only the columns that carry modes (|m| <= KC) are transformed
// along the columns.
function grid(w, h) {
  const cols = [];
  for (let j = 0; j < w; j++) if (abs(j < w / 2 ? j : j - w) <= KC) cols.push(j);
  return { w, h, Tw: table(w), Th: table(h), cols, cr: new Float64Array(h), ci: new Float64Array(h) };
}
const GS = grid(GW, GH), GF = grid(W, H);

// Modes at their slots (zero elsewhere) to the field, unnormalised.
function ifft2(G, re, im) {
  const { w, h, Tw, Th, cols, cr, ci } = G;
  for (const j of cols) {
    for (let i = 0, p = j; i < h; i++, p += w) {
      cr[i] = re[p];
      ci[i] = im[p];
    }
    fft1(ci, cr, 0, Th);
    for (let i = 0, p = j; i < h; i++, p += w) {
      re[p] = cr[i];
      im[p] = ci[i];
    }
  }
  for (let i = 0; i < h; i++) fft1(im, re, i * w, Tw);
}

// A complex field to its modes, unnormalised, at the retained columns only.
function fft2(G, re, im) {
  const { w, h, Tw, Th, cols, cr, ci } = G;
  for (let i = 0; i < h; i++) fft1(re, im, i * w, Tw);
  for (const j of cols) {
    for (let i = 0, p = j; i < h; i++, p += w) {
      cr[i] = re[p];
      ci[i] = im[p];
    }
    fft1(cr, ci, 0, Th);
    for (let i = 0, p = j; i < h; i++, p += w) {
      re[p] = cr[i];
      im[p] = ci[i];
    }
  }
}

// ---- the modes ------------------------------------------------------------------------------
// SLOT is a mode's place on the solving grid, FLOT its place on the picture's grid, PAR the mode
// (-m, -n), whose coefficient is the complex conjugate because the field is real.
const SLOT = [], FLOT = [], KX = [], KY = [], KAP = [], KK = [], PAR = [];
{
  const at = new Map();
  for (let n = -GH / 2 + 1; n < GH / 2; n++)
    for (let m = -KC; m <= KC; m++) {
      const k2 = m * m + (n * n) / 4;
      if (k2 > KC * KC || m < 0 || (m === 0 && n <= 0)) continue;
      for (const [a, b] of [[m, n], [-m, -n]]) {
        at.set(a + "," + b, SLOT.length);
        SLOT.push(((b + GH) % GH) * GW + ((a + GW) % GW));
        FLOT.push(((b + H) % H) * W + ((a + W) % W));
        KX.push(K0 * a);
        KY.push((K0 * b) / 2);
        KAP.push(sqrt(k2));
        KK.push(K0 * K0 * k2);
      }
    }
  for (let q = 0; q < SLOT.length; q += 2) {
    PAR.push(q + 1, q);
  }
}
const M = SLOT.length;

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

// ---- the state ------------------------------------------------------------------------------
// Two layers of equal depth, q1 and q2 the potential vorticity departures of the upper (mean wind
// +U) and lower (-U) layer, stored as one array of 2 M modes each for real and imaginary parts.
// Large-scale waves that wander under the cloud source: x wavenumber, y wavenumber (in 2 pi / 64 and 2 pi / 128),
// angular speed per model time, amplitude.
const NZ = [[1, 1, 0.037, 0.5], [2, 1, -0.052, 0.4], [1, 3, 0.061, 0.35], [3, 2, -0.043, 0.3], [2, 5, 0.071, 0.25]];
const OPEN = [0, 2, 0, 0.06];
const STEPS = 8; // most steps a frame takes; past that the weather runs slower than the clock
const rateOf = (k) => CFG.rate * pow(CFG.rdr, cl(k[3], -1, 1));
const ldOf = (k) => CFG.ld * pow(CFG.ldr, cl(k[2], -1, 1));

function build(params, k) {
  const v2 = () => new Float64Array(2 * M), gf = () => new Float64Array(GN), full = () => new Float64Array(N);
  const S = {
    qr: v2(), qi: v2(),
    n0r: v2(), n0i: v2(), n1r: v2(), n1i: v2(), n2r: v2(), n2i: v2(),
    u1r: v2(), u1i: v2(), u2r: v2(), u2i: v2(),
    ehr: v2(), ehi: v2(),
    psr: v2(), psi: v2(), wsr: v2(), wsi: v2(),
    ar: gf(), ai: gf(), br: gf(), bi: gf(), cr: gf(), ci: gf(), dr: gf(), di: gf(), pr: gf(), pi: gf(),
    fr: full(), fi: full(),
    kd: 0, F: 0, beta: 0, r: 0, kap: 0, U: 1, umax: 0, t: 0,
    tau: full(), gm: full(), cu: full(), cv: full(), cld: full(), cld2: full(), blur: full(), src: full(), hue: 0, lutHue: -1,
    lut: new Uint8Array(LUT * 3), line: new Float64Array(LUT), nph: [], nax: new Float64Array(NZ.length * W * 2), nay: new Float64Array(NZ.length * H * 2),
  };
  for (let k = 0; k < NZ.length; k++) S.nph.push(TAU * Math.random());
  params.s = S;
  prepare(S, ldOf(k), rateOf(k));
  // Random phases, an amplitude that peaks near kappa 2.5, scaled to the energy the drag settles at.
  for (let l = 0; l < 2; l++)
    for (let q = 0; q < M; q += 2) {
      const o = l * M + q, a = KAP[q] * exp(-(KAP[q] * KAP[q]) / 12);
      S.qr[o] = S.qr[o + 1] = a * gauss();
      S.qi[o] = a * gauss();
      S.qi[o + 1] = -S.qi[o];
    }
  const e0 = energy(S), sc = sqrt((CFG.e0 * pow((CFG.rate * S.kd) / S.r, 2.6)) / e0);
  for (let q = 0; q < 2 * M; q++) {
    S.qr[q] *= sc;
    S.qi[q] *= sc;
  }
  nonlin(S, S.qr, S.qi, S.n0r, S.n0i);
  advance(S, 0, CFG.pre);
  // The cloud starts at its source and is stirred for a while before the first frame.
  render(S);
  S.cld.set(S.src);
  for (let i = 0; i < CFG.spin; i++) {
    advance(S, 0.6);
    render(S);
    tracer(S, 0.6);
  }
}

// Stream functions of the state, into S.psr and S.psi.
function invert(S) {
  const { qr, qi, psr, psi, F } = S;
  for (let q = 0; q < M; q++) {
    const k2 = KK[q], det = 1 / (k2 * (k2 + 2 * F));
    const a1 = qr[q], b1 = qi[q], a2 = qr[M + q], b2 = qi[M + q];
    psr[q] = -((k2 + F) * a1 + F * a2) * det;
    psi[q] = -((k2 + F) * b1 + F * b2) * det;
    psr[M + q] = -(F * a1 + (k2 + F) * a2) * det;
    psi[M + q] = -(F * b1 + (k2 + F) * b2) * det;
  }
}

// Kinetic plus available potential energy, E = sum over modes of K^2 |psi_bt|^2 + (K^2 + kd^2) |tau|^2.
function energy(S) {
  invert(S);
  const { psr, psi, kd } = S;
  let e = 0;
  for (let q = 0; q < M; q++) {
    const br = psr[q] + psr[M + q], bi = psi[q] + psi[M + q], tr = psr[q] - psr[M + q], ti = psi[q] - psi[M + q];
    e += 0.25 * (KK[q] * (br * br + bi * bi) + (KK[q] + kd * kd) * (tr * tr + ti * ti));
  }
  return e;
}

// What depends on the knobs. A change of the deformation radius keeps the stream functions and
// re-forms the PV from them.
function prepare(S, ld, rate) {
  const kd = 1 / ld, F = 0.5 * kd * kd;
  if (S.F !== F) {
    if (S.F > 0) {
      invert(S);
      const dF = F - S.F;
      for (let q = 0; q < M; q++) {
        const p1r = S.psr[q], p1i = S.psi[q], p2r = S.psr[M + q], p2i = S.psi[M + q];
        S.qr[q] += dF * (p2r - p1r);
        S.qi[q] += dF * (p2i - p1i);
        S.qr[M + q] += dF * (p1r - p2r);
        S.qi[M + q] += dF * (p1i - p2i);
      }
    }
    S.F = F;
    S.kd = kd;
  }
  S.beta = CFG.beta * kd * kd;
  S.r = rate * kd;
  S.kap = CFG.relax * kd;
}

// ---- one evaluation of the right side --------------------------------------------------------
// out = -J(psi_i, q_i) - B_i d psi_i / dx + drag + relaxation, B_1 = beta + kd^2 U, B_2 = beta - kd^2 U.
function nonlin(S, tr, ti, outR, outI) {
  const { ar, ai, br, bi, cr, ci, dr, di, pr, pi, wsr: psr, wsi: psi, F } = S;
  ar.fill(0);
  ai.fill(0);
  br.fill(0);
  bi.fill(0);
  cr.fill(0);
  ci.fill(0);
  dr.fill(0);
  di.fill(0);
  for (let q = 0; q < M; q++) {
    const k2 = KK[q], det = 1 / (k2 * (k2 + 2 * F)), o = SLOT[q], x = KX[q], y = KY[q];
    const a1 = tr[q], b1 = ti[q], a2 = tr[M + q], b2 = ti[M + q];
    const p1r = -((k2 + F) * a1 + F * a2) * det, p1i = -((k2 + F) * b1 + F * b2) * det;
    const p2r = -(F * a1 + (k2 + F) * a2) * det, p2i = -(F * b1 + (k2 + F) * b2) * det;
    psr[q] = p1r;
    psi[q] = p1i;
    psr[M + q] = p2r;
    psi[M + q] = p2i;
    ar[o] = -(x * p1r - y * p1i);
    ai[o] = -(x * p1i + y * p1r);
    cr[o] = -(x * p2r - y * p2i);
    ci[o] = -(x * p2i + y * p2r);
    br[o] = -(y * a1 + x * b1);
    bi[o] = x * a1 - y * b1;
    dr[o] = -(y * a2 + x * b2);
    di[o] = x * a2 - y * b2;
  }
  ifft2(GS, ar, ai);
  ifft2(GS, br, bi);
  ifft2(GS, cr, ci);
  ifft2(GS, dr, di);
  let um = 0;
  for (let p = 0; p < GN; p++) {
    const u1 = ar[p], v1 = ai[p], u2 = cr[p], v2 = ci[p];
    pr[p] = u1 * br[p] + v1 * bi[p];
    pi[p] = u2 * dr[p] + v2 * di[p];
    const s = max(abs(u1) + abs(v1), abs(u2) + abs(v2));
    if (s > um) um = s;
  }
  S.umax = um;
  fft2(GS, pr, pi);
  const sc = -0.5 / GN, B1 = S.beta + S.kd * S.kd * S.U, B2 = S.beta - S.kd * S.kd * S.U;
  for (let q = 0; q < M; q++) {
    const o = SLOT[q], o2 = SLOT[PAR[q]], fr = pr[o], fi = pi[o], gr = pr[o2], gi = pi[o2], x = KX[q];
    // P1 = (F + conj F')/2, P2 = (F - conj F')/(2 i)
    const P1r = (fr + gr) * sc, P1i = (fi - gi) * sc, P2r = (fi + gi) * sc, P2i = -(fr - gr) * sc;
    const hr = S.kap * F * (psr[q] - psr[M + q]), hi = S.kap * F * (psi[q] - psi[M + q]);
    outR[q] = P1r + B1 * x * psi[q] + hr;
    outI[q] = P1i - B1 * x * psr[q] + hi;
    outR[M + q] = P2r + B2 * x * psi[M + q] + S.r * KK[q] * psr[M + q] - hr;
    outI[M + q] = P2i - B2 * x * psr[M + q] + S.r * KK[q] * psi[M + q] - hi;
  }
}

// One step of h: integrating-factor three-stage SSP Runge-Kutta. L = -nu_k - i kx (U_l + drift).
function step(S, h) {
  const { qr, qi, n0r, n0i, n1r, n1i, n2r, n2i, u1r, u1i, u2r, u2i, ehr, ehi } = S;
  const M2 = 2 * M;
  for (let l = 0; l < 2; l++) {
    const Ul = (l === 0 ? S.U : -S.U) + CFG.drift * S.U;
    for (let q = 0; q < M; q++) {
      const o = l * M + q;
      const lr = -CFG.nuc * pow(KAP[q] / KC, CFG.up);
      const ph = -KX[q] * Ul * h, ex = exp(0.5 * lr * h);
      ehr[o] = ex * cos(0.5 * ph);
      ehi[o] = ex * sin(0.5 * ph);
    }
  }
  nonlin(S, qr, qi, n0r, n0i);
  for (let q = 0; q < M2; q++) {
    const a = ehr[q], b = ehi[q], e1r = a * a - b * b, e1i = 2 * a * b;
    const xr = qr[q] + h * n0r[q], xi = qi[q] + h * n0i[q];
    u1r[q] = e1r * xr - e1i * xi;
    u1i[q] = e1r * xi + e1i * xr;
  }
  nonlin(S, u1r, u1i, n1r, n1i);
  for (let q = 0; q < M2; q++) {
    const a = ehr[q], b = ehi[q], r2 = 1 / (a * a + b * b), mr = a * r2, mi = -b * r2;
    const xr = u1r[q] + h * n1r[q], xi = u1i[q] + h * n1i[q];
    u2r[q] = 0.75 * (a * qr[q] - b * qi[q]) + 0.25 * (mr * xr - mi * xi);
    u2i[q] = 0.75 * (a * qi[q] + b * qr[q]) + 0.25 * (mr * xi + mi * xr);
  }
  nonlin(S, u2r, u2i, n2r, n2i);
  for (let q = 0; q < M2; q++) {
    const a = ehr[q], b = ehi[q], e1r = a * a - b * b, e1i = 2 * a * b;
    const xr = u2r[q] + h * n2r[q], xi = u2i[q] + h * n2i[q];
    const yr = (e1r * qr[q] - e1i * qi[q]) / 3 + (2 / 3) * (a * xr - b * xi);
    const yi = (e1r * qi[q] + e1i * qr[q]) / 3 + (2 / 3) * (a * xi + b * xr);
    qr[q] = yr;
    qi[q] = yi;
  }
  S.t += h;
}

// Model time Ht in equal steps, none longer than the fastest eddy allows. With upto, steps of
// that length until S.t reaches it.
function advance(S, Ht, upto) {
  const hmax = 1.1 / ((S.umax + 0.2 * S.U) * KMAX);
  if (upto) {
    while (S.t < upto) step(S, min(0.5, 1.1 / ((S.umax + 0.2 * S.U) * KMAX)));
    return;
  }
  const n = max(1, ceil(Ht / hmax));
  if (n > STEPS) for (let i = 0; i < STEPS; i++) step(S, hmax);
  else for (let i = 0; i < n; i++) step(S, Ht / n);
}

// ---- the frame ------------------------------------------------------------------------------
export function setup(params, knobValues) {
  params.s = null;
  if (knobValues) build(params, knobValues);
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) build(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  prepare(S, ldOf(k), rateOf(k));
  const Ht = ft * CFG.clock * cl(k[1], 1.5, 4);
  if (ft > 0) advance(S, Ht);
  render(S);
  if (ft > 0) tracer(S, Ht);
}

// The interface height (the temperature) and the upper layer's wind on the picture's grid. The model's y
// runs north, up the panel, so the arrays are stored from the bottom row up: row 0 of the panel is the
// model's last row. gm is |grad T| over the mean gradient, src the cloud source for the frame.
function render(S) {
  invert(S);
  const { fr, fi, psr, psi, tau, gm, cu, cv } = S;
  fr.fill(0);
  fi.fill(0);
  for (let q = 0; q < M; q++) {
    const o = FLOT[q];
    fr[o] = 0.5 * (psr[q] - psr[M + q]);
    fi[o] = 0.5 * (psi[q] - psi[M + q]);
  }
  ifft2(GF, fr, fi);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tau[y * W + x] = fr[(H - 1 - y) * W + x];
  // u + i v of the upper layer: -(kx + i ky) psi_hat
  fr.fill(0);
  fi.fill(0);
  for (let q = 0; q < M; q++) {
    const o = FLOT[q], a = psr[q], b = psi[q];
    fr[o] = -(KX[q] * a - KY[q] * b);
    fi[o] = -(KX[q] * b + KY[q] * a);
  }
  ifft2(GF, fr, fi);
  const wind = (1 + CFG.drift) * S.U;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, r = (H - 1 - y) * W + x;
      cu[p] = fr[r] + wind;
      cv[p] = -fi[r];
    }
  const ph = CFG.bands / H;
  for (let y = 0; y < H; y++) {
    const yu = (y + 1) & (H - 1), yd = (y + H - 1) & (H - 1);
    for (let x = 0; x < W; x++) {
      const tx = 0.5 * (tau[y * W + ((x + 1) & (W - 1))] - tau[y * W + ((x + W - 1) & (W - 1))]);
      const ty = 0.5 * (tau[yu * W + x] - tau[yd * W + x]);
      // north is down in the array, so d tau / dy_north = -ty
      gm[y * W + x] = sqrt(tx * tx + (1 + ty) * (1 + ty));
    }
  }
  // the source of cloud: where the air is warm, along fronts, and under a slowly wandering large-scale pattern
  const { src, nph, nax, nay } = S, t = S.t;
  for (let k = 0; k < NZ.length; k++) {
    const z = NZ[k], th = (TAU * z[0]) / W, tv = (TAU * z[1]) / H, ps = nph[k] + z[2] * t;
    for (let x = 0; x < W; x++) {
      nax[(k * W + x) * 2] = cos(th * x);
      nax[(k * W + x) * 2 + 1] = sin(th * x);
    }
    for (let y = 0; y < H; y++) {
      nay[(k * H + y) * 2] = cos(tv * y + ps);
      nay[(k * H + y) * 2 + 1] = sin(tv * y + ps);
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let n = 0;
      for (let k = 0; k < NZ.length; k++) {
        const i = (k * W + x) * 2, j = (k * H + y) * 2;
        n += NZ[k][3] * (nax[i] * nay[j] - nax[i + 1] * nay[j + 1]);
      }
      const yn = H - 1 - y, u = ph * (yn - tau[p]);
      const warm = 0.5 + 0.5 * sin(TAU * (u - floor(u)));
      src[p] = cl(sm(CFG.n0, CFG.n1, n + CFG.cw1 * warm + CFG.cf * sm(CFG.sf0, CFG.sf1, gm[p])), 0, 1);
    }
}

// The cloud, a tracer carried by the upper layer's wind (its mean wind, the steering wind and the
// departure from them) over a time Ht, by semi-Lagrangian steps with a monotone Catmull-Rom lookup, and
// relaxed toward its source with a time scale CFG.tc.
function tracer(S, Ht) {
  const { cu, cv, cld, cld2, src } = S;
  const nsub = max(1, ceil((Ht * 8) / 1.5)); // sub-steps so that none moves more than about 1.5 LEDs at 8 LEDs/unit
  const h = Ht / nsub, rel = 1 - exp(-h / CFG.tc);
  for (let it = 0; it < nsub; it++) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        // midpoint departure point
        let xm = x - 0.5 * h * cu[p], ym = y - 0.5 * h * cv[p];
        let ix = floor(xm), iy = floor(ym), fx = xm - ix, fy = ym - iy;
        let i0 = (ix & (W - 1)) + (iy & (H - 1)) * W, i1 = ((ix + 1) & (W - 1)) + (iy & (H - 1)) * W;
        let i2 = (ix & (W - 1)) + ((iy + 1) & (H - 1)) * W, i3 = ((ix + 1) & (W - 1)) + ((iy + 1) & (H - 1)) * W;
        const um = (1 - fy) * ((1 - fx) * cu[i0] + fx * cu[i1]) + fy * ((1 - fx) * cu[i2] + fx * cu[i3]);
        const vm = (1 - fy) * ((1 - fx) * cv[i0] + fx * cv[i1]) + fy * ((1 - fx) * cv[i2] + fx * cv[i3]);
        const xd = x - h * um, yd = y - h * vm;
        ix = floor(xd);
        iy = floor(yd);
        fx = xd - ix;
        fy = yd - iy;
        // Catmull-Rom weights
        const wx0 = -0.5 * fx * (1 - fx) * (1 - fx), wx1 = 1 + fx * fx * (1.5 * fx - 2.5), wx2 = fx * (0.5 + fx * (2 - 1.5 * fx)), wx3 = -0.5 * fx * fx * (1 - fx);
        const wy0 = -0.5 * fy * (1 - fy) * (1 - fy), wy1 = 1 + fy * fy * (1.5 * fy - 2.5), wy2 = fy * (0.5 + fy * (2 - 1.5 * fy)), wy3 = -0.5 * fy * fy * (1 - fy);
        let v = 0, lo = 1e9, hi = -1e9;
        for (let j = -1; j <= 2; j++) {
          const row = ((iy + j) & (H - 1)) * W, wy = j === -1 ? wy0 : j === 0 ? wy1 : j === 1 ? wy2 : wy3;
          const a = cld[row + ((ix - 1) & (W - 1))], b = cld[row + (ix & (W - 1))], c = cld[row + ((ix + 1) & (W - 1))], d = cld[row + ((ix + 2) & (W - 1))];
          v += wy * (wx0 * a + wx1 * b + wx2 * c + wx3 * d);
          if (j === 0 || j === 1) {
            lo = min(lo, b, c);
            hi = max(hi, b, c);
          }
        }
        v = v < lo ? lo : v > hi ? hi : v;
        cld2[p] = v + (src[p] - v) * rel;
      }
    cld.set(cld2);
  }
}

// ---- the colour -----------------------------------------------------------------------------
const RGB = [0, 0, 0];
const LUT = 1024;
const YMIN = 0.42;
const fastTanh = (x) => (x > 3 ? 1 : x < -3 ? -1 : (x * (27 + x * x)) / (27 + 9 * x * x));

// Linear RGB of an OKLab colour (lightness L, chroma c, hue direction a, b); true if it fits the display.
function oklab(L, c, a, b, out) {
  const l = L + 0.3963377774 * a * c + 0.2158037573 * b * c, m = L - 0.1055613458 * a * c - 0.0638541728 * b * c, s = L - 0.0894841775 * a * c - 1.291485548 * b * c;
  const l3 = l * l * l, m3 = m * m * m, s3 = s * s * s;
  out[0] = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  out[1] = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  out[2] = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
  return out[0] >= 0 && out[0] <= 1 && out[1] >= 0 && out[1] <= 1 && out[2] >= 0 && out[2] <= 1;
}

// A colour from lightness L, chroma C and hue h in turns, with the chroma cut until it fits. Held at one L
// and C the hue goes round the wheel without a neon green or a dim blue. Out is gamma-coded 0..1.
function lch(L, C, h, out) {
  const a = cos(TAU * h), b = sin(TAU * h);
  let c = C;
  if (!oklab(L, C, a, b, out)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 10; i++) {
      c = 0.5 * (lo + hi);
      if (oklab(L, c, a, b, out)) lo = c;
      else hi = c;
    }
    oklab(L, lo, a, b, out);
  }
  for (let k = 0; k < 3; k++) {
    const v = cl(out[k], 0, 1);
    out[k] = v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055;
  }
}

// The colour of an air mass as a function of s, -1 (cold) through 0 (a pale seam) to 1 (warm), and the depth of
// the thin isotherm line as a function of |sin| of the phase.
function palette(S) {
  if (S.lutHue === S.hue) return;
  S.lutHue = S.hue;
  for (let i = 0; i < LUT; i++) {
    const s = (2 * i) / (LUT - 1) - 1, a = pow(abs(s), 1.3), warm = s > 0;
    lch(CFG.ls + ((warm ? CFG.lw : CFG.lc) - CFG.ls) * a, CFG.cs + ((warm ? CFG.cw2 : CFG.cc) - CFG.cs) * a, (warm ? CFG.hw : CFG.hc) + S.hue, RGB);
    const y = 0.299 * RGB[0] + 0.587 * RGB[1] + 0.114 * RGB[2];
    const w = y < YMIN ? (YMIN - y) / (1 - y) : 0;
    for (let c = 0; c < 3; c++) S.lut[i * 3 + c] = ((RGB[c] + (1 - RGB[c]) * w) * 255) | 0;
    const m = i / (LUT - 1);
    S.line[i] = 1 - CFG.core * exp(-(1 - m) / (4 * PI * PI * CFG.cw * CFG.cw));
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  const { tau, gm, cld, lut, line } = S, ph = CFG.bands / H, bl = S.cld2;
  // the cloud over a blur of itself picks out the thin wisps
  {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const o = y * W;
        bl[o + x] = (cld[o + ((x + 62) & 63)] + 4 * cld[o + ((x + 63) & 63)] + 6 * cld[o + x] + 4 * cld[o + ((x + 1) & 63)] + cld[o + ((x + 2) & 63)]) / 16;
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        S.blur[i] = (bl[((y + 126) & 127) * W + x] + 4 * bl[((y + 127) & 127) * W + x] + 6 * bl[i] + 4 * bl[((y + 1) & 127) * W + x] + bl[((y + 2) & 127) * W + x]) / 16;
      }
  }
  for (let y = 0; y < H; y++) {
    const yn = H - 1 - y;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, G = gm[p];
      let u = ph * (yn - tau[p]);
      u -= floor(u);
      const sn = sin(TAU * u), ge = CFG.g * cl(G / CFG.gref, CFG.glo, CFG.ghi);
      const sv = fastTanh(ge * sn) / fastTanh(ge), i = (((sv + 1) * 0.5 * (LUT - 1)) | 0) * 3, ln = line[((abs(sn) * (LUT - 1)) | 0)];
      const f = sm(CFG.f0, CFG.f1, G) * CFG.fw, w = sm(CFG.c0, CFG.c1, cld[p] + CFG.ud * (cld[p] - S.blur[p])), k = w * (CFG.cg + (1 - CFG.cg) * w) * CFG.cmax > f ? w * (CFG.cg + (1 - CFG.cg) * w) * CFG.cmax : f;
      display.setPixel(x, y, (lut[i] * ln + (255 - lut[i] * ln) * k) | 0, (lut[i + 1] * ln + (255 - lut[i + 1] * ln) * k) | 0, (lut[i + 2] * ln + (255 - lut[i + 2] * ln) * k) | 0);
    }
  }
}
