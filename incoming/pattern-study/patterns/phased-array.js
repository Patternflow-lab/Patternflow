// ===== Patternflow pattern =====
// Title:   Phased Array
// Family:  phasedarray
// Idea:    A row of beads on the bottom edge plays one wave with each bead a little later than the next, and above them a single beam leans away from straight up without anything turning, its crests running along it, with faint fans of sidelobes beside it and dark nulls between them.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: steering a beam by the delay between neighbouring transmitters (Ferdinand Braun, 1905, with three antennas), and the grating lobes that a sparse row adds to it, pattern round 221
// Round:   221
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Scan=0..4, Spacing=0.5..1.6, Taper=-1..1
//
// Knob 1: Hue. Turns the palette round the colour wheel. At 0 the ground is deep indigo, the sidelobe fans are violet with a magenta edge, the beam is blue to azure and its crests cyan-white; at 0.25 the beam is pink, at 0.5 amber, at 0.75 green, and at 1 it is back where it began.
// Knob 2: Scan. How fast the beam scans, the pace going as (knob / 2) squared: 0 holds the beam where it is, 2 (the opening) is the pace described here, 4 is four times faster. At 2 the beam dwells a few seconds on a direction and leans to the next in about 1 s. The dwell angles are 11 degrees apart give or take 4 and are picked by a sum of three sines of 36.7, 58.9 and 92.1 s, so the same sweep does not come twice. Every 22 to 70 s a second beam rises at a new angle at least 20 degrees away while the first fades out, 2.2 s for the hand-over. The beam reaches 56 degrees either side of straight up, where the wedge lies along the bottom of the panel, and spends most of its time inside 35.
// Knob 3: Spacing. The distance between neighbouring beads in wavelengths, d over lambda, from 0.5 to 1.6. At 0.5, where it opens, 9 beads 3.25 LEDs apart play a wavelength that wanders between 6.5 and 7.8 LEDs, and there is one beam. Across the knob the wavelength shortens to 5.5 to 6.6 LEDs while the driven width stays 28 LEDs, so the beads thin out to 3, 8.8 LEDs apart, at 1.6. A grating lobe, a copy of the beam at full strength, leaves at sin(theta) = sin(theta0) minus lambda/d once d/lambda passes 1/(1 + |sin(theta0)|): never at 0.5, at 0.6 for a beam leaning past 42 degrees, at 1.6 as a pair of beams 39 to 46 degrees either side of a straight one, nearer 39 when the wavelength is at its shortest.
// Knob 4: Taper. How the beads fade out from the middle of the row. A bead plays at cos(pi u / 2) to the power m, u being its distance from the middle over the 14 LED half-width, and m runs from 0 at -1 to 4 at 1. At -1 every bead plays at full strength: the beam is 12 degrees wide and the sidelobes start at -13 dB, 19 degrees out, and go on in a ladder. At 0.06, where it opens, m is 0.38, the beam 13 degrees and the first sidelobe -18 dB at 21 degrees. At 0.7 the beam is 19 degrees and the first sidelobe -30 dB. At 1 it is 25 degrees and every sidelobe lies under -46 dB, so the dark fans are gone and what is left is a clean wedge. These are far-field widths for the nominal row at a wavelength of 6.5 LEDs; the width, the taper and the wavelength each breathe slowly, as described below.

