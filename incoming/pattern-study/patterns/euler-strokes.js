// ===== Patternflow pattern =====
// Title:   Euler Strokes
// Family:  type
// Idea:    A pen writes a word stacked down the panel letter by letter, each letter a graph of stroke ends, corners and junctions, in exactly as many strokes as Euler's count of its odd vertices allows, following a Hierholzer route: the unwritten skeleton is faintly tinted with the stroke each piece will belong to, the odd vertices glow before the pen reaches them, each pen lift leaves a faint dashed trail, and beside each letter a digit and a row of pips keep its stroke count.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the seven bridges of Königsberg and the odd-vertex count (Leonhard Euler, Solutio problematis ad geometriam situs pertinentis, 1736), the construction of an Euler path (Carl Hierholzer, 1873), one-stroke drawing (한붓그리기), pattern round 75
// Round:   75
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..3, Order=0..1
//
// Knob 1: Hue. Turns every colour together. At 0 the first stroke of a letter is cyan, the second magenta, the third gold, the fourth green; the marks where strokes start and end are warm white on odd vertices and rose on even ones, and fresh ink is white hot for about 0.7 s.
// Knob 2: Speed. At 2 the pen writes 34 LEDs a second, travels with the pen up at 90 and rests 0.12 s on each touch and lift. PATH takes 10.5 to 10.8 s in the Euler order and 12.6 s in school order, then holds for 1.8 s and fades for 0.9 s before it is written again. At 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Word. PATH (1, 2, 2 and 3 strokes), 다리 (bridge: 3 and 2), EULER (2, 1, 1, 2, 1) or 한붓 (one brush: 6 and 6), the counts in the Euler order. Each letter is a vertex and edge list in the code; the word stacks one letter per cell down the 128 rows.
// Knob 4: Order. Below 0.5 the pen takes the fewest strokes, max(1, odd/2) for each connected piece, on a Hierholzer route that pairs the spare odd vertices with short pen-up hops, and each pass picks a new route of the same count (H has 11, 붓 32 seen in 3000 passes). Above 0.5 it follows school stroke order instead (ball and stick print for the Latin letters, 필순 for Hangul), and the counts grow: PATH 10 against 8, 다리 8 against 5, EULER 12 against 7, 한붓 14 against 12. A ring stays where each stroke touched down or lifted. Rose rings sit on even vertices: in the Euler order only a closed piece (the ring of ㅎ) touches one, in school order P, A, E, ㄷ, ㄹ and ㅂ do too.

