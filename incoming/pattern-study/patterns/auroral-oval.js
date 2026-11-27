// ===== Patternflow pattern =====
// Title:   Auroral Oval
// Family:  ionosphere
// Idea:    The auroral oval seen from a satellite over the north geomagnetic pole, a ring of green, pink and red arcs round an off-centre pole, thick and bright at midnight at the bottom and thin and dim at noon, through which a substorm runs: the arcs thin and sink equatorward, one brightens, a bulge with a curling surge head spreads poleward and westward, then it breaks into omega bands and blinking patches.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the oval as a ring round the geomagnetic pole (Feldstein 1963, Akasofu 1964), the substorm as growth, expansion and recovery with a westward travelling surge (Akasofu 1964; Elphinstone and colleagues 1996), the oval first seen whole from space by Dynamics Explorer 1 (Frank and Craven 1981), then by Polar, IMAGE and DMSP; omega bands, pulsating patches of 3 to 20 s (Royrvik and Davis 1977), poleward moving forms at the cusp. All from memory; the numbers are invented.
// Round:   267
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.6..4, Driver=-1..1, Structure=0..1
//
// Knob 1: Hue. Mixes the emissions round once: 0 and 1 are a green oval with a pink lower edge and red tails, 0.33 a red-dominant storm, 0.67 a violet-blue one; opens at 0.
// Knob 2: Pace. How fast the event clock runs, 0.6 at the minimum, 2 at the opening, 4 at the top; one substorm takes 60 to 120 s at 2, half that at 4, 3 to 6 minutes at 0.6.
// Knob 3: Driver. The solar wind field from north (-1) to south (+1), opening at 0: at -1 a small thin oval with weak pseudo-breakups and few cusp forms, at 1 an oval pushed 4 degrees equatorward and a large substorm a minute.
// Knob 4: Structure. 0 is smooth arcs with weak folds, 0.06 where it opens nearly the same, 1 beaded arcs, rays over the bulge, strong travelling folds, a curled surge head and deep blinking.
//
// The view is a polar map: noon about 35 degrees left of up, midnight at the bottom, dawn right, dusk left, with a mild perspective. Tilt, aim and zoom swing slowly with real time, as a spacecraft's would, so the frame never settles. The oval is a circle 5 degrees off the pole toward midnight, five arcs with a sharp equatorward edge and a soft poleward tail, spread into a thick band at night, one dim arc at noon, running off the sides at dawn and dusk. A blurred copy of the light lights the haze round it.
// Modelled: the geometry, the arc profile, the three phases with a westward surge and poleward bulge, omega bands, patches blinking at 4.7, 8.3 and 13.1 s, the colours of 557.7 nm green, N2 pink, soft red and hard violet.
// Made up: every number, the phase lengths (a real one takes hours), the fan of arcs across the bulge, the swirl at the head, the folds, the colour weights, the twilight and ground, each substorm's size, place and timing.

const W = 64, H = 128, NP = W * H;
const NPHI = 512, NPH1 = 513;
const NA = 5; // arcs
const GW = 16, GH = 32; // the glow grid: 4 by 4 LEDs a cell
const { floor, sqrt, exp, sin, cos, abs, min, max, atan2, log, PI } = Math;
const TWO_PI = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const randn = () => sqrt(-2 * log(1e-9 + rnd())) * cos(TWO_PI * rnd());

// the camera: a pinhole over a plane of colatitude (degrees), tilted 11 degrees from straight down
const CAM = { tau: 0.2, b: 1.1, h: 22, cy: -11, a: 0.58, x0: -2 };
const ROT0 = 0.6; // magnetic noon's turn from straight up, radians

// per arc: place, bulge fan, brightness, hardness
const PK = [0, 0.22, 0.46, 0.72, 1];
const FAN = [0.08, 0.3, 0.52, 0.76, 1];
const B0 = [0.8, 0.5, 0.62, 0.4, 0.46];
const HK = [1, 0.7, 0.35, 0.1, 0]; // pink edge and violet: the hardest precipitation is the equatorward arc
const GS = [1, 1, 0.9, 0.68, 0.42]; // share of 557.7 green
const RS = [0, 0.05, 0.2, 0.55, 0.95]; // share of 630.0 red: the soft poleward arcs
const WP = [0.5, 0.58, 0.7, 0.85, 1.1]; // poleward tail width, degrees
const BV = [0.5, 0.46, 0.55, 0.43, 0.49]; // bead drift per event second
const PERIODS = [4.7, 8.3, 13.1];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const TM = new Float32Array(1025);
for (let i = 0; i <= 1024; i++) TM[i] = 1 - exp(-1.45 * (i / 256));

