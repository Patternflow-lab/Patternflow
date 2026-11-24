// ===== Patternflow pattern =====
// Title:   Reorderable Matrix
// Family:  seriation
// Idea:    A table of 64 rows by 32 columns of numbers drawn as 2 by 2 LED cells holds a hidden block structure that is alive, groups drifting, merging, splitting and trading members, while Bertin's barycenter sort keeps sliding the rows and then the columns into the order that gathers each block along the diagonal.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the reorderable matrix (Jacques Bertin, Semiologie graphique, 1967, from memory) and the barycenter method of seriation, where a row goes where the value-weighted mean of its column positions says, then the columns likewise, round after round (from memory), pattern round 228
// Round:   228
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0..4, Noise=-1..1, Groups=-1..1
//
// Knob 1: Hue. Which scale the numbers are drawn in. At 0 low values are deep indigo, the middle teal and the top pale gold; at 0.25 plum through rose and coral to cream; at 0.5 navy through blue and cyan to white mint; at 0.75 deep teal through green and lime to pale yellow; at 1 back to the first, and in between one scale melts into the next. The darkest cell is a tinted blue or violet at every setting, never black or brown.
// Knob 2: Speed. How often the table is sorted, a sweep being the rows and then the columns. At 0 a sweep comes every 3.3 seconds and each move takes 1.0 second; at 2, where it opens, every 0.89 seconds with moves of 0.62 second; at 4 every 0.24 seconds with moves of 0.17 second, so rows and columns stream past each other.
// Knob 3: Noise. How much of each number is chance instead of structure. At -1 there is none: every block is smooth and shades along its diagonal; at 0, where it opens, the chance in a cell is 0.09 of the scale (rms), about a seventh of the gap between a block and its surroundings; at +1 it is 0.20, and the blocks sink into speckle that the sort can still find, row by row.
// Knob 4: Groups. How many groups the hidden structure has, and how fast it drifts. At -1 two groups (blocks about 32 by 16 cells, and now and then three), at 0.06, where it opens, four to six, at +1 seven (blocks about 9 by 4 cells); merges and splits take 7 to 13 seconds, and the drift of the affinities and the trading of members is 1.5 times as quick at +1 as at -1.

const W = 64, H = 128;
const NR = 64, NC = 32; // rows and columns of the table, each cell 2 by 2 LEDs
const GM = 8; // group slots
const NS = 8; // vertical and horizontal samples per LED
const GAM = 0.5; // how far a cell falls off with the distance between its row's and column's gradient places
const { floor, exp, log, sin, pow, abs, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const smoother = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (6 * t - 15) + 10));
const expo = (mean) => -mean * log(1 - Math.random());

const hash = (n) => {
  const x = sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - floor(x);
};
// Smooth random walk of t: a new random value at every whole step, joined by a Catmull-Rom curve, about -1..1.
function wander(t, ch) {
  const i = floor(t), f = t - i, o = ch * 101.7;
  const a = hash(i - 1 + o) * 2 - 1, b = hash(i + o) * 2 - 1, c = hash(i + 1 + o) * 2 - 1, d = hash(i + 2 + o) * 2 - 1;
  return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
}

// Four scales of five stops each, in OKLCH (lightness, chroma, hue in degrees), at the values 0, 0.3, 0.55, 0.8
// and 1. The knob rests on one of them at 0, 0.25, 0.5 and 0.75 and comes back to the first at 1; between them it
// blends, stop by stop, in lightness, chroma and hue, so a blend stays as saturated as its ends. Every scale has
// the same lightness from its dark end to its light one, and the dark ends are blue, violet or deep teal, never
// brown.
const STOPS = [0, 0.3, 0.55, 0.8, 1];
const LIGHT = [0.27, 0.44, 0.66, 0.83, 0.94];
const SCALES = [
  { c: [0.11, 0.15, 0.125, 0.15, 0.12], h: [285, 255, 195, 125, 95] }, // indigo, blue, teal, lime, pale gold
  { c: [0.1, 0.16, 0.17, 0.14, 0.08], h: [325, 352, 22, 52, 92] }, // plum, rose, coral, amber, cream
  { c: [0.1, 0.16, 0.14, 0.12, 0.07], h: [268, 256, 232, 190, 168] }, // navy, blue, cyan, aqua, white mint
  { c: [0.07, 0.1, 0.16, 0.17, 0.12], h: [225, 190, 152, 122, 100] }, // deep teal, sea green, green, lime, pale yellow
];
const LUTN = 512;
const RAD = Math.PI / 180;

