// ===== Patternflow pattern =====
// Title:   Phased Array
// Family:  phasedarray
// Idea:    A row of beads on the bottom edge plays one wave with each bead a little later than the one beside it, and above them a single bright beam leans over without anything turning, with crests running along it, faint fans of sidelobes beside it and dark nulls between.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: steering a beam by the delay between neighbouring transmitters (Ferdinand Braun, 1905, with three antennas); the Dolph-Chebyshev amplitude taper that trades beam width for sidelobe level (C. L. Dolph, 1946); grating lobes of a sparse array, pattern round 221
// Round:   221
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Scan=0..4, Spacing=0.5..1.6, Taper=-1..1
//
// Knob 1: Hue. Turns the whole picture round the colour wheel. At 0 the ground is indigo, the beam azure to pale cyan, the crests cyan-white and the troughs and sidelobes violet and magenta.
// Knob 2: Scan.
// Knob 3: Spacing.
// Knob 4: Taper.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, abs, exp, sin, cos, PI, min, max, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the array
const NM = 9; // elements run from -NM to NM, 19 at most, centre one at x = 32
const NE = 2 * NM + 1;
const CX = 32, AY = 126; // the line the elements sit on
const HALF = 32, EDGE = 34.5; // elements fade out between |x - 32| = HALF and EDGE
const TABN = 4096, TMASK = TABN - 1;
const COS = new Float32Array(TABN), SIN = new Float32Array(TABN);
for (let i = 0; i < TABN; i++) {
  COS[i] = cos((2 * PI * i) / TABN);
  SIN[i] = sin((2 * PI * i) / TABN);
}
const PHASE_SPEED = 7; // LEDs a second the crests run
const IREF = 1 / (2 * 55); // intensity of a unit-drive beam 55 LEDs out

// ---- the scan
const STEP = 11; // degrees between dwell angles
const BETA = [[22, 37.3, 0.7], [14, 61.1, 2.9], [8, 97.7, 4.6]]; // amplitude in degrees, period in s, phase
const THMAX = 56;
const sc0 = 3.0;
function betaOf(sc) {
  let b = 0;
  for (let i = 0; i < BETA.length; i++) b += BETA[i][0] * sin((2 * PI * sc) / BETA[i][1] + BETA[i][2]);
  return b;
}
function targetOf(sc, off) {
  const u = (betaOf(sc) + off) / STEP, i = floor(u), f = u - i;
  return cl(STEP * (i + sm(0.42, 0.58, f)), -THMAX, THMAX);
}

function makeState() {
  return {
    ready: false, t: 0, sc: sc0, off: 0, nextEv: sc0 + 20,
    th: 0, vel: 0,
    kn: [0, 2, 0.5, 0.06],
    d: -1, lam: 8,
    rt: new Float32Array(NE * NPX), at: new Float32Array(NE * NPX),
    Zr: new Float32Array(NPX), Zi: new Float32Array(NPX),
    G: new Float32Array(NPX), C: new Float32Array(NPX), V: new Float32Array(NPX),
    w: new Float32Array(NE), xs: new Float32Array(NE), ph: new Float32Array(NE),
    hueMat: new Float32Array(9), hueAt: -1,
  };
}

export function setup(params) {
  params.s = makeState();
}

function lambdaOf(ds) {
  return 8.2 - (2.0 * (ds - 0.5)) / 1.1;
}

// Distances from every LED to every element, rebuilt only when the spacing moves.
function buildTables(S, ds) {
  const lam = lambdaOf(ds), d = ds * lam;
  S.lam = lam;
  S.d = d;
  for (let n = 0; n < NE; n++) {
    const x0 = CX + (n - NM) * d;
    S.xs[n] = x0;
    for (let y = 0; y < H; y++) {
      const dy = y + 0.5 - AY;
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - x0;
        const r = max(1.3, sqrt(dx * dx + dy * dy));
        const i = n * NPX + y * W + x;
        S.rt[i] = (r * TABN) / lam;
        S.at[i] = 1 / sqrt(r);
      }
    }
  }
}

// Element weights: a raised cosine on a pedestal, uniform at -1, Hamming at about -0.3, Hann near 0.1, cos^4.6 at 1.
function weights(S, taper) {
  const s = (cl(taper, -1, 1) + 1) / 2;
  let a, m;
  if (s <= 0.35) { a = 1 - 0.92 * (s / 0.35); m = 2; }
  else if (s <= 0.6) { a = 0.08 * (1 - (s - 0.35) / 0.25); m = 2; }
  else { a = 0; m = 2 + (2.6 * (s - 0.6)) / 0.4; }
  let tot = 0;
  for (let n = 0; n < NE; n++) {
    const dx = abs(S.xs[n] - CX);
    const u = min(1, dx / EDGE);
    const edge = 1 - sm(HALF, EDGE, dx);
    const c = cos((PI * u) / 2);
    const wv = (a + (1 - a) * Math.pow(c < 0 ? 0 : c, m)) * edge;
    S.w[n] = wv;
    tot += wv;
  }
  for (let n = 0; n < NE; n++) S.w[n] /= tot;
}