export function setup(params) {
  const S = {
    ready: false,
    te: 0,
    tr: 0, // real seconds: the spacecraft's drift does not follow Pace
    ks: [0, 2, 0, 0.06],
    n1: new Float32Array(256),
    n3: new Float32Array(32768),
    th0: new Float32Array(NP),
    ps0: new Float32Array(NP),
    isp: new Float32Array(NP),
    bg: new Float32Array(NP * 3),
    img: new Uint8Array(NP * 3),
    em: new Float32Array(NP * 3),
    lo: new Float32Array(GW * GH * 3),
    lo2: new Float32Array(GW * GH * 3),
    OV: new Float32Array(NPH1),
    NW: new Float32Array(NPH1),
    DPH: new Float32Array(NPH1),
    GB: new Float32Array(NPH1),
    FRN: new Float32Array(NPH1),
    CK: [],
    IK: [],
    D: 0.5,
    phase: 1,
    tp: 0,
    gro: 1, sprd: 1, Bu: 0, dif: 0.5, om: 0, act: 1, eon: 0, kh: 1, hd: 0,
    pw: 0, pe: 0, phi0: 0, ww: 0.6, we: 0.2, dmax: 5, tauw: 8, str: 0.9, pseudo: false,
    Dg: 60, Dx: 30, Dr: 70,
    nO: 11, omPh: 0, omV: 0.05,
    rot: 0,
    gk: [1, 0.35, 0.35],
    pc: [],
    pcNext: 3,
  };
  for (let i = 0; i < 256; i++) S.n1[i] = rnd();
  for (let i = 0; i < 32768; i++) S.n3[i] = rnd();
  for (let k = 0; k < NA; k++) {
    S.CK.push(new Float32Array(NPH1));
    S.IK.push(new Float32Array(NPH1));
  }
  S.seedPh = [rnd() * TWO_PI, rnd() * TWO_PI, rnd() * TWO_PI, rnd() * TWO_PI];
  S.rotPh = [rnd() * TWO_PI, rnd() * TWO_PI];
  aim(S, 0, 0, 0);
  // the dark Earth: a faint blue mottle, lighter toward the top for twilight
  const g = new Float32Array(NP);
  for (let o = 0; o < 2; o++) {
    const f = 1 / (40 - o * 18), a = [0.65, 0.35][o];
    const ox = rnd() * 50, oy = rnd() * 50;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) g[y * W + x] += a * vn3(S, x * f + ox, y * f + oy, o);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = y * W + x, m = g[q];
      const tw = ss(0.5, 0.0, y / 128) * 0.9;
      S.bg[q * 3] = (3 + 7 * m + 14 * tw) / 255;
      S.bg[q * 3 + 1] = (8 + 11 * m + 18 * tw) / 255;
      S.bg[q * 3 + 2] = (21 + 15 * m + 34 * tw) / 255;
    }
  params.s = S;
  return S;
}

// camera to plane per LED; dx, dy (degrees) and dz shift the aim and height
function aim(S, dx, dy, dz) {
  const s = sin(CAM.tau), c = cos(CAM.tau), hh = CAM.h * (1 + dz);
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5 - 64) / 64, t = hh / (c + v * CAM.b * s), Y = CAM.cy + dy + t * (s - v * CAM.b * c);
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - 32) / 32;
      const X = t * u * CAM.a - CAM.x0 + dx;
      const q = y * W + x;
      S.th0[q] = sqrt(X * X + Y * Y);
      S.ps0[q] = atan2(X, Y);
      S.isp[q] = (t * CAM.a) / 32; // degrees per LED, across
    }
  }
}

