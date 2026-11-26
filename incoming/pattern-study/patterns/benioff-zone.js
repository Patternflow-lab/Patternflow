// ===== Patternflow pattern =====
// Title:   Benioff Zone
// Family:  subduction
// Idea:    A cross-section through a subduction zone stands on the panel, a striped blue ocean plate bending at the trench and sliding down into hot red mantle to 660 km, and its earthquakes land along the slab as flashing rings that stay as fading dots coloured by depth, so the Wadati-Benioff plane draws itself in points, while melt climbs to the arc volcano and now and then a megathrust rupture runs down the interface and an Omori swarm of aftershocks decays behind it.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Wadati-Benioff zone, the dipping plane of earthquake hypocentres under a trench (Kiyoo Wadati 1935, Hugo Benioff 1949, from memory), with the double seismic zone of two bands about 25 km apart at intermediate depth (Hasegawa and colleagues, 1978, from memory), the Gutenberg-Richter law of many small and few large events (Gutenberg and Richter 1944, from memory) and the Omori law of aftershock rate falling as 1/(t+c) (Fusakichi Omori 1894, from memory). Original here: the horizontal axis squeezed to a quarter of the depth scale so the whole upper mantle fits a portrait panel, the plate stripes that scroll along the slab's own path, the dots that live in slab coordinates and follow the dip knob, the melt that fills an arc chamber which decides its own eruptions, pattern round 256
// Round:   256
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Convergence=0.3..4, Dip=-1..1, Seismicity=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel at once; it opens on the natural colours. The plate is blue, the mantle amber and red, the melt magenta, and the quakes run from yellow at the trench to violet at 660 km.
// Knob 2: Convergence. 0.3 to 4, opening at 2. How fast the plate is consumed: the stripes in the plate scroll along the slab at 0.4 LED a second at the bottom and 5 at the top, the melt rises faster and more of it is made, so the arc erupts more often, and the quakes come a little faster.
// Knob 3: Dip. -1 to 1, opening at 0. The slab dip from a flat 15 degrees at -1 through 42 at the start to a steep 70 at 1. The bend, the trench, the arc volcano and every quake band follow it while it runs, and a flat slab runs out of the right edge of the panel before it reaches the deep quakes.
// Knob 4: Seismicity. -1 to 1, opening at 0.06. How busy the plate is: the quake rate runs from a quarter at -1 to nearly four times at 1, the dots grow and the rings open wider, the slab glows where the quakes have been lately, and a great megathrust earthquake comes about every three minutes at -1 and about every 45 seconds at 1.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, pow, sqrt, exp, sin, cos, tan, atan, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fin = (v, d) => (Number.isFinite(v) ? v : d);

// ---- the section ----
const YS = 9.5;                       // sea level, depth 0
const YB = 124;                       // the 660 km discontinuity
const KZ = (YB - YS) / 660;           // LED rows per km of depth
const T0 = 7.5, HT = T0 / 2;          // slab thickness at rest and half of it
const SEAF = 2.5;                     // the seafloor lies this many rows under the sea
const Y0C = YS + SEAF + HT;           // the slab's centre line, out on the flat plate
const DS = 0.5, NT = 561;             // the path table: arc length step and entries
const SQ = 3.9;                       // the horizontal axis is drawn this many times tighter than the depth axis
const YCH = 15;                       // the arc's magma chamber, a row in the lower crust
const NQ = 300, NB = 24, NP = 96;
const NE = 150;                       // bins of the slab, 2 LED of arc each, that remember the quakes as a soft glow
const ZD = [0.06, 0.06, 0.012, 0.04];  // quakes a second for each LED of slab in the interface, the double zone, the quiet stretch and the deep zone
const ZB = [[17, 58], [60, 330], [330, 450], [450, 655]];

function hsh(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(u, v) {
  const iu = floor(u), iv = floor(v);
  let fu = u - iu, fv = v - iv;
  fu = fu * fu * (3 - 2 * fu); fv = fv * fv * (3 - 2 * fv);
  const a = hsh(iu, iv), b = hsh(iu + 1, iv), c = hsh(iu, iv + 1), d = hsh(iu + 1, iv + 1);
  return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
}
let CR = 0, CG = 0, CB = 0;
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  CR = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  CG = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  CB = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.732;
function poisson(l) {
  if (l <= 0) return 0;
  const L = exp(-l);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L && k < 60);
  return k - 1;
}

// the dip knob, -1..1, as a real dip: 15 at -1, 42 at 0, 70 at 1
const dipOf = (k) => (k < 0 ? 42 + 27 * k : 42 + 28 * k);
const speedOf = (k2) => 1.3 * cl(k2, 0.3, 4);                  // LED a second along the slab, at the stripes
const rateOf = (k2, k4) => exp(1.35 * k4) * (0.45 + 0.55 * pow(cl(k2, 0.3, 4) / 2, 0.8));

