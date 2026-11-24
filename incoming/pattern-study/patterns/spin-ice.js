// ===== Patternflow pattern =====
// Title:   Spin Ice
// Family:  spinice
// Idea:    Every bond of a square lattice turned 45 degrees carries an arrow drawn as a comet, two in and two out at each node and coloured by the flux strand it belongs to, loops of arrows flip as a monopole pair runs round them, and thermal flips nucleate, wander and annihilate cyan-white and magenta-white sparks that leave warm strings of changed arrows behind.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: ice rules for the hydrogen bonds of water ice (John Bernal and Ralph Fowler, 1933), residual entropy of ice (Linus Pauling, 1935), the exact solution of the six-vertex model (Elliott Lieb, 1967), spin ice in Ho2Ti2O7 and Dy2Ti2O7 (Mark Harris and colleagues, 1997, from memory), artificial spin ice of nanomagnets (Ross Wang and colleagues, 2006, from memory), emergent magnetic monopoles in spin ice (Claudio Castelnovo, Roderich Moessner and Shivaji Sondhi, 2008); Metropolis flips (Nicholas Metropolis and colleagues, 1953) and a directed-loop worm move (Nikolay Prokof'ev and Boris Svistunov, 2001, from memory); pattern round 235
// Round:   235
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Heat=1..4, Bias=0..1, Loops=-1..1
//
// Knob 1: Hue. Turns the strand colours round the wheel: at 0 the flux strands run teal through blue to violet, at 0.25 magenta through red, at 0.5 orange through yellow, at 0.75 green through teal, 1 is 0 again; an arrow pointing up leans 0.065 of the wheel one way and a down arrow 0.065 the other, and the sparks stay cyan-white and magenta-white.
// Knob 2: Heat. The temperature of the single-arrow flips, which sets how many monopoles stand: at 1 T is 0.27 and about 6 of the 64 nodes are charged, at the opening 2 T is 0.37 and about 8, at 4 T is 0.73 and about 16, a quarter of the lattice, with the warm wake of their flips everywhere.
// Knob 3: Bias. A Zeeman field pointing up that sets how many arrows point up: 50 percent at 0, about 70 percent at 0.5 and 84 percent at 1, where the lattice turns violet, the comets all climb and the worms are rare (0.7 a second against 2.3); the field direction swings 30 degrees either side of up in 88 and 34 seconds.
// Knob 4: Loops. The longest loop a flux loop move may flip: 6 arrows at -1 (small squares, 6 worms a second), 21 at the opening 0.06, 64 at 1 where a loop can run right round the panel; a worm runs 14 arrows a second up to 12 arrows and 29 a second from 40.

const W = 64;
const H = 128;
const NV = 64;
const NB = 128;
const NCX = 8;
const NCY = 16;
const CELL = 8;
const exp = Math.exp;
const sqrt = Math.sqrt;
const sin = Math.sin;
const cos = Math.cos;
const min = Math.min;
const max = Math.max;
const pow = Math.pow;
const TAU = Math.PI * 2;
const R2 = Math.SQRT1_2;

