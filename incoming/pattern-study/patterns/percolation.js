// ===== Patternflow pattern =====
// Title:   Percolation
// Family:  cells
// Idea:    Site percolation on the panel's 64x128 square lattice: every LED keeps one random number and is open while that number is below p, open neighbours join into clusters of their own colour, and as p sweeps slowly up through the critical point 0.5927 the clusters merge until one first joins the top row to the bottom row, flashes white and burns gold, with its shortest open path traced in white and drops running down it.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: percolation (Simon Broadbent and John Hammersley, 1957), pattern round 30
// Round:   30
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Window=0.04..0.2, Small=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the clusters take hues from green through cyan and blue to magenta (0.33 to 0.88 of the wheel) and the crossing cluster is gold at 0.125; the gold always sits in the middle of the gap the cluster hues leave, so at 0.5 the clusters run magenta through red and orange to green and the crossing one is periwinkle.
// Knob 2: Speed. How fast p rises and falls. At 2 one rise and fall takes 12 s at the opening Window (25 s at Window 0.2), and the first crossing comes 2.7 s in; at 3 it comes after 1.8 s, at 0.2 after 27 s.
// Knob 3: Window. How far below p_c the sweep goes; it always ends 0.3 of that above p*, the lowest p at which this lattice has an open path from top to bottom. At 0.04 p runs 0.553 to 0.616 on the study's lattice and stays where clusters of every size touch; at 0.2 it reaches down to 0.39, where the open sites stand apart in small clusters on black, and ends at 0.66, where one cluster holds nearly every open site.
// Knob 4: Small. How bright the smaller clusters burn against the largest, which is always at full. At -1 brightness goes as the fourth power of log size over log largest size, so only the few biggest clusters show; at 0 a lone open site burns at 30%, and at 1 at 80%, and every cluster shows as a patch of its own colour.
// Buttons: K1 tap draws a fresh number for every site, finds the new lattice's p* and sets the sweep to reach it 2.7 seconds later.

const W = 64, H = 128, N = W * H;
const { min, max, floor, exp, log, cos, sqrt, acos, imul } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Site percolation threshold of the square lattice with edge neighbours,
// found numerically (Newman and Ziff, 2000, give 0.59274621). Below it every
// cluster on the infinite lattice is finite; above it one is infinite; at it
// the clusters are fractal, of dimension 91/48, at every scale.
const PC = 0.592746;
// Phase speed of the sweep per unit of Speed, over the root of the sweep's
// width in p, so a wide Window sweeps faster in p but not in proportion.
const RATE = 0.0657;
// Crossing comes this many seconds after the start, at Speed 2.
const LEAD = 2.7;

// Union-find with union by size and path halving.
function find(par, i) {
  while (par[i] !== i) {
    const g = par[par[i]];
    par[i] = g;
    i = g;
  }
  return i;
}

function join(par, sz, a, b) {
  a = find(par, a);
  b = find(par, b);
  if (a === b) return;
  if (sz[a] < sz[b]) {
    const t = a;
    a = b;
    b = t;
  }
  par[b] = a;
  sz[a] += sz[b];
}

function hash(i) {
  let h = imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// p*, the lattice's own crossing point: open the sites one at a time in the
// order of their numbers, as Newman and Ziff do, with the top row joined to
// one extra node and the bottom row to another, and stop when the two meet.
// On a 64-wide strip it lands a few hundredths either side of p_c; the
// study's seed gives 0.6038.
function threshold(P) {
  const { u, par, sz } = P;
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => u[a] - u[b]);
  const on = new Uint8Array(N);
  (par[N] = N), (par[N + 1] = N + 1), (sz[N] = sz[N + 1] = 1);
  for (const i of order) {
    (on[i] = 1), (par[i] = i), (sz[i] = 1);
    const x = i % W, y = (i / W) | 0;
    if (x > 0 && on[i - 1]) join(par, sz, i, i - 1);
    if (x < W - 1 && on[i + 1]) join(par, sz, i, i + 1);
    if (y === 0) join(par, sz, i, N);
    else if (on[i - W]) join(par, sz, i, i - W);
    if (y === H - 1) join(par, sz, i, N + 1);
    else if (on[i + W]) join(par, sz, i, i + W);
    if (find(par, N) === find(par, N + 1)) return u[i];
  }
  return 1;
}

function lattice(P) {
  for (let i = 0; i < N; i++) P.u[i] = Math.random();
  P.pstar = threshold(P);
  P.id.fill(-1);
  (P.span = false), (P.soft = 1);
}

// The sweep runs from W below p_c (or below p*, on a lattice that crosses
// early) to 0.3 W above p*, so every rise ends in a crossing. Returns the
// phase speed.
function sweep(P, win, speed) {
  P.lo = min(PC, P.pstar) - win;
  P.hi = P.pstar + 0.3 * win;
  return (RATE * speed) / sqrt(P.hi - P.lo);
}

