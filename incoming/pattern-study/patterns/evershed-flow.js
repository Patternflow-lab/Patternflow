// ===== Patternflow pattern =====
// Title:   Evershed Flow
// Family:  sunspots
// Idea:    A sunspot in white light, close up, with the granulation round it: a near-black red-brown umbra with a few brighter umbral dots and now and then a light bridge, ringed by a penumbra of long radial filaments that are dark and red at the inner edge and bright and golden at the outer, while small bright grains slide along the filaments, inward in the inner penumbra and outward in the outer, and now and then one leaves the rim as a bright point and drifts away across the moat, over a photosphere of boiling gold cells with dark lanes between them, a second small spot low in the panel, a pore, and a few brighter faculae.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Evershed flow of gas along the penumbral filaments, out of the spot at 1 to 2 km a second (John Evershed, 1909, from memory), penumbral grains moving in along the inner filaments and out along the outer ones, the moving magnetic features that leave the rim and cross the moat (Harvey and Harvey, 1973, from memory), the outflow moat itself, the granulation of cells and lanes with its exploding granules, and the slight spiral of the filaments, whose sense follows the hemisphere (from memory); pattern round 259
// Round:   259
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0..4, Size=-1..1, Twist=-1..1
//
// Knob 1: Hue. The tint of the filter the spot is seen through, one turn of the wheel over the knob's travel. Where the knob opens it is white light: pale gold cells, amber lanes, a red-brown umbra. At 0.18 it is green, at 0.42 cyan, at 0.6 blue, at 0.66 violet, at 0.8 pink and at 0.93 red, the red of a hydrogen alpha filter. The hottest points stay near white whatever the tint.
// Knob 2: Flow. How fast the Sun runs. Where the knob opens the grains slide along the filaments at 1 to 4.5 LEDs a second, the moving points cross the moat at 2.4, a granule lives 8 to 26 s and the filaments regrow every 10 to 26 s. At 0 it all runs a third as fast, so the grains crawl at 0.3 to 1.5 LEDs a second and a granule lasts 25 to 80 s. At 4 it runs three times as fast: grains at 3 to 14 LEDs a second, granules of 3 to 9 s, filaments that regrow every 3 to 9 s.
// Knob 3: Size. The size of the spot. At the bottom the big spot is a pore with a thin collar: a penumbra 18 LEDs across round an umbra of 10, the second spot has shrunk to 9 LEDs across and the pore beside it to 6. Where the knob opens the penumbra is 50 LEDs across and the umbra 19, the second spot 26 across, the pore 7.5. At the top the penumbra is 62 LEDs across, as wide as the panel, round an umbra of 23.
// Knob 4: Twist. The spiral of the filaments, with a sign. Where the knob opens the rim is turned 16 degrees from the inner edge, clockwise as it goes out: the slight spiral of a real spot. At the top the filaments wind 92 degrees clockwise, and at the bottom 69 degrees the other way, which is more than a real spot does and makes a small galaxy of it. The grains run along the spirals.

// What the picture is. Intensity, a number from 0 (black) to 1.3 (hot white), at each of the 64 x 128 LEDs, run through a colour ramp. Nothing is simulated on the grid.
// The spots. Three: the big one at the top of the panel, a second half its size low down, and a pore, each with a centre that wanders slowly (sums of sines at periods of 2 to 6 minutes
// that do not divide each other), an umbra radius, a penumbra radius, and edges that are ragged: both radii are multiplied by slow one-dimensional noise round the circle, so the umbra is a lumpy blob and the rim a ragged one.
// The penumbra. A pixel at radius r and angle theta about the centre has a position in the filament frame, phi = theta - twist(r) + a small slow warp. The filaments are
// value noise round the circle, with seven lattices of 14, 20, 28, 40, 56, 80 and 112 cells to the turn: the pixel blends the two lattices whose cell count makes a cell about 1.9 LEDs
// wide at its radius, so near the umbra the filaments are few and wide apart, and as r grows they fork into more of them without a seam. Each lattice is crossfaded in time
// between random rows every 10 to 26 s of flow, so the filaments keep growing and dying and never return. Across the penumbra the base brightness rises from 0.30 to 0.62, the
// filament contrast rises with it, and a bright filament pokes out past the rim and into the umbra by a couple of LEDs.
// The flow. Along each filament a second noise, long in the radial direction, is advected along r with the speed of the flow: outward in the outer half, inward
// in the inner half, the two cross-faded over the middle so the place where they meet has no seam. Over that, grains: 2.5 LEDs wide and 6 LEDs long, bright, born near the middle of
// the penumbra on a bright filament and carried along it. The inner ones run in to the umbra, the outer ones run out; one in eight of the outer ones leaves the rim and goes on as a
// round bright point, the moving magnetic feature, at 2.4 LEDs a second across the moat.
// The photosphere. A power diagram: 240 seed points, each with a weight, the cell of each is where its distance squared minus its weight is least. A pixel's brightness
// goes from the lane level to the cell level over the distance to the nearest cell edge, so the lanes are the same width everywhere (about 2.4 LEDs). A seed is born with a very
// negative weight, grows into a cell, lives 8 to 26 s of flow and shrinks until its neighbours eat it; some of the old ones grow a darker middle that splits them. The seeds
// jiggle and, near a spot, flow away from it, the moat; where one is born is the best of seven tries at the point furthest from all the others, so the cells stay even.
// Round the spots a few faculae, soft bright streaks that lie along the rim at a radius of 1.2 to 2, light the lanes.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, abs, exp, sin, cos, log, pow, PI, min, max } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sst = (a, b, x) => {
  const t = (x - a) / (b - a);
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
};
const rr = (a, b) => a + (b - a) * Math.random();
// A sine from a table, for the per-pixel work that does not need more than a few thousandths of a radian, and an atan2 good to 1e-4.
const SN = new Float32Array(4096);
for (let i = 0; i < 4096; i++) SN[i] = sin((i * TAU) / 4096);
const fsin = (x) => SN[(x * 651.8986469044033) & 4095];
function fatan2(y, x) {
  const ax = abs(x), ay = abs(y), mx = ax > ay ? ax : ay;
  if (mx === 0) return 0;
  const a = (ax > ay ? ay : ax) / mx, q = a * a;
  let r = (((-0.0464964749 * q + 0.15931422) * q - 0.327622764) * q * a) + a;
  if (ay > ax) r = 1.57079637 - r;
  if (x < 0) r = 3.14159274 - r;
  return y < 0 ? -r : r;
}

