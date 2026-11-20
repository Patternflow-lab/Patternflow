// ===== Patternflow pattern =====
// Title:   Lee Waves
// Family:  lenticular
// Idea:    A stack of standing lens-shaped clouds hangs above a ridge in a steady wind at sunset, the air streaming through them, condensing at each wave crest and clearing in each trough, so the lenses never move while their edges stream out and shred.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Jacques Queney's 1948 and R. S. Scorer's 1949 linear theory of air flow over a ridge, the Witch of Agnesi ridge profile (Maria Gaetana Agnesi, 1748), and the standing lee waves and rotors that the Sierra Wave Project glided into in the 1950s; pattern round 206
// Round:   206
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wind=1..8, Moisture=-1..1, Ridge=-1..1
//
// Knob 1: Hue.
// Knob 2: Wind.
// Knob 3: Moisture.
// Knob 4: Ridge.

const W = 64;
const H = 128;
const { floor, sqrt, exp, sin, cos, abs, min, max, pow, PI, imul, random } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

const NZ = 152; // streamline rows: z0 = i + 0.5 LEDs above the foot of the panel
const XS = -24; // the sweep along each streamline starts this far left of the panel
const NX = W - XS;
const XR = 9; // column of the ridge crest
const RA = 10; // half width of the ridge, the a of the Witch of Agnesi
const NL = 6;
const LZ = [39, 54, 69, 84, 100, 117]; // layer heights
const LS = [5.6, 5.5, 5.5, 5.2, 4.9, 4.5]; // layer thickness (sigma)
const LH = [1.0, 0.99, 0.985, 0.975, 0.97, 0.96]; // layer humidity
const LP = [41, 59, 73, 101, 137, 89]; // seconds, rise and fall of each layer
const LQ = [29, 43, 67, 89, 113, 53]; // seconds, humidity of each layer
const CSAT = 0.046; // relative humidity gained per LED of lift
const DISP = 0.1; // share of that lift the streamline is drawn lifted by

