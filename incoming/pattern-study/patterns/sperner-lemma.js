// ===== Patternflow pattern =====
// Title:   Sperner's Lemma
// Family:  topology
// Idea:    A tall triangle cut into small triangular rooms whose corners are labelled 1, 2 or 3 (blue, red, green) by which coordinate a slowly moving map of the triangle takes down the most, so each corner keeps its own label and each side only its two; a white walk enters through a door in the base (an edge labelled 1-2), leaves every room by its other door and always ends in a rainbow room that carries all three labels and sits on the map's fixed point.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Sperner's lemma (Emanuel Sperner, 1928) and the Brouwer fixed-point theorem it proves (L. E. J. Brouwer, 1911), pattern round 38
// Round:   38
// ===============================
// @matrix 64x128
// @knobs Mesh=12..28, Speed=0.2..3, Swirl=0..1, Ripple=0..1
//
// Knob 1: Mesh. Rooms along each side: 12 at the start (144 rooms), 20 at the middle (400), 28 at the top (784). The finer the mesh, the smaller the rainbow room, the closer it sits on the fixed point and the more the walk wanders; at 28 the territories' borders are nearly smooth curves.
// Knob 2: Speed. At 2 the push of the map leans up to 60 degrees either way and back every 21 seconds, so the three territories rock round the fixed point, the fixed point goes round its loop in 27 seconds, and a bright head runs the walk at 36 LEDs a second. At 0.2 all of it ten times slower, at 3 one and a half times faster.
// Knob 3: Swirl. Twists the map round its fixed point more the further out it reaches. At 0 the three territories are wedges meeting at the fixed point; at 0.5 their borders curl about half a turn round it; at 1 most of a turn, and the walk from the base runs along the bottom and round before it climbs in.
// Knob 4: Ripple. Adds a wavy push to the map, which gives it more fixed points. Up to 0.06 none: one fixed point and one rainbow room. At 0.25 three to seven rainbow rooms, at 1 five to eleven, always an odd number; islands of one label float in another, the walk from the base reaches one rainbow room and dim walks join the others two by two.

const W = 64, H = 128, NMAX = 28, ST = NMAX + 1;
const { floor, min, max, abs, sqrt, sin, cos, atan2, round, hypot, PI } = Math;
const TAU = 2 * PI, R3 = sqrt(3);
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The big triangle on the panel, pixel centres at x + 0.5: corner 1 bottom
// left, corner 2 bottom right, corner 3 the apex. The base is the 1-2 side.
const P1x = 0.5, P1y = 127.2, P2x = 63.5, P2y = 127.2, P3x = 32, P3y = 0.8;
const E2x = P2x - P1x, E2y = P2y - P1y, E3x = P3x - P1x, E3y = P3y - P1y, DET = E2x * E3y - E3x * E2y;
// Length of the gradient of each barycentric coordinate, in units per LED:
// the distance from a pixel to a mesh line is its offset over this.
const G2 = hypot(E3y, E3x) / abs(DET), G3 = hypot(E2y, E2x) / abs(DET);
const G1 = hypot(E3y - E2y, E2x - E3x) / abs(DET);

// The map f is defined on an equilateral triangle, corners E1 = (-1, 0),
// E2 = (1, 0), E3 = (0, sqrt 3): f(q) = q + d(q), pulled back into the
// triangle by the nearest point, so f is continuous and maps the triangle
// into itself. d turns round the fixed point c by an angle that grows by
// SWIRL radians per unit of distance at Swirl 1, and is STEP long from R0
// out, shrinking to nothing at c.
const STEP = 0.12, R0 = 0.35, SWIRL = 3.4;
// The ripple: two waves added to d, up to RIP times STEP.
const RIP = 3.5;

// Label colours, the territories at FILL of full: 1 azure, 2 rose, 3 green.
const COL = [
  [0.12, 0.42, 1],
  [1, 0.18, 0.3],
  [0.2, 0.95, 0.28],
];
const FILL = 0.7;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

