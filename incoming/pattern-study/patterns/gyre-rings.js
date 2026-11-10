// ===== Patternflow pattern =====
// Title:   Gyre Rings
// Family:  ocean
// Idea:    A wind-driven ocean basin runs on the panel's own 64 by 128 grid with land on all four edges, two gyres turning against each other and a narrow fast current down the west coast that leaves the shore at mid height, meanders across the box and sheds eddies, and the picture is the sea-surface temperature that this flow carries, deep blue in the cold north and gold in the warm south, drawn into tongues, rings and thin filaments over the whole basin and lit where the water is fast or spinning.
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the wind-driven double gyre of the barotropic vorticity equation in a closed beta-plane basin: the interior balance (Harald Sverdrup, 1947), westward intensification (Henry Stommel, 1948), the boundary layer with lateral friction (Walter Munk, 1950), the eddy-resolving double gyre with its jet and rings (William Holland, 1978; Pavel Berloff and James McWilliams, 1999), random weather as the forcing of ocean eddies (Claude Frankignoul and Klaus Hasselmann, 1977), the energy and enstrophy conserving Jacobian (Akio Arakawa, 1966), a fast Poisson solver by sine transform (Roger Hockney, 1965), Adams-Bashforth stepping, a flux-limited finite-volume tracer (Bram van Leer, 1974) stepped by Heun's strong-stability-preserving Runge-Kutta (Chi-Wang Shu and Stanley Osher, 1988), colours in Oklab (Bjorn Ottosson, 2020); the transforms are reworked from Mesoscale Turbulence, round 123; every name and year here is from memory; pattern round 124
// Round:   124
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.8..4, Scale=-1..1, Wind=-1..1
//
// Knob 1: Hue. Turns the whole temperature palette round the wheel by the knob times 360 degrees, one turn comes back. At 0 the cold north is deep blue (17, 50, 115), then azure (12, 97, 144), teal (66, 166, 166), pale lime (185, 186, 99) and gold (204, 146, 53) in the warm south; at 0.25 it runs from plum (115, 22, 73) through lavender (117, 115, 166) to mint (67, 204, 155); at 0.5 from umber (115, 79, 0) through rose (166, 105, 109) to periwinkle (126, 160, 204); at 0.75 from pine (0, 115, 89) through olive (166, 161, 87) to pink (204, 133, 173). The brightest channel is set directly, 0.45 of 255 at the cold end to 0.8 at the warm end and 51 either way for the shading, so at every hue it lies between 64 and 255 and no LED is dark. At 0 nothing is red.
// Knob 2: Flow. The clock. The model time unit is set each frame so that the fastest water in the box moves 5 LEDs a second per unit of Flow: at the opening Scale and Wind the mean of |u| + |v| at the fastest LED is 4.4 LEDs a second at 0.8, 11.2 at the opening 2 and 23.3 at 4, and the rms speed of the water over the panel is 1.32, 3.37 and 6.84. If an LED is 12.5 km and beta is 2e-11 per metre second, one model time unit is 46 days and a panel second is 0.44, 1.09 and 2.2 model days at the three. At the opening one model time unit is 43 s. A frame takes one solver step at Flow 0.8, 1.2 on average at 2 and two at 3 and 4 (a third now and then at all-maximum).
// Knob 3: Scale. The width of the western boundary current and with it the size of the eddies and rings: the Munk width delta_M = (A / beta)^(1/3) = 2.00 LEDs at -1, 2.37 at the opening 0 and 2.80 at 1, which is a box 32, 27 and 23 Munk widths wide. The viscosity A = beta delta_M^3 is 8.0, 13.3 and 22.0 LED^2 per time unit, the friction r = 0.3 beta delta_M is 0.60, 0.71 and 0.84, the wind curl grows with delta_M^3 so that delta_I / delta_M does not move, and the clock takes the speed back out, so the water keeps its 10 to 13 LEDs a second at the fastest (12.8, 11.2 and 10.3). The western current, measured half-way up its flank in the linear solution, is 2.80, 3.29 and 3.87 LEDs wide. In the running flow the vorticity has a wavelength of 15.8, 17.7 and 19.4 LEDs, and there are 82, 61 and 49 vortices (extrema of vorticity above half its rms). The gusts move with it, 15.6, 17.0 and 18.4 LEDs long. The scheme wants the layer at least two cells wide, so Scale stops at delta_M 2; above 2.8 the all-maximum flow came back to itself too often in an earlier version (recur 0.34 at 3.4 on two seeds).
// Knob 4: Wind. The strength of the wind, as the ratio delta_I / delta_M of the inertial width (the jet's own width, delta_I^3 = W0 NX / beta^2 for the Sverdrup transport it carries) to the Munk width: 5.0 times 1.12 to the knob, 4.46 at -1, 5.03 at the opening 0.06 and 5.60 at 1. The curl amplitude W0 = (delta_I / delta_M)^3 A / NX is 18.4, 26.4 and 36.4 LEDs per time unit squared at the opening Scale (the transport W0 NX is 1178, 1690 and 2330 LED^2 per time unit), and the gusts scale with it. Measured at the opening Scale over 600 s the warm and cold eddies (blobs of 30 cells or more that are 0.3 off the temperature the water is relaxed to, in the other water mass) form 21.8, 33.6 and 33.0 times in 100 s and are 93, 137 and 299 cells in area, and the kinetic energy is 6.6, 13.4 and 30 thousand in model units (means over 60 to 600 s, 900 s at the opening). Low, many small swirls tear at a front that stays near mid height; high, a wide jet throws large tongues and rings far across the box, and at all-maximum the time-mean interior flow runs 2 to 3 times the Sverdrup flow (recirculation gyres).

