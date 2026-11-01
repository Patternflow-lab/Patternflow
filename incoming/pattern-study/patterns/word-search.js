// ===== Patternflow pattern =====
// Title:   Word Search
// Family:  type
// Idea:    A word search of 160 capitals, 10 across and 16 down the tall panel, hides twelve words of type vocabulary in all eight directions among random letters, and a white cursor reads it cell by cell the plain way, sending a probe out in each of the eight directions from every letter that starts a word still unfound, until a probe runs a whole word and a rounded capsule in that word's colour closes round it and stays; when all twelve are ringed the grid dissolves and the next puzzle types itself in.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: word search puzzle (Norman E. Gibat, Selenby Digest, Norman, Oklahoma, 1968), solved by the plain search that tries all eight directions from every cell; capitals 5 by 7 drawn for this pattern; pattern round 82
// Round:   82
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Puzzle=0..5, Fill=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the grid is pale blue-grey, the probe reads in pale gold, a failed letter flashes rose, and the capsules come in cyan, violet, rose, azure, magenta and on, each 0.382 of a 0.62 band on from the one before.
// Knob 2: Speed. At 2 each comparison takes 0.03 s and each find holds the search 0.4 s, so the opening puzzle types in for 1 s, has all twelve words ringed by 20 s, holds 1.6 s and dissolves in 1.2 s; at 0.2 everything takes ten times as long, at 3 two thirds as long.
// Knob 3: Puzzle. Which of six lists of twelve words is hidden: 0 SERIF, KERN, GLYPH, BOWL, STEM, SPUR, EAR, TAIL, LEADING, BASELINE, COUNTER and ASCENDER; 1 more parts of a letter, APEX to XHEIGHT; 2 words of the page, TRACKING to HYPHEN; 3 classes of type, ROMAN to MONO; 4 metal type, SORT to FURNITURE; 5 accents and marks, ACUTE to MACRON. Each new puzzle on a list is laid again from its own seed.
// Knob 4: Fill. How a found word is marked. At 0 and the opening 0.06 a capsule outline one LED wide, which for words across and down runs in the gaps between the letters; at 0.5 the capsule is filled at 40% of its colour, and at 1 it is solid at 80% with the word's letters cut out of it dark while every letter outside the found words dims to half.

// Placing: the words go in longest first, each at the first of 400 random
// starts where every cell is empty or already holds the same letter. Each
// word tries a direction of its own for the first 200 starts, three
// eighths of a turn on from the word before, so a grid has words running
// backwards, upwards and along both diagonals. The cells left over get
// random letters, and a word that the filler happens to spell again is
// found wherever the search reaches it first.
//
// Searching: the cursor visits the cells in reading order. A cell whose
// letter starts no word still unfound costs one step. From any other cell
// the probe tries east, then each direction clockwise; it reads one letter
// a step, keeps the words whose next letter matches and stops at the first
// letter that matches none, which flashes. When a word runs out on a match
// it is found. Directions that leave the grid at once cost nothing.
//
// The capsule round a word is the set of LEDs at distance 3 from the
// segment joining its first and last letter centres, measured with the
// vertical squeezed by 3/4. So the outline sits on the gap row 4 LEDs
// above and below a word that runs across, on the gap column 3 LEDs either
// side of a word that runs down, and the ends round off between the two.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, sqrt, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// 10 columns by 16 rows of 5 by 7 capitals, 6 LEDs apart across and 8 down.
const COLS = 10, ROWS = 16, CELLS = COLS * ROWS, CW = 6, CH = 8, X0 = 2, Y0 = 1;
// Clockwise from east, the order the search tries them in.
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
// Seconds at Speed 2: one comparison, the pause on a find, the hold when
// every word is found, the dissolve and the typing in of the next grid.
const STEP = 0.03, FIND = 0.4, HOLD = 1.6, MELT = 1.2, TYPE = 1.0;
// Capsule radius across the word, in LEDs; down the panel it is 4/3 of it.
const R = 3, SY = 0.75;

