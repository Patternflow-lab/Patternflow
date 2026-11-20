// ===== Patternflow pattern =====
// Title:   Lee Waves
// Family:  lenticular
// Idea:    A stack of standing lens-shaped clouds hangs above a ridge in a steady wind at sunset, the air streaming through them, condensing at each wave crest and clearing in each trough, so the lenses never move while their edges stream out and shred.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Jacques Queney's 1948 and R. S. Scorer's 1949 linear theory of air flow over a ridge, the Witch of Agnesi ridge profile (Maria Gaetana Agnesi, 1748), and the standing lee waves that the Sierra Wave Project glided into in the 1950s; pattern round 206
// Round:   206
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wind=1..8, Moisture=-1..1, Ridge=-1..1
//
// Knob 1: Hue. Turns the sky through six dusks and back to the first: blue with a peach and gold sun at 0 and 1, violet and pink at 0.17, rose and orange at 0.33, crimson to gold at 0.5, green and lemon at 0.67, cyan at 0.83. The clouds stay near white, and their undersides take the colour of the glow.
// Knob 2: Wind. The speed of the air through the clouds, 2.4 LEDs a second at 1, 4.2 at the opening 2 and 12.7 at 8, the upper layers up to 1.6 times faster than the lowest, with gusts of about 15% every 6 to 14 seconds. It also spaces the lenses, 28 LEDs apart at 1, 32 at 2 and 53 at 8, and sets how far a cloud is carried before it clears: trailing streamers of about 8 LEDs, 10 at the opening and 20.
// Knob 3: Moisture. How damp the six layers are, opening at 0. At -1 the sky is a clear deep blue and the lenses are thin, about 15 LEDs wide and 7 through their bright core, with the sun's glow drawn in to 0.7 of its size; at +1 they are about 19 wide and 9 through, the blue thins towards a pale horizon by up to a third and the glow swells to 1.3 times its size.
// Knob 4: Ridge. The height of the ridge's crest above the foot of the panel, 9 LEDs at -1, 21 at the opening 0.06 and 31 at 1, and with it the swing of the wave: the lenses are 6 LEDs thick at -1 and 9 at 1, and at the top of the range neighbouring layers begin to touch.

const W = 64;
const H = 128;
const { floor, exp, sin, cos, abs, min, max, pow, PI, imul } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

const NZ = 152; // flow line rows: z0 = i + 0.5 LEDs above the foot of the panel
const XS = -24; // the sweep along each flow line starts this far left of the panel
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
const DISP = 0.1; // share of that lift the flow line is drawn lifted by

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
    ph: Array.from({ length: 40 }, () => Math.random() * TAU),
    X: Array.from({ length: NL }, () => Math.random() * 500),
    X2: Array.from({ length: NL }, () => Math.random() * 500),
    zo: Array.from({ length: NL }, () => Math.random() * 50),
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
    far: new Float32Array(W),
    slope: new Float32Array(W),
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
  const U = 2.4 * pow(wind, 0.8) * S.gust;
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
  const nb = 1 + 0.07 * sin((TAU * t) / 157 + ph[0]) + 0.05 * sin((TAU * t) / 241 + ph[1]) + 0.04 * sin((TAU * t) / 83 + ph[2]) + 0.035 * sin((TAU * t) / 37.7 + ph[34]);
  P.lam1 = (25 + 3.5 * wind) * nb;
  P.lam2 = 0.62 * P.lam1 * (1 + 0.04 * sin((TAU * t) / 197 + ph[5]));
  P.k1 = TAU / P.lam1;
  P.k2 = TAU / P.lam2;
  P.c1 = 0.3 * P.lam1;
  P.c2 = 0.35 * P.lam2;
  P.tau1 = 0.09 * (1 + 0.25 * sin((TAU * t) / 121 + ph[3]));
  P.tau2 = -0.04;
  P.A1 = 5 + 0.28 * P.h0;
  P.A2 = 3 + 0.15 * P.h0;
  P.za1 = 70 + 14 * sin((TAU * t) / 173 + ph[4]) + 7 * sin((TAU * t) / 61 + ph[32]);
  P.za2 = 100 + 22 * sin((TAU * t) / 131 + ph[6]) + 8 * sin((TAU * t) / 47 + ph[33]);
}

function fieldRows(S) {
  const P = S.P;
  const t = S.t;
  const ph = S.ph;
  const { cb1, sb1, cb2, sb2, RH, RL } = S;
  const sTh = 1 + (P.moist < 0 ? 0.12 : 0.09) * P.moist;
  const zj = [];
  const sj = [];
  const hj = [];
  for (let j = 0; j < NL; j++) {
    zj.push(LZ[j] + 2.2 * sin((TAU * t) / LP[j] + ph[20 + j]));
    sj.push(LS[j] * sTh);
    hj.push(LH[j] + (P.moist < 0 ? 0.055 : 0.05) * P.moist + 0.075 * sin((TAU * t) / LQ[j] + ph[26 + j]));
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
    const D = sm(-6, 6, d) * exp(-max(0, d) / 95);
    const a1 = P.k1 * (d - P.c1);
    const a2 = P.k2 * (d - P.c2);
    ca1[xi] = D * cos(a1);
    sa1[xi] = D * sin(a1);
    ca2[xi] = D * cos(a2);
    sa2[xi] = D * sin(a2);
  }
}

