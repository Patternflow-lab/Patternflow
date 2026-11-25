// ===== Patternflow pattern =====
// Title:   Parton Shower
// Family:  partonshower
// Idea:    A quark and an antiquark leave a hard collision at the bottom of the panel and each radiates gluons that split into gluons or into quark pairs as the evolution climbs the panel, every straight quark line and every coiled gluon line carrying its QCD colour (red, green or blue for a quark, cyan, magenta or yellow for an antiquark, a colour strand and an anticolour strand twisted together for a gluon) so that colour is conserved at every vertex, until the last partons burst into fans of short bright hadron dashes in the colours of the strings they ended.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Feynman diagram with straight quark lines and coiled gluon lines (Richard Feynman, 1948), the Altarelli-Parisi splitting functions behind the parton shower (Guido Altarelli and Giorgio Parisi, 1977), the Sudakov form factor that puts a parton's first branching where it falls (Vladimir Sudakov, 1956) and the colour-flow double line of the gluon (Gerard 't Hooft, 1974), all from memory; the tree rebuilt every frame from one random number per parton by inverting the cumulative splitting probability so that it follows the knobs, the leaves laid out in colour-string order with each gap taken from an opening angle, the twin-strand gluon rope and the hadron dashes paired in colour and anticolour are original, pattern round 252
// Round:   254
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Energy=0..4, Coupling=-1..1, Spread=-1..1
//
// Knob 1: Hue. Turns the six colour-flow hues round the wheel together; it opens on rose-red, green and blue quarks with their cyan-teal, violet and amber anticolours.
// Knob 2: Energy. 0 to 4, opening at 2. How far the evolution runs before the partons hadronise: at 0 a jet is a quark with a gluon or two, about five lines in the whole event, at 2 about thirteen, at 4 a thicket of twenty-odd lines.
// Knob 3: Coupling. -1 to 1, opening at 0. The strong coupling: at -1 splittings are rare and late, about eight lines with long clean quark lines between them, at 1 gluons split at once and again and the event has eighteen lines and more.
// Knob 4: Spread. -1 to 1, opening at about 0.06. The opening angle of the splittings: at -1 the shower is a plume about 28 LED wide with its lines close together, at 1 it fans out over the 52 LED the panel allows.

