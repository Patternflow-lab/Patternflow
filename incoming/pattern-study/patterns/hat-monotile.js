// ===== Patternflow pattern =====
// Title:   Hat Monotile
// Family:  cells
// Idea:    The panel fills with copies of one 13-sided tile, the hat, cluster by cluster in the order its metatile substitution nests them, coloured by the metatile each hat belongs to with the rare mirrored hats in orange, and while the window drifts across a patch of 7,921 hats that never repeats, waves of colour regroup the same hats into the bigger clusters of the next two levels.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the hat, an aperiodic monotile (David Smith, Joseph Samuel Myers, Craig S. Kaplan and Chaim Goodman-Strauss, 2023), built by its H/T/P/F metatile substitution as in Kaplan's hatviz (reimplemented), with the paper's continuous family Tile(a, b), pattern round 51
// Round:   51
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Size=9..16, Shape=-1..1
//
// Knob 1: Hue. Turns the five label colours round the wheel together. At 0 the H hats are blue, the mirrored H1 hats orange, T yellow, P magenta and F green.
// Knob 2: Speed. At 2 the panel fills in 1.6 seconds and the window drifts 2.5 LEDs a second. A cycle takes 36 seconds: the colours regroup at 11 and 17 seconds and fall back at 23, and from 34.4 the panel clears to build again at 36; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Size. How many LEDs across one hat is, from 9 to 16. At 9 about 220 hats share the panel, at 16 about 70.
// Knob 4: Shape. Re-measures every edge of the same tiling with two lengths, a for the edges along the hexagon sides and b for the others, as Tile(a, b) of the paper: at -1 the comet Tile(1, 0), at -0.5 the turtle Tile(sqrt 3, 1), at -0.25 Tile(1, 1), from 0 to 0.12 the hat Tile(1, sqrt 3) itself, at 1 the chevron Tile(0, 1).
// Buttons: K1 tap clears the panel cluster by cluster and builds it again.

