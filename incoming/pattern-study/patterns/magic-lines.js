// ===== Patternflow pattern =====
// Title:   Magic Lines
// Family:  number
// Idea:    One line runs through the cells of a magic rectangle or square in the order 1, 2, 3 and on, a step at a time, lighting each cell as it arrives, so the arithmetic comes out as an ornament with the grid's own symmetry: at the opening an 8 by 16 magic rectangle fills the panel and its line runs through 1 to 128 into a tall burst, and turned up the knob two squares stand one above the other and take turns, those up to order 5 with their numbers written into the cells.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: magic lines (Claude Bragdon, Projective Ornament, 1915); the Siamese method for odd orders (Simon de la Loubère, 1693); Albrecht Dürer's 4 by 4 square in Melencolia I (1514); the 4 by 4 square at the Parshvanatha temple, Khajuraho (10th century); John Horton Conway's LUX method for orders 4m + 2; magic rectangles, which exist whenever the two sides have the same parity, 2 by 2 apart (Thomas Harmuth, 1881); pattern round 100
// Round:   100
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Order=0..7, Fade=0..1
//
// Knob 1: Hue. Turns the line's colours round the wheel. At 0 the line starts teal at the cell holding 1 and runs through azure and violet to magenta at the last cell, so the finished figure shows which way it was drawn; at 0.5 it runs from red through orange and yellow to green.
// Knob 2: Speed. At 2 the rectangle's 128 cells take 15.2 s to draw, the 3 by 3 square 3.3 s (0.41 s a number), the 4 by 4 squares 4 s and the 8 by 8 squares 8.8 s, with a rest of 3 s after a rectangle and 1.2 s after a square; every time goes as 2 / Speed.
// Knob 3: Order. 0 the 8 by 16 rectangle over the whole panel (two doubly even rectangles and two laced ones in turn), then squares two at a time: 1 the 3 by 3 Lo Shu, 2 three 4 by 4 squares in turn (Dürer's, the doubly even rule's, Khajuraho's), 3 order 5 and 5 order 7 (the Siamese square, then a knight's-step square), 4 order 6 and 7 order 10 (Conway's LUX), 6 order 8 (two doubly even squares). Each time its list comes round, the next square is turned or mirrored by the next of the square's eight symmetries, the rectangle's by the next of its four.
// Knob 4: Fade. How long each piece of line stays once drawn. At 0 and at the opening 0.06 a figure stays whole until the one that replaces it starts and then goes dark in 0.8 s; at 0.5 a piece of the rectangle's line lasts 41 steps (5 s) and a piece of the Lo Shu's 12; at 1 only the last 2.5 steps stay and the pen is a short comet.