const W = 64, H = 128, NP = W * H;
const { floor, round, min, max, sqrt, sin, cos, exp, abs, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Letters as graphs. v is the vertex list (x, y pairs, y down) in a box
// 10 by 14 for a Latin capital and 14 by 14 for a Hangul syllable. An edge is
// [a, b] or [a, b, points between]; c is the school stroke order, each stroke
// a list of edges, ~i for edge i run from b to a.
const arc = (cx, cy, rx, ry, a0, a1, n) => {
  const o = [];
  for (let i = 1; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    o.push(cx + rx * cos(a), cy + ry * sin(a));
  }
  return o;
};
const bowl = () => [5.5, 0, ...arc(5.5, 3.75, 4, 3.75, -PI / 2, PI / 2, 10), 5.5, 7.5];
const GLYPHS = {
  // P: the stem's top has degree 2, the joint 3, the foot 1. One stroke.
  P: { v: [1.5, 0, 1.5, 7.5, 1.5, 14], e: [[0, 1], [1, 2], [0, 1, bowl()]], c: [[0, 1], [2]] },
  // A: apex 2, feet 1, the crossbar's ends 3. Two strokes.
  A: { v: [5, 0, 0.5, 14, 9.5, 14, 2.11, 9, 7.89, 9], e: [[0, 3], [3, 1], [0, 4], [4, 2], [3, 4]], c: [[0, 1], [2, 3], [4]] },
  // T: three ends and a junction of 3. Two strokes.
  T: { v: [0.5, 0, 5, 0, 9.5, 0, 5, 14], e: [[0, 1], [1, 2], [1, 3]], c: [[2], [0, 1]] },
  // H: four ends and two junctions, six odd vertices. Three strokes.
  H: { v: [1, 0, 1, 7, 1, 14, 9, 0, 9, 7, 9, 14], e: [[0, 1], [1, 2], [3, 4], [4, 5], [1, 4]], c: [[0, 1], [2, 3], [4]] },
  // E: three bar ends and the middle junction are odd, the corners even. Two strokes.
  E: { v: [9, 0, 1, 0, 1, 7, 8, 7, 1, 14, 9, 14], e: [[1, 0], [1, 2], [2, 4], [2, 3], [4, 5]], c: [[1, 2], [0], [3], [4]] },
  U: { v: [1, 0, 9, 0], e: [[0, 1, [1, 9.5, ...arc(5, 9.5, 4, 4.5, PI, 0, 12), 9, 9.5]]], c: [[0]] },
  L: { v: [1.5, 0, 1.5, 14, 9, 14], e: [[0, 1], [1, 2]], c: [[0, 1]] },
  // R: the leg leaves from the joint, which takes degree 4. One stroke.
  R: { v: [1.5, 0, 1.5, 7.5, 1.5, 14, 9.5, 14], e: [[0, 1], [1, 2], [0, 1, bowl()], [1, 3]], c: [[0, 1], [2, 3]] },
  // 다: ㄷ is an open path (1), ㅏ a stem with a branch (2).
  다: {
    v: [7.2, 2.2, 1, 2.2, 1, 11.8, 7.6, 11.8, 10.4, 0, 10.4, 7, 10.4, 14, 13.4, 7],
    e: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [5, 7]],
    c: [[~0], [1, 2], [3, 4], [5]],
  },
  // 리: ㄹ is one zigzag (1, written as 3), ㅣ a line (1).
  리: {
    v: [1, 1.2, 7.4, 1.2, 7.4, 7, 1, 7, 1, 12.8, 7.8, 12.8, 11, 0, 11, 14],
    e: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [6, 7]],
    c: [[0, 1], [~2], [3, 4], [5]],
  },
  // 한: ㅎ is three pieces (tick, bar, ring), ㅏ two strokes, ㄴ one.
  한: {
    v: [4.3, 0.2, 4.3, 1.5, 1, 2.4, 7.6, 2.4, 4.3, 3.5, 4.3, 8.1, 10.6, 0, 10.6, 4.6, 10.6, 9.2, 13.4, 4.6, 1.6, 10.2, 1.6, 13.6, 13, 13.6],
    e: [[0, 1], [2, 3], [4, 5, arc(4.3, 5.8, 2.6, 2.3, -PI / 2, -1.5 * PI, 10)], [5, 4, arc(4.3, 5.8, 2.6, 2.3, PI / 2, -PI / 2, 10)], [6, 7], [7, 8], [7, 9], [10, 11], [11, 12]],
    c: [[0], [1], [2, 3], [4, 5], [6], [7, 8]],
  },
  // 붓: ㅂ has four odd vertices (2, written as 4), ㅜ 2, ㅅ 2.
  붓: {
    v: [2.5, 0.3, 2.5, 2.7, 2.5, 5.2, 11.5, 0.3, 11.5, 2.7, 11.5, 5.2, 0.5, 7.2, 7, 7.2, 13.5, 7.2, 7, 9.6, 7, 10.3, 2.6, 13.8, 5.4, 11.57, 11.4, 13.8],
    e: [[0, 1], [1, 2], [3, 4], [4, 5], [1, 4], [2, 5], [6, 7], [7, 8], [7, 9], [10, 12], [12, 11], [12, 13]],
    c: [[0, 1], [2, 3], [4], [5], [6, 7], [8], [9, 10], [11]],
  },
};
const WORDS = [["P", "A", "T", "H"], ["다", "리"], ["E", "U", "L", "E", "R"], ["한", "붓"]];
const STROKE_HUE = [0, 0.36, 0.62, 0.8, 0.2, 0.5, 0.27, 0.9];

