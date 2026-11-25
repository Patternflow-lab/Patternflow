// ===== Patternflow pattern =====
// Title:   Heterocyst Chains
// Family:  cyanochain
// Idea:    Dozens of chains of glowing green beads drift across dark water on a slow shear current, each bead a cell of a filamentous cyanobacterium; when the water is short of fixed nitrogen about one cell in ten swells into a pale, thick-walled heterocyst with a bright pole, the heterocysts keep a regular distance along the chain, the chains lengthen as cells divide mid-chain, a new heterocyst appears at the midpoint of any stretch that grows too long, and chains break at a heterocyst, leave the panel and are replaced by new ones drifting in.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: diffusion-driven patterning (Alan Turing, 1952, from memory), local self-activation with long-range lateral inhibition (Alfred Gierer and Hans Meinhardt, 1972, from memory), the heterocyst spacing of Anabaena set by fixed nitrogen that runs down the filament from the heterocysts, with new heterocysts at the midpoint of a long vegetative stretch (C. Peter Wolk, 1967, from memory), the diffusible inhibitor peptide PatS (Ho-Sung Yoon and James Golden, 1998, from memory), pattern round 227
// Round:   227
// ===============================
// @matrix 64x128
// @knobs Stain=0..1, Deficit=0..4, Growth=-1..1, Current=0..1
//
// Knob 1: Stain. The hue of the fluorescence, which goes round once and comes back at 1: teal-green at 0 (hue 0.46, the cells of a fed chain), blue-violet at 0.25, rose at 0.5, yellow at 0.75. The pole spots of a heterocyst sit half the wheel from the cells, so on teal they are rose, and the water takes a faint tint of the cell hue.
// Knob 2: Deficit. How short the water is of combined nitrogen, 0 to 4. A vegetative cell loses 0.017 of its nitrogen store a second at 0, 0.037 at 2 and 0.079 at 4, while a heterocyst fixes it and passes it down the chain to both sides, so the midpoint of a stretch between two heterocysts runs dry when the stretch is 24 cells long at 0, 16 at 2 and 11 at 4; the inhibitor reaches 9, 6 and 4 cells. Heterocysts come out about 15 cells apart at 0 (one or two to a chain), 12 at 2 and 8 at 4 (one cell in eight). Raising the knob starves the long stretches within 20 to 40 seconds and new heterocysts appear; lowering it undoes none, so the spacing widens as the chains grow and turn over, in about two minutes. Cells fade and yellow where their store is low, within seconds of the knob.
// Knob 3: Growth. How fast cells divide and how full the water is. A fed cell doubles in 105 s at -1, 45 s at 0 and 19 s at +1 (a starved one at a third of that), and the water holds 0.55, 1 and 1.45 times the opening's cells. At +1 chains lengthen as you watch, a heterocyst lets go of its chain about every 90 seconds and the panel is packed; at -1 a heterocyst lets go every 8 minutes and the field is thin, with short chains.
// Knob 4: Current. The speed of the water, its shear and the bend of the chains. The water carries a chain at 2.0 LEDs a second at 0, 3.5 at 0.5 and 5.0 at 1 (a chain in front moves 1.9 times as fast as one behind, and the speed breathes by a third), with the speed across the panel differing by 0.6 LED a second at 0 and 2.0 at 1. The bend waves run along the chains at 3 to 6 LEDs a second with a heading swing of 0.2 radian at 0 (1.2 LEDs sideways on a 40 LED wave) to 0.5 at 1 (3 LEDs).

