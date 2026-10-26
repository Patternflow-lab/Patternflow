// ===== Patternflow pattern =====
// Title:   Ulam Sequence
// Family:  number
// Idea:    The Ulam sequence counted live, each new term the least number that is a sum of two earlier terms in exactly one way, wound round a circle by the hidden frequency alpha that the code finds for itself: every term sits across the panel at the angle alpha times the term and lower down the larger it is, so the terms fill only the half of the circle where cos(alpha a) < 0, in two humps, and leave the other half empty but for 2, 3, 47 and 69, while each new one drops into the pile below.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ulam sequence (Stanisław Ulam, 1964), with the hidden frequency Stefan Steinerberger found (2017)
// Round:   54
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Seed=0..5, Detune=-1..1
//
// Knob 1: Hue. The colour of the terms, with the ones off the pile in a hue a fifth of the wheel back: gold with pink at 0, green with yellow at 0.25, blue with sea green at 0.5, magenta with blue at 0.75.
// Knob 2: Speed. New terms a second, 40 for each unit: 80 at the opening 2. At 0.2 there are 8 a second, at 3 there are 120. Each new term falls from the foot of the coil into its column of the pile in 0.4 s. After 16,000 terms (the last of U(1,2) is 213,514) the count rests 4 s and starts again from the first 600.
// Knob 3: Seed. Which sequence: U(1,2) at 0, U(1,3) at 1, U(1,4) at 2, U(2,3) at 3, U(3,4) at 4 and U(2,5) at 5. The code finds each frequency itself as the alpha in (0, pi] where |sum of exp(i alpha a)| over the terms is largest, and finds it again each time the count doubles: 2.5714 for U(1,2) (Steinerberger gives 2.5714474995), 2.8335 for U(1,3), 0.5060 for U(1,4), 1.1650 for U(2,3), 2.2090 for U(3,4). U(2,5) has just two even terms, 2 and 12 (James Schmerl and Eugene Spiegel, 1994), so its frequency is pi and its pile is one spike. The terms off the pile are 2, 3, 47 and 69 for U(1,2), 4 and 98 for U(1,3), 1 and 10 for U(1,4), 5 for U(2,3), 3 and 11 for U(3,4).
// Knob 4: Detune. Moves alpha off the found value: not at all within 0.1 of the middle (it opens at 0.06), then as the square of the rest, to 0.002 either way at the ends. The error in the angle grows with the term, so at 0.5 (0.0004 off) the band leans more and more towards the foot of the coil and winds into stripes that cross the empty half in pink; at 1 the pile is flat.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, exp, log, PI, round } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return o;
}

// The seeds K3 steps through.
const SEEDS = [[1, 2], [1, 3], [1, 4], [2, 3], [3, 4], [2, 5]];
// Terms kept at most, and the counting array: C[m] is how many ways m is a
// sum of two distinct terms so far, stopped at 2.
const NMAX = 16000, LIM = 1 << 19, HEAD = 600;
// Rows of the coil (the number line wound on the circle) and of the pile.
const CH = 86, PB = 34;

function start(S, seed) {
  const [p, q] = SEEDS[seed];
  S.seed = seed;
  S.C.fill(0);
  S.T[0] = p, S.T[1] = q, S.n = 2;
  S.C[p + q] = 1;
  S.alpha = 0, S.fitN = 0, S.acc = 0, S.full = 0;
  S.born.fill(-9);
  while (S.n < HEAD) next(S);
  fit(S);
}

// The next Ulam term: the least m above the last term that is a sum of two
// distinct earlier terms in exactly one way. Then its sums with every
// earlier term are counted.
function next(S) {
  const T = S.T, C = S.C, n = S.n;
  let m = T[n - 1] + 1;
  while (m < LIM >> 1 && C[m] !== 1) m++;
  if (m >= LIM >> 1 || n >= NMAX) return false;
  T[n] = m;
  for (let j = 0; j < n; j++) {
    const s = m + T[j];
    if (s < LIM && C[s] < 2) C[s]++;
  }
  S.n = n + 1;
  return true;
}

