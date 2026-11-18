// ===== Patternflow pattern =====
// Title:   Heilbronn Triangles
// Family:  sim
// Idea:    Points burst out of the middle of a 1 by 2 rectangle and an annealer pushes them apart so that the smallest triangle any three of them make grows, and when it stops, the points sit with a crowd of thin triangles all of the same smallest area, the least one filled and a gauge at the foot reading it against the best this pattern has found for that many points, until a shake knocks the points loose and they find another arrangement as good.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Heilbronn triangle problem (Hans Heilbronn, about 1950), lower bound of order log n / n^2 (Janos Komlos, Janos Pintz and Endre Szemeredi, 1982), simulated annealing (Scott Kirkpatrick, C. Daniel Gelatt and Mario Vecchi, 1983) on a soft minimum of the areas; pattern round 109
// Round:   109
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Points=-3..4, Shake=0.3..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the thin triangles are cyan, blue and violet, each its own shade within a quarter of the wheel, the least one is filled pink, the points are pale cyan, white where they glow, and the gauge is cyan with a gold mark for the best. A fill that would land in orange or yellow goes pale so it does not read as brown.
// Knob 2: Speed. How fast the annealer works. At 2 a run is 3 s of annealing, 1.3 s of a polish that tightens the ties and 1.3 s held still, 5.6 s in all, and then the shake. 0.5 is four times slower and 4 is twice as fast, with twice the moves to a frame. What is drawn follows the points a quarter of a clock unit behind, so a kick shows as a fling and not as a jump.
// Knob 3: Points. The number of points is 8 plus this, from 5 at -3 to 12 at 4, and it catches at whole numbers. A new count starts again from a cloud in the middle. More points mean more triangles, 10 for 5 points and 220 for 12, and a smaller smallest one: the best known is between 4.1 and 4.8 over n squared of the rectangle for 5 to 10 points.
// Knob 4: Shake. How hard each run is knocked loose, 0.3 to 1. Every point is moved by a random step of 0.15 of the width at 0.3 and 0.4 of it at 1, and the annealer is heated again, to 0.10 at 0.3 and 0.18 at 1 (a drop of that share in the area is accepted one time in e). The first run starts from a cloud of the same size round the middle, so the knob shows in the first seconds as how far the burst reaches.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, log, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The points live in the unit square. The problem is the same in a 1 by 2
// rectangle: a stretch keeps every ratio of areas, so the largest smallest
// triangle, as a share of the rectangle, is the same, and the panel shows
// the square pulled to 55 by 110 LEDs. The corners of that rectangle are at
// pixels (4, 4) and (59, 114).
const RX = 4, RY = 4, RW = 55, RH = 110;

// Every triple of points for each count, and for each point the triples it is in.
const NMIN = 5, NMAX = 12;
const TAB = [];
for (let n = NMIN; n <= NMAX; n++) {
  const a = [], b = [], c = [], of = [];
  for (let i = 0; i < n; i++) of.push([]);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        of[i].push(a.length);
        of[j].push(a.length);
        of[k].push(a.length);
        a.push(i);
        b.push(j);
        c.push(k);
      }
  TAB[n] = { nt: a.length, a: Int32Array.from(a), b: Int32Array.from(b), c: Int32Array.from(c), of: of.map((l) => Int32Array.from(l)) };
}

// The area of the triangle of points i, j and k of P (x, y pairs).
function area(P, i, j, k) {
  return 0.5 * abs((P[2 * j] - P[2 * i]) * (P[2 * k + 1] - P[2 * i + 1]) - (P[2 * j + 1] - P[2 * i + 1]) * (P[2 * k] - P[2 * i]));
}

// The smallest triangle of the first n points, by brute force over every triple.
function minTri(P, n) {
  const T = TAB[n];
  let m = 1e9;
  for (let t = 0; t < T.nt; t++) {
    const a = area(P, T.a[t], T.b[t], T.c[t]);
    if (a < m) m = a;
  }
  return m;
}

// A sum of every area to the power -p is the soft minimum: its p-th root
// reciprocal, F = (sum A^-p)^(-1/p), is a little under the smallest area, and
// is the smallest area itself as p grows. It is smooth, so a point that moves
// to part two small triangles is rewarded for both, where the plain minimum
// would not notice. The annealer works on ln F and the polish climbs it.
const FLOOR = 1e-4;