const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- the lattice: a square lattice turned 45 degrees, 64 nodes and 128 bonds on a torus ----
// Node (i,j) sits on cell (i,j) of an 8 by 16 grid of 8 LED cells, only where i+j is even,
// at the cell centre. Bond 2n runs from node n down and right to its neighbour, bond 2n+1
// down and left. A +1 arrow points up: from the lower neighbour (its tail) to node n (its head).
// VB, VS, VO list for each node its four bonds, the sign of that bond that points into the
// node, and the node at the other end.
const NODEX = new Int16Array(NV);
const NODEY = new Int16Array(NV);
const TAILP = new Int16Array(NB);
const HEADP = new Int16Array(NB);
const BDX = new Int8Array(NB);
const VB = new Int16Array(NV * 4);
const VS = new Int8Array(NV * 4);
const VO = new Int16Array(NV * 4);
const VSL = new Int8Array(NV * 4);
(function topology() {
  const nid = (i, j) => {
    const jj = ((j % NCY) + NCY) % NCY;
    const ii = ((i % NCX) + NCX) % NCX;
    return jj * 4 + ((ii - (jj & 1)) >> 1);
  };
  for (let j = 0; j < NCY; j++)
    for (let k = 0; k < 4; k++) {
      const i = (j & 1) + 2 * k;
      const n = j * 4 + k;
      NODEX[n] = CELL * i + CELL / 2;
      NODEY[n] = CELL * j + CELL / 2;
      HEADP[2 * n] = n;
      TAILP[2 * n] = nid(i + 1, j + 1);
      BDX[2 * n] = 1;
      HEADP[2 * n + 1] = n;
      TAILP[2 * n + 1] = nid(i - 1, j + 1);
      BDX[2 * n + 1] = -1;
    }
  const fill = new Int8Array(NV);
  const put = (v, b, s, o, sl) => {
    const k = v * 4 + fill[v]++;
    VB[k] = b;
    VS[k] = s;
    VO[k] = o;
    VSL[k] = sl;
  };
  // slots 0 upper left, 1 upper right, 2 lower left, 3 lower right: opposite slots add to 3
  for (let b = 0; b < NB; b++) {
    const down = b & 1 ? 2 : 3;
    put(HEADP[b], b, 1, TAILP[b], down);
    put(TAILP[b], b, -1, HEADP[b], 3 - down);
  }
})();

function hsv(h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const m = i % 6;
  return m === 0 ? [v, t, p] : m === 1 ? [q, v, p] : m === 2 ? [p, v, t] : m === 3 ? [p, q, v] : m === 4 ? [t, p, v] : [v, p, q];
}

function setup(P) {
  const a = new Int8Array(NB);
  // straight diagonal lines running against each other: an ice state with no net flux
  for (let n = 0; n < NV; n++) {
    const i = (NODEX[n] - CELL / 2) / CELL;
    const j = (NODEY[n] - CELL / 2) / CELL;
    a[2 * n] = ((((i - j) % 8) + 8) % 8) % 4 === 0 ? 1 : -1;
    a[2 * n + 1] = (i + j) % 8 < 4 ? 1 : -1;
  }
  Object.assign(P, {
    t: 0,
    a,
    da: new Int8Array(a),
    df: new Float32Array(a),
    hf: new Float32Array(NB),
    ht: new Float32Array(NB),
    gp: new Float32Array(NV),
    gm: new Float32Array(NV),
    qd: new Int8Array(NV),
    par: new Int16Array(NB),
    tc: new Float32Array(NB * 3),
    cc: new Float32Array(NB * 3),
    lnId: new Int16Array(NB),
    lnN: new Int16Array(NB),
    mark: new Int32Array(NV),
    stamp: 0,
    path: new Int16Array(NB + 8),
    cand: new Int8Array(4),
    chain: new Int16Array(16),
    evB: [],
    evT: [],
    evA: [],
    acc1: 0,
    acc2: 0,
    acc3: 0,
    pre: false,
    warm: false,
    T: 0.3,
    w0: 0,
    w1: 0,
    cap: 16,
    u: 0.4,
    tm: 1,
    cs: 4,
    k1: 0,
    buf: new Float32Array(W * H * 3),
    kern: kernels(),
    nWorms: 0,
    nSingles: 0,
  });
}

// glow kernels for offsets -7..7 round a node that sits on a pixel corner
function kernels() {
  const core = new Float32Array(15 * 15);
  const halo = new Float32Array(15 * 15);
  for (let j = 0; j < 15; j++)
    for (let i = 0; i < 15; i++) {
      const dx = i - 7 + 0.5;
      const dy = j - 7 + 0.5;
      const r2 = dx * dx + dy * dy;
      core[j * 15 + i] = exp(-r2 / 1.5);
      halo[j * 15 + i] = exp(-r2 / 5) * 0.75 + exp(-r2 / 14) * 0.18;
    }
  return { core, halo };
}

