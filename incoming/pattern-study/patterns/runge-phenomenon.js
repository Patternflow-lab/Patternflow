// ===== Patternflow pattern =====
// Title:   Runge Phenomenon
// Family:  wave
// Idea:    The bump 1/(1 + 25x²) stands up the panel with its interpolation nodes as beads on it, and as equally spaced nodes multiply from 3 to 21 the polynomial through them throws pink and gold lobes from edge to edge at the top and bottom, until the beads slide to Chebyshev's places and the curve lies down on the bump, while a violet glow behind shows where the nodes leave room for error.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Runge's phenomenon (Carl Runge, 1901), with Chebyshev nodes, pattern round 43
// Round:   43
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Nodes=21..41, Chebyshev=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the bump is azure, the lobes where the polynomial overshoots it pink and where it falls short gold, the curve white and the beads pale gold; at 0.25 the bump is violet with yellow and green lobes. The dim bump never takes red, orange or yellow, which read maroon, brown and olive: from 0.35 to 0.53 it is crimson and from 0.53 to 0.72 green, while the lobes keep turning.
// Knob 2: Speed. At 2 one round takes 17.5 seconds: 7 to climb from 3 nodes to the most, 1.2 held, 3 sliding to Chebyshev's nodes, 1.3 held, 3.5 back down to 3 and 1.5 sliding home. At 0.2 a round takes 175 seconds, at 3 about 11.7.
// Knob 3: Nodes, the most the climb reaches, odd counts from 21 to 41. At 21 the worst error is 59.8 where the bump is 1 tall, at 31 it is 2,388 and at 41 about 105,000. The lobes that run off the panel's edge reach in 11 rows from each end at 21 nodes and 14 at 41, as thinner bars, and the climb goes 2.1 times as fast.
// Knob 4: Chebyshev. Where the nodes sit while they climb, from equally spaced to Chebyshev's. Up to 0.06 equally spaced exactly; at 0.5 nearly halfway, the worst error 1.6 at 21 nodes and 44 at 41; at 0.75 about 0.15 at any count; at 1 Chebyshev's all along, the curve never more than 0.6 off the bump (at 3 nodes) and 0.015 at 21, so the lobes never come and the beads and the glow do the moving.

