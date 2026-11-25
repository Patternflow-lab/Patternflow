// ===== Patternflow pattern =====
// Title:   Noctilucent
// Family:  noctilucent
// Idea:    Night-shining clouds an hour after sunset, seen from the ground: every LED is a view ray that meets a thin sheet of ice 83 km up, so the sheet's long wave bands, its fine cross billows and its drifting knots and holes are broad at the top of the panel and squeezed flat towards the horizon, lit electric blue-white up to the soft arch of the Earth's shadow, over a twilight sky that runs from an orange glow at the foot through turquoise to indigo.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: noctilucent clouds, noticed widely in the summer of 1885 after Krakatoa (Backhouse, Leslie, Jesse; Jesse's triangulations of 1887 to 1896 put them near 82 km, from memory); their forms as veils, bands, billows and whirls (the WMO cloud atlas classes, Fogle and Haurwitz 1966, from memory); bands and billows as gravity waves and their breaking in the mesopause (Hines 1960 and the stereo photographs of Witt 1962, from memory); the forward scattering of sunlight by ice grains some tens of nanometres across; the Earth's shadow as the upper edge of the lit part; the ray to a spherical shell at height h, slant range s = -R sin e + sqrt(R^2 sin^2 e + 2 R h + h^2); hashed value noise (Perlin 1985 for the idea of lattice noise). What is original: the sheet drawn per LED in its own ground coordinates with each wave train faded out where its projected wavelength falls under about 3 LED, the multiplicative ripple of a noise veil by packets of ridge waves, the exaggerated arch and the knob layout, pattern round 246
// Round:   246
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wind=0..4, Billows=-1..1, Sun=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel. At 0 the colours are the natural ones: blue-white cloud, an orange glow on the horizon, turquoise above it and indigo at the top. At 0.5 the cloud is gold over a blue horizon.
// Knob 2: Wind. 0 to 4, opening at 2: how fast the sheet is carried over the ground and how fast the waves crawl through it. At 0 it is a quarter of the opening speed and the sheet still changes; at 4 it streams up from the horizon and over your head.
// Knob 3: Billows. -1 to 1, opening at 0. At -1 the sheet is smooth and whole and only the long broad bands ripple it. At 1 the bands are nearly gone, the sheet is torn into patches and most of it is covered by fine ripples that cross the bands. At 0 both.
// Knob 4: Sun. -1 to 1, opening at 0.06: how far the sun is below the horizon. At -1 it has just set: the warm glow reaches half way up, the sky is bright and the whole sheet is lit but pale against it. At 1 it is deep twilight: the glow is a thin red line, the sky is nearly black and only a low arch of cloud is still in sunlight, very bright.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sin, cos, sqrt, exp, pow, atan2, PI } = Math;
const TAU = 2 * PI, RAD = PI / 180;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();

const RE = 76.8;                 // the Earth's radius in sheet heights: 6371 km over 83 km
const EL0 = 2, EL1 = 40;         // elevation of the last sky row and of the top row, degrees
const AZW = 14;                  // azimuth of the side columns, plus and minus degrees
const HR = 125;                  // the last row of sky; rows 126 and 127 are the flat black horizon
const V0 = 0.07;                 // sheet heights a second the wind carries the sheet at Wind 2
const PRE = 40;                  // seconds the sheet is taken to have run before the first frame
const PVZ = 3.2;                 // the wave trains turn about this point of the sheet, straight ahead
const S1 = 1.2, S2 = 0.5, S3 = 0.17;   // cells of the knots, the wisps and the fine wisps, in sheet heights
const SE = 1.6, SB = 0.6;        // cell of the band domains and of the billow patches
const G0 = 0.934, G1 = 3.9;      // squared phase step per LED where a train starts to fade (6.5 LED a wave) and is gone (3.2 LED)
const FA = 0.3, FS = 1.6;        // the veil is drawn out into fibres along a line this many radians off the X axis, by this factor

