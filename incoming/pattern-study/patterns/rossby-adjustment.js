// ===== Patternflow pattern =====
// Title:   Rossby Adjustment
// Family:  sim
// Idea:    Bumps of random size and sign fall on a rotating shallow sea; each sends out a ring of waves and leaves a round lens that turns, drifts and fades while new rings cross it, the surface lit from the upper left like silver, with bronze hills and amethyst hollows.
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: geostrophic adjustment (Carl-Gustaf Rossby, 1937 and 1938) in the shallow water equations on an f-plane (Laplace's tidal equations, 1776), with the potential vorticity the lenses keep (Rossby, 1940; Hans Ertel, 1942); Fourier modes on a torus with a filter on the nonlinear terms in the spirit of the two-thirds rule (Steven Orszag, 1971); the waves and the damping carried exactly by an integrating factor (John Lawson, 1967) under Kutta's third order scheme (1901); all from memory
// Round:   125
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=1.5..5, Scale=-1..1, Rain=-1..1
//
// Knob 1: Hue. Turns every colour of the palette round the grey axis by the knob times 360 degrees. At 0 the flat sea is silver grey with warm brown in the shade, a hill is bronze and a hollow amethyst; at 0.33 the shade is deep green, the hills emerald and the hollows copper; at 0.66 the shade is plum, the hills violet and the hollows green.
// Knob 2: Flow. Model seconds per panel second. The waves run at c = f L_R = 8.5 LEDs per model second at the opening Scale, so 12.8 LEDs a panel second at Flow 1.5, 17 at the opening 2 and 42.5 at 5; one turn of the rotation (2 pi / f, 6.3 model seconds) takes 4.2, 3.1 and 1.3 panel seconds. The lenses are about 14 times slower than the waves: the water has an rms speed of 0.61 LEDs per model second.
// Knob 3: Scale. The Rossby radius L_R = 8.5 x 1.41 to the Scale LEDs: 6.0 at -1, 8.5 at 0 and 12.0 at 1, which is also the wave speed in LEDs per model second. A bump has a half-height radius of L_R times 0.45 to 1.35, mostly under 0.7, so 2.7 to 8.1, 3.8 to 11.5 and 5.4 to 16 LEDs. The number of bumps in a given area goes as 1 / L_R^2, so lenses cover about the same share of the sea at every Scale.
// Knob 4: Rain. Bumps per model second 1.1 x 1.5 to the Rain x (8.5 / L_R)^2: at Scale 0 that is 0.73 at -1, 1.13 at the opening 0.06 and 1.65 at 1, and at the opening Flow a bump every 0.44 panel seconds, two or three rings in the picture at once. Each has a height of 0.18 to 0.25 of the rest depth, up or down with equal odds.

// What the field is. Water of rest depth H on a torus 64 LEDs wide (x) and 128 tall (y, up the panel), turning at f = 1 per model second (a model second is 1 / Flow panel seconds). With u, v the velocity, h = eta / H the height of the surface over the rest depth and c^2 = g H = (f L_R)^2 the squared speed of long waves,
//   u_t + u u_x + v u_y - f v = - c^2 h_x,   v_t + u v_x + v v_y + f u = - c^2 h_y,   h_t + div((1 + h) u) = 0,
// less the damping below. The state is the vorticity z = v_x - u_y, the divergence d = u_x + v_y and h, each as 64 x 128 Fourier modes, one to an LED, and the same equations read
//   z_t = - f d - div(z u),   d_t = f z - c^2 lap h + dx(z v) - dy(z u) - lap K,   h_t = - d - div(h u),   K = (u^2 + v^2) / 2.
// Two things decide what a bump becomes. The linear part has waves of frequency w = sqrt(f^2 + c^2 k^2), which leave, and one mode of frequency 0, P = z - f h, which stays. A bump at rest has P = - f h, so it keeps the share 1 / (1 + k^2 L_R^2) of each of its modes as a lens in geostrophic balance (Rossby, 1938). A bump much smaller than L_R is mostly ring and hardly a lens (0.18 of its height is left at a half-height radius of 0.5 L_R, 0.38 at 1.0 and 0.53 at 1.5); a much larger one keeps its shape.
// The other thing is the potential vorticity q = (z + f) / (1 + h), which each parcel of water keeps: a lens is a patch of q that the flow carries and stretches and that merges with the next, and the waves hardly move it.
// Damping is set mode by mode in the basis of the linear part, so that the lens and the waves get their own. The balanced part P decays at 0.02 (k L_R)^2 / (1 + (k L_R)^2) + 0.02 k^2 + 0.05 k^4 + 0.04 exp(-k^2 / 0.09^2) per model second: the first term is a drag on the velocity as a lens feels it, and the last acts only on the largest scales, so that the lenses do not merge into one patch the size of the panel. The waves (d, and f z + c^2 k^2 h) decay at 0.02 + 1.52 k^2 + 0.05 k^4,
// where 1.5 of the 1.52 is a damping of the divergence that stops a ring from circling the torus for ever. None of this is in the equations of the sea; it is the picture's own. The mean of h is never set, so it stays 0.
// Rain. Bumps fall at exponentially distributed intervals (no period) at the rate of Knob 4. Each is a Gaussian of half-height radius L_R (0.45 + 0.9 u^2) and height +-(0.18 + 0.07 v), u and v uniform, at a uniform place, added to h with the water at rest around it. 30 model seconds run at three times the rain before the first frame.
// The scheme. A stage takes two inverse transforms (u + i v and z + i h, two real fields in one complex) and three forward ones (z u + i z v, h u + i h v and K); the nonlinear terms they give are multiplied by exp(-36 (k / 1.8)^16), a cut at 1.8 rad per LED. The linear part, waves and damping, is applied exactly with a table per (|nx|, |ny|) in Lawson's integrating-factor form of Kutta's third order scheme,
// so the step is limited by the speed of the lenses and not by the waves: one step a frame of at most 0.2 model seconds (0.167 at Flow 5), landing each frame on the model time the knob asks for, so Flow 1.5 is as smooth as Flow 5. With the two transforms of the picture a frame costs 17 of 64 x 128.
// The picture. The panel's y is the model's y turned over, so a hill turns clockwise as a high does. Colour comes from the anomaly of the potential vorticity, (1 + z / f) / (1 + h) - 1, with its sign turned and 0.6 h added so that a ring tints a little as it passes. Below 0.48 of its rms (followed over 8 s) the value leaves the sea silver grey; above that it goes by a smoothstep to bronze for a hill and amethyst for a hollow, full at 2.4 times its rms.
// Light is the slope of h along the line to the upper left, i (kx - ky) h in the Fourier modes with the broad part taken off by k^2 / (k^2 + 0.42^2), then g / (|g| + 0.45 rms g). A 64 x 64 table of colour and shade does the rest: on the dark side the colour is multiplied by 0.62, 0.54 and 0.46 at most in red, green and blue, which is warm brown, and on the lit side by 1.22, 1.28 and 1.36, which is cool white, with pale cream added above 0.55.
//
// What was checked, with this file's own step (scripts of mine, not in the repo):
// - The nonlinear terms with two real fields packed in one transform, against each field transformed alone: the relative difference is 6e-16 in z, 6e-15 in d and 1e-15 in h. Of the energy E = the sum of (1 + h)(u^2 + v^2) / 2 + c^2 h^2 / 2, the quadratic part changes by 0.026671 a model second through the nonlinear terms and the cubic part by -0.026671 through the linear part, which sum to 4e-11, as the equations ask.
// - The energy of one bump of 0.2 at L_R 8 over 30 model seconds with the damping off changes by 7e-8 of E at a step of 0.2, 1.7e-6 at 0.1 and 2.8e-7 at 0.05.
// - The speed of the waves. A straight pulse with no variation along y splits in two, and its front (where h reaches 5% of the crest), read from 0.5 to 2 model seconds, runs at 8.015 LEDs per model second for c = 8 with f near 0, at 7.907 for c = 8 with f = 1, at 11.955 for c = 12 and at 5.888 for c = 6. With the turning, a pulse 3 LEDs wide runs a little under c, since a wave of wavenumber k has the group speed c / sqrt(1 + 1 / (k L_R)^2).
// - Potential vorticity. A sea spun up by the rain (q from 0.7757 to 1.4212), then 30 model seconds with the damping and the rain off. The sum of (1 + h) q, which is the sum of z + f and so fixed by the mean of z being 0, stays 8192.000000 to 3e-15. The variance of q weighted by 1 + h changes by -2.4e-4 after 10 s, and after 30 s by -1.64e-3, -1.26e-3 and -1.21e-3 at steps of 0.2, 0.1 and 0.05; the sum of (1 + h) q^2 by -1.3e-5, -1.0e-5 and -9.7e-6; E by 7e-5 at most.
//   The extremes of q go from 0.7757 and 1.4212 to 0.7786 and 1.4200 after 30 s, with the top at 1.4220 in between, 0.06% above where it began. What is left at a small step is the cut, which takes the finest scales the flow makes, and not the step.
// - The lens that is left. One bump on the plane leaves a lens that the balance with the potential vorticity fixes. Three results side by side: this solver with the waves damped (0.15 and 0.3 k^2) and the balanced part not, read from 40 to 60 model seconds with the mean of h that the torus takes out (0.2 times the bump's volume over 8192, 0.0038 at 0.2) put back; an axisymmetric solver of mine on the plane in Lagrangian form,
//   where each ring of water keeps its mass and its angular momentum f r0^2 / 2 (nodes 0.25 LEDs apart out to 600, no damping, averaged from 40 to 70 model seconds); and the linear result 1 / (1 + k^2 L_R^2). Centre height and half-height radius at L_R 8, bump height 0.2, for a half-height radius r_b of 0.5 L_R: 0.0355 and 7.5 LEDs here, 0.0355 and 7.5 Lagrangian, 0.0378 and 7.1 linear; for 1.0 L_R: 0.0756 and 11.9, 0.0755 and 11.8, 0.0800 and 11.3;
//   for 1.5 L_R: 0.1064 and 15.9, 0.1058 and 15.8, 0.1112 and 15.2. At a bump of 0.02 and 1.0 L_R the three agree at 0.008 and 11.3 to 11.4. So the solver is on the nonlinear lens to 0.6% in height and 0.1 LED in size, and the linear result is 5% too high at 0.2.
// - 900 s through update() at the opening, all minimum and all maximum, 30 fps: no restart (the guard fires at |h| over 0.8); the largest |h| in any frame 0.47, 0.42 and 0.46, where two bumps fell on one place, and 0.28 at most at the minute marks (at Scale -1 and Rain 1, the thickest sea, 300 s reached 0.59); the mean of h under 1e-16 and the share of the sea above the rest depth 0.52, 0.51 and 0.52, so the thickness drifts to neither side. The energy E has a mean of 2850, 1180 and 6610, and at the minute marks after the first it runs from 2000 to 4020, 660 to 1480 and 2880 to 12430, with no trend.
//   The balanced part holds 0.72, 0.83 and 0.47 of the energy on average and the waves the rest. The energy in modes under k = 0.115, wavelength over 55 LEDs, is 0.63, 0.43 and 0.76 of the balanced part, and the largest single balanced mode 0.06 to 0.33 of it: at all maximum L_R is 12, so the lenses themselves sit at that scale and the panel is not condensing into one vortex.
// - Eight seeds, 100 s each, at all maximum and all minimum: E means 5800 to 8550 and 930 to 1360, rms h 0.057 to 0.071 and 0.053 to 0.069, balanced share 0.43 to 0.61 and 0.78 to 0.86. None goes its own way.
// - flowcheck, 240 s, six sets (recur, dim, quiet, then the last quarter's dim and quiet): open 0.667, 0.911, 0.850, 0.867, 0.813; all minimum 0.621, 0.828, 0.809, 0.837, 0.698; all maximum 0.615, 0.964, 0.895, 0.906, 0.812; random 0.93/3.56/0.96/-0.61 0.671, 0.953, 0.878, 0.919, 0.767; random 0.24/3.52/-0.02/-0.82 0.664, 0.915, 0.878, 0.866, 0.802;
//   random 0.42/3.31/-0.96/0.11 0.733, 0.922, 0.872, 0.891, 0.735. The brightness of the last quarter is within 0.2% of the first in all six. 900 s (recur, dim, quiet): open 0.658, 0.937, 0.917; all minimum 0.592, 0.908, 0.906; all maximum 0.590, 0.966, 0.959. Measured on this file under its name, which seeds the rain.
// - Cost: 6.1 to 7.3 ms a frame (update and draw) in Node on a machine shared with two other jobs, of which update is 6.2 to 6.4 ms; the start takes 0.9 to 1.0 s.
//
// What failed first.
// 1. The K term of d_t came out N times too small: the filter table already held the 1 / N of the forward transform and I divided by it again. A bump of 0.2 lost 3% of its energy in two model seconds, whatever the step and the cut. Evaluating the terms with each field transformed alone found it (a difference of 2.3 in d, 6e-15 once fixed).
// 2. The light, taken from the raw slope of h, was two huge areas, one lit and one dark, since waves 30 to 55 LEDs long carry most of the slope. A high pass (its corner 0.2 rad per LED at first, 0.42 now) and the soft sign g / (|g| + 0.45 rms g) brought out the rings and the sides of the lenses.
// 3. Colour taken straight from the potential vorticity covered the panel in bronze and violet with no sea between, and the first bronze, a pale gold with its lit side clipped at 255 in red and green, came out lemon yellow on the panel. The dead zone and a bronze that stays under 255 when lit fixed both.
// 4. recur at all minimum was 0.20 (Flow 0.5, Rain -1, Scale -1), 0.29 at Flow 1, and 0.36 at Flow 1 over 900 s: the sea was thin, and frames 20 s apart looked alike. The rain went up (at Rain -1 and Scale 0, 0.2 to 0.47 a model second), the number of bumps began to go as 1 / L_R^2, and Flow now starts at 1.5. A drag of 0.06 on the balanced part made lenses that lost half their height in 15 model seconds; at 0.02 with the large-scale term 0.04 it is 34, and recur at the opening went from 0.46 to 0.61 (the rain fell from 0.8 to 0.55 with it).
// 5. Pairs that cross the panel did not come. A hill and a hollow 12 to 16 LEDs apart (bumps of 1.5 L_R) moved to 26 apart in 10 model seconds as the bumps adjusted, and then stood within 2 LEDs for 50 more. With a bump of 0.25 at most, the Rossby number of the sea is 0.081 (rms z over f), the water moves at 0.61 LEDs per model second, and the neighbour of a lens is screened by exp(-r / L_R). Lenses turn, drift a little, fade and merge; they do not travel.
// 6. The first open picture was a grey sheet with three or four big blobs and rings too faint to read. My own sheets had put the panel's CIE table on the screen as it is, which made every colour neon and every shadow black; look.ts shows the step back as lightness, so the palette I had tuned was wrong. Judged on that model the sea needed more shade and more colour: bumps are now mostly small (the rings), 1.6 times as many fall, the light has a warm dark side and a cool lit side, and the lenses a stronger tint.
// What was not checked. The merging of like lenses and the speed of a pair against the theory of modons (Melvin Stern, 1975; Vladimir Larichev and Gregory Reznik, 1976) are not counted; I looked at pictures only. A bump of 0.25 steepens into a bore in a tank without rotation, and here the cut and the damping of the divergence take it: no shock-capturing scheme was tried, and the largest |h| of 0.43 is where bumps overlap.
// A finer grid than 64 x 128 was not run, and the smallest bump, 3 LEDs in half-height radius at Scale -1, is 3 cells. f = 1 per model second is the one value tried. Three dimensions, where a bump also launches internal waves, are not in the equations. The damping, the rain and the light are the picture's own.

const W = 64, H = 128, N = W * H, WM = W - 1, HM = H - 1;
const { ceil, abs, sqrt, exp, log, cos, sin, max, pow } = Math;
const TAU = 2 * Math.PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];

