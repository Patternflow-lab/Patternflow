// ===== Patternflow pattern =====
// Title:   Well Log
// Family:  welllog
// Idea:    The wireline log of an invented borehole scrolls up the panel as the hole goes deeper, with a column of beds in flat colour, a gamma ray curve filled yellow for sand and grey-green for shale, three resistivity curves on a log grid with red or blue between the deep and the shallow one, and density against neutron shaded yellow where they cross over for gas, so that a gas sand lights up every track at once while the rate of drilling changes from bed to bed.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: electrical well logging, first run in the Pechelbronn field in 1927 by Conrad and Marcel Schlumberger and Henri Doll (from memory), the side-by-side tracks and the sand and shale fills and the density and neutron gas crossover of the standard log layout, and a Markov chain of lithologies with log-normal bed thickness as in the stratigraphic models of Vistelius and Krumbein (1960s, from memory), pattern round 238
// Round:   238
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0..3.5, Bed=-1..1, Pay=0..0.18
//
// Knob 1: Hue. Turns every fill and curve round the wheel. At 0 sand is yellow, shale grey-green, limestone steel blue, dolomite violet, salt pale cyan, volcanic ash rose and coal near black, with red and blue between the resistivity curves. The near-black ground only sways about navy and violet.
// Knob 2: Speed. 0 to 3.5, opening at 2. The drilling rate that moves the record up the panel: 4 rows a second at 0, 10 at 2 and 18 at 3.5, before the rock changes it. Limestone and dolomite slow it to about half, shale and coal quicken it by a third, and a slow drift on top keeps it from ever being steady.
// Knob 3: Bed. -1 to 1, opening at 0. The typical thickness of a bed: 5 rows at -1, 12 at 0 and 30 at 1, drawn log-normal so thin and thick beds mix. The bed being drilled stretches or shrinks at once, so the change shows at the bottom edge within a second.
// Knob 4: Pay. 0 to 0.18, opening at 0.06. The share of sands that carry gas: none at 0, a third at 0.06 and all of them at 0.18. Sands already on the panel switch over within a second, gas sits on top of water in each sand with a sharp contact, and more sands are laid down as the knob rises, so at the top the crossover shading takes over the density track.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, min, max, abs, exp, log, pow, sqrt, sin, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
function pickW(w) {
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i];
  let r = Math.random() * s;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r < 0) return i;
  }
  return w.length - 1;
}

// ---- layout ---------------------------------------------------------------
// Four tracks of 10, 17, 17 and 17 columns with a one column rule between them. A curve is kept
// 1.3 columns from the track edge so its two LEDs stay inside; a value off the scale rides the edge.
const TX = [0, 11, 29, 47], TWD = [10, 17, 17, 17], RULE = [10, 28, 46];
const PADX = 1.3;
const px = (t, p) => PADX + cl(p, 0, 1) * (TWD[t] - 2 * PADX);
const CUT = 0.46;  // the gamma ray sand and shale cutoff, as a share of the track

// ---- colour ---------------------------------------------------------------
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A dim colour on the red-orange-yellow stretch of the wheel reads brown, so it is lifted and paled there.
function dim(h, s, v, out) {
  const c = h - floor(h), b = c > 0.9 ? sstep(0.9, 0.97, c) : 1 - sstep(0.15, 0.26, c);
  hsv(h, s * (1 - 0.5 * b), min(1, v * (1 + 1.1 * b * (1 - v))), out);
}

