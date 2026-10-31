// ===== Patternflow pattern =====
// Title:   Malfatti Circles
// Family:  geometry
// Idea:    One slowly morphing triangle is drawn twice down the tall panel, the upper copy holding Malfatti's three circles, each touching two sides and the other two circles, and the lower copy the greedy three, the incircle and then each time the largest circle that still fits, with two bars and percentages between them for the share of the triangle each three cover, so the greedy bar stays ahead, by 14 points of the triangle when it is a 23 degree wedge and by a single point when it passes through equilateral.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Malfatti's problem (Gian Francesco Malfatti, 1803); the greedy arrangement beating his circles (H. Lob and H. W. Richmond, 1930) and proved best in every triangle (V. A. Zalgaller and G. A. Los', 1994), pattern round 81
// Round:   81
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Thin=0..1, More=0..1
//
// Knob 1: Hue. Turns both colours round the wheel together. At 0 Malfatti's circles and their bar are azure and the greedy ones rose pink; at 0.25 violet and yellow; at 0.5 red orange and green.
// Knob 2: Speed. At 2 the triangle goes from its thinnest to equilateral in 6 s and back in 6 more, and its thin end comes in turn as a wedge leaning over the right end of the base, a flat isosceles triangle, a wedge leaning left and the flat one again, 48 s for the round. Every time goes as 2 / Speed, so 60 s from thin to equilateral at 0.2 and 4 s at 3.
// Knob 3: Thin. How low the apex comes at the thin end of the morph: 26 rows above the 61 LED base at 0, a wedge whose sharpest corner is 23 degrees, where the greedy three cover 69.8% against Malfatti's 55.9%, or a flat triangle of 99 degrees at the top, 73.7% against 64.7%; at 1 it comes to 7 rows, a 6.6 degree wedge with 39.1% against 23.1%, or 154 degrees at the top with 39.9% against 30.0%.
// Knob 4: More. Goes on placing circles greedily after the first three, in both copies and in a paler shade: none up to 0.1 (the opening is 0.06), 3 at 0.25, 16 at 0.5, 36 at 0.75 and 60 at 1, so the gaps each first three leave fill with ever smaller circles. The bars and numbers keep counting the first three only.

// In 1803 Malfatti asked how to cut three cylindrical columns out of a
// triangular prism of marble with the least waste, and took for granted that
// the answer was three circles in the triangle, each tangent to the other two
// and to two of the sides. Those circles have a closed form. With a, b, c the
// sides opposite A, B, C, s the semiperimeter, r the inradius and d, e, f the
// distances from the incentre to A, B and C, the circle in the corner at A
// has radius
//
//   r_A = r / (2 (s - a)) * (s - r - (e + f - d))
//
// and the others go round the same way. Its centre is the vertex pulled
// towards the incentre by r_A / r, which makes it tangent to both sides at A.
// Checked numerically on the triangles this pattern passes through and on
// ten random ones, with corners from 3.6 to 154 degrees: the distances
// between centres equal the sums of the radii, and each circle stands its
// own radius off both sides at its corner, to within 1e-13 LEDs.
//
// Lob and Richmond showed in 1930 that the circles were not the answer: in
// an equilateral triangle the incircle with two small circles in two corners
// covers 73.9% against Malfatti's 72.9%, and in a thin triangle the gap is
// wide. Zalgaller and Los' proved in 1994 that the greedy choice is the best
// one in every triangle: the incircle, then the largest circle left, then the
// largest left again.
//
// After the incircle the free space is three corners, each bounded by two
// sides and the incircle. The largest circle in the corner at A is the image
// of the incircle under the homothety at A with ratio
//
//   q_A = (1 - sin(A/2)) / (1 + sin(A/2)),
//
// and placing it leaves a smaller corner (the next circle shrinks by q_A
// again) and two cusps, each between two tangent circles and a side. A cusp,
// like every gap after that, is bounded by three mutually tangent things, and
// its largest circle touches all three, with Descartes' curvature
//
//   k = k1 + k2 + k3 + 2 sqrt(k1 k2 + k2 k3 + k3 k1),   a side counting 0.
//
// So the greedy keeps a list of gaps, each with the radius of its best
// circle, and takes the largest each time; the circle placed splits its gap
// into three. The same list, started from Malfatti's circles (their middle
// gap, three corners and three cusps), continues the upper copy when K4 asks
// for more.

