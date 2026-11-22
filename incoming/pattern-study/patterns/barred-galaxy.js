// ===== Patternflow pattern =====
// Title:   Barred Galaxy
// Family:  bargalaxy
// Idea:    A barred spiral galaxy built only from orbits: 48 000 massless stars circle in a rotating bar potential until the bar glows amber along its length, a blue ring gathers near the outer resonance and spiral arms peel off the bar ends, while new stars keep being born on circular orbits and old ones fade, so the picture never settles.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the x1 family of bar-aligned orbits (George Contopoulos and Papayannopoulos, 1980); rings and arms as the response of a disk to a bar at its Lindblad resonances (Schwarz, 1981); the quadrupole bar with a cubic radial profile (Walter Dehnen, 2000); Edwin Hubble's barred spirals (1926); leapfrog time stepping; pattern round 224
// Round:   224
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.6..6, Bar=-1..1, Tilt=-1..1
//
// Knob 1: Hue. Turns the two tints round the wheel together and comes back at 1: amber bar with blue ring and arms at 0 and 1, a green bar with rose arms at 0.25, a blue bar in an orange disk at 0.5, a rose bar with green arms at 0.75. The two stay about 185 degrees apart and the faint halo sits 60 degrees past the cool one.
// Knob 2: Pace. How fast the galaxy runs: the model clock goes at Pace over 2, so 0.3 times at 0.6, once at the opening 2 and 3 times at 6. The bar turns once in 43 s at 2 (143 s at 0.6, 14 s at 6), and a star lives 146 to 270 s at 2, so the ring and arms are renewed in a few minutes. The leapfrog step never goes over 0.04 units, so every pace is stable.
// Knob 3: Bar. The strength of the bar. Its sideways pull at the bar end is 0 percent of the pull toward the centre at -1, a plain disk with no bar, 25 percent at -0.5, 50 percent at 0 where it opens, 62 percent at 0.5 and 73 percent at 1. Weak bars give a short amber oval inside a smooth blue disk, at 0 a thin bar with a ring and two arms, at 1 a broad bar that heats the whole disk and washes the arms out. The strength also wobbles by 18 and 12 percent on periods of 225 s and 390 s at Pace 2, and the pull answers the knob within about a second while the stars take a bar turn or two.
// Knob 4: Tilt. The inclination of the disk to the line of sight: 40 degrees at -1, almost face on, where the disk is 76 LEDs tall and 58 wide, 59 at the opening 0.06 and 76 at 1, nearly edge on, a thin lens 112 rows tall and 27 wide with the bar a bright spindle in the middle. A wobble of 5 and 4 degrees on 97 s and 151 s, a roll of the line of nodes of up to 11 degrees on 83 s, 131 s and 197 s, a drift of the centre of up to 7 LEDs across and 9 along and an 8 percent breath of the zoom come on top, so no two minutes frame the galaxy alike.

