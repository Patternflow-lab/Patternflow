// ===== Patternflow pattern =====
// Title:   Fraenkel Rhythm
// Family:  rhythm
// Idea:    Fraenkel's exact cover, m voices at the pairwise different steady rates (2^m - 1)/2^(i - 1) sharing one pulse so that every pulse is played exactly once, the cover he conjectured to be the only one, is drawn as a ruler rising up the panel with one tick per pulse as long as the voice that plays it, which comes out as the binary ruler with every inch mark cut away; a playhead sounds each tick as it passes, and the fourth knob pulls the rates off Fraenkel's until the ruler breaks into doubled ticks where two voices clash and dotted gaps where nobody plays.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Fraenkel's conjecture on exact covers by Beatty sequences (Aviezri Fraenkel, 1973); Beatty sequences (Samuel Beatty, 1926); pattern round 102
// Round:   102
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Drop=0..4, Detune=0..1
//
// Knob 1: Hue. Turns the voices round the wheel together, spaced evenly. At 0 with six voices the shortest ticks are cyan, then blue, magenta, red, yellow and the single longest tick green; at 0.5 the shortest are red.
// Knob 2: Speed. The ruler rises 8 rows a second for each unit, 16 at the opening 2: with six voices at 2 rows a pulse that is 8 pulses a second and the 63-pulse cycle passes the playhead in 7.9 s; with three voices at 6 rows a pulse it is 2.7 a second. 1.6 rows a second at 0.2, 24 at 3.
// Knob 3: Drop. Takes the densest voice away and closes the ruler up, one voice per unit. At 0 six voices on a cycle of 63 pulses, 2 rows a pulse; at 1 five on 31 pulses, 4 rows; at 2 four on 15, two cycles at 4 rows; at 3 three on 7, three cycles at 6 rows; at 4 two voices on 3, seven cycles at 6 rows.
// Knob 4: Detune. Pulls the rates from Fraenkel's toward all equal, by the square of the knob. The densities follow r^(m - i) with r = 2^(1 - u^2) at knob u, rounded to whole hits per panel so the score still repeats once a panel, and the phases slide from Fraenkel's toward a staircase. At the opening 0.06 six voices still play 32, 16, 8, 4, 2 and 1 of the 63 pulses and the phases have moved a fifth of their margin, so the cover is exact. The first clash comes at 0.14; at 0.2 the densest voice drops to 31 of 63, and 23 pulses clash while 25 go unplayed. At 1 three voices play every third pulse in a staircase and cover exactly again; six cannot, as 63 is not a multiple of 6. Two voices never break anywhere: Beatty's theorem fits any two rates whose densities add to 1.

// Fraenkel's conjecture. Take m >= 3 sequences floor(n a_i + b_i), n over
// the integers, with pairwise different rates a_i. If every integer is in
// exactly one of them, then a_i = (2^m - 1)/2^(i - 1), i = 1..m, up to order.
// Fraenkel stated it in 1973; it is proved for small m, not in general.
//
// The cover that does exist is the binary ruler. Over a cycle of N = 2^m - 1
// pulses, pulse k goes to the voice set by the 2-adic valuation of k: the
// odd pulses to the densest voice (rate N/2^(m-1)), k = 2 mod 4 to the next,
// and k = 2^(m-1) alone to the sparsest (rate N). On a ruler that is the
// length of the tick at k: the half-inch mark longest, the quarters next,
// the finest divisions shortest. The cycle is 2^m - 1 pulses, not 2^m,
// because the inch mark itself has no voice: cycle after cycle the ruler
// runs on with every inch mark cut out, and two shortest ticks meet there.
//
// setup() does not take that on trust. For each voice it searches the
// phases b = (2j + 1)/(2q) in [0, a), a = N/q, in exact integer arithmetic
// for the one where floor(n a + b) gives exactly the pulses of that
// valuation, checked over three cycles. It finds one for every voice and
// every m from 2 to 6 (there is only one in [0, a)), and those phases are
// all the drawing uses.
//
// Detune. Voice i plays pulse k when an integer lies in (k d_i + c_i,
// (k + 1) d_i + c_i], d_i = 1/a_i its density and c_i = -b_i/a_i its phase:
// the same floor(n a_i + b_i), counted from the pulse side. The knob moves
// the densities along r^(m - i) from r = 2 toward r = 1, rounded to whole
// hits per panel (K pulses) so the rates stay rational and the score repeats
// once a panel as the ruler rises, and moves the phases straight from
// Fraenkel's to those of the staircase, where the voice with the j-th
// shortest tick plays k = j mod m. For two
// voices the two phases are taken to add to the same whole number at both
// ends; with densities adding to 1 that is Beatty's condition, and every
// pulse stays covered once all the way. For three or more nothing keeps
// them, and every extra hit leaves a hole somewhere in the K pulses.

