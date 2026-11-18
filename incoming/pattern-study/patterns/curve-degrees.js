// ===== Patternflow pattern =====
// Title:   Curve Degrees
// Family:  type
// Idea:    One big letter is drawn twice from the same hand-coded cubic outline, above as the cubics themselves and below with every cubic replaced by 1, 2, 4 and then 8 quadratics and back, each half with its on-curve squares, off-curve rings and handles as a font editor shows them, red where the two fills disagree, and the largest distance between the two outlines measured and written in 3 by 5 digits.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: cubic outlines of PostScript Type 1 fonts (Adobe, 1984, year from memory) against the quadratic outlines of TrueType (Apple, 1991, year from memory), a cubic cut at equal t by de Casteljau's algorithm (Paul de Casteljau, c. 1959, year from memory) with each piece refitted by one quadratic, the nonzero winding fill, pattern round 112
// Round:   112
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Letter=0..2, Pieces=0..8
//
// Knob 1: Hue. Turns the fill, the outline and the off-curve points round the wheel together; the red of the disagreement and the white on-curve squares stay. At 0 the fill is azure, the outline a paler azure and the off-curve points and handles gold. Orange and yellow are made paler so they do not read as brown. Near 0.4 the fill passes through a dark pink and red, where the disagreement is harder to tell from it.
// Knob 2: Speed. How fast the cycle runs. Pieces goes 1, 2, 4, 8, 4, 2 and round again in 14 s at 2, 56 s at 0.5 and 7 s at 4: at 2 each count is held 1.5 s (2.2 s for 1 and for 8) after the 0.6 s the cuts take to slide into it. A white spark walks the outline of both halves at the same place, a lap in 4.5 s at 2.
// Knob 3: Letter. Which letter, rounded: 0 S, 1 e, 2 g, each 49 to 50 LEDs tall and 42 to 50 wide. S is one contour of 12 segments, ten cubics and two straight terminals, and its spine is two cubics that each turn through an inflection; e has two contours and six cubics, g two and eleven. With 1 piece the largest distance is 5.2 LEDs for S, 3.7 for e and 2.7 for g; with 8 it is 0.0 for all three.
// Knob 4: Pieces. How many quadratics stand for each cubic below. Under 0.5 the count cycles by itself, which is where it opens at 0.06. From 0.5 it is held and the cuts slide to it: 1 to 1.4, 2 to 2.8, 4 to 5.7, 8 above. For S the largest distance is 5.2, 0.7, 0.1 and 0.0 LEDs at 1, 2, 4 and 8, about eight times less for each doubling, and the lower letter has 10, 20, 40 and 80 quadratics, so 12, 22, 42 and 82 on-curve points against the 12 above. The four bars in the band show that distance on a log scale for each count, the one now shown lit, and a white ring marks the place on the letter where it is largest.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, hypot, log, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fr = (v) => v - floor(v);
const sm5 = (v) => ((v = cl(v, 0, 1)), v * v * v * (v * (v * 6 - 15) + 10));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A colour that does not go brown: orange and yellow come out lighter and paler.
function tint(h, s, v, out) {
  const hh = fr(h);
  if (hh > 0.02 && hh < 0.2) {
    v = 0.5 + 0.5 * v;
    s *= 0.6;
  }
  hsv(hh, s, v, out);
}

// ---- Layout. The letter is drawn in a box 52 LEDs wide and 50 tall, once
// at the top and once at the bottom, with a band between for the numbers.
const GX = 6, GW = 52, GH = 50, TOP_Y = 3, BOT_Y = 75;
const SX = GW / 100, SY = GH / 100;
const NS = [1, 2, 4, 8]; // pieces per cubic

