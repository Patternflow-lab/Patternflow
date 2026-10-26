// ===== Patternflow pattern =====
// Title:   Tree Peano Curve
// Family:  line
// Idea:    A uniform spanning tree of the panel's 32 x 64 blocks of 2 x 2 LEDs grows by Wilson's loop-erased random walks, and its Peano curve, which winds round the tree through every one of the 8192 LEDs once on its way from the bottom left corner to the top left, is coloured green to magenta in the order it passes them, so its space-filling sweep up the panel shows as fractal fronts while pale fronts and short runners flow along it, and every 8 seconds a new tree is grown and its curve traced in.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: uniform spanning tree by loop-erased random walks (David Wilson, 1996), its Peano curve converges to SLE(8) (Gregory Lawler, Oded Schramm and Wendelin Werner, 2004), pattern round 56
// Round:   56
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Bands=1..8, Stretch=-1..1
//
// Knob 1: Hue. Turns the curve's colours round the wheel. At 0 the curve runs from green at the bottom left corner through teal and blue to magenta at the top left; at 0.25 from azure through violet and red to orange; at 0.5 from violet through red and yellow to teal; at 0.75 from red through yellow and green to azure. Orange and yellow are lifted most of the way to full light between fronts, so they never sink to brown.
// Knob 2: Speed. At 2 each tree lasts 8 s: colour flows over its curve for 3.6 s, Wilson's walks grow the next tree in 2 s (about 5,600 steps of 840 walks, the first slowly), and the next curve is traced in from the corner in 2.4 s. Fronts run 1,024 LEDs a second along the curve and the 51 runners 40. At 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Bands. How many pale fronts run along the curve at once, 1 to 8. A front lights the stretch of curve it has just passed, so its edge is the outline of the region the curve has filled so far, the discrete SLE(8) hull. At 1 one front sweeps up the panel and each LED is passed every 8 s at Speed 2; at 8 eight fronts run 1,024 LEDs apart and each LED is passed every second.
// Knob 4: Stretch. An upright edge of the grid weighs e^(2.5 x Stretch) times a level one, 12 times at 1, and the walks step up and down that much more often, which makes the tree the weighted uniform one. At -1 a fifth of the tree's 2,047 edges stand upright and the curve lies in long level folds, at the opening 0.06 just over half do, and at 1 four fifths do and the curve hangs in tall columns.

const W = 64, H = 128, N = W * H;
// The tree lives on the 32 x 64 grid of 2 x 2 LED blocks.
const X = 32, Y = 64, M = X * Y;
const { floor, min, max, exp, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Direction bits of a tree edge out of a block.
const E = 1, WE = 2, S_ = 4, NO = 8;
// Seconds at Speed 2: colour flows over the finished curve, then Wilson's
// walks grow the next tree, then the next curve is traced in from a to b.
const FLOW = 3.6, GROW = 2.0, TRACE = 2.4;
// A front runs the whole cycle in this many seconds at Speed 2, whatever
// the number of bands, so more bands pass each LED more often.
const LAP = 8;
// The hue at a at knob 0, and how far round the wheel it turns by b.
const HUE0 = 0.3, SPAN = 0.6;
// Runners: a bright head every GAP LEDs along the curve with a tail TAIL
// LEDs long, running from a to b at RUN LEDs a second at Speed 2, so the
// way the curve winds shows LED by LED.
const GAP = 160, TAIL = 32, RUN = 40;
const TL = new Float32Array(GAP);
for (let i = 0; i < TAIL; i++) TL[i] = 0.8 * Math.pow(1 - i / TAIL, 1.6);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The wired arc: the blocks along the bottom, up the right side and back
// along the top, joined in one path that every tree contains. The left side
// is free. The curve then runs from the bottom left corner (a) to the top
// left corner (b), which is Lawler, Schramm and Werner's set-up.
const ARC = [];
for (let i = 0; i < X; i++) ARC.push((Y - 1) * X + i);
for (let j = Y - 2; j >= 0; j--) ARC.push(j * X + X - 1);
for (let i = X - 2; i >= 0; i--) ARC.push(i);

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, bands: 1, stretch: 0,
    adj: new Uint8Array(M), nadj: new Uint8Array(M),
    sOld: new Int16Array(N).fill(-1), sNew: new Int16Array(N),
    log: new Int16Array(1 << 16), nlog: 0,
    inT: new Uint8Array(M), par: new Int16Array(M), born: new Float32Array(M), blen: new Int16Array(M),
    path: new Int16Array(M), pos: new Int16Array(M), plen: 0, k: 0,
    phase: -1, pt: 0, phi: 0, psi: 0,
    rgb: new Float32Array(N * 3), pal: new Float32Array(1024 * 3), warm: new Float32Array(1024), palKey: -1,
  };
}

function link(adj, p, out) {
  const x = p & 63, y = p >> 6, b = (y >> 1) * X + (x >> 1), sx = x & 1, sy = y & 1;
  out[0] = adj[b] & (sx ? E : WE) ? p + (sx ? 1 : -1) : p ^ 64;
  out[1] = adj[b] & (sy ? S_ : NO) ? p + (sy ? W : -W) : p ^ 1;
}

