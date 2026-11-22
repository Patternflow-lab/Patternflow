// ===== Patternflow pattern =====
// Title:   Serrated Yield
// Family:  strainband
// Idea:    PROTO
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: PROTO; pattern round 215
// Round:   217
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pull=0.5..4, Type=-1..1, Tilt=-20..20
//
// Knob 1: PROTO
// Knob 2: PROTO
// Knob 3: PROTO
// Knob 4: PROTO

const W = 64, H = 128;
const { floor, ceil, sqrt, abs, exp, log, sin, cos, tanh, PI, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (t) => ((t = cl(t, 0, 1)), t * t * (3 - 2 * t));

// ---- the specimen along the band normal s = y + c (x - 31.5), c = cot(angle)
const MG = 14;            // rows of specimen beyond the panel at the top and the bottom
const CMAX = 1.45;
const DS = 0.5;           // LEDs per cell of s
const S_LO = -MG - 32 * CMAX - 2;
const NS = ceil((H + MG + 32 * CMAX + 2 - S_LO) / DS);
const XSP = 5;            // cells between the nodes of the drifting noise
const NX = ceil(NS / XSP);
const TAU_XI = 40;        // model seconds
const VPAR = 43;          // LEDs of band length laid down per model second when a band is born
const G_TOP = log(1 + 80 / 0.5);   // a rate of 80 reaches the top of the colour scale
const BG0 = 0.0;       // the history of strain runs from BG0 to BG0 + BG1 on the colour scale
const BG1 = 0.12;
const KT = 1.0;         // heat laid down by a band: a band at the top rate for one model second
const TAU_T = 12;      // model seconds for the heat to fade
const D_T = 4;         // LEDs squared per model second
const GLOW = 0.3;      // how much of the heat shows on the colour scale
const T_PRE = 40;         // model seconds run before the first frame

// ---- model constants
const P_AGE = 14;      // aging stress, in units of the rate sensitivity
const U_MAX = 60;      // peak strain rate of a band, in units of the pull rate
const UC = 1.0;        // rate at which flow strips half the pinning
const TAU_U = 0.15;    // model seconds
const HARD = 0.04;
const TSCALE = 3;      // model seconds per second at Pull 2

const TYPES = {
  dp: [0.3, 0.04, 0.005],
  eta: [0.3, 0.8, 1.5],
  tauA: [4, 4, 4],
  M: [1.7, 1.7, 1.7],
  endE: [3.0, 1.5, 0.0],
  xi: [0.3, 0.8, 1.2],
};
const typeAt = (arr, k3) => (k3 < 0 ? lerp(arr[1], arr[0], -k3) : lerp(arr[1], arr[2], k3));

function makeState() {
  const S = {
    u: new Float32Array(NS), a: new Float32Array(NS), e: new Float32Array(NS), eta: new Float32Array(NS),
    ell: new Float32Array(NS), tmp: new Float32Array(NS), xi: new Float32Array(NX + 2), xf: new Float32Array(NS),
    act: new Uint8Array(NS), tb: new Float32Array(NS), xn: new Float32Array(NS), ud: new Float32Array(NS + 2),
    hl: new Float32Array(NS), tbe: new Float32Array(NS), xne: new Float32Array(NS), T: new Float32Array(NS), T2: new Float32Array(NS),
    lut: new Float32Array(256 * 3), lutHue: -1,
    sig: 4, t: 0, kn: [0, 2, 0, 0.06], c: -1, sinth: 0.82, sumU: 0, wsum: 1, smin: 0, smax: 0, ready: false, sd: 0,
  };
  for (let i = 0; i < NS; i++) { S.u[i] = 0.01; S.a[i] = 1; S.tb[i] = -1e3; }
  const raw = new Float32Array(NS);
  for (let i = 0; i < NS; i++) raw[i] = Math.random() * 2 - 1;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < NS; i++) { let s = 0, n = 0; for (let d = -3; d <= 3; d++) { const j = i + d; if (j >= 0 && j < NS) { s += raw[j]; n++; } } S.tmp[i] = s / n; }
    raw.set(S.tmp);
  }
  let m2 = 0;
  for (let i = 0; i < NS; i++) m2 += raw[i] * raw[i];
  const sd = sqrt(m2 / NS);
  for (let i = 0; i < NS; i++) S.eta[i] = raw[i] / sd;
  return S;
}