// What the field is. A closed rectangle of 64 by 128 cells, one to an LED, x to the east (right) and y to the north (up the panel), land on all four edges. The state is the stream function psi (u = -psi_y, v = psi_x) and the vorticity zeta = lap psi, which obey the barotropic vorticity equation on a beta plane,
//   zeta_t + J(psi, zeta) + beta psi_x = F(y) + gusts - r zeta + A lap zeta,
// with psi = 0 and zeta = 0 on the walls (free slip). The wind curl F(y) = -W0 sin(2 pi y / 128) is negative in the south half, a clockwise subtropical gyre, and positive in the north, a counter-clockwise subpolar one. Where the two return flows meet at the west wall, at mid height, they leave the shore together as an eastward jet. Units are one LED and one time unit, in which beta is 1; r = 0.3 delta_M, A = delta_M^3 and W0 follow from the Scale and Wind knobs above. The temperature T is a passive tracer on the same grid, carried by the same flow and relaxed to a target T* that runs from 1 in the south to 0 in the north, half of it a ramp and half a step at mid height (0.5 - 0.5 [0.5 s + 0.5 tanh(s / 0.3)], s = y / 64 - 1), in 3 time units:
//   T_t + u . grad T = -(T - T*) / 3.
// T lives between the relaxation range, 0.0026 and 0.9974, and the picture is made of it: its colour is T, and its lightness is shifted by three things the flow does, the departure of T from T* (warm eddies in cold water are bright), the vorticity (spin one way is bright, the other dark) and the speed (the western current and the jet are bright), each divided by its own scale in the 16 by 16 block it lies in so that the shading shows the quiet corners as well as the jet.
//
// The gusts. The wind curl also carries random weather: each of the 499 sine modes with a wavenumber under 0.9 per LED gets an Ornstein-Uhlenbeck forcing of correlation time 0.2 time units (8 s at the opening) and a standard deviation 2.0 W0 times a Gaussian in wavenumber around 0.57 / sqrt(delta_M) (wavelength 17 LEDs at the opening, band width 0.45 of that). The curl they make has an rms of 9.5 W0 in space, but it changes every few seconds, so the energy it brings is a small part of what the steady wind does over a gyre's turn: the kinetic energy at the opening is 12.7 thousand with the gusts and 21 thousand without them. They are what keeps the interior and the far corners alive and what keeps the flow from coming back: with the gusts off the same model gives recur 0.12, 0.20 and 0.16 at the opening, all-minimum and all-maximum knobs (a double gyre alone is nearly periodic over four minutes), with them at 0.6 W0 it is 0.45, 0.55 and 0.23, and at 2.0 W0 it is 0.57, 0.58 and 0.54 at 900 s (0.44 to 0.73 over eight seeds on the three edges at 240 s).
//
// Numerics. psi and zeta sit on the cell corners, 65 by 129 of them, 63 by 127 inside. A sine transform (DST-I, built from the complex FFT of the odd extension, two real lines to one transform: 128 and 256 points) diagonalises the five-point Laplacian exactly, with eigenvalues 4 sin^2(m pi / 128) + 4 sin^2(n pi / 256), so psi comes from the spectral vorticity at once, free slip and all, and the state is kept in sine coefficients. Per step: one inverse transform (psi), zeta by the stencil, Arakawa's Jacobian and beta psi_x on the corners, one forward transform of the tendency, then Adams-Bashforth 3 with the Lagrange weights of the actual last three steps and the damping r + A lambda taken implicitly (so a steady balance of forcing and damping is exact), then the gusts. A step costs 0.75 ms with the tracer. The step is cut so that (|u| + |v|) h is at most 0.5, which makes it 0.0003 to 0.0014 time units at 30 frames a second; Adams-Bashforth 3 holds to 0.72 over the largest frequency, that of the longest Rossby wave, beta / (2 k_min) = 20 per time unit, so the step may be 0.036 at most. The tracer is advected on the cells in flux form with the fluxes taken from the corner differences of psi, so each cell's discrete divergence is zero and the walls pass nothing; face values are van Leer limited upwind values, stepped by Heun's two stage scheme, then the relaxation; it shares psi with the dynamics, one step each, at the same 64 by 128.
//
// The start. The first call builds the state and runs 700 steps that nobody sees (0.73 model time units, 31 s of the opening clock, 460 to 690 ms in Node; the tracer joins for the last 466). It starts from the analytic solution of the linear problem, the Sverdrup interior psi = (F / beta) (x - 64) with the free-slip Munk layer on the west wall, plus a wave on the middle latitude, so that frame one already shows two gyres, a jet and a tracer being stretched by it, and the jet starts to meander within the first minute. The first frame of a run is the same each time up to the gusts, and no run is periodic.
//
// What was checked, with this file's own functions and scripts of mine, not in the repo:
// - The sine transform: a random psi taken to its Laplacian, to sine coefficients and back by the solver: 3.4e-15 of 0.5 in the worst corner.
// - The Jacobian: sum of psi J and of zeta J over the box, 4.7e-16 and 1.6e-16 of the sums of absolute values 18 and 5.6 (round-off: energy and enstrophy are conserved by the scheme), and against the analytic J of a smooth field 3.9e-8 of 1.05e-5 (0.4 per cent, second order).
// - The linear solution, no gusts and the wind cut to delta_I / delta_M = 0.8, run 17 time units: the interior psi at the quarter latitude over the Sverdrup psi (F / beta)(x - 64) is 0.934, 0.965, 0.971, 0.977 and 0.984 at x = 16, 24, 32, 40 and 48 (friction and viscosity take the rest), and the same in the north gyre with the sign turned; the western transport (psi at x = 8) is 6.66 against W0 NX / beta = 6.79 (98 per cent).
// - The Munk layer: the half-width of the northward current at the quarter latitude is 3.29 LEDs at delta_M = 2.37, against 3.03 for the analytic free-slip layer without friction (v = F / beta - (F NX / beta delta_M) exp(-x / 2 delta_M) [cos th + sin th / sqrt 3], th = sqrt 3 x / 2 delta_M), the friction width r / beta being 0.71; across the Scale knob it is 2.80, 3.29 and 3.87 LEDs for delta_M 2.00, 2.37 and 2.80, 1.40, 1.39 and 1.38 of delta_M, so it follows (A / beta)^(1/3). The peak speed is 0.72 of W0 NX / delta_M where the analytic layer has 0.94: the layer is two to three cells wide, so it comes out 8 per cent wider and a quarter lower than the frictionless profile (the friction takes part of that).
// - The running flow against Sverdrup: the time mean of psi from 240 s to 900 s at the opening, over (F / beta)(x - 64) at the quarter latitudes, is 1.29, 1.46, 1.33 and 0.99 at x = 16 to 40 in the south and 1.06, 1.15, 1.09 and 0.96 in the north, falling to 0.4 and below at x = 48 and 56 under the eastern wall; the mean western transport is 1654 against the Sverdrup 1691 in the south gyre and 1342 (79 per cent) in the north. At all-maximum the mean interior is 2 to 3 times the Sverdrup flow.
// - The step: the same warm start taken three seconds at dt = 1/30, 1/60 and 1/120 s: the relative error of psi against the last is 3.6e-4 and 1.2e-4 at h and h/2, a ratio of 3.0 (the damping is first order and the start is Euler, so this is not 8).
// - The tracer: with the relaxation off, 120 s at Flow 4, Scale 1, Wind 1: the total of T changed by 1.2e-14 relative, the extremes stayed inside the start range (0.00586 to 0.99549 after, 0.00582 to 0.99549 before), and the divergence of the cell fluxes is 5.7e-14 against face fluxes of 613. With the relaxation on, over 900 s the raw extremes of T are 0.0047 and 0.9892 at the opening, 0.0032 and 0.9871 at all-minimum, 0.0052 and 0.9881 at all-maximum, inside 0.0026 and 0.9974.
// - Stationarity, 900 s: the means over 0 to 240 s and over 240 to 900 s are, in kinetic energy, 14.4 and 12.7 thousand (opening), 3.5 and 3.4 thousand (all-minimum), 54 and 55 thousand (all-maximum); in enstrophy 568 and 571, 261 and 259, 1200 and 1210; in the rms departure of T from T* 0.194 and 0.208, 0.136 and 0.150, 0.253 and 0.259 (the tracer starts from T* and builds its departure over about 3 time units). The 60 s means scatter by 16, 9 and 20 per cent in energy and 4, 9 and 6 per cent in enstrophy, so the differences are inside the scatter; the energy wanders by a third over 3 to 5 minutes at the highest wind (the jet's reach goes out and in).
// - Eddies, 900 s from 30 s on, counted once a second: at the opening 4.9 warm or cold blobs at a time, 137 cells each, forming 33.6 times in 100 s; all-minimum 1.3 and 70 cells and 7.7 times; all-maximum 3.4 and 764 cells and 30.2 times.
// - flowcheck, 240 s and 900 s, six positions, eight seeds on the three edges: see the notes of the round. ms a frame in Node: 1.3 at the opening, 2.0 at Flow 4 (update 0.8 to 1.5, draw 0.5).
//
// What failed first. 1. In the first prototype (delta_M 2.6) with delta_I / delta_M at 3.4 to 3.6 the double gyre stayed a steady pair for 30 time units (20 minutes at the opening clock); the wind range was lifted to 4.46 to 5.6, where it is unsteady from the start. 2. A deformation radius (equivalent barotropic, radius 2 delta_M) damps the large scales only by an interface relaxation of 0.05, so the energy was still climbing 40 per cent at 300 s; the plain barotropic model with a bottom friction of 0.7 (a decay in 1.4 time units, 60 s) is stationary within a minute. 3. Without the gusts recur is 0.12 to 0.20; with them at 0.8 W0 and 0.5 time units the interior went quiet at some knob positions (the last quarter's quiet 0.21 to 0.33 at 240 s); at 2.0 W0 and 0.2 time units it does not. 4. In the blue half the brightest channel of a lightness ramp hardly moves, so the cold north was the quietest block; the brightest channel is now set by hand and the shading added to it, not multiplied. 5. Scale up to 3.4 gave recur 0.34 at all-maximum on two seeds; it stops at 2.8. 6. A step of 0.084 time units (a slow linear run at a frame of 0.1 s) blew the Rossby modes up; the pattern's own step is at most 0.0084 even at a frame of 0.1 s.
//
// What was not checked: no comparison with an eddy-resolving ocean model or with altimetry, so the ring sizes, drift speeds and shedding rates are not tied to the Gulf Stream; the model has one layer, no thermocline, so the rings carry no lens of water and the temperature is a passive tracer that never changes the flow; the gust spectrum and size are chosen for the picture and not fitted to any wind record (their curl is 9.5 times the mean wind curl in rms, short lived); the physical units (12.5 km an LED, 46 days a time unit) are one reading, not fitted; the Munk layer is two to three cells wide, so its speed is 25 per cent low; the blobs of the eddy count use one threshold; the three shading terms are mine, drawn from altimetry maps and surface temperature maps laid together, which no one image shows.

