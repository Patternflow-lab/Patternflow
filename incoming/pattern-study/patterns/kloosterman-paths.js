// ===== Patternflow pattern =====
// Title:   Kloosterman Paths
// Family:  line
// Idea:    The partial sums of a Kloosterman sum Kl(a, 1; p), one unit step turned by 2 pi (a x + 1/x) / p for each x from 1 to p - 1 and the whole scaled by 1/sqrt(p), are drawn as a path whose two halves are mirror images about a vertical line, so two pens set out together from its two ends on the real axis, trace the halves as reflections of each other and meet on the mirror line, and then the finished figure rises up the panel as the next a is traced beneath it, a column of symmetric figures each the shape of one exponential sum.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kloosterman sums (Hendrik Kloosterman, 1926), Weil's bound |Kl(a, b; p)| <= 2 sqrt(p) (Andre Weil, 1948), Kloosterman paths (Emmanuel Kowalski and William Sawin, Kloosterman paths and the shape of exponential sums, 2016); pattern round 101
// Round:   101
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Prime=0..1, Fade=0..1
//
// Knob 1: Hue. Turns the path colours round the wheel. At 0 a path runs from cyan at its two ends through blue to violet where the pens meet, and a figure whose sum is near +2 sqrt(p) sits 0.12 of a turn further toward green than one near -2 sqrt(p); at 0.5 the ends are red and the meeting point green.
// Knob 2: Speed. At 2 the two pens trace a figure in 2.6 s, hold 0.5 s and the column rises in 0.7 s, 3.8 s a figure; 38 s at 0.2 and 2.5 s at 3.
// Knob 3: Prime. The prime p in six stops: 61 at 0, 101 at 0.2, then 167, 271, 433 and 701 at 1. At 61 a step is 4.1 LEDs long at full scale and each figure is a crisp polygon of 60 sides; at 701 a step is 1.2 LEDs and the path is a ragged thread that crosses itself into dense knots, nearer the random Fourier series Kowalski and Sawin found as the limit.
// Knob 4: Fade. How long a finished figure stays lit as it rises. At 0 it keeps full light until it leaves at the top; at the opening 0.06 it keeps two thirds of its light 13 s after it is finished, about when it leaves at the top; at 0.5 it is half gone 1.3 s after it is finished and at 1 after 0.5 s, so only the figure being traced shows.

// For a prime p and a not divisible by p,
//
//   Kl(a, 1; p) = sum over x = 1 .. p - 1 of e((a x + xbar) / p),
//
// e(t) = exp(2 pi i t) and xbar the inverse of x mod p. Kloosterman (1926)
// met these sums working on quadratic forms; Weil (1948) proved
// |Kl| <= 2 sqrt(p) from the Riemann hypothesis for curves over finite
// fields. Kowalski and Sawin (2016) joined the partial sums
// S(j) = (1 / sqrt p) sum over x <= j, j = 0 .. p - 1, by straight lines and
// studied the path as a random function, finding its limit as p grows:
// a random Fourier series with Sato-Tate coefficients.
//
// The inverse of p - x is -xbar, so term p - x is the complex conjugate of
// term x. Summing from the far end gives
//
//   S(p - 1 - j) = Kl - conj(S(j)),
//
// the reflection of S(j) in the vertical line Re z = Kl / 2. The path starts
// at 0, ends at Kl on the real axis (Kl is real) and is symmetric about that
// line, and its middle point S((p - 1) / 2) lies on it. Here the real axis is
// horizontal and the mirror line is the panel's centre column, so the two
// pens, one from 0 and one from Kl, are always each other's reflection.
//
// The scale is 32 LEDs to sqrt(p), shrunk only for a figure wider than 62
// LEDs. By Weil's bound the base line from 0 to Kl is then at most 64 LEDs
// long, the panel's width: the dim ticks at the two edges on every base row
// are where its ends could reach and never pass. The pattern draws Kl(a, 1; p)
// with a new random a for every figure.