// the length of each line of constant s inside the specimen, which is the weight of that line in the mean rate
function setLines(S, cc) {
  if (S.c === cc) return;
  S.c = cc;
  const y0 = -MG, y1 = H - 1 + MG;
  let w = 0, lo = -1, hi = -1;
  for (let i = 0; i < NS; i++) {
    const s = S_LO + (i + 0.5) * DS;
    let n = 0;
    for (let x = 0; x < W; x++) { const y = s - cc * (x - 31.5); if (y >= y0 && y <= y1) n++; }
    S.ell[i] = n;
    w += n;
    if (n > 0) { if (lo < 0) lo = i; hi = i; }
  }
  S.wsum = w;
  S.smin = lo; S.smax = hi;
}

// where on its line a band is born: mostly at a side edge of the specimen, sometimes inside it
function bornAt(S, i) {
  const s = S_LO + (i + 0.5) * DS;
  const xa = cl(31.5 + (s - (H - 1 + MG)) / S.c, 0, W - 1), xb = cl(31.5 + (s + MG) / S.c, 0, W - 1);
  const r = Math.random();
  return r < 0.4 ? xa : r < 0.8 ? xb : xa + (xb - xa) * Math.random();
}

function step(S, dm, par) {
  const { u, a, e, eta, ell, act } = S;
  const dp = par.dp / (DS * DS), decU = exp(-dm / TAU_U), ia = 1 / par.tauA, iu = 1 / (UC * par.tauA);
  const lo = S.smin, hi = S.smax;
  const xi = S.xi, xf = S.xf, kx = sqrt((2 * dm) / TAU_XI), dx = dm / TAU_XI;
  for (let j = 0; j < xi.length; j++) xi[j] += -xi[j] * dx + kx * (Math.random() + Math.random() + Math.random() - 1.5) * 2;
  for (let i = 0; i < NS; i++) { const f = i / XSP, j = floor(f), t = f - j; xf[i] = xi[j] * (1 - t) + xi[j + 1] * t; }
  const T = S.T, T2 = S.T2, dT = D_T / (DS * DS), fT = exp(-dm / TAU_T);
  let sumU = 0, sumE = 0;
  const sig = S.sig;
  const sTop = S_LO + (lo + 0.5) * DS, sBot = S_LO + (hi + 0.5) * DS;
  for (let i = lo; i <= hi; i++) {
    const ui = u[i], ul = i > lo ? u[i - 1] : ui, ur = i < hi ? u[i + 1] : ui;
    let v = ui + dm * dp * (ul + ur - 2 * ui);
    if (v < 0) v = 0;
    const s = S_LO + (i + 0.5) * DS;
    const bump = par.endT * exp(-(s - sTop) / 6) + par.endB * exp(-(sBot - s) / 6);
    const z = sig - HARD * e[i] - P_AGE * a[i] - par.eta * eta[i] - par.xi * xf[i] + bump;
    const tgt = U_MAX / (1 + exp(-z));
    const un = tgt + (v - tgt) * decU;
    const k = ia + un * iu, ass = ia / k;
    a[i] = ass + (a[i] - ass) * exp(-k * dm);
    e[i] += dm * un;
    u[i] = un;
    sumU += un * ell[i];
    sumE += e[i] * ell[i];
    // the band heats the metal, and the heat spreads and fades
    const tl = i > lo ? T[i - 1] : T[i], tr = i < hi ? T[i + 1] : T[i];
    T2[i] = (T[i] + dm * (KT * un / U_MAX + dT * (tl + tr - 2 * T[i]))) * fT;
  }
  for (let i = lo; i <= hi; i++) T[i] = T2[i];
  const mE = sumE / S.wsum;
  for (let i = lo; i <= hi; i++) e[i] -= mE;
  S.sumU = sumU / S.wsum;
  S.sig += dm * par.M * (1 - S.sumU);
  // a line that starts to flow takes its birth from a flowing neighbour, or is born where it stands
  for (let i = lo; i <= hi; i++) {
    if (!act[i]) {
      if (u[i] > 0.8) {
        let src = -1;
        for (let d = 1; d <= 6 && src < 0; d++) {
          if (i - d >= lo && act[i - d]) src = i - d;
          else if (i + d <= hi && act[i + d]) src = i + d;
        }
        if (src >= 0) { S.tb[i] = S.tb[src]; S.xn[i] = S.xn[src]; }
        else { S.tb[i] = S.t; S.xn[i] = bornAt(S, i); }
        act[i] = 1;
      }
    } else if (u[i] < 0.3) act[i] = 0;
  }
}

