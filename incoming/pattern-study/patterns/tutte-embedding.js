// ===== Patternflow pattern =====
// Title:   Tutte Embedding
// Family:  algo
// Idea:    A 3-connected planar net of 90 to 210 knots is pinned by its outer face to a tall convex polygon that fills the panel, its inner knots are thrown into a tangle whose crossing threads glow orange, and every knot keeps moving to the average of its neighbours until the crossings are gone and every face is convex, as Tutte proved, while the rim knots slide round the polygon and keep the whole net flowing.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Tutte's spring embedding (W. T. Tutte, 1963), pattern round 43
// Round:   43
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Knots=90..210, Triangles=0..1
//
// Knob 1: Hue. Turns the net's colour round the wheel. At 0 the settled net is azure with pale knots and a crossing thread glows orange; the alarm colour always sits 0.46 of the wheel from the net's, and a net that lands on orange, near 0.5, is paled and lifted so it does not read brown.
// Knob 2: Speed. How fast the knots relax and the rim turns. At 2 a tangle of 90 knots comes apart in about 3.5 seconds and one of 210 in about 4, the rim knots go once round the polygon in 75 seconds, and the net is thrown again every 20 seconds; at 0.2 everything takes ten times as long, at 3 two thirds as long.
// Knob 3: Knots, 90 to 210 inner and rim knots together, from random points 7.5 LEDs apart at 90 down to 5 at 210. Turning it builds a new net in steps of 10, thrown into a fresh tangle.
// Knob 4: Triangles. At 0 as many threads are cut as the net allows while it stays 3-connected and no face passes six sides: about 80 of 229 at 90 knots, leaving about a third of the faces triangles and the rest quadrilaterals, pentagons and hexagons. At 1 every face is a triangle. Cutting or restoring threads moves the knots to the new net's embedding, still without a crossing.
// Buttons: K1 tap throws the inner knots into a new tangle.