// An event is a shower tree: two partons leave the hard vertex at the bottom, each parton branches once at a height set
// by the evolution, and the branches are straight lines from vertex to vertex, quarks plain and gluons twisted ropes of
// colour and anticolour. The tree is a pure function of the event's seed and the knobs, so turning a knob reshapes the
// events already on the panel. Two or three events overlap: the newest climbs while the one before it fades from the
// bottom up and leaves its hadron fans to the last.
const W = 64, H = 128, NPX = W * H;
const { floor, min, max, abs, sqrt, exp, log, sin, cos, atan2, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const rnd = () => Math.random();

const MAXN = 26;               // most partons in one event, the two first included
const DT = 0.02;               // step of the hazard integral, in evolution units
const DELTA = 0.3;             // a branch is at least this long in evolution
const QF = 1.0, GG = 1.5, QQ = 1.0;   // splitting rates: q -> q g, g -> g g (times the log), g -> q qbar
const LCAP = 1.1;             // the log in the splitting rate is held at this, so branchings come all the way up the panel and not only at its start
const PSAME = 0.34;            // chance that a new colour repeats the old one, which makes a colour and its own anticolour in one gluon
const YPOW = 0.85;             // height is the evolution to this power, which spreads the early branchings a little up the panel
const KAPPA = 0.55;            // how fast the opening angle shrinks with evolution
const FUNNEL = 0.5;            // the width of the jets at the hard vertex, against their width at the top
const SMIN = 2.9;              // the least gap between two neighbouring leaves, in LED
const FAN = 2.3;               // opening of a hadron fan, in radians
const SAT = 0.92;
const HUE0 = 0.965;            // where the colour wheel opens: red leans to rose
const GLOW = 0.42;

const hv = [0, 0, 0];
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// a number in [0,1) from an event seed, a parton id and a slot: every random choice of a parton is its own, so a
// tree is a pure function of the seed and the knobs and can be rebuilt every time a knob moves
function hr(seed, id, k) {
  let h = Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul((id | 0) + 0x7f4a7c15, 0x85ebca6b) ^ Math.imul(k + 0x165667b1, 0xc2b2ae35);
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function newNode() {
  return { par: -1, id: 0, type: 0, col: -1, acol: -1, E: 1, ts: 0, te: 0, l: -1, r: -1, x: 0, y: 0, ps: 0, pe: 0, fs: 1 };
}

function newEvent(st, age, shift) {
  const nodes = [];
  for (let i = 0; i < MAXN; i++) nodes.push(newNode());
  return {
    seed: (rnd() * 2147483647) | 0, age,
    D: 4.8 + 2.2 * rnd(), hold: 2.2 + 1.8 * rnd(), F: 3 + 1.4 * rnd(),
    shift, tilt: (rnd() - 0.5) * 0.4,
    y0: 117 + 6 * rnd(), ytop: 14 + 9 * rnd(),
    c0: floor(rnd() * 3) % 3,
    sf: 0.7 + 0.7 * rnd(), ts0: 0.32 + 0.4 * rnd(),
    next: 0, dim: 1, nodes, n: 0, Tmax: 1, xh: 32, sig: [-1, -1, -1],
    lv: new Int32Array(MAXN), lg: new Float64Array(MAXN), nl: 0,
    U: new Float64Array(MAXN), PX: new Float64Array(MAXN + 1), PY: new Float64Array(MAXN + 1),
  };
}

function pickB(c, r, r2) { return r < PSAME ? c : (c + 1 + (r2 < 0.5 ? 0 : 1)) % 3; }

// The shower. Each parton draws one uniform number and its first branching is where the cumulative splitting
// probability along the evolution reaches it, so more coupling or a longer evolution only ever moves a branching
// earlier. Its energy fractions come from the log-uniform soft-emission law between the two cuts that keep each
// daughter alive for at least DELTA of evolution; the evolution ends for a parton of energy E at T0 + ln E.
function build(ev, T0, alpha) {
  const nodes = ev.nodes, seed = ev.seed;
  let n = 0;
  const add = (par, id, type, col, acol, E, ts) => {
    const nd = nodes[n++];
    nd.par = par; nd.id = id; nd.type = type; nd.col = col; nd.acol = acol; nd.E = E; nd.ts = ts; nd.te = 0; nd.l = -1; nd.r = -1;
    return n - 1;
  };
  add(-1, 1, 0, ev.c0, -1, 1, 0);       // the quark, with the colour its string starts on
  add(-1, 2, 1, -1, ev.c0, 1, 0);       // the antiquark, with the matching anticolour
  for (let i = 0; i < n; i++) {
    const nd = nodes[i], E = nd.E, type = nd.type;
    const need = -log(1e-6 + hr(seed, nd.id, 1));
    const tcut = T0 + log(E) - DELTA;
    let Hc = 0, tsp = -1;
    if (n + 2 <= MAXN) {
      for (let t = max(nd.ts + 0.08, ev.ts0); t < tcut; t += DT) {
        const eps = exp(t + DELTA - T0) / E;
        if (eps >= 0.5) break;
        const L = log((1 - eps) / eps);
        const LL = min(L, LCAP);
        Hc += alpha * (type === 2 ? GG * LL + QQ * (1 - 2 * eps) : QF * LL) * DT;
        if (Hc >= need) { tsp = t; break; }
      }
    }
    if (tsp < 0) { nd.te = max(nd.ts + 0.15, T0 + log(E)); continue; }
    nd.te = tsp;
    const eps = exp(tsp + DELTA - T0) / E;
    const lnE = log(eps), lnR = log(1 - eps) - lnE;
    const r2 = hr(seed, nd.id, 2), r3 = hr(seed, nd.id, 3), r4 = hr(seed, nd.id, 4), r5 = hr(seed, nd.id, 5), r6 = hr(seed, nd.id, 6);
    const u = exp(lnE + r2 * lnR);            // the softer daughter's share
    const lid = nd.id * 3 + 1, rid = nd.id * 3 + 2;
    if (type === 0) {                         // q(c) -> q(b) g(c, anti b): the quark keeps the left, the gluon stands toward the string
      const c = nd.col, b = pickB(c, r5, r6);
      nd.l = add(i, lid, 0, b, -1, E * (1 - u), tsp);
      nd.r = add(i, rid, 2, c, b, E * u, tsp);
    } else if (type === 1) {                  // qbar(anti a) -> g(b, anti a) qbar(anti b)
      const a = nd.acol, b = pickB(a, r5, r6);
      nd.l = add(i, lid, 2, b, a, E * u, tsp);
      nd.r = add(i, rid, 1, -1, b, E * (1 - u), tsp);
    } else {
      const c = nd.col, a = nd.acol;
      const pq = QQ * (1 - 2 * eps) / (GG * min(lnR, LCAP) + QQ * (1 - 2 * eps));
      if (r3 < pq) {                          // g(c, anti a) -> qbar(anti a) q(c)
        const z = eps + (1 - 2 * eps) * r2, lE = E * (r4 < 0.5 ? z : 1 - z);
        nd.l = add(i, lid, 1, -1, a, lE, tsp);
        nd.r = add(i, rid, 0, c, -1, E - lE, tsp);
      } else {                                // g(c, anti a) -> g(b, anti a) g(c, anti b), a new colour b between the two
        const b = floor(r5 * 3) % 3, lE = E * (r4 < 0.5 ? u : 1 - u);
        nd.l = add(i, lid, 2, b, a, lE, tsp);
        nd.r = add(i, rid, 2, c, b, E - lE, tsp);
      }
    }
  }
  ev.n = n;
}

function order(ev, i, S) {
  const nd = ev.nodes[i];
  if (nd.l < 0) { ev.lv[ev.nl++] = i; return; }
  order(ev, nd.l, S);
  ev.lg[ev.nl - 1] = SMIN + S * exp(-KAPPA * nd.te);   // the gap across a splitting is its opening angle
  order(ev, nd.r, S);
}

// Heights come from the evolution; the leaves stand left to right in the order of the colour string, each gap the
// opening angle of the splitting that parted its two sides, and a parton's x is the energy-weighted mean of its
// daughters.
function layout(ev, S) {
  const nodes = ev.nodes, n = ev.n;
  let Tmax = 0.5;
  for (let i = 0; i < n; i++) if (nodes[i].l < 0) Tmax = max(Tmax, nodes[i].te);
  ev.Tmax = Tmax;
  const hs = ev.y0 - ev.ytop;
  for (let i = 0; i < n; i++) {
    const nd = nodes[i];
    nd.ps = Math.pow(nd.ts / Tmax, YPOW); nd.pe = Math.pow(nd.te / Tmax, YPOW);
    // a parton that has stopped radiating still runs on to the hadronisation front, a little lower the softer it is
    if (nd.l < 0) nd.pe = max(nd.ps + 0.1, 1 - 0.3 * (1 - sqrt(nd.E)) * (0.45 + 0.55 * hr(ev.seed, nd.id, 13)));
    nd.y = ev.y0 - hs * nd.pe;
  }
  ev.nl = 0;
  order(ev, 0, S);
  ev.lg[ev.nl - 1] = SMIN + S;                            // the two jets part at the hard vertex
  order(ev, 1, S);
  let x = 0;
  for (let k = 0; k < ev.nl; k++) { nodes[ev.lv[k]].x = x; x += ev.lg[k]; }
  for (let i = n - 1; i >= 0; i--) {
    const nd = nodes[i];
    if (nd.l >= 0) { const a = nodes[nd.l], b = nodes[nd.r]; nd.x = (a.E * a.x + b.E * b.x) / (a.E + b.E); }
  }
  const xh = (nodes[0].x + nodes[1].x) * 0.5;
  let lo = 0, hi = 0;
  for (let i = 0; i < n; i++) {
    const nd = nodes[i];
    nd.x = (nd.x - xh) * (FUNNEL + (1 - FUNNEL) * Math.pow(nd.pe, 0.8)) + ev.tilt * (ev.y0 - nd.y);   // the trunk is narrow and the lines fan out toward the top
    if (nd.x < lo) lo = nd.x;
    if (nd.x > hi) hi = nd.x;
  }
  const f = min(1, 52 / max(1, hi - lo));
  for (let i = 0; i < n; i++) nodes[i].x *= f;
  lo *= f; hi *= f;
  for (let i = 0; i < n; i++) nodes[i].fs = 1;
  // a fan is only as big as the room its leaf has: the distance to the nearest other leaf
  for (let a = 0; a < ev.nl; a++) {
    const na = nodes[ev.lv[a]];
    let dm = 99;
    for (let b = 0; b < ev.nl; b++) {
      if (b === a) continue;
      const nb = nodes[ev.lv[b]], ddx = na.x - nb.x, ddy = (na.y - nb.y) * 0.8;
      const d = sqrt(ddx * ddx + ddy * ddy);
      if (d < dm) dm = d;
    }
    na.fs = cl(dm / 7, 0.5, 1.1);
  }
  // where it stands: anywhere the panel has room for it, however wide it came out
  ev.xh = cl(32 + ev.shift * max(0, 24 - (hi - lo) * 0.5) - (lo + hi) * 0.5, 8 - lo, 56 - hi);
}

// the six colour-flow hues, luma-levelled: yellow and green are dimmed toward blue
function setPalette(pal, hb) {
  for (let i = 0; i < 6; i++) {
    hsv(hb + (i < 3 ? i / 3 : (i - 3) / 3 + 0.5), SAT, 1, hv);
    const l = 0.299 * hv[0] + 0.587 * hv[1] + 0.114 * hv[2];
    const g = cl(Math.pow(0.44 / l, 0.55), 0.5, 1);
    pal[i * 3] = hv[0] * g; pal[i * 3 + 1] = hv[1] * g; pal[i * 3 + 2] = hv[2] * g;
  }
}

export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, tau: 0,
    ev: [],
    pal: new Float64Array(18),
    buf: new Float32Array(NPX * 3), g1: new Float32Array(NPX * 3), g2: new Float32Array(NPX * 3),
    hphase: rnd() * TP,
  });
  return st;
}

