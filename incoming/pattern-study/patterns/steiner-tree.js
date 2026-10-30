// ===== Patternflow pattern =====
// Title:   Steiner Tree
// Family:  geometry
// Idea:    Four to seven terminals stand on a zigzag of equilateral triangles or wander the panel; the minimum spanning tree joins them in faint dashes and the shortest network in bright lines that meet three at a time at 120 degrees in pink Steiner points, and when another network becomes shorter the tree flips to it while the old one fades out amber; a bar at the foot reads the length ratio of the two trees against the conjectured floor of root 3 over 2.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Euclidean Steiner tree problem (Jakob Steiner's name; Vojtěch Jarník and Miloš Kössler, 1934), Steiner minimal trees and the root 3 over 2 ratio conjecture (E. N. Gilbert and H. O. Pollak, 1968), full Steiner topologies (Z. A. Melzak, 1961), the iteration for a fixed topology (Warren D. Smith, 1992), pattern round 75
// Round:   75
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Terminals=4..7, Scatter=0..1
//
// Knob 1: Hue. Turns every colour together: at 0 the Steiner tree is cyan with faint rings spreading from it every 6 LEDs, its Steiner points pink, the terminals warm white, the spanning tree dashed blue grey and a tree just left behind amber.
// Knob 2: Speed. How fast the terminals move. At 2 each wobbles round its place on the strip by 3.5% of the triangle side (2.1 LEDs for four terminals), once in 9 to 20 s, the strip sways 2.5 LEDs across, and free terminals wander at up to about 6 LEDs a second. At 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Terminals. 4 to 7. Each frame tries 40 of the full Steiner topologies (3, 15, 105 or 945 in all) from a cold start with 15 of Smith's steps, keeps the near misses for 3 s with 10 more steps a frame, and tries both swaps across every inner edge of the tree on show. A shorter candidate takes over, and if the picture changes the old tree fades out amber over 1.2 s.
// Knob 4: Scatter, applied as its square. At 0 the terminals sit on a zigzag strip of equilateral triangles down the panel, side 60 LEDs for four terminals and 32 for seven. Four make a 60 degree rhombus whose two Steiner trees are mirror images of one length, root 7 over 3 (0.882) of the spanning tree, so the wobble flips the tree back and forth about 8 times a minute. Five and seven split into equilateral stars that share terminals: at rest the ratio is exactly root 3 over 2, and with the wobble it reads 0.867 to 0.904. At 1 they wander the whole panel, the ratio stays above 0.95 nine tenths of the time and seven terminals flip 27 times a minute.

const W = 64, H = 128, NP = W * H;
const { floor, round, min, max, sqrt, sin, cos, exp, abs, hypot, PI } = Math;
const TAU = 2 * PI, FLOOR = sqrt(3) / 2;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Full Steiner topologies. Terminals are nodes 0..n-1 and Steiner
// points n..2n-3, each of degree 3. Terminal k joins the topology of the
// first k by splitting one of its 2k - 3 edges, so there are 3, 15, 105 and
// 945 for n = 4 to 7. A degenerate tree, a Steiner point sitting on a
// terminal or two on one spot, is a full topology with a zero-length edge,
// so the shortest over all full topologies is the Steiner minimal tree.
const TOPS = {};
function topologies(n) {
  if (TOPS[n]) return TOPS[n];
  const out = [];
  const rec = (edges, ins, k) => {
    if (k === n) return void out.push(prep(n, edges, ins));
    const s = n + k - 2;
    for (let i = 0; i < edges.length; i++) {
      const [u, v] = edges[i], ne = edges.slice();
      ne[i] = [u, s];
      ne.push([s, v], [s, k]);
      rec(ne, [...ins, [s, u, v, k]], k + 1);
    }
  };
  rec([[0, n], [1, n], [2, n]], [], 3);
  return (TOPS[n] = out);
}

