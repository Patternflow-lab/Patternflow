// ===== Patternflow pattern =====
// Title:   Rod Numerals
// Family:  type
// Idea:    The panel is a counting board of four place columns and three rows on which a multiplication runs the way the Sunzi Suanjing sets it out, multiplier on the top row, multiplicand on the bottom row with its last figure under the multiplier's first, the product growing in the middle row one pair of figures at a time, each used figure of the multiplier taken away and the multiplicand stepping one place right, and every figure is rods, upright in the units and hundreds and lying in the tens and thousands, so a figure that steps one place turns each of its rods a quarter turn on the way, while a zero is a place left dark.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: counting-rod numerals and multiplication on the counting board (Sunzi Suanjing, Master Sun's Mathematical Manual, about the 3rd to 5th century); red rods for positive numbers and black for negative (Liu Hui, commentary on the Nine Chapters, 263); rods drawn for this pattern, pattern round 83
// Round:   83
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Problem=0..1, Sign=0..1
//
// Knob 1: Hue. The rods' colour, and opposite it on the wheel the dim colour of the cells that hold them. At 0 pale gold rods on navy cells; at 0.88 the rods are red, Liu Hui's colour for positive numbers, on dim cyan.
// Knob 2: Speed. At 2 each step on the board takes 1.3 s, so 81 x 81 goes from an empty board to 6561 standing alone in 11.3 s, which stands 3.2 s before the board clears; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Problem. Which multiplication the board starts on, a fifth of the knob each: 81 x 81 = 6561, Sunzi's own; 64 x 128 = 8192, this panel; 45 x 89 = 4005, two empty places; 365 x 7 = 2555, where the lone 7 steps right twice, upright, lying and upright again; 99 x 99 = 9801. After each answer the board clears and goes on to the next one.
// Knob 4: Sign. Which numbers are negative, a quarter of the knob each: none, the multiplier, the multiplicand, both. A negative number is black rods, drawn as rods cut out of brightly lit cells since a black rod cannot shine, and the product turns black when exactly one of the two is.

// Counting rods. The Sunzi Suanjing starts its arithmetic with where a
// figure stands: units upright, tens lying, hundreds standing, thousands
// lying, so two neighbouring figures never run together, and an empty
// place is zero. One to five are that many rods side by side. From six a
// single rod laid across the others counts five, since, in Sunzi's words,
// six is not heaped and five does not stand alone. Upright figures put the
// five rod across their top; lying figures stand it on top of theirs.
//
// Multiplication on the board. The multiplier goes on the top row and the
// multiplicand on the bottom row, moved left until its last figure is
// under the multiplier's first. The multiplier's first figure times each
// figure of the multiplicand, left to right, is added into the middle row
// over that figure, carrying as it goes. Then that figure of the
// multiplier is taken away, the whole multiplicand steps one place right,
// and the next figure of the multiplier does the same. When the last is
// used the multiplicand is taken away and the middle row is the product.
//
// Each board along the way is worked out once. Between two boards every
// rod is matched to its namesake on the next one, a figure keeping its
// name as it steps across, so a rod that stays slides and turns, a new one
// slides in and an old one slides off.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sin, cos, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => u * u * (3 - 2 * u);

// Rods are L LEDs long and T thick, laid P apart side by side.
const L = 12, T = 2, P = 3;
// Four place columns 16 LEDs wide, units on the right, ruled at x = 16, 32
// and 48; three rows 42 LEDs tall, ruled at y = 42 and 85.
const COLS = 4, CW = 16, ROWS = [21, 64, 107], RULE_Y = [42, 85];
const PROBLEMS = [
  [81, 81], // Sunzi's own: 6561
  [64, 128], // this panel: 8192
  [45, 89], // 4005, two empty places
  [365, 7], // 2555, the 7 steps right twice
  [99, 99], // 9801
];
// Seconds (at Speed 2) each kind of step lasts. The rods move in the
// first half of it, for 0.65 s at most, and rest for the rest.
const DUR = { empty: 0.6, set: 1.4, mul: 1.3, drop: 0.9, shift: 1.3, done: 1.0, hold: 3.2, clear: 0.9 };
const HUE0 = 0.12;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// A place column's centre on the panel; place 0 is the units.
const colX = (place) => (COLS - 1 - place) * CW + 8;

// The rods of figure d (1..9) in a place, as [x, y, angle] centres, the
// rod for five first. Upright (zong) in the units and hundreds: one to five
// rods standing side by side, and from six a lying rod for five across the
// top. Lying (heng) in the tens and thousands: one to five rods lying one
// above the other, and from six a standing rod for five on top. Six is
// never six rods and five never a single rod.
function glyph(d, place, cy, out) {
  const zong = place % 2 === 0, five = d > 5, u = five ? d - 5 : d, cx = colX(place);
  if (zong) {
    const h = five ? L + P : L, top = round(cy - h / 2), left = cx - floor((P * u - 1) / 2);
    if (five) out.push([cx, top + T / 2, 0]);
    for (let i = 0; i < u; i++) out.push([left + T / 2 + P * i, top + h - L / 2, PI / 2]);
  } else {
    const h = (five ? L + 1 : 0) + P * u - 1, top = round(cy - h / 2);
    if (five) out.push([cx, top + L / 2, PI / 2]);
    for (let i = 0; i < u; i++) out.push([cx, top + h - (P * (u - 1 - i)) - T / 2, 0]);
  }
  return out;
}

