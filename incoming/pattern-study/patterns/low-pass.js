// ===== Patternflow pattern =====
// Title:   Low Pass
// Family:  flyover
// Idea:    A slow low flight at dusk over an endless invented country of plains, lakes and ranges, drawn the way the Comanche engine drew its ground: every column of the panel casts a ray over a height map and fills the strip of land it sees, front to back, so each ridge stands paler than the one in front of it in the haze, slopes that face the low sun glow amber while the shaded ones go violet, the lakes hold the sky and a few glints of the sun, and the camera banks and climbs over land it never crosses twice.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the height-field ray caster of the Voxel Space engine (Kyle Freeman, NovaLogic, Comanche, 1992) and the floating-horizon method before it (Thomas Wright, 1973), both from memory; value noise on an integer lattice hash summed as fractal Brownian motion with ridged octaves (Ken Perlin, 1985; F. Kenton Musgrave, 1989); aerial perspective as exponential extinction toward the colour of the horizon (Leonardo's prospettiva aerea, c. 1500; Koschmieder, 1924); Lambert's cosine law and Fresnel's reflectance for lakes; the roll of the view as a shear of the horizon row; the dusk palettes, the terrain regimes, the lake level and the clocks that drift light, haze and relief are original, pattern round 257
// Round:   257
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0..4, Relief=-1..1, Haze=-1..1
//
// Knob 1: Hue. Turns the whole palette through four skies: amber over indigo at 0 and 1, a teal twilight at 0.25, a magenta and violet dusk at 0.5, a pale peach and powder-blue dawn at 0.75. The light drifts a little round whatever you pick.
// Knob 2: Speed. How fast the camera flies, from a creep of 1 unit a second at 0 (hovering: the light, the clouds and the lake glints go on and the view pans slowly) to 23 at 4; it opens at 2, 12 units a second, a calm cruise.
// Knob 3: Relief. The height and the character of the land: -1 is rolling plains with wide lakes, 0 (the opening) is hills with a range behind them, 1 is alpine, peaks that stand well above the horizon. The camera keeps its clearance either way.
// Knob 4: Haze. How thick the air is: -1 is crystal clear and the far ridges stay dark, 0.06 (the opening) pales a ridge by a quarter at 70 units and by two thirds at 300, 1 is a milky fog that has paled most of the land within 100 units.

