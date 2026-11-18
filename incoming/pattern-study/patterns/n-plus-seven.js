// ===== Patternflow pattern =====
// Title:   N plus Seven
// Family:  type
// Idea:    Three short sentences stand in 3 by 5 capitals beside a tall dictionary of eighty nouns in alphabetical order, and a knob sets N: every noun of the text is swapped for the noun N places after it in the dictionary, a band in the list showing the N places and a bright row where the new word lands, the way Oulipo's N+7 turns a page into nonsense that keeps the grammar of the original.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: N+7, the S+7 method of the Oulipo (Jean Lescure, c. 1961; the group was founded by Raymond Queneau and Francois Le Lionnais in 1960), the 3 by 5 capitals of Saccades (pattern round 106), copied from kasiski-examination.js; pattern round 110
// Round:   110
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, N=0..14, Text=0..2, Tour=1..4
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the words are pale blue, the swapped nouns and the band in the dictionary are amber, and a word that has just landed is white for a third of a second.
// Knob 2: N. How many places down the dictionary each noun goes, from 0, where the sentences read as written, to 14. It catches at whole numbers and opens at 2. The nouns change one after another down the text, 0.05 s apart, and the glow in the dictionary runs from the old row to the new one in 0.18 s.
// Knob 3: Text. Which of three texts of three sentences, six nouns each: 0 a lamp over a barn, a bell, the moon on a roof; 1 a ferry with a piano, a rake in an attic, an otter in a boat; 2 a pail on a stove, a knife and a nail, a river and a fort. It catches at 0, 1 and 2, and every noun of all three is one of the eighty words.
// Knob 4: Tour. How fast the dictionary looks from one noun to the next. At 1, where it opens, it stays 3 s on a noun, and at 4 it stays 0.75 s. The list scrolls so that the noun's own row sits near the top and the row N places below it is in view, 14 rows at most, and the noun's underline in the text goes with it.

const W = 64, H = 128;
const { floor, round, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const mod = (a, b) => ((a % b) + b) % b;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A colour that does not go brown: orange and yellow are made lighter and paler.
function tint(h, s, v, out) {
  const hh = h - floor(h);
  if (hh > 0.02 && hh < 0.2) {
    v = 0.4 + 0.6 * v;
    s *= 0.7;
  }
  hsv(hh, s, v, out);
}

// The face: capitals 3 wide and 5 tall from saccades.js by way of
// kasiski-examination.js, its ten digits, a plus and a full stop.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
  "+": "...|.#.|###|.#.|...",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));
const DOT = [0, 0, 0, 0, 1];

// The dictionary: eighty nouns, none longer than five letters, in alphabetical
// order. setup() sorts it if it is not, so the order the panel shows is always
// the order a dictionary has.
const DICT = "ANVIL APRON ARROW ATTIC BADGE BARN BELL BOAT BRICK BROOM CABIN CAKE CANAL CLOCK CLOUD COMET CRANE CROWN DOOR DRUM DUNE EAGLE EMBER FENCE FERRY FLUTE FORT GATE GLASS GLOVE HARP HILL HORN HORSE INK JUG KEY KITE KNIFE LAMP LEAF LOCK MILL MOON MOSS MOTH NAIL NEST OTTER OVEN PAIL PIANO PLANK PLATE POND PORCH QUILT RAFT RAKE RIVER ROAD ROOF ROPE SAIL SHELL SPOON STAIR STONE STORM STOVE TABLE TENT TOWER TRAIN VASE WAGON WALL WELL WHEEL WOLF".split(" ");
const ND = DICT.length;