function hh(i, j) {
  let h = (imul(i, 374761393) + imul(j, 668265263)) | 0;
  h = imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(u, v) {
  const i = floor(u);
  const j = floor(v);
  let a = u - i;
  let b = v - j;
  a = a * a * (3 - 2 * a);
  b = b * b * (3 - 2 * b);
  const p = hh(i, j);
  const q = hh(i + 1, j);
  const r = hh(i, j + 1);
  const s = hh(i + 1, j + 1);
  return p + (q - p) * a + (r - p) * b + (p - q - r + s) * a * b;
}

export function setup(params) {
  const S = {
    t: 0,
    first: true,
    k: [0, 2, 0, 0.06],
    sk: [0, 2, 0, 0.06],
    ph: Array.from({ length: 40 }, () => random() * TAU),
    X: Array.from({ length: NL }, () => random() * 500),
    X2: Array.from({ length: NL }, () => random() * 500),
    zo: Array.from({ length: NL }, () => random() * 50),
    gust: 1,
    E: new Float32Array(NZ * NX),
    Q: new Float32Array(NZ * NX),
    T: new Float32Array(NZ * NX),
    qn: new Float32Array(W * H),
    RH: new Float32Array(NZ),
    RL: new Int32Array(NZ),
    cb1: new Float32Array(NZ), sb1: new Float32Array(NZ), cb2: new Float32Array(NZ), sb2: new Float32Array(NZ),
    ca1: new Float32Array(NX), sa1: new Float32Array(NX), ca2: new Float32Array(NX), sa2: new Float32Array(NX), dx: new Float32Array(NX), up: new Float32Array(NX),
    zp: new Float32Array(NZ),
    qd: new Float32Array(W * H),
    ab: new Float32Array(W * H),
    be: new Float32Array(W * H),
    lf: new Float32Array(W * H),
    gl: new Float32Array(W * H),
    ground: new Float32Array(W),
    slope: new Float32Array(W),
    pal: {},
    P: {},
  };
  params.s = S;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  if (S.first) {
    S.sk = S.k.slice();
    S.first = false;
  }
  const e = 1 - exp(-dt / 0.4);
  for (let i = 0; i < 4; i++) S.sk[i] += (S.k[i] - S.sk[i]) * e;
  S.t += dt;
  const t = S.t;
  const ph = S.ph;
  S.gust = 1 + 0.12 * sin((TAU * t) / 9.3 + ph[10]) + 0.08 * sin((TAU * t) / 14.1 + ph[11]) + 0.05 * sin((TAU * t) / 5.7 + ph[12]);
  const wind = cl(S.sk[1], 1, 8);
  const U = 1.6 * pow(wind, 0.9) * S.gust;
  for (let j = 0; j < NL; j++) {
    const uj = U * (0.8 + 0.1 * j);
    S.X[j] += uj * dt;
    S.X2[j] += uj * 1.3 * dt;
  }
}

// The slowly breathing numbers of the wave field at this instant.
function derive(S) {
  const t = S.t;
  const ph = S.ph;
  const wind = cl(S.sk[1], 1, 8);
  const P = S.P;
  P.moist = cl(S.sk[2], -1, 1);
  P.h0 = 17 + 11 * cl(S.sk[3], -1, 1);
  const nb = 1 + 0.07 * sin((TAU * t) / 157 + ph[0]) + 0.05 * sin((TAU * t) / 241 + ph[1]) + 0.04 * sin((TAU * t) / 83 + ph[2]);
  P.lam1 = (32 + 2.6 * wind) * nb;
  P.lam2 = 0.62 * P.lam1 * (1 + 0.04 * sin((TAU * t) / 197 + ph[5]));
  P.k1 = TAU / P.lam1;
  P.k2 = TAU / P.lam2;
  P.c1 = 0.4 * P.lam1;
  P.c2 = 0.35 * P.lam2;
  P.tau1 = 0.09 * (1 + 0.25 * sin((TAU * t) / 121 + ph[3]));
  P.tau2 = -0.04;
  P.A1 = 0.52 * P.h0;
  P.A2 = 0.3 * P.h0;
  P.za1 = 70 + 14 * sin((TAU * t) / 173 + ph[4]);
  P.za2 = 100 + 22 * sin((TAU * t) / 131 + ph[6]);
}

function fieldRows(S) {
  const P = S.P;
  const t = S.t;
  const ph = S.ph;
  const { cb1, sb1, cb2, sb2, RH, RL } = S;
  const sTh = 1 + 0.2 * P.moist;
  const zj = [];
  const sj = [];
  const hj = [];
  for (let j = 0; j < NL; j++) {
    zj.push(LZ[j] + 2.2 * sin((TAU * t) / LP[j] + ph[20 + j]));
    sj.push(LS[j] * sTh);
    hj.push(LH[j] + 0.085 * P.moist + 0.045 * sin((TAU * t) / LQ[j] + ph[26 + j]));
  }
  for (let i = 0; i < NZ; i++) {
    const z0 = i + 0.5;
    const u1 = (z0 - P.za1) / 36;
    const V1 = 0.3 + 0.7 * exp(-0.5 * u1 * u1);
    const b1 = P.k1 * P.tau1 * (z0 - 40) + 0.9 * sin((TAU * z0) / 83 + ph[7]);
    cb1[i] = P.A1 * V1 * cos(b1);
    sb1[i] = P.A1 * V1 * sin(b1);
    const u2 = (z0 - P.za2) / 24;
    const V2 = 0.12 + 0.88 * exp(-0.5 * u2 * u2);
    const b2 = P.k2 * P.tau2 * (z0 - 40);
    cb2[i] = P.A2 * V2 * cos(b2);
    sb2[i] = P.A2 * V2 * sin(b2);
    let best = 0;
    let lay = 0;
    for (let j = 0; j < NL; j++) {
      const u = (z0 - zj[j]) / sj[j];
      const g = hj[j] * exp(-0.5 * u * u);
      if (g > best) {
        best = g;
        lay = j;
      }
    }
    RH[i] = best;
    RL[i] = lay;
  }
}

function fieldCols(S) {
  const P = S.P;
  const { ca1, sa1, ca2, sa2, dx, up } = S;
  for (let xi = 0; xi < NX; xi++) {
    const d = xi + XS + 0.5 - XR;
    dx[xi] = d;
    up[xi] = sm(-8, 5, d);
    const D = sm(-4, 14, d) * exp(-max(0, d) / 95);
    const a1 = P.k1 * (d - P.c1);
    const a2 = P.k2 * (d - P.c2);
    ca1[xi] = D * cos(a1);
    sa1[xi] = D * sin(a1);
    ca2[xi] = D * cos(a2);
    sa2[xi] = D * sin(a2);
  }
}

// Vertical displacement of every streamline at every column, and then the
// cloud that condenses along each streamline: the air is lifted into the
// saturation at a crest and carries its cloud down the other side, where it
// frays and clears.
function clouds(S) {
  const P = S.P;
  const { E, Q, T, RH, RL, cb1, sb1, cb2, sb2, ca1, sa1, ca2, sa2, dx, up, X, X2, zo } = S;
  const lift = 0.7 * P.h0 * RA;
  for (let i = 0; i < NZ; i++) {
    const z0 = i + 0.5;
    const rz = RA + z0;
    const f = lift * rz;
    const rz2 = rz * rz;
    const c1 = cb1[i], s1 = sb1[i], c2 = cb2[i], s2 = sb2[i];
    const o = i * NX;
    for (let xi = 0; xi < NX; xi++) E[o + xi] = ((f / (dx[xi] * dx[xi] + rz2)) * exp(-((dx[xi] * dx[xi]) / 1600)) + ca1[xi] * c1 - sa1[xi] * s1 + ca2[xi] * c2 - sa2[xi] * s2) * up[xi];
  }
  for (let i = 0; i < NZ; i++) {
    const o = i * NX;
    const rh = RH[i];
    if (rh < 0.4) {
      for (let xi = 0; xi < NX; xi++) {
        Q[o + xi] = 0;
        T[o + xi] = 0.5;
      }
      continue;
    }
    const z0 = i + 0.5;
    const j = RL[i];
    const x1 = X[j];
    const x2 = X2[j];
    const v1 = (z0 + zo[j]) / 2.6;
    const v2 = z0 / 1.9 + 7.3;
    let m = 0;
    let age = 0;
    for (let xi = 0; xi < NX; xi++) {
      const x = xi + XS + 0.5;
      const sat = rh + CSAT * E[o + xi] - 1;
      if (sat < -0.5 && m < 0.02) {
        Q[o + xi] = 0;
        T[o + xi] = 0.5;
        m = 0;
        age = 0;
        continue;
      }
      const n1 = vn((x - x1) / 10, v1);
      const n2 = vn((x - x2) / 5.2 + 11, v2);
      const n = cl(0.5 + 2.0 * (0.62 * n1 + 0.38 * n2 - 0.5), 0, 1);
      const beta = 0.04 + 0.34 * (1 - exp(-age / 12));
      const qi = sm(0, 0.15 + 0.1 * (1 - exp(-age / 8)), sat + beta * (n - 0.5));
      m = max(qi, m * exp(-(0.4 + 1.9 * (1 - n)) / 10));
      if (qi > 0.25 || m > 0.15) age++;
      else age = 0;
      Q[o + xi] = m;
      T[o + xi] = n;
    }
  }
}

// Lay each streamline's cloud into display rows: a streamline at height z0
// is drawn at z0 plus its displacement.
function mapDisplay(S) {
  const { E, Q, T, zp, qd, qn } = S;
  for (let x = 0; x < W; x++) {
    const xi = x - XS;
    let prev = -1e9;
    for (let i = 0; i < NZ; i++) {
      let z = i + 0.5 + DISP * E[i * NX + xi];
      if (z < prev + 0.2) z = prev + 0.2;
      zp[i] = z;
      prev = z;
    }
    let i = 0;
    for (let r = 0; r < H; r++) {
      const zc = r + 0.5;
      while (i + 1 < NZ && zp[i + 1] <= zc) i++;
      let v = 0;
      let n = 0.5;
      if (i + 1 < NZ && zp[i] <= zc) {
        const tt = (zc - zp[i]) / (zp[i + 1] - zp[i]);
        v = Q[i * NX + xi] * (1 - tt) + Q[(i + 1) * NX + xi] * tt;
        n = T[i * NX + xi] * (1 - tt) + T[(i + 1) * NX + xi] * tt;
      }
      qd[(H - 1 - r) * W + x] = v;
      qn[(H - 1 - r) * W + x] = n;
    }
  }
}

function setMatrix(M, a) {
  const c = cos(a);
  const s = sin(a);
  const k = (1 - c) / 3;
  const q = s * 0.57735027;
  M[0] = c + k; M[1] = k - q; M[2] = k + q;
  M[3] = k + q; M[4] = c + k; M[5] = k - q;
  M[6] = k - q; M[7] = k + q; M[8] = c + k;
}
function rot(M, c) {
  return [
    cl(M[0] * c[0] + M[1] * c[1] + M[2] * c[2], 0, 255),
    cl(M[3] * c[0] + M[4] * c[1] + M[5] * c[2], 0, 255),
    cl(M[6] * c[0] + M[7] * c[1] + M[8] * c[2], 0, 255),
  ];
}
function ramp(stops, v, out) {
  let k = 0;
  while (k < stops.length - 2 && v > stops[k + 1][0]) k++;
  const a = stops[k];
  const b = stops[k + 1];
  const u = cl((v - a[0]) / (b[0] - a[0]), 0, 1);
  out[0] = a[1] + (b[1] - a[1]) * u;
  out[1] = a[2] + (b[2] - a[2]) * u;
  out[2] = a[3] + (b[3] - a[3]) * u;
}

const SKY = [
  [0, 190, 196, 240],
  [18, 168, 190, 245],
  [45, 96, 150, 240],
  [80, 44, 100, 225],
  [110, 22, 58, 190],
  [128, 12, 36, 150],
];
const GLOW = [
  [0, 130, 150, 240],
  [0.25, 214, 150, 220],
  [0.5, 255, 150, 140],
  [0.75, 255, 176, 96],
  [1, 255, 214, 130],
];

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  derive(S);
  fieldRows(S);
  fieldCols(S);
  clouds(S);
  mapDisplay(S);
  const P = S.P;
  const t = S.t;
  const ph = S.ph;
  const { qd, qn, ab, be, lf, gl, ground, slope } = S;

  // palette, turned round the wheel together
  const M = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  setMatrix(M, TAU * (S.sk[0] || 0));
  const sky = SKY.map((s) => [s[0], ...rot(M, [s[1], s[2], s[3]])]);
  const glow = GLOW.map((s) => [s[0], ...rot(M, [s[1], s[2], s[3]])]);
  const CT = rot(M, [232, 238, 255]);
  const CB = rot(M, [255, 188, 122]);
  const CS = rot(M, [150, 160, 222]);
  const RB = rot(M, [44, 26, 70]);
  const RT = rot(M, [70, 44, 96]);
  const RM = rot(M, [255, 150, 74]);

  // sun glow
  const gx = 54 + 6 * sin((TAU * t) / 311 + ph[14]) + 4 * sin((TAU * t) / 487 + ph[15]);
  const gz = 14 + 6 * sin((TAU * t) / 397 + ph[16]) + 3 * sin((TAU * t) / 233 + ph[17]);
  const gI = 0.92 + 0.08 * sin((TAU * t) / 151 + ph[18]);
  for (let y = 0; y < H; y++) {
    const Z = H - y - 0.5;
    const dz = (Z - gz) / 11;
    for (let x = 0; x < W; x++) {
      const dxx = (x + 0.5 - gx) / 20;
      gl[y * W + x] = gI * exp(-0.5 * (dxx * dxx + dz * dz));
    }
  }

  // ground: a Witch of Agnesi ridge and a low foothill
  for (let x = 0; x < W; x++) {
    const d1 = (x + 0.5 - XR) / RA;
    const d2 = (x + 0.5 - 57) / 8;
    ground[x] = 3 + P.h0 / (1 + d1 * d1) + 0.3 * P.h0 / (1 + d2 * d2);
  }
  for (let x = 0; x < W; x++) slope[x] = ((ground[min(W - 1, x + 1)] - ground[max(0, x - 1)]) / (min(W - 1, x + 1) - max(0, x - 1)));

  // leaky sums of cloud above, below and to the left of every LED
  for (let x = 0; x < W; x++) {
    let a = 0;
    for (let y = 0; y < H; y++) {
      ab[y * W + x] = a;
      a = a * 0.8 + qd[y * W + x];
    }
    let b = 0;
    for (let y = H - 1; y >= 0; y--) {
      be[y * W + x] = b;
      b = b * 0.8 + qd[y * W + x];
    }
  }
  for (let y = 0; y < H; y++) {
    let l = 0;
    for (let x = 0; x < W; x++) {
      lf[y * W + x] = l;
      l = l * 0.82 + qd[y * W + x];
    }
  }

  const sc = [0, 0, 0];
  const gc = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    const Z = H - y - 0.5;
    ramp(sky, Z, sc);
    const sr = sc[0], sg = sc[1], sb = sc[2];
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const g = gl[p];
      ramp(glow, g, gc);
      const ga = sm(0, 0.4, g);
      let r = lerp(sr, gc[0], ga);
      let gg = lerp(sg, gc[1], ga);
      let b = lerp(sb, gc[2], ga);
      const q = qd[p];
      if (q > 0.004) {
        const a = ab[p];
        const bl = be[p];
        const wv = a / (a + bl + 1e-3);
        // light from the lower right: the right end of a lens is lit
        const right = lf[p] / (lf[p] + (qd[p] > 0 ? 0 : 0) + 3.5);
        const warm = sm(0.2, 0.95, 0.75 * wv + 0.25 * right) * (0.66 + 0.34 * g);
        let cr = lerp(CT[0], CB[0], warm);
        let cg = lerp(CT[1], CB[1], warm);
        let cb = lerp(CT[2], CB[2], warm);
        const thick = a + bl + q;
        const sh = (0.6 + 0.4 * exp(-0.1 * thick)) * (0.72 + 0.56 * qn[p]);
        cr = lerp(CS[0], cr, sh);
        cg = lerp(CS[1], cg, sh);
        cb = lerp(CS[2], cb, sh);
        const al = 0.96 * pow(cl(q, 0, 1), 0.85);
        r = lerp(r, cr, al);
        gg = lerp(gg, cg, al);
        b = lerp(b, cb, al);
      }
      // ground
      const cov = cl(ground[x] - (Z - 0.5), 0, 1);
      if (cov > 0) {
        const depth = ground[x] - Z;
        const hz = cl(depth / 22, 0, 1);
        let rr = lerp(RT[0], RB[0], hz);
        let rg = lerp(RT[1], RB[1], hz);
        let rb = lerp(RT[2], RB[2], hz);
        const face = cl(0.35 - 2.4 * slope[x], 0, 1);
        const rim = exp(-max(0, depth) / 1.4) * (0.25 + 0.75 * face) * (0.4 + 0.6 * g);
        rr = lerp(rr, RM[0], rim);
        rg = lerp(rg, RM[1], rim);
        rb = lerp(rb, RM[2], rim);
        r = lerp(r, rr, cov);
        gg = lerp(gg, rg, cov);
        b = lerp(b, rb, cov);
      }
      display.setPixel(x, y, min(255, r), min(255, gg), min(255, b));
    }
  }
}