const W = 64, H = 128;
const { floor, min, max, round, sqrt, sin, cos, abs, PI, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = 2 * PI;

// Each copy's base runs from x = 1.5 to 62.5 on its bottom row.
const BX0 = 1.5, BX1 = 62.5, BASE = BX1 - BX0, HEQ = (BASE * sqrt(3)) / 2;
const TOPS = [{ base: 56, bar: 60, num: 58 }, { base: 126, bar: 67, num: 65 }];
const BAR0 = 1, BARLEN = 42;
// The two colours' places on the wheel, before the hue knob.
const HUES = [0.56, 0.9];

// 3 by 5 digits, rows top to bottom, bit 2 the left column.
const DIG = [
  [7, 5, 5, 5, 7], [2, 6, 2, 2, 7], [7, 1, 7, 4, 7], [7, 1, 7, 1, 7], [5, 5, 7, 1, 1],
  [7, 4, 7, 1, 7], [7, 4, 7, 5, 7], [7, 1, 1, 2, 2], [7, 5, 7, 5, 7], [7, 5, 7, 1, 7],
];
const PCT = [5, 1, 2, 4, 5];

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  params.s = {
    t: 0, hue: 0, thin: 0, more: 0,
    buf: new Float32Array(W * H * 3),
    col: [[0, 0, 0], [0, 0, 0]], pale: [[0, 0, 0], [0, 0, 0]],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.thin = cl(k[2] || 0, 0, 1);
  const m = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.more = m < 0.1 ? 0 : round(60 * ((m - 0.1) / 0.9) ** 1.6);
  S.t += (d * speed) / 2;
}

// The triangle at model time t: base fixed, the apex walking. m is 1 at the
// thin end and 0 at equilateral; the apex's side goes round once in 48 s.
function triangle(t, thin) {
  const m = 0.5 + 0.5 * cos((TAU * t) / 12);
  const side = cos((TAU * t) / 48);
  const hmin = 26 - 19 * thin;
  const h = HEQ - m * (HEQ - hmin);
  const ax = (BX0 + BX1) / 2 + m * 30 * side;
  return [[ax, -h], [BX0, 0], [BX1, 0]];
}

// A side as a line with its inward unit normal: inside is n . p - c >= 0.
function sideLine(P, Q, R) {
  let nx = -(Q[1] - P[1]), ny = Q[0] - P[0];
  const l = hypot(nx, ny);
  nx /= l;
  ny /= l;
  let c = nx * P[0] + ny * P[1];
  if (nx * R[0] + ny * R[1] - c < 0) {
    nx = -nx;
    ny = -ny;
    c = -c;
  }
  return { line: true, nx, ny, c };
}

// Everything about one triangle: sides, inradius, Malfatti's three, and the
// corner ratios the greedy uses.
function solve(V) {
  const [A, B, C] = V;
  const a = hypot(B[0] - C[0], B[1] - C[1]), b = hypot(C[0] - A[0], C[1] - A[1]), c = hypot(A[0] - B[0], A[1] - B[1]);
  const s = (a + b + c) / 2, area = sqrt(max(1e-9, s * (s - a) * (s - b) * (s - c))), r = area / s;
  const I = [(a * A[0] + b * B[0] + c * C[0]) / (2 * s), (a * A[1] + b * B[1] + c * C[1]) / (2 * s)];
  const dist = (P) => hypot(P[0] - I[0], P[1] - I[1]);
  const d = dist(A), e = dist(B), f = dist(C);
  const rad = [
    (r / (2 * (s - a))) * (s - r - (e + f - d)),
    (r / (2 * (s - b))) * (s - r - (f + d - e)),
    (r / (2 * (s - c))) * (s - r - (d + e - f)),
  ];
  const mal = rad.map((rr, i) => ({ x: V[i][0] + (I[0] - V[i][0]) * (rr / r), y: V[i][1] + (I[1] - V[i][1]) * (rr / r), r: rr }));
  // Each side by the vertex it faces: lines[0] is BC.
  const lines = [sideLine(B, C, A), sideLine(C, A, B), sideLine(A, B, C)];
  const q = V.map((P) => {
    const sh = r / dist(P);
    return (1 - sh) / (1 + sh);
  });
  return { V, area, r, I, mal, lines, q };
}

// The largest circle tangent to three mutually tangent things (at most one
// of them a side): its radius from Descartes, its centre from two of the
// three, choosing of the two crossings the one that also touches the third.
function soddy(o) {
  const k = o.map((x) => (x.line ? 0 : 1 / x.r));
  const kk = k[0] + k[1] + k[2] + 2 * sqrt(max(0, k[0] * k[1] + k[1] * k[2] + k[2] * k[0]));
  const rho = 1 / kk;
  const circ = o.filter((x) => !x.line), ln = o.find((x) => x.line);
  const third = ln || o[2];
  let pts;
  if (ln) {
    // Points rho inside the side, at r1 + rho from the circle.
    const C1 = circ[0], R = C1.r + rho, off = ln.nx * C1.x + ln.ny * C1.y - (ln.c + rho);
    const h2 = R * R - off * off;
    if (h2 < 0) return null;
    const fx = C1.x - ln.nx * off, fy = C1.y - ln.ny * off, hh = sqrt(h2);
    pts = [[fx - ln.ny * hh, fy + ln.nx * hh], [fx + ln.ny * hh, fy - ln.nx * hh]];
    // Of the two, the one that touches the other circle.
    const C2 = circ[1], want = C2.r + rho;
    const e0 = abs(hypot(pts[0][0] - C2.x, pts[0][1] - C2.y) - want), e1 = abs(hypot(pts[1][0] - C2.x, pts[1][1] - C2.y) - want);
    const p = e0 < e1 ? pts[0] : pts[1];
    return { x: p[0], y: p[1], r: rho };
  }
  const C1 = o[0], C2 = o[1], R1 = C1.r + rho, R2 = C2.r + rho;
  const dx = C2.x - C1.x, dy = C2.y - C1.y, D = hypot(dx, dy);
  const ax = (D * D + R1 * R1 - R2 * R2) / (2 * D), h2 = R1 * R1 - ax * ax;
  if (h2 < 0 || D <= 0) return null;
  const ux = dx / D, uy = dy / D, hh = sqrt(h2), mx = C1.x + ux * ax, my = C1.y + uy * ax;
  pts = [[mx - uy * hh, my + ux * hh], [mx + uy * hh, my - ux * hh]];
  const want = third.r + rho;
  const e0 = abs(hypot(pts[0][0] - third.x, pts[0][1] - third.y) - want), e1 = abs(hypot(pts[1][0] - third.x, pts[1][1] - third.y) - want);
  const p = e0 < e1 ? pts[0] : pts[1];
  return { x: p[0], y: p[1], r: rho };
}

// A gap's best circle: in a corner the next image of its circle under the
// homothety at the vertex, otherwise the Soddy circle.
function best(T, g) {
  if (g.corner >= 0) {
    const P = T.V[g.corner], q = T.q[g.corner], c = g.o[0];
    return { x: P[0] + (c.x - P[0]) * q, y: P[1] + (c.y - P[1]) * q, r: c.r * q };
  }
  return soddy(g.o);
}

function addGap(list, T, corner, o) {
  const g = { corner, o, c: null };
  g.c = best(T, g);
  if (g.c && g.c.r > 0.05) list.push(g);
}

// Takes the largest gap n times, splitting it each time. Returns the circles.
function grow(T, gaps, n) {
  const out = [];
  for (let k = 0; k < n && gaps.length; k++) {
    let bi = 0;
    for (let i = 1; i < gaps.length; i++) if (gaps[i].c.r > gaps[bi].c.r) bi = i;
    const g = gaps[bi], c = g.c;
    gaps[bi] = gaps[gaps.length - 1];
    gaps.pop();
    out.push(c);
    if (g.corner >= 0) {
      // A corner leaves a smaller corner and the two cusps on its sides.
      const v = g.corner, old = g.o[0];
      addGap(gaps, T, v, [c]);
      addGap(gaps, T, -1, [old, c, T.lines[(v + 1) % 3]]);
      addGap(gaps, T, -1, [old, c, T.lines[(v + 2) % 3]]);
    } else {
      const [p, q, r] = g.o;
      addGap(gaps, T, -1, [p, q, c]);
      addGap(gaps, T, -1, [q, r, c]);
      addGap(gaps, T, -1, [p, r, c]);
    }
  }
  return out;
}

// The greedy from an empty triangle: the incircle and then grow().
function greedy(T, n) {
  const inc = { x: T.I[0], y: T.I[1], r: T.r }, gaps = [];
  for (let v = 0; v < 3; v++) addGap(gaps, T, v, [inc]);
  return [inc].concat(grow(T, gaps, n - 1));
}

// After Malfatti's three: the middle, three corners and three cusps.
function afterMalfatti(T, n) {
  const [mA, mB, mC] = T.mal, gaps = [];
  addGap(gaps, T, -1, [mA, mB, mC]);
  for (let v = 0; v < 3; v++) addGap(gaps, T, v, [T.mal[v]]);
  addGap(gaps, T, -1, [mA, mB, T.lines[2]]);
  addGap(gaps, T, -1, [mB, mC, T.lines[0]]);
  addGap(gaps, T, -1, [mC, mA, T.lines[1]]);
  return grow(T, gaps, n);
}

function add(buf, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const p = (y * W + x) * 3;
  buf[p] += c[0] * a;
  buf[p + 1] += c[1] * a;
  buf[p + 2] += c[2] * a;
}

// A disc lit at `fill` inside, rising towards a rim line at `rim`.
function disc(buf, oy, c, col, fill, rim) {
  const cx = c.x, cy = c.y + oy, r = c.r;
  if (r < 0.7) {
    add(buf, round(cx), round(cy), col, (fill + rim) * r * 0.9);
    return;
  }
  for (let y = floor(cy - r - 1); y <= cy + r + 1; y++)
    for (let x = floor(cx - r - 1); x <= cx + r + 1; x++) {
      const e = hypot(x - cx, y - cy), u = e / r;
      const inside = cl(r + 0.5 - e, 0, 1);
      if (inside <= 0) continue;
      const ring = cl(1.2 - abs(e - r + 0.7), 0, 1);
      add(buf, x, y, col, inside * (fill * (0.7 + 0.3 * u * u) * (1 - ring) + rim * ring));
    }
}

// The triangle: its inside a faint grey, its sides a pale line.
function shape(buf, T, oy, ink) {
  const V = T.V.map((P) => [P[0], P[1] + oy]);
  const y0 = max(0, floor(min(V[0][1], V[1][1], V[2][1])) - 1), y1 = min(H - 1, Math.ceil(max(V[0][1], V[1][1], V[2][1])) + 1);
  for (let y = y0; y <= y1; y++)
    for (let x = 0; x < W; x++) {
      let dmin = 1e9, dseg = 1e9;
      for (let i = 0; i < 3; i++) {
        const L = T.lines[i];
        dmin = min(dmin, L.nx * x + L.ny * (y - oy) - L.c);
        const P = V[(i + 1) % 3], Q = V[(i + 2) % 3], dx = Q[0] - P[0], dy = Q[1] - P[1];
        const tt = cl(((x - P[0]) * dx + (y - P[1]) * dy) / (dx * dx + dy * dy), 0, 1);
        dseg = min(dseg, hypot(P[0] + tt * dx - x, P[1] + tt * dy - y));
      }
      const inside = cl(dmin + 0.5, 0, 1), edge = cl(1.1 - dseg, 0, 1);
      add(buf, x, y, ink, 0.13 * inside * (1 - edge) + 0.62 * edge);
    }
}

function digit(buf, ch, x0, y0, col) {
  const g = ch === "%" ? PCT : DIG[ch];
  for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j] & (4 >> i)) add(buf, x0 + i, y0 + j, col, 1);
}

