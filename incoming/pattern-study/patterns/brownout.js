// ===== Patternflow pattern =====
// Title:   Brownout
// Family:  powergrid
// Idea:    A transmission grid of about seventy nodes glows on the black panel, five big generators pulsing and small bright pulses running down every line with the flow it carries, and now and then a tree falls on one line, its load shoves onto its neighbours, the ones pushed past their limit heat white and trip one after another like a fuse until the web has dark islands in it, and then the operators close the lines again one by one, nearest the generators first.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: cascading failure on a network where every line has a capacity of (1 + margin) times its normal load (Adilson Motter and Ying-Cheng Lai, 2002, from memory), the linearised DC power flow that fixes who carries what (Kirchhoff's laws with the line reactance as its length, solved by conjugate gradients on the graph Laplacian), and the load shedding and islanding of a real blackout; the Gabriel-graph web over Poisson-disc nodes, the heat-then-trip timing, the restoration order, the demand drift and the slow rewiring that keeps the grid from ever repeating are original, pattern round 257
// Round:   257
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Demand=0..3, Margin=-1..1, Storm=-1..1
//
// Knob 1: Hue. Turns the loading ramp round the wheel. At 0 an idle line is teal, a half-loaded one green, a loaded one yellow, amber at four fifths of its rating and red at the limit; the generators take the amber end of it and the dead ghost lines stay grey-blue whatever the knob says.
// Knob 2: Demand. 0 to 3, opening at 2. The average load as a share of what the grid was built for: 0.38 at 0, 0.76 at the start, 0.95 at 3. The median live line carries 0.28 of its rating at 0 and 0.47 at the start, so the web slides from teal toward amber within a second and the pulses speed up; at 1 a fault is nearly always shrugged off, at 2 a cascade of three or more lines comes about every 30 s, at 3 about every 18 s and the web is broken up most of the time.
// Knob 3: Margin. -1 to 1, opening at 0. How far over its normal flow a line may go before it heats: 0.12 at -1 (brittle, a cascade every 22 s and often a big one), 0.30 at the start, 0.78 at 1 (sturdy, a cascade every 50 s). The colour of every line changes as it turns, since the loading ratio is the flow over that rating.
// Knob 4: Storm. -1 to 1, opening at about 0.06. How often a tree falls on a random line, longer lines more often: never at -1 (only the drifting demand can still trip a line, and the operators still close what is open), about once in 12 s at the start, once in 3 s at 1.
//
// The model: a Poisson-disc scatter of about 70 nodes with the corners on it, joined by a Gabriel graph thinned to two to five lines a node. Five nodes are generators, the rest loads (3x3) and junctions (2x2). Every line has a reactance of its length. Each solve finds the islands of the closed lines, feeds an island from its own generators in proportion to their size (an island with none is dark, one with too little drops its loads furthest from a generator first), and solves the DC flow, the graph Laplacian times the angles equal to the injections, by conjugate gradients. A line is rated (1 + margin) times its flow on the whole grid at the base demand, times a spread of 0.78 to 1.4 of its own. Above its rating it heats for 0.4 to 1.5 s (faster the further over) and trips; the grid is solved again. Operators wait for a quiet moment, then close the open line nearest a generator whose closing leaves every line under its rating, and loads come back one by one only while their island has room.

const W = 64, H = 128;
const NMAX = 100, EMAX = 320, NGEN = 5;
const MARG = 3.2;                       // nodes keep this far from the panel edge
const { floor, ceil, min, max, abs, sqrt, exp, sin, cos, log, pow, hypot, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const rnd = () => Math.random();
const rr = (a, b) => a + (b - a) * rnd();
const F = (n) => new Float32Array(n), U = (n) => new Uint8Array(n), I = (n) => new Int16Array(n), D = (n) => new Float64Array(n);
const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 2;

// ---- colour ----------------------------------------------------------------
const RH = [0.52, 0.49, 0.4, 0.22, 0.12, 0.03, -0.01];       // hue of a line at these loading ratios
const RK = [0, 0.25, 0.45, 0.65, 0.8, 0.95, 1.2];

function hsv(h, s, v, o, k) {
  h -= floor(h); h *= 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  let r, g, b;
  if (i === 0) { r = v; g = t; b = p; } else if (i === 1) { r = q; g = v; b = p; } else if (i === 2) { r = p; g = v; b = t; }
  else if (i === 3) { r = p; g = q; b = v; } else if (i === 4) { r = t; g = p; b = v; } else { r = v; g = p; b = q; }
  o[k] = r; o[k + 1] = g; o[k + 2] = b;
}

// the colour of a line carrying r times what it may: teal idle, amber near the limit, a pale red-white beyond it
function rampLut(lut, k1) {
  for (let i = 0; i < 150; i++) {
    const r = i / 100;
    let j = 0;
    while (j < RK.length - 2 && r > RK[j + 1]) j++;
    const u = cl((r - RK[j]) / (RK[j + 1] - RK[j]), 0, 1);
    const h = RH[j] + (RH[j + 1] - RH[j]) * u + k1;
    const s = r < 0.9 ? 0.9 : 0.9 - (r - 0.9) * 1.1;
    hsv(h, cl(s, 0.45, 0.92), 1, lut, i * 3);
  }
}

// ---- the grid ------------------------------------------------------------------
function poisson(R) {
  const cs = R / sqrt(2), gw = floor(W / cs) + 1, gh = floor(H / cs) + 1, R2 = R * R;
  const grid = new Int16Array(gw * gh).fill(-1), pts = [], act = [];
  const fits = (x, y) => {
    if (x < MARG - 0.01 || x > W - MARG + 0.01 || y < MARG - 0.01 || y > H - MARG + 0.01) return false;
    const cx = floor(x / cs), cy = floor(y / cs);
    for (let j = max(0, cy - 2); j <= min(gh - 1, cy + 2); j++)
      for (let i = max(0, cx - 2); i <= min(gw - 1, cx + 2); i++) {
        const q = grid[j * gw + i];
        if (q >= 0) { const dx = pts[q][0] - x, dy = pts[q][1] - y; if (dx * dx + dy * dy < R2) return false; }
      }
    return true;
  };
  const add = (x, y) => { grid[floor(y / cs) * gw + floor(x / cs)] = pts.length; act.push(pts.length); pts.push([x, y]); };
  add(MARG, MARG); add(W - MARG, MARG); add(MARG, H - MARG); add(W - MARG, H - MARG);   // the corners are on the grid
  while (act.length) {
    const ai = floor(rnd() * act.length), p = pts[act[ai]];
    let hit = false;
    for (let k = 0; k < 28; k++) {
      const a = rnd() * TP, r = R * (1 + rnd() * 0.9), x = p[0] + r * cos(a), y = p[1] + r * sin(a);
      if (fits(x, y)) { add(x, y); hit = true; break; }
    }
    if (!hit) act.splice(ai, 1);
  }
  return pts;
}

function segInt(ax, ay, bx, by, cx, cy, dx, dy) {
  const o1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), o2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  const o3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), o4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

