// ===== Patternflow pattern =====
// Title:   Continuum Random Tree
// Family:  fractal
// Idea:    Aldous's Brownian continuum random tree stands on its root at the bottom of the panel, coded by a normalised Brownian excursion and grown by line-breaking one uniform leaf at a time, a white glow climbing each new branch; once grown, the view dives into one of its subtrees, which stretched by Brownian scaling is again a continuum random tree, and the growth goes on inside it.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Brownian continuum random tree (David Aldous, 1991), pattern round 40
// Round:   40
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Dive=0..1, Cut=0..1
//
// Knob 1: Hue. Turns the tree round the wheel: at 0 azure crowns on dim grey stems with green and violet limbs either side, at 0.25 magenta, 0.5 apricot, 0.75 green. The subtrees above the cut always spread over half the wheel from left to right.
// Knob 2: Speed. At 2 the tree grows 1.6 units of length a second, 60 to 120 rows of branch depending on how tall the tree stands, the dive takes 3.2 s and the two trees cross-fade for 0.7 s, so a dive comes every 9 to 10 s at Dive 0. At 0.2 all of it ten times slower, at 3 half as fast again.
// Knob 3: Dive. The mass of the subtree the view dives into: 0.3 of the tree at 0, 0.13 at 0.5, 0.06 at 1. Its time is stretched by one over the mass (3.3 to 17 times) and its heights by one over the square root (1.8 to 4 times), Brownian scaling, and what fills the panel is again a tree of mass 1. Deeper dives keep fewer leaves, so the new tree starts sparser and grows longer before the next dive.
// Knob 4: Cut. A level at 20% of the height at 0 and 90% at 1 (24% at the start). Every subtree above it gets its own hue and a white bead where its branch crosses the level, and below it the tree is dim and grey. Turned up, the one crown splits into more and smaller trees, each of them a continuum random tree in its own right.
// Buttons: K1 tap dives now, once the tree holds 30 leaves.

const W = 64, H = 128, N = 8192, NL = 256;
// The root sits on row 126.5 and the highest point of the tree 122 rows above.
const ROWS = 122, Y0 = 126.5;
// Layout: a branch stands over the middle of its run, followed from the run
// below by EASE of the way, at most SLOPE LEDs sideways per level.
const SLOPE = 0.5, EASE = 0.12;
// The spanned tree grows LEND long (in units of the tree, where the height
// of a uniform point is Rayleigh), VGROW a second at Speed 2; then the view
// dives into a subtree for DIVE seconds and the two trees cross-fade for FADE.
const LEND = 24, VGROW = 1.6, DIVE = 3.2, FADE = 0.7;
// Opening hue: azure.
const H0 = 0.58;
const { floor, ceil, min, max, abs, sqrt, log, exp, cos, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => u * u * (3 - 2 * u);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  if (i === 0) (out[0] = v), (out[1] = t), (out[2] = p);
  else if (i === 1) (out[0] = q), (out[1] = v), (out[2] = p);
  else if (i === 2) (out[0] = p), (out[1] = v), (out[2] = t);
  else if (i === 3) (out[0] = p), (out[1] = q), (out[2] = v);
  else if (i === 4) (out[0] = t), (out[1] = p), (out[2] = v);
  else (out[0] = v), (out[1] = p), (out[2] = q);
}

function gauss() {
  let u = 0;
  while (u === 0) u = random();
  return sqrt(-2 * log(u)) * cos(2 * PI * random());
}

// A normalised Brownian excursion e on N steps, kept as heights 2e: the
// Vervaat transform of a Gaussian bridge (cut the bridge at its minimum and
// swap the two pieces), scaled by 2 / sqrt(N). Height 2e(t) is the distance
// from the root to the point of the tree at time t.
function excursion(S) {
  const E = new Float32Array(N + 1), Z = S.tmp;
  let w = 0;
  Z[0] = 0;
  for (let k = 1; k <= N; k++) Z[k] = w += gauss();
  let m = 0;
  for (let k = 0; k <= N; k++) {
    Z[k] -= (k / N) * w;
    if (k < N && Z[k] < Z[m]) m = k;
  }
  const s = 2 / sqrt(N);
  for (let j = 0; j <= N; j++) E[j] = (Z[(m + j) % N] - Z[m]) * s;
  E[0] = E[N] = 0;
  return E;
}

