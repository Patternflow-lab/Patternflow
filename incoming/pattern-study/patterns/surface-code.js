// ===== Patternflow pattern =====
// Title:   Surface Code
// Family:  surfacecode
// Idea:    A rotated surface code stands as a field of dim diamond stabilizer plaquettes in two alternating hues with a data qubit at every corner, while errors land on qubits as blooming rings, light the plaquettes beside them into bright defects, grow and hop along lattice edges, and a decoder pairs the defects by the shortest chains, draws glowing lines between them and sweeps the code clean; now and then a correction closes the wrong way, crosses the whole lattice, and a slow wide wave in a third colour resets everything to calm.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the surface code (Alexei Kitaev's toric code, 1997; the planar and rotated layouts of Bravyi and Kitaev 1998 and Fowler, Mariantoni, Martinis and Cleland 2012) decoded by minimum-weight perfect matching (Dennis, Kitaev, Landahl and Preskill 2002), all from memory; the checkerboard of the two stabilizer types on a diamond lattice, the unsynchronised per-cluster decoder with its patience, the hopping defects, the cut-parity test that raises a logical error and the wave that resets the code are original, pattern round 252
// Round:   254
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Storm=0..4, Distance=-1..1, Patience=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel together; it opens on grey-teal and violet plaquettes with gold and rose errors and a green logical wave.
// Knob 2: Storm. 0 to 4, opening at 2. The physical error rate: at 0 only a few errors are ever alive and the code is nearly quiet, at 2 two or three clusters are alive at any time, at 4 errors fall in a storm, chains hop and grow, and logical failures come every few seconds.
// Knob 3: Distance. -1 to 1, opening at 0. The size of the lattice: the diamonds shrink smoothly from about 16 LED across, four over the width, to about 7 LED, ten over the width, and the code grows with them; errors already there stay on their qubits.
// Knob 4: Patience. -1 to 1, opening at about 0.06. How many measurement rounds a cluster of defects may wait before the decoder acts on it, from about one round to seven; the longer it waits the longer the chains grow and the more often the correction fails.

// Sites sit on a grid of points (m, n) a pitch apart: even points (m + n even) are data qubits, odd points are the
// plaquettes, diamonds that tile the plane. A plaquette in an even row is a Z check (violet) and flips under X
// errors; in an odd row it is an X check (teal) and flips under Z errors. A qubit touches two of each, and
// neighbouring rows alternate in colour: the checkerboard of the papers turned through 45 degrees. The code ends
// where the lattice ends, just beyond the panel edge: X chains end freely at the left and right, Z chains at the
// top and bottom.
const W = 64, H = 128;
const MM = 12, NN = 22, WD = 2 * MM + 1, HT = 2 * NN + 1, NS = WD * HT;
const { floor, min, max, abs, sqrt, exp, log, sin, cos, pow, round, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const rnd = () => Math.random();
const IM = new Int8Array(NS), IN = new Int8Array(NS);
for (let i = 0; i < NS; i++) { IM[i] = (i % WD) - MM; IN[i] = floor(i / WD) - NN; }
const idx = (m, n) => (m + MM) + (n + NN) * WD;
const DM = [1, -1, 0, 0], DN = [0, 0, 1, -1];

const PITCH = 5.2, PITCH_BASE = 1.56;          // LED between neighbouring points at Distance = 0, and the factor per unit of the knob
const LINK = 3;                                // defects this many hops apart or fewer are decoded together
const HUE0 = 0.5;                              // teal at Hue = 0
const HX = 0.0, HZ = 0.26, HERX = 0.62, HERZ = 0.43, HLOG = 0.80;   // hue offsets of X plaquette, Z plaquette, X error, Z error, logical wave
const hv = [0, 0, 0];
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const ph = [];
  for (let i = 0; i < 12; i++) ph.push(rnd() * TP);
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, time: 0,
    a: PITCH, Mh: 8, Nh: 14, ql: [], pl: [], ph,
    errX: new Uint8Array(NS), errZ: new Uint8Array(NS), par: new Uint8Array(NS), syn: new Uint8Array(NS),
    age: new Float32Array(NS), pat: new Float32Array(NS), lock: new Int32Array(NS),
    glow: new Float32Array(NS), flash: new Float32Array(NS), dir: new Int8Array(NS).fill(-1), tone: new Float32Array(NS),
    uf: new Int32Array(NS), first: new Int32Array(NS).fill(-1), flag: new Uint8Array(NS), cutp: new Uint8Array(NS),
    rings: new Map(), jobs: [], hops: [], nb: new Int32Array(4), jobId: 1,
    tickT: 0.4, errT: 0.2, calm: 0, floorT: 0, lg: null, nerr: 0,
    buf: new Float32Array(W * H * 3), add: new Float32Array(W * H * 3), qd: new Float32Array(NS * 2),
    P: 2.6, lam: 1, hop: 0.3,
  });
  for (let i = 0; i < NS; i++) st.tone[i] = (rnd() + rnd() + rnd() - 1.5) * 1.1;
  fitGrid(st, true);
  return st;
}

