// ===== Patternflow pattern =====
// Title:   Nelder-Mead
// Family:  algo
// Idea:    Five triangles walk downhill at once over the terraced contour map of a function of two variables by Nelder and Mead's simplex method, each reflection, expansion, outside or inside contraction or shrink sliding its corners over a fraction of a second in that move's colour and leaving a fading outline behind, so the trail shows a triangle doubling out of its start, stretching thin to crawl along Rosenbrock's banana valley and collapsing onto the minimum, where its count of moves is written before it starts again somewhere else, while a bar at the foot keeps the share of each move type; on McKinnon's function one of the five always starts on McKinnon's own triangle and shrinks onto a point that is not the minimum.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the downhill simplex method (John Nelder and Roger Mead, A simplex method for function minimization, 1965) after the regular simplex search (William Spendley, George Hext and Francis Himsworth, 1962), in the form with coefficients 1, 2, 1/2, 1/2 of Jeffrey Lagarias, James Reeds, Margaret Wright and Paul Wright (1998); test functions of Howard Rosenbrock (1960), David Himmelblau (1972) and Ken McKinnon (1998); pattern round 103
// Round:   103
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Function=0..2, Size=0..1
//
// Knob 1: Hue. Turns the five move colours round the wheel. At 0 a reflection is azure, an expansion green, an outside contraction gold, an inside contraction magenta and a shrink near white, over a blue map; at 0.5 the reflection is orange and the expansion purple. The map swings with the knob between pink at 0.25 and green at 0.75 and never goes round to the brown of a dim orange.
// Knob 2: Speed. At 2 a move that carries a corner 10 LEDs or more takes 0.32 s and one under a tenth of an LED 0.05 s, so eight walks in ten on Rosenbrock's valley, 72 moves on average, take 5 to 13 s, and on Himmelblau's 3 to 5 s, and a finished walk holds its count for 1.4 s before it fades in 0.5 s; everything goes as Speed / 2, ten times slower at 0.2.
// Knob 3: Function. Three landscapes: 0 Rosenbrock's banana valley (1 - x)^2 + 100 (y - x^2)^2 on x from -2 to 2 and y from -1.5 to 6.5, minimum at (1, 1), row 88, column 48; 1 Himmelblau's (x^2 + y - 11)^2 + (x + y^2 - 7)^2 on x and y from -5 to 5, stretched twice as tall, with its four minima marked; 2 McKinnon's function with tau 2, theta 6 and phi 60 on x from -0.85 to 1.15 and y from -1.6 to 2.4, where the first triangle starts on McKinnon's vertices (0, 0), (1, 1) and ((1 + sqrt 33) / 8, (1 - sqrt 33) / 8), makes 48 inside contractions and stops on the origin, its ring and count in magenta, 16 LEDs above the true minimum at (0, -1/2) that the other four reach.
// Knob 4: Size. The edge of each starting triangle, an equilateral one turned at random: 3 x 10^Size LEDs, 3.4 at the opening 0.06, where the first move on Rosenbrock is an expansion, doubling the triangle's area, in about 82 walks out of 100; 9.5 LEDs at 0.5; 30 at 1, where the first move is an expansion in 19 walks and a contraction or shrink in 47, and expansions fall from 18 to 12 percent of all moves on Rosenbrock and from 10 to 1 percent on Himmelblau.

