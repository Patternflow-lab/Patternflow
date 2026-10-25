// ===== Patternflow pattern =====
// Title:   Chebyshev's Bias
// Family:  number
// Idea:    The panel's height is the number line from 32 at the bottom to 2^21 at the top on a log scale and its 64 columns are 64 prime races counted by the pattern's own sieve; a white front climbs and paints each LED blue where the side Chebyshev expected leads, brighter the larger its lead in Rubinstein and Sarnak's units, and orange where the other side leads, so the field fills with the bias and the rare orange specks stand out, the first for 1 mod 4 over 3 mod 4 at 26,861, each long-awaited one sending a ring across the panel as the front passes it.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Chebyshev's bias (Pafnuty Chebyshev, 1853), with Rubinstein and Sarnak's logarithmic density (1994), pattern round 48
// Round:   48
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Races=0..2, Margin=0..1
//
// Knob 1: Hue. Turns the three colours round the wheel together. At 0 the leading side is blue, the specks where the other side leads orange and the close calls violet; at 0.25 magenta, green and orange; at 0.5 orange, azure and green, the orange paled so the weak leads do not read brown; at 0.75 green, magenta and azure.
// Knob 2: Speed. The front climbs 6.4 rows a second for each unit, 12.8 at 2, so x doubles every 0.63 s: it passes 26,861 at 6.1 s and 616,841 at 8.9 s and reaches 2^21 at 10 s, the field holds 2.5 s and dims back to the ghost of itself over 1.2 s, and the front starts again from 32. At 0.2 all ten times slower, a climb of 100 s; at 3 a climb of 6.7 s.
// Knob 3: Races. Which 64 races, the columns ordered by the mean lead the theory expects, largest at the left. At 0 the quadratic non-residues against the residues for every modulus from 3 to 66, each side averaged over its classes: first the five where 1 has eight square roots (24, 40, 48, 56, 60), brightest and never led by the other side, then the 24 with four, of which only 7 are ever led, then the 35 with two, from 3 and 4 on, where the orange gathers and 43 has the other side ahead on 42% of the line. At 1 the class -1 against the class 1 for the same moduli: where -1 is not a square it leans like the race at 0, and the 15 moduli at the right where it is one (5, 10, 13, 17, 25 and on) are fair races, barcodes of blue and orange. At 2 non-residues against residues for the 64 odd primes from 3 to 313 in order: the orange thickens as the modulus grows, in 16% of the rows of the first sixteen columns and a third of those of the last thirty-two. A new choice is counted in under a second.
// Knob 4: Margin. How near a tie a lead must come to show as a close call in violet, in Rubinstein and Sarnak's units where the mod 4 lead averages 1: 0 at 0, 0.12 at the opening 0.06, 0.5 at a quarter, 1 at half, where most of the races with two square roots of 1 have turned violet, and 2 at 1, where only the five with eight keep much blue.
// Buttons: K1 tap starts the climb again from 32.

