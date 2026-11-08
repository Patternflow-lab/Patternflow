// ===== Patternflow pattern =====
// Title:   Apfel mit Wurm
// Family:  type
// Idea:    The word APFEL fills the panel in 21 lines of three, a concrete poem all in one deep pink, and a worm spelling WURM crawls through the letter cells, each cell it leaves going dark where its letter was eaten and growing the letter back from the bottom up some seconds later.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Apfel mit Wurm, a concrete poem (Reinhard Dohl, 1965, year from memory); the 3 by 5 capitals of Saccades (pattern round 106), copied from edit-distance.js, pattern round 112
// Round:   112
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Worms=1..4, Appetite=-1..1
//
// Knob 1: Hue. Turns the apples and the worm round the wheel together. At 0 the apples are deep pink (224, 40, 101) and the worm is pale yellow with a near white head; at 0.15 the apples are orange and the worm pale green, at 0.25 lime and mint, at 0.5 mint green and pale blue, at 0.75 blue and pale pink.
// Knob 2: Speed. The crawl rate, 2.5 cells a second for each unit of the knob: 5 at 2, so a cell every 0.2 s, one every 2 s at 0.2 and 7.5 a second at 3. A cell is 4 LEDs across and 6 down. One worm at 5 a second would need 63 s to cross all 315 cells, and in a measured 120 s its head stood on 292 of them, because it keeps off holes and trodden cells. The same knob sets a slow swell of brightness, 12% each way, running down the lines, a period of 5.2 s at 2.
// Knob 3: Worms. How many worms crawl at once, 1 to 4, caught on whole numbers; it opens at 1, the one worm among the apples of the poem. A worm is 4 cells long and keeps off the other worms' cells. At speed 2 and the opening Appetite the field has 13 dark cells on average with one worm, 26 with two, 39 with three and 50 with four (means over 20 s of panel time on four runs each).
// Knob 4: Appetite. How long a cell stays eaten before its letter grows back: 0.5 s times 24 to the power of (knob + 1) / 2, which is 0.5 s at -1, 2.7 s at the opening 0.06 and 12 s at 1, each cell 25% shorter or longer by its own chance. One worm at speed 2 leaves 2.6 dark cells on average at -1, 13 at the opening and 59 at 1. A letter takes 0.8 s to grow back, bottom row first. It stays paler than the apples for about 1.5 s after.

const W = 64, H = 128, N = W * H;
const { floor, min, sin, exp, pow, imul } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The field: 3 words of 5 letters in each of 21 lines, a cell 4 LEDs wide
// (3 for the letter) and 6 high (5 for the letter). The words are 19 LEDs
// across with 3 between them, from column 1 to column 63, and the lines run
// from row 1 to row 125.
const COLS = 15, ROWS = 21, CELLS = COLS * ROWS;
const WORD_X = [1, 23, 45];
const cellX = (col) => WORD_X[(col / 5) | 0] + 4 * (col % 5);
const cellY = (row) => 1 + 6 * row;
const APPLE = "APFEL", WURM = "WURM";

// The capitals, 3 wide and 5 tall, the nine letters of the two words from
// the table in edit-distance.js.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", P: "##.|#.#|##.|#..|#..", F: "###|#..|##.|#..|#..", E: "###|#..|##.|#..|###", L: "#..|#..|#..|#..|###",
  W: "#.#|#.#|###|###|#.#", U: "#.#|#.#|#.#|#.#|###", R: "##.|#.#|##.|#.#|#.#", M: "#.#|###|###|#.#|#.#",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

// The worm's pace and the rest of its timing, in seconds.
const CELLS_PER_SEC = 2.5, GROW = 0.8, ENTER = 14, LEAVE = 16, PRE = 16, TENDER = 1.5;
// How much a worm likes to go straight on, and along a line more than across.
const PERSIST = 2.6, HBIAS = 1.35;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// Hue of the apples at knob 0, and the worm's hue from theirs.
const HUE_APPLE = 0.945, HUE_WORM = 0.225;
// How bright each body cell is, head first.
const SHADE = [1, 0.84, 0.7, 0.58];

