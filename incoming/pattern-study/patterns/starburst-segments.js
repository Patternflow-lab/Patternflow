// ===== Patternflow pattern =====
// Title:   Starburst Segments
// Family:  type
// Idea:    A fourteen-segment display fills the panel, six rows of four characters, and after a lamp test that lights every segment at once it spells a word ladder, each step changing one letter in every row by flipping only the segments that differ, one after another in a ripple, so the bars show what the letters share.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 109, after the fourteen-segment alphanumeric display, with the segment table and the glyphs drawn for this pattern; the word ladder is Lewis Carroll's Doublets (1879)
// Round:   109
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Glow=-1..2, Morph=0..1
//
// Knob 1: Hue. Turns the colour of the lit segments round the wheel; at 0 they are the blue-green of a vacuum fluorescent display.
// Knob 2: Speed. How fast the display runs. At 2 the lamp test comes on at 1.0 s, holds until 2.35 s and drops out in a ripple that leaves the panel blank at about 3.2 s, the first window of six words is written from 3.75 s, and every 2.25 s after that the ladder climbs one word. 0.5 is four times slower and 4 is twice as fast.
// Knob 3: Glow. From crisp bars at -1, where only the lamp test still glows a little, to a bloom at 2 that fills the gaps between the segments and lights a halo round every lit bar. It opens at 0, where the lamp test floods the panel with light and a word has next to no halo.
// Knob 4: Morph. How a segment changes, from a hard flip at 0, where it opens, to a slow fade of about 0.4 s at 1, which lets the ripple read as a wave of light instead of a row of switches.

const W = 64, H = 128, NP = W * H;
const COLS = 4, ROWS = 6, NCH = COLS * ROWS, NSEG = 14;
const CW = 14, CH = 18; // one character: 14 LEDs wide and 18 tall
const PX = 16, PY = 21, X0 = 1, Y0 = 2; // pitch between characters and the corner of the first
const GHOST = 0.082; // an unlit segment under smoked glass: 21 of 255
const KICK = 0.3; // how long a segment that has come on stays white, in clock units
const { floor, min, max, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The fourteen segments, a to n: a top, b upper right, c lower right, d bottom,
// e lower left, f upper left, g middle left, h middle right, i upper left
// diagonal, j upper right diagonal, k upper centre, l lower centre, m lower
// left diagonal, n lower right diagonal. A character is the set of segments
// that are on, 14 bits, bit 0 for a.
const GLYPH_SRC = {
  A: "abcefgh", B: "abcdhkl", C: "adef", D: "abcdkl", E: "adefgh", F: "aefgh", G: "acdefh", H: "bcefgh",
  I: "adkl", J: "bcde", K: "efgjn", L: "def", M: "bcefij", N: "bcefin", O: "abcdef", P: "abefgh",
  Q: "abcdefn", R: "abefghn", S: "acdfgh", T: "akl", U: "bcdef", V: "efjm", W: "bcefmn", X: "ijmn",
  Y: "ijl", Z: "adjm",
  0: "abcdefjm", 1: "bcj", 2: "abdegh", 3: "abcdh", 4: "bcfgh", 5: "acdfgh", 6: "acdefgh", 7: "abc",
  8: "abcdefgh", 9: "abcdfgh",
  " ": "", "-": "gh", "+": "ghkl", "*": "ghijklmn", "/": "jm", "=": "dgh", "<": "jn", ">": "im", "?": "abhl",
};
const GLYPH = {};
for (const ch of Object.keys(GLYPH_SRC)) {
  let c = 0;
  for (const s of GLYPH_SRC[ch]) c |= 1 << (s.charCodeAt(0) - 97);
  GLYPH[ch] = c;
}
const ALL = (1 << NSEG) - 1;

// Twelve words, each one letter from the next, as a ladder the six rows read
// from the top. The letters are the ones that light the least of their cell.
const LADDER = "FIST LIST LIFT LILT HILT HILL FILL FILE FINE PINE PINT HINT".split(" ");

// A slanted bar between two points, as a four-point polygon.
function bar(p0, p1, t) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = hypot(dx, dy), nx = (dy / L) * (t / 2), ny = (-dx / L) * (t / 2);
  return [[p0[0] + nx, p0[1] + ny], [p1[0] + nx, p1[1] + ny], [p1[0] - nx, p1[1] - ny], [p0[0] - nx, p0[1] - ny]];
}
const mirX = (p) => p.map(([x, y]) => [CW - x, y]);
const mirY = (p) => p.map(([x, y]) => [x, CH - y]);

