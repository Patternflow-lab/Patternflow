// ===== Patternflow pattern =====
// Title:   Koebe Packing
// Family:  cells
// Idea:    A tall rectangle of discs, each touching exactly its neighbours in a triangulation drawn as spokes through the kissing points, re-solves itself every time an edge of the triangulation flips or a vertex is born or removed, so the discs swell and shrink into the one packing the new graph allows.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: circle packing theorem (Paul Koebe, 1936; E. M. Andreev, 1970; William Thurston, 1980s), computed by the iteration of Charles Collins and Kenneth Stephenson (2003), pattern round 47
// Round:   47
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Circles=22..56, Graph=0..1
//
// Knob 1: Hue. Turns the colours of the degrees round the wheel: at 0 the small discs of degree 4 are pink, 5 amber, 6 cyan, 7 blue and the big ones of degree 8 violet; at 0.5 the same five are green, blue, red, amber and lime.
// Knob 2: Speed. At 2 the triangulation changes every 1.2 seconds and the discs take about a second to settle into the new packing; at 0.2 a change comes every 12 seconds, at 3 every 0.8.
// Knob 3: Circles. About how many discs the packing holds, 22 to 56 (a birth or a removal moves it by one or two for a while); the rim of the rectangle grows with them, 14 boundary discs up to 24, 20 up to 40, 26 above. Turning it grows a new triangulation from points.
// Knob 4: Graph. At 0 the discs are solid and the triangulation shows as dark spokes from each centre to the points where it kisses its neighbours; toward 1 the discs empty to rings and the spokes turn white, so the triangulation itself is the picture.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, asin, atan2, round, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// Hue of each degree, added to Hue + 0.9 so that 0 opens on pink, not red.
// A boundary disc counts as the degree its angle would have inside: faces
// times 2 pi over its target angle, so a side disc with three faces is a 6.
const DEG_HUE = [0, 0, 0, 0, 0, 0.21, 0.6, 0.73, 0.86];
// Interior degree limits for an ordinary flip; a disc being born or removed
// may sit at 3 for a while.
const DMIN = 4, DMAX = 8;
// One change in this many story seconds (one a second at Speed 2).
const EVERY = 1.2;
// How freely a flip may push degrees away from 6.
const TEMP = 4;

// --- the triangulation ---
// Each vertex keeps its flower: the neighbours in counterclockwise order,
// closed for an interior vertex, open for a boundary vertex (from the next
// boundary vertex round to the previous one). kind is 0 inside, 1 on a side
// of the rectangle, 2 at a corner. Target angle sums: 2 pi inside, pi along
// a side (the centres line up), pi/2 at a corner.

function faces(S, v) {
  return S.kind[v] ? S.fl[v].length - 1 : S.fl[v].length;
}
function target(S, v) {
  return S.kind[v] === 0 ? TAU : S.kind[v] === 1 ? PI : PI / 2;
}
function effDeg(S, v, df = 0) {
  return round(((faces(S, v) + df) * TAU) / target(S, v));
}
function hasNb(S, a, b) {
  return S.fl[a].indexOf(b) >= 0;
}
// Two boundary vertices may be joined across the inside only when they are
// the two neighbours of one corner (the edge cuts that corner off); joined
// anywhere else they would have to touch through the line of discs between.
function cornerCut(S, a, b) {
  if (!S.kind[a] || !S.kind[b]) return true;
  const B = S.B, d = (S.bi[b] - S.bi[a] + B) % B;
  if (d === 2) return S.kind[S.ring[(S.bi[a] + 1) % B]] === 2;
  if (d === B - 2) return S.kind[S.ring[(S.bi[b] + 1) % B]] === 2;
  return false;
}
// Can vertex v lose a face, or gain one? A side disc keeps two to four
// faces, a corner disc one or two.
function canLose(S, v, focus) {
  const f = faces(S, v);
  if (S.kind[v] === 0) return f - 1 >= (v === focus ? 3 : DMIN);
  return f - 1 >= (S.kind[v] === 2 ? 1 : 2);
}
function canGain(S, v) {
  const f = faces(S, v);
  if (S.kind[v] === 0) return f + 1 <= DMAX;
  return f + 1 <= (S.kind[v] === 2 ? 2 : 4);
}

