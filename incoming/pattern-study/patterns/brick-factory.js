// ===== Patternflow pattern =====
// Title:   Brick Factory
// Family:  geometry
// Idea:    The complete bipartite graph K(m,n) is drawn with straight edges, every crossing of two edges lit as a spark: its vertices are thrown about the panel and wander so crossings flare up and go out all over it, then the drawing relaxes into Zarankiewicz's, m vertices split about the middle of a horizontal line and n of a vertical one, where the live count at the foot of the panel falls to the number Z(m,n) beside it and holds there before the vertices are thrown again.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Turán's brick factory problem (Pál Turán, met in a labour camp's brick yard in 1944, published in his A note of welcome, Journal of Graph Theory, 1977), the drawing and the number Z(m,n) of Kazimierz Zarankiewicz (1954), shown to be the crossing number when min(m,n) <= 6 by Daniel Kleitman (1970); 5 by 7 figures from Photon Disk (pattern round 70); pattern round 74
// Round:   74
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, m=4..6, n=6..9
//
// Knob 1: Hue. Turns the edge colours round the wheel. Each of the m vertices on the horizontal line gives its edges one colour, the m colours spread over two thirds of the wheel, blues lifted towards white so they read beside gold: at the opening 0 and m = 4 teal, blue, rose and gold, at 0.5 red, lime, sea green and azure. The sparks stay white-gold.
// Knob 2: Speed. At 2 the vertices fly to new places in 1.2 s, wander for 2.6 s, relax into Zarankiewicz's drawing in 3 s and hold it 2.6 s, 9.4 s a round. Every time scales as 2 / Speed: 94 s a round at 0.2, 6.3 s at 3.
// Knob 3: m. The vertices on the horizontal line, the smaller side: 4 at the opening, split 2 and 2 about the middle, 5 split 3 and 2, 6 split 3 and 3.
// Knob 4: n. The vertices on the vertical line: 6 at the opening, split 3 above the middle and 3 below, up to 9, split 5 and 4. Z(m,n) runs from 12 for the opening K(4,6), which wanders through 22 to 84 crossings, to 96 for K(6,9), which wanders through 180 to 380.
// Buttons: K1 tap throws the vertices again at once.

// K(m,n) has m vertices on one side and n on the other and an edge from
// every vertex of one side to every vertex of the other. In 1944 Turán
// asked how few crossings the rail tracks between m kilns and n storage
// yards could have. Zarankiewicz's drawing puts one side on the x axis and
// the other on the y axis, each split as evenly as it goes about the origin.
// Two edges cross only when they lie in the same quadrant and their ends
// are in opposite orders, so the count is the sum over the quadrants of
// C(p,2) C(q,2), which comes to
//   Z(m,n) = floor(m/2) floor((m-1)/2) floor(n/2) floor((n-1)/2).
// Kleitman proved no drawing does better when the smaller side is 6 or
// less. That none does for any m and n is Zarankiewicz's conjecture, still
// open.
//
// Every frame tests each pair of edges that share no vertex, up to 1080
// pairs for K(6,9), and remembers which pairs crossed, so a crossing that
// appears or goes out can flare where it happened.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const TAU = 2 * PI;
// The middle of the drawing, and the box the vertices are thrown into.
const OX = 31.5, OY = 58, BX0 = 4, BX1 = 59.5, BY0 = 4, BY1 = 112;
// Fly, wander, relax, hold, in seconds at Speed 2.
const DUR = [1.2, 2.6, 3, 2.6];
const MAXE = 54, FLARE = 0.55;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// 5 x 7 figures and Z from Photon Disk (pattern round 70), rows from the
// top. A 3 x 5 Z is a 2 whose middle bar has shrunk to one LED, and the
// two could not be told apart on the panel.
const GLYPH = {
  0: ".###. #...# #..## #.#.# ##..# #...# .###.", 1: "..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.", 2: ".###. #...# ....# ...#. ..#.. .#... #####",
  3: "##### ...#. ..#.. ...#. ....# #...# .###.", 4: "...#. ..##. .#.#. #..#. ##### ...#. ...#.", 5: "##### #.... ####. ....# ....# #...# .###.",
  6: "..##. .#... #.... ####. #...# #...# .###.", 7: "##### ....# ...#. ..#.. .#... .#... .#...", 8: ".###. #...# #...# .###. #...# #...# .###.",
  9: ".###. #...# #...# .#### ....# ...#. .##..", Z: "##### ....# ...#. ..#.. .#... #.... #####",
};
for (const k in GLYPH) GLYPH[k] = GLYPH[k].replace(/ /g, "");