// The method keeps three points, a triangle, on a function f of two
// variables. Each move sorts the corners best b, good g and worst w, takes
// the centroid c = (b + g) / 2 of the two that stay and tries the reflection
// r = c + (c - w). The rules here are those Lagarias, Reeds, Wright and
// Wright (1998) give with the standard coefficients 1, 2, 1/2 and 1/2:
//
//   f(r) < f(b):          try e = c + 2 (c - w); keep e if f(e) < f(r), else r.
//   f(b) <= f(r) < f(g):  keep r.
//   f(g) <= f(r) < f(w):  outside contraction o = c + (r - c) / 2, kept if f(o) <= f(r).
//   f(r) >= f(w):         inside contraction i = c + (w - c) / 2, kept if f(i) < f(w).
//   otherwise shrink:     g and w go halfway to b.
//
// Every point it makes is an affine combination of the corners, so the
// method commutes with any affine change of coordinates: run on f(A p + q)
// it makes the same moves, in the same order, at the images of the same
// points. The walks here run in LED coordinates, and Himmelblau's square
// domain is drawn twice as tall as it is wide without changing a single
// move. setup() runs one walk both ways and checks the move sequences agree.
//
// McKinnon (1998) built a convex function on which the method fails. With
// lambda1,2 = (1 +- sqrt 33) / 8, the roots of 4 l^2 - l - 2 = 0, and the
// start (0, 0), (1, 1), (lambda1, lambda2), every move is an inside
// contraction that replaces the worst corner by (lambda1^k, lambda2^k), so
// the best corner never moves off the origin and the triangle shrinks onto
// it by 0.843 a move, though the gradient there is (0, 1). setup() checks
// thirty moves of that against the closed form. In doubles in LED
// coordinates all 48 moves down to a triangle a hundredth of an LED
// across, where a walk here counts as done, are inside contractions; the
// first other move would come at the 111th, at 4e-8 LEDs.
//
// Walks end when the triangle is under a hundredth of an LED across. In
// 3,000 s at the opening knobs, 1,439 walks on Rosenbrock took 33 to 130
// moves, 72 on average, of which 33 percent were reflections, 18
// expansions, 9 outside and 41 inside contractions and none a shrink; 2,571
// walks on Himmelblau took 23 to 76 moves, 31 on average, 58 percent of
// them inside contractions, and every one ended on one of the four minima.
// On McKinnon's function every walk from a random start ended on (0, -1/2)
// and McKinnon's own start, 490 times over, on the origin.