// the lattice window: the first even column and row at or beyond the panel edge
function fitGrid(st, force) {
  const nx = 32 / st.a, ny = 64 / st.a;
  let Mh = st.Mh, Nh = st.Nh;
  if (force || Mh < nx || Mh - 2 >= nx + 0.3) Mh = min(MM - (MM & 1), 2 * Math.ceil(nx / 2));
  if (force || Nh < ny || Nh - 2 >= ny + 0.3) Nh = min(NN - (NN & 1), 2 * Math.ceil(ny / 2));
  if (!force && Mh === st.Mh && Nh === st.Nh) return;
  st.Mh = Mh; st.Nh = Nh;
  st.ql.length = 0; st.pl.length = 0;
  for (let n = -Nh; n <= Nh; n++) for (let m = -Mh; m <= Mh; m++) ((m + n) & 1 ? st.pl : st.ql).push(idx(m, n));
  // forget what now lies outside and cancel every job
  for (let i = 0; i < NS; i++) {
    if (abs(IM[i]) <= Mh && abs(IN[i]) <= Nh) continue;
    st.errX[i] = 0; st.errZ[i] = 0; st.par[i] = 0; st.syn[i] = 0; st.lock[i] = 0; st.glow[i] = 0; st.flash[i] = 0;
  }
  for (const [key, r] of st.rings) if (abs(IM[r.q]) > Mh || abs(IN[r.q]) > Nh) st.rings.delete(key);
  for (const j of st.jobs) j.cancel = true;
  for (let i = 0; i < NS; i++) st.lock[i] = 0;
  st.hops.length = 0;
  rebuildPar(st);
}

function rebuildPar(st) {
  st.par.fill(0); st.nerr = 0;
  for (const q of st.ql) for (let t = 0; t < 2; t++) {
    if (!(t ? st.errZ : st.errX)[q]) continue;
    st.nerr++;
    const c = qNbrs(st, IM[q], IN[q], t, st.nb);
    for (let i = 0; i < c; i++) st.par[st.nb[i]] ^= 1;
  }
}

// the plaquettes of type t (0: even row, Z check; 1: odd row, X check) that touch qubit (m, n)
function qNbrs(st, m, n, t, out) {
  let c = 0;
  for (let d = 0; d < 4; d++) {
    const pm = m + DM[d], pn = n + DN[d];
    if ((pn & 1) !== t || abs(pm) > st.Mh || abs(pn) > st.Nh) continue;
    out[c++] = idx(pm, pn);
  }
  return c;
}

// flip the error of type t (0: X, 1: Z) on qubit q; silent flips make no ring
function flipErr(st, q, t, silent) {
  const E = t ? st.errZ : st.errX;
  E[q] ^= 1;
  const c = qNbrs(st, IM[q], IN[q], t, st.nb);
  for (let i = 0; i < c; i++) st.par[st.nb[i]] ^= 1;
  const key = q * 2 + t;
  if (E[q]) {
    st.nerr++;
    if (!silent) st.rings.set(key, { q, t, age: 0, dead: -1, lvl: 0 });
  } else {
    st.nerr--;
    const r = st.rings.get(key);
    if (r && r.dead < 0) r.dead = 0;
  }
}

function lockedNear(st, q, t) {
  const c = qNbrs(st, IM[q], IN[q], t, st.nb);
  for (let i = 0; i < c; i++) if (st.lock[st.nb[i]]) return true;
  return false;
}

// an error lands on a random visible qubit: X, Z or both (Y)
function landError(st) {
  for (let tries = 0; tries < 40; tries++) {
    const m = ((rnd() * (2 * st.Mh + 1)) | 0) - st.Mh, n = ((rnd() * (2 * st.Nh + 1)) | 0) - st.Nh;
    if ((m + n) & 1) continue;
    const x = 32 + m * st.a, y = 64 + n * st.a;
    if (x < 2 || x > 62 || y < 2 || y > 126) continue;
    if (st.lg && lgCoord(st.lg, x, y) > lgFront(st.lg) - 0.3) continue;
    const q = idx(m, n), r = rnd(), wx = r < 0.4 || r > 0.8, wz = r >= 0.4;
    if ((wx && lockedNear(st, q, 0)) || (wz && lockedNear(st, q, 1))) continue;
    if (wx) flipErr(st, q, 0, false);
    if (wz) flipErr(st, q, 1, false);
    return;
  }
}