// What the picture is. At most 25 beads sit on the line y = 126.5 at x = 32 + n d, n from -12 to 12, only the ones under the driven window playing, each a source of circular waves. The
// field at an LED, summed exactly over every bead, is
//   Z = sum over n of w_n c_n exp(i k r_n) / sqrt(r_n),     field = Re(Z exp(-i w t)),
// with r_n the distance from LED to bead (not less than 1.3 LEDs), w_n the taper and c_n the delay, c_n = exp(i k d n sin(theta)): bead n
// leads its neighbour by k d sin(theta), so the wavefronts of the beads line up along a tilted plane and the beam leans to theta with
// nothing turning. The row is only 28 LEDs wide, so the beam is a wedge about 33 LEDs across by the top of the panel and its crests are
// arcs that spread from the row, not straight bars. The distances and 1 / sqrt(r) are tabled for each LED and bead once and rebuilt only
// when Spacing moves (up to 17 ms a frame while the knob turns), and the sum is two table lookups a term, about 2 ms a frame for the 8192 LEDs.
// The picture shows two things at once. The glow is the intensity averaged over a wave, |Z|^2 / 2, in dB from -40 at black to +3 at the
// brightest ramp colour (0 dB is a unit-drive beam 55 LEDs from the row), bent by a power of 1.6 so the weak fans stay dark: deep indigo
// ground, violet-magenta, blue, azure, pale cyan. It is the beam pattern: the lit wedge, the sidelobes as violet fans and the nulls between
// them dark. On top of it run the crests, the field of this instant: cos(phase) times an amplitude factor that falls as the 0.8 power of
// the local amplitude, so the crests live inside the beam and the nearest sidelobes and the far haze stays free of them. Where the field is
// positive the glow turns cyan-white (lilac in the sidelobes), where it is negative the glow dims and a violet-magenta line shows. A faint
// haze, 0.03 at the top corners and 0.1 beside the row, keeps every LED lit. The beads at the bottom are two LEDs wide and glow with their
// own phase, so the phase runs along the row as the beam leans, and they fade toward the ends of the row with the taper.
// The scan is a sum of three sines quantised into dwells (every 11 degrees, with a jitter), smoothed by a critically damped follower, and
// a hand-over to a second beam at a random angle now and then. A slow quadratic delay across the row, q times 1.2 radians times u squared,
// focuses the beam to a waist about 80 LEDs out at its most positive (q = 0.9) or spreads it as if from a point 100 LEDs behind the row at
// its most negative (q = -0.7); it opens at -0.13. The width of the driven part of the row (14 LEDs half-width, plus or minus 28%), the
// taper (a factor up to 1.5 either way on m), the wavelength (1 to 1.15 times its nominal value, never shorter, so the opening spacing of
// 0.5 never lets a grating lobe in), the middle of the driven window (plus or minus 15 LEDs, so the whole wedge slides along the row) and q each drift on periods of 54 to 139 s that do not
// divide one another.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, abs, exp, sin, cos, PI, min, max, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the array
const NM = 12; // elements run from -NM to NM, 25 at most, centre one at x = 32
const NE = 2 * NM + 1;
const CX = 32, AY = 126.5; // the line the elements sit on
const AH = 14; // half the width the elements are driven over
const TABN = 4096, TMASK = TABN - 1;
const COS = new Float32Array(TABN), SIN = new Float32Array(TABN);
for (let i = 0; i < TABN; i++) {
  COS[i] = cos((2 * PI * i) / TABN);
  SIN[i] = sin((2 * PI * i) / TABN);
}
const Q0 = 1.2; // radians of curve across the row at the edge of the driven width for a curve of 1
// the faint far-field haze every LED keeps, brighter near the row and thinning with distance, so no corner goes dead black
const FLOOR = new Float32Array(NPX);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) FLOOR[y * W + x] = 0.025 + 0.07 * exp(-sqrt((x + 0.5 - 32) * (x + 0.5 - 32) + (y - 126) * (y - 126)) / 60);
const BASE_ROWS = 10; // the rows, from the bottom, that carry the faint glow along the line of elements
const PHASE_SPEED = 7; // LEDs a second the crests run
const IREF = 1 / (2 * 55); // intensity of a unit-drive beam 55 LEDs out
const ZREF = 1 / sqrt(55);

// ---- the scan
const STEP = 11; // degrees between dwell angles, before the jitter
const BETA = [[26, 36.7, 0.7], [17, 58.9, 2.9], [11, 92.1, 4.6]]; // amplitude in degrees, period in s, phase
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
    d: -1, lam: 8, lamE: 8, ah: AH, mMul: 1, cph: 0, shift: 0, q: -0.13,
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
  return 6.5 - (1.0 * (ds - 0.5)) / 1.1;
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

// Element weights: cos(pi u / 2)^m across the driven width, u = |x - 32| / AH. m is 0 at -1 (uniform), 0.54 at the opening and 4 at 1.
function weights(S, taper) {
  const s = (cl(taper, -1, 1) + 1) / 2;
  const m = ((4 * (Math.pow(2, 7 * s) - 1)) / 127) * S.mMul, ah = S.ah, cx = CX + S.shift;
  let tot = 0;
  for (let n = 0; n < NE; n++) {
    const dx = abs(S.xs[n] - cx);
    const u = min(1, dx / ah);
    const edge = 1 - sm(ah - 0.5 * S.d, ah + 0.5 * S.d, dx);
    const c = cos((PI * u) / 2);
    const wv = (m < 1e-3 ? 1 : Math.pow(c < 0 ? 0 : c, m)) * edge;
    S.w[n] = wv;
    tot += wv;
  }
  for (let n = 0; n < NE; n++) S.w[n] /= tot;
}