function buildPalette(st, hue) {
  const tmp = [0, 0, 0];
  const m = (h, s, v) => {
    dim(h + hue, s, v, tmp);
    return [tmp[0] * 255, tmp[1] * 255, tmp[2] * 255];
  };
  // The lithology column: sandstone, shale, limestone, dolomite, coal, salt, ash.
  st.LC = [m(0.135, 0.58, 0.92), m(0.4, 0.3, 0.52), m(0.585, 0.58, 0.8), m(0.75, 0.52, 0.82), m(0.66, 0.6, 0.15), m(0.5, 0.32, 0.97), m(0.93, 0.5, 0.95)];
  st.fSand = m(0.14, 0.68, 0.88);
  st.fShale = m(0.4, 0.34, 0.5);
  st.fRed = m(0.985, 0.78, 0.72);
  st.fBlue = m(0.615, 0.78, 0.74);
  st.fGas = m(0.15, 0.72, 0.92);
  st.fGrey = m(0.62, 0.14, 0.52);
  st.fSalt = m(0.5, 0.4, 0.5);
  st.lGR = m(0.3, 0.38, 1);
  st.lRD = m(0.99, 0.62, 1);
  st.lRM = m(0.13, 0.3, 1);
  st.lRS = m(0.56, 0.6, 1);
  st.lDEN = m(0.01, 0.62, 1);
  st.lNEU = m(0.55, 0.62, 1);
  st.pay = m(0.02, 0.9, 1);
  st.bound = m(0.12, 0.15, 1);
}

function buildStatic(st, hue) {
  const { bgR, bgG, bgB } = st;
  const bg = [0, 0, 0];
  hsv(0.64 + 0.08 * sin(TAU * hue), 0.8, 0.075, bg);
  bgR.fill(bg[0] * 255);
  bgG.fill(bg[1] * 255);
  bgB.fill(bg[2] * 255);
  const put = (o, c, a) => {
    bgR[o] += (c[0] - bgR[o]) * a;
    bgG[o] += (c[1] - bgG[o]) * a;
    bgB[o] += (c[2] - bgB[o]) * a;
  };
  // A one column line at x, soft when x falls between two LEDs.
  const vline = (x, c) => {
    for (let q = floor(x - 1); q <= floor(x + 1); q++) {
      const a = cl(1 - abs(q + 0.5 - x), 0, 1);
      if (a <= 0 || q < 0 || q >= W) continue;
      for (let y = 0; y < H; y++) put(y * W + q, c, a);
    }
  };
  const GRID = [52, 46, 48], GRIDL = [26, 23, 25], RULEC = [92, 84, 94];
  for (const t of [1, 3]) for (const p of [0.25, 0.5, 0.75]) vline(TX[t] + px(t, p) + 0.0, GRID);
  // The resistivity track is on log paper: a decade every quarter of the track, the 2 and the 5 between.
  for (let d = 0; d < 4; d++) {
    const p0 = d * 0.25;
    if (d > 0) vline(TX[2] + px(2, p0), GRID);
    vline(TX[2] + px(2, p0 + 0.25 * 0.30103), GRIDL);
    vline(TX[2] + px(2, p0 + 0.25 * 0.69897), GRIDL);
  }
  for (const x of RULE) vline(x + 0.5, RULEC);
}

