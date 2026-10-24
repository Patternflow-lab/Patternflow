// ===== Patternflow pattern =====
// Title:   Penrose
// Family:  geometry
// Idea:    A Penrose tiling of fat and thin rhombs zooms for ever into its five-fold centre, and a five-petalled ring of light opening from the middle splits every tile it passes into tiles a golden ratio smaller.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 25, after Roger Penrose's rhomb tiling (P3) and Raphael Robinson's golden triangles
// Round:   25
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Size=7..15, Glow=0..1
//
// Knob 1: Hue. Turns all the tile colours round the colour wheel together.
// Knob 2: Speed. How fast it zooms. At 2 the picture grows by the golden ratio every three and a third seconds and a new ring opens each time; at 0.2 it takes half a minute.
// Knob 3: Size. The tile edge in LEDs, 7 to 15, when a level begins; the tiles grow from there until the ring splits them.
// Knob 4: Glow. How much of the light comes from the ring. At 0 the glass is lit all over and the ring is a thin line of light; at 1 the glass stands dark and lights up only behind the ring.
// Buttons: K1 tap turns the tiling into kites and darts (P2) behind a ring that opens from the centre; tap again for the rhombs.

// The centre sits on an LED column, so the edges along the five-fold axis
// draw as one dark LED rather than two grey ones.
const W = 64, H = 128, N = W * H, CX = 31.5, CY = 64;
const { min, max, floor, ceil, sqrt, exp, cos, sin, abs, round, hypot, PI } = Math;
const PHI = (1 + sqrt(5)) / 2;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The smallest Size, how far the splitting ring runs in one level, the reach
// of its five petals and how many levels lie between the seed and the tiles.
const EMIN = 7, RHO = 130, PET = 0.12, DEEP = 6;

// Robinson's golden triangles. A triangle [kind, A, B, C, parent] is half a
// tile: AB and AC are tile edges, BC runs through the middle of the tile.
// Kind 0 is the sharp one (36-72-72), kind 1 the blunt one (108-36-36).
// Rhombs (P3) and kites and darts (P2) split them by different rules.
function split(fam, T, out, idx, R) {
  const put = (k, ax, ay, bx, by, cx, cy) => {
    if (reach(ax, ay, bx, by, cx, cy) < R) out.push([k, ax, ay, bx, by, cx, cy, idx]);
  };
  const [k, ax, ay, bx, by, cx, cy] = T;
  const g = (p, q) => p + (q - p) / PHI;
  if (fam === 0) {
    if (k === 0) {
      const px = g(ax, bx), py = g(ay, by);
      put(0, cx, cy, px, py, bx, by);
      put(1, px, py, cx, cy, ax, ay);
    } else {
      const qx = g(bx, ax), qy = g(by, ay), rx = g(bx, cx), ry = g(by, cy);
      put(1, rx, ry, cx, cy, ax, ay);
      put(1, qx, qy, rx, ry, bx, by);
      put(0, rx, ry, qx, qy, ax, ay);
    }
  } else if (k === 0) {
    const qx = g(ax, bx), qy = g(ay, by), rx = g(bx, cx), ry = g(by, cy);
    put(1, rx, ry, qx, qy, bx, by);
    put(0, qx, qy, ax, ay, rx, ry);
    put(0, cx, cy, ax, ay, rx, ry);
  } else {
    const px = g(cx, ax), py = g(cy, ay);
    put(1, bx, by, px, py, ax, ay);
    put(0, px, py, cx, cy, bx, by);
  }
}

// How far the origin is from a triangle.
function seg(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = cl(-(ax * dx + ay * dy) / (dx * dx + dy * dy), 0, 1);
  return hypot(ax + t * dx, ay + t * dy);
}
function reach(ax, ay, bx, by, cx, cy) {
  const s1 = ax * by - ay * bx, s2 = bx * cy - by * cx, s3 = cx * ay - cy * ax;
  if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) return 0;
  return min(seg(ax, ay, bx, by), seg(bx, by, cx, cy), seg(cx, cy, ax, ay));
}

