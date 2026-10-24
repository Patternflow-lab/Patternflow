// ===== Patternflow pattern =====
// Title:   Kolakoski
// Family:  number
// Idea:    The Kolakoski sequence of 1s and 2s, the one that is its own run-length code, hangs as an icicle of ten bands: the bottom band is 64 consecutive terms one LED each, gold for 1 and violet for 2, and every band above holds the terms whose runs make the band below, each term as wide as the run it describes, so each band is the same sequence again with two thirds as many terms, the whole tree slides left one term at a time, and a slim gauge along the top shows how far the 1s so far are ahead of the 2s.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kolakoski sequence (William Kolakoski, 1965), pattern round 35
// Round:   35
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Bands=10..16, Falloff=-1..1
//
// Knob 1: Hue. Turns both colours round the wheel together: at 0 the 1s are gold and the 2s violet, each band pale at its top and full at its foot.
// Knob 2: Speed. Terms a second that the bottom band slides left: 1.5 per unit, so 3 at 2 and the 64 LEDs are new every 21 s; at 0.2 one term every 3.3 s.
// Knob 3: Bands. How many generations of the tree are shown, from 10 to 16. Ten bands at the start reach from terms 3,000 to 3,063 at the bottom up to terms 77 to 79 at the top; 16 reach term 7, where one term covers more than the panel.
// Knob 4: Falloff. Band heights: at 0 all bands are equal, about 12 rows for ten; toward 1 each band is 1.3 times the height of the one below it, so the wide terms at the top get tall bands, and toward -1 the other way round.
// Buttons: K1 tap jumps the window 100,000 terms on down the sequence, to 103,000 on the first tap, wrapping round before the million terms run out.

// Term i of the sequence is the length of run i: 1, 2, 2, 1, 1, 2, 1 is a
// run of one 1, one of two 2s, two 1s, one 2, one 1, ... and the runs
// alternate 1s and 2s. So term k has K[k] children, the terms of run k,
// and up[j] is the run that term j sits in: its parent. Term 0 and term 1
// are their own parents, and every other term climbs to term 1, from term
// 3,000 in 19 steps, from term 100,000 in 27.
//
// Rufus Oldenburger described it first in 1939; Kolakoski asked about it in
// the American Mathematical Monthly in 1965. Keane's question, whether the
// share of 1s tends to 1/2, is still open. Counted here: 49,972 1s in the
// first 100,000 terms, 499,986 in the first million, and the 1s never run
// more than 66 ahead of the 2s or behind them in all that way.