const zar = (m, n) => floor(m / 2) * floor((m - 1) / 2) * floor(n / 2) * floor((n - 1) / 2);

// Zarankiewicz's places: the m vertices on the horizontal line, more of them
// on the left, and the n on the vertical line, more of them above.
function targets(S) {
  const { m, n } = S, pl = Math.ceil(m / 2), pr = m - pl, qu = Math.ceil(n / 2), qd = n - qu;
  const hs = 27.5 / pl, vs = (OY - 6) / qu;
  S.tA = [];
  for (let i = pl; i >= 1; i--) S.tA.push([OX - hs * i, OY]);
  for (let i = 1; i <= pr; i++) S.tA.push([OX + hs * i, OY]);
  S.tB = [];
  for (let j = qu; j >= 1; j--) S.tB.push([OX, OY - vs * j]);
  for (let j = 1; j <= qd; j++) S.tB.push([OX, OY + vs * j]);
}

// New places at random: the box is cut into 3 by 5 cells, at most one
// vertex to a cell (m + n is 15 at most), so the throw spreads over the
// whole panel; each vertex gets its own slow wander. The vertical side
// draws its cells first, so a change of n moves the whole throw.
function throwVertices(S) {
  const all = [...S.B, ...S.A], cells = [...Array(15).keys()];
  for (let i = cells.length - 1; i > 0; i--) {
    const j = floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const cw = (BX1 - BX0) / 3, ch = (BY1 - BY0) / 5;
  all.forEach((v, i) => {
    const c = cells[i], x = BX0 + ((c % 3) + 0.15 + 0.7 * Math.random()) * cw, y = BY0 + (floor(c / 3) + 0.15 + 0.7 * Math.random()) * ch;
    v.fx = v.x;
    v.fy = v.y;
    v.rx = x;
    v.ry = y;
    v.p1 = Math.random() * TAU;
    v.p2 = Math.random() * TAU;
    v.f1 = 0.25 + Math.random() * 0.3;
    v.f2 = 0.2 + Math.random() * 0.3;
    v.delay = Math.random() * 0.35;
  });
  S.phase = 0;
  S.pt = 0;
}

// Each side goes to its places in the order it already has: the vertices of
// the horizontal side sorted left to right, the vertical side top to bottom,
// so the paths into the drawing cross as little as they can.
function assign(S) {
  const a = S.A.map((v, i) => i).sort((i, j) => S.A[i].x - S.A[j].x);
  a.forEach((i, k) => ((S.A[i].tx = S.tA[k][0]), (S.A[i].ty = S.tA[k][1])));
  const b = S.B.map((v, i) => i).sort((i, j) => S.B[i].y - S.B[j].y);
  b.forEach((i, k) => ((S.B[i].tx = S.tB[k][0]), (S.B[i].ty = S.tB[k][1])));
}

function build(S, m, n) {
  S.m = m;
  S.n = n;
  targets(S);
  const mk = () => ({ x: OX, y: OY, fx: OX, fy: OY, rx: OX, ry: OY, tx: OX, ty: OY, p1: 0, p2: 0, f1: 0, f2: 0, delay: 0, sx: OX, sy: OY });
  S.A = Array.from({ length: m }, mk);
  S.B = Array.from({ length: n }, mk);
  throwVertices(S);
  // The first frame lands them straight on their thrown places.
  for (const v of [...S.A, ...S.B]) (v.x = v.fx = v.rx), (v.y = v.fy = v.ry);
  S.phase = 1;
  S.pt = 0;
  S.was.fill(0);
  S.quiet = true;
  S.flares.length = 0;
}

export function setup(params) {
  params.s = {
    t: 0, m: 0, n: 0, hue: 0, speed: 2, phase: 1, pt: 0, btn: false, A: [], B: [], tA: [], tB: [],
    was: new Uint8Array(MAXE * MAXE), lastX: new Float32Array(MAXE * MAXE), lastY: new Float32Array(MAXE * MAXE),
    cx: new Float32Array(1200), cy: new Float32Array(1200), count: 0, bump: 0, flares: [], quiet: true,
    acc: new Float32Array(W * H * 3), spark: new Float32Array(W * H), col: [0, 0, 0],
  };
  return params.s;
}

// Where each vertex is in the current phase: flying out along a smooth path,
// wandering about its thrown place, or easing into Zarankiewicz's place.
function place(S, sc) {
  const ph = S.phase, u = S.pt / (DUR[ph] * sc), t = S.t;
  for (const v of [...S.A, ...S.B]) {
    const wx = 5 * sin(t * v.f1 * TAU * 0.5 + v.p1) + 2 * sin(t * v.f2 * TAU + v.p2);
    const wy = 7 * sin(t * v.f2 * TAU * 0.5 + v.p2) + 2.5 * sin(t * v.f1 * TAU + v.p1);
    if (ph === 0) {
      // Each vertex sets off up to 0.17 of the flight late; its wander
      // grows in as it lands.
      const e = smooth(cl((u - v.delay * 0.5) / (1 - 0.175), 0, 1)), k = smooth(e);
      v.x = v.fx + (v.rx + wx * k - v.fx) * e;
      v.y = v.fy + (v.ry + wy * k - v.fy) * e;
    } else if (ph === 1) {
      v.x = v.rx + wx;
      v.y = v.ry + wy;
      v.sx = v.x;
      v.sy = v.y;
    } else if (ph === 2) {
      const e = smooth(cl((u - v.delay) / (1 - 0.35), 0, 1));
      v.x = v.sx + (v.tx - v.sx) * e;
      v.y = v.sy + (v.ty - v.sy) * e;
    } else {
      v.x = v.tx;
      v.y = v.ty;
    }
    v.x = cl(v.x, BX0, BX1);
    v.y = cl(v.y, BY0, BY1);
  }
}

// Every pair of edges a_i b_j and a_k b_l with i != k and j != l; a pair
// that shares a vertex never crosses in a straight drawing. Each end of one
// edge is tested for the side of the other it lies on; the edges cross when
// both pairs of ends lie on opposite sides. Where a pair last crossed is
// kept, so a crossing that goes out flares where it was.
function crossings(S) {
  const { A, B, m, n, was, lastX, lastY, cx, cy } = S;
  let c = 0;
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++) {
      const ax = A[i].x, ay = A[i].y, ex = B[j].x - ax, ey = B[j].y - ay, e1 = i * n + j;
      for (let k = i + 1; k < m; k++)
        for (let l = 0; l < n; l++) {
          if (l === j) continue;
          const kx = A[k].x, ky = A[k].y, fx = B[l].x - kx, fy = B[l].y - ky;
          const d1 = ex * (ky - ay) - ey * (kx - ax), d2 = ex * (B[l].y - ay) - ey * (B[l].x - ax);
          const d3 = fx * (ay - ky) - fy * (ax - kx), d4 = fx * (B[j].y - ky) - fy * (B[j].x - kx);
          const e2 = k * n + l, key = e1 * MAXE + e2;
          const hit = d1 * d2 < 0 && d3 * d4 < 0;
          if (hit) {
            const s = d3 / (d3 - d4), x = ax + s * ex, y = ay + s * ey;
            cx[c] = x;
            cy[c] = y;
            c++;
            lastX[key] = x;
            lastY[key] = y;
          }
          if (hit !== !!was[key] && !S.quiet && S.flares.length < 400) S.flares.push({ x: lastX[key], y: lastY[key], age: 0, on: hit });
          was[key] = hit ? 1 : 0;
        }
    }
  S.quiet = false;
  return c;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 4, 6], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1], 0.2, 3);
  const m = round(cl(k[2], 4, 6)), n = round(cl(k[3], 6, 9)), btn = !!(input.btnPressed && input.btnPressed[0]);
  if (m !== S.m || n !== S.n) build(S, m, n);
  if (btn && !S.btn) throwVertices(S);
  S.btn = btn;
  const sc = 2 / S.speed;
  S.t += d;
  S.pt += d;
  if (S.pt >= DUR[S.phase] * sc) {
    S.pt = 0;
    if (S.phase === 3) throwVertices(S);
    else {
      S.phase++;
      if (S.phase === 2) assign(S);
    }
  }
  place(S, sc);
  const c = crossings(S);
  if (c !== S.count) S.bump = 1;
  S.count = c;
  S.bump = max(0, S.bump - d / 0.35);
  for (const f of S.flares) f.age += d / sc;
  S.flares = S.flares.filter((f) => f.age < FLARE);
}