const W = 64, H = 128, NW = 5, TRAIL = 30, BAR = 125;
const { floor, round, min, max, abs, sqrt, cos, sin, log10, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const L1 = (1 + sqrt(33)) / 8, L2 = (1 - sqrt(33)) / 8;

// Each landscape: f(x, y), the window [x0, x1] by [y0, y1] (y up), its least
// value lo, the level lo + base where the filled valley begins, and its
// minima. McKinnon's base puts a band edge on f = 0, the level through the
// origin.
const FNS = [
  { f: (x, y) => (1 - x) ** 2 + 100 * (y - x * x) ** 2, x0: -2, x1: 2, y0: -1.5, y1: 6.5, lo: 0, base: 100, mins: [[1, 1]] },
  {
    f: (x, y) => (x * x + y - 11) ** 2 + (x + y * y - 7) ** 2, x0: -5, x1: 5, y0: -5, y1: 5, lo: 0, base: 100,
    mins: [[3, 2], [-2.805118, 3.131312], [-3.77931, -3.283186], [3.584428, -1.848127]],
  },
  { f: (x, y) => (x <= 0 ? 360 * x * x : 6 * x * x) + y + y * y, x0: -0.85, x1: 1.15, y0: -1.6, y1: 2.4, lo: -0.25, base: 2.5 * sqrt(10), mins: [[0, -0.5]] },
];
const toX = (F, px) => F.x0 + (px / W) * (F.x1 - F.x0);
const toY = (F, py) => F.y1 - (py / H) * (F.y1 - F.y0);
const toPx = (F, x) => ((x - F.x0) / (F.x1 - F.x0)) * W;
const toPy = (F, y) => ((F.y1 - y) / (F.y1 - F.y0)) * H;

// Move types: reflection, expansion, outside and inside contraction, shrink.
const R = 0, E = 1, O = 2, I = 3, S = 4;
const MOVE_HUE = [0.57, 0.35, 0.14, 0.85, 0.6], MOVE_SAT = [0.85, 0.8, 0.8, 0.7, 0.12];

const DIG = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"];

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// One move on corners P = [[x, y, f] x 3] by the function g; returns the
// type, the trial reflection, and leaves P sorted with the new corner(s).
function nmStep(g, P) {
  P.sort((a, b) => a[2] - b[2]);
  const b = P[0], gd = P[1], w = P[2];
  const cx = (b[0] + gd[0]) / 2, cy = (b[1] + gd[1]) / 2;
  const at = (t) => { const x = cx + t * (cx - w[0]), y = cy + t * (cy - w[1]); return [x, y, g(x, y)]; };
  const r = at(1);
  let type = -1;
  if (r[2] < b[2]) { const e = at(2); if (e[2] < r[2]) { P[2] = e; type = E; } else { P[2] = r; type = R; } }
  else if (r[2] < gd[2]) { P[2] = r; type = R; }
  else if (r[2] < w[2]) { const o = at(0.5); if (o[2] <= r[2]) { P[2] = o; type = O; } }
  else { const i = at(-0.5); if (i[2] < w[2]) { P[2] = i; type = I; } }
  if (type < 0) {
    for (let k = 1; k < 3; k++) { const x = b[0] + 0.5 * (P[k][0] - b[0]), y = b[1] + 0.5 * (P[k][1] - b[1]); P[k] = [x, y, g(x, y)]; }
    type = S;
  }
  return { type, r };
}

const diam = (P) => max(hypot(P[0][0] - P[1][0], P[0][1] - P[1][1]), hypot(P[0][0] - P[2][0], P[0][1] - P[2][1]), hypot(P[1][0] - P[2][0], P[1][1] - P[2][1]));

function checks() {
  // McKinnon's closed form: thirty inside contractions, the best corner on
  // the origin and the new one at (lambda1^k, lambda2^k).
  const F = FNS[2];
  const P = [[0, 0], [1, 1], [L1, L2]].map(([x, y]) => [x, y, F.f(x, y)]);
  let ok = abs(4 * L1 * L1 - L1 - 2) < 1e-12 && abs(4 * L2 * L2 - L2 - 2) < 1e-12;
  for (let k = 2; k < 32 && ok; k++) {
    const { type } = nmStep(F.f, P);
    const nv = P.find((p) => p[0] !== 0 && abs(p[0] - L1 ** k) < 1e-9 && abs(p[1] - L2 ** k) < 1e-9);
    ok = type === I && P[0][0] === 0 && P[0][1] === 0 && !!nv;
  }
  // Affine invariance: one Himmelblau walk in its own coordinates and in
  // LED coordinates makes the same moves.
  const G = FNS[1], gl = (px, py) => G.f(toX(G, px), toY(G, py));
  const A = [[1, 2], [1.6, 2.5], [0.9, 2.9]];
  const Pd = A.map(([x, y]) => [x, y, G.f(x, y)]), Pl = A.map(([x, y]) => [toPx(G, x), toPy(G, y), G.f(x, y)]);
  let same = true;
  for (let k = 0; k < 25 && same; k++) same = nmStep(G.f, Pd).type === nmStep(gl, Pl).type;
  return { mckinnon: ok, affine: same };
}

function newWalk(S, wk, i) {
  const F = FNS[S.fn], g = S.g;
  let pts;
  if (S.fn === 2 && i === 0 && S.ok.mckinnon) pts = [[0, 0], [1, 1], [L1, L2]].map(([x, y]) => [toPx(F, x), toPy(F, y)]);
  else {
    const rr = S.size / sqrt(3);
    // Starts spread over the panel: walker i draws from its own fifth of
    // the rows, at least 14 LEDs from every minimum, and the walk is run
    // ahead once to keep only starts whose corners all stay on the panel.
    for (let tries = 0; tries < 30; tries++) {
      const cx = 5 + Math.random() * (W - 10), cy = 4 + ((i + Math.random()) / NW) * (BAR - 12);
      const a = Math.random() * 2 * PI;
      pts = [0, 1, 2].map((k) => [cx + rr * cos(a + (k * 2 * PI) / 3), cy + rr * sin(a + (k * 2 * PI) / 3)]);
      if (!S.minPx.every(([mx, my]) => hypot(mx - cx, my - cy) > 14)) continue;
      const Q = pts.map(([x, y]) => [x, y, g(x, y)]);
      let inside = true;
      for (let n = 0; n < 400 && diam(Q) >= 0.01 && inside; n++) {
        nmStep(g, Q);
        inside = Q.every((p) => p[0] > -1 && p[0] < W + 1 && p[1] > -1 && p[1] < BAR);
      }
      if (inside) break;
    }
  }
  wk.P = pts.map(([x, y]) => [x, y, g(x, y)]);
  wk.from = wk.P.map((p) => p.slice());
  wk.to = wk.P.map((p) => p.slice());
  wk.u = 1;
  wk.dur = 0.15;
  wk.type = R;
  wk.r = null;
  wk.n = 0;
  wk.trail = [];
  wk.phase = 0;
  wk.ht = 0;
  wk.fade = 1;
}

function setFn(S, fn) {
  S.fn = fn;
  const F = FNS[fn];
  S.g = (px, py) => F.f(toX(F, px), toY(F, py));
  S.minPx = F.mins.map(([x, y]) => [toPx(F, x), toPy(F, y)]);
  S.tally = [0, 0, 0, 0, 0];
  // The contour map: lines where 2 log10((f - lo) / base) crosses a whole
  // number, every second one (the decades) brighter, from 4 samples a LED.
  // Where neighbouring lines would come closer than about 2.5 LEDs they
  // thin away, so a steep wall stays dark instead of filling with lines.
  // Below lo + base the land is filled in half-decade terraces, each one
  // brighter than the one above it, so the valley glows deepest at the floor.
  const map = S.map, fill = S.fill;
  const lv = (px, py) => 2 * log10(max(1e-9, F.f(toX(F, px), toY(F, py)) - F.lo) / F.base);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let line = 0, major = 0, low = 0;
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const px = x + ox, py = y + oy, v = lv(px, py), h = 0.05;
        const gx = (lv(px + h, py) - lv(px - h, py)) / (2 * h), gy = (lv(px, py + h) - lv(px, py - h)) / (2 * h);
        const gr = hypot(gx, gy);
        if (v < 0) low += min(1, 0.45 + 0.13 * floor(-v)) / 4;
        if (v < -8) continue;
        const k = round(v), d = abs(v - k) / max(1e-6, gr);
        const a = cl(1 - d / 0.55, 0, 1) * cl((0.55 - gr) / 0.25, 0, 1);
        if (k % 2 === 0) major += a / 4;
        else line += a / 4;
      }
      map[y * W + x] = min(1, line * 0.55 + major);
      fill[y * W + x] = low;
    }
  for (let i = 0; i < NW; i++) newWalk(S, S.walks[i], i);
  // Open with the walks at different stages: walker i is i x 2.5 s of
  // Speed 2 along its way.
  for (let i = 1; i < NW; i++) for (let q = 0; q < i * 75; q++) stepWalk(S, S.walks[i], i, 1 / 30);
}

