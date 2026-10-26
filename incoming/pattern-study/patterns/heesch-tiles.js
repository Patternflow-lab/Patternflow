// ===== Patternflow pattern =====
// Title:   Heesch Tiles
// Family:  cells
// Idea:    One tile whose edges keep bending covers the whole panel with no gap and no overlap, each bent edge carried onto its partner the way Heesch paired them (translated T, half-turned C about its own midpoint, glide-reflected G, or turned about a shared corner, C3 and C4), and every 8 s the tiling passes on to the next of six Heesch types, each copy coloured by which way it is turned or flipped and brightest at its first corner.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the 28 types of plane tiling by one asymmetric tile (Heinrich Heesch, 1935), Flächenschluss (Heinrich Heesch and Otto Kienzle, 1963), the 93 isohedral tiling types (Branko Grünbaum and G. C. Shephard, 1977), isohedral tilings parameterised for drawing (Craig S. Kaplan and David H. Salesin, 2000), pattern round 62
// Round:   62
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Type=0..5, Size=-1..1
//
// Knob 1: Hue. Turns the class colours round a wheel that skips orange, which reads brown once shaded. At 0 the copies turned like the first tile are azure, the next class pink, then green and violet: two colours where the group has two classes (the half-turned copies of CCCC and TCTC, the mirrored ones of TG1G1TG2G2), three for C3C3C3C3C3C3, four for C4C4C4C4, and TTTT, where every copy is a translate, all azure. At 0.5 the four are red, cyan, violet and green.
// Knob 2: Speed. At 2 the edge bends run through their quickest wave in 12 s and their slowest in 22 s, the corners wander over 27 s, the tiling drifts 0.9 LEDs a second right and 1.6 up, and each type holds 8 s before the next sweeps down the panel in 1.2 s, tile by tile, so the six come round every 55 s. At 0.2 everything is ten times slower, at 3 one and a half times faster.
// Knob 3: Type. The type on the panel now; the cycle goes on from it. 0 C3C3C3C3C3C3 (group p3: a hexagon whose corners V0, V2, V4 are 3-fold centres and whose corner V1 wanders, three classes), 1 TG1G1TG2G2 (pg: one translated pair and two glide-reflected pairs, so mirrored columns alternate), 2 CCCC (p2: any quadrilateral, each edge half-turned about its own midpoint), 3 TCTC (p2: a parallelogram with one translated pair and two C edges), 4 TTTT (p1), 5 C4C4C4C4 (p4: a square turned a quarter about two opposite corners, four classes).
// Knob 4: Size. The area of one tile, 290 x 2^(1.6 K) LEDs: 96 at -1, about 85 tiles on the panel; 310 at the opening 0.06, about 26; 880 at 1, about 9.

