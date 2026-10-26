// ===== Patternflow pattern =====
// Title:   Pentagon Tilings
// Family:  cells
// Idea:    The plane tiled by copies of one convex pentagon with thin dark grout, each tile coloured by which way it is turned and whether it is flipped, drifting slowly up the panel and to the left; the knob steps through five of the fifteen kinds, from Reinhardt's type 1, whose pentagon keeps changing shape while it tiles, through the Cairo tiling and Reinhardt's six-fold type 5 to Marjorie Rice's type 13 and the type 15 found in 2015, each new tiling replacing the old one tile by tile.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: tilings by one convex pentagon: types 1, 4 and 5 (Karl Reinhardt, 1918), type 13 (Marjorie Rice, 1976-77), type 15 (Casey Mann, Jennifer McLoud-Mann and David Von Derau, 2015), the list of fifteen shown complete (Michaël Rao, 2017), pattern round 57
// Round:   57
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Type=0..4, Size=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. A tile's colour says how it is turned: at 0 an unturned tile is cyan and the hue moves half way round the wheel as the turn goes from 0 to 360 degrees, so the Cairo tiling's four turns are cyan, azure, violet and magenta; a flipped tile takes a paler tint a little further on. At 0.5 the unturned tiles are red.
// Knob 2: Speed. The tiles drift up and to the left at 1.5 x Speed LEDs a second, 3 at the opening, and type 1 runs round its loop of shapes in 32 / Speed seconds, 16 s at the opening; 0.2 is ten times slower, 3 half as fast again.
// Knob 3: Type. 0 is type 1 (B + C = 180, two tiles a period), its pentagon morphing with B from 70 to 110 degrees; 1 the Cairo tiling, type 4 (b = c, d = e, B = D = 90, four tiles round each right-angled corner); 2 type 5 (a = b, d = e, A = 60, D = 120, six round A); 3 Rice's type 13 (d = 2a = 2e, B = E = 90, 2A + D = 360, eight tiles a period); 4 type 15 (a = c = e, b = 2a, angles 150, 60, 135, 105 and 90, twelve tiles a period). A change sweeps down the panel in 1.1 s, the new tiles taking over one at a time.
// Knob 4: Size. Every tiling is scaled so a tile covers the area of a square 12 LEDs on a side at 0 (13 at the opening) up to 28 at 1: about 50 tiles on the panel at the opening and 10 at the end.

