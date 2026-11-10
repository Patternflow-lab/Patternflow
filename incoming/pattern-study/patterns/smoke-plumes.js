// ===== Patternflow pattern =====
// Title:   Smoke Plumes
// Family:  sim
// Idea:    Hot smoke pours out of vents along the floor of the panel, glows gold and cools to grey as it climbs, rolls into curls that crowd and fold into one another under a light from the upper left, and bleeds away through the top
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Smoke as an incompressible flow that carries a density and a temperature, with a buoyancy force that goes with the temperature and a vorticity confinement force (Ronald Fedkiw, Jos Stam and Henrik Wann Jensen, Visual Simulation of Smoke, 2001; the confinement is John Steinhoff and David Underhill's, 1994); the Boussinesq approximation (Joseph Boussinesq, 1903); the planar plume, which rises as the one third power of its buoyancy flux (Hunter Rouse, C. S. Yih and H. W. Humphreys, 1952); pseudo-spectral vorticity with Shu and Osher's third order scheme (1988) as in Shear Billows; stream function on the corners of the cells (Francis Harlow and J. Eddie Welch, 1965); flux form scalars with the monotonised central limiter (Bram van Leer, 1977)
// Round:   125
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..3, Scale=-1..1, Heat=-1..1
//
// Knob 1: Hue. Turns every colour of the sky and the smoke round the grey axis by the knob times 360 degrees. At 0 the sky runs from dusk violet at the top to rust at the floor, young smoke is gold, old smoke a grey with some lilac in it, and apricot and rose lie between.
// Knob 2: Flow. Model seconds per panel second are 0.8 times the knob, 1.6 at the opening 2. The draft lifts the air 4.0 LEDs a second at 2 (1.0 at 0.5, 6.0 at 3), the hot cores of the plumes rise at 5.6 (1.3, 8.7), and the eddies move at 1.4 LEDs a second rms across and 2.4 along.
// Knob 3: Scale. A vent is a Gaussian of sigma 2.4 LEDs times 1.5 to the knob (1.6, 2.4, 3.6) and the confinement is 0.07 times 2.2 to the minus the knob (0.154, 0.07, 0.032). The curls, as 2 pi over the mean wavenumber of the vorticity, are 8.1, 9.3 and 10.5 LEDs across at -1, 0 and 1, and the smoke in rows 40 to 80 averages 0.30, 0.39 and 0.45.
// Knob 4: Heat. The buoyancy beta = 2.2 times 1.7 to the knob (1.29 at -1, 3.74 at 1) and the number of vents, floor(5 + 1.7 times the knob) from 3 to 6: 3 below -0.59, 4 up to 0, 5 up to 0.59 (the opening 0.06 has 5, 12.8 LEDs apart), 6 above. At -1 three slim plumes stand with sky between them (smoke over 0.1 in 76 per cent of rows 40 to 80); at 1 six merge into one bank (100 per cent). The eddies' rms speed across and along, in LEDs per model second: 0.56 and 1.01 at -1, 0.88 and 1.48 at the opening, 1.29 and 2.25 at 1.

// What the field is. A torus of 64 by 128 cells, one to an LED, row 0 at the top, so up is -y. Three fields live on it: the vorticity w (u = (psi_y, -psi_x), w = -lap psi), a temperature T above the air and a smoke density s. In model seconds:
//   w_t + (u + U).grad w = -beta T_x - j G_x h(y) - eps m(s) div(w N) - mu(y) w - (nu k^2 + nu4 k^4 + a) w
//   T_t + (u + U).grad T = kappa lap T + 1.5 G h (1 - T) - (0.1 + 2 sig(y)) T
//   s_t + (u + U).grad s = kappa lap s + 1.5 G h (0.5 - s) - sig(y) s
// -beta T_x is the curl of the buoyancy force (0, -beta T), the lifting part of Fedkiw's f = beta T - alpha s. N = grad|w| / |grad|w||, so -eps div(w N) is the curl of their confinement force eps N x w; m is a smoothstep of s from 0.04 to 0.3, so it acts in smoke only, and it is off in the sponge.
// nu 0.05, nu4 0.003, kappa 0.03, and a = 0.12 on every mode that varies along x, a drag on the big eddies so that the flow does not gather into one roll the size of the panel. G(x) = 1 - exp(-sum a_i exp(-d_i^2 / 2 sigma^2)) is the vents (d_i the distance round the torus to vent i),
// h(y) a smoothstep over rows 114 to 122, and j = 0.5 pushes up. sig(y) and mu(y) are the sponge, 1.2 and 1.0 times (1 - y / 20)^2 in rows 0 to 20: smoke, heat and vorticity bleed away there, and what is left wraps round to the floor.
// A vent's place is its even share of the width plus an Ornstein-Uhlenbeck deviation (rms 0.3 of the spacing, correlation 35 model s), its strength a = 1 + 0.4 z with z another such process (correlation 20 s) held between 0.35 and 1.6; when Heat changes the count, a vent fades in or out in 2 s and the shares glide in 3 s.
// U = (wind g(y), -2.5). The wind is an Ornstein-Uhlenbeck process (rms 1.0 LED per model s, correlation 40 s) times g(y) = 0.4 + 0.3 (1 - cos(2 pi (y - 122) / 128)); its mean goes into U and the rest into the kx = 0 modes of w, pulled to it at 0.3 a second. The 2.5 up is a steady draft through the whole panel, mine and not Fedkiw's:
// a stream function carries no net flow through a row, so on a torus the volume a plume takes in must come back down beside it, and without the draft the panel was a boiling cloud (below). With it the air is replaced from the floor, as in a chimney. Nothing in the drive repeats: no sine of the clock, no remainder of it by a period.
// The scheme. w is pseudo-spectral: the product (u + U).grad w by three transforms a stage (pairs packed in one), the cut exp(-36 (k / 1.8)^16), and the third order scheme at the step a frame calls for, never over 0.1 and short enough that the fastest face speed times 1.8 rad per LED times the step is under 1.5 (the scheme holds to 1.73).
// Past 18 steps of kx the cut leaves nothing, so the column transforms skip those 27 columns. Once a step the stream function, shifted half a cell in x and y, goes through one transform with w (two real fields packed), and the velocity on a face is the difference of two corner values, so its divergence is zero to rounding.
// T and s go with the face velocities in x, y, x sweeps of the flux form second order upwind scheme, in as many substeps as keep a crossing under 0.8 cell; then sources, sinks and diffusion, and a clamp to 0 and 1.2. Last the force on w, once: central differences of T, G and |w|, the sponge drag on the cells, one transform, the cut, held for the three stages. 24 model seconds run before the first frame.
// The picture. Smoke over a sky of three stops at opacity 1 - exp(-3 s). Its colour is its temperature on a log scale, ln(1 + T / 0.004) / ln 251, on a six-stop ramp from grey-lilac at 0 through rose and apricot to gold at 1. The light is up and to the left: the optical depth tau to it is a running sum along (-1, -2), (-1, -1) and (0, -1)
// with 0.8 kept a step, the shade is 0.5 + 0.55 exp(-2.4 tau), the gradient of s over two cells against the light adds a rim from -0.25 to 0.45, and in the smoke the vorticity adds 0.12 tanh(w / its rms), so the cores of the curls show.
//
// What was checked, with the file's own step (scripts of mine, not in the repo):
// - Divergence of the face velocities, every second for 20 s at the open, all-minimum and all-maximum knobs: 1.3e-15, 0.9e-15 and 1.8e-15, with the fastest face at 6.6, 4.4 and 8.7 LEDs per model second.
// - Buoyancy against energy. A hot Gaussian (sigma 4 LEDs, T 0.8) at rest with only the buoyancy on (beta 2, steps of 0.02): the energy the flow gains over the work beta times the integral of T v_up is 0.9959 at 0.5, 1, 1.5 and 2 s. The blob rises (its centroid from row 64 to 63.26 in 2 s)
//   at 0.375 LEDs per model s after 1 s; free space gives beta / 2 times the integral of T^2 over that of T, 0.40, and the 6 per cent is the central difference of T_x.
// - One vent, buoyancy only (no wind, drag, push or confinement; the draft on), beta 0.15, 0.3, 0.6 and 1.2, 130 model s, the last 80 averaged. w is the speed of the T-weighted fluid against the draft, F is beta times the integral of T w over a row, at rows 40 to 90: the slope of ln w against ln F is 0.385 over the 24 points (the planar plume: one third)
//   and w / F^(1/3) is 2.06, sd 0.43 (the books give about 1.7 on the centre line, from memory; a T-weighted mean is another average, so the exponent is the check and not the factor). It does not hold on up: at beta 2.4 and 4.8 w stops growing (4.7 to 6.9 and 3.2 to 7.3, against 5.0 to 5.9 at 1.2) and the slope over all six betas is 0.295.
//   I have not found why. A vent only gives T at 1.5 a second, and a plume meanders in a box 64 wide.
// - Confinement against the size of the curls, Scale 0, 90 s at Flow 2 (144 model s, the second half averaged), the mean wavenumber of the vorticity spectrum (kx not 0): eps 0, 0.04, 0.07, 0.16 and 0.32 give curls of 9.9, 9.5, 9.2, 8.2 and 6.1 LEDs, and the rms vorticity in smoke is 0.49, 0.51, 0.53, 0.59 and 1.23 per s. Past 0.2 it gathers the vorticity into a lattice of small vortices.
// - Smoke budget, 900 s of the open set through update(): the vents put in 89,331 units and the top took out 87,721. The difference is the box filling (1,459 at the first frame, 2,572 at 300 s, 3,069 at 900 s), and mass in minus mass out closes to 3e-8. From 300 s on out over in is 0.992. In windows of 100 s the mean s is
//   0.31, 0.35, 0.34, 0.33, 0.36, 0.36, 0.36, 0.34 and 0.35, the smoke's centroid sits at row 63.6 to 65.1 and the mean T is 0.158 to 0.174. The clamp never acted.
// - flowcheck, 240 s, six sets (open; all minimum; all maximum; three random): recur 0.59 to 0.65, dim 0.74 to 0.94, quiet 0.53 to 0.75, last quarter dim 0.77 to 0.94 and quiet 0.40 to 0.60, luma 0.5 to 3.3 per cent apart first and last quarter.
//   900 s (recur, dim, quiet): open 0.599, 0.913, 0.710; all minimum 0.602, 0.774, 0.665; all maximum 0.568, 0.945, 0.617. Measured on this file under its name, which seeds the vents, the wind and the drive.
// - Cost: 5.5 to 8.0 ms a frame in Node (update and draw) with other work on the machine, the start about 1.5 s.
//
// What failed first. 1. The first build had no draft, drag 0.1 and confinement 0.5: rms speed 10 LEDs per model s at every height and the smoke stuck in the lower half (mean s 0.7 at the floor, 0.03 at row 40). The draft carried the smoke to the top and left the speed at 10; drag 0.12, beta 2.2 and
// confinement 0.07 brought it to 1.7. 2. Confinement at 0.5 froze the vorticity into a lattice of equal vortices a curl wide all over the panel; 0.07, in smoke only, leaves plumes. 3. The wind profile first had a step at the wrap, which rang in the rows beside it. Made periodic, at 1.5 rms it still drew the smoke out into flat sheets,
// and after a minute the panel was one haze. At 1.0 rms, with a profile that is never zero, the structure lasts the 900 s. 4. Smoke density settles near 0.7, so brightness from s alone was flat grey, and embossing it with one cell differences gave wrinkled foil; the colour follows T on a log scale now, which keeps the structure to the top, the rim looks two cells out, and the vorticity shade brings out the curls that a smooth density hides.
// 5. With the sponge at 0.35 a pink band of smoke and heat gathered along the top rows; at 1.2 it is taken out. 6. The first build cost 15 ms a frame at the maximum knobs (two substeps of the scalars, every column transformed); the time scale 0.8, the looser crossing limit and the skipped columns brought it to 6 to 8.
// What was not checked: a grid finer than 64 by 128 (a plume's edge is a cell or two wide); three dimensions, where a plume does not meander in a plane; the constant of the plume against the books; the Boussinesq limit (T is a number up to 1, not a temperature ratio); how the confinement coefficient compares with Fedkiw's, whose units are of the grid.
// The draft, the sponge, the drag a and the way the vents wander are the picture's own.

const W = 64, H = 128, N = W * H, WM = W - 1, HM = H - 1;
const { floor, ceil, abs, sqrt, exp, log, cos, sin, tanh, PI, min, max, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];
const MAXV = 6;

const CFG = {
  dt: 0.1, // the longest step, model seconds
  tscale: 0.8, // model seconds per panel second at Flow 1
  nu: 0.05, // viscosity, LED^2 per model second
  hyp: 0.003, // fourth order
  fric: 0.12, // drag on every mode with kx not 0
  beta: 2.2, // buoyancy: LEDs per model second squared per unit of T
  tv: 1.0, // temperature of a vent
  sv: 0.5, // smoke density of a vent
  cool: 0.1, // T cools at this rate
  kappa: 0.03, // diffusion of T and smoke
  rv: 1.5, // vent relaxation rate
  jet: 0.5, // upward push of a vent
  conf: 0.07, // vorticity confinement at Scale 0
  draft: 2.5, // the draft up the whole panel, LEDs per model second
  sp: 20, // rows of sponge at the top
  muTop: 1.0, // vorticity drag at the top row
  sTop: 1.2, // smoke removal rate at the top row
  wind: 1.0, // rms of the wind, LEDs per model second
  windT: 40,
  relU: 0.3,
  pre: 24,
  cfl: 0.8,
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
// The columns that can hold anything: the cut leaves nothing above |kx| of 18 steps (1.77 rad per LED), so the transforms down the
// columns skip the 27 columns in between. Anything the forward transform leaves there is multiplied by the cut, which is 1e-27 by then.
const XA = 19, XR0 = [0, W - XA + 1], XR1 = [XA, W];
function fftCols(re, im, inv) {
  const { n, rev, c, s } = PH, sg = inv ? -1 : 1;
  for (let r = 0; r < 2; r++) {
    const x0 = XR0[r], x1 = XR1[r];
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        const a = i * W, b = j * W;
        for (let x = x0; x < x1; x++) {
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
          for (let x = x0; x < x1; x++) {
            const xr = re[b + x] * wr - im[b + x] * wi, xi = re[b + x] * wi + im[b + x] * wr;
            re[b + x] = re[a + x] - xr;
            im[b + x] = im[a + x] - xi;
            re[a + x] += xr;
            im[a + x] += xi;
          }
        }
    }
  }
}
function fft2(re, im, inv) {
  if (inv) {
    fftCols(re, im, true);
    fftRows(re, im, true);
  } else {
    fftRows(re, im, false);
    fftCols(re, im, false);
  }
}

const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());