function vn1(S, x) {
  const i = floor(x), f = x - i, w = f * f * (3 - 2 * f);
  const a = S.n1[i & 255];
  return a + (S.n1[(i + 1) & 255] - a) * w;
}
function vn3(S, x, y, z) {
  const ix = floor(x), iy = floor(y), iz = floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const n = S.n3;
  const x0 = ix & 31, x1 = (ix + 1) & 31, y0 = (iy & 31) << 5, y1 = ((iy + 1) & 31) << 5, z0 = (iz & 31) << 10, z1 = ((iz + 1) & 31) << 10;
  const a = n[x0 + y0 + z0] + (n[x1 + y0 + z0] - n[x0 + y0 + z0]) * fx;
  const b = n[x0 + y1 + z0] + (n[x1 + y1 + z0] - n[x0 + y1 + z0]) * fx;
  const c = n[x0 + y0 + z1] + (n[x1 + y0 + z1] - n[x0 + y0 + z1]) * fx;
  const d = n[x0 + y1 + z1] + (n[x1 + y1 + z1] - n[x0 + y1 + z1]) * fx;
  const e = a + (b - a) * fy, f = c + (d - c) * fy;
  return e + (f - e) * fz;
}

// a new substorm
function newCycle(S, first) {
  const D = S.D;
  S.Dg = (30 + 55 * rnd()) * (1.3 - 0.75 * D);
  let str = (0.22 + 1.0 * D) * exp(0.75 * randn());
  if (first) str = 0.55 + 0.8 * D * (0.8 + 0.4 * rnd());
  S.str = cl(str, 0.15, 1.9);
  S.pseudo = S.str < 0.5;
  S.phi0 = (rnd() - 0.45) * 1.3;
  S.Dx = S.pseudo ? 7 + 6 * rnd() : 16 + 20 * S.str + 10 * rnd();
  S.Dr = S.pseudo ? 14 + 12 * rnd() : (40 + 50 * rnd()) * (1.2 - 0.6 * D);
  if (S.pseudo) S.Dg *= 0.5;
  S.ww = 0.25 + 0.55 * S.str;
  S.we = 0.1 + 0.3 * S.str;
  S.dmax = min(10, 1.3 + 6.4 * S.str);
  S.tauw = S.Dx / 3;
  S.nO = 9 + floor(rnd() * 6);
  S.omPh = rnd() * TWO_PI;
  S.omV = 0.03 + 0.05 * rnd();
}

function spawn(S, ageFrac) {
  const a0 = (rnd() - 0.5) * 0.9, life = 24 + 14 * rnd();
  S.pc.push({ ux: sin(a0), uy: -cos(a0), a: 0, age: ageFrac * life, life, v: 0.7 + 0.5 * rnd(), amp: 0.3 + 0.5 * rnd() * (0.3 + S.D), sp: 3.5 + 3.5 * rnd(), sr: 0.9 + 0.5 * rnd(), hue: rnd() });
}

