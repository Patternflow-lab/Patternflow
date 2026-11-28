// ===== Patternflow pattern =====
// Title:   Quantum Well
// Family:  ledjunction
// Idea:    The energy band diagram of the light-emitting diode that lights this panel, drawn edge-on with position down the panel and electron energy across it, the conduction and valence band edges two glowing lines that kink at three quantum wells, electrons and holes glowing on a log scale along their own edges, while a drive that wanders between random pulses, bundles, slow sweeps and quiet stretches straightens the tilted bands, fills the wells from the p side first and bursts light across the gap, with amber flames where carriers die as heat or spill over the blocking layer and heat that builds up in the junction.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the p-n junction and the injection of minority carriers across it (William Shockley, 1949, from memory), the exponentially fitted flux between mesh points that stays stable across steep band steps (Donald Scharfetter and Hermann Gummel, 1969, from memory), InGaN quantum wells with an AlGaN electron blocking layer, the blue LED (Shuji Nakamura, 1990s, from memory), the ABC model of recombination and its efficiency droop (from memory), original code, pattern round 277
// Round:   277
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Current=0..4, Barrier=-1..1, Defects=-1..1
//
// Knob 1: Hue. The emission colour: hue 0.40 + K, spring green at 0, with the electrons a fifth of a turn on (azure) and the holes 0.53 on (rose); the heat stays amber (0.075). Each well's colour follows its own alloy fluctuation, and the wells are drawn deeper for redder light by a third of the true change in photon energy (not in the transport).
// Knob 2: Current. The height of the drive, A per cm2: 30 x e^(K - 2), 4.1 at 0, 30 at 2 where it opens, 222 at 4, times a random 0.3 to 1.6 for each pulse or sweep. Over 15 minutes light was 30.5 percent of recombination at 0, 30.8 at 2 and 16.5 at 4, and the junction ran 1, 6 and 24 K warm on average (13 and 47 K at most at 2 and 4). Low, faint bursts; high, all three wells burn, flames rise in the p-GaN and the lines glow warm.
// Knob 3: Barrier. The electron blocking layer, its conduction band step 0.13 x (1 + K) eV below 0 and 0.13 + 0.32 K above: 0, 0.13 and 0.45 eV (its valence step, which holds the holes, is 0.42 of that). At Current 2 the share of recombination in the p-GaN, electrons that cleared the layer, was 46.5 percent at -1, 9.6 at 0 where it opens and 0 at 1; light was 18.9, 30.8, 34.4. Low, a tall flame stands on the p side and the wells dim.
// Knob 4: Defects. The SRH rate A = 0.03 x 40^K per ns: 7.5e-4 at -1, 0.037 at 0.06 where it opens, 1.2 at 1. Light was 36.4, 30.8, 24.7, 17.1 and 2.0 percent of recombination at -1, 0.06, 0.3, 0.5 and 1, heat in the wells 46, 53, 62, 72 and 95. High, the bursts shorten and go out, amber stands in the wells and between them.
//
// The picture. Energy across (0.133 eV a column), position down: 24 rows of p-GaN, 8 of AlGaN, three InGaN wells of 7 rows between four GaN barriers of 9, 39 of n-GaN (5, 2, 0.45, 1, 5 nm a row). Electrons glow right of the conduction edge, holes left of the valence edge, log scale; amber flames lean up from rows that recombine without light. Steps drawn twice their size, the tilt at half.
// The model. n(x) and p(x) on those 128 cells (nm, ns, eV, 1e18 per cm3), one backward Euler step each, Scharfetter-Gummel flux (D / h)(B(d) n_i - B(-d) n_i+1), d the band step over kT; wells run out of states and hold electrons up to their holes plus 1e18 (quasi-neutrality, no Poisson). Band edges are given: E_c = 1.7 + step + U, E_v = -1.7 + step + U, U = (V_bi - V)(S - 1/2), V found so that the drive current flows. SRH, B n p (the light, in the wells), Auger C (n + p) n p; A, B, C and kT follow the junction temperature, heated by power that does not leave as light, cooling over 10 s.
// Slow and random, 5 to 11 s each: each well's depth, the idle bias (0 to 2 V), two sets of 30 leakage paths whose heat widens the carrier glows and tints the wash, and the drive: pulses (0.8 to 3 s, rests 0.5 to 2.4 s, bundles of 3 to 5), sweeps of 10 to 18 s through 2.5 decades, quiet stretches.

