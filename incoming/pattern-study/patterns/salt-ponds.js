// ===== Patternflow pattern =====
// Title:   Salt Ponds
// Family:  saltworks
// Idea:    Solar salt ponds seen from above: a chain of rectangular evaporation ponds beside a winding canal, whose brine turns from turquoise through green and orange to pink and deep red as it thickens, then crusts white with salt, is scraped clean, and is filled with fresh sea water again.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 206, after aerial photographs of the solar evaporation ponds of San Francisco Bay and the Camargue, where Dunaliella algae and then Halobacteria colour the brine as it nears saturation
// Round:   206
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Evaporation=0.8..8, Ponds=-1..1, Wind=0..1
//
// Knob 1: Hue. Turns the brine palette round the wheel from the true order it opens on, turquoise, green, amber, coral, rose, magenta; salt white and the cream levees keep their colour.
// Knob 2: Evaporation. How fast the sun thickens the brine: a pond runs from sea water to salt crust in about 250 s at 0.8, 100 s at 2, where it opens, and 25 s at 8, and the scraping and refilling speed up with it.
// Knob 3: Ponds. How many ponds the levees cut the panel into: about 7 at -1, 12 at 0, 20 at 1. Turning it splits or joins one pond every 2.5 s until the count is right, and a levee takes 6 s to rise or melt.
// Knob 4: Wind. How hard the wind works the brine: at 0 faint streaks drift at about 1 LED a second, at 1 they stand out 4 times stronger and race at 5 LEDs a second, ripples run across the water and the sun glint sweeps 30 LEDs instead of 8.

const W = 64;
const H = 128;
const N = W * H;
const { floor, sin, cos, sqrt, exp, abs, min, max, PI, log, hypot } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
const INF = 1e4;

