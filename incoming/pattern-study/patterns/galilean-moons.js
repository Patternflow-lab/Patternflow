// ===== Patternflow pattern =====
// Title:   Galilean Moons
// Family:  celestial
// Idea:    Jupiter's four big moons as an observer's chart: the eyepiece at the top shows the belted planet turning, its moons in a line and their shadows crossing the disc, and below it each moon traces its own sine round Jupiter's band, ten rows a day, as the days to come scroll up to the eyepiece.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 22, after the Jupiter's-moons chart Sky & Telescope prints each month, computed with Jean Meeus's low-accuracy theory of the four satellites
// Round:   22
// ===============================
// @matrix 64x128
// @knobs Sky=0..1, Speed=0.5..24, Power=0..1, Seeing=0..1
//
// Knob 1: Sky. The light the chart is read by: a night chart in navy at 0, red-light observing mode at the middle, the printed paper chart at 1.
// Knob 2: Speed. Hours of Jupiter's time a second: at 2 the Great Red Spot comes round every 5 seconds and the chart climbs a row every 1.2 seconds; 0.5 to 24, a day a second.
// Knob 3: Power. The eyepiece's magnification, which also sets the chart's scale: at 0 the field holds Callisto's whole orbit; turned up, Callisto, then Ganymede, then Europa run off the sides at elongation until only Io's orbit fits.
// Knob 4: Seeing. Turbulence in the air over the telescope: steady near 0, and toward 1 the disc wobbles, boils and blurs into a glow until the belts are gone.
// Buttons: K1 tap jumps ahead to the next shadow transit, an hour before the shadow touches Jupiter's limb.

const W = 64;
const H = 128;
const { sin, cos, asin, atan2, sqrt, floor, round, min, max, abs, exp, pow, PI } = Math;
const RAD = PI / 180;
const CX = 31.5;
// The eyepiece fills rows 0 to 37: the close-up round row 16 and the
// low-power line on row 35. The chart starts at row 38 with row 35 as now.
const EY = 16;
const LY = 35;
const C0 = 38;
const EYE = C0;
// 2026 October 23, 18:00 UT, three months before the February 2027
// opposition, when Earth crosses Jupiter's equator and the moons pass right
// over each other; the panel opens at the first shadow transit after it.
const JD0 = 2461337.25;
// The Great Red Spot's System II longitude, about where it drifts to by late 2026.
const GRS = 78;
// Meeus: each moon's longitude at J2000 and daily motion in degrees, its
// radius in Jupiter radii.
const U0 = [163.8069, 358.414, 5.7176, 224.8092];
const UN = [203.4058646, 101.2916335, 50.234518, 21.48798];
const RM = [0.0255, 0.0219, 0.0368, 0.0337];
// Dot and shadow radii in the close-up, in LEDs. Io is 0.7 LEDs across at
// the lowest power, so the moons are drawn two and a half times too big.
const DOT = [0.85, 0.75, 1.15, 1.05];
// Io yellow-orange, Europa white, Ganymede grey-brown, Callisto grey-blue,
// as they look in the eyepiece, and the albedo they show against the disc.
const EYEC = [
  [255, 196, 84],
  [240, 242, 248],
  [206, 178, 146],
  [128, 150, 200],
];
const ALB = [1, 1, 0.78, 0.62];
// Chart palettes: night, red light, paper. bg0/bg1 alternate by day.
const PAL = [
  {
    bg0: [8, 14, 40], bg1: [16, 28, 72], band: [196, 170, 128], shadow: [26, 18, 20], label: [104, 124, 178],
    moon: [[255, 170, 40], [236, 240, 250], [190, 156, 118], [118, 146, 210]],
  },
  {
    bg0: [14, 0, 0], bg1: [42, 2, 0], band: [128, 12, 4], shadow: [4, 0, 0], label: [120, 8, 0],
    moon: [[230, 44, 10], [255, 96, 66], [176, 26, 8], [128, 14, 4]],
  },
  {
    bg0: [232, 224, 204], bg1: [212, 204, 184], band: [190, 162, 118], shadow: [36, 26, 20], label: [112, 100, 88],
    moon: [[222, 100, 8], [28, 32, 52], [126, 80, 42], [34, 76, 152]],
  },
];
// 3x5 digits for the day labels.
const DIG = [0x7b6f, 0x2c97, 0x73e7, 0x73cf, 0x5bc9, 0x79cf, 0x79ef, 0x7249, 0x7bef, 0x7bcf];

