// ===== Patternflow pattern =====
// Title:   Tamari Lattice
// Family:  topology
// Idea:    All the ways to bracket six letters stand as the 42 points of the Tamari lattice, from ((((ab)c)d)e)f at the foot to a(b(c(d(ef)))) at the top, and a walker climbs one chain of tree rotations (xy)z to x(yz), a step at a time, while two bars of the bracket diagram in the corner slide, the points below it light up cyan and the points above it magenta, and then it walks back down by another chain.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Tamari lattice (Dov Tamari, 1962), associahedron (Jim Stasheff, 1963), pattern round 107
// Round:   107
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.4..3, Fewer=0..2, Chain=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the points below the walker are cyan, those above it magenta, the path it has walked yellow and the dim diagram steel blue shading to violet; at 0.5 they are red, green and blue and the diagram is pale cream.
// Knob 2: Speed. Steps a second, from 0.4 to 3. At 2 a step takes 0.5 s, 0.35 s of it the head running up the edge, so 7 steps take 3.6 s and the walker rests 1.1 s at each end; at 0.4 a step takes 2.5 s and at 3 a third of a second.
// Knob 3: Fewer. Letters taken away from six. At 0 the lattice of six letters, 42 points, 84 edges, 11 layers; at 1 five letters, 14 points, 21 edges, 7 layers; at 2 four letters, the pentagon, 5 points, 5 edges, 4 layers.
// Knob 4: Chain. How many steps the walker takes from the bottom to the top. At -1 the shortest chain, 4 steps for six letters; at 1 one of the 12 longest, 10 steps; in between a chain of the length in between, picked afresh each lap. At the start, 7 steps.