// A magic square of order n holds 1 to n^2 once each, and every row,
// every column and both diagonals add up to n (n^2 + 1) / 2. Bragdon drew
// a line from the centre of the cell holding 1 to the cell holding 2, then
// to 3, and on to n^2, and offered the figures as a source of ornament.
// The symmetry of the square comes out in the line: in Dürer's square the
// cells holding k and 17 - k sit opposite each other through the centre,
// so the step from k to k + 1 has a twin, from 17 - k to 16 - k, turned
// half round, and the whole figure is symmetric under the half turn.
//
// The squares here are built, except Dürer's and Khajuraho's, which are
// copied from their sources:
//
// Siamese (de la Loubère): 1 in the middle of the top row, each next
// number one up and one right, wrapping round the edges, and one down
// instead whenever that cell is taken. The line is n slanted runs joined
// by short drops, with long jumps where the wrap carries it across.
// Knight's step: each number two up and one right of the one before,
// wrapping, and after every n numbers a break move of one up and one left
// (order 5) or one up and three right (order 7). Those two squares are
// pandiagonal: the broken diagonals add up too, as Khajuraho's do.
// Doubly even rule (orders 4 and 8): write 1 to n^2 in reading order, then
// replace k by n^2 + 1 - k on the two diagonals of every 4 by 4 block. The
// second order-8 square conjugates it by the permutation 0 2 1 3 4 6 5 7
// of rows and columns, which keeps both diagonals and moves the line.
// Dürer's is the 4 by 4 one of these with its two middle columns swapped.
// LUX (Conway, orders 6 and 10, n = 4m + 2): take the Siamese square of
// order 2m + 1, mark its first m + 1 rows L, the next U and the rest X,
// swap the middle U with the L above it, and fill each cell as a 2 by 2
// block with 4k - 3 to 4k in the letter's order: L 4 1 / 2 3, U 1 4 / 2 3,
// X 1 4 / 3 2.
//
// The rectangle has 16 rows of 8, so every row adds up to 516 and every
// column to 1032. The doubly even rule works on it as it stands, since
// both sides are multiples of 4: k and 129 - k again sit opposite through
// the centre, and the line is a burst through the middle of the panel with
// the half-turn symmetry. The third rectangle conjugates it by 0 2 1 3 ...
// on rows and columns. The laced ones put 16 A + B + 1 in each cell, A the
// column in even rows and 7 minus the column in odd rows, B the row in
// columns 0, 2, 5 and 7 and 15 minus the row in the others, so each row
// holds every A once and each column every B once. Their line zigzags down
// between columns 0 and 7, back up between 1 and 6, and on; the fourth
// moves the columns so the four zigzags stand side by side.
//
// check() runs over every square and rectangle in setup. It asserts that
// the cells hold 1 to N once each, that every row and every column has the
// magic sum, and for squares both diagonals too; anything that failed
// would be dropped from its list. All 16 built here pass. The three
// pandiagonal squares were checked on their broken diagonals while the
// pattern was made, not at run time.

const W = 64, H = 128;
const { floor, round, min, max, sqrt, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- The constructions. A grid is an array of rows of numbers.
function siamese(n) {
  const a = Array.from({ length: n }, () => new Array(n).fill(0));
  let r = 0, c = (n - 1) >> 1;
  for (let k = 1; k <= n * n; k++) {
    a[r][c] = k;
    const nr = (r + n - 1) % n, nc = (c + 1) % n;
    if (a[nr][nc]) r = (r + 1) % n;
    else { r = nr; c = nc; }
  }
  return a;
}
// k - 1 = n A + B goes to (A p + B q) mod n from the cell of 1 at (0, c0).
function step(n, q, p, c0) {
  const a = Array.from({ length: n }, () => new Array(n).fill(0));
  const m = (v) => ((v % n) + n) % n;
  for (let k = 0; k < n * n; k++) {
    const A = floor(k / n), B = k % n;
    a[m(p[0] * A + q[0] * B)][m(c0 + p[1] * A + q[1] * B)] = k + 1;
  }
  return a;
}
// n columns, m rows; rp and cp permute the rows and columns read.
function doublyEven(n, m, rp, cp) {
  const a = [];
  for (let r = 0; r < m; r++) {
    a.push([]);
    for (let c = 0; c < n; c++) {
      const R = rp ? rp[r] : r, C = cp ? cp[c] : c, k = R * n + C + 1, i = R % 4, j = C % 4;
      a[r].push(i === j || i + j === 3 ? n * m + 1 - k : k);
    }
  }
  return a;
}
function lux(n) {
  const m = (n - 2) / 4, h = 2 * m + 1, s = siamese(h);
  const L = [4, 1, 2, 3], U = [1, 4, 2, 3], X = [1, 4, 3, 2];
  const a = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let r = 0; r < h; r++)
    for (let c = 0; c < h; c++) {
      let t = r <= m ? L : r === m + 1 ? U : X;
      if (c === m && r === m) t = U;
      if (c === m && r === m + 1) t = L;
      const base = 4 * (s[r][c] - 1);
      for (let i = 0; i < 4; i++) a[2 * r + (i >> 1)][2 * c + (i & 1)] = base + t[i];
    }
  return a;
}
// Column j of the plain rectangle goes to column at[j].
function rectangle(S, at) {
  const a = [];
  for (let i = 0; i < 16; i++) {
    a.push(new Array(8));
    for (let j = 0; j < 8; j++) a[i][at[j]] = 16 * (i % 2 ? 7 - j : j) + (S.includes(j) ? i : 15 - i) + 1;
  }
  return a;
}
const DURER = [[16, 3, 2, 13], [5, 10, 11, 8], [9, 6, 7, 12], [4, 15, 14, 1]];
const KHAJURAHO = [[7, 12, 1, 14], [2, 13, 8, 11], [16, 3, 10, 5], [9, 6, 15, 4]];