const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
// Signed difference of two angles in degrees, -180..180.
const wrap = (a) => a - 360 * floor((a + 180) / 360);

// Jupiter seen from Earth at Julian date jd: distance, phase angle, the
// declinations of the Earth and the Sun over its equator, the shadow's
// direction and the System I and II central meridians (Meeus, chapter 44).
function sky(jd, S) {
  const d = jd - 2451545;
  const V = (172.74 + 0.00111588 * d) * RAD;
  const M = (357.529 + 0.9856003 * d) * RAD;
  const N = (20.02 + 0.0830853 * d + 0.329 * sin(V)) * RAD;
  const J = (66.115 + 0.9025179 * d - 0.329 * sin(V)) * RAD;
  const A = (1.915 * sin(M) + 0.02 * sin(2 * M)) * RAD;
  const B = (5.555 * sin(N) + 0.168 * sin(2 * N)) * RAD;
  const K = J + A - B;
  const R = 1.00014 - 0.01671 * cos(M) - 0.00014 * cos(2 * M);
  const r = 5.20872 - 0.25208 * cos(N) - 0.00611 * cos(2 * N);
  const dist = sqrt(r * r + R * R - 2 * r * R * cos(K));
  const psi = asin((R / dist) * sin(K));
  const lam = (34.35 + 0.083091 * d + 0.329 * sin(V)) * RAD + B;
  S.Ds = 3.12 * RAD * sin(lam + 42.8 * RAD);
  S.De = S.Ds - 2.22 * RAD * sin(psi) * cos(lam + 22 * RAD) - 1.3 * RAD * ((r - dist) / dist) * sin(lam - 100.5 * RAD);
  S.lt = dist / 173;
  S.ph = psi - B;
  // The shadow points away from the Sun: west (right) before opposition.
  S.sx = -sin(psi);
  S.sz = cos(psi);
  const t = d - S.lt;
  S.w1 = 210.98 + 877.8169088 * t + S.ph / RAD;
  S.w2 = 187.23 + 870.1869088 * t + S.ph / RAD;
}

function makeMoons() {
  const F = () => new Float64Array(4);
  return { X: F(), Y: F(), Z: F(), vis: F(), sx: F(), sy: F(), son: F(), u: F() };
}

// The four moons at jd using the slow terms in S. X is west (right) and Y
// north in Jupiter radii, Z away from Earth. vis is how much of the moon is
// neither behind Jupiter nor in its shadow; son is how much of its shadow
// lies on the side of the disc we see, at (sx, sy).
function moons(jd, S, Mo) {
  const t = jd - 2451545 - S.lt;
  const u = Mo.u;
  for (let i = 0; i < 4; i++) u[i] = (U0[i] + UN[i] * t) * RAD + S.ph;
  const G = (331.18 + 50.310482 * t) * RAD;
  const Hh = (87.45 + 21.569231 * t) * RAD;
  const a = u[0], b = u[1], c = u[2];
  u[0] += 0.473 * RAD * sin(2 * (a - b));
  u[1] += 1.065 * RAD * sin(2 * (b - c));
  u[2] += 0.165 * RAD * sin(G);
  u[3] += 0.843 * RAD * sin(Hh);
  const rr0 = 5.9057 - 0.0244 * cos(2 * (a - b));
  const rr1 = 9.3966 - 0.0882 * cos(2 * (b - c));
  const rr2 = 14.9883 - 0.0216 * cos(G);
  const rr3 = 26.3627 - 0.1939 * cos(Hh);
  const sDe = sin(S.De);
  for (let i = 0; i < 4; i++) {
    const r = i === 0 ? rr0 : i === 1 ? rr1 : i === 2 ? rr2 : rr3;
    const X = r * sin(u[i]);
    const Z = -r * cos(u[i]);
    const Y = Z * sDe;
    Mo.X[i] = X;
    Mo.Y[i] = Y;
    Mo.Z[i] = Z;
    let vis = 1;
    if (Z > 0) vis = sm(1 - RM[i], 1 + RM[i], sqrt(X * X + (Y / 0.935) ** 2));
    const al = X * S.sx + Z * S.sz;
    if (al > 0) {
      const pe = X * S.sz - Z * S.sx;
      const v = (al * S.Ds) / 0.935;
      const w = RM[i] + al * 0.0012;
      vis *= sm(1 - w, 1 + w, sqrt(pe * pe + v * v));
    }
    Mo.vis[i] = vis;
    Mo.son[i] = 0;
    if (Z < 0) {
      const cc = X * X + Z * Z - 1;
      const disc = al * al - cc;
      if (disc > 0) {
        const tt = -al - sqrt(disc);
        const zh = Z + tt * S.sz;
        if (tt > 0 && zh < 0) {
          const xh = X + tt * S.sx;
          const yh = Y - tt * S.Ds;
          Mo.sx[i] = xh;
          Mo.sy[i] = yh;
          Mo.son[i] = 1 - sm(0.93, 1, sqrt(xh * xh + (yh / 0.935) ** 2));
        }
      }
    }
  }
}

