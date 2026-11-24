// ===== Patternflow pattern =====
// Title:   Image Quilting
// Family:  quilting
// Idea:    A band of jewel-coloured marble is sewn together in front of you, one patch at a time, each patch cut from a hidden 160 by 160 marble at the spot whose edge best matches its left and upper neighbours, joined to them along the minimum-error cut through the overlap, ringed in light for 0.22 s before it is laid and left with a gold seam that sinks over two seconds while the whole band climbs the panel.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Image Quilting for Texture Synthesis and Transfer (Alexei Efros and William Freeman, SIGGRAPH 2001, from memory), pattern round 236
// Round:   236
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Block=1..3, Tolerance=-1..1, Seams=-1..1
//
// Knob 1: Hue. Adds to the hue of all five jewels at once. At 0 they run sea green, teal, sapphire, amethyst and rose, an equal share of the marble each; at 0.25 blue, violet, magenta, red and yellow; at 0.5 rose, red, orange, lime and green. Orange, yellow and olive are lifted and shaded less so they do not read brown, and the seams stay gold, paler over a warm colour.
// Knob 2: Block. The patch is 8 x Block LED a side, 8 at 1, 16 at the opening 2, 24 at 3, and the overlap is a sixth of it (at least 2 LED, each patch a little more by chance). A patch lights every 0.11 s at 1, 0.39 s at 2 and 0.67 s at 3, a row is 12, 6 or 4 patches, and the band climbs 2.8, 4.8 or 6.8 LED a second, so it crosses the panel in 45, 27 or 19 s. A new Block is used by the row sewn next.
// Knob 3: Tolerance. How far from the best match a patch may stray, -1 to 1. Tolerance is 0 at -1 (the best of the candidates every time, so the marble goes on as if it were never cut), 0.4 at the opening 0 and 0.8 at 1. Of 200 to 1500 random spots in the marble (about 1100 at 16 LED) one is taken at random among those whose overlap error is within 1 + tolerance times the best, or 0.9 x tolerance squared of the way from the best to the median spot. At 1 the colours on the two sides of a seam stop agreeing.
// Knob 4: Seams. How much the joins shine, -1 to 1, which is a share of 0, 0.53 at the opening and 1. The seam flares gold over the join and sinks with a time constant of 0.9 s, full strength from a share of 0.63 up, and the patch's edge flash is 0.3 plus 0.7 times the share. A trace of 0.4 x share cubed is left that fades over 30 s, so at 1 every join in view is still a faint gold line, and at -1 there is none and the band shows a join only where the colours disagree.

