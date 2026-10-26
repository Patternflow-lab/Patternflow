// ===== Patternflow pattern =====
// Title:   Erdős Discrepancy
// Family:  rhythm
// Idea:    A rhythm of hits (+1) and rests (-1) is heard by 64 listeners side by side, listener d taking only every d-th beat, and each writes the running sum of what it hears down its own column, one row a step with the newest at the bottom over a row of the beat itself, so the completely multiplicative rhythm weaves a quiet tartan, one set of nested bands coloured column by column by the rhythm's own signs, while coin-flip beats tear it into loud streaks, and whenever a sum beats the record so far the cells that did it light white.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Erdős discrepancy problem (Paul Erdős, 1932), solved by Terence Tao (2015), with the character-like functions of Peter Borwein, Stephen Choi and Michael Coons (2010), pattern round 56
// Round:   56
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Noise=0..1, Prime=3..13
//
// Knob 1: Hue. Turns both colours round the wheel together. At 0 sums above zero are aqua and sums below zero magenta, with records and the beat row white; at 0.25 blue and red, at 0.5 pink and green, at 0.75 lime and azure. The wheel skips orange and yellow, which read brown and olive in the dim cells of small sums.
// Knob 2: Speed. Steps a second, 4 x Speed: 8 at 2, so the 127 rows of carpet turn over in 16 s, 0.8 at 0.2 and 12 at 3. A run goes on to step 6,561 = 3^8, 13.7 minutes at 2, and starts again from the first 128 steps with fresh coin flips.
// Knob 3: Noise. Each beat is a coin flip instead of the multiplicative rhythm with chance Noise squared: 6% at 0.25, 25% at 0.5, 56% at 0.75, every beat at 1. At 0 every column is plus or minus the same walk, so the carpet is one column of bands times the rhythm's first 64 signs. At step 1,000 the 64 sums average 4 at 0 (all equal in size), 10 at 0.25, 18 at 0.5 and 25 at 0.75 and 1, and the record by then is 6 at 0 against 92 at 1 (mean of eight runs).
// Knob 4: Prime. The prime p of the character-like rhythm, the one of 3, 5, 7, 11 and 13 nearest the knob: x_n is the residue symbol mod p of n with every factor p taken out. Its running sum is a sum over the base-p digits of the step, so it grows like the digit count: at p = 3 each digit 1 adds one, and the largest sum up to step m is floor(log3(2m + 1)), never above log3 m + 1 (checked to m = 600,000), with the records at m = 1, 4, 13, 40, 121, 364, 1093 and 3280 lighting whole rows. Records by step 6,561 reach 8 at p = 3, 6 at 5, 10 at 7, 11 at 11 and 7 at 13; at 5 and 13 the sums change sign, so the bands swap colours row by row.

