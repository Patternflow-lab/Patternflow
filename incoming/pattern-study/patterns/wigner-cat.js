// ===== Patternflow pattern =====
// Title:   Wigner Cat
// Family:  wave
// Idea:    The Wigner function of light in a Kerr medium glows on a slowly turning phase plane, warm where it is positive and cool where it is negative, as one coherent lump splits at the fractional revivals into Schrodinger cats of 2, 3 and 4 lumps round a circle with bands of interference fringes between every pair, shears through a rosette into one lump on the far side at half the revival time and comes back down the sequence.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Wigner quasi-probability function (Eugene Wigner, 1932), the two-lump cat of a Kerr medium (Bernard Yurke and David Stoler, 1986), its cats of n lumps at the fractional revivals (K. Tara, G. S. Agarwal and S. Chaturvedi, 1993), Husimi's Q function as a smoothed Wigner function (Kodi Husimi, 1940), pattern round 59
// Round:   59
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Decoherence=0..1, Amplitude=2..3.2
//
// Knob 1: Hue. Turns both signs round the wheel together. At 0 the positive lumps and fringes are rose with pale peaks and the negative fringes azure; at 0.25 lime and violet, at 0.5 aqua and orange, at 0.75 violet and green.
// Knob 2: Speed. At 2 the phase plane turns once in 24 seconds, and the Kerr clock holds each cat 3.2 seconds, each single lump 1.6, and takes 1.3 to move on, so the cycle 1, 2, 3, 4, far lump, 4, 3, 2 takes 33 seconds and starts each time at a new angle; at 0.2 all of it runs ten times slower, at 3 half as fast again.
// Knob 3: Decoherence. Random Gaussian kicks to the field, of variance s2 = 0.5 x knob^2 in x and in p, which smooths W with a Gaussian of that variance. At 0 the state is pure and the 2-lump cat's fringes swing to 1.9 times the lump height either side of zero; at 0.25 they keep 61% of that and the lumps 94% of theirs, at 0.5 the fringes keep 14% and the lumps 80%. At 1 the variance is the vacuum's own, W has become Husimi's Q function and is nowhere negative: lumps alone, twice as wide.
// Knob 4: Amplitude. |alpha| of the starting coherent state, 2 to 3.2, a mean of 4 to 10 photons. The plane is scaled to keep the circle on the panel: at 2 a lump is 14 LEDs wide and 28 tall to 1/e, the 2-lump cat's fringes 8 columns or 16 rows apart, and the cats run to 4 lumps; at 3.2 a lump is 10 wide, the fringes 3.5 columns apart, and the cats run to 7 lumps before the far lump.

const W = 64, H = 128, NF = 36;
// Rows per column for one unit of p against one of x: the phase plane is
// drawn twice as tall as wide, an oscillator whose orbits are 1:2 ellipses.
const STRETCH = 2;
// At Speed 2: one turn of the plane, the hold at a stop and the move between stops, in seconds.
const TURN = 24, HOLD = 3.2, MOVE = 1.3;
const LMAX = 168, GAMMA = 1.35, TOP = 0.72, HUE_POS = 0.985, HUE_NEG = 0.57;
const { floor, ceil, min, max, abs, sqrt, exp, cos, sin, asin, PI, SQRT2 } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// Units: x = (a + a^dagger)/sqrt2, p = (a - a^dagger)/(i sqrt2), hbar = 1,
// so the coherent state |alpha> sits at x = sqrt2 Re alpha, p = sqrt2 Im
// alpha and its Wigner function is exp(-(x - x0)^2 - (p - p0)^2) / pi.
//
// The grid, rebuilt when the amplitude changes: column i is x_i = (i -
// 31.5) h, row r is p_r = (63.5 - r) h / STRETCH. The Wigner transform
//   W(x, p) = (1/pi) Int psi*(x + y) psi(x - y) e^(2ipy) dy
// is summed over y_j = j h, which puts x +- y on the same grid of columns,
// extended J columns each side. A sum with step h repeats W every pi / h
// in p, 16 or more, where W has long died away, so it is exact.
function build(S, a) {
  S.a = a;
  const X0 = SQRT2 * a, kx = 31 / (X0 + 1.55), h = 1 / kx;
  // psi ~ exp(-(x - x0)^2 / 2) has fallen to 3e-4 four units out.
  const J = ceil((X0 + 4) * kx), G = W + 2 * J;
  S.kx = kx;
  S.h = h;
  S.J = J;
  S.G = G;
  // Hermite functions phi_k(x) by their three-term recurrence.
  const phi = (S.phi = new Float64Array(NF * G));
  for (let m = 0; m < G; m++) {
    const x = (m - J - 31.5) * h;
    let p0 = PI ** -0.25 * exp((-x * x) / 2), p1 = SQRT2 * x * p0;
    phi[m] = p0;
    phi[G + m] = p1;
    for (let k = 1; k + 1 < NF; k++) {
      const p2 = sqrt(2 / (k + 1)) * x * p1 - sqrt(k / (k + 1)) * p0;
      phi[(k + 1) * G + m] = p2;
      p0 = p1;
      p1 = p2;
    }
  }
  // |<k|alpha>| = e^(-|alpha|^2/2) alpha^k / sqrt(k!).
  const amp = (S.amp = new Float64Array(NF));
  amp[0] = exp((-a * a) / 2);
  for (let k = 1; k < NF; k++) amp[k] = (amp[k - 1] * a) / sqrt(k);
  // cos and sin of 2 p_r y_j.
  const J1 = J + 1;
  S.C = new Float32Array(H * J1);
  S.Sn = new Float32Array(H * J1);
  for (let r = 0; r < H; r++) {
    const p = ((63.5 - r) * h) / STRETCH;
    for (let j = 0; j < J1; j++) {
      const t = 2 * p * j * h;
      S.C[r * J1 + j] = cos(t);
      S.Sn[r * J1 + j] = sin(t);
    }
  }
  S.pr = new Float64Array(G);
  S.pi = new Float64Array(G);
  S.gr = new Float64Array(J1);
  S.gi = new Float64Array(J1);
  S.damp = new Float64Array(J1);
  S.s2 = -1;
  // How many cats before the far lump: lumps 2 alpha sin(pi/n) apart, at
  // least five of their own standard deviations (1/2 in units of alpha).
  // Closer than that the fringes of neighbours run over the lumps and the
  // cat reads as a rosette; those cats still pass on the way to u = 1/2.
  S.N = cl(floor(PI / asin(min(1, 1.25 / a))), 3, 8);
  S.k = min(S.k, 2 * S.N - 1);
}

