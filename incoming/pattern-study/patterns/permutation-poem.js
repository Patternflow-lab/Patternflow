// ===== Patternflow pattern =====
// Title:   Permutation Poem
// Family:  type
// Idea:    A short phrase is written out in every order of its words, one line under the next in 3 by 5 capitals with each word in its own colour, so the 21 lines on the panel weave into a block of the same few words; each new line starts as a copy of the one above, the words that move slide into their new places in white, and the page steps up a line, and in the Steinhaus-Johnson-Trotter order that move is always two neighbouring words passing each other, while in I AM THAT I AM a quarter of those passes trade an I for an I or an AM for an AM and leave the line exactly as it was.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Brion Gysin's permutation poems (I AM THAT I AM, 1960); Steinhaus-Johnson-Trotter order (Hale Trotter, 1962; Selmer Johnson, 1963); Heap's algorithm (B. R. Heap, 1963); next permutation in lexicographic order (Narayana Pandita, 14th century); 3 by 5 capitals drawn for this pattern, pattern round 81
// Round:   81
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Phrase=0..3, Order=0..2
//
// Knob 1: Hue. Turns the words' colours round the wheel together. At 0 the opening phrase has I in azure, AM in pink and THAT in yellow green, and a phrase of four different words runs blue violet, rose, yellow and sea green; the words that are moving are always near white.
// Knob 2: Speed. 0.75 x Speed new lines a second: 1.5 at the opening 2, so a line takes 0.67 s, half of it the words sliding, a fifth held while the white fades, and the last 0.3 the page stepping up 6 rows. One line every 6.7 s at 0.2 and 2.25 a second at 3.
// Knob 3: Phrase. 0 I AM THAT I AM (5 words, 120 orders, 30 different lines), 1 RUB OUT THE WORD (24 orders, all different), 2 TO BE OR NOT TO BE (720 orders, 180 different lines), 3 VENI VIDI VICI (6 orders, so the page repeats every 6 lines). Turning it rewrites the whole page at once.
// Knob 4: Order. 0, the opening, is Steinhaus-Johnson-Trotter: every line is the one above with two neighbouring words swapped, and the last word of the phrase zigzags across the page. 1 is Heap's order: one swap a line, but the two words can stand far apart and slide over the ones between. 2 is lexicographic order, the phrase's own word order taken as the alphabet: the tail of the line turns round, so up to all the words move at once.

// Gysin wrote out every arrangement of the words of a phrase, one under the
// next, so that the page reads as a block of the same words in shifting
// places. This pattern does the same with the phrase's words as tokens
// 0..n-1 in the order the phrase gives them, and lists the n! orders of the
// tokens, not the orders of the words: where a word comes twice, two lines
// can read the same.
//
// Steinhaus-Johnson-Trotter (the plain changes of English bell ringing)
// lists them so that each order is the one before with two neighbours
// swapped. Even's way of running it gives every token a direction, left to
// start with; the largest token that points at a smaller neighbour swaps
// with it, and every token larger than it turns round. The largest token
// of all moves on every line but one in n, so it crosses the line from end
// to end and back: the zigzag thread down the page. After n! - 1 swaps the
// order is the phrase with its first two words swapped, one swap from the
// start, so the list closes into a loop.
//
// Heap's algorithm also makes each order from the last with one swap, but
// of any two positions. The next permutation in lexicographic order finds
// the last place i where token[i] < token[i+1], swaps token[i] with the
// smallest larger token after it and reverses everything after i.
//
// In I AM THAT I AM the tokens are I0 AM1 THAT2 I3 AM4. A swap of I0 with
// I3 or AM1 with AM4 changes the tokens but not the words, and the new line
// reads like the one above. Over a full turn that is 30 of the 120 lines in
// Steinhaus-Johnson-Trotter order, 26 in Heap's and 12 in lexicographic
// order; in TO BE OR NOT TO BE it is 144, 91 and 48 of the 720.
//
// The capitals are drawn on a grid five rows tall: I one column wide, N
// four, M and W five, the rest three, one column between letters and three
// between words. Lines stand 6 rows apart, so 21 whole lines and the foot of
// a 22nd fill the 128 rows. Every order of a phrase is the same width, and
// the block is centred on the panel.
//
// The page dims towards the top. Drawn at one brightness, every line is
// the same bytes as some line above it, and the frame deflates to 0.055
// bytes a pixel, a hair above the lowest pattern on the study's map.