// Adjacency and an order from the first Steiner point outwards, for the
// elimination in smith().
function prep(n, edges, ins) {
  const N = 2 * n - 2, adj = Array.from({ length: N }, () => []);
  edges.forEach(([a, b], e) => {
    adj[a].push([b, e]);
    adj[b].push([a, e]);
  });
  const order = [n], par = new Int8Array(N).fill(-1), seen = new Uint8Array(N);
  seen[n] = 1;
  for (let i = 0; i < order.length; i++)
    for (const [b] of adj[order[i]])
      if (b >= n && !seen[b]) {
        seen[b] = 1;
        par[b] = order[i];
        order.push(b);
      }
  return { n, edges, ins, adj, order, par };
}

// A cold start: each Steiner point at the centroid of the three it was
// inserted between.
function initPos(T, X) {
  const n = T.n;
  X[2 * n] = (X[0] + X[2] + X[4]) / 3;
  X[2 * n + 1] = (X[1] + X[3] + X[5]) / 3;
  for (const [s, u, v, k] of T.ins)
    for (let c = 0; c < 2; c++) X[2 * s + c] = (X[2 * u + c] + X[2 * v + c] + X[2 * k + c]) / 3;
}

// Smith's iteration for a fixed topology: weight every edge by 1/length and
// solve the tree's linear system exactly, from the leaves of the Steiner
// points up and back down. The total length is convex in the Steiner points
// and each step can only shorten it. Returns the length after iters steps.
const WB = new Float64Array(16), AA = new Float64Array(16), BX = new Float64Array(16), BY = new Float64Array(16);
function smith(T, X, iters) {
  const { n, edges, adj, order, par } = T;
  let L = 0;
  for (let it = 0; ; it++) {
    L = 0;
    for (let e = 0; e < edges.length; e++) {
      const a = edges[e][0], b = edges[e][1], d = hypot(X[2 * a] - X[2 * b], X[2 * a + 1] - X[2 * b + 1]);
      L += d;
      WB[e] = 1 / max(d, 1e-4);
    }
    if (it === iters) return L;
    for (let i = order.length - 1; i >= 0; i--) {
      const c = order[i];
      let D = 0, bx = 0, by = 0, ap = 0;
      for (const [b, e] of adj[c]) {
        const w = WB[e];
        if (b < n) (D += w), (bx += w * X[2 * b]), (by += w * X[2 * b + 1]);
        else if (b === par[c]) (D += w), (ap = w);
        else (D += w * (1 - AA[b])), (bx += w * BX[b]), (by += w * BY[b]);
      }
      AA[c] = ap / D;
      BX[c] = bx / D;
      BY[c] = by / D;
    }
    for (const c of order) {
      const p = par[c];
      X[2 * c] = (p >= 0 ? AA[c] * X[2 * p] : 0) + BX[c];
      X[2 * c + 1] = (p >= 0 ? AA[c] * X[2 * p + 1] : 0) + BY[c];
    }
  }
}

// The two other topologies across inner edge e: swap one neighbour of each
// end. Both ends start at the edge's middle, nudged towards their new pairs.
function swaps(T, X) {
  const { n, edges } = T, out = [];
  edges.forEach(([s1, s2], e) => {
    if (s1 < n || s2 < n) return;
    const nb = (s, o) => T.adj[s].filter(([q]) => q !== o);
    const [[a], [b, eb]] = nb(s1, s2), [[c, ec], [d, ed]] = nb(s2, s1);
    for (const [x, ex, y] of [[c, ec, d], [d, ed, c]]) {
      // s1 keeps a and takes x from s2; s2 keeps y and takes b.
      const ne = edges.map((p) => p.slice());
      ne[eb] = [s2, b];
      ne[ex] = [s1, x];
      const T2 = prep(n, ne, T.ins), X2 = X.slice();
      const mx = (X[2 * s1] + X[2 * s2]) / 2, my = (X[2 * s1 + 1] + X[2 * s2 + 1]) / 2;
      for (const [s, p, q] of [[s1, a, x], [s2, b, y]]) {
        const ux = (X[2 * p] + X[2 * q]) / 2 - mx, uy = (X[2 * p + 1] + X[2 * q + 1]) / 2 - my, l = hypot(ux, uy) || 1;
        X2[2 * s] = mx + (0.4 * ux) / l;
        X2[2 * s + 1] = my + (0.4 * uy) / l;
      }
      out.push([T2, X2]);
    }
  });
  return out;
}