// The Kerr clock. Under H = K n^2 the coherent state picks up the phase
// e^(-i K t k^2) on |k>. At K t = 2 pi m / q that phase is periodic in k
// with period q, so it is a finite Fourier sum and the state is a sum of
// coherent states round the circle: Yurke and Stoler's cats. At u = K t /
// 2 pi = (n - 1) / (2n) exactly n of the coefficients are non-zero, so the
// stops u = 0, 1/4, 1/3, 3/8, 2/5 ... hold cats of 1, 2, 3, 4, 5 lumps;
// they crowd towards u = 1/2, where e^(-i pi k^2) = (-1)^k is the single
// lump at -alpha, and the mirror stops 1 - u bring them back to the full
// revival at u = 1.
//
// For such a sum psi = sum_j b_j |alpha_j> the Wigner function has a closed
// form, from W(beta) = (2/pi) <psi| D(beta) (-1)^n D(beta)^dagger |psi>:
//   W(beta) = (2/pi) sum_jk b_j* b_k <alpha_j|alpha_k> e^(-2 (beta - alpha_j)* (beta - alpha_k)),
// beta = (x + ip)/sqrt2, a Gaussian lump for j = k and a Gaussian times
// fringes for j != k. The transform below works at every u, between the
// cats too, and at the cats it agrees with this sum to 2e-7.
function stopU(N, k) {
  if (k <= 0 || k >= 2 * N) return k <= 0 ? 0 : 1;
  if (k < N) return k / (2 * (k + 1));
  if (k === N) return 0.5;
  const n = 2 * N - k + 1;
  return 1 - (n - 1) / (2 * n);
}

export function setup(params) {
  params.s = {
    a: -1, k: 1, ph: HOLD - 1.2, th: 0.6, u: 0.25, wref: 0,
    Wg: new Float32Array(W * H), tmp: new Float32Array(W), cr: new Float64Array(NF), ci: new Float64Array(NF),
    pos: [0, 0, 0], neg: [0, 0, 0], hue: -1,
  };
}

// The Fock coefficients at Kerr time u, turned by th: the free oscillator
// adds e^(-i th k), which turns the whole plane clockwise.
function kerr(S, u, th) {
  const { amp, cr, ci } = S;
  for (let k = 0; k < NF; k++) {
    const q = u * k * k, ph = -2 * PI * (q - floor(q)) - th * k;
    cr[k] = amp[k] * cos(ph);
    ci[k] = amp[k] * sin(ph);
  }
}