const W = 64, H = 128;
const { floor, min, max, cos, sin, atan2, hypot, sqrt, PI, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const D2R = PI / 180;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// An isometry [c, s, m, tx, ty] sends p to R(th) diag(1, m) p + t.
const ap = (g, p) => {
  const y = g[2] * p[1];
  return [g[0] * p[0] - g[1] * y + g[3], g[1] * p[0] + g[0] * y + g[4]];
};
const rot = (th, q) => {
  const c = cos(th), s = sin(th);
  return [c, s, 1, q[0] - c * q[0] + s * q[1], q[1] - s * q[0] - c * q[1]];
};

// The pentagon from its angles A..E (degrees) and sides, side a = EA,
// b = AB, c = BC, d = CD, e = DE: walk from A along AB and turn by
// 180 - angle at each corner. sides(x, y) gives the five sides with two of
// them unknown; the walk must close, which fixes x and y.
function pentagon(ang, sides) {
  const walk = (sd) => {
    const v = [[0, 0]];
    let dir = 0, x = 0, y = 0;
    for (let k = 1; k <= 5; k++) {
      x += sd[k % 5] * cos(dir);
      y += sd[k % 5] * sin(dir);
      if (k < 5) v.push([x, y]), (dir += (180 - ang[k]) * D2R);
    }
    return { v, end: [x, y] };
  };
  const g0 = walk(sides(0, 0)).end, gx = walk(sides(1, 0)).end, gy = walk(sides(0, 1)).end;
  const a = [gx[0] - g0[0], gx[1] - g0[1]], b = [gy[0] - g0[0], gy[1] - g0[1]], det = a[0] * b[1] - b[0] * a[1];
  return walk(sides((-g0[0] * b[1] + g0[1] * b[0]) / det, (-a[0] * g0[1] + a[1] * g0[0]) / det)).v;
}

// A copy glued to tile g: the copy's corner b on g's corner a, the copy's
// edge b -> bi along g's edge a -> ai, the copy mirrored when m = -1.
function glue(v, g, a, ai, b, bi, m) {
  const V = ap(g, v[a]), U = ap(g, v[ai]);
  const th = atan2(U[1] - V[1], U[0] - V[0]) - atan2(m * (v[bi][1] - v[b][1]), v[bi][0] - v[b][0]);
  const c = cos(th), s = sin(th), lx = v[b][0], ly = m * v[b][1];
  return [c, s, m, V[0] - (c * lx - s * ly), V[1] - (s * lx + c * ly)];
}
// A tiling from gluings: G builds the tiles of one period from tile 0, and
// each row of L glues a copy that is a translate of tile k, giving one of
// the two periods.
function glued(v, G, L) {
  const isos = [[1, 0, 1, 0, 0]];
  for (const [f, a, ai, b, bi, m] of G) isos.push(glue(v, isos[f], a, ai, b, bi, m));
  const T = L.map(([f, a, ai, b, bi, m, k]) => {
    const g = glue(v, isos[f], a, ai, b, bi, m);
    return [g[3] - isos[k][3], g[4] - isos[k][4]];
  });
  return { v, isos, T };
}

// Type 1, B + C = 180: AB and DC parallel. B = (0, 0), C = (1, 0), the
// sides AB and DC leave at angle be with lengths b and d, and E sits over
// AD at base angles chosen to keep every corner under 165 degrees. The
// shape runs round a loop as w goes from 0 to 2 pi; every member tiles by
// the copy turned half round about the midpoint of BC, the two making a
// hexagon D E A D' E' A' with opposite sides parallel, which tiles by
// translation.
function type1(w) {
  const be = (90 + 20 * sin(w)) * D2R, b = 1 + 0.3 * sin(2 * w + 1), d = 1 + 0.3 * sin(w + 2);
  const u = [cos(be), sin(be)];
  const A = [b * u[0], b * u[1]], B = [0, 0], C = [1, 0], D = [1 + d * u[0], d * u[1]];
  const corner = (o, p, q) => {
    const x = [p[0] - o[0], p[1] - o[1]], y = [q[0] - o[0], q[1] - o[1]];
    return Math.acos((x[0] * y[0] + x[1] * y[1]) / hypot(x[0], x[1]) / hypot(y[0], y[1]));
  };
  const gA = (165 * D2R - corner(A, B, D)) * (0.5 + 0.12 * sin(3 * w));
  const gD = (165 * D2R - corner(D, A, C)) * (0.5 - 0.12 * sin(3 * w + 0.7));
  const dir = atan2(D[1] - A[1], D[0] - A[0]);
  const r1 = [cos(dir + gA), sin(dir + gA)], r2 = [cos(dir + PI - gD), sin(dir + PI - gD)];
  const t = ((D[0] - A[0]) * r2[1] - (D[1] - A[1]) * r2[0]) / (r1[0] * r2[1] - r1[1] * r2[0]);
  const E = [A[0] + t * r1[0], A[1] + t * r1[1]];
  const v = [A, B, C, D, E];
  const r = rot(PI, [0.5, 0]), E2 = ap(r, E), A2 = ap(r, A);
  return { v, isos: [[1, 0, 1, 0, 0], r], T: [[D[0] - E2[0], D[1] - E2[1]], [E[0] - A2[0], E[1] - A2[1]]] };
}

// Type 4, b = c, d = e, B = D = 90: the Cairo pentagon (angles 120, 90,
// 120, 90, 120, four sides 1 and a = sqrt 3 - 1). Quarter turns about B and
// about D generate it: four tiles round B, and R_D R_B^-1 a translation.
function type4() {
  const v = pentagon([120, 90, 120, 90, 120], (x, y) => [y, 1, 1, x, x]), B = v[1], D = v[3];
  const dx = D[0] - B[0], dy = D[1] - B[1];
  return { v, isos: [0, 1, 2, 3].map((k) => rot((k * PI) / 2, B)), T: [[dx + dy, dy - dx], [dx - dy, dx + dy]] };
}

// Type 5, a = b, d = e, A = 60, D = 120 (here B = 140, C = 100, E = 120):
// sixth turns about A, third turns about D.
function type5() {
  const v = pentagon([60, 140, 100, 120, 120], (x, y) => [1, 1, y, x, x]), D = v[3];
  const c = cos((2 * PI) / 3), s = sin((2 * PI) / 3);
  const T1 = [D[0] - (c * D[0] - s * D[1]), D[1] - (s * D[0] + c * D[1])];
  const c6 = cos(PI / 3), s6 = sin(PI / 3);
  return { v, isos: [0, 1, 2, 3, 4, 5].map((k) => rot((k * PI) / 3, [0, 0])), T: [T1, [c6 * T1[0] - s6 * T1[1], s6 * T1[0] + c6 * T1[1]]] };
}

// Type 13, d = 2a = 2e, B = E = 90, 2A + D = 360 (here A = C = 112, D =
// 136): eight tiles a period, in two orbits of the symmetry group.
function type13() {
  const v = pentagon([112, 90, 112, 136, 90], (x, y) => [1, x, y, 2, 1]);
  return glued(v, [[0, 2, 3, 3, 2, 1], [0, 3, 4, 2, 3, -1], [0, 0, 4, 3, 4, 1], [0, 1, 2, 1, 2, -1], [1, 0, 4, 3, 4, 1], [2, 3, 4, 0, 4, -1], [3, 1, 2, 1, 2, -1]], [[0, 0, 1, 0, 1, -1, 2], [4, 3, 4, 0, 4, -1, 7]]);
}

// Type 15, a = c = e = 1, b = 2, d = sqrt 2 / (sqrt 3 - 1), A = 150, B = 60,
// C = 135, D = 105, E = 90: twelve tiles a period, in three orbits of the
// symmetry group.
function type15() {
  // The walk is solved for d and e; e comes out 1.
  const v = pentagon([150, 60, 135, 105, 90], (x, y) => [1, 2, 1, x, y]);
  return glued(v, [[0, 0, 4, 1, 2, 1], [0, 3, 4, 1, 2, -1], [0, 1, 2, 2, 1, 1], [1, 0, 1, 3, 4, -1], [1, 0, 4, 3, 4, 1], [3, 3, 4, 1, 2, -1], [3, 0, 4, 1, 2, 1], [4, 1, 2, 0, 4, -1], [6, 3, 4, 0, 4, -1], [7, 0, 4, 3, 4, 1], [8, 2, 3, 3, 2, -1]], [[0, 0, 1, 0, 1, -1, 2], [9, 1, 2, 0, 4, -1, 11]]);
}

const GRID = 20;

// Lookup for one tiling: every tile of a period and its translates by up
// to two periods, as five edge lines each, filed in a GRID x GRID grid over
// the period cell in lattice coordinates. A point is found by reducing it
// into the cell and testing the few tiles filed in its grid square.
function prepare(t) {
  const { v, isos, T } = t;
  const det = T[0][0] * T[1][1] - T[0][1] * T[1][0];
  let area = 0;
  for (let k = 0; k < 5; k++) area += v[k][0] * v[(k + 1) % 5][1] - v[(k + 1) % 5][0] * v[k][1];
  // Aspect: the tile's turn, as a fraction of a whole turn, and its hand.
  const asp = isos.map((g) => [((atan2(g[1], g[0]) / (2 * PI) + 1.0001) % 1), g[2]]);
  const lines = [], cells = [];
  for (let g = 0; g < GRID * GRID; g++) cells.push([]);
  isos.forEach((g, k) => {
    let p = v.map((q) => ap(g, q));
    if (g[2] < 0) p = p.reverse();
    for (let i = -2; i <= 2; i++)
      for (let j = -2; j <= 2; j++) {
        const ox = i * T[0][0] + j * T[1][0], oy = i * T[0][1] + j * T[1][1];
        const q = p.map((r) => [r[0] + ox, r[1] + oy]);
        let a0 = 9, a1 = -9, b0 = 9, b1 = -9, cx = 0, cy = 0;
        for (const [x, y] of q) {
          const a = (x * T[1][1] - y * T[1][0]) / det, b = (T[0][0] * y - T[0][1] * x) / det;
          (a0 = min(a0, a)), (a1 = max(a1, a)), (b0 = min(b0, b)), (b1 = max(b1, b)), (cx += x / 5), (cy += y / 5);
        }
        if (a1 < 0 || a0 > 1 || b1 < 0 || b0 > 1) continue;
        const id = lines.length;
        const L = [k, cx, cy];
        for (let e = 0; e < 5; e++) {
          const P = q[e], Q = q[(e + 1) % 5], len = hypot(Q[0] - P[0], Q[1] - P[1]);
          // inside when nx x + ny y >= c, the value the distance to the edge
          const nx = -(Q[1] - P[1]) / len, ny = (Q[0] - P[0]) / len;
          L.push(nx, ny, nx * P[0] + ny * P[1]);
        }
        lines.push(L);
        for (let ga = max(0, floor(a0 * GRID)); ga <= min(GRID - 1, floor(a1 * GRID)); ga++)
          for (let gb = max(0, floor(b0 * GRID)); gb <= min(GRID - 1, floor(b1 * GRID)); gb++) cells[ga * GRID + gb].push(id);
      }
  });
  return { T, det, area: area / 2, asp, lines, cells, n: isos.length };
}

const BUILD = [null, type4, type5, type13, type15];

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, size: 12, type: 0, prev: -1, wipe: 1, w: 0,
    // Where the middle of the panel sits in each tiling, in its own lattice
    // coordinates, so the changing shapes of type 1 stay put round it.
    pan: BUILD.map(() => [0.3, 0.6]),
    tilings: BUILD.map((f) => (f ? prepare(f()) : null)),
    rgb: new Float32Array(3), hit: new Float64Array(4),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(kv[0], 0, 1);
  s.speed = cl(kv[1], 0.2, 3);
  s.size = 12 + 16 * cl(kv[3], 0, 1);
  const ty = round(cl(kv[2], 0, 4));
  if (ty !== s.type) (s.prev = s.type), (s.type = ty), (s.wipe = 0);
  s.wipe = min(1, s.wipe + d * 0.9);
  // Type 1 runs round its loop of shapes once in 32 / Speed seconds.
  s.w += d * s.speed * ((2 * PI) / 32);
  s.tilings[0] = prepare(type1(s.w));
  // The tiles drift up and to the left at 1.5 LEDs a second per unit of
  // Speed.
  s.tilings.forEach((t, i) => {
    const sc = s.size / sqrt(t.area), vx = (d * s.speed * 1.2) / sc, vy = (-d * s.speed * 0.9) / sc, P = s.pan[i], T = t.T;
    P[0] = (P[0] + (vx * T[1][1] - vy * T[1][0]) / t.det + 1) % 1;
    P[1] = (P[1] + (T[0][0] * vy - T[0][1] * vx) / t.det + 1) % 1;
  });
}

