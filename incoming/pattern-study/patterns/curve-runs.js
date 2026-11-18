// ===== Patternflow pattern =====
// Title:   Rectangle Runs
// Family:  algo
// Idea:    A rectangle wanders over a grid drawn twice, numbered along the Hilbert curve on top and along Morton's Z-order below, and each run of consecutive numbers it holds gets a colour of its own, so the same rectangle falls into a few large pieces on the Hilbert square and many small ones on the Z-order square, until it shrinks onto one of the grid's own blocks and both curves hold it in a single run, while two bars between the squares count the pieces, a step of its own colour for each, against the mean over every position the rectangle could take.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Hilbert curve (David Hilbert, 1891), Z-order curve (Guy Morton, 1966), pattern round 107
// Round:   107
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Grid=1..3, Size=0.6..1, Speed=1..3.5
//
// Knob 1: Hue. Turns the colour of every run round the wheel. At 0 the runs come out cyan, blue, violet, magenta and red; at 0.5 they come out red, orange, yellow, green and cyan.
// Knob 2: Grid. Picks the grid, 1 for 8 x 8 cells, 2 for 16 x 16 and 3 for 32 x 32, at 8, 4 and 2 LEDs a cell; a turn fades the squares out and back in. At 1 the curve can be followed cell by cell and a rectangle is a few cells wide; at 3 the rectangle is up to 23 cells wide and Morton's order cuts it into as many as 64 runs.
// Knob 3: Size. The side of the rectangle, as a share of the longest one the bars have room for: 6 cells on grid 1, 11 on grid 2 and 23 on grid 3. Each side breathes by a fifth either way. On grid 2 the sides run from 4 to 7 cells at 0.6 (about 5 runs on the Hilbert curve and 9 on Morton's) and from 7 to 11 at 1 (about 8 and 15).
// Knob 4: Speed. How fast the rectangle wanders, and with it the white head that walks each run and the breathing. The centre steers to a random waypoint at 0.12 of the window a second times Speed, so at 1 it crosses the window in about 8 s and at 3.5 in 2.4 s. Every second waypoint is a block of the grid, 4 cells a side on grid 2: the rectangle shrinks onto it, rests 1.8 s at Speed 1 (1 s at 3.5) as one run on both curves, and sets off again. The head walks 12 cells a second times Speed.

