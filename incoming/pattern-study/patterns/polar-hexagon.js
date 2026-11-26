// ===== Patternflow pattern =====
// Title:   Polar Hexagon
// Family:  polarhexagon
// Idea:    Looking straight down on the pole of a giant gas planet, a six-sided jet stream of ochre and gold cloud races round a slowly turning hexagon whose straight edges and sharp corners stay put, with a deep teal spiral cyclone and a dark eye inside, banded counter-moving dusk cloud outside, and small eddies that are born at the corners and wander off along the bands.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: placeholder
// Round:   259
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Jet=0.4..4, Sides=-3..2, Spin=-1..1
//
// Knob 1: placeholder
// Knob 2: placeholder
// Knob 3: placeholder
// Knob 4: placeholder

const W = 64, H = 128, NP = W * H;
const { sin, cos, sqrt, exp, atan2, abs, floor, max, min, PI, log } = Math;
const TWO_PI = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sst = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const CX0 = 32, CY0 = 64; // panel centre, the pole sits here before it drifts

// ---- the cloud textures: a ring of TW columns round the pole by TH rows out from it, TEXU LEDs a row
const TW = 256, TH = 120, TEXU = 0.8, UMAX = TH * TEXU;
const OCTS = [
  { m: 6, l: 9, a: 0.55 },
  { m: 14, l: 5.2, a: 0.7 },
  { m: 30, l: 3.2, a: 0.8 },
  { m: 18, l: 2.8, a: 0.8 },
  { m: 64, l: 3.2, a: 0.6 },
];
function prepOct(O) {
  const M = O.m, NR = Math.ceil(UMAX / O.l) + 3;
  O.lat = new Float32Array(M * NR);
  O.colI0 = new Int32Array(TW); O.colI1 = new Int32Array(TW); O.colF = new Float32Array(TW);
  for (let i = 0; i < TW; i++) {
    const x = ((i + 0.5) / TW) * M, i0 = floor(x), f = x - i0;
    O.colI0[i] = i0 % M; O.colI1[i] = (i0 + 1) % M; O.colF[i] = f * f * (3 - 2 * f);
  }
  O.rowJ0 = new Int32Array(TH); O.rowF = new Float32Array(TH); O.rowA = new Float32Array(TH);
  for (let j = 0; j < TH; j++) {
    const E = (j + 0.5) * TEXU, y = E / O.l, j0 = floor(y), f = y - j0;
    O.rowJ0[j] = j0; O.rowF[j] = f * f * (3 - 2 * f);
    O.rowA[j] = O.a * sst(ARC_FADE_LO, ARC_FADE_HI, (TWO_PI * E) / M);
  }
  return O;
}
const ARC_FADE_LO = 2.2, ARC_FADE_HI = 4.2; // an octave fades out where one of its cells is less than this many LEDs round the ring
for (const O of OCTS) prepOct(O);
const WARP_ALONG = 10, WARP_ACROSS = 4.5, TEX_GAIN = 1.9, TEX_KNEE = 0.5; // the warp in LEDs round the ring and out from the pole, and the tone curve of a cloud
const WARP = [prepOct({ m: 9, l: 13, a: 1 }), prepOct({ m: 11, l: 12, a: 1 })];

// ---- the polygon: apothem in LEDs for 3 to 8 sides
const APO = [0, 0, 0, 20.5, 26.9, 28.7, 29.0, 29.5, 29.8];

// ---- the flow tables, indexed by level E at DE LEDs a step
const NT = 480, DE = 0.25;
const RND0 = 3, RND1 = 30; // the polygon's contours round into circles between this many LEDs and this many outside the jet
const JET_W = 4.0; // where the jet's speed has fallen to 1/e, LEDs: a flat top with steep sides, so the shear sits in a thin line at each edge

