// ===== Patternflow pattern =====
// Title:   Shannon's Approximations
// Family:  type
// Idea:    A page of 21 lines of 16 small capitals is typed over and over by a cursor that writes Claude Shannon's approximations to English, from 27 equiprobable symbols up through letter, digram and trigram statistics to word frequencies and word pairs, all counted from the opening of Pride and Prejudice, and every run of letters that is a real word of that text lights up, so the page turns from dim noise into lit words as the order rises.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the series of approximations to English in A Mathematical Theory of Communication, section 3 (Claude Shannon, 1948), counted from the opening of Pride and Prejudice (Jane Austen, 1813), 3x5 capitals drawn for this pattern, pattern round 67
// Round:   67
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Order=0..5, Blackout=0..1
//
// Knob 1: Hue. Turns the page round the wheel: at 0 the words are sea green, word pairs from the book warm gold and the noise between them slate.
// Knob 2: Speed. Letters a second, eight times the knob: 16 at 2, so the cursor goes round the 336 cells of the page in 21 s; 1.6 at 0.2, 24 at 3. Fresh letters burn white and cool over a second.
// Knob 3: Order. Shannon's six steps, in whole steps: 0 the 27 symbols equiprobable, 1 letter frequencies, 2 digrams, 3 trigrams, 4 words by their frequency, 5 each word drawn after the word before it. A change rewrites the whole page from the top in 0.6 s. The bottom row is a gauge of the share of the page's letters that stand in real words.
// Knob 4: Blackout. How the runs that are not words show: dim letters at 0, and turned up they sink under dark ink bars until at 1 only the real words stand on a blacked-out page.

