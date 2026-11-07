// ===== Patternflow pattern =====
// Title:   KWIC Index
// Family:  type
// Idea:    Eleven sentences about indexes are cut into a line for every place a keyword stands, each line slid along its sentence until the keyword fills one lit column and the lines sorted by the words after it, and then the next keyword comes up, every line slides to it and the lines swap places into their new order, so the text folded about the column shows its grain.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: keyword-in-context index (Hans Peter Luhn, 1958), the 3 by 5 capitals of Saccades (pattern round 106), a text written for this pattern, pattern round 107
// Round:   107
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.3..3, Sort=0..2, Column=6..10
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the context is pale blue, the keyword cream between two gold rules on a dark blue-grey column, and the word next to the keyword on the sorted side takes the colour of its first letter, A orange, E yellow, I green, O cyan, T blue, W violet, Z magenta, so a sorted column shows as a gradient and the text in its own order as a scatter of colours.
// Knob 2: Speed. How long a keyword stays. At 2 the new word is in its column after 0.9 s, the lines are in order 1.7 s after the change and stand 2.4 s, so a keyword takes 4.1 s and the eleven come round in 45 s. At 3 it takes 3.1 s and 34 s, at 1 it takes 7.0 s and 77 s, at 0.3 it takes 19.4 s and 213 s. The first change starts at 0.9 s at any speed, and at 2 the first sorting starts at 1.5 s.
// Knob 3: Sort. Snaps to 0, 1 or 2. At 0 the lines are sorted by the words after the keyword, at 1 by the words before it read backwards, at 2 they stay in the order of the text. A line with nothing on the sorted side comes first, and two lines alike there are told apart by the other side. A turn sorts again at once, the lines swapping places a slot at a time over 0.8 s at speed 2.
// Knob 4: Column. Where the keyword starts, in characters from the left edge. At 6 a line shows 6 characters before the keyword and 10 from its first letter on, at 10 it shows 10 before and 6 from it, which leaves the 6 letters of column no context to its right. The text slides to the new place in about a third of a second.