// The edge uv with its two triangles (u, v, a) and (u, b, v), both
// counterclockwise, or null when uv lies on the boundary.
function quad(S, u, v) {
  const fu = S.fl[u], i = fu.indexOf(v), n = fu.length;
  if (i < 0) return null;
  if (S.kind[u]) {
    if (i === 0 || i === n - 1) return null;
    return [fu[i + 1], fu[i - 1]];
  }
  return [fu[(i + 1) % n], fu[(i - 1 + n) % n]];
}

function canFlip(S, u, v, focus) {
  const q = quad(S, u, v);
  if (!q) return null;
  const [a, b] = q;
  if (a === b || hasNb(S, a, b) || !cornerCut(S, a, b)) return null;
  if (!canLose(S, u, focus) || !canLose(S, v, focus) || !canGain(S, a) || !canGain(S, b)) return null;
  return q;
}

// Flip uv to ab: the quadrilateral u, b, v, a keeps its four sides and
// swaps its diagonal.
function flip(S, u, v, a, b) {
  const rm = (x, y) => S.fl[x].splice(S.fl[x].indexOf(y), 1);
  const ins = (x, after, y) => S.fl[x].splice(S.fl[x].indexOf(after) + 1, 0, y);
  rm(u, v);
  rm(v, u);
  ins(a, u, b);
  ins(b, v, a);
  S.flash.push({ a, b, t: 0 });
}

function newId(S) {
  for (let i = 0; i < S.kind.length; i++) if (!S.alive[i] && S.dr[i] <= 0) return i;
  S.kind.push(0), S.fl.push([]), S.alive.push(0), S.bi.push(-1);
  for (const k of ["R", "x", "y", "dx", "dy", "dr", "hu"]) S[k].push(0);
  return S.kind.length - 1;
}

// A new vertex in triangle (u, v, w), counterclockwise: it starts with
// degree 3, the small circle in the gap between three that touch.
function insert(S, u, v, w) {
  const x = newId(S);
  S.kind[x] = 0;
  S.alive[x] = 1;
  S.fl[x] = [u, v, w];
  const ins = (p, after, y) => S.fl[p].splice(S.fl[p].indexOf(after) + 1, 0, y);
  ins(u, v, x);
  ins(v, w, x);
  ins(w, u, x);
  S.R[x] = 0.15 * min(S.R[u], S.R[v], S.R[w]);
  // Born at the gap between the three, with no size yet.
  S.dx[x] = (S.dx[u] + S.dx[v] + S.dx[w]) / 3;
  S.dy[x] = (S.dy[u] + S.dy[v] + S.dy[w]) / 3;
  S.dr[x] = 0;
  S.born = x;
  for (const p of [u, v, w]) S.flash.push({ a: x, b: p, t: 0 });
  return x;
}

// Remove an interior vertex of degree 3: its three triangles become one.
function remove(S, x) {
  for (const p of S.fl[x]) S.fl[p].splice(S.fl[p].indexOf(x), 1);
  S.fl[x] = [];
  S.alive[x] = 0;
}