const charge = (a, v) => {
  let n = -2;
  const o = v * 4;
  if (a[VB[o]] === VS[o]) n++;
  if (a[VB[o + 1]] === VS[o + 1]) n++;
  if (a[VB[o + 2]] === VS[o + 2]) n++;
  if (a[VB[o + 3]] === VS[o + 3]) n++;
  return n;
};

// ---- flux loops --------------------------------------------------------------
// At each node an arrow coming in is paired with the arrow going out on the opposite side, so
// a flux line runs straight where it can. Bonds chained that way are one strand and share a colour.
function find(par, i) {
  while (par[i] !== i) {
    par[i] = par[par[i]];
    i = par[i];
  }
  return i;
}

function decompose(P) {
  const par = P.par;
  const da = P.da;
  for (let b = 0; b < NB; b++) par[b] = b;
  const bondAt = [0, 0, 0, 0];
  const inAt = [false, false, false, false];
  const used = [false, false, false, false];
  const ins = [0, 0, 0, 0];
  const outs = [0, 0, 0, 0];
  const join = (x, y) => {
    const rx = find(par, x);
    const ry = find(par, y);
    if (rx < ry) par[ry] = rx;
    else if (ry < rx) par[rx] = ry;
  };
  for (let v = 0; v < NV; v++) {
    const o = v * 4;
    for (let k = 0; k < 4; k++) {
      const sl = VSL[o + k];
      bondAt[sl] = VB[o + k];
      inAt[sl] = da[VB[o + k]] === VS[o + k];
      used[sl] = false;
    }
    for (let s = 0; s < 4; s++) {
      if (inAt[s] && !used[s] && !inAt[3 - s] && !used[3 - s]) {
        join(bondAt[s], bondAt[3 - s]);
        used[s] = true;
        used[3 - s] = true;
      }
    }
    let ni = 0;
    let no = 0;
    for (let s = 0; s < 4; s++) {
      if (used[s]) continue;
      if (inAt[s]) ins[ni++] = bondAt[s];
      else outs[no++] = bondAt[s];
    }
    for (let i = 0; i < min(ni, no); i++) join(ins[i], outs[i]);
  }
  for (let b = 0; b < NB; b++) {
    const r = find(par, b);
    P.lnId[b] = r;
  }
}

// each strand has its own hue, saturation and brightness out of one cool band
function strandColour(r, out, o) {
  const u = (r * 0.6180339 + 0.27) % 1;
  const w = (r * 0.3819660 + 0.61) % 1;
  out[o] = 0.585 + 0.12 * u;
  out[o + 1] = 0.76 + 0.14 * w;
  out[o + 2] = 0.5 + 0.5 * ((u * 3.7 + w * 1.9) % 1);
}

// a thermostat: when fewer monopoles stand than the knob asks for, the lattice warms a little
function thermostat(P, d) {
  let c = 0;
  for (let v = 0; v < NV; v++) if (charge(P.a, v) !== 0) c++;
  P.cs += (c - P.cs) * (1 - exp(-d / 2.5));
  const want = 4 + 3 * P.u;
  P.tm = cl(P.tm + 0.2 * (want - P.cs) * d, 1, 3);
}

// ---- knobs -------------------------------------------------------------------
function readKnobs(P, input, t) {
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  P.k1 = k[0];
  const u = (cl(k[1], 1, 4) - 1) / 3;
  // two slow swings on frequencies that do not divide each other keep the temperature from settling
  const drift = 1 + 0.07 * sin(TAU * 0.0071 * t + 1.3) + 0.045 * sin(TAU * 0.0137 * t + 0.4);
  P.u = u;
  P.T = 0.265 * pow(2.75, u) * drift * P.tm;
  const k3 = cl(k[2], 0, 1);
  // the field turns round the up-right diagonal on two slow swings
  const phi = 1.571 + 0.38 * sin(TAU * 0.0113 * t + 0.9) + 0.17 * sin(TAU * 0.0291 * t + 2.1);
  const h = 0.28 * k3 * (0.9 + 0.1 * sin(TAU * 0.0187 * t + 0.2));
  P.w0 = h * R2 * (sin(phi) - cos(phi));
  P.w1 = h * R2 * (sin(phi) + cos(phi));
  const k4 = cl(k[3], -1, 1);
  P.cap = Math.round(6 * pow(10.67, (k4 + 1) / 2));
}

