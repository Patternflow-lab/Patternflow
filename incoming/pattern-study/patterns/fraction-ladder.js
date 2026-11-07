// ===== Patternflow pattern =====
// Title:   Fraction Ladder
// Family:  type
// Idea:    A continued fraction is typeset down the tall panel the way a textbook sets it, each rung a numeral, a plus sign and a bar over the next rung, written one rung at a time as Euclid's algorithm splits off the integer part and flips the remainder, while the convergent so far stands below as an exact fraction with its error, and when the next quotient is huge, as 292 is for pi, the bar over it thickens and glows and the fraction 355/113 above it turns gold.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: continued fractions (Rafael Bombelli, 1572; Pietro Cataldi, 1613), the convergents as best approximations, 355/113 for pi (Zu Chongzhi, about 480), Euclid's algorithm, pattern round 106
// Round:   106
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Depth=5..9, Constant=0..7
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the numerals run from cyan at the top of the ladder to blue-violet at the foot, the bars are blue, the plus signs purple, and the decimals of the convergent that agree with the true value are green. The gold of a huge quotient and the red of the first wrong decimal stay as they are.
// Knob 2: Speed. How fast the ladder writes itself. At 2 a rung takes 0.8 s to write, then the convergent stays 1.2 s plus 0.9 s for each decade of the next quotient: pi is on 355/113 for 4.2 s, a ladder of five rungs is written in 15.5 s and starts over after 16.7 s, and the first frame is already 5 s into the story. 0.2 is ten times slower, 3 half as fast again.
// Knob 3: Depth. The number of rungs on the ladder, a_0 to a_(n-1), from 5 to 9. The rungs are 13 LEDs apart at 5, 11 at 6, 9 at 7 and 8 from 8 on, and the numerals stand 9, 7 and 5 LEDs tall. The pi ladder is wider than the panel from 8 rungs on, and then the view follows the rung being written, so the first numerals slide off the left edge.
// Knob 4: Constant. Snaps to one of eight numbers: 0 pi, 1 e, 2 the square root of 2, 3 the golden ratio, 4 the square root of 3, 5 tan 1, 6 Euler's constant gamma, 7 a random real between 0 and 8 with 49 bits after the point, new each time the ladder starts over, whose quotients the pattern finds by Euclid's algorithm on whole numbers.

const W = 64, H = 128, N = W * H;
const { min, max, floor, round, abs, sin, log10 } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The first 40 partial quotients of each constant, from exact integer
// arithmetic on the constant to 700 digits (checked against 500 and 900).
const TABLE = [
  [3, 7, 15, 1, 292, 1, 1, 1, 2, 1, 3, 1, 14, 2, 1, 1, 2, 2, 2, 2, 1, 84, 2, 1, 1, 15, 3, 13, 1, 4, 2, 6, 6, 99, 1, 2, 2, 6, 3, 5],
  [2, 1, 2, 1, 1, 4, 1, 1, 6, 1, 1, 8, 1, 1, 10, 1, 1, 12, 1, 1, 14, 1, 1, 16, 1, 1, 18, 1, 1, 20, 1, 1, 22, 1, 1, 24, 1, 1, 26, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1],
  [1, 1, 1, 3, 1, 5, 1, 7, 1, 9, 1, 11, 1, 13, 1, 15, 1, 17, 1, 19, 1, 21, 1, 23, 1, 25, 1, 27, 1, 29, 1, 31, 1, 33, 1, 35, 1, 37, 1, 39],
  [0, 1, 1, 2, 1, 2, 1, 4, 3, 13, 5, 1, 1, 8, 1, 2, 4, 1, 1, 40, 1, 11, 3, 7, 1, 7, 1, 1, 5, 1, 49, 4, 1, 65, 1, 4, 7, 11, 1, 399],
];
// The decimals of each, to 16 places, from the same computation.
const DEC = [
  "3.1415926535897932", "2.7182818284590452", "1.4142135623730950", "1.6180339887498948",
  "1.7320508075688772", "1.5574077246549022", "0.5772156649015328",
];
const RANDOM = 7;
// The rows of the 3 by 5 face to draw for a taller numeral. The first row holds
// the top stroke and the last the foot, and the rows that repeat are the ones
// that hold only stems. A 1 and a 7 repeat the stem at the bottom.
const STRETCH = { 5: [0, 1, 2, 3, 4], 7: [0, 1, 1, 2, 3, 3, 4], 9: [0, 1, 1, 1, 2, 3, 3, 3, 4] };
const STRETCH_STEM = { 7: [0, 1, 2, 3, 3, 3, 4], 9: [0, 1, 2, 3, 3, 3, 3, 3, 4] };