// ---- the rock -------------------------------------------------------------
const SS = 0, SH = 1, LS = 2, DO = 3, CO = 4, SA = 5, AS = 6;
// Bed means and spreads of the six curves, as a share of the track: gamma ray, deep, medium and
// shallow resistivity on the log scale, density, neutron (the neutron scale runs the other way, so
// a high porosity sits at the left like a low density). Coal is off the scale to the left in both
// porosity curves and salt is off to the right in the neutron.
const LP = [
  [[0.16, 0.06], [0.1, 0.03], [0.2, 0.03], [0.36, 0.04], [0.37, 0.05], [0.38, 0.05]],     // sandstone, water filled
  [[0.74, 0.08], [0.26, 0.03], [0.26, 0.02], [0.25, 0.02], [0.62, 0.04], [0.28, 0.04]],    // shale
  [[0.12, 0.05], [0.82, 0.06], [0.8, 0.06], [0.77, 0.07], [0.78, 0.05], [0.76, 0.05]],     // limestone
  [[0.22, 0.05], [0.66, 0.07], [0.64, 0.07], [0.62, 0.07], [0.9, 0.03], [0.82, 0.05]],     // dolomite
  [[0.28, 0.05], [0.82, 0.05], [0.8, 0.05], [0.78, 0.05], [-0.15, 0.05], [-0.12, 0.05]],   // coal
  [[0.03, 0.015], [1.0, 0.02], [0.99, 0.02], [0.98, 0.02], [0.07, 0.02], [1.05, 0.02]],    // salt
  [[0.96, 0.04], [0.34, 0.04], [0.34, 0.04], [0.32, 0.04], [0.4, 0.04], [0.2, 0.04]],      // volcanic ash
];
const ROP = [1.0, 1.35, 0.5, 0.5, 1.45, 0.8, 1.1];     // how fast the bit goes through each
const THK = [1.1, 1.2, 1.4, 0.8, 0.3, 1, 0.3];         // bed thickness against the typical one
// What each lithology is followed by in each kind of package: clastic, carbonate, evaporite, coal measures.
//          sand  shale lime  dolo  coal  salt  ash
const TRANS = [
  [[0.07, 0.8, 0.06, 0, 0.05, 0, 0.02], [0.6, 0.12, 0.09, 0.03, 0.05, 0, 0.06], [0.25, 0.6, 0.1, 0.05, 0, 0, 0], [0.2, 0.6, 0.1, 0.1, 0, 0, 0], [0.35, 0.65, 0, 0, 0, 0, 0], [0.1, 0.8, 0.05, 0.05, 0, 0, 0], [0.2, 0.8, 0, 0, 0, 0, 0]],
  [[0, 0.5, 0.35, 0.15, 0, 0, 0], [0.03, 0.12, 0.55, 0.25, 0, 0, 0.05], [0.02, 0.33, 0.17, 0.4, 0, 0, 0.08], [0, 0.3, 0.45, 0.25, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0], [0, 0.4, 0.2, 0.4, 0, 0, 0], [0, 0.5, 0.5, 0, 0, 0, 0]],
  [],
  [[0.1, 0.55, 0, 0, 0.35, 0, 0], [0.35, 0.25, 0, 0, 0.38, 0, 0.02], [0.3, 0.7, 0, 0, 0, 0, 0], [0.3, 0.7, 0, 0, 0, 0, 0], [0.3, 0.7, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0], [0.3, 0.7, 0, 0, 0, 0, 0]],
];
const PKNEXT = [[0.3, 0.25, 0.15, 0.3], [0.4, 0.1, 0.4, 0.1], [0.4, 0.5, 0, 0.1], [0.55, 0.15, 0.05, 0.25]];
const PKLEN = [[70, 90], [50, 70], [55, 70], [50, 60]];

// The ring of samples, one per row of depth. RAW is what the generator wrote; OUT is RAW smoothed
// over three rows, the way the tool's vertical resolution smooths a real log.
const N = 512, MASK = N - 1, NP = 13;
const K_GR = 0, K_RD = 1, K_RM = 2, K_RS = 3, K_XD = 4, K_XN = 5, K_DRD = 6, K_DRM = 7, K_DRS = 8, K_DXD = 9, K_DXN = 10, K_CF = 11, K_ROP = 12;
const SMOOTH = 2;   // rows on either side of a sample that the tool averages over, 1 for three rows

export function setup(params) {
  params.st = {
    k: [0, 2, 0, 0.06], init: false, hue: -9,
    z: 0, mul: 1, dr: 0, dr2: 0, pe: 0.33, bedMed: 9,
    n: 0, bed: { b: 0, lith: SH, a: 0, L0: 1 }, pk: { type: 0, end: 0, salt: false }, prev: SH, bedId: 0,
    ar: new Float64Array(10),
    RAW: new Float32Array(N * NP), OUT: new Float32Array(N * NP),
    LITH: new Uint8Array(N), BED: new Int32Array(N), U: new Float32Array(N),
    v: new Float64Array(6),
    // one frame's samples
    sGR: new Float32Array(H + 2), sRD: new Float32Array(H + 2), sRM: new Float32Array(H + 2), sRS: new Float32Array(H + 2),
    sXD: new Float32Array(H + 2), sXN: new Float32Array(H + 2), sGW: new Float32Array(H + 2),
    sL: new Uint8Array(H + 2), sB: new Int32Array(H + 2),
    xGR: new Float32Array(H), xRD: new Float32Array(H), xRM: new Float32Array(H), xRS: new Float32Array(H), xXD: new Float32Array(H), xXN: new Float32Array(H),
    R: new Float32Array(NPX), G: new Float32Array(NPX), B: new Float32Array(NPX), cov: new Float32Array(NPX),
    bgR: new Float32Array(NPX), bgG: new Float32Array(NPX), bgB: new Float32Array(NPX),
  };
}