// What the picture is. A world a little larger than the panel (MARG LEDs of water beyond each edge) holds chains. A chain is a list of
// cells in order along it. Its shape is one anchor cell with a position and a heading, a curvature that wanders and two bend waves that
// run along it; every other cell sits at the arclength its neighbours give it, so a new cell pushes the rest along and the chain grows from
// the middle. A chain has a depth, z: chains in front are brighter, plumper and carried faster, and cover the ones behind. The water runs
// down the panel on a diagonal whose heading wanders between 25 and 90 degrees below the x axis over minutes; most chains lie within 30
// degrees of it, a few across it.
//
// What a cell is. Four numbers: n, the store of fixed nitrogen (0 to 1); a, the activator (HetR in the real filament), which feeds itself
// while n is low; h, the inhibitor (PatS), made by committing cells and heterocysts and spread along the chain as exp(-distance / ell), the
// steady shape of diffusion with decay, which the cell's h follows with a lag of 1.5 s; and st, 0 for a vegetative cell, 1 for one that has
// committed and is maturing (4.5 to 7.5 s), 2 for a heterocyst. Per model step of 0.2 s:
//   n  : diffuses to both neighbours (D = 2 cells squared a second), and a vegetative cell loses q a second. A heterocyst holds n at 1.
//   a  : da/dt = xi s(n) i(h) (A0 + KA a^2 / (KS^2 + a^2)) - DA a, with s(n) = 1 / (1 + (n / 0.4)^4), i(h) = 1 / (1 + (h / 0.3)^2),
//        xi the cell's own gain, 0.92 to 1.08. The self-feeding term beats the decay only where xi s i is above DA / KA. At a = 0.5 the cell commits.
//   h  : source 0.8 (a / 0.5)^2 in a cell that is rising, 1 in a committing one, 0.65 in a heterocyst; a cell feels the others, not itself.
// q and ell come from Deficit. A committed cell is never undone. A chain with no heterocyst starves all along at once and settles at the
// inhibitor's spacing; after that the stretch that grows longest starves at its midpoint first, and the next heterocyst comes there.
//
// Growth and loss. A vegetative cell divides at the knob's lambda times (0.35 + 0.65 n / 0.8), so cells near a heterocyst divide more, and
// division fades out as the world fills to its cap. The daughter appears beside its parent, either side, and both pulse. A heterocyst lets
// go of its chain at 0.3 lambda a second (one link either side) when the chain has 14 cells or more, a chain of more than 46 to 64 cells
// breaks near its middle, and the pieces drift apart. A chain leaves for good once it is beyond the world's edge and downstream. New chains
// of 10 to 24 cells come upstream at steady intervals, at the rate that holds the cap given how fast the water crosses the world, each at
// the best of 16 tries for even cover (see spawn), so the count neither dies out nor piles up.
const W = 64, H = 128, NPX = W * H;
const { floor, ceil, sqrt, exp, log, sin, cos, pow, abs, min, max, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const sq = (v) => v * v;

const SEED = 227413;
const MARG = 22;                       // LEDs of water beyond each edge that are simulated
const BX0 = -MARG, BX1 = W + MARG, BY0 = -MARG, BY1 = H + MARG;
const AREA = (BX1 - BX0) * (BY1 - BY0);
const DT = 0.2;                        // model step, s
const PREROLL = 240;                   // s of model time run in the first update
const LEN = 3.0, GAP = 1.1;            // a vegetative cell is LEN long; cells stand LEN + GAP apart
const HET = 0.7;                      // a heterocyst is this much longer
const NMAXC = 64;                      // longest chain, cells; scratch arrays are sized from it
const DN = 2.0, NTH = 0.4, KH = 0.3, AC = 0.5;
const A0 = 0.025, KA = 0.5, KS2 = 0.0625, DA = 0.35;
const TAUH = 1.5;
const RHO0 = 0.058;                    // cells per LED squared of world at Growth 0
const LN2 = 0.6931;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = floor(x), yi = floor(y);
  const u = smooth(x - xi), v = smooth(y - yi);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
function hsv(h, s, v, o, k) {
  for (let c = 0; c < 3; c++) {
    const n = (5 - 2 * c + 6 * (h - floor(h))) % 6;
    o[k + c] = v * (1 - s * max(0, min(n, 4 - n, 1)));
  }
}

export function setup(P) {
  P.rand = rng(SEED);
  P.ready = false;
  P.T = 0;
  P.acc = 0;
  P.chains = [];
  P.ncell = 0;
  P.sacc = 0;
  P.sgate = 1;
  P.psi = 1.0;
  P.par = {};
  P.pal = new Float32Array(24);
  const f = (n) => new Float32Array(n);
  P.px = f(NMAXC + 8); P.py = f(NMAXC + 8); P.pt = f(NMAXC + 8);
  P.nn = f(NMAXC + 8); P.f1 = f(NMAXC + 8); P.f2 = f(NMAXC + 8); P.src = f(NMAXC + 8);
  P.R = f(NPX); P.G = f(NPX); P.B = f(NPX);
}

function gauss(P) {
  const u = 1 - P.rand(), v = P.rand();
  return sqrt(-2 * log(u)) * cos(TAU * v);
}

// The water: its direction wanders, its speed breathes, with periods that do not divide each other.
function flowDir(T) {
  return 1.0 + 0.34 * sin(0.0097 * T + 0.7) + 0.2 * sin(0.0043 * T + 2.1) + 0.06 * sin(0.031 * T);
}
function flowSpeed(T) {
  return 1 + 0.22 * sin(0.021 * T + 1) + 0.12 * sin(0.0067 * T);
}

function readKnobs(P, k) {
  const q = P.par;
  const def = cl(k[1] / 4, 0, 1);
  const g = cl(k[2], -1, 1);
  const cur = cl(k[3], 0, 1);
  q.hue = 0.46 + cl(k[0], 0, 1);
  q.Lc = 24 * pow(11 / 24, def);
  q.q = 9.6 / (q.Lc * q.Lc);
  q.ell = 0.38 * q.Lc;
  q.rho = exp(-1 / q.ell);
  q.lam = (LN2 / 45) * exp(0.85 * g);
  q.cap = RHO0 * AREA * (1 + 0.45 * g);
  q.brk = 0.3 * q.lam;
  q.U = 2.0 + 3.0 * cur;
  q.gam = 0.004 + 0.010 * cur;
  q.bend = 0.2 + 0.3 * cur;
}

function newCell(P, n0) {
  const r = P.rand;
  return {
    st: 0, a: 0.04 + 0.04 * r(), h: 0, n: n0, xi: 0.92 + 0.16 * r(),
    prog: 0, tm: 0, tmat: 4.5 + 3 * r(), age: 5 + 20 * r(),
    m: 0, pl: 0, s: 0, sT: 0, sz: 1, nv: n0,
  };
}

function lenOf(c) {
  return LEN + HET * (c.st === 2 ? 1 : c.st === 1 ? 0.5 * c.prog : 0);
}
function setTargets(ch) {
  const cells = ch.cells;
  let s = 0;
  cells[0].sT = 0;
  for (let i = 1; i < cells.length; i++) {
    s += 0.5 * (lenOf(cells[i - 1]) + lenOf(cells[i])) + GAP;
    cells[i].sT = s;
  }
}

function newChain(P, n, x, y, dl, z) {
  const r = P.rand;
  const cells = [];
  const n0 = 0.7 + 0.25 * r();
  for (let i = 0; i < n; i++) cells.push(newCell(P, n0 + 0.05 * (r() - 0.5)));
  const L1 = 36 + 28 * r(), L2 = 17 + 10 * r();
  const ch = {
    cells, m: n >> 1, ax: x, ay: y, dl, de: 0, dw: 0, kr: 0, kap: 0.005 * gauss(P), z,
    vz: 0.7 + 0.6 * z, vs: 0,
    k1: TAU / L1, o1: (TAU / L1) * (3 + 3 * r()) * (r() < 0.5 ? -1 : 1), p1: TAU * r(), a1: 0.7 + 0.6 * r(),
    k2: TAU / L2, o2: (TAU / L2) * (2 + 2.5 * r()) * (r() < 0.5 ? -1 : 1), p2: TAU * r(), a2: 0.3 + 0.3 * r(),
    mp: TAU * r(), w0: 0, th: 0, nmax: 46 + floor(18 * r()),
  };
  setTargets(ch);
  for (const c of cells) c.s = c.sT;
  ch.th = P.psi + dl;
  return ch;
}

function pickAngle(P) {
  const r = P.rand();
  if (r < 0.15) return (P.rand() < 0.5 ? -1 : 1) * (0.8 + 0.5 * P.rand());
  return 0.32 * gauss(P);
}

// Where a new chain goes. Several tries, each with its own point, heading, depth and length. For each, every chain already there is moved
// along with the water to the moment the new one would arrive (so chains still on their way in count), and the try whose beads end up
// furthest from all of them wins. That fills the water evenly instead of in clumps. A chain placed once the water moves starts upstream
// of its point, outside the world. It drifts to the point from there.
function samples(c, out, vz) {
  const hl = c.cells.length * (LEN + GAP) * 0.5, ca = cos(c.th), sa = sin(c.th);
  for (let s = -hl; s <= hl; s += 7) out.push(c.ax + ca * s, c.ay + sa * s, vz);
}
function spawn(P, initial) {
  const r = P.rand, ex = cos(P.psi), ey = sin(P.psi);
  const U = P.par.U * flowSpeed(P.T);
  const have = [];
  for (let j = 0; j < P.chains.length; j++) samples(P.chains[j], have, P.chains[j].vz);
  let best = null, bs = -1;
  for (let t = 0; t < 16; t++) {
    const n = initial ? 8 + floor(30 * pow(r(), 1.5)) : 10 + floor(15 * r());
    const dl = pickAngle(P), z = r(), vz = 0.7 + 0.6 * z;
    const qx = BX0 + (BX1 - BX0) * r(), qy = BY0 + (BY1 - BY0) * r();
    let run = 0;
    if (!initial) {
      let tx = 1e9, ty = 1e9;
      if (ex > 1e-3) tx = (qx - BX0) / ex; else if (ex < -1e-3) tx = (BX1 - qx) / -ex;
      if (ey > 1e-3) ty = (qy - BY0) / ey; else if (ey < -1e-3) ty = (BY1 - qy) / -ey;
      run = min(tx, ty) + n * 2.2 + 3;
    }
    const tau = run / (U * vz);
    const own = [];
    samples({ cells: { length: n }, th: P.psi + dl, ax: qx, ay: qy }, own, 1);
    let sc = 0;
    for (let a = 0; a < own.length; a += 3) {
      let dm = 144;
      for (let k = 0; k < have.length; k += 3) {
        const mv = U * have[k + 2] * tau;
        const d = sq(own[a] - have[k] - ex * mv) + sq(own[a + 1] - have[k + 1] - ey * mv);
        if (d < dm) dm = d;
      }
      const out = own[a] < -6 || own[a] > W + 6 || own[a + 1] < -6 || own[a + 1] > H + 6;
      sc += sqrt(dm) * (out ? 0.4 : 1);
    }
    if (sc / own.length > bs) { bs = sc / own.length; best = { n, dl, z, x: qx - ex * run, y: qy - ey * run }; }
  }
  P.chains.push(newChain(P, best.n, best.x, best.y, best.dl, best.z));
  P.ncell += best.n;
}

// The shape of a chain: the angle at arclength sr from the anchor, at time T.
function wv(ch, sr, T) {
  return ch.a1 * sin(ch.k1 * sr - ch.o1 * T + ch.p1) + ch.a2 * sin(ch.k2 * sr - ch.o2 * T + ch.p2);
}
function angAt(P, ch, sr, T) {
  return ch.th + ch.kap * sr + P.par.bend * (wv(ch, sr, T) - ch.w0);
}

// Cell positions into the scratch arrays P.px, P.py, P.pt.
function layout(P, ch) {
  const cells = ch.cells, n = cells.length, T = P.T, m = ch.m;
  const px = P.px, py = P.py, pt = P.pt;
  const sm = cells[m].s;
  ch.w0 = wv(ch, 0, T);
  px[m] = ch.ax; py[m] = ch.ay; pt[m] = ch.th;
  for (let i = m + 1; i < n; i++) {
    const ds = cells[i].s - cells[i - 1].s;
    const a = angAt(P, ch, 0.5 * (cells[i].s + cells[i - 1].s) - sm, T);
    px[i] = px[i - 1] + ds * cos(a);
    py[i] = py[i - 1] + ds * sin(a);
    pt[i] = angAt(P, ch, cells[i].s - sm, T);
  }
  for (let i = m - 1; i >= 0; i--) {
    const ds = cells[i + 1].s - cells[i].s;
    const a = angAt(P, ch, 0.5 * (cells[i].s + cells[i + 1].s) - sm, T);
    px[i] = px[i + 1] - ds * cos(a);
    py[i] = py[i + 1] - ds * sin(a);
    pt[i] = angAt(P, ch, cells[i].s - sm, T);
  }
}

// Break a chain between cells k-1 and k. Both pieces keep the curve they had, each anchored on its own middle cell.
function cutChain(P, ch, k) {
  layout(P, ch);
  const cells = ch.cells, T = P.T, sm = cells[ch.m].s, n = cells.length;
  const hm = (k - 1) >> 1, tm = k + ((n - k) >> 1);
  const dh = cells[hm].s - sm, dt = cells[tm].s - sm;
  const thh = angAt(P, ch, dh, T), tht = angAt(P, ch, dt, T);
  const hx = P.px[hm], hy = P.py[hm], tx = P.px[tm], ty = P.py[tm];
  const tail = cells.splice(k);
  const kick = gauss(P);
  const nc = {
    cells: tail, m: tm - k, ax: tx, ay: ty, th: tht, dl: ch.dl + tht - ch.th, de: ch.de, dw: ch.dw + 0.01 * kick, kr: ch.kr,
    kap: ch.kap, z: ch.z, vz: ch.vz, vs: 0.55, nmax: 46 + floor(18 * P.rand()),
    k1: ch.k1, o1: ch.o1, p1: ch.p1 + ch.k1 * dt, a1: ch.a1,
    k2: ch.k2, o2: ch.o2, p2: ch.p2 + ch.k2 * dt, a2: ch.a2, mp: ch.mp, w0: 0,
  };
  ch.dl += thh - ch.th; ch.th = thh;
  ch.p1 += ch.k1 * dh; ch.p2 += ch.k2 * dh;
  ch.ax = hx; ch.ay = hy; ch.m = hm; ch.vs = -0.55; ch.dw -= 0.01 * kick;
  rebase(ch);
  rebase(nc);
  P.chains.push(nc);
}
function rebase(ch) {
  const cells = ch.cells, o = cells[0].s;
  for (let i = 0; i < cells.length; i++) cells[i].s -= o;
  setTargets(ch);
}

// One model step of one chain: nitrogen, inhibitor, activator, commitment, division and breaks.
function stepChain(P, ch) {
  const q = P.par, cells = ch.cells, n = cells.length, rand = P.rand;
  const nn = P.nn, f1 = P.f1, f2 = P.f2, src = P.src;
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    if (c.st === 2) { nn[i] = 1; continue; }
    let lap = 0;
    if (i > 0) lap += cells[i - 1].n - c.n;
    if (i < n - 1) lap += cells[i + 1].n - c.n;
    const v = c.n + DT * (DN * lap - q.q);
    nn[i] = v < 0 ? 0 : v;
  }
  for (let i = 0; i < n; i++) cells[i].n = nn[i];
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    if (c.st === 2) src[i] = 0.65;
    else if (c.st === 1) src[i] = 1;
    else { const r = c.a / AC; src[i] = r >= 1 ? 0.8 : 0.8 * r * r; }
  }
  const rho = q.rho;
  let acc = 0;
  for (let i = 0; i < n; i++) { acc = src[i] + rho * acc; f1[i] = acc; }
  acc = 0;
  for (let i = n - 1; i >= 0; i--) { acc = src[i] + rho * acc; f2[i] = acc; }
  const kH = 1 - exp(-DT / TAUH);
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    const hss = f1[i] + f2[i] - 2 * src[i];
    c.h += (hss - c.h) * kH;
    c.age += DT;
    if (c.st === 0) {
      const x = c.n / NTH, xx = x * x;
      const gain = (c.xi / (1 + xx * xx)) / (1 + sq(c.h / KH));
      const aa = c.a * c.a;
      c.a += DT * (gain * (A0 + (KA * aa) / (KS2 + aa)) - DA * c.a);
      if (c.a >= AC) { c.st = 1; c.tm = 0; c.prog = 0; }
    } else if (c.st === 1) {
      c.tm += DT;
      c.prog = c.tm / c.tmat;
      if (c.tm >= c.tmat) { c.st = 2; c.prog = 1; c.n = 1; }
    }
  }
  // division
  const room = cl((q.cap - P.ncell) / (0.25 * q.cap), 0, 1);
  if (room > 0) {
    for (let i = n - 1; i >= 0; i--) {
      if (cells.length >= NMAXC - 2) break;
      const c = cells[i];
      if (c.st !== 0 || c.age < 2.5) continue;
      const g = 0.35 + 0.65 * min(1, c.n / 0.8);
      if (rand() < q.lam * g * room * DT) {
        const d = newCell(P, c.n);
        d.h = c.h; d.age = 0; d.pl = 1; d.sz = 0.4; d.s = c.s;
        c.age = 0; c.pl = 1;
        const idx = rand() < 0.5 ? i : i + 1;
        cells.splice(idx, 0, d);
        if (idx <= ch.m) ch.m++;
        P.ncell++;
      }
    }
  }
  // breaks
  const n2 = cells.length;
  let cut = -1;
  if (n2 >= 14) {
    for (let i = 0; i < n2; i++) {
      if (cells[i].st === 2 && rand() < q.brk * DT) {
        const k = rand() < 0.5 ? i : i + 1;
        if (k >= 6 && n2 - k >= 6) { cut = k; break; }
      }
    }
    if (cut < 0 && n2 > ch.nmax) {
      const mid = n2 >> 1;
      cut = mid;
      for (let d = 0; d < 7; d++) {
        const a = mid + d, b = mid - d;
        if (a < n2 - 6 && cells[a].st === 2) { cut = a; break; }
        if (b >= 6 && cells[b].st === 2) { cut = b + 1; break; }
      }
    }
  }
  if (cut >= 0) { setTargets(ch); cutChain(P, ch, cut); }
  else setTargets(ch);
}