export function setup(params) {
  const S = {
    t: 0, ph: 0, hue: 0, speed: 2, hold0: 2.7,
    // For each cell: when the worm's tail left it (eaten), its own chance for how long it stays eaten,
    // when a head last stood on it, which worm and which body cell is on it, the letter it shows and how far it shows it.
    eatAt: new Float32Array(CELLS).fill(-1e6), rf: new Float32Array(CELLS), visit: new Float32Array(CELLS).fill(-1e6),
    occ: new Int8Array(CELLS).fill(-1), ck: new Int8Array(CELLS), wl: new Int8Array(CELLS), wv: new Float32Array(CELLS), sh: new Float32Array(CELLS),
    worms: [], rgb: new Float32Array(N * 3), col: new Float32Array(12),
  };
  for (let i = 0; i < CELLS; i++) S.rf[i] = 0.75 + 0.5 * Math.random();
  params.s = S;
  // The worm has already been at work: it crawls for PRE seconds at 5 cells a
  // second before the first frame, so the poem opens with its trail in it.
  S.t = -PRE;
  spawn(S);
  for (; S.t < -1e-6; S.t += 0.2) if (S.worms.length) step(S, 0);
  S.t = 0;
}

// A worm of 4 cells in a straight line, head first, on cells nothing holds.
function spawn(S) {
  for (let tries = 0; tries < 80; tries++) {
    const horiz = Math.random() < 0.7, sign = Math.random() < 0.5 ? 1 : -1;
    const dx = horiz ? sign : 0, dy = horiz ? 0 : sign;
    const hx = floor(Math.random() * COLS), hy = floor(Math.random() * ROWS);
    const seg = [];
    let ok = true;
    for (let k = 0; k < 4; k++) {
      const x = hx - dx * k, y = hy - dy * k;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS || S.occ[y * COLS + x] >= 0) ok = false;
      else seg.push(y * COLS + x);
    }
    if (!ok) continue;
    const w = { seg, dx, dy, flip: dx > 0, acc: Math.random() * 0.2, rate: 0.9 + 0.2 * Math.random() };
    S.worms.push(w);
    place(S, S.worms.length - 1);
    return;
  }
}

// Mark a worm's cells and the letters they show. The letters run W U R M
// along the body from the end that reads first, so a worm crawling right
// has the M at its head and one crawling left has the W.
function place(S, id) {
  const w = S.worms[id];
  for (let k = 0; k < 4; k++) {
    const c = w.seg[k];
    S.occ[c] = id;
    S.ck[c] = k;
    S.wl[c] = w.flip ? 3 - k : k;
  }
}

// How much a cell is worth stepping on: 1 for a letter that is whole and has
// not been trodden lately, little for a hole, a little more for a letter
// still growing back.
function fresh(S, c) {
  const p = (S.t - S.eatAt[c] - S.hold0 * S.rf[c]) / GROW;
  const state = p >= 1 ? 1 : p >= 0 ? 0.4 : 0.08;
  return state * (0.3 + 0.7 * cl((S.t - S.visit[c]) / 25, 0, 1));
}

// One cell on. It prefers cells it has not been on, looks three cells ahead
// so it turns before a wall or a trail, goes straight more often than it
// turns, and never steps back.
function step(S, id) {
  const w = S.worms[id], head = w.seg[0], hx = head % COLS, hy = (head / COLS) | 0;
  const wts = [0, 0, 0, 0];
  let total = 0;
  for (let d = 0; d < 4; d++) {
    const dx = DIRS[d][0], dy = DIRS[d][1], nx = hx + dx, ny = hy + dy;
    // The tail's cell is free to step into, since the tail moves on as the head arrives.
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS || (S.occ[ny * COLS + nx] >= 0 && ny * COLS + nx !== w.seg[3])) continue;
    let f = 0;
    for (let k = 1; k <= 3; k++) {
      const ax = hx + dx * k, ay = hy + dy * k;
      f += (k === 1 ? 0.5 : k === 2 ? 0.3 : 0.2) * (ax < 0 || ax >= COLS || ay < 0 || ay >= ROWS ? 0.05 : fresh(S, ay * COLS + ax));
    }
    wts[d] = pow(0.12 + f, 2) * (dx === w.dx && dy === w.dy ? PERSIST : 1) * (dx !== 0 ? HBIAS : 1);
    total += wts[d];
  }
  if (total <= 0) return;
  let r = Math.random() * total, d = 0;
  while (d < 3 && r >= wts[d]) (r -= wts[d]), d++;
  const nx = hx + DIRS[d][0], ny = hy + DIRS[d][1], cell = ny * COLS + nx, tail = w.seg[3];
  // The tail leaves its cell, which is eaten from now on.
  S.occ[tail] = -1;
  S.eatAt[tail] = S.t;
  S.rf[tail] = 0.75 + 0.5 * Math.random();
  w.seg.pop();
  w.seg.unshift(cell);
  w.dx = DIRS[d][0];
  w.dy = DIRS[d][1];
  if (w.dx !== 0) w.flip = w.dx > 0;
  S.visit[cell] = S.t;
  place(S, id);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  const want = cl(floor(kv[2] + 0.5), 1, 4);
  S.hold0 = 0.5 * pow(24, (cl(kv[3], -1, 1) + 1) / 2);
  S.t += d;
  S.ph += d * 0.6 * S.speed;
  while (S.worms.length < want) {
    const before = S.worms.length;
    spawn(S);
    if (S.worms.length === before) break;
  }
  while (S.worms.length > want) {
    // The last worm is gone, and its cells are eaten.
    const w = S.worms.pop();
    for (const c of w.seg) (S.occ[c] = -1), (S.eatAt[c] = S.t);
  }
  const every = 1 / (CELLS_PER_SEC * S.speed);
  for (let id = 0; id < S.worms.length; id++) {
    const w = S.worms[id];
    w.acc += d * w.rate;
    let guard = 0;
    while (w.acc >= every && guard++ < 6) {
      w.acc -= every;
      step(S, id);
    }
    if (w.acc > every) w.acc = 0;
  }
  // The weight a cell gives its worm letter against the apple's, and its
  // brightness: quick in as the head comes, slower out as the tail leaves.
  for (let c = 0; c < CELLS; c++) {
    const on = S.occ[c] >= 0;
    S.wv[c] += ((on ? 1 : 0) - S.wv[c]) * min(1, d * (on ? ENTER : LEAVE));
    if (on) S.sh[c] += (SHADE[S.ck[c]] - S.sh[c]) * min(1, d * 14);
  }
}