const dirOf = (a, b) => (b === a + 1 ? E : b === a - 1 ? WE : b === a + X ? S_ : NO);

// Wilson's algorithm with the arc as root: from each block not yet in the
// tree a random walk runs until it meets the tree, and its loop erasure is
// added. Edge weights wh (across) and wv (up and down) bias the walk, which
// makes the tree the weighted uniform one. Every step is logged so the
// walks can be shown afterwards at the pace of the panel.
function wilson(S, wh, wv) {
  const inT = new Uint8Array(M), nxt = new Int16Array(M).fill(-1), adj = S.nadj;
  adj.fill(0);
  for (const v of ARC) inT[v] = 1;
  for (let k = 0; k + 1 < ARC.length; k++) {
    const a = ARC[k], b = ARC[k + 1];
    adj[a] |= dirOf(a, b);
    adj[b] |= dirOf(b, a);
  }
  const order = new Int16Array(M);
  for (let i = 0; i < M; i++) order[i] = i;
  for (let i = M - 1; i > 0; i--) {
    const j = floor(Math.random() * (i + 1)), t = order[i];
    order[i] = order[j];
    order[j] = t;
  }
  let n = 0, log = S.log;
  const put = (v) => {
    if (n >= log.length) {
      const big = new Int16Array(log.length * 2);
      big.set(log);
      log = S.log = big;
    }
    log[n++] = v;
  };
  for (let o = 0; o < M; o++) {
    const s = order[o];
    if (inT[s]) continue;
    put(s);
    let u = s;
    while (!inT[u]) {
      const i = u % X, j = (u / X) | 0;
      const a = i > 0 ? wh : 0, b = i < X - 1 ? wh : 0, c = j > 0 ? wv : 0, d = j < Y - 1 ? wv : 0;
      let r = Math.random() * (a + b + c + d);
      const v = (r -= a) < 0 ? u - 1 : (r -= b) < 0 ? u + 1 : (r -= c) < 0 ? u - X : u + X;
      nxt[u] = v;
      put(v);
      u = v;
    }
    for (u = s; !inT[u]; u = nxt[u]) {
      inT[u] = 1;
      adj[u] |= dirOf(u, nxt[u]);
      adj[nxt[u]] |= dirOf(nxt[u], u);
    }
  }
  S.nlog = n;
}

// The curve. Each block starts as a ring round its own four LEDs; every tree
// edge cuts the two facing sides of two rings and joins them across, so the
// tree's 2047 edges join the 2048 rings into one cycle through all 8192
// LEDs, the outline of the thickened tree. It is cut where it leaves the
// bottom left corner: the Peano path from a to b first, then 254 LEDs back
// round the outside of the arc.
function trace(adj, s) {
  s.fill(-1);
  const nb = [0, 0];
  let prev = 127 * W, p = 126 * W, k = 0;
  while (k < N && s[p] < 0) {
    s[p] = k++;
    link(adj, p, nb);
    const q = nb[0] !== prev ? nb[0] : nb[1];
    prev = p;
    p = q;
  }
  return k;
}

function startGrow(S) {
  const a = S.stretch * 1.25;
  wilson(S, exp(-a), exp(a));
  S.inT.fill(0);
  for (const v of ARC) S.inT[v] = 1;
  S.born.fill(-9);
  S.pos.fill(-1);
  S.plen = 0;
  S.k = 0;
}

