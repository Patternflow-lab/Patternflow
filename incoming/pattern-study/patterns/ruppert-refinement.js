// ===== Patternflow pattern =====
// Title:   Ruppert Refinement
// Family:  cells
// Idea:    A polygon with notches and holes starts as the constrained Delaunay triangulation of its corners, a panel of magenta needles, and Ruppert's refinement mends it one point at a time: an encroached boundary segment is split at its midpoint, else the worst triangle shows its circumcircle and a point goes in at the centre, or the segment that centre would encroach is split instead, Lawson flips restore the Delaunay mesh, and each triangle wears the colour of its smallest angle until the domain is green, teal and blue.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Delaunay refinement (Jim Ruppert, "A Delaunay refinement algorithm for quality 2-dimensional mesh generation", J. Algorithms, 1995), Lawson flips (Charles L. Lawson, 1977), size limit as in Triangle (Jonathan Shewchuk, 1996), pattern round 72
// Round:   72
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Bound=20..33, Domain=0..5
//
// Knob 1: Hue. Turns the angle colours round the wheel. At 0 needles are magenta, triangles halfway to the bound red, those just under it amber, and triangles past it green, then teal, then blue at 60 degrees; at 0.5 needles go green and the finished mesh magenta, red and orange.
// Knob 2: Speed. Steps a second: 0.8 times Speed at first, and 1 + n / 24 times that after n new points, since later steps are smaller. At 2 the first steps come 1.6 a second and the opening domain is finished after 15 s; at 0.2 one step every 6 s, each circle in plain view.
// Knob 3: Bound. The smallest angle a triangle may keep, 20 to 33 degrees. Triangles below it are coloured magenta to amber and get refined. Ruppert proved that the refinement stops for bounds up to 20.7 degrees when no two segments meet at less than 90, as in all six domains here; past 20.7 nothing is proved and above about 30 some inputs never finish, but these six do: 35 to 54 new points at 20, 58 to 166 at 33. Turning it up on a finished mesh starts the refinement again; turning it down only recolours it.
// Knob 4: Domain. Which of six domains comes first: a slab with crenels top and bottom, a slab with slots and a diamond hole, an octagon with three small diamond holes at each end, a slab with notches 40 LEDs deep, a slab with a slot 63 LEDs tall, and a staircase. Each finished mesh holds 4 s and hands on to the next domain.
// Buttons: K1 tap starts the next domain.

// Ruppert (1995): start from a constrained Delaunay triangulation of the
// input segments. While some segment has a vertex inside its diametral
// circle (the circle it is a diameter of), split it at its midpoint.
// Otherwise take a triangle whose smallest angle is below the bound and add
// its circumcentre, unless that centre would encroach a segment: then split
// the segment and leave the centre out. Each new point is joined to the
// triangle (or the two triangles) it falls in and Lawson flips restore the
// Delaunay property. The boundary sides are the segments and never flip.
// The worst triangle goes first. Once none is below the bound, a triangle
// whose circumcircle is wider than 22 LEDs is split the same way, a size
// limit like Triangle's, so the open middle ends as a mesh too.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sqrt, atan2, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const DEG = PI / 180;

const NMAX = 700, TMAX = 2 * NMAX + 16;
// Triangles with a circumradius under 1.1 LEDs are left alone; no domain
// gets there even at 33 degrees.
const RMIN = 1.1, RMAX = 11, INTRO = 0.7, HOLD = 4, FADE = 0.6;
const FV = 0.84, FS = 0.88;