const W = 64, H = 128;
const { floor, round, sqrt, cos, sin, exp, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => u * u * (3 - 2 * u);

// The primes on the Prime knob.
const PRIMES = [61, 101, 167, 271, 433, 701];
// LEDs to one sqrt(p), the widest a figure may be, the gap between figures,
// and the row the lowest figure's bottom sits on.
const SC = 32, WMAX = 62, GAP = 6, FLOOR = 125;
// Story seconds at Speed 1: tracing, holding, rising.
const T_TRACE = 5.2, T_HOLD = 1, T_RISE = 1.4;
const AX = 31.5;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// One figure: the path's points on the panel relative to the figure's top,
// its height, and the sum itself.
function figure(p, a) {
  const inv = new Int32Array(p);
  inv[1] = 1;
  for (let x = 2; x < p; x++) inv[x] = ((p - floor(p / x)) * inv[p % x]) % p;
  const re = new Float64Array(p), im = new Float64Array(p), k = (2 * PI) / p, n = 1 / sqrt(p);
  let sr = 0, si = 0;
  for (let x = 1; x < p; x++) {
    const ph = (((a * x) % p) + inv[x]) % p;
    sr += cos(k * ph);
    si += sin(k * ph);
    re[x] = sr * n;
    im[x] = si * n;
  }
  const kl = re[p - 1];
  let x0 = 0, x1 = 0, y0 = 0, y1 = 0;
  for (let j = 0; j < p; j++) {
    const dx = re[j] - kl / 2;
    if (dx < x0) x0 = dx;
    if (dx > x1) x1 = dx;
    if (im[j] < y0) y0 = im[j];
    if (im[j] > y1) y1 = im[j];
  }
  const half = max(-x0, x1);
  const s = min(SC, WMAX / 2 / max(half, 1e-6));
  const pts = new Float32Array(2 * p);
  for (let j = 0; j < p; j++) {
    pts[2 * j] = AX + (re[j] - kl / 2) * s;
    pts[2 * j + 1] = 1 + (y1 - im[j]) * s;
  }
  // Longer paths cross themselves more often, so each step is drawn dimmer.
  return { p, a, kl, s, pts, h: (y1 - y0) * s + 2, base: 1 + y1 * s, y: 0, done: -1, tr: 0, k: (61 / p) ** 0.35 };
}

const primeOf = (k) => PRIMES[round(cl(k, 0, 1) * (PRIMES.length - 1))];
const newA = (p) => 1 + floor(Math.random() * (p - 1));

export function setup(params) {
  params.s = { figs: [], phase: 0, t: 0, clock: 100, hue: 0, fade: 0.06, p: 61, buf: new Float32Array(W * H * 3), c: new Float32Array(3) };
}

// Lay a new figure in under the column and start the rise that makes room.
function next(S) {
  const f = figure(S.p, newA(S.p));
  f.y = FLOOR + GAP;
  S.figs.push(f);
  S.rise0 = S.figs.map((g) => g.y);
  S.riseBy = f.h + GAP;
}

function start(S) {
  // The opening column: three finished figures above, the fourth a fifth
  // traced at the bottom, as if the stream had been running for a while.
  S.figs = [];
  let y = FLOOR;
  const ages = [0, 1, 2, 3];
  for (const age of ages) {
    const f = figure(S.p, newA(S.p));
    y -= f.h;
    f.y = y;
    y -= GAP;
    if (age > 0) {
      f.tr = 1;
      f.done = S.clock - age * 3.8 + 1.2;
    } else f.tr = 0.2;
    S.figs.unshift(f);
  }
  S.phase = 0;
  S.t = 0.2 * T_TRACE;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.fade = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const p = primeOf(k[2] || 0);
  if (p !== S.p || !S.figs.length) {
    S.p = p;
    start(S);
  }
  S.clock += d;
  S.t += d * speed;
  const cur = S.figs[S.figs.length - 1];
  if (S.phase === 0) {
    cur.tr = min(1, S.t / T_TRACE);
    if (S.t >= T_TRACE) {
      cur.tr = 1;
      cur.done = S.clock;
      S.phase = 1;
      S.t = 0;
    }
  } else if (S.phase === 1) {
    if (S.t >= T_HOLD) {
      S.phase = 2;
      S.t = 0;
      next(S);
    }
  } else {
    const u = ease(min(1, S.t / T_RISE));
    S.figs.forEach((g, i) => (g.y = S.rise0[i] - S.riseBy * u));
    if (S.t >= T_RISE) {
      S.figs = S.figs.filter((g) => g.y + g.h > 0);
      S.phase = 0;
      S.t = 0;
    }
  }
}

// An additive dot at a fractional position, split over four LEDs.
function dot(buf, x, y, r, g, b) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const ws = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  for (let q = 0; q < 4; q++) {
    const px = ix + (q & 1), py = iy + (q >> 1);
    if (px < 0 || px >= W || py < 0 || py >= H || ws[q] < 0.002) continue;
    const o = (py * W + px) * 3, w = ws[q];
    buf[o] += r * w;
    buf[o + 1] += g * w;
    buf[o + 2] += b * w;
  }
}

