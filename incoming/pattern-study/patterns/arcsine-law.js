// ===== Patternflow pattern =====
// Title:   Arcsine Law
// Family:  data
// Idea:    48 fair random walks come down the panel a row a step, each LED warm while its walk is above zero and cool below, and most columns turn out long stretches of one colour; after 126 steps the warm cells rise to the top of each column and the columns sort themselves by how many there are, so the boundary between the colours draws the arcsine quantile curve, while a histogram beside them gathers every walk so far into Lévy's U-shaped law, its exact values marked by white dots.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: arcsine laws (Paul Lévy, 1939)
// Round:   54
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Statistic=0..2, Drift=-1..1
//
// Knob 1: Hue. Turns every colour around the wheel together. At 0 a walk above zero is amber and below zero azure, pale near zero and deeper the further out it is, with lavender histogram bars; at 0.25 green above and magenta below, at 0.5 the two sides trade colours.
// Knob 2: Speed. 16 rows a second per unit: 32 at the opening 2, so a batch of 126 steps comes down in 3.9 s, settles and sorts in 1.4 s and holds for 1.4 s; at 0.2 a batch takes 39 s to come down, at 3 it takes 2.6 s. Walks that are not drawn feed the histogram at 120 a second per unit.
// Knob 3: Statistic. Which of Lévy's three the columns sort by and the histogram counts. At 0 the time above zero: the warm cells rise to the top of their column. At 1 the last zero: the cells before each walk's last return to zero are dimmed, leaving a bright tail of one colour below it. At 2 the first time of the maximum: the cells after each walk's highest point so far are dimmed. All three histograms settle on the same U.
// Knob 4: Drift. A step goes up with chance (1 + mu) / 2. mu is 0 within 0.08 of the middle, so the opening 0.06 is the fair walk, then grows as the square to 0.014 at 0.3, 0.052 at 0.5 and 0.25 at either end, where nearly every column floods one colour. Any drift breaks the law: at 0.5 the histogram of time above zero lies 0.19 from it in Kolmogorov distance, while the last zero, which only asks whether the walk comes back, lies 0.047 from it.

const W = 64, H = 128;
// 48 walks of 126 steps, one a column, step t drawn in row t - 1; then a
// dark column and the histogram, 15 columns wide, its bins two rows tall on
// the same time axis as the walks.
const NW = 48, N = 126, HX = 49, HL = 15, NB = 64;
const { floor, round, min, max, abs, sqrt, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return o;
}

// The exact laws for N = 126 steps, bin k of the histogram. The time spent
// above zero (counting a step as above when either end of it is) and the
// last zero both take the value 2k with probability u(2k) u(N - 2k), where
// u(2m) = C(2m, m) / 4^m is the chance of being at zero at time 2m (Chung
// and Feller, Sparre Andersen). The first time of the maximum is k with
// probability a(k) b(N - k): a(k) the chance a walk stays above zero for k
// steps, b(m) the chance it stays at or below zero for m, both by counting
// paths. Lévy's arcsine law is the limit of all three.
const U = new Float64Array(N + 1);
U[0] = 1;
for (let m = 1; 2 * m <= N; m++) U[2 * m] = (U[2 * m - 2] * (2 * m - 1)) / (2 * m);
function stay(strict) {
  // out[k]: chance that S_1..S_k all stay above zero (strict) or at or
  // below zero, by the distribution of the walk killed when it leaves.
  const out = new Float64Array(N + 1), off = N + 1;
  let p = new Float64Array(2 * N + 3), q = new Float64Array(2 * N + 3);
  p[off] = 1;
  out[0] = 1;
  for (let k = 1; k <= N; k++) {
    q.fill(0);
    let tot = 0;
    for (let x = 1; x < 2 * N + 2; x++) {
      const v = 0.5 * (p[x - 1] + p[x + 1]);
      const y = x - off;
      if (strict ? y > 0 : y <= 0) (q[x] = v), (tot += v);
    }
    [p, q] = [q, p];
    out[k] = tot;
  }
  return out;
}
const PB = [new Float64Array(NB), new Float64Array(NB), new Float64Array(NB)];
{
  const a = stay(true), b = stay(false);
  for (let k = 0; k < NB; k++) PB[0][k] = PB[1][k] = U[2 * k] * U[N - 2 * k];
  for (let t = 0; t <= N; t++) PB[2][t >> 1] += a[t] * b[N - t];
}
// The histogram's scale puts the third bin from either end at full length,
// so the two end bins, 2.6 and 1.3 times longer, run off the band.
const PFULL = PB[0][2];

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, stat: 0, mu: 0, init: false,
    // The batch on show: positions S[i * (N + 1) + t].
    S: new Int16Array(NW * (N + 1)), row: 0, phase: 0, clock: 0,
    pos: new Int16Array(NW), lz: new Int16Array(NW), tm: new Int16Array(NW), top: new Int16Array(NW),
    // Sorting: each walk's target column and each cell's target row.
    X: new Int16Array(NW), R: new Int16Array(NW * N), sortStat: -1,
    // The last sorted picture, shown dimmed below the new batch's front.
    prev: new Float32Array(NW * N * 3), cell: new Float32Array(NW * N * 3),
    hist: [new Float64Array(NB), new Float64Array(NB), new Float64Array(NB)], walks: 0, histMu: 0,
    fb: new Float32Array(W * H * 3), c: [0, 0, 0],
  };
}