// The domains in LEDs, outer ring first, then the holes. Every corner is 90
// degrees or more. Most corners sit near the ends, so the first
// triangulation is needles from end to end.
const rect = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
const diamond = (x, y, r) => [x, y - r, x + r, y, x, y + r, x - r, y];
// A rectangle 3..60 by 3..124 with notches d deep cut into its top edge at
// the x spans in top and into its bottom edge at those in bot.
function notched(top, bot, d) {
  const out = [3, 3];
  for (let k = 0; k < top.length; k += 2) out.push(top[k], 3, top[k], 3 + d, top[k + 1], 3 + d, top[k + 1], 3);
  out.push(60, 3, 60, 124);
  for (let k = bot.length - 2; k >= 0; k -= 2) out.push(bot[k + 1], 124, bot[k + 1], 124 - d, bot[k], 124 - d, bot[k], 124);
  out.push(3, 124);
  return out;
}
// Stairs: five steps 11 or 12 LEDs wide and 4 high down along the top and
// five up along the bottom.
const STEPS = [3, 14, 26, 37, 49, 60];
function stairs() {
  const out = [3, 3];
  for (let k = 0; k < 5; k++) out.push(STEPS[k + 1], 3 + 4 * k, STEPS[k + 1], 7 + 4 * k);
  out.length -= 2;
  out.push(60, 124);
  for (let k = 0; k < 5; k++) out.push(STEPS[4 - k], 124 - 4 * k, STEPS[4 - k], 120 - 4 * k);
  out.length -= 2;
  return out;
}
const DOMAINS = [
  [notched([9, 16, 23, 30, 37, 44, 51, 56], [7, 13, 20, 27, 34, 41, 48, 55], 6)],
  [notched([14, 19, 29, 34, 44, 49], [21, 26, 37, 42], 16), diamond(31.5, 32, 5)],
  [[17, 3, 46, 3, 60, 17, 60, 110, 46, 124, 17, 124, 3, 110, 3, 17], diamond(19, 17, 3.5), diamond(31.5, 17, 3.5), diamond(44, 17, 3.5), diamond(19, 110, 3.5), diamond(31.5, 110, 3.5), diamond(44, 110, 3.5)],
  [notched([10, 18, 45, 53], [22, 41], 40), rect(29, 16, 34, 28)],
  [notched([20, 43], [8, 16, 47, 55], 8), rect(28, 32, 35, 95)],
  [stairs()],
];

