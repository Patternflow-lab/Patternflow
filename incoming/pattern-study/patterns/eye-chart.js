// ===== Patternflow pattern =====
// Title:   Eye Chart
// Family:  type
// Idea:    A back-lit letter chart stands the full height of the panel, eight rows of Sloan letters from one letter 25 LEDs tall down to five letters 5 LEDs tall with one LED to a stroke, each row 1.26 times the one below as on a logMAR chart, and lens after lens wipes across it as in a phoropter, blurring the chart by a disc as wide as the defocus that lens leaves, while a pointer reads down the rows letter by letter, marking blue the letters a noisy reader still tells apart from the ten letters blurred the same way and red the ones it takes for another, and stops at the row it fails, until the last lens of the series leaves the chart sharp, the black occluder sweeps across and a new chart goes up.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Snellen chart (Herman Snellen, Optotypi ad visum determinandum, 1862), the ten Sloan letters (Louise Sloan, 1959) and the logMAR chart's rows a tenth of a log unit apart (Ian Bailey and Jan Lovie, 1976), the letters drawn for this pattern on Sloan's 5 by 5 grid, pattern round 74
// Round:   74
// ===============================
// @matrix 64x128
// @knobs Error=0.5..2.5, Speed=0.2..3, Glare=0..1, Duochrome=0..1
//
// Knob 1: Error. The eye's myopia, 0.5 to 2.5 diopters. One LED is one minute of arc and the pupil 3 mm, so each diopter left uncorrected blurs the chart by a disc 5.2 LEDs in radius. A series of lenses closes in on the error: at 0.5 they are 0, 0.25, 0.5, 0.75 and 0.5 diopters, blur radii 2.6, 1.3, 0, 1.3 and 0, and the bare eye reads down to the 10 or 7.9 LED row; at 2.5 the bare eye sees a disc 12.9 LEDs in radius and fails even the top letter, and the series takes 7 lenses.
// Knob 2: Speed. At 2 a lens wipes in over 0.45 s, the reader looks for 0.35 s, spends 0.18 s on a letter and holds its result 0.8 s (2.2 s after the last lens), so a lens takes 3 to 4 s and a series of five about 22 s. At 0.2 all of it is ten times slower, at 3 two thirds as long.
// Knob 3: Glare. A veil of light over the chart: at 0 the letters are black, at 1 they keep 35 percent of their contrast, and the reader sees that too. Through the right lens it still gets nine letters in ten on the 5 LED row, but a quarter diopter off it stops at the 7.9 LED row where it read to the bottom, and half a diopter off at the 12.6 or 15.8 row instead of the 10.
// Knob 4: Duochrome. Up from 0.1 the light box turns red on the left half and green on the right, fully at 1. The eye focuses red behind green, half a diopter apart, so the red half is blurred as by a quarter diopter less myopia and the green as by a quarter more: red sharper while the lens is too weak, green sharper when it is too strong, both equally soft at the right one.
// Buttons: K1 tap starts a new series on a new chart.

// A letter is legible when what the eye sees of it is closer to that letter
// than to any of the other nine. The reader here does that literally: it
// blurs the patch of chart around the letter with the same disc, blurs each
// of the ten Sloan letters alone at the same size and place, and takes the
// one with the smallest difference, summed over the LEDs with exponent 4
// (Minkowski pooling, as models of threshold vision add up small
// differences), after adding noise to each distance. A sharp C and O differ
// by one LED at the bottom row; blurred by a disc of radius 1.3 that LED is
// spread over eight, and the reader starts to confuse them.
//
// The eye is myopic and does not accommodate, so a lens a quarter diopter
// too strong blurs it as much as one a quarter too weak.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, sqrt, pow, log, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// Defocus blur: a disc of angular diameter pupil x diopters radians. With a
// 3 mm pupil and one LED to a minute of arc, 5.16 LEDs of radius a diopter.
const KAPPA = 0.003 * (180 / PI) * 60 * 0.5;
const NOISE = 0.2;
// Timings at Speed 2.
const T_FLIP = 0.45, T_LOOK = 0.35, T_LETTER = 0.18, T_HOLD = 0.8, T_LAST = 2.2;