// Vertical displacement of every flow line at every column, and then the
// cloud that condenses along each flow line: the air is lifted into the
// saturation at a crest and carries its cloud down the other side, where it
// frays and clears.
function clouds(S) {
  const P = S.P;
  const { E, Q, T, RH, RL, cb1, sb1, cb2, sb2, ca1, sa1, ca2, sa2, dx, up, X, X2, zo } = S;
  const lift = 0.7 * P.h0 * RA;
  // the faster the air, the further a cloud is carried before it clears
  const ell = 5 + 1.2 * 2.4 * pow(cl(S.sk[1], 1, 8), 0.8);
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
      m = max(qi, m * exp(-(0.4 + 1.9 * (1 - n)) / ell));
      age = m > 0.15 ? age + 1 : max(0, age - 3);
      Q[o + xi] = m;
      T[o + xi] = n;
    }
  }
}

// Lay each flow line's cloud into display rows: a flow line at height z0
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

// The sky, one palette per fifth of K1, each one a dusk of its own. The knob
// walks through them and comes back to the first at 1. Per palette: zenith,
// mid sky, low sky, horizon, the four steps of the sun's glow (from the pale
// halo to the core), the sunlit underside of a cloud, its top, its shadow, the
// ridge at its foot and at its crest, and the light along the ridge's edge.
const PAL = [
  [[12, 36, 150], [44, 100, 225], [96, 150, 240], [168, 190, 245], [214, 150, 220], [255, 150, 140], [255, 176, 96], [255, 214, 130], [255, 188, 122], [232, 238, 255], [150, 160, 222], [44, 26, 70], [70, 44, 96], [255, 150, 74]],
  [[30, 10, 120], [86, 44, 196], [160, 96, 226], [226, 150, 226], [230, 130, 230], [255, 120, 170], [255, 150, 100], [255, 208, 120], [255, 170, 150], [240, 232, 255], [170, 150, 225], [40, 14, 72], [70, 34, 100], [255, 130, 110]],
  [[120, 16, 110], [200, 40, 140], [248, 110, 140], [255, 176, 140], [255, 140, 150], [255, 150, 110], [255, 180, 90], [255, 224, 130], [255, 200, 140], [255, 238, 240], [200, 140, 190], [60, 12, 50], [100, 30, 70], [255, 170, 80]],
  [[150, 36, 60], [225, 90, 60], [255, 160, 80], [255, 215, 140], [255, 170, 130], [255, 190, 100], [255, 215, 110], [255, 240, 170], [255, 215, 150], [255, 246, 235], [190, 130, 150], [50, 16, 28], [88, 34, 46], [255, 200, 110]],
  [[10, 70, 60], [40, 150, 80], [140, 210, 110], [235, 240, 150], [230, 240, 150], [255, 230, 120], [255, 200, 90], [255, 236, 150], [255, 225, 150], [245, 255, 240], [130, 190, 150], [8, 36, 28], [24, 70, 50], [255, 210, 90]],
  [[6, 16, 120], [10, 84, 200], [40, 170, 235], [150, 226, 245], [170, 200, 255], [200, 170, 240], [255, 170, 150], [255, 216, 130], [255, 200, 150], [236, 246, 255], [140, 170, 230], [20, 22, 64], [40, 50, 100], [255, 170, 100]],
];
const NC = 14;
function toHsv(c, o) {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  o[0] = h;
  o[1] = mx > 0 ? d / mx : 0;
  o[2] = mx;
}
function fromHsv(h, s, v, o) {
  const k = (n) => (n + h) % 6;
  const f = (n) => 255 * v * (1 - s * max(0, min(k(n), 4 - k(n), 1)));
  o[0] = f(5);
  o[1] = f(3);
  o[2] = f(1);
}
// Colours are blended round the hue circle, not through grey, so two dusks
// that sit opposite each other pass through the colours between them.
const HA = [0, 0, 0];
const HB = [0, 0, 0];
function palette(k, out) {
  const n = PAL.length;
  const pos = cl(k, 0, 1) * n;
  const a = min(floor(pos), n - 1);
  const f = pos - a;
  const A = PAL[a];
  const B = PAL[(a + 1) % n];
  for (let c = 0; c < NC; c++) {
    toHsv(A[c], HA);
    toHsv(B[c], HB);
    let dh = HB[0] - HA[0];
    if (dh > 3) dh -= 6;
    else if (dh < -3) dh += 6;
    // an almost grey colour has no hue of its own to carry
    const wa = HA[1] < 0.06 ? 0 : 1;
    const wb = HB[1] < 0.06 ? 0 : 1;
    let h = HA[0] + dh * f;
    if (!wa) h = HB[0];
    else if (!wb) h = HA[0];
    fromHsv((h + 6) % 6, lerp(HA[1], HB[1], f), lerp(HA[2], HB[2], f), out[c]);
  }
}
const PALOUT = Array.from({ length: NC }, () => [0, 0, 0]);

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
  const { qd, qn, ab, be, lf, gl, ground, slope, far } = S;

  palette(S.sk[0], PALOUT);
  const [ZEN, MID, LOW, HOR, G1, G2, G3, G4, CB, CT, CS, RB, RT, RM] = PALOUT;

  // sun glow
  const gx = 54 + 6 * sin((TAU * t) / 311 + ph[14]) + 4 * sin((TAU * t) / 487 + ph[15]);
  const gz = 14 + 6 * sin((TAU * t) / 397 + ph[16]) + 3 * sin((TAU * t) / 233 + ph[17]);
  const gI = 0.92 + 0.08 * sin((TAU * t) / 151 + ph[18]);
  const gs = 1 + 0.3 * P.moist;
  for (let y = 0; y < H; y++) {
    const Z = H - y - 0.5;
    const dz = (Z - gz) / (11 * gs);
    for (let x = 0; x < W; x++) {
      const dxx = (x + 0.5 - gx) / (20 * gs);
      gl[y * W + x] = gI * exp(-0.5 * (dxx * dxx + dz * dz));
    }
  }

  // ground: a Witch of Agnesi ridge and a low foothill, and a range of hills behind
  for (let x = 0; x < W; x++) {
    const d1 = (x + 0.5 - XR) / RA;
    const d2 = (x + 0.5 - 57) / 8;
    ground[x] = 3 + P.h0 / (1 + d1 * d1) + 0.3 * P.h0 / (1 + d2 * d2);
    far[x] = 9 + 3.6 * sin((TAU * x) / 52 + 0.9) + 2.4 * sin((TAU * x) / 23 + 2.3) + 1.2 * sin((TAU * x) / 11.5 + 5.1);
  }
  for (let x = 0; x < W; x++) slope[x] = (ground[min(W - 1, x + 1)] - ground[max(0, x - 1)]) / (min(W - 1, x + 1) - max(0, x - 1));

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

  const gc = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    const Z = H - y - 0.5;
    // the sky by height
    let s0, s1, f;
    if (Z < 22) { s0 = HOR; s1 = HOR; f = 0; }
    else if (Z < 50) { s0 = HOR; s1 = LOW; f = (Z - 22) / 28; }
    else if (Z < 84) { s0 = LOW; s1 = MID; f = (Z - 50) / 34; }
    else { s0 = MID; s1 = ZEN; f = (Z - 84) / 44; }
    let sr = lerp(s0[0], s1[0], f), sg = lerp(s0[1], s1[1], f), sb = lerp(s0[2], s1[2], f);
    // damp air thins the blue toward the horizon's pale, dry air clears and deepens it
    const hz = P.moist > 0 ? 0.34 * P.moist * exp(-Z / 80) : 0.26 * P.moist * (1 - Z / 170);
    const hc = P.moist > 0 ? HOR : ZEN;
    sr = lerp(sr, hc[0], abs(hz));
    sg = lerp(sg, hc[1], abs(hz));
    sb = lerp(sb, hc[2], abs(hz));
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const g = gl[p];
      // the glow runs pale halo, coral, orange, gold
      let c0, c1, u;
      if (g < 0.25) { c0 = null; c1 = G1; u = g / 0.25; }
      else if (g < 0.5) { c0 = G1; c1 = G2; u = (g - 0.25) / 0.25; }
      else if (g < 0.75) { c0 = G2; c1 = G3; u = (g - 0.5) / 0.25; }
      else { c0 = G3; c1 = G4; u = (g - 0.75) / 0.25; }
      if (c0) {
        gc[0] = lerp(c0[0], c1[0], u); gc[1] = lerp(c0[1], c1[1], u); gc[2] = lerp(c0[2], c1[2], u);
      } else { gc[0] = c1[0]; gc[1] = c1[1]; gc[2] = c1[2]; }
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
        const right = lf[p] / (lf[p] + 3.5);
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
      // the hills behind the ridge take the sky's own light, deepened
      const fcov = cl(far[x] - (Z - 0.5), 0, 1);
      if (fcov > 0) {
        const dd = far[x] - Z;
        const k = 0.6 + 0.12 * cl(dd / 12, 0, 1);
        r = lerp(r, lerp(r, RT[0], k) * 0.8, fcov);
        gg = lerp(gg, lerp(gg, RT[1], k) * 0.8, fcov);
        b = lerp(b, lerp(b, RT[2], k) * 0.8, fcov);
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