const W = 64, H = 128;
const { floor, round, min, abs, exp, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => ((u = cl(u, 0, 1)), u * u * (3 - 2 * u));

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// ---- the face: 3 wide, 5 tall, drawn here ------------------------------
// Capitals only: at this size lowercase does not read. A letter is 3 LEDs and
// a gap, so a character takes 4 and a line of the panel holds 16.
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

// ---- the text: eleven sentences written for this pattern ---------------
// Punctuation is dropped when they are cut into words. A line is one
// sentence, so a keyword near its start has nothing to its left.
const TEXT = [
  "An index is a list of words, and each word in the list has a line that says where it is found.",
  "Each line of one book is a line in the index, and it shows its word in the middle of it.",
  "A column holds one word in the middle of its page, and each line runs out to the left and to the right of it.",
  "In a column of one word every line is its own, and an eye reads down the column as it reads down an index.",
  "Sort lines by the words that come after it in the column, and lines with an angle in them sit above lines with a wind in them.",
  "Sort them by the words before it, and lines fall into a new order, with the column in one place and folds in a new pattern.",
  "Any word that is used a lot, such as the or of or in, has an index of its own, and a word that is used once has an index of one line.",
  "An index of each word shows places of it, and the places of each word show what it is, for a word is what it does in a line.",
  "Turn to a new word and every line slides along its row until the word stands in the column, and a line that does not hold it drops out of the index.",
  "Then lines that hold it come in, and the index finds a new order, one line at a time, from top to foot of the column.",
  "An index is a column of words, and a column of words in an index is a column that folds in the middle of each line.",
];
// The keywords in the order they come up. Each stands 10 to 19 times.
const KEYS = ["the", "of", "in", "a", "and", "it", "line", "word", "index", "column", "is"];

// A sentence as words, where each starts, and the word each character is in.
const SENT = TEXT.map((t) => {
  const words = t.toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter(Boolean);
  const start = [], wid = [];
  let n = 0;
  words.forEach((w, i) => {
    start.push(n);
    for (let c = 0; c < w.length; c++) wid.push(i);
    wid.push(-1);
    n += w.length + 1;
  });
  return { words, start, wid, str: words.join(" ").toUpperCase() };
});

// Every place a keyword stands, in the order of the text, and the three
// orders a concordance can take: by the words after the keyword, by the
// words before it read backwards, and as written. A shorter context sorts
// first, a space before every letter, as in a dictionary, and where the two
// are the same the other side decides.
const ORDER = {};
for (const key of KEYS) {
  const occ = [];
  SENT.forEach((s, i) => {
    let k = 0;
    s.words.forEach((w, p) => {
      if (w === key) occ.push({ s: i, p, k: k++ });
    });
  });
  const after = (o) => SENT[o.s].words.slice(o.p + 1).join(" "), before = (o) => SENT[o.s].words.slice(0, o.p).reverse().join(" ");
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const by = (f, g) => occ.slice().sort((a, b) => cmp(f(a), f(b)) || cmp(g(a), g(b)) || a.s - b.s || a.p - b.p);
  ORDER[key] = [by(after, before), by(before, after), occ];
}

// Rows of n lines, 6 to 9 LEDs apart, centred on the panel.
function slot(n, rank) {
  const pitch = cl(floor(127 / n), 6, 9), top = (H - ((n - 1) * pitch + 5)) / 2;
  return round(top + rank * pitch);
}

export function setup(params) {
  params.s = {
    ready: false, t: 0, hue: 0, q: 1, mode: 0, sw: 0, col: 6, kw: 0, phase: "hold", hold: 0, first: true, mt: 0,
    e1: 1, len: KEYS[0].length, lenFrom: KEYS[0].length, lenTo: KEYS[0].length,
    slideDur: 0.9, glideAt: 0.55, glideDur: 0.8, tau: 0.035, total: 2, glided: true, laying: false, gp: 1, rows: [], dying: [],
    palHue: -1, pal: new Float32Array(3 * 40), buf: new Uint8Array(W * H * 3),
  };
}

function newRow(o, y) {
  return { s: o.s, k: o.k, p: o.p, po: o.p, y, k0: 0, k1: 0, key: 0, dz: 0, al: 1, t0: 0 };
}

// Every row sets off for its place in the order the sort knob asks for. A
// row's sort position runs from where it stands to where it belongs, and the
// rows are laid out in the order of those positions, so two rows swap places
// one slot at a time.
function retarget(S) {
  const order = ORDER[KEYS[S.kw]][S.mode], by = new Map(S.rows.map((r) => [r.s * 16 + r.k, r]));
  S.rows.slice().sort((a, b) => a.y - b.y || a.s - b.s || a.p - b.p).forEach((r, i) => (r.k0 = i));
  order.forEach((o, rank) => (by.get(o.s * 16 + o.k).k1 = rank));
  S.gp = 0;
  S.laying = true;
}

// The next keyword: every row that has the new word in its sentence slides
// along the sentence to it, the rows that have not fade, and the lines the
// new word adds come in once the others are in order.
function begin(S) {
  S.kw = (S.kw + 1) % KEYS.length;
  const key = KEYS[S.kw], order = ORDER[key][S.mode], n = order.length, old = new Map(S.rows.map((r) => [r.s * 16 + r.k, r]));
  const q = pow(S.q, 0.35);
  S.slideDur = 0.9 * q;
  S.glideAt = 0.55 * q;
  S.glideDur = 0.8 * q;
  S.tau = 0.035 * q;
  S.total = S.glideAt + S.glideDur + 0.35 * q;
  const rows = [], fresh = [];
  order.forEach((o, rank) => {
    const id = o.s * 16 + o.k;
    let r = old.get(id);
    if (r) {
      old.delete(id);
      r.po = r.p;
      r.p = o.p;
    } else {
      r = newRow(o, slot(n, rank));
      r.al = 0;
      r.t0 = S.t + S.glideAt;
      fresh.push(r);
    }
    rows.push(r);
  });
  // A line that goes and a line that comes swap in the same row while the
  // others slide, so no row stands empty. The rest fade out or come in late.
  const gone = [...old.values()].sort((a, b) => a.y - b.y);
  gone.forEach((g, i) => {
    S.dying.push({ r: g, t0: S.t + (i < fresh.length ? 0.05 : 0) });
    if (i < fresh.length) {
      fresh[i].y = g.y;
      fresh[i].t0 = S.t + 0.05;
    }
  });
  S.rows = rows;
  S.lenFrom = S.len;
  S.lenTo = key.length;
  S.mt = 0;
  S.e1 = 0;
  S.glided = false;
  S.laying = false;
  S.phase = "move";
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 6], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  const speed = cl(k[1], 0.3, 3), mode = round(cl(k[2], 0, 2)), colT = cl(k[3], 6, 10);
  S.q = 2 / speed;
  if (!S.ready) {
    S.ready = true;
    S.mode = mode;
    S.sw = mode === 1 ? 1 : 0;
    S.col = colT;
    const order = ORDER[KEYS[0]][mode];
    S.rows = order.map((o, rank) => newRow(o, slot(order.length, rank)));
  }
  S.t += d;
  S.col += (colT - S.col) * (1 - exp(-d / 0.1));
  S.sw += ((S.mode === 1 ? 1 : 0) - S.sw) * (1 - exp(-d / 0.25));
  if (mode !== S.mode) {
    S.mode = mode;
    retarget(S);
  }
  if (S.phase === "hold") {
    S.hold += d;
    if (S.hold >= (S.first ? min(0.9, 2.4 * S.q) : 2.4 * S.q)) begin(S);
  } else {
    S.mt += d;
    S.e1 = ease(S.mt / S.slideDur);
    S.len = S.lenFrom + (S.lenTo - S.lenFrom) * S.e1;
    if (!S.glided && S.mt >= S.glideAt) {
      S.glided = true;
      retarget(S);
    }
    if (S.mt >= S.total) {
      S.phase = "hold";
      S.hold = 0;
      S.first = false;
      S.e1 = 1;
      S.len = S.lenTo;
      for (const r of S.rows) r.po = r.p;
    }
  }
  if (S.laying) {
    S.gp = min(1, S.gp + d / S.glideDur);
    const e = ease(S.gp), n = S.rows.length, f = 1 - exp(-d / S.tau);
    for (const r of S.rows) r.key = r.k0 + (r.k1 - r.k0) * e;
    S.rows.slice().sort((a, b) => a.key - b.key || a.k1 - b.k1).forEach((r, j) => {
      const to = slot(n, j);
      r.y = abs(to - r.y) < 0.35 ? to : r.y + (to - r.y) * f;
      r.dz = abs(to - r.y);
    });
  }
  for (const r of S.rows) if (r.al < 1) r.al = ease((S.t - r.t0) / 0.45);
  S.dying = S.dying.filter((x) => S.t - x.t0 < 0.4);
}

