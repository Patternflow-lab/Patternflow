// ===== Patternflow pattern =====
// Title:   Kármán Street
// Family:  sim
// Idea:    Two columns of point vortices of opposite spin run down the whole panel, staggered half a spacing, each one winding its own colour of dye into a spiral; at von Kármán's ratio of the gap between the columns to the spacing, 0.2806, the street holds, and anywhere else a wobble too small to see grows until the columns roll up and break into pairs that wander off, and a fresh street is laid.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kármán vortex street and its stability (Theodore von Kármán, 1911), pattern round 37
// Round:   37
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Vortices=4..8, Offset=-0.15..0.25
//
// Knob 1: Hue. Turns both dyes round the wheel together: at 0 the left column is aqua and the right one rose.
// Knob 2: Speed. How fast the flow runs: at 2 the street slides down 5 LEDs a second, and with 4 vortices a column dye 3 LEDs from a core goes round in 0.8 seconds and dye 6 LEDs out in 2; at 0.2 ten times slower.
// Knob 3: Vortices. Vortices in each column over the 128 rows, 4 to 8, so the spacing a runs from 32 LEDs down to 16 and the gap h with it.
// Knob 4: Offset. The ratio h/a is 0.2806 plus this, from 0.13 to 0.53. At 0 the street holds, for two to four minutes, and both dyes turn gold; at the start, 0.34, the wobble breaks it in 12 to 24 seconds, at either end in about 5. A broken street is replaced 7 seconds later, or as soon as half its vortices have left the sides.
// Buttons: K1 tap lays a fresh street at once, with a new small wobble.

// Each vortex is a whole row of copies 128 rows apart, so the panel is one
// period top to bottom. A vertical row of vortices of circulation G spaced L
// has the complex velocity -(i G / 2L) coth(pi (z - z0) / L), which in x and
// y is the kernel in velAt() below. The row of n vortices spaced a = 128 / n is
// the same sum as von Kármán's infinite row, so with the columns h apart and
// staggered by a / 2 the street moves as one at (G / 2a) tanh(pi h / a).
//
// Growth of a random wobble of 1e-7 a, with G = a, measured as the slope of
// ln(wobble) in a 600 s run (per second):
//   h/a      0.13   0.20   0.25   0.2806  0.31   0.34   0.45   0.53
//   n = 4   0.016  0.0076 0.0009 -0.001  0.0012 0.0054 0.014  0.017
//   n = 8   0.031  0.0175 0.0041  0.001  0.0057 0.0117 0.028  0.034
// At 0.2806 it stays inside +-0.0013, which is the measuring noise: the
// street is neutrally stable there. The more vortices a period holds, the
// narrower the nearly stable band round it, because a period of n allows
// only wobbles whose phase steps by a multiple of 2 pi / n from one vortex
// to the next; with 3 a column h/a = 0.34 grows at 0.0017, a third of the
// rate with 4, which is why Vortices starts at 4. The pattern runs at
// G = 30 a, so at 0.34 with 4 a column the wobble grows e-fold every 6 s
// and at 0.2 every 4.4 s. Laid with a 5% wobble, the street at 0.34 came
// apart (one vortex 0.3 a off its column) after 11.5 to 24 s, median 15.5,
// over 34 streets in three four-minute runs, and at the two ends of the
// knob after 3 to 7 s; at 0.2806 it lasted 106 to 237 s in five runs, as a
// wobble that size is no longer small and grows on its own terms.

const W = 64, H = 128, N = W * H, L = 128, K = (2 * Math.PI) / L;
const { floor, min, max, exp, sin, cos, tanh, abs, PI } = Math;
const random = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// von Kármán's ratio: cosh(pi h / a) = sqrt 2.
const STABLE = Math.log(Math.SQRT2 + 1) / PI;
const NT = 3600, MAXV = 16;
// Circulation per LED of spacing, the wobble a fresh street is laid with
// (as a share of a), the speed the street is shown sliding down, and the
// seconds between two lines of dye from one vortex.
const GAM = 30, EPS = 0.05, VSHOW = 5, PULSE = 2.4;
// Dye cores: a tracer within RC of a vortex goes round as a solid body.
const RCF = 0.09;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const F = (n) => new Float32Array(n), D = (n) => new Float64Array(n);
  const S = (params.s = {
    hue: 0, speed: 2, n: 4, ratio: STABLE + 0.06, want: [4, STABLE + 0.06], pend: 0,
    vx: D(MAXV), vy: D(MAXV), vg: D(MAXV), x0: D(MAXV), m: 0, a: 32, wy: 0,
    // Stage positions of the vortices and their precomputed exp and trig.
    sx: D(MAXV * 4), sy: D(MAXV * 4), ex: D(MAXV * 4), ix: D(MAXV * 4), cy: D(MAXV * 4), sn: D(MAXV * 4),
    kv: D(MAXV * 8),
    tx: F(NT), ty: F(NT), age: F(NT), pt: D(MAXV), pp: new Uint8Array(MAXV),
    kx: F(NT * 4), ky: F(NT * 4),
    A: F(N), B: F(N), T: F(N), col: F(6),
    broken: 0, fade: 1, out: 0, warm: false,
  });
  lay(S, 4, STABLE + 0.06);
}

