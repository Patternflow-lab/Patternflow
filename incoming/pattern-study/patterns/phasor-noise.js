// ===== Patternflow pattern =====
// Title:   Phasor Noise
// Family:  noise
// Idea:    One set of Gabor kernels, little wave packets turned by a field with a whirl and a saddle drifting through it, is summed into a complex field and shown twice: on top as Gabor noise, its imaginary part, whose stripes fade to flat wherever the kernels cancel, and below as phasor noise, a profile of its phase alone, the same curving bands at full contrast everywhere and broken only at the points where the sum is zero.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: phasor noise (Thibault Tricard, Semyon Efremov, Cédric Zanni, Fabrice Neyret, Jonàs Martínez and Sylvain Lefebvre, Procedural phasor noise, 2019), built on sparse convolution Gabor noise (Ares Lagae, Sylvain Lefebvre, George Drettakis and Philip Dutré, Procedural noise using sparse Gabor convolution, 2009); pattern round 82
// Round:   82
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Frequency=8..11, Profile=0..1
//
// Knob 1: Hue. Turns the colours round the wheel. Each band takes its colour from the way it runs: at 0 level bands are sea green, slanting ones azure and upright ones violet.
// Knob 2: Speed. At 2 the bands travel one period every 3.3 s, each kernel circles its place every 9 s and the direction field turns once in 50 s; all of it goes as Speed / 2.
// Knob 3: Frequency. Stripes across the 64 LEDs of the panel: 8 is a period of 8 LEDs, 11 a period of 5.8. The kernels keep their size, 6.5 LEDs to one standard deviation, so at 11 each holds 1.4 times as many stripes.
// Knob 4: Profile. The wave the phase is drawn with in the lower half, blended between a sine at 0, a triangle at 0.33, a square at 0.67 and a sawtooth at 1, whose sharp side shows which way each band's phase runs. The upper half is Gabor noise at every setting.

// A Gabor kernel is a Gaussian times a complex plane wave,
//
//   g_i(x) = exp(-|x - x_i|^2 / (2 s^2)) exp(i (k_i . (x - x_i) + phi_i)),
//
// and the sum G(x) of a few hundred of them, scattered on a jittered grid,
// is complex noise with the frequency and orientation of its kernels. Lagae
// and his co-authors showed Im G, Gabor noise: wherever the kernels around a
// point happen to cancel, |G| is small and the stripes fade out. Tricard and
// his co-authors kept the phase and threw the amplitude away, profile(arg G):
// stripes of one contrast everywhere, with the same orientation and period,
// broken only where G = 0, the points the phase winds round. Both halves of
// the panel here are the same 64 x 63 window of the same G, so every place
// the upper stripes fade to flat is a fork or an end in the lower ones.
//
// The kernel direction comes from a field with a whirl and a saddle in it,
// theta = theta0 + the angle round the whirl - the angle round the saddle.
// Round the whirl the wave vectors point outwards (rings), across (spokes)
// or in between (spirals) as theta0 turns; spokes and spirals spread apart
// as they go out, and phasor noise can only keep its period by forking.
//
// Each kernel is separable, the Gaussian and the wave both, so it is two
// short complex rows, one along x and one along y, multiplied pixel by pixel.

