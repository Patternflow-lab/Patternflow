// ===== Patternflow pattern =====
// Title:   Frenkel-Kontorova
// Family:  sim
// Idea:    Balls joined by springs lie in a ring on a corrugated floor of 12 wells along the foot of the panel, with more or fewer balls than wells, so the chain bunches or stretches at kinks where it slips by one well, and a steady push drives those kinks round the ring while the panel above writes each moment as a row, oldest at the top, so every ball's worldline steps one well sideways each time a kink runs through it and the kinks cross the record as slanted bands, magenta where the chain is squeezed and green where it is stretched.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Frenkel-Kontorova model (Yakov Frenkel and Tatiana Kontorova, 1938), the damped chain of Kibble-Zurek Ions (pattern round 64), pattern round 70
// Round:   70
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drive=0..3, Misfit=0.86..1.2, Substrate=1..4
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the chain lying one ball to a well is blue, a squeezed kink magenta, a stretched kink green and the two marked balls cream; at 0.25 the chain is pink, squeezed kinks orange and stretched ones blue; at 0.5 the chain is a pale yellow with green and pink kinks.
// Knob 2: Drive. The same push on every ball, 0.04 d + 0.1 d^2 times K = 1's strongest pull back into a well. At the opening 2 (0.48 of that pull) the two squeezed kinks run right at about 22 LEDs a second, round the ring in 2.9 s, and each ball steps one well right every 1.7 s; at 0.5 they creep, a ball stepping every 9 s; at 0 nothing moves but a shiver; at 3 the K = 1 chain tears loose and slides 3.2 wells a second, kinks and all.
// Knob 3: Misfit. The chain's mean spacing over the well spacing, rounded to whole balls on the 12 wells. At 0.86 there are 14 balls, two too many, which bunch into two squeezed kinks that run with the push; at 0.945 13 balls and one such kink; at 1.03 twelve, one to a well, no kink and nothing moving until the whole chain tears loose; at 1.115 eleven, one ball short, and the stretched kink runs against the push at 22 LEDs a second; at 1.2 ten and two. A new count lays the chain out evenly and lets it settle into kinks.
// Knob 4: Substrate. K, the depth of the wells against the springs, the floor V = K/4pi^2 (1 - cos 2 pi x) under springs of stiffness 1, drawn 3 + 1.25 K LEDs high. At 1 a squeezed kink is spread over four bonds and the opening push moves it easily; at 2.5 it sits mostly in one bond squeezed by 0.58 of a well and needs a push of 2 to move; at 3.25 the push of 2 cannot lift it over the next crest and the record stands still, and at 4 it takes a push of 3.
// Buttons: K2 tap turns the push round, so the kinks turn back and their bands bend into a V.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = 2 * PI;

// The ring: M wells P LEDs apart round the panel's width. Chain positions
// are in wells, well j at x = j, drawn at column P j + P/2.
const M = 12, P = W / M, NMAX = 24;
// The history: one row every ROW_T seconds in rows 0 to HR - 1, oldest on
// top and newest at the bottom. The chain view under it: valley floors on
// row YB.
const HR = 113, YB = 125, ROW_T = 1 / 12;
// Simulation: TS time units a second in steps of DT, damping GAMMA.
const TS = 6, DT = 0.04, GAMMA = 0.3;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 2;
}

export function setup(params) {
  params.s = {
    n: 0, x: new Float64Array(NMAX), v: new Float64Array(NMAX), f: new Float64Array(NMAX),
    K: 1, F: 0, dir: 1, temp: 0.001, hue: 0, rowT: 0, head: 0, started: false,
    hist: new Float32Array(HR * W * 3), strain: new Float32Array(W), sm: new Float32Array(W),
    rgb: new Float32Array(W * H * 3), c: [0, 0, 0], c2: [0, 0, 0],
  };
  return params.s;
}

function load(S, n) {
  S.n = n;
  const a = M / n, off = Math.random();
  for (let i = 0; i < n; i++) (S.x[i] = off + i * a), (S.v[i] = 0);
}

