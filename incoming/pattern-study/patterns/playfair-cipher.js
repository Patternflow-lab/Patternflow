// ===== Patternflow pattern =====
// Title:   Playfair Cipher
// Family:  type
// Idea:    A keyword lays out a 5 by 5 square of 6 by 10 capitals in the top half of the panel, and each pair of letters of the message is found in it, lit in gold, joined by the rule that moves them (a rectangle's other two corners, one cell right along a row, one cell down a column), the two cells that come out lit in pink, and the cipher pair written beside the plain pair in a ledger below; after the last pair the cipher is run back through the square with the rule reversed and the plain pair returns in green.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Playfair cipher (Charles Wheatstone, 1854, named for Lyon Playfair, who promoted it), with the classic example PLAYFAIR EXAMPLE and HIDE THE GOLD IN THE TREE STUMP; the 3 by 5 capitals of Typewriter (pattern round 18) drawn at two LEDs a cell, and the 5 by 7 capitals of Photon Disk (pattern round 70), copied from biliteral-cipher.js; pattern round 106
// Round:   106
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.25..4, Key=0..5, Message=0..5
//
// Knob 1: Hue. Turns the page round the wheel: at 0 the square is blue, a plain letter gold, a cipher letter pink and a letter that has come back from the cipher green. The square and the ruling, which are dim, skip orange and yellow for crimson and green so they do not read brown.
// Knob 2: Speed. At 2 the square is laid in 1.25 s and the first pair starts at 1.6 s. A pair takes 1.3 s to encrypt (the plain pair written at 0, the rule drawn from 0.26 to 0.65 s, the two new cells lit from 0.65 s, the cipher pair written at 0.81 s) and 0.9 s to decrypt. The classic message of 13 pairs is encrypted by 18.5 s, decrypted by 31.2 s, held to 33.7 s and cleared by 34.4 s, and then the page starts again. At 0.25 it is eight times slower, at 4 twice as fast.
// Knob 3: Key. The keyword, snapped to one of six: PLAYFAIR EXAMPLE, MONARCHY, WHEATSTONE, TELEGRAPH, CRYPTOGRAM, LORD PLAYFAIR. Its letters without repeats come first in the square, in a paler ink, J counted as I, then the rest of the alphabet.
// Knob 4: Message. The message, snapped to one of six: HIDE THE GOLD IN THE TREE STUMP (13 pairs, with an X cut into TREE), INSTRUMENTS (6, with an X at the odd end), BALLOON AT DAWN (7, with an X cut into BALLOON), MEET ME AT NOON (6), COME QUICKLY (6, with an X at the odd end) and SEND MORE WATER (7, with an X at the odd end). Any key goes with any message.

const W = 64, H = 128;
const { floor, min, max, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---- The two faces. G35: 3 by 5 capitals of Typewriter, rows top to
// bottom, one bit per column, drawn here at two LEDs a cell. G57: the 5 by 7
// capitals of Photon Disk, copied from biliteral-cipher.js; J is left out,
// the square has no J.
const G35 = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100", G: "011100101101011",
  H: "101101111101101", I: "111010010010111", K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101", O: "010101101101010",
  P: "110101110100100", Q: "010101101111011", R: "110101110101101", S: "011100010001110", T: "111010010010010", U: "101101101101011", V: "101101101010010",
  W: "101101111111101", X: "101101010101101", Y: "101101010010010", Z: "111001010100111",
};
const G57 = {
  A: ".###. #...# #...# ##### #...# #...# #...#", B: "####. #...# #...# ####. #...# #...# ####.", C: ".###. #...# #.... #.... #.... #...# .###.",
  D: "####. #...# #...# #...# #...# #...# ####.", E: "##### #.... #.... ####. #.... #.... #####", F: "##### #.... #.... ####. #.... #.... #....",
  G: ".###. #...# #.... #.### #...# #...# .####", H: "#...# #...# #...# ##### #...# #...# #...#", I: ".###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.",
  K: "#...# #..#. #.#.. ##... #.#.. #..#. #...#", L: "#.... #.... #.... #.... #.... #.... #####", M: "#...# ##.## #.#.# #.#.# #...# #...# #...#",
  N: "#...# #...# ##..# #.#.# #..## #...# #...#", O: ".###. #...# #...# #...# #...# #...# .###.", P: "####. #...# #...# ####. #.... #.... #....",
  Q: ".###. #...# #...# #...# #.#.# #..#. .##.#", R: "####. #...# #...# ####. #.#.. #..#. #...#", S: ".#### #.... #.... .###. ....# ....# ####.",
  T: "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..", U: "#...# #...# #...# #...# #...# #...# .###.", V: "#...# #...# #...# #...# #...# .#.#. ..#..",
  W: "#...# #...# #...# #.#.# #.#.# #.#.# .#.#.", X: "#...# #...# .#.#. ..#.. .#.#. #...# #...#", Y: "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..",
  Z: "##### ....# ...#. ..#.. .#... #.... #####",
};
const B35 = {}, B57 = {};
for (const k in G35) B35[k] = Uint8Array.from(G35[k], (c) => (c === "1" ? 1 : 0));
for (const k in G57) B57[k] = Uint8Array.from(G57[k].replace(/ /g, ""), (c) => (c === "#" ? 1 : 0));

