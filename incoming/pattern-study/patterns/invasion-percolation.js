// ===== Patternflow pattern =====
// Title:   Invasion Percolation
// Family:  sim
// Idea:    Invasion percolation from one inlet in the middle of the bottom row: every cell holds a random threshold, the invader takes the cheapest cell on its border one step at a time and is coloured teal to violet in the order it took them, defender it cuts off from the top row is trapped for good and turns rose, and when the invader reaches the top row the shortest channel through it lights gold and a fresh lattice begins.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: invasion percolation (David Wilkinson and Jorge Willemsen, 1983), pattern round 32
// Round:   32
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Gravity=-1..1, Grain=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the invaded cells run from teal (the first taken) through blue to violet (the last), freshly taken cells flash white, trapped defender is rose, the untouched thresholds are dim warm sand, lighter where the threshold is low, and the breakthrough channel is pale gold.
// Knob 2: Speed. How fast the invader takes cells. At 2 a run from the inlet to the top row takes 5.5 s however many cells it needs (1,900 to 3,100 at the start knobs), at 0.2 it takes 55 s and at 3 it takes 3.7 s. A cell's share of that time grows as e^(17 (r - p_c)) up to r = p_c + 0.03, so the front hangs on a cell with a threshold near p_c = 0.5927 and then floods the cheap cells behind it in a burst.
// Knob 3: Gravity. Tilts the thresholds with height: a cell counts r - 0.7 x Gravity x h, h running from 0 on the bottom row to 1 on the top. At 0 the invasion is pure. At 1 the top cells are 0.7 cheaper and one narrow finger climbs, 800 to 1,300 cells to the top; at -1 they are 0.7 dearer, the front rises level and takes 3,700 to 4,100.
// Knob 4: Grain. How far the thresholds are correlated. At 0 each cell draws its own; towards 1 the draws are blurred over about 2.5 cells, the sand turns to soft light and dark patches, and the invader runs along the light ones in rounded channels. Each threshold stays uniform on 0..1 at every setting; only its likeness to its neighbours changes.
// Buttons: K1 tap draws a fresh threshold for every cell and starts the invasion again from the inlet while the old picture fades in about half a second.

const W = 64, H = 128, N = W * H, OUT = N, BIG = 1 << 30;
const { floor, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Threshold tilt from bottom to top at Gravity 1.
const GA = 0.7;
// Seconds the finished cluster stands, its channel lighting in the first 0.6.
const HOLD = 1.1;
// Site percolation threshold of the square lattice (Newman and Ziff, 2000).
// Of the thresholds the invader takes, 0.4 to 2 in a hundred lie above it.
const PC = 0.592746;
const JUMP = 17;
const INLET = N - W + (W >> 1);

// The normal distribution function, after Abramowitz and Stegun 7.1.26.
function phi(z) {
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const e = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-x * x);
  return z < 0 ? 0.5 - 0.5 * e : 0.5 + 0.5 * e;
}

// Three box blurs of radius 2, across and then down: close to a Gaussian of
// 2.45 cells.
function blur(a, b) {
  for (let pass = 0; pass < 6; pass++) {
    const across = pass % 2 === 0;
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0;
      let s = 0, n = 0;
      for (let d = -2; d <= 2; d++) {
        const xx = across ? x + d : x, yy = across ? y : y + d;
        if (xx >= 0 && xx < W && yy >= 0 && yy < H) (s += a[yy * W + xx]), n++;
      }
      b[i] = s / n;
    }
    a.set(b);
  }
}

// Thresholds: white Gaussian noise mixed with its own blur by Grain, then
// sent through the normal distribution function, so every cell's threshold
// is uniform on [0, 1) whatever the grain and only the correlation changes.
function field(P) {
  const { r, g0, g1 } = P, a = P.grain, b = Math.sqrt(1 - a * a);
  let m = 0, q = 0;
  for (let i = 0; i < N; i++) {
    const v = b * g0[i] + a * g1[i];
    r[i] = v;
    m += v;
    q += v * v;
  }
  m /= N;
  const sd = Math.sqrt(Math.max(q / N - m * m, 1e-12));
  for (let i = 0; i < N; i++) r[i] = phi((r[i] - m) / sd);
}

function lattice(P) {
  const { g0, g1 } = P;
  for (let i = 0; i < N; i++) g0[i] = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  g1.set(g0);
  blur(g1, P.re);
  let m = 0, q = 0;
  for (let i = 0; i < N; i++) (m += g1[i]), (q += g1[i] * g1[i]);
  m /= N;
  const sd = Math.sqrt(q / N - m * m);
  for (let i = 0; i < N; i++) g1[i] = (g1[i] - m) / sd;
  P.grain = NaN;
  P.k = 0;
  P.K = 0;
  P.budget = 0;
  P.hold = -1;
  P.ord.fill(-1);
  P.trap.fill(BIG);
  P.path.fill(-1);
  P.pathLen = 0;
  P.grav = NaN;
}