// ---- Outlines. Each is closed paths of M, L and C in a box 100 by 100 with
// y down, each C a cubic with two off-curve points, written by hand. A
// contour that turns the other way than the one it sits in is a hole.
const GLYPHS = [
  {
    // S: the spine is two single cubics with an inflection in each, which
    // is what one quadratic cannot follow.
    dx: 0,
    d: ["M 78 31 C 78 24 66 18.5 50 18.5 C 33 18.5 24 25 24 31 C 24 55 98 16 98 69 C 98 89 74 100 50 100 C 25 100 4 89 4 69 L 22 69 C 22 76 34 81.5 50 81.5 C 67 81.5 76 75 76 69 C 76 45 2 84 2 31 C 2 11 26 0 50 0 C 75 0 96 11 96 31 L 78 31 Z"],
  },
  {
    // e: the left side of the ring is one cubic a half turn long, and the eye is another.
    dx: 0,
    d: [
      "M 93.7 56 L 24.5 56 C 27 70 37.6 80 50 80 C 59.3 80 67.9 74.3 72.5 65 L 88.1 75 C 80.2 90.5 65.7 100 50 100 C -8.7 100 -8.7 0 50 0 C 76.4 0 96.9 26.2 93.7 56 Z",
      "M 24.5 44 L 75.5 44 C 69.8 12 30.2 12 24.5 44 Z",
    ],
  },
  {
    // g: a bowl on a stem that runs on down into a hook, a half-turn cubic round the left of the bowl.
    dx: 8,
    d: [
      "M 62 61.6 L 62 69 C 62 75.1 53 80 42 80 C 33.6 80 26.1 77.1 23.2 72.8 L 4.4 78.9 C 10.2 90.4 25.2 98 42 98 C 64.1 98 82 85 82 69 L 82 33 C 82 14.8 64.1 0 42 0 C -11.3 0 -11.3 66 42 66 C 49 66 55.9 64.5 62 61.6 Z",
      "M 62 33 C 62 41.3 53 48 42 48 C 31 48 22 41.3 22 33 C 22 24.7 31 18 42 18 C 53 18 62 24.7 62 33 Z",
    ],
  },
];

// A path to a list of segments in LED units, each [x0, y0, x1, y1, x2, y2, x3, y3]
// with line true for the ones written L, which have no off-curve points.
function parse(g) {
  const segs = [];
  g.d.forEach((path, ci) => {
    const t = path.trim().split(/\s+/);
    let i = 0, cx = 0, cy = 0;
    const X = (v) => GX + SX * (v + g.dx), Y = (v) => SY * v;
    while (i < t.length) {
      const c = t[i++];
      if (c === "M") {
        cx = +t[i++];
        cy = +t[i++];
      } else if (c === "L") {
        const x = +t[i++], y = +t[i++];
        segs.push({ ci, line: true, p: [X(cx), Y(cy), X(cx + (x - cx) / 3), Y(cy + (y - cy) / 3), X(cx + ((x - cx) * 2) / 3), Y(cy + ((y - cy) * 2) / 3), X(x), Y(y)] });
        cx = x;
        cy = y;
      } else if (c === "C") {
        const v = [];
        for (let k = 0; k < 6; k++) v.push(+t[i++]);
        segs.push({ ci, line: false, p: [X(cx), Y(cy), X(v[0]), Y(v[1]), X(v[2]), Y(v[3]), X(v[4]), Y(v[5])] });
        cx = v[4];
        cy = v[5];
      }
    }
  });
  return segs;
}

