// ===== Patternflow pattern =====
// Title:   Barred Galaxy
// Family:  bargalaxy
// Idea:    A barred spiral galaxy built only from orbits, tens of thousands of massless stars circling in a rotating bar potential until the bar glows amber along its length, a blue ring gathers at the outer resonance and spiral arms peel off the bar ends, while new stars keep being born on circular orbits and old ones fade, so the picture never settles.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the x1 family of bar-aligned orbits (George Contopoulos and Papayannopoulos, 1980); outer rings and arms as the response of stars to a bar near its Lindblad resonances (Schwarz, 1981); the quadrupole bar with a cubic radial profile (Walter Dehnen, 2000); Sandage and de Vaucouleurs' classes of barred spirals; leapfrog time stepping; pattern round 224
// Round:   224
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.5..6, Bar=-1..1, Tilt=-1..1
//
// Knob 1: Hue.
// Knob 2: Pace.
// Knob 3: Bar.
// Knob 4: Tilt.

const W = 64;
const H = 128;
const NPX = W * H;
const HW = 32;
const HH = 64;
const { floor, exp, sin, cos, sqrt, abs, min, max, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

const N = 48000; // test stars
const TU = 13; // seconds of display per model unit at Pace 1
// Model units: the flat rotation speed is about 0.9 and the disk ends at radius 1.
const VH2 = 0.78; // halo, circular speed squared at large radius
const RC2 = 0.25 * 0.25; // halo core radius, squared
const MB = 0.1; // bulge mass
const B2 = 0.07 * 0.07; // bulge softening, squared
const RB = 0.38; // the bar potential turns over here
const RB3 = RB * RB * RB;
const EB2 = 0.04 * 0.04; // bar softening, squared
const OMP0 = 1.9; // bar pattern speed, radians per unit
const LIFE = 16; // a star's life in units
const RMAX = 1.18; // a star this far out is born again
const GROW = 6; // a star feels the bar fully only after this many units
const PRE = 16; // units run before the first frame
const HPRE = 0.02; // leapfrog step of the pre-run

const gauss = () => {
  let s = 0;
  for (let i = 0; i < 6; i++) s += Math.random();
  return (s - 3) * 1.4142;
};

function vcirc2(r) {
  const q = r * r;
  return (VH2 * q) / (q + RC2) + (MB * q) / ((q + B2) * sqrt(q + B2));
}

function pickR() {
  const u = Math.random();
  if (u < 0.09) return 0.07 * sqrt(-2 * log(1 - Math.random()));
  if (u < 0.62) return -0.22 * log((1 - Math.random()) * (1 - Math.random()));
  return sqrt(0.09 + Math.random() * 0.91);
}

// A new star on a nearly circular orbit at a random radius and angle.
function spawn(S, i, aged) {
  let r = pickR();
  if (r < 0.015) r = 0.015;
  if (r > 1.0) r = 0.6 + 0.4 * Math.random();
  const ph = TAU * Math.random();
  const c = cos(ph), s = sin(ph);
  const vc = sqrt(vcirc2(r));
  const sg = 0.03 + 0.03 * Math.random();
  const vr = sg * gauss();
  const vt = vc * (1 + 0.5 * sg * gauss());
  S.px[i] = r * c;
  S.py[i] = r * s;
  S.vx[i] = vr * c - vt * s;
  S.vy[i] = vr * s + vt * c;
  S.pz[i] = (0.015 + 0.06 * exp(-(r * r) / 0.03)) * cl(gauss(), -2.2, 2.2);
  S.life[i] = LIFE * (0.7 + 0.6 * Math.random());
  S.age[i] = aged ? S.life[i] * Math.random() : 0;
  S.gr[i] = 0;
  S.bri[i] = 0.7 + 0.6 * Math.random();
}

export function setup(params) {
  const S = {
    t: 0, // model time
    wall: 0,
    first: true,
    k: [0, 2, 0, 0.06],
    sk: [0, 2, 0, 0.06],
    phiB: Math.random() * TAU,
    ph: Array.from({ length: 12 }, () => Math.random() * TAU),
    px: new Float32Array(N), py: new Float32Array(N), pz: new Float32Array(N),
    vx: new Float32Array(N), vy: new Float32Array(N),
    age: new Float32Array(N), life: new Float32Array(N), bri: new Float32Array(N), gr: new Float32Array(N),
    F: new Float32Array(NPX * 3),
    M: new Float32Array(NPX * 3),
    T: new Float32Array(NPX * 3),
    HB: new Float32Array(HW * HH * 3),
    HT: new Float32Array(HW * HH * 3),
    lut: new Float32Array(4097),
    ramp: 0,
  };
  for (let i = 0; i <= 4096; i++) {
    const x = i / 512;
    S.lut[i] = Math.pow(Math.log(1 + 8 * x) / Math.log(1 + 8 * 8), 1.35);
  }
  params.s = S;
}

// The pattern speed wanders on three periods that do not divide each other.
function ompOf(S, t) {
  const p = S.ph;
  return OMP0 * (1 + 0.1 * sin((TAU * t) / 23.1 + p[0]) + 0.07 * sin((TAU * t) / 37.7 + p[1]) + 0.05 * sin((TAU * t) / 61.3 + p[2]));
}

// Strength of the bar potential, as the amplitude A (negative: the bar is a minimum along its axis).
function ampOf(S, t, bar) {
  const p = S.ph;
  const eps = bar < 0 ? 0.26 * (1 + bar) : 0.26 * (1 + 0.9 * bar);
  const wob = 1 + 0.12 * sin((TAU * t) / 17.3 + p[3]) + 0.08 * sin((TAU * t) / 29.9 + p[4]);
  return -0.5 * eps * wob * S.ramp;
}

// One leapfrog step of h units (velocities live half a step ahead of positions).
function step(S, h, A) {
  S.phiB += ompOf(S, S.t) * h;
  S.t += h;
  const c = cos(2 * S.phiB), s = sin(2 * S.phiB);
  const { px, py, vx, vy, age, life, gr } = S;
  for (let i = 0; i < N; i++) {
    const x = px[i] + vx[i] * h;
    const y = py[i] + vy[i] * h;
    const a = age[i] + h;
    if (a > life[i]) {
      spawn(S, i, false);
      continue;
    }
    age[i] = a;
    const g = gr[i] + h;
    gr[i] = g;
    const gt = g < GROW ? g / GROW : 1;
    const Ag = A * (gt * gt * (3 - 2 * gt));
    const AR3 = Ag * RB3;
    const x2 = x * x, y2 = y * y;
    const r2 = x2 + y2;
    const rh = r2 + RC2;
    const rb = r2 + B2;
    // axisymmetric part: cored halo and a Plummer bulge
    let fx = -(VH2 * x) / rh - (MB * x) / (rb * sqrt(rb));
    let fy = -(VH2 * y) / rh - (MB * y) / (rb * sqrt(rb));
    // the bar
    const Q = (x2 - y2) * c + 2 * x * y * s;
    const Qx = 2 * (x * c + y * s);
    const Qy = 2 * (x * s - y * c);
    const q2 = r2 + EB2;
    const q = sqrt(q2);
    if (q > RB) {
      const i5 = 1 / (q2 * q2 * q);
      const k7 = (5 * AR3 * Q * i5) / q2;
      fx -= AR3 * Qx * i5 - k7 * x;
      fy -= AR3 * Qy * i5 - k7 * y;
    } else {
      const p = 2 / q2 - q / RB3;
      const d = (-4 / (q2 * q2) - 1 / (q * RB3)) * Q;
      fx -= Ag * (Qx * p + d * x);
      fy -= Ag * (Qy * p + d * y);
    }
    if (r2 > RMAX * RMAX) {
      spawn(S, i, false);
      continue;
    }
    vx[i] += fx * h;
    vy[i] += fy * h;
    px[i] = x;
    py[i] = y;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  if (S.first) {
    S.sk = S.k.slice();
    S.first = false;
    for (let i = 0; i < N; i++) spawn(S, i, true);
    // run the bar in so the first frame already shows it
    const n = floor(PRE / HPRE);
    for (let k = 0; k < n; k++) {
      S.ramp = sm(0, PRE * 0.45, k * HPRE);
      step(S, HPRE, ampOf(S, S.t, S.sk[2]));
    }
    S.ramp = 1;
  }
  const sk = S.sk;
  const k = S.k;
  const rate = [0.3, 0.5, 0.8, 0.5];
  for (let i = 0; i < 4; i++) sk[i] += (k[i] - sk[i]) * (1 - exp(-dt / rate[i]));
  S.wall += dt;
  const pace = cl(sk[1], 0.3, 8) / 2;
  const h = (dt * pace) / TU;
  if (h > 0) step(S, h, ampOf(S, S.t, sk[2]));
}

// ---- colour -------------------------------------------------------------

function hueRGB(h, sat, o) {
  h = h - floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return 1 - sat * max(0, min(k, 4 - k, 1));
  };
  o[0] = f(5);
  o[1] = f(3);
  o[2] = f(1);
}
const TW = [0, 0, 0];
const TC = [0, 0, 0];
const TV = [0, 0, 0];
const px3 = [0, 0, 0];

// ---- drawing ------------------------------------------------------------

function blur(src, tmp, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      const l = x > 0 ? o - 3 : o;
      const r = x < w - 1 ? o + 3 : o;
      tmp[o] = 0.25 * src[l] + 0.5 * src[o] + 0.25 * src[r];
      tmp[o + 1] = 0.25 * src[l + 1] + 0.5 * src[o + 1] + 0.25 * src[r + 1];
      tmp[o + 2] = 0.25 * src[l + 2] + 0.5 * src[o + 2] + 0.25 * src[r + 2];
    }
  }
  const s = w * 3;
  for (let y = 0; y < h; y++) {
    const up = y > 0 ? -s : 0;
    const dn = y < h - 1 ? s : 0;
    for (let x = 0; x < s; x++) {
      const o = y * s + x;
      src[o] = 0.25 * tmp[o + up] + 0.5 * tmp[o] + 0.25 * tmp[o + dn];
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const { F, M, T, HB, HT, lut, px, py, pz, vx, vy, age, life, bri } = S;
  const sk = S.sk;
  const t = S.wall;
  F.fill(0);
  M.fill(0);
  HB.fill(0);
  hueRGB(0.085 + sk[0], 0.62, TW);
  hueRGB(0.6 + sk[0], 0.66, TC);
  hueRGB(0.76 + sk[0], 0.55, TV);
  // the view: inclination, a slow roll of the line of nodes, and a small wobble of the tilt
  const incl = ((58 + 18 * cl(sk[3], -1, 1)) * PI) / 180 + 0.05 * sin((TAU * t) / 97 + S.ph[5]);
  const ci = cos(incl), si = sin(incl);
  const roll = 0.07 * sin((TAU * t) / 83 + S.ph[6]) + 0.04 * sin((TAU * t) / 131 + S.ph[7]);
  const cr = cos(roll), sr = sin(roll);
  const sc = min(56, 29 / max(0.25, ci));
  for (let i = 0; i < N; i++) {
    const x = px[i], y = py[i], z = pz[i];
    const u0 = y * ci - z * si;
    const v0 = x;
    const sx = 32 + sc * (u0 * cr - v0 * sr);
    const sy = 64 - sc * (u0 * sr + v0 * cr);
    if (sx < 1 || sx > W - 2 || sy < 1 || sy > H - 2) continue;
    const r2 = x * x + y * y;
    const r = sqrt(r2);
    const a = age[i];
    const l = life[i];
    const env = sm(0, 0.8, a) * (1 - sm(l - 3, l, a));
    if (env <= 0.001) continue;
    // how far the orbit is from circular decides the tint: bar stars are hot and old, ring and arm stars cold
    const vr = (x * vx[i] + y * vy[i]) / (r + 1e-4);
    const vt = (x * vy[i] - y * vx[i]) / (r + 1e-4);
    const vc = sqrt(vcirc2(r));
    const dv = vt - vc;
    const hot = sqrt(vr * vr + 2 * dv * dv) / (vc + 0.05);
    const cool = 1 - sm(0.1, 0.45, hot);
    const w = 0.075 * env * bri[i] * (0.8 + 0.9 * cool);
    const wr = w * (TW[0] * (1 - cool) + TC[0] * cool);
    const wg = w * (TW[1] * (1 - cool) + TC[1] * cool);
    const wb = w * (TW[2] * (1 - cool) + TC[2] * cool);
    // the sparse outer disk is spread wider so the stars do not read as separate dots
    const hf = 0.75 * sm(0.55, 0.95, r);
    const ff = 1 - sm(0.22, 0.6, r);
    const mf = 1 - ff - hf;
    const ix = floor(sx), iy = floor(sy);
    const tx = sx - ix, ty = sy - iy;
    const o = (iy * W + ix) * 3;
    const o2 = o + W * 3;
    const b00 = (1 - tx) * (1 - ty), b10 = tx * (1 - ty), b01 = (1 - tx) * ty, b11 = tx * ty;
    if (ff > 0.01) {
      const q0 = b00 * ff, q1 = b10 * ff, q2 = b01 * ff, q3 = b11 * ff;
      F[o] += wr * q0; F[o + 1] += wg * q0; F[o + 2] += wb * q0;
      F[o + 3] += wr * q1; F[o + 4] += wg * q1; F[o + 5] += wb * q1;
      F[o2] += wr * q2; F[o2 + 1] += wg * q2; F[o2 + 2] += wb * q2;
      F[o2 + 3] += wr * q3; F[o2 + 4] += wg * q3; F[o2 + 5] += wb * q3;
    }
    if (mf > 0.01) {
      const q0 = b00 * mf, q1 = b10 * mf, q2 = b01 * mf, q3 = b11 * mf;
      M[o] += wr * q0; M[o + 1] += wg * q0; M[o + 2] += wb * q0;
      M[o + 3] += wr * q1; M[o + 4] += wg * q1; M[o + 5] += wb * q1;
      M[o2] += wr * q2; M[o2 + 1] += wg * q2; M[o2 + 2] += wb * q2;
      M[o2 + 3] += wr * q3; M[o2 + 4] += wg * q3; M[o2 + 5] += wb * q3;
    }
    if (hf > 0.01) {
      const hx = sx * 0.5 - 0.5, hy = sy * 0.5 - 0.5;
      const jx = max(0, min(HW - 2, floor(hx))), jy = max(0, min(HH - 2, floor(hy)));
      const ux = cl(hx - jx, 0, 1), uy = cl(hy - jy, 0, 1);
      const p = (jy * HW + jx) * 3;
      const p2 = p + HW * 3;
      const h00 = (1 - ux) * (1 - uy) * hf, h10 = ux * (1 - uy) * hf, h01 = (1 - ux) * uy * hf, h11 = ux * uy * hf;
      HB[p] += wr * h00; HB[p + 1] += wg * h00; HB[p + 2] += wb * h00;
      HB[p + 3] += wr * h10; HB[p + 4] += wg * h10; HB[p + 5] += wb * h10;
      HB[p2] += wr * h01; HB[p2 + 1] += wg * h01; HB[p2 + 2] += wb * h01;
      HB[p2 + 3] += wr * h11; HB[p2 + 4] += wg * h11; HB[p2 + 5] += wb * h11;
    }
  }
  blur(F, T, W, H);
  blur(M, T, W, H);
  blur(M, T, W, H);
  blur(M, T, W, H);
  blur(HB, HT, HW, HH);
  blur(HB, HT, HW, HH);
  blur(HB, HT, HW, HH);
  const cb = cos(S.phiB), sb = sin(S.phiB);
  for (let y = 0; y < H; y++) {
    const hy = y * 0.5 - 0.25;
    const y0 = max(0, min(HH - 1, floor(hy)));
    const y1 = min(HH - 1, y0 + 1);
    const fy = cl(hy - y0, 0, 1);
    const syr = (64 - (y + 0.5)) / sc;
    for (let x = 0; x < W; x++) {
      const hx = x * 0.5 - 0.25;
      const x0 = max(0, min(HW - 1, floor(hx)));
      const x1 = min(HW - 1, x0 + 1);
      const fx = cl(hx - x0, 0, 1);
      const o = (y * W + x) * 3;
      const a = (y0 * HW + x0) * 3, b = (y0 * HW + x1) * 3, c = (y1 * HW + x0) * 3, d = (y1 * HW + x1) * 3;
      // the pixel's place on the disk plane, for the dust lane and the halo
      const sxr = (x + 0.5 - 32) / sc;
      const gy = (sxr * cr + syr * sr) / ci;
      const gx = -sxr * sr + syr * cr;
      const rp2 = gx * gx + gy * gy;
      let dust = 1;
      if (rp2 < 0.25) {
        const bu = gx * cb + gy * sb;
        const bv = -gx * sb + gy * cb;
        const au = abs(bu);
        const win = sm(0.05, 0.14, au) * (1 - sm(0.26, 0.4, au));
        if (win > 0) {
          const lane = 0.07 * Math.tanh(bu / 0.09);
          const e = (bv - lane) / 0.045;
          dust = 1 - 0.38 * win * exp(-e * e);
        }
      }
      const hal = 0.035 * exp(-rp2 / 0.9);
      for (let ch = 0; ch < 3; ch++) {
        const hv = (HB[a + ch] * (1 - fx) + HB[b + ch] * fx) * (1 - fy) + (HB[c + ch] * (1 - fx) + HB[d + ch] * fx) * fy;
        const v = ((F[o + ch] + M[o + ch] + 0.25 * hv) * dust + hal * TV[ch]) * 512;
        const vi = min(4095, floor(v));
        const e = lut[vi] + (v - vi) * (lut[vi + 1] - lut[vi]);
        px3[ch] = 255 * e;
        if (S.dbg) S.dbg[(y * W + x) * 3 + ch] = v / 512;
      }
      display.setPixel(x, y, min(255, px3[0]), min(255, px3[1]), min(255, px3[2]));
    }
  }
}