function forces(S) {
  const n = S.n, x = S.x, f = S.f, k = S.K / TAU;
  for (let i = 0; i < n; i++) {
    const xl = i > 0 ? x[i - 1] : x[n - 1] - M, xr = i < n - 1 ? x[i + 1] : x[0] + M;
    f[i] = xr - 2 * x[i] + xl - k * sin(TAU * x[i]) + S.F;
  }
}

function step(S, h) {
  const n = S.n, x = S.x, v = S.v, f = S.f;
  forces(S);
  const kick = sqrt(2 * GAMMA * S.temp * h), g = 1 - GAMMA * h;
  for (let i = 0; i < n; i++) {
    v[i] = (v[i] + f[i] * h) * g + kick * gauss();
    x[i] += v[i] * h;
  }
  if (x[0] >= M) for (let i = 0; i < n; i++) x[i] -= M;
  else if (x[0] < 0) for (let i = 0; i < n; i++) x[i] += M;
}

// Strain of each column: the stretch of the bond over it, in wells, spread
// over five columns so a kink reads as a band.
function strainRow(S) {
  const n = S.n, x = S.x, st = S.strain, sm = S.sm;
  for (let i = 0; i < n; i++) {
    const xa = x[i], xb = i < n - 1 ? x[i + 1] : x[0] + M, s = xb - xa - 1;
    const c0 = P * xa + P / 2, c1 = P * xb + P / 2;
    for (let c = Math.ceil(c0 - 0.5); c < c1 - 0.5; c++) st[((c % W) + W) % W] = s;
  }
  for (let c = 0; c < W; c++)
    sm[c] = (st[(c + W - 2) % W] + 2 * st[(c + W - 1) % W] + 3 * st[c] + 2 * st[(c + 1) % W] + st[(c + 2) % W]) / 9;
  return sm;
}

// The colour of a strain: blue where the chain lies one ball to a well,
// green where it is stretched, magenta where it is squeezed.
function strainColour(S, s, v, o) {
  const a = cl((abs(s) - 0.04) / 0.32, 0, 1);
  const h = s > 0 ? 0.64 + (0.42 - 0.64) * a : 0.64 + (0.88 - 0.64) * a;
  return hsv(h + S.hue, 0.55 + 0.35 * a, v, o);
}

// One row of the history: the strain as a dim band, each ball's worldline
// over it, and two balls, the first and the middle one, in cream so their
// steps can be followed down the record.
function record(S) {
  S.head = (S.head + 1) % HR;
  const row = S.head * W * 3, hist = S.hist, sm = strainRow(S), c = S.c;
  for (let X = 0; X < W; X++) {
    const s = sm[X], a = cl((abs(s) - 0.04) / 0.32, 0, 1);
    strainColour(S, s, 0.05 + 0.42 * a * a, c);
    hist[row + X * 3] = c[0];
    hist[row + X * 3 + 1] = c[1];
    hist[row + X * 3 + 2] = c[2];
  }
  for (let i = 0; i < S.n; i++) {
    const px = (((P * S.x[i] + P / 2 - 0.5) % W) + W) % W, X0 = floor(px), fr = px - X0;
    const s = sm[X0], a = cl((abs(s) - 0.04) / 0.32, 0, 1), tracer = i === 0 || i === S.n >> 1;
    strainColour(S, s, 1, c);
    if (tracer) (c[0] = 1), (c[1] = 0.95), (c[2] = 0.8);
    const v = tracer ? 1 : 0.45 + 0.55 * a;
    for (const [X, w] of [[X0, 1 - fr], [(X0 + 1) % W, fr]]) {
      const o = row + X * 3, k = w * v;
      const m = tracer ? 0 : 0.65 - 0.35 * a;
      hist[o] = max(hist[o], (m + (1 - m) * c[0]) * k);
      hist[o + 1] = max(hist[o + 1], (m + (1 - m) * c[1]) * k);
      hist[o + 2] = max(hist[o + 2], (m + (1 - m) * c[2]) * k);
    }
  }
}