// quake colour by depth in km: hue, saturation; a plain yellow at the trench to violet at the bottom
const QZ = [0, 50, 120, 220, 330, 450, 560, 660];
const QH = [0.158, 0.125, 0.07, 0.005, -0.065, -0.135, -0.205, -0.255];
const QS = [0.82, 0.9, 0.95, 0.95, 0.9, 0.88, 0.85, 0.82];
function qcol(zk, H0, a) {                                     // sets CR..CB; a is a white mix
  let k = 0;
  while (k < 6 && zk > QZ[k + 1]) k++;
  const f = cl((zk - QZ[k]) / (QZ[k + 1] - QZ[k]), 0, 1);
  hsv(QH[k] + (QH[k + 1] - QH[k]) * f + H0, (QS[k] + (QS[k + 1] - QS[k]) * f) * (1 - a), 1);
}

export function setup(params) {
  const f = (n) => new Float32Array(n);
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, t: 0, D: 0, mph: 0, ph1: Math.random() * 6.28, ph2: Math.random() * 6.28,
    PX: f(NT), PY: f(NT), PC: f(NT), PSN: f(NT), xt: 18, al: 1.2, xv: 40, ssrc: 80, sg: f(W), zl: f(4), se: f(NE), tdx: 0.3, tdy: 0.95, sr: 20,
    qon: new Uint8Array(NQ), qs: f(NQ), qn: f(NQ), qM: f(NQ), qa: f(NQ), qi: f(NQ), qt: f(NQ), nq: 0,
    bq: f(NB), bo: f(NB), bsp: f(NB), br: f(NB), bph: f(NB), bj: f(NB), bon: new Uint8Array(NB),
    pon: new Uint8Array(NP), px: f(NP), py: f(NP), pvx: f(NP), pvy: f(NP), pa: f(NP), pl: f(NP), pr: f(NP), pk: new Uint8Array(NP),
    fill: 1.2, er: -1, edur: 2, eE: 1, eacc: 0,
    mg: { on: false, t: 0, amp: 1, vr: 12, next: 0, last: 0 }, ash: { on: false, t: 0, A: 0, M: 8.8 },
    fb: f(W * H * 3),
  });
  return st;
}

// ---- the slab's path: its centre line from the trench down, bending from flat to the dip ----
function buildPath(st) {
  const dip = dipOf(cl(st.ks[2], -1, 1));
  const dn = cl((dip - 15) / 55, 0, 1);
  const al = atan(SQ * tan(dip * PI / 180));
  const xt = 13 + 10 * pow(dn, 0.9), Lb = 6 + 5 * (1 - dn);
  st.xt = xt; st.al = al;
  let x = xt, y = Y0C;
  for (let i = 0; i < NT; i++) {
    const th = al * (1 - exp(-i * DS / Lb));
    st.PX[i] = x; st.PY[i] = y; st.PC[i] = cos(th); st.PSN[i] = sin(th);
    const tm = al * (1 - exp(-(i + 0.5) * DS / Lb));
    x += cos(tm) * DS; y += sin(tm) * DS;
  }
  st.tdx = cos(al); st.tdy = sin(al);
  // the arc stands over the slab's top where it is 100 km down; a slab too flat for that gives it the panel's right side
  const yA = YS + 100 * KZ;
  let i100 = NT - 1;
  for (let i = 0; i < NT; i++) if (st.PY[i] - HT * st.PC[i] >= yA) { i100 = i; break; }
  let iS = i100;
  for (let i = 0; i < NT; i++) if (st.PX[i] + HT * st.PSN[i] >= 58) { iS = min(iS, i); break; }
  st.ssrc = iS * DS;
  st.xv = min(58, st.PX[iS] + HT * st.PSN[iS]);
  // the plate interface that ruptures runs from the trench to 68 km down
  const yR = YS + 68 * KZ;
  let ir = 0;
  for (let i = 0; i < NT; i++) if (st.PY[i] - HT * st.PC[i] >= yR) { ir = i; break; }
  st.sr = max(18, ir * DS);
  // how much slab each depth zone shows on the panel, which sets how often it quakes
  let s63 = NT * DS;
  for (let i = 0; i < NT; i++) if (st.PX[i] >= 63) { s63 = i * DS; break; }
  for (let z = 0; z < 4; z++) {
    const nz = z === 0 ? -HT + 0.55 : 0;
    const a = solveS(st, YS + ZB[z][0] * KZ, nz), b = solveS(st, YS + ZB[z][1] * KZ, nz);
    const a2 = a !== a ? (YS + ZB[z][0] * KZ < Y0C + nz ? 0 : s63) : a, b2 = b !== b ? s63 : b;
    st.zl[z] = max(0, min(b2, s63) - min(a2, s63));
  }
}