// The tile under tiling point (x, y): its period index and aspect, the
// distance to its nearest edge, and its centre.
function locate(t, x, y, out) {
  const { T, det, cells, lines } = t;
  const a = (x * T[1][1] - y * T[1][0]) / det, b = (T[0][0] * y - T[0][1] * x) / det;
  const ia = floor(a), ib = floor(b);
  const rx = x - ia * T[0][0] - ib * T[1][0], ry = y - ia * T[0][1] - ib * T[1][1];
  const list = cells[min(GRID - 1, floor((a - ia) * GRID)) * GRID + min(GRID - 1, floor((b - ib) * GRID))];
  let best = -1, bd = -1e9;
  for (let n = 0; n < list.length; n++) {
    const L = lines[list[n]];
    let dm = 1e9;
    for (let e = 3; e < 18; e += 3) dm = min(dm, L[e] * rx + L[e + 1] * ry - L[e + 2]);
    if (dm > bd) (bd = dm), (best = list[n]);
  }
  const L = lines[best];
  out[0] = L[0];
  out[1] = bd;
  out[2] = L[1] + ia * T[0][0] + ib * T[1][0];
  out[3] = L[2] + ia * T[0][1] + ib * T[1][1];
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const { rgb, hit } = s;
  const cur = s.tilings[s.type], old = s.prev >= 0 && s.wipe < 1 ? s.tilings[s.prev] : null;
  // The front of a change of type runs down the panel on a slant; a tile of
  // the new tiling shows once its centre is above the front.
  const front = -20 + s.wipe * 190;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let t = cur, ti = s.type;
      for (let pass = 0; pass < 2; pass++) {
        // Each tiling is scaled so a tile covers size^2 LEDs.
        const sc = s.size / sqrt(t.area), P = s.pan[ti], T = t.T;
        const ox = P[0] * T[0][0] + P[1] * T[1][0], oy = P[0] * T[0][1] + P[1] * T[1][1];
        locate(t, (x - 31.5) / sc + ox, (63.5 - y) / sc + oy, hit);
        if (old && t === cur) {
          const cx = 31.5 + (hit[2] - ox) * sc, cy = 63.5 - (hit[3] - oy) * sc;
          if (cy + 0.35 * cx > front) {
            (t = old), (ti = s.prev);
            continue;
          }
        }
        const [turn, hand] = t.asp[hit[0]];
        hsv(0.47 + s.hue + 0.5 * turn + (hand > 0 ? 0 : 0.05), hand > 0 ? 0.62 : 0.36, hand > 0 ? 0.95 : 0.85, rgb);
        // Grout: the LED darkens within about half an LED of an edge.
        const g = cl((hit[1] * sc - 0.3) / 0.7, 0, 1);
        const k = g * (0.8 + 0.2 * cl(hit[1] * sc / 4, 0, 1));
        display.setPixel(x, y, (255 * rgb[0] * k) | 0, (255 * rgb[1] * k) | 0, (255 * rgb[2] * k) | 0);
        break;
      }
    }
}
