// ===== Patternflow pattern =====
// Title:   Sintering Belt
// Family:  sintering
// Idea:    A conveyor furnace seen in section: a slice of metal powder rides down the panel through a wandering hot zone, loose dull red grains of 3 to 8 LED radius come in at the top and only touch, necks grow between them as the glow climbs from dull red through orange and amber to pale gold, the grain centres draw together so the compact narrows and its pores round up and pinch shut, and soft dark grain boundaries fade and move as big crystals eat small ones, until a dense polycrystal with a few round pores leaves the bottom glowing dull orange as it cools.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: neck growth between touching grains by viscous flow (Jacov Frenkel, 1945) and by diffusion (George Kuczynski, 1949), the closing of the last round pores (Robert Coble, 1961), grain growth by boundary migration (Burke and Turnbull, 1952), the Arrhenius rate that makes a small change of furnace temperature a large change of density, and the conveyor furnace of powder metallurgy (from memory)
// Round:   258
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Heat=-1..1, Grain=0..1
//
// Knob 1: Hue. Turns the heat ramp round the wheel. At 0 it is the incandescent one, black to dull red, orange, amber and pale gold; at 0.58 it is blue-white-hot and at 0.33 green, each still running from dark to light.
// Knob 2: Speed. How fast the belt carries the powder down, 1.2 LEDs a second per unit, so 2.4 at the opening. Slow (0.5) keeps a grain in the hot zone for minutes and the compact is solid and tight by half way down; fast (4) pushes the powder through in half a minute and it leaves with its necks barely grown.
// Knob 3: Heat. The furnace's peak temperature, 0.88 to 1.40 of the white-hot scale, 1.14 at the opening. The neck rate is Arrhenius, so the lowest setting sinters about a sixth as fast as the opening and the highest about four times as fast: at the low end the glow stays orange and the compact stays porous, at the high end a gold-to-white band forms early and the compact is solid soon after.
// Knob 4: Grain. The powder's size, a mean grain radius of 3.5 LEDs at 0 (some 170 fine grains on the panel, 4.1 and 125 at the opening) up to 8 at 1 (about 30 coarse ones that neck slowly, the rate going as radius to the minus 2.4). New powder of the new size enters at the top, so the picture follows within a minute.

// What the picture is. A slice of powder is a heap of discs. Each is born above the panel by ballistic deposition with a friction angle,
// falls onto the top of the heap and rolls until a friction angle of 8 to 46 degrees holds it, so the packing is random, loose and just touching. The belt
// carries every grain down at one speed. Each touching pair has a neck ratio L = x/r that grows as L^4 = L0^4 + the integral of
// A f(r) R(T) dt, where R is Arrhenius (activation 25000 K over a temperature that runs from 1000 K cold to 1600 K white-hot), f is
// (4.1/r)^2.4 and T is read at the contact from a furnace profile: a Gaussian bump with a wandering centre (three slow sines),
// a slow pulse of its peak, and a floor that keeps the bottom edge a dull red. A grain's densification m is 0.4 times the mean
// L^2 of its contacts and never falls: m slows the grain (v = v0 (1 - 0.8 m)) and draws it toward the centre line, and a pair is held at the
// distance (r1 + r2)(1 - 0.4 L^2), so the grains overlap as the necks widen. Pairs whose neck is wide and hot, and whose merged area stays
// under a cap, are joined with a union-find, so the crystals at the bottom are groups of up to eight discs; a grain's shade (its
// crystal orientation) chases its crystal's, which is how a boundary dissolves.
// Drawing. Every frame builds a signed distance to the union of the discs, each necked pair blended with a polynomial smooth minimum whose
// width grows with L^2, so the necks and the pores come out smooth. A pixel is lit by the heat at its own row, by a dome of depth below the
// surface, and by a bevel: surfaces that face the hot zone are brighter. Seams between different crystals are a Gaussian in the difference
// of the two discs' distances, 2 LEDs wide and 0.58 dark. The pore side of an edge fades over 1.4 LEDs, so a pore under 2 LEDs across
// fades out instead of flickering, and a faint warm rim lies on it.

