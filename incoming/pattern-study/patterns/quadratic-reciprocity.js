// ===== Patternflow pattern =====
// Title:   Quadratic Reciprocity
// Family:  number
// Idea:    Two 64 x 64 tables of Legendre symbols (p/q), one LED per pair of 64 odd primes, light where p is a square mod q and dark where it is not, the top table in the primes' own order and the bottom one with the primes 1 mod 4 first, while a cross walks the diagonal comparing each pair with its mirror image, white where the two agree and green where they differ, which happens exactly when both primes are 3 mod 4, so the green builds a plaid on top and fills one corner block below.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: law of quadratic reciprocity (Adrien-Marie Legendre, 1785), conjectured by Leonhard Euler and first proved by Carl Friedrich Gauss (1796, published 1801), pattern round 59
// Round:   59
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..5, Start=0..400, Law=0.25..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 a residue is pale aqua and a non-residue deep indigo, the pairs the law flips lean to rose and plum, the diagonal is grey and the marks are white and green; at 0.5 the residues are pink, the non-residues dark green, the flipped pairs lean to blue and the marks are white and violet. The wheel skips orange through lime, which read brown and olive when dim.
// Knob 2: Speed. At 2 the cross moves 2 primes a second, down the 64 primes and back up in 63 seconds; a green mark fades to a third while the cross goes 12 primes on, 6 seconds, and a white one while it goes 2. 0.2 is ten times slower and 5 two and a half times faster.
// Knob 3: Start. Which 64 odd primes the tables use: at 0 the first 64, 3 to 313, of which 30 are 1 mod 4 and 34 are 3 mod 4; at 400 the 64 from the 401st on, 2753 to 3307, 33 and 31. The law holds in every window, and the bottom corner block is always the primes 3 mod 4 against each other.
// Knob 4: Law. How far the pairs of two primes 3 mod 4, the pairs the law says are flipped across the diagonal, lean towards rose: a quarter of the way at 0.25, a faint plaid on top and a pale 34 x 34 block in the bottom table's corner, and all the way at 1. The green marks fall on this tint and nowhere else.

