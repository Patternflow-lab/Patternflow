// ===== Patternflow pattern =====
// Title:   Cuckoo Table
// Family:  cuckoo
// Idea:    Two hash tables stand one above the other as blocks of square cells, each key is a coloured chip with a home in each table, and a new key kicks out the chip in its first home, which hops on a bright arc to its other home and kicks the next one, a chain that flashes where it meets an empty slot and ends in a rehash of the whole table when it runs too long.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: cuckoo hashing, two tables and a chain of kicks that ends in a rehash (Rasmus Pagh and Flemming Friche Rodler, 2001), its load threshold of one half, the bucketised variant with 2 to 4 slots a bucket (Martin Dietzfelbinger and Christoph Weidling, 2007) and the d-ary variant (Dimitris Fotakis, Rasmus Pagh, Peter Sanders and Paul Spirakis, 2003), pattern round 239
// Round:   239
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Load=0..2.5, Choices=2..12, Speed=-1..1
//
// Knob 1: Hue. Turns the colour mapping of the keys round the wheel. At 0 the chips run from teal through blue and violet to magenta and rose; turned away they take the whole wheel, while the empty cells only sway between azure and purple so they never go brown. Every rehash draws a new mapping on top.
// Knob 2: Load. 0 to 2.5, opening at 2. How full the tables run, as a share of the load where chains blow up. With one slot a cell that is 7 percent of the cells at 0 (a chain is one hop), 42 percent at 2 (two hops on average, now and then ten), and 50 percent at 2.5, the threshold, where chains of 15 hops and more come up and the table rehashes every 15 to 40 s.
// Knob 3: Choices. 2 to 12, opening at 2. How many homes a key can take. 2 is two tables with one slot each. Up to 8 the cells join into buckets of up to 4 slots (a lit gap links the cells of a bucket, and a kick takes any one of them), above 8 a third bucket in either table comes in. More homes give shorter chains and a fuller table: at Load 2 it holds 42 percent of its cells at 2, 76 percent at 4 and 79 percent at 12.
// Knob 4: Speed. -1 to 1, opening near 0. Inserts a second, with as many deletions: 1.6 at -1, 7.8 at the opening, 32 at 1, where ten to twenty chains are live at once. A hop takes 110 to 200 ms at -1 and 60 to 110 ms at 1.

