// ===== Patternflow pattern =====
// Title:   Etaoin Shrdlu
// Family:  data
// Idea:    A passage set in a 3 by 5 face comes loose one letter at a time from its last line, and each letter falls into one of sixteen columns kept sorted by how often the letter has come, so the columns trade places as one overtakes another and the labels under them end up spelling the passage's own etaoin shrdlu above the order the Linotype keyboard was built on.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: pattern round 66, after the Linotype (Ottmar Mergenthaler, 1886), whose lowercase keys ran etaoin shrdlu cmfwyp vbgkqj by letter frequency, and the line ETAOIN SHRDLU that operators left in newspapers; counting Lewis Carroll's Alice's Adventures in Wonderland (1865), Lorem ipsum from Cicero's De finibus bonorum et malorum (45 BC), ten pangrams, and the cryptogram Legrand breaks by counting in Edgar Allan Poe's The Gold-Bug (1843); the 3 by 5 face from the Typewriter pattern (round 18), with figures and Poe's symbols added
// Round:   66
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Text=0..3, Forget=0..1
//
// Knob 1: Hue. Turns the colours round the wheel. Each letter keeps one colour, set by its place in the Linotype's order: at 0 E is cyan, the rest of ETAOIN blue, SHRDLU indigo to magenta and the rare letters red, orange and gold, so a passage close to that order reads as one rainbow across the columns and Lorem ipsum as a broken one.
// Knob 2: Speed. Letters coming loose a second: 8 at 2, so Alice's 464 letters take 58 s; 0.8 at 0.2 and 12 at 3. They also fall a little harder as it turns up.
// Knob 3: Text. Each ends on its own order: 0 Alice, ETIONS AHRDWG, six of the twelve in the Linotype's places; 1 Lorem ipsum, IETAOU NLRDSM, two; 2 ten pangrams, every letter 10 times or more and 17 of them exactly 10, none; 3 Poe's cryptogram, 8;4)‡* 56(†10, which is ETHSON AIRDFL, five.
// Knob 4: Forget. How far back the columns count: the last 520 letters at 0.06, which is all of every passage here, 113 at 0.5 and only the last 20 at 1, where each letter is a sort 15 rows tall with its face on it and the order changes at 80 of 100 landings against 18 at 0.06.

const W = 64, H = 128;
const { floor, round, min, max, exp, sqrt, sin, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Layout, rows y down. Seven lines of type at the top (6 rows each), the
// reading line last; sixteen columns 4 LEDs apart standing on row 113 and at
// most 62 rows tall; the passage's labels on rows 116-120 and the
// Linotype's order on rows 122-126.
const LINES = 7;
const READ_Y = 37;
const BASE = 113;
const MAXH = 62;
const LABEL_Y = 116;
const REF_Y = 122;
const SLOTS = 16;
// Under floor(S) letters in the tallest column the scale stops growing, so
// early in a passage each letter is a sort 62 / 9 = 6.9 rows tall with its
// face on it. Counting only the last 20, the floor drops to 4 and a sort is
// 15.5 rows.
const floorUnits = (S) => cl(S.keep / 5, 4, 9);
const HOLD = 6;
const DRAIN = 1.2;

// The Linotype's lowercase keys, column by column.
const LINO = "ETAOINSHRDLUCMFWYPVBGKQJXZ";

// The 3 by 5 face, rows top to bottom, one bit per column. The letters and
// most punctuation are Typewriter's; the figures and Poe's dagger, double
// dagger, pilcrow, asterisk and brackets are new.
const GLYPHS = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101111011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101011", V: "101101101010010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111", ".": "000000000000010", ",": "000000000010100",
  "-": "000000111000000", "!": "010010010000010", "?": "110001010000010", "'": "010010000000000",
  ":": "000010000010000", ";": "000010000010100",
  "0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001011001111",
  "4": "101101111001001", "5": "111100111001111", "6": "111100111101111", "8": "111101111101111",
  "9": "111101111001111", "†": "010111010010010", "‡": "010111010111010", "¶": "011111011011011",
  "*": "101010111010101", "(": "001010010010001", ")": "100010010010100",
};
const BITS = {};
for (const ch in GLYPHS) BITS[ch] = GLYPHS[ch].split("").map(Number);