const W = 64, H = 128, XS = 0, XM = 58, MAXM = 6, SH = 0.3, YP = 40, START = 1;
const { floor, ceil, min, max, round, exp, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Rows a pulse and cycles on the panel, by voice count.
const ROWS = { 2: [6, 7], 3: [6, 3], 4: [4, 2], 5: [4, 1], 6: [2, 1] };

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

const ceilDiv = (a, b) => -floor(-a / b);

// Pulse k's valuation class in the cycle of N: k taken into 1..N.
function valuation(k, N) {
  let r = (((k - 1) % N) + N) % N + 1, v = 0;
  while (r % 2 === 0) {
    r /= 2;
    v++;
  }
  return v;
}

// The Fraenkel system for m voices, voice v = valuation v (v = 0 densest),
// and the staircase with equal rates, as phases c.
function system(m) {
  const N = 2 ** m - 1, cF = [], cE = [], beta = [];
  for (let v = 0; v < m; v++) {
    const q = 2 ** (m - 1 - v);
    let found = -1;
    for (let j = 0; j < N && found < 0; j++) {
      let ok = true;
      for (let k = 1; k <= 3 * N && ok; k++) {
        // Number of n with k <= n N/q + (2j + 1)/(2q) < k + 1.
        const c = ceilDiv(2 * q * (k + 1) - 2 * j - 1, 2 * N) - ceilDiv(2 * q * k - 2 * j - 1, 2 * N);
        if (c !== (valuation(k, N) === v ? 1 : 0)) ok = false;
      }
      if (ok) found = j;
    }
    // found is never -1 for m = 2..6; a miss would show as an empty voice.
    beta.push((2 * found + 1) / (2 * q));
    cF.push(-(2 * found + 1) / (2 * N));
    // Equal rates: voice v on k = v + 1 mod m, at the phase -(j + 1/2)/m
    // that puts it there, taken the nearest way round from Fraenkel's.
    let ce = 0;
    for (let j = 0; j < m; j++) {
      const cj = -(j + 0.5) / m;
      let ok = true;
      for (let k = 1; k <= m; k++) if (ceil((k + 1) / m + cj) - ceil(k / m + cj) !== (k === v + 1 ? 1 : 0)) ok = false;
      if (ok) ce = cj;
    }
    while (ce - cF[v] > 0.5) ce -= 1;
    while (ce - cF[v] < -0.5) ce += 1;
    cE.push(ce);
  }
  if (m === 2) {
    // Two voices: make the phase sums agree so the blend keeps them whole.
    const sF = cF[0] + cF[1], sE = cE[0] + cE[1];
    cE[1] += round(sF - sE);
  }
  return { m, N, cF, cE, beta };
}

export function setup(params) {
  const sys = {};
  for (let m = 2; m <= MAXM; m++) sys[m] = system(m);
  params.s = {
    sys, m: 0, u: -1, hue: 0, s: 0, pps: 1, K: 0, P: 2, N: 1,
    n: new Int32Array(MAXM), c: new Float64Array(MAXM),
    hits: new Uint8Array(64 * MAXM), cnt: new Uint8Array(64),
  };
}

// The score for the current knobs: whole hits per K pulses for each voice,
// so it repeats once per panel, and which voices play each of the K pulses.
function score(S, m, u) {
  const sy = S.sys[m], t = u * u, r = 2 ** (1 - t), [P, cyc] = ROWS[m], K = sy.N * cyc;
  let sum = 0;
  for (let v = 0; v < m; v++) sum += r ** (m - 1 - v);
  // Densities K r^(m-1-v)/sum, rounded to whole numbers that add to K
  // (largest remainders first); at r = 2 they are K 2^(m-1-v)/N exactly.
  const ex = [];
  let left = K;
  for (let v = 0; v < m; v++) {
    ex.push((K * r ** (m - 1 - v)) / sum);
    S.n[v] = floor(ex[v] + 1e-9);
    left -= S.n[v];
    S.c[v] = sy.cF[v] + (sy.cE[v] - sy.cF[v]) * t;
  }
  const ord = ex.map((x, v) => [x - S.n[v], v]).sort((a, b) => b[0] - a[0]);
  for (let i = 0; i < left; i++) S.n[ord[i][1]]++;
  S.P = P;
  S.K = K;
  S.N = sy.N;
  for (let k = 1; k <= K; k++) {
    let n = 0;
    for (let v = 0; v < m; v++) {
      const h = ceil(((k + 1) * S.n[v]) / K + S.c[v]) - ceil((k * S.n[v]) / K + S.c[v]);
      S.hits[(k - 1) * MAXM + v] = h > 0 ? 1 : 0;
      n += h > 0 ? 1 : 0;
    }
    S.cnt[k - 1] = n;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const m = MAXM - cl(round(k[2] || 0), 0, 4);
  const u = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  if (m !== S.m || abs(u - S.u) > 1e-6) {
    if (m !== S.m) S.s = START;
    S.m = m;
    S.u = u;
    score(S, m, u);
  }
  // The tape, in pulses: 8 rows a second for each unit of Speed.
  S.pps = (speed * 8) / S.P;
  S.s += d * S.pps;
  if (S.s > 1e6) S.s -= S.K * floor(S.s / S.K);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.m) return;
  const { m, K, P, N } = S, th = P / 2;
  const buf = new Float32Array(W * H * 3);
  const put = (x, y, c, b) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 3;
    buf[i] = max(buf[i], c[0] * b);
    buf[i + 1] = max(buf[i + 1], c[1] * b);
    buf[i + 2] = max(buf[i + 2], c[2] * b);
  };
  const cols = [];
  for (let v = 0; v < m; v++) cols.push(hsv(S.hue + 0.5 + v / m, 1, 1));
  const white = [1, 1, 1], grey = [0.75, 0.8, 0.85], red = [1, 0.16, 0.12];
  // Tick lengths, shortest for the densest voice, spread over 8..54 LEDs.
  const len = (v) => round(8 + (v * 46) / (m - 1));
  // Pulse k sits at row YP + (k - s) P: the tape rises, and a pulse sounds
  // as its rows reach the playhead.
  const s0 = S.s, kLo = floor(s0 - YP / P) - 1, kHi = ceil(s0 + (H - YP) / P) + 1;
  for (let y = 0; y < H; y++) put(XS, y, grey, 0.35);
  for (let kk = kLo; kk <= kHi; kk++) {
    const y0 = YP + floor((kk - s0) * P), k = ((((kk - 1) % K) + K) % K) + 1, n = S.cnt[k - 1];
    // Seconds since this pulse sounded (negative: still to come).
    const age = (s0 - kk) / S.pps;
    const f = age >= 0 ? exp(-age / 0.9) : 0, hot = age >= 0 ? exp(-age / 0.15) : 0;
    const b = 0.6 + 0.4 * f;
    if (n === 0) {
      // A hole: nobody plays. A dotted line where a tick should be, and a red
      // mark in the margin.
      for (let x = XS + 2; x < XM - 2; x += 3) put(x, y0, grey, 0.3 + 0.5 * f);
      for (let y = y0; y < y0 + th; y++) for (let x = XM + 1; x < W - 1; x++) put(x, y, red, 0.75 + 0.25 * f);
    } else {
      // One voice: its tick on the top half of the pulse's rows, and its
      // shadow on the rest. Two or more: the rows shared out, the longest
      // voice on top, and a white mark in the margin.
      const vs = [];
      for (let v = m - 1; v >= 0; v--) if (S.hits[(k - 1) * MAXM + v]) vs.push(v);
      const rows = n === 1 ? th : max(1, floor(P / n));
      vs.forEach((v, j) => {
        const c = cols[v], L = len(v);
        for (let y = y0 + j * rows; y < y0 + (j + 1) * rows && y < y0 + P; y++)
          for (let x = XS + 1; x <= XS + L; x++) {
            const w = hot * (0.25 + 0.75 * (x / (L + 1)));
            put(x, y, [c[0] + (1 - c[0]) * w, c[1] + (1 - c[1]) * w, c[2] + (1 - c[2]) * w], b);
          }
        if (n === 1) for (let y = y0 + th; y < y0 + P; y++) for (let x = XS + 1; x <= XS + L; x++) put(x, y, c, b * SH);
        // Sounding: the note head at the tick's end swells and burns white.
        if (hot > 0.02) {
          const yc = y0 + j * rows + (rows - 1) / 2, rr = 0.8 + 1.4 * hot;
          for (let y = floor(yc - rr); y <= ceil(yc + rr); y++)
            for (let x = floor(L - rr); x <= ceil(L + rr); x++) {
              const e = 1 - ((x - L) ** 2 + (y - yc) ** 2) / (rr * rr);
              const w = 0.7 * hot;
              if (e > 0) put(x, y, [c[0] + (1 - c[0]) * w, c[1] + (1 - c[1]) * w, c[2] + (1 - c[2]) * w], min(1, 0.5 + e) * hot);
            }
        }
      });
      if (n > 1) for (let y = y0; y < y0 + P; y++) for (let x = XM + 1; x < W - 1; x++) put(x, y, white, 0.7 + 0.3 * f);
    }
    // Where an inch mark was cut out, between pulse N and the next: a notch.
    if (k % N === 0) for (let x = XM - 4; x < XM; x++) put(x, y0 + P - 1, grey, 0.5);
  }
  // The playhead: a bright notch on the spine and a dim one at the margin.
  for (let y = YP; y < YP + max(1, th); y++) {
    put(XS, y, white, 1);
    put(XM - 1, y, white, 0.6);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, round(min(1, buf[i]) * 255), round(min(1, buf[i + 1]) * 255), round(min(1, buf[i + 2]) * 255));
    }
}