const W = 64, H = 128, NP = W * H;
const { floor, ceil, round, min, max, abs, sqrt, exp, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => {
  const t = cl(v, 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// ---- the lattice -------------------------------------------------------
// A bracketing is a binary tree: null is a letter, [left, right] a product.
function treesOf(n) {
  const memo = [[null]];
  for (let k = 1; k <= n; k++) {
    const out = [];
    for (let a = 0; a < k; a++) for (const l of memo[a]) for (const r of memo[k - 1 - a]) out.push([l, r]);
    memo.push(out);
  }
  return memo[n];
}
const key = (t) => (t === null ? "." : "(" + key(t[0]) + key(t[1]) + ")");

// Every tree one rotation (xy)z -> x(yz) higher, at any product.
function rotations(t) {
  if (t === null) return [];
  const out = [], [l, r] = t;
  if (l !== null) out.push([l[0], [l[1], r]]);
  for (const l2 of rotations(l)) out.push([l2, r]);
  for (const r2 of rotations(r)) out.push([l, r2]);
  return out;
}

// What the bracket diagram draws for each product, in the order of the products
// read left to right: the first and the last letter under it and its height,
// 1 for a product of two letters and one more than the taller of its halves.
function spansOf(t, n) {
  const a = new Int8Array(n), b = new Int8Array(n), h = new Int8Array(n);
  let leaf = 0, slot = 0;
  (function go(u) {
    if (u === null) return [leaf, leaf++, 0];
    const l = go(u[0]), s = slot++, r = go(u[1]), hh = max(l[2], r[2]) + 1;
    a[s] = l[0]; b[s] = r[1]; h[s] = hh;
    return [l[0], r[1], hh];
  })(t);
  return [a, b, h];
}

function buildLattice(n) {
  const T = treesOf(n), N = T.length, ix = new Map(T.map((t, i) => [key(t), i]));
  const up = T.map((t) => rotations(t).map((u) => ix.get(key(u))));
  const down = T.map(() => []);
  up.forEach((a, i) => a.forEach((j) => down[j].push(i)));
  const bottom = down.findIndex((d) => d.length === 0), top = up.findIndex((u) => u.length === 0);
  // The height of a point is the longest chain up to it from the bottom.
  const hb = new Int32Array(N), deg = down.map((d) => d.length), order = [], q = [bottom];
  while (q.length) {
    const i = q.shift();
    order.push(i);
    for (const j of up[i]) {
      hb[j] = max(hb[j], hb[i] + 1);
      if (--deg[j] === 0) q.push(j);
    }
  }
  // le[i * N + j] is 1 when j is at or below i.
  const le = new Uint8Array(N * N);
  for (const i of order) {
    le[i * N + i] = 1;
    for (const d of down[i]) for (let j = 0; j < N; j++) if (le[d * N + j]) le[i * N + j] = 1;
  }
  // Bit r is set when a chain of r steps leads from the point to the top (upLen) or to the bottom (dnLen).
  const upLen = new Int32Array(N), dnLen = new Int32Array(N);
  for (let k = N - 1; k >= 0; k--) {
    const i = order[k];
    if (!up[i].length) upLen[i] = 1;
    for (const j of up[i]) upLen[i] |= upLen[j] << 1;
  }
  for (const i of order) {
    if (!down[i].length) dnLen[i] = 1;
    for (const j of down[i]) dnLen[i] |= dnLen[j] << 1;
  }
  const spA = new Int8Array(N * n), spB = new Int8Array(N * n), spH = new Int8Array(N * n);
  T.forEach((t, i) => {
    const [a, b, h] = spansOf(t, n);
    spA.set(a, i * n); spB.set(b, i * n); spH.set(h, i * n);
  });
  const eu = [], ev = [], upE = up.map(() => []), dnE = up.map(() => []);
  up.forEach((a, i) => a.forEach((j) => {
    upE[i].push(eu.length);
    dnE[j].push(eu.length);
    eu.push(i);
    ev.push(j);
  }));
  const L = { n, N, E: eu.length, up, down, upE, dnE, eu, ev, hb, bottom, top, le, upLen, dnLen, spA, spB, spH, height: hb[top] };
  place(L);
  return L;
}

// ---- the diagram ---------------------------------------------------------
// Layers by height. An edge that climbs more than one layer is cut by hidden
// points, one in each layer it crosses, so the order along a layer keeps it
// clear of the points it passes. The order is the best of 14 starts, one in
// natural order and 13 shuffled, each swept up and down and then swapped
// where that removes a crossing. The sideways places relax toward the middle
// of each point's neighbours, never closer than a gap.
const CLEAR = 0.62;
function place(L) {
  const { N, up, hb, eu, ev, height } = L;
  const layerOf = Array.from(hb), adj = [];
  for (let i = 0; i < N; i++) adj.push({ u: [], d: [] });
  const paths = [];
  let id = N;
  for (let e = 0; e < L.E; e++) {
    const u = eu[e], v = ev[e], path = [u];
    for (let l = hb[u] + 1; l < hb[v]; l++) {
      layerOf[id] = l;
      adj.push({ u: [], d: [] });
      path.push(id++);
    }
    path.push(v);
    for (let k = 0; k + 1 < path.length; k++) {
      adj[path[k]].u.push(path[k + 1]);
      adj[path[k + 1]].d.push(path[k]);
    }
    paths.push(path);
  }
  const M = id, rows0 = [];
  for (let l = 0; l <= height; l++) rows0.push([]);
  for (let i = 0; i < M; i++) rows0[layerOf[i]].push(i);
  const pos = new Int32Array(M);
  const setPos = (rows) => rows.forEach((row) => row.forEach((i, k) => (pos[i] = k)));
  const cross = (rows) => {
    setPos(rows);
    let c = 0;
    for (let l = 0; l < height; l++) {
      const lk = [];
      for (const a of rows[l]) for (const b of adj[a].u) lk.push(pos[a], pos[b]);
      for (let i = 0; i < lk.length; i += 2) for (let j = i + 2; j < lk.length; j += 2) if ((lk[i] - lk[j]) * (lk[i + 1] - lk[j + 1]) < 0) c++;
    }
    return c;
  };
  const sweep = (rows, downward) => {
    for (let s = 0; s <= height; s++) {
      const l = downward ? s : height - s;
      setPos(rows);
      const bary = (i) => {
        const nb = downward ? adj[i].d : adj[i].u;
        if (!nb.length) return pos[i];
        let t = 0;
        for (const j of nb) t += pos[j];
        return t / nb.length;
      };
      const key2 = new Map(rows[l].map((i) => [i, bary(i)]));
      rows[l].sort((a, b) => key2.get(a) - key2.get(b));
    }
  };
  let seed = 12345;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let best = null, bestC = 1e9;
  for (let r = 0; r < 14; r++) {
    const rows = rows0.map((row) => row.slice());
    if (r) for (const row of rows) for (let i = row.length - 1; i > 0; i--) {
      const j = floor(rnd() * (i + 1)), t = row[i];
      row[i] = row[j];
      row[j] = t;
    }
    for (let p = 0; p < 10; p++) sweep(rows, p % 2 === 0);
    const c = cross(rows);
    if (c < bestC) { bestC = c; best = rows; }
  }
  // Swapping neighbours while that removes crossings.
  for (let go = true, pass = 0; go && pass < 20; pass++) {
    go = false;
    for (const row of best) for (let k = 0; k + 1 < row.length; k++) {
      const before = cross(best);
      const t = row[k]; row[k] = row[k + 1]; row[k + 1] = t;
      if (cross(best) < before) go = true;
      else { row[k + 1] = row[k]; row[k] = t; }
    }
  }
  const rows = best;
  // Sideways places.
  const x = new Float64Array(M);
  rows.forEach((row) => row.forEach((i, k) => (x[i] = k - (row.length - 1) / 2)));
  const real = (i) => i < N;
  for (let it = 0; it < 120; it++) {
    for (let s = 0; s <= height; s++) {
      const row = rows[it % 2 ? height - s : s], m = row.length;
      const off = new Float64Array(m), z = new Float64Array(m);
      // A hidden point stands further from a real one the more its edge slants, so the edge clears the point.
      const slant = (i) => {
        let t = 0;
        for (const j of adj[i].u.concat(adj[i].d)) t = max(t, abs(x[j] - x[i]));
        return sqrt(1 + 0.27 * t * t);
      };
      for (let k = 0; k < m; k++) {
        const i = row[k], nb = adj[i].u.concat(adj[i].d), p = k ? row[k - 1] : 0;
        const gap = !k ? 0 : real(p) && real(i) ? 1 : real(p) ? CLEAR * slant(i) : real(i) ? CLEAR * slant(p) : 0.45;
        off[k] = k ? off[k - 1] + gap : 0;
        let t = 0;
        for (const j of nb) t += x[j];
        z[k] = (nb.length ? 0.5 * x[i] + 0.5 * (t / nb.length) : x[i]) - off[k];
      }
      // Pool adjacent violators: the nearest non-decreasing z.
      const val = [], cnt = [];
      for (let k = 0; k < m; k++) {
        val.push(z[k]); cnt.push(1);
        while (val.length > 1 && val[val.length - 2] > val[val.length - 1]) {
          const b = val.pop(), cb = cnt.pop(), a = val.pop(), ca = cnt.pop();
          val.push((a * ca + b * cb) / (ca + cb)); cnt.push(ca + cb);
        }
      }
      let k = 0;
      for (let g = 0; g < val.length; g++) for (let c = 0; c < cnt[g]; c++, k++) x[row[k]] = val[g] + off[k];
    }
  }
  let x0 = 1e9, x1 = -1e9;
  for (let i = 0; i < M; i++) { if (x[i] < x0) x0 = x[i]; if (x[i] > x1) x1 = x[i]; }
  // Fewer letters stand further apart and bigger. The top 22 rows are the bracket diagram's.
  const n = L.n, rad = [0, 0, 0, 3.2, 2.4, 1.7][n];
  const gy = [0, 0, 0, 29, 16, 9.6][n], sx = min([0, 0, 0, 26, 15, 9][n], (W - 2 * (rad + 2)) / max(1, x1 - x0));
  const yb = 74 + (height * gy) / 2;
  L.rad = rad; L.yb = yb; L.yt = yb - height * gy; L.gy = gy;
  L.px = new Float32Array(N); L.py = new Float32Array(N);
  const X = (i) => 32 + (x[i] - (x0 + x1) / 2) * sx, Y = (i) => yb - layerOf[i] * gy;
  for (let i = 0; i < N; i++) { L.px[i] = X(i); L.py[i] = Y(i); }
  L.pts = paths.map((p) => {
    const a = new Float32Array(p.length * 2), cum = new Float32Array(p.length);
    p.forEach((i, k) => {
      a[2 * k] = X(i); a[2 * k + 1] = Y(i);
      if (k) cum[k] = cum[k - 1] + sqrt((a[2 * k] - a[2 * k - 2]) ** 2 + (a[2 * k + 1] - a[2 * k - 1]) ** 2);
    });
    return { a, cum, len: cum[p.length - 1] };
  });
}

export function setup(params) {
  const lat = [];
  for (const n of [3, 4, 5]) lat[n] = buildLattice(n);
  params.s = {
    lat, n: 0, L: lat[5],
    R: new Float32Array(NP), G: new Float32Array(NP), B: new Float32Array(NP),
    dn: new Float32Array(42), upm: new Float32Array(42), vis: new Uint8Array(11), tr: new Float32Array(84), inCh: new Uint8Array(84), gh: new Uint8Array(84),
    hue: 0.5, speed: 2, u: 0.5, init: false, fade: 1, el: 0,
    cur: lat[5].bottom, dir: 1, mode: 0, wait: 0.3, to: 0, e: 0, hs: 0, steps: 0, lapLen: 0, flash: 0, fe: -1, endFlash: 0,
  };
}

// Steps still to take on this lap: what the Chain knob asks for less those taken, or the nearest a chain allows from here.
function remaining(S) {
  const L = S.L, m = (S.dir > 0 ? L.upLen : L.dnLen)[S.cur], lo = L.n - 1, hi = L.height;
  const want = round(lo + S.u * (hi - lo)) - S.steps;
  for (let k = 0; k <= hi; k++) {
    if (want + k >= 1 && (m >> (want + k)) & 1) return want + k;
    if (want - k >= 1 && (m >> (want - k)) & 1) return want - k;
  }
  return 0;
}

// One of the steps that keeps a chain of that length open, at random.
function nextStep(S) {
  const L = S.L, d = S.dir, mask = d > 0 ? L.upLen : L.dnLen, nb = d > 0 ? L.up : L.down, es = d > 0 ? L.upE : L.dnE;
  const r = remaining(S), cand = [];
  nb[S.cur].forEach((j, k) => { if ((mask[j] >> (r - 1)) & 1) cand.push(k); });
  const k = cand[floor(Math.random() * cand.length)];
  S.to = nb[S.cur][k];
  S.e = es[S.cur][k];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = (0.5 + cl(k[0], 0, 1)) % 1;
  S.speed = cl(k[1], 0.4, 3);
  S.u = (cl(k[3], -1, 1) + 1) / 2;
  const n = 5 - round(cl(k[2], 0, 2));
  if (n !== S.n) {
    // A new count of letters: its lattice fades in, the walker at the bottom.
    S.n = n; S.L = S.lat[n];
    S.cur = S.L.bottom; S.dir = 1; S.mode = 0; S.wait = 0.3; S.el = 0; S.steps = 0; S.fade = S.init ? 0 : 1; S.flash = 0;
    S.tr.fill(0); S.inCh.fill(0); S.gh.fill(0); S.vis.fill(0); S.vis[0] = 1;
    const N = S.L.N;
    for (let i = 0; i < N; i++) { S.dn[i] = S.L.le[S.cur * N + i]; S.upm[i] = S.L.le[i * N + S.cur]; }
  }
  S.init = true;
  S.fade = min(1, S.fade + d / 0.35);
  // A step takes 1 / Speed seconds: the head runs for 0.7 / Speed of it, between 0.2 s and 0.6 s, and the
  // walker waits out the rest. Time left over at the end of a stage goes to the next.
  const L = S.L, N = L.N, hop = cl(0.7 / S.speed, 0.2, 0.6), period = 1 / S.speed;
  if (S.mode === 0) {
    S.lapLen = S.steps + remaining(S);
    S.wait -= d;
    if (S.wait <= 0) {
      nextStep(S);
      S.mode = 1; S.el = -S.wait; S.hs = 0;
      S.inCh[S.e] = 1;
    }
  } else if (S.mode === 1) {
    S.el += d;
  } else {
    S.wait -= d;
    if (S.wait <= 0) {
      S.dir = -S.dir; S.steps = 0; S.mode = 0; S.wait = 0.2;
      S.gh.set(S.inCh);
      S.inCh.fill(0); S.vis.fill(0); S.vis[L.hb[S.cur]] = 1;
    }
  }
  if (S.mode === 1) {
    S.hs = min(1, S.el / hop);
    if (S.hs >= 1) {
      S.cur = S.to; S.steps++; S.flash = 1; S.fe = S.e; S.hs = 0;
      S.tr[S.e] = 1; S.vis[L.hb[S.cur]] = 1;
      const end = S.dir > 0 ? L.top : L.bottom;
      if (S.cur === end) { S.mode = 2; S.wait = 1.1; S.endFlash = 1; } else { S.mode = 0; S.wait = period - S.el; }
    }
  }
  S.flash *= exp(-d / 0.3);
  S.endFlash *= exp(-d / 0.5);
  // The path just walked stays as a ghost while the next one is walked.
  for (let e = 0; e < L.E; e++) if (!S.inCh[e]) S.tr[e] += ((S.gh[e] ? 0.4 : 0) - S.tr[e]) * (1 - exp(-d / 0.4));
  // The sides of the walker follow it, switching at the middle of a step.
  const c = S.mode === 1 && S.hs > 0.5 ? S.to : S.cur, ea = 1 - exp(-d / 0.1);
  for (let i = 0; i < N; i++) {
    S.dn[i] += (L.le[c * N + i] - S.dn[i]) * ea;
    S.upm[i] += (L.le[i * N + c] - S.upm[i]) * ea;
  }
}

// ---- drawing -------------------------------------------------------------
// Blends one LED toward a colour: by the brighter channel (the dim diagram, so
// crossings do not add up) or over what is there.
function put(S, px, py, r, g, b, w, over) {
  if (px < 0 || px >= W || py < 0 || py >= H || w <= 0) return;
  const q = py * W + px, a = w > 1 ? 1 : w;
  if (over) {
    S.R[q] += (r - S.R[q]) * a; S.G[q] += (g - S.G[q]) * a; S.B[q] += (b - S.B[q]) * a;
    return;
  }
  if (r * a > S.R[q]) S.R[q] = r * a;
  if (g * a > S.G[q]) S.G[q] = g * a;
  if (b * a > S.B[q]) S.B[q] = b * a;
}

// Coverage pushed toward all or nothing, so a one-LED line does not leave a fringe too dark to show.
const tight = (w) => cl(1.8 * w - 0.2, 0, 1);

function stroke(S, x0, y0, x1, y1, r, g, b, a, over) {
  const len = sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2), ns = ceil(len * 2) + 1;
  for (let s = 0; s <= ns; s++) {
    const u = s / ns, x = x0 + (x1 - x0) * u - 0.5, y = y0 + (y1 - y0) * u - 0.5, ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
    put(S, ix, iy, r, g, b, tight((1 - fx) * (1 - fy)) * a, over);
    put(S, ix + 1, iy, r, g, b, tight(fx * (1 - fy)) * a, over);
    put(S, ix, iy + 1, r, g, b, tight((1 - fx) * fy) * a, over);
    put(S, ix + 1, iy + 1, r, g, b, tight(fx * fy) * a, over);
  }
}

// A line w LEDs wide (1, 2 or 3), as bright as a == 1 at its brightest.
function line(S, x0, y0, x1, y1, r, g, b, a, w, over) {
  if (a <= 0.01) return;
  if (!w || w < 2) return stroke(S, x0, y0, x1, y1, r, g, b, a, over);
  const len = sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2) || 1, nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
  for (const o of w < 3 ? [-0.5, 0.5] : [-1, 0, 1]) stroke(S, x0 + nx * o, y0 + ny * o, x1 + nx * o, y1 + ny * o, r, g, b, a, over);
}

// The stretch of an edge's path between two distances along it, from its lower end.
function trace(S, P, d0, d1, c, a, w) {
  const q = P.a;
  for (let k = 0; k + 1 < P.cum.length; k++) {
    const c0 = P.cum[k], sl = P.cum[k + 1] - c0 || 1, u0 = cl((d0 - c0) / sl, 0, 1), u1 = cl((d1 - c0) / sl, 0, 1);
    if (u1 > u0) line(S, q[2 * k] + (q[2 * k + 2] - q[2 * k]) * u0, q[2 * k + 1] + (q[2 * k + 3] - q[2 * k + 1]) * u0, q[2 * k] + (q[2 * k + 2] - q[2 * k]) * u1, q[2 * k + 1] + (q[2 * k + 3] - q[2 * k + 1]) * u1, c[0], c[1], c[2], a, w, true);
  }
}

// A soft round dot of radius rad; with clear set, it empties the LEDs instead of lighting them.
function disc(S, cx, cy, rad, c, a, clear) {
  for (let py = floor(cy - rad - 1); py <= ceil(cy + rad + 1); py++)
    for (let px = floor(cx - rad - 1); px <= ceil(cx + rad + 1); px++) {
      const dx = px + 0.5 - cx, dy = py + 0.5 - cy, w = (rad + 0.5 - sqrt(dx * dx + dy * dy)) * a;
      if (!clear) put(S, px, py, c[0], c[1], c[2], w, true);
      else if (px >= 0 && px < W && py >= 0 && py < H && w > 0) {
        const q = py * W + px, k = 1 - (w > 1 ? 1 : w);
        S.R[q] *= k; S.G[q] *= k; S.B[q] *= k;
      }
    }
}

// The point a given distance along an edge's path.
function along(P, dist, out) {
  const { a, cum } = P, s = cl(dist, 0, P.len);
  let k = 1;
  while (k < cum.length - 1 && cum[k] < s) k++;
  const u = (s - cum[k - 1]) / (cum[k] - cum[k - 1] || 1);
  out[0] = a[2 * k - 2] + (a[2 * k] - a[2 * k - 2]) * u;
  out[1] = a[2 * k - 1] + (a[2 * k + 1] - a[2 * k - 1]) * u;
}

const mix = (a, b, t, o) => {
  for (let q = 0; q < 3; q++) o[q] = a[q] + (b[q] - a[q]) * t;
  return o;
};
const lo = [0, 0, 0], hi = [0, 0, 0], tc = [0, 0, 0], gr = [0, 0, 0], hp = [0, 0], tmp = [0, 0, 0], net = new Float32Array(36);
const lp = [0, 0, 0], hp2 = [0, 0, 0], wh = [255, 255, 255], pk = [0, 0, 0], netc = [0, 0, 0];

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { L, R, G, B } = S, { N, E, px, py, pts, rad } = L, lw = L.n < 5 ? 2 : 1, hopping = S.mode === 1;
  R.fill(0); G.fill(0); B.fill(0);
  hsv(S.hue, 0.85, 0.9, lo);
  hsv(S.hue + 1 / 3, 0.85, 0.95, hi);
  hsv(S.hue + 2 / 3, 0.72, 1, tc);
  hsv(S.hue + 0.06, 0.4, 0.42, gr);
  mix(lo, wh, 0.4, lp);
  mix(hi, wh, 0.4, hp2);
  // The dim diagram has a tint that runs from the colour of the points below to the colour of
  // those above, kept pale where orange would turn brown.
  for (let q = 0; q < 12; q++) {
    const th = (S.hue + 0.06 + 0.24 * q / 11) % 1;
    hsv(th, 0.5 * (th < 0.22 ? 0.3 + 0.7 * sm(abs(th - 0.11) / 0.11) : 1), 0.58, tmp);
    net.set(tmp, q * 3);
  }
  const t0 = L.yb, ts = 10.99 / (L.yb - L.yt), layer = (y) => 3 * floor(cl((t0 - y) * ts, 0, 11));
  // Edges: the dim diagram, then the two sides of the walker, then the path walked.
  for (let e = 0; e < E; e++) {
    const a = pts[e].a;
    for (let k = 0; k + 3 < a.length; k += 2) {
      const q = layer((a[k + 1] + a[k + 3]) / 2);
      line(S, a[k], a[k + 1], a[k + 2], a[k + 3], net[q], net[q + 1], net[q + 2], 1);
    }
  }
  for (let e = 0; e < E; e++) {
    const P = pts[e];
    trace(S, P, 0, P.len, lo, min(S.dn[L.eu[e]], S.dn[L.ev[e]]), lw);
    trace(S, P, 0, P.len, hi, min(S.upm[L.eu[e]], S.upm[L.ev[e]]), lw);
  }
  for (let e = 0; e < E; e++) trace(S, pts[e], 0, pts[e].len, tc, S.tr[e], lw + 1);
  // The step in progress: the edge turns white behind the head, which runs from the lower point up.
  const c = S.cur;
  let hy = py[c];
  if (hopping) {
    const P = pts[S.e], run = sm(S.hs) * P.len, down = S.dir < 0;
    trace(S, P, down ? P.len - run : 0, down ? P.len : run, wh, 1, lw + 1);
    along(P, down ? P.len - run : run, hp);
    hy = hp[1];
  } else if (S.fe >= 0) trace(S, pts[S.fe], 0, pts[S.fe].len, wh, S.flash, lw + 1);
  for (let i = 0; i < N; i++) disc(S, px[i], py[i], rad + 0.9, wh, 1, true);
  for (let i = 0; i < N; i++) {
    const wd = S.dn[i], wu = S.upm[i], q = layer(py[i]);
    // The point takes the colour of its side, a little paler, with a glow round it.
    if (i !== c) {
      disc(S, px[i], py[i], rad + 0.8, mix(lo, [0, 0, 0], 0.6, pk), wd * (wd > 0.05));
      disc(S, px[i], py[i], rad + 0.8, mix(hi, [0, 0, 0], 0.6, pk), wu * (wu > 0.05));
    }
    disc(S, px[i], py[i], rad, mix([net[q], net[q + 1], net[q + 2]], [0, 0, 0], -0.7, netc), 1);
    disc(S, px[i], py[i], rad, lp, wd);
    disc(S, px[i], py[i], rad, hp2, wu);
  }
  const g = 255 * ((hopping ? 0.6 : 0.9) + 0.1 * S.endFlash);
  disc(S, px[c], py[c], rad + 0.8, [g, g, g], 1);
  if (hopping) {
    disc(S, hp[0], hy, rad + 1, wh, 1, true);
    disc(S, hp[0], hy, rad + 0.6, wh, 1);
  }
  ruler(S, hy);
  glyph(S);
  readout(S);
  const f = S.fade;
  for (let q = 0; q < NP; q++) display.setPixel(q % W, (q / W) | 0, R[q] * f, G[q] * f, B[q] * f);
}