const W = 64;
const H = 128;
const NPX = W * H;
const NS = 128; // sub-columns, two to an LED
const F = 62; // focal length, in LEDs
const ZNEAR = 6;
const ZFAR = 340;
// Depth steps: a step is about a row of the panel tall near the camera, where the rows run fast, and
// coarser out in the distance, so the edge between sun and shade does not climb in stairs.
const ZLIST = (() => {
  const a = [];
  let z = ZNEAR;
  while (z < ZFAR) {
    a.push(z);
    z *= 1 + Math.min(0.06, Math.max(0.012, 0.0016 * z));
  }
  return a;
})();
const NSTEP = ZLIST.length;
const OCT = 8;
const { floor, ceil, sin, cos, sqrt, abs, min, max, exp, pow, tan, imul, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mod1 = (v) => v - floor(v);

// ---------------------------------------------------------------- noise

function vn(x, z, salt) {
  const fx = floor(x);
  const fz = floor(z);
  let tx = x - fx;
  let tz = z - fz;
  tx = tx * tx * (3 - 2 * tx);
  tz = tz * tz * (3 - 2 * tz);
  const ix = fx | 0;
  const iz = fz | 0;
  const a = imul(ix, 374761393) + imul(iz, 668265263) + salt;
  const b = a + 374761393;
  const c = a + 668265263;
  const d = b + 668265263;
  let h0 = imul((a | 0) ^ ((a | 0) >>> 13), 1274126177);
  let h1 = imul((b | 0) ^ ((b | 0) >>> 13), 1274126177);
  let h2 = imul((c | 0) ^ ((c | 0) >>> 13), 1274126177);
  let h3 = imul((d | 0) ^ ((d | 0) >>> 13), 1274126177);
  h0 = ((h0 ^ (h0 >>> 16)) >>> 0) * 2.3283064365386963e-10;
  h1 = ((h1 ^ (h1 >>> 16)) >>> 0) * 2.3283064365386963e-10;
  h2 = ((h2 ^ (h2 >>> 16)) >>> 0) * 2.3283064365386963e-10;
  h3 = ((h3 ^ (h3 >>> 16)) >>> 0) * 2.3283064365386963e-10;
  return h0 + (h1 - h0) * tx + (h2 - h0) * tz + (h0 - h1 - h2 + h3) * tx * tz;
}

// octaves: the cell of each, the weight each carries, the angle it is turned by
const CELL = [520, 260, 130, 62, 30, 15, 7.5, 3.8];
const AMP = [0.55, 0.8, 1.0, 0.85, 0.45, 0.15, 0.04, 0.012]; // rolling ground: the fine octaves are quiet
const AMR = [0.6, 0.8, 0.95, 0.9, 0.65]; // ridged ground keeps its spurs
const ASUM = AMP.reduce((s, a) => s + a, 0);
const RSUM = AMR.reduce((s, a) => s + a, 0);
const ANG = [0.0, 0.9, 1.9, 2.8, 0.45, 1.5, 2.3, 0.7];
const OC = ANG.map((a) => cos(a));
const OSN = ANG.map((a) => sin(a));
const ICELL = CELL.map((c) => 1 / c);

let gR = 70; // relief of the land, in units
let gB = 0; // how far the Relief knob leans the regime toward plains (-) or ranges (+)

// Height of the ground at (x, z): rolling or ridged octaves, as much of each
// as the large-scale regime noise says, lifted or sunk by a second regime noise.
function terrain(x, z, wt, wo) {
  const u1 = vn(x * 0.00095 + 11.3, z * 0.00095 + 5.7, 101);
  const u2 = vn(x * 0.00062 + 3.1, z * 0.00062 + 17.9, 202);
  let sS = 0;
  let rS = 0;
  for (let k = 0; k < OCT; k++) {
    const w = wt[wo + k];
    if (w <= 0) continue;
    const ic = ICELL[k];
    const xr = (x * OC[k] - z * OSN[k]) * ic;
    const zr = (x * OSN[k] + z * OC[k]) * ic;
    const n = vn(xr, zr, 31 + k * 17);
    const q = 2 * n - 1;
    sS += AMP[k] * w * q;
    if (k < 5) {
      const rr = 1 - sqrt(q * q + 0.005);
      rS += AMR[k] * w * (rr * rr - 0.3333);
    }
  }
  sS /= ASUM;
  rS /= RSUM;
  const ub = u1 + gB;
  const mm = sm(0.25, 0.66, ub);
  const rm = sm(0.36, 0.72, ub);
  const amp = 0.4 + 0.6 * mm;
  const shape = (1 - rm) * sS * 1.6 + rm * (rS * 2.7 + 0.3);
  return gR * (amp * shape + (u2 - 0.5) * 0.6);
}

// ---------------------------------------------------------------- the view, fixed per step

const ZS = new Float64Array(NSTEP);
const NP = new Int16Array(NSTEP);
const DU = new Float64Array(NSTEP);
const IK = new Int16Array(NSTEP * NS);
const IFR = new Float32Array(NSTEP * NS);
const WT = new Float32Array(NSTEP * OCT);
const FOGEND = new Float32Array(NSTEP);
const UJ = new Float32Array(NS);
const UH = 32.4 / F;
const WTFULL = new Float32Array(OCT).fill(1);
(() => {
  for (let j = 0; j < NS; j++) UJ[j] = ((j + 0.5) / 2 - 32) / F;
  for (let i = 0; i < NSTEP; i++) {
    const z = ZLIST[i];
    ZS[i] = z;
    // the ground is read along a line at this depth every spc units, and the octaves the line can carry are kept
    const spc = max(1.5, (1.5 * z) / F);
    const n = cl(ceil((2 * UH * z) / spc), 4, 80);
    NP[i] = n;
    const du = (2 * UH) / n;
    DU[i] = du;
    for (let j = 0; j < NS; j++) {
      const q = (UJ[j] + UH) / du;
      const k = min(n - 1, floor(q));
      IK[i * NS + j] = k;
      IFR[i * NS + j] = q - k;
    }
    const sp = z * du;
    for (let k = 0; k < OCT; k++) WT[i * OCT + k] = sm(1.8, 3.4, CELL[k] / sp);
    FOGEND[i] = sm(0.72 * ZFAR, ZFAR, z);
  }
})();

// ---------------------------------------------------------------- palettes

// 18 colours a palette: 0-4 the sky from the horizon up, 5 the sun's glow, 6 the lake's own colour,
// 7 the colour fog turns milky toward, 8-12 the ground in shade from valley floor to peak,
// 13-17 the same ground in the sun.
const PALS = [
  // amber over indigo
  [
    [240, 152, 88], [222, 100, 112], [142, 76, 142], [62, 48, 136], [24, 20, 90],
    [255, 150, 70], [14, 34, 78], [236, 190, 172],
    [12, 34, 58], [28, 38, 84], [50, 40, 104], [86, 56, 128], [132, 100, 164],
    [92, 126, 92], [182, 150, 84], [236, 134, 82], [248, 148, 126], [255, 204, 196],
  ],
  // teal twilight
  [
    [255, 214, 150], [120, 206, 190], [40, 142, 180], [22, 72, 146], [12, 24, 84],
    [255, 206, 120], [6, 50, 92], [200, 236, 226],
    [8, 40, 56], [14, 58, 80], [30, 72, 108], [58, 92, 128], [104, 132, 158],
    [84, 150, 108], [148, 172, 100], [220, 178, 100], [240, 198, 140], [252, 236, 212],
  ],
  // magenta and violet
  [
    [255, 140, 166], [208, 86, 164], [124, 58, 170], [54, 34, 140], [20, 12, 74],
    [255, 120, 160], [30, 22, 92], [234, 180, 212],
    [28, 16, 60], [52, 26, 88], [80, 38, 112], [116, 52, 134], [166, 92, 170],
    [150, 80, 112], [212, 98, 124], [244, 124, 132], [255, 158, 170], [255, 206, 224],
  ],
  // pale dawn
  [
    [252, 214, 170], [244, 178, 170], [190, 176, 214], [128, 160, 214], [78, 118, 196],
    [255, 214, 160], [96, 138, 188], [244, 232, 226],
    [64, 94, 116], [92, 110, 140], [122, 122, 158], [154, 136, 170], [196, 174, 196],
    [166, 184, 146], [214, 192, 142], [244, 196, 152], [252, 206, 180], [255, 238, 226],
  ],
];
const NC = 18;

function buildPalette(S, p) {
  // p in 0..1 round the four skies
  const x = mod1(p) * 4;
  const i = floor(x);
  const f = sm(0, 1, x - i);
  const a = PALS[i & 3];
  const b = PALS[(i + 1) & 3];
  const P = S.pal;
  for (let c = 0; c < NC; c++) {
    for (let k = 0; k < 3; k++) P[c * 3 + k] = (a[c][k] + (b[c][k] - a[c][k]) * f) / 255;
  }
  // the dusk deepens and lifts with the twilight clock
  const tw = S.tw;
  const dk = [0, 0.07, 0.17, 0.26, 0.32];
  for (let c = 0; c < 5; c++) {
    const m = 1 - tw * dk[c];
    for (let k = 0; k < 3; k++) P[c * 3 + k] *= m;
  }
  // altitude to ground colour, 64 steps, in shade and in the sun
  const ST = [0, 0.16, 0.4, 0.68, 1];
  const LS = S.albS;
  const LL = S.albL;
  for (let n = 0; n < 64; n++) {
    const u = n / 63;
    let j = 0;
    while (j < 3 && ST[j + 1] <= u) j++;
    const t = sm(0, 1, (u - ST[j]) / (ST[j + 1] - ST[j]));
    for (let k = 0; k < 3; k++) {
      LS[n * 3 + k] = P[(8 + j) * 3 + k] + (P[(9 + j) * 3 + k] - P[(8 + j) * 3 + k]) * t;
      LL[n * 3 + k] = P[(13 + j) * 3 + k] + (P[(14 + j) * 3 + k] - P[(13 + j) * 3 + k]) * t;
    }
  }
}

// ---------------------------------------------------------------- state

const RELIEF = (k) => 70 * pow(1.7, k);
const hazeLength = (k) => (k <= 0.06 ? 230 * pow(900 / 230, (0.06 - k) / 1.06) : 230 * pow(55 / 230, (k - 0.06) / 0.94));

export function setup(params) {
  const ph = [];
  for (let i = 0; i < 28; i++) ph.push(Math.random() * TAU);
  const S = {
    t: 0,
    first: true,
    k: [0, 2, 0, 0.06],
    ph,
    x: 0,
    z: 0,
    y: 60,
    yv: 0,
    psi: Math.random() * TAU,
    bank: 0,
    hor: 52,
    // drifting light, air and land
    relAz: 0,
    el: 0.1,
    tw: 0.4,
    hazeMul: 1,
    reliefMul: 1,
    palD: 0,
    seaD: 0,
    clrD: 1,
    aOff: 0,
    R: 70,
    sea: -10,
    pal: new Float32Array(NC * 3),
    albS: new Float32Array(64 * 3),
    albL: new Float32Array(64 * 3),
    // per frame
    skyB: new Float32Array(300 * 3),
    gya: new Float32Array(300),
    gyb: new Float32Array(300),
    gyc: new Float32Array(300),
    gxa: new Float32Array(NS + 1),
    gxb: new Float32Array(NS + 1),
    gxc: new Float32Array(NS + 1),
    haze: new Float32Array(NS * 3),
    hzh: new Float32Array(NS * 3),
    hj: new Float32Array(NS),
    ymin: new Float32Array(NS),
    prevH: new Float32Array(NS),
    lastC: new Float32Array(NS * 3),
    lastI: new Int16Array(NS),
    aR: new Float32Array(NPX),
    aG: new Float32Array(NPX),
    aB: new Float32Array(NPX),
    cv: new Float32Array(NPX),
    EH: new Float32Array(90),
    EP: new Float32Array(90),
  };
  // The first view should be hills with a range behind them, not a plain, a lake or a wall:
  // try 48 places and keep the one whose regime noises sit nearest the middle.
  let best = 1e9;
  for (let n = 0; n < 48; n++) {
    const cx = Math.random() * 20000;
    const cz = Math.random() * 20000;
    let e = 0;
    for (let q = 0; q < 6; q++) {
      const a = q * 1.047;
      const x = cx + 240 * sin(a);
      const z = cz + 240 * cos(a);
      const u1 = vn(x * 0.00095 + 11.3, z * 0.00095 + 5.7, 101);
      const u2 = vn(x * 0.00062 + 3.1, z * 0.00062 + 17.9, 202);
      e += abs(u1 - 0.56) + abs(u2 - 0.6);
    }
    if (e < best) {
      best = e;
      S.x = cx;
      S.z = cz;
    }
  }
  params.st = S;
  return S;
}

function drive(S) {
  const t = S.t;
  const p = S.ph;
  S.relAz = 0.95 * sin((TAU * t) / 151 + p[0]) + 0.55 * sin((TAU * t) / 67 + p[1]);
  const e01 = 0.5 + 0.34 * sin((TAU * t) / 211 + p[2]) + 0.16 * sin((TAU * t) / 83 + p[3]);
  S.el = 0.05 + 0.24 * cl(e01, 0, 1);
  S.tw = cl(0.5 + 0.38 * sin((TAU * t) / 317 + p[4]) + 0.14 * sin((TAU * t) / 113 + p[5]), 0, 1);
  S.hazeMul = exp(0.38 * sin((TAU * t) / 187 + p[6]) + 0.22 * sin((TAU * t) / 71 + p[7]));
  S.reliefMul = exp(0.3 * sin((TAU * t) / 263 + p[8]) + 0.15 * sin((TAU * t) / 97 + p[9]));
  S.palD = 0.085 * sin((TAU * t) / 389) + 0.05 * sin((TAU * t) / 241);
  S.seaD = 0.1 * sin((TAU * t) / 233 + p[12]) + 0.05 * sin((TAU * t) / 127 + p[13]);
  S.aOff = 0.1 * sin((TAU * t) / 283 + p[23]) + 0.06 * sin((TAU * t) / 131 + p[24]);
  S.clrD = exp(0.22 * sin((TAU * t) / 109 + p[14]) + 0.1 * sin((TAU * t) / 41 + p[15]));
}

const hdgRate = (t, p) =>
  0.9 * (TAU / 173) * cos((TAU * t) / 173 + p[16]) +
  0.55 * (TAU / 89) * cos((TAU * t) / 89 + p[17]) +
  0.28 * (TAU / 47) * cos((TAU * t) / 47 + p[18]);

const LOOK = [0, 18, 40, 70, 110, 160];
const LOOKC = [1, 1, 0.85, 0.7, 0.5, 0.35];

function step(S, dt) {
  S.t += dt;
  const t = S.t;
  drive(S);
  S.R = RELIEF(S.k[2]) * S.reliefMul;
  S.sea = S.R * (-0.36 - 0.14 * S.k[2] + S.seaD);
  gR = S.R;
  gB = 0.2 * S.k[2];
  // hovering is a creep of a unit a second and a slow pan, so the ground is new in a few minutes
  const v = 1.2 + 5.5 * S.k[1];
  const mv = 0.3 + 0.7 * min(1, v / 6);
  const rate = hdgRate(t, S.ph) * mv + 0.012 * (1 - min(1, v / 6));
  S.psi += rate * dt;
  const fx = sin(S.psi);
  const fz = cos(S.psi);
  S.x += fx * v * dt;
  S.z += fz * v * dt;
  // altitude: clear the ground ahead, rise fast and sink slow
  const clr = (24 + 0.05 * S.R) * S.clrD;
  let target = -1e9;
  let g0 = 0;
  for (let q = 0; q < LOOK.length; q++) {
    const d = LOOK[q];
    let h = terrain(S.x + fx * d, S.z + fz * d, WTFULL, 0);
    if (h < S.sea) h = S.sea;
    if (q === 0) g0 = h;
    const tt = h + clr * LOOKC[q];
    if (tt > target) target = tt;
  }
  if (S.first) {
    S.y = target;
    S.yv = 0;
  }
  const w = S.y < target ? 1.5 : 0.7;
  const acc = w * w * (target - S.y) - 2 * w * S.yv;
  S.yv += acc * dt;
  S.y += S.yv * dt;
  if (S.y < g0 + 0.7 * clr) {
    S.y = g0 + 0.7 * clr;
    if (S.yv < 0) S.yv = 0;
  }
  // bank into the turn and nod with the climb
  const bt = cl(rate * 56, -5, 5);
  const bk = 1 - exp(-dt / 0.9);
  S.bank += (bt - S.bank) * bk;
  const ht =
    52 + 4.5 * sin((TAU * t) / 47 + S.ph[19]) + 3 * sin((TAU * t) / 31 + S.ph[20]) + cl(0.55 * S.yv, -4, 4);
  S.hor += (ht - S.hor) * (1 - exp(-dt / 1.1));
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const S = params.st;
  const kn = input.knobValues || [0, 2, 0, 0.06];
  const tg = [cl(kn[0], 0, 1), cl(kn[1], 0, 4), cl(kn[2], -1, 1), cl(kn[3], -1, 1)];
  dt = cl(dt || 0, 0, 0.1);
  if (S.first) {
    S.k = tg.slice();
    step(S, 1 / 30);
    S.first = false;
    for (let i = 0; i < 450; i++) step(S, 1 / 30);
    S.hor = 52;
    return;
  }
  const tc = [0.35, 0.9, 0.5, 0.5];
  for (let i = 0; i < 4; i++) S.k[i] += (tg[i] - S.k[i]) * (1 - exp(-dt / tc[i]));
  step(S, dt);
}

// ---------------------------------------------------------------- the sky

const GLOWA = 0.24;
const GLOWB = 0.4;
const NV = 300;
const VO = 16;
const SKYPOS = [0, 6, 19, 40, 70];
let SKB = null;
let GYA = null;
let GYB = null;
let GYC = null;
let GXA = null;
let GXB = null;
let GXC = null;
let gAr = 0;
let gAg = 0;
let gAb = 0;
let gBr = 0;
let gBg = 0;
let gBb = 0;
let gCr = 0;
let gCg = 0;
let gCb = 0;
let SR = 0;
let SG_ = 0;
let SB_ = 0;
let SUNGLOW = 0;
// The sky at sub-column index xi (half LEDs) and vf rows above the horizon plus VO, by linear
// interpolation between rows, so that the tilt of the horizon never shows as a seam.
function skyAt(xi, vf) {
  vf = vf < 0 ? 0 : vf > NV - 1.001 ? NV - 1.001 : vf;
  const i = vf | 0;
  const f = vf - i;
  const i3 = i * 3;
  const ya = GYA[i] + (GYA[i + 1] - GYA[i]) * f;
  const yb = GYB[i] + (GYB[i + 1] - GYB[i]) * f;
  const yc = GYC[i] + (GYC[i + 1] - GYC[i]) * f;
  const gp = GXA[xi] * ya;
  const gq = GXB[xi] * yb;
  const gr = GXC[xi] * yc;
  const r = SKB[i3] + (SKB[i3 + 3] - SKB[i3]) * f + gAr * gp + gBr * gq + gCr * gr;
  const g = SKB[i3 + 1] + (SKB[i3 + 4] - SKB[i3 + 1]) * f + gAg * gp + gBg * gq + gCg * gr;
  const b = SKB[i3 + 2] + (SKB[i3 + 5] - SKB[i3 + 2]) * f + gAb * gp + gBb * gq + gCb * gr;
  SR = r < 0 ? 0 : r > 1 ? 1 : r;
  SG_ = g < 0 ? 0 : g > 1 ? 1 : g;
  SB_ = b < 0 ? 0 : b > 1 ? 1 : b;
  SUNGLOW = gq + 0.6 * gr + 0.15 * gp;
}

// ---------------------------------------------------------------- the picture

export function draw(display, params) {
  const S = params.st;
  if (!S || S.first) return;
  const t = S.t;
  gR = S.R;
  gB = 0.2 * S.k[2];
  const sea = S.sea;
  buildPalette(S, S.k[0] + S.palD);
  const P = S.pal;
  const ALS = S.albS;
  const ALL = S.albL;
  const { skyB, gya, gyb, gyc, gxa, gxb, gxc, haze, hzh, hj, ymin, prevH, lastC, lastI, aR, aG, aB, cv, EH, EP } = S;
  SKB = skyB;
  GYA = gya;
  GYB = gyb;
  GYC = gyc;
  GXA = gxa;
  GXB = gxb;
  GXC = gxc;

  // ---- the sky: a vertical ramp and the glow round the sun
  for (let vi = 0; vi < NV; vi++) {
    const vr = vi - VO;
    let j = 0;
    while (j < 3 && SKYPOS[j + 1] <= vr) j++;
    const u = cl((vr - SKYPOS[j]) / (SKYPOS[j + 1] - SKYPOS[j]), 0, 1);
    const q = u * u * (3 - 2 * u);
    for (let k = 0; k < 3; k++) skyB[vi * 3 + k] = P[j * 3 + k] + (P[(j + 1) * 3 + k] - P[j * 3 + k]) * q;
  }
  const cra = cos(S.relAz);
  const vis = sm(0.1, 0.4, cra);
  const sunX = 32 + F * tan(S.relAz);
  const sunV = (F * tan(S.el)) / max(cra, 0.15);
  const sa = 1 / (2 * 26 * 26);
  const sb = 1 / (2 * 9 * 9);
  const sc = 1 / (2 * 2.2 * 2.2);
  for (let vi = 0; vi < NV; vi++) {
    const d = vi - VO - sunV;
    const d2 = d * d;
    gya[vi] = exp(-d2 * sa);
    gyb[vi] = exp(-d2 * sb);
    gyc[vi] = exp(-d2 * sc);
  }
  for (let i = 0; i <= NS; i++) {
    const d = i / 2 - sunX;
    const d2 = d * d;
    gxa[i] = exp(-d2 * sa) * vis;
    gxb[i] = exp(-d2 * sb) * vis;
    gxc[i] = exp(-d2 * sc) * vis;
  }
  gAr = P[15] * GLOWA;
  gAg = P[16] * GLOWA;
  gAb = P[17] * GLOWA;
  gBr = P[15] * GLOWB;
  gBg = P[16] * GLOWB;
  gBb = P[17] * GLOWB;
  gCr = 0.5 + 0.5 * P[15];
  gCg = 0.5 + 0.5 * P[16];
  gCb = 0.5 + 0.5 * P[17];

  // ---- the camera
  const psi = S.psi;
  const fx = sin(psi);
  const fz = cos(psi);
  const rx = fz;
  const rz = -fx;
  const camX = S.x;
  const camZ = S.z;
  const camY = S.y;
  const hor0 = S.hor;
  const bank = S.bank;
  for (let j = 0; j < NS; j++) {
    hj[j] = hor0 - (bank * ((j + 0.5) / 2 - 32)) / 32;
    ymin[j] = H;
    lastI[j] = -5;
  }
  aR.fill(0);
  aG.fill(0);
  aB.fill(0);
  cv.fill(0);

  // ---- the haze, which is the sky at the horizon of each column
  const hl = hazeLength(S.k[3]) / S.hazeMul;
  const invL = 1 / hl;
  const milk = 0.62 * sm(-0.2, 1, S.k[3]);
  for (let j = 0; j < NS; j++) {
    skyAt(j + 1, VO + 10);
    haze[j * 3] = SR + (P[21] * (0.55 + 0.45 * SR) - SR) * milk;
    haze[j * 3 + 1] = SG_ + (P[22] * (0.55 + 0.45 * SG_) - SG_) * milk;
    haze[j * 3 + 2] = SB_ + (P[23] * (0.55 + 0.45 * SB_) - SB_) * milk;
    skyAt(j + 1, VO + 1.5);
    hzh[j * 3] = SR + (P[21] * (0.55 + 0.45 * SR) - SR) * milk;
    hzh[j * 3 + 1] = SG_ + (P[22] * (0.55 + 0.45 * SG_) - SG_) * milk;
    hzh[j * 3 + 2] = SB_ + (P[23] * (0.55 + 0.45 * SB_) - SB_) * milk;
  }

  // ---- the sun in the camera's frame
  const cel = cos(S.el);
  const sF = cel * cra;
  const sR = cel * sin(S.relAz);
  const sU = sin(S.el);
  const invR = 1 / (1.8 * S.R);
  const aOff = S.aOff;
  const WGT = 0.5;

  for (let i = 0; i < NSTEP; i++) {
    const z = ZS[i];
    const n = NP[i];
    const du = DU[i];
    const bx = camX + z * fx;
    const bz = camZ + z * fz;
    const wo = i * OCT;
    const farFog = z > 230 ? 1 : 0;
    for (let k = -1; k <= n + 1; k++) {
      const lat = z * (-UH + k * du);
      const wx = bx + lat * rx;
      const wz = bz + lat * rz;
      EH[k + 1] = terrain(wx, wz, WT, wo);
      EP[k + 1] = farFog ? 0.5 : vn(wx * 0.021, wz * 0.021, 55);
    }
    const izd = 1 / (z * du);
    const Fz = F / z;
    const dzi = i > 0 ? z - ZS[i - 1] : 1;
    const idz = 1 / dzi;
    const tauK = z * invL;
    const fe = FOGEND[i];
    // lakes: how much of the sky they hold, by how steeply we look at them
    const dw = max(camY - sea, 4);
    const sinE = dw / sqrt(dw * dw + z * z);
    const fres = 0.12 + 0.88 * pow(1 - sinE, 2.2);
    const sparkAmt = sm(14, 48, z) * 0.95;
    let done = 0;
    for (let j = 0; j < NS; j++) {
      const ym = ymin[j];
      if (ym <= 0) {
        done++;
        continue;
      }
      const idx = i * NS + j;
      const k = IK[idx] + 1;
      const f = IFR[idx];
      const p0 = EH[k - 1];
      const p1 = EH[k];
      const p2 = EH[k + 1];
      const p3 = EH[k + 2];
      const c1 = 0.5 * (p2 - p0);
      const c2 = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
      const c3 = 0.5 * (p3 - p0) + 1.5 * (p1 - p2);
      const raw = p1 + f * (c1 + f * (c2 + f * c3));
      const dsea = sea - raw;
      const ww = dsea >= 0.6 ? 1 : dsea <= -0.6 ? 0 : (dsea + 0.6) / 1.2;
      const h = dsea > 0 ? sea : raw;
      const sy = hj[j] + (camY - h) * Fz;
      if (sy >= ym) {
        prevH[j] = h;
        continue;
      }
      const hz0 = haze[j * 3];
      const hz1 = haze[j * 3 + 1];
      const hz2 = haze[j * 3 + 2];
      let wr = 0;
      let wg = 0;
      let wb = 0;
      let lr = 0;
      let lg = 0;
      let lb = 0;
      if (ww > 0) {
        // the lake holds the sky, mirrored about the horizon, and is dark seen from above
        skyAt(j + 1, sy - hj[j] + VO);
        const wx = bx + z * UJ[j] * rx;
        const wz = bz + z * UJ[j] * rz;
        const rp = vn(wx * 0.4 + t * 0.21, wz * 0.95 - t * 0.33, 77);
        const sp = sm(0.62, 0.9, rp) * sparkAmt * SUNGLOW;
        const br = P[18];
        const bg = P[19];
        const bb = P[20];
        wr = br + (SR - br) * fres + sp * 0.95;
        wg = bg + (SG_ - bg) * fres + sp * 0.85;
        wb = bb + (SB_ - bb) * fres + sp * 0.7;
        const m = 1 - exp(-tauK * 1.1);
        wr += (hz0 - wr) * m;
        wg += (hz1 - wg) * m;
        wb += (hz2 - wb) * m;
        if (fe > 0) {
          wr += (hzh[j * 3] - wr) * fe;
          wg += (hzh[j * 3 + 1] - wg) * fe;
          wb += (hzh[j * 3 + 2] - wb) * fe;
        }
      }
      if (ww < 1) {
        const a = cl((raw - sea) * invR + aOff, 0, 1);
        const pat = EP[k] + (EP[k + 1] - EP[k]) * f;
        const gr = (c1 + f * (2 * c2 + 3 * c3 * f)) * izd;
        const gf = i > 0 ? (h - prevH[j]) * idz - UJ[j] * gr : 0;
        const inN = 1 / sqrt(1 + gf * gf + gr * gr);
        const L = (sU - gf * sF - gr * sR) * inN;
        const lit = L <= 0.04 ? 0 : L >= 0.6 ? 1 : sm(0.04, 0.6, L);
        let ai = ((a + 0.34 * (pat - 0.5)) * 63 + 0.5) | 0;
        ai = ai < 0 ? 0 : ai > 63 ? 63 : ai;
        const slope = sqrt(gf * gf + gr * gr);
        const dim = (1 - 0.35 * sm(0.3, 1.2, slope)) * (0.7 + 0.3 * inN);
        const a3 = ai * 3;
        lr = (ALS[a3] + (ALL[a3] - ALS[a3]) * lit) * dim;
        lg = (ALS[a3 + 1] + (ALL[a3 + 1] - ALS[a3 + 1]) * lit) * dim;
        lb = (ALS[a3 + 2] + (ALL[a3 + 2] - ALS[a3 + 2]) * lit) * dim;
        const tau = tauK * (0.55 + 1.5 * exp(-a * 5));
        const m = 1 - exp(-tau);
        lr += (hz0 - lr) * m;
        lg += (hz1 - lg) * m;
        lb += (hz2 - lb) * m;
        if (fe > 0) {
          lr += (hzh[j * 3] - lr) * fe;
          lg += (hzh[j * 3 + 1] - lg) * fe;
          lb += (hzh[j * 3 + 2] - lb) * fe;
        }
      }
      const cr = ww >= 1 ? wr : ww <= 0 ? lr : lr + (wr - lr) * ww;
      const cg = ww >= 1 ? wg : ww <= 0 ? lg : lg + (wg - lg) * ww;
      const cb = ww >= 1 ? wb : ww <= 0 ? lb : lb + (wb - lb) * ww;
      prevH[j] = h;
      // the strip runs from the colour just found at its top to the colour the last strip had at its foot,
      // so that stepping through depth shows as no stair
      const j3 = j * 3;
      const cont = lastI[j] === i - 1;
      lastI[j] = i;
      let pr = lastC[j3];
      let pg = lastC[j3 + 1];
      let pb = lastC[j3 + 2];
      if (!cont) {
        pr = cr;
        pg = cg;
        pb = cb;
      }
      lastC[j3] = cr;
      lastC[j3 + 1] = cg;
      lastC[j3 + 2] = cb;
      const yT = sy < 0 ? 0 : sy;
      const r0 = yT | 0;
      const r1 = ceil(ym) - 1;
      const x = j >> 1;
      const span = ym - yT;
      const isp = span > 1e-6 ? 1 / span : 0;
      const dr = pr - cr;
      const dg = pg - cg;
      const db = pb - cb;
      for (let r = r0; r <= r1; r++) {
        const top = r > yT ? r : yT;
        const bot = r + 1 < ym ? r + 1 : ym;
        const c = (bot - top) * WGT;
        if (c <= 0) continue;
        let tt = (0.5 * (top + bot) - yT) * isp;
        tt = tt > 1 ? 1 : tt;
        const p = r * W + x;
        aR[p] += (cr + dr * tt) * c;
        aG[p] += (cg + dg * tt) * c;
        aB[p] += (cb + db * tt) * c;
        cv[p] += c;
      }
      ymin[j] = yT;
    }
    if (done === NS) break;
  }

  // ---- sky above the land, with a deck of cloud lit from below, and out to the panel
  const cov = 0.45 + 0.2 * sin((TAU * t) / 157 + S.ph[21]) + 0.1 * sin((TAU * t) / 61 + S.ph[22]);
  const wX = t * 3.1;
  const wZ = t * 1.3;
  const CWr = P[(13 + 3) * 3];
  const CWg = P[(13 + 3) * 3 + 1];
  const CWb = P[(13 + 3) * 3 + 2];
  const CCr = P[(8 + 2) * 3];
  const CCg = P[(8 + 2) * 3 + 1];
  const CCb = P[(8 + 2) * 3 + 2];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let r = aR[p];
      let g = aG[p];
      let b = aB[p];
      const c = cv[p];
      if (c < 0.998) {
        const rem = 1 - c;
        const hjx = hor0 - (bank * (x + 0.5 - 32)) / 32;
        const vrow = hjx - (y + 0.5);
        skyAt(2 * x + 1, vrow + VO);
        let sr = SR;
        let sg = SG_;
        let sb = SB_;
        if (vrow > 1.5 && vrow < 58) {
          const u = (x + 0.5 - 32) / F;
          const tt = (260 * F) / vrow;
          const X = camX + tt * (fx + rx * u) + wX;
          const Z = camZ + tt * (fz + rz * u) + wZ;
          const nn = 0.62 * vn(X / 820, Z / 190, 301) + 0.38 * vn(X / 300, Z / 70, 302);
          const d = sm(0.88 - cov, 1.18 - cov, nn) * sm(1.5, 7, vrow) * (1 - sm(28, 58, vrow));
          if (d > 0.002) {
            const w = cl(0.3 + 1.2 * SUNGLOW + 0.5 * (1 - vrow / 50), 0, 1);
            const cr = (sr * 0.5 + CCr) * 0.7 * (1 - w) + CWr * w;
            const cg = (sg * 0.5 + CCg) * 0.7 * (1 - w) + CWg * w;
            const cb = (sb * 0.5 + CCb) * 0.7 * (1 - w) + CWb * w;
            const k = d * 0.75;
            sr += (cr - sr) * k;
            sg += (cg - sg) * k;
            sb += (cb - sb) * k;
          }
        }
        r += rem * sr;
        g += rem * sg;
        b += rem * sb;
      }
      display.setPixel(x, y, cl(r, 0, 1) * 255, cl(g, 0, 1) * 255, cl(b, 0, 1) * 255);
    }
  }
}
