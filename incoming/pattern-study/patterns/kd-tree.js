// ===== Patternflow pattern =====
// Title:   K-d Tree
// Family:  cells
// Idea:    A query point stops on a scatter of points that median splits have cut into one-point cells, and the nearest-point search runs one step at a time: down to the cell the query sits in, then back up, flashing each split line and entering the far side only if the shrinking best-distance circle touches it, otherwise sinking that whole branch dark, while a row of dots at the foot, one for each point, lights as the points are examined.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: k-d tree (Jon Louis Bentley, 1975) and its nearest-neighbour search (Jerome Friedman, Jon Bentley and Raphael Finkel, 1977), pattern round 107
// Round:   107
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.3..3, Points=32..80, Clump=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the slate cells run from teal at the top to violet at the foot, the split lines are cream, the path down to the query is pale cyan and the cells the search examines go from orange through yellow to green; at 0.5 the lines are pale blue and the examined cells run from blue to violet on a grey slate. The slate loses its colour between red and green, so it never turns brown.
// Knob 2: Speed. How fast the search runs. At 1 a step down the tree takes 0.14 s, an examined point 0.34 s and a checked line 0.28 s, so a search over 32 points lasts 4.7 s on average, and the query then rests 0.6 s and glides on for 1.3 s. A whole round takes 6.6 s at 1, 3.3 s at 2 and 2.2 s at 3.
// Knob 3: Points. How many points the plane holds, from 32 to 80. Each split takes the median, so 32 points need five splits in a row and 80 need seven, and the cells shrink from 16 LEDs across to 10. The search examines 2.8 of the 32 points on average and 3.2 of the 80; the most any random query examined was 14, over 4,000 of them at each of 35 settings of the Points and Clump knobs. Past 80 the cells run into their own lines: at 96 points, 9 to 16 of them are under 3 LEDs across.
// Knob 4: Clump. How far the points are pulled from an even scatter into five clumps. At 0 the points are even and the cells alike; at 1 the clumps pack as tight as the spacing allows and the gaps between them become single cells. With 32 points the largest cell grows from 548 to 1,105 of the panel's 8,192 LEDs and the circle a query in a gap ends with reaches a radius of 28 LEDs. The search barely notices, 2.8 points examined on average at 0 and 3.1 at 1, because a median split keeps the tree as deep over the clumps as over the gaps.

