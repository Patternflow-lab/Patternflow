// ===== Patternflow pattern =====
// Title:   Dendrogram Cut
// Family:  dendrogram
// Idea:    Sixteen soft points drift above in loose blobs that wander, merge and split, while below them the merge tree of those same points is rebuilt every frame, its branches gliding as the order changes, and a bright cut line slides up and down the tree and paints every branch under it, and every point above, in the colour of the cluster it cuts out.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: agglomerative hierarchical clustering with Ward's minimum-variance method (Joe H. Ward Jr., 1963) and the Lance-Williams recurrence (Lance and Williams, 1967), the dendrogram cut at a height, all from memory; the drifting-blob generator, the glide of the leaf order, the preference for last frame's merges, the cross-fade of nodes that change parent and the carry-over of cluster colours are original, pattern round 250
// Round:   250
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Spread=0..4, Cut=-1..1, Linkage=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel; ten cluster colours sit a tenth of a turn apart, the biggest cluster takes the first, and it opens on azure, then orange and violet.
// Knob 2: Spread. 0 to 4, opening at 2. How far apart the five blobs sit against how loose each one is: at 0 the sixteen points are one wide soft cloud with no groups to find, at 4 they are five tight blobs far apart and the tree shows five clear branches with long stems above them.
// Knob 3: Cut. -1 to 1, opening at 0. The height of the cut line in the tree: at -1 it sits near the leaves and cuts sixteen single points, at 0 about half way up it cuts four to eight clusters, at 1 it sits at the root and leaves one or two; it also wanders by up to a fifth of the tree's height by itself.
// Knob 4: Linkage. -1 to 1, opening at about 0.06. How clusters are joined, through the Lance-Williams parameters: -1 is single linkage (long lopsided chains), 0 is Ward, 1 is complete linkage (even, balanced branches).

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, exp, sin, cos, pow, log, PI, tanh } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rnd = () => Math.random();
const gauss = () => sqrt(-2 * log(1 - rnd())) * cos(TP * rnd());

const N = 16;               // points, and leaves of the tree
const NB = 5;               // blobs the points are drawn to
const NN = 2 * N - 1;       // nodes of the tree
const NC = 10;              // cluster colours
const TOPH = 64;            // rows of the scatter pane
const YB = 127.4;           // row of the leaf baseline
const YS = 62;              // rows between the baseline and the top of the tree
const FMIN = 0.09;          // lowest merge height shown, as a fraction of the tree
const SLOT = 4;             // LED per leaf
const X0 = 2;               // x of the first leaf stem
const STICK = 0.62;         // a merge the last frame made counts this much cheaper, in squared distance
const FADE = 0.3;           // s a node takes to fade in or out when the tree changes parent

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- state -----------------------------------------------------------------
export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, t: 0, frame: 0,
    // the blobs: each centre wanders on its own two slow sines per axis
    bw: [], bp: [],
    // the points
    px: new Float64Array(N), py: new Float64Array(N),
    zx: new Float64Array(N), zy: new Float64Array(N), vx: new Float64Array(N), vy: new Float64Array(N),
    b0: new Int8Array(N), b1: new Int8Array(N), bm: new Float64Array(N),
    hop: 6,
    // linkage working space
    d: new Float64Array(N * N), slot: new Int16Array(N), act: new Uint8Array(N), nsz: new Float64Array(N),
    L: new Int16Array(NN), R: new Int16Array(NN), hh: new Float64Array(NN), mask: new Int32Array(NN),
    sz: new Float64Array(NN), mx: new Float64Array(NN), fl: new Int16Array(NN),
    scale: 0,
    // tree display
    nodes: new Map(), rec: new Array(NN).fill(null), sx: new Float64Array(N), tgt: new Int16Array(N), slotCount: 0,
    xd: new Float64Array(NN), fd: new Float64Array(NN),
    cut: 0.5, list: [],
    // colours
    pid: new Int16Array(N).fill(-1), col: new Float64Array(N * 3), hue: new Float64Array(N), colInit: false,
    grey: [0.5, 0.58, 0.74],
    // drawing buffers
    T: new Float32Array(W * TOPH * 3), P: new Float32Array(W * 64 * 3), A: new Float32Array(W * 64), G: new Float32Array(W * 64 * 3),
    G2: new Float32Array(W * 64 * 3), TC: new Float32Array(W * TOPH * 4),
  });
  for (let b = 0; b < NB; b++) {
    const w = [], p = [];
    for (let q = 0; q < 4; q++) { w.push(0.035 + 0.075 * rnd()); p.push(rnd() * TP); }
    st.bw.push(w); st.bp.push(p);
  }
  // sixteen points over five blobs, uneven
  const cnt = [4, 4, 3, 3, 2];
  let i = 0;
  for (let b = 0; b < NB; b++) for (let c = 0; c < cnt[b]; c++, i++) { st.b0[i] = st.b1[i] = b; st.bm[i] = 1; }
  for (i = 0; i < N; i++) { st.zx[i] = gauss(); st.zy[i] = gauss(); st.vx[i] = 0.3 * gauss(); st.vy[i] = 0.3 * gauss(); }
  return st;
}

