// ===== Patternflow pattern =====
// Title:   Mesostic
// Family:  type
// Idea:    A reader slides through a stretch of Thoreau's Walden in the bottom line until the next letter of a spine word that Cage's mesostic rule allows comes to the centre, the letter locks as a gold capital, the words the rule lets stand stay as its wings and the rest fade, and the page climbs a line, so the spine word reads down the middle of the panel again and again.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: John Cage's mesostics (from the late 1960s; Writing through Finnegans Wake, 1978) and his 50% and 100% rules, written through Henry David Thoreau's Walden (1854); letters from the MatrixLight6 pixel font of trip5's Matrix-Fonts (CC-BY), as the device's firmware carries it; pattern round 75
// Round:   75
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..3, Rule=0..1
//
// Knob 1: Hue. Turns the capitals and the wings round the wheel together: at 0 the capitals are gold and the wing text pale sky blue.
// Knob 2: Speed. At 2 the reader slides for 0.45 to 0.95 s depending on how much text it passes over, the capital locks in 0.4 s and the page climbs a line in 0.35 s: a new line every 1.28 s on average with THOREAU. At 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Word. The spine: THOREAU, WALDEN, MUREAU (Cage's 1970 piece made from Thoreau's Journal, MUsic and thoREAU) or SILENCE (Cage's 1961 book). The page opens on the first 17 lines of the mesostic; turning it leaves a blank line and the reader starts a new mesostic from where it is.
// Knob 4: Rule. Below 0.5 a 50% mesostic: between two capitals the second capital's letter does not appear. From 0.5 a 100% mesostic: the first capital's letter does not appear there either, so the wings are shorter and more letters are passed over. Turning it leaves a blank line like Word.

