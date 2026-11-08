// ===== Patternflow pattern =====
// Title:   Ramp and Cliff
// Family:  noise
// Idea:    A scalar fed by a steady mean gradient is stirred by a smooth chaotic flow that fills the whole panel, so broad indigo and gold ramps end in thin ice-white cliffs that the flow folds into each other for ever, with nothing injected and nothing that dies away.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: passive scalar with an imposed mean gradient in a smooth random flow, the Batchelor-Kraichnan problem (George Batchelor 1959, Robert Kraichnan 1968, both from memory), whose ramp and cliff structures were found by Pumir, Shraiman and Siggia (1991) and Holzer and Siggia (1994), names and years from memory; semi-Lagrangian advection (Courant, Isaacson and Rees 1952, Andre Robert 1981, Jos Stam 1999, from memory), Catmull-Rom interpolation (1974, from memory), Oklab (Bjorn Ottosson 2020, from memory)
// Round:   117
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Tilt=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the Oklab hue of every stop of the palette, so one turn comes back. At 0 the field runs from indigo (31, 32, 109) through azure (18, 94, 176) and pale lilac (165, 190, 221) to cream (234, 222, 175), gold (240, 186, 57) and amber (212, 131, 0), with no red. At 0.25 it is rose (153, 57, 86) through ice (213, 175, 195) to mint (33, 226, 188) and green (35, 179, 116); at 0.5 mustard (141, 118, 0) through ice to sky blue (62, 158, 239); at 0.75 dark teal (1, 70, 64) through ice to pink (210, 112, 184). A dark stop between red and yellow-green is lifted in lightness so that it does not read as brown, and no entry has a brightest channel under 70.
// Knob 2: Flow. The clock of the flow: Flow flow seconds pass in a panel second, and the speed, the stirring and the diffusivity are all in flow seconds, so the picture is the same at every Flow and only goes faster. The rms speed is 2.0 LEDs per flow second at Scale 0, so 1.0 LED a second at 0.5, 4.0 at 2 and 8.0 at 4, and the fastest cell goes 4.4 to 6.4 LEDs per flow second. A small separation grows at the Lyapunov exponent 0.078 per flow second, which is 0.04 per second at 0.5, 0.16 at 2 and 0.31 at 4. The velocity at a point is as good as forgotten after 2.2 flow seconds (autocorrelation one half), which is 4.4 s, 1.1 s and 0.55 s.
// Knob 3: Scale. Where the spectrum of the stream function peaks, k0, in waves across the 64 LEDs: 1.5 at -1 (a wave is 42.7 LEDs), 2.4 at 0 (26.7) and 5.0 at 1 (12.7); the same 40 modes' worth at every setting, and the set changes continuously. The speed goes as k0^-0.4 (2.41, 2.00 and 1.49 LEDs per flow second) and the diffusivity as k0^0.6 (0.060, 0.080 and 0.124 LED^2 per flow second), which keeps a cliff 1.7, 1.7 and 1.55 LEDs wide (full width at half maximum of the gradient). The autocorrelation of the field first crosses zero at 17.2, 10.8 and 5.4 LEDs, the Lyapunov exponent is 0.064, 0.078 and 0.118 per flow second, and the Peclet number S/(kappa k0^2) is 220, 82 and 17, so the cliffs are fine against the eddies at -1 and only just so at 1.
// Knob 4: Tilt. The direction of the mean gradient, 2.4 radians times the knob: -137 degrees at -1, 8 at the opening, +137 at 1. Two scalars run, one with its gradient along x and one along y, and the equation is linear, so the scalar for any direction is a cosine and sine mix of the two; Tilt turns that mix and answers at once, without touching the flow or the stored fields. The first label (along the gradient) picks the colour along the palette, the second (across it) moves lightness and hue a little, so Tilt re-sorts which sheets are indigo and which gold while the cliffs stay where the flow put them. A run with the source itself turned by 0.9 rad differs from the turned mix of the plain run by 0.8 percent (relative L2, after 60 flow seconds), the clamp in the interpolation being the only nonlinear part.

