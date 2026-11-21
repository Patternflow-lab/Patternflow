// ===== Patternflow pattern =====
// Title:   Penitentes
// Family:  alpine
// Idea:    A field of penitentes, the tall leaning blades of snow that sun and dry air carve on a high Andean slope, seen from low down across the rows under a low sun, so that every blade has a sunlit gold face, a cold blue shaded face and a long blue shadow lying on the snow, while the ranks behind grow smaller and paler toward a hazy ridge and a deep blue sky.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 210, after penitentes, the blades of snow that sublimation and trapped sunlight carve on dry high mountains, drawn back to front in the painter's algorithm with a pinhole view from eye height, Lambert's cosine law for the two faces of each blade and a shadow polygon cast along the ground away from the sun
// Round:   210
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sun=0..4, Height=-1..1, Crowd=-1..1
//
// Knob 1: Hue. Turns the sun, the sky and the shade round the wheel together. At 0 the sun is gold (low) or cream (high) and the shade is a steel blue; at 0.5 the light is cold cyan and the shade has gone amber; at 1 the picture is back where it began.
// Knob 2: Sun. Where the sun stands on average. At 0 it is far to the left and 8 degrees up, so the shadows lie almost level across the field and run off the right edge; at the opening 2 it is 35 degrees round toward the viewer's back and 20 degrees up; at 4 it is behind the viewer and 33 degrees up, the shadows run straight into the distance, both faces of a blade are lit and the contrast drops. On top of the knob the sun wanders about 30 degrees of azimuth and 7 of height on periods of 1 to 5 minutes, so the shadows swing, and its colour drifts from gold to cream to a cooler rose.
// Knob 3: Height. How tall the blades have grown. At -1 they are low bumps about a fifth of full height, 12 to 24 LEDs in the front rank; at the opening 0 the tallest front blades stand about 85 LEDs and poke above the horizon; at 1 they are 60 to 120 LEDs and reach the top of the panel. Every blade also grows and sublimates by about a fifth on its own slow period.
// Knob 4: Crowd. How close the blades stand. At -1 there are two or three blades across the front rank with bare snow and long shadows between them; at the opening 0.06 about four, 14 LEDs wide at the foot; at 1 a thicket of nine or ten that overlap, with the ranks behind packed to match.

const W = 64;
const H = 128;
const { sin, cos, tan, sqrt, exp, floor, ceil, max, min, abs, pow, PI } = Math;
const TAU = 2 * PI;
const DEG = PI / 180;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const CX = 32; // the view's centre column
const YH = 50; // the horizon row
const EYE = 84; // eye height in front-rank LEDs: the front rank's feet stand this many rows under the horizon
const FOC = 69; // focal length in the same unit, about a 50 degree view across 64 LEDs
const NR = 8; // ranks
const KR = 0.5; // depth step between ranks (depth u = 1 for the front rank, distance 1 + 0.5 per rank)
const HFULL = 118; // tallest blade in the front rank at Height 1, in LEDs
const SUNI = 0.98; // strength of the sun on a lit face
const CAP = 260; // blades at most
const STRAFE = 0.4; // sideways walk, front-rank LEDs a second at the opening spacing
const T0 = 41; // where the slow clock stands when the Lab starts

// base colours in linear light; the Hue knob turns them all
const GOLD = [1.0, 0.5, 0.14];
const CREAM = [1.0, 0.8, 0.56];
const ROSE = [1.0, 0.5, 0.58];
const AMB0 = [0.045, 0.15, 0.42];
const AMBV = [0.11, 0.13, 0.42];
const SKYTOP = [0.02, 0.07, 0.38];
const SKYMID = [0.04, 0.15, 0.5];
const SKYLOW = [0.3, 0.5, 0.78];
const MTA = [0.3, 0.4, 0.68];
const MTB = [0.17, 0.25, 0.54];
const MTLIT = [0.85, 0.62, 0.52];

