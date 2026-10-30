// ===== Patternflow pattern =====
// Title:   Voss Dice
// Family:  noise
// Idea:    A row of dice stands for the bits of a binary counter and at every step the dice whose bits changed are rerolled, so die k rerolls every 2^k steps and their sum is pink 1/f noise, drawn flowing down the panel between white noise (all the dice rerolled every step) on the left and brown noise (a walk stepped by one die) on the right.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Richard F. Voss's dice for 1/f noise, as Martin Gardner gave it with white and brown music in Mathematical Games (Scientific American, April 1978), pattern round 73
// Round:   73
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Dice=4..8, Hold=-1..1
//
// Knob 1: Hue. Turns the dice and the middle and right traces round the wheel together: at 0 the middle trace and the dice's flashes are pink and the right trace brown. The left trace stays near white.
// Knob 2: Speed. Steps a second: 6 at 2, 0.6 at 0.2, 9 at 3. Each step moves the traces down 2 rows.
// Knob 3: Dice. How many dice, 4 to 8, the same for all three traces. The slowest die of the middle trace rerolls every 8 steps with 4 dice and every 128 with 8, so each die more adds an octave at the low end. From 5 dice up the faces shrink from 14 to 7 LEDs.
// Knob 4: Hold. How much longer each die holds its face than the one to its right. At the opening 0.06 it is exactly 2, Voss's counter; at -0.94 and below it is 1, every die rerolls every step and the middle trace turns white like the left; at 1 it is 3.8, die 1 rerolls every 3 or 4 steps and die 3 every 56, so the middle trace jitters by one die round levels that seldom move.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sqrt, exp, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

const roll = () => 1 + floor(Math.random() * 6);

// ---- Faces on a 7 by 7 grid: pips one cell at columns and rows 1, 3, 5,
// the four corner cells left dark to round the die. Drawn at 2 LEDs a cell
// for 4 dice (14 LED faces) and 1 for 5 to 8.
const PIPS = [
  [],
  [[3, 3]],
  [[1, 1], [5, 5]],
  [[1, 1], [3, 3], [5, 5]],
  [[1, 1], [5, 1], [1, 5], [5, 5]],
  [[1, 1], [5, 1], [3, 3], [1, 5], [5, 5]],
  [[1, 1], [5, 1], [1, 3], [5, 3], [1, 5], [5, 5]],
];

// ---- The three games. Every step:
// white: all n dice rerolled, the sum taken;
// pink: Voss's dice, die k rerolled when floor(step / r^k) changes, which for
//   r = 2 is when bit k of the step count changes, so die 0 every step,
//   die 1 every 2nd, die k every 2^k-th;
// brown: a walk that moves by a die's roll less 3.5 (-2.5 to +2.5) and folds
//   back at the ends of the window the other two are drawn in.
// The window is the mean of n dice, 3.5n, plus and minus 2.6 standard
// deviations (each die's variance is 35/12): of 4 to 24 for 4 dice that is
// 5.1 to 22.9, of 8 to 48 for 8 dice 15.4 to 40.6. Values are kept as -1..1
// across the window, so the history survives a change of Dice.
// Checked over 400,000 steps: 1.875 dice reroll a step on average with 4
// dice and 1.992 with 8, so the pink sum moves 2.56 and 2.61 a step against
// 3.87 and 5.46 for the white; the brown always moves 1.5.
const HIST = 140;

function windowOf(n) {
  return [3.5 * n, 2.6 * sqrt((n * 35) / 12)];
}

function step(S) {
  const n = S.n, r = S.r, t = ++S.count;
  for (let k = 0; k < n; k++) {
    const p = pow(r, k);
    if (floor(t / p) !== floor((t - 1) / p)) {
      S.dice[k] = roll();
      S.flash[k] = 1;
    }
  }
  let pink = 0, white = 0;
  for (let k = 0; k < n; k++) (pink += S.dice[k]), (white += roll());
  const [mean, half] = windowOf(n);
  let b = S.brown + roll() - 3.5;
  if (b > mean + half) b = 2 * (mean + half) - b;
  if (b < mean - half) b = 2 * (mean - half) - b;
  S.brown = b;
  const at = S.head = (S.head + 1) % HIST;
  S.hw[at] = (white - mean) / half;
  S.hp[at] = (pink - mean) / half;
  S.hb[at] = (b - mean) / half;
}

