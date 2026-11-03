// ===== Patternflow pattern =====
// Title:   Schönhardt Polyhedron
// Family:  space
// Idea:    A tall glass triangular prism turns slowly while its top twists against its bottom: twisted one way the solid is convex and all 15 tetrahedra on its six corners fit inside it, untwisted it splits into three of them, and twisted the other way its side faces fold inward along three gold creases while the three other top-to-bottom diagonals leave the solid and hang pink across the valleys, so the count at the foot, tested from the shape in every frame, falls to 0.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the twisted triangular prism that cannot be cut into tetrahedra without new vertices (Erich Schönhardt, Mathematische Annalen, 1928); pattern round 102
// Round:   102
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Twist=-1..1, View=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the glass is azure, the folded edges gold, a diagonal inside the solid green and one outside it pink, and the three pieces of the cut azure, violet and sea green; at 0.5 the glass is amber, the folds blue, an inside diagonal magenta and an outside one sea green.
// Knob 2: Speed. At 2 the prism turns once in 24 s and the twist runs its cycle in 24 s: 6 s folded at the full twist, 3 s untwisting, 4.5 s as a plain prism while its three tetrahedra slide apart and back, 3 s twisting the other way to 0.6 of the full twist, where the solid is convex, 3 s there and 4.5 s back to the fold; every time goes as 2 / Speed.
// Knob 3: Twist. The full twist of the top triangle against the bottom, 44 + 14 x Twist degrees: 44 at the opening, 30 at -1 and 58 at 1, where the three creases pass 0.017 of the radius from the axis at mid-height; at 60 they would meet there and the faces cross.
// Knob 4: View. The camera's height, as the angle it looks down: 32 + 22 x View degrees, so 33.3 at the opening 0.06, 10 at -1, where the top and bottom triangles are thin slivers, and 54 at 1, looking down into the valleys.

// The prism. Bottom corners A0 A1 A2 on the unit circle at 120 degrees,
// top corners B0 B1 B2 above them at height HT, turned by the twist th. The
// side face over A_i A_(i+1) is cut by the diagonal A_i B_(i+1) into two
// triangles, so the solid has eight triangular faces. For th > 0 that
// diagonal spans 120 + th degrees of the circle and the other, A_(i+1) B_i,
// only 120 - th; the solid's surface keeps the long one, and the face pair
// folds in along it. At mid-height the crease sits cos(60 + th / 2) of the
// radius from the axis, 0.14 at 44 degrees, and the short diagonal crosses
// right over it at cos(60 - th / 2), 0.79: a string across a valley.
// Every one of the 15 sets of four corners has one of those three short
// diagonals among its six edges (three bottom corners and one top, or the
// other way, or two and two, which leave out at most one index on each
// side), so no tetrahedron on the corners fits inside, and a cut into
// tetrahedra would need a new vertex. Twisted the other way the solid is the
// convex hull of its corners and all 15 fit; at th = 0 the side faces are
// flat rectangles, three of the sets are flat, and the other 12 fit.
//
// None of that is written into the code. Each frame (when the twist has
// moved) tests every set: a tetrahedron of no volume is flat, and otherwise
// 35 points on its edges, faces and middle, each nudged 0.2% towards its
// centre, are tested against the solid by the winding number, the sum of
// the solid angles its eight faces subtend at the point (A. van Oosterom
// and J. Strackee's formula, 1983), 1 inside and 0 outside. The diagonals
// are tested the same way at 13 points, nudged towards the centre, and drawn
// point by point in green or pink; a folded edge is gold where one of its
// two faces has the other's far corner on its outer side.
//
// Drawing: every face is glass, 72% opaque from the front and 35% from
// behind, flat-shaded by a light from the left, the faces sorted back to
// front in each LED. The sections of the solid at seven heights are drawn
// on it, each a star of six sides that bends in at the creases. Lines carry
// their depth and dim to 30% behind each front face. The cut at th = 0 is the prism split into A0A1A2B0,
// A1A2B0B1 and A2B0B1B2, which slide 0.3 out sideways, each towards the
// corner its middle leans to, and back.

const W = 64, H = 128;
const { floor, ceil, min, max, sin, cos, sqrt, abs, atan2, round, hypot, PI } = Math;
const D2R = PI / 180;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (u) => u * u * (3 - 2 * u);
const HT = 4.2, DC = 7, TN = 0.6, FOOT = 113;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => hypot(a[0], a[1], a[2]);
const mid = (P) => P.reduce((s, p) => add3(s, p, 1 / P.length), [0, 0, 0]);