// The two band trains. lam: wavelength in sheet heights. th: mean direction of travel, radians from the line of sight
// (0 gives bands across the panel, a quarter turn gives crests that run to the horizon). ta, tp, tp2: how far and
// how slowly the direction turns. c: speed of the crests through the sheet.
const BANDS = [
  { lam: 1.05, th: 0.22, ta: 0.45, tp: 43.7, tp2: 17.3, c: 0.03 },
  { lam: 0.6, th: -0.8, ta: 0.45, tp: 58.1, tp2: 23.9, c: -0.045 },
];
// Each billow train rides across one band train: of is the angle to that band's direction.
const BILL = [
  { lam: 0.3, ride: 0, of: PI / 2 + 0.18, c: 0.02 },
  { lam: 0.18, ride: 1, of: PI / 2 - 0.22, c: -0.025 },
];
const NB = BANDS.length, NW = NB + BILL.length;

// ---- the view: one ray an LED ---------------------------------------------------
const EL = new Float32Array(H), AZ = new Float32Array(W);
const PX = new Float32Array(N), PZ = new Float32Array(N);
const JXX = new Float32Array(N), JXY = new Float32Array(N), JZX = new Float32Array(N), JZY = new Float32Array(N);
// The noise fields are smooth across the panel, so they are worked out at every fourth column and joined by lines.
const NN = W / 4 + 1, NPX = new Float32Array(H * NN), NPZ = new Float32Array(H * NN);
const ROWB = new Float32Array(H), WARM = new Float32Array(H), FD1 = new Float32Array(H), FD2 = new Float32Array(H), FD3 = new Float32Array(H);
const BASE = new Float32Array(H), TORN = new Float32Array(H);
const elOf = (y) => EL0 + ((EL1 - EL0) * (HR - y)) / HR;
const azOf = (x) => ((x - 31.5) / 31.5) * AZW;
// Where the ray of elevation e and azimuth a (degrees) meets the shell: ground coordinates X (to the right) and Z (ahead),
// measured along the ground, and the cosine of the angle at which the ray crosses the sheet.
function hit(e, a, o) {
  const se = sin(e * RAD), ce = cos(e * RAD);
  const s = -RE * se + sqrt(RE * RE * se * se + 2 * RE + 1);
  const d = RE * atan2(s * ce, RE + s * se);
  o[0] = d * sin(a * RAD);
  o[1] = d * cos(a * RAD);
  o[2] = (s + RE * se) / (RE + 1);
}
{
  const o = [0, 0, 0], p = [0, 0, 0];
  for (let x = 0; x < W; x++) AZ[x] = azOf(x);
  for (let y = 0; y < H; y++) {
    const e = max(0.3, elOf(y));
    EL[y] = e;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      hit(e, AZ[x], o);
      PX[i] = o[0];
      PZ[i] = o[1] - PVZ;
      hit(e, azOf(x + 0.5), o);
      hit(e, azOf(x - 0.5), p);
      JXX[i] = o[0] - p[0];
      JZX[i] = o[1] - p[1];
      hit(max(0.05, elOf(y + 0.5)), AZ[x], o);
      hit(max(0.05, elOf(y - 0.5)), AZ[x], p);
      JXY[i] = o[0] - p[0];
      JZY[i] = o[1] - p[1];
    }
    for (let k = 0; k < NN; k++) {
      hit(e, azOf(k * 4), o);
      NPX[y * NN + k] = o[0];
      NPZ[y * NN + k] = o[1] - PVZ;
    }
    // the sheet is seen more edge-on towards the horizon, and through more air
    hit(e, 0, o);
    ROWB[y] = pow(1 / o[2], 0.5) * exp(-0.1 / sin((e + 1.5) * RAD));
    WARM[y] = 1 - sstep(2, 9, e);
    // rows a cell of the wisps takes up; under about two the wisps are left out
    const i = y * W + 32, rpu = 1 / sqrt(JXY[i] * JXY[i] + JZY[i] * JZY[i]);
    FD1[y] = 0.35 + 0.65 * sstep(3, 8, S1 * rpu);
    FD2[y] = sstep(1.1, 2.3, S2 * rpu);
    FD3[y] = sstep(2, 4, S3 * rpu);
    // between the two trains the sheet is as dim as a trough, where a trough can be seen at all
    BASE[y] = 1 - 0.45 * sstep(3.2, 6.5, BANDS[0].lam * rpu);
    // and it is torn into patches only where a patch is some rows tall
    TORN[y] = sstep(5, 16, rpu);
  }
}

