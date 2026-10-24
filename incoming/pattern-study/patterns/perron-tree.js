// ===== Patternflow pattern =====
// Title:   Perron Tree
// Family:  geometry
// Idea:    A tall triangle that holds a needle in every direction between its sides is cut into thin slivers that slide over each other level by level, as Perron did, until it is a tree of sprouts on a third of the area that still holds every direction, and a white needle turns through all of them, hopping from sprout to sprout.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kakeya needle problem (Sōichi Kakeya, 1917), Besicovitch set drawn as Oskar Perron's tree (1928), pattern round 29
// Round:   29
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Depth=5..8, Slide=-1..1
//
// Knob 1: Hue. Turns the sweep of colours that marks each sliver's direction round the wheel.
// Knob 2: Speed. How fast the slivers slide and the needle turns; at 2 the tree takes five and a half seconds to grow, stands for six and folds back up in three.
// Knob 3: Depth. How many times the base is halved, 5 to 8: from 32 slivers to 256, and as many levels of sliding. The finished tree covers 30% of the triangle at 5 and 24% at 8.
// Knob 4: Slide. How far each pair slides over the other: at -1 a little, and the tree is a tall trunk with a small crown frayed out at the top; at 1 a long way, and a short stub carries a crown that fans out nearly as wide as the triangle was.
// Buttons: K1 tap starts again from the single triangle.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, exp, cos, abs, pow, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// The triangle: base on the bottom edge, BW LEDs wide, apex HT LEDs up.
const BW = 60, HT = 120, Y0 = 128, MAXN = 8, MAXM = 1 << MAXN;
// How much of the blurred light comes back as glow (the blur sums to 81).
const GLOW = 0.22 / 81;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const c = i === 0 ? [v, t, p] : i === 1 ? [q, v, p] : i === 2 ? [p, v, t] : i === 3 ? [p, q, v] : i === 4 ? [t, p, v] : [v, p, q];
  out[o] = c[0];
  out[o + 1] = c[1];
  out[o + 2] = c[2];
}

export function setup(params) {
  params.s = {
    lam: 0, hold: 0, phase: 0, needle: 0, n: 5, g: 0.8, hue: 0,
    acc: new Float32Array(N * 3), trail: new Float32Array(N), fade: 1, blo: new Float32Array(N * 3), sh: new Float32Array(MAXM), tj: new Float32Array(MAXN + 1), dur: new Float32Array(MAXN + 1),
    col: new Float32Array(MAXM * 3),
  };
}

// Perron's slides. At level j the base pieces pair up in groups of 2^j and
// the right half of each group slides left by tj[j]: first closing the gap
// its heart left at the level before, then a further 2(1 - g) of its half
// base, so the two halves cross at 2g - 1 of the group triangle's height and
// fork into two sprouts above it. What lies below is the group's heart, its
// triangle shrunk by g^j toward its left corner, and the next level slides
// hearts the same way. (Stein's write-up of Schoenberg's version.)
function slides(P, n, g) {
  const w = BW / (1 << n);
  for (let j = 1; j <= n; j++) {
    const half = w * (1 << (j - 1)), s = pow(g, j - 1);
    P.tj[j] = half * (1 - s) + 2 * (1 - g) * s * half;
  }
  // Seconds per level at Speed 2: the first levels move a fraction of an
  // LED and go by quickly, the last ones take their time.
  for (let j = 1; j <= n; j++) P.dur[j] = 0.3 + 1.7 * pow(P.tj[j] / P.tj[n], 0.6);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1) * cl(k[1], 0.2, 3) / 2;
  P.hue = cl(k[0], 0, 1);
  const n = cl(round(k[2]), 5, MAXN), g = 0.8 - 0.12 * cl(k[3], -1, 1);
  if (n !== P.n || abs(g - P.g) > 1e-4) {
    // Keep the same share of the build when the depth changes.
    const frac = P.lam / P.n;
    P.n = n;
    P.g = g;
    P.lam = frac * n;
  }
  slides(P, P.n, P.g);
  if (input.btnPressed && input.btnPressed[0]) (P.phase = 0), (P.lam = 0), (P.hold = 0);
  // Build level by level, hold the tree, take it apart again from the top
  // level down at twice the pace, rest on the whole triangle, and again.
  if (P.phase === 0) {
    P.lam += d / P.dur[min(P.n, floor(P.lam) + 1)];
    if (P.lam >= P.n) (P.lam = P.n), (P.phase = 1), (P.hold = 0);
  } else if (P.phase === 1) {
    if ((P.hold += d) > 6) P.phase = 2;
  } else if (P.phase === 2) {
    P.lam -= (2 * d) / P.dur[cl(Math.ceil(P.lam), 1, P.n)];
    if (P.lam <= 0) (P.lam = 0), (P.phase = 3), (P.hold = 0);
  } else if ((P.hold += d) > 1.2) P.phase = 0;
  P.needle += d * 0.11;
  P.fade = exp(-cl(dt || 0, 0, 0.1) / 0.12);
}

