// ===== Patternflow pattern =====
// Title:   Zeckendorf Counter
// Family:  data
// Idea:    The whole numbers stand in rows up the tall panel, each written in ten places worth 1, 2, 3, 5, 8, ... 89 with no two neighbouring places lit, and the table slides down as the count goes up while a magnified band at the current number draws each carry as a line from the places that fused (011) to the one that took them (100), and two knobs bend the place values toward powers of two or toward a sparser recurrence without ever leaving an integer out.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Zeckendorf representation (Édouard Zeckendorf, 1972; Cornelis Lekkerkerker, 1952), greedy numeration systems for linear recurrences (Aviezri Fraenkel, 1985), pattern round 107
// Round:   107
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..12, Binary=0..1, Gap=2..3
//
// Knob 1: Hue. Turns the ten place colours round the wheel together. At 0 the place worth 1 is cyan and the one worth 89 is crimson; at 0.35 the low places are magenta and the high ones green. Orange and yellow go by quickly, so no place sits at a brown.
// Knob 2: Speed. How fast the counter counts, 1.5 numbers a second for each unit: 0.75 at the bottom, 3 at the start, 18 at the top. A tick slides the table one row in a quarter of a second, so above 3.3 a second a slide fills the gap between ticks and the rows flow without rest, and past 10 the band is too quick to read and the places show only as a texture.
// Knob 3: Binary. Bends the place values from 1, 2, 3, 5, 8, 13, 21, 34, 55, 89 at 0 to 1, 2, 4, 8, 16, ... 512 at 1. In between each value is the mix rounded to a whole number and kept between one more and twice the place under it, so every integer still has a row. At 1 any places may be lit together, a carry runs through every trailing one (nine places at 512) and the counter has 1024 numbers before it rolls over, where at 0 it has 144.
// Knob 4: Gap. Bends the place values from the Fibonacci numbers at 2 toward 1, 2, 3, 4, 6, 9, 13, 19, 28, 41 at 3, each the one before plus the one three back. At 2 no two lit places are neighbours, at 3 they are at least three apart and the counter rolls over after 60 numbers.

const W = 64, H = 128;
const { floor, min, max, abs, exp, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// Ten places. Place k sits in the column 5 LEDs wide at x = 2 + 6 (9 - k), the
// lowest place at the right as in any numeral. The two LEDs at each edge are
// rails: on the left, lit when a carry made the row and whiter the longer it
// ran; on the right, how many places are lit and how many a plain binary
// counter would light for the same number.
const P = 10;
const FIB = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
const BIN = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
const SPA = [1, 2, 3, 4];
for (let k = 4; k <= P; k++) SPA.push(SPA[k - 1] + SPA[k - 3]);
// The band: a row is 1 + LENS LEDs tall at its middle and shrinks to 1 over
// about three rows each way. The centre of the band is at row YC.
const LENS = 5, SIG = 2.2, YC = 56;
// A tick slides the band to the next number in this long, or in 85% of the
// gap between ticks when they come faster.
const SLIDE = 0.26;
// A carry runs up the places at this pace and each flash fades in this long.
const RIPPLE = 0.07, FADE = 0.32;
const OFFN = 220, OFFZ = 120;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The place values for a mix of the three systems. b leans toward binary, c
// toward the sparser recurrence, and each value is rounded and then kept
// between v[k-1] + 1 and 2 v[k-1]. That keeps them strictly rising and never
// more than double, which is all the greedy rule needs: the rest after a place
// is always below the place under it, so it ends on exactly 0. v[P] is the
// modulus, the first number that no longer fits in ten places.
function places(v, b, c) {
  const wB = b, wS = c * (1 - b), wF = (1 - b) * (1 - c);
  v[0] = 1;
  for (let k = 1; k <= P; k++) v[k] = max(v[k - 1] + 1, min(2 * v[k - 1], round(wF * FIB[k] + wB * BIN[k] + wS * SPA[k])));
  return v[P];
}

// The greedy row of n: from the top place down, take a place whenever it fits.
function digits(n, v, d) {
  for (let k = P - 1; k >= 0; k--) {
    if (n >= v[k]) { d[k] = 1; n -= v[k]; } else d[k] = 0;
  }
}

// 3 x 5 digits for the number being counted.
const DIGITS = [
  "### #.# #.# #.# ###", ".#. ##. .#. .#. ###", "### ..# ### #.. ###", "### ..# ### ..# ###", "#.# #.# ### ..# ..#",
  "### #.. ### ..# ###", "### #.. ### #.# ###", "### ..# ..# .#. .#.", "### #.# ### #.# ###", "### #.# ### ..# ###",
].map((t) => {
  const r = t.split(" "), m = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (r[y][x] === "#") m.push(x, y);
  return m;
});

// The band's map from a pixel row to a position in the count. U[y] is how
// many rows above the band's middle the middle of pixel row y lies, and
// MAG[y] how many LEDs a row is tall there.
function lensTable() {
  const N = 12000, du = 0.01, cum = new Float32Array(N + 1);
  for (let i = 1; i <= N; i++) {
    const u = (i - 0.5) * du;
    cum[i] = cum[i - 1] + (1 + LENS * exp(-(u / SIG) * (u / SIG))) * du;
  }
  const U = new Float32Array(H), MAG = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    const p = YC - (y + 0.5), q = abs(p);
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < q) lo = m; else hi = m; }
    const u = (lo + (q - cum[lo]) / (cum[hi] - cum[lo])) * du;
    U[y] = p >= 0 ? u : -u;
  }
  for (let y = 0; y < H; y++) MAG[y] = 1 / abs(U[y ? y - 1 : 0] - U[y ? y : 1]);
  return { U, MAG };
}

