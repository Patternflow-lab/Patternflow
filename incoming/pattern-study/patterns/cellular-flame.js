// ===== Patternflow pattern =====
// Title:   Cellular Flame
// Family:  sim
// Idea:    The Kuramoto-Sivashinsky equation in two space dimensions runs on the panel's own 64 by 128 torus, and the front it makes is drawn as a surface lit from the upper left, so smooth ember-orange bowls are pulled, split and merged between thin gold creases that fold, slide and never settle into a pattern that repeats.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kuramoto-Sivashinsky equation, the height of a wrinkling flame front: Yoshiki Kuramoto (1976, phase turbulence) and Gregory Sivashinsky (1977, flame fronts), both from memory; solved with Fourier modes, the two-thirds rule of Orszag (1971, from memory) and the integrating-factor Runge-Kutta scheme of Lawson (1967, from memory)
// Round:   116
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..3, Scale=-1..1, Stretch=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the Oklab hue of every stop of the ramp, so one turn comes back. At 0 the surface runs from deep red-brown (64, 13, 9) through red-orange (148, 38, 5) and orange (232, 127, 37) to pale gold on the creases (254, 242, 197). At 0.25 it is olive through green to mint, at 0.5 teal (0, 52, 60) through azure (24, 171, 234) to ice white (238, 241, 254), at 0.75 violet through orchid to pink. A dark end that would leave the brightest channel under 60 is scaled up, so at every hue no LED is darker than that.
// Knob 2: Flow. The model time that passes in a panel second: 1.63 time units per unit of Flow at the opening, a little more or less as Stretch changes so that the pace holds. The creases, followed as the level lines of the laplacian of u, move 0.38 LED a second at Flow 0.5, 0.75 at 1, 1.5 at 2 and 2.3 at 3 (medians at the opening Scale and Stretch). Scale changes it, because an LED is fewer model units where the cells are big: at Flow 2 the creases move 1.3 LED a second at Scale -1 and 2.4 at Scale 1, and a cell is crossed in about the same time. The autocorrelation of u falls to one half after 4.2 time units, which is 2.6 s at Flow 1, 1.3 s at 2 and 0.9 s at 3, and to 0.19 after 8.
// Knob 3: Scale. How big the cells are, as the length dx of one LED in model units: 0.79 at -1, 0.69 at the opening 0, 0.42 at 1 (times 1.15 at Stretch -1 and 0.84 at Stretch 1). The box is then 51 by 101 model units at -1 and 27 by 53 at 1. The bowls of u, counted as minima of u over a 7 by 7 window, are 66 at -1 (11 LEDs apart, 6 across the panel), 51 at 0 (12.6 LEDs, 5 across) and 20 at 1 (20 LEDs apart, 3 across), each count averaged over 50 time units. At Scale 1 the Lyapunov exponent is still 0.20.
// Knob 4: Stretch. The weight a of the y-derivative in the growth term, L = kx^2 + a ky^2 - (kx^2 + ky^2)^2: 0.3 at -1, 1 at 0, 2 at 1. At -1 the creases line up into tall curtains (the rms of u_x is 1.5 times the rms of u_y), at 1 the bowls squash into rows (0.77 times). The count of bowls hardly moves, 43, 51 and 53 at the opening Scale. The Lyapunov exponent goes with a, 0.09, 0.21 and 0.45 per time unit, and the pace is divided by a to a power so that Flow keeps its meaning.