// An antialiased line, added in: along the long axis each step lights the
// LEDs across it by a tent 1.3 LEDs either side of the true line, measured
// square to the line, so steep and shallow lines weigh the same.
function line(acc, x0, y0, x1, y1, c, w) {
  const st = abs(x1 - x0) < abs(y1 - y0);
  if (st) [x0, y0, x1, y1] = [y0, x0, y1, x1];
  if (x1 < x0) [x0, y0, x1, y1] = [x1, y1, x0, y0];
  const s = x1 > x0 ? (y1 - y0) / (x1 - x0) : 0, lim = st ? H - 1 : W - 1, k = 1 / sqrt(1 + s * s);
  for (let x = max(0, round(x0)); x <= min(lim, round(x1)); x++) {
    const y = y0 + (x - x0) * s;
    for (let iy = floor(y - 1.8); iy <= floor(y + 1.8); iy++) {
      const e = 1 - (abs(iy + 0.5 - y) * k) / 1.3;
      if (e > 0) add(acc, st ? iy : x, st ? x : iy, c, w * e * k * 1.3);
    }
  }
}
function add(acc, x, y, c, w) {
  if (x < 0 || x >= W || y < 0 || y >= H || w <= 0) return;
  const k = (y * W + x) * 3;
  acc[k] += c[0] * w;
  acc[k + 1] += c[1] * w;
  acc[k + 2] += c[2] * w;
}
// A soft round light of radius r about x, y.
function glow(acc, x, y, r, c, w) {
  for (let py = floor(y - r); py <= floor(y + r); py++)
    for (let px = floor(x - r); px <= floor(x + r); px++) {
      const dd = sqrt((px + 0.5 - x) ** 2 + (py + 0.5 - y) ** 2) / r;
      if (dd < 1) add(acc, px, py, c, w * (1 - dd) * (1 - dd));
    }
}
function ring(acc, x, y, r, c, w) {
  for (let py = floor(y - r - 1); py <= floor(y + r + 1); py++)
    for (let px = floor(x - r - 1); px <= floor(x + r + 1); px++) {
      const e = abs(sqrt((px + 0.5 - x) ** 2 + (py + 0.5 - y) ** 2) - r);
      if (e < 1) add(acc, px, py, c, w * (1 - e));
    }
}
function text(acc, str, x, y, c, w) {
  for (const ch of str) {
    const g = GLYPH[ch];
    if (g) for (let i = 0; i < 35; i++) if (g[i] === "#") add(acc, x + (i % 5), y + floor(i / 5), c, w);
    x += 6;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.A.length) return;
  const acc = S.acc, col = S.col, { A, B, m, n } = S;
  acc.fill(0);
  // The edges, coloured by their end on the horizontal side.
  const pal = [];
  for (let i = 0; i < m; i++) {
    const c = [0, 0, 0];
    hsv(S.hue + 0.47 + (0.66 * i) / max(1, m - 1), 0.78, 1, c);
    // Blue and violet are dim on the panel next to gold and teal: lift
    // them towards white until their luminance is at least 0.45.
    const lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2], up = max(0, 0.45 - lum) * 0.7;
    for (let q = 0; q < 3; q++) c[q] += (1 - c[q]) * up;
    pal.push(c);
  }
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) line(acc, A[i].x, A[i].y, B[j].x, B[j].y, pal[i], 0.5);
  // Sparks at the crossings, kept on a layer of their own where the
  // brightest wins, so a knot of crossings reads as many points and not as
  // one white blot. Then the flares of those that just came or went.
  const hot = [1, 0.86, 0.55], white = [1, 1, 1], sp = S.spark;
  sp.fill(0);
  for (let c = 0; c < S.count; c++) {
    const x = S.cx[c], y = S.cy[c];
    for (let py = floor(y - 1.5); py <= floor(y + 1.5); py++)
      for (let px = floor(x - 1.5); px <= floor(x + 1.5); px++) {
        if (px < 0 || px >= W || py < 0 || py >= H) continue;
        const dd = sqrt((px + 0.5 - x) ** 2 + (py + 0.5 - y) ** 2), v = dd < 0.75 ? 1 : 0.45 * max(0, 1 - (dd - 0.75) / 1.3);
        if (v > sp[py * W + px]) sp[py * W + px] = v;
      }
  }
  for (let p = 0; p < W * H; p++) {
    const v = sp[p];
    if (!v) continue;
    const k = p * 3, wv = v > 0.9 ? 1 : 0;
    acc[k] += hot[0] * v + 0.2 * wv;
    acc[k + 1] += hot[1] * v + 0.3 * wv;
    acc[k + 2] += hot[2] * v + 0.45 * wv;
  }
  for (const f of S.flares) {
    const u = f.age / FLARE, fade = (1 - u) * (1 - u);
    if (f.on) ring(acc, f.x, f.y, 1 + 5 * u, hot, 1.1 * fade);
    else glow(acc, f.x, f.y, 2 + 3 * u, hot, 1.1 * fade);
  }
  // The vertices: the horizontal side large in its colour, the vertical
  // side small and white.
  for (let i = 0; i < m; i++) {
    glow(acc, A[i].x, A[i].y, 3.2, pal[i], 1.6);
    glow(acc, A[i].x, A[i].y, 1.6, white, 0.9);
  }
  for (const v of B) glow(acc, v.x, v.y, 2.4, white, 1.3);
  // The count at the foot, left, against Z(m,n), right. The count flashes
  // when it changes and turns gold when it is down to Z.
  const z = zar(m, n), at = S.count === z;
  hsv(S.hue + 0.47, 0.25, 1, col);
  const cc = at ? hot : col;
  text(acc, String(S.count), 1, 119, cc, 0.75 + 0.25 * S.bump);
  const zs = String(z);
  text(acc, zs, 64 - 6 * zs.length, 119, at ? hot : col, at ? 0.95 : 0.6);
  text(acc, "Z", 64 - 6 * zs.length - 9, 119, col, 0.3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 3;
      display.setPixel(x, y, (255 * min(1, acc[k])) | 0, (255 * min(1, acc[k + 1])) | 0, (255 * min(1, acc[k + 2])) | 0);
    }
}