// Puts the phase LEAD seconds before the crossing at the given Window and
// Speed. p = lo + (hi - lo)(1 - cos phase) / 2.
function aim(P, win, speed) {
  const w = sweep(P, win, speed);
  P.phase = acos(cl(1 - (2 * (P.pstar - P.lo)) / (P.hi - P.lo), -1, 1)) - LEAD * w;
}

export function setup(params) {
  const I = () => new Int32Array(N + 2), F = () => new Float32Array(N);
  const P = (params.s = {
    u: F(), jit: F(), sat: F(), glow: F(), cr: F(), cg: F(), cb: F(),
    par: I(), sz: I(), root: I(), id: I(), idSize: I(), idHue: F(),
    best: I(), bestS: I(), muSite: I(), rid: I(), owner: I(), prev: I(), queue: I(), path: I(), pathK: I().fill(-1),
    flag: new Uint8Array(N), used: new Uint8Array(N),
    pathLen: 0, cur: 0, maxSize: 1, spanRoot: -1, flash: 0, pulse: 0, p: 0.5, pstar: PC, dt: 1 / 30,
    hue: 0, speed: 2, win: 0.04, small: 0.06, soft: 1, phase: 0, span: false, lo: 0.55, hi: 0.62,
  });
  // A fixed tint per LED: hue off by up to 0.05 and saturation 0.6 to 0.98.
  for (let i = 0; i < N; i++) (P.jit[i] = (hash(i + 7919) - 0.5) * 0.1), (P.sat[i] = 0.6 + 0.38 * hash(i + 104729));
  lattice(P);
  // The opening is aimed for Window 0.04 and Speed 2 whatever the knobs say,
  // so a faster Speed crosses sooner and a wider Window starts further down.
  aim(P, 0.04, 2);
}

// Labels the clusters at the current p and hands each one a colour. A
// cluster's colour is an id with a hue. When clusters merge, the merged one
// keeps the id of whichever part was biggest a frame ago; when one splits,
// the biggest piece keeps it and the rest take fresh ids, hued from their
// lowest-numbered site. So the big clusters hold their colour through the
// whole sweep and only the small ones change.
function label(P) {
  const { u, par, sz, root, flag, muSite, best, bestS, rid, owner, used, id, idSize, idHue, p } = P;
  for (let i = 0; i < N; i++) {
    if (u[i] < p) (par[i] = i), (sz[i] = 1);
    else par[i] = -1;
  }
  for (let i = 0; i < N; i++) {
    if (par[i] < 0) continue;
    if (i % W && par[i - 1] >= 0) join(par, sz, i, i - 1);
    if (i >= W && par[i - W] >= 0) join(par, sz, i, i - W);
  }
  for (let i = 0; i < N; i++) {
    const r = par[i] < 0 ? -1 : find(par, i);
    root[i] = r;
    if (r === i) (flag[i] = 0), (muSite[i] = i), (best[i] = -1), (bestS[i] = -1);
  }
  // Which rows each cluster touches (1 top, 2 bottom), its lowest site, and
  // of the ids its sites wore last frame, the one whose cluster was biggest.
  for (let i = 0; i < N; i++) {
    const r = root[i];
    if (r < 0) continue;
    if (i < W) flag[r] |= 1;
    if (i >= N - W) flag[r] |= 2;
    if (u[i] < u[muSite[r]]) muSite[r] = i;
    const a = id[i];
    if (a >= 0 && idSize[a] > bestS[r]) (bestS[r] = idSize[a]), (best[r] = a);
  }
  owner.fill(-1);
  for (let r = 0; r < N; r++) {
    if (root[r] !== r) continue;
    const c = best[r];
    if (c >= 0 && (owner[c] < 0 || sz[r] > sz[owner[c]])) owner[c] = r;
  }
  used.fill(0);
  for (let r = 0; r < N; r++) {
    if (root[r] !== r) continue;
    const c = best[r];
    if (c >= 0 && owner[c] === r) (rid[r] = c), (used[c] = 1);
    else rid[r] = -1;
  }
  let big = 1, span = -1;
  for (let r = 0; r < N; r++) {
    if (root[r] !== r) continue;
    if (rid[r] < 0) {
      while (used[P.cur]) P.cur = (P.cur + 1) % N;
      (rid[r] = P.cur), (used[P.cur] = 1), (idHue[P.cur] = hash(muSite[r]) - 0.5);
    }
    idSize[rid[r]] = sz[r];
    if (sz[r] > big) big = sz[r];
    if (flag[r] === 3 && (span < 0 || sz[r] > sz[span])) span = r;
  }
  for (let i = 0; i < N; i++) id[i] = root[i] < 0 ? -1 : rid[root[i]];
  P.maxSize = big;
  P.spanRoot = span;
}