function spawn(st, age) {
  let best = 0, bd = -1;
  for (let c = 0; c < 8; c++) {
    const s = (rnd() - 0.5) * 2;
    let d = 99;
    for (let j = 0; j < st.ev.length; j++) d = min(d, abs(st.ev[j].shift - s));
    if (d > bd) { bd = d; best = s; }
  }
  const ev = newEvent(st, age, best);
  if (st.ev.length) ev.tilt = (st.ev[st.ev.length - 1].tilt > 0 ? -1 : 1) * (0.05 + 0.17 * rnd());     // it leans the other way
  ev.next = ev.D * (0.7 + 0.4 * rnd()) + 0.5 * ev.hold * rnd();     // the next event starts while this one is still on the panel, never on a clock
  st.ev.push(ev);
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    spawn(st, 6.2 + 1.5 * rnd());
    spawn(st, 0.8 + 1.4 * rnd());
  } else {
    const a = 1 - exp(-dt / 0.12);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  }
  st.tau += dt;
  const k2 = cl(st.ks[1], 0, 4), k3 = cl(st.ks[2], -1, 1), k4 = cl(st.ks[3], -1, 1);
  const T0 = 2.3 + 0.55 * k2, alpha = 2.4 * exp(0.8 * k3), S = 5.8 * exp(1.0 * k4);
  // events live a few seconds each and arrive at random, two or three at a time, never on a clock
  for (let i = st.ev.length - 1; i >= 0; i--) {
    const ev = st.ev[i];
    ev.age += dt;
    if (ev.age > ev.D + ev.hold + ev.F) st.ev.splice(i, 1);
  }
  const newest = st.ev.length ? st.ev[st.ev.length - 1] : null;
  if (!newest || (st.ev.length < 2 && newest.age > 3.5) || (newest.age >= newest.next && st.ev.length < 4)) spawn(st, 0);
  for (let i = 0; i < st.ev.length; i++) {
    const ev = st.ev[i];
    // an event gives way as the next one climbs: the newest is the brightest
    const nx = i + 1 < st.ev.length ? st.ev[i + 1] : null;
    ev.dim = (nx ? 1 - 0.5 * sstep(0, 1, nx.age / nx.D) : 1) * cl(sqrt(13 / max(1, ev.n)), 0.62, 1);
    if (abs(ev.sig[0] - T0) > 1e-4 || abs(ev.sig[1] - alpha) > 1e-4 || abs(ev.sig[2] - S) > 1e-4) {
      ev.sig[0] = T0; ev.sig[1] = alpha; ev.sig[2] = S;
      build(ev, T0, alpha);
      layout(ev, S * ev.sf);
    }
  }
  const hb = HUE0 + fin(st.ks[0], 0) + 0.02 * sin(0.047 * st.tau + st.hphase);
  setPalette(st.pal, hb);
}