function paramsFor(k3, tilt) {
  const th = ((55 + tilt) * PI) / 180;
  return {
    dp: typeAt(TYPES.dp, k3), eta: typeAt(TYPES.eta, k3), tauA: typeAt(TYPES.tauA, k3), M: typeAt(TYPES.M, k3),
    xi: typeAt(TYPES.xi, k3), endT: typeAt(TYPES.endE, k3), endB: 0.4 * typeAt(TYPES.endE, k3),
    cc: cos(th) / sin(th), sinth: sin(th),
  };
}

export function setup(params) {
  params.s = makeState();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06];
  S.kn = kn;
  const k2 = cl(kn[1], 0.5, 4), k3 = cl(kn[2], -1, 1), tilt = cl(kn[3], -20, 20);
  const par = paramsFor(k3, tilt);
  setLines(S, par.cc);
  S.sinth = par.sinth;
  if (!S.ready) {
    S.ready = true;
    const n = ceil(T_PRE / 0.03);
    for (let k = 0; k < n; k++) { step(S, T_PRE / n, par); S.t += T_PRE / n; }
  }
  const dtm = cl(dt || 0, 0, 0.1) * (k2 / 2) * TSCALE;
  const n = max(1, ceil(dtm / 0.012));
  for (let k = 0; k < n; k++) { step(S, dtm / n, par); S.t += dtm / n; }
}

const INF = [[0.001, 0.000, 0.014], [0.087, 0.045, 0.225], [0.258, 0.039, 0.406], [0.416, 0.090, 0.433], [0.578, 0.148, 0.404], [0.736, 0.216, 0.330], [0.865, 0.317, 0.226], [0.955, 0.469, 0.100], [0.988, 0.645, 0.040], [0.964, 0.844, 0.273], [0.988, 0.998, 0.645]];
function buildLut(S, hue) {
  const LUT = S.lut;
  S.lutHue = hue;
  for (let i = 0; i < 256; i++) {
    const f = (i / 255) * 10, j = min(9, floor(f)), t = f - j;
    const r = lerp(INF[j][0], INF[j + 1][0], t), g = lerp(INF[j][1], INF[j + 1][1], t), b = lerp(INF[j][2], INF[j + 1][2], t);
    // rotate the hue
    const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
    let h = 0;
    if (d > 1e-6) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h / 6 + hue) % 1;
    const sat = mx > 1e-6 ? d / mx : 0, hh = h * 6, k = floor(hh) % 6, ff = hh - floor(hh);
    const p = mx * (1 - sat), q = mx * (1 - ff * sat), tt = mx * (1 - (1 - ff) * sat);
    const o = i * 3;
    LUT[o] = k === 0 || k === 5 ? mx : k === 1 ? q : k === 4 ? tt : p;
    LUT[o + 1] = k === 1 || k === 2 ? mx : k === 0 ? tt : k === 3 ? q : p;
    LUT[o + 2] = k === 3 || k === 4 ? mx : k === 2 ? tt : k === 5 ? q : p;
  }
}