const CFG = {
  f: 1.0, // Coriolis parameter, 1 per model second
  lr: 8.5, // Rossby radius at Scale 0, LEDs
  lrBase: 1.41, // Scale multiplies it by lrBase to the knob
  dtMax: 0.2, // longest step, model seconds
  cut: 1.8, // rad per LED, the filter on the nonlinear terms
  nu: 0.02, // viscosity, LED^2 per model second
  nu4: 0.05, // and the fourth-order one
  nud: 1.5, // extra damping of the waves (divergence), LED^2 per model second
  muW: 0.02, // drag on the waves
  muP: 0.02, // drag on the balanced flow at small scales, per model second
  muL: 0.04, // and an extra damping of the balanced flow at the largest scales
  kL: 0.09, // that is, below this wavenumber
  rain: 1.1, // bumps per model second at Rain 0
  rainBase: 1.5,
  ampLo: 0.18,
  ampHi: 0.25,
  k0: 0.42, // corner of the high pass on the slope that lights the surface, rad per LED
  pre: 30, // model seconds run before the first frame, at three times the rain
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
// QI: modes with the same |nx| and |ny| share a frequency, so the tables that cost a cos and an exp are kept per (|nx|, |ny|)
const NQ = (W / 2 + 1) * (H / 2 + 1);
const KX = new Float64Array(N), KY = new Float64Array(N), K2 = new Float64Array(N), FIL = new Float64Array(N);
const MIR = new Int32Array(N), QI = new Int32Array(N), K2Q = new Float64Array(NQ);
for (let j = 0; j < H; j++)
  for (let i = 0; i < W; i++) {
    const p = j * W + i, nx = i < W / 2 ? i : i - W, ny = j < H / 2 ? j : j - H;
    KX[p] = (TAU * nx) / W;
    KY[p] = (TAU * ny) / H;
    K2[p] = KX[p] * KX[p] + KY[p] * KY[p];
    MIR[p] = ((H - j) & HM) * W + ((W - i) & WM);
    QI[p] = abs(nx) * (H / 2 + 1) + abs(ny);
    K2Q[QI[p]] = K2[p];
    FIL[p] = exp(-36 * pow(sqrt(K2[p]) / CFG.cut, 16));
  }

// ---- the state: vorticity z, divergence d and height h (in units of the rest depth), as spectra ----
const mkV = () => ({ zr: new Float64Array(N), zi: new Float64Array(N), dr: new Float64Array(N), di: new Float64Array(N), hr: new Float64Array(N), hi: new Float64Array(N) });
const NAMES = ["zr", "zi", "dr", "di", "hr", "hi"];

// ---- tables that depend on the Rossby radius ----
function setRadius(S, lr) {
  S.lr = lr;
  const f = CFG.f, c2 = f * f * lr * lr;
  S.c2 = c2;
  for (let p = 0; p < N; p++) {
    S.cK[p] = c2 * K2[p];
    S.iw2[p] = 1 / (f * f + c2 * K2[p]);
  }
  for (let q = 0; q < NQ; q++) {
    const k2 = K2Q[q], k4 = k2 * k2, kl2 = k2 * lr * lr;
    S.dW[q] = CFG.muW + (CFG.nu + CFG.nud) * k2 + CFG.nu4 * k4;
    S.dP[q] = CFG.muP * (kl2 / (1 + kl2)) + CFG.nu * k2 + CFG.nu4 * k4 + CFG.muL * exp(-k2 / (CFG.kL * CFG.kL));
  }
  S.tauF = -1;
}
// propagator for a time tau: the waves turn at w = sqrt(f^2 + c^2 k^2) and decay at dW, the balanced part decays at dP
function setTables(S, tau) {
  const f = CFG.f;
  for (let pass = 0; pass < 2; pass++) {
    const T = pass ? S.TH : S.TF, t = pass ? 0.5 * tau : tau;
    for (let q = 0; q < NQ; q++) {
      const w = sqrt(f * f + S.c2 * K2Q[q]), eW = exp(-S.dW[q] * t), ph = w * t, sn = sin(ph);
      T.eP[q] = exp(-S.dP[q] * t);
      T.aC[q] = eW * cos(ph);
      T.aS[q] = (eW * sn) / w;
      T.aW[q] = eW * w * sn;
    }
  }
  S.tauF = tau;
}
// out = sc * E_T (a + kb b) (+ out when add)
function prop(S, T, a, b, kb, out, add, sc) {
  const f = CFG.f, { cK, iw2 } = S, { eP, aC, aS, aW } = T;
  for (let c = 0; c < 2; c++) {
    const zA = c ? a.zi : a.zr, dA = c ? a.di : a.dr, hA = c ? a.hi : a.hr;
    const zB = b ? (c ? b.zi : b.zr) : zA, dB = b ? (c ? b.di : b.dr) : dA, hB = b ? (c ? b.hi : b.hr) : hA;
    const zO = c ? out.zi : out.zr, dO = c ? out.di : out.dr, hO = c ? out.hi : out.hr;
    const k = b ? kb : 0;
    for (let p = 1; p < N; p++) {
      const z = zA[p] + k * zB[p], d = dA[p] + k * dB[p], h = hA[p] + k * hB[p], q = QI[p];
      const P = z - f * h, A = f * z + cK[p] * h;
      const P1 = eP[q] * P, d1 = aC[q] * d + aS[q] * A, A1 = aC[q] * A - aW[q] * d;
      const w2 = iw2[p];
      const h1 = (A1 - f * P1) * w2, z1 = (cK[p] * P1 + f * A1) * w2;
      if (add) {
        zO[p] += sc * z1;
        dO[p] += sc * d1;
        hO[p] += sc * h1;
      } else {
        zO[p] = sc * z1;
        dO[p] = sc * d1;
        hO[p] = sc * h1;
      }
    }
    zO[0] = dO[0] = hO[0] = 0;
  }
}

// ---- the nonlinear terms ----
//   z_t = - div(z u), d_t = dx(z v) - dy(z u) - lap K, h_t = - div(h u), K = (u^2 + v^2) / 2
// u and v from z and d by the stream function and the velocity potential. Two inverse transforms (u + iv and z + ih),
// three forward ones (zu + izv, hu + ihv and K), the pairs separated by the mirror mode.
function rhs(S, V, O) {
  const { ar, ai, br, bi, cr, ci } = S, inv = 1 / N;
  const { zr, zi, dr, di, hr, hi } = V;
  for (let p = 0; p < N; p++) {
    const k2 = K2[p];
    if (k2 === 0) {
      ar[p] = ai[p] = 0;
    } else {
      const kx = KX[p], ky = KY[p], i2 = 1 / k2, a = zr[p], b = zi[p], c = dr[p], d = di[p];
      ar[p] = (-ky * b + kx * d + kx * a + ky * c) * i2; // the spectrum of u + i v
      ai[p] = (ky * a - kx * c + kx * b + ky * d) * i2;
    }
    br[p] = zr[p] - hi[p];
    bi[p] = zi[p] + hr[p];
  }
  fft2(ar, ai, true);
  fft2(br, bi, true);
  for (let p = 0; p < N; p++) {
    const u = ar[p], v = ai[p], z = br[p], h = bi[p];
    ar[p] = z * u;
    ai[p] = z * v;
    br[p] = h * u;
    bi[p] = h * v;
    cr[p] = 0.5 * (u * u + v * v);
    ci[p] = 0;
  }
  fft2(ar, ai, false);
  fft2(br, bi, false);
  fft2(cr, ci, false);
  const { zr: Zr, zi: Zi, dr: Dr, di: Di, hr: Hr, hi: Hi } = O;
  for (let p = 1; p < N; p++) {
    const m = MIR[p], kx = KX[p], ky = KY[p], fl = FIL[p] * inv;
    // F1 = z u, F2 = z v
    const f1r = 0.5 * (ar[p] + ar[m]), f1i = 0.5 * (ai[p] - ai[m]);
    const f2r = 0.5 * (ai[p] + ai[m]), f2i = -0.5 * (ar[p] - ar[m]);
    // G1 = h u, G2 = h v
    const g1r = 0.5 * (br[p] + br[m]), g1i = 0.5 * (bi[p] - bi[m]);
    const g2r = 0.5 * (bi[p] + bi[m]), g2i = -0.5 * (br[p] - br[m]);
    // N_z = -i (kx F1 + ky F2)
    Zr[p] = (kx * f1i + ky * f2i) * fl;
    Zi[p] = -(kx * f1r + ky * f2r) * fl;
    // N_d = i (kx F2 - ky F1) + k^2 K
    Dr[p] = (-(kx * f2i - ky * f1i) + K2[p] * cr[p]) * fl;
    Di[p] = (kx * f2r - ky * f1r + K2[p] * ci[p]) * fl;
    // N_h = -i (kx G1 + ky G2)
    Hr[p] = (kx * g1i + ky * g2i) * fl;
    Hi[p] = -(kx * g1r + ky * g2r) * fl;
  }
  Zr[0] = Zi[0] = Dr[0] = Di[0] = Hr[0] = Hi[0] = 0;
}

function combine(out, a, b, kb) {
  for (const nm of NAMES) {
    const o = out[nm], x = a[nm], y = b[nm];
    for (let p = 0; p < N; p++) o[p] = x[p] + kb * y[p];
  }
}

// Lawson's form of Kutta's third order scheme: the linear part, waves and damping, goes in exactly
function step(S, tau) {
  if (abs(S.tauF - tau) > 1e-9) setTables(S, tau);
  const { U, K1, K2v, K3, V1, V2 } = S;
  rhs(S, U, K1);
  combine(V1, U, K1, 0.5 * tau);
  prop(S, S.TH, V1, null, 0, V2, false, 1);
  rhs(S, V2, K2v);
  prop(S, S.TF, U, K1, -tau, V1, false, 1);
  prop(S, S.TH, K2v, null, 0, V1, true, 2 * tau);
  rhs(S, V1, K3);
  prop(S, S.TF, U, K1, tau / 6, V2, false, 1);
  prop(S, S.TH, K2v, null, 0, V2, true, (2 * tau) / 3);
  for (const nm of NAMES) {
    const o = U[nm], a = V2[nm], b = K3[nm];
    for (let p = 0; p < N; p++) o[p] = a[p] + (tau / 6) * b[p];
  }
  S.time += tau;
}

// a Gaussian bump of height amp (in rest depths), half-height radius rad, at (x0, y0): its spectrum, mean left out
function addBump(S, amp, rad, x0, y0) {
  const sg = rad / 1.1774, a = (amp * TAU * sg * sg) / N, V = S.U;
  const ex = new Float64Array(W), ey = new Float64Array(H), exs = new Float64Array(W), eys = new Float64Array(H);
  for (let i = 0; i < W; i++) {
    const nx = i < W / 2 ? i : i - W, kx = (TAU * nx) / W;
    ex[i] = cos(kx * x0);
    exs[i] = -sin(kx * x0);
  }
  for (let j = 0; j < H; j++) {
    const ny = j < H / 2 ? j : j - H, ky = (TAU * ny) / H;
    ey[j] = cos(ky * y0);
    eys[j] = -sin(ky * y0);
  }
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const p = j * W + i;
      if (p === 0) continue;
      const g = a * exp(-0.5 * K2[p] * sg * sg), cr = ex[i] * ey[j] - exs[i] * eys[j], ci = ex[i] * eys[j] + exs[i] * ey[j];
      V.hr[p] += g * cr;
      V.hi[p] += g * ci;
    }
}

