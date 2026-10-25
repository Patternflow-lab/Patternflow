// ===== Patternflow pattern =====
// Title:   Dürer's Unfolding
// Family:  space
// Idea:    A convex solid, its faces hatched like an engraving, lies flat as one net up the panel, folds shut hinge by hinge along a spanning tree of its edges, turns in the dark, shrinks away and comes back as the next solid, which turns and unfolds along its own tree into a new net that never overlaps itself.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Dürer's unfolding problem (Albrecht Dürer, 1525; Geoffrey Shephard, 1975), edge unfoldings of the Platonic solids never overlap (Takashi Horiyama and Wataru Shoji, 2011), uniform spanning trees by loop-erased random walk (David Wilson, 1996), pattern round 49
// Round:   49
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Solid=0..5, Tree=0..1
//
// Knob 1: Hue. Each face is coloured by how many hinges lie between it and the root face the net is folded round: at 0 the root is azure and the faces furthest out pink, through blue and violet; turning it carries that third of the wheel round together, so at 0.5 the root is red orange and the far faces green. A face that comes round to orange or yellow keeps at least 0.8 of full value, so it never dims to brown. The plain backs of the faces, seen while the net folds, are a dim grey of the face's own colour, cross-hatched.
// Knob 2: Speed. At 2 one solid's story takes 10.6 seconds: it grows out of a point in 0.4, turns for 0.9, unfolds hinge by hinge in 3, lies flat swaying for 2.4, folds shut in 2.6, turns for 0.9 and shrinks away in 0.4. A fresh start opens with the last hinges opening and folds at 3.4 seconds. At 0.2 it all runs ten times slower, at 3 half as fast again.
// Knob 3: Solid. Which solid the round starts from, and the five after it follow in turn: 0 cube (6 squares, edges 26 LEDs long), 1 octahedron (8 triangles, 36), 2 dodecahedron (12 pentagons, 15), 3 icosahedron (20 triangles, 23), 4 truncated octahedron (8 hexagons and 6 squares, 13), 5 cuboctahedron (8 triangles and 6 squares, 21). Each net is scaled to fill a 60 by 124 LED box, so the edge length depends on the solid and the tree.
// Knob 4: Tree. Which spanning tree of hinges the solid unfolds along, out of 8 different nets kept for each solid from 160 uniform random spanning trees: at 0 the net that fills the most of the box (the cube's covers 51% of the panel), at 1 the eighth (the cube's covers 32%). Every later round of the six solids takes the next tree.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, acos, atan2, hypot, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}
// How near a hue is to orange and yellow, 0 to 1.
const warm = (h) => max(0, 1 - abs(h - floor(h) - 0.11) / 0.13);
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const crs = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
const nrm = (p) => {
  const l = hypot(p[0], p[1], p[2]) || 1;
  return [p[0] / l, p[1] / l, p[2] / l];
};