const W = 64, H = 128, NPIX = W * H;
const { floor, ceil, sqrt, abs, exp, sin, cos, asin, PI, min, max } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sst = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---- pools
const NG = 440, NC = 1800, MAXADJ = 8, MAXP = 6400, NCR = 8192;
const CX = 32;                      // the centre line the compact shrinks toward
const XL = 1.2, XR = 62.8;          // the walls the powder is poured between
const FEEDY = -30, FLOORY = -6;     // top of the heap is kept above this row; the first layer rests on a floor at this row
const RMIN = 3, RMAX = 8.6;         // grain radius, LEDs: smaller turns to mush

// ---- the furnace
const PAD = 44;                     // heat rows above and below the panel that grains still read
const T0 = 900, T1 = 650, TQ = 25000, TN_REF = 1.0; // Kelvin of Tn = 0, Kelvin per Tn, activation temperature, the Tn where R = 1
const T_REF = T0 + T1 * TN_REF;
const V_PER_KNOB = 1.2;             // LEDs a second for each unit of Speed

// ---- the sintering
const A_NECK = 0.04;               // d(L^4)/dt at R = 1 for a 4.1 LED grain
const R_REF = 4.1, R_POW = 2.4;     // neck rate goes as (R_REF / r)^R_POW
const L_START = 0.10, U_MAX = 0.80; // initial neck ratio; L^4 is held under U_MAX (L 0.915)
const SHR = 0.40;                   // shrink of a pair's distance, as a fraction of r1 + r2, per unit L^2
const MU = 0.8, NU = 0.3;           // slowdown along the belt and pull toward the centre, per unit of m
const BOND_L = 0.22;                // a neck wider than this holds the pair together
const MERGE_L = 0.45, MERGE_TN = 0.5, MERGE_RATE = 1.6, MERGE_CAP = 8; // crystals join above this neck ratio and temperature, up to this many mean grains of area
const TOUCH = 0.35, LOSE = 1.4;     // a pair closer than r1 + r2 + TOUCH is in contact; a loose contact breaks beyond + LOSE

function makeState() {
  return {
    ready: false, t: 0, kn: [0, 2, 0, 0.06],
    v0: 2.4, tpeak: 1.14, rmean: 4, hs: 0, lutHue: -9,
    gx: new Float32Array(NG), gy: new Float32Array(NG), gr: new Float32Array(NG), gm: new Float32Array(NG), gsh: new Float32Array(NG),
    gcr: new Int32Array(NG), alive: new Uint8Array(NG), hi: 0, freeG: new Int16Array(NG), nfreeG: 0,
    adj: new Int16Array(NG * MAXADJ), nadj: new Uint8Array(NG),
    ca: new Int16Array(NC), cb: new Int16Array(NC), cu: new Float32Array(NC), cl: new Float32Array(NC), cs: new Float32Array(NC), cmg: new Float32Array(NC),
    calive: new Uint8Array(NC), hiC: 0, freeC: new Int16Array(NC), nfreeC: 0,
    par: new Int32Array(NCR), car: new Float32Array(NCR), csh: new Float32Array(NCR), cnext: 0,
    pi: new Int16Array(MAXP), pj: new Int16Array(MAXP), pc: new Int16Array(MAXP), np: 0,
    gcell: new Int32Array(NG), hcnt: new Int32Array(64), hstart: new Int32Array(65), hitems: new Int16Array(NG),
    topY: FLOORY, hiY: FLOORY, valley: 0, surf: new Float32Array(16), floorOn: true, yc: 66,
    trow: new Float32Array(H + 2 * PAD), rrow: new Float32Array(H + 2 * PAD),
    F: new Float32Array(NPIX), D1: new Float32Array(NPIX), ID: new Int16Array(NPIX), SEAM: new Float32Array(NPIX),
    lr: new Uint8Array(640), lg: new Uint8Array(640), lb: new Uint8Array(640),
  };
}

export function setup(params) {
  params.s = makeState();
}

function find(S, c) {
  const par = S.par;
  while (par[c] !== c) { par[c] = par[par[c]]; c = par[c]; }
  return c;
}

