// ===== Patternflow pattern =====
// Title:   Square Kufic
// Family:  type
// Idea:    Latin capitals built on a square grid, every stroke and every gap one cell wide, wind a short word four times round the centre of each 64 by 64 square, the band turned a quarter for each side and the four copies running clockwise inward ring by ring to nested squares in the middle, in the manner of the square Kufic of banna'i brickwork, and the bricks are laid along the reading path, a glaze runs through them, turquoise in the top square and cobalt in the bottom, and the square is taken down from the outside in and the next word built.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: square Kufic in banna'i, glazed brick set among plain brick (Seljuk, Ilkhanid and Timurid Iran and Central Asia, as on the Friday Mosque of Isfahan and in 15th-century Herat); the Latin capitals in its manner are drawn for this pattern and are not Arabic, pattern round 83
// Round:   83
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..5, Cell=2..3
//
// Knob 1: Hue. Turns the two glazes round the wheel; the unglazed bricks stay buff. At 0 the top square's glaze is turquoise that runs into green and the bottom square's is cobalt; at 0.5 the top turns crimson and the bottom amber.
// Knob 2: Speed. At 2 a word takes 9 s: its bricks are laid along the reading path over 3.6 s, the glaze runs through them in 2 s, the glazed square holds 2.3 s while its colour drifts along the path at 3 cells a second, and it is taken down from the outside in over 0.9 s. The two squares are half a word apart. At 0.2 a word takes 90 s, at 3 six.
// Knob 3: Word. The top square's first word, to the nearest whole number: 0 TILE, 1 KILN, 2 FIRE, 3 SKY, 4 SEA, 5 SUN. The bottom square writes the next word in that list, and each square moves on two words every cycle.
// Knob 4: Cell. LEDs a cell, 2 or 3 (it rounds at 2.5). At 2 the square is 31 cells across: two rings of bands, 25 and 13 cells long, round nested squares 7 cells across, and a short word like SKY fits twice in the outer band. At 3 it is 21 cells across, one ring of 15-cell bands round nested squares 9 across, and the stretched letters are plain to see.

// Square Kufic sets a word on a grid in which every stroke and every gap
// is one brick wide, and in banna'i walls the letters are glazed bricks
// among plain ones. Round a square the text runs along the four sides,
// each side the one before turned a quarter, and ring after ring winds in
// until the square is full and reads as ornament first. Where a band is
// longer than its word the letters stretch along it, the way Kufic draws
// out its horizontal strokes.
//
// Here the bands are a pinwheel: the top band runs from the top left
// corner to one cell short of the right band, the right band from the
// top to one short of the bottom band, and so on round, each band 5 cells
// deep with a gap of one before the next ring. Each band holds as many
// copies of the word as fit, three cells apart, and the cells left over
// go to the letters' stretch columns in turn. The word's tops face the
// outside, so the top band reads left to right, the right band top to
// bottom and the bottom band upside down. A copy on the outer ring
// carries on, a quarter turn later, on the next ring in, so the reading
// path of each copy winds clockwise to the nested squares in the middle.
const W = 64, H = 128;
const { floor, min, max, round, sin, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Capitals 5 cells tall, every stroke and every gap one cell, rows from
// the top. Most are 3 wide, I is 1, M and W are 5.
const GL = {
  A: ["XXX", "X.X", "XXX", "X.X", "X.X"],
  B: ["XX.", "X.X", "XXX", "X.X", "XXX"],
  C: ["XXX", "X..", "X..", "X..", "XXX"],
  D: ["XX.", "X.X", "X.X", "X.X", "XX."],
  E: ["XXX", "X..", "XXX", "X..", "XXX"],
  F: ["XXX", "X..", "XXX", "X..", "X.."],
  G: ["XXX", "X..", "X.X", "X.X", "XXX"],
  H: ["X.X", "X.X", "XXX", "X.X", "X.X"],
  I: ["X", "X", "X", "X", "X"],
  J: ["..X", "..X", "..X", "X.X", "XXX"],
  K: ["X.X", "X.X", "XX.", "X.X", "X.X"],
  L: ["X..", "X..", "X..", "X..", "XXX"],
  M: ["XXXXX", "X.X.X", "X.X.X", "X.X.X", "X.X.X"],
  N: ["XXX", "X.X", "X.X", "X.X", "X.X"],
  O: ["XXX", "X.X", "X.X", "X.X", "XXX"],
  P: ["XXX", "X.X", "XXX", "X..", "X.."],
  Q: ["XXX", "X.X", "X.X", "XXX", "..X"],
  R: ["XXX", "X.X", "XX.", "X.X", "X.X"],
  S: ["XXX", "X..", "XXX", "..X", "XXX"],
  T: ["XXX", ".X.", ".X.", ".X.", ".X."],
  U: ["X.X", "X.X", "X.X", "X.X", "XXX"],
  V: ["X.X", "X.X", "X.X", "X.X", ".X."],
  W: ["X.X.X", "X.X.X", "X.X.X", "X.X.X", "XXXXX"],
  X: ["X.X", "X.X", ".X.", "X.X", "X.X"],
  Y: ["X.X", "X.X", "XXX", ".X.", ".X."],
  Z: ["XXX", "..X", ".X.", "X..", "XXX"],
};
// The columns a letter stretches by. T, M and W stretch two at once so
// they stay symmetric.
const STR = {
  A: [1], B: [1], C: [1], D: [1], E: [1], F: [1], G: [1], H: [1], J: [1], L: [2], M: [1, 3],
  N: [1], O: [1], P: [1], Q: [1], R: [1], S: [1], T: [0, 2], U: [1], W: [1, 3], Z: [1],
};
const WORDS = ["TILE", "KILN", "FIRE", "SKY", "SEA", "SUN"];
const BAND = 5, PITCH = 6, WG = 3; // band, band plus gap, gap between copies
const CY = 9; // one word's cycle, in seconds at Speed 2
// Where in the cycle laying ends, glazing starts and ends, clearing starts.
const LAY = 0.4, G0 = 0.42, G1 = 0.64, CLR = 0.9;
const OFF = [0.7, 0.2]; // the two squares' places in their cycles at the start
const HG = [0.47, 0.6]; // glaze hues at Hue 0, top and bottom

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, word: 0, cell: 2, t: 0, cache: {}, c: [0, 0, 0], col: [new Float32Array(31 * 31 * 3), new Float32Array(31 * 31 * 3)] };
}

