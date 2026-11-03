// ===== Patternflow pattern =====
// Title:   Heaps Page
// Family:  type
// Idea:    A page of an old text writes itself word by word down the tall panel in a small lowercase face, every word bright the first time the text uses it and dim each time it comes back, so the sentence's repeated scaffolding sinks into the page while its new words stand out, the page before shows grey below the line being written, and at the foot the count of different words V climbs against the words read N on log-log axes beside the fitted line V = K N^beta, whose slope beta is printed as it changes.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the growth of vocabulary with text length, V = K N^b (Gustav Herdan, Type-Token Mathematics, 1960; Harold Stanley Heaps, Information Retrieval: Computational and Theoretical Aspects, 1978); texts the opening of Charles Dickens's A Tale of Two Cities (1859), Ecclesiastes 3:1-8 in the King James Version (1611) and Lewis Carroll's Jabberwocky (Through the Looking-Glass, 1871), all public domain; the lowercase face of Scrambled Middles (pattern round 101) with capitals, figures and marks added; pattern round 102
// Round:   102
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Text=0..2, Forget=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 a new word is a pale gold, a repeated one slate blue, the word just written flashes white, and the fitted line is aqua; at 0.5 new words are pale blue, repeats a dim rose-brown and the line pink.
// Knob 2: Speed. Words written a second, 1.5 times the knob: 3 at 2, so the 186 words of Dickens take 62 s and his first page of 38 pieces 12.7 s; 0.3 at 0.2 and 4.5 at 3. At the end the last page holds for 12 words' time and the text starts again.
// Knob 3: Text. In whole steps: 0 the first two paragraphs of A Tale of Two Cities, 186 words, 86 different, beta 0.92 at the end; 1 Ecclesiastes 3:1-8, 158 words, 52 different, beta 0.68; 2 Jabberwocky, 166 words, 90 different, beta 0.86, whose last stanza repeats the first word for word and comes out all dim. Each opens 8 pieces short of the end of its first page, 30 pieces in for Dickens.
// Knob 4: Forget. How long a word stays known. Below 0.08 it never forgets, Heaps' plain count. Above it a word counts as new again once more than M words have passed since it last came, M = 2 x 100^((1 - Forget) / 0.92): 200 at 0.08, 85 at 0.25, 24 at 0.5, 7 at 0.75 and 2 at 1. Dickens's it was the ... of comes round every six words, so from M = 5 (Forget 0.8) it lights again and his V jumps from 129 to 170. The page, V and the line are worked out again at once.

// Heaps' law. Read a text word by word and count the different words seen:
// after N words there are V of them, and over long texts V grows close to
// K N^beta with beta between about 0.4 and 0.6, so each new page brings
// fewer new words than the one before. Herdan wrote it down in 1960 and
// Heaps for document collections in 1978. Texts this short stay closer to
// beta = 1. The fit here is least squares of log V on log N over every word
// read so far, and it ends at 0.92 for Dickens, 0.68 for the preacher's a
// time to ... and 0.86 for Carroll. The preacher thins out page by page as
// the law says: 22 new words of 41 on his first page, 12 of 43, 9 of 40, 9
// of 34. Dickens does the opposite for four pages, 13 of 38, 16 of 36, 19
// of 31 and 22 of 34, because his first paragraph hangs a new noun on the
// same six-word frame each time and the second brings kings and queens;
// then the second king and queen repeat the first, 11 of 38.
//
// Words are runs of letters with inner apostrophes and hyphens, folded to
// lowercase, so It and it are one word and snicker-snack is one.
//
// The page is 11 lines 9 rows apart from row 1. When it fills, the next page
// writes over it from the top, and the lines below the line being written
// still show the page before in grey, its new words light and its repeats
// dark, so the panel always holds two pages, the newer one above. The foot:
// V, N, beta and the forgetting window M on rows 100 to 107, and the plot on
// rows 108 to 126, log N across from 1 to the whole text and log V up from 1
// to the text's final count, where V = K N^beta is a straight line of slope
// beta. V climbs as the top of a lit area, the grey line is V = N (every
// word new) and the aqua line is the fit, solid to the word read and dotted
// past it.