// Down the left edge, a tick for each layer: lit for the layers the walker has stood on this lap,
// white where it is now, so a step that skips layers shows as skipped ticks.
function ruler(S, hy) {
  const { L } = S;
  for (let l = 0; l <= L.height; l++) {
    const y = L.yb - l * L.gy, near = cl(1.3 - abs(y - hy) / L.gy * 1.5, 0, 1);
    mix(S.vis[l] ? tc : [gr[0] * 1.3, gr[1] * 1.3, gr[2] * 1.3], wh, near, pk);
    for (let j = 0; j < 2; j++) put(S, j, floor(y), pk[0], pk[1], pk[2], 1, true);
  }
}

// Top right: a pip for each step of the lap, lit for those taken, and under them a bar split as
// the lattice is split by the walker: cyan for the share below it, magenta for the share above,
// dark between for the points it cannot be compared with.
function readout(S) {
  const { L, R, G, B } = S;
  for (let p = 0; p < L.height; p++) {
    const on = p < S.steps ? 1 : p === S.steps && S.mode === 1 ? sm(S.hs) : 0, k = p < S.lapLen ? 1.5 : 0.5;
    mix([gr[0] * k, gr[1] * k, gr[2] * k], tc, on, pk);
    for (let j = 0; j < 4; j++) put(S, 34 + p * 3 + (j & 1), 8 + (j >> 1), pk[0], pk[1], pk[2], 1, true);
  }
  let nd = 0, nu = 0;
  for (let i = 0; i < L.N; i++) { nd += S.dn[i]; nu += S.upm[i]; }
  for (let c = 0; c < 28; c++) {
    mix(mix(gr, lo, cl(28 * nd / L.N - c, 0, 1), pk), hi, cl(28 * nu / L.N - (27 - c), 0, 1), pk);
    for (let y = 14; y < 17; y++) { R[y * W + 34 + c] = pk[0]; G[y * W + 34 + c] = pk[1]; B[y * W + 34 + c] = pk[2]; }
  }
}