// One logged step of the walks: start, step, erase a loop, or join the tree.
// Erasing each loop as it closes gives back the same tree Wilson's run built.
function replay(S) {
  const v = S.log[S.k++], { path, pos, inT } = S;
  if (S.plen === 0) {
    path[0] = v;
    pos[v] = 0;
    S.plen = 1;
  } else if (inT[v]) {
    for (let i = 0; i < S.plen; i++) {
      const u = path[i];
      inT[u] = 1;
      pos[u] = -1;
      S.par[u] = i + 1 < S.plen ? path[i + 1] : v;
      S.born[u] = S.pt;
      S.blen[u] = S.plen;
    }
    S.plen = 0;
  } else if (pos[v] >= 0) {
    for (let i = pos[v] + 1; i < S.plen; i++) pos[path[i]] = -1;
    S.plen = pos[v] + 1;
  } else {
    pos[v] = S.plen;
    path[S.plen++] = v;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.bands = cl(kv[2], 1, 8);
  S.stretch = cl(kv[3], -1, 1);
  const g = (d * S.speed) / 2;
  S.phi += (g * S.bands) / LAP;
  S.psi += g * RUN;
  if (S.phase < 0) {
    // The first tree is grown at once and traced in from black.
    startGrow(S);
    S.adj.set(S.nadj);
    trace(S.adj, S.sNew);
    S.phase = 2;
    S.pt = 0;
    return;
  }
  S.pt += g;
  if (S.phase === 0 && S.pt >= FLOW) {
    S.phase = 1;
    S.pt = 0;
    S.sOld.set(S.sNew);
    startGrow(S);
  } else if (S.phase === 1) {
    const want = floor(pow(cl(S.pt / GROW, 0, 1), 2.5) * S.nlog);
    while (S.k < want) replay(S);
    if (S.pt >= GROW) {
      S.adj.set(S.nadj);
      trace(S.adj, S.sNew);
      S.phase = 2;
      S.pt = 0;
    }
  } else if (S.phase === 2 && S.pt >= TRACE) {
    S.phase = 0;
    S.pt = 0;
  }
}

// A monotone turn of the hue circle that hurries through orange and
// yellow, which read brown and olive when dim.
const warp = (h) => h + (0.5 / (2 * Math.PI)) * Math.sin(2 * Math.PI * (h - 0.11));

// Hue by place along the whole curve, from a to b; brightness and a
// whitening by how long ago the last front passed.
function palette(S) {
  const key = S.hue;
  if (key === S.palKey) return;
  S.palKey = key;
  const P = S.pal, h0 = HUE0 + S.hue;
  for (let i = 0; i < 1024; i++) {
    // Deep blue is paled a little, since it reads darkest on the LEDs.
    const h = warp(h0 + SPAN * (i / 1023));
    hsv(h, 0.88 - 0.3 * max(0, Math.cos(2 * Math.PI * (h - 0.66))), 1, P, i * 3);
    // Orange and yellow keep most of their light even long after a front,
    // so they never sink to brown and olive.
    S.warm[i] = 0.65 * pow(max(0, Math.cos(2 * Math.PI * (h - 0.11))), 2);
  }
}
// Palette index by place on the cycle: up the hues along the Peano path,
// then back down them along the 254 LEDs that close the cycle round the
// outside of the arc, so the closing run meets a in a's own colour.
const PATH = N - 254, HP = new Int16Array(N);
for (let s = 0; s < N; s++) HP[s] = s < PATH ? ((s * 1023) / PATH) | 0 : (((N - s) * 1023) / (N - PATH)) | 0;
const VL = new Float32Array(1024), WL = new Float32Array(1024);
for (let i = 0; i < 1024; i++) {
  const u = i / 1023;
  VL[i] = 0.45 + 0.55 * u;
  WL[i] = 0.55 * Math.pow(u, 8);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.phase < 0) return;
  palette(S);
  const rgb = S.rgb, P = S.pal, K = S.bands, phi = S.phi, sN = S.sNew, sO = S.sOld;
  const ph = S.phase, pt = S.pt;
  const head = ph === 2 ? (pt / TRACE) * N : N + 1e9;
  const dim = ph === 1 ? 1 - 0.6 * cl(pt / 0.4, 0, 1) : 0.4;
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    // Behind the head of a trace the new curve, ahead of it the old one.
    let s = sN[p], f = 1, tip = 0;
    if (ph === 1 || s > head) {
      s = sO[p];
      f = dim;
      if (s < 0) {
        rgb[o] = rgb[o + 1] = rgb[o + 2] = 0;
        continue;
      }
    } else if (ph === 2 && head - s < 160) tip = (1 - (head - s) / 160) ** 2;
    let u = (K * s) / N - phi;
    u -= floor(u);
    const i = HP[s], c = i * 3, ui = (u * 1023) | 0;
    // A runner's tail, if one is passing.
    let a = (S.psi - s) % GAP;
    if (a < 0) a += GAP;
    const t = ph === 1 ? 0 : TL[a | 0];
    const lo = VL[ui] + (1 - VL[ui]) * S.warm[i];
    f *= lo + (1 - lo) * t;
    const w = WL[ui] + (1 - WL[ui]) * t * 0.6;
    for (let e = 0; e < 3; e++) {
      const v = (P[c + e] + (1 - P[c + e]) * w) * f;
      // The tip of the curve being traced in glows white.
      rgb[o + e] = v + (1 - v) * tip;
    }
  }
  if (ph === 1) {
    // Wilson's walks: the loop-erased path still walking, and the branches
    // that have just joined the tree, drawn through the top left LED of
    // each block.
    const at = (v, c) => {
      const x = (v % X) * 2, y = ((v / X) | 0) * 2, o = (y * W + x) * 3;
      for (let e = 0; e < 3; e++) rgb[o + e] += (1 - rgb[o + e]) * c;
    };
    const mid = (a, b, c) => {
      const x = (a % X) + (b % X), y = ((a / X) | 0) + ((b / X) | 0), o = (y * W + x) * 3;
      for (let e = 0; e < 3; e++) rgb[o + e] += (1 - rgb[o + e]) * c;
    };
    for (let v = 0; v < M; v++) {
      const age = pt - S.born[v];
      if (age < 0 || age > 0.6) continue;
      // Long branches flash longer than the many short ones at the end.
      const c = 0.85 * min(1, S.blen[v] / 8) * exp(-age / 0.18);
      at(v, c);
      mid(v, S.par[v], c);
    }
    for (let i = 0; i < S.plen; i++) {
      at(S.path[i], 0.95);
      if (i) mid(S.path[i - 1], S.path[i], 0.95);
    }
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