const W = 64, H = 128;
const { floor, min, max, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Steps a second at Speed 1, and the step at which the walk starts over.
const RATE = 4, LAST = 6561;
const PRIMES = [3, 5, 7, 11, 13];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Quadratic residues mod p, as +1 / -1 by residue.
function legendre(p) {
  const t = new Int8Array(p).fill(-1);
  t[0] = 0;
  for (let a = 1; a < p; a++) t[(a * a) % p] = 1;
  return t;
}

// A 32-bit integer hash, for the coin flips: each beat n has its own draw,
// fixed for the run, so every listener hears the same beat the same way.
function hash(n) {
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}

export function setup(params) {
  params.s = {
    M: 0, acc: 0, seed: 0, p: 3, noise: 0, hue: 0, speed: 2, chi: null,
    cur: new Int32Array(W + 1), ring: new Int16Array(H * W), mark: new Uint8Array(H * W),
    rec: 0, pal: new Float32Array(2), palHue: -1, key: '',
  };
}

// Beat n of the rhythm. Borwein, Choi and Coons' character-like function
// takes out every factor p and reads the rest as a residue mod p; with
// Noise the beat is a coin flip instead, with that chance.
function term(S, n) {
  const h = hash(n + S.seed);
  if ((h >>> 8) / 16777216 < S.noise) return h & 1 ? 1 : -1;
  const p = S.p;
  while (n % p === 0) n /= p;
  return S.chi[n % p];
}

// One step m for all 64 listeners: listener d hears beat m d.
function step(S) {
  const m = ++S.M, row = (m % H) * W, cur = S.cur;
  let top = 0;
  for (let d = 1; d <= W; d++) {
    cur[d] += term(S, m * d);
    S.ring[row + d - 1] = cur[d];
    S.mark[row + d - 1] = 0;
    top = max(top, abs(cur[d]));
  }
  // A new record discrepancy: the cells that set it.
  if (top > S.rec) {
    S.rec = top;
    for (let d = 1; d <= W; d++) if (abs(cur[d]) === top) S.mark[row + d - 1] = 1;
  }
}

// Start over from step 0 and run up to step `to`, as after a knob turn.
function rebuild(S, to) {
  S.M = 0;
  S.rec = 0;
  S.cur.fill(0);
  S.ring.fill(0);
  S.mark.fill(0);
  while (S.M < to) step(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 3], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  // The share of coin flips is the knob squared, so the first half of its
  // turn opens the carpet up gradually.
  const noise = cl(kv[2], 0, 1) ** 2;
  // The prime nearest the knob.
  let p = 3;
  for (const q of PRIMES) if (abs(q - kv[3]) < abs(p - kv[3])) p = q;
  if (!S.chi) S.seed = floor(Math.random() * 1e9);
  // A turned knob rewrites the whole walk so far with the new rhythm.
  const key = p + ':' + noise.toFixed(3);
  if (key !== S.key) {
    S.key = key;
    S.p = p;
    S.chi = legendre(p);
    S.noise = noise;
    rebuild(S, max(H, S.M));
  }
  S.acc += d * S.speed * RATE;
  while (S.acc >= 1) {
    S.acc -= 1;
    if (S.M >= LAST) {
      S.seed = floor(Math.random() * 1e9);
      rebuild(S, H);
    } else step(S);
  }
}

// The hue wheel skips orange through yellow, which read brown and olive on
// the dim cells of small sums.
const wheel = (h) => 0.25 + 0.78 * (h - floor(h));
function palette(S) {
  const P = S.pal;
  P[0] = wheel(0.282 + S.hue); // sums above zero: aqua at Hue 0
  P[1] = wheel(0.732 + S.hue); // sums below zero: magenta
  S.palHue = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.chi) return;
  if (S.palHue !== S.hue) palette(S);
  const P = S.pal, c = [0, 0, 0], M = S.M, beat = 1 - S.acc;
  for (let y = 0; y < H; y++) {
    // The bottom row plays the newest step; the carpet rises above it, the
    // newest sums on row 126.
    const m = y === H - 1 ? M : M - (H - 2 - y), row = (((m % H) + H) % H) * W;
    // Older rows dim a little toward the top, so the carpet reads as
    // written from the bottom.
    const age = 0.7 + 0.3 * (y / (H - 2));
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      if (m >= 1 && y === H - 1) {
        // The beat itself: a hit lights, a rest stays dark, fading over the step.
        const prev = m > 1 ? S.ring[(((m - 1) % H) * W) + x] : 0;
        if (S.ring[row + x] > prev) r = g = b = 0.3 + 0.7 * beat;
      } else if (m >= 1) {
        const s = S.ring[row + x], a = abs(s);
        if (S.mark[row + x]) (r = 1), (g = 1), (b = 1);
        else if (a) {
          // Brightness climbs from 0.28 at 1 to full at 5, then the colour
          // whitens a step for each doubling, nearly white past 80.
          hsv(s > 0 ? P[0] : P[1], 0.9 - 0.7 * cl(Math.log2(a / 5) / 4, 0, 1), min(1, 0.1 + 0.18 * a), c, 0);
          (r = c[0] * age), (g = c[1] * age), (b = c[2] * age);
        }
      }
      display.setPixel(x, y, (255 * r) | 0, (255 * g) | 0, (255 * b) | 0);
    }
  }
}
