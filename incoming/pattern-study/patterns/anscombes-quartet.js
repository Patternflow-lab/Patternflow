// ===== Patternflow pattern =====
// Title:   Anscombe's Quartet
// Family:  data
// Idea:    Anscombe's four scatter plots of eleven points stand stacked under one shared regression line, then fold into a single tall plot where their points split into a cloud of 264 that anneals from shape to shape while all five of its statistics stay the same to two decimals, so the line and the crosshair never move.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Anscombe's quartet (Francis Anscombe, 1973); same-stats annealing (Justin Matejka, George Fitzmaurice, 2017)
// Round:   52
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Heat=0..1, Residuals=0..1
//
// Knob 1: Hue. Turns the four sets' colours round the wheel together: at 0 set I is sea green, II blue, III pink and IV yellow, and the cloud keeps each point's colour. The faint washes above and below the line stay on the cool side, teal over violet at 0 and magenta over green at 1.
// Knob 2: Speed. At 2 the quartet stands 1 s and folds in 0.8 s, each of the eight shapes takes 3.6 s (the cloud settles in about 1.5 s, and the round ones turn a quarter radian a second), the cloud walks home in 3 s and the quartet stands 4 s: one round is 37.4 s. The annealer tries 20,000 nudges a second through the first second of a shape and 100,000 a second from the second second on. At 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Heat. The annealing temperature: the chance that a nudge taking a point away from its place is kept anyway, still only when the statistics hold. 0.2% at 0, with 5% that cools over the first second of each shape; 60% at 1, where the nudges are also 2.5 times longer and the shapes fray into a haze round their outlines while the numbers stay put.
// Knob 4: Residuals. A stick from each point straight up or down to the line, in the point's colour, brightest at the point. Too faint to see below about 0.1; at 1 the sticks fill the space between the cloud and the line, and their squares add up to about the same total in every shape, since r and the spread of y are held.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, exp, cos, sin, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// Anscombe's published sets (1973). The first three share x.
const AX = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
const SETS = [
  [AX, [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68]],
  [AX, [9.14, 8.14, 8.74, 8.77, 9.26, 8.1, 6.13, 3.1, 9.13, 7.26, 4.74]],
  [AX, [7.46, 6.77, 12.74, 7.11, 7.81, 8.84, 6.08, 5.39, 8.15, 6.42, 5.73]],
  [[8, 8, 8, 8, 8, 8, 8, 19, 8, 8, 8], [6.58, 5.76, 7.71, 8.84, 8.47, 7.04, 5.25, 12.5, 5.56, 7.91, 6.89]],
];
// What all four share: means 9 and 7.50, deviations 3.32 and 2.03,
// correlation 0.816, and the line y = 3 + 0.5 x.
const MX = 9, MY = 7.5, SDX = sqrt(11), SDY = 2.0316, RHO = 0.8164;

// Two views of the data. The quartet: four plots 32 rows tall, x from 3 to
// 20 across the panel. The tall plot: one plot over all 128 rows, scaled so
// that the outliers at x 19 and y 12.74 still land on the panel.
const QKX = 3.47, QX0 = 2 + 6 * QKX, QKY = 2.64;
const qY0 = (k) => 32 * k + 30 - (MY - 2.5) * QKY;
const KX = 3.4, KY = 12, X0 = 27, Y0 = 67;

// Each of the 44 points splits into C copies for the cloud.
const C = 6, NP = 44, N = NP * C;

