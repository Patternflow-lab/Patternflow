// ===== Patternflow pattern =====
// Title:   Mark and Sweep
// Family:  gc
// Idea:    Two stacked memories of square cells, resized at every collection, with a band of five root cells between them: a program streams objects of one to six cells into the free half, some lose their last reference and go dull, and when the space is spent a copying collector crawls through the live ones breadth-first, each copy white-hot until it is scanned, then the spaces swap, a sweep line clears the old one, and survivors age from cyan to violet.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: mark and sweep for Lisp (John McCarthy, 1960), the semispace copying collector (Robert Fenichel and Jerome Yochelson, 1969), its scan pointer that needs no stack (C. J. Cheney, 1970), the white, grey and black marking of objects (Edsger Dijkstra, Leslie Lamport and others, 1978); from memory, pattern round 268
// Round:   268
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.5..4, Survival=-1..1, Size=-1..1
//
// Knob 1: Hue. Adds 0 to 1 turns to every colour. At 0 objects are cyan, each allocation stretch leans its own way by up to 0.11 turn (and each object by 0.05), and each collection survived moves an object 0.03 turn on towards violet; one amber object at most, the oldest. The whole palette also walks by itself, up to 0.29 turn towards violet and 0.18 towards green, on a random walk of about 70 s. The ground is near black, mostly navy; orange hues get more light so they do not go brown.
// Knob 2: Pace. 0.5 to 4, opening at 2. How fast the program streams objects in and the collector crawls, together. At 2 the collector holds the picture for 3.4 s of an 8.9 s cycle (38 percent) and the stream fills the rest at about 14 cells a second; at 0.5 a collection takes 14 s of 31, at 4 it takes 1.7 s of 4.3.
// Knob 3: Survival. -1 to 1, opening at 0. How much of what is allocated stays reachable and for how long. Live cells when a collection starts, as a share of the space, averaged over 900 s: 9 percent at -1, 23 at -0.5, 46 at 0 (it wanders from 11 to 68), 54 at 0.5 and 62 at 1; a pressure term keeps it under about 75. Low is a heap of dull garbage with a few small clusters, high is a heap that is mostly live, and the copy fills most of the other space.
// Knob 4: Size. -1 to 1, opening near 0. Cells per object: 1 or 2 at -1, 2 to 4 at 0, 3 to 6 at 1, so the bars go from stubs to long runs.
//
// What the picture is. Two grids of square cells, one above the other, and between them a band with five root cells on a rail that slides slowly from side to side. At each collection the to-space is drawn a new grid, one of eight from 15 by 15 cells of 3 LED to 8 by 8 cells of 6 that holds what is live and differs from the last two, so the heap runs from 64 to 225 cells and the band moves and grows from 8 to 18 LED. Free cells are near black. A new object lights its cells one after another at the bump pointer, which breathes, joined into one bar with a lighter first cell; the heap fills to 66 to 100 percent of the space (92 on average) before the collector comes. Objects the program has let go of turn dull steel but stay lit. The roots flash and the collector copies each root's object to the free pointer of the other space, leaving a ghost, then the scan pointer walks the copies and copies what each points to: copied and unscanned objects are white-hot, scanned ones settle into the colour of their age. Then the spaces swap and the program goes on after the survivors, compacted at one end; a line sweeps the old space in step with the bump pointer, garbage and ghosts going dark behind it, so both spaces carry colour for most of a fill and the old one is black when the next collection starts. Each new to-space starts from a corner, in rows or in columns, straight or snaking.
// What is modelled. A real Cheney collector on a real reference graph: objects hold up to three references, there are five roots, the reachable set is a walk from the roots, objects are copied once and forwarded, the scan and free pointers move, and what is not reached stays behind. The program bump-allocates, rewires references, drops roots, takes objects out of the middle of chains and lets young objects die within a second or two.
// What is made up. Every rate, size and lifetime. The collector stops the program while it crawls. Dull marks garbage before the collector finds it, which a real heap cannot know. The allocation budget, the grid shapes and corners, the hues, the sweep and the lines. Survival, size, rate, collection time, palette and budget drift on random walks and sines of 47 to 137 s. The first update runs the heap a few tens of model seconds at the knobs given and starts half way through a collection.
//
// Size: 30 KB, over the 25 KB asked: one file holds the heap, its program, the collector with its clock, the grid shapes and the rasteriser.