const W = 64, H = 128, N = 1 << 20, W0 = 3000, JUMP = 100000, TOP = 3;
const { floor, max, round, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  // 2^20 terms, written by reading the sequence itself two terms behind the
  // pen: 28 ms.
  const K = new Uint8Array(N);
  K[0] = 1;
  K[1] = 2;
  K[2] = 2;
  for (let len = 3, read = 2, val = 1; len < N; val = 3 - val)
    for (let c = 0, r = K[read++]; c < r && len < N; c++) K[len++] = val;
  const up = new Int32Array(N), ones = new Int32Array(N + 1);
  for (let k = 0, pos = 0; pos < N; k++) for (let c = 0; c < K[k] && pos < N; c++) up[pos++] = k;
  for (let i = 0; i < N; i++) ones[i + 1] = ones[i] + (K[i] === 1 ? 1 : 0);
  params.s = {
    K, up, ones, w: W0, acc: 0, hue: 0, speed: 2, bands: 10, fall: 0.06,
    pal: new Float32Array(12), palHue: NaN, anc: new Int32Array(16 * W),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 10, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.bands = round(cl(k[2], 10, 16));
  P.fall = cl(k[3], -1, 1);
  // Whole terms only: a window between two terms would smear every band.
  P.acc += d * P.speed * 1.5;
  while (P.acc >= 1) (P.acc -= 1), P.w++;
  if (input.btnPressed && input.btnPressed[0]) P.w += JUMP;
  if (P.w + W >= N) P.w = W0 + ((P.w - W0) % (N - W - W0));
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { K, up, anc, pal } = P;
  if (P.palHue !== P.hue) {
    // Pale and full gold for the 1s, pale and deep violet for the 2s: each
    // band runs from the first at its top row to the second at its foot.
    // The gold keeps its brightness all the way down, as a darker gold
    // reads olive, and where the knob turns the violet to red, orange or
    // yellow it is lifted the same way.
    const h2 = P.hue + 0.72 - floor(P.hue + 0.72), hw = h2 > 0.9 ? h2 - 1 : h2, warm = cl((hw + 0.06) / 0.08, 0, 1) * cl((0.32 - hw) / 0.08, 0, 1);
    hsv(P.hue + 0.11, 0.28, 1, pal, 0);
    hsv(P.hue + 0.11, 0.7, 1, pal, 3);
    hsv(h2, 0.38, 0.8 + 0.15 * warm, pal, 6);
    hsv(h2, 0.7, 0.56 + 0.36 * warm, pal, 9);
    P.palHue = P.hue;
  }
  // anc[b W + x] is the ancestor b generations up of the term under column
  // x. A band's term boundaries fall where this changes, so each term is
  // exactly as wide as its descendants in the window.
  const B = P.bands;
  for (let x = 0; x < W; x++)
    for (let b = 0, j = P.w + x; b < B; b++, j = up[j]) anc[b * W + x] = j;
  // Band heights grow by `ratio` a band going up, with a dark row between
  // bands; the top band takes what rounding leaves.
  const avail = H - TOP - (B - 1), ratio = pow(1.3, P.fall);
  let sum = 0;
  for (let b = 0; b < B; b++) sum += pow(ratio, b);
  for (let b = 0, y = H; b < B; b++) {
    const hgt = b === B - 1 ? y - TOP : max(3, round((avail * pow(ratio, b)) / sum)), y0 = y - hgt, row = b * W;
    for (let x = 0; x < W; x++) {
      const a = anc[row + x], v = K[a], o = (v - 1) * 6;
      // Neighbours of different value part by colour. Two of the same, the
      // two terms of one run, get a dark seam on the first column of the
      // right one when it is two LEDs or more; two 1-LED terms run together
      // and the band above tells them apart.
      let g = 255;
      if (x > 0 && anc[row + x - 1] !== a && K[anc[row + x - 1]] === v && x + 1 < W && anc[row + x + 1] === a) g = 40;
      for (let yy = y0; yy < y; yy++) {
        const t = hgt > 1 ? (yy - y0) / (hgt - 1) : 1, u = 1 - t;
        display.setPixel(x, yy, (pal[o] * u + pal[o + 3] * t) * g, (pal[o + 1] * u + pal[o + 4] * t) * g, (pal[o + 2] * u + pal[o + 5] * t) * g);
      }
    }
    if (y0 - 1 >= TOP) for (let x = 0; x < W; x++) display.setPixel(x, y0 - 1, 0, 0, 0);
    y = y0 - 1;
  }
  // The gauge: 1s minus 2s among the first w + 64 terms, half an LED a
  // term from the middle, toward the gold side when the 1s are ahead. The
  // track is dim violet on the left, dim gold on the right.
  const n = P.w + W, lead = 2 * P.ones[n] - n, mx = cl(32 + round(lead / 2), 0, W - 1);
  for (let x = 0; x < W; x++) {
    const o = x < 32 ? 9 : 3, g = x === 32 ? 0 : 70;
    for (let yy = 0; yy < 2; yy++) {
      if (x === mx) display.setPixel(x, yy, 255, 255, 255);
      else if (g === 0) display.setPixel(x, yy, 110, 110, 110);
      else display.setPixel(x, yy, pal[o] * g, pal[o + 1] * g, pal[o + 2] * g);
    }
    display.setPixel(x, 2, 0, 0, 0);
  }
}