// The cloud's shapes, drawn in a design square and then fitted so that their
// own means and covariance are the cloud's: a shape can only be one the
// statistics allow. Lines stay upright ("L") or level ("U") under the fit.
function seg(o, a, b, c, d) {
  const n = max(2, round(hypot(c - a, d - b) / 0.02));
  for (let i = 0; i <= n; i++) o.push([a + ((c - a) * i) / n, b + ((d - b) * i) / n]);
}
function circ(o, r) {
  const n = max(8, round((2 * PI * r) / 0.02));
  for (let i = 0; i < n; i++) o.push([r * cos((2 * PI * i) / n), r * sin((2 * PI * i) / n)]);
}
function dot(o, a, b, n) {
  for (let i = 0; i < n; i++) o.push([a + 0.03 * cos(i), b + 0.03 * sin(i)]);
}
function star(o) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -PI / 2 + (i * PI) / 5, r = i % 2 ? 0.45 : 1.1;
    p.push([r * cos(a), r * sin(a)]);
  }
  for (let i = 0; i < 10; i++) seg(o, p[i][0], p[i][1], p[(i + 1) % 10][0], p[(i + 1) % 10][1]);
}
function lattice(o) {
  for (let b = -1.2; b <= 1.21; b += 0.4) for (let a = -1.2; a <= 1.21; a += 0.4) if (a * a + b * b < 1.5) dot(o, a, b, 12);
}
// "R" shapes are round and carry no correlation of their own: they keep
// their roundness on the panel and the statistics put a clump of points out
// at each end of the line to carry r = 0.82, as Anscombe's outliers do.
// "L" shapes are fitted whole: upright lines stay upright. "U": level stays level.
const SHAPES = [
  ["R", circ1],
  ["L", (o) => { for (const v of [-1.2, -0.4, 0.4, 1.2]) seg(o, -1.6, v, 1.6, v); }],
  ["R", star],
  ["L", (o) => { for (const u of [-1.5, -0.75, 0, 0.75, 1.5]) seg(o, u, -1.3, u, 1.3); }],
  ["R", (o) => (circ(o, 1), circ(o, 0.5))],
  ["U", (o) => { for (const v of [-1.5, -0.75, 0, 0.75, 1.5]) seg(o, -1.3, v, 1.3, v); }],
  ["R", lattice],
  ["R", (o) => (seg(o, -1, -1, 1, 1), seg(o, -1, 1, 1, -1))],
];
function circ1(o) {
  circ(o, 1);
}

// Fit points to the cloud's means and covariance (sx, sy, sxy in LEDs).
function fit(pts, ref, mode, sx, sy, sxy) {
  let ma = 0, mb = 0, aa = 0, bb = 0, ab = 0;
  for (const p of ref) (ma += p[0]), (mb += p[1]);
  ma /= ref.length;
  mb /= ref.length;
  for (const p of ref) {
    const a = p[0] - ma, b = p[1] - mb;
    aa += a * a;
    bb += b * b;
    ab += a * b;
  }
  aa /= ref.length;
  bb /= ref.length;
  ab /= ref.length;
  let M;
  if (mode !== "U") {
    // T times the inverse of S, both lower triangular: x depends on x alone.
    const s11 = sqrt(aa), s21 = ab / s11, s22 = sqrt(bb - s21 * s21);
    const t11 = sx, t21 = sxy / sx, t22 = sqrt(sy * sy - t21 * t21);
    M = [t11 / s11, 0, t21 / s11 - (t22 * s21) / (s11 * s22), t22 / s22];
  } else {
    // Both upper triangular: y depends on y alone, so level lines stay level.
    const s22 = sqrt(bb), s12 = ab / s22, s11 = sqrt(aa - s12 * s12);
    const t22 = sy, t12 = sxy / sy, t11 = sqrt(sx * sx - t12 * t12);
    M = [t11 / s11, t12 / s22 - (t11 * s12) / (s11 * s22), 0, t22 / s22];
  }
  return pts.map((p) => {
    const a = p[0] - ma, b = p[1] - mb;
    return [X0 + M[0] * a + M[1] * b, Y0 + M[2] * a + M[3] * b];
  });
}

// Distance from each LED centre to the nearest point of a shape, filled a
// few rows at a time so that no frame stalls on it.
function fillRows(F, rows) {
  const { f, xs, ys } = F, n = xs.length, end = min(H, F.row + rows);
  for (let y = F.row; y < end; y++)
    for (let x = 0; x < W; x++) {
      let best = 1e9;
      const px = x + 0.5, py = y + 0.5;
      for (let i = 0; i < n; i++) {
        const dx = xs[i] - px, dy = ys[i] - py, d = dx * dx + dy * dy;
        if (d < best) best = d;
      }
      f[y * W + x] = sqrt(best);
    }
  F.row = end;
}
function look(f, x, y) {
  const fx = cl(x - 0.5, 0, W - 1.001), fy = cl(y - 0.5, 0, H - 1.001);
  const ix = floor(fx), iy = floor(fy), u = fx - ix, v = fy - iy, i = iy * W + ix;
  return (f[i] * (1 - u) + f[i + 1] * u) * (1 - v) + (f[i + W] * (1 - u) + f[i + W + 1] * u) * v;
}