export function setup(params) {
  const c = checks();
  params.s = {
    fn: -1, size: 3.4, hue: 0, speed: 2, ok: c,
    map: new Float32Array(W * H), fill: new Float32Array(W * H), buf: new Float32Array(W * H * 3),
    walks: Array.from({ length: NW }, () => ({})), tally: [0, 0, 0, 0, 0], g: null, minPx: [],
  };
}

// Starts the next move of a walk: one step of the method, then the corners
// to slide from and to, matched by identity so only the moved ones travel.
function nextMove(S, wk) {
  wk.P.sort((a, b) => a[2] - b[2]);
  const old = wk.P.map((p) => p.slice());
  const { type, r } = nmStep(S.g, wk.P);
  const to = wk.P.map((p) => p.slice());
  // Match: kept corners are the same arrays' values; find for each new corner
  // its old twin, the moved ones pair with what is left.
  const from = [null, null, null], used = [false, false, false];
  for (let k = 0; k < 3; k++)
    for (let j = 0; j < 3; j++)
      if (!used[j] && old[j][0] === to[k][0] && old[j][1] === to[k][1]) { from[k] = old[j]; used[j] = true; break; }
  for (let k = 0; k < 3; k++) if (!from[k]) { const j = used.indexOf(false); from[k] = old[j]; used[j] = true; }
  let disp = 0;
  for (let k = 0; k < 3; k++) disp = max(disp, hypot(to[k][0] - from[k][0], to[k][1] - from[k][1]));
  wk.from = from;
  wk.to = to;
  wk.type = type;
  wk.r = type === E || type === R ? null : r;
  wk.u = 0;
  wk.dur = 0.05 + 0.27 * cl(disp / 10, 0, 1);
  wk.n++;
  S.tally[type]++;
}