// ---- the points ------------------------------------------------------------
function blobCentre(st, b, u, out) {
  const w = st.bw[b], p = st.bp[b], t = st.t;
  const R = 0.15 + 0.85 * u;
  out[0] = 32 + 68 * R * (0.62 * sin(w[0] * t + p[0]) + 0.38 * sin(w[1] * t * 1.37 + p[1]));
  out[1] = 31 + 64 * R * (0.62 * sin(w[2] * t + p[2]) + 0.38 * sin(w[3] * t * 1.21 + p[3]));
}

function movePoints(st, dt) {
  const u = cl(st.ks[1] / 4, 0, 1);
  const sig = 4.2 + 10 * pow(1 - u, 2.2);
  const cen = [0, 0];
  const C = [];
  for (let b = 0; b < NB; b++) { blobCentre(st, b, u, cen); C.push([cen[0], cen[1]]); }
  // a point now and then changes blob; it travels there over four seconds
  st.hop -= dt;
  if (st.hop <= 0) {
    st.hop = 5 + 9 * rnd();
    const count = [0, 0, 0, 0, 0];
    for (let i = 0; i < N; i++) count[st.b1[i]]++;
    for (let tr = 0; tr < 12; tr++) {
      const i = floor(rnd() * N);
      if (st.bm[i] < 1 || count[st.b1[i]] <= 2) continue;
      let nb = floor(rnd() * NB);
      if (nb === st.b1[i]) nb = (nb + 1) % NB;
      st.b0[i] = st.b1[i]; st.b1[i] = nb; st.bm[i] = 0;
      break;
    }
  }
  // each offset from its blob centre is a damped spring kicked by noise; a looser flock runs on a slower clock
  const om = 0.16 * cl(6.5 / sig, 0.5, 1.2), ga = 3 * om, q = sqrt(2 * ga * om * om);
  const n = max(1, Math.ceil(dt / 0.05));
  const h = dt / n;
  for (let s = 0; s < n; s++) {
    const kick = q * sqrt(h);
    for (let i = 0; i < N; i++) {
      st.vx[i] += (-om * om * st.zx[i] - ga * st.vx[i]) * h + kick * gauss();
      st.vy[i] += (-om * om * st.zy[i] - ga * st.vy[i]) * h + kick * gauss();
      st.zx[i] += st.vx[i] * h; st.zy[i] += st.vy[i] * h;
    }
  }
  for (let i = 0; i < N; i++) {
    if (st.bm[i] < 1) st.bm[i] = min(1, st.bm[i] + dt / 4);
    const m = sstep(0, 1, st.bm[i]);
    const a = C[st.b0[i]], b = C[st.b1[i]];
    const cx = a[0] + (b[0] - a[0]) * m, cy = a[1] + (b[1] - a[1]) * m;
    const dx = sig * st.zx[i], dy = sig * st.zy[i];
    // a soft wall
    st.px[i] = 32 + 29 * tanh(1.4 * (cx + dx - 32) / 29);
    st.py[i] = 31 + 27.5 * tanh(1.35 * (cy + dy - 31) / 27.5);
  }
  // the flock is nudged back toward the middle so the scatter never empties one side
  let mx = 0, my = 0;
  for (let i = 0; i < N; i++) { mx += st.px[i]; my += st.py[i]; }
  mx = 0.55 * (mx / N - 32); my = 0.55 * (my / N - 31);
  for (let i = 0; i < N; i++) { st.px[i] = cl(st.px[i] - mx, 4, 60); st.py[i] = cl(st.py[i] - my, 4, 59); }
}