// does the line a-b cross another, or pass within 2.6 LED of a third node
function blocked(st, a, b) {
  const ax = st.nx[a], ay = st.ny[a], bx = st.nx[b], by = st.ny[b];
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  for (let e = 0; e < EMAX; e++) {
    if (!st.eex[e]) continue;
    const c = st.ea[e], d = st.eb[e];
    if (c === a || c === b || d === a || d === b) continue;
    if (segInt(ax, ay, bx, by, st.nx[c], st.ny[c], st.nx[d], st.ny[d])) return true;
  }
  for (let k = 0; k < NMAX; k++) {
    if (!st.nex[k] || k === a || k === b) continue;
    const t = cl(((st.nx[k] - ax) * dx + (st.ny[k] - ay) * dy) / l2, 0, 1);
    if (hypot(st.nx[k] - ax - t * dx, st.ny[k] - ay - t * dy) < 2.6) return true;
  }
  return false;
}

function addNode(st, x, y, type) {
  let i = 0;
  while (i < NMAX && st.nused[i]) i++;
  if (i >= NMAX) return -1;
  if (type === 1) { x = Math.round(x); y = Math.round(y); } else { x = floor(x) + 0.5; y = floor(y) + 0.5; }
  st.nx[i] = x; st.ny[i] = y; st.nused[i] = 1; st.nex[i] = 1; st.ndying[i] = 0; st.ntype[i] = type; st.nvis[i] = 0;
  st.deg[i] = 0; st.nshed[i] = 0; st.nen[i] = 1; st.nlit[i] = 1; st.nr[i] = 0;
  st.dem[i] = type === 0 ? rr(0.5, 1.6) : 0;
  st.pick[i] = 1; st.pkW[i] = 0; st.pkT[i] = rr(2.5, 6);
  st.dA1[i] = rr(0.08, 0.2); st.dF1[i] = rr(0.007, 0.031); st.dP1[i] = rnd() * TP;
  st.dA2[i] = rr(0.03, 0.08); st.dF2[i] = rr(0.043, 0.093); st.dP2[i] = rnd() * TP;
  st.gph[i] = rnd() * TP; st.gper[i] = rr(1.4, 2.4);
  if (i >= st.nn) st.nn = i + 1;
  return i;
}

function addEdge(st, a, b) {
  let e = 0;
  while (e < EMAX && st.eused[e]) e++;
  if (e >= EMAX) return -1;
  st.ea[e] = a; st.eb[e] = b; st.eused[e] = 1; st.eex[e] = 1; st.estate[e] = 0;
  st.elen[e] = hypot(st.nx[a] - st.nx[b], st.ny[a] - st.ny[b]);
  st.ebs[e] = 1 / st.elen[e];
  st.etau[e] = rr(0.4, 1.5);
  st.evar[e] = cl(exp(0.17 * gauss()), 0.78, 1.4);
  st.eheat[e] = 0; st.eglow[e] = 0; st.espk[e] = 0; st.espt[e] = 0.5; st.eprog[e] = 0;
  st.ef[e] = 0; st.efd[e] = 0; st.erat[e] = 0; st.eratD[e] = 0; st.elit[e] = 1; st.elive[e] = 1;
  st.ecyc[e] = rnd(); st.esp[e] = 12; st.evis[e] = 0; st.edying[e] = 0; st.eflk[e] = rnd() * TP;
  st.emat[a * NMAX + b] = st.emat[b * NMAX + a] = e;
  st.deg[a]++; st.deg[b]++;
  if (e >= st.ne) st.ne = e + 1;
  return e;
}

function removeEdge(st, e) {
  const a = st.ea[e], b = st.eb[e];
  st.eex[e] = 0; st.edying[e] = 1;
  st.emat[a * NMAX + b] = st.emat[b * NMAX + a] = -1;
  st.deg[a]--; st.deg[b]--;
}

function removeNode(st, v) {
  for (let e = 0; e < st.ne; e++) if (st.eex[e] && (st.ea[e] === v || st.eb[e] === v)) removeEdge(st, e);
  st.nex[v] = 0; st.ndying[v] = 1;
}

function labels(st, skip) {
  const par = st.par;
  for (let i = 0; i < st.nn; i++) par[i] = i;
  const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let e = 0; e < st.ne; e++) if (st.eex[e] && e !== skip) par[find(st.ea[e])] = find(st.eb[e]);
  let n = 0;
  for (let i = 0; i < st.nn; i++) if (st.nex[i] && find(i) === i) n++;
  for (let i = 0; i < st.nn; i++) st.comp[i] = st.nex[i] ? find(i) : -1;
  return n;
}

// every node ends with two to five lines and the grid is one piece
function repair(st) {
  for (let guard = 0; guard < 40; guard++) {
    if (labels(st, -1) <= 1) break;
    let best = 1e9, ba = -1, bb = -1;
    for (let a = 0; a < st.nn; a++) {
      if (!st.nex[a] || st.deg[a] >= 5) continue;
      for (let b = a + 1; b < st.nn; b++) {
        if (!st.nex[b] || st.deg[b] >= 5 || st.comp[a] === st.comp[b]) continue;
        const d = hypot(st.nx[a] - st.nx[b], st.ny[a] - st.ny[b]);
        if (d < best && !blocked(st, a, b)) { best = d; ba = a; bb = b; }
      }
    }
    if (ba < 0) break;
    addEdge(st, ba, bb);
  }
  for (let a = 0; a < st.nn; a++) {
    if (!st.nex[a]) continue;
    for (let pass = 0; pass < 2 && st.deg[a] < 2; pass++) {
      let best = 1e9, bb = -1;
      for (let b = 0; b < st.nn; b++) {
        if (b === a || !st.nex[b] || st.deg[b] >= 5 || st.emat[a * NMAX + b] >= 0) continue;
        const d = hypot(st.nx[a] - st.nx[b], st.ny[a] - st.ny[b]);
        if (d < best && (pass === 1 || !blocked(st, a, b))) { best = d; bb = b; }
      }
      if (bb >= 0) addEdge(st, a, bb);
    }
  }
}

