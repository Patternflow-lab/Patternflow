// ===== Patternflow pattern =====
// Title:   Autogram
// Family:  type
// Idea:    A sentence that counts its own letters fills the panel in 3 by 5 capitals, and a checker goes through it letter by letter, lighting every occurrence of that letter in reading order while a tally climbs towards the number the sentence claims, so the claim word and the bar under the text turn true when the tally reaches it; with Doubt turned up some claims are changed first, the check finds them false, and the sentence is rewritten again and again with the numbers it actually has, faster and faster, until it either comes true or is caught going round a loop of hundreds of sentences.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: autograms, named by Lee Sallows, the first of his printed in Douglas Hofstadter's Metamagical Themas column in Scientific American, January 1982; the three sentences here were found for this pattern; 3 by 5 capitals from Typewriter (pattern round 18) and 5 by 7 figures from Photon Disk (pattern round 70); pattern round 72
// Round:   72
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Sentence=0..2, Doubt=0..1
//
// Knob 1: Hue. Moves the two colours together along the part of the wheel away from red, which is kept for a false claim: at 0 the counted letters are cyan and the claims amber, at 0.5 blue-violet and green, at 1 magenta and sea green; the sentence and the dark ground take a tint of the same two.
// Knob 2: Speed. At 2 the sentence is written in 1.8 s, 125 characters a second, and the checker takes 0.035 s an occurrence and 0.4 s a letter, so THIS SENTENCE HAS, 152 letters of 19 kinds, is checked in 13 s and held 3 s when true; the first rewrite takes 1.5 s and each after it 0.8 times as long, down to 240 a second. At 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Sentence. Which autogram comes first; the others follow in turn: 0 THIS SENTENCE HAS, 1 THIS PANEL SHOWS, 2 THESE LIGHTS SPELL. Turning it starts the new one at once.
// Knob 4: Doubt. How many claims are changed, by 1 to 3, before a sentence is checked: none below 0.125, so the opening 0.06 shows the sentence as found, one at 0.25, two at 0.5, three at 0.75 and four at 1. A changed claim changes the letters of its own number word, so more claims than that come out false.

// Each sentence lists, for every letter it uses, how many times that letter
// appears in it, counting letters only, the S of each 'S included. The
// three were found by a search for this pattern that starts from random
// claims, writes the sentence, counts it and copies some of the counts back
// into the claims, with restarts, until a sentence comes out true of itself;
// setup counts each one again and stops if a claim is wrong.
//
// Copying every count back at once, which is what the rewrite here does,
// almost never finds one. In 1200 tries from the first sentence with one
// to four claims moved by 1 to 3, the rewriting was caught in a loop of
// 453 sentences 1042 times, of 397 sentences 109 times and of 127
// sentences 46 times, half of them within 760 rewrites and all within 1320,
// and came true 3 times: twice as the sentence it started from, once as an
// autogram nobody had written. From the second sentence the loops were 257,
// 75, 306, 172, 21 and 12 sentences long (all within 2220 rewrites), from
// the third 415, 94, 28 and 35. The chase gives up at 3000.

