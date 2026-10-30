// ===== Patternflow pattern =====
// Title:   Lempel-Ziv
// Family:  type
// Idea:    An LZ77 encoder walks a text set in tiny capitals sixteen to a row, and at each step it lights the longest earlier stretch that the coming letters repeat, copies it forward letter by letter in a colour set by how far back it was (the hue climbs with the logarithm of the distance) and writes the one new letter after it in white, so the cumulative rhyme of the House That Jack Built turns into a white phrase and one long band per verse whose colour moves from azure to magenta as the verses grow, letters beyond the sliding window dim, and a counter at the foot keeps the bytes of text against the bytes of code.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: LZ77, the sliding-window universal compressor (Jacob Ziv and Abraham Lempel, A Universal Algorithm for Sequential Data Compression, 1977); texts: This Is the House That Jack Built and The Twelve Days of Christmas (traditional), Charles Dickens's A Tale of Two Cities (1859), Gertrude Stein's Sacred Emily (1913); 3 by 5 capitals drawn for this pattern; pattern round 79
// Round:   79
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Window=0..1, Text=0..1
//
// Knob 1: Hue. Turns the distance colours round the wheel. At 0 a copy from 1 letter back is yellow-green, from 3 back green, 10 back cyan, 35 back (the second verse of the House copying the first) azure, 300 back violet and 2000 back rose; literals stay white.
// Knob 2: Speed. At 2 a literal takes 0.03 s and a copy lights its source for 0.09 s and then copies 143 letters a second, so the first verse of the House is written in 1.7 s and all 1970 letters in 25 s, after which the page holds for 3 s and starts again; everything goes as the knob, ten times slower at 0.2.
// Knob 3: Window. How far back the encoder may look, shrinking as the knob turns: 4096 letters at 0, 1024 at a quarter, 256 at a half, 32 at three quarters and 8 at 1. Letters further back than the window dim. The House codes to 371 bytes at 4096 (19% of its 1970), 345 at 1024, where every verse is still in reach and the distance field is 2 bits shorter, 846 at 256, 1967 at 32, and 3114 at 8, more than the text.
// Knob 4: Text. This Is the House That Jack Built below 0.25, Stein's rose line (35 letters, ten tokens, one of them a copy of 23 letters from 10 back) to 0.5, The Twelve Days of Christmas (2357 letters, 154 tokens) to 0.75, then the opening of A Tale of Two Cities (416 letters, 96 tokens, 81%).

// LZ77 reads the text once from the front. At each position it looks back
// through the window, the last letters it has already passed, for the
// longest run that matches the letters coming next, and sends one token: how
// far back that run starts, how long it is, and the one letter after it. The
// decoder rebuilds the text by copying length letters from distance back,
// a letter at a time, so a run may overlap itself: in Stein's line, from the
// O of the second ROSE the encoder copies 23 letters from 10 back, OSE IS A
// ROSE IS A ROSE, reading letters it is itself writing. A text that repeats
// itself turns into a few long copies; a text that does not turns into short
// ones and literals.
//
// Here the page is 16 letters a row, each letter 3 by 5 LEDs on a pitch of
// 4 by 6, 20 rows on the panel and the page scrolling up as it fills. Every
// letter keeps the token that wrote it: white for the literal, and for a copy
// a hue from the logarithm of the distance, so all the letters one verse of
// the House copies from the verse before take the same colour, and a verse
// reads as a white phrase and a long band. The counter at the foot is the
// plain text in bytes, an arrow, the tokens in bytes (each token log2 W bits
// of distance, 8 of length and 8 for the letter) and the ratio. With a small
// window the code comes out longer than the text.