// The tree as drawn: edges shorter than 0.8 LED are contracted, and the key
// lists for every edge left the terminals on its far side from terminal 0.
// A change of topology that leaves the key alone does not show.
function drawnKey(T, X) {
  const { n, edges } = T, N = 2 * n - 2, par = [...Array(N).keys()];
  const find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
  const len = (e) => hypot(X[2 * e[0]] - X[2 * e[1]], X[2 * e[0] + 1] - X[2 * e[1] + 1]);
  for (const e of edges) if (len(e) < 0.8) par[find(e[0])] = find(e[1]);
  const keep = edges.filter((e) => len(e) >= 0.8), ks = [];
  for (const [a, b] of keep) {
    let m = 0;
    const seen = new Set([find(a), find(b)]), st = [find(b)];
    while (st.length) {
      const c = st.pop();
      for (let t = 0; t < n; t++) if (find(t) === c) m |= 1 << t;
      for (const [p, q] of keep) {
        const fp = find(p), fq = find(q), o = fp === c ? fq : fq === c ? fp : -1;
        if (o >= 0 && !seen.has(o)) seen.add(o), st.push(o);
      }
    }
    if (m & 1) m = ((1 << n) - 1) & ~m;
    ks.push(m);
  }
  return ks.sort((x, y) => x - y).join(",");
}

function mst(n, X) {
  const inT = new Uint8Array(n), d = new Float64Array(n).fill(1e9), from = new Int8Array(n).fill(-1), E = [];
  d[0] = 0;
  let L = 0;
  for (let it = 0; it < n; it++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!inT[i] && (u < 0 || d[i] < d[u])) u = i;
    inT[u] = 1;
    L += d[u];
    if (from[u] >= 0) E.push([from[u], u]);
    for (let v = 0; v < n; v++)
      if (!inT[v]) {
        const dd = hypot(X[2 * u] - X[2 * v], X[2 * u + 1] - X[2 * v + 1]);
        if (dd < d[v]) (d[v] = dd), (from[v] = u);
      }
  }
  return { L, E };
}

// ---- Where the terminals are. On the strip, terminal i sits on a zigzag of
// equilateral triangles of side a down the middle of the panel; free, it
// follows two sines in x and two in y over the whole panel.
function place(S, scatter) {
  const n = S.n, a = min(60, 192 / (n - 1)), sep = (a * sqrt(3)) / 2, t = S.tau;
  const sx = 32 + 2.5 * sin(0.043 * t), sy = 58 + 3 * sin(0.031 * t + 1);
  for (let i = 0; i < n; i++) {
    const f = S.freq[i];
    const wx = 0.035 * a * sin(f[0] * t + f[4]), wy = 0.035 * a * sin(f[1] * t + f[5]);
    const lx = sx + (i % 2 ? 0.5 : -0.5) * sep + wx, ly = sy + (i - (n - 1) / 2) * (a / 2) + wy;
    const fx = 32 + 26 * (0.62 * sin(f[2] * t + f[6]) + 0.38 * sin(f[3] * t * 1.7 + f[7])), fy = 58 + 50 * (0.62 * sin(f[3] * t + f[7]) + 0.38 * sin(f[2] * t * 1.3 + f[4]));
    S.X[2 * i] = cl(lx + (fx - lx) * scatter, 3, 61);
    S.X[2 * i + 1] = cl(ly + (fy - ly) * scatter, 4, 110);
  }
}

function resolve(S) {
  // Every topology from a cold start, the shortest kept and polished.
  let best = null;
  for (const T of topologies(S.n)) {
    const X = S.X.slice();
    initPos(T, X);
    const L = smith(T, X, 15);
    if (!best || L < best[2]) best = [T, X, L];
  }
  S.T = best[0];
  S.X = best[1];
  S.L = smith(S.T, S.X, 60);
  S.key = drawnKey(S.T, S.X);
  S.sweep = 0;
}