function lay(S, n, ratio) {
  const a = L / n, h = ratio * a, G = GAM * a;
  S.n = n;
  S.ratio = ratio;
  S.a = a;
  S.m = 2 * n;
  // The left column spins one way and the right one the other, the way a
  // wake's shear layers roll up, so on its own the street would climb at U
  // through still water. The water is given a downward flow of VSHOW + U, so
  // the street slides down at VSHOW and the dye that leaves it streams down
  // faster between the vortices.
  const U = (G / (2 * a)) * tanh((PI * h) / a);
  S.wy = VSHOW + U;
  const y0 = random() * a;
  for (let i = 0; i < n; i++) {
    S.vx[i] = 32 - h / 2;
    S.vy[i] = y0 + i * a;
    S.vg[i] = -G;
    S.vx[n + i] = 32 + h / 2;
    S.vy[n + i] = y0 + i * a + a / 2;
    S.vg[n + i] = G;
  }
  // The wobble: each vortex moved up to EPS a either way, then each
  // column's mean move taken out again. A column shifted as a whole along
  // the street breaks the half-spacing stagger, and then both columns push
  // each other the same way sideways: the street drifted 8 LEDs off centre
  // in 20 s before this.
  for (let i = 0; i < 2 * n; i++) {
    S.x0[i] = S.vx[i];
    S.kv[2 * i] = (random() - 0.5) * 2 * EPS * a;
    S.kv[2 * i + 1] = (random() - 0.5) * 2 * EPS * a;
  }
  for (let c = 0; c < 2; c++) {
    let mx = 0, my = 0;
    for (let i = c * n; i < c * n + n; i++) (mx += S.kv[2 * i]), (my += S.kv[2 * i + 1]);
    for (let i = c * n; i < c * n + n; i++) {
      S.vx[i] += S.kv[2 * i] - mx / n;
      S.vy[i] += S.kv[2 * i + 1] - my / n;
    }
  }
  // No dye yet; the vortices start dropping it at staggered moments.
  S.age.fill(-1);
  for (let p = 0; p < S.m; p++) S.pt[p] = PULSE * (((p * 0.618) % 1) * 0.8 + 0.2 * random());
  S.broken = 0;
}

// Every PULSE seconds a vortex drops a straight line of dye across its core,
// alternating between two sets of tracers, so each set lives two pulses.
// A continuous drip was tried first: in a steady swirl every radius then
// fills its whole ring and the core reads as a speckled disc. A line laid
// at once winds into a spiral, the inside turning faster than the outside.
function pulse(S, p) {
  const m = S.m, per = floor(NT / m), C = per >> 1, par = (S.pp[p] ^= 1), R = 0.56 * S.a;
  const th = (random() - 0.5) * 0.6, c = cos(th), s = sin(th);
  for (let j = par; j < 2 * C; j += 2) {
    const i = j * m + p, r = R * ((((j >> 1) + 0.5) / C) * 2 - 1);
    S.tx[i] = S.vx[p] + r * c;
    S.ty[i] = S.vy[p] + r * s;
    S.age[i] = 0;
  }
}

// Velocity at (x, y) from the vortices of stage s, written to out[o], out[o+1].
// exp(K (x - xv)) is exp(K x) exp(-K xv) and the angle difference comes from
// the sum formulas, so a tracer costs one exp, one sin and one cos per stage
// whatever the number of vortices.
function velAt(S, s, x, y, dl, skip, out, o) {
  const m = S.m, b = s * MAXV, c2 = 1 / (2 * L);
  const et = exp(K * x), it = 1 / et, cyt = cos(K * y), syt = sin(K * y);
  let u = 0, v = 0;
  for (let i = 0; i < m; i++) {
    if (i === skip) continue;
    const j = b + i, E = et * S.ix[j], iE = it * S.ex[j];
    const cY = cyt * S.cy[j] + syt * S.sn[j], sY = syt * S.cy[j] - cyt * S.sn[j];
    const q = (S.vg[i] * c2) / (0.5 * (E + iE) - cY + dl);
    u -= q * sY;
    v += q * 0.5 * (E - iE);
  }
  out[o] = u;
  out[o + 1] = v + S.wy;
}