const W = 64, H = 128, N = W * H;
const { floor, round, sin, cos, sqrt, min, max, abs, atan2, PI, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = 2 * PI;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// Orange reads brown on an LED once it is shaded, so the class colours come
// from a wheel without 0.03 to 0.17.
const wheel = (h) => 0.17 + 0.86 * (h - floor(h));

// Isometries as [a, b, c, d, e, f]: (x, y) -> (a x + b y + e, c x + d y + f).
const mul = (M, K) => [
  M[0] * K[0] + M[1] * K[2], M[0] * K[1] + M[1] * K[3],
  M[2] * K[0] + M[3] * K[2], M[2] * K[1] + M[3] * K[3],
  M[0] * K[4] + M[1] * K[5] + M[4], M[2] * K[4] + M[3] * K[5] + M[5],
];
const inv = (M) => {
  const det = M[0] * M[3] - M[1] * M[2], a = M[3] / det, b = -M[1] / det, c = -M[2] / det, d = M[0] / det;
  return [a, b, c, d, -(a * M[4] + b * M[5]), -(c * M[4] + d * M[5])];
};
const Tr = (x, y) => [1, 0, 0, 1, x, y];
const Rot = (p, th) => {
  const c = cos(th), s = sin(th);
  return [c, -s, s, c, p[0] - c * p[0] + s * p[1], p[1] - s * p[0] - c * p[1]];
};
const Half = (p, q) => Rot([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], PI);
// Reflect in the vertical line x = xa, then move dy along it.
const Glide = (xa, dy) => [-1, 0, 0, 1, 2 * xa, dy];
const ap = (M, p) => [M[0] * p[0] + M[1] * p[1] + M[4], M[2] * p[0] + M[3] * p[1] + M[5]];

// An edge from P to Q, NS steps, bent off the chord by h(s) times its length.
// Every bend is a sum of sin(k pi s) sin(pi s), so it leaves both corners
// along the chord and the corner angles of the polygon stay.
const NS = 10;
function edge(P, Q, h) {
  const dx = Q[0] - P[0], dy = Q[1] - P[1], pts = [];
  for (let i = 0; i <= NS; i++) {
    const s = i / NS, o = h(s);
    pts.push([P[0] + dx * s - dy * o, P[1] + dy * s + dx * o]);
  }
  return pts;
}
const mapPts = (M, pts) => pts.map((p) => ap(M, p));
const rev = (pts) => pts.slice().reverse();

// Bends. A free edge (the first of a T, G, C3 or C4 pair) may take any
// shape; a C edge must turn into itself under a half-turn about its
// midpoint, so its bend is odd about s = 1/2. Seen from either end of its
// chord, an edge never strays further off it than the angle the chord
// makes there with the line to the tile's centre, times 0.9: the edge then
// stays inside a rhombus on its chord whose two halves lie in the fan
// triangles (centre, corner, corner) of the two tiles it parts. Those
// triangles never overlap, so no two bent edges meet but at a corner and
// the copies still cover the plane once.
function limit(u, A, tm) {
  let r = 0;
  for (let i = 1; i < 40; i++) {
    const s = i / 40;
    r = max(r, abs(u(s)) / min(s, 1 - s));
  }
  const a = r > 0 ? min(A, tm / r) : A;
  return (s) => a * u(s);
}
function freeBend(c, A, tm) {
  return limit((s) => sin(PI * s) * (c[0] * sin(PI * s) + 0.8 * c[1] * sin(2 * PI * s) + 0.3 * c[2] * sin(3 * PI * s)), A, tm);
}
function oddBend(c, A, tm) {
  return limit((s) => sin(PI * s) * (1.3 * c[0] * sin(2 * PI * s) + 0.5 * c[1] * sin(4 * PI * s)), A, tm);
}
// The tangent of the stray allowed: 0.9 of the smallest angle between a
// chord and the line from its end to the centre of the corners.
function stray(V) {
  const n = V.length;
  let cx = 0, cy = 0, m = PI;
  for (const p of V) {
    cx += p[0] / n;
    cy += p[1] / n;
  }
  const ang = (o, a, b) => {
    const ax = a[0] - o[0], ay = a[1] - o[1], bx = b[0] - o[0], by = b[1] - o[1];
    return abs(atan2(ax * by - ay * bx, ax * bx + ay * by));
  };
  for (let i = 0; i < n; i++) {
    const p = V[i], q = V[(i + 1) % n], C = [cx, cy];
    m = min(m, ang(p, q, C), ang(q, p, C));
  }
  return Math.tan(0.9 * m);
}

// The six types. Each returns the corners V in order round the tile
// (counter-clockwise), the edges as point lists from V[i] to V[i+1], the
// isometry n[i] that carries the tile onto its neighbour across edge i,
// and how many orientation classes the group has. c(j) is edge j's slowly
// turning bend coefficients and g(j) a slow wave for the corners.
const TYPES = [
  {
    name: "C3C3C3C3C3C3", m: 3,
    build(c, g, A) {
      // V0, V2, V4 are a fixed equilateral triangle of 3-fold centres; V1
      // wanders, and V3, V5 follow it by turns of -120 degrees.
      const V = [];
      for (let i = 0; i < 6; i++) V.push([cos((i * PI) / 3), sin((i * PI) / 3)]);
      V[1] = [V[1][0] + 0.18 * g(0), V[1][1] + 0.18 * g(1)];
      const r0 = Rot(V[0], -TAU / 3), r2 = Rot(V[2], -TAU / 3), r4 = Rot(V[4], -TAU / 3);
      V[3] = ap(r2, V[1]);
      V[5] = ap(r4, V[3]);
      const tm = stray(V);
      const e1 = edge(V[1], V[2], freeBend(c(0), A, tm)), e3 = edge(V[3], V[4], freeBend(c(1), A, tm)), e5 = edge(V[5], V[0], freeBend(c(2), A, tm));
      const E = [rev(mapPts(r0, e5)), e1, rev(mapPts(r2, e1)), e3, rev(mapPts(r4, e3)), e5];
      return { V, E, n: [r0, inv(r2), r2, inv(r4), r4, inv(r0)] };
    },
  },
  {
    name: "TG1G1TG2G2", m: 2,
    build(c, g, A) {
      // T moves the tile up by h; the glides g1, g2 reflect it in vertical
      // lines and move it half of h, so mirrored columns alternate.
      const w = 1, h = 1.25, s = 0.22 * g(0), p = 0.32 + 0.12 * g(1), q = -0.32 + 0.12 * g(2);
      const V = [[0, 0], [w, s], [w + p, s + h / 2], [w, s + h], [0, h], [q, h / 2]], tm = stray(V);
      const g1 = Glide(w + p / 2, h / 2), g2 = Glide(q / 2, -h / 2), t = Tr(0, h);
      const e0 = edge(V[0], V[1], freeBend(c(0), A, tm)), e1 = edge(V[1], V[2], freeBend(c(1), A, tm)), e4 = edge(V[4], V[5], freeBend(c(2), A, tm));
      const E = [e0, e1, mapPts(g1, e1), rev(mapPts(t, e0)), e4, mapPts(g2, e4)];
      return { V, E, n: [inv(t), inv(g1), g1, t, inv(g2), g2] };
    },
  },
  {
    name: "CCCC", m: 2,
    build(c, g, A) {
      // Any quadrilateral tiles by half-turns about its edge midpoints.
      const V = [[0.12 * g(0), 0.1 * g(1)], [1.1 + 0.12 * g(2), 0.08 * g(3)], [1.18 + 0.1 * g(4), 1.02 + 0.1 * g(5)], [-0.12 + 0.1 * g(6), 0.9 + 0.1 * g(7)]];
      const E = [], n = [], tm = stray(V);
      for (let i = 0; i < 4; i++) {
        const P = V[i], Q = V[(i + 1) % 4];
        E.push(edge(P, Q, oddBend(c(i), A * 1.15, tm)));
        n.push(Half(P, Q));
      }
      return { V, E, n };
    },
  },
  {
    name: "TCTC", m: 2,
    build(c, g, A) {
      const u = [1.15, 0.22 * g(0)], v = [0.28 * g(1), 1];
      const V = [[0, 0], u, [u[0] + v[0], u[1] + v[1]], v], tm = stray(V);
      const t = Tr(v[0], v[1]);
      const e0 = edge(V[0], V[1], freeBend(c(0), A, tm)), e1 = edge(V[1], V[2], oddBend(c(1), A * 1.15, tm)), e3 = edge(V[3], V[0], oddBend(c(2), A * 1.15, tm));
      const E = [e0, e1, rev(mapPts(t, e0)), e3];
      return { V, E, n: [inv(t), Half(V[1], V[2]), t, Half(V[3], V[0])] };
    },
  },
  {
    name: "TTTT", m: 1,
    build(c, g, A) {
      const u = [1.1, 0.25 * g(0)], v = [0.3 * g(1), 1];
      const V = [[0, 0], u, [u[0] + v[0], u[1] + v[1]], v], tm = stray(V);
      const tu = Tr(u[0], u[1]), tv = Tr(v[0], v[1]);
      const e0 = edge(V[0], V[1], freeBend(c(0), A, tm)), e1 = edge(V[1], V[2], freeBend(c(1), A, tm));
      const E = [e0, e1, rev(mapPts(tv, e0)), rev(mapPts(inv(tu), e1))];
      return { V, E, n: [inv(tv), tu, tv, inv(tu)] };
    },
  },
  {
    name: "C4C4C4C4", m: 4,
    build(c, g, A) {
      // A square with 4-fold centres at V0 and V2: edge V0V1 turns a quarter
      // about V0 into V0V3, edge V2V3 a quarter about V2 into V2V1.
      const V = [[0, 0], [1, 0], [1, 1], [0, 1]], tm = stray(V);
      const r0 = Rot(V[0], PI / 2), r2 = Rot(V[2], PI / 2);
      const e0 = edge(V[0], V[1], freeBend(c(0), A, tm)), e2 = edge(V[2], V[3], freeBend(c(1), A, tm));
      const E = [e0, rev(mapPts(r2, e2)), e2, rev(mapPts(r0, e0))];
      return { V, E, n: [inv(r0), r2, inv(r2), r0] };
    },
  },
];

// At Size 0 each tile covers this many LEDs; every edge asks for a bend of
// BEND times its length, and gets it unless its stray limit says less.
const AREA = 290, BEND = 0.45;
const PERIOD = 8, WIPE = 1.2;

export function setup(params) {
  params.s = {
    t: 0, hue: 0, size: 0, type: -1, base: -1, next: -1, since: 0, wipe: 1,
    ox: 0, oy: 0,
    own: [new Int32Array(N), new Int32Array(N)], cnt: [new Uint8Array(N), new Uint8Array(N)],
    tiles: [[], []], frames: 0, bad: 0, c: [0, 0, 0],
  };
}

function polygonArea(V) {
  let a = 0;
  for (let i = 0; i < V.length; i++) {
    const p = V[i], q = V[(i + 1) % V.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return abs(a) / 2;
}

// The tiling of type k at time t, rasterised into own (tile index per LED)
// and cnt (how many tiles cover each LED centre).
function tile(S, k, slot) {
  const ty = TYPES[k], t = S.t;
  const c = (j) => [sin(0.53 * t + 1.7 * j + 0.3 * k), sin(0.37 * t + 2.9 * j + 1.1 * k), sin(0.29 * t + 4.1 * j + 2.3 * k)];
  const g = (j) => sin(0.23 * t + 1.9 * j + k);
  const T = ty.build(c, g, BEND);
  const sc = sqrt((AREA * Math.pow(2, 1.6 * S.size)) / polygonArea(T.V));
  // The boundary, closed, in tile units.
  const poly = [];
  for (const e of T.E) for (let i = 0; i < e.length - 1; i++) poly.push(e[i]);
  let cx = 0, cy = 0;
  for (const p of T.V) {
    cx += p[0] / T.V.length;
    cy += p[1] / T.V.length;
  }
  let rad = 0;
  for (const p of poly) rad = max(rad, sqrt((p[0] - cx) ** 2 + (p[1] - cy) ** 2));
  // Tile units to LEDs: scale, and put the first tile's centre at the
  // panel's centre plus the drift.
  const view = [sc, 0, 0, sc, 32 + S.ox - sc * cx, 64 + S.oy - sc * cy];
  const own = S.own[slot], cnt = S.cnt[slot], tiles = [], np = poly.length, Q = new Float64Array(2 * np);
  own.fill(-1);
  cnt.fill(0);
  // Every copy is found from the first by crossing edges, and a copy is
  // known by where its centre lands.
  const seen = new Set([round(cx * 64) * 65536 + round(cy * 64)]), queue = [[1, 0, 0, 1, 0, 0]], reach = sc * rad + 2;
  for (let qi = 0; qi < queue.length; qi++) {
    const M = queue[qi], F = mul(view, M), ux = F[0] * cx + F[1] * cy + F[4], uy = F[2] * cx + F[3] * cy + F[5];
    if (ux < -reach || ux > W + reach || uy < -reach || uy > H + reach) continue;
    const id = tiles.length, det = M[0] * M[3] - M[1] * M[2];
    // The orientation class: the turn of the tile, and for a mirrored copy
    // the turn of its mirror image, in steps of a full turn over the
    // rotations the group has.
    const steps = det > 0 ? ty.m : ty.m / 2;
    const ang = atan2(M[2], M[0]);
    const cls = det > 0 || ty.m < 2 ? round((ang / TAU) * steps + steps) % steps : steps + (round((atan2(-M[2], -M[0]) / TAU) * steps + steps) % steps);
    tiles.push({ Fi: inv(F), cy: uy, cls });
    for (let i = 0; i < np; i++) {
      const x = poly[i][0], y = poly[i][1];
      Q[2 * i] = F[0] * x + F[1] * y + F[4];
      Q[2 * i + 1] = F[2] * x + F[3] * y + F[5];
    }
    fill(Q, np, id, own, cnt);
    for (const nb of T.n) {
      const K = mul(M, nb), key = round((K[0] * cx + K[1] * cy + K[4]) * 64) * 65536 + round((K[2] * cx + K[3] * cy + K[5]) * 64);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(K);
    }
  }
  S.tiles[slot] = tiles;
  S.v0 = T.V[0];
  S.rad = rad;
  return tiles;
}

// Even-odd scanline fill of LED centres (x + 0.5, y + 0.5), half-open on
// both axes, so two tiles that share an edge split the LEDs along it. Each
// segment drops its crossings into the rows it spans.
const rowX = [];
for (let r = 0; r < H; r++) rowX.push([]);
function fill(Q, n, id, own, cnt) {
  let r0 = H, r1 = -1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    let ax = Q[2 * i], ay = Q[2 * i + 1], bx = Q[2 * j], by = Q[2 * j + 1];
    if (ay === by) continue;
    if (ay > by) {
      const tx = ax, ty = ay;
      ax = bx;
      ay = by;
      bx = tx;
      by = ty;
    }
    // Rows whose centre yc has ay <= yc < by.
    const ra = max(0, Math.ceil(ay - 0.5)), rb = min(H - 1, Math.ceil(by - 0.5) - 1);
    if (ra > rb) continue;
    const k = (bx - ax) / (by - ay);
    for (let r = ra; r <= rb; r++) rowX[r].push(ax + (r + 0.5 - ay) * k);
    if (ra < r0) r0 = ra;
    if (rb > r1) r1 = rb;
  }
  for (let r = r0; r <= r1; r++) {
    const xs = rowX[r];
    if (xs.length > 2) xs.sort((p, q) => p - q);
    else if (xs.length === 2 && xs[0] > xs[1]) xs.reverse();
    for (let j = 0; j + 1 < xs.length; j += 2) {
      const c0 = max(0, Math.ceil(xs[j] - 0.5)), c1 = min(W - 1, Math.ceil(xs[j + 1] - 0.5) - 1);
      for (let x = c0, p = r * W + c0; x <= c1; x++, p++) {
        own[p] = id;
        cnt[p]++;
      }
    }
    xs.length = 0;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const speed = cl(k[1], 0.2, 3), tau = (d * speed) / 2;
  S.hue = k[0];
  S.size = cl(k[3], -1, 1);
  const base = round(cl(k[2], 0, 5));
  if (base !== S.base) {
    // A turned knob shows its type now, and the cycle goes on from there.
    if (S.base < 0) S.type = base;
    else {
      S.next = base;
      S.wipe = 0;
    }
    S.base = base;
    S.since = 0;
  }
  S.t += tau;
  S.since += tau;
  S.ox += tau * 0.9;
  S.oy -= tau * 1.6;
  if (S.wipe >= 1 && S.since >= PERIOD) {
    S.next = (S.type + 1) % TYPES.length;
    S.wipe = 0;
    S.since = 0;
  }
  if (S.wipe < 1) {
    S.wipe += tau / WIPE;
    if (S.wipe >= 1) {
      S.type = S.next;
      S.next = -1;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const c = S.c;
  const slots = [[S.type, 0]];
  if (S.next >= 0 && S.wipe < 1) slots.push([S.next, 1]);
  const info = [];
  for (const [k, slot] of slots) {
    const tiles = tile(S, k, slot);
    info.push({ k, slot, tiles, v0: S.v0, fall: -2.2 / (S.rad * S.rad) });
    S.frames++;
    for (let p = 0; p < N; p++) if (S.cnt[slot][p] !== 1) S.bad++;
  }
  // The wipe runs down the panel tile by tile: a tile of the new type shows
  // once its centre is above the line.
  const line = -20 + (H + 40) * ease(cl(S.wipe, 0, 1));
  // Each class's colour at full brightness.
  const pal = [];
  for (let i = 0; i < 4; i++) {
    hsv(wheel(S.hue + CLASS[i]), 0.78, 255, c);
    pal.push([c[0], c[1], c[2]]);
  }
  // Which tiling each LED shows, and the tile there, as one number, so the
  // grout also runs along the seam of a wipe.
  const kk = S.kk || (S.kk = new Int32Array(N)), lay = S.lay || (S.lay = new Uint8Array(N));
  const own0 = S.own[0], own1 = S.own[1], two = info.length > 1;
  for (let p = 0; p < N; p++) {
    const id = own1[p];
    lay[p] = two && id >= 0 && info[1].tiles[id].cy < line ? 1 : 0;
    kk[p] = lay[p] ? -2 - id : own0[p];
  }
  for (let p = 0; p < N; p++) {
    const x = p & 63, y = p >> 6, L = info[lay[p]];
    const id = lay[p] ? own1[p] : own0[p];
    if (id < 0 || S.cnt[L.slot][p] !== 1) {
      // Never seen: a gap or an overlap would show white.
      display.setPixel(x, y, 255, 255, 255);
      continue;
    }
    const T = L.tiles[id], F = T.Fi, xc = x + 0.5, yc = y + 0.5, me = kk[p];
    // Grout where the LED to the right or below belongs to another tile.
    const grout = (x < W - 1 && kk[p + 1] !== me) || (y < H - 1 && kk[p + W] !== me);
    // Shade: brightest at the tile's first corner, so its turn shows.
    const qx = F[0] * xc + F[1] * yc + F[4] - L.v0[0], qy = F[2] * xc + F[3] * yc + F[5] - L.v0[1];
    const v = (0.45 + 0.55 * exp((qx * qx + qy * qy) * L.fall)) * (grout ? 0.14 : 1);
    const col = pal[T.cls & 3];
    display.setPixel(x, y, round(col[0] * v), round(col[1] * v), round(col[2] * v));
  }
}

// Class colours on the wheel: azure, pink, green, violet at Hue 0.
const CLASS = [0.477, 0.849, 0.186, 0.686];
const ease = (u) => u * u * (3 - 2 * u);
