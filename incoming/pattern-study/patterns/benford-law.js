// ===== Patternflow pattern =====
// Title:   Benford's Law
// Family:  data
// Idea:    The panel is a logarithmic ruler from 1 at the bottom to 10 at the top, cut into nine bands as tall as Benford's shares, 30.1% of the height for the leading digit 1 down to 4.6% for 9, and the powers 2, 4, 8, 16, ... land on it one after another, each a step of log10 2 further up that wraps at the top, so the landings spread evenly up the ruler and each band's bar, its count over its share, swings wildly for the first powers and closes onto one dotted line by the thousandth, while a ratio such as the square root of 10 lands on two bands only and never gets there.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Benford's law (Simon Newcomb, 1881; Frank Benford, 1938), equidistribution of n x mod 1 (Hermann Weyl, 1916); 5 by 7 figures from Photon Disk (pattern round 70), copied from autogram.js; pattern round 76
// Round:   76
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Ratio=0..8, Digit=1..2
//
// Knob 1: Hue. Turns the band colours round the wheel together. At 0 the band of 1 is cyan and the bands go azure, blue, violet, magenta, rose, orange and yellow to lime for 9; at 0.5 the band of 1 is red, 2 orange, 3 yellow and 9 blue violet. With Digit at 2 the ten second digits run from cyan for 0 to yellow for 9.
// Knob 2: Speed. The count speeds up as it goes: at 2 the first power lands at 0.6 s, the tenth at 2.8 s, the hundredth at 6.4 s, the thousandth at 10.4 s and the 3000th at 12.3 s; the bars hold 2.5 s, drain in 0.8 s and the count starts again from the first power. At 0.2 all ten times slower, at 3 in two thirds of the time. The readout changes at most eight times a second.
// Knob 3: Ratio. The common ratio a, in nine steps: 2, 3, 7, 1.1, pi, 1.01, then 10^(1/5) = 1.585, 10^(1/3) = 2.154 and 10^(1/2) = 3.162. For the first six log10 a is irrational and the bars close on the line. The first 1000 powers of 2 count 301, 176, 125, 97, 79, 69, 56, 52 and 45 against Benford's 301, 176, 125, 97, 79, 67, 58, 51 and 46, and after 3000 every bar is within 1.1% of the line, under a third of an LED. pi^2 = 9.87 sits just under 10, so the powers of pi run 3, 9, 3, 9 for eight steps and then walk down in two slow lines, each crossing the decade in about 350 powers: the band of 4 is still empty after 100. 1.01 climbs about a row every two powers and takes 231 for a decade, so after 300 the band of 1 is still half again too long. The last three come back to the same leading digits every 5, 3 and 2 powers: 10^(1/5) lands only on 1, 1, 2, 3 and 6, 10^(1/3) on 1, 2 and 4, the square root of 10 on 1 and 3, and their bars never reach the line. A new ratio starts the count again.
// Knob 4: Digit. 1 counts the first digit, 2 the second. For the second digit each band of the ruler splits into ten slivers, 90 in all, from 5.3 rows for 10 to 0.6 rows for 99, coloured by the second digit, whose shares run from 12.0% for 0 to 8.5% for 9; Newcomb gave both tables in 1881. The second-digit bars of the first 100 powers of 2 are within 25% of the line and within 2% after 3000. Both counts run all the time, so the knob switches without starting over.
// Buttons: K1 tap starts the count again from the first power.

// Each power multiplies by a, which adds log10 a to the number's logarithm.
// Its mantissa, the logarithm mod 1, is the height on the ruler, so a power
// lands log10 a mod 1 of the ruler above the one before and wraps at the
// top. When log10 a is irrational Weyl's theorem says the landings fill the
// ruler evenly, and a band then gets its share of them, its height,
// log10(1 + 1/d) for the first digit d. A band's bar is its count over the
// number of powers over that share, 26 LEDs to 1, so a digit that keeps the
// law ends its bar on the dotted line 26 LEDs in, and one past 2.2 times
// its share runs off the right edge, which then shows white. Across
// the right half the newest 28 landings stand from right to left, one
// column each: a staircase for 1.1, a ramp for 1.01, two falling lines for
// pi, and level rows for the last three ratios.