// The subtree over run [a, b] at height hs, as an excursion of its own:
// shifted down by hs, stretched in time by N / n and in height by
// sqrt(N / n), Brownian scaling, so that it is again a normalised one. The
// samples in between get the Brownian bridges they lacked.
function subExcursion(S, T, g) {
  const n = g.b - g.a + 2, k = sqrt(N / n), E = T.E, F = new Float32Array(N + 1), Z = S.tmp;
  const C = (q) => (q <= 0 || q >= n ? 0 : (E[g.a - 1 + q] - g.hs) * k);
  Z[0] = 0;
  for (let j = 1; j <= N; j++) Z[j] = Z[j - 1] + (2 * gauss()) / sqrt(N);
  const Zat = (q) => {
    const u = (q * N) / n, j = min(N - 1, floor(u)), f = u - j;
    return Z[j] * (1 - f) + Z[j + 1] * f;
  };
  let q0 = -1, za = 0, zb = 0;
  for (let j = 0; j <= N; j++) {
    const u = (j * n) / N, q = min(n - 1, floor(u)), f = u - q;
    if (q !== q0) {
      za = Zat(q);
      zb = Zat(q + 1);
      q0 = q;
    }
    F[j] = abs(C(q) * (1 - f) + C(q + 1) * f + Z[j] - za * (1 - f) - zb * f);
  }
  F[0] = F[N] = 0;
  return F;
}

// The runs of {E >= level} at each of NL levels. Each run is a vertex of the
// tree at that height, and its samples are the part of the tree above it:
// start a, end b, highest point top, parent run par one level down, and fx,
// where the branch is drawn. The follow keeps the order of the runs, so no
// two subtrees cross. Built count levels at a time, a few a frame while the
// view dives.
const RA = new Int32Array(N + 2), RB = new Int32Array(N + 2), RT = new Float32Array(N + 2);
function build(T, count) {
  const E = T.E, out = T.lv, cs = (SLOPE * N) / W, end = min(NL, out.length + count);
  for (let s = out.length; s < end; s++) {
    const h = s * T.dh, a = RA, b = RB, top = RT;
    let start = -1, mx = 0, n = 0;
    for (let j = 0; j <= N; j++) {
      const v = E[j];
      if (v >= h) {
        if (start < 0) {
          start = j;
          mx = v;
        } else if (v > mx) mx = v;
      } else if (start >= 0) {
        a[n] = start;
        b[n] = j - 1;
        top[n++] = mx;
        start = -1;
      }
    }
    if (start >= 0) {
      a[n] = start;
      b[n] = N;
      top[n++] = mx;
    }
    const fx = new Float32Array(n), par = new Int32Array(n);
    if (s === 0) for (let q = 0; q < n; q++) fx[q] = (a[q] + b[q]) / 2;
    else {
      const P = out[s - 1];
      let p = 0;
      for (let q = 0; q < n; q++) {
        while (P.b[p] < a[q]) p++;
        par[q] = p;
        fx[q] = P.fx[p] + cl(EASE * ((a[q] + b[q]) / 2 - P.fx[p]), -cs, cs);
      }
    }
    out.push({ a: a.slice(0, n), b: b.slice(0, n), top: top.slice(0, n), fx, par });
  }
}