function makeState() {
  const S = {
    ready: false, t: 0, kn: [0, 2, 0, 0.06], sk: [0, 2, 0, 0.06],
    cx: 0, cy: 0, ex: 0, ey: 0, rot: 0, armPh: 0, bandPh: [0, 0, 0, 0, 0, 0, 0, 0], ph0: new Float64Array(8),
    ph: [0, 0, 0], Tc: 3, tex: [new Float32Array(TW * TH), new Float32Array(TW * TH), new Float32Array(TW * TH)],
    amix: 30, rin0: 9, rin1: 28, qin: 1, n0: 6, n1: 6, f: 0, nv: 6,
    c0: new Float64Array(8), s0: new Float64Array(8), c1: new Float64Array(8), s1: new Float64Array(8),
    Eb: new Float32Array(NP), Thb: new Float32Array(NP), Ts: new Float32Array(NP), Es: new Float32Array(NP),
    Xw: new Float32Array(NP), Yw: new Float32Array(NP), stamp: new Int32Array(NP), list: new Int32Array(NP), stampId: 0,
    OM: new Float32Array(NT + 2), WND: new Float32Array(NT + 2), VIN: new Float32Array(NT + 2),
    ZT: new Float32Array((NT + 2) * 8), // per level: jet weight, in/out split, band value, band warmth, rim, wall, spare, spare
    eddies: [], storm: null, stormWait: 30,
    rgb: new Uint8ClampedArray(NP * 3), hueAt: -1,
    ramps: [new Float32Array(256 * 3), new Float32Array(256 * 3), new Float32Array(256 * 3), new Float32Array(256 * 3)],
    hot: new Float32Array(9),
    U: 11, W0: 0.65, tsf: 1, omegaH: 0,
  };
  S.rowGain = new Float32Array(TH);
  for (let j = 0; j < TH; j++) {
    let v = 0;
    for (const O of OCTS) v += O.rowA[j] * O.rowA[j];
    S.rowGain[j] = 1 / sqrt(max(v, 0.04));
  }
  S.colsPerLed = new Float32Array(TH);
  for (let j = 0; j < TH; j++) S.colsPerLed[j] = TW / (TWO_PI * max((j + 0.5) * TEXU, 5));
  S.base = new Float32Array(TW * TH);
  S.wx = new Float32Array(TW * TH);
  S.wy = new Float32Array(TW * TH);
  return S;
}

export function setup(params) {
  params.s = makeState();
}

// ---- texture
function noiseInto(O, dst, gain, add) {
  const lat = O.lat, M = O.m;
  for (let k = 0; k < lat.length; k++) lat[k] = Math.random() * 2 - 1;
  for (let j = 0; j < TH; j++) {
    const a = gain ? O.rowA[j] * gain[j] : 1;
    const row = j * TW;
    if (a < 0.002) { if (!add) for (let i = 0; i < TW; i++) dst[row + i] = 0; continue; }
    const b0 = O.rowJ0[j] * M, b1 = b0 + M, fy = O.rowF[j];
    for (let i = 0; i < TW; i++) {
      const i0 = O.colI0[i], i1 = O.colI1[i], fx = O.colF[i];
      const v0 = lat[b0 + i0] + (lat[b0 + i1] - lat[b0 + i0]) * fx;
      const v1 = lat[b1 + i0] + (lat[b1 + i1] - lat[b1 + i0]) * fx;
      const v = a * (v0 + (v1 - v0) * fy);
      if (add) dst[row + i] += v; else dst[row + i] = v;
    }
  }
}

function buildTex(S, tex) {
  const base = S.base, wx = S.wx, wy = S.wy;
  base.fill(0);
  for (const O of OCTS) noiseInto(O, base, S.rowGain, true);
  noiseInto(WARP[0], wx, null, false);
  noiseInto(WARP[1], wy, null, false);
  const cpl = S.colsPerLed;
  for (let j = 0; j < TH; j++) {
    const row = j * TW, ca = WARP_ALONG * cpl[j], cr = WARP_ACROSS / TEXU;
    for (let i = 0; i < TW; i++) {
      let fi = i + wx[row + i] * ca, fj = j + wy[row + i] * cr;
      fi -= TW * floor(fi / TW);
      fj = fj < 0 ? 0 : fj > TH - 1.001 ? TH - 1.001 : fj;
      const i0 = fi | 0, fx = fi - i0, i1 = i0 + 1 >= TW ? 0 : i0 + 1, j0 = fj | 0, fy = fj - j0, r0 = j0 * TW, r1 = r0 + TW;
      const v0 = base[r0 + i0] + (base[r0 + i1] - base[r0 + i0]) * fx;
      const v1 = base[r1 + i0] + (base[r1 + i1] - base[r1 + i0]) * fx;
      const x = (v0 + (v1 - v0) * fy) * TEX_GAIN;
      tex[row + i] = x / (1 + TEX_KNEE * abs(x));
    }
  }
}