const W = 64, H = 128;
const { floor, ceil, max, min, abs, sqrt, exp, log, pow, sin, cos, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Cells are LEDs: NX by NY. The stream function psi and the vorticity zeta live on the cell corners,
// (NX + 1) by (NY + 1) of them, with psi = 0 on the four walls. Row j counts northward from the south wall.
const NX = W, NY = H, SX = NX + 1, NVT = SX * (NY + 1);
const MX = NX - 1, MY = NY - 1, NM = MX * MY; // interior corners, which is the number of sine modes

const CFG = {
  beta: 1, // planetary vorticity gradient: model units are LEDs and tu, so beta is 1
  d0: 2.0, // Munk width at Scale -1, LEDs
  d1: 2.8, // and at Scale 1
  wn0: 5.0, // wind: delta_I / delta_M at Wind 0
  wnr: 1.12, // ratio per unit of Wind
  rf: 0.3, // bottom friction in units of beta delta_M
  nz: 2.0, // the gusts, as a share of the wind curl amplitude
  nzTau: 0.2, // their correlation time, tu
  nzK: 0.57, // their wavenumber in units of 1 / sqrt(delta_M)
  tc: 0.5, // share of the relaxation target that is a step at the middle latitude, the rest a ramp
  tw: 0.3, // width of the step, as a share of half the panel
  tauT: 3, // relaxation of the temperature, tu
  vel: 5, // peak jet speed per unit of Flow, LEDs per second
  ukf: 3, // peak jet speed over beta (delta_I)^2
  cfl: 0.5, // (|u| + |v|) h per step
  warm: 700, // steps of hidden warm-up
  v0: 0.45, // brightest channel at the cold end, of 255
  v1: 0.8, // and at the warm end
  vg: 0.8, // exponent of the ramp between
  vs: 0.2, // how far the shading takes it either way, of 255
  sa: 0.6, // lightness given to the temperature anomaly
  sw: 0.8, // anomaly over its block scale that saturates it
  sz: 0.6, // lightness given to the vorticity
  ss: 1.0, // and to the speed
  sk: 1.2, // speed over the rms speed that saturates it
  zfl: 0.15, // share of the panel's mean square vorticity every block gets at least
  zk: 1.2, // vorticity over its scale that saturates the shading
};

// ---------------------------------------------------------------- sine transform
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
function fft1(re, im, P) {
  const n = P.n, sw = P.sw, tw = P.tw;
  for (let p = 0; p < sw.length; p += 2) {
    const i = sw[p], j = sw[p + 1];
    let t = re[i];
    re[i] = re[j];
    re[j] = t;
    t = im[i];
    im[i] = im[j];
    im[j] = t;
  }
  for (let a = 0; a < n; a += 4) {
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
    for (let s = 0; s < n; s += len)
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
const PX = plan(2 * NX), PY = plan(2 * NY);
const XR = new Float64Array(2 * NX), XI = new Float64Array(2 * NX), YR = new Float64Array(2 * NY), YI = new Float64Array(2 * NY);

// DST-I of the MY rows of MX values, two rows to one complex transform of the odd extension: the sine
// coefficients of the first row are minus half the imaginary part, those of the second half the real part.
// Input src[so + r * ss + c], output dst[d0 + r * ds + c]. Not scaled: the inverse is the same call times 4 / (NX NY).
function passX(src, so, ss, dst, d0, ds) {
  for (let r = 0; r < MY; r += 2) {
    const a = so + r * ss, b = a + ss, two = r + 1 < MY;
    XR[0] = 0;
    XI[0] = 0;
    XR[NX] = 0;
    XI[NX] = 0;
    for (let c = 0; c < MX; c++) {
      const u = src[a + c], v = two ? src[b + c] : 0;
      XR[c + 1] = u;
      XI[c + 1] = v;
      XR[2 * NX - 1 - c] = -u;
      XI[2 * NX - 1 - c] = -v;
    }
    fft1(XR, XI, PX);
    const oa = d0 + r * ds, ob = oa + ds;
    for (let c = 0; c < MX; c++) {
      dst[oa + c] = -0.5 * XI[c + 1];
      if (two) dst[ob + c] = 0.5 * XR[c + 1];
    }
  }
}
function passY(src, so, ss, dst, d0, ds) {
  for (let c = 0; c < MX; c += 2) {
    const two = c + 1 < MX;
    YR[0] = 0;
    YI[0] = 0;
    YR[NY] = 0;
    YI[NY] = 0;
    for (let r = 0, p = so + c; r < MY; r++, p += ss) {
      const u = src[p], v = two ? src[p + 1] : 0;
      YR[r + 1] = u;
      YI[r + 1] = v;
      YR[2 * NY - 1 - r] = -u;
      YI[2 * NY - 1 - r] = -v;
    }
    fft1(YR, YI, PY);
    for (let r = 0, p = d0 + c; r < MY; r++, p += ds) {
      dst[p] = -0.5 * YI[r + 1];
      if (two) dst[p + 1] = 0.5 * YR[r + 1];
    }
  }
}
const SC = 4 / (NX * NY);

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

// ---------------------------------------------------------------- the model
function deltaOf(k) {
  return CFG.d0 * pow(CFG.d1 / CFG.d0, (cl(k, -1, 1) + 1) / 2);
}
function wnOf(k) {
  return CFG.wn0 * pow(CFG.wnr, cl(k, -1, 1));
}

function start(params, k) {
  const S = {
    psi: new Float64Array(NVT), zeta: new Float64Array(NVT), g: new Float64Array(NVT),
    qh: new Float64Array(NM), ph: new Float64Array(NM), t1: new Float64Array(NM), Fh: new Float64Array(NM),
    G: [new Float64Array(NM), new Float64Array(NM), new Float64Array(NM)],
    Lam: new Float64Array(NM), lam: new Float64Array(NM), ninv: new Float64Array(NM),
    nm: [], nw: null, xi: null,
    hs: [1, 1], nstep: 0, t: 0, umax: 100,
    delta: 0, wn: 0, W0: 0, A: 0,
    TW: NX + 4, T: new Float64Array((NX + 4) * (NY + 4)), T1: new Float64Array((NX + 4) * (NY + 4)),
    UF: new Float64Array(SX * NY), VF: new Float64Array(NX * (NY + 1)), FX: new Float64Array(SX * NY), FY: new Float64Array(NX * (NY + 1)),
    Ts: new Float64Array(NY), hue: 0, lutHue: -1, lut: null, env: new Float64Array(32), envT: new Float64Array(32), cz: new Float32Array(NX * NY), cs: new Float32Array(NX * NY),
    kd: k[2], kw: k[3],
  };
  params.s = S;
  for (let n = 0; n < MY; n++)
    for (let m = 0; m < MX; m++) {
      const L = 4 * sin(((m + 1) * PI) / (2 * NX)) ** 2 + 4 * sin(((n + 1) * PI) / (2 * NY)) ** 2;
      S.Lam[n * MX + m] = L;
      S.ninv[n * MX + m] = -1 / L;
    }
  // modes the gusts may use: wavenumber up to 0.9 per LED
  for (let n = 0; n < MY; n++)
    for (let m = 0; m < MX; m++) {
      const kx = ((m + 1) * PI) / NX, ky = ((n + 1) * PI) / NY;
      if (kx * kx + ky * ky < 0.81) S.nm.push(n * MX + m);
    }
  S.nw = new Float64Array(S.nm.length);
  S.xi = new Float64Array(S.nm.length);
  for (let j = 0; j < NY; j++) {
    const y = (j + 0.5 - NY / 2) / (NY / 2);
    S.Ts[j] = 0.5 - 0.5 * ((1 - CFG.tc) * y + CFG.tc * tanh(y / CFG.tw));
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) S.T[(j + 2) * S.TW + i + 2] = S.Ts[j];
  ghost(S.T, S.TW);
  setParams(S, k[2], k[3]);
  initial(S);
  for (let n = 0; n < CFG.warm; n++) {
    const h = cl(CFG.cfl / S.umax, 0.0001, 0.004);
    step(S, h, n > CFG.warm / 3);
  }
}

// delta_M, wind and gusts from Scale and Wind. A = beta delta^3, curl amplitude W0 = wn^3 A / (beta NX): the
// Sverdrup transport that a Munk layer carries has the inertial width delta_I = wn delta_M.
function setParams(S, kd, kw) {
  const delta = deltaOf(kd), wn = wnOf(kw);
  S.delta = delta;
  S.wn = wn;
  const A = CFG.beta * delta ** 3;
  S.W0 = (wn ** 3 * A * CFG.beta) / NX;
  if (abs(A - S.A) > 0.002 * A) {
    S.A = A;
    const rf = CFG.rf * CFG.beta * delta;
    for (let q = 0; q < NM; q++) S.lam[q] = rf + A * S.Lam[q];
    const k0 = CFG.nzK / sqrt(delta);
    for (let q = 0; q < S.nm.length; q++) {
      const L = S.Lam[S.nm[q]], kk = sqrt(L), z = (kk - k0) / (0.45 * k0);
      S.nw[q] = exp(-z * z);
    }
  }
  // wind forcing in the sine basis, for unit curl; scaled when used
  if (!S.Fu) {
    const f = new Float64Array(NVT);
    for (let j = 1; j < NY; j++) for (let i = 1; i < NX; i++) f[j * SX + i] = -sin((TAU * j) / NY);
    S.Fu = new Float64Array(NM);
    passX(f, SX + 1, SX, S.t1, 0, MX);
    passY(S.t1, 0, MX, S.Fu, 0, MX);
    for (let q = 0; q < NM; q++) S.Fu[q] *= SC;
  }
}

function initial(S) {
  const { psi, W0, delta } = S, beta = CFG.beta;
  for (let j = 1; j < NY; j++) {
    const F = -W0 * sin((TAU * j) / NY);
    for (let i = 1; i < NX; i++) {
      const e = exp(-i / (2 * delta)), th = (sqrt(3) * i) / (2 * delta);
      const bl = e * (cos(th) + sin(th) / sqrt(3));
      psi[j * SX + i] = (F / beta) * (i - NX) + (F / beta) * NX * bl;
    }
  }
  // a wave on the middle latitude to start the jet meandering
  for (let j = 1; j < NY; j++)
    for (let i = 1; i < NX; i++) {
      const y = (j - NY / 2) / (NY / 2), env = exp(-(y * y) / 0.08);
      psi[j * SX + i] += 0.5 * W0 * NX * 0.15 * env * sin(((3 * PI) / NX) * i + 1) * sin((PI * i) / NX) * cos(3 * y);
    }
  lap(S);
  for (let j = 1; j < NY; j++) for (let i = 1; i < NX; i++) S.g[j * SX + i] = S.zeta[j * SX + i];
  passX(S.g, SX + 1, SX, S.t1, 0, MX);
  passY(S.t1, 0, MX, S.qh, 0, MX);
  for (let q = 0; q < NM; q++) S.qh[q] *= SC;
}

function lap(S) {
  const { psi, zeta } = S;
  for (let j = 1; j < NY; j++) {
    let p = j * SX + 1;
    for (let i = 1; i < NX; i++, p++) zeta[p] = psi[p - 1] + psi[p + 1] + psi[p - SX] + psi[p + SX] - 4 * psi[p];
  }
}
function solvePsi(S) {
  const { qh, ph, ninv, t1, psi } = S;
  for (let q = 0; q < NM; q++) ph[q] = qh[q] * ninv[q];
  passX(ph, 0, MX, t1, 0, MX);
  passY(t1, 0, MX, psi, SX + 1, SX);
}
// -J(psi, zeta) - beta psi_x on the corners, Arakawa's Jacobian (1966): energy and enstrophy are conserved by the scheme
function tendency(S) {
  const { psi, zeta, g } = S, beta = CFG.beta;
  lap(S);
  let um = 0;
  for (let j = 1; j < NY; j++) {
    let p = j * SX + 1;
    for (let i = 1; i < NX; i++, p++) {
      const pE = psi[p + 1], pW = psi[p - 1], pN = psi[p + SX], pS = psi[p - SX];
      const pNE = psi[p + SX + 1], pNW = psi[p + SX - 1], pSE = psi[p - SX + 1], pSW = psi[p - SX - 1];
      const zE = zeta[p + 1], zW = zeta[p - 1], zN = zeta[p + SX], zS = zeta[p - SX];
      const zNE = zeta[p + SX + 1], zNW = zeta[p + SX - 1], zSE = zeta[p - SX + 1], zSW = zeta[p - SX - 1];
      const jpp = (pE - pW) * (zN - zS) - (pN - pS) * (zE - zW);
      const jpx = pE * (zNE - zSE) - pW * (zNW - zSW) - pN * (zNE - zNW) + pS * (zSE - zSW);
      const jxp = pNE * (zN - zE) - pSW * (zW - zS) - pNW * (zN - zW) + pSE * (zE - zS);
      g[p] = -(jpp + jpx + jxp) / 12 - (beta * (pE - pW)) / 2;
      const a = abs(pE - pW) + abs(pN - pS);
      if (a > um) um = a;
    }
  }
  S.umax = max(um / 2, 1);
}

// ---------------------------------------------------------------- the temperature
function ghost(T, Wd) {
  const Hd = NY + 4;
  for (let j = 2; j < NY + 2; j++) {
    const o = j * Wd;
    T[o] = T[o + 1] = T[o + 2];
    T[o + Wd - 1] = T[o + Wd - 2] = T[o + Wd - 3];
  }
  for (let i = 0; i < Wd; i++) {
    T[i] = T[Wd + i] = T[2 * Wd + i];
    T[(Hd - 1) * Wd + i] = T[(Hd - 2) * Wd + i] = T[(Hd - 3) * Wd + i];
  }
}
function lim(a, b) {
  const ab = a * b;
  return ab > 0 ? (2 * ab) / (a + b) : 0;
}
// the face fluxes of T for the velocity UF, VF: van Leer's limited upwind values
function fluxes(S, T) {
  const { TW, UF, VF, FX, FY } = S;
  for (let j = 0; j < NY; j++) {
    const row = (j + 2) * TW + 2;
    for (let i = 1; i < NX; i++) {
      const p = row + i, u = UF[j * SX + i];
      let f;
      if (u >= 0) f = T[p - 1] + 0.5 * lim(T[p - 1] - T[p - 2], T[p] - T[p - 1]);
      else f = T[p] - 0.5 * lim(T[p] - T[p - 1], T[p + 1] - T[p]);
      FX[j * SX + i] = u * f;
    }
  }
  for (let j = 1; j < NY; j++) {
    const row = (j + 2) * TW + 2;
    for (let i = 0; i < NX; i++) {
      const p = row + i, v = VF[j * NX + i];
      let f;
      if (v >= 0) f = T[p - TW] + 0.5 * lim(T[p - TW] - T[p - 2 * TW], T[p] - T[p - TW]);
      else f = T[p] - 0.5 * lim(T[p] - T[p - TW], T[p + TW] - T[p]);
      FY[j * NX + i] = v * f;
    }
  }
}
// Flux form on the cells, the fluxes from the corner differences of psi, so the discrete divergence of every cell is
// zero and the walls pass nothing. Two stages of Heun's SSP Runge-Kutta, then the relaxation.
function tracer(S, h) {
  const { TW, UF, VF, FX, FY, psi, T, T1, Ts } = S;
  for (let j = 0; j < NY; j++) for (let i = 1; i < NX; i++) UF[j * SX + i] = psi[j * SX + i] - psi[(j + 1) * SX + i];
  for (let j = 1; j < NY; j++) for (let i = 0; i < NX; i++) VF[j * NX + i] = psi[j * SX + i + 1] - psi[j * SX + i];
  fluxes(S, T);
  for (let j = 0; j < NY; j++) {
    const row = (j + 2) * TW + 2;
    for (let i = 0; i < NX; i++) {
      const p = row + i;
      T1[p] = T[p] - h * (FX[j * SX + i + 1] - FX[j * SX + i] + FY[(j + 1) * NX + i] - FY[j * NX + i]);
    }
  }
  ghost(T1, TW);
  fluxes(S, T1);
  const rl = h / CFG.tauT;
  for (let j = 0; j < NY; j++) {
    const row = (j + 2) * TW + 2, ts = Ts[j];
    for (let i = 0; i < NX; i++) {
      const p = row + i;
      const t2 = T1[p] - h * (FX[j * SX + i + 1] - FX[j * SX + i] + FY[(j + 1) * NX + i] - FY[j * NX + i]);
      const v = 0.5 * (T[p] + t2);
      T[p] = v + rl * (ts - v);
    }
  }
  ghost(T, TW);
}

// ---------------------------------------------------------------- one step
// Adams-Bashforth 3 with the weights of the actual steps (Lagrange through the last three tendencies), damping
// taken implicitly, so a steady state of the damped balance is exact.
function abWeights(h, h1, h2) {
  const hh = h * h, h3 = hh * h;
  return [
    (h3 / 3 + ((2 * h1 + h2) * hh) / 2 + h1 * (h1 + h2) * h) / (h1 * (h1 + h2)),
    -(h3 / 3 + ((h1 + h2) * hh) / 2) / (h1 * h2),
    (h3 / 3 + (h1 * hh) / 2) / ((h1 + h2) * h2),
  ];
}
function step(S, h, doT) {
  const { qh, G, Fh, lam, t1, Fu, nm, nw, xi } = S;
  solvePsi(S);
  if (doT) tracer(S, h);
  tendency(S);
  passX(S.g, SX + 1, SX, t1, 0, MX);
  const g0 = G[2];
  passY(t1, 0, MX, g0, 0, MX);
  G[2] = G[1];
  G[1] = G[0];
  G[0] = g0;
  const A0 = G[0], A1 = G[1], A2 = G[2];
  if (S.nstep < 2)
    for (let q = 0; q < NM; q++) {
      A1[q] = A0[q];
      A2[q] = A0[q];
    }
  const w = abWeights(h, S.hs[0], S.hs[1]), w0 = w[0] * SC, w1 = w[1] * SC, w2 = w[2] * SC, hw = h * S.W0;
  for (let q = 0; q < NM; q++) qh[q] = (qh[q] + w0 * A0[q] + w1 * A1[q] + w2 * A2[q] + hw * Fu[q]) / (1 + lam[q] * h);
  // gusts: an Ornstein-Uhlenbeck forcing of the curl on a band of modes
  const rho = exp(-h / CFG.nzTau), sg = sqrt(1 - rho * rho) * CFG.nz * S.W0;
  for (let q = 0; q < nm.length; q++) {
    xi[q] = rho * xi[q] + sg * nw[q] * gauss();
    qh[nm[q]] += h * xi[q];
  }
  S.hs[1] = S.hs[0];
  S.hs[0] = h;
  S.nstep++;
  S.t += h;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1);
  const f = 1 - exp(-ft / 0.3);
  S.kd += (cl(k[2], -1, 1) - S.kd) * f;
  S.kw += (cl(k[3], -1, 1) - S.kw) * f;
  setParams(S, S.kd, S.kw);
  S.hue = k[0];
  // the clock: the peak jet speed is vel LEDs a second per unit of Flow
  const ujet = CFG.ukf * CFG.beta * (S.wn * S.delta) ** 2;
  const rate = (CFG.vel * cl(k[1], 0.8, 4)) / ujet;
  const Ht = ft * rate;
  const n = max(1, ceil((Ht * S.umax) / CFG.cfl));
  for (let i = 0; i < n; i++) step(S, Ht / n, true);
  if (!(S.umax < 3000)) params.s = null;
}

// ---------------------------------------------------------------- colour
const RGB = [0, 0, 0];
function srgb(x) {
  return x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055;
}
function oklab(L, C, h) {
  for (let it = 0; it < 24; it++) {
    const a = C * cos((h * PI) / 180), b = C * sin((h * PI) / 180);
    const l = pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    if ((r >= -0.002 && r <= 1.002 && g >= -0.002 && g <= 1.002 && bl >= -0.002 && bl <= 1.002) || C < 0.004) {
      RGB[0] = cl(srgb(cl(r, 0, 1)), 0, 1);
      RGB[1] = cl(srgb(cl(g, 0, 1)), 0, 1);
      RGB[2] = cl(srgb(cl(bl, 0, 1)), 0, 1);
      return;
    }
    C *= 0.93;
  }
}
// temperature stops, cold to warm: lightness, chroma, hue in degrees
const STOPS = [
  [0.0, 0.34, 0.12, 262],
  [0.3, 0.5, 0.11, 240],
  [0.5, 0.72, 0.1, 195],
  [0.72, 0.84, 0.12, 110],
  [1.0, 0.82, 0.15, 75],
];
const NT = 128, NS = 25;
function buildLut(S, hue) {
  const lut = new Uint8Array(NT * NS * 3);
  for (let i = 0; i < NT; i++) {
    const x = i / (NT - 1);
    let a = 1;
    while (a < STOPS.length - 1 && x > STOPS[a][0]) a++;
    const s0 = STOPS[a - 1], s1 = STOPS[a], u = sm(0, 1, cl((x - s0[0]) / (s1[0] - s0[0]), 0, 1));
    const L = s0[1] + (s1[1] - s0[1]) * u, C = s0[2] + (s1[2] - s0[2]) * u, hh = s0[3] + (s1[3] - s0[3]) * u + hue * 360;
    oklab(L, C, hh);
    // the colour keeps its hue and the ratios of its channels, and the brightest channel is set directly: it is what the
    // panel's dim end and the eye's sense of a change both follow, which is no longer a thing of the ramp's lightness
    const mx = max(RGB[0], RGB[1], RGB[2], 0.01), vb = CFG.v0 + (CFG.v1 - CFG.v0) * pow(x, CFG.vg);
    for (let j = 0; j < NS; j++) {
      const k = (cl(vb + (CFG.vs * (j - 12)) / 12, 0.1, 1) / mx) * 255;
      const o = (i * NS + j) * 3;
      lut[o] = min(255, (RGB[0] * k + 0.5) | 0);
      lut[o + 1] = min(255, (RGB[1] * k + 0.5) | 0);
      lut[o + 2] = min(255, (RGB[2] * k + 0.5) | 0);
    }
  }
  S.lut = lut;
  S.lutHue = hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const hue = S.hue;
  if (abs(S.lutHue - hue) > 0.002) buildLut(S, hue);
  const { T, TW, Ts, zeta, lut, env, envT, UF, VF, cz, cs } = S;
  // Vorticity, speed and the temperature's departure from its target at the centre of every cell, and the scales of
  // the vorticity and the departure in each 16 by 16 block, floored by a share of the whole panel's, so that the
  // shading shows what the water does in a quiet corner as it does in the jet.
  env.fill(0);
  envT.fill(0);
  let tz = 0, tt = 0, ts = 0;
  for (let j = 0; j < NY; j++) {
    const row = (j + 2) * TW + 2;
    for (let i = 0; i < NX; i++) {
      const p = j * SX + i, c = j * NX + i, b = (j >> 4) * 4 + (i >> 4);
      const z = (zeta[p] + zeta[p + 1] + zeta[p + SX] + zeta[p + SX + 1]) * 0.25, d = T[row + i] - Ts[j];
      const u = (UF[p] + UF[p + 1]) * 0.5, v = (VF[c] + VF[c + NX]) * 0.5, s2 = u * u + v * v;
      cz[c] = z;
      cs[c] = sqrt(s2);
      env[b] += z * z;
      envT[b] += d * d;
      tz += z * z;
      tt += d * d;
      ts += s2;
    }
  }
  const fz = (CFG.zfl * tz) / (NX * NY), ft = (CFG.zfl * tt) / (NX * NY), isp = 1 / (CFG.sk * sqrt(ts / (NX * NY)) + 1e-9);
  for (let b = 0; b < 32; b++) {
    env[b] = sqrt(env[b] / 256 + fz) * CFG.zk;
    envT[b] = sqrt(envT[b] / 256 + ft) * CFG.sw;
  }
  for (let py = 0; py < H; py++) {
    const j = NY - 1 - py, fy = cl((j + 0.5) / 16 - 0.5, 0, 6.999), by = fy | 0, ty = fy - by, row = (j + 2) * TW + 2;
    for (let px = 0; px < W; px++) {
      const fx = cl((px + 0.5) / 16 - 0.5, 0, 2.999), bx = fx | 0, tx = fx - bx, e0 = by * 4 + bx, c = j * NX + px;
      const ez = (env[e0] * (1 - tx) + env[e0 + 1] * tx) * (1 - ty) + (env[e0 + 4] * (1 - tx) + env[e0 + 5] * tx) * ty;
      const et = (envT[e0] * (1 - tx) + envT[e0 + 1] * tx) * (1 - ty) + (envT[e0 + 4] * (1 - tx) + envT[e0 + 5] * tx) * ty;
      const t = cl(T[row + px], 0, 1);
      const sh = CFG.sa * tanh((t - Ts[j]) / et) + CFG.sz * tanh(cz[c] / ez) + CFG.ss * (tanh(cs[c] * isp) - 0.4);
      const si = cl(12 + 12 * sh + 0.5, 0, NS - 1) | 0, o = (((t * (NT - 1) + 0.5) | 0) * NS + si) * 3;
      display.setPixel(px, py, lut[o], lut[o + 1], lut[o + 2]);
    }
  }
}