function prep(S, s) {
  for (let i = 0, b = s * MAXV; i < S.m; i++) {
    const x = S.sx[b + i], y = S.sy[b + i];
    S.ex[b + i] = exp(K * x);
    S.ix[b + i] = 1 / S.ex[b + i];
    S.cy[b + i] = cos(K * y);
    S.sn[b + i] = sin(K * y);
  }
}

// One RK4 step of the vortices and the dye together.
function step(S, h) {
  const m = S.m, kv = S.kv, kx = S.kx, ky = S.ky;
  const dv = 0.5 * (K * 0.5) * (K * 0.5), rc = RCF * S.a, dt = 0.5 * (K * rc) * (K * rc);
  const cf = [0, 0.5, 0.5, 1];
  for (let s = 0; s < 4; s++) {
    const b = s * MAXV;
    for (let i = 0; i < m; i++) {
      S.sx[b + i] = S.vx[i] + (s ? cf[s] * h * kv[(s - 1) * MAXV * 2 + 2 * i] : 0);
      S.sy[b + i] = S.vy[i] + (s ? cf[s] * h * kv[(s - 1) * MAXV * 2 + 2 * i + 1] : 0);
    }
    prep(S, s);
    for (let i = 0; i < m; i++) velAt(S, s, S.sx[b + i], S.sy[b + i], dv, i, kv, s * MAXV * 2 + 2 * i);
    const tmp = [0, 0];
    for (let i = 0; i < NT; i++) {
      if (S.age[i] < 0) continue;
      const x = S.tx[i] + (s ? cf[s] * h * kx[(s - 1) * NT + i] : 0), y = S.ty[i] + (s ? cf[s] * h * ky[(s - 1) * NT + i] : 0);
      velAt(S, s, x, y, dt, -1, tmp, 0);
      kx[s * NT + i] = tmp[0];
      ky[s * NT + i] = tmp[1];
    }
  }
  for (let i = 0; i < m; i++) {
    const o = 2 * i, M = MAXV * 2;
    S.vx[i] += (h / 6) * (kv[o] + 2 * kv[M + o] + 2 * kv[2 * M + o] + kv[3 * M + o]);
    S.vy[i] += (h / 6) * (kv[o + 1] + 2 * kv[M + o + 1] + 2 * kv[2 * M + o + 1] + kv[3 * M + o + 1]);
    S.vy[i] -= L * floor(S.vy[i] / L);
  }
  for (let i = 0; i < NT; i++) {
    if (S.age[i] < 0) continue;
    S.tx[i] += (h / 6) * (kx[i] + 2 * kx[NT + i] + 2 * kx[2 * NT + i] + kx[3 * NT + i]);
    S.ty[i] += (h / 6) * (ky[i] + 2 * ky[NT + i] + 2 * ky[2 * NT + i] + ky[3 * NT + i]);
    S.ty[i] -= L * floor(S.ty[i] / L);
    S.age[i] += h;
    if (S.age[i] > 2 * PULSE || abs(S.tx[i] - 32) > 70) S.age[i] = -1;
  }
  for (let p = 0; p < m; p++) if ((S.pt[p] -= h) <= 0) {
    S.pt[p] += PULSE;
    pulse(S, p);
  }
}

