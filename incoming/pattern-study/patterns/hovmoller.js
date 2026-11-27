// ===== Patternflow pattern =====
// Title:   Hovmoller
// Family:  hovmoller
// Idea:    A time-longitude diagram of tropical rain, the 64 columns a full circle round the equator and the 128 rows two months of days, in which fast eastward Kelvin waves, slow westward Rossby waves and mixed Rossby-gravity and easterly waves draw crossing slanted bands, and an eastward Madden-Julian blotch switches them on and off as it goes round.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the time-longitude plot of Ernest Hovmoller (1949, from memory); the equatorial wave modes of Taroh Matsuno (1966); the eastward-moving envelope of Roland Madden and Paul Julian (1971); convectively coupled waves read off the wavenumber-frequency spectrum as in Matthew Wheeler and George Kiladis (1999). All from memory.
// Round:   266
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Scroll=1.2..6, Depth=-1..1, Envelope=-1..1
//
// Knob 1: Hue.
// Knob 2: Scroll.
// Knob 3: Depth.
// Knob 4: Envelope.

const W = 64, H = 128;
const { floor, sqrt, exp, sin, cos, abs, min, max, PI } = Math;
const TWO_PI = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();

const EARTH = 6.371e6, BETA = 2.28e-11, DAY = 86400;
const C0 = 17; // m/s, the Kelvin speed at Depth 0 (equivalent depth about 30 m)
const RHO = 0.35; // days to a row
const AREF = 64 * RHO; // the age, in days, that the tilt of the bands pivots on
const V_MJO = (5 / EARTH) * DAY; // rad per day, 5 m/s

// the modes: family, zonal wavenumber, spectral weight
const FAMS = [
  { m0: 1, w: [0.5, 0.85, 1, 1, 0.75, 0.45, 0.22] }, // Kelvin
  { m0: 1, w: [0.7, 1, 1, 0.75, 0.45] }, // equatorial Rossby n=1
  { m0: 3, w: [0.8, 1, 0.9, 0.65, 0.35] }, // mixed Rossby-gravity
  { m0: 5, w: [0.7, 1, 1, 0.7, 0.35] }, // westward easterly waves
];
const NF = FAMS.length;
const MODE_F = [], MODE_M = [], MODE_A = [];
for (let f = 0; f < NF; f++) {
  let s2 = 0;
  for (const w of FAMS[f].w) s2 += w * w * 0.5;
  const nrm = 1 / sqrt(s2);
  FAMS[f].w.forEach((w, j) => {
    MODE_F.push(f);
    MODE_M.push(FAMS[f].m0 + j);
    MODE_A.push(w * nrm);
  });
}
const NM = MODE_F.length;
const MMAX = 12;
const COS_T = new Float32Array((MMAX + 1) * W), SIN_T = new Float32Array((MMAX + 1) * W);
for (let m = 0; m <= MMAX; m++)
  for (let x = 0; x < W; x++) {
    COS_T[m * W + x] = cos((TWO_PI * m * x) / W);
    SIN_T[m * W + x] = sin((TWO_PI * m * x) / W);
  }
// where the warm pool is: the Madden-Julian blotch is strongest over the Indian Ocean and weak where the edges meet
const PMJO = new Float32Array(W);
for (let x = 0; x < W; x++) {
  let d = abs(x - 26);
  d = min(d, W - d);
  PMJO[x] = 0.22 + 0.78 * exp(-(d * d) / (2 * 13 * 13));
}