const W = 64, H = 128, PITCH = 6, GH = 5, GAP = 3, LINES = 23;
const BOTTOM = H - GH; // top row of the newest line
const { floor, round, min } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

const GLYPHS = {
  A: ".#./#.#/###/#.#/#.#", B: "##./#.#/##./#.#/##.", C: ".##/#../#../#../.##",
  D: "##./#.#/#.#/#.#/##.", E: "###/#../##./#../###", F: "###/#../##./#../#..",
  G: ".##/#../#.#/#.#/.##", H: "#.#/#.#/###/#.#/#.#", I: "#/#/#/#/#",
  J: "..#/..#/..#/#.#/.#.", K: "#.#/#.#/##./#.#/#.#", L: "#../#../#../#../###",
  M: "#...#/##.##/#.#.#/#...#/#...#", N: "#..#/##.#/#.##/#..#/#..#",
  O: ".#./#.#/#.#/#.#/.#.", P: "##./#.#/##./#../#..", Q: ".#./#.#/#.#/##./.##",
  R: "##./#.#/##./#.#/#.#", S: ".##/#../.#./..#/##.", T: "###/.#./.#./.#./.#.",
  U: "#.#/#.#/#.#/#.#/###", V: "#.#/#.#/#.#/#.#/.#.", W: "#...#/#...#/#.#.#/##.##/#...#",
  X: "#.#/#.#/.#./#.#/#.#", Y: "#.#/#.#/.#./.#./.#.", Z: "###/..#/.#./#../###",
};
// Each glyph as its width and the list of lit cells (dx, dy).
const FONT = {};
for (const ch in GLYPHS) {
  const rows = GLYPHS[ch].split("/"), cells = [];
  rows.forEach((r, dy) => [...r].forEach((c, dx) => c === "#" && cells.push(dx, dy)));
  FONT[ch] = { w: rows[0].length, cells };
}

// I AM THAT I AM is Exodus 3:14 in the King James Bible and Gysin's
// phrase; TO BE OR NOT TO BE is Hamlet's and VENI VIDI VICI Caesar's.
// Each word gets a colour of its own, shared where a word comes twice.
const PHRASES = ["I AM THAT I AM", "RUB OUT THE WORD", "TO BE OR NOT TO BE", "VENI VIDI VICI"].map((text) => {
  const words = text.split(" ");
  const kinds = [...new Set(words)];
  const widths = words.map((w) => [...w].reduce((s, c) => s + FONT[c].w + 1, -1));
  return { words, kind: words.map((w) => kinds.indexOf(w)), kinds: kinds.length, widths };
});

// The three orders, each as the full list of token orders from the phrase.
function sjt(n) {
  const p = [...Array(n).keys()], d = Array(n).fill(-1), out = [p.slice()];
  for (;;) {
    let m = -1;
    for (let i = 0; i < n; i++) {
      const j = i + d[i];
      if (j >= 0 && j < n && p[j] < p[i] && (m < 0 || p[i] > p[m])) m = i;
    }
    if (m < 0) return out;
    const v = p[m], j = m + d[m];
    [p[m], p[j]] = [p[j], p[m]];
    [d[m], d[j]] = [d[j], d[m]];
    for (let i = 0; i < n; i++) if (p[i] > v) d[i] = -d[i];
    out.push(p.slice());
  }
}
function heap(n) {
  const a = [...Array(n).keys()], c = Array(n).fill(0), out = [a.slice()];
  let i = 1;
  while (i < n) {
    if (c[i] < i) {
      const j = i % 2 === 0 ? 0 : c[i];
      [a[j], a[i]] = [a[i], a[j]];
      out.push(a.slice());
      c[i]++;
      i = 1;
    } else c[i++] = 0;
  }
  return out;
}
function lex(n) {
  const a = [...Array(n).keys()], out = [a.slice()];
  for (;;) {
    let i = n - 2;
    while (i >= 0 && a[i] > a[i + 1]) i--;
    if (i < 0) return out;
    let j = n - 1;
    while (a[j] < a[i]) j--;
    [a[i], a[j]] = [a[j], a[i]];
    for (let l = i + 1, r = n - 1; l < r; l++, r--) [a[l], a[r]] = [a[r], a[l]];
    out.push(a.slice());
  }
}
const ORDERS = [sjt, heap, lex];

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h);
  const q = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][i];
  for (let k = 0; k < 3; k++) o[k] = v * (1 - s + s * q[k]);
  return o;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, phrase: -1, order: -1, list: null,
    k: LINES - 3, u: 0, buf: new Float32Array(W * H * 3), o: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const ph = cl(round(k[2] || 0), 0, 3), od = cl(round(k[3] == null ? 0.06 : k[3]), 0, 2);
  if (ph !== S.phrase || od !== S.order) {
    S.phrase = ph;
    S.order = od;
    S.list = ORDERS[od](PHRASES[ph].words.length);
  }
  S.u += d * 0.75 * S.speed;
  while (S.u >= 1) {
    S.u -= 1;
    S.k++;
  }
}