function startPackage(st, n) {
  const type = st.bedId === 0 ? 0 : pickW(PKNEXT[st.pk.type]);
  const [a, b] = PKLEN[type];
  st.pk = { type, end: n + floor(a + b * Math.random()), salt: false };
}

function newBed(st, n) {
  if (n >= st.pk.end) startPackage(st, n);
  const pk = st.pk, prev = st.prev;
  // Rising Pay lays down more sand, so a rich setting has more to light up.
  const sandMul = 0.75 + 0.9 * st.pe;
  let lith, fixed = 0;
  if (pk.type === 2) {
    // Evaporite: a thin dolomite or shale first (now and then), then the salt, then thin beds until the package ends.
    pk.beds = (pk.beds || 0) + 1;
    if (pk.salt || (pk.beds === 1 && Math.random() < 0.45)) lith = pickW([0, 0.4, 0, 0.5, 0, 0, 0.1]);
    else {
      lith = SA;
      pk.salt = true;
      fixed = cl(0.75 * (pk.end - n) * (0.8 + 0.4 * Math.random()), 30, 118);
    }
  } else {
    const w = TRANS[pk.type][prev].slice();
    w[SS] *= sandMul;
    lith = pickW(w);
  }
  let thick = fixed || st.bedMed * THK[lith] * exp(0.55 * gauss());
  thick = floor(cl(thick, lith === CO || lith === AS ? 3 : 4, 150));
  let b = min(n + thick, pk.end);
  if (pk.end - b < 4) b = pk.end;
  const bed = { lith, a: n, b, L0: b - n, id: ++st.bedId, m: new Float64Array(6), dl: new Float64Array(5), shape: 0, u: 9, c: 0, trend: 0, rop: 0, ev: [] };
  const L = LP[lith];
  for (let k = 0; k < 6; k++) bed.m[k] = L[k][0] + L[k][1] * gauss();
  bed.rop = ROP[lith] * exp(0.14 * gauss());
  const len = bed.L0;
  if (lith === SS) {
    const r = Math.random();
    bed.shape = len < 6 ? 0 : r < 0.4 ? 0 : r < 0.7 ? 1 : 2;
    bed.u = 0.02 + 0.98 * Math.random();
    // Gas sits on top of the water in a sand: below the contact the sand is wet again.
    bed.c = n + len * (Math.random() < 0.5 ? 1.01 : 0.45 + 0.45 * Math.random());
    const g = gauss();
    bed.dl[0] = 0.6 + 0.08 * g;
    bed.dl[1] = 0.46 + 0.08 * g;
    bed.dl[2] = 0.0 + 0.04 * g;
    bed.dl[3] = -0.14 + 0.03 * g;
    bed.dl[4] = 0.3 + 0.04 * g;
  }
  if (lith === SH) bed.trend = 0.12 * gauss();
  // Cemented streaks in sand and carbonate, washouts in shale and ash.
  const nc = lith === SS ? len / 16 : lith === LS || lith === DO ? len / 30 : 0;
  const nw = lith === SH || lith === AS ? len / 22 : 0;
  const poisson = (mean) => {
    let c = 0;
    for (let q = -log(1 - Math.random()); q < mean; q -= log(1 - Math.random())) c++;
    return c;
  };
  for (let i = poisson(nc); i > 0; i--) bed.ev.push([n + 1 + (len - 2) * Math.random(), 0.9 + 0.7 * Math.random(), 0, 0.18 + 0.17 * Math.random()]);
  for (let i = poisson(nw); i > 0; i--) bed.ev.push([n + 1 + (len - 2) * Math.random(), 1.2 + Math.random(), 1, 0.25 + 0.2 * Math.random()]);
  st.bed = bed;
  st.prev = lith;
  return bed;
}