function startHandover(S) {
  // a second beam comes up at a new direction while the first goes down, at least 20 degrees away
  const ok = [];
  let far = 0, farD = -1;
  for (let i = -4; i <= 4; i++) {
    const th = level(i), dd = abs(th - S.th);
    if (dd >= 20 && abs(th) <= 52) ok.push(i);
    if (dd > farD) { farD = dd; far = i; }
  }
  const i = ok.length ? ok[floor(Math.random() * ok.length)] : far;
  S.iB = i;
  S.thB = level(i);
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
  S.th = cl(S.th, -THMAX, THMAX);

  // slow drifts of the width, the taper and the frequency, so the beam's shape never settles
  const t = S.t, T2 = 2 * PI * t;
  S.ah = AH * (1 + 0.17 * sin(T2 / 67.1 + 1.1) + 0.11 * sin(T2 / 109.3 + 4.2));
  S.mMul = Math.pow(2, 0.4 * sin(T2 / 83.7 + 2.0) + 0.2 * sin(T2 / 139.1 + 0.3));
  S.lamE = S.lam * (1.075 + 0.075 * (0.6 * sin(T2 / 71.3 + 0.9) + 0.4 * sin(T2 / 113.7 + 2.4)));
  S.shift = 15 * (0.6 * sin(T2 / 59.3 + 5.1) + 0.4 * sin(T2 / 97.9 + 0.8));
  S.q = cl(0.15 + 0.5 * sin(T2 / 53.7 - 0.4) + 0.3 * sin(T2 / 89.3 - 0.3), -0.7, 0.9);
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
    const uq = (S.xs[n] - CX - S.shift) / AH, pq = S.q * Q0 * uq * uq;
    const pA = kd * (n - NM) * sA + pq, pB = kd * (n - NM) * sB + pq;
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
    for (let x = 0; x < W; x++) bs[r * W + x] = v * (1 - sm(S.ah, S.ah + 7, abs(x + 0.5 - CX - S.shift)));
  }
  // the instantaneous field and the averaged intensity
  const om = S.cph;
  const co = cos(om), si = sin(om);
  const G = S.G, C = S.C, B0 = (H - BASE_ROWS) * W;
  for (let i = 0; i < NPX; i++) {
    const zr = Zr[i], zi = Zi[i];
    const I = 0.5 * (zr * zr + zi * zi);
    const db = 4.3429 * log(I / IREF + 1e-5);
    const gv = Math.pow(cl((db + 40) / 43, 0, 1), 1.6);
    const bv = i >= B0 ? bs[i - B0] : 0, fv = FLOOR[i] > bv ? FLOOR[i] : bv;
    G[i] = gv > fv ? gv : fv;
    const zm = sqrt(zr * zr + zi * zi) + 1e-9;
    const A = min(1, 1.2 * Math.pow(zm / ZREF, 0.8));
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
  [0.0, 3, 3, 15],
  [0.1, 8, 5, 34],
  [0.22, 32, 8, 70],
  [0.38, 60, 14, 112],
  [0.55, 36, 38, 152],
  [0.72, 22, 92, 204],
  [0.88, 40, 162, 232],
  [1.0, 110, 226, 246],
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
const CREST = [225, 252, 255], CREST_LO = [170, 96, 240], UNDER = [140, 24, 150];

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
    const p = sm(0.12, 0.92, c), h = sm(0.35, 0.85, g);
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

const BEAD_ROWS = [0.35, 0.85, 1, 1]; // rows 124 to 127
const BEAD0 = [96, 40, 190]; // a bead at the bottom of its swing, still lit so the row always reads
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
    const u = 0.5 + 0.5 * cos(om - Math.atan2(ci, cr)), amp = (0.4 + 0.6 * Math.sqrt(wr)) * (0.5 + 0.5 * mag);
    const v = u * u * (3 - 2 * u) * amp;
    col[0] = BEAD0[0] + (CREST[0] - BEAD0[0]) * v;
    col[1] = BEAD0[1] + (CREST[1] - BEAD0[1]) * v;
    col[2] = BEAD0[2] + (CREST[2] - BEAD0[2]) * v;
    for (let x = max(0, floor(xb - 1)); x <= min(W - 1, floor(xb + 1)); x++) {
      const cx = cl(min(x + 1, xb + 1) - max(x, xb - 1), 0, 1); // the bead is a box two LEDs wide
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