// The cell as 14 polygons, bars 2 LEDs thick with a gap of one between them,
// the corners joined at 45 degrees as on the glass of a real display.
function polygons() {
  const T = 2, d = 0.7;
  const a = [[d, 0], [CW - d, 0], [CW - T - d, T], [T + d, T]];
  const f = [[0, d], [T, T + d], [T, 8.5], [0, 8.5]];
  const e = mirY(f).reverse();
  const g = [[T + 0.6, 9], [T + 1.6, 8], [6.5, 8], [6.5, 10], [T + 1.6, 10]];
  const k = [[6, 3], [8, 3], [8, 7], [6, 7]];
  const i = bar([3.1, 3.3], [5.1, 7.3], 1.9);
  return [a, mirX(f), mirX(e), mirY(a), e, f, g, mirX(g), i, mirX(i), k, mirY(k), mirY(i), mirX(mirY(i))];
}
function inside(poly, x, y) {
  let pos = 0, neg = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (cr > 1e-9) pos++;
    else if (cr < -1e-9) neg++;
  }
  return pos === 0 || neg === 0;
}
// How much of each LED of the cell a polygon covers, by 4 by 4 samples.
function coverage(poly) {
  const cov = new Float32Array(CW * CH);
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      let n = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inside(poly, x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) n++;
      cov[y * CW + x] = n / 16;
    }
  return cov;
}

const wordCodes = (start) => {
  const c = new Int32Array(NCH);
  for (let r = 0; r < ROWS; r++) for (let k = 0; k < COLS; k++) c[r * COLS + k] = GLYPH[LADDER[start + r][k]];
  return c;
};

// The timeline, in clock units, 1 unit a second at Speed 2. Each key is a
// change of the whole display to a new set of codes, rippling from the top
// left: character n starts n * sc after the key's time, and its differing
// segments flip one after another, ss apart, in the order of their letters.
function plan() {
  const keys = [];
  const add = (t, to, sc, ss) => keys.push({ t, to, sc, ss });
  add(1.0, new Int32Array(NCH).fill(ALL), 0.01, 0);
  add(2.35, new Int32Array(NCH), 0.022, 0.026);
  add(3.75, wordCodes(0), 0.022, 0.03);
  const steps = LADDER.length - ROWS;
  for (let s = 1; s <= steps; s++) add(5.0 + (s - 1) * 2.25, wordCodes(s), 0.022, 0.03);
  return { keys, end: 5.0 + steps * 2.25, last: wordCodes(steps) };
}

export function setup(params) {
  const cov = polygons().map(coverage);
  const S = {
    hue: 0, speed: 2, glow: 0.33, morph: 0.06, tau: 0, cycle: 0,
    cov, off: [], wt: [],
    ghost: new Float32Array(NP), L: new Float32Array(NP), B1: new Float32Array(NP), B2: new Float32Array(NP), tmp: new Float32Array(NP),
    lvl: new Float32Array(NCH * NSEG), kick: new Float32Array(NCH * NSEG), K: new Float32Array(NP), start: new Int32Array(NCH), glyph: GLYPH,
  };
  Object.assign(S, plan());
  for (let s = 0; s < NSEG; s++) {
    const off = [], wt = [];
    for (let y = 0; y < CH; y++)
      for (let x = 0; x < CW; x++) if (cov[s][y * CW + x] >= 0.06) (off.push(y * W + x), wt.push(cov[s][y * CW + x]));
    S.off.push(Int32Array.from(off));
    S.wt.push(Float32Array.from(wt));
  }
  const base = (n) => (Y0 + PY * floor(n / COLS)) * W + X0 + PX * (n % COLS);
  S.base = Int32Array.from({ length: NCH }, (_, n) => base(n));
  for (let n = 0; n < NCH; n++)
    for (let s = 0; s < NSEG; s++) for (let j = 0; j < S.off[s].length; j++) S.ghost[S.base[n] + S.off[s][j]] = max(S.ghost[S.base[n] + S.off[s][j]], GHOST * S.wt[s][j]);
  params.s = S;
}

const pop = (x) => {
  let n = 0;
  while (x) {
    n += x & 1;
    x >>= 1;
  }
  return n;
};