// One row of one sliver into the light buffer: the span [l, r) at row y.
// A span under an LED wide is drawn one LED wide and dimmer, so the sprouts
// taper in light rather than vanish between LEDs.
function span(acc, y, l, r, cr, cg, cb) {
  let wd = r - l, k = 1;
  if (wd < 1) {
    const c = (l + r) / 2;
    k = sqrt(max(wd, 0));
    (l = c - 0.5), (r = c + 0.5), (wd = 1);
  }
  const x0 = max(0, floor(l)), x1 = min(W - 1, floor(r - 1e-6));
  for (let x = x0, p = (y * W + x0) * 3; x <= x1; x++, p += 3) {
    const cov = (min(r, x + 1) - max(l, x)) * k;
    if (cov <= 0) continue;
    acc[p] += cr * cov;
    acc[p + 1] += cg * cov;
    acc[p + 2] += cb * cov;
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const n = P.n, M = 1 << n, w = BW / M, acc = P.acc, sh = P.sh, col = P.col;
  acc.fill(0);
  // How far each level has slid: level j runs while lam goes from j-1 to j.
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i < M; i++) {
    let s = 0;
    for (let j = 1; j <= n; j++) if ((i >> (j - 1)) & 1) s -= P.tj[j] * sm(P.lam - (j - 1));
    sh[i] = s;
    lo = min(lo, s + i * w, s + BW / 2);
    hi = max(hi, s + (i + 1) * w, s + BW / 2);
  }
  // Keep the whole figure centred as it slides.
  const ox = W / 2 - (lo + hi) / 2;
  // Each sliver's colour from its direction, the hue sweeping 0.8 of the wheel
  // from one side of the triangle to the other.
  // One sliver alone tones to about 140 of 255, two to 200, four near white.
  for (let i = 0; i < M; i++) hsv(P.hue + 0.5 + (0.8 * (i + 0.5)) / M, 0.85, 0.5, col, i * 3);
  for (let y = Y0 - HT; y < Y0; y++) {
    const h = Y0 - (y + 0.5), f = h / HT;
    if (f < 0 || f > 1) continue;
    for (let i = 0; i < M; i++) {
      const a = ox + sh[i] + BW / 2, l = ox + sh[i] + i * w, r = l + w;
      span(acc, y, l + (a - l) * f, r + (a - r) * f, col[i * 3], col[i * 3 + 1], col[i * 3 + 2]);
    }
  }
  // The needle: a segment the height of the triangle, swinging through every
  // direction between its sides and back. Its direction picks the base point
  // it stands on, and that point the sliver whose sprout holds it.
  const sw = 0.5 - 0.5 * cos(P.needle * 2 * PI), b = sw * BW, i = min(M - 1, floor(b / w));
  const bx = ox + sh[i] + b, ax = ox + sh[i] + BW / 2, tr = P.trail, fd = P.fade;
  // Its light fades over about a tenth of a second, which softens each hop.
  for (let p = 0; p < N; p++) tr[p] *= fd;
  for (let y = Y0 - HT; y < Y0; y++) {
    const h = Y0 - (y + 0.5), f = h / HT, x = bx + (ax - bx) * f;
    for (let xx = max(0, floor(x - 2)); xx <= min(W - 1, floor(x + 2)); xx++) {
      const dd = abs(xx + 0.5 - x), wgt = dd < 0.5 ? 1 : dd < 1.5 ? 0.9 * (1.5 - dd) : 0.12 * (2.5 - dd), p = y * W + xx;
      if (wgt > tr[p]) tr[p] = wgt;
    }
  }
  for (let p = 0, q = 0; p < N; p++, q += 3) {
    const v = tr[p];
    if (v < 0.01) continue;
    acc[q] += 1.6 * v;
    acc[q + 1] += 1.55 * v;
    acc[q + 2] += 1.4 * v;
  }
  // A soft glow round everything bright: a 5 by 5 blur, about a fifth of it
  // added back, so the thin sprouts read from a few metres away.
  const blo = P.blo;
  for (let y = 0; y < H; y++)
    for (let x = 0, p = y * W * 3; x < W; x++, p += 3)
      for (let c = 0; c < 3; c++) blo[p + c] = (x > 1 ? acc[p + c - 6] : 0) + 2 * (x > 0 ? acc[p + c - 3] : 0) + 3 * acc[p + c] + 2 * (x < W - 1 ? acc[p + c + 3] : 0) + (x < W - 2 ? acc[p + c + 6] : 0);
  // Overlaps add up: light piles toward white where many slivers cross.
  const R = W * 3, tone = (q, y) => {
    const g = (y > 1 ? blo[q - 2 * R] : 0) + 2 * (y > 0 ? blo[q - R] : 0) + 3 * blo[q] + 2 * (y < H - 1 ? blo[q + R] : 0) + (y < H - 2 ? blo[q + 2 * R] : 0);
    return 255 * (1 - exp(-1.6 * (acc[q] + GLOW * g)));
  };
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, tone(p, y), tone(p + 1, y), tone(p + 2, y));
}