function oklch(L, C, H, out, o) {
  // pull the chroma in until the colour fits in sRGB
  let c = C;
  for (let it = 0; it < 30; it++) {
    const a = c * Math.cos(H * RAD), b = c * Math.sin(H * RAD);
    const l = pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    if ((r >= -0.002 && r <= 1.002 && g >= -0.002 && g <= 1.002 && bl >= -0.002 && bl <= 1.002) || it === 29) {
      const enc = (x) => 255 * (x <= 0.0031308 ? 12.92 * max(0, x) : 1.055 * pow(cl(x, 0, 1), 1 / 2.4) - 0.055);
      out[o] = enc(r); out[o + 1] = enc(g); out[o + 2] = enc(bl);
      return;
    }
    c *= 0.96;
  }
}

function buildLut(P, k1) {
  P.k1 = k1;
  const sp = cl(k1, 0, 1) * 4, k = min(3, floor(sp));
  // rest on a scale, then blend over the middle half of the way to the next
  const w = smooth((sp - k - 0.25) / 0.5);
  const A = SCALES[k], B = SCALES[(k + 1) % 4];
  const C = [], H = [];
  for (let q = 0; q < 5; q++) {
    C.push(A.c[q] + (B.c[q] - A.c[q]) * w);
    let dh = (B.h[q] - A.h[q]) % 360;
    if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
    H.push(A.h[q] + dh * w);
  }
  // unwrap, so that a stop 30 degrees on from 352 is 22 and the ramp does not go the long way round
  for (let q = 1; q < 5; q++) {
    let dh = (H[q] - H[q - 1]) % 360;
    if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
    H[q] = H[q - 1] + dh;
  }
  for (let i = 0; i < LUTN; i++) {
    const v = i / (LUTN - 1);
    let s = 0;
    while (s < 3 && v > STOPS[s + 1]) s++;
    const u = (v - STOPS[s]) / (STOPS[s + 1] - STOPS[s]);
    oklch(LIGHT[s] + (LIGHT[s + 1] - LIGHT[s]) * u, C[s] + (C[s + 1] - C[s]) * u, H[s] + (H[s + 1] - H[s]) * u, P.lut, i * 3);
  }
}

// An axis is the rows or the columns: its items, which group each belongs to, where each stands and where it is going.
function makeAxis(n) {
  const f = () => new Float64Array(n);
  return {
    n,
    a: new Int8Array(n), b: new Int8Array(n), // home group, and the group it is half of, or heading for
    s: f(), sF: f(), sT: f(), sT0: f(), sD: f().fill(1), mig: new Uint8Array(n),
    next: f(),
    pos: f(), from: f(), to: f(), t0: f(), dur: f().fill(1), z: f(), lift: f(),
    rank: new Int16Array(n), byRank: new Int16Array(n), key: f(),
    x: f(), xo: f(), xt: f(),
    cnt: new Int16Array(GM), leave: new Int16Array(GM), pw: new Float64Array(GM).fill(1),
    minCnt: n === NR ? 6 : 3, mean: n === NR ? 36 : 26,
    ids: new Int16Array((n === NR ? H : W) * NS), wts: new Float32Array((n === NR ? H : W) * NS),
    nid: new Uint8Array(n === NR ? H : W),
  };
}