const W = 64, H = 128, NP = W * H;
const { floor, ceil, min, max, round, sin, cos, atan2, sqrt, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => ((u = cl(u, 0, 1)), u * u * (3 - 2 * u));

// The substitution. This is Craig Kaplan's hatviz construction, rewritten:
// four metatiles H, T, P and F, each a polygon holding hats (H four, one of
// them mirrored, T one, P and F two), are glued into a patch by a fixed list
// of rules and the patch is cut into the four metatiles of the next level.
// Transforms are affine maps [a, b, c, d, e, f]: x' = a x + b y + c, y' = d x + e y + f.
const R3 = sqrt(3) / 2;
const pt = (x, y) => ({ x, y });
const hexPt = (x, y) => pt(x + 0.5 * y, R3 * y);
const ID = [1, 0, 0, 0, 1, 0];
const mul = (A, B) => [A[0] * B[0] + A[1] * B[3], A[0] * B[1] + A[1] * B[4], A[0] * B[2] + A[1] * B[5] + A[2], A[3] * B[0] + A[4] * B[3], A[3] * B[1] + A[4] * B[4], A[3] * B[2] + A[4] * B[5] + A[5]];
function inv(T) {
  const d = T[0] * T[4] - T[1] * T[3];
  return [T[4] / d, -T[1] / d, (T[1] * T[5] - T[2] * T[4]) / d, -T[3] / d, T[0] / d, (T[2] * T[3] - T[0] * T[5]) / d];
}
const add = (p, q) => pt(p.x + q.x, p.y + q.y), sub = (p, q) => pt(p.x - q.x, p.y - q.y);
const move = (x, y) => [1, 0, x, 0, 1, y];
const turnAbout = (p, a) => mul(move(p.x, p.y), mul([cos(a), -sin(a), 0, sin(a), cos(a), 0], move(-p.x, -p.y)));
const apply = (M, p) => pt(M[0] * p.x + M[1] * p.y + M[2], M[3] * p.x + M[4] * p.y + M[5]);
// The similarity taking segment p1 q1 onto segment p2 q2.
const seg = (p, q) => [q.x - p.x, p.y - q.y, p.x, q.y - p.y, q.x - p.x, p.y];
const match = (p1, q1, p2, q2) => mul(seg(p2, q2), inv(seg(p1, q1)));
function cross(p1, q1, p2, q2) {
  const d = (q2.y - p2.y) * (q1.x - p1.x) - (q2.x - p2.x) * (q1.y - p1.y);
  const u = ((q2.x - p2.x) * (p1.y - p2.y) - (q2.y - p2.y) * (p1.x - p2.x)) / d;
  return pt(p1.x + u * (q1.x - p1.x), p1.y + u * (q1.y - p1.y));
}
// The hat on the triangular lattice, eight kites of a hexagon grid. The
// midpoint of its one long edge is kept as a vertex, so the outline has 14
// corners and every edge is one of two kinds.
const HAT = [[0, 0], [-1, -1], [0, -2], [1, -2], [2, -2], [2, -1], [4, -2], [5, -1], [4, 0], [3, 0], [2, 2], [0, 3], [0, 2], [-1, 2]].map(([a, b]) => hexPt(a, b));
const NV = 14;
// Edge kind: 0 for a unit edge along a hexagon side (length a), 1 for a
// sqrt 3 edge from a hexagon's centre to the middle of a side (length b).
const KIND = HAT.map((p, i) => (abs1(sub(HAT[(i + 1) % NV], p)) < 1.01 ? 0 : 1));
function abs1(p) {
  return sqrt(p.x * p.x + p.y * p.y);
}
// Hat labels: 0 H, 1 H1 (the mirrored one), 2 T, 3 P, 4 F.
const hat = (label) => ({ hat: true, label });
const meta = (shape, label) => ({ shape, label, kids: [] });
const kid = (m, T, g) => m.kids.push({ T, g });
const at = (m, n, i) => apply(m.kids[n].T, m.kids[n].g.shape[i]);
function recentre(m) {
  let cx = 0, cy = 0;
  for (const p of m.shape) (cx += p.x), (cy += p.y);
  (cx /= m.shape.length), (cy /= m.shape.length);
  m.shape = m.shape.map((p) => pt(p.x - cx, p.y - cy));
  for (const k of m.kids) k.T = mul(move(-cx, -cy), k.T);
}
function first() {
  const Ho = [pt(0, 0), pt(4, 0), pt(4.5, R3), pt(2.5, 5 * R3), pt(1.5, 5 * R3), pt(-0.5, R3)];
  const h = meta(Ho, 0), t = meta([pt(0, 0), pt(3, 0), pt(1.5, 3 * R3)], 2);
  const p = meta([pt(0, 0), pt(4, 0), pt(3, 2 * R3), pt(-1, 2 * R3)], 3);
  const f = meta([pt(0, 0), pt(3, 0), pt(3.5, R3), pt(3, 2 * R3), pt(-1, 2 * R3)], 4);
  // The hat outline without the long edge's midpoint, as hatviz indexes it.
  const o = HAT.filter((_, i) => i !== 3);
  kid(h, match(o[5], o[7], Ho[5], Ho[0]), hat(0));
  kid(h, match(o[9], o[11], Ho[1], Ho[2]), hat(0));
  kid(h, match(o[5], o[7], Ho[3], Ho[4]), hat(0));
  kid(h, mul(move(2.5, R3), mul([-0.5, -R3, 0, R3, -0.5, 0], [0.5, 0, 0, 0, -0.5, 0])), hat(1));
  kid(t, [0.5, 0, 0.5, 0, 0.5, R3], hat(2));
  for (const [m, l] of [[p, 3], [f, 4]]) {
    kid(m, [0.5, 0, 1.5, 0, 0.5, R3], hat(l));
    kid(m, mul(move(0, 2 * R3), mul([0.5, R3, 0, -R3, 0.5, 0], [0.5, 0, 0, 0, 0.5, 0])), hat(l));
  }
  return [h, t, p, f];
}
// The patch rules: [shape] for the first, [child, edge, shape, its edge] to
// glue a new metatile to one edge of a child, or [child, corner, child,
// corner, shape, its edge] to glue it between corners of two children.
const RULES = [["H"], [0, 0, "P", 2], [1, 0, "H", 2], [2, 0, "P", 2], [3, 0, "H", 2], [4, 4, "P", 2], [0, 4, "F", 3], [2, 4, "F", 3], [4, 1, 3, 2, "F", 0], [8, 3, "H", 0], [9, 2, "P", 0], [10, 2, "H", 0], [11, 4, "P", 2], [12, 0, "H", 2], [13, 0, "F", 3], [14, 2, "F", 1], [15, 3, "H", 4], [8, 2, "F", 1], [17, 3, "H", 0], [18, 2, "P", 0], [19, 2, "H", 2], [20, 4, "F", 3], [20, 0, "P", 2], [22, 0, "H", 2], [23, 4, "F", 3], [23, 0, "F", 3], [16, 0, "P", 2], [9, 4, 0, 2, "T", 2], [4, 0, "F", 3]];
function patch([h, t, p, f]) {
  const out = meta([], -1), S = { H: h, T: t, P: p, F: f };
  for (const r of RULES) {
    if (r.length === 1) kid(out, ID, S[r[0]]);
    else if (r.length === 4) {
      const c = out.kids[r[0]], poly = c.g.shape, g = S[r[2]], n = g.shape.length;
      kid(out, match(g.shape[r[3]], g.shape[(r[3] + 1) % n], apply(c.T, poly[(r[1] + 1) % poly.length]), apply(c.T, poly[r[1]])), g);
    } else {
      const g = S[r[4]], n = g.shape.length;
      kid(out, match(g.shape[r[5]], g.shape[(r[5] + 1) % n], at(out, r[2], r[3]), at(out, r[0], r[1])), g);
    }
  }
  return out;
}
function next(P) {
  const b1 = at(P, 8, 2), b2 = at(P, 21, 2), rb = apply(turnAbout(b1, (-2 * PI) / 3), b2);
  const p72 = at(P, 7, 2), p252 = at(P, 25, 2), llc = cross(b1, rb, at(P, 6, 2), p72);
  let w = apply(turnAbout(pt(0, 0), -PI / 3), sub(at(P, 6, 2), llc));
  const nH = [llc, b1, add(b1, w), at(P, 14, 2)];
  w = apply(turnAbout(pt(0, 0), -PI / 3), w);
  nH.push(sub(nH[3], w), at(P, 6, 2));
  const take = (m, list) => (list.forEach((i) => kid(m, P.kids[i].T, P.kids[i].g)), m);
  const h = take(meta(nH, 0), [0, 9, 16, 27, 26, 6, 1, 8, 10, 15]);
  const p = take(meta([p72, add(p72, sub(b1, llc)), b1, llc], 3), [7, 2, 3, 4, 28]);
  const f = take(meta([b2, at(P, 24, 2), at(P, 25, 0), p252, add(p252, sub(llc, b1))], 4), [21, 20, 22, 23, 24, 25]);
  const A = nH[2], B = add(nH[1], sub(nH[4], nH[5]));
  const t = take(meta([B, apply(turnAbout(B, -PI / 3), A), A], 2), [11]);
  for (const m of [h, t, p, f]) recentre(m);
  return [h, t, p, f];
}

// Four substitutions: an H metatile of 7,921 hats, 1,009 of them mirrored.
// Each hat keeps its label and its turn (0..5, sixty degrees each), with the
// index and label of the cluster holding it at levels 0 to 3 (level 0 is the
// metatile of one to four hats, level 3 a cluster of up to 1,156). The order
// of the list is the order the substitution nests them.
const LEVELS = 4;
const TILING = (() => {
  let m = first();
  for (let i = 0; i < LEVELS; i++) m = next(patch(m));
  const list = [];
  let serial = 0;
  const walk = (g, T, ids, labs) => {
    if (g.hat) return list.push({ T, label: g.label, ids: ids.slice(), labs: labs.slice() });
    ids.push(serial++);
    labs.push(g.label);
    for (const k of g.kids) walk(k.g, mul(T, k.T), ids, labs);
    ids.pop();
    labs.pop();
  };
  walk(m[0], ID, [], []);
  const n = list.length;
  const label = new Uint8Array(n), turn = new Uint8Array(n), cid = new Int32Array(n * 4), clab = new Uint8Array(n * 4);
  const vx = new Float64Array(n * NV), vy = new Float64Array(n * NV);
  list.forEach((h, k) => {
    label[k] = h.label;
    turn[k] = (round(atan2(h.T[3], h.T[0]) / (PI / 3)) + 6) % 6;
    // ids run from the top (level 4) down to level 0.
    for (let l = 0; l < 4; l++) (cid[k * 4 + l] = h.ids[LEVELS - l]), (clab[k * 4 + l] = h.labs[LEVELS - l]);
    HAT.forEach((p, i) => {
      const q = apply(h.T, p);
      (vx[k * NV + i] = q.x), (vy[k * NV + i] = q.y);
    });
  });
  // Lift every corner into two parts, the sum of the a edges and the sum of
  // the b edges along a path to it from one fixed corner. An a edge always
  // meets an a edge, so the lift does not depend on the path, and a * A +
  // b * B is the same tiling made of Tile(a, b).
  // Corners are keyed by their lattice place relative to the first corner.
  const key = (x, y) => (round((x - vx[0]) * 4) + 4096) * 16384 + round((y - vy[0]) / (R3 / 2)) + 4096;
  const share = new Map();
  for (let i = 0; i < n * NV; i++) {
    const kk = key(vx[i], vy[i]);
    const l = share.get(kk);
    l ? l.push(i) : share.set(kk, [i]);
  }
  const LA = new Float32Array(n * NV * 4), known = new Map(), seen = new Uint8Array(n), stack = [0];
  known.set(key(vx[0], vy[0]), [0, 0, 0, 0]);
  seen[0] = 1;
  while (stack.length) {
    const k = stack.pop();
    let i0 = 0;
    while (!known.has(key(vx[k * NV + i0], vy[k * NV + i0]))) i0++;
    let [ax, ay, bx, by] = known.get(key(vx[k * NV + i0], vy[k * NV + i0]));
    for (let s = 0; s < NV; s++) {
      const i = (i0 + s) % NV, j = (i + 1) % NV, o = k * NV + i, kk = key(vx[o], vy[o]);
      if (!known.has(kk)) known.set(kk, [ax, ay, bx, by]);
      LA.set([ax, ay, bx, by], o * 4);
      for (const r of share.get(kk)) {
        const h = (r / NV) | 0;
        if (!seen[h]) (seen[h] = 1), stack.push(h);
      }
      const dx = vx[k * NV + j] - vx[o], dy = vy[k * NV + j] - vy[o];
      if (KIND[i]) (bx += dx), (by += dy);
      else (ax += dx), (ay += dy);
    }
  }
  // Over the whole patch the a part grows as a fixed similarity MA of the
  // position (a least-squares fit), the b part as I - MA. Dividing by the mix
  // keeps any Tile(a, b) the hat's size and lined up with the hat tiling.
  let a11 = 0, a12 = 0, a21 = 0, a22 = 0, xx = 0, xy = 0, yy = 0;
  for (let i = 0; i < n * NV; i++) {
    const px = vx[i] - vx[0], py = vy[i] - vy[0], A = LA[i * 4], B = LA[i * 4 + 1];
    (a11 += A * px), (a12 += A * py), (a21 += B * px), (a22 += B * py), (xx += px * px), (xy += px * py), (yy += py * py);
  }
  const d = xx * yy - xy * xy;
  const MA = [(a11 * yy - a12 * xy) / d, (a12 * xx - a11 * xy) / d, (a21 * yy - a22 * xy) / d, (a22 * xx - a21 * xy) / d];
  // The patch's middle in lift coordinates: the top metatile is centred on 0.
  return { n, label, turn, cid, clab, LA, MA, cx: -vx[0], cy: -vy[0] };
})();
const NH = TILING.n;

// Size of a hat across, in lattice units: the hats sit at half scale.
const ACROSS = 2.75;
// Story seconds at Speed 2 for the build and the cycle. WAVES says when the
// colours regroup and to which level; a wave and a clearing take WAVE and
// CLEAR seconds, and the window drifts DRIFT LEDs a second.
const BUILD = 1.6, CYCLE = 36, WAVES = [[11, 1], [17, 2], [23, 0]], WAVE = 1.6, CLEAR = 1.2, DRIFT = 2.5;
// Hue of each label at Hue 0: H blue, H1 orange, T yellow, P magenta, F green.
const HUES = [0.6, 0.075, 0.15, 0.84, 0.36];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = {
    fresh: true, t: 0, hue: 0, speed: 2, size: 9, shape: 0.06, shapeKey: NaN,
    PX: new Float32Array(NH * NV), PY: new Float32Array(NH * NV), CX: new Float32Array(NH), CY: new Float32Array(NH),
    born: new Float32Array(NH), gone: new Float32Array(NH).fill(1e9), flip: new Float32Array(NH).fill(-10), from: 0, to: 0,
    cycle: 0, waveAt: 0, clearAt: 1e9, arc: 0, ox: 0, oy: 0, u: 1,
    id: new Int32Array(NP), col: new Float32Array(NH * 3), lv: new Uint8Array(NH), vis: new Int32Array(NH), nvis: 0, xs: new Float64Array(32),
  };
}