const W = 64, H = 128, NPX = W * H;
const NC = 10, TC = NC * NC, NCELL = 2 * TC, P = 6, X0 = 2;
const YT = [2, 67];
const { floor, ceil, min, max, abs, exp, log, pow, sqrt, sin, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rand = () => Math.random();
const gap = () => -log(1 - rand());
const pick = (n) => floor(rand() * n);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// Dim red, orange and yellow read brown, so they are lifted and paled.
function dim(h, s, v, out, o) {
  const c = frac(h), b = c > 0.9 ? sstep(0.9, 0.97, c) : 1 - sstep(0.12, 0.2, c);
  hsv(h, s * (1 - 0.5 * b), min(1, v * (1 + 1.1 * b * (1 - v))), out, o);
}

function h32(a, b) {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}
const r01 = (a, b) => h32(a, b) / 4294967296;

// the cells:
// Cell n of table t, row r, column c: n = t * 100 + r * 10 + c. A cell is 5 LEDs square with a gap of 1.
const CX = new Float32Array(NCELL), CY = new Float32Array(NCELL);
for (let n = 0; n < NCELL; n++) {
  const t = n >= TC ? 1 : 0, r = floor((n % TC) / NC);
  CX[n] = X0 + (n % NC) * P + 2.5;
  CY[n] = YT[t] + r * P + 2.5;
}

// The load where chains blow up, for 1 to 4 slots a bucket, with two homes a key and with three; capped at 0.93, which the walk can reach.
const THR2 = [0.5, 0.897, 0.959, 0.98], THR3 = [0.918, 0.988, 0.997, 0.999];
function threshold(b, pe) {
  const i = cl(floor(b) - 1, 0, 2), f = cl(b - 1 - i, 0, 1);
  const a = THR2[i] + (THR2[i + 1] - THR2[i]) * f, c = THR3[i] + (THR3[i + 1] - THR3[i]) * f;
  return min(0.93, a + (c - a) * pe);
}

// Cells join into buckets b wide along a row, each row shifted so the buckets lie like bricks.
function buildBuckets(st, b) {
  st.bks = [];
  const ids = new Map();
  for (let n = 0; n < NCELL; n++) {
    const t = n >= TC ? 1 : 0, r = floor((n % TC) / NC), c = n % NC;
    const off = frac(r * 0.618 + t * 0.37 + 0.12) * b;
    const key = (t * NC + r) * 16 + floor((c + off) / b);
    let id = ids.get(key);
    if (id === undefined) {
      id = st.bks.length;
      ids.set(key, id);
      st.bks.push([]);
    }
    st.bucketOf[n] = id;
    st.bks[id].push(n);
  }
}

// state:
function newOrb(o) {
  o.x = rand() * W;
  o.y = rand() * H;
  o.r = 11 + 12 * rand();
  o.vx = (rand() - 0.5) * 3;
  o.vy = (rand() - 0.5) * 3;
  o.u = rand();
  o.life = 8 + 16 * rand();
  o.age = 0;
  o.amp = 0.5 + 0.5 * rand();
  return o;
}
function newMap() {
  return { seed: floor(rand() * 1e9), base: 0.47 + (rand() - 0.5) * 0.14, span: 0.36 + 0.16 * rand() };
}
export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 2, 0.06], t: 0, init: false,
    keyAt: new Array(NCELL).fill(null), nextId: 1,
    chains: [], arcs: [], rings: [], ghosts: [],
    seed: floor(rand() * 1e9), cm: newMap(),
    bq: -1, pe: 0, bucketOf: new Int16Array(NCELL), bks: [],
    base: 0, rate: 7, hop: 0.12, maxloop: 20,
    haz: 0, hnext: gap(), m: 0.94, tide: 0.94, nextTide: 0,
    rh: null, lastRh: -99, nextMaint: 55 + 75 * rand(),
    orbs: Array.from({ length: 16 }, () => newOrb({})),
    B: new Float32Array(NPX * 3), tmp: [0, 0, 0],
  });
  for (const o of st.orbs) o.age = rand() * o.life;
}

function applyKnobs(st) {
  const [, k2, k3, k4] = st.k;
  const b = cl(k3 / 2, 1, 4), pe = cl((k3 - 8) / 4, 0, 1);
  const q = Math.round(b * 24);
  if (q !== st.bq) {
    st.bq = q;
    buildBuckets(st, q / 24);
  }
  st.pe = pe;
  const u = k2 / 2.5;
  st.base = (0.16 + 0.94 * u) * threshold(b, pe);
  const s = (k4 + 1) / 2;
  st.rate = 1.6 * pow(20, s);
  st.hop = 0.16 + (0.085 - 0.16) * s;
  st.maxloop = floor(10 + 5 * b);
}

// keys:
function setHomes(st, key) {
  const s = st.seed * 3;
  key.ca = floor(r01(key.id, s) * TC);
  key.cb = TC + floor(r01(key.id, s + 1) * TC);
  key.cx = floor(r01(key.id, s + 2) * NCELL);
}
function newKey(st) {
  const key = { id: st.nextId++, r3: rand(), f: rand() < 0.5, s: 0.72 + 0.26 * rand(), v: 0.86 + 0.14 * rand(), ph: rand() * TAU, bf: 0.2 + 0.4 * rand(), cell: -1, popT: -9, fl: 0 };
  setHomes(st, key);
  return key;
}
const hueOf = (k1, cm, id) => k1 + cm.base + cm.span * pow(r01(id, cm.seed), 1.2);
function keyRgb(st, key, t, out) {
  hsv(hueOf(st.k[0], st.cm, key.id), key.s, key.v * (0.86 + 0.14 * sin(TAU * key.bf * t + key.ph)), out, 0);
}

