// ===== Patternflow pattern =====
// Title:   Fangcheng
// Family:  type
// Idea:    A counting board of three columns and four rows of rod numerals, each column one equation of a three-unknown system and each shape one of the characters of the counting-rod script, is cleared the way chapter 8 of the Nine Chapters clears it: a column is multiplied by a leading number and another column is taken off it again and again until the board is a triangle, rods withdrawing and new rods sliding in, warm rods for positive numbers and cool rods for negative, and the three answers are then read off the bottom as rod fractions, the grain problem's 37 over 4, 17 over 4 and 11 over 4.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: fangcheng (方程), chapter 8 of the Nine Chapters on the Mathematical Art (九章算術, compiled by about the first century AD, with Liu Hui's commentary of 263): simultaneous linear equations laid as columns of counting rods and cleared by multiplying a column and subtracting another (遍乘直除), which is Gaussian elimination, with the rules for positive and negative numbers (正負術) and rod numerals that alternate vertical and horizontal forms by place; the grain problem is the first of the chapter; the other five systems and the pixel digits were made for this pattern; pattern round 104
// Round:   104
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Problem=0..6, Rods=0..2
//
// Knob 1: Hue. Turns both rod colours round the wheel together. At 0 positive rods are amber and negative rods azure, on a slate grid; at 0.5 positive rods are blue and negative rods orange.
// Knob 2: Speed. At 2 each column is laid in 0.7 s, each subtraction of a column takes 0.9 s, each multiplication 1.2 s and each answer 1.4 s, with 0.12 s between steps. The grain problem is laid by 2.8 s, cleared at 12.3 s and answered at 16.8 s, then stands 3.4 s and fades in 0.7 s, so it comes round every 20.9 s; the longest problem, 3, takes 26.9 s. All times go as 2 / Speed: at 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Problem. Seven problems in seven equal parts of the range; turning it starts the one it points at from the empty board, and each is followed by the next. 0 is the grain problem of the Nine Chapters, 3, 2 and 1 sheaves of top, middle and low grain making 39 dou, then 2, 3, 1 making 34 and 1, 2, 3 making 26, answers 37/4, 17/4 and 11/4: the column with the 1 leads, so nothing is multiplied, nine subtractions clear it, the biggest number on the board is 39 and the rods go black and back. 1 is 7, 2 and 3 with two multiplications; 2 is 7, 6 and 7 with a -2 in the first equation and a -1 in the third, seven of its nine steps additions because the signs differ; 3 is 25/4, 21/4 and 3/4 with three multiplications and eleven subtractions; 4 is 7/2, 3 and 6; 5 is 21/4, 15/2 and 5/4 with a zero in the board, an empty square; 6 is 2, 9 and 4 with a -1 in the second equation and a -2 in the third from the start, and one multiplication by 3.
// Knob 4: Rods. How the numbers are written, in thirds of the range. Up to 0.67 it is the counting-rod script: units upright and tens flat, a 6 to 9 being a cross rod of 5 beside 1 to 4 rods. From 0.67 to 1.33 the tens are upright rods too, so neighbouring digits are no longer told apart by direction. Above 1.33 it is arabic digits 5 by 9 LEDs, a minus in front of the black numbers, to read the rods against. The opening 0.06 is the rod script.

// Chapter 8 of the Nine Chapters lays each equation as a column on the
// counting board: one row for each unknown and the last row for the constant.
// The first equation stands at the right. To clear the board, the column of
// one equation is multiplied by the leading number of another (遍乘, multiply
// right through) and that other column is taken off it as many times as it
// takes (直除, subtract straight), until the leading number is gone. Do it
// for each column in turn and the board is a triangle, the last column holds
// one unknown and the constant, and the others follow from the bottom up.
// That is Gaussian elimination, written down eighteen centuries before Gauss.
// The chapter also gives the rules for numbers that go below zero, the first
// systematic use of negatives: the same signs are subtracted and different
// signs added, and positive numbers are red rods and negative numbers black.
// A black rod cannot be shown on a dark panel, so negatives are the cool
// colour here, and the Nine Chapters' red is warm amber.
//
// Rod numerals are drawn as the rods lie. Units, hundreds and ten-thousands
// stand upright: 1 to 5 are that many upright rods, 6 to 9 are a cross rod of
// 5 laid over 1 to 4 upright ones. Tens and thousands lie flat: 1 to 5 flat
// rods, 6 to 9 an upright rod of 5 standing over 1 to 4 flat ones. Zero is an
// empty square. Every rod is 1 LED wide and 7 long, and two rods of a digit
// are 2 LEDs apart, so five rods are 9 LEDs across: a number of two places
// is 19 wide and three columns make the board 61, which is why no number on
// it passes 99. The Nine Chapters starts from the right-hand column; here the
// pivot is the column with the smallest leading number, which reaches the same
// answers, so the grain problem, whose right-hand column would multiply a
// constant of 34 up to 102, is cleared with its 1 first and stays under 40.
//
// setup() clears every problem the way the board does, with integers, keeps
// the biggest number met (it must be 99 or less), solves from the bottom up in
// fractions and checks each answer against the three equations as given. A
// problem that fails any of it is left out.

