// ===== Patternflow pattern =====
// Title:   Delaunay Flips
// Family:  cells
// Idea:    Points inside a rounded hull start in a bad triangulation, a fan from one corner or a sweep, and Lawson's flips take the worst illegal edge, draw the circle that has a fourth point inside it and swap the edge for the other diagonal, a dozen a second, until no triangle's circle holds a point, every triangle filled by its smallest angle from magenta slivers to teal near-equilateral ones; then the points drift and the flips keep coming.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Lawson flips (Charles L. Lawson, 1977) toward the Delaunay triangulation (Boris Delaunay, 1934), pattern round 68
// Round:   68
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Points=30..90, Circles=0..1
//
// Knob 1: Hue. Turns the colours round a wheel that skips red, orange and yellow. At 0 slivers, illegal edges and circles with a point inside are magenta, near-equilateral triangles, legal edges and empty circles teal, and the triangles between go violet and blue; at 0.25 slivers are green and good triangles blue, at 0.5 cyan and magenta, at 0.75 blue and green.
// Knob 2: Speed. Flips 6 times Speed a second for 43 points and in proportion for more: at 2 the opening fan of 43 points needs 76 flips and is Delaunay 6.4 s after it is drawn; at 0.2 one flip every 0.83 s, each circle in plain view. In the drift that follows the points move 1.4 times Speed LEDs a second, less as they crowd, so 113 points move 0.62 of that.
// Knob 3: Points. 30 to 90 points scattered inside, plus 13 to 23 fixed on the hull, so 43 points and 71 triangles at 30 and 113 points and 201 triangles at 90. Each whole step scatters a new set; the opening fan of 113 points took 324 flips, Delaunay 10.3 s after it was drawn at Speed 2.
// Knob 4: Circles. Up to 0.08 only the circle under test and the fading circles of the last flips. Above it a growing share of all the triangles' circumcircles, all of them at 1: magenta while some point lies inside, teal when empty, so the bad start is a tangle of magenta circles and lines and the end is teal.
// Buttons: K1 tap scatters a new set in the next bad triangulation.

// Delaunay (1934): a triangulation of a point set where no point lies inside
// any triangle's circumcircle. Lawson (1977): an edge shared by triangles
// abc and dcb is illegal when d lies inside abc's circle, which is when the
// angles at a and d add up past pi. Swapping it for ad raises the smallest
// of the six angles, and flipping illegal edges in any order ends at the
// Delaunay triangulation. The hull points never move, so the hull stays
// convex and its edges are never flipped.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, sqrt, sin, cos, atan2, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sg = (v) => (v < 0 ? -1 : 1);
const frac = (v) => v - floor(v);
// A colour wheel that skips red, orange and yellow (hue 0.98 round to 0.27),
// which go maroon, brown and olive at the dim levels of the fills.
const wheel = (p) => 0.27 + 0.71 * p;

// The hull: a superellipse |x/a|^3 + |y/b|^3 = 1 round the panel's middle,
// of area AREA. Interior points keep 5 LEDs inside it.
const CX = 31.5, CY = 63.5, HA = 30.6, HB = 62.6, SP = 3, AREA = 6769;
const NMAX = 90 + 32, TMAX = 2 * NMAX;
const BUILD = 0.9, PROOF = 1.6, DRIFT = 10, ICEPS = 1e-6;
const inner = (x, y) => abs((x - CX) / (HA - 5)) ** SP + abs((y - CY) / (HB - 5)) ** SP < 1;