function advance(S, dt, kn) {
  S.t += dt;
  const rate = Math.pow(cl(kn[1], 0, 4) / 2, 2);
  S.sc += dt * rate;
  if (rate > 0 && S.sc >= S.nextEv) {
    S.off = (Math.random() * 2 - 1) * 16;
    S.nextEv = S.sc + 18 + Math.random() * 40;
  }
  const target = targetOf(S.sc, S.off);
  const w0 = 5 + 3 * sqrt(rate);
  const acc = w0 * w0 * (target - S.th) - 2 * w0 * S.vel;
  S.vel += acc * dt;
  S.th += S.vel * dt;
  S.th = cl(S.th, -THMAX - 4, THMAX + 4);

  const ds = cl(kn[2], 0.5, 1.6);
  if (S.d < 0 || abs(lambdaOf(ds) * ds - S.d) > 1e-4) buildTables(S, ds);
  weights(S, kn[3]);

  // the delay: element n leads by k d n sin(theta)
  const sinT = sin((S.th * PI) / 180);
  const Zr = S.Zr, Zi = S.Zi;
  Zr.fill(0);
  Zi.fill(0);
  const phs = (TABN * S.d * sinT) / S.lam;
  for (let n = 0; n < NE; n++) {
    const wn = S.w[n];
    const p = phs * (n - NM) + TABN * 64;
    S.ph[n] = p;
    if (wn < 1e-4) continue;
    const base = n * NPX, rt = S.rt, at = S.at;
    for (let i = 0; i < NPX; i++) {
      const idx = (rt[base + i] + p) & TMASK;
      const a = wn * at[base + i];
      Zr[i] += a * COS[idx];
      Zi[i] += a * SIN[idx];
    }
  }
  // the instantaneous field and the averaged intensity
  const om = (2 * PI * PHASE_SPEED) / S.lam * S.t;
  const co = cos(om), si = sin(om);
  const G = S.G, C = S.C;
  for (let i = 0; i < NPX; i++) {
    const zr = Zr[i], zi = Zi[i];
    const I = 0.5 * (zr * zr + zi * zi);
    const db = 4.3429 * log(I / IREF + 1e-5);
    G[i] = cl((db + 38) / 44, 0, 1);
    const f = zr * co + zi * si;
    C[i] = f;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0.5, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  if (!S.ready) {
    S.ready = true;
    S.th = targetOf(S.sc, S.off);
  }
  advance(S, d, kn);
}

// ---- colour
const RAMP = [
  [0.0, 4, 4, 20],
  [0.18, 38, 10, 66],
  [0.38, 30, 26, 118],
  [0.62, 20, 76, 180],
  [0.82, 40, 160, 220],
  [1.0, 130, 228, 240],
];
const LUTN = 256;
const GLUT = new Float32Array((LUTN + 1) * 3);
for (let i = 0; i <= LUTN; i++) {
  const t = i / LUTN;
  let k = 0;
  while (k < RAMP.length - 2 && t > RAMP[k + 1][0]) k++;
  const a = RAMP[k], b = RAMP[k + 1], u = cl((t - a[0]) / (b[0] - a[0]), 0, 1);
  GLUT[i * 3] = a[1] + (b[1] - a[1]) * u;
  GLUT[i * 3 + 1] = a[2] + (b[2] - a[2]) * u;
  GLUT[i * 3 + 2] = a[3] + (b[3] - a[3]) * u;
}
const CREST = [190, 246, 255], UNDER = [150, 28, 150];

function hueMatrix(S, hue) {
  if (S.hueAt === hue) return;
  const A = 2 * PI * hue, c = cos(A), s = sin(A), m = S.hueMat;
  m[0] = 0.213 + c * 0.787 - s * 0.213; m[1] = 0.715 - c * 0.715 - s * 0.715; m[2] = 0.072 - c * 0.072 + s * 0.928;
  m[3] = 0.213 - c * 0.213 + s * 0.143; m[4] = 0.715 + c * 0.285 + s * 0.14; m[5] = 0.072 - c * 0.072 - s * 0.283;
  m[6] = 0.213 - c * 0.213 - s * 0.787; m[7] = 0.715 - c * 0.715 + s * 0.715; m[8] = 0.072 + c * 0.928 + s * 0.072;
  S.hueAt = hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const hue = cl(S.kn[0], 0, 1);
  hueMatrix(S, hue);
  const m = S.hueMat;
  const G = S.G, C = S.C;
  const R = new Float32Array(NPX), Gc = new Float32Array(NPX), B = new Float32Array(NPX);
  for (let i = 0; i < NPX; i++) {
    const g = G[i], gi = g * LUTN, k = gi | 0, fr = gi - k;
    const j = k * 3;
    let r = GLUT[j] + (GLUT[j + 3] - GLUT[j]) * fr;
    let gg = GLUT[j + 1] + (GLUT[j + 4] - GLUT[j + 1]) * fr;
    let b = GLUT[j + 2] + (GLUT[j + 5] - GLUT[j + 2]) * fr;
    const f = C[i];
    const c = cl(f / 0.2, -1, 1);
    const vis = sm(0.1, 0.55, g);
    if (c > 0) {
      const p = Math.pow(c, 1.5) * vis;
      r += (CREST[0] - r) * p;
      gg += (CREST[1] - gg) * p;
      b += (CREST[2] - b) * p;
    } else {
      const p = -c * vis;
      r = r * (1 - 0.6 * p) + UNDER[0] * p * p;
      gg = gg * (1 - 0.6 * p) + UNDER[1] * p * p;
      b = b * (1 - 0.6 * p) + UNDER[2] * p * p;
    }
    R[i] = r; Gc[i] = gg; B[i] = b;
  }
  for (let i = 0; i < NPX; i++) {
    const r = R[i], g = Gc[i], b = B[i];
    const rr = r * m[0] + g * m[1] + b * m[2], gg = r * m[3] + g * m[4] + b * m[5], bb = r * m[6] + g * m[7] + b * m[8];
    display.setPixel(i % W, (i / W) | 0, cl(rr, 0, 255) | 0, cl(gg, 0, 255) | 0, cl(bb, 0, 255) | 0);
  }
}