// every cluster of errors (qubits that share a plaquette) with no defect left is a loop or a chain from boundary to
// boundary: it is removed, and if it crosses the cut an odd number of times it is a logical error
function cleanup(st) {
  let logical = -1;
  for (let t = 0; t < 2; t++) {
    const E = t ? st.errZ : st.errX, list = [], touched = [];
    for (const q of st.ql) if (E[q]) list.push(q);
    if (!list.length) continue;
    const uf = st.uf, first = st.first, flag = st.flag, cutp = st.cutp;
    const find = (a) => { while (uf[a] !== a) { uf[a] = uf[uf[a]]; a = uf[a]; } return a; };
    for (const q of list) { uf[q] = q; flag[q] = 0; cutp[q] = 0; }
    for (const q of list) {
      const c = qNbrs(st, IM[q], IN[q], t, st.nb);
      for (let i = 0; i < c; i++) {
        const p = st.nb[i];
        if (first[p] < 0) { first[p] = q; touched.push(p); } else { const a = find(q), b = find(first[p]); if (a !== b) uf[a] = b; }
      }
    }
    for (const q of list) {
      const r = find(q), c = qNbrs(st, IM[q], IN[q], t, st.nb);
      for (let i = 0; i < c; i++) if (st.par[st.nb[i]]) flag[r] = 1;
      if (t === 0 ? IM[q] === 0 && !(IN[q] & 1) : IN[q] === 0 && !(IM[q] & 1)) cutp[r] ^= 1;
    }
    const kill = [];
    for (const q of list) { const r = find(q); if (!flag[r]) { kill.push(q); if (cutp[r]) logical = t; } }
    for (const q of kill) flipErr(st, q, t, false);
    for (const p of touched) first[p] = -1;
  }
  return logical;
}

// ---- the decoder ----
function matchDefects(st, ds, t) {
  const k = ds.length, mm = [], nn = [], bc = [], bs = [];
  for (let i = 0; i < k; i++) {
    mm.push(IM[ds[i]]); nn.push(IN[ds[i]]);
    const lo = t === 0 ? (mm[i] + st.Mh + 1) / 2 : (nn[i] + st.Nh + 1) / 2, hi = t === 0 ? (st.Mh - mm[i] + 1) / 2 : (st.Nh - nn[i] + 1) / 2;
    const side = lo === hi ? (rnd() < 0.5 ? 0 : 1) : lo < hi ? 0 : 1;
    bc.push(min(lo, hi) + 0.001 * rnd()); bs.push(side);
  }
  const D = (i, j) => (abs(mm[i] - mm[j]) + abs(nn[i] - nn[j])) / 2 + 0.001 * rnd();
  const pairs = [];
  if (k <= 11) {
    const N = 1 << k, f = new Float64Array(N), ch = new Int8Array(N);
    for (let mask = 1; mask < N; mask++) {
      let i = 0; while (!(mask & (1 << i))) i++;
      const rest = mask ^ (1 << i);
      let best = bc[i] + f[rest], bj = -1;
      for (let j = i + 1; j < k; j++) if (rest & (1 << j)) { const c = D(i, j) + f[rest ^ (1 << j)]; if (c < best) { best = c; bj = j; } }
      f[mask] = best; ch[mask] = bj;
    }
    let mask = N - 1;
    while (mask) {
      let i = 0; while (!(mask & (1 << i))) i++;
      const j = ch[mask];
      if (j < 0) { pairs.push([i, -1 - bs[i]]); mask ^= 1 << i; } else { pairs.push([i, j]); mask ^= (1 << i) | (1 << j); }
    }
  } else {
    const es = [];
    for (let i = 0; i < k; i++) { es.push([bc[i], i, -1]); for (let j = i + 1; j < k; j++) es.push([D(i, j), i, j]); }
    es.sort((x, y) => x[0] - y[0]);
    const used = new Uint8Array(k);
    for (const [, i, j] of es) {
      if (used[i] || (j >= 0 && used[j])) continue;
      used[i] = 1; if (j >= 0) used[j] = 1;
      pairs.push([i, j < 0 ? -1 - bs[i] : j]);
    }
  }
  return pairs;
}

// a monotone staircase of qubit flips from plaquette (m1, n1) to (m2, n2); pts lists every site along the way
function pathPair(m1, n1, m2, n2) {
  let m = m1, n = n1, rx = (m2 - m1) / 2, ry = (n2 - n1) / 2;
  const sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1, pts = [[m, n]], qs = [];
  rx = abs(rx); ry = abs(ry);
  let dir = rnd() * (rx + ry + 1e-9) < rx ? 0 : 1;
  while (rx + ry > 0) {
    if (dir === 0 && rx === 0) dir = 1; else if (dir === 1 && ry === 0) dir = 0; else if (rx > 0 && ry > 0 && rnd() < 0.3) dir ^= 1;
    if (dir === 0) { qs.push(idx(m + sx, n)); pts.push([m + sx, n], [m + 2 * sx, n]); m += 2 * sx; rx--; } else { qs.push(idx(m, n + sy)); pts.push([m, n + sy], [m, n + 2 * sy]); n += 2 * sy; ry--; }
  }
  return { pts, qs };
}

