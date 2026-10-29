// ===== Patternflow pattern =====
// Title:   Wongoji
// Family:  type
// Idea:    A pen writes Yun Dong-ju's Prelude (1941) in vertical lines on Korean manuscript paper, stroke by stroke in a 9 by 11 Hangul face the pattern composes from jamo, each square cell top to bottom and the columns right to left, and turns the page when the sheet is full.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 64, after wongoji manuscript paper and the johab Hangul bitmap fonts that drew each jamo in several sets (beol) by the vowel beside it and the final under it; the poem is Yun Dong-ju's Seosi (Prelude), written 20 November 1941
// Round:   64
// ===============================
// @matrix 64x128
// @knobs Paper=0..1, Speed=0.2..3, Brush=0..1, Hand=0..1
//
// Knob 1: Paper. Five sheets, each holding over most of its fifth of the knob and giving way to the next in a short cross-fade: at 0 night paper with vermilion lines and cream ink that shines gold while wet, at 0.25 hanji with red lines and brown-black ink, at 0.5 white school paper with green lines and blue-black ink, at 0.75 a blackboard ruled in chalk, at 1 blueprint.
// Knob 2: Speed. The pen draws 34 LEDs of stroke a second per unit, and its lifts and rests shorten with it: at 2 a syllable takes about a second, a sheet about 29 seconds and the whole poem, 95 syllables on four sheets, 109 seconds with its page turns; at 3 a sheet takes 20 seconds, at 0.2 over four minutes.
// Knob 3: Brush. At 0 a pen, every stroke one LED wide and even. Turned up, the brush presses a dot beside each stroke's start, lifts at its end and runs dry here and there, and the ink bleeds into the paper round it over a second after the pen passes, up to 42 percent of full ink at 1.
// Knob 4: Hand. The chance that a jamo is written one LED aside, 0.6 times Hand, and one LED up or down, half that: at the opening 0.06 one jamo in 28 strays aside and one in 56 up or down, at 1 three in five aside, and the page reads as a quick hand.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, abs, exp, hypot, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// The sheet: 5 columns of 10 square cells, 12 LEDs apart, so each cell has
// 11 by 11 LEDs inside its lines; a glyph is 9 wide and 11 tall. A 9 by 9
// face in 10-LED cells gave 72 cells a sheet, but a final ㄹ under ㅡ then
// had 3 rows and closed into a block, in 12 of the poem's 95 syllables.
const X0 = 1, Y0 = 3, P = 12, NC = 5, NR = 10;

// Yun Dong-ju, Seosi (Prelude), November 1941. # is the title, @ the author.
const POEM = [
  "#서시",
  "@윤동주",
  "죽는 날까지 하늘을 우러러",
  "한 점 부끄럼이 없기를,",
  "잎새에 이는 바람에도",
  "나는 괴로워했다.",
  "별을 노래하는 마음으로",
  "모든 죽어 가는 것을 사랑해야지",
  "그리고 나한테 주어진 길을",
  "걸어가야겠다.",
  "",
  "오늘 밤에도 별이 바람에 스치운다.",
];

// ---- The face. Jamo are strokes in writing order, each a list of points
// in a box w by h; a syllable puts them in boxes that depend on its vowel
// and on whether it has a final, the way the johab fonts kept several
// forms of each jamo. Over all 11,172 syllables that gives each initial 16
// or 17 forms, each vowel 2 or 3 and each final 1: 391 jamo pictures.
const INI = "g gg n d dd r m b bb s ss o j jj c k t p h".split(" ");
const FIN = ". g gg gs n nj nh d r rg rm rb rs rt rp rh m b bs s ss o j c k t p h".split(" ");

function ring(w, h, ox, oy) {
  const rw = min(w, h + 2), rh = min(h, w + 1);
  ox += (w - rw) >> 1;
  oy += (h - rh) >> 1;
  const R = rw - 1, B = rh - 1, c = R >> 1;
  const pts = rh <= 2 ? [[1, 0], [R - 1, 0], [R - 1, B], [1, B]] : [[c, 0], [1, 0], [0, 1], [0, B - 1], [1, B], [R - 1, B], [R, B - 1], [R, 1], [R - 1, 0], [c + 1, 0]];
  return pts.map(([x, y]) => [x + ox, y + oy]);
}