// ---- palette: five planets round the Hue knob, each with a ramp for the jet, the cyclone, and the warm and cool bands outside
const KEYS = [
  { // Saturn: gold jet, teal cyclone, slate and tan bands
    jet: [[0, 140, 78, 20], [0.3, 192, 118, 30], [0.55, 232, 168, 56], [0.8, 250, 210, 120], [1, 255, 244, 206]],
    inn: [[0, 6, 28, 44], [0.25, 12, 54, 80], [0.5, 28, 94, 116], [0.75, 76, 144, 156], [1, 170, 208, 204]],
    warm: [[0, 50, 46, 60], [0.35, 86, 80, 90], [0.6, 130, 112, 96], [0.85, 176, 148, 106], [1, 218, 190, 146]],
    cool: [[0, 30, 44, 64], [0.5, 62, 84, 108], [1, 128, 150, 164]],
    eye: [3, 10, 20], storm: [255, 238, 205],
  },
  { // ice giant: pale cyan jet, cobalt cyclone, blue-grey bands with white wisps
    jet: [[0, 30, 90, 140], [0.3, 60, 150, 190], [0.55, 120, 205, 220], [0.8, 200, 240, 240], [1, 245, 252, 250]],
    inn: [[0, 6, 14, 52], [0.3, 14, 34, 100], [0.55, 30, 66, 150], [0.8, 80, 120, 190], [1, 170, 190, 232]],
    warm: [[0, 30, 50, 80], [0.4, 60, 100, 130], [0.7, 110, 160, 170], [1, 190, 220, 215]],
    cool: [[0, 20, 28, 70], [0.5, 44, 64, 120], [1, 100, 130, 180]],
    eye: [2, 6, 26], storm: [235, 250, 255],
  },
  { // rust: red jet, maroon cyclone, cream and mauve bands
    jet: [[0, 110, 30, 16], [0.3, 180, 60, 30], [0.55, 224, 110, 60], [0.8, 245, 180, 120], [1, 255, 235, 200]],
    inn: [[0, 34, 10, 14], [0.3, 70, 26, 28], [0.55, 118, 52, 44], [0.8, 170, 100, 74], [1, 225, 170, 132]],
    warm: [[0, 70, 46, 40], [0.4, 130, 92, 70], [0.7, 190, 150, 110], [1, 236, 210, 170]],
    cool: [[0, 52, 40, 52], [0.5, 96, 80, 94], [1, 160, 140, 152]],
    eye: [14, 4, 6], storm: [255, 226, 190],
  },
  { // sulphur: lemon jet, olive cyclone, honey and green-grey bands
    jet: [[0, 120, 100, 20], [0.3, 190, 165, 40], [0.55, 235, 215, 80], [0.8, 248, 238, 150], [1, 255, 252, 215]],
    inn: [[0, 16, 24, 10], [0.3, 40, 58, 18], [0.55, 80, 102, 30], [0.8, 140, 152, 60], [1, 205, 208, 120]],
    warm: [[0, 50, 42, 22], [0.4, 100, 84, 40], [0.7, 160, 134, 66], [1, 220, 196, 120]],
    cool: [[0, 30, 38, 34], [0.5, 64, 78, 66], [1, 120, 136, 118]],
    eye: [6, 10, 4], storm: [255, 250, 215],
  },
  { // rose: pink jet, violet cyclone, mauve bands
    jet: [[0, 120, 40, 70], [0.3, 190, 70, 100], [0.55, 235, 120, 130], [0.8, 250, 190, 180], [1, 255, 236, 226]],
    inn: [[0, 14, 8, 42], [0.3, 34, 20, 88], [0.55, 64, 40, 142], [0.8, 120, 90, 188], [1, 202, 182, 232]],
    warm: [[0, 54, 36, 60], [0.4, 100, 70, 100], [0.7, 160, 116, 130], [1, 226, 190, 190]],
    cool: [[0, 28, 30, 62], [0.5, 56, 60, 110], [1, 110, 120, 170]],
    eye: [10, 4, 22], storm: [255, 230, 236],
  },
];