// ---- Curves.
const cub = (p, o0, t, o) => {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  o[0] = a * p[o0] + b * p[o0 + 2] + c * p[o0 + 4] + d * p[o0 + 6];
  o[1] = a * p[o0 + 1] + b * p[o0 + 3] + c * p[o0 + 5] + d * p[o0 + 7];
};
const quad = (p, o0, t, o) => {
  const u = 1 - t, a = u * u, b = 2 * u * t, c = t * t;
  o[0] = a * p[o0] + b * p[o0 + 2] + c * p[o0 + 4];
  o[1] = a * p[o0 + 1] + b * p[o0 + 3] + c * p[o0 + 5];
};
// de Casteljau: the cubic p cut at t, as [left, right].
function cut(p, t) {
  const l = (a, b) => a + (b - a) * t;
  const ax = l(p[0], p[2]), ay = l(p[1], p[3]), bx = l(p[2], p[4]), by = l(p[3], p[5]), cx = l(p[4], p[6]), cy = l(p[5], p[7]);
  const dx = l(ax, bx), dy = l(ay, by), ex = l(bx, cx), ey = l(by, cy), fx = l(dx, ex), fy = l(dy, ey);
  return [[p[0], p[1], ax, ay, dx, dy, fx, fy], [fx, fy, ex, ey, cx, cy, p[6], p[7]]];
}
// The piece of the cubic between t0 and t1.
function sub(p, t0, t1) {
  const r = t0 > 0 ? cut(p, t0)[1] : p;
  return t1 < 1 ? cut(r, (t1 - t0) / (1 - t0))[0] : r;
}
// One quadratic for a cubic: its end points, and the control point that is the
// mean of the two quadratics the cubic's handles would each make,
// q = (3 (c1 + c2) - p0 - p3) / 4. When the cubic is a quadratic raised in
// degree the two agree and this is that quadratic.
const fit = (p) => [p[0], p[1], (3 * (p[2] + p[4]) - p[0] - p[6]) / 4, (3 * (p[3] + p[5]) - p[1] - p[7]) / 4, p[6], p[7]];
// The cubic cut into n equal parts in t, each part one quadratic: 6 n numbers.
function quads(p, n) {
  const o = [];
  for (let i = 0; i < n; i++) o.push(...fit(sub(p, i / n, (i + 1) / n)));
  return o;
}
// A chain of quadratics cut each into r equal parts, exactly.
function split(q, r) {
  const o = [];
  for (let i = 0; i < q.length; i += 6) {
    let a = q.slice(i, i + 6);
    for (let j = 0; j < r - 1; j++) {
      const t = 1 / (r - j), l = (u, v) => u + (v - u) * t;
      const qx = l(a[0], a[2]), qy = l(a[1], a[3]), rx = l(a[2], a[4]), ry = l(a[3], a[5]), mx = l(qx, rx), my = l(qy, ry);
      o.push(a[0], a[1], qx, qy, mx, my);
      a = [mx, my, rx, ry, a[4], a[5]];
    }
    o.push(...a);
  }
  return o;
}

// ---- The scan: every edge of a shape, and its coverage by the nonzero rule.
const XS = new Float64Array(512), DS = new Int8Array(512);
const MAXE = 8000;
const SS = 5;
function raster(E, n, out) {
  out.fill(0);
  for (let row = 0; row < GH; row++)
    for (let s = 0; s < SS; s++) {
      const y = row + (s + 0.5) / SS;
      let k = 0;
      for (let e = 0; e < n; e++) {
        const o = e * 4, y0 = E[o + 1], y1 = E[o + 3];
        if (y0 <= y !== y1 <= y) {
          const x = E[o] + ((y - y0) * (E[o + 2] - E[o])) / (y1 - y0);
          let q = k++;
          while (q > 0 && XS[q - 1] > x) {
            XS[q] = XS[q - 1];
            DS[q] = DS[q - 1];
            q--;
          }
          XS[q] = x;
          DS[q] = y1 > y0 ? 1 : -1;
        }
      }
      let w = 0, xa = 0;
      for (let q = 0; q < k; q++) {
        const was = w;
        w += DS[q];
        if (was === 0 && w !== 0) xa = XS[q];
        else if (was !== 0 && w === 0) {
          const a = cl(xa, 0, W), b = cl(XS[q], 0, W);
          for (let px = floor(a); px <= min(W - 1, floor(b)); px++) out[row * W + px] += (min(b, px + 1) - max(a, px)) / SS;
        }
      }
    }
}
// The edges of a list of cubic segments (E), or of one list of quadratic
// chains, one chain per segment (Q), each flattened into steps about 2 LEDs long.
function edgesCubic(segs, E) {
  let n = 0;
  const pt = [0, 0], pr = [0, 0];
  for (const s of segs) {
    const steps = s.line ? 1 : cl(ceil(s.len / 1.6), 8, 48);
    cub(s.p, 0, 0, pr);
    for (let j = 1; j <= steps; j++) {
      cub(s.p, 0, j / steps, pt);
      E[n * 4] = pr[0];
      E[n * 4 + 1] = pr[1];
      E[n * 4 + 2] = pt[0];
      E[n * 4 + 3] = pt[1];
      n++;
      pr[0] = pt[0];
      pr[1] = pt[1];
    }
  }
  return n;
}
function edgesQuad(segs, Q, E) {
  let n = 0;
  const pt = [0, 0], pr = [0, 0];
  segs.forEach((s, i) => {
    const q = Q[i];
    for (let o = 0; o < q.length; o += 6) {
      const len = hypot(q[o + 4] - q[o], q[o + 5] - q[o + 1]) + hypot(q[o + 2] - q[o], q[o + 3] - q[o + 1]);
      const steps = s.line ? 1 : cl(ceil(len / 1.6), 3, 40);
      quad(q, o, 0, pr);
      for (let j = 1; j <= steps; j++) {
        quad(q, o, j / steps, pt);
        E[n * 4] = pr[0];
        E[n * 4 + 1] = pr[1];
        E[n * 4 + 2] = pt[0];
        E[n * 4 + 3] = pt[1];
        n++;
        pr[0] = pt[0];
        pr[1] = pt[1];
      }
    }
  });
  return n;
}