// ---- the furnace: one temperature and one neck-rate multiplier for every row, once a frame
function heatRows(S) {
  const t = S.t;
  const yc = 68 + 13 * sin((TP * t) / 117.3 + 0.7) + 8 * sin((TP * t) / 43.7 + 2.1) + 3.5 * sin((TP * t) / 19.3 + 4.0);
  const su = 21 + 3 * sin((TP * t) / 61.1 + 1.0), sd = 31 + 4 * sin((TP * t) / 83.9 + 2.5);
  const tp = S.tpeak * (1 + 0.05 * sin((TP * t) / 9.7 + 0.3) + 0.035 * sin((TP * t) / 23.9 + 1.3));
  S.yc = yc;
  for (let k = 0; k < H + 2 * PAD; k++) {
    const y = k - PAD;
    const z = (y - yc) / (y < yc ? su : sd);
    const g = exp(-z * z);
    const fl = 0.25 + 0.10 * cl(y / H, 0, 1);
    const tn = fl + (tp - fl) * g;
    S.trow[k] = tn;
    S.rrow[k] = exp(TQ * (1 / T_REF - 1 / (T0 + T1 * tn)));
  }
}

// ---- grains and contacts
function newCrystal(S, area) {
  const id = S.cnext;
  S.cnext = (S.cnext + 1) % NCR;
  S.par[id] = id; S.car[id] = area;
  S.csh[id] = 1 + 0.22 * (2 * Math.random() - 1);
  return id;
}

function addGrain(S, x, y, r) {
  const g = S.nfreeG > 0 ? S.freeG[--S.nfreeG] : S.hi++;
  if (g >= NG) { S.hi = NG; return -1; }
  S.gx[g] = x; S.gy[g] = y; S.gr[g] = r; S.gm[g] = 0;
  const c = newCrystal(S, PI * r * r);
  S.gcr[g] = c; S.gsh[g] = S.csh[c];
  S.alive[g] = 1; S.nadj[g] = 0;
  return g;
}

function addContact(S, i, j) {
  if (S.nadj[i] >= MAXADJ || S.nadj[j] >= MAXADJ) return -1;
  const c = S.nfreeC > 0 ? S.freeC[--S.nfreeC] : S.hiC++;
  if (c >= NC) { S.hiC = NC; return -1; }
  const L = L_START * (0.8 + 0.4 * Math.random());
  const ri = S.gr[i], rj = S.gr[j], re = (2 * ri * rj) / (ri + rj);
  S.ca[c] = i; S.cb[c] = j; S.cl[c] = L; S.cu[c] = L * L * L * L; S.cmg[c] = 0;
  S.cs[c] = Math.pow(R_REF / re, R_POW);
  S.calive[c] = 1;
  S.adj[i * MAXADJ + S.nadj[i]++] = c;
  S.adj[j * MAXADJ + S.nadj[j]++] = c;
  return c;
}

function dropFromList(S, g, c) {
  const n = S.nadj[g], base = g * MAXADJ;
  for (let k = 0; k < n; k++) {
    if (S.adj[base + k] === c) { S.adj[base + k] = S.adj[base + n - 1]; S.nadj[g] = n - 1; return; }
  }
}

function removeContact(S, c) {
  dropFromList(S, S.ca[c], c);
  dropFromList(S, S.cb[c], c);
  S.calive[c] = 0;
  S.freeC[S.nfreeC++] = c;
}

function removeGrain(S, g) {
  while (S.nadj[g] > 0) removeContact(S, S.adj[g * MAXADJ]);
  const root = find(S, S.gcr[g]);
  S.car[root] -= PI * S.gr[g] * S.gr[g];
  S.alive[g] = 0;
  S.freeG[S.nfreeG++] = g;
}

function findContact(S, i, j) {
  const n = S.nadj[i], base = i * MAXADJ;
  for (let k = 0; k < n; k++) {
    const c = S.adj[base + k];
    if (S.ca[c] === j || S.cb[c] === j) return c;
  }
  return -1;
}