// Index of the run at level s that holds sample i (or -1).
function runOf(T, s, i) {
  const L = T.lv[s], a = L.a;
  let lo = 0, hi = a.length - 1, f = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (a[m] <= i) {
      f = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return f >= 0 && L.b[f] >= i ? f : -1;
}

function tree(E, n) {
  let mh = 0;
  for (let j = 0; j <= N; j++) if (E[j] > mh) mh = E[j];
  const T = { E, maxH: mh, dh: mh / (NL - 1), lv: [], leaves: [], sorted: [], used: new Uint8Array(N + 1), L: 0, cur: null, prog: 0 };
  build(T, n);
  return T;
}

// Checked against the theorem: over 12,000 uniform points the distance to
// the root 2e(U) exceeds h with probability within 0.01 of exp(-h^2/2) at
// every h from 0.5 to 3 (Rayleigh, mean 1.245 against 1.253), and so does a
// subtree after the dive's stretching. The spanned tree of 40 leaves is 8.44
// long on average; adding the grid's missed minima, 2 x 0.583 / sqrt(N) a
// branch, gives 8.95 against line-breaking's E[C_40] = 8.92.
//
// Aldous's line-breaking, read off the excursion: a new uniform leaf i
// joins the tree spanned by the root and the leaves so far at the higher of
// the two minima between i and its sampled neighbours, and the branch from
// there up to i is the next segment. Its length is the next gap of the
// line-breaking clock.
function addLeaf(T, i) {
  if (i === undefined) {
    i = 1 + floor(random() * (N - 1));
    while (T.used[i]) i = 1 + floor(random() * (N - 1));
  }
  if (T.used[i]) return null;
  T.used[i] = 1;
  const so = T.sorted, E = T.E;
  let lo = 0, hi = so.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (so[m] < i) lo = m + 1;
    else hi = m;
  }
  let b = 0;
  if (lo > 0) {
    let mn = Infinity;
    for (let j = so[lo - 1]; j <= i; j++) if (E[j] < mn) mn = E[j];
    b = max(b, mn);
  }
  if (lo < so.length) {
    let mn = Infinity;
    for (let j = i; j <= so[lo]; j++) if (E[j] < mn) mn = E[j];
    b = max(b, mn);
  }
  so.splice(lo, 0, i);
  const h = E[i], sb = floor(b / T.dh), st = min(NL - 1, floor(h / T.dh));
  // The path from the branch point up to i: at each level the run that
  // holds i, where it is drawn and the mass of the tree above it.
  const n = st - sb + 1, xs = new Float32Array(n + 1), ms = new Float32Array(n);
  for (let s = sb; s <= st; s++) {
    const q = runOf(T, s, i), L = T.lv[s];
    xs[s - sb] = L.fx[q];
    ms[s - sb] = (L.b[q] - L.a[q] + 1) / N;
  }
  const cs = (SLOPE * N) / W;
  xs[n] = xs[n - 1] + cl(EASE * (i - xs[n - 1]), -cs, cs);
  const leaf = { i, b, h, sb, st, xs, ms };
  T.leaves.push(leaf);
  T.L += h - b;
  return leaf;
}

// Grow the tree by length d: the current branch climbs from its branch
// point, and when it reaches its leaf the next leaf is drawn.
function grow(T, d) {
  while (d > 0) {
    if (!T.cur) {
      T.cur = addLeaf(T);
      T.prog = 0;
      T.L -= T.cur.h - T.cur.b;
    }
    const left = T.cur.h - T.cur.b - T.prog;
    if (d < left) {
      T.prog += d;
      T.L += d;
      return;
    }
    T.L += left;
    d -= left;
    T.cur = null;
  }
}

