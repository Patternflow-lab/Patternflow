// ===== Patternflow pattern =====
// Title:   Spring Embedder
// Family:  particle
// Idea:    A graph is thrown out as a random scatter of charged vertices joined by springs, and the forces unscramble it in front of you into the symmetric solid the graph already was, which turns slowly in perspective with each vertex coloured by its distance from vertex 0 and each edge by how hard its spring is pulled, until it is kicked apart and the next graph starts.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: spring embedder (Peter Eades, 1984, "A heuristic for graph drawing"), its repulsion k squared over d and attraction d squared over k (Thomas Fruchterman and Edward Reingold, 1991), here run in three dimensions; Petersen graph (Julius Petersen, 1898); all years from memory, pattern round 112
// Round:   112
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Graph=0..6, Charge=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 vertex 0 is pale gold, the others run by their steps from it through green and azure to violet, a spring 1.6 units long is pale azure, a longer one goes rose and a shorter one blue; at 0.5 vertex 0 is pale blue, its three neighbours are rose, and a stretched spring is cyan and a squeezed one orange.
// Knob 2: Speed. The graph's own clock. At 2 the drawing unscrambles for 3.6 s, is held turning for 6 s and is kicked apart over 0.9 s, so a graph takes 10.5 s and the six take 63 s, and the solid turns once in 12.6 s; at 0.2 everything is ten times slower and at 3 half as fast again.
// Knob 3: Graph. 0 runs the six graphs in turn, which is where it opens, and 1 to 6 hold one: 1 Petersen graph (10 vertices, 15 edges), 2 the cube Q3 (8, 12), 3 the dodecahedron (20, 30), 4 the Heawood graph (14, 21), 5 the Desargues graph (20, 30) and 6 the truncated tetrahedron (12, 18). Each is built in code from a rule, and the code stops if a count, a degree of 3 on any vertex, a girth (5, 4, 5, 6, 6 and 3) or a vertex out of reach of vertex 0 comes out wrong. The farthest vertex is 2, 3, 5, 3, 5 and 3 steps from vertex 0. A held graph is still kicked apart and unscrambled every 10.5 s.
// Knob 4: Charge. The push of the vertices against the pull of the springs, 4 to the power of the knob, a quarter at -1 and 4 times at 1; it opens at 0.06, 1.09 times. A spring settles at about the cube root of that: the cube's is 0.81 units long at -1, 1.34 at the opening and 2.08 at 1, the dodecahedron's 1.11, 1.85 and 2.89. Springs go from blue below 0.7 units through pale azure at 1.6 to rose red above 3.05, the dots are 30% smaller at -1 and 30% larger at 1, and the dodecahedron takes 51 LEDs across and 114 down at -1, 58 and 120 at the opening, 64 and 124 at 1.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, exp, sin, cos, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Seconds of graph time at Speed 2: the unscrambling, the hold, the kick.
const RELAX = 3.6, HOLD = 6.0, KICK = 0.9;
// The solid turns this many radians a graph second.
const SPIN = 0.5;
// Fixed physics step, in graph seconds, and the forces' constants. Every
// length is in units of k, the length a spring wants.
const DT = 1 / 120, MU = 0.0025, RAMP = 11, HEAT = 0.045, STEP_CAP = 0.05, GRAV = 0.12;
// The length, in units of k, at which a spring is drawn neither stretched nor
// squeezed: about where the Heawood graph settles with the repulsion at 1.09.
const REST = 1.6;
const MAXN = 20;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- the six graphs, each from a rule -------------------------------------