function line(buf, x0, y0, x1, y1, r, g, b) {
  const dx = x1 - x0, dy = y1 - y0, n = max(1, Math.ceil(sqrt(dx * dx + dy * dy) * 1.6));
  const sr = r / 1.6, sg = g / 1.6, sb = b / 1.6;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    dot(buf, x0 + dx * u, y0 + dy * u, sr, sg, sb);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.figs.length) return;
  const buf = S.buf, c = S.c;
  buf.fill(0);
  // The mirror line every figure shares, dim, down the whole panel.
  for (let y = 0; y < H; y += 2) {
    dot(buf, AX, y, 50, 50, 64);
  }
  const tau = S.fade <= 0 ? 1e9 : 0.72 / S.fade ** 1.35;
  const last = S.figs.length - 1;
  S.figs.forEach((f, fi) => {
    const age = f.done < 0 ? 0 : S.clock - f.done;
    const lv = f.done < 0 ? 1 : exp(-age / tau);
    if (lv < 0.02) return;
    const P = f.pts, p = f.p, oy = f.y, mid = (p - 1) / 2;
    // The base line from 0 to Kl on the real axis, with Weil's ticks.
    const by = oy + f.base, xa = P[0], xb = P[2 * (p - 1)];
    const bl = 60 * lv;
    line(buf, min(xa, xb), by, max(xa, xb), by, bl * 0.8, bl * 0.8, bl);
    for (const sg of [-1, 1]) {
      const tx = cl(AX + sg * (f.s - 0.5), 0, W - 1);
      for (let q = -1; q <= 1; q++) dot(buf, tx, by + q, bl * 1.4, bl * 1.4, bl * 1.4);
    }
    // The halves: j from 0 forward and its mirror from p - 1 back.
    const reach = f.tr * mid;
    const jn = floor(reach);
    const shift = 0.03 * f.kl;
    for (let j = 0; j < jn && j < mid; j++) {
      const u = (j + 0.5) / mid;
      hsv(S.hue + 0.5 + 0.3 * u - shift, 0.92 - 0.12 * u, 1, c);
      const v = 220 * lv * f.k;
      const x0 = P[2 * j], y0 = P[2 * j + 1] + oy, x1 = P[2 * j + 2], y1 = P[2 * j + 3] + oy;
      line(buf, x0, y0, x1, y1, c[0] * v, c[1] * v, c[2] * v);
      line(buf, 2 * AX - x0, y0, 2 * AX - x1, y1, c[0] * v, c[1] * v, c[2] * v);
    }
    // The pens, and the meeting on the mirror line.
    if (fi === last && f.tr < 1) {
      const j = min(jn, floor(mid) - 1), fr = reach - j;
      const hx = P[2 * j] + (P[2 * j + 2] - P[2 * j]) * fr, hy = P[2 * j + 1] + (P[2 * j + 3] - P[2 * j + 1]) * fr + oy;
      const x0 = P[2 * j], y0 = P[2 * j + 1] + oy;
      hsv(S.hue + 0.5 + (0.3 * j) / mid - shift, 0.8, 1, c);
      const v = 220 * f.k;
      line(buf, x0, y0, hx, hy, c[0] * v, c[1] * v, c[2] * v);
      line(buf, 2 * AX - x0, y0, 2 * AX - hx, hy, c[0] * v, c[1] * v, c[2] * v);
      for (const sx of [hx, 2 * AX - hx]) {
        dot(buf, sx, hy, 330, 330, 330);
        for (let q = 0; q < 4; q++) dot(buf, sx + [1, -1, 0, 0][q], hy + [0, 0, 1, -1][q], 60, 60, 70);
      }
    }
    if (f.done >= 0 && age < 1.2) {
      const mx = AX, my = P[2 * floor(mid) + 1] + oy, rr = 1 + age * 7, al = (1 - age / 1.2) * lv;
      for (let q = 0; q < 24; q++) {
        const an = (q / 24) * 2 * PI;
        dot(buf, mx + rr * cos(an), my + rr * sin(an), 150 * al, 150 * al, 170 * al);
      }
      dot(buf, mx, my, 300 * al, 300 * al, 300 * al);
    }
  });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      // Where crossings pile up past full, the colour is scaled down whole
      // instead of clipped, so it keeps its hue.
      const m = max(buf[o], buf[o + 1], buf[o + 2]), q = m > 255 ? 255 / m : 1;
      display.setPixel(x, y, round(buf[o] * q), round(buf[o + 1] * q), round(buf[o + 2] * q));
    }
}