const W = 64, H = 128;
const { floor, min, max, round, exp, abs, PI, cos, sin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const E = 160;             // the hidden marble is E by E and wraps round, so it has no edge
const EP = 24;             // columns and rows copied past the edge so a patch never wraps
const EXS = E + EP;
const GC = 2, GN = E / GC; // the marble in cells of 2, to remember which spots are on show
const MG = 24;             // canvas margin either side of the panel
const CWD = W + 2 * MG;
const RHT = 256;           // rows of the ring the band lives in
const FLASH = 0.22;        // seconds a patch glows round its edge before it is laid

// ---- the hidden marble ----------------------------------------------------

function makeGrid(P) {
  const gx = new Float32Array(P * P), gy = new Float32Array(P * P);
  for (let i = 0; i < P * P; i++) {
    const a = Math.random() * 2 * PI;
    gx[i] = cos(a);
    gy[i] = sin(a);
  }
  return { P, gx, gy };
}

// Gradient noise on a torus: P cells round, so what is built from it tiles.
function gnoise(g, x, y) {
  const P = g.P;
  let ix = floor(x), iy = floor(y);
  const fx = x - ix, fy = y - iy;
  ix = ((ix % P) + P) % P;
  iy = ((iy % P) + P) % P;
  const jx = ix + 1 === P ? 0 : ix + 1, jy = iy + 1 === P ? 0 : iy + 1;
  const a = g.gx[iy * P + ix] * fx + g.gy[iy * P + ix] * fy;
  const b = g.gx[iy * P + jx] * (fx - 1) + g.gy[iy * P + jx] * fy;
  const c = g.gx[jy * P + ix] * fx + g.gy[jy * P + ix] * (fy - 1);
  const d = g.gx[jy * P + jx] * (fx - 1) + g.gy[jy * P + jx] * (fy - 1);
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const top = a + (b - a) * u;
  return top + (c + (d - c) * u - top) * v;
}

function fbm(gs, u, v) {
  let s = 0, a = 1, tot = 0;
  for (let o = 0; o < gs.length; o++) {
    const g = gs[o];
    s += a * gnoise(g, u * g.P, v * g.P);
    tot += a;
    a *= 0.5;
  }
  return s / tot;
}

function newMarble() {
  const P = Math.random() < 0.5 ? 3 : 4;
  return {
    warp: 0.5 + 0.5 * Math.random(),
    lean: 0.75 + 0.6 * Math.random(),
    P,
    w1: [makeGrid(2), makeGrid(4)],
    w2: [makeGrid(2), makeGrid(4)],
    big: [makeGrid(2)],
    a: [makeGrid(P), makeGrid(P * 2), makeGrid(P * 4)],
    b: [makeGrid(P + 2), makeGrid(P * 2 + 4)],
  };
}

// One marble pixel at (u, v) in [0, 1): t is where it sits on the palette, l how
// light it is. The palette position follows a warped noise field with a faint
// ripple in it like the layers of agate, and the light has bright veins about
// 2 LED wide with a shadow either side.
function marblePixel(m, u, v, out) {
  const wx = fbm(m.w1, u, v), wy = fbm(m.w2, u + 0.37, v + 0.21);
  const uu = u + m.warp * wx, vv = v + m.warp * wy;
  const n = fbm(m.a, uu, vv);
  const big = fbm(m.big, u + 0.6, v + 0.2);
  const x = n * 2.4 + big * 1.3;
  const band = 0.5 + 0.5 * cos(2 * PI * (n * 3.4 + big * 0.8));
  out[0] = cl(1 / (1 + exp(-3.4 * x)) + 0.1 * (band - 0.5), 0, 1);
  const r = 1 - abs(fbm(m.b, uu + 0.13, vv + 0.41)) * 2.3;
  const vein = sstep(0.82, 0.95, r), halo = sstep(0.45, 0.75, r) * (1 - vein);
  out[1] = cl(0.55 + 0.3 * (band - 0.5) + 0.5 * n + 0.45 * vein - 0.3 * halo, 0, 1);
}

function marbleRow(pool, y) {
  const m = pool.m, T = pool.t, L = pool.l, px = [0, 0];
  const v = y / E;
  const o = y * EXS;
  for (let x = 0; x < E; x++) {
    marblePixel(m, x / E, v, px);
    T[o + x] = px[0];
    L[o + x] = px[1];
  }
  for (let x = 0; x < EP; x++) {
    T[o + E + x] = T[o + x];
    L[o + E + x] = L[o + x];
  }
  if (y < EP) {
    const o2 = (y + E) * EXS;
    for (let x = 0; x < EXS; x++) {
      T[o2 + x] = T[o + x];
      L[o2 + x] = L[o + x];
    }
  }
}

// Spread t evenly over 0 to 1 so every jewel on the palette gets the same share,
// then lean the whole marble towards one end by this marble's own power.
function equalize(pool) {
  const T = pool.t, cdf = new Float32Array(256);
  for (let y = 0; y < E; y++) for (let x = 0; x < E; x++) cdf[min(255, (T[y * EXS + x] * 256) | 0)]++;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += cdf[i];
    cdf[i] = acc / (E * E);
  }
  const gam = pool.m.lean;
  for (let i = 0; i < T.length; i++) T[i] = cdf[min(255, (T[i] * 256) | 0)] ** gam;
}

