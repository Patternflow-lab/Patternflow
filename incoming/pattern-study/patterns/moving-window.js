// ===== Patternflow pattern =====
// Title:   Moving Window
// Family:  type
// Idea:    A page of sixteen lines of 3x5 capitals is all lowercase x's but for a window of 7 letters under a small amber lamp that hops along the lines like a reader's gaze, about 6 letters a saccade and a third of a second a fixation, with a jump back now and then and a return sweep at each line's end, the fixated letter in white, each letter just read fading back to an x within half a second, and an eye tracker's record of fixations and saccades building up in the gaps between the lines, forward in cyan and back in rose.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the gaze-contingent moving-window paradigm (George McConkie and Keith Rayner, 1975) and the asymmetry of the perceptual span (George McConkie and Keith Rayner, 1976); a 3x5 pixel face drawn for this pattern; the text is written for this pattern, pattern round 83
// Round:   83
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Window=3..15, Mask=0..1
//
// Knob 1: Hue. Turns the whole page round the wheel together. At 0 the window's letters are warm white under an amber lamp, the x's slate blue, forward saccades cyan and regressions rose; at 0.5 the letters are a cool white under a blue lamp and the x's tan.
// Knob 2: Speed. How fast the reader reads. A fixation lasts 0.5 s divided by Speed, a quarter of a second at the opening 2, half a second at 1, two and a half at 0.2 and a sixth at 3, give or take 30%, and a small window stretches it by up to 40%.
// Knob 3: Window. Letters shown on each side of the fixated one, 3 to 15. At the opening 3 the window is 7 letters and the reader slows: saccades of about 6 letters, fixations of about a third of a second, a jump back about one saccade in six, a line in 1.1 s. At 10 and over the saccades are 8 letters, fixations a little over a quarter of a second, a jump back one saccade in eleven and a line in 0.6 s. At 15 the window takes in the whole 16-letter line.
// Knob 4: Mask. What stands outside the window, a quarter of the knob each: x's with the spaces kept, as in the 1975 experiment; other letters, so the page looks like text and reads as nonsense; nothing, so the window floats on a dark page; and x's again with the window leaning right, a quarter of the Window letters on the left and all of them on the right, the shape McConkie and Rayner found readers of English use, about 4 letters left and 15 right.

// McConkie and Rayner sat readers at an eye tracker wired to a computer that
// redrew the screen during each saccade. Only the letters in a window round
// the point of fixation were the real text; every other letter was an x,
// and the spaces stayed, so the page kept its word shapes. With a wide
// window people read as usual. A narrow one slowed them: the saccades got
// shorter and the fixations longer.
//
// The reader here is a small model of that, not their data. A saccade runs
// 2.5 + 0.55 times the letters visible to the right, at most 8, give or
// take a quarter, and lands on the word there, a little left of its middle.
// A jump back goes into the word before, never twice running, and the next
// saccade forward starts from the furthest point read. At a line's end the
// eye sweeps to the next line, and a third of the time the sweep falls short
// on the second word and a small step back follows. After the last line the
// page turns.
//
// Every letter has a reveal level: 1 in the window, falling to half in
// 0.2 s once the window has gone, and its pixels are its own glyph times
// that level plus its mask glyph times the rest. The lamp fades the same
// way, to half in a quarter of a second, so it trails the gaze a little.
// The letters are a 3x5 face drawn for this pattern, 4 LEDs a letter with
// the gap, 16 to a line, 8 rows to a line. The text is written for this
// pattern, three pages of it.