function hash2(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Value noise, 0..1, smooth between lattice points.
function vn(x, y) {
  const i = floor(x), j = floor(y);
  let fx = x - i, fy = y - j;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// ---------------------------------------------------------------------------
// colour

// Brine by salinity s (0 sea water, 1 saturated): the real order of the stages.
const STOPS = [
  [0.0, 34, 190, 196],
  [0.14, 46, 198, 160],
  [0.27, 116, 204, 104],
  [0.4, 184, 190, 52],
  [0.52, 244, 166, 30],
  [0.63, 248, 116, 46],
  [0.75, 244, 88, 100],
  [0.88, 228, 44, 128],
  [1.0, 206, 28, 140],
];
const CREAM = [244, 230, 196];
const SALT = [248, 245, 240];
const BED = [206, 198, 194];
const WARM = [252, 234, 178];
const NL = 128;

function buildColours(S, hue) {
  const th = TAU * hue, c = cos(th), s = sin(th), k = 1 / 3, q = 0.577350269 * s;
  const m00 = c + (1 - c) * k, m01 = (1 - c) * k - q, m02 = (1 - c) * k + q;
  const rot = (r, g, b, out, o) => {
    let R = max(m00 * r + m01 * g + m02 * b, 0);
    let G = max(m02 * r + m00 * g + m01 * b, 0);
    let B = max(m01 * r + m02 * g + m00 * b, 0);
    const L0 = 0.299 * r + 0.587 * g + 0.114 * b;
    let sc = L0 / (0.299 * R + 0.587 * G + 0.114 * B + 1e-3);
    const mx = max(R, G, B) * sc;
    if (mx > 255) sc *= 255 / mx;
    out[o] = R * sc;
    out[o + 1] = G * sc;
    out[o + 2] = B * sc;
  };
  const base = [0, 0, 0];
  for (let i = 0; i < NL; i++) {
    const sv = i / (NL - 1);
    let n = 0;
    while (n < STOPS.length - 2 && sv > STOPS[n + 1][0]) n++;
    const a = STOPS[n], b = STOPS[n + 1];
    const u = cl((sv - a[0]) / (b[0] - a[0]), 0, 1);
    rot(lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u), base, 0);
    const lum = 0.299 * base[0] + 0.587 * base[1] + 0.114 * base[2];
    for (let ch = 0; ch < 3; ch++) {
      // Deep water is richer and a touch darker, shallows paler and warmer.
      S.lutD[i * 3 + ch] = cl((lum + (base[ch] - lum) * 1.14) * 0.9, 0, 255);
      S.lutS[i * 3 + ch] = lerp(base[ch], WARM[ch], 0.4);
    }
  }
  rot(14, 104, 120, S.canal, 0);
  rot(34, 92, 112, S.wet, 0);
}

// ---------------------------------------------------------------------------
// layout: two guillotine trees either side of a winding canal

const CANAL = { canal: true };

function mkLeaf(e, par, src) {
  return {
    kids: null, cut: null, par, e, idx: 0,
    s: src ? src.s : 0, rate: 0, so: 0.03 * gauss(), seed: 100 * Math.random(),
    stage: 0, tc: 0, cd: 12, tm: 0, F: 0, Fmax: 12,
    su: 0, sv: 6, send: 0, dir: 0, ax: 0, sg: 1,
    pr: 0, vf: 8, pu: 0, pv: 0, rmax: 30, cg: null, cgPerm: false,
    bx0: 0, bx1: 0, by0: 0, by1: 0, area: 0,
  };
}
const newRate = () => exp(log(0.67) + Math.random() * (log(1.67) - log(0.67)));

function leafAt(n, u, v) {
  while (n.kids) n = n.kids[(n.cut.vert ? u : v) < n.cut.pos ? 0 : 1];
  return n;
}
function leaves(n, out) {
  if (n.kids) {
    leaves(n.kids[0], out);
    leaves(n.kids[1], out);
  } else out.push(n);
  return out;
}

function canalAt(S, v) {
  const c = S.can;
  const p1 = c.k1 * v + c.p1, p2 = c.k2 * v + c.p2;
  const uc = c.cx + c.b * (v - 64) + c.a1 * sin(p1) + c.a2 * sin(p2);
  const sl = c.b + c.a1 * c.k1 * cos(p1) + c.a2 * c.k2 * cos(p2);
  return [uc, sl];
}

// Which pond each LED belongs to, and each pond's box and deepest point.
function rebuild(S) {
  const list = leaves(S.rootL, []);
  leaves(S.rootR, list);
  list.forEach((p, i) => (p.idx = i));
  S.list = list;
  for (let i = 0; i < N; i++) {
    S.pidL[i] = leafAt(S.rootL, S.PU[i], S.PV[i]).idx;
    S.pidR[i] = leafAt(S.rootR, S.PU[i], S.PV[i]).idx;
  }
  boxes(S);
}

function boxes(S) {
  const list = S.list;
  for (const p of list) {
    p.bx0 = p.by0 = 1e9;
    p.bx1 = p.by1 = -1e9;
    p.area = 0;
    p.dmax = 0;
  }
  for (let i = 0; i < N; i++) {
    const u = S.PU[i], v = S.PV[i];
    const [uc, sl] = canalAt(S, v);
    const dc = (u - uc) / sqrt(1 + sl * sl);
    const p = list[(dc < 0 ? S.pidL : S.pidR)[i]];
    p.area++;
    if (u < p.bx0) p.bx0 = u;
    if (u > p.bx1) p.bx1 = u;
    if (v < p.by0) p.by0 = v;
    if (v > p.by1) p.by1 = v;
    let d = 99;
    for (let k = 0; k < 4; k++) {
      const e = p.e[k];
      if (!e) continue;
      const dd = e === CANAL ? (k === 0 ? dc : -dc) - 2.3 : k === 0 ? u - e.pos : k === 1 ? e.pos - u : k === 2 ? v - e.pos : e.pos - v;
      if (dd < d) d = dd;
    }
    if (d > p.dmax && d < 90) p.dmax = d;
  }
  let n = 0;
  for (const p of list) if (p.area >= 70) n++;
  S.n = n;
}

// A leaf is split by a new cut; the cut grows from nothing (str 0) to a full levee.
function split(S, P, instant) {
  const bw = P.bx1 - P.bx0, bh = P.by1 - P.by0;
  const MIN = 12;
  let vert = bw > bh * 1.12 || (bw > bh * 0.85 && Math.random() < 0.5);
  const room = (v) => (v ? bw : bh) >= 2 * MIN + 2;
  if (!room(vert)) vert = !vert;
  if (!room(vert)) return false;
  let lo = vert ? P.bx0 : P.by0, hi = vert ? P.bx1 : P.by1;
  // A pond beside the canal leaves slack for the canal to swing.
  if (vert && P.e[1] === CANAL) hi -= 5;
  if (vert && P.e[0] === CANAL) lo += 5;
  lo += MIN;
  hi -= MIN;
  if (hi < lo) return false;
  const mid = (lo + hi) / 2;
  const pos = cl(mid + (Math.random() - 0.5) * 0.6 * (hi - lo), lo, hi);
  const cut = { vert, pos, str: instant ? 1 : 0, tgt: 1, gaps: [], tone: 0.94 + 0.1 * Math.random(), hw: 0.85 + 0.3 * Math.random() };
  if (Math.random() < 0.4) {
    const a0 = vert ? P.by0 : P.bx0, a1 = vert ? P.by1 : P.bx1;
    cut.gaps.push({ pos: lerp(a0, a1, 0.3 + 0.4 * Math.random()), amt: instant ? 1 : 0, tgt: 1, perm: true, use: 0 });
  }
  const A = mkLeaf(vert ? [P.e[0], cut, P.e[2], P.e[3]] : [P.e[0], P.e[1], P.e[2], cut], P, P);
  const B = mkLeaf(vert ? [cut, P.e[1], P.e[2], P.e[3]] : [P.e[0], P.e[1], cut, P.e[3]], P, P);
  for (const c of [A, B]) {
    c.rate = newRate();
    c.cg = P.cg ? { pos: P.cg.pos, amt: P.cg.amt, tgt: P.cg.tgt, perm: P.cg.perm } : null;
  }
  // A child that is not beside the canal loses its canal gate.
  if (vert) (P.e[1] === CANAL ? A : B).cg = null;
  P.kids = [A, B];
  P.cut = cut;
  S.cuts.push(cut);
  rebuild(S);
  return true;
}

// Two sibling leaves are joined: their levee melts, their brine mixes, then they are one pond.
function startMerge(X) {
  X.cut.tgt = 0;
  X.merging = true;
}
function finishMerge(S, X) {
  const [A, B] = X.kids;
  const e = X.cut.vert ? [A.e[0], B.e[1], A.e[2], A.e[3]] : [A.e[0], A.e[1], A.e[2], B.e[3]];
  const m = mkLeaf(e, X.par, A);
  m.s = (A.s + B.s) / 2;
  m.rate = newRate();
  m.cg = A.cg && A.e[1] === CANAL ? A.cg : B.cg && B.e[0] === CANAL ? B.cg : null;
  X.kids = null;
  X.cut = null;
  X.merging = false;
  Object.assign(X, { ...m, par: X.par });
  S.cuts = S.cuts.filter((c) => c.str > 0.001 || c.tgt > 0);
  rebuild(S);
}

function internalNodes(n, out) {
  if (n.kids) {
    out.push(n);
    internalNodes(n.kids[0], out);
    internalNodes(n.kids[1], out);
  }
  return out;
}

function liquid(p) {
  return !p.kids && p.stage === 0 && p.s < 0.85 && p.area >= 70;
}

function doEvent(S) {
  const n = S.n;
  let want = n < S.tgt ? 1 : n > S.tgt ? -1 : S.flip;
  if (want === 1) {
    const c = S.list.filter((p) => liquid(p) && !(p.par && p.par.merging));
    let best = null, bv = 0;
    for (const p of c) {
      const w = Math.pow(p.area, 1.5) * (0.4 + Math.random());
      if (w > bv) {
        bv = w;
        best = p;
      }
    }
    if (best && split(S, best, false)) {
      S.flip = -1;
      return true;
    }
    return false;
  }
  const c = [];
  for (const X of internalNodes(S.rootL, []).concat(internalNodes(S.rootR, []))) {
    const [A, B] = X.kids;
    if (!A.kids && !B.kids && !X.merging && liquid(A) && liquid(B) && A.area + B.area < 1500) c.push(X);
  }
  if (!c.length) return false;
  startMerge(c[floor(Math.random() * c.length)]);
  S.flip = 1;
  return true;
}

// ---------------------------------------------------------------------------
// ponds

function pickGate(S, p) {
  // The sluice the pond fills through: the canal side if it has one, else its longest levee.
  boxes(S);
  const cand = [];
  for (let k = 0; k < 4; k++) {
    const e = p.e[k];
    if (!e) continue;
    const len = k < 2 ? p.by1 - p.by0 : p.bx1 - p.bx0;
    cand.push([k, e, len * (e === CANAL ? 2.2 : 1)]);
  }
  let tot = 0;
  for (const c of cand) tot += c[2];
  let r = Math.random() * tot, pick = cand[0];
  for (const c of cand) {
    r -= c[2];
    if (r <= 0) {
      pick = c;
      break;
    }
  }
  const [k, e] = pick;
  if (e === CANAL) {
    const v = lerp(p.by0, p.by1, 0.25 + 0.5 * Math.random());
    const [uc] = canalAt(S, v);
    if (!p.cg) p.cg = { pos: v, amt: 0, tgt: 1, perm: false };
    else {
      p.cg.pos = v;
      p.cg.tgt = 1;
    }
    p.pu = uc + (k === 0 ? 2.6 : -2.6);
    p.pv = v;
  } else {
    const vert = e.vert;
    const a0 = vert ? p.by0 : p.bx0, a1 = vert ? p.by1 : p.bx1;
    let g = e.gaps.find((q) => q.pos > a0 + 2 && q.pos < a1 - 2);
    if (!g) {
      g = { pos: lerp(a0, a1, 0.25 + 0.5 * Math.random()), amt: 0, tgt: 1, perm: false, use: 0 };
      e.gaps.push(g);
    }
    g.tgt = 1;
    g.use++;
    p.gate = g;
    const off = k === 0 || k === 2 ? 1.2 : -1.2;
    if (vert) {
      p.pu = e.pos + off;
      p.pv = g.pos;
    } else {
      p.pu = g.pos;
      p.pv = e.pos + off;
    }
  }
}

function startCrust(S, p) {
  boxes(S);
  p.stage = 1;
  p.tc = 0;
  p.Fmax = p.dmax + 3.5;
  p.cd = 13 * sqrt(2 / S.K2) * (0.8 + 0.5 * Math.random());
}
function startScrape(S, p) {
  boxes(S);
  p.stage = 3;
  p.dir = floor(Math.random() * 4);
  p.ax = p.dir < 2 ? 0 : 1;
  p.sg = p.dir % 2 === 0 ? 1 : -1;
  const a0 = p.ax === 0 ? p.bx0 : p.by0, a1 = p.ax === 0 ? p.bx1 : p.by1;
  const lo = p.sg > 0 ? a0 : -a1, hi = p.sg > 0 ? a1 : -a0;
  p.su = lo - 3;
  p.send = hi + 19;
  p.sv = cl(6.5 * sqrt(S.K2 / 2) * (0.8 + 0.4 * Math.random()), 4, 14);
}
function startRefill(S, p) {
  p.stage = 5;
  pickGate(S, p);
  p.pr = -2;
  p.vf = cl((7 + 3 * Math.random()) * sqrt(S.K2 / 2), 5, 16);
  let r = 0;
  for (const [u, v] of [[p.bx0, p.by0], [p.bx1, p.by0], [p.bx0, p.by1], [p.bx1, p.by1]]) r = max(r, hypot(u - p.pu, v - p.pv));
  p.rmax = r + 15;
}

function stepPond(S, p, dt) {
  const K2 = S.K2;
  switch (p.stage) {
    case 0:
      p.s += (dt * K2 * p.rate) / 200;
      if (p.s >= 1) {
        p.s = 1;
        startCrust(S, p);
      } else p.F = p.s > 0.92 ? ((p.s - 0.92) / 0.08) * 1.8 : 0;
      break;
    case 1:
      p.tc += dt / p.cd;
      p.F = 1.8 + (p.Fmax - 1.8) * min(1, p.tc);
      if (p.tc >= 1) {
        p.stage = 2;
        p.tm = (3 + 3 * Math.random()) * sqrt(2 / K2);
      }
      break;
    case 2:
      p.tm -= dt;
      if (p.tm <= 0) startScrape(S, p);
      break;
    case 3:
      p.su += p.sv * dt;
      if (p.su > p.send) startRefill(S, p);
      break;
    case 5:
      p.pr += p.vf * dt;
      if (p.pr > p.rmax) {
        p.stage = 0;
        p.s = 0.02;
        p.F = 0;
        p.rate = newRate();
        if (p.gate) {
          p.gate.use = max(0, p.gate.use - 1);
          if (!p.gate.perm && p.gate.use === 0) p.gate.tgt = 0;
          p.gate = null;
        }
        if (p.cg && !p.cgPerm) p.cg.tgt = 0;
      }
      break;
  }
}

// ---------------------------------------------------------------------------

export function setup(params) {
  const th = (Math.random() < 0.5 ? -1 : 1) * (0.1 + 0.05 * Math.random());
  const S = {
    t: 0, first: true, k: [0, 2, 0, 0.06], K2: 2, tgt: 12, n: 0, flip: -1, evT: 50,
    PU: new Float32Array(N), PV: new Float32Array(N), pidL: new Int16Array(N), pidR: new Int16Array(N),
    rootL: null, rootR: null, list: [], cuts: [], boxT: 3,
    lutD: new Float32Array(NL * 3), lutS: new Float32Array(NL * 3), canal: [0, 0, 0], wet: [0, 0, 0], hueBuilt: -9,
    can: {
      cx: 32, b: 0, a1: 4.6, a2: 1.7, k1: TAU / 66, k2: TAU / 25, p1: TAU * Math.random(), p2: TAU * Math.random(),
      q0: TAU * Math.random(), q1: TAU * Math.random(), q2: 0.0113, q3: 0.0071,
    },
    wpsi: 0.95 + 0.4 * Math.random(), wa1: 100 * Math.random(), wa2: 100 * Math.random(), wg1: 6 * Math.random(), wg2: 6 * Math.random(), wph: 0,
    mo: [100 * Math.random(), 100 * Math.random(), 100 * Math.random(), 100 * Math.random()], mdir: Math.random() * TAU,
    cl0: 100 * Math.random(), cl1: 100 * Math.random(), cg: 6 * Math.random(),
    gph: [TAU * Math.random(), TAU * Math.random(), TAU * Math.random(), TAU * Math.random()],
    th,
  };
  const c = cos(th), s = sin(th);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - 32, py = y + 0.5 - 64, i = y * W + x;
      S.PU[i] = 32 + px * c + py * s;
      S.PV[i] = 64 - px * s + py * c;
    }
  params.s = S;
}