// ---- Ward and its neighbours, by Lance-Williams ---------------------------------
function link(st, dt) {
  const { d, slot, act, nsz, L, R, hh, mask, sz, mx, fl, nodes } = st;
  const k = cl(st.ks[3], -1, 1);
  const ws = k < 0 ? -k : 0, wc = k > 0 ? k : 0, ww = 1 - ws - wc;
  for (let i = 0; i < N; i++) {
    slot[i] = i; act[i] = 1; nsz[i] = 1;
    mask[i] = 1 << i; sz[i] = 1; mx[i] = st.px[i]; fl[i] = i; hh[i] = 0;
    for (let j = 0; j < N; j++) {
      const dx = st.px[i] - st.px[j], dy = st.py[i] - st.py[j];
      d[i * N + j] = dx * dx + dy * dy;
    }
  }
  for (let m = 0; m < N - 1; m++) {
    // a merge the last frame also made is preferred unless another is clearly cheaper
    let bi = -1, bj = -1, bd = Infinity, bs = Infinity;
    for (let i = 0; i < N; i++) {
      if (!act[i]) continue;
      for (let j = i + 1; j < N; j++) {
        if (!act[j]) continue;
        const dv = d[i * N + j];
        const known = nodes.get(mask[slot[i]] | mask[slot[j]]);
        const sv = known && known.alive ? dv * STICK : dv;
        if (sv < bs) { bs = sv; bd = dv; bi = i; bj = j; }
      }
    }
    const id = N + m, a = slot[bi], b = slot[bj];
    L[id] = a; R[id] = b;
    const h = sqrt(max(bd, 0));
    hh[id] = max(h, a >= N ? hh[a] : 0, b >= N ? hh[b] : 0);
    mask[id] = mask[a] | mask[b];
    sz[id] = sz[a] + sz[b];
    mx[id] = (mx[a] * sz[a] + mx[b] * sz[b]) / sz[id];
    fl[id] = fl[a];
    const ni = nsz[bi], nj = nsz[bj], dij = bd;
    for (let c = 0; c < N; c++) {
      if (!act[c] || c === bi || c === bj) continue;
      const nk = nsz[c], tot = ni + nj + nk;
      const dki = d[c * N + bi], dkj = d[c * N + bj];
      const ai = ww * (ni + nk) / tot + 0.5 * (ws + wc);
      const aj = ww * (nj + nk) / tot + 0.5 * (ws + wc);
      const be = -ww * nk / tot;
      const ga = 0.5 * (wc - ws);
      const nd = max(0, ai * dki + aj * dkj + be * dij + ga * abs(dki - dkj));
      d[c * N + bi] = d[bi * N + c] = nd;
    }
    act[bj] = 0; nsz[bi] = ni + nj; slot[bi] = id;
  }
  // the scale follows the root, so the tree fills its pane whatever the linkage
  const root = hh[NN - 1];
  if (st.scale <= 0) st.scale = root;
  else st.scale += (root - st.scale) * (1 - exp(-dt / 1.5));
}

// the height a merge is drawn at, as a fraction of the pane
function shape(st, h, m) {
  // about half the height is the merge distance (compressed) and half is its rank, so small merges are not crushed on the baseline
  const v = 0.45 * pow(max(h, 0) / (max(st.scale, 1e-3) * 1.04), 0.55) + 0.55 * (m + 1) / (N - 1);
  let f = FMIN + (1 - FMIN) * v;
  if (f > 0.9) f = 0.9 + 0.1 * tanh((f - 0.9) / 0.1);
  return f;
}