// The starting triangulation: a grid of c by 2c vertices, each square cut
// by a random diagonal, its outer ring the boundary with corners at the
// grid's corners; then interior vertices put into random triangles or taken
// out until there are n, and a few hundred random flips to forget the grid.
function build(S, n, grow) {
  const c = max(3, round(sqrt(n / 2))), r = 2 * c;
  Object.assign(S, { kind: [], fl: [], alive: [], bi: [], R: [], x: [], y: [], dx: [], dy: [], dr: [], hu: [], flash: [], focus: -1, mode: 0, born: -1 });
  const id = (i, j) => j * c + i, adj = [];
  for (let k = 0; k < c * r; k++) newId(S), (S.alive[k] = 1), (adj[k] = new Set());
  const link = (p, q) => (adj[p].add(q), adj[q].add(p));
  for (let j = 0; j < r; j++)
    for (let i = 0; i < c; i++) {
      if (i + 1 < c) link(id(i, j), id(i + 1, j));
      if (j + 1 < r) link(id(i, j), id(i, j + 1));
      if (i + 1 < c && j + 1 < r) Math.random() < 0.5 ? link(id(i, j), id(i + 1, j + 1)) : link(id(i + 1, j), id(i, j + 1));
    }
  // The boundary ring, counterclockwise (with y up): along the bottom,
  // up the right, back along the top, down the left.
  const ring = [];
  for (let i = 0; i < c - 1; i++) ring.push(id(i, 0));
  for (let j = 0; j < r - 1; j++) ring.push(id(c - 1, j));
  for (let i = c - 1; i > 0; i--) ring.push(id(i, r - 1));
  for (let j = r - 1; j > 0; j--) ring.push(id(0, j));
  S.ring = ring;
  S.B = ring.length;
  S.corners = [id(0, 0), id(c - 1, 0), id(c - 1, r - 1), id(0, r - 1)];
  ring.forEach((v, k) => ((S.kind[v] = 1), (S.bi[v] = k)));
  for (const v of S.corners) S.kind[v] = 2;
  // Flowers by angle round each grid point; a boundary flower starts just
  // after the widest gap, which is the outside.
  for (let k = 0; k < c * r; k++) {
    const i = k % c, j = floor(k / c);
    const nb = [...adj[k]].map((q) => [atan2(floor(q / c) - j, (q % c) - i), q]).sort((p, q) => p[0] - q[0]);
    let start = 0;
    if (S.kind[k]) {
      let gap = -1;
      for (let m = 0; m < nb.length; m++) {
        const g = (nb[m][0] - nb[(m - 1 + nb.length) % nb.length][0] + TAU) % TAU || TAU;
        if (g > gap) (gap = g), (start = m);
      }
    }
    S.fl[k] = nb.map((_, m) => nb[(start + m) % nb.length][1]);
    S.alive[k] = 1;
    S.R[k] = 1;
  }
  // Each new vertex is followed by flips, which spread the degrees and free
  // room for the next one.
  for (let tries = 0; tries < 400 && count(S) !== n; tries++) {
    const t = triangles(S).filter((p) => p.every((q) => canGain(S, q)));
    if (count(S) > n) drop(S);
    else if (t.length) insert(S, ...t[floor(Math.random() * t.length)]);
    for (let k = 0; k < 20; k++) randomFlip(S, TEMP);
  }
  S.born = -1;
  for (let k = 0; k < 300; k++) randomFlip(S, TEMP);
  S.flash = [];
  for (let k = 0; k < 600; k++) sweep(S);
  layout(S);
  for (let v = 0; v < S.kind.length; v++) {
    S.dx[v] = S.x[v];
    S.dy[v] = S.y[v];
    S.dr[v] = S.alive[v] && !grow ? S.tr[v] : 0;
    S.hu[v] = hueOf(S, v);
  }
}

// Take one interior vertex out: flip its edges away until it has three,
// then remove it.
function drop(S) {
  const vs = [];
  for (let v = 0; v < S.kind.length; v++) if (S.alive[v] && !S.kind[v]) vs.push(v);
  vs.sort((p, q) => S.fl[p].length - S.fl[q].length);
  for (const x of vs.slice(0, 6)) {
    S.focus = x;
    for (let k = 0; k < 12 && S.fl[x].length > 3; k++) {
      const opts = S.fl[x].filter((p) => canFlip(S, x, p, x));
      if (!opts.length) break;
      const p = opts[floor(Math.random() * opts.length)], q = canFlip(S, x, p, x);
      flip(S, x, p, q[0], q[1]);
    }
    if (S.fl[x].length === 3 && S.fl[x].every((p) => canLose(S, p, -1))) {
      remove(S, x);
      break;
    }
  }
  S.focus = -1;
}

function count(S) {
  let n = 0;
  for (let v = 0; v < S.kind.length; v++) n += S.alive[v];
  return n;
}

// Every triangle once, counterclockwise.
function triangles(S) {
  const out = [];
  for (let v = 0; v < S.kind.length; v++) {
    if (!S.alive[v]) continue;
    const f = S.fl[v], n = f.length, m = S.kind[v] ? n - 1 : n;
    for (let i = 0; i < m; i++) {
      const a = f[i], b = f[(i + 1) % n];
      if (v < a && v < b) out.push([v, a, b]);
    }
  }
  return out;
}

