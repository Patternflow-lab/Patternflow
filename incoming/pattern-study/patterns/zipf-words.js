// ===== Patternflow pattern =====
// Title:   Zipf Words
// Family:  type
// Idea:    The Gettysburg Address is read one word at a time in tall letters at the top of the panel, every word joins a tally, and the 13 most counted words stand ranked below it, each row the word written over and over in 3 by 5 capitals for as long as its count, so the bar chart of the speech is woven from the speech's own words, with Zipf's 1 / rank as a gold curve behind the rows and a log-log plot of every word at the foot that prints the slope as it is read.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Zipf's law, a word's count falling about as 1 / its rank (George Kingsley Zipf, The Psycho-Biology of Language, 1935; seen before him in French shorthand by Jean-Baptiste Estoup, Gammes sténographiques, 1916); texts the Gettysburg Address (Abraham Lincoln, 1863, the Bliss copy), Genesis 1:1-5 and Psalm 23 in the King James Version (1611), all public domain; 3 by 5 capitals drawn for this pattern; pattern round 100
// Round:   100
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Text=0..2, Power=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 each word keeps its own colour from sea green through azure and blue to violet, set by the order the words first came in, and the 1 / rank curve and the progress line are pale gold; at 0.5 the words run from red through orange to yellow-green and the curve is pale blue.
// Knob 2: Speed. Words read a second, twice the knob: 4 at 2, so the 271 words of the address take 68 s; 0.4 at 0.2 and 6 at 3. At the end the table holds for ten words' time with the source in the top line, fades and starts again from the first word.
// Knob 3: Text. In whole steps: 0 the Gettysburg Address, 271 words, 138 of them different, THAT the most with 13; 1 Genesis 1:1-5, 89 words, 39 different, THE with 17; 2 Psalm 23, 118 words, 74 different, THE with 9. Each opens 40% of the way in, with the table already filled.
// Knob 4: Power. Each bar is count x rank^Power long, the longest of the 13 rows 60 LEDs. At the opening 0.06 the bars are nearly the plain counts and fall away down the rows; at 1 they are count x rank, which Zipf's law says is the same for every rank, so the bars' ends would stand in a straight edge on the gold curve, which then stands straight up. Genesis 1:1-5 comes close: at its end count x rank runs from 16 to 26 down the 13 rows and every bar ends between 37 and 60 LEDs. In the address it climbs from 13 to 65, so the bars lengthen down the table.

// A word's rank is its place when the words are sorted by how often they
// came, most first, ties in the order the words first came. In long
// counts of words Zipf found the count of the word of rank r close to
// C / r, so that count x rank stays near C; Estoup had seen the same in
// French for his shorthand in 1916. In a text this
// short it holds only roughly. The fitted slope of log count against log
// rank, over every word seen so far, steepens as the text goes on and ends
// at -0.65 for the address, -0.80 for Genesis 1:1-5 and -0.54 for the
// psalm; Zipf's law is -1.
//
// The table. Row r, on rows 17 + 7 (r - 1) to 21 + 7 (r - 1), holds the
// word of rank r, its letters repeated without a gap from the left edge
// for as many 4-LED letters as its bar is long: THAT, counted 7 times at
// the opening, has a bar of 56 LEDs and reads THATTHATTHATTH. Its last
// letter brightens as the count grows into it. A word whose bar is shorter
// than itself still shows whole, the rest of its letters at 30%, so
// CONCEIVED, counted twice, reads CONC bright and the rest dim. When a
// word overtakes another the two rows
// slide past each other in a quarter of a second, the moving one covering
// the other. The bar scale is 60 LEDs for the longest of the 13 rows (8
// LEDs a count while the top count is under 7.5), so the rows keep the
// width whatever has been read. The gold curve behind the letters is where
// each bar would end if the count of rank r were exactly the top count / r.
//
// The inset at the foot puts every word seen, all 138 in the address, at
// x = log rank and y = log count, on axes fixed to the whole text, so the
// dots climb as the words come. The gold line has slope -1 through the top
// word; the white one is the least-squares line through all the dots, and
// its slope is printed in the corner. The word just read flashes white in
// its row and in the inset, and stands in letters 6 by 10 at the top (3 by
// 10 for a word longer than nine letters), with a gold line under it that
// fills as the text goes.

const W = 64, H = 128;
const { floor, round, min, max, log, exp, abs, sqrt } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const PHI = 0.6180339887;

