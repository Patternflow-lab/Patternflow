// ===== Patternflow pattern =====
// Title:   Giant Component
// Family:  data
// Idea:    Random edges join the dots of a 21 by 32 grid one at a time, every component wearing a colour of its own and the largest one cream, and just after the edges pass half the number of dots the cream giant component floods the panel, while a plot underneath draws its share against the edges added over the curve Erdős and Rényi's theory gives.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: random graph phase transition (Paul Erdős and Alfréd Rényi, 1959 and 1960), explosive percolation (Dimitris Achlioptas, Raissa D'Souza and Joel Spencer, 2009), pattern round 60
// Round:   60
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Size=-1..1, Choice=0..1
//
// Knob 1: Hue. Turns the components' colours round the wheel; a vertex alone stays a dim slate dot and the largest component stays cream. At 0 the components take hues from azure through blue and violet to pink, at 0.25 from violet through red to lime, at 0.5 from rose through lime and green to cyan, at 0.75 from green through cyan and blue to violet; orange and dark yellow are skipped, as they read brown. The plot's dim lines turn with them, blue at 0.
// Knob 2: Speed. Edges added a second, 0.064 x Speed x n: at 2 the first graph opens with 0.2 n edges already in, passes the threshold n / 2 at 2.3 s and reaches 1.28 n, where the plot ends, at 8.4 s; it holds 2 s and a fresh graph starts from no edges, every 12 s. At 0.2 ten times slower, at 3 one and a half times faster. Each new edge is drawn as a line for 0.25 s at Speed 2, faint when it only brings in a vertex that was alone, brighter the larger the smaller of the two components it joins.
// Knob 3: Size. The grid, rounded: at -1 16 x 24 = 384 vertices as 3 x 3 LED dots 4 LEDs apart, at the opening 0 21 x 32 = 672 as 2 x 2 dots 3 apart, at 1 32 x 48 = 1536 single LEDs 2 apart. The larger the graph, the sharper the turn: over 200 graphs each, the largest component held 11.9, 10.4 and 8.0 percent of the vertices at n / 2 edges, falling as n^(-1/3), and at 0.75 n edges 57.5, 57.8 and 58.2 percent against the 58.3 of theory. A new value starts a fresh graph.
// Knob 4: Choice. The chance that an edge is chosen by the product rule of Achlioptas, D'Souza and Spencer: two candidates are drawn and the one whose two components have the smaller product of sizes is kept. It opens at 0.06, almost the plain random graph. At 1 the components stay small and many past n / 2, the giant waits until 0.83 n edges and then grows from a tenth of the vertices to seven tenths in 0.07 n more, 0.5 s at Speed 2, where the plain graph takes 0.35 n and 2.75 s, and the plot rises as a cliff. Over 200 graphs of 672 vertices the edges it took the largest component to grow from the square root of n to n / 2 were 0.30 n with no choice and 0.16 n with it, and for 200000 vertices, off the panel, 0.23 n and 0.022 n: the jump grows sharper without end, explosive percolation.
// Buttons: K1 tap starts a fresh graph from no edges.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, exp, log2, round, random, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The vertex grids: spacing, columns, rows, dot size, left margin. Each
// stands 95 rows tall over the top of the panel, one dark LED between dots.
const GRIDS = [[4, 16, 24, 3, 0], [3, 21, 32, 2, 1], [2, 32, 48, 1, 0]];
const NMAX = 32 * 48;
// The plot below them: edges added across, 0 to TMAX n over its 64
// columns, the largest component's share up, 0 on row PY0 and 1 PH rows
// higher.
const PY0 = 126, PH = 25, PC = 64, TMAX = 1.28;
const RATE = 0.064, T0 = 0.2, HOLD = 2, FADE = 0.6, LIFE = 0.25, NL = 3;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// Orange and yellow read brown and olive on an LED unless they are bright,
// so the components take their hues from a wheel without 0.03 to 0.17, and
// the dim lines of the plot from one that runs only from green to rose.
const wheel = (h) => 0.17 + 0.86 * (h - floor(h));
const dimWheel = (h) => 0.3 + 0.7 * (h - floor(h));

