// ===== Patternflow pattern =====
// Title:   Location Arithmetic
// Family:  type
// Idea:    Numbers are multiplied and added on Napier's chessboard the way his location arithmetic works, every letter a power of two: the two factors light their letters along the bottom and right margins, a counter drops onto every square where a lit column meets a lit row, the counters slide down and to the left along their diagonals to the bottom row without changing their value, and then two counters on one square are taken off and one is put on the square to its left, again and again, while the ledger under the board reads the bottom row in Napier's letters, the extended numeral abcddeegh shrinking into abcefgh, and the board's total in decimal climbs to 247 as the counters go on and then holds through every slide and every pair.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: location arithmetic (arithmetica localis), counters on a chessboard and numbers written as letters a = 1, b = 2, c = 4 and so on, in John Napier's Rabdologiae (Edinburgh, 1617); lowercase letters 5 by 7 and digits 3 by 5 drawn for this pattern; pattern round 103
// Round:   103
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Problem=0..5, Board=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the counters and the answer's letters are gold, the first number's letters pink and the second's aqua, on a slate blue checkerboard; at 0.5 the counters are blue, the first number green and the second red, on a brown board.
// Knob 2: Speed. At 2 the letters of each number light 0.22 s apart, a row of counters drops every 0.4 s, the counters slide a square in 0.2 s, each two-into-one takes 0.5 s, and the answer stands 2.6 s before it fades in 0.5 s: 19 x 13 takes 8.6 s, 87 + 45 takes 9.8 s and 5 x 45, the longest, 10.4 s. Every time goes as 2 / Speed, and each problem is followed by the next.
// Knob 3: Problem. Six problems for each board, and turning it starts the one it points at from the top. On the 8 by 8 chessboard 0 is 19 x 13 = 247, abe x acd, nine counters that land as abcddeegh and need two pairs taken up; 1 is 87 + 45 = 132, abceg + acdf, seven pairs one after another until only c and h are left; 2 is 5 x 45 = 225, ac x acdf, with counters sliding down from row f; 3 is 13 x 13 = 169, acd x acd, five pairs; 4 is 3 x 85 = 255, ab x aceg, whose counters slide from as high as row g and land on eight different squares, nothing to take up; 5 is 63 + 1 = 64, where one more counter on a starts a run of six pairs that ends on g. The smaller boards have their own six, from 11 x 11 = 121 on the 7 board to 3 x 5 = 15 on the 4.
// Knob 4: Board. The squares a side, 8 - round(4 x Board), and the board's own problems. From 0 to 0.12, and so at the opening 0.06, it is Napier's chessboard of 8 by 8 squares of 7 LEDs, numbers up to 255 in the letters a to h; 7 at 0.25 with 8-LED squares, up to 127; 6 at 0.5 with 9-LED squares, up to 63; 5 at 0.75 with 11-LED squares, up to 31; 4 at 1 with 14-LED squares, up to 15, where 3 x 5 = 15 is ab x ac = abcd.

// Napier's Rabdologiae (1617) ends with a book on a third way to reckon,
// arithmetica localis. Numbers are written with letters, each worth twice
// the one before, a = 1, b = 2, c = 4, d = 8 and so on, and a number is the
// sum of its letters, so 87 is abceg. A letter may be written more than
// once; Napier's abbreviation replaces two of a letter by one of the next,
// aa by b, bb by c, until no letter repeats, and that form is unique: it is
// the number in binary, 86 years before Leibniz wrote binary out (1703).
// Adding is putting the letters together and abbreviating.
//
// The board is a chessboard whose squares double along each edge: column i
// from the right is worth 2^i, row j from the bottom 2^j, and the square
// where they meet 2^(i + j). Squares on one diagonal from lower left to
// upper right share a value, so a counter can slide along it like a bishop
// without changing the number on the board. To multiply, one factor's
// letters are marked along the bottom and the other's up the right side,
// and a counter goes on every square where a marked column meets a marked
// row: 2^i 2^j for every pair of letters, which is the product spread out.
// Here every counter then slides down and to the left to the bottom row,
// where a counter on the square of letter k is worth 2^k, so the bottom
// row read as letters is the product in extended form; the pairs are then
// taken up from the right, two counters off a square and one on the square
// to its left, and what stays is the product in Napier's letters.
//
// setup() plays every problem on its board, with no clock, and keeps only
// those whose last bottom row has at most one counter a square and spells
// exactly the letters of the ordinary product or sum. The decimal under the
// ledger is worked from the counters on the board each frame: it climbs as
// the counters go on and then holds through every slide and every pair,
// which is the reason the board works.