const W = 64, H = 128, N = 128;
const { floor, sqrt, exp, log, sin, cos, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// units: nm, ns, eV, densities in 1e18 per cm3 (a flux of 1 is 16 A per cm2)
const KT = 0.02585;       // kT at 300 K, eV
const NSPS = 36;          // ns of device per second of panel
const WEG = 0.55;         // well gap smaller than the barrier's by this, eV
const VBI = 2.62;         // flat-band voltage, V (the panel's V is what the drive needs)
const VHI = 3.3, VLO = 0.15, TAUV = 10;   // top and bottom of V, ns for V to fall back
const DN = 2.6e5, DP = 1e5;               // diffusivities, nm2/ns (2.6 and 1 cm2/s)
const BRAD = 0.015;       // B, per ns (1.5e-11 cm3/s)
const CAUG = 0.0025;      // C, per ns (2.5e-30 cm6/s)
const A0 = 0.03;          // SRH A at Defects 0, per ns; times 40^K4
const KCP = 200, KCN = 40;  // minority loss in p-GaN and n-GaN, per ns (36 and 50 nm diffusion lengths)
const ND = 5, NA = 1.5;   // doping
const QEXC = 1.0;         // electrons a well holds beyond its holes (quasi-neutrality)
const PMAXW = 40;         // hole states in a well
const TTH = 10, TMAX = 70, THETA = 0.3;   // junction heat: time constant s, cap K, K per W/cm2
const JUNIT = 16;
const JREF = 30, JSTEP = 1.0;             // drive, A per cm2: JREF at Current 2, e^JSTEP a step

// layers, top down: type (0 p-GaN, 1 EBL, 2 barrier, 3 well, 4 n-GaN), rows, nm per row
const LAYERS = [
  [0, 24, 5], [1, 8, 2],
  [2, 9, 1], [3, 7, 0.45], [2, 9, 1], [3, 7, 0.45], [2, 9, 1], [3, 7, 0.45], [2, 9, 1],
  [4, 39, 5],
];

const TYP = new Int8Array(N), WEL = new Int8Array(N).fill(-1), HH = new Float64Array(N), POS = new Float64Array(N);
const HC = new Float64Array(N);
let RAMP0 = 0, RAMP1 = 1;
(function () {
  let r = 0, x = 0, w = 0;
  for (const [t, n, h] of LAYERS) {
    if (t === 1) RAMP0 = x;
    if (t === 3) w++;
    for (let k = 0; k < n; k++, r++) {
      TYP[r] = t; HH[r] = h; POS[r] = x + h / 2; x += h;
      if (t === 3) WEL[r] = w - 1;
    }
    if (t === 2 && r === 57) RAMP1 = x;
  }
  for (let i = 0; i < N - 1; i++) HC[i] = (HH[i] + HH[i + 1]) / 2;
})();
const S_RAMP = new Float64Array(N);
for (let i = 0; i < N; i++) S_RAMP[i] = cl(1 - (POS[i] - RAMP0) / (RAMP1 - RAMP0), 0, 1);

// photon energy a hue stands for, eV: red (650 nm) at 0 to violet (420 nm) at 0.75, back to red through the purples
function photonEnergy(h) {
  h -= floor(h);
  if (h <= 0.75) return 1240 / (650 - 306.7 * h);
  return 2.95 + (1.91 - 2.95) * sm(0.75, 1, h);
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- state arrays
const mk = () => new Float64Array(N);
const EC = mk(), EV = mk(), EH = mk(), SC = mk(), SV = mk();
const UMAXN = mk(), UMAXP = mk();
const FWn = mk(), GWn = mk(), FWp = mk(), GWp = mk();
const TA = mk(), TB = mk(), TC = mk(), TR = mk(), TD = mk();

// One backward Euler step of h du/dt = -(F[i] - F[i-1]) - h loss u, F = (D / hc)(B(d) u_i (1 - th_i+1) - B(-d) u_i+1 (1 - th_i)),
// d = (E_i+1 - E_i) / kT, th = u / umax; th from the last of 4 passes, so the matrix stays an M-matrix and u stays positive.
const UO = mk(), UI = mk();
let KTC = KT;
function advance(u, E, D, loss, umax, pinTop, pinBot, dt, FW, GW) {
  for (let i = 0; i < N; i++) { UO[i] = u[i]; UI[i] = u[i]; }
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < N - 1; i++) {
      const d = (E[i + 1] - E[i]) / KTC;
      const bp = abs(d) < 1e-9 ? 1 - d / 2 : d / Math.expm1(d);
      const c = D / HC[i];
      FW[i] = c * bp * (1 - min(0.995, UI[i + 1] / umax[i + 1]));
      GW[i] = c * (bp + d) * (1 - min(0.995, UI[i] / umax[i]));
    }
    for (let i = 0; i < N; i++) {
      TB[i] = HH[i] / dt + (i < N - 1 ? FW[i] : 0) + (i > 0 ? GW[i - 1] : 0) + HH[i] * loss[i];
      TA[i] = i > 0 ? -FW[i - 1] : 0;
      TC[i] = i < N - 1 ? -GW[i] : 0;
      TR[i] = (HH[i] * UO[i]) / dt;
    }
    for (let i = 0; i < pinTop[0]; i++) { TB[i] = 1; TA[i] = 0; TC[i] = 0; TR[i] = pinTop[1]; }
    for (let i = N - pinBot[0]; i < N; i++) { TB[i] = 1; TA[i] = 0; TC[i] = 0; TR[i] = pinBot[1]; }
    TD[0] = TC[0] / TB[0]; TR[0] /= TB[0];
    for (let i = 1; i < N; i++) {
      const m = TB[i] - TA[i] * TD[i - 1];
      TD[i] = TC[i] / m;
      TR[i] = (TR[i] - TA[i] * TR[i - 1]) / m;
    }
    UI[N - 1] = max(1e-13, TR[N - 1]);
    for (let i = N - 2; i >= 0; i--) UI[i] = max(1e-13, TR[i] - TD[i] * UI[i + 1]);
    for (let i = 0; i < N; i++) UI[i] = min(UI[i], 0.995 * umax[i]);
  }
  for (let i = 0; i < N; i++) u[i] = UI[i];
}