// bumps per model second; the number per area goes as 1 / lr^2, so the share of the sea a lens covers does not change with Scale
function rainRate(S, k) {
  const r = CFG.lr / S.lr;
  return CFG.rain * pow(CFG.rainBase, cl(k, -1.2, 1.2)) * r * r;
}
function nextDrop(S, rate) {
  S.next = S.time - log(1 - Math.random()) / rate;
}
function drop(S) {
  const u = Math.random(), rad = S.lr * (0.45 + 0.9 * u * u); // small bumps are the more common, and they are the rings
  const amp = (Math.random() < 0.5 ? -1 : 1) * (CFG.ampLo + (CFG.ampHi - CFG.ampLo) * Math.random());
  addBump(S, amp, rad, Math.random() * W, Math.random() * H);
}

const lrOf = (v) => CFG.lr * pow(CFG.lrBase, cl(v, -1.2, 1.2));

function newState(lr) {
  const mk = () => new Float64Array(N);
  const tb = () => ({ eP: new Float64Array(NQ), aC: new Float64Array(NQ), aS: new Float64Array(NQ), aW: new Float64Array(NQ) });
  const S = {
    U: mkV(), K1: mkV(), K2v: mkV(), K3: mkV(), V1: mkV(), V2: mkV(),
    ar: mk(), ai: mk(), br: mk(), bi: mk(), cr: mk(), ci: mk(),
    cK: mk(), iw2: mk(), dW: new Float64Array(NQ), dP: new Float64Array(NQ), TF: tb(), TH: tb(),
    lr: lr, c2: 0, tauF: -1, time: 0, next: 0, acc: 0, ready: false, rate: 1,
    pz: new Float64Array(N), ph: new Float64Array(N), cz: new Float64Array(N), cg: new Float64Array(N), hue: 0, lutHue: -9, lut: new Uint8Array(NB * NS * 3), qs: 0.06, gs: 20,
  };
  setRadius(S, lr);
  return S;
}