let CX = 0, CY = 0, TX = 1, TY = 0;
function cAt(st, s) {
  if (s <= 0) { CX = st.xt + s; CY = Y0C; TX = 1; TY = 0; return; }
  let f = s / DS;
  if (f >= NT - 1) {
    const i = NT - 1, d = s - i * DS;
    TX = st.PC[i]; TY = st.PSN[i]; CX = st.PX[i] + TX * d; CY = st.PY[i] + TY * d; return;
  }
  const i = f | 0; f -= i;
  CX = st.PX[i] + (st.PX[i + 1] - st.PX[i]) * f; CY = st.PY[i] + (st.PY[i + 1] - st.PY[i]) * f;
  TX = st.PC[i] + (st.PC[i + 1] - st.PC[i]) * f; TY = st.PSN[i] + (st.PSN[i + 1] - st.PSN[i]) * f;
  const l = 1 / sqrt(TX * TX + TY * TY); TX *= l; TY *= l;
}
let PS = 0, PN = 0;
// the point's place in the slab: PS along the path, PN across it, positive on the underside
function project(st, X, Y, s0) {
  let s = s0;
  for (let it = 0; it < 4; it++) {
    cAt(st, s);
    const d = (X - CX) * TX + (Y - CY) * TY;
    s += d;
    if (d < 0.03 && d > -0.03) break;
  }
  s = cl(s, -80, 500);
  cAt(st, s);
  PS = s; PN = (X - CX) * -TY + (Y - CY) * TX;
}
let QX = 0, QY = 0;
function qpos(st, s, n) { cAt(st, s); QX = CX - TY * n; QY = CY + TX * n; }
// the arc length at which the point n across the slab reaches row yT; NaN when the table does not
function solveS(st, yT, n) {
  const PY = st.PY, PC = st.PC;
  if (yT < PY[0] + n * PC[0] || yT > PY[NT - 1] + n * PC[NT - 1]) return NaN;
  let lo = 0, hi = NT - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (PY[m] + n * PC[m] <= yT) lo = m; else hi = m;
  }
  const g0 = PY[lo] + n * PC[lo], g1 = PY[hi] + n * PC[hi];
  return (lo + (g1 > g0 ? (yT - g0) / (g1 - g0) : 0)) * DS;
}

// ---- quakes ----
function qmag(st, m0, mx) {
  const b = 1 - 0.22 * cl(st.ks[3], -1, 1);
  return min(mx, m0 - Math.log10(1 - Math.random() * 0.99999) / b);
}
function spawnQ(st, s, n, M, aft) {
  let i = -1;
  for (let k = 0; k < NQ; k++) if (!st.qon[k]) { i = k; break; }
  if (i < 0) {
    let bw = -1;
    for (let k = 0; k < NQ; k++) { const w = 1 - st.qi[k]; if (w > bw) { bw = w; i = k; } }
  }
  const e0 = (s + 12) / 2, w0 = 0.5 * pow(10, 0.3 * (M - 3.9)) * (aft ? 0.6 : 1);
  for (let b = max(0, floor(e0 - 3)); b <= min(NE - 1, ceil(e0 + 3)); b++) st.se[b] += w0 * exp(-(b + 0.5 - e0) * (b + 0.5 - e0) / 2.2);
  st.qon[i] = 1; st.qs[i] = s; st.qn[i] = n; st.qM[i] = M; st.qa[i] = 0; st.qi[i] = 1;
  st.qt[i] = aft ? 3.6 + 2.6 * (M - 3.4) : 7 + 3.6 * (M - 3.9);
}
// one quake of the steady background in one depth zone, drawn from where a subduction zone really has them
function sampleZone(st, kind) {
  for (let tr = 0; tr < 6; tr++) {
    const M = qmag(st, 3.9, 7.7);
    let z, n;
    if (kind === 0) {                                  // the interface, thrust faulting between the plates
      z = 17 + 42 * pow(Math.random(), 1.25); n = -HT + 0.55 + 0.45 * gauss();
    } else if (kind === 1) {                           // intermediate depth, the double zone of two planes about 25 km apart
      z = 60 + 270 * Math.random();
      const sep = 4.4 * (1 - sstep(170, 320, z)), nu = -2.45 * (1 - 0.55 * sstep(170, 330, z));
      n = nu + (Math.random() < 0.58 ? 0 : sep) + 0.32 * gauss();
    } else if (kind === 2) {                           // the quiet stretch between 330 and 450 km
      z = 330 + 120 * Math.random(); n = cl(0.8 * gauss(), -2.4, 2.4);
    } else {                                           // deep events, bunched near 560 km, none below the discontinuity
      z = Math.random() < 0.55 ? 565 + 55 * gauss() : 450 + 205 * Math.random();
      if (z < 450 || z > 655) continue;
      n = cl(0.8 * gauss(), -2.4, 2.4);
    }
    const s = solveS(st, YS + z * KZ, n);
    if (s !== s) continue;
    qpos(st, s, n);
    if (QX < 1 || QX > 63) continue;
    spawnQ(st, s, n, M, false);
    return;
  }
}
// the outer rise: the plate cracks as it bends, seaward of the trench
function sampleRise(st) {
  const s = -(1.5 + 10 * Math.random());
  spawnQ(st, s, -HT + 0.7 + 2.2 * Math.random(), qmag(st, 3.9, 7.7), false);
}
// one aftershock of a great earthquake: along the interface, some above it in the overriding plate, a few out to sea
function sampleAft(st) {
  const r = Math.random();
  let s, n;
  if (r < 0.08) { s = -(1 + 8 * Math.random()); n = -HT + 0.7 + 2 * Math.random(); }
  else if (r < 0.26) { s = st.sr * Math.random(); n = -HT - 1.2 - 3.2 * Math.random(); }
  else { s = st.sr * 1.1 * pow(Math.random(), 0.9) + 0.5 * gauss(); n = -HT + 0.6 + 0.8 * gauss(); }
  const M = qmag(st, 3.6, st.ash.M - 1.2);
  spawnQ(st, s, n, M, true);
}