// ---- value noise by hash: no state is kept for it, so 900 s costs nothing
function hsh(a, b, c) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1274126177)) | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return ((h >>> 4) & 0xfffff) / 524287.5 - 1;
}
// One row of a lattice round a circle, n cells, crossfaded in time between its row it and it + 1 (weights kept at unit variance); out has n + 1 values, the last a copy of the first.
function blendRow(out, salt, n, tt) {
  const it = floor(tt), ft = tt - it, st = ft * ft * (3 - 2 * ft), w0 = 1 - st, nr = 1 / sqrt(w0 * w0 + st * st);
  for (let i = 0; i < n; i++) out[i] = (hsh(salt, i, it) * w0 + hsh(salt, i, it + 1) * st) * nr;
  out[n] = out[0];
}
// Take the long runs out of a row: each cell loses 0.4 of each neighbour (the row is a circle), so a bright cell is followed by a dull one and a wedge of ten LEDs of one tone does not happen.
const HPK = 0.4, HPN = 1 / sqrt(1 + 2 * HPK * HPK);
const hpTmp = new Float32Array(128);
function highPass(row, n) {
  for (let i = 0; i < n; i++) hpTmp[i] = row[i];
  for (let i = 0; i < n; i++) row[i] = (hpTmp[i] - HPK * (hpTmp[i === 0 ? n - 1 : i - 1] + hpTmp[i + 1 === n ? 0 : i + 1])) * HPN;
  row[n] = row[0];
}
// Smooth value from a row at u in [0, 1).
function rowAt(row, n, u) {
  const a = u * n, ia = a | 0, fa = a - ia;
  return row[ia] + (row[ia + 1] - row[ia]) * fa * fa * (3 - 2 * fa);
}

// ---- constants
const NL = [14, 20, 28, 40, 56, 80, 112]; // cells to the turn of the filament lattices
const TL = [26, 23, 20, 17, 15, 12.5, 10.5]; // seconds a row lasts, per lattice
const PERIOD = 1.9; // LEDs from one lattice cell to the next, round the circle: a bright or a dark filament is about a cell wide
const LT = 2.3; // seconds of flow a row of the streak lattice lasts
const NSEED = 240;
const BIN = 9, BX0 = -10, BY0 = -10, NBX = 10, NBY = 17, NBIN = NBX * NBY, CAP = 48;
const RX0 = -10, RX1 = 74, RY0 = -10, RY1 = 138;
const NGR = 110, NDOT = 12, NFAC = 26;
const NSPOT = 3;
const LPN = 400; // radii at 0.1 LED steps, to find the lattice pair
const EDGEN = 256;
const NOSLOT = -2147483648;
const REACH = new Float32Array(3), INNER = new Float32Array(3);

const LPI = new Int8Array(LPN), LPF = new Float32Array(LPN), LPR = new Float32Array(LPN);
for (let k = 0; k < LPN; k++) {
  const r = (k + 0.5) * 0.1;
  const lp = cl(2 * 1.4426950408889634 * log((r * TAU) / PERIOD / 14), 0, 5.999);
  LPI[k] = lp | 0;
  const f = lp - (lp | 0), s = f * f * (3 - 2 * f);
  LPF[k] = s;
  LPR[k] = 1 / sqrt((1 - s) * (1 - s) + s * s);
}

// The age of a streak at rel, in seconds a LED of penumbra width: the integral of one over its speed, in two tables at 1/64 steps of rel. Outward the streak runs
// 1.5 (1 + 2 rel) LEDs a second, from 1.5 at the edge of the umbra to 4.5 at the rim; inward 1.9 (1.3 - 1.2 rel), from 2.5 at the umbra to 1.3 in the middle.
const SIN = new Float32Array(66), SOUT = new Float32Array(66);
for (let i = 0; i < 66; i++) {
  const x = min(i / 64, 1);
  SIN[i] = -log(1.3 - 1.2 * x) / 2.28;
  SOUT[i] = log(1 + 2 * x) / 3;
}
function lutAt(T, x) {
  const a = x * 64, i = a | 0;
  return T[i] + (T[i + 1] - T[i]) * (a - i);
}

// A set of rings of lattice rows, one ring a lattice, for a noise that is advected so its rows are asked for in an order that creeps on.
function makeRings(salt) {
  const R = { salt, val: [], tag: [] };
  for (let i = 0; i < NL.length; i++) {
    R.val.push(new Float32Array(16 * (NL[i] + 1)));
    R.tag.push(new Int32Array(16).fill(NOSLOT));
  }
  return R;
}
function ringRow(R, i, m) {
  const n = NL[i], slot = m & 15, tg = R.tag[i], o = slot * (n + 1);
  if (tg[slot] !== m) {
    const row = R.val[i], salt = R.salt + i * 13;
    for (let c = 0; c < n; c++) row[o + c] = hsh(salt, c, m);
    row[o + n] = row[o];
    tg[slot] = m;
  }
  return o;
}
function ringAt(R, i, u, tt) {
  const n = NL[i], a = u * n, ia = a | 0, fa = a - ia, sa = fa * fa * (3 - 2 * fa);
  const it = floor(tt), ft = tt - it, st = ft * ft * (3 - 2 * ft), w0 = 1 - st;
  const o0 = ringRow(R, i, it), o1 = ringRow(R, i, it + 1), v = R.val[i];
  const x0 = v[o0 + ia] + (v[o0 + ia + 1] - v[o0 + ia]) * sa, x1 = v[o1 + ia] + (v[o1 + ia + 1] - v[o1 + ia]) * sa;
  return (x0 * w0 + x1 * st) / sqrt(w0 * w0 + st * st);
}

