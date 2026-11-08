// ===== Patternflow pattern =====
// Title:   Gauss's Heptadecagon
// Family:  line
// Idea:    A ruler and a compass draw the regular 17-gon live in the top square, arcs sweeping, lines running out and points popping where they cross, until a chain of 17 equal steps closes the polygon and a readout gives how far the last vertex lies from the true 17th root of unity, while below it the 16 powers of 3 walk round the 17 points of the circle and split into nested periods of 8, 4, 2 and 1.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the construction of the regular 17-gon (Carl Friedrich Gauss, 1796, in the Disquisitiones Arithmeticae of 1801, both from memory) in the form Herbert William Richmond gave it (1893, from memory), with the nest of Gaussian periods (Gauss, 1801, from memory) below it: 3 generates the 16 nonzero residues mod 17, and each halving of them is one square root, which is one step of a ruler and compass; the 3 by 5 digits and capitals copied from edit-distance.js; pattern round 113
// Round:   113
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Step=0..1, Level=0..4
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the compass arcs are azure, the ruler lines pale, a point flashes gold where lines meet and the polygon is pink, while the periods below run from green to violet at level 1; at 0.5 the arcs are orange and the polygon is green.
// Knob 2: Speed. At 2 the circle is drawn by 2.0 s, the 76 strokes of the construction are done by 30.4 s, the closed polygon rests 4.5 s and fades in 0.8 s, so a cycle takes 35.7 s, and the pen below walks 4 chords a second, 16 to a lap. 0.2 is ten times slower and 3 is half as fast again.
// Knob 3: Step. A hand on the drawing. At 0, where it opens, the construction plays by itself. Above 0.02 it holds the drawing at that share of 32.0 s (the whole drawing and 1.6 s of rest), so 0.25 stands after 9 strokes, 0.5 after 28, 0.75 after 43 and 1 on the closed polygon, and the pen follows the hand smoothly in either direction, taking arcs back and un-popping points. Set back to 0 it plays on from where it stands.
// Knob 4: Level. How far the periods below have split. Under 0.15, where it opens at 0.06, it plays by itself and rests 3.4 s on each level from 0 up to 4 and back down; above that it holds the level it is at. Level 0 is all 16 powers of 3 in one period (16 chords), 1 is 2 periods of 8, 2 is 4 of 4, 3 is 8 of 2 (8 vertical chords) and 4 is 16 single points, and a level between two shows both blended.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sin, cos, exp, atan2, hypot, sqrt, PI, log, round } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, t) => a + (b - a) * t;
const mod = (a, n) => ((a % n) + n) % n;
const dist = (a, b) => hypot(a[0] - b[0], a[1] - b[1]);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// Digits and capitals 3 wide and 5 tall copied from edit-distance.js, and two signs.
const FACE = {
  E: "###|#..|##.|#..|###", G: ".##|#..|#.#|#.#|.##", N: "##.|#.#|#.#|#.#|#.#", R: "##.|#.#|##.|#.#|#.#", X: "#.#|#.#|.#.|#.#|#.#",
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
  "-": "...|...|###|...|...", "/": "..#|..#|.#.|#..|#..",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

// ---- Richmond's construction, worked out for real in the unit circle ----
// Every point below comes from crossing two arcs or an arc and a line, with the compass opened either to any width or
// from one made point to another, so the errors the readout shows are the rounding of a 64-bit number and nothing else.
const ang = (c, p) => atan2(p[1] - c[1], p[0] - c[0]);
const unit = (a, b) => ((l) => [(b[0] - a[0]) / l, (b[1] - a[1]) / l])(dist(a, b));
const add = (p, u, t) => [p[0] + u[0] * t, p[1] + u[1] * t];
function cc(c1, r1, c2, r2) {
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = hypot(dx, dy), a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = sqrt(max(0, r1 * r1 - a * a));
  const mx = c1[0] + (a * dx) / d, my = c1[1] + (a * dy) / d;
  return [[mx - (h * dy) / d, my + (h * dx) / d], [mx + (h * dy) / d, my - (h * dx) / d]];
}
const axisHit = (p, q) => [p[0] - (p[1] * (q[0] - p[0])) / (q[1] - p[1]), 0];
const far = (pts, from) => (dist(pts[0], from) > dist(pts[1], from) ? pts[0] : pts[1]);
const toward = (pts, from, dir) => {
  const f = (p) => (p[0] - from[0]) * dir[0] + (p[1] - from[1]) * dir[1];
  return f(pts[0]) > f(pts[1]) ? pts[0] : pts[1];
};

function construct() {
  const ops = [];
  const arc = (c, r, a0, a1, pts, role, cam, pause) => ops.push({ k: "A", c, r, a0, a1, len: abs(a1 - a0) * r, pts: pts || [], role: role || "aux", cam, pause: pause || 0 });
  // An arc about c through the angles of p and q the short way round, a little further at each end.
  const arcOver = (c, r, p, q, m, pts, role, cam) => {
    const a0 = ang(c, p), d = mod(ang(c, q) - a0 + PI, TAU) - PI, s = d >= 0 ? 1 : -1;
    arc(c, r, a0 - s * m, a0 + d + s * m, pts, role, cam);
  };
  const seg = (p, q, pts, role, cam, pause) => ops.push({ k: "L", p, q, len: dist(p, q), pts: pts || [], role: role || "aux", cam, pause: pause || 0 });
  const O = [0, 0], P0 = [1, 0], Pm = [-1, 0], B = [0, 1], Bm = [0, -1];
  // The circle and its diameter.
  arc(O, 1, 0, TAU, [{ p: O, kind: "c" }, { p: P0, kind: "v", j: 0 }], "key", [0, 0, 1]);
  seg(P0, Pm, [{ p: Pm, kind: "p" }], "key");
  // The perpendicular at O, by bisecting the diameter.
  const rho = 1.2, yy = sqrt(rho * rho - 1), X1 = [0, yy], X2 = [0, -yy];
  arcOver(P0, rho, X2, X1, 0.12, []);
  arcOver(Pm, rho, X1, X2, 0.12, [{ p: X1, kind: "x" }, { p: X2, kind: "x" }]);
  seg(Bm, B, [{ p: Bm, kind: "p", at: 0 }, { p: B, kind: "p" }], "key");
  // The quarter point J of OB: bisect OB, then bisect OM.
  const bis = (a, b, rr, cam) => {
    const [l, r] = cc(a, rr, b, rr), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    arcOver(a, rr, l, r, 0.14, [], "aux", cam);
    arcOver(b, rr, r, l, 0.14, [{ p: l, kind: "x" }, { p: r, kind: "x" }]);
    seg(l, r, [{ p: mid, kind: "p", at: 0.5 }]);
    return mid;
  };
  const M = bis(O, B, 0.75, [0, 0.45, 1.5]);
  const J = bis(O, M, 0.375);
  // A quarter of the angle OJP0: bisect it, then bisect the half that lies next to JO. JE is the quarter.
  seg(J, P0, [], "aux", [0.02, 0.16, 2.5]);
  const rJ = 0.2, s1 = 0.17, U = add(J, [0, -1], rJ), V = add(J, unit(J, P0), rJ);
  const W = far(cc(U, s1, V, s1), J), U2 = add(J, unit(J, W), rJ), W2 = far(cc(U, s1, U2, s1), J);
  arcOver(J, rJ, U, V, 0, [{ p: U, kind: "x", at: 0 }, { p: V, kind: "x", at: 1 }]);
  arcOver(V, s1, W, W, 0.3, []);
  arcOver(U, s1, W, W2, 0.25, [{ p: W, kind: "x" }, { p: W2, kind: "x" }]);
  seg(J, add(J, unit(J, W), dist(J, W) * 1.25), [{ p: U2, kind: "x", at: rJ / (dist(J, W) * 1.25) }]);
  arcOver(U2, s1, W2, W2, 0.3, []);
  const E = axisHit(J, W2);
  seg(J, E, [{ p: E, kind: "p" }], "key", null, 0.2);
  // F, where JF makes 45 degrees with JE: a right angle at J, then its bisector.
  const uE = unit(J, E), r2 = 0.2, s2 = 0.28, U3 = add(J, uE, r2), U4 = add(J, uE, -r2);
  const W3 = toward(cc(U3, s2, U4, s2), J, [uE[1], -uE[0]]), U5 = add(J, unit(J, W3), r2);
  const W4 = toward(cc(U3, s2, U5, s2), J, unit(J, [(U3[0] + U5[0]) / 2, (U3[1] + U5[1]) / 2]));
  seg(J, add(J, uE, -0.34), [], "aux", [-0.02, 0.1, 2.5]);
  const aU4 = ang(J, U4);
  arc(J, r2, aU4, aU4 + PI, [{ p: U4, kind: "x", at: 0 }, { p: U5, kind: "x", at: mod(ang(J, U5) - aU4, TAU) / PI }, { p: U3, kind: "x", at: 1 }]);
  arcOver(U3, s2, W3, W4, 0.25, [{ p: W3, kind: "x" }, { p: W4, kind: "x" }]);
  arcOver(U4, s2, W3, W3, 0.3, []);
  seg(J, add(J, unit(J, W3), dist(J, W3) * 1.25), []);
  arcOver(U5, s2, W4, W4, 0.3, []);
  const F = axisHit(J, W4);
  seg(J, F, [{ p: F, kind: "p" }], "key", null, 0.2);
  // The semicircle on FP0 meets OB at K, since OK is the mean proportional of OF and OP0.
  const r4 = 0.8, [yl, yr] = cc(F, r4, P0, r4), M5 = [(F[0] + P0[0]) / 2, 0];
  arcOver(F, r4, yl, yr, 0.1, [], "aux", [0.35, 0.15, 1.45]);
  arcOver(P0, r4, yr, yl, 0.1, [{ p: yl, kind: "x" }, { p: yr, kind: "x" }]);
  seg(yl, yr, [{ p: M5, kind: "p", at: 0.5 }]);
  const rM = dist(M5, P0), K = [0, sqrt(rM * rM - M5[0] * M5[0])];
  arc(M5, rM, 0, PI, [{ p: K, kind: "p", at: mod(ang(M5, K), TAU) / PI }], "key");
  // The circle about E through K cuts the diameter at N3 and N5, the feet of the vertices P3 and P5.
  const rE = dist(E, K), aK = ang(E, K), N3 = [E[0] + rE, 0], N5 = [E[0] - rE, 0];
  arc(E, rE, aK, aK + TAU, [{ p: N5, kind: "p", at: mod(PI - aK, TAU) / TAU }, { p: N3, kind: "p", at: mod(-aK, TAU) / TAU }], "key", null, 0.2);
  // The perpendicular at each foot meets the circle twice: P3 and P14 at N3, P5 and P12 at N5.
  const verts = new Array(17).fill(null);
  verts[0] = P0;
  const perp = (N, ja, jb, cam1, cam2) => {
    const r0 = 0.12, r1 = 0.24, Y1 = [N[0] - r0, 0], Y2 = [N[0] + r0, 0], [Za, Zb] = cc(Y1, r1, Y2, r1), h = sqrt(1 - N[0] * N[0]);
    arc(N, r0, 0, TAU, [{ p: Y1, kind: "x", at: 0.5 }, { p: Y2, kind: "x", at: 1 }], "aux", cam1);
    arcOver(Y1, r1, Zb, Za, 0.12, []);
    arcOver(Y2, r1, Za, Zb, 0.12, [{ p: Za, kind: "x" }, { p: Zb, kind: "x" }]);
    verts[ja] = [N[0], h];
    verts[jb] = [N[0], -h];
    seg([N[0], -h], [N[0], h], [{ p: verts[jb], kind: "v", j: jb, at: 0 }, { p: verts[ja], kind: "v", j: ja }], "aux", cam2);
  };
  perp(N3, 3, 14, [N3[0], 0, 2.7], [0.25, 0, 1.15]);
  perp(N5, 5, 12, [N5[0], 0, 2.7], [-0.1, 0, 1.15]);
  // P4 bisects the arc P3P5.
  const P3 = verts[3], P5 = verts[5], rA = 0.25, [Zc, Zd] = cc(P3, rA, P5, rA);
  arcOver(P3, rA, Zc, Zd, 0.15, [], "aux", [0.1, 0.9, 2.1]);
  arcOver(P5, rA, Zd, Zc, 0.15, [{ p: Zc, kind: "x" }, { p: Zd, kind: "x" }]);
  const inner = dist(Zc, O) < dist(Zd, O) ? Zc : Zd, outer = inner === Zc ? Zd : Zc, ln = hypot(inner[0], inner[1]);
  const P4 = [inner[0] / ln, inner[1] / ln];
  seg(inner, outer, [{ p: P4, kind: "v", j: 4, at: dist(inner, P4) / dist(inner, outer) }], "key", null, 0.2);
  verts[4] = P4;
  // The side P3P4 is the opening of the compass. Stepping it round from P0 takes 17 arcs, and the last one comes back to P0.
  const side = dist(P3, P4);
  seg(P3, P4, [], "aux", [0, 0, 1]);
  let prev = P0;
  for (let k = 1; k <= 17; k++) {
    const next = cc(prev, side, O, 1).sort((a, b) => prev[0] * b[1] - prev[1] * b[0] - (prev[0] * a[1] - prev[1] * a[0]))[0];
    arcOver(prev, side, next, next, 0.45, [{ p: next, kind: "v", j: k % 17, step: true }], "aux");
    seg(prev, next, [], "edge");
    prev = next;
  }
  // The error of each vertex the drawing makes, in radii, against the true place cos and sin of 2 pi j / 17.
  let t = 0.3;
  for (const o of ops) {
    const step = o.pts.some((q) => q.step), edge = o.role === "edge";
    o.dur = o.k === "A" ? (step ? 0.22 : min(1.7, max(0.28, 0.18 + 0.3 * o.len))) : edge ? 0.11 : min(0.9, max(0.26, 0.18 + 0.26 * o.len));
    o.t0 = t;
    t += o.dur + (step || edge ? 0.03 : 0.08) + o.pause;
    for (const q of o.pts) {
      if (q.j === undefined || (q.j === 0 && !q.step)) continue;
      const a = (q.j * TAU) / 17;
      q.err = dist(q.p, [cos(a), sin(a)]);
    }
  }
  const cams = ops.filter((o) => o.cam).map((o) => ({ t: o.t0, c: o.cam }));
  // When the compass reaches each vertex of the 17-gon.
  const stepAt = new Array(17).fill(1e9);
  for (const o of ops) for (const q of o.pts) if (q.step && q.j > 0) stepAt[q.j] = o.t0 + o.dur;
  return { ops, cams, Tc: t, side, stepAt };
}

// ---- The periods: 3 generates the 16 nonzero residues mod 17 ----
const POW = [], LOG = [];
for (let k = 0, v = 1; k < 16; k++, v = (v * 3) % 17) (POW.push(v), (LOG[v] = k));

// The colour of the power 3^k at a level e: its period is k mod 2^e. The hue is read off the bits of the period turned round,
// so that the two halves of a period have neighbouring hues, as a tree of splits does.
function pcol(k, e, hb, out) {
  if (e === 0) return hsv(hb + 0.42, 0.3, 1, out);
  let r = 0;
  const q = k & ((1 << e) - 1);
  for (let b = 0; b < e; b++) if ((q >> b) & 1) r |= 1 << (e - 1 - b);
  return hsv(hb + 0.04 + (0.82 * (r + 0.5)) / (1 << e), 0.72, 1, out);
}

export function setup(params) {
  const C = construct();
  params.s = {
    C, rgb: new Float32Array(W * H * 3), p: 0, tw: 0, tl: 3.4, d: 1, manual: 0, hue: 0, speed: 2, step: 0, level: 0.06, cam: [0, 0, 1],
    c1: [0, 0, 0], c2: [0, 0, 0], c3: [0, 0, 0], tmp: [0, 0, 0],
  };
}

const HOLD = 4.5, FADE = 0.8;

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1), C = S.C;
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.step = cl(kv[2], 0, 1);
  S.level = cl(kv[3], 0, 4);
  const g = (d * S.speed) / 2, hand = S.step > 0.02;
  // The pen plays by itself, or follows the hand on Step.
  S.manual += ((hand ? 1 : 0) - S.manual) * (1 - exp(-d * 8));
  if (hand) S.p += (S.step * (C.Tc + 1.6) - S.p) * (1 - exp(-d * 5));
  else {
    S.p += g;
    if (S.p >= C.Tc + HOLD + FADE) S.p = 0;
  }
  S.tw += g * 4;
  S.tl += g;
  // The level plays 1 2 3 4 3 2 1 0, resting 3.4 s on each, or follows the hand on Level.
  let want;
  if (S.level < 0.15) {
    const u = floor(S.tl / 3.4), tr = sm((S.tl - u * 3.4 - 2.5) / 0.9), lv = (n) => ((n = mod(n, 8)), n < 5 ? n : 8 - n);
    want = mix(lv(u), lv(u + 1), tr);
  } else want = S.level;
  S.d += (want - S.d) * (1 - exp(-d * 6));
}

