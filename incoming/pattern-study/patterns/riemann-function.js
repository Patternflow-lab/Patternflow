// ===== Patternflow pattern =====
// Title:   Riemann's Function
// Family:  fractal
// Idea:    A pen draws Duistermaat's curve phi(t), the complex form of Riemann's non-differentiable function, as a heart of spirals across the top of the panel, and the loupe below dives into one rational point of it, where the curve turns a right angle or, at p/q with p and q both odd, runs straight through with Gerver's derivative -1/2.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Riemann's non-differentiable function (Bernhard Riemann, c. 1861, reported by Karl Weierstrass, 1872), non-differentiability at the irrationals (G. H. Hardy, 1916), differentiability at p/q with p and q odd (Joseph Gerver, 1970), the complex curve phi (J. J. Duistermaat, 1991), the corner of a polygonal vortex filament under the binormal flow (Francisco de la Hoz and Luis Vega, 2014), pattern round 62
// Round:   62
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Point=0..1, Depth=0..1
//
// Knob 1: Hue. Turns the curve's colours round the wheel; they run by the distance from t = 1, so the heart is coloured the same on both halves, as phi(2 - t) = -conj phi(t) makes it. At 0 the top centre, t = 1, is azure, the sides violet and the tip, t = 0, pink; at 0.25 violet to green, at 0.5 yellow to cyan, at 0.75 green to violet. Orange is skipped, as it reads brown when dim. In the loupe the hue also swings by 0.07 once every factor 16 in s = t - t0, bands that flow outward as the loupe dives.
// Knob 2: Speed. One lap of the pen round t in [0, 2] takes 16 / Speed seconds: 8 s at 2, 80 s at 0.2, 5.3 s at 3. The last 0.3 s of its trail burns white, the curve it has passed stays bright for about a fifth of a lap and settles to 40 percent. The loupe dives in and comes out once a lap, deepest just as the pen passes its point, which it lights up; at Speed 2 that is 2.5 s in.
// Knob 3: Point. The rational t0 the loupe dives into, boxed on the heart: 1 below 0.2, 1/2 to 0.4, 1/3 to 0.6, 0 (the tip) to 0.8, then 2/3. At 1 and 1/3, p and q both odd, the curve passes straight through, horizontal, phi'(t0) = -1/2, a bowtie of small rosettes, one every 8 s^2 in s, closing on the point; the pattern's own sums give (phi(1 + s) - phi(1)) / s = -0.300 - 0.181i, -0.410, -0.456 and -0.490 at s = 1/32, 1/128, 1/512 and 1/2048. Elsewhere it turns a right angle along c e^(i pi / 4) sqrt s and -c e^(-i pi / 4) sqrt |s|, c the mean of e^(i pi p r^2 / q) over r mod 2q: arms up and left at 1/2, where |phi(t0 + s) - phi(t0)| / sqrt s reaches 0.70711 = 1 / sqrt 2 by s = 1e-7; the V of the tip, 0.99997 at s = 7.5e-9; arms up-left and down-left at 2/3, 0.57738 against 1 / sqrt 3 = 0.57735. The dim grey lines in the loupe are these predicted tangents.
// Knob 4: Depth. How far the loupe dives, 2^(4 + 4 Depth) times the loupe's opening scale, 200 LEDs a unit: 16 times at 0, 19 at the opening 0.06, where the loupe is 1/48 of the heart's width, 64 at 0.5 and 256 at 1, 1/644 of it. At t0 = 1 the bowtie stands 14 LEDs tall at the loupe's ends at 0.5 and 8 at 1, and 2 in the middle at both.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, sqrt, cos, sin, exp, round, ceil, abs, log2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The wheel without its orange, 0.03 to 0.15, which reads brown when dim.
const wheel = (h) => 0.15 + (h - floor(h)) * 0.88;

// phi(t) = sum over n >= 1 of e^(i pi n^2 t) / (i pi n^2). The table of the
// whole period sums the first NT terms: past n = 128 a term moves the top
// view by less than 1/600 of an LED.
const NT = 128;
// The whole period t in [0, 2), G samples.
const G = 12288, HG = 2 / G;
// The rational points the loupe can dive into, p / q.
const POINTS = [[1, 1], [1, 2], [1, 3], [0, 1], [2, 3]];

