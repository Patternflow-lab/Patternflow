// ===== Patternflow pattern =====
// Title:   Anagram
// Family:  type
// Idea:    A word stands down one side of the tall panel a letter to a band, LISTEN from top to bottom, and its letters, each in a colour of its own, glide across to the other side along S-shaped paths to their places in the next word of the set, SILENT, leaving their paths drawn behind them and a faint copy of the old word where they set out, so that every pair of letters whose order the new word reverses crosses once, a white spark marks each crossing as it happens and a counter at the top counts them to the number of inversions between the two words, 5 from LISTEN to SILENT and 9 on to ENLIST.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: anagrams; the number of inversions between two orderings as a distance (Maurice Kendall, A New Measure of Rank Correlation, Biometrika, 1938); the 5 by 7 capitals and figures of Photon Disk (pattern round 70), copied from autogram.js and redrawn as strokes through their dots so they scale; pattern round 76
// Round:   76
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Set=0..7, Weight=0..1
//
// Knob 1: Hue. Turns every letter's colour round the wheel together. The letters of a set's first word are spread evenly round the wheel at 75% saturation, starting from orange at 0: in LISTEN the L is orange, the I yellow-green, the S green, the T sky blue, the E violet and the N pink.
// Knob 2: Speed. At 2 a word holds for 1.8 s and the letters take 2.4 s to cross, 4.2 s a word; at 0.2 a word takes 42 s and at 3 2.8 s.
// Knob 3: Set. Which anagrams: 0 LISTEN SILENT ENLIST TINSEL INLETS, 1 STARE TEARS RATES ASTER, 2 EVIL VILE LIVE VEIL, 3 SPOT STOP POTS TOPS POST OPTS, 4 LEAST SLATE STEAL TALES STALE, 5 HEART EARTH HATER, 6 PETAL PLATE PLEAT LEAPT, 7 RETAINS RETINAS NASTIER STEARIN. The letters grow to fill their bands: 4 LEDs between dots for four letters, 2.7 for six, 2.3 for seven. The crossings per step run from 1 (VEIL to EVIL) to 17 (RETINAS to NASTIER, of the 21 possible).
// Knob 4: Weight. The stroke through the dots: 0.68 of the dot pitch wide at 0 (1.9 LEDs in LISTEN), 1.52 at 1 (4.2 LEDs), where the dots of a letter run together into a heavy face and the bars of an E nearly close up.

// Two letters cross between word A and word B exactly when B puts them in
// the other order, because every letter moves on the same clock: its height
// is y0 + (y1 - y0) e(s), with one e for all, so the gap between two letters
// is a straight line in e and changes sign once or not at all. The crossings
// of one step are the inversions of the permutation from A to B, Kendall's
// distance between the two orderings; the most there can be is n(n-1)/2,
// when B is A backwards. Where k paths pass through one point, as the L, I
// and S of LISTEN do on the way to SILENT, that point is k(k-1)/2 crossings
// and the counter jumps by that many at once.

