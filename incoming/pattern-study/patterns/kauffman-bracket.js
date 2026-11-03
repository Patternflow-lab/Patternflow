// ===== Patternflow pattern =====
// Title:   Kauffman Bracket
// Family:  topology
// Idea:    A knot diagram fills the top half and Kauffman's state sum walks its 2^n states in Gray code order, one crossing at a time pinching into its X and opening out into its other smoothing, so the knot falls apart into loops each in a colour of its own, while each state's term A^(a-b) d^(loops-1) drops into bars by power of A below, rising and cancelling until the bracket polynomial stands and turns over like a card into the Jones polynomial.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kauffman bracket and its state sum (Louis Kauffman, State models and the Jones polynomial, Topology, 1987), the Jones polynomial (Vaughan Jones, 1984) normalised by the writhe, knot names after Rolfsen's table (Dale Rolfsen, Knots and Links, 1976), states in reflected binary order (Frank Gray, 1953); diagrams found for this pattern as mirror-symmetric Fourier curves; pattern round 102
// Round:   102
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Knot=0..5, Switch=0..1
//
// Knob 1: Hue. Turns the colours round the wheel. At 0 the loops are sky blue, orange, green, magenta, yellow, blue and pink in the order they appear, the whole knot pale blue, positive bars pale gold and negative bars rose; at 0.5 the first loop is red-orange and the positive bars lilac.
// Knob 2: Speed. At 2 a state lasts 0.9 s on the trefoil, 0.6 s on the figure-eight, 0.42 s on a five-crossing knot and 0.3 s on 6_1; with 5.5 s of whole knot, closing up, bracket, turning over and Jones polynomial a walk takes 12.7 s for the trefoil and 24.7 s for 6_1, all five 90 s. Ten times slower at 0.2, half as fast again at 3.
// Knob 3: Knot. 0 walks five knots in turn: the trefoil 3_1 (8 states), the figure-eight 4_1 (16), the cinquefoil 5_1 and 5_2 (32 each) and the stevedore 6_1 (64); 1 to 5 walk one of them over and over. The panel opens on the trefoil three states into its walk.
// Knob 4: Switch. Changes the first round(Switch x n) crossings in reading order, and the walk, the bars and the knot's name follow: the trefoil is the unknot 0_1 at 0.25 and 0.5 and its mirror 3_1* at 1, the figure-eight with all four changed is 4_1 again, its own mirror, and 6_1 with two changed is 5_2. A changed crossing is underlined in the state word.

// Turn the over strand of a crossing anticlockwise: the two corners it
// sweeps are joined by the A-smoothing, the other two by the B-smoothing. A
// state with a A's and b B's leaves L loops, and
// <K> = sum over the 2^n states of A^(a-b) d^(L-1), d = -A^2 - A^-2.
// Over and under alternate along the drawn curve, which Gauss's parity
// always allows; loops are counted by union-find over the 4n arc ends.
//
// The check, on the right-handed trefoil (w = 3): the all-A state is the 2
// Seifert circles, A^3 d = -A^5 - A, the all-B state 3 loops,
// A^-3 d^2 = A + 2A^-3 + A^-7, and the 8 states sum to the known
// <3_1> = A^-7 - A^-3 - A^5, whose (-A^3)^-3 <3_1> at A = t^(-1/4) is the
// Jones polynomial t + t^3 - t^4. Every knot is named by matching its sum
// against TABLE, so a wrong sum would show a question mark in the corner.
// A state's lowest power a - b - 2(L - 1) is the same mod 4 for all states,
// so the bars stand 4 powers of A apart, n + 1 for an alternating diagram.