// Clock of a run, in units of 1 s at Speed 2.
const TC = 3, TP = 1.3, TH = 1.3, T_RUN = TC + TP + TH;
const P0 = 10, P1 = 60, P2 = 300, TEMP1 = 0.0005;
const EVALS = 650000, MAXPROP = 22000, ITS = 450, LAG = 0.25;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, n: 0, shake: 0.3, tau: 0, phase: 0, run: 0,
    P: new Float64Array(2 * NMAX), D: new Float64Array(2 * NMAX), Q: new Float64Array(2 * NMAX), G: new Float64Array(2 * NMAX), G2: new Float64Array(2 * NMAX),
    A: new Float64Array(220), Wt: new Float64Array(220), term: new Float64Array(220), cand: new Float64Array(220),
    glow: new Float64Array(220), best: new Float64Array(NMAX + 1), flash: 0, cur: 0,
    p: P0, sum: 1, sc: 1, sig: 0.1, T0: 0.02, acc: 0, tries: 0, owe: 0, eta: 0.004, pp: P1,
    buf: new Uint8Array(W * H * 3),
  };
}

function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 2;
}

// A run starts: from a cloud round the middle on the first run and after a
// change of count, from the arrangement that held still plus a kick after that.
function begin(S, first) {
  const n = S.n, P = S.P, kick = 0.04 + 0.36 * S.shake;
  for (let i = 0; i < n; i++) {
    const x = first ? 0.5 : P[2 * i], y = first ? 0.5 : P[2 * i + 1];
    P[2 * i] = cl(x + gauss() * kick, 0, 1);
    P[2 * i + 1] = cl(y + gauss() * kick, 0, 1);
  }
  if (first) S.D.set(P);
  S.tau = 0;
  S.phase = 0;
  S.run++;
  S.sc = 1 / (n * n);
  S.T0 = 0.06 + 0.12 * S.shake;
  S.sig = 0.1;
  S.acc = 0;
  S.tries = 0;
  S.owe = 0;
  S.p = P0;
  rebuild(S);
}

// The terms A^-p of every triple, in units of 1/n^2 of the square, and their sum.
function rebuild(S) {
  const T = TAB[S.n], P = S.P, p = S.p, sc = S.sc;
  let sum = 0;
  for (let t = 0; t < T.nt; t++) {
    const v = pow(max(area(P, T.a[t], T.b[t], T.c[t]), sc * FLOOR) / sc, -p);
    S.term[t] = S.cand[t] = v;
    sum += v;
  }
  S.sum = sum;
}

// One move of one point, accepted by the Metropolis rule on ln F at the
// temperature temp. Only the triples that hold the point change.
function move(S, temp) {
  const n = S.n, T = TAB[n], P = S.P, p = S.p, sc = S.sc;
  const i = floor(Math.random() * n), L = T.of[i];
  const ox = P[2 * i], oy = P[2 * i + 1];
  P[2 * i] = cl(ox + gauss() * S.sig, 0, 1);
  P[2 * i + 1] = cl(oy + gauss() * S.sig, 0, 1);
  const cand = S.cand;
  for (let q = 0; q < L.length; q++) {
    const t = L[q];
    cand[t] = pow(max(area(P, T.a[t], T.b[t], T.c[t]), sc * FLOOR) / sc, -p);
  }
  let s = 0;
  for (let t = 0; t < T.nt; t++) s += cand[t];
  const df = -(log(s) - log(S.sum)) / p;
  S.tries++;
  if (df >= 0 || Math.random() < exp(df / temp)) {
    for (let q = 0; q < L.length; q++) S.term[L[q]] = cand[L[q]];
    S.sum = s;
    S.acc++;
  } else {
    P[2 * i] = ox;
    P[2 * i + 1] = oy;
    for (let q = 0; q < L.length; q++) cand[L[q]] = S.term[L[q]];
  }
  if (S.tries >= 200) {
    const r = S.acc / S.tries;
    S.sig = cl(S.sig * (r > 0.4 ? 1.25 : r < 0.25 ? 0.8 : 1), 1e-5, 0.3);
    S.acc = 0;
    S.tries = 0;
  }
}