const W = 64, H = 128, N = 64;
const { floor, max, abs, round, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Odd primes up to 4000 by a sieve; the last one Start reaches is the
// 464th, 3307.
const PRIMES = (() => {
  const top = 4000, comp = new Uint8Array(top + 1), out = [];
  for (let i = 3; i <= top; i += 2) {
    if (comp[i]) continue;
    out.push(i);
    for (let j = i * i; j <= top; j += 2 * i) comp[j] = 1;
  }
  return out;
})();

// The Legendre symbol (a/p) for an odd prime p by Euler's criterion:
// a^((p - 1) / 2) is 1 mod p when a is a nonzero square mod p, p - 1 when it
// is not, 0 when p divides a. Numbers stay below 4000^2, exact in doubles.
function legendre(a, p) {
  a %= p;
  if (a === 0) return 0;
  let e = (p - 1) / 2, b = a, r = 1;
  while (e > 0) {
    if (e & 1) r = (r * b) % p;
    b = (b * b) % p;
    e >>= 1;
  }
  return r === 1 ? 1 : -1;
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The knob turns hues on a wheel that skips orange through lime, which
// read brown and olive when dim. Hues are given as they look at knob 0,
// from 0.28 round to 1.02.
const tone = (h, k) => 0.28 + 0.74 * ((((h - 0.28) / 0.74 + k) % 1 + 1) % 1);

// The tables for the 64 primes from index start. leg[i * N + j] = (p_i /
// p_j) with p_i the row's prime, and 0 on the diagonal. ord[r] is the prime
// shown at row and column r of the bottom table: the primes 1 mod 4 in
// order, then those 3 mod 4.
function build(S, start) {
  S.start = start;
  const P = PRIMES.slice(start, start + N);
  S.P = P;
  S.three = P.map((p) => p % 4 === 3);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) S.leg[i * N + j] = i === j ? 0 : legendre(P[i], P[j]);
  const ord = [];
  for (let i = 0; i < N; i++) if (!S.three[i]) ord.push(i);
  S.n1 = ord.length;
  for (let i = 0; i < N; i++) if (S.three[i]) ord.push(i);
  S.ord = ord;
  S.mark.fill(0);
}

export function setup(params) {
  params.s = {
    start: -1,
    P: [],
    three: [],
    leg: new Int8Array(N * N),
    ord: [],
    n1: 0,
    // The walk: k is a position along the 64 primes, going down then up.
    k: 0,
    dir: 1,
    // The marks the cross leaves, one per pair, fading.
    mark: new Float32Array(N * N),
    hue: 0,
    law: 0.25,
    cross: new Float32Array(N),
    pal: new Float32Array(30),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.25], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  const speed = cl(kv[1], 0.2, 5);
  const start = round(cl(kv[2], 0, 400));
  S.law = cl(kv[3], 0.25, 1);
  if (start !== S.start) build(S, start);
  // 2 primes a second at Speed 2, bouncing at the ends.
  S.k += S.dir * d * speed;
  if (S.k > N - 1) (S.k = 2 * (N - 1) - S.k), (S.dir = -1);
  if (S.k < 0) (S.k = -S.k), (S.dir = 1);
  // The cross is on each prime by how near the walk is to it, so it slides
  // from one row to the next without a jump.
  for (let i = 0; i < N; i++) S.cross[i] = max(0, 1 - abs(i - S.k));
  // The cross leaves a mark on every pair it passes, (p/q) in row p and
  // (q/p) in column p. Where the pair and its mirror differ the mark is
  // green and fades to 1/e while the walk goes 12 primes on, 6 s at Speed
  // 2; where they agree it is white and fades in 2 primes.
  const fadeD = exp((-d * speed) / 12), fadeA = exp((-d * speed) / 2);
  const { leg, mark, cross } = S;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const q = i * N + j;
      let m = mark[q] * (leg[q] !== leg[j * N + i] ? fadeD : fadeA);
      const c = max(cross[i], cross[j]);
      if (c > m) m = c;
      mark[q] = m;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.start < 0) return;
  const { leg, mark, three, ord, pal, hue, law } = S;
  // Colours: residue, non-residue; the same two tinted for the flipped
  // pairs; the agreeing and differing marks of the cross; the diagonal.
  hsv(tone(0.5, hue), 0.4, 0.9, pal, 0);
  hsv(tone(0.68, hue), 0.85, 0.2, pal, 3);
  hsv(tone(0.96, hue), 0.5, 0.95, pal, 6);
  hsv(tone(0.88, hue), 0.9, 0.32, pal, 9);
  hsv(tone(0.5, hue), 0.08, 1, pal, 12);
  hsv(tone(0.5, hue), 0.25, 0.6, pal, 15);
  hsv(tone(0.34, hue), 0.8, 1, pal, 18);
  hsv(tone(0.34, hue), 0.95, 0.66, pal, 21);
  hsv(tone(0.5, hue), 0.12, 0.5, pal, 24);
  const c = [0, 0, 0];
  for (let half = 0; half < 2; half++)
    for (let y = 0; y < N; y++) {
      const i = half ? ord[y] : y;
      for (let x = 0; x < N; x++) {
        const j = half ? ord[x] : x, q = i * N + j, v = leg[q];
        if (v === 0) {
          // (p/p) = 0: the diagonal, the mirror's axis.
          c[0] = pal[24];
          c[1] = pal[25];
          c[2] = pal[26];
        } else {
          // The base colour, tinted by Law where both primes are 3 mod 4.
          const b = v > 0 ? 0 : 3, flip = three[i] && three[j] ? law : 0;
          for (let e = 0; e < 3; e++) c[e] = pal[b + e] + (pal[b + 6 + e] - pal[b + e]) * flip;
          // The marks: white where the pair agrees with its mirror, green
          // where it does not.
          const m = mark[q];
          if (m > 0.004) {
            const w = leg[j * N + i] === v ? (v > 0 ? 12 : 15) : v > 0 ? 18 : 21;
            for (let e = 0; e < 3; e++) c[e] += (pal[w + e] - c[e]) * m;
          }
        }
        display.setPixel(x, y + half * N, (255 * cl(c[0], 0, 1)) | 0, (255 * cl(c[1], 0, 1)) | 0, (255 * cl(c[2], 0, 1)) | 0);
      }
    }
}