const W = 64, H = 128, TOP = 1, BOT = 127;
const { floor, round, min, max, sqrt, exp, sin, asin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => u * u * (3 - 2 * u);
// The inverse of smooth on 0..1.
const unsmooth = (e) => 0.5 - sin(asin(1 - 2 * e) / 3);
const T_MOVE = 2.4, T_HOLD = 1.8, HUE0 = 0.07;

// Every set is spelt with letters that differ, so each letter is one thing
// with one path.
const SETS = [
  ["LISTEN", "SILENT", "ENLIST", "TINSEL", "INLETS"],
  ["STARE", "TEARS", "RATES", "ASTER"],
  ["EVIL", "VILE", "LIVE", "VEIL"],
  ["SPOT", "STOP", "POTS", "TOPS", "POST", "OPTS"],
  ["LEAST", "SLATE", "STEAL", "TALES", "STALE"],
  ["HEART", "EARTH", "HATER"],
  ["PETAL", "PLATE", "PLEAT", "LEAPT"],
  ["RETAINS", "RETINAS", "NASTIER", "STEARIN"],
];

// Photon Disk's 5 x 7 face, the letters these words need and the figures,
// rows from the top (copied from autogram.js).
const G57 = {
  A: ".###. #...# #...# ##### #...# #...# #...#", E: "##### #.... #.... ####. #.... #.... #####",
  H: "#...# #...# #...# ##### #...# #...# #...#", I: ".###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.",
  L: "#.... #.... #.... #.... #.... #.... #####", N: "#...# #...# ##..# #.#.# #..## #...# #...#",
  O: ".###. #...# #...# #...# #...# #...# .###.", P: "####. #...# #...# ####. #.... #.... #....",
  R: "####. #...# #...# ####. #.#.. #..#. #...#", S: ".#### #.... #.... .###. ....# ....# ####.",
  T: "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..", V: "#...# #...# #...# #...# #...# .#.#. ..#..",
  0: ".###. #...# #..## #.#.# ##..# #...# .###.", 1: "..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.",
  2: ".###. #...# ....# ...#. ..#.. .#... #####", 3: "##### ...#. ..#.. ...#. ....# #...# .###.",
  4: "...#. ..##. .#.#. #..#. ##### ...#. ...#.", 5: "##### #.... ####. ....# ....# #...# .###.",
  6: "..##. .#... #.... ####. #...# #...# .###.", 7: "##### ....# ...#. ..#.. .#... .#... .#...",
  8: ".###. #...# #...# .###. #...# #...# .###.", 9: ".###. #...# #...# .#### ....# ...#. .##..",
};
for (const k in G57) G57[k] = G57[k].replace(/ /g, "");

// A letter as strokes through its dots: runs along a row or a column, and a
// diagonal step where two dots touch only at a corner. A dot with no
// neighbour is a stroke of no length.
const STROKES = {};
for (const k of "AEHILNOPRSTV") {
  const g = G57[k], on = (x, y) => x >= 0 && x < 5 && y >= 0 && y < 7 && g[y * 5 + x] === "#", s = [], used = new Set();
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 5; x++) {
      if (!on(x, y)) continue;
      if (on(x + 1, y) && !on(x - 1, y)) {
        let e = x;
        while (on(e + 1, y)) e++;
        s.push([x, y, e, y]);
        for (let q = x; q <= e; q++) used.add(q + "," + y);
      }
      if (on(x, y + 1) && !on(x, y - 1)) {
        let e = y;
        while (on(x, e + 1)) e++;
        s.push([x, y, x, e]);
        for (let q = y; q <= e; q++) used.add(x + "," + q);
      }
      for (const dx of [-1, 1])
        if (on(x + dx, y + 1) && !on(x + dx, y) && !on(x, y + 1)) s.push([x, y, x + dx, y + 1]), used.add(x + "," + y), used.add(x + dx + "," + (y + 1));
    }
  for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (on(x, y) && !used.has(x + "," + y)) s.push([x, y, x, y]);
  STROKES[k] = s;
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// The layout of a set: n bands, the dot pitch, the two columns.
function begin(S, set) {
  const words = SETS[set], n = words[0].length, bh = (BOT - TOP) / n;
  const c = min(4.1, (bh - 3.5) / 6.4), xl = 2.5 + 2.6 * c;
  Object.assign(S, { set, words, n, bh, c, xl, xr: W - xl, wi: 0, side: 0, phase: 0, pt: 0, s: 0, move: null, last: null, fade: 0, count: 0 });
  S.letters = [...words[0]];
  S.col = S.letters.map(() => [0, 0, 0]);
  S.at = S.letters.map((_, i) => i);
}
const bandY = (S, b) => TOP + (b + 0.5) * S.bh;
const sideX = (S, side) => (side ? S.xr : S.xl);

// The step from the word on show to the next: where each letter goes and
// where on its way it crosses another.
function plan(S) {
  const B = S.words[(S.wi + 1) % S.words.length], to = S.letters.map((ch) => B.indexOf(ch));
  const from = S.at.slice(), xa = sideX(S, S.side), xb = sideX(S, 1 - S.side), cross = [];
  for (let i = 0; i < S.n; i++)
    for (let j = i + 1; j < S.n; j++) {
      const d0 = from[i] - from[j], d1 = to[i] - to[j];
      if (d0 * d1 >= 0) continue;
      const e = d0 / (d0 - d1), s = unsmooth(e);
      cross.push({ s, i, j, x: xa + (xb - xa) * s, y: bandY(S, from[i]) + (to[i] - from[i]) * S.bh * e, at: -1 });
    }
  cross.sort((a, b) => a.s - b.s);
  return { from, to, xa, xb, cross };
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, hw: 1, set: -1, buf: new Float32Array(W * H * 3), t: 0 };
  return params.s;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const set = cl(round(k[2] || 0), 0, SETS.length - 1);
  if (set !== S.set) {
    const first = S.set < 0;
    begin(S, set);
    // The Lab opens with the letters already a third of the way across.
    if (first) (S.phase = 1), (S.move = plan(S)), (S.pt = 0.36 * T_MOVE * (2 / S.speed));
  }
  S.hw = S.c * (0.34 + 0.42 * cl(k[3] || 0, 0, 1));
  for (let i = 0; i < S.n; i++) hsv(S.hue + HUE0 + i / S.n, 0.75, 1, S.col[i]);
  const sc = 2 / S.speed;
  S.t += d;
  S.pt += d;
  if (S.phase === 0 && S.pt >= T_HOLD * sc) {
    S.phase = 1;
    S.pt = 0;
    S.last = S.move;
    S.move = plan(S);
  }
  if (S.phase === 1) {
    S.s = smooth(cl(S.pt / (T_MOVE * sc), 0, 1));
    S.fade = cl(1 - S.pt / (0.45 * T_MOVE * sc), 0, 1);
    let n = 0;
    for (const x of S.move.cross) if (S.s >= x.s) (n++), x.at < 0 && (x.at = S.t);
    S.count = n;
    if (S.pt >= T_MOVE * sc) {
      S.phase = 0;
      S.pt = 0;
      S.s = 1;
      S.at = S.move.to.slice();
      S.side = 1 - S.side;
      S.wi = (S.wi + 1) % S.words.length;
    }
  }
}