// The subtree to dive into: a run that starts just above a branch point
// (its parent holds at least a third more) with a mass near the target and
// at least four spanned leaves; of those, the one with the largest share of
// its spanned leaves in the upper half of its height, so that the tree it
// opens into keeps a crown on the tall panel.
function pickDive(T, mt, tol) {
  let best = null, score = -Infinity;
  const so = T.sorted, E = T.E;
  for (let s = 4; s < NL - 8; s++) {
    const L = T.lv[s], P = T.lv[s - 1], hs = s * T.dh;
    for (let q = 0; q < L.a.length; q++) {
      const m = (L.b[q] - L.a[q] + 2) / N, p = L.par[q];
      if (abs(log(m / mt)) > tol || (P.b[p] - P.a[p] + 2) / N < m * 1.33) continue;
      let lo = 0, hi = so.length;
      while (lo < hi) {
        const k = (lo + hi) >> 1;
        if (so[k] < L.a[q]) lo = k + 1;
        else hi = k;
      }
      let n = 0, up = 0;
      const mid = hs + 0.5 * (L.top[q] - hs);
      for (let k = lo; k < so.length && so[k] <= L.b[q]; k++) {
        n++;
        if (E[so[k]] > mid) up++;
      }
      if (n < 4) continue;
      const sc = up / n + 0.002 * n - 0.3 * abs(log(m / mt));
      if (sc > score) {
        score = sc;
        best = { a: L.a[q], b: L.b[q], s, hs, top: L.top[q], m };
      }
    }
  }
  return best;
}

// The view of tree T, or of T diving into g at progress e.
function viewOf(T, g, e) {
  if (!g || e <= 0) return { x0: 0, x1: N, hb: 0, ht: T.maxH };
  const w0 = N, w1 = g.xb - g.xa, w = w0 ** (1 - e) * w1 ** e, fx = (w0 - w) / (w0 - w1);
  const h0 = T.maxH, h1 = g.top - g.hs, hh = h0 ** (1 - e) * h1 ** e, fy = (h0 - hh) / (h0 - h1);
  return { x0: fx * g.xa, x1: N + fx * (g.xb - N), hb: fy * g.hs, ht: T.maxH + fy * (g.top - T.maxH) };
}

export function setup(params) {
  params.s = {
    tmp: new Float64Array(N + 1), T: null, next: null, old: null, oldView: null, begun: false, t: 0,
    phase: 0, u: 0, g: null, fade: 1,
    hue: 0, speed: 2, dive: 0, cut: 0.06,
    R: new Float32Array(W * H), G: new Float32Array(W * H), B: new Float32Array(W * H),
    gR: new Float32Array(W * H), gG: new Float32Array(W * H), gB: new Float32Array(W * H), tmpb: new Float32Array(W * H),
    c: [0, 0, 0], bud: [0, 0, 0],
  };
}

function startDive(S) {
  const mt = 0.3 * 0.2 ** S.dive;
  const g = pickDive(S.T, mt, 0.6) || pickDive(S.T, mt, 1.5);
  if (!g) {
    S.T = tree(excursion(S), NL);
    return;
  }
  // Frame the subtree as it is drawn: from its root up, the leftmost and
  // rightmost of its branches, and a little room on either side.
  const T = S.T, q = runOf(T, g.s, g.a);
  let xa = T.lv[g.s].fx[q], xb = xa;
  for (const leaf of T.leaves)
    if (leaf.i >= g.a && leaf.i <= g.b)
      for (let k = max(0, g.s - leaf.sb); k < leaf.xs.length; k++) {
        xa = min(xa, leaf.xs[k]);
        xb = max(xb, leaf.xs[k]);
      }
  const pad = 0.08 * (xb - xa) + 0.004 * N;
  g.xa = xa - pad;
  g.xb = xb + pad;
  S.g = g;
  S.next = null;
  S.phase = 1;
  S.u = 0;
}

