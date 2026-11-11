// ===== Patternflow pattern =====
// Title:   Fuzzy Dark Matter
// Family:  physics
// Idea:    One wave function on the panel's own 64 by 128 torus obeys the Schrodinger equation with its own gravity, fresh waves keep arriving and a weak absorber keeps the mean density fixed, and its density is drawn on a log scale, so interference granules a few LEDs across glitter over the whole panel and gather into halos, while smooth gold solitons, the self-bound ground states of the same equation, are born, wander through the granules, merge and fade.
// Author:  patternflow-lab
// Date:    2026-11-11
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Schrodinger-Poisson system as a model of ultralight (fuzzy) dark matter, i psi_t = -1/2 lap psi + Phi psi with lap Phi = 4 pi G (|psi|^2 - mean): the wave equation as a simulation of collisionless matter (Lawrence Widrow and Nick Kaiser, 1993), the wave properties of ultralight dark matter (Wayne Hu, Rennan Barkana and Andrei Gruzinov, 2000), solitonic cores and granules in a cosmic web run on this equation (Hsi-Yu Schive, Tzihong Chiueh and Tom Broadhurst, Nature Physics 2014), the soliton as the ground state of a self-gravitating wave (Remo Ruffini and Silvano Bonazzola, 1969, for the boson star), Strang splitting (Gilbert Strang, 1968), all names and years from memory
// Round:   128
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Epoch=0.5..4, Scale=-1..1, Pull=-1..1
//
// Knob 1: Hue. Turns the colour ramp round the wheel in OKLCH, and one full turn comes back to where it began. At 0 the voids are deep indigo, a granule runs violet to magenta, a halo coral, and a soliton core gold; at 0.25 the voids are crimson and the granules orange, at 0.5 dark green and lime, at 0.75 teal and sky blue. The dark end of the ramp is bent away from orange, which would read as brown. On top of the knob every LED is tinted by up to 0.6 rad round the wheel by the sign of the flow there along x (the phase gradient of psi), so granules moving right lean one way and granules moving left the other.
// Knob 2: Epoch. How many model time units pass in a panel second, 3 for each unit of the knob: 1.5 at 0.5, 6 at the opening 2, 12 at 4. Measured at the opening, the granule-sized part of the density has lost half its correlation after 7 units (1.2 s; 4.7 s at 0.5, 0.6 s at 4), a long Jeans fluctuation grows by a factor e every 34 units (5.6 s), and the absorber turns the mass over in 194 units (32 s), so a soliton fades over a quarter of a minute and the panel is never the same twice.
// Knob 3: Scale. The length unit, 1.45 to the power of the knob: 0.69 at -1, 1 at the opening, 1.45 at 1. It is the panel measured in de Broglie wavelengths: the sea of waves is injected at wave number 0.5 / Scale per LED, a wavelength of 8.7, 12.6 and 18.2 LEDs, and the density autocorrelation of the whole field falls to half at 2.3, 2.9 and 4.7 LEDs (a granule is about twice that across). Solitons grow with it, radius 2.2, 3.2 and 4.6 LEDs for a lump of mass 850, and the panel holds 3.6, 2.9 and 1.9 of them (cores, the maxima of the density smoothed at sigma 2 that stand above 6, averaged over 1200 units after 300 of settling, 200 s at the opening).
// Knob 4: Pull. The gravity constant, G = 7e-5 times 2.2 to the power of the knob: 3.2e-5, 7e-5 and 1.5e-4. A soliton of mass M has radius sqrt(0.6 / (G M)) and central density 0.34 G M^2, so a lump of 850 is 4.7, 3.2 and 2.1 LEDs in radius and 8, 17 and 37 times the mean density at the middle. On the same average the mass that sits in cells above 8 times the mean is 9, 13 and 40 per cent and the brightest cell averages 18, 25 and 53 times the mean: a granular haze with faint lumps at -1, bound gold cores in a dark sea at 1.