function newPool() {
  return { m: newMarble(), t: new Float32Array(EXS * EXS), l: new Float32Array(EXS * EXS) };
}

// ---- palette ---------------------------------------------------------------

// Five jewels along t, from sea green through sapphire and amethyst to rose.
const STOPS = [
  [0.40, 0.80, 0.52],
  [0.50, 0.82, 0.70],
  [0.60, 0.78, 0.86],
  [0.76, 0.70, 0.88],
  [0.92, 0.66, 0.97],
];
const GOLD = [1, 0.8, 0.28], RING = [1, 0.94, 0.7];

function buildLut(st, hue) {
  const lut = st.lut, lutW = st.lutW, c = [0, 0, 0];
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * (STOPS.length - 1), k = min(STOPS.length - 2, floor(x)), f = x - k;
    const A = STOPS[k], B = STOPS[k + 1];
    const h = A[0] + (B[0] - A[0]) * f + hue, s = A[1] + (B[1] - A[1]) * f, v = A[2] + (B[2] - A[2]) * f;
    // A dim orange, yellow or olive reads brown on the panel, so on that stretch of the wheel the
    // colour is brighter and shaded less deeply.
    const hh = frac(h);
    const brown = hh > 0.9 ? sstep(0.9, 0.97, hh) : 1 - sstep(0.16, 0.3, hh);
    lutW[i] = brown;
    hsv(h, s * (1 - 0.15 * brown), min(1, v * (1 + 0.5 * brown)), c, 0);
    lut[i * 3] = c[0];
    lut[i * 3 + 1] = c[1];
    lut[i * 3 + 2] = c[2];
  }
  st.lutHue = hue;
}

// ---- state -----------------------------------------------------------------

export function setup(params) {
  const st = {
    k: [0, 2, 0, 0.06], t: 0, init: false,
    pool: [newPool(), null], cur: 0, nxt: 1, mix: 0,
    ep: { state: 0, until: 38, row: 0, from: 0 },
    ug: [new Int16Array(GN * GN), new Int16Array(GN * GN)], used: [],
    ct: new Float32Array(CWD * RHT), cl: new Float32Array(CWD * RHT), cf: new Uint8Array(CWD * RHT),
    dt: new Float32Array(CWD * RHT), dl: new Float32Array(CWD * RHT), df: new Uint8Array(CWD * RHT),
    sm: new Float32Array(CWD * RHT).fill(-1e9),
    S: 0, v: 5, queue: [], nextLight: 0, litInRow: 0,
    rowN: 0, B: 16, ry: 0, rot: 0, yBottom: 0, rx: [], k0: 0, tp: 0.36, vr: 5,
    job: { active: false, done: false, nc: 0, n: 0, eo: new Int32Array(1200), tt: new Float32Array(1200), tl: new Float32Array(1200),
      errs: new Float32Array(1600), cp: new Uint8Array(1600), cx: new Int16Array(1600), cy: new Int16Array(1600), x0: 0, y0: 0, oL: 0, oT: 0 },
    pending: [], flash: [],
    lut: new Float32Array(768), lutW: new Float32Array(256), lutHue: -1,
    rc: new Float32Array((H + 1) * W * 3), colr: new Float32Array(W), colg: new Float32Array(W), colb: new Float32Array(W), gap: new Int32Array(W),
    tmpE: new Float32Array(1600),
    eV: new Float32Array(24 * 12), cV: new Float32Array(24 * 12), pV: new Int8Array(24),
    eH: new Float32Array(24 * 12), cH: new Float32Array(24 * 12), pH: new Int8Array(24),
  };
  const p0 = st.pool[0];
  for (let y = 0; y < E; y++) marbleRow(p0, y);
  equalize(p0);
  params.st = st;
}

// ---- sewing ---------------------------------------------------------------

const ringIdx = (y) => ((y % RHT) + RHT) % RHT;