// 3 by 5 digits for the counts.
const DIGITS = [0x7b6f, 0x2c97, 0x73e7, 0x73cf, 0x5bc9, 0x79cf, 0x79ef, 0x7292, 0x7bef, 0x7bcf];

// Pen speeds in LEDs per second and rests in seconds, at Speed 2.
const V_DOWN = 34, V_UP = 90, REST = 0.12, HOLD = 1.8, FADE = 0.9;

// ---- Euler's count and Hierholzer's route. Each connected piece with 2k odd
// vertices is drawn in k strokes: k - 1 pen-up hops pair off all but two odd
// vertices, the walk starts at one of those two, and Hierholzer's splice
// finds a walk that uses every edge once. The hops are where it lifts.
function* matchings(a) {
  if (!a.length) {
    yield [];
    return;
  }
  const [x, ...rest] = a;
  for (let i = 0; i < rest.length; i++) {
    const y = rest[i], others = rest.filter((_, j) => j !== i);
    for (const m of matchings(others)) yield [[x, y], ...m];
  }
}

function eulerOrder(g) {
  const nv = g.v.length / 2, deg = new Array(nv).fill(0), par = [...Array(nv).keys()];
  const find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
  for (const [a, b] of g.e) {
    deg[a]++;
    deg[b]++;
    par[find(a)] = find(b);
  }
  const key = (i) => g.v[2 * i + 1] + 0.6 * g.v[2 * i];
  const dist = (a, b) => hypot(g.v[2 * a] - g.v[2 * b], g.v[2 * a + 1] - g.v[2 * b + 1]);
  const comps = new Map();
  for (let i = 0; i < nv; i++) if (deg[i]) (comps.get(find(i)) || comps.set(find(i), []).get(find(i))).push(i);
  const list = [...comps.values()].sort((A, B) => min(...A.map(key)) - min(...B.map(key)));
  const strokes = [];
  for (const C of list) {
    const odd = C.filter((i) => deg[i] & 1);
    let s = C.reduce((a, b) => (key(a) <= key(b) ? a : b)), hops = [];
    if (odd.length) {
      let best = Infinity;
      for (const si of odd)
        for (const ti of odd) {
          if (si === ti) continue;
          for (const m of matchings(odd.filter((x) => x !== si && x !== ti))) {
            let c = 0.15 * key(si) + 0.8 * Math.random();
            for (const [a, b] of m) c += dist(a, b);
            if (c < best) (best = c), (s = si), (hops = m);
          }
        }
    }
    // The piece's edges and the hops, with each vertex's list shuffled so
    // each pass can take another route of the same count.
    const ids = [], ends = [];
    g.e.forEach((e, i) => {
      if (find(e[0]) === find(C[0])) ids.push(i), ends.push([e[0], e[1]]);
    });
    for (const [a, b] of hops) ids.push(-1), ends.push([a, b]);
    const adj = new Map();
    ends.forEach(([a, b], j) => {
      for (const x of [a, b]) (adj.get(x) || adj.set(x, []).get(x)).push(j);
    });
    for (const l of adj.values())
      for (let i = l.length - 1; i > 0; i--) {
        const j = floor(Math.random() * (i + 1));
        [l[i], l[j]] = [l[j], l[i]];
      }
    const used = new Uint8Array(ends.length), ptr = new Map(), stack = [[s, -1]], walk = [];
    while (stack.length) {
      const [v, j] = stack[stack.length - 1], l = adj.get(v) || [];
      let p = ptr.get(v) || 0, moved = false;
      while (p < l.length) {
        const jj = l[p++];
        if (used[jj]) continue;
        used[jj] = 1;
        stack.push([ends[jj][0] === v ? ends[jj][1] : ends[jj][0], jj]);
        moved = true;
        break;
      }
      ptr.set(v, p);
      if (!moved) {
        stack.pop();
        if (j >= 0) walk.push([j, v]);
      }
    }
    walk.reverse();
    let at = s, cur = [];
    for (const [j, to] of walk) {
      if (ids[j] < 0) {
        if (cur.length) strokes.push(cur);
        cur = [];
      } else cur.push(ends[j][0] === at && ends[j][1] === to ? ids[j] : ~ids[j]);
      at = to;
    }
    if (cur.length) strokes.push(cur);
  }
  return strokes;
}