// ---- wavenumbers of the torus ----
const KX = new Float64Array(N), KY = new Float64Array(N), K2 = new Float64Array(N), FIL = new Float64Array(N);
const CSH = new Float64Array(N), SSH = new Float64Array(N); // the half-cell shift to the corners of the cells
for (let j = 0; j < H; j++)
  for (let i = 0; i < W; i++) {
    const p = j * W + i, nx = i < W / 2 ? i : i - W, ny = j < H / 2 ? j : j - H;
    KX[p] = (TAU * nx) / W;
    KY[p] = (TAU * ny) / H;
    K2[p] = KX[p] * KX[p] + KY[p] * KY[p];
    FIL[p] = exp(-36 * pow(sqrt(K2[p]) / 1.8, 16)); // the cut: 1.8 rad per LED, 0.6 of the Nyquist
    const nyq = i === W / 2 || j === H / 2;
    CSH[p] = nyq ? 0 : cos(0.5 * (KX[p] + KY[p]));
    SSH[p] = nyq ? 0 : sin(0.5 * (KX[p] + KY[p]));
  }

// ---- the layout of the box: sponge at the top, vents at the floor, the wind profile ----
const smooth = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const SPONGE = new Float64Array(H), VENTY = new Float64Array(H), WINDG = new Float64Array(H);
let GBAR = 0;
for (let y = 0; y < H; y++) {
  const t = cl((CFG.sp - y) / CFG.sp, 0, 1);
  SPONGE[y] = t * t;
  VENTY[y] = smooth(H - 14, H - 6, y + 0.5);
  WINDG[y] = 0.4 + 0.3 * (1 - cos((TAU * (y + 0.5 - (H - 6))) / H));
  GBAR += WINDG[y] / H;
}
// the spectrum of the wind's vorticity for a profile of unit amplitude, on the kx = 0 column: -d u / dy of (g - mean g)
const W0R = new Float64Array(H), W0I = new Float64Array(H);
for (let j = 0; j < H; j++) {
  const nyj = j < H / 2 ? j : j - H;
  let ar = 0, ai = 0;
  for (let y = 0; y < H; y++) {
    const u = WINDG[y] - GBAR, a = (TAU * nyj * y) / H;
    ar += u * cos(a);
    ai -= u * sin(a);
  }
  ar /= H;
  ai /= H;
  const ky = (TAU * nyj) / H; // -i ky (ar + i ai) = ky ai - i ky ar
  W0R[j] = ky * ai;
  W0I[j] = -ky * ar;
}