// Day of the month of the civil day that starts at jd (Meeus, chapter 7).
function dayOf(jd) {
  const Z = floor(jd + 0.5);
  const al = floor((Z - 1867216.25) / 36524.25);
  const A = Z + 1 + al - floor(al / 4);
  const B = A + 1524;
  const C = floor((B - 122.1) / 365.25);
  const D = floor(365.25 * C);
  const E = floor((B - D) / 30.6001);
  return B - D - floor(30.6001 * E);
}

// Cloud colours at planetographic latitude lat (degrees) and System I and II
// longitudes L1, L2 (degrees, west). Writes albedo 0..1 into o.
function cloud(lat, L1, L2, o) {
  const al = abs(lat);
  let r = 0.94, g = 0.89, b = 0.77;
  const put = (cr, cg, cb, a) => {
    r += (cr - r) * a;
    g += (cg - g) * a;
    b += (cb - b) * a;
  };
  const l1 = L1 * RAD, l2 = L2 * RAD;
  // Polar hoods.
  put(0.6, 0.57, 0.54, 0.85 * sm(28, 58, al));
  // North Equatorial Belt, festoons trailing from its south edge.
  const ns = 6.8 + 1.1 * sin(6 * l1 + 1) + 0.6 * sin(13 * l1);
  const nn = 17.5 + 1.2 * sin(2 * l2 + 0.4) + 0.7 * sin(5 * l2 + 2);
  let a = sm(ns - 1, ns + 1, lat) * (1 - sm(nn - 1, nn + 1, lat));
  put(0.6, 0.37, 0.23, 0.88 * a);
  // Festoons: dark plumes, unevenly spaced, slanting down into the EZ.
  const fe = sin(10 * l1 + 0.12 * lat + 0.9 * sin(3 * l1 + 2));
  put(0.4, 0.43, 0.54, 0.7 * sm(0.5, 0.9, fe) * sm(1.5 + 2.5 * sin(7 * l1) ** 2, 6.5, lat) * (1 - sm(6.5, 8, lat)));
  // Barges: dark red ovals in the NEB's north half.
  for (const bl of [40, 165, 290]) {
    const e = (wrap(L2 - bl) / 5) ** 2 + ((lat - 15) / 1.8) ** 2;
    put(0.42, 0.2, 0.14, 0.9 * (1 - sm(0.5, 1.1, e)));
  }
  // The Great Red Spot and the hollow it presses into the SEB.
  const eg = (wrap(L2 - GRS) / 8) ** 2 + ((lat + 22.5) / 5) ** 2;
  // South Equatorial Belt, paler down its middle.
  const ss = -19.5 + 0.9 * sin(3 * l2 + 2) + 0.5 * sin(8 * l2);
  const sn = -7.5 + 0.8 * sin(4 * l2) + 0.5 * sin(11 * l1 + 1);
  a = sm(ss - 1, ss + 1, lat) * (1 - sm(sn - 1, sn + 1, lat));
  a *= 1 - 0.4 * exp(-(((lat + 13.5) / 2.6) ** 2)) * (0.6 + 0.4 * sin(5 * l2 + 1));
  a *= sm(1.1, 2.4, eg);
  put(0.66, 0.44, 0.28, 0.8 * a);
  put(0.88, 0.45, 0.31, 1 - sm(0.6, 1, eg));
  // Temperate belts, white ovals in the south one.
  const st = -29 + 0.8 * sin(3 * l2 + 4);
  put(0.7, 0.55, 0.41, 0.62 * sm(st - 2.5, st - 1, lat) * (1 - sm(st + 1, st + 2.5, lat)));
  for (const wl of [100, 215, 335]) {
    const e = (wrap(L2 - wl) / 4.5) ** 2 + ((lat + 33) / 2.4) ** 2;
    put(1, 0.99, 0.95, 0.85 * (1 - sm(0.4, 1, e)));
  }
  const nt = 26 + 0.9 * sin(4 * l2 + 1);
  put(0.68, 0.51, 0.37, 0.6 * sm(nt - 2.5, nt - 1, lat) * (1 - sm(nt + 1, nt + 2.5, lat)));
  put(0.72, 0.62, 0.52, 0.4 * exp(-(((al - 37) / 1.6) ** 2)));
  o[0] = r;
  o[1] = g;
  o[2] = b;
}