// |sum of exp(i alpha a)|^2 over the first n terms.
function power(T, n, a) {
  let re = 0, im = 0;
  for (let j = 0; j < n; j++) (re += cos(a * T[j])), (im += sin(a * T[j]));
  return re * re + im * im;
}

// The same at K points a0, a0 + step, ..., each term's phase turned on by a
// fixed step from the last; returns the best point.
const CR = new Float64Array(NMAX), CI = new Float64Array(NMAX), WR = new Float64Array(NMAX), WI = new Float64Array(NMAX);
function scan(T, n, a0, step, K) {
  for (let j = 0; j < n; j++) (CR[j] = cos(a0 * T[j])), (CI[j] = sin(a0 * T[j])), (WR[j] = cos(step * T[j])), (WI[j] = sin(step * T[j]));
  let best = -1, at = a0;
  for (let k = 0; k <= K; k++) {
    let re = 0, im = 0;
    for (let j = 0; j < n; j++) {
      re += CR[j], im += CI[j];
      const r = CR[j] * WR[j] - CI[j] * WI[j];
      CI[j] = CR[j] * WI[j] + CI[j] * WR[j], CR[j] = r;
    }
    const p = re * re + im * im;
    if (p > best) (best = p), (at = a0 + k * step);
  }
  return at;
}

// The hidden frequency: the alpha in (0, pi] where the terms' Fourier sum
// is largest. The first time, a scan of the first 200 terms from 0.01 to pi
// in steps of a fifth of the peak's width; each time the count doubles, a
// scan of three old peak widths round the last value with all the terms.
// Then the top of a parabola through the best point and its neighbours,
// twice, the second time five times closer.
function fit(S) {
  const T = S.T, n = S.n;
  let at, h;
  if (!S.alpha) {
    h = (0.2 * TAU) / T[199];
    at = scan(T, 200, 0.01, h, Math.ceil((PI - 0.01) / h));
  } else {
    h = (0.2 * TAU) / T[n - 1];
    const w = (1.5 * TAU) / T[S.fitN - 1];
    at = scan(T, n, S.alpha - w, h, Math.ceil((2 * w) / h));
  }
  for (let i = 0; i < 2; i++, h /= 5) {
    const f0 = power(T, n, at - h), f1 = power(T, n, at), f2 = power(T, n, at + h), q = f0 - 2 * f1 + f2;
    if (q < 0) at += (cl((0.5 * (f0 - f2)) / q, -1, 1)) * h;
  }
  S.alpha = at;
  S.fitN = n;
}