// ---- the flow ----
function rhs(S, wr, wi, oR, oI) {
  const { ar, ai, br, bi } = S, ub = S.ubar, vb = -CFG.draft;
  for (let p = 0; p < N; p++) {
    const k2 = K2[p];
    if (k2 === 0) {
      ar[p] = ai[p] = 0;
    } else {
      const sr = wr[p] / k2, si = wi[p] / k2;
      ar[p] = KX[p] * sr - KY[p] * si;
      ai[p] = KY[p] * sr + KX[p] * si;
    }
    br[p] = -KX[p] * wi[p] - KY[p] * wr[p];
    bi[p] = KX[p] * wr[p] - KY[p] * wi[p];
  }
  fft2(ar, ai, true);
  fft2(br, bi, true);
  for (let p = 0; p < N; p++) {
    ar[p] = (ar[p] + ub) * br[p] + (ai[p] + vb) * bi[p];
    ai[p] = 0;
  }
  fft2(ar, ai, false);
  const inv = 1 / N, nu = CFG.nu, hy = CFG.hyp, fr = CFG.fric, Fr = S.fr, Fi = S.fi;
  for (let p = 0; p < N; p++) {
    const d = nu * K2[p] + hy * K2[p] * K2[p] + ((p & WM) === 0 ? 0 : fr);
    oR[p] = -ar[p] * inv * FIL[p] - d * wr[p] + Fr[p];
    oI[p] = -ai[p] * inv * FIL[p] - d * wi[p] + Fi[p];
  }
}
// The stream function on the corners of the cells and the vorticity on the cells in one transform (two real fields,
// packed). The velocity on the faces is the difference of the corner values, so its divergence is zero to rounding.
function prep(S) {
  const { wr, wi, ar, ai, U, V, omp } = S;
  for (let p = 0; p < N; p++) {
    const k2 = K2[p];
    let cr = 0, ci = 0;
    if (k2 !== 0) {
      const sr = wr[p] / k2, si = wi[p] / k2;
      cr = sr * CSH[p] - si * SSH[p];
      ci = sr * SSH[p] + si * CSH[p];
    }
    ar[p] = cr - wi[p];
    ai[p] = ci + wr[p];
  }
  fft2(ar, ai, true);
  const ub = S.ubar;
  let mx = 0.5;
  for (let j = 0; j < H; j++) {
    const o = j * W, om = ((j - 1) & HM) * W;
    for (let i = 0; i < W; i++) {
      const p = o + i, u = ar[p] - ar[om + i] + ub, v = -(ar[p] - ar[o + ((i - 1) & WM)]) - CFG.draft;
      U[p] = u;
      V[p] = v;
      omp[p] = ai[p];
      const a = abs(u), b = abs(v);
      if (a > mx) mx = a;
      if (b > mx) mx = b;
    }
  }
  return mx;
}