// One tiling, three levels deep. Level 0 has tile edge 1; levels 1 and 2 are
// it split once and twice. Level 2 blown up by phi squared and turned 36
// degrees is level 0 again, which is what lets the zoom run for ever. The
// rhombs grow from a star of five fat rhombs, kites and darts from a sun of
// five kites; both come back to themselves every second split. Each level
// reaches just past the corners of the panel at the smallest Size.
function build(fam, scale) {
  const s = EMIN * scale, R = [75 / s + 3, 75 / s + 2, 75 / (s * PHI) + 1.5];
  let T = [];
  for (let i = 0; i < 10; i++) {
    const a = -PI / 2 + ((2 * PI) / 5) * (i >> 1), b = a + (i & 1 ? PI : -PI) / 5, L = PHI ** DEEP;
    if (fam === 0) T.push([1, cos(b) * L, sin(b) * L, 0, 0, cos(a) * L * PHI, sin(a) * L * PHI, 0]);
    else T.push([0, cos(b) * L, sin(b) * L, 0, 0, cos(a) * L, sin(a) * L, 0]);
  }
  const levels = [];
  for (let d = 0; d < DEEP + 2; d++) {
    const out = [];
    T.forEach((t, i) => split(fam, t, out, i, R[max(0, d - DEEP + 1)]));
    T = out;
    if (d >= DEEP - 1) levels.push(T);
  }
  return levels;
}

// Every corner where tiles meet is one of seven kinds; for kites and darts
// Conway named them sun, star, ace, deuce, jack, queen and king. A tile's
// colour class comes from its kind and the kinds of its four corners: ten
// classes of rhomb, eight of kite and dart.
const vkey = (x, y) => round(x * 4096) * 1048576 + round(y * 4096);
// The angle at A, B and C in tenths of a turn, sharp then blunt, per tiling.
const ANG = [
  [1, 2, 2, 3, 1, 1],
  [2, 1, 2, 1, 3, 1],
];
function classify(fam, levels) {
  const an = ANG[fam];
  const maps = levels.map((L) => {
    const V = new Map();
    const add = (x, y, slot) => {
      const k = vkey(x, y);
      let c = V.get(k);
      if (!c) V.set(k, (c = new Array(16).fill(0)));
      c[slot]++;
    };
    for (const [k, ax, ay, bx, by, cx, cy] of L) {
      add(ax, ay, k * 8 + an[k * 3]);
      add(bx, by, k * 8 + 4 + an[k * 3 + 1]);
      add(cx, cy, k * 8 + 4 + an[k * 3 + 2]);
    }
    // A corner cut off at the edge of the patch does not close to 360 degrees.
    for (const [k, c] of V) V.set(k, c.reduce((s, n, i) => s + n * (i & 3), 0) === 10 ? c.join(" ") : "x");
    return V;
  });
  const vnames = [...new Set(maps.flatMap((V) => [...V.values()]))].sort(), X = vnames.indexOf("x");
  const id = new Map(vnames.map((n, i) => [n, i]));
  const codes = levels.map((L, j) => {
    const V = maps[j], vt = (x, y) => id.get(V.get(vkey(x, y))), mid = new Map();
    L.forEach((t, i) => {
      const k = vkey(t[3] + t[5], t[4] + t[6]);
      mid.set(k, mid.has(k) ? [mid.get(k)[0], i] : [i]);
    });
    return L.map((t, i) => {
      const pair = mid.get(vkey(t[3] + t[5], t[4] + t[6])), o = L[pair[0] === i ? pair[1] ?? i : pair[0]];
      const a0 = vt(t[1], t[2]), a1 = vt(o[1], o[2]), b0 = vt(t[3], t[4]), b1 = vt(t[5], t[6]);
      if (a0 === X || a1 === X || b0 === X || b1 === X) return t[0] * 4096;
      return t[0] * 4096 + min(a0, a1) * 512 + max(a0, a1) * 64 + min(b0, b1) * 8 + max(b0, b1);
    });
  });
  const names = [...new Set(codes.flat())].sort((p, q) => p - q), cls = new Map(names.map((n, i) => [n, i]));
  return codes.map((L) => L.map((n) => cls.get(n)));
}

// Packed for drawing: corners, colour class, parent, and the tile's middle as
// its distance from the centre (pulled in along five petals) and how far the
// triangle can reach past it.
const petal = (x, y, r) => (r > 1e-6 ? (5 * x ** 4 * y - 10 * x * x * y ** 3 + y ** 5) / r ** 5 : 0);
function pack(levels, cls) {
  return levels.map((L, j) => {
    const n = L.length, P = { n, xy: new Float32Array(n * 6), cls: new Uint8Array(cls[j]), par: new Int32Array(n), rq: new Float32Array(n), near: new Float32Array(n), age: new Float32Array(n) };
    L.forEach((t, i) => {
      for (let q = 0; q < 6; q++) P.xy[i * 6 + q] = t[q + 1];
      P.par[i] = t[7];
      // The middle of BC is the middle of the whole tile, so both halves of
      // a tile split together.
      const mx = (t[3] + t[5]) / 2, my = (t[4] + t[6]) / 2, r = hypot(mx, my);
      P.rq[i] = r * (1 + PET * petal(mx, my, r));
      P.near[i] = r - max(hypot(t[1] - mx, t[2] - my), hypot(t[3] - mx, t[4] - my));
    });
    return P;
  });
}