// Where a key goes when kicked out of cell `from`: a free slot in one of its other buckets, else a random cell of one to kick in turn.
// A key coming in (from is -1) takes its first home, free or not.
function pickHome(st, key, from) {
  const bo = st.bucketOf, ka = st.keyAt, bf = from >= 0 ? bo[from] : -1;
  const hs = key.r3 < st.pe ? [key.ca, key.cb, key.cx] : [key.ca, key.cb];
  const cand = [];
  if (from < 0) cand.push(bo[key.f ? key.cb : key.ca]);
  else
    for (const h of hs) {
      const bk = bo[h];
      if (bk !== bf && cand.indexOf(bk) < 0) cand.push(bk);
    }
  if (!cand.length) cand.push(bo[key.ca]);
  const free = [];
  for (const bk of cand) for (const c of st.bks[bk]) if (!ka[c]) free.push(c);
  if (free.length) return free[pick(free.length)];
  const cells = st.bks[cand[pick(cand.length)]];
  return cells[pick(cells.length)];
}

// An insertion that takes no time, for the opening fill and a rehash. Returns the key left without a home, if any.
function insertNow(st, key) {
  let cur = key, from = -1;
  for (let i = 0; i < 80; i++) {
    const c = pickHome(st, cur, from), occ = st.keyAt[c];
    st.keyAt[c] = cur;
    cur.cell = c;
    if (!occ) return null;
    cur = occ;
    from = c;
  }
  cur.cell = -1;
  return cur;
}
const stored = (st) => {
  let n = 0;
  for (let c = 0; c < NCELL; c++) if (st.keyAt[c]) n++;
  return n;
};

// hops and chains:
function startHop(st, ch, x0, y0, to, t) {
  const x1 = CX[to], y1 = CY[to], dx = x1 - x0, dy = y1 - y0, chord = sqrt(dx * dx + dy * dy) + 1e-6;
  let bow = (0.26 + 0.3 * rand()) * max(chord, 15) * (rand() < 0.5 ? -1 : 1);
  const nx = -dy / chord, ny = dx / chord, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  if (mx + nx * bow < 3 || mx + nx * bow > 60) bow = -bow;
  const cxp = cl(mx + nx * bow, 2, 61), cyp = cl(my + ny * bow, 1, 126);
  const dur = cl(st.hop * (0.7 + 0.6 * rand()), 0.06, 0.2);
  const a = { x0, y0, x1, y1, cx: cxp, cy: cyp, t0: t, dur, len: 0.5 * (chord + sqrt((cxp - x0) ** 2 + (cyp - y0) ** 2) + sqrt((x1 - cxp) ** 2 + (y1 - cyp) ** 2)), key: ch.key };
  st.arcs.push(a);
  ch.arc = a;
  ch.to = to;
  ch.tl = t + dur;
}
const ease = (p) => 0.5 * p + 0.5 * sstep(0, 1, p);
function bez(a, s, out) {
  const u = 1 - s;
  out[0] = u * u * a.x0 + 2 * u * s * a.cx + s * s * a.x1;
  out[1] = u * u * a.y0 + 2 * u * s * a.cy + s * s * a.y1;
}
function addRing(st, x, y, t, str, big, hue) {
  if (st.rings.length < 70) st.rings.push({ x, y, t0: t, str, big, hue, ph: rand() * TAU });
}

function startInsert(st, t) {
  const key = newKey(st), ch = { key, hop: 1, arc: null, to: 0, tl: 0 };
  const sx = 5 + rand() * 54, sy = 64 + (rand() - 0.5) * 3;
  startHop(st, ch, sx, sy, pickHome(st, key, -1), t);
  st.chains.push(ch);
  addRing(st, sx, sy, t, 0.5, 0, hueOf(st.k[0], st.cm, key.id));
}
function dropKey(st, key, x, y, t) {
  st.ghosts.push({ x, y, t0: t, id: key.id, s: key.s, v: key.v });
}
function deleteOne(st, t) {
  const cells = [];
  for (let c = 0; c < NCELL; c++) if (st.keyAt[c]) cells.push(c);
  if (!cells.length) return;
  const c = cells[pick(cells.length)], key = st.keyAt[c];
  st.keyAt[c] = null;
  dropKey(st, key, CX[c], CY[c], t);
}

