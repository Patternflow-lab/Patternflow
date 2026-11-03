// ===== Patternflow pattern =====
// Title:   Takagi Curve
// Family:  fractal
// Idea:    Takagi's continuous nowhere-differentiable function is built down the standing panel one level at a time, x running down the 128 rows and the value across the columns, each level a sawtooth of 2^n tents in its own colour stacked on the sum so far, so the single tent of level 0 rises into the blancmange as the levels land and roughens at its edge until the curve touches its maximum 2/3 in four small clusters, and the weight knob turns the same stack into a smooth parabola at w = 1/4 or a rough band toward w = 1.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Takagi function, sum of s(2^n x) / 2^n with s the distance to the nearest integer (Teiji Takagi, 1903), the Takagi-Landsberg family sum of w^n s(2^n x) (Georg Landsberg, 1908), the set where the maximum 2/3 is reached (Jean-Pierre Kahane, 1959); pattern round 102
// Round:   102
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Weight=-1..1, Zoom=0..1
//
// Knob 1: Hue. Turns the level colours round the wheel. At 0 level 0 is azure and each finer level sits 0.065 of a turn further on and paler, through blue and violet to a pale pink at level 7, the odd levels paler still so neighbouring bands part. At 0.5 level 0 is red and at 0.75 green; between 0.569 and 0.57 it steps over orange and yellow, which read brown and olive in its 40 percent fill.
// Knob 2: Speed. At 2 a level rises in 0.6 s and the next starts 0.3 s after it, so the eight levels of the blancmange are built in 7.2 s. The finished curve is held 1.8 s with the rows where it reaches 2/3 marked, peeled back finest level first in 1.4 s, and after 0.3 s of black the build starts again: 10.7 s a cycle, 107 s at 0.2 and 7.2 s at 3.
// Knob 3: Weight. The weight w in the sum of w^n s(2^n x), the value scaled so the finished curve's maximum sits at column 60. From -0.08 to 0.08, and so at the opening 0, w = 1/2 exactly, Takagi's own curve, the blancmange, with its maximum 2/3 dotted at column 60. Down to -1 w falls to 1/4, where four levels stack into the parabola 2x(1 - x) and a dotted line traces that closed form. Up to 1 w rises to 0.9: twelve levels are built one by one, all the finer ones land together as a last band in soft magenta, and the curve's edge wanders between columns 34 and 59 from row to row.
// Knob 4: Zoom. Up to 0.1 the panel shows the whole of 0 <= x <= 1. From 0.1 to 1 it zooms into the top of the panel by up to 16 times in x, the coarsest band thinning away as it goes, and the value is scaled to keep the maximum at column 60. At 0.325, 0.55, 0.775 and 1 the zoom is 2, 4, 8 and 16 and the picture lands on itself, the same stack one, two, three or four colours further on.

// Takagi (1903) wrote T(x) = sum over n >= 0 of s(2^n x) / 2^n, with s(u)
// the distance from u to the nearest integer, and showed it continuous and
// differentiable nowhere. Each term is a sawtooth of 2^n tents of height
// 2^-n / 2. Landsberg (1908) put a weight w in place of 1/2:
//
//   T_w(x) = sum over n >= 0 of w^n s(2^n x).
//
// At w = 1/4 the sum is the parabola 2x(1 - x). Split at n = 0: for x in
// [0, 1/2], s(x) = x and the rest is T(2x) / 4, and 2x(1 - x) satisfies
// x + 2(2x)(1 - 2x) / 4 = 2x(1 - x); the same works on [1/2, 1], and a
// bounded solution of that equation is unique. Forty levels against the
// closed form at 100,000 random x differ by 3.3e-16 at most, and setup()
// below checks it again on 1,024 points before the dotted parabola is drawn.
//
// At w = 1/2 the largest value is 2/3, taken exactly where the binary
// digits of x come in pairs 01 or 10, a Cantor set of dimension 1/2 (Kahane,
// 1959). Members drawn at random sum to 2/3 within 1e-15, and points with a
// pair 00 or 11 among the first eight stay below it. x = 1/3, 2/5, 3/5 and
// 2/3 are in the set, and at 1,024 samples down the panel the curve comes
// within half a column of column 60 on rows 42-45, 50-53, 74-77 and 82-85.
//
// The sum is self-affine: T_w(x) = s(x) + w T_w(2x). Take away level 0 and
// what is left on [0, 1/2] is the whole curve again, half as long and w
// times as wide. The zoom works that way. At zoom z, panel row X shows
// x = X / 2^z, every level below floor(z) is taken away, level floor(z) is
// scaled by 1 - frac(z), and the value is scaled so its maximum sits at
// column 60. At a whole z the picture is exactly the unzoomed one, each
// band in the colour of the level z above it.
//
// A row is 8 samples whose positions carry an irrational offset, so 2^n x
// stays off the dyadic grid for some 50 doublings. Each sample stacks the
// levels' widths from column 0 and adds each band's colour over the columns
// it covers, dim inside and full in its last 1.2 columns, so the top of
// every partial sum is a bright line and the outline of the whole is the
// curve.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, pow, log, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const s = (u) => abs(u - round(u));