function layout(S) {
  S.rootL = mkLeaf([null, CANAL, null, null], null, null);
  S.rootR = mkLeaf([CANAL, null, null, null], null, null);
  S.rootL.rate = newRate();
  S.rootR.rate = newRate();
  S.cuts = [];
  S.list = [S.rootL, S.rootR];
  rebuild(S);
  for (let g = 0; g < 60 && S.n < S.tgt; g++) {
    let best = null, bv = 0;
    for (const p of S.list) {
      if (p.area < 70) continue;
      const w = Math.pow(p.area, 1.5) * (0.4 + Math.random());
      if (w > bv) {
        bv = w;
        best = p;
      }
    }
    if (!best || !split(S, best, true)) break;
  }
}

function seedStates(S) {
  const list = S.list.filter((p) => p.area >= 70);
  const n = list.length;
  // Stratified salinities, so the first picture already holds every stage.
  const order = list.map((p, i) => [Math.random(), p]).sort((a, b) => a[0] - b[0]).map((a) => a[1]);
  order.forEach((p, i) => {
    p.s = cl(((i + Math.random()) / n) * 1.04 - 0.02, 0, 0.99);
    p.rate = newRate();
  });
  for (const p of S.list) {
    if (p.area < 70) {
      p.s = Math.random() * 0.5;
      p.rate = newRate();
    }
  }
}