function corners(th) {
  const V = [];
  for (let i = 0; i < 6; i++) {
    const a = (2 * PI * (i % 3)) / 3 + PI / 2 + (i < 3 ? 0 : th);
    V.push([cos(a), i < 3 ? -HT / 2 : HT / 2, sin(a)]);
  }
  return V;
}

// The faces, wound so that their normals point out of the prism at th = 0;
// the winding holds for every twist, since the faces only bend.
const FACES = [[0, 1, 2], [3, 4, 5]];
for (let i = 0; i < 3; i++) {
  const j = (i + 1) % 3;
  FACES.push([i, j, 3 + j], [i, 3 + j, 3 + i]);
}
{
  const V = corners(0);
  for (const f of FACES) {
    const n = cross(sub(V[f[1]], V[f[0]]), sub(V[f[2]], V[f[0]]));
    if (dot(n, mid(f.map((k) => V[k]))) < 0) f.reverse();
  }
}
// Edges: ring (top and bottom), post A_i B_i, fold A_i B_(i+1); and the
// three short diagonals A_(i+1) B_i, which are not edges.
const EDGES = [];
for (let i = 0; i < 3; i++) {
  const j = (i + 1) % 3;
  EDGES.push([i, j, 0], [3 + i, 3 + j, 0], [i, 3 + i, 1], [i, 3 + j, 2]);
}
const DIAG = [0, 1, 2].map((i) => [(i + 1) % 3, 3 + i]);
const QUADS = [];
for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) for (let c = b + 1; c < 6; c++) for (let d = c + 1; d < 6; d++) QUADS.push([a, b, c, d]);
const CUT = [[0, 1, 2, 3], [1, 2, 3, 4], [2, 3, 4, 5]];

// Winding number of the surface about p: 1 inside, 0 outside.
function wind(p, V) {
  let s = 0;
  for (const f of FACES) {
    const a = sub(V[f[0]], p), b = sub(V[f[1]], p), c = sub(V[f[2]], p);
    const la = len(a), lb = len(b), lc = len(c);
    s += 2 * atan2(dot(a, cross(b, c)), la * lb * lc + dot(a, b) * lc + dot(a, c) * lb + dot(b, c) * la);
  }
  return abs(s) / (4 * PI);
}
const inside = (p, toward, V) => wind(add3(p, sub(toward, p), 0.002), V) > 0.5;

// 1 inside, 0 flat, -1 not inside, for each of the 15 sets.
function census(V) {
  return QUADS.map((q) => {
    const P = q.map((k) => V[k]);
    const vol = dot(sub(P[1], P[0]), cross(sub(P[2], P[0]), sub(P[3], P[0]))) / 6;
    if (abs(vol) < 1e-5) return 0;
    const g = mid(P), pts = [g];
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++) {
        for (let t = 1; t < 6; t++) pts.push(add3(P[i], sub(P[j], P[i]), t / 6));
        for (let k = j + 1; k < 4; k++) pts.push(mid([P[i], P[j], P[k]]));
      }
    for (const p of pts) if (!inside(p, g, V)) return -1;
    return 1;
  });
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

const DIG = { 0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [7, 1, 7, 4, 7], 3: [7, 1, 3, 1, 7], 4: [5, 5, 7, 1, 1], 5: [7, 4, 7, 1, 7], 6: [7, 4, 7, 5, 7], 7: [7, 1, 2, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 7], "/": [1, 1, 2, 4, 4] };