// encode: linear light, soft knee above 0.6, then 1/2.2
const NLUT = 2048;
const ENC = new Uint8Array(NLUT + 1);
for (let i = 0; i <= NLUT; i++) {
  const x = (i / NLUT) * 2.5;
  const y = x < 0.6 ? x : 0.6 + 0.4 * (1 - exp(-(x - 0.6) / 0.4));
  ENC[i] = Math.round(255 * pow(y, 0.45));
}

function hash(i) {
  const h = sin(i * 12.9898 + 4.1414) * 43758.5453;
  return h - floor(h);
}
const ridge = (a) => 1 - abs(sin(a));

function mix3(a, b, t, o) {
  o[0] = a[0] + (b[0] - a[0]) * t;
  o[1] = a[1] + (b[1] - a[1]) * t;
  o[2] = a[2] + (b[2] - a[2]) * t;
}

export function setup(params) {
  const rowU = new Float32Array(H);
  const rowHz = new Float32Array(H);
  const rowSlab = new Uint8Array(H);
  const slabY0 = new Int16Array(NR).fill(H);
  const slabY1 = new Int16Array(NR).fill(-1);
  for (let y = YH; y < H; y++) {
    const u = EYE / (y + 0.5 - YH);
    rowU[y] = u;
    rowHz[y] = u < 1 ? 0 : 1 - exp(-0.3 * (u - 1));
    const j = cl(floor((u - 1) / KR + 0.5), 0, NR - 1);
    rowSlab[y] = j;
    if (y < slabY0[j]) slabY0[j] = y;
    if (y > slabY1[j]) slabY1[j] = y;
  }
  // the snow's own faint undulation, fixed to the ground
  const floorTex = new Float32Array(W * H);
  for (let y = YH; y < H; y++) {
    const u = rowU[y];
    for (let x = 0; x < W; x++) {
      const X = (x + 0.5 - CX) * u;
      floorTex[y * W + x] = 1 + 0.08 * sin(X * 0.037 + u * 2.1) * sin(X * 0.019 - u * 1.3 + 1.0) + 0.03 * sin(X * 0.11 + u * 4.3);
    }
  }
  // two ridges of far mountains, heights in rows above the horizon
  const mtA = new Float32Array(W + 2);
  const mtB = new Float32Array(W + 2);
  for (let x = 0; x < W + 2; x++) {
    mtA[x] = 5 + 8.5 * ridge(x * 0.062 + 0.9) * (0.6 + 0.4 * ridge(x * 0.173 + 2.0));
    mtB[x] = 2.5 + 4.5 * ridge(x * 0.11 + 3.2) * (0.55 + 0.45 * ridge(x * 0.29 + 0.4));
  }
  params.s = {
    t: T0,
    hue: 0,
    sunK: 0.5,
    hK: 0.5,
    cK: 0.53,
    rowU,
    rowHz,
    rowSlab,
    slabY0,
    slabY1,
    floorTex,
    mtA,
    mtB,
    buf: new Float32Array(W * H * 3),
    pal: {},
    // per blade
    nb: 0,
    bx: new Float32Array(CAP),
    by: new Float32Array(CAP),
    bH: new Float32Array(CAP),
    bw: new Float32Array(CAP),
    bwt: new Float32Array(CAP),
    bl: new Float32Array(CAP),
    bbd: new Float32Array(CAP),
    brr: new Float32Array(CAP),
    bp: new Float32Array(CAP),
    bhz: new Float32Array(CAP),
    bu: new Float32Array(CAP),
    bhl: new Float32Array(CAP),
    lit: new Float32Array(CAP * 3),
    shd: new Float32Array(CAP * 3),
    // shadow quads: four vertices, box, edge normals and offsets, length data
    sh: new Float32Array(CAP * 8),
    sbox: new Float32Array(CAP * 4),
    sed: new Float32Array(CAP * 12),
    sinfo: new Float32Array(CAP * 6),
    sA: new Float32Array(CAP),
    ord: new Uint16Array(CAP),
    rstart: new Int16Array(NR + 1),
    tmp: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const d = cl(dt || 0, 0, 0.1);
  const kn = input.knobValues || [0, 2, 0, 0.06];
  S.hue = cl(kn[0], 0, 1);
  S.sunK = cl(kn[1], 0, 4) / 4;
  S.hK = cl((kn[2] + 1) / 2, 0, 1);
  S.cK = cl((kn[3] + 1) / 2, 0, 1);
  S.t += d;
}

// ---- the frame's sun, colours and blades ----
function prepare(S) {
  const t = S.t;
  const P = S.pal;
  const tmp = S.tmp;
  // the sun: azimuth round from the left toward behind the viewer, and height
  const phi = (-6 + 66 * S.sunK) * DEG + (15 * sin(0.0213 * t + 0.8) + 9 * sin(0.0541 * t + 2.3) + 4 * sin(0.1137 * t + 4.1) + 3.5 * sin(0.2071 * t + 1.3)) * DEG;
  const el = max(5.5 * DEG, (8 + 25 * S.sunK) * DEG + (5 * sin(0.0307 * t + 1.5) + 2.5 * sin(0.0713 * t + 0.2)) * DEG);
  P.phi = phi;
  P.el = el;
  P.Sx = -cos(phi) * cos(el);
  P.Sy = sin(el);
  P.Sz = -sin(phi) * cos(el);
  P.Dx = cos(phi);
  P.Dz = sin(phi);
  P.lenK = min(1 / tan(el), 3.6);
  // the colours: gold when low, cream when high, a cooler rose now and then
  const wh = sm(9 * DEG, 36 * DEG, el);
  const ro = sm(0.55, 0.92, 0.5 + 0.34 * sin(0.0173 * t + 0.6) + 0.26 * sin(0.0411 * t + 2.0));
  P.ro = ro;
  // thin high cloud: the sun's strength swells and sags a few percent, never twice the same
  P.sunI = 1 + 0.04 * sin(0.467 * t + 0.4) + 0.035 * sin(0.0937 * t + 2.2) + 0.015 * sin(0.713 * t);
  // the hue turn rotates a colour's a and b in OKLab, so lightness and chroma stay put
  const hc = cos(S.hue * TAU);
  const hs = sin(S.hue * TAU);
  // lift raises lightness as the hue goes to the far side of the wheel, so a deep blue sky does not turn to brown
  const far = (1 - hc) / 2;
  const turn = (c, lift) => {
    if (S.hue < 1e-4) return [c[0], c[1], c[2]];
    const l_ = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]);
    const m_ = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]);
    const s_ = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
    const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_ + (lift || 0) * far;
    const cs = 1 - 0.22 * far;
    const a0 = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
    const b0 = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
    const a = (a0 * hc - b0 * hs) * cs;
    const b = (a0 * hs + b0 * hc) * cs;
    const l2 = L + 0.3963377774 * a + 0.2158037573 * b;
    const m2 = L - 0.1055613458 * a - 0.0638541728 * b;
    const s2 = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l2 * l2 * l2;
    const m = m2 * m2 * m2;
    const sx = s2 * s2 * s2;
    return [
      max(0, 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * sx),
      max(0, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * sx),
      max(0, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * sx),
    ];
  };
  mix3(GOLD, CREAM, wh, tmp);
  const sun0 = [tmp[0], tmp[1], tmp[2]];
  mix3(sun0, ROSE, 0.45 * ro, tmp);
  const sun = turn([tmp[0], tmp[1], tmp[2]]);
  P.sun = sun;
  mix3(AMB0, AMBV, 0.5 * ro, tmp);
  const amb = turn([tmp[0], tmp[1], tmp[2]], 0.1);
  P.amb = amb;
  P.skyTop = turn(SKYTOP, 0.26);
  P.skyMid = turn(SKYMID, 0.12);
  P.skyLow = turn(SKYLOW);
  // the horizon takes the sun's colour, pale
  const hor = turn([sun0[0] * 0.6 + 0.08 + 0.1 * ro, sun0[1] * 0.52 + 0.12, sun0[2] * 0.46 + 0.2 + 0.1 * ro]);
  P.hor = hor;
  P.haze = hor;
  // a far blade fades toward a bluer haze than the floor does
  const bh = turn([0.3, 0.36, 0.62]);
  P.bhaze = [hor[0] * 0.45 + bh[0] * 0.55, hor[1] * 0.45 + bh[1] * 0.55, hor[2] * 0.45 + bh[2] * 0.55];
  P.mtA = turn(MTA, 0.1);
  P.mtB = turn(MTB, 0.14);
  P.mtLit = turn(MTLIT);
  // snow floor: ambient from the sky plus the sun on level ground
  const fs = 0.54 * P.sunI * (0.55 + 0.45 * sin(el) / 0.34);
  P.floorAmb = [amb[0] * 0.3, amb[1] * 0.3, amb[2] * 0.3];
  P.floorSun = [sun[0] * fs, sun[1] * fs, sun[2] * fs];
  P.shadowC = [amb[0] * 1.05, amb[1] * 1.05, amb[2] * 1.05];
  // a cloud's shadow drifting over the field now and then
  P.cloudA = sm(0.18, 0.6, 0.5 + 0.4 * sin(0.0071 * t + 4.0) + 0.22 * sin(0.0173 * t + 1.0)) * 0.55;
  P.cx = 230 * sin(0.0113 * t + 0.6) + 80 * sin(0.0301 * t + 2.2);
  P.cu = 2.4 + 1.4 * sin(0.0079 * t + 1.9) + 0.4 * sin(0.0231 * t);

  buildBlades(S);
}

