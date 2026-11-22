// ===== Patternflow pattern =====
// Title:   Turnoff
// Family:  hrdiagram
// Idea:    placeholder
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: placeholder; pattern round 215
// Round:   217
// ===============================
// @matrix 64x128
// @knobs Reddening=-0.3..0.8, Rate=0..6, Metals=-2.2..0.4, Binaries=0..0.6
//
// Knob 1: placeholder
// Knob 2: placeholder
// Knob 3: placeholder
// Knob 4: placeholder

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, sqrt, exp, log10, sin, pow, PI, min, max } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

function h32(a, b) {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// ---- the plot: temperature runs right to left, luminosity bottom to top, both in log10
const LT_LEFT = 4.56, X0 = 2, XS = 48; // x = X0 + (LT_LEFT - log T) * XS
const LL_TOP = 5.15, Y0 = 4, YS = 14.6; // y = Y0 + (LL_TOP - log L) * YS
const NG = 58, NGR = 3, NS = NG * NGR; // three clusters are in view at once, each drawn from its own 58 stars
const MORPH = 0.55; // dex of cluster age spent turning into the next cluster
const RATE = 0.0065; // dex of age a second at Rate 1; the speed grows as Rate to the power 2.5

// ---- the zero-age main sequence: mass, log L, log T
const ZT = [
  [0.35, -1.8, 3.535], [0.5, -1.22, 3.585], [0.7, -0.62, 3.64], [0.85, -0.3, 3.722], [1.0, 0.0, 3.761],
  [1.3, 0.45, 3.812], [1.7, 0.95, 3.88], [2.0, 1.25, 3.95], [3.0, 1.95, 4.08], [4.0, 2.4, 4.16],
  [5.0, 2.7, 4.22], [7.0, 3.1, 4.31], [10, 3.65, 4.4], [15, 4.25, 4.47], [25, 4.95, 4.54],
  [40, 5.35, 4.6], [80, 5.8, 4.65],
];
const ZN = ZT.length;
const ZX = ZT.map((r) => log10(r[0]));
const ZL = ZT.map((r) => r[1]);
const ZE = ZT.map((r) => r[2]);
function slopes(Y) {
  const m = new Float64Array(ZN);
  for (let k = 0; k < ZN; k++) {
    const a = max(0, k - 1), b = min(ZN - 1, k + 1);
    m[k] = (Y[b] - Y[a]) / (ZX[b] - ZX[a]);
  }
  return m;
}
const ZML = slopes(ZL), ZME = slopes(ZE);
function herm(Y, Mt, lm, k) {
  const h = ZX[k + 1] - ZX[k], t = (lm - ZX[k]) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * Y[k] + (t3 - 2 * t2 + t) * h * Mt[k] + (-2 * t3 + 3 * t2) * Y[k + 1] + (t3 - t2) * h * Mt[k + 1];
}
const _z = [0, 0];
function zams(lm) {
  lm = cl(lm, ZX[0], ZX[ZN - 1] - 1e-6);
  let k = 0;
  while (k < ZN - 2 && lm > ZX[k + 1]) k++;
  _z[0] = herm(ZL, ZML, lm, k);
  _z[1] = herm(ZE, ZME, lm, k);
}

// The red giant branch is the Hayashi line, steeper and hotter when metals are few. z is [Fe/H].
const hay = (ll, z) => 3.665 - 0.03 * z - (0.034 - 0.008 * z) * (ll - 1.0);
const SL = 1.7; // the phases after the main sequence last 1.7 times as long as the textbook fractions, so that they can be watched
const tms = (M, z) => 10 * pow(10, 0.03 * z) * pow(M, -2.5) + 0.003; // Gyr

// ---- one star's life: where it stands at an age, for a mass and a metal content
// kind: 0 main sequence, 1 subgiant, 2 red giant, 3 helium burning, 4 asymptotic giant, 5 planetary nebula, 6 white dwarf, 7 gone
function evolve(M, age, z, rh, o) {
  zams(log10(M));
  const mid = sm(0.9, 1.6, M), L0 = _z[0], T0 = _z[1] - 0.075 * z;
  const tau = age / tms(M, z);
  o.w = 1;
  o.bump = 0;
  if (tau < 1) {
    o.ll = L0 + 0.3 * pow(tau, 1.3);
    o.lt = T0 + 0.012 * (1 - mid) * tau - 0.045 * mid * pow(tau, 1.5);
    o.kind = 0;
    return;
  }
  const Lto = L0 + 0.3, Tto = T0 + 0.012 * (1 - mid) - 0.045 * mid;
  const low = 1 - sm(1.7, 2.5, M), big = sm(7.5, 9.5, M);
  const g = SL * (0.14 * low + 0.06 * (1 - low)), r = SL * (0.2 * low + 0.04 * (1 - low)), hb = SL * (0.1 * low + 0.13 * (1 - low)), a = SL * 0.06 * (1 - big), pn = SL * 0.02;
  const b1 = g, b2 = g + r, b3 = b2 + hb, b4 = b3 + a, b5 = b4 + pn;
  const u = tau - 1;
  const Lb = Lto + 0.25 * low + 0.15 * (1 - low), Tb = hay(Lb, z);
  const Lt = 3.4 * low + (Lb + 0.3) * (1 - low), Tt = hay(Lt, z);
  if (u < b1) {
    const f = u / g;
    o.ll = Lto + (Lb - Lto) * f;
    o.lt = Tto + (Tb - Tto) * f * f * (3 - 2 * f);
    o.kind = 1;
    return;
  }
  if (u < b2) {
    const f = (u - b1) / r;
    o.ll = Lb + (Lt - Lb) * pow(f, 1.0 + 0.6 * low);
    o.lt = hay(o.ll, z);
    o.kind = 2;
    return;
  }
  // helium burning: a horizontal branch or red clump for the light stars, a blue loop for the middling, a red supergiant for the heavy
  const bz = 0.52 * sm(-0.5, -1.9, z), Thb = 3.675 - 0.02 * z + bz * pow(rh, 1.2);
  const Lhb = 1.72 - 1.1 * max(0, Thb - 3.88) + 0.05 * (rh - 0.5);
  const amp = 0.34 * sm(2.4, 3.6, M) * (1 - sm(5.5, 8.5, M));
  const heliumAt = (ph, out) => {
    const e1 = sm(0, 0.25, ph), s = sin(PI * ph);
    const hbL = lerp(Lt, Lhb, e1) + 0.14 * ph, hbT = lerp(Tt, Thb, e1) - 0.012 * ph;
    out[0] = lerp(Lt + 0.65 * amp * s, hbL, low);
    out[1] = lerp(Tt + amp * s, hbT, low);
  };
  const sn = M >= 8.5;
  if (u < b3 || sn) {
    const ph = (u - b2) / hb;
    if (sn && ph >= 1) {
      o.kind = 7;
      o.w = 0;
      o.ll = Lt;
      o.lt = Tt;
      return;
    }
    heliumAt(ph, _h);
    o.ll = _h[0];
    o.lt = _h[1];
    o.kind = 3;
    return;
  }
  const Lag0 = 2.1 * low + Lt * (1 - low), Lag1 = 3.7 * low + (Lt + 0.65) * (1 - low);
  if (u < b4) {
    const f = (u - b3) / a;
    heliumAt(1, _h);
    const fa = cl((f - 0.2) / 0.8, 0, 1), e0 = sm(0, 0.22, f);
    const bl = Lag0 + (Lag1 - Lag0) * pow(fa, 1.3), bt = hay(bl, z) - 0.025;
    o.ll = lerp(_h[0], bl, e0);
    o.lt = lerp(_h[1], bt, e0);
    o.kind = 4;
    return;
  }
  if (u < b5) {
    const f = (u - b4) / pn, Tag1 = hay(Lag1, z) - 0.025;
    o.ll = Lag1;
    o.lt = Tag1 + (5.0 - Tag1) * f * f * (3 - 2 * f);
    o.w = 1 - f;
    o.kind = 5;
    return;
  }
  // a white dwarf cooling by Mestel's law
  const tc = (u - b5) * tms(M, z) + 0.0015, Mwd = 0.109 * M + 0.394, R = 0.0126 * pow(0.6 / Mwd, 1 / 3);
  o.ll = -3.28 - 1.25 * log10(tc) - 0.45 * log10(Mwd / 0.6);
  o.lt = log10(5772 * pow(pow(10, o.ll) / (R * R), 0.25));
  o.kind = 6;
}
const _h = [0, 0];
const _o = { ll: 0, lt: 0, kind: 0, w: 1, bump: 0 };

// ---- the pool of stars: what a star keeps from one cluster to the next
const U = new Float32Array(NS), RB = new Float32Array(NS), Q = new Float32Array(NS), N1 = new Float32Array(NS), N2 = new Float32Array(NS);
const RH = new Float32Array(NS), W1 = new Float32Array(NS), W2 = new Float32Array(NS), P1 = new Float32Array(NS), P2 = new Float32Array(NS);
const PP = new Float32Array(NS), PM = new Float32Array(NS), DEL = new Float32Array(NS);
for (let i = 0; i < NS; i++) {
  const r = (k) => h32(i * 17 + k, 31337);
  U[i] = r(0);
  RB[i] = r(1);
  Q[i] = 0.3 + 0.7 * pow(r(2), 0.7);
  N1[i] = sqrt(-2 * Math.log(r(3) + 1e-6)) * Math.cos(TAU * r(4));
  N2[i] = sqrt(-2 * Math.log(r(5) + 1e-6)) * Math.cos(TAU * r(6));
  RH[i] = r(7);
  W1[i] = 0.9 + 1.7 * r(8);
  W2[i] = 2.3 + 2.4 * r(9);
  P1[i] = TAU * r(10);
  P2[i] = TAU * r(11);
  PP[i] = 1.6 + 3.9 * r(12);
  PM[i] = 12 + 10 * r(13);
  DEL[i] = 0.45 * r(14);
}

// each cluster's zero point wanders a little, on periods that do not divide one another
let NOW = 0;
const DRIFT = [0, 1, 2, 3].map((g) => ({ ax: 6 + 4 * h32(g, 41), px: 140 + 120 * h32(g, 42), fx: TAU * h32(g, 43), ay: 7 + 6 * h32(g, 44), py: 170 + 150 * h32(g, 45), fy: TAU * h32(g, 46) }));
const driftX = (g) => DRIFT[g].ax * sin((TAU * NOW) / DRIFT[g].px + DRIFT[g].fx);
const driftY = (g) => DRIFT[g].ay * sin((TAU * NOW) / DRIFT[g].py + DRIFT[g].fy);

const clusters = new Map();
function clusterAt(g, k) {
  const key = g * 100000 + k;
  let C = clusters.get(key);
  if (C) return C;
  const r = (j) => h32(k * 131 + j, 8191 + g * 977);
  C = { g, k };
  const first = k === 0;
  C.a0 = first ? [-1.85, -0.6, 0.5][g] : -2.1 + 2.3 * r(1); // log10 of the age in Gyr at which this cluster comes into view
  C.a1 = min(1.115, C.a0 + (first ? 3 : 1.2 + 1.5 * r(2))); // and where it leaves, at most 13 Gyr
  C.win = C.a1 - C.a0;
  const old = sm(0.2, 1.1, C.a1);
  C.z = first ? [-0.1, -0.3, -1.25][g] : 0.2 - 0.5 * r(3) - 1.3 * r(9) * old;
  C.dy = first ? [0, 5, 9][g] : -6 + 19 * r(4); // distance: rows the whole diagram stands lower
  C.red = first ? [0.1, 0.35, -0.3][g] : -0.4 + 1.0 * r(10); // reddening in front of this cluster, in magnitudes of E(B-V) and a bit more
  const alpha = first ? 2.35 : 2.1 + 0.5 * r(5);
  const mmin = first ? 0.6 : 0.5 + 0.7 * r(6) * r(6), mmax = first ? 45 : 9 + 41 * r(7);
  const n = first ? 30 : 20 + floor(24 * r(8));
  C.M = new Float32Array(NG);
  C.alive = new Float32Array(NG);
  const e = 1 - alpha, a = pow(mmin, e), b = pow(mmax, e);
  for (let i = 0; i < NG; i++) {
    // half of the stars keep their rank from the last cluster, half are drawn afresh
    const u = h32(i * 7 + k, 555 + g) < 0.55 ? U[g * NG + i] : h32(i * 13 + k, 777 + g);
    C.M[i] = pow(a - u * (a - b), 1 / e);
    C.alive[i] = i < n ? 1 : 0;
  }
  C.n = n;
  C.alpha = alpha;
  C.mmin = mmin;
  C.mmax = mmax;
  clusters.set(key, C);
  for (const kk of clusters.keys()) if (kk < key - 3 && kk >= g * 100000) clusters.delete(kk);
  return C;
}

// ---- colours of a black body, as a star looks on a dark ground
const CS = [
  [3.4, 255, 48, 22], [3.5, 255, 78, 30], [3.58, 255, 118, 44], [3.65, 255, 160, 66], [3.72, 255, 200, 104], [3.78, 255, 228, 156],
  [3.84, 255, 244, 214], [3.92, 232, 240, 255], [4.0, 190, 214, 255], [4.15, 130, 175, 255], [4.4, 96, 148, 255], [4.6, 80, 130, 255],
];
const _c = [0, 0, 0];
function starRGB(ct) {
  ct = cl(ct, CS[0][0], CS[CS.length - 1][0]);
  let k = 0;
  while (k < CS.length - 2 && ct > CS[k + 1][0]) k++;
  const a = CS[k], b = CS[k + 1], u = (ct - a[0]) / (b[0] - a[0]);
  _c[0] = lerp(a[1], b[1], u) / 255;
  _c[1] = lerp(a[2], b[2], u) / 255;
  _c[2] = lerp(a[3], b[3], u) / 255;
}

// ---- a star as the diagram shows it
function appear(C, i, age, z, E, k4, a) {
  const j = C.g * NG + i;
  evolve(C.M[i], age, z, RH[j], _o);
  let ll = _o.ll, lt = _o.lt;
  if (_o.kind === 0 && RB[j] < k4) ll += log10(1 + pow(Q[j], 3.5)); // an unresolved pair of nearly equal stars
  lt += (0.016 + 0.1 * k4) * N1[j];
  ll += (0.02 + 0.1 * k4) * N2[j];
  const e = E + C.red;
  a.x = X0 + (LT_LEFT - lt) * XS + 7 * e + driftX(C.g);
  a.y = Y0 + (LL_TOP - ll) * YS + C.dy + driftY(C.g);
  a.ll = ll;
  a.lt = lt;
  a.ct = lt - 0.3 * e;
  a.w = _o.w * C.alive[i];
  a.kind = _o.kind;
}

function makeState() {
  return {
    t: 0, kn: [0, 2, 0, 0.06], zPrev: 0, flash: [],
    pops: [0, 1, 2].map(() => ({ k: 0, prog: 0, fresh: true, dead: new Uint8Array(NG) })),
    ar: new Float32Array(NPX), ag: new Float32Array(NPX), ab: new Float32Array(NPX),
    gr: new Float32Array(NPX), gg: new Float32Array(NPX), gb: new Float32Array(NPX),
    A: { x: 0, y: 0, ll: 0, lt: 0, ct: 0, w: 0, kind: 0 }, B: { x: 0, y: 0, ll: 0, lt: 0, ct: 0, w: 0, kind: 0 }, M: { x: 0, y: 0, ll: 0, lt: 0, ct: 0, w: 0, kind: 0 },
  };
}

export function setup(params) {
  params.s = makeState();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  S.t += d;
  NOW = S.t;
  const z0 = cl(kn[2], -2.2, 0.4), E = cl(kn[0], -0.3, 0.8), k4 = cl(kn[3], 0, 0.6), a = S.A;
  for (let g = 0; g < NGR; g++) {
    const G = S.pops[g];
    G.prog += RATE * pow(cl(kn[1], 0, 6), 2.5) * d;
    let C = clusterAt(g, G.k);
    while (G.prog >= C.win + MORPH) {
      G.prog -= C.win + MORPH;
      C = clusterAt(g, ++G.k);
      G.fresh = true;
    }
    if (G.prog >= C.win) {
      G.fresh = true;
      continue;
    }
    // the heavy stars that end as a flash
    const age = pow(10, C.a0 + G.prog), z = cl(C.z + z0, -2.4, 0.45);
    for (let i = 0; i < NG; i++) {
      if (C.M[i] < 8.5 || C.alive[i] < 0.5) {
        G.dead[i] = 0;
        continue;
      }
      evolve(C.M[i], age, z, RH[g * NG + i], _o);
      const dead = _o.kind === 7 ? 1 : 0;
      if (dead && !G.dead[i] && !G.fresh && S.zPrev === z0) {
        appear(C, i, age * 0.995, z, E, k4, a);
        if (S.flash.length < 10) S.flash.push({ x: a.x, y: a.y, t: S.t });
      }
      G.dead[i] = dead;
    }
    G.fresh = false;
  }
  S.zPrev = z0;
}

// ---- drawing
const GN = 200, GL = new Float32Array(GN + 1);
for (let i = 0; i <= GN; i++) GL[i] = exp((-i * 4.0) / GN);
// A star's core goes in as a sum of cubes and comes out as the cube root, so that two stars side by side stay two stars.
// A halo or a glow is added as it is.
function splat(S, bx, by, sg, cr, cg, cb, cube) {
  const R = ceil(sg * 2.8), x0 = max(0, floor(bx - R)), x1 = min(W - 1, ceil(bx + R)), y0 = max(0, floor(by - R)), y1 = min(H - 1, ceil(by + R));
  const inv = (GN / 4.0) / (2 * sg * sg);
  const pr = cube ? S.ar : S.gr, pg = cube ? S.ag : S.gg, pb = cube ? S.ab : S.gb;
  for (let y = y0; y <= y1; y++) {
    const dy = y - by, row = y * W;
    for (let x = x0; x <= x1; x++) {
      const dx = x - bx, q = (dx * dx + dy * dy) * inv;
      if (q >= GN) continue;
      const g = GL[q | 0], i = row + x;
      if (cube) {
        const r = cr * g, gg = cg * g, b = cb * g;
        pr[i] += r * r * r;
        pg[i] += gg * gg * gg;
        pb[i] += b * b * b;
      } else {
        pr[i] += cr * g;
        pg[i] += cg * g;
        pb[i] += cb * g;
      }
    }
  }
}

// ---- the isochrone: where a cluster of this age puts stars of every mass, drawn as a soft ribbon whose strength follows how many stars sit there
const RBX = new Float32Array(400), RBY = new Float32Array(400), RBC = new Float32Array(400), RBN = new Float32Array(400), RBK = new Uint8Array(400);
function isochrone(C, age, z, E) {
  const e = 1 - C.alpha, a = pow(C.mmin, e), b = pow(C.mmax, e), norm = (C.alpha - 1) / (a - b);
  const Mto = pow((10 * pow(10, 0.03 * z)) / (age - 0.003), 0.4);
  let n = 0;
  const put = (M, dM) => {
    evolve(M, age, z, 0.5, _o);
    if (_o.kind === 7 || n >= 400) return;
    RBX[n] = X0 + (LT_LEFT - _o.lt) * XS + 7 * (E + C.red) + driftX(C.g);
    RBY[n] = Y0 + (LL_TOP - _o.ll) * YS + C.dy + driftY(C.g);
    RBC[n] = _o.lt - 0.3 * (E + C.red);
    RBN[n] = C.n * norm * pow(M, -C.alpha) * dM;
    RBK[n] = _o.kind;
    n++;
  };
  const top = min(Mto, C.mmax);
  if (top > C.mmin * 1.02) {
    const f = Math.log(top / C.mmin) / 69;
    for (let j = 0; j < 70; j++) put(C.mmin * exp(f * j), C.mmin * exp(f * j) * f);
  }
  const dt = 0.96 / 119;
  for (let j = 0; j < 120; j++) {
    const tau = 1 + dt * j, M = Mto * pow(tau, 0.4);
    if (M > C.mmax) break;
    put(M, Mto * 0.4 * pow(tau, -0.6) * dt);
  }
  const m0 = Mto * pow(1.97, 0.4), m1 = min(8.4, C.mmax);
  if (m1 > m0 * 1.02 && m0 > C.mmin) {
    const f = Math.log(m1 / m0) / 39;
    for (let j = 0; j < 40; j++) put(m0 * exp(f * j), m0 * exp(f * j) * f);
  }
  return n;
}

function drawRibbon(S, C, age, z, E, k4, wgt) {
  if (wgt < 0.01) return;
  const n = isochrone(C, age, z, E), sg = 1.2 + 5 * k4;
  for (let j = 0; j + 1 < n; j++) {
    const dx = RBX[j + 1] - RBX[j], dy = RBY[j + 1] - RBY[j], arc = sqrt(dx * dx + dy * dy);
    if (arc < 1e-3 || RBK[j] === 5 || RBK[j + 1] === 5) continue;
    const dens = RBN[j] / max(arc, 0.8), amp = 0.26 * (1 - exp(-dens / 0.3)) * wgt;
    if (RBX[j] < -4 && RBX[j + 1] < -4) continue;
    const steps = ceil(arc / 1.0);
    for (let k = 0; k < steps; k++) {
      const f = (k + 0.5) / steps, px = RBX[j] + dx * f, py = RBY[j] + dy * f;
      if (px < -4 || px > W + 4 || py < -4 || py > H + 4) continue;
      starRGB(lerp(RBC[j], RBC[j + 1], f));
      const v = (amp * arc) / steps / (sg * 2.5);
      splat(S, px, py, sg, _c[0] * v, _c[1] * v, _c[2] * v, false);
    }
  }
}

function drawStar(S, st, i, E) {
  const w = st.w;
  if (w < 0.01 || st.x < -6 || st.x > W + 6 || st.y < -6 || st.y > H + 6) return;
  const t = S.t, ll = st.ll;
  const lv = cl((ll + 3) / 8, 0, 1);
  let I = 1 + 0.09 * sin(W1[i] * t + P1[i]) + 0.05 * sin(W2[i] * t + P2[i]);
  // pulsation in the instability strip, and the slow swell of a cool asymptotic giant
  const lt = st.lt;
  if (st.kind >= 2 && st.kind <= 4) {
    const strip = sm(3.72, 3.76, lt) * (1 - sm(3.86, 3.9, lt)) * sm(1.2, 1.8, ll);
    I *= 1 + 0.2 * strip * sin((TAU * t) / PP[i] + P1[i]);
    if (st.kind === 4 && ll > 3) I *= 1 + 0.3 * sin((TAU * t) / PM[i] + P2[i]) * sm(3.0, 3.5, ll);
  }
  if (st.kind === 0) I *= 1 + flare(i, t, ll);
  const sg = 0.74 + 0.95 * pow(lv, 1.3);
  const core = (0.4 + 0.6 * pow(lv, 1.2)) * I * w * (1 - 0.25 * E);
  starRGB(st.ct);
  splat(S, st.x, st.y, sg, _c[0] * core, _c[1] * core, _c[2] * core, true);
  const wc = cl((lv - 0.45) / 0.5, 0, 1);
  if (wc > 0) {
    const hot = 0.35 * wc * wc * I * w;
    splat(S, st.x, st.y, sg * 0.55, hot, hot, hot, true);
  }
  const ha = 0.04 + 0.3 * pow(lv, 2.6);
  {
    const hs = 1.8 + 2.5 * pow(lv, 1.5), hh = ha * I * w * (1 - 0.25 * E);
    splat(S, st.x, st.y, hs, _c[0] * hh, _c[1] * hh, _c[2] * hh, false);
  }
}

// a red dwarf that now and then brightens for a moment
function flare(i, t, ll) {
  if (ll > -0.5) return 0;
  const e = t / 2.3 + 3.7 * i, ep = floor(e);
  if (h32(i * 977 + ep, 4711) > 0.04) return 0;
  return 1.2 * exp(-4 * (e - ep));
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const kn = S.kn, E = cl(kn[0], -0.3, 0.8), k4 = cl(kn[3], 0, 0.6), z0 = cl(kn[2], -2.2, 0.4);
  const { ar, ag, ab, gr, gg, gb, A, B, M } = S;
  ar.fill(0);
  ag.fill(0);
  ab.fill(0);
  gr.fill(0);
  gg.fill(0);
  gb.fill(0);
  for (let g = 0; g < NGR; g++) {
    const G = S.pops[g], C = clusterAt(g, G.k);
    if (G.prog < C.win) {
      const age = pow(10, C.a0 + G.prog), z = cl(C.z + z0, -2.4, 0.45);
      drawRibbon(S, C, age, z, E, k4, 1);
      for (let i = 0; i < NG; i++) {
        appear(C, i, age, z, E, k4, A);
        drawStar(S, A, g * NG + i, E);
      }
    } else {
      const C2 = clusterAt(g, G.k + 1), s = (G.prog - C.win) / MORPH;
      const zA = cl(C.z + z0, -2.4, 0.45), zB = cl(C2.z + z0, -2.4, 0.45), ageA = pow(10, C.a1), ageB = pow(10, C2.a0);
      drawRibbon(S, C, ageA, zA, E, k4, cl(1 - 2 * s, 0, 1));
      drawRibbon(S, C2, ageB, zB, E, k4, cl(2 * s - 1, 0, 1));
      for (let i = 0; i < NG; i++) {
        const j = g * NG + i;
        appear(C, i, ageA, zA, E, k4, A);
        appear(C2, i, ageB, zB, E, k4, B);
        const m = sm(DEL[j], DEL[j] + 0.55, s), wa = A.w * (1 - m), wb = B.w * m, ws = wa + wb;
        if (ws < 1e-4) continue;
        const ta = wa / ws;
        M.x = lerp(B.x, A.x, ta);
        M.y = lerp(B.y, A.y, ta);
        M.ll = lerp(B.ll, A.ll, ta);
        M.ct = lerp(B.ct, A.ct, ta);
        M.lt = lerp(B.lt, A.lt, ta);
        M.w = ws;
        M.kind = m < 0.5 ? A.kind : B.kind;
        drawStar(S, M, j, E);
      }
    }
  }
  for (let f = S.flash.length - 1; f >= 0; f--) {
    const F = S.flash[f], ft = S.t - F.t;
    if (ft > 1.8) {
      S.flash.splice(f, 1);
      continue;
    }
    const amp = exp(-ft / 0.4), sg = 1.4 + 3.6 * (1 - exp(-ft / 0.35));
    splat(S, F.x, F.y, sg, 0.55 * amp, 0.7 * amp, 0.95 * amp, false);
    splat(S, F.x, F.y, 1.0, 0.8 * amp, 0.8 * amp, 0.85 * amp, false);
  }
  for (let i = 0; i < NPX; i++) {
    const r = Math.cbrt(ar[i]) + gr[i], g = Math.cbrt(ag[i]) + gg[i], b = Math.cbrt(ab[i]) + gb[i], m = max(r, g, b);
    if (m < 0.004) {
      display.setPixel(i % W, (i / W) | 0, 0, 0, 0);
      continue;
    }
    const f = tone(m) / m, wh = 0.25 * sm(0.9, 2.5, m);
    const o = tone(m) * wh;
    display.setPixel(i % W, (i / W) | 0, ((r * f * (1 - wh) + o) * 255 + 0.5) | 0, ((g * f * (1 - wh) + o) * 255 + 0.5) | 0, ((b * f * (1 - wh) + o) * 255 + 0.5) | 0);
  }
}

// a soft knee on the strongest channel, so that a pile of stars gets brighter and keeps its hue
function tone(m) {
  const v = m < 0.8 ? m : 0.8 + 0.2 * (1 - exp(-(m - 0.8) / 0.2));
  return cl(v, 0, 1);
}