// ln F of the points in X at exponent p, and its gradient in G when given.
// d ln F / dA of a triangle is its share of the sum over its area, and the
// area's gradient at a vertex is half the opposite side turned a quarter.
function lnF(S, X, p, G) {
  const T = TAB[S.n], A = S.A, Wt = S.Wt;
  let m = 1e9;
  for (let t = 0; t < T.nt; t++) {
    A[t] = max(area(X, T.a[t], T.b[t], T.c[t]), 1e-12);
    if (A[t] < m) m = A[t];
  }
  let sum = 0;
  for (let t = 0; t < T.nt; t++) {
    const r = m / A[t];
    Wt[t] = r < 0.05 ? 0 : pow(r, p);
    sum += Wt[t];
  }
  if (G) {
    G.fill(0);
    for (let t = 0; t < T.nt; t++) {
      const w = Wt[t] / sum / A[t];
      if (w < 1e-12) continue;
      const i = T.a[t], j = T.b[t], k = T.c[t];
      const ax = X[2 * i], ay = X[2 * i + 1], bx = X[2 * j], by = X[2 * j + 1], cx = X[2 * k], cy = X[2 * k + 1];
      const s = ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) > 0 ? 0.5 : -0.5) * w;
      G[2 * i] += s * (by - cy);
      G[2 * i + 1] += s * (cx - bx);
      G[2 * j] += s * (cy - ay);
      G[2 * j + 1] += s * (ax - cx);
      G[2 * k] += s * (ay - by);
      G[2 * k + 1] += s * (bx - ax);
    }
  }
  return log(m) - log(sum) / p;
}

// One step of the polish: a step along the gradient of ln F whose longest
// move is eta, kept if ln F did not fall, and eta grown or halved.
function polish(S) {
  const n = S.n, P = S.P, Q = S.Q, G = S.G;
  let gm = 1e-300;
  for (let i = 0; i < 2 * n; i++) gm = max(gm, abs(G[i]));
  for (let i = 0; i < 2 * n; i++) Q[i] = cl(P[i] + (S.eta * G[i]) / gm, 0, 1);
  const nx = lnF(S, Q, S.pp, S.G2);
  if (nx >= S.cur) {
    P.set(Q.subarray(0, 2 * n));
    G.set(S.G2);
    S.cur = nx;
    S.eta = min(0.01, S.eta * 1.15);
  } else {
    S.eta = max(1e-7, S.eta * 0.6);
    S.cur = lnF(S, P, S.pp, G);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 4);
  S.shake = cl(k[3], 0.3, 1);
  const n = cl(8 + round(k[2]), NMIN, NMAX);
  if (n !== S.n) {
    S.n = n;
    begin(S, true);
  }
  const c = d * (S.speed / 2);
  S.tau += c;
  S.flash = max(0, S.flash - d);
  // What is drawn follows the annealer a quarter of a clock unit behind, so the
  // heat shows as a wobble and a kick as a shudder, not as a flicker.
  const lag = 1 - exp(-c / LAG);
  for (let i = 0; i < 2 * n; i++) S.D[i] += (S.P[i] - S.D[i]) * lag;
  if (S.phase === 0) {
    const f = min(1, S.tau / TC);
    const temp = S.T0 * pow(TEMP1 / S.T0, f);
    const np = P0 + (P1 - P0) * f;
    if (abs(np - S.p) > 0.5) {
      S.p = np;
      rebuild(S);
    }
    // The moves a clock unit buys: a fixed number of triangle areas, so that a
    // point's move costs less with fewer points.
    S.owe += c * min(MAXPROP, EVALS / ((n - 1) * (n - 2) * 0.5));
    const cnt = floor(S.owe);
    S.owe -= cnt;
    for (let q = 0; q < cnt; q++) move(S, temp);
    if (S.tau >= TC) {
      S.phase = 1;
      S.pp = P1;
      S.eta = 0.004;
      S.cur = lnF(S, S.P, S.pp, S.G);
      S.owe = 0;
    }
  } else if (S.phase === 1) {
    const f = min(1, (S.tau - TC) / TP), pp = P1 * pow(P2 / P1, f);
    if (pp > S.pp * 1.02) {
      S.pp = pp;
      S.cur = lnF(S, S.P, S.pp, S.G);
    }
    S.owe += c * ITS;
    const cnt = floor(S.owe);
    S.owe -= cnt;
    for (let q = 0; q < cnt; q++) polish(S);
    if (S.tau >= TC + TP) {
      S.phase = 2;
      const m = minTri(S.P, n);
      if (m > S.best[n] * 1.0005) {
        S.best[n] = m;
        S.flash = 1.2;
      }
    }
  } else if (S.tau >= T_RUN) {
    begin(S, false);
  }
}