// ---- the tree as it is drawn ----------------------------------------------------
function structure(st, dt) {
  const { L, R, mask, mx, nodes, rec, sx, tgt, xd, fd } = st;
  const t = st.t;
  st.frame++;
  // orientation: the sub-cluster with the smaller mean x goes left, and keeps its side until the other is clearly ahead
  for (let m = 0; m < N - 1; m++) {
    const id = N + m, key = mask[id], a = L[id], b = R[id];
    let r = nodes.get(key);
    if (!r) {
      r = { hd: shape(st, st.hh[id], m), lm: 0, born: st.init ? t : -1e9, seen: 0, last: t, alive: true, left: a, right: b, cn: [0, 0, 0], g: new Float64Array(12) };
      nodes.set(key, r);
      r.lm = mask[mx[a] <= mx[b] ? a : b];
    } else if (!r.alive) {
      // a node that was fading out comes back: it fades in from where it was
      r.born = t - FADE * max(0, 1 - (t - r.last) / FADE);
    }
    let left = r.lm === mask[a] ? a : r.lm === mask[b] ? b : (mx[a] <= mx[b] ? a : b);
    const other = left === a ? b : a;
    if (mx[left] - mx[other] > 4) left = other;
    r.lm = mask[left];
    r.left = left; r.right = left === a ? b : a;
    r.seen = st.frame; r.last = t; r.alive = true;
    rec[id] = r;
  }
  // leaf order, left to right
  st.slotCount = 0;
  const walk = (id) => {
    if (id < N) { tgt[id] = st.slotCount++; return; }
    const r = rec[id];
    walk(r.left); walk(r.right);
  };
  walk(NN - 1);
  const ra = st.init ? 1 - exp(-dt * 6) : 1;
  for (let i = 0; i < N; i++) sx[i] += (X0 + SLOT * tgt[i] - sx[i]) * ra;
  // heights, bottom up
  const rh = st.init ? 1 - exp(-dt * 4.5) : 1;
  for (let i = 0; i < N; i++) { xd[i] = sx[i]; fd[i] = 0; }
  for (let m = 0; m < N - 1; m++) {
    const id = N + m, r = rec[id], a = L[id], b = R[id];
    const ft = shape(st, st.hh[id], m);
    r.hd += (ft - r.hd) * rh;
    const lo = max(fd[a], fd[b]) + (a < N && b < N ? 0.025 : 0.014);
    if (r.hd < lo) r.hd = lo;
    fd[id] = r.hd;
    xd[id] = 0.5 * (xd[r.left] + xd[r.right]);
  }
}

// ---- clusters at the cut -------------------------------------------------------
function clusters(st, dt) {
  const { L, R, fd, pid } = st;
  const t = st.t;
  const wob = 0.11 * sin(0.058 * t + st.bp[0][0]) + 0.07 * sin(0.0353 * t + st.bp[1][1]) + 0.05 * sin(0.0877 * t + st.bp[2][2]);
  const kc = cl(st.ks[2], -1, 1);
  const c = cl(0.52 + 0.42 * kc + wob, 0.05, 0.97);
  st.cut = c;
  const list = [];
  const take = (id, members) => {
    if (id < N) { members.push(id); return; }
    take(L[id], members); take(R[id], members);
  };
  const split = (id) => {
    if (id < N || fd[id] <= c) { const mem = []; take(id, mem); list.push(mem); return; }
    split(L[id]); split(R[id]);
  };
  split(NN - 1);
  list.sort((a, b) => b.length - a.length);
  st.list = list;
  const used = new Int16Array(NC);
  const next = new Int16Array(N);
  const votes = new Int16Array(NC);
  for (const mem of list) {
    votes.fill(0);
    for (const i of mem) if (pid[i] >= 0) votes[pid[i]]++;
    let best = -1, bv = 0;
    for (let q = 0; q < NC; q++) if (votes[q] > bv && !used[q]) { bv = votes[q]; best = q; }
    if (best < 0) {
      // a free colour as far round the wheel from those in use as it can be; if none is free, the least used
      let lu = 1e9;
      for (let q = 0; q < NC; q++) if (used[q] < lu) lu = used[q];
      let bd = -1;
      for (let q = 0; q < NC; q++) {
        if (used[q] !== lu) continue;
        let md = NC;
        for (let r = 0; r < NC; r++) if (used[r] > 0 && r !== q) { const e = abs(q - r); md = min(md, min(e, NC - e)); }
        if (lu > 0) md = 0.01 * (NC - used[q]);
        if (md > bd) { bd = md; best = q; }
      }
    }
    used[best]++;
    for (const i of mem) next[i] = best;
  }
  for (let i = 0; i < N; i++) pid[i] = next[i];
  // each point's hue eases to its cluster's by the short way round the wheel, so a recolour never passes through grey
  const base = st.ks[0] + 0.55;
  const ra = st.colInit ? 1 - exp(-dt * 5) : 1;
  st.colInit = true;
  const o = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const target = base + pid[i] / NC;
    let dh = target - st.hue[i];
    dh -= Math.round(dh);
    st.hue[i] += dh * ra;
    hsv(st.hue[i], 0.66, 1, o);
    st.col[i * 3] = o[0]; st.col[i * 3 + 1] = o[1]; st.col[i * 3 + 2] = o[2];
  }
}