function makeSpot(i) {
  const s = {
    salt: 1000 * (i + 1) + floor(Math.random() * 500),
    cx: 32, cy: 64, ru: 5, rp: i === 1 ? 6 : 9, tw: 0, wid: 4, // geometry of this frame
    fs: i === 1 ? 7 : 10, // 10 over the LEDs a lattice step is looked up at: the smaller spot has coarser filaments
    on: 1, // how much of the pool of grains and dots it keeps
    ruT: new Float32Array(EDGEN + 1), rpT: new Float32Array(EDGEN + 1), // the umbra and the penumbra radius round the circle
    fl: NL.map((n) => new Float32Array(n + 1)), // the filament lattices, in time, for this frame
    crs: new Float32Array(EDGEN + 1), // the slow coarse sectors of filament brightness round the circle, two sums
    crb: new Float32Array(EDGEN + 1),
    rA: new Float32Array(10), rB: new Float32Array(6), eU1: new Float32Array(8), eU2: new Float32Array(14), eP1: new Float32Array(7), eP2: new Float32Array(12),
    rIn: makeRings(0), rOut: makeRings(0),
  };
  s.rIn.salt = s.salt + 700;
  s.rOut.salt = s.salt + 800;
  return s;
}

function makeState() {
  return {
    ready: false, kn: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], t: 0, tf: 0, mult: 1,
    spots: [makeSpot(0), makeSpot(1), makeSpot(2)],
    // seeds of the granulation
    sx: new Float32Array(NSEED), sy: new Float32Array(NSEED), svx: new Float32Array(NSEED), svy: new Float32Array(NSEED),
    sage: new Float32Array(NSEED), slife: new Float32Array(NSEED), sw0: new Float32Array(NSEED), sw: new Float32Array(NSEED),
    sb: new Float32Array(NSEED), sfr: new Float32Array(NSEED), sln: new Float32Array(NSEED),
    binN: new Int16Array(NBIN), binL: new Int16Array(NBIN * 24), candN: new Int16Array(NBIN), cand: new Int16Array(NBIN * CAP),
    cx: new Float32Array(NBIN * CAP), cy: new Float32Array(NBIN * CAP), cw: new Float32Array(NBIN * CAP),
    // grains: they ride a filament out or in
    gsp: new Int8Array(NGR), gph: new Float32Array(NGR), gr: new Float32Array(NGR), gdir: new Int8Array(NGR), gamp: new Float32Array(NGR),
    gage: new Float32Array(NGR), gsc: new Float32Array(NGR), gmmf: new Int8Array(NGR), gx: new Float32Array(NGR), gy: new Float32Array(NGR), gfree: new Float32Array(NGR),
    gth: new Float32Array(NGR),
    // umbral dots
    dsp: new Int8Array(NDOT), dx: new Float32Array(NDOT), dy: new Float32Array(NDOT), dage: new Float32Array(NDOT), dlife: new Float32Array(NDOT),
    damp: new Float32Array(NDOT), dvx: new Float32Array(NDOT), dvy: new Float32Array(NDOT),
    // faculae
    fx: new Float32Array(NFAC), fy: new Float32Array(NFAC), fage: new Float32Array(NFAC), flife: new Float32Array(NFAC), famp: new Float32Array(NFAC),
    fang: new Float32Array(NFAC), fsa: new Float32Array(NFAC), fsb: new Float32Array(NFAC),
    A: new Float32Array(NPX), B: new Float32Array(NPX),
    // the warp of the granulation, split into row and column parts: four terms, sine and cosine
    wr: new Float32Array(8 * H), wc: new Float32Array(8 * W),
    lut: new Float32Array(521 * 3), hueAt: -1, hueMat: new Float32Array(9),
  };
}

export function setup(params) {
  params.s = makeState();
}

// ---- geometry of the spots
function sizeOf(k3) {
  return k3 < 0 ? 25 + 16 * k3 : 25 + 6 * k3;
}
function geometry(S) {
  const t = S.t, tf = S.tf, k3 = cl(S.ks[2], -1, 1), k4 = cl(S.ks[3], -1, 1);
  const sp = S.spots;
  const rp0 = sizeOf(k3) * (1 + 0.045 * sin(0.0213 * t + 0.7) + 0.03 * sin(0.0531 * t + 2.2));
  let a = sp[0];
  a.cx = 31 + 4.2 * sin(0.0173 * t + 0.4) + 2.2 * sin(0.0411 * t + 2.1);
  a.cy = 41 + 3.2 * sin(0.0129 * t + 1.1) + 1.6 * sin(0.0373 * t + 0.3);
  a.rp = rp0;
  a.ru = 2.6 + 0.28 * rp0;
  a.tw = 1.4 * k4 + 0.2;
  a = sp[1];
  a.cx = 42 + 3.6 * sin(0.0151 * t + 3.1) + 1.8 * sin(0.0337 * t + 0.9);
  a.cy = 103 + 3 * sin(0.0117 * t + 0.2) + 1.4 * sin(0.0429 * t + 2.6);
  a.rp = 0.52 * rp0 * (1 + 0.04 * sin(0.0293 * t + 1.9));
  a.ru = 1.8 + 0.28 * a.rp;
  a.tw = 0.8 * (1.4 * k4 + 0.2);
  a = sp[2];
  a.cx = 12 + 2.4 * sin(0.0197 * t + 1.4) + 1.2 * sin(0.0461 * t + 3.3);
  a.cy = 83 + 2.4 * sin(0.0143 * t + 2.8) + 1.2 * sin(0.0391 * t + 0.5);
  a.ru = max(2.8, 0.15 * rp0 * (1 + 0.1 * sin(0.0331 * t + 0.4)));
  a.rp = a.ru + 1.7;
  a.tw = 0;
  for (let k = 0; k < NSPOT; k++) {
    const s = sp[k];
    s.wid = s.rp - s.ru;
    s.on = k === 2 ? 0 : cl((s.rp * s.rp - s.ru * s.ru) / 520, 0, 1);
    // the radii round the circle: slow noise, one row of each lattice per frame
    blendRow(s.eU1, s.salt + 301, 7, tf / 46);
    blendRow(s.eU2, s.salt + 302, 13, tf / 29);
    blendRow(s.eP1, s.salt + 303, 6, tf / 53);
    blendRow(s.eP2, s.salt + 304, 11, tf / 31);
    const fu = k === 2 ? 0.4 : 1;
    for (let b = 0; b <= EDGEN; b++) {
      const u = b === EDGEN ? 0 : b / EDGEN;
      s.ruT[b] = s.ru * (1 + fu * (rowAt(s.eU1, 7, u) * 0.08 + rowAt(s.eU2, 13, u) * 0.03));
      s.rpT[b] = s.rp * (1 + fu * (rowAt(s.eP1, 6, u) * 0.06 + rowAt(s.eP2, 11, u) * 0.04));
    }
    if (k === 2) continue;
    // the filament lattices for this frame, and the coarse sectors
    for (let i = 0; i < NL.length; i++) {
      blendRow(s.fl[i], s.salt + i * 17, NL[i], tf / TL[i] + i * 3.7);
      highPass(s.fl[i], NL[i]);
    }
    blendRow(s.rA, s.salt + 91, 9, tf / 61);
    blendRow(s.rB, s.salt + 92, 5, tf / 83);
    for (let b = 0; b <= EDGEN; b++) {
      const u = b === EDGEN ? 0 : b / EDGEN;
      s.crs[b] = rowAt(s.rA, 9, u);
      s.crb[b] = rowAt(s.rB, 5, u);
    }
  }
}