// Shape knob to the angle of (a, b): comet at 0 degrees, turtle 30, Tile(1, 1) 45, hat 60, chevron 90.
const angle = (k) => (k < 0 ? 60 + 60 * k : k < 0.12 ? 60 : 60 + (30 * (k - 0.12)) / 0.88);

function reshape(S) {
  const th = (angle(S.shape) * PI) / 180, wa = cos(th), wb = sin(th) / sqrt(3), { LA, MA } = TILING;
  const L = [wa * MA[0] + wb * (1 - MA[0]), wa * MA[1] - wb * MA[1], wa * MA[2] - wb * MA[2], wa * MA[3] + wb * (1 - MA[3])];
  const d = L[0] * L[3] - L[1] * L[2], i0 = L[3] / d, i1 = -L[1] / d, i2 = -L[2] / d, i3 = L[0] / d;
  const { PX, PY, CX, CY } = S;
  for (let k = 0; k < NH; k++) {
    let sx = 0, sy = 0;
    for (let i = k * NV; i < (k + 1) * NV; i++) {
      const x = wa * LA[4 * i] + wb * LA[4 * i + 2], y = wa * LA[4 * i + 1] + wb * LA[4 * i + 3];
      sx += PX[i] = i0 * x + i1 * y;
      sy += PY[i] = i2 * x + i3 * y;
    }
    CX[k] = sx / NV;
    CY[k] = sy / NV;
  }
}