const W = 64, H = 128, FH = 63, LOW = 65;
const { floor, min, max, round, sqrt, sin, cos, exp, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Kernel size and reach in LEDs, and the grid the kernels sit on.
const SIG = 6.5, R = 18, STEP = 8;

function hsv(h, s, v, o, k) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[k] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[k + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[k + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const ks = [];
  for (let y = -R; y < FH + R; y += STEP)
    for (let x = -R; x < W + R; x += STEP)
      ks.push({
        hx: x + (Math.random() - 0.5) * STEP * 0.8,
        hy: y + (Math.random() - 0.5) * STEP * 0.8,
        ph: Math.random() * TAU,
        wa: Math.random() * TAU,
        wr: 0.8 + 1.2 * Math.random(),
        ws: Math.random() < 0.5 ? -1 : 1,
        cx: 0, cy: 0, kx: 0, ky: 0,
      });
  params.s = {
    ks, t: 0, hue: 0, freq: 8, prof: 0.06,
    gr: new Float32Array(W * FH), gi: new Float32Array(W * FH), u: [0, 0], th: new Float32Array(W * FH),
    xr: new Float32Array(2 * R + 2), xi: new Float32Array(2 * R + 2), out: new Float32Array(W * H * 3),
  };
}

// A whirl and a saddle, each on a slow loop of its own.
function poles(t) {
  return [24 + 8 * sin(0.071 * t), 20 + 6 * cos(0.053 * t + 1), 40 + 8 * sin(0.062 * t + 2), 46 + 6 * cos(0.047 * t + 0.5)];
}

// The kernel direction at (x, y) as a unit complex number,
// e^(i theta0) (z - whirl) / |z - whirl| times the conjugate for the saddle.
function dir(P, c0, s0, x, y, o) {
  const ar = x - P[0], ai = y - P[1], br = x - P[2], bi = -(y - P[3]);
  const pr = ar * br - ai * bi, pi = ar * bi + ai * br;
  const qr = pr * c0 - pi * s0, qi = pr * s0 + pi * c0, m = sqrt(qr * qr + qi * qi) || 1;
  o[0] = qr / m;
  o[1] = qi / m;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 8, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.freq = cl(k[2] == null ? 8 : k[2], 8, 11);
  S.prof = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.t += (d * speed) / 2;
}

function field(S) {
  const t = S.t, P = poles(t), th0 = (TAU * t) / 50 + 0.4, c0 = cos(th0), s0 = sin(th0), kk = (TAU * S.freq) / W;
  const { gr, gi, xr, xi, u } = S;
  gr.fill(0);
  gi.fill(0);
  const a = 1 / (2 * SIG * SIG), drift = (TAU * t) / 3.3;
  for (const K of S.ks) {
    const w = ((TAU * t) / 9) * K.ws + K.wa;
    const cx = K.hx + K.wr * cos(w), cy = K.hy + K.wr * sin(w);
    dir(P, c0, s0, cx, cy, u);
    const kx = kk * u[0], ky = kk * u[1];
    const x0 = max(0, Math.ceil(cx - R)), x1 = min(W - 1, floor(cx + R));
    const y0 = max(0, Math.ceil(cy - R)), y1 = min(FH - 1, floor(cy + R));
    if (x0 > x1 || y0 > y1) continue;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, e = exp(-a * dx * dx), p = kx * dx;
      xr[x - x0] = e * cos(p);
      xi[x - x0] = e * sin(p);
    }
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy, e = exp(-a * dy * dy), p = ky * dy + K.ph - drift;
      const yr = e * cos(p), yi = e * sin(p);
      let o = y * W + x0;
      for (let x = x0; x <= x1; x++, o++) {
        const ar = xr[x - x0], ai = xi[x - x0];
        gr[o] += ar * yr - ai * yi;
        gi[o] += ar * yi + ai * yr;
      }
    }
  }
  // cos 2 theta at every LED, which way its stripes run, for the colour.
  const T = S.th;
  for (let y = 0, o = 0; y < FH; y++)
    for (let x = 0; x < W; x++, o++) {
      dir(P, c0, s0, x, y, u);
      T[o] = u[0] * u[0] - u[1] * u[1];
    }
}

// Brightness of a band at height v of its wave; the lowest seventh is black.
const lum = (v) => (v < 0.14 ? 0 : ((v - 0.14) / 0.86) ** 2);

// The wave drawn from the phase: 1 on the crest of sin, 0 in the trough.
function profile(ph, m) {
  const s = 0.5 + 0.5 * sin(ph);
  if (m <= 0) return s;
  let u = ph / TAU - 0.25;
  u -= floor(u);
  const tri = Math.abs(2 * u - 1), sq = cl(0.5 + 2.6 * sin(ph), 0, 1), saw = 1 - u;
  const z = m * 3, i = min(2, floor(z)), f = z - i;
  const A = [s, tri, sq, saw];
  return A[i] + (A[i + 1] - A[i]) * f;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  field(S);
  const { gr, gi, out } = S, n = W * FH;
  let e = 0;
  for (let i = 0; i < n; i++) e += gr[i] * gr[i] + gi[i] * gi[i];
  const rms = sqrt(e / n) || 1, hb = S.hue + 0.55;
  out.fill(0);
  for (let i = 0; i < n; i++) {
    const h = hb + 0.16 * S.th[i];
    const g = cl(gi[i] / (1.5 * rms), -1, 1) * 0.5 + 0.5;
    const p = profile(atan2(gi[i], gr[i]), S.prof);
    hsv(h, 0.75 - 0.35 * g, lum(g), out, i * 3);
    hsv(h, 0.75 - 0.35 * p, lum(p), out, (i + LOW * W) * 3);
  }
  for (let i = 0; i < W * H; i++) display.setPixel(i % W, floor(i / W), round(out[i * 3] * 255), round(out[i * 3 + 1] * 255), round(out[i * 3 + 2] * 255));
}