const W = 64, H = 128, NP = W * H;
const { floor, ceil, round, min, max, abs, sin, cos, sqrt, exp, log, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

const NM = 80, NC = 5;
const neutral = [0, 0, 0];
// Where points may sit: clear of the edges and of the counter at the foot.
const PX0 = 4, PX1 = 60, PY0 = 4, PY1 = 116;
const DMIN = 4.4, AX = 3.6, NB = 22;
// Line width and brightness by depth: the first split is the thickest and brightest.
const LW = [3, 2, 2, 1];
const LB = [1, 0.84, 0.7, 0.58, 0.48, 0.41, 0.37, 0.34];
// Seconds of search time (at Speed 1) each step takes.
const T_DESC = 0.14, T_LEAF = 0.34, T_CHECK = 0.28, T_PRUNE = 0.08, HOLD = 0.6, GLIDE = 1.3, DTAU = 0.5, TAU0 = 6.5;

// The slate is dark, and a dark orange or yellow reads as brown, so it loses most of its colour between red and green.
function slate(h, o) {
  h -= floor(h);
  hsv(h, 0.6 * (1 - 0.72 * cl(1 - abs(h - 0.14) / 0.14, 0, 1)), 0.2 + 0.04 * o, neutral, 0);
}

function hsv(h, s, v, o, k) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[k] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[k + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[k + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// The point stock. Point k has two places, one on an even scatter (best of five
// candidates, so no two are close) and one in its clump; Clump slides it from
// the first to the second. Seeded here, so a given knob state is one picture.
function sources() {
  let a = 0x6b64f3a1;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => cl(sqrt(-2 * log(1 - rnd())) * cos(2 * PI * rnd()), -2.2, 2.2);
  const far = (xs, ys, k, m, x0, x1, y0, y1) => {
    let bx = 0, by = 0, bd = -1;
    for (let c = 0; c < (k ? m : 1); c++) {
      const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
      let d = 1e9;
      for (let j = 0; j < k; j++) d = min(d, (x - xs[j]) ** 2 + (y - ys[j]) ** 2);
      if (d > bd) { bd = d; bx = x; by = y; }
    }
    xs.push(bx); ys.push(by);
  };
  const ux = [], uy = [], cx = [], cy = [], kx = [], ky = [];
  for (let k = 0; k < NM; k++) far(ux, uy, k, 5, PX0, PX1, PY0, PY1);
  for (let c = 0; c < NC; c++) far(cx, cy, c, 30, 15, 49, 17, 103);
  for (let k = 0; k < NM; k++) {
    kx.push(cl(cx[k % NC] + 8 * gauss(), PX0, PX1));
    ky.push(cl(cy[k % NC] + 8 * gauss(), PY0, PY1));
  }
  return { ux, uy, kx, ky };
}

function place(src, n, u) {
  const X = new Float32Array(n), Y = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    X[k] = src.ux[k] + (src.kx[k] - src.ux[k]) * u;
    Y[k] = src.uy[k] + (src.ky[k] - src.uy[k]) * u;
  }
  // Pull apart any two closer than DMIN, and any two that nearly share a row or a column, so no cell is
  // squeezed to a sliver a line would fill. A clump packs as far as that allows and no further.
  const dm = DMIN + 2.2 * u;
  const push = (P, i, j, d, m) => {
    const lo = P === X ? PX0 : PY0, hi = P === X ? PX1 : PY1;
    P[i] = cl(P[i] - d * m, lo, hi); P[j] = cl(P[j] + d * m, lo, hi);
  };
  for (let it = 0; it < 24; it++)
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dx = X[j] - X[i], dy = Y[j] - Y[i], d = hypot(dx, dy);
        if (d < dm) {
          if (d < 1e-4) { push(X, i, j, 1, 0.5); continue; }
          const m = (dm - d) / 2 / d;
          push(X, i, j, dx, m); push(Y, i, j, dy, m);
        } else if (abs(dx) < AX && abs(dy) < NB) push(X, i, j, dx < 0 ? -1 : 1, (AX - abs(dx)) / 2);
        else if (abs(dy) < AX && abs(dx) < NB) push(Y, i, j, dy < 0 ? -1 : 1, (AX - abs(dy)) / 2);
      }
  return { X, Y };
}

// The tree, breadth first so a parent always has a lower index than its children.
// Depth 0 splits on y (a horizontal line, the long way of the panel), depth 1 on x,
// and so on. Each node cuts its points at the median: the lower half goes left, and
// the line sits halfway between the two points either side. A node holding one
// point is a leaf, a cell. Every node also keeps the rectangle its subtree owns,
// cut off at the panel.
function build(X, Y, n) {
  const m = 2 * n - 1;
  const T = {
    n: m, ax: new Int8Array(m).fill(-1), sp: new Float32Array(m), c0: new Int16Array(m).fill(-1), c1: new Int16Array(m).fill(-1),
    par: new Int16Array(m).fill(-1), dp: new Uint8Array(m), pt: new Int16Array(m).fill(-1),
    x0: new Float32Array(m), x1: new Float32Array(m), y0: new Float32Array(m), y1: new Float32Array(m),
    lo: new Int16Array(m), hi: new Int16Array(m), maxd: 0, leaves: [],
  };
  const ord = Array.from({ length: n }, (_, i) => i);
  T.x1[0] = W; T.y1[0] = H; T.lo[0] = 0; T.hi[0] = n;
  let cnt = 1;
  for (let i = 0; i < cnt; i++) {
    const lo = T.lo[i], hi = T.hi[i];
    if (hi - lo === 1) { T.pt[i] = ord[lo]; T.leaves.push(i); continue; }
    const ax = T.dp[i] % 2 === 0 ? 1 : 0, P = ax ? Y : X;
    const part = ord.slice(lo, hi).sort((p, q) => P[p] - P[q]);
    for (let k = 0; k < part.length; k++) ord[lo + k] = part[k];
    const mid = lo + ((hi - lo) >> 1), s = (P[ord[mid - 1]] + P[ord[mid]]) / 2;
    T.ax[i] = ax; T.sp[i] = s;
    for (let side = 0; side < 2; side++) {
      const c = cnt++;
      T.par[c] = i; T.dp[c] = T.dp[i] + 1; T.maxd = max(T.maxd, T.dp[c]);
      T.x0[c] = T.x0[i]; T.x1[c] = T.x1[i]; T.y0[c] = T.y0[i]; T.y1[c] = T.y1[i];
      if (side === 0) { T.c0[i] = c; T.lo[c] = lo; T.hi[c] = mid; if (ax) T.y1[c] = s; else T.x1[c] = s; }
      else { T.c1[i] = c; T.lo[c] = mid; T.hi[c] = hi; if (ax) T.y0[c] = s; else T.x0[c] = s; }
    }
  }
  return T;
}

// Which cell each LED is in, and which split line each LED belongs to (the
// shallowest wins where two cross).
function raster(T) {
  const cell = new Int16Array(NP), line = new Int16Array(NP).fill(-1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let i = 0;
      while (T.ax[i] >= 0) i = (T.ax[i] ? y + 0.5 : x + 0.5) < T.sp[i] ? T.c0[i] : T.c1[i];
      cell[y * W + x] = i;
    }
  for (let i = T.n - 1; i >= 0; i--) {
    if (T.ax[i] < 0) continue;
    const w = LW[min(T.dp[i], LW.length - 1)], a = round(T.sp[i] - w / 2);
    const xa = T.ax[i] ? round(T.x0[i]) : a, xb = T.ax[i] ? round(T.x1[i]) : a + w;
    const ya = T.ax[i] ? a : round(T.y0[i]), yb = T.ax[i] ? a + w : round(T.y1[i]);
    for (let y = max(0, ya); y < min(H, yb); y++) for (let x = max(0, xa); x < min(W, xb); x++) line[y * W + x] = i;
  }
  return { cell, line };
}

// Distance from q to the split line of node i, as far as that line runs inside
// the node's own rectangle: the nearest the far child's cell can come to q.
function segDist(T, i, qx, qy) {
  if (T.ax[i]) return hypot(qx - cl(qx, T.x0[i], T.x1[i]), qy - T.sp[i]);
  return hypot(qx - T.sp[i], qy - cl(qy, T.y0[i], T.y1[i]));
}

// The whole search for one query, written down as the steps it takes: enter a
// node, look at a leaf's point, check a split line, sink a far branch, leave
// a node. The picture plays it back; nothing here knows about time but the
// length of each step.
const DESC = 0, LEAF = 1, CHECK = 2, PRUNE = 3, LEAVE = 4;
function plan(T, X, Y, qx, qy) {
  const ev = [];
  let best = 1e9, bestPt = -1, bestLeaf = -1, tc = 0, leaves = 0, nodes = 0, pruned = 0;
  const push = (k, i, dur, o) => { ev.push({ k, i, t: tc, ...o }); tc += dur; };
  const go = (i) => {
    nodes++;
    push(DESC, i, T_DESC);
    if (T.ax[i] < 0) {
      const p = T.pt[i], d = hypot(X[p] - qx, Y[p] - qy);
      leaves++;
      const imp = d < best;
      if (imp) { best = d; bestPt = p; bestLeaf = i; }
      push(LEAF, i, T_LEAF, { d, best, imp, leaf: bestLeaf });
    } else {
      const lowSide = (T.ax[i] ? qy : qx) < T.sp[i];
      const near = lowSide ? T.c0[i] : T.c1[i], far = lowSide ? T.c1[i] : T.c0[i];
      go(near);
      const d = segDist(T, i, qx, qy), cross = d < best;
      push(CHECK, i, T_CHECK, { d, best, cross });
      if (cross) go(far);
      else { pruned += (T.hi[far] - T.lo[far]); push(PRUNE, far, T_PRUNE); }
    }
    push(LEAVE, i, 0);
  };
  go(0);
  return { ev, end: tc, best, bestPt, bestLeaf, leaves, nodes, pruned };
}

// The query's road: slow, smooth, over the whole plane, crossing the gaps and the clumps.
function road(tau) {
  return [32 + 21 * sin(0.9 * tau + 0.7) + 7 * sin(2.1 * tau + 2), 60 + 44 * sin(0.47 * tau + 0.2) + 9 * sin(1.3 * tau + 1.1)];
}

function arrays(S, T) {
  const f = () => new Float32Array(T.n);
  Object.assign(S, {
    act: f(), tA: f(), pr: f(), tP: f(), hot: f(), tH: f(), vis: f(), tV: f(), vfl: f(), fl: f(), ord: f(), pe: f(), ae: f(),
    lc: new Float32Array(T.n * 3), lb: new Float32Array(T.n * 3), ln: new Float32Array(T.n * 3),
  });
}

function rebuild(S, n, u) {
  S.n = n; S.u = u;
  const { X, Y } = place(S.src, n, u);
  S.X = X; S.Y = Y;
  S.T = build(X, Y, n);
  Object.assign(S, raster(S.T));
  S.ptNode = new Int16Array(n);
  for (const i of S.T.leaves) S.ptNode[S.T.pt[i]] = i;
  // A lit cell is brightest at its point and a little dimmer toward its corners.
  const rm = new Float32Array(S.T.n), sh = (S.sh = new Float32Array(NP));
  for (const i of S.T.leaves) {
    const p = S.T.pt[i];
    for (let c = 0; c < 4; c++) rm[i] = max(rm[i], hypot((c & 1 ? S.T.x1[i] : S.T.x0[i]) - X[p], (c & 2 ? S.T.y1[i] : S.T.y0[i]) - Y[p]));
  }
  for (let q = 0; q < NP; q++) {
    const i = S.cell[q], p = S.T.pt[i];
    sh[q] = 1 - 0.45 * cl(hypot((q % W) + 0.5 - X[p], floor(q / W) + 0.5 - Y[p]) / rm[i], 0, 1) ** 0.8;
  }
  // Each cell's rank along the tree, left to right: its slate tint turns a quarter of the wheel across them.
  S.rank = new Float32Array(S.T.n);
  let r = 0;
  const walk = (i) => { if (S.T.ax[i] < 0) S.rank[i] = r++ / max(1, n - 1); else { walk(S.T.c0[i]); walk(S.T.c1[i]); } };
  walk(0);
  arrays(S, S.T);
  begin(S);
}

// A fresh search at the query's place on its road.
function begin(S) {
  const [qx, qy] = road(S.tau);
  S.qx = qx; S.qy = qy;
  S.P = plan(S.T, S.X, S.Y, qx, qy);
  S.phase = 0; S.tt = 0; S.ph = 0; S.ei = 0; S.vc = 0;
  for (const k of ["act", "tA", "pr", "tP", "hot", "tH", "vis", "tV", "vfl", "fl", "ord"]) S[k].fill(0);
  S.ringA = 0; S.ringT = 0; S.rD = 0; S.rT = 0; S.bestLeaf = -1; S.win = 0; S.link = 0; S.linkT = 0;
  S.pl = -1; S.plD = 0; S.plAge = 9; S.hit = 0; S.lastLeaf = 0;
}

export function setup(params) {
  params.s = { src: sources(), tau: TAU0, hue: 0 };
  rebuild(params.s, 32, 0.06);
}

function fire(S, e) {
  if (e.k === DESC) S.tA[e.i] = 1;
  else if (e.k === LEAF) {
    S.tV[e.i] = 1; S.vfl[e.i] = 1; S.ord[e.i] = S.vc++; S.lastLeaf = e.i;
    if (S.ringA <= 0.01 && S.ringT === 0) S.rD = e.best;
    S.ringT = 1; S.rT = e.best; S.bestLeaf = e.leaf;
    if (e.imp) S.hit = 1;
  } else if (e.k === CHECK) {
    S.fl[e.i] = 1; S.pl = e.i; S.plD = e.d; S.plAge = 0;
    if (e.cross) S.tH[e.i] = 1;
  } else if (e.k === PRUNE) S.tP[e.i] = 1;
  else S.tA[e.i] = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 32, 0.06], d = cl(dt || 0, 0, 0.1);
  const hue = cl(k[0], 0, 1), speed = cl(k[1], 0.3, 3), n = round(cl(k[2], 32, NM)), u = round(cl(k[3], 0, 1) * 20) / 20;
  S.hue = hue;
  if (n !== S.n || u !== S.u) rebuild(S, n, u);
  const ds = d * speed;
  if (S.phase === 0) {
    S.tt += ds;
    while (S.ei < S.P.ev.length && S.P.ev[S.ei].t <= S.tt) fire(S, S.P.ev[S.ei++]);
    if (S.ei >= S.P.ev.length && S.tt >= S.P.end) { S.phase = 1; S.ph = 0; S.linkT = 1; S.win = 1; }
  } else if (S.phase === 1) {
    S.ph += ds;
    if (S.ph >= HOLD) {
      S.phase = 2; S.ph = 0;
      for (const key of ["tA", "tP", "tH", "tV"]) S[key].fill(0);
      S.ringT = 0; S.linkT = 0; S.win = 0;
    }
  } else {
    S.ph += ds;
    const [qx, qy] = road(S.tau + DTAU * ease(S.ph / GLIDE));
    S.qx = qx; S.qy = qy;
    if (S.ph >= GLIDE) { S.tau += DTAU; begin(S); }
  }
  // The look of each node follows its target.
  const g = (rate) => 1 - exp(-ds / rate);
  const gAu = g(0.08), gAd = g(0.3), gP = g(0.35), gH = g(0.1), gHd = g(0.5), gV = g(0.1), gVd = g(0.3), dec = exp(-ds / 0.3);
  for (let i = 0; i < S.T.n; i++) {
    S.act[i] += (S.tA[i] - S.act[i]) * (S.tA[i] > S.act[i] ? gAu : gAd);
    S.pr[i] += (S.tP[i] - S.pr[i]) * gP;
    S.hot[i] += (S.tH[i] - S.hot[i]) * (S.tH[i] > S.hot[i] ? gH : gHd);
    S.vis[i] += (S.tV[i] - S.vis[i]) * (S.tV[i] > S.vis[i] ? gV : gVd);
    S.vfl[i] *= dec; S.fl[i] *= dec;
  }
  S.ringA += (S.ringT - S.ringA) * g(0.15);
  S.rD += (S.rT - S.rD) * g(0.12);
  S.link += (S.linkT - S.link) * g(0.2);
  S.hit *= exp(-ds / 0.4);
  S.plAge += ds;
}