const REF = LP[SH];
const SIG = [0.05, 0.045, 0.012, 0.01, 0.012, 0.04, 0.04];
function genSample(st, n) {
  let bed = st.bed;
  if (n >= bed.b) bed = newBed(st, n);
  const lith = bed.lith, t = cl((n - bed.a + 0.5) / bed.L0, 0, 1), v = st.v, ar = st.ar;
  // How sandy a sand is: blocky, fining upward to a sharp base (a bell) or coarsening upward (a funnel).
  let s = 1;
  if (lith === SS) s = bed.shape === 1 ? pow(t, 0.7) : bed.shape === 2 ? 1 - 0.95 * pow(t, 0.8) : 1;
  for (let k = 0; k < 6; k++) v[k] = lith === SS ? REF[k][0] + (bed.m[k] - REF[k][0]) * s : bed.m[k];
  if (lith === SH) v[0] += bed.trend * (t - 0.5);
  for (const e of bed.ev) {
    const d = (n - e[0]) / e[1];
    if (d > 4 || d < -4) continue;
    const bump = e[3] * exp(-0.5 * d * d);
    if (e[2] === 0) {
      v[1] += bump * 1.0; v[2] += bump * 0.95; v[3] += bump * 0.85; v[4] += bump * 0.6; v[5] += bump * 0.3; v[0] -= bump * 0.1;
    } else {
      v[4] -= bump * 1.0; v[5] -= bump * 0.5; v[3] -= bump * 0.2; v[1] -= bump * 0.05; v[0] += bump * 0.3;
    }
  }
  // Smooth noise, correlated over about four rows; the three resistivities and the two porosities share most of theirs.
  const rho = 0.8, inn = sqrt(1 - rho * rho);
  for (let q = 0; q < 7; q++) ar[q] = rho * ar[q] + inn * gauss();
  // Slow swings over fifteen rows or so: porosity (both porosity curves left, all resistivities down), clay content and the gap between the porosity curves.
  for (let q = 7; q < 10; q++) ar[q] = 0.94 * ar[q] + 0.341 * gauss();
  v[0] += 0.09 * ar[8];
  v[1] -= 0.1 * ar[7]; v[2] -= 0.1 * ar[7]; v[3] -= 0.1 * ar[7];
  v[4] -= 0.09 * ar[7]; v[5] -= 0.09 * ar[7];
  v[5] += 0.08 * ar[9];
  v[0] += SIG[0] * ar[0];
  v[1] += SIG[1] * ar[1] + 0.012 * ar[2];
  v[2] += SIG[1] * ar[1] + 0.01 * ar[3];
  v[3] += SIG[1] * ar[1] + 0.012 * ar[4];
  v[4] += SIG[5] * ar[5];
  v[5] += SIG[6] * (0.55 * ar[5] + 0.83 * ar[6]);
  const idx = n & MASK, o = idx * NP, raw = st.RAW, sg = lith === SS ? pow(s, 1.5) : 0;
  for (let k = 0; k < 6; k++) raw[o + k] = v[k];
  for (let k = 0; k < 5; k++) raw[o + 6 + k] = bed.dl[k] * sg;
  raw[o + K_CF] = lith === SS && n < bed.c ? 1 : 0;
  raw[o + K_ROP] = bed.rop;
  st.LITH[idx] = lith;
  st.BED[idx] = bed.id;
  st.U[idx] = lith === SS ? bed.u : 9;
}