const eAt = (g, h) => g * GM + h;
const aval = (P, e, t) => P.Af[e] + (P.At[e] - P.Af[e]) * smooth((t - P.At0[e]) / P.Ad[e]);
function newTarget(g, h) {
  if (g === h) return 0.62 + 0.38 * Math.random();
  const r = Math.random();
  return r < 0.76 ? 0.02 + 0.15 * Math.random() : r < 0.95 ? 0.2 + 0.18 * Math.random() : 0.4 + 0.2 * Math.random();
}
function setEntry(P, e, to, t, dur) {
  P.Af[e] = aval(P, e, t); P.At[e] = to; P.At0[e] = t; P.Ad[e] = dur;
}
function jumpEntry(P, e, v, t) {
  P.Af[e] = v; P.At[e] = v; P.At0[e] = t; P.Ad[e] = 1;
}

export function setup(P) {
  P.ready = false;
  P.t = 0;
  P.k1 = -1;
  P.lut = new Float32Array(LUTN * 3);
  P.seed = Math.random() * 500;
  P.R = makeAxis(NR); P.C = makeAxis(NC);
  const ne = GM * GM;
  P.Af = new Float64Array(ne); P.At = new Float64Array(ne); P.At0 = new Float64Array(ne); P.Ad = new Float64Array(ne).fill(1);
  P.nxtA = new Float64Array(ne); P.Acur = new Float64Array(ne);
  P.act = new Uint8Array(GM); P.lockT = new Float64Array(GM); P.born = new Float64Array(GM); P.split = new Float64Array(GM);
  P.merges = [];
  P.evT = 3; P.gwant = 4; P.wantSeen = 4;
  P.nv = new Float64Array(NR * NC); P.nf = new Float64Array(NR * NC); P.nt = new Float64Array(NR * NC);
  P.ns0 = new Float64Array(NR * NC); P.nd = new Float64Array(NR * NC).fill(1); P.nnext = new Float64Array(NR * NC);
  P.u = new Float64Array(NR * GM);
  P.v = new Float32Array(NR * NC);
  P.cr = new Float32Array(NR * NC); P.cg = new Float32Array(NR * NC); P.cb = new Float32Array(NR * NC);
  P.sweepT = 0; P.phaseK = 0;
  P.moving = false;
  P.out = new Uint8Array(W * H * 3);
}

// Groups, items and the first affinities.
function initStructure(P, ng) {
  const t = P.t;
  for (let g = 0; g < GM; g++) {
    P.act[g] = g < ng ? 1 : 0;
    P.born[g] = t - 60; P.split[g] = t - 60; P.lockT[g] = 0;
  }
  for (let g = 0; g < GM; g++) for (let h = 0; h < GM; h++) {
    const e = eAt(g, h);
    jumpEntry(P, e, newTarget(g, h), t);
    P.nxtA[e] = t + Math.random() * 25;
  }
  for (const X of [P.R, P.C]) {
    const n = X.n;
    const w = [];
    for (let g = 0; g < ng; g++) w.push(0.55 + 1.2 * Math.random());
    const tot = w.reduce((p, q) => p + q, 0);
    // items to groups by the weights, at least minCnt in each
    let k = 0;
    const idx = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);
    for (let g = 0; g < ng; g++) {
      const take = g === ng - 1 ? n - k : max(X.minCnt, Math.round((w[g] / tot) * n));
      for (let q = 0; q < take && k < n; q++) X.a[idx[k++]] = g;
    }
    while (k < n) X.a[idx[k++]] = (Math.random() * ng) | 0;
    for (let i = 0; i < n; i++) {
      X.b[i] = X.a[i]; X.s[i] = 0; X.sF[i] = 0; X.sT[i] = 0; X.sT0[i] = t; X.sD[i] = 1; X.mig[i] = 0;
      X.next[i] = t + Math.random() * X.mean;
      X.xo[i] = Math.random() * 300; X.xt[i] = 14 + 30 * Math.random();
      // the order they are shown in: scrambled
    }
    const perm = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);
    for (let r = 0; r < n; r++) {
      const i = perm[r];
      X.rank[i] = r; X.byRank[r] = i; X.pos[i] = r; X.from[i] = r; X.to[i] = r; X.t0[i] = t - 10; X.dur[i] = 1;
    }
    recount(P, X);
    // a few items have a weak second group of their own from the start
    for (let i = 0; i < n; i++) if (Math.random() < 0.2) ambient(P, X, i, t, 0.5);
  }
  // noise: every cell has its own value and its own clock for changing it
  for (let k = 0; k < NR * NC; k++) {
    P.nv[k] = P.nf[k] = P.nt[k] = Math.random() + Math.random() - 1;
    P.ns0[k] = t - 10; P.nd[k] = 1; P.nnext[k] = t + Math.random() * 45;
  }
}