const W = 64, H = 128, NP = W * H;
const { floor, round, min, max, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The source. Three passages of Walden (1854), from the chapter "Where
// I Lived, and What I Lived For", in the order the chapter has them, quoted
// as printed. The reader drops the punctuation, turns hyphens into spaces
// and reads in lower case: 304 words.
const WALDEN = [
  "I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived. I did not wish to live what was not life, living is so dear; nor did I wish to practise resignation, unless it was quite necessary. I wanted to live deep and suck out all the marrow of life, to live so sturdily and Spartan-like as to put to rout all that was not life, to cut a broad swath and shave close, to drive life into a corner, and reduce it to its lowest terms, and, if it proved to be mean, why then to get the whole and genuine meanness of it, and publish its meanness to the world; or if it were sublime, to know it by experience, and be able to give a true account of it in my next excursion.",
  "Our life is frittered away by detail. An honest man has hardly need to count more than his ten fingers, or in extreme cases he may add his ten toes, and lump the rest. Simplicity, simplicity, simplicity! I say, let your affairs be as two or three, and not a hundred or a thousand; instead of a million count half a dozen, and keep your accounts on your thumb-nail.",
  "Time is but the stream I go a-fishing in. I drink at it; but while I drink I see the sandy bottom and detect how shallow it is. Its thin current slides away, but eternity remains. I would drink deeper; fish in the sky, whose bottom is pebbly with stars. I cannot count one. I know not the first letter of the alphabet.",
];
const WORDS = WALDEN.join(" ").toLowerCase().replace(/-/g, " ").replace(/[^a-z ]/g, "").split(/ +/).filter((w) => w.length > 0);
const N = WORDS.length;
const mod = (g) => ((g % N) + N) % N;
const word = (g) => WORDS[mod(g)];

const SPINES = ["THOREAU", "WALDEN", "MUREAU", "SILENCE"];

// ---- Letters: MatrixLight6, the 6-row pixel font in the device's
// firmware/patternflow/src/fonts/. Each glyph is its width, its first row
// (0 for capitals and ascenders, 1 for the x-height, 2 for a's short bowl)
// and one base-32 digit per row, the high bit on the left. Capitals are 5
// rows tall; lower case runs 4 rows from row 1 with descenders on row 5.
const B32 = "0123456789abcdefghijklmnopqrstuv";
const UP = "3025755 3065656 3025452 3065556 3074747 3074744 4068b97 4099f99 1011111 3011152 3055655 3044447 50allhh 409db99 4069996 3065644 40699a5 3065655 3034216 3072222 3055552 3055522 50lllla 3055255 3055222 3071247";
const LO = "32353 3044656 313443 3011353 313563 3012722 3135312 3044655 1010111 30101152 3044565 1011111 51qlll 316555 312552 3165564 3135531 316544 313436 3027221 315553 315552 51llla 315225 3155312 317127";
const glyph = (code) => ({ w: +code[0], top: +code[1], rows: [...code.slice(2)].map((c) => B32.indexOf(c)) });
const CAPS = UP.split(" ").map(glyph), SMALL = LO.split(" ").map(glyph);
const gOf = (ch, cap) => (cap ? CAPS : SMALL)[ch.charCodeAt(0) - 97];
// Width of a run of text with its trailing 1 LED gap; a space adds 2 more,
// so words stand 3 LEDs apart.
function runW(s) {
  let x = 0;
  for (const ch of s) x += ch === " " ? 2 : gOf(ch, false).w + 1;
  return x;
}
// A capital stands on the middle of the panel, x 31.5.
const capX = (w) => round(31.5 - w / 2);

// ---- The reading strip: the whole source in one line of lower case, words
// 3 LEDs apart. wordX0 is where each word starts; the strip repeats every
// TOTAL LEDs, so the reading can run round the source.
const wordW = WORDS.map((w) => runW(w) - 1);
const wordX0 = [];
let TOTAL = 0;
for (let i = 0; i < N; i++) (wordX0.push(TOTAL), (TOTAL += wordW[i] + 3));
const wordX = (g) => floor(g / N) * TOTAL + wordX0[mod(g)];
function readPoint(g, c) {
  const w = word(g);
  let x = wordX(g);
  for (let j = 0; j < c; j++) x += gOf(w[j], false).w + 1;
  return x + gOf(w[c], false).w / 2;
}

// ---- The mesostic. Lines go through the source in order, one capital
// each, the capital in its own word, and every word shown whole: a line is
// [left wing words] prefix CAPITAL suffix [right wing words]. Cage's rules
// are about the text between two capitals, the right wing of one line and
// the left wing of the next:
//   50%: the second capital's letter does not appear there;
//   100%: nor does the first capital's letter.
// Text between the two wings may be passed over, as Cage passed it over.
// A word can carry the capital only where its own prefix and suffix keep
// the rule (the suffix lies before the next capital, so it may not hold the
// next spine letter) and where both fit their half of the panel. Wings take
// whole words outward until a word holds a forbidden letter or the half is
// full; when both wings want the same words in a short gap they split it.
// Checked in Node over 3000 lines for each spine and rule: no line breaks
// its rule, and THOREAU at 50% sets 49 capitals a pass through the 304
// words on average, 35 at 100%.
function newGen(spine, full, from) {
  return { spine, full, k: 0, from, cur: null };
}
function pick(G, k, from) {
  const S = G.spine, L = S.length;
  const s = S[k % L].toLowerCase(), sp = S[(k + L - 1) % L].toLowerCase(), sn = S[(k + 1) % L].toLowerCase();
  for (let g = from; g < from + 4 * N; g++) {
    const w = word(g), c = w.indexOf(s);
    if (c < 0) continue;
    const pre = w.slice(0, c), suf = w.slice(c + 1);
    if (suf.includes(sn)) continue;
    if (G.full && ((k > 0 && pre.includes(sp)) || suf.includes(s))) continue;
    const cw = gOf(s, true).w, cx = capX(cw);
    if (runW(pre) > cx || runW(suf) - 1 > W - (cx + cw + 1)) continue;
    return { g, c, k, s, cx, cw, pre, suf, left: [], right: [] };
  }
  return null;
}
const holds = (w, F) => F.some((f) => w.includes(f));
function extendLeft(line, lo, F) {
  const out = [];
  let txt = line.pre.length ? " " + line.pre : " ";
  for (let g = line.g - 1; g >= lo; g--) {
    const w = word(g);
    if (holds(w, F) || runW(w + txt) > line.cx) break;
    out.unshift(g);
    txt = " " + w + txt;
  }
  return out;
}
function extendRight(line, hi, F) {
  const out = [];
  let txt = line.suf;
  for (let g = line.g + 1; g <= hi; g++) {
    const w = word(g), t = txt + " " + w;
    if (holds(w, F) || runW(t) - 1 > W - (line.cx + line.cw + 1)) break;
    out.push(g);
    txt = t;
  }
  return out;
}
// The next finished line: it needs the capital after it to know where its
// right wing must stop.
function nextLine(G) {
  if (!G.cur) {
    G.cur = pick(G, 0, G.from);
    G.cur.left = extendLeft(G.cur, G.from, [G.cur.s]);
  }
  const cur = G.cur, nx = pick(G, cur.k + 1, cur.g + 1);
  const F = G.full ? [nx.s, cur.s] : [nx.s];
  let right = extendRight(cur, nx.g - 1, F), left = extendLeft(nx, cur.g + 1, F);
  if (right.length && left.length && left[0] <= right[right.length - 1]) {
    const mid = floor((left[0] + right[right.length - 1]) / 2);
    right = right.filter((g) => g <= mid);
    left = left.filter((g) => g > mid);
  }
  cur.right = right;
  nx.left = left;
  G.cur = nx;
  return layout(cur);
}

// Glyphs of a finished line, placed outward from the capital.
function layout(line) {
  const out = [{ gl: gOf(line.s, true), x: line.cx, cap: true }];
  const lt = line.left.map(word).join(" ") + (line.left.length ? " " : "") + line.pre;
  const rt = line.suf + (line.right.length ? " " : "") + line.right.map(word).join(" ");
  let x = line.cx;
  for (let i = lt.length - 1; i >= 0; i--) {
    if (lt[i] === " ") x -= 2;
    else {
      const gl = gOf(lt[i], false);
      x -= gl.w + 1;
      out.push({ gl, x, cap: false });
    }
  }
  x = line.cx + line.cw + 1;
  for (const ch of rt) {
    if (ch === " ") x += 2;
    else {
      const gl = gOf(ch, false);
      out.push({ gl, x, cap: false });
      x += gl.w + 1;
    }
  }
  const lastG = line.right.length ? line.right[line.right.length - 1] : line.g;
  return { glyphs: out, s: line.s, rp: readPoint(line.g, line.c), end: lastG + 1, blank: false };
}

// ---- Page. Eighteen slots of 7 rows (6 for the font, 1 between), rows 1
// to 126; the bottom slot is the reading strip, the 17 above hold the
// finished lines, the newest lowest.
const PITCH = 7, SLOTS = 18;
const slotY = (j) => 1 + PITCH * j;

function start(S) {
  S.gen = newGen(SPINES[S.word], S.full, 0);
  S.page = [];
  for (let i = 0; i < SLOTS - 1; i++) S.page.push(nextLine(S.gen));
  S.next = nextLine(S.gen);
  S.from = S.page[S.page.length - 1].rp;
  S.phase = 0;
  S.t = 0;
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, word: 0, full: false, seen: false, page: null, rgb: new Float32Array(NP * 3) };
  start(params.s);
}