// Rows, columns, the numbers 1..N once each, and for a square both diagonals.
function check(a) {
  const R = a.length, C = a[0].length, N = R * C, seen = new Uint8Array(N + 1);
  for (const row of a) for (const v of row) {
    if (v < 1 || v > N || seen[v]) return false;
    seen[v] = 1;
  }
  const rs = (C * (N + 1)) / 2, cs = (R * (N + 1)) / 2;
  for (const row of a) if (row.reduce((x, y) => x + y, 0) !== rs) return false;
  for (let c = 0; c < C; c++) {
    let t = 0;
    for (let r = 0; r < R; r++) t += a[r][c];
    if (t !== cs) return false;
  }
  if (R === C) {
    let d1 = 0, d2 = 0;
    for (let i = 0; i < R; i++) { d1 += a[i][i]; d2 += a[i][R - 1 - i]; }
    if (d1 !== rs || d2 !== rs) return false;
  }
  return true;
}

const P8 = [0, 2, 1, 3, 4, 6, 5, 7], P16 = [0, 2, 1, 3, 4, 6, 5, 7, 8, 10, 9, 11, 12, 14, 13, 15];
function orders() {
  const list = [
    [doublyEven(8, 16), rectangle([0, 7, 2, 5], [0, 1, 2, 3, 4, 5, 6, 7]), doublyEven(8, 16, P16, P8), rectangle([0, 7, 2, 5], [0, 2, 4, 6, 7, 5, 3, 1])],
    [siamese(3)],
    [DURER, doublyEven(4, 4), KHAJURAHO],
    [siamese(5), step(5, [-2, 1], [1, 3], 2)],
    [lux(6)],
    [siamese(7), step(7, [-2, 1], [1, 2], 3)],
    [doublyEven(8, 8), doublyEven(8, 8, P8, P8)],
    [lux(10)],
  ];
  return list.map((l) => l.filter(check));
}

// The eight symmetries of the square, applied to cell (r, c) of order n.
const SYM = [
  (r, c) => [r, c], (r, c, n) => [r, n - 1 - c], (r, c, n) => [n - 1 - r, n - 1 - c], (r, c, n) => [n - 1 - r, c],
  (r, c) => [c, r], (r, c, n) => [c, n - 1 - r], (r, c, n) => [n - 1 - c, n - 1 - r], (r, c, n) => [n - 1 - c, r],
];

// Seconds at Speed 2: drawing takes 2.4 + 0.1 N, then a rest, longer for
// the rectangle, which has no twin to look at meanwhile.
const REST = 1.2, REST_RECT = 3, LIFE_MIN = 2.5;

// 3 by 5 figures, rows top to bottom, 4 is the left column.
const DIG = [[7, 5, 5, 5, 7], [2, 6, 2, 2, 7], [7, 1, 7, 4, 7], [7, 1, 7, 1, 7], [5, 5, 7, 1, 1], [7, 4, 7, 1, 7], [7, 4, 7, 5, 7], [7, 1, 2, 2, 2], [7, 5, 7, 5, 7], [7, 5, 7, 1, 7]];

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  params.s = { lists: orders(), order: -1, g: 0, figs: [], next: 0, hue: 0, fade: 0.06, buf: new Float32Array(W * H * 3), c: [0, 0, 0] };
}