// ---- the scalars: flux form, second order upwind with the monotonised central limiter ----
const SL = new Float64Array(max(W, H) + 2), FX = new Float64Array(max(W, H) + 2);
const mc = (a, b) => {
  if (a * b <= 0) return 0;
  const s = a > 0 ? 1 : -1, x = abs(a), y = abs(b), z = 0.5 * (x + y);
  return s * min(2 * x, 2 * y, z);
};
function sweepX(R, U, dt) {
  for (let j = 0; j < H; j++) {
    const o = j * W;
    for (let i = 0; i < W; i++) SL[i] = mc(R[o + i] - R[o + ((i - 1) & WM)], R[o + ((i + 1) & WM)] - R[o + i]);
    for (let i = 0; i < W; i++) {
      const u = U[o + i], ip = (i + 1) & WM, nu = u * dt;
      FX[i] = u > 0 ? u * (R[o + i] + 0.5 * (1 - nu) * SL[i]) : u * (R[o + ip] - 0.5 * (1 + nu) * SL[ip]);
    }
    for (let i = 0; i < W; i++) R[o + i] -= dt * (FX[i] - FX[(i - 1) & WM]);
  }
}
function sweepY(R, V, dt) {
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < H; j++) SL[j] = mc(R[j * W + i] - R[((j - 1) & HM) * W + i], R[((j + 1) & HM) * W + i] - R[j * W + i]);
    for (let j = 0; j < H; j++) {
      const v = V[j * W + i], jp = (j + 1) & HM, nu = v * dt;
      FX[j] = v > 0 ? v * (R[j * W + i] + 0.5 * (1 - nu) * SL[j]) : v * (R[jp * W + i] - 0.5 * (1 + nu) * SL[jp]);
    }
    for (let j = 0; j < H; j++) R[j * W + i] -= dt * (FX[j] - FX[(j - 1) & HM]);
  }
}