// Two legs from an apex: the s shape, also under the bar of j and c.
function legs(w, h, y0) {
  const c = (w - 1) >> 1, d = h - 1 - y0;
  const xl = max(0, round(c - 1.3 * d)), xr = min(w - 1, round(c + (w % 2 ? 0 : 1) + 1.3 * d));
  return [[[c, y0], [xl, h - 1]], [[c, y0 + max(1, round(d / 3))], [xr, h - 1]]];
}

function cons(k, w, h, tail) {
  const c = (w - 1) >> 1, m = (h - 1) >> 1, S = [];
  switch (k) {
    case "g":
      S.push(tail && h >= 6 ? [[0, 0], [w - 1, 0], [w - 1, h - 3], [w - 3, h - 1]] : [[0, 0], [w - 1, 0], [w - 1, h - 1]]);
      break;
    case "n":
      S.push([[0, 0], [0, h - 1], [w - 1, h - 1]]);
      break;
    case "d":
      S.push([[0, 0], [w - 1, 0]], [[0, 1], [0, h - 1], [w - 1, h - 1]]);
      break;
    case "r":
      if (h >= 5) S.push([[0, 0], [w - 1, 0], [w - 1, m]], [[0, m], [w - 2, m]], [[0, m + 1], [0, h - 1], [w - 1, h - 1]]);
      else {
        // Four rows: the middle bar breaks into a step, the way ㄹ is written fast.
        const z = w >> 1;
        S.push([[0, 0], [w - 1, 0], [w - 1, 1], [z, 1]], [[z, 2], [0, 2], [0, h - 1], [w - 1, h - 1]]);
      }
      break;
    case "m":
      S.push([[0, 0], [0, h - 1]], [[0, 0], [w - 1, 0], [w - 1, h - 1]], [[1, h - 1], [w - 2, h - 1]]);
      break;
    case "b":
      S.push([[0, 0], [0, h - 1]], [[w - 1, 0], [w - 1, h - 1]], [[1, m], [w - 2, m]], [[1, h - 1], [w - 2, h - 1]]);
      break;
    case "s":
      S.push(...legs(w, h, 0));
      break;
    case "o":
      S.push(ring(w, h, 0, 0));
      break;
    case "j":
      S.push([[0, 0], [w - 1, 0]], ...legs(w, h, 1));
      break;
    case "c":
      S.push([[c, 0], [c, 0]], [[0, 1], [w - 1, 1]], ...legs(w, h, 2));
      break;
    case "k": {
      const mk = (h >> 1);
      S.push([[0, 0], [w - 1, 0], [w - 1, h - 1]], [[0, mk], [w - 2, mk]]);
      break;
    }
    case "t":
      S.push([[0, 0], [w - 1, 0]], [[1, m], [w - 1, m]], [[0, 1], [0, h - 1], [w - 1, h - 1]]);
      break;
    case "p": {
      const a = w >= 5 ? 1 : 0;
      S.push([[0, 0], [w - 1, 0]], [[a, 1], [a, h - 2]], [[w - 1 - a, 1], [w - 1 - a, h - 2]], [[0, h - 1], [w - 1, h - 1]]);
      break;
    }
    case "h":
      S.push(w >= 7 ? [[c - 1, 0], [c + 1, 0]] : [[c, 0], [c, 0]], [[0, 1], [w - 1, 1]], ring(w, h - 2, 0, 2));
      break;
  }
  return S;
}

// One consonant, or a double or cluster side by side, in a box at (x, y).
function group(key, x, y, w, h, tail) {
  const parts = [...key];
  const out = [];
  if (parts.length === 1) {
    for (const s of cons(parts[0], w, h, tail)) out.push(s.map(([a, b]) => [a + x, b + y]));
    return out;
  }
  const w1 = (w - 1) >> 1, w2 = w - 1 - w1;
  for (const s of cons(parts[0], w1, h, false)) out.push(s.map(([a, b]) => [a + x, b + y]));
  for (const s of cons(parts[1], w2, h, false)) out.push(s.map(([a, b]) => [a + x + w1 + 1, b + y]));
  return out;
}