// A spot on show rules out the spots within half a patch's step of it, so no two patches on
// the panel share more than a quarter of what they show.
function markUsed(st, p, ex, ey, r, d) {
  const g = st.ug[p];
  const x0 = floor((ex - r) / GC), x1 = floor((ex + r) / GC), y0 = floor((ey - r) / GC), y1 = floor((ey + r) / GC);
  for (let cy = y0; cy <= y1; cy++) {
    const ro = (((cy % GN) + GN) % GN) * GN;
    for (let cx = x0; cx <= x1; cx++) g[ro + (((cx % GN) + GN) % GN)] += d;
  }
}

// A new row: its size, where it starts and the x of each patch in it.
function planRow(st) {
  const B = cl(round(8 * cl(st.k[1], 1, 3)), 8, 24);
  const ovMin = max(2, round(B / 6));
  const first = st.rowN === 0;
  const oldBottom = first ? 0 : st.yBottom;
  st.B = B;
  st.rot = first ? 0 : min(B - 4, ovMin + floor(Math.random() * (ovMin * 0.7 + 1)));
  st.ry = first ? 0 : st.yBottom - st.rot;
  st.yBottom = st.ry + B;
  for (let y = oldBottom; y < st.yBottom; y++) {
    const o = ringIdx(y) * CWD;
    st.cf.fill(0, o, o + CWD);
    st.df.fill(0, o, o + CWD);
    st.sm.fill(-1e9, o, o + CWD);
  }
  st.rx = [];
  let x = -floor(Math.random() * B * 0.6);
  for (;;) {
    st.rx.push(MG + x);
    if (x + B >= W) break;
    x += B - (ovMin + floor(Math.random() * (ovMin * 0.8 + 1)));
  }
  st.k0 = 0;
  st.rowN++;
  st.tp = (0.03 * B - 0.12) * (0.85 + 0.3 * Math.random());
  // The panel climbs one row's step in the time its patches take to light, and a third of a second over.
  st.vr = (B - 1.35 * ovMin) / (st.rx.length * st.tp + 0.35);
}

function startJob(st) {
  const job = st.job, B = st.B, k = st.k0;
  const x0 = st.rx[k], y0 = st.ry;
  const oL = k > 0 ? st.rx[k - 1] + B - x0 : 0, oT = st.rot;
  let n = 0;
  for (let i = 0; i < B; i++) {
    const ro = ringIdx(y0 + i) * CWD + x0;
    for (let j = 0; j < B; j++) {
      if (j < oL || i < oT) {
        const o = ro + j;
        if (st.cf[o]) {
          job.eo[n] = i * EXS + j;
          job.tt[n] = st.ct[o];
          job.tl[n] = st.cl[o];
          n++;
        }
      }
    }
  }
  job.n = n; job.x0 = x0; job.y0 = y0; job.oL = oL; job.oT = oT;
  job.nc = 0;
  job.want = n === 0 ? 1 : cl(round(110000 / max(30, n)), 200, 1500);
  job.active = true;
  job.done = false;
}

// Candidates are random spots in the marble, scored by the squared error of the
// overlap, a slice of them each frame.
function evalCands(st, fast) {
  const job = st.job, n = job.n;
  const cnt = min(job.want - job.nc, fast ? 1e9 : max(4, floor(100000 / max(8, n))));
  const { eo, tt, tl } = job;
  for (let c = 0; c < cnt; c++) {
    const p = st.mix > 0 && Math.random() < st.mix ? st.nxt : st.cur;
    const g = st.ug[p];
    let ex = 0, ey = 0;
    for (let tries = 0; tries < 14; tries++) {
      ex = floor(Math.random() * E);
      ey = floor(Math.random() * E);
      if (g[(ey >> 1) * GN + (ex >> 1)] === 0) break;
    }
    const T = st.pool[p].t, L = st.pool[p].l, base = ey * EXS + ex;
    let s = 0;
    for (let q = 0; q < n; q++) {
      const a = T[base + eo[q]] - tt[q], b = L[base + eo[q]] - tl[q];
      s += a * a + 0.35 * b * b;
    }
    const i = job.nc++;
    job.errs[i] = s; job.cp[i] = p; job.cx[i] = ex; job.cy[i] = ey;
  }
  if (job.nc >= job.want) job.done = true;
}