function physical(S) {
  const { ar, ai, br, bi, U } = S, f = CFG.f;
  for (let p = 0; p < N; p++) {
    ar[p] = U.zr[p] - U.hi[p];
    ai[p] = U.zi[p] + U.hr[p];
    // the slope of the height along the light, i (kx - ky) h, with the broad part taken off (high pass of corner k0)
    const k2 = K2[p], hp = k2 / (k2 + CFG.k0 * CFG.k0), c = KX[p] - KY[p];
    br[p] = -c * U.hi[p] * hp;
    bi[p] = c * U.hr[p] * hp;
  }
  fft2(ar, ai, true);
  fft2(br, bi, true);
  let q2 = 0, g2 = 0;
  for (let p = 0; p < N; p++) {
    S.pz[p] = ar[p];
    S.ph[p] = ai[p];
    const z = 0.6 * ai[p] - ((1 + ar[p] / f) / (1 + ai[p]) - 1);
    S.cz[p] = z;
    S.cg[p] = br[p];
    q2 += z * z;
    g2 += br[p] * br[p];
  }
  S.qr = sqrt(q2 / N);
  S.gr = sqrt(g2 / N);
  let hm = 0;
  for (let p = 0; p < N; p++) hm = max(hm, abs(S.ph[p]));
  S.hmax = hm;
}