// ---- filament frame
function twistAt(s, r) {
  const x = cl((r - s.ru * 0.7) / (s.rp - s.ru * 0.7), 0, 1);
  return s.tw * x * x * (3 - 2 * x);
}
function twistRate(s, r) {
  const w = s.rp - s.ru * 0.7, x = (r - s.ru * 0.7) / w;
  return x <= 0 || x >= 1 ? 0 : (s.tw * 6 * x * (1 - x)) / w;
}
// A small slow warp of the filament angle, in the straight frame
function warp(phi, r, tf) {
  return 0.08 * fsin(2 * phi + 0.21 * r + 0.031 * tf + 1.3) + 0.05 * fsin(3 * phi - 0.17 * r - 0.047 * tf + 0.2);
}
// Filament value in about [-1, 1] at u (angle over a turn, in [0, 1)), radius index k
function filament(s, u, k) {
  const i0 = LPI[k], w1 = LPF[k], na = NL[i0], nb = NL[i0 + 1];
  const a = rowAt(s.fl[i0], na, u), b = rowAt(s.fl[i0 + 1], nb, u);
  const m = (a * (1 - w1) + b * w1) * LPR[k];
  const c = u * EDGEN, ci = c | 0, cf = c - ci;
  const ca = s.crs[ci] + (s.crs[ci + 1] - s.crs[ci]) * cf, cb = s.crb[ci] + (s.crb[ci + 1] - s.crb[ci]) * cf;
  return cl((m * (0.92 + 0.15 * ca) + 0.04 * cb) * 2.1, -1, 1);
}
// A streak along the filaments, advected: tau is the age of the pattern in rows, and the sign of its slope decides which way it runs
function streak(R, u, k, tau) {
  const i0 = LPI[k], w1 = LPF[k];
  return (ringAt(R, i0, u, tau) * (1 - w1) + ringAt(R, i0 + 1, u, tau) * w1) * LPR[k];
}

// ---- seeds of the granulation
function spawnSeed(S, i, young) {
  const sp = S.spots;
  let bx = 0, by = 0, bd = -1;
  S.sx[i] = -1000;
  for (let tries = 0; tries < 7; tries++) {
    let x, y;
    if (Math.random() < 0.3) {
      const s = sp[Math.random() < 0.65 ? 0 : Math.random() < 0.7 ? 1 : 2], a = Math.random() * TAU, rd = s.rp + rr(0.5, 5);
      x = s.cx + rd * cos(a);
      y = s.cy + rd * sin(a);
    } else {
      x = rr(RX0, RX1);
      y = rr(RY0, RY1);
    }
    if (x < RX0 + 1 || x > RX1 - 1 || y < RY0 + 1 || y > RY1 - 1) continue;
    let ok = true;
    for (let k = 0; k < NSPOT && ok; k++) {
      const s = sp[k], dx = x - s.cx, dy = y - s.cy;
      if (dx * dx + dy * dy < (s.rp - 1) * (s.rp - 1)) ok = false;
    }
    if (!ok) continue;
    // Mitchell's best candidate: the one furthest from every other seed keeps the cells even
    let dm = 1e9;
    for (let j = 0; j < NSEED; j++) {
      const dx = x - S.sx[j], dy = y - S.sy[j], d = dx * dx + dy * dy;
      if (d < dm) dm = d;
    }
    if (dm > bd) { bd = dm; bx = x; by = y; }
  }
  if (bd < 0) { bx = rr(RX0 + 1, RX1 - 1); by = rr(RY0 + 1, RY1 - 1); }
  S.sx[i] = bx;
  S.sy[i] = by;
  S.svx[i] = rr(-0.4, 0.4);
  S.svy[i] = rr(-0.4, 0.4);
  S.slife[i] = rr(8, 26);
  S.sage[i] = young ? 0 : Math.random() * S.slife[i];
  S.sw0[i] = rr(4, 16);
  S.sb[i] = rr(0.8, 1.0);
  S.sln[i] = rr(0.36, 0.58);
  S.sfr[i] = Math.random() < 0.45 ? rr(0.12, 0.3) : 0;
}

function weightOf(S, i) {
  const u = S.sage[i] / S.slife[i];
  const env = sst(0, 0.2, u) * (1 - sst(0.74, 1, u));
  return S.sw0[i] * env - 17 * (1 - env);
}

function stepSeeds(S, dtf) {
  const sp = S.spots, ex = exp(-dtf / 3), kick = sqrt(dtf) * 0.55;
  for (let i = 0; i < NSEED; i++) {
    S.sage[i] += dtf;
    let x = S.sx[i], y = S.sy[i];
    S.svx[i] = S.svx[i] * ex + kick * (Math.random() - 0.5) * 2;
    S.svy[i] = S.svy[i] * ex + kick * (Math.random() - 0.5) * 2;
    let best = 1e9, bs = 0;
    for (let k = 0; k < NSPOT; k++) {
      const s = sp[k], dx = x - s.cx, dy = y - s.cy, d = dx * dx + dy * dy - s.rp * s.rp * 0.5;
      if (d < best) { best = d; bs = k; }
    }
    // the moat: a flow away from the nearest spot, strongest just outside its rim
    const s = sp[bs], ddx = x - s.cx, ddy = y - s.cy, r = sqrt(ddx * ddx + ddy * ddy) + 1e-3;
    const g = r > s.rp - 2 ? exp(-pow((r - s.rp) / (0.55 * s.rp + 2), 2)) : 0.3;
    const v = 1.25 * g * (s.rp > 5 ? 1 : 0.5);
    x += (S.svx[i] + (ddx / r) * v) * dtf;
    y += (S.svy[i] + (ddy / r) * v) * dtf;
    S.sx[i] = x;
    S.sy[i] = y;
    let gone = S.sage[i] >= S.slife[i] || x < RX0 || x > RX1 || y < RY0 || y > RY1;
    for (let k = 0; k < NSPOT && !gone; k++) {
      const q = sp[k], dx = x - q.cx, dy = y - q.cy;
      if (dx * dx + dy * dy < (q.rp - 3) * (q.rp - 3)) gone = true;
    }
    if (gone) spawnSeed(S, i, true);
    S.sw[i] = weightOf(S, i);
  }
}