// Where each token's word starts, for the order on line m of the list.
function places(S, m, left, out) {
  const P = PHRASES[S.phrase], perm = S.list[((m % S.list.length) + S.list.length) % S.list.length];
  let x = left;
  for (const t of perm) {
    out[t] = x;
    x += P.widths[t] + GAP;
  }
  return out;
}

// The page dims row by row towards the top, to 45% on row 0, so the
// oldest lines recede.
const FADE = new Float32Array(H);
for (let y = 0; y < H; y++) FADE[y] = 0.45 + (0.55 * y) / (H - 1);

function word(S, t, x0, y0, r, g, b) {
  const B = S.buf, w = PHRASES[S.phrase].words[t];
  let x = x0;
  for (const ch of w) {
    const f = FONT[ch], c = f.cells;
    for (let i = 0; i < c.length; i += 2) {
      const px = round(x) + c[i], py = y0 + c[i + 1];
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const q = (py * W + px) * 3, v = FADE[py];
      B[q] += r * v;
      B[q + 1] += g * v;
      B[q + 2] += b * v;
    }
    x += f.w + 1;
  }
}

// A step is one new line: the words slide for the first half, the white
// fades until 0.7, and the page steps up 6 rows in the rest.
const SLIDE = 0.5, HOLD = 0.7;

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.list) return;
  const P = PHRASES[S.phrase], n = P.words.length, B = S.buf, o = S.o;
  B.fill(0);
  const width = P.widths.reduce((s, v) => s + v, 0) + GAP * (n - 1);
  const left = floor((W - width) / 2);
  const u = S.u, slide = smooth(u / SLIDE);
  const glow = u < SLIDE ? 1 : u < HOLD ? 1 - (u - SLIDE) / (HOLD - SLIDE) : 0;
  const lift = u < HOLD ? 0 : round(PITCH * smooth((u - HOLD) / (1 - HOLD)));
  // One colour a word, spread round the wheel from a start picked so that
  // at Hue 0 no word is red or orange; orange dimmed at the top of the page
  // reads as brown.
  const cols = [], base = P.kinds === 4 ? 0.68 : 0.58;
  for (let i = 0; i < P.kinds; i++) {
    hsv(S.hue + base + i / P.kinds, 0.55, 230, o);
    cols.push([o[0], o[1], o[2]]);
  }
  const a = new Array(n), b = new Array(n);
  // Line S.k is the newest; while the page steps up, line S.k + 1 comes in
  // under it as a copy, its words still in S.k's places.
  const newest = lift > 0 ? S.k + 1 : S.k;
  for (let m = newest; m > newest - LINES; m--) {
    const y0 = BOTTOM - PITCH * (S.k - m) - lift;
    if (y0 <= -GH || y0 >= H) continue;
    if (m === S.k) {
      places(S, m - 1, left, a);
      places(S, m, left, b);
    } else places(S, m > S.k ? S.k : m, left, b);
    for (let t = 0; t < n; t++) {
      const c = cols[P.kind[t]];
      if (m === S.k && a[t] !== b[t]) {
        const x = a[t] + (b[t] - a[t]) * slide, wv = 0.8 * glow;
        word(S, t, x, y0, c[0] + (255 - c[0]) * wv, c[1] + (255 - c[1]) * wv, c[2] + (255 - c[2]) * wv);
      } else word(S, t, b[t], y0, c[0], c[1], c[2]);
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = (y * W + x) * 3;
      display.setPixel(x, y, min(255, B[q]), min(255, B[q + 1]), min(255, B[q + 2]));
    }
}