function hsv(h, s, v, out) {
  h = frac(h) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- Predicates. Every stored triangle has orient > 0. ----
const orient = (P, a, b, c) =>
  (P[2 * b] - P[2 * a]) * (P[2 * c + 1] - P[2 * a + 1]) - (P[2 * b + 1] - P[2 * a + 1]) * (P[2 * c] - P[2 * a]);
// > 0 when d lies inside the circle through a, b, c (orient(a, b, c) > 0).
function incircle(P, a, b, c, d) {
  const dx = P[2 * d], dy = P[2 * d + 1];
  const ax = P[2 * a] - dx, ay = P[2 * a + 1] - dy, bx = P[2 * b] - dx, by = P[2 * b + 1] - dy;
  const cx = P[2 * c] - dx, cy = P[2 * c + 1] - dy;
  const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  return ax * (by * c2 - b2 * cy) - ay * (bx * c2 - b2 * cx) + a2 * (bx * cy - by * cx);
}
// The angle at a in the triangle a, b, c.
function angle(P, a, b, c) {
  const ux = P[2 * b] - P[2 * a], uy = P[2 * b + 1] - P[2 * a + 1], vx = P[2 * c] - P[2 * a], vy = P[2 * c + 1] - P[2 * a + 1];
  return atan2(abs(ux * vy - uy * vx), ux * vx + uy * vy);
}
// The circle through a, b, c: centre x, centre y, radius.
function circum(P, a, b, c, out) {
  const ax = P[2 * a], ay = P[2 * a + 1];
  const bx = P[2 * b] - ax, by = P[2 * b + 1] - ay, cx = P[2 * c] - ax, cy = P[2 * c + 1] - ay;
  const d = 2 * (bx * cy - by * cx), b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  const ux = (cy * b2 - by * c2) / d, uy = (bx * c2 - cx * b2) / d;
  out[0] = ax + ux;
  out[1] = ay + uy;
  out[2] = sqrt(ux * ux + uy * uy);
}

// ---- A new point set: the hull points first, in order round it. ----
function scatter(S) {
  const P = S.P, n = S.n, nh = (S.nh = 8 + round(n / 6));
  // Hull points evenly by arc length.
  const M = 720, xs = [], ys = [], L = [0];
  for (let i = 0; i <= M; i++) {
    const th = (i / M) * 2 * PI, c = cos(th), s = sin(th);
    xs.push(CX + HA * sg(c) * abs(c) ** (2 / SP));
    ys.push(CY + HB * sg(s) * abs(s) ** (2 / SP));
    if (i) L.push(L[i - 1] + sqrt((xs[i] - xs[i - 1]) ** 2 + (ys[i] - ys[i - 1]) ** 2));
  }
  const off = Math.random();
  for (let k = 0, j = 0; k < nh; k++) {
    const at = ((k + off) / nh) * L[M];
    while (j < M - 1 && L[j + 1] < at) j++;
    const f = (at - L[j]) / (L[j + 1] - L[j]);
    P[2 * k] = xs[j] + (xs[j + 1] - xs[j]) * f;
    P[2 * k + 1] = ys[j] + (ys[j + 1] - ys[j]) * f;
  }
  // Interior points by dart throwing, no two closer than dmin.
  let dmin = (S.dmin = 0.72 * sqrt(AREA / (n + nh))), np = nh, tries = 0;
  while (np < nh + n) {
    const x = 1 + Math.random() * 62, y = 1 + Math.random() * 126;
    if (++tries > 3000) (dmin *= 0.9), (tries = 0);
    if (!inner(x, y)) continue;
    let ok = true;
    for (let j = 0; j < np && ok; j++) ok = (P[2 * j] - x) ** 2 + (P[2 * j + 1] - y) ** 2 >= dmin * dmin;
    if (!ok) continue;
    P[2 * np] = x;
    P[2 * np + 1] = y;
    S.th[np++] = Math.random() * 2 * PI;
  }
  S.np = np;
}

// ---- Bad triangulations, as flat lists of triangles. ----
// A fan from hull point pv: the others by angle round it, a wedge between
// each two neighbours, then a Graham scan along the fan's rim closes the
// pockets between the rim and the hull.
function fan(S, pv) {
  const P = S.P, ids = [], tris = [];
  const d2 = (i) => (P[2 * i] - P[2 * pv]) ** 2 + (P[2 * i + 1] - P[2 * pv + 1]) ** 2;
  for (let i = 0; i < S.np; i++) if (i !== pv) ids.push(i);
  ids.sort((p, q) => -orient(P, pv, p, q) || d2(p) - d2(q));
  for (let k = 0; k + 1 < ids.length; k++) tris.push(pv, ids[k], ids[k + 1]);
  const st = [ids[0], ids[1]];
  for (let k = 2; k < ids.length; k++) {
    const q = ids[k];
    for (let m = st.length; m >= 2 && orient(P, st[m - 2], st[m - 1], q) < 0; m--) tris.push(st[m - 2], q, st.pop());
    st.push(q);
  }
  return tris;
}
// A sweep: the points by distance from (qx, qy). Each new one lies outside
// the hull of those before it and is joined to every hull edge it sees.
function sweep(S, qx, qy) {
  const P = S.P, ids = [];
  const d2 = (i) => (P[2 * i] - qx) ** 2 + (P[2 * i + 1] - qy) ** 2;
  for (let i = 0; i < S.np; i++) ids.push(i);
  ids.sort((p, q) => d2(p) - d2(q));
  let hull = orient(P, ids[0], ids[1], ids[2]) > 0 ? ids.slice(0, 3) : [ids[0], ids[2], ids[1]];
  const tris = hull.slice();
  for (let k = 3; k < ids.length; k++) {
    const q = ids[k], m = hull.length, vis = hull.map((h, j) => orient(P, h, hull[(j + 1) % m], q) < 0);
    let s = 0, c = 0;
    while (s < m && !(vis[s] && !vis[(s + m - 1) % m])) s++;
    if (s === m) continue;
    for (; c < m && vis[(s + c) % m]; c++) tris.push(hull[(s + c + 1) % m], hull[(s + c) % m], q);
    const next = [hull[s], q];
    for (let j = (s + c) % m; j !== s; j = (j + 1) % m) next.push(hull[j]);
    hull = next;
  }
  return tris;
}

// Store the triangles and find each one's neighbours. Nb[3t + i] is the
// triangle across t's side opposite its vertex i, or -1 on the hull.
function link(S, tris) {
  const V = S.V, Nb = S.Nb, T = (S.T = tris.length / 3), seen = new Map();
  for (let i = 0; i < tris.length; i++) V[i] = tris[i];
  Nb.fill(-1);
  for (let e = 0; e < 3 * T; e++) {
    const t = (e / 3) | 0, b = V[3 * t + ((e + 1) % 3)], c = V[3 * t + ((e + 2) % 3)];
    const key = min(b, c) * 1024 + max(b, c), o = seen.get(key);
    if (o === undefined) seen.set(key, e);
    else (Nb[e] = (o / 3) | 0), (Nb[o] = t);
  }
}

// Fans from the corners top left and bottom right take turns with sweeps
// from the middle and from far above (which goes row by row).
function restart(S) {
  scatter(S);
  const P = S.P, kind = S.cycle % 4;
  if (kind % 2) link(S, kind === 1 ? sweep(S, CX, CY) : sweep(S, CX, -4000));
  else {
    const s = kind ? 1 : -1;
    let pv = 0;
    for (let i = 1; i < S.nh; i++) if (s * ((P[2 * i] - P[2 * pv]) / HA + (P[2 * i + 1] - P[2 * pv + 1]) / HB) > 0) pv = i;
    link(S, fan(S, pv));
  }
  Object.assign(S, { phase: 0, pt: 0, prog: 0, cand: -1, built: 0, flips: 0 });
  S.rec.length = 0;
}

// ---- Edges and flips. Edge e = 3t + i is t's side opposite vertex i. ----
// Into q: a (t's vertex i), b, c (the shared side), d across it, u, and
// d's place j in u.
function quad(S, e, q) {
  const V = S.V, t = (e / 3) | 0, i = e % 3, u = S.Nb[e];
  if (u < 0) return false;
  let j = 0;
  while (S.Nb[3 * u + j] !== t) j++;
  q[0] = V[e];
  q[1] = V[3 * t + ((i + 1) % 3)];
  q[2] = V[3 * t + ((i + 2) % 3)];
  q[3] = V[3 * u + j];
  q[4] = u;
  q[5] = j;
  return true;
}
function illegal(S, e) {
  const q = S.q, P = S.P;
  if (!quad(S, e, q)) return false;
  const [a, b, c, d] = q;
  return incircle(P, a, b, c, d) > ICEPS && orient(P, a, b, d) > 0 && orient(P, d, c, a) > 0;
}
// The illegal edge whose two opposite angles add up to the most.
function pick(S) {
  const P = S.P, q = S.q;
  let best = -1, score = PI;
  for (let e = 0; e < 3 * S.T; e++) {
    if (S.Nb[e] < ((e / 3) | 0) || !illegal(S, e)) continue;
    const s = angle(P, q[0], q[1], q[2]) + angle(P, q[3], q[2], q[1]);
    if (s > score) (score = s), (best = e);
  }
  return best;
}
// t = a b c and u = d c b become t = a b d and u = d c a.
function flip(S, e) {
  const V = S.V, Nb = S.Nb, q = S.q;
  quad(S, e, q);
  const [a, b, c, d, u, j] = q, t = (e / 3) | 0, i = e % 3;
  const nca = Nb[3 * t + ((i + 1) % 3)], nab = Nb[3 * t + ((i + 2) % 3)];
  const nbd = Nb[3 * u + ((j + 1) % 3)], ndc = Nb[3 * u + ((j + 2) % 3)];
  circum(S.P, a, b, c, S.cc);
  S.rec.push({ a, d, b, c, t, u, at: S.t, cx: S.cc[0], cy: S.cc[1], r: S.cc[2] });
  if (S.rec.length > 24) S.rec.shift();
  V.set([a, b, d], 3 * t);
  Nb.set([nbd, u, nab], 3 * t);
  V.set([d, c, a], 3 * u);
  Nb.set([nca, t, ndc], 3 * u);
  for (let k = 0; k < 3; k++) {
    if (nbd >= 0 && Nb[3 * nbd + k] === u) Nb[3 * nbd + k] = t;
    if (nca >= 0 && Nb[3 * nca + k] === t) Nb[3 * nca + k] = u;
  }
  S.flips++;
}

// ---- Drift: the interior points wander and push off close neighbours; a
// step that would fold a triangle over is taken back. ----
function drift(S, d) {
  const P = S.P, Q = S.Q, V = S.V, v0 = 1.4 * S.speed * sqrt(43 / S.np), nh = S.nh, dm = S.dmin * 0.8;
  Q.set(P);
  for (let i = nh; i < S.np; i++) {
    const x = P[2 * i], y = P[2 * i + 1];
    let th = S.th[i] + (Math.random() - 0.5) * 5 * sqrt(d);
    if (!inner(x, y)) th = atan2(CY - y, CX - x) + Math.random() - 0.5;
    S.th[i] = th;
    Q[2 * i] += cos(th) * v0 * d;
    Q[2 * i + 1] += sin(th) * v0 * d;
  }
  for (let e = 0; e < 3 * S.T; e++) {
    const t = (e / 3) | 0;
    if (S.Nb[e] <= t) continue;
    const a = V[3 * t + ((e + 1) % 3)], b = V[3 * t + ((e + 2) % 3)];
    const ex = P[2 * b] - P[2 * a], ey = P[2 * b + 1] - P[2 * a + 1], l = sqrt(ex * ex + ey * ey);
    if (l >= dm || l < 1e-6) continue;
    const f = ((dm - l) / l) * 0.6 * d * S.speed;
    if (a >= nh) (Q[2 * a] -= ex * f), (Q[2 * a + 1] -= ey * f);
    if (b >= nh) (Q[2 * b] += ex * f), (Q[2 * b + 1] += ey * f);
  }
  for (let pass = 0, bad = true; bad; pass++) {
    bad = false;
    if (pass === 6) Q.set(P);
    else
      for (let t = 0; t < S.T; t++) {
        if (orient(Q, V[3 * t], V[3 * t + 1], V[3 * t + 2]) > 0.4) continue;
        for (let k = 3 * t; k < 3 * t + 3; k++) (Q[2 * V[k]] = P[2 * V[k]]), (Q[2 * V[k] + 1] = P[2 * V[k] + 1]);
        bad = true;
      }
  }
  P.set(Q);
}

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, circ: 0.06, n: 0, nh: 0, np: 0, cycle: 0, dmin: 8, btn: false,
    P: new Float64Array(2 * NMAX), Q: new Float64Array(2 * NMAX), th: new Float64Array(NMAX),
    V: new Int32Array(3 * TMAX), Nb: new Int32Array(3 * TMAX), T: 0,
    phase: 0, pt: 0, prog: 0, cand: -1, built: 0, flips: 0, rec: [], q: [0, 0, 0, 0, 0, 0],
    acc: new Float32Array(W * H * 3), fl: new Float32Array(TMAX), c: [0, 0, 0], cc: [0, 0, 0],
  };
  return params.s;
}