// How far the cubic outline is from the quadratic one: each cubic sampled 64
// times, the distance of each sample to the nearest point of the quadratic
// outline, and the largest of them, in LEDs, with the place it is at.
function distance(segs, Q) {
  const A = [], B = [], pt = [0, 0], pr = [0, 0];
  segs.forEach((s, i) => {
    const q = Q[i];
    for (let o = 0; o < q.length; o += 6) {
      const steps = s.line ? 1 : 24;
      quad(q, o, 0, pr);
      for (let j = 1; j <= steps; j++) {
        quad(q, o, j / steps, pt);
        A.push(pr[0], pr[1]);
        B.push(pt[0], pt[1]);
        pr[0] = pt[0];
        pr[1] = pt[1];
      }
    }
  });
  let worst = 0, wx = 0, wy = 0;
  for (const s of segs) {
    if (s.line) continue;
    for (let j = 0; j <= 64; j++) {
      cub(s.p, 0, j / 64, pt);
      let best = 1e9;
      for (let k = 0; k < A.length; k += 2) {
        const ex = B[k] - A[k], ey = B[k + 1] - A[k + 1], l2 = ex * ex + ey * ey;
        const t = l2 > 1e-12 ? cl(((pt[0] - A[k]) * ex + (pt[1] - A[k + 1]) * ey) / l2, 0, 1) : 0;
        const d = hypot(A[k] + ex * t - pt[0], A[k + 1] + ey * t - pt[1]);
        if (d < best) best = d;
      }
      if (best > worst) {
        worst = best;
        wx = pt[0];
        wy = pt[1];
      }
    }
  }
  return [worst, wx, wy];
}

// Everything about one letter that does not change from frame to frame.
function build(index, scratch) {
  const g = GLYPHS[index], segs = parse(g);
  for (const s of segs) {
    let len = 0, ax = s.p[0], ay = s.p[1];
    const pt = [0, 0];
    for (let j = 1; j <= 24; j++) {
      cub(s.p, 0, j / 24, pt);
      len += hypot(pt[0] - ax, pt[1] - ay);
      ax = pt[0];
      ay = pt[1];
    }
    s.len = len;
  }
  const L = { segs, Q: {}, err: {}, at: {}, cov: {}, covC: new Float32Array(W * GH), total: 0 };
  for (const s of segs) L.total += s.len;
  raster(scratch, edgesCubic(segs, scratch), L.covC);
  for (const n of NS) {
    L.Q[n] = segs.map((s) => (s.line ? [s.p[0], s.p[1], (s.p[0] + s.p[6]) / 2, (s.p[1] + s.p[7]) / 2, s.p[6], s.p[7]] : quads(s.p, n)));
    const [d, wx, wy] = distance(segs, L.Q[n]);
    L.err[n] = d;
    L.at[n] = [wx, wy];
    L.cov[n] = new Float32Array(W * GH);
    raster(scratch, edgesQuad(segs, L.Q[n], scratch), L.cov[n]);
  }
  return L;
}

// ---- Small figures: 3 by 5 digits.
const FACE = {
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|..#|..#", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
  ".": ".|.|.|.|#",
};
const DIG = {};
for (const k of Object.keys(FACE)) DIG[k] = FACE[k].split("|").map((r) => r.split("").map((c) => c === "#"));