// The three texts as printed, read as words of letters joined by inner
// hyphens and apostrophes, so battle-field and name's are one word each.
const TEXTS = [
  "Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal. Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure. We are met on a great battle-field of that war. We have come to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live. It is altogether fitting and proper that we should do this. But, in a larger sense, we can not dedicate -- we can not consecrate -- we can not hallow -- this ground. The brave men, living and dead, who struggled here, have consecrated it, far above our poor power to add or detract. The world will little note, nor long remember what we say here, but it can never forget what they did here. It is for us the living, rather, to be dedicated here to the unfinished work which they who fought here have thus far so nobly advanced. It is rather for us to be here dedicated to the great task remaining before us -- that from these honored dead we take increased devotion to that cause for which they gave the last full measure of devotion -- that we here highly resolve that these dead shall not have died in vain -- that this nation, under God, shall have a new birth of freedom -- and that government of the people, by the people, for the people, shall not perish from the earth.",
  "In the beginning God created the heaven and the earth. And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters. And God said, Let there be light: and there was light. And God saw the light, that it was good: and God divided the light from the darkness. And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day.",
  "The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake. Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me. Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over. Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever.",
];
// What the top line shows while the table holds at the end.
const SOURCES = ["LINCOLN", "GENESIS", "PSALM 23"];

// 3 by 5 capitals, figures and marks, each row three bits, left bit 4.
const FONT = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2],
  K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7], "-": [0, 0, 7, 0, 0], "'": [2, 2, 0, 0, 0], ".": [0, 0, 0, 0, 2], " ": [0, 0, 0, 0, 0],
  0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6], 4: [5, 5, 7, 1, 1],
  5: [7, 4, 6, 1, 6], 6: [3, 4, 7, 5, 7], 7: [7, 1, 2, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 6],
};