// What the field is. One complex wave function psi(x, y, t) on the panel's own torus, in LEDs, and one equation with hbar over mass 1,
//   i psi_t = -1/2 lap psi + Phi psi,        lap Phi = 4 pi G (|psi|^2 - 1),
// the Schrodinger-Poisson system. |psi|^2 is the density, held at a mean of 1, and Phi is the gravity of that density with its mean taken out (the
// Poisson problem on a periodic box has no solution otherwise). Fuzzy dark matter is this equation for a particle so light that its de Broglie
// wavelength is the size of a galaxy's core: the density is made of interference granules half a wavelength across, gravity gathers them into halos,
// and at the middle of a halo sits a soliton, the ground state of the same equation, a lump with no node in it and a size set by M r^2 = 0.6 / G.
// A step is the free flight in k space, exp(-i k^2 dt / 2), then the kick, exp(-i Phi dt), with Phi taken from the density after the flight; that is
// Strang splitting seen half a kick late. dt = 0.2 model time units, four 64 by 128 transforms a step. Scale is a change of length unit, x' = x / s:
// it multiplies k^2 by s^2 in the flight and in the Poisson kernel and moves the injection bands, and G, the rates and the masses stay per scaled area.
// What keeps it alive (and what did not). A closed box of this equation gathers: gravity only ever pulls the granules into fewer, heavier halos, and it
// ends as one soliton in a haze. The box is made open instead, and each part is a number to measure. Fresh waves arrive as random complex amplitudes
// in a ring of wave numbers, 0.5 +- 0.2 (the sea, granules of a few LEDs, J = 0.002 mass a cell a unit of time) and 0.14 +- 0.1 (long smooth swells,
// J = 0.003). Packets arrive as Gaussian lumps at a random place, a Poisson process of 0.02 a unit of time, mass 600 to 1100, laid in coherently over 10
// units with a phase gradient of up to 0.2 and sized as the soliton of that mass, sqrt(0.6 / (G M)) in half-density radius; they relax into solitons or
// break up, and two close ones merge. The mean density is put back to 1 after every step, which is a uniform absorber: with everything counted, the mass
// turns over with an e-fold time of 194 units (5.15e-3 a unit before the absorber, measured over 3000 units, where the sources put in 7.1e-3, so the sponge and the cap take about 2e-3).
// A sponge on the amplitude, exp(-0.1 dt (k / 1.6)^8), takes out the shortest waves (a compact core sheds rings of them, still seen at Scale -1
// and at Pull 1; 0.1 per unit at k = 1.6, 22 at the corner of k space). A cap takes out density above 30 times the mean, psi *= exp(-0.1 dt (rho / 30 - 1)). Without the cap, at G
// of 1.2e-4 or 2e-4 (an earlier build without the cold swells, 3000 units) one or two cores took 59 to 74 per cent of the mass and reached a
// density of 990 to 1600, at the grid scale, and stayed; with it the same G holds 5 to 10 cores whose highest density runs 27 to 61 times the mean
// (G 1.2e-4). The top of the Pull knob, 1.5e-4, is at that edge, and the cap is what lets it run.
// What the other ways to keep it alive did, each cut out of this same file and drawing, tested as the opening at 240 s and at 900 s (recur, dim, quiet,
// then the last quarter's dim and quiet, and diff when it is large):
// - Closed box, no sources and no sponge, the start state only: 0.477 0.639 0.355 (tail 0.624 0.293) at 240 s, which fails on the last quarter's
//   quiet; at 900 s 0.432 0.638 0.331 (0.638 0.315), which passes by a hair. One halo condenses across the top and bottom edges of the torus and a dark
//   void stays still in the middle.
// - A wandering tidal potential (Ornstein-Uhlenbeck on the modes with k up to 0.3, rms 0.05, correlation time 30 units) on a closed box with the
//   sponge to carry the heat off: 0.022 0.820 0.285 (tail 0.958 0.000, diff 0.467) at 240 s and 0.008 0.922 0.299 (0.960 0.000, diff 0.217) at 900 s.
//   It drags a soliton about as a whole and its curvature (at most 0.05 k^2 = 4.5e-3) is smaller than the soliton's own (4 pi G rho_c = 0.015 at the
//   opening): one core eats the box and the rest goes dark. An earlier sweep of rms 0.003 to 0.1 with a different absorber ended at 56 to 67 per cent
//   of the mass in cells above 6.
// - A wandering G (log-OU, rms 0.7, 400 units) on a closed box: 0.483 0.758 0.522 (0.854 0.718) at 240 s, which passes, and 0.004 0.870 0.538 (0.874
//   0.322, diff 0.362) at 900 s, which does not: one soliton ringed with waves is left, with straight standing stripes across the rest, the last quarter is 36 per cent dimmer than the
//   first, and two frames more than 20 s apart almost match.
// - Only the sea and the swells, no packets and no cap: 0.673 0.691 0.724 (0.652 0.697) at 240 s and 0.578 0.763 0.776 (0.701 0.743) at 900 s.
//   It passes everything, and it is a speckle with soft bumps in it; the bright cells are interference, not solitons.
// - A scale-factor restart was not tried, because a restart is a seam.
// What was checked, with the file's own step (the tests are scripts outside the repository, run on a copy of this code with the sources off):
// - Norm. The flight is unitary: the sum of |ln(mass after the flight / N)| over 40 units is 2e-13 at 100 steps and 2e-12 at 800.
// - Energy. Kinetic plus half the potential, read at the synchronised state, over 40 units with the sea alone: the largest drift is 8.7e-7, 2.2e-7, 5.5e-8
//   and 1.5e-8 of the energy at dt = 0.4, 0.2, 0.1 and 0.05, second order (each halving falls by 3.9, 4.0, 3.7); in a collapsing box (G 5e-4) 3.8e-4, 1.8e-4,
//   4.4e-5 and 1.2e-5.
// - Free wave. A plane wave keeps omega = k^2 / 2: the phase after 30 units is right to 1e-14 rad at three wave vectors, one at Scale 1.5. That is
//   exact by construction, the flight being exact in k space.
// - Jeans. A uniform state with a 1e-3 ripple at G = 1e-3, growth rate sqrt(4 pi G - (k^2 / 2)^2): measured from acosh of the growth over 24 units,
//   0.10995, 0.10286 and 0.08072 at k = 0.196, 0.295 and 0.393 against 0.11043, 0.10337 and 0.08137 (0.4 to 0.8 per cent low at dt = 0.2; 0.08121 at
//   dt = 0.05). The mode at k = 0.491 oscillates, as k_J = (16 pi G)^(1/4) = 0.4735 says, at 95 per cent of the amplitude of the linear solution.
// - Speckle. The sea alone has a density with <rho^2> / <rho>^2 = 1.979 (2 for a Gaussian field), 9.42 per cent of cells under 0.1 (9.52) and 4.86 per
//   cent over 3 (4.98), 60 realisations.
// - Soliton. Ground states by imaginary time with this Poisson kernel: G M r^2 = 0.6061, 0.6073 and 0.6055 for half-density radius 3.9, 2.76 and 1.95
//   (0.6174 at 5.6, where the box is no longer large), central density 0.206 M / r^2. Rescaling by 2 gives radius 1.990 times smaller (2), central density
//   16.13 times (16) and kinetic energy per unit mass 4.04 times (4). The same step then holds one in place: a soliton of all the mass (G 8.1e-6, radius 3.0)
//   kept its density to 1.1 per cent after 200 units and turned its phase at 0.22724 a unit against the chemical potential 0.22693 from the energies.
// - Over 900 s of panel time, run as model time at each corner (5400, 1350 and 10800 units), the kinetic energy per mass stays between 0.126 and 0.178 at the
//   opening, 0.086 and 0.119 at the minimum and 0.154 and 0.217 at the maximum, and 6 to 21 per cent of the mass stays in cores above 8 times the mean.
// The picture. Density goes through a log, u = ln(1 + rho / 0.3) / ln(1 + 20 / 0.3), into an OKLCH ramp (lightness 0.22 to 0.96): voids indigo, rho = 1 violet,
// 3 magenta, 8 coral 12 pale gold and 20 cream. Chroma is pulled in until the colour fits sRGB after the panel's 1.62 saturation lift, so no channel clips.
// The tint from the flow is the current j_x = Im(psi* d psi / dx) over rho + 0.3, so a node of the wave does not make noise.
// What it cost. In a Node loop update takes 1.1 ms at the opening and at the minimum and 2.0 to 2.2 ms at Epoch 4 (two steps a frame), draw 0.2 ms; the first
// update, 150 steps run before the first frame, takes 0.16 to 0.33 s.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, exp, log, min, max, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];