const W = 64, H = 128, NP = W * H;
const { floor, ceil, min, max, abs, sin, sqrt, exp, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// Two squares of 56 x 56 LEDs, one above the other, the Hilbert curve on top
// and Morton's Z-order below. The grid is 2^o cells a side, o = 3, 4 or 5, and
// a square shows only its top left 7/8: 7, 14 or 28 cells at 8, 4 or 2 LEDs a
// cell. That leaves 16 rows between the squares for the two bars.
const TS = 56, TX = 4, TY = [0, 72];
const BY = [58, 65], BH = 5;
// The longest side a rectangle gets on each grid, and the LEDs one run is wide
// in the bars. Counted over every position, a rectangle that long makes at
// most 16, 28 and 64 runs on Morton's curve, so the bar fits a row of 64.
const ORDERS = [3, 4, 5], SMAX = [6, 11, 23], UNIT = [4, 2, 1], RULER = [4, 5, 10];
const GOLD = 0.6180339887, PLASTIC = 0.7548776662;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The Hilbert curve by its own recursion: the quarter in the top left is the
// curve of the order below turned over its diagonal, the next two are it
// as it is, and the last is it turned over the other diagonal.
function hilbertPoints(o) {
  let X = [0], Y = [0], m = 1;
  for (let s = 0; s < o; s++) {
    const nx = [], ny = [], c = X.length;
    for (let i = 0; i < c; i++) { nx.push(Y[i]); ny.push(X[i]); }
    for (let i = 0; i < c; i++) { nx.push(X[i]); ny.push(Y[i] + m); }
    for (let i = 0; i < c; i++) { nx.push(X[i] + m); ny.push(Y[i] + m); }
    for (let i = 0; i < c; i++) { nx.push(2 * m - 1 - Y[i]); ny.push(m - 1 - X[i]); }
    X = nx; Y = ny; m *= 2;
  }
  return [X, Y];
}

// Morton's order: the bits of x and y taken turns, x first.
function mortonPoints(o) {
  const N = 1 << (2 * o), X = [], Y = [];
  for (let d = 0; d < N; d++) {
    let x = 0, y = 0;
    for (let b = 0; b < o; b++) { x |= ((d >> (2 * b)) & 1) << b; y |= ((d >> (2 * b + 1)) & 1) << b; }
    X.push(x); Y.push(y);
  }
  return [X, Y];
}

// A line of at most one LED a step into a tile's own grey, keeping the brighter.
function line(U, x0, y0, x1, y1, v) {
  const steps = max(1, ceil(max(abs(x1 - x0), abs(y1 - y0))));
  for (let s = 0; s <= steps; s++) {
    const x = round(x0 + ((x1 - x0) * s) / steps), y = round(y0 + ((y1 - y0) * s) / steps);
    if (x < 0 || y < 0 || x >= TS || y >= TS) continue;
    if (U[y * TS + x] < v) U[y * TS + x] = v;
  }
}

function buildOrder(o) {
  const n = 1 << o, N = n * n, c = W / n, wc = (n * 7) / 8;
  const curves = [hilbertPoints(o), mortonPoints(o)];
  const dOf = [], cellOf = [], ex = [], under = [];
  for (let ci = 0; ci < 2; ci++) {
    const [X, Y] = curves[ci];
    const dof = new Int16Array(N), cof = new Int16Array(N);
    for (let d = 0; d < N; d++) { cof[d] = Y[d] * n + X[d]; dof[Y[d] * n + X[d]] = d; }
    dOf.push(dof); cellOf.push(cof);
    // The steps of the curve, for counting how many a rectangle holds.
    const e = new Int8Array(4 * (N - 1));
    for (let d = 0; d + 1 < N; d++) { e[4 * d] = X[d]; e[4 * d + 1] = Y[d]; e[4 * d + 2] = X[d + 1]; e[4 * d + 3] = Y[d + 1]; }
    ex.push(e);
    // What lies under the rectangle: the lines the grid is cut by, dimmer
    // as the pieces get smaller, and the curve itself, fainter.
    const U = new Float32Array(TS * TS);
    for (let L = 1; L < o; L++) {
      const v = [0, 0, 30, 46, 70][L + (5 - o)] || 0, step = (1 << L) * c;
      if (v === 0) continue;
      for (let g = step; g < TS; g += step) for (let t = 0; t < TS; t++) {
        if (U[t * TS + g] < v) U[t * TS + g] = v;
        if (U[g * TS + t] < v) U[g * TS + t] = v;
      }
    }
    for (let d = 0; d + 1 < N; d++) {
      const ax = X[d] * c + c / 2 - 0.5, ay = Y[d] * c + c / 2 - 0.5, bx = X[d + 1] * c + c / 2 - 0.5, by = Y[d + 1] * c + c / 2 - 0.5;
      const len = sqrt((X[d + 1] - X[d]) ** 2 + (Y[d + 1] - Y[d]) ** 2);
      line(U, ax, ay, bx, by, (o === 5 ? 28 : 38) / (1 + 0.45 * (len - 1)));
    }
    under.push(U);
  }
  // How strongly the two coarsest cuts of the grid show where the rectangle
  // lies: columns first, then rows.
  const cut = new Float32Array(2 * TS);
  for (let L = max(1, o - 2); L < o; L++) {
    const a = L === o - 1 ? 0.55 : 0.28, step = (1 << L) * c;
    for (let g = step; g < TS; g += step) cut[g] = cut[g + TS] = max(cut[g], a);
  }
  return { o, n, N, c, wc, dOf, cellOf, ex, under, cut, u: UNIT[o - 3] };
}

export function setup(params) {
  const O = ORDERS.map(buildOrder);
  const cells = 1024;
  params.s = {
    O, oi: -1,
    // The rectangle: centre in window units, wandering between waypoints.
    ux: 0.46, uy: 0.5, vx: 0, vy: 0, tx: 0.6, ty: 0.3, ph: 0, hp: 0, mode: 0, wp: 0, sn: 0, hold: 0, bs: 4,
    x0: 0, y0: 0, w: 1, h: 1, key: "", sizeKey: "",
    inR: new Uint8Array(cells), runOf: [new Int16Array(cells), new Int16Array(cells)], rank: [new Int16Array(cells), new Int16Array(cells)],
    rlen: [new Int16Array(cells), new Int16Array(cells)], runs: [0, 0], st: [null, null], rgb: new Float32Array(cells * 3),
    hue: 0, fade: 1, fadeDir: 0, nextOi: 1, sz: 0.6, sp: 1,
    out: new Float32Array(NP * 3),
  };
}

// Runs of the rectangle on one curve: the curve numbers it holds, in maximal
// blocks of consecutive ones. Each cell gets its run, its place in the run
// and the run's length.
function analyse(S, ci) {
  const O = S.O[S.oi], n = O.n, N = O.N, inR = S.inR, dOf = O.dOf[ci], cellOf = O.cellOf[ci];
  inR.fill(0, 0, N);
  for (let y = S.y0; y < S.y0 + S.h; y++) for (let x = S.x0; x < S.x0 + S.w; x++) inR[dOf[y * n + x]] = 1;
  const runOf = S.runOf[ci], rank = S.rank[ci], rlen = S.rlen[ci];
  runOf.fill(-1, 0, N);
  let runs = 0, start = 0;
  for (let d = 0; d < N; d++) {
    if (!inR[d]) {
      if (d > 0 && inR[d - 1]) rlen[runs - 1] = d - start;
      continue;
    }
    if (d === 0 || !inR[d - 1]) { runs++; start = d; }
    runOf[cellOf[d]] = runs - 1;
    rank[cellOf[d]] = d - start;
  }
  if (inR[N - 1]) rlen[runs - 1] = N - start;
  S.runs[ci] = runs;
}

// Over every position the rectangle can take in the window: the mean, the
// least and the most runs it makes. Every step of the curve with both ends in
// the rectangle joins two of its w * h cells into one run, so the runs are the
// cells less those steps. A step is inside for a block of positions, and the
// blocks are summed on a grid of differences.
function statsFor(S, ci, w, h) {
  const O = S.O[S.oi], wc = O.wc, e = O.ex[ci], px = wc - w + 1, py = wc - h + 1, stride = px + 1;
  const diff = new Int32Array(stride * (py + 1));
  for (let i = 0; i < e.length; i += 4) {
    const ax = e[i], ay = e[i + 1], bx = e[i + 2], by = e[i + 3];
    const xl = max(0, max(ax, bx) - w + 1), xh = min(px - 1, min(ax, bx));
    const yl = max(0, max(ay, by) - h + 1), yh = min(py - 1, min(ay, by));
    if (xl > xh || yl > yh) continue;
    diff[yl * stride + xl]++; diff[yl * stride + xh + 1]--; diff[(yh + 1) * stride + xl]--; diff[(yh + 1) * stride + xh + 1]++;
  }
  let sum = 0, mx = 0, mn = 1e9;
  for (let y = 0; y < py; y++) for (let x = 0; x < px; x++) {
    const v = diff[y * stride + x] + (x ? diff[y * stride + x - 1] : 0) + (y ? diff[(y - 1) * stride + x] : 0) - (x && y ? diff[(y - 1) * stride + x - 1] : 0);
    diff[y * stride + x] = v;
    const r = w * h - v;
    sum += r; if (r > mx) mx = r; if (r < mn) mn = r;
  }
  return { mean: sum / (px * py), max: mx, min: mn };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.6, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  const want = round(cl(k[1], 1, 3)) - 1;
  S.sz = cl(k[2], 0.6, 1);
  S.sp = cl(k[3], 1, 3.5);
  // A new grid fades the squares out, swaps them and fades them in.
  if (S.oi < 0) S.oi = want;
  if (want !== S.oi && S.fadeDir === 0) { S.fadeDir = -1; S.nextOi = want; }
  if (S.fadeDir === -1) {
    S.fade = max(0, S.fade - d / 0.12);
    if (S.fade <= 0) { S.oi = S.nextOi; S.key = ""; S.fadeDir = 1; S.mode = 0; S.sn = 0; }
  } else if (S.fadeDir === 1) {
    S.fade = min(1, S.fade + d / 0.2);
    if (S.fade >= 1) S.fadeDir = 0;
  }
  const O = S.O[S.oi], wc = O.wc;
  S.ph += d * S.sp;
  S.hp += d * S.sp;
  // Each side breathes by a fifth on its own beat, and the largest the Size
  // knob allows is SMAX, which is as long as the bars can show.
  const s = max(2.2, (S.sz * SMAX[S.oi]) / 1.2);
  // The centre steers to a waypoint and picks another on arrival. Every second
  // waypoint is the middle of a block of the grid, 2, 4 or 8 cells a side:
  // the rectangle shrinks onto it and rests there, and for as long as it does
  // both curves hold it in one run.
  const dx = S.tx - S.ux, dy = S.ty - S.uy, dist = sqrt(dx * dx + dy * dy);
  if (S.mode === 2) {
    S.hold -= d;
    if (S.hold <= 0) { S.mode = 0; S.tx = 0.08 + 0.84 * Math.random(); S.ty = 0.08 + 0.84 * Math.random(); }
  } else if (S.mode === 1 && dist < 0.03) {
    S.ux = S.tx; S.uy = S.ty; S.vx = S.vy = 0; S.sn = 1; S.mode = 2; S.hold = 1.8 / sqrt(S.sp);
  } else if (S.mode === 0 && dist < 0.1) {
    if (++S.wp % 2 === 0) {
      // A block at least 0.3 of the window away, so the rectangle has the
      // way there to shrink in.
      const b = [8, 4].find((q) => q <= s * 1.2 && floor(wc / q) >= 2) || 2, K = floor(wc / b);
      let bx = 0, by = 0, far = -1;
      for (let t = 0; t < 8 && far < 0.3; t++) {
        const cx = (b * floor(K * Math.random()) + b / 2) / wc, cy = (b * floor(K * Math.random()) + b / 2) / wc, dd = sqrt((cx - S.ux) ** 2 + (cy - S.uy) ** 2);
        if (dd > far) { far = dd; bx = cx; by = cy; }
      }
      S.bs = b; S.mode = 1; S.tx = bx; S.ty = by;
    } else { S.tx = 0.08 + 0.84 * Math.random(); S.ty = 0.08 + 0.84 * Math.random(); }
  }
  if (S.mode !== 2) {
    const vmax = 0.12 * S.sp, sl = min(1, dist / 0.25), ge = 1 - exp(-d / 0.5);
    S.vx += ((dx / max(dist, 1e-6)) * vmax * sl - S.vx) * ge;
    S.vy += ((dy / max(dist, 1e-6)) * vmax * sl - S.vy) * ge;
    S.ux = cl(S.ux + S.vx * d, 0, 1);
    S.uy = cl(S.uy + S.vy * d, 0, 1);
    // Near its block the rectangle shrinks to it; once away it grows back.
    const near = S.mode === 1 ? ease(1 - dist / 0.3) : 0;
    S.sn = max(near, S.sn - d / 0.9);
  }
  const bw = S.bs * S.sn, f0 = 1 - S.sn;
  const w = cl(round(s * (1 + 0.2 * sin(S.ph * 0.37 + 0.6)) * f0 + bw), 1, wc), h = cl(round(s * (1 + 0.2 * sin(S.ph * 0.29 + 2.4)) * f0 + bw), 1, wc);
  const x0 = cl(round(S.ux * wc - w / 2), 0, wc - w), y0 = cl(round(S.uy * wc - h / 2), 0, wc - h);
  const key = S.oi + ":" + x0 + ":" + y0 + ":" + w + ":" + h;
  if (key !== S.key) {
    S.key = key; S.x0 = x0; S.y0 = y0; S.w = w; S.h = h;
    analyse(S, 0); analyse(S, 1);
    const sizeKey = S.oi + ":" + w + ":" + h;
    if (sizeKey !== S.sizeKey) { S.sizeKey = sizeKey; S.st[0] = statsFor(S, 0, w, h); S.st[1] = statsFor(S, 1, w, h); }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.oi < 0) return;
  const O = S.O[S.oi], n = O.n, c = O.c, out = S.out, u = O.u, rgb = S.rgb, cut = O.cut;
  out.fill(0);
  const tmp = [0, 0, 0];
  for (let ci = 0; ci < 2; ci++) {
    // The colour of every cell the rectangle holds: a hue and a lightness per
    // run, darker at the run's start and brighter at its end, and a white
    // head that walks each run in curve order, one after another.
    const runOf = S.runOf[ci], rank = S.rank[ci], rlen = S.rlen[ci];
    for (let y = S.y0; y < S.y0 + S.h; y++) for (let x = S.x0; x < S.x0 + S.w; x++) {
      const q = y * n + x, r = runOf[q], k = rank[q], L = rlen[r], f = (k + 0.5) / L;
      hsv(S.hue + 0.52 + 0.5 * ((r * GOLD) % 1), 0.9 - 0.35 * f * f, (0.74 + 0.26 * f) * (0.86 + 0.14 * ((r * PLASTIC) % 1)), tmp, 0);
      const dl = ((S.hp * max(12, L / 2.5) + r * 5.3) % (L + 8)) - k, gl = dl >= 0 && dl < 12 ? 0.8 * exp(-dl / 2.2) : 0;
      rgb[q * 3] = (tmp[0] + (1 - tmp[0]) * gl) * 255; rgb[q * 3 + 1] = (tmp[1] + (1 - tmp[1]) * gl) * 255; rgb[q * 3 + 2] = (tmp[2] + (1 - tmp[2]) * gl) * 255;
    }
    const U = O.under[ci], ty = TY[ci];
    for (let py = 0; py < TS; py++) {
      const cy = floor(py / c), ly = py % c;
      for (let px = 0; px < TS; px++) {
        const cx = floor(px / c), lx = px % c, q = cy * n + cx, o = ((ty + py) * W + TX + px) * 3;
        let r, g, b;
        if (cx >= S.x0 && cx < S.x0 + S.w && cy >= S.y0 && cy < S.y0 + S.h) {
          r = rgb[q * 3]; g = rgb[q * 3 + 1]; b = rgb[q * 3 + 2];
          // A dark edge between runs, where the cells are big enough for one.
          if (c >= 4) {
            const run = runOf[q];
            if ((lx === 0 && cx > S.x0 && runOf[q - 1] !== run) || (ly === 0 && cy > S.y0 && runOf[q - n] !== run)) { r *= 0.45; g *= 0.45; b *= 0.45; }
          }
          // The two biggest cuts of the grid show through the rectangle.
          const a = max(cut[px], cut[py + TS]);
          if (a > 0) { r += (255 - r) * a; g += (255 - g) * a; b += (255 - b) * a; }
        } else {
          const v = U[py * TS + px];
          r = v * 0.8; g = v * 0.92; b = v;
        }
        out[o] = r; out[o + 1] = g; out[o + 2] = b;
      }
    }
    // The bar: one run is u LEDs wide, in the colour it has in the square.
    const runs = S.runs[ci], by = BY[ci], cap = floor(W / u);
    for (let r = 0; r < min(runs, cap); r++) {
      hsv(S.hue + 0.52 + 0.5 * ((r * GOLD) % 1), 0.8, 1, tmp, 0);
      for (let i = 0; i < (u > 1 ? u - 1 : 1); i++) for (let y = 0; y < BH; y++) {
        const o = ((by + y) * W + r * u + i) * 3;
        out[o] = tmp[0] * 255; out[o + 1] = tmp[1] * 255; out[o + 2] = tmp[2] * 255;
      }
    }
    // A ruler beside the bar, a dot every RULER runs.
    const ry = ci === 0 ? by - 2 : by + BH + 1;
    for (let r = RULER[S.oi]; r * u <= W; r += RULER[S.oi]) { const o = (ry * W + r * u - 1) * 3; out[o] = out[o + 1] = out[o + 2] = 70; }
    // Over every position the rectangle can take: the most runs it makes, as
    // a grey tick, and the mean, as a white one across the bar.
    const st = S.st[ci];
    if (st) {
      let x = cl(st.max * u - 1, 0, W - 1);
      for (let y = by; y < by + BH; y++) { const o = (y * W + x) * 3; out[o] = out[o + 1] = out[o + 2] = 120; }
      x = cl(round(st.mean * u) - 1, 0, W - 1);
      for (let y = by - 1; y <= by + BH; y++) { const o = (y * W + x) * 3; out[o] = out[o + 1] = out[o + 2] = 255; }
    }
  }
  const f = S.fade;
  for (let q = 0; q < NP; q++) display.setPixel(q % W, (q / W) | 0, out[q * 3] * f, out[q * 3 + 1] * f, out[q * 3 + 2] * f);
}
