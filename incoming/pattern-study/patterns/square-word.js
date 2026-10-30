// ===== Patternflow pattern =====
// Title:   Square Word
// Family:  type
// Idea:    Two English words stand as an ordinary line of letters, one in each half of the panel, and then their letters glide and squeeze into the boxes of a square character the way Xu Bing writes English, left to right, top to bottom, outside to inside, so the panel holds two square characters one above the other, a phrase read top to bottom like vertical writing, before it fades and the next phrase is written.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Square Word Calligraphy (Xu Bing, An Introduction to Square Word Calligraphy, 1994-96); the single-stroke letters and the box templates drawn here, pattern round 78
// Round:   78
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Phrase=0..7, Weight=1.5..4
//
// Knob 1: Hue. Turns every letter round the wheel together. At 0 the top word runs from gold through yellow to green, 0.07 of the wheel a letter, and the bottom word from azure through blue and violet to magenta, so letters that touch in the square stay apart by colour; at 0.5 the two words swap.
// Knob 2: Speed. At 2 a phrase takes 8.4 s: the letters are written in a line in 1.3 s, stand 0.7 s, glide into the square over 2.4 s, the two characters hold 3.2 s and fade out over 0.8 s. At 0.2 it all runs ten times slower, at 3 one and a half times faster.
// Knob 3: Phrase. Which of the eight phrases is written first, to the nearest whole number: 0 LOOK UP, 1 HELLO WORLD, 2 GOOD LUCK, 3 ON AIR, 4 LONG LIFE, 5 ART NOW, 6 OPEN BOOK, 7 READ ME. The others follow in that order.
// Knob 4: Weight. The pen, 1.5 LEDs wide at the opening up to 4. As a letter goes into the square its strokes thicken by 30% and the upright ones by up to 70%, the way a brush lays a down stroke heavier than a cross stroke; at 4 the O of a line letter fills in, while the O squeezed into HELLO's 19 LED box keeps a hole a few LEDs wide.
// Buttons: K1 tap fades the phrase and writes the next one.

// A letter is a few polylines on an 8 by 8 grid. Laid into a box of any
// shape it stretches with it, but its stroke stays the pen's width in
// LEDs, so the E of HELLO, squeezed into a quarter of the square, keeps
// three bars and two gaps. A template divides the 58 LED square into
// boxes in reading order, left to right, top to bottom, outside to
// inside, which is Xu Bing's rule: a two by two grid, a tall box at the
// left with one over two at the right, a roof over two, one over two
// over two, two over three, two tall boxes and a stack, two over one,
// one over one, and the enclosure, where an O or a U takes the whole
// square and the next letter sits inside it. Each word was given the
// template that suits its letters by hand: A as a roof, W wide on top or
// at the bottom, the long upright of an L, B or R as the left side, O
// round N and U round P. The narrowest box is the I of LIFE, 12 LEDs
// across; the L, L and O of HELLO get 19 by 29. Letters keep 1 + 0.7
// times the pen's width from the edge of their box.

const W = 64, H = 128, N = W * H, SQ = 58, X0 = 3, Y0 = [3, 67];
const { floor, round, min, max, abs, sqrt } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
// Seconds at Speed 2.
const WRITE = 1.3, LINE = 0.7, GLIDE = 2.4, HOLD = 3.2, FADE = 0.8, CYCLE = WRITE + LINE + GLIDE + HOLD + FADE;
const HUE0 = 0.12;

