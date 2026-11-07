// ===== Patternflow pattern =====
// Title:   Palindrome Fold
// Family:  type
// Idea:    A palindromic sentence stands down the tall panel as a column of letters while a fold line sweeps down it centre by centre and Manacher's algorithm runs: at each centre the letters above the axis swing over it, pair by pair, to land beside their twins below, a matching pair glowing and holding and the first pair that differs flickering red and white before the page springs open, while a bar at the height of every centre grows to the radius of the palindrome found there, amber where the fold compared letters and cyan where the radius was copied from the mirror centre inside the palindrome already known, so that one sweep leaves the radius array standing as spikes, tallest at the middle of a true palindrome.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Manacher's algorithm, the linear-time radius of the longest palindrome about every centre of a string, which copies the radius of the mirror centre inside the palindrome already found (Glenn Manacher, "A new linear-time on-line algorithm for finding the smallest initial palindrome of a string", Journal of the ACM 22(3), 1975, in the all-centres form the textbooks teach); the Panama sentence is usually credited to Leigh Mercer, the others are old word play; the 5 by 5 and 5 by 7 capitals and the eight Hangul syllables are drawn for this pattern; pattern round 104
// Round:   104
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Text=0..7, Fold=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the pairs the fold compared and their bars are amber, the ones copied from a mirror cyan, a mismatch flickers red and white and the resting letters are a blue grey; at 0.5 compared is blue, copied red, a mismatch flickers green and white and the resting letters are a pale yellow grey.
// Knob 2: Speed. At 2 the sweep over the 41 centres of the Panama sentence takes 16.7 s and the closed book holds 3.4 s more, so a round is 20 s; a centre that fails at its first pair takes 0.38 s and the middle one, ten pairs deep, 2.1 s. Ten times slower at 0.2, half as fast again at 3. The shorter sentences are given up to 1.7 times longer.
// Knob 3: Text. Which sentence, letters only: 0 A man, a plan, a canal: Panama (21 letters), 1 Never odd or even (14), 2 Was it a car or a cat I saw (19), 3 No lemon, no melon (14), 4 Step on no pets (12), 5 Madam, I'm Adam (11), 6 여보 안경 안 보여 and 7 다시 합창합시다 (7 syllables each). The letters grow as the sentence shortens: 5 rows tall from 16 letters up, 7 rows for 11 to 14, 16 rows for a syllable, all two LEDs to the dot across.
// Knob 4: Fold. Up to 0.1 the sweep runs by itself. Past 0.1 the hand holds the fold line: 0.1 is the first centre and 1 the last, the bars of every centre above it stand finished as Manacher's loop would have left them, and the fold at that centre plays over and over.

// A palindrome reads the same backwards, so fold the ribbon of letters at its
// middle and every letter lands on its twin. Manacher's loop asks that at
// every centre of the string with a # between each pair of letters, so the
// letters and the gaps between them are centres alike, 2n + 1 of them, the
// first and last of radius 0 and left out here. P[i], the radius, is the
// length in letters of the palindrome about centre i. Inside the palindrome
// found furthest right so far, centre C and right edge R, a centre i has the
// mirror 2C - i, and what holds about the mirror holds about i: P[i] starts
// at min(R - i, P[mirror]), copied, and only when the mirror's palindrome
// reaches the edge R does the loop compare letters outward from there. R
// never moves left, which is why the loop is linear.
//
// analyse() runs that loop and keeps, for each centre, how much was copied,
// the final radius and whether the expansion stopped on a mismatch or at the
// end of the text. build() turns each centre into a block of time: the fold
// line arrives, the copied pairs turn over together, the compared pairs turn
// over one after another, a mismatching pair turns to 0.92 of the way and
// flickers, the block holds and opens again. A pair is two letter slots, a
// above the axis and b below it. Letter a turns over about the midpoint of
// the two, y = mid + (ya - mid) cos(th), squeezed to |cos th| of its height
// while it bulges out to the left, and lands in the column left of b.