const W = 64, H = 128;
const { floor, min, max, sqrt, abs, sin, cos, round, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The rim: a superellipse |x/A|^p + |y/B|^p = 1 about the panel's centre,
// strictly convex for every p above 1, so knots taken round it in order
// always make a convex polygon. p breathes between 2.6 and 4.6.
const CX = 31.5, CY = 63.5, A = 31, B = 63, SAMPLES = 400;
// Seconds per rim turn, between tangles and for the throw, all at Speed 1.
const TURN = 150, EVERY = 38.6, THROW = 1.4;
// The relaxation rate after a throw, in sweeps per second at Speed 1: it
// starts at K0 and grows e-fold every KT seconds up to KMAX, so the tangle
// shrinks slowly at first and the net settles fast once it is nearly there.
const K0 = 0.067, KT = 1.78, KMAX = 15;

function rimPoint(t, p) {
  const c = cos(t), s = sin(t), e = 2 / p;
  return [CX + A * Math.sign(c) * abs(c) ** e, CY + B * Math.sign(s) * abs(s) ** e];
}

// The rim sampled by arc length: cum[k] is the length up to sample k.
function rimTable(S, p) {
  const { rx, ry, cum } = S;
  for (let k = 0; k <= SAMPLES; k++) {
    const [x, y] = rimPoint((k / SAMPLES) * TAU, p);
    rx[k] = x;
    ry[k] = y;
    cum[k] = k ? cum[k - 1] + sqrt((x - rx[k - 1]) ** 2 + (y - ry[k - 1]) ** 2) : 0;
  }
}

// The point a share u of the way round the rim, by length.
function rimAt(S, u, X, Y, i) {
  const { rx, ry, cum } = S;
  const d = (u - floor(u)) * cum[SAMPLES];
  let lo = 0, hi = SAMPLES;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const f = (d - cum[lo]) / (cum[hi] - cum[lo] || 1);
  X[i] = rx[lo] + (rx[hi] - rx[lo]) * f;
  Y[i] = ry[lo] + (ry[hi] - ry[lo]) * f;
}

// Bowyer-Watson Delaunay triangulation; triangles come back as vertex
// triples that all turn the same way.
function delaunay(px, py) {
  const n = px.length;
  const X = [...px, -3000, 3000, CX], Y = [...py, -3000, -3000, 6000];
  const circ = (a, b, c) => {
    const ax = X[a], ay = Y[a], bx = X[b], by = Y[b], cx = X[c], cy = Y[c];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
    const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d, uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
    return [a, b, c, ux, uy, (ax - ux) ** 2 + (ay - uy) ** 2];
  };
  let tri = [circ(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const keep = [], edges = new Map();
    for (const t of tri) {
      if ((X[i] - t[3]) ** 2 + (Y[i] - t[4]) ** 2 < t[5])
        for (let k = 0; k < 3; k++) {
          const a = t[k], b = t[(k + 1) % 3], key = a < b ? a * 4096 + b : b * 4096 + a;
          edges.set(key, edges.has(key) ? null : [a, b]);
        }
      else keep.push(t);
    }
    for (const e of edges.values()) if (e) keep.push(circ(e[0], e[1], i));
    tri = keep;
  }
  const out = [];
  for (const [a, b, c] of tri) {
    if (a >= n || b >= n || c >= n) continue;
    const cr = (X[b] - X[a]) * (Y[c] - Y[a]) - (Y[b] - Y[a]) * (X[c] - X[a]);
    out.push(cr > 0 ? [a, b, c] : [a, c, b]);
  }
  return out;
}

// A new net of about n knots: m on the rim, the rest scattered inside by
// dart throwing so no two sit closer than d. Tried again while the
// triangulation has a chord between two rim knots, which would make those
// two a cut pair and the net only 2-connected.
function buildNet(S, n) {
  rimTable(S, 3.4);
  const perim = S.cum[SAMPLES], area = 4 * A * B * 0.9;
  for (let tries = 0; tries < 16; tries++) {
    const d = 0.86 * sqrt(area / n), m = max(12, round(perim / (1.15 * d)));
    const px = new Float64Array(m), py = new Float64Array(m);
    for (let k = 0; k < m; k++) rimAt(S, k / m, px, py, k);
    const X = [...px], Y = [...py];
    // Inner knots keep 0.55 of a spacing inside the rim polygon.
    const inside = (x, y) => {
      for (let k = 0; k < m; k++) {
        const j = (k + 1) % m, ex = X[j] - X[k], ey = Y[j] - Y[k];
        if (((x - X[k]) * ey - (y - Y[k]) * ex) / sqrt(ex * ex + ey * ey) > -0.55 * d) return false;
      }
      return true;
    };
    for (let k = 0; k < 60 * n && X.length < n; k++) {
      const x = CX + (Math.random() * 2 - 1) * A, y = CY + (Math.random() * 2 - 1) * B;
      if (!inside(x, y)) continue;
      let ok = true;
      for (let j = 0; j < X.length && ok; j++) if ((X[j] - x) ** 2 + (Y[j] - y) ** 2 < d * d) ok = false;
      if (ok) X.push(x), Y.push(y);
    }
    const tri = delaunay(X, Y), N = X.length;
    const seen = new Map(), E = [];
    for (const t of tri)
      for (let k = 0; k < 3; k++) {
        const a = min(t[k], t[(k + 1) % 3]), b = max(t[k], t[(k + 1) % 3]), key = a * 4096 + b;
        if (!seen.has(key)) seen.set(key, E.length), E.push([a, b]);
      }
    let chord = false;
    for (const [a, b] of E) if (b < m && b - a !== 1 && !(a === 0 && b === m - 1)) chord = true;
    if (chord && tries < 15) continue;
    S.n = N;
    S.m = m;
    S.E = E;
    S.tris = tri;
    S.x = Float64Array.from(X);
    S.y = Float64Array.from(Y);
    for (const k of ["nx", "ny", "fx", "fy", "tx", "ty"]) S[k] = new Float64Array(N);
    // The order threads are tried for cutting, fixed with the net, so a
    // Triangles setting always cuts the same ones.
    const order = E.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    S.cuts = cutThreads(S, order, Infinity).cuts;
    S.heat = new Float32Array(E.length);
    S.cutsOn = -1;
    return;
  }
}

// Cut threads in the given order while the net stays 3-connected. A
// 2-connected plane graph is 3-connected exactly when any two faces meet in
// nothing, one knot, or one thread (both ends of it); a cut joins the
// thread's two faces into one, so only the joined face needs checking, and
// both ends must keep at least three threads. Faces are kept to hexagons.
// Returns the cuts in order and the faces after the first `limit` of them.
function cutThreads(S, order, limit) {
  const { E, n, m, tris } = S;
  // Face 0 is the outer face: the rim knots in order.
  const faces = [[...Array(m).keys()], ...tris.map((t) => t.slice())];
  const alive = faces.map(() => true);
  const deg = new Int32Array(n);
  for (const [a, b] of E) deg[a]++, deg[b]++;
  const at = Array.from({ length: n }, () => []);
  faces.forEach((f, i) => f.forEach((v) => at[v].push(i)));
  const step = (f, a, b) => {
    const L = f.length;
    for (let k = 0; k < L; k++) if (f[k] === a && f[(k + 1) % L] === b) return true;
    return false;
  };
  const rot = (f, s) => {
    const k = f.indexOf(s);
    return [...f.slice(k), ...f.slice(0, k)];
  };
  const cuts = [];
  for (const ei of order) {
    if (cuts.length >= limit) break;
    const [a, b] = E[ei];
    if (b < m || deg[a] < 4 || deg[b] < 4) continue;
    // The face with the step a -> b and the one with b -> a.
    let f1 = -1, f2 = -1;
    for (const fi of at[a]) {
      if (!alive[fi]) continue;
      if (step(faces[fi], a, b)) f1 = fi;
      else if (step(faces[fi], b, a)) f2 = fi;
    }
    if (f1 <= 0 || f2 <= 0 || faces[f1].length + faces[f2].length > 8) continue;
    const g1 = rot(faces[f1], b), g2 = rot(faces[f2], a);
    const joined = [...g1, ...g2.slice(1, -1)];
    let ok = true;
    const checked = new Set([f1, f2]);
    for (const v of joined) {
      for (const fi of at[v]) {
        if (!alive[fi] || checked.has(fi)) continue;
        checked.add(fi);
        const g = faces[fi], both = joined.filter((u) => g.includes(u));
        if (both.length > 2) ok = false;
        else if (both.length === 2) {
          const [p, q] = both;
          if (!((step(joined, p, q) || step(joined, q, p)) && (step(g, p, q) || step(g, q, p)))) ok = false;
        }
        if (!ok) break;
      }
      if (!ok) break;
    }
    if (!ok) continue;
    cuts.push(ei);
    deg[a]--;
    deg[b]--;
    alive[f1] = alive[f2] = false;
    faces.push(joined);
    alive.push(true);
    joined.forEach((v) => at[v].push(faces.length - 1));
  }
  return { cuts, faces: faces.filter((_, i) => alive[i]) };
}

// The live threads and each knot's neighbours (CSR) for the first k cuts.
function wire(S, k) {
  const { E, n } = S, off = new Uint8Array(E.length);
  for (let i = 0; i < k; i++) off[S.cuts[i]] = 1;
  S.live = [];
  for (let i = 0; i < E.length; i++) if (!off[i]) S.live.push(i);
  const deg = new Int32Array(n + 1);
  for (const i of S.live) deg[E[i][0] + 1]++, deg[E[i][1] + 1]++;
  for (let i = 0; i < n; i++) deg[i + 1] += deg[i];
  const adj = new Int32Array(deg[n]), fill = deg.slice();
  for (const i of S.live) {
    const [a, b] = E[i];
    adj[fill[a]++] = b;
    adj[fill[b]++] = a;
  }
  S.start = deg;
  S.adj = adj;
  S.cutsOn = k;
}

// Inner knots to random places inside the rim, the far end of a throw.
function throwTargets(S) {
  const { m, n, tx, ty } = S;
  for (let i = m; i < n; i++) {
    let x, y;
    do {
      x = (Math.random() * 2 - 1) * 0.94;
      y = (Math.random() * 2 - 1) * 0.94;
    } while (abs(x) ** 3 + abs(y) ** 3 > 0.8);
    tx[i] = CX + A * x;
    ty[i] = CY + B * y;
  }
}

function startThrow(S, instant) {
  throwTargets(S);
  S.fx.set(S.x);
  S.fy.set(S.y);
  S.phase = instant ? 1 : 0;
  S.clock = 0;
  if (instant) for (let i = S.m; i < S.n; i++) (S.x[i] = S.tx[i]), (S.y[i] = S.ty[i]);
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, tri: 0.06, t: 0, turn: 0,
    rx: new Float64Array(SAMPLES + 1), ry: new Float64Array(SAMPLES + 1), cum: new Float64Array(SAMPLES + 1),
    builtFor: -1, phase: 1, clock: 0, crossings: 0, crossing: null,
    C: new Float32Array(W * H), Al: new Float32Array(W * H), V: new Float32Array(W * H),
  };
}

// Place the rim knots for this moment: evenly by length round the rim, the
// whole ring turning, with a ripple in the spacing that travels round it.
function placeRim(S) {
  const p = 3.6 + 1.0 * sin(S.t * 0.21);
  rimTable(S, p);
  const { m } = S;
  for (let k = 0; k < m; k++) {
    const u = (k + S.turn * m + 0.3 * sin((TAU * 2 * k) / m - S.t * 0.37)) / m;
    rimAt(S, u, S.x, S.y, k);
  }
}

// Damped Jacobi sweeps: every inner knot moves the share w of the way to
// the mean of its neighbours. The fixed point is Tutte's barycentric
// embedding.
function relax(S, sweeps, w) {
  const { m, n, x, y, nx, ny, start, adj } = S;
  for (let s = 0; s < sweeps; s++) {
    for (let i = m; i < n; i++) {
      let sx = 0, sy = 0;
      const a = start[i], b = start[i + 1];
      for (let j = a; j < b; j++) (sx += x[adj[j]]), (sy += y[adj[j]]);
      const k = b - a;
      nx[i] = x[i] + w * (sx / k - x[i]);
      ny[i] = y[i] + w * (sy / k - y[i]);
    }
    for (let i = m; i < n; i++) (x[i] = nx[i]), (y[i] = ny[i]);
  }
}

// Which live threads cross another: a sweep over threads sorted by their
// left end, testing pairs whose boxes meet. Threads sharing a knot never
// count as crossing.
function countCrossings(S, flags) {
  const { E, live, x, y } = S, L = live.length;
  const lo = new Float64Array(L), idx = live.slice();
  idx.sort((p, q) => min(x[E[p][0]], x[E[p][1]]) - min(x[E[q][0]], x[E[q][1]]));
  for (let i = 0; i < L; i++) lo[i] = min(x[E[idx[i]][0]], x[E[idx[i]][1]]);
  let count = 0;
  for (let i = 0; i < L; i++) {
    const [a, b] = E[idx[i]], ax = x[a], ay = y[a], bx = x[b], by = y[b];
    const hiX = max(ax, bx), loY = min(ay, by), hiY = max(ay, by);
    for (let j = i + 1; j < L && lo[j] <= hiX; j++) {
      const [c, d] = E[idx[j]];
      if (c === a || c === b || d === a || d === b) continue;
      const cx = x[c], cy = y[c], dx = x[d], dy = y[d];
      if (max(cy, dy) < loY || min(cy, dy) > hiY) continue;
      const o1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), o2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
      if (o1 * o2 >= 0) continue;
      const o3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), o4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
      if (o3 * o4 >= 0) continue;
      count++;
      if (flags) flags[idx[i]] = flags[idx[j]] = 1;
    }
  }
  return count;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 90, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.tri = cl(k[3], 0, 1);
  const want = 90 + 10 * round((cl(k[2], 90, 210) - 90) / 10);
  const fresh = S.builtFor !== want;
  if (fresh) {
    buildNet(S, want);
    S.builtFor = want;
    S.crossing = new Uint8Array(S.E.length);
  }
  const cuts = round((1 - S.tri) * S.cuts.length);
  if (S.cutsOn !== cuts) wire(S, cuts);
  const sp = d * S.speed;
  S.t += sp;
  S.turn += sp / TURN;
  placeRim(S);
  if (fresh) startThrow(S, S.t < 0.5);
  if (input.btnPressed && input.btnPressed[0] && S.phase === 1 && S.clock > 0.3) startThrow(S, false);
  S.clock += sp;
  if (S.phase === 0) {
    // The throw: inner knots fly out to the tangle along eased paths.
    const u = ease(S.clock / THROW);
    for (let i = S.m; i < S.n; i++) {
      S.x[i] = S.fx[i] + (S.tx[i] - S.fx[i]) * u;
      S.y[i] = S.fy[i] + (S.ty[i] - S.fy[i]) * u;
    }
    if (S.clock >= THROW) (S.phase = 1), (S.clock = 0);
  } else {
    const k = min(KMAX, K0 * exp(S.clock / KT)) * sp, n = min(12, Math.ceil(k / 0.9));
    relax(S, n, k / n);
    if (S.clock > EVERY) startThrow(S, false);
  }
  S.crossing.fill(0);
  S.crossings = countCrossings(S, S.crossing);
  const fade = exp(-d / 0.35);
  for (let i = 0; i < S.E.length; i++) S.heat[i] = S.crossing[i] ? 1 : S.heat[i] * fade;
}