// A soft dot of colour c and strength a added into buffer f (stride W).
function dot(f, rows, x, y, rad, c, a) {
  const x0 = max(0, floor(x - rad - 1)), x1 = min(W - 1, floor(x + rad + 1));
  const y0 = max(0, floor(y - rad - 1)), y1 = min(rows - 1, floor(y + rad + 1));
  for (let j = y0; j <= y1; j++)
    for (let i = x0; i <= x1; i++) {
      const k = cl(rad + 0.5 - sqrt((i - x) ** 2 + (j - y) ** 2), 0, 1) * a;
      if (k <= 0) continue;
      const o = (j * W + i) * 3;
      f[o] += (c[0] - f[o]) * k;
      f[o + 1] += (c[1] - f[o + 1]) * k;
      f[o + 2] += (c[2] - f[o + 2]) * k;
    }
}

export function setup(params) {
  const P = params;
  P.S = {};
  P.Mo = makeMoons();
  P.eye = new Float32Array(W * C0 * 3);
  P.tmp = new Float32Array(W * EYE * 3);
  P.row = new Float32Array(W * 3);
  P.al = new Float32Array(W * 4);
  P.sh = new Float32Array(W);
  P.xp = new Float64Array(4);
  P.vp = new Float64Array(4);
  P.cs = new Float32Array(3);
  P.clock = 0;
  Object.assign(P, { skyk: 0, speed: 2, power: 0, seeing: 0.06 });
  // Open five hours before the first shadow touches the limb, which at the
  // opening speed brings it on at 2.5 seconds.
  P.jd = nextShadow(JD0) - 5 / 24;
}

// The next time after jd that a moon's shadow reaches the disc.
function nextShadow(jd) {
  const S = {}, Mo = makeMoons();
  let was = 0;
  for (let k = 0; k < 2000; k++) {
    const t = jd + k * 0.01;
    if (k % 10 === 0) sky(t, S);
    moons(t, S, Mo);
    let on = 0;
    for (let i = 0; i < 4; i++) if (Mo.son[i] > 0.5) on |= 1 << i;
    if (k > 0 && on & ~was) return t;
    was = on;
  }
  return jd;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  P.skyk = cl(k[0], 0, 1);
  P.speed = cl(k[1], 0.5, 24);
  P.power = cl(k[2], 0, 1);
  P.seeing = cl(k[3], 0, 1);
  if (input.btnPressed && input.btnPressed[0]) P.jd = nextShadow(P.jd + 0.02) - 1 / 24;
  P.jd += (dt * P.speed) / 24;
  P.clock += dt;
}