// A line one LED wide that falls anywhere, by how much of each LED it covers. Lines of different colours cross without adding.
function stroke(rgb, x0, y0, x1, y1, c, a, ylo, yhi) {
  const xa = max(0, floor(min(x0, x1) - 1)), xb = min(W - 1, ceil(max(x0, x1) + 1)), ya = max(ylo, floor(min(y0, y1) - 1)), yb = min(yhi, ceil(max(y0, y1) + 1));
  if (xa > xb || ya > yb || a <= 0) return;
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, t = L2 > 0 ? cl((px * dx + py * dy) / L2, 0, 1) : 0, v = (1 - hypot(px - t * dx, py - t * dy)) * a;
      if (v <= 0) continue;
      const o = (y * W + x) * 3;
      if (c[0] * v > rgb[o]) rgb[o] = c[0] * v;
      if (c[1] * v > rgb[o + 1]) rgb[o + 1] = c[1] * v;
      if (c[2] * v > rgb[o + 2]) rgb[o + 2] = c[2] * v;
    }
}

// A soft disc, or a ring when ring is the thickness.
function blob(rgb, cx, cy, r, c, a, ylo, yhi, ring) {
  const xa = max(0, floor(cx - r - 2)), xb = min(W - 1, ceil(cx + r + 2)), ya = max(ylo, floor(cy - r - 2)), yb = min(yhi, ceil(cy + r + 2));
  if (a <= 0) return;
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const d = hypot(x + 0.5 - cx, y + 0.5 - cy), v = (ring ? 1 - abs(d - r) / ring : r + 0.5 - d) * a;
      if (v <= 0) continue;
      const o = (y * W + x) * 3, w = min(1, v);
      if (c[0] * w > rgb[o]) rgb[o] = c[0] * w;
      if (c[1] * w > rgb[o + 1]) rgb[o + 1] = c[1] * w;
      if (c[2] * w > rgb[o + 2]) rgb[o + 2] = c[2] * w;
    }
}