// The top view: 77 LEDs a unit, phi(1) = i pi / 12 near the top.
const TS = 77, TX = 31.5, TY = 31.2;
// The loupe: rows 74 to 127, centre (31.5, 100.5), half width RHO0 / M.
const LY0 = 74, LCX = 31.5, LCY = 100.5, RHO0 = 0.16;

// Fresnel auxiliary functions f(w), g(w): the integral of e^(i pi u^2 / 2)
// from w to infinity is (g + i f) e^(i pi w^2 / 2). A power series below
// w = 3, the asymptotic series above.
const FG = [0, 0];
function fresnelFG(w) {
  if (w >= 3) {
    const x = PI * w * w, x2 = 1 / (x * x);
    FG[0] = (1 - 3 * x2 + 105 * x2 * x2 - 10395 * x2 * x2 * x2) / (PI * w);
    FG[1] = (1 - 15 * x2 + 945 * x2 * x2) / (PI * PI * w * w * w);
    return;
  }
  const a = PI / 2, w2 = w * w, w4 = w2 * w2;
  let C = 0, S = 0, tc = w, ts = a * w * w2;
  for (let n = 0; n < 32; n++) {
    C += tc / (4 * n + 1);
    S += ts / (4 * n + 3);
    tc *= (-a * a * w4) / ((2 * n + 1) * (2 * n + 2));
    ts *= (-a * a * w4) / ((2 * n + 2) * (2 * n + 3));
  }
  const th = a * w2, A = 0.5 - C, B = 0.5 - S, co = cos(th), si = sin(th);
  FG[0] = B * co - A * si;
  FG[1] = A * co + B * si;
}
// I(s), the terms past a cut at n = N summed as an integral from L = N + 1/2:
// the sum over n > N of (e^(i pi n^2 s) - 1) / (i pi n^2). Near a rational
// p/q every term there carries the same mean factor c, so c I(s) puts back
// the square-root corner the cut series would round off.
const IC = [0, 0];
function tail(s, L) {
  const as = abs(s), ph = PI * L * L * s;
  let re = sin(ph) / (PI * L), im = (1 - cos(ph)) / (PI * L);
  fresnelFG(L * sqrt(2 * as));
  const r = sqrt(2 * as), pa = PI * L * L * as, cp = cos(pa), sp = sin(pa);
  const pr = r * (FG[1] * cp - FG[0] * sp), pi = r * (FG[1] * sp + FG[0] * cp);
  if (s >= 0) (re += pr), (im += pi);
  else (re -= pr), (im += pi);
  IC[0] = re;
  IC[1] = im;
}

let GX = null, GY = null;
// The whole curve once, by turning each term's phasor a step at a time.
function curve() {
  if (GX) return;
  GX = new Float64Array(G + 1);
  GY = new Float64Array(G + 1);
  for (let n = 1; n <= NT; n++) {
    const k = PI * n * n, a = 1 / k, rc = cos(k * HG), rs = sin(k * HG);
    // 1 / (i pi n^2) = -i / (pi n^2)
    let x = 0, y = -a;
    for (let i = 0; i <= G; i++) {
      GX[i] += x;
      GY[i] += y;
      const nx = x * rc - y * rs;
      y = x * rs + y * rc;
      x = nx;
    }
  }
}