export function setup(params) {
  params.s = {
    n: 0, speed: 2, swirl: 0, ripple: 0, t: 0, head: 0, begun: false,
    lab: new Int8Array(ST * ST), cx: 0, cy: 0, turn: 0,
    walks: [], main: null, rainbow: [], seen: new Uint8Array(2 * NMAX * NMAX),
    line: new Float32Array(W * H), room: new Int32Array(W * H), R: new Float32Array(W * H), G: new Float32Array(W * H), B: new Float32Array(W * H),
    y: [0, 0, 0], hc: [0, 0, 0],
  };
}

// Vertex (b, c) of an n-mesh has barycentric coordinates (n - b - c, b, c) / n.
const vid = (b, c) => c * ST + b;

// Rooms: up room (i, j) has corners (i, j), (i + 1, j), (i, j + 1); down room
// (i, j) has corners (i + 1, j), (i, j + 1), (i + 1, j + 1).
const rid = (i, j, down) => 2 * (j * NMAX + i) + down;
function corners(r) {
  const down = r & 1, k = r >> 1, i = k % NMAX, j = (k - i) / NMAX;
  return down ? [vid(i + 1, j), vid(i, j + 1), vid(i + 1, j + 1)] : [vid(i, j), vid(i + 1, j), vid(i, j + 1)];
}
// The three walls of a room, each as its two corners and the room behind it
// (-1 for the base, -2 for the other two sides).
function walls(r, n) {
  const down = r & 1, k = r >> 1, i = k % NMAX, j = (k - i) / NMAX;
  if (down)
    return [
      [vid(i + 1, j), vid(i, j + 1), rid(i, j, 0)],
      [vid(i, j + 1), vid(i + 1, j + 1), rid(i, j + 1, 0)],
      [vid(i + 1, j), vid(i + 1, j + 1), rid(i + 1, j, 0)],
    ];
  return [
    [vid(i, j), vid(i + 1, j), j > 0 ? rid(i, j - 1, 1) : -1],
    [vid(i, j), vid(i, j + 1), i > 0 ? rid(i - 1, j, 1) : -2],
    [vid(i + 1, j), vid(i, j + 1), i + j < n - 1 ? rid(i, j, 1) : -2],
  ];
}

