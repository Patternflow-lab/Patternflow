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
const CX = 32, AY = 126.5; // the line the elements sit on
const AH = 20; // half the width the elements are driven over
const TABN = 4096, TMASK = TABN - 1;
const COS = new Float32Array(TABN), SIN = new Float32Array(TABN);
for (let i = 0; i < TABN; i++) {
  COS[i] = cos((2 * PI * i) / TABN);
  SIN[i] = sin((2 * PI * i) / TABN);
}
const BASE_ROWS = 10; // the rows, from the bottom, that carry the faint glow along the line of elements
const PHASE_SPEED = 7; // LEDs a second the crests run
const IREF = 1 / (2 * 55); // intensity of a unit-drive beam 55 LEDs out
const ZREF = 1 / sqrt(55);

// ---- the scan
const STEP = 11; // degrees between dwell angles, before the jitter
const BETA = [[22, 29.3, 0.7], [14, 47.1, 2.9], [9, 73.7, 4.6]]; // amplitude in degrees, period in s, phase
const WOB = [[1.4, 8.3, 0.4], [0.9, 13.7, 3.1]]; // the beam never quite stands still on a dwell
const THMAX = 56;
const HAND = 2.2; // seconds a hand-over takes at Scan 2
function betaOf(sc) {
  let b = 0;
  for (let i = 0; i < BETA.length; i++) b += BETA[i][0] * sin((2 * PI * sc) / BETA[i][1] + BETA[i][2]);
  return b;
}
// the dwell angles are 11 degrees apart give or take 4, so the beam does not keep returning to the same few directions
const level = (i) => STEP * i + 2.6 * sin(1.7 * i + 0.4) + 1.6 * sin(2.9 * i + 1.3);
function wobOf(sc) {
  let wob = 0;
  for (let k = 0; k < WOB.length; k++) wob += WOB[k][0] * sin((2 * PI * sc) / WOB[k][1] + WOB[k][2]);
  return wob;
}
function targetOf(sc, off) {
  const u = (betaOf(sc) + off) / STEP, i = floor(u), f = u - i;
  const l0 = level(i), l1 = level(i + 1);
  return cl(l0 + (l1 - l0) * sm(0.42, 0.58, f) + wobOf(sc), -THMAX, THMAX);
}

function makeState() {
  return {
    ready: false, t: 0, sc: 0, off: 0, nextEv: 24,
    th: 0, vel: 0, hv: -1, thB: 0,
    kn: [0, 2, 0.5, 0.06],
    d: -1, lam: 8, lamE: 8, ah: AH, mMul: 1, cph: 0,
    rt: new Float32Array(NE * NPX), at: new Float32Array(NE * NPX),
    Zr: new Float32Array(NPX), Zi: new Float32Array(NPX),
    G: new Float32Array(NPX), C: new Float32Array(NPX), px: new Float32Array(NPX * 3),
    w: new Float32Array(NE), xs: new Float32Array(NE), cr: new Float32Array(NE), ci: new Float32Array(NE),
    base: new Float32Array(BASE_ROWS * W),
    hueMat: new Float32Array(9), hueAt: -1,
  };
}

export function setup(params) {
  params.s = makeState();
}

function lambdaOf(ds) {
  return 8 - (2.0 * (ds - 0.5)) / 1.1;
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
        S.rt[i] = r;
        S.at[i] = 1 / sqrt(r);
      }
    }
  }
}

// Element weights: cos(pi u / 2)^m across the driven width, u = |x - 32| / AH. m is 0 at -1 (uniform),
// 1.15 at the opening, 2 at 0.35 (Hann), 6 at 1.
function weights(S, taper) {
  const s = (cl(taper, -1, 1) + 1) / 2;
  const m = ((6 * (Math.pow(2, 7 * s) - 1)) / 127) * S.mMul, AH = S.ah;
  let tot = 0;
  for (let n = 0; n < NE; n++) {
    const dx = abs(S.xs[n] - CX);
    const u = min(1, dx / AH);
    const edge = 1 - sm(AH - 0.5 * S.d, AH + 0.5 * S.d, dx);
    const c = cos((PI * u) / 2);
    const wv = (m < 1e-3 ? 1 : Math.pow(c < 0 ? 0 : c, m)) * edge;
    S.w[n] = wv;
    tot += wv;
  }
  for (let n = 0; n < NE; n++) S.w[n] /= tot;
}

function startHandover(S) {
  // a second beam comes up at a new direction while the first goes down, 20 degrees or more away
  let i = 0, th = 0;
  for (let k = 0; k < 8; k++) {
    i = Math.round((Math.random() * 2 - 1) * 4.2);
    th = level(i);
    if (abs(th - S.th) >= 20 && abs(th) <= 48) break;
  }
  S.thB = th;
  S.iB = i;
  S.hv = 0;
}

function endHandover(S) {
  S.th = S.thB;
  S.vel = 0;
  S.off = (S.iB + 0.2) * STEP - betaOf(S.sc);
  S.hv = -1;
  S.nextEv = S.sc + 22 + Math.random() * 48;
}