export function setup(params) {
  // The cloud: copy c of point j of set k, spread round the means by a hair
  // so that its deviations divided by n - 1 are Anscombe's again.
  let sxx = 0;
  for (const [xs] of SETS) for (const x of xs) sxx += (x - MX) ** 2;
  const grow = sqrt(((N - 1) * 11) / (C * sxx));
  const hx = new Float64Array(N), hy = new Float64Array(N), set = new Uint8Array(N), idx = new Uint8Array(N);
  for (let n = 0; n < N; n++) {
    const k = floor(n / (11 * C)), j = floor(n / C) % 11;
    set[n] = k;
    idx[n] = j;
    const [xs, ys] = SETS[k];
    hx[n] = X0 + KX * (xs[j] - MX) * grow;
    hy[n] = Y0 - KY * (ys[j] - MY) * grow;
  }
  params.s = {
    t: 0, hue: 0, speed: 2, heat: 0, res: 0.06, fade: 0,
    hx, hy, set, idx, x: Float64Array.from(hx), y: Float64Array.from(hy), d: new Float64Array(N),
    fields: [], pts: [], cores: [], cur: -1, bx: null, by: null, core: new Uint8Array(N), tx: new Float64Array(N), ty: new Float64Array(N), lock: null, stats: [0, 0, 0, 0, 0],
    rgb: new Float32Array(W * H * 3), trail: new Float32Array(W * H * 3),
  };
}

// Pixel sums of the cloud, and its statistics in Anscombe's units, rounded
// to two decimals as whole hundredths.
function sums(S) {
  let a = 0, b = 0, aa = 0, bb = 0, ab = 0;
  for (let n = 0; n < N; n++) {
    const x = S.x[n] - X0, y = S.y[n] - Y0;
    a += x;
    b += y;
    aa += x * x;
    bb += y * y;
    ab += x * y;
  }
  return [a, b, aa, bb, ab];
}
function stats(a, b, aa, bb, ab, out) {
  const vx = (aa - (a * a) / N) / (N - 1), vy = (bb - (b * b) / N) / (N - 1), c = (ab - (a * b) / N) / (N - 1);
  out[0] = round(100 * (MX + a / N / KX));
  out[1] = round(100 * (MY - b / N / KY));
  out[2] = round((100 * sqrt(vx)) / KX);
  out[3] = round((100 * sqrt(vy)) / KY);
  out[4] = round((-100 * c) / sqrt(vx * vy));
  return out;
}