function natural(word) {
  let w = word.length - 1;
  for (const ch of word) w += GL[ch][0].length;
  return w;
}

// A letter's columns as 5-bit masks, bit v for row v from the top.
function letterCols(ch, extra, out) {
  const g = GL[ch], st = STR[ch] || [];
  for (let c = 0; c < g[0].length; c++) {
    let m = 0;
    for (let v = 0; v < BAND; v++) if (g[v][c] === "X") m |= 1 << v;
    for (let r = st.includes(c) ? extra : 0; r >= 0; r--) out.push(m);
  }
}

// A band L cells long holds as many copies as fit, WG cells apart, and the
// rest is taken up the way square Kufic takes it up, by stretching
// letters along the band, one column a letter in turn.
function layout(word, L) {
  const nat = natural(word), k = max(1, floor((L + WG) / (nat + WG)));
  const ls = [];
  for (let c = 0; c < k; c++) for (const ch of word) ls.push({ ch, ex: 0 });
  let E = L - (k * nat + (k - 1) * WG);
  for (let go = true; E > 0 && go; ) {
    go = false;
    for (const l of ls) {
      const st = STR[l.ch];
      if (st && st.length <= E) {
        l.ex++;
        E -= st.length;
        go = true;
      }
    }
  }
  const cols = [];
  ls.forEach((l, i) => {
    if (i > 0) for (let g = i % word.length === 0 ? WG : 1; g > 0; g--) cols.push(0);
    letterCols(l.ch, l.ex, cols);
  });
  const pad = L - cols.length, a = floor(pad / 2);
  for (let i = 0; i < a; i++) cols.unshift(0);
  while (cols.length < L) cols.push(0);
  return cols;
}

