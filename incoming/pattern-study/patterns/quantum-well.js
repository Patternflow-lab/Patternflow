// ===== Patternflow pattern =====
// Title:   Quantum Well
// Family:  ledjunction
// Idea:    The energy band diagram of the light-emitting diode that lights this panel, drawn edge-on with position down the panel and electron energy across it, the conduction and valence band edges two glowing lines that kink at three quantum wells, electrons and holes glowing on a log scale along their own edges, while randomly timed current pulses straighten the tilted bands, fill the wells from the p side first and burst light across the gap, with amber flames where carriers die as heat or spill over the blocking layer.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the p-n junction and the injection of minority carriers across it (William Shockley, 1949, from memory), the exponentially fitted flux between mesh points that stays stable across steep band steps (Donald Scharfetter and Hermann Gummel, 1969, from memory), InGaN quantum wells with an AlGaN electron blocking layer, the structure behind the blue LED (Shuji Nakamura, 1990s, from memory), the ABC model of recombination and its efficiency droop (from memory), original code, pattern round 277
// Round:   277
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Current=0..4, Barrier=-1..1, Defects=-1..1
//
// Knob 1: Hue. The emission colour, with the electrons a fifth of a turn on from it and the holes just over half a turn on: hue 0.40 + K, so at 0 the light is spring green, the electrons azure (0.60) and the holes rose (0.93), and one turn of the knob brings them back. The heat stays amber (0.075) whatever the knob does. The wells are drawn deeper for a redder light and shallower for a bluer one, by a third of the true change in photon energy (2.35 eV at 0, x1.0; 2.95 eV at 0.35, x0.79; 1.91 eV at 0.6, x1.15). The transport model does not see that.
// Knob 2: Current. The height of the pulses, in A per cm2: 30 x e^(0.85 (K - 2)), 5.5 at 0, 30 at 2 where it opens, 164 at 4, times a random factor per pulse (median 1, sigma 0.45 in the log, between 0.4 and 2.4). Over 15 minutes at the opening 32 percent of all recombination was light, at 0 it was 35 percent and at 4 it was 23 percent, and the share that died in the wells as heat went 52, 56 and 67 percent. Low, the bursts are faint and mostly one well, high, they saturate and all three wells burn and amber climbs up the barriers.
// Knob 3: Barrier. The height of the electron blocking layer, its conduction band step 0.13 x (1 + K) eV below 0 and 0.13 + 0.32 K above: 0 at -1, 0.13 at 0 where it opens, 0.45 at 1 (the valence band step, which holds holes back, is 0.42 of that). Over 15 minutes at the opening, with the current at 2, the share of recombination that happened in the p-GaN, electrons that cleared the blocking layer, was 49 percent at -1, 6.5 at 0 and 0 at 1; the light was 19, 32 and 36 percent. Low, a tall amber flame climbs the p side and the wells dim, high, the step in the right-hand line grows and the wells light further down.
// Knob 4: Defects. The Shockley-Read-Hall rate of the wells, A = 0.03 x 40^K per ns: 7.5e-4 at -1, 0.037 at 0.06 where it opens, 1.2 at 1. Over 15 minutes the light was 36 percent of all recombination at -1, 32 at 0.06, 27 at 0.3, 20 at 0.5 and 2.7 at 1, and the heat in the wells 51, 56, 63, 72 and 96 percent. Below 0 the Auger loss the current drives is the larger and the knob hardly shows. Above 0.5 the light shortens to a short bar and then goes out, and amber flames stand in the wells and between them, with a faint speckle of the traps at mid-gap.
//
// What the picture is. A flat chart of energy against position, no figures, no scale, no device outline. A column is 0.133 eV of electron energy, so the 3.4 eV gap of GaN is 25 columns. The rows are not one scale: 24 rows of p-GaN at 5 nm, 8 of the AlGaN electron blocking layer at 2 nm, four GaN barriers of 9 rows at 1 nm with three InGaN wells of 7 rows at 0.45 nm between them (a 3.2 nm well, 9 nm barriers), and 39 rows of n-GaN at 5 nm. The upper line is the conduction band edge, the lower the valence band edge, the dark band between them the gap, and a well a notch where the gap narrows. The steps of the structure are drawn twice their size. The diagram sways a few columns on three clocks of 47, 83 and 131 s, since the zero of energy is arbitrary.
// The model. Electron density n(x) and hole density p(x) on those 128 cells, units of 1e18 per cm3, nm, ns and eV, one backward Euler step for each, a tridiagonal solve. The flux between two cells is the Scharfetter-Gummel one, (D / h)(B(d) n_i - B(-d) n_i+1) with d the step of the band edge over kT and B(x) = x / (e^x - 1), for holes the same on the valence edge turned over. D is 2.6 cm2/s for electrons and 1 for holes. A well has only so many states: the flux is also multiplied by (1 - n / n_max) of the cell it goes to, taken over 4 passes, and a well holds no more electrons than holes plus 1e18 per cm3, the quasi-neutrality that stands in for a Poisson solve. The band edges are given, not solved: E_c = 1.7 + step + U, E_v = -1.7 + step + U in eV, where the step is the structure (wells 0.18 eV deep for electrons, which is a step of 0.30 less 0.12 for the lowest level of a 3 nm well, and 0.23 for holes) and U = (V_bi - V)(S - 1/2) is the tilt, S running from 1 at the top of the blocking layer to 0 at the end of the barrier under the first well. A p-GaN row holds its holes at 1.5e18 and an n-GaN row its electrons at 5e18; the minority carriers there are lost at 200 and 40 per ns, diffusion lengths of 36 and 50 nm inside layers of 120 and 195 nm. Recombination is SRH, A n p / (n + p), radiative, B n p with B = 1.5e-11 cm3/s, and Auger, C (n + p) n p with C = 2.5e-30 cm6/s. The recombination in a well, B n p, is the light; everything else is heat.
// The drive. The current is what is asked, and the voltage V is what it takes: the current into the device is read from the pile-up plus the recombination of the holes below the p-GaN and the electrons in it, and V ramps up at 0.3 V/ns while less than a quarter of it flows (the junction charging) and then follows the log of the ratio. At rest V falls back with 10 ns to an idle bias that wanders between 0.15 and 1.1 V, so the bands are tilted by 1.5 to 2.5 eV and the upper part of the diagram stands 11 to 18 columns to the right; in a pulse V is 2.37 V (2.41 at Current 4) and the tilt is 0.25 eV, 2 columns. A pulse lasts 0.8 to 3 s (mean 1.9), a rest 0.5 to 2.4 s (mean 1.25), both drawn at random each time, so nothing repeats; over 15 minutes the current was on 60 percent of the time in 287 pulses and never stuck either way. One panel second is 36 ns of the device. At the opening the voltage is at 90 percent of its pulse value 0.13 s after the current starts, the light at 10 percent after 0.2 s, 50 after 0.47 and 90 after 0.9 s, so a short pulse never gets the wells full. At 0 that is 0.37, 0.67 and 1.03 s, at 4 it is 0.2, 0.2 and 0.47 s. Holes are the slow and scarce carrier: the well nearest the p side holds the holes and burns 29 of the 32 percent that is light at the opening, the middle well 1.7 and the far one 1.3. When the current stops the device's own light halves within a frame, because Auger eats holes at 9e18 per cm3 in a few ns; the panel lets the drawn light and heat die over 0.3 and 0.2 s.
// The picture. Electrons glow right of the conduction edge and holes left of the valence edge, the brightness the log of the density from 1e12 to 1e19.2 per cm3, about 6 columns deep, so the n-GaN at the bottom glows blue and the p-GaN at the top rose, and the wells hold a glow of their own. Each edge is a line 2.8 LEDs across at the foot, white mixed with the carrier's colour. A burst fills the gap of a well in the emission colour, brightness the log of the rate over 1.7 decades, whiter in the middle, the bloom about 2.5 to 6 columns beyond the edges, with a faint ripple moving outward; its length shortens as the share of light in the well falls. Heat is amber at mid-gap in rows where carriers recombine without light, a flame that is broad at its base and narrows and sways as it climbs and leans up the panel across the next 6 rows, brightness following the rate (the p-GaN and n-GaN rows, where the rate is far smaller, on a scale of their own). The deep blue right and deep rose left of the diagram breathe on 61 and 97 s clocks.
// What is exact and what is drawn. The 128-cell drift-diffusion with the exponentially fitted flux, the band edges as given, the ABC recombination, the state filling of the wells, the current balance and the pulses are the model, and every number in the knob lines was counted from it. Not the model: Poisson (the tilt is a ramp that was chosen, so there is no polarisation field and no quantum confinement beyond the 0.12 eV shift), the band offsets (chosen so that the wells hold holes and let electrons spill over a low blocking layer), the short contact layers, the voltage law, the idle bias, the random height of each pulse, the sway, the breathing, the log scales, the colours, the exaggerated steps, the wells' depth following the hue, and the lingering of light and heat after a pulse. No time modulo a period is used.