function stepWalk(S, wk, i, d) {
  if (wk.phase === 0) {
    wk.u += d / wk.dur;
    while (wk.u >= 1) {
      if (wk.n > 0 || wk.trail.length) {
        wk.trail.push([wk.to[0][0], wk.to[0][1], wk.to[1][0], wk.to[1][1], wk.to[2][0], wk.to[2][1], wk.type]);
        if (wk.trail.length > TRAIL) wk.trail.shift();
      } else wk.trail.push([wk.to[0][0], wk.to[0][1], wk.to[1][0], wk.to[1][1], wk.to[2][0], wk.to[2][1], -1]);
      if (diam(wk.P) < 0.01 || wk.n >= 400) { wk.phase = 1; wk.ht = 0; wk.u = 1; break; }
      const spare = (wk.u - 1) * wk.dur;
      nextMove(S, wk);
      wk.u = spare / wk.dur;
    }
  } else {
    wk.ht += d;
    wk.fade = 1 - ease((wk.ht - 1.4) / 0.5);
    if (wk.ht >= 1.9) newWalk(S, wk, i);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.size = 3 * 10 ** cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const fn = round(cl(k[2] || 0, 0, 2));
  if (fn !== S.fn) setFn(S, fn);
  const story = (d * S.speed) / 2;
  S.walks.forEach((wk, i) => stepWalk(S, wk, i, story));
}

// Adds a colour at a point with bilinear weights.
function splat(buf, x, y, r, g, b, a) {
  const x0 = floor(x - 0.5), y0 = floor(y - 0.5), fx = x - 0.5 - x0, fy = y - 0.5 - y0;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const X = x0 + i, Y = y0 + j;
      if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
      const w = (i ? fx : 1 - fx) * (j ? fy : 1 - fy) * a, o = (Y * W + X) * 3;
      buf[o] += r * w;
      buf[o + 1] += g * w;
      buf[o + 2] += b * w;
    }
}

function seg(buf, ax, ay, bx, by, c, a) {
  const n = max(1, Math.ceil(hypot(bx - ax, by - ay) * 1.6));
  for (let s = 0; s <= n; s++) {
    const t = s / n;
    splat(buf, ax + (bx - ax) * t, ay + (by - ay) * t, c[0], c[1], c[2], a / 1.6);
  }
}

function tri(buf, T, c, a) {
  seg(buf, T[0], T[1], T[2], T[3], c, a);
  seg(buf, T[2], T[3], T[4], T[5], c, a);
  seg(buf, T[4], T[5], T[0], T[1], c, a);
}

// Fills a triangle faintly, from 4 samples a LED when fine, else 1.
const SUB = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]], MID = [[0.5, 0.5]];
function fillTri(buf, T, c, a, fine) {
  const x0 = max(0, floor(min(T[0], T[2], T[4]))), x1 = min(W - 1, floor(max(T[0], T[2], T[4])));
  const y0 = max(0, floor(min(T[1], T[3], T[5]))), y1 = min(H - 1, floor(max(T[1], T[3], T[5])));
  const ar = (T[2] - T[0]) * (T[5] - T[1]) - (T[4] - T[0]) * (T[3] - T[1]);
  if (abs(ar) < 1e-9) return;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let cov = 0;
      for (const [ox, oy] of fine ? SUB : MID) {
        const px = x + ox, py = y + oy;
        const u = ((T[2] - px) * (T[5] - py) - (T[4] - px) * (T[3] - py)) / ar;
        const v = ((T[4] - px) * (T[1] - py) - (T[0] - px) * (T[5] - py)) / ar;
        if (u >= 0 && v >= 0 && u + v <= 1) cov += fine ? 0.25 : 1;
      }
      if (!cov) continue;
      const o = (y * W + x) * 3;
      buf[o] += c[0] * a * cov;
      buf[o + 1] += c[1] * a * cov;
      buf[o + 2] += c[2] * a * cov;
    }
}