// The level of every segment of every character at clock time tau.
function levels(S, tau) {
  const fade = 0.02 + S.morph * 0.4;
  let k = -1;
  while (k + 1 < S.keys.length && S.keys[k + 1].t <= tau) k++;
  for (let n = 0; n < NCH; n++) {
    const fr = k <= 0 ? S.start[n] : S.keys[k - 1].to[n];
    const to = k < 0 ? S.start[n] : S.keys[k].to[n];
    const diff = fr ^ to;
    for (let s = 0; s < NSEG; s++) {
      const bt = (to >> s) & 1;
      let v = bt, kick = 0;
      if (k >= 0 && (diff >> s) & 1) {
        const key = S.keys[k];
        const tf = key.t + n * key.sc + pop(diff & ((1 << s) - 1)) * key.ss;
        const u = (tau - tf) / fade;
        v = u <= 0 ? 1 - bt : u >= 1 ? bt : 1 - bt + (2 * bt - 1) * sm(u);
        // a segment that has just come on is white for a moment, so the
        // ones that changed stand out from the ones that stayed
        if (bt && u > 0) kick = cl(1 - (tau - tf) / KICK, 0, 1);
      }
      S.lvl[n * NSEG + s] = v;
      S.kick[n * NSEG + s] = kick;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 4);
  S.glow = cl((cl(k[2], -1, 2) + 1) / 3, 0, 1);
  S.morph = cl(k[3], 0, 1);
  S.tau += d * (S.speed / 2);
  if (S.tau > S.end) {
    S.cycle++;
    S.tau -= S.end;
    S.start.set(S.last);
  }
}

// A box blur of radius r along rows or columns with a running sum.
function boxH(src, dst, r) {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let s = 0;
    for (let x = 0; x <= r; x++) s += src[o + x];
    for (let x = 0; x < W; x++) {
      dst[o + x] = s * inv;
      if (x + r + 1 < W) s += src[o + x + r + 1];
      if (x - r >= 0) s -= src[o + x - r];
    }
  }
}
function boxV(src, dst, r) {
  const inv = 1 / (2 * r + 1);
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let y = 0; y <= r; y++) s += src[y * W + x];
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = s * inv;
      if (y + r + 1 < H) s += src[(y + r + 1) * W + x];
      if (y - r >= 0) s -= src[(y - r) * W + x];
    }
  }
}
// Two box blurs of each kind make a triangle: radius r on each side.
function blur(S, src, dst, r) {
  boxH(src, S.tmp, r);
  boxV(S.tmp, dst, r);
  boxH(dst, S.tmp, r);
  boxV(S.tmp, dst, r);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  levels(S, S.tau);
  const L = S.L, K = S.K;
  L.fill(0);
  K.fill(0);
  for (let n = 0; n < NCH; n++) {
    const b = S.base[n];
    for (let s = 0; s < NSEG; s++) {
      const v = S.lvl[n * NSEG + s];
      if (v < 0.003) continue;
      const kk = S.kick[n * NSEG + s], off = S.off[s], wt = S.wt[s];
      for (let j = 0; j < off.length; j++) {
        const val = v * wt[j];
        if (val > L[b + off[j]]) L[b + off[j]] = val;
        if (kk > 0 && kk * wt[j] > K[b + off[j]]) K[b + off[j]] = kk * wt[j];
      }
    }
  }
  let mean = 0;
  for (let p = 0; p < NP; p++) mean += L[p];
  mean /= NP;
  const g = S.glow;
  const aLoc = 0.9 * g * g, aBloom = (0.35 + 0.95 * g) * sm((mean - 0.22) / 0.2);
  if (aLoc > 0.01) blur(S, L, S.B1, 1);
  if (aBloom > 0.01) blur(S, L, S.B2, 6);
  const h0 = S.hue + 0.47, c = [0, 0, 0];
  const warm = h0 - floor(h0) > 0.02 && h0 - floor(h0) < 0.2;
  for (let p = 0; p < NP; p++) {
    // the haze never reaches the level of a lit bar, so the gaps stay dark
    let haze = 0;
    if (aLoc > 0.01) haze = aLoc * S.B1[p];
    if (aBloom > 0.01) haze = max(haze, aBloom * S.B2[p] * 1.6);
    const o = max(L[p], S.ghost[p], min(haze, 0.62));
    let sat = (0.95 - 0.3 * sm((o - 0.7) / 0.3)) * (1 - 0.9 * K[p]);
    if (warm) sat *= 0.6;
    hsv(h0, sat, o, c);
    display.setPixel(p & 63, p >> 6, c[0] * 255, c[1] * 255, c[2] * 255);
  }
}