// tunables (draft)
const CFG = { G0: 7e-5, DT: 0.2, R0: 6, JH: 0.002, KH: 0.5, WH: 0.2, JC: 0.003, KC: 0.14, WC: 0.1, LAM: 0.02, MMIN: 600, MMAX: 1100, TIN: 10, VMAX: 0.2, NSEED: 4, WARM: 150, KS: 1.6, GS: 0.1, PS: 8, TOP: 20, R0T: 0.3, CAP: 30, GCAP: 0.1, DOP: 0.6 };

// ---- radix-2 FFT ----------------------------------------------------------------------------
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
const PX = plan(W), PY = plan(H);
const TR = new Float64Array(H), TI = new Float64Array(H);
function fft(p, re, im, o, inv) {
  const { n, rev, c, s } = p, sg = inv ? -1 : 1;
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
function fft2(re, im, inv) {
  for (let y = 0; y < H; y++) fft(PX, re, im, y * W, inv);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) (TR[y] = re[y * W + x]), (TI[y] = im[y * W + x]);
    fft(PY, TR, TI, 0, inv);
    for (let y = 0; y < H; y++) (re[y * W + x] = TR[y]), (im[y * W + x] = TI[y]);
  }
}
function gauss() {
  let u = Math.random();
  while (u < 1e-12) u = Math.random();
  return sqrt(-2 * log(u)) * cos(TAU * Math.random());
}
function abs(v) {
  return v < 0 ? -v : v;
}