// What the field is. A scalar theta = G (e . x) + t(x, y, time) on the panel's 64 by 128 torus, with a mean gradient G (one per
// LED, so t is a distance in LEDs: how far along the gradient a parcel has come) in the direction e, and the fluctuation t periodic:
//   dt/dtime + u . grad t = -G (e . u) + kappa lap t.
// A parcel carries the value of theta it had, so where the flow squeezes parcels from far apart together, t has a cliff, and where
// it pulls them apart a ramp. The source -G (e . u) refills the field for ever, so the picture is statistically stationary, fills
// the whole panel and never mixes out. Nothing is injected, there is no emitter and no blob. This is the Batchelor-Kraichnan
// problem with a mean gradient as I remember it; I did not look it up. The mean of t means nothing (c solves the same equation) and
// is taken out of the field every step.
//
// The flow is prescribed, not solved. u = (psi_y, -psi_x), so it is incompressible by construction, with psi = sum of 40 cosines
// a_k cos(k . x + phi_k). The wavenumbers are the integer pairs (m, n) of the torus, k = (2 pi m / 64, 2 pi n / 128), so psi is
// periodic; the library is the 415 pairs with 0.9 <= q <= 11.5, q = sqrt(m^2 + (n/2)^2) in waves across the width (half plane,
// a mode and its mirror being one cosine). Mode weights are exp(-(ln(q/k0))^2 / (2 0.32^2)) times a random gain of 0.75 to 1.25, the
// 41st largest weight is taken off all of them so that exactly 40 stay and the set changes continuously with k0, and a_k is
// weight / q, so the velocity amplitudes follow the weights and the rms speed is a number we set. The phase is phi_k = (integral of
// omega_k) + xi_k: omega_k = (2 pi / 64) q u_rms s_k with s_k drawn from plus or minus 0.15 to 0.75, and xi_k an
// Ornstein-Uhlenbeck process of rms 1.2 rad and correlation time 5 flow seconds, so the frequencies are 40 unrelated random numbers
// and the random part has no period at all. The Eulerian velocity autocorrelation, at 64 points over 2000 flow seconds, is 0.74 at
// a lag of 1, 0.54 at 2, 0.13 at 5, -0.13 at 10, and its largest magnitude for lags of 50 to 1750 flow seconds is 0.12. There is no
// mean current: a uniform one only moves the mean of t, which is thrown away, and Doppler-shifts the phases.
//
// The grid. t lives on 128 by 256 cells, half an LED each, as two fields: A with its gradient along x and B along y. One inverse
// complex FFT of the flow's modes gives u and v at every cell (u and v are the real and imaginary part), 1.3 ms; against a direct
// sum of the 40 cosines it differs by 5e-7 cells per flow second, and its divergence by central differences is 5.5e-4 of |grad u|.
// A step of h flow seconds traces back to the midpoint with the flow at mid step, takes the flow there, traces the foot, and takes t
// from the foot with a Catmull-Rom cubic clamped to the four cells round it; the source -u (A) and -v (B) at the midpoint is added;
// then explicit diffusion in passes of r = kappa h / dx^2 <= 0.22. A step is cut so that no cell moves more than 1.5 cells; at the
// opening that is one step a frame (the fastest cell is 4.4 to 6.4 LEDs per flow second, a frame 0.067 flow seconds).
// The first frame is not empty: 14 flow seconds run on a 64 by 128 grid in steps of up to 2.2 cells (about 30 steps) and are
// interpolated up, then 1.6 flow seconds on the fine grid, 130 to 190 ms for the first update in Node. Frames cost 4.5 ms of update and
// 1.2 of draw.
//
// Checks, each run on this file with its internals exported (Node, the study's seeded Math.random).
// 1. Carrying a Gaussian. A blob of sigma 3 LEDs carried 20 flow seconds (10 s at Flow 2) by 30 and 130 cells: bilinear keeps 0.66
//    and 0.38 of its peak and has spread as a diffusivity of 0.11 and 0.37 LED^2 per flow second (it grows with the speed, as
//    |u| dx / 2 does); the clamped cubic keeps 0.97 and 0.95 with sigma 6.002 and 6.006 cells for 6 (0.0002 and 0.0004), the unclamped one
//    0.99 and 0.97 with no spread. A blob of sigma 1 LED: bilinear 0.19 and 0.06, clamped 0.70 and 0.49 (0.014 and 0.028), unclamped
//    0.77 and 0.54. The cubic does not conserve the sum, and the mean is taken out each step in any case.
// 2. The stationary balance <(e.u) t> G = kappa <|grad t|^2>, averaged over 200 flow seconds after 30 of spin-up, relative gap
//    (P - D) / P, which is the share of the dissipation the scheme does itself: with the clamped cubic at kappa 0, 0.03, 0.1 and 0.3
//    LED^2 per flow second 1.00, 0.34, 0.09 and 0.04; with bilinear 1.00, 0.86, 0.66 and 0.41. At the knob's own kappa, for 600 flow
//    seconds at the opening, it is 0.11 (0.17 at Scale -1 with kappa 0.060, 0.06 at Scale 1 with 0.124). Time step: with h of 0.133,
//    0.067, 0.033 and 0.017 flow seconds the gap is 0.13, 0.12, 0.08 and 0.075 and <|grad t|^2> is 40.8, 40.9, 43.6 and 44.3, so a
//    panel at Flow 0.5 shows 8 percent more gradient than one at 4. The variance in the last quarter against the first: -4.3 percent
//    (600 flow seconds at the opening), -3.6 at Scale -1, -1.6 at 1 (300 each).
// 3. Cliff width. Full width at half maximum of |grad t| across the cliffs (cells where it is above 2.5 times its rms and a local
//    maximum along the gradient), in LEDs: clamped cubic on the 128 by 256 grid 1.15 at kappa 0 (the grid's own limit, 2.3 cells),
//    1.30 at 0.03, 1.75 at 0.1, 2.65 at 0.3; bilinear 2.00, 2.15, 2.50, 3.20; the cubic on a 64 by 128 grid 2.20, 2.40, 3.10 for
//    0.03, 0.1, 0.3. At the knob's kappa 1.70, 1.70 and 1.55 at Scale -1, 0 and 1.
// 4. Chaos. The largest Lyapunov exponent of the exact flow, two particles started 1e-3 LED apart and renormalised every half flow
//    second for 4000, RK4 with the phases interpolated through the step: 0.064, 0.078 and 0.118 per flow second at k0 1.5, 2.4 and
//    5.04 (three flows at k0 2.4: 0.076, 0.078, 0.079, each plus or minus 0.0015), which is 0.22 of the rms strain of 0.29, 0.36 and 0.53. A
//    separation doubles in 8.9 flow seconds, 4.4 s at Flow 2. Faster or slower phases and longer or shorter correlation times than
//    the ones used gave 0.03 to 0.09 per flow second; this is near the top of what these 40 modes do.
// 5. The knobs. Each knob at either end or anywhere between, jumping every 2.5 s for 600 s and every 0.4 s for 150 s: the field stays finite,
//    the largest |t| is 4.5 times its rms at most and the rms never falls under 5.6 cells.
// The flowcheck of this study. 240 s at the opening, with every knob at its minimum, at its maximum and at three random
// positions: recur 0.747 to 0.779, dim 0.771 to 0.970, quiet 0.805 to 0.922, drift -2.6 to +0.6 percent; the last quarter dim 0.683 to
// 0.928, quiet 0.682 to 0.853. The worst case is every knob at its minimum (recur 0.779, dim 0.771, quiet 0.805; last quarter
// 0.683 and 0.682). 900 s at the opening: recur 0.764, dim 0.971, quiet 0.946, the last quarter dim 0.917, quiet 0.895, drift -0.1
// percent. 900 s with every knob at its minimum: recur 0.717, dim 0.917, quiet 0.905, the last quarter dim 0.833, quiet 0.608, drift +2.5 percent; at its maximum: 0.743, 0.986, 0.961, 0.950, 0.921, +0.2 percent.
//
// Not checked. A grid finer than 128 by 256. A pseudo-spectral reference for the scalar. The scale separation: the cliffs are
// 1.7 LEDs wide and the shortest wave in the flow at the opening is 16 LEDs long (95 percent of the energy is in waves over 20), a factor 9 to
// 12; at Scale 1 it is 10 LEDs and 1.55, a factor 7, with a Peclet number of 17. The Batchelor regime is real but not wide. The numbers in the
// knob lines are from one seed.
//
// What the picture adds. All of it is the picture's choice, none of it is in the equation. Both labels are divided by their
// running rms (followed at 5 percent a frame). The first, a, goes through s = tanh(a / 1.5) onto six Oklab stops (indigo, azure, a
// pale lilac, a pale cream, gold, amber) built by hand: the two pale stops sit either side of s = 0, so a cliff between an indigo
// and a gold sheet passes through them in a line as wide as the cliff and shows as an ice-white crease. The second, b, moves each stop by
// 0.07 in lightness and 22 degrees of hue at plus or minus 1.5 rms. Contour ribs ride on top: the colour is multiplied by 1 plus
// 0.16 cos(2 pi a / 1 rms), faded out where the ribs would be closer than two LEDs, so they bunch at cliffs and vanish there, and
// spread on ramps. Every sim cell is coloured and four of them averaged to an LED, which is what gives a cliff its anti-aliasing.

