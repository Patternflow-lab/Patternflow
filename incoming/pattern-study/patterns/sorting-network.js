// ===== Patternflow pattern =====
// Title:   Sorting Network
// Family:  line
// Idea:    Sixteen coloured threads run down the panel and trade places one adjacent pair at a time along a uniformly random sorting network, the shortest way to reverse their order, so every thread swings across the panel on a sine curve while the swaps, marked as bright dots, crowd towards the middle in a semicircle.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: uniform random sorting networks (Omer Angel, Alexander Holroyd, Dan Romik, Bálint Virág, 2007), pattern round 33
// Round:   33
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Wires=16..32, Bubble=0..1
//
// Knob 1: Hue. Turns the threads' colours round the wheel together; at 0 they run gold, green, cyan, blue to violet from the thread that starts on the left to the one that starts on the right.
// Knob 2: Speed. Rows per second the picture scrolls up, four times the knob: at 2 eight rows a second and one whole network, 128 rows, every 16 seconds; at 0.2 a network takes 160 seconds.
// Knob 3: Wires. How many threads, 16 at the start up to 32. One network always fills 128 rows, so 16 threads make 120 swaps in it, about one a row, and 32 make 496, about four a row.
// Knob 4: Bubble. Blends each network from uniform at 0 to the bubble-sort network at 1, where one thread at a time runs straight across all the threads before it on a row of dots and the rest step aside in parallel curves. At 0.5 bundles of parallel threads show through, and by 0.75 the sine curves are gone. The networks on the panel change as it turns.
// Buttons: K1 tap lights one thread for eight seconds and dims the rest, so its sine curve stands out from end to end; each tap picks another.

const W = 64, H = 128, NET = 128;
const HMAX = 12, HALF_PI = Math.PI / 2;
const { min, max, floor, ceil, sin, cos } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// A uniformly random standard Young tableau of the staircase (n-1, ..., 1),
// by the hook walk of Greene, Nijenhuis and Wilf (1979): start on a uniform
// cell, jump to a uniform other cell of its hook until the walk stands on a
// corner, write the largest number not yet used there, take the corner off.
// T[r * (n-1) + c], 0-indexed, rows of n-1-r cells.
function hookWalk(n) {
  const R = n - 1, len = new Int32Array(R), T = new Int32Array(R * R);
  for (let r = 0; r < R; r++) len[r] = R - r;
  let cells = (n * (n - 1)) / 2;
  for (let val = cells; val >= 1; val--, cells--) {
    let k = floor(Math.random() * cells), r = 0;
    while (k >= len[r]) (k -= len[r]), r++;
    let c = k;
    for (;;) {
      const arm = len[r] - 1 - c;
      let leg = 0;
      while (r + leg + 1 < R && len[r + leg + 1] > c) leg++;
      if (arm + leg === 0) break;
      const h = floor(Math.random() * (arm + leg));
      if (h < arm) c += 1 + h;
      else r += 1 + h - arm;
    }
    T[r * R + c] = val;
    len[r]--;
  }
  return T;
}

// The tableau read row by row, 1 to N: under Edelman-Greene it is the
// bubble-sort network run backwards in time, 1 | 2 1 | 3 2 1 | ..., where
// the thread in place k walks left past all k threads before it in one
// straight diagonal. Read column by column it is the mirror image.
function readTableau(n, byRow) {
  const R = n - 1, T = new Int32Array(R * R);
  let v = 1;
  for (let a = 0; a < R; a++) for (let b = 0; b < R - a; b++) T[byRow ? a * R + b : b * R + a] = v++;
  return T;
}

