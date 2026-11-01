// ===== Patternflow pattern =====
// Title:   Cantor Scalogram
// Family:  data
// Idea:    The wavelet transform of the Cantor staircase fills the tall panel, position down the 128 rows and log scale across the 64 columns, brightness its modulus and hue the phase of a complex Morlet wavelet, so the modulus branches into a tree of cones exactly as the middle-thirds Cantor set does while the view zooms in by three and slides one level along the scale axis back to the same picture.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: continuous wavelet transform (Alex Grossmann and Jean Morlet, 1984); wavelet transform of fractal signals, the Cantor staircase and the tree of its modulus maxima (Alain Arneodo, Guy Grasseau and Matthias Holschneider, 1988); the middle-thirds Cantor set (Georg Cantor, 1883); pattern round 82
// Round:   82
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Noise=1..8, Omega=3..8
//
// Knob 1: Hue. Turns the phase wheel: at 0 a phase of 0 is cyan, at 0.5 it is red, and the hue goes once round the wheel for every turn of the phase.
// Knob 2: Speed. At 2 the view zooms in by three every 6 s while the tree slides 21 columns towards the coarse side; 60 s at 0.2, 4 s at 3.
// Knob 3: Noise. Complex noise on every coefficient, 0.1 times Noise^0.85 of the lit threshold at the coarsest column and 1.54 times that at the finest: at 1 it is a dim static under the cones and 28% of the LEDs are lit, at 8 the fine branches sink into it and 55% are lit.
// Knob 4: Omega. The Morlet wavelet's centre frequency, 3 to 8 radians per unit of its width. At 3 the cones are smooth and the hue turns 2.8 radians a row at the finest column; from 5 the two halves of each branch cancel between them, so each cone opens into a striped oval.

// Rows are the position b, columns the scale a, 21 columns to a factor of
// 3, from a = 0.243 on the left to 0.009 on the right. The Morlet wavelet
// psi(t) = exp(-t^2 / 2) (exp(i w t) - exp(-w^2 / 2)) is taken against the
// Cantor measure mu, the derivative of the staircase F:
//
//   T(a, b) = (1/a) * integral psi((x - b) / a) dmu(x),
//
// which is -1/a times the transform of F itself with psi' as wavelet. The
// staircase rises as |x - x0|^alpha at each point of the set, alpha =
// log 2 / log 3, so T grows as a^(alpha - 1) on its maxima, and every
// column is multiplied by a^(1 - alpha). Then the measure's own symmetry,
// mu on [0, 1/3] being half of mu shrunk by 3, makes the scaled T at
// (a/3, b/3) equal to the scaled T at (a, b): zooming in by 3 about b = 0 and moving 21 columns gives
// the picture back, and the loop has no seam. The mass of [2/3, 1] is 3.95
// wavelet widths from the bottom row at the end of the loop.
//
// At scale a the measure is cut at the stage k where the intervals are
// 1/5.5 to 1/16.5 of a, each interval a point mass at its centre. The
// spread of the measure inside an interval, variance (3^-k)^2 / 8, is put
// back with the second derivative of psi, so the sum changes by under 0.1%
// when k steps. Only the masses within 4a of the panel count, 8 to 64 of
// them and 410 to 1860 terms a column, and down the rows each mass runs by
// recurrence: the Gaussian by two products and the phase by one rotation.
//
// The 72% of LEDs with the smallest modulus stay at 24 or under, drawn as
// the log of the modulus over a range of e^4; the rest climb from 25 to
// 255. The hue is the phase. Noise on the coefficients is what lights the
// gaps of the set, where the staircase is flat and its transform is all
// but zero.