// What the picture is. The plane of a disk galaxy seen at an angle, its line of nodes along the panel's long axis.
//   x = 32 + 56 (y cos i - z sin i)     y = 64 - 56 x      (disk plane x, y and height z in model units, then the roll)
// The unit is the disk radius, 56 LEDs along the long axis at the opening, and the disk ends at 1. Every star is a mass-less point in the plane.
// It feels a cored halo (circular speed squared 0.78 r^2 / (r^2 + 0.0625)), a Plummer bulge (mass 0.1, softening 0.07) and the bar, a quadrupole
//   Phi = A cos(2 (phi - phiBar)) (2 - (r / 0.38)^3)  inside r = 0.38,   A cos(2 (phi - phiBar)) (0.38 / r)^3  outside,
// with A negative so the bar is a minimum along its axis. The circular speed is flat at about 0.9, and the bar turns at 1.9 radians a unit, which puts
// corotation near r = 0.47 and the outer Lindblad resonance near 0.8. That pattern speed wanders by 13, 9 and 6 percent on periods of 23.1, 37.7 and 61.3 units,
// which do not divide one another, so the ring slides in and out by a few LEDs and never keeps one place.
// A star is born at a random angle on a circular orbit with a scatter of 3 to 6 percent in speed, at a radius drawn from three groups: 9 percent in a bulge
// (Rayleigh, sigma 0.07), 53 percent in an exponential disk (scale 0.22) and 38 percent spread evenly over the area from 0.3 to 1. It lives 16 units, 0.7 to 1.3 times that, fading in over 0.8 and out over the last 3, and is then born again
// somewhere else. It also feels the bar only gradually, over its first 6 units, so it settles onto an orbit along the bar the way a star would if the bar had grown
// slowly (a star pushed at full strength from the first moment is hot and fills the bar out into an oval). Time stepping is leapfrog,
// one step a frame, and the first frame comes after 12 units of steps of 0.04, enough for the bar and the ring to stand.
// Colour. How far a star's orbit is from circular, sqrt(vr^2 + 2 (vphi - vc)^2) / vc, decides its tint. Orbits trapped by the bar are hot and go amber, the cold
// ones in the ring and arms go blue-white, and a cold star is 2.5 times as bright as a hot one. One star in 25 is 2.6 times brighter, which puts knots in the arms, and the cold stars swell and fade by 26 and 16 percent on 147 s and 233 s while the exposure breathes by 8 and 5 percent on 71 s and 119 s. Light is added into three layers by radius, a sharp one
// inside 0.22, a layer blurred to about 1.2 LEDs and a half-resolution layer of about 2.5 LEDs outside 0.55, so the sparse outer disk does not break into dots. A dust lane
// about 6 LEDs wide runs 4 LEDs off the bar's axis on its leading side at each end and darkens by up to 38 percent, scaled by the bar strength. The light loses a black point of 0.05 and goes through (1 - exp(-x)) to the power 1.6.

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
const EPS0 = 0.4; // bar strength at Bar = 0: the bar's sideways pull at its end, in units of 1 / RB (the pull toward the centre there is 0.8 / RB)
const LIFE = 16; // a star's life in units
const RMAX = 1.18; // a star this far out is born again
const GROW = 6; // a star feels the bar fully only after this many units
const PRE = 12; // units run before the first frame
const HPRE = 0.04; // leapfrog step of the pre-run

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
  if (u < 0.06) return 0.08 * sqrt(-2 * log(1 - Math.random()));
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
  // now and then a bright young star, so the arms have knots
  S.bri[i] = (0.7 + 0.6 * Math.random()) * (Math.random() < 0.04 ? 2.6 : 1);
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
    A: 0,
  };
  for (let i = 0; i <= 4096; i++) {
    const x = i / 512;
    S.lut[i] = Math.pow(1 - exp(-x * 1.0), 1.6);
  }
  params.s = S;
}

// The pattern speed wanders on three periods that do not divide each other.
function ompOf(S, t) {
  const p = S.ph;
  return OMP0 * (1 + 0.13 * sin((TAU * t) / 23.1 + p[0]) + 0.09 * sin((TAU * t) / 37.7 + p[1]) + 0.06 * sin((TAU * t) / 61.3 + p[2]));
}