function bakeRamp(ramp) {
  const out = new Float32Array(256 * 3);
  let k = 0;
  for (let n = 0; n < 256; n++) {
    const f = n / 255;
    while (k < ramp.length - 2 && f > ramp[k + 1][0]) k++;
    const a = ramp[k], b = ramp[k + 1], t = cl((f - a[0]) / (b[0] - a[0]), 0, 1);
    for (let c = 0; c < 3; c++) out[n * 3 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * t;
  }
  return out;
}

const BAKED = KEYS.map((k) => ({ jet: bakeRamp(k.jet), inn: bakeRamp(k.inn), warm: bakeRamp(k.warm), cool: bakeRamp(k.cool), eye: k.eye, storm: k.storm }));

function setHue(S, hue) {
  if (S.hueAt === hue) return;
  S.hueAt = hue;
  const x = cl(hue, 0, 1) * KEYS.length, k0 = floor(x) % KEYS.length, k1 = (k0 + 1) % KEYS.length;
  const u = sst(0.22, 0.78, x - floor(x)), A = BAKED[k0], B = BAKED[k1];
  const names = ['jet', 'inn', 'warm', 'cool'];
  for (let q = 0; q < 4; q++) {
    const a = A[names[q]], b = B[names[q]], o = S.ramps[q];
    for (let n = 0; n < 768; n++) o[n] = a[n] + (b[n] - a[n]) * u;
  }
  for (let c = 0; c < 3; c++) {
    S.hot[c] = A.eye[c] + (B.eye[c] - A.eye[c]) * u;
    S.hot[3 + c] = A.storm[c] + (B.storm[c] - A.storm[c]) * u;
  }
}

// ---- the polygon of this frame
function setPolygon(S) {
  const Ns = cl(6 + S.kn[2], 3, 8);
  let n0 = floor(Ns);
  const fr = Ns - n0;
  const n1 = min(8, n0 + 1);
  if (n0 >= 8) n0 = 8;
  S.n0 = n0;
  S.n1 = n1;
  S.f = n0 >= 8 ? 0 : sst(0.3, 0.7, fr);
  S.nv = floor(Ns + 0.5);
  for (let k = 0; k < n0; k++) {
    const a = -PI / 2 - S.rot + (TWO_PI * k) / n0 + PI / n0;
    S.c0[k] = cos(a); S.s0[k] = sin(a);
  }
  for (let k = 0; k < n1; k++) {
    const a = -PI / 2 - S.rot + (TWO_PI * k) / n1 + PI / n1;
    S.c1[k] = cos(a); S.s1[k] = sin(a);
  }
  const breathe = 1 + 0.018 * sin(0.071 * S.t + 1.3) + 0.012 * sin(0.0313 * S.t + 4.0);
  S.amix = ((1 - S.f) * APO[n0] + S.f * APO[n1]) * breathe;
  S.rin0 = 0.3 * S.amix;
  S.rin1 = S.amix - 2;
  S.qin = cl(0.35 + (Ns - 3) * 0.2167, 0.35, 1); // the polygon's contours round into circles toward the eye; a triangle keeps more of its corners so that the level stays monotonic
}

// raw support of the polygon in direction (X, Y): the level E of that point before the outer rounding
function support(S, X, Y) {
  const c0 = S.c0, s0 = S.s0, n0 = S.n0;
  let h = X * c0[0] + Y * s0[0];
  for (let k = 1; k < n0; k++) {
    const v = X * c0[k] + Y * s0[k];
    if (v > h) h = v;
  }
  if (S.f > 0) {
    const c1 = S.c1, s1 = S.s1, n1 = S.n1;
    let g = X * c1[0] + Y * s1[0];
    for (let k = 1; k < n1; k++) {
      const v = X * c1[k] + Y * s1[k];
      if (v > g) g = v;
    }
    h += (g - h) * S.f;
  }
  return h;
}

function levelOf(S, X, Y) {
  const h = support(S, X, Y), dr = h - S.amix;
  if (dr > RND0) return h + sst(RND0, RND1, dr) * (sqrt(X * X + Y * Y) - h);
  if (h < S.rin1) return h + S.qin * (1 - sst(S.rin0, S.rin1, h)) * (sqrt(X * X + Y * Y) - h);
  return h;
}

// ---- the flow, tabulated against level
function buildTables(S) {
  const amix = S.amix, U = S.U, W0 = S.W0, tsf = S.tsf, bp = S.bandPh;
  const OM = S.OM, WND = S.WND, VIN = S.VIN, ZT = S.ZT;
  for (let k = 0; k < NT + 2; k++) {
    const E = k * DE, dE = E - amix;
    const sIn = sst(0, -6, dE), sOut = sst(0, 6, dE);
    const g = exp(-Math.pow(abs(dE) / JET_W, 4));
    const wc = W0 * Math.pow(1 + (E / 9) * (E / 9), -0.6);
    const vj = U * g;
    const vo = (-2.6 * exp(-dE / 14) + 3.6 * tsf * sst(2, 12, dE) * sin((TWO_PI * (dE - 8)) / 26 + bp[0])) * sOut;
    OM[k] = wc * sIn + (vj + vo) / max(E, 8);
    WND[k] = -1.0 * log(max(E, 2) / 18) * sIn;
    VIN[k] = 0.35 * sIn;
    // colour tables
    const o = k * 8, bp1 = S.bandPh;
    ZT[o] = exp(-Math.pow(abs(dE) / 3.4, 3));
    ZT[o + 1] = sst(3, -3, dE);
    const q = sst(0, 5, dE);
    ZT[o + 2] = 0.5 + q * (0.2 * sin((TWO_PI * dE) / 23 + bp1[3]) + 0.17 * sin((TWO_PI * dE) / 14.3 + bp1[4]) + 0.12 * sin((TWO_PI * dE) / 9.1 + bp1[5]) + 0.07 * sin((TWO_PI * dE) / 5.9 + bp1[6]));
    ZT[o + 3] = 0.6 + 0.4 * sin((TWO_PI * dE) / 31 + bp1[7]) * 0.8 + 0.2 * sin((TWO_PI * dE) / 12.7 + bp1[2]);
    ZT[o + 4] = exp(-((dE + 3.7) * (dE + 3.7)) / (2 * 0.85 * 0.85)); // brighter inner edge of the jet
    ZT[o + 5] = exp(-((dE - 6.2) * (dE - 6.2)) / (2 * 2.0 * 2.0)); // moat just outside
    ZT[o + 6] = WND[k];
    ZT[o + 7] = 0.22 + 0.4 * sst(2, 14, dE) * (0.5 + 0.5 * sin((TWO_PI * dE) / 19 + bp1[1])); // how much cloud texture rides on the outer band
  }
}

// ---- eddies and the storm
function omegaAt(S, E) {
  const k = cl(E / DE, 0, NT - 1), k0 = floor(k), f = k - k0;
  return S.OM[k0] + (S.OM[k0 + 1] - S.OM[k0]) * f;
}

function newEddy(S, aged) {
  const n = S.nv, k = floor(Math.random() * n);
  const sg = Math.random() < 0.5 ? 1 : -1, life = 22 + 28 * Math.random();
  const e = {
    th: -PI / 2 - S.rot + (TWO_PI * k) / n + (Math.random() - 0.5) * 0.1,
    d: (Math.random() - 0.5) * 5, age: aged ? Math.random() * life : 0, life,
    sig: 2.4 + 1.6 * Math.random(), gam: sg * (0.6 + 0.6 * Math.random()), vd: (Math.random() - 0.3) * 0.45,
    kind: 0, X: 0, Y: 0, s: 0,
  };
  if (aged) e.th = Math.random() * TWO_PI;
  S.eddies.push(e);
}

function newStorm(S, aged) {
  const life = 55 + 40 * Math.random();
  S.storm = {
    th: Math.random() * TWO_PI, d: 10 + 6 * Math.random(), age: aged ? Math.random() * life : 0, life,
    sig: 4.2 + 1.5 * Math.random(), gam: -(0.7 + 0.3 * Math.random()), vd: (Math.random() - 0.5) * 0.12, kind: 1, X: 0, Y: 0, s: 0,
  };
}

function placeEddy(S, e) {
  const u = cos(e.th), v = sin(e.th), H = support(S, u, v);
  const r = (S.amix + e.d) / H;
  e.X = u * r;
  e.Y = v * r;
  e.s = sin((PI * e.age) / e.life) ** 2;
}

function stepEddies(S, dt) {
  const es = S.eddies;
  for (let i = es.length - 1; i >= 0; i--) {
    const e = es[i];
    e.age += dt;
    if (e.age >= e.life) { es.splice(i, 1); continue; }
    e.d = cl(e.d + e.vd * dt, -17, 36);
    const om = omegaAt(S, S.amix + e.d);
    e.th -= 0.92 * om * dt;
    placeEddy(S, e);
  }
  S.spawn -= dt;
  if (S.spawn <= 0 && es.length < 9) {
    newEddy(S, false);
    S.spawn = -Math.log(1 - Math.random()) * 4.2 + 0.8;
    placeEddy(S, es[es.length - 1]);
  } else if (S.spawn <= 0) S.spawn = 2;
  const st = S.storm;
  if (st) {
    st.age += dt;
    if (st.age >= st.life) { S.storm = null; S.stormWait = 25 + 55 * Math.random(); } else {
      st.d = cl(st.d + st.vd * dt, 7, 22);
      st.th -= 0.95 * omegaAt(S, S.amix + st.d) * dt;
      placeEddy(S, st);
    }
  } else {
    S.stormWait -= dt;
    if (S.stormWait <= 0) { newStorm(S, false); placeEddy(S, S.storm); }
  }
}

// ---- the lookups
function basePass(S) {
  const cx = S.cx, cy = S.cy, Eb = S.Eb, Thb = S.Thb, amix = S.amix;
  for (let y = 0; y < H; y++) {
    const Y = y + 0.5 - CY0 - cy;
    for (let x = 0; x < W; x++) {
      const X = x + 0.5 - CX0 - cx, i = y * W + x;
      Eb[i] = levelOf(S, X, Y);
      Thb[i] = atan2(Y, X);
    }
  }
}

const TWI = TW / TWO_PI;

function layerPass(S, tex, tau, wgt) {
  const Ts = S.Ts, Es = S.Es, Eb = S.Eb, Thb = S.Thb, OM = S.OM, WND = S.WND, VIN = S.VIN;
  const w2 = wgt * wgt, id = ++S.stampId, stamp = S.stamp, list = S.list, Xw = S.Xw, Yw = S.Yw;
  const cx = S.cx, cy = S.cy;
  let nT = 0;
  // eddies swirl the place each pixel is looked up from
  const es = S.eddies;
  for (let q = 0; q <= es.length; q++) {
    const e = q < es.length ? es[q] : S.storm;
    if (!e || e.s < 0.02) continue;
    const gam = e.gam * e.s * tau * S.tsf, sg = e.sig, R = 2.7 * sg, R2 = R * R;
    if (abs(gam) < 0.05) continue;
    const x0 = max(0, floor(e.X + CX0 + cx - R)), x1 = min(W - 1, floor(e.X + CX0 + cx + R));
    const y0 = max(0, floor(e.Y + CY0 + cy - R)), y1 = min(H - 1, floor(e.Y + CY0 + cy + R));
    const inv = 1 / (2 * sg * sg);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        let X, Y;
        if (stamp[i] === id) { X = Xw[i]; Y = Yw[i]; } else { X = x + 0.5 - CX0 - cx; Y = y + 0.5 - CY0 - cy; }
        const dx = X - e.X, dy = Y - e.Y, r2 = dx * dx + dy * dy;
        if (r2 >= R2) continue;
        const a = gam * exp(-r2 * inv), c = cos(a), s = sin(a);
        if (stamp[i] !== id) { stamp[i] = id; list[nT++] = i; }
        Xw[i] = e.X + dx * c - dy * s;
        Yw[i] = e.Y + dx * s + dy * c;
      }
    }
  }
  const inv = 1 / DE, tinv = 1 / TEXU;
  for (let i = 0; i < NP; i++) {
    if (stamp[i] === id) continue;
    sampleInto(S, tex, Eb[i], Thb[i], tau, w2, wgt, i, inv, tinv);
  }
  for (let q = 0; q < nT; q++) {
    const i = list[q], X = Xw[i], Y = Yw[i];
    sampleInto(S, tex, levelOf(S, X, Y), atan2(Y, X), tau, w2, wgt, i, inv, tinv);
  }
}

