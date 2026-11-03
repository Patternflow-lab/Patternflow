// ===== Patternflow pattern =====
// Title:   Desargues Configuration
// Family:  space
// Idea:    A three-sided pyramid hangs from its apex O at the top of the panel and two planes cut it in a cyan and a gold triangle, the scene turns slowly in space, and the sides of the two triangles, carried on past their corners, meet in pairs at three white points that always stand on one pink line, the line where the two planes cross, so every frame is Desargues's flat theorem drawn by the solid one.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Desargues's theorem on two triangles in perspective from a point (Girard Desargues; first printed by Abraham Bosse in Manière universelle de M. Desargues, 1648) and its configuration of ten points and ten lines, three points on every line and three lines through every point (10_3), seen in space as two plane sections of one pyramid; pattern round 100
// Round:   100
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Tilt=30..56, View=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the pyramid's edges are periwinkle, the upper triangle and its plane cyan, the lower triangle and its plane gold, the axis pink and the points white; at 0.5 the triangles are red and blue and the axis green.
// Knob 2: Speed. At 2 the scene swings 25 degrees each way about the vertical through its middle and back in 12 s, and a light runs out along each pair of carried-on sides to its point on the axis every 2.4 s; every time goes as 2 / Speed.
// Knob 3: Tilt. The angle between the two cutting planes, which turn about the axis in opposite directions: 30 degrees at the opening, where the triangles stand one above the other, and 56 at the top, where the cyan one climbs into a narrow sliver near O and the gold one slides down the pyramid. The three points on the axis do not move at all, since each is where a face of the pyramid meets the axis.
// Knob 4: View. The camera's height, as the angle it looks down: 25 + 25 x View degrees, so 26.5 at the opening 0.06. At -1 it looks level, and near one end of each swing the eye comes close to the gold plane and the gold triangle thins to a sliver; at 1 it looks down at 50 degrees and the figure stands shorter and wider.

// In the plane the theorem says: if the lines AA', BB' and CC' through the
// corresponding corners of two triangles meet in one point O, the three
// points where AB meets A'B', BC meets B'C' and CA meets C'A' lie on one
// line, the axis. Desargues worked it out in space, where it needs no
// proof at all. Take a pyramid with apex O and three edges, and cut it with
// two planes: one cut is the triangle ABC, the other A'B'C', and the lines
// AA', BB', CC' are the edges, so they meet at O. The sides AB and A'B' lie
// in the same face OAB of the pyramid, so they meet; AB lies in the first
// plane and A'B' in the second, so they meet on both, and two planes meet
// in one line. The same holds for the other two pairs of sides. Ten points
// (O, six corners, three meeting points) and ten lines (three edges, six
// sides, the axis), with three points on each line and three lines through
// each point: the configuration (10_3).
//
// The scene is built round its axis. The axis is a fixed line in space,
// sloping down and away; the two cutting planes are the planes through it
// at THETA + Tilt / 2 and THETA - Tilt / 2 about it. Each meeting point is
// where the plane of one face meets the axis, worked out from the face's
// normal, so it depends on the pyramid and the axis alone, and Tilt slides
// the triangles along the edges while the three points stay where they are.
// The pyramid, the axis and THETA were picked by a search that asked, for
// every swing, height and tilt the knobs reach, that both triangles stay
// wide, that the three points sit well apart, and that the axis passes
// below the triangles.
//
// A central projection keeps a line a line and a meeting point a meeting
// point, so whatever the camera does, the picture on the panel is the flat
// theorem: two triangles in perspective from the image of O, their sides
// meeting on the image of the axis. The space picture is what makes the
// flat one true, and the swing shows both at once.
//
// Drawing, from the back: each cutting plane as a faint sheet, the hull of
// its triangle and the three points on the axis; all ten lines of the
// configuration faint and whole across the panel; the axis 2 LEDs wide; the
// carried-on sides from the corner nearest each point out to it; the
// triangles filled at a third of their colour; the edges from O 2 LEDs
// wide; the triangle sides 2.6 LEDs; and the points as discs. Lines and
// discs are anti-aliased by their distance from each LED's centre, and
// every line is darker where it lies farther from the camera.