function advance(S, d) {
  const steps = max(1, round((d * TS) / DT)), h = (d * TS) / steps;
  for (let k = 0; k < steps; k++) step(S, h);
  S.rowT += d;
  while (S.rowT >= ROW_T) {
    S.rowT -= ROW_T;
    record(S);
  }
}

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const kv = input.knobValues || [0, 2, 0.86, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  S.K = cl(kv[3], 1, 4);
  if (input.btnPressed && input.btnPressed[1]) S.dir = -S.dir;
  const dr = cl(kv[1], 0, 3);
  S.F = (S.dir * (0.04 * dr + 0.1 * dr * dr)) / TAU;
  const n = cl(round(M / cl(kv[2], 0.86, 1.2)), 10, 14);
  if (n !== S.n) load(S, n);
  if (!S.started) {
    S.started = true;
    for (let f = 0; f < HR * 3; f++) advance(S, 1 / 30);
  }
  advance(S, d);
}

function surface(S, X) {
  const u = (X + 0.5) / P - 0.5, A = 3 + 1.25 * S.K;
  return YB - (A * (1 - cos(TAU * u))) / 2;
}

function plot(rgb, X, Y, r, g, b, a) {
  if (Y < 0 || Y >= H || a <= 0) return;
  X = ((X % W) + W) % W;
  const o = (Y * W + X) * 3;
  rgb[o] = max(rgb[o], r * a);
  rgb[o + 1] = max(rgb[o + 1], g * a);
  rgb[o + 2] = max(rgb[o + 2], b * a);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.n) return;
  const rgb = S.rgb, c = S.c, c2 = S.c2, n = S.n, x = S.x;
  rgb.fill(0);
  // The floor: a ridge line over a dim fill down to the valley floors.
  hsv(0.64 + S.hue, 0.55, 1, c2);
  for (let X = 0; X < W; X++) {
    const ys = surface(S, X);
    for (let Y = floor(ys) + 1; Y <= YB + 2; Y++) plot(rgb, X, Y, c2[0], c2[1], c2[2], 0.3 - 0.15 * cl((Y - ys) / 8, 0, 1));
    plot(rgb, X, floor(ys), c2[0], c2[1], c2[2], 0.55 + 0.45 * (1 - (ys - floor(ys))));
  }
  // Bonds between the balls, coloured by their stretch, then the balls.
  const sm = strainRow(S);
  const bx = (i) => P * x[i] + P / 2 - 0.5;
  const by = (X) => surface(S, ((X % W) + W) % W) - 1.8;
  for (let i = 0; i < n; i++) {
    const xa = bx(i), xb = i < n - 1 ? bx(i + 1) : bx(0) + W, ya = by(xa), yb = by(xb);
    strainColour(S, (xb - xa) / P - 1, 1, c);
    const len = max(2, Math.ceil(abs(xb - xa) + abs(yb - ya)) * 2);
    for (let k = 0; k <= len; k++) {
      const t = k / len;
      plot(rgb, round(xa + (xb - xa) * t), round(ya + (yb - ya) * t), c[0], c[1], c[2], 0.8);
    }
  }
  for (let i = 0; i < n; i++) {
    const X = bx(i), Y = by(X);
    strainColour(S, sm[((round(X) % W) + W) % W], 1, c);
    if (i === 0 || i === n >> 1) (c[0] = 1), (c[1] = 0.95), (c[2] = 0.8);
    for (let yy = floor(Y - 3); yy <= Math.ceil(Y + 3); yy++)
      for (let xx = floor(X - 3); xx <= Math.ceil(X + 3); xx++) {
        const e2 = (xx - X) * (xx - X) + (yy - Y) * (yy - Y), a = cl(2.2 - e2 / 2.4, 0, 1);
        const w = cl(1 - e2 / 3, 0, 1);
        plot(rgb, xx, yy, c[0] + (1 - c[0]) * w, c[1] + (1 - c[1]) * w, c[2] + (1 - c[2]) * w, a);
      }
  }
  // The history, oldest row on top.
  for (let r = 0; r < HR; r++) {
    const src = ((S.head + 1 + r) % HR) * W * 3, dst = r * W * 3;
    for (let k = 0; k < W * 3; k++) rgb[dst + k] = S.hist[src + k];
  }
  for (let Y = 0; Y < H; Y++)
    for (let X = 0; X < W; X++) {
      const o = (Y * W + X) * 3;
      display.setPixel(X, Y, min(255, rgb[o] * 255) | 0, min(255, rgb[o + 1] * 255) | 0, min(255, rgb[o + 2] * 255) | 0);
    }
}