// ---- the field ------------------------------------------------------------------------------
// Everything is kept in scaled units: x' = x / s, so Scale only changes K2 (times s^2) in the drift and the Poisson kernel, the band the
// sea is injected in, and how big the lumps are laid in; G, the injection rates and the lumps' masses are per scaled area.
function setup(params) {
  const S = {
    t: 0, warm: false, hue: 0, s: 1, g: 1, R: 6, kdt: 0, kG: 0, ks: 0, dt: CFG.DT, sum: N, nb: 0, bs: 0, hueDone: -1,
    re: new Float64Array(N), im: new Float64Array(N), tr: new Float64Array(N), ti: new Float64Array(N),
    K2: new Float64Array(N), Dr: new Float64Array(N), Di: new Float64Array(N), Pk: new Float64Array(N), SP: new Float64Array(N),
    bh: [], bc: [], lumps: [], gx: new Float64Array(64), gy: new Float64Array(64), cx: new Float64Array(64), sx: new Float64Array(64), cy: new Float64Array(64), sy: new Float64Array(64),
  };
  for (let y = 0; y < H; y++) {
    const ny = y < H / 2 ? y : y - H, ky = (TAU * ny) / H;
    for (let x = 0; x < W; x++) {
      const nx = x < W / 2 ? x : x - W, kx = (TAU * nx) / W, p = y * W + x, k2 = kx * kx + ky * ky;
      S.K2[p] = k2;
      S.SP[p] = CFG.GS * pow(k2 / (CFG.KS * CFG.KS), CFG.PS / 2);
    }
  }
  params.s = S;
  return S;
}
function constants(S) {
  const G = S.g * CFG.G0;
  if (G !== S.kG || S.s !== S.ks) {
    S.kG = G;
    const s2 = S.s * S.s;
    for (let p = 0; p < N; p++) S.Pk[p] = S.K2[p] > 0 ? (-4 * PI * G) / (S.K2[p] * s2) : 0;
  }
  if (abs(S.dt - S.kdt) > 0.003 * S.dt || S.s !== S.ks) {
    S.kdt = S.dt;
    const s2 = S.s * S.s;
    for (let p = 0; p < N; p++) {
      const th = 0.5 * S.dt * S.K2[p] * s2, d = exp(-S.dt * S.SP[p]);
      S.Dr[p] = (d * cos(th)) / N;
      S.Di[p] = (-d * sin(th)) / N;
    }
  }
  if (S.s !== S.ks) {
    S.ks = S.s;
    S.bh.length = 0;
    S.bc.length = 0;
    for (let p = 1; p < N; p++) {
      const kk = sqrt(S.K2[p]) * S.s;
      if (abs(kk - CFG.KH) < CFG.WH) S.bh.push(p);
      if (abs(kk - CFG.KC) < CFG.WC) S.bc.push(p);
    }
  }
}
// One step: free flight in k space (with the sea's fresh waves laid in), then the kick of the potential.
function step(S) {
  const { re, im, tr, ti, Dr, Di, Pk } = S, dt = S.dt;
  fft2(re, im, false);
  for (let p = 0; p < N; p++) {
    const a = re[p], b = im[p], kr = Dr[p], ki = Di[p];
    re[p] = a * kr - b * ki;
    im[p] = a * ki + b * kr;
  }
  const nh = S.bh.length, eh = sqrt((CFG.JH * dt) / (2 * nh)), nc = S.bc.length, ec = sqrt((CFG.JC * dt) / (2 * nc));
  for (let i = 0; i < nh; i++) {
    const p = S.bh[i];
    re[p] += eh * gauss();
    im[p] += eh * gauss();
  }
  for (let i = 0; i < nc; i++) {
    const p = S.bc[i];
    re[p] += ec * gauss();
    im[p] += ec * gauss();
  }
  fft2(re, im, true);
  lumps(S, dt);
  let sum = 0;
  for (let p = 0; p < N; p++) {
    const r = re[p] * re[p] + im[p] * im[p];
    tr[p] = r;
    ti[p] = 0;
    sum += r;
  }
  S.sum = sum;
  const nrm = sqrt(N / sum);
  fft2(tr, ti, false);
  for (let p = 0; p < N; p++) {
    tr[p] *= Pk[p];
    ti[p] *= Pk[p];
  }
  fft2(tr, ti, true);
  const sc = (dt * nrm * nrm) / N, cap = CFG.CAP / (nrm * nrm), gc = CFG.GCAP * dt;
  for (let p = 0; p < N; p++) {
    const th = tr[p] * sc, c = cos(th), s = sin(th), r = re[p] * re[p] + im[p] * im[p];
    let a = re[p] * nrm, b = im[p] * nrm;
    if (r > cap) {
      const f = exp(-gc * (r / cap - 1));
      a *= f;
      b *= f;
    }
    re[p] = a * c + b * s;
    im[p] = b * c - a * s;
  }
}
// A lump is a Gaussian density with sigma sg (scaled units), a phase gradient (vx, vy), laid in coherently over TIN model time units.
function newLump(S, x, y, age) {
  const M = CFG.MMIN + (CFG.MMAX - CFG.MMIN) * Math.random(), r = sqrt(0.6 / (S.kG * M)), sg = r / 1.1774;
  const v = CFG.VMAX * sqrt(Math.random()), a = Math.random() * TAU;
  S.lumps.push({ x, y, sg, A: sqrt(M / (TAU * sg * sg)), vx: v * cos(a), vy: v * sin(a), age });
}
function layLump(S, L, f) {
  const { re, im, gx, gy, cx, sx, cy, sy } = S, s = S.s, sig = L.sg * s, R = min(31, Math.ceil(3.4 * sig)), A = L.A * f;
  const x0 = floor(L.x), y0 = floor(L.y), vx = L.vx / s, vy = L.vy / s;
  for (let d = -R; d <= R; d++) {
    const dx = x0 + d - L.x, dy = y0 + d - L.y;
    gx[d + R] = exp(-(dx * dx) / (4 * sig * sig));
    gy[d + R] = exp(-(dy * dy) / (4 * sig * sig));
    cx[d + R] = cos(vx * dx);
    sx[d + R] = sin(vx * dx);
    cy[d + R] = cos(vy * dy);
    sy[d + R] = sin(vy * dy);
  }
  for (let dy = -R; dy <= R; dy++) {
    const y = (y0 + dy + H) % H, gyv = A * gy[dy + R];
    for (let dx = -R; dx <= R; dx++) {
      const x = (x0 + dx + W) % W, g = gyv * gx[dx + R], p = y * W + x;
      re[p] += g * (cx[dx + R] * cy[dy + R] - sx[dx + R] * sy[dy + R]);
      im[p] += g * (sx[dx + R] * cy[dy + R] + cx[dx + R] * sy[dy + R]);
    }
  }
}
function lumps(S, dt) {
  S.nb -= dt;
  while (S.nb < 0) {
    S.nb += -log(1 - Math.random()) / (CFG.LAM / (S.s * S.s));
    newLump(S, Math.random() * W, Math.random() * H, 0);
  }
  for (let i = S.lumps.length - 1; i >= 0; i--) {
    const L = S.lumps[i];
    layLump(S, L, min(dt, CFG.TIN - L.age) / CFG.TIN);
    L.age += dt;
    if (L.age >= CFG.TIN - 1e-9) S.lumps.splice(i, 1);
  }
}
function initField(S) {
  const { re, im, K2 } = S;
  for (let p = 0; p < N; p++) {
    const kk = sqrt(K2[p]) * S.s, a = K2[p] > 0 ? exp(-((kk - CFG.KH) ** 2) / (2 * CFG.WH * CFG.WH)) + 0.6 * exp(-((kk - CFG.KC) ** 2) / (2 * CFG.WC * CFG.WC)) : 0;
    re[p] = a * gauss();
    im[p] = a * gauss();
  }
  fft2(re, im, true);
  let s = 0;
  for (let p = 0; p < N; p++) s += re[p] * re[p] + im[p] * im[p];
  s = sqrt((0.6 * N) / s);
  for (let p = 0; p < N; p++) (re[p] *= s), (im[p] *= s);
  S.nb = -log(1 - Math.random()) / (CFG.LAM / (S.s * S.s));
  for (let i = 0, n = Math.round(CFG.NSEED / (S.s * S.s)); i < n; i++) {
    newLump(S, Math.random() * W, Math.random() * H, 0);
    layLump(S, S.lumps.pop(), 1);
  }
}