// Poe's key, letter to symbol, as Legrand reads it out: 8 is e, ; is t, and
// so on. The cryptogram is the plaintext below put through it, so the counts
// are the plaintext's: 8 33, ; 26, 4 19, the start of Legrand's own table.
const KEY = { A: "5", B: "2", C: "-", D: "†", E: "8", F: "1", G: "3", H: "4", I: "6", L: "0", M: "9", N: "*", O: "‡", P: ".", R: "(", S: ")", T: ";", U: "?", V: "¶", Y: ":" };
const PLAIN =
  "A GOOD GLASS IN THE BISHOP'S HOSTEL IN THE DEVIL'S SEAT FORTY-ONE DEGREES AND THIRTEEN MINUTES NORTHEAST AND BY NORTH MAIN BRANCH SEVENTH LIMB EAST SIDE SHOOT FROM THE LEFT EYE OF THE DEATH'S-HEAD A BEE LINE FROM THE TREE THROUGH THE SHOT FIFTY FEET OUT";

const TEXTS = [
  // Alice's Adventures in Wonderland (1865), the first two sentences.
  "ALICE WAS BEGINNING TO GET VERY TIRED OF SITTING BY HER SISTER ON THE BANK, AND OF HAVING NOTHING TO DO: ONCE OR TWICE SHE HAD PEEPED INTO THE BOOK HER SISTER WAS READING, BUT IT HAD NO PICTURES OR CONVERSATIONS IN IT, 'AND WHAT IS THE USE OF A BOOK,' THOUGHT ALICE 'WITHOUT PICTURES OR CONVERSATIONS?' SO SHE WAS CONSIDERING IN HER OWN MIND (AS WELL AS SHE COULD, FOR THE HOT DAY MADE HER FEEL VERY SLEEPY AND STUPID), WHETHER THE PLEASURE OF MAKING A DAISY-CHAIN WOULD BE WORTH THE TROUBLE OF GETTING UP AND PICKING THE DAISIES, WHEN SUDDENLY A WHITE RABBIT WITH PINK EYES RAN CLOSE BY HER.",
  "LOREM IPSUM DOLOR SIT AMET, CONSECTETUR ADIPISCING ELIT, SED DO EIUSMOD TEMPOR INCIDIDUNT UT LABORE ET DOLORE MAGNA ALIQUA. UT ENIM AD MINIM VENIAM, QUIS NOSTRUD EXERCITATION ULLAMCO LABORIS NISI UT ALIQUIP EX EA COMMODO CONSEQUAT. DUIS AUTE IRURE DOLOR IN REPREHENDERIT IN VOLUPTATE VELIT ESSE CILLUM DOLORE EU FUGIAT NULLA PARIATUR. EXCEPTEUR SINT OCCAECAT CUPIDATAT NON PROIDENT, SUNT IN CULPA QUI OFFICIA DESERUNT MOLLIT ANIM ID EST LABORUM.",
  "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG. PACK MY BOX WITH FIVE DOZEN LIQUOR JUGS. SPHINX OF BLACK QUARTZ, JUDGE MY VOW. JACKDAWS LOVE MY BIG SPHINX OF QUARTZ. HOW VEXINGLY QUICK DAFT ZEBRAS JUMP! THE FIVE BOXING WIZARDS JUMP QUICKLY. WALTZ, BAD NYMPH, FOR QUICK JIGS VEX. GLIB JOCKS QUIZ NYMPH TO VEX DWARF. QUICK ZEPHYRS BLOW, VEXING DAFT JIM. TWO DRIVEN JOCKS HELP FAX MY BIG QUIZ.",
  null,
];