// The hats whose middles are on the panel now, in nesting order.
function onPanel(S) {
  const { CX, CY, u, ox, oy, vis } = S, r = 2 * u + 2;
  let n = 0;
  for (let k = 0; k < NH; k++) {
    const x = CX[k] * u + ox, y = CY[k] * u + oy;
    if (x > -r && x < W + r && y > -r && y < H + r) vis[n++] = k;
  }
  return n;
}

// Each hat on the panel gets a time in nesting order across span seconds.
function stagger(S, out, t0, span, rest) {
  const n = onPanel(S);
  out.fill(t0 + rest);
  for (let i = 0; i < n; i++) out[S.vis[i]] = t0 + (span * i) / max(1, n - 1);
}

// The window: a slow loop round the middle of the patch, kept inside it.
function view(S) {
  S.u = S.size / ACROSS;
  const R = cl(64 - 74 / S.u, 6, 40), a = S.arc / R + 2;
  S.ox = round(W / 2 - (TILING.cx + R * cos(a)) * S.u);
  S.oy = round(H / 2 - (TILING.cy + 0.8 * R * sin(a)) * S.u);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.size = cl(k[2], 9, 16);
  S.shape = cl(k[3], -1, 1);
  if (S.shape !== S.shapeKey) (S.shapeKey = S.shape), reshape(S);
  const ds = (d * S.speed) / 2;
  S.t += ds;
  S.arc += (DRIFT * ds) / (S.size / ACROSS);
  view(S);
  if (S.fresh) {
    S.fresh = false;
    stagger(S, S.born, 0, BUILD, BUILD);
  }
  const press = input.btnPressed && input.btnPressed[0];
  const c = S.t - S.cycle;
  if ((press && S.clearAt > S.t + CLEAR) || (c > CYCLE - CLEAR - 0.4 && S.clearAt > 1e8)) {
    // Clear in nesting order, then build again where the window is then.
    S.clearAt = S.t;
    stagger(S, S.gone, S.t, CLEAR, CLEAR);
  }
  if (S.t > S.clearAt + CLEAR + 0.4) {
    S.cycle = S.t;
    S.clearAt = 1e9;
    S.gone.fill(1e9);
    S.from = S.to = 0;
    S.waveAt = 0;
    stagger(S, S.born, S.t, BUILD, BUILD);
  }
  for (const [w, v] of WAVES)
    if (c >= w && S.waveAt < w) {
      S.waveAt = w;
      S.from = S.to;
      S.to = v;
      stagger(S, S.flip, S.t, WAVE, WAVE);
    }
}