// Interior degrees like to stay near 6: a flip that moves them away is
// taken less often, so the packing keeps a mix of sizes without running to
// one huge disc.
function energy(S, vs, d) {
  let e = 0;
  vs.forEach((v, k) => {
    const g = effDeg(S, v, d[k]);
    e += (g - 6) * (g - 6);
  });
  return e;
}

function randomFlip(S, temp) {
  for (let tries = 0; tries < 40; tries++) {
    const u = floor(Math.random() * S.kind.length);
    if (!S.alive[u] || u === S.focus) continue;
    const f = S.fl[u], v = f[floor(Math.random() * f.length)];
    if (v === S.focus) continue;
    const q = canFlip(S, u, v, -1);
    if (!q) continue;
    const vs = [u, v, q[0], q[1]], dE = energy(S, vs, [-1, -1, 1, 1]) - energy(S, vs, [0, 0, 0, 0]);
    if (dE > 0 && Math.random() > exp(-dE / temp)) continue;
    flip(S, u, v, q[0], q[1]);
    return true;
  }
  return false;
}

// One change of the triangulation. A disc being born keeps growing by
// flips of the edges across from it until it has degree 5 or 6; a disc
// being removed loses an edge a change until it is down to three, then goes.
function change(S) {
  const x = S.focus;
  if (x >= 0 && S.mode === 1) {
    // Grow: flip an edge ab of x's link to the vertex c across it.
    const f = S.fl[x], n = f.length, opts = [];
    for (let i = 0; i < n; i++) {
      const a = f[i], b = f[(i + 1) % n], q = canFlip(S, a, b, x);
      if (q && (q[0] === x || q[1] === x)) opts.push([a, b, q]);
    }
    if (opts.length && n < S.goal) {
      const [a, b, q] = opts[floor(Math.random() * opts.length)];
      flip(S, a, b, q[0], q[1]);
      if (S.fl[x].length >= S.goal) S.focus = -1;
      return;
    }
    S.focus = -1;
  } else if (x >= 0 && S.mode === 2) {
    // Shrink: flip one of x's own edges away.
    if (S.fl[x].length <= 3) {
      if (S.fl[x].every((p) => canLose(S, p, -1))) remove(S, x);
      S.focus = -1;
      return;
    }
    const opts = S.fl[x].filter((p) => canFlip(S, x, p, x));
    if (opts.length) {
      const p = opts[floor(Math.random() * opts.length)], q = canFlip(S, x, p, x);
      flip(S, x, p, q[0], q[1]);
      return;
    }
    S.focus = -1;
  }
  const n = count(S), r = Math.random();
  if (r < 0.22 && n <= S.n) {
    // Born in the biggest gap: the triangle with the largest circles.
    let best = null, bs = -1;
    for (const t of triangles(S)) {
      if (!t.every((p) => canGain(S, p))) continue;
      const s = min(S.R[t[0]], S.R[t[1]], S.R[t[2]]) * (0.8 + 0.4 * Math.random());
      if (s > bs) (bs = s), (best = t);
    }
    if (best) {
      S.focus = insert(S, ...best);
      S.mode = 1;
      S.goal = 5 + (Math.random() < 0.5 ? 1 : 0);
      return;
    }
  } else if (r < 0.44 && n >= S.n) {
    // Removed: an interior disc of low degree, not one just born.
    const vs = [];
    for (let v = 0; v < S.kind.length; v++) if (S.alive[v] && !S.kind[v] && v !== S.born) vs.push(v);
    vs.sort((p, q) => S.fl[p].length - S.fl[q].length);
    if (vs.length) {
      S.focus = vs[floor(Math.random() * min(3, vs.length))];
      S.mode = 2;
      change(S);
      return;
    }
  }
  randomFlip(S, TEMP);
}

// --- the packing ---
// The angle at v in the triangle of three mutually tangent circles with
// radii r, a, b: sides r + a, r + b, a + b, and by the half-angle form of
// the law of cosines sin^2(theta / 2) = ab / ((r + a)(r + b)).
const ang = (r, a, b) => 2 * asin(sqrt((a * b) / ((r + a) * (r + b))));