const W = 64, H = 128;
const { floor, min, max, round, abs, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

const SENTENCES = [
  "THIS SENTENCE HAS THREE A'S, TWO C'S, TWO D'S, TWENTY-NINE E'S, TWO F'S, THREE G'S, NINE H'S, EIGHT I'S, ONE L, SIXTEEN N'S, SEVEN O'S, SIX R'S, TWENTY-SEVEN S'S, EIGHTEEN T'S, TWO U'S, FOUR V'S, SEVEN W'S, THREE X'S AND THREE Y'S.",
  "THIS PANEL SHOWS THREE A'S, TWO D'S, TWENTY-THREE E'S, TWO F'S, TWO G'S, NINE H'S, SIX I'S, THREE L'S, ELEVEN N'S, EIGHT O'S, TWO P'S, SEVEN R'S, TWENTY-SIX S'S, TWENTY T'S, TWO U'S, THREE V'S, TEN W'S, THREE X'S AND FOUR Y'S.",
  "THESE LIGHTS SPELL TWO A'S, TWO D'S, TWENTY-FIVE E'S, THREE F'S, TWO G'S, SEVEN H'S, SIX I'S, FOUR L'S, TEN N'S, SEVEN O'S, TWO P'S, SIX R'S, THIRTY S'S, SEVENTEEN T'S, TWO U'S, SEVEN V'S, SEVEN W'S, THREE X'S AND THREE Y'S.",
];
const ONES = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
const TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
const word = (n) => (n < 20 ? ONES[n] : TENS[floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : ""));
const NUMBER = {};
for (let n = 0; n < 100; n++) NUMBER[word(n)] = n;
const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// ---- The sentence from its opening words and its claims, with where each
// claim sits: the number word, the letter and its 'S.
function build(pre, L, c) {
  let text = pre + " ";
  const item = [];
  L.forEach((l, i) => {
    if (i === L.length - 1) text += "AND ";
    const a = text.length;
    text += word(c[i]) + " " + l + (c[i] !== 1 ? "'S" : "");
    item.push([a, text.length]);
    text += i === L.length - 1 ? "." : i === L.length - 2 ? " " : ", ";
  });
  return { text, item };
}
function tally(text, L) {
  const n = new Array(26).fill(0);
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i) - 65;
    if (k >= 0 && k < 26) n[k]++;
  }
  return L.map((l) => n[l.charCodeAt(0) - 65]);
}
// Parse a sentence back into opening words and claims, then check it.
const BOOK = SENTENCES.map((s, si) => {
  const re = /([A-Z]+(?:-[A-Z]+)?) ([A-Z])(?:'S)?(?=[,.]| AND)/g;
  const L = [], c = [];
  let m, first = -1;
  while ((m = re.exec(s))) {
    if (!(m[1] in NUMBER)) continue;
    if (first < 0) first = m.index;
    L.push(m[2]), c.push(NUMBER[m[1]]);
  }
  const pre = s.slice(0, first - 1), b = build(pre, L, c), n = tally(s, L);
  if (b.text !== s) throw new Error(`sentence ${si} does not rebuild`);
  for (let i = 0; i < L.length; i++) if (n[i] !== c[i]) throw new Error(`sentence ${si} has ${n[i]} ${L[i]}, not ${c[i]}`);
  for (const ch of AZ) if (s.includes(ch) && !L.includes(ch)) throw new Error(`sentence ${si} does not list ${ch}`);
  return { pre, L, c };
});

// ---- Faces. 3 x 5 capitals from Typewriter, one bit per LED, rows from
// the top; 5 x 7 capitals and figures from Photon Disk, and three signs.
const G35 = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101111011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101011", V: "101101101010010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111", ".": "000000000000010", ",": "000000000010100",
  "-": "000000111000000", "'": "010010000000000",
};
const G57 = {
  A: ".###. #...# #...# ##### #...# #...# #...#", C: ".###. #...# #.... #.... #.... #...# .###.", D: "####. #...# #...# #...# #...# #...# ####.",
  E: "##### #.... #.... ####. #.... #.... #####", F: "##### #.... #.... ####. #.... #.... #....", G: ".###. #...# #.... #.### #...# #...# .####",
  H: "#...# #...# #...# ##### #...# #...# #...#", I: ".###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.", L: "#.... #.... #.... #.... #.... #.... #####",
  N: "#...# #...# ##..# #.#.# #..## #...# #...#", O: ".###. #...# #...# #...# #...# #...# .###.", P: "####. #...# #...# ####. #.... #.... #....",
  R: "####. #...# #...# ####. #.#.. #..#. #...#", S: ".#### #.... #.... .###. ....# ....# ####.", T: "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..",
  U: "#...# #...# #...# #...# #...# #...# .###.", V: "#...# #...# #...# #...# #...# .#.#. ..#..", W: "#...# #...# #...# #.#.# #.#.# #.#.# .#.#.",
  X: "#...# #...# .#.#. ..#.. .#.#. #...# #...#", Y: "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..", 0: ".###. #...# #..## #.#.# ##..# #...# .###.",
  1: "..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.", 2: ".###. #...# ....# ...#. ..#.. .#... #####", 3: "##### ...#. ..#.. ...#. ....# #...# .###.",
  4: "...#. ..##. .#.#. #..#. ##### ...#. ...#.", 5: "##### #.... ####. ....# ....# #...# .###.", 6: "..##. .#... #.... ####. #...# #...# .###.",
  7: "##### ....# ...#. ..#.. .#... .#... .#...", 8: ".###. #...# #...# .###. #...# #...# .###.", 9: ".###. #...# #...# .#### ....# ...#. .##..",
  "<": "...#. ..#.. .#... #.... .#... ..#.. ...#.", ">": ".#... ..#.. ...#. ....# ...#. ..#.. .#...", "=": "..... ..... ##### ..... ##### ..... .....",
};
for (const k in G57) G57[k] = G57[k].replace(/ /g, "");