// The shortest open path from the top row to the bottom row inside the
// crossing cluster: a breadth-first search from all its top-row sites at
// once, stopped at the first bottom-row site it reaches.
function shortest(P, R) {
  const { root, prev, queue, pathK, path } = P;
  for (let j = 0; j < P.pathLen; j++) pathK[path[j]] = -1;
  P.pathLen = 0;
  if (R < 0) return;
  prev.fill(-2);
  let qh = 0, qt = 0, end = -1;
  for (let x = 0; x < W; x++) if (root[x] === R) (prev[x] = -1), (queue[qt++] = x);
  while (qh < qt) {
    const i = queue[qh++];
    if (i >= N - W) {
      end = i;
      break;
    }
    const x = i % W;
    let n = i + W;
    if (root[n] === R && prev[n] === -2) (prev[n] = i), (queue[qt++] = n);
    n = i - 1;
    if (x > 0 && root[n] === R && prev[n] === -2) (prev[n] = i), (queue[qt++] = n);
    n = i + 1;
    if (x < W - 1 && root[n] === R && prev[n] === -2) (prev[n] = i), (queue[qt++] = n);
    n = i - W;
    if (n >= 0 && root[n] === R && prev[n] === -2) (prev[n] = i), (queue[qt++] = n);
  }
  let len = 0;
  for (let i = end; i >= 0; i = prev[i]) len++;
  let j = len;
  for (let i = end; i >= 0; i = prev[i]) (path[--j] = i), (pathK[i] = j);
  P.pathLen = len;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0.04, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.win = cl(k[2], 0.04, 0.2);
  P.small = cl(k[3], -1, 1);
  // K1: a fresh lattice, crossed 2.7 s from now at the current knobs.
  if (input.btnPressed && input.btnPressed[0]) lattice(P), aim(P, P.win, P.speed);
  P.phase += sweep(P, P.win, P.speed) * d;
  P.p = P.lo + ((P.hi - P.lo) * (1 - cos(P.phase))) / 2;
  label(P);
  // The flash comes on the frame a cluster first joins top to bottom and
  // fades in 0.6 s; the gold stays while it spans and fades in 0.35 s after.
  const spanning = P.spanRoot >= 0;
  if (spanning && !P.span) P.flash = 1;
  P.span = spanning;
  P.flash *= exp(-d / 0.6);
  P.soft *= exp(-d / 0.5);
  P.pulse += (30 + 25 * P.speed) * d;
  const fall = exp(-d / 0.35), { root, flag, glow } = P;
  for (let i = 0; i < N; i++) {
    const r = root[i];
    if (r >= 0 && flag[r] === 3) glow[i] = 1;
    else glow[i] *= fall;
  }
  shortest(P, P.spanRoot);
  P.dt = d;
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
  const { u, root, id, sz, idHue, jit, sat, glow, pathK, cr, cg, cb, p } = P;
  const gold = 0.125 + P.hue, sm = P.small, fl = P.flash;
  // Small: brightness lo + (1 - lo) f^gam, f = log size / log largest size.
  const lo = sm < 0 ? 0.3 * (1 + sm) : 0.3 + 0.5 * sm, gam = sm < 0 ? 1.2 - 2.8 * sm : 1.2;
  const lb = 1 / log(max(2, P.maxSize));
  // Each LED eases to its colour in 0.1 s, so a merge washes over a cluster
  // instead of blinking; after a K1 tap, in 0.7 s.
  const kk = 1 - exp(-P.dt / (0.1 + 0.6 * P.soft));
  for (let i = 0; i < N; i++) {
    const r = root[i];
    let R, G, B;
    if (r < 0) {
      // A closed site keeps an ember under 20 of 255, brightest when its
      // number is just above p and it is next to open.
      const e = 1 - (u[i] - p) / (1 - p);
      hsv(gold + 0.5 + jit[i], sat[i], 0.075 * e * e);
      (R = C[0]), (G = C[1]), (B = C[2]);
    } else {
      // An open site burns brighter the longer it has been open, from 42% at
      // u = p to full at u = 0, and comes up over its first 0.004 of p.
      const f = log(sz[r]) * lb, v = lo + (1 - lo) * f ** gam;
      const g = (0.42 + 0.58 * (1 - u[i] / p)) * cl((p - u[i]) / 0.004, 0, 1);
      hsv(gold + 0.475 + 0.55 * idHue[id[i]] + jit[i], sat[i], v * g);
      (R = C[0]), (G = C[1]), (B = C[2]);
      const w = glow[i];
      if (w > 0.002) {
        hsv(gold + 0.4 * jit[i], (0.4 + 0.45 * sat[i]) * (1 - fl), (0.6 + 0.38 * g) * (1 - fl) + fl);
        (R += (C[0] - R) * w), (G += (C[1] - G) * w), (B += (C[2] - B) * w);
      }
      // The shortest path: white, with a drop every 48 sites running down it.
      const j = pathK[i];
      if (j >= 0) {
        const q = (((P.pulse - j) % 48) + 48) % 48, b = 0.65 + 0.35 * max(0, 1 - q / 14);
        (R += (1 - R) * b), (G += (0.97 - G) * b), (B += (0.9 - B) * b);
      }
    }
    cr[i] += (R * 255 - cr[i]) * kk;
    cg[i] += (G * 255 - cg[i]) * kk;
    cb[i] += (B * 255 - cb[i]) * kk;
    display.setPixel(i % W, (i / W) | 0, cr[i], cg[i], cb[i]);
  }
}