// from a plaquette straight out to the boundary its type ends on
function pathOut(st, m, n, t, side) {
  const sg = side ? 1 : -1, pts = [[m, n]], qs = [];
  for (;;) {
    const qm = t === 0 ? m + sg : m, qn = t === 0 ? n : n + sg;
    qs.push(idx(qm, qn)); pts.push([qm, qn]);
    if (t === 0 ? abs(qm) >= st.Mh : abs(qn) >= st.Nh) break;
    if (t === 0) m += 2 * sg; else n += 2 * sg;
    pts.push([m, n]);
  }
  return { pts, qs };
}

function makeJob(st, t, ds) {
  const pairs = matchDefects(st, ds, t), paths = [];
  let mx = 1;
  for (const [i, j] of pairs) {
    const m = IM[ds[i]], n = IN[ds[i]];
    const p = j >= 0 ? pathPair(m, n, IM[ds[j]], IN[ds[j]]) : pathOut(st, m, n, t, -1 - j);
    // corner points only
    const c = [p.pts[0]];
    for (let s = 1; s < p.pts.length - 1; s++) {
      const a = p.pts[s - 1], b = p.pts[s], d = p.pts[s + 1];
      if ((b[0] - a[0]) * (d[1] - b[1]) !== (b[1] - a[1]) * (d[0] - b[0])) c.push(b);
    }
    c.push(p.pts[p.pts.length - 1]);
    p.cp = c; p.hops = p.qs.length; mx = max(mx, p.hops);
    paths.push(p);
  }
  const dDur = min(1.5, 0.45 + 0.07 * mx);
  const job = { id: st.jobId++, typ: t, t: -(0.05 + 0.3 * rnd()), paths, defs: ds.slice(), dDur, tA: dDur + 0.3, applied: false, cancel: false };
  for (const p of ds) st.lock[p] = job.id;
  st.jobs.push(job);
}

function applyJob(st, job) {
  job.applied = true;
  for (const p of job.defs) st.lock[p] = 0;
  if (job.cancel) return;
  for (const p of job.paths) for (const q of p.qs) flipErr(st, q, job.typ, true);
  const lg = cleanup(st);
  // whatever correction qubits are still in error get a ring
  for (const q of st.ql) {
    if (st.errX[q] && !st.rings.has(q * 2)) st.rings.set(q * 2, { q, t: 0, age: 0, dead: -1, lvl: 0 });
    if (st.errZ[q] && !st.rings.has(q * 2 + 1)) st.rings.set(q * 2 + 1, { q, t: 1, age: 0, dead: -1, lvl: 0 });
  }
  for (const p of job.defs) {
    st.syn[p] = st.par[p]; st.flash[p] = 1;
    if (st.syn[p]) { st.age[p] = 0; st.pat[p] = st.P * (0.7 + 0.6 * rnd()); }
  }
  if (lg >= 0) startLogical(st, lg);
}

function decode(st) {
  for (let t = 0; t < 2; t++) {
    const ds = [];
    for (const p of st.pl) if ((IN[p] & 1) === t && st.syn[p] && !st.lock[p]) ds.push(p);
    if (!ds.length) continue;
    const k = ds.length, uf = [];
    for (let i = 0; i < k; i++) uf.push(i);
    const find = (a) => { while (uf[a] !== a) { uf[a] = uf[uf[a]]; a = uf[a]; } return a; };
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
      if ((abs(IM[ds[i]] - IM[ds[j]]) + abs(IN[ds[i]] - IN[ds[j]])) / 2 <= LINK) uf[find(i)] = find(j);
    }
    const comps = new Map();
    for (let i = 0; i < k; i++) { const r = find(i); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(ds[i]); }
    for (const c of comps.values()) {
      let ready = false;
      for (const p of c) if (st.age[p] >= st.pat[p]) ready = true;
      if (ready) makeJob(st, t, c);
    }
  }
}

// ---- the logical error: a slow wave across the code, then calm ----
function startLogical(st, t) {
  if (st.lg) return;
  st.lg = { t: 0, dur: 5, axis: t === 0 ? 0 : 1, sg: rnd() < 0.5 ? 1 : -1, prev: -9 };
  for (const j of st.jobs) j.cancel = true;
  st.hops.length = 0;
}
function lgFront(lg) { const u = lg.t / lg.dur; return -0.16 + 2.0 * (u * u * (3 - 2 * u) * 0.5 + u * 0.5); }
function lgCoord(lg, x, y) { const c = lg.axis ? y / H : x / W; return lg.sg > 0 ? c : 1 - c; }

