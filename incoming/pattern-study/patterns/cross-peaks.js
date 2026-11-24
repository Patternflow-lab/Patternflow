// ===== Patternflow pattern =====
// Title:   Cross Peaks
// Family:  nmr
// Idea:    A two-dimensional COSY spectrum of a reacting mixture fills the panel, chemical shift on both axes and the diagonal running corner to corner, with gold diagonal peaks for each spin system and, either side of the diagonal, symmetric cross peaks that are small checkerboards of gold and magenta lobes from the antiphase J splitting, while concentrations rise and fall and shifts drift, one species at a time reacts away for a fresh one to grow in elsewhere, and a solvent ridge and streaks of t1 noise run down the columns.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: two-dimensional correlation spectroscopy (COSY) of nuclear magnetic resonance, proposed by Jean Jeener in a 1971 lecture and first run by Aue, Bartholdi and Ernst (1976), with the antiphase cross-peak fine structure of J coupling, the diagonal peaks that are in phase, the phase errors that turn absorptive lines dispersive, the t1 noise that streaks down the columns of strong peaks and the solvent ridge, all from memory, pattern round 238
// Round:   238
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Species=0..4.5, Phase=-1..1, Splitting=-1..1
//
// Knob 1: Hue. Turns the palette round the wheel. At 0 the positive lobes climb from violet through pale peach to gold and cream, the negative lobes climb from violet to magenta and rose, and the ground is indigo. Turned away from 0 the peaks take the whole wheel while the ground only sways about indigo and violet, so that it never goes brown.
// Knob 2: Species. 0 to 4.5, opening at 2. How many spin systems are in the mix, 6 plus 4 for each unit, so 6 at 0, 14 at the opening and 24 at 4.5. A species that the knob adds fades in over half a second at a place of its own, and each one still rises and falls with its own concentration, so about a third of them show at a time and never fewer than 3. Twelve faint singlets, the traces of other compounds, come and go whatever this is set to.
// Knob 3: Phase. -1 to 1, opening at 0. The zero-order phase error of the spectrum, up to 1.3 radians either way. At 0 every line is a clean absorptive blob; at the ends the lines go dispersive and each blob opens into the four-lobed shape of a badly phased peak, with the sign of the tilt following the knob.
// Knob 4: Splitting. -1 to 1, opening near the middle. How large the J splitting is drawn. The real splittings are a few hertz against a linewidth of one LED, so they are exaggerated. At -1 the lines have merged and every peak, diagonal or cross, is a single broad positive blob; at the opening the lobes of an 8 Hz coupling are about 3 LEDs apart, and at 1 they are 6 LEDs apart, with no multiplet wider than 8.