// ---- Monte Carlo -------------------------------------------------------------
function flipDisplay(P, b, amp) {
  P.da[b] = -P.da[b];
  P.hf[b] = amp;
  P.ht[b] = amp;
}

// one single-arrow Metropolis flip: energy is the squared node charge plus the field
function single(P) {
  const a = P.a;
  const b = (Math.random() * NB) | 0;
  const tail = a[b] === 1 ? TAILP[b] : HEADP[b];
  const head = a[b] === 1 ? HEADP[b] : TAILP[b];
  const w = b & 1 ? P.w1 : P.w0;
  const dE = 2 + 2 * (charge(a, tail) - charge(a, head)) + 2 * w * a[b];
  if (dE > 0 && Math.random() >= exp(-dE / P.T)) return;
  a[b] = -a[b];
  if (P.pre) P.da[b] = a[b];
  else flipDisplay(P, b, 1);
  P.nSingles++;
}

// a directed loop: follow out-arrows from a random node until the walk comes back to it
function loop(P) {
  const a = P.a;
  const v0 = (Math.random() * NV) | 0;
  const path = P.path;
  const cand = P.cand;
  const stamp = ++P.stamp;
  P.mark[v0] = stamp;
  let cur = v0;
  let n = 0;
  for (;;) {
    let c = 0;
    const o = cur * 4;
    for (let k = 0; k < 4; k++) if (a[VB[o + k]] === -VS[o + k]) cand[c++] = k;
    if (c === 0) return;
    const k = cand[(Math.random() * c) | 0];
    path[n++] = VB[o + k];
    const nx = VO[o + k];
    if (nx === v0) break;
    if (P.mark[nx] === stamp || n >= P.cap) return;
    P.mark[nx] = stamp;
    cur = nx;
  }
  flipPath(P, n);
}

function flipPath(P, n) {
  const a = P.a;
  let dE = 0;
  for (let i = 0; i < n; i++) {
    const b = P.path[i];
    dE += 2 * (b & 1 ? P.w1 : P.w0) * a[b];
  }
  if (dE > 0 && Math.random() >= exp(-dE / P.T)) return;
  for (let i = 0; i < n; i++) a[P.path[i]] = -a[P.path[i]];
  P.nWorms++;
  if (P.pre) {
    for (let i = 0; i < n; i++) P.da[P.path[i]] = a[P.path[i]];
    return;
  }
  // a little square flashes dimmer than a long loop
  const amp = 0.5 + 0.5 * min(1, (n - 4) / 16);
  const gap = n <= 12 ? 0.07 : 0.07 - 0.035 * min(1, (n - 12) / 28);
  for (let i = 0; i < n; i++) {
    P.evB.push(P.path[i]);
    P.evT.push(P.t + i * gap);
    P.evA.push(amp);
  }
}

// a straight diagonal line of arrows all pointing one way is a loop round the torus (16 bonds)
function string(P) {
  const a = P.a;
  const t = Math.random() < 0.5 ? 0 : 1;
  const chain = P.chain;
  let n = (Math.random() * NV) | 0;
  const s0 = a[2 * n + t];
  for (let k = 0; k < 16; k++) {
    const b = 2 * n + t;
    if (a[b] !== s0) return;
    chain[k] = b;
    n = TAILP[b];
  }
  // a +1 arrow runs from the lower node up to the upper one, against the chain
  for (let i = 0; i < 16; i++) P.path[i] = s0 === 1 ? chain[15 - i] : chain[i];
  flipPath(P, 16);
}

function advanceMC(P, d) {
  P.acc1 += 190 * d;
  while (P.acc1 >= 1) {
    P.acc1 -= 1;
    single(P);
  }
  // keep the worms few at a time so the panel stays readable
  const room = P.pre || P.evB.length < 40;
  P.acc2 += (10 + 40 * (1 - cl((P.cap - 6) / 12, 0, 1))) * d;
  while (P.acc2 >= 1) {
    P.acc2 -= 1;
    if (room) loop(P);
  }
  P.acc3 += 3 * d;
  while (P.acc3 >= 1) {
    P.acc3 -= 1;
    if (room) string(P);
  }
}