// ---- Layout: one letter per cell down the panel, its count beside it.
function layout(S) {
  const word = WORDS[S.word], n = word.length, ch = H / n, hangul = word[0].charCodeAt(0) > 255;
  const bw = hangul ? 14 : 10, bh = 14, CWID = 15, GAP = 5;
  // Latin capitals may stretch up to 1.4 times wider than tall.
  const sy = min((W - 4 - CWID - GAP) / bw, (ch - (n > 3 ? 7 : 10)) / bh), sx = min((W - 4 - CWID - GAP) / bw, sy * (hangul ? 1 : 1.4));
  const gw = bw * sx, x0 = (W - gw - GAP - CWID) / 2;
  S.r = 0.85 + 0.28 * sy;
  S.glyphs = word.map((name, gi) => {
    const g = GLYPHS[name], y0 = gi * ch + (ch - bh * sy) / 2;
    const P = (x, y) => [x0 + x * sx, y0 + y * sy];
    const vx = [], deg = new Array(g.v.length / 2).fill(0);
    for (let i = 0; i < g.v.length; i += 2) vx.push(P(g.v[i], g.v[i + 1]));
    const edges = g.e.map(([a, b, mid]) => {
      const pts = [...vx[a]];
      for (let i = 0; mid && i < mid.length; i += 2) pts.push(...P(mid[i], mid[i + 1]));
      pts.push(...vx[b]);
      deg[a]++;
      deg[b]++;
      return pts;
    });
    return { g, vx, edges, deg, cx: x0 + gw + GAP, cy: gi * ch + ch / 2 };
  });
}

function strokePts(G, refs) {
  const out = [];
  for (const ref of refs) {
    const id = ref >= 0 ? ref : ~ref, e = G.edges[id], n = e.length / 2;
    for (let i = 0; i < n; i++) {
      const k = ref >= 0 ? i : n - 1 - i;
      if (out.length && i === 0) continue;
      out.push(e[2 * k], e[2 * k + 1]);
    }
  }
  return out;
}

// Which vertex a stroke starts or ends on.
function vertexAt(G, x, y) {
  let best = -1, bd = 0.5;
  G.vx.forEach(([vx, vy], i) => {
    const d = hypot(vx - x, vy - y);
    if (d < bd) (bd = d), (best = i);
  });
  return best;
}

function track(pts) {
  const cum = [0];
  for (let i = 2; i < pts.length; i += 2) cum.push(cum[cum.length - 1] + hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]));
  return { pts, cum, len: cum[cum.length - 1] };
}