const LISTS = [
  ["SERIF", "KERN", "GLYPH", "BOWL", "STEM", "SPUR", "EAR", "TAIL", "LEADING", "BASELINE", "COUNTER", "ASCENDER"],
  ["APEX", "VERTEX", "SPINE", "ARM", "LEG", "LOOP", "LINK", "CROSSBAR", "SHOULDER", "TERMINAL", "DESCENDER", "XHEIGHT"],
  ["TRACKING", "MEASURE", "GUTTER", "INDENT", "WIDOW", "ORPHAN", "RAG", "RIVER", "JUSTIFY", "MARGIN", "COLUMN", "HYPHEN"],
  ["ROMAN", "ITALIC", "GOTHIC", "SLAB", "SCRIPT", "GROTESK", "DIDONE", "UNCIAL", "TEXTURA", "FRAKTUR", "ANTIQUA", "MONO"],
  ["SORT", "QUOIN", "CHASE", "GALLEY", "FORME", "PLATEN", "PUNCH", "MATRIX", "SLUG", "LIGATURE", "COMPOSE", "FURNITURE"],
  ["ACUTE", "GRAVE", "TILDE", "CEDILLA", "OGONEK", "UMLAUT", "CARET", "DAGGER", "PILCROW", "ASTERISK", "OBELUS", "MACRON"],
];

// Capitals 5 wide and 7 tall, top row first.
const FONT = (
  ".###. #...# #...# ##### #...# #...# #...#|####. #...# #...# ####. #...# #...# ####.|.###. #...# #.... #.... #.... #...# .###.|" +
  "####. #...# #...# #...# #...# #...# ####.|##### #.... #.... ####. #.... #.... #####|##### #.... #.... ####. #.... #.... #....|" +
  ".###. #...# #.... #.### #...# #...# .####|#...# #...# #...# ##### #...# #...# #...#|.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.|" +
  "..### ...#. ...#. ...#. ...#. #..#. .##..|#...# #..#. #.#.. ##... #.#.. #..#. #...#|#.... #.... #.... #.... #.... #.... #####|" +
  "#...# ##.## #.#.# #.#.# #...# #...# #...#|#...# #...# ##..# #.#.# #..## #...# #...#|.###. #...# #...# #...# #...# #...# .###.|" +
  "####. #...# #...# ####. #.... #.... #....|.###. #...# #...# #...# #.#.# #..#. .##.#|####. #...# #...# ####. #.#.. #..#. #...#|" +
  ".#### #.... #.... .###. ....# ....# ####.|##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..|#...# #...# #...# #...# #...# #...# .###.|" +
  "#...# #...# #...# #...# #...# .#.#. ..#..|#...# #...# #...# #.#.# #.#.# #.#.# .#.#.|#...# #...# .#.#. ..#.. .#.#. #...# #...#|" +
  "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..|##### ....# ...#. ..#.. .#... #.... #####"
)
  .split("|")
  .map((g) => g.split(" ").map((row) => [...row].map((c) => c === "#")));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const code = (ch) => ch.charCodeAt(0) - 65;
const inGrid = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;

function puzzle(list, gen) {
  const rand = rng(list * 7919 + gen * 104729 + 17);
  const grid = new Int8Array(CELLS).fill(-1);
  const words = LISTS[list].slice().sort((a, b) => b.length - a.length);
  const turn = floor(rand() * 8), laid = [];
  for (const [n, w] of words.entries()) {
    for (let tries = 0; tries < 400; tries++) {
      // Each word tries its own direction first, so all eight turn up.
      const d = DIRS[tries < 200 ? (turn + n * 3) % 8 : floor(rand() * 8)], c0 = floor(rand() * COLS), r0 = floor(rand() * ROWS);
      const c1 = c0 + d[0] * (w.length - 1), r1 = r0 + d[1] * (w.length - 1);
      if (!inGrid(c1, r1)) continue;
      let ok = true;
      for (let i = 0; i < w.length && ok; i++) {
        const g = grid[(r0 + d[1] * i) * COLS + c0 + d[0] * i];
        if (g >= 0 && g !== code(w[i])) ok = false;
      }
      if (!ok) continue;
      for (let i = 0; i < w.length; i++) grid[(r0 + d[1] * i) * COLS + c0 + d[0] * i] = code(w[i]);
      laid.push(w);
      break;
    }
  }
  for (let i = 0; i < CELLS; i++) if (grid[i] < 0) grid[i] = floor(rand() * 26);
  return { grid, words: laid.map((w) => w.split("").map(code)) };
}

export function setup(params) {
  params.s = {
    list: -1, gen: 0, grid: null, words: [], left: [], found: [],
    phase: 0, t: 0, acc: 0, wait: 0,
    cell: 0, dir: -1, k: 0, live: [], miss: -1, next: false,
    seen: new Uint8Array(CELLS),
    capIn: new Int8Array(N), capOut: new Int8Array(N),
    hue: 0, fill: 0.06,
    rgb: new Uint8Array(N * 3),
    melt: null,
  };
  const S = params.s;
  const rand = rng(99);
  S.melt = new Float32Array(N);
  for (let i = 0; i < N; i++) S.melt[i] = rand();
}

