// ===== Patternflow pattern =====
// Title:   Convergence Zones
// Family:  soundchannel
// Idea:    A source of sound near the surface of the deep ocean is followed as a wave, not as rays, through the Munk sound channel, where the speed of sound is lowest at 1.3 km and bends every beam back toward it, so the sound dives to 4 km, climbs back and refocuses against the surface as a bright convergence zone about 61 km out and again every 61 km, with a quiet shadow between, until the source sinks toward the channel axis, the zones fade and the sound stays trapped in a snake of bundles about the axis.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the sound channel in the deep ocean, found from sound-speed profiles and explosive shot records (Maurice Ewing and Joe Worzel, 1944, from memory), the canonical sound-speed profile c = c0 [1 + e (eta + exp(-eta) - 1)] with B = 1300 m and e = 0.00737 (Walter Munk, 1974, from memory), the parabolic equation for sound in the sea marched in range with a Fourier transform in depth (Richard Hardin and Frederick Tappert, 1973, from memory), a radix-2 FFT written for the panel; original code, pattern round 274
// Round:   274
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Source=0..4, Channel=-1..1, Pitch=-1..1
//
// Knob 1: Hue. Turns the palette round the wheel, one turn over the range. At 0 the water is blue with cyan and white lines and amber where the sound is loudest. The palette drifts 0.1 of a turn either way on clocks of 94.7 s and 55.3 s, changes by 0.05 from the surface to the deep, and by two waves of 0.02 and 0.015 that travel across the panel.
// Knob 2: Source. The depth of the source in metres, 100 + 1200 u^2 with u = Source / 4 + 0.5 w, w a sum of three sines of 40.5, 64.5 and 28.5 s (amplitudes 0.5, 0.35 and 0.25) and u held between 0 and 1. Over 15 minutes the depth sat between 100 and 441 m at 0, where there are always zones, between 100 and 1300 m at the opening 2 (median 397 m, 90 percent of the time 110 to 1025 m) and between 361 and 1300 m at 4 (median 1282 m), where the sound is nearly always trapped. The change is sharp. In the solver without the eddies the surface-to-mean intensity of the zone, the top six rows between 45 and 80 km, is 15 at 100 m, 6 at 300 m, 0.5 at 500 m and 0 from 700 m, and at 700 m or deeper 92 to 99 percent of the sound at 100 km lies within 700 m of the axis. The opening picture starts at about 190 m.
// Knob 3: Channel. The strength of the channel, e = 0.00737 x 2^(K + 1.3 w) with w a sum of three sines of 70.4, 48.6 and 33.1 s (amplitudes 0.5, 0.35 and 0.25). At 0 the knob gives Munk's own value, at -1 half of it and at 1 twice. The zones lie 1 / sqrt(e) as far apart: for a source at 100 m every 61 km at 0.00737, 86 km at half of that and 43 km at double, so the window of 150 km shows from one to four. With the wander e ran between 0.38 and 2.5 times the knob's value over 15 minutes and between 0.48 and 2.0 times for 90 percent of it.
// Knob 4: Pitch. The frequency of the sound, f = 22 x 2^(1.15 K) Hz: 9.9 Hz at -1, 22 Hz at 0 and 49 Hz at 1. A drift of 20 percent (36.3 s) and 12 percent (53.1 s) rides on it, so at the opening 0.06 the pitch ran between 15.7 and 30.4 Hz. Low pitch gives wide soft zones, since the wavelength of 150 m is close to the depth of the source and the field is smeared by diffraction; high pitch gives thin bright caustics with fringes beside them. The beam of the source has the same angle at every pitch, so the knob changes how sharply the field is drawn and not where the zones lie.
//
// What the picture is. The vertical plane of the ocean beneath a source: depth down the panel from the surface at the top row to 5 km at the bottom (39.06 m a row), range across, 150 km over the 64 columns (2.34 km a column). Every LED is the intensity of the sound there in decibels, found by solving the wave equation for the pressure, not by tracing rays. The surface is the pale line at the top, a convergence zone is a bright patch against it a few rows deep, and the sea floor is the dark band at the bottom, which is the lossy layer of the solver: nothing is drawn there.
// The solver. The field psi(r, z) obeys the narrow-angle parabolic equation d psi / d r = i k0 / 2 [(n^2 - 1) + (1 / k0^2) d^2 / d z^2] psi, with k0 = 2 pi f / c0, c0 = 1500 m/s and n = c0 / c(z, r). A range step of 586 m is the split step: multiply by exp(i k0 dr (n^2 - 1) / 2), transform in depth, multiply by exp(-i kz^2 dr / (2 k0)), transform back. The transforms are 256 points, a radix-2 decimation in frequency forward and a decimation in time back, so that the filter sits in bit-reversed order and nothing is reordered. The surface is a pressure release, psi = 0 at z = 0, made by an odd extension: the 128 samples at z = (j + 0.5) x 39.06 m are mirrored to 256 with the sign flipped, which makes the transform a sine transform. A filter in kz removes everything past 0.85 of the grid limit. The depth step of 39 m keeps the sound that matters, within 10 degrees of the horizontal, even at 50 Hz where the wavelength is 30 m, and the narrow-angle equation is good to about that angle.
// The sea. c(z) = c0 [1 + e (eta + exp(-eta) - 1)], eta = 2 (z - za) / 1300 m, the axis za at 1300 m and e from Knob 3: 1500 m/s on the axis and 1548 m/s at the surface. The axis drifts by 260 m on clocks of 86.9 s and 57.7 s and, with range, by 110 m over 95 km and 70 m over 57 km, sliding in time. e changes by 12 percent along the range over 130 km. Three eddies of warm or cold water, 28, 22 and 14 km wide (1/e half widths), centred at 0.6, 1.7 and 1.0 km down and up to 0.8, 0.7 and 1.0 percent in sound speed, slide through the window with periods of 71, 49 and 38 s, and four internal-wave modes of 0.2 percent, 12 to 38 km along and 0.5 to 1.7 km deep, travel through. The sound is followed over a window that slides: the first column lies at a range of 0 to about 100 km (52 km x (1 + 0.6 sin + 0.4 sin), clocks of 77.7 and 51.5 s), so the zones also slide across the panel and the source is mostly out of sight to the left.
// The source. A Gaussian beam at the source depth, with its image of opposite sign above the surface, scaled so that the sum of psi^2 over depth is 1. The beam is 4.4 degrees wide (1 sigma), breathing between 2.7 and 6.1. A source near the surface radiates little along the horizontal, since the image cancels it, and sources of 30 to 60 m at pitches under 25 Hz sent their sound steeply into the floor and left haze, so the shallowest the source gets is 100 m. The beam is why the zones vanish between 300 and 500 m: from 500 m even a ray 12 degrees up cannot reach the surface speed. A source that radiates over a wide angle would keep a weak zone to greater depth.
// The bottom. The odd extension also puts a mirror at 5 km. From 4650 m down a layer takes sound out with a quadratic ramp to 3.5e-4 per metre at the floor, which costs a ray at 10 degrees about 4 dB at a bounce and one at 3 degrees about 14 dB. Some sound comes back as bottom bounce and fills the lower panel with a pale lattice, which is why no part of the panel stays black.
// The check. Rays launched from 100 m at 1 to 5 degrees down all come back to 100 m at 60.9 to 61.3 km, their deepest points at 4.2 to 4.6 km: that is the convergence zone. The solver, with Munk's profile and no eddies, puts the loudest points under the surface at 58.0, 60.5 and 62.0 km for 12, 25 and 50 Hz, and a second zone at 117.5, 122.0 and 124.5 km. A step of 500 m gives the 25 Hz zone at 60.5 km, 250 m and finer give 60.8 km, and 1000 m gives 60.0 km, so the 586 m of the panel is converged to about 0.3 km. From the axis rays of 1 to 5 degrees cross the axis again after 25 to 30 km, which is where the bundles pinch.
// What is drawn. Three frequencies, 0.87, 1 and 1.13 times the drifting pitch, are solved one after another and their intensities added: a single frequency at 25 Hz is covered in fringes 2 to 3 LEDs wide that read as a mesh on the panel, and the sum washes them out and leaves the caustics, which do not depend on frequency. The intensity is averaged over 5 range steps (triangular) and 3 rows in depth (0.2, 0.6, 0.2), turned into decibels with 0 dB for an even spread over 1 km, and 14 dB x exp(-r / 12 km) is taken off near the source because the first arrivals were so loud that they drew a bright diagonal down the left edge. The top of the colour scale is the 97th percentile of the picture plus 4 dB and the bottom 31 to 45 dB below it (eased 25 percent a solve), the level goes through v^2, and a ramp of ink, blue, cyan, white and amber, in nine hue slices, turns it into colour. Two ripples of 6 and 5 percent in the level travel across on clocks of 31 and 17 s, plus 0.12 everywhere so that the floor is navy and not black, and the brightness swells by 10 and 7 percent. Those are the light of the water and not the sound.
// How it moves. A solve takes 6 to 10 frames at 128 range steps a frame, about 2.5 ms a frame in the Lab, and the panel crossfades linearly from the last field to the new one. The knobs are read at the start of each solve, so a turn takes 0.2 to 0.5 s to arrive on top of 0.18 s of easing. The first frame is a whole solve. Nothing is stored from one solve to the next but the scale of the level. Every driver is a sum of sines on clocks of 13 to 120 s that do not divide, so the sea does not come back and nothing builds up over 15 minutes.
// What is exact and what is not. The parabolic equation, the split step, the surface, the Munk profile and its numbers, the dependence on frequency and the zones at 61 km are physics, computed. The beam, the bottom layer, the eddies, the internal waves, the slide of the window, the average over frequency, the drift of every driver and all of the colour are drawing choices.