// ---- noise ------------------------------------------------------------------
// Hashed gradient noise, scaled so that its spread is about 1 either side of 0.
const GX = new Float32Array(16), GY = new Float32Array(16);
for (let i = 0; i < 16; i++) {
  GX[i] = 4.64 * cos(((i + 0.3) * TAU) / 16);
  GY[i] = 4.64 * sin(((i + 0.3) * TAU) / 16);
}
function hg(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + seed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 28;
}
function gnoise(x, y, seed) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const h0 = hg(ix, iy, seed), h1 = hg(ix + 1, iy, seed), h2 = hg(ix, iy + 1, seed), h3 = hg(ix + 1, iy + 1, seed);
  const a = GX[h0] * fx + GY[h0] * fy, b = GX[h1] * (fx - 1) + GY[h1] * fy;
  const c = GX[h2] * fx + GY[h2] * (fy - 1), d = GX[h3] * (fx - 1) + GY[h3] * (fy - 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---- colour -----------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}
// The cloud by brightness: [brightness, hue, saturation, value]. High in the sky it is electric blue going to white,
// close to the horizon it is seen through the glow and goes pale gold.
const CLOUD = [
  [0.0, 0.62, 0.9, 0.0],
  [0.15, 0.62, 0.85, 0.24],
  [0.4, 0.585, 0.7, 0.62],
  [0.7, 0.56, 0.45, 0.93],
  [1.0, 0.54, 0.16, 1.0],
];
const CLOUDW = [
  [0.0, 0.1, 0.5, 0.0],
  [0.3, 0.1, 0.5, 0.4],
  [0.7, 0.12, 0.35, 0.86],
  [1.0, 0.13, 0.15, 1.0],
];
const NL = 256, IMAX = 4;
function buildLut(lut, keys, hue) {
  const c = [0, 0, 0];
  for (let i = 0; i < NL; i++) {
    const u = 1 - exp((-i / (NL - 1)) * IMAX);
    let k = 0;
    while (k < keys.length - 2 && u > keys[k + 1][0]) k++;
    const a = keys[k], b = keys[k + 1], f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
    hsv(mix(a[1], b[1], f) + hue, mix(a[2], b[2], f), mix(a[3], b[3], f), c, 0);
    lut[i * 3] = c[0];
    lut[i * 3 + 1] = c[1];
    lut[i * 3 + 2] = c[2];
  }
}
// The sky by elevation, four entries a degree. q is the sun's depth, 0 just set, 1 deep twilight.
const NS = 400, SKS = 4;
function buildSky(sky, q, hue) {
  const g = 1.3 + 13 * pow(1 - q, 1.3), q2 = q * q;
  const st = [
    [0, 0.065 - 0.055 * q2, 0.96, 1 - 0.5 * q2 * q2],
    [0.45 * g, 0.11 - 0.09 * q2, 0.8 + 0.15 * q, 1 - 0.75 * q2 * q],
    [g, 0.14 - 0.09 * q2, 0.2 + 0.6 * q2 * q, 0.92 - 0.82 * pow(q, 2.2)],
    [1.9 * g, 0.47 + 0.08 * q, 0.72 + 0.2 * q, 0.66 - 0.57 * pow(q, 1.2)],
    [3.5 * g, 0.6 + 0.05 * q, 0.88, 0.52 - 0.42 * q],
    [3.5 * g + 26, 0.68 + 0.04 * q, 0.86, 0.46 - 0.35 * q],
  ];
  const c = new Float32Array(st.length * 3);
  for (let k = 0; k < st.length; k++) hsv(st[k][1] + hue, st[k][2], st[k][3], c, k * 3);
  let k = 0;
  for (let j = 0; j < NS; j++) {
    const e = j / SKS;
    while (k < st.length - 2 && e > st[k + 1][0]) k++;
    const f = cl((e - st[k][0]) / (st[k + 1][0] - st[k][0]), 0, 1);
    for (let ch = 0; ch < 3; ch++) sky[j * 3 + ch] = mix(c[k * 3 + ch], c[k * 3 + 3 + ch], f);
  }
}

