// ===== Patternflow pattern =====
// Title:   Explicit Formula
// Family:  number
// Idea:    The prime staircase psi(x), x running down the rows and psi across, is rebuilt from the zeros of the zeta function one pair at a time: the bare line x - log 2 pi grows waves that sharpen into steps, each step snapping onto its prime power and its band lighting up as it does, while the zeros taken so far light up one by one down a strip at the right and a count at the top.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Riemann's explicit formula (Bernhard Riemann, 1859), in von Mangoldt's form for the Chebyshev function psi (Hans von Mangoldt, 1895), pattern round 39
// Round:   39
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Reach=24..144, Tilt=0..1
//
// Knob 1: Hue. Turns the fill round the wheel, the shortfall colour a quarter turn on; gold stays gold. At 0 azure fill, violet where the sum falls short of the staircase and gold where it runs past; at 0.25 violet with orange, at 0.5 pale orange with green, at 0.75 green with azure. Orange and yellow fill is paled and dims less in its shaded bands, so it never reads brown.
// Knob 2: Speed. How fast the zeros come in, each a little faster than the last: at 2 the first is in after 0.7 s, 10 by 4.2 s, 100 by 10.9 s and all 200 by 13.1 s; the staircase holds for 4 s, the zeros are taken out again in 1.9 s and the bare line rests 1 s, 20 s round. At 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Reach. How far x runs down the 128 rows, from 1 to Reach, with psi = 0 on column 3 and psi = Reach on column 57. At 24, the start, 13 prime powers, 5.6 rows to each unit of x and steps 1.6 to 7 LEDs wide; at 84 33 of them; at 144 47, the steps under 2 LEDs, and the staircase leans on the line x as the prime number theorem says it must. The 200 zeros resolve the staircase less sharply the further x runs.
// Knob 4: Tilt. Takes Tilt times x away from both curves and widens the scale to match. Up to 0.06 the staircase itself; at 1 only psi(x) - x is left, a sawtooth that slides left one unit for each unit of x and jumps right by log p at each prime power, drawn 5 LEDs to the unit at Reach 24: the part of psi that the zeros alone make, their waves summing to the teeth.
// Buttons: K1 tap takes every zero out and starts adding them again from the first.

