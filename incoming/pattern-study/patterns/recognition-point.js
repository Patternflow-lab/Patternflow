// ===== Patternflow pattern =====
// Title:   Recognition Point
// Family:  type
// Idea:    A paragraph is read one word at a time at the same spot, each word as large 3 by 5 capitals pulled so that its recognition letter, tinted another colour, lands on one pinned column, so the eye can stay still while the words change, and the words just read hang from that column above in a stack of smaller and fainter lines, a map of the whole paragraph as word-shaped bars lit up to where the reader has got below.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: rapid serial visual presentation (Mary C. Potter, 1984), the convenient viewing position of a word (J. Kevin O'Regan, 1981), the 3 by 5 capitals of Saccades (pattern round 106), copied from kasiski-examination.js; pattern round 109
// Round:   109
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=2..9, Pin=-1..1, Trail=3..8
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the words are pale cyan, the recognition letter of each is magenta, the pin's guide line and the paragraph map follow, and each line of the trail is the same colours fainter. A recognition letter that would land in orange or yellow goes pale so it does not dim to brown.
// Knob 2: Speed. Words a minute, 100 times the knob, from 200 at 2 to 900 at 9, and 2 is where it opens. A word of five letters is on for 60 over the words a minute in seconds: 0.3 s at 2, 0.2 s at 3 and 0.067 s at 9. Each letter more or fewer changes that by 12 percent of it, within 0.7 and 1.5 times, so the shortest words go by in 0.7 of it; a comma holds the word for half a word longer and a full stop for one and a half, which makes a five-letter word with a stop 0.75 s at 2.
// Knob 3: Pin. Where the recognition column stands across the panel: column 12 at -1, 27 at 0 and 42 at 1. A word is set at the largest scale, up to 4, at which its recognition letter can stay on that column and the whole word, with its comma or full stop, stays on the 64 columns. With the pin at 27 a word of 3 letters or fewer is scale 4 (letters 12 LEDs wide and 20 tall), 4 letters is 4, or 3 when a comma or stop follows, 5 letters is 3, and 6 and 7 are 2. With the pin at 12 a word of 5 letters or more shrinks to scale 1, and at 42 a word of 6 or 7.
// Knob 4: Trail. How many words stay above the one being read, from 3 to 8, and it catches at whole numbers. The lines fill the height whatever the number: 3 lines are scales 4, 3 and 3 and 8 are one of scale 2 and seven of scale 1, each older line fainter, and the recognition letters of all of them stand in the one column. The lit letter is the first of a word of 1 or 2 letters, the second of 3 or 4 and the third of 5 to 7: the middle of 3 and 5, and left of it in the rest.