// The solids as vertex sets: every signed permutation of a triple, or only
// the cyclic ones.
function signed(b, all) {
  const out = [], seen = new Set();
  const ps = all ? [[0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [2, 1, 0], [1, 0, 2]] : [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
  for (const p of ps)
    for (let s = 0; s < 8; s++) {
      const v = p.map((i, k) => ((s >> k) & 1 ? -b[i] : b[i]) + 0);
      const key = v.map((x) => x.toFixed(4)).join();
      if (!seen.has(key)) seen.add(key), out.push(v);
    }
  return out;
}
const PHI = (1 + sqrt(5)) / 2;
const SOLIDS = [
  () => signed([1, 1, 1], 1),
  () => signed([1, 0, 0], 1),
  () => signed([1, 1, 1], 1).concat(signed([0, 1 / PHI, PHI], 0)),
  () => signed([0, 1, PHI], 0),
  () => signed([0, 1, 2], 1),
  () => signed([1, 1, 0], 1),
];

// The faces of the hull: every plane through three vertices with all the
// others on one side, its vertices ordered counter-clockwise from outside.
function hull(V) {
  const F = [], seen = new Set(), n = V.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        let c = crs(sub(V[j], V[i]), sub(V[k], V[i]));
        if (hypot(c[0], c[1], c[2]) < 1e-9) continue;
        c = nrm(c);
        const d = dot(c, V[i]), on = [];
        let pos = 0, neg = 0;
        for (let m = 0; m < n; m++) {
          const s = dot(c, V[m]) - d;
          if (s > 1e-6) pos++;
          else if (s < -1e-6) neg++;
          else on.push(m);
        }
        if (pos && neg) continue;
        if (pos) c = [-c[0], -c[1], -c[2]];
        const key = on.join();
        if (seen.has(key)) continue;
        seen.add(key);
        const ce = [0, 1, 2].map((a) => on.reduce((s, m) => s + V[m][a], 0) / on.length);
        const e1 = nrm(sub(V[on[0]], ce)), e2 = crs(c, e1);
        const ang = (m) => {
          const p = sub(V[m], ce);
          return atan2(dot(p, e2), dot(p, e1));
        };
        on.sort((a, b) => ang(a) - ang(b));
        F.push({ v: on, n: c, c: ce });
      }
  return F;
}

// A uniform random spanning tree of the face graph, by loop-erased random
// walks (Wilson's algorithm): parent of each face, -1 at the root.
function wilson(adj) {
  const n = adj.length, inT = new Uint8Array(n), nx = new Int32Array(n).fill(-1);
  inT[0] = 1;
  for (let i = 1; i < n; i++) {
    let u = i;
    while (!inT[u]) u = nx[u] = adj[u][floor(Math.random() * adj[u].length)];
    for (u = i; !inT[u]; u = nx[u]) inT[u] = 1;
  }
  nx[0] = -1;
  return nx;
}

// Lay a tree out flat. From the root outward, each face is turned about its
// hinge into its parent's plane, on the far side of the hinge. Returns each
// face's polygon in the root's plane, the BFS order, parents and depths.
function layout(V, F, adj, par, root) {
  const n = F.length, kids = F.map(() => []);
  for (let f = 0; f < n; f++) if (par[f] >= 0) kids[par[f]].push(f), kids[f].push(par[f]);
  const P = new Int32Array(n).fill(-2), dep = new Int32Array(n), order = [root];
  P[root] = -1;
  for (let q = 0; q < order.length; q++)
    for (const g of kids[order[q]]) if (P[g] === -2) (P[g] = order[q]), (dep[g] = dep[order[q]] + 1), order.push(g);
  const pos = new Array(n), f0 = F[root], e1 = nrm(sub(V[f0.v[0]], f0.c)), e2 = crs(f0.n, e1);
  pos[root] = f0.v.map((m) => {
    const p = sub(V[m], f0.c);
    return [dot(p, e1), dot(p, e2)];
  });
  for (const f of order.slice(1)) {
    const p = P[f], pf = F[p], ff = F[f], [a, b] = ff.v.filter((m) => pf.v.includes(m));
    const pa = pos[p][pf.v.indexOf(a)], pb = pos[p][pf.v.indexOf(b)], ux = pb[0] - pa[0], uy = pb[1] - pa[1], ul = hypot(ux, uy);
    let wx = -uy / ul, wy = ux / ul, cx = 0, cy = 0;
    for (const q of pos[p]) (cx += q[0]), (cy += q[1]);
    if ((cx / pos[p].length - pa[0]) * wx + (cy / pos[p].length - pa[1]) * wy > 0) (wx = -wx), (wy = -wy);
    const u = nrm(sub(V[b], V[a])), r = sub(ff.c, V[a]), t = dot(r, u), w = nrm([r[0] - t * u[0], r[1] - t * u[1], r[2] - t * u[2]]);
    pos[f] = ff.v.map((m) => {
      const q = sub(V[m], V[a]), s = dot(q, u), h = dot(q, w);
      return [pa[0] + (s * ux) / ul + h * wx, pa[1] + (s * uy) / ul + h * wy];
    });
  }
  return { pos, order, P, dep, e1, e2 };
}

// The turn of the net and the LEDs per unit that fit it into the box: K
// turns tried over half a circle, then a finer look round the best.
const BOXW = 60, BOXH = 124;
function fitNet(pos, K = 48) {
  let best = { s: 0 };
  const tryA = (a) => {
    const c = cos(a), s = sin(a);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const poly of pos)
      for (const [x, y] of poly) {
        const X = c * x - s * y, Y = s * x + c * y;
        (x0 = min(x0, X)), (x1 = max(x1, X)), (y0 = min(y0, Y)), (y1 = max(y1, Y));
      }
    const sc = min(BOXW / (x1 - x0), BOXH / (y1 - y0));
    if (sc > best.s) best = { s: sc, a, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };
  for (let k = 0; k < K; k++) tryA((k / K) * PI);
  const a0 = best.a;
  for (let k = -6; k <= 6; k++) tryA(a0 + (k / 6) * (PI / K));
  return best;
}

// Two convex polygons of the net overlap when no edge of either separates
// them by less than a hair: neighbours along a hinge only touch. Run on
// 20,000 uniform random trees of each of the six solids it found no net
// that overlaps, as Horiyama and Shoji proved for the Platonic ones; on the
// truncated icosahedron it finds about one in a hundred (47 and 51 of
// 5,000 in two runs), so it does see an overlap where there is one.
// The corners round each solid vertex in those nets leave gaps that add up
// to 720 degrees, Descartes' total defect, within 8e-13 degrees.
function overlap(A, B) {
  for (const poly of [A, B])
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], ax = q[1] - p[1], ay = p[0] - q[0];
      let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
      for (const v of A) (a0 = min(a0, v[0] * ax + v[1] * ay)), (a1 = max(a1, v[0] * ax + v[1] * ay));
      for (const v of B) (b0 = min(b0, v[0] * ax + v[1] * ay)), (b1 = max(b1, v[0] * ax + v[1] * ay));
      if (min(a1, b1) - max(a0, b0) < 1e-6 * hypot(ax, ay)) return false;
    }
  return true;
}