// Edelman-Greene (1987), as Angel, Holroyd, Romik and Virag lay it out:
// N times over, the largest entry N sits in a corner (i, j) with i + j = n,
// 1-indexed; swap places j and j + 1; empty that cell and slide the hole to
// (1, 1), each time moving in the larger of the neighbours above and to the
// left; add 1 to every entry and write 1 in (1, 1). Adding 1 to everything
// is kept as one offset, so a network costs N * n steps, not N * N. Checked
// in a scratch script over 1400 networks with n from 3 to 32: every swap
// takes a pair still in order and each network ends reversed; at n = 4 all
// 16 reduced words of the longest permutation came out equally often.
function edelmanGreene(T0, n, out) {
  const R = n - 1, N = (n * (n - 1)) / 2, t = Int32Array.from(T0);
  let off = 0;
  for (let s = 0; s < N; s++) {
    let r = 0;
    while (r < R && t[r * R + R - 1 - r] + off !== N) r++;
    let c = R - 1 - r;
    out[s] = c;
    for (;;) {
      const up = r > 0 ? t[(r - 1) * R + c] : -1e9, lf = c > 0 ? t[r * R + c - 1] : -1e9;
      if (r === 0 && c === 0) break;
      if (up > lf) (t[r * R + c] = up), r--;
      else (t[r * R + c] = lf), c--;
    }
    off++;
    t[0] = 1 - off;
  }
}

// Each cell gets (1 - b) * uniform + b * bubble. Both tableaux grow along
// rows and down columns, so their blend does too, and ranking the cells by
// it is a standard tableau again: a sorting network for every b.
function network(P, net) {
  const n = P.n, R = n - 1, N = (n * (n - 1)) / 2, b = P.bubble;
  const Tb = (net.m & 1) === 0 ? P.tabRow : P.tabCol;
  let T = net.tu;
  if (b > 0) {
    const key = new Float64Array(R * R), ids = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < R - r; c++) {
      const i = r * R + c;
      key[i] = (1 - b) * net.tu[i] + b * Tb[i];
      ids.push(i);
    }
    ids.sort((x, y) => key[x] - key[y] || x - y);
    T = new Int32Array(R * R);
    for (let k = 0; k < N; k++) T[ids[k]] = k + 1;
  }
  edelmanGreene(T, n, net.sw);
  // The cheap form of the check, once a network: every swap must take a
  // pair still in its starting order, and the end must be the reversal.
  // A miss falls back on bubble sort, which is always right.
  const a = Int32Array.from({ length: n }, (_, i) => i);
  let ok = true;
  for (let s = 0; s < N && ok; s++) {
    const p = net.sw[s], x = a[p];
    if (x > a[p + 1]) ok = false;
    (a[p] = a[p + 1]), (a[p + 1] = x);
  }
  for (let i = 0; i < n && ok; i++) if (a[i] !== n - 1 - i) ok = false;
  if (!ok) edelmanGreene(Tb, n, net.sw);
  net.b = b;
}

function rebuild(P) {
  const n = P.n;
  P.tabRow = readTableau(n, true);
  P.tabCol = readTableau(n, false);
  P.nets = new Map();
  P.cols = new Float32Array(n * 3);
  // Four threads are drawn bright, both edges and two between, 0, 5, 10
  // and 15 of sixteen: the edges swing all the way across on half a cosine,
  // the two inside on arcs whose height the network picks.
  P.lead = new Uint8Array(n);
  for (let k = 0; k < 4; k++) P.lead[Math.round((k * (n - 1)) / 3)] = 1;
  P.colHue = NaN;
  const cap = 4 * ((n * (n - 1)) / 2) + 8;
  P.mt = new Float32Array(cap);
  P.md = new Int8Array(cap);
  P.mw = new Int32Array(cap);
  P.mh = new Float32Array(cap);
  P.mr = new Float32Array(cap);
  P.dt_ = new Float32Array(cap);
  P.dp = new Int32Array(cap);
  P.da = new Int32Array(cap);
  P.db = new Int32Array(cap);
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, n: 16, bubble: 0.06, scroll: 0, hl: -1, hlT: 0, hlA: 0,
    buf: new Float32Array(W * H * 3),
  };
  rebuild(params.s);
}

