// ===== Patternflow pattern =====
// Title:   Goldbach Comet
// Family:  number
// Idea:    Every even number n up to 524,288 is a dot placed across the panel by how many ways it splits into two primes, measured against the Hardy-Littlewood count, with n climbing down the rows; the dots gather into sharp coloured streaks, one for each set of 3, 5 and 7 dividing n, that start as a loose spray and narrow as n grows, and fold a prime at a time into a single line when the correction is turned in.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Goldbach's comet, the partition counts of Goldbach's conjecture (Christian Goldbach, 1742), pattern round 33
// Round:   33
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Correction=0..1, Smear=0..1
//
// Knob 1: Hue. Turns the five colours round the wheel together. At 0 numbers divisible by 3 are gold, by 5 (not 3) green, by 7 (not 3 or 5) pink, by 11 sky blue and the rest pale blue.
// Knob 2: Speed. How fast n climbs: 0.12 octaves a second times the knob. The 128 rows hold four octaves of n, so at 2 the rows move up about eight a second and the tape runs from n = 512 to 524,288 and starts over in 43 seconds; at 0.2 it takes seven minutes.
// Knob 3: Correction. Divides the count by the Hardy-Littlewood singular series a prime at a time. At 0 each streak sits at its own factor from left to right: 1 for n with no odd prime up to 7, then 6/5 for 7, 4/3 for 5, 8/5 for 35, 2 for 3, 12/5 for 21, 8/3 for 15 and 16/5 for 105. Up to 1/3 the 7s fold onto the streaks beside them, up to 2/3 the 5s, and in the last third the 3s, while the whole comet glides into one line in the middle of the panel.
// Knob 4: Smear. How much of the series from the primes 11 and up is left in: almost none at the start, so each streak is one sharp line. At 1 each fans out to the right about four LEDs wide, since a multiple of 11 has 10/9 as many partitions, of 13 12/11 as many, and so on; that is the comet with nothing divided out but the smooth count.
// Buttons: K1 tap folds the correction all the way in over three seconds, holds the single line for two and lets it out again over three; with Correction past 0.5 it goes the other way.

const W = 64, H = 128, LOGM = 19, M = 1 << LOGM, HN = M >> 1;
const U0 = 9, U1 = LOGM, SPAN = 4, CAP = 160, XS = 40, X0 = 8, MID = 0.6;
const L3 = Math.log(2), L5 = Math.log(4 / 3), L7 = Math.log(6 / 5);
const C2 = 0.6601618158468696;
const { min, max, floor, ceil, log, exp, cos, sin, PI, LN2 } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Complex FFT of size n in place. tc/ts hold e^(-i pi k / half) at
// half + k for every stage, so each stage reads its twiddles in a row.
function fft(re, im, n, tc, ts, sign) {
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      (re[i] = re[j]), (re[j] = t);
      (t = im[i]), (im[i] = im[j]), (im[j] = t);
    }
  }
  for (let half = 1; half < n; half <<= 1)
    for (let i = 0, len = half << 1; i < n; i += len)
      for (let k = 0; k < half; k++) {
        const cr = tc[half + k], ci = sign * ts[half + k], a = i + k, b = a + half;
        const br = re[b], bi = im[b], xr = br * cr - bi * ci, xi = br * ci + bi * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
}

