// ===== Patternflow pattern =====
// Title:   Number Names
// Family:  type
// Idea:    The English names of the numbers climb the panel in counting order as capitals, each with a bar under every letter as tall as that letter's place in the alphabet, and of the thousand names from zero to nine hundred ninety-nine only forty rises all the way from A towards Z and flashes gold, and only one falls all the way and flashes blue.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the alphabetical-order curiosity of English number names (recreational mathematics, no single author; ProofWiki lists it), checked by counting every name from 0 to 999,999,999 for this pattern; the 3 by 5 capitals of Saccades (pattern round 106), copied from saccades.js through scytale.js; pattern round 108
// Round:   108
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Range=0..99, Mode=0..2
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the letters are cyan, a step up the alphabet is gold and a step down is blue.
// Knob 2: Speed. How fast the list climbs, from 1.2 LEDs a second at 0.2 to 18 at 3. At 2 that is 12 LEDs, one name every 1.7 s while the names fit on a line.
// Knob 3: Range. The number the count starts from, 0 to 99, one whole number at a time. Turning it restarts the list at that number. It opens at 0, where one flashes blue in the second row; from 35 on, forty is already in the first screen.
// Knob 4: Mode. Snaps to one of three readings: 0 marks a name that runs all the way up (gold) or all the way down (blue), 1 marks in every name the longest run of letters that never goes down, 2 the longest run that never goes up.

const W = 64, H = 128;
const { floor, round, min, sin, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The face: capitals 3 wide and 5 tall, one string a row, from saccades.js.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "##.|..#|.#.|#..|###", 3: "##.|..#|.#.|..#|##.", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|##.|..#|##.", 6: ".##|#..|###|#.#|###", 7: "###|..#|.#.|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|##.",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

const ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

// The name of n, 0 to 999, as lines of words, American style with no "and". The
// hyphen and the gap between words are only drawn as a gap: the letters run on
// without them, as they were counted. Hundreds take a line of their own.
function say(n) {
  if (n === 0) return [["zero"]];
  const h = floor(n / 100), r = n % 100, rest = [];
  if (r) {
    if (r < 20) rest.push(ONES[r]);
    else {
      rest.push(TENS[floor(r / 10)]);
      if (r % 10) rest.push(ONES[r % 10]);
    }
  }
  return h ? (r ? [[ONES[h], "hundred"], rest] : [[ONES[h], "hundred"]]) : [rest];
}

const X0 = 1; // first letter column
const BH = 10; // bar rows: the alphabet's 26 places on 10 rows
const LH = 17; // one line: five of letter, a gap, the bars and the baseline under them
const LGAP = 2; // between two lines of one name
const GAP = 3; // between names
const TOP = 3; // where the first name stands at the start

// Longest run of letters that never goes down (up) or never goes up (not up),
// as [start, length], the first when two tie.
function longest(seq, up) {
  let bs = 0, bl = 1, s = 0;
  for (let i = 1; i <= seq.length; i++) {
    if (i < seq.length && (up ? seq[i] >= seq[i - 1] : seq[i] <= seq[i - 1])) continue;
    if (i - s > bl) {
      bl = i - s;
      bs = s;
    }
    s = i;
  }
  return [bs, bl];
}

// Every name once: its letters with their column, line, bar height and the
// step from the letter before, and the two longest runs.
const ENT = [];
for (let n = 0; n < 1000; n++) {
  const gl = [], lines = say(n);
  lines.forEach((line, li) => {
    // A short name is spaced out to fill the line: the pitch from the letters
    // in the line, 7 columns for a few letters and 4 for twelve, and the bars
    // under them are as wide as the pitch allows.
    const cnt = line.join("").length, pitch = cl(floor((46 - 3 * (line.length - 1)) / (cnt - 1)), 4, 7);
    let i = 0;
    line.forEach((word, w) => {
      for (const ch of word) {
        const x = X0 + pitch * i + 3 * w;
        gl.push({ ch: ch.toUpperCase(), c: ch.charCodeAt(0) - 97, x, bw: pitch >= 6 ? 5 : 3, li, bh: 0, d: 0 });
        i++;
      }
    });
  });
  const seq = gl.map((g) => g.c);
  for (let i = 0; i < gl.length; i++) {
    gl[i].bh = 1 + floor((seq[i] * BH) / 26);
    if (i > 0) {
      gl[i].d = seq[i] > seq[i - 1] ? 1 : seq[i] < seq[i - 1] ? -1 : 0;
      // Two different letters never stand on one height: the later one moves a row.
      if (gl[i].d && gl[i].bh === gl[i - 1].bh) gl[i].bh = cl(gl[i].bh + gl[i].d, 1, BH);
    }
  }
  ENT.push({ n, gl, lines: lines.length, h: lines.length * LH + (lines.length - 1) * LGAP + GAP, up: longest(seq, true), dn: longest(seq, false) });
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, mode: 0, base: -1, cnt: 0, off: 0, t: 0, buf: new Uint8Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.mode = cl(round(k[3]), 0, 2);
  // The count restarts from the number the Range knob is on, one whole number at a time.
  const b = round(cl(k[2], 0, 99));
  if (b !== S.base) {
    S.base = b;
    S.cnt = 0;
    S.off = 0;
  }
  S.t += d;
  S.off += d * S.speed * 6;
  for (let e = ENT[(S.base + S.cnt) % 1000]; S.off >= e.h; e = ENT[(S.base + S.cnt) % 1000]) {
    S.off -= e.h;
    S.cnt++;
  }
}

function put(buf, x, y, c, m) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = min(255, c[0] * m * 255);
  buf[o + 1] = min(255, c[1] * m * 255);
  buf[o + 2] = min(255, c[2] * m * 255);
}

