// ===== Patternflow pattern =====
// Title:   Fifteen Puzzle
// Family:  type
// Idea:    Two fifteen puzzles stand one above the other and take the same slides at the same moment, the top one scrambled from the solved order and the bottom one by the same scramble from Sam Loyd's order with 14 and 15 exchanged, and as a solver brings the top board home row by row the bottom board follows it exactly and ends at 1 to 13, 15, 14, while a number on the empty square of each board, the count of pairs out of order plus how many rows the empty square stands above the bottom, steps down by twos and stays even on top and odd below.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the fifteen puzzle (Noyes Palmer Chapman, 1874; the craze of 1880), the parity proof that half the arrangements cannot be reached (William Woolsey Johnson and William E. Story, American Journal of Mathematics, 1879), Sam Loyd's 14-15 puzzle, pattern round 77
// Round:   77
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Scramble=0..1, Swap=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together: at 0 the tiles are azure, the exchanged pair pink, the count under the top board's empty square green and the one under the bottom board's pink; at 0.33 the tiles are pink and the pair yellow-green, at 0.5 the tiles orange (brown away from home) and the pair teal.
// Knob 2: Speed. Slides a second, twice the knob: 4 at the opening 2, each tile crossing its 16 LEDs in a quarter of a second; 0.4 at 0.2, where every slide can be followed, and 6 at 3. The shuffle between puzzles runs three times as fast, between 6 and 14 slides a second.
// Knob 3: Scramble. How many random slides mix the boards before each solve: 40 at the opening 0, which the solver takes 38 to 94 slides to undo (68 as a rule, 17 s at the opening speed); 120 at 1, where a solve takes 66 to 110 (90). The solver's way home is longer than the scramble because it places the tiles in its own order. A turn takes effect at the next shuffle.
// Knob 4: Swap. Which two numbers the bottom board has exchanged, in five steps: 14 and 15 (Loyd's) at the opening, then 1 and 2, 8 and 12, 4 and 13, and 1 and 15. The pair is pink on both boards; whatever the solver does, the bottom board ends with the pair crossed and its number at 1, 1, 7, 17 or 27, never 0.

// The fifteen puzzle has 16! / 2 arrangements anyone can reach and as many
// that nobody can. Johnson and Story proved it in 1879 in the second volume
// of the American Journal of Mathematics. Read the tiles row by row, skip
// the empty square, and count the pairs that stand in the wrong order: the
// inversions. A slide along a row changes nothing in that reading. A slide
// up or down lifts one tile past the three others between its two cells,
// which changes the count by 1 or 3, and moves the empty square one row.
// So the inversions plus the empty square's height above the bottom row
// change by an even number at every slide, and their parity never changes.
// The solved board has 0 and 0. Loyd's board, solved with 14 and 15
// exchanged, has one inversion and the empty square at the bottom: odd. It
// can be brought to 1 to 13, 15, 14 and no closer. Story showed the other
// half: every arrangement with the even parity can be reached.
//
// The panel is two boards of 16 tiles 16 LEDs square, the top one 0 to 63
// and the bottom one 64 to 127. A move is the cell the empty square goes
// to; both boards take every move. The bottom board is drawn as the top
// board with the pair's labels exchanged, and that is the same thing as
// playing the same moves from the exchanged start: moves act on cells, not
// on labels. The number on each empty square is its board's inversions plus
// its height. On top it walks down through even numbers to 0, below through
// odd ones to the pair's own count, 1 for Loyd's.
//
// The solve is a real search, not the scramble undone. The top board is
// solved in nine steps, the usual order a person learns: tile 1, tile 2,
// tiles 3 and 4 together, 5, 6, 7 and 8, then the left column (9 and 13),
// the next one (10 and 14), and the last 2 by 2 corner. Each step is a
// breadth-first search over the cells of the tiles it places and of the
// empty square, the placed tiles fixed and the others anonymous, so each
// step is as short as it can be (the whole is not). At most 16^4 states.
// Tiles in their own cells are lit; tiles away from home are dim. When the
// top board arrives it flashes, and the bottom board's pair blinks. Then
// the next scramble plays in view, three times as fast: a random walk of
// the empty square that never steps straight back.