function model(P) {
  const q = P.par;
  const chains = P.chains;
  const n0 = chains.length; // chains that a break adds are first stepped next time
  for (let j = 0; j < n0; j++) stepChain(P, chains[j]);
  // chains that have left
  const ex = cos(P.psi), ey = sin(P.psi);
  let tot = 0;
  for (let j = chains.length - 1; j >= 0; j--) {
    const c = chains[j];
    const hl = c.cells.length * 2.1 + 4;
    const out = c.ax < BX0 - hl || c.ax > BX1 + hl || c.ay < BY0 - hl || c.ay > BY1 + hl;
    if (out && ex * (c.ax - W / 2) + ey * (c.ay - H / 2) > 0) chains.splice(j, 1);
    else tot += c.cells.length;
  }
  P.ncell = tot;
  // New chains come at a steady pace, the rate that holds cap cells in a world the water crosses in lw / U seconds.
  const lw = abs(ex) * (BX1 - BX0) + abs(ey) * (BY1 - BY0) + 30;
  const nt = q.cap / max(10, P.ncell / max(1, chains.length));
  const fb = P.ncell < 0.85 * q.cap ? 1.6 : P.ncell > 1.05 * q.cap ? 0.2 : 1;
  P.sacc += ((nt * q.U * flowSpeed(P.T)) / lw) * fb * DT;
  if (P.sacc >= P.sgate) { P.sacc -= P.sgate; P.sgate = 0.75 + 0.5 * P.rand(); spawn(P, false); }
}