// What the field is. A height u(x, y, t), the front of a flame that wrinkles under its own heat, on a torus 64 LEDs wide
// and 128 tall:
//   u_t = -lap u - lap^2 u - (1/2) |grad u|^2.
// The first term makes long waves grow: a mode of wavenumber k grows at k^2 - k^4, which is positive below k = 1 and largest at
// k = 1/sqrt 2, a wavelength of 8.9 model units. The fourth derivative damps the short ones. The last term bends the front
// where it is steep, and that folds it: u becomes smooth bowls bounded by sharp ridges, the creases, which merge, split,
// migrate and stretch with no end. Nothing is added to the equation, no forcing, no noise, no drag. One model unit is dx LEDs
// (the Scale knob, below) and one model time unit is the Flow knob's business. The equation is as I remember it from
// Kuramoto and Sivashinsky; I did not look it up.
//
// The grid. One cell per LED. A mode (m, n) has kx = 2 pi m / 64 and ky = 2 pi n / 128 per LED, divided by dx for the model.
// The product |grad u|^2 is formed on the grid and every mode outside the disc m^2 + (n/2)^2 <= 21^2 is dropped after it
// (the two-thirds rule: two retained modes reach at most |m| = 42 and |n| = 84, which alias to |m| >= 22 or |n| >= 44).
// That leaves 2750 modes, each stored with its mirror as the complex conjugate. The k = 0 mode is dropped from the state. The
// mean of u is the one thing that drifts, at -(1/2) of the mean of |grad u|^2, about -2.7 per time unit, and nothing in the
// equation depends on it. Its value is never drawn.
// The time step is the integrating-factor form of fourth-order Runge-Kutta. The linear part, as stiff as -1130 per time
// unit at the highest mode of the corner Scale 1, Stretch 1, is taken exactly with exp(L h / 2). An explicit scheme would
// need h under 0.0025 there; the steps used are at most 0.3 (0.15 above a = 1), and one frame at Flow 2 is one step.
// u_x and u_y go through one complex transform and their squares through one real one, so one product costs two
// transforms of 64 by 128, a step eight, and a frame 3 ms in a Node loop and 3 to 6 ms in the study's own timing.
//
// Two things the textbook form needed. First, the symmetry. u is real, but rounding breaks the conjugate symmetry of the
// modes by 1e-16, and the part of u that is not real grows as fast as the real part does (e^(0.25 t) from 1e-16 is 1 at
// t = 150). Without the line in step() that puts the symmetry back, every run blew up between t = 153 and 158, for grids from
// dx 0.45 to 1.0 and steps from 0.05 to 0.4, which is how I found it. Second, the grid has to resolve the spectrum. At dx 1.15
// (Nyquist cut at k = 1.8) the truncated system blows up, so Scale is limited to dx 0.8, and at Stretch 2 the spectrum is wider
// (u rms 6.6 against 4.2), so dx is divided by a^0.25 above a = 1 (at a = 2 with dx 0.9 and no division the run blew up at t = 6.8).
//
// Checks, each run on this file (Node, the study's seeded Math.random).
// 1. Linear growth. One mode at amplitude 1e-7 for 20 time units, against k^2 + a(ky^2) - k^4: 0.24993 measured and 0.24993
//    in theory for k = 0.701 along x and along a diagonal, 0.21567 for k = 0.561 along y, 0.02220 at a = 0.3 (k = 0.364 along y),
//    0.22861 at a = 2 (k = 0.527), 0.02398 for k = 0.157. They agree to the five places printed: the exponential is exact, so
//    this tests the wavenumbers and the anisotropy and nothing else.
// 2. The energy transfer. For a developed field, the sum over modes of Re(conj(u_k) N_k) from the spectral product is -0.7504653,
//    and -1/2 times the grid mean of u |grad u|^2 is -0.7504653, a difference of 2.2e-15. The two-thirds rule makes the product
//    exact on the retained modes, and this is the test that it does.
// 3. Convergence. Against a run at h = T/192, the relative L2 error of the modes at T = 0.6 for h = 0.2, 0.1, 0.05, 0.025 was
//    1.5e-3, 2.3e-4, 2.5e-5, 2.1e-6, and at T = 1.2 for h = 0.4, 0.2, 0.1, 0.05 it was 1.1e-2, 2.1e-3, 3.2e-4, 3.5e-5. The ratios per
//    halving climb 6.5, 9.1, 11.7 and 5.2, 6.7, 9.0 towards the 16 of fourth order without reaching it at these steps.
//    Over 3 time units in the chaotic state the error is 1.9e-2 at h = 0.3 and 3.3e-4 at 0.075 at the opening (Lyapunov
//    amplification included), and 1.5e-1 at h = 0.15 at Stretch 1, where the step is cut by a and the field is quicker.
// 4. The statistics against the step, 400 time units each: rms of grad u 2.30, 2.33, 2.34 at h = 0.3, 0.15, 0.075 at the opening;
//    the share of the energy at k = 1 is 0.058, 0.057, 0.060. At Stretch 1 with h = 0.3 the rms of grad u was 4.11 against
//    4.51, which is why the step is cut by a there; with h = 0.15 it is 4.44. The picture needs the statistics, not the trajectory.
// 5. The cell size. The mean distance between bowls at Scale 0 is 12.6 LEDs, which is 8.7 model units against the 8.9 of the
//    fastest-growing wavelength, 98 percent of it.
// 6. Chaos. The largest Lyapunov exponent, by two runs 1e-7 apart in relative distance and renormalised every 2 time
//    units over 400: 0.21 per time unit at the opening, 0.21 at Scale -1, 0.20 at Scale 1, 0.09 at Stretch -1, 0.45 at
//    Stretch 1. A perturbation doubles in 3.3 time units at the opening. The autocorrelation of u, over 300 time units at
//    the opening, is 0.82 at lag 2, 0.39 at 5, 0.19 at 8, 0.06 at 20 and under 0.07 at every lag from 30 to 120.
// 7. Bounded. 6000 time units at the opening: rms of u 4.2 on average and 6.3 at most, rms of grad u 2.32 (2.15 at least),
//    largest |grad u| anywhere 6.1, largest |laplacian u| 8.0. 3000 units at each of the corners Scale and Stretch at -1 and 1
//    kept the rms of u under 10.1 and the largest |grad u| under 11.
// 8. Resolution. Shell sums of |u_k|^2 over the peak shell, at dx 0.8 (Scale -1): 2.6e-4 at k = 2.0 and 1.2e-4 in the last shell,
//    k = 2.1; the same shell at dx 0.4 (cut at k = 5.2) is 2.7e-4 at k = 2.0 and falls as e^-3k beyond, so the cut at dx 0.8 does not
//    reshape the spectrum where it counts.
// 9. The knobs, 600 s of panel time with all four jumping every 2.5 s to a random value or to an end: no restart of the
//    safety net, no blow-up, the picture's gradient scale between 1.3 and 4.6. Scale 0 to 1 turns 53 bowls into 23 in 2 s
//    and to 20 after 4 s; Scale 0 to -1 turns 54 into 72 in 2 s.
// The flowcheck of this study, 240 s at the six positions and 900 s at the opening, at Flow 0.5 with Scale and Stretch at -1 and
// at the maximum, passed every line, recur between 0.72 and 0.80 (see the notes).
//
// Not checked. Global bounds: I know no proof that the potential form of the equation stays bounded in two dimensions, and
// what is shown is what was run. A comparison with ETDRK4, with a finer grid than dx 0.4 at Scale 1, and a count of merges
// and splits per second. The numbers in the knob lines are from the opening seed.
//
// What the picture adds. All of it is the picture's choice, none of it is in the equation. The normal is (-u_x, -u_y, 1) with u_x
// and u_y over their running rms (followed with a time constant of 4 model units), the light is a unit vector from 215 degrees
// in the panel plane at an elevation with z = 0.58, and n.l goes through a straight line to a value centred on 0.5, mean and
// standard deviation measured over the fields (0.436, 0.38). The crease glow is a smoothstep of -lap u over its running rms
// from 0.3 to 1.8. The value on the ramp is 0.7 times the lit value plus 0.7 times the glow, clipped to 1: dark red where a bowl
// faces away from the light, orange where it faces it, gold where u folds over a ridge. The ramp is five stops of
// lightness, chroma and hue in Oklab, hand-built, with no step of the HSV wheel in it.