function build(st) {
  let pts = [];
  for (let R = 11; R > 6; R -= 0.2) {
    pts = poisson(R);
    if (pts.length >= 68) { st.R = R; break; }
  }
  while (pts.length > 78) pts.splice(4 + floor(rnd() * (pts.length - 4)), 1);
  const n = pts.length;
  // generators: far apart, and not in a corner
  const gens = [];
  const mid = (k) => hypot(pts[k][0] - W * rr(0.35, 0.65), pts[k][1] - H * rr(0.35, 0.65));
  let g0 = 4;
  for (let k = 4; k < n; k++) if (mid(k) < mid(g0)) g0 = k;
  gens.push(g0);
  while (gens.length < NGEN) {
    let bk = -1, bd = -1;
    for (let k = 4; k < n; k++) {
      if (gens.includes(k) || pts[k][0] < 9 || pts[k][0] > W - 9 || pts[k][1] < 9 || pts[k][1] > H - 9) continue;
      let d = 1e9;
      for (const g of gens) d = min(d, hypot(pts[k][0] - pts[g][0], pts[k][1] - pts[g][1]));
      d += rnd() * 4;
      if (d > bd) { bd = d; bk = k; }
    }
    if (bk < 0) break;
    gens.push(bk);
  }
  // the web: Gabriel graph (an edge when no other node lies in the circle on it), the longest lines left out
  const cand = [];
  const lim = st.R * 2.3;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const d = hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
      if (d > lim) continue;
      const mx = (pts[i][0] + pts[j][0]) / 2, my = (pts[i][1] + pts[j][1]) / 2;
      let ok = true;
      for (let k = 0; k < n && ok; k++) if (k !== i && k !== j && hypot(pts[k][0] - mx, pts[k][1] - my) < d / 2) ok = false;
      if (ok) cand.push([d, i, j]);
    }
  cand.sort((a, b) => a[0] - b[0]);
  const rawDeg = new Int8Array(n);
  const keep = [];
  for (const [d, i, j] of cand) {
    if (rawDeg[i] >= 5 || rawDeg[j] >= 5) continue;
    rawDeg[i]++; rawDeg[j]++; keep.push([i, j]);
  }
  // the Gabriel graph of Poisson-disc points is nearly a triangulation; take out a third of it, the longer lines first,
  // so every node keeps two to five lines and the web is left with loops of four, five and six
  const target = floor(n * 1.62);
  const ord = keep.map((k) => [hypot(pts[k[0]][0] - pts[k[1]][0], pts[k[0]][1] - pts[k[1]][1]) * rr(0.55, 1.45), k]).sort((a, b) => b[0] - a[0]);
  let count = keep.length;
  const gone = new Set();
  for (const [, k] of ord) {
    if (count <= target) break;
    if (rawDeg[k[0]] <= 2 || rawDeg[k[1]] <= 2) continue;
    const par = Array.from({ length: n }, (_, i) => i);
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (const q of keep) if (q !== k && !gone.has(q)) par[find(q[0])] = find(q[1]);
    let roots = 0;
    for (let i = 0; i < n; i++) if (find(i) === i) roots++;
    if (roots !== 1) continue;
    gone.add(k); rawDeg[k[0]]--; rawDeg[k[1]]--; count--;
  }
  for (let q = keep.length - 1; q >= 0; q--) if (gone.has(keep[q])) keep.splice(q, 1);
  // junctions: small dots on some of the nodes with three or more lines
  const types = new Uint8Array(n);
  for (const g of gens) types[g] = 2;
  for (let k = 4; k < n; k++) if (!types[k] && rawDeg[k] >= 3 && rnd() < 0.2) types[k] = 1;
  for (let k = 0; k < n; k++) addNode(st, pts[k][0], pts[k][1], types[k]);
  for (const [i, j] of keep) addEdge(st, i, j);
  repair(st);
  for (let k = 0; k < st.nn; k++) st.nvis[k] = 1;
  for (let e = 0; e < st.ne; e++) st.evis[e] = 1;
  setGen(st);
  calibrate(st);
}

// the generators take the demand between them in proportion to their size; each has half as much again in reserve
function setGen(st) {
  let tot = 0, w = 0;
  for (let i = 0; i < st.nn; i++) if (st.nex[i] && st.ntype[i] === 0) tot += st.dem[i];
  for (let i = 0; i < st.nn; i++) if (st.nex[i] && st.ntype[i] === 2) { if (!st.gw[i]) st.gw[i] = rr(0.8, 1.4); w += st.gw[i]; }
  for (let i = 0; i < st.nn; i++) {
    if (!st.nex[i] || st.ntype[i] !== 2) continue;
    st.pn[i] = tot * st.gw[i] / w;
    st.gcap[i] = st.pn[i] * 1.5;
  }
}

// conjugate gradients on L th = P over the closed lines, Jacobi preconditioned
function cg(st, P, th) {
  const n = st.nn, ecl = st.ecl, nc = st.ncl, bs = st.ebs, ea = st.ea, eb = st.eb;
  const r = st.cr, z = st.cz, p = st.cp, q = st.cq, dg = st.cd;
  dg.fill(0, 0, n);
  for (let k = 0; k < nc; k++) { const e = ecl[k]; dg[ea[e]] += bs[e]; dg[eb[e]] += bs[e]; }
  let rz = 0, r0 = 0;
  for (let i = 0; i < n; i++) {
    th[i] = 0; r[i] = P[i]; z[i] = dg[i] > 0 ? r[i] / dg[i] : 0; p[i] = z[i]; rz += r[i] * z[i]; r0 += r[i] * r[i];
  }
  if (r0 < 1e-18) return;
  const tol = r0 * 1e-10;
  for (let it = 0; it < 90; it++) {
    q.fill(0, 0, n);
    for (let k = 0; k < nc; k++) { const e = ecl[k], a = ea[e], b = eb[e], d = bs[e] * (p[a] - p[b]); q[a] += d; q[b] -= d; }
    let pq = 0;
    for (let i = 0; i < n; i++) pq += p[i] * q[i];
    if (pq < 1e-30) break;
    const al = rz / pq;
    let rn = 0, rzn = 0;
    for (let i = 0; i < n; i++) { th[i] += al * p[i]; r[i] -= al * q[i]; z[i] = dg[i] > 0 ? r[i] / dg[i] : 0; rn += r[i] * r[i]; rzn += r[i] * z[i]; }
    if (rn < tol) break;
    const be = rzn / rz;
    rz = rzn;
    for (let i = 0; i < n; i++) p[i] = z[i] + be * p[i];
  }
}