const W = 64, H = 128;
const { floor, round, min, max, sqrt } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// Lowercase a to h, 5 wide and 7 tall: row 0 the ascender, 1 to 5 the
// x-height, 5 and 6 the descender of g; and the two signs.
const GLYPH = {
  a: ["", ".###.", "....#", ".####", "#...#", ".####"],
  b: ["#....", "####.", "#...#", "#...#", "#...#", "####."],
  c: ["", ".####", "#....", "#....", "#....", ".####"],
  d: ["....#", ".####", "#...#", "#...#", "#...#", ".####"],
  e: ["", ".###.", "#...#", "#####", "#....", ".####"],
  f: ["..###", ".#...", "####.", ".#...", ".#...", ".#..."],
  g: ["", ".####", "#...#", "#...#", ".####", "....#", ".###."],
  h: ["#....", "####.", "#...#", "#...#", "#...#", "#...#"],
  x: ["", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  "+": ["", "..#..", "..#..", "#####", "..#..", "..#.."],
};
const LET = "abcdefgh";
// Digits and signs, 3 by 5.
const DIG = {
  0: ["###", "#.#", "#.#", "#.#", "###"], 1: [".#.", "##.", ".#.", ".#.", "###"], 2: ["###", "..#", "###", "#..", "###"],
  3: ["###", "..#", ".##", "..#", "###"], 4: ["#.#", "#.#", "###", "..#", "..#"], 5: ["###", "#..", "###", "..#", "###"],
  6: ["###", "#..", "###", "#.#", "###"], 7: ["###", "..#", "..#", ".#.", ".#."], 8: ["###", "#.#", "###", "#.#", "###"],
  9: ["###", "#.#", "###", "..#", "###"], x: ["", "#.#", ".#.", "#.#", ""], "+": ["", ".#.", "###", ".#.", ""], "=": ["", "###", "", "###", ""],
};

// Six problems for each board, 8 squares a side down to 4.
const PROBLEMS = {
  8: [["x", 19, 13], ["+", 87, 45], ["x", 5, 45], ["x", 13, 13], ["x", 3, 85], ["+", 63, 1]],
  7: [["x", 11, 11], ["+", 45, 27], ["x", 9, 13], ["x", 7, 7], ["x", 3, 21], ["+", 31, 1]],
  6: [["x", 7, 9], ["+", 21, 21], ["x", 5, 11], ["x", 3, 13], ["x", 6, 6], ["+", 15, 1]],
  5: [["x", 5, 5], ["+", 13, 7], ["x", 3, 7], ["x", 3, 9], ["x", 2, 13], ["+", 15, 15]],
  4: [["x", 3, 5], ["+", 7, 1], ["x", 3, 3], ["x", 2, 7], ["+", 5, 6], ["x", 3, 4]],
};

// Where the board, its margins and the ledger sit: squares of S LEDs,
// the board's right edge at column 56 and its top at row 2.
function geometry(N) {
  const S = floor(56 / N), bx = 57 - N * S, by = 2;
  return { N, S, bx, by, lbl: by + N * S + 1, rx: 58, sqX: (i) => bx + (N - 1 - i) * S, sqY: (j) => by + (N - 1 - j) * S };
}
const L1 = 72, L2 = 84, RULE = 96, L3 = 100, L4 = 114, TX = 10;

const bitsOf = (n) => [0, 1, 2, 3, 4, 5, 6, 7].filter((k) => (n >> k) & 1);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// A counter's track: keys {t, i, j, v}, where it is at time t and the
// power of two it is worth from then on.
function at(c, t) {
  const k = c.keys;
  if (t <= k[0].t) return { i: k[0].i, j: k[0].j, v: k[0].v, moving: false };
  for (let n = 1; n < k.length; n++) {
    if (t < k[n].t) {
      const a = k[n - 1], b = k[n], u = ease((t - a.t) / (b.t - a.t));
      return { i: a.i + (b.i - a.i) * u, j: a.j + (b.j - a.j) * u, v: a.v, moving: a.i !== b.i || a.j !== b.j };
    }
  }
  const z = k[k.length - 1];
  return { i: z.i, j: z.j, v: z.v, moving: false };
}

// The whole problem as times in story seconds, a story second being a
// second at Speed 2.
function plan(N, pr) {
  const [op, a, b] = pr, A = bitsOf(a), B = bitsOf(b), C = [];
  const marksA = [], marksB = [];
  let t = 0.2;
  A.forEach((i, k) => marksA.push({ k: i, t: t + 0.22 * k }));
  t += 0.22 * A.length + 0.2;
  B.forEach((j, k) => marksB.push({ k: j, t: t + 0.22 * k }));
  t += 0.22 * B.length + 0.2;
  let fit = A.every((i) => i < N) && B.every((j) => j < N), tAb;
  if (op === "x") {
    // A counter on every square where a marked column meets a marked row,
    // a row at a time from the bottom.
    B.forEach((j, r) => {
      for (const i of A) C.push({ born: t + 0.4 * r, die: 1e9, fuse: -1, keys: [{ t: t + 0.4 * r, i, j, v: i + j }] });
    });
    // Then all slide together, a square in 0.2 s, to the bottom row.
    const tS = t + 0.4 * B.length + 0.25;
    let end = tS;
    for (const c of C) {
      const { i, j } = c.keys[0];
      if (i + j >= N) fit = false;
      if (j === 0) continue;
      c.keys.push({ t: tS, i, j, v: i + j }, { t: tS + 0.2 * j, i: i + j, j: 0, v: i + j });
      end = max(end, tS + 0.2 * j);
    }
    tAb = end + 0.35;
  } else {
    // Both numbers go on the bottom row, rising out of the margin.
    for (const m of [...marksA, ...marksB]) C.push({ born: m.t + 0.1, die: 1e9, fuse: -1, keys: [{ t: m.t + 0.1, i: m.k, j: -1.2, v: m.k }, { t: m.t + 0.4, i: m.k, j: 0, v: m.k }] });
    tAb = t + 0.4;
  }
  // Abbreviation from the right: two counters off a square, one on the
  // square to its left.
  const pile = [];
  for (let k = 0; k <= N + 8; k++) pile.push([]);
  for (const c of C) pile[c.keys[c.keys.length - 1].i].push(c);
  t = tAb;
  for (let col = 0; col < N + 8; col++)
    while (pile[col].length >= 2) {
      const c1 = pile[col].pop(), c2 = pile[col].pop();
      c1.die = t + 0.15;
      c1.fuse = c2.fuse = t;
      c2.keys.push({ t, i: col, j: 0, v: col }, { t: t + 0.15, i: col, j: 0, v: col + 1 }, { t: t + 0.42, i: col + 1, j: 0, v: col + 1 });
      pile[col + 1].push(c2);
      t += 0.5;
    }
  // The check: one counter at most a square, on exactly the letters of
  // the ordinary answer, and all of them on the board.
  const want = op === "x" ? a * b : a + b;
  let ok = fit && want < 2 ** N;
  for (let col = 0; col < pile.length; col++) if (pile[col].length !== ((want >> col) & 1)) ok = false;
  const tRead = t + 0.2;
  return { op, a, b, want, A, B, C, marksA, marksB, tRead, tOut: tRead + 3.1, ok };
}

export function setup(params) {
  const ok = {};
  for (const N of [4, 5, 6, 7, 8]) ok[N] = PROBLEMS[N].map((pr) => plan(N, pr).ok);
  params.s = { hue: 0, speed: 2, prob: -1, N: 0, idx: 0, t: 0, cur: null, ok, px: new Float32Array(W * H * 3) };
}

function start(S, n) {
  let k = n;
  for (let tries = 0; tries < 6 && !S.ok[S.N][k]; tries++) k = (k + 1) % 6;
  S.idx = k;
  S.cur = plan(S.N, PROBLEMS[S.N][k]);
  S.g = geometry(S.N);
  S.t = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const prob = round(cl(k[2] || 0, 0, 5));
  const N = 8 - round(4 * cl(k[3] == null ? 0.06 : k[3], 0, 1));
  if (prob !== S.prob || N !== S.N) {
    S.prob = prob;
    S.N = N;
    start(S, prob);
  }
  S.t += (d * S.speed) / 2;
  if (S.t >= S.cur.tOut) start(S, (S.idx + 1) % 6);
}

function put(px, x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  px[o] = c[0];
  px[o + 1] = c[1];
  px[o + 2] = c[2];
}

function add(px, x, y, c, a) {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const o = (y * W + x) * 3;
  px[o] += (c[0] - px[o]) * a;
  px[o + 1] += (c[1] - px[o + 1]) * a;
  px[o + 2] += (c[2] - px[o + 2]) * a;
}

function glyph(px, ch, x, y, c, a) {
  const g = GLYPH[ch];
  for (let r = 0; r < g.length; r++) for (let q = 0; q < g[r].length; q++) if (g[r][q] === "#") add(px, x + q, y + r, c, a);
}

function digits(px, s, x, y, c, a) {
  for (const ch of s) {
    const g = DIG[ch];
    for (let r = 0; r < 5; r++) for (let q = 0; q < g[r].length; q++) if (g[r][q] === "#") add(px, x + q, y + r, c, a);
    x += 4;
  }
  return x;
}

// A soft disc of radius rad at (cx, cy).
function disc(px, cx, cy, rad, c, a) {
  for (let y = floor(cy - rad - 1); y <= cy + rad + 1; y++)
    for (let x = floor(cx - rad - 1); x <= cx + rad + 1; x++) {
      const cov = cl(rad + 0.5 - sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2), 0, 1);
      if (cov > 0) add(px, x, y, c, a * cov);
    }
}