export function setup(params) {
  params.s = {
    buf: new Float32Array(W * H * 3), cnt: new Uint8Array(W * H), zl: new Float32Array(W * H * 12), fl: new Uint8Array(W * H * 12), fid: new Uint8Array(W * H * 12),
    yaw: 0, ph: 0, hue: 0, tmax: 44, view: 0.06, fitView: null, fit: null, cTh: null, cen: null, diag: null,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.tmax = 44 + 14 * cl(k[2] || 0, -1, 1);
  S.view = cl(k[3] == null ? 0.06 : k[3], -1, 1);
  S.yaw = (S.yaw + (d * speed * 2 * PI) / 48) % (2 * PI);
  S.ph = (S.ph + (d * speed) / 48) % 1;
}

// The twist (as a share of the full twist) and the cut's spread at phase u.
function cycle(u) {
  if (u < 0.25) return [1, 0];
  if (u < 0.375) return [1 - sm((u - 0.25) / 0.125), 0];
  if (u < 0.5625) return [0, sin((PI * (u - 0.375)) / 0.1875) ** 2];
  if (u < 0.6875) return [-TN * sm((u - 0.5625) / 0.125), 0];
  if (u < 0.8125) return [-TN, 0];
  return [-TN + (1 + TN) * sm((u - 0.8125) / 0.1875), 0];
}

// Turn about the vertical by yaw, then tip by el so the eye looks down; the
// eye sits at depth DC, and depth grows towards it.
function rot(p, yaw, el) {
  const cy = cos(yaw), sy = sin(yaw), ce = cos(el), se = sin(el);
  const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy;
  return [x1, p[1] * ce - z1 * se, p[1] * se + z1 * ce];
}
function cam(p, yaw, el) {
  const q = rot(p, yaw, el), s = DC / (DC - q[2]);
  return [q[0] * s, q[1] * s, q[2]];
}

// Scale so that every turn and twist fits columns 2 to 61 and rows 2 to FOOT - 3.
function fit(S, el) {
  if (S.fitView === S.view) return S.fit;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < 24; i++)
    for (const th of [-35, 0, 44, 58])
      for (const p of corners(th * D2R)) {
        const q = cam(p, (i * PI) / 12, el);
        x0 = min(x0, q[0]); x1 = max(x1, q[0]); y0 = min(y0, q[1]); y1 = max(y1, q[1]);
      }
  const K = min(60 / (x1 - x0), (FOOT - 5) / (y1 - y0));
  S.fit = { K, cx: 32 - (K * (x0 + x1)) / 2, cy: 2 + (FOOT - 5) / 2 + (K * (y0 + y1)) / 2 };
  S.fitView = S.view;
  return S.fit;
}

function put(buf, x, y, c, a) {
  const p = (y * W + x) * 3;
  buf[p] += (c[0] - buf[p]) * a;
  buf[p + 1] += (c[1] - buf[p + 1]) * a;
  buf[p + 2] += (c[2] - buf[p + 2]) * a;
}

// How much of a line at depth z shows through the faces in front of it.
function seen(S, x, y, z) {
  const i = y * W + x, n = S.cnt[i];
  let v = 1;
  for (let k = 0; k < n; k++) if (S.zl[i * 12 + k] > z + 0.04) v *= S.fl[i * 12 + k] ? 0.3 : 0.8;
  return v;
}