// ---- pouring: one grain falls from above the heap, lands on whatever it meets and rolls until a second grain stops it
// or its friction angle holds it; a loose, random, just-touching packing.
function topOf(S) {
  // the surface of the heap in 16 columns of 4 LEDs: its height there, and where the deepest valley is
  const sf = S.surf;
  sf.fill(S.floorOn ? FLOORY : 1e3);
  for (let k = 0; k < S.hi; k++) {
    if (!S.alive[k]) continue;
    const x = S.gx[k], y = S.gy[k], r = S.gr[k];
    if (y - r > 40) continue;
    for (let b = max(0, floor((x - r) / 4)); b <= min(15, floor((x + r) / 4)); b++) {
      const dx = b * 4 + 2 - x;
      if (dx > -r && dx < r) { const v = y - sqrt(r * r - dx * dx); if (v < sf[b]) sf[b] = v; }
    }
  }
  let lo = -1e9, bi = 0, hiY = 1e9;
  for (let b = 0; b < 16; b++) {
    if (sf[b] > lo) { lo = sf[b]; bi = b; }
    if (sf[b] < hiY) hiY = sf[b];
  }
  S.topY = lo; S.valley = bi; S.hiY = min(hiY, FLOORY);
}

function pour(S) {
  const gx = S.gx, gy = S.gy, gr = S.gr, alive = S.alive, hi = S.hi;
  const r = cl(S.rmean * (0.7 + 0.6 * Math.random()), RMIN, RMAX);
  let x = cl(S.valley * 4 + 2 + (Math.random() - 0.5) * 6, XL + r, XR - r);
  let y = S.hiY - 2 * r - 8;
  const stick = (8 + 38 * Math.random()) * (PI / 180);
  for (let it = 0; it < 12; it++) {
    let ys = S.floorOn ? FLOORY - r : 1e9, kk = -1;
    for (let k = 0; k < hi; k++) {
      if (!alive[k]) continue;
      const dx = x - gx[k], s = r + gr[k];
      if (dx > -s && dx < s) {
        const yy = gy[k] - sqrt(s * s - dx * dx);
        if (yy >= y - 0.02 && yy < ys) { ys = yy; kk = k; }
      }
    }
    if (ys > 1e8) return;
    y = ys;
    if (kk < 0) break;
    const ox = x - gx[kk], s = r + gr[kk];
    const alpha0 = asin(cl(abs(ox) / s, 0, 1));
    if (alpha0 < stick) break;
    const sg = ox > 0 ? 1 : -1;
    let a = alpha0, rolled = false, stopped = false;
    while (a < PI / 2) {
      const na = a + 0.05;
      const nx = gx[kk] + sg * s * sin(na), ny = gy[kk] - s * cos(na);
      let hit = nx < XL + r || nx > XR - r;
      if (!hit) {
        for (let k = 0; k < hi; k++) {
          if (!alive[k] || k === kk) continue;
          const dx = nx - gx[k], dy = ny - gy[k], s2 = r + gr[k] - 0.03;
          if (dx * dx + dy * dy < s2 * s2) { hit = true; break; }
        }
      }
      if (hit) { stopped = true; break; }
      a = na; x = nx; y = ny; rolled = true;
    }
    if (stopped) break;
    if (!rolled) break;
  }
  addGrain(S, cl(x, XL + r, XR - r), y, r);
}

