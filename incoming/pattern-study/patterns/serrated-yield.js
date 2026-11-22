// ===== Patternflow pattern =====
// Title:   Serrated Yield
// Family:  strainband
// Idea:    A strain-rate map of an aluminium-magnesium bar pulled at a steady rate, a 64 by 128 LED stretch of its gauge on an inferno scale from black through indigo and magenta to orange and pale yellow, in which thin shear bands tilted 55 degrees off the pull flare up as the load climbs, then sweep the bar, creep or only flash while the load drops in a serration, each leaving a step of strain and a fading glow behind it, with one knob taking the bands from a continuous sweep (type A) through short creeping runs (type B) to random flashes in place (type C).
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: serrated flow in the tensile test of an alloy (Albert Portevin and François Le Chatelier, 1923), the band of yield that crosses a steel bar (Lüders, 1860), solute atoms that gather on dislocations and pin them (Alan Cottrell, 1953), dynamic strain ageing as a flow stress that falls as the rate rises (McCormick, 1972; Ladislas Kubin and Yuri Estrin, 1985), the kinetics of the bands in an Al-5at%Mg alloy (Chihab, Estrin, Kubin and Vergnol, 1987), band strain maps by digital image correlation (Tong, Tao, Zhang and Hector, 2005), the zero-extension line of a thin sheet at 54.7 degrees (Rodney Hill, 1952); pattern round 215
// Round:   217
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pull=0.5..4, Type=-1..1, Tilt=-20..20
//
// Knob 1: Hue. Added to the hue of every colour of the scale, the history of strain and the glow included. At 0 it is the inferno scale: the history is indigo (44, 11, 80), a band runs from magenta through orange to pale yellow (252, 254, 164). At 0.25 the history is dark red and the bands are green with a mint core, at 0.5 olive with blue bands and a lavender core, at 0.75 teal with magenta and pink bands, and at 1 it is back at 0.
// Knob 2: Pull. How fast the bar is pulled, which is the rate of the model's clock and nothing else, so the picture is the same at every Pull and only quicker or slower. At Pull 2, where it opens, the clock runs 4 model seconds a second at Type 0. It runs 10 at Type -1 and 3 at Type 1, and in each case it goes with Pull / 2, so Pull 0.5 is a quarter of that and Pull 4 twice. At Type -1 a band runs along the panel at 4.7 rows a second (3.4 to 5.5 for the middle half of the runs), which is 27 seconds for the 128 rows; at Pull 0.5 it is 1.1 rows a second and at Pull 4 it is 9.8. At Type 0 a new band starts 1.1 times a second, once in 3.6 seconds at Pull 0.5 and 2.2 times a second at Pull 4.
// Knob 3: Type. Which kind of serration the bar gives. On Al-Mg the type goes from A to B to C as the pull rate falls or the bar warms, and this knob is that axis. At -1 (type A) the flow spreads sideways at 0.3 LED squared a model second, the disorder of the bar is 0.3 and the slow noise 0.3, so a band that starts keeps going: 2.5 bands flow at a time, 0.7 start a second at Pull 2, and each runs 17 LEDs at the median (45 at the 90th percentile) and leaves a wide strained wake. At 0, where it opens, the spread is 0.04, the disorder 0.8 and the noise 0.8, and bands hold their place and creep a median 2 LEDs (5 at the 90th percentile) over about 4 seconds, with 4.9 flowing at a time and 1.1 starting a second. At 1 (type C) the spread is 0.005, the disorder 1.5 and the noise 1.2, and a band flashes where it starts: 8.1 flow at a time, 1.9 start a second, each lasts 3 seconds and moves half an LED. The knob also sets how far across the bar a band is drawn. At 55 degrees a band is cut short of the far edge 48 times in 100 at 0 and 74 in 100 from 0.8 up, and never at -0.8 or below. And it sets the extra stress at the two ends of the bar where bands like to start, 3.0 at the top and 1.2 at the bottom at -1, 1.5 and 0.6 at 0, and none at 1.
// Knob 4: Tilt. The angle of the bands from the pull, which runs up the panel, is 55 degrees plus Tilt: 35 degrees at -20, 55.06 where it opens and 75 at 20. A band across the 64 columns rises 91 rows at 35 degrees, 45 at 55 and 17 at 75. The bands turn about the middle of the panel and carry their strain with them, so turning the knob with the picture running swings every band and every step of the history together. A band is 2.7 LEDs across or more for nine in ten of them from Tilt -10 up at Type 1, where they are thinnest, and 2.1 at the thin end at -20 (the 10th percentile; the median is 3.8 across).