function start(params, k) {
  const S = newState(lrOf(k[2]));
  params.s = S;
  S.rate = rainRate(S, k[3]);
  nextDrop(S, 3 * S.rate);
  const n = ceil(CFG.pre / CFG.dtMax);
  for (let i = 0; i < n; i++) {
    while (S.next <= S.time) (drop(S), nextDrop(S, 3 * S.rate));
    step(S, CFG.dtMax);
  }
  nextDrop(S, S.rate);
  S.ready = true;
  physical(S);
  S.qe = S.qr;
  S.ge = S.gr;
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.1, 8);
  S.hue = cl(k[0], 0, 1);
  const lt = lrOf(k[2]);
  if (abs(lt - S.lr) > 1e-4) setRadius(S, S.lr + (lt - S.lr) * (1 - exp(-ft / 0.5)));
  S.rate = rainRate(S, k[3]);
  let rest = ft * flow;
  const n = max(1, ceil(rest / CFG.dtMax - 1e-9)), tau = rest / n;
  if (rest > 1e-9) {
    for (let i = 0; i < n; i++) {
      step(S, tau);
      while (S.next <= S.time) (drop(S), nextDrop(S, S.rate));
    }
  }
  physical(S);
  // the colour and light gains follow the rms of the potential vorticity and of the slope, slowly
  const ea = 1 - exp(-ft / 8);
  S.qe += (S.qr - S.qe) * ea;
  S.ge += (S.gr - S.ge) * ea;
  S.qs = max(0.012, 2.4 * S.qe);
  S.gs = 0.45 * S.ge;
  if (!isFinite(S.pz[N >> 1] + S.ph[N >> 2] + S.hmax) || S.hmax > 0.8) start(params, k);
}