const W = 64, H = 128, X0 = 6, UNIT = 26, NEND = 3000, TRAIL = 28;
const { floor, min, max, abs, exp, log10, pow, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The ratios a, by the knob. A fraction p/q is a = 10^(p/q), whose powers
// come back to the same mantissas every q steps.
const RATIOS = [
  { name: "2", l: log10(2) },
  { name: "3", l: log10(3) },
  { name: "7", l: log10(7) },
  { name: "1.1", l: log10(1.1) },
  { name: "pi", l: log10(PI) },
  { name: "1.01", l: log10(1.01) },
  { name: "10^(1/5)", p: 1, q: 5 },
  { name: "10^(1/3)", p: 1, q: 3 },
  { name: "10^(1/2)", p: 1, q: 2 },
];

// 3 by 5 figures drawn for this pattern, rows from the top.
const F35 = ["### #.# #.# #.# ###", ".#. ##. .#. .#. ###", "##. ..# .#. #.. ###", "##. ..# .#. ..# ##.", "#.# #.# ### ..# ..#",
  "### #.. ##. ..# ##.", ".## #.. ### #.# ###", "### ..# .#. .#. .#.", "### #.# ### #.# ###", "### #.# ### ..# ##."].map((f) => f.replace(/ /g, ""));
// The figures 0 to 9 of Photon Disk's 5 by 7 face (copied from autogram.js).
const F57 = [
  ".###. #...# #..## #.#.# ##..# #...# .###.", "..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.", ".###. #...# ....# ...#. ..#.. .#... #####",
  "##### ...#. ..#.. ...#. ....# #...# .###.", "...#. ..##. .#.#. #..#. ##### ...#. ...#.", "##### #.... ####. ....# ....# #...# .###.",
  "..##. .#... #.... ####. #...# #...# .###.", "##### ....# ...#. ..#.. .#... .#... .#...", ".###. #...# #...# .###. #...# #...# .###.",
  ".###. #...# #...# .#### ....# ...#. .##..",
].map((f) => f.replace(/ /g, ""));

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// Row y (0 at the top) holds the mantissas from 1 at the bottom to 10 at the
// top: its centre is the number 10^((127.5 - y) / 128). Each row belongs to
// the first digit and the second digit of that number.
const ROW1 = new Int8Array(H), ROW2 = new Int8Array(H);
for (let y = 0; y < H; y++) {
  const v = pow(10, (127.5 - y) / 128);
  ROW1[y] = floor(v);
  ROW2[y] = floor(v * 10) % 10;
}
// The law: the first digit d has share log10(1 + 1/d); the second digit e
// the sum over d of log10(1 + 1/(10d + e)), 12.0% for 0 down to 8.5% for 9.
const SHARE1 = [0], SHARE2 = [];
for (let d = 1; d <= 9; d++) SHARE1.push(log10(1 + 1 / d));
for (let e = 0; e <= 9; e++) {
  let s = 0;
  for (let d = 1; d <= 9; d++) s += log10(1 + 1 / (10 * d + e));
  SHARE2.push(s);
}
// Band d runs from row TOP1[d] to row TOP1[d - 1] - 1 (TOP1[0] = 128).
const BOT1 = [], TOP1 = [];
for (let d = 1; d <= 9; d++) {
  let a = H, b = -1;
  for (let y = 0; y < H; y++) if (ROW1[y] === d) (a = min(a, y)), (b = max(b, y));
  TOP1[d] = a;
  BOT1[d] = b;
}

function mantissa(R, n) {
  if (R.q) return ((n * R.p) % R.q) / R.q;
  const t = n * R.l;
  return t - floor(t);
}

function restart(S) {
  S.c1.fill(0);
  S.c2.fill(0);
  S.n = 0;
  S.t = 0;
  S.phase = 0;
  S.pt = 0;
  S.flash.length = 0;
  S.shown = -1;
  S.last = null;
  S.label = null;
  S.drain = 1;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, ratio: -1, digit: 1, btn: false, time: 0,
    c1: new Float64Array(10), c2: new Float64Array(10), n: 0, t: 0, phase: 0, pt: 0, drain: 1,
    flash: [], shown: -1, label: 0, labelT: -1, rgb: [0, 0, 0], col: [0, 0, 0],
    out: new Float32Array(W * H * 3),
  };
  return params.s;
}