function getNet(P, m) {
  let net = P.nets.get(m);
  if (!net) {
    net = { m, tu: hookWalk(P.n), sw: new Int32Array((P.n * (P.n - 1)) / 2), b: -1 };
    P.nets.set(m, net);
  }
  if (net.b !== P.bubble) network(P, net);
  return net;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 16, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  const n = cl(Math.round(k[2]), 16, 32);
  if (n !== P.n) (P.n = n), rebuild(P), (P.hl = -1), (P.hlT = 0);
  // Bubble moves in steps of 1/200 so a knob resting between two readings
  // does not rebuild the networks every frame.
  P.bubble = Math.round(cl(k[3], 0, 1) * 200) / 200;
  if (input.btnPressed && input.btnPressed[0]) {
    let w = floor(Math.random() * (P.hl < 0 ? P.n : P.n - 1));
    if (P.hl >= 0 && w >= P.hl) w++;
    P.hl = w;
    P.hlT = 8;
  }
  P.hlT = max(0, P.hlT - d);
  P.hlA += ((P.hlT > 0 ? 1 : 0) - P.hlA) * min(1, d * 5);
  P.scroll += d * P.speed * 4;
  const first = floor(P.scroll / NET) - 1;
  for (const m of P.nets.keys()) if (m < first) P.nets.delete(m);
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const n = P.n, N = (n * (n - 1)) / 2, buf = P.buf, sp = W / n;
  if (P.colHue !== P.hue) {
    // Gold through green, cyan and blue to violet: the thread that starts on
    // the left is gold at Hue 0, the one on the right violet, never red.
    for (let v = 0; v < n; v++) hsv(P.hue + 0.14 + (0.64 * v) / (n - 1), 0.82, 1, P.cols, v * 3);
    P.colHue = P.hue;
  }
  buf.fill(0);
  // Every move in sight, in time order. Row y holds network time scroll + y;
  // network m fills times 128 m to 128 (m + 1) and starts from the identity
  // when m is even, from the reversal when m is odd, so threads run on from
  // one network into the next and nothing has to be carried between them.
  const T0 = P.scroll - HMAX - 1, T1 = P.scroll + H + HMAX + 1;
  const cnt = new Int32Array(n), mt = P.mt, md = P.md, mw = P.mw, mh = P.mh, mr = P.mr;
  // Moves are grouped by thread: thread w owns slots w * per .. w * per + per.
  const per = floor(mt.length / n);
  let nd = 0;
  for (let m = floor(T0 / NET); m <= floor(T1 / NET); m++) {
    const net = getNet(P, m), st = new Int32Array(n);
    for (let p = 0; p < n; p++) st[p] = m & 1 ? n - 1 - p : p;
    for (let s = 0; s < N; s++) {
      const t = m * NET + ((s + 0.5) * NET) / N, p = net.sw[s], a = st[p], b = st[p + 1];
      st[p] = b;
      st[p + 1] = a;
      if (t < T0 || t > T1) continue;
      if (cnt[a] >= per || cnt[b] >= per) continue;
      const ia = a * per + cnt[a]++, ib = b * per + cnt[b]++;
      (mt[ia] = t), (md[ia] = 1), (mw[ia] = p);
      (mt[ib] = t), (md[ib] = -1), (mw[ib] = p + 1);
      P.dt_[nd] = t;
      P.dp[nd] = p;
      P.da[nd] = a;
      P.db[nd] = b;
      nd++;
    }
  }
  // A thread leaves the middle of its place halfway between its swaps,
  // meets its partner on the boundary at the swap and settles in the middle
  // of the next place halfway to its swap after, never taking more than
  // HMAX rows a side. Each thread keeps its own timing, so it is always
  // under way and still crosses its partner at the dot: both are on the
  // boundary at the swap time.
  for (let w = 0; w < n; w++) {
    const o = w * per;
    for (let i = 0; i < cnt[w]; i++) {
      mh[o + i] = i > 0 ? min(HMAX, (mt[o + i] - mt[o + i - 1]) / 2) : HMAX;
      mr[o + i] = i + 1 < cnt[w] ? min(HMAX, (mt[o + i + 1] - mt[o + i]) / 2) : HMAX;
    }
  }
  const hlA = P.hlA, cols = P.cols;
  for (let w = 0; w < n; w++) {
    const o = w * per;
    // Place of thread w at the top of the window: where its first move in
    // sight starts from, or, with no move in sight, where it sits.
    let i = 0;
    let base = cnt[w] > 0 ? mw[o] - md[o] : placeAt(P, w, T0);
    const lead = P.lead[w], lit = w === P.hl ? 1 : 1 - 0.75 * hlA;
    const gain = ((lead ? 0.85 : 0.4) + (w === P.hl ? (1 - (lead ? 0.85 : 0.4)) * hlA : 0)) * lit;
    const cr = cols[w * 3] * gain, cg = cols[w * 3 + 1] * gain, cb = cols[w * 3 + 2] * gain;
    // A quarter cosine into the boundary and a quarter sine out of it.
    const xAt = (t) => {
      while (i < cnt[w] && t >= mt[o + i] + mr[o + i]) (base += md[o + i]), i++;
      let pos = base;
      if (i < cnt[w]) {
        const u = t - mt[o + i];
        if (u >= 0) pos += md[o + i] * (0.5 + 0.5 * sin((u / mr[o + i]) * HALF_PI));
        else if (u > -mh[o + i]) pos += md[o + i] * 0.5 * (1 - cos(((u + mh[o + i]) / mh[o + i]) * HALF_PI));
      }
      return (pos + 0.5) * sp;
    };
    for (let y = 0; y < H; y++) {
      const t = P.scroll + y, xa = xAt(t), xm = xAt(t + 0.5), xb = xAt(t + 1);
      const lo = min(xa, xm, xb), hi = max(xa, xm, xb);
      const c0 = max(0, floor(lo - 1)), c1 = min(W - 1, ceil(hi + 1));
      for (let c = c0; c <= c1; c++) {
        const cx = c + 0.5, dist = cx < lo ? lo - cx : cx > hi ? cx - hi : 0;
        const a = cl((1 - dist) * 1.6, 0, 1);
        if (a <= 0) continue;
        const q = (y * W + c) * 3;
        buf[q] += cr * a;
        buf[q + 1] += cg * a;
        buf[q + 2] += cb * a;
      }
    }
  }
  // The swaps: a pale dot where the two threads meet, half white and half
  // the mix of the pair. Their density across the panel is the semicircle.
  for (let j = 0; j < nd; j++) {
    const yc = P.dt_[j] - P.scroll, xc = (P.dp[j] + 1) * sp;
    if (yc < -2 || yc > H + 2) continue;
    const a = P.da[j], b = P.db[j];
    const dim = hlA > 0 && a !== P.hl && b !== P.hl ? 1 - 0.6 * hlA : 1;
    const r = (0.55 + 0.25 * (cols[a * 3] + cols[b * 3])) * dim;
    const g = (0.55 + 0.25 * (cols[a * 3 + 1] + cols[b * 3 + 1])) * dim;
    const bl = (0.55 + 0.25 * (cols[a * 3 + 2] + cols[b * 3 + 2])) * dim;
    for (let y = floor(yc - 1.5); y <= ceil(yc + 1.5); y++) {
      if (y < 0 || y >= H) continue;
      for (let x = floor(xc - 1.5); x <= ceil(xc + 1.5); x++) {
        if (x < 0 || x >= W) continue;
        const dx = x + 0.5 - xc, dy = y + 0.5 - yc, f = cl(1.15 - (dx * dx + dy * dy) * 0.55, 0, 1);
        if (f <= 0) continue;
        const q = (y * W + x) * 3;
        buf[q] = max(buf[q], r * f);
        buf[q + 1] = max(buf[q + 1], g * f);
        buf[q + 2] = max(buf[q + 2], bl * f);
      }
    }
  }
  for (let p = 0, q = 0; p < W * H; p++, q += 3) {
    const x = p % W, y = (p / W) | 0;
    display.setPixel(x, y, min(255, buf[q] * 255), min(255, buf[q + 1] * 255), min(255, buf[q + 2] * 255));
  }
}

// Where thread w sits at time t, by playing its network from the start.
function placeAt(P, w, t) {
  const n = P.n, N = (n * (n - 1)) / 2, m = floor(t / NET), net = getNet(P, m);
  let pos = m & 1 ? n - 1 - w : w;
  const st = new Int32Array(n);
  for (let p = 0; p < n; p++) st[p] = m & 1 ? n - 1 - p : p;
  for (let s = 0; s < N; s++) {
    if (m * NET + ((s + 0.5) * NET) / N > t) break;
    const p = net.sw[s], a = st[p];
    st[p] = st[p + 1];
    st[p + 1] = a;
    if (st[p] === w) pos = p;
    else if (st[p + 1] === w) pos = p + 1;
  }
  return pos;
}