// Frame-rate motion: the water carries each chain's anchor, the chain's heading and curvature wander.
function move(P, dt) {
  const q = P.par, T = P.T;
  const psi = flowDir(T);
  P.psi = psi;
  const ex = cos(psi), ey = sin(psi), nx = -ey, ny = ex;
  const U = q.U * flowSpeed(T);
  const sa = 0.01 * sqrt((2 * dt) / 25), sb = 0.0002 * sqrt((2 * dt) / 30);
  const chains = P.chains;
  for (let j = 0; j < chains.length; j++) {
    const c = chains[j];
    // heading and curvature are driven through their rates, so that they are smooth from frame to frame
    c.dw += (-c.dw * dt) / 25 + sa * gauss(P);
    c.kr += (-c.kr * dt) / 30 + sb * gauss(P);
    c.de += (c.dw - c.de / 80) * dt;
    c.kap += (c.kr - c.kap / 90) * dt;
    c.th = psi + c.dl + c.de;
    const dn = nx * (c.ax - W / 2) + ny * (c.ay - H / 2);
    const al = (U + q.gam * dn) * c.vz;
    const cr = 0.28 * U * sin(0.034 * (ex * c.ax + ey * c.ay) + 0.017 * T + c.mp) * c.vz;
    c.ax += (ex * al + nx * cr + cos(c.th) * c.vs) * dt;
    c.ay += (ey * al + ny * cr + sin(c.th) * c.vs) * dt;
    c.vs *= exp(-dt / 25);
  }
}