// A passage as lines of at most 16 characters and the list of letters to
// count, each with its line, column, token (what it looks like) and key (the
// letter it stands for, which sets its colour).
function prepare(t) {
  const lines = [];
  if (t === 3) {
    // Poe printed the cryptogram run together, so it breaks every 16.
    let s = "";
    for (const ch of PLAIN) if (KEY[ch]) s += KEY[ch];
    for (let i = 0; i < s.length; i += 16) lines.push(s.slice(i, i + 16));
  } else {
    let line = "";
    for (const word of TEXTS[t].split(" ")) {
      if (line && line.length + 1 + word.length > 16) {
        lines.push(line);
        line = word;
      } else line = line ? line + " " + word : word;
    }
    lines.push(line);
  }
  const back = {};
  for (const k in KEY) back[KEY[k]] = k;
  const letters = [];
  lines.forEach((s, li) => {
    for (let c = 0; c < s.length; c++) {
      const ch = s[c];
      if (t === 3 ? back[ch] : ch >= "A" && ch <= "Z") letters.push({ tok: ch, key: t === 3 ? back[ch] : ch, line: li, col: c });
    }
  });
  return { lines, letters, cipher: t === 3 };
}

function hsv(h, s, v) {
  h = (((h % 1) + 1) % 1) * 6;
  const i = floor(h), f = h - i;
  const p = v * (1 - s), q = v * (1 - s * f), u = v * (1 - s * (1 - f));
  const c = [[v, u, p], [q, v, p], [p, v, u], [p, q, v], [u, p, v], [v, p, q]][i % 6];
  return [c[0] * 255, c[1] * 255, c[2] * 255];
}

// A letter's colour: its key's place in the Linotype's order round the wheel.
const colourOf = (S, tok) => hsv(0.5 + S.hue + LINO.indexOf(S.keyOf[tok] || tok) * 0.031, 0.78, 1);

export function setup(params) {
  params.s = { started: false };
}

// Start a passage: no counts, no columns, its first line onto the galley.
function begin(S, t) {
  S.textIdx = t;
  S.text = prepare(t);
  S.read = 0;
  S.line = -1;
  S.cnt = {};
  S.keyOf = {};
  for (const L of S.text.letters) S.keyOf[L.tok] = L.key;
  S.cols = [];
  S.cx = {};
  S.flash = {};
  S.queue = [];
  S.head = 0;
  S.fall = [];
  S.acc = 0;
  S.phase = 0;
  S.pt = 0;
  S.drain = 1;
  feed(S, 0, false);
}

// Put passage lines up to li onto the galley; it scrolls up a line for each.
function feed(S, li, still) {
  while (S.line < li) {
    S.line++;
    S.galley.push({ s: S.text.lines[S.line], slug: null, li: S.line });
    if (!still) S.scroll += 6;
  }
  if (S.galley.length > 12) S.galley.splice(0, S.galley.length - 12);
}

const slotX = (i) => i * 4;

function bubbleLeft(S, i) {
  const c = S.cols, n = S.cnt;
  while (i > 0 && n[c[i]] > n[c[i - 1]]) {
    const a = c[i];
    c[i] = c[i - 1];
    c[i - 1] = a;
    i--;
  }
}

// The letter not in a column with the highest count, if it beats the last column.
function promote(S) {
  const c = S.cols;
  let best = null;
  for (const k in S.cnt) if (S.cnt[k] > 0 && !c.includes(k) && (best === null || S.cnt[k] > S.cnt[best])) best = k;
  if (best === null) return;
  if (c.length < SLOTS) {
    c.push(best);
    if (S.cx[best] === undefined) S.cx[best] = slotX(c.length - 1);
    bubbleLeft(S, c.length - 1);
  } else if (S.cnt[best] > S.cnt[c[SLOTS - 1]]) {
    S.cx[best] = S.cx[c[SLOTS - 1]];
    c[SLOTS - 1] = best;
    bubbleLeft(S, SLOTS - 1);
  }
}