export function update(dt, input, P) {
  if (!P.a) setup(P);
  const d = cl(dt || 0, 0, 0.1);
  readKnobs(P, input, P.t);
  if (!P.warm) {
    P.warm = true;
    P.pre = true;
    // sixty seconds of Monte Carlo before the first frame, so every knob is in the picture at once
    for (let i = 0; i < 600; i++) {
      P.t += 0.1;
      readKnobs(P, input, P.t);
      advanceMC(P, 0.1);
      thermostat(P, 0.1);
    }
    P.pre = false;
    P.da.set(P.a);
    P.df.set(P.a);
    P.hf.fill(0);
    P.ht.fill(0);
    decompose(P);
    for (let b = 0; b < NB; b++) strandColour(P.lnId[b], P.cc, b * 3);
    P.evB.length = 0;
    P.evT.length = 0;
    P.evA.length = 0;
    for (let v = 0; v < NV; v++) {
      const q = charge(P.a, v);
      P.gp[v] = q > 0 ? 1 : 0;
      P.gm[v] = q < 0 ? 1 : 0;
    }
  }
  P.t += d;
  readKnobs(P, input, P.t);
  advanceMC(P, d);
  thermostat(P, d);
  // the display catches up with the worms a bond at a time
  for (let i = P.evB.length - 1; i >= 0; i--) {
    if (P.evT[i] <= P.t) {
      flipDisplay(P, P.evB[i], P.evA[i]);
      const last = P.evB.length - 1;
      P.evB[i] = P.evB[last];
      P.evT[i] = P.evT[last];
      P.evA[i] = P.evA[last];
      P.evB.pop();
      P.evT.pop();
      P.evA.pop();
    }
  }
  decompose(P);
  const kc = 1 - exp(-d / 0.22);
  for (let b = 0; b < NB; b++) {
    strandColour(P.lnId[b], P.tc, b * 3);
    for (let c = 0; c < 3; c++) P.cc[b * 3 + c] += (P.tc[b * 3 + c] - P.cc[b * 3 + c]) * kc;
  }
  const kf = 1 - exp(-d / 0.1);
  const kh = exp(-d / 0.3);
  const kt = exp(-d / 2.6);
  for (let b = 0; b < NB; b++) {
    P.df[b] += (P.da[b] - P.df[b]) * kf;
    P.hf[b] *= kh;
    P.ht[b] *= kt;
  }
  const kup = 1 - exp(-d / 0.05);
  const kdn = 1 - exp(-d / 0.32);
  for (let v = 0; v < NV; v++) {
    const q = charge(P.da, v);
    P.qd[v] = q;
    const tp = q > 0 ? 1 : 0;
    const tm = q < 0 ? 1 : 0;
    P.gp[v] += (tp - P.gp[v]) * (tp > P.gp[v] ? kup : kdn);
    P.gm[v] += (tm - P.gm[v]) * (tm > P.gm[v] ? kup : kdn);
  }
}

// ---- drawing -----------------------------------------------------------------
const LO = 0.08;
const prof = (p) => LO + (1 - LO) * pow(p, 1.7);

function add(buf, x, y, r, g, b) {
  x = ((x % W) + W) % W;
  y = ((y % H) + H) % H;
  const o = (y * W + x) * 3;
  buf[o] += r;
  buf[o + 1] += g;
  buf[o + 2] += b;
}

function put(buf, x, y, r, g, b) {
  x = ((x % W) + W) % W;
  y = ((y % H) + H) % H;
  const o = (y * W + x) * 3;
  if (r > buf[o]) buf[o] = r;
  if (g > buf[o + 1]) buf[o + 1] = g;
  if (b > buf[o + 2]) buf[o + 2] = b;
}