// Phase 0 slides the strip from the last capital to the next, 1 locks the
// capital and fades the passed-over text, 2 climbs the page a line.
function phaseDur(S) {
  if (S.phase === 0) return 0.45 + 0.5 * min(1, (S.next.rp - S.from) / 600);
  return S.phase === 1 ? 0.4 : 0.35;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const wd = cl(round(k[2]), 0, 3), full = cl(k[3], 0, 1) >= 0.5;
  if (!S.seen) {
    // The first frame opens on the mesostic the knobs ask for.
    S.seen = true;
    if (wd !== S.word || full !== S.full) ((S.word = wd), (S.full = full), start(S));
  }
  if (wd !== S.word || full !== S.full) {
    S.word = wd;
    S.full = full;
    // A new mesostic from where the reading stands, after a blank line. The
    // line on its way is dropped unless it is already locking.
    if (S.phase === 1) S.page.push(S.next);
    const last = S.page[S.page.length - 1];
    S.gen = newGen(SPINES[wd], full, last.end);
    S.page.push({ blank: true, glyphs: [], rp: last.rp, end: last.end });
    while (S.page.length > SLOTS + 1) S.page.shift();
    S.next = nextLine(S.gen);
    S.from = last.rp;
    S.phase = 2;
    S.t = 0;
  }
  S.t += (d * S.speed) / 2;
  for (let guard = 0; guard < 8; guard++) {
    const T = phaseDur(S);
    if (S.t < T) break;
    S.t -= T;
    if (S.phase === 0) S.phase = 1;
    else if (S.phase === 1) {
      S.page.push(S.next);
      while (S.page.length > SLOTS + 1) S.page.shift();
      S.from = S.next.rp;
      S.next = nextLine(S.gen);
      S.phase = 2;
    } else S.phase = 0;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb;
  rgb.fill(0);
  const put = (x, y, c, a) => {
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0.004) return;
    const o = (y * W + x) * 3;
    rgb[o] = max(rgb[o], c[0] * a);
    rgb[o + 1] = max(rgb[o + 1], c[1] * a);
    rgb[o + 2] = max(rgb[o + 2], c[2] * a);
  };
  // A glyph at x (fractional while the strip slides, split over two
  // columns) with its top on row y.
  const stamp = (gl, x, y, c, a) => {
    const xi = floor(x), f = x - xi;
    for (let r = 0; r < gl.rows.length; r++) {
      const bits = gl.rows[r], yy = y + gl.top + r;
      for (let i = 0; i < gl.w; i++)
        if ((bits >> (gl.w - 1 - i)) & 1) {
          if (f < 0.01) put(xi + i, yy, c, a);
          else (put(xi + i, yy, c, a * (1 - f)), put(xi + i + 1, yy, c, a * f));
        }
    }
  };
  const gold = hsv(0.12 + S.hue, 0.85, 1), sky = hsv(0.56 + S.hue, 0.5, 0.88), white = [1, 0.97, 0.9];
  const T = phaseDur(S), u = cl(S.t / T, 0, 1);
  const climb = S.phase === 2 ? ease(u) : 1, shift = round(PITCH * (1 - climb));

  // ---- Finished lines. The newest is lowest; each line dims a little with
  // every slot it has climbed, to 55% at the top.
  const n = S.page.length;
  for (let j = 0; j < n; j++) {
    const line = S.page[j];
    if (line.blank) continue;
    const slot = SLOTS - 2 - (n - 1 - j), y = slotY(slot) + shift;
    if (y < -6 || y >= H) continue;
    const age = 0.55 + 0.45 * cl(y / slotY(SLOTS - 2), 0, 1);
    for (const g of line.glyphs) stamp(g.gl, g.x, y, g.cap ? gold : sky, age);
  }

  // ---- The reading strip in the bottom slot. Its text is dim, brighter
  // under the reading point in the middle, and the letters the spine wants
  // next glint gold as they pass.
  const yS = slotY(SLOTS - 1) + shift;
  let rp, sa;
  if (S.phase === 0) (rp = S.from + (S.next.rp - S.from) * ease(u)), (sa = 1);
  else if (S.phase === 1) (rp = S.next.rp), (sa = 1 - ease(u));
  else (rp = S.from), (sa = climb);
  if (sa > 0) {
    const off = 31.5 - rp, view = rp - 31.5;
    let g = floor(view / TOTAL) * N;
    while (wordX(g + 1) <= view) g++;
    const want = S.next.s;
    for (; wordX(g) + off < W; g++) {
      const w = word(g);
      let x = wordX(g) + off;
      for (const ch of w) {
        const gl = gOf(ch, false), dx = x + gl.w / 2 - 31.5;
        const a = sa * (0.3 + 0.4 * exp(-(dx * dx) / 120));
        stamp(gl, x, yS, ch === want ? gold : sky, ch === want ? a * 1.2 : a);
        x += gl.w + 1;
      }
    }
  }
  // The line that is locking fades in over the strip, its capital flashing
  // white and cooling to gold.
  if (S.phase === 1) {
    const e = ease(u), cap = [0, 1, 2].map((q) => white[q] + (gold[q] - white[q]) * ease(u * 1.4));
    for (const g of S.next.glyphs) stamp(g.gl, g.x, yS, g.cap ? cap : sky, g.cap ? 0.5 + 0.5 * min(1, u * 4) : e);
  }

  for (let p = 0; p < NP; p++) display.setPixel(p % W, (p / W) | 0, round(min(1, rgb[p * 3]) * 255), round(min(1, rgb[p * 3 + 1]) * 255), round(min(1, rgb[p * 3 + 2]) * 255));
}
