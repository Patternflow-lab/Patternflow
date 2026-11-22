// ===== Patternflow pattern =====
// Title:   Kundt Figures
// Family:  kundt
// Idea:    Three vertical Kundt tubes stand side by side on a dark teal ground, a loudspeaker sweeping one pitch through all of them, and the cork dust on the floor of each tube is thrown up where the standing sound is loud and falls back where it is still, so that as the pitch finds a tube's resonance its dust runs into evenly spaced transverse heaps at the displacement nodes, sharp and tall at the peak and slumping low between resonances, each tube with its own count of heaps.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the dust figures of a resonating glass tube, whose heap spacing of half a wavelength gives the speed of sound c = lambda f in the gas (August Kundt, 1866), the circulation of air in Kundt's tubes that sorts the dust (Lord Rayleigh, 1884, from memory, with the tube in the Theory of Sound, 1877-78), the resonance of a closed pipe at n half-wavelengths; pattern round 215
// Round:   217
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sweep=0..4, Level=-1..1, Gas=-1..1
//
// Knob 1: Hue. Turns the dust and the ground round the wheel together. At 0 the dust is cork brown rising to ochre and pale straw on the crests over a dark teal ground, with a faint teal light where the sound is loud. At 0.5 the dust is blue-grey over a dark maroon ground, and at 1 it is back where it began.
// Knob 2: Sweep. How fast the loudspeaker's pitch is tuned up and down, 0.131 radians a second of the sweep phase for each unit of the knob, so at 2, where it opens, one slow pass of the pitch takes about 48 s. The sweep sums three sines of 1, 1.735 and 0.414 times that rate, so it never repeats, and it slows to a third of its speed within 0.2 of a mode of a resonance, as a hand does when it hears a tube sing. At 0 the pitch stands still where it was, and the dust settles into whatever the tubes then hold. At 4 a pass takes 24 s and the heaps have little time to form.
// Knob 3: Level. How loud the speaker plays, the acoustic energy running as 2 to the power 1.6 times the knob, 0.33 of the middle at -1 and 3.0 times it at 1. The dust sits wherever the energy of the standing wave stays below a threshold, so the louder the sound the thinner the still zone round each node: at the opening a heap on resonance is about 5 LEDs across in the tube with six heaps, at -1 it is 9 LEDs and soft and the swept zones between are narrow, and at 1 it is held to 3.4 LEDs, the thinnest the panel keeps clear.
// Knob 4: Gas. The speed of sound in the tubes, 2 to the power 0.7 times the knob, so 1.62 times slower at -1 (a heavy gas) and 1.62 times faster at 1 (a light one). The wavelength is c over f, so the heaps lie closer in a slow gas: the middle tube meets 13 modes at -1 and 5 at 1 where it meets 8 at 0, and the spacing of its heaps goes from about 9 LEDs to 25 LEDs. The three tubes keep their lengths and gases in the ratio 1 to 1.318 to 0.742, so they never ring at the same moment.