function recount(P, X) {
  X.cnt.fill(0); X.leave.fill(0);
  for (let i = 0; i < X.n; i++) { X.cnt[X.a[i]]++; if (X.mig[i]) X.leave[X.a[i]]++; }
}

function pickActive(P, not, wts) {
  let tot = 0;
  for (let g = 0; g < GM; g++) if (P.act[g] && g !== not) tot += wts[g];
  if (tot <= 0) return -1;
  let r = Math.random() * tot;
  for (let g = 0; g < GM; g++) {
    if (!P.act[g] || g === not) continue;
    r -= wts[g];
    if (r <= 0) return g;
  }
  return -1;
}

// An item's second group at a weak weight, which moves it a little off the middle of its block.
function ambient(P, X, i, t, chance) {
  if (X.mig[i]) return;
  const s = X.s[i];
  if (s < 0.02) {
    const g = pickActive(P, X.a[i], X.pw);
    if (g < 0) return;
    X.b[i] = g;
    X.sF[i] = X.s[i]; X.sT[i] = Math.random() < chance ? 0.08 + 0.2 * Math.random() : 0;
  } else {
    X.sF[i] = X.s[i]; X.sT[i] = Math.random() < 0.5 ? 0 : 0.08 + 0.2 * Math.random();
  }
  X.sT0[i] = t; X.sD[i] = 5 + 4 * Math.random();
}

function stepItems(P, X, t, drift) {
  const n = X.n;
  for (let g = 0; g < GM; g++) X.pw[g] = exp(1.3 * wander(t / 24 + P.seed * 0.01, g + (n === NR ? 0 : 20) + 1));
  for (let i = 0; i < n; i++) {
    // where the item stands along its own gradient, which wanders slowly and on its own clock
    X.x[i] = 0.5 + 0.5 * cl(1.25 * wander(t / X.xt[i] + X.xo[i], i + (n === NR ? 300 : 500)), -1, 1);
    X.s[i] = X.sF[i] + (X.sT[i] - X.sF[i]) * smooth((t - X.sT0[i]) / X.sD[i]);
    if (X.mig[i] && t >= X.sT0[i] + X.sD[i]) {
      // arrived: the new group is home
      X.a[i] = X.b[i]; X.s[i] = 0; X.sF[i] = 0; X.sT[i] = 0; X.mig[i] = 0;
      recount(P, X);
      const g = pickActive(P, X.a[i], X.pw);
      if (g >= 0) X.b[i] = g;
    }
    if (t >= X.next[i]) {
      X.next[i] = t + expo(X.mean / drift);
      if (!X.mig[i]) {
        if (Math.random() < 0.6 && X.cnt[X.a[i]] - X.leave[X.a[i]] > X.minCnt && !(P.lockT[X.a[i]] > t)) {
          // the groups' sizes follow a share each, which wanders; items leave the groups that are over their
          // share and go to the ones that are under
          let tw = 0;
          for (let g = 0; g < GM; g++) if (P.act[g]) tw += X.pw[g];
          const wts = new Float64Array(GM);
          for (let g = 0; g < GM; g++) wts[g] = 0.15 + max(0, (X.pw[g] / tw) * n - X.cnt[g]);
          const own = X.a[i];
          const over = X.cnt[own] - (X.pw[own] / tw) * n;
          const g = over > -2 || Math.random() < 0.25 ? pickActive(P, own, wts) : -1;
          if (g >= 0 && !(P.lockT[g] > t)) {
            X.b[i] = g; X.sF[i] = X.s[i]; X.sT[i] = 1; X.sT0[i] = t; X.sD[i] = 3 + 3.5 * Math.random(); X.mig[i] = 1;
            X.leave[own]++;
          }
        } else ambient(P, X, i, t, 0.7);
      }
    }
  }
}