function hsv2rgb(h, s, v, out) {
  h = (((h % 1) + 1) % 1) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  out[0] = [v, q, p, p, t, v][i % 6];
  out[1] = [t, v, v, q, p, p][i % 6];
  out[2] = [p, p, t, v, v, q][i % 6];
}
function rgb2hsv(r, g, b, out) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  out[0] = h;
  out[1] = mx > 0 ? d / mx : 0;
  out[2] = mx;
}
// the colour map, base hue: dry deep teal to blue, zero a very dark neutral, wet coral to amber to white-gold
const STOPS = [
  [-1, 40, 70, 230],
  [-0.75, 0, 110, 190],
  [-0.5, 0, 140, 150],
  [-0.25, 0, 100, 110],
  [-0.1, 0, 58, 70],
  [0, 8, 8, 11],
  [0.1, 150, 30, 55],
  [0.22, 255, 85, 72],
  [0.4, 255, 150, 40],
  [0.62, 255, 205, 70],
  [0.85, 255, 236, 160],
  [1, 255, 250, 225],
];
const SOFT = 0.12; // how sharply the strongest wave wins where bands cross: the rounding of the maximum, squared
const TC = 16; // cells of convective texture round the circle, 4 LED each
const TCELL = 2; // days to a cell of it
const NL = 513;
const CN = 1024, CU0 = -3, CU1 = 4.5; // the transfer table: u from CU0 to CU1
const CK = (CN - 1) / (CU1 - CU0);
const TX0 = new Int32Array(W), TX1 = new Int32Array(W), TXF = new Float32Array(W);
for (let x = 0; x < W; x++) {
  const q = x / 4;
  TX0[x] = floor(q) % TC;
  TX1[x] = (floor(q) + 1) % TC;
  const f = q - floor(q);
  TXF[x] = f * f * (3 - 2 * f);
}
function buildLut(S, hue) {
  const tmp = [0, 0, 0], c = [0, 0, 0];
  for (let i = 0; i < NL; i++) {
    const x = (i / (NL - 1)) * 2 - 1;
    let k = 0;
    while (k < STOPS.length - 2 && x > STOPS[k + 1][0]) k++;
    const a = STOPS[k], b = STOPS[k + 1], t = cl((x - a[0]) / (b[0] - a[0]), 0, 1);
    const r = (a[1] + (b[1] - a[1]) * t) / 255, g = (a[2] + (b[2] - a[2]) * t) / 255, bl = (a[3] + (b[3] - a[3]) * t) / 255;
    rgb2hsv(r, g, bl, tmp);
    hsv2rgb(tmp[0] + hue, tmp[1], tmp[2], c);
    S.lut[i * 3] = c[0] * 255;
    S.lut[i * 3 + 1] = c[1] * 255;
    S.lut[i * 3 + 2] = c[2] * 255;
  }
  // and the transfer from the panel's wave response u to that map: wet sharp and skewed, dry soft
  for (let i = 0; i < CN; i++) {
    let u = (i / (CN - 1)) * (CU1 - CU0) + CU0;
    u += 0.12 * u * u;
    const v = u > 0 ? 0.92 * (1 - exp(-0.95 * u)) : -0.9 * (1 - exp(-0.72 * -u));
    const li = floor((cl(v, -1, 1) + 1) * 0.5 * (NL - 1) + 0.5) * 3;
    S.cm[i * 3] = S.lut[li];
    S.cm[i * 3 + 1] = S.lut[li + 1];
    S.cm[i * 3 + 2] = S.lut[li + 2];
  }
  S.lutHue = hue;
}