function newPass(S) {
  S.moves = [];
  S.counts = [];
  S.marks = [];
  S.ghost.fill(0);
  let px = null, py = null;
  S.glyphs.forEach((G, gi) => {
    const strokes = S.mode ? G.g.c : eulerOrder(G.g);
    S.counts[gi] = strokes.length;
    S.marks[gi] = new Set();
    strokes.forEach((refs, k) => {
      const pts = strokePts(G, refs), n = pts.length;
      if (px !== null) S.moves.push({ up: true, gi, ...track([px, py, pts[0], pts[1]]) });
      const sv = vertexAt(G, pts[0], pts[1]), ev = vertexAt(G, pts[n - 2], pts[n - 1]);
      S.moves.push({ up: false, gi, k, sv, ev, ...track(pts) });
      // The unwritten skeleton, faintly tinted with the stroke each piece
      // will belong to, so the route shows before the pen takes it.
      for (let i = 2; i < n; i += 2) capsule(S.ghost, null, pts[i - 2], pts[i - 1], pts[i], pts[i + 1], S.r, 1, 0, S.gk, k);
      S.marks[gi].add(sv).add(ev);
      px = pts[n - 2];
      py = pts[n - 1];
    });
  });
  S.mi = 0;
  S.u = 0;
  S.done = 0;
  S.hold = -1;
  S.ink.fill(0);
  S.hot.fill(0);
  S.touched = S.glyphs.map((G) => new Float32Array(G.vx.length).fill(-1));
  S.lit = S.glyphs.map(() => []);
  S.pen = [S.moves[0].pts[0], S.moves[0].pts[1], false];
  S.started = -1;
}

const dur = (m) => (m.up ? m.len / V_UP : REST + m.len / V_DOWN + REST);

function posAt(m, s) {
  const { pts, cum } = m;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const u = cum[i] > cum[i - 1] ? cl((s - cum[i - 1]) / (cum[i] - cum[i - 1]), 0, 1) : 1;
  return [pts[2 * i - 2] + (pts[2 * i] - pts[2 * i - 2]) * u, pts[2 * i - 1] + (pts[2 * i + 1] - pts[2 * i - 1]) * u];
}

// Ink the move from arc length a to b: a capsule per piece for strokes, faint
// dashes for pen-up hops.
function inkSpan(S, m, a, b) {
  if (b <= a) return;
  if (m.up) {
    // Dashes two LEDs long with two LEDs between them.
    for (let s = floor(a) + 1; s <= b; s++) {
      const [x, y] = posAt(m, s);
      if (s > 2 && s < m.len - 2 && s % 4 < 2) capsule(S.ink, [0.3, 0.31, 0.36], x, y, x, y, 0.5, 1, 0);
    }
    return;
  }
  const col = S.strokeCol[m.k % 8];
  const { pts, cum } = m;
  for (let i = 1; i < cum.length; i++) {
    const s0 = max(a, cum[i - 1]), s1 = min(b, cum[i]);
    if (s1 < s0 || cum[i] <= cum[i - 1]) continue;
    const [x0, y0] = posAt(m, s0), [x1, y1] = posAt(m, s1);
    capsule(S.ink, col, x0, y0, x1, y1, S.r, 1, 0.42);
    capsule(S.hot, null, x0, y0, x1, y1, S.r, 1, 0.6);
  }
}

// A round-ended segment: a solid core of radius r and a soft glow around it.
// With col null it writes one channel (the ghost, with the stroke index in
// kb, or the hot ink).
function capsule(buf, col, ax, ay, bx, by, r, a, glow, kb, kv) {
  const R = r + (glow ? 5 : 1), dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  for (let y = max(0, floor(min(ay, by) - R)); y <= min(H - 1, floor(max(ay, by) + R)); y++)
    for (let x = max(0, floor(min(ax, bx) - R)); x <= min(W - 1, floor(max(ax, bx) + R)); x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay, t = L2 > 0 ? cl((px * dx + py * dy) / L2, 0, 1) : 0;
      const d = hypot(px - t * dx, py - t * dy), core = cl(r + 0.5 - d, 0, 1), e = max(0, d - r);
      const v = a * max(core, glow * exp(-e * e * 0.16));
      if (v <= 0.004) continue;
      const p = y * W + x;
      if (!col) {
        if (v > buf[p]) (buf[p] = v), kb && (kb[p] = kv);
      } else for (let c = 0; c < 3; c++) buf[3 * p + c] = max(buf[3 * p + c], col[c] * v * (core > 0.5 ? 1 : 0.85));
    }
}