// ---- state ------------------------------------------------------------------
export function setup(params) {
  const ph = [];
  for (let i = 0; i < 16; i++) ph.push(rnd() * TAU);
  params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, hue: -9,
    ph,
    ox: rnd() * 60, oz: rnd() * 60,           // how far the wind has carried the sheet
    o2x: rnd() * 60, o2z: rnd() * 60,         // the wisps slide over the knots
    obx: rnd() * 60, obz: rnd() * 60,         // and so do the billow patches
    ex: rnd() * 60, ez: rnd() * 60,           // and the domains of the two band trains
    kx: new Float32Array(NW), kz: new Float32Array(NW), phi: new Float32Array(NW), th: new Float32Array(NB),
    o3x: rnd() * 60, o3z: rnd() * 60,
    seed: [1, 2, 3, 4, 5].map(() => floor(rnd() * 1e6)),
    lutC: new Float32Array(NL * 3), lutW: new Float32Array(NL * 3), sky: new Float32Array(NS * 3),
    CB: new Float32Array(W), CS: new Float32Array(W), EDG: new Float32Array(W), RF: new Float32Array(H),
    NV: new Float32Array(NN), ND: new Float32Array(NN), NP: new Float32Array(NN),
  };
  const st = params.st;
  for (let j = 0; j < NW; j++) st.phi[j] = rnd() * TAU;
  return st;
}

const speedOf = (wind) => 0.35 + 0.325 * cl(wind, 0, 4);

