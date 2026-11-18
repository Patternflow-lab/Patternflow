// ===== Patternflow pattern =====
// Title:   Halton Stripes
// Family:  noise
// Idea:    Three 64 by 40 squares stand one over the other on the panel and fill with 4,096 points arriving one after another, the top one the Halton sequence in the pair of primes the knob picks, opening on the twin primes 59 and 61, the middle one the sequence in 2 and 3, the bottom one pseudo-random points, so the middle fills as evenly as points can and the bottom leaves holes and clumps while the top lays its first points along a diagonal that widens into a band of stripes and fills in only after thousands of points, until a share of its points have their first two digits permuted and the stripes dissolve.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the radical inverse of Johannes van der Corput (1935), the Halton sequence that pairs it in two coprime bases (John H. Halton, Numerische Mathematik 2, 84-90, 1960), its stripes in large bases, and the digit permutations of Art B. Owen's scrambling (1995); pattern round 104
// Round:   104
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Even=0..16, Scramble=0..1
//
// Knob 1: Hue. Turns the arrival colours round the wheel; the first points are the start of the ramp and the last the end, half a turn on, each paled until it is bright enough to read. At 0 the ramp runs teal, blue, violet to pink; at 0.25 violet to orange; at 0.5 pink through red and yellow to green; at 0.75 yellow-green to blue; 1 is 0 again.
// Knob 2: Speed. At 2 the squares fill from 1 to 4,096 points in 6.95 s and each doubling of the count takes 0.94 s: the first 59 points are in at 1.7 s, 3,599 (59 times 61) at 6.8 s, and the last 500 land in 0.2 s. The finished squares are held 2.2 s, faded 0.8 s and black 0.3 s, so a cycle is 10.25 s. At 3 it is 6.8 s and at 0.2 it is 102 s; the first points come 18 a second at 2 and 1.8 a second at 0.2.
// Knob 3: Even. The pair of bases of the top square, by steps of one sixteenth of the knob, always two consecutive primes. At 0 the pair is (59, 61); 1 (53, 59); 2 (47, 53); 3 (43, 47); 4 (41, 43); 5 (37, 41); 6 (31, 37); 7 (29, 31); 8 (23, 29); 9 (19, 23); 10 (17, 19); 11 (13, 17); 12 (11, 13); 13 (7, 11); 14 (5, 7); 15 (3, 5); 16 (2, 3), where the top square is the middle one. At (59, 61) the largest empty rectangle is 25 percent of the square at 100 points and 21 percent at 300, where (2, 3) leaves 3 and 1 and random points 7 and 3.
// Knob 4: Scramble. The share of the top square's points whose first two digits are permuted, d to f d mod b, before they are mirrored. 0.06 and below is none, the opening; at 0.5 half the points keep the stripes and the rest scatter between them; at 1 all are permuted, the diagonal is gone and the largest empty rectangle at 100 points falls from 25 to 5 percent, with a fine hatch leaning the other way left in the fill. At pairs of small primes it changes little, and at (2, 3) only swaps the digits 1 and 2 of base 3.