export function setup(params) {
  const F = () => new Float32Array(N + 1), I = () => new Int32Array(N + 1);
  params.s = {
    r: F(), re: F(), g0: F(), g1: F(), stepT: F(), dur: F(), cr: F(), cg: F(), cb: F(), oldR: F(), oldG: F(), oldB: F(),
    seq: I(), ord: I(), path: I(), prev: I(), trap: I(), heap: I(), tmp: I(), cnt: I(), par: I(), nxt: I(), tail: I(), size: I(), join: I(),
    inv: new Uint8Array(N + 1), inH: new Uint8Array(N + 1), good: new Uint8Array(N + 1),
    pathLen: 0, k: 0, K: 0, budget: 0, clock: 0, hold: -1, oldA: 0, grav: NaN, grain: NaN, hue: 0, speed: 2, flash: 0,
  };
  lattice(params.s);
}

// From the cells already invaded, runs invasion without trapping to the top
// row, then walks the run backwards with union-find over the defending cells
// to learn which steps trapping would have refused and when each pocket of
// defender was cut off from the top row.
function compute(P) {
  const { r, re, seq, ord, trap, heap, tmp, cnt, par, nxt, tail, size, join, inv, inH, good } = P;
  const from = P.k, g = P.grav * GA;
  for (let i = 0; i < N; i++) re[i] = r[i] - (g * (H - 1 - ((i / W) | 0))) / (H - 1);
  inv.fill(0);
  inH.fill(0);
  for (let j = 0; j < from; j++) inv[seq[j]] = 1;
  for (let i = 0; i < N; i++) if (!inv[i] && trap[i] > from) (trap[i] = BIG), (ord[i] = -1);
  let n = 0;
  const push = (i) => {
    if (inv[i] || inH[i] || trap[i] <= from) return;
    inH[i] = 1;
    const v = re[i];
    let c = n++;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (re[heap[p]] <= v) break;
      heap[c] = heap[p];
      c = p;
    }
    heap[c] = i;
  };
  const pop = () => {
    const top = heap[0], last = heap[--n], v = re[last];
    let c = 0;
    for (;;) {
      let m = 2 * c + 1;
      if (m >= n) break;
      if (m + 1 < n && re[heap[m + 1]] < re[heap[m]]) m++;
      if (re[heap[m]] >= v) break;
      heap[c] = heap[m];
      c = m;
    }
    heap[c] = last;
    return top;
  };
  const around = (i, f) => {
    const x = i % W;
    if (x > 0) f(i - 1);
    if (x < W - 1) f(i + 1);
    if (i >= W) f(i - W);
    if (i < N - W) f(i + W);
  };
  push(INLET);
  for (let j = 0; j < from; j++) around(seq[j], push);
  let M = 0;
  while (n > 0) {
    const i = pop();
    inH[i] = 0;
    inv[i] = 2;
    tmp[M++] = i;
    if (i < W) break;
    around(i, push);
  }

  for (let i = 0; i <= N; i++) (par[i] = i), (nxt[i] = -1), (tail[i] = i), (size[i] = 1), (join[i] = -1);
  const find = (i) => {
    while (par[i] !== i) (par[i] = par[par[i]]), (i = par[i]);
    return i;
  };
  let t = M;
  const unite = (a, b) => {
    a = find(a);
    b = find(b);
    if (a === b) return;
    if (b === OUT) (b = a), (a = OUT);
    if (a === OUT) {
      for (let m = b; m >= 0; m = nxt[m]) join[m] = t;
      par[b] = OUT;
      return;
    }
    if (size[a] < size[b]) {
      const s = a;
      (a = b), (b = s);
    }
    par[b] = a;
    size[a] += size[b];
    nxt[tail[a]] = b;
    tail[a] = tail[b];
  };
  // The defender joins across corners too: a diagonal gap between two
  // invaded cells lets it through.
  const around8 = (i, f) => {
    const x = i % W, l = x > 0, rr = x < W - 1;
    if (l) f(i - 1);
    if (rr) f(i + 1);
    if (i >= W) {
      f(i - W);
      if (l) f(i - W - 1);
      if (rr) f(i - W + 1);
    }
    if (i < N - W) {
      f(i + W);
      if (l) f(i + W - 1);
      if (rr) f(i + W + 1);
    }
  };
  for (let i = 0; i < N; i++) {
    if (inv[i]) continue;
    if (i < W) unite(i, OUT);
    around8(i, (j) => !inv[j] && unite(i, j));
  }
  for (t = M - 1; t >= 0; t--) {
    const c = tmp[t];
    inv[c] = 0;
    if (c < W) unite(c, OUT);
    around8(c, (j) => !inv[j] && unite(c, j));
    good[t] = find(c) === OUT ? 1 : 0;
  }
  let k = from;
  for (t = 0; t < M; t++) {
    if (good[t]) (seq[k] = tmp[t]), (ord[tmp[t]] = k), k++;
    cnt[t] = k;
  }
  P.K = k;
  for (let i = 0; i < N; i++) {
    if (trap[i] !== BIG || ord[i] >= 0) continue;
    const j = join[i];
    if (j >= 0 && j < M) trap[i] = cnt[j];
  }
  durations(P);
}