function buildBins(S) {
  S.binN.fill(0);
  for (let i = 0; i < NSEED; i++) {
    const bx = cl(floor((S.sx[i] - BX0) / BIN), 0, NBX - 1), by = cl(floor((S.sy[i] - BY0) / BIN), 0, NBY - 1), b = by * NBX + bx;
    if (S.binN[b] < 24) S.binL[b * 24 + S.binN[b]++] = i;
  }
  for (let by = 0; by < NBY; by++) {
    for (let bx = 0; bx < NBX; bx++) {
      const b = by * NBX + bx;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = by + dy;
        if (yy < 0 || yy >= NBY) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = bx + dx;
          if (xx < 0 || xx >= NBX) continue;
          const bb = yy * NBX + xx, c = S.binN[bb];
          for (let q = 0; q < c && n < CAP; q++) {
            const sd = S.binL[bb * 24 + q], o = b * CAP + n++;
            S.cand[o] = sd;
            S.cx[o] = S.sx[sd];
            S.cy[o] = S.sy[sd];
            S.cw[o] = S.sw[sd];
          }
        }
      }
      S.candN[b] = n;
    }
  }
}

// ---- grains and moving magnetic features
function spawnGrain(S, i, fresh) {
  const sp = S.spots;
  const s0 = sp[0].on > 0.05 && (Math.random() < 0.75 || sp[1].on < 0.05) ? 0 : 1;
  S.gsp[i] = s0;
  const s = sp[s0];
  S.gdir[i] = Math.random() < 0.5 ? 1 : -1;
  const rel0 = S.gdir[i] > 0 ? rr(0.42, 0.62) : rr(0.28, 0.5);
  S.gr[i] = s.ru + rel0 * s.wid;
  // a bright filament, of five tried, at the radius it is born
  let best = -9, ph = 0;
  const k = cl(floor(S.gr[i] * s.fs), 0, LPN - 1);
  for (let q = 0; q < 5; q++) {
    const p = Math.random(), f = filament(s, p, k);
    if (f > best) { best = f; ph = p; }
  }
  S.gph[i] = ph * TAU; // the angle in the filament frame
  S.gamp[i] = rr(0.28, 0.46) * (0.75 + 0.25 * best);
  S.gage[i] = fresh ? 0 : Math.random() * 4;
  S.gmmf[i] = S.gdir[i] > 0 && Math.random() < 0.13 ? 1 : 0;
  S.gfree[i] = 0;
  S.gsc[i] = rr(0.75, 1.25);
}

function stepGrains(S, dtf) {
  const sp = S.spots;
  for (let i = 0; i < NGR; i++) {
    S.gage[i] += dtf;
    const s = sp[S.gsp[i]];
    if (S.gfree[i] > 0) {
      // a moving magnetic feature, out in the moat
      const v = 2.4 * S.gsc[i] * dtf;
      S.gx[i] += cos(S.gth[i]) * v;
      S.gy[i] += sin(S.gth[i]) * v;
      S.gfree[i] += dtf;
      if (S.gfree[i] > 7.5 * (0.8 + 0.4 * S.gsc[i]) || S.gx[i] < -4 || S.gx[i] > 68 || S.gy[i] < -4 || S.gy[i] > 132) spawnGrain(S, i, true);
      continue;
    }
    const rel = (S.gr[i] - s.ru) / s.wid;
    // speed of the flow, LEDs a second: quickest in the outer penumbra
    const v = S.gdir[i] > 0 ? 1.4 + 2.2 * rel : 1.1 + 1.0 * (0.55 - rel);
    S.gr[i] += S.gdir[i] * v * S.gsc[i] * dtf;
    const nrel = (S.gr[i] - s.ru) / s.wid;
    if (S.gdir[i] < 0 && nrel < 0) spawnGrain(S, i, true);
    else if (S.gdir[i] > 0 && nrel > 1) {
      if (S.gmmf[i]) {
        // it breaks off at the rim and goes on as a round point, straight out
        const th = S.gph[i] + twistAt(s, S.gr[i]);
        S.gfree[i] = 0.001;
        S.gth[i] = th;
        S.gx[i] = s.cx + S.gr[i] * cos(th);
        S.gy[i] = s.cy + S.gr[i] * sin(th);
      } else spawnGrain(S, i, true);
    } else if (S.gage[i] > 14) spawnGrain(S, i, true);
  }
}

// ---- umbral dots
function spawnDot(S, i, fresh) {
  S.dsp[i] = Math.random() < 0.8 ? 0 : 1;
  const a = Math.random() * TAU, rd = sqrt(Math.random()) * 0.72;
  S.dx[i] = cos(a) * rd; // in units of the umbra radius, so the dot rides the umbra as it breathes
  S.dy[i] = sin(a) * rd;
  S.dlife[i] = rr(9, 30);
  S.dage[i] = fresh ? 0 : Math.random() * S.dlife[i];
  S.damp[i] = rr(0.17, 0.3);
  S.dvx[i] = rr(-0.012, 0.012);
  S.dvy[i] = rr(-0.012, 0.012);
}
function stepDots(S, dtf) {
  for (let i = 0; i < NDOT; i++) {
    S.dage[i] += dtf;
    S.dx[i] += S.dvx[i] * dtf;
    S.dy[i] += S.dvy[i] * dtf;
    if (S.dage[i] > S.dlife[i] || S.dx[i] * S.dx[i] + S.dy[i] * S.dy[i] > 0.8) spawnDot(S, i, true);
  }
}