// g(n) for every even n up to 2^19, the number of ways n = p + q with
// primes p <= q. Odd primes 2a + 1 make a 0/1 string over a < 2^18, and
// its square under convolution counts the ordered pairs with
// a + b = n/2 - 1. The string is real, so it rides as one complex string
// of half the length (even a in the real part, odd a in the imaginary)
// and is pulled apart after the transform. Pairing up the 43,390 primes
// below 2^19 one by one would be 512 million steps; this is 55 to 110 ms.
// Checked against counting pairs one by one for every even n below 20,000
// and every 997th one above, up to g(2^19) = 2367: no misses. Run to 2^20
// it gave g(10^6) = 5402 with rounding errors under 2e-11, but took twice
// as long.
function goldbach(comp) {
  const n = HN, tc = new Float64Array(M), ts = new Float64Array(M);
  // The top stage by rotation, started afresh from cos and sin every 64
  // steps: 4096 calls to them instead of 262,144.
  const sr = cos(-PI / n), si = sin(-PI / n);
  for (let k = 0; k < n; k++) {
    if ((k & 63) === 0) (tc[n + k] = cos((-PI * k) / n)), (ts[n + k] = sin((-PI * k) / n));
    else {
      const a = tc[n + k - 1], b = ts[n + k - 1];
      (tc[n + k] = a * sr - b * si), (ts[n + k] = a * si + b * sr);
    }
  }
  for (let half = n >> 1; half >= 1; half >>= 1)
    for (let k = 0, st = n / half; k < half; k++) (tc[half + k] = tc[n + k * st]), (ts[half + k] = ts[n + k * st]);
  const zr = new Float64Array(n), zi = new Float64Array(n);
  for (let a = 1; a < n; a++) if (!comp[2 * a + 1]) (a & 1 ? zi : zr)[a >> 1] = 1;
  fft(zr, zi, n, tc, ts, 1);
  // X[k] and X[k + n] of the full string from Z[k] and Z[n - k]; square
  // them; fold the squares back into one half-length string, pairs k and
  // n - k together so it can be done in place.
  const out = new Float64Array(4);
  const fold = (k, j, o) => {
    const ar = zr[k], ai = zi[k], br = zr[j], bi = -zi[j];
    const er = (ar + br) / 2, ei = (ai + bi) / 2, odr = (ai - bi) / 2, odi = -(ar - br) / 2;
    const wr = tc[n + k], wi = ts[n + k], tr = odr * wr - odi * wi, ti = odr * wi + odi * wr;
    const x1r = er + tr, x1i = ei + ti, x2r = er - tr, x2i = ei - ti;
    const y1r = x1r * x1r - x1i * x1i, y1i = 2 * x1r * x1i, y2r = x2r * x2r - x2i * x2i, y2i = 2 * x2r * x2i;
    const sr = (y1r + y2r) / 2, si = (y1i + y2i) / 2, dr = (y1r - y2r) / 2, di = (y1i - y2i) / 2;
    out[o] = sr - (di * wr - dr * wi);
    out[o + 1] = si + (dr * wr + di * wi);
  };
  for (let k = 0; k <= n >> 1; k++) {
    const j = (n - k) & (n - 1);
    fold(k, j, 0);
    fold(j, k, 2);
    (zr[k] = out[0]), (zi[k] = out[1]), (zr[j] = out[2]), (zi[j] = out[3]);
  }
  fft(zr, zi, n, tc, ts, -1);
  const g = new Int32Array(HN + 1);
  for (let k = 0; k + 1 <= HN; k++) {
    const h = k + 1, c = Math.round((k & 1 ? zi[k >> 1] : zr[k >> 1]) / n) + (h & 1 && h > 2 && !comp[h] ? 1 : 0);
    g[h] = c >> 1;
  }
  g[2] = 1;
  return g;
}

// The Hardy-Littlewood count without its singular series: C2 times the
// integral of dt / (ln t ln(n - t)) from 2 to n - 2, on a table of 97
// points from n = 2^8 to 2^20 and read between them in ln n. C2 n / ln^2 n
// alone falls 23% short at n = 2000 and 15% at 500,000, and that drift
// would tip the streaks four LEDs across the tape. With the integral, g(n)
// over the whole prediction averages 0.953 at n = 2000, 0.982 at 20,000
// and 0.997 at 500,000, spread 5.7%, 2.9% and 0.9% about it, so a streak
// narrows from a spread of about two LEDs to a third of one.
function hlTable() {
  const t = new Float64Array(97);
  for (let j = 0; j < 97; j++) {
    const n = 2 ** (8 + j / 8), a = log(2), b = log(n / 2), K = 200, h = (b - a) / K;
    let s = 0;
    for (let i = 0; i <= K; i++) {
      const u = a + i * h, x = exp(u);
      s += ((i === 0 || i === K ? 1 : i & 1 ? 4 : 2) * x) / (u * log(n - x));
    }
    t[j] = log((2 * C2 * s * h) / 3);
  }
  return t;
}