// A stroke of half-width hw lit at a, with a glow round it; the brighter
// of what is there and what it brings wins, channel by channel.
function seg(S, x0, y0, x1, y1, hw, c, a, glow) {
  const R = hw + (glow ? 4 : 1.5), b = S.buf, dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
  const ax = max(0, floor(min(x0, x1) - R)), bx = min(W - 1, floor(max(x0, x1) + R));
  const ay = max(0, floor(min(y0, y1) - R)), by = min(H - 1, floor(max(y0, y1) + R));
  for (let y = ay; y <= by; y++)
    for (let x = ax; x <= bx; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, u = l2 > 0 ? cl((px * dx + py * dy) / l2, 0, 1) : 0;
      const dd = sqrt((px - u * dx) ** 2 + (py - u * dy) ** 2) - hw;
      let v = dd < -0.5 ? 1 : dd < 0.5 ? 0.5 - dd : 0;
      if (glow) v += glow * exp(-max(0, dd) / 1.3);
      v *= a;
      if (v <= 0.004) continue;
      const kk = (y * W + x) * 3;
      for (let q = 0; q < 3; q++) b[kk + q] = max(b[kk + q], c[q] * min(1, v));
    }
}

function letter(S, ch, cx, cy, c, a) {
  const p = S.c;
  for (const s of STROKES[ch]) seg(S, cx + (s[0] - 2) * p, cy + (s[1] - 3) * p, cx + (s[2] - 2) * p, cy + (s[3] - 3) * p, S.hw, c, a, 0.18);
}