function endDive(S) {
  const T = S.T, g = S.g, n = g.b - g.a + 2, T2 = S.next || tree(subExcursion(S, T, g), 0);
  build(T2, NL);
  // The spanned leaves inside the subtree stay: their reduced tree is a
  // stage of line-breaking for the new tree.
  for (const i of T.sorted) if (i >= g.a && i <= g.b) addLeaf(T2, cl(round(((i - g.a + 1) * N) / n), 1, N - 1));
  S.old = T;
  S.oldView = viewOf(T, g, 1);
  S.fade = 0;
  S.T = T2;
  S.g = S.next = null;
  S.phase = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.dive = cl(k[2], 0, 1);
  S.cut = cl(k[3], 0, 1);
  const r = (d * S.speed) / 2;
  if (!S.begun) {
    // Of four excursions, the one with most of its time in the upper half
    // of its height, so the first tree has a crown.
    let best = null, sc = -1;
    for (let k = 0; k < 4; k++) {
      const E = excursion(S);
      let mx = 0, up = 0;
      for (let j = 0; j <= N; j++) mx = max(mx, E[j]);
      for (let j = 0; j <= N; j++) if (E[j] > 0.5 * mx) up++;
      if (up > sc) {
        sc = up;
        best = E;
      }
    }
    S.T = tree(best, NL);
    // Open a second before the first dive at Speed 2.
    grow(S.T, LEND - VGROW);
    S.begun = true;
  }
  S.t += r;
  if (S.phase === 0) {
    grow(S.T, r * VGROW);
    if (S.T.L >= LEND || (input.btnPressed && input.btnPressed[0] && S.T.leaves.length >= 30)) startDive(S);
  } else {
    S.u += r / DIVE;
    // The tree the subtree opens into, made a few levels a frame meanwhile.
    if (!S.next) S.next = tree(subExcursion(S, S.T, S.g), 0);
    else build(S.next, 24);
    if (S.u >= 1) endDive(S);
  }
  if (S.old) {
    S.fade += r / FADE;
    if (S.fade >= 1) S.old = null;
  }
}

// A round-capped line of radius w from (ax, ay) to (bx, by), max-blended.
function capsule(S, ax, ay, bx, by, w, r, g, b) {
  const R = S.R, G = S.G, B = S.B;
  const x0 = max(0, floor(min(ax, bx) - w - 1)), x1 = min(W - 1, ceil(max(ax, bx) + w));
  const y0 = max(0, floor(min(ay, by) - w - 1)), y1 = min(H - 1, ceil(max(ay, by) + w));
  if (x0 > x1 || y0 > y1) return;
  const ex = bx - ax, ey = by - ay, ll = ex * ex + ey * ey;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay, u = ll > 0 ? cl((px * ex + py * ey) / ll, 0, 1) : 0;
      const dd = sqrt((px - u * ex) ** 2 + (py - u * ey) ** 2), a = cl(w + 0.5 - dd, 0, 1);
      if (a <= 0) continue;
      const p = y * W + x;
      if (a * r > R[p]) R[p] = a * r;
      if (a * g > G[p]) G[p] = a * g;
      if (a * b > B[p]) B[p] = a * b;
    }
}