export function setup(params) {
  const freq = [];
  for (let i = 0; i < 7; i++) {
    const r = () => Math.random();
    freq.push([TAU / (9 + 11 * r()), TAU / (9 + 11 * r()), 0.05 + 0.05 * r(), 0.05 + 0.05 * r(), TAU * r(), TAU * r(), TAU * r(), TAU * r()]);
  }
  params.s = { n: 0, tau: 0, t: 0, freq, X: null, T: null, L: 0, M: 1, pool: [], old: null, oldT: -9, boost: 0, sg: new Float64Array(80), F: new Float32Array(NP), rgb: new Float32Array(NP * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 4, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.t += d;
  S.tau += (d * cl(k[1], 0.2, 3)) / 2;
  const n = cl(round(k[2]), 4, 7), scatter = cl(k[3], 0, 1) ** 2;
  if (n !== S.n) {
    S.n = n;
    S.X = new Float64Array(2 * (2 * n - 2));
    place(S, scatter);
    resolve(S);
    S.old = null;
    S.pool = [];
  }
  place(S, scatter);
  S.L = smith(S.T, S.X, 4);
  // Candidates: the swaps across each inner edge, warm; a share of all
  // topologies, cold; and the near misses of earlier sweeps, warm. Smith's
  // steps only shorten, so a candidate shorter than the polished tree on
  // show is truly shorter.
  let cand = null;
  const better = (T, X, L) => {
    if (L < S.L * (1 - 2e-4) && (!cand || L < cand[2])) cand = [T, X, L];
  };
  for (const [T2, X2] of swaps(S.T, S.X)) better(T2, X2, smith(T2, X2, 12));
  for (const q of S.pool) {
    q.X.set(S.X.subarray(0, 2 * n));
    q.L = smith(q.T, q.X, 10);
    q.age += d;
    better(q.T, q.X, q.L);
  }
  S.pool = S.pool.filter((q) => q.age < 3 && q.L < S.L * 1.03 && q.T !== S.T);
  const all = topologies(n), per = min(all.length, 40);
  for (let i = 0; i < per; i++) {
    const T = all[(S.sweep + i) % all.length], X = S.X.slice();
    initPos(T, X);
    const L = smith(T, X, 15);
    better(T, X, L);
    // A cold start a little longer than the tree on show may still be the
    // shorter one once it settles, so it stays in the pool for 3 s.
    if (L < S.L * 1.03 && T !== S.T && S.pool.length < 8 && !S.pool.some((q) => q.T === T)) S.pool.push({ T, X, L, age: 0 });
  }
  S.sweep = (S.sweep + per) % all.length;
  if (cand) {
    const key = drawnKey(cand[0], cand[1]);
    if (key !== S.key) {
      // A visible flip: keep the old tree to fade out.
      S.old = segs(S.T, S.X);
      S.oldT = S.t;
      S.boost = 1;
    }
    S.T = cand[0];
    S.X = cand[1];
    S.L = smith(S.T, S.X, 6);
    S.key = key;
  }
  S.mst = mst(n, S.X);
  S.M = S.mst.L;
  S.boost *= exp(-d * 2.5);
}

function segs(T, X) {
  const out = [];
  for (const [a, b] of T.edges) {
    const ax = X[2 * a], ay = X[2 * a + 1], bx = X[2 * b], by = X[2 * b + 1];
    if (hypot(bx - ax, by - ay) > 0.05) out.push([ax, ay, bx, by]);
  }
  return out;
}

// Soft line, added.
function line(rgb, ax, ay, bx, by, col, a, w, dash) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, L = sqrt(L2), R = w + 1.5;
  for (let y = max(0, floor(min(ay, by) - R)); y <= min(H - 1, floor(max(ay, by) + R)); y++) {
    // Only the stretch of the row the segment can reach.
    let x0 = min(ax, bx), x1 = max(ax, bx);
    if (abs(dy) > 1e-6) {
      const t0 = cl((y + 0.5 - R - ay) / dy, 0, 1), t1 = cl((y + 0.5 + R - ay) / dy, 0, 1);
      x0 = ax + min(t0, t1) * dx;
      x1 = ax + max(t0, t1) * dx;
      if (x0 > x1) [x0, x1] = [x1, x0];
    }
    for (let x = max(0, floor(x0 - R)); x <= min(W - 1, floor(x1 + R)); x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay, t = L2 > 0 ? cl((px * dx + py * dy) / L2, 0, 1) : 0;
      if (dash && (t * L) % 4 > 2) continue;
      const dd = hypot(px - t * dx, py - t * dy), v = a * cl(w + 0.5 - dd, 0, 1);
      if (v <= 0) continue;
      const o = 3 * (y * W + x);
      for (let c = 0; c < 3; c++) rgb[o + c] = max(rgb[o + c], col[c] * v);
    }
  }
}

// A disc laid over what is there.
function spot(rgb, x, y, r, col, a) {
  for (let j = max(0, floor(y - r - 1)); j <= min(H - 1, floor(y + r + 1)); j++)
    for (let i = max(0, floor(x - r - 1)); i <= min(W - 1, floor(x + r + 1)); i++) {
      const v = a * cl(r + 0.5 - hypot(i + 0.5 - x, j + 0.5 - y), 0, 1);
      if (v <= 0) continue;
      const o = 3 * (j * W + i);
      for (let c = 0; c < 3; c++) rgb[o + c] = rgb[o + c] * (1 - v) + col[c] * v;
    }
}

// Field brightness by distance from the tree, in steps of 0.05 LED.
const RING = new Float32Array(3000).map((_, i) => {
  const dd = i / 20, ring = Math.pow(0.5 + 0.5 * cos((TAU * dd) / 6), 6) * 0.17 * exp(-dd / 26);
  return max(dd > 2 ? ring : 0, 0.3 * exp((-dd * dd) / 5));
});

// 3 by 5 digits for the ratio.
const DIGITS = [0x7b6f, 0x2c97, 0x73e7, 0x73cf, 0x5bc9, 0x79cf, 0x79ef, 0x7292, 0x7bef, 0x7bcf];
function digit(rgb, n, x, y, col) {
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 3; c++)
      if ((DIGITS[n] >> (14 - r * 3 - c)) & 1) {
        const o = 3 * ((y + r) * W + x + c);
        for (let q = 0; q < 3; q++) rgb[o + q] = col[q];
      }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.T) return;
  const { rgb } = S, h0 = 0.5 + S.hue;
  const tree = hsv(h0, 0.5, 1), glowC = hsv(h0 + 0.03, 0.75, 1), pink = hsv(h0 + 0.42, 0.5, 1), warm = hsv(h0 + 0.6, 0.15, 1), amber = hsv(h0 + 0.6, 0.75, 1), mstC = hsv(h0 + 0.1, 0.3, 0.62), bg = hsv(h0 + 0.12, 0.7, 0.03);
  const sg = segs(S.T, S.X), ns = sg.length, SG = S.sg, core = [];
  sg.forEach(([ax, ay, bx, by], i) => {
    const dx = bx - ax, dy = by - ay;
    SG.set([ax, ay, dx, dy, 1 / (dx * dx + dy * dy)], 5 * i);
  });
  // Distance from each LED to the tree: a glow along it and faint rings
  // every 6 LEDs that spread out from it, looked up by distance. It is
  // worked exactly on every second LED each way and within 3.5 LEDs of the
  // tree, and read off its four exact neighbours everywhere else.
  const F = S.F, dist = (px, py) => {
    let m = 1e9;
    for (let i = 0; i < 5 * ns; i += 5) {
      const ex0 = px - SG[i], ey0 = py - SG[i + 1], dx = SG[i + 2], dy = SG[i + 3];
      let t = (ex0 * dx + ey0 * dy) * SG[i + 4];
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = ex0 - t * dx, ey = ey0 - t * dy, q = ex * ex + ey * ey;
      if (q < m) m = q;
    }
    return sqrt(m);
  };
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) F[y * W + x] = dist(x + 0.5, y + 0.5);
  for (let y = 0, p = 0; y < H; y++) {
    const y0 = y & ~1, y1 = y0 + 2 < H ? y0 + 2 : y0, fy = y & 1 ? 0.5 : 0;
    for (let x = 0; x < W; x++, p++) {
      let dd = F[p];
      if ((x | y) & 1) {
        const x0 = x & ~1, x1 = x0 + 2 < W ? x0 + 2 : x0, fx = x & 1 ? 0.5 : 0;
        const a = F[y0 * W + x0], b = F[y0 * W + x1], c = F[y1 * W + x0], e = F[y1 * W + x1];
        dd = min(a, b, c, e) < 3.5 ? dist(x + 0.5, y + 0.5) : (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
      }
      const v = RING[min(RING.length - 1, (dd * 20) | 0)], o = 3 * p;
      rgb[o] = bg[0] + glowC[0] * v;
      rgb[o + 1] = bg[1] + glowC[1] * v;
      rgb[o + 2] = bg[2] + glowC[2] * v;
      // The tree's own line, 1.7 LEDs wide, laid on after the dashes.
      if (dd < 1.35) core.push(p, 1.35 - dd);
    }
  }
  // The minimum spanning tree, dashed and faint.
  for (const [a, b] of S.mst.E) line(rgb, S.X[2 * a], S.X[2 * a + 1], S.X[2 * b], S.X[2 * b + 1], mstC, 1, 0.45, true);
  // A tree just left behind fades out amber.
  const age = S.t - S.oldT;
  if (S.old && age < 1.2) for (const [ax, ay, bx, by] of S.old) line(rgb, ax, ay, bx, by, amber, 0.9 * (1 - age / 1.2), 0.7);
  const bright = [0, 1, 2].map((c) => tree[c] + (1 - tree[c]) * 0.7 * S.boost);
  for (let i = 0; i < core.length; i += 2) {
    const o = 3 * core[i], v = min(1, core[i + 1]);
    for (let c = 0; c < 3; c++) rgb[o + c] = rgb[o + c] * (1 - v) + bright[c] * v;
  }
  // Steiner points that stand apart from every terminal are pink dots.
  for (let s = S.n; s < 2 * S.n - 2; s++) {
    const x = S.X[2 * s], y = S.X[2 * s + 1];
    let near = 1e9;
    for (let i = 0; i < S.n; i++) near = min(near, hypot(x - S.X[2 * i], y - S.X[2 * i + 1]));
    if (near > 1.2) spot(rgb, x, y, 1.5, pink, cl(near - 1.2, 0, 1));
  }
  for (let i = 0; i < S.n; i++) spot(rgb, S.X[2 * i], S.X[2 * i + 1], 1.9, warm, 1);
  // The ratio: a bar from root 3 over 2 at the left to 1 at the right, and
  // the number above it.
  // Smith's steps reach a degenerate tree slowly, so where the spanning tree
  // is already the shortest the length can stand 0.04% above it: read 1.
  const r = S.M > 0 ? min(1, S.L / S.M) : 1, fill = cl((r - FLOOR) / (1 - FLOOR), 0, 1);
  for (let x = 3; x <= 60; x++) {
    const u = (x - 3) / 57, on = u <= fill;
    for (let y = 121; y <= 124; y++) {
      const o = 3 * (y * W + x), v = on ? 0.85 : 0.12;
      for (let c = 0; c < 3; c++) rgb[o + c] = (on ? tree : mstC)[c] * v;
    }
  }
  for (let y = 119; y <= 126; y++) for (let c = 0; c < 3; c++) rgb[3 * (y * W + 2) + c] = pink[c];
  const txt = r.toFixed(3);
  let cx = 3;
  for (const ch of txt) {
    if (ch === ".") {
      for (let c = 0; c < 3; c++) rgb[3 * (117 * W + cx) + c] = warm[c] * 0.85;
      cx += 2;
      continue;
    }
    digit(rgb, +ch, cx, 113, warm);
    cx += 4;
  }
  for (let p = 0; p < NP; p++) display.setPixel(p % W, floor(p / W), min(255, rgb[3 * p] * 255) | 0, min(255, rgb[3 * p + 1] * 255) | 0, min(255, rgb[3 * p + 2] * 255) | 0);
}