// Trees tried per solid and kept per solid.
const TRIES = 160, KEEP = 8;
function buildSolid(S, k) {
  const V = SOLIDS[k](), F = hull(V), n = F.length, em = new Map();
  F.forEach((f, fi) =>
    f.v.forEach((a, j) => {
      const b = f.v[(j + 1) % f.v.length], key = min(a, b) * 64 + max(a, b);
      if (!em.has(key)) em.set(key, []);
      em.get(key).push(fi);
    }),
  );
  const adj = F.map(() => []);
  for (const [p, q] of em.values()) adj[p].push(q), adj[q].push(p);
  let area = 0;
  for (const f of F)
    for (let j = 1; j + 1 < f.v.length; j++) {
      const c = crs(sub(V[f.v[j]], V[f.v[0]]), sub(V[f.v[j + 1]], V[f.v[0]]));
      area += hypot(c[0], c[1], c[2]) / 2;
    }
  // Sample trees, drop nets already seen (same face-centre distances from
  // the middle), rank the rest by how much of the box a rough fit fills,
  // and keep the best that do not overlap.
  const cand = [], sigs = new Set();
  for (let t = 0; t < TRIES; t++) {
    const par = wilson(adj), L = layout(V, F, adj, par, 0), fit = fitNet(L.pos, 12);
    const cs = L.pos.map((p) => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]);
    const gx = cs.reduce((s, q) => s + q[0], 0) / n, gy = cs.reduce((s, q) => s + q[1], 0) / n;
    const sig = cs.map((q) => hypot(q[0] - gx, q[1] - gy).toFixed(3)).sort().join();
    if (sigs.has(sig)) continue;
    sigs.add(sig);
    cand.push({ par, L, cov: (area * fit.s * fit.s) / N });
  }
  cand.sort((a, b) => b.cov - a.cov);
  const trees = [];
  for (const c of cand) {
    if (trees.length === KEEP) break;
    let bad = false;
    for (let i = 0; i < n && !bad; i++) for (let j = i + 1; j < n && !bad; j++) bad = overlap(c.L.pos[i], c.L.pos[j]);
    S.tested++;
    if (bad) {
      S.overlaps++;
      continue;
    }
    c.fit = fitNet(c.L.pos);
    c.cov = (area * c.fit.s * c.fit.s) / N;
    trees.push(makeTree(V, F, adj, c));
  }
  trees.sort((a, b) => b.cov - a.cov);
  return { V, F, n, trees };
}