// x right, y down, 0..8.
const FONT = {
  A: [[0, 8, 4, 0, 8, 8], [1.5, 5, 6.5, 5]],
  B: [[0, 0, 0, 8], [0, 0, 5, 0, 7, 1, 7, 3, 5, 4, 0, 4], [5, 4, 7.5, 5, 8, 6.5, 7.5, 7.5, 5.5, 8, 0, 8]],
  C: [[8, 1.5, 6, 0, 2, 0, 0, 2, 0, 6, 2, 8, 6, 8, 8, 6.5]],
  D: [[0, 0, 0, 8, 4.5, 8, 8, 5, 8, 3, 4.5, 0, 0, 0]],
  E: [[8, 0, 0, 0, 0, 8, 8, 8], [0, 4, 6, 4]],
  F: [[8, 0, 0, 0, 0, 8], [0, 4, 6, 4]],
  G: [[8, 1.5, 6, 0, 2, 0, 0, 2, 0, 6, 2, 8, 6, 8, 8, 6, 8, 4.5, 4.5, 4.5]],
  H: [[0, 0, 0, 8], [8, 0, 8, 8], [0, 4, 8, 4]],
  I: [[4, 0, 4, 8], [1.5, 0, 6.5, 0], [1.5, 8, 6.5, 8]],
  J: [[3, 0, 8, 0, 8, 6, 6, 8, 2, 8, 0, 6]],
  K: [[0, 0, 0, 8], [8, 0, 0, 5], [2.6, 3.4, 8, 8]],
  L: [[0, 0, 0, 8, 8, 8]],
  M: [[0, 8, 0, 0, 4, 5, 8, 0, 8, 8]],
  N: [[0, 8, 0, 0, 8, 8, 8, 0]],
  O: [[2, 0, 6, 0, 8, 2, 8, 6, 6, 8, 2, 8, 0, 6, 0, 2, 2, 0]],
  P: [[0, 8, 0, 0, 6, 0, 8, 1.5, 8, 3, 6, 4.5, 0, 4.5]],
  Q: [[2, 0, 6, 0, 8, 2, 8, 6, 6, 8, 2, 8, 0, 6, 0, 2, 2, 0], [4.5, 5, 8, 8.5]],
  R: [[0, 8, 0, 0, 6, 0, 8, 1.5, 8, 3, 6, 4.5, 0, 4.5], [4, 4.5, 8, 8]],
  S: [[8, 1.5, 6.5, 0, 1.5, 0, 0, 1.5, 0, 2.5, 1.5, 4, 6.5, 4, 8, 5.5, 8, 6.5, 6.5, 8, 1.5, 8, 0, 6.5]],
  T: [[0, 0, 8, 0], [4, 0, 4, 8]],
  U: [[0, 0, 0, 6, 2, 8, 6, 8, 8, 6, 8, 0]],
  V: [[0, 0, 4, 8, 8, 0]],
  W: [[0, 0, 2, 8, 4, 3, 6, 8, 8, 0]],
  X: [[0, 0, 8, 8], [8, 0, 0, 8]],
  Y: [[0, 0, 4, 4], [8, 0, 4, 4, 4, 8]],
  Z: [[0, 0, 8, 0, 0, 8, 8, 8]],
};

// Boxes [x0, y0, x1, y1] in the unit square, in reading order.
const T3 = 1 / 3, T6 = 2 / 3;
const TPL = {
  tb: [[0, 0, 1, 0.45], [0, 0.45, 1, 1]],
  "o@": [[0, 0, 1, 1], [0.24, 0.24, 0.76, 0.76]],
  "u@": [[0, 0, 1, 1], [0.24, 0.02, 0.76, 0.74]],
  "roof": [[0, 0, 1, 0.42], [0, 0.42, 0.5, 1], [0.5, 0.42, 1, 1]],
  "lr/b": [[0, 0, 0.5, 0.56], [0.5, 0, 1, 0.56], [0, 0.56, 1, 1]],
  g4: [[0, 0, 0.5, 0.5], [0.5, 0, 1, 0.5], [0, 0.5, 0.5, 1], [0.5, 0.5, 1, 1]],
  "l|t/lr": [[0, 0, 0.38, 1], [0.38, 0, 1, 0.48], [0.38, 0.48, 0.69, 1], [0.69, 0.48, 1, 1]],
  "ll|tb": [[0, 0, 0.32, 1], [0.32, 0, 0.52, 1], [0.52, 0, 1, 0.5], [0.52, 0.5, 1, 1]],
  "lr/lmr": [[0, 0, 0.5, 0.5], [0.5, 0, 1, 0.5], [0, 0.5, T3, 1], [T3, 0.5, T6, 1], [T6, 0.5, 1, 1]],
  "t/lr/lr": [[0, 0, 1, 0.34], [0, 0.34, 0.5, 0.67], [0.5, 0.34, 1, 0.67], [0, 0.67, 0.5, 1], [0.5, 0.67, 1, 1]],
};