const mix3 = (a, b, t, out) => ((out[0] = mix(a[0], b[0], t)), (out[1] = mix(a[1], b[1], t)), (out[2] = mix(a[2], b[2], t)), out);

function put(rgb, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3, k = min(1, a);
  rgb[o] += (c[0] - rgb[o]) * k;
  rgb[o + 1] += (c[1] - rgb[o + 1]) * k;
  rgb[o + 2] += (c[2] - rgb[o + 2]) * k;
}
function text(rgb, s, x, y, c, a) {
  for (let n = 0; n < s.length; n++) {
    const g = GLYPH[s[n]];
    if (g) for (let i = 0; i < 15; i++) if (g[i]) put(rgb, x + n * 4 + (i % 3), y + floor(i / 3), c, a);
  }
}
// An error in radii as one digit and a power of ten, 2E-16.
function fmt(e) {
  if (!(e > 1e-17)) return "0";
  let x = floor(log(e) / log(10) + 1e-9), m = round(e / 10 ** x);
  if (m >= 10) (m = 1), x++;
  return m + "E" + x;
}

// The camera: where the top square looks, easing between the keys over the second before each.
function camera(S, p, out) {
  const ks = S.C.cams;
  let i = 0;
  while (i + 1 < ks.length && ks[i + 1].t <= p) i++;
  const a = ks[i].c, b = ks[min(i + 1, ks.length - 1)], f = i + 1 < ks.length ? sm((p - (b.t - 0.9)) / 0.9) : 0, bc = b.c;
  out[0] = mix(a[0], bc[0], f);
  out[1] = mix(a[1], bc[1], f);
  out[2] = exp(mix(log(a[2]), log(bc[2]), f));
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.C) return;
  const C = S.C, p = S.p, rgb = S.rgb, { c1, c2, c3, tmp } = S;
  rgb.fill(0);
  const h0 = 0.56 + S.hue;
  const arcC = hsv(h0, 0.7, 1, [0, 0, 0]), lineC = hsv(h0 + 0.02, 0.2, 1, [0, 0, 0]), goldC = hsv(h0 - 0.43, 0.7, 1, [0, 0, 0]), pinkC = hsv(h0 + 0.36, 0.7, 1, [0, 0, 0]);
  const white = [1, 1, 1], inkC = hsv(h0, 0.35, 0.8, [0, 0, 0]);
  const hold = sm((p - C.Tc) / 1.2), manual = S.manual;
  const fade = mix(min(sm(p / 0.5), 1 - sm((p - C.Tc - HOLD) / FADE)), 1, manual);

  // ---- The level, as a blend of two whole levels ----
  const e0 = min(3, floor(S.d)), fr = S.d >= 4 ? 1 : S.d - e0, e1 = e0 + 1;
  const hb = h0 - 0.42;

  // ---- The top square: the drawing ----
  const cam = S.cam;
  camera(S, p, cam);
  const R = 27 * cam[2], sx = (x) => 32 + (x - cam[0]) * R, sy = (y) => 32 - (y - cam[1]) * R;
  let done = 0, bestAge = 1e9, bestErr = 0;
  const found = new Float32Array(17).fill(-1);
  // A vertex the perpendiculars or the bisector found first goes quiet when the compass steps onto it.
  const stepAt = C.stepAt;
  for (const o of C.ops) {
    if (p < o.t0) break;
    const u = cl((p - o.t0) / o.dur, 0, 1), age = p - o.t0 - o.dur, drawing = u < 1;
    if (!drawing) done++;
    let br;
    if (drawing) br = 1;
    else if (o.role === "edge") br = 0.95;
    else if (o.role === "key") br = (0.42 + 0.58 * exp(-age / 2.0)) * (1 - 0.1 * hold);
    else br = (0.13 + 0.87 * exp(-age / 1.5)) * (1 - 0.4 * hold);
    const col = o.role === "edge" ? (age > 0 && p > C.Tc ? mix3(pinkC, white, 0.7 * exp(-(p - C.Tc) * 3), tmp) : pinkC) : o.role === "key" ? lineC : o.k === "A" ? arcC : lineC;
    if (o.k === "A") {
      const a1 = o.a0 + (o.a1 - o.a0) * u, rp = o.r * R, n = max(2, ceil((abs(a1 - o.a0) * rp) / 1.8));
      const X = sx(o.c[0]), Y = sy(o.c[1]);
      let px = X + rp * cos(o.a0), py = Y - rp * sin(o.a0);
      for (let i = 1; i <= n; i++) {
        const a = o.a0 + ((a1 - o.a0) * i) / n, qx = X + rp * cos(a), qy = Y - rp * sin(a);
        stroke(rgb, px, py, qx, qy, col, br * fade, 0, 63);
        (px = qx), (py = qy);
      }
      // The compass: its foot on the centre, its leg out to the pen.
      if (drawing && o.k === "A" && o.role !== "edge" && u > 0) {
        stroke(rgb, X, Y, px, py, col, 0.32 * fade, 0, 63);
        blob(rgb, X, Y, 0.9, white, 0.9 * fade, 0, 63);
        blob(rgb, px, py, 1.3, white, fade, 0, 63);
      }
    } else {
      const x0 = sx(o.p[0]), y0 = sy(o.p[1]), x1 = x0 + (sx(o.q[0]) - x0) * u, y1 = y0 + (sy(o.q[1]) - y0) * u;
      stroke(rgb, x0, y0, x1, y1, col, br * fade, 0, 63);
      if (drawing && u > 0) blob(rgb, x1, y1, 1.2, white, fade, 0, 63);
    }
  }
  // The points, each flashing as its lines meet, then resting.
  for (const o of C.ops) {
    if (p < o.t0) break;
    for (const q of o.pts) {
      const age = p - (o.t0 + (q.at === undefined ? 1 : q.at) * o.dur);
      if (age < 0) continue;
      const X = sx(q.p[0]), Y = sy(q.p[1]), f = cl(age / 0.5, 0, 1), calm = 1 - 0.65 * hold;
      if (q.j !== undefined) {
        found[q.j] = max(found[q.j], age < 0.3 ? 1 : 0.6);
        if (q.err !== undefined && age < bestAge) (bestAge = age), (bestErr = q.err);
      }
      if (q.kind === "v") {
        // A vertex of the 17-gon, pink, and at the end the colour of its period.
        if (q.step || q.j === 0) {
          const k = q.j > 0 ? LOG[q.j] : -1;
          if (k >= 0) {
            pcol(k, e0, hb, c1);
            pcol(k, e1, hb, c2);
            for (let e = 0; e < 3; e++) c3[e] = mix(pinkC[e], mix(c1[e], c2[e], fr), hold);
          } else for (let e = 0; e < 3; e++) c3[e] = mix(pinkC[e], 1, 0.4 + 0.6 * hold);
          blob(rgb, X, Y, 1.5, c3, fade, 0, 63);
          if (f < 1) blob(rgb, X, Y, 1 + 6 * f, c3, 0.9 * (1 - f) * fade, 0, 63, 1);
        } else if (p < stepAt[q.j]) {
          blob(rgb, X, Y, 1.1, goldC, 0.95 * fade, 0, 63);
          if (f < 1) blob(rgb, X, Y, 1 + 5 * f, goldC, 0.9 * (1 - f) * fade, 0, 63, 1);
        }
      } else if (q.kind === "p") {
        blob(rgb, X, Y, 1.35, goldC, (0.6 + 0.4 * calm) * fade, 0, 63);
        if (f < 1) blob(rgb, X, Y, 1 + 6 * f, goldC, 0.9 * (1 - f) * fade, 0, 63, 1);
      } else if (q.kind === "c") blob(rgb, X, Y, 1.0, lineC, 0.7 * fade, 0, 63);
      else {
        blob(rgb, X, Y, 0.8, goldC, (0.3 + 0.4 * exp(-age / 1.5)) * calm * fade, 0, 63);
        if (f < 1) blob(rgb, X, Y, 1 + 4 * f, goldC, 0.8 * (1 - f) * fade, 0, 63, 1);
      }
    }
  }

  // ---- The strip: strokes made, the latest error, the 17 vertices found ----
  text(rgb, done + "/" + C.ops.length, 1, 66, inkC, 0.8 * fade);
  if (bestAge < 1e9) {
    const s = "ERR " + fmt(bestErr);
    text(rgb, s, 63 - s.length * 4 + 1, 66, goldC, 0.9 * fade);
  }
  for (let j = 0; j < 17; j++) {
    const x = floor((j * 63) / 17 + 0.5), a = found[j] < 0 ? 0.16 : found[j];
    for (let v = 0; v < 2; v++) for (let u = 0; u < 2; u++) put(rgb, x + u, 72 + v, found[j] < 0 ? inkC : pinkC, a * fade);
  }

  // ---- The lower square: the periods on the 17 points ----
  const LX = 32, LY = 102, LR = 24, px = [], py = [];
  for (let j = 0; j < 17; j++) {
    const a = (j * TAU) / 17;
    px.push(LX + LR * cos(a));
    py.push(LY - LR * sin(a));
  }
  for (let i = 0; i < 48; i++) {
    const a0 = (i * TAU) / 48, a1 = ((i + 1) * TAU) / 48;
    stroke(rgb, LX + LR * cos(a0), LY - LR * sin(a0), LX + LR * cos(a1), LY - LR * sin(a1), inkC, 0.2 * fade, 77, 127);
  }
  // The chords of each period at the two levels that are blending: a period's members, in the order the walk meets them, joined end to end.
  for (const [e, w] of [[e0, 1 - fr], [e1, fr]]) {
    if (w <= 0.01) continue;
    const per = 1 << e, m = 16 >> e;
    if (m < 2) continue;
    for (let q = 0; q < per; q++) {
      pcol(q, e, hb, c1);
      for (let i = 0; i < (m === 2 ? 1 : m); i++) {
        const ka = q + i * per, kb = q + ((i + 1) % m) * per, ja = POW[ka], jb = POW[kb];
        stroke(rgb, px[ja], py[ja], px[jb], py[jb], c1, 0.8 * w * fade, 77, 127);
      }
    }
  }
  // The walk: a pen steps through 3^k, a chord at a time, with a tail of the last three.
  const kk = floor(S.tw), wf = S.tw - kk;
  for (let t = 3; t >= 0; t--) {
    const k = mod(kk - t, 16), ja = POW[k], jb = POW[(k + 1) % 16], end = t === 0 ? wf : 1;
    pcol(k, e0, hb, c1);
    pcol(k, e1, hb, c2);
    for (let e = 0; e < 3; e++) c3[e] = mix(mix(c1[e], c2[e], fr), 1, 0.5);
    stroke(rgb, px[ja], py[ja], mix(px[ja], px[jb], end), mix(py[ja], py[jb], end), c3, [1, 0.6, 0.35, 0.18][t] * fade, 77, 127);
    if (t === 0) blob(rgb, mix(px[ja], px[jb], end), mix(py[ja], py[jb], end), 1.4, white, fade, 77, 127);
  }
  // The points: one for each power of 3, in the colour of its period, brightest where the walk has just been.
  for (let j = 1; j < 17; j++) {
    const k = LOG[j], since = mod(S.tw - k, 16);
    pcol(k, e0, hb, c1);
    pcol(k, e1, hb, c2);
    for (let e = 0; e < 3; e++) c3[e] = mix(c1[e], c2[e], fr);
    blob(rgb, px[j], py[j], 1.9, c3, (0.62 + 0.38 * exp(-since * 0.6)) * fade, 77, 127);
  }
  blob(rgb, px[0], py[0], 1.9, white, 0.85 * fade, 77, 127);
  // The level, as periods by members, and the two numbers the picture rests on.
  const lev = round(S.d), sz = 16 >> lev;
  text(rgb, "G3", 1, 79, inkC, 0.7 * fade);
  text(rgb, "N17", 51, 79, inkC, 0.7 * fade);
  text(rgb, (1 << lev) + "X" + sz, 1, 122, inkC, 0.85 * fade);

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