// The loupe's polyline for one point: shells about s = 0, each 4 times
// thinner than the last, from s = 1/8 down to 1/8 / 4^12 = 7.5e-9, each
// summed by turning its terms' phasors in even steps, then the rest of the
// period from the table. Near p/q with p and q odd the curve runs along its
// tangent as a train of small rosettes, one every 8 s^2 in s and 3.1 s^1.5
// across (3.29 at s = 1/32, 3.11 at 1/256, summed to 3000 terms), so there
// the shells take enough steps for each rosette as the loupe will show it:
// 800 steps from s = 1/8 to 1/32, 16 to a rosette from 1/512 to 1/2048, where
// at 256 times a rosette is up to 5 LEDs across. Inside s = 1/2048 they are
// 1.7 LEDs at most and the 1024 terms a shell sums there no longer hold them,
// so those shells take 240 steps and draw the line. A shell sums 256 terms out
// to s = 1/32 and 1024 inside it.
const S0 = 1 / 8, SHELLS = 12, QODD = [800, 800, 1300, 2600, 3100], QCORNER = [600], QMIN = 240, GROUP = 120;
const CUT = (j) => (j < 2 ? 256 : 1024);
const NS = 1024;
function loupe(S, which) {
  const [p, q] = POINTS[which], t0 = p / q;
  // c, the mean of e^(i pi p r^2 / q) over r mod 2q: zero exactly when p and
  // q are both odd.
  let cr = 0, ci = 0;
  for (let r = 0; r < 2 * q; r++) {
    const a = (PI * p * r * r) / q;
    cr += cos(a);
    ci += sin(a);
  }
  cr /= 2 * q;
  ci /= 2 * q;
  if (abs(cr) < 1e-9) cr = 0;
  if (abs(ci) < 1e-9) ci = 0;
  const odd = cr === 0 && ci === 0;
  // The terms e^(i pi n^2 t0) / (i pi n^2) = (sin - i cos) / (pi n^2).
  // For each cut N: phi at t0 cut there, and the coefficients' own part past
  // it. With B_n the partial sums of e^(i pi m^2 t0) - c, the terms past N
  // add (<B> - B_N) times one more term, <B> the mean of B over a period;
  // this keeps the slope at the point, <B> - c / 2, which comes to -1/2 at
  // every p/q with p and q odd.
  const AR = new Float64Array(NS + 1), AI = new Float64Array(NS + 1);
  let px = 0, py = 0, br = 0, bi = 0, mr = 0, mi = 0;
  const at = {};
  for (let n = 1; n <= NS; n++) {
    const k = PI * n * n, ph = (PI * ((n * n * p) % (2 * q))) / q;
    AR[n] = sin(ph) / k;
    AI[n] = -cos(ph) / k;
    px += AR[n];
    py += AI[n];
    br += cos(ph) - cr;
    bi += sin(ph) - ci;
    if (n <= 2 * q) (mr += br / (2 * q)), (mi += bi / (2 * q));
    if (n === NT || n === 256 || n === NS) at[n] = [px, py, br, bi];
  }
  const cut = {};
  for (const N of [NT, 256, NS]) {
    const [x, y, b1, b2] = at[N];
    cut[N] = [N + 0.5, mr - b1, mi - b2, x, y];
  }
  const xs = [], ys = [], ss = [];
  const put = (s, x, y, N) => {
    const [L, kr, ki, ox, oy] = cut[N];
    tail(s, L);
    // K (e^(i pi L^2 s) - 1) / (i pi L^2)
    const ph = PI * L * L * s, fr = sin(ph) / (PI * L * L), fi = (1 - cos(ph)) / (PI * L * L);
    xs.push(x - ox + cr * IC[0] - ci * IC[1] + kr * fr - ki * fi);
    ys.push(y - oy + cr * IC[1] + ci * IC[0] + kr * fi + ki * fr);
    ss.push(s);
  };
  // Each term's phasor and its turn for one step, side by side.
  const WT = new Float64Array(4 * (NS + 1));
  const shell = (sa, sb, Q, N) => {
    // sa to sb in Q steps, the end sb left out.
    const h = (sb - sa) / Q;
    for (let n = 1, o = 4; n <= N; n++, o += 4) {
      const k = PI * n * n, c0 = cos(k * sa), s0 = sin(k * sa);
      WT[o] = AR[n] * c0 - AI[n] * s0;
      WT[o + 1] = AR[n] * s0 + AI[n] * c0;
      WT[o + 2] = cos(k * h);
      WT[o + 3] = sin(k * h);
    }
    const end = 4 * N + 4;
    for (let i = 0; i < Q; i++) {
      let x = 0, y = 0;
      for (let o = 4; o < end; o += 4) {
        const wr = WT[o], wi = WT[o + 1], rc = WT[o + 2], rs = WT[o + 3];
        x += wr;
        y += wi;
        WT[o] = wr * rc - wi * rs;
        WT[o + 1] = wr * rs + wi * rc;
      }
      put(sa + i * h, x, y, N);
    }
  };
  const QS = (j) => (odd ? QODD[j] : QCORNER[j]) || QMIN;
  // At t0 = 0 and 1 the curve is its own mirror about the point,
  // z(-s) = -conj z(s), from phi(2 - t) = -conj phi(t); one side is enough.
  if (q === 1) {
    for (let j = SHELLS - 1; j >= 0; j--) shell(S0 / 4 ** (j + 1), S0 / 4 ** j, QS(j), CUT(j));
    const m = xs.length;
    for (let i = m - 1; i >= 0; i--) xs.push(-xs[i]), ys.push(ys[i]), ss.push(-ss[i]);
    // The mirrored half runs from -S0 in to -S0 / 4^12: move it to the front
    // so the line runs -S0 .. 0 .. S0.
    const nx = xs.splice(m), ny = ys.splice(m), ns = ss.splice(m);
    xs.unshift(...nx, 0);
    ys.unshift(...ny, 0);
    ss.unshift(...ns, 0);
  } else {
    for (let j = 0; j < SHELLS; j++) shell(-S0 / 4 ** j, -S0 / 4 ** (j + 1), QS(j), CUT(j));
    xs.push(0), ys.push(0), ss.push(0);
    for (let j = SHELLS - 1; j >= 0; j--) shell(S0 / 4 ** (j + 1), S0 / 4 ** j, QS(j), CUT(j));
  }
  // The rest of the period from the table, from t0 + S0 round to t0 - S0.
  const i0 = ceil((t0 + S0) / HG - 1e-9), i1 = floor((t0 + 2 - S0) / HG + 1e-9);
  for (let i = i0; i <= i1; i++) {
    const g = ((i % G) + G) % G;
    let s = i * HG - t0;
    s -= 2 * floor((s + 1) / 2);
    put(s, GX[g], GY[g], NT);
  }
  // Keep a sample only once the curve has moved a quarter of an LED from the
  // last one kept, as the loupe shows it when that sample is at its edge:
  // 1/180 of the distance to phi(t0), and no less than 1/200 of an LED at
  // 256 times.
  const n0 = xs.length, kx = [], ky = [], ks = [], gs = [];
  let lx = 1e9, ly = 1e9;
  for (let i = 0; i < n0; i++) {
    const x = xs[i], y = ys[i], r = sqrt(x * x + y * y), d = sqrt((x - lx) ** 2 + (y - ly) ** 2);
    if (ss[i] !== 0 && d < max(r / 180, 1e-7) && i < n0 - 1) continue;
    if (kx.length % GROUP === 0) gs.push(kx.length);
    kx.push(x), ky.push(y), ks.push(ss[i]);
    (lx = x), (ly = y);
  }
  const n = kx.length, ng = gs.length;
  gs.push(n);
  const box = new Float64Array(ng * 5);
  for (let g = 0; g < ng; g++) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, len = 0;
    for (let i = gs[g]; i <= gs[g + 1]; i++) {
      const k = i % n, x = kx[k], y = ky[k];
      x0 = min(x0, x);
      x1 = max(x1, x);
      y0 = min(y0, y);
      y1 = max(y1, y);
      if (i > gs[g]) len += sqrt((x - kx[(i - 1) % n]) ** 2 + (y - ky[(i - 1) % n]) ** 2);
    }
    box.set([x0, x1, y0, y1, len], g * 5);
  }
  S.lx = Float64Array.from(kx);
  S.ly = Float64Array.from(ky);
  S.ls = Float64Array.from(ks);
  S.lg = Int32Array.from(gs);
  S.lbox = box;
  S.t0 = t0;
  S.c = [cr, ci];
  S.which = which;
  S.lcol = null;
}