function sampleInto(S, tex, E, th, tau, w2, wgt, i, inv, tinv) {
  const kf = E * inv, k0 = kf < NT - 1 ? (kf | 0) : NT - 1, fk = kf - k0;
  const OM = S.OM, WND = S.WND, VIN = S.VIN;
  const om = OM[k0] + (OM[k0 + 1] - OM[k0]) * fk, wn = WND[k0] + (WND[k0 + 1] - WND[k0]) * fk, vi = VIN[k0];
  let tf = (th + om * tau + wn) * TWI;
  tf -= TW * floor(tf / TW);
  const i0 = tf | 0, fx = tf - i0, i1 = i0 + 1 >= TW ? 0 : i0 + 1;
  let u = (E + vi * tau) * tinv - 0.5;
  if (u < 0) u = 0; else if (u > TH - 1.001) u = TH - 1.001;
  const j0 = u | 0, fy = u - j0, r0 = j0 * TW, r1 = r0 + TW;
  const v0 = tex[r0 + i0] + (tex[r0 + i1] - tex[r0 + i0]) * fx;
  const v1 = tex[r1 + i0] + (tex[r1 + i1] - tex[r1 + i0]) * fx;
  S.Ts[i] += wgt * (v0 + (v1 - v0) * fy);
  S.Es[i] += w2 * E;
}