function cloud(P, X, u) {
  if (P.cloudA < 0.01) return 1;
  const dx = (X - P.cx) / 160;
  const du = (u - P.cu) / 1.2;
  return 1 - P.cloudA * exp(-(dx * dx + du * du));
}

function buildBlades(S) {
  const t = S.t;
  const P = S.pal;
  const hmul = 0.18 + 0.97 * pow(S.hK, 0.62);
  const sp0 = 44 * exp(-1.45 * S.cK);
  // the viewer walks slowly along the rows, so the field slides past with parallax and never comes round
  const sidx = (STRAFE * t + 14 * sin(0.0213 * t + 0.7)) / 21.3;
  const ny = 0.12;
  const sun = P.sun;
  const amb = P.amb;
  // lit faces are a warm white: the sun's colour with a share of white
  const sw = [0.95, 0.9, 0.85];
  let nb = 0;
  for (let j = 0; j < NR; j++) {
    S.rstart[j] = nb;
    const uj = 1 + KR * j;
    const sp = sp0 * pow(uj, 0.75);
    const XR = 52 * uj;
    const off = hash(j * 7.7 + 0.3) - 0.5;
    for (let i = floor(sidx - XR / sp - off - 1); i <= ceil(sidx + XR / sp - off + 1); i++) {
      if (nb >= CAP) break;
      const id = j * 131 + i * 7.31;
      const h1 = hash(id + 1.1);
      const h2 = hash(id + 2.7);
      const h3 = hash(id + 3.9);
      const h4 = hash(id + 5.3);
      const h5 = hash(id + 6.1);
      const h6 = hash(id + 7.7);
      const h7 = hash(id + 8.3);
      const h8 = hash(id + 9.9);
      const h9 = hash(id + 11.3);
      const h10 = hash(id + 12.1);
      const Xw = (i + off + 0.7 * (h1 - 0.5) - sidx) * sp;
      const u = 1 + KR * (j + 0.7 * (h2 - 0.5));
      const xs = CX + Xw / u;
      const hw0 = 7.5 * (0.78 + 0.4 * h3);
      const bw = max(hw0 / u, 1.9);
      if (xs + bw + 12 < 0 || xs - bw - 12 > W) continue;
      // height: its own size, the Height knob, and its own slow growth and sublimation
      const br =
        1 +
        0.09 * sin(0.093 * t * (0.8 + 0.5 * h9) + TAU * h10) +
        0.045 * sin(0.217 * t * (0.7 + 0.6 * h7) + TAU * h8) +
        0.03 * sin(0.0371 * t + 0.9);
      const Hw = HFULL * hmul * (0.5 + 0.65 * h4) * br;
      const Hs = Hw / u;
      const yf = YH + EYE / u;
      if (yf - Hs > H) continue;
      const k = nb;
      S.bx[k] = xs;
      S.by[k] = yf;
      S.bH[k] = Hs;
      S.bw[k] = bw;
      S.bwt[k] = max(0.9, 0.12 * bw);
      S.bl[k] = (-(0.1 + 0.05 * h5) * Hw) / u;
      S.bbd[k] = (h6 - 0.5) * 2.2;
      S.brr[k] = (h7 - 0.5) * 0.5 - 0.08;
      S.bp[k] = 1.0 + 0.35 * h8;
      S.bu[k] = u;
      S.bhz[k] = 1 - exp(-0.24 * (u - 1));
      // the two faces: yaw of the blade changes how much sun each takes
      const a = 0.7 + 0.35 * (h9 - 0.5);
      const cf = cloud(P, Xw, u);
      const lamL = max(0, cos(P.el) * sin(a + P.phi) + ny * P.Sy);
      const lamR = max(0, cos(P.el) * sin(P.phi - a) + ny * P.Sy);
      const aL = 0.5 + 0.4 * (1 - min(1, lamL * 1.4));
      const aR = 0.5 + 0.4 * (1 - min(1, lamR * 1.4));
      const kl = SUNI * P.sunI * lamL * cf * 0.95;
      const kr = SUNI * P.sunI * lamR * cf * 0.95;
      for (let c = 0; c < 3; c++) {
        S.lit[k * 3 + c] = amb[c] * aL + (sun[c] * 0.72 + 0.28 * sw[c]) * kl;
        S.shd[k * 3 + c] = amb[c] * aR + (sun[c] * 0.72 + 0.28 * sw[c]) * kr;
      }
      S.bhl[k] = min(1, lamL * 1.3) * cf;
      // the shadow: a quad on the ground running from the foot away from the sun
      const lh = min(Hw * P.lenK, 330);
      const hww = bw * u; // half width of the foot in ground units
      const leanW = -(0.1 + 0.05 * h5) * Hw;
      const dx = P.Dx;
      const dz = P.Dz;
      const px = -dz;
      const pz = dx;
      const s0 = hww * 0.85;
      const s1 = hww * 0.16;
      const back = hww * 0.6;
      // ground points (X, Z) with Z in front-rank units from the front rank
      const Zf = FOC * (u - 1);
      const gx = [
        Xw - dx * back + px * s0,
        Xw + leanW + dx * lh + px * s1,
        Xw + leanW + dx * lh - px * s1,
        Xw - dx * back - px * s0,
      ];
      const gz = [
        Zf - dz * back + pz * s0,
        Zf + dz * lh + pz * s1,
        Zf + dz * lh - pz * s1,
        Zf - dz * back - pz * s0,
      ];
      const vx = S.sh;
      let bx0 = 1e9;
      let bx1 = -1e9;
      let by0 = 1e9;
      let by1 = -1e9;
      for (let q = 0; q < 4; q++) {
        const uq = max(0.5, 1 + gz[q] / FOC);
        const sx = CX + gx[q] / uq;
        const sy = YH + EYE / uq;
        vx[k * 8 + q * 2] = sx;
        vx[k * 8 + q * 2 + 1] = sy;
        if (sx < bx0) bx0 = sx;
        if (sx > bx1) bx1 = sx;
        if (sy < by0) by0 = sy;
        if (sy > by1) by1 = sy;
      }
      S.sbox[k * 4] = bx0 - 1.5;
      S.sbox[k * 4 + 1] = bx1 + 1.5;
      S.sbox[k * 4 + 2] = by0 - 1.5;
      S.sbox[k * 4 + 3] = by1 + 1.5;
      // edge functions, positive inside
      let area = 0;
      for (let q = 0; q < 4; q++) {
        const q2 = (q + 1) & 3;
        area += vx[k * 8 + q * 2] * vx[k * 8 + q2 * 2 + 1] - vx[k * 8 + q2 * 2] * vx[k * 8 + q * 2 + 1];
      }
      const sg = area > 0 ? 1 : -1;
      for (let q = 0; q < 4; q++) {
        const q2 = (q + 1) & 3;
        const ax = vx[k * 8 + q * 2];
        const ay = vx[k * 8 + q * 2 + 1];
        const ex = vx[k * 8 + q2 * 2] - ax;
        const ey = vx[k * 8 + q2 * 2 + 1] - ay;
        const len = sqrt(ex * ex + ey * ey);
        const o = k * 12 + q * 3;
        if (len < 1e-4) {
          S.sed[o] = 0;
          S.sed[o + 1] = 0;
          S.sed[o + 2] = 1e3;
        } else {
          // dist = sg * (ex * (py - ay) - ey * (px - ax)) / len
          const nxx = (-sg * ey) / len;
          const nyy = (sg * ex) / len;
          S.sed[o] = nxx;
          S.sed[o + 1] = nyy;
          S.sed[o + 2] = -(nxx * ax + nyy * ay);
        }
      }
      S.sinfo[k * 6] = Xw;
      S.sinfo[k * 6 + 1] = Zf;
      S.sinfo[k * 6 + 2] = 1 / max(lh, 1);
      S.sA[k] = 0.92 * (0.4 + 0.6 * cf);
      nb++;
    }
    if (nb >= CAP) {
      for (let q = j + 1; q <= NR; q++) S.rstart[q] = nb;
      break;
    }
  }
  S.rstart[NR] = nb;
  S.nb = nb;
  // inside a rank, far blades first
  const ord = S.ord;
  for (let j = 0; j < NR; j++) {
    const a = S.rstart[j];
    const b = S.rstart[j + 1];
    for (let k = a; k < b; k++) ord[k] = k;
    for (let k = a + 1; k < b; k++) {
      const v = ord[k];
      let m = k - 1;
      while (m >= a && S.bu[ord[m]] < S.bu[v]) {
        ord[m + 1] = ord[m];
        m--;
      }
      ord[m + 1] = v;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  prepare(S);
  const P = S.pal;
  const buf = S.buf;
  const rowU = S.rowU;
  const rowHz = S.rowHz;

  // ---- sky, glow, mountains ----
  const skyTop = P.skyTop;
  const skyMid = P.skyMid;
  const hor = P.hor;
  const skyLow = P.skyLow;
  const sun = P.sun;
  // the glow toward the side the sun is on
  const side = max(0, -P.Sx) * 0.5 + 0.1;
  const ss = 1 + 0.8 * (P.sunI - 1);
  for (let y = 0; y < YH; y++) {
    const tt = min(1, (y + 0.5) / (YH - 9));
    const a = sm(0, 0.5, tt);
    const lw = sm(0.45, 0.85, tt);
    const b = sm(0.8, 1.0, tt);
    const gl = exp(-(1 - tt) * 5) * side;
    for (let x = 0; x < W; x++) {
      const gx = (1 - x / (W - 1)) * (1 - x / (W - 1));
      const g = gl * (0.35 + 0.9 * gx) * 0.55;
      const o = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) {
        let base = skyTop[c] + (skyMid[c] - skyTop[c]) * a;
        base += (skyLow[c] - base) * lw;
        buf[o + c] = (base + (hor[c] - base) * b + sun[c] * g) * ss;
      }
    }
  }
  paintRidge(S, S.mtA, P.mtA, 0.55);
  paintRidge(S, S.mtB, P.mtB, 0.4);

  // ---- floor ----
  const fA = P.floorAmb;
  const fS = P.floorSun;
  const haze = P.haze;
  for (let y = YH; y < H; y++) {
    const u = rowU[y];
    const hz = rowHz[y];
    for (let x = 0; x < W; x++) {
      const X = (x + 0.5 - CX) * u;
      const k = cloud(P, X, u) * S.floorTex[y * W + x];
      const o = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) {
        const v = fA[c] + fS[c] * k;
        buf[o + c] = v + (haze[c] - v) * hz;
      }
    }
  }

  // ---- ranks, far to near: the ground shadows that lie on this rank's rows, then the blades ----
  for (let j = NR - 1; j >= 0; j--) {
    shadowPass(S, S.slabY0[j], S.slabY1[j]);
    const a = S.rstart[j];
    const b = S.rstart[j + 1];
    for (let k = a; k < b; k++) drawBlade(S, S.ord[k]);
  }

  // ---- out ----
  const sc = NLUT / 2.5;
  let o = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = ENC[min(NLUT, (buf[o] * sc) | 0)];
      const g = ENC[min(NLUT, (buf[o + 1] * sc) | 0)];
      const bl = ENC[min(NLUT, (buf[o + 2] * sc) | 0)];
      display.setPixel(x, y, r, g, bl);
      o += 3;
    }
  }
}