// one soft round dot of radius R, added to the buffer
function splat(buf, x, y, R, r, g, b) {
  const x0 = max(0, floor(x - R)), x1 = min(W - 1, floor(x + R)), y0 = max(0, floor(y - R)), y1 = min(H - 1, floor(y + R));
  const R2 = R * R;
  for (let j = y0; j <= y1; j++) {
    const dy = j + 0.5 - y;
    for (let i = x0; i <= x1; i++) {
      const dx = i + 0.5 - x, d2 = dx * dx + dy * dy;
      if (d2 >= R2) continue;
      const w = 1 - d2 / R2, w2 = w * w, q = (j * W + i) * 3;
      buf[q] += r * w2; buf[q + 1] += g * w2; buf[q + 2] += b * w2;
    }
  }
}

function renderEvent(st, ev, buf) {
  const pal = st.pal, tau = st.tau, nodes = ev.nodes, n = ev.n, seed = ev.seed, U = ev.U, PX = ev.PX, PY = ev.PY;
  const age = ev.age;
  const pf = (age / ev.D) * 1.12;          // how far up the front has climbed, as a share of the height
  const secPerP = ev.D / 1.12;
  const phi = cl((age - ev.D - ev.hold) / ev.F, 0, 1);
  const hs = ev.y0 - ev.ytop;
  const dm = ev.dim;
  const fadeA = (y) => {
    if (phi <= 0) return dm;
    const hn = cl((ev.y0 - y) / hs, 0, 1);
    return dm * (1 - sstep(0.55 * hn, 0.55 * hn + 0.45, phi));
  };
  // the hard vertex
  PX[n] = ev.xh + 0.5 * sin(0.8 * tau + ev.seed % 7); PY[n] = ev.y0;
  const hA = fadeA(ev.y0);
  if (hA > 0.01) {
    const fl = 0.75 + 1.1 * exp(-age / 0.4);
    splat(buf, PX[n], PY[n], 4.2, 0.55 * fl * hA, 0.55 * fl * hA, 0.6 * fl * hA);
    splat(buf, PX[n], PY[n], 2.4, 0.5 * hA, 0.5 * hA, 0.5 * hA);
  }
  for (let i = 0; i < n; i++) {
    const nd = nodes[i];
    const hn = cl((ev.y0 - nd.y) / hs, 0, 1), amp = 0.25 + 1.0 * hn;
    const ph = hr(seed, nd.id, 11) * TP, ph2 = hr(seed, nd.id, 12) * TP;
    PX[i] = ev.xh + nd.x + amp * (0.7 * sin(0.61 * tau + ph) + 0.3 * sin(1.07 * tau + ph2));
    PY[i] = nd.y + 0.4 * amp * sin(0.53 * tau + ph2);
    const pu = nd.par < 0 ? 1 : U[nd.par];
    const pfi = pf + (hr(seed, nd.id, 7) - 0.5) * 0.08;
    const u = pu >= 1 ? cl((pfi - nd.ps) / max(1e-3, nd.pe - nd.ps), 0, 1) : 0;
    U[i] = u;
    if (u <= 0) continue;
    const sx = nd.par < 0 ? PX[n] : PX[nd.par], sy = nd.par < 0 ? PY[n] : PY[nd.par];
    const ex = PX[i], ey = PY[i];
    const dx = ex - sx, dy = ey - sy, L = sqrt(dx * dx + dy * dy);
    if (L < 0.5) continue;
    const tx = dx / L, ty = dy / L, nx = -ty, ny = tx;
    const Lg = u * L;
    const E = nd.E, sE = sqrt(E);
    const bE = 0.62 + 0.38 * sE;
    const lp = hr(seed, nd.id, 9) * TP;
    // the two ends of the colour line: colour hues are 0..2 in the palette, anticolour hues 3..5
    const cA = nd.col >= 0 ? nd.col * 3 : -1, cB = nd.acol >= 0 ? 9 + nd.acol * 3 : -1;
    if (nd.type === 2) {
      // a gluon: a colour strand and an anticolour strand twisted round each other, the nearer one the brighter
      const lam = cl(L / 1.5, 7.5, 12.5) * (0.9 + 0.2 * hr(seed, nd.id, 8)), k = TP / lam;
      const Aamp = 1.55 + 0.7 * sE, cc = 0.15, ph0 = -2.2 * tau + lp;
      const R = 1.7, DS = 0.3;
      for (let s = 0; s <= Lg; s += DS) {
        const env = sstep(0, 2.5, s) * sstep(0, 2.5, L - s);
        const a = Aamp * env, phs = k * s + ph0, cp = cos(phs), sp = sin(phs);
        const lon = cc * a * cp, lat = a * sp;
        const dS = DS * sqrt((1 - cc * a * k * sp) * (1 - cc * a * k * sp) + a * k * cp * a * k * cp);
        const gain = max(0.05, dS) / (R * 1.0667) * bE * 1.15 * (0.9 + 0.1 * sin(0.7 * s - 3 * tau + lp));
        const ax = sx + tx * (s + lon) + nx * lat, ay = sy + ty * (s + lon) + ny * lat;
        const bx = sx + tx * (s - lon) - nx * lat, by = sy + ty * (s - lon) - ny * lat;
        const fa = fadeA(ay) * gain * (0.4 + 0.6 * (0.5 + 0.5 * cp)), fb = fadeA(by) * gain * (0.4 + 0.6 * (0.5 - 0.5 * cp));
        splat(buf, ax, ay, R, pal[cA] * fa, pal[cA + 1] * fa, pal[cA + 2] * fa);
        splat(buf, bx, by, R, pal[cB] * fb, pal[cB + 1] * fb, pal[cB + 2] * fb);
      }
    } else {
      // a quark or an antiquark: a straight line, one colour
      const c = cA >= 0 ? cA : cB;
      const R = 1.75 + 0.35 * sE, DS = 0.5;
      for (let s = 0; s <= Lg; s += DS) {
        const px = sx + tx * s, py = sy + ty * s;
        const gain = DS / (R * 1.0667) * bE * (0.88 + 0.12 * sin(0.55 * s - 2.6 * tau + lp)) * fadeA(py);
        splat(buf, px, py, R, pal[c] * gain, pal[c + 1] * gain, pal[c + 2] * gain);
      }
    }
    const A = fadeA(ey);
    if (u < 1) {
      // the growing tip
      const px = sx + tx * Lg, py = sy + ty * Lg, a = fadeA(py);
      splat(buf, px, py, 2.4, 0.36 * a, 0.36 * a, 0.36 * a);
    } else if (nd.l >= 0) {
      // a vertex
      splat(buf, ex, ey, 2.4, 0.36 * A, 0.36 * A, 0.36 * A);
    } else {
      // a leaf: the hadron fan
      const hb = (pfi - nd.pe) * secPerP;
      if (hb < 0) continue;
      const grow = sstep(0, 0.55, hb), flash = 0.85 + 0.9 * exp(-hb / 0.28);
      splat(buf, ex, ey, 3.0, 0.3 * flash * A, 0.3 * flash * A, 0.3 * flash * A);
      const nd_ = 3 + (E > 0.3 ? 1 : 0);
      const a0 = atan2(ty, tx);
      for (let j = 0; j < nd_; j++) {
        const f = (j + 0.5) / nd_;
        const ang = a0 + (f - 0.5) * FAN + (hr(seed, nd.id, 20 + j) - 0.5) * 0.4;
        const len = (3.6 + 3 * sE) * nd.fs * (0.62 + 0.75 * hr(seed, nd.id, 40 + j)) * grow;
        const r0 = (2.3 + 0.8 * nd.fs) + 0.5 * min(hb, 4);
        const ca = cos(ang), sa = sin(ang);
        const both = nd.type === 2 && abs(f - 0.5) < 0.01;
        const cs = nd.type === 2 ? (f < 0.5 ? cB : cA) : cA >= 0 ? cA : cB;
        const fl = flash * (0.9 + 0.1 * sin(9 * hb + j * 2.1 + lp));
        for (let s = 0; s <= len; s += 0.45) {
          const px = ex + ca * (r0 + s), py = ey + sa * (r0 + s);
          const g = 0.45 / (1.75 * 1.0667) * (0.55 + 0.45 * (s / max(0.1, len))) * fl * fadeA(py) * 1.3;
          if (both) {
            splat(buf, px, py, 1.75, 0.5 * g * (0.3 + 0.7 * pal[cA]) + 0.15 * g, 0.5 * g * (0.3 + 0.7 * pal[cA + 1]) + 0.15 * g, 0.5 * g * (0.3 + 0.7 * pal[cA + 2]) + 0.15 * g);
            splat(buf, px, py, 1.75, 0.5 * g * pal[cB], 0.5 * g * pal[cB + 1], 0.5 * g * pal[cB + 2]);
          } else {
            splat(buf, px, py, 1.75, g * (0.7 * pal[cs] + 0.3), g * (0.7 * pal[cs + 1] + 0.3), g * (0.7 * pal[cs + 2] + 0.3));
          }
        }
      }
    }
  }
}