function doMerge(P, t) {
  // two groups that are old enough, and not busy; the pair that likes each other most out of a few drawn
  const cand = [];
  for (let g = 0; g < GM; g++) if (P.act[g] && !(P.lockT[g] > t) && t - P.born[g] > 14) cand.push(g);
  if (cand.length < 2) return false;
  let best = null, bs = -1;
  for (let k = 0; k < 4; k++) {
    const g1 = cand[(Math.random() * cand.length) | 0], g2 = cand[(Math.random() * cand.length) | 0];
    if (g1 === g2) continue;
    const sc = aval(P, eAt(g1, g2), t) + aval(P, eAt(g2, g1), t);
    if (sc > bs) { bs = sc; best = [g1, g2]; }
  }
  if (!best) return false;
  const [g1, g2] = best;
  const T = 7 + 4 * Math.random();
  const D = P.At[eAt(g1, g1)];
  for (let h = 0; h < GM; h++) {
    if (h === g1 || h === g2) continue;
    const r = P.At[eAt(g1, h)], c = P.At[eAt(h, g1)];
    setEntry(P, eAt(g1, h), r, t, T); setEntry(P, eAt(g2, h), r, t, T);
    setEntry(P, eAt(h, g1), c, t, T); setEntry(P, eAt(h, g2), c, t, T);
  }
  for (const [p, q] of [[g1, g1], [g1, g2], [g2, g1], [g2, g2]]) setEntry(P, eAt(p, q), D, t, T);
  P.lockT[g1] = P.lockT[g2] = t + T + 0.05;
  P.merges.push({ at: t + T + 0.02, g1, g2 });
  return true;
}

function finishMerges(P, t) {
  for (let k = P.merges.length - 1; k >= 0; k--) {
    const m = P.merges[k];
    if (t < m.at) continue;
    P.merges.splice(k, 1);
    for (const X of [P.R, P.C]) {
      for (let i = 0; i < X.n; i++) {
        if (X.a[i] === m.g2) X.a[i] = m.g1;
        if (X.b[i] === m.g2) X.b[i] = m.g1;
      }
      recount(P, X);
    }
    P.act[m.g2] = 0;
    P.lockT[m.g1] = 0; P.lockT[m.g2] = 0;
  }
}

function doSplit(P, t) {
  let free = -1;
  for (let g = 0; g < GM; g++) if (!P.act[g]) { free = g; break; }
  if (free < 0) return false;
  const cand = [];
  for (let g = 0; g < GM; g++) {
    if (P.act[g] && !(P.lockT[g] > t) && P.R.cnt[g] >= 11 && P.C.cnt[g] >= 6 && t - P.split[g] > 12) cand.push(g);
  }
  if (!cand.length) return false;
  const g = cand[(Math.random() * cand.length) | 0], s = free;
  // the newcomer starts as an exact copy of g, then the two fall apart
  for (let h = 0; h < GM; h++) {
    if (h === g || h === s) continue;
    jumpEntry(P, eAt(s, h), aval(P, eAt(g, h), t), t);
    jumpEntry(P, eAt(h, s), aval(P, eAt(h, g), t), t);
  }
  const d = aval(P, eAt(g, g), t);
  jumpEntry(P, eAt(s, s), d, t); jumpEntry(P, eAt(g, s), d, t); jumpEntry(P, eAt(s, g), d, t);
  const T = 8 + 5 * Math.random();
  const lo1 = 0.1 + 0.25 * Math.random(), lo2 = 0.1 + 0.25 * Math.random();
  setEntry(P, eAt(g, s), lo1, t, T); setEntry(P, eAt(s, g), lo2, t, T);
  P.nxtA[eAt(g, s)] = P.nxtA[eAt(s, g)] = t + T + 3;
  P.nxtA[eAt(s, s)] = t + 6 + 10 * Math.random();
  P.act[s] = 1; P.born[s] = t; P.split[s] = t; P.split[g] = t; P.lockT[s] = 0;
  for (const X of [P.R, P.C]) {
    const all = [];
    for (let i = 0; i < X.n; i++) if (X.a[i] === g) all.push(i);
    all.sort(() => Math.random() - 0.5);
    // between 40 and 60 percent go to the newcomer
    const take = Math.round(all.length * (0.4 + 0.2 * Math.random()));
    for (let q = 0; q < take; q++) X.a[all[q]] = s;
    recount(P, X);
  }
  return true;
}