// What the eye sees of each cell eases toward what the model says.
function ease(P, dt) {
  const kS = 1 - exp(-dt / 0.35), kz = 1 - exp(-dt / 0.4), kp = exp(-dt / 0.75), kn = 1 - exp(-dt / 0.6), km = 1 - exp(-dt / 1.2);
  const chains = P.chains;
  for (let j = 0; j < chains.length; j++) {
    const cells = chains[j].cells;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      c.s += (c.sT - c.s) * kS;
      c.sz += (1 - c.sz) * kz;
      c.pl *= kp;
      const mT = c.st === 2 ? 1 : c.st === 1 ? 0.55 * c.prog : 0;
      c.m += (mT - c.m) * km;
      c.nv += (c.n - c.nv) * kn;
    }
  }
}

function preroll(P) {
  P.psi = flowDir(0);
  readKnobs(P, P.knobs);
  const q = P.par;
  // the first chains, spread over the whole world
  while (P.ncell < 0.9 * q.cap) spawn(P, true);
  for (let i = 0; i < PREROLL / DT; i++) {
    move(P, DT);
    model(P);
    ease(P, DT);
    P.T += DT;
  }
  for (const ch of P.chains) for (const c of ch.cells) { c.s = c.sT; c.sz = 1; c.pl = 0; c.m = c.st === 2 ? 1 : 0; c.nv = c.n; }
}

