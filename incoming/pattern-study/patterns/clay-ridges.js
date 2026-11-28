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
// @knobs Hue=0..1, Relief=0.4..3, Folds=1..1.8, Sun=0..1
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
const CGW = GW / 4, CGH = GH / 4;             // the height field averaged to 4 x 4 LEDs, for the wide occlusion
const HC = new Float32Array(CGW * CGH), VC = new Float32Array(CGW * CGH);
const CSTEP = [2, 4, 7], CRAD = 30;
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
const AL = [0, 0, 0], SH = [0, 0, 0];

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const T = S.t, k = S.k, ph = S.ph, of = S.off;
  const relief = cl(k[1], 0.4, 3), folds = cl(k[2], 1, 1.8);
  const Pc = 17 / folds;                       // crease spacing, LEDs
  const P2 = max(5, Pc * 0.5);
  const alpha = 0.5 + 0.3 * sin(0.021 * T + ph[0]) + 0.18 * sin(0.0137 * T + ph[1]);
  const alpha2 = alpha + 0.95 + 0.4 * sin(0.017 * T + ph[2]);
  const alphb = alpha + 0.85 + 0.35 * sin(0.0173 * T + ph[7]);
  const cb2 = cos(alphb), sb2 = sin(alphb), ca = cos(alpha), sa = sin(alpha), ca2 = cos(alpha2), sa2 = sin(alpha2);
  const v1 = 0.12 + 0.16 * sin(0.113 * T + ph[3]) + 0.1 * sin(0.0517 * T + ph[4]);
  const psi1 = 0.2 * T - (0.16 / 0.113) * cos(0.113 * T + ph[3]) - (0.1 / 0.0517) * cos(0.0517 * T + ph[4]);
  const psi2 = -0.09 * T, psi3 = 0.1 * T + 1.7 * sin(0.0431 * T + ph[8]);
  void v1;

  // ---- the smooth fields on the coarse nodes
  const tz = T * 0.04, dx1 = T * 0.011, dy1 = T * 0.007;
  for (let j = 0; j < NH; j++) {
    const y = j * 2 - M - CY;
    for (let i = 0; i < NW; i++) {
      const x = i * 2 - M - CX, n = j * NW + i;
      const a = x / 56 + dx1 + of[0], b = y / 56 + dy1 + of[1];
      const a2 = x / 26 - dx1 * 1.6 + of[2], b2 = y / 26 + dy1 * 1.3 + of[3];
      FWX[n] = noise3(a, b, tz) + 0.38 * noise3(a2, b2, tz * 1.9 + 7.1);
      FWY[n] = noise3(a + 31.7, b + 11.3, tz + 3.7) + 0.38 * noise3(a2 + 17.2, b2 + 5.9, tz * 1.9 + 1.3);
      FSW[n] = noise3(x / 100 + of[4] - dx1 * 0.5, y / 100 + of[5], tz * 0.6 + 2.2);
      FAM[n] = 0.5 + 0.75 * sm(-0.4, 0.5, noise3(x / 64 + of[6], y / 64 + of[7] + dy1, tz * 0.8 + 9.1));
      FMB[n] = sm(-0.25, 0.25, noise3(x / 52 + of[10] - dx1, y / 52 + of[11], tz * 0.9 + 5.7));
      FMK[n] = sm(-0.3, 0.3, noise3(x / 40 + of[8] + dx1, y / 40 + of[9], tz * 1.2 + 4.4));
    }
  }

  // ---- the height field on the full grid
  const AW = 32, A1 = 3.2 * relief, A2 = 0.34 * A1, AS = 12 * relief;
  const kc = PI / Pc, kb = PI / (Pc * 0.85), kf = PI / P2, EPS = 0.34, E2 = EPS * EPS, NRM = 1 / (sqrt(1 + E2) - EPS);
  for (let gy = 0; gy < GH; gy++) {
    const y = gy - M - CY, jn = gy >> 1, jodd = gy & 1;
    for (let gx = 0; gx < GW; gx++) {
      const x = gx - M - CX, in_ = gx >> 1, iodd = gx & 1;
      const j1 = jn + jodd, i1 = in_ + iodd;
      const n00 = jn * NW + in_, n01 = jn * NW + i1, n10 = j1 * NW + in_, n11 = j1 * NW + i1;
      const wx = 0.25 * (FWX[n00] + FWX[n01] + FWX[n10] + FWX[n11]);
      const wy = 0.25 * (FWY[n00] + FWY[n01] + FWY[n10] + FWY[n11]);
      const sw = 0.25 * (FSW[n00] + FSW[n01] + FSW[n10] + FSW[n11]);
      const am = 0.25 * (FAM[n00] + FAM[n01] + FAM[n10] + FAM[n11]);
      const mk = 0.25 * (FMK[n00] + FMK[n01] + FMK[n10] + FMK[n11]);
      const mb = 0.25 * (FMB[n00] + FMB[n01] + FMB[n10] + FMB[n11]);
      const qx = x + AW * wx, qy = y + AW * wy;
      const th1 = kc * (qx * ca + qy * sa) + psi1;
      const s1 = sin(th1);
      const th1b = kb * (qx * cb2 + qy * sb2) + psi3;
      const s1b = sin(th1b);
      const g1 = (1 - mb) * (sqrt(s1 * s1 + E2) - EPS) * NRM + mb * (sqrt(s1b * s1b + E2) - EPS) * NRM;
      const th2 = kf * (qx * ca2 + qy * sa2) + psi2;
      const s2 = sin(th2);
      const g2 = (sqrt(s2 * s2 + E2) - EPS) * NRM;
      HG[gy * GW + gx] = AS * sw + A1 * am * g1 + A2 * mk * g2;
    }
  }

  // ---- palette
  hsv(0.09 + k[0], 0.32, 1, AL);
  const Y = 0.299 * AL[0] + 0.587 * AL[1] + 0.114 * AL[2];
  const sc = 0.76 / Y;
  const ar = AL[0] * sc, ag = AL[1] * sc, ab = AL[2] * sc;
  hsv(0.075 + k[0], 0.75, 1, SH);
  const br = SH[0] * SH[0], bg = SH[1] * SH[1], bb = SH[2] * SH[2];
  hsv(0.68, 0.6, 1, SH);
  const sr = SH[0], sg = SH[1], sb = SH[2];

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
    for (let x = 0; x < W; x++) {
      const idx = (y + M) * GW + (x + M), h0 = HG[idx];
      let vis = 0;
      for (let d = 0; d < 8; d++) {
        let t = 0;
        const b = d * 5;
        for (let s = 0; s < 5; s++) {
          const dh = HG[idx + DO[b + s]] - h0;
          const tt = dh * DWD[b + s];
          if (tt > t) t = tt;
        }
        vis += 1 / (1 + t * t);
      }
      vis *= 0.125;
      {
        const fx = (x + M + 0.5) * 0.25 - 0.5, fy = (y + M + 0.5) * 0.25 - 0.5;
        const ix = floor(fx), iy = floor(fy), ux = fx - ix, uy = fy - iy, cb = iy * CGW + ix;
        const cv = (VC[cb] * (1 - ux) + VC[cb + 1] * ux) * (1 - uy) + (VC[cb + CGW] * (1 - ux) + VC[cb + CGW + 1] * ux) * uy;
        vis = vis * cv;
      }
      const hx = 0.5 * (HG[idx + 1] - HG[idx - 1]), hy = 0.5 * (HG[idx + GW] - HG[idx - GW]);
      const nl = (lz - hx * lx - hy * ly) / sqrt(1 + hx * hx + hy * hy);
      const wrap = max(0, (nl + 0.3) / 1.3);
      const amb = exp(-9 * (1 - vis));
      const sun = wrap * exp(-4 * (1 - vis));
      const bounce = 0.2 * (1 - amb) * amb;
      let r = ar * (0.55 * amb * 0.88 + 0.62 * sun * 1.06) + br * bounce + sr * 0.03 * (1 - amb);
      let g = ag * (0.55 * amb * 0.96 + 0.62 * sun * 0.98) + bg * bounce + sg * 0.03 * (1 - amb);
      let bl = ab * (0.55 * amb * 1.1 + 0.62 * sun * 0.88) + bb * bounce + sb * 0.03 * (1 - amb);
      const dth = (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16 - 0.5;
      r = pow(cl(r, 0, 1.5), 0.68) * 255 + dth;
      g = pow(cl(g, 0, 1.5), 0.68) * 255 + dth;
      bl = pow(cl(bl, 0, 1.5), 0.68) * 255 + dth;
      display.setPixel(x, y, cl(floor(r + 0.5), 0, 255), cl(floor(g + 0.5), 0, 255), cl(floor(bl + 0.5), 0, 255));
    }
  }
}