// A letter has landed: count it, forget the oldest past the keep, re-sort.
function land(S, tok) {
  S.cnt[tok] = (S.cnt[tok] || 0) + 1;
  S.queue.push(tok);
  const i = S.cols.indexOf(tok);
  if (i >= 0) {
    bubbleLeft(S, i);
    S.flash[tok] = 1;
  } else promote(S);
  trim(S);
}

function trim(S) {
  while (S.queue.length - S.head > S.keep) {
    const old = S.queue[S.head++];
    S.cnt[old]--;
    const c = S.cols;
    let i = c.indexOf(old);
    if (i >= 0) {
      if (S.cnt[old] <= 0) c.splice(i, 1);
      else
        while (i < c.length - 1 && S.cnt[c[i]] < S.cnt[c[i + 1]]) {
          c[i] = c[i + 1];
          c[i + 1] = old;
          i++;
        }
    }
    promote(S);
  }
  if (S.head > 2000) {
    S.queue = S.queue.slice(S.head);
    S.head = 0;
  }
}

const tallest = (S) => {
  let m = 0;
  for (const k of S.cols) m = max(m, S.cnt[k]);
  return m;
};

// One step of the machine.
function step(S, dt) {
  const L = S.text.letters;
  S.scroll = max(0, S.scroll - max(S.scroll * (1 - exp(-dt * 7)), dt * 6));
  if (S.phase === 0) {
    S.acc += dt * S.rate;
    while (S.acc >= 1 && S.read < L.length) {
      S.acc -= 1;
      const l = L[S.read++];
      // The slot in the reading line before the scroll moves it.
      const y0 = READ_Y + S.scroll - 6 * (S.line - l.line);
      // While there are free columns a new letter takes one as it leaves.
      if (S.cols.length < SLOTS && !S.cols.includes(l.tok)) {
        S.cnt[l.tok] = S.cnt[l.tok] || 0;
        S.cols.push(l.tok);
        if (S.cx[l.tok] === undefined) S.cx[l.tok] = slotX(S.cols.length - 1);
      }
      S.fall.push({ tok: l.tok, x: l.col * 4, x0: l.col * 4, y: y0, y0, t: 0, T: 0 });
      if (S.read < L.length) feed(S, L[S.read].line, false);
    }
    if (S.read >= L.length) S.acc = 0;
  }
  for (const f of S.fall) {
    f.t += dt;
    if (!f.T) {
      const i = S.cols.indexOf(f.tok);
      const top = i >= 0 ? BASE - S.cnt[f.tok] * S.scale - 4 : BASE - 4;
      const d = max(1, top - f.y0);
      f.T = (S.vy + sqrt(S.vy * S.vy + 2 * S.g * d)) / S.g;
    }
    f.y = f.y0 - S.vy * f.t + 0.5 * S.g * f.t * f.t;
    const i = S.cols.indexOf(f.tok);
    f.pi = i < 0;
    if (!f.pi) {
      const u = sm(0, 1, f.t / f.T);
      f.x = f.x0 + (S.cx[f.tok] - f.x0) * u;
      if (f.y >= BASE - S.cnt[f.tok] * S.scale - 4) f.done = true;
    } else {
      f.x0 = f.x;
      if (f.y >= BASE - 4) f.done = true;
    }
  }
  if (S.fall.some((f) => f.done)) {
    for (const f of S.fall) if (f.done) land(S, f.tok);
    S.fall = S.fall.filter((f) => !f.done);
  }
  // Columns slide to their slots; the scale follows the tallest.
  S.cols.forEach((k, i) => {
    S.cx[k] += (slotX(i) - S.cx[k]) * (1 - exp(-dt * 9));
  });
  for (const k in S.flash) S.flash[k] = max(0, S.flash[k] - dt * 3);
  const target = MAXH / max(floorUnits(S), tallest(S));
  S.scale += (target - S.scale) * (1 - exp(-dt * 5));

  if (S.phase === 0 && S.read >= L.length && S.fall.length === 0) {
    // The passage is spent: cast its own order as a line.
    S.phase = 1;
    S.pt = 0;
    const c = S.cols;
    const s = c.slice(0, 6).join("") + " " + c.slice(6, 12).join("");
    S.galley.push({ s, slug: s.split("").map((ch) => (ch === " " ? null : colourOf(S, ch))), li: -1 });
    S.scroll += 6;
  } else if (S.phase === 1) {
    S.pt += dt;
    if (S.pt > HOLD) {
      S.phase = 2;
      S.pt = 0;
    }
  } else if (S.phase === 2) {
    S.pt += dt;
    S.drain = 1 - sm(0, DRAIN, S.pt);
    if (S.pt > DRAIN) begin(S, S.next);
  }
}

