// ===== Patternflow pattern =====
// Title:   Critical Depth
// Family:  sverdrup
// Idea:    DRAFT
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: DRAFT
// Round:   276
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Light=0..4, Storms=-1..1, Nutrient=-1..1
//
// Knob 1: Hue. DRAFT
// Knob 2: Light. DRAFT
// Knob 3: Storms. DRAFT
// Knob 4: Nutrient. DRAFT

const W = 64, H = 128, NC = 72;
const { floor, sqrt, exp, log, sin, cos, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ---- the water column: 128 cells of 2 m, units are metres, days and mmol N per m3
const NZ = H, DZ = 1.6;
const KW = 0.045;       // light lost to the water itself, per metre
const KP = 0.025;       // light lost to the plankton, m2 per mmol N (self-shading)
const MU = 2.0;         // top growth rate, per day
const KI = 22;          // light at half that rate, W per m2
const KN = 0.5;         // nutrient at half that rate
const M0 = 0.44;        // loss (respiration, grazing, death), per day
const FREC = 0.6;       // share of the loss that goes back to nutrient
const WSINK = 0.4;      // sinking, m per day
const TMIX = 3.5;       // days a mixed layer takes to stir over its own depth: kappa = h^2 / TMIX
const KAP_BG = 1;       // and below it
const DT = 0.25, SUB = 6;   // one substep a quarter day, one column six of them
const COL_DAYS = DT * SUB;
const COL_SEC = 4;      // panel seconds per column
const PREF = 2.5;       // plankton that reads as full glow, mmol N per m3 (log scale from 0.2)

function gauss() {
  const u = Math.random() + 1e-12, v = Math.random();
  return sqrt(-2 * log(u)) * cos(TAU * v);
}

export function setup(params) {
  const ph = [];
  for (let i = 0; i < 12; i++) ph.push(TAU * Math.random());
  params.s = {
    ph,
    P: new Float64Array(NZ), N: new Float64Array(NZ),
    t: 0, ox: 0, oc: 0, og: 0, storm: 0, tauS: 6, h: 25,
    I0: 40, dcr: 300,
    src: 0, exp: 0,
    v: new Float32Array(NC * H), w: new Float32Array(NC * H), gn: new Float32Array(NC * H),
    hr: new Float32Array(NC), dr: new Float32Array(NC),
    n: 0, f: 0, k: null, ready: false,
    hue: 0, hueAt: -9, wl: new Uint8Array(256 * 3), bl: new Uint8Array(256 * 3),
    A: new Float64Array(NZ), B: new Float64Array(NZ), C: new Float64Array(NZ), D: new Float64Array(NZ),
    CP: new Float64Array(NZ), DP: new Float64Array(NZ), kap: new Float64Array(NZ + 1), nud: new Float64Array(NZ),
    IL: new Float64Array(NZ),
  };
}

// knobs -> model quantities
const lightOf = (k) => 30 * pow(3.4, cl(k, 0, 4) / 4);
const stormOf = (k) => cl(k, -1, 1);
const deepOf = (k) => 7 * pow(2, cl(k, -1, 1));

// ---- the weather: a mixed layer depth h(t) and a surface light I0(t), both random
function weather(S, k, dt) {
  const t = S.t, ph = S.ph;
  const st = stormOf(k[2]);
  // calm depth: an Ornstein-Uhlenbeck walk in log depth plus slow drifts that never share a period
  S.ox += (-S.ox / 10) * dt + sqrt((2 * dt) / 10) * gauss();
  const hb = cl(26 * exp(0.42 * S.ox + 0.26 * sin((TAU * t) / 71.3 + ph[0]) + 0.18 * sin((TAU * t) / 137.9 + ph[1])), 8, 110);
  // storms: a Poisson arrival, a kick in depth with an exponential tail, a decay time of its own
  const lam = (1 / 20) * pow(2, 0.8 * st);
  if (Math.random() < lam * dt) {
    const kick = (35 + 70 * -log(Math.random() + 1e-9)) * pow(2, 0.45 * st);
    S.storm = min(190, S.storm + kick);
    S.tauS = 2 + 4 * Math.random();
  }
  S.storm *= exp(-dt / S.tauS);
  S.og += (-S.og / 8) * dt + sqrt((2 * dt) / 8) * gauss();
  const target = cl((hb + S.storm) * exp(0.07 * S.og), 6, 200);
  const tau = target > S.h ? 0.6 : 2.2;
  S.h += (target - S.h) * (1 - exp(-dt / tau));
  // cloud: a slow OU, and two slow swings of the sun
  S.oc += (-S.oc / 5) * dt + sqrt((2 * dt) / 5) * gauss();
  const sun = 1 + 0.28 * sin((TAU * t) / 83.7 + ph[2]) + 0.17 * sin((TAU * t) / 197.3 + ph[3]) + 0.12 * sin((TAU * t) / 41.9 + ph[4]);
  S.I0 = lightOf(k[1]) * sun * cl(1 - 0.25 * S.oc, 0.45, 1.3);
}

// tridiagonal solve, A below, B on, C above the diagonal, in place into D
function thomas(S) {
  const A = S.A, B = S.B, C = S.C, D = S.D, CP = S.CP, DP = S.DP;
  CP[0] = C[0] / B[0];
  DP[0] = D[0] / B[0];
  for (let i = 1; i < NZ; i++) {
    const m = 1 / (B[i] - A[i] * CP[i - 1]);
    CP[i] = C[i] * m;
    DP[i] = (D[i] - A[i] * DP[i - 1]) * m;
  }
  D[NZ - 1] = DP[NZ - 1];
  for (let i = NZ - 2; i >= 0; i--) D[i] = DP[i] - CP[i] * D[i + 1];
}

function substep(S, k, dt) {
  weather(S, k, dt);
  const P = S.P, N = S.N, h = S.h, I0 = S.I0, nd = deepOf(k[3]);
  // light and growth
  let cum = 0;
  for (let i = 0; i < NZ; i++) {
    const z = (i + 0.5) * DZ;
    const I = I0 * exp(-(KW * z + KP * (cum + 0.5 * P[i] * DZ)));
    cum += P[i] * DZ;
    S.IL[i] = I;
    const g = (MU * I) / (I + KI) * (N[i] / (N[i] + KN));
    let dP = P[i] * (exp(g * dt) - 1);
    if (dP > N[i]) dP = N[i];
    P[i] += dP;
    N[i] -= dP;
    const lost = P[i] * (1 - exp(-M0 * dt));
    P[i] -= lost;
    N[i] += FREC * lost;
    S.exp += (1 - FREC) * lost * DZ;
    if (I > 0.3) {
      P[i] += 3e-3 * dt;
      S.src += 3e-3 * dt * DZ;
    }
  }
  // diffusion: a smooth step from fast above h to slow below it
  const kap = S.kap, kml = max(150, (h * h) / TMIX);
  kap[0] = 0;
  kap[NZ] = 0;
  for (let i = 1; i < NZ; i++) {
    const s = 1 / (1 + exp(-(i * DZ - h) / 1.5));
    kap[i] = kml * (1 - s) + KAP_BG * s;
  }
  const A = S.A, B = S.B, C = S.C, D = S.D, nud = S.nud;
  const wd = (WSINK * dt) / DZ;
  for (let i = 0; i < NZ; i++) {
    const lo = (kap[i] * dt) / (DZ * DZ), hi = (kap[i + 1] * dt) / (DZ * DZ);
    A[i] = -(lo + (i > 0 ? wd : 0));
    C[i] = -hi;
    B[i] = 1 + lo + hi + (i < NZ - 1 ? wd : 0);
    D[i] = P[i];
  }
  thomas(S);
  for (let i = 0; i < NZ; i++) P[i] = D[i];
  // nutrient: the same mixing, no sinking, and a slow pull towards the deep value below 90 m
  for (let i = 0; i < NZ; i++) {
    const lo = (kap[i] * dt) / (DZ * DZ), hi = (kap[i + 1] * dt) / (DZ * DZ);
    const z = (i + 0.5) * DZ, r = 0.06 * sm(60, 120, z) * dt;
    A[i] = -lo;
    C[i] = -hi;
    B[i] = 1 + lo + hi + r;
    D[i] = N[i] + r * nd;
    S.src += r * (nd - N[i]) * DZ;
  }
  thomas(S);
  for (let i = 0; i < NZ; i++) N[i] = D[i];
  S.t += dt;
}

// the critical depth: where the growth the light allows, summed down from the surface, falls back to the loss
function critical(S) {
  const P = S.P;
  let cum = 0, G = 0, pos = false;
  const I0 = S.I0;
  for (let i = 0; i < NZ; i++) {
    const I = I0 * exp(-(KW * (i + 0.5) * DZ + KP * (cum + 0.5 * P[i] * DZ)));
    cum += P[i] * DZ;
    const g = (MU * I) / (I + KI) - M0;
    const G2 = G + g * DZ;
    if (G2 > 0) pos = true;
    if (pos && G2 <= 0) return i * DZ + (DZ * G) / (G - G2);
    G = G2;
  }
  return pos ? 999 : 0;
}

function record(S) {
  const P = S.P, n = S.n, o = (n % NC) * H;
  let cum = 0;
  for (let i = 0; i < NZ; i++) {
    const I = S.I0 * exp(-(KW * (i + 0.5) * DZ + KP * (cum + 0.5 * P[i] * DZ)));
    cum += P[i] * DZ;
    S.w[o + i] = min(1, pow(I / S.I0, 0.19) * pow(S.I0 / 160, 0.3));
    S.gn[o + i] = 0.12 + 0.88 * pow(I / S.I0, 0.55);
    S.v[o + i] = cl(log(P[i] / 0.2) / log(PREF / 0.2), 0, 1);
  }
  S.hr[n % NC] = S.h / DZ;
  S.dr[n % NC] = critical(S) / DZ;
}

function column(S, k) {
  for (let j = 0; j < SUB; j++) substep(S, k, DT);
  S.n++;
  record(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
  } else {
    const al = 1 - exp(-d / 0.3);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  if (!S.ready) {
    S.ready = true;
    const nd = deepOf(S.k[3]);
    for (let i = 0; i < NZ; i++) {
      S.P[i] = 0.02;
      S.N[i] = nd * (0.5 + 0.5 * sm(0, 120, (i + 0.5) * DZ));
    }
    S.h = 40;
    for (let j = 0; j < 400; j++) substep(S, S.k, DT);
    for (let c = 0; c < NC; c++) column(S, S.k);
    S.f = 0;
  }
  S.f += d / COL_SEC;
  let guard = 0;
  while (S.f >= 1 && guard++ < 6) {
    S.f -= 1;
    column(S, S.k);
  }
  if (S.f >= 1) S.f = 0.999;
}

// ---- colour
function hsv(h, s, v, o, j) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[j] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[j + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[j + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}
function buildLut(S, hue) {
  for (let e = 0; e < 256; e++) {
    const t = e / 255;
    hsv(0.63 - 0.11 * t + hue, 0.85, 0.78 * pow(t, 0.9), S.wl, e * 3);
    hsv(0.27 - 0.14 * t + hue, 0.88 - 0.14 * t * t, 0.4 + 0.5 * pow(t, 0.85), S.bl, e * 3);
  }
  S.hueAt = hue;
}

const LC = [0, 0, 0], DC = [0, 0, 0];
const hAt = (S, p) => {
  const i = floor(p), f = p - i, a = ((i % NC) + NC) % NC, b = (a + 1) % NC;
  return [S.hr[a] * (1 - f) + S.hr[b] * f, S.dr[a] * (1 - f) + S.dr[b] * f];
};

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  S.hue += (S.k[0] - S.hue) * 0.5;
  if (abs(S.hue - S.hueAt) > 0.002) buildLut(S, S.hue);
  hsv(0.5 + S.hue, 0.1, 1, LC, 0);
  hsv(0.83 + S.hue, 0.45, 0.62, DC, 0);
  const wl = S.wl, bl = S.bl, f = S.f, g = 1 - f;
  for (let x = 0; x < W; x++) {
    const k0 = S.n - 1 - (W - 1 - x);
    const i0 = ((k0 % NC) + NC) % NC, i1 = (i0 + 1) % NC;
    const b0 = i0 * H, b1 = i1 * H;
    // the line over this pixel column: the span of h from its left edge to its right edge
    const a = k0 + f - 0.6, m = Math.ceil(a);
    const ha = hAt(S, a), hm = hAt(S, m), hn = hAt(S, m + 1), hb = hAt(S, a + 1.2);
    const lo = min(ha[0], hm[0], hn[0], hb[0]), hi = max(ha[0], hm[0], hn[0], hb[0]);
    const dlo = min(ha[1], hm[1], hn[1], hb[1]), dhi = max(ha[1], hm[1], hn[1], hb[1]);
    for (let y = 0; y < H; y++) {
      const wv = S.w[b0 + y] * g + S.w[b1 + y] * f, vv = S.v[b0 + y] * g + S.v[b1 + y] * f;
      const wi = (wv * 255) | 0, vi = (vv * 255) | 0;
      const gain = S.gn[b0 + y] * g + S.gn[b1 + y] * f;
      let r = wl[wi * 3], gg = wl[wi * 3 + 1], b = wl[wi * 3 + 2];
      const al = sm(0, 0.22, vv) * gain;
      r += (bl[vi * 3] - r) * al;
      gg += (bl[vi * 3 + 1] - gg) * al;
      b += (bl[vi * 3 + 2] - b) * al;
      const yc = y + 0.5;
      // critical depth, faint
      let d = max(0, dlo - yc, yc - dhi);
      if (d < 1.9) {
        const al = 0.45 * (d < 1 ? 1 : (1.9 - d) / 0.9);
        r += (DC[0] - r) * al; gg += (DC[1] - gg) * al; b += (DC[2] - b) * al;
      }
      // mixed layer depth, crisp
      d = max(0, lo - yc, yc - hi);
      if (d < 1.9) {
        const al = d < 1 ? 0.95 : 0.4 * ((1.9 - d) / 0.9);
        r += (LC[0] * 0.92 - r) * al;
        gg += (LC[1] * 0.92 - gg) * al;
        b += (LC[2] * 0.92 - b) * al;
      }
      display.setPixel(x, y, r | 0, gg | 0, b | 0);
    }
  }
}