// ---- one step of the belt
function buildPairs(S) {
  const { gx, gy, gr, alive } = S, hi = S.hi;
  for (let c = 0; c < S.hiC; c++) {
    if (!S.calive[c]) continue;
    const i = S.ca[c], j = S.cb[c];
    const dx = gx[j] - gx[i], dy = gy[j] - gy[i], s = gr[i] + gr[j] + LOSE;
    if (S.cl[c] < BOND_L && dx * dx + dy * dy > s * s) removeContact(S, c);
  }
  const cnt = S.hcnt, st = S.hstart;
  cnt.fill(0);
  for (let i = 0; i < hi; i++) {
    if (!alive[i]) continue;
    const ci = cl(floor(gx[i] / 20), 0, 3) + 4 * cl(floor((gy[i] + 60) / 20), 0, 10);
    S.gcell[i] = ci; cnt[ci]++;
  }
  st[0] = 0;
  for (let k = 0; k < 44; k++) st[k + 1] = st[k] + cnt[k];
  cnt.fill(0);
  for (let i = 0; i < hi; i++) {
    if (!alive[i]) continue;
    const ci = S.gcell[i];
    S.hitems[st[ci] + cnt[ci]++] = i;
  }
  let np = 0;
  for (let i = 0; i < hi; i++) {
    if (!alive[i]) continue;
    const ci = S.gcell[i], cx = ci & 3, cy = (ci - cx) >> 2;
    for (let ny = max(0, cy - 1); ny <= min(10, cy + 1); ny++) {
      for (let nx = max(0, cx - 1); nx <= min(3, cx + 1); nx++) {
        const cell = nx + 4 * ny;
        for (let q = st[cell]; q < st[cell + 1]; q++) {
          const j = S.hitems[q];
          if (j <= i) continue;
          const dx = gx[j] - gx[i], dy = gy[j] - gy[i], s0 = gr[i] + gr[j], lim = s0 + 1;
          const d2 = dx * dx + dy * dy;
          if (d2 > lim * lim || np >= MAXP) continue;
          let c = findContact(S, i, j);
          if (c < 0 && d2 < (s0 + TOUCH) * (s0 + TOUCH)) c = addContact(S, i, j);
          S.pi[np] = i; S.pj[np] = j; S.pc[np] = c; np++;
        }
      }
    }
  }
  S.np = np;
}

function step(S, dt) {
  S.t += dt;
  S.v0 += (S.kn[1] * V_PER_KNOB - S.v0) * (1 - exp(-dt / 0.3));
  S.tpeak += (1.14 + 0.26 * cl(S.kn[2], -1, 1) - S.tpeak) * (1 - exp(-dt / 0.4));
  S.rmean = 3.5 + 4.5 * Math.pow(cl(S.kn[3], 0, 1), 0.7);
  heatRows(S);
  const { gx, gy, gr, gm, alive } = S, hi = S.hi;
  for (let i = 0; i < hi; i++) if (alive[i]) gy[i] += S.v0 * (1 - MU * gm[i]) * dt;
  buildPairs(S);
  // necks grow, crystals join
  const acap = MERGE_CAP * PI * S.rmean * S.rmean;
  for (let c = 0; c < S.hiC; c++) {
    if (!S.calive[c]) continue;
    const i = S.ca[c], j = S.cb[c];
    const k = cl(floor((gy[i] + gy[j]) * 0.5) + PAD, 0, H + 2 * PAD - 1);
    const rate = S.rrow[k];
    let u = S.cu[c] + A_NECK * rate * S.cs[c] * dt;
    if (u > U_MAX) u = U_MAX;
    S.cu[c] = u;
    const L = sqrt(sqrt(u));
    S.cl[c] = L;
    if (L > MERGE_L && S.trow[k] > MERGE_TN) {
      const ri = find(S, S.gcr[i]), rj = find(S, S.gcr[j]);
      if (ri !== rj) {
        S.cmg[c] += dt * (L - 0.42) * MERGE_RATE * rate;
        if (S.cmg[c] >= 1 && S.car[ri] + S.car[rj] <= acap) {
          const big = S.car[ri] >= S.car[rj] ? ri : rj, small = big === ri ? rj : ri;
          S.par[small] = big; S.car[big] += S.car[small];
        }
      }
    }
  }
  // densify: a grain's m follows its necks, and pulls it to the centre line
  for (let i = 0; i < hi; i++) {
    if (!alive[i]) continue;
    const n = S.nadj[i];
    if (n === 0) continue;
    let s = 0;
    for (let q = 0; q < n; q++) s += sqrt(S.cu[S.adj[i * MAXADJ + q]]);
    const tgt = (SHR * s) / n;
    if (tgt > gm[i]) { const dm = tgt - gm[i]; gm[i] = tgt; gx[i] -= (gx[i] - CX) * dm * NU; }
  }
  // hold the pairs at the distance their necks allow
  const { pi, pj, pc } = S, np = S.np;
  for (let it = 0; it < 3; it++) {
    for (let p = 0; p < np; p++) {
      const i = pi[p], j = pj[p], c = pc[p];
      let dx = gx[j] - gx[i], dy = gy[j] - gy[i];
      const d2 = dx * dx + dy * dy, s0 = gr[i] + gr[j];
      const l2 = c >= 0 ? sqrt(S.cu[c]) : 0;
      const dmin = s0 * (1 - SHR * l2);
      if (d2 < dmin * dmin) {
        const d = sqrt(d2) || 1e-3;
        if (d2 < 1e-6) { dx = 1; dy = 0; }
        const push = (dmin - d) * 0.9, wi = 1 / (gr[i] * gr[i]), wj = 1 / (gr[j] * gr[j]), fi = wi / (wi + wj);
        const ux = dx / d, uy = dy / d;
        gx[i] -= ux * push * (1 - fi); gy[i] -= uy * push * (1 - fi);
        gx[j] += ux * push * fi; gy[j] += uy * push * fi;
      } else if (c >= 0 && S.cl[c] > BOND_L) {
        const d = sqrt(d2);
        if (d > dmin + 0.12) {
          const pull = (d - dmin - 0.12) * 0.3, wi = 1 / (gr[i] * gr[i]), wj = 1 / (gr[j] * gr[j]), fi = wi / (wi + wj);
          const ux = dx / d, uy = dy / d;
          gx[i] += ux * pull * (1 - fi); gy[i] += uy * pull * (1 - fi);
          gx[j] -= ux * pull * fi; gy[j] -= uy * pull * fi;
        }
      }
    }
  }
  // leave at the bottom, shades follow their crystal
  const a = 1 - exp(-dt / 1.4);
  for (let i = 0; i < hi; i++) {
    if (!alive[i]) continue;
    if (gy[i] - gr[i] > H + 8) { removeGrain(S, i); continue; }
    S.gsh[i] += (S.csh[find(S, S.gcr[i])] - S.gsh[i]) * a;
  }
  // pour new powder at the top
  topOf(S);
  let guard = 0;
  while (S.topY > FEEDY && guard++ < (S.floorOn ? 600 : 8)) { pour(S); topOf(S); }
}