// ---- colour: the balanced part (potential vorticity) picks the metal, the slope of the surface lights it ----
// stops over b = 0 for a hollow, 0.5 for the flat sea and 1 for a hill
const STOPS = [
  [0.0, 132, 86, 170],
  [0.3, 146, 124, 164],
  [0.5, 160, 158, 154],
  [0.7, 206, 176, 112],
  [1.0, 214, 170, 96],
];
const NB = 64, NS = 64;
function buildLut(S, hue) {
  const a = hue * TAU, c = cos(a), s = sin(a), k1 = (1 - c) / 3, k2 = sqrt(1 / 3) * s;
  const m = [c + k1, k1 - k2, k1 + k2, k1 + k2, c + k1, k1 - k2, k1 - k2, k1 + k2, c + k1];
  for (let ib = 0; ib < NB; ib++) {
    const b = ib / (NB - 1);
    let j = 0;
    while (j < STOPS.length - 2 && b > STOPS[j + 1][0]) j++;
    const A = STOPS[j], B = STOPS[j + 1], t = cl((b - A[0]) / (B[0] - A[0]), 0, 1);
    const r0 = A[1] + (B[1] - A[1]) * t, g0 = A[2] + (B[2] - A[2]) * t, b0 = A[3] + (B[3] - A[3]) * t;
    for (let is = 0; is < NS; is++) {
      const sh = (is / (NS - 1)) * 2 - 1;
      // the dark side goes toward warm brown and the lit side toward cool white
      const dk = sh < 0 ? -sh : 0, lt = sh > 0 ? sh : 0, spec = cl((sh - 0.55) / 0.45, 0, 1) * 0.4;
      let r = r0 * (1 - 0.38 * dk + 0.22 * lt), g = g0 * (1 - 0.46 * dk + 0.28 * lt), bl = b0 * (1 - 0.54 * dk + 0.36 * lt);
      r += (255 - r) * spec;
      g += (250 - g) * spec;
      bl += (236 - bl) * spec;
      const o = (ib * NS + is) * 3;
      S.lut[o] = cl(m[0] * r + m[1] * g + m[2] * bl, 0, 255);
      S.lut[o + 1] = cl(m[3] * r + m[4] * g + m[5] * bl, 0, 255);
      S.lut[o + 2] = cl(m[6] * r + m[7] * g + m[8] * bl, 0, 255);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.lutHue !== S.hue) (S.lutHue = S.hue), buildLut(S, S.hue);
  const { cz, cg, lut } = S, gq = 1 / S.qs, gs = S.gs;
  for (let y = 0; y < H; y++) {
    const o = (HM - y) * W; // the model's y runs up the panel
    for (let x = 0; x < W; x++) {
      const p = o + x, u = cz[p] * gq, au = abs(u), g = cg[p];
      const t = cl((au - 0.2) / 0.8, 0, 1), b = 0.5 + (u < 0 ? -0.5 : 0.5) * t * t * (3 - 2 * t), sh = g / (abs(g) + gs);
      const lo = ((((b * (NB - 1) + 0.5) | 0) * NS + (((sh + 1) * 0.5 * (NS - 1) + 0.5) | 0)) * 3);
      display.setPixel(x, y, lut[lo], lut[lo + 1], lut[lo + 2]);
    }
  }
}