// what every line carries on the whole grid at the base demand: its rating is built from that
function calibrate(st) {
  const P = st.cP, th = st.cth;
  P.fill(0);
  let k = 0;
  for (let e = 0; e < st.ne; e++) if (st.eex[e]) st.ecl[k++] = e;
  st.ncl = k;
  for (let i = 0; i < st.nn; i++) {
    if (!st.nex[i]) continue;
    if (st.ntype[i] === 0) P[i] = -st.dem[i]; else if (st.ntype[i] === 2) P[i] = st.pn[i];
  }
  cg(st, P, th);
  let sum = 0, cnt = 0;
  for (let e = 0; e < st.ne; e++) if (st.eex[e]) { st.ef0[e] = abs(st.ebs[e] * (th[st.ea[e]] - th[st.eb[e]])); sum += st.ef0[e]; cnt++; }
  st.fnorm = max(sum / max(cnt, 1), 1e-6);
  for (let e = 0; e < st.ne; e++) if (st.eex[e]) st.ebase[e] = max(st.ef0[e], 0.4 * st.fnorm) * st.evar[e];
  // distance from the nearest generator in hops, for the order the operators close lines in
  st.gd.fill(99, 0, st.nn);
  const qu = [];
  for (let i = 0; i < st.nn; i++) if (st.nex[i] && st.ntype[i] === 2) { st.gd[i] = 0; qu.push(i); }
  for (let h = 0; h < qu.length; h++) {
    const v = qu[h];
    for (let e = 0; e < st.ne; e++) {
      if (!st.eex[e]) continue;
      const o = st.ea[e] === v ? st.eb[e] : st.eb[e] === v ? st.ea[e] : -1;
      if (o >= 0 && st.gd[o] === 99) { st.gd[o] = st.gd[v] + 1; qu.push(o); }
    }
  }
}

// ---- one step of the grid ------------------------------------------------------------
const demandScale = (k2) => 0.38 + 0.19 * cl(k2, 0, 3);
const marginOf = (k3) => 0.3 * exp(0.95 * cl(k3, -1, 1));
function faultRate(k4) {
  const s = (cl(k4, -1, 1) + 1) / 2;
  return 0.02 * pow(15, s) * cl(s / 0.08, 0, 1);
}

// re-solve who carries what: islands, load shedding, dispatch, flows
function solve(st, dK, mg) {
  const n = st.nn, t = st.t;
  const gl = 1 + 0.08 * sin(TP * 0.0071 * t + st.gp0) + 0.05 * sin(TP * 0.0133 * t + st.gp1) + 0.03 * sin(TP * 0.0293 * t + st.gp2);
  const par = st.par, P = st.cP;
  for (let i = 0; i < n; i++) par[i] = i;
  const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  let k = 0;
  for (let e = 0; e < st.ne; e++) {
    if (st.eex[e] && st.estate[e] === 0) { par[find(st.ea[e])] = find(st.eb[e]); st.ecl[k++] = e; }
  }
  st.ncl = k;
  const cD = st.cD, cG = st.cG;
  cD.fill(0, 0, n); cG.fill(0, 0, n);
  for (let i = 0; i < n; i++) {
    st.comp[i] = st.nex[i] ? find(i) : -1;
    st.nshed[i] = 0;
    if (!st.nex[i]) continue;
    const r = st.comp[i];
    if (st.ntype[i] === 2) cG[r] += st.gcap[i];
    else if (st.ntype[i] === 0) {
      const d = st.pick[i] * st.dem[i] * dK * gl * (1 + st.dA1[i] * sin(TP * st.dF1[i] * t + st.dP1[i]) + st.dA2[i] * sin(TP * st.dF2[i] * t + st.dP2[i]));
      st.dd[i] = d; cD[r] += d;
    }
  }
  // an island that cannot feed its loads drops the ones furthest from its generators first
  for (let r = 0; r < n; r++) {
    if (st.comp[r] !== r || cD[r] <= 0) continue;
    if (cG[r] <= 0) {
      for (let i = 0; i < n; i++) if (st.comp[i] === r && st.ntype[i] === 0) st.nshed[i] = 1;
      cD[r] = 0;
    } else if (cD[r] > cG[r] * 0.97) {
      const ls = [];
      for (let i = 0; i < n; i++) {
        if (st.comp[i] !== r || st.ntype[i] !== 0) continue;
        let d = 1e9;
        for (let g = 0; g < n; g++) if (st.comp[g] === r && st.ntype[g] === 2) d = min(d, hypot(st.nx[i] - st.nx[g], st.ny[i] - st.ny[g]));
        ls.push([d + st.dem[i] * 0.01, i]);
      }
      ls.sort((a, b) => b[0] - a[0]);
      for (const [, i] of ls) {
        if (cD[r] <= cG[r] * 0.97) break;
        st.nshed[i] = 1; cD[r] -= st.dd[i];
      }
    }
  }
  P.fill(0, 0, n);
  for (let i = 0; i < n; i++) {
    if (!st.nex[i]) continue;
    const r = st.comp[i];
    st.nen[i] = cG[r] > 0 ? 1 : 0;
    if (st.ntype[i] === 0 && !st.nshed[i] && cG[r] > 0) P[i] = -st.dd[i];
    else if (st.ntype[i] === 2) { P[i] = cD[r] * st.gcap[i] / cG[r]; st.gutil[i] = cD[r] / cG[r]; }
  }
  cg(st, P, st.cth);
  const th = st.cth;
  for (let e = 0; e < st.ne; e++) {
    if (!st.eex[e]) continue;
    if (st.estate[e] === 0) {
      st.ef[e] = st.ebs[e] * (th[st.ea[e]] - th[st.eb[e]]);
      st.elive[e] = cG[st.comp[st.ea[e]]] > 0 ? 1 : 0;
    } else { st.ef[e] = 0; st.elive[e] = 0; }
  }
  // load comes back only while the island has room: its lines under 0.9 of their rating and its generators under 0.9 of theirs
  const cm = st.cm;
  cm.fill(0, 0, n);
  for (let e = 0; e < st.ne; e++) if (st.eex[e] && st.estate[e] === 0) { const c = st.comp[st.ea[e]], r = abs(st.ef[e]) / (st.ebase[e] * mg); if (r > cm[c]) cm[c] = r; }
  for (let i = 0; i < n; i++) st.cok[i] = st.nex[i] && cm[st.comp[i]] < 0.9 && cD[st.comp[i]] < 0.9 * cG[st.comp[i]] ? 1 : 0;
}