// ---- colour
function shade(S) {
  const Ts = S.Ts, Es = S.Es, ZT = S.ZT, rgb = S.rgb, amix = S.amix;
  const [rj, ri, rw, rc] = S.ramps, hot = S.hot;
  const exr = S.ex, eyr = S.ey, inv = 1 / DE;
  for (let y = 0; y < H; y++) {
    const Y = y + 0.5 - CY0 - S.cy;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, X = x + 0.5 - CX0 - S.cx;
      const T = Ts[i], E = Es[i];
      const kf = cl(E * inv, 0, NT - 1.01), k0 = kf | 0, fk = kf - k0, o0 = k0 * 8, o1 = o0 + 8;
      const wj = ZT[o0] + (ZT[o1] - ZT[o0]) * fk;
      const sIn = ZT[o0 + 1] + (ZT[o1 + 1] - ZT[o0 + 1]) * fk;
      const band = ZT[o0 + 2] + (ZT[o1 + 2] - ZT[o0 + 2]) * fk;
      const warm = ZT[o0 + 3] + (ZT[o1 + 3] - ZT[o0 + 3]) * fk;
      const rim = ZT[o0 + 4] + (ZT[o1 + 4] - ZT[o0 + 4]) * fk;
      const moat = ZT[o0 + 5] + (ZT[o1 + 5] - ZT[o0 + 5]) * fk;
      const wnd = ZT[o0 + 6] + (ZT[o1 + 6] - ZT[o0 + 6]) * fk;
      const gT = ZT[o0 + 7] + (ZT[o1 + 7] - ZT[o0 + 7]) * fk;
      // eye
      const dxe = X - exr, dye = Y - eyr, re = sqrt(dxe * dxe + dye * dye);
      const wall = exp(-((re - 6.6) * (re - 6.6)) / (2 * 1.5 * 1.5));
      // jet colour
      let v = cl(0.62 + 0.46 * T + 0.2 * rim, 0, 0.999);
      let n = ((v * 255) | 0) * 3;
      let jr = rj[n], jg = rj[n + 1], jb = rj[n + 2];
      // inside
      const arm = cos(3 * (S.Thb[i] + wnd + S.armPh));
      v = cl(0.47 + 0.55 * T + 0.14 * arm * sIn + 0.36 * wall, 0, 0.999);
      n = ((v * 255) | 0) * 3;
      const ir = ri[n], ig = ri[n + 1], ib = ri[n + 2];
      // outside
      v = cl(band + gT * T - 0.4 * moat, 0, 0.999);
      n = ((v * 255) | 0) * 3;
      const orr = rw[n] + (rc[n] - rw[n]) * warm, og = rw[n + 1] + (rc[n + 1] - rw[n + 1]) * warm, ob = rw[n + 2] + (rc[n + 2] - rw[n + 2]) * warm;
      const si = sIn, so = 1 - sIn;
      let r = wj * jr + (1 - wj) * (si * ir + so * orr);
      let g = wj * jg + (1 - wj) * (si * ig + so * og);
      let b = wj * jb + (1 - wj) * (si * ib + so * ob);
      const dark = 1 - sst(2.6, 5.0, re);
      if (dark > 0) {
        r += (hot[0] - r) * dark; g += (hot[1] - g) * dark; b += (hot[2] - b) * dark;
      }
      const o = i * 3;
      rgb[o] = r; rgb[o + 1] = g; rgb[o + 2] = b;
    }
  }
  const st = S.storm;
  if (st && st.s > 0.01) {
    const sa = 5.2, sb = 3.0;
    // elongated along the flow, which at the storm is tangent to the circle round the pole
    const ang = atan2(st.Y, st.X) + PI / 2, ca = cos(ang), sn = sin(ang);
    const R = 14;
    const x0 = max(0, floor(st.X + CX0 + S.cx - R)), x1 = min(W - 1, floor(st.X + CX0 + S.cx + R));
    const y0 = max(0, floor(st.Y + CY0 + S.cy - R)), y1 = min(H - 1, floor(st.Y + CY0 + S.cy + R));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - CX0 - S.cx - st.X, dy = y + 0.5 - CY0 - S.cy - st.Y;
        const p = dx * ca + dy * sn, q = -dx * sn + dy * ca;
        const bmp = st.s * 0.55 * exp(-(p * p) / (2 * sa * sa) - (q * q) / (2 * sb * sb));
        if (bmp < 0.004) continue;
        const o = (y * W + x) * 3;
        rgb[o] += (hot[3] - rgb[o]) * bmp; rgb[o + 1] += (hot[4] - rgb[o + 1]) * bmp; rgb[o + 2] += (hot[5] - rgb[o + 2]) * bmp;
      }
    }
  }
}