const W = 64, H = 128, N = W * H;
const { floor, ceil, max, min, abs, sqrt, exp, pow, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the tunables ---------------------------------------------------------------------------
// dx is the model length of one LED and a the weight of the y-derivative in the growth term. Both
// follow the knobs; everything else on this list is fixed.
const CFG = {
  dx0: 0.7, // dx at Scale 0
  dxBig: 0.42, // dx at Scale 1, where the cells are biggest
  dxSmall: 0.8, // dx at Scale -1, the smallest cells; at dx 1.15 the two-thirds cut-off is too coarse and the run blows up
  dxa: 0.25, // dx is divided by a to this power for a above 1: the spectrum is wider there and needs the finer grid
  aLo: 0.3, // a at Stretch -1, cells stretched up and down
  aHi: 2, // a at Stretch 1, cells squashed into rows
  c0: 1.7, // model time units per panel second per unit of Flow, at a = 1
  hmax: 0.3, // longest step in model time; divided by a above 1
  pre: 40, // model time run before the first frame
  follow: 0.35, // seconds dx and a take to follow the knobs
  norm: 4, // model time over which the picture's scale follows the field's rms
  // the picture
  light: 215, // degrees, y down: the light comes from the upper left
  elev: 0.58, // height of the light over the surface, as the z of its unit vector
  ks: 1, // grad u over its rms goes into the surface normal at this strength
  lm: 0.436, // mean of n.l at ks 1, measured on fields at five knob positions (0.434 to 0.440)
  sd: 0.38, // and its standard deviation (0.361 to 0.389)
  lw: 0.3, // the lit value is 0.5 + lw (n.l - lm) / sd
  wl: 0.7, // weight of the lit value on the ramp
  wc: 0.7, // weight of the crease glow
  c0lap: 0.3, // the crease glow starts where -lap u is this many rms of lap u
  c1lap: 1.8, // and is complete here
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

// In place, forward (e^-i), on re[o .. o+n) and im[o .. o+n). With the two arrays swapped it is the
// unnormalised inverse.
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

// Mode (m, n) has kx = 2 pi m / 64 and ky = 2 pi n / 128 per LED, so m^2 + (n/2)^2 measures both axes in one unit.
// Modes outside the disc m^2 + (n/2)^2 <= KC^2 are dropped after every product, the two-thirds rule: two retained
// modes make at most |m| = 42 and |n| = 84, which alias to |m| >= 22 or |n| >= 44, outside the disc.
const KC = 21;
const COL = [], CR = new Float64Array(H), CI = new Float64Array(H);
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

const ZR = new Float64Array(W), ZI = new Float64Array(W);
// A real field in re (im is overwritten) to its modes, unnormalised. Two rows go through one complex transform.
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
// Only the retained modes are stored, the k = 0 mode not among them. IDX is a mode's slot in the full array, PAR the slot
// of its mirror (-m, -n), whose coefficient is the complex conjugate because u is real. KXG and KYG are the wavenumbers
// in radians per LED; dividing by dx gives them in model units.
const IDX = [], KXG = [], KYG = [], PAR = [];
{
  const at = new Map(), K0 = TAU / W;
  for (let i = 0; i < H; i++)
    for (let j = 0; j < W; j++) {
      const n = i < 64 ? i : i - H, m = j < 32 ? j : j - W, k2 = m * m + (n * n) / 4;
      if (k2 > KC * KC || (m === 0 && n === 0)) continue;
      at.set(i * W + j, IDX.length);
      IDX.push(i * W + j);
      KXG.push(K0 * m);
      KYG.push((K0 * n) / 2);
    }
  for (let q = 0; q < IDX.length; q++) {
    const i = floor(IDX[q] / W), j = IDX[q] % W;
    PAR.push(at.get(((H - i) % H) * W + ((W - j) % W)));
  }
}
const M = IDX.length;

const OPEN = [0, 2, 0, 0.06];
// Scale and Stretch to dx and a. Piecewise in the log so that Scale 0 and Stretch 0 are the opening values.
const dxOf = (s, an) => (s >= 0 ? CFG.dx0 * pow(CFG.dxBig / CFG.dx0, cl(s, 0, 1)) : CFG.dx0 * pow(CFG.dxSmall / CFG.dx0, -cl(s, -1, 0))) * pow(an, an < 1 ? -0.12 : -CFG.dxa);
const aOf = (s) => (s >= 0 ? pow(CFG.aHi, cl(s, 0, 1)) : pow(CFG.aLo, -cl(s, -1, 0)));

// First frame: a random-phase field in a band of wavenumbers around the fastest-growing k = 0.7, rms about 2, run for
// CFG.pre model time (40; 100 steps of 0.4) so that the creases stand when the picture starts.
function start(params, k) {
  const vec = () => new Float64Array(M), full = () => new Float64Array(N);
  const S = {
    tr: vec(), ti: vec(),
    ar: full(), ai: full(), pr: full(), pi: full(),
    k1r: vec(), k1i: vec(), k2r: vec(), k2i: vec(), k3r: vec(), k3i: vec(), k4r: vec(), k4i: vec(),
    vr: vec(), vi: vec(), wr: vec(), wi: vec(),
    L: vec(), GX: vec(), GY: vec(), E2: vec(),
    dx: -1, an: -1, t: 0, gn: 0, ln: 0,
    U: full(), LAP: full(), UX: full(), UY: full(),
    hue: 0, lutHue: -1, lut: new Uint8Array(256 * 3),
  };
  params.s = S;
  prepare(S, dxOf(k[2], aOf(k[3])), aOf(k[3]));
  for (let q = 0; q < M; q++) {
    if (PAR[q] < q) {
      S.tr[q] = S.tr[PAR[q]];
      S.ti[q] = -S.ti[PAR[q]];
      continue;
    }
    const kk = sqrt(KXG[q] * KXG[q] + KYG[q] * KYG[q]) / S.dx, r = (kk - 0.7) / 0.3, a = 0.12 * exp(-0.5 * r * r), ph = TAU * Math.random();
    S.tr[q] = a * cos(ph);
    S.ti[q] = a * sin(ph);
  }
  advance(S, CFG.pre / max(1, S.an), 0.4 / max(1, S.an));
}

// What depends on dx and a: the growth rate L(k) = kx^2 + a ky^2 - (kx^2 + ky^2)^2 of each mode, in model units, and
// the gradient factors i kx, i ky.
function prepare(S, dx, an) {
  if (dx === S.dx && an === S.an) return;
  S.dx = dx;
  S.an = an;
  const s = 1 / (dx * dx);
  for (let q = 0; q < M; q++) {
    const x2 = KXG[q] * KXG[q], y2 = KYG[q] * KYG[q];
    S.L[q] = s * (x2 + an * y2) - s * s * (x2 + y2) * (x2 + y2);
    S.GX[q] = KXG[q] / dx;
    S.GY[q] = KYG[q] / dx;
  }
}

// out = -1/2 |grad u|^2 at the retained modes. u_x and u_y are real, so they come out of one complex transform as the
// real and imaginary part of i kx u_hat - ky u_hat. Their squares go back through one real transform.
function nonlin(S, tr, ti, outR, outI) {
  const { ar, ai, pr, pi, GX, GY } = S;
  ar.fill(0);
  ai.fill(0);
  for (let q = 0; q < M; q++) {
    const a = tr[q], b = ti[q], o = IDX[q], x = GX[q], y = GY[q];
    ar[o] = -x * b - y * a;
    ai[o] = x * a - y * b;
  }
  ifft2(ar, ai);
  for (let p = 0; p < N; p++) pr[p] = ar[p] * ar[p] + ai[p] * ai[p];
  fft2real(pr, pi);
  const sc = -0.5 / N;
  for (let q = 0; q < M; q++) {
    outR[q] = pr[IDX[q]] * sc;
    outI[q] = pi[IDX[q]] * sc;
  }
}

// One step of h model time: the integrating-factor form of the classical fourth-order Runge-Kutta scheme (Lawson, 1967,
// from memory). The linear part, as stiff as -550 per time unit at the highest mode of Scale 1, is taken exactly through
// exp(L h / 2); only the product term is stepped. The exponentials are rebuilt every step because the knobs move L.
function step(S, h) {
  const { tr, ti, k1r, k1i, k2r, k2i, k3r, k3i, k4r, k4i, vr, vi, wr, wi, L, E2 } = S;
  for (let q = 0; q < M; q++) E2[q] = exp(0.5 * L[q] * h);
  nonlin(S, tr, ti, k1r, k1i);
  for (let q = 0; q < M; q++) {
    vr[q] = E2[q] * (tr[q] + 0.5 * h * k1r[q]);
    vi[q] = E2[q] * (ti[q] + 0.5 * h * k1i[q]);
  }
  nonlin(S, vr, vi, k2r, k2i);
  for (let q = 0; q < M; q++) {
    wr[q] = E2[q] * tr[q] + 0.5 * h * k2r[q];
    wi[q] = E2[q] * ti[q] + 0.5 * h * k2i[q];
  }
  nonlin(S, wr, wi, k3r, k3i);
  for (let q = 0; q < M; q++) {
    const e = E2[q] * E2[q];
    vr[q] = e * tr[q] + h * E2[q] * k3r[q];
    vi[q] = e * ti[q] + h * E2[q] * k3i[q];
  }
  nonlin(S, vr, vi, k4r, k4i);
  for (let q = 0; q < M; q++) {
    const e2 = E2[q], e = e2 * e2, g = h / 6;
    tr[q] = e * tr[q] + g * (e * k1r[q] + 2 * e2 * (k2r[q] + k3r[q]) + k4r[q]);
    ti[q] = e * ti[q] + g * (e * k1i[q] + 2 * e2 * (k2i[q] + k3i[q]) + k4i[q]);
  }
  // u is real, so mode (-m, -n) is the conjugate of (m, n). Rounding breaks that by 1e-16, and the
  // part of u that is not real grows like the real part does, so it is put back every step.
  for (let q = 0; q < M; q++) {
    const p = PAR[q];
    if (p > q) {
      tr[q] = tr[p] = 0.5 * (tr[q] + tr[p]);
      ti[q] = 0.5 * (ti[q] - ti[p]);
      ti[p] = -ti[q];
    }
  }
  S.t += h;
}

// Model time Ht in equal steps no longer than hmax.
function advance(S, Ht, hmax) {
  const n = max(1, ceil(Ht / hmax - 1e-9));
  for (let i = 0; i < n; i++) step(S, Ht / n);
}

// ---- the frame ------------------------------------------------------------------------------
// dx and a follow the knobs with a time constant of CFG.follow seconds. The model time per panel second is Flow times
// CFG.c0 times a factor of a, a^-0.45 below 1 and a^-0.97 above, that keeps the pace as the cells change shape. At the
// opening Scale the crease speed per model time unit is 0.26 at a = 0.3, 0.46 at a = 1 and 1.01 at a = 2; with the factor
// the three are 0.44, 0.44 and 0.52 per unit of c0 times Flow, within 17 percent.
export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.5, 3);
  const f = 1 - exp(-ft / CFG.follow);
  const at = aOf(k[3]);
  prepare(S, S.dx + (dxOf(k[2], at) - S.dx) * f, S.an + (at - S.an) * f);
  S.hue = k[0];
  const Ht = ft * flow * CFG.c0 * (S.an < 1 ? pow(S.an, -0.45) : pow(S.an, -0.97));
  advance(S, Ht, CFG.hmax / max(1, S.an));
  // Never reached in the runs below. If a mode ever went bad the field would stay dark, so start the box over.
  const chk = S.tr[0] + S.ti[1] + S.tr[M >> 1] + S.ti[M >> 2];
  if (!isFinite(chk) || abs(chk) > 1e3) {
    start(params, k);
    return update(0, input, params);
  }
  render(S, Ht);
}