// ---- the heat ramp: shown brightness b to colour. Hue turns the whole ramp; the hue drift with brightness points toward
// yellow at 0, toward cyan at 0.5, and is none at 0.25 and 0.75.
const STOPS = [
  [0.00, 0.000, 1.00, 0.00], [0.06, 0.000, 1.00, 0.10], [0.14, 0.000, 1.00, 0.28], [0.26, 0.004, 1.00, 0.52],
  [0.42, 0.016, 1.00, 0.78], [0.58, 0.045, 1.00, 0.97], [0.72, 0.078, 0.94, 1.00], [0.86, 0.110, 0.70, 1.00],
  [1.00, 0.124, 0.38, 1.00], [1.20, 0.135, 0.12, 1.00], [1.60, 0.135, 0.08, 1.00],
];
const NL = 640, LSC = 400;
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), u = v * (1 - s * (1 - f));
  const m = i % 6;
  return m === 0 ? [v, u, p] : m === 1 ? [q, v, p] : m === 2 ? [p, v, u] : m === 3 ? [p, q, v] : m === 4 ? [u, p, v] : [v, p, q];
}
function buildLut(S, hue) {
  const dir = cos(TP * hue);
  let k = 0;
  for (let n = 0; n < NL; n++) {
    const b = n / LSC;
    while (k < STOPS.length - 2 && b > STOPS[k + 1][0]) k++;
    const a = STOPS[k], z = STOPS[k + 1], f = cl((b - a[0]) / (z[0] - a[0]), 0, 1);
    const prog = a[1] + (z[1] - a[1]) * f;
    const c = hsv(hue + dir * prog, a[2] + (z[2] - a[2]) * f, a[3] + (z[3] - a[3]) * f);
    S.lr[n] = (c[0] * 255 + 0.5) | 0; S.lg[n] = (c[1] * 255 + 0.5) | 0; S.lb[n] = (c[2] * 255 + 0.5) | 0;
  }
  S.lutHue = hue;
}