// A 3 by 5 face of my own. A 1 is two wide, so the rungs of a ladder of ones
// stay close.
const FACE = {
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#", "##", ".#", ".#", ".#"],
  "2": ["###", "..#", "###", "#..", "###"],
  "3": ["###", "..#", "###", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "###", "..#", "###"],
  "6": ["###", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", ".#.", ".#.", ".#."],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "###"],
  ".": [".", ".", ".", ".", "#"],
  "+": ["...", ".#.", "###", ".#.", "..."],
  "-": ["...", "...", "###", "...", "..."],
  "/": ["..#", "..#", ".#.", "#..", "#.."],
  "=": ["...", "###", "...", "###", "..."],
  "~": ["....", ".#.#", "#.#.", "....", "...."],
  e: ["...", ".##", "###", "#..", ".##"],
  t: [".#.", "###", ".#.", ".#.", "..#"],
  a: ["...", "##.", ".##", "#.#", ".##"],
  n: ["...", "##.", "#.#", "#.#", "#.#"],
  "…": [".....", ".....", ".....", ".....", "#.#.#"],
  // Names: pi, a check mark for the root, phi, gamma, and a question mark.
  p: ["#####", ".#.#.", ".#.#.", ".#.#.", ".#..#"],
  r: ["..#", "..#", "..#", "#.#", ".#."],
  f: [".#.", "###", "#.#", "###", ".#."],
  g: ["#.#", "#.#", "#.#", ".##", "#.."],
  "?": ["###", "..#", ".##", "...", ".#."],
};
// What is written in front of each constant's decimals.
const NAMES = ["p=", "e=", "r2=", "f=", "r3=", "tan1=", "g=", "?="];
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].map((row) => [...row].map((c) => (c === "#" ? 1 : 0)));
const gw = (ch) => (GLYPH[ch] ? GLYPH[ch][0].length : 3);
// The width of a string at a scale, LEDs, with one LED of space (scaled) between glyphs.
const tw = (s, sc) => {
  let w = 0;
  for (const ch of s) w += (gw(ch) + 1) * sc;
  return max(0, w - sc);
};

// The layout. The ladder takes rows 0 to 82, the working below it rows 84 to 126.
const YB = 84, XR = 62;
const OFF = 5; // seconds of the story already told on the first frame
const TR = 0.8; // seconds to write a rung, at Speed 2
const FADE = 0.9;
// How special a quotient a is: 0 for anything below 10, 1 at 292 and over.
const special = (a) => sm((log10(max(1, a)) - 1) / 1.4);
const thick = (a) => (a >= 100 ? 3 : a >= 4 ? 2 : 1);

export function setup(params) {
  params.s = {
    R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N),
    hue: 0, speed: 2, D: 0, c: -1, first: true,
    tc: OFF, sx: 0,
  };
}