const W = 64, H = 128, C = 16;
const { floor, min, max, round, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => u * u * (3 - 2 * u);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// Tile figures, 5 by 9 and drawn for this pattern; the 1 is 3 wide, so the
// six two-figure numbers are 9 LEDs wide on a 14 LED face.
const BIG = [
  ".###. #...# #...# #...# #...# #...# #...# #...# .###.",
  ".#. ##. .#. .#. .#. .#. .#. .#. ###",
  ".###. #...# ....# ....# ...#. ..#.. .#... #.... #####",
  ".###. #...# ....# ....# ..##. ....# ....# #...# .###.",
  "...#. ..##. .#.#. #..#. #..#. ##### ...#. ...#. ...#.",
  "##### #.... #.... ####. ....# ....# ....# #...# .###.",
  "..##. .#... #.... ####. #...# #...# #...# #...# .###.",
  "##### ....# ...#. ...#. ..#.. ..#.. .#... .#... .#...",
  ".###. #...# #...# #...# .###. #...# #...# #...# .###.",
  ".###. #...# #...# #...# .#### ....# ....# ...#. .##..",
].map((g) => g.split(" "));
// The count under the empty square, 3 by 5.
const SMALL = [
  "### #.# #.# #.# ###", ".#. ##. .#. .#. ###", "### ..# ### #.. ###", "### ..# .## ..# ###", "#.# #.# ### ..# ..#",
  "### #.. ### ..# ###", "### #.. ### #.# ###", "### ..# ..# .#. .#.", "### #.# ### #.# ###", "### #.# ### ..# ###",
].map((g) => g.split(" "));

const SWAPS = [[14, 15], [1, 2], [8, 12], [4, 13], [1, 15]];
const GROUPS = [[1], [2], [3, 4], [5], [6], [7, 8], [9, 13], [10, 14], [11, 12, 15]];
const NB = [];
for (let c = 0; c < 16; c++) {
  const r = c >> 2, k = c & 3, a = [];
  if (r > 0) a.push(c - 4);
  if (r < 3) a.push(c + 4);
  if (k > 0) a.push(c - 1);
  if (k < 3) a.push(c + 1);
  NB.push(a);
}

const SEEN = new Uint8Array(65536), PAR = new Int32Array(65536), Q = new Int32Array(65536);

// The nine searches. A state is the empty square's cell and the cells of
// the step's tiles, four bits each.
function solve(board) {
  const b = Int8Array.from(board), moves = [], locked = new Uint8Array(16);
  for (const g of GROUPS) {
    const m = g.length;
    let start = b.indexOf(0), want = 0;
    for (let i = 0; i < m; i++) {
      start |= b.indexOf(g[i]) << (4 + 4 * i);
      want |= (g[i] - 1) << (4 + 4 * i);
    }
    const mask = ((1 << (4 * m)) - 1) << 4;
    SEEN.fill(0);
    let head = 0, tail = 0, goal = -1;
    Q[tail++] = start;
    SEEN[start] = 1;
    PAR[start] = -1;
    while (head < tail) {
      const k = Q[head++];
      if ((k & mask) === want) {
        goal = k;
        break;
      }
      const e = k & 15;
      for (const n of NB[e]) {
        if (locked[n]) continue;
        let k2 = n;
        for (let i = 0; i < m; i++) {
          const p = (k >> (4 + 4 * i)) & 15;
          k2 |= (p === n ? e : p) << (4 + 4 * i);
        }
        if (!SEEN[k2]) {
          SEEN[k2] = 1;
          PAR[k2] = k;
          Q[tail++] = k2;
        }
      }
    }
    if (goal < 0) break;
    const path = [];
    for (let k = goal; PAR[k] !== -1; k = PAR[k]) path.push(k & 15);
    for (let j = path.length - 1; j >= 0; j--) {
      const n = path[j], e = b.indexOf(0);
      b[e] = b[n];
      b[n] = 0;
      moves.push(n);
    }
    for (const t of g) locked[t - 1] = 1;
  }
  return moves;
}

// A random walk of the empty square that never steps straight back.
function scramble(b, k) {
  let e = b.indexOf(0), prev = -1;
  const mv = [];
  for (let i = 0; i < k; i++) {
    const opts = NB[e].filter((n) => n !== prev);
    const n = opts[floor(Math.random() * opts.length) % opts.length];
    mv.push(n);
    prev = e;
    e = n;
  }
  return mv;
}

function apply(b, n) {
  const e = b.indexOf(0);
  b[e] = b[n];
  b[n] = 0;
}

// Inversions of the 15 tiles read row by row, plus the empty square's
// height above the bottom row; lab exchanges a pair's labels first.
function parityCount(b, pa, pb) {
  let inv = 0, e = 0;
  const lab = (v) => (v === pa ? pb : v === pb ? pa : v);
  for (let i = 0; i < 16; i++) {
    const vi = lab(b[i]);
    if (!vi) {
      e = i;
      continue;
    }
    for (let j = i + 1; j < 16; j++) {
      const vj = lab(b[j]);
      if (vj && vj < vi) inv++;
    }
  }
  return inv + 3 - (e >> 2);
}

export function setup(params) {
  params.s = {
    b: Int8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]),
    phase: "init", list: [], i: 0, u: 0, timer: 0, t: 0, hue: 0, rate: 4, k: 40, sw: 0,
    buf: new Float32Array(W * H * 3), c0: [0, 0, 0], c1: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  S.rate = 2 * cl(kv[1] == null ? 2 : kv[1], 0.2, 3);
  S.k = round(40 + 80 * cl(kv[2] || 0, 0, 1));
  S.sw = min(SWAPS.length - 1, floor(cl(kv[3] == null ? 0.06 : kv[3], 0, 1) * SWAPS.length));
  S.t += d;
  if (S.phase === "init") {
    for (const n of scramble(S.b, S.k)) apply(S.b, n);
    S.list = solve(S.b);
    S.phase = "wait";
    S.timer = 0.5;
  }
  if (S.phase === "wait") {
    S.timer -= d;
    if (S.timer <= 0) {
      S.phase = "solve";
      S.i = 0;
      S.u = 0;
    }
  } else if (S.phase === "solve" || S.phase === "mix") {
    S.u += d * (S.phase === "mix" ? cl(3 * S.rate, 6, 14) : S.rate);
    while (S.u >= 1 && S.i < S.list.length) {
      apply(S.b, S.list[S.i++]);
      S.u -= 1;
    }
    if (S.i >= S.list.length) {
      S.u = 0;
      if (S.phase === "solve") {
        S.phase = "cheer";
        S.timer = 2.4;
      } else {
        S.list = solve(S.b);
        S.phase = "wait";
        S.timer = 0.7;
      }
    }
  } else if (S.phase === "cheer") {
    S.timer -= d;
    if (S.timer <= 0) {
      S.phase = "mix";
      S.list = scramble(S.b, S.k);
      S.i = 0;
      S.u = 0;
    }
  }
}