const W = 64, H = 128;
const { floor, round, min, max, abs, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const gcd = (a, b) => (b ? gcd(b, a % b) : abs(a));
const mix = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i].map((c) => c * 255);
}

// Each system is three columns, first equation first: the coefficients of
// the three unknowns and then the constant.
const PROBLEMS = [
  [[3, 2, 1, 39], [2, 3, 1, 34], [1, 2, 3, 26]],
  [[2, 4, 3, 31], [3, 4, 4, 41], [2, 1, 2, 22]],
  [[-2, 4, 4, 38], [2, 4, -2, 24], [-1, 3, 2, 25]],
  [[3, 2, 1, 30], [3, 3, 2, 36], [2, 3, 1, 29]],
  [[2, 4, 1, 25], [4, 4, 2, 38], [4, 5, 1, 35]],
  [[1, 1, 5, 19], [5, 0, 3, 30], [4, 4, 0, 51]],
  [[5, 1, 5, 39], [1, -1, 3, 5], [3, 5, -2, 43]],
];

// ---- Time, in story seconds at Speed 2.
const LAY = 0.7, MUL = 1.2, SUB = 0.9, READ = 1.4, GAP = 0.12, HOLD = 3.4, FADE = 0.7;

const frac = (n, d) => {
  if (d < 0) (n = -n), (d = -d);
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};

// One problem as a list of ops with the board before and after each: the
// board is 12 numbers, column e (0 the right-hand one) rows 0 to 3.
function plan(eq) {
  const cols = eq.map((e) => e.slice()), used = [false, false, false], ops = [], piv = [];
  let before = new Array(12).fill(0), t = 0.4, big = 0;
  const flat = () => [].concat(...cols);
  const note = () => cols.forEach((c) => c.forEach((v) => (big = max(big, abs(v)))));
  note();
  for (let e = 0; e < 3; e++) {
    const after = before.slice();
    for (let i = 0; i < 4; i++) after[e * 4 + i] = cols[e][i];
    ops.push({ kind: "lay", e, t0: t, dur: LAY, before, after, m0: 0, m1: 1 });
    before = after;
    t += LAY + 0.1;
  }
  t += 0.3;
  const rec = (op, dur, m0, m1) => {
    const after = flat();
    ops.push({ ...op, t0: t, dur, before, after, m0, m1 });
    before = after;
    t += dur + GAP;
    note();
  };
  for (let r = 0; r < 2; r++) {
    let p = -1;
    for (let c = 0; c < 3; c++) if (!used[c] && cols[c][r] !== 0 && (p < 0 || abs(cols[c][r]) < abs(cols[p][r]))) p = c;
    if (p < 0) return null;
    used[p] = true;
    piv[r] = p;
    for (let c = 0; c < 3; c++) {
      if (used[c] || cols[c][r] === 0) continue;
      const lc = cols[c][r], lp = cols[p][r], g = gcd(lc, lp), m = abs(lp) / g, k = abs(lc) / g, s = lc * lp > 0 ? 1 : -1;
      if (m > 1) {
        for (let i = 0; i < 4; i++) cols[c][i] *= m;
        rec({ kind: "mul", e: c, p, row: r, m }, MUL, 0.28, 0.82);
      }
      for (let j = 0; j < k; j++) {
        for (let i = 0; i < 4; i++) cols[c][i] -= s * cols[p][i];
        rec({ kind: "sub", e: c, p, row: r, s, j, k }, SUB, 0.2, 0.75);
      }
    }
  }
  piv[2] = used.indexOf(false);
  // From the bottom up, in fractions.
  const x = [];
  for (let r = 2; r >= 0; r--) {
    const col = cols[piv[r]];
    if (col[r] === 0) return null;
    let n = col[3], d = 1;
    for (let i = r + 1; i < 3; i++) [n, d] = frac(n * x[i][1] - col[i] * x[i][0] * d, d * x[i][1]);
    x[r] = frac(n, d * col[r]);
  }
  for (const e of eq) {
    let n = 0, d = 1;
    for (let i = 0; i < 3; i++) [n, d] = frac(n * x[i][1] + e[i] * x[i][0] * d, d * x[i][1]);
    if (n !== e[3] || d !== 1) return null;
  }
  if (x.some((q) => q[0] <= 0 || q[0] > 99 || q[1] > 9)) return null;
  for (let r = 2; r >= 0; r--) rec({ kind: "read", row: r, p: piv[r], num: x[r][0], den: x[r][1] }, READ, 0.25, 0.85);
  return big > 99 ? null : { ops, x, tEnd: t + HOLD + FADE, big };
}