// Figure s of the current order: which grid, which symmetry, where. The
// rectangle turns through its four symmetries, a square through eight.
function figure(S, s, B) {
  const list = S.lists[S.order], grid = list[s % list.length], R = grid.length, C = grid[0].length, N = R * C;
  const rect = R !== C, sym = SYM[(floor(s / list.length) % (rect ? 4 : 8))];
  const frame = rect ? 0 : s % 2;
  // Squares sit in 60 by 60 inside each 64 by 64 half; the rectangle's
  // cells are 8 LEDs.
  const cell = rect ? 8 : 60 / R, x0 = rect ? 0 : 2, y0 = rect ? 0 : 2 + 64 * frame;
  const pos = new Float32Array(2 * N), box = [];
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++) {
      const [rr, cc] = rect ? [sym(r, 0, R)[0], sym(0, c, C)[1]] : sym(r, c, R);
      const k = grid[r][c] - 1;
      pos[2 * k] = x0 + (cc + 0.5) * cell;
      pos[2 * k + 1] = y0 + (rr + 0.5) * cell;
      box[k] = [x0 + cc * cell, y0 + rr * cell];
    }
  return { s, B, N, R, pos, box, cell, frame, end: B + N - 1 };
}

function begin(S, order) {
  S.order = order;
  const g0 = S.lists[order][0], N = g0.length * g0[0].length;
  S.N = N;
  S.R = g0.length;
  S.twin = g0.length === g0[0].length;
  S.stepSec = (2.4 + 0.1 * N) / (N - 1);
  S.rest = (S.twin ? REST : REST_RECT) / S.stepSec;
  // Open with the first square finished above and the second a third
  // drawn below, or the rectangle with its first 15 steps drawn.
  S.figs = [figure(S, 0, 0)];
  S.next = 1;
  if (S.twin) {
    const a = S.figs[0];
    S.figs.push(figure(S, S.next++, a.end + S.rest));
    S.g = a.end + S.rest + 0.35 * (N - 1);
  } else S.g = 0.12 * (N - 1);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const order = round(cl(k[2] || 0, 0, 7));
  S.fade = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  if (order !== S.order) begin(S, order);
  S.g += (d * speed) / 2 / S.stepSec;
  const last = S.figs[S.figs.length - 1];
  if (S.g >= last.end + S.rest) {
    S.figs.push(figure(S, S.next++, last.end + S.rest));
    while (S.figs.length > 3) S.figs.shift();
  }
}

// Max-blend a disc or a thick segment into the buffer.
function seg(buf, x0, y0, x1, y1, w, c) {
  const r = w / 2 + 0.5;
  const lx = max(0, floor(min(x0, x1) - r)), hx = min(W - 1, floor(max(x0, x1) + r));
  const ly = max(0, floor(min(y0, y1) - r)), hy = min(H - 1, floor(max(y0, y1) + r));
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9;
  for (let y = ly; y <= hy; y++)
    for (let x = lx; x <= hx; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0;
      const u = cl((px * dx + py * dy) / L2, 0, 1), ex = px - u * dx, ey = py - u * dy;
      const f = cl(r - sqrt(ex * ex + ey * ey), 0, 1);
      if (f <= 0) continue;
      const i = (y * W + x) * 3;
      if (buf[i] < c[0] * f) buf[i] = c[0] * f;
      if (buf[i + 1] < c[1] * f) buf[i + 1] = c[1] * f;
      if (buf[i + 2] < c[2] * f) buf[i + 2] = c[2] * f;
    }
}
function put(buf, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  for (let j = 0; j < 3; j++) if (buf[i + j] < c[j] * a) buf[i + j] = c[j] * a;
}
// A number with its top left corner at (x, y).
function number(buf, v, x, y, sc, c, a) {
  const s = String(v), x0 = round(x), y0 = round(y);
  for (let d = 0; d < s.length; d++) {
    const g = DIG[s.charCodeAt(d) - 48];
    for (let ry = 0; ry < 5 * sc; ry++)
      for (let rx = 0; rx < 3 * sc; rx++) if (g[floor(ry / sc)] & (4 >> floor(rx / sc))) put(buf, x0 + d * 4 * sc + rx, y0 + ry, c, a);
  }
}

const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