// The radical inverse (van der Corput, 1935): write n in base b, mirror its
// digits about the point, phi_b(n) = sum of d_j / b^(j+1) for n = sum of d_j b^j.
// n = 1, 2, 3, ... in base 2 gives 1/2, 1/4, 3/4, 1/8, 5/8, 3/8, 7/8: every new
// point lands in the largest gap. Halton (1960) pairs two bases, x = phi_b1(n),
// y = phi_b2(n), and for coprime bases the points fill the square evenly at
// every n.
//
// The flaw is in the lowest digit. phi_b(n) starts with n mod b, so the first
// coarse cell of a point is (n mod b1, n mod b2), and consecutive n step both
// by one. With b1 = 59 and b2 = 61 the first 59 points lie on one diagonal of
// the 59 by 61 grid of coarse cells, the next 59 on a second diagonal 2/61 of
// the height from the first (59 mod 61 is -2), and so on: a band of near
// stripes that widens until n = 59 x 61 = 3,599, when every coarse cell holds
// its one point (the Chinese remainder theorem). The pair is twin primes, the
// closest two odd primes come, so the two digit-reversals track each other.
// Tested on a 64 by 40
// grid, the largest empty rectangle at 100 points is 24.6 percent of the
// square, at 300 points 20.6; the (2, 3) square leaves 3.3 and 1.0 and random
// points 7.4 and 3.0 (the mean of five seeds). Pairs below 59 and 61 have a
// smaller grid and stripes that close sooner, but (29, 31) still leaves 32
// percent of the cells empty at 4,096 points where random points leave 20.
//
// Scramble permutes the first two digits: the digit d becomes f d mod b before
// it is mirrored, f near 0.7549 b for x and 0.5698 b for y at the first digit
// and the two swapped at the second, the constants of the R2 recurrence (1/rho
// and 1/rho^2, rho the plastic number). Consecutive points then step across the
// coarse grid like a Kronecker sequence instead of along a line, and the early
// fill is even again: the largest empty rectangle of (59, 61) falls to 4.9 and
// 1.4 percent at 100 and 300 points. Owen (1995) permutes every digit at
// random, each by the digits before it. A random permutation of the first two
// digits, tried here, removes the stripes too but leaves 6.3 and 2.1 percent,
// about what random points do, so the permutation has to be a good one, and
// this fixed linear one is the simplest that is. The knob is the share of the
// points that get it, so at 0.5 every second point still draws the stripes.
//
// The panel plots n = 1 to 4,096 in each square, x = phi_b1(n) times 64 and
// y = phi_b2(n) times 40, the point lit in the cell it falls in, a soft blob of
// up to 2.5 cells while there are fewer than about 250. Points arrive at a rate
// that grows with n, so each doubling takes the same time. A cell shines by how
// many points are in it, and in the colour of the last one, and the newest 12
// percent glow white. The 64 columns and the 59 coarse columns do not line up:
// at 1,000 points of (59, 61) five runs of three or four columns hold 12 or 13
// points where the others hold 17, thin columns that stay however it is
// scrambled.

const W = 64, H = 128;
const { floor, round, min, max, exp, log, sqrt, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const PR = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61];
const NP = PR.length - 1;
// 1/rho and 1/rho^2, rho the plastic number, the constants of the R2 sequence.
const R2A = 0.7548776662, R2B = 0.5698402909;
const NMAX = 4096, N0 = 24;
const BH = 40, GAP = 4;
const BANDS = [0, BH + GAP, 2 * (BH + GAP)];
// Seconds at Speed 2: the arrival time constant, the hold on the finished
// squares, the fade and the blank before the next fill.
const TAU = 1.35, HOLD = 2.2, FADE = 0.8, BLANK = 0.3;
const TFILL = TAU * log((NMAX - 1) / N0 + 1);
const TCYC = TFILL + HOLD + FADE + BLANK;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// The arrival colours, 64 steps from the knob's hue half a turn on. Each is paled until its luma is 0.45, so blue is not the dim end.
const LUT = new Float32Array(64 * 3);
function buildLut(h0) {
  for (let i = 0; i < 64; i++) {
    const h = h0 + 0.5 * (i / 63);
    let sa = 0.9, c = hsv(h, sa, 1);
    for (let k = 0; k < 8 && 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] < 0.45; k++) c = hsv(h, (sa -= 0.08), 1);
    LUT[3 * i] = c[0];
    LUT[3 * i + 1] = c[1];
    LUT[3 * i + 2] = c[2];
  }
}