// ---- the frame
function render(S, display) {
  const { F, D1, ID, SEAM, gx, gy, gr, alive } = S, hi = S.hi;
  D1.fill(99); ID.fill(-1); SEAM.fill(0);
  // the discs
  for (let g = 0; g < hi; g++) {
    if (!alive[g]) continue;
    const x = gx[g], y = gy[g], r = gr[g], M = r + 3;
    if (y + M < 0 || y - M > H) continue;
    const x0 = max(0, floor(x - M)), x1 = min(W - 1, ceil(x + M)), y0 = max(0, floor(y - M)), y1 = min(H - 1, ceil(y + M));
    for (let py = y0; py <= y1; py++) {
      const dy = py + 0.5 - y, row = py * W;
      for (let px = x0; px <= x1; px++) {
        const dx = px + 0.5 - x, d = sqrt(dx * dx + dy * dy) - r, p = row + px;
        if (d < D1[p]) { D1[p] = d; ID[p] = g; }
      }
    }
  }
  F.set(D1);
  // the necks: a smooth minimum of each necked pair
  const geo = [];
  for (let c = 0; c < S.hiC; c++) {
    if (!S.calive[c]) continue;
    const i = S.ca[c], j = S.cb[c], xi = gx[i], yi = gy[i], xj = gx[j], yj = gy[j], ri = gr[i], rj = gr[j];
    const dx = xj - xi, dy = yj - yi, d = sqrt(dx * dx + dy * dy) || 1e-3;
    const t = (d * d + ri * ri - rj * rj) / (2 * d), cxp = xi + (dx / d) * t, cyp = yi + (dy / d) * t;
    if (cyp < -12 || cyp > H + 12) continue;
    const L = S.cl[c], re = (2 * ri * rj) / (ri + rj);
    const k = min(1.9 * L * L * re, 0.85 * re);
    const wl = sqrt(max(0, min(ri * ri - t * t, rj * rj - (d - t) * (d - t))));
    const hs = max(wl, sqrt(k * re * 0.5)) + k + 2.5;
    geo.push(i, j, cxp, cyp, hs, k, L);
    if (k < 0.06) continue;
    const x0 = max(0, floor(cxp - hs)), x1 = min(W - 1, ceil(cxp + hs)), y0 = max(0, floor(cyp - hs)), y1 = min(H - 1, ceil(cyp + hs));
    const ik = 0.25 / k;
    for (let py = y0; py <= y1; py++) {
      const ey = py + 0.5, row = py * W;
      for (let px = x0; px <= x1; px++) {
        const ex = px + 0.5, ax = ex - xi, ay = ey - yi, bx = ex - xj, by = ey - yj;
        const da = sqrt(ax * ax + ay * ay) - ri, db = sqrt(bx * bx + by * by) - rj;
        const hh = k - abs(da - db);
        if (hh > 0) {
          const m = (da < db ? da : db) - hh * hh * ik, p = row + px;
          if (m < F[p]) F[p] = m;
        }
      }
    }
  }
  // the seams between crystals
  for (let q = 0; q < geo.length; q += 7) {
    const i = geo[q], j = geo[q + 1], cxp = geo[q + 2], cyp = geo[q + 3], hs = geo[q + 4];
    if (geo[q + 6] < 0.16) continue;
    const ri = find(S, S.gcr[i]), rj = find(S, S.gcr[j]);
    const strength = ri !== rj ? 1 : sst(0.03, 0.11, abs(S.gsh[i] - S.gsh[j]));
    if (strength < 0.03) continue;
    const xi = gx[i], yi = gy[i], xj = gx[j], yj = gy[j], rI = gr[i], rJ = gr[j];
    const hh = min(hs, 9);
    const x0 = max(0, floor(cxp - hh)), x1 = min(W - 1, ceil(cxp + hh)), y0 = max(0, floor(cyp - hh)), y1 = min(H - 1, ceil(cyp + hh));
    for (let py = y0; py <= y1; py++) {
      const ey = py + 0.5, row = py * W;
      for (let px = x0; px <= x1; px++) {
        const ex = px + 0.5, ax = ex - xi, ay = ey - yi, bx = ex - xj, by = ey - yj;
        const da = sqrt(ax * ax + ay * ay) - rI, db = sqrt(bx * bx + by * by) - rJ;
        const e = db - da, mx = da > db ? da : db;
        if (mx > 1.6) continue;
        const v = strength * exp(-(e * e) / 8) * (1 - sst(0.2, 1.5, mx)), p = row + px;
        if (v > SEAM[p]) SEAM[p] = v;
      }
    }
  }
  // light it
  const { lr, lg, lb, trow, gsh } = S;
  const yc = S.yc;
  let o = 0;
  for (let py = 0; py < H; py++) {
    const tn = trow[py + PAD], ly = cl((yc - py - 0.5) / 9, -1, 1);
    const bg = 0.03 + 0.10 * tn * tn;
    for (let px = 0; px < W; px++, o++) {
      const f = F[o];
      let b = bg;
      if (f < 3.2) {
        const c = 1 - sst(-0.4, 1.0, f);
        const x1 = px > 0 ? F[o - 1] : f, x2 = px < W - 1 ? F[o + 1] : f, y1 = py > 0 ? F[o - W] : f, y2 = py < H - 1 ? F[o + W] : f;
        const gxx = x2 - x1, gyy = y2 - y1, gl = sqrt(gxx * gxx + gyy * gyy) + 1e-4;
        const facing = (gyy / gl) * ly;
        const depth = f < 0 ? -f : 0;
        const g = ID[o];
        const sh = g >= 0 ? gsh[g] : 1;
        const edge = exp(-depth / 2.2);
        const dome = 0.34 + 0.66 * (1 - exp(-depth / 2.3));
        const body = tn * dome * sh * (1 + 0.5 * facing * edge) * (1 - 0.58 * SEAM[o]);
        const rim = f > -0.5 ? 0.30 * tn * (0.55 + 0.45 * (0.5 + 0.5 * facing)) * exp(-(f > 0 ? f : 0) / 0.95) : 0;
        b = c * body + (1 - c) * (bg + rim);
      }
      const n = cl((b * LSC + 0.5) | 0, 0, NL - 1);
      display.setPixel(px, py, lr[n], lg[n], lb[n]);
    }
  }
}