function stepLogical(st, dt) {
  const lg = st.lg;
  lg.t += dt;
  const f = lgFront(lg) - 0.05, done = lg.t >= lg.dur;
  // the wave clears the band of the code it has just passed
  for (const q of st.ql) {
    if (!(st.errX[q] || st.errZ[q])) continue;
    const c = lgCoord(lg, 32 + IM[q] * st.a, 64 + IN[q] * st.a);
    if (c > f || c <= lg.prev) continue;
    for (let t = 0; t < 2; t++) if ((t ? st.errZ : st.errX)[q]) flipErr(st, q, t, false);
  }
  for (const p of st.pl) {
    const c = lgCoord(lg, 32 + IM[p] * st.a, 64 + IN[p] * st.a);
    if (c > f || c <= lg.prev) continue;
    st.syn[p] = 0; st.lock[p] = 0;
  }
  rebuildPar(st);
  lg.prev = f;
  if (done) { st.lg = null; st.calm = 0.25; st.hops.length = 0; for (const j of st.jobs) j.cancel = true; }
}

// ---- time ----
function tickRound(st) {
  const P = st.P;
  for (const p of st.pl) {
    const s = st.par[p];
    if (s && !st.syn[p]) { st.age[p] = 0; st.pat[p] = P * (0.7 + 0.6 * rnd()); st.flash[p] = 1; }
    else if (s) { st.age[p] += 1; if (!st.lock[p]) st.flash[p] = max(st.flash[p], 0.3); }
    else st.dir[p] = -1;
    st.syn[p] = s;
  }
  if (st.lg) return;
  const lg = cleanup(st);
  if (lg >= 0) { startLogical(st, lg); return; }
  // each defect may hop one step along the lattice some time in the next round, mostly straight on
  for (const p of st.pl) {
    if (st.par[p] && !st.lock[p] && rnd() < st.hop) st.hops.push({ at: st.time + 0.05 + rnd() * 0.8, p });
  }
  decode(st);
}

function doHop(st, h) {
  const p = h.p;
  if (!st.par[p] || st.lock[p]) return;
  const m = IM[p], n = IN[p], t = n & 1, d0 = st.dir[p];
  // direction order: straight on, one of the sides, back
  const w = [0, 0, 0, 0];
  for (let d = 0; d < 4; d++) w[d] = d0 < 0 ? 1 : d === d0 ? 0.6 : d === (d0 ^ 1) ? 0.1 : 0.15;
  for (let tries = 0; tries < 4; tries++) {
    let s = w[0] + w[1] + w[2] + w[3], r = rnd() * s, d = 0;
    while (d < 3 && r >= w[d]) { r -= w[d]; d++; }
    w[d] = 0;
    const qm = m + DM[d], qn = n + DN[d], pm = m + 2 * DM[d], pn = n + 2 * DN[d];
    if (abs(qm) > st.Mh || abs(qn) > st.Nh) continue;
    const inside = abs(pm) <= st.Mh && abs(pn) <= st.Nh;
    if (inside && st.lock[idx(pm, pn)]) continue;
    const x = 32 + qm * st.a, y = 64 + qn * st.a;
    if (x < -4 || x > 68 || y < -4 || y > 132) continue;
    flipErr(st, idx(qm, qn), t, false);
    if (inside) st.dir[idx(pm, pn)] = d;
    st.dir[p] = -1;
    return;
  }
}