// ---- the frame
const BAND_RATES = [0.021, 0.0137, 0.0293, 0.0111, -0.0173, 0.0239, -0.0097, 0.0059];
function advance(S, dt) {
  const kn = S.kn, sk = S.sk;
  const a = 1 - exp(-dt / 0.35);
  for (let k = 1; k < 4; k++) sk[k] += (kn[k] - sk[k]) * a;
  sk[0] = kn[0];
  S.t += dt;
  const t = S.t, p = S.ph0;
  S.cx = 1.0 * sin(0.0431 * t + p[0]) + 0.7 * sin(0.0173 * t + p[1]);
  S.cy = 1.1 * sin(0.0367 * t + p[2]) + 0.8 * sin(0.0151 * t + p[3]);
  S.ex = 1.9 * cos(0.231 * t + p[4]) + 0.9 * cos(0.0873 * t + p[5]);
  S.ey = 1.9 * sin(0.231 * t + p[4]) + 0.9 * sin(0.0873 * t + p[5]);
  const kj = cl(sk[1], 0.4, 4);
  S.U = 5.5 * kj;
  S.tsf = 0.55 + 0.225 * kj;
  S.omegaH = 0.1 * cl(sk[3], -1, 1);
  S.W0 = 0.62 * (1 + 0.75 * cl(sk[3], -1, 1)) * S.tsf;
  S.rot += S.omegaH * dt;
  S.armPh += omegaOf(S) * dt;
  const bp = S.bandPh, bq = BAND_RATES;
  for (let k = 0; k < 8; k++) bp[k] += bq[k] * dt;
  S.Tc = cl(24 / S.U, 1.7, 6.5);
  setPolygon(S);
  buildTables(S);
  stepEddies(S, dt);
  for (let m = 0; m < 3; m++) {
    S.ph[m] += dt / S.Tc;
    if (S.ph[m] >= 1) { S.ph[m] -= 1; buildTex(S, S.tex[m]); }
  }
  setHue(S, cl(kn[0], 0, 1));
}