// What the picture is. A tube is 124 LEDs long (rows 2 to 125) and 16 LEDs across, closed at the bottom and driven at the top, and
// there are three of them, at columns 2, 24 and 46. The ground inside is a dark teal and the gaps are near black. No glass is drawn.
// The dust is a bed of mass h(s, t) per length of tube, mean 1, and a cloud a(s, t) in the air above it, both on 248 cells of half a
// LED, with no dust passing the two ends. The mass of h plus a is conserved to rounding. s runs down the tube from 0 to 124.
// The sound is a standing wave of mode number n, 2 L f / c, a real number as the pitch sweeps. Its energy in units of the dust threshold is
//   E(s) = P sin^2(pi n (1 - s / L)) + 0.02,   P = Pk R(n) 2^(1.6 Level),   R(n) = 1 / (1 + (sin(pi n) / (pi w))^2),
// with nodes at the closed end and at L (1 - j / n), so that as n rises the nodes slide down the tube and a new one comes in at the top
// each time n passes a whole number. R is the resonance, a Lorentzian of half-width w = 0.085 to 0.105 in n. Pk is 6.5, and P is held
// to the value that keeps the still zone 3.4 LEDs across. The mode number is n = 6 2^(-0.7 Gas) r 2^d T, r the tube's ratio, d the sweep
// (up to 0.3 of an octave either way) and T the warmth of the gas, 1 plus 0.028 sin(2 pi t / 110 to 180 s) and 0.016 sin(2 pi t / 43 to 72 s)
// with its own phase for each tube, so a resonance wanders by 0.2 mode and the tubes do not fall into step.
// Dust moves where E is above 0.85, the gate g = smoothstep((E - 0.85) / 0.9). There it is lifted from the bed at g / 0.35 s and falls
// back at 1 / 0.9 s, and the cloud drifts down the gradient of E at 7 LEDs a second with a spread of 1.5 LED^2 a second, in an upwind scheme
// that keeps every cell positive. Where E is below the threshold nothing lifts, so the cloud settles there and the dust stays. That is the
// heap: the still zone round a node, whose width is set by sin^2 = 0.85 / P. Between resonances the bed slumps under its own weight,
// the flux -0.25 h dh/ds, which lowers a heap with the time of a half minute. The tube is pre-run for 36 s at the opening knobs, so it
// opens with its dust already sorted.
// Drawing. The bed seen from above lies in a tube of round section: its thickness across the 16 LEDs is h (1 - 0.85 u^2) less 0.08 for u from -1 to 1,
// so a thin film is a ribbon along the middle and a heap reaches the walls. The ridge is lit from above and a little aside, which is what makes
// the heaps read as ridges, and a heap's crest is pale straw. The crests bow by 1.3 LEDs across the tube, as the striae do against the wall.
// The cloud is a warm haze over the whole width and the loud zones glow faintly teal.