// u and its laplacian go out through one transform, grad u through another.
function render(S, Ht) {
  const { ar, ai, tr, ti, GX, GY, U, LAP, UX, UY } = S;
  const s = 1 / (S.dx * S.dx);
  ar.fill(0);
  ai.fill(0);
  S.pr.fill(0);
  S.pi.fill(0);
  const br = S.pr, bi = S.pi;
  for (let q = 0; q < M; q++) {
    const a = tr[q], b = ti[q], o = IDX[q], k2 = s * (KXG[q] * KXG[q] + KYG[q] * KYG[q]);
    ar[o] = a + k2 * b;
    ai[o] = b - k2 * a;
    br[o] = -GX[q] * b - GY[q] * a;
    bi[o] = GX[q] * a - GY[q] * b;
  }
  ifft2(ar, ai);
  ifft2(br, bi);
  let sg = 0, sl = 0;
  for (let p = 0; p < N; p++) {
    U[p] = ar[p];
    LAP[p] = ai[p];
    UX[p] = br[p];
    UY[p] = bi[p];
    sg += br[p] * br[p] + bi[p] * bi[p];
    sl += ai[p] * ai[p];
  }
  sg = sqrt(sg / N);
  sl = sqrt(sl / N);
  if (S.gn === 0) {
    S.gn = sg;
    S.ln = sl;
  } else {
    const f = 1 - exp(-(Ht || 0) / CFG.norm);
    S.gn += (sg - S.gn) * f;
    S.ln += (sl - S.ln) * f;
  }
}