// One power: count its first and second digits, and flash its row.
function land(S, n) {
  const R = RATIOS[S.ratio], m = mantissa(R, n), v = pow(10, m);
  const d1 = min(9, floor(v + 1e-9)), d2 = floor(v * 10 + 1e-9) % 10;
  S.c1[d1]++;
  S.c2[d2]++;
  const y = cl(127 - floor(m * 128), 0, H - 1);
  S.flash.push({ y, t: S.time, d1, d2 });
  if (S.flash.length > TRAIL) S.flash.shift();
  S.last = { n, y, v };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const ratio = cl(round(k[2] || 0), 0, RATIOS.length - 1);
  S.digit = cl(round(k[3] == null ? 1 : k[3]), 1, 2);
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  if (ratio !== S.ratio || (btn && !S.btn)) {
    S.ratio = ratio;
    restart(S);
  }
  S.btn = btn;
  S.time += d;
  const sp = S.speed / 2;
  if (S.phase === 0) {
    // The count speeds up: n = 2.5 (2^(t / 1.2) - 1) at Speed 2, so the
    // first powers come about a second apart and the 3000th at 12.3 s.
    S.t += d * sp;
    S.drain = min(1, S.drain + d * 3);
    const want = min(NEND, floor(2.5 * (pow(2, S.t / 1.2) - 1)));
    while (S.n < want) land(S, ++S.n);
    if (S.n >= NEND) (S.phase = 1), (S.pt = 0);
  } else if (S.phase === 1) {
    S.pt += d * sp;
    if (S.pt > 2.5) (S.phase = 2), (S.pt = 0);
  } else {
    S.pt += d * sp;
    S.drain = max(0, 1 - S.pt / 0.6);
    if (S.pt > 0.8) restart(S), (S.drain = 0);
  }
  // The readout follows the newest power, at most eight times a second.
  if (S.last && S.last.n !== S.shown && S.time - S.labelT >= 0.125) {
    S.shown = S.last.n;
    S.labelT = S.time;
    S.label = S.last;
  }
}