// ---- vents ----
function ventLayout(S, n) {
  S.nv = n;
  const pitch = W / n;
  for (let v = 0; v < MAXV; v++) {
    S.bt[v] = v < n ? (v + 0.5) * pitch + S.off : (v % n + 0.5) * pitch + S.off;
    S.pt[v] = v < n ? 1 : 0;
  }
}
function drift(S, dt) {
  const n = S.nv, pitch = W / n;
  const dd = exp(-dt / 35), qd = sqrt(1 - dd * dd), da = exp(-dt / 20), qa = sqrt(1 - da * da);
  const rp = 1 - exp(-dt / 2), rb = 1 - exp(-dt / 3);
  for (let v = 0; v < MAXV; v++) {
    S.dv[v] = S.dv[v] * dd + 0.3 * pitch * qd * gauss();
    S.az[v] = S.az[v] * da + qa * gauss();
    S.am[v] = cl(1 + 0.4 * S.az[v], 0.35, 1.6);
    S.pr[v] += (S.pt[v] - S.pr[v]) * rp;
    let d = S.bt[v] - S.bx[v];
    d -= W * Math.round(d / W);
    S.bx[v] += d * rb;
  }
  const dw = exp(-dt / CFG.windT), qw = sqrt(1 - dw * dw);
  S.wa = S.wa * dw + CFG.wind * qw * gauss();
  S.ubar = S.wa * GBAR;
}
function ventField(S, sig) {
  const G = S.G;
  G.fill(0);
  for (let v = 0; v < MAXV; v++) {
    const amp = S.pr[v] * S.am[v];
    if (amp < 0.002) continue;
    const x = S.bx[v] + S.dv[v];
    for (let i = 0; i < W; i++) {
      let d = i - x;
      d -= W * Math.round(d / W);
      G[i] += amp * exp((-0.5 * d * d) / (sig * sig));
    }
  }
  for (let i = 0; i < W; i++) G[i] = 1 - exp(-G[i]);
}