// the structure: electrons take 55 percent of WEG less 0.12 eV for the lowest level of a 3 nm well, holes 45 percent less 0.02;
// ebl is the blocking layer's conduction step, 0 to 0.45 eV, its valence step 0.42 of that
function structure(S) {
  const kb = cl(S.k[2], -1, 1), ebl = kb < 0 ? 0.13 * (1 + kb) : 0.13 + 0.32 * kb;
  const wc = -max(0.06, 0.55 * WEG - 0.12), wv = 0.45 * WEG - 0.02;
  for (let i = 0; i < N; i++) {
    const t = TYP[i], m = t === 3 ? S.m[WEL[i]] : 1;
    SC[i] = t === 1 ? ebl : t === 3 ? wc * m : 0;
    SV[i] = t === 1 ? -0.42 * ebl : t === 3 ? wv * m : 0;
  }
}

function bands(S) {
  const dU = VBI - S.V;
  for (let i = 0; i < N; i++) {
    const u = dU * (S_RAMP[i] - 0.5);
    EC[i] = 1.7 + SC[i] + u;
    EV[i] = -1.7 + SV[i] + u;
    EH[i] = -EV[i];
  }
}

const RRAD = mk(), RNR = mk(), KN = mk(), KP = mk();
function rates(S) {
  const dT = S.T, A = A0 * pow(40, cl(S.k[3], -1, 1)) * (1 + 0.006 * dT);
  const CA = CAUG * (1 + 0.008 * dT), BR = BRAD * pow(300 / (300 + dT), 1.5);
  const n = S.n, p = S.p;
  for (let i = 0; i < N; i++) {
    const t = TYP[i], ni = n[i], pi = p[i], s = ni + pi;
    const srh = (A * ni * pi) / s, aug = CA * s * ni * pi, rad = BR * ni * pi;
    KN[i] = (A * pi) / s + BR * pi + CA * s * pi;
    KP[i] = (A * ni) / s + BR * ni + CA * s * ni;
    if (t === 0) { KN[i] = KCP + BR * pi; RNR[i] = KCP * ni; RRAD[i] = 0; }
    else if (t === 4) { KP[i] = KCN + BR * ni; RNR[i] = KCN * pi; RRAD[i] = 0; }
    else { RNR[i] = srh + aug + (t === 3 ? 0 : rad); RRAD[i] = t === 3 ? rad : 0; }
  }
}