// Three texts of three sentences, written for this panel. A noun is in
// braces. There is no "a" or "an" before one, because the word that comes
// after the swap may start with a vowel or not.
const SRC = [
  ["THE {LAMP} SWUNG OVER THE {BARN}.", "ONE {BELL} ROSE FROM THE {WELL}.", "THE {MOON} WALKED ACROSS MY {ROOF}."],
  ["THE {FERRY} CARRIED THE {PIANO} HOME.", "NO {RAKE} REACHED THE {ATTIC}.", "THE {OTTER} SLEPT IN THE {BOAT}."],
  ["THE {PAIL} SANG ON THE {STOVE}.", "MY {KNIFE} FOUND THE {NAIL}.", "THE {RIVER} PASSED THE {FORT}."],
];

const X0 = 1, TW = 36; // the text column: x = 1 to 36
const XR = 38, XB = 40, XA = 41, XD = 44; // the rail, the ribbon, the arrows, the words of the dictionary
const PITCH = 6, ROWS = 21; // a row of the dictionary is 6 LEDs; 21 of them stand in 128
const LP = 8; // a line of the text is 8 LEDs down from the one before
const Y0 = 4, YEND = 107; // the text spreads over rows 4 to 106
const FLASH = 0.35, CASCADE = 0.05, GLIDE = 0.18;

let TEXTS = null; // [text][sentence] = tokens {w, d (dictionary index) or -1, stop}
let NOUNS = null; // [text] = list of {d} in reading order
let MAXL = null; // [text][sentence] = most lines it takes up, over every pair of swaps

function build() {
  DICT.sort();
  const idx = {};
  DICT.forEach((w, i) => (idx[w] = i));
  TEXTS = SRC.map((t) =>
    t.map((s) =>
      s.split(" ").map((tok) => {
        const m = /^(\{)?([A-Z]+)\}?(\.?)$/.exec(tok);
        return { w: m[2], d: m[1] ? idx[m[2]] : -1, stop: m[3] === ".", ni: -1 };
      }),
    ),
  );
  NOUNS = TEXTS.map((t) => {
    const list = [];
    for (const s of t) for (const tok of s) if (tok.d >= 0) (tok.ni = list.length), list.push({ d: tok.d });
    return list;
  });
  MAXL = TEXTS.map((t) =>
    t.map((s) => {
      const nouns = s.filter((tok) => tok.d >= 0);
      let most = 1;
      for (let a = 0; a < 15; a++)
        for (let b = 0; b < 15; b++) {
          const words = s.map((tok) => (tok.d < 0 ? tok.w : DICT[(tok.d + (tok === nouns[0] ? a : b)) % ND]));
          most = max(most, linesOf(s, words).length);
        }
      return most;
    }),
  );
}

// Greedy lines of a sentence for the words it has now: a word is 4 LEDs a
// letter less one, a stop adds 2, and a space is 4.
function linesOf(s, words) {
  const lines = [];
  let line = [], x = 0;
  for (let i = 0; i < s.length; i++) {
    const w = words[i], wd = 4 * w.length - 1 + (s[i].stop ? 2 : 0);
    if (line.length && x + 4 + wd > TW) {
      lines.push(line);
      line = [];
      x = 0;
    }
    if (line.length) x += 4;
    line.push({ i, x, w });
    x += wd;
  }
  lines.push(line);
  return lines;
}

export function setup(params) {
  if (!TEXTS) build();
  params.s = {
    hue: 0, n: 2, pn: 2, tc: 99, text: 0, focus: 0, ft: 0, tour: 1,
    win: 0, ws: 0, wt: 0, wtm: 9,
    buf: new Uint8Array(W * H * 3),
  };
  params.s.win = params.s.ws = params.s.wt = target(params.s, 0);
}