function structureStep(P, dt, kv, prerun) {
  P.t += dt;
  const t = P.t;
  const k4 = cl(kv[3], -1, 1);
  const drift = 1.0 + 0.5 * (k4 + 1) / 2;
  const gt = 2.4 + 4.6 * (k4 + 1) / 2 + 0.75 * wander(t / 50 + P.seed * 0.013, 90);
  P.gwant = cl(Math.round(gt), 2, 7);
  stepItems(P, P.R, t, drift);
  stepItems(P, P.C, t, drift);
  finishMerges(P, t);
  // noise: each cell now and then starts on a new value, and gets there over a second or three
  const { nv, nf, nt, ns0, nd, nnext } = P;
  for (let k = 0; k < NR * NC; k++) {
    if (t >= nnext[k]) {
      nf[k] = nv[k]; nt[k] = Math.random() + Math.random() - 1; ns0[k] = t; nd[k] = 1.2 + 2 * Math.random();
      nnext[k] = t + expo(45 / drift);
    }
    const u = (t - ns0[k]) / nd[k];
    nv[k] = u >= 1 ? nt[k] : nf[k] + (nt[k] - nf[k]) * smooth(u);
  }
  // the affinities drift, each on its own clock; with few groups there are few of them, so each changes sooner
  let ngr = 0;
  for (let g = 0; g < GM; g++) ngr += P.act[g];
  for (let g = 0; g < GM; g++) {
    if (!P.act[g] || P.lockT[g] > t) continue;
    for (let h = 0; h < GM; h++) {
      if (!P.act[h] || P.lockT[h] > t) continue;
      const e = eAt(g, h);
      if (t >= P.nxtA[e]) {
        setEntry(P, e, newTarget(g, h), t, 9 + 11 * Math.random());
        P.nxtA[e] = t + (18 + 30 * Math.random()) * max(0.45, ngr / 4) / drift;
      }
    }
  }
  for (let e = 0; e < GM * GM; e++) P.Acur[e] = aval(P, e, t);
  // how many groups there are: merges and splits
  const pending = P.merges.length;
  let na = 0;
  for (let g = 0; g < GM; g++) na += P.act[g];
  const geff = na - pending;
  if (P.gwant !== P.wantSeen) { P.wantSeen = P.gwant; P.evT = min(P.evT, 0.8 + 1.5 * Math.random()); }
  P.evT -= dt;
  if (P.evT <= 0) {
    const diff = geff - P.gwant;
    if (diff > 0) {
      if (pending < 3 && doMerge(P, t)) P.evT = diff >= 2 ? 1 + Math.random() : 2 + 2.5 * Math.random();
      else P.evT = 1.5 + 1.5 * Math.random();
    } else if (diff < 0) {
      if (doSplit(P, t)) P.evT = diff <= -2 ? 1 + Math.random() : 2 + 2.5 * Math.random();
      else P.evT = 1.5 + 1.5 * Math.random();
    } else {
      // at the wanted number: change one thing anyway, a merge or a split, and the other follows. With two groups
      // wanted there is nothing to rewire.
      if (P.gwant <= 2) P.evT = 5;
      else {
        const up = P.gwant >= 7 ? false : Math.random() < 0.5;
        const ok = up ? doSplit(P, t) : doMerge(P, t);
        P.evT = (ok ? 10 + 10 * Math.random() : 2) / drift;
      }
    }
  }
}