// ---- faculae
function spawnFac(S, i, fresh) {
  const sp = S.spots;
  let x = 0, y = 0, ang = 0, near = 1;
  for (let tries = 0; tries < 8; tries++) {
    near = 1;
    if (Math.random() < 0.65) {
      const s = sp[Math.random() < 0.7 ? 0 : 1], a = Math.random() * TAU, rd = s.rp * rr(1.12, 2);
      x = s.cx + rd * cos(a);
      y = s.cy + rd * sin(a);
      ang = a + PI / 2;
      near = 0.35 + 0.65 * sst(8, 22, s.rp); // a small spot has small faculae
    } else {
      x = rr(2, 62);
      y = rr(2, 126);
      ang = Math.random() * TAU;
    }
    let ok = x > -2 && x < 66 && y > -2 && y < 130;
    for (let k = 0; k < NSPOT && ok; k++) {
      const s = sp[k], dx = x - s.cx, dy = y - s.cy;
      if (dx * dx + dy * dy < (s.rp + 2) * (s.rp + 2)) ok = false;
    }
    if (ok) break;
  }
  S.fx[i] = x;
  S.fy[i] = y;
  S.fang[i] = ang;
  S.flife[i] = rr(22, 60);
  S.fage[i] = fresh ? 0 : Math.random() * S.flife[i];
  S.famp[i] = rr(0.2, 0.34) * near;
  S.fsa[i] = rr(2.2, 4.2);
  S.fsb[i] = rr(1.1, 1.5);
}
function stepFac(S, dtf) {
  const sp = S.spots;
  for (let i = 0; i < NFAC; i++) {
    S.fage[i] += dtf;
    let best = 1e9, bs = 0;
    for (let k = 0; k < NSPOT; k++) {
      const s = sp[k], dx = S.fx[i] - s.cx, dy = S.fy[i] - s.cy, d = dx * dx + dy * dy - s.rp * s.rp;
      if (d < best) { best = d; bs = k; }
    }
    const s = sp[bs], dx = S.fx[i] - s.cx, dy = S.fy[i] - s.cy, r = sqrt(dx * dx + dy * dy) + 1e-3;
    S.fx[i] += (dx / r) * 0.35 * dtf;
    S.fy[i] += (dy / r) * 0.35 * dtf;
    if (S.fage[i] > S.flife[i] || r < s.rp + 1) spawnFac(S, i, true);
  }
}

function rates(kn) {
  return pow(2, (cl(kn[1], 0, 4) - 2) * 0.8);
}

function advance(S, d, kn) {
  S.t += d;
  const m = rates(kn);
  S.mult = m;
  S.tf += d * m;
  const kk = 1 - exp(-d * 5);
  for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * kk;
  geometry(S);
  const dtf = d * m;
  stepSeeds(S, dtf);
  stepGrains(S, dtf);
  stepDots(S, dtf);
  stepFac(S, dtf);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  if (!S.ready) {
    S.ready = true;
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    S.mult = rates(kn);
    S.t = 30; // the spots start somewhere along their wandering, not at its first phase
    S.tf = 40;
    geometry(S);
    S.sx.fill(-1000);
    for (let i = 0; i < NSEED; i++) spawnSeed(S, i, false);
    for (let i = 0; i < NGR; i++) spawnGrain(S, i, false);
    for (let i = 0; i < NDOT; i++) spawnDot(S, i, false);
    for (let i = 0; i < NFAC; i++) spawnFac(S, i, false);
    // run the particles ahead 18 s with the spots standing still; the lattices need no run
    for (let i = 0; i < NSEED; i++) S.sw[i] = weightOf(S, i);
    for (let n = 0; n < 60; n++) {
      stepSeeds(S, 0.3);
      stepGrains(S, 0.3);
      stepDots(S, 0.3);
      stepFac(S, 0.3);
    }
  }
  advance(S, d, kn);
  buildBins(S);
}

// ---- colour: intensity to RGB
const RAMP = [
  [0.0, 20, 9, 6],
  [0.08, 50, 22, 14],
  [0.16, 84, 40, 24],
  [0.26, 122, 62, 36],
  [0.38, 164, 90, 48],
  [0.5, 198, 124, 62],
  [0.62, 226, 160, 90],
  [0.74, 242, 192, 126],
  [0.86, 250, 220, 160],
  [0.98, 255, 238, 196],
  [1.12, 255, 248, 224],
  [1.3, 255, 255, 250],
];
function hueLut(S, hue) {
  if (S.hueAt === hue) return;
  const A = TAU * hue, c = cos(A), s = sin(A), m = S.hueMat;
  m[0] = 0.213 + c * 0.787 - s * 0.213; m[1] = 0.715 - c * 0.715 - s * 0.715; m[2] = 0.072 - c * 0.072 + s * 0.928;
  m[3] = 0.213 - c * 0.213 + s * 0.143; m[4] = 0.715 + c * 0.285 + s * 0.14; m[5] = 0.072 - c * 0.072 - s * 0.283;
  m[6] = 0.213 - c * 0.213 - s * 0.787; m[7] = 0.715 - c * 0.715 + s * 0.715; m[8] = 0.072 + c * 0.928 + s * 0.072;
  const lut = S.lut;
  let k = 0;
  for (let n = 0; n <= 520; n++) {
    const f = n / 400;
    while (k < RAMP.length - 2 && f > RAMP[k + 1][0]) k++;
    const a = RAMP[k], b = RAMP[k + 1], t = cl((f - a[0]) / (b[0] - a[0]), 0, 1);
    const r = a[1] + (b[1] - a[1]) * t, g = a[2] + (b[2] - a[2]) * t, bl = a[3] + (b[3] - a[3]) * t;
    lut[n * 3] = cl(r * m[0] + g * m[1] + bl * m[2], 0, 255);
    lut[n * 3 + 1] = cl(r * m[3] + g * m[4] + bl * m[5], 0, 255);
    lut[n * 3 + 2] = cl(r * m[6] + g * m[7] + bl * m[8], 0, 255);
  }
  S.hueAt = hue;
}

// ---- drawing
// A soft bright streak into a buffer: along axis (ux, uy) with sigma sa, across with sb.
function splat(A, cx, cy, ux, uy, sa, sb, amp) {
  const R = 2.7 * max(sa, sb);
  const x0 = max(0, floor(cx - R)), x1 = min(W - 1, floor(cx + R)), y0 = max(0, floor(cy - R)), y1 = min(H - 1, floor(cy + R));
  const ia = 1 / (2 * sa * sa), ib = 1 / (2 * sb * sb);
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, u = dx * ux + dy * uy, v = -dx * uy + dy * ux;
      const e = u * u * ia + v * v * ib;
      if (e < 7) A[y * W + x] += amp * exp(-e);
    }
  }
}