export function setup(params) {
  const { U, MAG } = lensTable();
  params.s = {
    U, MAG, v: new Int32Array(P + 1), M: 144,
    b: 0, c: 0, bT: 0, cT: 0, hue: 0, rate: 3,
    n: 78, acc: SLIDE, tArr: 0,
    dn: new Uint8Array(P), dp: new Uint8Array(P),
    rows: new Float32Array(OFFN * W * 3), line: new Float32Array(OFFN * W), kn: new Int32Array(P + 1), stamp: new Int32Array(OFFN).fill(-1), frame: 0,
    pal: new Float32Array(P * 12),
  };
  places(params.s.v, 0, 0);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.rate = cl(k[1], 0.5, 12) * 1.5;
  S.bT = cl(k[2], 0, 1);
  S.cT = cl(k[3] - 2, 0, 1);
  const e = 1 - exp(-d / 0.2);
  S.b += (S.bT - S.b) * e;
  S.c += (S.cT - S.c) * e;
  S.M = places(S.v, S.b, S.c);
  if (S.n >= S.M) S.n %= S.M;
  // The counter ticks every 1/rate s. acc is the time since the last tick.
  const T = 1 / S.rate;
  S.acc += d;
  while (S.acc >= T) {
    S.acc -= T;
    S.n = (S.n + 1) % S.M;
  }
  S.slide = min(SLIDE, 0.85 * T);
  // The time since the row at the middle of the band arrived there.
  S.tArr = S.acc - S.slide;
}

// A flash that starts when the row has been in the band for `delay` seconds and fades.
const flash = (tau, delay) => (tau > delay ? exp(-(tau - delay) / FADE) : 0);

// One row of the table, 64 LEDs wide, for the number `off` rows above the one being counted.
function buildRow(S, off) {
  const { v, M, dn, dp, pal, rows } = S;
  const n = (((S.n + off) % M) + M) % M, pv = (n + M - 1) % M;
  digits(n, v, dn);
  digits(pv, v, dp);
  const o = (off + OFFZ) * W * 3;
  rows.fill(0, o, o + W * 3);
  let L = 0, pop = 0;
  for (let k = 0; k < P; k++) { if (dp[k] && !dn[k]) L++; pop += dn[k]; }
  const tau = -off * (1 / S.rate) + S.tArr, { kn, line } = S;
  // The places that fused, from the bottom up, and the one new place above them all (-1 when the counter rolls over).
  let j = 0, top = -1;
  for (let k = 0; k < P; k++) {
    if (dp[k] && !dn[k]) kn[j++] = k;
    else if (dn[k] && !dp[k]) top = k;
  }
  j = 0;
  for (let k = 0; k < P; k++) {
    // 0 steady, 1 new, 2 cleared by the carry, 3 empty.
    const st = dn[k] ? (dp[k] ? 0 : 1) : dp[k] ? 2 : 3;
    const q = k * 12 + st * 3;
    let r = pal[q], g = pal[q + 1], b = pal[q + 2];
    // The cleared places flash in turn from the bottom up, then the new one.
    const fl = st === 2 ? flash(tau, j++ * RIPPLE) : st === 1 ? flash(tau, L * RIPPLE) : 0;
    if (fl > 0) { r += (255 - r) * fl; g += (250 - g) * fl; b += (240 - b) * fl; }
    const x0 = 2 + 6 * (P - 1 - k);
    for (let x = x0; x < x0 + 5; x++) { rows[o + x * 3] = r; rows[o + x * 3 + 1] = g; rows[o + x * 3 + 2] = b; }
  }
  // The carry's path: a line from each cleared place to the next and on to the new one, or off the left edge. It lights as the flashes pass.
  const lo = (off + OFFZ) * W;
  line.fill(0, lo, lo + W);
  const xc = (k) => (k < 0 ? 0 : 2 + 6 * (P - 1 - k) + 2);
  for (let i = 0; i < L; i++) {
    const to = xc(i + 1 < L ? kn[i + 1] : top), from = xc(kn[i]), li = 0.3 + 0.7 * flash(tau, i * RIPPLE);
    for (let x = to; x <= from; x++) line[lo + x] = max(line[lo + x], li);
  }
  // Left edge: how many places fused to make this row, whiter the longer the carry.
  if (L > 0) {
    const t = min(1, (L - 1) / 3);
    for (let x = 0; x < 2; x++) { rows[o + x * 3] = 255; rows[o + x * 3 + 1] = 175 + 80 * t; rows[o + x * 3 + 2] = 50 + 180 * t; }
  }
  // Right edge, two LEDs: how many places are lit in this row, and how many a plain binary counter would have lit for the same number.
  let bp = 0;
  for (let u = n; u > 0; u >>= 1) bp += u & 1;
  const p0 = min(1, pop / 5), p1 = min(1, bp / 5);
  for (let c = 0; c < 3; c++) { rows[o + 62 * 3 + c] = pal[3 + c] * p0; rows[o + 63 * 3 + c] = 190 * p1; }
  S.stamp[off + OFFZ] = S.frame;
}