// The close-up eyepiece: Jupiter at Rc LEDs a radius, with seeing.
function eyepiece(P, S, Mo, Rc) {
  const f = P.eye;
  const see = P.seeing;
  const tm = P.clock;
  const cs = P.cs;
  // Image motion: the whole disc wanders, and each row ripples on its own.
  const gx = see * (2.6 * sin(tm * 3.1) * sin(tm * 1.27 + 1) + 1.3 * sin(tm * 7.3 + 2));
  const gy = see * (1.5 * sin(tm * 2.3 + 4) * sin(tm * 0.9) + 0.8 * sin(tm * 6.1 + 1));
  const Rp = Rc * 0.935;
  const cy = EY + gy;
  const w1 = S.w1, w2 = S.w2;
  for (let y = 0; y < EYE; y++) {
    const rip = see * 1.3 * sin(y * 0.9 + tm * 11) * sin(y * 0.37 - tm * 5.3 + 1.3);
    const cx = CX + gx + rip;
    const ny = (y - cy) / Rp;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const nx = (x - cx) / Rc;
      const q = nx * nx + ny * ny;
      const rho = sqrt(q);
      // Glare round the disc: the seeing disc's wings.
      const out = max(0, rho - 1) * Rc;
      const halo = (4 + 110 * see) / pow(1 + (out / (2 + 10 * see)) ** 2, 1.5) * (rho > 1 ? 1 : 0);
      f[o] = 3 + halo * 0.95;
      f[o + 1] = 4 + halo * 0.9;
      f[o + 2] = 8 + halo * 0.8;
      if (rho >= 1 + 1 / Rc) continue;
      const edge = cl((1 - rho) * Rc + 0.6, 0, 1);
      const mu = sqrt(max(0, 1 - min(q, 1)));
      const lat = -asin(cl(ny, -1, 1)) / RAD;
      const lon = atan2(nx, mu) / RAD;
      cloud(lat, w1 - lon, w2 - lon, cs);
      let lum = 255 * (0.18 + 0.82 * pow(mu, 0.55));
      // The phase: a thin shade on the limb away from the Sun.
      lum *= 1 - 0.35 * sm(0.75, 1, nx * (S.sx > 0 ? 1 : -1)) * abs(S.sx) * 5;
      for (let i = 0; i < 4; i++) {
        if (Mo.son[i] <= 0) continue;
        const dx = (x - cx - Mo.sx[i] * Rc), dy = (y - cy + Mo.sy[i] * Rc);
        lum *= 1 - 0.9 * Mo.son[i] * cl(DOT[i] + 0.55 - sqrt(dx * dx + dy * dy), 0, 1);
      }
      f[o] += (cs[0] * lum - f[o]) * edge;
      f[o + 1] += (cs[1] * lum - f[o + 1]) * edge;
      f[o + 2] += (cs[2] * lum - f[o + 2]) * edge;
    }
  }
  // Moons in the field, in front of the disc or beside it.
  for (let i = 0; i < 4; i++) {
    const x = CX + gx + Mo.X[i] * Rc, y = cy - Mo.Y[i] * Rc;
    if (x < -3 || x > W + 3 || Mo.vis[i] <= 0.01) continue;
    const onDisc = Mo.Z[i] < 0 && Mo.X[i] ** 2 + (Mo.Y[i] / 0.935) ** 2 < 1;
    const tw = 1 + see * 0.35 * sin(tm * (17 + i * 3) + i);
    const c = EYEC[i].map((v) => v * (onDisc ? ALB[i] : 1) * min(1.1, tw));
    dot(f, EYE, x, y, DOT[i] * (1 + see * 0.6), c, Mo.vis[i]);
  }
  // Seeing blurs the image: a separable Gaussian.
  const sg = 0.2 + 1.7 * see;
  if (sg > 0.35) {
    const rad = min(5, Math.ceil(sg * 2.5));
    const ker = [];
    let ks = 0;
    for (let i = -rad; i <= rad; i++) ks += ker[i + rad] = exp(-(i * i) / (2 * sg * sg));
    const t = P.tmp;
    for (let y = 0; y < EYE; y++)
      for (let x = 0; x < W; x++)
        for (let c = 0; c < 3; c++) {
          let s = 0;
          for (let i = -rad; i <= rad; i++) s += ker[i + rad] * f[(y * W + cl(x + i, 0, W - 1)) * 3 + c];
          t[(y * W + x) * 3 + c] = s / ks;
        }
    for (let y = 0; y < EYE; y++)
      for (let x = 0; x < W; x++)
        for (let c = 0; c < 3; c++) {
          let s = 0;
          for (let i = -rad; i <= rad; i++) s += ker[i + rad] * t[(cl(y + i, 0, EYE - 1) * W + x) * 3 + c];
          f[(y * W + x) * 3 + c] = s / ks;
        }
  }
}