// One walk's three statistics from its positions w[0..N].
function stats(w, o, out) {
  let pos = 0, lz = 0, tm = 0, top = 0;
  for (let t = 1; t <= N; t++) {
    const a = w[o + t - 1], b = w[o + t];
    if (a + b > 0) pos++;
    if (b === 0) lz = t;
    if (b > top) (top = b), (tm = t);
  }
  out[0] = pos;
  out[1] = lz;
  out[2] = tm;
}

const tmpW = new Int16Array(N + 1), tmpS = [0, 0, 0];
function hiddenWalk(S) {
  const p = (1 + S.mu) / 2;
  tmpW[0] = 0;
  for (let t = 1; t <= N; t++) tmpW[t] = tmpW[t - 1] + (Math.random() < p ? 1 : -1);
  stats(tmpW, 0, tmpS);
  addStats(S, tmpS);
}
function addStats(S, st) {
  S.hist[0][st[0] >> 1]++;
  S.hist[1][st[1] >> 1]++;
  S.hist[2][st[2] >> 1]++;
  S.walks++;
}

function stepRow(S) {
  const t = S.row + 1, p = (1 + S.mu) / 2, A = S.S;
  for (let i = 0; i < NW; i++) {
    const o = i * (N + 1), b = (A[o + t] = A[o + t - 1] + (Math.random() < p ? 1 : -1)), a = A[o + t - 1];
    if (a + b > 0) S.pos[i]++;
    if (b === 0) S.lz[i] = t;
    if (b > S.top[i]) (S.top[i] = b), (S.tm[i] = t);
  }
  S.row = t;
}

function newBatch(S) {
  S.S.fill(0);
  S.pos.fill(0);
  S.lz.fill(0);
  S.tm.fill(0);
  S.top.fill(0);
  S.row = 0;
  S.phase = 0;
  S.clock = 0;
}

// The statistic each walk is sorted by, and where each cell goes: for the
// time above zero the cells above zero rise to the top of their column in
// their order and the rest sink below them; for the other two the cells
// stay in their rows.
function plan(S) {
  const st = S.stat === 0 ? S.pos : S.stat === 1 ? S.lz : S.tm, A = S.S;
  const idx = [...Array(NW).keys()].sort((a, b) => st[a] - st[b] || A[a * (N + 1) + N] - A[b * (N + 1) + N] || a - b);
  idx.forEach((w, r) => (S.X[w] = r));
  for (let i = 0; i < NW; i++) {
    const o = i * (N + 1);
    let up = 0, down = S.pos[i];
    for (let t = 1; t <= N; t++) {
      const above = A[o + t - 1] + A[o + t] > 0;
      S.R[i * N + t - 1] = S.stat === 0 ? (above ? up++ : down++) : t - 1;
    }
  }
  S.sortStat = S.stat;
}

// A cell's colour: warm above zero and cool below, paler near zero and
// deeper the further the walk is out in units of sqrt(t); dimmed before
// the last zero or after the maximum when those are the statistic.
function shade(S, i, t, out) {
  const o = i * (N + 1), a = S.S[o + t - 1], b = S.S[o + t], m = min(1, abs(a + b) / (2.2 * sqrt(t)));
  if (a + b > 0) hsv(0.11 + S.hue, 0.3 + 0.7 * m, 1, out);
  else hsv(0.6 + S.hue, 0.3 + 0.65 * m, 1, out);
  let dim = false;
  if (S.stat === 1) dim = t <= S.lz[i];
  else if (S.stat === 2) dim = t > S.tm[i];
  if (dim) {
    const g = (out[0] + out[1] + out[2]) / 3;
    for (let c = 0; c < 3; c++) out[c] = 0.2 * (0.4 * out[c] + 0.6 * g);
  }
  return out;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  S.stat = cl(round(kv[2]), 0, 2);
  // Drift: none within 0.08 of the middle, then growing as the square to
  // 0.25 at either end; the chance of a step up is (1 + mu) / 2.
  const k4 = cl(kv[3], -1, 1), e = max(0, (abs(k4) - 0.08) / 0.92);
  S.mu = (k4 < 0 ? -1 : 1) * 0.25 * e * e;
  if (S.mu !== S.histMu) {
    for (const h of S.hist) h.fill(0);
    S.walks = 0;
    S.histMu = S.mu;
  }
  if (!S.init) {
    // A first batch, run and sorted at once, is the picture the panel
    // opens on while the next one comes down over it.
    S.init = true;
    newBatch(S);
    while (S.row < N) stepRow(S);
    plan(S);
    keep(S, 0.75);
    newBatch(S);
  }
  // Walks nobody sees feed the histogram, 8 a frame at Speed 2.
  S.hidden = (S.hidden || 0) + (d * 30 * 8 * S.speed) / 2;
  while (S.hidden >= 1) hiddenWalk(S), S.hidden--;
  const rate = 16 * S.speed, slow = sqrt(2 / S.speed);
  S.clock += d;
  if (S.phase === 0) {
    const want = min(N, floor(S.clock * rate));
    while (S.row < want) stepRow(S);
    if (S.row >= N) {
      for (let i = 0; i < NW; i++) addStats(S, [S.pos[i], S.lz[i], S.tm[i]]);
      plan(S);
      S.phase = 1;
      S.clock = 0;
    }
  } else {
    if (S.stat !== S.sortStat) plan(S), (S.clock = 0), (S.phase = 1);
    if (S.phase === 1 && S.clock > 1.4 * slow) (S.phase = 2), (S.clock = 0);
    if (S.phase === 2 && S.clock > 1.4 * slow) keep(S, 0.75), newBatch(S);
  }
}