// a box blur of half width r along s, edges held
function boxBlur(src, dst, r) {
  const n = 2 * r + 1, last = NS - 1;
  let acc = 0;
  for (let k = -r; k <= r; k++) acc += src[min(last, max(0, k))];
  for (let i = 0; i < NS; i++) {
    dst[i] = acc / n;
    acc += src[min(last, i + r + 1)] - src[max(0, i - r)];
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { u, e, ell, tmp, ud, tb, xn, lut, hl, tbe, xne, act } = S, cc = S.c, sinth = S.sinth, tnow = S.t;
  const hue = cl(S.kn[0], 0, 1);
  if (abs(hue - S.lutHue) > 0.002) buildLut(S, hue);
  // the rate smoothed along s so that a band is wider than 2.5 LEDs on the panel, and a wide halo round it
  boxBlur(u, tmp, 2); boxBlur(tmp, ud, 2); boxBlur(ud, tmp, 2);
  for (let i = 0; i < NS; i++) ud[i] = tmp[i];
  for (let i = 0; i < NS; i++) tmp[i] = u[i] / U_MAX;
  boxBlur(tmp, hl, 9); boxBlur(hl, tmp, 9); boxBlur(tmp, hl, 9);
  const T = S.T;
  // the birth of each line, taken from the flowing lines beside it
  for (let i = 0; i < NS; i++) {
    let best = -1e9, bj = i;
    for (let d = -6; d <= 6; d++) {
      const j = i + d;
      if (j >= 0 && j < NS && act[j] && tb[j] > best) { best = tb[j]; bj = j; }
    }
    tbe[i] = best > -1e9 ? tb[bj] : tb[i];
    xne[i] = best > -1e9 ? xn[bj] : xn[i];
  }
  // the spread of the accumulated strain, which sets the scale of the history
  let m2 = 0;
  for (let i = S.smin; i <= S.smax; i++) m2 += e[i] * e[i] * ell[i];
  const sd = sqrt(m2 / S.wsum) + 1e-3;
  S.sd = S.sd ? S.sd + 0.05 * (sd - S.sd) : sd;
  const inv = 1 / (1.6 * S.sd);
  const load = cl((S.sig - 1) / 6, 0, 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const s = y + cc * (x - 31.5);
      const f = (s - S_LO) / DS - 0.5, i0 = floor(f), fr = f - i0;
      let v = ud[i0] * (1 - fr) + ud[i0 + 1] * fr;
      let hv = hl[i0] * (1 - fr) + hl[i0 + 1] * fr;
      const tv = T[i0] * (1 - fr) + T[i0 + 1] * fr;
      const ev = (e[i0] * (1 - fr) + e[i0 + 1] * fr) * inv;
      // a band is laid down along its line from where it was born
      const ic = fr < 0.5 ? i0 : i0 + 1;
      const reach = VPAR * (tnow - tbe[ic]), dist = abs(x - xne[ic]) / sinth;
      if (reach < dist + 6) {
        const q = (reach - dist) / 5;
        const m = sm(q);
        v *= m; hv *= m;
        if (q > 0 && q < 1) v *= 1 + 0.6 * sin(PI * q);
      }
      const mod = 0.84 + 0.16 * sin(x * 0.19 + s * 0.13 + 1.1) * sin(x * 0.11 - s * 0.17 + 2.3);
      v *= mod;
      const g = cl(log(1 + v / 0.5) / G_TOP + 0.3 * hv + GLOW * tv, 0, 1);
      const bg = BG0 + BG1 * (0.5 + 0.5 * tanh(ev)) + 0.03 * load;
      const gg = bg + (1 - bg) * g;
      const o = ((gg * 255 + 0.5) | 0) * 3;
      display.setPixel(x, y, (lut[o] * 255 + 0.5) | 0, (lut[o + 1] * 255 + 0.5) | 0, (lut[o + 2] * 255 + 0.5) | 0);
    }
}