// ---- colour ---------------------------------------------------------------------------------
const NL = 512, MTOP = sqrt(CFG.TOP);
const STOPS = [[0, 0.22, 0.09, 285], [0.28, 0.36, 0.15, 295], [0.52, 0.52, 0.2, 335], [0.74, 0.7, 0.17, 385], [0.9, 0.85, 0.14, 440], [1, 0.96, 0.05, 455]];
function oklab2rgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const e = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
  return [e(r), e(g), e(bb)];
}
function fit(L, C, h) {
  for (let k = 0; k < 40; k++) {
    const c = oklab2rgb(L, C * cos(h), C * sin(h)), y = (c[0] * 77 + c[1] * 150 + c[2] * 29) / 256;
    if (c.every((v) => v >= 0 && v <= 1 && y + (v - y) * 1.62 >= -0.01 && y + (v - y) * 1.62 <= 1.01)) return c;
    C *= 0.96;
  }
  return oklab2rgb(L, C * cos(h), C * sin(h)).map((v) => cl(v, 0, 1));
}
function buildLut(S, hue) {
  S.hueDone = hue;
  const lut = (S.lut = S.lut || new Float32Array(NL * 3)), top = log(1 + CFG.TOP / CFG.R0T);
  for (let i = 0; i < NL; i++) {
    const m = (i / (NL - 1)) * MTOP, u = cl(log(1 + (m * m) / CFG.R0T) / top, 0, 1);
    let j = 0;
    while (j < STOPS.length - 2 && u > STOPS[j + 1][0]) j++;
    const a = STOPS[j], b = STOPS[j + 1], f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
    const L = a[1] + (b[1] - a[1]) * f;
    let hh = a[3] + (b[3] - a[3]) * f + hue * 360;
    const ang = ((hh % 360) + 370) % 360 - 10; // -10 .. 350
    if (ang < 150) hh += 38 * cl((0.5 - L) / 0.25, 0, 1) * sin((PI * (ang - 70)) / 80); // dark orange is brown: push the dark end away to crimson or to green
    const c = fit(L, a[2] + (b[2] - a[2]) * f, (hh * PI) / 180);
    lut[i * 3] = c[0];
    lut[i * 3 + 1] = c[1];
    lut[i * 3 + 2] = c[2];
  }
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  S.hue = cl(k[0], 0, 1);
  S.R = CFG.R0 * cl(k[1], 0.2, 8) * 0.5;
  S.s = pow(1.45, cl(k[2], -1, 1));
  S.g = pow(2.2, cl(k[3], -1, 1));
  if (!S.warm) {
    S.warm = true;
    constants(S);
    initField(S);
    for (let i = 0; i < CFG.WARM; i++) step(S);
  }
  const d = cl(dt || 0, 0, 0.1);
  const dm = d * S.R, n = max(1, Math.ceil(dm / CFG.DT - 1e-9));
  S.dt = dm / n;
  if (dm <= 0) return;
  constants(S);
  for (let i = 0; i < n; i++) step(S);
  S.t += dm;
  if (!(S.sum > 0 && S.sum < 1e12)) (S.warm = false), (S.lumps.length = 0); // a blown state starts over rather than showing noise
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  if (abs(S.hue - S.hueDone) > 0.0015) buildLut(S, S.hue);
  const { re, im, lut } = S, kq = (NL - 1) / MTOP, dop = CFG.DOP;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const r2 = re[p] * re[p] + im[p] * im[p], m = sqrt(r2), i = (min(m * kq, NL - 1) | 0) * 3;
      let R = lut[i], G = lut[i + 1], B = lut[i + 2];
      if (dop) {
        const xp = y * W + ((x + 1) & (W - 1)), xm = y * W + ((x + W - 1) & (W - 1));
        const vx = (re[p] * (im[xp] - im[xm]) - im[p] * (re[xp] - re[xm])) / (2 * (r2 + 0.3));
        const a = dop * cl(vx / 0.6, -1, 1), c = cos(a), sn = sin(a), yy = 0.299 * R + 0.587 * G + 0.114 * B;
        const I = 0.596 * R - 0.274 * G - 0.322 * B, Q = 0.211 * R - 0.523 * G + 0.312 * B, I2 = I * c - Q * sn, Q2 = I * sn + Q * c;
        R = cl(yy + 0.956 * I2 + 0.621 * Q2, 0, 1);
        G = cl(yy - 0.272 * I2 - 0.647 * Q2, 0, 1);
        B = cl(yy - 1.106 * I2 + 1.703 * Q2, 0, 1);
      }
      display.setPixel(x, y, R * 255, G * 255, B * 255);
    }
}