// ---- The ten Sloan letters. At the bottom row, 5 LEDs tall, each is a 5x5
// bitmap, one LED to a stroke (16 is the left column, rows from the top).
// The C is the Landolt ring with its gap to the right, one stroke wide, so C
// and O differ by one LED there.
const SLOAN = "CDHKNORSVZ";
const BITS = [
  14, 17, 16, 17, 14,
  30, 17, 17, 17, 30,
  17, 17, 31, 17, 17,
  17, 18, 28, 18, 17,
  17, 25, 21, 19, 17,
  14, 17, 17, 17, 14,
  30, 17, 30, 18, 17,
  15, 16, 14, 1, 30,
  17, 17, 17, 10, 4,
  31, 2, 4, 8, 31,
];
// Bigger rows draw the same letters from shapes on the 5 by 5 grid, one unit
// to a stroke: boxes, elliptical rings and straight bars.
const box = (u, v, x0, y0, x1, y1) => u >= x0 && u <= x1 && v >= y0 && v <= y1;
function ring(u, v, cx, cy, ao, bo, ai, bi) {
  const x = u - cx, y = v - cy;
  return (x * x) / (ao * ao) + (y * y) / (bo * bo) <= 1 && (x * x) / (ai * ai) + (y * y) / (bi * bi) >= 1;
}
function bar(u, v, ax, ay, bx, by, hw) {
  const dx = bx - ax, dy = by - ay, t = cl(((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  const ex = u - ax - t * dx, ey = v - ay - t * dy;
  return ex * ex + ey * ey <= hw * hw;
}
const O_ = (u, v) => ring(u, v, 2.5, 2.5, 2.5, 2.5, 1.5, 1.5);
function inside(c, u, v) {
  switch (c) {
    case 0: return O_(u, v) && !(u > 2.5 && abs(v - 2.5) < 0.5);
    case 1: return box(u, v, 0, 0, 1, 5) || (u <= 2.5 ? box(u, v, 0, 0, 2.5, 1) || box(u, v, 0, 4, 2.5, 5) : O_(u, v));
    case 2: return box(u, v, 0, 0, 1, 5) || box(u, v, 4, 0, 5, 5) || box(u, v, 0, 2, 5, 3);
    case 3: return box(u, v, 0, 0, 1, 5) || bar(u, v, 1, 3.2, 5, -0.4, 0.56) || bar(u, v, 2.4, 2.2, 5, 5.4, 0.56);
    case 4: return box(u, v, 0, 0, 1, 5) || box(u, v, 4, 0, 5, 5) || bar(u, v, 0.6, 0, 4.4, 5, 0.6);
    case 5: return O_(u, v);
    case 6: return box(u, v, 0, 0, 1, 5) || (u <= 2.5 ? box(u, v, 0, 0, 2.5, 1) || box(u, v, 0, 2, 2.5, 3) : ring(u, v, 2.5, 1.5, 2.5, 1.5, 1.5, 0.5)) || bar(u, v, 2.6, 2.8, 4.6, 5.3, 0.56);
    case 7: return (ring(u, v, 2.5, 1.5, 2.5, 1.5, 1.5, 0.5) && !(u > 2.5 && v > 1.5)) || (ring(u, v, 2.5, 3.5, 2.5, 1.5, 1.5, 0.5) && !(u < 2.5 && v < 3.5));
    case 8: return bar(u, v, 0.5, -1, 2.5, 5, 0.6) || bar(u, v, 4.5, -1, 2.5, 5, 0.6);
    default: return box(u, v, 0, 0, 5, 1) || box(u, v, 0, 4, 5, 5) || bar(u, v, 4.3, 1, 0.7, 4, 0.6);
  }
}
// Ink coverage of letter c, h LEDs tall, its corner at (x0, y0), into buf.
function stamp(buf, bw, bh, c, x0, y0, h) {
  if (h === 5) {
    for (let r = 0; r < 5; r++)
      for (let q = 0; q < 5; q++) {
        const x = x0 + q, y = y0 + r;
        if ((BITS[c * 5 + r] >> (4 - q)) & 1 && x >= 0 && x < bw && y >= 0 && y < bh) buf[y * bw + x] = 1;
      }
    return;
  }
  const k = 5 / h;
  for (let y = max(0, floor(y0)); y < min(bh, ceil(y0 + h)); y++)
    for (let x = max(0, floor(x0)); x < min(bw, ceil(x0 + h)); x++) {
      let n = 0;
      for (let j = 0; j < 4; j++) {
        const v = (y + (j + 0.5) / 4 - y0) * k;
        if (v < 0 || v > 5) continue;
        for (let i = 0; i < 4; i++) {
          const u = (x + (i + 0.5) / 4 - x0) * k;
          if (u >= 0 && u <= 5 && inside(c, u, v)) n++;
        }
      }
      if (n) buf[y * bw + x] = max(buf[y * bw + x], n / 16);
    }
}

// ---- The chart: eight rows, logMAR 0.7 at the top to 0.0 at the bottom,
// each 10^0.1 = 1.259 times the one below: 25.1, 19.9, 15.8, 12.6, 10, 7.9,
// 6.3 and 5 LEDs. Letters stand one letter width apart as Bailey and Lovie
// spaced them, so a row holds as many as fit, 1 at the top and 5 below 7
// LEDs. Rows sit about 3 LEDs apart with the pointer's line in the gap.
const ROWS = (() => {
  const hs = [];
  for (let k = 7; k >= 0; k--) {
    const h = 5 * pow(10, k / 10);
    hs.push(abs(h - round(h)) < 0.06 ? round(h) : h);
  }
  const gap = (125 - hs.reduce((a, b) => a + b, 0)) / 7, rows = [];
  let y = 0;
  for (let i = 0; i < 8; i++) {
    const h = hs[i], top = round(y), n = min(5, floor((62 / h + 1) / 2)), left = (W - (2 * n - 1) * h) / 2, xs = [];
    for (let j = 0; j < n; j++) xs.push(round(left + 2 * j * h));
    rows.push({ h, top, n, xs, w: max(1, round(h)), mark: round(top + h + gap / 2 - 0.5) });
    y += h + gap;
  }
  return rows;
})();

// ---- Disc blur. Each row of the disc is a span of the image row, summed
// from prefix sums at fractional ends, so the disc grows smoothly with its
// radius; rows near the rim come in with partial weight. Off the panel is
// no ink.
function kernel(r) {
  const R = ceil(r + 0.5), dy = [], hw = [], wt = [];
  let norm = 0;
  for (let d = -R; d <= R; d++) {
    const w = d === 0 ? 1 : cl(r - abs(d) + 0.5, 0, 1);
    if (w <= 0) continue;
    const h = sqrt(max(0, r * r - d * d));
    dy.push(d), hw.push(h), wt.push(w);
    norm += w * (2 * h + 1);
  }
  return { dy, hw, wt, inv: 1 / norm, R };
}
function prefix(src, w, h, pre) {
  for (let y = 0; y < h; y++) {
    const o = y * (w + 1);
    let a = 0;
    pre[o] = 0;
    for (let x = 0; x < w; x++) pre[o + x + 1] = a += src[y * w + x];
  }
}
// Ink of row y from 0 to t.
function upto(src, pre, w, y, t) {
  if (t <= 0) return 0;
  if (t >= w) return pre[y * (w + 1) + w];
  const i = t | 0;
  return pre[y * (w + 1) + i] + (t - i) * src[y * w + i];
}
function blurAt(src, pre, w, h, x, y, K) {
  let s = 0;
  for (let k = 0; k < K.dy.length; k++) {
    const yy = y + K.dy[k];
    if (yy < 0 || yy >= h) continue;
    s += K.wt[k] * (upto(src, pre, w, yy, x + 1 + K.hw[k]) - upto(src, pre, w, yy, x - K.hw[k]));
  }
  return s * K.inv;
}

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(2 * PI * Math.random());
}

// A new chart: each row draws its letters without repeating one.
function newChart(s) {
  s.chart = ROWS.map((row) => {
    const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 9; i > 0; i--) {
      const j = floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, row.n);
  });
  s.ink.fill(0);
  ROWS.forEach((row, i) => row.xs.forEach((x, j) => stamp(s.ink, W, H, s.chart[i][j], x, row.top, row.h)));
  prefix(s.ink, W, H, s.pre);
  s.tkey = -1;
}

// The lenses a series tries for an error E, in quarter diopters: none, half
// of E, three quarters, then up a quarter at a time to E, one too strong,
// and back to E.
function plan(E) {
  const q = (v) => round(v * 4) / 4, out = [0];
  const push = (v) => out[out.length - 1] !== v && out.push(v);
  push(q(E / 2));
  push(q((3 * E) / 4));
  for (let v = out[out.length - 1] + 0.25; v < q(E) - 1e-6; v += 0.25) push(v);
  push(q(E));
  push(q(E) + 0.25);
  push(q(E));
  return out;
}

// A new series starts behind the occluder, the phoropter's black disc: a
// new chart goes up and the first lens, none, wipes in from the dark.
function newSeries(s) {
  newChart(s);
  s.Eplan = s.E;
  s.lenses = plan(s.E);
  s.li = 0;
  s.L = 0;
  s.best = -1;
  clearMarks(s);
  s.dark = true;
  s.phase = "flip";
  s.pt = 0;
}
function clearMarks(s) {
  s.marks = ROWS.map((row) => new Array(row.n).fill(0));
  s.ri = -1;
  s.lj = -1;
}

// The blur radius a lens of power P leaves, on the red (-1), plain (0) or
// green (+1) side.
const radius = (s, P, side) => KAPPA * abs(s.E - P + side * 0.25 * s.u);

// The reader's answer for letter j of row ri. It looks at the letter's own
// cell: its box, a LED above and below (the rows are 3 LEDs apart) and half
// a letter to each side, where its neighbours' blur can reach in and crowd it.
function read(s, ri, j) {
  const row = ROWS[ri], h = row.h, x0 = row.xs[j], y0 = row.top;
  const f = cl((32 - x0) / h, 0, 1);
  const r = f * radius(s, s.L, -1) + (1 - f) * radius(s, s.L, 1);
  const K = kernel(r), M = K.R + 1, n = ceil(h) + 2 * M, T = s.tpl;
  const ex = min(M, ceil(h / 2)), wx = M - ex, wy = M - 1, ww = ceil(h) + 2 * ex, wh = ceil(h) + 2;
  const key = ri * 100000 + round(r * 200);
  if (s.tkey !== key) {
    s.tkey = key;
    for (let c = 0; c < 10; c++) {
      s.ink2.fill(0, 0, n * n);
      stamp(s.ink2, n, n, c, M, M, h);
      prefix(s.ink2, n, n, s.pre2);
      for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) T[c][y * ww + x] = blurAt(s.ink2, s.pre2, n, n, wx + x, wy + y, K);
    }
  }
  const P = s.patch;
  for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) P[y * ww + x] = blurAt(s.ink, s.pre, W, H, x0 - M + wx + x, y0 - M + wy + y, K);
  let best = 0, bs = 1e9;
  for (let c = 0; c < 10; c++) {
    let d4 = 0;
    for (let i = 0; i < ww * wh; i++) {
      const e = s.c * (P[i] - T[c][i]), e2 = e * e;
      d4 += e2 * e2;
    }
    const score = sqrt(sqrt(d4)) + NOISE * gauss();
    if (score < bs) (bs = score), (best = c);
  }
  return best;
}