// Kneser graph K(5,2): the 10 pairs from five things, joined when disjoint.
function petersen() {
  const s = [];
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) s.push([a, b]);
  const e = [];
  for (let i = 0; i < 10; i++)
    for (let j = i + 1; j < 10; j++)
      if (s[i][0] !== s[j][0] && s[i][0] !== s[j][1] && s[i][1] !== s[j][0] && s[i][1] !== s[j][1]) e.push([i, j]);
  return { n: 10, e };
}
// Q3: the numbers 0 to 7, joined when they differ in one bit.
function cube() {
  const e = [];
  for (let i = 0; i < 8; i++) for (let b = 0; b < 3; b++) if (!((i >> b) & 1)) e.push([i, i | (1 << b)]);
  return { n: 8, e };
}
// Generalized Petersen graph GP(m, s): an m-cycle, an inner ring where i
// joins i + s, and a spoke from each. GP(10,2) is the dodecahedron and
// GP(10,3) the Desargues graph.
function gp(m, s) {
  const e = [], seen = new Set();
  const add = (a, b) => {
    const key = a < b ? a * 100 + b : b * 100 + a;
    if (!seen.has(key)) seen.add(key), e.push([a, b]);
  };
  for (let i = 0; i < m; i++) add(i, (i + 1) % m), add(i, m + i), add(m + i, m + ((i + s) % m));
  return { n: 2 * m, e };
}
// A 14-cycle, and every even vertex joined to the one 5 along: LCF [5,-5]^7.
function heawood() {
  const e = [];
  for (let i = 0; i < 14; i++) {
    e.push([i, (i + 1) % 14]);
    if (i % 2 === 0) e.push([i, (i + 5) % 14]);
  }
  return { n: 14, e };
}
// Truncate a tetrahedron: a vertex for each ordered pair (i, j) of its four
// corners, the pairs (i, j) and (j, i) joined along the old edge, and the
// three pairs (i, .) round the old corner i joined in a triangle.
function truncatedTetrahedron() {
  const id = (i, j) => i * 3 + (j > i ? j - 1 : j);
  const e = [];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      if (i === j) continue;
      if (i < j) e.push([id(i, j), id(j, i)]);
      for (let k = j + 1; k < 4; k++) if (k !== i) e.push([id(i, j), id(i, k)]);
    }
  return { n: 12, e };
}

const SPECS = [
  { name: "Petersen", make: petersen, n: 10, m: 15, girth: 5 },
  { name: "Cube", make: cube, n: 8, m: 12, girth: 4 },
  { name: "Dodecahedron", make: () => gp(10, 2), n: 20, m: 30, girth: 5 },
  { name: "Heawood", make: heawood, n: 14, m: 21, girth: 6 },
  { name: "Desargues", make: () => gp(10, 3), n: 20, m: 30, girth: 6 },
  { name: "Truncated tetrahedron", make: truncatedTetrahedron, n: 12, m: 18, girth: 3 },
];

// Distances from vertex 0 by breadth-first search, and the girth: from every
// vertex, the first edge that closes on a vertex already reached.
function measureGraph(n, e) {
  const adj = Array.from({ length: n }, () => []);
  for (const [a, b] of e) adj[a].push(b), adj[b].push(a);
  const dist0 = new Array(n).fill(-1);
  let girth = 99;
  for (let root = 0; root < n; root++) {
    const d = new Array(n).fill(-1), par = new Array(n).fill(-1), q = [root];
    d[root] = 0;
    for (let h = 0; h < q.length; h++) {
      const u = q[h];
      for (const w of adj[u]) {
        if (d[w] < 0) (d[w] = d[u] + 1), (par[w] = u), q.push(w);
        else if (w !== par[u]) girth = min(girth, d[u] + d[w] + 1);
      }
    }
    if (root === 0) for (let i = 0; i < n; i++) dist0[i] = d[i];
  }
  return { adj, dist0, girth };
}

function buildGraphs() {
  return SPECS.map((sp) => {
    const g = sp.make(), info = measureGraph(g.n, g.e);
    const deg = new Array(g.n).fill(0);
    for (const [a, b] of g.e) deg[a]++, deg[b]++;
    // Every graph here is cubic, connected and has the girth the knob lists.
    const ok = g.n === sp.n && g.e.length === sp.m && deg.every((d) => d === 3) && info.girth === sp.girth && info.dist0.every((d) => d >= 0);
    if (!ok) throw new Error("graph " + sp.name + " is built wrong");
    return { name: sp.name, n: g.n, e: g.e, dist: info.dist0, dmax: max(...info.dist0) };
  });
}