// P2 is drawn half a level larger so the two tilings show tiles of about the
// same area.
const SCALE = [1, sqrt(PHI)];
const FAM = [0, 1].map((f) => {
  const levels = build(f, SCALE[f]);
  return pack(levels, classify(f, levels));
});

// Hue offset, saturation and brightness of each colour class, in class order:
// the sharp kind first (thin rhombs, kites), then the blunt kind (fat rhombs,
// darts), each led by a fallback for tiles cut off at the edge of the patch,
// which never reach the panel. Fat rhombs round a five-pointed star and the
// darts of a star are gold.
const PAL = [
  [
    [0.6, 0.8, 0.75],
    [0.5, 0.85, 0.85],
    [0.42, 0.7, 0.95],
    [0.63, 0.85, 0.85],
    [0.12, 0.85, 1],
    [0.13, 0.89, 1],
    [0.15, 0.85, 1],
    [0.88, 0.75, 0.9],
    [0.76, 0.8, 0.75],
    [0.98, 0.8, 0.9],
    [0.1, 0.89, 1],
    [0.33, 0.8, 0.8],
  ],
  [
    [0.55, 0.8, 0.8],
    [0.5, 0.85, 0.85],
    [0.36, 0.75, 0.85],
    [0.62, 0.85, 0.85],
    [0.45, 0.75, 0.95],
    [0.12, 0.85, 1],
    [0.13, 0.89, 1],
    [0.9, 0.75, 0.9],
    [0.02, 0.8, 0.95],
    [0.78, 0.8, 0.8],
  ],
];
const GLOW = [255, 226, 150];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c] * 255;
}

// Each LED's distance from the centre, pulled in along five petals: the
// regrouping ring after a K1 tap opens along it.
const RR = new Float32Array(N);
for (let p = 0; p < N; p++) {
  const x = (p % W) + 0.5 - CX, y = floor(p / W) + 0.5 - CY, r = hypot(x, y);
  RR[p] = r * (1 + PET * petal(x, y, r));
}