const W = 64, H = 128, NPX = W * H, NS = 24;
const { floor, ceil, min, max, abs, exp, log, log1p, pow, sqrt, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

// The map, as the brief gives it: shifts 0 to 10 ppm, x for the second dimension and y for the
// first, 5.8 and 12.2 LEDs to the ppm. The map is stretched; symmetry about the diagonal holds in ppm.
const pxOf = (d) => 3 + (10 - d) * 5.8;
const pyOf = (d) => 3 + (10 - d) * 12.2;

// ---- colour ---------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A dim colour on the red-orange-yellow stretch of the wheel reads brown, so it is lifted and paled there.
function dim(h, s, v, out, o) {
  const c = frac(h), b = c > 0.9 ? sstep(0.9, 0.97, c) : 1 - sstep(0.12, 0.2, c);
  hsv(h, s * (1 - 0.5 * b), min(1, v * (1 + 1.1 * b * (1 - v))), out, o);
}
// Level, hue, saturation, value. Positive lines climb from the indigo ground through violet and
// a pale peach to gold and cream; negative ones through violet to magenta and rose.
const POS = [
  [0.0, 0.7, 0.9, 0.1],
  [0.12, 0.72, 0.85, 0.26],
  [0.25, 0.76, 0.66, 0.52],
  [0.38, 0.84, 0.46, 0.78],
  [0.5, 1.01, 0.46, 0.95],
  [0.64, 1.07, 0.74, 1.0],
  [0.8, 1.115, 0.62, 1.0],
  [1.0, 1.14, 0.25, 1.0],
];
const NEG = [
  [0.0, 0.7, 0.9, 0.1],
  [0.12, 0.74, 0.88, 0.24],
  [0.25, 0.81, 0.85, 0.46],
  [0.4, 0.87, 0.8, 0.72],
  [0.6, 0.9, 0.72, 0.95],
  [0.8, 0.95, 0.5, 1.0],
  [1.0, 0.975, 0.28, 1.0],
];
// The ground only sways about indigo as the wheel turns; from violet up the ramp takes the whole turn.
function rampAt(keys, m, hue, out, o) {
  let k = 0;
  while (k < keys.length - 2 && m > keys[k + 1][0]) k++;
  const a = keys[k], b = keys[k + 1], f = cl((m - a[0]) / (b[0] - a[0]), 0, 1);
  const gs = 0.14 * sin(TAU * hue);
  let dl = hue - gs;
  dl -= floor(dl + 0.5);
  dim(a[1] + (b[1] - a[1]) * f + gs + dl * sstep(0.15, 0.45, m), a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f, out, o);
}
const LUTN = 1024, FMAX = 1.6, GAIN = 5;
// The soft log compression: the 1024 entries are spaced by the square root of the field, so the
// faint end, where the skirts and the ridges live, is finely stepped.
function buildLut(st, hue) {
  const c = [0, 0, 0];
  for (let i = 0; i < LUTN; i++) {
    const a = FMAX * (i / (LUTN - 1)) ** 2, m = log1p(GAIN * a) / log1p(GAIN * FMAX);
    rampAt(POS, m, hue, c, 0);
    for (let q = 0; q < 3; q++) st.pos[i * 3 + q] = c[q] * 255;
    rampAt(NEG, m, hue, c, 0);
    for (let q = 0; q < 3; q++) st.neg[i * 3 + q] = c[q] * 255;
  }
  // The ground: indigo at hue 0, swaying with the wheel.
  hsv(0.68 + 0.14 * sin(TAU * hue), 0.9, 0.24, c, 0);
  for (let q = 0; q < 3; q++) st.base[q] = c[q] * 255;
  hsv(0.78 + 0.14 * sin(TAU * hue), 0.85, 0.24, c, 0);
  for (let q = 0; q < 3; q++) st.base[3 + q] = c[q] * 255;
}

// ---- hash noise -----------------------------------------------------------
function hash32(a, b) {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}
const rnd01 = (a, b) => hash32(a, b) / 4294967296;
// Smooth value noise, 0 to 1, with a lattice step of 1 in u.
function vh(u, salt) {
  const i = floor(u), f = u - i, w = f * f * (3 - 2 * f);
  return rnd01(i, salt) * (1 - w) + rnd01(i + 1, salt) * w;
}

// ---- spin systems ---------------------------------------------------------
// A species is 2 to 4 protons, each with a shift, a number of equivalent hydrogens, and J couplings
// along a chain (and now and then a closing bond). Its concentration is exp of an Ornstein-Uhlenbeck
// walk in log space, 10 to 45 s, wide enough that it fades fully in and out.
const MU = -0.5, SIG = 1.05, SIGD = 0.28;
const ampOf = (lc) => sstep(-0.9, -0.2, lc) * (0.3 + 0.7 * sstep(-0.4, 1.3, lc));

function makeSpecies(fresh, others) {
  const r = Math.random, u = r();
  const nP = u < 0.5 ? 2 : u < 0.87 ? 3 : 4;
  // About a third of the pairs are an ethyl, a methyl against a methylene at 7 Hz, whose cross
  // peak is the multi-line one: a triplet side against a quartet side.
  const eth = nP === 2 && r() < 0.35;
  // The shifts sit 0.7 to 1.8 ppm apart, so the whole system spans 1 to 3 ppm about its centre.
  const gmin = eth ? 1.3 : nP === 2 ? 1.1 : 0.9, gmax = eth ? 2.1 : nP === 2 ? 2.3 : nP === 3 ? 1.6 : 1.15;
  const d = [0];
  for (let k = 1; k < nP; k++) d.push(d[k - 1] + gmin + (gmax - gmin) * r());
  const span = d[nP - 1], lo = span / 2 + 0.4, hi = 9.6 - span / 2;
  // The new centre is the best of eight tries, the one farthest from the other species, so the diagonal is covered.
  let centre = lo, best = -1;
  for (let q = 0; q < 8; q++) {
    const c = lo + (hi - lo) * r();
    let dm = 9;
    for (const o of others) dm = min(dm, abs(c - o));
    if (dm > best) (best = dm), (centre = c);
  }
  const pr = [];
  for (let k = 0; k < nP; k++) {
    const nH = eth ? (k === 0 ? 3 : 2) : [1, 1, 2, 2, 3][floor(r() * 5)];
    pr.push({ d0: centre - span / 2 + d[k], nH, o: SIGD * gauss(), ot: 25 + 55 * r(), cp: [] });
  }
  const perm = pr.map((_, i) => i);
  for (let i = nP - 1; i > 0; i--) {
    const j = floor(r() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const pairs = [];
  for (let k = 0; k < nP - 1; k++) pairs.push([perm[k], perm[k + 1]]);
  if (nP === 3 && r() < 0.3) pairs.push([perm[0], perm[2]]);
  if (nP === 4 && r() < 0.25) pairs.push([perm[0], perm[3]]);
  const cp = pairs.map(([a, b], c) => {
    pr[a].cp.push(c);
    pr[b].cp.push(c);
    return { a, b, J0: eth ? 6.5 + r() : r() < 0.15 ? 2 + 2.5 * r() : 4.5 + 7.5 * r(), per: 18 + 37 * r(), ph: TAU * r() };
  });
  return {
    cx: centre, mu: MU, pr, cp, w: 0.8 + 0.35 * r(), gain: 0.75 + 0.35 * r(),
    lc: fresh ? MU + SIG * gauss() : -0.7 + 0.6 * r(), tauc: 10 + 35 * r(),
    alive: 1, fade: fresh ? 1 : 0, ft: 1, A: 0, J: new Float64Array(cp.length),
  };
}

// Uncoupled singlets, the traces of other compounds in a real sample: a lone diagonal peak that appears
// at a shift of its own, stays for 10 to 32 s and fades, and the next one grows in elsewhere.
const NIMP = 12;
function newImp(old, first) {
  const r = Math.random, dur = 10 + 22 * r();
  let d = 5, best = -1;
  for (let q = 0; q < 4; q++) {
    const c = 0.4 + 9.2 * r();
    let dm = 9;
    if (old) for (const o of old) dm = min(dm, abs(c - o.d));
    if (dm > best) (best = dm), (d = c);
  }
  return { d, A: 0.3 + 0.35 * r(), w: 0.9 + 0.3 * r(), dur, age: first ? dur * r() : 0 };
}

// ---- multiplets -----------------------------------------------------------
// A line set: offsets in LEDs from the shift and the signed weight of each line. A proton seen
// across the coupling to a partner is antiphase in that coupling (a pair of lines, minus then
// plus) and in phase in its others, one in-phase pair for each equivalent hydrogen at the other end.
const SETS = Array.from({ length: 4 }, () => ({ n: 0, o: new Float64Array(40), w: new Float64Array(40), lo: 0, hi: 0 }));
const TO = new Float64Array(40), TW = new Float64Array(40);
function pair(set, h, sgn) {
  let n = 0;
  for (let l = 0; l < set.n; l++) {
    TO[n] = set.o[l] - h;
    TW[n++] = set.w[l] * sgn;
    TO[n] = set.o[l] + h;
    TW[n++] = set.w[l];
  }
  for (let i = 1; i < n; i++) {
    const o = TO[i], w = TW[i];
    let j = i - 1;
    while (j >= 0 && TO[j] > o) (TO[j + 1] = TO[j]), (TW[j + 1] = TW[j]), j--;
    TO[j + 1] = o;
    TW[j + 1] = w;
  }
  let m = 0;
  for (let i = 0; i < n; i++) {
    if (m > 0 && TO[i] - set.o[m - 1] < 1e-5) set.w[m - 1] += TW[i];
    else (set.o[m] = TO[i]), (set.w[m++] = TW[i]);
  }
  set.n = m;
}
function build(set, sp, i, j, scale) {
  set.n = 1;
  set.o[0] = 0;
  set.w[0] = 1;
  const pr = sp.pr[i];
  for (let pass = 0; pass < 2; pass++) {
    for (const c of pr.cp) {
      const cc = sp.cp[c], k = cc.a === i ? cc.b : cc.a, act = k === j;
      if (act !== (pass === 0)) continue;
      // The more equivalent hydrogens at the other end, the more lines, so each step is drawn smaller
      // to keep a multiplet inside 8 LEDs.
      let reps = sp.pr[k].nH;
      const h = (0.5 * scale * pow(sp.J[c] / 8, 0.7)) / sqrt(reps);
      if (act) {
        pair(set, h, -1);
        reps--;
      }
      for (let q = 0; q < reps && set.n <= 4; q++) pair(set, h, 1);
    }
  }
}
// Below a splitting of a LED or two the lines cannot be told apart and the antiphase pairs would
// cancel; the mix runs the weights from all-positive (one blob, area 1) to their true signs (the
// tallest line 1) so that the peaks go to single blobs instead of vanishing.
function finish(set, mix) {
  let S = 0, M = 0, n = 0, lo = 1e9, hi = -1e9;
  for (let l = 0; l < set.n; l++) {
    const w = mix * set.w[l] + (1 - mix) * abs(set.w[l]);
    if (abs(w) < 1e-6) continue;
    set.o[n] = set.o[l];
    set.w[n++] = w;
    S += abs(w);
    M = max(M, abs(w));
    lo = min(lo, set.o[l]);
    hi = max(hi, set.o[l]);
  }
  if (hi - lo > 8) {
    const f = 8 / (hi - lo);
    for (let l = 0; l < n; l++) set.o[l] *= f;
    (lo *= f), (hi *= f);
  }
  set.n = n;
  set.lo = n ? lo : 0;
  set.hi = n ? hi : 0;
  const dn = S + (M - S) * mix || 1;
  for (let l = 0; l < n; l++) set.w[l] /= dn;
}

// ---- painting -------------------------------------------------------------
// The 1-D line shape is cos(p) A + sin(p) D with A = w^2/(x^2+w^2) and D = x w/(x^2+w^2), the same p
// on both axes. D is doubled so that both have a peak of 1. A taper (1 - (x/R)^2)^2 closes the
// tails at R, the way the apodisation of a real spectrum does, so a peak ends in a few LEDs.
let CP = 1, SP2 = 0;
const BX = new Float32Array(80), BY = new Float32Array(160);
function axis(buf, lo, hi, c, set, w, R) {
  const w2 = w * w, iR2 = 1 / (R * R);
  for (let x = lo; x <= hi; x++) {
    let s = 0;
    for (let l = 0; l < set.n; l++) {
      const dd = x + 0.5 - c - set.o[l], d2 = dd * dd;
      if (d2 >= R * R) continue;
      const t = 1 - d2 * iR2;
      s += set.w[l] * t * t * (w * (CP * w + SP2 * dd)) / (d2 + w2);
    }
    buf[x - lo] = s;
  }
}
function paint(F, cx, cy, sx, sy, w, R, amp) {
  const xlo = max(0, floor(cx + sx.lo - R)), xhi = min(W - 1, ceil(cx + sx.hi + R));
  const ylo = max(0, floor(cy + sy.lo - R)), yhi = min(H - 1, ceil(cy + sy.hi + R));
  if (xlo > xhi || ylo > yhi || xhi - xlo >= 80 || yhi - ylo >= 160) return;
  axis(BX, xlo, xhi, cx, sx, w, R);
  axis(BY, ylo, yhi, cy, sy, w, R);
  for (let y = ylo; y <= yhi; y++) {
    const a = amp * BY[y - ylo];
    if (a < 1e-4 && a > -1e-4) continue;
    const row = y * W;
    for (let x = xlo; x <= xhi; x++) F[row + x] += a * BX[x - xlo];
  }
}
const ONE = { n: 1, o: new Float64Array([0]), w: new Float64Array([1]), lo: 0, hi: 0 };

// A vertical streak down column x: a Lorentzian across, rows scaled by a smooth random value that
// is different for every row and drifts, which is what t1 noise looks like.
const RX = new Float32Array(40);
function ridge(F, x, w, R, amp, salt, t, contrast) {
  const xlo = max(0, floor(x - R)), xhi = min(W - 1, ceil(x + R));
  if (xlo > xhi) return;
  const w2 = w * w;
  for (let q = xlo; q <= xhi; q++) {
    const d2 = (q + 0.5 - x) ** 2;
    RX[q - xlo] = d2 >= R * R ? 0 : (1 - d2 / (R * R)) ** 2 * w2 / (d2 + w2);
  }
  for (let y = 0; y < H; y++) {
    const n = 0.65 * vh(y * 0.3 + t * 0.31 + salt * 0.37, salt) + 0.35 * vh(y * 0.45 - t * 0.47, salt + 101);
    const a = amp * (1 - contrast + contrast * 2.2 * n * n);
    const row = y * W;
    for (let q = xlo; q <= xhi; q++) F[row + q] += a * RX[q - xlo];
  }
}

// ---- state ----------------------------------------------------------------
export function setup(params) {
  params.st = {
    k: [0, 2, 0, 0.06], t: 0, init: false, hue: -9,
    sl: [],
    nextReact: 15 + 20 * Math.random(),
    imp: Array.from({ length: NIMP }, () => newImp(null, true)),
    xs: 34, sph: Math.random() * TAU, sph2: Math.random() * TAU, ph: Array.from({ length: 16 }, () => Math.random() * TAU),
    F: new Float32Array(NPX), pos: new Float32Array(LUTN * 3), neg: new Float32Array(LUTN * 3), base: new Float32Array(6),
    X: Array.from({ length: 8 }, () => new Float32Array(W)), Y: Array.from({ length: 8 }, () => new Float32Array(H)),
    rx: new Float32Array(NS * 4), ra: new Float32Array(NS * 4), rs: new Float32Array(NS * 4),
  };
  const cs = [];
  for (let i = 0; i < NS; i++) {
    const s = makeSpecies(true, cs);
    cs.push(s.cx);
    s.alive = 0;
    params.st.sl.push(s);
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], cl(kv[1], 0, 4.5), cl(kv[2], -1, 1), cl(kv[3], -1, 1)];
  if (!st.init) {
    st.init = true;
    // Thirty seconds of the mix before the first frame, so the panel opens with species already
    // at different concentrations and a reaction or two behind them.
    for (let i = 0; i < 150; i++) step(st, 0.2);
  }
  let d = cl(dt || 0, 0, 0.1);
  step(st, d);
}

function step(st, d) {
  st.t += d;
  const t = st.t, nT = 6 + 4 * st.k[1], sl = st.sl;
  // Lit species crowd each other out: a species with lit neighbours in shift has its concentration pulled
  // down a little, one with an empty stretch of the diagonal around it is pulled up, so the lit ones spread out.
  for (let i = 0; i < NS; i++) {
    const s = sl[i];
    let dens = 0;
    for (let j = 0; j < NS; j++) {
      if (j === i || sl[j].alive < 0.5 || sl[j].A * sl[j].fade < 0.22) continue;
      const q = (s.cx - sl[j].cx) / 1.3;
      dens += exp(-q * q);
    }
    s.mu = MU + 0.45 - 0.8 * min(dens, 1.6);
  }
  let vis = 0, alive = 0, cand = null, cs = -1e9;
  for (let i = 0; i < NS; i++) {
    let s = sl[i];
    s.alive += cl(cl(nT - i, 0, 1) - s.alive, -2 * d, 2 * d);
    s.fade += cl(s.ft - s.fade, -d / 2.5, d / 2.5);
    if (s.ft === 0 && s.fade <= 0) {
      // The species has reacted away. A fresh one, new shifts elsewhere on the map, takes its slot.
      s = sl[i] = makeSpecies(false, sl.filter((o, q) => q !== i && o.alive > 0.5).map((o) => o.cx));
      s.alive = cl(nT - i, 0, 1);
    }
    const k = d / (s.tauc * cl(nT / 14, 0.55, 1));
    s.lc = cl(s.lc + (s.mu - s.lc) * k + SIG * sqrt(2 * k) * gauss(), -3, 3);
    for (const p of s.pr) p.o += (-p.o * d) / p.ot + SIGD * sqrt((2 * d) / p.ot) * gauss();
    s.A = ampOf(s.lc);
    if (s.alive > 0.5 && s.ft === 1) {
      alive++;
      if (s.A * s.fade > 0.22) vis++;
      else if (s.lc + 0.6 * (s.mu - MU) > cs) (cs = s.lc + 0.6 * (s.mu - MU)), (cand = s);
    }
  }
  // Coverage: when fewer species show than the knob's share of the mix, the one nearest to showing is lifted
  // (nearness counts its empty surroundings too).
  if (cand && vis < max(3, 0.4 * alive)) cand.lc += 0.9 * d;
  // Every 20 to 40 s one species reacts.
  if (t >= st.nextReact) {
    st.nextReact = t + (20 + 20 * Math.random()) * cl(alive / 14, 0.4, 1);
    // One that is showing, since a dark one going would change nothing on the panel.
    const pool = st.sl.filter((s) => s.alive > 0.9 && s.fade > 0.95 && s.ft === 1 && s.A > 0.25);
    if (pool.length > 2) pool[floor(Math.random() * pool.length)].ft = 0;
  }
  for (let i = 0; i < NIMP; i++) {
    const m = st.imp[i];
    m.age += d;
    if (m.age > m.dur) st.imp[i] = newImp(st.imp, false);
  }
  // The solvent ridge wanders in x.
  st.xs += (34 - st.xs) * (d / 60) + 5.5 * sqrt((2 * d) / 60) * gauss();
  st.xs = cl(st.xs, 10, 54);
}

// ---- drawing --------------------------------------------------------------
export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const t = st.t, hue = st.k[0], F = st.F;
  if (abs(hue - st.hue) > 1e-4) (st.hue = hue), buildLut(st, hue);
  const p = 1.3 * st.k[2], u = (st.k[3] + 1) / 2;
  CP = cos(p);
  SP2 = 2 * sin(p);
  // Splitting: the lobes of a J = 8 Hz coupling are SC LEDs apart, from 0.3 to 6. The exaggeration is the
  // same on both axes, so a multiplet square stays square on the stretched map.
  const SC = 0.3 + 5.7 * u, mix = sstep(0.5, 2.6, SC);
  // Lines that are not resolved make one broad line, taller and wider than any of them.
  const wk = 1 + 0.6 * (1 - mix), ak = 1 + 0.8 * (1 - mix);
  F.fill(0);

  const [SA, SB, SC1, SC2] = SETS;
  let nr = 0;
  for (const s of st.sl) {
    const A = s.A * s.alive * s.fade * s.gain;
    if (A < 0.012) continue;
    for (let c = 0; c < s.cp.length; c++) {
      const cc = s.cp[c];
      s.J[c] = cc.J0 * (1 + 0.25 * sin((TAU * t) / cc.per + cc.ph));
    }
    for (let i = 0; i < s.pr.length; i++) {
      const pi = s.pr[i], dI = pi.d0 + pi.o, xi = pxOf(dI), yi = pyOf(dI);
      // The diagonal peak: an in-phase multiplet, broader than a cross peak lobe, with an antiphase part that
      // makes its on-diagonal lobes taller and leaves a faint negative fringe between them.
      let jb = -1, jw = -1;
      for (const c of pi.cp) {
        const cc = s.cp[c], k = cc.a === i ? cc.b : cc.a;
        if (s.J[c] > jw) (jw = s.J[c]), (jb = k);
      }
      build(SA, s, i, -1, SC * 0.45);
      finish(SA, mix);
      build(SB, s, i, jb, SC * 0.45);
      finish(SB, mix);
      const dA = A * ak * (0.4 + 0.14 * (pi.nH / 3)), wd = wk * s.w;
      paint(F, xi, yi, SA, SA, wd, 4.5 * wk, dA * 0.8);
      paint(F, xi, yi, SB, SB, wd, 4.5 * wk, dA * 0.9 * mix);
      if (nr < st.rx.length && A * pi.nH > 0.3) (st.rx[nr] = xi), (st.ra[nr] = A * (0.03 + 0.025 * pi.nH)), (st.rs[nr++] = hash32(floor(xi * 31), floor(s.w * 1000)) & 1023);
    }
    // Cross peaks, one pair for each coupling: the same checkerboard on both sides of the diagonal, the second
    // being the first turned about it.
    for (let c = 0; c < s.cp.length; c++) {
      const cc = s.cp[c], a = s.pr[cc.a], b = s.pr[cc.b];
      const da = a.d0 + a.o, db = b.d0 + b.o;
      build(SC1, s, cc.a, cc.b, SC);
      finish(SC1, mix);
      build(SC2, s, cc.b, cc.a, SC);
      finish(SC2, mix);
      const cA = A * ak * (0.6 + 0.17 * sqrt(a.nH * b.nH)), wc = wk * s.w;
      // First dimension (y) is a's shift and second (x) is b's: a seen across b along y, b seen across a along x.
      paint(F, pxOf(db), pyOf(da), SC2, SC1, wc, 5.2 * wk, cA);
      paint(F, pxOf(da), pyOf(db), SC1, SC2, wc, 5.2 * wk, cA);
    }
  }

  for (const m of st.imp) {
    const e = sstep(0, 3, m.age) * (1 - sstep(m.dur - 3, m.dur, m.age));
    if (e > 0.02) paint(F, pxOf(m.d), pyOf(m.d), ONE, ONE, m.w * wk, 4.5 * wk, m.A * e * ak);
  }

  // t1 noise: a faint streak down the column of every strong peak.
  for (let i = 0; i < nr; i++) ridge(F, st.rx[i], 1.1, 4, st.ra[i], st.rs[i], t, 0.75);

  // The solvent: a wide bright band in x that breathes and wanders, with its own diagonal peak where it meets the diagonal.
  const xs = st.xs, br = 1 + 0.3 * sin((TAU * t) / 17 + st.sph) + 0.2 * sin((TAU * t) / 29.3 + st.sph2);
  ridge(F, xs, 1.7 + 0.4 * sin((TAU * t) / 23 + st.sph2), 8, 0.2 * br, 777, t, 0.5);
  const ds = 10 - (xs - 3) / 5.8;
  paint(F, xs, pyOf(ds), ONE, ONE, 1.9, 8, 0.9 * br);

  // ---- the ground, a slow smooth field and a faster ripple --------------------------------------
  const { X, Y, pos, neg, base } = st;
  const ph = st.ph;
  // Five separable swells of different size, each drifting on its own clock, and a ripple that travels.
  const FX = [1.3, 2.1, 3.2, 1.7, 0.9], FY = [1.1, 2.4, 1.7, 3.3, 1.9], SX = [0.09, 0.13, -0.07, 0.1, 0.06], SY = [0.07, -0.05, 0.11, 0.09, -0.08];
  for (let k = 0; k < 5; k++) {
    for (let x = 0; x < W; x++) X[k][x] = cos((TAU * FX[k] * x) / W + ph[k] + SX[k] * t + 0.7 * sin(0.021 * t + ph[k + 5]));
    for (let y = 0; y < H; y++) Y[k][y] = cos((TAU * FY[k] * y) / H + ph[k + 8] + SY[k] * t);
  }
  const wv = 0.93 * t;
  for (let x = 0; x < W; x++) {
    X[5][x] = sin((TAU * x) / 21 - wv);
    X[6][x] = cos((TAU * x) / 21 - wv);
  }
  for (let y = 0; y < H; y++) {
    Y[5][y] = cos((TAU * y) / 38);
    Y[6][y] = sin((TAU * y) / 38);
  }
  const X0 = X[0], X1 = X[1], X2 = X[2], X3 = X[3], X4 = X[4], X5 = X[5], X6 = X[6], Y0 = Y[0], Y1 = Y[1], Y2 = Y[2], Y3 = Y[3], Y4 = Y[4], Y5 = Y[5], Y6 = Y[6];
  const b0 = base[0], b1 = base[1], b2 = base[2], c0 = base[3], c1 = base[4], c2 = base[5];
  const ISQ = 1 / sqrt(FMAX);
  for (let y = 0, o = 0; y < H; y++) {
    for (let x = 0; x < W; x++, o++) {
      const b = 0.5 + 0.24 * X0[x] * Y0[y] + 0.18 * X1[x] * Y1[y] + 0.14 * X2[x] * Y2[y] + 0.12 * X3[x] * Y3[y] + 0.06 * (X5[x] * Y5[y] + X6[x] * Y6[y]);
      const g = 0.22 + 1.6 * b, tn = 0.5 + 0.5 * X4[x] * Y4[y], v = F[o], a = v < 0 ? -v : v;
      let r = (b0 + (c0 - b0) * tn) * g, gg = (b1 + (c1 - b1) * tn) * g, bb = (b2 + (c2 - b2) * tn) * g;
      if (a > 0.0004) {
        const lut = v < 0 ? neg : pos, i = min(LUTN - 1, floor(sqrt(a) * ISQ * (LUTN - 1) + 0.5)) * 3, k = min(1, a * 30);
        r += (lut[i] - r) * k;
        gg += (lut[i + 1] - gg) * k;
        bb += (lut[i + 2] - bb) * k;
      }
      display.setPixel(x, y, r > 255 ? 255 : r | 0, gg > 255 ? 255 : gg | 0, bb > 255 ? 255 : bb | 0);
    }
  }
}