function step(S, dt) {
  const { wr, wi, k1r, k1i, k2r, k2i, tr, ti, T, sm, U, V, omp, F } = S;
  const um = prep(S), nsub = max(1, ceil((um * dt) / CFG.cfl)), ds = dt / nsub;
  S.um = um;
  for (let n = 0; n < nsub; n++)
    for (const R of [sm, T]) {
      sweepX(R, U, 0.5 * ds);
      sweepY(R, V, ds);
      sweepX(R, U, 0.5 * ds);
    }
  // sources and sinks of the scalars
  ventField(S, S.sig);
  const G = S.G, rv = CFG.rv * dt, cool = CFG.cool * dt, kd = CFG.kappa * dt;
  const t2 = S.t2;
  for (let j = 0; j < H; j++) {
    const o = j * W, hv = VENTY[j], sp = SPONGE[j], sr = CFG.sTop * sp * dt, tcool = cool + 2 * sr;
    for (let i = 0; i < W; i++) {
      const p = o + i, g = G[i] * hv * rv;
      sm[p] = sm[p] + g * (CFG.sv - sm[p]) - sr * sm[p];
      T[p] = T[p] + g * (CFG.tv - T[p]) - tcool * T[p];
    }
  }
  for (const R of [sm, T]) {
    for (let j = 0; j < H; j++) {
      const o = j * W, u = ((j - 1) & HM) * W, w = ((j + 1) & HM) * W;
      for (let i = 0; i < W; i++) {
        const p = o + i;
        t2[p] = R[p] + kd * (R[o + ((i - 1) & WM)] + R[o + ((i + 1) & WM)] + R[u + i] + R[w + i] - 4 * R[p]);
      }
    }
    for (let p = 0; p < N; p++) R[p] = cl(t2[p], 0, 1.2);
  }
  // the force on the vorticity: curl of (buoyancy + vent push), vorticity confinement, drag in the sponge
  const beta = S.beta, jet = CFG.jet, conf = S.conf, mt = CFG.muTop;
  const { ca, cx, cy } = S;
  for (let p = 0; p < N; p++) ca[p] = abs(omp[p]);
  for (let j = 0; j < H; j++) {
    const o = j * W, u = ((j - 1) & HM) * W, w = ((j + 1) & HM) * W;
    for (let i = 0; i < W; i++) {
      const gx = 0.5 * (ca[o + ((i + 1) & WM)] - ca[o + ((i - 1) & WM)]), gy = 0.5 * (ca[w + i] - ca[u + i]);
      const m = 1 / sqrt(gx * gx + gy * gy + 1e-3);
      cx[o + i] = omp[o + i] * gx * m;
      cy[o + i] = omp[o + i] * gy * m;
    }
  }
  for (let j = 0; j < H; j++) {
    const o = j * W, u = ((j - 1) & HM) * W, w = ((j + 1) & HM) * W, hv = VENTY[j], mu = mt * SPONGE[j], cm = conf * (1 - SPONGE[j]);
    for (let i = 0; i < W; i++) {
      const p = o + i, ip = (i + 1) & WM, im = (i - 1) & WM;
      const Tx = 0.5 * (T[o + ip] - T[o + im]), Gx = 0.5 * (G[ip] - G[im]) * hv;
      const div = 0.5 * (cx[o + ip] - cx[o + im]) + 0.5 * (cy[w + i] - cy[u + i]);
      F[p] = -beta * Tx - jet * Gx - mu * omp[p] - cm * smooth(0.04, 0.3, sm[p]) * div;
    }
  }
  S.ar.set(F);
  S.ai.fill(0);
  fft2(S.ar, S.ai, false);
  const inv = 1 / N;
  for (let p = 0; p < N; p++) {
    S.fr[p] = S.ar[p] * inv * FIL[p];
    S.fi[p] = S.ai[p] * inv * FIL[p];
  }
  // Shu and Osher's third order scheme for the vorticity
  rhs(S, wr, wi, k1r, k1i);
  for (let p = 0; p < N; p++) (tr[p] = wr[p] + dt * k1r[p]), (ti[p] = wi[p] + dt * k1i[p]);
  rhs(S, tr, ti, k2r, k2i);
  for (let p = 0; p < N; p++) (tr[p] = 0.75 * wr[p] + 0.25 * (tr[p] + dt * k2r[p])), (ti[p] = 0.75 * wi[p] + 0.25 * (ti[p] + dt * k2i[p]));
  rhs(S, tr, ti, k2r, k2i);
  for (let p = 0; p < N; p++) (wr[p] = (wr[p] + 2 * (tr[p] + dt * k2r[p])) / 3), (wi[p] = (wi[p] + 2 * (ti[p] + dt * k2i[p])) / 3);
  // the mean wind back to its profile
  const a = CFG.relU * dt;
  for (let j = 0; j < H; j++) {
    const p = j * W;
    wr[p] += a * (S.wa * W0R[j] - wr[p]);
    wi[p] += a * (S.wa * W0I[j] - wi[p]);
  }
  wr[0] = wi[0] = 0;
  drift(S, dt);
  S.time += dt;
}