function prep(text) {
  const words = text.toUpperCase().match(/[A-Z]+(?:['-][A-Z]+)*/g);
  const index = new Map(), names = [], seq = [];
  for (const w of words) {
    if (!index.has(w)) {
      index.set(w, names.length);
      names.push(w);
    }
    seq.push(index.get(w));
  }
  const final = new Int32Array(names.length);
  for (const id of seq) final[id]++;
  let cmax = 0;
  for (const c of final) cmax = max(cmax, c);
  return { names, seq, distinct: names.length, cmax };
}
const PREP = TEXTS.map(prep);

// Layout: the word being read on rows 1-10, the progress line on row 13,
// 13 ranked rows 7 apart from row 17, the log-log inset on rows 108-127.
const ROW0 = 17, PITCH = 7, ROWS = 13, TABLE_END = 106, INSET0 = 109, INSET1 = 126;
// Share of the text read before the first frame, and the hold at the end
// in word-times.
const PREROLL = 0.4, HOLD = 10;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

function start(S, t, preroll) {
  const T = PREP[t];
  S.text = t;
  S.count = new Int32Array(T.distinct);
  S.ydisp = new Float32Array(T.distinct).fill(-1);
  S.ldisp = new Float32Array(T.distinct);
  S.flash = new Float32Array(T.distinct);
  S.order = [];
  S.rank = new Int32Array(T.distinct).fill(-1);
  S.pos = 0;
  S.cur = -1;
  S.head = 0;
  S.hold = -1;
  S.fade = 1;
  S.top = 1;
  const n = floor(T.seq.length * preroll);
  for (let i = 0; i < n; i++) read(S, false);
  for (const id of S.order) {
    S.ydisp[id] = target(S, id);
    S.ldisp[id] = S.count[id];
  }
  if (S.order.length) S.top = S.count[S.order[0]];
}

const target = (S, id) => ROW0 + PITCH * S.rank[id];

function read(S, live) {
  const T = PREP[S.text], id = T.seq[S.pos++];
  if (S.count[id] === 0) S.order.push(id);
  S.count[id]++;
  // Most counted first, ties in the order the words first came.
  S.order.sort((a, b) => S.count[b] - S.count[a] || a - b);
  S.order.forEach((w, r) => (S.rank[w] = r));
  S.cur = id;
  if (live) {
    S.flash[id] = 1;
    S.head = 1;
    if (S.ydisp[id] < 0) S.ydisp[id] = TABLE_END + 2;
  }
}

export function setup(params) {
  const S = { buf: new Float32Array(W * H * 3), acc: 0, hue: 0, speed: 2, power: 0.06 };
  start(S, 0, PREROLL);
  params.s = S;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.power = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const t = cl(round(k[2] || 0), 0, PREP.length - 1);
  if (t !== S.text) start(S, t, PREROLL);
  const T = PREP[S.text], rate = 2 * S.speed;
  S.acc += d * rate;
  while (S.acc >= 1) {
    S.acc -= 1;
    if (S.hold >= 0) {
      if (++S.hold >= HOLD) {
        start(S, S.text, 0);
        S.acc = 0;
        break;
      }
    } else if (S.pos < T.seq.length) read(S, true);
    else S.hold = 0;
  }
  // The table fades over the last three word-times of the hold.
  S.fade = S.hold >= 0 ? cl((HOLD - S.hold - S.acc) / 3, 0, 1) : 1;
  const ease = 1 - exp(-d * 12), grow = 1 - exp(-d * 10), cool = exp(-d * 3.5);
  for (const id of S.order) {
    const ty = S.rank[id] < ROWS ? target(S, id) : TABLE_END + 2;
    S.ydisp[id] += (ty - S.ydisp[id]) * ease;
    S.ldisp[id] += (S.count[id] - S.ldisp[id]) * grow;
    S.flash[id] *= cool;
  }
  S.head *= exp(-d * 5);
  if (S.order.length) S.top += (S.count[S.order[0]] - S.top) * grow;
}

function add(buf, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const p = (y * W + x) * 3;
  buf[p] = max(buf[p], c[0] * a);
  buf[p + 1] = max(buf[p + 1], c[1] * a);
  buf[p + 2] = max(buf[p + 2], c[2] * a);
}

function glyph(buf, ch, x, y, sx, sy, c, a, y0, y1) {
  const g = FONT[ch] || FONT[" "];
  for (let r = 0; r < 5; r++)
    for (let q = 0; q < 3; q++)
      if (g[r] & (4 >> q))
        for (let j = 0; j < sy; j++) {
          const yy = y + r * sy + j;
          if (yy < y0 || yy >= y1) continue;
          for (let i = 0; i < sx; i++) add(buf, x + q * sx + i, yy, c, a);
        }
}

function text(buf, s, x, y, c, a) {
  for (let i = 0; i < s.length; i++) glyph(buf, s[i], x + 4 * i, y, 1, 1, c, a, 0, H);
}

// An anti-aliased line one LED wide.
function seg(buf, ax, ay, bx, by, c, a, y0, y1) {
  const n = max(1, Math.ceil(max(abs(bx - ax), abs(by - ay)) * 2));
  for (let k = 0; k <= n; k++) {
    const x = ax + ((bx - ax) * k) / n - 0.5, y = ay + ((by - ay) * k) / n - 0.5, ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
    for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]])
      if (iy + dy >= y0 && iy + dy < y1) add(buf, ix + dx, iy + dy, c, a * sqrt(w));
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, T = PREP[S.text];
  buf.fill(0);
  const colour = (id) => hsv(S.hue + 0.4 + 0.4 * ((id * PHI) % 1), 0.55, 1);
  const gold = hsv(S.hue + 0.12, 0.45, 1), white = [1, 1, 1];
  // Bar length in LEDs for a count: linear at one letter (4 LEDs) a count
  // or less, logarithmic, and Scale between them.
  // Bar length in LEDs: count x rank^Power, the longest of the 13 rows
  // 60 LEDs (8 a count while the top count is under 7.5).
  const p = S.power, c1 = max(1, S.top), top = min(8 * c1, 60);
  const rankOf = (id) => max(1, (S.ydisp[id] - ROW0) / PITCH + 1);
  let norm = 1e-9;
  for (let r = 0; r < min(ROWS, S.order.length); r++) norm = max(norm, S.ldisp[S.order[r]] * (r + 1) ** p);
  const bar = (c, r) => (c <= 0 ? 0 : (top * c * r ** p) / norm);

  // The word being read, or the source while the table holds.
  {
    const s = S.hold >= 0 ? SOURCES[S.text] : S.cur >= 0 ? T.names[S.cur] : "";
    const big = s.length <= 9, adv = big ? 7 : 5, sx = big ? 2 : 1, wpx = s.length * adv - (adv - 3 * sx);
    const x0 = floor((W - wpx) / 2), c = S.hold >= 0 ? gold : colour(S.cur), f = S.hold >= 0 ? 0 : S.head;
    const cc = [c[0] + (1 - c[0]) * f, c[1] + (1 - c[1]) * f, c[2] + (1 - c[2]) * f];
    for (let i = 0; i < s.length; i++) glyph(buf, s[i], x0 + i * adv, 1, sx, 2, cc, 1, 0, 12);
    const prog = (S.pos / T.seq.length) * W;
    for (let x = 0; x < W; x++) add(buf, x, 13, gold, x < prog ? 0.6 : 0.14);
  }

  // Zipf's 1 / rank: where each row's bar would end if count x rank stayed
  // at the top word's count, a curve behind the letters.
  if (S.order.length) {
    let px = -1, py = -1;
    for (let r = 1; r <= ROWS; r++) {
      const x = bar(c1 / r, r), y = ROW0 + PITCH * (r - 1) + 2.5;
      if (px >= 0) seg(buf, px, py, x, y, gold, 0.55 * S.fade, 15, TABLE_END);
      px = x;
      py = y;
    }
  }

  // The ranked rows: each word written over and over, as many letters
  // long as its bar; the first copy always whole, dim past the bar's end.
  const rows = S.order.filter((id) => S.ydisp[id] < TABLE_END && S.ydisp[id] >= 12);
  const off = (id) => abs(S.ydisp[id] - (S.rank[id] < ROWS ? target(S, id) : TABLE_END + 2));
  rows.sort((a, b) => off(a) - off(b));
  for (const id of rows) {
    const y = round(S.ydisp[id]);
    const name = T.names[id], len = name.length, L = bar(S.ldisp[id], rankOf(id)) / 4, c = colour(id), f = S.flash[id];
    const cc = [c[0] + (1 - c[0]) * f * 0.8, c[1] + (1 - c[1]) * f * 0.8, c[2] + (1 - c[2]) * f * 0.8];
    // A row sliding past another covers it.
    if (off(id) > 0.5)
      for (let yy = max(15, y - 1); yy < min(TABLE_END, y + 6); yy++) buf.fill(0, yy * W * 3, (yy + 1) * W * 3);
    for (let k = 0; k < 16; k++) {
      const a = max(cl(L - k, 0, 1), k < len ? 0.3 : 0) * S.fade;
      if (a <= 0) break;
      glyph(buf, name[k % len], 4 * k, y, 1, 1, cc, a, 15, TABLE_END);
    }
  }

  // The log-log inset: every word seen as a dot at (log rank, log count),
  // axes fixed to the whole text; Zipf's slope -1 through the top word, and
  // the least-squares line through all the dots with its slope.
  {
    const R = T.distinct, lr = log(R), lcm = log(T.cmax), span = INSET1 - INSET0;
    const X = (r) => 1 + (61 * log(r)) / lr, Y = (c) => INSET1 - (span * log(c)) / lcm;
    const N = S.order.length;
    if (N) {
      const c1 = S.count[S.order[0]];
      seg(buf, X(1), Y(c1), X(R), Y(c1 / R), gold, 0.4 * S.fade, INSET0 - 2, H);
    }
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let r = 0; r < N; r++) {
      const id = S.order[r], x = log(r + 1), yv = log(S.count[id]);
      sx += x; sy += yv; sxx += x * x; sxy += x * yv;
      const c = colour(id), px = round(X(r + 1) - 0.5), py = round(Y(S.count[id]) - 0.5), f = S.flash[id];
      const cc = [c[0] + (1 - c[0]) * f, c[1] + (1 - c[1]) * f, c[2] + (1 - c[2]) * f];
      add(buf, px, py, cc, S.fade);
      add(buf, px + 1, py, cc, 0.7 * S.fade);
      if (f > 0.2) add(buf, px, py - 1, white, f * S.fade);
    }
    if (N >= 3) {
      const b = (N * sxy - sx * sy) / (N * sxx - sx * sx), a = (sy - b * sx) / N;
      seg(buf, X(1), Y(exp(a)), X(N), Y(exp(a + b * log(N))), white, 0.5 * S.fade, INSET0 - 2, H);
      const s = (b < 0 ? "-" : "") + abs(b).toFixed(2);
      text(buf, s, W - 4 * s.length, INSET0 - 1, white, 0.8 * S.fade);
    }
  }

  for (let i = 0; i < W * H; i++) {
    const p = i * 3;
    display.setPixel(i % W, floor(i / W), round(cl(buf[p], 0, 1) * 255), round(cl(buf[p + 1], 0, 1) * 255), round(cl(buf[p + 2], 0, 1) * 255));
  }
}