export function draw(display, params) {
  const S = params.s;
  if (!S || S.order < 0) return;
  const buf = S.buf, c = S.c, g = S.g, N = S.N;
  buf.fill(0);
  // A piece of line lives life steps after it is drawn and dims over the
  // last ramp of them: at Fade 0 a quarter longer than it takes the square
  // that replaces it to start, 2.5 steps at 1.
  const span = 1.25 * ((S.twin ? 2 : 1) * (N - 1 + S.rest) + 2), out = max(2, 0.8 / S.stepSec);
  const life = span * (LIFE_MIN / span) ** (S.fade ** 1.5), ramp = life * (0.1 + 0.5 * S.fade);
  const wgt = (age) => (age < 0 ? 0 : cl((life - age) / ramp, 0, 1));
  const lineW = S.twin ? [0, 0, 0, 3, 2.6, 2.2, 2, 1.9, 1.8, 1.7, 1.5][S.R] : 1.5;
  const digits = S.twin && S.R <= 5, sc = S.R <= 3 ? 2 : 1;
  for (const F of S.figs) {
    // A figure goes dark in 0.8 s (2 steps at least) once the next one
    // starts in its frame.
    let gone = 1;
    for (const G of S.figs) if (G.s > F.s && G.frame === F.frame) gone = min(gone, 1 - cl((g - G.B) / out, 0, 1));
    if (gone <= 0) continue;
    const now = g - F.B;
    // Lattice dots while the square is drawing.
    if (now < N) {
      const a = 0.16 * gone;
      for (let k = 0; k < N; k++) {
        hsv(S.hue + 0.5 + (0.32 * k) / (N - 1), 0.5, 1, c);
        put(buf, floor(F.pos[2 * k]), floor(F.pos[2 * k + 1]), c, a);
      }
    }
    // Cells light as the pen reaches them, and a square's keep a faint fill.
    for (let k = 0; k < N; k++) {
      const age = now - k;
      if (age < 0) break;
      const v = wgt(age) * gone;
      if (v <= 0) continue;
      const flash = exp(-age / 1.2);
      hsv(S.hue + 0.5 + (0.32 * k) / (N - 1), 0.85, 1, c);
      const a = ((S.twin ? 0.1 : 0) + 0.32 * flash) * v, cs = F.cell, bx = F.box[k][0], by = F.box[k][1];
      for (let y = round(by) + 1; y < round(by + cs); y++) for (let x = round(bx) + 1; x < round(bx + cs); x++) put(buf, x, y, c, a);
      if (digits) {
        hsv(S.hue + 0.5 + (0.32 * k) / (N - 1), 0.35, 1, c);
        number(buf, k + 1, bx + 2, by + 2, sc, c, (0.35 + 0.5 * flash) * v);
      }
    }
    // The line, segment k from cell k + 1 to cell k + 2.
    for (let k = 0; k < N - 1; k++) {
      const age = now - k - 1;
      if (age < -1) break;
      const x0 = F.pos[2 * k], y0 = F.pos[2 * k + 1];
      let x1 = F.pos[2 * k + 2], y1 = F.pos[2 * k + 3];
      if (age < 0) {
        const u = smooth(age + 1);
        x1 = x0 + (x1 - x0) * u;
        y1 = y0 + (y1 - y0) * u;
        hsv(S.hue + 0.5 + (0.32 * k) / (N - 1), 0.2, 1, c);
        seg(buf, x1, y1, x1, y1, lineW * 1.9, c);
      }
      // The newest pieces glow pale and settle to their colour in 1.5 steps.
      const fresh = age < 0 ? 1 : exp(-age / 1.5), v = (age < 0 ? 1 : wgt(age)) * gone * (0.78 + 0.22 * fresh);
      if (v <= 0) continue;
      hsv(S.hue + 0.5 + (0.32 * (k + 0.5)) / (N - 1), 0.8 - 0.5 * fresh, v, c);
      seg(buf, x0, y0, x1, y1, lineW, c);
    }
  }
  for (let p = 0, i = 0; p < W * H; p++, i += 3)
    display.setPixel(p & 63, p >> 6, round(cl(buf[i], 0, 1) * 255), round(cl(buf[i + 1], 0, 1) * 255), round(cl(buf[i + 2], 0, 1) * 255));
}