function land(st, ch) {
  const t = ch.tl, c = ch.to, key = ch.key, occ = st.keyAt[c], hue = hueOf(st.k[0], st.cm, key.id);
  st.keyAt[c] = key;
  key.cell = c;
  key.popT = t;
  if (!occ) {
    key.fl = 1;
    addRing(st, CX[c], CY[c], t, 1, 1, hue);
    st.chains.splice(st.chains.indexOf(ch), 1);
    return;
  }
  key.fl = 0.75;
  occ.cell = -1;
  ch.key = occ;
  ch.hop++;
  addRing(st, CX[c], CY[c], t, min(1, 0.35 + 0.1 * ch.hop), ch.hop >= 4 ? 1 : 0, hue);
  if (ch.hop > st.maxloop) {
    st.chains.splice(st.chains.indexOf(ch), 1);
    if (t - st.lastRh > 9 && !st.rh) startRehash(st, t, occ, CX[c], CY[c]);
    else dropKey(st, occ, CX[c], CY[c], t);
    return;
  }
  startHop(st, ch, CX[c], CY[c], pickHome(st, occ, c), t);
}

// rehash:
// Every key gets new homes under new seeds and is put back at once; the picture glows, lifts the chips out and flies them to their new cells.
const RH_LIFT = 0.7, RH_T = 2.6;
function startRehash(st, t, extra, ex, ey) {
  const all = [];
  for (let c = 0; c < NCELL; c++) if (st.keyAt[c]) all.push({ key: st.keyAt[c], x: CX[c], y: CY[c] });
  const pos = [0, 0];
  for (const ch of st.chains) {
    bez(ch.arc, ease(cl((t - ch.arc.t0) / ch.arc.dur, 0, 1)), pos);
    all.push({ key: ch.key, x: pos[0], y: pos[1] });
  }
  if (extra) all.push({ key: extra, x: ex, y: ey });
  st.chains.length = 0;
  st.keyAt.fill(null);
  const old = st.cm, k1 = st.k[0];
  for (const e of all) e.h0 = hueOf(k1, old, e.key.id);
  st.seed = floor(rand() * 1e9);
  st.cm = newMap();
  for (let i = all.length - 1; i > 0; i--) {
    const j = pick(i + 1), s = all[i];
    all[i] = all[j];
    all[j] = s;
  }
  const lost = new Set();
  for (const e of all) {
    setHomes(st, e.key);
    const miss = insertNow(st, e.key);
    if (miss) lost.add(miss);
  }
  for (const e of all) {
    e.h1 = hueOf(k1, st.cm, e.key.id);
    e.lost = lost.has(e.key);
    e.to = e.lost ? -1 : e.key.cell;
    e.d = rand() * 0.4;
    e.dur = 0.55 + 0.3 * rand();
    e.bow = (0.2 + 0.25 * rand()) * (rand() < 0.5 ? -1 : 1);
    if (!e.lost) e.key.popT = t + RH_LIFT + e.d + e.dur;
    e.key.fl = 0.8;
  }
  st.rh = { t0: t, all };
}