const SEQ = [1, 2, 4, 8, 4, 2]; // the order of pieces the automatic cycle goes through
const STAY = [2.2, 1.5, 1.5, 2.2, 1.5, 1.5]; // seconds it holds each, at Speed 2
const MORPH = 0.6; // seconds the cuts take to slide into the next count

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, letter: 0, pk: 0.06, t: 0, ct: MORPH,
    from: 1, to: 1, mp: 1, mode: -1,
    cur: -1, G: null, fadeAt: -10, lap: 0,
    cache: [null, null, null],
    scratch: new Float64Array(MAXE * 4),
    buf: new Float32Array(W * H * 3),
    covQ: new Float32Array(W * GH), diff: new Float32Array(W * GH), blur: new Float32Array(W * GH),
    mix: Array.from({ length: 16 }, () => new Float64Array(6 * 8)),
  };
}

// The count of pieces the Pieces knob asks for: 0 is the automatic cycle, then
// the nearest of 1, 2, 4 and 8 on a log scale.
const manual = (k) => (k < 0.5 ? 0 : NS[cl(round(log(k) / log(2)), 0, 3)]);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 4);
  const letter = cl(round(k[2]), 0, 2);
  S.pk = cl(k[3], 0, 8);
  const g = (d * S.speed) / 2;
  S.t += d;
  S.lap += g;
  if (letter !== S.cur) {
    S.cur = letter;
    if (!S.cache[letter]) S.cache[letter] = build(letter, S.scratch);
    S.G = S.cache[letter];
    if (S.mode >= 0) S.fadeAt = S.t;
  }
  const want = manual(S.pk);
  if (want === 0) {
    // The automatic cycle: step i holds SEQ[i], the first MORPH of it spent
    // sliding there from the one before.
    if (S.mode !== 0) S.mode = 0;
    S.ct += g;
    let total = 0;
    for (const v of STAY) total += v + MORPH;
    const c = S.ct % total;
    let acc = 0;
    for (let i = 0; i < SEQ.length; i++) {
      const span = STAY[i] + MORPH;
      if (c < acc + span) {
        const u = (c - acc) / MORPH;
        S.to = SEQ[i];
        S.from = SEQ[(i + SEQ.length - 1) % SEQ.length];
        S.mp = cl(u, 0, 1);
        break;
      }
      acc += span;
    }
  } else {
    // A count held by hand: slide to it from where the cuts are now.
    if (S.mode !== want) {
      if (S.mode < 0) S.from = S.to = want;
      else if (S.mp > 0.5) S.from = S.to;
      S.to = want;
      S.mp = S.from === want ? 1 : 0;
      S.mode = want;
    }
    if (S.mp < 1) S.mp = min(1, S.mp + g / MORPH);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.G) return;
  const G = S.G, segs = G.segs, buf = S.buf;
  buf.fill(0);
  const e = sm5(S.mp), { from, to } = S;
  const settled = S.mp >= 1 || from === to;

  // The quadratic outline now: the counts' cuts, one chain per segment. While
  // the count changes both are cut into as many pieces as the larger, the
  // smaller one exactly, and the points slide from one to the other.
  const M = max(from, to);
  let Q;
  if (settled) Q = G.Q[to];
  else {
    Q = segs.map((s, i) => {
      if (s.line) return G.Q[to][i];
      const a = from < M ? split(G.Q[from][i], M / from) : G.Q[from][i], b = to < M ? split(G.Q[to][i], M / to) : G.Q[to][i], o = S.mix[i];
      for (let k = 0; k < a.length; k++) o[k] = a[k] + (b[k] - a[k]) * e;
      return o;
    });
  }
  let covQ;
  if (settled) covQ = G.cov[to];
  else {
    raster(S.scratch, edgesQuad(segs, Q, S.scratch), S.covQ);
    covQ = S.covQ;
  }
  const covC = G.covC, diff = S.diff, blur = S.blur;
  for (let p = 0; p < W * GH; p++) diff[p] = abs(covC[p] - covQ[p]);
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && xx < W && yy >= 0 && yy < GH) s += diff[yy * W + xx];
        }
      blur[y * W + x] = s / 9;
    }

  const fill = [0, 0, 0], line = [0, 0, 0], offc = [0, 0, 0], onc = [1, 1, 1], RED = [1, 0.1, 0.05];
  const h0 = 0.56 + S.hue;
  tint(h0, 0.8, 0.5, fill);
  tint(h0, 0.22, 1, line);
  tint(h0 + 0.57, 0.7, 1, offc);
  const tn = S.t - S.fadeAt, fade = sm5(tn / 0.3);
  const pulse = 0.78 + 0.22 * sin(S.t * 5);
  const mixTo = (o, c, a) => {
    for (let k = 0; k < 3; k++) buf[o + k] += (c[k] - buf[o + k]) * a;
  };
  for (const y0 of [TOP_Y, BOT_Y])
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < W; x++) {
        const p = y * W + x, o = ((y0 + y) * W + x) * 3, c = y0 === TOP_Y ? covC[p] : covQ[p];
        if (c > 0) mixTo(o, fill, min(1, c) * fade);
        const r = cl(diff[p] * 3, 0, 1) * 0.9 + blur[p] * 0.7;
        if (r > 0.01) mixTo(o, RED, min(1, r) * pulse * fade);
      }

  // Lines and points.
  const put = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    mixTo((y * W + x) * 3, c, min(1, a) * fade);
  };
  const seg = (x0, y0, x1, y1, c, a) => {
    const dx = x1 - x0, dy = y1 - y0;
    if (abs(dx) >= abs(dy)) {
      if (x0 > x1) return seg(x1, y1, x0, y0, c, a);
      const gr = dx === 0 ? 0 : dy / dx;
      for (let x = ceil(x0); x <= floor(x1); x++) {
        const y = y0 + gr * (x - x0), yi = floor(y), f = y - yi;
        put(x, yi, c, a * (1 - f));
        put(x, yi + 1, c, a * f);
      }
    } else {
      if (y0 > y1) return seg(x1, y1, x0, y0, c, a);
      const gr = dx / dy;
      for (let y = ceil(y0); y <= floor(y1); y++) {
        const x = x0 + gr * (y - y0), xi = floor(x), f = x - xi;
        put(xi, y, c, a * (1 - f));
        put(xi + 1, y, c, a * f);
      }
    }
  };
  const pt = [0, 0];
  // One curve (a cubic or a quadratic: n numbers from o in p), drawn as short lines.
  const trace = (k, y0, c, a) => {
    const f = k.n === 8 ? cub : quad, steps = k.line ? 1 : cl(ceil(k.len / 1.4), 3, 48);
    f(k.p, k.o, 0, pt);
    let px = pt[0], py = pt[1] + y0;
    for (let j = 1; j <= steps; j++) {
      f(k.p, k.o, j / steps, pt);
      seg(px, py, pt[0], pt[1] + y0, c, a);
      px = pt[0];
      py = pt[1] + y0;
    }
  };
  // A half: its outline, the handles from each end to its off-curve point,
  // the off-curve points as rings (a dot when they crowd) and the on-curve
  // points as squares (a dot when they crowd).
  const half = (list, y0, ring, crowd, handle) => {
    for (const k of list) {
      trace(k, y0, line, 0.95);
      if (k.line) continue;
      const p = k.p, o = k.o, e = o + k.n - 2, c2 = o + (k.n === 8 ? 4 : 2);
      seg(p[o], p[o + 1] + y0, p[o + 2], p[o + 3] + y0, offc, handle);
      seg(p[e], p[e + 1] + y0, p[c2], p[c2 + 1] + y0, offc, handle);
    }
    for (const k of list)
      if (!k.line)
        for (const d of k.n === 8 ? [2, 4] : [2]) {
          const x = floor(k.p[k.o + d]), y = floor(k.p[k.o + d + 1] + y0);
          if (ring) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) put(x + dx, y + dy, offc, 1);
          if (!ring) put(x, y, offc, crowd ? 0.6 : 1);
        }
    for (const k of list) {
      const x = floor(k.p[k.o]), y = floor(k.p[k.o + 1] + y0), r = crowd ? 0 : 1;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) put(x + dx, y + dy, onc, 1);
    }
  };
  const top = [], bot = [];
  segs.forEach((s, i) => {
    top.push({ p: s.p, o: 0, n: 8, line: s.line, len: s.len });
    const q = Q[i];
    for (let o = 0; o < q.length; o += 6) bot.push({ p: q, o, n: 6, line: s.line, len: s.len / (q.length / 6) });
  });
  half(top, TOP_Y, true, false, 0.5);
  for (const k of top) trace(k, BOT_Y, line, 0.28);
  half(bot, BOT_Y, M <= 2, M >= 8, M >= 8 ? 0.2 : 0.4);

  // A spark that walks the outline in both halves at once, the same place on
  // the cubic above and on the quadratics below.
  const lap = S.lap / 4.5, head = (lap - floor(lap)) * G.total;
  const where = (s0, top) => {
    let acc = 0;
    s0 = ((s0 % G.total) + G.total) % G.total;
    for (let i = 0; i < segs.length; i++) {
      if (s0 < acc + segs[i].len || i === segs.length - 1) {
        const t = cl((s0 - acc) / segs[i].len, 0, 1);
        if (top) cub(segs[i].p, 0, t, pt);
        else {
          const q = Q[i], n = q.length / 6, u = min(n - 1e-9, t * n), pi = floor(u);
          quad(q, pi * 6, u - pi, pt);
        }
        return;
      }
      acc += segs[i].len;
    }
  };
  for (const top of [true, false])
    for (let d = 0; d < 12; d += 0.6) {
      where(head - d, top);
      const a = 1 - d / 12;
      const x = pt[0], y = pt[1] + (top ? TOP_Y : BOT_Y);
      put(floor(x), floor(y), onc, a);
      if (d < 1.2) {
        put(floor(x) + 1, floor(y), onc, a * 0.6);
        put(floor(x) - 1, floor(y), onc, a * 0.6);
        put(floor(x), floor(y) + 1, onc, a * 0.6);
        put(floor(x), floor(y) - 1, onc, a * 0.6);
      }
    }

  // The place where the two outlines are furthest apart, ringed in both halves.
  const sh0 = settled ? G.err[to] : G.err[from] + (G.err[to] - G.err[from]) * e;
  const wa = G.at[from], wb = G.at[to], wxy = settled ? wb : [wa[0] + (wb[0] - wa[0]) * e, wa[1] + (wb[1] - wa[1]) * e];
  const ra = cl(sh0 / 0.6, 0, 1), rr = 3.6 + 1.1 * sin(S.t * 6);
  if (ra > 0.02)
    for (const y0 of [TOP_Y, BOT_Y])
      for (let k = 0; k < 16; k++) {
        const an = (k / 16) * 2 * PI;
        put(floor(wxy[0] + rr * cos(an)), floor(wxy[1] + y0 + rr * sin(an)), onc, 0.85 * ra);
      }

  // The band: how far the quadratic outline is from the cubic one for each
  // count (a bar on a log scale, the one now shown bright), the count under
  // it, and the number now.
  const word = (str, x, y, sc, c, a) => {
    for (const ch of str) {
      const gl = DIG[ch];
      for (let r = 0; r < 5; r++)
        for (let k = 0; k < gl[r].length; k++)
          if (gl[r][k]) for (let dy = 0; dy < sc; dy++) for (let dx = 0; dx < sc; dx++) put(x + k * sc + dx, y + r * sc + dy, c, a);
      x += (gl[0].length + 1) * sc;
    }
  };
  NS.forEach((n, i) => {
    const w = (n === to ? e : 0) + (n === from ? 1 - e : 0) + (settled && n === to ? 1 : 0);
    const err = G.err[n], h = cl(1 + (11 * log(max(err, 0.01) / 0.04)) / log(6.5 / 0.04), 1, 12), x = 4 + i * 8, base = 67;
    for (let y = 0; y < round(h); y++) for (let dx = 0; dx < 5; dx++) put(x + dx, base - y, RED, 0.28 + 0.72 * min(1, w));
    for (let dx = 0; dx < 5; dx++) put(x + dx, base - round(h), onc, 0.15 + 0.7 * min(1, w));
    word(String(n), x + 1, 69, 1, onc, 0.35 + 0.65 * min(1, w));
  });
  const txt = sh0.toFixed(1);
  let width = 0;
  for (const ch of txt) width += (DIG[ch][0].length + 1) * 2;
  word(txt, 62 - width + 2, 58, 2, RED, 1);
  word("3", 60, 4, 1, onc, 0.55);
  word("2", 60, BOT_Y + 1, 1, onc, 0.55);

  for (let p = 0; p < W * H; p++) display.setPixel(p % W, (p / W) | 0, (255 * cl(buf[p * 3], 0, 1)) | 0, (255 * cl(buf[p * 3 + 1], 0, 1)) | 0, (255 * cl(buf[p * 3 + 2], 0, 1)) | 0);
}