// What the picture is. A bar of an Al-Mg alloy is pulled at a steady rate and the panel looks at a stretch of its gauge, 64 LEDs across
// and 128 rows along the pull, which is vertical. A band is a thin strip of fast shear, and every strip parallel to one band moves in step.
// So the bar is worked as one line of cells along the band normal, s = y + c (x - 31.5) with c = cot(angle), and a pixel reads the cell its
// line passes through. A cell is 0.5 LED of s and there are 506, over the 128 rows of the panel and 14 rows more above and below that the
// panel does not show, where the grips are. Each cell has a strain rate u, an aging a (0 for dislocations free of solute atoms, 1 for ones
// pinned by them), a strain e and a heat T, and the bar has one load sigma.
// A cell flows at the rate u* = 60 / (1 + exp(-z)), z = sigma - 0.04 e - 14 a - eta - xi + end. The 14 a is the extra stress the pinning
// asks. Flow strips the pinning and time brings it back, da/dt = (1 - a) / 4 - a u / 4, so a settles at 1 / (1 + u) and the stress a rate
// needs, 14 / (1 + u) + ln(u / (60 - u)), falls as the rate rises between 0.08 and 9.6 (the negative rate sensitivity of dynamic strain
// ageing). There a uniform flow cannot hold and the bar flows in bands. u follows u* with a time of 0.15 model seconds and spreads along s as
// Dp (u(i-1) + u(i+1) - 2 u(i)) / 0.25, Dp being the sideways spread. The strain is de/dt = u with its mean over the bar taken off, so e is
// the strain a line has over the average: the bar hardens by 0.04 of that, a line a band has crossed is harder than one it has not, and the
// bar never necks. eta is a fixed noise of the bar, smoothed to 1.7 LEDs in sigma, and xi a noise that drifts over about 40 model seconds,
// on nodes 2.5 LEDs apart. end is a stress that falls away in 6 LEDs from the top end of the bar, with 0.4 of it at the bottom end.
// The load is d sigma / dt = 1.7 (1 - mean u), where mean u is the rate over the bar with each line weighted by its length inside it, and the
// pull is 1. While no band flows the load climbs nearly in a straight line, and where it reaches the stress a weak line needs, that line
// starts to flow. A band flowing brings mean u above 1 and the load falls, which is the serration, until the flow stops and the load
// climbs again. Heat comes from the flow, dT/dt = u / 60 + 4 (T(i-1) + T(i+1) - 2 T(i)) / 0.25 - T / 12, and shows as a glow round a band
// that fades over some seconds. 40 model seconds are run before the first frame, so the picture opens in the middle of its life.
// Drawing. u is smoothed by three box blurs of 5 cells (1.2 LEDs in sigma, more at a steep Tilt so that a band keeps its width across
// it), then put on the scale by ln(1 + u / 0.5) / ln(161), with a halo of 0.3 times u / 60 blurred over 19 cells three times, 0.3 times the
// heat, and underneath them the history, e over 1.6 times its spread through tanh, from 0 to 0.12 of the scale, with 0.03 for the load. The
// scale is the 11 stops of inferno in a table of 256 whose hue Knob 1 turns. A band is laid down along its line from where it was born, at
// a side edge of the bar 80 percent of the time and inside it otherwise, at 43 LEDs of length a model second, with its tip up to 1.6 times
// brighter, up to the length the type allows, which is 100 LEDs times (1 - 0.85 r s) for a random r from 0 to 1 and s from 0 at Type -0.8
// to 1 at 0.8 (the full line across the bar is 78 LEDs at 55 degrees). A band starts with a strength of 0.45 to 1, which falls toward half
// along its length over about 40 LEDs, and a ripple of 0.84 plus or minus 0.16 runs along it.

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

const TYPES = {
  dp: [0.3, 0.04, 0.005],
  eta: [0.3, 0.8, 1.5],
  tauA: [4, 4, 4],
  M: [1.7, 1.7, 1.7],
  endE: [3.0, 1.5, 0.0],
  xi: [0.3, 0.8, 1.2],
  clock: [10, 4, 3],     // model seconds per second at Pull 2
};
const typeAt = (arr, k3) => (k3 < 0 ? lerp(arr[1], arr[0], -k3) : lerp(arr[1], arr[2], k3));

