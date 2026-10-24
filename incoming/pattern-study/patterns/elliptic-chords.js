// ===== Patternflow pattern =====
// Title:   Elliptic Chords
// Family:  number
// Idea:    The points of y^2 = x^3 - 6x + b add up by the chord-and-tangent rule, drawn twice at once: above, the real curve, where the line through G and kG meets the curve a third time and the mirror image of that point in the x-axis is (k+1)G; below, the same curve over the integers mod 61, where a line is 61 dots wrapping round the square and still meets the curve in exactly three of them, and the multiples of a generator light the whole group one dot at a time until the line through G and -G stands vertical and the count comes back to O.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: elliptic curve group law, chord and tangent (Henri Poincaré, 1901), pattern round 36
// Round:   36
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Curve=-4..8, Trail=0..1
//
// Knob 1: Hue. Turns everything round the wheel. At 0 the plane inside the real curve and the board are deep blue, the curve pale blue, the lines pale peach and the multiples a full rainbow in visiting order, with G white; at 0.5 the plane and board are a dim grey-brown, the curve pale apricot and the lines pale sky.
// Knob 2: Speed. Group steps a second. At 2 one and a half: the line sweeps its 61 dots in a third of a second, the third point drops to its mirror image in 0.15 seconds and the new multiple lands, so the 74 multiples of the opening curve come round in 49 seconds; at 0.2 a step takes 6.7 seconds, at 3 0.44.
// Knob 3: Curve. The constant b, in whole steps. At 0, the opening, y^2 = x^3 - 6x has an egg between -2.45 and 0 beside the long branch, and over F_61 its 74 points are one cycle; at -4 the egg is half as wide and the 72 points mod 61 are not one cycle, so a generator reaches 36 of them, O included, and the rest stay grey; at 4 the same 36 of 72; at 5 the egg reaches to within 0.8 of the branch, 64 points; from 6 to 8 the two have joined into one piece with a neck, 61, 62 and 62 points.
// Knob 4: Trail. Trades the dots for the lines. At 0 a multiple stays lit for the whole cycle, fading over its last 40%, and each line lingers 1.6 steps; at 0.06 almost the same; at 0.5 the dots last 28 steps and the lines 4.4; at 1 only the last two dots stay but each line lingers 8 steps, so the lines through G stand as a fan above and a crowd of dots below.
// Buttons: K1 tap picks a new generator G at random on both halves, and the group starts again from O: the first line is the vertical through G, and the old dots fade out in 1.5 seconds.