function paintRidge(S, arr, base, litK) {
  const P = S.pal;
  const buf = S.buf;
  const lit = P.mtLit;
  const hor = P.hor;
  const sgn = -P.Sx > 0 ? 1 : -1;
  const side = 0.4 + 0.6 * min(1, max(0, -P.Sx + 0.2));
  for (let x = 0; x < W; x++) {
    const h = arr[x + 1];
    // slopes that face the sun catch its colour
    const slope = (arr[x + 2] - arr[x]) * 0.5 * sgn;
    const lm = cl(0.3 + 0.45 * slope, 0, 1) * litK * side;
    const y0 = max(0, floor(YH - h - 1));
    for (let y = y0; y <= YH + 1; y++) {
      const hy = YH - (y + 0.5);
      const cov = cl(h - hy + 0.5, 0, 1);
      if (cov <= 0) continue;
      // the foot melts into the warm horizon
      const f = cl(hy / h, 0, 1);
      const fade = 1 - f;
      const hzk = fade * fade * 0.85;
      const o = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) {
        let m = base[c] + (lit[c] - base[c]) * lm * (0.4 + 0.6 * f);
        m += (hor[c] - m) * hzk;
        buf[o + c] += (m - buf[o + c]) * cov;
      }
    }
  }
}

function shadowPass(S, ya, yb) {
  const P = S.pal;
  const buf = S.buf;
  const sc = P.shadowC;
  const haze = P.haze;
  const rowU = S.rowU;
  const rowHz = S.rowHz;
  const nb = S.nb;
  for (let k = 0; k < nb; k++) {
    const bb = k * 4;
    const y0 = max(ya, floor(S.sbox[bb + 2]));
    const y1 = min(yb, ceil(S.sbox[bb + 3]));
    if (y0 > y1) continue;
    const x0 = max(0, floor(S.sbox[bb]));
    const x1 = min(W - 1, ceil(S.sbox[bb + 1]));
    if (x0 > x1) continue;
    const eo = k * 12;
    const n0x = S.sed[eo];
    const n0y = S.sed[eo + 1];
    const n0c = S.sed[eo + 2];
    const n1x = S.sed[eo + 3];
    const n1y = S.sed[eo + 4];
    const n1c = S.sed[eo + 5];
    const n2x = S.sed[eo + 6];
    const n2y = S.sed[eo + 7];
    const n2c = S.sed[eo + 8];
    const n3x = S.sed[eo + 9];
    const n3y = S.sed[eo + 10];
    const n3c = S.sed[eo + 11];
    const Xf = S.sinfo[k * 6];
    const Zf = S.sinfo[k * 6 + 1];
    const il = S.sinfo[k * 6 + 2];
    const A = S.sA[k];
    const Dx = P.Dx;
    const Dz = P.Dz;
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      const u = rowU[y];
      const hz = rowHz[y];
      const soft = 1 + 0.8 * hz;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        let m = n0x * px + n0y * py + n0c;
        let v = n1x * px + n1y * py + n1c;
        if (v < m) m = v;
        v = n2x * px + n2y * py + n2c;
        if (v < m) m = v;
        v = n3x * px + n3y * py + n3c;
        if (v < m) m = v;
        const cov = cl(m / soft + 0.5, 0, 1);
        if (cov <= 0.004) continue;
        // lighter toward the far end of the shadow
        const X = (px - CX) * u;
        const tl = cl(((X - Xf) * Dx + (FOC * (u - 1) - Zf) * Dz) * il, 0, 1);
        const al = cov * A * (1 - 0.72 * tl);
        const o = (y * W + x) * 3;
        for (let c = 0; c < 3; c++) {
          const col = sc[c] + (haze[c] - sc[c]) * hz;
          buf[o + c] += (col - buf[o + c]) * al;
        }
      }
    }
  }
}