function put(buf, x, y, c, f) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = c[0] * f;
  buf[o + 1] = c[1] * f;
  buf[o + 2] = c[2] * f;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { buf, b, c0, c1 } = S, hT = 0.58 + S.hue, hP = hT + 0.33, [pa, pb] = SWAPS[S.sw];
  const sliding = (S.phase === "solve" || S.phase === "mix") && S.i < S.list.length;
  const from = sliding ? S.list[S.i] : -1, to = sliding ? b.indexOf(0) : -1, u = sliding ? ease(S.u) : 0;
  // The empty square after this slide, and the boards' two counts there.
  const after = Int8Array.from(b);
  if (sliding) apply(after, from);
  const hole = after.indexOf(0);
  const cheer = S.phase === "cheer" ? 2.4 - S.timer : -1;

  // The trays: dark, with a frame round each board.
  const tray = hsv(hT, 0.5, 0.05, [0, 0, 0]), rim = hsv(hT, 0.35, 0.22, [0, 0, 0]);
  for (let y = 0; y < H; y++) {
    const yb = y & 63;
    for (let x = 0; x < W; x++) put(buf, x, y, x === 0 || x === W - 1 || yb === 0 || yb === 63 ? rim : tray, 255);
  }

  for (let board = 0; board < 2; board++) {
    const oy = board * 64;
    // The count, under the empty square.
    const n = board ? parityCount(after, pa, pb) : parityCount(after, 0, 0);
    hsv(board ? hP : hT - 0.25, 0.65, sliding ? 0.75 * u : 0.75, c0);
    const s = String(n), hx = (hole & 3) * C, hy = oy + (hole >> 2) * C, tw = s.length * 4 - 1;
    for (let j = 0; j < s.length; j++) {
      const g = SMALL[+s[j]];
      for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r][q] === "#") put(buf, hx + 8 - (tw >> 1) + 4 * j + q, hy + 6 + r, c0, 255);
    }

    for (let cell = 0; cell < 16; cell++) {
      const top = b[cell];
      if (!top) continue;
      const lab = board && top === pa ? pb : board && top === pb ? pa : top;
      const moving = cell === from;
      const cx = cell & 3, cy = cell >> 2;
      let px = cx * C, py = cy * C, home = lab === cell + 1 ? 1 : 0;
      if (moving) {
        px = round(px + ((to & 3) - cx) * C * u);
        py = round(py + ((to >> 2) - cy) * C * u);
        home = home * (1 - u) + (lab === to + 1 ? u : 0);
      }
      py += oy;
      const pair = lab === pa || lab === pb;
      let v = 0.4 + 0.5 * home, sat = 0.62 - 0.12 * home, white = 0;
      if (cheer >= 0) {
        if (!board) {
          const w = cheer - 0.08 * (cx + cy);
          white = w > 0 && w < 0.7 ? 0.6 * Math.sin((PI * w) / 0.7) : 0;
        } else if (pair) {
          const blink = 0.5 + 0.5 * cos(2 * PI * 2.5 * cheer);
          v = 0.25 + 0.75 * blink;
          sat = 0.75 - 0.5 * blink;
        }
      }
      hsv(pair ? hP : hT, sat, v, c0);
      for (let i = 0; i < 3; i++) c0[i] = c0[i] + (1 - c0[i]) * white;
      // Face 14 by 14 with a one-LED bevel, figures cut dark into it.
      for (let y = 1; y < 15; y++)
        for (let x = 1; x < 15; x++) {
          const f = y === 1 || x === 1 ? 1.35 : y === 14 || x === 14 ? 0.55 : 1;
          c1[0] = min(1, c0[0] * f);
          c1[1] = min(1, c0[1] * f);
          c1[2] = min(1, c0[2] * f);
          put(buf, px + x, py + y, c1, 255);
        }
      const s2 = String(lab), wd = s2.length === 1 ? BIG[lab][0].length : 3 + 1 + BIG[lab - 10][0].length;
      let x0 = px + 1 + ((14 - wd + 1) >> 1);
      for (let j = 0; j < s2.length; j++) {
        const g = BIG[+s2[j]];
        for (let r = 0; r < 9; r++) for (let q = 0; q < g[r].length; q++) if (g[r][q] === "#") put(buf, x0 + q, py + 3 + r, c0, 255 * 0.1);
        x0 += g[0].length + 1;
      }
    }
  }
  for (let p = 0, o = 0; p < W * H; p++, o += 3) display.setPixel(p % W, (p / W) | 0, round(buf[o]), round(buf[o + 1]), round(buf[o + 2]));
}