const W = 64, H = 128, SS = 4, NS = H * SS, NZ = 200;
// The imaginary parts of the first 200 zeros of the zeta function on the
// critical line, rho = 1/2 + i gamma, to six places. 14.134725 is the first,
// 396.381854 the 200th.
const GAM = [
  14.134725, 21.022040, 25.010858, 30.424876, 32.935062, 37.586178, 40.918719, 43.327073, 48.005151, 49.773832,
  52.970321, 56.446248, 59.347044, 60.831779, 65.112544, 67.079811, 69.546402, 72.067158, 75.704691, 77.144840,
  79.337375, 82.910381, 84.735493, 87.425275, 88.809111, 92.491899, 94.651344, 95.870634, 98.831194, 101.317851,
  103.725538, 105.446623, 107.168611, 111.029536, 111.874659, 114.320221, 116.226680, 118.790783, 121.370125, 122.946829,
  124.256819, 127.516684, 129.578704, 131.087689, 133.497737, 134.756510, 138.116042, 139.736209, 141.123707, 143.111846,
  146.000982, 147.422765, 150.053520, 150.925258, 153.024694, 156.112909, 157.597592, 158.849988, 161.188964, 163.030710,
  165.537069, 167.184440, 169.094515, 169.911976, 173.411537, 174.754192, 176.441434, 178.377408, 179.916484, 182.207078,
  184.874468, 185.598784, 187.228923, 189.416159, 192.026656, 193.079727, 195.265397, 196.876482, 198.015310, 201.264752,
  202.493595, 204.189672, 205.394697, 207.906259, 209.576510, 211.690863, 213.347919, 214.547045, 216.169539, 219.067596,
  220.714919, 221.430706, 224.007000, 224.983325, 227.421444, 229.337413, 231.250189, 231.987235, 233.693404, 236.524230,
  237.769820, 239.555478, 241.049158, 242.823272, 244.070898, 247.136990, 248.101990, 249.573690, 251.014948, 253.069987,
  255.306256, 256.380714, 258.610439, 259.874407, 260.805085, 263.573894, 265.557852, 266.614974, 267.921915, 269.970449,
  271.494056, 273.459609, 275.587493, 276.452050, 278.250744, 279.229251, 282.465115, 283.211186, 284.835964, 286.667445,
  287.911921, 289.579855, 291.846291, 293.558434, 294.965370, 295.573255, 297.979277, 299.840326, 301.649325, 302.696750,
  304.864371, 305.728913, 307.219496, 310.109463, 311.165142, 312.427801, 313.985286, 315.475616, 317.734806, 318.853104,
  321.160134, 322.144559, 323.466970, 324.862866, 327.443901, 329.033072, 329.953240, 331.474468, 333.645379, 334.211355,
  336.841850, 338.339993, 339.858217, 341.042261, 342.054878, 344.661703, 346.347871, 347.272678, 349.316261, 350.408419,
  351.878649, 353.488900, 356.017575, 357.151302, 357.952685, 359.743755, 361.289362, 363.331331, 364.736024, 366.212710,
  367.993575, 368.968438, 370.050919, 373.061928, 373.864874, 375.825913, 376.324092, 378.436680, 379.872975, 381.484469,
  383.443529, 384.956117, 385.861301, 387.222890, 388.846128, 391.456084, 392.245083, 393.427744, 395.582870, 396.381854,
];
// psi = 0 sits on column C0 and psi = Reach on column C0 + CW. The critical
// line runs down columns ZC..ZC + 2, gamma 0 to GTOP over the 128 rows.
const C0 = 3, CW = 54, ZC = 61, GTOP = 400;
// Zeros come in at dz/dt = ZB (ZA + z) a second at Speed 2: the first after
// 0.7 s, 10 by 4.2 s, 100 by 10.9 s, all 200 by 13.1 s. Then they hold for
// HOLD seconds, go out BACK times as fast and the bare line rests REST.
const ZA = 4, ZB = 0.3, HOLD = 4, BACK = 7, REST = 1;
// Opening hue: azure.
const H0 = 0.56;
const LOG2PI = Math.log(2 * Math.PI);
const { floor, min, max, abs, sqrt, log, exp, sin, cos, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// 3 x 5 digits, row by row from the top, three bits a row.
const FONT = [
  0b111101101101111, 0b010110010010111, 0b111001111100111, 0b111001111001111, 0b101101111001001,
  0b111100111001111, 0b111100111101111, 0b111001001001001, 0b111101111101111, 0b111101111001111,
];

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

// The prime powers p^k up to X, each with log p and k.
function primePowers(X) {
  const out = [];
  for (let n = 2; n <= X; n++) {
    let p = 2;
    while (n % p) p++;
    let m = n, k = 0;
    while (m % p === 0) (m /= p), k++;
    if (m === 1) out.push([n, log(p), k]);
  }
  return out;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, reach: 0, tilt: 0, z: 0, stage: 0, clock: 0, nIn: 0,
    xs: new Float64Array(NS), band: new Uint8Array(NS), base: new Float64Array(NS), tru: new Float64Array(NS), A: new Float64Array(NS),
    v: new Float64Array(NS), lit: new Float32Array(64), err: new Float64Array(64), cnt: new Float64Array(64), bx: new Float64Array(64), cN: new Float32Array(SS), cT: new Float32Array(SS), pp: [],
    R: new Float32Array(W * H), G: new Float32Array(W * H), B: new Float32Array(W * H),
    fill0: [0, 0, 0], fill1: [0, 0, 0], bg: [0, 0, 0], rim: [0, 0, 0], dot: [0, 0, 0], over: [0, 0, 0], short: [0, 0, 0],
  };
}

// The pair rho, its conjugate at sample j: 2 Re(x^rho / rho)
// = 2 sqrt(x) (cos(g L) / 2 + g sin(g L)) / (1/4 + g^2), L = log x.
function term(S, n, j) {
  const g = GAM[n], x = S.xs[j], L = log(x);
  return (2 * sqrt(x) * (0.5 * cos(g * L) + g * sin(g * L))) / (0.25 + g * g);
}

// Zero n fully in (sign 1) or taken out (sign -1).
function addZero(S, n, sign) {
  for (let j = 0; j < NS; j++) S.A[j] += sign * term(S, n, j);
}