function shapeField(S, k, rows = H) {
  if (!S.fields[k]) {
    // The shape's points carry the cloud's spread divided by n, so a cloud
    // lying on it has Anscombe's spread divided by n - 1. Pixel rows run
    // down, so the covariance turns negative.
    const f = sqrt((N - 1) / N), sx = KX * SDX * f, sy = KY * SDY * f, sxy = -RHO * sx * sy;
    const [mode, build] = SHAPES[k];
    let raw = [];
    build(raw);
    const coreLen = raw.length;
    if (mode === "R") {
      // A fraction 2w of the points sits in the two clumps at (+-cx, -+cy):
      // 2w cx cy carries the covariance, and what the clumps leave of the
      // x and y spread, equal, is the round core's.
      const w2 = 0.24, A = sx * sx, D = sy * sy, B = -sxy / w2, E = (D - A) / w2;
      const cx = sqrt((-E + sqrt(E * E + 4 * B * B)) / 2), cy = B / cx;
      let v = 0;
      for (const p of raw) v += p[0] * p[0] + p[1] * p[1];
      const lam = sqrt((A - w2 * cx * cx) / (1 - w2) / (v / raw.length / 2));
      raw = raw.map((p) => [lam * p[0], lam * p[1]]);
      const m = round(((raw.length * w2) / (1 - w2)) / 2);
      for (const sg of [1, -1])
        for (let i = 0; i < m; i++) {
          const a = i * 2.4, r = 2.2 * sqrt((i + 0.5) / m);
          raw.push([sg * cx + r * cos(a), -sg * cy + r * sin(a)]);
        }
    }
    // One place on the shape for each point, picked evenly along it. The fit
    // is taken from these places, so a cloud sitting on them has the
    // statistics exactly.
    const spots = [], core = new Uint8Array(N);
    for (let n = 0; n < N; n++) {
      const i = floor(((n + 0.5) * raw.length) / N);
      spots.push(raw[i]);
      core[n] = mode === "R" && i < coreLen ? 1 : 0;
    }
    const pts = fit(raw, spots, mode, sx, sy, sxy);
    S.pts[k] = fit(spots, spots, mode, sx, sy, sxy);
    S.cores[k] = core;
    const half = pts.filter((_, i) => i % 2 === 0);
    S.fields[k] = { f: new Float32Array(W * H), xs: Float32Array.from(half, (p) => p[0]), ys: Float32Array.from(half, (p) => p[1]), row: 0 };
  }
  const F = S.fields[k];
  if (F.row < H) fillRows(F, rows);
  return F.f;
}

// Hand the places out: start in any order, then swap pairs while a swap
// shortens the paths.
function assign(S, pts, core) {
  const tx = S.tx, ty = S.ty, X = S.x, Y = S.y;
  for (let n = 0; n < N; n++) (tx[n] = pts[n][0]), (ty[n] = pts[n][1]);
  const own = new Uint16Array(N).map((_, i) => i);
  for (let t = 0; t < 40000; t++) {
    const a = floor(Math.random() * N), b = floor(Math.random() * N), oa = own[a], ob = own[b];
    const xa = X[a], ya = Y[a], xb = X[b], yb = Y[b];
    const keep = (xa - tx[oa]) ** 2 + (ya - ty[oa]) ** 2 + (xb - tx[ob]) ** 2 + (yb - ty[ob]) ** 2;
    const swap = (xa - tx[ob]) ** 2 + (ya - ty[ob]) ** 2 + (xb - tx[oa]) ** 2 + (yb - ty[oa]) ** 2;
    if (swap < keep) (own[a] = ob), (own[b] = oa);
  }
  S.bx = Float64Array.from(own, (m) => tx[m]);
  S.by = Float64Array.from(own, (m) => ty[m]);
  S.core = Uint8Array.from(own, (m) => core[m]);
  S.tx.set(S.bx);
  S.ty.set(S.by);
}

// Matejka and Fitzmaurice: nudge one point, keep the nudge only if all five
// statistics still round to the same two decimals, and prefer nudges that
// bring the point nearer the target. A hot step takes a worse nudge too.
// The target here is the shape's outline plus twice the distance to the
// point's own place on it: the outline alone left a fifth of the points
// stranded in a clump or on the wrong line, since only a hot step could
// carry them across a gap.
function anneal(S, tries, temp, f, rc, rs) {
  let [a, b, aa, bb, ab] = sums(S);
  const st = [0, 0, 0, 0, 0], L = S.lock, home = !f, step = 1.2 * (1 + 1.5 * S.heat);
  const tx = home ? S.hx : S.tx, ty = home ? S.hy : S.ty, be = home ? 1 : BETA;
  // A turning shape is looked up turned back, near its middle.
  const at = (x, y) => {
    const dx = x - X0, dy = y - Y0;
    return rs && dx * dx + dy * dy < 900 ? look(f, X0 + rc * dx + rs * dy, Y0 - rs * dx + rc * dy) : look(f, x, y);
  };
  const dist = (n, x, y) => (home ? 0 : at(x, y)) + be * sqrt((x - tx[n]) ** 2 + (y - ty[n]) ** 2);
  for (let n = 0; n < N; n++) S.d[n] = dist(n, S.x[n], S.y[n]);
  for (let t = 0; t < tries; t++) {
    const n = floor(Math.random() * N);
    const ox = S.x[n], oy = S.y[n];
    const nx = ox + (Math.random() + Math.random() - 1) * step, ny = oy + (Math.random() + Math.random() - 1) * step;
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
    const nd = dist(n, nx, ny);
    if (nd >= S.d[n] && Math.random() >= temp) continue;
    const x0 = ox - X0, y0 = oy - Y0, x1 = nx - X0, y1 = ny - Y0;
    const a2 = a - x0 + x1, b2 = b - y0 + y1, aa2 = aa - x0 * x0 + x1 * x1, bb2 = bb - y0 * y0 + y1 * y1, ab2 = ab - x0 * y0 + x1 * y1;
    stats(a2, b2, aa2, bb2, ab2, st);
    if (st[0] !== L[0] || st[1] !== L[1] || st[2] !== L[2] || st[3] !== L[3] || st[4] !== L[4]) continue;
    S.x[n] = nx;
    S.y[n] = ny;
    S.d[n] = nd;
    a = a2;
    b = b2;
    aa = aa2;
    bb = bb2;
    ab = ab2;
  }
}