const W = 64, H = 128;
const { floor, ceil, max, min, abs, sqrt, exp, log, pow, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const CFG = {
  gw: 128, // sim grid: 128 x 256 cells, half an LED each
  gh: 256,
  urms: 2.0, // rms flow speed, LEDs per flow second, at Scale 0
  kap: 0.08, // diffusivity at Scale 0, LED^2 per flow second
  nmodes: 40,
  sig: 0.32, // width of the spectrum in ln k
  smin: 0.15, // wave speed of a mode, as a fraction of the rms speed: from smin to smax, either way
  smax: 0.75,
  ouT: 5, // correlation time of the random part of the phase, flow seconds
  ouS: 1.2, // and its rms, radians
  pre: 14, // flow seconds before the first frame, on the coarse grid
  tilt: 2.4, // radians of mean-gradient direction at Tilt 1
  band: 1.0, // contour period of the first label, in rms of the field
  ribs: 0.16, // contour amplitude, as a fraction of the colour
  hb: 22, // degrees of hue the second label moves a stop by, at plus or minus 1.5 rms
  lb: 0.07, // and the lightness
};

// ---- Fourier transforms (as cellular-flame.js) ---------------------------------------------
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

// ---- the grid -----------------------------------------------------------------------------
function makeGrid(gw, gh) {
  const n = gw * gh;
  return {
    gw, gh, n, mx: gw - 1, my: gh - 1, sc: gw / W,
    Tx: table(gw), Ty: table(gh),
    re: new Float64Array(n), im: new Float64Array(n),
    cr: new Float64Array(gh), ci: new Float64Array(gh), cols: new Uint8Array(gw),
    U: new Float32Array(n), V: new Float32Array(n),
    A: new Float32Array(n), B: new Float32Array(n), A2: new Float32Array(n), B2: new Float32Array(n),
    umax: 0,
  };
}

// ---- the flow ------------------------------------------------------------------------------
// psi = sum_k a_k cos(k.x + phase_k). Library: every integer (m, n) on the torus with 0.9 <= q <= 11.5, q = sqrt(m^2 + (n/2)^2)
// in units of one wave across the 64 LEDs. Half plane only (the mode and its mirror are one cosine).
const LIB = [];
for (let m = -12; m <= 12; m++)
  for (let n = 0; n <= 24; n++) {
    if (n === 0 && m <= 0) continue;
    const q = sqrt(m * m + (n * n) / 4);
    if (q >= 0.9 && q <= 11.5) LIB.push({ m, n, q });
  }
const NL = LIB.length;

function randn() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

function makeFlow() {
  const F = {
    g: new Float64Array(NL), // random gain
    s: new Float64Array(NL), // wave speed as a fraction of the rms speed, signed
    ph: new Float64Array(NL), xi: new Float64Array(NL),
    w: new Float64Array(NL), // weight now
    k0: -1, t: 0, norm: 1,
    tmp: new Float64Array(NL),
  };
  for (let i = 0; i < NL; i++) {
    F.g[i] = 0.75 + 0.5 * Math.random();
    F.s[i] = (CFG.smin + (CFG.smax - CFG.smin) * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
    F.ph[i] = TAU * Math.random();
    F.xi[i] = CFG.ouS * randn();
  }
  return F;
}

// Spectrum weights for a peak at k0, soft-capped at CFG.nmodes modes: subtract the weight of the next one down, so the set
// changes continuously as k0 moves.
function weights(F, k0) {
  const { w, tmp, g } = F;
  for (let i = 0; i < NL; i++) {
    const r = log(LIB[i].q / k0) / CFG.sig;
    w[i] = exp(-0.5 * r * r) * g[i];
    tmp[i] = w[i];
  }
  tmp.sort();
  const cap = tmp[NL - 1 - CFG.nmodes];
  let s2 = 0;
  for (let i = 0; i < NL; i++) {
    w[i] = max(0, w[i] - cap);
    s2 += w[i] * w[i];
  }
  F.norm = 1 / sqrt(0.5 * s2);
  F.k0 = k0;
}

// Advance the flow's clock by h flow seconds.
function flowStep(F, h, urms) {
  const f = exp(-h / CFG.ouT), n = CFG.ouS * sqrt(1 - f * f);
  for (let i = 0; i < NL; i++) {
    if (F.w[i] === 0) continue;
    F.ph[i] += h * (TAU / W) * LIB[i].q * urms * F.s[i];
    F.xi[i] = F.xi[i] * f + n * randn();
  }
  F.t += h;
}

// The flow on the grid, in cells per flow second: u = (psi_y, -psi_x) as the real and imaginary part of one transform.
function synth(g, F, urms) {
  const { re, im, gw, gh, mx, my, sc, Tx, Ty, cr, ci, cols } = g;
  re.fill(0);
  im.fill(0);
  cols.fill(0);
  const norm = F.norm * urms / ((TAU / W));
  for (let i = 0; i < NL; i++) {
    const wgt = F.w[i];
    if (wgt === 0) continue;
    const { m, n, q } = LIB[i];
    const kx = (TAU * m) / W, ky = (TAU * n) / H;
    const a = (norm * wgt) / q; // psi amplitude, LED^2 per flow second
    const c = 0.5 * a * sc;
    const ph = F.ph[i] + F.xi[i], cp = cos(ph), sp = sin(ph);
    const p1 = (n & my) * gw + (m & mx), p2 = (-n & my) * gw + (-m & mx);
    re[p1] += c * (kx * cp - ky * sp);
    im[p1] += c * (kx * sp + ky * cp);
    re[p2] -= c * (kx * cp + ky * sp);
    im[p2] -= c * (ky * cp - kx * sp);
    cols[m & mx] = cols[-m & mx] = 1;
  }
  for (let j = 0; j < gw; j++) {
    if (!cols[j]) continue;
    for (let i = 0, p = j; i < gh; i++, p += gw) {
      cr[i] = re[p];
      ci[i] = im[p];
    }
    fft1(ci, cr, 0, Ty);
    for (let i = 0, p = j; i < gh; i++, p += gw) {
      re[p] = cr[i];
      im[p] = ci[i];
    }
  }
  const U = g.U, V = g.V;
  let um = 0;
  for (let i = 0; i < gh; i++) {
    fft1(im, re, i * gw, Tx);
    for (let j = 0, p = i * gw; j < gw; j++, p++) {
      const u = re[p], v = im[p];
      U[p] = u;
      V[p] = v;
      const s = u * u + v * v;
      if (s > um) um = s;
    }
  }
  g.umax = sqrt(um);
}

// ---- one semi-Lagrangian step of h flow seconds ---------------------------------------------
// Midpoint trace back with the flow at mid step, Catmull-Rom clamped to the four cells round the foot, then the source -u (for
// the field with its gradient along x) and -v (along y), taken at the middle of the path.
function advect(g, h) {
  const { gw, gh, mx, my, U, V, A, B, A2, B2 } = g;
  const hh = 0.5 * h;
  let sa = 0, sb = 0;
  for (let i = 0; i < gh; i++) {
    for (let j = 0, p = i * gw; j < gw; j++, p++) {
      let x = j - hh * U[p], y = i - hh * V[p];
      let ix = floor(x), iy = floor(y), tx = x - ix, ty = y - iy;
      const c0 = ix & mx, c1 = (ix + 1) & mx, r0 = (iy & my) * gw, r1 = ((iy + 1) & my) * gw;
      const um = (U[r0 + c0] * (1 - tx) + U[r0 + c1] * tx) * (1 - ty) + (U[r1 + c0] * (1 - tx) + U[r1 + c1] * tx) * ty;
      const vm = (V[r0 + c0] * (1 - tx) + V[r0 + c1] * tx) * (1 - ty) + (V[r1 + c0] * (1 - tx) + V[r1 + c1] * tx) * ty;
      x = j - h * um;
      y = i - h * vm;
      ix = floor(x);
      iy = floor(y);
      tx = x - ix;
      ty = y - iy;
      let va, vb;
      const t2 = tx * tx, t3 = t2 * tx, s2 = ty * ty, s3 = s2 * ty;
      const w0 = -0.5 * t3 + t2 - 0.5 * tx, w1 = 1.5 * t3 - 2.5 * t2 + 1, w2 = -1.5 * t3 + 2 * t2 + 0.5 * tx, w3 = 0.5 * t3 - 0.5 * t2;
      const z0 = -0.5 * s3 + s2 - 0.5 * ty, z1 = 1.5 * s3 - 2.5 * s2 + 1, z2 = -1.5 * s3 + 2 * s2 + 0.5 * ty, z3 = 0.5 * s3 - 0.5 * s2;
      const k0 = (ix - 1) & mx, k1 = ix & mx, k2 = (ix + 1) & mx, k3 = (ix + 2) & mx;
      const q0 = ((iy - 1) & my) * gw, q1 = (iy & my) * gw, q2 = ((iy + 1) & my) * gw, q3 = ((iy + 2) & my) * gw;
      va = z0 * (w0 * A[q0 + k0] + w1 * A[q0 + k1] + w2 * A[q0 + k2] + w3 * A[q0 + k3]) +
        z1 * (w0 * A[q1 + k0] + w1 * A[q1 + k1] + w2 * A[q1 + k2] + w3 * A[q1 + k3]) +
        z2 * (w0 * A[q2 + k0] + w1 * A[q2 + k1] + w2 * A[q2 + k2] + w3 * A[q2 + k3]) +
        z3 * (w0 * A[q3 + k0] + w1 * A[q3 + k1] + w2 * A[q3 + k2] + w3 * A[q3 + k3]);
      vb = z0 * (w0 * B[q0 + k0] + w1 * B[q0 + k1] + w2 * B[q0 + k2] + w3 * B[q0 + k3]) +
        z1 * (w0 * B[q1 + k0] + w1 * B[q1 + k1] + w2 * B[q1 + k2] + w3 * B[q1 + k3]) +
        z2 * (w0 * B[q2 + k0] + w1 * B[q2 + k1] + w2 * B[q2 + k2] + w3 * B[q2 + k3]) +
        z3 * (w0 * B[q3 + k0] + w1 * B[q3 + k1] + w2 * B[q3 + k2] + w3 * B[q3 + k3]);
      let a1 = A[q1 + k1], a2 = A[q1 + k2], a3 = A[q2 + k1], a4 = A[q2 + k2];
      const lo = min(a1, a2, a3, a4), hi = max(a1, a2, a3, a4);
      va = va < lo ? lo : va > hi ? hi : va;
      a1 = B[q1 + k1];
      a2 = B[q1 + k2];
      a3 = B[q2 + k1];
      a4 = B[q2 + k2];
      const lo2 = min(a1, a2, a3, a4), hi2 = max(a1, a2, a3, a4);
      vb = vb < lo2 ? lo2 : vb > hi2 ? hi2 : vb;
      va -= h * um;
      vb -= h * vm;
      A2[p] = va;
      B2[p] = vb;
      sa += va;
      sb += vb;
    }
  }
  // the mean of the fluctuation means nothing (theta = G y + c solves the same equation), so it is taken out
  sa /= g.n;
  sb /= g.n;
  for (let p = 0; p < g.n; p++) {
    A2[p] -= sa;
    B2[p] -= sb;
  }
  g.A = A2;
  g.A2 = A;
  g.B = B2;
  g.B2 = B;
}

// Explicit diffusion, kappa in cells^2 per flow second: r = kappa h <= 1/4.
function diffuse(g, r) {
  const { gw, gh, mx, my, A, B, A2, B2 } = g;
  for (let i = 0; i < gh; i++) {
    const up = ((i - 1) & my) * gw, md = i * gw, dn = ((i + 1) & my) * gw;
    for (let j = 0; j < gw; j++) {
      const l = (j - 1) & mx, rr = (j + 1) & mx;
      A2[md + j] = A[md + j] + r * (A[md + l] + A[md + rr] + A[up + j] + A[dn + j] - 4 * A[md + j]);
      B2[md + j] = B[md + j] + r * (B[md + l] + B[md + rr] + B[up + j] + B[dn + j] - 4 * B[md + j]);
    }
  }
  g.A = A2;
  g.A2 = A;
  g.B = B2;
  g.B2 = B;
}

// ---- state and frame -----------------------------------------------------------------------
const OPEN = [0, 2, 0, 0.06];
const k0Of = (s) => 2.4 * pow(s < 0 ? 1.6 : 2.1, cl(s, -1, 1));
const urmsOf = (k0) => CFG.urms * pow(k0 / 2.4, -0.4);
const kapOf = (k0) => CFG.kap * pow(k0 / 2.4, 0.6);

// Catmull-Rom weights for the fraction t.
function cw4(t, w) {
  const t2 = t * t, t3 = t2 * t;
  w[0] = -0.5 * t3 + t2 - 0.5 * t;
  w[1] = 1.5 * t3 - 2.5 * t2 + 1;
  w[2] = -1.5 * t3 + 2 * t2 + 0.5 * t;
  w[3] = 0.5 * t3 - 0.5 * t2;
}

// The coarse grid onto the fine one, cubic (node j of the fine grid is node j/2 of the coarse one).
function upsample(gc, g) {
  const cw = gc.gw, kk = g.gw / cw, wx = [0, 0, 0, 0], wy = [0, 0, 0, 0];
  for (let i = 0; i < g.gh; i++)
    for (let j = 0; j < g.gw; j++) {
      const x = j / kk, y = i / kk, ix = floor(x), iy = floor(y);
      cw4(x - ix, wx);
      cw4(y - iy, wy);
      let a = 0, b = 0;
      for (let r = 0; r < 4; r++) {
        const row = ((iy - 1 + r) & gc.my) * cw;
        for (let c = 0; c < 4; c++) {
          const w = wx[c] * wy[r], q = row + ((ix - 1 + c) & gc.mx);
          a += w * gc.A[q];
          b += w * gc.B[q];
        }
      }
      g.A[i * g.gw + j] = a;
      g.B[i * g.gw + j] = b;
    }
}

function start(params, k) {
  const g = makeGrid(CFG.gw, CFG.gh), gc = makeGrid(CFG.gw / 2, CFG.gh / 2);
  const F = makeFlow();
  const S = { g, F, k0: k0Of(k[2]), phi: cl(k[3], -1, 1) * CFG.tilt, hue: 0, lutHue: -9, lut: null, ra: 0, umax: 8, kap: 0 };
  params.s = S;
  weights(F, S.k0);
  S.urms = urmsOf(S.k0);
  S.kap = kapOf(S.k0);
  // the first CFG.pre flow seconds on the coarse grid in long steps, then 1.6 on the fine one
  let um = 4;
  for (let t = 0; t < CFG.pre; ) {
    const st = min(2.2 / um, CFG.pre - t);
    flowStep(F, st / 2, S.urms);
    synth(gc, F, S.urms);
    um = gc.umax;
    advect(gc, st);
    flowStep(F, st / 2, S.urms);
    const r = S.kap * st * gc.sc * gc.sc, m = ceil(r / 0.22);
    for (let j = 0; j < m; j++) diffuse(gc, r / m);
    t += st;
  }
  upsample(gc, g);
  for (let i = 0; i < 4; i++) frame(S, 0.4, 3);
}

// One frame of h flow seconds, in as many steps as the flow and the diffusion need: nothing moves more than cfl cells a step.
function frame(S, h, cfl) {
  const { g, F } = S;
  const n = max(1, ceil((h * S.umax) / (cfl || 1.5))), st = h / n;
  for (let i = 0; i < n; i++) {
    flowStep(F, st / 2, S.urms);
    synth(g, F, S.urms);
    S.umax = g.umax;
    advect(g, st);
    flowStep(F, st / 2, S.urms);
    const r = S.kap * st * g.sc * g.sc, m = ceil(r / 0.22);
    for (let j = 0; j < m; j++) diffuse(g, r / m);
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.5, 4);
  const f = 1 - exp(-ft / 0.4);
  S.k0 += (k0Of(k[2]) - S.k0) * f;
  if (abs(S.k0 - S.F.k0) > 0.003) weights(S.F, S.k0);
  S.urms = urmsOf(S.k0);
  S.kap = kapOf(S.k0);
  S.hue = k[0];
  S.phi += (cl(k[3], -1, 1) * CFG.tilt - S.phi) * f;
  frame(S, ft * flow);
  // Never reached in the runs below. If the field ever went bad it would stay bad, so start it over.
  const chk = S.g.A[0] + S.g.B[S.g.n >> 1] + S.ra;
  if (!isFinite(chk) || abs(chk) > 1e6) start(params, k);
}

// ---- colour ---------------------------------------------------------------------------------
// Oklab stops over s = tanh(a / 1.5): deep indigo, azure, pale aqua, gold, orange. A stop outside the sRGB cube loses chroma
// until it is inside. The second label moves lightness, the contour ribs ride on top in draw().
const STOPS = [
  [-1, 0.3, 0.13, 275],
  [-0.5, 0.48, 0.15, 255],
  [-0.15, 0.8, 0.05, 255],
  [0.15, 0.9, 0.06, 95],
  [0.5, 0.82, 0.15, 85],
  [1, 0.68, 0.15, 68],
];
const NS = 96, NB = 25;

function okRgb(L, C, h, out) {
  const hr = (h * PI) / 180;
  for (let k = 1; k >= 0; k -= 0.05) {
    const a = C * k * cos(hr), b = C * k * sin(hr);
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
const RGB = [0, 0, 0], FLOOR = 70;

function buildLut(S, hue) {
  if (!S.lut) S.lut = new Uint8Array(NS * NB * 3);
  S.lutHue = hue;
  for (let i = 0; i < NS; i++) {
    const x = (i / (NS - 1)) * 2 - 1;
    let j = 1;
    while (j < STOPS.length - 1 && x > STOPS[j][0]) j++;
    const a = STOPS[j - 1], b = STOPS[j], t = cl((x - a[0]) / (b[0] - a[0]), 0, 1);
    for (let q = 0; q < NB; q++) {
      const y = (q / (NB - 1)) * 2 - 1;
      const h = a[3] + (b[3] - a[3]) * t + hue * 360 + CFG.hb * y;
      let L = a[1] + (b[1] - a[1]) * t + CFG.lb * y;
      // A dark orange or olive is brown on the panel: between red and yellow-green the dark stops are lifted.
      L += max(0, 1 - abs(((h - 60 + 540) % 360) - 180) / 100) * max(0, 0.62 - L) * 1.3;
      okRgb(cl(L, 0.25, 0.95), a[2] + (b[2] - a[2]) * t, h, RGB);
      let r = enc(RGB[0]), g = enc(RGB[1]), bl = enc(RGB[2]);
      const top = max(r, g, bl), up = top < FLOOR && top > 0 ? FLOOR / top : 1;
      const o = (i * NB + q) * 3;
      S.lut[o] = min(255, (r * up + 0.5) | 0);
      S.lut[o + 1] = min(255, (g * up + 0.5) | 0);
      S.lut[o + 2] = min(255, (bl * up + 0.5) | 0);
    }
  }
}

const TANH = new Float32Array(1025);
for (let i = 0; i < 1025; i++) TANH[i] = Math.tanh((i - 512) / 128); // tanh(x) for x in [-4, 4)
const RIB = new Float32Array(256);
for (let i = 0; i < 256; i++) RIB[i] = cos((TAU * i) / 256);
const th = (x) => TANH[cl((x * 128 + 512.5) | 0, 0, 1024)];

// Both labels in units of the field's rms: a along the mean gradient, b across it. The sim cell is half an LED, four cells make
// one LED, and a ribbon of contours is dropped from the picture where its period spans less than four cells (two LEDs), which is
// where an LED can no longer show it.
export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const g = S.g, { gw, mx, my, A, B } = g;
  const hue = cl(S.hue, 0, 1);
  if (abs(S.lutHue - hue) > 0.001) buildLut(S, hue);
  const lut = S.lut;
  const c = cos(S.phi), s = sin(S.phi);
  let v = 0;
  for (let p = 0; p < g.n; p += 3) v += A[p] * A[p] + B[p] * B[p];
  const rms = sqrt(v / (2 * (g.n / 3)));
  S.ra = S.ra ? S.ra + (rms - S.ra) * 0.05 : rms;
  const ia = 1 / S.ra, pa = 256 / CFG.band, qa = 2 / CFG.band;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let R = 0, G = 0, Bc = 0;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const i = 2 * y + dy, j = 2 * x + dx, p = i * gw + j;
          const l = i * gw + ((j - 1) & mx), r = i * gw + ((j + 1) & mx), u = ((i - 1) & my) * gw + j, d = ((i + 1) & my) * gw + j;
          const a = (c * A[p] + s * B[p]) * ia, b = (-s * A[p] + c * B[p]) * ia;
          const dax = c * (A[r] - A[l]) + s * (B[r] - B[l]), day = c * (A[d] - A[u]) + s * (B[d] - B[u]);
          const fa = max(0, 1 - qa * ia * sqrt(dax * dax + day * day));
          const si = ((th(a / 1.5) + 1) * 0.5 * (NS - 1) + 0.5) | 0, bi = ((th(b / 1.5) + 1) * 0.5 * (NB - 1) + 0.5) | 0;
          const o = (si * NB + bi) * 3;
          const m = 1 + CFG.ribs * RIB[((a * pa) | 0) & 255] * fa;
          R += lut[o] * m;
          G += lut[o + 1] * m;
          Bc += lut[o + 2] * m;
        }
      display.setPixel(x, y, min(255, R * 0.25), min(255, G * 0.25), min(255, Bc * 0.25));
    }
}