// One sweep of Collins and Stephenson: each vertex is given the radius its
// angle sum would need if its k neighbours were all one size (the uniform
// neighbour model): beta = sin(sum / 2k) gives that size, delta =
// sin(target / 2k) the radius that meets the target with it. Every target
// is an angle, so the packing is free in scale; the mean radius is held at 1.
function sweep(S) {
  const R = S.R;
  let sum = 0, n = 0, err = 0;
  for (let v = 0; v < S.kind.length; v++) {
    if (!S.alive[v]) continue;
    const f = S.fl[v], m = f.length, k = S.kind[v] ? m - 1 : m, r = R[v];
    let th = 0;
    for (let i = 0; i < k; i++) th += ang(r, R[f[i]], R[f[(i + 1) % m]]);
    const T = target(S, v);
    err = max(err, abs(th - T));
    const beta = min(0.99999, sin(th / (2 * k))), delta = sin(T / (2 * k));
    R[v] = ((beta * r) / (1 - beta)) * ((1 - delta) / delta);
    sum += R[v];
    n++;
  }
  for (let v = 0; v < S.kind.length; v++) if (S.alive[v]) R[v] *= n / sum;
  return err;
}

// Lay the circles out from one placed triangle: each placed vertex places
// the rest of its flower by the angles round it, counterclockwise from a
// placed neighbour (and clockwise too on the boundary). Then turn the
// rectangle upright from its first corner to its second and fit it to the
// panel.
function layout(S) {
  const nV = S.kind.length, R = S.R, X = new Float64Array(nV), Y = new Float64Array(nV), done = new Uint8Array(nV);
  let v0 = 0;
  while (!S.alive[v0]) v0++;
  const v1 = S.fl[v0][0];
  done[v0] = done[v1] = 1;
  X[v1] = R[v0] + R[v1];
  const queue = [v0, v1];
  while (queue.length) {
    const v = queue.shift(), f = S.fl[v], m = f.length;
    let i0 = -1;
    for (let i = 0; i < m; i++) if (done[f[i]]) (i0 = i), (i = m);
    if (i0 < 0) continue;
    const step = (dir) => {
      let prev = f[i0], i = i0;
      for (let s = 1; s < m; s++) {
        const j = S.kind[v] ? i + dir : (i + dir + m) % m;
        if (j < 0 || j >= m) break;
        const u = f[j];
        if (!done[u]) {
          const a = atan2(Y[prev] - Y[v], X[prev] - X[v]) + dir * ang(R[v], R[prev], R[u]), d = R[v] + R[u];
          X[u] = X[v] + d * cos(a);
          Y[u] = Y[v] + d * sin(a);
          done[u] = 1;
          queue.push(u);
        }
        prev = u;
        i = j;
      }
    };
    step(1);
    if (S.kind[v]) step(-1);
  }
  const [k0, k1] = S.corners, rot = -atan2(Y[k1] - Y[k0], X[k1] - X[k0]), cr = cos(rot), sr = sin(rot);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let v = 0; v < nV; v++) {
    if (!S.alive[v]) continue;
    const x = X[v] * cr - Y[v] * sr, y = X[v] * sr + Y[v] * cr;
    (X[v] = x), (Y[v] = y);
    x0 = min(x0, x - R[v]), x1 = max(x1, x + R[v]), y0 = min(y0, y - R[v]), y1 = max(y1, y + R[v]);
  }
  const sc = min((W - 1) / (x1 - x0), (H - 1) / (y1 - y0)), ox = (W - sc * (x1 - x0)) / 2, oy = (H - sc * (y1 - y0)) / 2;
  S.tr = S.tr && S.tr.length === nV ? S.tr : new Float64Array(nV);
  for (let v = 0; v < nV; v++) {
    if (!S.alive[v]) continue;
    S.x[v] = ox + (X[v] - x0) * sc;
    // Panel rows run down, so y up becomes the row counted from the bottom.
    S.y[v] = H - (oy + (Y[v] - y0) * sc);
    S.tr[v] = R[v] * sc;
  }
}