function simStep(st, dt) {
  st.time += dt;
  if (st.calm > 0) st.calm -= dt;
  if (st.lg) stepLogical(st, dt);
  if (st.calm <= 0 && (!st.lg || st.lg.t > 0.3 * st.lg.dur)) {
    st.errT -= dt;
    for (let g = 0; st.errT <= 0 && g < 8; g++) { landError(st); st.errT += (0.35 + 1.3 * rnd()) / st.lam; }
    // the code is never left quite quiet: below three errors alive, another lands
    st.floorT -= dt;
    if (st.nerr < 3 && st.floorT <= 0) { landError(st); st.floorT = 0.2 + 0.5 * rnd(); }
  }
  st.tickT -= dt;
  if (st.tickT <= 0) { st.tickT += 0.6 + 0.6 * rnd(); tickRound(st); }
  for (let i = st.hops.length - 1; i >= 0; i--) if (st.hops[i].at <= st.time) { const h = st.hops[i]; st.hops.splice(i, 1); doHop(st, h); }
  for (let i = st.jobs.length - 1; i >= 0; i--) {
    const j = st.jobs[i];
    j.t += dt;
    if (!j.applied && j.t >= j.tA) applyJob(st, j);
    if (j.t >= j.tA + 0.95) st.jobs.splice(i, 1);
  }
  // visuals follow the state
  const gr = 1 - exp(-dt / 0.18), gf = 1 - exp(-dt / 0.5), fk = exp(-dt / 0.35);
  for (const p of st.pl) {
    const s = st.syn[p];
    st.glow[p] += (s - st.glow[p]) * (s ? gr : gf);
    st.flash[p] *= fk;
  }
  const tk = dt / 16, ts = sqrt(2 * tk) * 1.1;
  for (const p of st.pl) st.tone[p] = cl(st.tone[p] * (1 - tk) + ts * (rnd() + rnd() + rnd() - 1.5) * 2, -2.2, 2.2);
  st.qd.fill(0);
  for (const [key, r] of st.rings) {
    r.age += dt;
    if (r.dead < 0) r.lvl += (1 - r.lvl) * (1 - exp(-dt / 0.12));
    else { r.dead += dt; r.lvl = max(0, 1 - r.dead / 0.7); if (r.dead > 0.8) { st.rings.delete(key); continue; } }
    const v = st.qd[r.q * 2 + r.t];
    st.qd[r.q * 2 + r.t] = max(v, r.lvl);
  }
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.25);
  const first = !st.init;
  if (first) { st.init = true; for (let i = 0; i < 4; i++) st.ks[i] = st.k[i]; }
  else { const a = 1 - exp(-dt / 0.12); for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a; }
  const k2 = cl(st.ks[1], 0, 4), k3 = cl(st.ks[2], -1, 1), k4 = cl(st.ks[3], -1, 1);
  const aT = PITCH * pow(PITCH_BASE, -k3);
  st.a = first ? aT : st.a + (aT - st.a) * (1 - exp(-dt / 0.15));
  fitGrid(st, first);
  st.P = 0.9 * pow(8, (k4 + 1) / 2);
  const p = 0.00085 * pow(24, k2 / 4);                                  // per qubit per round
  st.lam = max(0.02, p * (W * H) / (2 * st.a * st.a) * pow(st.a / PITCH, 1.5) / 0.9);   // errors a second, kept in check on the finest lattices
  st.hop = 0.14 + 0.12 * k2 / 4;
  if (first) for (let i = 0; i < 140; i++) simStep(st, 0.1);
  simStep(st, dt);
}