export function update(dt, input, params) {
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] === undefined ? 2 : k[1], 0.2, 3);
  S.rate = 4 * speed;
  S.g = 150 * (0.6 + 0.2 * speed);
  S.vy = 18;
  const tx = cl(round(k[2] || 0), 0, 3);
  S.keep = round(20 * 32 ** (1 - cl(k[3] === undefined ? 0.06 : k[3], 0, 1)));
  S.next = tx;
  if (!S.started) {
    S.started = true;
    S.galley = [];
    S.scroll = 0;
    S.scale = MAXH / floorUnits(S);
    begin(S, tx);
    // Read 28% of the passage (50 to 130 letters) before the first frame,
    // then run a second and a half so letters are in the air.
    const L = S.text.letters;
    const pre = cl(round(0.28 * L.length), 50, 130);
    for (let i = 0; i < pre; i++) {
      const l = L[S.read++];
      if (S.read < L.length) feed(S, L[S.read].line, true);
      land(S, l.tok);
    }
    S.scroll = 0;
    S.cols.forEach((c, i) => (S.cx[c] = slotX(i)));
    S.scale = MAXH / max(floorUnits(S), tallest(S));
    for (const c in S.flash) S.flash[c] = 0;
    for (let i = 0; i < 45; i++) step(S, 1 / 30);
  }
  if (tx !== S.textIdx && S.phase !== 2) {
    // A new text: the columns drain and the new passage starts from its top.
    S.phase = 2;
    S.pt = 0;
    S.fall = [];
  }
  trim(S);
  step(S, dt);
}