// ---- state -----------------------------------------------------------------

export function setup(params) {
  params.s = {
    graphs: buildGraphs(),
    gi: 0, pick: -1, next: 0,
    n: 0, nDraw: 0,
    x: new Float64Array(MAXN * 3), f: new Float64Array(MAXN * 3),
    x0: new Float64Array(MAXN * 3), tgt: new Float64Array(MAXN * 3),
    hv: new Float32Array(MAXN), va: new Float32Array(MAXN),
    phase: 0, tau: 0, acc: 0, clock: 0, ang: 0.6, ea: 0,
    rxz: 0, ym: 0, ymid: 0, r3: 0, fitted: false, kf: 1, fc: 64, fy: 1,
    rgb: new Float32Array(N * 3), col: new Float32Array(3), tint: new Float32Array(9), px: new Float32Array(MAXN * 4),
  };
  startGraph(params.s, 0, null);
}

// A random point in a ball whose radius grows with the cube root of the
// vertex count, the way a drawing of n vertices does.
function scatter(out, i, n) {
  const R = 1.25 * Math.cbrt(n);
  let a, b, c;
  do (a = Math.random() * 2 - 1), (b = Math.random() * 2 - 1), (c = Math.random() * 2 - 1);
  while (a * a + b * b + c * c > 1);
  out[i * 3] = a * R;
  out[i * 3 + 1] = b * R;
  out[i * 3 + 2] = c * R;
}

// Begin graph gi. From the kick the vertices already lie where the kick left
// them (the first start has no kick, so it scatters its own).
function startGraph(S, gi, keep) {
  const g = S.graphs[gi];
  S.gi = gi;
  S.n = S.nDraw = g.n;
  if (!keep) for (let i = 0; i < g.n; i++) scatter(S.x, i, g.n);
  if (!keep)
    for (let i = 0; i < g.n; i++) (S.hv[i] = hueOf(g, i)), (S.va[i] = 1);
  S.phase = 0;
  S.tau = 0;
  S.ea = 0;
}

// The vertex's hue before the knob: pale gold for vertex 0, then a run from
// green through azure to violet with the distance from it.
const hueOf = (g, i) => (g.dist[i] === 0 ? 0.13 : 0.14 + (0.62 * g.dist[i]) / max(3, g.dmax));

function kick(S, nextGi) {
  const g = S.graphs[S.gi], ng = S.graphs[nextGi], n = max(g.n, ng.n);
  S.next = nextGi;
  S.phase = 2;
  S.tau = 0;
  for (let i = 0; i < n; i++) {
    // The vertices the old graph has fly to a new scatter; the ones only the
    // new graph has start there and fade in on the way.
    scatter(S.tgt, i, ng.n);
    if (i < g.n) for (let k = 0; k < 3; k++) S.x0[i * 3 + k] = S.x[i * 3 + k];
    else {
      for (let k = 0; k < 3; k++) S.x[i * 3 + k] = S.x0[i * 3 + k] = S.tgt[i * 3 + k];
      S.va[i] = 0;
      S.hv[i] = hueOf(ng, i);
    }
  }
  S.nDraw = n;
}