const W = 64, H = 128, N = W * H;
const { floor, round, sqrt, min, max, abs, cos, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => u * u * (3 - 2 * u);
const mix = (p, q, u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u];

// x = sum a_k sin(k t), y = sum b_k cos(k t): curves symmetric about the
// vertical axis. The trefoil is the textbook sin t + 2 sin 2t, cos t - 2 cos 2t,
// the cinquefoil r = 2 + 0.7 cos 5t at angle 2t; the other three came out of a
// search over such curves for the crossing count and the Jones polynomial,
// eased apart for room.
const KNOTS = [
  [[1, 2], [1, -2]],
  [[-2.128, 0.509, -2.794, 0.379], [-2.695, -3.169, 1.256, -0.994]],
  [[0, 2, -0.35, 0, 0, 0, 0.35], [0, 2, 0.35, 0, 0, 0, 0.35]],
  [[0.336, 2.065, 0.787, 2.035, 0.019], [0.061, -0.285, 3.636, 0.078, 1.311]],
  [[-1.285, 0.687, -1.873, 0.33], [0.647, -2.678, -1.296, -0.812]],
];
// What a diagram here can turn into when crossings are changed, named as in
// Rolfsen's table (0_1 the unknot) by Jones polynomial: lowest power of t,
// then the coefficients. A star marks the mirror of the knot as first drawn.
const TABLE = [
  ["01", 0, [1]],
  ["31", 1, [1, 0, 1, -1]],
  ["41", -2, [1, -1, 1, -1, 1]],
  ["51", 2, [1, 0, 1, -1, 1, -1]],
  ["52", -6, [-1, 1, -1, 2, -1, 1]],
  ["61", -4, [1, -1, 1, -2, 2, -1, 1]],
];
// Seconds per state at Speed 2, by crossing count, and the other parts of a walk.
const STEP = { 3: 0.9, 4: 0.6, 5: 0.42, 6: 0.3 };
const T_INTRO = 1, T_CLOSE = 0.8, T_BRACKET = 1.5, T_TURN = 0.6, T_JONES = 1.6, T_FADE = 0.4;
// The diagram's centre row, the state word's row, the zero line, the tallest bar.
const DCY = 34, ROW_STRIP = 69, ZY = 96, BAR_MAX = 19;
// How far a smoothing's curves bend into the crossing: 0.45 as drawn, 4/3
// where both pass through the crossing point and make the X.
const BEND = 0.45, PINCH = 4 / 3;
const PAL = [0.55, 0.08, 0.33, 0.85, 0.15, 0.66, 0.96];

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// A polyline as pixels, a line 2 LEDs wide.
const COV = new Float32Array(N);
function raster(pts) {
  const touched = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    for (let y = max(0, floor(min(ay, by) - 2)); y <= min(H - 1, floor(max(ay, by) + 2)); y++)
      for (let x = max(0, floor(min(ax, bx) - 2)); x <= min(W - 1, floor(max(ax, bx) + 2)); x++) {
        const qx = x + 0.5 - ax, qy = y + 0.5 - ay, u = l2 > 0 ? cl((qx * dx + qy * dy) / l2, 0, 1) : 0;
        const c = cl(1.5 - Math.hypot(qx - u * dx, qy - u * dy), 0, 1), p = y * W + x;
        if (c <= 0) continue;
        if (COV[p] === 0) touched.push(p);
        if (c > COV[p]) COV[p] = c;
      }
  }
  const cv = touched.map((p) => COV[p]);
  touched.forEach((p) => (COV[p] = 0));
  return { px: touched, cv };
}

// One curve of a smoothing from arc end e1 to e2, the inner control points
// pulled a share tq of the way to the crossing point C.
function bend(E, C, [e1, e2], tq) {
  const P = E[e1], Q = E[e2], K1 = mix(P, C, tq), K2 = mix(Q, C, tq), out = [];
  for (let i = 0; i <= 10; i++) {
    const s = i / 10, u = 1 - s, w0 = u * u * u, w1 = 3 * u * u * s, w2 = 3 * u * s * s, w3 = s * s * s;
    out.push([w0 * P[0] + w1 * K1[0] + w2 * K2[0] + w3 * Q[0], w0 * P[1] + w1 * K1[1] + w2 * K2[1] + w3 * Q[1]]);
  }
  return raster(out);
}

const binom = (n, k) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - i + 1)) / i;
  return r;
};