export function setup(params) {
  const S = (params.s = {
    hue: 0, speed: 2, seed: 0, det: 0, alpha: 0, fitN: 0, acc: 0, n: 0, full: 0, t: 0,
    T: new Float64Array(NMAX), C: new Uint8Array(LIM), born: new Float64Array(NMAX),
    G: new Float64Array(W * CH), R: new Float64Array(CH), P: new Float64Array(W), c: [0, 0, 0],
  });
  start(S, 0);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const seed = cl(round(k[2]), 0, SEEDS.length - 1);
  if (seed !== S.seed) start(S, seed);
  // Detune: nothing within 0.1 of the middle, then up to 0.002 either way.
  const u = cl(abs(k[3]) - 0.1, 0, 0.9) / 0.9;
  S.det = (k[3] < 0 ? -1 : 1) * 0.002 * u * u;
  S.t += d;
  // New terms, 40 a second for each unit of Speed.
  S.acc += 40 * S.speed * d;
  while (S.acc >= 1) {
    S.acc -= 1;
    if (!next(S)) {
      S.full += d;
      break;
    }
    S.born[S.n - 1] = S.t;
  }
  if (S.n >= 2 * S.fitN) fit(S);
  if (S.full > 4) start(S, S.seed);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const T = S.T, n = S.n, G = S.G, R = S.R, P = S.P, c = S.c, al = S.alpha + S.det;
  G.fill(0), R.fill(0), P.fill(0);
  // Rows of the coil go as log(a + 16), from a = 1 at the top to the
  // largest term at the bottom; columns are alpha a modulo 2 pi.
  const l0 = log(17), sc = (CH - 1) / (log(T[n - 1] + 16) - l0);
  let pm = 1;
  for (let j = 0; j < n; j++) {
    const a = T[j], x = floor(((al * a) % TAU) * (W / TAU)) & 63, y = (log(a + 16) - l0) * sc, y0 = floor(y), f = y - y0;
    G[y0 * W + x] += 1 - f, R[y0] += 1 - f;
    if (y0 + 1 < CH) (G[(y0 + 1) * W + x] += f), (R[y0 + 1] += f);
    if (++P[x] > pm) pm = P[x];
  }
  const h0 = 0.12 + S.hue;
  // A cell's light goes with its count against the row's share of terms
  // for each of the 24 columns the band spans, so sparse rows near the top
  // show single terms and dense rows the band's shape.
  for (let y = 0; y < CH; y++) {
    const q = 1.2 / max(0.4, R[y] / 24);
    for (let x = 0; x < W; x++) {
      const b = 1 - exp(-G[y * W + x] * q);
      hsv(h0 + 0.05 * b, 0.75 - 0.3 * b, b, c);
      display.setPixel(x, y, c[0] | 0, c[1] | 0, c[2] | 0);
    }
  }
  // The terms with cos(alpha a) >= 0, on the empty half of the circle, in
  // pink with a dim cross round each.
  for (let j = 0; j < n; j++) {
    const a = T[j];
    if (cos(al * a) < 0) continue;
    const x = floor(((al * a) % TAU) * (W / TAU)) & 63, y = min(CH - 1, round((log(a + 16) - l0) * sc));
    hsv(h0 + 0.8, 0.7, 0.45, c);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const yy = y + dy;
      if (yy >= 0 && yy < CH) display.setPixel((x + dx) & 63, yy, c[0] | 0, c[1] | 0, c[2] | 0);
    }
    hsv(h0 + 0.8, 0.5, 1, c);
    display.setPixel(x, y, c[0] | 0, c[1] | 0, c[2] | 0);
  }
  // The pile: how many terms in each 64th of the circle, on a bottom row
  // that marks the half where cos(alpha a) < 0 apart from the other half.
  for (let x = 0; x < W; x++) {
    const hgt = (P[x] / pm) * PB;
    for (let z = 0; z < PB; z++) {
      const b = cl(hgt - z, 0, 1);
      if (b <= 0) break;
      hsv(h0 + 0.03 * (z / PB), 0.85 - 0.4 * (z / PB), b * (0.62 + 0.38 * (z / PB)), c);
      display.setPixel(x, H - 2 - z, c[0] | 0, c[1] | 0, c[2] | 0);
    }
    if (x >= 16 && x < 48) hsv(h0 + 0.5, 0.6, 0.3, c);
    else hsv(h0 + 0.8, 0.6, 0.3, c);
    display.setPixel(x, H - 1, c[0] | 0, c[1] | 0, c[2] | 0);
  }
  // Each new term falls from the bottom of the coil into its column of
  // the pile in 0.4 s.
  for (let j = n - 1; j >= 2 && S.t - S.born[j] < 0.4; j--) {
    const a = T[j], x = floor(((al * a) % TAU) * (W / TAU)) & 63, u = (S.t - S.born[j]) / 0.4;
    const top = H - 2 - (P[x] / pm) * PB, y = CH - 1 + (top - CH + 1) * u * u;
    for (let i = 0; i < 3; i++) {
      const yy = round(y) - i;
      if (yy < CH || yy >= H) continue;
      hsv(h0 + 0.02, 0.35 + 0.2 * i, 1 - 0.3 * i, c);
      display.setPixel(x, yy, c[0] | 0, c[1] | 0, c[2] | 0);
    }
  }
}