// Letter i's place on the step m at progress s.
function where(S, m, i, s) {
  return [m.xa + (m.xb - m.xa) * s, bandY(S, m.from[i]) + (m.to[i] - m.from[i]) * S.bh * smooth(s)];
}

// The paths of a step up to progress s, lit at a.
function paths(S, m, s, a) {
  const steps = 48;
  for (let i = 0; i < S.n; i++) {
    let [px, py] = where(S, m, i, 0);
    for (let k = 1; k <= steps; k++) {
      const u = (k / steps) * s;
      if (u <= 0) break;
      const [x, y] = where(S, m, i, u);
      seg(S, px, py, x, y, 0.45, S.col[i], a, 0);
      (px = x), (py = y);
    }
  }
}

// The word a step set out from, faint where it stood.
function ghost(S, m, a) {
  for (let i = 0; i < S.n; i++) letter(S, S.letters[i], m.xa, bandY(S, m.from[i]), S.col[i], a);
}

function sparks(S, m, a, now) {
  const white = [1, 1, 1];
  for (const x of m.cross) {
    if (x.at < 0) continue;
    const age = now - x.at, f = exp(-age / 0.35);
    seg(S, x.x, x.y, x.x, x.y, 0.7 + 1.6 * f, white, a * (0.75 + 0.25 * f), 0.5 * f);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.letters) return;
  const b = S.buf;
  for (let i = 0; i < W * H; i++) (b[i * 3] = 0.01), (b[i * 3 + 1] = 0.008), (b[i * 3 + 2] = 0.02);
  // The step before, fading as the letters set out again: its paths, its
  // sparks and the faint copy of the word it left.
  if (S.last && S.phase === 1 && S.fade > 0) {
    paths(S, S.last, 1, 0.55 * S.fade);
    sparks(S, S.last, 0.8 * S.fade, S.t + 9);
    ghost(S, S.last, 0.22 * S.fade);
  }
  if (S.move) {
    paths(S, S.move, S.phase === 1 ? S.s : 1, 0.55);
    ghost(S, S.move, 0.22);
  }
  if (S.move) sparks(S, S.move, 1, S.t);
  // The letters themselves.
  for (let i = 0; i < S.n; i++) {
    let x, y;
    if (S.phase === 1) [x, y] = where(S, S.move, i, S.s);
    else (x = sideX(S, S.side)), (y = bandY(S, S.at[i]));
    letter(S, S.letters[i], x, y, S.col[i], 1);
  }
  // The count of crossings so far, at the top between the columns, on a
  // dark patch so the letters passing under it do not hide it.
  const num = String(S.phase === 1 ? S.count : S.move ? S.move.cross.length : 0);
  const x0 = round(W / 2 - (num.length * 6 - 1) / 2), y0 = 2;
  for (let y = y0 - 1; y <= y0 + 7; y++)
    for (let x = x0 - 1; x <= x0 + num.length * 6 - 1; x++) {
      const kk = (y * W + x) * 3;
      for (let q = 0; q < 3; q++) b[kk + q] *= 0.25;
    }
  for (let n = 0; n < num.length; n++) {
    const g = G57[num[n]];
    for (let r = 0; r < 7; r++)
      for (let q = 0; q < 5; q++) if (g[r * 5 + q] === "#") {
        const kk = ((y0 + r) * W + x0 + n * 6 + q) * 3;
        b[kk] = b[kk + 1] = b[kk + 2] = 0.95;
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const kk = (y * W + x) * 3;
      display.setPixel(x, y, round(cl(b[kk], 0, 1) * 255), round(cl(b[kk + 1], 0, 1) * 255), round(cl(b[kk + 2], 0, 1) * 255));
    }
}
