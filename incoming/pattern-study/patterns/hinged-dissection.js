// ===== Patternflow pattern =====
// Title:   Hinged Dissection
// Family:  geometry
// Idea:    An equilateral triangle 62 LEDs on a side, cut into Dudeney's four pieces and hinged at three points, swings open into a chain that stands the height of the panel and folds shut into a square of the same area, then swings back.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Dudeney's hinged dissection of the triangle into the square (Henry Dudeney, 1902), and the Wallace-Bolyai-Gerwien theorem that any two polygons of equal area cut into each other (William Wallace, 1807; Farkas Bolyai, 1832; Paul Gerwien, 1833), pattern round 41
// Round:   41
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Hold=0..3, Gap=0..1
//
// Knob 1: Hue. Turns the four pieces round the wheel together. At 0 they are gold, rose, azure and mint.
// Knob 2: Speed. At 2 one swing, triangle to square, takes 2.5 seconds; at 0.2 it takes 25 and at 3 it takes 1.7.
// Knob 3: Hold. Seconds the triangle and the square stand still before the next swing: none at 0, so the pieces never stop, up to 3.
// Knob 4: Gap. Pushes each piece out from the middle of the chain, an exploded view: at 0 the pieces meet along their cuts with a dark seam under 1 LED wide, at 1 each has moved 7 LEDs out.

const W = 64, H = 128;
const { floor, min, max, sqrt, sin, cos, abs, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = [v, q, p, p, t, v][i];
  out[o + 1] = [t, v, v, q, p, p][i];
  out[o + 2] = [p, p, t, v, v, q][i];
}