function hash(t) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  return h >>> 0;
}
// A number in 0..1 for each integer n and seed.
function grain(n, seed) {
  let h = Math.imul((n + 1) ^ seed, 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const digitsOf = (v) => String(v).split("").map(Number);

// The whole run of one multiplication, as a list of boards. A board is the
// figures on it, each with a name that follows it as it moves, and the
// cells lit to show which figures are being multiplied.
function timeline(a, b, sa, sb) {
  const td = digitsOf(a), bd = digitsOf(b), m = td.length, n = bd.length, sp = sa * sb;
  const boards = [];
  const board = (kind, used, shift, mid, showBottom, glow) => {
    const figs = [];
    for (let i = 0; i < m; i++) if (i >= used && td[i]) figs.push({ id: "t" + i, row: 0, place: m - 1 - i, d: td[i], neg: sa < 0 });
    if (mid > 0) {
      const md = digitsOf(mid);
      md.forEach((d, k) => d && figs.push({ id: "m" + (md.length - 1 - k), row: 1, place: md.length - 1 - k, d, neg: sp < 0 }));
    }
    if (showBottom) for (let j = 0; j < n; j++) if (bd[j]) figs.push({ id: "b" + j, row: 2, place: n - 1 - j + shift, d: bd[j], neg: sb < 0 });
    boards.push({ kind, dur: DUR[kind], figs, glow: glow || [] });
  };
  board("empty", 0, m - 1, 0, false);
  board("set", 0, m - 1, 0, true);
  let mid = 0;
  for (let i = 0; i < m; i++) {
    const shift = m - 1 - i;
    for (let j = 0; j < n; j++) {
      const place = n - 1 - j + shift, p = td[i] * bd[j];
      if (!p) continue;
      mid += p * 10 ** place;
      board("mul", i, shift, mid, true, [
        [0, m - 1 - i, 1],
        [2, place, 1],
        [1, place, 0.6],
        [1, place + 1, p > 9 ? 0.6 : 0],
      ]);
    }
    board("drop", i + 1, shift, mid, true);
    if (i < m - 1) board("shift", i + 1, shift - 1, mid, true);
  }
  board("done", m, 0, mid, false);
  // The answer stands with its figures lit and its empty places dark.
  board("hold", m, 0, mid, false, digitsOf(mid).reverse().flatMap((d, place) => (d ? [[1, place, 0.35]] : [])));
  board("clear", m, 0, 0, false);
  for (const B of boards) {
    B.rods = new Map();
    B.cells = new Map();
    for (const f of B.figs) {
      const rs = glyph(f.d, f.place, ROWS[f.row], []);
      rs.forEach((r, k) => B.rods.set(f.id + ":" + k, { x: r[0], y: r[1], a: r[2], neg: f.neg, row: f.row, seed: hash(f.id + ":" + k) }));
      B.cells.set(f.row + "/" + f.place, [f.row, f.place, f.neg, 1]);
    }
    // Each lit cell knows whether its row's number is negative.
    const neg = [sa < 0, sp < 0, sb < 0];
    B.glow = new Map(B.glow.map(([row, place, w]) => [row + "/" + place, [row, place, neg[row], w]]));
  }
  return boards;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, prob: 0, sign: 0, key: "", run: 0, boards: null, k: 0, tau: 0,
    R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N), pos: [0, 0, 0], dim: [0, 0, 0], lit: [0, 0, 0],
  };
}

const SIGNS = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];

function start(S, idx) {
  const [a, b] = PROBLEMS[idx % PROBLEMS.length], [sa, sb] = SIGNS[S.sign];
  S.run = idx % PROBLEMS.length;
  S.boards = timeline(a, b, sa, sb);
  S.k = 0;
  S.tau = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.prob = min(PROBLEMS.length - 1, floor(cl(k[2] || 0, 0, 1) * PROBLEMS.length));
  S.sign = min(3, floor(cl(k[3] == null ? 0.06 : k[3], 0, 1) * 4));
  const key = S.prob + "/" + S.sign;
  if (key !== S.key) {
    S.key = key;
    start(S, S.prob);
  }
  S.tau += (d * S.speed) / 2;
  while (S.tau >= S.boards[S.k].dur) {
    S.tau -= S.boards[S.k].dur;
    S.k++;
    if (S.k >= S.boards.length) start(S, S.run + 1);
  }
}