const W = 64, H = 128;
const { floor, ceil, min, max, round, sqrt, sin, cos, exp, log, pow, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const LN3 = log(3);
const ALPHA = log(2) / LN3;

// Rows: position b from -0.04 to 1.04 at the start of the loop.
const B0 = -0.04, DB = 1.08 / H;
// Columns: scale a from AMAX at column 0 down by 3 every PER columns.
const AMAX = 0.243, PER = 21;
// The level of point masses keeps a / 3^-k in [RMIN, 3 RMIN).
const RMIN = 5.5, KMAX = 9;
// Histogram of the modulus for the exposure.
const HB = 512;
// Share of LEDs left under the lit threshold.
const DARK = 0.72;
// Under the threshold the brightness is the log of the modulus, over e^LOGR.
const LOGR = 4;
// Noise on the coefficients at Noise 1, as a share of the threshold.
const NOISE = 0.1;

// Centres of the 2^k intervals of the k-th stage of the Cantor set, sorted.
const CENTRES = [];
for (let k = 0; k <= KMAX; k++) {
  const n = 1 << k, w = pow(3, -k), arr = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    let x = 0, s = 1 / 3;
    for (let i = k - 1; i >= 0; i--) {
      if ((j >> i) & 1) x += 2 * s;
      s /= 3;
    }
    arr[j] = x + w / 2;
  }
  CENTRES.push(arr);
}
const firstAtLeast = (arr, x) => {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (arr[m] < x) lo = m + 1;
    else hi = m;
  }
  return lo;
};

// A small generator of its own, seeded once from Math.random, for the
// 16384 noise draws a frame; two uniforms make a triangle of variance 1.
let seed = 1;
const uni = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
};
const tri = () => (uni() + uni() - 1) * 2.449;

export function setup(params) {
  seed = (Math.random() * 4294967295) | 1;
  params.s = {
    u: 0,
    hue: 0,
    noise: 1,
    omega: 3,
    re: new Float64Array(W * H),
    im: new Float64Array(W * H),
    mod: new Float64Array(W * H),
    hist: new Uint32Array(HB),
    // Complex noise on every coefficient, refreshed a little every frame.
    noiseRI: new Float32Array(W * H * 2).map(tri),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 3], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.noise = cl(k[2] == null ? 1 : k[2], 1, 8);
  S.omega = cl(k[3] == null ? 3 : k[3], 3, 8);
  S.u = (S.u + (d * speed) / 12) % 1;
  // The noise drifts: each value keeps exp(-dt / 0.15 s) of itself.
  const keep = exp(-d / 0.15), fresh = sqrt(1 - keep * keep), nz = S.noiseRI;
  for (let i = 0; i < nz.length; i++) nz[i] = nz[i] * keep + fresh * tri();
}