function trip(st, e, fault) {
  st.estate[e] = 1; st.eheat[e] = 0; st.eglow[e] = 1; st.espk[e] = 1;
  st.espt[e] = fault ? rr(0.25, 0.75) : rr(0.4, 0.6);
  st.ef[e] = 0; st.elive[e] = 0;
  st.lastTrip = st.t; st.rHold = st.t + (fault ? rr(2, 3.5) : rr(2.2, 4.5));
  st.nTrip++; st.dirty = true;
  if (fault) st.nFault++;
}

function randomFault(st) {
  let tot = 0;
  for (let e = 0; e < st.ne; e++) if (st.eex[e] && st.estate[e] === 0 && st.elive[e]) tot += st.elen[e];
  if (tot <= 0) return;
  let u = rnd() * tot;
  for (let e = 0; e < st.ne; e++) {
    if (!(st.eex[e] && st.estate[e] === 0 && st.elive[e])) continue;
    u -= st.elen[e];
    if (u <= 0) { trip(st, e, true); return; }
  }
}

// a node is retired where it stands and another grows where the web has a gap, now and then a line is moved
function relocate(st) {
  const cands = [];
  for (let i = 0; i < st.nn; i++) if (st.nex[i] && st.ntype[i] !== 2 && st.deg[i] <= 4 && st.nvis[i] >= 1) cands.push(i);
  if (!cands.length) return;
  const v = cands[floor(rnd() * cands.length)], type = st.ntype[v], vx = st.nx[v], vy = st.ny[v];
  removeNode(st, v);
  let bx = -1, by = -1, bd = -1;
  for (let k = 0; k < 90; k++) {
    const x = rr(MARG, W - MARG), y = rr(MARG, H - MARG);
    let d = hypot(x - vx, y - vy) < 12 ? 0 : 1e9;
    for (let i = 0; i < st.nn && d > 0; i++) if (st.nex[i]) d = min(d, hypot(x - st.nx[i], y - st.ny[i]));
    if (d > bd) { bd = d; bx = x; by = y; }
  }
  const nv = addNode(st, bx, by, type);
  if (nv < 0) { repair(st); return; }
  const near = [];
  for (let i = 0; i < st.nn; i++) if (st.nex[i] && i !== nv && st.deg[i] < 5) near.push([hypot(st.nx[i] - st.nx[nv], st.ny[i] - st.ny[nv]), i]);
  near.sort((a, b) => a[0] - b[0]);
  let made = 0;
  for (let k = 0; k < near.length && k < 7 && made < 3; k++) {
    if (near[k][0] > st.R * 2.1 && made >= 2) break;
    if (!blocked(st, nv, near[k][1])) { addEdge(st, nv, near[k][1]); made++; }
  }
  repair(st);
  settle(st);
}

function rewire(st) {
  for (let tries = 0; tries < 30; tries++) {
    const e = floor(rnd() * st.ne);
    if (!st.eex[e] || st.evis[e] < 1) continue;
    const a = st.ea[e], b = st.eb[e];
    if (st.deg[a] < 3 || st.deg[b] < 3) continue;
    if (labels(st, e) !== 1) continue;
    const opts = [];
    for (let i = 0; i < st.nn; i++) {
      if (!st.nex[i] || st.deg[i] >= 5) continue;
      for (let j = i + 1; j < st.nn; j++) {
        if (!st.nex[j] || st.deg[j] >= 5 || st.emat[i * NMAX + j] >= 0 || (i === a && j === b)) continue;
        const d = hypot(st.nx[i] - st.nx[j], st.ny[i] - st.ny[j]);
        if (d < st.R * 1.9 && d > st.R * 0.9) opts.push([d, i, j]);
      }
    }
    for (let k = opts.length - 1; k > 0; k--) { const j = floor(rnd() * (k + 1)); const t = opts[k]; opts[k] = opts[j]; opts[j] = t; }
    removeEdge(st, e);
    let done = false;
    for (let k = 0; k < opts.length && k < 40 && !done; k++) if (!blocked(st, opts[k][1], opts[k][2])) { addEdge(st, opts[k][1], opts[k][2]); done = true; }
    if (!done) { st.eex[e] = 1; st.edying[e] = 0; st.emat[a * NMAX + b] = st.emat[b * NMAX + a] = e; st.deg[a]++; st.deg[b]++; continue; }
    settle(st);
    return;
  }
}

function settle(st) {
  setGen(st);
  calibrate(st);
  st.dirty = true;
}