// Dudeney's cut, on a triangle of side 2 with A bottom left, B the apex and
// C bottom right. D and E are the midpoints of AB and BC. The square has
// side s = 3^(1/4), the root of the triangle's area sqrt(3). J is the point
// of AC at distance s from E, K is 1 (half a side) further along AC, and L
// and M are the feet of the perpendiculars from D and K to the cut EJ.
// Pieces, each listed clockwise: ADLJ, DBEL, ECKM and the triangle JMK,
// hinged at D, E and K.
const S3 = sqrt(3), SQ = 3 ** 0.25;
const A = [0, 0], B = [1, S3], C = [2, 0], D = [0.5, S3 / 2], E = [1.5, S3 / 2];
const J = [1.5 - sqrt(SQ * SQ - 0.75), 0], K = [J[0] + 1, 0];
const U = [(J[0] - E[0]) / SQ, (J[1] - E[1]) / SQ];
const foot = (p) => {
  const t = (p[0] - E[0]) * U[0] + (p[1] - E[1]) * U[1];
  return [E[0] + t * U[0], E[1] + t * U[1]];
};
const L = foot(D), M = foot(K);
const PIECES = [[A, D, L, J], [D, B, E, L], [E, C, K, M], [J, M, K]];
// Which corner of each piece is a hinge, as [piece, corner] pairs per hinge.
const HINGES = [[[0, 1], [1, 0]], [[1, 2], [2, 0]], [[2, 2], [3, 2]]];
const AREA = PIECES.map((p) => {
  let a = 0;
  for (let i = 0; i < p.length; i++) a += p[i][0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * p[i][1];
  return abs(a) / 2;
});

// LEDs per unit: the triangle is 62 LEDs on a side, the square 40.8.
const SC = 31;
// Base hues: gold, rose, azure, mint.
const HUES = [0.13, 0.95, 0.58, 0.4];

// Swing f runs 0 (triangle) to 1 (square). Every hinge turns the same way
// by pi f, so piece n has turned n pi f: a search over the swing found no
// overlap this way, where turning any hinge the other way overlaps.
// The whole chain is turned by G(f) degrees as well: 0 at the triangle,
// -41.15 at the square, which is the angle that sets the square upright,
// and between them a sum of three sines fitted so the open chain stands
// along the panel and never hangs more than 4 LEDs over either side.
const G = (f) => (PI / 180) * (-41.1503 * f + 34 * sin(PI * f) + 57 * sin(2 * PI * f) + 34 * sin(3 * PI * f));

function rotAbout(p, c, a, out) {
  const x = p[0] - c[0], y = p[1] - c[1], cs = cos(a), sn = sin(a);
  out[0] = c[0] + cs * x - sn * y;
  out[1] = c[1] + sn * x + cs * y;
}

// The four pieces at swing f, in triangle units.
function pose(f, out) {
  const t = PI * f, q = [0, 0];
  for (let n = 0; n < 4; n++) {
    const src = PIECES[n], dst = out[n];
    for (let i = 0; i < src.length; i++) {
      let p = src[i];
      // Turn about the hinges from the far end of the chain inward: K, E, D.
      if (n >= 3) (rotAbout(p, K, t, q), (p = [q[0], q[1]]));
      if (n >= 2) (rotAbout(p, E, t, q), (p = [q[0], q[1]]));
      if (n >= 1) (rotAbout(p, D, t, q), (p = [q[0], q[1]]));
      dst[i][0] = p[0];
      dst[i][1] = p[1];
    }
  }
}

function centroid(p) {
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length], c = x0 * y1 - x1 * y0;
    a += c;
    x += (x0 + x1) * c;
    y += (y0 + y1) * c;
  }
  return [x / (3 * a), y / (3 * a)];
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, hold: 0, gap: 0.06,
    tau: 0, dir: 1, wait: 0, begun: false,
    world: PIECES.map((p) => p.map(() => [0, 0])),
    scr: PIECES.map((p) => p.map(() => [0, 0])),
    col: new Float32Array(4 * 6), colHue: NaN,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.hold = cl(k[2], 0, 3);
  S.gap = cl(k[3], 0, 1);
  // The triangle stands for one hold before the first swing too.
  if (!S.begun) (S.begun = true), (S.wait = S.hold);
  if (S.wait > 0) {
    S.wait = min(S.wait, S.hold) - d;
    return;
  }
  S.tau += (S.dir * d * S.speed) / 5;
  if (S.tau >= 1) (S.tau = 1), (S.dir = -1), (S.wait = S.hold);
  else if (S.tau <= 0) (S.tau = 0), (S.dir = 1), (S.wait = S.hold);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { world, scr, col } = S;
  if (S.colHue !== S.hue) {
    for (let n = 0; n < 4; n++) {
      hsv(S.hue + HUES[n], 0.8, 0.9, col, n * 6);
      hsv(S.hue + HUES[n], 0.42, 1, col, n * 6 + 3);
    }
    S.colHue = S.hue;
  }
  const t = S.tau, f = t * t * (3 - 2 * t);
  pose(f, world);
  // Turn the chain about its centre of area, then centre its bounding box.
  let ax = 0, ay = 0, at = 0;
  const cent = world.map(centroid);
  for (let n = 0; n < 4; n++) (ax += AREA[n] * cent[n][0]), (ay += AREA[n] * cent[n][1]), (at += AREA[n]);
  (ax /= at), (ay /= at);
  const g = G(f), cg = cos(g), sg = sin(g);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let n = 0; n < 4; n++)
    for (let i = 0; i < world[n].length; i++) {
      const x = world[n][i][0] - ax, y = world[n][i][1] - ay, X = cg * x - sg * y, Y = sg * x + cg * y;
      scr[n][i][0] = X;
      scr[n][i][1] = Y;
      (x0 = min(x0, X)), (x1 = max(x1, X)), (y0 = min(y0, Y)), (y1 = max(y1, Y));
    }
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  // To LEDs, y down. The gap pushes each piece out along the line from the
  // chain's centre to its own.
  const gapL = 7 * S.gap;
  const polys = [];
  for (let n = 0; n < 4; n++) {
    let cx = 0, cy = 0;
    for (const p of scr[n]) (cx += p[0]), (cy += p[1]);
    (cx /= scr[n].length), (cy /= scr[n].length);
    const r = hypot(cx, cy) || 1, ox = (gapL * cx) / r, oy = (gapL * cy) / r;
    const pts = scr[n].map((p) => [W / 2 + (p[0] - mx) * SC + ox, H / 2 - (p[1] - my) * SC - oy]);
    // Edges as half-planes, n.p <= c inside, with n turned outward by the
    // sign of the piece's area as it now lies.
    let sa = 0;
    for (let i = 0; i < pts.length; i++) sa += pts[i][0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * pts[i][1];
    const sgn = sa > 0 ? 1 : -1, edges = [];
    let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = pts[i], [qx, qy] = pts[(i + 1) % pts.length], len = hypot(qx - px, qy - py);
      const nx = (sgn * (qy - py)) / len, ny = (-sgn * (qx - px)) / len;
      edges.push(nx, ny, nx * px + ny * py);
      (bx0 = min(bx0, px)), (bx1 = max(bx1, px)), (by0 = min(by0, py)), (by1 = max(by1, py));
    }
    polys.push({ edges, pts, bx0, bx1, by0, by1 });
  }
  // Signed distance to a convex piece: the largest of its edge distances.
  // Inside by more than 0.35 LED is lit, so pieces that touch keep a dark
  // seam; the outer 1.1 LED of a piece is its rim.
  const sd = (e, x, y) => {
    let m = -1e9;
    for (let i = 0; i < e.length; i += 3) m = max(m, e[i] * x + e[i + 1] * y - e[i + 2]);
    return m;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5;
      let r = 0, gg = 0, b = 0;
      for (let n = 0; n < 4; n++) {
        const P = polys[n];
        if (px < P.bx0 || px > P.bx1 || py < P.by0 || py > P.by1) continue;
        const dd = sd(P.edges, px, py);
        if (dd > -0.35) continue;
        const o = n * 6 + (dd > -1.45 ? 3 : 0);
        (r = col[o]), (gg = col[o + 1]), (b = col[o + 2]);
      }
      display.setPixel(x, y, floor(r * 255), floor(gg * 255), floor(b * 255));
    }
  // The hinges: a white pin on each piece's own copy of the hinge point.
  for (const pair of HINGES)
    for (const [n, i] of pair) {
      const [hx, hy] = polys[n].pts[i];
      for (let y = floor(hy - 2); y <= floor(hy + 2); y++)
        for (let x = floor(hx - 2); x <= floor(hx + 2); x++) {
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          if (hypot(x + 0.5 - hx, y + 0.5 - hy) < 1.6) display.setPixel(x, y, 255, 255, 255);
        }
    }
}