// A number from 0 to 1 for one pixel of one cell, always the same.
function chance(c, p) {
  let h = imul(c * 16 + p + 1, 0x9e3779b1);
  h ^= h >>> 15;
  h = imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, col = S.col;
  rgb.fill(0);
  const hA = HUE_APPLE + S.hue, hW = hA + HUE_WORM;
  hsv(hA, 0.82, 0.88, col, 0);
  hsv(hW, 0.5, 1, col, 3);
  hsv(hW, 0.14, 1, col, 6);
  hsv(hA, 0.3, 1, col, 9);
  for (let c = 0; c < CELLS; c++) {
    const colN = c % COLS, row = (c / COLS) | 0, x0 = cellX(colN), y0 = cellY(row);
    const A = GLYPH[APPLE[colN % 5]], p = (S.t - S.eatAt[c] - S.hold0 * S.rf[c]) / GROW;
    const wv = S.wv[c], onW = wv > 0.01;
    if (p < 0 && !onW) continue;
    const Wg = onW ? GLYPH[WURM[S.wl[c]]] : null, head = S.occ[c] >= 0 && S.ck[c] === 0;
    // A slow swell of brightness runs down the lines, each line a little behind the one above.
    const swell = 0.88 + 0.12 * sin(S.ph - 0.8 * row - 0.5 * ((colN / 5) | 0));
    for (let gy = 0; gy < 5; gy++)
      for (let gx = 0; gx < 3; gx++) {
        const g = gy * 3 + gx, o = ((y0 + gy) * W + x0 + gx) * 3;
        let r = 0, gg = 0, b = 0;
        if (A[g] && p >= 0) {
          // The letter grows back from its bottom row, each pixel a little
          // out of turn, tender and pale at first and ripening to the
          // apple's own pink over the next second or two.
          const thr = ((4 - gy) / 5) * 0.72 + chance(c, g) * 0.2;
          const vis = p >= 1 ? 1 : cl((p - thr) * 6, 0, 1), m = p >= 1 ? exp((-(p - 1) * GROW) / TENDER) : 1;
          const a = vis * (1 - wv) * swell;
          r += (col[0] + (col[9] - col[0]) * m) * a;
          gg += (col[1] + (col[10] - col[1]) * m) * a;
          b += (col[2] + (col[11] - col[2]) * m) * a;
        }
        if (Wg && Wg[g]) {
          const sh = S.occ[c] >= 0 ? S.sh[c] : SHADE[3] * 0.85;
          const hot = head ? 1 : 0, k = (0.6 + 0.4 * sh) * wv;
          r += (col[3] + (col[6] - col[3]) * hot) * k;
          gg += (col[4] + (col[7] - col[4]) * hot) * k;
          b += (col[5] + (col[8] - col[5]) * hot) * k;
        }
        rgb[o] += r; rgb[o + 1] += gg; rgb[o + 2] += b;
      }
  }
  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