export function setup(params) {
  params.s = { word: -1, mode: 0, hue: -1, t: 0, ink: new Float32Array(NP * 3), ghost: new Float32Array(NP), gk: new Uint8Array(NP), hot: new Float32Array(NP), rgb: new Float32Array(NP * 3), strokeCol: [] };
}

function touch(S, gi, v) {
  if (v >= 0 && S.touched[gi][v] < 0) S.touched[gi][v] = S.t;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (k[0] !== S.hue) {
    S.hue = k[0];
    S.strokeCol = STROKE_HUE.map((h) => hsv(0.5 + S.hue + h, 0.58, 1));
  }
  const word = cl(round(k[2]), 0, 3), mode = k[3] >= 0.5 ? 1 : 0;
  if (word !== S.word || mode !== S.mode) {
    const relayout = word !== S.word;
    S.word = word;
    S.mode = mode;
    if (relayout) layout(S);
    newPass(S);
  }
  const step = (d * cl(k[1], 0.2, 3)) / 2, cool = exp(-d * 1.4);
  S.t += step;
  // Fresh ink is white hot and cools to its colour in about 0.7 s of real
  // time, so a faster pen drags a longer hot tail.
  for (let p = 0; p < NP; p++) S.hot[p] *= cool;
  if (S.hold >= 0) {
    S.hold += step;
    if (S.hold > HOLD + FADE) newPass(S);
    return;
  }
  S.u += step;
  for (let guard = 0; guard < 64 && S.mi < S.moves.length; guard++) {
    const m = S.moves[S.mi];
    if (!m.up && S.started !== S.mi) {
      S.started = S.mi;
      touch(S, m.gi, m.sv);
      S.lit[m.gi][m.k] = 1;
    }
    const T = dur(m), s = m.up ? S.u * V_UP : cl((S.u - REST) * V_DOWN, 0, m.len);
    inkSpan(S, m, S.done, min(s, m.len));
    S.done = max(S.done, min(s, m.len));
    const [x, y] = posAt(m, S.done);
    S.pen = [x, y, !m.up];
    if (S.u < T) break;
    if (!m.up) touch(S, m.gi, m.ev);
    S.u -= T;
    S.done = 0;
    S.mi++;
  }
  if (S.mi >= S.moves.length) S.hold = 0;
}

// Soft disc or ring added on top of the frame.
function spot(rgb, x, y, r, col, a, ring) {
  const R = r + 2;
  for (let j = max(0, floor(y - R)); j <= min(H - 1, floor(y + R)); j++)
    for (let i = max(0, floor(x - R)); i <= min(W - 1, floor(x + R)); i++) {
      const dd = hypot(i + 0.5 - x, j + 0.5 - y);
      const v = a * (ring ? cl(1 - abs(dd - r) / 0.8, 0, 1) : cl(r + 0.5 - dd, 0, 1) + 0.35 * exp(-max(0, dd - r) * 0.9) * (dd > r ? 1 : 0));
      if (v <= 0) continue;
      const o = 3 * (j * W + i);
      for (let c = 0; c < 3; c++) rgb[o + c] = max(rgb[o + c], col[c] * v);
    }
}