function omegaOf(S) {
  // the pattern speed of the arms: the cyclone's rate near the eyewall, rad/s
  return S.W0 * Math.pow(1 + (11 / 9) * (11 / 9), -0.6) * 0.8;
}

function render(S) {
  S.Ts.fill(0);
  S.Es.fill(0);
  basePass(S);
  const Tc = S.Tc;
  for (let m = 0; m < 3; m++) {
    const ph = S.ph[m], w = 0.8165 * abs(sin(PI * ph));
    if (w < 1e-4) continue;
    layerPass(S, S.tex[m], ph * Tc, w);
  }
  shade(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  const kn = (input && input.knobValues) || [0, 2, 0, 0.06];
  S.kn = kn;
  if (!S.ready) {
    S.ready = true;
    S.sk = [kn[0], kn[1], kn[2], kn[3]];
    for (let k = 0; k < 8; k++) S.ph0[k] = Math.random() * TWO_PI;
    S.armPh = Math.random() * TWO_PI;
    for (let k = 0; k < 8; k++) S.bandPh[k] = Math.random() * TWO_PI;
    S.t = 40 * Math.random();
    const r0 = Math.random();
    for (let m = 0; m < 3; m++) { S.ph[m] = (r0 + m / 3) % 1; buildTex(S, S.tex[m]); }
    S.spawn = 1;
    advance(S, 0.001);
    for (let q = 0; q < 5; q++) newEddy(S, true);
    if (Math.random() < 0.6) newStorm(S, true);
    for (const e of S.eddies) placeEddy(S, e);
    if (S.storm) placeEddy(S, S.storm);
    S.spawn = 2;
  }
  advance(S, d);
  render(S);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const rgb = S.rgb;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, rgb[o], rgb[o + 1], rgb[o + 2]);
    }
  }
}