// One rod: a T by L bar centred at (x, y), turned by angle a (0 lying,
// pi/2 standing), its cut ends brighter and whiter than its length. A red
// rod, positive, is light added in the rods' colour. A black rod, negative,
// takes the light away from its lit cell, all but a little at its ends.
function rod(S, x, y, a, alpha, col, seed, black) {
  const c = cos(a), s = sin(a), R = S.R, G = S.G, B = S.B, r = L / 2 + 2;
  for (let py = floor(y - r); py <= y + r; py++) {
    if (py < 0 || py >= H) continue;
    for (let px = floor(x - r); px <= x + r; px++) {
      if (px < 0 || px >= W) continue;
      let body = 0, end = 0;
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const dx = px + 0.125 + sx * 0.25 - x, dy = py + 0.125 + sy * 0.25 - y;
          const u = dx * c + dy * s, v = -dx * s + dy * c;
          if (abs(u) <= L / 2 && abs(v) <= T / 2) {
            if (abs(u) > L / 2 - 1.5) end++;
            else body++;
          }
        }
      if (!body && !end) continue;
      // The grain along the rod, one step per LED of its length.
      const along = (px + 0.5 - x) * c + (py + 0.5 - y) * s, gr = 0.78 + 0.22 * grain(floor(along + L / 2), seed);
      const o = py * W + px;
      if (black) {
        const k = 1 - alpha * ((body / 16) * (0.97 - 0.12 * gr) + (end / 16) * 0.7);
        R[o] *= k;
        G[o] *= k;
        B[o] *= k;
        continue;
      }
      const wb = (body / 16) * alpha * 215 * gr, we = (end / 16) * alpha;
      R[o] += col[0] * wb + (0.55 * col[0] + 0.45) * 255 * we;
      G[o] += col[1] * wb + (0.55 * col[1] + 0.45) * 255 * we;
      B[o] += col[2] * wb + (0.55 * col[2] + 0.45) * 255 * we;
    }
  }
}

// Light a cell of the board: a place in a row. The fill has a fine grain.
function cell(S, row, place, w, col, lev) {
  if (w <= 0) return;
  const x0 = colX(place) - 7, y0 = RULE_Y[row - 1] + 1 || 0, y1 = row < 2 ? RULE_Y[row] - 1 : H - 1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x0 + 14; x++) {
      if (x < 0 || x >= W) continue;
      const o = y * W + x, l = lev * w * (0.8 + 0.4 * grain(o, 7));
      S.R[o] += col[0] * l;
      S.G[o] += col[1] * l;
      S.B[o] += col[2] * l;
    }
}

// Cells fading from the last board's to this one's: [row, place, black, w].
function blend(prev, now, u, first) {
  const out = new Map();
  for (const [key, c] of prev) out.set(key, [c[0], c[1], c[2], first ? 0 : c[3] * (1 - u)]);
  for (const [key, c] of now) {
    const g = out.get(key);
    if (g) g[3] += c[3] * u;
    else out.set(key, [c[0], c[1], c[2], c[3] * u]);
  }
  return out.values();
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.boards) return;
  const R = S.R, G = S.G, B = S.B;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  // The rods' colour, the dim colour opposite it on the wheel that an empty
  // board cell holding a red figure takes, and the pale lit colour of a cell
  // holding a black one.
  const pos = hsv(S.hue + HUE0, 0.55, 1, S.pos), dim = hsv(S.hue + HUE0 + 0.5, 0.6, 1, S.dim), lit = hsv(S.hue + HUE0, 0.35, 1, S.lit);

  // The rules of the board.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      if (x === 16 || x === 32 || x === 48 || y === RULE_Y[0] || y === RULE_Y[1]) {
        R[o] = 30;
        G[o] = 34;
        B[o] = 44;
      }
    }

  const now = S.boards[S.k], prev = S.boards[max(0, S.k - 1)], first = S.k === 0;
  const u = first ? 1 : ease(cl(S.tau / min(0.65, now.dur * 0.5), 0, 1));

  // Every cell that holds a figure is lit, faintly for red rods and brightly
  // for black ones, so a zero, an empty place, stands out dark between them.
  for (const [row, place, black, w] of blend(prev.cells, now.cells, u, first)) cell(S, row, place, w, black ? lit : dim, black ? 150 : 34);
  // The figures being multiplied and the places the product lands in.
  for (const [row, place, black, w] of blend(prev.glow, now.glow, u, first)) cell(S, row, place, w, dim, black ? 60 : 50);

  // Rods that stay move and turn; new ones slide in, the middle row's up
  // from below as the product is laid; gone ones slide away and fade.
  const off = [-14, 16, 14], gone = [-14, -10, 14];
  for (const [key, b] of now.rods) {
    const a = first ? null : prev.rods.get(key);
    if (a) rod(S, a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.a + (b.a - a.a) * u, 1, pos, b.seed, b.neg);
    else rod(S, b.x, b.y + off[b.row] * (1 - u), b.a, u, pos, b.seed, b.neg);
  }
  if (!first)
    for (const [key, a] of prev.rods) if (!now.rods.has(key)) rod(S, a.x, a.y + gone[a.row] * u, a.a, 1 - u, pos, a.seed, a.neg);

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      display.setPixel(x, y, min(255, round(R[o])), min(255, round(G[o])), min(255, round(B[o])));
    }
}