function makeState() {
  const S = {
    u: new Float32Array(NS), a: new Float32Array(NS), e: new Float32Array(NS), eta: new Float32Array(NS),
    ell: new Float32Array(NS), tmp: new Float32Array(NS), xi: new Float32Array(NX + 2), xf: new Float32Array(NS),
    act: new Uint8Array(NS), tb: new Float32Array(NS), xn: new Float32Array(NS), ud: new Float32Array(NS + 2),
    hl: new Float32Array(NS), tbe: new Float32Array(NS), xne: new Float32Array(NS), T: new Float32Array(NS), T2: new Float32Array(NS), am: new Float32Array(NS), ame: new Float32Array(NS), lg: new Float32Array(NS), lge: new Float32Array(NS),
    lut: new Float32Array(256 * 3), lutHue: -1,
    sig: 4, t: 0, kn: [0, 2, 0, 0.06], c: -1, sinth: 0.82, sumU: 0, wsum: 1, smin: 0, smax: 0, ready: false, sd: 0,
  };
  for (let i = 0; i < NS; i++) { S.u[i] = 0.01; S.a[i] = 1; S.tb[i] = -1e3; S.am[i] = 1; S.lg[i] = 1e3; }
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
        for (let d = 1; d <= 14 && src < 0; d++) {
          if (i - d >= lo && act[i - d]) src = i - d;
          else if (i + d <= hi && act[i + d]) src = i + d;
        }
        if (src >= 0) { S.tb[i] = S.tb[src]; S.xn[i] = S.xn[src]; S.am[i] = S.am[src]; S.lg[i] = S.lg[src]; }
        else { S.tb[i] = S.t; S.xn[i] = bornAt(S, i); S.am[i] = 0.45 + 0.55 * Math.random(); S.lg[i] = 100 * (1 - par.short * 0.85 * Math.random()); }
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
    clock: typeAt(TYPES.clock, k3), short: cl((k3 + 0.8) / 1.6, 0, 1), cc: cos(th) / sin(th), sinth: sin(th),
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
    const n = ceil(T_PRE / 0.02);
    for (let k = 0; k < n; k++) { step(S, T_PRE / n, par); S.t += T_PRE / n; }
  }
  const dtm = cl(dt || 0, 0, 0.1) * (k2 / 2) * par.clock;
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
  const { u, e, ell, tmp, ud, tb, xn, lut, hl, tbe, xne, act, am, ame, lg, lge } = S, cc = S.c, sinth = S.sinth, tnow = S.t;
  const hue = cl(S.kn[0], 0, 1);
  if (abs(hue - S.lutHue) > 0.002) buildLut(S, hue);
  // the rate smoothed along s so that a band is wider than 2.5 LEDs on the panel, and a wide halo round it
  const rb = sinth < 0.62 ? 4 : sinth < 0.78 ? 3 : 2;
  boxBlur(u, tmp, rb); boxBlur(tmp, ud, rb); boxBlur(ud, tmp, rb);
  for (let i = 0; i < NS; i++) ud[i] = tmp[i];
  for (let i = 0; i < NS; i++) tmp[i] = u[i] / U_MAX;
  boxBlur(tmp, hl, 9); boxBlur(hl, tmp, 9); boxBlur(tmp, hl, 9);
  const T = S.T;
  // the birth of each line, taken from the flowing lines beside it
  for (let i = 0; i < NS; i++) {
    let best = -1e9, bj = i;
    for (let d = -10; d <= 10; d++) {
      const j = i + d;
      if (j >= 0 && j < NS && act[j] && tb[j] > best) { best = tb[j]; bj = j; }
    }
    tbe[i] = best > -1e9 ? tb[bj] : tb[i];
    xne[i] = best > -1e9 ? xn[bj] : xn[i];
    ame[i] = best > -1e9 ? am[bj] : am[i];
    lge[i] = best > -1e9 ? lg[bj] : lg[i];
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
      const reach = VPAR * (tnow - tbe[ic]), dist = abs(x - xne[ic]) / sinth, far = lge[ic];
      const rr = reach < far ? reach : far;
      if (rr < dist + 6) {
        const q = (rr - dist) / 5;
        const m = sm(q);
        v *= m; hv *= m;
        if (reach < far && q > 0 && q < 1) v *= 1 + 0.6 * sin(PI * q);
      }
      const mod = 0.84 + 0.16 * sin(x * 0.19 + s * 0.13 + 1.1) * sin(x * 0.11 - s * 0.17 + 2.3);
      // a band is strongest where it was born and fades along its length
      v *= mod * ame[ic] * (0.5 + 0.5 * exp(-dist / 40));
      const g = cl(log(1 + v / 0.5) / G_TOP + 0.3 * hv + GLOW * tv, 0, 1);
      const bg = BG0 + BG1 * (0.5 + 0.5 * tanh(ev)) + 0.03 * load;
      const gg = bg + (1 - bg) * g;
      const o = ((gg * 255 + 0.5) | 0) * 3;
      display.setPixel(x, y, (lut[o] * 255 + 0.5) | 0, (lut[o + 1] * 255 + 0.5) | 0, (lut[o + 2] * 255 + 0.5) | 0);
    }
}