const W = 64, H = 128, N = W * H, COLS = 16, ROWS = 20, MAXLEN = 255, LOOK = 0.18, STEP = 0.014, LIT = 0.06;
const { floor, min, max, round, log2, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- 3 by 5 capitals, five rows of three bits each, the left LED the
// high bit.
const FONT = {
  A: "25755", B: "65656", C: "34443", D: "65556", E: "74647", F: "74644", G: "34553",
  H: "55755", I: "72227", J: "11152", K: "55655", L: "44447", M: "57755", N: "65555",
  O: "25552", P: "65644", Q: "25573", R: "65655", S: "34216", T: "72222", U: "55557",
  V: "55552", W: "55775", X: "55255", Y: "55222", Z: "71247",
  0: "75557", 1: "26227", 2: "61247", 3: "61216", 4: "55711", 5: "74616", 6: "34757",
  7: "71122", 8: "75757", 9: "75716",
  ".": "00002", ",": "00024", "'": "22000", "-": "00700", ";": "02024", "%": "51245", ">": "42124",
};

// ---- The texts.
function house() {
  const noun = ["THE HOUSE THAT JACK BUILT.", "THE MALT", "THE RAT", "THE CAT", "THE DOG", "THE COW WITH THE CRUMPLED HORN", "THE MAIDEN ALL FORLORN", "THE MAN ALL TATTERED AND TORN", "THE PRIEST ALL SHAVEN AND SHORN", "THE COCK THAT CROWED IN THE MORN", "THE FARMER SOWING HIS CORN"];
  const verb = ["", "THAT LAY IN", "THAT ATE", "THAT KILLED", "THAT WORRIED", "THAT TOSSED", "THAT MILKED", "THAT KISSED", "THAT MARRIED", "THAT WAKED", "THAT KEPT"];
  const out = [];
  for (let k = 0; k < noun.length; k++) {
    let v = "THIS IS " + noun[k];
    for (let j = k; j >= 1; j--) v += ", " + verb[j] + " " + noun[j - 1];
    out.push(v);
  }
  return out.join(" ");
}
function twelveDays() {
  const ord = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH", "NINTH", "TENTH", "ELEVENTH", "TWELFTH"];
  const gift = ["A PARTRIDGE IN A PEAR TREE.", "TWO TURTLE DOVES,", "THREE FRENCH HENS,", "FOUR CALLING BIRDS,", "FIVE GOLD RINGS,", "SIX GEESE A-LAYING,", "SEVEN SWANS A-SWIMMING,", "EIGHT MAIDS A-MILKING,", "NINE LADIES DANCING,", "TEN LORDS A-LEAPING,", "ELEVEN PIPERS PIPING,", "TWELVE DRUMMERS DRUMMING,"];
  const out = [];
  for (let k = 0; k < 12; k++) {
    let v = "ON THE " + ord[k] + " DAY OF CHRISTMAS MY TRUE LOVE GAVE TO ME ";
    for (let j = k; j >= 1; j--) v += gift[j] + " ";
    out.push(v + (k ? "AND " : "") + gift[0]);
  }
  return out.join(" ");
}
const TEXTS = [
  house(),
  "ROSE IS A ROSE IS A ROSE IS A ROSE.",
  twelveDays(),
  "IT WAS THE BEST OF TIMES, IT WAS THE WORST OF TIMES, IT WAS THE AGE OF WISDOM, IT WAS THE AGE OF FOOLISHNESS, IT WAS THE EPOCH OF BELIEF, IT WAS THE EPOCH OF INCREDULITY, IT WAS THE SEASON OF LIGHT, IT WAS THE SEASON OF DARKNESS, IT WAS THE SPRING OF HOPE, IT WAS THE WINTER OF DESPAIR, WE HAD EVERYTHING BEFORE US, WE HAD NOTHING BEFORE US, WE WERE ALL GOING DIRECT TO HEAVEN, WE WERE ALL GOING DIRECT THE OTHER WAY",
];

// The longest match for text[p...] that starts within win letters back,
// the nearest one among equals. It may run on past p into the letters it
// is copying, and it leaves at least one letter for the literal.
function longest(t, p, win) {
  let bestL = 0, bestD = 0;
  const lim = min(MAXLEN, t.length - 1 - p);
  for (let d = 1; d <= min(win, p); d++) {
    const s = p - d;
    let l = 0;
    while (l < lim && t.charCodeAt(s + l) === t.charCodeAt(p + l)) l++;
    if (l > bestL) {
      bestL = l;
      bestD = d;
      if (l === lim) break;
    }
  }
  return [bestD, bestL];
}

export function setup(params) {
  params.s = { ti: -1, buf: new Float32Array(N * 3) };
}

function restart(S, ti) {
  const n = TEXTS[ti].length;
  S.ti = ti;
  S.text = TEXTS[ti];
  S.kind = new Uint8Array(n);
  S.dist = new Uint16Array(n);
  S.born = new Float32Array(n);
  S.lit = new Float32Array(n);
  S.litD = new Uint16Array(n);
  S.p = 0;
  S.tok = null;
  S.tokens = 0;
  S.bits = 0;
  S.top = 0;
  S.scroll = 0;
  S.t = 0;
  S.done = -1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.wbits = round(12 - 9 * cl(k[2] || 0, 0, 1));
  const ti = min(3, floor(cl(k[3] == null ? 0.06 : k[3], 0, 1) * 4));
  if (ti !== S.ti) restart(S, ti);
  S.t += d;
  const f = S.speed, t = S.text, n = t.length;
  // A lit source letter fades over about 0.4 s once it has been read.
  const fade = exp(-d / 0.4);
  for (let i = 0; i < n; i++) if (S.lit[i] > 0) S.lit[i] *= fade;
  let budget = d * f;
  while (budget > 0) {
    if (S.p >= n) {
      // The page holds for 3 s, then starts over.
      if (S.done < 0) S.done = S.t;
      if (S.t - S.done > 3) restart(S, ti);
      break;
    }
    if (!S.tok) {
      const [dist, len] = longest(t, S.p, 1 << S.wbits);
      // Time in units of the knob: LOOK to show the source, STEP a copied
      // letter, LIT for the literal.
      S.tok = { dist, len, j: 0, look: len ? LOOK : 0, lit: LIT, carry: 0 };
      S.tokens++;
      S.bits += S.wbits + 16;
      for (let i = S.p - dist; len && i < min(S.p, S.p - dist + len); i++) {
        S.lit[i] = 1;
        S.litD[i] = dist;
      }
    }
    const T = S.tok;
    if (T.look > 0) {
      const use = min(budget, T.look);
      T.look -= use;
      budget -= use;
      continue;
    }
    if (T.j < T.len) {
      T.carry += budget;
      budget = 0;
      while (T.carry >= STEP && T.j < T.len) {
        T.carry -= STEP;
        const src = S.p - T.dist;
        S.kind[S.p] = 2;
        S.dist[S.p] = T.dist;
        S.born[S.p] = S.t;
        S.lit[src] = 1.6;
        S.litD[src] = T.dist;
        S.p++;
        T.j++;
      }
      if (T.j >= T.len) budget = T.carry;
      continue;
    }
    const use = min(budget, T.lit);
    T.lit -= use;
    budget -= use;
    if (T.lit <= 0) {
      S.kind[S.p] = 1;
      S.born[S.p] = S.t;
      S.p++;
      S.tok = null;
    }
  }
  // Scroll so the row being written is on the page.
  const row = floor(min(S.p, n - 1) / COLS);
  if (row >= S.top + ROWS) S.top = row - ROWS + 1;
  S.scroll += (S.top * 6 - S.scroll) * min(1, d * 10);
}

function put(buf, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = max(buf[o], c[0] * a);
  buf[o + 1] = max(buf[o + 1], c[1] * a);
  buf[o + 2] = max(buf[o + 2], c[2] * a);
}

function glyph(buf, ch, x, y, c, a, y1) {
  const g = FONT[ch];
  if (!g) return;
  for (let r = 0; r < 5; r++) {
    if (y + r >= y1) break;
    const bits = g.charCodeAt(r) - 48;
    for (let b = 0; b < 3; b++) if (bits & (4 >> b)) put(buf, x + b, y + r, c, a);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.text) return;
  const buf = S.buf, t = S.text, win = 1 << S.wbits, white = [1, 1, 1];
  buf.fill(0);
  const hueOf = (dist) => S.hue + 0.25 + 0.065 * log2(dist);
  const r0 = max(0, floor(S.scroll / 6)), end = S.done >= 0 ? cl(1 - (S.t - S.done - 2.5) / 0.5, 0, 1) : 1;
  let above = 0, aboveD = 0;
  for (let i = 0; i < S.p; i++) if (S.lit[i] > 0.05 && floor(i / COLS) < r0 && S.lit[i] > above) {
    above = S.lit[i];
    aboveD = S.litD[i];
  }
  for (let i = r0 * COLS; i < min(t.length, (r0 + ROWS + 1) * COLS); i++) {
    const x = (i % COLS) * 4, y = floor(i / COLS) * 6 - round(S.scroll);
    if (y >= 120 || y + 5 < 0) continue;
    const lit = S.lit[i];
    // A source letter's cell fills with the copy's colour while it is read.
    if (lit > 0.05 && i < S.p) {
      const c = hsv(hueOf(S.litD[i]), 0.9, 1);
      for (let yy = y; yy < min(120, y + 6); yy++) for (let xx = x; xx < x + 4; xx++) put(buf, xx, yy, c, min(0.45, 0.3 * lit) * end);
    }
    if (i >= S.p) continue;
    const ch = t[i], age = S.t - S.born[i], flash = max(0, 1 - age / 0.35);
    const inWin = S.p - i <= win ? 1 : 0.32;
    let c;
    if (S.kind[i] === 2) {
      const h = hsv(hueOf(S.dist[i]), 0.72, 1);
      c = [h[0] + (1 - h[0]) * 0.4 * flash, h[1] + (1 - h[1]) * 0.4 * flash, h[2] + (1 - h[2]) * 0.4 * flash];
    } else c = [0.85, 0.85, 0.85];
    const a = (lit > 0.05 ? 1 : inWin) * end;
    glyph(buf, ch, x, y, c, a, 120);
  }
  // A source above the top edge lights the edge in its colour.
  if (above > 0.05) {
    const c = hsv(hueOf(aboveD), 0.9, 1);
    for (let x = 0; x < W; x++) put(buf, x, 0, c, min(1, above) * 0.8 * end);
  }
  // The cursor: a bar under the next letter.
  if (S.p < t.length) {
    const x = (S.p % COLS) * 4, y = floor(S.p / COLS) * 6 - round(S.scroll) + 5;
    if (y < 120) for (let b = 0; b < 3; b++) put(buf, x + b, y, white, 0.7);
  }
  // The counter: plain bytes > coded bytes, and the ratio.
  const plain = S.p, coded = Math.ceil(S.bits / 8), pct = plain ? round((100 * coded) / plain) : 0;
  const left = plain + ">" + coded, right = pct + "%";
  for (let j = 0; j < left.length; j++) glyph(buf, left[j], j * 4, 122, left[j] === ">" ? [0.5, 0.5, 0.5] : white, 0.8, 128);
  const pc = hsv(S.hue + 0.25 + 0.065 * 8, 0.6, 1);
  for (let j = 0; j < right.length; j++) glyph(buf, right[j], W - (right.length - j) * 4 + 1, 122, pc, 0.9, 128);
  for (let i = 0; i < N; i++) display.setPixel(i % W, floor(i / W), round(cl(buf[i * 3], 0, 1) * 255), round(cl(buf[i * 3 + 1], 0, 1) * 255), round(cl(buf[i * 3 + 2], 0, 1) * 255));
}