const W = 64, H = 128;
const { floor, round, min, max, log, exp, abs, sqrt, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const TEXTS = [
  // Charles Dickens, A Tale of Two Cities (1859), Book 1 Chapter 1, the first two paragraphs.
  "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair, we had everything before us, we had nothing before us, we were all going direct to Heaven, we were all going direct the other way - in short, the period was so far like the present period, that some of its noisiest authorities insisted on its being received, for good or for evil, in the superlative degree of comparison only. There were a king with a large jaw and a queen with a plain face, on the throne of England; there were a king with a large jaw and a queen with a fair face, on the throne of France. In both countries it was clearer than crystal to the lords of the State preserves of loaves and fishes, that things in general were settled for ever.",
  // Ecclesiastes 3:1-8, King James Version (1611).
  "To every thing there is a season, and a time to every purpose under the heaven: A time to be born, and a time to die; a time to plant, and a time to pluck up that which is planted; A time to kill, and a time to heal; a time to break down, and a time to build up; A time to weep, and a time to laugh; a time to mourn, and a time to dance; A time to cast away stones, and a time to gather stones together; a time to embrace, and a time to refrain from embracing; A time to get, and a time to lose; a time to keep, and a time to cast away; A time to rend, and a time to sew; a time to keep silence, and a time to speak; A time to love, and a time to hate; a time of war, and a time of peace.",
  // Lewis Carroll, Jabberwocky, from Through the Looking-Glass (1871), run on.
  "'Twas brillig, and the slithy toves Did gyre and gimble in the wabe: All mimsy were the borogoves, And the mome raths outgrabe. \"Beware the Jabberwock, my son! The jaws that bite, the claws that catch! Beware the Jubjub bird, and shun The frumious Bandersnatch!\" He took his vorpal sword in hand; Long time the manxome foe he sought - So rested he by the Tumtum tree And stood awhile in thought. And, as in uffish thought he stood, The Jabberwock, with eyes of flame, Came whiffling through the tulgey wood, And burbled as it came! One, two! One, two! And through and through The vorpal blade went snicker-snack! He left it dead, and with its head He went galumphing back. \"And hast thou slain the Jabberwock? Come to my arms, my beamish boy! O frabjous day! Callooh! Callay!\" He chortled in his joy. 'Twas brillig, and the slithy toves Did gyre and gimble in the wabe: All mimsy were the borogoves, And the mome raths outgrabe.",
];

// An 8-row body: ascenders in rows 0-1, x-height rows 2-5, descenders 6-7.
// The face is Scrambled Middles' with B D E F J M N V, figures, ! ? " added,
// and ~ drawn as a beta.
const FACE = {
  a: "../../##./.##/#.#/.##", b: "#../#../##./#.#/#.#/##.", c: "../../.##/#../#../.##",
  d: "..#/..#/.##/#.#/#.#/.##", e: "../../.#./###/#../.##", f: ".##/.#./###/.#./.#./.#.",
  g: "../../.##/#.#/#.#/.##/..#/##.", h: "#../#../##./#.#/#.#/#.#", i: "#/./#/#/#/#",
  j: ".#/../.#/.#/.#/.#/.#/#.", k: "#../#../#.#/##./#.#/#.#", l: "#/#/#/#/#/#",
  m: "../../####./#.#.#/#.#.#/#.#.#", n: "../../##./#.#/#.#/#.#", o: "../../.#./#.#/#.#/.#.",
  p: "../../##./#.#/#.#/##./#../#..", q: "../../.##/#.#/#.#/.##/..#/..#", r: "../../#.#/##./#../#..",
  s: "../../###/#../..#/###", t: ".../.#./###/.#./.#./.##", u: "../../#.#/#.#/#.#/.##",
  v: "../../#.#/#.#/#.#/.#.", w: "../../#...#/#...#/#.#.#/.#.#.", x: "../../#.#/.#./.#./#.#",
  y: "../../#.#/#.#/#.#/.##/..#/##.", z: "../../###/..#/.#./###",
  A: ".#./#.#/#.#/###/#.#/#.#", B: "##./#.#/##./#.#/#.#/##.", C: ".##/#../#../#../#../.##",
  D: "##./#.#/#.#/#.#/#.#/##.", E: "###/#../##./#../#../###", F: "###/#../##./#../#../#..",
  H: "#.#/#.#/#.#/###/#.#/#.#", I: "###/.#./.#./.#./.#./###", J: "..#/..#/..#/..#/#.#/.#.",
  L: "#../#../#../#../#../###", M: "#...#/##.##/#.#.#/#...#/#...#/#...#", N: "#..#/##.#/#.##/#..#/#..#/#..#",
  O: ".#./#.#/#.#/#.#/#.#/.#.", S: ".##/#../.#./..#/..#/##.", T: "###/.#./.#./.#./.#./.#.",
  V: "#.#/#.#/#.#/#.#/#.#/.#.",
  0: ".#./#.#/#.#/#.#/#.#/.#.", 1: ".#/##/.#/.#/.#/.#", 2: "##./..#/..#/.#./#../###", 3: "##./..#/.#./..#/..#/##.",
  4: "#.#/#.#/#.#/###/..#/..#", 5: "###/#../##./..#/..#/##.", 6: ".##/#../##./#.#/#.#/.#.", 7: "###/..#/..#/.#./.#./.#.",
  8: ".#./#.#/.#./#.#/#.#/.#.", 9: ".#./#.#/#.#/.##/..#/##.",
  ",": "./././././#/#", ".": "./././././#", ":": "./././#/./#", ";": "./././#/./#/#",
  "-": "../../../##", "'": "#/#", "!": "#/#/#/#/./#", "?": "##./..#/.#./.#././.#.", '"': "#.#/#.#",
  "~": "##./#.#/##./#.#/#.#/##./#../#..",
};
const GLYPH = {}, GW = {};
for (const ch in FACE) {
  const rows = FACE[ch].split("/"), px = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => c === "#" && px.push(x, y)));
  GLYPH[ch] = px;
  GW[ch] = max(...rows.map((r) => r.length));
}
const SPACE = 3, LINES = 11, PITCH = 9, TOP = 1, LABEL = 100, PLOT0 = 108, PLOT1 = 126;
const wide = (s) => [...s].reduce((w, c) => w + (GW[c] || 3) + 1, -1);