const N0 = mk(), P0 = mk();
function substep(S, dt, jt) {
  KTC = KT * (1 + S.T / 300);
  structure(S);
  bands(S);
  rates(S);
  const n = S.n, p = S.p;
  for (let i = 0; i < N; i++) { N0[i] = n[i]; P0[i] = p[i]; }
  for (let i = 0; i < N; i++) if (TYP[i] === 3) UMAXN[i] = p[i] + QEXC;
  advance(n, EC, DN, KN, UMAXN, [0, 0], [39, ND], dt, FWn, GWn);
  rates(S);
  advance(p, EH, DP, KP, UMAXP, [24, NA], [0, 0], dt, FWp, GWp);
  // the current: holes below the p-GaN and electrons in it, from pile-up plus recombination (exact, unlike a flux difference)
  let ih = 0, io = 0;
  for (let i = 24; i < N; i++) ih += HH[i] * ((p[i] - P0[i]) / dt + KP[i] * p[i]);
  for (let i = 0; i < 24; i++) io += HH[i] * ((n[i] - N0[i]) / dt + KN[i] * n[i]);
  ih = max(0, ih); io = max(0, io);
  S.ih = ih; S.io = io;
  // V ramps while almost nothing flows (the junction charging), then follows the log of asked over carried
  S.jm += (ih + io - S.jm) * (1 - exp(-dt / 1.5));
  let dV;
  if (jt > 0) {
    const e = cl(log(jt / max(S.jm, 0.01 * jt)), -1.5, 1.5);
    dV = 0.03 * e * min(1, dt) + 0.3 * (1 - sm(0.03, 0.25, S.jm / jt)) * dt;
  } else dV = -(S.V - S.vr) * (1 - exp(-dt / TAUV));
  S.V = cl(S.V + dV, VLO, VHI);
}

const NHS = 30;           // leakage paths along dislocations, per side
const gs = () => sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
const rnd = (a, b) => a + (b - a) * Math.random();

export function setup(params) {
  const S = {
    t: 0, k: null, V: VLO, on: false, left: 0.4, amp: 1, n: mk(), p: mk(), ih: 0, io: 0, jm: 0, dt: 0.033,
    rvp: mk(), avp: mk(), vr: VLO, T: 0, mode: 0, mleft: rnd(14, 30), mlen: 20, pk: 1, bun: 0,
    m: [1, 1, 1], z: [gs(), gs(), gs()], zv: gs(), lc: 0,
    hs: Array.from({ length: 2 * NHS }, (_, i) => { const z = gs(); return { y: (((i % NHS) + rnd(0.2, 0.8)) * N) / NHS, z, u: gs(), th: min(1.3, exp(0.9 * z - 0.15)) * rnd(0.3, 0.9), side: i < NHS ? 0 : 1 }; }),
    ph: Array.from({ length: 128 }, () => TAU * Math.random()),
  };
  for (let i = 0; i < N; i++) {
    UMAXN[i] = 1e3;
    UMAXP[i] = TYP[i] === 3 ? PMAXW : 1e3;
    S.n[i] = TYP[i] === 4 ? ND : 1e-9;
    S.p[i] = TYP[i] === 0 ? NA : 1e-9;
  }
  params.s = S;
}