function step(st, dt, ks) {
  const t = (st.t += dt);
  const dK = demandScale(ks[1]), mg = 1 + marginOf(ks[2]);
  st.solveT -= dt;
  if (st.dirty || st.solveT <= 0) { solve(st, dK, mg); st.dirty = false; st.solveT = 0.25; }

  const ae = 1 - exp(-dt / 0.12), af = 1 - exp(-dt / 0.3), al = 1 - exp(-dt / 0.18);
  let heatMax = 0, nOut = 0, nClosing = 0;
  for (let e = 0; e < st.ne; e++) {
    if (!st.eused[e]) continue;
    if (st.edying[e]) { st.evis[e] -= dt / 1.4; if (st.evis[e] <= 0) { st.eused[e] = 0; st.edying[e] = 0; } continue; }
    if (st.evis[e] < 1) st.evis[e] = min(1, st.evis[e] + dt / 1.6);
    const state = st.estate[e];
    let r = 0;
    if (state === 0) r = abs(st.ef[e]) / (st.ebase[e] * mg);
    st.erat[e] = r;
    st.eratD[e] += (r - st.eratD[e]) * ae;
    st.efd[e] += (st.ef[e] - st.efd[e]) * af;
    st.elit[e] += (st.elive[e] - st.elit[e]) * al;
    st.eglow[e] *= exp(-dt / 0.42);
    st.espk[e] *= exp(-dt / 0.33);
    if (state === 0) {
      if (st.elive[e] && r > 1) {
        st.eheat[e] += dt / st.etau[e] * cl(0.5 + 8 * (r - 1), 0.5, 2);
        if (st.eheat[e] >= 1) trip(st, e, false);
      } else st.eheat[e] = max(0, st.eheat[e] - dt / 1.1);
      if (st.eheat[e] > heatMax) heatMax = st.eheat[e];
    } else if (state === 1) nOut++;
    else {
      nClosing++;
      st.eprog[e] += dt / 0.5;
      if (st.eprog[e] >= 1) { st.estate[e] = 0; st.eprog[e] = 0; st.eheat[e] = 0; st.dirty = true; }
    }
    // pulses run with the flow, closer together and faster the more it carries
    const fa = abs(st.efd[e]) / st.fnorm;
    const sp = cl(19 / (0.45 + 0.9 * fa), 6.5, 28);
    st.esp[e] = sp;
    st.ecyc[e] += (st.efd[e] >= 0 ? 1 : -1) * (2 + 10 * fa) / sp * dt;
    st.ecyc[e] -= floor(st.ecyc[e]);
  }
  for (let i = 0; i < st.nn; i++) {
    if (!st.nused[i]) continue;
    if (st.ndying[i]) { st.nvis[i] -= dt / 1.4; if (st.nvis[i] <= 0) { st.nused[i] = 0; st.ndying[i] = 0; } continue; }
    if (st.nvis[i] < 1) st.nvis[i] = min(1, st.nvis[i] + dt / 1.6);
    if (st.ntype[i] === 0) {
      if (!st.nen[i] || st.nshed[i]) { st.pick[i] = 0; st.pkW[i] = rr(0.2, 3.2); }
      else if (st.cok[st.comp[i]]) { if (st.pkW[i] > 0) st.pkW[i] -= dt; else st.pick[i] = min(1, st.pick[i] + dt / st.pkT[i]); }
    }
    const tgt = st.nen[i] && (st.ntype[i] !== 0 || st.pick[i] > 0.02) ? 1 : 0;
    st.nlit[i] += (tgt - st.nlit[i]) * al;
    st.gph[i] += TP * dt / st.gper[i];
    st.nr[i] = 0;
  }
  for (let e = 0; e < st.ne; e++) {
    if (!st.eex[e] || st.estate[e] !== 0 || !st.elive[e]) continue;
    const v = st.eratD[e];
    if (v > st.nr[st.ea[e]]) st.nr[st.ea[e]] = v;
    if (v > st.nr[st.eb[e]]) st.nr[st.eb[e]] = v;
  }

  // random faults: a tree falls on a line, longer lines more often
  const lam = faultRate(ks[3]);
  st.fAcc += lam * dt;
  if (st.fAcc >= st.fThr) { st.fAcc = 0; st.fThr = -log(max(rnd(), 1e-4)); randomFault(st); }

  // the operators close what is open: after a quiet moment, one line every 0.5 to 2 s, nearest the generators first,
  // and each closing is tried on paper first, so a line that would overload its neighbours waits
  st.rTimer -= dt;
  if (nOut > 0 && st.rTimer <= 0 && t >= st.rHold - min(2.5, nOut * 0.2) && heatMax < 0.35) {
    const cs = [];
    for (let e = 0; e < st.ne; e++) {
      if (!st.eex[e] || st.estate[e] !== 1) continue;
      cs.push([min(st.gd[st.ea[e]], st.gd[st.eb[e]]) + rnd() * 0.9, e]);
    }
    cs.sort((a, b) => a[0] - b[0]);
    let pick = -1, bestR = 1e9;
    for (let k = 0; k < cs.length && k < 4; k++) {
      const e = cs[k][1];
      st.estate[e] = 0;
      solve(st, dK, mg);
      let worst = 0;
      for (let q = 0; q < st.ne; q++) if (st.eex[q] && st.estate[q] === 0 && st.elive[q]) worst = max(worst, abs(st.ef[q]) / (st.ebase[q] * mg));
      st.estate[e] = 1;
      if (worst < bestR) { bestR = worst; pick = e; }
      if (worst < 0.97) break;
    }
    solve(st, dK, mg);
    if (pick >= 0 && (bestR < 1 || t - st.rHold > 5)) { st.estate[pick] = 2; st.eprog[pick] = 0; st.rTimer = rr(0.5, 2) / (1 + nOut / 14); }
    else st.rTimer = 1;
  }

  // the web grows and rewires itself, only while it is whole and quiet
  if (nOut === 0 && nClosing === 0 && heatMax < 0.2) {
    st.lyT -= dt;
    if (st.lyT <= 0) { if (rnd() < 0.62) relocate(st); else rewire(st); st.lyT = rr(9, 22); }
  }
}

