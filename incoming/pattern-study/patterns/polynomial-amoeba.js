// ===== Patternflow pattern =====
// Title:   Polynomial Amoeba
// Family:  topology
// Idea:    The amoeba of a curve f(z, w) = 0 whose Newton polygon is a hexagon with three interior points, solved row by row as the image of its zeros under (log|z|, log|w|), breathes slowly between a fat starfish and the thin tropical ladder it shrinks onto, and its three stacked holes open and close by turns as the middle coefficients rise and fall.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: amoebas of polynomials (Israel Gelfand, Mikhail Kapranov and Andrei Zelevinsky, 1994), holes and interior lattice points (Mikael Forsberg, Mikael Passare and August Tsikh, 2000), amoebas of maximal area (Grigory Mikhalkin and Hans Rullgard, 2001), tropical limit (Grigory Mikhalkin, 2005), pattern round 64
// Round:   64
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Lift=-1..1, Phase=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together; at 0 the body is sea green, bluer along its diagonal tentacles, the holes are violet and the tropical curve a pale gold thread.
// Knob 2: Speed. How fast the tide of t runs: at 2 the amoeba goes from starfish to ladder and back in 22 seconds, at 0.2 in 3 minutes 40, at 3 in 15 seconds; the coefficients drift at the same pace.
// Knob 3: Lift. The size of the three middle coefficients, those of z w, z w^2 and z w^3: at -1 they are too small for any hole and the amoeba is a cross of tentacles, at 0 they rise and fall so the holes open and close by turns, at 1 all three stand wide open.
// Knob 4: Phase. The arguments of the coefficients: at 0 they are real with Harnack's signs (-1)^(ij), and the amoeba covers the most it can (Mikhalkin and Rullgard: a simple Harnack curve's amoeba has the largest area); turned up they spread round the circle, the body thins and the holes change size and slide.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, log, exp, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const SC = 7; // LEDs to one unit of log|z| or log|w|
const XC = 32, YC = 64;
const K = 64; // samples of arg w round each row's circle

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The Newton polygon: the hexagon (1,0) (2,1) (2,3) (1,4) (0,3) (0,1), with
// interior points (1,1), (1,2), (1,3). f is quadratic in z, so each row
// (fixed |w|) is solved with the quadratic formula.
const MON = [[0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [2, 1], [2, 2], [2, 3]];
const NM = MON.length;
const MI = MON.map((m) => m[0]), MJ = MON.map((m) => m[1]);
const INNER = [4, 5, 6];
const ALPHA = 1.4, BETA = 1.4;

export function setup(params) {
  const cs = new Float64Array((K + 1) * 5 * 2);
  for (let k = 0; k <= K; k++)
    for (let j = 0; j < 5; j++) {
      cs[(k * 5 + j) * 2] = cos((2 * PI * k * j) / K);
      cs[(k * 5 + j) * 2 + 1] = sin((2 * PI * k * j) / K);
    }
  const seed = MON.map((m, k) => (k * 0.618034 + 0.31) % 1);
  params.s = {
    cs, seed, t: 0, hue: 0, lift: 0, phase: 0, started: false,
    v: new Float64Array(NM), ph: new Float64Array(NM),
    cov: new Float32Array(N), F: new Float32Array(N * 3), h: 1,
  };
}

// The coefficients at tide time t: |c| = exp(h v) and arg c. The valuations v
// are a concave lift of the hexagon's points, so every point stands on the
// upper hull and the tropical curve is a ladder of three cells; the inner
// points' lifts wander, the outer ones drift a little.
function coefficients(S) {
  const t = S.t;
  // The tide of t: with c = t^v the amoeba drawn at scale 1 / log t shrinks
  // onto the tropical curve as t grows (Mikhalkin). h = log t swings between
  // 0.64 and 3.9; the panel opens near the fattest and thins for ten seconds.
  S.h = exp(0.45 + 0.9 * sin((2 * PI * (t - 5)) / 22));
  for (let m = 0; m < NM; m++) {
    const [i, j] = MON[m];
    const r = S.seed[m];
    let v = -(ALPHA * (i - 1) * (i - 1) + BETA * (j - 2) * (j - 2));
    // The middle point has the most neighbours pressing on its hole, so it
    // stands a little higher.
    if (INNER.includes(m)) v += (S.lift < 0 ? 1.9 : 1.2) * S.lift + 0.45 * sin(t * (0.21 + 0.05 * (m - 5)) + 1.3 + 2.1 * (m - 4)) - 0.1 + (m === 5 ? 0.35 : 0);
    else v += 0.35 * sin(t * (0.11 + 0.07 * r) + 6.28 * r);
    S.v[m] = v;
    // Harnack's signs, (-1)^(ij), and the Phase knob spreading the
    // arguments away from them.
    S.ph[m] = ((i * j) & 1 ? PI : 0) + S.phase * (PI * (2 * r - 1) * 1.6 + 0.25 * sin(t * 0.13 + 9 * r));
  }
}

export function update(dt, input, params) {
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt, 0, 0.1);
  S.hue = k[0];
  S.lift = cl(k[2], -1, 1);
  S.phase = cl(k[3], 0, 1);
  S.t += (dt * cl(k[1], 0.05, 3)) / 2;
}