export function setup(params) {
  params.s = { Z: 0, rot: 0, fam: 0, to: -1, rm: 0, hue: 0, e: EMIN, glow: 0.06, buf: new Float32Array(N * 3), col: new Float32Array(16 * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.e = cl(k[2], EMIN, 15);
  P.glow = cl(k[3], 0, 1);
  // Two levels of zoom, phi squared, bring level 2 to where level 0 was, a
  // tenth of a turn round.
  P.Z += d * cl(k[1], 0.2, 3) * 0.15;
  if (P.Z >= 2) (P.Z -= 2), (P.rot = (P.rot + PI / 5) % (2 * PI));
  if (P.to >= 0) {
    P.rm += d * 45;
    if (P.rm > 86) (P.fam = P.to), (P.to = -1);
  } else if (input.btnPressed && input.btnPressed[0]) (P.to = 1 - P.fam), (P.rm = 0);
}

// One golden triangle onto the LEDs, colour (r, g, b) and line light gl.
// Within LW of a tile edge an LED darkens into the 1-LED line between tiles;
// mode 1 and 2 keep only the LEDs inside or outside the regrouping ring.
const LW = 0.72;
function tri(P, xy, o, co, si, r, g, b, gl, mode) {
  const ax = CX + co * xy[o] - si * xy[o + 1], ay = CY + si * xy[o] + co * xy[o + 1];
  const bx = CX + co * xy[o + 2] - si * xy[o + 3], by = CY + si * xy[o + 2] + co * xy[o + 3];
  const cx = CX + co * xy[o + 4] - si * xy[o + 5], cy = CY + si * xy[o + 4] + co * xy[o + 5];
  const x0 = max(0, ceil(min(ax, bx, cx) - 0.5)), x1 = min(W - 1, floor(max(ax, bx, cx) - 0.5));
  const y0 = max(0, ceil(min(ay, by, cy) - 0.5)), y1 = min(H - 1, floor(max(ay, by, cy) - 0.5));
  if (x0 > x1 || y0 > y1) return;
  const sg = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax) > 0 ? 1 : -1, buf = P.buf;
  // Signed distances to AB, BC and CA as a*X + b*Y + c, positive inside.
  const l1 = sg / hypot(bx - ax, by - ay), l2 = sg / hypot(cx - bx, cy - by), l3 = sg / hypot(ax - cx, ay - cy);
  const a1 = (ay - by) * l1, b1 = (bx - ax) * l1, c1 = ((by - ay) * ax - (bx - ax) * ay) * l1;
  const a2 = (by - cy) * l2, b2 = (cx - bx) * l2, c2 = ((cy - by) * bx - (cx - bx) * by) * l2;
  const a3 = (cy - ay) * l3, b3 = (ax - cx) * l3, c3 = ((ay - cy) * cx - (ax - cx) * cy) * l3;
  for (let y = y0; y <= y1; y++) {
    const Y = y + 0.5, X = x0 + 0.5;
    let d1 = a1 * X + b1 * Y + c1, d2 = a2 * X + b2 * Y + c2, d3 = a3 * X + b3 * Y + c3;
    for (let x = x0, p = y * W + x0; x <= x1; x++, p++, d1 += a1, d2 += a2, d3 += a3) {
      if (d1 < -0.001 || d2 < -0.001 || d3 < -0.001 || (mode && (RR[p] < P.rm) !== (mode === 1))) continue;
      // The line's light keeps to its core, so a small tile behind the ring
      // keeps its colour.
      const w = cl((LW - min(d1, d3)) * 2.2, 0, 1), m = 1 - 0.93 * w, v = w * w * gl, q = p * 3;
      buf[q] = r * m + (GLOW[0] - r * m) * v;
      buf[q + 1] = g * m + (GLOW[1] - g * m) * v;
      buf[q + 2] = b * m + (GLOW[2] - b * m) * v;
    }
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const h = P.Z >= 1 ? 1 : 0, rho = (P.Z - h) * RHO, buf = P.buf, col = P.col, dim = 1 - 0.65 * P.glow;
  buf.fill(0);
  const jobs = P.to < 0 ? [[P.fam, 0]] : [[P.fam, 2], [P.to, 1]];
  for (const [fi, mode] of jobs) {
    const S = P.e * PHI ** P.Z * SCALE[fi], co = cos(P.rot) * S, si = sin(P.rot) * S, lim = 73 / S;
    const Lc = FAM[fi][h], Lf = FAM[fi][h + 1], pal = PAL[fi];
    for (let c = 0; c < pal.length; c++) hsv(P.hue + pal[c][0], pal[c][1], pal[c][2], col, c * 3);
    // A tile splits once the ring has passed its middle. The ring runs RHO
    // LEDs a level, well past the corners, so every tile on show has split
    // and its light has died before the next level begins.
    for (let i = 0; i < Lc.n; i++) {
      const a = (Lc.age[i] = rho - S * Lc.rq[i]);
      if (a > 0 || Lc.near[i] > lim) continue;
      const c = Lc.cls[i] * 3;
      tri(P, Lc.xy, i * 6, co, si, col[c] * dim, col[c + 1] * dim, col[c + 2] * dim, 0, mode);
    }
    // Behind the ring the new edges flash, and the glass lights up and fades
    // back down to what Glow leaves it.
    for (let j = 0; j < Lf.n; j++) {
      const a = Lc.age[Lf.par[j]];
      if (a <= 0 || Lf.near[j] > lim) continue;
      const c = Lf.cls[j] * 3, lit = dim + (1 - dim) * exp(-a / 10), fl = 0.3 * P.glow * exp(-a / 5);
      const r = col[c] * lit, g = col[c + 1] * lit, b = col[c + 2] * lit;
      tri(P, Lf.xy, j * 6, co, si, r + (255 - r) * fl, g + (255 - g) * fl, b + (255 - b) * fl, exp(-a / 2.5), mode);
    }
  }
  // The regrouping ring itself, a line of light.
  if (P.to >= 0)
    for (let p = 0; p < N; p++) {
      const w = 1 - abs(RR[p] - P.rm) / 1.6;
      if (w > 0) for (let q = 0; q < 3; q++) buf[p * 3 + q] += (GLOW[q] - buf[p * 3 + q]) * w * 0.85;
    }
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, buf[p], buf[p + 1], buf[p + 2]);
}