// Each text as pieces (a word with its marks, or a mark alone), laid out once.
function prep(text) {
  const pieces = [], words = [];
  let x = 0, line = 0;
  for (const s of text.split(/ +/)) {
    const m = s.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/), w = wide(s);
    if (x > 0 && x + SPACE + w > 63) {
      x = 0;
      line++;
    }
    if (x > 0) x += SPACE;
    pieces.push({ s, x: x + 1, page: floor(line / LINES), line: line % LINES, word: m ? words.length : -1 });
    if (m) words.push(m[0].toLowerCase());
    x += w;
  }
  return { pieces, words, pages: floor(line / LINES) + 1 };
}
const PREP = TEXTS.map(prep);

// The forgetting window in words, or Infinity.
const windowOf = (f) => (f < 0.08 ? Infinity : round(2 * 100 ** ((1 - f) / 0.92)));

// Which words count as new under window M, and V after each word.
function novelty(T, M) {
  const last = new Map(), fresh = new Uint8Array(T.words.length), V = new Int32Array(T.words.length + 1);
  T.words.forEach((w, i) => {
    const l = last.get(w);
    fresh[i] = l === undefined || i - l > M ? 1 : 0;
    last.set(w, i);
    V[i + 1] = V[i] + fresh[i];
  });
  return { fresh, V };
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// A text opens 8 pieces short of the end of its first page; the hold at the
// end is in word-times.
const PREROLL = 8, HOLD = 12;

function start(S, t, preroll) {
  S.text = t;
  S.pos = 0;
  S.acc = 0;
  S.hold = -1;
  S.flash = new Float32Array(PREP[t].pieces.length);
  S.nov = novelty(PREP[t], S.M);
  S.pos = preroll ? PREP[t].pieces.filter((p) => p.page === 0).length - preroll : 0;
}

export function setup(params) {
  const S = { buf: new Float32Array(W * H * 3), hue: 0, speed: 2, M: Infinity, wrapped: false };
  start(S, 0, PREROLL);
  params.s = S;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const M = windowOf(cl(k[3] == null ? 0.06 : k[3], 0, 1));
  const t = cl(round(k[2] || 0), 0, PREP.length - 1);
  if (t !== S.text) {
    S.M = M;
    S.wrapped = false;
    start(S, t, PREROLL);
  } else if (M !== S.M) {
    S.M = M;
    S.nov = novelty(PREP[S.text], M);
  }
  const T = PREP[S.text];
  S.acc += d * 1.5 * S.speed;
  while (S.acc >= 1) {
    S.acc -= 1;
    if (S.hold >= 0) {
      if (++S.hold >= HOLD) {
        S.wrapped = true;
        start(S, S.text, 0);
        break;
      }
    } else if (S.pos < T.pieces.length) S.flash[S.pos++] = 1;
    else S.hold = 0;
  }
  const cool = exp(-d * 5);
  for (let i = 0; i < S.flash.length; i++) S.flash[i] *= cool;
}

function add(buf, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const p = (y * W + x) * 3;
  buf[p] = max(buf[p], c[0] * a);
  buf[p + 1] = max(buf[p + 1], c[1] * a);
  buf[p + 2] = max(buf[p + 2], c[2] * a);
}

function write(buf, s, x, y, c, a) {
  for (const ch of s) {
    const px = GLYPH[ch];
    if (px) for (let i = 0; i < px.length; i += 2) add(buf, x + px[i], y + px[i + 1], c, a);
    x += (GW[ch] || 3) + 1;
  }
  return x;
}

// An anti-aliased line one LED wide, dotted when dot is set.
function seg(buf, ax, ay, bx, by, c, a, dot) {
  const n = max(1, ceil(max(abs(bx - ax), abs(by - ay)) * 2));
  for (let k = 0; k <= n; k++) {
    const x = ax + ((bx - ax) * k) / n - 0.5, y = ay + ((by - ay) * k) / n - 0.5, ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
    if (dot && (ix + iy) % 3) continue;
    for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) add(buf, ix + dx, iy + dy, c, a * sqrt(w));
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, T = PREP[S.text], P = T.pieces, nov = S.nov;
  buf.fill(0);
  const fresh = hsv(S.hue + 0.11, 0.45, 1), stale = hsv(S.hue + 0.6, 0.6, 0.5), fitc = hsv(S.hue + 0.47, 0.6, 1);
  const grey = [0.3, 0.3, 0.3], white = [1, 1, 1];
  const isNew = (i) => P[i].word >= 0 && nov.fresh[P[i].word];
  const colour = (i) => {
    const c = isNew(i) ? fresh : stale, f = S.flash[i];
    return [c[0] + (1 - c[0]) * f, c[1] + (1 - c[1]) * f, c[2] + (1 - c[2]) * f];
  };
  // The page before is grey: its new words a light grey, its repeats darker.
  const ghost = (i) => (isNew(i) ? [0.42, 0.42, 0.42] : [stale[0] * 0.5, stale[1] * 0.5, stale[2] * 0.5]);

  // The page being written down to its last line, and the page before
  // below it; after the text starts again, the page before is its last.
  const last = S.pos - 1, cur = last >= 0 ? P[last].page : 0, head = last >= 0 ? P[last].line : -1;
  const prev = cur > 0 ? cur - 1 : S.wrapped ? T.pages - 1 : -1;
  for (let i = 0; i < P.length; i++) {
    const p = P[i], y = TOP + PITCH * p.line;
    if (p.page === cur && i <= last) write(buf, p.s, p.x, y, colour(i), 1);
    else if (p.page === prev && p.line > head) write(buf, p.s, p.x, y, ghost(i), 1);
  }

  // V, b and the window over the plot.
  const N = P.slice(0, S.pos).filter((p) => p.word >= 0).length, Nt = T.words.length, V = nov.V, Vt = V[Nt];
  let b = 1, K = 1;
  if (N >= 3) {
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let n = 1; n <= N; n++) {
      const x = log(n), y = log(V[n]);
      sx += x; sy += y; sxx += x * x; sxy += x * y;
    }
    b = (N * sxy - sx * sy) / (N * sxx - sx * sx);
    K = exp((sy - b * sx) / N);
  }
  const vx = write(buf, "V", 1, LABEL, fresh, 1);
  write(buf, String(V[N]), vx + 2, LABEL, fresh, 1);
  const nx = write(buf, "N", 22, LABEL, stale, 1.6);
  write(buf, String(N), nx + 2, LABEL, stale, 1.6);
  const bs = "~" + b.toFixed(2).replace(/^0/, "");
  write(buf, bs, 64 - wide(bs), LABEL, fitc, 1);
  if (S.M < Infinity) write(buf, "M" + S.M, 1, PLOT0, stale, 1.6);

  // The plot, log N across and log V up.
  const lN = log(Nt), lV = log(max(2, Vt));
  const X = (n) => 1 + (61 * log(n)) / lN, Y = (v) => PLOT1 - ((PLOT1 - PLOT0) * log(v)) / lV;
  seg(buf, X(1), Y(1), X(min(Nt, Vt)), Y(min(Nt, Vt)), grey, 1, false);
  for (let x = 1; x <= 62; x++) {
    const n = min(Nt, round(exp(((x - 1) * lN) / 61)));
    if (n > N) break;
    const top = Y(V[n]);
    for (let y = PLOT1; y >= floor(top); y--) add(buf, x, y, y === floor(top) ? fresh : stale, y === floor(top) ? 1 : 0.6);
  }
  if (N >= 3) {
    const xe = min(62, X(N)), clip = (n) => Y(min(K * n ** b, Vt));
    seg(buf, X(1), Y(K), xe, clip(N), fitc, 0.85, false);
    if (N < Nt) seg(buf, xe, clip(N), X(Nt), clip(Nt), fitc, 0.85, true);
  }

  for (let i = 0; i < W * H; i++) {
    const p = i * 3;
    display.setPixel(i % W, floor(i / W), round(cl(buf[p], 0, 1) * 255), round(cl(buf[p + 1], 0, 1) * 255), round(cl(buf[p + 2], 0, 1) * 255));
  }
}