// --- drawing ---

function plot(buf, x, y, c) {
  if (x < 0 || x >= W || y < 0 || y >= H || c <= 0) return;
  const o = y * W + x;
  if (c > buf[o]) buf[o] = c;
}

// Xiaolin Wu's antialiased line, one LED wide, keeping the most at each LED.
function wu(buf, x0, y0, x1, y1, a) {
  const steep = abs(y1 - y0) > abs(x1 - x0);
  if (steep) [x0, y0, x1, y1] = [y0, x0, y1, x1];
  if (x0 > x1) [x0, y0, x1, y1] = [x1, y1, x0, y0];
  const dx = x1 - x0, g = dx < 1e-9 ? 0 : (y1 - y0) / dx;
  const xs = round(x0), xe = round(x1);
  let yy = y0 + g * (xs - x0);
  for (let x = xs; x <= xe; x++, yy += g) {
    const yi = floor(yy), f = yy - yi;
    if (steep) plot(buf, yi, x, (1 - f) * a), plot(buf, yi + 1, x, f * a);
    else plot(buf, x, yi, (1 - f) * a), plot(buf, x, yi + 1, f * a);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.live) return;
  const { C, Al, V, E, x, y, heat } = S;
  C.fill(0);
  Al.fill(0);
  V.fill(0);
  // A net turned orange is paled and lifted: dim orange reads brown.
  const nh = S.hue + 0.56, band = max(0, 1 - abs(nh - floor(nh) - 0.09) / 0.13), lift = 1 + 0.6 * band;
  const net = hsv(nh, 0.78 - 0.22 * band, 1).map((c) => c * lift), alarm = hsv(S.hue + 0.1, 0.92, 1), knot = hsv(S.hue + 0.53, 0.25, 1);
  for (const i of S.live) {
    const [a, b] = E[i], h = heat[i];
    if (h < 0.98) wu(C, x[a], y[a], x[b], y[b], 0.62 * (1 - h));
    if (h > 0.02) wu(Al, x[a], y[a], x[b], y[b], h);
  }
  for (let i = 0; i < S.n; i++) {
    const px = round(x[i]), py = round(y[i]);
    plot(V, px, py, 1);
  }
  for (let o = 0, py = 0; py < H; py++)
    for (let px = 0; px < W; px++, o++) {
      const c = C[o], al = Al[o], v = V[o];
      const r = net[0] * c + alarm[0] * al + knot[0] * v, g = net[1] * c + alarm[1] * al + knot[1] * v, b = net[2] * c + alarm[2] * al + knot[2] * v;
      display.setPixel(px, py, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, b)));
    }
}