// ---- colour ---------------------------------------------------------------------------------
// A ramp of Oklab stops (position, lightness, chroma, hue in degrees), built by hand. The hue knob adds its value times 360
// degrees to every hue. A stop that falls outside the sRGB cube loses chroma until it is inside.
const EMBER = [
  [0, 0.25, 0.08, 28],
  [0.3, 0.44, 0.15, 35],
  [0.62, 0.7, 0.16, 55],
  [0.85, 0.86, 0.13, 80],
  [1, 0.96, 0.06, 95],
];
const STOPS = EMBER;

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
const RGB = [0, 0, 0], FLOOR = 60;
const LX = cos((CFG.light * PI) / 180) * sqrt(1 - CFG.elev * CFG.elev), LY = sin((CFG.light * PI) / 180) * sqrt(1 - CFG.elev * CFG.elev);

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { LAP, UX, UY, lut } = S, hue = cl(S.hue, 0, 1);
  if (S.lutHue !== hue) {
    S.lutHue = hue;
    for (let i = 0; i < 256; i++) {
      const x = i / 255;
      let j = 1;
      while (j < STOPS.length - 1 && x > STOPS[j][0]) j++;
      const a = STOPS[j - 1], b = STOPS[j], t = cl((x - a[0]) / (b[0] - a[0]), 0, 1);
      okRgb(a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t + hue * 360, RGB);
      // A dark green or teal has a dim brightest channel at the same lightness as a dark red, so no entry
      // may have a brightest channel under FLOOR: a dark end that would fall below it is scaled up.
      const cr = enc(RGB[0]), cg = enc(RGB[1]), cb = enc(RGB[2]), top = max(cr, cg, cb), up = top < FLOOR && top > 0 ? FLOOR / top : 1;
      lut[i * 3] = min(255, (cr * up + 0.5) | 0);
      lut[i * 3 + 1] = min(255, (cg * up + 0.5) | 0);
      lut[i * 3 + 2] = min(255, (cb * up + 0.5) | 0);
    }
  }
  const gi = CFG.ks / S.gn, li = 1 / S.ln, kl = CFG.lw / CFG.sd;
  for (let p = 0; p < N; p++) {
    const sx = UX[p] * gi, sy = UY[p] * gi;
    const ndl = (-sx * LX - sy * LY + CFG.elev) / sqrt(1 + sx * sx + sy * sy);
    const lit = cl(0.5 + kl * (ndl - CFG.lm), 0, 1);
    const cr = sm(CFG.c0lap, CFG.c1lap, -LAP[p] * li);
    const i = ((cl(CFG.wl * lit + CFG.wc * cr, 0, 1) * 255) | 0) * 3;
    display.setPixel(p & 63, p >> 6, lut[i], lut[i + 1], lut[i + 2]);
  }
}