// The label a hat shows in a view: its own, or that of the cluster of level
// 1 or 2 holding it. The mirrored hats keep their own colour in every view.
const shown = (k, v) => (v === 0 || TILING.label[k] === 1 ? TILING.label[k] : TILING.clab[k * 4 + v]);

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { id, col, lv, PX, PY, u, ox, oy, xs, born, gone, flip, t } = S, cid = TILING.cid;
  id.fill(-1);
  const n = onPanel(S), rgb = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const k = S.vis[i];
    // Fill the hat's 14-gon, LED centres inside it.
    let y0 = 1e9, y1 = -1e9;
    for (let j = k * NV; j < (k + 1) * NV; j++) (y0 = min(y0, PY[j])), (y1 = max(y1, PY[j]));
    const r0 = max(0, ceil(y0 * u + oy - 0.5)), r1 = min(H - 1, ceil(y1 * u + oy - 0.5) - 1);
    for (let r = r0; r <= r1; r++) {
      const py = r + 0.5;
      let m = 0;
      for (let a = k * NV + NV - 1, b = k * NV; b < (k + 1) * NV; a = b++) {
        const ya = PY[a] * u + oy, yb = PY[b] * u + oy;
        if (ya <= py !== yb <= py) {
          const xa = PX[a] * u + ox;
          let x = xa + ((py - ya) * (PX[b] * u + ox - xa)) / (yb - ya), q = m++;
          while (q > 0 && xs[q - 1] > x) (xs[q] = xs[q - 1]), q--;
          xs[q] = x;
        }
      }
      for (let q = 0; q + 1 < m; q += 2) {
        const xa = max(0, ceil(xs[q] - 0.5)), xb = min(W - 1, ceil(xs[q + 1] - 0.5) - 1);
        for (let x = xa; x <= xb; x++) id[r * W + x] = k;
      }
    }
    // Its colour: the label's hue, one of six close shades for its turn,
    // a white flash as it arrives or changes colour, dark before and after.
    const tn = TILING.turn[k], age = t - born[k], fl = t - flip[k];
    const v = (lv[k] = fl >= 0 ? S.to : S.from);
    hsv(HUES[shown(k, v)] + S.hue + 0.012 * (tn - 2.5), 0.92 - 0.045 * tn, 1 - 0.02 * tn, rgb, 0);
    const glow = max(age >= 0 ? exp(-age / 0.18) : 0, fl >= 0 ? 0.7 * exp(-fl / 0.25) : 0);
    const on = age < 0 ? 0 : (1 - ease((t - gone[k]) / 0.3)) * min(1, 0.75 + age / 0.12);
    for (let c = 0; c < 3; c++) col[k * 3 + c] = on * (rgb[c] + (1 - rgb[c]) * glow);
  }
  // A hat that differs from the LED to its right or below loses that LED to
  // a dark seam, one LED wide. While a view of level 1 or 2 shows, a seam
  // inside one cluster keeps a third of the colour, so the clusters read as
  // pieces with black between them.
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const k = id[p];
      if (k < 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const kr = x < W - 1 ? id[p + 1] : k, kd = y < H - 1 ? id[p + W] : k, L = lv[k];
      let f = 1;
      if (kr !== k || kd !== k) {
        const same = (q) => q === k || (L > 0 && q >= 0 && lv[q] === L && cid[q * 4 + L] === cid[k * 4 + L]);
        f = same(kr) && same(kd) ? 0.3 : 0;
      }
      display.setPixel(x, y, round(col[k * 3] * 255 * f), round(col[k * 3 + 1] * 255 * f), round(col[k * 3 + 2] * 255 * f));
    }
}