const blend = (c1, c2, u) => [c1[0] + (c2[0] - c1[0]) * u, c1[1] + (c2[1] - c1[1]) * u, c1[2] + (c2[2] - c1[2]) * u];
const T_TYPE = 0.008, T_IN = 0.1, T_OCC = 0.035, T_V = 0.3, T_TRUE = 3, T_LOOP = 4, T_R0 = 1.5, T_RMIN = 1 / 240, MAXR = 3000;

function wrap(s, text) {
  // Break at spaces, or after a hyphen; 16 letters of 4 LEDs a line.
  const pos = new Int16Array(text.length * 2).fill(-1);
  let col = 0, line = 0, i = 0;
  while (i < text.length) {
    let j = i;
    while (j < text.length && text[j] !== " " && !(j > i && text[j - 1] === "-")) j++;
    if (col > 0 && col + (j - i) > 16) (line++), (col = 0);
    for (let k = i; k < j; k++) (pos[k * 2] = col++), (pos[k * 2 + 1] = line);
    if (text[j] === " ") (col++), j++;
    i = j;
  }
  s.pos = pos;
  s.lines = line + 1;
}

function setText(s, c) {
  const b = BOOK[s.si], { text, item } = build(b.pre, b.L, c);
  s.claim = c.slice();
  s.text = text;
  s.item = item;
  s.count = tally(text, b.L);
  s.itemOf = new Int8Array(text.length).fill(-1);
  s.litAt = new Float32Array(text.length).fill(-9);
  item.forEach(([a, e], i) => {
    for (let k = a; k < e; k++) s.itemOf[k] = i;
  });
  wrap(s, text);
}

function start(s, si, m) {
  s.si = si;
  s.m = m;
  const b = BOOK[si], c = b.c.slice();
  const vol = [];
  b.L.forEach((l, i) => "EFGHILNORSTUVWXY".includes(l) && vol.push(i));
  for (let k = 0; k < m && vol.length; k++) {
    const i = vol.splice(floor(Math.random() * vol.length), 1)[0];
    let d = 0;
    while (!d || c[i] + d < 1) d = (Math.random() < 0.5 ? -1 : 1) * (1 + floor(Math.random() * 3));
    c[i] += d;
  }
  setText(s, c);
  s.changedAt = new Float32Array(s.text.length).fill(-9);
  s.phase = 0; // 0 check, 1 true, 2 chase, 3 loop
  s.t = 0;
  s.li = 0;
  s.sub = -1; // -1 writing, 0 intro, 1 count, 2 verdict
  s.typed = 0;
  s.k = 0;
  s.done = new Int16Array(b.L.length).fill(-1);
  s.occ = occ(s, 0);
  s.round = 0;
  s.seen = null;
  s.born = s.clock;
}
function occ(s, li) {
  const l = BOOK[s.si].L[li], o = [];
  for (let i = 0; i < s.text.length; i++) if (s.text[i] === l) o.push(i);
  return o;
}
const keyOf = (c) => c.join(",");