const W = 64, H = 128;
const { floor, ceil, min, max, sin, cos, sqrt, exp, round, hypot, PI } = Math;
const D2R = PI / 180;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The pyramid: apex O above three feet on the ground, at these bearings
// (degrees) and distances from the vertical through O.
const OH = 3.021;
const FA = [-8.52, 91.4, 40.77], FR = [1.383, 0.7527, 1.0775];
// The axis: through Q, at bearing LA and slope LB (degrees). The planes sit
// at THETA +- Tilt / 2 about it, measured from the side that faces O.
const QX = 0.1968, QY = -1.4095, QZ = 1.7674, LA = 39.04, LB = -46.14;
const THETA = 24.92;
// The swing each way (degrees), the camera distance, and the Tilt range.
const SWING = 25, DC = 11.62, TMIN = 30, TMAX = 56;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a) => {
  const l = hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

const O = [0, OH, 0];
const FOOT = FA.map((a, i) => [FR[i] * cos(a * D2R), 0, FR[i] * sin(a * D2R)]);
const Q = [QX, QY, QZ];
const DIR = [cos(LA * D2R) * cos(LB * D2R), sin(LB * D2R), sin(LA * D2R) * cos(LB * D2R)];

// The three meeting points: the plane of face O, foot i, foot j meets the
// axis where its normal m gives m . (Q + k DIR - O) = 0.
const MEET = [[0, 1], [1, 2], [2, 0]].map(([i, j]) => {
  const m = cross(sub(FOOT[i], O), sub(FOOT[j], O)), k = dot(m, sub(O, Q)) / dot(m, DIR);
  return [Q[0] + k * DIR[0], Q[1] + k * DIR[1], Q[2] + k * DIR[2]];
});

// The two triangles for a tilt: each plane holds the axis and the direction
// h cos(th) + v sin(th), h pointing from the axis towards O across it.
function triangles(tilt) {
  let h = nrm(cross([0, 1, 0], DIR));
  if (dot(h, sub(O, Q)) < 0) h = h.map((x) => -x);
  let v = nrm(cross(DIR, h));
  if (v[1] < 0) v = v.map((x) => -x);
  return [THETA + tilt / 2, THETA - tilt / 2].map((th) => {
    const c = cos(th * D2R), s = sin(th * D2R);
    const n = cross(DIR, [h[0] * c + v[0] * s, h[1] * c + v[1] * s, h[2] * c + v[2] * s]);
    return FOOT.map((f) => {
      const d = sub(f, O), t = dot(n, sub(Q, O)) / dot(n, d);
      return [O[0] + t * d[0], O[1] + t * d[1], O[2] + t * d[2]];
    });
  });
}

// Camera: turn by yaw about the vertical through CEN, look down by el, then
// a pinhole at distance DC. Returns screen x, y (up) and depth toward the eye.
const CEN = [0, (OH + QY) / 2, QZ / 2];
function cam(p, yaw, el) {
  const x = p[0] - CEN[0], y = p[1] - CEN[1], z = p[2] - CEN[2];
  const cy = cos(yaw), sy = sin(yaw), ce = cos(el), se = sin(el);
  const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
  const y2 = y * ce - z1 * se, z2 = y * se + z1 * ce, s = DC / (DC - z2);
  return [x1 * s, y2 * s, z2];
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// Keep the brighter of what is there and colour c at strength a.
function put(buf, x, y, c, a) {
  const p = (y * W + x) * 3;
  if (c[0] * a > buf[p]) buf[p] = c[0] * a;
  if (c[1] * a > buf[p + 1]) buf[p + 1] = c[1] * a;
  if (c[2] * a > buf[p + 2]) buf[p + 2] = c[2] * a;
}

// A segment wid LEDs wide, strength a0 at its start and a1 at its end, and
// with g in 0..1 a light 2.5 LEDs long running along it at that point.
function seg(buf, ax, ay, bx, by, wid, c, a0, a1, g) {
  const r = wid / 2 + 0.5, dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9, len = sqrt(L2);
  const x0 = max(0, floor(min(ax, bx) - r)), x1 = min(W - 1, ceil(max(ax, bx) + r));
  const y0 = max(0, floor(min(ay, by) - r)), y1 = min(H - 1, ceil(max(ay, by) + r));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay, t = cl((px * dx + py * dy) / L2, 0, 1);
      const ex = px - t * dx, ey = py - t * dy, cov = cl(wid / 2 + 0.5 - sqrt(ex * ex + ey * ey), 0, 1);
      if (cov <= 0) continue;
      let a = a0 + (a1 - a0) * t;
      if (g >= 0) a = min(1, a + 0.75 * exp(-((((t - g) * len) / 2.5) ** 2)));
      put(buf, x, y, c, cov * a);
    }
}

// The whole line through a and b, across the panel.
function line(buf, a, b, wid, c, al) {
  const ux = b[0] - a[0], uy = b[1] - a[1], n = hypot(ux, uy) || 1, L = 300;
  seg(buf, a[0] - (ux / n) * L, a[1] - (uy / n) * L, a[0] + (ux / n) * L, a[1] + (uy / n) * L, wid, c, al, al, -1);
}

function disc(buf, x, y, rad, c, a) {
  for (let yy = max(0, floor(y - rad - 1)); yy <= min(H - 1, floor(y + rad + 1)); yy++)
    for (let xx = max(0, floor(x - rad - 1)); xx <= min(W - 1, floor(x + rad + 1)); xx++) {
      const cov = cl(rad + 0.5 - hypot(xx + 0.5 - x, yy + 0.5 - y), 0, 1);
      if (cov > 0) put(buf, xx, yy, c, cov * a);
    }
}

// Convex hull of screen points, monotone chain.
function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) {
    while (lo.length >= 2 && turn(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    while (hi.length >= 2 && turn(hi[hi.length - 2], hi[hi.length - 1], p[i]) <= 0) hi.pop();
    hi.push(p[i]);
  }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

// Fill a convex polygon with colour c at strength a and a soft edge one LED
// wide; add puts the colour on top of what is there instead of keeping the
// brighter, so the two sheets mix where they overlap.
function poly(buf, P, c, a, add) {
  let x0 = W, x1 = 0, y0 = H, y1 = 0, area = 0;
  const n = P.length, ex = [], ey = [], el = [];
  for (let i = 0; i < n; i++) {
    const A = P[i], B = P[(i + 1) % n];
    x0 = min(x0, A[0]); x1 = max(x1, A[0]); y0 = min(y0, A[1]); y1 = max(y1, A[1]);
    ex.push(B[0] - A[0]); ey.push(B[1] - A[1]); el.push(hypot(B[0] - A[0], B[1] - A[1]) || 1);
    area += A[0] * B[1] - B[0] * A[1];
  }
  const sgn = area < 0 ? -1 : 1;
  x0 = max(0, floor(x0)); x1 = min(W - 1, ceil(x1)); y0 = max(0, floor(y0)); y1 = min(H - 1, ceil(y1));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let cov = 1;
      for (let i = 0; i < n && cov > 0; i++)
        cov = min(cov, cl((sgn * (ex[i] * (y + 0.5 - P[i][1]) - ey[i] * (x + 0.5 - P[i][0]))) / el[i] + 0.5, 0, 1));
      if (cov <= 0) continue;
      if (!add) put(buf, x, y, c, cov * a);
      else {
        const p = (y * W + x) * 3;
        buf[p] += c[0] * a * cov;
        buf[p + 1] += c[1] * a * cov;
        buf[p + 2] += c[2] * a * cov;
      }
    }
}

export function setup(params) {
  params.s = { buf: new Float32Array(W * H * 3), swing: 0, run: 0, hue: 0, tilt: TMIN, view: 0.06, fitView: null, fit: null };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, TMIN, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.tilt = cl(k[2] == null ? TMIN : k[2], TMIN, TMAX);
  S.view = cl(k[3] == null ? 0.06 : k[3], -1, 1);
  S.swing = (S.swing + (d * speed * 2 * PI) / 24) % (2 * PI);
  S.run = (S.run + (d * speed) / 4.8) % 1;
}

// Scale and centre so that every swing and every tilt fits columns 3 to 61
// and rows 5 to 123. It is worked out again only when View moves, so
// turning Tilt leaves the three points where they are on the panel too.
function fit(S, el) {
  if (S.fitView === S.view) return S.fit;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const tilt of [TMIN, (TMIN + TMAX) / 2, TMAX]) {
    const T = triangles(tilt);
    for (let i = 0; i <= 12; i++) {
      const yaw = SWING * D2R * (i / 6 - 1);
      for (const p of [O, ...T[0], ...T[1], ...MEET]) {
        const q = cam(p, yaw, el);
        x0 = min(x0, q[0]); x1 = max(x1, q[0]); y0 = min(y0, q[1]); y1 = max(y1, q[1]);
      }
    }
  }
  const K = min(58 / (x1 - x0), 118 / (y1 - y0));
  S.fit = { K, cx: 32 - (K * (x0 + x1)) / 2, cy: 64 + (K * (y0 + y1)) / 2 };
  S.fitView = S.view;
  return S.fit;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf;
  buf.fill(0);
  const el = (25 + 25 * S.view) * D2R, yaw = SWING * D2R * sin(S.swing), F = fit(S, el);
  // Screen point, and how lit its depth leaves it: 1 near, 0.45 far.
  const P = (p) => {
    const q = cam(p, yaw, el);
    return [F.cx + F.K * q[0], F.cy - F.K * q[1], cl(0.74 + 0.3 * q[2], 0.45, 1)];
  };
  const tri = triangles(S.tilt);
  const o = P(O), T1 = tri[0].map(P), T2 = tri[1].map(P), M = MEET.map(P);
  const c1 = hsv(S.hue + 0.5, 0.75, 1), c2 = hsv(S.hue + 0.14, 0.8, 1), ca = hsv(S.hue + 0.88, 0.5, 1);
  const ce = hsv(S.hue + 0.64, 0.4, 1), white = [1, 1, 1];

  poly(buf, hull([...T1, ...M]), c1, 0.13, true);
  poly(buf, hull([...T2, ...M]), c2, 0.12, true);
  for (let i = 0; i < 3; i++) {
    line(buf, o, T2[i], 1, ce, 0.18);
    line(buf, T1[i], T1[(i + 1) % 3], 1, c1, 0.18);
    line(buf, T2[i], T2[(i + 1) % 3], 1, c2, 0.18);
  }
  line(buf, M[0], M[2], 2, ca, 0.85);

  // The carried-on sides: AB and A'B' run out to the first point, BC and
  // B'C' to the second, CA and C'A' to the third, each pair lit together,
  // and the point swells as the light reaches it.
  const glow = [0, 0, 0];
  for (let m = 0; m < 3; m++) {
    const i = m, j = (m + 1) % 3, X = M[m], g = (S.run + m / 3) % 1;
    glow[m] = exp(-(((1 - g) * 10) ** 2)) + exp(-((g * 10) ** 2));
    for (const [T, c] of [[T1, c1], [T2, c2]]) {
      const N = hypot(T[i][0] - X[0], T[i][1] - X[1]) < hypot(T[j][0] - X[0], T[j][1] - X[1]) ? T[i] : T[j];
      seg(buf, N[0], N[1], X[0], X[1], 1.6, c, 0.7 * N[2], 0.7 * X[2], g);
    }
  }
  poly(buf, T1, c1, 0.32, false);
  poly(buf, T2, c2, 0.3, false);
  // Each edge from O runs to the farther of its two corners.
  for (let i = 0; i < 3; i++) {
    const a = T1[i], b = T2[i];
    const f = hypot(a[0] - o[0], a[1] - o[1]) > hypot(b[0] - o[0], b[1] - o[1]) ? a : b;
    seg(buf, o[0], o[1], f[0], f[1], 2, ce, 0.85 * o[2], 0.85 * f[2], -1);
  }
  for (const [T, c] of [[T1, c1], [T2, c2]])
    for (let i = 0; i < 3; i++) {
      const a = T[i], b = T[(i + 1) % 3];
      seg(buf, a[0], a[1], b[0], b[1], 2.6, c, a[2], b[2], -1);
    }
  for (const T of [T1, T2]) for (const q of T) disc(buf, q[0], q[1], 1.2, white, 0.55 + 0.45 * q[2]);
  disc(buf, o[0], o[1], 2.2, white, 1);
  for (let m = 0; m < 3; m++) disc(buf, M[m][0], M[m][1], 2.3 + 0.9 * glow[m], white, 1);

  for (let i = 0; i < W * H; i++) {
    const p = i * 3;
    display.setPixel(i % W, floor(i / W), round(cl(buf[p], 0, 1) * 255), round(cl(buf[p + 1], 0, 1) * 255), round(cl(buf[p + 2], 0, 1) * 255));
  }
}