// The number counted, in 3 x 5 digits at the top left on a dark ground.
function readout(display, v, bright) {
  const s = String(v), w = s.length * 4 - 1;
  for (let y = 0; y < 8; y++) for (let x = 0; x < w + 4; x++) display.setPixel(x, y, 0, 0, 0);
  for (let c = 0; c < s.length; c++) {
    const m = DIGITS[s.charCodeAt(c) - 48];
    for (let i = 0; i < m.length; i += 2) display.setPixel(2 + c * 4 + m[i], 2 + m[i + 1], bright, bright, bright);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { U, MAG, rows, stamp, pal } = S;
  S.frame++;
  // Colours per place: steady, new, cleared and empty.
  const tmp = [0, 0, 0];
  for (let k = 0; k < P; k++) {
    let h = S.hue + 0.5 + 0.45 * (k / (P - 1));
    h -= floor(h);
    // Orange and yellow go by quickly: at this brightness they read as brown and olive.
    h = h < 0.02 ? h : h < 0.2 ? 0.02 + (h - 0.02) * 0.222 : h < 0.33 ? 0.06 + (h - 0.2) * 2.08 : h;
    const spec = [[0.82, 0.8], [0.3, 1], [0.3, 0.32], [0.5, 0.09]];
    for (let st = 0; st < 4; st++) {
      hsv(h, spec[st][0], spec[st][1], tmp, 0);
      for (let c = 0; c < 3; c++) pal[k * 12 + st * 3 + c] = tmp[c] * 255;
    }
  }
  const sl = S.slide || SLIDE, s = S.acc / sl, base = ease(s) - 1;
  for (let y = 0; y < H; y++) {
    const c = base + U[y], a = floor(c), t = c - a, m = MAG[y];
    const w = cl((t - 0.5) * m + 0.5, 0, 1);
    if (stamp[a + OFFZ] !== S.frame) buildRow(S, a);
    if (w > 0 && stamp[a + 1 + OFFZ] !== S.frame) buildRow(S, a + 1);
    const o0 = (a + OFFZ) * W * 3, o1 = (a + 1 + OFFZ) * W * 3;
    // A magnified row leaves its bottom LED dark so the rows read one by one.
    const gap = m >= 3 && floor(c + 0.5) !== floor(base + U[y + 1 < H ? y + 1 : y] + 0.5) ? 0.12 : 1;
    const dim = (0.74 + 0.26 * exp(-(U[y] / 5) * (U[y] / 5))) * gap;
    // The carry's path runs along the middle LED of a magnified row.
    const ln = m < 3 ? (a + (t >= 0.5 ? 1 : 0) + OFFZ) * W : abs(c - floor(c + 0.5)) <= 0.5 / m ? (a + (t >= 0.5 ? 1 : 0) + OFFZ) * W : -1, lk = m < 3 ? 0.45 : 1;
    for (let x = 0; x < W; x++) {
      const i = x * 3, l = ln >= 0 ? S.line[ln + x] * lk : 0;
      display.setPixel(x, y,
        min(255, (rows[o0 + i] * (1 - w) + rows[o1 + i] * w) * dim + 230 * l),
        min(255, (rows[o0 + i + 1] * (1 - w) + rows[o1 + i + 1] * w) * dim + 215 * l),
        min(255, (rows[o0 + i + 2] * (1 - w) + rows[o1 + i + 2] * w) * dim + 180 * l));
    }
  }
  readout(display, S.n, 200);
}