// One step of Fruchterman and Reingold's forces in three dimensions: every
// pair repels with C k^2 / d, every edge pulls its ends with d^2 / k, and a
// weak spring to the centre. Each
// vertex moves by its force times a mobility, cut off at a maximum, and while
// the drawing is hot it is shaken as well.
function physics(S, C, mu, heat, cap) {
  const g = S.graphs[S.gi], n = g.n, x = S.x, f = S.f;
  f.fill(0);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const dx = x[i * 3] - x[j * 3], dy = x[i * 3 + 1] - x[j * 3 + 1], dz = x[i * 3 + 2] - x[j * 3 + 2];
      const k = C / (dx * dx + dy * dy + dz * dz + 0.01);
      f[i * 3] += dx * k; f[i * 3 + 1] += dy * k; f[i * 3 + 2] += dz * k;
      f[j * 3] -= dx * k; f[j * 3 + 1] -= dy * k; f[j * 3 + 2] -= dz * k;
    }
  for (const [a, b] of g.e) {
    const dx = x[a * 3] - x[b * 3], dy = x[a * 3 + 1] - x[b * 3 + 1], dz = x[a * 3 + 2] - x[b * 3 + 2];
    const k = sqrt(dx * dx + dy * dy + dz * dz);
    f[a * 3] -= dx * k; f[a * 3 + 1] -= dy * k; f[a * 3 + 2] -= dz * k;
    f[b * 3] += dx * k; f[b * 3 + 1] += dy * k; f[b * 3 + 2] += dz * k;
  }
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    f[o] -= GRAV * x[o];
    f[o + 1] -= GRAV * x[o + 1];
    f[o + 2] -= GRAV * x[o + 2];
    let mx = f[o] * mu + (Math.random() - 0.5) * 2 * heat;
    let my = f[o + 1] * mu + (Math.random() - 0.5) * 2 * heat;
    let mz = f[o + 2] * mu + (Math.random() - 0.5) * 2 * heat;
    const m = hypot(mx, my, mz);
    if (m > cap) (mx *= cap / m), (my *= cap / m), (mz *= cap / m);
    x[o] += mx; x[o + 1] += my; x[o + 2] += mz;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  const pick = cl(floor(kv[2] + 0.5), 0, 6), charge = cl(kv[3], -1, 1);
  S.charge = charge;
  const C = Math.pow(4, charge);
  const g = (d * S.speed) / 2;
  S.clock += g;
  S.ang += SPIN * g;

  // Choosing a graph by hand kicks the drawing apart into it at once.
  if (S.pick < 0 && pick > 0) startGraph(S, pick - 1, false);
  else if (pick !== S.pick && pick > 0 && (S.phase === 2 ? S.next !== pick - 1 : S.gi !== pick - 1)) kick(S, pick - 1);
  S.pick = pick;

  S.tau += g;
  if (S.phase === 0 && S.tau >= RELAX) (S.phase = 1), (S.tau -= RELAX);
  else if (S.phase === 1 && S.tau >= HOLD) kick(S, pick > 0 ? pick - 1 : (S.gi + 1) % S.graphs.length);
  if (S.phase === 2 && S.tau >= KICK) startGraph(S, S.next, true);

  if (S.phase === 2) {
    // The kick: the vertices fly to a new scatter and slow down on the way.
    const e = (1 - exp(-S.tau / 0.22)) / (1 - exp(-KICK / 0.22));
    const ng = S.graphs[S.next];
    for (let i = 0; i < S.nDraw; i++) {
      if (i >= S.graphs[S.gi].n) continue;
      for (let k = 0; k < 3; k++) S.x[i * 3 + k] = S.x0[i * 3 + k] + (S.tgt[i * 3 + k] - S.x0[i * 3 + k]) * e;
    }
    for (let i = 0; i < S.nDraw; i++) S.va[i] += ((i < ng.n ? 1 : 0) - S.va[i]) * min(1, d * 5);
    S.ea += (0.15 - S.ea) * min(1, d * 6);
  } else {
    S.acc += g / DT;
    let steps = 0;
    while (S.acc >= 1 && steps < 24) {
      S.acc -= 1;
      steps++;
      const u = S.phase === 0 ? min(1, S.tau / RELAX) : 1;
      physics(S, C, MU * (1 + RAMP * u * u * u), S.phase === 0 ? HEAT * (1 - u) * (1 - u) : 0, STEP_CAP * (0.12 + 0.88 * u * u));
    }
    if (S.acc > 1) S.acc = 0;
    S.ea += (1 - S.ea) * min(1, d * 4);
    for (let i = 0; i < S.nDraw; i++) S.va[i] += (1 - S.va[i]) * min(1, d * 5);
  }
  for (let i = 0; i < S.nDraw; i++) {
    const g2 = S.phase === 2 ? S.graphs[S.next] : S.graphs[S.gi];
    if (i < g2.n) S.hv[i] += (hueOf(g2, i) - S.hv[i]) * min(1, d * 6);
  }

  // The fit: how far the drawing reaches sideways, up and in all directions,
  // from its centre, followed a little slowly so the picture does not jump.
  const n = S.nDraw, x = S.x;
  let cx = 0, cz = 0, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) {
    cx += x[i * 3]; cz += x[i * 3 + 2];
    y0 = min(y0, x[i * 3 + 1]); y1 = max(y1, x[i * 3 + 1]);
  }
  cx /= n; cz /= n;
  let ry = 0, r3 = 0;
  const ym = (y0 + y1) / 2;
  for (let i = 0; i < n; i++) {
    const a = x[i * 3] - cx, c = x[i * 3 + 2] - cz, b = x[i * 3 + 1] - ym;
    ry = max(ry, hypot(a, c));
    r3 = max(r3, hypot(a, b, c));
  }
  S.cx = cx; S.cz = cz;
  const kf = S.fitted ? min(1, d * 3) : 1;
  S.kf = kf;
  S.rxz += (ry - S.rxz) * kf;
  S.ym += ((y1 - y0) / 2 - S.ym) * kf;
  S.ymid += (ym - S.ymid) * kf;
  S.r3 += (r3 - S.r3) * kf;
  S.fitted = true;
}