// The low-power line under the close-up: Jupiter and its moons at the chart's scale.
function line(P, Mo, Rj, Rc) {
  const f = P.eye;
  // Two faint lines from under the close-up down to the planet it magnifies.
  for (const s of [-1, 1]) {
    const xa = CX + s * Rc * 0.45, ya = EY + Rc * 0.935 + 1;
    const xb = CX + s * (Rj + 0.8), yb = LY - 1.5;
    const n = max(2, round(yb - ya));
    for (let k = 0; k <= n; k++) {
      const x = round(mix(xa, xb, k / n)), y = round(mix(ya, yb, k / n));
      const o = (y * W + x) * 3;
      if (y < C0 && x >= 0 && x < W) for (let c = 0; c < 3; c++) f[o + c] = max(f[o + c], [34, 40, 62][c]);
    }
  }
  const hj = min(Rj * 0.935, 2.2);
  for (let y = LY - 3; y <= LY + 3; y++)
    for (let x = 0; x < W; x++) {
      const nx = (x - CX) / Rj, ny = (y - LY) / hj;
      const rho = sqrt(nx * nx + ny * ny);
      const k = cl((1 - rho) * max(1.2, Rj) + 0.7, 0, 1);
      if (k <= 0) continue;
      const lum = 0.55 + 0.45 * sqrt(max(0, 1 - rho * rho));
      const o = (y * W + x) * 3;
      f[o] += (236 * lum - f[o]) * k;
      f[o + 1] += (220 * lum - f[o + 1]) * k;
      f[o + 2] += (186 * lum - f[o + 2]) * k;
    }
  for (let i = 0; i < 4; i++) {
    if (Mo.vis[i] <= 0.01) continue;
    dot(f, C0, CX + Mo.X[i] * Rj, LY - Mo.Y[i] * Rj, 0.7, EYEC[i], Mo.vis[i]);
  }
}

function blend(k1) {
  const s = k1 * 2;
  const i = min(1, floor(s)), t = sm(0, 1, s - i);
  const a = PAL[i], b = PAL[i + 1];
  const m = (u, v) => u.map((x, j) => mix(x, v[j], t));
  const o = {};
  for (const key of ["bg0", "bg1", "band", "shadow", "label"]) o[key] = m(a[key], b[key]);
  o.moon = a.moon.map((c, j) => m(c, b.moon[j]));
  return o;
}