// Vowels. Vertical ones: the initial's width, then lines [0, x] and ticks
// [1, x0, x1, slot] (slot 0 the middle, 1 above it, 2 below it, 3 the row
// under a horizontal bar). Horizontal ones: ticks above [2, x], bars
// [3, x0, x1], stems below [4, x].
const VV = {
  0: [5, [0, 6], [1, 7, 8, 0]],
  1: [5, [0, 6], [1, 7, 7, 0], [0, 8]],
  2: [5, [0, 6], [1, 7, 8, 1], [1, 7, 8, 2]],
  3: [5, [0, 6], [1, 7, 7, 1], [1, 7, 7, 2], [0, 8]],
  4: [5, [1, 6, 7, 0], [0, 8]],
  5: [4, [1, 5, 5, 0], [0, 6], [0, 8]],
  6: [5, [1, 6, 7, 1], [1, 6, 7, 2], [0, 8]],
  7: [4, [1, 5, 5, 1], [1, 5, 5, 2], [0, 6], [0, 8]],
  20: [6, [0, 7]],
};
const HV = { 8: [[2, 4], [3, 0, 8]], 12: [[2, 2], [2, 6], [3, 0, 8]], 13: [[3, 0, 8], [4, 4]], 17: [[3, 0, 8], [4, 2], [4, 6]], 18: [[3, 0, 8]] };
const MV = {
  9: [5, [[2, 2], [3, 0, 4]], [[0, 6], [1, 7, 8, 0]]],
  10: [5, [[2, 2], [3, 0, 4]], [[0, 6], [1, 7, 7, 0], [0, 8]]],
  11: [6, [[2, 2], [3, 0, 5]], [[0, 7]]],
  14: [5, [[3, 0, 4], [4, 2]], [[1, 5, 6, 3], [0, 8]]],
  15: [4, [[3, 0, 3], [4, 2]], [[1, 5, 5, 3], [0, 6], [0, 8]]],
  16: [6, [[3, 0, 5], [4, 3]], [[0, 7]]],
  19: [6, [[3, 0, 5]], [[0, 7]]],
};
// Initials whose bottom row is clear in the middle, so the tick of ㅗ may sit
// right under them; and initials that need four rows to read.
const FREE = new Set(["g", "gg", "s", "ss", "j", "jj", "c", "k"]);
const NEED4 = new Set(["r", "b", "bb", "c", "k", "t", "h"]);

function vparts(parts, y0, y1, bar, out) {
  const mid = (y0 + y1) >> 1;
  for (const p of parts) {
    if (p[0] === 0) out.push([[p[1], y0], [p[1], y1]]);
    else {
      const y = p[3] === 0 ? mid : p[3] === 1 ? mid - 1 : p[3] === 2 ? mid + 1 : bar + 1;
      out.push([[p[1], y], [p[2], y]]);
    }
  }
}
function hparts(parts, bar, stem, out) {
  for (const p of parts) {
    if (p[0] === 2) out.push([[p[1], bar - 1], [p[1], bar - 1]]);
    else if (p[0] === 3) out.push([[p[1], bar], [p[2], bar]]);
    else out.push([[p[1], bar + 1], [p[1], bar + stem]]);
  }
}