function begin(S, list, gen) {
  const p = puzzle(list, gen);
  S.list = list;
  S.gen = gen;
  S.grid = p.grid;
  S.words = p.words;
  S.left = p.words.map((_, i) => i);
  S.found = [];
  S.phase = 0;
  S.t = 0;
  S.acc = 0;
  S.wait = 0;
  S.cell = 0;
  S.dir = -1;
  S.k = 0;
  S.live = [];
  S.miss = -1;
  S.next = false;
  S.seen.fill(0);
  S.capIn.fill(0);
  S.capOut.fill(0);
}

const centre = (c, r) => [X0 + c * CW + 2, Y0 + r * CH + 3];

// Mark the capsule round a found word in the two LED maps.
function capsule(S, f) {
  const [ax, ay] = centre(f.c, f.r), [bx, by] = centre(f.c + f.d[0] * (f.n - 1), f.r + f.d[1] * (f.n - 1));
  const ux = bx - ax, uy = (by - ay) * SY, uu = ux * ux + uy * uy || 1;
  const x0 = max(0, min(ax, bx) - 5), x1 = min(W - 1, max(ax, bx) + 5), y0 = max(0, min(ay, by) - 6), y1 = min(H - 1, max(ay, by) + 6);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x - ax, py = (y - ay) * SY;
      const t = cl((px * ux + py * uy) / uu, 0, 1);
      const ex = px - t * ux, ey = py - t * uy, d = sqrt(ex * ex + ey * ey);
      const p = y * W + x;
      if (abs(d - R) < 0.5) S.capOut[p] = f.i + 1;
      else if (d < R) S.capIn[p] = f.i + 1;
    }
}

// The cells a probe from the cursor has read so far.
function cellAt(S, i) {
  const c = (S.cell % COLS) + DIRS[S.dir][0] * i, r = floor(S.cell / COLS) + DIRS[S.dir][1] * i;
  return inGrid(c, r) ? r * COLS + c : -1;
}

function nextDir(S) {
  S.k = 0;
  S.miss = -1;
  for (S.dir++; S.dir < 8; S.dir++) {
    S.live = S.left.filter((w) => S.words[w][0] === S.grid[S.cell]);
    if (S.live.length && cellAt(S, 1) >= 0) return;
  }
  S.seen[S.cell] = 1;
  S.cell++;
  S.dir = -1;
}