// The bracketing as nested brackets: a bar over the letters of each product, as high as the
// product is deep, with a leg down to the line of letters at each end. One rotation moves two
// bars; they slide to their new places and light up while they do.
function glyph(S) {
  const { L } = S, n = L.n, A = L.spA, Bq = L.spB, Hq = L.spH, gx = 5, gb = 19, sp = [0, 0, 0, 8, 6, 5][n], ly = [0, 0, 0, 5, 4, 3][n];
  const c = S.cur, t = S.mode === 1 ? sm(S.hs) : 0, to = S.mode === 1 ? S.to : c;
  for (let s = 0; s < n; s++) {
    const i0 = c * n + s, i1 = to * n + s;
    const a = A[i0] + (A[i1] - A[i0]) * t, b = Bq[i0] + (Bq[i1] - Bq[i0]) * t, h = Hq[i0] + (Hq[i1] - Hq[i0]) * t;
    const moved = A[i1] !== A[i0] || Bq[i1] !== Bq[i0] || Hq[i1] !== Hq[i0];
    mix([200, 205, 215], wh, moved ? sin(PI * t) : 0, pk);
    const x0 = gx + a * sp + 0.5, x1 = gx + b * sp + 0.5, y = gb - h * ly + 0.5, yb = gb + 0.5;
    line(S, x0, y, x1, y, pk[0], pk[1], pk[2], 1, 1, true);
    line(S, x0, y, x0, yb, pk[0], pk[1], pk[2], 0.8, 1, true);
    line(S, x1, y, x1, yb, pk[0], pk[1], pk[2], 0.8, 1, true);
  }
  for (let i = 0; i <= n; i++) for (let j = 2; j < 4; j++) put(S, gx + i * sp, gb + j, tc[0], tc[1], tc[2], 1, true);
}