const sigOf = (v) => 2.4 * pow(1.5, cl(v, -1.2, 1.2));
const confOf = (v) => CFG.conf * pow(2.2, -cl(v, -1.2, 1.2));
const betaOf = (v) => CFG.beta * pow(1.7, cl(v, -1.2, 1.2));
const nvOf = (v) => cl(floor(5 + 1.7 * cl(v, -1.2, 1.2)), 3, 6);

function start(params, k) {
  const mk = () => new Float64Array(N);
  const S = {
    wr: mk(), wi: mk(), ar: mk(), ai: mk(), br: mk(), bi: mk(), k1r: mk(), k1i: mk(), k2r: mk(), k2i: mk(), tr: mk(), ti: mk(),
    fr: mk(), fi: mk(), F: mk(), U: mk(), V: mk(), T: mk(), sm: mk(), t2: mk(), omp: mk(), ca: mk(), cx: mk(), cy: mk(),
    G: new Float64Array(W), bx: new Float64Array(MAXV), bt: new Float64Array(MAXV), dv: new Float64Array(MAXV), az: new Float64Array(MAXV),
    am: new Float64Array(MAXV), pr: new Float64Array(MAXV), pt: new Float64Array(MAXV),
    nv: 0, off: Math.random() * W, wa: gauss() * CFG.wind, ubar: 0, sig: sigOf(k[2]), beta: betaOf(k[3]), conf: confOf(k[2]),
    um: 4, os: 0, time: 0, ready: false, hue: 0, lutHue: -9, tau: mk(), sky: new Float64Array(H * 3), lut: new Float64Array(256 * 3),
  };
  S.ubar = S.wa * GBAR;
  params.s = S;
  ventLayout(S, nvOf(k[3]));
  for (let v = 0; v < MAXV; v++) (S.bx[v] = S.bt[v]), (S.pr[v] = S.pt[v]), (S.dv[v] = 0.3 * (W / S.nv) * gauss()), (S.az[v] = gauss());
  for (let t = 0; t < CFG.pre; t += 0.1) step(S, 0.1);
  S.ready = true;
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.1, 8);
  S.hue = cl(k[0], 0, 1);
  const r = 1 - exp(-ft / 0.5);
  S.sig += (sigOf(k[2]) - S.sig) * r;
  S.conf += (confOf(k[2]) - S.conf) * r;
  S.beta += (betaOf(k[3]) - S.beta) * r;
  const nt = nvOf(k[3]);
  if (nt !== S.nv) ventLayout(S, nt);
  // the step is the longest that keeps the fastest face under 1.5 / 1.8 model seconds per LED (the cut is at 1.8 rad per LED), so the Runge-Kutta stays in its stable range
  const dm = ft * flow * CFG.tscale, lim = min(CFG.dt, 1.5 / (1.8 * S.um)), ns = max(1, ceil(dm / lim - 1e-9));
  if (dm > 0) for (let i = 0; i < ns; i++) step(S, dm / ns);
  let e = 0;
  for (let p = 0; p < N; p++) e += S.omp[p] * S.omp[p];
  S.os = S.os ? S.os + (sqrt(e / N) - S.os) * 0.05 : sqrt(e / N);
  if (!isFinite(S.wr[1] + S.sm[N >> 1] + S.T[N >> 1])) start(params, k);
}