// ---- Pixel digits, 5 by 9, for the arabic setting.
const FONT = [
  [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  [".###.", "#...#", "....#", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  [".###.", "#...#", "....#", "....#", "..##.", "....#", "....#", "#...#", ".###."],
  ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#.", "...#.", "...#."],
  ["#####", "#....", "#....", "####.", "....#", "....#", "....#", "#...#", ".###."],
  [".###.", "#...#", "#....", "#....", "####.", "#...#", "#...#", "#...#", ".###."],
  ["#####", "....#", "....#", "...#.", "...#.", "..#..", "..#..", "..#..", "..#.."],
  [".###.", "#...#", "#...#", "#...#", ".###.", "#...#", "#...#", "#...#", ".###."],
  [".###.", "#...#", "#...#", "#...#", ".####", "....#", "....#", "#...#", ".###."],
];

// ---- Rod numerals. A digit is a list of rods {x, y, len, v} in a square 9
// wide, v 1 for an upright rod, and the height of the whole digit. Form 0 is
// upright (units), form 1 flat (tens).
const ROD = [[], []];
for (let form = 0; form < 2; form++)
  for (let d = 0; d <= 9; d++) {
    const n = d <= 5 ? d : d - 5, r = [];
    let h = 0;
    if (d > 0 && form === 0) {
      const top = d <= 5 ? 0 : 2;
      for (let i = 0; i < n; i++) r.push({ x: 4 + 2 * i - (n - 1), y: top, len: 7, v: 1 });
      if (d > 5) r.push({ x: 1, y: 0, len: 7, v: 0 });
      h = top + 7;
    } else if (d > 0) {
      const top = d <= 5 ? 0 : 8;
      for (let i = 0; i < n; i++) r.push({ x: 1, y: top + 2 * i, len: 7, v: 0 });
      if (d > 5) r.push({ x: 4, y: 0, len: 7, v: 1 });
      h = top + 2 * n - 1;
    }
    ROD[form][d] = { r, h };
  }

// ---- Layout. Columns of 20 LEDs between grid lines at x = 1, 21, 41, 61;
// the board's rows 18 apart from y = 10; the answer row under it.
const GX0 = 1, CW = 20, GY0 = 10, RHT = 18, AY0 = 86, AH = 36;

export function setup(params) {
  const plans = [];
  for (const eq of PROBLEMS) {
    const p = plan(eq);
    if (p) plans.push(p);
  }
  params.s = { hue: 0, speed: 2, mode: 0, prob: -1, idx: 0, t: 0, plans, buf: new Float32Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.mode = cl(floor((k[3] == null ? 0.06 : k[3]) * 1.5), 0, 2);
  const prob = cl(floor(((k[2] || 0) * S.plans.length) / 6.0001), 0, S.plans.length - 1);
  if (prob !== S.prob) {
    S.prob = prob;
    S.idx = prob;
    S.t = 0;
  }
  S.t += (d * S.speed) / 2;
  if (S.t >= S.plans[S.idx].tEnd) {
    S.idx = (S.idx + 1) % S.plans.length;
    S.t = 0;
  }
}

// ---- Drawing.
function put(buf, x, y, c, a) {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const o = (y * W + x) * 3;
  buf[o] = max(buf[o], c[0] * a);
  buf[o + 1] = max(buf[o + 1], c[1] * a);
  buf[o + 2] = max(buf[o + 2], c[2] * a);
}

function tint(buf, x, y, c, a) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] += c[0] * a;
  buf[o + 1] += c[1] * a;
  buf[o + 2] += c[2] * a;
}

// A rod from (x, y), len LEDs long, drawn from its middle outward so that
// scale 0 to 1 withdraws or pushes it out.
function rod(buf, x, y, len, v, scale, c, a) {
  if (scale <= 0.02) return;
  const mid = len / 2, half = (len * scale) / 2;
  for (let i = 0; i < len; i++) {
    const cov = cl(min(i + 1, mid + half) - max(i, mid - half), 0, 1);
    if (cov > 0) put(buf, v ? x : x + i, v ? y + i : y, c, cov * a);
  }
}

function glyphAt(buf, d, x, y, c, a) {
  const g = FONT[d];
  for (let r = 0; r < 9; r++) for (let q = 0; q < 5; q++) if (g[r][q] === "#") put(buf, x + q, y + r, c, a);
}

// The digits of a number as places from the right: [units, tens].
const dig = (n) => [abs(n) % 10, floor(abs(n) / 10) % 10];

// One number from a to b, m 0 to 1: rods that are not in the next digit
// withdraw in the first part of m, the rods that are in it push out in the
// rest, and rods in both stay and change colour with the sign. flash whitens.
function number(buf, xi, cy, a, b, m, flash, mode, C, fade, bare, blank) {
  const da = dig(a), db = dig(b), ca = mix(a < 0 ? C.neg : C.pos, [255, 255, 255], flash), cb = mix(b < 0 ? C.neg : C.pos, [255, 255, 255], flash);
  const cc = mix(ca, cb, sm(m));
  if (mode === 2) {
    const la = abs(a) >= 10 ? 2 : 1, lb = abs(b) >= 10 ? 2 : 1;
    for (let p = 0; p < 2; p++) {
      const x = xi + (p ? 4 : 10), y = cy - 4;
      const ha = p < la && !blank, hb = p < lb;
      if (ha && hb && da[p] === db[p]) glyphAt(buf, db[p], x, y, cc, fade);
      else {
        if (ha) glyphAt(buf, da[p], x, y, ca, fade * (1 - sm(m / 0.5)));
        if (hb) glyphAt(buf, db[p], x, y, cb, fade * sm((m - 0.5) / 0.5));
      }
    }
    // Minus, 3 wide, one LED clear of the first digit.
    const mxa = xi + (la === 2 ? 0 : 6), mxb = xi + (lb === 2 ? 0 : 6);
    const wa = a < 0 && !bare && !blank, wb = b < 0 && !bare;
    if (wa && wb && mxa === mxb) for (let i = 0; i < 3; i++) put(buf, mxa + i, cy, cc, fade);
    else {
      if (wa) for (let i = 0; i < 3; i++) put(buf, mxa + i, cy, ca, fade * (1 - sm(m / 0.5)));
      if (wb) for (let i = 0; i < 3; i++) put(buf, mxb + i, cy, cb, fade * sm((m - 0.5) / 0.5));
    }
    return;
  }
  for (let p = 0; p < 2; p++) {
    const form = mode === 0 && p === 1 ? 1 : 0, X = xi + (p ? 0 : 9);
    const A = ROD[form][da[p]], B = ROD[form][db[p]];
    const ya = cy - floor(A.h / 2), yb = cy - floor(B.h / 2);
    const key = (r, y0) => r.x + "," + (y0 + r.y) + "," + r.v;
    const inB = new Set(B.r.map((r) => key(r, yb))), inA = new Set(A.r.map((r) => key(r, ya)));
    const gone = A.r.filter((r) => !inB.has(key(r, ya))).length > 0, split = gone ? 0.45 : 0;
    for (const r of A.r) {
      if (inB.has(key(r, ya))) rod(buf, X + r.x, ya + r.y, r.len, r.v, 1, cc, fade);
      else rod(buf, X + r.x, ya + r.y, r.len, r.v, 1 - sm(m / split), ca, fade);
    }
    for (const r of B.r) if (!inA.has(key(r, yb))) rod(buf, X + r.x, yb + r.y, r.len, r.v, sm((m - split) / (1 - split)), cb, fade);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const P = S.plans[S.idx], t = S.t, buf = S.buf, mode = S.mode;
  buf.fill(0);
  const C = { pos: hsv(0.105 + S.hue, 0.85, 1), neg: hsv(0.55 + S.hue, 0.75, 1), grid: hsv(0.62 + S.hue, 0.4, 0.2), pale: hsv(0.105 + S.hue, 0.2, 0.9) };
  const fade = cl((P.tEnd - t) / FADE, 0, 1);
  // Where the board stands at t.
  let vals = new Array(12).fill(0), act = null;
  const lastCh = new Array(12).fill(-9), ansM = [-1, -1, -1], ansEnd = [-9, -9, -9];
  for (const op of P.ops) {
    const t1 = op.t0 + op.dur;
    if (t >= t1) {
      vals = op.after;
      for (let i = 0; i < 12; i++) if (op.before[i] !== op.after[i]) lastCh[i] = op.t0 + op.dur * op.m1;
      if (op.kind === "read") (ansM[op.row] = 1), (ansEnd[op.row] = op.t0 + op.dur * op.m1);
    } else {
      if (t >= op.t0) act = op;
      break;
    }
  }
  const u = act ? (t - act.t0) / act.dur : 0, m = act ? cl((u - act.m0) / (act.m1 - act.m0), 0, 1) : 0;
  const hi = act ? min(1, u / 0.15, (1 - u) / 0.15) : 0;
  if (act && act.kind === "read") ansM[act.row] = m;
  const colX = (e) => GX0 + 1 + CW * (2 - e);
  const rowY = (r) => GY0 + RHT * r;
  const warm = mix(C.pos, [255, 255, 255], 0.5), cool = mix(C.neg, [255, 255, 255], 0.5);

  // The grid: column lines, row lines, the constant row set off, a dotted
  // line between the places, and the dots that name the unknowns.
  for (let k = 0; k < 4; k++) for (let y = GY0; y <= GY0 + 4 * RHT; y++) put(buf, GX0 + CW * k, y, C.grid, 1);
  for (let r = 0; r < 5; r++) for (let x = GX0; x <= GX0 + 3 * CW; x++) put(buf, x, rowY(r), C.grid, r === 3 ? 1.6 : 1);
  for (let k = 0; k < 3 && mode === 0; k++) for (let y = GY0 + 1; y < GY0 + 4 * RHT; y += 2) if ((y - GY0) % RHT) put(buf, GX0 + 1 + CW * k + 8, y, C.grid, 0.95);
  for (let k = 0; k < 4; k++) for (let x = GX0; x <= GX0 + 3 * CW; x++) put(buf, x, AY0 + (k % 2) * AH, C.grid, 1);
  for (let k = 0; k < 4; k++) for (let y = AY0; y <= AY0 + AH; y++) put(buf, GX0 + CW * k, y, C.grid, 1);
  const rowOn = act ? (act.kind === "read" ? act.row : act.kind === "lay" ? -1 : act.row) : -1;
  for (let r = 0; r < 3; r++) {
    const on = r === rowOn ? 0.5 + 0.5 * hi : 0;
    for (let i = 0; i <= r; i++) put(buf, 63, rowY(r) + 9 + r - 2 * i, C.pale, 0.4 + 0.6 * on);
    for (let i = 0; i <= r; i++) for (let q = 0; q < 4; q++) put(buf, GX0 + 2 + CW * r + 3 * i + (q & 1), AY0 + 2 + (q >> 1), C.pale, 0.4 + 0.6 * on);
  }

  // What the active op lights: the column it works on, the pivot column, and
  // the row whose leading number is being cleared.
  if (act && act.kind !== "lay") {
    const tgt = act.kind === "read" ? act.p : act.e;
    const col = act.kind === "read" ? cool : act.kind === "mul" ? warm : warm;
    const edge = (e, c, a) => {
      for (const x of [colX(e) - 1, colX(e) + CW - 1]) for (let y = GY0; y <= GY0 + 4 * RHT; y++) put(buf, x, y, c, a * hi);
    };
    edge(tgt, col, 0.75);
    if (act.kind === "read") for (const x of [GX0 + CW * act.row, GX0 + CW * (act.row + 1)]) for (let y = AY0; y <= AY0 + AH; y++) put(buf, x, y, warm, 0.75 * hi);
    if (act.kind === "sub") edge(act.p, cool, 0.75);
    const bands = act.kind === "read" ? [[act.p, act.row], [act.p, 3]] : [[act.e, act.row], [act.p, act.row]];
    if (act.kind === "mul") bands.pop();
    for (const [e, r] of bands) for (let y = rowY(r) + 1; y < rowY(r + 1); y++) for (let x = colX(e); x < colX(e) + 19; x++) tint(buf, x, y, e === tgt ? col : cool, 0.13 * hi);
    // The strip above the board: what is being done to which column.
    const sx = (e) => colX(e);
    if (act.kind === "mul") {
      for (let i = 0; i < 5; i++) {
        put(buf, sx(act.e) + 1 + i, 3 + i, C.pale, hi);
        put(buf, sx(act.e) + 5 - i, 3 + i, C.pale, hi);
      }
      const R = ROD[0][act.m];
      for (const r of R.r) rod(buf, sx(act.e) + 9 + r.x, 1 + r.y, r.len, r.v, 1, C.pos, hi);
    } else if (act.kind === "sub") {
      for (let i = 0; i < 5; i++) put(buf, sx(act.e) + 1 + i, 5, C.pale, hi);
      if (act.s < 0) for (let i = 0; i < 5; i++) put(buf, sx(act.e) + 3, 3 + i, C.pale, hi);
      for (let i = 0; i < act.k; i++) rod(buf, sx(act.e) + 9 + 2 * i, 2, 7, 1, 1, i <= act.j ? C.pos : C.grid, i <= act.j ? 1 : 1.5);
      const rows = ["#######", ".#####.", "..###..", "...#..."];
      for (let r = 0; r < 4; r++) for (let q = 0; q < 7; q++) if (rows[r][q] === "#") put(buf, sx(act.p) + 6 + q, 3 + r, C.neg, hi);
    }
  }

  // The board.
  for (let e = 0; e < 3; e++) {
    const lay = P.ops[e], laid = t >= lay.t0 + lay.dur;
    for (let r = 0; r < 4; r++) {
      const i = e * 4 + r;
      let a = vals[i], b = vals[i], mm = 0, fl = cl(1 - (t - lastCh[i]) / 0.4, 0, 1) * 0.6, blank = false;
      if (act && act.before[i] !== act.after[i]) {
        a = act.before[i];
        b = act.after[i];
        blank = act.kind === "lay";
        mm = blank ? cl(m * 1.5 - 0.15 * r, 0, 1) : m;
        fl = 0.6 * sm(mm);
      }
      if (a === 0 && b === 0) {
        if (mode === 2 && laid) glyphAt(buf, 0, colX(e) + 10, rowY(r) + 5, C.pos, fade * 0.55);
        continue;
      }
      number(buf, colX(e), rowY(r) + 9, a, b, mm, fl, mode, C, fade, false, blank);
      // A carry, or a borrow, runs between the places as a spark.
      const ta = dig(a)[1], tb = dig(b)[1];
      if (mode !== 2 && !blank && mm > 0 && mm < 1 && ta !== tb && dig(a)[0] !== dig(b)[0]) {
        const s0 = sm((mm - 0.2) / 0.6), dx = tb > ta ? -1 : 1, x0 = colX(e) + (dx < 0 ? 13 : 4), x1 = colX(e) + (dx < 0 ? 4 : 13);
        for (let q = 0; q < 3; q++) put(buf, round(x0 + (x1 - x0) * s0) - dx * q, rowY(r) + 9, [255, 255, 255], sin(PI * s0) * (1 - q * 0.3) * fade);
      }
    }
  }

  // The answers, read off the bottom: numerator over denominator.
  for (let r = 0; r < 3; r++) {
    if (ansM[r] < 0) {
      const xi = GX0 + 1 + CW * r;
      for (let i = 0; i < 9; i++) put(buf, xi + 5 + i, AY0 + 21, C.grid, 1);
      continue;
    }
    const xi = GX0 + 1 + CW * r, q = P.x[r], mm = ansM[r];
    const fl = mm < 1 ? 0.6 * sm(mm) : cl(1 - (t - ansEnd[r]) / 0.4, 0, 1) * 0.6;
    if (q[1] === 1) number(buf, xi, AY0 + 18, 0, q[0], mm, fl, mode, C, fade, true, true);
    else {
      number(buf, xi, AY0 + 12, 0, q[0], mm, fl, mode, C, fade, true, true);
      for (let i = 0; i < 11; i++) put(buf, xi + 4 + i, AY0 + 21, C.pale, 0.9 * sm((mm - 0.2) / 0.5) * fade);
      number(buf, xi, AY0 + 29, 0, q[1], mm, fl, mode, C, fade, true, true);
    }
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, round(cl(buf[o], 0, 255)), round(cl(buf[o + 1], 0, 255)), round(cl(buf[o + 2], 0, 255)));
    }
}