const W = 64, H = 128, N = W * H;
const { floor, ceil, round, min, max, abs, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => u * u * (3 - 2 * u);

// Letters only; punctuation and case are ignored the way a palindrome ignores them.
const TEXTS = [
  "AMANAPLANACANALPANAMA",
  "NEVERODDOREVEN",
  "WASITACARORACATISAW",
  "NOLEMONNOMELON",
  "STEPONNOPETS",
  "MADAMIMADAM",
  "여보안경안보여",
  "다시합창합시다",
];

// 5 by 5 capitals for the long sentences, 5 by 7 for the short ones, rows
// from the top.
const F5 = {
  A: ".###. #...# ##### #...# #...#", C: ".#### #.... #.... #.... .####", D: "####. #...# #...# #...# ####.",
  E: "##### #.... ###.. #.... #####", I: ".###. ..#.. ..#.. ..#.. .###.", L: "#.... #.... #.... #.... #####",
  M: "#...# ##.## #.#.# #...# #...#", N: "#...# ##..# #.#.# #..## #...#", O: ".###. #...# #...# #...# .###.",
  P: "####. #...# #...# ####. #....", R: "####. #...# ####. #..#. #...#", S: ".#### #.... .###. ....# ####.",
  T: "##### ..#.. ..#.. ..#.. ..#..", V: "#...# #...# #...# .#.#. ..#..", W: "#...# #...# #.#.# ##.## #...#",
};
const F7 = {
  A: ".###. #...# #...# ##### #...# #...# #...#", C: ".###. #...# #.... #.... #.... #...# .###.",
  D: "####. #...# #...# #...# #...# #...# ####.", E: "##### #.... #.... ####. #.... #.... #####",
  I: ".###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.", L: "#.... #.... #.... #.... #.... #.... #####",
  M: "#...# ##.## #.#.# #.#.# #...# #...# #...#", N: "#...# #...# ##..# #.#.# #..## #...# #...#",
  O: ".###. #...# #...# #...# #...# #...# .###.", P: "####. #...# #...# ####. #.... #.... #....",
  R: "####. #...# #...# ####. #.#.. #..#. #...#", S: ".#### #.... #.... .###. ....# ....# ####.",
  T: "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..", V: "#...# #...# #...# #...# #...# .#.#. ..#..",
  W: "#...# #...# #...# #.#.# #.#.# ##.## #...#",
};
// Every dot is two LEDs wide, so the letters stand as bold extended capitals.
const rowsOf = (font, ch) => font[ch].split(" ").map((r) => r.replace(/./g, "$&$&"));

// The eight Hangul syllables of the two Korean sentences, put together from
// jamo drawn as one-LED lines on a grid 13 wide and 16 tall, then every LED
// widened by one to the right, so the verticals stand two LEDs wide as they
// do in the capitals. Strokes are line(x0, y0, x1, y1) and rings.
const SYL = {
  여: ["ㅇ", "ㅕ", ""], 보: ["ㅂ", "ㅗ", ""], 안: ["ㅇ", "ㅏ", "ㄴ"], 경: ["ㄱ", "ㅕ", "ㅇ"],
  다: ["ㄷ", "ㅏ", ""], 시: ["ㅅ", "ㅣ", ""], 합: ["ㅎ", "ㅏ", "ㅂ"], 창: ["ㅊ", "ㅏ", "ㅇ"],
};
function hangul(ch) {
  const g = Array.from({ length: 16 }, () => new Array(14).fill(0));
  const dot = (x, y) => {
    x = round(x);
    y = round(y);
    if (x >= 0 && x < 13 && y >= 0 && y < 16) g[y][x] = 1;
  };
  const line = (x0, y0, x1, y1) => {
    x0 = round(x0);
    y0 = round(y0);
    x1 = round(x1);
    y1 = round(y1);
    const dx = abs(x1 - x0), dy = abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    for (let e = dx - dy; ; ) {
      dot(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 > -dy) {
        e -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        e += dx;
        y0 += sy;
      }
    }
  };
  const ring = (x, y, w, h) => {
    line(x + 1, y, x + w - 2, y);
    line(x + 1, y + h - 1, x + w - 2, y + h - 1);
    line(x, y + 1, x, y + h - 2);
    line(x + w - 1, y + 1, x + w - 1, y + h - 2);
  };
  const mid = (x, w) => x + floor((w - 1) / 2);
  const JAMO = {
    ㅇ: (x, y, w, h) => ring(x, y, w, h),
    ㄱ: (x, y, w, h) => (line(x, y, x + w - 1, y), line(x + w - 1, y, x + w - 1, y + h - 1)),
    ㄴ: (x, y, w, h) => (line(x, y, x, y + h - 1), line(x, y + h - 1, x + w - 1, y + h - 1)),
    ㄷ: (x, y, w, h) => (line(x + w - 1, y, x, y), line(x, y, x, y + h - 1), line(x, y + h - 1, x + w - 1, y + h - 1)),
    ㅅ: (x, y, w, h) => (line(mid(x, w), y, x, y + h - 1), line(mid(x, w), y, x + w - 1, y + h - 1)),
    ㅎ: (x, y, w, h) => (line(mid(x, w) - 1, y, mid(x, w) + 1, y), line(x, y + 2, x + w - 1, y + 2), ring(x + 1, y + 4, w - 2, h - 4)),
    ㅊ: (x, y, w, h) => (line(mid(x, w) - 1, y, mid(x, w) + 1, y), line(x, y + 2, x + w - 1, y + 2), line(mid(x, w), y + 2, x, y + h - 1), line(mid(x, w), y + 2, x + w - 1, y + h - 1)),
    ㅂ: (x, y, w, h) => (line(x, y, x, y + h - 1), line(x + w - 1, y, x + w - 1, y + h - 1), line(x, y + round((h - 1) / 2), x + w - 1, y + round((h - 1) / 2)), line(x, y + h - 1, x + w - 1, y + h - 1)),
    ㅏ: (x, y, w, h) => (line(x, y, x, y + h - 1), line(x, y + round((h - 1) * 0.45), x + w - 1, y + round((h - 1) * 0.45))),
    ㅕ: (x, y, w, h) => (line(x + w - 1, y, x + w - 1, y + h - 1), line(x, y + round((h - 1) / 3), x + w - 1, y + round((h - 1) / 3)), line(x, y + round(((h - 1) * 2) / 3), x + w - 1, y + round(((h - 1) * 2) / 3))),
    ㅣ: (x, y, w, h) => line(x, y, x, y + h - 1),
    ㅗ: (x, y, w, h) => (line(x, y + h - 1, x + w - 1, y + h - 1), line(mid(x, w), y, mid(x, w), y + h - 1)),
  };
  const [ini, vow, fin] = SYL[ch];
  if (vow === "ㅗ") {
    JAMO[ini](1, 0, 11, 9);
    JAMO[vow](0, 10, 13, 6);
  } else if (!fin) {
    // The two ticks of the yeo vowel stand left of its stem, so it sits closer.
    JAMO[ini](0, 3, vow === "ㅕ" ? 5 : 7, 10);
    JAMO[vow](vow === "ㅕ" ? 7 : 9, 0, 4, 16);
  } else {
    JAMO[ini](0, 0, vow === "ㅕ" ? 5 : 7, 9);
    JAMO[vow](vow === "ㅕ" ? 7 : 9, 0, 4, 9);
    if (fin === "ㅇ") JAMO[fin](3, 10, 7, 6);
    else JAMO[fin](1, 10, 10, 6);
  }
  return g.map((r) => r.map((v, x) => (v || r[x - 1] ? "#" : ".")).join(""));
}

// Layout in LEDs, set per sentence in build(): the column the pairs land in,
// the column of the sentence, how far a swinging letter bulges out to its
// left, the bracket of the palindrome known so far, the rail the bars stand
// on and the room for them.
const Y0 = 1, YH = 126, TRAIL = 20;

// Story seconds at Speed 2.
const ARR = 0.07, COPY = 0.22, UNF = 0.12, FLASH = 0.18, FIN = 3.4;
const flight = (s) => 0.12 + 0.018 * s;
const STAG = 0.07;

// Manacher's loop over the string with a # between every letter, kept as
// events for the fold to play. P[i] is the radius in that string, which is
// the length of the palindrome in letters.
function analyse(s) {
  const n = s.length, m = 2 * n + 1, T = [];
  for (let i = 0; i < m; i++) T.push(i & 1 ? s[(i - 1) >> 1] : "#");
  const P = new Array(m).fill(0), blocks = [];
  let C = 0, R = 0;
  for (let i = 0; i < m; i++) {
    let copied = 0, mir = -1;
    if (i < R) {
      mir = 2 * C - i;
      copied = min(R - i, P[mir]);
    }
    let rho = copied, failed = false, edge = false;
    // The mirror's palindrome ends inside the known one: nothing more to compare.
    if (i >= R || P[mir] >= R - i) {
      for (;;) {
        const l = i - 1 - rho, r = i + 1 + rho;
        if (l < 0 || r >= m) {
          edge = true;
          break;
        }
        if (T[l] !== T[r]) {
          failed = true;
          break;
        }
        rho++;
      }
    }
    P[i] = rho;
    if (i > 0 && i < m - 1) blocks.push({ k: i, mir, copied, rho, failed, edge, C0: C, R0: R });
    if (i + rho > R) {
      C = i;
      R = i + rho;
    }
  }
  return { n, m, P, blocks, C, R };
}

function build(ti) {
  const s = TEXTS[ti], A = analyse(s), { n } = A;
  const ko = s.charCodeAt(0) > 255, gw = ko ? 14 : 10, gh = ko ? 16 : n >= 16 ? 5 : 7, font = gh === 5 ? F5 : F7, pitch = YH / n;
  const L = {
    ti, n, m: A.m, P: A.P, gh, pitch, blocks: A.blocks, Cend: A.C, Rend: A.R,
    glyphs: [...s].map((ch) => ({ w: gw, h: gh, rows: ko ? hangul(ch) : rowsOf(font, ch) })),
    top: [], yc: [],
    th: min(5, max(1, floor((pitch / 2) * 0.67 + 0.01))),
    XL: ko ? 3 : 6, BULGE: ko ? 2 : 4,
    // Fewer, larger letters are given longer.
    pace: ko ? 1.7 : n < 15 ? 1.2 : 1,
  };
  L.XT = L.XL + gw + 4;
  L.BR = L.XT + gw + 2;
  L.RAIL = L.BR + 2;
  L.BX = L.RAIL + 1;
  L.BW = 63 - L.BX;
  for (let j = 0; j < n; j++) {
    L.top.push(round(Y0 + (j + 0.5) * pitch - gh / 2));
    L.yc.push(L.top[j] + gh / 2);
  }
  L.yk = (k) => Y0 + (k * pitch) / 2;
  L.scale = L.BW / n;
  let g = 0, best = 0;
  for (const B of L.blocks) {
    const { k } = B, odd = k & 1;
    const a = (q) => (odd ? (k - 1) / 2 - q : k / 2 - q), b = (q) => (odd ? (k - 1) / 2 + q : k / 2 + q - 1);
    const pc = floor(B.copied / 2), pe = floor(B.rho / 2) - pc, total = pc + pe;
    const triv = total === 0 && B.copied === 0;
    B.pc = pc;
    B.pe = pe;
    B.pairs = [];
    let t = triv ? ARR * 0.6 : ARR;
    B.tArr = t;
    B.tCopy = -1;
    if (B.copied > 0) {
      B.tCopy = t;
      for (let q = 1; q <= pc; q++) B.pairs.push({ s: q, kind: 0, a: a(q), b: b(q), t0: t, t1: t + COPY, th: PI });
      t += B.copied > 0 && pc > 0 ? COPY : COPY * 0.6;
    }
    let idx = 0, end = t;
    for (let q = pc + 1; q <= pc + pe; q++, idx++) {
      const t0 = t + idx * STAG, t1 = t0 + flight(q);
      B.pairs.push({ s: q, kind: 1, a: a(q), b: b(q), t0, t1, th: PI });
      end = max(end, t1);
    }
    if (B.failed) {
      const q = pc + pe + 1, t0 = t + idx * STAG, t1 = t0 + flight(q) * (triv ? 0.8 : 1);
      B.pairs.push({ s: q, kind: 2, a: a(q), b: b(q), t0, t1, th: 0.92 * PI });
      end = max(t1 + (triv ? FLASH * 0.8 : FLASH), end);
    }
    const full = B.edge && B.rho === n;
    B.tU = end + (full ? 1.0 : triv ? 0.02 : 0.06 + 0.06 * min(total, 8));
    B.len = B.tU + (triv ? UNF * 0.8 : UNF);
    B.g0 = g;
    g += B.len;
    if (L.P[k] > L.P[L.blocks[best].k]) best = B.k - 1;
  }
  L.total = g;
  L.best = L.blocks[best];
  return L;
}

export function setup(params) {
  params.s = { L: null, ti: -1, g: 0, hue: 0, tb: 0, hand: -1, buf: new Float32Array(N * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3), ti = cl(floor(k[2] || 0), 0, TEXTS.length - 1), fold = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  if (ti !== S.ti) {
    S.ti = ti;
    S.L = build(ti);
    S.g = 0;
    S.tb = 0;
  }
  const L = S.L, dg = (d * speed) / (2 * L.pace);
  if (fold > 0.1) {
    const hand = min(L.blocks.length - 1, floor(((fold - 0.1) / 0.9) * L.blocks.length));
    if (hand !== S.hand) S.tb = 0;
    S.hand = hand;
    S.tb += dg;
    const B = L.blocks[S.hand];
    if (S.tb > B.len + 0.7) S.tb = 0;
  } else {
    S.hand = -1;
    S.g += dg;
    if (S.g > L.total + FIN) S.g = 0;
  }
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// Between orange and yellow a dim colour reads brown, so it is paled.
function pale(h, s, v) {
  const u = h - floor(h), warm = u > 0.02 && u < 0.2;
  return hsv(h, warm ? s * 0.45 : s, warm ? min(1, v * 1.15) : v);
}

// The angle of every pair of the block at block time tb. A pair swings from
// 0, resting in the column, to PI, landed on its twin; the whole block opens
// again together after tU.
function pose(B, tb) {
  const open = tb > B.tU ? 1 - ease(cl((tb - B.tU) / (B.len - B.tU), 0, 1)) : 1;
  return B.pairs.map((p) => p.th * ease(cl((tb - p.t0) / (p.t1 - p.t0), 0, 1)) * open);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.L) return;
  const L = S.L, buf = S.buf, { n, m, blocks, glyphs, yc, XL, XT, BULGE, BR, RAIL, BX, BW } = L;
  buf.fill(0);
  const h0 = S.hue;
  const cA = hsv(h0 + 0.115, 0.85, 1), cB = hsv(h0 + 0.5, 0.85, 1), cX = hsv(h0 + 0.97, 0.9, 1);
  const cTrail = hsv(h0 + 0.62, 0.75, 1), cBase = pale(h0 + 0.62, 0.66, 0.56), cAxis = hsv(h0 + 0.12, 0.15, 0.95), cLine = hsv(h0 + 0.62, 0.3, 0.5);
  const put = (x, y, c, k) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    for (let q = 0; q < 3; q++) buf[o + q] = max(buf[o + q], c[q] * k);
  };
  // A glyph row by row, squeezed to hs rows about the centre yc0.
  const stamp = (g, x0, yc0, hs, c, k) => {
    const t0 = round(yc0 - hs / 2);
    for (let oy = 0; oy < hs; oy++) {
      const row = g.rows[min(g.h - 1, floor(((oy + 0.5) * g.h) / hs))];
      for (let ox = 0; ox < g.w; ox++) if (row[ox] === "#") put(x0 + ox, t0 + oy, c, k);
    }
  };

  // Which block, at which block time.
  let bi, tb, finale = false;
  if (S.hand >= 0) {
    bi = S.hand;
    tb = S.tb;
  } else if (S.g < L.total) {
    bi = 0;
    while (bi + 1 < blocks.length && blocks[bi + 1].g0 <= S.g) bi++;
    tb = S.g - blocks[bi].g0;
  } else {
    // The closed book of the longest palindrome, held, then sprung open.
    finale = true;
    bi = L.best.k - 1;
    const e = S.g - L.total, B = blocks[bi], lastU = FIN - (B.len - B.tU);
    tb = e < lastU ? B.tU - 0.01 : B.tU + (e - lastU);
  }
  const cur = blocks[bi], done = finale ? blocks.length : bi;

  // The rail the bars stand on, then the bars: finished blocks whole, the
  // current one as the fold has it so far.
  const barRows = (k) => {
    const r0 = round(L.yk(k) - L.th / 2);
    return [r0, r0 + L.th];
  };
  for (let k = 1; k < m - 1; k++) {
    // The longest palindrome the centre could have: the dots of a wedge the
    // bars stand in.
    const [r0, r1] = barRows(k), reach = min(k, m - 1 - k) * L.scale;
    put(RAIL, r0, cLine, 0.3);
    for (let y = r0; y < r1; y++) put(BX + max(0, ceil(reach) - 1), y, cLine, 0.34);
  }
  const drawBar = (B, len, copyLen, v) => {
    if (len <= 0) return;
    const [r0, r1] = barRows(B.k);
    for (let xi = 0, x = BX; xi < BW; xi++, x++) {
      const cov = cl(len * L.scale - xi, 0, 1);
      if (cov <= 0) break;
      const col = xi / L.scale < copyLen - 1e-6 ? cB : cA;
      for (let y = r0; y < r1; y++) put(x, y, col, v * cov);
    }
  };
  for (let i = 0; i < done; i++) drawBar(blocks[i], blocks[i].rho, blocks[i].copied, finale && i === bi ? 1 : 0.72);

  const poses = pose(cur, tb);
  // The state of every slot: 0 resting, 1 vacated, 2 landed, 3 failed.
  const slot = new Array(n).fill(0), landedBy = new Array(n).fill(null);
  cur.pairs.forEach((p, i) => {
    const th = poses[i];
    if (th <= 0.001) return;
    slot[p.a] = 1;
    if (p.kind === 2) slot[p.b] = 3;
    else if (th >= PI - 0.001) {
      slot[p.b] = 2;
      landedBy[p.b] = p;
    }
  });
  {
    let curLen = 0, curCopy = 0;
    if (cur.copied > 0) curCopy = cur.copied * cl((tb - cur.tCopy) / (COPY * (cur.pc > 0 ? 1 : 0.6)), 0, 1);
    else if (cur.k & 1) curLen = ease(cl(tb / cur.tArr, 0, 1));
    cur.pairs.forEach((p) => {
      if (p.kind === 1) curLen += 2 * cl((tb - (p.t0 + p.t1) / 2) / ((p.t1 - p.t0) / 2), 0, 1);
    });
    if (finale) drawBar(cur, cur.rho, cur.copied, 1);
    else drawBar(cur, curLen + curCopy, curCopy, 1);
  }

  // The failing pair flickers white and red between its two letters.
  const flick = floor(tb * 16) & 1;
  const axisJ = cur.k & 1 ? (cur.k - 1) / 2 : -1;
  for (let j = 0; j < n; j++) {
    let col = cBase, v = 1;
    if (slot[j] === 1) v = 0.3;
    if (slot[j] === 2) {
      const p = landedBy[j], age = tb - p.t1, pop = age >= 0 ? max(0, 1 - age / 0.25) : 0;
      col = (p.kind === 0 ? cB : cA).map((c) => c + (1 - c) * 0.7 * pop);
      // Its twin, turned over beside it.
      stamp(glyphs[p.a], XL, yc[j], glyphs[j].h, col, 1);
    }
    if (slot[j] === 3) col = flick ? cX : [1, 1, 1];
    if (j === axisJ) col = cAxis;
    stamp(glyphs[j], XT, yc[j], glyphs[j].h, col, v);
  }

  // The palindrome known so far, as a bracket between the column and the
  // bars with its centre ticked, and the copy: a line from the mirror of the
  // centre to the centre across it.
  {
    const C = finale ? L.Cend : cur.C0, R = finale ? L.Rend : cur.R0;
    if (R > 0) {
      const ya = L.yk(C - R), yb = L.yk(C + R);
      for (let y = floor(ya); y <= floor(yb) - 1; y++) if (!((y - floor(ya)) & 1)) put(BR, y, cB, 0.32);
      for (const yy of [floor(ya), floor(yb) - 1]) for (let x = BR; x < BR + 3; x++) put(x, yy, cB, 0.55);
      const yc0 = floor(L.yk(C));
      for (let x = BR - 2; x <= BR + 2; x++) put(x, yc0, cB, 1);
    }
    if (cur.copied > 0 && cur.mir >= 0 && !finale) {
      const t = tb - cur.tCopy;
      if (t > -0.03 && t < COPY + 0.14) {
        const y1 = floor(L.yk(cur.mir)), y2 = floor(L.yk(cur.k));
        for (let y = min(y1, y2); y <= max(y1, y2); y++) if (!(y & 1) || abs(y - y1) < 3 || abs(y - y2) < 3) put(BR + 1, y, cB, 0.9);
        for (let x = BR - 1; x <= BR + 3; x++) {
          put(x, y1, cB, 1);
          put(x, y2, cB, 1);
        }
        const [r0, r1] = barRows(cur.mir);
        for (let y = r0; y < r1; y++) put(BX + floor(L.P[cur.mir] * L.scale), y, [1, 1, 1], 1);
      }
    }
  }

  // The fold line, with its hinge at the left edge and the sweep's glow
  // trailing above it over the centres already visited.
  {
    const prev = cur.k > 1 ? blocks[cur.k - 2] : null;
    let y = L.yk(cur.k);
    if (prev && tb < cur.tArr && S.hand < 0 && !finale) y = L.yk(prev.k) + (y - L.yk(prev.k)) * ease(tb / cur.tArr);
    const row = floor(y);
    for (let d = 1; d <= TRAIL; d++) {
      const v = 0.3 * (1 - d / (TRAIL + 1)) ** 2;
      for (let x = 0; x < W; x++) put(x, row - d, cTrail, v);
    }
    for (let x = 0; x < W; x += 2) put(x, row, cLine, 0.5);
    for (let dy = -1; dy <= 1; dy++) for (let x = 0; x < 2 - abs(dy); x++) put(x, row + dy, cAxis, 1);
  }

  // Pairs in the air: a letter turning over about the axis, squeezed to its
  // cosine, bulging out to the left on the way.
  cur.pairs.forEach((p, i) => {
    const th = poses[i];
    if (th <= 0.001 || (p.kind !== 2 && th >= PI - 0.001)) return;
    const g = glyphs[p.a], ya = yc[p.a], yb = yc[p.b], mid = (ya + yb) / 2;
    const y = mid + (ya - mid) * cos(th), hs = max(1, round(g.h * abs(cos(th))));
    let x0 = XT + round((XL - XT) * ease(th / PI)) - round(BULGE * sin(th)), col = p.kind === 0 ? cB : p.kind === 1 ? cA : cX;
    if (p.kind === 2) {
      col = flick ? [1, 1, 1] : cX;
      x0 += flick ? 1 : -1;
    }
    stamp(g, x0, y, hs, col, 1);
  });

  // The picture fades in as a sweep starts and out as the book sprung open.
  const f = (S.hand >= 0 ? 1 : min(cl(S.g / 0.3, 0, 1), cl((L.total + FIN - S.g) / 0.4, 0, 1))) * 255;
  for (let p = 0; p < N; p++) display.setPixel(p % W, floor(p / W), round(min(1, buf[p * 3]) * f), round(min(1, buf[p * 3 + 1]) * f), round(min(1, buf[p * 3 + 2]) * f));
}