// ---- drawing ---------------------------------------------------------------

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.fitted) return;
  const rgb = S.rgb, col = S.col, P = S.px, mid = S.tint.subarray(0, 3), cool = S.tint.subarray(3, 6), warm = S.tint.subarray(6, 9);
  rgb.fill(0);
  const g = S.graphs[S.gi], n = S.nDraw, x = S.x;
  const ch = S.charge;
  // Camera: the solid turns about the vertical axis and is seen from above at
  // about 29 degrees, from 3 radii away so the near side looms. The panel is
  // twice as tall as it is wide, so the picture is stretched upward, 2.1 to
  // 2.5 times for the six graphs (measured), and the springs' colours still
  // come from their true lengths.
  const ang = S.ang, ca = cos(ang), sa = sin(ang);
  const tilt = 0.5 + 0.1 * sin(S.clock * 0.45), ct = cos(tilt), st = sin(tilt);
  const R = max(0.5, S.r3), D = 3 * R, rxz = max(0.3, S.rxz);
  // f puts the farthest sideways swing of the widest vertex at half-width HW.
  const HW = 27.5 + 3 * ch, HH = 57 + 2 * ch;
  const a = D / rxz, fl = HW * sqrt(max(1.05, a * a - 1));
  for (let i = 0; i < n; i++) {
    const X = x[i * 3] - S.cx, Y = x[i * 3 + 1] - S.ymid, Z = x[i * 3 + 2] - S.cz;
    const xr = ca * X + sa * Z, zr = -sa * X + ca * Z;
    const yt = Y * ct - zr * st, zt = Y * st + zr * ct;
    const k = fl / (D - cl(zt, -D * 0.8, D * 0.8));
    const dn = cl((zt + R) / (2 * R), 0, 1);
    P[i * 4] = 32 + xr * k;
    P[i * 4 + 1] = 64 - yt * k;
    P[i * 4 + 2] = dn;
    P[i * 4 + 3] = k / (fl / D);
  }
  // The tilt and the near side's looming push the drawing off centre, so the
  // projected height is measured and the drawing is centred and stretched to
  // fit, followed slowly like the rest of the fit.
  let top = 1e9, bot = -1e9;
  for (let i = 0; i < n; i++) {
    top = min(top, P[i * 4 + 1]);
    bot = max(bot, P[i * 4 + 1]);
  }
  const kf = S.kf, half = max(1, (bot - top) / 2);
  S.fc += ((top + bot) / 2 - S.fc) * kf;
  S.fy += (cl(HH / half, 1, 2.5) - S.fy) * kf;
  for (let i = 0; i < n; i++) P[i * 4 + 1] = 64 + (P[i * 4 + 1] - S.fc) * S.fy;
  const hK = S.hue, ea = S.ea;
  hsv(hK + 0.52, 0.55, 1, mid, 0);
  hsv(hK + 0.64, 0.95, 1, cool, 0);
  hsv(hK + 0.97, 0.9, 1, warm, 0);
  for (const [p, q] of g.e) {
    const len = hypot(x[p * 3] - x[q * 3], x[p * 3 + 1] - x[q * 3 + 1], x[p * 3 + 2] - x[q * 3 + 2]);
    // Pale azure at REST units long, rose red from 91% longer and blue from
    // 56% shorter.
    const r = len / REST - 1, u = cl(r * (r < 0 ? 1.8 : 1.1), -1, 1), ua = Math.pow(abs(u), 0.8), tone = u < 0 ? cool : warm;
    for (let e = 0; e < 3; e++) col[e] = mid[e] + (tone[e] - mid[e]) * ua;
    const ax = P[p * 4], ay = P[p * 4 + 1], az = P[p * 4 + 2], bx = P[q * 4], by = P[q * 4 + 1], bz = P[q * 4 + 2];
    const vx = bx - ax, vy = by - ay, vv = vx * vx + vy * vy + 1e-6;
    const al = ea * min(S.va[p], S.va[q]);
    if (al <= 0.01) continue;
    const x0 = max(0, floor(min(ax, bx) - 3.5)), x1 = min(W - 1, floor(max(ax, bx) + 3.5));
    const y0 = max(0, floor(min(ay, by) - 3.5)), y1 = min(H - 1, floor(max(ay, by) + 3.5));
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const px = xx + 0.5 - ax, py = yy + 0.5 - ay;
        const t = cl((px * vx + py * vy) / vv, 0, 1);
        const ex = px - vx * t, ey = py - vy * t, dist = sqrt(ex * ex + ey * ey);
        const dn = az + (bz - az) * t;
        // The wire a pixel and a half wide, in a soft glow.
        const cov = cl(0.4 + 0.3 * dn + 0.55 - dist, 0, 1) + 0.3 * exp(-dist * dist * 0.5);
        if (cov <= 0.01) continue;
        const w = cov * (0.14 + 0.82 * dn) * al, o = (yy * W + xx) * 3;
        rgb[o] += col[0] * w; rgb[o + 1] += col[1] * w; rgb[o + 2] += col[2] * w;
      }
  }
  // The vertices: soft dots, bigger and brighter when near.
  const rd0 = 5.4 - 0.1 * g.n;
  for (let i = 0; i < n; i++) {
    const al = S.va[i];
    if (al <= 0.01) continue;
    const dn = P[i * 4 + 2], cx = P[i * 4], cy = P[i * 4 + 1];
    const root = i === 0;
    const rd = rd0 * (0.6 + 0.55 * dn + 0.25 * (P[i * 4 + 3] - 1)) * (1 + 0.3 * ch) * (root ? 1.3 : 1);
    hsv(hK + S.hv[i], root ? 0.4 : 0.85, 1, col, 0);
    const rr = floor(rd * 1.9) + 1, bright = (0.3 + 0.7 * dn) * al;
    const x0 = max(0, floor(cx - rr)), x1 = min(W - 1, floor(cx + rr));
    const y0 = max(0, floor(cy - rr)), y1 = min(H - 1, floor(cy + rr));
    const r2 = rd * rd;
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const px = xx + 0.5 - cx, py = yy + 0.5 - cy, q = px * px + py * py;
        const gl = exp((-q / r2) * 2) * bright, core = exp((-q / r2) * 8) * 0.35 * al * dn;
        if (gl < 0.004) continue;
        const o = (yy * W + xx) * 3;
        rgb[o] += col[0] * gl + core; rgb[o + 1] += col[1] * gl + core; rgb[o + 2] += col[2] * gl + core;
      }
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let xx = 0; xx < W; xx++, o += 3) display.setPixel(xx, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