export function setup(params) {
  const s = (params.s = {});
  s.clock = 0;
  s.kS = -1;
  s.kM = -1;
  s.fb = new Uint8ClampedArray(W * H * 3);
  start(s, 0, 0);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, kn = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  s.hue = kn[0] || 0;
  const rate = cl(kn[1] == null ? 2 : kn[1], 0.2, 3) / 2;
  const si = round(cl(kn[2] || 0, 0, 2)), m = round(cl(kn[3] == null ? 0.06 : kn[3], 0, 1) * 4);
  if (si !== s.kS || m !== s.kM) {
    s.kS = si;
    s.kM = m;
    start(s, si, m);
  }
  s.clock += dt;
  s.t += dt * rate;
  const L = BOOK[s.si].L;
  for (let guard = 0; guard < 24; guard++) {
    if (s.phase === 0) {
      if (s.sub === -1) {
        const n = min(s.text.length - s.typed, floor(s.t / T_TYPE));
        s.typed += n;
        s.t -= n * T_TYPE;
        if (s.typed < s.text.length) break;
        s.sub = 0;
      } else if (s.sub === 0) {
        if (s.t < T_IN) break;
        s.t -= T_IN;
        s.sub = 1;
      } else if (s.sub === 1) {
        if (s.k >= s.occ.length) {
          s.sub = 2;
          s.done[s.li] = s.k;
          continue;
        }
        if (s.t < T_OCC) break;
        s.t -= T_OCC;
        s.litAt[s.occ[s.k++]] = s.clock;
      } else {
        if (s.t < T_V) break;
        s.t -= T_V;
        s.li++;
        if (s.li >= L.length) {
          s.t = 0;
          if (s.done.every((n, i) => n === s.claim[i])) s.phase = 1;
          else (s.phase = 2), (s.seen = new Map([[keyOf(s.claim), 0]])), (s.round = 0);
        } else (s.sub = 0), (s.k = 0), (s.occ = occ(s, s.li));
      }
    } else if (s.phase === 1 || s.phase === 3) {
      // Caught in a loop, the rewriting goes on round it, 8 a second.
      if (s.phase === 3 && s.period && s.t >= s.next) {
        const prev = s.claim, c = s.count.slice();
        setText(s, c);
        s.changedAt = new Float32Array(s.text.length).fill(-9);
        s.item.forEach(([a, e], i) => {
          if (c[i] !== prev[i]) for (let k = a; k < e; k++) s.changedAt[k] = s.clock;
        });
        s.next += 0.125;
        continue;
      }
      if (s.t < (s.phase === 1 ? T_TRUE : T_LOOP)) break;
      start(s, (s.si + 1) % 3, s.m);
    } else {
      const d = max(T_RMIN, T_R0 * Math.pow(0.8, s.round));
      if (s.t < d) break;
      s.t -= d;
      // Rewrite every claim with the count it has.
      const prev = s.claim, c = s.count.slice();
      setText(s, c);
      s.round++;
      s.changedAt = new Float32Array(s.text.length).fill(-9);
      s.item.forEach(([a, e], i) => {
        if (c[i] !== prev[i]) for (let k = a; k < e; k++) s.changedAt[k] = s.clock;
      });
      const key = keyOf(c);
      if (s.count.every((n, i) => n === c[i])) (s.phase = 1), (s.t = 0), (s.verdict = "TRUE");
      else if (s.seen.has(key)) (s.phase = 3), (s.t = 0), (s.next = 0.125), (s.period = s.round - s.seen.get(key));
      else if (s.round >= MAXR) (s.phase = 3), (s.t = 0), (s.period = 0);
      else s.seen.set(key, s.round);
    }
  }
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const fb = s.fb, b = BOOK[s.si], L = b.L, nL = L.length;
  // Both colours stay clear of red, which marks a false claim.
  const hk = 0.11 + 0.34 * cl(s.hue, 0, 1), hc = hk + 0.41;
  const CNT = hsv(hc, 0.8, 255), CLM = hsv(hk, 0.85, 255), TXT = hsv(hk, 0.3, 155), TONE = blend(TXT, CNT, 0.42), RED = [255, 34, 30], WHT = [255, 255, 255];
  const BG = hsv(hc, 0.7, 10);
  for (let i = 0; i < W * H; i++) (fb[i * 3] = BG[0]), (fb[i * 3 + 1] = BG[1]), (fb[i * 3 + 2] = BG[2]);
  const put = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = (y * W + x) * 3;
    fb[i] = c[0] * a;
    fb[i + 1] = c[1] * a;
    fb[i + 2] = c[2] * a;
  };
  const fadeIn = cl((s.clock - s.born) / 0.4, 0, 1);
  const pitch = s.lines * 6 <= 102 ? 6 : floor(102 / s.lines);
  const checking = s.phase === 0, writing = checking && s.sub === -1, cur = checking && !writing ? s.li : -1;
  // Which claims are known false.
  const bad = new Uint8Array(nL);
  for (let i = 0; i < nL; i++) {
    if (checking) bad[i] = s.done[i] >= 0 && (i < s.li || s.sub === 2) && s.done[i] !== s.claim[i] ? 1 : 0;
    else bad[i] = s.count[i] !== s.claim[i] ? 1 : 0;
  }
  const sweep = s.phase === 1 ? s.t * 60 : -99;
  // ---- The sentence.
  const shown = writing ? s.typed : s.text.length;
  for (let ci = 0; ci < shown; ci++) {
    const ch = s.text[ci], g = G35[ch];
    if (!g) continue;
    const X = s.pos[ci * 2] * 4, Y = s.pos[ci * 2 + 1] * pitch;
    const it = s.itemOf[ci], lit = s.litAt[ci];
    let col = lit > -9 ? TONE : TXT;
    if (it >= 0 && bad[it]) col = RED;
    if (it === cur && cur >= 0) col = CLM;
    if (checking && ch === L[cur] && lit > -9) {
      const age = s.clock - lit;
      col = blend(CNT, WHT, cl(1 - age / 0.15, 0, 1) * 0.8);
      if (s.sub === 2) col = blend(col, TONE, cl(s.t / T_V, 0, 1));
    }
    if (writing && shown - ci < 6) col = blend(col, WHT, 1 - (shown - ci) / 6);
    const ch2 = s.clock - s.changedAt[ci];
    if (ch2 < 0.35) col = blend(col, WHT, 1 - ch2 / 0.35);
    if (sweep > -99) {
      const d = abs(Y - sweep + 20);
      if (d < 20) col = blend(col, CNT, (1 - d / 20) * 0.85);
    }
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 3; x++) if (g.charCodeAt(y * 3 + x) === 49) put(X + x, Y + y, col, fadeIn);
  }
  // ---- The tally line: letter, count, sign, claim; or the round; or the
  // verdict.
  let line = [];
  if (writing) line = [];
  else if (checking) {
    const n = s.sub === 2 ? s.done[cur] : s.k, c = s.claim[cur];
    const sign = n < c ? "<" : n > c ? ">" : "=";
    const sc = s.sub === 2 ? (n === c ? CNT : RED) : n > c ? RED : WHT;
    line = [[L[cur], TXT], [" ", TXT], ...[...String(n).padStart(2, " ")].map((d) => [d, CNT]), [sign, sc], ...[...String(c)].map((d) => [d, CLM])];
  } else if (s.phase === 2) line = s.round ? [..."ROUND "].map((d) => [d, TXT]).concat([...String(s.round)].map((d) => [d, CLM])) : [..."FALSE"].map((d) => [d, RED]);
  else if (s.phase === 1) line = [..."TRUE"].map((d) => [d, CNT]);
  else if (s.period) line = [..."LOOP "].map((d) => [d, RED]).concat([...String(s.period)].map((d) => [d, CLM]));
  else line = [..."ROUND "].map((d) => [d, TXT]).concat([...String(s.round)].map((d) => [d, RED]));
  const x0 = floor((W - (line.length * 6 - 1)) / 2);
  line.forEach(([d, col], k) => {
    const g = G57[d];
    if (!g) return;
    for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (g[y * 5 + x] === "#") put(x0 + k * 6 + x, 104 + y, col, fadeIn);
  });
  // ---- The bars: a dim column as tall as each claim, a bright one as tall
  // as the count so far, half an LED a letter.
  const bx = floor((W - (nL * 3 - 1)) / 2);
  for (let i = 0; i < nL; i++) {
    const c = s.claim[i];
    let n = s.count[i];
    if (checking) n = i < cur ? s.done[i] : i === cur ? (s.sub === 2 ? s.done[i] : s.k) : 0;
    const hi = i === cur ? 1 : 0.75;
    const fill = bad[i] || (checking && i === cur && n > c) ? RED : CNT;
    if (writing && s.item[i][1] > s.typed) continue;
    const top = Math.ceil(c / 2) - 1;
    for (let r = 0; r < 16; r++) {
      const nn = cl(n / 2 - r, 0, 1);
      let col = null, a = 0;
      if (r === top) (col = n === c ? blend(CNT, WHT, 0.5) : n > c ? RED : CLM), (a = i === cur ? 1 : 0.8);
      else if (nn > 0) (col = fill), (a = (0.35 + 0.65 * nn) * hi);
      else if (r < top) (col = CLM), (a = i === cur ? 0.16 : 0.09);
      if (col) for (let x = 0; x < 2; x++) put(bx + i * 3 + x, 127 - r, col, a * fadeIn);
    }
    if (c > 32 || n > 32) for (let x = 0; x < 2; x++) put(bx + i * 3 + x, 111, RED, fadeIn);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, fb[i] | 0, fb[i + 1] | 0, fb[i + 2] | 0);
    }
}