// ---- colour ----
// The smoke's colour follows its temperature on a log scale, so young smoke is gold and orange, then apricot and rose, then
// the grey of smoke that has cooled. All colours are turned round the grey axis by Hue, so one turn comes back.
const SKY = [[50, 42, 66], [98, 66, 72], [170, 84, 52]]; // top, middle, horizon
const RAMP = [
  [0.0, 174, 168, 184],
  [0.26, 198, 172, 172],
  [0.5, 226, 168, 142],
  [0.72, 246, 152, 86],
  [0.88, 255, 196, 108],
  [1.0, 255, 236, 176],
];
function rotate(c, a) {
  const co = cos(a), si = sin(a), k1 = (1 - co) / 3, k2 = sqrt(1 / 3) * si;
  const m = [co + k1, k1 - k2, k1 + k2, k1 + k2, co + k1, k1 - k2, k1 - k2, k1 + k2, co + k1];
  return [
    cl(m[0] * c[0] + m[1] * c[1] + m[2] * c[2], 0, 255),
    cl(m[3] * c[0] + m[4] * c[1] + m[5] * c[2], 0, 255),
    cl(m[6] * c[0] + m[7] * c[1] + m[8] * c[2], 0, 255),
  ];
}
function buildPalette(S, hue) {
  const a = hue * TAU, sk = SKY.map((c) => rotate(c, a));
  for (let y = 0; y < H; y++) {
    const t = y / HM, u = cl(t / 0.55, 0, 1), v = cl((t - 0.55) / 0.45, 0, 1);
    for (let k = 0; k < 3; k++) S.sky[y * 3 + k] = t < 0.55 ? sk[0][k] + (sk[1][k] - sk[0][k]) * u : sk[1][k] + (sk[2][k] - sk[1][k]) * v * v;
  }
  for (let i = 0; i < 256; i++) {
    const b = i / 255;
    let j = 0;
    while (j < RAMP.length - 2 && b > RAMP[j + 1][0]) j++;
    const A = RAMP[j], B = RAMP[j + 1], t = cl((b - A[0]) / (B[0] - A[0]), 0, 1);
    const c = rotate([A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t, A[3] + (B[3] - A[3]) * t], a);
    S.lut[i * 3] = c[0];
    S.lut[i * 3 + 1] = c[1];
    S.lut[i * 3 + 2] = c[2];
  }
}
const ALPHA = new Float64Array(257), LEXP = new Float64Array(257), TONE = new Uint8Array(1025);
for (let i = 0; i <= 256; i++) {
  ALPHA[i] = 1 - exp((-3 * i) / 213);
  LEXP[i] = exp((-i / 256) * 2.4);
}
for (let i = 0; i <= 1024; i++) TONE[i] = cl(log(1 + ((i / 1024) * (i / 1024)) / 0.004) / log(251), 0, 1) * 255;

const LX = -0.45, LY = -0.89; // towards the light: up and to the left
const VW = 0.12;

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.lutHue !== S.hue) (S.lutHue = S.hue), buildPalette(S, S.hue);
  const { sm, T, tau, sky, lut, omp } = S, il = 1 / max(1e-6, S.os);
  // the optical depth towards the light, which is up and to the left: a running sum along (-1, -2), (-1, -1) and (0, -1)
  for (let y = 0; y < H; y++) {
    const o = y * W, o1 = ((y - 1) & HM) * W, o2 = ((y - 2) & HM) * W;
    for (let x = 0; x < W; x++) {
      const xm = (x - 1) & WM;
      const up = y >= 2 ? 0.4 * tau[o2 + xm] : 0, ul = y >= 1 ? 0.35 * tau[o1 + xm] + 0.25 * tau[o1 + x] : 0;
      tau[o + x] = 0.8 * (up + ul) + 0.35 * sm[o + x];
    }
  }
  for (let y = 0, p = 0; y < H; y++) {
    const sr = sky[y * 3], sg = sky[y * 3 + 1], sb = sky[y * 3 + 2];
    for (let x = 0; x < W; x++, p++) {
      const s = cl(sm[p], 0, 1.2), al = ALPHA[(s * 213) | 0];
      const L = LEXP[min(256, (tau[p] * 256) | 0)], o = TONE[(sqrt(cl(T[p], 0, 1)) * 1024) | 0] * 3;
      const gx = 0.25 * (sm[y * W + ((x + 2) & WM)] - sm[y * W + ((x - 2) & WM)]), gy = 0.25 * (sm[((y + 2) & HM) * W + x] - sm[((y - 2) & HM) * W + x]);
      const f = 0.5 + 0.55 * L + cl(-4 * (gx * LX + gy * LY), -0.25, 0.45) + VW * tanh(omp[p] * il) * smooth(0.05, 0.4, s);
      display.setPixel(x, y, cl(sr + (lut[o] * f - sr) * al, 0, 255), cl(sg + (lut[o + 1] * f - sg) * al, 0, 255), cl(sb + (lut[o + 2] * f - sb) * al, 0, 255));
    }
  }
}