const W = 64, H = 128;
const { floor, min, max, abs, cos, exp, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => {
  const t = cl(v, 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Runge's function: 1 in the middle, 1/26 at the ends.
const A = 25;
const runge = (x) => 1 / (1 + A * x * x);

// The interval stands up the panel: x = -1 at the centre of row 2, x = 1 at
// the centre of row 125, so the end beads fit.
const YA = 2.5, YB = 125.5;
const toX = (py) => -1 + (2 * (py - YA)) / (YB - YA);
const toY = (x) => YA + ((x + 1) * (YB - YA)) / 2;
// A value v sits at column C0 + SC v: the bump's foot at column 16.5, its top
// at 52.5. Past -0.4 and 1.15 the scale squeezes into the last LEDs, so a
// lobe of 2 and a lobe of 60 both reach the edge and still differ there.
const C0 = 16.5, SC = 36, VL = -0.4, VH = 1.15;
function col(v) {
  if (v > VH) return C0 + SC * VH + 5.6 * (1 - exp(-(v - VH) / 0.7));
  if (v < VL) return C0 + SC * VL - 2.8 * (1 - exp((v - VL) / 0.7));
  return C0 + SC * v;
}

// The round, in units that pass at one a second at Speed 2.
const T_CLIMB = 7, T_WILD = 1.2, T_SETTLE = 3, T_CALM = 1.3, T_DOWN = 3.5, T_HOME = 1.5;
const T_ROUND = T_CLIMB + T_WILD + T_SETTLE + T_CALM + T_DOWN + T_HOME;
const NMAX = 41, SUB = 4;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, top: 21, base: 0, tau: 0,
    // Up to three node sets in play: the one sliding, or the old set at its
    // new places and the new set it is blending into.
    sets: [0, 1].map(() => ({ X: new Float64Array(NMAX + 2), w: new Float64Array(NMAX + 2), F: new Float64Array(NMAX + 2), n: 0, k: 0 })),
    nsets: 1,
    dots: new Float64Array((NMAX + 2) * 3), ndots: 0,
    pc: new Float64Array(SUB), fc: new Float64Array(SUB), om: new Float64Array(H),
    col: new Float32Array(8 * 3), colHue: NaN,
    tmpA: new Float64Array(NMAX + 2), tmpB: new Float64Array(NMAX + 2),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 21, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  // Odd counts only: every set then has a node at 0 and the picture is the
  // same at the top and the bottom.
  S.top = 2 * round((cl(k[2], 21, 41) - 1) / 2) + 1;
  // Up to 0.06 the nodes are equally spaced exactly.
  S.base = max(0, cl(k[3], 0, 1) - 0.06) / 0.94;
  S.tau = (S.tau + d * S.speed * 0.5) % T_ROUND;
}

// n nodes, sorted, a fraction c of the way from equally spaced to
// Chebyshev's, cos((2k + 1) pi / 2n).
function nodes(n, c, out) {
  for (let k = 0; k < n; k++) {
    const e = -1 + (2 * k) / (n - 1), ch = -cos(((2 * k + 1) * PI) / (2 * n));
    out[k] = e + (ch - e) * c;
  }
}

// Barycentric weights w_j = 1 / prod (x_j - x_k), scaled to a largest of 1.
// With them p(x) = sum w_j f_j / (x - x_j) / sum w_j / (x - x_j), the second
// barycentric form (Berrut and Trefethen, 2004), stable for any nodes.
function prepare(set, X, n, weight) {
  let big = 0;
  for (let j = 0; j < n; j++) {
    let p = 1;
    for (let k = 0; k < n; k++) if (k !== j) p *= X[j] - X[k];
    set.X[j] = X[j];
    set.F[j] = runge(X[j]);
    set.w[j] = 1 / p;
    big = max(big, abs(set.w[j]));
  }
  for (let j = 0; j < n; j++) set.w[j] /= big;
  set.n = n;
  set.k = weight;
}

function bary(set, x) {
  const { X, w, F, n } = set;
  let num = 0, den = 0;
  for (let j = 0; j < n; j++) {
    const d = x - X[j];
    if (d === 0) return F[j];
    const t = w[j] / d;
    num += t * F[j];
    den += t;
  }
  return num / den;
}

// Where the round is: the node level m (n = 2m + 1) with the step's progress
// u, and how far the nodes are toward Chebyshev's.
function stage(S) {
  const M = (S.top - 1) / 2, b = S.base;
  let t = S.tau;
  if (t < T_CLIMB) return [1 + (M - 1) * (t / T_CLIMB), b];
  t -= T_CLIMB;
  if (t < T_WILD) return [M, b];
  t -= T_WILD;
  if (t < T_SETTLE) return [M, mix(b, 1, sm(t / T_SETTLE))];
  t -= T_SETTLE;
  if (t < T_CALM) return [M, 1];
  t -= T_CALM;
  if (t < T_DOWN) return [M - (M - 1) * (t / T_DOWN), 1];
  t -= T_DOWN;
  return [1, mix(1, b, sm(t / T_HOME))];
}

// Build the node sets and the beads for this frame. Going from n to n + 2
// nodes takes two halves: first the n nodes spread to their places in the
// new set, the curve through them all the way; then the two new nodes beside
// the middle one grow in and the curve blends to the one through all n + 2.
function build(S) {
  const [lv, c] = stage(S);
  let m = floor(lv), u = lv - m;
  if (m >= (S.top - 1) / 2) (m = (S.top - 1) / 2), (u = 0);
  const n = 2 * m + 1, OLD = S.tmpA, NEW = S.tmpB;
  nodes(n, c, OLD);
  if (u === 0) {
    prepare(S.sets[0], OLD, n, 1);
    S.nsets = 1;
    for (let k = 0; k < n; k++) setDot(S, k, OLD[k], 1);
    S.ndots = n;
    return;
  }
  nodes(n + 2, c, NEW);
  // Old node k goes to new k below the middle, the middle to the middle, and
  // the rest two places on: new m and m + 2 are the ones born.
  const to = (k) => (k < m ? k : k === m ? m + 1 : k + 2);
  if (u < 0.5) {
    const e = sm(u / 0.5);
    for (let k = 0; k < n; k++) OLD[k] = mix(OLD[k], NEW[to(k)], e);
    prepare(S.sets[0], OLD, n, 1);
    S.nsets = 1;
    for (let k = 0; k < n; k++) setDot(S, k, OLD[k], 1);
    S.ndots = n;
    return;
  }
  const e = sm((u - 0.5) / 0.5);
  for (let k = 0; k < n; k++) OLD[k] = NEW[to(k)];
  prepare(S.sets[0], OLD, n, 1 - e);
  prepare(S.sets[1], NEW, n + 2, e);
  S.nsets = 2;
  for (let k = 0; k < n + 2; k++) setDot(S, k, NEW[k], k === m || k === m + 2 ? e : 1);
  S.ndots = n + 2;
}

function setDot(S, k, x, size) {
  S.dots[3 * k] = col(runge(x));
  S.dots[3 * k + 1] = toY(x);
  S.dots[3 * k + 2] = size;
}

// The bump's hue, which skips red, orange and yellow: dim, those read
// maroon, brown and olive on the panel. A hue from -0.07 to 0.3 takes the
// nearer end, crimson-pink or green, so the bump jumps between the two.
function bumpHue(h) {
  let f = h - floor(h);
  if (f >= 0.93) f -= 1;
  if (f >= 0.3) return f;
  return f < 0.11 ? 0.93 : 0.3;
}

function palette(S) {
  const c = S.col, h = S.hue, hb = bumpHue(h + 0.58);
  // 0 the bump, 1 its edge, 2 overshoot lobes, 3 short lobes, 4 the curve,
  // 5 the beads, 6 the axis, 7 the glow of the node polynomial.
  hsv(hb, 0.85, 0.3, c, 0);
  hsv(hb, 0.55, 0.8, c, 3);
  hsv(h + 0.9, 0.8, 1, c, 6);
  hsv(h + 0.13, 0.85, 1, c, 9);
  hsv(hb, 0.12, 1, c, 12);
  hsv(h + 0.13, 0.35, 1, c, 15);
  hsv(hb, 0.5, 0.16, c, 18);
  hsv(0.72, 0.6, 0.24, c, 21);
  S.colHue = h;
}

// The node polynomial (x - x_1) ... (x - x_n), the factor the error carries
// whatever the function: log10 of its size, the largest in each row, blended
// like the curve. Equally spaced, it is 54,000 times bigger at the ends than
// in the middle at 21 nodes; Chebyshev's, the same in every gap.
function omega(S) {
  const { sets, nsets, om } = S;
  let top = -1e9;
  for (let y = 0; y < H; y++) {
    let L = 0;
    for (let s = 0; s < nsets; s++) {
      const { X, n, k } = sets[s];
      if (k <= 0) continue;
      let best = -1e9;
      for (let i = 0; i < SUB; i++) {
        const x = cl(toX(y + (i + 0.5) / SUB), -1, 1);
        let p = 1;
        for (let j = 0; j < n; j++) p *= x - X[j];
        best = max(best, Math.log10(abs(p) + 1e-300));
      }
      L += k * best;
    }
    om[y] = L;
    top = max(top, L);
  }
  for (let y = 0; y < H; y++) om[y] = cl(1 + (om[y] - top) / 5, 0, 1) ** 1.5;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.colHue !== S.hue) palette(S);
  build(S);
  omega(S);
  const { sets, nsets, pc, fc, dots, ndots, om } = S, c = S.col;
  const axis = floor(C0);
  for (let y = 0; y < H; y++) {
    // The curve and the bump at four heights inside the row, so a lobe
    // that crosses the panel in one row is drawn whole.
    let pLo = 1e9, pHi = -1e9, bLo = 1e9, bHi = -1e9;
    const inside = y + 1 > YA - 0.5 && y < YB + 0.5;
    if (inside)
      for (let i = 0; i < SUB; i++) {
        const x = cl(toX(y + (i + 0.5) / SUB), -1, 1);
        let p = 0;
        for (let s = 0; s < nsets; s++) if (sets[s].k > 0) p += sets[s].k * bary(sets[s], x);
        pc[i] = col(p);
        fc[i] = col(runge(x));
        pLo = min(pLo, pc[i]);
        pHi = max(pHi, pc[i]);
        bLo = min(bLo, pc[i], fc[i]);
        bHi = max(bHi, pc[i], fc[i]);
      }
    const fRow = col(runge(cl(toX(y + 0.5), -1, 1)));
    for (let x = 0; x < W; x++) {
      const X = x + 0.5;
      let o = -1;
      if (inside) {
        if (X >= pLo - 0.9 && X <= pHi + 0.9) o = 12;
        else if (X >= bLo && X <= bHi && abs(X - fRow) > 0.6) o = X > fRow ? 6 : 9;
        else if (abs(X - fRow) < 0.75) o = 3;
        else if (X > C0 && X < fRow) o = 0;
      }
      if (o < 0 && x === axis) o = 18;
      if (o < 0) {
        // Behind everything, the node polynomial's glow.
        const g = inside ? om[y] : 0;
        display.setPixel(x, y, round(255 * c[21] * g), round(255 * c[22] * g), round(255 * c[23] * g));
      }
      else display.setPixel(x, y, round(255 * c[o]), round(255 * c[o + 1]), round(255 * c[o + 2]));
    }
  }
  // The beads, each in a dark ring so the curve threads through it.
  for (let k = 0; k < ndots; k++) {
    const bx = dots[3 * k], by = dots[3 * k + 1], sz = dots[3 * k + 2];
    if (sz <= 0.02) continue;
    const r = 1.75 * sz, ring = r + 0.9;
    for (let yy = max(0, floor(by - ring)); yy <= min(H - 1, floor(by + ring)); yy++)
      for (let xx = max(0, floor(bx - ring)); xx <= min(W - 1, floor(bx + ring)); xx++) {
        const dx = xx + 0.5 - bx, dy = yy + 0.5 - by, d = Math.sqrt(dx * dx + dy * dy);
        if (d < r) display.setPixel(xx, yy, round(255 * c[15]), round(255 * c[16]), round(255 * c[17]));
        else if (d < ring) display.setPixel(xx, yy, 0, 0, 0);
      }
  }
}