function drawBlade(S, b) {
  const P = S.pal;
  const buf = S.buf;
  const xf = S.bx[b];
  const yf = S.by[b];
  const Hs = S.bH[b];
  const bw = S.bw[b];
  const wt = S.bwt[b];
  const leanS = S.bl[b];
  const bnd = S.bbd[b] / S.bu[b];
  const rr = S.brr[b];
  const p = S.bp[b];
  const hz = S.bhz[b];
  const soft = 1 + 0.7 * hz;
  const o3 = b * 3;
  const lr = S.lit[o3];
  const lg = S.lit[o3 + 1];
  const lb = S.lit[o3 + 2];
  const sr = S.shd[o3];
  const sg = S.shd[o3 + 1];
  const sb = S.shd[o3 + 2];
  const hl = S.bhl[b];
  const haze = P.bhaze;
  const sun = P.sun;
  const amb = P.amb;
  // the bright edge on the sunlit ridge, and the warm bounce from lit snow at the foot
  const hr = sun[0] * 0.55 + 0.2;
  const hg = sun[1] * 0.55 + 0.2;
  const hb = sun[2] * 0.55 + 0.2;
  const y0 = max(0, floor(yf - Hs - 1));
  const y1 = min(H - 1, ceil(yf + 0.5));
  for (let y = y0; y <= y1; y++) {
    const hy = yf - (y + 0.5);
    const vcov = cl(Hs - hy + 0.5, 0, 1) * cl(hy + 0.5, 0, 1);
    if (vcov <= 0) continue;
    const uu = cl(hy / Hs, 0, 1);
    const hw = (wt + (bw - wt) * pow(1 - uu, p)) * cl((Hs - hy) / 2.5 + 0.35, 0.35, 1);
    const c = xf + leanS * uu + bnd * sin(uu * PI);
    const xl = c - hw;
    const xr = c + hw;
    const xg = c + rr * hw;
    const gv = (0.55 + 0.45 * sm(0, 0.4, uu)) * (1 + 0.22 * uu);
    const fx0 = max(0, floor(xl - 2));
    const fx1 = min(W - 1, ceil(xr + 2));
    for (let x = fx0; x <= fx1; x++) {
      const px = x + 0.5;
      const cov = cl((px - xl) / soft + 0.5, 0, 1) * cl((xr - px) / soft + 0.5, 0, 1) * vcov;
      if (cov <= 0.004) continue;
      const tf = cl((px - xg) / 1.1 + 0.5, 0, 1);
      const wm = 1 - tf;
      let r = (lr + (sr - lr) * tf) * gv;
      let g = (lg + (sg - lg) * tf) * gv * (1 - wm * 0.14 * (1 - uu));
      let bl = (lb + (sb - lb) * tf) * gv * (1 - wm * 0.3 * (1 - uu));
      // the sharp bright edge along the ridge
      const dr = px - xg;
      const e = exp(-(dr * dr) / 2.4) * hl * (1 - 0.55 * uu) * (dr < 0 ? 1 : 0.35);
      r += hr * e * 0.6;
      g += hg * e * 0.6;
      bl += hb * e * 0.6;
      const o = (y * W + x) * 3;
      r = r + (haze[0] - r) * hz;
      g = g + (haze[1] - g) * hz;
      bl = bl + (haze[2] - bl) * hz;
      buf[o] += (r - buf[o]) * cov;
      buf[o + 1] += (g - buf[o + 1]) * cov;
      buf[o + 2] += (bl - buf[o + 2]) * cov;
    }
  }
}