// The drawing of one knot, kept once made: arcs, arc ends, crossings.
const GEO = new Map();
function geometry(ki) {
  if (GEO.has(ki)) return GEO.get(ki);
  const [a, b] = KNOTS[ki], M = 720, px = new Float64Array(M), py = new Float64Array(M);
  for (let i = 0; i < M; i++) {
    const t = (2 * PI * i) / M;
    for (let k = 0; k < a.length; k++) {
      px[i] += a[k] * sin((k + 1) * t);
      py[i] += b[k] * cos((k + 1) * t);
    }
  }
  const x0 = min(...px), x1 = max(...px), y0 = min(...py), y1 = max(...py), s = min(58 / (x1 - x0), 62 / (y1 - y0));
  for (let i = 0; i < M; i++) {
    px[i] = 32 + (px[i] - (x0 + x1) / 2) * s;
    py[i] = DCY - (py[i] - (y0 + y1) / 2) * s;
  }
  const X = [];
  for (let i = 0; i < M; i++) {
    const ax = px[i], ay = py[i], rx = px[(i + 1) % M] - ax, ry = py[(i + 1) % M] - ay;
    for (let j = i + 2; j < M; j++) {
      if (i === 0 && j === M - 1) continue;
      const cx = px[j], cy = py[j], sx = px[(j + 1) % M] - cx, sy = py[(j + 1) % M] - cy, den = rx * sy - ry * sx;
      if (abs(den) < 1e-12) continue;
      const qx = cx - ax, qy = cy - ay, u = (qx * sy - qy * sx) / den, v = (qx * ry - qy * rx) / den;
      if (u >= 0 && u < 1 && v >= 0 && v < 1) X.push({ x: ax + u * rx, y: ay + u * ry, t: [i + u, j + v], d: [[rx, ry], [sx, sy]] });
    }
  }
  // Reading order, so the state word follows the diagram top to bottom.
  X.sort((p, q) => (abs(p.y - q.y) > 3 ? p.y - q.y : p.x - q.x));
  const n = X.length, m = 2 * n, passes = [];
  X.forEach((c, k) => [0, 1].forEach((h) => passes.push({ c: k, t: c.t[h], d: c.d[h] })));
  passes.sort((p, q) => p.t - q.t);
  const L = new Float64Array(M + 1);
  for (let i = 0; i < M; i++) L[i + 1] = L[i] + Math.hypot(px[(i + 1) % M] - px[i], py[(i + 1) % M] - py[i]);
  const total = L[M], lenAt = (t) => L[floor(t)] + (t - floor(t)) * (L[floor(t) + 1] - L[floor(t)]);
  const pointAt = (sl) => {
    sl = ((sl % total) + total) % total;
    let lo = 0, hi = M;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (L[mid] <= sl) lo = mid;
      else hi = mid;
    }
    const u = (sl - L[lo]) / (L[lo + 1] - L[lo] || 1), j = (lo + 1) % M;
    return [px[lo] + (px[j] - px[lo]) * u, py[lo] + (py[j] - py[lo]) * u];
  };
  let gap = 1e9;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) gap = min(gap, Math.hypot(X[i].x - X[j].x, X[i].y - X[j].y));
  const rc = min(5.5, 0.38 * gap);
  // Arc k runs from pass k to pass k + 1, stopping rc short of each crossing;
  // end 2k is its start and 2k + 1 its end.
  const arcs = [], E = [];
  for (let k = 0; k < m; k++) {
    const sa = lenAt(passes[k].t) + rc, sb = lenAt(passes[(k + 1) % m].t) - rc + (k === m - 1 ? total : 0);
    const pts = [pointAt(sa)];
    for (let sl = sa + 1; sl < sb; sl += 1) pts.push(pointAt(sl));
    pts.push(pointAt(max(sa, sb)));
    arcs.push(raster(pts));
    E[2 * k] = pts[0];
    E[2 * k + 1] = pts[pts.length - 1];
  }
  const g = { n, m, E, arcs, X, passes, rc };
  GEO.set(ki, g);
  return g;
}