// Top view splats: for each LED a line of the curve crosses, how much line
// from which stretch of t, NB stretches to the period. Built once.
const NB = 1024, PB = G / NB;
let TE = null;
function topSplats() {
  if (TE) return;
  const P = [], Wt = [], I = [], acc = new Float32Array(NP), seen = [];
  const touch = (a, b, v) => {
    if (a < 0 || a >= W || b < 0 || b >= LY0 - 2 || v <= 0) return;
    const p = b * W + a;
    if (acc[p] === 0) seen.push(p);
    acc[p] += v;
  };
  for (let bk = 0; bk < NB; bk++) {
    for (let i = bk * PB; i < (bk + 1) * PB; i++) {
      const x0 = TX + GX[i] * TS, y0 = TY - GY[i] * TS, x1 = TX + GX[i + 1] * TS, y1 = TY - GY[i + 1] * TS;
      const len = sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2), n = max(1, ceil(len * 2)), w = len / n;
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
        const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
        touch(ix, iy, (1 - fx) * (1 - fy) * w);
        touch(ix + 1, iy, fx * (1 - fy) * w);
        touch(ix, iy + 1, (1 - fx) * fy * w);
        touch(ix + 1, iy + 1, fx * fy * w);
      }
    }
    for (const p of seen) P.push(p), Wt.push(acc[p]), I.push(bk), (acc[p] = 0);
    seen.length = 0;
  }
  TE = { p: Int32Array.from(P), w: Float32Array.from(Wt), i: Int32Array.from(I) };
}