function setReach(S, X) {
  S.reach = X;
  S.pp = primePowers(X);
  for (let j = 0; j < NS; j++) {
    // Row y holds x from 1 + y (X - 1) / 128 to one row further on.
    const x = 1 + ((j + 0.5) / NS) * (X - 1);
    S.xs[j] = x;
    S.base[j] = x - LOG2PI - 0.5 * log(1 - 1 / (x * x));
    let p = 0, c = 0;
    for (const q of S.pp) if (q[0] <= x) (p += q[1]), c++;
    S.tru[j] = p;
    S.band[j] = c;
  }
  S.A.fill(0);
  S.lit.fill(0);
  for (let n = 0; n < S.nIn; n++) addZero(S, n, 1);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 24, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  // Up to 0.06 upright as it is, so the opening shows the staircase itself.
  S.tilt = max(0, cl(k[3], 0, 1) - 0.06) / 0.94;
  const X = round(cl(k[2], 24, 144));
  if (X !== S.reach) setReach(S, X);
  if (input.btnPressed && input.btnPressed[0]) {
    S.stage = 0;
    S.z = 0;
  }
  const sp = (d * S.speed) / 2;
  if (S.stage === 0) {
    S.z += sp * ZB * (ZA + S.z);
    if (S.z >= NZ) (S.z = NZ), (S.stage = 1), (S.clock = 0);
  } else if (S.stage === 1) {
    S.clock += sp;
    if (S.clock > HOLD) S.stage = 2;
  } else if (S.stage === 2) {
    S.z -= sp * ZB * BACK * (ZA + S.z);
    if (S.z <= 0) (S.z = 0), (S.stage = 3), (S.clock = 0);
  } else {
    S.clock += sp;
    if (S.clock > REST) S.stage = 0;
  }
  const n = min(NZ, floor(S.z));
  while (S.nIn < n) addZero(S, S.nIn++, 1);
  while (S.nIn > n) addZero(S, --S.nIn, -1);
  // The sum at every sample, the fading zero in by its fraction.
  const { v, xs, base, tru, A, err, cnt, bx, band, lit } = S, f = n < NZ ? S.z - n : 0;
  for (let j = 0; j < NS; j++) v[j] = base[j] - A[j] - (f > 0 ? f * term(S, n, j) : 0);
  // A band has snapped onto its step when the sum's mean distance from the
  // staircase across it is under 0.04 sqrt(x); it starts to light at 0.12.
  const nb = S.pp.length + 1;
  err.fill(0, 0, nb);
  cnt.fill(0, 0, nb);
  bx.fill(0, 0, nb);
  for (let j = 0; j < NS; j++) {
    const q = band[j];
    err[q] += abs(v[j] - tru[j]);
    bx[q] += xs[j];
    cnt[q]++;
  }
  const ease = 1 - exp(-d / 0.3);
  for (let q = 0; q < nb; q++) {
    const r = cnt[q] ? err[q] / cnt[q] / sqrt(bx[q] / cnt[q]) : 1, u = cl((0.12 - r) / 0.08, 0, 1);
    lit[q] += (u * u * (3 - 2 * u) - lit[q]) * ease;
  }
}