// Generate raw samples until the smoothed ones reach row `last`.
function ensure(st, last) {
  const { RAW, OUT } = st;
  while (st.n <= last + SMOOTH) {
    genSample(st, st.n);
    // Sample n - SMOOTH can now be smoothed: it has SMOOTH rows on either side.
    const m = st.n - SMOOTH;
    if (m >= 0) {
      const o = (m & MASK) * NP;
      for (let k = 0; k < NP; k++) {
        let sum = 0;
        for (let d = -SMOOTH; d <= SMOOTH; d++) sum += RAW[(max(0, m + d) & MASK) * NP + k];
        OUT[o + k] = sum / (2 * SMOOTH + 1);
      }
    }
    st.n++;
  }
}

// ---- time -----------------------------------------------------------------
export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], cl(kv[1], 0, 3.5), cl(kv[2], -1, 1), cl(kv[3], 0, 0.18)];
  const target = st.k[3] / 0.18, med = 9 * pow(2.6, st.k[2]);
  if (!st.init) {
    st.init = true;
    st.pe = target;
    st.bedMed = med;
    ensure(st, H + 4);
  }
  dt = cl(dt || 0, 0, 0.1);
  st.pe += (target - st.pe) * (1 - exp(-dt / 0.5));
  // A change of the typical thickness stretches or shrinks the bed being drilled, so it shows at the bottom edge at once.
  if (abs(med / st.bedMed - 1) > 0.02) {
    const bed = st.bed;
    if (bed.lith !== SA && bed.b > st.n + 1) bed.b = min(st.pk.end, floor(st.n + max(1, (bed.b - st.n) * (med / st.bedMed))));
    st.bedMed = med;
  }
  // The bit's speed follows the rock at the bottom of the panel and a slow wander of its own.
  const i0 = floor(st.z), fz = st.z - i0;
  ensure(st, i0 + H + 3);
  const ob = ((i0 + H - 1) & MASK) * NP, oc = ((i0 + H) & MASK) * NP;
  const rop = st.OUT[ob + K_ROP] * (1 - fz) + st.OUT[oc + K_ROP] * fz;
  st.mul += (rop - st.mul) * (1 - exp(-dt / 0.5));
  st.dr += (-st.dr * dt) / 14 + 0.22 * sqrt((2 * dt) / 14) * gauss();
  st.dr2 += (-st.dr2 * dt) / 2.5 + 0.08 * sqrt((2 * dt) / 2.5) * gauss();
  const rate = cl(10 * pow(1.5, st.k[1] - 2) * st.mul * exp(st.dr + st.dr2), 2.5, 28);
  st.z += rate * dt;
}

// ---- drawing --------------------------------------------------------------
function gather(st) {
  const i0 = floor(st.z);
  st.fz = st.z - i0;
  ensure(st, i0 + H + 3);
  const { OUT, U, LITH, BED } = st, pe = st.pe, rich = 0.85 + 0.45 * pe;
  for (let j = 0; j <= H; j++) {
    const i = (i0 + j) & MASK, o = i * NP;
    const gw = OUT[o + K_CF] * cl((pe - U[i]) / 0.08 + 0.5, 0, 1), gk = gw * rich;
    st.sGW[j] = gw;
    st.sGR[j] = px(1, OUT[o + K_GR]);
    st.sRD[j] = px(2, OUT[o + K_RD] + gk * OUT[o + K_DRD]);
    st.sRM[j] = px(2, OUT[o + K_RM] + gk * OUT[o + K_DRM]);
    st.sRS[j] = px(2, OUT[o + K_RS] + gk * OUT[o + K_DRS]);
    st.sXD[j] = px(3, OUT[o + K_XD] + gk * OUT[o + K_DXD]);
    st.sXN[j] = px(3, OUT[o + K_XN] + gk * OUT[o + K_DXN]);
    st.sL[j] = LITH[i];
    st.sB[j] = BED[i];
  }
}