// The paper's rule, a candidate within (1 + tol) of the best error, and past it
// the share tol^2 of the way from the best towards the median candidate.
function choose(st) {
  const job = st.job, C = job.nc;
  if (job.n === 0) return floor(Math.random() * C);
  let lo = 1e30;
  for (let c = 0; c < C; c++) if (job.errs[c] < lo) lo = job.errs[c];
  const tmp = st.tmpE.subarray(0, C);
  tmp.set(job.errs.subarray(0, C));
  tmp.sort();
  const med = tmp[C >> 1];
  const u = st.tolU;
  const thr = max(lo * (1 + 0.8 * u), lo + u * u * 0.9 * (med - lo));
  let m = 0;
  for (let c = 0; c < C; c++) if (job.errs[c] <= thr) tmp[m++] = c;
  return tmp[floor(Math.random() * m)];
}

// The cheapest path through an error strip, e[a * w + b], a along the strip and
// b across it, a step of at most one across per step along.
function cutPath(e, len, w, cc, path) {
  for (let b = 0; b < w; b++) cc[b] = e[b];
  for (let a = 1; a < len; a++) {
    const r = a * w, q = r - w;
    for (let b = 0; b < w; b++) {
      let m = cc[q + b];
      if (b > 0 && cc[q + b - 1] < m) m = cc[q + b - 1];
      if (b < w - 1 && cc[q + b + 1] < m) m = cc[q + b + 1];
      cc[r + b] = e[r + b] + m;
    }
  }
  let b = 0, best = cc[(len - 1) * w];
  for (let k = 1; k < w; k++) if (cc[(len - 1) * w + k] < best) (best = cc[(len - 1) * w + k]), (b = k);
  path[len - 1] = b;
  for (let a = len - 2; a >= 0; a--) {
    const r = a * w;
    let bb = b, bv = cc[r + b];
    if (b > 0 && cc[r + b - 1] < bv) (bv = cc[r + b - 1]), (bb = b - 1);
    if (b < w - 1 && cc[r + b + 1] < bv) bb = b + 1;
    b = bb;
    path[a] = b;
  }
}