// a box blur of radius r along one axis, by running sums
function blur1(src, dst, horiz, r) {
  const inv = 1 / (2 * r + 1);
  const len = horiz ? W : H, lines = horiz ? H : W, step = horiz ? 3 : W * 3, lstep = horiz ? W * 3 : 3;
  for (let ln = 0; ln < lines; ln++) {
    const base = ln * lstep;
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) if (i >= 0 && i < len) sum += src[base + i * step + c];
      for (let i = 0; i < len; i++) {
        dst[base + i * step + c] = sum * inv;
        const a = i + r + 1, b = i - r;
        if (a < len) sum += src[base + a * step + c];
        if (b >= 0) sum -= src[base + b * step + c];
      }
    }
  }
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const buf = st.buf, g1 = st.g1, g2 = st.g2;
  buf.fill(0);
  for (let i = 0; i < st.ev.length; i++) renderEvent(st, st.ev[i], buf);
  blur1(buf, g1, true, 2); blur1(g1, g2, false, 2); blur1(g2, g1, true, 2); blur1(g1, g2, false, 2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const q = (y * W + x) * 3;
    let o0 = buf[q] + GLOW * g2[q], o1 = buf[q + 1] + GLOW * g2[q + 1], o2 = buf[q + 2] + GLOW * g2[q + 2];
    o0 = o0 < 0.7 ? o0 : 0.7 + 0.3 * (1 - exp(-(o0 - 0.7) / 0.3));
    o1 = o1 < 0.7 ? o1 : 0.7 + 0.3 * (1 - exp(-(o1 - 0.7) / 0.3));
    o2 = o2 < 0.7 ? o2 : 0.7 + 0.3 * (1 - exp(-(o2 - 0.7) / 0.3));
    display.setPixel(x, y, floor(cl(o0, 0, 1) * 255), floor(cl(o1, 0, 1) * 255), floor(cl(o2, 0, 1) * 255));
  }
}