// Knot ki with its first sw crossings in reading order changed, and its
// whole walk: loop colours and running sums for every state.
function build(ki, sw) {
  const { n, m, E, arcs, X, passes, rc } = geometry(ki);
  const cr = X.map((c, i) => {
    const [p, q] = passes.map((ps, k) => (ps.c === i ? k : -1)).filter((k) => k >= 0);
    let over = p % 2 === 0 ? p : q, under = over === p ? q : p;
    if (i < sw) [over, under] = [under, over];
    const o = passes[over].d, u = passes[under].d;
    // y runs down the panel, so anticlockwise there is a negative cross product.
    const sign = o[0] * u[1] - o[1] * u[0] < 0 ? 1 : -1;
    const oin = 2 * ((over - 1 + m) % m) + 1, oout = 2 * over, uin = 2 * ((under - 1 + m) % m) + 1, uout = 2 * under;
    // At a positive crossing the A-smoothing is the oriented one.
    const oriented = [[uout, oin], [uin, oout]], other = [[oout, uout], [oin, uin]];
    const C = [c.x, c.y], A = sign > 0 ? oriented : other, B = sign > 0 ? other : oriented, g = 4.2 / rc;
    const conn = (pr) => ({ r: bend(E, C, pr, BEND), arc: pr[0] >> 1 });
    // The whole crossing: the over strand through, the under strand broken.
    const whole = [raster([E[oin], C, E[oout]]), raster([E[uin], mix(C, E[uin], g)]), raster([E[uout], mix(C, E[uout], g)])];
    return { C, sign, pairs: [A, B], smooth: [A.map(conn), B.map(conn)], whole };
  });
  const writhe = cr.reduce((s, c) => s + c.sign, 0), count = 1 << n, terms = [], par = new Int32Array(2 * m);
  const find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
  let emin = 1e9, emax = -1e9;
  // Gray code: step k changes the crossing of k's lowest set bit.
  for (let k = 0; k < count; k++) {
    const st = k ^ (k >> 1), roots = new Map(), loopOf = new Int32Array(m);
    for (let i = 0; i < 2 * m; i++) par[i] = i;
    for (let j = 0; j < m; j++) par[find(2 * j)] = find(2 * j + 1);
    cr.forEach((c, i) => c.pairs[(st >> i) & 1].forEach(([e1, e2]) => (par[find(e1)] = find(e2))));
    for (let j = 0; j < m; j++) {
      const r = find(2 * j);
      if (!roots.has(r)) roots.set(r, roots.size);
      loopOf[j] = roots.get(r);
    }
    let bb = 0;
    for (let i = 0; i < n; i++) bb += (st >> i) & 1;
    const loops = roots.size, base = n - 2 * bb - 2 * (loops - 1);
    emin = min(emin, base);
    emax = max(emax, base + 4 * (loops - 1));
    terms.push({ st, flip: k ? 31 - Math.clz32(k & -k) : -1, loops, loopOf, base, sgn: (loops - 1) % 2 ? -1 : 1 });
  }
  const nb = (emax - emin) / 4 + 1, sum = new Float32Array(nb);
  // A new loop keeps the colour it shares most arcs with, so a merge keeps
  // the larger loop's colour and a split hands one half a free colour.
  let prevCol = null;
  for (const tm of terms) {
    const col = new Int8Array(tm.loops).fill(-1);
    if (prevCol) {
      const votes = [], used = new Set();
      for (let l = 0; l < tm.loops; l++) {
        const cnt = new Map();
        for (let j = 0; j < m; j++) if (tm.loopOf[j] === l) cnt.set(prevCol[j], (cnt.get(prevCol[j]) || 0) + 1);
        for (const [c, v] of cnt) votes.push([v, l, c]);
      }
      votes.sort((p, q) => q[0] - p[0] || p[2] - q[2]);
      for (const [, l, c] of votes)
        if (col[l] < 0 && !used.has(c)) {
          col[l] = c;
          used.add(c);
        }
    }
    for (let l = 0; l < tm.loops; l++)
      if (col[l] < 0) {
        let c = 0;
        while (col.includes(c)) c++;
        col[l] = c;
      }
    tm.arcCol = tm.loopOf.map((l) => col[l]);
    prevCol = tm.arcCol;
    tm.before = Float32Array.from(sum);
    tm.add = new Float32Array(nb);
    for (let j = 0; j < tm.loops; j++) {
      const i = (tm.base + 4 * j - emin) / 4;
      tm.add[i] = tm.sgn * binom(tm.loops - 1, j);
      sum[i] += tm.add[i];
    }
    tm.after = Float32Array.from(sum);
  }
  // Name the knot by its Jones polynomial.
  const V = new Map();
  sum.forEach((c, i) => c && V.set(-(emin + 4 * i - 3 * writhe) / 4, writhe % 2 ? -c : c));
  const lo = min(...V.keys()), hi = max(...V.keys());
  let name = "?";
  for (const [nm, low, cf] of TABLE) {
    const same = (s) => cf.length === hi - lo + 1 && cf.every((c, j) => (V.get(s * (low + j)) || 0) === c);
    if (same(1)) name = nm;
    else if (same(-1) && name === "?") name = nm + "*";
  }
  return { ki, sw, name, n, m, E, arcs, cr, writhe, terms, emin, nb, step: STEP[n] || 0.3, count };
}