function place(st) {
  const job = st.job, B = st.B, c = choose(st);
  const p = job.cp[c], ex = job.cx[c], ey = job.cy[c];
  const T = st.pool[p].t, L = st.pool[p].l;
  const { x0, y0, oL, oT } = job;
  const mask = new Uint8Array(B * B).fill(1);
  const err = (o, e) => {
    const a = T[e] - st.ct[o], b = L[e] - st.cl[o];
    return a * a + 0.35 * b * b;
  };
  if (oL > 0) {
    const e = st.eV;
    for (let i = 0; i < B; i++) {
      const ro = ringIdx(y0 + i) * CWD + x0, re = (ey + i) * EXS + ex;
      for (let j = 0; j < oL; j++) e[i * oL + j] = st.cf[ro + j] ? err(ro + j, re + j) : 0;
    }
    cutPath(e, B, oL, st.cV, st.pV);
    for (let i = 0; i < B; i++) for (let j = 0; j < st.pV[i]; j++) mask[i * B + j] = 0;
  }
  if (oT > 0) {
    const e = st.eH;
    for (let j = 0; j < B; j++) {
      let dead = false;
      for (let i = 0; i < oT; i++) {
        const o = ringIdx(y0 + i) * CWD + x0 + j;
        e[j * oT + i] = dead ? 1e9 : !st.cf[o] ? ((dead = true), 0) : err(o, (ey + i) * EXS + ex + j);
      }
    }
    cutPath(e, B, oT, st.cH, st.pH);
    for (let j = 0; j < B; j++) for (let i = 0; i < st.pH[j]; i++) mask[i * B + j] = 0;
  }
  // Nothing may be left of the old where there was no old.
  for (let i = 0; i < B; i++) for (let j = 0; j < B; j++) if (!mask[i * B + j] && !st.cf[ringIdx(y0 + i) * CWD + x0 + j]) mask[i * B + j] = 1;

  const pt = new Float32Array(B * B), pl = new Float32Array(B * B);
  for (let i = 0; i < B; i++) {
    const ro = ringIdx(y0 + i) * CWD + x0, re = (ey + i) * EXS + ex;
    for (let j = 0; j < B; j++) {
      const k = i * B + j;
      if (!mask[k]) continue;
      pt[k] = T[re + j];
      pl[k] = L[re + j];
      st.ct[ro + j] = pt[k];
      st.cl[ro + j] = pl[k];
      st.cf[ro + j] = 1;
    }
  }
  // The seam is the pairs of neighbours that come from different patches.
  const seam = [];
  for (let i = 0; i < B; i++) {
    const ro = ringIdx(y0 + i) * CWD + x0;
    for (let j = 0; j < B; j++) {
      const k = i * B + j, o = ro + j;
      if (mask[k]) {
        if (j > 0 ? !mask[k - 1] : st.cf[o - 1]) seam.push(o, o - 1);
        const ou = ringIdx(y0 + i - 1) * CWD + x0 + j;
        if (i > 0 ? !mask[k - B] : st.cf[ou]) seam.push(o, ou);
      } else {
        if (j > 0 && mask[k - 1]) seam.push(o, o - 1);
        if (i > 0 && mask[k - B]) seam.push(o, ringIdx(y0 + i - 1) * CWD + x0 + j);
      }
    }
  }
  st.queue.push({ x0, y0, B, tc: 0, tb: 0, pt, pl, mask, seam, tp: st.tp, vr: st.vr, ri: st.k0 });
  const r = round(0.5 * (B - max(2, round(B / 6))));
  st.used.push({ p, ex, ey, r, bottom: y0 + B });
  markUsed(st, p, ex, ey, r, 1);
}

// The patch lights: its edge glows for FLASH seconds, then it is laid and its seam flares.
function light(st, rec) {
  const { B, mask, seam } = rec;
  rec.tc = st.t;
  rec.tb = st.t + FLASH;
  for (let i = 0; i < B; i++) {
    const ro = ringIdx(rec.y0 + i) * CWD + rec.x0;
    for (let j = 0; j < B; j++) if (mask[i * B + j]) st.sm[ro + j] = -1e9;
  }
  for (let q = 0; q < seam.length; q++) st.sm[seam[q]] = rec.tb;
  st.pending.push(rec);
  st.flash.push(rec);
  st.nextLight = st.t + rec.tp;
  st.litInRow = rec.ri === 0 ? 1 : st.litInRow + 1;
}

function commit(st, rec) {
  const { x0, y0, B, pt, pl, mask } = rec;
  for (let i = 0; i < B; i++) {
    const ro = ringIdx(y0 + i) * CWD + x0;
    for (let j = 0; j < B; j++) {
      const k = i * B + j;
      if (!mask[k]) continue;
      st.dt[ro + j] = pt[k];
      st.dl[ro + j] = pl[k];
      st.df[ro + j] = 1;
    }
  }
}