// geometry the draw reads: positions in LED units and the three colours of every node
function geometry(st) {
  const { fl, rec, xd, fd, col } = st;
  for (let m = 0; m < N - 1; m++) {
    const id = N + m, r = rec[id], g = r.g;
    const a = r.left, b = r.right;
    g[0] = xd[a]; g[1] = xd[b]; g[2] = a < N ? YB + 3 : YB - YS * fd[a]; g[3] = b < N ? YB + 3 : YB - YS * fd[b]; g[4] = YB - YS * fd[id];
    const fa = fl[a], fb = fl[b], fn = fl[id];
    for (let ch = 0; ch < 3; ch++) { g[6 + ch] = col[fa * 3 + ch]; g[9 + ch] = col[fb * 3 + ch]; }
    r.cn = [col[fn * 3], col[fn * 3 + 1], col[fn * 3 + 2]];
  }
}

function step(st, dt) {
  st.t += dt;
  const ks = st.ks, k = st.k;
  const a = st.init ? 1 - exp(-dt / 0.18) : 1;
  for (let i = 0; i < 4; i++) ks[i] += (k[i] - ks[i]) * a;
  movePoints(st, dt);
  link(st, dt);
  structure(st, dt);
  clusters(st, dt);
  geometry(st);
  // nodes the tree no longer has fade out where they were
  const gone = [];
  for (const [key, r] of st.nodes) {
    if (r.seen !== st.frame) { r.alive = false; if (st.t - r.last > FADE) gone.push(key); }
  }
  for (const key of gone) st.nodes.delete(key);
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  if (!st.init) {
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    // twenty seconds first, so the panel opens full
    for (let i = 0; i < 80; i++) step(st, 0.25);
    st.init = true;
    st.t += 0.5;
    return;
  }
  if (dt > 0) step(st, dt);
}

// ---- drawing ---------------------------------------------------------------
const tmp = [0, 0, 0];

// one stroke of the tree: a capsule 2 LED wide, vertical from ya to yb or horizontal from xa to xb
function stroke(st, vert, c0, a0, b0, ya, yb, col, alpha, ycut) {
  if (alpha <= 0.004) return;
  const P = st.P, A = st.A, grey = st.grey;
  let x0, x1, y0, y1;
  if (vert) { x0 = c0 - 2.5; x1 = c0 + 2.5; y0 = min(ya, yb) - 2.5; y1 = max(ya, yb) + 2.5; }
  else { x0 = min(a0, b0) - 2.5; x1 = max(a0, b0) + 2.5; y0 = ya - 2.5; y1 = ya + 2.5; }
  const ix0 = max(0, floor(x0)), ix1 = min(W - 1, floor(x1));
  const iy0 = max(TOPH, floor(y0)), iy1 = min(H - 1, floor(y1));
  const lo = vert ? min(ya, yb) : 0, hi = vert ? max(ya, yb) : 0;
  const xlo = vert ? 0 : min(a0, b0), xhi = vert ? 0 : max(a0, b0);
  for (let y = iy0; y <= iy1; y++) {
    const py = y + 0.5;
    const m = sstep(ycut - 0.9, ycut + 0.9, py);
    const cr = grey[0] + (col[0] - grey[0]) * m, cg = grey[1] + (col[1] - grey[1]) * m, cb = grey[2] + (col[2] - grey[2]) * m;
    const sh = 0.52 + 0.48 * m;
    for (let x = ix0; x <= ix1; x++) {
      const px = x + 0.5;
      let dx, dy;
      if (vert) { dx = px - c0; dy = py < lo ? lo - py : py > hi ? py - hi : 0; }
      else { dy = py - ya; dx = px < xlo ? xlo - px : px > xhi ? px - xhi : 0; }
      const dd = sqrt(dx * dx + dy * dy);
      const cov = cl(1.5 - dd, 0, 1) * alpha;
      if (cov <= 0.004) continue;
      const o = (y - (TOPH)) * W + x;
      P[o * 3] = P[o * 3] * (1 - cov) + cr * sh * cov;
      P[o * 3 + 1] = P[o * 3 + 1] * (1 - cov) + cg * sh * cov;
      P[o * 3 + 2] = P[o * 3 + 2] * (1 - cov) + cb * sh * cov;
      A[o] = A[o] * (1 - cov) + cov;
    }
  }
}