// The share of vertices in the giant component of G(n, m) as n grows,
// m = t n: the root theta of theta = 1 - exp(-2 t theta), zero up to t = 1/2.
const THEORY = new Float32Array(PC);
for (let c = 0; c < PC; c++) {
  const k = (2 * (c + 0.5) * TMAX) / PC;
  let th = 1;
  for (let i = 0; i < 400; i++) th = 1 - exp(-k * th);
  THEORY[c] = k <= 1 ? 0 : th;
}

export function setup(params) {
  params.s = {
    par: new Int32Array(NMAX), sz: new Int32Array(NMAX), hu: new Float32Array(NMAX),
    share: new Float32Array(PC), lines: new Int32Array(NL * 3), age: new Float32Array(NL).fill(9), nl: 0,
    rgb: new Float32Array(NP * 3), old: new Float32Array(NP * 3), c: new Float32Array(3),
    n: 0, grid: 1, t: 0, m: 0, big: 1, bigRoot: 0, hold: 0, fade: 0, started: false,
    hue: 0, speed: 2, size: 1, choice: 0.06,
  };
}

// Union-find, with path halving and union by size.
function find(par, a) {
  while (par[a] !== a) a = par[a] = par[par[a]];
  return a;
}

function fresh(S) {
  const g = GRIDS[S.size];
  S.grid = S.size;
  S.n = g[1] * g[2];
  for (let v = 0; v < S.n; v++) (S.par[v] = v), (S.sz[v] = 1), (S.hu[v] = random());
  S.share.fill(-1);
  S.t = S.m = S.hold = S.nl = 0;
  S.big = 1;
  S.bigRoot = 0;
  S.age.fill(9);
}

// One edge. With probability Choice two candidate edges are drawn and the
// one whose two components have the smaller product of sizes is kept, the
// product rule of Achlioptas, D'Souza and Spencer; otherwise one edge,
// uniformly at random, as in G(n, m). The line it leaves remembers the
// smaller of the two components it joined, 0 for an edge inside one.
function addEdge(S) {
  const { par, sz } = S, n = S.n;
  let a = floor(random() * n), b = floor(random() * (n - 1));
  if (b >= a) b++;
  if (random() < S.choice) {
    let c = floor(random() * n), d = floor(random() * (n - 1));
    if (d >= c) d++;
    if (sz[find(par, c)] * sz[find(par, d)] < sz[find(par, a)] * sz[find(par, b)]) (a = c), (b = d);
  }
  let ra = find(par, a), rb = find(par, b), small = 0;
  if (ra !== rb) {
    if (sz[ra] < sz[rb]) {
      const t = ra;
      ra = rb;
      rb = t;
    }
    small = sz[rb];
    par[rb] = ra;
    sz[ra] += small;
    if (sz[ra] >= S.big) (S.big = sz[ra]), (S.bigRoot = ra);
  }
  const k = S.nl++ % NL;
  S.lines[k * 3] = a;
  S.lines[k * 3 + 1] = b;
  S.lines[k * 3 + 2] = small;
  S.age[k] = 0;
  S.m++;
}