// The strokes of one syllable in a 9 by 11 box, each jamo moved by its own
// offset for the Hand knob.
function syllable(code, off) {
  const s = code - 0xac00;
  const ci = floor(s / 588), vi = floor((s % 588) / 28), fi = s % 28;
  const ini = INI[ci], has = fi > 0, out = [], vow = [];
  let box, fbox = FIN[fi].length > 1 ? [0, 7, 9, 4] : [1, 7, 7, 4];
  if (VV[vi]) {
    const [iw, ...parts] = VV[vi];
    box = has ? [0, 0, iw, 5] : [0, 2, iw, 7];
    vparts(parts, has ? 0 : 1, has ? 5 : 9, 0, vow);
  } else if (HV[vi]) {
    const up = vi === 8 || vi === 12, down = vi === 13 || vi === 17;
    let bar = 7;
    if (!has) {
      box = [1, 1, 7, 5];
      if (up) bar = 8;
    } else if (up) {
      box = FREE.has(ini) ? [1, 0, 7, 4] : [1, 0, 7, 3];
      bar = 5;
    } else if (down) {
      box = NEED4.has(ini) ? [1, 0, 7, 4] : [1, 0, 7, 3];
      bar = box[3] + 1;
    } else {
      box = [1, 0, 7, 4];
      bar = 5;
    }
    hparts(HV[vi], bar, has ? 1 : 2, vow);
  } else {
    const [iw, hp, vp] = MV[vi];
    const up = hp[0][0] === 2, flat = hp.length === 1;
    let bar;
    if (!has) {
      box = [0, 1, iw, flat ? 5 : 4];
      bar = up || flat ? 7 : 6;
    } else {
      box = [0, 0, iw, flat ? 4 : 3];
      bar = up || flat ? 5 : 4;
    }
    hparts(hp, bar, has ? 1 : 2, vow);
    vparts(vp, has ? 0 : 1, has ? 5 : 9, bar, vow);
  }
  const tail = !has && VV[vi] && (ini === "g" || ini === "k");
  const mv = (list, o) => list.map((st) => st.map(([x, y]) => [x + o[0], y + o[1]]));
  out.push(...mv(group(ini, box[0], box[1], box[2], box[3], tail), off[0]));
  out.push(...mv(vow, off[1]));
  if (has) out.push(...mv(group(FIN[fi], fbox[0], fbox[1], fbox[2], fbox[3], false), off[2]));
  return out;
}

// Marks: in vertical writing the comma and the full stop sit high on the right.
const MARKS = { ",": [[[5, 1], [7, 3]]], ".": [[[6, 0], [5, 1], [6, 2], [7, 1], [6, 0]]] };

function strokesOf(ch, off) {
  const code = ch.codePointAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return syllable(code, off);
  return MARKS[ch] ? MARKS[ch].map((s) => s.map(([x, y]) => [x + off[0][0], y + off[0][1]])) : [];
}

// Points to pixels, in drawing order.
function raster(stroke) {
  const px = [];
  for (let i = 0; i < stroke.length; i++) {
    const [x0, y0] = stroke[i], [x1, y1] = stroke[min(i + 1, stroke.length - 1)];
    const n = max(abs(x1 - x0), abs(y1 - y0));
    for (let j = 0; j <= n; j++) {
      const x = round(x0 + ((x1 - x0) * j) / (n || 1)), y = round(y0 + ((y1 - y0) * j) / (n || 1));
      const l = px[px.length - 1];
      if (!l || l[0] !== x || l[1] !== y) px.push([x, y]);
    }
  }
  return px;
}

// ---- The manuscript: columns of 10 cells, a new column for every line, a
// wrapped line going on one cell down, the title in the middle of its
// column and the author's name ending one cell from the foot of the next.
function layout() {
  const cols = [];
  const blank = () => new Array(NR).fill(null);
  for (const line of POEM) {
    const col = blank();
    if (line[0] === "#" || line[0] === "@") {
      const t = [...line.slice(1)];
      const s = line[0] === "#" ? (NR - t.length) >> 1 : NR - 1 - t.length;
      t.forEach((ch, i) => (col[s + i] = ch));
      cols.push(col);
      continue;
    }
    let cur = col, r = 0;
    for (const word of line.split(" ").filter(Boolean)) {
      const chs = [...word];
      if (r > 0 && r + 1 + chs.length > NR) {
        cols.push(cur);
        cur = blank();
        r = 1;
      } else if (r > 0) r++;
      for (const ch of chs) cur[r++] = ch;
    }
    cols.push(cur);
  }
  const cells = [];
  cols.forEach((col, ci) => col.forEach((ch, r) => ch && cells.push({ page: floor(ci / NC), col: ci % NC, row: r, ch, rnd: [0, 1, 2, 3, 4, 5].map(() => Math.random()) })));
  return { cells, pages: Math.ceil(cols.length / NC) };
}