const W = 64, H = 128;
const { floor, min, max, exp, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The opening of Pride and Prejudice, chapter 1 up to Lizzy, cut down to
// Shannon's 27 symbols: capitals and the space. 2,812 symbols, 577 words,
// 236 different words.
const TEXT =
  "IT IS A TRUTH UNIVERSALLY ACKNOWLEDGED THAT A SINGLE MAN IN POSSESSION OF A " +
  "GOOD FORTUNE MUST BE IN WANT OF A WIFE HOWEVER LITTLE KNOWN THE FEELINGS OR " +
  "VIEWS OF SUCH A MAN MAY BE ON HIS FIRST ENTERING A NEIGHBOURHOOD THIS TRUTH " +
  "IS SO WELL FIXED IN THE MINDS OF THE SURROUNDING FAMILIES THAT HE IS " +
  "CONSIDERED THE RIGHTFUL PROPERTY OF SOME ONE OR OTHER OF THEIR DAUGHTERS MY " +
  "DEAR MR BENNET SAID HIS LADY TO HIM ONE DAY HAVE YOU HEARD THAT NETHERFIELD " +
  "PARK IS LET AT LAST MR BENNET REPLIED THAT HE HAD NOT BUT IT IS RETURNED SHE " +
  "FOR MRS LONG HAS JUST BEEN HERE AND SHE TOLD ME ALL ABOUT IT MR BENNET MADE " +
  "NO ANSWER DO YOU NOT WANT TO KNOW WHO HAS TAKEN IT CRIED HIS WIFE " +
  "IMPATIENTLY YOU WANT TO TELL ME AND I HAVE NO OBJECTION TO HEARING IT THIS " +
  "WAS INVITATION ENOUGH WHY MY DEAR YOU MUST KNOW MRS LONG SAYS THAT " +
  "NETHERFIELD IS TAKEN BY A YOUNG MAN OF LARGE FORTUNE FROM THE NORTH OF " +
  "ENGLAND THAT HE CAME DOWN ON MONDAY IN A CHAISE AND FOUR TO SEE THE PLACE " +
  "AND WAS SO MUCH DELIGHTED WITH IT THAT HE AGREED WITH MR MORRIS IMMEDIATELY " +
  "THAT HE IS TO TAKE POSSESSION BEFORE MICHAELMAS AND SOME OF HIS SERVANTS ARE " +
  "TO BE IN THE HOUSE BY THE END OF NEXT WEEK WHAT IS HIS NAME BINGLEY IS HE " +
  "MARRIED OR SINGLE OH SINGLE MY DEAR TO BE SURE A SINGLE MAN OF LARGE FORTUNE " +
  "FOUR OR FIVE THOUSAND A YEAR WHAT A FINE THING FOR OUR GIRLS HOW SO HOW CAN " +
  "IT AFFECT THEM MY DEAR MR BENNET REPLIED HIS WIFE HOW CAN YOU BE SO TIRESOME " +
  "YOU MUST KNOW THAT I AM THINKING OF HIS MARRYING ONE OF THEM IS THAT HIS " +
  "DESIGN IN SETTLING HERE DESIGN NONSENSE HOW CAN YOU TALK SO BUT IT IS VERY " +
  "LIKELY THAT HE MAY FALL IN LOVE WITH ONE OF THEM AND THEREFORE YOU MUST " +
  "VISIT HIM AS SOON AS HE COMES I SEE NO OCCASION FOR THAT YOU AND THE GIRLS " +
  "MAY GO OR YOU MAY SEND THEM BY THEMSELVES WHICH PERHAPS WILL BE STILL BETTER " +
  "FOR AS YOU ARE AS HANDSOME AS ANY OF THEM MR BINGLEY MAY LIKE YOU THE BEST " +
  "OF THE PARTY MY DEAR YOU FLATTER ME I CERTAINLY HAVE HAD MY SHARE OF BEAUTY " +
  "BUT I DO NOT PRETEND TO BE ANYTHING EXTRAORDINARY NOW WHEN A WOMAN HAS FIVE " +
  "GROWN UP DAUGHTERS SHE OUGHT TO GIVE OVER THINKING OF HER OWN BEAUTY IN SUCH " +
  "CASES A WOMAN HAS NOT OFTEN MUCH BEAUTY TO THINK OF BUT MY DEAR YOU MUST " +
  "INDEED GO AND SEE MR BINGLEY WHEN HE COMES INTO THE NEIGHBOURHOOD IT IS MORE " +
  "THAN I ENGAGE FOR I ASSURE YOU BUT CONSIDER YOUR DAUGHTERS ONLY THINK WHAT " +
  "AN ESTABLISHMENT IT WOULD BE FOR ONE OF THEM SIR WILLIAM AND LADY LUCAS ARE " +
  "DETERMINED TO GO MERELY ON THAT ACCOUNT FOR IN GENERAL YOU KNOW THEY VISIT " +
  "NO NEWCOMERS INDEED YOU MUST GO FOR IT WILL BE IMPOSSIBLE FOR US TO VISIT " +
  "HIM IF YOU DO NOT YOU ARE OVER SCRUPULOUS SURELY I DARE SAY MR BINGLEY WILL " +
  "BE VERY GLAD TO SEE YOU AND I WILL SEND A FEW LINES BY YOU TO ASSURE HIM OF " +
  "MY HEARTY CONSENT TO HIS MARRYING WHICHEVER HE CHOOSES OF THE GIRLS THOUGH I " +
  "MUST THROW IN A GOOD WORD FOR MY LITTLE LIZZY ";

// Symbol 0 is the space, 1 to 26 the letters. The text is read as a ring
// (its last space leads back to IT), so every context it holds has a
// letter after it.
const ABC = " ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SRC = Uint8Array.from(TEXT, (c) => ABC.indexOf(c));
const N = SRC.length;
// Shannon's way of drawing the higher orders: open the book at a random
// place where the last letters occur and copy the letter that follows. The
// lists below are those places, by the last letter and by the last two.
const AFTER1 = Array.from({ length: 27 }, () => []);
const AFTER2 = Array.from({ length: 27 * 27 }, () => []);
for (let i = 0; i < N; i++) {
  AFTER1[SRC[i]].push(i);
  AFTER2[SRC[(i + N - 1) % N] * 27 + SRC[i]].push(i);
}
// Words: the vocabulary, the running text as word ids, where each word
// occurs, and every pair of words that stands side by side in the book.
const TOKS = TEXT.trim().split(" ");
const VOCAB = new Map(), WORDS = [];
for (const w of TOKS) if (!VOCAB.has(w)) VOCAB.set(w, WORDS.length), WORDS.push(w);
const NV = WORDS.length, TID = TOKS.map((w) => VOCAB.get(w));
const SUCC = Array.from({ length: NV }, () => []);
const PAIRS = new Set();
for (let k = 0; k + 1 < TID.length; k++) SUCC[TID[k]].push(k), PAIRS.add(TID[k] * NV + TID[k + 1]);

// 3x5 capitals, rows top to bottom, a 1 is a lit LED.
const GLYPHS = [
  "010101111101101", "110101110101110", "011100100100011", "110101101101110", "111100110100111",
  "111100110100100", "011100101101011", "101101111101101", "111010010010111", "001001001101010",
  "101101110101101", "100100100100111", "101111111101101", "111101101101101", "010101101101010",
  "110101110100100", "010101101110011", "110101110101101", "011100010001110", "111010010010010",
  "101101101101111", "101101101101010", "101101111111101", "101101010101101", "101101010010010",
  "111001010100111",
];
const FONT = GLYPHS.map((g) => Uint8Array.from(g, (c) => +c));

// The page: 16 cells across, 4 LEDs each, and 21 lines 6 LEDs apart.
const COLS = 16, ROWS = 21, CELLS = COLS * ROWS, CW = 4, CH = 6, TOP = 1;
// The fresh-ink glow fades with this time constant, and a wipe writes one
// line every WIPE seconds.
const GLOW = 1, WIPE = 0.03;

const rnd = (n) => floor(Math.random() * n);

// The next symbol at the current order.
function nextSymbol(S) {
  const o = S.order;
  let c;
  if (o >= 4) {
    if (S.qi >= S.q.length) {
      let id = -1;
      if (o === 5 && S.pw >= 0 && SUCC[S.pw].length) id = TID[SUCC[S.pw][rnd(SUCC[S.pw].length)] + 1];
      if (id < 0) id = TID[rnd(TID.length)];
      S.q = (S.h1 === 0 ? "" : " ") + WORDS[id] + " ";
      S.qi = 0;
      S.pw = id;
    }
    c = ABC.indexOf(S.q[S.qi++]);
  } else {
    S.q = "", S.qi = 0, S.pw = -1;
    if (o === 0) c = rnd(27);
    else {
      let list = o === 3 ? AFTER2[S.h0 * 27 + S.h1] : o === 2 ? AFTER1[S.h1] : null;
      // A context the book never has (a Q, or two letters a lower order
      // put side by side) falls back to a lower order.
      if (o === 3 && !list.length) list = AFTER1[S.h1];
      c = list && list.length ? SRC[(list[rnd(list.length)] + 1) % N] : SRC[rnd(N)];
    }
  }
  S.h0 = S.h1, S.h1 = c;
  return c;
}

// Which cells are words. The page is read as one ring of text in typing
// order, so a word may run over a line end, and from the bottom line back
// to the top. Each run of letters is looked up in the vocabulary; two words
// one space apart that stand side by side in the book are a pair.
function classify(S) {
  const P = S.P, C = S.cls, L = S.len;
  C.fill(0), L.fill(0);
  let s0 = -1;
  for (let i = 0; i < CELLS; i++) if (P[i] === 0) { s0 = i; break; }
  if (s0 < 0) return C.fill(1);
  const runs = [];
  let i = 1;
  while (i <= CELLS) {
    if (P[(s0 + i) % CELLS] === 0) { i++; continue; }
    const st = i;
    let word = "";
    while (i <= CELLS && P[(s0 + i) % CELLS] !== 0) word += ABC[P[(s0 + i++) % CELLS]];
    const id = VOCAB.get(word);
    runs.push([st, i - st, id === undefined ? -1 : id, 0]);
  }
  for (let r = 0; r + 1 < runs.length; r++) {
    const a = runs[r], b = runs[r + 1];
    if (a[2] >= 0 && b[2] >= 0 && b[0] === a[0] + a[1] + 1 && PAIRS.has(a[2] * NV + b[2])) a[3] = b[3] = 1;
  }
  let words = 0, letters = 0;
  for (const [st, n, id, pair] of runs) {
    const k = id < 0 ? 1 : pair ? 3 : 2;
    letters += n;
    if (id >= 0) words += n;
    for (let j = 0; j < n; j++) {
      const p = (s0 + st + j) % CELLS;
      C[p] = k, L[p] = n;
    }
  }
  S.share = words / max(1, letters);
}

// A fresh page at the current order, as if just typed at the current speed.
function fillPage(S) {
  for (let i = 0; i < CELLS; i++) {
    S.P[i] = nextSymbol(S);
    S.T[i] = S.t - (CELLS - 1 - i) / S.cps;
  }
  S.cur = 0, S.acc = 0, S.dirty = true;
}

export function setup(params) {
  params.s = {
    P: new Uint8Array(CELLS), T: new Float32Array(CELLS), NEXT: new Uint8Array(CELLS),
    cls: new Uint8Array(CELLS), len: new Uint8Array(CELLS),
    t: 0, cps: 16, order: -1, cur: 0, acc: 0, dirty: true, share: 0,
    h0: 0, h1: 0, q: "", qi: 0, pw: -1, wipe: -1, wiped: 0, hue: 0, black: 0.06,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.t += dt;
  S.hue = k[0];
  S.cps = 8 * cl(k[1], 0.2, 3);
  S.black = cl(k[3], 0, 1);
  const order = cl(round(k[2]), 0, 5);
  if (S.order < 0) {
    S.order = order;
    fillPage(S);
  } else if (order !== S.order) {
    // A new order writes a whole new page, revealed a line at a time from
    // the top; the cursor then goes on from the top-left cell.
    S.order = order;
    for (let i = 0; i < CELLS; i++) S.NEXT[i] = nextSymbol(S);
    S.wipe = S.t, S.wiped = 0;
  }
  if (S.wipe >= 0) {
    const upto = min(ROWS, floor((S.t - S.wipe) / WIPE) + 1);
    for (; S.wiped < upto; S.wiped++)
      for (let c = 0; c < COLS; c++) {
        const i = S.wiped * COLS + c;
        S.P[i] = S.NEXT[i], S.T[i] = S.t;
      }
    S.dirty = true;
    if (S.wiped >= ROWS) S.wipe = -1, S.cur = 0, S.acc = 0;
    else return;
  }
  S.acc += dt * S.cps;
  while (S.acc >= 1) {
    S.acc -= 1;
    S.P[S.cur] = nextSymbol(S);
    S.T[S.cur] = S.t;
    S.cur = (S.cur + 1) % CELLS;
    S.dirty = true;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.order < 0) return;
  if (S.dirty) classify(S), (S.dirty = false);
  const h = S.hue, B = S.black;
  // Colours by class: 1 noise, 2 a word, 3 a word of a pair from the book.
  const noise = hsv(h + 0.62, 0.5, 0.42), word = hsv(h + 0.45, 0.8, 1), pair = hsv(h + 0.12, 0.5, 1);
  const ink = hsv(h + 0.64, 0.55, 0.2 * B);
  const nl = (1 - B) * (1 - B);
  const blink = S.wipe < 0 && (S.t * 2.5) % 1 < 0.6;
  for (let i = 0; i < CELLS; i++) {
    const x0 = (i % COLS) * CW, y0 = TOP + floor(i / COLS) * CH;
    const sym = S.P[i], k = S.cls[i];
    if (i === S.cur && blink) {
      for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) display.setPixel(x0 + x, y0 + y, 200, 200, 190);
      continue;
    }
    if (sym === 0) continue;
    let col, lv;
    if (k === 1) (col = noise), (lv = nl);
    else {
      col = k === 3 ? pair : word;
      const n = S.len[i];
      lv = n >= 3 ? 1 : n === 2 ? 0.8 : 0.6;
    }
    // Fresh ink burns toward white and cools into its class colour.
    const g = exp(-(S.t - S.T[i]) / GLOW), wv = 235 * g;
    const r = 255 * col[0] * lv * (1 - g) + wv, gg = 255 * col[1] * lv * (1 - g) + wv, b = 255 * col[2] * lv * (1 - g) + wv;
    const bar = k === 1 && B > 0.01;
    const f = FONT[sym - 1];
    for (let y = 0, j = 0; y < 5; y++)
      for (let x = 0; x < 3; x++, j++) {
        if (f[j]) {
          // Under the ink a noise letter fades into its bar.
          if (bar) display.setPixel(x0 + x, y0 + y, min(255, r + 255 * ink[0]), min(255, gg + 255 * ink[1]), min(255, b + 255 * ink[2]));
          else display.setPixel(x0 + x, y0 + y, min(255, r), min(255, gg), min(255, b));
        } else if (bar) display.setPixel(x0 + x, y0 + y, 255 * ink[0], 255 * ink[1], 255 * ink[2]);
        else if (g > 0.05) display.setPixel(x0 + x, y0 + y, 0.2 * wv, 0.2 * wv, 0.2 * wv);
      }
  }
  // The bottom row is a gauge: the share of the page's letters that stand
  // in real words, about 0, 2, 6 and 27% at orders 0 to 3 and 98% from 4 on.
  const lit = round(W * S.share);
  for (let x = 0; x < W; x++) {
    const c = x < lit ? word : noise, v = x < lit ? 200 : 110;
    display.setPixel(x, H - 1, v * c[0], v * c[1], v * c[2]);
  }
}
