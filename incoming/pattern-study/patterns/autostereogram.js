// ===== Patternflow pattern =====
// Title:   Autostereogram
// Family:  type
// Idea:    A three-letter word stacked down the panel in capitals 42 LEDs wide and 38 tall is hidden in coloured random dots as a wall-eyed single-image stereogram, every LED copying the dot one period to its left except where a letter pulls that copy 2 LEDs nearer, so the dots look like nothing but noise until a band sweeps down and shows each LED against the LED one whole period to its left, dark where they agree and white where they differ, and the word appears letter by letter in that comparison, glows, fades, and a wipe of fresh dots brings the next word.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: random-dot stereogram (Béla Julesz, Bell System Technical Journal, 1960), single-image random-dot stereogram (Christopher Tyler and Maureen Clarke, made 1979, published at SPIE Stereoscopic Displays and Applications, 1990), after the wallpaper effect (David Brewster, 1844), pattern round 74
// Round:   74
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Depth=-3..3, Period=11..15, Reveal=0..1
//
// Knob 1: Hue. Turns the four dot colours round the wheel together over a ground that stays deep indigo. At 0 they are teal, azure, violet and pale gold; at 0.5 rose, amber, lime and blue. The comparison stays warm white.
// Knob 2: Depth. How many LEDs nearer than the period a letter's dots copy, rounded: at 2 (the opening) the word floats in front of the dots for a wall-eyed viewer, at -3 it sinks 3 LEDs behind them, and at 0 the dots are a plain wallpaper with nothing hidden, so the sweep finds no word.
// Knob 3: Period. The wallpaper's repeat, 11 to 15 LEDs: 5.8 repeats across the 64 LEDs at 11, 4.3 at 15. A wider period needs the eyes to diverge further and widens the random strip down the left edge.
// Knob 4: Reveal. Up to 0.1 (the opening 0.06) the comparison shows only in the band, 24 rows tall, that sweeps down at 40 rows a second, 3.8 s a sweep, once for each word; between sweeps the dots carry no trace of the word. Above 0.1 the comparison also shows over the whole panel at that strength: at 0.55 the dots are half dimmed and the word stands half white all the time, at 1 the dots are gone and only the comparison is left.

// A random-dot stereogram hides a shape in dots that carry no outline at
// all: the shape exists only as a shift between what the left eye and the
// right eye see. Julesz made them as pairs; Tyler and Clarke put both views
// in one picture. Each row starts with a strip of random dots one period
// wide, and every later LED copies the LED one separation to its left. Where
// the depth map is flat the separation is the period P and the row repeats
// exactly. Inside a letter it is P - D, so for eyes diverged by P the dots
// of the letter pair up at a different disparity and the letter stands out
// D LEDs nearer (D > 0) or further (D < 0).
//
// The comparison is the reveal: an LED that copied from P to its left
// always equals the LED P to its left, and inside a letter it copied from
// P - D, so it differs from the LED at P whenever the two dots were drawn
// differently, 70% of the time here. Matching LEDs go dark, differing ones
// light, and the letter appears without any free-viewing.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);

// Letter boxes: 42 x 38 LEDs from x = 19, three of them at rows 2, 45 and
// 88. The box starts right of the widest separation (15 + 3), so a letter
// never needs a dot left of the panel.
const BX = 19, BW = 42, BH = 38, TOPS = [2, 45, 88];
// Timing in seconds: the wipe of new dots, the quiet before the sweep, the
// sweep's speed in rows a second, the quiet after, and the glow's decay.
const WIPE = 0.5, PRE = 1.5, V = 40, POST = 2.0, TAU = 0.9, BAND = 24;
const LIT = 0.52; // share of dots that take one of the four colours
const SHADE = 0.025, SH2 = (2 * SHADE) / 255;

// A bold 7 x 7 capital for each letter, drawn for this pattern. Each cell
// is 6 x 5.43 LEDs; sampling the cells bilinearly and cutting at one half
// rounds the corners and turns the stairs of A, S and Y into slopes.
const FONT = {
  A: ["..###..", ".##.##.", "##...##", "##...##", "#######", "##...##", "##...##"],
  D: ["#####..", "##..##.", "##...##", "##...##", "##...##", "##..##.", "#####.."],
  E: ["#######", "##.....", "##.....", "######.", "##.....", "##.....", "#######"],
  F: ["#######", "##.....", "##.....", "######.", "##.....", "##.....", "##....."],
  H: ["##...##", "##...##", "##...##", "#######", "##...##", "##...##", "##...##"],
  I: [".#####.", "..###..", "..###..", "..###..", "..###..", "..###..", ".#####."],
  O: [".#####.", "##...##", "##...##", "##...##", "##...##", "##...##", ".#####."],
  R: ["######.", "##...##", "##...##", "######.", "##.##..", "##..##.", "##...##"],
  S: [".#####.", "##...##", "##.....", ".#####.", ".....##", "##...##", ".#####."],
  T: ["#######", "#######", "..###..", "..###..", "..###..", "..###..", "..###.."],
  Y: ["##...##", "##...##", ".##.##.", "..###..", "..###..", "..###..", "..###.."],
};
const WORDS = ["SEE", "EYE", "AHA", "DOT", "HID", "FAR", "ODD", "TOE"];

function cell(g, i, j) {
  return i < 0 || j < 0 || i > 6 || j > 6 ? 0 : g[j][i] === "#" ? 1 : 0;
}