// Marks 7 by 7 for the ledger: the shift along a row, down a column and the
// rectangle, drawn from rows of text; the others are the same turned round.
const RIGHT = ["...#...", "....#..", ".....#.", "#######", ".....#.", "....#..", "...#..."];
const mirror = (a) => a.map((r) => [...r].reverse().join(""));
const flip = (a) => [...a].reverse();
const turn = (a) => a[0].split("").map((_, x) => a.map((r) => r[x]).join(""));
const MARK = [RIGHT, turn(RIGHT), ["#######", "#.....#", "#.....#", "#.....#", "#.....#", "#.....#", "#######"]];
const MARKR = [mirror(RIGHT), flip(turn(RIGHT)), MARK[2]];

// ---- The cipher. The square is the keyword's letters without repeats, then
// the alphabet without J, row by row; J in a message is I.
const KEYS = ["PLAYFAIR EXAMPLE", "MONARCHY", "WHEATSTONE", "TELEGRAPH", "CRYPTOGRAM", "LORD PLAYFAIR"];
const MSGS = ["HIDE THE GOLD IN THE TREE STUMP", "INSTRUMENTS", "BALLOON AT DAWN", "MEET ME AT NOON", "COME QUICKLY", "SEND MORE WATER"];
const ALPHA = "ABCDEFGHIKLMNOPQRSTUVWXYZ";

function makeSquare(key) {
  const sq = [];
  for (const ch of key + ALPHA) {
    const c = ch === "J" ? "I" : ch;
    if (c >= "A" && c <= "Z" && !sq.includes(c)) sq.push(c);
  }
  return sq;
}
// Cut the letters into pairs: a double letter gets a filler between, a lone
// last letter gets one after it, X, or Q after an X.
function pairsOf(msg) {
  const L = [...msg].map((c) => (c === "J" ? "I" : c)).filter((c) => c >= "A" && c <= "Z");
  const out = [];
  for (let i = 0; i < L.length; ) {
    const a = L[i], b = L[i + 1];
    if (b === undefined || a === b) {
      out.push([a, a === "X" ? "Q" : "X"]);
      i += 1;
    } else {
      out.push([a, b]);
      i += 2;
    }
  }
  return out;
}
// One pair through the square, dir +1 to encrypt, -1 to decrypt: indices of
// the two cells they land in and the rule, 0 row, 1 column, 2 rectangle.
function rule(sq, a, b, dir) {
  const ia = sq.indexOf(a), ib = sq.indexOf(b), ra = floor(ia / 5), ca = ia % 5, rb = floor(ib / 5), cb = ib % 5, m = (v) => (v + dir + 5) % 5;
  if (ra === rb) return { kind: 0, a: ra * 5 + m(ca), b: rb * 5 + m(cb) };
  if (ca === cb) return { kind: 1, a: m(ra) * 5 + ca, b: m(rb) * 5 + cb };
  return { kind: 2, a: ra * 5 + cb, b: rb * 5 + ca };
}
function makePlan(keyIx, msgIx) {
  const sq = makeSquare(KEYS[keyIx]), prs = pairsOf(MSGS[msgIx]);
  // How many of the square's first cells are the keyword's own letters.
  const nk = makeSquare(KEYS[keyIx]).findIndex((c) => !KEYS[keyIx].replace(/J/g, "I").includes(c));
  const steps = prs.map(([a, b]) => {
    const e = rule(sq, a, b, 1), ca = sq[e.a], cb = sq[e.b];
    // The way back starts from the cipher pair alone.
    const d = rule(sq, ca, cb, -1);
    return { p: [a, b], pi: [sq.indexOf(a), sq.indexOf(b)], kind: e.kind, ei: [e.a, e.b], c: [ca, cb], di: [d.a, d.b], d: [sq[d.a], sq[d.b]] };
  });
  return { sq, nk, steps, n: steps.length };
}