function blurPane(src, dst, tmpb, w, h) {
  // 5-tap binomial, separable
  const k0 = 6 / 16, k1 = 4 / 16, k2 = 1 / 16;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xm2 = max(x - 2, 0), xm1 = max(x - 1, 0), xp1 = min(x + 1, w - 1), xp2 = min(x + 2, w - 1);
      for (let c = 0; c < 3; c++) {
        const o = y * w;
        tmpb[(o + x) * 3 + c] = k0 * src[(o + x) * 3 + c] + k1 * (src[(o + xm1) * 3 + c] + src[(o + xp1) * 3 + c]) + k2 * (src[(o + xm2) * 3 + c] + src[(o + xp2) * 3 + c]);
      }
    }
  }
  for (let y = 0; y < h; y++) {
    const ym2 = max(y - 2, 0), ym1 = max(y - 1, 0), yp1 = min(y + 1, h - 1), yp2 = min(y + 2, h - 1);
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        dst[(y * w + x) * 3 + c] = k0 * tmpb[(y * w + x) * 3 + c] + k1 * (tmpb[(ym1 * w + x) * 3 + c] + tmpb[(yp1 * w + x) * 3 + c]) + k2 * (tmpb[(ym2 * w + x) * 3 + c] + tmpb[(yp2 * w + x) * 3 + c]);
      }
    }
  }
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const t = st.t;
  const T = st.T, P = st.P, A = st.A, G = st.G, G2 = st.G2;
  const ycut = YB - YS * st.cut;
  const TC = st.TC;
  T.fill(0); P.fill(0); A.fill(0); TC.fill(0);

  // ---- the scatter: each cluster of two or more is a small star, a thin line from every member to the middle of the group, and every point has a haze, a glow and a solid core
  for (const mem of st.list) {
    if (mem.length < 2) continue;
    let gx = 0, gy = 0;
    for (const i of mem) { gx += st.px[i]; gy += st.py[i]; }
    gx /= mem.length; gy /= mem.length;
    for (const i of mem) {
      const x1 = st.px[i], y1 = st.py[i];
      const cr = st.col[i * 3], cg = st.col[i * 3 + 1], cb = st.col[i * 3 + 2];
      const ex = gx - x1, ey = gy - y1, el = ex * ex + ey * ey;
      const bx0 = max(0, floor(min(x1, gx) - 3)), bx1 = min(W - 1, floor(max(x1, gx) + 3));
      const by0 = max(0, floor(min(y1, gy) - 3)), by1 = min(TOPH - 1, floor(max(y1, gy) + 3));
      for (let yy = by0; yy <= by1; yy++) {
        for (let xx = bx0; xx <= bx1; xx++) {
          const dx = xx + 0.5 - x1, dy = yy + 0.5 - y1;
          const q = el > 0 ? cl((dx * ex + dy * ey) / el, 0, 1) : 0;
          const fx = dx - q * ex, fy = dy - q * ey;
          const v = 0.34 * exp(-(fx * fx + fy * fy) / 1.1);
          const o = (yy * W + xx) * 3;
          T[o] += cr * v; T[o + 1] += cg * v; T[o + 2] += cb * v;
        }
      }
    }
  }
  for (let i = 0; i < N; i++) {
    const x = st.px[i], y = st.py[i];
    const cr = st.col[i * 3], cg = st.col[i * 3 + 1], cb = st.col[i * 3 + 2];
    const R = 14;
    const x0 = max(0, floor(x - R)), x1 = min(W - 1, floor(x + R));
    const y0 = max(0, floor(y - R)), y1 = min(TOPH - 1, floor(y + R));
    for (let yy = y0; yy <= y1; yy++) {
      const dy = yy + 0.5 - y;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx + 0.5 - x, d2 = dx * dx + dy * dy;
        const v = 0.07 * exp(-d2 / 60) + 0.2 * exp(-d2 / 10);
        const o = (yy * W + xx) * 3;
        T[o] += cr * v; T[o + 1] += cg * v; T[o + 2] += cb * v;
      }
    }
    // the core: a solid disc about 5 LED across, a little lighter than the cluster colour
    const kr = cr + (1 - cr) * 0.3, kg = cg + (1 - cg) * 0.3, kb = cb + (1 - cb) * 0.3;
    const cx0 = max(0, floor(x - 5)), cx1 = min(W - 1, floor(x + 5)), cy0 = max(0, floor(y - 5)), cy1 = min(TOPH - 1, floor(y + 5));
    for (let yy = cy0; yy <= cy1; yy++) {
      const dy = yy + 0.5 - y;
      for (let xx = cx0; xx <= cx1; xx++) {
        const dx = xx + 0.5 - x;
        const cov = cl(3.2 - sqrt(dx * dx + dy * dy), 0, 1);
        if (cov <= 0) continue;
        const o = (yy * W + xx) * 4;
        const ia = 1 - cov;
        TC[o] = TC[o] * ia + kr * cov; TC[o + 1] = TC[o + 1] * ia + kg * cov; TC[o + 2] = TC[o + 2] * ia + kb * cov; TC[o + 3] = TC[o + 3] * ia + cov;
      }
    }
  }

  // ---- the tree
  const nodes = st.nodes;
  for (const r of nodes.values()) {
    const g = r.g;
    let alpha;
    // in and out together keep a stem that changes node near full strength
    if (r.alive) alpha = pow(sstep(0, FADE, t - r.born), 0.6);
    else alpha = pow(1 - sstep(0, FADE, t - r.last), 0.6);
    if (alpha <= 0.004) continue;
    const cA = [g[6], g[7], g[8]], cB = [g[9], g[10], g[11]], cN = r.cn;
    // two stems, then the bar over them
    stroke(st, true, g[0], 0, 0, g[2], g[4], cA, alpha, ycut);
    stroke(st, true, g[1], 0, 0, g[3], g[4], cB, alpha, ycut);
    stroke(st, false, 0, g[0], g[1], g[4], 0, cN, alpha, ycut);
  }
  // a little glow round the strokes
  blurPane(P, G2, G, W, 64);
  blurPane(G2, G, G2, W, 64);

  // ---- compose
  hsv(0.62, 0.55, 0.075, tmp);
  const bgT = [tmp[0], tmp[1], tmp[2]];
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      let r, g, b;
      if (y < TOPH) {
        const o = (y * W + x) * 3;
        // vignette of the scatter pane
        const vx = (px - 32) / 40, vy = (py - 32) / 40;
        const vg = 1 - 0.55 * (vx * vx + vy * vy);
        r = bgT[0] * vg; g = bgT[1] * vg; b = bgT[2] * vg * 1.1;
        const tr = T[o], tg = T[o + 1], tb = T[o + 2];
        r += 1 - exp(-1.5 * tr); g += 1 - exp(-1.5 * tg); b += 1 - exp(-1.5 * tb);
        const o4 = (y * W + x) * 4, ca = TC[o4 + 3];
        if (ca > 0) { r = r * (1 - ca) + TC[o4]; g = g * (1 - ca) + TC[o4 + 1]; b = b * (1 - ca) + TC[o4 + 2]; }
      } else {
        const o = ((y - (TOPH)) * W + x);
        const below = sstep(ycut - 1.5, ycut + 2.5, py);
        // the lower pane: darker above the cut, a little blue under it
        r = 0.012 + 0.010 * below; g = 0.018 + 0.022 * below; b = 0.050 + 0.045 * below;
        const a = A[o];
        r = r * (1 - a) + P[o * 3] + 0.4 * G[o * 3];
        g = g * (1 - a) + P[o * 3 + 1] + 0.4 * G[o * 3 + 1];
        b = b * (1 - a) + P[o * 3 + 2] + 0.4 * G[o * 3 + 2];
        // the cut line, 2 LED thick, and its glow
        const dd = abs(py - ycut);
        const lc = cl(1.5 - dd, 0, 1) * 0.82;
        const lg = 0.14 * exp(-dd * dd / 5);
        r = r * (1 - lc) + 0.93 * lc + 0.8 * lg; g = g * (1 - lc) + 0.97 * lc + 0.9 * lg; b = b * (1 - lc) + lc + lg;
      }
      display.setPixel(x, y, cl(r * 255, 0, 255) | 0, cl(g * 255, 0, 255) | 0, cl(b * 255, 0, 255) | 0);
    }
  }
}