const SS = 8, FIT = 60, EDGE = 1.2, INNER = 0.4, MAXB = 12, NMAX = 64;
// Story seconds at Speed 1 for a level to rise and to rest before the next,
// to hold the finished curve, to peel one level, and the blank before a new build.
const RISE = 1.2, REST = 0.6, HOLD = 3.6, PEEL = 0.36, GAP = 0.6;
const STEP = RISE + REST;
const OFF = new Float64Array(SS);
for (let j = 0; j < SS; j++) OFF[j] = (j + 0.15 + 0.7 * (((j + 1) * 0.7548776662466927) % 1)) / SS;

function hsv(h, sa, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - sa), q = v * (1 - sa * f), t = v * (1 - sa * (1 - f));
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The weight from the knob: 1/2 held from -0.08 to 0.08, 1/4 at -1, 0.9 at 1.
function weightOf(k) {
  if (abs(k) <= 0.08) return 0.5;
  if (k < 0) return k <= -0.995 ? 0.25 : 0.5 * pow(2, (k + 0.08) / 0.92);
  return 0.5 + (0.4 * (k - 0.08)) / 0.92;
}

// The levels a sample needs at this many columns to a unit of value: until
// a tent is a fiftieth of a column high.
const levelsFor = (w, cols) => cl(ceil(log(0.04 / cols) / log(w)) + 1, 4, NMAX);

// The value of the full sum at x, with the zoom's levels taken away.
function shown(w, z, x, N) {
  const k = floor(z), f = z - k;
  let v = 0, a = 1, u = x;
  for (let n = 0; n < N; n++) {
    const m = n < k ? 0 : n === k ? 1 - f : 1;
    if (m > 0) v += m * a * s(u);
    a *= w;
    u *= 2;
  }
  return v;
}

// Columns per unit of value: the zoomed curve's largest value, over 1,024
// samples, goes to column 60.
function fit(S, w, z) {
  if (S.fw === w && S.fz === z) return;
  let top = 0;
  const N0 = levelsFor(w, 120 * pow(w, -z));
  const zs = pow(2, -z), ws = pow(w, -z);
  for (let i = 0; i < 1024; i++) {
    const x = ((i + 0.5 + 0.37 * OFF[i % SS]) / 1024) * zs;
    top = max(top, shown(w, z, x, N0) * ws);
  }
  S.fw = w;
  S.fz = z;
  S.scale = (FIT / top) * ws;
  S.N = levelsFor(w, S.scale);
  // Levels built one by one: from floor(z) while a tent is 0.3 columns or
  // more, at most twelve; the rest, if it adds up to a column, is a last band.
  const k0 = floor(z);
  let L = k0 + 1;
  while (L < S.N && L - k0 < MAXB && 0.5 * pow(w, L) * S.scale >= 0.3) L++;
  S.k0 = k0;
  S.L = L;
  S.tail = L < S.N && (0.25 * pow(w, L) * S.scale) / (1 - w) >= 1;
}

export function setup(params) {
  // The parabola check: 40 levels at w = 1/4 against 2x(1 - x).
  let err = 0;
  for (let i = 0; i < 1024; i++) {
    const x = (i + 0.5 * OFF[i % SS]) / 1024;
    let v = 0, a = 1, u = x;
    for (let n = 0; n < 40; n++, a *= 0.25, u *= 2) v += a * s(u);
    err = max(err, abs(v - 2 * x * (1 - x)));
  }
  params.s = {
    t: STEP, hue: 0, w: 0.5, z: 0, fw: -1, fz: -1, scale: 90, N: 20, k0: 0, L: 8, tail: false,
    parabola: err < 1e-12, buf: new Float32Array(W * H * 3), col: new Float32Array(6 * (NMAX + 2)), g: new Float32Array(NMAX), heat: new Float32Array(NMAX),
    wd: new Float64Array(NMAX + 2), amp: new Float64Array(NMAX), touch: new Float32Array(H),
  };
}