// Adds the transform of the Cantor measure at one column into re, im.
function column(S, c) {
  const z = pow(3, -S.u), om = S.omega, kap = exp(-om * om / 2);
  const a = AMAX * pow(3, -c / PER) * z;
  const db = DB * z, b0 = (B0 + 0.5 * DB) * z;
  const k = cl(ceil(log(RMIN / a) / LN3), 0, KMAX);
  const r = a * pow(3, k), v2 = 1 / (16 * r * r), norm = pow(r, -ALPHA);
  const reach = 4 * a, xs = CENTRES[k];
  const delta = db / a, D = exp(-delta * delta), cw = cos(om * delta), sw = sin(om * delta);
  const re = S.re, im = S.im, off = c;
  for (let n = 0; n < H; n++) re[n * W + off] = im[n * W + off] = 0;
  const end = b0 + (H - 1) * db + reach;
  for (let j = firstAtLeast(xs, b0 - reach); j < xs.length && xs[j] <= end; j++) {
    const x = xs[j];
    const n0 = max(0, ceil((x - reach - b0) / db)), n1 = min(H - 1, floor((x + reach - b0) / db));
    let t = (x - (b0 + n0 * db)) / a;
    let G = exp(-t * t / 2), Q = exp(t * delta - delta * delta / 2);
    let zr = cos(om * t), zi = sin(om * t);
    for (let n = n0; n <= n1; n++) {
      const tt = t * t;
      const p = 1 + v2 * (tt - 1 - om * om), q = -2 * v2 * om * t;
      const kk = kap * (1 + v2 * (tt - 1));
      re[n * W + off] += G * (zr * p - zi * q - kk);
      im[n * W + off] += G * (zr * q + zi * p);
      G *= Q;
      Q *= D;
      t -= delta;
      const tr = zr * cw + zi * sw;
      zi = zi * cw - zr * sw;
      zr = tr;
    }
  }
  for (let n = 0; n < H; n++) {
    re[n * W + off] *= norm;
    im[n * W + off] *= norm;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  for (let c = 0; c < W; c++) column(S, c);
  const re = S.re, im = S.im, mod = S.mod, hist = S.hist, N = W * H;
  // Exposure from the staircase alone: the lit threshold is the modulus that
  // DARK of the LEDs stay under, full brightness the top 0.5%.
  let top = 0;
  for (let p = 0; p < N; p++) {
    const m = sqrt(re[p] * re[p] + im[p] * im[p]);
    mod[p] = m;
    if (m > top) top = m;
  }
  hist.fill(0);
  const hs = (HB - 1) / (top || 1);
  for (let p = 0; p < N; p++) hist[floor(mod[p] * hs)]++;
  let mf = 0, mt = top;
  for (let i = 0, acc = 0; i < HB; i++) {
    acc += hist[i];
    if (!mf && acc >= DARK * N) mf = (i + 1) / hs;
    if (acc >= 0.995 * N) {
      mt = (i + 1) / hs;
      break;
    }
  }
  mt = max(mt, mf * 1.05);
  const nz = S.noiseRI, hue = S.hue + 0.5;
  for (let c = 0; c < W; c++) {
    // The noise grows as a^-(alpha - 1/2) towards fine scales, as white
    // noise in the staircase would against the Cantor part.
    const sig = NOISE * mf * pow(S.noise, 0.85) * pow(3, (c / PER) * (ALPHA - 0.5));
    const cmax = 3 * sig;
    for (let n = 0; n < H; n++) {
      const p = n * W + c;
      let nr = nz[2 * p] * sig, ni = nz[2 * p + 1] * sig;
      const nm = sqrt(nr * nr + ni * ni);
      if (nm > cmax) {
        nr *= cmax / nm;
        ni *= cmax / nm;
      }
      const zr = re[p] + nr, zi = im[p] + ni;
      const m = sqrt(zr * zr + zi * zi);
      // Under the threshold the LED stays under 24; over it, it climbs.
      let v, sat;
      if (m < mf) {
        v = m > 0 ? 24.4 * cl(1 + log(m / mf) / LOGR, 0, 1) : 0;
        // The more of the coefficient is noise, the deeper its colour.
        sat = 0.3 + (0.65 * nm) / (nm + mod[p] + 1e-9);
      } else {
        const x = min(1, (m - mf) / (mt - mf));
        v = 25 + 230 * pow(x, 0.8);
        sat = 0.85 - 0.4 * x * x;
      }
      // Hue: the phase, once round the wheel per turn.
      let h = atan2(zi, zr) / TAU + hue;
      h = (h - floor(h)) * 6;
      const i = floor(h), fr = h - i;
      const P = v * (1 - sat), Q = v * (1 - sat * fr), T = v * (1 - sat * (1 - fr));
      let R, G, B;
      if (i === 0) (R = v), (G = T), (B = P);
      else if (i === 1) (R = Q), (G = v), (B = P);
      else if (i === 2) (R = P), (G = v), (B = T);
      else if (i === 3) (R = P), (G = Q), (B = v);
      else if (i === 4) (R = T), (G = P), (B = v);
      else (R = v), (G = P), (B = Q);
      if (m >= mf) {
        // A lit LED sits on a grey of 25, so none of its channels is as dim
        // as the floor.
        const k = (v - 25) / v;
        R = 25 + R * k;
        G = 25 + G * k;
        B = 25 + B * k;
      }
      display.setPixel(c, n, round(R), round(G), round(B));
    }
  }
}