// Store the sorted picture of the batch, dimmed by f, as the backdrop.
function keep(S, f) {
  const P = S.prev, c = S.c;
  P.fill(0);
  for (let i = 0; i < NW; i++)
    for (let t = 1; t <= N; t++) {
      shade(S, i, t, c);
      const q = (S.R[i * N + t - 1] * NW + S.X[i]) * 3;
      P[q] = c[0] * f;
      P[q + 1] = c[1] * f;
      P[q + 2] = c[2] * f;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.init) return;
  const fb = S.fb, c = S.c, P = S.prev;
  fb.fill(0);
  if (S.phase === 0) {
    // The old picture below the front on every other LED, the new walks
    // above it.
    for (let r = S.row; r < N; r++)
      for (let x = (r + 1) & 1; x < NW; x += 2) {
        const q = (r * W + x) * 3, s = (r * NW + x) * 3;
        fb[q] = P[s];
        fb[q + 1] = P[s + 1];
        fb[q + 2] = P[s + 2];
      }
    for (let i = 0; i < NW; i++)
      for (let t = 1; t <= S.row; t++) {
        shade(S, i, t, c);
        const q = ((t - 1) * W + i) * 3;
        fb[q] = c[0];
        fb[q + 1] = c[1];
        fb[q + 2] = c[2];
      }
  } else {
    // Settle first, then slide the columns into their order.
    const u = S.phase === 2 ? 1 : S.clock / (1.4 * sqrt(2 / S.speed));
    const ey = ease(u * 2), ex = ease(u * 2 - 1);
    for (let i = 0; i < NW; i++) {
      const x = round(i + (S.X[i] - i) * ex);
      for (let t = 1; t <= N; t++) {
        const y = round(t - 1 + (S.R[i * N + t - 1] - (t - 1)) * ey);
        shade(S, i, t, c);
        const q = (y * W + x) * 3;
        fb[q] = c[0];
        fb[q + 1] = c[1];
        fb[q + 2] = c[2];
      }
    }
  }
  // Once the columns stand in order, a dot in each marks where Lévy's law
  // puts that rank: column r of 48 at N sin^2(pi (r + 1/2) / 96), the
  // arcsine quantile. The boundary of the batch should hug it.
  if (S.phase === 2) {
    const v = 0.85 * min(1, S.clock / 0.4);
    for (let r = 0; r < NW; r++) {
      const sn = sin((PI * (r + 0.5)) / (2 * NW)), y = min(N - 1, floor(N * sn * sn)), q = (y * W + r) * 3;
      for (let j = 0; j < 3; j++) fb[q + j] += (255 - fb[q + j]) * v;
    }
  }
  // The histogram of the chosen statistic over every walk so far, and the
  // exact law as a dot at the length each bar should reach.
  const h = S.hist[S.stat], pb = PB[S.stat], n = max(1, S.walks), sc = HL / PFULL;
  for (let k = 0; k < NB; k++) {
    const len = (h[k] / n) * sc, ex = pb[k] * sc;
    for (let j = 0; j < HL; j++) {
      const f = cl(len - j, 0, 1), y0 = 2 * k;
      let r = 0, g = 0, b = 0;
      // The bar, the shortfall from the law dimmer, and the law's dot.
      const sf = j >= len && j < ex - 0.5 ? 0.3 : 0;
      if (f > 0 || sf) hsv(0.8 + S.hue, 0.35, f > 0 ? 0.3 + 0.6 * f : sf, c), (r = c[0]), (g = c[1]), (b = c[2]);
      if (abs(j + 0.5 - ex) < 0.5) (r = 255), (g = 255), (b = 255);
      for (let y = y0; y < y0 + 2; y++) {
        const q = (y * W + HX + j) * 3;
        fb[q] = r;
        fb[q + 1] = g;
        fb[q + 2] = b;
      }
    }
  }
  for (let p = 0; p < W * H; p++) display.setPixel(p % W, (p / W) | 0, fb[p * 3] | 0, fb[p * 3 + 1] | 0, fb[p * 3 + 2] | 0);
}