function put(o, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const k = (y * W + x) * 3;
  o[k] = c[0] * a;
  o[k + 1] = c[1] * a;
  o[k + 2] = c[2] * a;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const o = S.out, col = S.col, n = max(1, S.n), two = S.digit === 2;
  const share = two ? SHARE2 : SHARE1, cnt = two ? S.c2 : S.c1;
  const glow = S.phase === 1 ? 0.5 + 0.5 * Math.sin(S.pt * 6) : 0;
  // Flash strength per row.
  // Flash strength per row: the newest four powers, each fading in 0.15 s.
  const fl = new Float32Array(H), F = S.flash;
  for (let i = F.length - 1, r = 0; i >= 0 && r < 4; i--, r++) fl[F[i].y] = max(fl[F[i].y], exp(-r / 2 - (S.time - F[i].t) / 0.15));
  for (let y = 0; y < H; y++) {
    const cls = two ? ROW2[y] : ROW1[y];
    const hue = two ? S.hue + 0.5 + cls * 0.074 : S.hue + 0.5 + (cls - 1) * 0.094;
    const ratio = S.n > 0 ? cnt[cls] / n / share[cls] : 0;
    const fx = X0 + UNIT * ratio * S.drain;
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 3;
      let r = 0, g = 0, b = 0;
      if (x >= X0) {
        if (x + 1 <= fx) {
          // The bar, its last column brightest.
          const edge = x + 2 > fx ? 1 : 0;
          hsv(hue, edge ? 0.45 : 0.72, edge ? 1 : 0.86, col);
        } else if (x < fx) {
          const f = fx - x;
          hsv(hue, 0.45, 0.18 + 0.82 * f, col);
        } else hsv(hue, 0.35, 0.13, col);
        (r = col[0]), (g = col[1]), (b = col[2]);
        if (fl[y] > 0) {
          const a = 0.7 * fl[y];
          r += (1 - r) * a;
          g += (1 - g) * a;
          b += (1 - b) * a;
        }
      }
      o[k] = r;
      o[k + 1] = g;
      o[k + 2] = b;
    }
    // A bar past the edge of the panel ends in a white column.
    if (X0 + UNIT * ratio * S.drain > W) put(o, W - 1, y, [1, 1, 1], 0.9);
    // Benford's line: where every bar ends when the digits keep the law.
    if (y % 2 === 0) {
      const k = (y * W + X0 + UNIT) * 3, a = 0.55 + 0.45 * glow;
      o[k] = max(o[k], a);
      o[k + 1] = max(o[k + 1], a);
      o[k + 2] = max(o[k + 2], a);
    }
  }
  // The ruler: a tick at each digit 1 to 9 and the digit beside its band.
  for (let d = 1; d <= 9; d++) {
    const yb = BOT1[d], yt = TOP1[d], mid = floor((yb + yt) / 2) - 2;
    hsv(S.hue + 0.5 + (d - 1) * 0.094, two ? 0 : 0.5, 1, col);
    for (let x = 0; x < X0 - 1; x++) put(o, x, yb, col, 0.35);
    const f = F35[d];
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (f[r * 3 + q] === "#") put(o, 1 + q, mid + r, col, 0.95);
  }
  // The orbit: the newest 28 powers from right to left, one column each, at
  // the rows they landed on.
  const F2 = S.flash, fade = S.phase === 2 ? S.drain : 1;
  for (let i = F2.length - 1, j = 0; i >= 0; i--, j++) {
    const f = F2[i], x = W - 2 - j;
    if (x <= X0 + UNIT + 1) break;
    const c = two ? f.d2 : f.d1;
    hsv(two ? S.hue + 0.5 + c * 0.074 : S.hue + 0.5 + (c - 1) * 0.094, 0.3, 1, col);
    put(o, x, f.y, col, fade * (1 - (0.6 * j) / TRAIL));
  }
  // The newest power's first four digits, beside the row it landed on.
  if (S.label && S.phase !== 2) {
    const v = floor(S.label.v * 1000 + 1e-6), s = [floor(v / 1000), -1, floor(v / 100) % 10, floor(v / 10) % 10, v % 10];
    const top = cl(S.label.y - 3, 1, H - 8), x1 = W - 4;
    const wid = 4 * 6 + 2;
    for (let y = top - 1; y <= top + 7; y++) for (let x = x1 - wid; x <= x1 + 1; x++) put(o, x, y, [0, 0, 0], 0);
    const lv = S.label.v;
    hsv(two ? S.hue + 0.5 + (floor(lv * 10 + 1e-9) % 10) * 0.074 : S.hue + 0.5 + (min(9, floor(lv + 1e-9)) - 1) * 0.094, 0.25, 1, col);
    let x = x1 - wid + 1;
    for (const c of s) {
      if (c < 0) {
        put(o, x, top + 6, col, 1);
        x += 2;
        continue;
      }
      const f = F57[c];
      for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (f[r * 5 + q] === "#") put(o, x + q, top + r, col, 1);
      x += 6;
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 3;
      display.setPixel(x, y, round(cl(o[k], 0, 1) * 255), round(cl(o[k + 1], 0, 1) * 255), round(cl(o[k + 2], 0, 1) * 255));
    }
}