// ---- Layout. The square: 12 by 12 cells from (2, 2). The ledger: lines
// 9 rows apart from row 65, seven in view, the plain pair at x 3, the rule
// at 17, the cipher pair at 27, the reversed rule at 41, the pair that comes
// back at 51.
const SQX = 2, SQY = 2, CELL = 12;
const RIB = 65, PITCH = 9, VIS = 7;
const COLP = 3, COLA = 17, COLC = 27, COLB = 41, COLD = 51;
// Seconds at Speed 2.
const LAY = 0.05, T0 = 1.6, TE = 1.3, TD = 0.9, REST = 1.0, HOLD = 2.5, FADE = 0.7;

export function setup(params) {
  params.s = {
    buf: new Float32Array(W * H * 3), plan: null, keyIx: -1, msgIx: -1,
    hue: 0, speed: 2, c: 0, cam: 0, pal: null, palHue: -1,
  };
}

// The square and the ruling are dim, and a dim orange or yellow reads as
// brown, so their hue goes to crimson or green when it would land there.
function palette(S) {
  const h = S.hue;
  let ht = h + 0.58;
  ht -= floor(ht);
  ht = ht < 0.17 ? 0.94 + ht * 0.3 : ht < 0.33 ? 0.33 : ht;
  S.pal = {
    t1: hsv(ht, 0.45, 0.2), t2: hsv(ht, 0.45, 0.14),
    keyInk: hsv(ht, 0.2, 0.98), restInk: hsv(ht, 0.5, 0.6),
    plain: hsv(h + 0.11, 0.85, 1), cipher: hsv(h + 0.88, 0.8, 1), back: hsv(h + 0.38, 0.8, 1),
    rule: hsv(ht, 0.12, 0.95), dim: hsv(ht, 0.5, 0.3), ink: [0.02, 0.02, 0.03],
  };
  S.palHue = h;
}