const W = 64, H = 128;
const { floor, sqrt, abs, exp, sin, cos, tanh, PI, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the tubes
const NT = 3, TW = 16, TX = [2, 24, 46], Y0 = 2, TL = 124;
const N = 248, DX = TL / N; // cells of half a LED
const RATIO = [1.0, 1.318, 0.742]; // fundamental frequencies, as the inverse of the mode number at a given pitch
const HALFW = [0.095, 0.085, 0.105]; // half-width of a resonance in n
const WARM1 = [[137.3, 0.9], [181.9, 2.3], [109.7, 4.1]]; // period in seconds, phase
const WARM2 = [[53.1, 0.4], [71.7, 1.6], [43.3, 5.2]];
// the gas is warmer at the loudspeaker end than at the closed end by an amount that wanders, and bulges in the middle: the speed of sound along a tube
const GRAD1 = [[67.1, 0.3], [89.7, 2.0], [57.3, 4.4]], GRAD2 = [[113.3, 1.1], [79.9, 3.7], [131.1, 5.5]];

// ---- the sound and the dust
const PK = 8; // energy at an antinode on resonance at the middle of the Level knob, in units of the dust threshold
const WMIN = 1.7; // half the narrowest still zone, in LEDs
const E_LO = 0.85, E_SPAN = 0.9; // the gate opens between these energies
const TAU_L = 0.35, TAU_F = 0.9; // lift and fall times of a grain, in seconds
const V0 = 7; // drift of the cloud down the energy gradient, LEDs a second
const DA = 1.5; // spread of the cloud, LED^2 a second
const KAP = 0.05; // slump of the bed, LED^2 a second for each unit of h
const AVA = 0.8, REPOSE = 1.1; // a slope steeper than the angle of repose slides, at up to AVA LEDs a second for each unit of h
const HCAP = 12;
const GRAD0 = 0.12; // energy gradient, in thresholds a LED, over which the drift reaches full speed
const OMEGA = 0.0654; // sweep phase, radians a second for each unit of the Sweep knob
const SLOWDOWN = 2.0;
const SWEEP_AT = 0.55; // octaves
const GRAD_A = 0.38, GRAD_B = 0.26;
const PREROLL = 36, PRE_DT = 1 / 20;
const START_PHASE = 0.9;

function makeState() {
  const S = {
    ready: false, tau: 0, theta: START_PHASE,
    kn: [0, 2, 0, 0.06],
    n: [6, 8, 4.5], R: [0, 0, 0],
    h: [], a: [], E: [], G: [], V: [],
    F: new Float32Array(N + 1), F2: new Float32Array(N + 1), ph: new Float32Array(N),
    lut: new Float32Array(64 * 3), hueMat: new Float32Array(9), hueAt: -1,
  };
  for (let j = 0; j < NT; j++) {
    const h = new Float32Array(N);
    const p1 = Math.random() * 6.283, p2 = Math.random() * 6.283, p3 = Math.random() * 6.283;
    for (let i = 0; i < N; i++) {
      const s = i / N;
      h[i] = 1 + 0.12 * sin(6.283 * 3.1 * s + p1) + 0.08 * sin(6.283 * 7.3 * s + p2) + 0.05 * sin(6.283 * 13.7 * s + p3);
    }
    S.h.push(h);
    S.a.push(new Float32Array(N));
    S.E.push(new Float32Array(N));
    S.G.push(new Float32Array(N));
    S.V.push(new Float32Array(N + 1));
  }
  return S;
}

export function setup(params) {
  params.s = makeState();
}

// The sweep of the pitch, in octaves: three sines whose rates have no common period.
const tri = (x) => (2 / PI) * Math.asin(0.93 * sin(x)) / Math.asin(0.93);
function sweepOf(theta, nb) {
  return SWEEP_AT * Math.pow(min(1, 6 / nb), 1.2) * (0.6 * tri(theta) + 0.3 * tri(1.7351 * theta + 1.1) + 0.1 * tri(0.4143 * theta + 2.0));
}

function modesOf(S, kn) {
  const nb = 6 * Math.pow(2, -0.7 * cl(kn[3], -1, 1)), sw = Math.pow(2, sweepOf(S.theta, nb)), t = S.tau;
  let rmax = 0;
  for (let j = 0; j < NT; j++) {
    const warm = 1 + 0.07 * sin((2 * PI * t) / WARM1[j][0] + WARM1[j][1]) + 0.04 * sin((2 * PI * t) / WARM2[j][0] + WARM2[j][1]);
    const n = nb * RATIO[j] * sw * warm;
    const sp = sin(PI * n) / (PI * HALFW[j]);
    S.n[j] = n;
    S.R[j] = 1 / (1 + sp * sp);
    if (S.R[j] > rmax) rmax = S.R[j];
  }
  return rmax;
}

// The energy, the gate and the drift of one tube, once a frame.
function fieldsOf(S, j, a2) {
  const n = S.n[j], E = S.E[j], G = S.G[j], V = S.V[j];
  const sn = sin(min(PI / 2, (PI * n * WMIN) / TL));
  const P = min(PK * a2 * S.R[j], 1 / max(sn * sn, 1e-4));
  // the phase of the wave along the tube, 0 at the closed end and 1 at the top: it is the cumulative wave number, and it is not a straight line when the gas is not uniform
  const t = S.tau, ga = GRAD_A * sin((2 * PI * t) / GRAD1[j][0] + GRAD1[j][1]), gb = GRAD_B * sin((2 * PI * t) / GRAD2[j][0] + GRAD2[j][1]), ph = S.ph;
  let tot = 0;
  for (let i = N - 1; i >= 0; i--) {
    const x = 2 * ((i + 0.5) / N) - 1;
    const w = 1 + ga * x + gb * (1 - x * x - 2 / 3);
    ph[i] = tot + 0.5 * w;
    tot += w;
  }
  for (let i = 0; i < N; i++) {
    const s = sin((PI * n * ph[i]) / tot);
    const e = P * s * s + 0.02;
    E[i] = e;
    G[i] = sm(E_LO, E_LO + E_SPAN, e);
  }
  V[0] = 0;
  V[N] = 0;
  for (let i = 1; i < N; i++) V[i] = -V0 * 0.5 * (G[i - 1] + G[i]) * tanh(((E[i] - E[i - 1]) / DX) / GRAD0);
}

function stepTube(S, j, dt) {
  const h = S.h[j], a = S.a[j], G = S.G[j], V = S.V[j], F = S.F, F2 = S.F2;
  const fall = 1 - exp(-dt / TAU_F), r = dt / DX;
  for (let i = 0; i < N; i++) {
    const up = h[i] * (1 - exp((-G[i] * dt) / TAU_L)), dn = a[i] * fall;
    h[i] += dn - up;
    a[i] += up - dn;
  }
  for (let i = 1; i < N; i++) {
    const v = V[i];
    F[i] = (v > 0 ? v * a[i - 1] : v * a[i]) - (DA * (a[i] - a[i - 1])) / DX;
    const hf = min(0.5 * (h[i - 1] + h[i]), HCAP), sl = (h[i] - h[i - 1]) / DX, ex = abs(sl) - REPOSE;
    F2[i] = -KAP * hf * sl - (ex > 0 ? AVA * hf * ex * (sl > 0 ? 1 : -1) : 0);
  }
  F[0] = F[N] = F2[0] = F2[N] = 0;
  for (let i = 0; i < N; i++) {
    a[i] -= r * (F[i + 1] - F[i]);
    h[i] -= r * (F2[i + 1] - F2[i]);
    if (a[i] < 0) a[i] = 0;
    if (h[i] < 0) h[i] = 0;
  }
}

function advance(S, dt, kn, subs) {
  S.tau += dt;
  const k2 = cl(kn[1], 0, 4), a2 = Math.pow(2, 1.6 * cl(kn[2], -1, 1));
  S.theta += (OMEGA * k2 * dt) / (1 + SLOWDOWN * S.R.reduce((m, v) => (v > m ? v : m), 0));
  modesOf(S, kn);
  const ds = dt / subs;
  for (let j = 0; j < NT; j++) {
    fieldsOf(S, j, a2);
    for (let s = 0; s < subs; s++) stepTube(S, j, ds);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  if (!S.ready) {
    S.ready = true;
    const pre = [kn[0], max(1.2, kn[1]), kn[2], kn[3]];
    modesOf(S, pre);
    for (let t = 0; t < PREROLL; t += PRE_DT) advance(S, PRE_DT, pre, 3);
  }
  advance(S, d, kn, 4);
}

// ---- colour
const RAMP = [
  [0.0, 62, 50, 42],
  [0.6, 94, 74, 58],
  [1.5, 132, 104, 76],
  [3.0, 178, 150, 108],
  [6.0, 214, 194, 156],
];
function rampAt(t, out) {
  let k = 0;
  while (k < RAMP.length - 2 && t > RAMP[k + 1][0]) k++;
  const a = RAMP[k], b = RAMP[k + 1], u = cl((t - a[0]) / (b[0] - a[0]), 0, 1);
  out[0] = a[1] + (b[1] - a[1]) * u;
  out[1] = a[2] + (b[2] - a[2]) * u;
  out[2] = a[3] + (b[3] - a[3]) * u;
}

function hueMatrix(S, hue) {
  if (S.hueAt === hue) return;
  const A = 2 * PI * hue, c = cos(A), s = sin(A), m = S.hueMat;
  m[0] = 0.213 + c * 0.787 - s * 0.213; m[1] = 0.715 - c * 0.715 - s * 0.715; m[2] = 0.072 - c * 0.072 + s * 0.928;
  m[3] = 0.213 - c * 0.213 + s * 0.143; m[4] = 0.715 + c * 0.285 + s * 0.14; m[5] = 0.072 - c * 0.072 - s * 0.283;
  m[6] = 0.213 - c * 0.213 - s * 0.787; m[7] = 0.715 - c * 0.715 + s * 0.715; m[8] = 0.072 + c * 0.928 + s * 0.072;
  S.hueAt = hue;
}

const BOW = 1.3;
const GROUND = [8, 44, 50], GAP = [1, 3, 4], GLOW = [14, 84, 88], HAZE = [176, 128, 80];
const TINT = [[1.0, 0.98, 0.95], [1.05, 1.0, 0.86], [0.94, 0.93, 0.93]]; // cork, ochre and umber dust in the three tubes

function samp(arr, s) {
  const x = s / DX - 0.5, i = floor(x), f = x - i;
  const a = arr[i < 0 ? 0 : i >= N ? N - 1 : i], b = arr[i + 1 < 0 ? 0 : i + 1 >= N ? N - 1 : i + 1];
  return a + (b - a) * f;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const hue = cl(S.kn[0], 0, 1);
  hueMatrix(S, hue);
  const m = S.hueMat, col = [0, 0, 0];
  const put = (x, y, r, g, b) => {
    const R = r * m[0] + g * m[1] + b * m[2], G = r * m[3] + g * m[4] + b * m[5], B = r * m[6] + g * m[7] + b * m[8];
    display.setPixel(x, y, cl(R, 0, 255) | 0, cl(G, 0, 255) | 0, cl(B, 0, 255) | 0);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, GAP[0], GAP[1], GAP[2]);
  for (let j = 0; j < NT; j++) {
    const Hf = S.h[j], Af = S.a[j], Ef = S.E[j];
    const tilt = 0.5 * sin(0.23 * S.tau + 2.1 * j), tn = TINT[j];
    for (let r = 0; r < TL; r++) {
      const py = Y0 + r;
      for (let c = 0; c < TW; c++) {
        const u = (c + 0.5 - TW / 2) / (TW / 2), u2 = u * u;
        let sp = r + 0.5 + BOW * (1 - u2) + tilt * u;
        sp = cl(sp, 0.01, TL - 0.01);
        const h = samp(Hf, sp), a = samp(Af, sp), e = samp(Ef, sp);
        const z0 = samp(Hf, cl(sp - 0.6, 0, TL)), z1 = samp(Hf, cl(sp + 0.6, 0, TL));
        const dz = (z1 / (1 + 0.12 * z1) - z0 / (1 + 0.12 * z0)) / 1.2;
        const prof = 1 - 0.85 * u2;
        const t = h * prof - 0.12;
        const cover = sm(0, 0.35, t);
        const gl = (1 - exp(-e / 6)) * 0.3;
        const gk = 0.86 + 0.14 * sqrt(1 - u2 * 0.98);
        let rr = GROUND[0] * gk + GLOW[0] * gl, gg = GROUND[1] * gk + GLOW[1] * gl, bb = GROUND[2] * gk + GLOW[2] * gl;
        if (cover > 0) {
          rampAt(max(t, 0), col);
          const nd = (0.62 * dz * 1.6 + 0.78) / sqrt(1 + dz * dz * 2.56);
          const sh = cl(nd / 0.78, 0.45, 1.14);
          rr += (col[0] * tn[0] * sh - rr) * cover;
          gg += (col[1] * tn[1] * sh - gg) * cover;
          bb += (col[2] * tn[2] * sh - bb) * cover;
        }
        const hz = (1 - exp(-2.4 * a)) * (1 - 0.35 * u2) * 0.7;
        rr += HAZE[0] * hz;
        gg += HAZE[1] * hz;
        bb += HAZE[2] * hz;
        put(TX[j] + c, py, rr, gg, bb);
      }
    }
  }
}