function glyph(display, ch, x0, y0, r, g, b, a) {
  const bits = BITS[ch];
  if (!bits || a <= 0.02) return;
  const R = round(min(255, r * a)), G = round(min(255, g * a)), B = round(min(255, b * a));
  for (let j = 0; j < 15; j++) {
    if (!bits[j]) continue;
    const x = x0 + (j % 3), y = y0 + floor(j / 3);
    if (x >= 0 && x < W && y >= 0 && y < H) display.setPixel(x, y, R, G, B);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S.started) return;
  const colour = {};
  const col = (tok) => colour[tok] || (colour[tok] = colourOf(S, tok));
  const pulse = S.phase === 1 ? 0.8 + 0.2 * sin(S.pt * 5) : 1;

  // Letters with no column fall behind the columns and go out at the floor.
  for (const f of S.fall) if (f.pi) glyph(display, f.tok, round(f.x), round(f.y), 150, 150, 160, 0.75);

  // The columns: a solid bar with a seam at each letter, or, when a letter
  // has room, a stack of sorts each showing its letter in the middle.
  const s = S.scale;
  const sorts = sm(5, 6.5, s);
  const face = floor(max(0, s - 6) / 2);
  for (const tok of S.cols) {
    const c = col(tok);
    const x0 = round(S.cx[tok]);
    const n = S.cnt[tok];
    const h = n * s * S.drain;
    const bits = BITS[tok];
    const fl = S.flash[tok] || 0;
    for (let r = 0; r < h && r < MAXH + 2; r++) {
      const y = BASE - r;
      const cover = min(1, h - r);
      const unit = floor(r / s), o = r - unit * s;
      const top = unit >= n - 1;
      for (let dx = 0; dx < 3; dx++) {
        const seam = s >= 2.5 && o > s - 1;
        const solid = seam ? 0.42 : 0.9;
        const gr = 4 - floor(o - face);
        const stamp = seam ? 0 : gr >= 0 && gr < 5 ? (bits[gr * 3 + dx] ? 1 : 0.28) : 0.28;
        const v = (solid + (stamp - solid) * sorts) * cover;
        if (v <= 0.02) continue;
        const w = top ? fl * 0.8 : 0;
        const R = c[0] * v * (1 - w) + 255 * w * cover, G = c[1] * v * (1 - w) + 255 * w * cover, B = c[2] * v * (1 - w) + 255 * w * cover;
        const x = x0 + dx;
        if (x >= 0 && x < W) display.setPixel(x, y, round(min(255, R)), round(min(255, G)), round(min(255, B)));
      }
    }
  }

  // Labels under the columns, and under them the Linotype's order. Where a
  // column's letter stands where the Linotype put it, both light. At the end
  // of Poe's cryptogram the bottom row turns into the key.
  const keyRow = S.text.cipher && S.phase > 0;
  S.cols.forEach((tok) => {
    const c = col(tok);
    const x = round(S.cx[tok]);
    glyph(display, tok, x, LABEL_Y, c[0], c[1], c[2], pulse * S.drain);
  });
  for (let i = 0; i < SLOTS; i++) {
    const tok = S.cols[i];
    const settled = tok !== undefined && abs(S.cx[tok] - slotX(i)) < 0.6;
    const match = settled && S.keyOf[tok] === LINO[i];
    if (keyRow) {
      if (tok === undefined) continue;
      const c = col(tok);
      glyph(display, S.keyOf[tok], round(S.cx[tok]), REF_Y, c[0], c[1], c[2], (match ? 1 : 0.55) * S.drain);
    } else if (match) {
      const c = col(tok);
      glyph(display, LINO[i], slotX(i), REF_Y, 0.5 * c[0] + 128, 0.5 * c[1] + 128, 0.5 * c[2] + 128, S.drain);
    } else glyph(display, LINO[i], slotX(i), REF_Y, 84, 80, 92, 1);
  }

  // The galley: what has been read is dim, the rest of the reading line is
  // lit and the next letter to come loose shows its colour. A cast order
  // line keeps its colours.
  const G = S.galley;
  const L = S.text.letters;
  const next = S.phase === 0 && S.read < L.length ? L[S.read] : null;
  for (let j = 0; j < G.length && j < LINES + 1; j++) {
    const ln = G[G.length - 1 - j];
    const y = READ_Y - 6 * j + round(S.scroll);
    if (y < -5 || y > READ_Y + 6) continue;
    const live = ln.li >= 0 && ln.li === S.line && j === 0 && S.phase === 0;
    for (let c = 0; c < ln.s.length; c++) {
      const ch = ln.s[c];
      if (ch === " ") continue;
      if (ln.slug) {
        const cc = ln.slug[c];
        const a = j === 0 ? pulse : 0.45;
        glyph(display, ch, c * 4, y, cc[0], cc[1], cc[2], a);
      } else if (live && next && c === next.col) {
        const cc = col(ch);
        glyph(display, ch, c * 4, y, 0.4 * cc[0] + 150, 0.4 * cc[1] + 150, 0.4 * cc[2] + 150, 1);
      } else if (live && next && c > next.col) glyph(display, ch, c * 4, y, 236, 224, 202, 1);
      else glyph(display, ch, c * 4, y, 236, 224, 202, 0.33);
    }
  }

  // Letters in the air, white as they leave the line and their colour as they fall.
  for (const f of S.fall) {
    if (f.pi) continue;
    const c = col(f.tok);
    const w = max(0, 1 - f.t / 0.35);
    glyph(display, f.tok, round(f.x), round(f.y), c[0] + (255 - c[0]) * w, c[1] + (255 - c[1]) * w, c[2] + (255 - c[2]) * w, 1);
  }
}