// One row: |w| = exp(h Y). For each sample of arg w, the two roots z of
// A(w) + B(w) z + C(w) z^2 = 0, sorted by |z|. Each of the lower and upper
// root is continuous round the circle, so each sweeps one interval of
// x = log|z| / h, and the two intervals together are the row of the amoeba.
// Where the roots swap round the circle the two intervals overlap, and their
// union is still exact.
function row(S, y, cov) {
  const h = S.h, Y = (YC - y - 0.5) / SC;
  let top = -1e9;
  for (let m = 0; m < NM; m++) top = max(top, S.v[m] + MJ[m] * Y);
  const pr = S.pr, pi = S.pi;
  for (let m = 0; m < NM; m++) {
    const a = exp(h * (S.v[m] + MJ[m] * Y - top));
    pr[m] = a * cos(S.ph[m]);
    pi[m] = a * sin(S.ph[m]);
  }
  const cs = S.cs;
  // Squared moduli of the lower and upper root, their least and greatest.
  let loA = Infinity, loB = 0, hiA = Infinity, hiB = 0;
  const o = y * W;
  for (let x = 0; x < W; x++) cov[o + x] = 0;
  // A(w), B(w), C(w): the coefficients of z^0, z^1, z^2, by powers of w.
  const A1r = pr[0], A1i = pi[0], A2r = pr[1], A2i = pi[1], A3r = pr[2], A3i = pi[2];
  const B0r = pr[3], B0i = pi[3], B1r = pr[4], B1i = pi[4], B2r = pr[5], B2i = pi[5], B3r = pr[6], B3i = pi[6], B4r = pr[7], B4i = pi[7];
  const C1r = pr[8], C1i = pi[8], C2r = pr[9], C2i = pi[9], C3r = pr[10], C3i = pi[10];
  for (let k = 0; k <= K; k++) {
    const c0 = k * 10;
    const e1r = cs[c0 + 2], e1i = cs[c0 + 3], e2r = cs[c0 + 4], e2i = cs[c0 + 5];
    const e3r = cs[c0 + 6], e3i = cs[c0 + 7], e4r = cs[c0 + 8], e4i = cs[c0 + 9];
    const ar = A1r * e1r - A1i * e1i + A2r * e2r - A2i * e2i + A3r * e3r - A3i * e3i;
    const ai = A1r * e1i + A1i * e1r + A2r * e2i + A2i * e2r + A3r * e3i + A3i * e3r;
    const br = B0r + B1r * e1r - B1i * e1i + B2r * e2r - B2i * e2i + B3r * e3r - B3i * e3i + B4r * e4r - B4i * e4i;
    const bi = B0i + B1r * e1i + B1i * e1r + B2r * e2i + B2i * e2r + B3r * e3i + B3i * e3r + B4r * e4i + B4i * e4r;
    const cr = C1r * e1r - C1i * e1i + C2r * e2r - C2i * e2i + C3r * e3r - C3i * e3i;
    const ci = C1r * e1i + C1i * e1r + C2r * e2i + C2i * e2r + C3r * e3i + C3i * e3r;
    // Discriminant D = B^2 - 4AC and the root of larger modulus,
    // q = -(B + sqrt D) / 2 with the sign that keeps B and sqrt D from
    // cancelling: |q|^2 = (|B|^2 + |D| + 2 |Re(conj(B) sqrt D)|) / 4, and
    // |Re(conj(B) sqrt D)|^2 = (|B|^2 |D| + Re(conj(B)^2 D)) / 2. The roots
    // are z1 = q / C and z2 = A / q.
    const dr = br * br - bi * bi - 4 * (ar * cr - ai * ci);
    const di = 2 * br * bi - 4 * (ar * ci + ai * cr);
    const dm = sqrt(dr * dr + di * di);
    const b2 = br * br + bi * bi;
    const q2 = (b2 + dm + 2 * sqrt(max(0, (b2 * dm + (br * br - bi * bi) * dr + 2 * br * bi * di) / 2))) / 4;
    const r1 = q2 / (cr * cr + ci * ci), r2 = (ar * ar + ai * ai) / q2;
    const lo = r1 < r2 ? r1 : r2, hi = r1 < r2 ? r2 : r1;
    if (lo < loA) loA = lo;
    if (lo > loB) loB = lo;
    if (hi < hiA) hiA = hi;
    if (hi > hiB) hiB = hi;
  }
  // To LEDs: x = log|z| / h.
  const px = (r) => cl(XC + (log(r) / (2 * h)) * SC, -4, W + 4);
  let a1 = px(loA), b1 = px(loB), a2 = px(hiA), b2 = px(hiB);
  // The union of the two intervals, as coverage of each LED.
  if (a2 <= b1) (b1 = max(b1, b2)), (a2 = 1e9);
  span(cov, o, a1, b1);
  if (a2 < 1e8) span(cov, o, a2, b2);
}