// W on the grid for the state with Fock coefficients S.cr, S.ci; s2 is the
// variance of the Gaussian that smooths it. Smoothing in p is the factor
// exp(-2 s2 y^2) under the y integral; smoothing in x is a blur along each
// row.
function wigner(S, s2) {
  const { G, J, h, phi, cr, ci, pr, pi, gr, gi, C, Sn, damp, Wg } = S, J1 = J + 1;
  pr.fill(0);
  pi.fill(0);
  for (let k = 0; k < NF; k++) {
    const o = k * G, a = cr[k], b = ci[k];
    if (abs(a) + abs(b) < 1e-12) continue;
    for (let m = 0; m < G; m++) {
      const f = phi[o + m];
      pr[m] += a * f;
      pi[m] += b * f;
    }
  }
  if (s2 !== S.s2) {
    S.s2 = s2;
    for (let j = 0; j < J1; j++) damp[j] = (j ? 2 : 1) * exp(-2 * s2 * (j * h) ** 2) * (h / PI);
    const sg = sqrt(s2) * S.kx, R = ceil(3 * sg);
    S.ker = new Float64Array(R + 1);
    for (let d = 0; d <= R; d++) S.ker[d] = exp((-d * d) / (2 * sg * sg));
  }
  for (let i = 0; i < W; i++) {
    const c = i + J;
    let jm = 0;
    for (let j = 0; j < J1; j++) {
      // psi*(x + y) psi(x - y), weighted for the one-sided sum.
      const ar = pr[c + j], ai = pi[c + j], br = pr[c - j], bi = pi[c - j], d = damp[j];
      gr[j] = (ar * br + ai * bi) * d;
      gi[j] = (ar * bi - ai * br) * d;
      if (abs(gr[j]) + abs(gi[j]) > 1e-7) jm = j + 1;
    }
    for (let r = 0, o = 0; r < H; r++, o += J1) {
      let w = 0;
      for (let j = 0; j < jm; j++) w += gr[j] * C[o + j] - gi[j] * Sn[o + j];
      Wg[r * W + i] = w;
    }
  }
  if (s2 > 0) {
    const ker = S.ker, R = ker.length - 1, tmp = S.tmp;
    for (let r = 0; r < H; r++) {
      const o = r * W;
      for (let x = 0; x < W; x++) {
        let s = 0, n = 0;
        for (let d = -R; d <= R; d++) {
          const xx = x + d;
          if (xx < 0 || xx >= W) continue;
          const k = ker[d < 0 ? -d : d];
          s += k * Wg[o + xx];
          n += k;
        }
        tmp[x] = s / n;
      }
      Wg.set(tmp, o);
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 2], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  const speed = cl(kv[1], 0.2, 3), dec = cl(kv[2], 0, 1), a = cl(kv[3], 2, 3.2);
  if (abs(a - S.a) > 1e-4) build(S, a);
  const g = (d * speed) / 2;
  S.th += (g * 2 * PI) / TURN;
  S.ph += g;
  // A single lump, at the start or at u = 1/2, is held half as long as a cat.
  let hold = S.k % S.N ? HOLD : HOLD / 2;
  if (S.ph >= hold + MOVE) {
    S.ph -= hold + MOVE;
    S.k = (S.k + 1) % (2 * S.N);
    hold = S.k % S.N ? HOLD : HOLD / 2;
  }
  const u0 = stopU(S.N, S.k), u1 = stopU(S.N, S.k + 1);
  let e = cl((S.ph - hold) / MOVE, 0, 1);
  e = e * e * e * (e * (e * 6 - 15) + 10);
  S.u = u0 + (u1 - u0) * e;
  kerr(S, S.u, S.th);
  wigner(S, 0.5 * dec * dec);
  // The brightest |W| of the frame sets the scale, followed in about a
  // third of a second: a cat of n lumps has lumps 1/n as high as the
  // coherent state's, and this keeps the cat of 4 as bright as the cat of 2.
  let m = 0;
  for (let p = 0; p < W * H; p++) m = max(m, abs(S.Wg[p]));
  S.wref = S.wref > 0 ? S.wref + (m - S.wref) * min(1, 3 * d) : m;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.Wg || !S.wref) return;
  const pos = hsv(HUE_POS + S.hue, 0.72, 1, S.pos), neg = hsv(HUE_NEG + S.hue, 0.85, 1, S.neg);
  const Wg = S.Wg, k = 1 / (TOP * S.wref);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const w = Wg[p] * k, v = min(1, w < 0 ? -w : w), c = w < 0 ? neg : pos;
      // The peaks go pale, so a lump reads as a glow rather than a disc.
      const L = LMAX * v ** GAMMA, wh = 0.4 * v * v * v;
      display.setPixel(x, y, (L * (c[0] + (1 - c[0]) * wh)) | 0, (L * (c[1] + (1 - c[1]) * wh)) | 0, (L * (c[2] + (1 - c[2]) * wh)) | 0);
    }
}