// Where the counters of a pile sit, in sevenths of a square.
const OFF = [[], [[0, 0]], [[-1.7, -1.7], [1.7, 1.7]], [[-1.7, -1.7], [1.7, -1.7], [0, 1.8]], [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]];

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.cur) return;
  const P = S.cur, G = S.g, t = S.t, px = S.px, N = G.N, Q = G.S, u = Q / 7;
  px.fill(0);
  const h0 = 0.13 + S.hue;
  const rgb = (h, s, v) => hsv(h, s, v).map((c) => c * 255);
  const gold = rgb(h0, 0.6, 1), colA = rgb(h0 + 0.78, 0.5, 1), colB = rgb(h0 + 0.37, 0.6, 1);
  const light = rgb(h0 + 0.5, 0.5, 0.19), dark = rgb(h0 + 0.5, 0.5, 0.06);
  const dimL = rgb(h0 + 0.5, 0.3, 0.32), pale = rgb(h0 + 0.5, 0.1, 0.8), white = [255, 255, 255];
  const fade = cl((P.tOut - t) / 0.5, 0, 1) * cl(t / 0.2, 0, 1);
  const mx = (i) => G.sqX(i) + floor((Q - 5) / 2), my = (j) => G.sqY(j) + floor((Q - 7) / 2);
  // The board.
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const c = (i + j) % 2 === 0 ? light : dark;
      for (let y = 0; y < Q; y++) for (let x = 0; x < Q; x++) put(px, G.sqX(i) + x, G.sqY(j) + y, c);
    }
  // The margins: every letter dim, the numbers' letters lit, and at the
  // end the answer's letters along the bottom.
  for (let i = 0; i < N; i++) glyph(px, LET[i], mx(i), G.lbl, dimL, 1);
  for (let j = 0; j < N; j++) glyph(px, LET[j], G.rx, my(j), dimL, 1);
  const reading = t >= P.tRead;
  const lit = (m) => fade * ease((t - m.t) / 0.2);
  if (!reading) {
    for (const m of P.marksA) if (t >= m.t) glyph(px, LET[m.k], mx(m.k), G.lbl, colA, lit(m));
    for (const m of P.marksB) {
      if (t < m.t) continue;
      if (P.op === "x") glyph(px, LET[m.k], G.rx, my(m.k), colB, lit(m));
      else glyph(px, LET[m.k], mx(m.k), G.lbl, P.A.includes(m.k) ? white : colB, lit(m));
    }
  } else for (const k of bitsOf(P.want)) glyph(px, LET[k], mx(k), G.lbl, gold, fade * ease((t - P.tRead) / 0.3));
  // Counters: resting ones gathered per square, moving ones on their own.
  const rest = new Map(), live = [];
  for (const c of P.C) {
    if (t < c.born || t >= c.die) continue;
    const q = at(c, t), fusing = c.fuse >= 0 && t >= c.fuse && t < c.fuse + 0.15;
    live.push([c, q, fusing]);
    if (!q.moving && !fusing) {
      const key = round(q.i) + 16 * round(q.j);
      if (!rest.has(key)) rest.set(key, []);
      rest.get(key).push(c);
    }
  }
  // The diagonal a sliding counter runs along glows under it.
  for (const [c, q] of live) {
    if (!q.moving || P.op !== "x" || c.keys[0].j === 0 || q.j <= 0) continue;
    const v = c.keys[0].i + c.keys[0].j;
    for (let j = 0; j <= c.keys[0].j; j++)
      for (let y = 0; y < Q; y++) for (let x = 0; x < Q; x++) add(px, G.sqX(v - j) + x, G.sqY(j) + y, gold, 0.1 * fade);
  }
  for (const [c, q, fusing] of live) {
    const cx = G.sqX(q.i) + Q / 2, cy = G.sqY(q.j) + Q / 2;
    if (fusing) {
      disc(px, cx, cy, 2.8 * u, white, fade);
      continue;
    }
    if (q.moving) {
      disc(px, cx, cy, 2.5 * u, gold, fade);
      continue;
    }
    const here = rest.get(round(q.i) + 16 * round(q.j)), n = min(4, here.length), o = OFF[n][min(here.indexOf(c), n - 1)];
    const pop = ease((t - c.born) / 0.15);
    disc(px, cx + o[0] * u, cy + o[1] * u, (n === 1 ? 2.7 : 1.7) * u * pop, pop < 1 ? white : gold, fade);
  }
  // The ledger: each number in letters with its decimal at the right, a
  // rule, the bottom row read as letters, and under it the board's total
  // worked from the counters.
  const right = (str) => 63 - 4 * str.length;
  P.marksA.forEach((m, n) => { if (t >= m.t) glyph(px, LET[m.k], TX + 6 * n, L1, colA, fade); });
  if (t >= P.marksA[P.marksA.length - 1].t) digits(px, String(P.a), right(String(P.a)), L1 + 1, pale, fade * 0.8);
  if (t >= P.marksB[0].t) glyph(px, P.op, 2, L2, pale, fade);
  P.marksB.forEach((m, n) => { if (t >= m.t) glyph(px, LET[m.k], TX + 6 * n, L2, colB, fade); });
  if (t >= P.marksB[P.marksB.length - 1].t) digits(px, String(P.b), right(String(P.b)), L2 + 1, pale, fade * 0.8);
  for (let x = 2; x < 62; x++) add(px, x, RULE, pale, 0.35 * fade);
  // A counter on the bottom row is read by its value, so the one carried
  // left reads as its new letter from the moment its pair is taken up.
  const row = [];
  for (const [c, q] of live) {
    if (q.j !== 0) continue;
    let flash = 0;
    for (let n = 1; n < c.keys.length; n++) {
      const a = c.keys[n - 1], b = c.keys[n];
      if (t >= b.t && t < b.t + 0.35 && (a.i !== b.i || a.j !== b.j || a.v !== b.v)) flash = 1 - (t - b.t) / 0.35;
    }
    row.push([q.v, flash]);
  }
  row.sort((a, b) => a[0] - b[0]);
  row.forEach(([v, f], n) => {
    glyph(px, LET[v], TX + 6 * n, L3, gold, fade);
    if (f > 0) glyph(px, LET[v], TX + 6 * n, L3, white, fade * f);
  });
  let total = 0;
  for (const [, q] of live) total += 2 ** q.v;
  if (total > 0) {
    const str = String(total);
    digits(px, str, right(str), L4, reading ? gold : pale, fade);
    if (reading) digits(px, "=", right(str) - 6, L4, gold, fade * ease((t - P.tRead) / 0.3));
  }
  for (let y = 0; y < H; y++)
    for (let q = 0; q < W; q++) {
      const o = (y * W + q) * 3;
      display.setPixel(q, y, round(cl(px[o], 0, 255)), round(cl(px[o + 1], 0, 255)), round(cl(px[o + 2], 0, 255)));
    }
}