function hash(n) {
  let h = (n * 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The permutation of the digits 0..b-1 at each of the first two positions, for
// each prime: d to f d mod b with f near b times the given constants. Base 2
// has no multiplier but 1, so it keeps its digits.
function makePerm(alphas) {
  return PR.map((b) =>
    alphas.map((al) => {
      const f = b < 3 ? 1 : max(1, round(b * al));
      return Int32Array.from({ length: b }, (_, d) => (f * d) % b);
    }),
  );
}

// phi_b(n) for b = PR[bi], with its first two digits permuted when perm is given.
function radical(n, bi, perm) {
  const b = PR[bi];
  let m = n, inv = 1 / b, x = 0, j = 0;
  while (m > 0) {
    let d = m % b;
    m = (m - d) / b;
    if (perm && j < 2) d = perm[bi][j][d];
    x += d * inv;
    inv /= b;
    j++;
  }
  return x - floor(x);
}

export function setup(params) {
  const S = {
    t: 0, cyc: 0, key: "", nHave: 0, N: 0, fade: 1, hue: 0, scr: 0, pair: 0, lutHue: -9,
    permX: makePerm([R2A, R2B]), permY: makePerm([R2B, R2A]),
    hx: new Float32Array(NMAX + 1), hy: new Float32Array(NMAX + 1),
    ax: new Float32Array(NMAX + 1), ay: new Float32Array(NMAX + 1),
    rx: new Float32Array(NMAX + 1), ry: new Float32Array(NMAX + 1),
    acc: new Float32Array(W * BH), last: new Int32Array(W * BH),
  };
  // The (2, 3) square is the same every cycle.
  for (let n = 1; n <= NMAX; n++) {
    S.ax[n] = radical(n, 0, null);
    S.ay[n] = radical(n, 1, null);
  }
  fillRandom(S);
  params.s = S;
}

function fillRandom(S) {
  const rnd = rng(S.cyc * 7919 + 17);
  for (let n = 1; n <= NMAX; n++) {
    S.rx[n] = rnd();
    S.ry[n] = rnd();
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  // Even 0 is the pair (59, 61) and Even 16 is (2, 3).
  S.pair = NP - 1 - cl(round(k[2] || 0), 0, NP - 1);
  S.scr = cl(((k[3] == null ? 0.06 : k[3]) - 0.06) / 0.94, 0, 1);
  S.t += (d * speed) / 2;
  if (S.t >= TCYC) {
    S.t -= TCYC;
    S.cyc++;
    fillRandom(S);
  }
  const t = S.t, tEnd = TFILL + HOLD;
  S.N = t < TFILL ? min(NMAX, floor(N0 * (exp(t / TAU) - 1)) + 1) : t < tEnd + FADE ? NMAX : 0;
  S.fade = t < tEnd ? 1 : t < tEnd + FADE ? 1 - (t - tEnd) / FADE : 0;
  // The knob pair's points, as far as N reaches.
  const key = S.pair + "/" + S.scr.toFixed(3);
  if (key !== S.key) {
    S.key = key;
    S.nHave = 0;
  }
  for (let n = S.nHave + 1; n <= S.N; n++) {
    const p = S.scr > 0 && hash(n) < S.scr;
    S.hx[n] = radical(n, S.pair, p ? S.permX : null);
    S.hy[n] = radical(n, S.pair + 1, p ? S.permY : null);
  }
  S.nHave = max(S.nHave, S.N);
}

// Counts the first N points into acc, a soft blob each while there are few
// and one cell each from about 220 on, and keeps the last point in a cell.
function plot(S, xs, ys, N) {
  const { acc, last } = S;
  acc.fill(0);
  last.fill(0);
  const r = max(1, 2.5 - 0.55 * Math.log2(max(N, 40) / 40));
  const R = r > 1 ? ceil(r) : 0;
  for (let n = 1; n <= N; n++) {
    const cx = floor(xs[n] * W), cy = floor(ys[n] * BH);
    if (R === 0) {
      const c = cy * W + cx;
      acc[c] += 1;
      last[c] = n;
      continue;
    }
    for (let dy = -R; dy <= R; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= BH) continue;
      for (let dx = -R; dx <= R; dx++) {
        const x = cx + dx;
        if (x < 0 || x >= W) continue;
        const w = 1 - sqrt(dx * dx + dy * dy) / r;
        if (w <= 0) continue;
        const c = y * W + x;
        acc[c] += w;
        if (w > 0.3) last[c] = n;
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const N = S.N;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
  if (N < 1) return;
  const h0 = 0.42 + S.hue;
  if (S.lutHue !== h0) {
    S.lutHue = h0;
    buildLut(h0);
  }
  const G = max(3, 0.12 * N);
  const sets = [[S.hx, S.hy], [S.ax, S.ay], [S.rx, S.ry]];
  for (let b = 0; b < 3; b++) {
    plot(S, sets[b][0], sets[b][1], N);
    const y0 = BANDS[b];
    for (let y = 0; y < BH; y++)
      for (let x = 0; x < W; x++) {
        const c = y * W + x, a = S.acc[c];
        if (a <= 0) continue;
        const n = S.last[c] || 1;
        const u = cl((log(n) - 1.1) / (log(NMAX) - 1.1), 0, 1);
        const li = 3 * round(63 * u);
        const gl = max(0, (n - (N - G)) / G), g2 = gl * gl;
        const v = (1 - exp(-1.15 * a)) * S.fade * 255 * (1 + 0.3 * g2), w = 0.5 * g2;
        display.setPixel(
          x, y0 + y,
          round(min(255, (LUT[li] * (1 - w) + w) * v)),
          round(min(255, (LUT[li + 1] * (1 - w) + w) * v)),
          round(min(255, (LUT[li + 2] * (1 - w) + w) * v)),
        );
      }
  }
}