// A bar of the covered share, over a faint track for the whole triangle,
// and the share in tenths of a percent at the right.
function bar(buf, row, numRow, share, col, pale) {
  const len = share * BARLEN;
  for (let x = BAR0; x < BAR0 + BARLEN; x++) {
    const f = cl(BAR0 + len - x, 0, 1);
    for (let y = row - 1; y <= row + 1; y++) add(buf, x, y, col, 0.12 + 0.83 * f);
  }
  const tenths = round(share * 1000), s = String(floor(tenths / 10)).padStart(2, " ");
  let x = 46;
  for (const ch of s) {
    if (ch !== " ") digit(buf, +ch, x, numRow, pale);
    x += 4;
  }
  add(buf, x, numRow + 4, pale, 1);
  digit(buf, tenths % 10, x + 2, numRow, pale);
  digit(buf, "%", x + 6, numRow, pale);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, col = S.col, pale = S.pale;
  buf.fill(0);
  for (let i = 0; i < 2; i++) {
    hsv(S.hue + HUES[i], 0.85, 1, col[i]);
    hsv(S.hue + HUES[i], 0.35, 1, pale[i]);
  }
  const T = solve(triangle(S.t, S.thin));
  const ink = [0.85, 0.85, 0.9];
  const greedyAll = greedy(T, 3 + S.more), malMore = afterMalfatti(T, S.more);
  const sets = [T.mal, greedyAll.slice(0, 3)];
  const extra = [malMore, greedyAll.slice(3)];
  for (let i = 0; i < 2; i++) {
    const L = TOPS[i], oy = L.base;
    shape(buf, T, oy, ink);
    for (const c of sets[i]) disc(buf, oy, c, col[i], 0.42, 1);
    for (const c of extra[i]) disc(buf, oy, c, pale[i], 0.45, 0.85);
    let a = 0;
    for (const c of sets[i]) a += PI * c.r * c.r;
    bar(buf, L.bar, L.num, a / T.area, col[i], pale[i]);
  }
  for (let p = 0; p < W * H; p++)
    display.setPixel(p % W, floor(p / W), round(cl(buf[p * 3], 0, 1) * 255), round(cl(buf[p * 3 + 1], 0, 1) * 255), round(cl(buf[p * 3 + 2], 0, 1) * 255));
}