const length = (K) => T_INTRO + K.count * K.step + T_CLOSE + T_BRACKET + T_TURN + T_JONES;

function phase(S) {
  const K = S.K, last = K.count - 1;
  let t = S.tau - T_INTRO;
  if (t < 0) return { name: "intro", k: 0, f: 0 };
  if (t < K.count * K.step) return { name: "walk", k: floor(t / K.step), f: t / K.step - floor(t / K.step) };
  t -= K.count * K.step;
  if (t < T_CLOSE) return { name: "close", k: last, f: 1, u: t / T_CLOSE };
  t -= T_CLOSE;
  if (t < T_BRACKET) return { name: "hold", k: last, f: 1 };
  t -= T_BRACKET;
  if (t < T_TURN) return { name: "turn", k: last, f: 1, u: t / T_TURN };
  return { name: "jones", k: last, f: 1, left: T_JONES - t + T_TURN };
}

// 3 by 5 glyphs, a row to a digit read in binary; the 1 is one column wide so
// -14 fits under a bar 9 LEDs wide, the minus two.
const GL = { 0: "75557", 1: "11111", 2: "71747", 3: "71717", 4: "55711", 5: "74717", 6: "74757", 7: "71111", 8: "75757", 9: "75717", "-": "00300", A: "25755", B: "65656", "*": "05250", "?": "71302" };
const GW = { 1: 1, "-": 2 };
const textWidth = (str) => [...str].reduce((w, ch) => w + (GW[ch] || 3) + 1, -1);

export function setup(params) {
  params.s = { K: null, cycle: true, knob: -1, sw: 0, tau: 0, hue: 0, flip: 1, unit: 12, buf: new Float32Array(N * 3), cov: new Float32Array(N), col: new Float32Array(N * 3) };
}