function hueOf(S, v) {
  return 0.9 + S.hue + DEG_HUE[cl(effDeg(S, v), 4, 8)];
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, graph: 0.06, n: 0, clock: 0, buf: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 22, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1], 0.2, 3);
  S.graph = cl(k[3], 0, 1);
  const n = round(cl(k[2], 22, 56));
  if (n !== S.n) {
    // A new count grows a new packing from points; the first one opens
    // already grown.
    build(S, n, S.n > 0);
    S.n = n;
    // The first change comes soon after the start.
    S.clock = EVERY * 0.6;
  }
  const g = (d * S.speed) / 2;
  S.clock += g;
  if (S.clock >= EVERY) {
    S.clock -= EVERY;
    change(S);
  }
  for (let i = 0; i < 25; i++) sweep(S);
  layout(S);
  // The drawn discs ease toward the packing, about a second to settle at
  // Speed 2; a removed disc shrinks to nothing where it was.
  const e = 1 - exp(-g * 2.6);
  for (let v = 0; v < S.kind.length; v++) {
    if (S.alive[v]) {
      S.dx[v] += (S.x[v] - S.dx[v]) * e;
      S.dy[v] += (S.y[v] - S.dy[v]) * e;
      S.dr[v] += (S.tr[v] - S.dr[v]) * e;
      // The colour turns the short way round the wheel, so it stays bright
      // on the way instead of passing through grey.
      const dh = hueOf(S, v) - S.hu[v];
      S.hu[v] += (dh - round(dh)) * e;
    } else if (S.dr[v] > 0) {
      S.dr[v] -= S.dr[v] * e + g * 0.5;
      if (S.dr[v] < 0.3) S.dr[v] = 0;
    }
  }
  for (const f of S.flash) f.t += g;
  S.flash = S.flash.filter((f) => f.t < 1.4 && S.alive[f.a] && S.alive[f.b]);
}

function line(buf, x0, y0, x1, y1, fn) {
  const n = Math.ceil(max(abs(x1 - x0), abs(y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0, x = floor(mix(x0, x1, t) + 0.5), y = floor(mix(y0, y1, t) + 0.5);
    if (x >= 0 && x < W && y >= 0 && y < H) fn((y * W + x) * 3);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.kind) return;
  const buf = S.buf, gk = S.graph;
  buf.fill(0);
  const fill = 1 - 0.82 * gk;
  // Discs: a solid inside (dimmed toward Graph 1), a full-bright rim one LED
  // wide, and half an LED of black at the edge so two discs part everywhere
  // but where they kiss.
  for (let v = 0; v < S.kind.length; v++) {
    const r = S.dr[v];
    if (r < 0.6) continue;
    const cx = S.dx[v], cy = S.dy[v], ro = r - 0.45, ri = r - 1.55, c3 = hsv(S.hu[v], 0.9, 1);
    const xa = max(0, floor(cx - r)), xb = min(W - 1, floor(cx + r)), ya = max(0, floor(cy - r)), yb = min(H - 1, floor(cy + r));
    for (let y = ya; y <= yb; y++)
      for (let x = xa; x <= xb; x++) {
        const dd = sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2);
        if (dd >= ro) continue;
        const b = dd > ri ? 1 : fill, o = (y * W + x) * 3;
        buf[o] = c3[0] * b;
        buf[o + 1] = c3[1] * b;
        buf[o + 2] = c3[2] * b;
      }
  }
  // The triangulation: each edge from centre to centre through the point
  // where the two discs touch. Dark on a solid disc, white on a ring.
  const dark = 0.3 * (1 - gk), wt = 0.85 * gk;
  for (let v = 0; v < S.kind.length; v++) {
    if (!S.alive[v]) continue;
    for (const u of S.fl[v]) {
      if (u < v && S.alive[u]) continue;
      line(buf, S.dx[v], S.dy[v], S.dx[u], S.dy[u], (o) => {
        buf[o] = buf[o] * dark + wt;
        buf[o + 1] = buf[o + 1] * dark + wt;
        buf[o + 2] = buf[o + 2] * dark + wt;
      });
    }
  }
  // A new edge flashes white for a second as the two discs come to touch.
  for (const f of S.flash) {
    const a = cl(1.4 - f.t, 0, 1);
    line(buf, S.dx[f.a], S.dy[f.a], S.dx[f.b], S.dy[f.b], (o) => {
      buf[o] = mix(buf[o], 1, a);
      buf[o + 1] = mix(buf[o + 1], 1, a);
      buf[o + 2] = mix(buf[o + 2], 1, a);
    });
  }
  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, round(255 * min(1, buf[o])), round(255 * min(1, buf[o + 1])), round(255 * min(1, buf[o + 2])));
}