const W = 64, H = 128;
const { floor, round, min, max, sqrt, log, exp, sin, cos, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The number line: row r from the bottom covers x in [B[r], B[r + 1]), eight
// rows to each doubling, from 32 to 32 * 2^16 = 2^21 = 2,097,152.
const RPD = 8, X0 = 32, X1 = 1 << 21;
const B = new Float64Array(H + 1);
for (let r = 0; r <= H; r++) B[r] = round(X0 * 2 ** (r / RPD));
// Rubinstein and Sarnak's normaliser log x / sqrt x at each row's middle.
const NRM = new Float64Array(H);
for (let r = 0; r < H; r++) {
  const xm = X0 * 2 ** ((r + 0.5) / RPD);
  NRM[r] = log(xm) / sqrt(xm);
}

// The pattern's own sieve of Eratosthenes up to 2^21, once, on the odd
// numbers only: SV[k] marks 2k + 1 composite. 155,611 primes.
const SV = new Uint8Array((X1 >> 1) + 1);
for (let i = 3; i * i <= X1; i += 2) if (!SV[i >> 1]) for (let j = (i * i) >> 1; j <= X1 >> 1; j += i) SV[j] = 1;
const PT = new Int32Array(160000);
let NP = 1;
PT[0] = 2;
for (let k = 1; 2 * k + 1 < X1; k++) if (!SV[k]) PT[NP++] = 2 * k + 1;
const PR = PT.subarray(0, NP);

const gcd = (a, b) => {
  while (b) [a, b] = [b, a % b];
  return a;
};
// A race mod q: a weight for each class, plus for the side expected to lead
// and minus for the other, so D = sum of weights over primes <= x is the
// race. K turns D into the lead L = K D log x / sqrt x, scaled so that L
// averages s / 2 when s is the number of square roots of 1 mod q: 1 for
// 3 mod 4 against 1 mod 4, as in Rubinstein and Sarnak.
function raceNR(q) {
  const T = new Int32Array(q), sq = new Uint8Array(q);
  let phi = 0, nr = 0, s = 0;
  for (let a = 1; a < q; a++)
    if (gcd(a, q) === 1) {
      phi++;
      sq[(a * a) % q] = 1;
      if ((a * a) % q === 1) s++;
    }
  for (let a = 1; a < q; a++) if (gcd(a, q) === 1 && sq[a]) nr++;
  const nn = phi - nr;
  // Weights |R| for a non-residue, -|N| for a residue: the race of the two
  // sides' averages per class.
  for (let a = 1; a < q; a++) if (gcd(a, q) === 1) T[a] = sq[a] ? -nn : nr;
  return { q, T, K: phi / (2 * nn * nr), s, mean: s / 2 };
}
// The class q - 1 (that is -1) against the class 1: biased like the race
// above when -1 is not a square mod q, fair when it is.
function racePair(q) {
  const T = new Int32Array(q), r = raceNR(q);
  let phi = 0;
  for (let a = 1; a < q; a++) if (gcd(a, q) === 1) phi++;
  T[q - 1] = 1;
  T[1] = -1;
  return { q, T, K: phi / 2, s: r.s, mean: r.T[q - 1] > 0 ? r.s / 2 : 0 };
}
// Columns left to right by the mean lead the theory expects, largest
// first, then by modulus.
const order = (a, b) => b.mean - a.mean || a.q - b.q;
const ODD = [];
for (let k = 1; ODD.length < W; k++) ODD.push(PR[k]);
const FAMS = [
  Array.from({ length: W }, (_, c) => raceNR(c + 3)).sort(order),
  Array.from({ length: W }, (_, c) => racePair(c + 3)).sort(order),
  ODD.map(raceNR),
];

// Hues at knob 0: the leading side blue, the other side's specks orange,
// close calls violet.
const HUE_LEAD = 0.6, HUE_SPECK = 0.085, HUE_CLOSE = 0.8;
// Front speed in rows a second for each unit of Speed; the hold at the top
// and the fade back to the ghost, in seconds at Speed 2. Above the front the
// last count shows at GHOST of its brightness.
const RATE = 6.4, HOLD = 2.5, FADE = 1.2, GHOST = 0.3;
// Primes the count takes each frame: 26 frames for the whole count.
const STEPS = 6000;
// A ring goes out when the other side takes the lead after the expected
// side has held it for RING rows, x grown 16 times over.
const RING = 32;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// One count of a family's 64 races from 2 to 2^21. Per LED, row-major from
// the bottom row: the share of the row's x where the other side led, the
// share tied, the mean lead and the least lead; and every time the other
// side took the lead, with how many rows the expected side had held it.
// The classes' weights sit in one table, column c's from OFF[c].
function newCount(f) {
  const races = FAMS[f], OFF = new Int32Array(W);
  let n = 0;
  for (let c = 0; c < W; c++) (OFF[c] = n), (n += races[c].q);
  const TT = new Int32Array(n);
  for (let c = 0; c < W; c++) TT.set(races[c].T, OFF[c]);
  const C = {
    Q: Int32Array.from(races, (r) => r.q), KK: Float64Array.from(races, (r) => r.K), OFF, TT,
    D: new Int32Array(W), pos: X0, pi: 0, row: 0,
    neg: new Float64Array(W), tie: new Float64Array(W), sum: new Float64Array(W), mn: new Int32Array(W),
    lastNeg: new Int16Array(W).fill(-1),
    NEG: new Float32Array(W * H), TIE: new Float32Array(W * H), ML: new Float32Array(W * H), MINL: new Float32Array(W * H),
    ev: [],
  };
  // The primes below 32 are in before the first row opens.
  for (; PR[C.pi] < X0; C.pi++) for (let c = 0; c < W; c++) C.D[c] += TT[OFF[c] + (PR[C.pi] % C.Q[c])];
  openRow(C);
  return C;
}

function openRow(C) {
  C.neg.fill(0);
  C.tie.fill(0);
  C.sum.fill(0);
  C.mn.set(C.D);
}

// Between two primes the race stands still, so each stretch to the next
// prime or row boundary is added to the row's tallies whole.
function tally(C, len) {
  const { D, neg, tie, sum } = C;
  for (let c = 0; c < W; c++) {
    const d = D[c];
    if (d < 0) neg[c] += len;
    else if (d === 0) tie[c] += len;
    sum[c] += d * len;
  }
}

function closeRow(C) {
  const r = C.row, len = B[r + 1] - B[r];
  for (let c = 0, o = r * W; c < W; c++, o++) {
    const k = C.KK[c] * NRM[r];
    C.NEG[o] = C.neg[c] / len;
    C.TIE[o] = C.tie[c] / len;
    C.ML[o] = (k * C.sum[c]) / len;
    C.MINL[o] = k * C.mn[c];
    if (C.neg[c] > 0) C.lastNeg[c] = r;
  }
  C.row++;
  openRow(C);
}

// Runs the count on by at most n primes: the whole count is 155,611
// primes and 128 rows, about 10 million small steps for the 64 races.
function step(C, n) {
  const { D, Q, OFF, TT, neg, tie, sum, mn } = C;
  while (C.row < H && n-- > 0) {
    const p = C.pi < NP ? PR[C.pi] : X1 + 1, b = B[C.row + 1];
    // A prime on a row boundary belongs to the row above.
    if (b <= p) {
      tally(C, b - C.pos);
      C.pos = b;
      closeRow(C);
      continue;
    }
    const len = p - C.pos;
    for (let c = 0; c < W; c++) {
      const d = D[c];
      if (d < 0) neg[c] += len;
      else if (d === 0) tie[c] += len;
      sum[c] += d * len;
      const w = TT[OFF[c] + (p % Q[c])];
      if (!w) continue;
      const e = d + w;
      D[c] = e;
      if (e < mn[c]) mn[c] = e;
      if (d >= 0 && e < 0) {
        C.ev.push({ c, x: p, run: C.row - C.lastNeg[c] });
        C.lastNeg[c] = C.row;
      }
    }
    C.pos = p;
    C.pi++;
  }
}

// The front's height for x, in rows from the bottom.
const rowOf = (x) => RPD * Math.log2(x / X0);

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, fam: -1, margin: 0.12, cnt: [null, null, null], C: null,
    F: 0, phase: 0, timer: 0, alpha: 1, t: 0, next: 0, skip: 0,
    bursts: [], buf: new Float32Array(W * H * 3), col: new Float32Array(12), lut: new Float32Array(99),
  };
}