// the drive: random pulses (now and then a bundle of 3 to 5 short ones), a sweep through 2.5 decades like a curve tracer,
// a quiet stretch; heights 0.3 to 1.6 times the knob
const PULSE = [0.8, 3.0], REST = [0.5, 2.4];
const ZTAU = [7, 9, 11];    // well depth wander, s
function drive(S, d) {
  const base = JREF * exp(JSTEP * (S.k[1] - 2));
  S.mleft -= d;
  if (S.mleft <= 0) {
    const r = Math.random();
    if (r < 0.5) { S.mode = 0; S.mleft = rnd(10, 24); S.on = false; S.left = rnd(0.2, 1.2); S.bun = 0; }
    else if (r < 0.78) { S.mode = 1; S.mlen = S.mleft = rnd(10, 18); S.pk = base * cl(exp(0.45 * gs()), 0.5, 1.6); }
    else { S.mode = 2; S.mleft = rnd(5, 10); }
  }
  if (S.mode === 1) { S.on = true; const tri = 1 - abs(2 * (1 - S.mleft / S.mlen) - 1); return 0.2 * pow(S.pk / 0.2, tri); }
  if (S.mode === 2) { S.on = false; return 0; }
  S.left -= d;
  if (S.left <= 0) {
    S.on = !S.on;
    if (S.on) {
      if (S.bun === 0 && Math.random() < 0.3) S.bun = 3 + floor(3 * Math.random());
      if (S.bun > 0) { S.left = rnd(0.25, 0.7); S.bun--; } else S.left = rnd(PULSE[0], PULSE[1]);
      S.amp = cl(exp(0.5 * gs()), 0.3, 1.6);
    } else S.left = S.bun > 0 ? rnd(0.12, 0.35) : REST[0] + (REST[1] - REST[0]) * Math.random() ** 1.5;
  }
  return S.on ? base * S.amp : 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
    // the first frame is mid-pulse, wells full
    const base = JREF * exp(JSTEP * (S.k[1] - 2));
    S.T = TMAX * Math.tanh((THETA * base * 1.65) / TMAX) * rnd(0.25, 0.6);
    for (let k = 0; k < 3; k++) S.m[k] = exp(0.17 * S.z[k]);
    structure(S);
    for (let i = 0; i < 400; i++) substep(S, 0.5, base / JUNIT);
    S.on = true; S.left = 3.2 + 0.6 * Math.random(); S.mode = 0; S.mleft = rnd(14, 30);
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  S.t += d; S.dt = d;
  // alloy fluctuation in each well, and the idle bias from 0 to a weak forward bias
  for (let k = 0; k < 3; k++) {
    S.z[k] += -S.z[k] * (d / ZTAU[k]) + sqrt((2 * d) / ZTAU[k]) * gs();
    S.m[k] = exp(0.17 * S.z[k]);
  }
  S.zv += -S.zv * (d / 6) + sqrt((2 * d) / 6) * gs();
  S.vr = 0.05 + 1.95 * sm(-1.7, 1.7, S.zv);
  // each leakage path heats over about 5 s
  const vt = 0.8;
  for (const h of S.hs) {
    h.z += -h.z * (d / 7) + sqrt((2 * d) / 7) * gs();
    h.u += -h.u * (d / 6) + sqrt((2 * d) / 6) * gs();
    h.th += (min(1.3, exp(0.9 * h.z - 0.15)) * vt - h.th) * (1 - exp(-d / 5));
  }
  const J = drive(S, d);
  const nsub = 2, dtn = (d * NSPS) / nsub;
  for (let i = 0; i < nsub; i++) substep(S, dtn, J / JUNIT);
  // the junction heats with the power that does not leave as light
  let lc = 0;
  for (let i = 0; i < N; i++) if (TYP[i] === 3) lc += RRAD[i] * HH[i];
  const he = 0.4 + S.k[0] - 0.3 * ((S.m[0] + S.m[1] + S.m[2]) / 3 - 1);
  const pw = max(0, JUNIT * S.jm * S.V - JUNIT * lc * photonEnergy(he));
  S.T += (TMAX * Math.tanh((THETA * pw) / TMAX) - S.T) * (1 - exp(-d / TTH));
}

// ---- drawing
const SCL = 7.5, EXA = 2.0, CX = 32;   // columns per eV, steps drawn this many times their size, middle column
const BUF = new Float32Array(W * H * 3);
const HUR = mk(), HUL = mk(), WTR = mk(), WTL = mk(), HOT = mk(), HOH = mk(), TRP = mk(), ECC = mk(), EVC = mk(), LE = mk(), LH = mk(), RV = mk(), AV = mk(), T1 = mk(), LQ = mk();
const GRf = [0, 0, 0], GRn = [0, 0, 0], GLf = [0, 0, 0], GLn = [0, 0, 0], CEW = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], CEL = [0, 0, 0], CHO = [0, 0, 0], CAM = [0, 0, 0], CEC = [0, 0, 0], CHC = [0, 0, 0];