// A line of width 2 through the points (xs[r] + tx, r + 0.5), its coverage into cov, inside one track.
function stroke(cov, xs, tx, tw, rad) {
  const xmin = tx, xmax = tx + tw - 1;
  for (let r = -1; r < H; r++) {
    const xa = xs[max(r, 0)] + tx, xb = xs[min(r + 1, H - 1)] + tx, ya = r + 0.5;
    const px0 = max(xmin, floor(min(xa, xb) - 1.5)), px1 = min(xmax, floor(max(xa, xb) + 1.5));
    const dx = xb - xa, l2 = dx * dx + 1;
    for (let py = max(0, r - 1); py <= min(H - 1, r + 2); py++) {
      const cy = py + 0.5 - ya;
      for (let q = px0; q <= px1; q++) {
        const cx = q + 0.5 - xa;
        const u = cl((cx * dx + cy) / l2, 0, 1);
        const ex = cx - u * dx, ey = cy - u;
        const c = cl(rad - sqrt(ex * ex + ey * ey), 0, 1);
        const o = py * W + q;
        if (c > cov[o]) cov[o] = c;
      }
    }
  }
}

function lineOn(st, xs, t, col, rad = 1.5, al = 1) {
  const { cov, R, G, B } = st, tx = TX[t], tw = TWD[t];
  for (let y = 0; y < H; y++) cov.fill(0, y * W + tx, y * W + tx + tw);
  stroke(cov, xs, tx, tw, rad);
  for (let y = 0; y < H; y++)
    for (let o = y * W + tx, e = o + tw; o < e; o++) {
      const c = cov[o] * al;
      if (c <= 0.004) continue;
      R[o] += (col[0] - R[o]) * c;
      G[o] += (col[1] - G[o]) * c;
      B[o] += (col[2] - B[o]) * c;
    }
}

// Fill the span [a, b] of track t on row y with the colour col, edges soft, strength al.
function span(st, y, t, a, b, col, al) {
  if (b <= a || al <= 0) return;
  const { R, G, B } = st, tx = TX[t], tw = TWD[t];
  for (let q = max(0, floor(a)); q <= min(tw - 1, floor(b)); q++) {
    const c = cl(min(b, q + 1) - max(a, q), 0, 1) * al;
    if (c <= 0) continue;
    const o = y * W + tx + q;
    R[o] += (col[0] - R[o]) * c;
    G[o] += (col[1] - G[o]) * c;
    B[o] += (col[2] - B[o]) * c;
  }
}