// Where each level stands in the cycle: grown share g and heat.
function schedule(S) {
  const steps = S.L - S.k0 + (S.tail ? 1 : 0);
  const build = steps * STEP, peelAt = build + HOLD, end = peelAt + steps * PEEL + GAP;
  if (S.t >= end) S.t -= end * floor(S.t / end);
  const t = S.t;
  S.marked = t > build - REST && t < peelAt;
  for (let n = 0; n < S.N; n++) {
    const i = n < S.k0 ? -1 : n < S.L ? n - S.k0 : steps - 1;
    if (i < 0) { S.g[n] = 1; S.heat[n] = 0; continue; }
    const a = i * STEP, done = a + RISE;
    let g = ease((t - a) / RISE);
    const p0 = peelAt + (steps - 1 - i) * PEEL;
    if (t >= p0) g *= 1 - ease((t - p0) / PEEL);
    S.g[n] = g;
    S.heat[n] = t < a ? 0 : t < done ? 0.8 : 0.8 * exp(-(t - done) / 0.7);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.w = weightOf(cl(k[2] || 0, -1, 1));
  S.z = 4 * cl(((k[3] == null ? 0.06 : k[3]) - 0.1) / 0.9, 0, 1);
  fit(S, S.w, S.z);
  S.t += d * speed;
  schedule(S);
}

// Adds a colour over columns c0..c1 of one row, by how much of each it covers.
function span(buf, o, c0, c1, r, g, b) {
  if (c1 <= c0) return;
  const a = floor(c0), e = min(W - 1, floor(c1));
  for (let x = a; x <= e; x++) {
    const cov = min(c1, x + 1) - max(c0, x);
    if (cov <= 0) continue;
    const i = o + x * 3;
    buf[i] += r * cov;
    buf[i + 1] += g * cov;
    buf[i + 2] += b * cov;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { buf, col, g, heat, wd, amp, touch } = S;
  buf.fill(0);
  const w = S.w, z = S.z, k = floor(z), f = z - k, N = S.N, L = S.L, nb = S.tail ? L + 1 : L;
  const zs = pow(2, -z);
  // Level 0's hue: azure at Hue 0, turning with the knob but stepping over
  // orange and yellow, which read brown and olive in its 40 percent fill.
  const h0 = 0.58 + 0.79 * S.hue, hue = h0 > 1.03 ? h0 + 0.21 : h0;
  // Band colours, inner and edge, already divided by the sample count.
  for (let b = 0; b < nb; b++) {
    const n = min(b, N - 1);
    const tailBand = S.tail && b === L;
    // Blue at level 0 to pale pink at level 7, then back toward violet.
    // The last band, all the finer levels together, is a soft magenta.
    const bb = b <= 7 ? b : max(0, 14 - b);
    if (tailBand) hsv(hue + 0.26, 0.5, 1, col, 6 * b);
    else hsv(hue + 0.065 * bb, max(0.2, 0.95 - 0.1 * bb) - (b % 2) * 0.1, 1, col, 6 * b);
    const h = tailBand ? heat[N - 1] : heat[n], inner = tailBand ? 0.6 : INNER;
    for (let c = 0; c < 3; c++) {
      const v = col[6 * b + c] * (1 - h) + h;
      col[6 * b + c] = (255 * inner * v) / SS;
      col[6 * b + 3 + c] = (255 * v) / SS;
    }
  }
  // Each level's width factor in columns.
  let a = 1;
  for (let n = 0; n < N; n++, a *= w) {
    const m = n < k ? 0 : n === k ? 1 - f : 1;
    amp[n] = m * a * g[n] * S.scale;
  }
  touch.fill(0);
  for (let y = 0; y < H; y++) {
    const o = y * W * 3;
    for (let j = 0; j < SS; j++) {
      const x = ((y + OFF[j]) / H) * zs;
      wd.fill(0);
      let u = x;
      for (let n = 0; n < N; n++, u *= 2) if (amp[n] > 0) wd[n < L ? n : L] += amp[n] * s(u);
      let c0 = 0;
      for (let b = 0; b < nb; b++) {
        const c1 = c0 + wd[b];
        if (c1 > c0) {
          const m = max(c0, c1 - EDGE);
          span(buf, o, c0, m, col[6 * b], col[6 * b + 1], col[6 * b + 2]);
          span(buf, o, m, c1, col[6 * b + 3], col[6 * b + 4], col[6 * b + 5]);
        }
        c0 = c1;
      }
      if (c0 >= FIT - 0.5) touch[y] += 1 / SS;
    }
  }
  // Guides, dotted every other row in pale grey: at w = 1/2 the maximum 2/3
  // at column 60, lit white where the finished curve reaches it; at w = 1/4
  // the closed form 2x(1 - x) with the zoom's levels taken away.
  const gr = [0, 0, 0];
  hsv(hue, 0.15, 1, gr, 0);
  if (w === 0.5) {
    for (let y = 0; y < H; y++) {
      const t = S.marked ? touch[y] : 0;
      const v = t > 0 ? 120 + 135 * t : y % 2 ? 0 : 34;
      const i = (y * W + FIT) * 3;
      buf[i] += gr[0] * v; buf[i + 1] += gr[1] * v; buf[i + 2] += gr[2] * v;
      if (t > 0) { buf[i + 3] += gr[0] * v * 0.45; buf[i + 4] += gr[1] * v * 0.45; buf[i + 5] += gr[2] * v * 0.45; }
    }
  } else if (w === 0.25 && S.parabola) {
    for (let y = 0; y < H; y += 2) {
      const x = ((y + 0.5) / H) * zs;
      let v = 2 * x * (1 - x), aa = 1, u = x;
      for (let n = 0; n <= k; n++, aa *= w, u *= 2) v -= (n < k ? 1 : f) * aa * s(u);
      const c = v * S.scale;
      if (c < 0 || c >= W) continue;
      span(buf, y * W * 3, c + 0.3, c + 1.3, gr[0] * 70, gr[1] * 70, gr[2] * 70);
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const m = max(buf[i], buf[i + 1], buf[i + 2]), q = m > 255 ? 255 / m : 1;
      display.setPixel(x, y, round(buf[i] * q), round(buf[i + 1] * q), round(buf[i + 2] * q));
    }
}