function hsv(h, s, v, out) {
  h = frac(h) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The colour of a smallest angle m: below the bound from magenta through red
// to amber, from the bound to 60 degrees green through teal to blue.
function angleHue(S, m) {
  if (m < S.bound) return S.hue + 0.84 + 0.27 * (m / S.bound);
  return S.hue + 0.31 + 0.31 * cl((m - S.bound) / (PI / 3 - S.bound), 0, 1);
}

// ---- Predicates. Every stored triangle has orient > 0. ----
const orient = (P, a, b, c) =>
  (P[2 * b] - P[2 * a]) * (P[2 * c + 1] - P[2 * a + 1]) - (P[2 * b + 1] - P[2 * a + 1]) * (P[2 * c] - P[2 * a]);
function incircle(P, a, b, c, d) {
  const dx = P[2 * d], dy = P[2 * d + 1];
  const ax = P[2 * a] - dx, ay = P[2 * a + 1] - dy, bx = P[2 * b] - dx, by = P[2 * b + 1] - dy;
  const cx = P[2 * c] - dx, cy = P[2 * c + 1] - dy;
  const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  return ax * (by * c2 - b2 * cy) - ay * (bx * c2 - b2 * cx) + a2 * (bx * cy - by * cx);
}
function angle(P, a, b, c) {
  const ux = P[2 * b] - P[2 * a], uy = P[2 * b + 1] - P[2 * a + 1], vx = P[2 * c] - P[2 * a], vy = P[2 * c + 1] - P[2 * a + 1];
  return atan2(abs(ux * vy - uy * vx), ux * vx + uy * vy);
}
function minAngle(S, t) {
  const P = S.P, V = S.V, a = V[3 * t], b = V[3 * t + 1], c = V[3 * t + 2];
  return min(angle(P, a, b, c), angle(P, b, c, a), angle(P, c, a, b));
}
function circum(P, a, b, c, out) {
  const ax = P[2 * a], ay = P[2 * a + 1];
  const bx = P[2 * b] - ax, by = P[2 * b + 1] - ay, cx = P[2 * c] - ax, cy = P[2 * c + 1] - ay;
  const d = 2 * (bx * cy - by * cx), b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  const ux = (cy * b2 - by * c2) / d, uy = (bx * c2 - cx * b2) / d;
  out[0] = ax + ux;
  out[1] = ay + uy;
  out[2] = sqrt(ux * ux + uy * uy);
}

// ---- The starting triangulation: the holes bridged into the outer ring,
// ears clipped, then Lawson flips to the constrained Delaunay one. ----
function addPoint(S, x, y) {
  const i = S.np++;
  S.P[2 * i] = x;
  S.P[2 * i + 1] = y;
  S.pb[i] = S.t;
  return i;
}
function build(S, d) {
  const P = S.P, rings = [], edges = [];
  S.np = 0;
  for (const R of DOMAINS[d]) {
    let ids = [], area = 0;
    for (let k = 0; k < R.length; k += 2) ids.push(addPoint(S, R[k], R[k + 1]));
    for (let k = 0, n = R.length; k < n; k += 2) area += R[k] * R[(k + 3) % n] - R[(k + 2) % n] * R[k + 1];
    if ((area > 0) !== !rings.length) ids = ids.reverse();
    rings.push(ids);
    for (let k = 0; k < ids.length; k++) edges.push(ids[k], ids[(k + 1) % ids.length]);
  }
  S.n0 = S.np;
  let L = rings[0];
  const holes = rings.slice(1).map((h) => {
    let m = 0;
    for (let k = 1; k < h.length; k++) if (P[2 * h[k]] > P[2 * h[m]]) m = k;
    return { h, m };
  });
  holes.sort((p, q) => P[2 * q.h[q.m]] - P[2 * p.h[p.m]]);
  for (const { h, m } of holes) {
    const v = h[m];
    let best = -1, bd = 1e9;
    for (let k = 0; k < L.length; k++) {
      const o = L[k], dd = (P[2 * o] - P[2 * v]) ** 2 + (P[2 * o + 1] - P[2 * v + 1]) ** 2;
      if (dd >= bd) continue;
      let ok = true;
      for (let j = 0; j < edges.length && ok; j += 2) {
        const p = edges[j], q = edges[j + 1];
        if (p === o || q === o || p === v || q === v) continue;
        ok = !(orient(P, o, v, p) * orient(P, o, v, q) < 0 && orient(P, p, q, o) * orient(P, p, q, v) < 0);
      }
      if (ok) (best = k), (bd = dd);
    }
    const ring = h.slice(m).concat(h.slice(0, m + 1));
    L = L.slice(0, best + 1).concat(ring, L.slice(best));
  }
  const tris = [];
  while (L.length > 3) {
    const n = L.length;
    let found = -1;
    for (let pass = 0; pass < 2 && found < 0; pass++)
      for (let i = 0; i < n && found < 0; i++) {
        const a = L[(i + n - 1) % n], v = L[i], b = L[(i + 1) % n];
        if (orient(P, a, v, b) <= 1e-9) continue;
        const e = pass ? 1e-9 : -1e-9;
        let ok = true;
        for (let j = 0; j < n && ok; j++) {
          const p = L[j];
          if (p === a || p === v || p === b) continue;
          ok = !(orient(P, a, v, p) > e && orient(P, v, b, p) > e && orient(P, b, a, p) > e);
        }
        if (ok) found = i;
      }
    if (found < 0) break;
    tris.push(L[(found + n - 1) % n], L[found], L[(found + 1) % n]);
    L.splice(found, 1);
  }
  if (L.length === 3) tris.push(...L);
  link(S, tris);
  for (let pass = 0, any = true; any && pass < 100; pass++) {
    any = false;
    for (let e = 0; e < 3 * S.T; e++) if (S.Nb[e] > ((e / 3) | 0) && illegal(S, e)) flip(S, e), (any = true);
  }
}
// Nb[3t + i] is the triangle across t's side opposite its vertex i, -1 on
// the boundary: the boundary sides are exactly the segments.
function link(S, tris) {
  const V = S.V, Nb = S.Nb, T = (S.T = tris.length / 3), seen = new Map();
  for (let i = 0; i < tris.length; i++) V[i] = tris[i];
  Nb.fill(-1);
  S.tb.fill(-9);
  for (let e = 0; e < 3 * T; e++) {
    const t = (e / 3) | 0, b = V[3 * t + ((e + 1) % 3)], c = V[3 * t + ((e + 2) % 3)];
    const key = min(b, c) * 4096 + max(b, c), o = seen.get(key);
    if (o === undefined) seen.set(key, e);
    else (Nb[e] = (o / 3) | 0), (Nb[o] = t);
  }
}

// ---- Edges and flips. Edge e = 3t + i is t's side opposite vertex i. ----
function quad(S, e, q) {
  const V = S.V, t = (e / 3) | 0, i = e % 3, u = S.Nb[e];
  if (u < 0) return false;
  let j = 0;
  while (S.Nb[3 * u + j] !== t) j++;
  q.splice(0, 6, V[e], V[3 * t + ((i + 1) % 3)], V[3 * t + ((i + 2) % 3)], V[3 * u + j], u, j);
  return true;
}
function illegal(S, e) {
  const q = S.q, P = S.P;
  if (!quad(S, e, q)) return false;
  const [a, b, c, d] = q;
  return incircle(P, a, b, c, d) > 1e-6 && orient(P, a, b, d) > 0 && orient(P, d, c, a) > 0;
}
// t = a b c and u = d c b become t = a b d and u = d c a.
function flip(S, e) {
  const V = S.V, Nb = S.Nb, q = S.q;
  quad(S, e, q);
  const [a, b, c, d, u, j] = q, t = (e / 3) | 0, i = e % 3;
  const nca = Nb[3 * t + ((i + 1) % 3)], nab = Nb[3 * t + ((i + 2) % 3)];
  const nbd = Nb[3 * u + ((j + 1) % 3)], ndc = Nb[3 * u + ((j + 2) % 3)];
  V.set([a, b, d], 3 * t);
  Nb.set([nbd, u, nab], 3 * t);
  V.set([d, c, a], 3 * u);
  Nb.set([nca, t, ndc], 3 * u);
  for (let k = 0; k < 3; k++) {
    if (nbd >= 0 && Nb[3 * nbd + k] === u) Nb[3 * nbd + k] = t;
    if (nca >= 0 && Nb[3 * nca + k] === t) Nb[3 * nca + k] = u;
  }
  S.tb[t] = S.tb[u] = S.t;
}
const repoint = (S, n, from, to) => {
  for (let k = 0; n >= 0 && k < 3; k++) if (S.Nb[3 * n + k] === from) S.Nb[3 * n + k] = to;
};
function setTri(S, t, a, b, c, na, nb, nc) {
  S.V.set([a, b, c], 3 * t);
  S.Nb.set([na, nb, nc], 3 * t);
  S.tb[t] = S.t;
}
// Lawson: flip the side facing p while it is illegal, then the two sides
// facing p of the triangles the flip made.
function legalize(S, p, stack) {
  for (let guard = 0; stack.length && guard < 4000; guard++) {
    const t = stack.pop();
    let i = 0;
    while (i < 3 && S.V[3 * t + i] !== p) i++;
    if (i === 3) continue;
    const u = S.Nb[3 * t + i];
    if (u >= 0 && illegal(S, 3 * t + i)) flip(S, 3 * t + i), stack.push(t, u);
  }
}
// p inside t = a b c: three triangles round p.
function insertIn(S, t, p) {
  const V = S.V, Nb = S.Nb, a = V[3 * t], b = V[3 * t + 1], c = V[3 * t + 2];
  const n0 = Nb[3 * t], n1 = Nb[3 * t + 1], n2 = Nb[3 * t + 2], t2 = S.T, t3 = S.T + 1;
  S.T += 2;
  setTri(S, t, a, b, p, t2, t3, n2);
  setTri(S, t2, b, c, p, t3, t, n0);
  setTri(S, t3, c, a, p, t, t2, n1);
  repoint(S, n0, t, t2);
  repoint(S, n1, t, t3);
  legalize(S, p, [t, t2, t3]);
}
// p on side e of t (opposite a, from b to c). On a segment t splits in two;
// inside, the triangle across splits too.
function insertOn(S, e, p) {
  const V = S.V, Nb = S.Nb, t = (e / 3) | 0, i = e % 3;
  const a = V[e], b = V[3 * t + ((i + 1) % 3)], c = V[3 * t + ((i + 2) % 3)];
  const nca = Nb[3 * t + ((i + 1) % 3)], nab = Nb[3 * t + ((i + 2) % 3)], u = Nb[e], t2 = S.T++;
  if (u < 0) {
    setTri(S, t, a, b, p, -1, t2, nab);
    setTri(S, t2, a, p, c, -1, nca, t);
    repoint(S, nca, t, t2);
    return legalize(S, p, [t, t2]);
  }
  let j = 0;
  while (Nb[3 * u + j] !== t) j++;
  const d = V[3 * u + j], nbd = Nb[3 * u + ((j + 1) % 3)], ndc = Nb[3 * u + ((j + 2) % 3)], u2 = S.T++;
  setTri(S, t, a, b, p, u2, t2, nab);
  setTri(S, t2, a, p, c, u, nca, t);
  setTri(S, u, d, c, p, t2, u2, ndc);
  setTri(S, u2, d, p, b, t, nbd, u);
  repoint(S, nca, t, t2);
  repoint(S, nbd, u, u2);
  legalize(S, p, [t, t2, u, u2]);
}

// ---- Ruppert's tests. ----
const segEnds = (S, e) => [S.V[3 * ((e / 3) | 0) + ((e + 1) % 3)], S.V[3 * ((e / 3) | 0) + ((e + 2) % 3)]];
// The longest segment with a point from p0 up to p1 inside its diametral
// circle, or -1. Segments under 2.2 LEDs are not split again.
function encroached(S, p0, p1) {
  const P = S.P;
  let best = -1, bl = 0;
  for (let e = 0; e < 3 * S.T; e++) {
    if (S.Nb[e] >= 0) continue;
    const [a, b] = segEnds(S, e), l = (P[2 * a] - P[2 * b]) ** 2 + (P[2 * a + 1] - P[2 * b + 1]) ** 2;
    if (l < 4 * RMIN * RMIN || l <= bl) continue;
    for (let p = p0; p < p1; p++) {
      const v = (P[2 * p] - P[2 * a]) * (P[2 * p] - P[2 * b]) + (P[2 * p + 1] - P[2 * a + 1]) * (P[2 * p + 1] - P[2 * b + 1]);
      if (v < -1e-7 && p !== a && p !== b) (bl = l), (best = e);
    }
  }
  return best;
}
// The triangle with the smallest angle below the bound, or when there is
// none the one with the widest circle past RMAX, or -1.
function worst(S) {
  let best = -1, bm = S.bound, br = RMAX;
  for (let t = 0; t < S.T; t++) {
    const m = minAngle(S, t);
    if (m >= bm) continue;
    circum(S.P, S.V[3 * t], S.V[3 * t + 1], S.V[3 * t + 2], S.cc);
    if (S.cc[2] >= RMIN) (best = t), (bm = m);
  }
  for (let t = 0; t < S.T && best < 0; t++) {
    circum(S.P, S.V[3 * t], S.V[3 * t + 1], S.V[3 * t + 2], S.cc);
    if (S.cc[2] > br) (best = t), (br = S.cc[2]);
  }
  return best;
}
// Walk from t toward point p: the triangle that holds it as { t }, the side
// it lies on as { e }, or the segment in the way as { seg }.
function locate(S, t, p) {
  const P = S.P, V = S.V;
  for (let g = 0; g < 4 * S.T + 8; g++) {
    let next = -1, on = -1;
    for (let i = 0; i < 3 && next < 0; i++) {
      const b = V[3 * t + ((i + 1) % 3)], c = V[3 * t + ((i + 2) % 3)];
      const o = orient(P, b, c, p) / sqrt((P[2 * b] - P[2 * c]) ** 2 + (P[2 * b + 1] - P[2 * c + 1]) ** 2);
      if (o < -1e-7) next = i;
      else if (o < 1e-7) on = i;
    }
    const e = 3 * t + (next < 0 ? on : next);
    if (next < 0 && on < 0) return { t };
    if (S.Nb[e] < 0) return { seg: e };
    if (next < 0) return { e };
    t = S.Nb[e];
  }
  return null;
}

// The next step, worked out before it is shown: { split } with the segment,
// and the rejected centre when there is one, or { t } and its centre.
function plan(S) {
  const P = S.P, V = S.V, cc = S.cc;
  if (S.np >= NMAX - 2) return null;
  const seg = encroached(S, 0, S.np);
  if (seg >= 0) return splitPlan(S, seg, null);
  const t = worst(S);
  if (t < 0) return null;
  circum(P, V[3 * t], V[3 * t + 1], V[3 * t + 2], cc);
  const tri = [V[3 * t], V[3 * t + 1], V[3 * t + 2]], at = { t, tri, cx: cc[0], cy: cc[1], r: cc[2] };
  // The centre waits in the next free slot while it is tested.
  P[2 * S.np] = cc[0];
  P[2 * S.np + 1] = cc[1];
  const by = encroached(S, S.np, S.np + 1);
  if (by >= 0) return splitPlan(S, by, at);
  const where = locate(S, t, S.np);
  if (!where) return null;
  if (where.seg !== undefined) return splitPlan(S, where.seg, at);
  return Object.assign(at, { where });
}
function splitPlan(S, e, from) {
  const P = S.P, [a, b] = segEnds(S, e);
  const mx = (P[2 * a] + P[2 * b]) / 2, my = (P[2 * a + 1] + P[2 * b + 1]) / 2;
  return { split: e, a, b, mx, my, sr: sqrt((P[2 * a] - P[2 * b]) ** 2 + (P[2 * a + 1] - P[2 * b + 1]) ** 2) / 2, from };
}
function execute(S, pl) {
  if (pl.split !== undefined) return insertOn(S, pl.split, addPoint(S, pl.mx, pl.my));
  const p = addPoint(S, pl.cx, pl.cy);
  if (pl.where.t !== undefined) insertIn(S, pl.where.t, p);
  else insertOn(S, pl.where.e, p);
}

function restart(S, d) {
  S.dom = d;
  build(S, d);
  Object.assign(S, { phase: 0, pt: 0, u: 0, pl: null });
}

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, bound: 20 * DEG, dom: -1, k4: -1, btn: false, n0: 0, np: 0, T: 0,
    P: new Float64Array(2 * NMAX), pb: new Float32Array(NMAX),
    V: new Int32Array(3 * TMAX), Nb: new Int32Array(3 * TMAX), tb: new Float32Array(TMAX),
    phase: 0, pt: 0, u: 0, pl: null, q: [0, 0, 0, 0, 0, 0], cc: [0, 0, 0],
    acc: new Float32Array(W * H * 3), c: [0, 0, 0],
  };
  return params.s;
}