// One step of the slow things: the wind's direction, the wave vectors, the phases and the slides of the layers.
// dt is the time that passes for the sun and the turning; carry is the time the wind blows, which the first update
// makes PRE seconds so that the sheet has already run at this wind.
function step(st, dt, carry) {
  const t = (st.t += dt), ph = st.ph, sp = speedOf(st.k[1]);
  // the wind blows from the horizon towards the viewer and swings to either side
  const psi = PI + 0.45 + 0.7 * sin(t / 71.3 + ph[0]) + 0.35 * sin(t / 29.9 + ph[1]);
  const vx = V0 * sp * sin(psi), vz = V0 * sp * cos(psi), T = carry;
  st.ox -= vx * T;
  st.oz -= vz * T;
  st.o2x += 0.011 * dt;
  st.o2z -= 0.006 * dt;
  st.o3x -= 0.007 * dt;
  st.o3z -= 0.012 * dt;
  st.obx -= 0.009 * dt;
  st.obz += 0.01 * dt;
  st.ex += 0.012 * sin(t / 83.1 + ph[9]) * dt + 0.008 * dt;
  st.ez += 0.012 * cos(t / 83.1 + ph[9]) * dt;
  for (let j = 0; j < NB; j++) {
    const b = BANDS[j], th = b.th + b.ta * (0.7 * sin(t / b.tp + ph[2 + j]) + 0.3 * sin(t / b.tp2 + ph[5 + j])), K = TAU / b.lam;
    st.kx[j] = K * sin(th);
    st.kz[j] = K * cos(th);
    st.phi[j] -= (st.kx[j] * vx + st.kz[j] * vz) * T + K * b.c * (0.6 + 0.4 * sp) * T;
    st.th[j] = th;
  }
  for (let j = 0; j < BILL.length; j++) {
    const b = BILL[j], th = st.th[b.ride] + b.of + 0.12 * sin(t / 19.7 + ph[8 + j]), K = TAU / b.lam, n = NB + j;
    st.kx[n] = K * sin(th);
    st.kz[n] = K * cos(th);
    st.phi[n] -= (st.kx[n] * vx + st.kz[n] * vz) * T + K * b.c * (0.6 + 0.4 * sp) * T;
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  if (!st.init) {
    st.init = true;
    step(st, 0, PRE);
  }
  const d = cl(dt || 0, 0, 0.1);
  step(st, d, d);
}

// ---- drawing ----------------------------------------------------------------
export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const t = st.t, ph = st.ph, hue = st.k[0], bil = cl(st.k[2], -1, 1);
  if (hue !== st.hue) {
    st.hue = hue;
    buildLut(st.lutC, CLOUD, hue);
    buildLut(st.lutW, CLOUDW, hue);
  }
  // the sun: its depth creeps a little, its azimuth wanders, and the edge of the Earth's shadow creeps on its own
  let q = (cl(st.k[3], -1, 1) + 1) / 2 + 0.05 * sin(t / 31 + ph[10]) + 0.03 * sin(t / 13.3 + ph[11]);
  q = q < 0 ? -q : q > 1 ? 2 - q : q;
  const as = 8.5 * (0.55 * sin(t / 29 + ph[12]) + 0.45 * sin(t / 12.7 + ph[13]));
  const E0 = 21 + 47 * (1 - pow(q, 1.2)) + (1 - 0.4 * q) * (2 * sin(t / 23.1 + ph[14]) + 1.4 * sin(t / 9.7 + ph[15]));
  const gain = q < 0.53 ? 0.5 + 0.94 * q : 1 + 1.5 * (q - 0.53), dep = 6 + 10 * q, wq = 1 - 0.85 * q;
  buildSky(st.sky, q, hue);
  const CB = st.CB, CS = st.CS, EDG = st.EDG, RF = st.RF, NV = st.NV, ND = st.ND, NP = st.NP;
  let emax = 0;
  for (let x = 0; x < W; x++) {
    const da = AZ[x] - as, db = AZ[x] - 1.25 * as;
    CB[x] = 0.52 + 0.48 * exp((-da * da) / 242);
    CS[x] = SKS / (0.72 + 0.28 * exp((-da * da) / 288));
    EDG[x] = E0 + 2 - (0.04 * db * db) / (1 + (db * db) / 400);
    emax = max(emax, EDG[x]);
  }
  for (let y = 0; y < H; y++) {
    const e = EL[y] + dep;
    RF[y] = ROWB[y] * (0.65 + 0.35 * exp((-e * e) / 1152)) * gain;
  }
  const bp = max(0, bil), bn = max(0, -bil);
  const wBand = 1 + 0.1 * bn - 0.75 * bp, wBill = 0.8 * (1 - bn) + 0.35 * bp;
  const thi = 0.5 - 0.6 * bn - 0.05 * bp;
  const w1 = 0.45, w3 = 0.15, w2 = 0.4;
  const plo = -0.45 - 0.9 * bil;
  const kx = st.kx, kz = st.kz, phi = st.phi, ex = st.ex, ez = st.ez, seed = st.seed, o3x = st.o3x, o3z = st.o3z;
  const ox = st.ox, oz = st.oz, o2x = st.o2x, o2z = st.o2z, obx = st.obx, obz = st.obz;
  const sky = st.sky, lutC = st.lutC, lutW = st.lutW, LS = (NL - 1) / IMAX;
  const IS1 = 1 / S1, IS2 = 1 / S2, IS3 = 1 / S3, ISE = 1 / SE, ISB = 1 / SB, IG = 1 / (G1 - G0);
  const CA = cos(FA), SA = sin(FA), IFS = 1 / FS;

  for (let y = 0; y < H; y++) {
    if (y > HR) {
      for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
      continue;
    }
    const el = EL[y], rf = RF[y], f2 = FD2[y] * w2, f3 = FD3[y] * w3, wm = WARM[y] * wq, base = BASE[y];
    const tlo = -1.45 - bn + 0.9 * bp * TORN[y], ti = 1 / (thi - tlo);
    if (el < emax) {
      const nv = FD1[y] / sqrt(w1 * w1 + f2 * f2 + f3 * f3);
      for (let k = 0; k < NN; k++) {
        const U = NPX[y * NN + k] + ox, V = NPZ[y * NN + k] + oz;
        // the veil: knots, and wisps where a wisp is wide enough to draw
        const A = (U * CA - V * SA) * IFS, B = U * SA + V * CA;
        let v = gnoise(A * IS1, B * IS1, seed[0]) * w1;
        if (f2 > 0) v += gnoise((A + o2x) * IS2, (B + o2z) * IS2, seed[1]) * f2;
        if (f3 > 0) v += gnoise((A + o3x) * IS3, (B + o3z) * IS3, seed[2]) * f3;
        NV[k] = v * nv;
        // which band train owns this part of the sheet, and where the billows are
        ND[k] = gnoise((U + ex) * ISE, (V + ez) * ISE, seed[3]);
        NP[k] = wBill > 0 ? (gnoise((U + obx) * ISB, (V + obz) * ISB, seed[4]) - plo) * 1.1 : 0;
      }
    }
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // the sky behind
      const se = min(NS - 1.001, el * CS[x]), sj = floor(se), sf = se - sj, s3 = sj * 3;
      let r = sky[s3] + (sky[s3 + 3] - sky[s3]) * sf, g = sky[s3 + 1] + (sky[s3 + 4] - sky[s3 + 1]) * sf, b = sky[s3 + 2] + (sky[s3 + 5] - sky[s3 + 2]) * sf;
      // sunlight on the sheet: under the shadow's arch, strongest low over the sun
      let lt = cl((EDG[x] - el) / 6.5, 0, 1);
      lt = lt * lt * (3 - 2 * lt) * rf * CB[x];
      if (lt > 0.004) {
        const xi = x >> 2, xf = (x & 3) * 0.25, v = NV[xi] + (NV[xi + 1] - NV[xi]) * xf;
        let rho = cl((v - tlo) * ti, 0, 1);
        rho = rho * rho * (3 - 2 * rho) * cl(0.8 + 0.3 * v, 0.4, 1.4);
        if (rho > 0.003) {
          const X = PX[i], Z = PZ[i], jxx = JXX[i], jxy = JXY[i], jzx = JZX[i], jzy = JZY[i];
          // one band train or the other, each fading out towards the strip between them where the sheet is smooth
          const dn = ND[xi] + (ND[xi + 1] - ND[xi]) * xf;
          let m = base;
          const eb = cl(NP[xi] + (NP[xi + 1] - NP[xi]) * xf, 0, 1), eb2 = eb * eb * (3 - 2 * eb) * wBill;
          for (let j = 0; j < NB; j++) {
            let d = cl(((j === 0 ? -dn : dn) - 0.08) * 1.7, 0, 1);
            if (d <= 0) continue;
            d = d * d * (3 - 2 * d);
            // the band: a train of ridges
            let gx = kx[j] * jxx + kz[j] * jzx, gy = kx[j] * jxy + kz[j] * jzy, g2 = gx * gx + gy * gy, mj = 1;
            if (g2 < G1) {
              let f = g2 <= G0 ? 1 : (G1 - g2) * IG;
              f = f * f * (3 - 2 * f) * wBand;
              const c = 0.5 + 0.5 * cos(kx[j] * X + kz[j] * Z + phi[j]);
              mj += f * (c * c * c * 2.4 - 0.75);
            }
            // its billows: short ripples across it, in patches
            const n = NB + j;
            gx = kx[n] * jxx + kz[n] * jzx;
            gy = kx[n] * jxy + kz[n] * jzy;
            g2 = gx * gx + gy * gy;
            if (eb2 > 0 && g2 < G1) {
              let f = g2 <= G0 ? 1 : (G1 - g2) * IG;
              f = f * f * (3 - 2 * f) * eb2;
              const c = 0.5 + 0.5 * cos(kx[n] * X + kz[n] * Z + phi[n]);
              mj *= 1 + f * (c * c * 1.6 - 0.6);
            }
            m += d * (mj - base);
          }
          if (m > 0) {
            const I = rho * m * lt * 0.95;
            const a = min(NL - 1, floor(I * LS + 0.5)) * 3;
            const cr = lutC[a] + (lutW[a] - lutC[a]) * wm, cg = lutC[a + 1] + (lutW[a + 1] - lutC[a + 1]) * wm, cb = lutC[a + 2] + (lutW[a + 2] - lutC[a + 2]) * wm;
            // light adds on light: the cloud is pale over a bright sky
            r += cr - (r * cr) / 255;
            g += cg - (g * cg) / 255;
            b += cb - (b * cb) / 255;
          }
        }
      }
      display.setPixel(x, y, r | 0, g | 0, b | 0);
    }
  }
}