// The map at barycentric x, written into y as barycentric coordinates.
// Near the sides the turn and the ripple fade out (over the band where the
// smallest coordinate is under EDGE), so there d points at c and q + d stays
// inside: f has no fixed point on the sides, only where d is zero inside.
const EDGE = 0.16;
function f(S, x1, x2, x3, y) {
  const mb = min(x1, x2, x3), qx = x2 - x1, qy = R3 * x3, inner = sm(0, EDGE, mb);
  const dx = S.cx - qx, dy = S.cy - qy, r = hypot(dx, dy);
  let gx = 0, gy = 0;
  if (r > 1e-12) {
    const psi = (S.turn + S.swirl * SWIRL * r) * inner, m = (STEP * min(r, R0)) / R0 / r, cs = cos(psi), sn = sin(psi);
    gx = (dx * cs - dy * sn) * m;
    gy = (dx * sn + dy * cs) * m;
  }
  if (S.ripple > 0) {
    const a = S.ripple ** 0.6 * RIP * STEP * sm(0, EDGE / 2, mb), ph = S.t * 0.21;
    gx += a * sin(5.3 * qx + 3.1 * qy + ph);
    gy += a * sin(-4.4 * qx + 4.9 * qy + 1.9 - 0.8 * ph);
  }
  let px = qx + gx, py = qy + gy;
  // Back into the triangle by the nearest point.
  let z3 = py / R3, z2 = (1 - z3 + px) / 2, z1 = (1 - z3 - px) / 2;
  if (z1 < 0 || z2 < 0 || z3 < 0) {
    let best = Infinity, bx = 0, by = 0;
    const E = [-1, 0, 1, 0, 0, R3];
    for (let e = 0; e < 3; e++) {
      const ax = E[2 * e], ay = E[2 * e + 1], ex = E[(2 * e + 2) % 6] - ax, ey = E[(2 * e + 3) % 6] - ay;
      const t = cl(((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey), 0, 1), sx = ax + t * ex, sy = ay + t * ey;
      const d2 = (px - sx) ** 2 + (py - sy) ** 2;
      if (d2 < best) {
        best = d2;
        bx = sx;
        by = sy;
      }
    }
    px = bx;
    py = by;
    z3 = max(0, py / R3);
    z2 = max(0, (1 - z3 + px) / 2);
    z1 = max(0, 1 - z2 - z3);
  }
  y[0] = z1;
  y[1] = z2;
  y[2] = z3;
}

// Label every vertex: of the coordinates that are not zero, the one f takes
// down the most. Such a one always exists because both sum to 1, and a
// coordinate that is zero is never chosen, so each corner gets its own label
// and each side only its two corners' labels: a Sperner labelling.
function label(S) {
  const n = S.n, y = S.y;
  for (let c = 0; c <= n; c++)
    for (let b = 0; b + c <= n; b++) {
      const a = n - b - c, x = [a / n, b / n, c / n];
      f(S, x[0], x[1], x[2], y);
      let best = -Infinity, L = 0;
      for (let i = 0; i < 3; i++)
        if (x[i] > 0 && x[i] - y[i] > best + 1e-12) {
          best = x[i] - y[i];
          L = i;
        }
      S.lab[vid(b, c)] = L;
    }
}

const isDoor = (S, va, vb) => S.lab[va] + S.lab[vb] === 1;
function rainbow(S, r) {
  const [a, b, c] = corners(r), L = S.lab;
  return L[a] !== L[b] && L[b] !== L[c] && L[a] !== L[c];
}

// Walk from room r, having come in through the wall behind which lies
// `from`: leave by the other door each time. Ends in a rainbow room (end =
// room) or out through a door in the base (end = -1).
function walk(S, r, from, pts) {
  const n = S.n;
  for (let guard = 0; guard < 2 * n * n + 2; guard++) {
    S.seen[r] = 1;
    const cs = corners(r);
    pts.push(centroid(n, cs));
    if (rainbow(S, r)) return r;
    const ws = walls(r, n);
    let out = null;
    for (const w of ws) if (isDoor(S, w[0], w[1]) && w[2] !== from) out = w;
    if (!out) return r;
    pts.push(mid(n, out[0], out[1]));
    if (out[2] < 0) return -1;
    from = r;
    r = out[2];
  }
  return -1;
}

// Panel position of vertex v of an n-mesh.
function vpos(n, v) {
  const b = v % ST, c = (v - b) / ST;
  return [P1x + (E2x * b + E3x * c) / n, P1y + (E2y * b + E3y * c) / n];
}
function centroid(n, cs) {
  const a = vpos(n, cs[0]), b = vpos(n, cs[1]), c = vpos(n, cs[2]);
  return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
}
function mid(n, va, vb) {
  const a = vpos(n, va), b = vpos(n, vb);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

// All the door walks: from each door in the base, then from each rainbow
// room no walk has reached yet. The main walk is the leftmost one from the
// base that ends in a rainbow room; there is always one, because the base
// holds an odd number of doors and walks from the base pair them up two by
// two except where they end in a rainbow room.
function walkAll(S) {
  const n = S.n;
  S.seen.fill(0);
  S.walks = [];
  S.main = null;
  S.rainbow = [];
  for (let i = 0; i < n; i++) {
    const r = rid(i, 0, 0);
    if (S.seen[r] || !isDoor(S, vid(i, 0), vid(i + 1, 0))) continue;
    const pts = [mid(n, vid(i, 0), vid(i + 1, 0))], end = walk(S, r, -1, pts);
    const w = { pts, end, base: true };
    S.walks.push(w);
    if (end >= 0 && !S.main) S.main = w;
  }
  for (let j = 0; j < n; j++)
    for (let i = 0; i + j < n; i++)
      for (let down = 0; down < 2; down++) {
        if (down && i + j > n - 2) continue;
        const r = rid(i, j, down);
        if (!rainbow(S, r)) continue;
        S.rainbow.push(r);
        if (S.seen[r]) continue;
        // Its one door, and on from the room behind it.
        S.seen[r] = 1;
        const pts = [centroid(n, corners(r))];
        let end = r;
        for (const w of walls(r, n))
          if (isDoor(S, w[0], w[1])) {
            pts.push(mid(n, w[0], w[1]));
            end = w[2] >= 0 ? walk(S, w[2], r, pts) : -1;
          }
        S.walks.push({ pts, end, base: false });
      }
}

function lengthOf(pts) {
  let L = 0;
  for (let k = 1; k < pts.length; k++) L += hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  return L;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [12, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.n = round(cl(k[0], 12, NMAX));
  S.speed = cl(k[1], 0.2, 3);
  S.swirl = cl(k[2], 0, 1);
  // Up to 0.06 no ripple, so the opening has one fixed point.
  S.ripple = max(0, cl(k[3], 0, 1) - 0.06) / 0.94;
  if (!S.begun) {
    // Open some way into the run, further in the faster it goes, so Speed
    // shows from the first second.
    S.t = 4 * S.speed;
    S.begun = true;
  }
  S.t += (d * S.speed) / 2;
  S.head += d * S.speed * 18;
  // The fixed point of the map without ripple wanders inside the triangle,
  // its barycentric coordinates never under 0.12, round its loop in 27
  // seconds at Speed 2.
  const t = S.t, rr = 0.13 + 0.08 * sin(0.37 * t + 0.6), ph = 0.23 * t + 1.1;
  const c1 = 1 / 3 + rr * cos(ph), c2 = 1 / 3 + rr * cos(ph - TAU / 3), c3 = 1 - c1 - c2;
  S.cx = c2 - c1;
  S.cy = R3 * c3;
  // The push leans up to 60 degrees either side of straight at c, back and
  // forth every 21 seconds at Speed 2.
  S.turn = 1.05 * sin(0.3 * t);
  label(S);
  walkAll(S);
}

// Light the line buffer along a polyline, with brightness fn(s) at arc
// length s.
function stroke(S, pts, fn) {
  const L = S.line;
  let s = 0;
  for (let k = 1; k < pts.length; k++) {
    const ax = pts[k - 1][0], ay = pts[k - 1][1], bx = pts[k][0], by = pts[k][1];
    const ex = bx - ax, ey = by - ay, len = hypot(ex, ey);
    if (len < 1e-6) continue;
    const x0 = max(0, floor(min(ax, bx) - 1.5)), x1 = min(W - 1, floor(max(ax, bx) + 1.5));
    const y0 = max(0, floor(min(ay, by) - 1.5)), y1 = min(H - 1, floor(max(ay, by) + 1.5));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - ax, py = y + 0.5 - ay, u = cl((px * ex + py * ey) / (len * len), 0, 1);
        const dd = hypot(px - u * ex, py - u * ey), a = cl(1.25 - dd, 0, 1);
        if (a <= 0) continue;
        const v = a * fn(s + u * len), p = y * W + x;
        if (v > L[p]) L[p] = v;
      }
    s += len;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.n) return;
  const { n, lab, R, G, B, line, hc, room } = S;
  line.fill(0);
  const isMainEnd = (r) => S.main && S.main.end === r;
  const rb = new Set(S.rainbow);
  // The territories, the mesh and the rainbow rooms.
  const lw = 0.5 + 0.3 * (NMAX - n) / 16;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, X = x + 0.5 - P1x, Y = y + 0.5 - P1y;
      const l2 = (X * E3y - Y * E3x) / DET, l3 = (E2x * Y - E2y * X) / DET, l1 = 1 - l2 - l3;
      if (l1 < -0.004 || l2 < -0.004 || l3 < -0.004) {
        R[p] = G[p] = B[p] = 0;
        room[p] = -1;
        continue;
      }
      const u = cl(l2 * n, 0, n - 1e-6), v = cl(l3 * n, 0, n - 1e-6);
      let i = floor(u), j = floor(v);
      if (i + j > n - 1) j = n - 1 - i;
      const fu = u - i, fv = v - j, down = fu + fv > 1 ? 1 : 0;
      const r = rid(i, j, down), cs = corners(r);
      const w = down ? [fu + fv - 1, 1 - fu, 1 - fv] : [1 - fu - fv, fu, fv];
      // Each corner's share of the room: the part nearer it than the others,
      // so every vertex sits in a cell of its own label's colour.
      let m = 0;
      if (w[1] > w[m]) m = 1;
      if (w[2] > w[m]) m = 2;
      const c = COL[lab[cs[m]]];
      // Mesh lines: dark walls, about one LED wide.
      const a1 = u - i, b1 = v - j, w1 = u + v - floor(u + v);
      const dm = min(min(a1, 1 - a1) / (n * G2), min(b1, 1 - b1) / (n * G3), min(w1, 1 - w1) / (n * G1));
      const wl = 1 - sm(0.2, 0.75, dm);
      room[p] = r;
      if (rb.has(r)) {
        // A rainbow room: a spinning wheel of every hue inside white walls.
        const ctr = centroid(n, cs), a = atan2(y + 0.5 - ctr[1], x + 0.5 - ctr[0]) / TAU;
        hsv(a + S.t * 0.6, 0.85, 1, hc);
        const k = isMainEnd(r) ? 0.9 : 0.6;
        R[p] = 255 * (hc[0] + (k - hc[0]) * wl);
        G[p] = 255 * (hc[1] + (k - hc[1]) * wl);
        B[p] = 255 * (hc[2] + (k - hc[2]) * wl);
        continue;
      }
      const wall = 1 - lw * wl;
      R[p] = c[0] * FILL * wall * 255;
      G[p] = c[1] * FILL * wall * 255;
      B[p] = c[2] * FILL * wall * 255;
    }
  // The other walks dim; the main one brighter, with a head running from
  // the base door into the rainbow room and a pause there before it runs again.
  // Each walk is drawn from door to door and stops at the wall of a rainbow
  // room, so the room's own colours stay clear.
  const trim = (w) => w.pts.slice(w.base ? 0 : 1, w.end >= 0 ? w.pts.length - 1 : w.pts.length);
  for (const w of S.walks) if (w !== S.main) stroke(S, trim(w), () => 0.42);
  if (S.main) {
    const pts = trim(S.main), L = lengthOf(pts), cyc = L + 30, hs = S.head % cyc;
    stroke(S, pts, (s) => {
      const back = hs - s;
      return back < 0 ? 0.62 : 0.62 + 0.38 * Math.exp(-back / 9);
    });
    // A halo round the room the walk ends in, flaring as the head arrives.
    const ctr = centroid(n, corners(S.main.end)), fl = hs > L ? Math.exp(-(hs - L) / 12) : 0;
    const rad = 5 + 3 * fl + 60 / n, amp = 0.3 + 0.5 * fl;
    for (let y = max(0, floor(ctr[1] - rad)); y <= min(H - 1, floor(ctr[1] + rad)); y++)
      for (let x = max(0, floor(ctr[0] - rad)); x <= min(W - 1, floor(ctr[0] + rad)); x++) {
        const dd = hypot(x + 0.5 - ctr[0], (y + 0.5 - ctr[1]) * 0.6) / rad;
        if (dd >= 1) continue;
        const g = amp * (1 - dd) * (1 - dd), p = y * W + x;
        if (room[p] < 0 || rb.has(room[p])) continue;
        R[p] += (255 - R[p]) * g;
        G[p] += (255 - G[p]) * g;
        B[p] += (255 - B[p]) * g;
      }
  }
  for (let p = 0; p < W * H; p++) {
    const a = line[p];
    const r = R[p] * (1 - a) + 255 * a, g = G[p] * (1 - a) + 255 * a, b = B[p] * (1 - a) + 255 * a;
    display.setPixel(p % W, (p / W) | 0, round(min(255, r)), round(min(255, g)), round(min(255, b)));
  }
}