const blur3 = (a, b) => {
  for (let i = 0; i < N; i++) b[i] = 0.25 * a[i > 0 ? i - 1 : i] + 0.5 * a[i] + 0.25 * a[i < N - 1 ? i + 1 : i];
  for (let i = 0; i < N; i++) a[i] = b[i];
};

// distance from (x, y) to the polyline through (c[j], j)
function lineDist(c, x, y) {
  let best = 1e9;
  const j0 = max(0, y - 3), j1 = min(N - 2, y + 3);
  for (let j = j0; j <= j1; j++) {
    const ax = c[j], bx = c[j + 1], dx = bx - ax, px = x - ax, py = y - j;
    const t = cl((px * dx + py) / (dx * dx + 1), 0, 1);
    const qx = px - t * dx, qy = py - t;
    const d = qx * qx + qy * qy;
    if (d < best) best = d;
  }
  return sqrt(best);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.k) return;
  const T = S.t, k = S.k, he0 = 0.4 + k[0], he = he0 - 0.1 * ((S.m[0] + S.m[1] + S.m[2]) / 3 - 1), sd = pow(max(0, k[3]), 1.1);
  const heat = cl(S.T / 45, 0, 1.6);
  structure(S);
  bands(S);

  // colours: emission, electrons 0.2 on, holes 0.53 on, heat fixed
  for (let w = 0; w < 3; w++) hsv(he0 - 0.1 * (S.m[w] - 1), 0.72, 1, CEW[w]);
  hsv(he + 0.2, 0.85, 1, CEL);
  hsv(he + 0.53, 0.8, 1, CHO);
  hsv(0.075, 0.95, 1, CAM);
  const hw0 = 0.35 * min(1, heat), WH = [1, 0.85, 0.6];
  for (let i = 0; i < 3; i++) { CEC[i] = (0.5 * CEL[i] + 0.5) * (1 - hw0) + hw0 * WH[i]; CHC[i] = (0.5 * CHO[i] + 0.5) * (1 - hw0) + hw0 * WH[i]; }

  const dU = 0.5 * (VBI - S.V);
  // wells drawn deeper for redder light, by a third of the true change in photon energy
  const fh = 1 + 0.35 * (2.35 - photonEnergy(he));
  // the two continua breathe
  const bw = 1 + 0.35 * sin(TAU * T / 61 + S.ph[6]), bh = 1 + 0.35 * sin(TAU * T / 97 + S.ph[7]);
  for (let y = 0; y < N; y++) {
    const u = dU * (S_RAMP[y] - 0.5);
    const fw = TYP[y] === 3 ? fh : TYP[y] === 1 ? 1.5 : 1;
    ECC[y] = CX + SCL * (1.7 + EXA * fw * SC[y] + u);
    EVC[y] = CX + SCL * (-1.7 + EXA * fw * SV[y] + u);
    LE[y] = cl((log(S.n[y]) / 2.302585 + 18 - 12) / 7.2, 0, 1);
    LH[y] = cl((log(S.p[y]) / 2.302585 + 18 - 12) / 7.2, 0, 1);
    RV[y] = TYP[y] === 3 ? cl(1 + log(max(RRAD[y], 1e-9) / 0.18) / 2.302585 / 1.4, 0, 1) : 0;
    AV[y] = TYP[y] === 0 || TYP[y] === 4 ? cl(1 + log(max(RNR[y], 1e-9) / 0.006) / 2.302585 / 1.0, 0, 1) : 1 - exp(-1.6 * pow(RNR[y] / 0.45, 0.55));
    LQ[y] = TYP[y] === 3 ? RRAD[y] / (RRAD[y] + RNR[y] + 1e-12) : 0;
  }
  for (let y = 0; y < N; y++) {
    const sp = sin(0.9 * T + S.ph[(y * 5) % 128]) * sin(0.61 * T + S.ph[(y * 7 + 3) % 128] * 1.7) + 0.35 * sin(2.9 * T + S.ph[(y * 11) % 128]);
    TRP[y] = y >= 24 && y < 89 ? max(0, sp) : 0;
  }
  blur3(TRP, T1); blur3(TRP, T1); blur3(TRP, T1);
  for (let y = 0; y < N; y++) TRP[y] = min(1, TRP[y] * 3) * 0.8;
  // how hot each row is, round the leakage paths
  for (let y = 0; y < N; y++) HOT[y] = HOH[y] = HUR[y] = HUL[y] = WTR[y] = WTL[y] = 0;
  for (const h of S.hs) {
    const a0 = min(1, h.th) * (0.9 * 24) / NHS, F = h.side ? HOH : HOT, U = h.side ? HUL : HUR, Wt = h.side ? WTL : WTR;
    for (let y = max(0, floor(h.y) - 12); y <= min(N - 1, floor(h.y) + 12); y++) { const dy = (y - h.y) / 3.5, w = a0 * exp(-dy * dy); F[y] += w; U[y] += w * h.u; Wt[y] += w; }
  }
  blur3(LE, T1); blur3(LH, T1);
  blur3(RV, T1); blur3(RV, T1); blur3(RV, T1); blur3(LQ, T1); blur3(LQ, T1);
  // heat leans up the panel
  for (let y = 0; y < N; y++) T1[y] = max(AV[y], 0.88 * AV[min(N - 1, y + 1)], 0.74 * AV[min(N - 1, y + 2)], 0.6 * AV[min(N - 1, y + 3)], 0.46 * AV[min(N - 1, y + 4)], 0.32 * AV[min(N - 1, y + 5)], 0.18 * AV[min(N - 1, y + 6)]);
  for (let y = 0; y < N; y++) AV[y] = T1[y];
  // light and heat linger
  const dl = exp(-S.dt / 0.3), dh = exp(-S.dt / 0.2);
  for (let y = 0; y < N; y++) {
    RV[y] = max(RV[y], S.rvp[y] * dl); S.rvp[y] = RV[y];
    AV[y] = max(AV[y], S.avp[y] * dh); S.avp[y] = AV[y];
  }

  for (let y = 0; y < H; y++) {
    const cE = ECC[y], vE = EVC[y], mid = 0.5 * (cE + vE), gw = cE - vE;
    const CEk = CEW[y < 52 ? 0 : y < 68 ? 1 : 2];
    // the washes take a tint from the leakage paths
    const dR = 0.15 * Math.tanh(HUR[y] / (WTR[y] + 0.25)), dL = 0.15 * Math.tanh(HUL[y] / (WTL[y] + 0.25));
    hsv(0.628 + dR, 0.85, 0.157, GRf); hsv(0.628 + dR, 0.82, 0.39, GRn); hsv(0.87 + dL, 0.75, 0.157, GLf); hsv(0.87 + dL, 0.73, 0.26, GLn);
    const hot = 0.5 * (HOT[y] + HOH[y]), gwe = 7 * (1 + 1.2 * HOT[y]), gae = 0.62 * (1 + 0.6 * HOT[y]), gwh = 7 * (1 + 1.2 * HOH[y]), gah = 0.62 * (1 + 0.6 * HOH[y]);
    const le = LE[y], lh = LH[y], rv = RV[y], half = (0.35 + 0.65 * sm(0.04, 0.5, LQ[y])) * 0.5 * gw;
    // flicker
    const fl = 0.78 + 0.22 * sin(2.3 * T + S.ph[y % 64]) * sin(1.7 * T + S.ph[(y * 3) % 64 + 64]);
    const av = AV[y] > 0.1 ? sm(0.1, 0.3, AV[y]) * (0.6 + 0.4 * AV[y]) * fl : 0;
    const hw = 0.26 * gw + 1.5, ph1 = S.ph[y % 64] * 1.3;
    // broad at the base, narrow and swaying as it rises
    const hwa = hw * (0.3 + 0.7 * AV[y]), wob = 2.2 * sin(0.45 * y - 2.2 * T + ph1) * (1 - AV[y]);
    const trap = TRP[y] * sd;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const dE = x - cE, dH = vE - x;
      let r, g, b;
      // ground: blue right, rose left, teal between
      if (dE > 0) { const q = exp(-dE / 9), f = 255 * bw * (0.1 + 1.55 * HOT[y]); r = (GRf[0] + (GRn[0] - GRf[0]) * q) * f; g = (GRf[1] + (GRn[1] - GRf[1]) * q) * f; b = (GRf[2] + (GRn[2] - GRf[2]) * q) * f; }
      else if (dH > 0) { const q = exp(-dH / 9), f = 255 * bh * (0.1 + 1.55 * HOH[y]); r = (GLf[0] + (GLn[0] - GLf[0]) * q) * f; g = (GLf[1] + (GLn[1] - GLf[1]) * q) * f; b = (GLf[2] + (GLn[2] - GLf[2]) * q) * f; }
      else { const f = 0.5 + 0.5 * hot; r = 8 * f; g = 28 * f; b = 28 * f; if (y >= 24 && y < 89) { r += 14 * sd; g += 5 * sd; } }
      // carriers, log scale
      const ge = le * (dE >= 0 ? exp(-dE / gwe) : exp(dE / 1.2)) * gae;
      const gh = lh * (dH >= 0 ? exp(-dH / gwh) : exp(dH / 1.2)) * gah;
      r += 255 * (ge * CEL[0] + gh * CHO[0]);
      g += 255 * (ge * CEL[1] + gh * CHO[1]);
      b += 255 * (ge * CEL[2] + gh * CHO[2]);
      // burst
      if (rv > 0.02) {
        const dm0 = abs(x - 0.5 * (cE + vE)) - half;
        const out = dm0 > 0 ? dm0 + (dE > 0 ? dE : dH > 0 ? dH : 0) : 0;
        const edge = exp(-out / (3 + 6 * rv));
        const wv = 1 + 0.22 * sin(out * 0.9 - 4.2 * T + y * 0.05);
        const a = rv * edge * (out > 0 ? 0.85 * wv : 0.95);
        const w2 = 0.1 * a * a;
        r += 255 * (a * CEk[0] * (1 - w2) + w2); g += 255 * (a * CEk[1] * (1 - w2) + w2); b += 255 * (a * CEk[2] * (1 - w2) + w2);
      }
      // trap speckle
      if (trap > 0 && abs(x - mid) < hw) {
        const a = trap * exp(-((x - mid) * (x - mid)) / (hw * hw));
        r += 255 * a * CAM[0]; g += 255 * a * CAM[1] * 0.92; b += 255 * a * CAM[2];
      }
      // heat at mid-gap
      if (av > 0) {
        const tex = 0.8 + 0.2 * sin(0.62 * x + 2.1 * T + ph1) * sin(0.37 * x - 1.3 * T + S.ph[(y * 3) % 64 + 64]);
        const dm = (x - mid - wob) / hwa, a = av * tex * (1 - 0.35 * rv) * (exp(-dm * dm) + (dE > 0 ? 0.55 * exp(-dE / 3.5) : dH > 0 ? 0.55 * exp(-dH / 3.5) : 0));
        r += 255 * a * CAM[0]; g += 255 * a * CAM[1] * 0.92; b += 255 * a * CAM[2];
      }
      BUF[o] = r; BUF[o + 1] = g; BUF[o + 2] = b;
    }
  }
  // band edges, haloed when hot
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      let d = lineDist(ECC, x, y);
      if (d < 2.8) { const v = 1 - (d * d) / 7.84, a = v * v * 0.95; BUF[o] += 255 * a * CEC[0]; BUF[o + 1] += 255 * a * CEC[1]; BUF[o + 2] += 255 * a * CEC[2]; }
      else if (d < 7 && HOT[y] + 0.5 * heat > 0.05) { const a = 0.45 * (HOT[y] + 0.5 * heat) * exp(-(d - 2.8) / 2.2); BUF[o] += 255 * a * CAM[0]; BUF[o + 1] += 255 * a * CAM[1] * 0.8; }
      d = lineDist(EVC, x, y);
      if (d < 2.8) { const v = 1 - (d * d) / 7.84, a = v * v * 0.95; BUF[o] += 255 * a * CHC[0]; BUF[o + 1] += 255 * a * CHC[1]; BUF[o + 2] += 255 * a * CHC[2]; }
      else if (d < 7 && HOT[y] + 0.5 * heat > 0.05) { const a = 0.45 * (HOT[y] + 0.5 * heat) * exp(-(d - 2.8) / 2.2); BUF[o] += 255 * a * CAM[0]; BUF[o + 1] += 255 * a * CAM[1] * 0.8; }
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, r = BUF[o], g = BUF[o + 1], b = BUF[o + 2];
      display.setPixel(x, y, r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, b > 255 ? 255 : b | 0);
    }
}