function advance(S, dt, kn) {
  S.t += dt;
  const rate = Math.pow(cl(kn[1], 0, 4) / 2, 2);
  S.sc += dt * rate;
  if (rate > 0 && S.hv < 0 && S.sc >= S.nextEv) startHandover(S);
  if (S.hv >= 0) {
    S.hv += (dt * max(rate, 0.3)) / HAND;
    if (S.hv >= 1) endHandover(S);
  }
  const target = targetOf(S.sc, S.off);
  const w0 = 5 + 3 * sqrt(rate);
  const acc = w0 * w0 * (target - S.th) - 2 * w0 * S.vel;
  S.vel += acc * dt;
  S.th += S.vel * dt;
  S.th = cl(S.th, -THMAX - 4, THMAX + 4);

  // slow drifts of the width, the taper and the frequency, so the beam's shape never settles
  const t = S.t, T2 = 2 * PI * t;
  S.ah = AH * (1 + 0.16 * sin(T2 / 67.1 + 1.1) + 0.1 * sin(T2 / 109.3 + 4.2));
  S.mMul = Math.pow(2, 0.55 * sin(T2 / 83.7 + 2.0) + 0.3 * sin(T2 / 139.1 + 0.3));
  S.lamE = S.lam * (1 + 0.13 * sin(T2 / 71.3 + 0.9) + 0.08 * sin(T2 / 113.7 + 2.4));
  S.cph += (2 * PI * PHASE_SPEED * dt) / S.lamE;
  const ds = cl(kn[2], 0.5, 1.6);
  if (S.d < 0 || abs(lambdaOf(ds) * ds - S.d) > 1e-4) buildTables(S, ds);
  weights(S, kn[3]);

  // the delay: element n leads by k d n sin(theta). During a hand-over two delays are summed.
  const kd = (2 * PI * S.d) / S.lamE, kk = TABN / S.lamE;
  const sA = sin((S.th * PI) / 180), sB = sin((S.thB * PI) / 180);
  const hs = S.hv < 0 ? 0 : sm(0, 1, S.hv);
  const wa = cos((PI / 2) * hs), wb = sin((PI / 2) * hs);
  const Zr = S.Zr, Zi = S.Zi;
  Zr.fill(0);
  Zi.fill(0);
  for (let n = 0; n < NE; n++) {
    const pA = kd * (n - NM) * sA, pB = kd * (n - NM) * sB;
    const cr = wa * cos(pA) + wb * cos(pB), ci = wa * sin(pA) + wb * sin(pB);
    S.cr[n] = cr;
    S.ci[n] = ci;
    const wn = S.w[n];
    if (wn < 1e-4) continue;
    const wr = wn * cr, wi = wn * ci;
    const base = n * NPX, rt = S.rt, at = S.at;
    for (let i = 0; i < NPX; i++) {
      const idx = (rt[base + i] * kk) & TMASK;
      const a = at[base + i], c = COS[idx], s2 = SIN[idx];
      Zr[i] += a * (wr * c - wi * s2);
      Zi[i] += a * (wr * s2 + wi * c);
    }
  }
  // the faint glow along the line of elements, as wide as the driven part of the row
  const bs = S.base;
  for (let r = 0; r < BASE_ROWS; r++) {
    const y = H - BASE_ROWS + r, v = 0.36 * exp(-max(0, AY - y - 0.5) / 2.2);
    for (let x = 0; x < W; x++) bs[r * W + x] = v * (1 - sm(S.ah, S.ah + 7, abs(x + 0.5 - CX)));
  }
  // the instantaneous field and the averaged intensity
  const om = S.cph;
  const co = cos(om), si = sin(om);
  const G = S.G, C = S.C, B0 = (H - BASE_ROWS) * W;
  for (let i = 0; i < NPX; i++) {
    const zr = Zr[i], zi = Zi[i];
    const I = 0.5 * (zr * zr + zi * zi);
    const db = 4.3429 * log(I / IREF + 1e-5);
    const gv = Math.pow(cl((db + 31) / 34, 0, 1), 1.35);
    const bv = i >= B0 ? bs[i - B0] : 0;
    G[i] = gv > bv ? gv : bv;
    const zm = sqrt(zr * zr + zi * zi) + 1e-9;
    const A = min(1, 1.1 * Math.pow(zm / ZREF, 0.6));
    C[i] = ((zr * co + zi * si) / zm) * A;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0.5, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  if (!S.ready) {
    S.ready = true;
    S.th = targetOf(S.sc, S.off);
    S.thB = S.th;
  }
  advance(S, d, kn);
}

// ---- colour
const RAMP = [
  [0.0, 3, 3, 16],
  [0.18, 30, 8, 58],
  [0.38, 30, 22, 108],
  [0.62, 18, 62, 168],
  [0.84, 26, 118, 214],
  [1.0, 80, 188, 240],
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
const CREST = [225, 252, 255], CREST_LO = [96, 128, 246], UNDER = [140, 24, 150];

function hueMatrix(S, hue) {
  if (S.hueAt === hue) return;
  const A = 2 * PI * hue, c = cos(A), s = sin(A), m = S.hueMat;
  m[0] = 0.213 + c * 0.787 - s * 0.213; m[1] = 0.715 - c * 0.715 - s * 0.715; m[2] = 0.072 - c * 0.072 + s * 0.928;
  m[3] = 0.213 - c * 0.213 + s * 0.143; m[4] = 0.715 + c * 0.285 + s * 0.14; m[5] = 0.072 - c * 0.072 - s * 0.283;
  m[6] = 0.213 - c * 0.213 - s * 0.787; m[7] = 0.715 - c * 0.715 + s * 0.715; m[8] = 0.072 + c * 0.928 + s * 0.072;
  S.hueAt = hue;
}

// colour of one LED from its glow g (0..1, the averaged intensity) and its crest value c (-1..1, the wave now)
function shade(g, c, out) {
  const gi = (g > 0.9999 ? 0.9999 : g) * LUTN, k = gi | 0, fr = gi - k, j = k * 3;
  let r = GLUT[j] + (GLUT[j + 3] - GLUT[j]) * fr;
  let gg = GLUT[j + 1] + (GLUT[j + 4] - GLUT[j + 1]) * fr;
  let b = GLUT[j + 2] + (GLUT[j + 5] - GLUT[j + 2]) * fr;
  if (c > 0) {
    const p = Math.pow(c, 1.7), h = sm(0.35, 0.85, g);
    r += (CREST_LO[0] + (CREST[0] - CREST_LO[0]) * h - r) * p;
    gg += (CREST_LO[1] + (CREST[1] - CREST_LO[1]) * h - gg) * p;
    b += (CREST_LO[2] + (CREST[2] - CREST_LO[2]) * h - b) * p;
  } else {
    const p = -c, q = p * p * 0.5;
    r = r * (1 - 0.55 * p) + UNDER[0] * q;
    gg = gg * (1 - 0.55 * p) + UNDER[1] * q;
    b = b * (1 - 0.55 * p) + UNDER[2] * q;
  }
  out[0] = r; out[1] = gg; out[2] = b;
}

const BEAD_ROWS = [0.3, 0.8, 1, 1]; // rows 124 to 127
const BEAD0 = [70, 30, 150];
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const hue = cl(S.kn[0], 0, 1);
  hueMatrix(S, hue);
  const m = S.hueMat;
  const G = S.G, C = S.C, px = S.px, col = [0, 0, 0];
  for (let i = 0; i < NPX; i++) {
    shade(G[i], C[i], col);
    px[i * 3] = col[0]; px[i * 3 + 1] = col[1]; px[i * 3 + 2] = col[2];
  }
  // the elements: a bead two LEDs wide each, glowing with its own phase
  let wmax = 0;
  for (let n = 0; n < NE; n++) if (S.w[n] > wmax) wmax = S.w[n];
  const om = S.cph;
  for (let n = 0; n < NE; n++) {
    const wr = S.w[n] / wmax;
    if (wr < 0.004) continue;
    const xb = S.xs[n], cr = S.cr[n], ci = S.ci[n], mag = sqrt(cr * cr + ci * ci);
    const u = 0.5 + 0.5 * cos(om - Math.atan2(ci, cr)), amp = (0.3 + 0.7 * Math.sqrt(wr)) * (0.45 + 0.55 * mag);
    const v = u * u * (3 - 2 * u) * amp;
    col[0] = BEAD0[0] + (CREST[0] - BEAD0[0]) * v;
    col[1] = BEAD0[1] + (CREST[1] - BEAD0[1]) * v;
    col[2] = BEAD0[2] + (CREST[2] - BEAD0[2]) * v;
    for (let x = max(0, floor(xb - 1.6)); x <= min(W - 1, floor(xb + 1.6)); x++) {
      const cx = cl(1.5 - abs(x + 0.5 - xb), 0, 1);
      if (cx <= 0) continue;
      for (let r = 0; r < 4; r++) {
        const cov = cx * BEAD_ROWS[r], i = (124 + r) * W + x;
        px[i * 3] += (col[0] - px[i * 3]) * cov;
        px[i * 3 + 1] += (col[1] - px[i * 3 + 1]) * cov;
        px[i * 3 + 2] += (col[2] - px[i * 3 + 2]) * cov;
      }
    }
  }
  for (let i = 0; i < NPX; i++) {
    const r = px[i * 3], g = px[i * 3 + 1], b = px[i * 3 + 2];
    const rr = r * m[0] + g * m[1] + b * m[2], gg = r * m[3] + g * m[4] + b * m[5], bb = r * m[6] + g * m[7] + b * m[8];
    display.setPixel(i % W, (i / W) | 0, cl(rr, 0, 255) | 0, cl(gg, 0, 255) | 0, cl(bb, 0, 255) | 0);
  }
}