// Palette slots (3 floats each): 0 context, 1 keyword, 2 band, 3 band rule,
// 4 on, one rainbow slot for each letter of the alphabet.
function palette(S) {
  const t = S.pal, h = S.hue;
  hsv(h + 0.58, 0.3, 0.85, t, 0);
  hsv(h + 0.12, 0.3, 1, t, 3);
  hsv(h + 0.62, 0.25, 0.2, t, 6);
  hsv(h + 0.12, 0.6, 0.5, t, 9);
  for (let i = 0; i < 26; i++) hsv(h + 0.04 + 0.82 * (i / 25), 0.9, 1, t, 15 + 3 * i);
  S.palHue = h;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.palHue !== S.hue) palette(S);
  const buf = S.buf, pal = S.pal, colX = 4 * S.col, bl = colX - 1, br = colX + 4 * S.len - 1;
  // The column the keyword stands in: a tint with a rule down each side.
  // Each line lies on it as an opaque card, six LEDs tall, so two lines
  // that pass each other do not print through one another.
  const bg = new Float32Array(W * 3);
  for (let x = 0; x < W; x++) {
    const c = x + 0.5, inside = cl(c - bl + 0.5, 0, 1) * cl(br - c + 0.5, 0, 1), edge = c < bl + 1 || c > br - 1 ? inside : 0;
    for (let i = 0; i < 3; i++) bg[x * 3 + i] = pal[6 + i] * inside + pal[9 + i] * edge;
  }
  for (let p = 0; p < W * H; p++) {
    const x = p & 63;
    buf[p * 3] = bg[x * 3];
    buf[p * 3 + 1] = bg[x * 3 + 1];
    buf[p * 3 + 2] = bg[x * 3 + 2];
  }
  const mix = (x, y, r, g, b, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    buf[o] += (r - buf[o]) * a;
    buf[o + 1] += (g - buf[o + 1]) * a;
    buf[o + 2] += (b - buf[o + 2]) * a;
  };
  const row = (r, al, dead) => {
    const sen = SENT[r.s], str = sen.str, wid = sen.wid, y = round(r.y);
    if (y < -5 || y >= H || al <= 0.005) return;
    for (let yy = y; yy < y + 6; yy++) for (let x = 0; x < W; x++) mix(x, yy, bg[x * 3], bg[x * 3 + 1], bg[x * 3 + 2], al);
    const off = sen.start[r.po] * (1 - S.e1) + sen.start[r.p] * S.e1, x0 = round(colX - 4 * off);
    const wr = 1 - S.sw, wl = S.sw, u = dead ? 1 : S.e1;
    for (let c = 0; c < str.length; c++) {
      const g = GLYPH[str[c]];
      if (!g) continue;
      const x = x0 + 4 * c;
      if (x < -3 || x > W - 1) continue;
      const cx = x + 1, dist = cx < bl ? bl - cx : cx > br ? cx - br : 0, f = 1 - 0.5 * min(1, dist / 34);
      const kb = cl(min(cx - colX, colX + 4 * S.len - 2 - cx) / 2 + 0.5, 0, 1);
      const w = wid[c];
      // The word next to the keyword on the side the lines are sorted by
      // takes the colour of its first letter.
      const rb = (w === r.po + 1 ? wr : w === r.po - 1 ? wl : 0) * (1 - u) + (w === r.p + 1 ? wr : w === r.p - 1 ? wl : 0) * u;
      let cr = pal[0] * f, cg = pal[1] * f, cb = pal[2] * f;
      if (rb > 0) {
        const o = 15 + 3 * (str.charCodeAt(sen.start[w]) - 65);
        cr += (pal[o] - cr) * rb;
        cg += (pal[o + 1] - cg) * rb;
        cb += (pal[o + 2] - cb) * rb;
      }
      cr += (pal[3] - cr) * kb;
      cg += (pal[4] - cg) * kb;
      cb += (pal[5] - cb) * kb;
      for (let i = 0; i < 15; i++) if (g[i]) mix(x + (i % 3), y + floor(i / 3), cr, cg, cb, al);
    }
  };
  for (const x of S.dying) row(x.r, 1 - ease((S.t - x.t0) / 0.4), true);
  // The lines furthest from home go on top.
  for (const r of S.rows.slice().sort((a, b) => a.dz - b.dz)) row(r, r.al, false);
  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