// ---- drawing ----
const TWAVE = [[0.07, 0.035, 0.083, 0], [-0.04, 0.06, -0.057, 2.1], [0.021, -0.05, 0.037, 4.2]];

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const buf = st.buf, add = st.add, a = st.a, T = st.time;
  add.fill(0);
  const hue = fin(st.ks[0], 0) + HUE0 + 0.025 * (0.6 * sin(0.021 * T + st.ph[0]) + 0.4 * sin(0.0337 * T + st.ph[1]));
  const lg = st.lg, front = lg ? lgFront(lg) : -9;
  // colours per plaquette type: index 0 = even row (Z check, violet), 1 = odd row (X check, teal)
  const pc = [hue + HZ, hue + HX], pS = [0.5, 0.42], pV = [0.2, 0.19];
  const lgc = [0, 0, 0]; hsv(hue + HLOG, 0.62, 1, lgc);
  const dotC = [0, 0, 0]; hsv(hue + 0.12, 0.12, 1, dotC);
  const rd = cl(0.2 * a, 1.25, 1.9), rho = cl(0.34 * a, 2.0, 3.3);
  const wv = TWAVE.map((w) => [w[0], w[1], w[2] * T + w[3]]);
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5 - 64) / a;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - 32) / a;
      const P1 = round((u - 1 + v) * 0.5), Q1 = round((u - 1 - v) * 0.5), pm = P1 + Q1 + 1, pn = P1 - Q1;
      const d1 = abs(u - pm) + abs(v - pn), ed = (1 - d1) * a * 0.70711;
      const o = (y * W + x) * 3;
      let dr = 0;
      for (let i = 0; i < 3; i++) dr += sin(wv[i][0] * x + wv[i][1] * y + wv[i][2]);
      dr = 1 + 0.2 * dr;
      let r = 0, g = 0, b = 0;
      if (abs(pm) <= st.Mh && abs(pn) <= st.Nh) {
        const pi = idx(pm, pn), tp = pn & 1;
        let gl = cl(st.glow[pi] + 0.5 * st.flash[pi] * (st.syn[pi] ? 1 : 0.4), 0, 1);
        const gap = sstep(0, 1.15, ed);
        let gfac = 0.2 + 0.8 * gap;
        gfac += (1 - gfac) * 0.7 * gl;
        const tn = st.tone[pi];
        let V = pV[tp] * dr * cl(1 + 0.4 * tn, 0.4, 1.8) * (0.78 + 0.22 * (1 - d1)) * gfac;
        const S0 = pS[tp] * (1 - 0.55 * gl);
        V = V * (1 - gl) + (0.5 + 0.5 * (1 - d1)) * gfac * gl;
        hsv(pc[tp] + 0.02 * (dr - 1) + 0.018 * tn, S0, V, hv);
        r = hv[0]; g = hv[1]; b = hv[2];
        if (lg) {
          // the logical wave lights whole diamonds, a little ahead or behind by cell, so the lattice stays readable in it
          const dd = front - lgCoord(lg, 32 + pm * a, 64 + pn * a) + 0.05 * tn, w = (dd < 0 ? exp(-(dd * dd) / 0.0081) : exp(-dd / 0.3)) * 0.9;
          if (w > 0.01) { const lv = (0.3 + 0.55 * (1 - d1)) * gfac; r += (lgc[0] * lv - r) * w; g += (lgc[1] * lv - g) * w; b += (lgc[2] * lv - b) * w; }
        }
      }
      // the data qubit nearest this LED
      const pe = (u + v) * 0.5, qe = (u - v) * 0.5, P0 = round(pe), Q0 = round(qe), qm = P0 + Q0, qn = P0 - Q0;
      const qx = 32 + qm * a, qy = 64 + qn * a, dx = x + 0.5 - qx, dy = y + 0.5 - qy;
      const rr = sqrt(dx * dx + dy * dy);
      let al = cl(rd + 0.5 - rr, 0, 1);
      if (al > 0) {
        al *= sstep(-0.3, 1.9, min(min(qx, W - qx), min(qy, H - qy)));
        const qi = idx(qm, qn);
        const ex = st.qd[qi * 2], ez = st.qd[qi * 2 + 1];
        let cr = dotC[0] * 0.38 * dr, cg = dotC[1] * 0.38 * dr, cb = dotC[2] * 0.38 * dr;
        if (ex > 0 || ez > 0) {
          hsv(hue + HERX, 0.55, 1, hv); const cx0 = hv[0], cx1 = hv[1], cx2 = hv[2];
          hsv(hue + HERZ, 0.55, 1, hv);
          const t = ex + ez + 1e-6, mx = max(ex, ez);
          cr += (((cx0 * ex + hv[0] * ez) / t) - cr) * mx; cg += (((cx1 * ex + hv[1] * ez) / t) - cg) * mx; cb += (((cx2 * ex + hv[2] * ez) / t) - cb) * mx;
        }
        if (lg) {
          const dd = front - lgCoord(lg, qx, qy), w = (dd < 0 ? exp(-(dd * dd) / 0.0081) : exp(-dd / 0.3)) * 0.8;
          cr += (lgc[0] * 0.95 - cr) * w; cg += (lgc[1] * 0.95 - cg) * w; cb += (lgc[2] * 0.95 - cb) * w;
        }
        r += (cr - r) * al; g += (cg - g) * al; b += (cb - b) * al;
      }
      buf[o] = r; buf[o + 1] = g; buf[o + 2] = b;
    }
  }
  // soft halos round the defects
  for (const p of st.pl) {
    const gl = st.glow[p] + 0.3 * st.flash[p];
    if (gl < 0.04) continue;
    const cx = 32 + IM[p] * a, cy = 64 + IN[p] * a, R = 1.35 * a + 2;
    if (cx < -R || cx > W + R || cy < -R || cy > H + R) continue;
    hsv(pc[IN[p] & 1], 0.55, 1, hv);
    const s2 = (0.62 * a) * (0.62 * a);
    const x0 = max(0, floor(cx - R)), x1 = min(W - 1, floor(cx + R)), y0 = max(0, floor(cy - R)), y1 = min(H - 1, floor(cy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, w = 0.3 * gl * exp(-(dx * dx + dy * dy) / s2), o = (y * W + x) * 3;
      add[o] += hv[0] * w; add[o + 1] += hv[1] * w; add[o + 2] += hv[2] * w;
    }
  }
  // rings on the errored qubits
  for (const r of st.rings.values()) {
    const cx = 32 + IM[r.q] * a, cy = 64 + IN[r.q] * a;
    if (cx < -8 || cx > W + 8 || cy < -8 || cy > H + 8) continue;
    const both = st.errX[r.q] && st.errZ[r.q];
    const rad0 = rho + (r.t === 1 && both ? 1.7 : 0);
    hsv(hue + (r.t ? HERZ : HERX), 0.62, 1, hv);
    const pulse = 0.9 + 0.1 * sin(2.4 * r.age + r.q);
    const boost = r.dead >= 0 ? 1 + 0.9 * exp(-r.dead / 0.1) : 1;
    const bl = r.dead < 0 && r.age < 0.8 ? r.age / 0.8 : 1;
    const rb = rad0 + pow(bl, 0.6) * 2.6 * rho, ba = bl < 1 ? 1.2 * (1 - bl) * (1 - bl) : 0;
    const R = rb + 3;
    const x0 = max(0, floor(cx - R)), x1 = min(W - 1, floor(cx + R)), y0 = max(0, floor(cy - R)), y1 = min(H - 1, floor(cy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, rr = sqrt(dx * dx + dy * dy);
      const e1 = (rr - rad0) / 0.85, e2 = (rr - rb) / 0.95;
      const w = r.lvl * boost * pulse * 0.95 * exp(-e1 * e1) + ba * exp(-e2 * e2) + r.lvl * 0.16 * exp(-(rr * rr) / (rho * rho));
      const o = (y * W + x) * 3;
      add[o] += hv[0] * w; add[o + 1] += hv[1] * w; add[o + 2] += hv[2] * w;
    }
  }
  // the decoder's lines
  for (const j of st.jobs) {
    if (j.t < 0) continue;
    const draw_ = min(1, j.t / j.dDur), sw = j.t - j.tA;
    const fade = sw < 0 ? 1 : max(0, 1 - sw / 0.9), fl = sw < 0 ? 0 : 1.4 * exp(-sw / 0.18);
    hsv(pc[j.typ === 0 ? 0 : 1], 0.28, 1, hv);
    for (const p of j.paths) {
      let tot = 0; const cp = p.cp, L = [];
      for (let s = 1; s < cp.length; s++) { const l = (abs(cp[s][0] - cp[s - 1][0]) + abs(cp[s][1] - cp[s - 1][1])) * a; L.push(l); tot += l; }
      const head = draw_ * tot * (1 + 0.15), sweepAt = sw < 0 ? -1 : cl(sw / 0.5, 0, 1) * tot;
      let s0 = 0;
      for (let s = 1; s < cp.length; s++) {
        const len = L[s - 1], vis = cl(head - s0, 0, len);
        if (vis > 0) {
          const ax = 32 + cp[s - 1][0] * a, ay = 64 + cp[s - 1][1] * a, bx = 32 + cp[s][0] * a, by = 64 + cp[s][1] * a;
          const ux = (bx - ax) / len, uy = (by - ay) / len, ex = ax + ux * vis, ey = ay + uy * vis;
          const x0 = max(0, floor(min(ax, ex) - 5)), x1 = min(W - 1, floor(max(ax, ex) + 5)), y0 = max(0, floor(min(ay, ey) - 5)), y1 = min(H - 1, floor(max(ay, ey) + 5));
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const px = x + 0.5 - ax, py = y + 0.5 - ay;
            const al = cl(px * ux + py * uy, 0, vis), qx = px - ux * al, qy = py - uy * al, d2 = qx * qx + qy * qy;
            let w = exp(-d2 / 0.9) * 1.05 + exp(-d2 / 6) * 0.3;
            const along = s0 + al;
            if (sw < 0) w *= 0.8 + 0.5 * exp(-(head - along) / 8);
            else w *= 1 + fl * exp(-((along - sweepAt) * (along - sweepAt)) / 90);
            w *= fade;
            const o = (y * W + x) * 3;
            add[o] += hv[0] * w; add[o + 1] += hv[1] * w; add[o + 2] += hv[2] * w;
          }
        }
        s0 += len;
      }
    }
  }
  // the wave of a logical error
  if (lg) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = front - lgCoord(lg, x + 0.5, y + 0.5);
      const w = d < 0 ? exp(-(d * d) / 0.0081) : exp(-d / 0.3);
      if (w < 0.01) continue;
      const o = (y * W + x) * 3, dr = 0.82 + 0.18 * sin(0.07 * (x * 0.6 + y) - 2.2 * lg.t), hot = 0.12 * exp(-(d * d) / 0.0016);
      add[o] += lgc[0] * w * 0.24 * dr + hot; add[o + 1] += lgc[1] * w * 0.24 * dr + hot; add[o + 2] += lgc[2] * w * 0.24 * dr + hot;
    }
  }
  for (let i = 0; i < W * H; i++) {
    const o = i * 3;
    const r = buf[o] + add[o] - buf[o] * add[o], g = buf[o + 1] + add[o + 1] - buf[o + 1] * add[o + 1], b = buf[o + 2] + add[o + 2] - buf[o + 2] * add[o + 2];
    display.setPixel(i % W, (i / W) | 0, floor(cl(r, 0, 1) * 255), floor(cl(g, 0, 1) * 255), floor(cl(b, 0, 1) * 255));
  }
}