// A colour that would read brown or olive, a dark orange or yellow, is
// paled toward grey and lifted.
function tone(h, s, v, out) {
  const hh = h - floor(h), warm = cl(1.2 - abs(hh - 0.12) / 0.13, 0, 1) * (1 - v);
  hsv(h, s * (1 - 0.9 * warm), v * (1 + 1.1 * warm), out);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { R, G, B, v, xs, tru, cN, cT, fill0, fill1, bg, rim, dot, over, short } = S;
  const X = S.reach, n = S.nIn, f = n < NZ ? S.z - n : 0, t = S.tilt;
  // Columns: psi - t x, so at Tilt 1 only what the zeros add is left, the
  // scale closing in from the whole of psi to about 2.2 sqrt(Reach).
  const sc = CW / ((1 - t) * X + t * 2.2 * sqrt(X)), c0 = C0 + 35 * t;

  // Orange and yellow fill dims less, so its shaded bands never read brown.
  const h = S.hue + H0, hh = h - floor(h), keep = 1 - 0.7 * cl(1.2 - abs(hh - 0.12) / 0.13, 0, 1);
  tone(h, 0.8, 0.6, fill0);
  tone(h + 0.05, 0.75, 1, fill1);
  hsv(0.64, 0.45, 0.15, bg);
  tone(h + 0.25, 0.65, 0.8, short);
  hsv(h - 0.03, 0.2, 1, rim);
  hsv(h, 0.35, 1, dot);
  over[0] = 1;
  over[1] = 0.8;
  over[2] = 0.45;
  // The newest zero's wave, faintly in the fill while it comes in.
  const wave = n < NZ ? 0.1 * sin(PI * f) * sqrt(GAM[0] / GAM[n]) : 0, gw = n < NZ ? GAM[n] : 0;

  let prevC = c0 + (v[0] - t * xs[0]) * sc;
  for (let y = 0; y < H; y++) {
    const u = y / (H - 1);
    const fr = fill0[0] + (fill1[0] - fill0[0]) * u, fg = fill0[1] + (fill1[1] - fill0[1]) * u, fb = fill0[2] + (fill1[2] - fill0[2]) * u;
    const bk = 0.8 + 0.4 * u;
    // Where the curve runs in this row: the span between the last sample of
    // the row above and every sample of this one.
    let lo = prevC, hi = prevC;
    for (let q = 0; q < SS; q++) {
      const j = y * SS + q, cc = c0 + (v[j] - t * xs[j]) * sc;
      cN[q] = cc;
      cT[q] = c0 + (tru[j] - t * xs[j]) * sc;
      if (cc < lo) lo = cc;
      if (cc > hi) hi = cc;
      prevC = cc;
    }
    // Between one prime power and the next the fill is a band, every other
    // band a little lighter, so the gaps between them show as band heights,
    // and a band stays dim until the sum has snapped onto its step.
    const bq = S.band[y * SS + 2];
    const wv = (1 + wave * sin(gw * log(xs[y * SS + 2]))) * (bq & 1 ? 1.08 : 0.92) * (0.45 + 0.55 * S.lit[bq]);
    const edge = (cN[0] + cN[1] + cN[2] + cN[3]) / 4;
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      // Under both the sum and the staircase: the fill. Under the sum alone,
      // where it runs past the staircase: gold. Under the staircase alone,
      // where the sum falls short: the second colour. Under neither: dark.
      let both = 0, ov = 0, sh = 0;
      for (let q = 0; q < SS; q++) {
        const a = cl(cN[q] - x, 0, 1), b = cl(cT[q] - x, 0, 1), m = a < b ? a : b;
        both += m;
        ov += a - m;
        sh += b - m;
      }
      both /= SS;
      ov /= SS;
      sh /= SS;
      const no = 1 - both - ov - sh, gl = 1 - (1 - wv * (0.55 + 0.45 * exp((x - edge) / 9))) * keep;
      let r = bg[0] * bk * no + fr * gl * both + over[0] * ov + short[0] * sh;
      let g = bg[1] * bk * no + fg * gl * both + over[1] * ov + short[1] * sh;
      let b = bg[2] * bk * no + fb * gl * both + over[2] * ov + short[2] * sh;
      // The curve itself: every LED its span touches.
      const rr = cl(1 - max(lo - (x + 1), x - hi), 0, 1) * 0.75;
      r += (rim[0] - r) * rr;
      g += (rim[1] - g) * rr;
      b += (rim[2] - b) * rr;
      R[p] = r;
      G[p] = g;
      B[p] = b;
    }
  }
  // Ticks down the left edge at each prime power: three LEDs for a prime,
  // two for a square, one for a higher power.
  for (const q of S.pp) {
    const y = floor(((q[0] - 1) / (X - 1)) * H);
    if (y < 0 || y >= H) continue;
    const len = q[2] === 1 ? 3 : q[2] === 2 ? 2 : 1;
    for (let x = 0; x < len; x++) {
      const p = y * W + x;
      R[p] = over[0];
      G[p] = over[1];
      B[p] = over[2];
    }
  }
  // The critical line: every zero a dot at its height, dim until it is in.
  for (let x = ZC; x < W; x++)
    for (let y = 0; y < H; y++) {
      const p = y * W + x;
      R[p] *= 0.5;
      G[p] *= 0.5;
      B[p] *= 0.5;
    }
  for (let m = 0; m < NZ; m++) {
    const yy = (GAM[m] / GTOP) * H - 0.5, y0 = floor(yy), fy = yy - y0;
    const a = m < n ? 1 : m === n ? 0.15 + 0.85 * f : 0.15, flash = m === n ? 1 : m === n - 1 ? 1 - f : 0;
    for (let x = ZC; x < W; x++)
      for (let e = 0; e < 2; e++) {
        const y = y0 + e, wgt = e ? fy : 1 - fy;
        if (y < 0 || y >= H) continue;
        const p = y * W + x;
        R[p] += wgt * a * (dot[0] + flash);
        G[p] += wgt * a * (dot[1] + flash);
        B[p] += wgt * a * (dot[2] + flash);
      }
  }
  // How many zeros are in, at the top right.
  const digits = String(min(NZ, round(S.z)));
  let x0 = ZC - 3 - (digits.length * 8 - 2);
  for (const ch of digits) {
    const bits = FONT[+ch];
    for (let r = 0; r < 5; r++)
      for (let cc = 0; cc < 3; cc++)
        if ((bits >> (14 - r * 3 - cc)) & 1)
          for (let a = 0; a < 4; a++) {
            const p = (3 + r * 2 + (a >> 1)) * W + x0 + cc * 2 + (a & 1);
            R[p] = dot[0];
            G[p] = dot[1];
            B[p] = dot[2];
          }
    x0 += 8;
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      display.setPixel(x, y, round(255 * min(1, R[p])), round(255 * min(1, G[p])), round(255 * min(1, B[p])));
    }
}