const TICK = [44, 39, 41], TICKM = [74, 67, 71];
export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  if (abs(st.k[0] - st.hue) > 1e-4) {
    st.hue = st.k[0];
    buildPalette(st, st.hue);
    buildStatic(st, st.hue);
  }
  gather(st);
  const { R, G, B, LC } = st, f1 = st.fz, f0 = 1 - f1, zf = st.z;
  R.set(st.bgR);
  G.set(st.bgG);
  B.set(st.bgB);

  // Depth ticks every 8 rows across the four tracks, a stronger one every 40.
  for (let m = ceil(zf / 8); m * 8 < zf + H + 1; m++) {
    const yc = m * 8 - zf, col = m % 5 === 0 ? TICKM : TICK;
    for (let y = max(0, floor(yc - 1)); y <= min(H - 1, floor(yc + 1)); y++) {
      const a = cl(1 - abs(y + 0.5 - yc), 0, 1);
      if (a <= 0) continue;
      for (let x = 0; x < W; x++) {
        const o = y * W + x;
        R[o] += (col[0] - R[o]) * a;
        G[o] += (col[1] - G[o]) * a;
        B[o] += (col[2] - B[o]) * a;
      }
    }
  }

  const cutB = px(1, CUT);
  for (let y = 0; y < H; y++) {
    const ro = y * W;
    // Track A: the beds, each in its own flat colour, soft where a boundary falls inside a row.
    const ca = LC[st.sL[y]], cb = LC[st.sL[y + 1]];
    const lr = ca[0] * f0 + cb[0] * f1, lg = ca[1] * f0 + cb[1] * f1, lb = ca[2] * f0 + cb[2] * f1;
    const pw = sstep(0.12, 0.6, st.sGW[y] * f0 + st.sGW[y + 1] * f1);
    for (let x = 0; x < 10; x++) {
      const o = ro + x;
      if (x < 8 || pw <= 0) (R[o] = lr), (G[o] = lg), (B[o] = lb);
      else {
        R[o] = lr + (st.pay[0] - lr) * pw;
        G[o] = lg + (st.pay[1] - lg) * pw;
        B[o] = lb + (st.pay[2] - lb) * pw;
      }
    }
    // Track B: gamma ray, yellow between the curve and the cutoff where it is low, grey-green where it is high.
    const gr = st.sGR[y] * f0 + st.sGR[y + 1] * f1;
    st.xGR[y] = gr;
    if (gr < cutB) span(st, y, 1, gr, cutB, st.fSand, 0.92);
    else span(st, y, 1, cutB, gr, st.fShale, 0.92);
    // Track C: resistivity, red where the deep curve is above the shallow one, blue where it is below.
    const rd = st.sRD[y] * f0 + st.sRD[y + 1] * f1, rm = st.sRM[y] * f0 + st.sRM[y + 1] * f1, rs = st.sRS[y] * f0 + st.sRS[y + 1] * f1;
    st.xRD[y] = rd;
    st.xRM[y] = rm;
    st.xRS[y] = rs;
    if (rd > rs) span(st, y, 2, rs, rd, st.fRed, 0.92);
    else span(st, y, 2, rd, rs, st.fBlue, 0.92);
    // Track D: density and neutron, yellow where the neutron lies right of the density (gas), grey where it lies far left (shale).
    const xd = st.sXD[y] * f0 + st.sXD[y + 1] * f1, xn = st.sXN[y] * f0 + st.sXN[y + 1] * f1;
    st.xXD[y] = xd;
    st.xXN[y] = xn;
    const sep = xn - xd;
    if (sep > 0) {
      const gwr = st.sGW[y] * f0 + st.sGW[y + 1] * f1, a = sstep(0.4, 1.6, sep);
      const c0 = st.fSalt, c1 = st.fGas;
      const mix = [c0[0] + (c1[0] - c0[0]) * gwr, c0[1] + (c1[1] - c0[1]) * gwr, c0[2] + (c1[2] - c0[2]) * gwr];
      span(st, y, 3, xd, xn, mix, 0.92 * a);
    } else span(st, y, 3, xn, xd, st.fGrey, 0.9 * sstep(1.2, 3.2, -sep));
  }

  // Bed boundaries across the lithology column.
  for (let j = 0; j < H; j++) {
    if (st.sB[j] === st.sB[j + 1]) continue;
    const yb = j + 1 - st.fz;
    for (let y = max(0, floor(yb - 1.2)); y <= min(H - 1, floor(yb + 1.2)); y++) {
      const a = cl(1.1 - abs(y + 0.5 - yb), 0, 1) * 0.8;
      if (a <= 0) continue;
      for (let x = 0; x < 10; x++) {
        const o = y * W + x;
        R[o] += (st.bound[0] - R[o]) * a;
        G[o] += (st.bound[1] - G[o]) * a;
        B[o] += (st.bound[2] - B[o]) * a;
      }
    }
  }

  lineOn(st, st.xGR, 1, st.lGR);
  lineOn(st, st.xRS, 2, st.lRS);
  lineOn(st, st.xRD, 2, st.lRD);
  lineOn(st, st.xRM, 2, st.lRM, 1.2, 0.9);
  lineOn(st, st.xXD, 3, st.lDEN);
  lineOn(st, st.xXN, 3, st.lNEU);

  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) display.setPixel(x, y, floor(min(255, R[o])), floor(min(255, G[o])), floor(min(255, B[o])));
}