const W = 64, H = 128;
const { floor, sqrt, exp, sin, cos, min, max, abs, log, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ------------------------------------------------------------------ the sea
const ND = 128;            // depth samples, one per LED row
const N = 2 * ND;          // the odd extension that makes the surface a pressure release
const LG = 8;              // log2 N
const ZMAX = 5000;         // m, the bottom of the grid and of the panel
const DZ = ZMAX / ND;      // 39.06 m a row
const C0 = 1500;           // m/s, the reference speed (the speed on the axis)
const BW = 1300;           // m, the Munk scale depth
const ZAX = 1300;          // m, the axis
const EPS0 = 0.00737;      // Munk's canonical strength
const RANGE = 150000;      // m across the 64 columns
const IWA = 0.002;        // internal-wave amplitude in sound speed over c
const NSTEP = 256;         // range steps, four a column
const ZABS = 4650;         // m, where the absorbing bottom begins
const SPF = 128;            // range steps a frame
const NMAX = 190;          // steps the window can slide, 111 km
const DR = RANGE / NSTEP;  // m a step, 586
const NF = 3;              // frequencies averaged
const QF = (NSTEP * NF) / SPF; // frames to a solve, at least
const LREF = 1000;         // m, the depth over which an even spread would read 0 dB

// ------------------------------------------------------------------ fft without the bit reversal
const TWR = new Float64Array(N / 2), TWI = new Float64Array(N / 2);
for (let i = 0; i < N / 2; i++) {
  TWR[i] = cos((-TAU * i) / N);
  TWI[i] = sin((-TAU * i) / N);
}
const REV = new Uint16Array(N);
for (let i = 0; i < N; i++) {
  let r = 0;
  for (let b = 0; b < LG; b++) if (i & (1 << b)) r |= 1 << (LG - 1 - b);
  REV[i] = r;
}
// decimation in frequency: natural order in, bit reversed out
function fftF(re, im) {
  for (let len = N; len >= 2; len >>= 1) {
    const half = len >> 1, step = N / len;
    for (let i = 0; i < N; i += len) {
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half, wr = TWR[k * step], wi = TWI[k * step];
        const dr = re[a] - re[b], di = im[a] - im[b];
        re[a] += re[b];
        im[a] += im[b];
        re[b] = dr * wr - di * wi;
        im[b] = dr * wi + di * wr;
      }
    }
  }
}
// decimation in time, conjugate twiddles: bit reversed in, natural out (no 1/N: the filter carries it)
function fftI(re, im) {
  for (let len = 2; len <= N; len <<= 1) {
    const half = len >> 1, step = N / len;
    for (let i = 0; i < N; i += len) {
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half, wr = TWR[k * step], wi = -TWI[k * step];
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

const TB = 4096;
const TCOS = new Float64Array(TB), TSIN = new Float64Array(TB);
for (let i = 0; i < TB; i++) {
  TCOS[i] = cos((TAU * i) / TB);
  TSIN[i] = sin((TAU * i) / TB);
}
const NM = 4;              // internal-wave modes
const MV = [6, 9, 13, 19], ML = [38000, 26000, 17000, 12000], MT = [58.7, 41.9, 29.3, 24.1], MA = [1, 0.8, 0.7, 0.6];
const VM = [];
for (let i = 0; i < NM; i++) VM.push(new Float64Array(ND));
const EZ = new Float64Array(ND), ZC = new Float64Array(ND), GZ1 = new Float64Array(ND), GZ2 = new Float64Array(ND), GZ3 = new Float64Array(ND); // exp(-2 z / B), the depths, the depth shapes of the eddies
for (let j = 0; j < ND; j++) {
  ZC[j] = (j + 0.5) * DZ;
  EZ[j] = exp((-2 * ZC[j]) / BW);
  GZ1[j] = exp(-((ZC[j] - 600) * (ZC[j] - 600)) / (2 * 450 * 450));
  GZ2[j] = exp(-((ZC[j] - 1700) * (ZC[j] - 1700)) / (2 * 700 * 700));
  GZ3[j] = exp(-((ZC[j] - 1000) * (ZC[j] - 1000)) / (2 * 380 * 380));
  for (let i = 0; i < NM; i++) VM[i][j] = sin((PI * MV[i] * ZC[j]) / ZMAX) * exp(-ZC[j] / 1800);
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const ph = [];
  for (let i = 0; i < 40; i++) ph.push(TAU * Math.random());
  ph[0] = -0.5 * PI - 0.5 + 1.0 * Math.random(); // start with the source shallow
  ph[1] = -0.3 + 0.6 * Math.random();
  ph[2] = -0.3 + 0.6 * Math.random();
  ph[33] = -0.5 * PI + 0.1 * Math.random();
  ph[34] = -0.5 * PI + 0.1 * Math.random();
  ph[5] = 0.3 * Math.random();
  ph[6] = 0.3 * Math.random();
  ph[21] = 0.3 * Math.random();
  params.s = {
    t: 0,
    k: null,
    ph,
    re: new Float64Array(N), im: new Float64Array(N),
    vr: new Float64Array(N), vi: new Float64Array(N),
    kr: new Float64Array(N), ki: new Float64Array(N),
    ab: new Float64Array(ND),
    rec: new Float64Array((NSTEP + NMAX) * ND),
    step: 0, fi: 0, q: 0, qf: QF,
    sp: null,   // parameters of the solve in progress
    row: new Float64Array(ND), db: new Float32Array(W * H), hist: new Int32Array(240), hi: 0,
    P: new Float32Array(W * H), Q: new Float32Array(W * H), D: new Float32Array(W * H),
    lut: new Float32Array(9 * 1024 * 3),
    ready: false,
  };
}

// the drivers of the sea, all sums of sines that do not divide
function drivers(S, K) {
  const t = S.t, p = S.ph;
  // the source depth is z = 100 + 1200 u^2 m, u from the knob and a wander that carries it from near the surface to the axis
  const wz = 0.5 * sin((TAU * t) / 40.5 + p[0]) + 0.35 * sin((TAU * t) / 64.5 + p[1]) + 0.25 * sin((TAU * t) / 28.5 + p[2]);
  const u = cl(cl(K[1], 0, 4) / 4 + 0.5 * wz, 0, 1);
  const zs = 100 + 1200 * u * u;
  const f0 = 22 * Math.pow(2, 1.15 * cl(K[3], -1, 1));
  const f = f0 * (1 + 0.2 * sin((TAU * t) / 36.3 + p[3]) + 0.12 * sin((TAU * t) / 53.1 + p[4]));
  const we = 0.5 * sin((TAU * t) / 70.4 + p[5]) + 0.35 * sin((TAU * t) / 48.5 + p[6]) + 0.25 * sin((TAU * t) / 33.1 + p[21]);
  const eps = EPS0 * Math.pow(2, cl(K[2], -1, 1) + 1.3 * we);
  const za0 = ZAX + 260 * (0.6 * sin((TAU * t) / 86.9 + p[22]) + 0.4 * sin((TAU * t) / 57.7 + p[23]));
  const e1 = 0.008 * sin((TAU * t) / 93.1 + p[13]), e2 = 0.007 * sin((TAU * t) / 114.6 + p[14]), e3 = 0.01 * sin((TAU * t) / 59.2 + p[26]);
  const r0 = 52000 * (1 + 0.6 * sin((TAU * t) / 77.7 + p[33]) + 0.4 * sin((TAU * t) / 51.5 + p[34]));
  const n0 = cl(round(r0 / DR), 0, NMAX);
  const sig = (4.4 + 1.1 * sin((TAU * t) / 44.1 + p[35]) + 0.6 * sin((TAU * t) / 66.9 + p[36])) * (PI / 180);
  const wn = 38 + 4 * sin((TAU * t) / 79.3 + p[37]) + 3 * sin((TAU * t) / 37.7 + p[38]);
  return { sig, wn, n0, nTot: NSTEP + n0, r0: n0 * DR, zs, f, eps, za0, t, p, e1, e2, e3, iw: IWA * (1 + 0.5 * sin((TAU * t) / 118.3 + p[20])) };
}

function beginSolve(S, K, fi) {
  if (fi === 0) S.sp = drivers(S, K);
  const sp = S.sp;
  // the frequencies of a solve spread 13 percent either side of the drifting one
  const f = sp.f * (1 + 0.13 * (fi - (NF - 1) / 2) / ((NF - 1) / 2));
  const k0 = (TAU * f) / C0, dr = DR;
  sp.k0 = k0;
  sp.dr = dr;
  // starter: a Gaussian of the source's beam width and its mirror image, scaled to unit energy
  const w = 1 / (k0 * sp.sig), re = S.re, im = S.im;
  let e = 0;
  for (let j = 0; j < ND; j++) {
    const z = ZC[j];
    const g = exp(-((z - sp.zs) * (z - sp.zs)) / (2 * w * w)) - exp(-((z + sp.zs) * (z + sp.zs)) / (2 * w * w));
    re[j] = g;
    re[N - 1 - j] = -g;
    im[j] = 0;
    im[N - 1 - j] = 0;
    e += g * g * DZ;
  }
  const sc = 1 / sqrt(max(e, 1e-12));
  for (let j = 0; j < N; j++) re[j] *= sc;
  // kinetic step, in bit reversed order, with the low-pass and the 1/N
  const dk = TAU / (N * DZ), kmax = 0.85 * (PI / DZ);
  for (let p = 0; p < N; p++) {
    const m = REV[p], mm = m < N / 2 ? m : m - N, kz = mm * dk;
    const ph = (-kz * kz * dr) / (2 * k0), lp = abs(kz) > kmax ? 0 : 1 / N;
    S.kr[p] = lp * cos(ph);
    S.ki[p] = lp * sin(ph);
  }
  // the absorbing bottom
  const alpha0 = 3.5e-4;
  for (let j = 0; j < ND; j++) {
    const z = ZC[j];
    let a = 0;
    if (z > ZABS) {
      const q = (z - ZABS) / (ZMAX - ZABS);
      a = alpha0 * q * q;
    }
    S.ab[j] = exp(-a * dr);
  }
  S.step = 0;
}

const AM = new Float64Array(NM);
function marchSteps(S, n) {
  const sp = S.sp, re = S.re, im = S.im, vr = S.vr, vi = S.vi, kr = S.kr, ki = S.ki, ab = S.ab, rec = S.rec;
  const p = sp.p, t = sp.t, k0dr = sp.k0 * sp.dr;
  n = min(n, sp.nTot - S.step);
  for (let s = 0; s < n; s++) {
    const st = S.step, r = st * sp.dr;
    // record the intensity
    const o = st * ND;
    for (let j = 0; j < ND; j++) rec[o + j] += re[j] * re[j] + im[j] * im[j];
    // the sea at this range: the axis depth and the strength both change along the range and slide in time
    const za = sp.za0 + 110 * cos((TAU * r) / 95000 + (TAU * t) / 61.3 + p[7]) + 70 * cos((TAU * r) / 57000 - (TAU * t) / 43.9 + p[8]);
    const ep = sp.eps * (1 + 0.12 * cos((TAU * r) / 130000 + (TAU * t) / 99.7 + p[9]));
    // three eddies slide across the range, each a patch of warm or cold water
    const rc1 = RANGE * (0.5 + 0.75 * sin((TAU * t) / 71.1 + p[11])), rc2 = RANGE * (0.5 + 0.75 * sin((TAU * t) / 49.3 + p[12]));
    const rc3 = RANGE * (0.5 + 0.8 * sin((TAU * t) / 38.1 + p[25]));
    const rw = r - sp.r0, x1 = (rw - rc1) / 28000, x2 = (rw - rc2) / 22000, x3 = (rw - rc3) / 14000;
    for (let i = 0; i < NM; i++) AM[i] = sp.iw * MA[i] * cos((TAU * r) / ML[i] + (TAU * t) / MT[i] + p[15 + i]);
    const ae1 = sp.e1 * exp(-x1 * x1), ae2 = sp.e2 * exp(-x2 * x2), ae3 = sp.e3 * exp(-x3 * x3);
    const g = exp((2 * za) / BW), c1 = (-2 * za) / BW - 1;
    for (let j = 0; j < ND; j++) {
      const u = ep * (c1 + (2 * ZC[j]) / BW + g * EZ[j]) + ae1 * GZ1[j] + ae2 * GZ2[j] + ae3 * GZ3[j] + AM[0] * VM[0][j] + AM[1] * VM[1][j] + AM[2] * VM[2][j] + AM[3] * VM[3][j];
      const a1 = 1 + u, q = (1 / (a1 * a1) - 1) * 0.5;
      const idx = round(k0dr * q * (TB / TAU)) & (TB - 1);
      const m = ab[j], cr = TCOS[idx] * m, ci = TSIN[idx] * m;
      const xr = re[j], xi = im[j], yr = xr * cr - xi * ci, yi = xr * ci + xi * cr;
      re[j] = yr;
      im[j] = yi;
      re[N - 1 - j] = -yr;
      im[N - 1 - j] = -yi;
    }
    fftF(re, im);
    for (let m = 0; m < N; m++) {
      const a = re[m], b = im[m];
      re[m] = a * kr[m] - b * ki[m];
      im[m] = a * ki[m] + b * kr[m];
    }
    fftI(re, im);
    S.step = st + 1;
  }
}

// the recorded intensities of the solve → the level of each LED, 0 to 1
function finishField(S, out, first) {
  const rec = S.rec, per = NSTEP / W, row = S.row, db = S.db, hist = S.hist;
  hist.fill(0);
  for (let x = 0; x < W; x++) {
    const sc = S.sp.n0 + (x + 0.5) * per - 0.5;
    const s0 = floor(sc) - 3;
    for (let j = 0; j < ND; j++) {
      let a = 0, ws = 0;
      for (let q = s0; q < s0 + 8; q++) {
        const wq = 1 - abs(q - sc) / 2.5;
        if (wq <= 0) continue;
        const qq = cl(q, 0, S.sp.nTot - 1);
        a += wq * rec[qq * ND + j];
        ws += wq;
      }
      row[j] = a / (ws * NF);
    }
    const comp = 14 * exp((-sc * DR) / 12000); // the loud first arrivals near the source are turned down
    for (let j = 0; j < ND; j++) {
      const a = row[j > 0 ? j - 1 : 0], b = row[j], c = row[j < ND - 1 ? j + 1 : j];
      const I = 0.2 * a + 0.6 * b + 0.2 * c;
      const d = 4.3429448 * log(I * LREF + 1e-9) - comp;
      db[j * W + x] = d;
      hist[cl(floor((d + 80) * 2), 0, 239)]++;
    }
  }
  // the window follows the loud 3 percent of the picture
  let acc = 0, b = 239;
  for (; b > 0; b--) {
    acc += hist[b];
    if (acc >= 0.03 * W * H) break;
  }
  const hi = b / 2 - 80 + 4;
  S.hi = first ? hi : S.hi + (hi - S.hi) * 0.25;
  const wn = S.sp.wn, lo = S.hi - wn;
  for (let p = 0; p < W * H; p++) {
    const v = cl((db[p] - lo) / wn, 0, 1);
    out[p] = v * v;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
  } else {
    const al = 1 - exp(-d / 0.18);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  S.t += d;
  if (!S.ready) {
    // the first picture is a whole solve at once
    S.rec.fill(0);
    for (let fi = 0; fi < NF; fi++) {
      beginSolve(S, S.k, fi);
      marchSteps(S, S.sp.nTot);
    }
    finishField(S, S.Q, true);
    S.P.set(S.Q);
    S.D.set(S.Q);
    S.fi = 0;
    S.q = 0;
    S.ready = true;
    S.rec.fill(0);
    beginSolve(S, S.k, 0);
    return;
  }
  marchSteps(S, SPF);
  S.q++;
  if (S.step >= S.sp.nTot) {
    S.fi++;
    if (S.fi >= NF) {
      // a solve is done: it becomes the target, the start is what is on the panel now
      finishField(S, S.Q);
      S.P.set(S.D);
      S.qf = max(QF, S.q);
      S.q = 0;
      S.fi = 0;
      S.rec.fill(0);
    }
    beginSolve(S, S.k, S.fi);
  }
}

// ------------------------------------------------------------------ drawing
const C = [0, 0, 0];
const NHS = 9, HSTEP = 0.03; // hue slices of the palette, 0.03 of a turn apart, round the base
function buildLut(S, h0) {
  // anchors of the colour ramp: value, hue offset, saturation, brightness; the last is amber
  const A = [
    [0.0, 0.04, 0.93, 0.18],
    [0.18, 0.025, 0.92, 0.3],
    [0.4, 0.0, 0.9, 0.6],
    [0.64, -0.04, 0.82, 0.88],
    [0.8, -0.07, 0.5, 1.0],
    [0.9, -0.09, 0.14, 1.0],
    [1.0, -0.5, 0.72, 1.0],
  ];
  for (let sl = 0; sl < NHS; sl++) {
    const hb = h0 + (sl - (NHS - 1) / 2) * HSTEP;
    const cols = A.map((a) => {
      hsv(hb + a[1], a[2], a[3], C);
      return [C[0], C[1], C[2]];
    });
    const o = sl * 1024 * 3;
    for (let i = 0; i < 1024; i++) {
      const v = i / 1023;
      let k = 0;
      while (k < A.length - 2 && v > A[k + 1][0]) k++;
      const f = cl((v - A[k][0]) / (A[k + 1][0] - A[k][0]), 0, 1);
      for (let c = 0; c < 3; c++) S.lut[o + i * 3 + c] = cols[k][c] * (1 - f) + cols[k + 1][c] * f;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const t = S.t, ph = S.ph, K = S.k, h0 = 0.585 + cl(K[0], 0, 1) + 0.065 * sin((TAU * t) / 94.7 + ph[10]) + 0.04 * sin((TAU * t) / 55.3 + ph[24]);
  const gain = 1 + 0.1 * sin((TAU * t) / 107.9 + ph[31]) + 0.07 * sin((TAU * t) / 47.9 + ph[32]);
  buildLut(S, h0);
  const e = min(1, S.q / S.qf), P = S.P, Q = S.Q, D = S.D, lut = S.lut;
  hsv(h0 - 0.08, 0.25, 1, C);
  const sr = C[0], sg = C[1], sb = C[2];
  // the hue changes across the picture: a slow gradient from the surface to the deep, and two waves that travel
  const w1 = (TAU * t) / 68.5 + ph[27], w2 = -(TAU * t) / 47.7 + ph[28], w3 = (TAU * t) / 23.8 + ph[29], w4 = -(TAU * t) / 13.1 + ph[30], hm = (NHS - 1) / 2;
  for (let y = 0; y < H; y++) {
    const sf = y === 0 ? 0.8 : y === 1 ? 0.3 : 0;
    const dy = 0.05 * (y / (H - 1)) - 0.02;
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const v0 = P[p] + (Q[p] - P[p]) * e;
      D[p] = v0;
      const v = cl(v0 + 0.06 * sin(TAU * (x / 44 - y / 120) + w3) + 0.05 * sin(TAU * (x / 23 + y / 75) + w4) + 0.12, 0, 1);
      const d = dy + 0.02 * sin(TAU * (x / 52 + y / 170) + w1) + 0.015 * sin(TAU * (x / 31 - y / 110) + w2);
      const hs = cl(d / HSTEP + hm, 0, NHS - 1.001), h0i = floor(hs), hf = hs - h0i;
      const vi = (v * 1023) | 0, i1 = (h0i * 1024 + vi) * 3, i2 = i1 + 3072;
      let r = lut[i1] + (lut[i2] - lut[i1]) * hf, g = lut[i1 + 1] + (lut[i2 + 1] - lut[i1 + 1]) * hf, b = lut[i1 + 2] + (lut[i2 + 2] - lut[i1 + 2]) * hf;
      if (sf > 0) {
        r = r * (1 - sf) + sr * sf;
        g = g * (1 - sf) + sg * sf;
        b = b * (1 - sf) + sb * sf;
      }
      display.setPixel(x, y, min(255, (r * gain * 255) | 0), min(255, (g * gain * 255) | 0), min(255, (b * gain * 255) | 0));
    }
  }
}