export function setup(params) {
  params.s = null;
}

function init(params) {
  curve();
  topSplats();
  const S = {
    clock: 0, hue: -1, which: -1,
    bcol: new Float32Array(NB * 3), bb: new Float32Array(NB), bw: new Float32Array(NB),
    R: new Float32Array(NP), Gc: new Float32Array(NP), B: new Float32Array(NP), D: new Float32Array(NP),
  };
  params.s = S;
  return S;
}

// Azure at t = 1, the top, to pink at t = 0 and 2, the tip: mirror-symmetric
// like the curve, phi(2 - t) = -conj phi(t).
const hueAt = (S, t, band = 0) => wheel(0.5 + S.hue + 0.42 * abs(1 - t) + band);

export function update(dt, input, params) {
  const S = params.s || init(params);
  const k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.speed = cl(k[1], 0.2, 3);
  const which = min(POINTS.length - 1, floor(cl(k[2], 0, 1) * POINTS.length));
  if (which !== S.which) loupe(S, which);
  S.depth = 4 + 4 * cl(k[3], 0, 1);
  if (k[0] !== S.hue) {
    S.hue = k[0];
    for (let b = 0; b < NB; b++) hsv(hueAt(S, (b + 0.5) * PB * HG), 0.72, 1, S.bcol, b * 3);
    S.lcol = null;
  }
  S.clock += d;
}

