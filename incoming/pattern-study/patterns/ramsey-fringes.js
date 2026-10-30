// ===== Patternflow pattern =====
// Title:   Ramsey Fringes
// Family:  wave
// Idea:    Every row is a two-level atom at its own detuning and every column a longer dark gap between two short pulses, so Ramsey's formula fans out into hyperbolic fringes that open from the single-pulse line on the left and close in on resonance to the right, a central fringe 2.9 rows from crest to dark at the right edge inside a pedestal that fills the panel, while the relative phase of the two pulses slides every fringe on by one place each turn.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ramsey's method of separated oscillatory fields (Norman F. Ramsey, 1950), pattern round 79
// Round:   79
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Free=-1..1, Pulse=0..1
//
// Knob 1: Hue. Turns the colour ramp round the wheel. At 0 an atom left in its ground state is deep violet and the ramp climbs through rose to a pale peach at full excitation; at 0.5 it runs from a dark green to a pale azure.
// Knob 2: Speed. How fast the phase of the second pulse turns against the first: 0.17 turns a second for each unit, so one turn in 2.9 s at the opening 2, 29 s at 0.2 and 2 s at 3. Each turn moves every fringe on by one place.
// Knob 3: Free. The longest free time, at the right edge: 22 over the Rabi frequency at the opening 0, the length of 14 pi/2 pulses, and 1.5 times shorter or longer at the ends (9.3 and 21). At the opening the central fringe at the right edge falls from its crest to dark in 2.9 rows, while the pedestal falls off to a crest of P = 0.04 at the top and bottom rows; at 1 the central fringe takes 1.9 rows and the fringes crowd towards the right.
// Knob 4: Pulse. The area of each pulse, from the optimal pi/2 at 0 to pi at 1; the opening 0.06 is 0.53 pi. At 0.5 the fringes lose half their depth on resonance, and at pi the two pulses flip the atom and flip it back whatever the gap, so the middle row stays dark and the fringes live only in two lobes above and below.

// In Rabi's method the atom crossed one oscillating field, and the width of
// the line was set by the time it spent in it. Ramsey split the field in
// two: a short pulse of length tau, a free time T with no field at all, and
// a second short pulse. During the free time the atom's superposition keeps
// the phase of its own transition while the field keeps the phase of the
// oscillator, and the second pulse turns their difference Delta T into
// population. With Rabi frequency Omega, detuning Delta and
// W = sqrt(Omega^2 + Delta^2), the chance of finding the atom excited is
//
//   P = 4 (Omega/W)^2 sin^2(W tau/2)
//       [cos(W tau/2) cos(chi/2) - (Delta/W) sin(W tau/2) sin(chi/2)]^2,
//   chi = Delta T - phi,
//
// where phi is the phase of the second pulse against the first. The bracket
// is one sinusoid in chi/2, R cos(chi/2 + beta), so P swings between 0 and
// a crest set by the pulses alone: the pedestal, whose width is set by the
// short pulses, about 1/tau. The fringes on top of it are spaced 2 pi / T
// in detuning, so the longer the free time, the narrower the central
// fringe. With pulses of area Omega tau = pi/2 the crest on resonance
// reaches 1.
//
// Here the rows are the detuning, from +3.2 Omega at the top to -3.2 Omega
// at the bottom, 0.05 Omega a row, and the columns the free time, from 0 at
// the left to Tmax at the right. At T = 0 and phi = 0 the two pulses are
// one pulse of area pi, and the left column is Rabi's line for it. The
// fringes are the curves Delta T = phi + 2 pi n, hyperbolas that run out of
// the left edge and crowd towards the middle row. On resonance chi does not
// depend on T, so the middle rows are one even colour that brightens and
// darkens as phi turns, while every other row runs through its fringes
// along the free time.
//
// Brightness is a triangle wave of the fringe phase chi/2 + beta: dark where
// P is 0, and at the crest the polar angle of the atom's Bloch vector there,
// 2 asin(sqrt(Pmax)), as a share of pi. With pi/2 pulses on resonance that
// is the Bloch angle exactly at every LED, since P = cos^2 makes
// asin(sqrt(P)) a straight ramp; elsewhere the triangle keeps the crest and
// the zeros and draws a straight ramp between them. So every fringe rises
// and falls at one even slope instead of the sharp-bottomed sin^2.

const W = 64, H = 128;
const { floor, round, sqrt, sin, cos, asin, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = 2 * PI;

// Detuning at the top and bottom rows, and the longest free time at the
// opening, both in units of the Rabi frequency.
const DMAX = 3.2, T0 = 22;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  params.s = {
    phi: 0, hue: 0, speed: 2, tmax: T0, area: PI / 2,
    crest: new Float32Array(H), beta: new Float32Array(H),
    lut: new Uint8Array(257 * 3), lh: -1, c: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.tmax = T0 * Math.pow(1.5, cl(k[2] || 0, -1, 1));
  S.area = (PI / 2) * (1 + cl(k[3] == null ? 0.06 : k[3], 0, 1));
  S.phi += d * S.speed * 0.17 * TAU;
  if (S.phi > TAU * 1000) S.phi -= TAU * 1000;
}

// Violet ground, rose in the middle, pale peach at full excitation.
function ramp(S) {
  if (S.lh === S.hue) return;
  S.lh = S.hue;
  for (let i = 0; i <= 256; i++) {
    const p = i / 256;
    hsv(S.hue + 0.72 + 0.38 * p, 0.9 - 0.55 * p * p * p, 0.08 + 0.92 * p, S.c);
    S.lut[i * 3] = round(S.c[0] * 255);
    S.lut[i * 3 + 1] = round(S.c[1] * 255);
    S.lut[i * 3 + 2] = round(S.c[2] * 255);
  }
}

const dlOf = (y) => (DMAX * (63.5 - y)) / 64;

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  ramp(S);
  const L = S.lut, tau = S.area;
  // Per row the pulses fix the crest (as a Bloch angle over pi) and the
  // phase beta they add to the fringes.
  for (let y = 0; y < H; y++) {
    const dl = dlOf(y), w = sqrt(1 + dl * dl), a = (w * tau) / 2, sa = sin(a), ca = cos(a), b = (dl / w) * sa;
    const r = (2 / w) * sa * sqrt(ca * ca + b * b);
    S.crest[y] = (2 / PI) * asin(cl(r < 0 ? -r : r, 0, 1));
    S.beta[y] = atan2(b, ca);
  }
  for (let y = 0; y < H; y++) {
    const A = S.crest[y], dl = dlOf(y), be = S.beta[y];
    for (let x = 0; x < W; x++) {
      const T = (S.tmax * x) / (W - 1);
      // The fringe phase in half turns, folded to the nearest crest.
      let u = ((dl * T - S.phi) / 2 + be) / PI;
      u -= floor(u + 0.5);
      const i = round(A * (1 - 2 * (u < 0 ? -u : u)) * 256) * 3;
      display.setPixel(x, y, L[i], L[i + 1], L[i + 2]);
    }
  }
}