// Edges up to t n, the largest share noted in the column t falls in.
function grow(S, t) {
  S.t = min(TMAX, t);
  const target = floor(S.t * S.n);
  while (S.m < target) {
    addEdge(S);
    S.share[min(PC - 1, floor((S.m / S.n / TMAX) * PC))] = S.big / S.n;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.size = cl(round(k[2]), -1, 1) + 1;
  S.choice = cl(k[3], 0, 1);
  // The first graph opens with T0 n edges already in, so the threshold
  // comes 2.3 s in at Speed 2; the later ones start from no edges.
  if (!S.started) {
    fresh(S);
    grow(S, T0);
    S.started = true;
  }
  if (S.hold > HOLD || S.size !== S.grid || (input.btnPressed && input.btnPressed[0])) {
    S.old.set(S.rgb);
    S.fade = 1;
    fresh(S);
  }
  const h = d * (S.speed / 2);
  S.fade = max(0, S.fade - d / FADE);
  for (let i = 0; i < NL; i++) S.age[i] += h;
  if (S.t < TMAX) grow(S, S.t + 2 * h * RATE);
  else S.hold += h;
}

function add(rgb, x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  rgb[o] += r;
  rgb[o + 1] += g;
  rgb[o + 2] += b;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, old, par, sz, hu, c } = S, g = GRIDS[S.grid], sp = g[0], nc = g[1], dot = g[3], ox = g[4], fd = S.fade, h = S.hue;
  rgb.fill(0);
  const cx = (v) => (v % nc) * sp + ox, cy = (v) => floor(v / nc) * sp;
  // The vertices: the largest component cream, a vertex alone a dim slate
  // dot, every other component a colour of its own that it keeps through
  // each merge it wins, brighter as it grows.
  const lift = dot === 1 ? 1.15 : 1;
  for (let v = 0; v < S.n; v++) {
    const r = find(par, v), s = sz[r];
    if (r === S.bigRoot && s > 1) hsv(h + 0.12, 0.12, 1, c, 0);
    else if (s === 1) hsv(0.62, 0.4, 0.2 * lift, c, 0);
    else hsv(wheel(h + 0.4 + 0.5 * hu[r]), 0.8, min(1, (0.6 + 0.3 * min(1, log2(s) / 5)) * lift), c, 0);
    const x0 = cx(v), y0 = cy(v), R = c[0] * 255, G = c[1] * 255, B = c[2] * 255;
    for (let yy = 0; yy < dot; yy++) for (let xx = 0; xx < dot; xx++) add(rgb, x0 + xx, y0 + yy, R, G, B);
  }
  // The newest edges, as lines between the centres of their dots: faint
  // when they only bring in a vertex that was alone or close a cycle,
  // bright when they join two components of some size.
  const half = (dot - 1) / 2;
  for (let i = 0; i < NL; i++) {
    if (S.age[i] >= LIFE) continue;
    const a = S.lines[i * 3], b = S.lines[i * 3 + 1], small = S.lines[i * 3 + 2];
    const w = (small ? 80 + 130 * min(1, log2(small) / 4) : 50) * (1 - S.age[i] / LIFE);
    const ax = cx(a) + half, ay = cy(a) + half, bx = cx(b) + half, by = cy(b) + half;
    const steps = max(1, round(max(abs(bx - ax), abs(by - ay))));
    for (let j = 0; j <= steps; j++) {
      const u = j / steps;
      add(rgb, round(ax + (bx - ax) * u), round(ay + (by - ay) * u), w, w, w);
    }
  }
  // The plot: the threshold n / 2 dashed, the share the theory gives as n
  // grows dim behind, and the share measured so far, with the ground under
  // it tinted and its newest point brightest.
  hsv(dimWheel(h + 0.5), 0.6, 0.45, c, 0);
  const tc = floor((0.5 / TMAX) * PC), TR = c[0] * 255, TG = c[1] * 255, TB = c[2] * 255;
  for (let y = PY0 - PH; y <= PY0; y += 2) add(rgb, tc, y, TR, TG, TB);
  let last = -1;
  for (let x = 0; x < PC; x++) {
    add(rgb, x, PY0 + 1, 28, 28, 30);
    add(rgb, x, round(PY0 - THEORY[x] * PH), TR * 0.85, TG * 0.85, TB * 0.85);
    if (S.share[x] >= 0) last = x;
  }
  hsv(h + 0.12, 0.12, 1, c, 0);
  for (let x = 0; x <= last; x++) {
    const s = S.share[x] >= 0 ? S.share[x] : 0, y1 = round(PY0 - s * PH), w = x === last ? 255 : 190;
    for (let y = y1 + 1; y <= PY0; y++) add(rgb, x, y, c[0] * 44, c[1] * 44, c[2] * 44);
    add(rgb, x, y1, c[0] * w, c[1] * w, c[2] * w);
  }
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) {
      let r = min(255, rgb[p]), gg = min(255, rgb[p + 1]), b = min(255, rgb[p + 2]);
      if (fd > 0) (r = r * (1 - fd) + old[p] * fd), (gg = gg * (1 - fd) + old[p + 1] * fd), (b = b * (1 - fd) + old[p + 2] * fd);
      (rgb[p] = r), (rgb[p + 1] = gg), (rgb[p + 2] = b);
      display.setPixel(x, y, r, gg, b);
    }
}