// The n by n square for one word: each ring a pinwheel of four bands, the
// word along the top band read left to right with its letters' tops to
// the outside, the same band turned a quarter at a time for the other
// three sides. Every cell gets its place s along the reading path: the
// outer ring's band, then the next ring's, so each of the four copies
// winds clockwise inward, then nested squares in the middle.
function build(S, word, n) {
  const key = word + n;
  if (S.cache[key]) return S.cache[key];
  const N = n * n, lit = new Uint8Array(N), s = new Float32Array(N), tone = new Float32Array(N);
  const nat = natural(word);
  let o = 0, base = 0;
  for (; n - 2 * o - PITCH >= nat; o += PITCH) {
    const L = n - 2 * o - PITCH, cols = layout(word, L);
    for (let u = 0; u < L; u++)
      for (let v = 0; v < BAND; v++) {
        if (!((cols[u] >> v) & 1)) continue;
        let r = o + v, c = o + u;
        for (let q = 0; q < 4; q++) {
          lit[r * n + c] = 1;
          s[r * n + c] = base + u + v * 0.25;
          const t = r;
          r = c;
          c = n - 1 - t;
        }
      }
    base += L + 2;
  }
  const mc = n - 2 * o;
  for (let i = 0; mc - 4 * i >= 1; i++) {
    const a0 = o + 2 * i, a1 = o + mc - 1 - 2 * i;
    for (let r = a0; r <= a1; r++)
      for (let c = a0; c <= a1; c++)
        if (r === a0 || r === a1 || c === a0 || c === a1) {
          lit[r * n + c] = 1;
          s[r * n + c] = base + i * 2;
        }
  }
  // Each brick its own firing, a little lighter or darker.
  for (let i = 0; i < N; i++) {
    let h = Math.imul(i + 1, 2654435761) ^ (n * 40503);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    tone[i] = ((h >>> 8) & 255) / 255;
  }
  return (S.cache[key] = { n, lit, s, tone, len: base + 2 * floor((mc + 3) / 4) });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 2], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.word = cl(round(k[2] || 0), 0, WORDS.length - 1);
  S.cell = k[3] == null || k[3] < 2.5 ? 2 : 3;
  S.t += (d * S.speed) / 2;
  if (S.t > CY * 6000) S.t -= CY * 6000;
}

const smooth = (x) => {
  x = cl(x, 0, 1);
  return x * x * (3 - 2 * x);
};

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const cs = S.cell, n = cs === 2 ? 31 : 21, off = floor((W - n * cs) / 2), c = S.c, b = [0, 0, 0];
  for (let q = 0; q < 2; q++) {
    const p = S.t / CY + OFF[q], cyc = floor(p), f = p - cyc;
    const G = build(S, WORDS[(S.word + 2 * cyc + q) % WORDS.length], n), span = G.len + 3;
    const fl = (f / LAY) * span - 1.5, fg = ((f - G0) / (G1 - G0)) * span - 1.5, fc = ((f - CLR) / (1 - CLR)) * span - 1.5;
    const flow = S.t * 3, col = S.col[q];
    // One colour per cell.
    for (let i = 0; i < n * n; i++) {
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0;
      if (!G.lit[i]) continue;
      const s = G.s[i], age = fl - s;
      if (age < 0) continue;
      const tn = G.tone[i];
      // Unglazed brick, a little brighter as it is set down.
      hsv(0.075, 0.5, (0.62 + 0.14 * tn) * (1 + 0.45 * exp(-age / 1.2)), b);
      const gz = fg - s;
      if (gz > 0) {
        const m = smooth(gz / 2), sheen = 0.7 * exp(-gz / 2.5);
        hsv(S.hue + HG[q] + 0.04 * sin((2 * PI * (s - flow)) / 14) + 0.03 * (tn - 0.5), 0.82 - 0.5 * sheen, 0.8 + 0.18 * tn, c);
        for (let j = 0; j < 3; j++) b[j] = b[j] * (1 - m) + min(1, c[j] + sheen) * m;
      }
      const fade = 1 - smooth((fc - s) / 3);
      for (let j = 0; j < 3; j++) col[i * 3 + j] = b[j] * fade * 255;
    }
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < W; x++) {
        const lx = x - off, ly = y - off, cx = floor(lx / cs), cy = floor(ly / cs);
        if (lx < 0 || ly < 0 || cx >= n || cy >= n) {
          display.setPixel(x, q * 64 + y, 0, 0, 0);
          continue;
        }
        const i = (cy * n + cx) * 3, ax = lx - cx * cs, ay = ly - cy * cs;
        // Light from the top left: each brick's top and left edges a
        // little lighter, its bottom and right a little darker.
        const bv = 1 + 0.07 * ((ax === 0) + (ay === 0) - (ax === cs - 1) - (ay === cs - 1));
        display.setPixel(x, q * 64 + y, min(255, round(col[i] * bv)), min(255, round(col[i + 1] * bv)), min(255, round(col[i + 2] * bv)));
      }
  }
}