// The story, in seconds at Speed 2: the quartet 1 s, folding into one plot
// 0.8 s, eight shapes of 3.6 s, back home 3 s, unfolding 0.8 s, the quartet
// 4 s. Nudges tried a second, the weight on a point's own place, the round
// shapes' turn in radians a second, and the heat that cools at each shape.
const TR = 20000, BETA = 2, SPIN = 0.25, TEMP0 = 0.05, TAU = 1;
const QFIRST = 1, FOLD = 0.8, SHAPE = 3.6, NSH = 8, BACK = 3, QHOLD = 4;
const CYCLE = FOLD + NSH * SHAPE + BACK + FOLD + QHOLD;
function phase(t) {
  if (t < QFIRST) return { q: 1, next: 0 };
  let u = (t - QFIRST) % CYCLE;
  const cyc = floor((t - QFIRST) / CYCLE);
  if (u < FOLD) return { fold: sm(u / FOLD), next: (cyc * NSH) % SHAPES.length };
  u -= FOLD;
  if (u < NSH * SHAPE) return { shape: (cyc * NSH + floor(u / SHAPE)) % SHAPES.length, into: u % SHAPE };
  u -= NSH * SHAPE;
  const next = ((cyc + 1) * NSH) % SHAPES.length;
  if (u < BACK) return { back: u, next };
  u -= BACK;
  if (u < FOLD) return { fold: 1 - sm(u / FOLD), next };
  return { q: 1, next };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.heat = cl(k[2], 0, 1);
  S.res = cl(k[3], 0, 1);
  const g = (d * S.speed) / 2;
  S.t += g;
  S.fade = exp(-g * 9);
  const P = (S.P = phase(S.t));
  if (!S.lock) S.lock = stats(...sums(S), [0, 0, 0, 0, 0]);
  const into = P.shape !== undefined ? P.into : P.back !== undefined ? P.back : 0;
  const rate = TR * (1 + 4 * sm(into - 1));
  const tries = min(13000, round(g * rate));
  // Work on the next shape's distances a few rows a frame.
  shapeField(S, P.shape !== undefined ? (P.shape + 1) % SHAPES.length : P.next, 8);
  if (P.shape !== undefined && P.shape !== S.cur) {
    shapeField(S, P.shape);
    assign(S, S.pts[P.shape], S.cores[P.shape]);
    S.cur = P.shape;
  }
  if (P.shape === undefined) S.cur = -1;
  if (P.shape !== undefined) {
    // A round shape turns slowly about the means while it holds; turned
    // whole, its spread and its zero correlation do not change.
    const th = SPIN * P.into, rc = cos(th), rs = sin(th);
    for (let n = 0; n < N; n++)
      if (S.core[n]) {
        const dx = S.bx[n] - X0, dy = S.by[n] - Y0;
        S.tx[n] = X0 + rc * dx - rs * dy;
        S.ty[n] = Y0 + rs * dx + rc * dy;
      }
    anneal(S, tries, 0.002 + 0.6 * S.heat + TEMP0 * exp(-P.into / TAU), shapeField(S, P.shape), rc, rs);
  }
  else if (P.back !== undefined) anneal(S, tries, 0.002, null);
  else for (let n = 0; n < N; n++) (S.x[n] = S.hx[n]), (S.y[n] = S.hy[n]);
  stats(...sums(S), S.stats);
}