function start(S, ki, tau) {
  S.K = build(ki, round(S.sw * geometry(ki).n));
  S.tau = tau == null ? T_INTRO + 3 * S.K.step : tau;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3), knob = cl(floor(k[2] || 0), 0, 5);
  S.sw = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  if (knob !== S.knob) {
    S.knob = knob;
    S.cycle = knob === 0;
    start(S, knob === 0 ? 0 : knob - 1);
  } else if (round(S.sw * S.K.n) !== S.K.sw) S.K = build(S.K.ki, round(S.sw * S.K.n)); // rebuilt where the walk stands
  S.tau += (d * speed) / 2;
  if (S.tau >= length(S.K)) start(S, S.cycle ? (S.K.ki + 1) % KNOTS.length : S.K.ki, 0);
  // The bar scale follows the largest bar, so the final bracket stands tall.
  const ph = phase(S), tm = S.K.terms[ph.k];
  let big = 1;
  for (let i = 0; i < S.K.nb; i++) big = max(big, abs(tm.after[i]), ph.name === "walk" || ph.name === "intro" ? abs(tm.before[i]) : 0);
  S.flip = ph.name === "turn" ? cos(PI * ease(ph.u)) : ph.name === "jones" ? -1 : 1;
  S.unit += (cl(BAR_MAX / big, 2, 12) - S.unit) * min(1, d * 3 * speed);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.K) return;
  const K = S.K, buf = S.buf, cov = S.cov, col = S.col, ph = phase(S), hue = S.hue;
  buf.fill(0);
  cov.fill(0);
  const pal = PAL.map((h) => hsv(h + hue, 0.85, 1)), knotCol = hsv(hue + 0.58, 0.32, 1), white = [1, 1, 1];
  const fade = ph.name === "intro" ? cl((S.tau / T_FADE) * 1.2, 0, 1) : ph.name === "jones" ? cl(ph.left / T_FADE, 0, 1) : 1;
  // Strokes: the most covering one wins a pixel, so colours never mix.
  const put = (r, c, a) => {
    for (let i = 0; i < r.px.length; i++) {
      const p = r.px[i], v = r.cv[i] * a;
      if (v > cov[p]) {
        cov[p] = v;
        col.set(c, p * 3);
      }
    }
  };
  const add = (x, y, c, a) => {
    x = floor(x);
    y = floor(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    for (let q = 0; q < 3; q++) buf[(y * W + x) * 3 + q] += c[q] * a;
  };
  const text = (str, x, y, c, a) => {
    for (const ch of str) {
      const w = GW[ch] || 3;
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < w; xx++) if ((+GL[ch][yy] >> (w - 1 - xx)) & 1) add(x + xx, y + yy, c, a);
      x += w + 1;
    }
  };
  const tm = K.terms[ph.k], prev = ph.k > 0 ? K.terms[ph.k - 1] : null, walk = ph.name === "walk";
  // How far the crossings stand open (0 the whole knot), and how far the
  // changing crossing has gone over.
  let open = 0, turn = 1;
  if (walk && ph.k === 0) open = ease(cl(ph.f / 0.3, 0, 1));
  else if (walk) [open, turn] = [1, ease(cl(ph.f / 0.3, 0, 1))];
  else if (ph.name === "close") open = 1 - ease(ph.u);
  const arcColour = (j) => mix(knotCol, prev ? mix(pal[prev.arcCol[j]], pal[tm.arcCol[j]], turn) : pal[tm.arcCol[j]], open);
  for (let j = 0; j < K.m; j++) put(K.arcs[j], arcColour(j), 1);
  // A crossing changes smoothing by pinching its two curves into the
  // crossing point, where together they make the X, and opening them out the
  // other way; the knot opens and closes the same way at every crossing.
  K.cr.forEach((c, i) => {
    const side = (tm.st >> i) & 1;
    if (open < 1) {
      const wa = 1 - cl(open / 0.25, 0, 1);
      if (wa > 0) for (const r of c.whole) put(r, knotCol, wa);
      if (open > 0) for (const pr of c.pairs[side]) put(bend(K.E, c.C, pr, PINCH + (BEND - PINCH) * open), arcColour(pr[0] >> 1), 1 - wa);
    } else if (prev && i === tm.flip && turn < 1) {
      const tq = turn < 0.5 ? BEND + (PINCH - BEND) * turn * 2 : PINCH + (BEND - PINCH) * (turn * 2 - 1);
      for (const q of c.pairs[turn < 0.5 ? 1 - side : side]) put(bend(K.E, c.C, q, tq), arcColour(q[0] >> 1), 1);
    } else for (const q of c.smooth[side]) put(q.r, arcColour(q.arc), 1);
  });
  for (let p = 0; p < N; p++) for (let q = 0; q < 3; q++) buf[p * 3 + q] = col[p * 3 + q] * cov[p];
  // A ring of light where a crossing changes.
  if (walk && ph.f < 0.4)
    for (const c of ph.k === 0 ? K.cr : [K.cr[tm.flip]])
      for (let q = 0; q < 20; q++) add(c.C[0] + (1 + ph.f * 14) * cos(q * 0.314), c.C[1] + (1 + ph.f * 14) * sin(q * 0.314), white, 0.55 * (1 - ph.f / 0.4));
  // The knot's name in Rolfsen's table, top left.
  const dim = hsv(hue + 0.6, 0.25, 0.42);
  text(K.name[0], 1, 1, dim, 1);
  if (K.name[1]) text(K.name[1], 5, 4, dim, 1);
  if (K.name[2]) text(K.name[2], 6 + textWidth(K.name[1]), 1, dim, 1);
  // The state word, one letter per crossing in reading order, a changed
  // crossing underlined, then a dot per loop, which changes halfway through a turn.
  const letA = hsv(hue + 0.55, 0.12, 0.95), letB = hsv(hue + 0.08, 0.4, 0.95);
  const dots = [...new Set((prev && turn < 0.5 ? prev : tm).arcCol)].sort((p, q) => p - q);
  const x0 = round((W - K.n * 4 - 4 - dots.length * 4) / 2), shown = walk ? 1 : ph.name === "close" ? 1 - ph.u : 0;
  for (let i = 0; i < K.n; i++) {
    const side = (tm.st >> i) & 1, hot = walk && (i === tm.flip || ph.k === 0) ? 1 - cl(ph.f / 0.5, 0, 1) : 0;
    text(side ? "B" : "A", x0 + i * 4, ROW_STRIP, mix(side ? letB : letA, white, hot), (0.65 + 0.35 * hot) * shown);
    if (i < K.sw) for (let xx = 0; xx < 3; xx++) add(x0 + i * 4 + xx, ROW_STRIP + 6, letB, 0.8 * shown);
  }
  dots.forEach((c, i) => {
    for (let q = 0; q < 9; q++) add(x0 + K.n * 4 + 4 + i * 4 + (q % 3), ROW_STRIP + 1 + floor(q / 3), pal[c], shown);
  });
  // The chart. It turns over about its middle column into the Jones
  // polynomial, and upside down as well when the writhe is odd.
  const nb = K.nb, sp = min(16, W / nb), bw = max(3, round(sp) - 1), fl = S.flip, ys = K.writhe % 2 ? fl : 1, u = S.unit;
  const grow = walk ? ease(cl((ph.f - 0.3) / 0.3, 0, 1)) : 1, fresh0 = walk ? 1 - cl((ph.f - 0.45) / 0.5, 0, 1) : 0;
  const posC = hsv(hue + 0.13, 0.4, 1), negC = hsv(hue + 0.93, 0.5, 1), grid = hsv(hue + 0.6, 0.2, 0.3);
  const glow = walk || ph.name === "intro" ? 0 : 0.15 + 0.15 * cos(S.tau * 4);
  for (let x = 0; x < W; x++) add(x, ZY, grid, 0.7);
  let widest = 0;
  for (let i = 0; i < nb; i++) widest = max(widest, textWidth(String(K.emin + 4 * i)));
  const stagger = fl > 0 && widest > sp - 2;
  for (let i = 0; i < nb; i++) {
    const xc = (i - (nb - 1) / 2) * sp, xa = 32 + (xc - bw / 2) * fl, xb = 32 + (xc + bw / 2) * fl;
    const lo = min(xa, xb), hi = max(xa, xb), old = tm.before[i] * ys;
    const v = ph.name === "intro" ? 0 : old + (tm.after[i] * ys - old) * grow, h = abs(v) * u, dir = v >= 0 ? -1 : 1;
    const fresh = tm.add[i] !== 0 ? fresh0 : 0;
    // Rows past this height are what the state just added; a shrinking bar
    // lights its tip instead.
    const from = old * v > 0 ? abs(old) * u : 0;
    for (let r = 0; r < Math.ceil(h); r++) {
      // A dim row where one unit ends and the next begins.
      const seam = u >= 3 && floor((r + 1) / u) > floor(r / u) && r + 1 < h - 0.01 ? 0.45 : 1;
      const lit = fresh > 0 && (r + 1 > from || (from >= h && r >= Math.ceil(h) - 1));
      const cc = mix(v >= 0 ? posC : negC, white, lit ? 0.7 * fresh : 0);
      for (let x = floor(lo); x <= floor(hi - 0.01); x++) add(x, ZY + dir * (r + 1), cc, cl(h - r, 0, 1) * seam * min(1, x + 1 - lo, hi - x) * (0.85 + glow));
    }
    if (fresh > 0) for (let x = floor(lo); x <= floor(hi - 0.01); x++) add(x, ZY, white, 0.6 * fresh);
    // Labels: powers of A, or of t once the chart has turned over.
    if (abs(fl) > 0.35) {
      const e = K.emin + 4 * i, lab = String(fl > 0 ? e : -(e - 3 * K.writhe) / 4);
      const lc = fresh > 0 ? mix(grid, white, fresh) : hsv(hue + 0.6, 0.2, 0.55);
      text(lab, round((lo + hi) / 2 - textWidth(lab) / 2 + 0.01), stagger ? 117 + 6 * (i % 2) : 119, lc, cl((abs(fl) - 0.35) / 0.3, 0, 1));
    }
  }
  for (let p = 0; p < N; p++) display.setPixel(p % W, floor(p / W), round(min(1, buf[p * 3] * fade) * 255), round(min(1, buf[p * 3 + 1] * fade) * 255), round(min(1, buf[p * 3 + 2] * fade) * 255));
}