export function setup(params) {
  const s = (params.s = {
    E: 0.5, c: 1, u: 0, L: 0, Lold: 0, pt: 0, phase: "flip", dark: true, btn: false,
    ink: new Float32Array(W * H), pre: new Float32Array(H * (W + 1)),
    ink2: new Float32Array(64 * 64), pre2: new Float32Array(64 * 65), patch: new Float32Array(64 * 64),
    tpl: Array.from({ length: 10 }, () => new Float32Array(64 * 64)),
    rgb: new Float32Array(W * H * 3), colK: new Array(W), colDark: new Uint8Array(W), started: false,
  });
  return s;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0.5, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  s.E = cl(k[0] == null ? 0.5 : k[0], 0.5, 2.5);
  const sc = 2 / cl(k[1] == null ? 2 : k[1], 0.2, 3);
  s.c = 1 - 0.65 * cl(k[2] || 0, 0, 1);
  s.u = smooth((cl(k[3] == null ? 0.06 : k[3], 0, 1) - 0.1) / 0.9);
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  // A new error or a tap closes the occluder for a new series.
  if (!s.started) (s.started = true), newSeries(s);
  else if (((btn && !s.btn) || abs(s.E - s.Eplan) > 0.1) && s.phase !== "close") (s.phase = "close"), (s.pt = 0);
  s.btn = btn;
  s.pt += d;
  if (s.phase === "close") {
    if (s.pt >= T_FLIP * sc) newSeries(s);
  } else if (s.phase === "flip") {
    if (s.pt >= T_FLIP * sc) (s.phase = "look"), (s.pt = 0), (s.Lold = s.L), (s.dark = false);
  } else if (s.phase === "look") {
    if (s.pt >= T_LOOK * sc) {
      s.phase = "read";
      s.pt = 0;
      s.ri = s.li === 0 ? 0 : max(0, min(s.best, 6) - 1);
      s.lj = 0;
      s.marks[s.ri][0] = read(s, s.ri, 0) === s.chart[s.ri][0] ? 1 : 2;
      s.best = -1;
    }
  } else if (s.phase === "read") {
    if (s.pt >= T_LETTER * sc) {
      s.pt = 0;
      const row = ROWS[s.ri];
      if (++s.lj >= row.n) {
        // More than half right passes the row.
        const right = s.marks[s.ri].filter((m) => m === 1).length;
        if (right * 2 > row.n) s.best = s.ri;
        if (right * 2 > row.n && s.ri < 7) (s.ri++), (s.lj = 0);
        else return void ((s.phase = "hold"), (s.lj = -1));
      }
      s.marks[s.ri][s.lj] = read(s, s.ri, s.lj) === s.chart[s.ri][s.lj] ? 1 : 2;
    }
  } else if (s.pt >= (s.li === s.lenses.length - 1 ? T_LAST : T_HOLD) * sc) {
    if (s.li === s.lenses.length - 1) return void ((s.phase = "close"), (s.pt = 0));
    s.li++;
    s.Lold = s.L;
    s.L = s.lenses[s.li];
    const keep = s.best;
    clearMarks(s);
    s.best = keep;
    s.phase = "flip";
    s.pt = 0;
  }
  s.sc = sc;
}