// The top of the dictionary window that shows noun f of the text, the way
// round the ring of eighty that is nearest the window now.
function target(S, f) {
  const t = NOUNS[S.text][f].d - 2;
  return t + ND * round((S.win - t) / ND);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  const n = round(cl(k[1], 0, 14));
  if (n !== S.n) {
    // A change part way through the last one starts from where that was going.
    S.pn = S.n;
    S.n = n;
    S.tc = 0;
  }
  const text = round(cl(k[2], 0, 2));
  if (text !== S.text) {
    S.text = text;
    S.focus = 0;
    S.ft = 0;
    S.pn = S.n;
    S.tc = 99;
    S.win = S.ws = S.wt = target(S, 0);
    S.wtm = 9;
  }
  S.tour = cl(k[3], 1, 4);
  S.tc += d;
  S.ft += d;
  if (S.ft >= 3 / S.tour) {
    S.ft -= 3 / S.tour;
    S.focus = (S.focus + 1) % NOUNS[S.text].length;
    S.ws = S.win;
    S.wt = target(S, S.focus);
    S.wtm = 0;
  }
  const dur = 0.35 + 0.012 * Math.abs(S.wt - S.ws);
  if (S.wtm < dur) {
    S.wtm += d;
    S.win = S.ws + (S.wt - S.ws) * sm(S.wtm / dur);
  } else S.win = S.wt;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf;
  buf.fill(0);
  const TXT = [0, 0, 0], DIM = [0, 0, 0], ACC = [0, 0, 0], HOT = [1, 1, 1];
  hsv(S.hue + 0.55, 0.22, 0.85, TXT);
  tint(S.hue + 0.58, 0.6, 0.42, DIM);
  hsv(S.hue + 0.1, 0.85, 1, ACC);
  const put = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    buf[o] = min(255, c[0] * a * 255);
    buf[o + 1] = min(255, c[1] * a * 255);
    buf[o + 2] = min(255, c[2] * a * 255);
  };
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const cells = (cs, cols, x, y, c, a) => {
    for (let i = 0; i < cs.length; i++) if (cs[i]) put(x + (i % cols), y + floor(i / cols), c, a);
  };
  const word = (str, x, y, c, a, stop) => {
    for (let i = 0; i < str.length; i++) cells(GLYPH[str[i]], 3, x + 4 * i, y, c, a);
    if (stop) cells(DOT, 1, x + 4 * str.length, y, c, a);
  };

  const t = S.text, n = S.n, dtx = TEXTS[t], nouns = NOUNS[t];
  // What each noun reads as now: the old word until its turn in the cascade
  // down the text, then the new one, white and settling to amber.
  const shown = nouns.map((nn, i) => {
    const age = S.tc - CASCADE * i;
    return { word: DICT[(nn.d + (age >= 0 ? n : S.pn)) % ND], age: age >= 0 ? age : -1 };
  });

  // The text, a sentence at a time, each in a block as tall as its longest,
  // the space that is left shared between the sentences.
  let y = Y0;
  const focusN = nouns[S.focus], lines8 = MAXL[t].reduce((a, b) => a + b, 0);
  const gap = cl(floor((YEND - Y0 - LP * lines8) / (dtx.length - 1)), 6, 16);
  for (let si = 0; si < dtx.length; si++) {
    const s = dtx[si];
    const words = s.map((tok) => (tok.d < 0 ? tok.w : shown[tok.ni].word));
    const lines = linesOf(s, words);
    lines.forEach((line, li) => {
      const ly = y + li * LP;
      for (const p of line) {
        const tok = s[p.i], x = X0 + p.x;
        if (tok.d < 0) word(p.w, x, ly, TXT, 1, tok.stop);
        else {
          const sh = shown[tok.ni], f = sh.age < 0 ? 1 : 1 - sm(sh.age / FLASH), wd = 4 * p.w.length - 1;
          // A swapped noun sits on a faint band, as if marked with a highlighter.
          if (n > 0) for (let yy = ly - 1; yy <= ly + 5; yy++) for (let j = -1; j <= wd; j++) put(x + j, yy, ACC, 0.15);
          word(p.w, x, ly, mixc(ACC, HOT, f * 0.9), 1, tok.stop);
          if (tok.ni === S.focus) for (let j = 0; j < wd; j++) put(x + j, ly + 6, ACC, 0.7);
        }
      }
    });
    y += MAXL[t][si] * LP + gap;
  }

  // The readout: N+ and the number, the ruler of fifteen ticks, and which text.
  word("N+", X0, 112, TXT, 1, false);
  word(String(n), X0 + 8, 112, ACC, 1, false);
  for (let i = 0; i < 15; i++) {
    put(X0 + 2 * i, 123, DIM, 1);
    put(X0 + 2 * i, 124, DIM, 1);
  }
  for (let j = 119; j <= 124; j++) put(X0 + 2 * n, j, ACC, 1);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) for (let l = 0; l < 2; l++) put(24 + 4 * i + j, 112 + l, i === t ? ACC : DIM, 1);

  // The dictionary. The window starts at entry S.win, which is a position on
  // a ring of eighty and may run past the end. Row r of the window is entry
  // floor(win) + r, a LED row ((entry - win) * 6) down.
  const win = S.win, j0 = floor(win) - 1;
  const rowY = (j) => 1 + round((j - win) * PITCH);
  const orig = focusN.d + ND * round((win + 2 - focusN.d) / ND);
  // The glow runs from the old row to the new one as the cascade reaches the focus noun.
  const age = S.tc - CASCADE * S.focus, g = age < 0 ? 0 : sm(age / GLIDE);
  const pos = orig + S.pn + (n - S.pn) * g, land = age >= GLIDE ? max(0, 1 - (age - GLIDE) / FLASH) : 0;
  const used = new Set(shown.map((s, i) => (nouns[i].d + (S.tc - CASCADE * i >= 0 ? n : S.pn)) % ND));
  // The band behind the rows between the old word and the new one.
  const top = rowY(orig), bot = rowY(pos) + PITCH - 1;
  if (pos > orig + 0.01) for (let yy = top - 1; yy <= bot; yy++) for (let x = XD - 1; x < W; x++) put(x, yy, ACC, 0.22);
  for (let j = j0; j <= j0 + ROWS + 2; j++) {
    const e = mod(j, ND), yy = rowY(j);
    if (yy < -5 || yy > H) continue;
    if (e === 0) for (let x = XD; x < W - 1; x++) put(x, yy - 1, DIM, 0.6);
    let c = DIM, a = 1;
    if (used.has(e)) (c = ACC), (a = 0.8);
    if (j === orig) (c = TXT), (a = 1);
    if (j === round(pos) && n > 0 && g > 0.99) (c = mixc(ACC, HOT, land * 0.9 + 0.1)), (a = 1);
    word(DICT[e], XD, yy, c, a, false);
  }
  // The ribbon and the arrows: the old row and the new one.
  if (pos > orig + 0.01) for (let yy = rowY(orig) + 2; yy <= rowY(pos) + 2; yy++) put(XB, yy, ACC, 0.8);
  const arrow = (j, c) => cells([1, 0, 1, 1, 1, 1, 1, 1, 1, 0], 2, XA, rowY(j), c, 1);
  arrow(orig, TXT);
  if (n > 0) arrow(round(pos), g > 0.99 ? mixc(ACC, HOT, land * 0.9) : ACC);
  // The rail: the whole ring in one column, eighty ticks, the entries in use
  // brighter, and the window beside it.
  const railY = (e) => 2 + round((e * 123) / (ND - 1));
  for (let e = 0; e < ND; e++) put(XR, railY(e), DIM, 0.5);
  nouns.forEach((nn, i) => {
    const a = S.tc - CASCADE * i, e = (nn.d + (a >= 0 ? n : S.pn)) % ND;
    put(XR, railY(e), a >= 0 && a < FLASH ? mixc(HOT, ACC, sm(a / FLASH)) : ACC, 1);
  });
  for (let r = 0; r < ROWS; r++) put(XR - 1, railY(mod(floor(win) + r, ND)), TXT, 0.7);

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