// The table: each cell is its row's mixture of groups against its column's, through the affinities, plus noise.
function computeValues(P, amp, t) {
  const { R, C, u, v, Acur, nv } = P;
  for (let i = 0; i < NR; i++) {
    const a = R.a[i] * GM, b = R.b[i] * GM, s = R.s[i], o = i * GM;
    for (let h = 0; h < GM; h++) u[o + h] = (1 - s) * Acur[a + h] + s * Acur[b + h];
  }
  for (let i = 0; i < NR; i++) {
    const o = i * GM;
    for (let j = 0; j < NC; j++) {
      const sj = C.s[j];
      let x = (1 - sj) * u[o + C.a[j]] + sj * u[o + C.b[j]];
      x *= 1 - GAM * abs(R.x[i] - C.x[j]);
      x += amp * nv[i * NC + j];
      v[i * NC + j] = x < 0 ? 0 : x > 1 ? 1 : x;
    }
  }
}

// One round of the barycenter sort on one axis: every item goes where the value-weighted mean of the other axis's
// positions puts it. `ahead` starts the glide that far along, for the first frame.
function sortPhase(P, rows, t, rate, instant, ahead) {
  const X = rows ? P.R : P.C, O = rows ? P.C : P.R, v = P.v;
  const n = X.n, m = O.n;
  for (let i = 0; i < n; i++) {
    let sw = 1e-9, sp = 0;
    for (let j = 0; j < m; j++) {
      const x = rows ? v[i * NC + j] : v[j * NC + i];
      const w = x * x;
      sw += w; sp += w * O.rank[j];
    }
    X.key[i] = sp / sw;
  }
  const order = Array.from(X.byRank); // ties keep the order they had
  order.sort((p, q) => X.key[p] - X.key[q]);
  const dur = min(1.0, 0.7 / rate);
  for (let k = 0; k < n; k++) {
    const i = order[k];
    X.byRank[k] = i;
    const cur = X.pos[i];
    if (instant) { X.rank[i] = k; X.pos[i] = k; X.from[i] = k; X.to[i] = k; X.z[i] = 0; continue; }
    if (k === X.rank[i] && abs(cur - k) < 1e-3) { X.from[i] = X.to[i] = k; X.z[i] = 0; X.rank[i] = k; continue; }
    const d = dur * (0.9 + 0.2 * Math.random());
    X.from[i] = cur; X.to[i] = k; X.dur[i] = d;
    X.t0[i] = t + Math.random() * 0.2 * dur - (ahead || 0) * d;
    X.z[i] = abs(k - cur) + 0.001 * i;
    X.rank[i] = k;
  }
}

function evalPositions(P, t) {
  let moving = false;
  for (const X of [P.R, P.C]) {
    for (let i = 0; i < X.n; i++) {
      const d = X.to[i] - X.from[i];
      if (d === 0) { X.pos[i] = X.to[i]; X.lift[i] = 0; continue; }
      const u = (t - X.t0[i]) / X.dur[i];
      if (u >= 1) { X.pos[i] = X.to[i]; X.from[i] = X.to[i]; X.z[i] = 0; X.lift[i] = 0; continue; }
      moving = true;
      X.pos[i] = X.from[i] + d * smoother(u);
      X.lift[i] = u > 0 ? sin(3.14159 * u) : 0;
    }
  }
  P.moving = moving;
}

// For each LED along an axis, which items it shows and how much of it each. Each LED looks at NS points along
// its length. A point is owned by the front-most item whose 2 LED band covers it; where none does (a gap opened
// by an item that has left) the nearest item reaches over, so the table never shows a seam.
function owners(P, X, len) {
  const { pos, z, n, ids, wts, nid, byRank } = X;
  const rest = !P.moving;
  for (let L = 0; L < len; L++) {
    let k = 0;
    const o = L * NS;
    for (let s = 0; s < NS; s++) {
      const c = L + (s + 0.5) / NS;
      let id = -1;
      if (rest) id = byRank[floor(c / 2)];
      else {
        let bz = -1;
        for (let i = 0; i < n; i++) {
          const lo = pos[i] * 2;
          if (c >= lo && c < lo + 2 && z[i] > bz) { bz = z[i]; id = i; }
        }
        if (id < 0) {
          let nd = 1e9;
          for (let i = 0; i < n; i++) {
            const lo = pos[i] * 2;
            const d = c < lo ? lo - c : c - lo - 2;
            if (d < nd) { nd = d; id = i; }
          }
        }
      }
      let q = 0;
      for (; q < k; q++) if (ids[o + q] === id) break;
      if (q === k) { ids[o + k] = id; wts[o + k] = 0; k++; }
      wts[o + q] += 1 / NS;
    }
    nid[L] = k;
  }
}