function digit(rgb, n, x, y, col, z) {
  const bits = DIGITS[n % 10];
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 3; c++)
      if ((bits >> (14 - r * 3 - c)) & 1)
        for (let j = 0; j < z; j++)
          for (let i = 0; i < z; i++) {
            const X = round(x) + c * z + i, Y = round(y) + r * z + j;
            if (X >= 0 && X < W && Y >= 0 && Y < H) for (let q = 0; q < 3; q++) rgb[3 * (Y * W + X) + q] = col[q];
          }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.glyphs) return;
  const { rgb, ink, ghost, gk, hot, strokeCol } = S;
  const fade = S.hold > HOLD ? cl((S.hold - HOLD) / FADE, 0, 1) : 0, keep = 1 - fade;
  const bg = hsv(0.62 + S.hue, 0.6, 0.035), gc = hsv(0.6 + S.hue, 0.25, 0.2);
  for (let p = 0; p < NP; p++) {
    const g = ghost[p], o = 3 * p, sc = strokeCol[gk[p] % 8];
    for (let c = 0; c < 3; c++) rgb[o + c] = max(bg[c] + g * (0.4 * gc[c] + 0.28 * sc[c]), ink[o + c] * keep) + 0.6 * hot[p];
  }
  const warm = hsv(0.12 + S.hue, 0.25, 1), rose = hsv(0.97 + S.hue, 0.5, 1), pale = hsv(0.6 + S.hue, 0.12, 0.85), pulse = 0.5 + 0.5 * sin(TAU * 1.3 * S.t);
  const next = S.moves[S.mi];
  S.glyphs.forEach((G, gi) => {
    // The vertices where the plan's strokes start or end glow until the pen
    // touches them, then keep a ring: warm on an odd vertex, rose on an even
    // one. In the Euler order every mark but one per closed piece is odd.
    for (const v of S.marks[gi]) {
      const [x, y] = G.vx[v], col = G.deg[v] & 1 ? warm : rose;
      if (S.touched[gi][v] >= 0) {
        spot(rgb, x, y, 2.4, col, 0.6 * keep * min(1, (S.t - S.touched[gi][v]) * 4 + 0.2), true);
        continue;
      }
      const after = next && next.up ? S.moves[S.mi + 1] : next, soon = after && !after.up && after.gi === gi && after.sv === v ? 1 : 0;
      spot(rgb, x, y, 2.2, col, (0.4 + 0.35 * pulse + 0.35 * soon) * keep + 0.2 * fade);
    }
    // The count: a digit and a pip for each stroke, lit as the stroke starts.
    const z = H / S.glyphs.length >= 30 ? 3 : 2, n = S.counts[gi], cols = min(4, n), rows = Math.ceil(n / 4), top = G.cy - (5 * z + 3 + rows * 4 - 1) / 2;
    digit(rgb, n, G.cx + 7.5 - 1.5 * z, top, S.mode ? rose : pale, z);
    for (let q = 0; q < n; q++) {
      const px = G.cx + (q % 4) * 4 + (4 - cols) * 2, py = top + 5 * z + 3 + floor(q / 4) * 4, on = S.lit[gi][q] && keep > 0;
      const col = on ? S.strokeCol[q % 8] : gc;
      for (let j = 0; j < 3; j++)
        for (let i = 0; i < 3; i++) {
          const X = round(px) + i, Y = round(py) + j;
          if (X < W && Y < H) for (let c = 0; c < 3; c++) rgb[3 * (Y * W + X) + c] = col[c] * (on ? keep : 0.9);
        }
    }
  });
  if (S.hold < 0) {
    const [x, y, down] = S.pen, m = S.moves[S.mi], lc = down && m ? S.strokeCol[m.k % 8] : pale;
    // The pen tip lights the paper round it in the colour it writes.
    for (let j = max(0, floor(y - 22)); j <= min(H - 1, floor(y + 22)); j++)
      for (let i = 0; i < W; i++) {
        const dx = i + 0.5 - x, dy = j + 0.5 - y, v = 0.2 * exp(-(dx * dx + dy * dy) / 130);
        if (v < 0.01) continue;
        const o = 3 * (j * W + i);
        for (let c = 0; c < 3; c++) rgb[o + c] += lc[c] * v;
      }
    spot(rgb, x, y, down ? 1.2 : 1.7, [1, 1, 1], down ? 1 : 0.8, !down);
  }
  for (let p = 0; p < NP; p++) display.setPixel(p % W, floor(p / W), min(255, rgb[3 * p] * 255) | 0, min(255, rgb[3 * p + 1] * 255) | 0, min(255, rgb[3 * p + 2] * 255) | 0);
}