const W = 64, H = 128;
const { floor, round, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The face: capitals 3 wide and 5 tall from saccades.js by way of
// kasiski-examination.js, and a full stop and a comma one column wide.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));
const PUNCT = { ".": [0, 0, 0, 0, 1], ",": [0, 0, 0, 1, 1] };

// Eight sentences of 88 words, none longer than 7 letters.
const TEXT =
  "The eye does not slide along a line of print. It jumps, rests for a moment, and jumps again. Here the jumping is gone. Each word lands on one spot, so the eye can stay put while the words pass through it. One letter in every word is held on the line and lit in another colour. It sits near the middle, where a reader looks first. Short words come big and long words come small. Turn the pin, and the whole page leans to the other side.";

// The recognition letter, at index min(2, floor((n - 1) / 2)): the first letter
// of a word of 1 or 2 letters, the second of 3 or 4, the third of 5 or more.
// That is the middle of a word of 3 or 5 letters and a little left of the
// middle of the rest, where a reader's eye lands, and it keeps the letters
// on the right to what the panel has room for.
const rOf = (n) => min(2, floor((n - 1) / 2));
const WORDS = TEXT.split(" ").map((tok) => {
  const p = /[.,]$/.test(tok) ? tok.slice(-1) : "";
  const w = (p ? tok.slice(0, -1) : tok).toUpperCase();
  return { w, p, n: w.length, r: rOf(w.length) };
});
const NW = WORDS.length;

// How long a word stays, in units of the time one word takes at the rate:
// a word of 5 letters is 1, each letter more is 12 percent longer, and a
// comma or a full stop adds a pause.
const hold = (wd) => cl(1 + 0.12 * (wd.n - 5), 0.7, 1.5) + (wd.p === "." ? 1.5 : wd.p === "," ? 0.5 : 0);

// Where the letters of a word go for a recognition column at xp and a scale
// s: the face is 3 cells wide and a cell is s LEDs, letters are a gap g
// apart, and the recognition letter is put so that xp falls in the middle
// cell of its face. xr is the left edge of that letter.
const gapOf = (s) => (s >= 3 ? 2 : 1);
function extent(wd, xp, s) {
  const g = gapOf(s), A = 3 * s + g, xr = xp - floor((3 * s) / 2);
  let right = xr + (wd.n - 1 - wd.r) * A + 3 * s - 1;
  if (wd.p) right += g + s;
  return { A, xr, left: xr - wd.r * A, right };
}
// The largest scale up to smax at which the word keeps its recognition letter
// on xp and stays on the panel.
function fitScale(wd, xp, smax) {
  for (let s = smax; s > 1; s--) {
    const e = extent(wd, xp, s);
    if (e.left >= 0 && e.right <= W - 1) return s;
  }
  return 1;
}

// The pin's range, as columns: every word fits at scale 1 across all of it.
const XLO = 12, XHI = 42;

// The trail: the scales of its lines, newest first, for each count, and
// where each goes. They stack up from row YB to row 1 with the same gap
// between each, never less than 2.
const YB = 60, YC = 82, MAPY = 103;
const TRAIL = { 3: [4, 3, 3], 4: [3, 3, 2, 2], 5: [3, 2, 2, 2, 1], 6: [2, 2, 2, 1, 1, 1], 7: [2, 2, 1, 1, 1, 1, 1], 8: [2, 1, 1, 1, 1, 1, 1, 1] };
const SLOTS = {};
for (const K of Object.keys(TRAIL)) {
  const sc = TRAIL[K], total = sc.reduce((a, s) => a + 5 * s, 0), gap = floor((YB - 1 + 1 - total) / (sc.length - 1));
  let bottom = YB;
  SLOTS[K] = sc.map((s) => {
    const top = bottom - 5 * s + 1, o = { s, yc: top + floor((5 * s) / 2) };
    bottom = top - 1 - gap;
    return o;
  });
}

// The map of the paragraph: one bar a word, a LED to a letter, two rows tall,
// wrapped at the panel's width, with a wider gap after a full stop.
const MAP = [];
{
  let x = 2, line = 0;
  for (const wd of WORDS) {
    if (x + wd.n > 62) {
      x = 2;
      line++;
    }
    MAP.push({ x, line });
    x += wd.n + (wd.p === "." ? 3 : 1);
  }
}

export function setup(params) {
  params.s = { hue: 0, wpm: 200, xp: 27, K: 3, idx: 0, t: 0, read: 0, buf: new Uint8Array(W * H * 3), dbg: null };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 3], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.wpm = cl(k[1], 2, 9) * 100;
  S.xp = round(XLO + ((XHI - XLO) * (cl(k[2], -1, 1) + 1)) / 2);
  S.K = cl(round(k[3]), 3, 8);
  S.t += d;
  // The word changes when its time is up. A frame that is longer than a
  // word's time, at 900 words a minute, steps over more than one.
  for (let guard = 0; guard < 8; guard++) {
    const dur = (60 / S.wpm) * hold(WORDS[S.idx]);
    if (S.t < dur) break;
    S.t -= dur;
    S.idx = (S.idx + 1) % NW;
    S.read++;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, xp = S.xp, hb = S.hue + 0.5;
  buf.fill(0);
  const BODY = [0, 0, 0], ACC = [0, 0, 0];
  const bh = fr(hb), ah = fr(hb + 0.36);
  hsv(bh, bh > 0.03 && bh < 0.2 ? 0.22 : 0.4, 1, BODY);
  hsv(ah, ah > 0.03 && ah < 0.2 ? 0.45 : 0.9, 1, ACC);
  const put = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    buf[o] = min(255, c[0] * a * 255);
    buf[o + 1] = min(255, c[1] * a * 255);
    buf[o + 2] = min(255, c[2] * a * 255);
  };
  const block = (x, y, s, c, a) => {
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) put(x + i, y + j, c, a);
  };
  const glyph = (cells, cols, x, y, s, c, a) => {
    for (let i = 0; i < cells.length; i++) if (cells[i]) block(x + (i % cols) * s, y + floor(i / cols) * s, s, c, a);
  };
  // A word at scale s, centred on row yc, with its recognition letter on xp.
  const word = (wd, yc, s, a, rec) => {
    const e = extent(wd, xp, s), top = yc - floor((5 * s) / 2);
    // The recognition letter of the word being read comes in white and settles to its colour in 0.12 s.
    const fl = rec ? 0.7 * (1 - sm(S.t / 0.12)) : 0;
    const AC = fl > 0 ? [ACC[0] + (1 - ACC[0]) * fl, ACC[1] + (1 - ACC[1]) * fl, ACC[2] + (1 - ACC[2]) * fl] : ACC;
    for (let i = 0; i < wd.n; i++) glyph(GLYPH[wd.w[i]], 3, e.xr + (i - wd.r) * e.A, top, s, i === wd.r ? AC : BODY, i === wd.r ? 0.3 + 0.7 * a : a);
    if (wd.p) glyph(PUNCT[wd.p], 1, e.xr + (wd.n - wd.r) * e.A, top, s, BODY, a);
    if (rec) S.dbg = { xp, s, xr: e.xr, left: e.left, right: e.right, top, w: wd.w };
  };

  // The guide: a hairline down the pinned column and two bright ticks that
  // bracket the word being read.
  for (let y = 0; y <= MAPY - 2; y++) put(xp, y, ACC, 0.2);
  for (let y = 63; y <= 67; y++) put(xp, y, ACC, 1);
  for (let y = 96; y <= 100; y++) put(xp, y, ACC, 1);

  // The map of the paragraph: ahead of the reader dim, behind brighter, and
  // the word being read at full light. Each bar's recognition LED is tinted.
  for (let i = 0; i < NW; i++) {
    const wd = WORDS[i], m = MAP[i], y = MAPY + 3 * m.line;
    const a = i === S.idx ? 1 : i < S.idx ? 0.5 : 0.22;
    for (let j = 0; j < wd.n; j++) {
      put(m.x + j, y, j === wd.r ? ACC : BODY, a);
      put(m.x + j, y + 1, j === wd.r ? ACC : BODY, a);
    }
  }

  // The trail, oldest first so the newest line is drawn last. Each line eases
  // from the light of the slot below it to its own as a word is passed up.
  const cur = WORDS[S.idx], K = S.K, ease = sm(S.t / 0.1), slots = SLOTS[K];
  for (let q = min(K, S.read) - 1; q >= 0; q--) {
    const wd = WORDS[(S.idx - 1 - q + NW * 2) % NW], sl = slots[q];
    const from = q === 0 ? 1 : 0.62 * Math.pow(0.82, q - 1), to = 0.62 * Math.pow(0.82, q);
    word(wd, sl.yc, min(sl.s, fitScale(wd, xp, sl.s)), from + (to - from) * ease, false);
  }

  // The word being read: as large as 4, as large as fits.
  word(cur, YC, fitScale(cur, xp, 4), 1, true);

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