function step(S, de) {
  S.te += de;
  S.tp += de;
  const D = S.D;
  const e = (tau) => 1 - exp(-de / tau);
  if (S.phase === 0) {
    const g = ss(0, 1, S.tp / S.Dg);
    S.gro += (0.3 + 0.7 * g - S.gro) * e(4);
    S.sprd += (0.8 + 0.15 * g - S.sprd) * e(6);
    S.Bu += (0 - S.Bu) * e(5);
    S.dif += (0.75 - S.dif) * e(8);
    S.om += (0 - S.om) * e(8);
    S.act += (1.05 + 0.15 * g - S.act) * e(6);
    S.kh += (0.25 + 0.35 * g - S.kh) * e(6);
    S.hd += (0 - S.hd) * e(2.5);
    if (S.tp > S.Dg) {
      S.phase = 1;
      S.tp = 0;
      S.eon = 1;
      S.pw = S.phi0;
      S.pe = S.phi0;
      S.Bu *= 0.3;
    }
  } else if (S.phase === 1) {
    S.gro += (1 - S.gro) * e(4);
    S.sprd += (1 - S.sprd) * e(5);
    const bt = S.pseudo ? 0.42 : 1;
    S.Bu += (bt - S.Bu) * e(S.Dx / 2.8);
    S.dif += (0.45 - S.dif) * e(10);
    S.om += (0 - S.om) * e(6);
    S.act += (1.15 + 0.1 * S.str - S.act) * e(3);
    S.kh += (1 - S.kh) * e(4);
    S.hd += ((S.pseudo ? 0.5 : 1) - S.hd) * e(3);
    S.pw = S.phi0 + S.ww * (1 - exp(-S.tp / S.tauw));
    S.pe = S.phi0 - S.we * (1 - exp(-S.tp / (1.5 * S.tauw)));
    if (S.tp > S.Dx) {
      S.phase = 2;
      S.tp = 0;
    }
  } else {
    S.gro += (0.4 - S.gro) * e(25);
    S.sprd += (0.85 - S.sprd) * e(25);
    S.Bu += (0 - S.Bu) * e(S.Dr / 2.5);
    S.dif += (1 - S.dif) * e(12);
    const omT = ss(0.7, 0.0, S.tp / S.Dr) * ss(0, 0.15, S.tp / S.Dr) * (S.pseudo ? 0.2 : 1);
    S.om += (omT - S.om) * e(5);
    S.act += (1.0 - S.act) * e(15);
    S.kh += (0.5 - S.kh) * e(10);
    S.hd += (0 - S.hd) * e(8);
    S.pw += 0.01 * de;
    if (S.tp > S.Dr) {
      newCycle(S, false);
      S.phase = 0;
      S.tp = 0;
    }
  }
  S.eon += (0 - S.eon) * e(5);
  S.omPh += S.omV * de;
  // poleward moving forms: arc segments born at the cusp that run antisunward over the cap, oftener when the field is south
  S.pcNext -= de;
  if (S.pcNext <= 0) {
    S.pcNext = (3 + 7 * rnd()) * (1.7 - 1.3 * D);
    if (S.pc.length < 7) spawn(S, 0);
  }
  for (let i = S.pc.length - 1; i >= 0; i--) {
    const p = S.pc[i];
    p.age += de;
    p.a = p.amp * Math.pow(sin(PI * cl(p.age / p.life, 0, 1)), 1.2);
    if (p.age > p.life) S.pc.splice(i, 1);
  }
}