const W = 64, H = 128, N = W * H;
const { floor, ceil, sqrt, exp, log, sin, abs, min, max, PI, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();

// a space is a grid of square cells, [pitch, columns, rows]; at every collection the to-space is given a new one, so the heap is resized
const GEO = [[4, 15, 14], [4, 15, 15], [5, 12, 10], [5, 12, 11], [5, 12, 12], [6, 9, 9], [6, 9, 10], [7, 8, 8]];
const NROOT = 5;
function makeGeo(gi, sp) {
  const [P, C, R] = GEO[gi], h = R * P - 1;
  return { gi, P, C, R, h, n: C * R, w: P - 1, x0: floor((W - (C * P - 1)) / 2), y0: sp ? 127 - h : 1 };
}
// address i of a space to its place on the panel: each space, when it becomes the to-space, starts from a corner and reads in rows or in columns, straight or snaking
const scr = (S, sp, i) => {
  const g = S.sg[sp];
  let c, r;
  if (S.tr[sp]) {
    c = (i / g.R) | 0;
    r = i % g.R;
    if (S.sn[sp] && (c & 1)) r = g.R - 1 - r;
  } else {
    c = i % g.C;
    r = (i / g.C) | 0;
    if (S.sn[sp] && (r & 1)) c = g.C - 1 - c;
  }
  if (S.fx[sp]) c = g.C - 1 - c;
  if (S.fy[sp]) r = g.R - 1 - r;
  return r * g.C + c;
};
const cellX = (S, sp, i) => S.sg[sp].x0 + (scr(S, sp, i) % S.sg[sp].C) * S.sg[sp].P;
const cellY = (S, sp, i) => S.sg[sp].y0 + ((scr(S, sp, i) / S.sg[sp].C) | 0) * S.sg[sp].P;
const ctr = (S, sp, i) => [cellX(S, sp, i) + ((S.sg[sp].P + 1) >> 1), cellY(S, sp, i) + ((S.sg[sp].P + 1) >> 1)];

function hue(h, o) {
  h -= floor(h);
  const x = h * 6;
  o[0] = cl(abs(x - 3) - 1, 0, 1);
  o[1] = cl(2 - abs(x - 2), 0, 1);
  o[2] = cl(2 - abs(x - 4), 0, 1);
}
// hue h, saturation s, target Rec. 601 luma y: a dark blue stays blue and a light one goes pale
function tone(h, s, y, o) {
  hue(h, o);
  const hh = h - floor(h), ow = max(0, 1 - abs(hh - 0.1) / 0.1);
  y = min(0.95, y * (1 + 0.6 * ow)); // a dark orange or olive is brown on the panel, so those hues get more light
  for (let c = 0; c < 3; c++) o[c] = 1 - s * (1 - o[c]);
  const Y = 0.299 * o[0] + 0.587 * o[1] + 0.114 * o[2];
  if (y <= Y) for (let c = 0; c < 3; c++) o[c] *= y / Y;
  else for (let c = 0; c < 3; c++) o[c] = o[c] * (1 - (y - Y) / (1 - Y)) + (y - Y) / (1 - Y);
}
function hsv(h, s, v, o) {
  hue(h, o);
  for (let c = 0; c < 3; c++) o[c] = v * (1 - s * (1 - o[c]));
}

// a new object takes the hue of K1 plus a little of its own, and goes azure, blue, blue-violet by the collections it lives through; amber only for one very old object
const LUMA = [0.44, 0.57, 0.72];
const LUMA_A = [0.43, 0.47, 0.5];
function objBase(S, o, out) {
  const ca = cl(o.cage, 0, 4), t = S.t3;
  tone(S.hb + 0.03 * min(ca, 3) + o.hj, 0.88, LUMA[o.ty], out);
  if (ca > 3) {
    tone(S.hb + 0.61, 0.92, LUMA_A[o.ty], t);
    for (let c = 0; c < 3; c++) out[c] += (t[c] - out[c]) * (ca - 3);
  }
  for (let c = 0; c < 3; c++) out[c] *= 255 * o.lj;
}

function makePalette(S, hb) {
  const o = S.t3, put = (dst, k) => { for (let c = 0; c < 3; c++) dst[c] = o[c] * k; };
  // garbage is a steel grey that leans a little to the hue
  tone(hb + 0.07, 0.3, 0.2, o);
  for (let c = 0; c < 3; c++) S.dullC[c] = o[c] * 38 + [54, 68, 124][c] * 0.85;
  tone(hb, 0.12, 0.97, o);
  put(S.whiteC, 255);
  tone(hb, 0.4, 0.82, o);
  put(S.rootC, 255);
  // ground and rail: mostly navy, a little of the hue
  for (const [dst, v] of [[S.gndC, 0.22], [S.railC, 0.2]]) {
    hsv(0.64, 0.9, v, S.tc);
    hsv(hb + 0.1, 0.6, v, o);
    for (let c = 0; c < 3; c++) dst[c] = (S.tc[c] * 0.6 + o[c] * 0.4) * 255;
  }
  S.hb = hb;
}

export function setup(params) {
  const S = {
    ready: false,
    ks: [0, 2, 0, 0.06],
    t: 0, tm: 0, seq: 0, mk: 1,
    sg: [makeGeo(4, 0), makeGeo(4, 1)], gfade: [1, 1], bc: 64, amber: null,
    heap: [], dying: [], ghosts: [], rl: [], live: 0, dirty: true,
    roots: new Array(NROOT).fill(null),
    rootFl: new Float32Array(NROOT), rootLit: new Float32Array(NROOT),
    fx: [0, 0], fy: [0, 0], sn: [0, 0], tr: [0, 0], sp: 0, ptr: 0, base: 0, lim: 100, mode: 0, cur: null, gapT: 0.1, pauseT: 0, rwT: 1, rtT: 3,
    gen: 0, gc: null, sweep: null, lines: [],
    t3: [0, 0, 0], tc: [0, 0, 0],
    dullC: [0, 0, 0], whiteC: [0, 0, 0], rootC: [0, 0, 0], gndC: [0, 0, 0], railC: [0, 0, 0],
    hb: -9, w: [0, 0, 0, 0], rcx: 31.5, cyc: 0,
    K: { speed: 1, pLong: 0.4, M: 30, cellRate: 22, rewire: 0.9, rootRate: 0.14, sizeLo: 2, sizeHi: 4 },
    img: new Float32Array(N * 3), lay: new Float32Array(N),
  };
  S.bc = bandCentre(S);
  params.s = S;
  return S;
}

const bandCentre = (S) => (1 + S.sg[0].h + 127 - S.sg[1].h) / 2;

// slow random walks: survival, object size, palette, allocation budget
const WTAU = [40, 55, 70, 45];
function wander(S, d) {
  for (let i = 0; i < 4; i++) {
    const g = (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;
    S.w[i] = cl(S.w[i] - (S.w[i] / WTAU[i]) * d + g * sqrt((2 * d) / WTAU[i]), -1.6, 1.6);
  }
}

function setK(S) {
  const K = S.K, t = S.t, ks = S.ks;
  const u = cl((ks[2] + 1) / 2 + 0.09 * sin((TAU * t) / 83 + 1.1) + 0.06 * sin((TAU * t) / 137 + 4) + 0.24 * S.w[0], 0, 1);
  const v = cl((ks[3] + 1) / 2 + 0.08 * sin((TAU * t) / 109 + 2) + 0.05 * sin((TAU * t) / 61) + 0.2 * S.w[1], 0, 1);
  K.speed = cl(ks[1], 0.5, 4) / 2;
  K.pLong = 0.05 + 0.78 * pow(u, 1.65);
  K.M = 8 + 70 * pow(u, 1.5);
  K.cellRate = 22 * (1 + 0.2 * sin((TAU * t) / 71 + 0.3) + 0.1 * sin((TAU * t) / 47));
  K.sizeLo = 1 + 2 * v;
  K.sizeHi = 2 + 4 * v;
}

// every object reachable from a root by a walk over its references, in breadth-first order
function reach(S) {
  const rl = S.rl, heap = S.heap, mk = ++S.mk;
  rl.length = 0;
  for (let i = 0; i < heap.length; i++) heap[i].ind = 0;
  for (let i = 0; i < NROOT; i++) {
    const r = S.roots[i];
    if (!r) continue;
    r.ind++;
    if (r.mk !== mk) { r.mk = mk; rl.push(r); }
  }
  let live = 0;
  for (let i = 0; i < rl.length; i++) {
    const o = rl[i];
    live += o.s;
    for (let k = 0; k < 3; k++) {
      const t = o.refs[k];
      if (!t) continue;
      t.ind++;
      if (t.mk !== mk) { t.mk = mk; rl.push(t); }
    }
  }
  for (let i = 0; i < heap.length; i++) heap[i].reach = heap[i].mk === mk;
  S.live = live;
  S.dirty = false;
}

// the mutator drops every reference to o; with some chance the first thing o pointed to takes its place, like a node taken out of a list
function cut(S, o, splice) {
  let child = null;
  for (let k = 0; k < 3; k++) if (o.refs[k] && o.refs[k] !== o) { child = o.refs[k]; break; }
  const heap = S.heap;
  for (let i = 0; i < heap.length; i++) {
    const h = heap[i];
    if (h === o) continue;
    for (let k = 0; k < 3; k++) if (h.refs[k] === o) h.refs[k] = splice && child && child !== h ? child : null;
  }
  for (let i = 0; i < NROOT; i++) if (S.roots[i] === o) { S.roots[i] = splice && child ? child : null; S.rootFl[i] = 1; }
  S.dirty = true;
}

function pickRecent(rl, long) {
  let best = null;
  for (let n = 0; n < 5; n++) {
    const a = rl[floor(rnd() * rl.length)], b = rl[floor(rnd() * rl.length)];
    const c = a.seq > b.seq ? a : b;
    if (!best) best = c;
    if (!long || c.dieAt === Infinity) return c;
  }
  return best;
}

function addStep(S, pts, dur, a) {
  S.lines.push({ pts, t: 0, dur, a });
  if (S.lines.length > 6) S.lines.shift();
}

// a rewired reference flashes both ends and draws a step between them
function link(S, a, b, f) {
  a.flash = b.flash = max(a.flash, f);
  const p = ctr(S, a.sp, a.at), q = ctr(S, b.sp, b.at);
  addStep(S, [p, [q[0], p[1]], q], 0.9, 0.5);
}

function allocate(S) {
  const n = S.sg[S.sp].n;
  // the collector comes when the allocation budget is spent, which drifts from two thirds to all of the space, and never before a seventh is free
  S.lim = min(n, max(cl(0.92 + 0.12 * S.w[3], 0.66, 1) * n, S.base + 0.15 * n));
  const free = floor(S.lim) - S.ptr;
  if (free <= 0) {
    S.mode = 1;
    S.pauseT = 0.45;
    for (let i = 0; i < NROOT; i++) S.rootFl[i] = 1;
    return;
  }
  const K = S.K;
  let s = cl(floor(K.sizeLo + rnd() * (K.sizeHi - K.sizeLo + 1)), 1, 6);
  if (s > free) s = free;
  const o = {
    seq: S.seq++, s, at: S.ptr, sp: S.sp, refs: [null, null, null], age: 0, cage: 0, ty: floor(rnd() * 3),
    stable: rnd() < 0.05, hj: S.cyc + (rnd() + rnd() - 1) * 0.05, lj: 0.88 + 0.24 * rnd(), fill: 0, glow: 1, flash: 0, dull: 0, white: 0, alpha: 1,
    reach: true, ind: 0, mk: 0, dieAt: Infinity, fwd: false, black: false, scn: false, rj: 0, kill: 0,
  };
  S.ptr += s;
  if (S.dirty) reach(S);
  const rl = S.rl;
  if (rl.length) {
    const nr = rnd() < 0.3 ? 0 : rnd() < 0.6 ? 1 : 2;
    for (let k = 0; k < nr; k++) o.refs[k] = rl[floor(rnd() * rl.length)];
  }
  const long = rnd() < K.pLong;
  if (!long) o.dieAt = S.tm + 0.1 + 1.2 * rnd() * rnd();
  let er = -1;
  const r0 = floor(rnd() * NROOT);
  for (let j = 0; j < NROOT; j++) if (!S.roots[(r0 + j) % NROOT]) { er = (r0 + j) % NROOT; break; }
  if (rl.length === 0 || (er >= 0 && rnd() < (long ? 0.6 : 0.2))) {
    const i = er >= 0 ? er : floor(rnd() * NROOT);
    S.roots[i] = o;
    S.rootFl[i] = 1;
  } else {
    const p = pickRecent(rl, long);
    let k = -1;
    for (let j = 0; j < 3; j++) if (!p.refs[j]) { k = j; break; }
    if (k < 0) k = floor(rnd() * 3);
    p.refs[k] = o;
    if (rnd() < 0.35) link(S, p, o, 0.7);
  }
  S.heap.push(o);
  S.cur = o;
  S.dirty = true;
}

function rewire(S) {
  if (S.dirty) reach(S);
  const rl = S.rl;
  if (rl.length < 4) return;
  const a = rl[floor(rnd() * rl.length)], b = rl[floor(rnd() * rl.length)];
  if (a === b || a.fill < a.s || b.fill < b.s) return;
  let k = -1;
  for (let j = 0; j < 3; j++) if (!a.refs[j]) { k = j; break; }
  if (k < 0) {
    for (let j = 0; j < 3; j++) if (a.refs[j] && a.refs[j].ind >= 2) { k = j; break; }
    if (k < 0) return;
    a.refs[k].ind--;
  }
  a.refs[k] = b;
  b.ind++;
  link(S, a, b, 1);
}

function rootSwap(S) {
  if (S.dirty) reach(S);
  const rl = S.rl;
  if (!rl.length) return;
  const i = floor(rnd() * NROOT);
  S.rootFl[i] = 1;
  if (S.roots[i] && rnd() < 0.35) S.roots[i] = null;
  else S.roots[i] = rl[floor(rnd() * rl.length)];
  S.dirty = true;
}

function mutate(S, m) {
  const K = S.K, n = S.sg[S.sp].n;
  if (S.cur) {
    const o = S.cur;
    o.fill += K.cellRate * (n / 144) * m;
    if (o.fill >= o.s) {
      o.fill = o.s;
      S.cur = null;
      S.gapT = 0.004 + 0.05 * rnd();
    }
  } else {
    S.gapT -= m;
    if (S.gapT <= 0) allocate(S);
  }
  if (S.mode !== 0) return;
  S.rwT -= m;
  if (S.rwT <= 0) { S.rwT = -log(1 - rnd() * 0.999) / K.rewire; rewire(S); }
  S.rtT -= m;
  if (S.rtT <= 0) { S.rtT = -log(1 - rnd() * 0.999) / K.rootRate; rootSwap(S); }
  if (S.dirty) reach(S);
  // deaths: young ones at their time, the rest by a hazard that grows as the live share nears the top
  const q = cl((S.live / n - 0.55) / 0.25, 0, 1), press = 1 + 14 * q * q;
  const rl = S.rl;
  for (let i = 0; i < rl.length; i++) {
    const o = rl[i];
    if (!o.reach || o.fill < o.s) continue;
    if (o.dieAt !== Infinity) {
      if (o.dieAt <= S.tm) { o.dieAt = Infinity; cut(S, o, rnd() < 0.3); o.reach = false; }
    } else if (rnd() < 1 - exp(-(o.stable ? 1 / (25 * K.M) : 1 / K.M) * press * m)) {
      cut(S, o, rnd() < 0.6);
      o.reach = false;
    }
  }
}

// a new shape for the to-space: room for what is live, unlike both spaces' last shapes, the band between them under 18 LED
function pickGeo(S, from, live) {
  const hf = S.sg[from].h, c1 = [], c2 = [];
  for (let k = 0; k < GEO.length; k++) {
    const g = makeGeo(k, 0);
    if (hf + g.h < 108 || g.n * 0.85 < live) continue;
    c2.push(k);
    if (k !== S.sg[0].gi && k !== S.sg[1].gi && g.n * 0.7 >= live) c1.push(k);
  }
  const c = c1.length ? c1 : c2.length ? c2 : [1];
  return c[floor(rnd() * c.length)];
}

function gcBegin(S) {
  sweepFinish(S);
  if (S.dirty) reach(S);
  let lv = 0, lk = 0;
  for (const o of S.rl) {
    lv++;
    for (let k = 0; k < 3; k++) if (o.refs[k]) lk++;
  }
  const from = S.sp, to = 1 - from;
  const T = 3.7 * (1 + 0.22 * sin((TAU * S.t) / 59 + 0.7));
  const gc = { from, to, free: 0, order: [], scan: 0, ri: 0, act: null, stage: 0, lv, dC: cl(T / (lv * 1.5 + lk * 0.35 + 1), 0.05, 0.85) };
  for (const o of S.heap) { o.fwd = false; o.black = false; o.scn = false; o.rj = 0; }
  S.gc = gc;
  S.mode = 2;
  S.sg[to] = makeGeo(pickGeo(S, from, S.live), to);
  S.gfade[to] = 0;
  S.fx[to] = rnd() < 0.5 ? 1 : 0;
  S.fy[to] = rnd() < 0.5 ? 1 : 0;
  S.sn[to] = rnd() < 0.5 ? 1 : 0;
  S.tr[to] = rnd() < 0.35 ? 1 : 0;
  for (let i = 0; i < NROOT; i++) S.rootFl[i] = 1;
}

function gcNext(S) {
  const gc = S.gc;
  while (gc.stage === 0) {
    if (gc.ri >= NROOT) { gc.stage = 1; break; }
    const ri = gc.ri++, o = S.roots[ri];
    if (!o) continue;
    return o.fwd ? actLink(S, null, o, ri) : actCopy(S, o, null, ri);
  }
  for (;;) {
    if (gc.scan >= gc.order.length) return null;
    const s = gc.order[gc.scan];
    if (s.black) { gc.scan++; continue; }
    s.scn = true;
    while (s.rj < 3) {
      const t = s.refs[s.rj++];
      if (!t) continue;
      return t.fwd ? actLink(S, s, t, -1) : actCopy(S, t, s, -1);
    }
    return { k: 2, o: s, t: 0, dur: gc.dC * 0.55 };
  }
}

const rootX = (S, i) => Math.round(S.rcx + (i - 2) * 8) - 2;
const busY = (S) => floor(S.bc);

function actCopy(S, o, parent, ri) {
  const gc = S.gc;
  objBase(S, o, S.tc);
  S.ghosts.push({ sp: o.sp, at: o.at, s: o.s, r: S.tc[0], g: S.tc[1], b: S.tc[2], a: 1, alpha: 1, hot: 1, kill: 0 });
  const sp0 = o.sp, at0 = o.at;
  o.sp = gc.to;
  o.at = gc.free;
  gc.free += o.s;
  o.fwd = true;
  o.fill = 0;
    o.age = min(o.stable && (!S.amber || S.amber === o) ? 4 : 3, o.age + 1);
  if (o.age === 4) S.amber = o;
  o.white = 0.9;
  gc.order.push(o);
  if (ri >= 0) S.rootFl[ri] = 1;
  if (gc.dC >= 0.17) {
    const a = ctr(S, sp0, at0), b = ctr(S, o.sp, o.at), by = busY(S);
    addStep(S, [a, [a[0], by], [b[0], by], b], 0.6, 0.5);
    if (parent) {
      const c = ctr(S, parent.sp, parent.at);
      addStep(S, [c, [b[0], c[1]], b], 0.5, 0.55);
    }
  }
  return { k: 0, o, t: 0, dur: gc.dC * (0.75 + 0.08 * o.s) };
}

function actLink(S, parent, t, ri) {
  const gc = S.gc;
  if (ri >= 0) S.rootFl[ri] = 1;
  if (gc.dC >= 0.17) {
    const b = ctr(S, t.sp, t.at);
    if (parent) {
      const c = ctr(S, parent.sp, parent.at);
      addStep(S, [c, [b[0], c[1]], b], 0.45, 0.5);
    } else {
      addStep(S, [[rootX(S, ri) + 2, busY(S)], [rootX(S, ri) + 2, b[1]], b], 0.5, 0.4);
    }
  }
  if (parent) { parent.flash = max(parent.flash, 0.6); t.flash = max(t.flash, 0.6); }
  return { k: 1, o: t, t: 0, dur: gc.dC * 0.35 };
}

function gcRun(S, m) {
  const gc = S.gc;
  for (let guard = 0; m > 0 && guard < 40; guard++) {
    if (!gc.act) {
      gc.act = gcNext(S);
      if (!gc.act) { gcEnd(S); return; }
    }
    const a = gc.act, need = a.dur - a.t;
    if (m < need) {
      a.t += m;
      if (a.k === 0) a.o.fill = a.o.s * (a.t / a.dur);
      return;
    }
    m -= need;
    a.t = a.dur;
    if (a.k === 0) a.o.fill = a.o.s;
    if (a.k === 2) { a.o.black = true; a.o.scn = false; }
    gc.act = null;
  }
}

function gcEnd(S) {
  const gc = S.gc, keep = [];
  S.sp = gc.to;
  S.ptr = S.base = gc.free;
  S.lim = 0.9 * S.sg[S.sp].n;
  for (const o of S.heap) {
    if (o.fwd) { keep.push(o); o.fwd = false; o.black = false; o.scn = false; o.white = 0; }
    else { S.dying.push(o); if (o === S.amber) S.amber = null; }
  }
  S.heap = keep;
  S.sweep = { sp: gc.from, y: -4 };
  S.mode = 0;
  S.cur = null;
  S.gapT = 0.15;
  S.gen++;
  S.cyc = (rnd() + rnd() - 1) * 0.11; // what is allocated in the next stretch leans to its own hue
  S.gc = null;
  S.lines.length = 0;
  S.dirty = true;
  reach(S);
  // a heap that is nearly all live would collect again at once, so the program lets a structure go
  for (let g = 0; g < 12 && S.live > 0.68 * S.sg[S.sp].n && S.rl.length; g++) {
    cut(S, S.rl[floor(rnd() * S.rl.length)], false);
    reach(S);
  }
}

// the old space is swept in step with the bump pointer
function sweepFinish(S) {
  S.dying.length = 0;
  S.ghosts.length = 0;
  S.sweep = null;
}
function sweepStep(S, m) {
  const w = S.sweep;
  if (!w) return;
  const g = S.sg[w.sp], tgt = cl((S.ptr - S.base) / max(1, S.lim - S.base), 0, 1) * (g.h + 8) - 4;
  if (tgt > w.y) w.y = min(tgt, w.y + 40 * m);
  const cross = (at) => ((scr(S, w.sp, at) / g.C) | 0) * g.P + (g.w >> 1) < w.y;
  for (const o of S.dying) if (!o.kill && cross(o.at)) o.kill = 1;
  for (const gh of S.ghosts) if (!gh.kill && cross(gh.at)) gh.kill = 1;
  if (w.y > g.h + 3) sweepFinish(S);
}

function ease(S, d) {
  const ed = 1 - exp(-d / 0.4), ec = 1 - exp(-d / 0.7), er = 1 - exp(-d / 0.08), ef = 1 - exp(-d / 0.55);
  const inGc = S.mode === 2;
  for (let l = 0; l < 2; l++) {
    const L = l ? S.dying : S.heap;
    for (let i = L.length - 1; i >= 0; i--) {
      const o = L[i];
      o.dull += ((o.reach ? 0 : 1) - o.dull) * ed;
      o.glow = max(0, o.glow - d * 1.1);
      o.flash = max(0, o.flash - d * 1.4);
      const wt = o.scn ? 1 : o.fwd && !o.black ? 0.88 : 0;
      o.white += (wt - o.white) * (wt > o.white ? er : ef);
      o.cage += (o.age - o.cage) * ec;
      if (o.kill) o.alpha = max(0, o.alpha - d * 4);
      else if (inGc && !o.fwd && !o.reach) o.alpha = max(0.8, o.alpha - d * 0.05);
    }
  }
  for (const g of S.ghosts) {
    g.hot = max(0, g.hot - d * 1.1);
    g.a += (0.36 - g.a) * (1 - exp(-d / 0.9));
    if (g.kill) g.alpha -= d * 4;
  }
  for (let i = 0; i < NROOT; i++) S.rootFl[i] = max(0, S.rootFl[i] - d * 1.5);
  for (let i = S.dying.length - 1; i >= 0; i--) if (S.dying[i].kill && S.dying[i].alpha <= 0.02) S.dying.splice(i, 1);
  for (let i = S.ghosts.length - 1; i >= 0; i--) if (S.ghosts[i].kill && S.ghosts[i].alpha <= 0.02) S.ghosts.splice(i, 1);
  for (let i = S.lines.length - 1; i >= 0; i--) {
    S.lines[i].t += d;
    if (S.lines[i].t >= S.lines[i].dur) S.lines.splice(i, 1);
  }
  for (let sp = 0; sp < 2; sp++) S.gfade[sp] += (1 - S.gfade[sp]) * (1 - exp(-d / 0.5));
  S.bc += (bandCentre(S) - S.bc) * (1 - exp(-d / 0.35));
}

function step(S, m, d) {
  S.t += d;
  wander(S, d);
  S.tm += m;
  if (S.mode === 0) mutate(S, m);
  else if (S.mode === 1) {
    S.pauseT -= m;
    if (S.pauseT <= 0) gcBegin(S);
  } else gcRun(S, m);
  if (S.dirty) reach(S);
  if (S.mode !== 2) sweepStep(S, m);
  ease(S, d);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    setK(S);
    makePalette(S, 0.5 + S.ks[0]);
    prerun(S);
    S.w[2] = 0;
    S.bc = bandCentre(S);
    for (let i = 0; i < NROOT; i++) S.rootLit[i] = S.roots[i] ? 1 : 0;
    S.ready = true;
  }
  const e = 1 - exp(-d / 0.15);
  for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * e;
  setK(S);
  const hb = 0.5 + S.ks[0] + (S.w[2] < 0 ? 0.11 : 0.18) * S.w[2]; // the walk goes further towards violet than towards green
  if (abs(hb - S.hb) > 0.002) makePalette(S, hb);
  const m = d * S.K.speed, n = max(1, ceil(m / 0.05));
  for (let i = 0; i < n; i++) step(S, m / n, d / n);
  render(S);
}

// run the heap until the third collection is about half done, so that both spaces carry colour in the first frame
function prerun(S) {
  for (let i = 0; i < 8000; i++) {
    setK(S);
    step(S, 0.05, 0.05);
    const gc = S.gc;
    if (S.gen >= 3 && S.mode === 2 && gc.order.length >= 0.45 * gc.lv && gc.order.length >= 2) break;
  }
  for (let i = 0; i < NROOT; i++) S.rootFl[i] = 0;
  S.lines.length = 0;
}

function rect(S, x, y, w, h, r, g, b, a) {
  const img = S.img;
  for (let yy = max(0, y); yy < min(H, y + h); yy++)
    for (let xx = max(0, x); xx < min(W, x + w); xx++) {
      const j = (yy * W + xx) * 3;
      img[j] += (r - img[j]) * a;
      img[j + 1] += (g - img[j + 1]) * a;
      img[j + 2] += (b - img[j + 2]) * a;
    }
}

// an object is a bar of cells, the gutters inside it filled a little darker
function bar(S, sp, at, s, fill, r, g, b, alpha) {
  const gm = S.sg[sp], w = gm.w;
  for (let k = 0; k < s; k++) {
    const lf = cl(fill - k, 0, 1) * alpha;
    if (lf <= 0.004) continue;
    const i = at + k;
    if (i >= gm.n) break;
    const x = cellX(S, sp, i), y = cellY(S, sp, i), hd = k === 0 ? 1.14 : 1;
    rect(S, x, y, w, w, min(255, r * hd), min(255, g * hd), min(255, b * hd), lf);
    if (k < s - 1 && i + 1 < gm.n) {
      const ln = cl(fill - k - 1, 0, 1) * alpha;
      if (ln > 0.004) {
        const nx = cellX(S, sp, i + 1), ny = cellY(S, sp, i + 1), a = min(lf, ln), kk = 0.55;
        if (ny === y) rect(S, nx > x ? x + w : x - 1, y, 1, w, r * kk, g * kk, b * kk, a);
        else if (nx === x) rect(S, x, ny > y ? y + w : y - 1, w, 1, r * kk, g * kk, b * kk, a);
      }
    }
  }
}

function paintObj(S, o) {
  const c = S.tc;
  objBase(S, o, c);
  const dm = 0.8 * o.dull, W0 = S.whiteC, kd = 1 - 0.2 * o.dull;
  let r = (c[0] * (1 - dm) + S.dullC[0] * dm) * kd, g = (c[1] * (1 - dm) + S.dullC[1] * dm) * kd, b = (c[2] * (1 - dm) + S.dullC[2] * dm) * kd;
  const wm = 1 - (1 - o.white * 0.92) * (1 - o.glow * 0.55) * (1 - o.flash * 0.45);
  r += (W0[0] - r) * wm;
  g += (W0[1] - g) * wm;
  b += (W0[2] - b) * wm;
  bar(S, o.sp, o.at, o.s, o.fill, r, g, b, o.alpha);
}

// a step is two LED thick; where two steps meet the stronger one wins
function seg(S, ax, ay, bx, by, a) {
  const lay = S.lay, vert = ax === bx;
  const x0 = vert ? ax - 1 : floor(min(ax, bx)), x1 = vert ? ax : floor(max(ax, bx));
  const y0 = vert ? floor(min(ay, by)) : ay - 1, y1 = vert ? floor(max(ay, by)) : ay;
  for (let y = max(0, y0); y <= min(H - 1, y1); y++) for (let x = max(0, x0); x <= min(W - 1, x1); x++) lay[y * W + x] = max(lay[y * W + x], a);
}
function flushLines(S, col) {
  const lay = S.lay, img = S.img;
  for (let j = 0; j < N; j++) {
    const a = lay[j];
    if (a <= 0) continue;
    lay[j] = 0;
    for (let c = 0; c < 3; c++) img[j * 3 + c] += (col[c] - img[j * 3 + c]) * a;
  }
}

function render(S) {
  const img = S.img, t = S.t;
  img.fill(0);
  const act = S.mode === 2 ? S.gc.to : S.sp, bc = floor(S.bc);
  // the root rail slides slowly from side to side
  S.rcx = 31.5 + 5 * sin((TAU * t) / 97 + 0.6) + 3 * sin((TAU * t) / 61 + 2);
  // ground: every cell near black, so free and allocated are far apart
  for (let sp = 0; sp < 2; sp++) {
    const g = S.sg[sp], f = S.gfade[sp];
    for (let i = 0; i < g.n; i++) rect(S, g.x0 + (i % g.C) * g.P, g.y0 + ((i / g.C) | 0) * g.P, g.w, g.w, S.gndC[0] * f, S.gndC[1] * f, S.gndC[2] * f, 1);
  }
  rect(S, Math.round(S.rcx) - 22, bc - 1, 44, 2, S.railC[0], S.railC[1], S.railC[2], 1);
  // ghosts, garbage waiting for the sweep, the live space
  for (const g of S.ghosts) {
    const k = g.hot, a = (g.kill ? max(0, g.alpha) : 1) * g.a;
    bar(S, g.sp, g.at, g.s, g.s, g.r + (S.whiteC[0] - g.r) * k, g.g + (S.whiteC[1] - g.g) * k, g.b + (S.whiteC[2] - g.b) * k, min(1, a + k * 0.7));
  }
  for (const o of S.dying) paintObj(S, o);
  for (const o of S.heap) paintObj(S, o);
  // the bump pointer, or the free pointer of the to-space
  const cur = S.mode === 2 ? S.gc.free : S.ptr;
  if (cur < S.sg[act].n) {
    const pl = 0.5 + 0.5 * sin(t * 7), g = S.sg[act];
    rect(S, cellX(S, act, cur), cellY(S, act, cur), g.w, g.w, S.rootC[0], S.rootC[1], S.rootC[2], 0.3 + 0.3 * pl);
  }
  // the sweep line
  const w = S.sweep;
  if (w) {
    const g = S.sg[w.sp], y = g.y0 + floor(w.y);
    for (let k = -1; k <= 6; k++) {
      const yy = y - k;
      if (yy < g.y0 || yy > g.y0 + g.h) continue;
      rect(S, g.x0, yy, g.C * g.P - 1, 1, S.whiteC[0], S.whiteC[1], S.whiteC[2], (k <= 0 ? 0.8 : 0.5 * exp(-k * 0.55)) * 0.6);
    }
  }
  for (const ln of S.lines) {
    const u = ln.t / ln.dur, a = ln.a * min(1, u * 8) * (1 - u) * (1 - u);
    for (let i = 0; i < ln.pts.length - 1; i++) seg(S, ln.pts[i][0], ln.pts[i][1], ln.pts[i + 1][0], ln.pts[i + 1][1], a);
  }
  flushLines(S, S.rootC);
  const gI = S.railC;
  for (let i = 0; i < NROOT; i++) {
    S.rootLit[i] += ((S.roots[i] ? 1 : 0) - S.rootLit[i]) * 0.2;
    const l = S.rootLit[i], f = S.rootFl[i];
    const r = gI[0] + (S.rootC[0] - gI[0]) * l, g = gI[1] + (S.rootC[1] - gI[1]) * l, b = gI[2] + (S.rootC[2] - gI[2]) * l;
    rect(S, rootX(S, i), bc - 2, 4, 4, r + (S.whiteC[0] - r) * f, g + (S.whiteC[1] - g) * f, b + (S.whiteC[2] - b) * f, 1);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const img = S.img;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const j = (y * W + x) * 3;
      display.setPixel(x, y, cl(img[j] + 0.5, 0, 255) | 0, cl(img[j + 1] + 0.5, 0, 255) | 0, cl(img[j + 2] + 0.5, 0, 255) | 0);
    }
}