const cellX = (c) => X0 + P * (NC - 1 - c) + 2;
const cellY = (r) => Y0 + P * r + 1;

// Paper, grid, ink, fresh ink and the pen, for the Paper knob: night paper
// with vermilion lines, hanji with red, school paper with green, a
// blackboard with chalk, and blueprint.
const SETS = [
  [[3, 4, 10], [196, 58, 40], [236, 230, 212], [255, 214, 140], [255, 196, 96]],
  [[232, 218, 186], [206, 64, 46], [26, 20, 16], [96, 36, 26], [150, 30, 20]],
  [[224, 232, 220], [46, 148, 92], [24, 36, 124], [70, 110, 230], [40, 70, 220]],
  [[14, 44, 30], [150, 190, 120], [236, 240, 226], [255, 250, 190], [255, 255, 255]],
  [[8, 20, 56], [72, 146, 210], [226, 236, 255], [150, 220, 255], [255, 255, 255]],
];

export function setup(params) {
  const S = (params.s = { ...layout(), started: false, t: 0 });
  S.ink = new Float32Array(N);
  S.when = new Float32Array(N);
  S.halo = new Float32Array(N);
  S.glow = new Float32Array(N);
  S.leaf = new Float32Array(N);
  S.grid = new Float32Array(N);
  for (let y = Y0; y <= Y0 + P * NR; y++)
    for (let x = X0; x <= X0 + P * NC; x++) {
      const vx = (x - X0) % P === 0, hy = (y - Y0) % P === 0;
      if (!vx && !hy) continue;
      const edge = x === X0 || x === X0 + P * NC || y === Y0 || y === Y0 + P * NR;
      S.grid[y * W + x] = edge ? 1 : 0.5;
    }
  S.F = new Float32Array(N * 3);
}

// Ink one LED, light the paper round it for a moment, and with the Brush up
// let the ink bleed into its four neighbours.
function inkAt(S, x, y, a, t) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = y * W + x;
  if (a > S.ink[p]) S.ink[p] = a;
  S.when[p] = t;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < W && yy >= 0 && yy < H) S.glow[yy * W + xx] = t;
    }
  const b = S.brush;
  if (b > 0)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const q = p + dy * W + dx, xx = x + dx;
      if (xx < 0 || xx >= W || q < 0 || q >= N) continue;
      const v = 0.42 * b * a;
      if (v > S.halo[q]) S.halo[q] = v;
    }
}

function prepare(S, cell) {
  // The hand: each jamo steps one LED aside with a chance of 0.6 Hand, and
  // one LED up or down with half that.
  const o = (i, k) => {
    const r = cell.rnd[i] * 2 - 1;
    return abs(r) > 1 - 0.6 * k * S.hand ? Math.sign(r) : 0;
  };
  const off = [[o(0, 1), o(1, 0.5)], [o(2, 1), o(3, 0.5)], [o(4, 1), o(5, 0.5)]];
  const x = cellX(cell.col), y = cellY(cell.row);
  cell.px = strokesOf(cell.ch, off).map((st) => raster(st).map(([a, b]) => [a + x, b + y]));
}

// A stroke's LEDs from `from` up to `upto`. With the Brush up it presses a
// dot beside the stroke's start, lifts at its end and runs dry here and there.
function inkStroke(S, st, upto, from, t) {
  const b = S.brush, n = st.length;
  for (let i = from; i < upto; i++) {
    const [x, y] = st[i];
    let a = 1;
    if (b > 0) {
      if (i === n - 1 && n > 2) a = 1 - 0.35 * b;
      else if (i > 0) a = 1 - 0.3 * b * Math.random();
    }
    inkAt(S, x, y, a, t);
    if (i === 0 && b > 0.05) inkAt(S, x - 1, y, 0.55 * b, t);
  }
}

function startPage(S, page) {
  S.page = page;
  S.ink.fill(0);
  S.halo.fill(0);
  S.when.fill(-99);
  S.glow.fill(-99);
}