// A kept tree, rooted at the face nearest the middle of its net, with what
// the fold needs: each face's hinge, the angle that lays it flat, and the
// turn from solid to screen that stands the net up the panel.
function makeTree(V, F, adj, c) {
  const n = F.length, { fit } = c;
  let root = 0, bd = 1e9;
  const ca = cos(fit.a), sa = sin(fit.a);
  c.L.pos.forEach((p, f) => {
    let x = 0, y = 0;
    for (const q of p) (x += q[0] / p.length), (y += q[1] / p.length);
    const d = hypot(ca * x - sa * y - fit.cx, sa * x + ca * y - fit.cy);
    if (d < bd) (bd = d), (root = f);
  });
  const L = layout(V, F, adj, c.par, root), f2 = fitNet(L.pos), s = f2.s, c2 = cos(f2.a), s2 = sin(f2.a);
  const f0 = F[root];
  // Solid to screen: x and y along the net's turned frame, z out of the root face.
  const Q = [0, 1, 2].map((r) => [0, 1, 2].map((k) => s * (r === 0 ? c2 * L.e1[k] - s2 * L.e2[k] : r === 1 ? s2 * L.e1[k] + c2 * L.e2[k] : f0.n[k])));
  const o = Q.map((row, r) => -dot(row, f0.c) - (r === 0 ? f2.cx * s : r === 1 ? f2.cy * s : 0));
  const ax = [], an = [], phi = new Float64Array(n), hv = [];
  let maxD = 0;
  for (let f = 0; f < n; f++) {
    maxD = max(maxD, L.dep[f]);
    const ff = F[f];
    let a, b;
    if (f === root) (a = ff.v[0]), (b = ff.v[1]);
    else [a, b] = ff.v.filter((m) => F[L.P[f]].v.includes(m));
    const u = nrm(sub(V[b], V[a]));
    ax[f] = [V[a], u];
    if (f !== root) {
      const np = F[L.P[f]].n, th = acos(cl(dot(ff.n, np), -1, 1)), r = rot(u, th), m = mul(r, ff.n);
      phi[f] = dot(m, np) > 0.999 ? th : -th;
    }
    // The hatching is laid on each face from its hinge: each corner's
    // distance from the hinge and along it, in LEDs (kept positive).
    hv[f] = ff.v.map((m) => {
      const q = sub(V[m], V[a]), t = dot(q, u);
      return [s * hypot(q[0] - t * u[0], q[1] - t * u[1], q[2] - t * u[2]), s * t + 64];
    });
    an[f] = ff.n;
  }
  // Shut, the solid is brought nearer until it is 58 LEDs across.
  const rc = max(...V.map((v) => hypot(v[0], v[1], v[2])));
  return { root, order: L.order, P: L.P, dep: L.dep, maxD, Q, o, ax, an, phi, hv, s, cov: c.cov, pos: L.pos, zoom: min(1.8, 29 / (rc * s)) };
}

// Rotation matrices, row-major 3x3 as nested arrays.
function rot(u, th) {
  const c = cos(th), s = sin(th), t = 1 - c, [x, y, z] = u;
  return [
    [c + t * x * x, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, c + t * y * y, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, c + t * z * z],
  ];
}
const mul = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const mm = (a, b) => a.map((row) => [0, 1, 2].map((k) => row[0] * b[0][k] + row[1] * b[1][k] + row[2] * b[2][k]));

// The story of one solid, in seconds at Speed 2: grow out of a point, turn,
// unfold, lie flat, fold, turn, shrink away. A fresh start opens on the net.
const GROW = 0.4, TURN = 0.9, UNF = 3, HOLD = 2.4, FOLD = 2.6, SHR = 0.4;
const CYC = GROW + TURN + UNF + HOLD + FOLD + TURN + SHR;
const T0 = GROW + TURN + UNF + HOLD - 3.4;
// Each hinge swings over this share of the unfolding, the last starting at its end.
const SWING = 0.4;
// The camera's distance in LEDs, the light (a unit vector toward it), and
// the hatching: lines 1 LED wide at 45 degrees to each face's hinge, every
// 2.1 LEDs, at HD of the face's colour, crossed at right angles where a face
// turns from the light and on the plain backs. The map places this pattern
// by the hatching: with no lines the window read detail 0.039; lines every
// 2.8 LEDs along the hinge at 0.4 gave 0.071, and at 45 degrees with the net
// held longer 0.122. Drift comes from the dark moment between two solids, so
// it is the flat net's mean level: 0.351 at HD 0.4, 0.365 at 0.46.
const CAM = 170, LIGHT = nrm([-0.35, 0.45, 0.82]), HP = 3, HD = 0.46;

