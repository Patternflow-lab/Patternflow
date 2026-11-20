// ===== Patternflow pattern =====
// Title:   Orientation Columns
// Family:  cortex
// Idea:    A flattened patch of visual cortex coloured by the orientation each column prefers, so that thirty pinwheels meet every hue at a point, lit by a stimulus that turns and so wakes the columns of one hue after another across the whole panel while the map itself slowly drifts.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: orientation columns in cat and monkey cortex (David Hubel and Torsten Wiesel, 1962 and 1968), the pinwheel map seen by optical imaging (Gary Blasdel and Guy Salama, 1986; Tobias Bonhoeffer and Amiram Grinvald, 1991), the map as bandpass-filtered complex noise (Michael Rojer and Eric Schwartz, 1990; Fred Wolf and Theo Geisel, 1998; from memory), one pinwheel per Lambda^2 / pi of cortex (Matthias Kaschube and others, 2010; from memory), pattern round 201
// Round:   203
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sweep=0..4, Tuning=-1..1, Column=-1..1
//
// Knob 1: Hue. Turns the colour wheel round the whole map: the stimulus wakes the same columns, but each is painted a hue further on, a full turn from the bottom of the knob to the top.
// Knob 2: Sweep. How fast the stimulus turns through the orientations: still at the bottom, a full turn through every hue in about 11 s on average where the knob opens and 6 s at the top, and the rate wanders, stalling or backing up now and then at any setting.
// Knob 3: Tuning. How sharply a column answers: at the bottom a wide band of hues is lit at once and the map washes bright, in the middle about a fifth of the columns, at the top only the few that match the stimulus exactly.
// Knob 4: Column. The width of one hypercolumn, the distance round which every orientation repeats: 18 LED at the bottom, 28 where the knob opens, 43 at the top, and the map zooms smoothly about the centre.

const W = 64;
const H = 128;
const J = 24; // plane waves in the map
const { sqrt, exp, cos, sin, atan2, floor, PI, min, max, log } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  // J plane waves of one wavelength, directions spread round the whole circle with a jitter
  // so no direction is missing, each with a random phase and its own drift rate. The map is
  // z = sum_j exp(i (k_j . x + phi_j(t))); its argument over two is the preferred orientation
  // and its zeros are the pinwheel centres.
  const dir = new Float32Array(J), ph = new Float32Array(J), om = new Float32Array(J);
  for (let j = 0; j < J; j++) {
    dir[j] = (TAU * (j + 0.9 * (Math.random() - 0.5))) / J;
    ph[j] = TAU * Math.random();
    // Each wave drifts at its own rate, 0.12 to 0.4 rad/s either way, so no two share a period.
    om[j] = (Math.random() < 0.5 ? -1 : 1) * (0.12 + 0.28 * Math.random());
  }
  params.s = {
    t: 0, psi: 4.59, hue: 0, sweep: 2, kappa: 3, lam: 28, lamT: 28,
    dir, ph, om,
    rxr: new Float32Array(J * W), rxi: new Float32Array(J * W),
    cyr: new Float32Array(J * H), cyi: new Float32Array(J * H),
    c: [0, 0, 0], first: true,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.t += dt;
  S.hue = k[0];
  S.sweep = cl(k[1], 0, 4);
  S.kappa = 3 * 3 ** cl(k[2], -1, 1);
  S.lamT = 28 * 1.55 ** cl(k[3], -1, 1);
  if (S.first) { S.lam = S.lamT; S.first = false; }
  S.lam += (S.lamT - S.lam) * (1 - exp(-dt * 3.5));
  // The stimulus turns at a rate that wanders: three sines that never line up, with a mean
  // that keeps it going forward most of the time and a swing that sometimes stalls or reverses it.
  const t = S.t;
  const r = 0.55 + 0.6 * sin(0.0517 * t + 0.7) + 0.32 * sin(0.1303 * t + 2.1) + 0.16 * sin(0.3319 * t);
  S.psi += dt * S.sweep * 0.5 * r;
  for (let j = 0; j < J; j++) S.ph[j] += dt * S.om[j];
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { dir, ph, rxr, rxi, cyr, cyi, c } = S;
  const kk = TAU / S.lam, hx = (W - 1) / 2, hy = (H - 1) / 2;
  // Separable plane waves: exp(i k.x) = exp(i kx x) exp(i ky y), the phase carried by the row factor.
  for (let j = 0; j < J; j++) {
    const kx = kk * cos(dir[j]), ky = kk * sin(dir[j]);
    for (let x = 0; x < W; x++) {
      const a = kx * (x - hx) + ph[j];
      rxr[j * W + x] = cos(a);
      rxi[j * W + x] = sin(a);
    }
    for (let y = 0; y < H; y++) {
      const a = ky * (y - hy);
      cyr[j * H + y] = cos(a);
      cyi[j * H + y] = sin(a);
    }
  }
  // The stimulus answers a column by cos(arg z - psi): 1 where the column prefers it, -1 at right angles.
  const cp = cos(S.psi), sp = sin(S.psi), kap = S.kappa, t = S.t;
  const norm = 1 / sqrt(J);
  const s1 = 0.011 * t, s2 = 0.0083 * t;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let re = 0, im = 0;
      for (let j = 0; j < J; j++) {
        const a = rxr[j * W + x], b = rxi[j * W + x], cc = cyr[j * H + y], d = cyi[j * H + y];
        re += a * cc - b * d;
        im += a * d + b * cc;
      }
      const m = sqrt(re * re + im * im);
      const mn = m * norm;
      // Selectivity: columns near a pinwheel centre (z near 0) answer weakly and to everything.
      const sel = 1 - exp(-((mn / 0.42) ** 2));
      const ang = atan2(im, re);
      const cs = m > 1e-6 ? (re * cp + im * sp) / m : 0;
      const resp = exp(kap * sel * (cs - 1));
      // A slow field of spontaneous activity over the whole cortex.
      const sp2 = 0.88 + 0.12 * sin(0.21 * x + 0.12 * y + s1 * 7) * sin(0.09 * y - 0.17 * x + s2 * 9);
      const v = (0.3 + 0.7 * (sel * resp + (1 - sel) * 0.3)) * sp2;
      hsv(ang / TAU + S.hue + 0.82, 0.42 + 0.58 * sel, cl(v, 0, 1), c);
      // Blue and red carry far less light than green at the same HSV value, so lift them toward an even luma;
      // otherwise the columns that are not lit read as black wherever the hue is blue.
      const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] + 0.02;
      const f = 1 + cl(0.6 * (0.5 * v / l - 1), -0.2, 1.2) * (1 - sel * resp), mx = max(c[0], c[1], c[2]);
      const g = mx * f > 1 ? 1 / mx : f;
      c[0] *= g; c[1] *= g; c[2] *= g;
      display.setPixel(x, y, 255 * c[0], 255 * c[1], 255 * c[2]);
    }
  }
}