function blend(R, G, B, q, r, g, b, a) {
  const u = a > 1 ? 1 : a;
  R[q] += (r - R[q]) * u; G[q] += (g - G[q]) * u; B[q] += (b - B[q]) * u;
}

// A soft round dot of radius r LEDs, blended over what is there.
function disc(R, G, B, x, y, r, cr, cg, cb, a) {
  const x0 = floor(x - r - 1), y0 = floor(y - r - 1), x1 = ceil(x + r + 1), y1 = ceil(y + r + 1);
  for (let py = max(0, y0); py <= min(H - 1, y1); py++)
    for (let px = max(0, x0); px <= min(W - 1, x1); px++) {
      const w = r + 0.5 - hypot(px + 0.5 - x, py + 0.5 - y);
      if (w > 0) blend(R, G, B, py * W + px, cr, cg, cb, w * a);
    }
}

function seg(R, G, B, x0, y0, x1, y1, cr, cg, cb, a, dash) {
  const len = hypot(x1 - x0, y1 - y0), ns = ceil(len * 2) + 1;
  for (let s = 0; s <= ns; s++) {
    if (dash && floor(s / 4) % 2) continue;
    const t = s / ns, x = x0 + (x1 - x0) * t - 0.5, y = y0 + (y1 - y0) * t - 0.5, ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
    for (let b = 0; b < 4; b++) {
      const px = ix + (b & 1), py = iy + (b >> 1);
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      blend(R, G, B, py * W + px, cr, cg, cb, ((b & 1) ? fx : 1 - fx) * ((b >> 1) ? fy : 1 - fy) * 1.2 * a);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const T = S.T, { ax, par, dp } = T, N = T.n;
  const R = S.R || (S.R = new Float32Array(NP)), G = S.G || (S.G = new Float32Array(NP)), B = S.B || (S.B = new Float32Array(NP));
  const H0 = S.hue + 0.58;
  // Palette. Neutral cells are slate, the path glows a lighter slate, the cells the search examines
  // run from gold along the order they were reached, the split lines are pale and warm.
  const glow = [], vc = [], lnc = [], tmp = [0, 0, 0];
  hsv(H0 + 0.02, 0.45, 0.62, glow, 0);
  for (let o = 0; o < 24; o++) { hsv(H0 + 0.5 + 0.035 * o, 0.85, 0.95, vc, o * 3); }
  for (let d = 0; d < LB.length; d++) hsv(H0 + 0.52, 0.3, LB[d], lnc, d * 3);
  const hot = [0, 0, 0], ring = [0, 0, 0], pale = [0, 0, 0];
  hsv(H0 + 0.5, 0.6, 1, hot, 0); hsv(H0 - 0.07, 0.3, 1, ring, 0); hsv(H0 + 0.45, 0.12, 1, pale, 0);

  // Effective prune and glow of each node: a node is sunk if any ancestor is, and glows as
  // brightly as the deepest glowing ancestor.
  const { pr, act, pe, ae } = S;
  for (let i = 0; i < N; i++) {
    const gl = act[i] * (dp[i] / (T.maxd + 1)) ** 1.3;
    pe[i] = i ? max(pr[i], pe[par[i]]) : pr[i];
    ae[i] = i ? max(gl, ae[par[i]]) : gl;
  }
  const { lc, lb, ln } = S;
  for (let i = 0; i < N; i++) {
    if (ax[i] < 0) {
      slate(H0 - 0.04 + 0.2 * S.rank[i], (i * 7 + dp[i] * 3) % 3);
      let r = neutral[0], g = neutral[1], b = neutral[2];
      const a = ae[i] * 0.85;
      r += (glow[0] - r) * a; g += (glow[1] - g) * a; b += (glow[2] - b) * a;
      const w = S.vis[i];
      if (w > 0.001) {
        const o = min(23, S.ord[i]) * 3, f = S.vfl[i] * 0.75;
        r += (vc[o] + (255 - vc[o]) * f - r) * w; g += (vc[o + 1] + (255 - vc[o + 1]) * f - g) * w; b += (vc[o + 2] + (255 - vc[o + 2]) * f - b) * w;
      }
      const k = 1 - 0.9 * pe[i];
      lc[i * 3] = r * k; lc[i * 3 + 1] = g * k; lc[i * 3 + 2] = b * k;
      lb[i * 3] = neutral[0] * k; lb[i * 3 + 1] = neutral[1] * k; lb[i * 3 + 2] = neutral[2] * k;
    } else {
      const o = min(dp[i], LB.length - 1) * 3, k = 1 - 0.72 * pe[i], h = S.hot[i], f = S.fl[i];
      for (let c = 0; c < 3; c++) {
        let v = lnc[o + c] * k;
        v += (ring[c] - v) * act[i] * 0.8;
        v += (hot[c] - v) * h * 0.85;
        v += (255 - v) * f;
        ln[i * 3 + c] = v;
      }
    }
  }
  const { cell, line, sh } = S;
  for (let p = 0; p < NP; p++) {
    const l = line[p];
    if (l >= 0) { R[p] = ln[l * 3]; G[p] = ln[l * 3 + 1]; B[p] = ln[l * 3 + 2]; continue; }
    const c = cell[p] * 3, u = sh[p];
    R[p] = lb[c] + (lc[c] - lb[c]) * u; G[p] = lb[c + 1] + (lc[c + 1] - lb[c + 1]) * u; B[p] = lb[c + 2] + (lc[c + 2] - lb[c + 2]) * u;
  }
  // The points: dim until examined, bright once they are.
  for (let k = 0; k < S.n; k++) {
    const i = S.ptNode[k], w = S.vis[i], b = 0.8 * (1 - 0.6 * pe[i]) + 0.2 * w;
    disc(R, G, B, S.X[k], S.Y[k], 1.25, pale[0] * b, pale[1] * b, pale[2] * b, 1);
  }
  // The best-distance circle, the dotted plumb line to the line being checked, the answer's link.
  const qx = S.qx, qy = S.qy, P = S.P;
  if (S.ringA > 0.01 && S.rD < 400) {
    const r = S.rD, a = S.ringA * 0.9;
    for (let y = max(0, floor(qy - r - 1.5)); y < min(H, ceil(qy + r + 1.5)); y++)
      for (let x = max(0, floor(qx - r - 1.5)); x < min(W, ceil(qx + r + 1.5)); x++) {
        const w = 1.1 - abs(hypot(x + 0.5 - qx, y + 0.5 - qy) - r);
        if (w > 0) blend(R, G, B, y * W + x, ring[0], ring[1], ring[2], w * a);
      }
  }
  if (S.pl >= 0 && S.plAge < 0.4) {
    const i = S.pl, a = 1 - S.plAge / 0.4;
    const fx = ax[i] ? cl(qx, T.x0[i], T.x1[i]) : T.sp[i], fy = ax[i] ? T.sp[i] : cl(qy, T.y0[i], T.y1[i]);
    seg(R, G, B, qx, qy, fx, fy, 255, 255, 255, a, true);
    disc(R, G, B, fx, fy, 1.4, 255, 255, 255, a);
  }
  if (S.link > 0.01 && S.phase > 0) seg(R, G, B, qx, qy, S.X[P.bestPt], S.Y[P.bestPt], hot[0], hot[1], hot[2], S.link, false);
  if (S.win > 0.01 && P.bestPt >= 0) disc(R, G, B, S.X[P.bestPt], S.Y[P.bestPt], 2.6, 255, 255, 255, 0.55 * S.link);
  if (S.hit > 0.02 && S.bestLeaf >= 0) {
    const p = T.pt[S.bestLeaf];
    disc(R, G, B, S.X[p], S.Y[p], 2.4, 255, 255, 255, 0.5 * S.hit);
  }
  // The query: a white cross over a faint dark halo.
  disc(R, G, B, qx, qy, 2.6, 0, 0, 0, 0.4);
  seg(R, G, B, qx - 2.5, qy, qx + 2.5, qy, 255, 255, 255, 1, false);
  seg(R, G, B, qx, qy - 2.5, qx, qy + 2.5, 255, 255, 255, 1, false);
  disc(R, G, B, qx, qy, 1, 255, 255, 255, 1);
  // The tally at the foot: one dot for each point, lit gold as the search examines them.
  const rows = ceil(S.n / 32), top = 126 - 2 * (rows - 1) - 2;
  for (let y = top; y < H; y++) for (let x = 0; x < W; x++) R[y * W + x] = G[y * W + x] = B[y * W + x] = 0;
  for (let k = 0; k < S.n; k++) {
    const r = floor(k / 32), m = min(32, S.n - r * 32), x = round((W - (2 * m - 1)) / 2) + 2 * (k % 32), q = (126 - 2 * (rows - 1 - r)) * W + x;
    const on = k < S.vc, f = on && k === S.vc - 1 ? S.vfl[S.lastLeaf] : 0;
    R[q] = on ? vc[0] + (255 - vc[0]) * f : 64; G[q] = on ? vc[1] + (255 - vc[1]) * f : 76; B[q] = on ? vc[2] + (255 - vc[2]) * f : 112;
  }
  for (let q = 0; q < NP; q++) display.setPixel(q % W, (q / W) | 0, R[q], G[q], B[q]);
}