// Every so often a second marble is made in the background and mixed in, so the
// band's colours and veining drift over minutes.
function epochStep(st) {
  const e = st.ep, t = st.t;
  if (e.state === 0) {
    if (t < e.until) return;
    e.state = 1;
    e.row = 0;
    const p = st.nxt;
    if (!st.pool[p]) st.pool[p] = newPool();
    st.pool[p].m = newMarble();
    st.ug[p].fill(0);
    st.used = st.used.filter((u) => u.p !== p);
  }
  if (e.state === 1) {
    for (let i = 0; i < 8 && e.row < E; i++) marbleRow(st.pool[st.nxt], e.row++);
    if (e.row >= E) {
      equalize(st.pool[st.nxt]);
      e.state = 2;
      e.from = t;
    }
  } else if (e.state === 2) {
    st.mix = sstep(0, 1, (t - e.from) / 30);
    if (st.mix >= 1) {
      st.cur = st.nxt;
      st.nxt = 1 - st.cur;
      st.mix = 0;
      e.state = 0;
      e.until = t + 36 + 16 * Math.random();
    }
  }
}

function step(st, d, fast) {
  st.t += d;
  const t = st.t;
  while (st.pending.length && st.pending[0].tb <= t) commit(st, st.pending.shift());
  while (st.flash.length && st.flash[0].tb + 0.3 < t) st.flash.shift();
  epochStep(st);
  // The next row is sewn ahead, dim, until it reaches below the panel's edge.
  if (st.k0 >= st.rx.length && st.yBottom < st.S + H + 10 && st.queue.length < 60) planRow(st);
  if (st.k0 < st.rx.length) {
    const job = st.job;
    if (!job.active) startJob(st);
    if (!job.done) evalCands(st, fast);
    if (job.done) {
      place(st);
      job.active = false;
      st.k0++;
    }
  }
  // A row's patches light one after another once the whole row is in view.
  const head = st.queue[0];
  if (head && t >= st.nextLight && head.y0 + head.B - st.S <= H + 1) light(st, st.queue.shift());
  const vt = head ? head.vr : st.vr;
  st.v += (vt - st.v) * (1 - exp(-d / 1.2));
  st.S += st.v * d;
  // Patches that have left the top of the panel can be picked again.
  while (st.used.length && st.used[0].bottom < st.S - 4) {
    const u = st.used.shift();
    markUsed(st, u.p, u.ex, u.ey, u.r, -1);
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = input.knobValues || [0, 2, 0, 0.06];
  st.k = [kv[0], cl(kv[1], 1, 3), cl(kv[2], -1, 1), cl(kv[3], -1, 1)];
  st.tolU = (st.k[2] + 1) / 2;
  st.seamK = (st.k[3] + 1) / 2;
  if (!st.init) {
    st.init = true;
    planRow(st);
    st.S = st.yBottom - H;
    st.v = st.vr;
    // Sew until the panel is full, with the seams of the last rows still alight.
    for (let g = 0; g < 12000 && !(st.S >= 0 && st.litInRow >= 2); g++) step(st, 1 / 30, true);
    return;
  }
  step(st, cl(dt || 0, 0, 0.1), false);
}

// ---- drawing ---------------------------------------------------------------

const GHOST = 0.7;

function shaded(st, t, l, out) {
  const li = ((t < 0 ? 0 : t > 1 ? 1 : t) * 255 + 0.5) | 0, lut = st.lut, warm = st.lutW[li];
  const sh0 = 0.5 + 0.55 * l, sh = sh0 + (1 - min(1, sh0)) * 0.5 * warm, w = sstep(0.8, 1, l) * 0.55;
  out[3] = warm;
  const r = min(1, lut[li * 3] * sh), g = min(1, lut[li * 3 + 1] * sh), b = min(1, lut[li * 3 + 2] * sh);
  out[0] = r + (1 - r) * w;
  out[1] = g + (1 - g) * w;
  out[2] = b + (1 - b) * w;
}

export function draw(display, params) {
  const st = params.st;
  if (st.lutHue !== st.k[0]) buildLut(st, st.k[0]);
  const T = st.t, S = st.S, iy0 = floor(S), fy = S - iy0;
  const seamK = st.seamK, rc = st.rc;
  const { colr, colg, colb, gap } = st;
  const px = [0, 0, 0, 0];
  gap.fill(0);
  colr.fill(0); colg.fill(0); colb.fill(0);
  for (let r = 0; r <= H; r++) {
    const ys = iy0 + r, base = ringIdx(ys) * CWD + MG;
    for (let x = 0; x < W; x++) {
      const o = base + x, q = (r * W + x) * 3;
      if (ys >= 0 && (st.df[o] || st.cf[o])) {
        const live = st.df[o];
        if (live) shaded(st, st.dt[o], st.dl[o], px);
        else {
          shaded(st, st.ct[o], st.cl[o], px);
          px[0] *= GHOST; px[1] *= GHOST; px[2] *= GHOST;
        }
        colr[x] = px[0]; colg[x] = px[1]; colb[x] = px[2];
        gap[x] = 0;
        const age = live && st.sm[o] > -1e8 ? T - st.sm[o] : -1;
        if (age >= 0) {
          // The flare covers the colour with gold, then a faint trace of it stays and adds light.
          const a = min(1, seamK * 1.6) * exp(-age / 0.9), res = 0.4 * seamK ** 3 * exp(-age / 30);
          // Over a warm colour the gold would vanish, so it goes paler.
          const gw = px[3], gr = GOLD[0], gg = GOLD[1] + 0.17 * gw, gb = GOLD[2] + 0.55 * gw;
          px[0] = min(1, px[0] + (gr - px[0]) * a + res);
          px[1] = min(1, px[1] + (gg - px[1]) * a + res * 0.62);
          px[2] = min(1, px[2] + (gb - px[2]) * a + res * 0.2);
        }
        rc[q] = px[0]; rc[q + 1] = px[1]; rc[q + 2] = px[2];
      } else {
        // Not sewn yet: the last colour above it, dimmed, like threads waiting.
        const g = ++gap[x], f = 0.26 * exp(-g * 0.04);
        rc[q] = colr[x] * f; rc[q + 1] = colg[x] * f; rc[q + 2] = colb[x] * f;
      }
    }
  }
  // A patch about to be laid shows through and glows round its edge.
  const ringK = 0.3 + 0.7 * seamK;
  for (const rec of st.flash) {
    const u = T - rec.tc, B = rec.B, thick = B >= 12 ? 2 : 1;
    const pre = u < 0 ? 0 : u < FLASH ? sstep(0, 1, u / FLASH) : 0;
    const ra = (u < 0.06 ? u / 0.06 : u < FLASH ? 1 : 1 - (u - FLASH) / 0.08) * ringK * 0.8;
    if (u < 0 || (ra <= 0 && pre <= 0)) continue;
    for (let i = 0; i < B; i++) {
      const r = rec.y0 + i - iy0;
      if (r < 0 || r > H) continue;
      for (let j = 0; j < B; j++) {
        const x = rec.x0 + j - MG;
        if (x < 0 || x >= W) continue;
        const k = i * B + j, q = (r * W + x) * 3;
        if (pre > 0 && rec.mask[k]) {
          shaded(st, rec.pt[k], rec.pl[k], px);
          rc[q] += (px[0] - rc[q]) * pre;
          rc[q + 1] += (px[1] - rc[q + 1]) * pre;
          rc[q + 2] += (px[2] - rc[q + 2]) * pre;
        }
        if (ra > 0 && min(min(i, j), min(B - 1 - i, B - 1 - j)) < thick) {
          rc[q] += (RING[0] - rc[q]) * ra;
          rc[q + 1] += (RING[1] - rc[q + 1]) * ra;
          rc[q + 2] += (RING[2] - rc[q + 2]) * ra;
        }
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const q = (y * W + x) * 3, q2 = q + W * 3;
      const r = rc[q] + (rc[q2] - rc[q]) * fy, g = rc[q + 1] + (rc[q2 + 1] - rc[q + 1]) * fy, b = rc[q + 2] + (rc[q2 + 2] - rc[q + 2]) * fy;
      display.setPixel(x, y, round(min(1, r) * 255), round(min(1, g) * 255), round(min(1, b) * 255));
    }
  }
}