const W = 64, H = 128, N = 128;
const { floor, sqrt, exp, log, sin, cos, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ---- units: nm, ns, eV. Densities in 1e18 per cm3, so a flux of 1 is 16 A per cm2.
const KT = 0.02585;       // kT at 300 K, eV
const NSPS = 36;          // ns of device time per second of panel time
const WEG = 0.55;         // how much smaller the well's gap is than the barrier's at the opening hue, eV
const VBI = 2.62;         // the voltage at which the bands are flat across the junction, V (the panel's V is what the drive needs)
const VHI = 3.3;          // the most the junction can be driven
const VLO = 0.15;         // where it rests between pulses
const TAUV = 10;          // ns for the voltage to fall back when the current stops
const DN = 2.6e5;         // electron diffusivity, nm2/ns (2.6 cm2/s)
const DP = 1e5;           // hole diffusivity, nm2/ns (1 cm2/s)
const BRAD = 0.015;       // radiative B, per ns per 1e18 (1.5e-11 cm3/s)
const CAUG = 0.0025;      // Auger C, per ns per (1e18)^2 (2.5e-30 cm6/s)
const A0 = 0.03;          // SRH A at Defects = 0, per ns (3e7 /s); Defects multiplies it by 40^K4
const KCP = 200;          // electron loss in p-GaN, per ns (5 ps, a diffusion length near 36 nm)
const KCN = 40;           // hole loss in n-GaN, per ns (a diffusion length near 50 nm)
const ND = 5, NA = 1.5;   // doping, 5e18 and 1.5e18 per cm3
const QEXC = 1.0;         // electrons a well can hold beyond its holes, 1e18 per cm3 (quasi-neutrality)
const PMAXW = 40;         // hole states, 4e19
const JUNIT = 16;         // A per cm2 for a flux of 1
const JREF = 30, JSTEP = 0.85;   // the pulse, A per cm2: JREF at Current = 2, times e^JSTEP for each step of the knob

// the layers, top to bottom: type, rows, nm per row. 0 p-GaN, 1 EBL, 2 barrier, 3 well, 4 n-GaN
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

// the emission photon energy a hue stands for, eV: spectral from red (650 nm) at 0 to violet (420 nm) at 0.75,
// and back to red through the purples
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

// One backward Euler step of  h du/dt = -(F[i] - F[i-1]) - h loss u  for one carrier, F the Scharfetter-Gummel flux
// F = (D / hc) (B(d) u_i (1 - th_i+1) - B(-d) u_i+1 (1 - th_i)), d = (E_i+1 - E_i) / kT, th = u / umax.
// The (1 - th) factors are the states a well can run out of. They are taken from the last pass of a short
// fixed-point loop, so the matrix keeps negative off-diagonals and the density stays positive.
const UO = mk(), UI = mk();
function advance(u, E, D, loss, umax, pinTop, pinBot, dt, FW, GW) {
  for (let i = 0; i < N; i++) { UO[i] = u[i]; UI[i] = u[i]; }
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < N - 1; i++) {
      const d = (E[i + 1] - E[i]) / KT;
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

// ---- the structure, which the knobs move
// WEG: how much smaller the well's gap is than the barrier's. The electrons take 55 percent of it and sit 0.12 eV
// above the well's floor (the lowest level of a 3 nm well), the holes take 45 percent less 0.02 eV.
// ebl: the EBL's conduction band step, eV, 0 to 0.45 as Barrier goes from -1 to 1; its valence step is 0.42 of that.
function structure(S) {
  const kb = cl(S.k[2], -1, 1), ebl = kb < 0 ? 0.13 * (1 + kb) : 0.13 + 0.32 * kb;
  const wc = -max(0.06, 0.55 * WEG - 0.12), wv = 0.45 * WEG - 0.02;
  for (let i = 0; i < N; i++) {
    const t = TYP[i];
    SC[i] = t === 1 ? ebl : t === 3 ? wc : 0;
    SV[i] = t === 1 ? -0.42 * ebl : t === 3 ? wv : 0;
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
  const A = A0 * pow(40, cl(S.k[3], -1, 1));
  const n = S.n, p = S.p;
  for (let i = 0; i < N; i++) {
    const t = TYP[i], ni = n[i], pi = p[i], s = ni + pi;
    const srh = (A * ni * pi) / s, aug = CAUG * s * ni * pi, rad = BRAD * ni * pi;
    KN[i] = (A * pi) / s + BRAD * pi + CAUG * s * pi;
    KP[i] = (A * ni) / s + BRAD * ni + CAUG * s * ni;
    if (t === 0) { KN[i] = KCP + BRAD * pi; RNR[i] = KCP * ni; RRAD[i] = 0; }
    else if (t === 4) { KP[i] = KCN + BRAD * ni; RNR[i] = KCN * pi; RRAD[i] = 0; }
    else { RNR[i] = srh + aug + (t === 3 ? 0 : rad); RRAD[i] = t === 3 ? rad : 0; }
  }
}

const N0 = mk(), P0 = mk();
function substep(S, dt, jt) {
  structure(S);
  bands(S);
  rates(S);
  const n = S.n, p = S.p;
  for (let i = 0; i < N; i++) { N0[i] = n[i]; P0[i] = p[i]; }
  for (let i = 0; i < N; i++) if (TYP[i] === 3) UMAXN[i] = p[i] + QEXC;
  advance(n, EC, DN, KN, UMAXN, [0, 0], [39, ND], dt, FWn, GWn);
  rates(S);
  advance(p, EH, DP, KP, UMAXP, [24, NA], [0, 0], dt, FWp, GWp);
  // The current: holes that went in below the p-GaN and electrons that came up into it, from the mass balance of
  // the layers (what piled up plus what recombined), which is exact where a difference of two fluxes is not.
  let ih = 0, io = 0;
  for (let i = 24; i < N; i++) ih += HH[i] * ((p[i] - P0[i]) / dt + KP[i] * p[i]);
  for (let i = 0; i < 24; i++) io += HH[i] * ((n[i] - N0[i]) / dt + KN[i] * n[i]);
  ih = max(0, ih); io = max(0, io);
  S.ih = ih; S.io = io;
  // the voltage follows the current that is asked of it: a ramp while almost nothing flows (the junction
  // charging), then a nudge on the log of the ratio once it does
  S.jm += (ih + io - S.jm) * (1 - exp(-dt / 1.5));
  let dV;
  if (jt > 0) {
    const e = cl(log(jt / max(S.jm, 0.01 * jt)), -1.5, 1.5);
    dV = 0.03 * e * min(1, dt) + 0.3 * (1 - sm(0.03, 0.25, S.jm / jt)) * dt;
  } else dV = -(S.V - S.vr) * (1 - exp(-dt / TAUV));
  S.V = cl(S.V + dV, VLO, VHI);
}

export function setup(params) {
  const S = { t: 0, k: null, V: VLO, on: false, left: 0.4 + 1.5 * Math.random(), amp: 1, n: mk(), p: mk(), ih: 0, io: 0, jm: 0, dt: 0.033, rvp: mk(), avp: mk(), vr: VLO, ph: Array.from({ length: 128 }, () => TAU * Math.random()) };
  for (let i = 0; i < N; i++) {
    UMAXN[i] = 1e3;
    UMAXP[i] = TYP[i] === 3 ? PMAXW : 1e3;
    S.n[i] = TYP[i] === 4 ? ND : 1e-9;
    S.p[i] = TYP[i] === 0 ? NA : 1e-9;
  }
  params.s = S;
}

const PULSE = [0.8, 3.0], REST = [0.5, 2.4];
export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
    // the first frame is in the middle of a pulse that began seconds ago, wells full, knobs already at their values
    structure(S);
    const dtn = 0.5, J0 = JREF * exp(JSTEP * (S.k[1] - 2)) / JUNIT;
    for (let i = 0; i < 400; i++) substep(S, dtn, J0);
    S.on = true; S.left = 2.7 + 0.5 * Math.random();
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  S.t += d; S.dt = d;
  S.left -= d;
  S.vr = VLO + 0.4 * (1 + sin(S.t / 8.7 + S.ph[0]) * sin(S.t / 13.1 + S.ph[1])) + 0.12 * sin(S.t / 5.3 + S.ph[2]);
  if (S.left <= 0) {
    S.on = !S.on;
    if (S.on) { S.left = PULSE[0] + (PULSE[1] - PULSE[0]) * Math.random(); S.amp = cl(exp(0.45 * sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random())), 0.4, 2.4); }
    else S.left = REST[0] + (REST[1] - REST[0]) * Math.random() ** 1.5;
  }
  const J = S.on ? JREF * exp(JSTEP * (S.k[1] - 2)) * S.amp : 0;
  const nsub = 2, dtn = (d * NSPS) / nsub;
  for (let i = 0; i < nsub; i++) substep(S, dtn, J / JUNIT);
}

// ---- drawing
const SCL = 7.5;           // columns per eV
const EXA = 2.0;          // the heterostructure's steps are drawn this many times their size
const CX = 32;            // the column of the middle of the barrier gap at flat band
const BUF = new Float32Array(W * H * 3);
const TRP = mk(), ECC = mk(), EVC = mk(), LE = mk(), LH = mk(), RV = mk(), AV = mk(), T1 = mk(), LQ = mk();
const CE = [0, 0, 0], CEL = [0, 0, 0], CHO = [0, 0, 0], CAM = [0, 0, 0], CEC = [0, 0, 0], CHC = [0, 0, 0];

const blur3 = (a, b) => {
  for (let i = 0; i < N; i++) b[i] = 0.25 * a[i > 0 ? i - 1 : i] + 0.5 * a[i] + 0.25 * a[i < N - 1 ? i + 1 : i];
  for (let i = 0; i < N; i++) a[i] = b[i];
};

// distance from (x, y) to the polyline through (c[j], j), checked over the rows around y
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
  const T = S.t, k = S.k, he = 0.4 + k[0], sd = pow(max(0, k[3]), 1.1);
  structure(S);
  bands(S);

  // colours: the emission, the electrons a fifth of a turn on, the holes just over half a turn on, the heat fixed
  hsv(he, 0.72, 1, CE);
  hsv(he + 0.2, 0.85, 1, CEL);
  hsv(he + 0.53, 0.8, 1, CHO);
  hsv(0.075, 0.95, 1, CAM);
  for (let i = 0; i < 3; i++) { CEC[i] = 0.5 * CEL[i] + 0.5; CHC[i] = 0.5 * CHO[i] + 0.5; }

  const dU = VBI - S.V;
  // the wells are drawn deeper for a redder emission and shallower for a bluer one, by a third of the true change in photon energy
  const fh = 1 + 0.35 * (2.35 - photonEnergy(he));
  // the energy zero is arbitrary, so the diagram sways a few columns on two clocks that share no factor
  const cx = CX + 3.6 * sin(TAU * T / 47 + S.ph[3]) + 2 * sin(TAU * T / 83 + S.ph[4]) + 1.2 * sin(TAU * T / 131 + S.ph[5]);
  // and the two continua breathe a little on their own clocks
  const bw = 1 + 0.35 * sin(TAU * T / 61 + S.ph[6]), bh = 1 + 0.35 * sin(TAU * T / 97 + S.ph[7]);
  for (let y = 0; y < N; y++) {
    const u = dU * (S_RAMP[y] - 0.5);
    const fw = TYP[y] === 3 ? fh : 1;
    ECC[y] = cx + SCL * (1.7 + EXA * fw * SC[y] + u);
    EVC[y] = cx + SCL * (-1.7 + EXA * fw * SV[y] + u);
    LE[y] = cl((log(S.n[y]) / 2.302585 + 18 - 12) / 7.2, 0, 1);
    LH[y] = cl((log(S.p[y]) / 2.302585 + 18 - 12) / 7.2, 0, 1);
    RV[y] = TYP[y] === 3 ? cl(1 + log(max(RRAD[y], 1e-9) / 0.18) / 2.302585 / 1.7, 0, 1) : 0;
    AV[y] = TYP[y] === 0 || TYP[y] === 4 ? cl(1 + log(max(RNR[y], 1e-9) / 0.012) / 2.302585 / 1.0, 0, 1) : 1 - exp(-1.6 * pow(RNR[y] / 0.6, 0.55));
    LQ[y] = TYP[y] === 3 ? RRAD[y] / (RRAD[y] + RNR[y] + 1e-12) : 0;
  }
  for (let y = 0; y < N; y++) {
    const sp = sin(0.9 * T + S.ph[(y * 5) % 128]) * sin(0.61 * T + S.ph[(y * 7 + 3) % 128] * 1.7) + 0.35 * sin(2.9 * T + S.ph[(y * 11) % 128]);
    TRP[y] = y >= 24 && y < 89 ? max(0, sp) : 0;
  }
  blur3(TRP, T1); blur3(TRP, T1); blur3(TRP, T1);
  for (let y = 0; y < N; y++) TRP[y] = min(1, TRP[y] * 3) * 0.5;
  blur3(LE, T1); blur3(LH, T1);
  blur3(RV, T1); blur3(RV, T1); blur3(LQ, T1); blur3(LQ, T1);
  // the heat is a flame, so it leans up the panel: it spreads to the rows above
  for (let y = 0; y < N; y++) T1[y] = max(AV[y], 0.88 * AV[min(N - 1, y + 1)], 0.74 * AV[min(N - 1, y + 2)], 0.6 * AV[min(N - 1, y + 3)], 0.46 * AV[min(N - 1, y + 4)], 0.32 * AV[min(N - 1, y + 5)], 0.18 * AV[min(N - 1, y + 6)]);
  for (let y = 0; y < N; y++) AV[y] = T1[y];
  // the light and the heat linger on the panel after the device has let go of them
  const dl = exp(-S.dt / 0.3), dh = exp(-S.dt / 0.2);
  for (let y = 0; y < N; y++) {
    RV[y] = max(RV[y], S.rvp[y] * dl); S.rvp[y] = RV[y];
    AV[y] = max(AV[y], S.avp[y] * dh); S.avp[y] = AV[y];
  }

  for (let y = 0; y < H; y++) {
    const cE = ECC[y], vE = EVC[y], mid = 0.5 * (cE + vE), gw = cE - vE;
    const le = LE[y], lh = LH[y], rv = RV[y], half = (0.35 + 0.65 * sm(0.04, 0.5, LQ[y])) * 0.5 * gw;
    // the flame's flicker: two slow clocks per row
    const fl = 0.78 + 0.22 * sin(2.3 * T + S.ph[y % 64]) * sin(1.7 * T + S.ph[(y * 3) % 64 + 64]);
    const av = AV[y] > 0.1 ? sm(0.1, 0.3, AV[y]) * (0.6 + 0.4 * AV[y]) * fl : 0;
    const hw = 0.26 * gw + 1.5, ph1 = S.ph[y % 64] * 1.3;
    // a flame is broad at its base and narrows and sways as it rises
    const hwa = hw * (0.3 + 0.7 * AV[y]), wob = 2.2 * sin(0.45 * y - 2.2 * T + ph1) * (1 - AV[y]);
    const trap = TRP[y] * sd;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const dE = x - cE, dH = vE - x;
      let r, g, b;
      // the ground: a deep blue where electrons would sit, a deep rose where holes would, teal between
      if (dE > 0) { const q = exp(-dE / 9); r = (6 + 12 * q) * bw; g = (14 + 24 * q) * bw; b = (40 + 60 * q) * bw; }
      else if (dH > 0) { const q = exp(-dH / 9); r = (40 + 26 * q) * bh; g = (10 + 8 * q) * bh; b = (34 + 20 * q) * bh; }
      else { r = 8; g = 28; b = 28; }
      // carriers, on a log scale, hugging their own band edge
      const ge = le * (dE >= 0 ? exp(-dE / 7) : exp(dE / 1.2)) * 0.95;
      const gh = lh * (dH >= 0 ? exp(-dH / 7) : exp(dH / 1.2)) * 0.95;
      r += 255 * (ge * CEL[0] + gh * CHO[0]);
      g += 255 * (ge * CEL[1] + gh * CHO[1]);
      b += 255 * (ge * CEL[2] + gh * CHO[2]);
      // the burst across the gap
      if (rv > 0.02) {
        const dm0 = abs(x - 0.5 * (cE + vE)) - half;
        const out = dm0 > 0 ? dm0 + (dE > 0 ? dE : dH > 0 ? dH : 0) : 0;
        const edge = exp(-out / (2.5 + 3.5 * rv));
        const wv = 1 + 0.22 * sin(out * 0.9 - 4.2 * T + y * 0.05);
        const a = rv * edge * (out > 0 ? 0.7 * wv : 0.95);
        const w2 = 0.1 * a * a;
        r += 255 * (a * CE[0] * (1 - w2) + w2); g += 255 * (a * CE[1] * (1 - w2) + w2); b += 255 * (a * CE[2] * (1 - w2) + w2);
      }
      // the traps themselves: a faint speckle at mid-gap through the active region, thicker with the defect knob
      if (trap > 0 && abs(x - mid) < hw) {
        const a = trap * exp(-((x - mid) * (x - mid)) / (hw * hw));
        r += 255 * a * CAM[0]; g += 255 * a * CAM[1] * 0.92; b += 255 * a * CAM[2];
      }
      // the heat, at the middle of the gap where the traps are
      if (av > 0) {
        const tex = 0.8 + 0.2 * sin(0.62 * x + 2.1 * T + ph1) * sin(0.37 * x - 1.3 * T + S.ph[(y * 3) % 64 + 64]);
        const dm = (x - mid - wob) / hwa, a = av * tex * (1 - 0.35 * rv) * (exp(-dm * dm) + (dE > 0 ? 0.55 * exp(-dE / 3.5) : dH > 0 ? 0.55 * exp(-dH / 3.5) : 0));
        r += 255 * a * CAM[0]; g += 255 * a * CAM[1] * 0.92; b += 255 * a * CAM[2];
      }
      BUF[o] = r; BUF[o + 1] = g; BUF[o + 2] = b;
    }
  }
  // the two band edges
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      let d = lineDist(ECC, x, y);
      if (d < 2.8) { const v = 1 - (d * d) / 7.84, a = v * v * 0.95; BUF[o] += 255 * a * CEC[0]; BUF[o + 1] += 255 * a * CEC[1]; BUF[o + 2] += 255 * a * CEC[2]; }
      d = lineDist(EVC, x, y);
      if (d < 2.8) { const v = 1 - (d * d) / 7.84, a = v * v * 0.95; BUF[o] += 255 * a * CHC[0]; BUF[o + 1] += 255 * a * CHC[1]; BUF[o + 2] += 255 * a * CHC[2]; }
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, r = BUF[o], g = BUF[o + 1], b = BUF[o + 2];
      display.setPixel(x, y, r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, b > 255 ? 255 : b | 0);
    }
}