// A segment wid LEDs wide from screen point a to b (x, y, depth), dashed
// with period dash LEDs when dash > 0.
function seg(S, a, b, wid, c, al, dash) {
  const buf = S.buf, r = wid / 2 + 0.5, dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9, L = sqrt(L2);
  const x0 = max(0, floor(min(a[0], b[0]) - r)), x1 = min(W - 1, ceil(max(a[0], b[0]) + r));
  const y0 = max(0, floor(min(a[1], b[1]) - r)), y1 = min(H - 1, ceil(max(a[1], b[1]) + r));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - a[0], py = y + 0.5 - a[1], t = cl((px * dx + py * dy) / L2, 0, 1);
      let cov = cl(wid / 2 + 0.5 - hypot(px - t * dx, py - t * dy), 0, 1);
      if (dash > 0) cov *= cl(2.2 * cos((2 * PI * t * L) / dash) + 0.6, 0, 1);
      if (cov > 0) put(buf, x, y, c, cov * al * seen(S, x, y, a[2] + (b[2] - a[2]) * t));
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { buf, cnt, zl, fl, fid } = S;
  buf.fill(0);
  cnt.fill(0);
  const [tw, spread] = cycle(S.ph), th = tw * S.tmax * D2R, el = (32 + 22 * S.view) * D2R, F = fit(S, el);
  const V = corners(th);
  if (S.cTh !== th) {
    S.cTh = th;
    S.cen = census(V);
    S.diag = DIAG.map(([a, b]) => {
      const out = [];
      for (let t = 0; t <= 12; t++) {
        const p = add3(V[a], sub(V[b], V[a]), t / 12);
        out.push(inside(p, [0, 0, 0], V));
      }
      return out;
    });
    // A fold edge is reflex when the far corner of one face lies outside the other's plane.
    S.reflex = EDGES.map(([a, b]) => {
      const fs = FACES.filter((f) => f.includes(a) && f.includes(b));
      const n = cross(sub(V[fs[0][1]], V[fs[0][0]]), sub(V[fs[0][2]], V[fs[0][0]]));
      const far = fs[1].find((k) => k !== a && k !== b);
      return dot(n, sub(V[far], V[a])) > 1e-6;
    });
  }
  const P = (p) => {
    const q = cam(p, S.yaw, el);
    return [F.cx + F.K * q[0], F.cy - F.K * q[1], q[2]];
  };
  const L = [-0.8, 0.35, 0.5], Ln = 1 / len(L), hue = S.hue;
  const glass = [hsv(hue + 0.58, 0.7, 1), hsv(hue + 0.76, 0.6, 1), hsv(hue + 0.42, 0.7, 0.95)];
  const gold = hsv(hue + 0.12, 0.65, 1), green = hsv(hue + 0.33, 0.75, 1), pink = hsv(hue + 0.92, 0.6, 1), pale = hsv(hue + 0.6, 0.18, 1);

  // Solids: the prism, or at th = 0 with spread > 0 its three pieces.
  const solids = [];
  if (spread > 0.001) {
    const g = mid(V);
    CUT.forEach((q, n) => {
      const pc = q.map((k) => V[k]), m = sub(mid(pc), g), off = [m[0], 0, m[2]], o = 0.3 * spread / (len(off) || 1);
      const pts = pc.map((p) => add3(p, off, o)), gc = mid(pts), tris = [];
      for (let i = 0; i < 4; i++) {
        const t = [0, 1, 2, 3].filter((k) => k !== i);
        const nn = cross(sub(pts[t[1]], pts[t[0]]), sub(pts[t[2]], pts[t[0]]));
        tris.push(dot(nn, sub(pts[t[0]], gc)) < 0 ? [t[0], t[2], t[1]] : t);
      }
      solids.push({ pts, tris, col: glass[n], edges: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]] });
    });
  } else solids.push({ pts: V, tris: FACES, col: glass[0], edges: null });

  // Faces into each LED's list.
  const faceCol = [];
  for (const so of solids) {
    const sp = so.pts.map(P);
    for (const f of so.tris) {
      const a = sp[f[0]], b = sp[f[1]], c = sp[f[2]];
      const nw = cross(sub(so.pts[f[1]], so.pts[f[0]]), sub(so.pts[f[2]], so.pts[f[0]]));
      const n = rot(nw, S.yaw, el), nl = len(n) || 1;
      const front = dot(n, sub([0, 0, DC], rot(so.pts[f[0]], S.yaw, el))) > 0;
      const lam = max(0, (dot(n, L) * Ln) / nl), sh = front ? 0.27 + 0.73 * lam : 0.12 + 0.3 * lam;
      const id = faceCol.length;
      faceCol.push([so.col[0] * sh, so.col[1] * sh, so.col[2] * sh, front ? 0.72 : 0.35]);
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (abs(area) < 1e-6) continue;
      const bx0 = max(0, floor(min(a[0], b[0], c[0]))), bx1 = min(W - 1, ceil(max(a[0], b[0], c[0])));
      const by0 = max(0, floor(min(a[1], b[1], c[1]))), by1 = min(FOOT - 1, ceil(max(a[1], b[1], c[1])));
      for (let y = by0; y <= by1; y++)
        for (let x = bx0; x <= bx1; x++) {
          const px = x + 0.5, py = y + 0.5;
          const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
          const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
          const i = y * W + x, n = cnt[i];
          if (n >= 12) continue;
          zl[i * 12 + n] = w0 * a[2] + w1 * b[2] + w2 * c[2];
          fl[i * 12 + n] = front ? 1 : 0;
          fid[i * 12 + n] = id;
          cnt[i] = n + 1;
        }
    }
  }
  // Composite each LED's faces back to front.
  for (let i = 0; i < W * H; i++) {
    const n = cnt[i];
    if (!n) continue;
    const o = i * 12, idx = [];
    for (let k = 0; k < n; k++) idx.push(k);
    idx.sort((p, q) => zl[o + p] - zl[o + q]);
    let r = 0, g = 0, b = 0;
    for (const k of idx) {
      const c = faceCol[fid[o + k]];
      r += (c[0] - r) * c[3]; g += (c[1] - g) * c[3]; b += (c[2] - b) * c[3];
    }
    buf[i * 3] = r; buf[i * 3 + 1] = g; buf[i * 3 + 2] = b;
  }

  // Lines, far ones first.
  const lines = [];
  for (const so of solids) {
    const sp = so.pts.map(P);
    if (so.edges) for (const [a, b] of so.edges) lines.push([sp[a], sp[b], 1.2, hsv(hue + 0.6, 0.12, 1), 0.85, 0]);
    else {
      EDGES.forEach(([a, b, kind], e) => {
        const fold = kind === 2 && S.reflex[e];
        lines.push([sp[a], sp[b], fold ? 1.8 : 1.3, fold ? gold : pale, fold ? 1 : 0.85, 0]);
      });
      // Sections at seven heights: post i, fold i, post i + 1, and round.
      for (let h = 1; h < 8; h++) {
        const t = h / 8, ring = [];
        for (let i = 0; i < 3; i++) {
          const j = (i + 1) % 3;
          ring.push(P(add3(V[i], sub(V[3 + i], V[i]), t)), P(add3(V[i], sub(V[3 + j], V[i]), t)));
        }
        for (let k = 0; k < 6; k++) lines.push([ring[k], ring[(k + 1) % 6], 1, pale, 0.42, 0]);
      }
      DIAG.forEach(([a, b], n) => {
        const st = S.diag[n];
        for (let t = 0; t < 12; t++) {
          const ins = st[t] && st[t + 1];
          const p0 = P(add3(V[a], sub(V[b], V[a]), t / 12)), p1 = P(add3(V[a], sub(V[b], V[a]), (t + 1) / 12));
          lines.push([p0, p1, 1.8, ins ? green : pink, 1, ins ? 0 : 4]);
        }
      });
    }
  }
  lines.sort((p, q) => p[0][2] + p[1][2] - q[0][2] - q[1][2]);
  for (const l of lines) seg(S, l[0], l[1], l[2], l[3], l[4], l[5]);
  for (const so of solids)
    for (const p of so.pts.map(P)) {
      const x = floor(p[0]), y = floor(p[1]);
      for (let yy = y - 1; yy <= y + 1; yy++)
        for (let xx = x - 1; xx <= x + 1; xx++) {
          if (xx < 0 || xx >= W || yy < 0 || yy >= FOOT) continue;
          const cov = cl(1.9 - hypot(xx + 0.5 - p[0], yy + 0.5 - p[1]), 0, 1);
          if (cov > 0) put(buf, xx, yy, [1, 1, 1], cov * seen(S, xx, yy, p[2]));
        }
    }

  // The foot: how many of the 15 sets fit, and a cell for each.
  const cen = S.cen, inN = cen.filter((v) => v > 0).length, s = String(inN);
  const ink = inN ? green : pink;
  const glyph = (ch, x0, y0, sc, c, a) => {
    const g = DIG[ch];
    for (let r = 0; r < 5; r++)
      for (let q = 0; q < 3; q++)
        if (g[r] & (4 >> q))
          for (let j = 0; j < sc; j++) for (let i = 0; i < sc; i++) put(buf, x0 + q * sc + i, y0 + r * sc + j, c, a);
  };
  for (let i = 0; i < s.length; i++) glyph(s[i], 2 + (2 - s.length) * 7 + i * 7, FOOT + 3, 2, ink, 1);
  glyph("/", 17, FOOT + 8, 1, pale, 0.5);
  glyph("1", 21, FOOT + 8, 1, pale, 0.5);
  glyph("5", 25, FOOT + 8, 1, pale, 0.5);
  cen.forEach((v, n) => {
    const x0 = 31 + (n % 8) * 4, y0 = FOOT + 3 + floor(n / 8) * 5;
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 3; x++) {
        if (v === 0 && y !== 1) continue;
        put(buf, x0 + x, y0 + y, v > 0 ? green : v < 0 ? pink : pale, v > 0 ? 0.95 : v < 0 ? (x === 1 && y === 1 ? 0 : 0.45) : 0.35);
      }
  });

  for (let i = 0; i < W * H; i++) {
    const p = i * 3;
    display.setPixel(i % W, floor(i / W), round(cl(buf[p], 0, 1) * 255), round(cl(buf[p + 1], 0, 1) * 255), round(cl(buf[p + 2], 0, 1) * 255));
  }
}