function layParticles(S) {
  const A = S.A, B = S.B, sp = S.spots;
  A.fill(0);
  B.fill(0);
  for (let i = 0; i < NFAC; i++) {
    const u = S.fage[i] / S.flife[i], env = sst(0, 0.15, u) * (1 - sst(0.7, 1, u));
    if (env > 0.01) splat(A, S.fx[i], S.fy[i], cos(S.fang[i]), sin(S.fang[i]), S.fsa[i], S.fsb[i], S.famp[i] * env);
  }
  for (let i = 0; i < NDOT; i++) {
    const s = sp[S.dsp[i]];
    if (i >= 3 && i / NDOT > s.ru / 13) continue;
    const u = S.dage[i] / S.dlife[i], env = sst(0, 0.2, u) * (1 - sst(0.7, 1, u));
    if (env > 0.01) splat(A, s.cx + S.dx[i] * s.ru, s.cy + S.dy[i] * s.ru, 1, 0, 1.25, 1.25, S.damp[i] * env * (s.ru < 4 ? 0.5 : 1));
  }
  for (let i = 0; i < NGR; i++) {
    const s = sp[S.gsp[i]];
    if (S.gfree[i] > 0) {
      const f = S.gfree[i], life = 7.5 * (0.8 + 0.4 * S.gsc[i]), env = sst(0, 0.6, f) * (1 - sst(0.35 * life, life, f));
      if (env > 0.01) {
        splat(A, S.gx[i], S.gy[i], 1, 0, 1.5, 1.5, 0.3 * env);
        splat(B, S.gx[i], S.gy[i], 1, 0, 1.3, 1.3, 0.22 * env);
      }
      continue;
    }
    if (i / NGR > s.on) continue;
    const rel = (S.gr[i] - s.ru) / s.wid;
    const env = sst(0, 0.8, S.gage[i]) * (S.gdir[i] > 0 ? 1 - sst(0.8, 1.0, rel) * (S.gmmf[i] ? 0 : 1) : sst(0.0, 0.25, rel));
    if (env < 0.01) continue;
    const r = S.gr[i], th = S.gph[i] - warp(S.gph[i], r, S.tf) + twistAt(s, r);
    const cs = cos(th), sn = sin(th), dr = r * twistRate(s, r);
    let ax = cs - dr * sn, ay = sn + dr * cs;
    const n = sqrt(ax * ax + ay * ay);
    ax /= n;
    ay /= n;
    splat(A, s.cx + r * cs, s.cy + r * sn, ax, ay, 2.6, 1.15, S.gamp[i] * env * (S.gmmf[i] ? 1.2 : 1));
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  hueLut(S, cl(S.kn[0], 0, 1));
  layParticles(S);
  const A = S.A, B = S.B, sp = S.spots, lut = S.lut;
  const tf = S.tf, t = S.t;
  const sb = S.sb, sln = S.sln, sfr = S.sfr, cand = S.cand, candN = S.candN, ccx = S.cx, ccy = S.cy, ccw = S.cw, sx = S.sx, sy = S.sy, sw = S.sw;
  const flow = pow(S.mult, 0.5);
  // the warp that makes the lanes meander: four sine terms, each split into a row part and a column part
  const wr = S.wr, wc = S.wc;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    const a0 = 0.43 * py + 0.27 * tf, a1 = 0.9 * py - 0.43 * tf + 2, a2 = -0.19 * py - 0.31 * tf + 1, a3 = 0.36 * py + 0.37 * tf + 4;
    wr[y * 8] = sin(a0); wr[y * 8 + 1] = cos(a0); wr[y * 8 + 2] = sin(a1); wr[y * 8 + 3] = cos(a1);
    wr[y * 8 + 4] = sin(a2); wr[y * 8 + 5] = cos(a2); wr[y * 8 + 6] = sin(a3); wr[y * 8 + 7] = cos(a3);
  }
  for (let x = 0; x < W; x++) {
    const px = x + 0.5, b0 = 0.17 * px, b1 = -0.4 * px, b2 = 0.39 * px, b3 = 0.85 * px;
    wc[x * 8] = sin(b0); wc[x * 8 + 1] = cos(b0); wc[x * 8 + 2] = sin(b1); wc[x * 8 + 3] = cos(b1);
    wc[x * 8 + 4] = sin(b2); wc[x * 8 + 5] = cos(b2); wc[x * 8 + 6] = sin(b3); wc[x * 8 + 7] = cos(b3);
  }
  // light bridge of the main spot
  const m0 = sp[0];
  const brAmt = sst(7, 9.5, m0.ru) * sst(-0.25, 0.45, 0.65 * sin(0.0213 * t + 1) + 0.45 * sin(0.0529 * t + 0.6));
  const brA = 0.7 + 0.55 * sin(0.0117 * t + 0.5), bu = cos(brA), bv = sin(brA), bo = 0.22 * m0.ru * sin(0.0171 * t + 2);
  // each spot reaches this far from its centre, and the photosphere is drawn only outside this
  const reach = REACH, inner = INNER;
  for (let k = 0; k < NSPOT; k++) {
    reach[k] = (sp[k].rp * 1.1 + 3.3) ** 2;
    inner[k] = sp[k].rp * 0.8 - 3 > 0 ? (sp[k].rp * 0.8 - 3) ** 2 : -1;
  }
  for (let y = 0; y < H; y++) {
    const py = y + 0.5, ry = y * 8;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, p = y * W + x, cx8 = x * 8;
      let need = true, near = false;
      for (let k = 0; k < NSPOT; k++) {
        const s = sp[k], dx = px - s.cx, dy = py - s.cy, d2 = dx * dx + dy * dy;
        if (d2 < reach[k]) near = true;
        if (d2 < inner[k]) need = false;
      }
      let Iv = 0;
      if (need) {
        // the lanes meander: the sample point is moved by a slow smooth warp
        const qx = px + 1.1 * (wr[ry] * wc[cx8 + 1] + wr[ry + 1] * wc[cx8]) + 0.35 * (wr[ry + 2] * wc[cx8 + 3] + wr[ry + 3] * wc[cx8 + 2]);
        const qy = py + 1.1 * (wr[ry + 4] * wc[cx8 + 5] + wr[ry + 5] * wc[cx8 + 4]) + 0.35 * (wr[ry + 6] * wc[cx8 + 7] + wr[ry + 7] * wc[cx8 + 6]);
        const bx = cl(((qx - BX0) / BIN) | 0, 0, NBX - 1), by = cl(((qy - BY0) / BIN) | 0, 0, NBY - 1), bi = by * NBX + bx, c0 = bi * CAP, cn = candN[bi];
        let p1 = 1e9, p2 = 1e9, o1 = c0, o2 = c0;
        for (let q = c0, e = c0 + cn; q < e; q++) {
          const dx = qx - ccx[q], dy = qy - ccy[q], pp = dx * dx + dy * dy - ccw[q];
          if (pp < p1) { p2 = p1; o2 = o1; p1 = pp; o1 = q; }
          else if (pp < p2) { p2 = pp; o2 = q; }
        }
        let i1 = cand[o1], i2 = cand[o2];
        // The two seeds are surely the nearest only if nothing outside the nine bins can beat the second: a seed there is at least the margin away, and a weight is at most 16.
        const mg = min(min(qx - BX0 - (bx - 1) * BIN, BX0 + (bx + 2) * BIN - qx), min(qy - BY0 - (by - 1) * BIN, BY0 + (by + 2) * BIN - qy));
        if (p2 > mg * mg - 16.5) {
          p1 = 1e9;
          p2 = 1e9;
          for (let q = 0; q < NSEED; q++) {
            const dx = qx - sx[q], dy = qy - sy[q], pp = dx * dx + dy * dy - sw[q];
            if (pp < p1) { p2 = p1; i2 = i1; p1 = pp; i1 = q; }
            else if (pp < p2) { p2 = pp; i2 = q; }
          }
        }
        const ddx = sx[i1] - sx[i2], ddy = sy[i1] - sy[i2], sep = sqrt(ddx * ddx + ddy * ddy) + 0.3;
        const lane = sst(0.35, 2.1, (p2 - p1) / (2 * sep));
        const d1sq = p1 + sw[i1], d1 = sqrt(d1sq > 0 ? d1sq : 0);
        let cell = sb[i1] * (1 - 0.1 * min(1, d1sq / 40) - 0.3 * sst(2.3, 5.2, d1));
        if (sfr[i1] > 0) {
          const u = S.sage[i1] / S.slife[i1];
          cell *= 1 - sfr[i1] * sst(0.45, 0.85, u) * exp(-d1sq / 7);
        }
        const ln = 0.5 * (sln[i1] + sln[i2]);
        Iv = ln + (cell - ln) * lane;
      }
      // --- the spots
      if (near) {
        for (let k = 0; k < NSPOT; k++) {
          const s = sp[k], dx = px - s.cx, dy = py - s.cy, d2 = dx * dx + dy * dy;
          if (d2 >= reach[k]) continue;
          const r = sqrt(d2), th = fatan2(dy, dx);
          let u = th / TAU;
          u -= floor(u);
          const eb = u * EDGEN, e0 = eb | 0, ef = eb - e0;
          const ruT = s.ruT[e0] + (s.ruT[e0 + 1] - s.ruT[e0]) * ef, rpT = s.rpT[e0] + (s.rpT[e0 + 1] - s.rpT[e0]) * ef;
          if (r > rpT + 3.1) continue;
          const wid = max(rpT - ruT, 0.5), rel = cl((r - ruT) / wid, 0, 1);
          if (k === 2) {
            // the pore has a bare rim: no filaments
            const core = 0.13 + 0.03 * fsin(dx * 0.7 + 1.1) * fsin(dy * 0.8 + 0.3);
            const ring = 0.5 + 0.12 * fsin(th * 3 + t * 0.021);
            const Ip = core + (ring - core) * sst(-0.4, 1.3, r - ruT);
            const wpp = 1 - sst(0.4, 2.1, r - rpT);
            Iv = Iv + (Ip - Iv) * wpp;
            continue;
          }
          const rk = cl((r * s.fs) | 0, 0, LPN - 1);
          let phi = th - twistAt(s, r);
          phi += warp(phi, r, tf);
          let uu = phi / TAU;
          uu -= floor(uu);
          const F = r > ruT - 4 ? filament(s, uu, rk) : 0;
          // flow streaks: inward in the inner half, outward in the outer half
          let mv = 0;
          if (r > ruT - 1) {
            const wi = 1 - sst(0.36, 0.56, rel), wo = sst(0.44, 0.64, rel);
            let a = 0, b = 0;
            if (wi > 0.002) a = streak(s.rIn, uu, rk, (wid * lutAt(SIN, rel) + tf) / LT + 0.3);
            if (wo > 0.002) b = streak(s.rOut, uu, rk, (wid * lutAt(SOUT, rel) - tf) / LT + 5.1);
            mv = ((a * wi + b * wo) / sqrt(wi * wi + wo * wo + 1e-6)) * flow;
          }
          const pen = 0.3 + 0.32 * rel * (1 + 0.17 * (1 - rel)) + (0.06 + 0.17 * rel) * F + 0.12 * mv * sst(0, 0.2, rel) * (1 - 0.5 * rel);
          // umbra
          let umb = 0.07 + 0.045 * sst(0, 1, r / ruT) + 0.018 * fsin(dx * 0.45 + 0.6 + tf * 0.03) * fsin(dy * 0.4 + 1.3 - tf * 0.025);
          if (k === 0 && brAmt > 0.01) {
            const bpu = dx * bu + dy * bv, bpv = -dx * bv + dy * bu - bo;
            const bn = 0.65 + 0.35 * fsin(bpu * 0.8 + 0.5 + tf * 0.02);
            umb += 0.13 * brAmt * exp((-bpv * bpv) / 2.6) * bn * sst(0, 3, ruT - r);
          }
          const wu = 1 - sst(-0.8, 0.8, r - ruT + 0.9 * F);
          const Is = pen + (umb - pen) * wu;
          const wp = 1 - sst(-0.5, 1.1, r - rpT - 1.9 * F);
          Iv = Iv + (Is - Iv) * wp;
        }
      }
      const av = A[p];
      let tot = Iv + (av / (1 + 0.7 * av)) * (1.2 - Iv) + B[p];
      tot = tot > 1.29 ? 1.29 : tot < 0 ? 0 : tot;
      const n = ((tot * 400) | 0) * 3;
      display.setPixel(x, y, lut[n] | 0, lut[n + 1] | 0, lut[n + 2] | 0);
    }
  }
}