function lengths(plan) {
  const t1 = T0 + plan.n * TE, tD = t1 + REST, tH = tD + plan.n * TD, tF = tH + HOLD;
  return { t1, tD, tH, tF, len: tF + FADE };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.25, 4);
  const keyIx = cl(Math.round(k[2]), 0, 5), msgIx = cl(Math.round(k[3]), 0, 5);
  if (keyIx !== S.keyIx || msgIx !== S.msgIx) {
    S.keyIx = keyIx;
    S.msgIx = msgIx;
    S.plan = makePlan(keyIx, msgIx);
    S.c = 0;
    S.cam = 0;
  }
  const L = lengths(S.plan), ds = (d * S.speed) / 2;
  S.c += ds;
  if (S.c >= L.len) {
    S.c -= L.len;
    S.cam = 0;
  }
  // The ledger follows the line being worked on, and runs back up to the
  // first line when the way back starts.
  const n = S.plan.n;
  let cur = 0;
  if (S.c < T0) cur = 0;
  else if (S.c < L.t1) cur = floor((S.c - T0) / TE);
  else if (S.c < L.tD - 0.5) cur = n - 1;
  else if (S.c < L.tD) cur = 0;
  else cur = min(n - 1, floor((S.c - L.tD) / TD));
  const target = max(0, (cur + 1 - VIS) * PITCH);
  S.cam += (target - S.cam) * (1 - exp(-ds * 5));
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.plan) return;
  if (S.palHue !== S.hue) palette(S);
  const { buf, plan, pal } = S, c = S.c, L = lengths(plan), n = plan.n, sq = plan.sq;
  buf.fill(0);
  const set = (x, y, col, a = 1) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    buf[o] = col[0] * a;
    buf[o + 1] = col[1] * a;
    buf[o + 2] = col[2] * a;
  };
  const fresh = (col, age) => (age < 0.35 ? mix(col, [1, 1, 1], 0.8 * (1 - age / 0.35)) : col);
  const out = c > L.tF ? 1 - (c - L.tF) / FADE : 1;

  // Which step is working, how far through it, and which way.
  let st = -1, u = 0, back = false;
  if (c >= T0 && c < L.t1) {
    st = floor((c - T0) / TE);
    u = (c - T0 - st * TE) / TE;
  } else if (c >= L.tD && c < L.tH) {
    st = floor((c - L.tD) / TD);
    u = (c - L.tD - st * TD) / TD;
    back = true;
  }
  const cur = st >= 0 ? plan.steps[st] : null;
  // The cells in use: where the pair starts, where it comes out.
  const from = cur ? (back ? cur.ei : cur.pi) : null, to = cur ? (back ? cur.di : cur.ei) : null;
  const inCol = back ? pal.cipher : pal.plain, outCol = back ? pal.back : pal.cipher;
  const ina = cur ? cl(u / 0.15, 0, 1) * (1 - cl((u - 0.92) / 0.08, 0, 1)) : 0;
  const outa = cur ? cl((u - 0.5) / 0.12, 0, 1) * (1 - cl((u - 0.92) / 0.08, 0, 1)) : 0;

  // ---- the square ----
  for (let i = 0; i < 25; i++) {
    const k = c / LAY - i;
    if (k < 0) continue;
    const appear = cl(k / 2.5, 0, 1);
    const r = floor(i / 5), cc = i % 5, x0 = SQX + cc * CELL, y0 = SQY + r * CELL;
    let bg = (r + cc) & 1 ? pal.t1 : pal.t2, ink = i < plan.nk ? pal.keyInk : pal.restInk;
    let hl = 0, hcol = inCol;
    if (cur) {
      if (from.includes(i)) {
        hl = ina;
        hcol = inCol;
      }
      if (to.includes(i) && outa > 0) {
        hl = outa;
        hcol = outCol;
      }
    }
    if (hl > 0) {
      bg = mix(bg, hcol, 0.95 * hl);
      ink = mix(ink, pal.ink, hl);
    }
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) set(x0 + x, y0 + y, bg, appear * out);
    const g = B35[sq[i]];
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 3; x++)
        if (g[y * 3 + x]) for (let v = 0; v < 2; v++) for (let w = 0; w < 2; w++) set(x0 + 3 + x * 2 + w, y0 + 1 + y * 2 + v, ink, appear * out);
  }

  // ---- the rule ----
  if (cur) {
    const pr = cl((u - 0.2) / 0.3, 0, 1);
    if (pr > 0) {
      const a = from[0], b = from[1], ra = floor(a / 5), ca = a % 5, rb = floor(b / 5), cb = b % 5;
      // The outline: the whole row or column for a shift, the box between the
      // two cells for a rectangle.
      let c0, c1, r0, r1;
      if (cur.kind === 0) [c0, c1, r0, r1] = [0, 4, ra, ra];
      else if (cur.kind === 1) [c0, c1, r0, r1] = [ca, ca, 0, 4];
      else [c0, c1, r0, r1] = [min(ca, cb), max(ca, cb), min(ra, rb), max(ra, rb)];
      const xa = SQX + c0 * CELL, xb = SQX + (c1 + 1) * CELL - 1, ya = SQY + r0 * CELL, yb = SQY + (r1 + 1) * CELL - 1;
      const pts = [];
      for (let x = xa; x <= xb; x++) pts.push([x, ya]);
      for (let y = ya + 1; y <= yb; y++) pts.push([xb, y]);
      for (let x = xb - 1; x >= xa; x--) pts.push([x, yb]);
      for (let y = yb - 1; y > ya; y--) pts.push([xa, y]);
      const m = floor(pr * pts.length);
      for (let i = 0; i < m; i++) set(pts[i][0], pts[i][1], pal.rule, out);
      // The arrows of a shift sit in the margin of each starting cell: right
      // (or left going back) for a row, down (or up) for a column.
      if (cur.kind < 2 && pr >= 1)
        for (const i of from) {
          const x0 = SQX + (i % 5) * CELL, y0 = SQY + floor(i / 5) * CELL;
          const sign = back ? -1 : 1;
          if (cur.kind === 0) {
            // a chevron in the margin on the side it moves to
            const bx = sign > 0 ? x0 + 9 : x0, ptsC = sign > 0 ? [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]] : [[2, 0], [1, 1], [0, 2], [1, 3], [2, 4]];
            for (const [dx, dy] of ptsC) set(bx + dx, y0 + 3 + dy, pal.ink, out);
          } else {
            const ptsC = sign > 0 ? [[1, 0], [1, 1], [1, 2], [0, 3], [2, 3], [1, 4]] : [[1, 0], [0, 1], [2, 1], [1, 2], [1, 3], [1, 4]];
            for (const [dx, dy] of ptsC) set(x0 + 9 + dx, y0 + 3 + dy, pal.ink, out);
          }
        }
    }
  }

  // ---- the ledger ----
  const camY = S.cam;
  // A line fades as it scrolls up through one pitch above its home, and is
  // cut at the ledger's top edge.
  const glyph = (ch, x0, y0, col, a) => {
    const g = B57[ch], f = cl((y0 - (RIB - PITCH)) / PITCH, 0, 1);
    for (let y = 0; y < 7; y++) {
      const yy = y0 + y;
      if (yy < RIB || yy >= H) continue;
      for (let x = 0; x < 5; x++) if (g[y * 5 + x]) set(x0 + x, yy, col, a * f * out);
    }
  };
  const mark = (rows, x0, y0, col, a) => {
    const f = cl((y0 - (RIB - PITCH)) / PITCH, 0, 1);
    for (let y = 0; y < 7; y++) {
      const yy = y0 + y;
      if (yy < RIB || yy >= H) continue;
      for (let x = 0; x < 7; x++) if (rows[y][x] === "#") set(x0 + x, yy, col, a * f * out);
    }
  };
  for (let i = 0; i < n; i++) {
    const s = plan.steps[i], y0 = RIB + i * PITCH - Math.round(camY);
    if (y0 + 7 <= RIB || y0 >= H) continue;
    const te = T0 + i * TE, td = L.tD + i * TD;
    // The ruled page: every line is there before anything is written on it.
    if (y0 + 7 >= RIB && y0 + 7 < H) {
      const f = cl((y0 - (RIB - PITCH)) / PITCH, 0, 1);
      for (let x = 2; x < 62; x++) set(x, y0 + 7, pal.dim, 0.75 * f * out);
    }
    // plain pair, then the rule, then the cipher pair
    for (let k = 0; k < 2; k++) {
      const t = te + 0.07 * k;
      if (c >= t) glyph(s.p[k], COLP + 6 * k, y0, fresh(pal.plain, c - t), 1);
    }
    if (c >= te + 0.3) mark(MARK[s.kind], COLA, y0, pal.rule, 0.7);
    for (let k = 0; k < 2; k++) {
      const t = te + 0.62 * TE + 0.1 * k;
      if (c >= t) glyph(s.c[k], COLC + 6 * k, y0, fresh(pal.cipher, c - t), 1);
    }
    if (c >= td + 0.3) mark(MARKR[s.kind], COLB, y0, pal.rule, 0.7);
    for (let k = 0; k < 2; k++) {
      const t = td + 0.62 * TD + 0.1 * k;
      if (c >= t) glyph(s.d[k], COLD + 6 * k, y0, fresh(pal.back, c - t), 1);
    }
  }
  // A rule between the square and the ledger.
  for (let x = SQX; x < SQX + 5 * CELL; x++) set(x, 63, pal.dim, 0.6 * out);

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3] * 255), min(255, buf[p * 3 + 1] * 255), min(255, buf[p * 3 + 2] * 255));
}
