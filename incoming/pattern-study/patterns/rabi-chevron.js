// ===== Patternflow pattern =====
// Title:   Rabi Chevron
// Family:  wave
// Idea:    Every column is a two-level atom driven at its own detuning, every row a pulse length, and the brightness the chance of finding the atom excited, so Rabi's formula draws its chevron: on resonance in the middle the population swings all the way up and back four times down each sweep, while off resonance it swings faster and less deep, bending the fringes into nested V's that stream up the panel as the sweep of pulse lengths repeats.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Rabi oscillations (Isidor Isaac Rabi, 1937), pattern round 77
// Round:   77
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Span=0..1, Damping=0..1
//
// Knob 1: Hue. Turns the colour ramp round the wheel. At 0 the ground state is deep indigo and the ramp climbs through teal and green to a pale yellow at full excitation, the way a physics plot would draw it; at 0.15 the ground turns violet and the top green, and at 0.5 the ramp runs from a dark brown through red and magenta to periwinkle.
// Knob 2: Speed. How fast the sweep runs: 16 rows a second for each unit, so 32 at the opening 2. A row is a twentieth of the Rabi period on resonance, so the middle columns swing 1.6 times a second and the 80 rows of one sweep pass in 2.5 s; 3.2 rows a second at 0.2, 48 at 3.
// Knob 3: Span. The detuning at the panel's left and right edges, from 2.5 times the Rabi frequency at 0 to 5 times at 1. At the opening 2.5 the edge columns swing 2.69 times as fast as the middle and only 14% of the way up; at 5, 5.1 times as fast and 4% of the way, and the chevron narrows to a spike.
// Knob 4: Damping. Dephasing at the rate 0.6 Damping^2 times the Rabi frequency, which pulls each swing towards its mean. At the opening 0.06 a sweep keeps 95% of its depth to the end; at 0.3 the last fringes keep 26%, at 0.5 2%, and at 1 every column settles within one period to half its peak, so the panel shows the power-broadened Lorentzian line, a soft column 2 Rabi frequencies wide.

// A two-level atom starts in its ground state and is driven by a field of
// Rabi frequency Omega, detuned by Delta from the transition. Rabi worked
// out in 1937, for a spin in a steady magnetic field with a weak second
// field turning round it, that after a time t the chance of finding it
// flipped is
//
//   P(Delta, t) = Omega^2 / (Omega^2 + Delta^2) sin^2(W t / 2),
//   W = sqrt(Omega^2 + Delta^2).
//
// On resonance it swings all the way to 1 and back at Omega. Detuned, it
// swings faster, at the generalised Rabi frequency W, and never higher than
// Omega^2 / W^2, a Lorentzian in Delta. Plotted against detuning and pulse
// length the fringes are the curves W t = 2 pi n, hyperbolas that sit flat
// for short pulses and bend into ever deeper V's for long ones: the chevron
// that experiments on qubits and trapped ions measure to find the resonance
// and the length of a pi pulse.
//
// Here x is Delta, from -D to +D in units of Omega (D = 2.5 to 5 by Span),
// and y is the pulse length, a sweep of 80 rows from Omega t = 0 to 8 pi
// (four full swings on resonance). The sweeps follow one another down the
// panel like the repeated scans of a real experiment, and the whole record
// scrolls up, so every LED sees the fringes run past it: a new sweep comes
// in at the bottom, dark for the shortest pulses, and the seam where the
// last one ends and the next begins rises with it. The swing is damped by
// exp(-gamma t) about its mean, P = A (1 - exp(-gamma t) cos W t) / 2, a
// plain dephasing envelope rather than the full Bloch equations. Brightness
// follows P^0.7 so the faint, fast fringes far off resonance still show.

const W = 64, H = 128;
const { floor, round, sqrt, exp, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = 2 * PI;

// Rows to one Rabi period on resonance, and periods in one sweep.
const P0 = 20, NP = 4, LS = P0 * NP;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  params.s = { g: 0, hue: 0, speed: 2, D: 2.5, gam: 0, lut: new Uint8Array(257 * 3), lh: -1, c: [0, 0, 0] };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.D = 2.5 + 2.5 * cl(k[2] || 0, 0, 1);
  const dm = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.gam = 0.6 * dm * dm;
  S.g += d * S.speed * 16;
  if (S.g > LS * 1000) S.g -= LS * 1000;
}

function ramp(S) {
  if (S.lh === S.hue) return;
  S.lh = S.hue;
  for (let i = 0; i <= 256; i++) {
    const p = Math.pow(i / 256, 0.7);
    hsv(S.hue + 0.66 - 0.5 * p, 0.95 - 0.35 * p * p, 0.13 + 0.87 * p, S.c);
    S.lut[i * 3] = round(S.c[0] * 255);
    S.lut[i * 3 + 1] = round(S.c[1] * 255);
    S.lut[i * 3 + 2] = round(S.c[2] * 255);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  ramp(S);
  const L = S.lut, D = S.D, gam = S.gam;
  for (let y = 0; y < H; y++) {
    const g = y + S.g, ph = g - floor(g / LS) * LS, t = (ph / P0) * TAU, e = exp(-gam * t);
    for (let x = 0; x < W; x++) {
      const dl = ((x - 31.5) / 32) * D, r2 = 1 + dl * dl, wr = sqrt(r2);
      const P = (0.5 / r2) * (1 - e * cos(wr * t));
      const i = round(P * 256) * 3;
      display.setPixel(x, y, L[i], L[i + 1], L[i + 2]);
    }
  }
}