// Where set k's data lands at fold s (0 the quartet, 1 the tall plot), and
// the rows its plot may use.
function view(k, s) {
  return {
    x0: QX0 + (X0 - QX0) * s, kx: QKX + (KX - QKX) * s,
    y0: qY0(k) + (Y0 - qY0(k)) * s, ky: QKY + (KY - QKY) * s,
    top: 32 * k * (1 - s), bot: 32 * (k + 1) + (H - 32 * (k + 1)) * s,
  };
}

// Digits three LEDs wide and five tall, a row of bits each, top first.
const DIG = [0x7b6f, 0x2c97, 0x73e7, 0x73cf, 0x5bc9, 0x79cf, 0x79ef, 0x7249, 0x7bef, 0x7bcf];

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const P = S.P || { q: 1 }, rgb = S.rgb, tr = S.trail;
  rgb.fill(0);
  const add = (x, y, c, a) => {
    x = floor(x);
    y = floor(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    rgb[o] = max(rgb[o], c[0] * a);
    rgb[o + 1] = max(rgb[o + 1], c[1] * a);
    rgb[o + 2] = max(rgb[o + 2], c[2] * a);
  };
  const s = P.q ? 0 : P.fold !== undefined ? P.fold : 1;
  const cols = [0, 1, 2, 3].map((k) => hsv(0.42 + S.hue + 0.25 * k, 0.6, 1));
  // The washes keep to the cool side of the wheel: dark yellow and orange
  // read as olive and brown.
  const upC = hsv(0.5 + 0.45 * S.hue, 0.8, 0.09), dnC = hsv(0.78 - 0.45 * S.hue, 0.7, 0.09);
  const lineC = [1, 0.82, 0.55], meanC = [0.45, 0.5, 0.65], sdC = [0.22, 0.26, 0.4];
  // The fixed things: one set of them per plot while there are four.
  const views = s >= 1 ? [view(0, 1)] : [0, 1, 2, 3].map((k) => view(k, s));
  views.forEach((v, k) => {
    const inb = (y) => y >= v.top && y < v.bot;
    // The line splits each plot in two: a faint wash above it, where the
    // residuals are positive, and another below, a little stronger inside
    // one deviation of the means.
    const bx = v.kx * SDX, by = v.ky * SDY;
    for (let x = 0; x < W; x++) {
      const ly = v.y0 - v.ky * 0.5 * ((x + 0.5 - v.x0) / v.kx), inx = abs(x + 0.5 - v.x0) < bx;
      for (let y = Math.ceil(v.top); y < v.bot; y++) add(x, y, y + 0.5 < ly ? upC : dnC, inx && abs(y + 0.5 - v.y0) < by ? 1.35 : 1);
    }
    if (s < 1 && k > 0) for (let x = 0; x < W; x++) add(x, v.top, sdC, 1 - s);
    const sdx = v.kx * SDX, sdy = v.ky * SDY;
    for (let y = Math.ceil(v.top); y < v.bot; y++) {
      if (y % 4 < 2) add(v.x0, y, meanC, 1);
      if (y % 3 === 0) (add(v.x0 - sdx, y, sdC, 1), add(v.x0 + sdx, y, sdC, 1));
    }
    for (let x = 0; x < W; x++) {
      if (inb(v.y0) && x % 4 < 2) add(x, v.y0, meanC, 1);
      if (x % 3 === 0) for (const yy of [v.y0 - sdy, v.y0 + sdy]) if (inb(yy)) add(x, yy, sdC, 1);
    }
  });
  // The residuals: from each point straight down or up to the line.
  const pos = new Float32Array(2 * N);
  for (let n = 0; n < N; n++) {
    const k = S.set[n];
    let px = S.x[n], py = S.y[n];
    if (s < 1) {
      const v = view(k, s), [xs, ys] = SETS[k], j = S.idx[n];
      const hx = (S.hx[n] - X0) / KX + MX, hy = MY - (S.hy[n] - Y0) / KY;
      const dx = xs[j] + (hx - xs[j]) * s, dy = ys[j] + (hy - ys[j]) * s;
      px = v.x0 + v.kx * (dx - MX);
      py = v.y0 - v.ky * (dy - MY);
    }
    pos[2 * n] = px;
    pos[2 * n + 1] = py;
    if (S.res > 0.02) {
      const v = s >= 1 ? views[0] : views[k];
      const ly = v.y0 - v.ky * 0.5 * ((px - v.x0) / v.kx);
      // Brightest at the point, under a third as bright where it meets the line.
      const len = max(1, abs(py - ly));
      for (let y = floor(min(ly, py)); y <= floor(max(ly, py)); y++) add(px, y, cols[k], S.res * (0.3 + 0.7 * (1 - abs(y + 0.5 - py) / len)));
    }
  }
  // The line y = 3 + 0.5 x, filled down each column so it stays unbroken.
  views.forEach((v) => {
    for (let x = 0; x < W; x++) {
      const ya = v.y0 - v.ky * 0.5 * ((x - v.x0) / v.kx), yb = v.y0 - v.ky * 0.5 * ((x + 1 - v.x0) / v.kx);
      for (let y = floor(min(ya, yb)); y <= floor(max(ya, yb)) && y < H; y++) if (y + 0.5 >= v.top && y + 0.5 < v.bot) add(x, y, lineC, 1);
    }
  });
  // The five numbers the cloud keeps, top left of the tall plot, each in the
  // colour of the lines it sets.
  if (s > 0.5) {
    const a = sm((s - 0.5) * 2), vals = S.stats, cc = [meanC, meanC, sdC, sdC, lineC];
    for (let r = 0; r < 5; r++) {
      const v = vals[r], ds = [floor(v / 100), floor(v / 10) % 10, v % 10];
      const c = r >= 2 && r < 4 ? [0.4, 0.46, 0.7] : cc[r];
      let x = 1;
      for (let q = 0; q < 3; q++) {
        for (let b = 0; b < 15; b++) if ((DIG[ds[q]] >> (14 - b)) & 1) add(x + (b % 3), 2 + 7 * r + floor(b / 3), c, a);
        x += 4;
        if (q === 0) (add(x, 6 + 7 * r, c, a), (x += 2));
      }
    }
  }
  // The points, over everything, leaving a short trail as they move.
  const fd = S.fade;
  for (let i = 0; i < tr.length; i++) tr[i] *= fd;
  for (let n = 0; n < N; n++) {
    const c = cols[S.set[n]], px = pos[2 * n], py = pos[2 * n + 1];
    const big = s < 0.5 ? 2 : 1;
    for (let dy = 0; dy < big; dy++)
      for (let dx = 0; dx < big; dx++) {
        const x = floor(px - (big - 1) / 2 + dx), y = floor(py - (big - 1) / 2 + dy);
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const o = (y * W + x) * 3;
        tr[o] = c[0];
        tr[o + 1] = c[1];
        tr[o + 2] = c[2];
      }
  }
  for (let i = 0; i < W * H; i++) {
    const o = i * 3, t = max(tr[o], tr[o + 1], tr[o + 2]);
    // A point covers what is under it; its fading trail only adds.
    const r = t > 0.97 ? tr[o] : max(rgb[o], tr[o] * 0.6), g = t > 0.97 ? tr[o + 1] : max(rgb[o + 1], tr[o + 1] * 0.6), b = t > 0.97 ? tr[o + 2] : max(rgb[o + 2], tr[o + 2] * 0.6);
    display.setPixel(i % W, floor(i / W), 4 * round(63.75 * cl(r, 0, 1)), 4 * round(63.75 * cl(g, 0, 1)), 4 * round(63.75 * cl(b, 0, 1)));
  }
}