// How far the street has come apart: the largest sideways move of one
// vortex from its column, the whole street's sideways drift taken out.
function wobble(S) {
  let mean = 0, off = 0, dev = 0;
  for (let i = 0; i < S.m; i++) mean += S.vx[i] - S.x0[i];
  mean /= S.m;
  for (let i = 0; i < S.m; i++) {
    dev = max(dev, abs(S.vx[i] - S.x0[i] - mean));
    if (S.vx[i] < -8 || S.vx[i] > W + 8) off++;
  }
  return [dev / S.a, off];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 4, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1], 0.2, 3);
  const n = floor(cl(k[2], 4, 8) + 0.5), ratio = STABLE + cl(k[3], -0.15, 0.25);
  if (!S.warm) {
    S.warm = true;
    if (n !== S.n || abs(ratio - S.ratio) > 1e-6) lay(S, n, ratio);
    // Open with six seconds of dye already wound.
    for (let i = 0; i < 180; i++) step(S, 1 / 30);
  }
  // A turned knob lays a new street once it has rested a third of a second.
  if (n !== S.n || abs(ratio - S.ratio) > 0.004) {
    if (n !== S.want[0] || abs(ratio - S.want[1]) > 1e-6) {
      S.want = [n, ratio];
      S.pend = 0.35;
    } else if (S.pend > 0 && (S.pend -= d) <= 0 && !S.out) S.out = 1;
  }
  if (input.btnPressed && input.btnPressed[0] && !S.out) S.out = 1;
  // A core turns at G / (2 pi RC^2) radians a second, 18 with 4 a column
  // and 37 with 8; a step is kept under 0.7 radian of that, which RK4
  // carries without the core's dye spiralling in or out.
  const h = (d * S.speed) / 2;
  const sub = max(1, Math.ceil(((GAM / (2 * PI * RCF * RCF * S.a)) * h) / 0.7));
  for (let i = 0; i < sub; i++) step(S, h / sub);
  const [dev, off] = wobble(S);
  if (dev > 0.3) S.broken += h;
  // Broken for 7 s, or half the vortices gone off the sides: lay a new one.
  if (!S.out && (S.broken > 7 || off >= S.n)) S.out = 1;
  if (S.out) {
    S.fade -= d / 0.4;
    if (S.fade <= 0) {
      S.fade = 0;
      S.out = 0;
      lay(S, n, ratio);
      S.want = [n, ratio];
      // Every vortex drops its first line in the 2.4 s run here, while the
      // panel is dark, so the new street comes up whole.
      for (let i = 0; i < 72; i++) step(S, 1 / 30);
    }
  } else S.fade = min(1, S.fade + d / 0.6);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const A = S.A, B = S.B, T = S.T, col = S.col;
  A.fill(0);
  B.fill(0);
  for (let i = 0; i < NT; i++) {
    const age = S.age[i];
    if (age < 0) continue;
    const u = age / (2 * PULSE), env = min(1, age / 0.35) * (1 - u) ** 0.7;
    const buf = i % S.m < S.n ? A : B;
    const fx = S.tx[i] - 0.5, fy = S.ty[i] - 0.5, ix = floor(fx), iy = floor(fy), ax = fx - ix, ay = fy - iy;
    if (ix < -1 || ix >= W) continue;
    const y0 = ((iy % H) + H) % H, y1 = (y0 + 1) % H;
    if (ix >= 0) {
      buf[y0 * W + ix] += env * (1 - ax) * (1 - ay);
      buf[y1 * W + ix] += env * (1 - ax) * ay;
    }
    if (ix + 1 < W) {
      buf[y0 * W + ix + 1] += env * ax * (1 - ay);
      buf[y1 * W + ix + 1] += env * ax * ay;
    }
  }
  blur(A, T);
  blur(B, T);
  // Dyes: aqua and rose at Hue 0. Near von Kármán's ratio both turn gold,
  // the left column deep and the right one pale, the mark of the one street
  // that holds: full gold within 0.005 of it, half at 0.01.
  const gd = (S.ratio - STABLE) / 0.012, gold = exp(-gd * gd);
  const hA = S.hue + 0.5, hB = S.hue + 0.92;
  const wA = max(warmth(hA), gold), wB = max(warmth(hB), gold);
  hsv(hA, 0.8 - 0.35 * warmth(hA), 1, col, 0);
  hsv(hB, 0.62 - 0.25 * warmth(hB), 1, col, 3);
  const G1 = [1, 0.74, 0.3], G2 = [1, 0.9, 0.62];
  for (let c = 0; c < 3; c++) {
    col[c] += (G1[c] - col[c]) * 0.92 * gold;
    col[3 + c] += (G2[c] - col[3 + c]) * 0.92 * gold;
  }
  // Warm dye climbs to full brightness sooner and its faint end is lifted,
  // so an old spiral of gold reads pale rather than olive.
  const kA = 0.55 + 0.4 * wA, kB = 0.55 + 0.4 * wB, gA = 1 - 0.35 * wA, gB = 1 - 0.35 * wB, f = S.fade * 255;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const a = (1 - exp(-A[p] * kA)) ** gA, b = (1 - exp(-B[p] * kB)) ** gB, hi = max(0, a + b - 1.1) * 0.6;
      display.setPixel(x, y, (col[0] * a + col[3] * b + hi) * f, (col[1] * a + col[4] * b + hi) * f, (col[2] * a + col[5] * b + hi) * f);
    }
}

// 1 where a hue is orange to yellow-green, which read brown and olive when
// dim, so there the dye is paler and climbs to full brightness sooner.
function warmth(h) {
  const t = h - floor(h);
  return sm(0.0, 0.05, t) * (1 - sm(0.17, 0.24, t));
}

// [1 2 1] along rows then columns, wrapping top to bottom.
function blur(a, t) {
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) t[o + x] = 0.5 * a[o + x] + 0.25 * (a[o + (x > 0 ? x - 1 : x)] + a[o + (x < W - 1 ? x + 1 : x)]);
  }
  for (let y = 0; y < H; y++) {
    const o = y * W, u = ((y + H - 1) % H) * W, dn = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) a[o + x] = 0.5 * t[o + x] + 0.25 * (t[u + x] + t[dn + x]);
  }
}