function add(S, x, y, v, r, g, b) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  put(S, ix, iy, (1 - fx) * (1 - fy) * v, r, g, b);
  put(S, ix + 1, iy, fx * (1 - fy) * v, r, g, b);
  put(S, ix, iy + 1, (1 - fx) * fy * v, r, g, b);
  put(S, ix + 1, iy + 1, fx * fy * v, r, g, b);
}
function put(S, x, y, v, r, g, b) {
  if (x < 0 || x >= W || y < LY0 || y >= H) return;
  const p = y * W + x;
  S.R[p] += v * r;
  S.Gc[p] += v * g;
  S.B[p] += v * b;
  S.D[p] += v;
}
// Light straight into the frame, after the tone curve: a bilinear dot, and
// a thin line of them kept to rows `top` and below.
function dot(S, x, y, v, top = 0) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  lit(S, ix, iy, (1 - fx) * (1 - fy) * v, top);
  lit(S, ix + 1, iy, fx * (1 - fy) * v, top);
  lit(S, ix, iy + 1, (1 - fx) * fy * v, top);
  lit(S, ix + 1, iy + 1, fx * fy * v, top);
}
function lit(S, a, b, v, top) {
  if (a < 0 || a >= W || b < top || b >= H) return;
  const p = b * W + a;
  S.R[p] += v;
  S.Gc[p] += v;
  S.B[p] += v;
}
function glow(S, x0, y0, x1, y1, v, top) {
  const len = sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2), n = max(1, ceil(len * 1.5)), w = (v * len) / (n + 1);
  for (let k = 0; k <= n; k++) dot(S, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, w, top);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { R, Gc, B, D, bcol, bb, bw } = S;
  R.fill(0);
  Gc.fill(0);
  B.fill(0);
  D.fill(0);
  // One lap of the pen takes 16 / Speed seconds; at Speed 2 it reaches the
  // loupe's point 2.5 s in, as deep as the loupe goes.
  const T = 16 / S.speed, lap = S.clock / T + S.t0 / 2 - 2.5 / 8;
  const tp = 2 * (lap - floor(lap));
  const base = 0.4, tau = T / 5;
  const age = (t) => {
    let a = tp - t;
    a -= 2 * floor(a / 2);
    return (a * T) / 2;
  };
  for (let b = 0; b < NB; b++) bb[b] = base + (1 - base) * exp(-age((b + 0.5) * PB * HG) / tau);
  // The top view.
  const { p: EP, w: EW, i: EI } = TE;
  // The last third of a second behind the pen burns white.
  for (let b = 0; b < NB; b++) bw[b] = exp(-age((b + 0.5) * PB * HG) / 0.3);
  for (let e = 0; e < EP.length; e++) {
    const p = EP[e], b = EI[e], w = EW[e], v = w * bb[b], h = bw[b];
    R[p] += v * (bcol[b * 3] + (1 - bcol[b * 3]) * h);
    Gc[p] += v * (bcol[b * 3 + 1] + (1 - bcol[b * 3 + 1]) * h);
    B[p] += v * (bcol[b * 3 + 2] + (1 - bcol[b * 3 + 2]) * h);
    D[p] += w;
  }

  // The dive: magnification 2^(depth w), deepest when the pen is at t0.
  let ph = lap - S.t0 / 2;
  ph -= floor(ph);
  const wv = (1 + cos(2 * PI * ph)) / 2, M = 2 ** (S.depth * wv);
  const kz = (32 * M) / RHO0;
  const { lx, ly, ls, lg, lbox } = S, n = lx.length, ng = lg.length - 1;
  if (!S.lcol) {
    S.lcol = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let t = S.t0 + ls[i];
      t -= 2 * floor(t / 2);
      // Bands of scale: the hue swings once every factor 16 in |s|.
      const band = ls[i] === 0 ? 0 : 0.07 * cos((PI * log2(abs(ls[i]))) / 2);
      hsv(hueAt(S, t, band), 0.72, 1, S.lcol, i * 3);
    }
  }
  const lc = S.lcol;
  // The loupe lights up as the pen passes its point.
  const lb = 0.65 + 0.35 * exp(-age(S.t0) / tau);
  const xmin = -1, xmax = W + 1, ymin = LY0 - 1, ymax = H + 1;
  for (let g = 0; g < ng; g++) {
    const o = g * 5;
    if (LCX + lbox[o + 1] * kz < xmin || LCX + lbox[o] * kz > xmax || LCY - lbox[o + 2] * kz < ymin || LCY - lbox[o + 3] * kz > ymax) continue;
    const a = lg[g], e = lg[g + 1], gap = (lbox[o + 4] * kz) / (e - a);
    const step = gap >= 0.5 ? 1 : min(64, floor(0.5 / gap));
    for (let i = a; i < e; i += step) {
      const j = min(i + step, e) % n;
      let x0 = LCX + lx[i] * kz, y0 = LCY - ly[i] * kz, x1 = LCX + lx[j] * kz, y1 = LCY - ly[j] * kz;
      if ((x0 < xmin && x1 < xmin) || (x0 > xmax && x1 > xmax) || (y0 < ymin && y1 < ymin) || (y0 > ymax && y1 > ymax)) continue;
      let dx = x1 - x0, dy = y1 - y0, len = sqrt(dx * dx + dy * dy);
      if (len > 40) {
        // Clip a long segment to the loupe (Liang-Barsky).
        let u0 = 0, u1 = 1, ok = true;
        const P4 = [-dx, dx, -dy, dy], Q4 = [x0 - xmin, xmax - x0, y0 - ymin, ymax - y0];
        for (let c = 0; c < 4 && ok; c++) {
          const pp = P4[c], qq = Q4[c];
          if (pp === 0) ok = qq >= 0;
          else {
            const r = qq / pp;
            if (pp < 0) r > u1 ? (ok = false) : r > u0 && (u0 = r);
            else r < u0 ? (ok = false) : r < u1 && (u1 = r);
          }
        }
        if (!ok) continue;
        const ax = x0 + dx * u0, ay = y0 + dy * u0;
        x1 = x0 + dx * u1;
        y1 = y0 + dy * u1;
        x0 = ax;
        y0 = ay;
        dx = x1 - x0;
        dy = y1 - y0;
        len = sqrt(dx * dx + dy * dy);
      }
      const m = max(1, ceil(len)), w = len / m;
      const r = lc[i * 3] * lb, gg = lc[i * 3 + 1] * lb, b = lc[i * 3 + 2] * lb;
      for (let k = 0; k < m; k++) {
        const u = (k + 0.5) / m;
        add(S, x0 + dx * u, y0 + dy * u, w, r, gg, b);
      }
    }
  }

  // Tone: the average colour times min(1, D)^0.6.
  for (let p = 0; p < NP; p++) {
    const dd = D[p];
    if (dd > 0) {
      const f = min(1, dd) ** 0.6 / dd;
      R[p] *= f;
      Gc[p] *= f;
      B[p] *= f;
    }
  }

  // Guides in the loupe: Gerver's tangent, or the corner's two arms along
  // c e^(i pi/4) and -c e^(-i pi/4).
  const [cr, ci] = S.c, gv = 0.18;
  if (cr === 0 && ci === 0) glow(S, 0, LCY, W - 1, LCY, gv, LY0);
  else {
    const m = sqrt(cr * cr + ci * ci), e = 80;
    for (const [ar, ai] of [[(cr - ci) / sqrt(2), (cr + ci) / sqrt(2)], [-(cr + ci) / sqrt(2), (cr - ci) / sqrt(2)]])
      glow(S, LCX, LCY, LCX + (ar / m) * e, LCY - (ai / m) * e, gv, LY0);
  }
  // The loupe's window on the top view, and its point.
  const g0 = round(S.t0 / HG) % G, cx = TX + GX[g0] * TS, cy = TY - GY[g0] * TS;
  const wx = (RHO0 / M) * TS, wy = wx * (27 / 32);
  if (wx >= 1.5) {
    const v = 0.45;
    glow(S, cx - wx, cy - wy, cx + wx, cy - wy, v, 0);
    glow(S, cx - wx, cy + wy, cx + wx, cy + wy, v, 0);
    glow(S, cx - wx, cy - wy, cx - wx, cy + wy, v, 0);
    glow(S, cx + wx, cy - wy, cx + wx, cy + wy, v, 0);
  }
  dot(S, cx, cy, 0.8);
  // The pen.
  {
    const f = tp / HG, i = min(G - 1, floor(f)), u = f - i;
    const x = TX + (GX[i] + (GX[i + 1] - GX[i]) * u) * TS, y = TY - (GY[i] + (GY[i + 1] - GY[i]) * u) * TS;
    dot(S, x, y, 2.5);
    for (const [ox, oy] of [[-1.2, 0], [1.2, 0], [0, -1.2], [0, 1.2]]) dot(S, x + ox, y + oy, 0.45);
  }
  // The loupe's top edge.
  for (let x = 0; x < W; x += 2) dot(S, x, LY0 - 2, 0.22);

  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++)
      display.setPixel(x, y, round(min(1, R[p]) * 255), round(min(1, Gc[p]) * 255), round(min(1, B[p]) * 255));
}