// ---- one step of everything the picture holds ----
function step(st, dt) {
  const ks = st.ks, k4 = cl(ks[3], -1, 1), f4 = exp(1.35 * k4), rate = rateOf(ks[1], k4), sp = speedOf(ks[1]);
  st.t += dt;
  st.D += sp * dt;
  st.mph += 0.3 * sp * dt;
  buildPath(st);

  // the steady background
  for (let z = 0; z < 4; z++) {
    const nz = poisson(ZD[z] * st.zl[z] * rate * dt);
    for (let i = 0; i < nz; i++) sampleZone(st, z);
  }
  if (Math.random() < 0.2 * rate * dt) sampleRise(st);

  // a great earthquake and its aftershocks
  const mg = st.mg, ash = st.ash;
  if (!mg.on && st.t >= mg.next) {
    mg.on = true; mg.t = 0; mg.amp = 0.88 + 0.12 * Math.random(); mg.vr = 11 + 3 * Math.random();
    ash.on = true; ash.t = 0; ash.M = 8.4 + 0.8 * Math.random();
    ash.A = (70 + 70 * (ash.M - 8.4) / 0.8) * (0.7 + 0.3 * f4) / log(61 / 0.8);
  }
  if (mg.on) {
    mg.t += dt;
    if (mg.t > 9) { mg.on = false; mg.last = st.t; mg.next = st.t + (40 + 50 * -log(1 - Math.random() * 0.999)) / sqrt(rate); }
  }
  if (ash.on) {
    const c = 0.8;
    const lam = ash.A * log((ash.t + dt + c) / (ash.t + c));
    ash.t += dt;
    const na = floor(lam + Math.random());
    for (let i = 0; i < na; i++) sampleAft(st);
    if (ash.t > 70) ash.on = false;
  }

  // ageing: a dot fades faster when too many are alive, so the picture never clogs
  let alive = 0;
  for (let i = 0; i < NQ; i++) if (st.qon[i]) alive++;
  st.nq = alive;
  const de = exp(-dt / 16);
  for (let b = 0; b < NE; b++) st.se[b] *= de;
  const crowd = 1 + pow(alive / 110, 2);
  for (let i = 0; i < NQ; i++) {
    if (!st.qon[i]) continue;
    st.qa[i] += dt;
    st.qi[i] *= exp(-dt * crowd / st.qt[i]);
    if (st.qi[i] < 0.05) st.qon[i] = 0;
  }

  // melt: made over the slab at about 100 km, rises to the chamber under the arc, fills it
  const nm = poisson(1.5 * pow(cl(ks[1], 0.3, 4) / 2, 0.9) * dt);
  for (let j = 0; j < nm; j++) {
    for (let i = 0; i < NB; i++) {
      if (st.bon[i]) continue;
      st.bon[i] = 1; st.bq[i] = 0; st.bo[i] = -5 + 14 * Math.random(); st.bsp[i] = 2.2 + 1.4 * Math.random();
      st.br[i] = 1.3 + 0.8 * Math.random(); st.bph[i] = 6.28 * Math.random(); st.bj[i] = 2.4 * (Math.random() - 0.5);
      break;
    }
  }
  const spd = 0.55 + 0.45 * cl(ks[1], 0.3, 4) / 2;
  for (let i = 0; i < NB; i++) {
    if (!st.bon[i]) continue;
    cAt(st, st.ssrc + st.bo[i]);
    const dx = st.xv + st.bj[i] - (CX + TY * (HT + 0.9)), dy = YCH - (CY - TX * (HT + 0.9));
    st.bq[i] += st.bsp[i] * spd * dt / max(6, sqrt(dx * dx + dy * dy));
    if (st.bq[i] >= 1) { st.bon[i] = 0; st.fill += 0.14 * st.br[i] / 1.7; }
  }
  st.fill = max(0, st.fill - 0.012 * dt);
  if (st.er < 0) {
    if (Math.random() < max(0, st.fill - 3.5) * 0.06 * dt) {
      st.er = 0; st.eE = cl((0.4 + 0.11 * st.fill) * (0.7 + 0.6 * Math.random()), 0.5, 1.5); st.edur = 1.8 + 1.4 * st.eE; st.fill *= 0.25; st.eacc = 0;
      // the bombs, thrown out at once
      for (let j = 0; j < 9 + (st.eE * 4 | 0); j++) spawnP(st, 1);
    }
  } else {
    st.er += dt;
    st.eacc += dt * 24 * st.eE * (st.er < st.edur * 0.7 ? 1 : 0);
    while (st.eacc >= 1) { st.eacc -= 1; spawnP(st, 0); }
    if (st.er > st.edur) st.er = -1;
  }
  // puffs and bombs
  for (let i = 0; i < NP; i++) {
    if (!st.pon[i]) continue;
    st.pa[i] += dt;
    if (st.pa[i] > st.pl[i]) { st.pon[i] = 0; continue; }
    if (st.pk[i] === 1) st.pvy[i] += 46 * dt;
    else { const dr = exp(-1.3 * dt); st.pvx[i] += (1.5 - st.pvx[i]) * (1 - dr); st.pvy[i] *= dr; }
    st.px[i] += st.pvx[i] * dt; st.py[i] += st.pvy[i] * dt;
  }
}
function landTop(st, X) {
  const xt = st.xt;
  let y = YS + 5 - 6.6 * sstep(xt - 2, xt + 12, X);
  y -= 4.4 * pow(max(0, 1 - abs(X - st.xv) / 8), 1.2);
  return y + 0.5 * (vn(X / 7, 1.3) - 0.5);
}
function spawnP(st, kind) {
  let i = -1;
  for (let k = 0; k < NP; k++) if (!st.pon[k]) { i = k; break; }
  if (i < 0) return;
  const top = landTop(st, st.xv) + 0.8;
  st.pon[i] = 1; st.pk[i] = kind; st.pa[i] = 0;
  if (kind === 1) {
    const an = (Math.random() - 0.5) * 1.7;
    const v = 12 + 14 * Math.random();
    st.px[i] = st.xv + 0.8 * (Math.random() - 0.5); st.py[i] = top;
    st.pvx[i] = sin(an) * v * 0.8; st.pvy[i] = -cos(an) * v; st.pl[i] = 0.9 + 0.8 * Math.random(); st.pr[i] = 0.9;
  } else {
    st.px[i] = st.xv + 1.2 * (Math.random() - 0.5); st.py[i] = top;
    st.pvx[i] = 1.4 * (Math.random() - 0.5); st.pvy[i] = -(7 + 6 * Math.random()) * st.eE; st.pl[i] = 1.7 + 1.1 * Math.random();
    st.pr[i] = 1.2 + 0.5 * Math.random();
  }
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(dt || 0, 0, 0.1);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    buildPath(st);
    // the plate has been moving, the quakes falling and the melt rising for a good while before the first frame
    st.mg.next = 55 + 55 * Math.random(); st.mg.last = -(15 + 40 * Math.random());
    for (let i = 0; i < 500; i++) step(st, 0.1);
    for (let i = 0; i < 30; i++) step(st, 1 / 30);
    st.t = 45 + 5;
    st.mg.next = st.t + 30 + 50 * Math.random(); st.mg.last = st.t - (20 + 30 * Math.random());
  }
  const a = 1 - exp(-dt / 0.25);
  for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  if (dt > 0) step(st, dt);
}