export function setup(params) {
  const comp = new Uint8Array(M + 1);
  for (let i = 3; i * i <= M; i += 2) if (!comp[i]) for (let j = i * i; j <= M; j += 2 * i) comp[j] = 1;
  const g = goldbach(comp), hl = hlTable();
  // For each even n = 2h: which of 3, 5, 7 and 11 divide it (bits 1, 2, 4
  // and 8), and the log of the rest of its singular series, the product of
  // (p - 1)/(p - 2) over the odd primes p from 11 up that divide it.
  const bits = new Uint8Array(HN + 1), lr = new Float32Array(HN + 1), res = new Float32Array(HN + 1);
  for (let p = 3; p <= HN; p += 2) {
    if (comp[p]) continue;
    if (p > 7) {
      const f = log((p - 1) / (p - 2));
      for (let h = p; h <= HN; h += p) lr[h] += f;
    } else for (let h = p, b = p === 3 ? 1 : p === 5 ? 2 : 4; h <= HN; h += p) bits[h] |= b;
  }
  for (let h = 11; h <= HN; h += 11) bits[h] |= 8;
  // res is how far g(n) sits from the whole prediction, in ln: 0 would be
  // exactly Hardy-Littlewood. The prediction is read off the table once
  // every 16 numbers and drawn straight between.
  let hA = 0, hB = 0;
  const hlAt = (h) => {
    const z = cl((log(2 * h) / LN2 - 8) * 8, 0, 96), j = min(95, floor(z));
    return hl[j] + (hl[j + 1] - hl[j]) * (z - j);
  };
  for (let h = 4; h <= HN; h++) {
    if (((h - 4) & 15) === 0) (hA = hlAt(h)), (hB = hlAt(h + 16));
    const b = bits[h], small = (b & 1 ? L3 : 0) + (b & 2 ? L5 : 0) + (b & 4 ? L7 : 0);
    res[h] = log(g[h]) - lr[h] - small - (hA + ((hB - hA) * ((h - 4) & 15)) / 16);
  }
  params.s = {
    bits, lr, res, u: 10.6, hue: 0, speed: 2, kap: 0, smear: 0.06, bump: -1,
    acc: new Float32Array(W * 4), pal: new Float32Array(15), palHue: NaN, rgb: new Float32Array(W * H * 3),
    off: new Float32Array(16), cls: new Uint8Array(16),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.smear = cl(k[3], 0, 1);
  const k3 = cl(k[2], 0, 1);
  if (input.btnPressed && input.btnPressed[0]) P.bump = 0;
  // The tap sends the correction to the far end from the knob and back:
  // in for three seconds, held for two, out for three.
  let kap = k3;
  if (P.bump >= 0) {
    P.bump += d / 8;
    const b = P.bump < 3 / 8 ? sm((P.bump * 8) / 3) : P.bump < 5 / 8 ? 1 : sm(((1 - P.bump) * 8) / 3);
    kap = k3 + ((k3 < 0.5 ? 1 : 0) - k3) * b;
    if (P.bump >= 1) P.bump = -1;
  }
  P.kap = kap;
  P.u += d * P.speed * 0.12;
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { bits, lr, res, acc, pal, rgb, off, cls } = P;
  if (P.palHue !== P.hue) {
    // Gold, green, pink, sky blue and pale blue at Hue 0. The gold is kept
    // light so a thin streak of it does not read brown.
    const base = [[0.13, 0.62], [0.36, 0.75], [0.9, 0.55], [0.55, 0.7], [0.62, 0.35]];
    for (let c = 0; c < 5; c++) hsv(P.hue + base[c][0], base[c][1], 1, pal, c * 3);
    P.palHue = P.hue;
  }
  // The correction comes in a prime at a time: the first third of the knob
  // folds the 7s onto the streaks beside them, the second the 5s, the last
  // the 3s, while everything glides to meet in the middle.
  const kap = P.kap * 3, w7 = sm(kap), w5 = sm(kap - 1), w3 = sm(kap - 2);
  for (let b = 0; b < 16; b++) {
    off[b] = (b & 1 ? L3 * (1 - w3) : 0) + (b & 2 ? L5 * (1 - w5) : 0) + (b & 4 ? L7 * (1 - w7) : 0);
    cls[b] = (b & 1 ? 0 : b & 2 ? 1 : b & 4 ? 2 : b & 8 ? 3 : 4) * 3;
  }
  // Smear leaves in the primes from 11 up. Each of them moves its
  // multiples right by ln((p - 1)/(p - 2)), 0.105 for 11, 0.087 for 13,
  // 0.065 for 17, so left in they fan every streak out four LEDs wide.
  const shift = X0 + XS * MID * w3 - 0.5, keep = P.smear;
  // The view is four octaves of n, a strip of ln2 n: row y holds
  // [u + y du, u + (y + 1) du). The tape runs from 2^9 to 2^19 and starts
  // over after ten dark rows.
  const du = SPAN / H, u0 = U0, tape = U1 - u0 + 10 * du;
  for (let y = 0; y < H; y++) {
    acc.fill(0);
    let uu = u0 + ((((P.u - u0 + y * du) % tape) + tape) % tape);
    if (uu + du <= U1) {
      const hlo = max(4, ceil(2 ** uu / 2)), hhi = min(HN + 1, ceil(2 ** (uu + du) / 2));
      const count = hhi - hlo;
      // Every n in the row while there are few, every s-th when there are
      // more than CAP. s is a power of 2: a stride of 17 would keep only
      // multiples of 17 and move every streak 2.3 LEDs right by its 16/15.
      const s = count > CAP ? 2 ** ceil(Math.log2(count / CAP)) : 1;
      for (let h = ceil(hlo / s) * s; h < hhi; h += s) {
        const b = bits[h], x = shift + XS * (res[h] + keep * lr[h] + off[b]), x0 = floor(x), f = x - x0, c = cls[b];
        if (x0 >= 0 && x0 < W) {
          const o = x0 * 4, w = 1 - f;
          (acc[o] += w), (acc[o + 1] += w * pal[c]), (acc[o + 2] += w * pal[c + 1]), (acc[o + 3] += w * pal[c + 2]);
        }
        if (x0 + 1 >= 0 && x0 + 1 < W) {
          const o = x0 * 4 + 4;
          (acc[o] += f), (acc[o + 1] += f * pal[c]), (acc[o + 2] += f * pal[c + 1]), (acc[o + 3] += f * pal[c + 2]);
        }
      }
    }
    // Dots in one LED add up, on a log scale against the busiest LED of the
    // row: full at 40% of it, and one dot lights an LED to about a third in
    // a crowded row and to half in a sparse one, so a lone dot in a far
    // tail stays faint and the core of a streak stands out. The colour is
    // the mix of the classes that landed there.
    let top = 0;
    for (let x = 0; x < W; x++) top = max(top, acc[x * 4]);
    const norm = 1 / log(1 + 2 * max(4, 0.4 * top));
    for (let x = 0; x < W; x++) {
      const o = x * 4, a = acc[o], q = (y * W + x) * 3;
      if (a <= 0) {
        rgb[q] = rgb[q + 1] = rgb[q + 2] = 0;
        continue;
      }
      const lev = min(1, log(1 + 2 * a) * norm) / a;
      rgb[q] = acc[o + 1] * lev;
      rgb[q + 1] = acc[o + 2] * lev;
      rgb[q + 2] = acc[o + 3] * lev;
    }
  }
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q += 3) display.setPixel(x, y, min(255, rgb[q] * 255), min(255, rgb[q + 1] * 255), min(255, rgb[q + 2] * 255));
}