// Pixel of a point.
const px = (u) => RX + u * RW, py = (v) => RY + v * RH;

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.n) return;
  const n = S.n, T = TAB[n], P = S.D, buf = S.buf, A = S.A, h0 = S.hue + 0.5;
  buf.fill(0);
  const add = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    buf[o] = min(255, buf[o] + c[0] * a * 255);
    buf[o + 1] = min(255, buf[o + 1] + c[1] * a * 255);
    buf[o + 2] = min(255, buf[o + 2] + c[2] * a * 255);
  };
  // A line by Wu's method, its ends where the points' glow takes over.
  const line = (x0, y0, x1, y1, c, a) => {
    const steep = abs(y1 - y0) > abs(x1 - x0);
    if (steep) [x0, y0, x1, y1] = [y0, x0, y1, x1];
    if (x0 > x1) [x0, y0, x1, y1] = [x1, y1, x0, y0];
    const g = x1 === x0 ? 0 : (y1 - y0) / (x1 - x0);
    for (let x = round(x0); x <= round(x1); x++) {
      const y = y0 + g * (x - x0), yi = floor(y), f = y - yi;
      if (steep) {
        add(yi, x, c, a * (1 - f));
        add(yi + 1, x, c, a * f);
      } else {
        add(x, yi, c, a * (1 - f));
        add(x, yi + 1, c, a * f);
      }
    }
  };
  const C = [0, 0, 0], FILL = [0, 0, 0], DOT = [0, 0, 0], BAR = [0, 0, 0], GOLD = [0, 0, 0];
  // An orange or yellow fill goes pale, because a dim one reads as brown.
  const fh = fr(h0 + 0.4);
  if (fh > 0.03 && fh < 0.2) hsv(fh, 0.4, 1, FILL);
  else hsv(fh, 0.75, 1, FILL);
  hsv(h0, 0.3, 1, DOT);
  hsv(h0 + 0.03, 0.85, 1, BAR);
  hsv(h0 - 0.36, 0.55, 1, GOLD);

  // The rectangle.
  const FR = [0, 0, 0];
  hsv(h0 + 0.05, 0.8, 1, FR);
  for (let x = RX; x <= RX + RW; x++) {
    add(x, RY, FR, 0.2);
    add(x, RY + RH, FR, 0.2);
  }
  for (let y = RY; y <= RY + RH; y++) {
    add(RX, y, FR, 0.2);
    add(RX + RW, y, FR, 0.2);
  }

  // Every triangle's area, the smallest, and the three smallest.
  let m = 1e9, mi = 0;
  let s1 = -1, s2 = -1, s3 = -1;
  for (let t = 0; t < T.nt; t++) {
    const a = area(P, T.a[t], T.b[t], T.c[t]);
    A[t] = a;
    if (a < m) {
      m = a;
      mi = t;
    }
  }
  m = max(m, 1e-9);
  for (let t = 0; t < T.nt; t++) {
    if (t === mi) continue;
    if (s1 < 0 || A[t] < A[s1]) {
      s3 = s2;
      s2 = s1;
      s1 = t;
    } else if (s2 < 0 || A[t] < A[s2]) {
      s3 = s2;
      s2 = t;
    } else if (s3 < 0 || A[t] < A[s3]) s3 = t;
  }
  let ties = 0;
  const X = [], Y = [];
  for (let i = 0; i < n; i++) {
    X.push(px(P[2 * i]));
    Y.push(py(P[2 * i + 1]));
  }

  // The fill of the least triangle, which eases over to the next when two tie.
  for (let t = 0; t < T.nt; t++) {
    const g = S.glow[t], tg = t === mi ? 1 : 0;
    S.glow[t] = g + (tg - g) * (tg > g ? 0.6 : 0.3);
    if (A[t] <= m * 1.03) ties++;
    const gl = S.glow[t];
    if (gl < 0.04) continue;
    const ax = X[T.a[t]], ay = Y[T.a[t]], bx = X[T.b[t]], by = Y[T.b[t]], cx = X[T.c[t]], cy = Y[T.c[t]];
    const x0 = max(0, floor(min(ax, bx, cx))), x1 = min(W - 1, floor(max(ax, bx, cx)) + 1);
    const y0 = max(0, floor(min(ay, by, cy))), y1 = min(H - 1, floor(max(ay, by, cy)) + 1);
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (abs(den) < 1e-6) continue;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / den, l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / den, l3 = 1 - l1 - l2;
        if (l1 >= -0.01 && l2 >= -0.01 && l3 >= -0.01) add(x, y, FILL, 0.55 * gl);
      }
  }

  // The tight triangles: all those within 16% of the smallest, brighter the
  // nearer they are to it, and at the start of a run the three smallest
  // whatever their size.
  const t0 = S.tau * 2;
  for (let t = 0; t < T.nt; t++) {
    const r = A[t] / m;
    let b = r < 1.16 ? 1 - sm((r - 1) / 0.16) : 0;
    if (t === mi) b = 1;
    else if (t === s1) b = max(b, 0.5);
    else if (t === s2) b = max(b, 0.36);
    else if (t === s3) b = max(b, 0.26);
    if (b <= 0.02) continue;
    // Each triangle keeps its own shade, from a quarter of the wheel.
    hsv(h0 + 0.3 * fr(t * 0.6180339887498949) - 0.04, 0.78, 1, C);
    const lv = (0.3 + 0.7 * b) * (S.phase === 2 ? 0.88 + 0.12 * Math.sin(t0 + t * 1.7) : 1);
    const i = T.a[t], j = T.b[t], k = T.c[t];
    line(X[i], Y[i], X[j], Y[j], C, lv * 0.8);
    line(X[j], Y[j], X[k], Y[k], C, lv * 0.8);
    line(X[k], Y[k], X[i], Y[i], C, lv * 0.8);
  }

  // The points, a hot core and a soft glow.
  for (let i = 0; i < n; i++) {
    const cx = X[i], cy = Y[i];
    for (let y = floor(cy) - 3; y <= floor(cy) + 4; y++)
      for (let x = floor(cx) - 3; x <= floor(cx) + 4; x++) {
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        add(x, y, DOT, 0.95 * exp(-d2 / 0.9) + 0.22 * exp(-d2 / 5));
      }
  }

  // The foot: a row of pips for the triangles within 3% of the smallest, and
  // the gauge. The track is 5 over n squared of the square, which a smallest
  // triangle comes near at every n, and the gold mark is the best this
  // pattern has found for this many points.
  const GX = 4, GW = 56, GY = 121;
  const scale = 5.2 / (n * n);
  for (let i = 0; i < 24; i++) {
    const on = i < ties;
    hsv(h0 + 0.3 * fr((i + 1) * 0.6180339887498949), 0.78, 1, C);
    if (on || i < T.nt) {
      add(GX + i * 2 + 4, 117, C, on ? 1 : 0.1);
      add(GX + i * 2 + 4, 118, C, on ? 1 : 0.1);
    }
  }
  for (let x = 0; x < GW; x++)
    for (let y = GY; y < GY + 4; y++) add(GX + x, y, BAR, 0.1);
  for (const q of [0.25, 0.5, 0.75]) for (let y = GY; y < GY + 4; y++) add(GX + round(q * (GW - 1)), y, BAR, 0.3);
  const len = cl((m / scale) * GW, 0, GW), best = S.best[n] > 0 ? cl((S.best[n] / scale) * GW, 0, GW) : 0;
  const fl = S.flash > 0 ? sm(S.flash / 1.2) : 0;
  for (let x = 0; x < len; x++) {
    const e = min(1, len - x), u = x / GW;
    hsv(h0 - 0.02 + 0.1 * u, 0.85 - 0.45 * fl, 1, C);
    for (let y = GY; y < GY + 4; y++) add(GX + x, y, C, (0.55 + 0.45 * u + 0.4 * fl) * e);
  }
  if (best > 0) {
    const bx = GX + min(GW - 1, round(best));
    for (let y = GY - 3; y < GY + 7; y++) add(bx, y, GOLD, 0.7 + 0.3 * fl);
  }

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