const W = 64, H = 128, COLS = 16, ROWS = 16, CW = 4, LH = 8;
const TRACE = 3; // seconds a fixation takes to settle in the trace
const { floor, min, max, round, ceil, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const TEXT = [
  "YOUR EYES DO NOT GLIDE ALONG A LINE. THEY JUMP ABOUT EIGHT LETTERS AT A TIME AND REST FOR A QUARTER OF A SECOND, AND ONLY THE LETTERS NEAR THE RESTING POINT ARE READ.",
  "IN 1975 GEORGE MCCONKIE AND KEITH RAYNER LET A COMPUTER FOLLOW A READER'S EYE AND CHANGE THE PAGE AS IT MOVED. EVERY LETTER OUTSIDE A WINDOW AROUND THE FIXATION BECAME AN X, BUT THE SPACES STAYED.",
  "WITH A WIDE WINDOW, READING WENT ON AS USUAL. MAKE IT NARROW AND THE EYE TAKES SHORTER JUMPS AND STAYS LONGER. A READER OF ENGLISH USES ABOUT FOUR LETTERS TO THE LEFT AND FIFTEEN TO THE RIGHT.",
  "NOW AND THEN THE EYE GOES BACK, AND AT EACH LINE'S END IT SWEEPS TO THE NEXT.",
];

// 3x5 glyphs, five rows of three, top to bottom.
const FACE = {
  A: "010 101 111 101 101", B: "110 101 110 101 110", C: "011 100 100 100 011", D: "110 101 101 101 110",
  E: "111 100 110 100 111", F: "111 100 110 100 100", G: "011 100 101 101 011", H: "101 101 111 101 101",
  I: "111 010 010 010 111", J: "001 001 001 101 010", K: "101 101 110 101 101", L: "100 100 100 100 111",
  M: "101 111 111 101 101", N: "110 101 101 101 101", O: "010 101 101 101 010", P: "110 101 110 100 100",
  Q: "010 101 101 110 011", R: "110 101 110 101 101", S: "011 100 010 001 110", T: "111 010 010 010 010",
  U: "101 101 101 101 111", V: "101 101 101 101 010", W: "101 101 111 111 101", X: "101 101 010 101 101",
  Y: "101 101 010 010 010", Z: "111 001 010 100 111",
  0: "111 101 101 101 111", 1: "010 110 010 010 111", 5: "111 100 110 001 110", 7: "111 001 010 010 010",
  9: "111 101 111 001 110",
  ".": "000 000 000 000 010", ",": "000 000 000 010 100", "'": "010 010 000 000 000",
};
// The mask: a lowercase x on the bottom three rows, the letters' x-height.
const XMASK = "000 000 101 010 101";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function bits(s) {
  const b = new Uint8Array(15);
  const t = s.replace(/ /g, "");
  for (let i = 0; i < 15; i++) b[i] = t[i] === "1" ? 1 : 0;
  return b;
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return o;
}

// Words wrapped to 16 letters a line, a blank line between paragraphs, 16
// lines a page.
function paginate() {
  const lines = [];
  TEXT.forEach((para, n) => {
    if (n > 0) lines.push("");
    let line = "";
    for (const w of para.split(" ")) {
      if (!line) line = w;
      else if (line.length + 1 + w.length <= COLS) line += " " + w;
      else {
        lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
  });
  const pages = [];
  for (let i = 0; i < lines.length; i += ROWS) {
    const page = lines.slice(i, i + ROWS);
    while (page.length && !page[0]) page.shift();
    pages.push(page);
  }
  return pages;
}

export function setup(params) {
  const glyph = {};
  for (const k of Object.keys(FACE)) glyph[k] = bits(FACE[k]);
  const S = {
    hue: 0, speed: 2, win: 3, mask: 0, t: 0,
    glyph, xm: bits(XMASK), pages: paginate(), page: 0, line: 0, fix: 0, far: 0, timer: 0.3, pause: 0, correct: false, lastReg: false,
    rev: new Float32Array(ROWS * COLS), sub: new Uint8Array(ROWS * COLS),
    trace: [], c: [0, 0, 0], buf: new Float32Array(W * H * 3), glow: new Float32Array(W * H),
  };
  S.fix = landing(S.pages[0][0], 0, 0);
  newPage(S);
  params.s = S;
}

// Stand-in letters for the second mask, never the letter they stand for.
function newPage(S) {
  const page = S.pages[S.page];
  for (let i = 0; i < ROWS * COLS; i++) {
    const ch = (page[floor(i / COLS)] || "")[i % COLS];
    let k = floor(Math.random() * 25);
    if (k >= LETTERS.indexOf(ch)) k++;
    S.sub[i] = k % 26;
  }
  S.rev.fill(0);
}

// Where in the word round column c the eye lands: a little left of its
// middle, give or take a letter.
function landing(line, c, jitter) {
  let a = c, b = c;
  while (a > 0 && line[a - 1] !== " ") a--;
  while (b < line.length - 1 && line[b + 1] !== " ") b++;
  const p = a + floor((b - a) * 0.4) + jitter;
  return cl(p, a, b);
}

function wordStart(line, c) {
  while (c > 0 && line[c - 1] !== " ") c--;
  return c;
}

// The window's reach on each side of the fixation.
function reach(S) {
  const w = round(S.win);
  return S.mask >= 3 ? [ceil(w / 4), w] : [w, w];
}

function nextFixation(S) {
  const page = S.pages[S.page], line = page[S.line], [, right] = reach(S);
  const slow = max(0, 12 - right) / 9; // 1 with the smallest window, 0 from 12 up
  const from = S.fix;
  let reg = false;
  if (S.correct) {
    // The sweep fell short: a small step back to the first word.
    S.fix = landing(line, 0, 0);
    S.correct = false;
    reg = true;
  } else if (!S.lastReg && S.fix > 3 && Math.random() < 0.08 + 0.14 * slow) {
    // A regression into the word before.
    const ws = wordStart(line, S.fix);
    S.fix = ws > 1 ? landing(line, ws - 2, 0) : 0;
    reg = true;
  } else {
    // Forward, from the furthest point read on this line.
    const base = max(S.fix, S.far), len = min(8, 2.5 + 0.55 * right) * (0.75 + 0.5 * Math.random());
    let c = round(base + len);
    if (c >= line.length) {
      // Past the line's end: fixate the last word if the window has not
      // reached it yet, otherwise sweep to the next line.
      const last = wordStart(line, line.length - 1);
      if (line.length - 1 > base + right && last > base) S.fix = landing(line, last, 0);
      else return sweep(S);
    } else {
      while (line[c] === " ") c++;
      let f = landing(line, c, Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0);
      if (f <= base) {
        let e = base;
        while (e < line.length && line[e] !== " ") e++;
        while (e < line.length && line[e] === " ") e++;
        if (e >= line.length) return sweep(S);
        f = landing(line, e, 0);
      }
      S.fix = f;
    }
  }
  S.lastReg = reg;
  S.far = max(S.far, S.fix);
  S.trace.push({ row: S.line, from, to: S.fix, reg, age: 0 });
  S.timer = fixTime(S, slow);
}

function fixTime(S, slow) {
  return (0.5 / S.speed) * (1 + 0.4 * slow) * (0.7 + 0.6 * Math.random());
}

function sweep(S) {
  const page = S.pages[S.page];
  let l = S.line + 1;
  while (l < page.length && !page[l]) l++;
  if (l >= page.length) {
    // The page is read; a breath, then the next one.
    S.page = (S.page + 1) % S.pages.length;
    S.line = 0;
    S.pause = 0.9 / S.speed;
    S.trace.length = 0;
    newPage(S);
  } else S.line = l;
  const line = S.pages[S.page][S.line];
  // A return sweep often falls short and lands on the second word; a small
  // corrective saccade back to the first follows.
  const second = line.indexOf(" ") + 1;
  S.correct = second > 0 && Math.random() < 0.35;
  S.fix = landing(line, S.correct ? second : 0, 0);
  S.far = S.fix;
  S.lastReg = false;
  S.timer = fixTime(S, 0) * (S.correct ? 0.6 : 1.2);
}

// The lamp over the window: full across the letters in view and falling
// off over four LEDs past them, brightest round the fixation, and spilling
// a line and a half up and down onto lines that stay x's. Where it has been
// it fades to half in a quarter of a second.
function lampOn(S, d) {
  const G = S.glow, fade = exp(-d * 2.8);
  for (let i = 0; i < G.length; i++) G[i] *= fade;
  if (S.pause > 0) return;
  const [left, right] = reach(S);
  const y0 = S.line * LH, cx = S.fix * CW + 1.5, cy = y0 + 2;
  const xa = (S.fix - left) * CW - 1, xb = (S.fix + right) * CW + 3;
  for (let y = max(0, y0 - 14); y <= min(H - 1, y0 + 19); y++) {
    const dy = y < y0 - 1 ? (y0 - 1 - y) / 7 : y > y0 + 5 ? (y - y0 - 5) / 7 : 0;
    const fy = exp(-dy * dy * 1.4);
    for (let x = 0; x < W; x++) {
      const out = x < xa ? xa - x : x > xb ? x - xb : 0;
      const dx = (x + 0.5 - cx) / 7, ey = (y + 0.5 - cy) / 5;
      const a = max(0, 1 - out / 4.5) * fy * (0.45 + 0.55 * exp(-dx * dx - ey * ey));
      if (a > G[y * W + x]) G[y * W + x] = a;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.win = cl(k[2] == null ? 3 : k[2], 3, 15);
  S.mask = min(3, floor(cl(k[3] == null ? 0.06 : k[3], 0, 1) * 4));
  S.t += d;
  for (const f of S.trace) f.age += d;
  // Letters fade back to their mask, to half in 0.2 s whatever the speed.
  const fade = exp(-d * 3.4);
  for (let i = 0; i < S.rev.length; i++) S.rev[i] *= fade;
  if (S.pause > 0) {
    S.pause -= d;
    lampOn(S, d);
    return;
  }
  S.timer -= d;
  if (S.timer <= 0) nextFixation(S);
  lampOn(S, d);
  const line = S.pages[S.page][S.line], [left, right] = reach(S);
  for (let c = max(0, S.fix - left); c <= min(line.length - 1, S.fix + right); c++) S.rev[S.line * COLS + c] = 1;
}

function add(B, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3;
  B[o] += c[0] * a;
  B[o + 1] += c[1] * a;
  B[o + 2] += c[2] * a;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const B = S.buf, page = S.pages[S.page], h = S.hue;
  B.fill(0);
  const ink = hsv(h + 0.11, 0.3, 1, [0, 0, 0]), hot = hsv(h + 0.12, 0.08, 1, [0, 0, 0]);
  const xs = hsv(h + 0.6, 0.64, 0.56, [0, 0, 0]), lamp = hsv(h + 0.09, 0.85, 0.44, [0, 0, 0]);
  const fwd = hsv(h + 0.5, 0.85, 0.75, [0, 0, 0]), back = hsv(h + 0.93, 0.7, 0.85, [0, 0, 0]);
  const reading = S.pause <= 0, [left, right] = reach(S);

  for (let i = 0; i < W * H; i++) if (S.glow[i] > 0.004) add(B, i % W, floor(i / W), lamp, S.glow[i]);

  // Letters.
  for (let r = 0; r < page.length; r++) {
    const line = page[r];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === " ") continue;
      const g = S.glyph[ch] || S.xm, v = S.rev[r * COLS + c];
      const m = S.mask === 2 ? null : S.mask === 1 ? S.glyph[LETTERS[S.sub[r * COLS + c]]] : S.xm;
      const fx = reading && r === S.line && c === S.fix, col = fx ? hot : ink;
      for (let p = 0; p < 15; p++) {
        const x = c * CW + (p % 3), y = r * LH + floor(p / 3);
        if (g[p]) add(B, x, y, col, v * (fx ? 1.15 : 0.92));
        if (m && m[p]) add(B, x, y, xs, 1 - v);
      }
    }
  }

  // The trace: a dot at each fixation and a line along each saccade in the
  // gap under its line, fading over a few seconds.
  for (const f of S.trace) {
    const a = 0.35 + 0.65 * max(0, 1 - f.age / TRACE), y = f.row * LH + 6;
    const xa = min(f.from, f.to) * CW + 1, xb = max(f.from, f.to) * CW + 1;
    for (let x = xa; x <= xb; x++) add(B, x, y, f.reg ? back : fwd, a * 0.55);
    add(B, f.to * CW + 1, y, hot, a * 0.8);
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, min(255, B[o]), min(255, B[o + 1]), min(255, B[o + 2]));
    }
}