const W = 64, H = 128, P = 61, A = -6, CMIN = -4, CMAX = 8;
// The real window: x from -3.15 to 4.45 over the 64 columns, y from -7.75 to
// 7.75 over rows 0..62, with y = 0 on row 31. Lines stay lines under this
// stretch, and the mirror in the x-axis stays a vertical move.
const TOPH = 63, X0 = -3.15, X1 = 4.45, SX = W / (X1 - X0), YM = 7.75, SY = TOPH / (2 * YM), YC = 31;
// The F_61 board: element (x, y) is column BX + x, row BY - y; O sits on row OROW above it.
const BX = 1, BY = 126, OROW = 64;
// Phases of one group step: the line, the mirror, the landing.
const T_LINE = 0.5, T_MIR0 = 0.55, T_MIR1 = 0.78;
const NT = 1024;
// Group steps a second for each unit of Speed.
const RATE = 0.75;
const { floor, min, max, abs, sqrt, sin, cos, tan, acos, cbrt, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const md = (v) => ((v % P) + P) % P;
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const NB2 = [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Inverses mod 61, by Fermat.
const INV = new Int32Array(P);
for (let i = 1; i < P; i++) {
  let r = 1, e = P - 2, q = i;
  while (e) {
    if (e & 1) r = (r * q) % P;
    q = (q * q) % P;
    e >>= 1;
  }
  INV[i] = r;
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

// ---- F_61 -------------------------------------------------------------------
// A point is [x, y] with entries 0..60, or null for O.
function fpAdd(p, q, b) {
  if (!p) return q;
  if (!q) return p;
  if (p[0] === q[0] && md(p[1] + q[1]) === 0) return null;
  const m = p[0] === q[0] ? md((3 * p[0] * p[0] + A) * INV[md(2 * p[1])]) : md((q[1] - p[1]) * INV[md(q[0] - p[0])]);
  const x = md(m * m - p[0] - q[0]);
  return [x, md(m * (p[0] - x) - p[1])];
}

function fpOrder(g, b) {
  let q = g, n = 1;
  while (q && n < 200) {
    q = fpAdd(q, g, b);
    n++;
  }
  return n;
}

// ---- the real curve -----------------------------------------------------------
// The roots of x^3 - 6x + b, largest first: three when 27 b^2 < 864, so
// when |b| < 5.66, and then the curve has an egg over [e3, e2].
function roots(b) {
  if (4 * A * A * A + 27 * b * b < 0) {
    const r = 2 * sqrt(-A / 3), th = acos(((3 * b) / (2 * A)) * sqrt(-3 / A)) / 3;
    return [0, 1, 2].map((k) => r * cos(th - (2 * PI * k) / 3)).sort((p, q) => q - p);
  }
  const s = sqrt((b * b) / 4 + (A * A * A) / 27);
  let x = cbrt(-b / 2 + s) + cbrt(-b / 2 - s);
  for (let i = 0; i < 6; i++) x -= (x * x * x + A * x + b) / (3 * x * x + A);
  return [x];
}

// The real points of the curve as a group are a circle, R/wZ, times {0, 1}
// when the egg is there. The circle is measured by the invariant
// differential dx/y: on the long branch u(x) = int_x^inf dt/sqrt(f), with
// t = e1 + tan^2(phi), and on the egg v(x) = int_e3^x dt/sqrt(f), with
// t = e3 + (e2 - e3) sin^2(theta), both free of the square-root ends. Both
// halves of the circle come to the same w/2. Checked against the chord rule
// in a scratch script: main(u1) + main(u2) = main(u1 + u2), main(u) + egg(v)
// = egg(u + v) and egg(v1) + egg(v2) = main(v1 + v2), to 2e-6 in the window.
function realCurve(b) {
  const R = roots(b), e1 = R[0], c = e1 * e1 + A;
  const U = new Float64Array(NT + 1), h = PI / 2 / NT;
  const gm = (ph) => {
    if (ph >= PI / 2 - 1e-12) return 2;
    const s = tan(ph), t = e1 + s * s, co = cos(ph);
    return 2 / sqrt(t * t + e1 * t + c) / (co * co);
  };
  for (let i = NT - 1; i >= 0; i--) U[i] = U[i + 1] + (h / 6) * (gm(i * h) + 4 * gm((i + 0.5) * h) + gm((i + 1) * h));
  const C = { b, R, U, w: 2 * U[0], egg: null };
  if (R.length === 3) {
    const e2 = R[1], e3 = R[2], V = new Float64Array(NT + 1);
    const ge = (th) => 2 / sqrt(e1 - e3 - (e2 - e3) * sin(th) ** 2);
    for (let i = 0; i < NT; i++) V[i + 1] = V[i] + (h / 6) * (ge(i * h) + 4 * ge((i + 0.5) * h) + ge((i + 1) * h));
    C.egg = { V, e2, e3 };
  }
  return C;
}

const f = (x, b) => x * x * x + A * x + b;

// Fractional index where the monotone table T meets the value t.
function seek(T, t, rising) {
  let lo = 0, hi = NT;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (T[m] < t === rising) lo = m;
    else hi = m;
  }
  return lo + (t - T[lo]) / (T[hi] - T[lo] || 1);
}

// The real point at parameter u on the branch (s = 0) or the egg (s = 1);
// null for O.
function realPoint(C, u, s) {
  const w = C.w;
  u -= floor(u / w) * w;
  if (s === 0 && (u < 1e-9 || w - u < 1e-9)) return null;
  const up = u <= w / 2, q = up ? u : w - u;
  let x;
  if (s === 0) {
    const ph = (seek(C.U, q, false) * PI) / 2 / NT;
    x = C.R[0] + tan(ph) ** 2;
  } else {
    const { V, e2, e3 } = C.egg, th = (seek(V, q, true) * PI) / 2 / NT;
    x = e3 + (e2 - e3) * sin(th) ** 2;
  }
  const y = sqrt(max(0, f(x, C.b)));
  // The egg runs the other way round, so that main(u) + egg(v) = egg(u + v).
  return [x, (up ? 1 : -1) * (s === 0 ? 1 : -1) * y];
}

// ---- one curve: both halves ---------------------------------------------------
function buildCurve(b) {
  const pts = [];
  for (let x = 0; x < P; x++) for (let y = 0; y < P; y++) if (md(y * y - f(x, b)) === 0) pts.push([x, y]);
  let N = 0, gens = [];
  for (const p of pts) {
    const o = fpOrder(p, b);
    if (o > N) (N = o), (gens = []);
    if (o === N) gens.push(p);
  }
  const C = realCurve(b);
  const onBoard = new Uint8Array(P * P);
  for (const [x, y] of pts) onBoard[x * P + y] = 1;
  // The static picture of the real curve: a 1.4-LED line where y^2 = f(x),
  // found by the distance |y^2 - f| / |gradient| in LEDs, and a soft fill on
  // the side where f(x) > y^2, the inside of the egg and of the branch.
  const line = new Float32Array(W * TOPH), fill = new Float32Array(W * TOPH);
  for (let r = 0; r < TOPH; r++)
    for (let col = 0; col < W; col++) {
      let acc = 0, inside = 0;
      for (let sy = 0; sy < 3; sy++)
        for (let sx = 0; sx < 3; sx++) {
          const x = X0 + (col + (sx + 0.5) / 3) / SX, y = (YC + 0.5 - (r + (sy + 0.5) / 3)) / SY;
          const F = y * y - f(x, b), gx = (3 * x * x + A) / SX, gy = (2 * y) / SY;
          const d = abs(F) / (sqrt(gx * gx + gy * gy) + 1e-9);
          acc += cl(1.15 - d, 0, 1);
          if (F < 0) inside++;
        }
      line[r * W + col] = acc / 9;
      fill[r * W + col] = inside / 9;
    }
  return { b, pts, N, gens, C, onBoard, line, fill };
}

// ---- the cycle ----------------------------------------------------------------
// Q_k = kG. Step k goes from Q_k to Q_k+1 = Q_k + G: the line through G and
// Q_k (the tangent at G when k = 1, the vertical through G when Q_k is O or
// -G), its third point R, and R mirrored. The real generator is a point of
// the same order N: on the egg at parameter jw/N when there is an egg and N
// is even, so the odd multiples land on the egg and the even ones on the
// branch, otherwise on the branch.
function startCycle(S, fresh) {
  const K = S.curve, N = K.N, C = K.C;
  S.g = K.gens[floor(random() * K.gens.length)];
  S.side = C.egg && N % 2 === 0 ? 1 : 0;
  const js = [];
  for (let j = 1; j < N; j++) {
    let a = j, bb = N;
    while (bb) [a, bb] = [bb, a % bb];
    if (a !== 1) continue;
    const g = realPoint(C, (j * C.w) / N, S.side);
    if (g && g[0] > X0 + 0.3 && g[0] < X1 - 0.3 && abs(g[1]) < YM - 0.4) js.push(j);
  }
  S.j = js.length ? js[floor(random() * js.length)] : 1;
  S.gr = realPoint(C, (S.j * C.w) / N, S.side);
  for (const t of S.trail) t.ghost = t.ghost || 1e-6;
  if (fresh) {
    // The opening shows the cycle already under way: 80% of it lit.
    const k0 = round(0.8 * N);
    let q = null;
    for (let k = 1; k <= k0; k++) {
      q = fpAdd(q, S.g, K.b);
      S.trail.push({ k, gs: S.gs - (k0 - k), fp: q, re: realK(S, k), ghost: 0 });
    }
    S.k = k0;
    S.q = q;
  } else {
    S.k = 0;
    S.q = null;
  }
  planStep(S);
}

const realK = (S, k) => realPoint(S.curve.C, (k * S.j * S.curve.C.w) / S.curve.N, (k * S.side) & 1);

// The F_61 line y = mx + c is the lattice of points (t, mt) mod 61 shifted
// to one of them. Its shortest vector, found by Lagrange's reduction of the
// basis (1, m), (0, 61), is never more than 8.4 long, and stepping by it still
// visits all 61 points, so the walk runs along short streaks that wrap round
// the square instead of jumping m rows at a time.
function shortStep(m) {
  let ax = 1, ay = m > P / 2 ? m - P : m, bx = 0, by = P;
  const n2 = (x, y) => x * x + y * y;
  for (let i = 0; i < 20; i++) {
    if (n2(bx, by) < n2(ax, ay)) [ax, ay, bx, by] = [bx, by, ax, ay];
    const mu = round((ax * bx + ay * by) / n2(ax, ay));
    if (mu === 0) break;
    bx -= mu * ax;
    by -= mu * ay;
  }
  return [md(ax), md(ay)];
}

function planStep(S) {
  const K = S.curve, N = K.N, k = S.k, g = S.g, q = S.q;
  const st = { k, vert: false, m: 0, start: q || g, third: null, next: null, rm: 0, rx: 0, ry: 0, rv: false, r3: null, rn: null, tR: -1 };
  // F_61: the line's slope, its 61 dots from Q_k (from G when Q_k is O), and
  // how many steps along it the third point falls.
  if (!q || (q[0] === g[0] && md(q[1] + g[1]) === 0)) st.vert = true;
  else st.m = q[0] === g[0] ? md((3 * g[0] * g[0] + A) * INV[md(2 * g[1])]) : md((q[1] - g[1]) * INV[md(q[0] - g[0])]);
  st.next = fpAdd(q, g, K.b);
  st.third = st.next ? [st.next[0], md(-st.next[1])] : null;
  [st.dx, st.dy] = st.vert ? [0, 1] : shortStep(st.m);
  const s0 = st.start, stepT = (pt) => (st.vert ? md(pt[1] - s0[1]) : md((pt[0] - s0[0]) * INV[st.dx]));
  st.tR = st.third ? stepT(st.third) : P - 1;
  // The real line, through G_r with slope rm or vertical.
  const G = S.gr, Q = k === 0 ? null : realK(S, k);
  if (k === 0 || k === N - 1) st.rv = true;
  else if (k === 1) st.rm = (3 * G[0] * G[0] + A) / (2 * G[1]);
  else if (Q) st.rm = (Q[1] - G[1]) / (Q[0] - G[0]);
  else st.rm = 0;
  st.rx = G[0];
  st.ry = G[1];
  if (k === N - 1) st.r3 = null;
  else if (k === 0) st.r3 = [G[0], -G[1]];
  else {
    const x3 = st.rm * st.rm - G[0] - (Q ? Q[0] : G[0]);
    st.r3 = [x3, G[1] + st.rm * (x3 - G[0])];
  }
  st.rn = st.r3 ? [st.r3[0], -st.r3[1]] : null;
  S.step = st;
}

function finishStep(S) {
  const st = S.step, N = S.curve.N;
  S.past.push({ st, gs: S.gs + 1 });
  S.gs++;
  S.k = (S.k + 1) % N;
  S.q = st.next;
  if (st.next) S.trail.push({ k: S.k, gs: S.gs, fp: st.next, re: st.rn, ghost: 0 });
  planStep(S);
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, trailK: 0.06, b: null, curve: null, curves: {}, g: null, gr: null, j: 1, side: 0,
    k: 0, q: null, gs: 0, tau: 0, step: null, trail: [], past: [],
    R: new Float32Array(W * H), G: new Float32Array(W * H), B: new Float32Array(W * H), c: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  S.trailK = cl(kv[3], 0, 1);
  const b = round(cl(kv[2], CMIN, CMAX));
  if (b !== S.b) {
    S.b = b;
    S.curve = S.curves[b] || (S.curves[b] = buildCurve(b));
    S.trail.length = 0;
    S.past.length = 0;
    S.tau = 0;
    startCycle(S, true);
  }
  if (input.btnPressed && input.btnPressed[0]) {
    S.tau = 0;
    startCycle(S, false);
  }
  S.tau += d * S.speed * RATE;
  while (S.tau >= 1) {
    S.tau -= 1;
    finishStep(S);
  }
  // Ghosts of an old cycle fade out over 1.5 seconds.
  for (const t of S.trail) if (t.ghost) t.ghost += d / 1.5;
  const L = trailLen(S);
  S.trail = S.trail.filter((t) => (t.ghost ? t.ghost < 1 : S.gs + S.tau - t.gs < L + 1));
  S.past = S.past.filter((q) => S.gs + S.tau - q.gs < linger(S));
}

// Past lines linger, fading: 1.6 steps at Trail 0, 8 steps at 1. They all
// pass through G.
const linger = (S) => 1.6 + 6.4 * S.trailK ** 1.2;

const trailLen = (S) => 2 + (S.curve.N - 2) * (1 - S.trailK) ** 1.5;

// ---- drawing ------------------------------------------------------------------
function add(S, x, y, col, v) {
  if (x < 0 || x >= W || y < 0 || y >= H || v <= 0) return;
  const p = y * W + x;
  S.R[p] += col[0] * v;
  S.G[p] += col[1] * v;
  S.B[p] += col[2] * v;
}

// Real coordinates to LED coordinates (LED centres at whole numbers).
const px = (x) => (x - X0) * SX - 0.5;
const py = (y) => YC - y * SY;

function disc(S, x, y, rad, col, v) {
  const cx = px(x), cy = py(y);
  for (let r = floor(cy - rad - 1); r <= cy + rad + 1; r++)
    for (let c = floor(cx - rad - 1); c <= cx + rad + 1; c++) {
      if (r < 0 || r >= TOPH) continue;
      const dd = sqrt((c - cx) ** 2 + (r - cy) ** 2);
      add(S, c, r, col, v * cl(rad + 0.5 - dd, 0, 1));
    }
}

// The real line through (x0, y0) with slope m, or the vertical through x0,
// clipped to the window: one LED wide with a soft LED of glow either side.
function realLine(S, x0, y0, m, vert, col, v) {
  const k = vert ? 0 : (-m * SY) / SX, ax = px(x0), ay = py(y0);
  if (!vert && abs(k) <= 1) {
    // Shallow: walk the columns, spread across rows.
    for (let c = 0; c < W; c++) {
      const r = ay + k * (c - ax), r0 = floor(r);
      for (let q = r0 - 1; q <= r0 + 2; q++) if (q >= 0 && q < TOPH) add(S, c, q, col, v * glow(abs(q - r)));
    }
  } else {
    for (let r = 0; r < TOPH; r++) {
      const c = vert ? ax : ax + (r - ay) / k, c0 = floor(c);
      for (let q = c0 - 1; q <= c0 + 2; q++) add(S, q, r, col, v * glow(abs(q - c)));
    }
  }
}
const glow = (d) => (d < 1 ? 1 - 0.7 * d : d < 2 ? 0.3 * (2 - d) : 0);

const inWin = (p) => p && p[0] > X0 - 0.2 && p[0] < X1 + 0.2 && abs(p[1]) < YM + 0.3;

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.curve) return;
  const { R, G, B, c } = S, K = S.curve, N = K.N, st = S.step, tau = S.tau;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  const h0 = S.hue + 0.6;
  // The plane inside the real curve and the board are dim tints.
  const plane = [0, 0, 0], ink = [0, 0, 0], board = [0, 0, 0], chord = [0, 0, 0], white = [1, 1, 1], base = [0, 0, 0];
  // Round orange and yellow the dim tints lose most of their colour, or
  // they would read brown and olive.
  const hw = h0 + 0.03 - floor(h0 + 0.03), warm = cl(1 - abs(hw - 0.12) / 0.1, 0, 1);
  hsv(h0, 0.75 - 0.5 * warm, 0.16, plane);
  hsv(h0 - 0.02, 0.32, 0.92, ink);
  hsv(h0 + 0.03, 0.6 - 0.4 * warm, 0.115, board);
  hsv(h0 + 0.5, 0.42, 1, chord);
  hsv(h0, 0.2, 0.34, base);
  for (let r = 0; r < TOPH; r++)
    for (let col = 0; col < W; col++) {
      const p = r * W + col, ln = K.line[p], fl = K.fill[p];
      R[p] = (plane[0] * fl + ink[0] * ln) * 255;
      G[p] = (plane[1] * fl + ink[1] * ln) * 255;
      B[p] = (plane[2] * fl + ink[2] * ln) * 255;
    }
  for (let y = 0; y < P; y++)
    for (let x = 0; x < P; x++) {
      const p = (BY - y) * W + BX + x;
      R[p] = board[0] * 255;
      G[p] = board[1] * 255;
      B[p] = board[2] * 255;
    }
  for (const [x, y] of K.pts) add(S, BX + x, BY - y, base, 255);

  // The lines of the last few steps, fading: a pencil of lines through G.
  for (const q of S.past) {
    const w = 1 - (S.gs + tau - q.gs) / linger(S);
    if (w <= 0) continue;
    const ps = q.st, s0 = ps.start;
    realLine(S, ps.rx, ps.ry, ps.rm, ps.rv, chord, 130 * w);
    for (let t = 0; t < P; t++) {
      const x = md(s0[0] + ps.dx * t), y = md(s0[1] + ps.dy * t);
      add(S, BX + x, BY - y, chord, 55 * w);
    }
  }

  // The trail: each multiple in its order's hue, the whole cycle once round
  // the wheel, held for most of the trail and then let go.
  const L = trailLen(S), now = S.gs + tau;
  for (const t of S.trail) {
    const age = now - t.gs;
    let v = age < 0.6 * L ? 1 : cl((L - age) / (0.4 * L), 0, 1);
    if (t.ghost) v *= cl(1 - t.ghost, 0, 1);
    if (v <= 0.01) continue;
    hsv(h0 + 0.42 + t.k / N, 0.88, 1, c);
    add(S, BX + t.fp[0], BY - t.fp[1], c, 255 * v);
    if (inWin(t.re)) disc(S, t.re[0], t.re[1], 1.5, c, 235 * v);
    for (const [dx, dy] of NB) add(S, BX + t.fp[0] + dx, BY - t.fp[1] + dy, c, 95 * v);
    // A fresh landing blooms for a step and a half.
    const bl = 1 - age / 1.5;
    if (bl > 0 && !t.ghost) {
      for (const [dx, dy] of NB2) add(S, BX + t.fp[0] + dx, BY - t.fp[1] + dy, c, 110 * bl);
      if (inWin(t.re)) disc(S, t.re[0], t.re[1], 2.6, c, 90 * bl);
    }
  }

  // The step under way.
  const lineV = tau < 0.08 ? tau / 0.08 : tau > 0.88 ? (1 - tau) / 0.12 : 1;
  // Real: the line, the third point, the mirror, the new point.
  realLine(S, st.rx, st.ry, st.rm, st.rv, chord, 190 * lineV);
  const mir = cl((tau - T_MIR0) / (T_MIR1 - T_MIR0), 0, 1);
  if (tau > T_LINE * 0.9) {
    if (st.r3 && inWin(st.r3)) disc(S, st.r3[0], st.r3[1], 1.3, white, 200 * lineV);
    if (!st.r3) for (let r = 0; r < 2; r++) add(S, round(px(st.rx)), r, white, 255 * lineV);
  }
  if (mir > 0 && st.r3) {
    const ya = py(st.r3[1]), yb = py(st.rn[1]), cc = round(px(st.r3[0]));
    const yt = ya + (yb - ya) * mir;
    for (let r = max(0, round(min(ya, yt))); r <= min(TOPH - 1, round(max(ya, yt))); r++) if (r % 2 === 0) add(S, cc, r, white, 150 * lineV);
  }
  if (tau > T_MIR1 && st.rn && inWin(st.rn)) {
    hsv(h0 + 0.42 + ((st.k + 1) % N) / N, 0.6, 1, c);
    disc(S, st.rn[0], st.rn[1], 1.5, c, 255);
  }
  // F_61: the line's dots from Q_k, the head brightest, then the mirror.
  const head = (min(tau, T_LINE) / T_LINE) * (P - 1), s0 = st.start;
  for (let t = 0; t <= head; t++) {
    const x = md(s0[0] + st.dx * t), y = md(s0[1] + st.dy * t);
    const on = K.onBoard[x * P + y];
    const v = head - t < 1 ? 1 : 0.85 + (on ? 0.15 : 0);
    add(S, BX + x, BY - y, on ? white : chord, 230 * v * lineV);
  }
  if (head >= st.tR) {
    if (st.third) {
      const x = BX + st.third[0], y = BY - st.third[1];
      for (const [dx, dy] of NB) add(S, x + dx, y + dy, white, 150 * lineV);
    } else for (let r = OROW - 1; r <= OROW; r++) add(S, BX + st.start[0], r, white, 255 * lineV);
  }
  if (mir > 0 && st.third) {
    const x = BX + st.third[0], ya = BY - st.third[1], yb = BY - st.next[1], yt = ya + (yb - ya) * mir;
    for (let r = round(min(ya, yt)); r <= round(max(ya, yt)); r++) if (r % 2 === 0) add(S, x, r, white, 120 * lineV);
  }
  if (tau > T_MIR1 && st.next) {
    hsv(h0 + 0.42 + ((st.k + 1) % N) / N, 0.5, 1, c);
    const x = BX + st.next[0], y = BY - st.next[1];
    add(S, x, y, c, 255);
    for (const [dx, dy] of NB) add(S, x + dx, y + dy, c, 140);
  }
  // G on both halves: white, with a dark ring round it on the real curve.
  const gx = BX + S.g[0], gy = BY - S.g[1];
  add(S, gx, gy, white, 255);
  for (const [dx, dy] of NB) add(S, gx + dx, gy + dy, white, 120);
  if (inWin(S.gr)) {
    const cx = px(S.gr[0]), cy = py(S.gr[1]);
    for (let r = floor(cy - 3); r <= cy + 3; r++)
      for (let q = floor(cx - 3); q <= cx + 3; q++) {
        if (r < 0 || r >= TOPH || q < 0 || q >= W) continue;
        const dd = sqrt((q - cx) ** 2 + (r - cy) ** 2), p = r * W + q;
        if (dd < 2.6) {
          const k = dd < 1.4 ? 1 : 0.15;
          R[p] = 255 * k;
          G[p] = 255 * k;
          B[p] = 255 * k;
        }
      }
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      display.setPixel(x, y, round(min(255, R[p])), round(min(255, G[p])), round(min(255, B[p])));
    }
}