function durations(P) {
  const { re, seq, dur } = P;
  let s = 0;
  for (let k = 0; k < P.K; k++) {
    dur[k] = exp(JUMP * Math.min(re[seq[k]] - PC, 0.03));
    s += dur[k];
  }
  const m = P.K / Math.max(s, 1e-9);
  for (let k = 0; k < P.K; k++) dur[k] *= m;
}

// The channel the invader flows through once it breaks through: the shortest
// path inside the cluster from the inlet to the cell that reached the top row,
// found breadth first. Each cell on it keeps its place along the path.
function channel(P) {
  const { ord, prev, heap: queue, path, seq, K } = P;
  prev.fill(-2);
  const end = seq[K - 1];
  let qh = 0, qt = 0;
  queue[qt++] = INLET;
  prev[INLET] = -1;
  while (qh < qt) {
    const i = queue[qh++];
    if (i === end) break;
    const x = i % W;
    for (const j of [i - W, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i + W])
      if (j >= 0 && j < N && ord[j] >= 0 && ord[j] < K && prev[j] === -2) (prev[j] = i), (queue[qt++] = j);
  }
  let n = 0;
  for (let i = end; i >= 0; i = prev[i]) n++;
  P.pathLen = n;
  for (let i = end; i >= 0; i = prev[i]) path[i] = --n;
}

function restart(P) {
  P.oldA = 1;
  P.oldR.set(P.cr);
  P.oldG.set(P.cg);
  P.oldB.set(P.cb);
  lattice(P);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = kv[0];
  P.speed = cl(kv[1], 0.2, 3);
  const g = cl(kv[2], -1, 1), gr = cl(kv[3], 0, 1);
  P.clock += d;
  if (input.btnPressed && input.btnPressed[0]) restart(P);
  if (P.hold < 0 && (g !== P.grav || gr !== P.grain)) {
    if (gr !== P.grain) (P.grain = gr), field(P);
    P.grav = g;
    compute(P);
  }
  P.oldA *= exp(-d / 0.45);
  P.flash *= exp(-d / 0.4);
  if (P.hold < 0) {
    P.budget += (d * P.K * P.speed) / 11;
    while (P.k < P.K && P.budget >= P.dur[P.k]) (P.budget -= P.dur[P.k]), (P.stepT[P.k] = P.clock), P.k++;
    if (P.k >= P.K) (P.hold = 0), (P.flash = 1), channel(P);
  } else if ((P.hold += d) > HOLD) restart(P);
}

const C = [0, 0, 0];
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = h | 0, f = h - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  if (i === 0) (C[0] = v), (C[1] = t), (C[2] = p);
  else if (i === 1) (C[0] = q), (C[1] = v), (C[2] = p);
  else if (i === 2) (C[0] = p), (C[1] = v), (C[2] = t);
  else if (i === 3) (C[0] = p), (C[1] = q), (C[2] = v);
  else if (i === 4) (C[0] = t), (C[1] = p), (C[2] = v);
  else (C[0] = v), (C[1] = p), (C[2] = q);
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { r, ord, trap, stepT, path, cr, cg, cb, oldR, oldG, oldB, k, K } = P;
  const h0 = P.hue, now = P.clock, oa = P.oldA, fl = P.flash, hold = P.hold;
  hsv(h0 + 0.13, 0.5, 1);
  const gR = C[0], gG = C[1], gB = C[2];
  for (let i = 0; i < N; i++) {
    const o = ord[i];
    let R, G, B;
    if (o >= 0 && o < k) {
      const f = o / K;
      const age = now - stepT[o];
      hsv(h0 + 0.45 + 0.28 * f, 0.8, 0.55 + 0.25 * f + 0.2 * fl);
      (R = C[0]), (G = C[1]), (B = C[2]);
      const w = exp(-age / 0.3);
      if (w > 0.003) (R += (1 - R) * w), (G += (1 - G) * w), (B += (0.95 - B) * w);
      const j = path[i];
      if (j >= 0) {
        const u = cl(hold / 0.6 - j / P.pathLen, 0, 1);
        if (u > 0) (R += (gR - R) * u), (G += (gG - G) * u), (B += (gB - B) * u);
      }
    } else if (trap[i] <= k) {
      hsv(h0 + 0.95, 0.6, 0.1 + 0.22 * (1 - r[i]));
      (R = C[0]), (G = C[1]), (B = C[2]);
      const w = exp(-(now - stepT[trap[i] - 1]) / 0.5);
      if (w > 0.003) (R += (1 - R) * w * 0.6), (G += (0.6 - G) * w * 0.6), (B += (0.8 - B) * w * 0.6);
    } else {
      hsv(h0 + 0.08, 0.35, 0.035 + 0.1 * (1 - r[i]) ** 1.5);
      (R = C[0]), (G = C[1]), (B = C[2]);
    }
    R *= 255;
    G *= 255;
    B *= 255;
    if (oa > 0.01) (R = Math.max(R, oldR[i] * oa)), (G = Math.max(G, oldG[i] * oa)), (B = Math.max(B, oldB[i] * oa));
    (cr[i] = R), (cg[i] = G), (cb[i] = B);
    display.setPixel(i % W, (i / W) | 0, R, G, B);
  }
}