// tables over magnetic local time phi (radians from midnight, plus toward dusk)
function tables(S, s4) {
  const D = S.D;
  const R = 14 + 4.2 * D + 3.4 * S.gro + 3 * (vn1(S, S.tr * 0.07 + 5) - 0.5), DL = 5.0;
  S.R = R;
  const te = S.te;
  const DB = S.dmax * S.Bu;
  const pw = S.pw, pe = S.pe, span = max(0.05, pw - pe);
  const hdPh = pe + 0.88 * span;
  S.hPh = hdPh;
  const sp0 = 0.55 + 0.45 * S.sprd;
  const khA = S.kh * s4 * s4 * 1.2;
  const omA = S.om * (0.5 + 0.5 * s4) * 4.6;
  const w1 = TWO_PI * 0.1, w2 = TWO_PI * 0.06;
  const bulge = S.Bu > 0.002;
  const asym = 0.12 + 0.4 * (vn1(S, te * 0.02 + 9) - 0.5);
  for (let j = 0; j <= NPHI; j++) {
    const ph = -PI + (j * TWO_PI) / NPHI;
    const cph = cos(ph), sph = sin(ph);
    const nw = 0.5 + 0.5 * cph;
    const ov = DL * cph + sqrt(R * R - DL * DL * sph * sph);
    S.OV[j] = ov;
    S.NW[j] = nw;
    // the bulge: a bell from the east edge to the west edge with a steeper west flank
    let gb = 0, prof = 0;
    if (bulge) {
      const s = (ph - pe) / span;
      if (s > 0 && s < 1) {
        prof = Math.pow(s, 0.8) * (1 - ss(0.74, 1, s));
        gb = Math.pow(sin(PI * s), 0.9);
      }
    }
    S.GB[j] = gb;
    const dB = DB * prof;
    // omega bands: poleward bulges on the morning side, pinched at the base
    const og = ss(-1.9, -1.0, ph) * (1 - ss(-0.4, 0.1, ph));
    let om = 0, dph = 0;
    if (S.om > 0.01) {
      const arg = S.nO * ph + S.omPh * 4;
      const sn = 0.5 + 0.5 * sin(arg);
      om = og * omA * sn * sn * sn;
      dph = og * S.om * 0.045 * (0.4 + 0.6 * s4) * cos(arg);
    }
    S.DPH[j] = dph;
    const spr = (1.1 + 5.2 * Math.pow(nw, 1.3)) * sp0 * (0.75 + 0.3 * s4);
    const gate = 0.3 + 0.7 * nw;
    const gOn = exp(-((ph - S.phi0) * (ph - S.phi0)) / (2 * 0.13 * 0.13));
    const dawn = 1 - 0.6 * ss(0.2, 1.7, -ph);
    const night = (0.02 + 0.13 * Math.pow(D, 1.2) + (0.98 - 0.13 * Math.pow(D, 1.2)) * Math.pow(nw, 1.9)) * dawn * (1 + asym * sph);
    const ab = (0.02 + 0.45 * (s4 - 0.3)) * (0.45 + 0.55 * nw);
    for (let k = 0; k < NA; k++) {
      // KH-like travelling folds, each arc a different phase
      const lag = 0.14 * k;
      const x1 = 11 * ph - w1 * te + S.seedPh[0] + lag;
      const x2 = 27 * ph - w2 * te * 2.6 + S.seedPh[1] + 1.3 * lag;
      const x3 = 51 * ph - w1 * te * 4.1 + S.seedPh[2] + 0.7 * lag;
      const wv = sin(x1) + 0.38 * sin(2 * x1 - 0.9) + 0.45 * sin(x2) + 0.2 * sin(x3);
      const kh = khA * (0.3 + 0.8 * gb + 0.5 * og) * gate * (0.7 + 0.15 * k) * wv * 0.42;
      const jit = (vn1(S, ph * 3.1 + 23 * k + te * 0.025) - 0.5) * (0.5 + 1.8 * gb) * (k > 0 ? 1 : 0.3);
      S.CK[k][j] = ov - spr * PK[k] - dB * FAN[k] - om * (0.4 + 0.6 * FAN[k]) - kh - jit;
      // intensity: arcs break up along the oval, most away from midnight
      const pres = k === 0 ? 1 : ss(0.12 * k + 0.05, 0.12 * k + 0.5, S.sprd);
      const base = B0[k] * (0.35 + 1.3 * vn1(S, te * 0.045 + 17 * k + S.seedPh[3]));
      const gk = ss(0.2, 0.6, 0.6 * vn1(S, ph * 2.3 + 31 * k + te * 0.012) + 0.4 * vn1(S, ph * 5.5 + 17 * k + te * 0.02));
      const brk = 1 - (1 - gk) * (1 - 0.6 * nw * nw);
      let I = base * pres * night * S.act * brk * (0.4 + 1.2 * vn1(S, ph * 1.9 + 7 * k + S.tr * 0.16));
      I *= 1 + S.Bu * gb * (0.25 + 0.9 * (k / 4) * (k / 4));
      I *= 1 + 1.8 * S.eon * gOn * (k < 2 ? 1 : 0.35);
      I *= 1 + 0.6 * om;
      // beads along the arc; in the bulge every arc has the same phase, so they line up into rays
      const bd = vn1(S, ph * (8 + 6 * s4) + 40 * k * (1 - 0.75 * gb) - te * BV[k]);
      const ab2 = min(0.85, ab * (1 + 0.6 * gb));
      I *= 1 - ab2 + 2 * ab2 * bd;
      S.IK[k][j] = I;
    }
    S.FRN[j] = S.CK[NA - 1][j];
  }
  const ij = floor(((hdPh + PI) * NPHI) / TWO_PI);
  S.hTh = S.CK[3][cl(ij, 0, NPHI)];
  S.hL = S.OV[cl(ij, 0, NPHI)];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  const first = !S.ready;
  if (first) {
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    S.D = cl((kn[2] + 1) / 2, 0, 1);
    S.ready = true;
    // the opening: a substorm already expanding, got to by a run of the state at the open knobs
    newCycle(S, true);
    S.phase = 1;
    S.tp = 0;
    S.eon = 1;
    S.pw = S.phi0;
    S.pe = S.phi0;
    S.gro = 1;
    S.sprd = 0.95;
    S.Bu = 0;
    S.hd = 0.2;
    S.te = 100 * rnd();
    for (let i = 0; i < 4; i++) spawn(S, rnd() * 0.8);
    for (let i = 0; i < 52; i++) step(S, 0.25);
  }
  const e = 1 - exp(-d / 0.4);
  for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * e;
  S.D = cl((S.ks[2] + 1) / 2, 0, 1);
  step(S, d * cl(S.ks[1], 0.6, 4));
  S.tr += d;
  const tr = S.tr, rp = S.rotPh;
  const sw = (w, p, a) => a * (sin(w * tr + 1.6 * sin(0.037 * tr + p * 1.7) + p) - sin(1.6 * sin(p * 1.7) + p)); // a slow swing, frequency-modulated so it never returns; zero at the start
  S.rot = -(ROT0 + sw(0.13, rp[0], 0.3) + sw(0.19, rp[1], 0.15));
  aim(S, sw(0.16, rp[0] * 2, 2.6) + sw(0.1, rp[1] * 3, 1.4), sw(0.14, rp[0] * 5, 1.6), sw(0.11, rp[1] * 7, 0.05));
  render(S);
}