// ---- drawing ----
function addDisc(fb, x, y, r, R, G, B, a, over) {
  const x0 = max(0, floor(x - r - 1.5)), x1 = min(W - 1, ceil(x + r + 1.5)), y0 = max(0, floor(y - r - 1.5)), y1 = min(H - 1, ceil(y + r + 1.5));
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
    const dx = px + 0.5 - x, dy = py + 0.5 - y, d = sqrt(dx * dx + dy * dy);
    let c = cl((r - d) / 1.3 + 0.5, 0, 1);
    if (c <= 0) continue;
    c = c * c * (3 - 2 * c) * a;
    const f = (py * W + px) * 3;
    if (over) { fb[f] += (R - fb[f]) * c; fb[f + 1] += (G - fb[f + 1]) * c; fb[f + 2] += (B - fb[f + 2]) * c; }
    else { fb[f] += R * c; fb[f + 1] += G * c; fb[f + 2] += B * c; }
  }
}
function addRing(fb, x, y, r, w, R, G, B, a) {
  const e = r + w + 1;
  const x0 = max(0, floor(x - e)), x1 = min(W - 1, ceil(x + e)), y0 = max(0, floor(y - e)), y1 = min(H - 1, ceil(y + e));
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
    const dx = px + 0.5 - x, dy = py + 0.5 - y, d = sqrt(dx * dx + dy * dy);
    const c = cl(1 - abs(d - r) / w, 0, 1) * a;
    if (c <= 0) continue;
    const f = (py * W + px) * 3;
    fb[f] += R * c; fb[f + 1] += G * c; fb[f + 2] += B * c;
  }
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const fb = st.fb, H0 = st.ks[0], D = st.D, t = st.t, mg = st.mg;
  const tdx = st.tdx, tdy = st.tdy, xt = st.xt, sg = st.sg;
  const k4 = cl(st.ks[3], -1, 1);
  // the first guess of each column's place along the slab
  for (let px = 0; px < W; px++) {
    const X = px + 0.5;
    if (X <= xt) { sg[px] = X - xt; continue; }
    let lo = 0, hi = NT - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (st.PX[m] <= X) lo = m; else hi = m; }
    sg[px] = lo * DS;
  }
  // how loaded the interface is, 0 just after a great quake and 1 when the next is near
  const phi = mg.on ? 0 : cl((t - mg.last) / max(20, mg.next - mg.last), 0, 1);
  const xw = xt - 20 * mg.t;                                    // the sea wave of a great quake running out to sea
  const sr = st.sr;
  const mfl = 0.25 + 0.23 * cl(st.ks[1], 0.3, 4);        // the mantle's streaks show more the faster the plate drags it
  for (let py = 0; py < H; py++) {
    const Y = py + 0.5;
    const zf = cl((Y - YS) / (YB - YS), 0, 1.06);
    for (let px = 0; px < W; px++) {
      const X = px + 0.5;
      project(st, X, Y, sg[px]);
      const s = PS, n = PN, u = s - D;
      const zk = (Y - YS) / KZ;
      const nbot = HT + cl(0.8 * sin(u / 8.3 + st.ph1) + 0.5 * sin(u / 3.7 + st.ph2), -1.25, 1.25);
      const lt = landTop(st, X);
      // the mantle: amber under the crust, red lower down, darker with depth, with slow streaks dragged down the slab's way
      const aa = X * tdx + Y * tdy - st.mph, bb = -X * tdy + Y * tdx;
      const nz = 0.6 * vn(aa / 15, bb / 5) + 0.4 * vn(aa / 7 + 7.7, bb / 2.6 + 3.1);
      hsv(0.088 - 0.082 * pow(zf, 0.75) + H0, 0.95 - 0.08 * zf, (0.62 - 0.46 * pow(zf, 0.85)) * (1 - 0.5 * mfl + mfl * nz));
      let r = CR, g = CG, b = CB;
      // the slab chills the mantle beside it
      const dd = n < -HT ? -HT - n : n > nbot ? n - nbot : 0;
      const hl = 1 - 0.5 * exp(-dd / 2.4) - 0.16 * exp(-dd / 9);
      r *= hl; g *= hl; b *= hl;
      // the quake glow spills a little into the mantle either side of the slab
      {
        const eb = (s + 12) / 2 - 0.5, ei = floor(eb);
        if (ei >= 0 && ei < NE - 1 && dd > 0) {
          const fe = st.se[ei] + (st.se[ei + 1] - st.se[ei]) * (eb - ei);
          const ea = (1 - exp(-0.55 * fe)) * 0.2 * exp(-dd / 4.5);
          if (ea > 0.004) { qcol(zk, H0, 0.1); r += CR * ea; g += CG * ea; b += CB * ea; }
        }
      }
      // melt made over the slab, a soft pink glow in the wedge
      const ms = (s - st.ssrc - 4) / 7, mn = (n + HT + 2.4) / 3;
      const mgw = 0.2 * exp(-ms * ms - mn * mn);
      if (mgw > 0.004) { hsv(0.93 + H0, 0.8, 1); r += CR * mgw; g += CG * mgw; b += CB * mgw; }
      // the bottom edge, the 660 km discontinuity as a pale seam, and the darker lower mantle under it
      if (Y > YB - 0.5) {
        const a = sstep(YB - 0.5, YB + 1.5, Y);
        r *= 1 - 0.45 * a; g *= 1 - 0.45 * a; b *= 1 - 0.3 * a;
      }
      const seam = exp(-((Y - YB) * (Y - YB)) / 1.1) * 0.13;
      r += seam; g += seam * 0.6; b += seam * 0.5;
      // sky above the surface
      const surf = min(YS, lt);
      const aM = cl(Y - surf + 0.5, 0, 1);
      r *= aM; g *= aM; b *= aM;
      // sea, a thin blue band that deepens over the trench
      const aSea = cl(Y - YS + 0.5, 0, 1) * cl(lt - Y + 0.5, 0, 1);
      if (aSea > 0) {
        const sh = 0.04 * sin(X / 2.3 - t * 1.1 + Y * 0.7);
        hsv(0.555 + H0, 0.85, 0.2 + 0.12 * (1 - cl((Y - YS) / 4, 0, 1)) + sh);
        let sr0 = CR, sg0 = CG, sb0 = CB;
        const wv = exp(-((X - xw) * (X - xw)) / 5) * (mg.on ? 0.75 * exp(-mg.t / 3) : 0);
        sr0 += 0.5 * wv; sg0 += 0.8 * wv; sb0 += 0.9 * wv;
        r += (sr0 - r) * aSea; g += (sg0 - g) * aSea; b += (sb0 - b) * aSea;
      }
      // the overriding plate, a dark crust and lithosphere with the arc's cone on it
      const bc = YS + 8.2 + 3 * sstep(xt + 10, 64, X);
      const aC = cl(Y - lt + 0.5, 0, 1) * cl(bc - Y + 0.5, 0, 1);
      if (aC > 0) {
        const dep = Y - lt, rock = 0.88 + 0.24 * vn(X / 2.2, Y / 1.7);
        const top = 1 - sstep(0, 2.2, dep);
        hsv(0.085 - 0.03 * sstep(2, 8, dep) + H0, 0.42 + 0.14 * sstep(1, 6, dep), (0.37 - 0.1 * sstep(1, 8, dep)) * rock + 0.05 * top);
        r += (CR - r) * aC; g += (CG - g) * aC; b += (CB - b) * aC;
      }
      // the slab: sediment, crust and lithosphere layers, cut across by plate stripes that move with the plate
      const aS = cl(n + HT + 0.5, 0, 1) * cl(nbot - n + 0.5, 0, 1);
      if (aS > 0) {
        const dpt = n + HT;
        // stripes: alternating bands of changing width carried along the plate
        const W0 = 7.5, k0 = floor(u / W0);
        let j = k0;
        const bk = (m) => m * W0 + (hsh(m, 91) - 0.5) * 0.7 * W0;
        if (u < bk(k0)) j = k0 - 1; else if (u >= bk(k0 + 1)) j = k0 + 1;
        const b0 = bk(j), b1 = bk(j + 1), dl = u - b0, dh = b1 - u;
        const val = (m) => ((m & 1) ? 1 : -1) * (0.55 + 0.45 * hsh(m, 17));
        let sv = val(j);
        if (dl < 0.6) sv += (val(j - 1) - sv) * (0.5 - 0.5 * dl / 0.6);
        else if (dh < 0.6) sv += (val(j + 1) - sv) * (0.5 - 0.5 * dh / 0.6);
        const wz = sstep(110, 640, zk), cz = 1 - sstep(60, 420, zk);
        const sedT = 1.2 + 1.0 * vn(u / 9, 4.4), crT = sedT + 1.7;
        let hh, ss, vv, amp;
        if (dpt < sedT) { hh = 0.53; ss = 0.62; vv = 0.6; amp = 0.2; }
        else if (dpt < crT) { hh = 0.58; ss = 0.8; vv = 0.5; amp = 0.5; }
        else { hh = 0.62; ss = 0.6; vv = 0.5 - 0.08 * cl((dpt - crT) / 5, 0, 1); amp = 0.5; }
        if (dpt >= sedT - 0.5 && dpt < sedT + 0.5) { vv += (0.5 - 0.6) * sstep(sedT - 0.5, sedT + 0.5, dpt); }
        vv *= 1 + amp * sv * cz;
        hh += 0.018 * sv * cz + 0.1 * wz;
        vv *= 1 - 0.5 * wz; ss *= 1 - 0.12 * wz;
        hsv(hh + H0, ss, vv);
        let sr1 = CR, sg1 = CG, sb1 = CB;
        // the load building on the locked interface, an amber seam that brightens before a great quake
        const pf = sstep(0, 3, s) * (1 - sstep(sr - 3, sr, s)) * exp(-((n + HT - 1.2) * (n + HT - 1.2)) / 5);
        if (pf > 0.001 && !mg.on) {
          hsv(0.085 + H0, 0.9, 1);
          const al2 = 0.2 * phi * phi * pf * (0.85 + 0.15 * sin(t * 2.1 + s * 0.4));
          sr1 += CR * al2; sg1 += CG * al2; sb1 += CB * al2;
        }
        // where quakes have been lately the slab glows in the colour of its depth, a plane that fills in as the dots pile up
        const eb = (s + 12) / 2 - 0.5, ei = floor(eb);
        if (ei >= 0 && ei < NE - 1) {
          const fe = st.se[ei] + (st.se[ei + 1] - st.se[ei]) * (eb - ei);
          const ea = (1 - exp(-0.55 * fe)) * 0.36 * exp(-(n + 0.3) * (n + 0.3) / 12);
          if (ea > 0.004) { qcol(zk, H0, 0.1); sr1 = sr1 * (1 - 0.6 * ea) + CR * 0.9 * ea; sg1 = sg1 * (1 - 0.6 * ea) + CG * 0.9 * ea; sb1 = sb1 * (1 - 0.6 * ea) + CB * 0.9 * ea; }
        }
        // the sea floor and the slab fade into the lower mantle under 660 km
        const fz = 1 - 0.7 * sstep(YB - 3, YB + 3.5, Y);
        r += (sr1 - r) * aS * fz; g += (sg1 - g) * aS * fz; b += (sb1 - b) * aS * fz;
      }
      // the rupture of a great quake: a front that runs down the interface from the trench, and a glow left behind it
      if (mg.on && s > -3 && s < sr + 8) {
        const tf = mg.t, sf = mg.vr * tf, ag = tf - max(0, s) / mg.vr;
        if (ag > -0.5) {
          const dfr = (s - sf) / 2.4;
          const front = exp(-dfr * dfr) * (s <= sf + 3 ? 1 : 0);
          const trail = ag > 0 ? exp(-ag / 2.4) * sstep(-2, 0.5, s) * (1 - sstep(sr - 1, sr + 7, s)) : 0;
          const prf = exp(-((n + HT - 1.0) * (n + HT - 1.0)) / 6);
          const amp = (0.9 * front + 0.7 * trail) * prf * mg.amp;
          if (amp > 0.003) {
            hsv(0.13 + H0, 0.8 * (1 - front * 0.45), 1);
            r += CR * amp; g += CG * amp; b += CB * amp;
          }
        }
      }
      const f = (py * W + px) * 3;
      fb[f] = r; fb[f + 1] = g; fb[f + 2] = b;
    }
  }

  // the magma chamber under the arc and the melt climbing to it
  const cham = 0.16 + 0.5 * cl(st.fill / 4.5, 0, 1);
  hsv(0.97 + H0, 0.85, 1);
  {
    // a soft ellipse, wider than it is tall
    const cx = st.xv, cy = YCH;
    for (let py = max(0, floor(cy - 5)); py <= min(H - 1, ceil(cy + 5)); py++) for (let px = max(0, floor(cx - 8)); px <= min(W - 1, ceil(cx + 8)); px++) {
      const dx = (px + 0.5 - cx) / 4.6, dy = (py + 0.5 - cy) / 2.3;
      const c = exp(-(dx * dx + dy * dy)) * cham;
      if (c < 0.004) continue;
      const f = (py * W + px) * 3;
      fb[f] += CR * c; fb[f + 1] += CG * c; fb[f + 2] += CB * c;
    }
  }
  for (let i = 0; i < NB; i++) {
    if (!st.bon[i]) continue;
    cAt(st, st.ssrc + st.bo[i]);
    const sx = CX + TY * (HT + 0.9), sy = CY - TX * (HT + 0.9);
    const q = st.bq[i], e = q * q * (3 - 2 * q) * 0.35 + q * 0.65;
    const dx = st.xv + st.bj[i], dy = YCH;
    const bx = sx + (dx - sx) * e + sin(q * 5 + st.bph[i]) * 1.1 * sin(PI * q), by = sy + (dy - sy) * e;
    const rr = (0.9 + 0.6 * sstep(0, 0.6, q)) * st.br[i] / 1.5;
    const hot = 0.93 + 0.12 * q;
    hsv(hot + H0, 0.78, 1);
    addDisc(fb, bx, by, rr * 2.1, CR * 0.7, CG * 0.7, CB * 0.7, 0.22, false);
    addDisc(fb, bx, by + 0.9 * rr, rr * 0.8, CR * 0.8, CG * 0.8, CB * 0.8, 0.5, true);
    addDisc(fb, bx, by, rr, CR, CG, CB, 0.95, true);
    hsv(hot + 0.02 + H0, 0.35, 1);
    addDisc(fb, bx, by, rr * 0.45, CR, CG, CB, 0.8, true);
  }

  // earthquakes: each a flash that opens as a ring and stays as a dot that fades
  const rscale = 0.75 + 0.55 * (k4 + 1) / 2;
  for (let i = 0; i < NQ; i++) {
    if (!st.qon[i]) continue;
    const M = st.qM[i], a = st.qa[i], I = st.qi[i];
    qpos(st, st.qs[i], st.qn[i]);
    const x = QX, y = QY;
    if (x < -2 || x > 66 || y < 0 || y > 128) continue;
    const zk = (y - YS) / KZ;
    const fl = a < 0.3 ? 1 - a / 0.3 : 0;
    const rd = (1.12 + 0.28 * (M - 3.9)) * (0.85 + 0.15 * (k4 + 1)) * (1 + 0.35 * fl);
    qcol(zk, H0, 0.7 * fl);
    const al = cl(pow(I, 0.85), 0, 1);
    addDisc(fb, x, y, min(2.8, rd) + 1.6, CR * 0.8, CG * 0.8, CB * 0.8, 0.09 * al, false);
    addDisc(fb, x, y, min(2.6, rd), CR, CG, CB, al, true);
    if (I > 0.55 || a < 1.0) {
      const dur = 1.0 + 0.13 * (M - 3.9), p = a / dur;
      if (p < 1) {
        const Rm = (3.0 + 2.1 * (M - 3.9)) * rscale;
        const rr = Rm * (1 - pow(1 - p, 2.2)), amp = pow(1 - p, 1.4) * cl(0.5 + 0.15 * (M - 3.9), 0.4, 1);
        qcol(zk, H0, 0.35);
        addRing(fb, x, y, rr, 1.25, CR, CG, CB, amp * 0.9);
      }
    }
  }

  // the eruption: a flare at the crater, a conduit, a column of puffs that spreads at the top, and a few bombs
  if (st.er >= 0) {
    const p = st.er / st.edur, E = st.eE;
    const top = landTop(st, st.xv);
    const fa = pow(1 - p, 0.7) * (p < 0.08 ? p / 0.08 : 1);
    hsv(0.07 + H0, 0.9, 1);
    for (let yy = top + 1; yy < YCH - 1; yy += 1) addDisc(fb, st.xv, yy, 0.9, CR, CG, CB, 0.4 * fa, false);
    hsv(0.11 + H0, 0.6, 1);
    addDisc(fb, st.xv, top + 0.4, (1.5 + 0.7 * E) * (0.8 + 0.4 * fa), CR, CG, CB, fa, false);
  }
  for (let i = 0; i < NP; i++) {
    if (!st.pon[i]) continue;
    const p = st.pa[i] / st.pl[i];
    if (st.pk[i] === 1) {
      hsv(0.12 - 0.07 * p + H0, 0.75, 1);
      addDisc(fb, st.px[i], st.py[i], st.pr[i], CR, CG, CB, 1 - p * p, false);
    } else {
      hsv(0.08 - 0.06 * p + H0, 0.92 - 0.3 * p, 0.95 - 0.5 * p);
      addDisc(fb, st.px[i], st.py[i], st.pr[i] * (1 + 1.3 * p), CR, CG, CB, 0.6 * pow(1 - p, 1.1), true);
    }
  }

  for (let p = 0, f = 0; p < W * H; p++, f += 3) {
    display.setPixel(p % W, (p / W) | 0, cl((fb[f] * 255 + 0.5) | 0, 0, 255), cl((fb[f + 1] * 255 + 0.5) | 0, 0, 255), cl((fb[f + 2] * 255 + 0.5) | 0, 0, 255));
  }
}