function render(P) {
  const { R, C, cr, cg, cb, v, lut, out } = P;
  owners(P, R, H);
  owners(P, C, W);
  // cell colours, lifted a little while an item is in the air
  for (let i = 0; i < NR; i++) {
    const li = R.lift[i] * min(1, R.z[i] / 3);
    for (let j = 0; j < NC; j++) {
      const k = i * NC + j;
      const lf = 1 + 0.13 * max(li, C.lift[j] * min(1, C.z[j] / 3));
      const q = ((v[i * NC + j] * (LUTN - 1) + 0.5) | 0) * 3;
      cr[k] = lut[q] * lf; cg[k] = lut[q + 1] * lf; cb[k] = lut[q + 2] * lf;
    }
  }
  for (let y = 0; y < H; y++) {
    const ny = R.nid[y], oy = y * NS;
    for (let x = 0; x < W; x++) {
      const nx = C.nid[x], ox = x * NS;
      let r = 0, g = 0, b = 0;
      for (let p = 0; p < ny; p++) {
        const row = R.ids[oy + p] * NC, wy = R.wts[oy + p];
        for (let q = 0; q < nx; q++) {
          const k = row + C.ids[ox + q], w = wy * C.wts[ox + q];
          r += w * cr[k]; g += w * cg[k]; b += w * cb[k];
        }
      }
      const o = (y * W + x) * 3;
      out[o] = r > 255 ? 255 : r; out[o + 1] = g > 255 ? 255 : g; out[o + 2] = b > 255 ? 255 : b;
    }
  }
}

export function update(dt, input, P) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  const k1 = cl(kv[0], 0, 1), k2 = cl(kv[1], 0, 4), k3 = cl(kv[2], -1, 1), k4 = cl(kv[3], -1, 1);
  const rate = 0.3 * pow(14, k2 / 4); // sweeps a second
  const amp = 0.22 * pow(1 + k3, 1.15);
  if (abs(k1 - P.k1) > 1e-4) buildLut(P, k1);
  if (!P.ready) {
    P.ready = true;
    P.gwant = cl(Math.round(2.4 + 4.6 * (k4 + 1) / 2), 2, 7);
    P.wantSeen = P.gwant;
    initStructure(P, P.gwant);
    // the hidden structure has been living for a while; nothing has been sorted yet
    for (let i = 0; i < 100; i++) structureStep(P, 0.25, kv, true);
    computeValues(P, amp, P.t);
    // a few instant rounds, then one under way
    for (let i = 0; i < 3; i++) sortPhase(P, i % 2 === 0, P.t, rate, true, 0);
    computeValues(P, amp, P.t);
    sortPhase(P, false, P.t, rate, false, 0.4);
    P.phaseK = 4; P.sweepT = 0.5;
  } else {
    structureStep(P, d, kv, false);
  }
  const t = P.t;
  computeValues(P, amp, t);
  // a phase every half sweep: rows, then columns
  P.sweepT += d * rate * 2;
  if (P.sweepT >= 1) {
    P.sweepT = P.sweepT >= 2 ? 0 : P.sweepT - 1;
    sortPhase(P, P.phaseK % 2 === 0, t, rate, false, 0);
    P.phaseK++;
  }
  evalPositions(P, t);
  render(P);
}

export function draw(display, P) {
  const { out } = P;
  if (!out) return;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, out[o], out[o + 1], out[o + 2]);
    }
}