export function update(dt, input, P) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  P.knobs = k;
  readKnobs(P, k);
  if (!P.ready) { P.ready = true; preroll(P); }
  P.acc += dt;
  let steps = 0;
  while (P.acc >= DT && steps < 6) { P.acc -= DT; model(P); steps++; }
  if (P.acc >= DT) P.acc = 0;
  move(P, dt);
  ease(P, dt);
  P.T += dt;
}

// Colour, all from the hue h of the stain: fed cells, starved cells, the pale heterocyst wall, its pole spots, the water.
function palette(P) {
  const h = P.par.hue, o = P.pal;
  hsv(h, 0.86, 1.0, o, 0);          // fed vegetative cell
  hsv(h - 0.04, 0.85, 0.9, o, 3);   // starved vegetative cell: yellower and dimmer
  hsv(h - 0.02, 0.42, 1.0, o, 6);   // heterocyst wall
  hsv(h + 0.5, 0.8, 1.0, o, 9);     // pole spot
  hsv(h + 0.03, 0.9, 1.0, o, 12);   // water
}

function paintWater(P) {
  const { R, G, B, pal } = P;
  const t = P.T;
  const wr = pal[12], wg = pal[13], wb = pal[14];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = 0.62 * vnoise(x / 26 + t * 0.011, y / 30 - t * 0.007) + 0.38 * vnoise(x / 11 - t * 0.013 + 9, y / 13 + t * 0.009 + 4);
      const v = 0.026 + 0.05 * n * n;
      const p = y * W + x;
      R[p] = wr * v; G[p] = wg * v; B[p] = wb * v;
    }
  }
}