export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, t: 0,
    nn: 0, ne: 0, R: 9,
    nx: F(NMAX), ny: F(NMAX), nused: U(NMAX), nex: U(NMAX),
    ndying: U(NMAX), ntype: U(NMAX), nvis: F(NMAX), nlit: F(NMAX),
    nr: F(NMAX), nshed: U(NMAX), nen: U(NMAX), dem: F(NMAX),
    dd: F(NMAX), pick: F(NMAX), pkW: F(NMAX), pkT: F(NMAX), cok: U(NMAX), gcap: F(NMAX), pn: F(NMAX), gw: F(NMAX),
    gutil: F(NMAX), gph: F(NMAX), gper: F(NMAX), deg: new Int8Array(NMAX),
    comp: I(NMAX), par: I(NMAX), gd: I(NMAX),
    dA1: F(NMAX), dF1: F(NMAX), dP1: F(NMAX),
    dA2: F(NMAX), dF2: F(NMAX), dP2: F(NMAX),
    ea: I(EMAX), eb: I(EMAX), eused: U(EMAX), eex: U(EMAX),
    edying: U(EMAX), estate: U(EMAX), elive: U(EMAX),
    elen: F(EMAX), ebs: F(EMAX), etau: F(EMAX), evar: F(EMAX),
    ebase: F(EMAX), ef0: F(EMAX), ef: F(EMAX), efd: F(EMAX),
    erat: F(EMAX), eratD: F(EMAX), eheat: F(EMAX), eglow: F(EMAX),
    espk: F(EMAX), espt: F(EMAX), elit: F(EMAX), ecyc: F(EMAX),
    esp: F(EMAX), eprog: F(EMAX), evis: F(EMAX), eflk: F(EMAX),
    emat: new Int16Array(NMAX * NMAX).fill(-1), ecl: I(EMAX), ncl: 0,
    cP: D(NMAX), cth: D(NMAX), cr: D(NMAX), cz: D(NMAX),
    cm: D(NMAX), cp: D(NMAX), cq: D(NMAX), cd: D(NMAX), cD: D(NMAX), cG: D(NMAX),
    fnorm: 1, dirty: true, solveT: 0, lastTrip: -99, rHold: 0, rTimer: 1, lyT: 14, nTrip: 0, nFault: 0,
    fAcc: 0, fThr: -log(rnd()), gp0: rnd() * TP, gp1: rnd() * TP, gp2: rnd() * TP,
    buf: F(W * H * 3), lut: F(150 * 3), tmp: [0, 0, 0],
  });
  build(st);
  return st;
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    // the grid has been running for a while: faults have come and gone, some lines are still open
    for (let n = 0; n < 1500; n++) step(st, 0.05, st.ks);
    const open = () => { let c = 0; for (let e = 0; e < st.ne; e++) if (st.eex[e] && st.estate[e] === 1) c++; return c; };
    for (let n = 0; n < 900 && open() === 0; n++) step(st, 0.05, st.ks);
    for (let e = 0; e < st.ne; e++) if (st.eused[e]) { st.eratD[e] = st.erat[e]; st.efd[e] = st.ef[e]; st.elit[e] = st.elive[e]; }
  } else {
    const a = 1 - exp(-dt / 0.15);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  }
  if (dt > 0) step(st, dt, st.ks);
}

// ---- drawing -----------------------------------------------------------------------------
function drawEdge(st, e, buf, lut) {
  const a = st.ea[e], b = st.eb[e];
  const ax = st.nx[a], ay = st.ny[a], bx = st.nx[b], by = st.ny[b];
  const dx = bx - ax, dy = by - ay, len = st.elen[e], l2 = dx * dx + dy * dy;
  const vis = st.evis[e], state = st.estate[e], t = st.t;
  const lit = st.elit[e];
  const wl = state === 0 ? lit * vis : 0;                                       // the lit line
  const wg = state === 0 ? (1 - lit) * vis : vis;                                // the ghost of it
  const stub = state !== 0;
  let lr = 0, lg = 0, lb = 0, li = 0, hot = 0, pAmp = 0, pr = 0, pg = 0, pb = 0, hw = 0;
  if (wl > 0.01) {
    const rt = cl(st.eratD[e], 0, 1.45);
    const k = floor(rt * 100) * 3;
    hot = st.eheat[e];
    hw = hot * hot * 0.9;
    lr = lut[k] + (1 - lut[k]) * hw; lg = lut[k + 1] + (1 - lut[k + 1]) * hw; lb = lut[k + 2] + (1 - lut[k + 2]) * hw;
    li = 0.27 + 0.5 * min(rt, 1.1) + 0.2 * hot;
    if (hot > 0.04) li *= 1 - 0.28 * hot * (0.5 + 0.5 * sin(t * (14 + 7 * hot) + st.eflk[e]) * sin(t * 5.3 + st.eflk[e] * 2.1));
    const fa = abs(st.efd[e]) / st.fnorm;
    pAmp = cl(fa * 6, 0, 1) * 1.05;
    pr = lr + (1 - lr) * 0.78; pg = lg + (1 - lg) * 0.78; pb = lb + (1 - lb) * 0.78;
  }
  const ag = st.eglow[e] * vis;
  let agr = 0, agg = 0, agb = 0;
  if (ag > 0.02) {
    const k = 90 * 3, w = 0.25 + 0.75 * ag * ag, q = pow(ag, 1.5) / ag;
    agr = (lut[k] + (1 - lut[k]) * w) * q; agg = (lut[k + 1] + (1 - lut[k + 1]) * w) * q; agb = (lut[k + 2] + (1 - lut[k + 2]) * w) * q;
  }
  const closing = state === 2 ? st.eprog[e] * len * 0.5 : -1;
  const gapIn = stub ? max(1.8, (len - cl(len * 0.4, 3.6, 6.2)) / 2) : 0;       // the ghost stubs end here, the gap is in between
  const flip = st.efd[e] < 0;
  const sp = st.esp[e], cyc = st.ecyc[e];
  const x0 = max(0, floor(min(ax, bx) - 3.4)), x1 = min(W - 1, ceil(max(ax, bx) + 3.4));
  const y0 = max(0, floor(min(ay, by) - 3.4)), y1 = min(H - 1, ceil(max(ay, by) + 3.4));
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const tt = cl(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
      const qx = px - ax - tt * dx, qy = py - ay - tt * dy, d2 = qx * qx + qy * qy;
      if (d2 > 11.5) continue;
      const d = sqrt(d2);
      const core = cl((1.45 - d) / 0.9, 0, 1);
      const o = (y * W + x) * 3;
      const s = tt * len;
      if (wl > 0.01) {
        const cov = 0.78 * core + 0.22 * exp(-d2 / 5) * (1 + hot);
        let v = wl * li * cov;
        let pv = 0;
        if (pAmp > 0.02) {
          const su = flip ? len - s : s;
          let fr = su / sp - cyc;
          fr -= floor(fr);
          if (fr > 0.5) fr -= 1;
          const dp = fr * sp;
          pv = wl * pAmp * exp(-dp * dp * 0.45) * cl((1.9 - d) / 0.9, 0, 1);
        }
        buf[o] += lr * v + pr * pv; buf[o + 1] += lg * v + pg * pv; buf[o + 2] += lb * v + pb * pv;
      }
      if (wg > 0.01 && core > 0) {
        let gm = 1;
        if (stub) {
          const m = min(s, len - s);
          gm = cl((gapIn - m) / 0.7 + 0.5, 0, 1);
        }
        if (gm > 0) {
          const v = wg * gm * core;
          buf[o] += 0.13 * v; buf[o + 1] += 0.19 * v; buf[o + 2] += 0.29 * v;
        }
      }
      if (ag > 0.02) {
        const v = ag * (0.85 * core + 0.3 * exp(-d2 / 5));
        buf[o] += agr * v; buf[o + 1] += agg * v; buf[o + 2] += agb * v;
      }
      if (closing >= 0 && core > 0) {
        const m = min(s, len - s);
        if (m < closing) { const v = 0.85 * core * (1 - 0.3 * (m / max(closing, 1))); buf[o] += 0.75 * v; buf[o + 1] += 0.95 * v; buf[o + 2] += 0.9 * v; }
      }
    }
  }
}