// time:
function step(st, d) {
  const t = (st.t += d);
  for (const o of st.orbs) {
    o.age += d;
    o.x += o.vx * d;
    o.y += o.vy * d;
    if (o.age > o.life) newOrb(o);
  }
  if (t >= st.nextTide) {
    st.tide = 0.82 + 0.24 * rand();
    st.nextTide = t + 7 + 18 * rand();
  }
  st.m += (st.tide - st.m) * (1 - exp(-d / 5));
  for (let i = st.arcs.length - 1; i >= 0; i--) if (t > st.arcs[i].t0 + st.arcs[i].dur + 1.2) st.arcs.splice(i, 1);
  for (let i = st.rings.length - 1; i >= 0; i--) if (t > st.rings[i].t0 + 0.7) st.rings.splice(i, 1);
  for (let i = st.ghosts.length - 1; i >= 0; i--) if (t > st.ghosts[i].t0 + 0.5) st.ghosts.splice(i, 1);
  if (st.rh) {
    if (t - st.rh.t0 < RH_T) return;
    st.rh = null;
    st.lastRh = t;
    st.nextMaint = t + 55 + 75 * rand();
  }
  if (t >= st.nextMaint) {
    startRehash(st, t, null, 0, 0);
    return;
  }
  const n = stored(st) + st.chains.length, target = min(0.95, st.base * st.m) * NCELL, e = cl((target - n) / NCELL, -0.35, 0.35);
  const lam = min(90, 2 * st.rate * (1 + 8 * abs(e)));
  st.haz += lam * d;
  while (st.haz >= st.hnext) {
    st.haz -= st.hnext;
    st.hnext = gap();
    const te = t - st.haz / lam;
    if (rand() < cl(0.5 + 5 * e, 0.04, 0.96)) {
      if (st.chains.length < 30) startInsert(st, te);
    } else deleteOne(st, te);
  }
  for (const ch of st.chains.slice()) {
    while (st.chains.indexOf(ch) >= 0 && ch.tl <= t && !st.rh) land(st, ch);
    if (st.rh) break;
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 2, 0.06];
  st.k = [kv[0], cl(kv[1], 0, 2.5), cl(kv[2], 2, 12), cl(kv[3], -1, 1)];
  applyKnobs(st);
  if (!st.init) {
    st.init = true;
    const target = min(0.95, st.base * st.m) * NCELL;
    for (let i = 0; i < 4 * NCELL && stored(st) < target; i++) insertNow(st, newKey(st));
    st.lastRh = st.t - 3;
    for (let i = 0; i < 150; i++) step(st, 1 / 30);
  }
  step(st, cl(dt || 0, 0, 0.1));
}