// One pond is put into each of the three short stages if the prime left none there.
function ensureStages(S) {
  const live = () => S.list.filter((p) => p.area >= 200);
  const has = (...st) => live().some((p) => st.includes(p.stage));
  const take = (cmp) => {
    const c = live().filter((p) => p.stage === 0);
    c.sort(cmp);
    return c[0];
  };
  if (!has(1, 2)) {
    const p = take((a, b) => b.s - a.s);
    if (p) {
      startCrust(S, p);
      p.s = 1;
      p.tc = 0.5;
      p.F = 1.8 + (p.Fmax - 1.8) * 0.5;
    }
  }
  if (!has(3)) {
    const p = take((a, b) => b.area * Math.random() - a.area * Math.random());
    if (p) {
      startScrape(S, p);
      p.su = lerp(p.su, p.send - 19, 0.5);
    }
  }
  if (!has(5)) {
    const p = take((a, b) => b.area * Math.random() - a.area * Math.random());
    if (p) {
      startRefill(S, p);
      p.pr = p.rmax * 0.3;
    }
  }
}

function advance(S, dt, events) {
  S.t += dt;
  const k = S.k;
  S.K2 = cl(k[1], 0.8, 8);
  const c = S.can;
  c.p1 += 0.045 * dt;
  c.p2 -= 0.07 * dt;
  c.cx = 32 + 2.6 * sin(c.q2 * S.t + c.q0);
  c.b = 0.07 * sin(c.q3 * S.t + c.q1);
  for (const p of S.list) {
    // Pond brine mixes while the levee between two ponds is melting.
    if (p.par && p.par.merging) {
      const sib = p.par.kids[0] === p ? p.par.kids[1] : p.par.kids[0];
      const m = (p.s + sib.s) / 2;
      p.s += (m - p.s) * min(1, dt * 0.9 * (1 - p.par.cut.str));
    }
    stepPond(S, p, dt);
    if (p.cg) {
      p.cg.amt += (p.cg.tgt - p.cg.amt) * min(1, dt * 1.2);
      if (!p.cg.perm && p.cg.tgt === 0 && p.cg.amt < 0.02) p.cg = null;
    }
  }
  let done = null;
  for (const cut of S.cuts) {
    cut.str += (cut.tgt - cut.str) * min(1, dt * 0.75);
    if (cut.tgt === 1 && cut.str > 0.995) cut.str = 1;
    if (cut.tgt === 0) cut.str = max(0, cut.str - dt / 9);
    for (let i = cut.gaps.length - 1; i >= 0; i--) {
      const g = cut.gaps[i];
      g.amt += (g.tgt - g.amt) * min(1, dt * 1.2);
      if (!g.perm && g.tgt === 0 && g.amt < 0.02) cut.gaps.splice(i, 1);
    }
  }
  for (const X of S.list.length ? internalNodes(S.rootL, []).concat(internalNodes(S.rootR, [])) : []) if (X.merging && X.cut.str <= 0.001) done = X;
  if (done) finishMerge(S, done);
  S.boxT -= dt;
  if (S.boxT <= 0) {
    boxes(S);
    S.boxT = 3;
  }
  if (events) {
    S.evT -= dt;
    if (S.evT <= 0) {
      const ok = doEvent(S);
      S.evT = !ok ? 3 : S.n === S.tgt ? 40 + 50 * Math.random() : 2.5;
    }
  }
  // Wind, drift of the mottling, clouds and the sun glint all accumulate.
  const kw = cl(k[3], 0, 1);
  S.wg1 += dt * 0.21;
  S.wg2 += dt * 0.53;
  const vw = (1 + 4 * kw) * (1 + 0.45 * sin(S.wg1) + 0.25 * sin(S.wg2));
  S.wa1 += vw * dt;
  S.wa2 += vw * 1.35 * dt;
  S.wph += (1.4 + 3.2 * kw) * dt;
  S.wpsi += 0.0021 * sin(0.013 * S.t + 1.3) * dt * 20;
  S.mdir += 0.01 * gauss() * sqrt(dt);
  S.mo[0] += 0.45 * cos(S.mdir) * dt;
  S.mo[1] += 0.45 * sin(S.mdir) * dt;
  S.mo[2] -= 0.33 * cos(S.mdir + 1.1) * dt;
  S.mo[3] -= 0.33 * sin(S.mdir + 1.1) * dt;
  S.cl0 += 0.016 * dt;
  S.cl1 += 0.011 * dt;
  S.gph[0] += 0.061 * dt;
  S.gph[1] += 0.173 * dt;
  S.gph[2] += 0.043 * dt;
  S.gph[3] += 0.131 * dt;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.tgt = cl(Math.round(12 * exp(0.52 * cl(S.k[2], -1, 1))), 7, 20);
  if (S.first) {
    S.K2 = cl(S.k[1], 0.8, 8);
    layout(S);
    seedStates(S);
    // Twenty-five seconds of sun before the first frame, at this evaporation.
    for (let t = 0; t < 25; t += 0.1) advance(S, 0.1, false);
    ensureStages(S);
    S.first = false;
  }
  advance(S, dt, true);
}