export function setup(params) {
  params.s = {
    hue: 0.5, speed: 2, solidK: 0.5, treeK: 0.06, tau: T0,
    solids: [], tested: 0, overlaps: 0,
    zb: new Float32Array(N), id: new Int16Array(N), hb: new Float32Array(N), hc: new Float32Array(N),
    cur: null, tr: null,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.solidK = cl(k[2], 0, 5);
  S.treeK = cl(k[3], 0, 1);
  S.tau += (d * S.speed) / 2;
  const cyc = floor(S.tau / CYC), t = S.tau - cyc * CYC;
  const si = (floor(S.solidK + 0.5) + cyc) % 6;
  if (!S.solids[si]) S.solids[si] = buildSolid(S, si);
  const sol = S.solids[si], tr = sol.trees[(min(KEEP - 1, floor(S.treeK * KEEP)) + floor(cyc / 6)) % sol.trees.length];
  S.cur = sol;
  S.tr = tr;
  // How open the net is, 0 shut to 1 flat, its scale, and the turn.
  let open = 0, g = 1;
  const t1 = GROW + TURN, t2 = t1 + UNF, t3 = t2 + HOLD, t4 = t3 + FOLD, t5 = t4 + TURN;
  if (t < GROW) g = ease(t / GROW);
  else if (t < t1) open = 0;
  else if (t < t2) open = (t - t1) / UNF;
  else if (t < t3) open = 1;
  else if (t < t4) open = 1 - (t - t3) / FOLD;
  else if (t >= t5) g = 1 - ease((t - t5) / SHR);
  // The turn slows to rest as the net opens and picks up as it shuts.
  const inEnd = t1 + 0.6 * UNF, outStart = t3 + 0.4 * FOLD;
  let th = 0;
  if (t < inEnd) th = 5.6 * (1 - t / inEnd) ** 2;
  else if (t > outStart) th = -5.6 * ((t - outStart) / (CYC - outStart)) ** 2;
  S.turn = rot(nrm([0.45 * sin(cyc * 2.3), 1, 0.45 * cos(cyc * 2.3)]), th);
  // Lying flat, the net sways a little about the panel's long axis.
  if (t >= t2 && t < t3) S.turn = rot([0, 1, 0], 0.2 * sin((PI * (t - t2)) / HOLD) * sin((2 * PI * (t - t2)) / HOLD));
  S.g = g;
  // Each hinge in BFS order swings in its own window of the unfolding.
  const n = sol.n, nh = n - 1, ang = new Float64Array(n);
  let sum = 0, tot = 0;
  for (let q = 1; q < n; q++) {
    const f = tr.order[q], st = nh > 1 ? ((q - 1) / (nh - 1)) * (1 - SWING) : 0, o = ease((open - st) / SWING);
    ang[f] = o * tr.phi[f];
    sum += o * abs(tr.phi[f]);
    tot += abs(tr.phi[f]);
  }
  S.ang = ang;
  S.shut = 1 - sum / tot;
  // Shut, it is seen from a little above, so a turn always shows its top.
  S.turn = mm(rot([1, 0, 0], 0.42 * S.shut), S.turn);
}

// Fill one screen triangle, nearest wins: q is 1 over depth, and the two
// hatching coordinates are carried perspective-correct as h q.
function tri(S, A, B, C, f) {
  const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
  if (abs(area) < 1e-6) return;
  const x0 = max(0, floor(min(A[0], B[0], C[0]))), x1 = min(W - 1, floor(max(A[0], B[0], C[0])));
  const y0 = max(0, floor(min(A[1], B[1], C[1]))), y1 = min(H - 1, floor(max(A[1], B[1], C[1])));
  const { zb, id, hb, hc } = S;
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const w0 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / area, w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const q = w0 * A[2] + w1 * B[2] + w2 * C[2], i = y * W + x;
      if (q <= zb[i]) continue;
      zb[i] = q;
      id[i] = f;
      hb[i] = (w0 * A[3] * A[2] + w1 * B[3] * B[2] + w2 * C[3] * C[2]) / q;
      hc[i] = (w0 * A[4] * A[2] + w1 * B[4] * B[2] + w2 * C[4] * C[2]) / q;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.tr) return;
  const { cur: sol, tr, zb, id, hb, hc, ang, turn: R, g } = S;
  const { V, F, n } = sol, { Q, o, order, P, ax, an, hv } = tr;
  zb.fill(0);
  id.fill(-1);
  // Each face's motion from the shut solid: its parent's, then its own
  // swing about its hinge, in BFS order from the root.
  const MR = new Array(n), MT = new Array(n), col = new Array(n), side = new Int8Array(n), cross = new Uint8Array(n);
  const sh = S.shut, cxv = o[0] * sh, cyv = o[1] * sh, czv = o[2] * sh, gz = g * (1 + (tr.zoom - 1) * sh);
  for (const f of order) {
    if (f === tr.root) (MR[f] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]), (MT[f] = [0, 0, 0]);
    else {
      const p = P[f], [a, u] = ax[f], r = rot(u, ang[f]), ra = mul(r, a), pr = MR[p];
      MR[f] = mm(pr, r);
      const v = mul(pr, sub(a, ra));
      MT[f] = [v[0] + MT[p][0], v[1] + MT[p][1], v[2] + MT[p][2]];
    }
    // Corners to the screen: solid, fold, stand up, centre, turn, scale, project.
    const ff = F[f], pts = [];
    for (let j = 0; j < ff.v.length; j++) {
      const p0 = mul(MR[f], V[ff.v[j]]), p1 = [p0[0] + MT[f][0], p0[1] + MT[f][1], p0[2] + MT[f][2]];
      const v = [dot(Q[0], p1) + o[0] - cxv, dot(Q[1], p1) + o[1] - cyv, dot(Q[2], p1) + o[2] - czv], w = mul(R, v);
      const q = 1 / (CAM - gz * w[2]);
      pts.push([32 + CAM * gz * w[0] * q, 64 - CAM * gz * w[1] * q, q, hv[f][j][0], hv[f][j][1]]);
    }
    let a2 = 0;
    for (let j = 0; j < pts.length; j++) {
      const p = pts[j], q = pts[(j + 1) % pts.length];
      a2 += p[0] * q[1] - q[0] * p[1];
    }
    side[f] = a2 < 0 ? 1 : 0;
    for (let j = 1; j + 1 < pts.length; j++) tri(S, pts[0], pts[j], pts[j + 1], f);
    // Light on the face, in five steps.
    const nn = mul(R, mul(Q, mul(MR[f], an[f]))), nl = hypot(nn[0], nn[1], nn[2]);
    const lit = round(cl(0.3 + 0.85 * (dot(nn, LIGHT) / nl) * (side[f] ? 1 : -1), 0.3, 1) * 5) / 5;
    const hue = 0.55 + S.hue + (0.32 * tr.dep[f]) / max(1, tr.maxD), wm = warm(hue);
    col[f] = side[f] ? hsv(hue, 0.72, max(lit, 0.4 + 0.4 * wm)) : hsv(hue, 0.2, 0.4);
    cross[f] = !side[f] || lit < 0.8 ? 1 : 0;
  }
  for (let i = 0; i < N; i++) {
    const f = id[i], x = i % W, y = (i - x) / W;
    let r = 0, gg = 0, b = 0;
    if (f >= 0) {
      const c = col[f], fr = x + 1 < W ? id[i + 1] : -1, fd = y + 1 < H ? id[i + W] : -1;
      // An LED whose right or lower neighbour is another face is a dark seam.
      let m = 1;
      if ((fr >= 0 && fr !== f) || (fd >= 0 && fd !== f)) m = 0.08;
      else if ((hb[i] + hc[i]) % HP < 1.41 || (cross[f] && (hb[i] - hc[i] + 999) % HP < 1.41)) m = HD;
      (r = c[0] * m), (gg = c[1] * m), (b = c[2] * m);
    }
    display.setPixel(x, y, (255 * r) | 0, (255 * gg) | 0, (255 * b) | 0);
  }
}