// the Hue knob's gains on green, red and violet
function gains(S, hue) {
  const bump = (x) => {
    x -= floor(x + 0.5);
    return max(0, 1 - 3 * abs(x));
  };
  S.gk[0] = 0.14 + 0.86 * bump(hue);
  S.gk[1] = 0.28 + 0.72 * bump(hue - 1 / 3);
  S.gk[2] = 0.14 + 0.86 * bump(hue - 2 / 3);
}

function render(S) {
  const s4 = 0.5 + 1.1 * S.ks[3];
  gains(S, S.ks[0]);
  tables(S, s4);
  const te0 = S.tr;
  const wd = (c, f, a) => exp(a * (vn1(S, te0 * f + c) - vn1(S, c))); // colour wander, neutral at the start
  const kG = S.gk[0] * wd(3.3, 0.03, 1.3), kR = S.gk[1] * wd(71.1, 0.025, 1.6), kV = S.gk[2] * wd(133.7, 0.028, 1.6), kP = 0.8;
  const img = S.img, bg = S.bg, em = S.em, OV = S.OV, NW = S.NW, DPH = S.DPH;
  const CK = S.CK, IK = S.IK;
  const th0 = S.th0, ps0 = S.ps0, isp = S.isp;
  const rot = S.rot, te = S.te;
  const R = S.R, zf = cl(1 - 0.018 * (R - 17.5), 0.9, 1.08);
  const dif = S.dif, depth = 0.3 + 0.7 * (s4 / 1.6);
  const hd = S.hd, hPh = S.hPh, hTh = S.hTh, hL = S.hL;
  const kap = min(2.3, 2.8 * hd * (0.1 + 0.8 * s4));
  const sg = 3.1, sg2 = 2 * sg * sg, sgx = 3.2 * sg;
  const dfa = 0.36;
  const cuspI = 0.2 + 0.2 * S.D;
  const cuspY = OV[0] - 0.8;
  const k4 = NPHI / TWO_PI;
  const pcs = S.pc, npc = pcs.length;
  for (let q = 0; q < NP; q++) {
    let th = th0[q] * zf;
    let ph = ps0[q] - rot - PI;
    ph -= TWO_PI * floor((ph + PI) / TWO_PI);
    let r = 0, g = 0, b = 0;
    // the head's blob and hook: the sampling plane turns round it
    if (hd > 0.03) {
      let dp = ph - hPh;
      dp -= TWO_PI * floor((dp + PI) / TWO_PI);
      const dx = dp * hL, dy = th - hTh;
      const r2 = dx * dx + dy * dy;
      if (r2 < sgx * sgx) {
        const hg = hd * 0.8 * exp(-r2 / (2 * 1.25 * 1.25));
        r += hg * (kG * 0.45 + kP * 0.25 + kV * 0.2);
        g += hg * (kG * 0.95 + kV * 0.2);
        b += hg * (kG * 0.5 + kP * 0.2 + kV * 0.6);
        const a = kap * exp(-r2 / sg2), ca = cos(a), sa = sin(a);
        const nx = dx * ca - dy * sa, ny = dx * sa + dy * ca;
        ph = hPh + nx / hL;
        th = hTh + ny;
      }
    }
    let jf = (ph + PI) * k4;
    let j0 = floor(jf);
    j0 = ((j0 % NPHI) + NPHI) % NPHI;
    let fr = jf - floor(jf);
    // omega bands shift the arcs sideways
    const dsh = (DPH[j0] + (DPH[j0 + 1] - DPH[j0]) * fr) * k4;
    if (dsh !== 0) {
      jf += dsh;
      j0 = ((floor(jf) % NPHI) + NPHI) % NPHI;
      fr = jf - floor(jf);
    }
    const j1 = j0 + 1;
    const ov = OV[j0] + (OV[j1] - OV[j0]) * fr;
    const e = th - ov;
    if (e > -15 && e < 10) {
      const ips = isp[q];
      const se0 = max(0.3, 0.95 * ips) * (1.4 - 0.45 * s4);
      for (let k = 0; k < NA; k++) {
        const c = CK[k][j0] + (CK[k][j1] - CK[k][j0]) * fr;
        const d = th - c;
        const wp = max(WP[k], 1.4 * ips);
        if (d < -4.5 * wp || d > 3.4 * se0) continue;
        const I = IK[k][j0] + (IK[k][j1] - IK[k][j0]) * fr;
        const f = d >= 0 ? exp(-0.5 * (d / se0) * (d / se0)) : exp(d / wp);
        const em = I * f;
        const hk = HK[k];
        const pk = hk * ss(-0.35, 0.45, d);
        const vk = 0.6 * hk * ss(1.0, 2.2, I);
            const tail = d < 0 ? 1 - exp(d / (1.6 * wp)) : 0;
        const rk = RS[k] * (0.5 + 0.5 * tail);
        const gk = GS[k] * (1 - 0.55 * pk);
        r += em * (kG * gk * 0.16 + kP * pk + kR * rk * 0.95 + kV * vk * 0.42);
        g += em * (kG * gk + kP * pk * 0.16 + kR * rk * 0.07 + kV * vk * 0.14);
        b += em * (kG * gk * 0.3 + kP * pk * 0.5 + kR * rk * 0.07 + kV * vk);
      }
      // the bulge is a lit mass: filled from a sharp poleward front down to the old arc
      if (S.Bu > 0.02) {
        const gbj = S.GB[j0] + (S.GB[j1] - S.GB[j0]) * fr;
        if (gbj > 0.02) {
          const fn = S.FRN[j0] + (S.FRN[j1] - S.FRN[j0]) * fr - 1.6 * (vn1(S, ph * (9 + 5 * s4) - te * 0.35) - 0.5);
          const fl = S.Bu * gbj * 0.1 * (0.8 + (0.3 + 0.55 * s4) * (vn1(S, ph * (11 + 7 * s4) - te * 0.5) - 0.5) * 2) * ss(fn - 1.8, fn + 1.4, th) * (1 - ss(ov, ov + 2.0, th));
          r += fl * (kG * 0.2 + kR * 0.5 + kV * 0.15);
          g += fl * (kG * 0.9 + kR * 0.1 + kV * 0.2);
          b += fl * (kG * 0.3 + kR * 0.1 + kV * 0.5);
        }
      }
      // diffuse aurora and its blinking patches, equatorward of the discrete arcs
      if (dif > 0.02 && e > -3.5 && e < 6) {
        const nw = NW[j0] + (NW[j1] - NW[j0]) * fr;
        const dg = (0.2 + 0.8 * ss(-2.6, -1.2, ph) * (1 - ss(0.3, 1.1, ph))) * (0.2 + 0.8 * nw);
        const prof = ss(-3.5, -0.5, e) * (1 - ss(1.8, 4.6, e));
        if (dg > 0.01 && prof > 0.001) {
          const px = ph / 0.3, py = th / 2.3;
          let mx = 0;
          for (let L = 0; L < 3; L++) {
            const mask = ss(0.44, 0.7, vn3(S, px + 7 * L, py + 11 * L, te * 0.015 + L));
            if (mask < 0.01) continue;
            const phase = TWO_PI * (te / PERIODS[L] + 1.0 * vn3(S, ph / 0.5 + 3 * L, th / 6, 40 + L));
            const bl = ss(0.15, 0.85, 0.5 + 0.5 * sin(phase));
            const v = mask * (1 - depth * (1 - bl));
            if (v > mx) mx = v;
          }
          const soft = 0.25 * ss(0.3, 0.7, vn3(S, px * 0.5 + 21, py * 0.5 + 5, te * 0.01));
          const dv = dif * dfa * dg * prof * (mx + soft);
          r += dv * (kG * 0.12 + kR * 0.35 + kV * 0.3);
          g += dv * (kG * 0.85 + kR * 0.15 + kV * 0.35);
          b += dv * (kG * 0.3 + kR * 0.1 + kV * 0.7);
        }
      }
    }
    // inside the oval: poleward moving forms, crescents growing out of the cusp
    if (th < 26 && npc > 0) {
      const dx = -th * sin(ph), dy = -th * cos(ph) - cuspY;
      for (let n = 0; n < npc; n++) {
        const p = pcs[n];
        const along = dx * p.ux + dy * p.uy, perp = -dx * p.uy + dy * p.ux;
        const ac = 1.5 + p.v * p.age - perp * perp / (2 * (4 + p.v * p.age));
        const u = (along - ac) / p.sr, w = perp / p.sp;
        const q2 = u * u + w * w;
        if (q2 > 12) continue;
        const v = p.a * exp(-0.5 * q2);
        const wr = 0.3 + 0.7 * p.hue;
        r += v * (kR * 0.95 * wr * wr + kG * 0.3 * (1 - wr) + kV * 0.25);
        g += v * (kR * 0.12 * wr + kG * 0.95 * (1 - wr) + kV * 0.2);
        b += v * (kV * 0.5 + kG * 0.35 * (1 - wr) + 0.05);
      }
    }
    // cusp at noon
    {
      let dp = ph - PI;
      dp -= TWO_PI * floor((dp + PI) / TWO_PI);
      const dx = dp * OV[0] * 0.9;
      const dy = th - (OV[0] - 0.8);
      const c2 = dx * dx * 0.5 + dy * dy;
      if (c2 < 30) {
        const cu = cuspI * exp(-c2 / (2 * 2.0 * 2.0)) * (0.8 + 0.2 * sin(te * 0.21 + S.seedPh[0]));
        r += cu * (kR * 0.9 + kG * 0.2);
        g += cu * (kR * 0.07 + kG * 0.3);
        b += cu * 0.1;
      }
    }
    const o = q * 3;
    em[o] = r;
    em[o + 1] = g;
    em[o + 2] = b;
  }
  // the glow: a blurred copy of the light
  const lo = S.lo, lo2 = S.lo2;
  lo.fill(0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, c = ((y >> 2) * GW + (x >> 2)) * 3;
      lo[c] += em[o];
      lo[c + 1] += em[o + 1];
      lo[c + 2] += em[o + 2];
    }
  for (let n = 0; n < 4; n++) {
    const a = n & 1 ? lo2 : lo, o2 = n & 1 ? lo : lo2, ax = n & 1;
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW; x++) {
        const i0 = (max(0, y - ax) * GW + max(0, x - 1 + ax)) * 3, i1 = (y * GW + x) * 3, i2 = (min(GH - 1, y + ax) * GW + min(GW - 1, x + 1 - ax)) * 3;
        for (let c = 0; c < 3; c++) o2[i1 + c] = (a[i0 + c] + 2 * a[i1 + c] + a[i2 + c]) * 0.25;
      }
  }
  const glow = 0.2 + 0.08 * S.D;
  for (let y = 0; y < H; y++) {
    const gy = cl((y - 1.5) / 4, 0, GH - 1.001), y0 = floor(gy), fy = gy - y0;
    for (let x = 0; x < W; x++) {
      const gx = cl((x - 1.5) / 4, 0, GW - 1.001), x0 = floor(gx), fx = gx - x0;
      const o = (y * W + x) * 3;
      const c00 = (y0 * GW + x0) * 3, c10 = c00 + 3, c01 = c00 + GW * 3, c11 = c01 + 3;
      for (let c = 0; c < 3; c++) {
        const gl = ((lo[c00 + c] * (1 - fx) + lo[c10 + c] * fx) * (1 - fy) + (lo[c01 + c] * (1 - fx) + lo[c11 + c] * fx) * fy) * glow * 0.0625;
        const v = em[o + c] + gl * (c === 1 ? 1 : 0.8);
        const tm = TM[min(1024, (v * 256) | 0)];
        img[o + c] = 255 * (tm + bg[o + c] * (1 - tm)) + (BAYER[((y & 3) << 2) + (x & 3)] + 0.5) / 16;
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const img = S.img;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, img[o], img[o + 1], img[o + 2]);
    }
}