// Coverage of [a, b] on a row.
function span(cov, o, a, b) {
  a = max(a, 0);
  b = min(b, W);
  for (let x = floor(a); x < b; x++) cov[o + x] = min(1, cov[o + x] + min(b, x + 1) - max(a, x));
}

export function draw(display, params) {
  const S = params.s;
  if (!S.pr) {
    S.pr = new Float64Array(NM);
    S.pi = new Float64Array(NM);
  }
  coefficients(S);
  const { cov, F, v } = S;
  for (let y = 0; y < H; y++) row(S, y, cov);
  // The body's colour follows the edge of the Newton polygon its piece is
  // dual to: ladder sides, rungs and side tentacles, and the two diagonals.
  const tone = [0, 1, 2, 3].map((d) => hsv(0.42 + S.hue + 0.06 * d, 0.6 - 0.06 * d, 1));
  const hole = hsv(0.8 + S.hue, 0.6, 72);
  const line = [255, 228, 176];
  const blend = S.started ? 0.5 : 1;
  S.started = true;
  const gb = new Float64Array(3), gs = new Float64Array(3), gm = new Int32Array(3), gn = new Int32Array(3);
  for (let y = 0, p = 0; y < H; y++) {
    const Y = (YC - y - 0.5) / SC;
    // Along a row only i X changes, so each power of z keeps its best and
    // second-best monomial for the whole row.
    gb.fill(-1e9);
    gs.fill(-1e9);
    for (let m = 0; m < NM; m++) {
      const i = MI[m], val = v[m] + MJ[m] * Y;
      if (val > gb[i]) (gs[i] = gb[i]), (gn[i] = gm[i]), (gb[i] = val), (gm[i] = m);
      else if (val > gs[i]) (gs[i] = val), (gn[i] = m);
    }
    for (let x = 0; x < W; x++, p++) {
      const X = (x + 0.5 - XC) / SC;
      // The tropical polynomial max(v + iX + jY): the winning monomial, the
      // runner-up, and the winner's lead as distance to the tropical curve.
      let w = 0;
      for (let i = 1; i < 3; i++) if (gb[i] + i * X > gb[w] + w * X) w = i;
      const b1 = gb[w] + w * X, m1 = gm[w];
      let b2 = gs[w] + w * X, m2 = gn[w];
      for (let i = 0; i < 3; i++)
        if (i !== w && gb[i] + i * X > b2) (b2 = gb[i] + i * X), (m2 = gm[i]);
      const di = MI[m1] - MI[m2], dj = MJ[m1] - MJ[m2];
      const dist = ((b1 - b2) * SC) / sqrt(di * di + dj * dj);
      const c = cov[p];
      // Outside the amoeba: night, and the holes, where an inner monomial
      // wins, a deep violet.
      let r = 6, g = 9, b = 16;
      if (m1 >= 4 && m1 <= 6) (r = hole[0]), (g = hole[1]), (b = hole[2]);
      if (c > 0) {
        const t = tone[di === 0 ? 1 : dj === 0 ? 0 : di * dj > 0 ? 2 : 3];
        const lv = 205 + 50 * max(0, 1 - dist * dist * 0.04);
        r += (t[0] * lv - r) * c;
        g += (t[1] * lv - g) * c;
        b += (t[2] * lv - b) * c;
      }
      if (dist < 0.8) {
        const a = 0.5 * (1 - dist / 0.8);
        r += (line[0] - r) * a;
        g += (line[1] - g) * a;
        b += (line[2] - b) * a;
      }
      const q = p * 3;
      F[q] += (r - F[q]) * blend;
      F[q + 1] += (g - F[q + 1]) * blend;
      F[q + 2] += (b - F[q + 2]) * blend;
      display.setPixel(x, y, F[q], F[q + 1], F[q + 2]);
    }
  }
}