function replay(S) {
  S.F = 0;
  S.skip = 0;
  S.phase = 0;
  S.alpha = 1;
  S.next = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.margin = 2 * cl(kv[3], 0, 1);
  const f = round(cl(kv[2], 0, 2));
  if (f !== S.fam) {
    // Each family is counted once, the first time it is asked for.
    S.fam = f;
    S.C = S.cnt[f] || (S.cnt[f] = newCount(f));
    S.bursts.length = 0;
    S.next = 0;
    // A count already done has its lead changes below the front passed;
    // a new one finds them as it goes, and they pass without a ring.
    while (S.next < S.C.ev.length && rowOf(S.C.ev[S.next].x) < S.F) S.next++;
    S.skip = S.F;
  }
  // The count runs ahead of the front, done in under a second.
  step(S.C, STEPS);
  const ds = (d * S.speed) / 2;
  S.t += ds;
  if (input.btnPressed && input.btnPressed[0]) replay(S);
  if (S.phase === 0) {
    S.F = min(H, S.F + d * RATE * S.speed);
    // The lead changes the front has just passed.
    const ev = S.C.ev;
    while (S.next < ev.length && rowOf(ev[S.next].x) < S.F) {
      const e = ev[S.next++];
      // A flip back and forth inside one lead change is not a new one.
      if (e.run < 3 || (e.run < RING && S.bursts.length > 12) || rowOf(e.x) < S.skip) continue;
      S.bursts.push({ c: e.c, r: floor(rowOf(e.x)), t: 0, run: e.run });
    }
    if (S.F >= H) (S.phase = 1), (S.timer = HOLD);
  } else if (S.phase === 1) {
    if ((S.timer -= ds) < 0) (S.phase = 2), (S.timer = FADE);
  } else {
    S.timer -= ds;
    S.alpha = max(0, S.timer / FADE);
    if (S.timer < 0) replay(S);
  }
  for (const b of S.bursts) b.t += ds;
  S.bursts = S.bursts.filter((b) => b.t < 1.6);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.C) return;
  const buf = S.buf, K = S.col, Cn = S.C, m = S.margin, F = S.F;
  buf.fill(0);
  hsv(HUE_SPECK + S.hue, 0.78, 1, K, 0);
  hsv(HUE_CLOSE + S.hue, 0.55, 0.78, K, 3);
  // The lead side in 33 steps of u = 1 - exp(-L / 1.6), brighter and paler
  // the larger the mean lead L. Turned to orange or yellow it starts paler
  // and brighter, or the weak leads would read brown.
  const lut = S.lut, hl = HUE_LEAD + S.hue, wf = max(0, cos(2 * PI * (hl - 0.1))) ** 3;
  for (let i = 0; i <= 32; i++) {
    const u = i / 32;
    hsv(hl, 0.92 - 0.3 * u * u - 0.45 * wf, 0.2 + 0.55 * wf + (0.68 - 0.4 * wf) * u, lut, i * 3);
  }
  for (let r = 0; r < Cn.row; r++) {
    const y = H - 1 - r;
    // Painted below the front, the ghost above it; freshly painted rows
    // glow white for a moment under the front.
    const lit = r < F ? GHOST + (1 - GHOST) * S.alpha : GHOST;
    const gl = S.phase === 0 && r < F ? exp(-(F - r - 1) / 1.6) * 0.55 : 0;
    for (let c = 0; c < W; c++) {
      const o = r * W + c, q = (y * W + c) * 3;
      let R, G, Bl;
      if (Cn.NEG[o] > 0) {
        // The other side led here: a speck that never dims below 0.8.
        const v = (0.8 + 0.2 * sqrt(Cn.NEG[o])) * (0.88 + 0.12 * sin(S.t * 3 + c * 1.7 + r * 0.9));
        (R = K[0] * v), (G = K[1] * v), (Bl = K[2] * v);
      } else if (Cn.TIE[o] >= 1) {
        // Tied all along the row: neither leads.
        (R = 0.24), (G = 0.24), (Bl = 0.28);
      } else if (Cn.MINL[o] < m) {
        (R = K[3]), (G = K[4]), (Bl = K[5]);
      } else {
        const i = round(32 * (1 - exp(-max(0, Cn.ML[o]) / 1.6))) * 3;
        (R = lut[i]), (G = lut[i + 1]), (Bl = lut[i + 2]);
      }
      if (gl > 0.01) (R += (1 - R) * gl), (G += (1 - G) * gl), (Bl += (1 - Bl) * gl);
      buf[q] = R * lit;
      buf[q + 1] = G * lit;
      buf[q + 2] = Bl * lit;
    }
  }
  // The front: a white row tinted by who leads there.
  if (S.phase === 0 && F < H) {
    const r = floor(F), y = H - 1 - r;
    hsv(HUE_LEAD + S.hue, 0.5, 1, K, 9);
    for (let c = 0; c < W; c++) {
      const q = (y * W + c) * 3, k = Cn.NEG[r * W + c] > 0 ? 0 : 9;
      buf[q] = 0.5 + 0.5 * K[k];
      buf[q + 1] = 0.5 + 0.5 * K[k + 1];
      buf[q + 2] = 0.5 + 0.5 * K[k + 2];
    }
  }
  // Each new lead change flashes white; a long-awaited one sends out a ring
  // in the specks' colour, the wider the longer the wait.
  for (const b of S.bursts) {
    const cx = b.c + 0.5, cy = H - 1 - b.r + 0.5;
    if (b.t < 0.35) {
      const q = ((H - 1 - b.r) * W + b.c) * 3;
      buf[q] = buf[q + 1] = buf[q + 2] = 1;
    }
    if (b.run < RING) continue;
    const big = min(1, (b.run - RING + 8) / 40), rad = 1 + b.t * (6 + 12 * big), f = (0.4 + 0.6 * big) * (1 - b.t / 1.6);
    const y0 = max(0, floor(cy - rad - 1)), y1 = min(H - 1, floor(cy + rad + 1));
    for (let y = y0; y <= y1; y++)
      for (let x = max(0, floor(cx - rad - 1)); x <= min(W - 1, floor(cx + rad + 1)); x++) {
        const dd = abs(sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) - rad);
        if (dd >= 1.2) continue;
        const q = (y * W + x) * 3, w = f * (1 - dd / 1.2);
        buf[q] += (K[0] - buf[q]) * w;
        buf[q + 1] += (K[1] - buf[q + 1]) * w;
        buf[q + 2] += (K[2] - buf[q + 2]) * w;
      }
  }
  for (let p = 0, q = 0; p < W * H; p++, q += 3) {
    const r = buf[q], g = buf[q + 1], b = buf[q + 2];
    if (r + g + b < 0.02) continue;
    // Each channel in steps of 4 of 255.
    display.setPixel(p % W, (p / W) | 0, min(255, round(r * 63.75) * 4), min(255, round(g * 63.75) * 4), min(255, round(b * 63.75) * 4));
  }
}