// The depth map of one word: 1 inside a letter, 0 elsewhere.
function wordMask(word) {
  const m = new Uint8Array(W * H), cw = BW / 7, ch = BH / 7;
  for (let n = 0; n < 3; n++) {
    const g = FONT[word[n]], top = TOPS[n];
    for (let y = top; y < top + BH; y++)
      for (let x = BX; x < BX + BW; x++) {
        const u = (x - BX + 0.5) / cw - 0.5, v = (y - top + 0.5) / ch - 0.5;
        const i = floor(u), j = floor(v), fu = u - i, fv = v - j;
        const a = cell(g, i, j) * (1 - fu) + cell(g, i + 1, j) * fu;
        const b = cell(g, i, j + 1) * (1 - fu) + cell(g, i + 1, j + 1) * fu;
        if (a * (1 - fv) + b * fv > 0.5) m[y * W + x] = 1;
      }
  }
  return m;
}

function hsv(h, s, v, out, o) {
  h = frac(h) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// New random dots for a row: the dot each LED would take if it had nothing
// to copy, and a shade for each LED's three channels. The shade is the
// LED's own and is never copied. At 2.5% either way the eye cannot tell
// it and the dots still fuse, but no copy is then the same three bytes as
// its source. Without it a compressor finds every repeat and the study's
// complexity reads 0.46 bytes an LED for a field that looks like noise;
// with it, 1.78.
function roll(S, y) {
  const o = y * W;
  for (let x = 0; x < W; x++) {
    S.R[o + x] = Math.random() < LIT ? 1 + floor(Math.random() * 4) : 0;
    for (let c = 0; c < 3; c++) S.sh[(o + x) * 3 + c] = floor(Math.random() * 256);
  }
}

// One row of the stereogram, left to right.
function build(S, y) {
  const o = y * W, P = S.P, D = S.D, m = S.masks[S.rowWord[y]], R = S.R, I = S.idx;
  for (let x = 0; x < W; x++) {
    const sep = P - D * m[o + x];
    I[o + x] = x < sep ? R[o + x] : I[o + x - sep];
  }
}

export function setup(params) {
  const S = (params.s = {
    P: 11, D: 2, hue: 0, floor: 0, word: 0, ct: 0, wiped: H,
    R: new Uint8Array(W * H), sh: new Uint8Array(W * H * 3), idx: new Uint8Array(W * H),
    glow: new Float32Array(W * H), cover: new Float32Array(H), rowWord: new Uint8Array(H),
    masks: WORDS.map(wordMask), pal: new Float32Array(15),
  });
  for (let y = 0; y < H; y++) roll(S, y), build(S, y);
  return S;
}

const CYCLE = PRE + (H + BAND) / V + POST;

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 11, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const D = round(cl(k[1] == null ? 2 : k[1], -3, 3)), P = round(cl(k[2] || 11, 11, 15));
  S.floor = cl(((k[3] == null ? 0.06 : k[3]) - 0.1) / 0.9, 0, 1);
  if (D !== S.D || P !== S.P) {
    S.D = D;
    S.P = P;
    for (let y = 0; y < H; y++) build(S, y);
  }
  S.ct += d;
  if (S.ct >= CYCLE) {
    S.ct = 0;
    S.word = (S.word + 1) % WORDS.length;
    S.wiped = 0;
  }
  // The wipe: rows take new dots and the new word as its front passes.
  const front = min(H, floor((S.ct / WIPE) * H));
  while (S.wiped < front) {
    const y = S.wiped++;
    S.rowWord[y] = S.word;
    roll(S, y);
    build(S, y);
  }
  // The band: each row's share of comparison, with a 3-row soft edge, and
  // never less than the Reveal floor.
  const yb = -BAND / 2 + (S.ct - PRE) * V, half = BAND / 2, on = S.ct > PRE;
  const fall = exp(-d / TAU), I = S.idx, G = S.glow;
  for (let y = 0; y < H; y++) {
    const c = max(S.floor, on ? cl((half - abs(y + 0.5 - yb)) / 3, 0, 1) : 0);
    S.cover[y] = c;
    const o = y * W;
    for (let x = 0; x < W; x++) {
      let g = G[o + x] * fall;
      if (c > 0 && x >= S.P && I[o + x] !== I[o + x - S.P] && c > g) g = c;
      G[o + x] = g;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  // The ground and the four dot colours, levels 0..255.
  const pal = S.pal, h = S.hue;
  hsv(0.7, 0.85, 0.2, pal, 0);
  hsv(0.47 + h, 0.9, 0.62, pal, 3);
  hsv(0.58 + h, 0.8, 0.66, pal, 6);
  hsv(0.77 + h, 0.65, 0.62, pal, 9);
  hsv(0.13 + h, 0.5, 0.66, pal, 12);
  const I = S.idx, G = S.glow, sh = S.sh;
  for (let y = 0; y < H; y++) {
    const dim = 1 - 0.9 * S.cover[y], o = y * W;
    for (let x = 0; x < W; x++) {
      const i = o + x, p = I[i] * 3, g = G[i], j = i * 3;
      // Each channel within 2.5% either side of the dot's colour.
      let r = pal[p] * (1 - SHADE + sh[j] * SH2) * 255 * dim;
      let gg = pal[p + 1] * (1 - SHADE + sh[j + 1] * SH2) * 255 * dim;
      let b = pal[p + 2] * (1 - SHADE + sh[j + 2] * SH2) * 255 * dim;
      r += g * 255;
      gg += g * 236;
      b += g * 200;
      display.setPixel(x, y, round(cl(r, 0, 255)), round(cl(gg, 0, 255)), round(cl(b, 0, 255)));
    }
  }
}