// drawing:
function blendPx(B, i, r, g, b, a) {
  B[i] += (r - B[i]) * a;
  B[i + 1] += (g - B[i + 1]) * a;
  B[i + 2] += (b - B[i + 2]) * a;
}
// A chip: a rounded square of half-size hs at (cx, cy), with a little bevel.
function chip(B, cx, cy, hs, rgb, wm, a) {
  const x0 = max(0, floor(cx - hs - 1)), x1 = min(W - 1, ceil(cx + hs + 1)), y0 = max(0, floor(cy - hs - 1)), y1 = min(H - 1, ceil(cy + hs + 1));
  const r = rgb[0] + (1 - rgb[0]) * wm, g = rgb[1] + (1 - rgb[1]) * wm, b = rgb[2] + (1 - rgb[2]) * wm;
  for (let py = y0; py <= y1; py++) {
    const sy = py + 0.5 - cy, dy = abs(sy);
    for (let px = x0; px <= x1; px++) {
      const dx = abs(px + 0.5 - cx), qx = dx - (hs - 1.2), qy = dy - (hs - 1.2);
      const sd = sqrt(max(qx, 0) ** 2 + max(qy, 0) ** 2) + min(max(qx, qy), 0) - 1.2;
      const cov = cl(0.5 - sd, 0, 1) * a;
      if (cov <= 0) continue;
      const m = max(dx, dy) / hs, sh = 1 - 0.14 * m * m - 0.07 * sy / hs;
      blendPx(B, (py * W + px) * 3, r * sh, g * sh, b * sh, cov);
    }
  }
}
// Light is screened on, so overlaps mix colours instead of clipping to white.
function glow(B, x, y, rad, r, g, b, a) {
  const x0 = max(0, floor(x - rad)), x1 = min(W - 1, floor(x + rad)), y0 = max(0, floor(y - rad)), y1 = min(H - 1, floor(y + rad)), r2 = rad * rad;
  for (let py = y0; py <= y1; py++)
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x, dy = py + 0.5 - y, d2 = dx * dx + dy * dy;
      if (d2 >= r2) continue;
      const w = (1 - d2 / r2) ** 2 * a, i = (py * W + px) * 3;
      B[i] += (1 - B[i]) * min(1, r * w);
      B[i + 1] += (1 - B[i + 1]) * min(1, g * w);
      B[i + 2] += (1 - B[i + 2]) * min(1, b * w);
    }
}
// An arc is the strongest of a run of soft discs, so it keeps one width however close they are, screened in once.
const COV = new Float32Array(NPX), TOUCH = new Int32Array(NPX);
function drawArc(B, a, t, col, gain) {
  const p = cl((t - a.t0) / a.dur, 0, 1), sMax = ease(p), fade = t > a.t0 + a.dur ? exp(-(t - a.t0 - a.dur) / 0.22) : 1;
  const n = max(3, ceil(a.len / 1.0)), pt = [0, 0], R = 2.05, R2 = R * R;
  let nt = 0;
  for (let i = 0; i <= n; i++) {
    const q = i / n;
    bez(a, q * sMax, pt);
    const I = (0.1 + 0.9 * q * q) * fade * gain;
    if (I < 0.01) continue;
    const x0 = max(0, floor(pt[0] - R)), x1 = min(W - 1, floor(pt[0] + R)), y0 = max(0, floor(pt[1] - R)), y1 = min(H - 1, floor(pt[1] + R));
    for (let py = y0; py <= y1; py++)
      for (let px = x0; px <= x1; px++) {
        const dx = px + 0.5 - pt[0], dy = py + 0.5 - pt[1], d2 = dx * dx + dy * dy;
        if (d2 >= R2) continue;
        const v = (1 - d2 / R2) ** 0.7 * I, o = py * W + px;
        if (v <= COV[o]) continue;
        if (COV[o] === 0) TOUCH[nt++] = o;
        COV[o] = v;
      }
  }
  for (let k = 0; k < nt; k++) {
    const o = TOUCH[k], v = COV[o], i = o * 3, wm = 0.35 * v * v;
    COV[o] = 0;
    B[i] += (1 - B[i]) * min(1, (col[0] + (1 - col[0]) * wm) * v);
    B[i + 1] += (1 - B[i + 1]) * min(1, (col[1] + (1 - col[1]) * wm) * v);
    B[i + 2] += (1 - B[i + 2]) * min(1, (col[2] + (1 - col[2]) * wm) * v);
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const { B, tmp, t } = st, k1 = st.k[0];
  const rh = st.rh, tg = rh ? t - rh.t0 : -1;
  const g = rh ? sstep(0, RH_LIFT, tg) * (1 - sstep(RH_T - 0.8, RH_T, tg)) : 0;

  // ground: dark indigo and sixteen faint orbs that each fade in and out, then come back somewhere else
  for (let i = 0; i < NPX; i++) {
    B[i * 3] = 0.012;
    B[i * 3 + 1] = 0.014;
    B[i * 3 + 2] = 0.034;
  }
  for (const o of st.orbs) {
    const a = 0.1 * o.amp * sin(PI * cl(o.age / o.life, 0, 1)) ** 2;
    dim(0.62 + 0.12 * sin(TAU * k1 + 0.8) + 0.2 * (o.u - 0.5), 0.6, 1, tmp, 0);
    glow(B, o.x, o.y, o.r, tmp[0], tmp[1], tmp[2], a);
  }
  // the band between the tables, where new keys come in
  for (let y = 60; y < 68; y++) {
    const k = 0.05 * (1 - abs(y - 63.5) / 4.5);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      B[i] += 0.3 * k;
      B[i + 1] += 0.5 * k;
      B[i + 2] += 1.1 * k;
    }
  }

  // the tables: an empty cell is a faint tint, cells of one bucket are joined by a lighter gap
  const gh = 0.66 + 0.12 * sin(TAU * k1 + 0.8), boost = 1 + 0.7 * g;
  for (let tb = 0; tb < 2; tb++) {
    const e = [0, 0, 0], pl = [0, 0, 0], lk = [0, 0, 0];
    dim(gh + 0.07 * tb, 0.8, min(0.5, 0.19 * boost), e, 0);
    dim(gh + 0.07 * tb, 0.8, min(0.3, 0.075 * boost), pl, 0);
    dim(gh + 0.07 * tb, 0.7, min(0.5, 0.36 * boost), lk, 0);
    for (let y = YT[tb] - 1; y < YT[tb] + 59 + 1; y++)
      for (let x = X0 - 1; x < X0 + 59 + 1; x++) blendPx(B, (y * W + x) * 3, pl[0], pl[1], pl[2], 0.8);
    for (let r = 0; r < NC; r++)
      for (let c = 0; c < NC; c++) {
        const n = tb * TC + r * NC + c;
        chip(B, CX[n], CY[n], 2.5, e, 0, 1);
        if (c < NC - 1 && st.bucketOf[n] === st.bucketOf[n + 1]) {
          const i = ((YT[tb] + r * P) * W + X0 + c * P + 5) * 3;
          for (let yy = 0; yy < 5; yy++) blendPx(B, i + yy * W * 3, lk[0], lk[1], lk[2], 0.8);
        }
      }
  }

  // the chips
  if (!rh) {
    for (let n = 0; n < NCELL; n++) {
      const key = st.keyAt[n];
      if (!key) continue;
      keyRgb(st, key, t, tmp);
      const age = t - key.popT, sc = 0.78 + 0.22 * sstep(0, 0.14, age) + 0.1 * sin(PI * cl(age / 0.2, 0, 1));
      const f = key.fl * exp(-age / 0.22);
      chip(B, CX[n], CY[n], 2.5 * sc, tmp, 0.7 * f, 1);
      if (f > 0.08) glow(B, CX[n], CY[n], 5.5, tmp[0] + 0.3, tmp[1] + 0.3, tmp[2] + 0.3, 0.2 * f);
    }
  } else {
    for (const e of rh.all) {
      const f = cl((tg - RH_LIFT - e.d) / e.dur, 0, 1), key = e.key;
      const hue = e.h0 + (e.h1 - e.h0) * sstep(0.15, 0.85, f);
      hsv(hue, key.s, key.v, tmp, 0);
      const wm = 0.32 * g, x1 = e.to >= 0 ? CX[e.to] : e.x, y1 = e.to >= 0 ? CY[e.to] : e.y;
      if (tg < RH_LIFT + e.d) {
        const lift = sstep(0.2, RH_LIFT, tg);
        chip(B, e.x, e.y, 2.5 + 0.5 * lift, tmp, wm, 1);
        glow(B, e.x, e.y, 6, tmp[0], tmp[1], tmp[2], 0.3 * lift);
      } else if (f < 1) {
        if (e.lost) {
          chip(B, e.x, e.y, 2.5 * (1 - f * 0.4), tmp, wm, 1 - f);
          continue;
        }
        const mx = (e.x + x1) / 2, my = (e.y + y1) / 2, dx = x1 - e.x, dy = y1 - e.y;
        const bx = cl(mx - dy * e.bow, 4, 59), by = cl(my + dx * e.bow, 4, 123);
        for (let k = 0; k < 4; k++) {
          const s = sstep(0, 1, max(0, f - k * 0.05)), u = 1 - s;
          const x = u * u * e.x + 2 * u * s * bx + s * s * x1, y = u * u * e.y + 2 * u * s * by + s * s * y1;
          chip(B, x, y, 3 - 0.35 * k, tmp, wm + 0.1, k === 0 ? 1 : 0.32 / k);
        }
      } else {
        const age = tg - RH_LIFT - e.d - e.dur, sc = 0.78 + 0.22 * sstep(0, 0.14, age) + 0.1 * sin(PI * cl(age / 0.2, 0, 1));
        chip(B, x1, y1, 2.5 * sc, tmp, 0.32 * g + 0.55 * exp(-age / 0.22), 1);
      }
    }
    // the table's own glow
    hsv(k1 + 0.62, 0.35, 1, tmp, 0);
    for (let i = 0; i < NPX; i++) {
      B[i * 3] += tmp[0] * 0.04 * g;
      B[i * 3 + 1] += tmp[1] * 0.04 * g;
      B[i * 3 + 2] += tmp[2] * 0.04 * g;
    }
  }

  // chips on their way out
  for (const o of st.ghosts) {
    const a = (t - o.t0) / 0.42;
    if (a >= 1) continue;
    hsv(hueOf(k1, st.cm, o.id), o.s, o.v, tmp, 0);
    chip(B, o.x, o.y, 2.5 * (1 - 0.35 * a), tmp, 0.6 * (1 - a), 1 - a);
  }

  // arcs, then the chip each chain carries
  const col = [0, 0, 0];
  let live = 0;
  for (const a of st.arcs) if (t < a.t0 + a.dur + 0.5) live++;
  const gain = 1.25 / (1 + 0.07 * max(0, live - 8));
  for (const a of st.arcs) {
    hsv(hueOf(k1, st.cm, a.key.id), 0.78, 1, col, 0);
    drawArc(B, a, t, col, gain);
  }
  const pt = [0, 0];
  for (const ch of st.chains) {
    const a = ch.arc, p = cl((t - a.t0) / a.dur, 0, 1);
    bez(a, ease(p), pt);
    keyRgb(st, ch.key, t, tmp);
    glow(B, pt[0], pt[1], 5.5, tmp[0], tmp[1], tmp[2], 0.38);
    chip(B, pt[0], pt[1], 2.7, tmp, 0.45, 1);
  }

  // a broken ring grows out of every landing, bigger where a chain has run long
  for (const r of st.rings) {
    const age = t - r.t0, life = r.big ? 0.6 : 0.4;
    if (age >= life) continue;
    const k = age / life, rad = (r.big ? 3 : 2.5) + (r.big ? 12 : 6) * pow(k, 0.6), amp = r.str * (1 - k) ** 1.2;
    hsv(r.hue, 0.45, 1, tmp, 0);
    const x0 = max(0, floor(r.x - rad - 2)), x1 = min(W - 1, ceil(r.x + rad + 2)), y0 = max(0, floor(r.y - rad - 2)), y1 = min(H - 1, ceil(r.y + rad + 2));
    for (let py = y0; py <= y1; py++)
      for (let px = x0; px <= x1; px++) {
        const dx = px + 0.5 - r.x, dy = py + 0.5 - r.y, d = sqrt(dx * dx + dy * dy), w = 1 - abs(d - rad) / 1.5;
        if (w <= 0) continue;
        const m = 0.55 + 0.45 * sin(atan2(dy, dx) * 4 + r.ph + age * 24), i = (py * W + px) * 3, v = w * m * amp * 0.8;
        B[i] += (1 - B[i]) * tmp[0] * v;
        B[i + 1] += (1 - B[i + 1]) * tmp[1] * v;
        B[i + 2] += (1 - B[i + 2]) * tmp[2] * v;
      }
    if (r.big) glow(B, r.x, r.y, 7, tmp[0], tmp[1], tmp[2], 0.4 * (1 - k) * (0.6 + 0.4 * sin(TAU * 11 * age + r.ph)));
  }

  // out: two slow sweeps of light cross everything, and a soft knee keeps overlaps from clipping
  const w1 = TAU * t / 2.9, w2 = TAU * t / 4.3;
  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) {
      const wv = 1 + 0.13 * sin(TAU * (0.016 * x + 0.01 * y) - w1) + 0.1 * sin(TAU * (-0.011 * x + 0.018 * y) - w2);
      let r = B[o] * wv, gg = B[o + 1] * wv, b = B[o + 2] * wv;
      r = r > 0.8 ? 0.8 + 0.2 * (1 - exp(-(r - 0.8) / 0.2)) : r;
      gg = gg > 0.8 ? 0.8 + 0.2 * (1 - exp(-(gg - 0.8) / 0.2)) : gg;
      b = b > 0.8 ? 0.8 + 0.2 * (1 - exp(-(b - 0.8) / 0.2)) : b;
      display.setPixel(x, y, floor(cl(r, 0, 1) * 255), floor(cl(gg, 0, 1) * 255), floor(cl(b, 0, 1) * 255));
    }
}