// Strength of the bar potential, as the amplitude A (negative: the bar is a minimum along its axis).
function ampOf(S, t, bar) {
  const p = S.ph;
  const eps = bar < 0 ? EPS0 * (1 + bar) : EPS0 * (1 + 0.45 * bar);
  const wob = 1 + 0.18 * sin((TAU * t) / 17.3 + p[3]) + 0.12 * sin((TAU * t) / 29.9 + p[4]);
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
  const pace = cl(sk[1], 0.6, 6) / 2;
  const h = (dt * pace) / TU;
  S.A = ampOf(S, S.t, sk[2]);
  if (h > 0) step(S, h, S.A);
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
  hueRGB(0.6 + sk[0], 0.52, TC);
  hueRGB(0.76 + sk[0], 0.55, TV);
  // the view: inclination, a slow roll of the line of nodes, and a small wobble of the tilt
  const incl = min(1.4, ((58 + 18 * cl(sk[3], -1, 1)) * PI) / 180 + 0.06 * sin((TAU * t) / 97 + S.ph[5]) + 0.05 * sin((TAU * t) / 151 + S.ph[8]));
  const ci = cos(incl), si = sin(incl);
  const roll = 0.12 * sin((TAU * t) / 83 + S.ph[6]) + 0.08 * sin((TAU * t) / 131 + S.ph[7]) + 0.05 * sin((TAU * t) / 197 + S.ph[9]);
  const ox = 5 * sin((TAU * t) / 109 + S.ph[10]) + 3.5 * sin((TAU * t) / 167 + S.ph[11]);
  const oy = 7 * sin((TAU * t) / 127 + S.ph[2]) + 3.5 * sin((TAU * t) / 181 + S.ph[4]);
  // young stars come in bursts and the exposure breathes a little, on periods that do not divide the others
  const sfr = 1 + 0.15 * sin((TAU * t) / 147 + S.ph[0]) + 0.1 * sin((TAU * t) / 233 + S.ph[1]);
  // one side of the disk is a little brighter than the other, and that side slowly turns, so the two arms are never equal
  const lc = cos((TAU * t) / 203 + S.ph[8]), ls = sin((TAU * t) / 203 + S.ph[8]);
  const expo = 1 + 0.05 * sin((TAU * t) / 71 + S.ph[6]) + 0.03 * sin((TAU * t) / 119 + S.ph[7]);
  const cr = cos(roll), sr = sin(roll);
  const sc = min(58, 34 / max(0.25, ci)) * (0.92 + 0.08 * sin((TAU * t) / 113 + S.ph[3]));
  const coolTop = 0.45 + 2 * max(0, -S.A - 0.2);
  for (let i = 0; i < N; i++) {
    const x = px[i], y = py[i], z = pz[i];
    const u0 = y * ci - z * si;
    const v0 = x;
    const sx = 32 + ox + sc * (u0 * cr - v0 * sr);
    const sy = 64 + oy - sc * (u0 * sr + v0 * cr);
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
    const cool = 1 - sm(0.1, coolTop, hot);
    const w = 0.095 * expo * env * bri[i] * (0.5 + 1.1 * sfr * cool) * (1 + 0.3 * sm(0.3, 0.7, r) * ((x * lc + y * ls) / (r + 1e-4)));
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
  const dustAmp = 0.38 * sm(0.04, 0.14, -S.A);
  for (let y = 0; y < H; y++) {
    const hy = y * 0.5 - 0.25;
    const y0 = max(0, min(HH - 1, floor(hy)));
    const y1 = min(HH - 1, y0 + 1);
    const fy = cl(hy - y0, 0, 1);
    const syr = (64 + oy - (y + 0.5)) / sc;
    for (let x = 0; x < W; x++) {
      const hx = x * 0.5 - 0.25;
      const x0 = max(0, min(HW - 1, floor(hx)));
      const x1 = min(HW - 1, x0 + 1);
      const fx = cl(hx - x0, 0, 1);
      const o = (y * W + x) * 3;
      const a = (y0 * HW + x0) * 3, b = (y0 * HW + x1) * 3, c = (y1 * HW + x0) * 3, d = (y1 * HW + x1) * 3;
      // the pixel's place on the disk plane, for the dust lane and the halo
      const sxr = (x + 0.5 - 32 - ox) / sc;
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
          dust = 1 - dustAmp * win * exp(-e * e);
        }
      }
      const hal = 0.035 * exp(-rp2 / 0.9);
      for (let ch = 0; ch < 3; ch++) {
        const hv = (HB[a + ch] * (1 - fx) + HB[b + ch] * fx) * (1 - fy) + (HB[c + ch] * (1 - fx) + HB[d + ch] * fx) * fy;
        const v = max(0, ((F[o + ch] + M[o + ch] + 0.25 * hv) * dust + hal * TV[ch] - 0.05)) * 512;
        const vi = min(4095, floor(v));
        const e = lut[vi] + (v - vi) * (lut[vi + 1] - lut[vi]);
        px3[ch] = 255 * e;
      }
      display.setPixel(x, y, min(255, px3[0]), min(255, px3[1]), min(255, px3[2]));
    }
  }
}