// Phases: 0 the corners' triangulation fades in, 1 refining, 2 holding the
// finished mesh, 3 fading out to the next domain.
export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 20, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1], 0.2, 3);
  const bound = cl(k[2], 20, 33) * DEG, k4 = floor(cl(k[3], 0, 5.999));
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  if (k4 !== S.k4) (S.k4 = k4), restart(S, k4);
  else if (btn && !S.btn) restart(S, (S.dom + 1) % DOMAINS.length);
  S.btn = btn;
  if (abs(bound - S.bound) > 1e-6) {
    S.bound = bound;
    if (S.phase === 1 && S.u < 0.5) S.pl = plan(S);
    if (S.phase === 2) (S.phase = 1), (S.u = 0), (S.pl = plan(S));
  }
  S.t += d;
  S.pt += d;
  if (S.phase === 0) {
    if (S.pt >= INTRO) (S.phase = 1), (S.pt = 0), (S.u = 0), (S.pl = plan(S));
    return;
  }
  if (S.phase === 2) {
    if (S.pt >= HOLD) (S.phase = 3), (S.pt = 0);
    return;
  }
  if (S.phase === 3) {
    if (S.pt >= FADE) restart(S, (S.dom + 1) % DOMAINS.length);
    return;
  }
  const rate = 0.8 * S.speed * (1 + (S.np - S.n0) / 24);
  let left = d * rate;
  while (left > 0 && S.phase === 1) {
    if (!S.pl) {
      (S.phase = 2), (S.pt = 0);
      break;
    }
    const step = min(left, 1 - S.u);
    if (S.u < 0.5 && S.u + step >= 0.5) execute(S, S.pl);
    S.u += step;
    left -= step;
    if (S.u >= 1 - 1e-9) (S.u = 0), (S.pl = plan(S));
  }
}

