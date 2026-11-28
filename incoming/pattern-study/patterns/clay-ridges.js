// ===== Patternflow pattern =====
// Title:   Clay Ridges
// Family:  occlusion
// Idea:    A sheet of matte clay is slowly shear-folded, its creases pinching, branching and sliding under a wandering swell, and it is lit by nothing but an overcast sky and a faint low sun, so every crease goes dark in proportion to how much of the sky its walls hide and the form shows without a single highlight.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: ambient occlusion (Sergey Zhukov, Andrei Iones and Grigorij Kronin, 1998, from memory), horizon-based ambient occlusion on a height field (Louis Bavoil, Miguel Sainz and Rouslan Dimitrov, 2008, from memory), pattern round 273
// Round:   273
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Relief=1..3.2, Folds=1..1.7, Sun=0..1
//
// Knob 1: Hue. placeholder.
// Knob 2: Relief. placeholder.
// Knob 3: Folds. placeholder.
// Knob 4: Sun. placeholder.

const W = 64, H = 128;
const { floor, ceil, sqrt, exp, sin, cos, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

const M = 12;                  // margin of the height grid, the search radius
const GW = W + 2 * M, GH = H + 2 * M;
const CX = 31.5, CY = 63.5;
const NW = GW / 2 + 1, NH = GH / 2 + 1; // coarse nodes of the smooth fields, every second cell

// ---------------------------------------------------------------- noise
const PERM = new Uint8Array(512);
const VAL = new Float32Array(256);
function seedNoise(r) {
  const p = [];
  for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) {
    const j = floor(r() * (i + 1)), t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  for (let i = 0; i < 256; i++) VAL[i] = r() * 2 - 1;
}
function noise3(x, y, z) {
  const xi = floor(x), yi = floor(y), zi = floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const w = zf * zf * zf * (zf * (zf * 6 - 15) + 10);
  const x0 = xi & 255, y0 = yi & 255, z0 = zi & 255;
  const A = PERM[x0] + y0, AA = PERM[A] + z0, AB = PERM[A + 1] + z0;
  const B = PERM[x0 + 1] + y0, BA = PERM[B] + z0, BB = PERM[B + 1] + z0;
  const c000 = VAL[PERM[AA]], c001 = VAL[PERM[AA + 1]], c010 = VAL[PERM[AB]], c011 = VAL[PERM[AB + 1]];
  const c100 = VAL[PERM[BA]], c101 = VAL[PERM[BA + 1]], c110 = VAL[PERM[BB]], c111 = VAL[PERM[BB + 1]];
  const x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
  const y0v = x00 + (x10 - x00) * v, y1v = x01 + (x11 - x01) * v;
  return y0v + (y1v - y0v) * w;
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function mulberry(seedv) {
  let a = seedv >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- buffers
const HG = new Float32Array(GW * GH);   // the height field, in LEDs
const FWX = new Float32Array(NW * NH), FWY = new Float32Array(NW * NH);
const FSW = new Float32Array(NW * NH), FAM = new Float32Array(NW * NH), FMK = new Float32Array(NW * NH), FMB = new Float32Array(NW * NH);
const FV0 = new Float32Array(NW * NH), FV1 = new Float32Array(NW * NH), FV2 = new Float32Array(NW * NH), FV3 = new Float32Array(NW * NH); // how far each family is squeezed
const N4W = GW / 4 + 1, N4H = GH / 4 + 1;          // the slow fields are solved on every fourth cell
const G4S = new Float32Array(N4W * N4H), G4A = new Float32Array(N4W * N4H), G4K = new Float32Array(N4W * N4H), G4B = new Float32Array(N4W * N4H);
const CGW = GW / 4, CGH = GH / 4;             // the height field averaged to 4 x 4 LEDs, for the wide occlusion
const HC = new Float32Array(CGW * CGH), VC = new Float32Array(CGW * CGH);
const CSTEP = [2, 4, 7], CRAD = 30;
const FH0 = new Float32Array(256), FH1 = new Float32Array(256), FH2 = new Float32Array(256); // the depth of each fold, by its number
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// horizon search: five steps in each of eight directions, integer offsets
const STEPS_AX = [2, 3, 5, 8, 11];
const STEPS_DG = [1, 2, 4, 6, 8];
const RAD = 12;
const DIRS = [];
for (let d = 0; d < 8; d++) {
  const dx = [1, 1, 0, -1, -1, -1, 0, 1][d], dy = [0, 1, 1, 1, 0, -1, -1, -1][d];
  const diag = dx !== 0 && dy !== 0;
  const st = diag ? STEPS_DG : STEPS_AX;
  const offs = [], wd = [];
  for (let k = 0; k < st.length; k++) {
    const dist = diag ? st[k] * Math.SQRT2 : st[k];
    offs.push((dy * st[k]) * GW + dx * st[k]);
    wd.push((1 - (dist / (RAD + 1)) * (dist / (RAD + 1))) / dist);
  }
  DIRS.push({ offs, wd });
}
const DX8 = [1, 1, 0, -1, -1, -1, 0, 1], DY8 = [0, 1, 1, 1, 0, -1, -1, -1];
const DO = new Int32Array(40), DWD = new Float32Array(40);
for (let d = 0; d < 8; d++)
  for (let k = 0; k < 5; k++) {
    DO[d * 5 + k] = DIRS[d].offs[k];
    DWD[d * 5 + k] = DIRS[d].wd[k];
  }

// ---------------------------------------------------------------- state
export function setup(params) {
  const r = mulberry((Math.random() * 4294967296) >>> 0);
  seedNoise(r);
  params.s = {
    t: 0, k: null,
    ph: Array.from({ length: 12 }, () => TAU * r()),
    off: Array.from({ length: 12 }, () => 100 * r()),
  };
  for (let i = 0; i < 256; i++) {
    FH0[i] = 0.6 + 0.8 * r();
    FH1[i] = 0.55 + 0.9 * r();
    FH2[i] = 0.55 + 0.9 * r();
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) S.k = [kv[0], kv[1], kv[2], kv[3]];
  const al = 1 - exp(-d / 0.2);
  for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  S.t += d;
}

// ---------------------------------------------------------------- draw
const AL = [0, 0, 0], SH = [0, 0, 0], SK = [0, 0, 0];
const GN = 2730.67;                       // gamma table steps to 1.0
const GAMMA = new Float32Array(4097);
for (let i = 0; i < GAMMA.length; i++) GAMMA[i] = min(255, 255 * pow(i / GN, 0.68));
const AMB = new Float32Array(1025), SUNV = new Float32Array(1025);

// the clays K1 walks through, as hue (running backwards round the wheel) and saturation:
// oat, terracotta, dusty rose, mauve, slate violet, slate blue, celadon, sage, bone
const CLAYS = [[0.082, 0.28, 0.76], [0.03, 0.42, 0.66], [-0.04, 0.3, 0.64], [-0.12, 0.27, 0.62], [-0.27, 0.3, 0.6], [-0.4, 0.36, 0.58], [-0.52, 0.3, 0.64], [-0.68, 0.3, 0.64], [-0.85, 0.3, 0.76]];

// per frame constants of the height field
let AW = 32, A1m = 2.5, A1 = 5, A2 = 1.7, AS = 20, KC0 = 0.1, CA0 = 1, SA0 = 0, PSI0 = 0, KC = 0.2, KB = 0.2, KF = 0.5, CA = 1, SA = 0, CB = 1, SB = 0, CA2 = 1, SA2 = 0, PSI1 = 0, PSI2 = 0, PSI3 = 0;
const EPS = 0.34, E2 = EPS * EPS, NRM = 1 / (sqrt(1 + E2) - EPS);

function hgt(x, y, wx, wy, sw, am, mb, mk, v0, v1, v2, v3) {
  const qx = x + AW * wx, qy = y + AW * wy;
  const th0 = KC0 * (qx * CA0 + qy * SA0) + PSI0, s0 = sin(th0);
  const th1 = KC * (qx * CA + qy * SA) + PSI1, s1 = sin(th1);
  const th2 = KB * (qx * CB + qy * SB) + PSI3, s2 = sin(th2);
  const th3 = KF * (qx * CA2 + qy * SA2) + PSI2, s3 = sin(th3);
  const d1 = FH1[floor(th1 / PI) & 255] * (sqrt(s1 * s1 + E2) - EPS);
  const d2 = FH2[floor(th2 / PI) & 255] * (sqrt(s2 * s2 + E2) - EPS);
  const g3 = sqrt(s3 * s3 + E2) - EPS;
  const d0 = FH0[floor(th0 / PI) & 255] * (sqrt(s0 * s0 + E2) - EPS);
  return AS * sw + NRM * (A1 * v0 * d0 + A1m * am * ((1 - mb) * v1 * d1 + mb * v2 * d2) + A2 * mk * v3 * g3);
}

function up(src, dst) {
  for (let j = 0; j < NH; j++) {
    const j0 = j >> 1, j1 = j0 + (j & 1);
    for (let i = 0; i < NW; i++) {
      const i0 = i >> 1, i1 = i0 + (i & 1);
      dst[j * NW + i] = 0.25 * (src[j0 * N4W + i0] + src[j0 * N4W + i1] + src[j1 * N4W + i0] + src[j1 * N4W + i1]);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const T = S.t, k = S.k, ph = S.ph, of = S.off;
  const relief = cl(k[1], 1, 3.2), folds = cl(k[2], 1, 1.7);
  const Pc = 17 / folds;                       // crease spacing, LEDs
  const P2 = max(5, Pc * 0.5);
  const alpha = 0.5 + 0.3 * sin(0.021 * T + ph[0]) + 0.18 * sin(0.0137 * T + ph[1]);
  const alpha2 = alpha + 0.95 + 0.4 * sin(0.017 * T + ph[2]);
  const alpha0 = alpha - 0.3 + 0.2 * sin(0.0113 * T + ph[9]);
  CA0 = cos(alpha0); SA0 = sin(alpha0);
  const alphb = alpha + 0.85 + 0.35 * sin(0.0173 * T + ph[7]);
  CA = cos(alpha); SA = sin(alpha); CA2 = cos(alpha2); SA2 = sin(alpha2); CB = cos(alphb); SB = sin(alphb);
  PSI1 = 0.2 * T - (0.16 / 0.113) * cos(0.113 * T + ph[3]) - (0.1 / 0.0517) * cos(0.0517 * T + ph[4]);
  PSI0 = 0.07 * T + 1.3 * sin(0.0237 * T + ph[10]);
  PSI2 = -0.09 * T;
  PSI3 = 0.1 * T + 1.7 * sin(0.0431 * T + ph[8]);
  AW = 28; A1 = 3.4 * relief; A1m = 0.5 * A1; A2 = 0.2 * A1; AS = 10 * relief;
  KC0 = PI / (Pc * 1.8); KC = PI / Pc; KB = PI / (Pc * 0.85); KF = PI / P2;

  // ---- the smooth fields: the warp on every second cell, the slow ones on every fourth
  const tz = T * 0.04, dx1 = T * 0.011, dy1 = T * 0.007;
  for (let j = 0; j < NH; j++) {
    const y = j * 2 - M - CY;
    for (let i = 0; i < NW; i++) {
      const x = i * 2 - M - CX, n = j * NW + i;
      const a = x / 56 + dx1 + of[0], b = y / 56 + dy1 + of[1];
      const a2 = x / 26 - dx1 * 1.6 + of[2], b2 = y / 26 + dy1 * 1.3 + of[3];
      FWX[n] = noise3(a, b, tz) + 0.38 * noise3(a2, b2, tz * 1.9 + 7.1);
      FWY[n] = noise3(a + 31.7, b + 11.3, tz + 3.7) + 0.38 * noise3(a2 + 17.2, b2 + 5.9, tz * 1.9 + 1.3);
    }
  }
  // where the warp squeezes a family of creases closer than the panel can draw, its folds fade out
  for (let j = 0; j < NH; j++) {
    const jm = j > 0 ? j - 1 : 0, jp = j < NH - 1 ? j + 1 : j, dj = 1 / ((jp - jm) * 2);
    for (let i = 0; i < NW; i++) {
      const im = i > 0 ? i - 1 : 0, ip = i < NW - 1 ? i + 1 : i, di = 1 / ((ip - im) * 2), n = j * NW + i;
      const xx = AW * (FWX[j * NW + ip] - FWX[j * NW + im]) * di, xy = AW * (FWX[jp * NW + i] - FWX[jm * NW + i]) * dj;
      const yx = AW * (FWY[j * NW + ip] - FWY[j * NW + im]) * di, yy = AW * (FWY[jp * NW + i] - FWY[jm * NW + i]) * dj;
      let gx = CA0 + xx * CA0 + yx * SA0, gy = SA0 + xy * CA0 + yy * SA0;
      FV0[n] = sm(5, 9, PI / (KC0 * sqrt(gx * gx + gy * gy) + 1e-6));
      gx = CA + xx * CA + yx * SA; gy = SA + xy * CA + yy * SA;
      FV1[n] = sm(4.8, 8.5, PI / (KC * sqrt(gx * gx + gy * gy) + 1e-6));
      gx = CB + xx * CB + yx * SB; gy = SB + xy * CB + yy * SB;
      FV2[n] = sm(4.8, 8.5, PI / (KB * sqrt(gx * gx + gy * gy) + 1e-6));
      gx = CA2 + xx * CA2 + yx * SA2; gy = SA2 + xy * CA2 + yy * SA2;
      FV3[n] = sm(4.4, 7.4, PI / (KF * sqrt(gx * gx + gy * gy) + 1e-6));
    }
  }
  for (let j = 0; j < N4H; j++) {
    const y = j * 4 - M - CY;
    for (let i = 0; i < N4W; i++) {
      const x = i * 4 - M - CX, n = j * N4W + i;
      G4S[n] = noise3(x / 100 + of[4] - dx1 * 0.5, y / 100 + of[5], tz * 0.6 + 2.2);
      G4A[n] = 0.5 + 0.75 * sm(-0.4, 0.5, noise3(x / 64 + of[6], y / 64 + of[7] + dy1, tz * 0.8 + 9.1));
      G4B[n] = sm(-0.25, 0.25, noise3(x / 52 + of[10] - dx1, y / 52 + of[11], tz * 0.9 + 5.7));
      G4K[n] = sm(-0.3, 0.3, noise3(x / 40 + of[8] + dx1, y / 40 + of[9], tz * 1.2 + 4.4));
    }
  }
  up(G4S, FSW); up(G4A, FAM); up(G4B, FMB); up(G4K, FMK);

  // ---- the height field, two cells at a time
  for (let cj = 0; cj < GH / 2; cj++) {
    const y0 = 2 * cj - M - CY;
    for (let ci = 0; ci < GW / 2; ci++) {
      const x0 = 2 * ci - M - CX;
      const n00 = cj * NW + ci, n01 = n00 + 1, n10 = n00 + NW, n11 = n10 + 1;
      const o = 2 * cj * GW + 2 * ci;
      let a = FWX[n00], b = FWX[n01], c = FWX[n10], d = FWX[n11];
      const wx1 = 0.5 * (a + b), wx2 = 0.5 * (a + c), wx3 = 0.25 * (a + b + c + d), wx0 = a;
      a = FWY[n00]; b = FWY[n01]; c = FWY[n10]; d = FWY[n11];
      const wy1 = 0.5 * (a + b), wy2 = 0.5 * (a + c), wy3 = 0.25 * (a + b + c + d), wy0 = a;
      a = FSW[n00]; b = FSW[n01]; c = FSW[n10]; d = FSW[n11];
      const sw1 = 0.5 * (a + b), sw2 = 0.5 * (a + c), sw3 = 0.25 * (a + b + c + d), sw0 = a;
      a = FAM[n00]; b = FAM[n01]; c = FAM[n10]; d = FAM[n11];
      const am1 = 0.5 * (a + b), am2 = 0.5 * (a + c), am3 = 0.25 * (a + b + c + d), am0 = a;
      a = FMB[n00]; b = FMB[n01]; c = FMB[n10]; d = FMB[n11];
      const mb1 = 0.5 * (a + b), mb2 = 0.5 * (a + c), mb3 = 0.25 * (a + b + c + d), mb0 = a;
      a = FMK[n00]; b = FMK[n01]; c = FMK[n10]; d = FMK[n11];
      const mk1 = 0.5 * (a + b), mk2 = 0.5 * (a + c), mk3 = 0.25 * (a + b + c + d), mk0 = a;
      a = FV0[n00]; b = FV0[n01]; c = FV0[n10]; d = FV0[n11];
      const a01 = 0.5 * (a + b), a02 = 0.5 * (a + c), a03 = 0.25 * (a + b + c + d), a00 = a;
      a = FV1[n00]; b = FV1[n01]; c = FV1[n10]; d = FV1[n11];
      const a11 = 0.5 * (a + b), a12 = 0.5 * (a + c), a13 = 0.25 * (a + b + c + d), a10 = a;
      a = FV2[n00]; b = FV2[n01]; c = FV2[n10]; d = FV2[n11];
      const a21 = 0.5 * (a + b), a22 = 0.5 * (a + c), a23 = 0.25 * (a + b + c + d), a20 = a;
      a = FV3[n00]; b = FV3[n01]; c = FV3[n10]; d = FV3[n11];
      const a31 = 0.5 * (a + b), a32 = 0.5 * (a + c), a33 = 0.25 * (a + b + c + d), a30 = a;
      HG[o] = hgt(x0, y0, wx0, wy0, sw0, am0, mb0, mk0, a00, a10, a20, a30);
      HG[o + 1] = hgt(x0 + 1, y0, wx1, wy1, sw1, am1, mb1, mk1, a01, a11, a21, a31);
      HG[o + GW] = hgt(x0, y0 + 1, wx2, wy2, sw2, am2, mb2, mk2, a02, a12, a22, a32);
      HG[o + GW + 1] = hgt(x0 + 1, y0 + 1, wx3, wy3, sw3, am3, mb3, mk3, a03, a13, a23, a33);
    }
  }

  // ---- how fast the sky closes: a low relief gets a steeper curve, so it still shows its creases
  const gA = 7 + 5 / relief, gS = 3 + 2 / relief;
  for (let i = 0; i <= 1024; i++) {
    AMB[i] = exp(-gA * (1 - i / 1024));
    SUNV[i] = exp(-gS * (1 - i / 1024));
  }

  // ---- palette
  const kq = cl(k[0], 0, 1) * (CLAYS.length - 1), kj = min(floor(kq), CLAYS.length - 2), ku = kq - kj;
  const ch = CLAYS[kj][0] + (CLAYS[kj + 1][0] - CLAYS[kj][0]) * ku, cs = CLAYS[kj][1] + (CLAYS[kj + 1][1] - CLAYS[kj][1]) * ku, cy = CLAYS[kj][2] + (CLAYS[kj + 1][2] - CLAYS[kj][2]) * ku;
  hsv(ch, cs, 1, AL);
  const Y = 0.299 * AL[0] + 0.587 * AL[1] + 0.114 * AL[2];
  const sc = cy / Y;
  const ar = AL[0] * sc, ag = AL[1] * sc, ab = AL[2] * sc;
  hsv(ch, min(1, cs * 2), 1, SH);
  const br = SH[0] * SH[0], bg = SH[1] * SH[1], bb = SH[2] * SH[2];
  hsv(0.68, 0.6, 1, SK);
  const sr = SK[0], sg = SK[1], sb = SK[2];

  // ---- the sun
  const az = k[3] * TAU + 0.55 * sin(0.067 * T + ph[5]) + 0.3 * sin(0.0291 * T + ph[6]);
  const el = 0.62;
  const lx = cos(az) * cos(el), ly = sin(az) * cos(el), lz = sin(el);

  // ---- wide occlusion: the same search on the 4 x 4 averaged field, out to 28 LEDs
  for (let cj = 0; cj < CGH; cj++)
    for (let ci = 0; ci < CGW; ci++) {
      let a = 0;
      const b = (cj * 4) * GW + ci * 4;
      for (let v = 0; v < 4; v++) for (let u = 0; u < 4; u++) a += HG[b + v * GW + u];
      HC[cj * CGW + ci] = a * 0.0625;
    }
  for (let cj = 0; cj < CGH; cj++)
    for (let ci = 0; ci < CGW; ci++) {
      const h0 = HC[cj * CGW + ci];
      let vis = 0;
      for (let d = 0; d < 8; d++) {
        const dx = DX8[d], dy = DY8[d];
        let t = 0;
        for (let s = 0; s < 3; s++) {
          const xx = cl(ci + dx * CSTEP[s], 0, CGW - 1), yy = cl(cj + dy * CSTEP[s], 0, CGH - 1);
          const dist = 4 * CSTEP[s] * (dx !== 0 && dy !== 0 ? 1.4142 : 1);
          const tt = (HC[yy * CGW + xx] - h0) * (1 - (dist / CRAD) * (dist / CRAD)) / dist;
          if (tt > t) t = tt;
        }
        vis += 1 / (1 + t * t);
      }
      VC[cj * CGW + ci] = vis * 0.125;
    }

  // ---- shade every pixel
  for (let y = 0; y < H; y++) {
    const fy = (y + M + 0.5) * 0.25 - 0.5, iy = floor(fy), uy = fy - iy;
    for (let x = 0; x < W; x++) {
      const idx = (y + M) * GW + (x + M), h0 = HG[idx];
      let vis = 0;
      for (let d = 0; d < 8; d++) {
        let t = 0;
        const b = d * 5;
        for (let s = 0; s < 5; s++) {
          const tt = (HG[idx + DO[b + s]] - h0) * DWD[b + s];
          if (tt > t) t = tt;
        }
        vis += 1 / (1 + t * t);
      }
      vis *= 0.125;
      const fx = (x + M + 0.5) * 0.25 - 0.5, ix = floor(fx), ux = fx - ix, cb = iy * CGW + ix;
      vis *= (VC[cb] * (1 - ux) + VC[cb + 1] * ux) * (1 - uy) + (VC[cb + CGW] * (1 - ux) + VC[cb + CGW + 1] * ux) * uy;
      const hx = 0.5 * (HG[idx + 1] - HG[idx - 1]), hy = 0.5 * (HG[idx + GW] - HG[idx - GW]);
      const nl = (lz - hx * lx - hy * ly) / sqrt(1 + hx * hx + hy * hy);
      const wrap = nl > -0.5 ? (nl + 0.5) / 1.5 : 0;
      const vi = (vis * 1024 + 0.5) | 0, vk = vi < 0 ? 0 : vi;
      const amb = AMB[vk], sun = wrap * SUNV[vk];
      const bounce = 0.2 * (1 - amb) * amb, fl = 0.03 * (1 - amb);
      const r = ar * (0.4 * amb + 0.9 * sun) + br * bounce + sr * fl;
      const g = ag * (0.44 * amb + 0.83 * sun) + bg * bounce + sg * fl;
      const bl = ab * (0.5 * amb + 0.75 * sun) + bb * bounce + sb * fl;
      const dth = (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) * 0.0625 - 0.5;
      const ri = (r * GN + 0.5) | 0, gi = (g * GN + 0.5) | 0, bi = (bl * GN + 0.5) | 0;
      display.setPixel(
        x, y,
        (GAMMA[ri > 4096 ? 4096 : ri] + dth + 0.5) | 0,
        (GAMMA[gi > 4096 ? 4096 : gi] + dth + 0.5) | 0,
        (GAMMA[bi > 4096 ? 4096 : bi] + dth + 0.5) | 0
      );
    }
  }
}