// Draw the spanned tree of T in view V at weight wt. While diving, what is
// not in the subtree g dims by `dim`.
function drawTree(S, T, V, wt, g, dim) {
  const sx = W / (V.x1 - V.x0), sy = ROWS / (V.ht - V.hb), vm = (V.x1 - V.x0) / N, c = S.c, bud = S.bud;
  const px = (j) => (j - V.x0) * sx, py = (h) => Y0 - (h - V.hb) * sy;
  const hue = S.hue + H0;
  // The cut: each subtree above this height (a share of the view) gets its
  // own hue by where it stands, half the wheel from left to right; below the
  // cut the tree is pale.
  const sc = cl(round((V.hb + (0.2 + 0.7 * S.cut) * (V.ht - V.hb)) / T.dh), 0, NL - 1), C = T.lv[sc];
  const vc = (V.x0 + V.x1) / 2, vw = V.x1 - V.x0, seen = new Set();
  for (const leaf of T.leaves) {
    const grown = leaf === T.cur ? leaf.b + T.prog : leaf.h;
    let off = 0;
    if (leaf.st >= sc) {
      const q = runOf(T, sc, leaf.i);
      if (q >= 0) off = cl((C.a[q] + C.b[q] - 2 * vc) / vw, -1, 1) * 0.25;
    }
    const inside = !g || (leaf.i >= g.a && leaf.i <= g.b);
    for (let s = leaf.sb; s <= leaf.st; s++) {
      const h0 = s * T.dh;
      if (h0 > grown) break;
      const k = s - leaf.sb;
      let h1 = s < leaf.st ? (s + 1) * T.dh : leaf.h, x0 = leaf.xs[k], x1 = leaf.xs[k + 1];
      if (h1 > grown) {
        x1 = x0 + ((x1 - x0) * (grown - h0)) / (h1 - h0);
        h1 = grown;
      }
      const ax = px(x0), bx = px(x1), ay = py(h0), by = py(h1);
      if ((ax < -4 && bx < -4) || (ax > W + 4 && bx > W + 4) || (ay < -4 && by < -4) || ay > H + 4) continue;
      const u = cl((h1 - V.hb) / (V.ht - V.hb), 0, 1), m = leaf.ms[k] / vm;
      if (s >= sc) hsv(hue + off - 0.06 * u, 0.85 - 0.35 * u, 0.5 + 0.5 * u, c);
      else hsv(hue, 0.3, 0.27 + 0.2 * u, c);
      let v = wt * (!inside || s < (g ? g.s : 0) ? 1 - dim : 1);
      // The newest 0.12 of the growing branch burns white.
      if (leaf === T.cur) {
        const hot = cl(1 - (grown - h1) / 0.12, 0, 1);
        c[0] += (1 - c[0]) * hot;
        c[1] += (1 - c[1]) * hot;
        c[2] += (1 - c[2]) * hot;
      }
      capsule(S, ax, ay, bx, by, 0.45 + 1.4 * min(1, m) ** 0.35, c[0] * v, c[1] * v, c[2] * v);
    }
    const tx = px(leaf.xs[leaf.xs.length - 1]), ty = py(grown);
    if (leaf === T.cur) capsule(S, tx, ty, tx, ty, 1.5, wt, wt, wt);
    else if (inside || !g) {
      hsv(hue + off, 0.25, wt, bud);
      capsule(S, tx, ty, tx, ty, 0.6, bud[0], bud[1], bud[2]);
    }
    // A bead where the branch crosses the cut: the root of its subtree.
    if (leaf.sb <= sc && leaf.st >= sc && grown >= sc * T.dh) {
      const q = runOf(T, sc, leaf.i);
      if (q >= 0 && !seen.has(q)) {
        seen.add(q);
        hsv(hue + off, 0.2, wt, bud);
        const bx = px(C.fx[q]), by = py(sc * T.dh);
        capsule(S, bx, by, bx, by, 1.1, bud[0], bud[1], bud[2]);
      }
    }
  }
}

// Box blur of radius r, A into O.
function blur(A, O, tmp, r) {
  const k = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let i = -r; i <= r; i++) v += A[y * W + cl(x + i, 0, W - 1)];
      tmp[y * W + x] = v * k;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let i = -r; i <= r; i++) v += tmp[cl(y + i, 0, H - 1) * W + x];
      O[y * W + x] = v * k;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.T) return;
  const { R, G, B, gR, gG, gB } = S;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  if (S.old) drawTree(S, S.old, S.oldView, sqrt(1 - ease(S.fade)), null, 0);
  const e = S.phase === 1 ? ease(S.u) : 0;
  drawTree(S, S.T, viewOf(S.T, S.g, e), S.old ? sqrt(ease(S.fade)) : 1, S.g, 0.8 * e);
  blur(R, gR, S.tmpb, 3);
  blur(G, gG, S.tmpb, 3);
  blur(B, gB, S.tmpb, 3);
  for (let p = 0; p < W * H; p++)
    display.setPixel(p % W, (p / W) | 0, round(255 * min(1, R[p] + 1.1 * gR[p])), round(255 * min(1, G[p] + 1.1 * gG[p])), round(255 * min(1, B[p] + 1.1 * gB[p])));
}