// Phases: 0 the bad triangulation drawn in, 1 flipping, 2 every circle
// shown empty, 3 drifting with flips, then a new set.
export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 30, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1], 0.2, 3);
  S.circ = cl(k[3], 0, 1);
  const n = round(cl(k[2], 30, 90)), btn = !!(input.btnPressed && input.btnPressed[0]);
  if (btn && !S.btn && S.n) S.cycle++, restart(S);
  S.btn = btn;
  if (n !== S.n) (S.n = n), restart(S);
  S.t += d;
  S.pt += d;
  if (S.phase === 0) {
    S.built = min(S.T, floor((S.T * S.pt) / BUILD));
    if (S.pt >= BUILD) (S.phase = 1), (S.pt = 0), (S.built = S.T);
    return;
  }
  if (S.phase === 2) {
    if (S.pt >= PROOF) (S.phase = 3), (S.pt = 0);
    return;
  }
  if (S.phase === 3) {
    if (S.pt >= DRIFT) return S.cycle++, restart(S);
    drift(S, d);
  }
  if (S.cand >= 0 && !illegal(S, S.cand)) S.cand = -1;
  if (S.cand < 0) (S.cand = pick(S)), (S.prog = 0);
  if (S.cand >= 0) S.prog += (6 * S.speed * S.np * d) / 43;
  for (; S.prog >= 1 && S.cand >= 0; S.prog--) flip(S, S.cand), (S.cand = pick(S));
  if (S.cand < 0) {
    S.prog = 0;
    if (S.phase === 1) (S.phase = 2), (S.pt = 0);
  }
}