export function draw(display, P) {
  if (!P.a || !P.warm) return;
  const buf = P.buf;
  buf.fill(0);
  const HW = 1.2;
  for (let b = 0; b < NB; b++) {
    const n = b >> 1;
    const ax = NODEX[n];
    const ay = NODEY[n];
    // the lower end, whose arrow is +1 when it points up to node n
    const bx = ax + BDX[b] * CELL;
    const by = ay + CELL;
    const ux = (ax - bx) / (CELL * 1.41421356);
    const uy = (ay - by) / (CELL * 1.41421356);
    const len = CELL * 1.41421356;
    const wp = (P.df[b] + 1) * 0.5;
    const hf = P.hf[b];
    const ht = P.ht[b];
    const m = min(1, hf * 0.9);
    // an arrow pointing up leans to violet and bright, one pointing down to teal and dim
    // every bond breathes on a rate of its own, so no two moments of the lattice look alike
    const ph = TAU * ((b * 0.7548777 + 0.3) % 1) + TAU * (0.04 + 0.09 * ((b * 0.5698403) % 1)) * P.t;
    const col = hsv(P.k1 + P.cc[b * 3] + (wp - 0.5) * 0.13 + 0.03 * cos(ph), P.cc[b * 3 + 1], P.cc[b * 3 + 2] * (0.85 + 0.15 * wp) * (1 + 0.35 * sin(ph)));
    const cr = col[0] * (1 - m) + 1.0 * m;
    const cg = col[1] * (1 - m) + 0.8 * m;
    const cb = col[2] * (1 - m) + 0.42 * m;
    const lift = hf * 0.5 + ht * 0.2;
    const x0 = Math.floor(min(ax, bx) - 2);
    const x1 = Math.ceil(max(ax, bx) + 2);
    const y0 = Math.floor(min(ay, by) - 2);
    const y1 = Math.ceil(max(ay, by) + 2);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const qx = x + 0.5 - bx;
        const qy = y + 0.5 - by;
        let t = (qx * ux + qy * uy) / len;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = qx - ux * len * t;
        const ey = qy - uy * len * t;
        const cov = HW + 0.5 - sqrt(ex * ex + ey * ey);
        if (cov <= 0) continue;
        const I = (wp * prof(t) + (1 - wp) * prof(1 - t) + lift) * (cov > 1 ? 1 : cov) * 250;
        put(buf, x, y, cr * I, cg * I, cb * I);
      }
  }
  // a dim dot on every node
  for (let n = 0; n < NV; n++) {
    const cx = NODEX[n];
    const cy = NODEY[n];
    for (let j = -2; j < 2; j++)
      for (let i = -2; i < 2; i++) {
        const r = sqrt((i + 0.5) * (i + 0.5) + (j + 0.5) * (j + 0.5));
        const c = cl(2.3 - r, 0, 1) * 34;
        if (c > 0) add(buf, cx + i, cy + j, c, c, c * 1.1);
      }
  }
  // the monopoles
  const { core, halo } = P.kern;
  for (let v = 0; v < NV; v++) {
    const gp = P.gp[v];
    const gm = P.gm[v];
    if (gp < 0.02 && gm < 0.02) continue;
    const cx = NODEX[v];
    const cy = NODEY[v];
    for (let j = 0; j < 15; j++)
      for (let i = 0; i < 15; i++) {
        const c = core[j * 15 + i];
        const h = halo[j * 15 + i];
        let r = 0;
        let g = 0;
        let bl = 0;
        if (gp > 0.02) {
          r += gp * (h * 70 + c * 200);
          g += gp * (h * 215 + c * 235);
          bl += gp * (h * 255 + c * 255);
        }
        if (gm > 0.02) {
          r += gm * (h * 255 + c * 255);
          g += gm * (h * 60 + c * 190);
          bl += gm * (h * 225 + c * 250);
        }
        add(buf, cx + i - 7, cy + j - 7, r, g, bl);
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, min(255, buf[o]) | 0, min(255, buf[o + 1]) | 0, min(255, buf[o + 2]) | 0);
    }
}