// The chart: ten rows a day at the lowest power, now at row LY, the day
// numbers down the left edge under the line each day starts on.
function chart(P, display, pal, Rj) {
  const rpd = 10 * pow(Rj / 1.15, 0.6);
  const S = P.S2 || (P.S2 = {});
  const Mo = P.Mo2 || (P.Mo2 = makeMoons());
  const { row, al, sh } = P;
  const hw = 0.55;
  const marks = new Set();
  for (let d = floor(P.jd + (C0 - 6 - LY) / rpd - 0.5) + 1.5; d < P.jd + (H - LY) / rpd; d++) {
    const n = dayOf(d + 0.01), yb = round(LY + (d - P.jd) * rpd);
    const s = n < 10 ? [n] : [floor(n / 10), n % 10];
    s.forEach((dg, j) => {
      for (let b = 0; b < 15; b++) if ((DIG[dg] >> (14 - b)) & 1) marks.add((yb + 1 + floor(b / 3)) * W + 1 + j * 4 + (b % 3));
    });
  }
  for (let y = C0; y < H; y++) {
    const tc = P.jd + (y - LY) / rpd;
    const ta = tc - 0.5 / rpd, tb = tc + 0.5 / rpd;
    // Alternate days light and dark, split where a day starts inside the row.
    const da = floor(ta - 0.5);
    let odd = da & 1;
    const nb = da + 1.5;
    if (nb < tb) {
      const fr = (tb - nb) * rpd;
      odd = odd * (1 - fr) + (1 - (da & 1)) * fr;
    }
    for (let x = 0; x < W; x++) {
      const lab = marks.has(y * W + x);
      for (let c = 0; c < 3; c++) row[x * 3 + c] = lab ? pal.label[c] : mix(pal.bg0[c], pal.bg1[c], odd);
    }
    // Jupiter's band, rounded off by its limb.
    for (let x = floor(CX - Rj - 1); x <= CX + Rj + 1; x++) {
      const k = cl(min(x + 0.5, CX + Rj) - max(x - 0.5, CX - Rj), 0, 1);
      if (k <= 0) continue;
      const dx = (x - CX) / Rj;
      const lum = 0.62 + 0.38 * sqrt(max(0, 1 - dx * dx));
      for (let c = 0; c < 3; c++) row[x * 3 + c] = mix(row[x * 3 + c], pal.band[c] * lum, k);
    }
    sky(tc, S);
    al.fill(0);
    sh.fill(0);
    const xp = P.xp, vp = P.vp;
    for (let s = 0; s <= 4; s++) {
      moons(ta + (s / 4) * (tb - ta), S, Mo);
      for (let i = 0; i < 4; i++) {
        const x = CX + Mo.X[i] * Rj, v = Mo.vis[i];
        if (Mo.son[i] > 0) {
          const xs = CX + Mo.sx[i] * Rj;
          for (let xx = max(0, floor(xs - 1)); xx <= min(W - 1, xs + 1); xx++)
            sh[xx] = max(sh[xx], Mo.son[i] * cl(1 - abs(xx - xs) * 0.8, 0, 1));
        }
        if (s > 0) {
          const lo = min(x, xp[i]) - hw, hi = max(x, xp[i]) + hw, vv = min(v, vp[i]);
          if (vv > 0.02 && hi > -1 && lo < W)
            for (let xx = max(0, floor(lo)); xx <= min(W - 1, floor(hi + 1)); xx++) {
              const k = cl(min(xx + 0.5, hi) - max(xx - 0.5, lo), 0, 1) * vv;
              if (k > al[xx * 4 + i]) al[xx * 4 + i] = k;
            }
        }
        xp[i] = x;
        vp[i] = v;
      }
    }
    for (let x = 0; x < W; x++) {
      if (sh[x] > 0) for (let c = 0; c < 3; c++) row[x * 3 + c] = mix(row[x * 3 + c], pal.shadow[c], sh[x] * 0.9);
      for (let i = 3; i >= 0; i--) {
        const k = al[x * 4 + i];
        if (k > 0) for (let c = 0; c < 3; c++) row[x * 3 + c] = mix(row[x * 3 + c], pal.moon[i][c], k);
      }
      display.setPixel(x, y, min(255, row[x * 3]), min(255, row[x * 3 + 1]), min(255, row[x * 3 + 2]));
    }
  }
}

export function draw(display, params) {
  const P = params;
  if (!P.eye) setup(P);
  const S = P.S, Mo = P.Mo;
  sky(P.jd, S);
  moons(P.jd, S, Mo);
  const p = P.power;
  const Rj = 1.15 * pow(5.1 / 1.15, p);
  const Rc = 14 + 2.5 * p;
  eyepiece(P, S, Mo, Rc);
  line(P, Mo, Rj, Rc);
  // Red light turns the eyepiece's colours to shades of red.
  const red = sm(0, 1, 1 - abs(P.skyk * 2 - 1));
  const f = P.eye;
  for (let i = 0, o = 0; i < W * C0; i++, o += 3) {
    let r = f[o], g = f[o + 1], b = f[o + 2];
    if (red > 0) {
      const l = 0.5 * r + 0.4 * g + 0.1 * b;
      r = mix(r, l, red);
      g = mix(g, l * 0.06, red);
      b = mix(b, 0, red);
    }
    display.setPixel(i % W, (i / W) | 0, min(255, r), min(255, g), min(255, b));
  }
  const pal = blend(P.skyk);
  chart(P, display, pal, Rj);
}