// a soft disc; mix 0 adds its light, mix 1 paints over what is there
function blob(buf, cx, cy, rad, soft, r, g, b, k, mix) {
  const x0 = max(0, floor(cx - rad - soft)), x1 = min(W - 1, ceil(cx + rad + soft));
  const y0 = max(0, floor(cy - rad - soft)), y1 = min(H - 1, ceil(cy + rad + soft));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const d = hypot(x + 0.5 - cx, y + 0.5 - cy);
      const c = cl((rad + soft - d) / soft, 0, 1);
      if (c <= 0) continue;
      const o = (y * W + x) * 3, keep = 1 - mix * c;
      buf[o] = buf[o] * keep + r * c * k; buf[o + 1] = buf[o + 1] * keep + g * c * k; buf[o + 2] = buf[o + 2] * keep + b * c * k;
    }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  const buf = st.buf, lut = st.lut, k1 = st.ks[0];
  buf.fill(0);
  rampLut(lut, k1);
  for (let e = 0; e < st.ne; e++) if (st.eused[e] && st.evis[e] > 0.01) drawEdge(st, e, buf, lut);
  // sparks where a line has just let go
  for (let e = 0; e < st.ne; e++) {
    const sk = st.espk[e];
    if (!st.eused[e] || sk < 0.03) continue;
    const a = st.ea[e], b = st.eb[e], u = st.espt[e];
    const cx = st.nx[a] + (st.nx[b] - st.nx[a]) * u, cy = st.ny[a] + (st.ny[b] - st.ny[a]) * u;
    blob(buf, cx, cy, 0.9 + 1.6 * (1 - sk), 1.2, 1, 0.95, 0.85, pow(sk, 1.4), 0);
  }
  // nodes
  const hc = [0, 0, 0];
  for (let i = 0; i < st.nn; i++) {
    if (!st.nused[i] || st.nvis[i] < 0.02) continue;
    const vis = st.nvis[i], lit = st.nlit[i], x = st.nx[i], y = st.ny[i], type = st.ntype[i];
    if (type === 2) {
      // a generator: a 5x5 disc that breathes, brighter the harder it works, and a ring that leaves it now and then
      const pu = 0.5 + 0.5 * sin(st.gph[i]);
      const k = floor(0.74 * 100) * 3;
      const util = cl(st.gutil[i], 0, 1.3);
      const br = (0.7 + 0.2 * pu + 0.12 * util) * vis;
      const ph = (st.gph[i] / TP) % 1, rg = 3.4 + 4.2 * ph;
      const dr = cl(1 - ph, 0, 1);
      for (let yy = max(0, floor(y - rg - 2)); yy <= min(H - 1, ceil(y + rg + 2)); yy++)
        for (let xx = max(0, floor(x - rg - 2)); xx <= min(W - 1, ceil(x + rg + 2)); xx++) {
          const c = cl(1 - abs(hypot(xx + 0.5 - x, yy + 0.5 - y) - rg) / 1.1, 0, 1) * 0.42 * dr * dr * vis;
          if (c <= 0) continue;
          const o = (yy * W + xx) * 3;
          buf[o] += 0.75 * c; buf[o + 1] += 0.9 * c; buf[o + 2] += c;
        }
      blob(buf, x, y, 2.25 + 0.3 * pu, 0.8, lut[k] * 0.4 + 0.6, lut[k + 1] * 0.4 + 0.6, lut[k + 2] * 0.4 + 0.6, br, 0.85);
      continue;
    }
    const rt = cl(st.nr[i], 0, 1.45), k = floor(rt * 100) * 3;
    const pv = 0.4 + 0.6 * st.pick[i], wh = 0.22;
    hc[0] = (lut[k] * (1 - wh) + wh) * pv; hc[1] = (lut[k + 1] * (1 - wh) + wh) * pv; hc[2] = (lut[k + 2] * (1 - wh) + wh) * pv;
    const gr = (1 - lit) * vis, lv = lit * vis;
    if (type === 0) {
      const ix = floor(x) - 1, iy = floor(y) - 1;
      for (let yy = iy; yy < iy + 3; yy++)
        for (let xx = ix; xx < ix + 3; xx++) {
          if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
          const o = (yy * W + xx) * 3, kp = 0.3 + 0.7 * gr;
          buf[o] = buf[o] * kp + hc[0] * 0.8 * lv + 0.14 * gr; buf[o + 1] = buf[o + 1] * kp + hc[1] * 0.8 * lv + 0.2 * gr; buf[o + 2] = buf[o + 2] * kp + hc[2] * 0.8 * lv + 0.3 * gr;
        }
    } else {
      const ix = Math.round(x) - 1, iy = Math.round(y) - 1;
      for (let yy = iy; yy < iy + 2; yy++)
        for (let xx = ix; xx < ix + 2; xx++) {
          if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
          const o = (yy * W + xx) * 3, kp = 0.3 + 0.7 * gr;
          buf[o] = buf[o] * kp + hc[0] * 0.78 * lv + 0.14 * gr; buf[o + 1] = buf[o + 1] * kp + hc[1] * 0.78 * lv + 0.2 * gr; buf[o + 2] = buf[o + 2] * kp + hc[2] * 0.78 * lv + 0.3 * gr;
        }
    }
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) {
      const r = buf[o], g = buf[o + 1], b = buf[o + 2];
      display.setPixel(x, y, (r >= 1 ? 255 : r * 255 + 0.5) | 0, (g >= 1 ? 255 : g * 255 + 0.5) | 0, (b >= 1 ? 255 : b * 255 + 0.5) | 0);
    }
}