export function update(dt, input, params) {
  const S = params.s || (setup(params), params.s);
  const kv = (input && input.knobValues) || S.kn;
  for (let i = 0; i < 4; i++) if (Number.isFinite(kv[i])) S.kn[i] = kv[i];
  dt = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    S.ready = true;
    S.t = 200 + Math.random() * 400;
    S.v0 = S.kn[1] * V_PER_KNOB;
    S.tpeak = 1.14 + 0.26 * cl(S.kn[2], -1, 1);
    S.hs = S.kn[0];
    S.rmean = 3.5 + 4.5 * Math.pow(cl(S.kn[3], 0, 1), 0.7);
    topOf(S);
    for (let k = 0; k < 600 && S.topY > FEEDY; k++) { pour(S); topOf(S); }
    S.floorOn = false;
    // the first layer must reach the bottom and leave before the first frame
    const T = (1.1 * (H + 54)) / max(S.v0 * 0.8, 0.3), dtp = cl(T / 700, 0.2, 0.5), n = ceil(T / dtp);
    for (let k = 0; k < n; k++) step(S, dtp);
  }
  S.hs += (S.kn[0] - S.hs) * (1 - exp(-dt / 0.25));
  if (dt > 0) step(S, dt);
}

export function draw(display, params) {
  const S = params.s || (setup(params), params.s);
  if (!S.ready) update(0, { knobValues: S.kn }, params);
  if (abs(S.hs - S.lutHue) > 1e-3) buildLut(S, S.hs);
  render(S, display);
}