function glyph(buf, ch, x, y, c, m) {
  const G = GLYPH[ch];
  for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (G[r * 3 + q]) put(buf, x + q, y + r, c, m);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, mode = S.mode, h = S.hue;
  buf.fill(0);
  const INK = [0, 0, 0], DIM = [0, 0, 0], RISE = [0, 0, 0], FALL = [0, 0, 0], SAME = [0, 0, 0], GOLD = [0, 0, 0], BLUE = [0, 0, 0], BARE = [0, 0, 0], BASE = [0, 0, 0];
  hsv(h + 0.5, 0.55, 0.95, INK);
  hsv(h + 0.5, 0.3, 0.5, DIM);
  hsv(h + 0.12, 0.5, 0.7, RISE);
  hsv(h + 0.6, 0.55, 0.8, FALL);
  hsv(h + 0.5, 0.2, 0.5, SAME);
  hsv(h + 0.12, 0.8, 1, GOLD);
  hsv(h + 0.6, 0.85, 1, BLUE);
  hsv(h + 0.5, 0.3, 0.3, BARE);
  // The baseline takes the colour of the mode, so turning Mode shows on every name.
  if (mode === 0) hsv(h + 0.5, 0.5, 0.42, BASE);
  else hsv(h + (mode === 1 ? 0.12 : 0.6), 0.7, 0.55, BASE);
  const pulse = 0.5 + 0.5 * sin(S.t * 6.5), spark = (S.t * 7) % 12;
  let y0 = TOP - floor(S.off), n = (S.base + S.cnt) % 1000;
  while (y0 < H) {
    const e = ENT[n], len = e.gl.length;
    // The strong colour of the mode, and whether the whole name is the run.
    const strong = mode === 2 ? BLUE : GOLD;
    const full = mode === 0 ? (e.up[1] === len ? GOLD : e.dn[1] === len ? BLUE : null) : mode === 1 ? (e.up[1] === len ? GOLD : null) : e.dn[1] === len ? BLUE : null;
    const run = mode === 1 ? e.up : e.dn, fm = 0.72 + 0.28 * pulse;
    for (let l = 0; l < e.lines; l++) {
      const by = y0 + l * (LH + LGAP) + LH - 1;
      for (let x = 0; x < W; x++) put(buf, x, by, full || BASE, full ? fm : 1);
    }
    if (full) for (let x = 0; x < W; x++) put(buf, x, y0 - 2, full, fm);
    for (let k = 0; k < len; k++) {
      const g = e.gl[k], ly = y0 + g.li * (LH + LGAP);
      let lc, bc, m = 1;
      if (full) {
        lc = bc = full;
        m = fm;
        // A spark runs along the name, up the staircase for forty and down it for one.
        const sd = k - spark + 1;
        if (sd > -1.5 && sd < 1.5) {
          const w = 0.75 * exp(-sd * sd);
          lc = bc = [full[0] + (1 - full[0]) * w, full[1] + (1 - full[1]) * w, full[2] + (1 - full[2]) * w];
        }
      } else if (mode === 0) {
        lc = INK;
        bc = g.d > 0 ? RISE : g.d < 0 ? FALL : SAME;
      } else if (run[1] >= 2 && k >= run[0] && k < run[0] + run[1]) {
        lc = bc = strong;
        m = 0.9;
      } else {
        lc = DIM;
        bc = BARE;
      }
      glyph(buf, g.ch, g.x, ly, lc, m);
      for (let r = 0; r < g.bh; r++) for (let q = 0; q < g.bw; q++) put(buf, g.x + 1 - (g.bw >> 1) + q, ly + 5 + BH - r, bc, m);
    }
    // The number itself, small and dim, at the right of the first line.
    const ds = String(e.n), dx = 63 - (4 * ds.length - 1);
    for (let i = 0; i < ds.length; i++) glyph(buf, ds[i], dx + 4 * i, y0, SAME, 0.7);
    y0 += e.h;
    n = (n + 1) % 1000;
  }
  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