// The constant's quotients (and, for the random real, its decimals), one
// ladder's worth of numbers: convergents, errors and the digit strings.
function build(S) {
  let q, dec;
  if (S.c === RANDOM) {
    // A random 49-bit real, m / 2^49, and its continued fraction by Euclid's
    // algorithm on m and 2^49. Both stay under 2^53, so every step is exact.
    for (;;) {
      const m = floor(Math.random() * 4503599627370496) + 1; // 1 .. 2^52
      let a = m, b = 562949953421312;
      q = [];
      while (b > 0) {
        const r = a % b;
        q.push((a - r) / b);
        a = b;
        b = r;
      }
      if (q.length > 12) {
        // m / 2^49 by long division, 16 places.
        let r = m % 562949953421312;
        dec = String((m - r) / 562949953421312) + ".";
        for (let i = 0; i < 16; i++) {
          r *= 10;
          const d = floor(r / 562949953421312);
          dec += d;
          r -= d * 562949953421312;
        }
        break;
      }
    }
  } else {
    q = TABLE[S.c];
    dec = DEC[S.c];
  }
  S.q = q;
  S.dec = dec;
  const D = S.D, n = q.length;
  // Convergents p_k / q_k by the recurrence, in whole numbers.
  const P = [], Q = [];
  for (let k = 0; k < D + 1; k++) {
    P.push(k === 0 ? q[0] : k === 1 ? q[1] * q[0] + 1 : q[k] * P[k - 1] + P[k - 2]);
    Q.push(k === 0 ? 1 : k === 1 ? q[1] : q[k] * Q[k - 1] + Q[k - 2]);
  }
  // The complete quotients x_k = a_k + 1 / x_(k+1), worked back from the end.
  const x = new Array(n);
  x[n - 1] = q[n - 1];
  for (let k = n - 2; k >= 0; k--) x[k] = q[k] + 1 / x[k + 1];
  S.P = P;
  S.Q = Q;
  S.x = x;
  // The error of convergent k: x - p/q = (-1)^k / (q_k (x_(k+1) q_k + q_(k-1))).
  S.err = [];
  S.sign = [];
  S.errStr = [];
  S.cdec = [];
  S.fr = [];
  for (let k = 0; k < D; k++) {
    const e = 1 / (Q[k] * (x[k + 1] * Q[k] + (k > 0 ? Q[k - 1] : 0)));
    S.err.push(e);
    S.sign.push(k % 2 === 0 ? "-" : "+");
    let ex = Math.floor(log10(e)), m = round((e / 10 ** ex) * 10) / 10;
    if (m >= 10) {
      m = 1;
      ex++;
    }
    S.errStr.push((k % 2 === 0 ? "-" : "+") + m.toFixed(1) + "e" + ex);
    // p / q to 16 places by long division.
    let r = P[k] % Q[k], s = String((P[k] - r) / Q[k]) + ".";
    for (let i = 0; i < 16; i++) {
      r *= 10;
      const d = floor(r / Q[k]);
      s += d;
      r -= d * Q[k];
    }
    S.cdec.push(s);
  }
  // The fractional part of each complete quotient, 4 places, floor.
  for (let k = 1; k <= D; k++) {
    const f = 1 / x[k + 1];
    S.fr.push(String(floor(f * 1e4)).padStart(4, "0"));
  }
  // Where each rung sits. A rung is "a +" and then the bar over the next one.
  S.X = [1];
  for (let k = 0; k < D; k++) S.X.push(S.X[k] + tw(String(q[k]), 1) + 1 + 3 + 1);
  S.pitch = cl(floor(66 / D), 8, 14);
  // The timeline of one telling, in seconds at Speed 2.
  S.start = [];
  let t = 0;
  for (let k = 0; k < D; k++) {
    S.start.push(t);
    t += TR + 1.2 + 0.9 * log10(max(1, q[k + 1])) + (k === D - 1 ? 1.5 : 0);
  }
  S.fadeAt = t;
  S.total = t + FADE + 0.3;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 5, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  const D = cl(round(k[2]), 5, 9), c = cl(round(k[3]), 0, 7);
  if (D !== S.D || c !== S.c) {
    // A new constant or depth starts its telling at the top, except the very
    // first, which has already been going for OFF seconds.
    const first = S.first;
    S.D = D;
    S.c = c;
    build(S);
    S.tc = first ? OFF : 0;
    S.first = false;
  }
  S.tc += d * (S.speed / 2);
  if (S.tc >= S.total) {
    S.tc -= S.total;
    if (S.c === RANDOM) build(S);
  }
  const tc = S.tc;
  let j = 0;
  for (let i = 0; i < S.D; i++) if (S.start[i] <= tc) j = i;
  S.j = j;
  S.u = cl((tc - S.start[j]) / TR, 0, 1);
  S.since = tc - S.start[j];
  S.fade = tc > S.fadeAt ? cl((tc - S.fadeAt) / FADE, 0, 1) : 0;
  // The view follows the rung being written: the right-hand end of its tail
  // has to stay on the panel, and the left edge gives way.
  const tx = S.X[min(j + 1, S.D)] + tw(String(S.q[min(j + 1, S.D)]), 1) + 10;
  S.sx += (max(0, tx - XR) - S.sx) * min(1, d * 4);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.q) return;
  const { R, G, B, q, D, j, u, pitch, X } = S;
  const h0 = S.hue + 0.5, sx = round(S.sx), fade = S.fade, lit = 1 - fade;
  // How tall the numerals stand: the 3 by 5 face stretched by repeating the
  // rows that hold only stems, so the strokes keep their weight. The first bar
  // is low enough for its 1 to fit above it.
  const hN = pitch >= 13 ? 9 : pitch >= 11 ? 7 : 5;
  const cy = (k) => hN + 3 + pitch * k;
  const gold = [1, 0.74, 0.22], c = [0, 0, 0];
  // A faint ground, deeper at the top.
  for (let y = 0; y < H; y++) {
    hsv(h0 + 0.12, 0.85, 0.05 + 0.04 * (1 - y / H), c);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      R[p] = c[0];
      G[p] = c[1];
      B[p] = c[2];
    }
  }
  const put = (x, y, r, g, b, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const p = y * W + x;
    R[p] += (r - R[p]) * a;
    G[p] += (g - G[p]) * a;
    B[p] += (b - B[p]) * a;
  };
  // One glyph at (x, y), sc times as big, hgt rows tall at scale 1.
  const glyph = (ch, x, y, sc, col, a, hgt) => {
    const g = GLYPH[ch];
    if (!g || a <= 0) return;
    const rows = hgt && hgt > 5 ? (ch === "1" || ch === "7" ? STRETCH_STEM[hgt] : STRETCH[hgt]) : STRETCH[5];
    for (let r = 0; r < rows.length; r++)
      for (let cc = 0; cc < g[0].length; cc++) {
        if (!g[rows[r]][cc]) continue;
        for (let v = 0; v < sc; v++)
          for (let w = 0; w < sc; w++) put(x + cc * sc + w, y + r * sc + v, col[0], col[1], col[2], a);
      }
  };
  // A string, glyph i in the colour pick(i), up to `limit` glyphs. Returns where it ended.
  const text = (s, x, y, sc, pick, a, limit, hgt) => {
    let i = 0;
    for (const ch of s) {
      if (limit !== undefined && i >= limit) break;
      glyph(ch, x, y, sc, pick(i), a, hgt);
      x += (gw(ch) + 1) * sc;
      i++;
    }
    return x;
  };
  const colour = (h, s, v) => {
    hsv(h, s, v, c);
    return [c[0], c[1], c[2]];
  };
  const GV = 0.26; // how bright a rung still to come is
  const hue = (k) => h0 + 0.035 * k;
  // The name of the constant, large and dim, in the corner the staircase leaves empty.
  {
    const nm = NAMES[S.c].replace("=", ""), sc = cl(floor(27 / tw(nm, 1)), 2, 4), ww = tw(nm, sc);
    const wy = cy(D) + 3 - 5 * sc;
    text(nm, 2, wy, sc, (i) => colour(h0 + 0.3 + 0.06 * i, 0.5, 0.3), 1);
    const wc = colour(h0 + 0.3, 0.5, 0.3);
    if (nm[0] === "r") for (let x = 2 + 2 * sc; x < ww + 2; x++) put(x, wy - 1, wc[0], wc[1], wc[2], 1);
  }
  // ----- the bars, so that numerals sit over them -----
  for (let k = 0; k < D; k++) {
    const a = q[k + 1], sp = special(a), t = thick(a), y = cy(k);
    const x0 = X[k + 1] - sx;
    if (x0 > XR) continue;
    // The tail's decimals stand where the bar will be, so the bar waits.
    const waits = k === j + 1;
    const written = k < j ? 1 : k === j ? (j === 0 ? sm((S.since / TR - 0.2) / 0.5) : sm((u - 0.35) / 0.45)) : 0;
    const wipe = written * lit;
    const top = y - floor((t - 1) / 2), bot = y + floor(t / 2);
    // The gold glow of a big quotient, soft at both ends.
    if (waits) {
      // Nothing yet.
    } else if (sp > 0) {
      const pulse = 0.8 + 0.2 * sin(S.tc * 3 + k);
      for (let x = max(0, x0 - 4); x <= XR; x++) {
        const e = sm((x - x0 + 4) / 8) * sm((XR + 4 - x) / 8);
        for (let dy = 1; dy <= 4; dy++) {
          const a2 = (1 - (dy - 1) / 4) * 0.34 * sp * pulse * e * (0.3 + 0.7 * wipe);
          put(x, top - dy, gold[0], gold[1], gold[2], a2);
          put(x, bot + dy, gold[0], gold[1], gold[2], a2);
        }
      }
    }
    const ghost = colour(hue(k) + 0.08, 0.7, GV);
    const body = sp > 0.2 ? [gold[0], gold[1] * 0.95, gold[2] * 0.7] : colour(hue(k) + 0.08, 0.75, 0.6 + 0.25 * min(1, a / 10));
    const reach = x0 + (XR - x0) * written;
    for (let yy = top; yy <= bot && !waits; yy++)
      for (let x = max(0, x0); x <= XR; x++) {
        put(x, yy, ghost[0], ghost[1], ghost[2], 1);
        if (x <= reach) {
          const w = sp > 0.2 ? sp : 0;
          put(x, yy, body[0], body[1], body[2], lit);
          if (w > 0) put(x, yy, 1, 0.97, 0.8, 0.5 * w * lit * (yy === y ? 1 : 0));
          if (written < 1 && x > reach - 3) put(x, yy, 1, 1, 1, 0.8 * lit);
        }
      }
    // The 1 over the bar, at its left end.
    const nA = k < j ? 1 : k === j ? (j === 0 ? sm((S.since / TR - 0.15) / 0.2) : sm((u - 0.35) / 0.2)) : 0;
    const nTop = top - 1 - hN;
    if (waits) continue;
    glyph("1", x0 + 1, nTop, 1, colour(hue(k) + 0.08, 0.3, 1), GV * 1.2, hN);
    glyph("1", x0 + 1, nTop, 1, colour(hue(k) + 0.08, 0.3, 1), nA * lit, hN);
  }
  // ----- the rungs: a numeral and a plus, then after the last written one the tail -----
  const dimC = (k) => colour(hue(k) + 0.3, 0.4, 0.68);
  for (let k = 0; k <= D; k++) {
    const x = X[k] - sx, str = String(q[k]), w = tw(str, 1), yT = cy(k) - floor(hN / 2), yP = cy(k) - 2;
    if (x > XR + 1 || x + w + 12 < 0) continue;
    if (k <= j) {
      // Written. A numeral written this step goes in white and settles.
      const flash = k === j ? 1 - sm(S.since / 0.7) : 0;
      const ink = colour(hue(k), 0.25, 1);
      for (let i = 0; i < 3; i++) ink[i] += (1 - ink[i]) * flash * 0.9;
      const ghost = colour(hue(k), 0.45, GV);
      text(str, x, yT, 1, () => ghost, 1, undefined, hN);
      text(str, x, yT, 1, () => ink, lit, undefined, hN);
      if (k < D) {
        const pa = k === j ? (j === 0 ? sm((S.since / TR - 0.1) / 0.2) : sm((u - 0.25) / 0.2)) : 1;
        glyph("+", x + w + 1, yP, 1, colour(hue(k) + 0.2, 0.55, GV), 1);
        glyph("+", x + w + 1, yP, 1, colour(hue(k) + 0.2, 0.55, 0.9), pa * lit);
      }
      // The decimals the tail had, going as the rung is written.
      if (k === j && k > 0 && u < 0.4) {
        const n = cl(floor((XR - x - w - 8) / 4), 1, 4), da = (1 - sm(u / 0.35)) * lit, dc = dimC(k);
        const xd = text(".", x + w + 1, yP, 1, () => dc, da);
        text(S.fr[k - 1].slice(0, n), xd + 1, yP, 1, () => dc, da);
      }
    } else if (k === j + 1) {
      // The tail: the number still to be split. Its integer part will be the
      // numeral and its remainder will be flipped into the next rung.
      const typed = j === 0 ? sm((S.since / TR - 0.4) / 0.5) : sm((u - 0.5) / 0.5);
      const n = cl(floor((XR - x - w - 8) / 4), 0, 4), xe = x + w;
      const len = str.length + (n > 0 ? 1 + n : 0) + 1, shown = floor(typed * len + 0.001);
      const ink = colour(hue(k), 0.25, 0.9), dc = dimC(k);
      if (shown >= 1) text(str, x, yT, 1, () => ink, lit, shown, hN);
      if (n > 0 && shown > str.length) {
        const xd = text(".", xe + 1, yP, 1, () => dc, lit);
        text(S.fr[k - 1].slice(0, n), xd + 1, yP, 1, () => dc, lit, shown - str.length - 1);
      }
      if (shown >= len) text("…", xe + 1 + (n > 0 ? 2 + n * 4 : 0), yP, 1, () => dc, lit);
    } else if (k < D) {
      // A rung to come, as dim as the panel can show.
      const gc = colour(hue(k), 0.45, GV);
      text(str, x, yT, 1, () => gc, 1, undefined, hN);
      glyph("+", x + w + 1, yP, 1, gc, 1);
    } else {
      const gc = colour(hue(k), 0.45, GV);
      text("…", x, yP, 1, () => gc, 1);
    }
  }
  // ----- the working: the convergent so far -----
  const spJ = special(q[j + 1]);
  const gl = cl(1 - S.since / 0.9, 0, 1);
  const pulse = 0.85 + 0.15 * sin(S.tc * 4);
  // White as it is written, gold when the next quotient is big.
  const ink = (flash, sp) => {
    const o = colour(h0, 0.2, 1);
    for (let i = 0; i < 3; i++) o[i] += (gold[i] * pulse - o[i]) * sp;
    for (let i = 0; i < 3; i++) o[i] += (1 - o[i]) * flash * 0.9;
    return o;
  };
  const fc = ink(gl, spJ);
  const pS = String(S.P[j]), qS = String(S.Q[j]);
  const wN = tw(pS, 2), wD = tw(qS, 2), wM = max(wN, wD) + 4, cx = 32;
  if (spJ > 0)
    for (let y = YB - 3; y < YB + 27; y++)
      for (let x = cx - wM / 2 - 5; x < cx + wM / 2 + 5; x++) {
        const dx = max(0, abs(x - cx) - wM / 2), dy = max(0, abs(y - (YB + 11)) - 12), dd = Math.hypot(dx, dy);
        put(floor(x), y, gold[0], gold[1], gold[2], max(0, 1 - dd / 5) * 0.2 * spJ * pulse * lit);
      }
  text(pS, round(cx - wN / 2), YB, 2, () => fc, lit);
  for (let x = 0; x < wM; x++) {
    put(round(cx - wM / 2) + x, YB + 11, fc[0], fc[1], fc[2], lit);
    put(round(cx - wM / 2) + x, YB + 12, fc[0], fc[1], fc[2], lit * 0.6);
  }
  text(qS, round(cx - wD / 2), YB + 14, 2, () => fc, lit);
  // The true decimals and the convergent's, the agreeing ones green and the
  // first that does not red.
  const X0 = 21, yA = YB + 26, yB2 = YB + 32, yE = YB + 39;
  const nameCol = colour(h0 + 0.3, 0.4, 0.75);
  let xn = 1;
  for (const ch of NAMES[S.c]) {
    glyph(ch, xn, yA, 1, nameCol, lit);
    xn += gw(ch) + 1;
    // The bar over the radicand, which is the digit after the check mark.
    if (ch === "r") for (let x = xn - 2; x < xn + 3; x++) put(x, yA - 1, nameCol[0], nameCol[1], nameCol[2], lit);
  }
  glyph("~", 1, yB2, 1, nameCol, lit);
  const cut = (s) => s.slice(0, s.indexOf(".") + 10);
  const trueS = cut(S.dec), convS = cut(S.cdec[j]);
  let same = 0;
  while (same < trueS.length && trueS[same] === convS[same]) same++;
  const trueCol = colour(h0 + 0.1, 0.25, 0.95), okCol = colour(h0 - 0.2, 0.7, 1);
  const badCol = [1, 0.3, 0.28], restCol = [0.55, 0.22, 0.22];
  text(trueS, X0, yA, 1, () => trueCol, lit);
  text(convS, X0, yB2, 1, (i) => (i < same ? okCol : i === same ? badCol : restCol), lit);
  // The error, signed (p/q less the value), and a meter, two LEDs a digit.
  const gE = ink(gl, spJ);
  text(S.errStr[j], 1, yE, 1, () => gE, lit);
  const dig = cl(-log10(S.err[j]), 0, 16);
  for (let i = 0; i < 16; i++) {
    const on = i + 1 <= floor(dig), part = i === floor(dig) ? dig - floor(dig) : 0;
    for (let y = yE; y < yE + 5; y++) {
      put(31 + i * 2, y, 0.3, 0.35, 0.5, 0.18 * lit);
      put(31 + i * 2, y, okCol[0], okCol[1], okCol[2], (on ? 0.95 : part * 0.9) * lit);
    }
  }
  for (let p = 0; p < N; p++) display.setPixel(p & 63, p >> 6, min(255, R[p] * 255), min(255, G[p] * 255), min(255, B[p] * 255));
}