// ---- Drawing into acc, a float RGB buffer. ----
function put(acc, x, y, c, w, sum) {
  if (x < 0 || x >= W || y < 0 || y >= H || w <= 0) return;
  const k = (y * W + x) * 3;
  for (let i = 0; i < 3; i++) acc[k + i] = sum ? acc[k + i] + c[i] * w : max(acc[k + i], c[i] * w);
}
// A line covering two LEDs across it, in proportion (Wu's way).
function line(acc, x0, y0, x1, y1, c, w) {
  const st = abs(x1 - x0) < abs(y1 - y0);
  if (st) [x0, y0, x1, y1] = [y0, x0, y1, x1];
  if (x1 < x0) [x0, y0, x1, y1] = [x1, y1, x0, y0];
  const s = x1 > x0 ? (y1 - y0) / (x1 - x0) : 0;
  for (let x = max(0, ceil(x0)); x <= min(st ? H - 1 : W - 1, floor(x1)); x++) {
    const y = y0 + (x - x0) * s, iy = floor(y), f = y - iy;
    if (st) put(acc, iy, x, c, w * (1 - f)), put(acc, iy + 1, x, c, w * f);
    else put(acc, x, iy, c, w * (1 - f)), put(acc, x, iy + 1, c, w * f);
  }
}
// A circle: by rows where it runs steep, by columns where it runs flat.
function ring(acc, cx, cy, r, c, w) {
  if (!(r > 0.5 && r < 1e5)) return;
  const h = r * 0.7072;
  for (let y = max(0, ceil(cy - h)); y <= min(H - 1, floor(cy + h)); y++) {
    const dx = sqrt(max(0, r * r - (y - cy) ** 2));
    for (const x of [cx - dx, cx + dx]) {
      const ix = floor(x), f = x - ix;
      put(acc, ix, y, c, w * (1 - f), 1), put(acc, ix + 1, y, c, w * f, 1);
    }
  }
  for (let x = max(0, ceil(cx - h)); x <= min(W - 1, floor(cx + h)); x++) {
    const dy = sqrt(max(0, r * r - (x - cx) ** 2));
    for (const y of [cy - dy, cy + dy]) {
      const iy = floor(y), f = y - iy;
      put(acc, x, iy, c, w * (1 - f), 1), put(acc, x, iy + 1, c, w * f, 1);
    }
  }
}
// Triangle t filled by rows through the LED centres.
function fill(S, t, c) {
  const P = S.P, V = S.V, acc = S.acc, xs = [], ys = [];
  for (let k = 0; k < 3; k++) xs.push(P[2 * V[3 * t + k]]), ys.push(P[2 * V[3 * t + k] + 1]);
  for (let y = max(0, ceil(min(...ys))); y <= min(H - 1, floor(max(...ys))); y++) {
    let lo = W, hi = -1;
    for (let e = 0; e < 3; e++) {
      const ya = ys[e], yb = ys[(e + 1) % 3];
      if ((ya - y) * (yb - y) > 0 || ya === yb) continue;
      const x = xs[e] + ((y - ya) * (xs[(e + 1) % 3] - xs[e])) / (yb - ya);
      (lo = min(lo, x)), (hi = max(hi, x));
    }
    for (let x = max(0, ceil(lo)); x <= min(W - 1, floor(hi)); x++) acc.set(c, (y * W + x) * 3);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.T) return;
  const P = S.P, V = S.V, Nb = S.Nb, acc = S.acc, c = S.c, cc = S.cc, q = S.q, fl = S.fl;
  const pw = frac(0.831 + S.hue), pc = frac(0.324 + S.hue), hw = wheel(pw), hc = wheel(pc);
  const built = S.phase === 0 ? S.built : S.T;
  acc.fill(0);
  // The two triangles a flip has just made light up for a moment.
  fl.fill(0);
  for (const r of S.rec) fl[r.t] = fl[r.u] = max(fl[r.t], exp(-(S.t - r.at) / 0.3));
  // Each triangle by its smallest angle m: below 10 degrees bright in the
  // sliver colour, from 50 degrees dim in the near-equilateral one.
  for (let t = 0; t < built; t++) {
    const a = V[3 * t], b = V[3 * t + 1], d = V[3 * t + 2];
    const m = min(angle(P, a, b, d), angle(P, b, d, a), angle(P, d, a, b)), u = cl(m / 0.87, 0, 1);
    hsv(wheel(pw + (pc - pw) * u), 0.8, 0.2 + 0.36 * (1 - u) * (1 - u), c);
    for (let i = 0; i < 3; i++) c[i] += fl[t] * 0.35;
    fill(S, t, c);
  }
  // Edges: legal ones pale, illegal ones in the sliver colour, the hull dim.
  for (let e = 0; e < 3 * built; e++) {
    const t = (e / 3) | 0, u = Nb[e];
    if (u >= 0 && u < t) continue;
    const a = V[3 * t + ((e + 1) % 3)], b = V[3 * t + ((e + 2) % 3)];
    if (u < 0) hsv(hc, 0.4, 0.4, c);
    else if (illegal(S, e)) hsv(hw, 0.55, 0.85, c);
    else hsv(hc, 0.2, 0.32, c);
    line(acc, P[2 * a], P[2 * a + 1], P[2 * b], P[2 * b + 1], c, 1);
  }
  // The circumcircles the Circles knob asks for.
  const show = (S.circ - 0.08) / 0.92, dim = min(1, sqrt(71 / S.T));
  for (let t = 0; t < S.T && show > 0 && S.phase; t++) {
    const w = dim * cl((show - frac(t * 0.618034 + 0.13)) / 0.04, 0, 1);
    if (w <= 0) continue;
    const a = V[3 * t], b = V[3 * t + 1], d = V[3 * t + 2];
    let hit = false;
    for (let p = 0; p < S.np && !hit; p++) hit = p !== a && p !== b && p !== d && incircle(P, a, b, d, p) > ICEPS;
    circum(P, a, b, d, cc);
    hsv(hit ? hw : hc, hit ? 0.5 : 0.45, hit ? 0.36 : 0.3, c);
    ring(acc, cc[0], cc[1], cc[2], c, w);
  }
  // The Delaunay moment: every circle at once, every one of them empty.
  if (S.phase === 2) {
    hsv(hc, 0.4, 0.45 * sin((PI * S.pt) / PROOF) ** 2, c);
    for (let t = 0; t < S.T; t++) {
      circum(P, V[3 * t], V[3 * t + 1], V[3 * t + 2], cc);
      ring(acc, cc[0], cc[1], cc[2], c, 1);
    }
  }
  // Flips just made: the old edge and its circle fade, the new edge flashes.
  for (const r of S.rec) {
    const age = S.t - r.at;
    if (age > 1.5) continue;
    hsv(hw, 0.5, 1, c);
    line(acc, P[2 * r.b], P[2 * r.b + 1], P[2 * r.c], P[2 * r.c + 1], c, exp(-age / 0.25));
    ring(acc, r.cx, r.cy, r.r, c, 0.45 * exp(-age / 0.3));
    line(acc, P[2 * r.a], P[2 * r.a + 1], P[2 * r.d], P[2 * r.d + 1], [1, 1, 1], exp(-age / 0.45));
  }
  // The edge under test, its circle brightening toward the flip, and the
  // point inside that circle.
  if (S.cand >= 0 && quad(S, S.cand, q)) {
    const g = 0.45 + 0.55 * S.prog;
    circum(P, q[0], q[1], q[2], cc);
    hsv(hw, 0.3, 1, c);
    ring(acc, cc[0], cc[1], cc[2], c, g);
    line(acc, P[2 * q[1]], P[2 * q[1] + 1], P[2 * q[2]], P[2 * q[2] + 1], c, 1);
    ring(acc, P[2 * q[3]], P[2 * q[3] + 1], 2.2, c, 0.6 * g);
  }
  // The points, white inside and tinted on the hull.
  for (let i = 0; i < S.np; i++) {
    const x = P[2 * i], y = P[2 * i + 1], ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
    if (i < S.nh) hsv(hc, 0.35, 0.8, c);
    else c[0] = c[1] = c[2] = 1;
    put(acc, ix, iy, c, min(1, 1.6 * (1 - fx) * (1 - fy)));
    put(acc, ix + 1, iy, c, min(1, 1.6 * fx * (1 - fy)));
    put(acc, ix, iy + 1, c, min(1, 1.6 * (1 - fx) * fy));
    put(acc, ix + 1, iy + 1, c, min(1, 1.6 * fx * fy));
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 3;
      display.setPixel(x, y, (255 * min(1, acc[k])) | 0, (255 * min(1, acc[k + 1])) | 0, (255 * min(1, acc[k + 2])) | 0);
    }
}