// One comparison of the plain search.
function tick(S) {
  if (S.next) {
    S.next = false;
    nextDir(S);
    if (S.dir < 0) return;
  }
  if (S.cell >= CELLS || S.left.length === 0) {
    S.phase = 2;
    S.t = 0;
    return;
  }
  if (S.dir < 0) {
    // On a new cell: does any word left start with its letter?
    if (S.left.some((w) => S.words[w][0] === S.grid[S.cell])) nextDir(S);
    else {
      S.seen[S.cell] = 1;
      S.cell++;
    }
    return;
  }
  const at = cellAt(S, S.k + 1);
  const live = at < 0 ? [] : S.live.filter((w) => S.words[w].length > S.k + 1 && S.words[w][S.k + 1] === S.grid[at]);
  if (!live.length) {
    S.miss = at;
    S.next = true;
    return;
  }
  S.k++;
  S.live = live;
  const done = live.find((w) => S.words[w].length === S.k + 1);
  if (done != null) {
    const f = { i: S.found.length, w: done, c: S.cell % COLS, r: floor(S.cell / COLS), d: DIRS[S.dir], n: S.k + 1 };
    S.found.push(f);
    S.left = S.left.filter((w) => w !== done);
    capsule(S, f);
    S.wait = FIND;
    S.live = live.filter((w) => w !== done);
    if (!S.live.length) S.next = true;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const list = round(cl(k[2] || 0, 0, LISTS.length - 1));
  S.fill = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  if (list !== S.list) begin(S, list, 0);
  const step = (d * speed) / 2;
  S.t += step;
  if (S.wait > 0) S.wait = max(0, S.wait - step);
  if (S.phase === 0) {
    if (S.t >= TYPE) {
      S.phase = 1;
      S.t = 0;
    }
  } else if (S.phase === 1) {
    if (S.wait > 0) return;
    S.acc += step;
    while (S.acc >= STEP && S.phase === 1 && S.wait <= 0) {
      S.acc -= STEP;
      tick(S);
    }
  } else if (S.phase === 2) {
    if (S.t >= HOLD) {
      S.phase = 3;
      S.t = 0;
    }
  } else if (S.t >= MELT) begin(S, S.list, S.gen + 1);
}

function put(rgb, p, c, v) {
  rgb[p * 3] = round(c[0] * v * 255);
  rgb[p * 3 + 1] = round(c[1] * v * 255);
  rgb[p * 3 + 2] = round(c[2] * v * 255);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.grid) return;
  const rgb = S.rgb, h = S.hue, f = S.fill;
  rgb.fill(0);
  const wordCol = S.found.map((w) => hsv(h + 0.5 + ((w.i * 0.381966) % 1) * 0.62, 0.7, 1));
  const fresh = S.wait > 0 ? S.found.length - 1 : -1;
  // Capsules: a fill under the letters as Fill rises, and the outline.
  for (let p = 0; p < N; p++) {
    const o = S.capOut[p], i = S.capIn[p];
    if (o) put(rgb, p, wordCol[o - 1], o - 1 === fresh ? 1 : 0.85);
    else if (i && f > 0.02) put(rgb, p, wordCol[i - 1], 0.8 * f);
  }
  const inWord = new Int8Array(CELLS).fill(-1);
  for (const w of S.found) for (let j = 0; j < w.n; j++) inWord[(w.r + w.d[1] * j) * COLS + w.c + w.d[0] * j] = w.i;
  const probe = new Int8Array(CELLS);
  if (S.phase === 1 && S.dir >= 0) {
    for (let j = 1; j <= S.k; j++) probe[cellAt(S, j)] = 1;
    if (S.miss >= 0) probe[S.miss] = 2;
  }
  const base = hsv(h + 0.58, 0.28, 1), dim = hsv(h + 0.6, 0.4, 1);
  const hit = hsv(h + 0.14, 0.45, 1), miss = hsv(h + 0.93, 0.6, 1), white = [1, 1, 1];
  const knock = cl((f - 0.45) / 0.45, 0, 1), rest = 1 - 0.5 * f;
  const typed = S.phase === 0 ? (S.t / TYPE) * (CELLS + 20) : 1e9;
  const melt = S.phase === 3 ? S.t / MELT : -1;
  for (let ci = 0; ci < CELLS; ci++) {
    if (ci > typed) continue;
    const c = ci % COLS, r = floor(ci / COLS), g = FONT[S.grid[ci]];
    let col = base, v = 0.55 * rest;
    if (inWord[ci] >= 0) {
      col = wordCol[inWord[ci]];
      v = inWord[ci] === fresh ? 1 : 1 - 0.85 * knock;
      if (inWord[ci] !== fresh && knock < 0.5) col = col.map((x) => x + (1 - x) * 0.35);
    } else if (S.phase === 1 && ci === S.cell) {
      col = white;
      v = 1;
    } else if (probe[ci] === 1) {
      col = hit;
      v = 1;
    } else if (probe[ci] === 2) {
      col = miss;
      v = 0.9;
    } else if (S.seen[ci]) {
      col = dim;
      v = 0.32 * rest;
    }
    const x0 = X0 + c * CW, y0 = Y0 + r * CH;
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 5; x++) if (g[y][x]) put(rgb, (y0 + y) * W + x0 + x, col, v);
  }
  // The cursor's box in the gaps round its cell.
  if (S.phase === 1 && S.cell < CELLS) {
    const x0 = X0 + (S.cell % COLS) * CW - 1, y0 = Y0 + floor(S.cell / COLS) * CH - 1;
    for (let x = x0; x <= x0 + 6; x++)
      for (const y of [y0, y0 + 8]) if (x >= 0 && x < W && y >= 0 && y < H) put(rgb, y * W + x, white, 0.6);
    for (let y = y0; y <= y0 + 8; y++)
      for (const x of [x0, x0 + 6]) if (x >= 0 && x < W && y >= 0 && y < H) put(rgb, y * W + x, white, 0.6);
  }
  for (let p = 0; p < N; p++) {
    if (melt >= 0 && S.melt[p] < melt) display.setPixel(p % W, floor(p / W), 0, 0, 0);
    else display.setPixel(p % W, floor(p / W), rgb[p * 3], rgb[p * 3 + 1], rgb[p * 3 + 2]);
  }
}