// ---------------------------------------------------------------------------
// drawing

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const k = S.k;
  const hue = k[0] || 0;
  if (abs(hue - S.hueBuilt) > 0.002) {
    buildColours(S, hue);
    S.hueBuilt = hue;
  }
  const kw = cl(k[3], 0, 1);
  const { PU, PV, pidL, pidR, list, lutD, lutS, can: cn } = S;
  const cw = cos(S.wpsi), sw = sin(S.wpsi);
  const aw = 0.07 + 0.16 * kw;
  const ripA = 0.012 + 0.05 * kw;
  const glx = 32 + (5 + 24 * kw) * sin(S.gph[0]) + 5 * sin(S.gph[1]);
  const gly = 64 + (26 + 30 * kw) * sin(S.gph[2]) + 8 * sin(S.gph[3]);
  const gca = cos(S.wpsi + 1.5708), gsa = sin(S.wpsi + 1.5708);
  const [cr, cg2, cb] = S.canal;
  const [wr, wg, wb] = S.wet;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const u = PU[i], v = PV[i];
      const p1 = cn.k1 * v + cn.p1, p2 = cn.k2 * v + cn.p2;
      const uc = cn.cx + cn.b * (v - 64) + cn.a1 * sin(p1) + cn.a2 * sin(p2);
      const slp = cn.b + cn.a1 * cn.k1 * cos(p1) + cn.a2 * cn.k2 * cos(p2);
      const dc = (u - uc) / sqrt(1 + slp * slp);
      const p = list[(dc < 0 ? pidL : pidR)[i]];
      const ed = p.e;

      // Distances to the pond's edges; levee mask, shadow and channel mask from them.
      let dEdge = 99, lev = 0, shade = 0, lit = 0, chan = 0, levHw = 0.85, ltone = 1;
      for (let kk = 0; kk < 4; kk++) {
        const e = ed[kk];
        if (!e) continue;
        let d, str = 1, hw = 0.85, tone = 1;
        if (e === CANAL) {
          d = (kk === 0 ? dc : -dc) - 2.3;
          hw = 0.5;
        } else {
          d = kk === 0 ? u - e.pos : kk === 1 ? e.pos - u : kk === 2 ? v - e.pos : e.pos - v;
          str = e.str;
          hw = e.hw * (0.45 + 0.55 * str);
          tone = e.tone;
        }
        const de = d + (1 - str) * 10;
        if (de < dEdge) dEdge = de;
        const ad = abs(d);
        const m = str * (1 - sm(hw, hw + 0.85, ad));
        // Sun from the upper left: levees to the left and above cast a shadow on this pond.
        if (kk === 0 || kk === 2) {
          const sh = str * (1 - sm(hw + 0.1, hw + 2.3, d)) * (d > hw - 0.5 ? 1 : 0);
          if (sh > shade) shade = sh;
        }
        // A gap in the levee: the dark canal water runs through.
        let gm = 0;
        if (e === CANAL) {
          if (p.cg) gm = p.cg.amt * (1 - sm(1.4, 2.6, abs(v - p.cg.pos)));
          if (gm > 0) gm *= 1 - sm(0.2, 1.3, abs(d));
        } else {
          const a = e.vert ? v : u;
          for (const g of e.gaps) {
            const q = g.amt * (1 - sm(1.4, 2.6, abs(a - g.pos)));
            if (q > gm) gm = q;
          }
          if (gm > 0) gm *= str * (1 - sm(0.3, 1.5, ad));
        }
        if (gm > chan) chan = gm;
        if (m > lev) {
          lev = m;
          levHw = hw;
          ltone = tone * (kk === 1 || kk === 3 ? 1.04 : 0.95);
        }
        if (m > lit) lit = m;
      }

      // Brine colour from salinity, mottled, deeper toward the middle.
      const t = sm(0.4, 7.2, dEdge);
      const mott =
        (vn(u * 0.062 + S.mo[0], v * 0.056 + S.mo[1]) - 0.5) * 1.2 +
        (vn(u * 0.13 + S.mo[2], v * 0.115 + S.mo[3]) - 0.5) * 0.8;
      const sl = cl(p.s + p.so + 0.055 * mott + 0.07 * (1 - t), 0, 1);
      const li = (sl * (NL - 1) + 0.5) | 0;
      let r = lerp(lutS[li * 3], lutD[li * 3], t);
      let g = lerp(lutS[li * 3 + 1], lutD[li * 3 + 1], t);
      let b = lerp(lutS[li * 3 + 2], lutD[li * 3 + 2], t);
      let wf = 1;

      // The pond's stage.
      const st = p.stage;
      if (st === 1 || st === 2 || (st === 0 && p.F > 0) || st === 3) {
        let C = 0;
        let bed = false;
        let rim = 0;
        const crease = abs(vn(u * 0.15 + p.seed, v * 0.15) - 0.5) * 2;
        const Fe = p.F + (crease - 0.5) * 3.0;
        C = sm(0, 1.7, Fe - dEdge);
        rim = exp(-((Fe - dEdge - 0.6) * (Fe - dEdge - 0.6)) / 1.4) * (C > 0.02 ? 1 : 0);
        if (st === 3) {
          const a = p.sg * (p.ax === 0 ? u : v);
          const behind = p.su - a;
          C = 1;
          rim = 0;
          if (behind > -0.6) {
            const sc = sm(-0.6, 0.9, behind);
            bed = true;
            const wt = (1 - sm(0, 15, behind));
            const wetK = wt * wt;
            const bn = 0.94 + 0.12 * vn(u * 0.2 + p.seed, v * 0.2);
            const br = lerp(BED[0] * bn, wr, wetK), bgc = lerp(BED[1] * bn, wg, wetK), bbc = lerp(BED[2] * bn, wb, wetK);
            // The blade pushes a low white windrow of salt ahead of it.
            const wind = exp(-((behind + 0.9) * (behind + 0.9)) / 1.3);
            const cr = lerp(SALT[0], 255, wind), cg = lerp(SALT[1], 255, wind), cb2 = lerp(SALT[2], 255, wind);
            r = lerp(cr, br, sc);
            g = lerp(cg, bgc, sc);
            b = lerp(cb2, bbc, sc);
            wf = 0.35 + 0.65 * (1 - sc);
          } else {
            const wind = exp(-((behind + 0.9) * (behind + 0.9)) / 1.3);
            r = lerp(SALT[0], 255, wind);
            g = lerp(SALT[1], 255, wind);
            b = lerp(SALT[2], 255, wind);
            wf = 0.2;
            bed = true;
          }
        }
        if (!bed && C > 0.001) {
          const grain = 0.93 + 0.1 * vn(u * 0.5 + p.seed, v * 0.5) + 0.04 * (vn(u * 1.1, v * 1.1) - 0.5);
          const tint = 0.1;
          const sr = (SALT[0] * (1 - tint) + r * tint) * grain;
          const sg = (SALT[1] * (1 - tint) + g * tint) * grain;
          const sb = (SALT[2] * (1 - tint) + b * tint) * grain;
          const fr = rim * 0.35 * C;
          r = lerp(r, min(255, sr + (255 - sr) * fr), C);
          g = lerp(g, min(255, sg + (255 - sg) * fr), C);
          b = lerp(b, min(255, sb + (255 - sb) * fr), C);
          wf = 1 - 0.8 * C;
        }
      } else if (st === 5) {
        const dx = u - p.pu, dy = v - p.pv;
        const rr = hypot(dx, dy) + (vn(u * 0.18 + p.seed, v * 0.18) - 0.5) * 3.2;
        const inW = 1 - sm(p.pr - 0.9, p.pr + 0.9, rr);
        const fresh = exp(-(p.pr - rr) / 6) * 0.35 * inW;
        // Water at the sea-water end of the palette; bare bed beyond the front.
        const li0 = 2;
        const wr0 = lerp(lutS[li0 * 3], lutD[li0 * 3], t), wg0 = lerp(lutS[li0 * 3 + 1], lutD[li0 * 3 + 1], t), wb0 = lerp(lutS[li0 * 3 + 2], lutD[li0 * 3 + 2], t);
        const foam = exp(-((rr - p.pr) * (rr - p.pr)) / 1.6) * 0.8;
        const bn = 0.94 + 0.12 * vn(u * 0.2 + p.seed, v * 0.2);
        let rr2 = lerp(BED[0] * bn, wr0, inW), gg2 = lerp(BED[1] * bn, wg0, inW), bb2 = lerp(BED[2] * bn, wb0, inW);
        rr2 += (255 - rr2) * (fresh + foam);
        gg2 += (252 - gg2) * (fresh + foam);
        bb2 += (245 - bb2) * (fresh + foam);
        r = rr2;
        g = gg2;
        b = bb2;
        wf = 0.3 + 0.7 * inW;
      }

      // Wind streaks, ripples and the sun glint lie on the water only.
      const al = x * cw + y * sw, ac = -x * sw + y * cw;
      const stk =
        (vn((al - S.wa1) * 0.034, ac * 0.2 + 7) * 0.65 + vn((al - S.wa2) * 0.07 + 3, ac * 0.34 + 11) * 0.35 - 0.5) * 2;
      const rip = sin(al * 0.85 - S.wph + 2.4 * vn(ac * 0.09, al * 0.03 + 5) * 3) * (0.5 + 0.5 * vn(ac * 0.11 + 4, al * 0.05));
      const mod = 1 + wf * (aw * stk + ripA * rip);
      r *= mod;
      g *= mod;
      b *= mod;
      {
        const gx = x - glx, gy = y - gly;
        const ga = gx * gca + gy * gsa, gc = -gx * gsa + gy * gca;
        const gi = exp(-(ga * ga) / (2 * 15 * 15) - (gc * gc) / (2 * 5.2 * 5.2)) * (0.45 + 0.9 * max(0, stk * 0.5 + 0.5)) * wf * 0.4;
        r += (255 - r) * min(0.9, gi);
        g += (244 - g) * min(0.9, gi);
        b += (214 - b) * min(0.9, gi);
      }
      // The levees' shadow on the water.
      if (shade > 0.001 && wf > 0.01) {
        const q = 0.3 * shade * (0.5 + 0.5 * wf);
        r *= 1 - q;
        g *= 1 - q * 0.9;
        b *= 1 - q * 0.75;
      }
      // Levee.
      if (lev > 0.002) {
        const gr = 0.95 + 0.08 * vn(u * 0.7, v * 0.7);
        const lr = CREAM[0] * ltone * gr, lg = CREAM[1] * ltone * gr, lb = CREAM[2] * ltone * gr;
        r = lerp(r, lr, lev);
        g = lerp(g, lg, lev);
        b = lerp(b, lb, lev);
      }
      // Canal water, and the sluice channels.
      let cw0 = 1 - sm(0.75, 1.65, abs(dc));
      if (chan > cw0) cw0 = chan;
      if (cw0 > 0.002) {
        const fl = 0.9 + 0.22 * vn(v * 0.12 - S.wph * 0.1, dc * 0.5);
        const ca = cw0;
        r = lerp(r, cr * fl, ca);
        g = lerp(g, cg2 * fl, ca);
        b = lerp(b, cb * fl, ca);
      }
      // A drifting cloud shadow over the whole picture.
      const cs = sm(0.5, 0.78, vn(x * 0.024 + S.cl0, y * 0.018 + S.cl1) * 0.7 + vn(x * 0.05 + 40 - S.cl1, y * 0.04 + S.cl0) * 0.3);
      const cd = 1 - 0.16 * cs;
      display.setPixel(x, y, cl(r * cd, 0, 255), cl(g * cd, 0, 255), cl(b * cd * (1 + 0.04 * cs), 0, 255));
    }
  }
}