function digits(buf, n, x, y, c, a) {
  const s = String(n);
  for (let q = 0; q < s.length; q++) {
    const gl = DIG[s.charCodeAt(q) - 48];
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 3; i++) {
        if (gl[j * 3 + i] !== "1") continue;
        const X = x + q * 4 + i, Y = y + j;
        if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
        const o = (Y * W + X) * 3;
        buf[o] = c[0] * a;
        buf[o + 1] = c[1] * a;
        buf[o + 2] = c[2] * a;
      }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.fn < 0) return;
  const buf = S.buf, hue = S.hue;
  const cols = MOVE_HUE.map((h, i) => hsv(h + hue, MOVE_SAT[i], 255));
  const start = hsv(0.57 + hue, 0.3, 255);
  // The map swings between green and pink through blue as the move colours
  // go round, so it never goes the brown of a dim orange.
  const mh = 0.6 + 0.25 * sin(2 * PI * hue);
  const ink = hsv(mh, 0.45, 1), low = hsv(mh + 0.02, 0.6, 1);
  // The map: decades at 64 out of 255, the lines between at 35, the
  // terraces from 22 to 50.
  for (let p = 0; p < W * H; p++) {
    const v = S.map[p] * 64, lo = S.fill[p] * 50;
    buf[p * 3] = ink[0] * v + low[0] * lo;
    buf[p * 3 + 1] = ink[1] * v + low[1] * lo;
    buf[p * 3 + 2] = ink[2] * v + low[2] * lo;
  }
  // The minima: small dim crosses.
  const mk = hsv(mh, 0.15, 150);
  for (const [mx, my] of S.minPx)
    for (const [dx, dy] of [[0, 0], [-2, 0], [2, 0], [0, -2], [0, 2]]) splat(buf, mx + dx, my + dy, mk[0], mk[1], mk[2], dx || dy ? 0.6 : 1);
  for (const wk of S.walks) {
    const fa = wk.fade;
    // The trail: each past triangle in the colour of the move that made it.
    const L = wk.trail.length;
    for (let j = 0; j < L; j++) {
      const T = wk.trail[j], age = (L - 1 - j) / TRAIL;
      const c = T[6] < 0 ? start : cols[T[6]];
      const k = (1 - age) ** 1.3 * fa;
      fillTri(buf, T, c, 0.06 * k, false);
      tri(buf, T, c, 0.1 * fa + 0.5 * k);
    }
    // The moving triangle, its new corner bright, and the rejected trial.
    const u = ease(wk.u), c = cols[wk.type];
    const Q = [];
    for (let k = 0; k < 3; k++) Q.push(wk.from[k][0] + (wk.to[k][0] - wk.from[k][0]) * u, wk.from[k][1] + (wk.to[k][1] - wk.from[k][1]) * u);
    if (wk.phase === 0) {
      fillTri(buf, Q, c, 0.16, true);
      tri(buf, Q, c, 1);
      for (let k = 0; k < 3; k++) splat(buf, Q[2 * k], Q[2 * k + 1], 255, 255, 255, 0.7);
      if (wk.r && wk.u < 1) {
        const a = 0.7 * (1 - u);
        splat(buf, wk.r[0], wk.r[1], c[0], c[1], c[2], a);
        seg(buf, (Q[0] + Q[2]) / 2, (Q[1] + Q[3]) / 2, wk.r[0], wk.r[1], c, a * 0.25);
      }
    } else {
      // Done: a ring opens round the point and the count of moves stands
      // beside it, white on a minimum, in the inside contraction's colour
      // where the walk stopped on a point that is not one.
      const bx = wk.P[0][0], by = wk.P[0][1], rr = 2 + 3 * cl(wk.ht / 0.6, 0, 1);
      const ra = (1 - cl(wk.ht / 1.4, 0, 1) * 0.6) * fa;
      const onMin = S.minPx.some(([mx, my]) => hypot(mx - bx, my - by) < 1.5);
      const rc = onMin ? [255, 255, 255] : cols[I];
      for (let q = 0; q < 24; q++) splat(buf, bx + rr * cos((q * PI) / 12), by + rr * sin((q * PI) / 12), rc[0], rc[1], rc[2], 0.6 * ra);
      splat(buf, bx, by, rc[0], rc[1], rc[2], fa);
      const s = String(wk.n), tw = s.length * 4 - 1;
      const tx = bx + 7 + tw < W ? round(bx + 7) : round(bx - 7 - tw), ty = round(cl(by - 2, 0, BAR - 6));
      digits(buf, wk.n, tx, ty, onMin ? [235, 235, 235] : rc, fa);
    }
  }
  // The bar: the share of each move type so far on this landscape.
  const tot = S.tally.reduce((a, b) => a + b, 0);
  if (tot > 0) {
    let x0 = 0;
    for (let t = 0; t < 5; t++) {
      const x1 = x0 + (S.tally[t] / tot) * W;
      for (let x = floor(x0); x < Math.ceil(x1) && x < W; x++) {
        const cov = min(x1, x + 1) - max(x0, x);
        if (cov <= 0) continue;
        for (let y = BAR; y < BAR + 2; y++) {
          const o = (y * W + x) * 3;
          buf[o] = buf[o] * (1 - cov) + cols[t][0] * 0.8 * cov;
          buf[o + 1] = buf[o + 1] * (1 - cov) + cols[t][1] * 0.8 * cov;
          buf[o + 2] = buf[o + 2] * (1 - cov) + cols[t][2] * 0.8 * cov;
        }
      }
      x0 = x1;
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const m = max(buf[o], buf[o + 1], buf[o + 2]), q = m > 255 ? 255 / m : 1;
      display.setPixel(x, y, round(buf[o] * q), round(buf[o + 1] * q), round(buf[o + 2] * q));
    }
}