// The pen: writes, lifts between strokes, rests between cells, and at the
// foot of a page waits, then the page turns.
function step(S, dt) {
  S.t += dt;
  const v = 34 * S.speed, q = 2 / S.speed;
  let left = dt;
  while (left > 0) {
    if (S.mode === "wait") {
      const u = min(left, S.timer);
      S.timer -= u;
      left -= u;
      if (S.timer > 0) return;
      S.mode = S.next;
      if (S.mode === "turn") {
        S.leaf.set(S.ink);
        S.leafHalo = Float32Array.from(S.halo);
        S.turn = 0;
        const done = S.ci >= S.cells.length;
        if (done) S.ci = 0;
        startPage(S, S.cells[S.ci].page);
        S.mode = "turning";
      }
      continue;
    }
    if (S.mode === "turning") {
      S.turn += left / 1.6;
      left = 0;
      if (S.turn >= 1) {
        S.turn = 0;
        S.mode = "cell";
      }
      return;
    }
    if (S.mode === "cell") {
      if (S.ci >= S.cells.length) {
        S.mode = "wait";
        S.timer = 4;
        S.next = "turn";
        continue;
      }
      const cell = S.cells[S.ci];
      if (cell.page !== S.page) {
        S.mode = "wait";
        S.timer = 1.2;
        S.next = "turn";
        continue;
      }
      prepare(S, cell);
      S.si = 0;
      S.pos = 0;
      S.mode = "lift";
      S.from = S.pen;
      const to = cell.px[0] ? cell.px[0][0] : S.pen;
      S.lift = 0;
      S.liftT = 0.12 * q + hypot(to[0] - S.pen[0], to[1] - S.pen[1]) / (4 * v);
      continue;
    }
    if (S.mode === "lift") {
      const cell = S.cells[S.ci];
      const u = min(left, S.liftT - S.lift);
      S.lift += u;
      left -= u;
      const to = cell.px[S.si] ? cell.px[S.si][0] : S.pen;
      const f = S.lift / S.liftT;
      S.nib = [S.from[0] + (to[0] - S.from[0]) * f, S.from[1] + (to[1] - S.from[1]) * f];
      if (S.lift < S.liftT) return;
      if (!cell.px[S.si]) {
        S.ci++;
        S.mode = "cell";
        continue;
      }
      S.mode = "draw";
      S.pos = 0;
      S.done = 0;
      continue;
    }
    if (S.mode === "draw") {
      const cell = S.cells[S.ci], st = cell.px[S.si];
      const u = min(left, (st.length - S.pos) / v);
      S.pos += u * v;
      left -= u;
      const upto = min(st.length, floor(S.pos) + 1);
      inkStroke(S, st, upto, S.done, S.t - left);
      S.done = upto;
      S.pen = st[upto - 1];
      S.nib = S.pen;
      if (S.done < st.length) return;
      S.si++;
      S.from = S.pen;
      S.mode = "lift";
      S.lift = 0;
      const to = cell.px[S.si] ? cell.px[S.si][0] : S.pen;
      S.liftT = (cell.px[S.si] ? 0.05 : 0.1) * q + hypot(to[0] - S.pen[0], to[1] - S.pen[1]) / (4 * v);
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.paper = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.brush = cl(k[2], 0, 1);
  S.hand = cl(k[3], 0, 1);
  if (!S.started) {
    S.started = true;
    // The panel opens on the first sheet with the title, the author and the
    // first column of the poem already written, and the pen has been at the
    // next column for four seconds at the knob's speed.
    startPage(S, 0);
    S.ci = 0;
    while (S.cells[S.ci].page === 0 && S.cells[S.ci].col < 3) {
      const cell = S.cells[S.ci++];
      prepare(S, cell);
      for (const st of cell.px) inkStroke(S, st, st.length, 0, -50);
    }
    S.pen = [cellX(2) + 4, cellY(9) + 6];
    S.nib = S.pen;
    S.mode = "cell";
    for (let i = 0; i < 120; i++) step(S, 1 / 30);
  }
  step(S, dt);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  // Each set holds over most of its stretch of the knob and gives way to the
  // next in a short cross-fade, so no muddy half-way sheet lasts long.
  const u = S.paper * 4, i0 = min(3, floor(u)), f = u - i0, sm = cl((f - 0.3) / 0.4, 0, 1);
  const [paper, grid, ink, wet, pen] = [0, 1, 2, 3, 4].map((j) => mix(SETS[i0][j], SETS[i0 + 1][j], sm * sm * (3 - 2 * sm)));
  const inner = mix(paper, grid, 0.5), glowC = mix(ink, wet, 0.35);
  const F = S.F, t = S.t;
  // One LED of a sheet: paper or line, then ink, then the bleed round the
  // ink, which spreads for a second after the pen passes; on the sheet being
  // written, fresh ink and the paper round it glow for a moment.
  const shade = (p, I, Hh, fresh, out, o) => {
    const g = S.grid[p], c = g ? (g === 1 ? grid : inner) : paper;
    let a = I[p];
    if (Hh[p] > a) {
      const age = t - S.glow[p], h = Hh[p] * (fresh && age < 4 ? 1 - exp(-age / 0.6) : 1);
      if (h > a) a = h;
    }
    let r = c[0] + (ink[0] - c[0]) * a, gg = c[1] + (ink[1] - c[1]) * a, b = c[2] + (ink[2] - c[2]) * a;
    if (fresh) {
      const age = t - (I[p] > 0 ? S.when[p] : S.glow[p]);
      if (age < 4) {
        const w = I[p] > 0 ? 0.75 * exp(-age / 0.8) : 0.32 * exp(-age / 0.5), c2 = I[p] > 0 ? wet : glowC;
        r += (c2[0] - r) * w;
        gg += (c2[1] - gg) * w;
        b += (c2[2] - b) * w;
      }
    }
    out[o] = r;
    out[o + 1] = gg;
    out[o + 2] = b;
  };
  for (let p = 0; p < N; p++) shade(p, S.ink, S.halo, true, F, p * 3);
  // The pen's nib, bright while it writes and dimmer while it is lifted.
  if (S.mode !== "turning" && S.nib) {
    const [nx, ny] = S.nib, down = S.mode === "draw";
    const x = round(nx), y = round(ny);
    const k = down ? 1 : 0.6;
    for (const [dx, dy, a] of [[0, 0, 1], [1, 0, 0.5], [-1, 0, 0.5], [0, 1, 0.5], [0, -1, 0.5], [1, 1, 0.22], [-1, 1, 0.22], [1, -1, 0.22], [-1, -1, 0.22]]) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
      const o = (Y * W + X) * 3;
      for (let j = 0; j < 3; j++) F[o + j] += (pen[j] - F[o + j]) * a * k;
    }
  }
  // A turning page: the written leaf folds over towards the binding at the
  // right edge, shading as it goes, over the fresh sheet.
  if (S.mode === "turning") {
    const e = S.turn * S.turn * (3 - 2 * S.turn), th = (e * PI) / 2, lw = W * cos(th);
    const edge = W - lw, tmp = [0, 0, 0];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 3;
        if (x >= edge && lw > 0.5) {
          const sx = floor(W - ((W - x - 0.5) * W) / lw);
          shade(y * W + cl(sx, 0, W - 1), S.leaf, S.leafHalo, false, tmp, 0);
          const l = 0.45 + 0.55 * cos(th) + 0.25 * exp(-(x - edge) / 2) * (1 - cos(th));
          F[o] = tmp[0] * l;
          F[o + 1] = tmp[1] * l;
          F[o + 2] = tmp[2] * l;
        } else {
          const d = 1 - 0.6 * exp(-(edge - x) / 5) * (1 - e);
          F[o] *= d;
          F[o + 1] *= d;
          F[o + 2] *= d;
        }
      }
  }
  for (let y = 0, o = 0; y < H; y++) for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, round(min(255, F[o])), round(min(255, F[o + 1])), round(min(255, F[o + 2])));
}