export function draw(display, params) {
  const s = params.s;
  if (!s || !s.started) return;
  const sc = s.sc || 1;
  // A lens wipes in from the left: columns it has passed see the new one,
  // the rest the old lens, or the dark of the occluder.
  const moving = s.phase === "flip" || s.phase === "close";
  const wipe = moving ? -6 + 76 * smooth(s.pt / (T_FLIP * sc)) : 999;
  const Ks = [[kernel(radius(s, s.Lold, -1)), kernel(radius(s, s.Lold, 1))], [kernel(radius(s, s.L, -1)), kernel(radius(s, s.L, 1))]];
  const red = [255, 36, 18], green = [40, 255, 70], white = [255, 246, 232], u = s.u, c = s.c, rgb = s.rgb;
  for (let x = 0; x < W; x++) {
    const passed = x < wipe;
    s.colDark[x] = s.phase === "close" ? +passed : s.phase === "flip" && s.dark ? +!passed : 0;
    s.colK[x] = Ks[passed || s.phase === "close" ? 1 : 0][x < 32 ? 0 : 1];
  }
  for (let y = 0; y < H; y++) {
    const vy = (y - 63.5) / 64;
    for (let x = 0; x < W; x++) {
      if (s.colDark[x]) {
        rgb.fill(0, (y * W + x) * 3, (y * W + x) * 3 + 3);
        continue;
      }
      const b = blurAt(s.ink, s.pre, W, H, x, y, s.colK[x]);
      const vx = (x - 31.5) / 32, lit = 0.8 * (1 - 0.13 * vx * vx - 0.1 * vy * vy) * (1 - c * b);
      const tint = x < 32 ? red : green, j = (y * W + x) * 3;
      let dark = 1;
      if (moving) dark = 1 - 0.6 * exp(-(((x - wipe) / 2.2) ** 2));
      for (let q = 0; q < 3; q++) rgb[j + q] = (white[q] + (tint[q] - white[q]) * u) * lit * dark;
    }
  }
  // The pointer's line: blue under a letter read right, red under a
  // mistake, amber under the letter being read.
  ROWS.forEach((row, i) => {
    row.xs.forEach((x0, j) => {
      const m = s.marks[i][j], now = s.phase === "read" && i === s.ri && j === s.lj;
      if (!m && !now) return;
      const col = now && s.pt < (T_LETTER * sc) / 2 ? [255, 150, 0] : m === 1 ? [20, 70, 255] : [235, 20, 40];
      for (let x = x0; x < min(W, x0 + row.w); x++) {
        if (s.colDark[x]) continue;
        const o = (row.mark * W + x) * 3;
        rgb[o] = col[0], rgb[o + 1] = col[1], rgb[o + 2] = col[2];
      }
    });
  });
  // The row the eye reads to through this lens, pointed at from both sides.
  if (s.best >= 0) {
    const row = ROWS[s.best], m = round(row.top + row.h / 2 - 0.5);
    for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [0, -1], [1, -1], [0, 1], [1, 1], [0, -2], [0, 2]])
      for (const x of [dx, W - 1 - dx]) {
        if (s.colDark[x]) continue;
        const o = ((m + dy) * W + x) * 3;
        rgb[o] = 20, rgb[o + 1] = 70, rgb[o + 2] = 255;
      }
  }
  for (let i = 0; i < W * H; i++) {
    const j = i * 3;
    display.setPixel(i % W, (i / W) | 0, round(cl(rgb[j], 0, 255)), round(cl(rgb[j + 1], 0, 255)), round(cl(rgb[j + 2], 0, 255)));
  }
}