// a hash of three integers into [0, 1), and smooth value noise along one axis
function hsh(S, a, b, c) {
  let h = (Math.imul(a, 0x27d4eb2d) + Math.imul(b, 0x165667b1) + Math.imul(c, 0x9e3779b1) + S.seed) | 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vn(S, id, ch, u) {
  const i = floor(u), f = u - i, w = f * f * (3 - 2 * f);
  const a = hsh(S, id, ch, i);
  return a + (hsh(S, id, ch, i + 1) - a) * w;
}

export function setup(params) {
  const S = {
    ready: false,
    seed: floor(rnd() * 2147483647),
    tau: 0, // model days
    ks: [0, 2, 0, 0.06],
    lut: new Float32Array(NL * 3),
    cm: new Uint8Array(CN * 3),
    lutHue: -1,
    theta: new Float64Array(NM),
    omega: new Float64Array(NM),
    fade: new Float64Array(NM),
    ta: new Float64Array(NM),
    tp: new Float64Array(NM),
    cc: new Float64Array(NM),
    cs: new Float64Array(NM),
    lam: 0, // the Madden-Julian blotch's longitude at the pivot row
    vm: V_MJO,
    F: [new Float64Array(W), new Float64Array(W), new Float64Array(W), new Float64Array(W)],
    M: new Float64Array(W),
    E: new Float64Array(W),
    D: new Float64Array(W),
    tex: new Float32Array(64 * TC * 2),
    texTag: new Int32Array(64).fill(-999999),
    img: new Uint8Array(W * H * 3),
    sm: new Float32Array(W * H),
    ee: new Float32Array(W * H),
    tn: new Float32Array(W * H),
    hist: new Int32Array(96),
    th: null,
    hi: 1,
  };
  for (let i = 0; i < NM; i++) {
    S.theta[i] = rnd() * TWO_PI;
    S.ta[i] = 9 + 10 * rnd();
    S.tp[i] = 12 + 10 * rnd();
  }
  S.tau = 400 + rnd() * 100;
  S.lam = rnd() * TWO_PI;
  params.s = S;
  return S;
}

function modes(S, s) {
  const c = C0 * s;
  for (let i = 0; i < NM; i++) {
    const m = MODE_M[i], k = m / EARTH;
    let w = 0;
    switch (MODE_F[i]) {
      case 0:
        w = c * k;
        break;
      case 1:
        w = (-BETA * k) / (k * k + (3 * BETA) / c);
        break;
      case 2:
        w = ((c * k) / 2) * (1 - sqrt(1 + (4 * BETA) / (c * k * k)));
        break;
      default:
        w = -0.55 * c * k;
    }
    w *= DAY;
    S.omega[i] = w;
    S.fade[i] = 1 - ss(0.85, 1.5, abs(w) * RHO);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  const first = !S.ready;
  if (first) {
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    S.ready = true;
  }
  const e = 1 - exp(-d / 0.2);
  for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * e;
  const s = exp(0.5 * cl(S.ks[2], -1, 1));
  modes(S, s);
  const dtau = d * S.ks[1];
  S.tau += dtau;
  for (let i = 0; i < NM; i++) S.theta[i] = (S.theta[i] + S.omega[i] * dtau) % TWO_PI;
  S.vm = V_MJO * sqrt(s);
  S.lam = (S.lam + S.vm * dtau) % TWO_PI;
  if (abs(S.lutHue - S.ks[0]) > 0.002) buildLut(S, S.ks[0]);
  if (first) render(S, d);
  render(S, d);
}

function texRow(S, it) {
  const r = ((it % 64) + 64) % 64;
  if (S.texTag[r] !== it) {
    S.texTag[r] = it;
    for (let c = 0; c < TC; c++) {
      S.tex[(r * TC + c) * 2] = hsh(S, 300, it, c);
      S.tex[(r * TC + c) * 2 + 1] = hsh(S, 301, it, c);
    }
  }
  return r * TC * 2;
}

function render(S, dtr) {
  const hist = S.hist.fill(0);
  const gam = cl(0.5 + 0.5 * S.ks[3], 0, 1);
  const GF = [1, 0.9, 0.8, 0.6];
  const img = S.img, cm = S.cm;
  const F = S.F, M = S.M, E = S.E, D = S.D;
  const wf = [0, 0, 0, 0], AF = [0, 0, 0, 0], wph = [0, 0, 0, 0], wk = [0, 0, 0, 0], WC = [0, 0, 0, 0], WS = [0, 0, 0, 0];
  for (let y = 0; y < H; y++) {
    const a = (H - 1 - y) * RHO, tau = S.tau - a, da = a - AREF;
    // family weights drift on their own slow noise, so which bands are on changes
    for (let f = 0; f < NF; f++) {
      const n = vn(S, 100 + f, 0, tau / 24);
      wf[f] = 0.4 + 1.2 * n * n;
      wph[f] = TWO_PI * (0.6 * vn(S, 120 + f, 0, tau / 41) + 0.4 * vn(S, 130 + f, 0, tau / 83)) + f * 1.6;
      wk[f] = 1 + 2 * vn(S, 140 + f, 0, tau / 55);
      WC[f] = cos(wph[f]);
      WS[f] = sin(wph[f]);
    }
    // the modes
    for (let f = 0; f < NF; f++) F[f].fill(0);
    for (let i = 0; i < NM; i++) {
      const nA = vn(S, i, 0, tau / S.ta[i]);
      const amp = 2.2 * nA * nA * MODE_A[i] * S.fade[i];
      const ph = S.theta[i] - S.omega[i] * da + 1.5 * (vn(S, i, 1, tau / S.tp[i]) - 0.5);
      const cc = amp * cos(ph), cs = amp * sin(ph), m = MODE_M[i] * W, Fi = F[MODE_F[i]];
      for (let x = 0; x < W; x++) Fi[x] += cc * COS_T[m + x] + cs * SIN_T[m + x];
    }
    // the Madden-Julian blotch
    const lamc = S.lam - S.vm * da + 1.8 * (vn(S, 200, 0, tau / 40) - 0.5);
    const amj = 0.15 + 1.3 * vn(S, 201, 0, tau / 20);
    const b2 = 0.4 + 0.45 * vn(S, 202, 0, tau / 19), b3 = 0.15 + 0.3 * vn(S, 203, 0, tau / 15);
    const bs = 1 + b2 + b3;
    for (let x = 0; x < W; x++) {
      const u = (TWO_PI * x) / W - lamc;
      M[x] = (cos(u) + b2 * cos(2 * u) + b3 * cos(3 * u)) / bs;
      const mv = M[x];
      E[x] = PMJO[x] * amj * (mv > 0 ? mv : 0.45 * mv);
    }
    // the winds the blotch and a couple of long waves put on the bands bend them
    const d1 = 3 * (vn(S, 210, 0, tau / 33) - 0.5), p1 = S.lam - S.vm * da + 3 * vn(S, 211, 0, tau / 50);
    const d2 = 2.2 * (vn(S, 212, 0, tau / 26) - 0.5), p2 = 1.7 * S.lam - 1.7 * S.vm * da + 2 * vn(S, 213, 0, tau / 44);
    for (let x = 0; x < W; x++) {
      const l = (TWO_PI * x) / W;
      D[x] = d1 * 2 * cos(l - p1) + d2 * 2 * cos(2 * l - p2) + 2.4 * E[x];
    }
    const tt = tau / TCELL, ti = floor(tt), tf = tt - ti, tw = tf * tf * (3 - 2 * tf);
    const r0 = texRow(S, ti), r1 = texRow(S, ti + 1), T = S.tex;
    for (let x = 0; x < W; x++) {
      const c0 = TX0[x] * 2, c1 = TX1[x] * 2, fx = TXF[x];
      const t00 = T[r0 + c0], t01 = T[r0 + c1], t10 = T[r1 + c0], t11 = T[r1 + c1];
      const tA = t00 + (t01 - t00) * fx, tB = t10 + (t11 - t10) * fx, tn = tA + (tB - tA) * tw - 0.5;
      const w00 = T[r0 + c0 + 1], w01 = T[r0 + c1 + 1], w10 = T[r1 + c0 + 1], w11 = T[r1 + c1 + 1];
      const wA = w00 + (w01 - w00) * fx, wB = w10 + (w11 - w10) * fx, wn = wA + (wB - wA) * tw - 0.5;
      const gate = 0.2 + 1.8 * ss(0.08, 0.65, E[x]);
      let mx = -9;
      const cx = COS_T[W + x], sx = SIN_T[W + x];
      let p = x + D[x] + 0.8 * wn;
      p -= W * floor(p / W);
      const i0 = floor(p), fr = p - i0, i1 = (i0 + 1) % W;
      for (let f = 0; f < NF; f++) {
        const Ff = F[f];
        const v = Ff[i0] + (Ff[i1] - Ff[i0]) * fr;
        const t = 0.5 + 0.5 * (cx * WC[f] + sx * WS[f]), t2 = t * t, win = 0.18 + 1.3 * (wk[f] < 2 ? t + (t2 - t) * (wk[f] - 1) : t2 + (t2 * t - t2) * (wk[f] - 2));
        const A = wf[f] * win * (1 + gam * GF[f] * (gate - 1)) * v;
        // the strongest wave wins where bands cross: a smooth maximum, pair by pair
        if (f === 0) mx = A;
        else mx = 0.5 * (mx + A + sqrt((mx - A) * (mx - A) + SOFT));
      }
      const sm = mx;
      const q = y * W + x;
      S.sm[q] = sm;
      S.ee[q] = E[x];
      S.tn[q] = tn;
      hist[cl(floor((sm + 2.5) * 12), 0, 95)]++;
    }
  }
  // the quantiles of the panel's own convective response set the zero and the scale, slowly, so the
  // picture keeps about the same share of wet and dry whatever the waves and the knobs are doing
  let c = 0, q62 = 0, q93 = 0;
  for (let b = 0; b < 96; b++) {
    c += hist[b];
    if (c < 0.62 * W * H) q62 = (b + 1) / 12 - 2.5;
    if (c < 0.93 * W * H) q93 = (b + 1) / 12 - 2.5;
  }
  if (S.th === null) {
    S.th = q62;
    S.hi = q93;
  } else {
    const e = 1 - exp(-dtr / 8);
    S.th += (q62 - S.th) * e;
    S.hi += (q93 - S.hi) * e;
  }
  const th = S.th, sc = 1 / max(0.5, S.hi - S.th);
  const ek = 0.45 + 0.5 * gam;
  for (let q = 0; q < W * H; q++) {
    let u = (S.sm[q] - th) * sc * (1 + 0.5 * S.tn[q]) + ek * S.ee[q];
    const li = floor(cl((u - CU0) * CK, 0, CN - 1)) * 3, o = q * 3;
    img[o] = cm[li];
    img[o + 1] = cm[li + 1];
    img[o + 2] = cm[li + 2];
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const img = S.img;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, img[o], img[o + 1], img[o + 2]);
    }
}