const PHRASES = [
  [["LOOK", "g4"], ["UP", "u@"]],
  [["HELLO", "lr/lmr"], ["WORLD", "t/lr/lr"]],
  [["GOOD", "g4"], ["LUCK", "l|t/lr"]],
  [["ON", "o@"], ["AIR", "roof"]],
  [["LONG", "l|t/lr"], ["LIFE", "ll|tb"]],
  [["ART", "roof"], ["NOW", "lr/b"]],
  [["OPEN", "g4"], ["BOOK", "l|t/lr"]],
  [["READ", "l|t/lr"], ["ME", "tb"]],
];

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return o;
}

// The practice grid behind each character: the square's outline and a
// dashed cross through its middle, as in a copybook.
const GRID = new Uint8Array(N);
for (const y0 of Y0) {
  for (let i = -1; i <= SQ; i++) {
    for (const [x, y] of [[X0 + i, y0 - 1], [X0 + i, y0 + SQ], [X0 - 1, y0 + i], [X0 + SQ, y0 + i]])
      if (x >= 0 && x < W && y >= 0 && y < H) GRID[y * W + x] = 2;
    if (i >= 0 && i < SQ && (i & 3) < 2) {
      GRID[(y0 + SQ / 2) * W + X0 + i] = 1;
      GRID[(y0 + i) * W + X0 + SQ / 2] = 1;
    }
  }
}

export function setup(params) {
  params.s = {
    hue: 0, rate: 1, wt: 1.5, st: -1, n: 0, t: 0, btn: false,
    cov: new Float32Array(N), id: new Uint8Array(N), pal: [], words: [],
  };
  for (let i = 0; i < 13; i++) params.s.pal.push([0, 0, 0]);
  return params.s;
}

// The letters of a phrase with their two boxes, the line and the square.
function build(S) {
  const ph = PHRASES[(S.st + S.n) % PHRASES.length];
  S.words = ph.map(([word, tpl], k) => {
    const n = word.length, boxes = TPL[tpl], lw = 8.5, lh = 20, adv = 12.4;
    const lx = 32 - (adv * (n - 1) + lw) / 2, ly = Y0[k] + SQ / 2 - lh / 2;
    return [...word].map((ch, j) => {
      const b = boxes[j];
      return {
        g: FONT[ch], j, k,
        line: [lx + adv * j, ly, lx + adv * j + lw, ly + lh],
        sq: [X0 + b[0] * SQ, Y0[k] + b[1] * SQ, X0 + b[2] * SQ, Y0[k] + b[3] * SQ],
      };
    });
  });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.rate = cl(k[1] == null ? 2 : k[1], 0.2, 3) / 2;
  S.wt = cl(k[3] == null ? 1.5 : k[3], 1.5, 4);
  const st = round(cl(k[2] || 0, 0, PHRASES.length - 1));
  if (st !== S.st) {
    S.st = st;
    S.n = 0;
    S.t = 0;
    build(S);
  }
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  if (btn && !S.btn && S.t < CYCLE - FADE) S.t = CYCLE - FADE;
  S.btn = btn;
  S.t += d * S.rate;
  if (S.t >= CYCLE) {
    S.t -= CYCLE;
    S.n++;
    build(S);
  }
}