function paintCell(P, c, x, y, cs, sn, z, lft, rgt) {
  const { R, G, B, pal } = P;
  const m = c.m, sz = c.sz;
  const gs = 0.45 + 0.55 * sz;
  const a = (LEN * 0.5 + 0.5 * HET * m) * (0.95 + 0.1 * z) * gs, b = (1.4 + 0.45 * m) * (0.84 + 0.32 * z) * gs;
  const halo = 4.2; // LEDs of glow beyond a cell
  const rr = (a > b ? a : b) + halo;
  if (x < -rr || x > W + rr || y < -rr || y > H + rr) return;
  const bz = 0.5 + 0.5 * z;
  const nf = smooth(c.nv / 0.85);
  const pulse = 1 + 0.9 * c.pl;
  // vegetative colour and body brightness
  const cm = c.st === 1 ? c.prog : 0;
  const vb = bz * (0.78 + 0.22 * nf) * pulse * (1 + 0.5 * cm);
  const vr = mix(pal[3], pal[0], nf), vg = mix(pal[4], pal[1], nf), vbl = mix(pal[5], pal[2], nf);
  // the heterocyst is dimmed less with depth, a dim pink goes brown on the panel
  const hz = 0.72 + 0.28 * z;
  const hr = pal[6] * hz, hg = pal[7] * hz, hb = pal[8] * hz;
  const pr = pal[9] * hz, pg = pal[10] * hz, pb = pal[11] * hz;
  const ha = (0.04 + 0.35 * c.pl + 0.12 * m + 0.9 * cm * cm) * bz;
  const pw = smooth((m - 0.45) / 0.55);
  const x0 = max(0, floor(x - rr)), x1 = min(W - 1, ceil(x + rr));
  const y0 = max(0, floor(y - rr)), y1 = min(H - 1, ceil(y + rr));
  const ab = a - b;
  for (let py = y0; py <= y1; py++) {
    const dy = py + 0.5 - y;
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x;
      const u = dx * cs + dy * sn, v = dy * cs - dx * sn;
      const qx = (u < 0 ? -u : u) - ab;
      const ux = qx > 0 ? qx : 0;
      const sd = sqrt(ux * ux + v * v) - b;
      if (sd > halo) continue;
      const p = py * W + px;
      let al = 0.5 - sd / 1.05;
      al = al < 0 ? 0 : al > 1 ? 1 : al;
      if (al > 0) {
        const depth = cl(-sd / b, 0, 1);
        const shv = 0.62 + 0.38 * pow(depth, 0.8);
        let cr = vr * vb * shv, cg = vg * vb * shv, cb = vbl * vb * shv;
        if (m > 0.01) {
          const ring = exp(-sq((depth - 0.2) / 0.22));
          const shh = 0.3 + 0.9 * ring;
          let sr = hr * shh, sg = hg * shh, sbl = hb * shh;
          // pole spots, only where a neighbour touches
          for (let e = -1; e <= 1; e += 2) {
            if (e > 0 ? !rgt : !lft) continue;
            const du = u - e * (a - 0.65), w = pw * exp(-(du * du + v * v) / 1.445);
            sr += pr * w; sg += pg * w; sbl += pb * w;
          }
          cr = mix(cr, sr, m); cg = mix(cg, sg, m); cb = mix(cb, sbl, m);
        }
        R[p] = R[p] * (1 - al) + cr * al;
        G[p] = G[p] * (1 - al) + cg * al;
        B[p] = B[p] * (1 - al) + cb * al;
      }
      if (sd > -0.3) {
        const hh = ha * exp(-(sd > 0 ? sd : 0) * 1.05) * (1 - al);
        // a committing cell glows pale, the rest in the cell's own colour
        const k = cm * cm;
        R[p] += hh * mix(vr, pal[6], k);
        G[p] += hh * mix(vg, pal[7], k);
        B[p] += hh * mix(vbl, pal[8], k);
      }
    }
  }
}

export function draw(display, P) {
  if (!P.ready) return;
  palette(P);
  paintWater(P);
  const chains = P.chains.slice().sort((a, b) => a.z - b.z);
  for (let j = 0; j < chains.length; j++) {
    const ch = chains[j];
    const hl = ch.cells.length * 2.1 + 6;
    if (ch.ax < -hl || ch.ax > W + hl || ch.ay < -hl || ch.ay > H + hl) continue;
    layout(P, ch);
    const cells = ch.cells, n = cells.length;
    for (let i = 0; i < n; i++) {
      const th = P.pt[i];
      paintCell(P, cells[i], P.px[i], P.py[i], cos(th), sin(th), ch.z, i > 0, i < n - 1);
    }
  }
  const { R, G, B } = P;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      display.setPixel(x, y, 255 * cl(R[p], 0, 1), 255 * cl(G[p], 0, 1), 255 * cl(B[p], 0, 1));
    }
  }
}