export function setup(params) {
  params.s = {
    n: 4, r: 2, count: 0, ph: 0, hue: 0, ready: false,
    dice: new Int8Array(8).fill(1), flash: new Float32Array(8), brown: 14,
    head: 0, hw: new Float32Array(HIST), hp: new Float32Array(HIST), hb: new Float32Array(HIST),
    rgb: new Float32Array(N * 3),
  };
  for (let k = 0; k < 8; k++) params.s.dice[k] = roll();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 4, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  const speed = cl(k[1], 0.2, 3), n = cl(round(k[2]), 4, 8);
  // Hold ratio: 2^(k + 0.94), so the Lab's opening 0.06 gives exactly 2.
  S.r = max(1, pow(2, cl(k[3], -1, 1) + 0.94));
  if (n !== S.n) {
    // Dice added come in rolled; the walk keeps its place in the window.
    const [m0, h0] = windowOf(S.n), [m1, h1] = windowOf(n);
    S.brown = m1 + ((S.brown - m0) / h0) * h1;
    S.n = n;
  }
  if (!S.ready) {
    // A full panel of history before the first frame: 140 steps.
    S.brown = 3.5 * n;
    for (let i = 0; i < HIST; i++) step(S);
    S.flash.fill(0);
    S.ready = true;
  }
  S.ph += d * speed * 3;
  while (S.ph >= 1) {
    S.ph -= 1;
    step(S);
  }
  // A reroll flash fades in a quarter of a second.
  const f = exp(-d / 0.09);
  for (let i = 0; i < 8; i++) S.flash[i] *= f;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, n } = S, hue = S.hue;
  const pinkC = hsv(0.93 + hue, 0.5, 1), brownC = hsv(0.07 + hue, 0.82, 0.68), whiteC = hsv(0.6 + hue, 0.06, 0.92);
  const ivory = hsv(0.93 + hue, 0.1, 0.78), hot = hsv(0.93 + hue, 0.65, 1);
  rgb.fill(0);
  const put = (x, y, c, a) => {
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    rgb[o] = max(rgb[o], c[0] * a), rgb[o + 1] = max(rgb[o + 1], c[1] * a), rgb[o + 2] = max(rgb[o + 2], c[2] * a);
  };

  // ---- Dice row, the counter's bit lamps under it.
  const cell = n <= 4 ? 2 : 1, face = 7 * cell, pitch = floor(W / n), x0 = floor((W - pitch * n + pitch - face) / 2);
  const bitsY = 2 + face + cell, top = bitsY + 2 * cell + 3;
  for (let k = 0; k < n; k++) {
    // Die 0, the fastest, on the right, so the lamps read as the step count
    // in binary.
    const dx = x0 + (n - 1 - k) * pitch, fl = S.flash[k];
    const col = [0, 1, 2].map((q) => ivory[q] + (hot[q] - ivory[q]) * fl);
    const pips = PIPS[S.dice[k]];
    for (let j = 0; j < 7; j++)
      for (let i = 0; i < 7; i++) {
        if ((i === 0 || i === 6) && (j === 0 || j === 6)) continue;
        let pip = false;
        for (const [pi, pj] of pips) if (pi === i && pj === j) pip = true;
        const a = pip ? 0.05 * (1 - fl) : 0.9 + 0.1 * fl;
        for (let v = 0; v < cell; v++) for (let u = 0; u < cell; u++) put(dx + i * cell + u, 2 + j * cell + v, col, a);
      }
    const bit = floor(S.count / pow(S.r, k)) & 1;
    for (let u = cell; u < face - cell; u++) for (let v = 0; v < cell; v++) put(dx + u, bitsY + v, pinkC, bit ? 0.9 : 0.12);
  }

  // ---- Three traces, newest at the top, 2 rows a step, sliding down
  // smoothly between steps. Each is a step plot: a bright line at the value
  // with a dim fill back to the column's middle.
  const R = 2, cols = [[0, S.hw, whiteC], [22, S.hp, pinkC], [44, S.hb, brownC]];
  for (const [cx, hist, c] of cols) {
    const mid = cx + 9.5;
    let prev = null;
    for (let y = top; y < H; y++) {
      const age = floor((y - top) / R - S.ph + 1);
      if (age >= HIST) break;
      const v = hist[(S.head - max(0, age) + HIST * 2) % HIST];
      const x = mid + cl(v, -1, 1) * 9;
      // Fill from the middle.
      const a = min(x, mid), b = max(x, mid);
      for (let i = floor(a); i <= floor(b); i++) put(i, y, c, 0.2);
      // The line, split over two LEDs by where it falls between them, and a
      // horizontal run where the value changed since the row above.
      const xi = floor(x - 0.5), fr = x - 0.5 - xi;
      put(xi, y, c, 1 - fr), put(xi + 1, y, c, fr);
      if (prev !== null && abs(prev - x) > 1) for (let i = round(min(prev, x)); i <= round(max(prev, x)) - 1; i++) put(i, y, c, 0.85);
      prev = x;
    }
  }

  for (let p = 0; p < N; p++) display.setPixel(p % W, (p / W) | 0, round(min(1, rgb[p * 3]) * 255), round(min(1, rgb[p * 3 + 1]) * 255), round(min(1, rgb[p * 3 + 2]) * 255));
}