// ---- Drawing into acc, a float RGB buffer. ----
function fill(S, t, c) {
  const P = S.P, V = S.V, acc = S.acc, xs = [0, 0, 0], ys = [0, 0, 0];
  for (let k = 0; k < 3; k++) (xs[k] = P[2 * V[3 * t + k]]), (ys[k] = P[2 * V[3 * t + k] + 1]);
  for (let y = max(0, ceil(min(ys[0], ys[1], ys[2]))); y <= min(H - 1, floor(max(ys[0], ys[1], ys[2]))); y++) {
    let lo = W, hi = -1;
    for (let e = 0; e < 3; e++) {
      const ya = ys[e], yb = ys[(e + 1) % 3];
      if ((ya - y) * (yb - y) > 0 || ya === yb) continue;
      const x = xs[e] + ((y - ya) * (xs[(e + 1) % 3] - xs[e])) / (yb - ya);
      (lo = min(lo, x)), (hi = max(hi, x));
    }
    for (let x = max(0, ceil(lo - 0.5)); x <= min(W - 1, floor(hi + 0.5)); x++) acc.set(c, (y * W + x) * 3);
  }
}
// Mode 0 darkens what is there by w, mode 1 moves it toward c by w.
function put(acc, x, y, c, w, mode) {
  if (x < 0 || x >= W || y < 0 || y >= H || w <= 0) return;
  const k = (y * W + x) * 3;
  w = min(1, w);
  for (let i = 0; i < 3; i++) acc[k + i] = mode ? acc[k + i] + (c[i] - acc[k + i]) * w : acc[k + i] * (1 - c[i] * w);
}
function line(acc, x0, y0, x1, y1, c, w, mode) {
  const st = abs(x1 - x0) < abs(y1 - y0);
  if (st) [x0, y0, x1, y1] = [y0, x0, y1, x1];
  if (x1 < x0) [x0, y0, x1, y1] = [x1, y1, x0, y0];
  const s = x1 > x0 ? (y1 - y0) / (x1 - x0) : 0;
  for (let x = max(0, ceil(x0)); x <= min(st ? H - 1 : W - 1, floor(x1)); x++) {
    const y = y0 + (x - x0) * s, iy = floor(y), f = y - iy;
    if (st) put(acc, iy, x, c, w * (1 - f), mode), put(acc, iy + 1, x, c, w * f, mode);
    else put(acc, x, iy, c, w * (1 - f), mode), put(acc, x, iy + 1, c, w * f, mode);
  }
}
// A circle: by rows where it runs steep, by columns where it runs flat.
function ring(acc, cx, cy, r, c, w) {
  if (!(r > 0.5 && r < 1e4)) return;
  const h = r * 0.7072;
  for (let ax = 0; ax < 2; ax++) {
    const a0 = ax ? cx : cy, b0 = ax ? cy : cx, n = ax ? W : H;
    for (let u = max(0, ceil(a0 - h)); u <= min(n - 1, floor(a0 + h)); u++) {
      const dv = sqrt(max(0, r * r - (u - a0) ** 2));
      for (const v of [b0 - dv, b0 + dv]) {
        const iv = floor(v), f = v - iv;
        if (ax) put(acc, u, iv, c, w * (1 - f), 1), put(acc, u, iv + 1, c, w * f, 1);
        else put(acc, iv, u, c, w * (1 - f), 1), put(acc, iv + 1, u, c, w * f, 1);
      }
    }
  }
}
function dot(acc, x, y, c, w) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  for (let k = 0; k < 4; k++)
    put(acc, ix + (k & 1), iy + (k >> 1), c, w * min(1, 1.6 * (k & 1 ? fx : 1 - fx) * (k >> 1 ? fy : 1 - fy)), 1);
}
// The line from point a to point b.
const edge = (S, a, b, c, w, mode) => line(S.acc, S.P[2 * a], S.P[2 * a + 1], S.P[2 * b], S.P[2 * b + 1], c, w, mode);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.T) return;
  const P = S.P, V = S.V, Nb = S.Nb, acc = S.acc, c = S.c, pl = S.pl;
  const white = [1, 1, 1], dark = [0.62, 0.62, 0.62];
  acc.fill(0);
  // Fills by smallest angle, all at one brightness; a triangle just made
  // starts pale and takes its colour over 0.4 s.
  for (let t = 0; t < S.T; t++) {
    const age = S.t - S.tb[t];
    hsv(angleHue(S, minAngle(S, t)), FS * (1 - 0.5 * exp(-age / 0.3)), FV, c);
    fill(S, t, c);
  }
  // Inner edges darken what they cross; the segments are pale lines.
  for (let e = 0; e < 3 * S.T; e++) {
    const t = (e / 3) | 0, u = Nb[e];
    if (u >= 0 && u < t) continue;
    const a = V[3 * t + ((e + 1) % 3)], b = V[3 * t + ((e + 2) % 3)];
    edge(S, a, b, u >= 0 ? dark : white, u >= 0 ? 1 : 0.85, u < 0);
  }
  // The step under way: before its midpoint the circle grows bright, after
  // it the new point is in and the circle fades.
  if (S.phase === 1 && pl) {
    const g = S.u < 0.5 ? 0.25 + 1.5 * S.u : 1 - 1.6 * (S.u - 0.5);
    const from = pl.split !== undefined ? pl.from : pl;
    if (from) {
      for (let k = 0; k < 3 && S.u < 0.5; k++) edge(S, from.tri[k], from.tri[(k + 1) % 3], white, g, 1);
      ring(acc, from.cx, from.cy, from.r, white, 0.8 * g);
      if (S.u < 0.5) dot(acc, from.cx, from.cy, pl.split !== undefined ? dark : white, g);
    }
    if (pl.split !== undefined) {
      hsv(S.hue + 0.11, 0.5, 1, c);
      ring(acc, pl.mx, pl.my, pl.sr, c, g);
      if (S.u < 0.5) dot(acc, pl.mx, pl.my, white, g);
    }
  }
  // New points shine white for a moment.
  for (let i = S.n0; i < S.np; i++) {
    const w = exp(-(S.t - S.pb[i]) / 0.5);
    if (w > 0.02) dot(acc, P[2 * i], P[2 * i + 1], white, w);
  }
  const g = S.phase === 0 ? min(1, S.pt / 0.5) : S.phase === 3 ? max(0, 1 - S.pt / FADE) : 1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 3;
      display.setPixel(x, y, (255 * g * min(1, acc[k])) | 0, (255 * g * min(1, acc[k + 1])) | 0, (255 * g * min(1, acc[k + 2])) | 0);
    }
}