// One stroke segment, lit by the pixel centre's distance to it.
function seg(S, ax, ay, bx, by, w, c) {
  const { cov, id } = S, r = w / 2 + 0.5;
  const x0 = max(0, floor(min(ax, bx) - r)), x1 = min(W - 1, floor(max(ax, bx) + r));
  const y0 = max(0, floor(min(ay, by) - r)), y1 = min(H - 1, floor(max(ay, by) + r));
  const dx = bx - ax, dy = by - ay, ll = dx * dx + dy * dy || 1e-9;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay, u = cl((px * dx + py * dy) / ll, 0, 1);
      const ex = px - u * dx, ey = py - u * dy, v = r - sqrt(ex * ex + ey * ey);
      if (v <= 0) continue;
      const p = y * W + x, cv = v > 1 ? 1 : v;
      if (cv > cov[p]) {
        cov[p] = cv;
        id[p] = c;
      }
    }
}

// A letter in box b; m is how far it has gone into the square (heavier
// down strokes), u how much of it has been written, by length.
function letter(S, L, b, m, u, c) {
  const w = S.wt, sx = (b[2] - b[0]) / 8, sy = (b[3] - b[1]) / 8;
  let total = 0;
  if (u < 1) for (const s of L.g) for (let i = 2; i < s.length; i += 2) total += Math.hypot((s[i] - s[i - 2]) * sx, (s[i + 1] - s[i - 1]) * sy);
  let left = u * total;
  for (const s of L.g)
    for (let i = 2; i < s.length; i += 2) {
      const ax = b[0] + s[i - 2] * sx, ay = b[1] + s[i - 1] * sy;
      let bx = b[0] + s[i] * sx, by = b[1] + s[i + 1] * sy;
      const len = Math.hypot(bx - ax, by - ay);
      if (u < 1) {
        if (left <= 0) return;
        if (left < len) {
          const f = left / len;
          bx = ax + (bx - ax) * f;
          by = ay + (by - ay) * f;
        }
        left -= len;
      }
      const vert = len > 0 ? abs(by - ay) / len : 0;
      seg(S, ax, ay, bx, by, w * (1 + m * (0.3 + 0.4 * vert * vert)), c);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.words.length) return;
  const { cov, id, pal } = S, t = S.t, w = S.wt;
  cov.fill(0);
  const pad = w * 0.7 + 1;
  let grid = 0;
  for (const word of S.words)
    for (const L of word) {
      const { j, k } = L;
      // Written stroke by stroke in the line, letter after letter.
      const wu = cl((t - j * 0.18 - k * 0.1) / 0.4, 0, 1);
      // Then each letter glides into its box, one after another.
      const gu = ease((t - WRITE - LINE - k * 0.3 - j * 0.2) / 1.3);
      grid = max(grid, gu);
      const q = L.sq, a = L.line;
      const sb = [q[0] + pad, q[1] + pad, q[2] - pad, q[3] - pad];
      const b = [0, 1, 2, 3].map((i) => a[i] + (sb[i] - a[i]) * gu);
      letter(S, L, b, gu, wu, 1 + k * 6 + j);
    }
  const fade = 1 - cl((t - (CYCLE - FADE)) / FADE, 0, 1);
  for (let k = 0; k < 2; k++)
    for (let j = 0; j < 6; j++) hsv(HUE0 + S.hue + k * 0.5 + j * 0.07, 0.9, fade, pal[1 + k * 6 + j]);
  const gc = hsv(HUE0 + S.hue + 0.75, 0.6, 1, [0, 0, 0]);
  const gl = grid * fade;
  for (let p = 0; p < N; p++) {
    const x = p % W, y = (p - x) / W, c = cov[p];
    let r = 0, g = 0, bl = 0;
    if (c > 0) {
      const col = pal[id[p]];
      r = col[0] * c;
      g = col[1] * c;
      bl = col[2] * c;
    }
    const gv = GRID[p] ? (GRID[p] === 2 ? 0.22 : 0.16) * gl * (1 - c) : 0;
    display.setPixel(x, y, round(r + gc[0] * gv), round(g + gc[1] * gv), round(bl + gc[2] * gv));
  }
}
