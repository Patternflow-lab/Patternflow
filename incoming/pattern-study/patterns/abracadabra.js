// ===== Patternflow pattern =====
// Title:   Abracadabra
// Family:  type
// Idea:    The fever charm from Serenus Sammonicus stands down all 128 rows as eleven lines of ABRACADABRA, one letter shorter each line, and a fever runs down through it again and again, writing each line hot as it passes, while the one letter each line leaves out flares, burns, cools to ash and crumbles to a faint scorch, until only the last A carries the heat off the foot of the panel.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the ABRACADABRA cone in Quintus Serenus Sammonicus, Liber Medicinalis (usually dated to the early 3rd century AD), pattern round 73
// Round:   73
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Form=0..2, Cooling=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together: at 0 the fever is hot pink going white where it is hottest, the written lines a pale teal, the letter each line leaves out burns amber, and its ash is a grey blue.
// Knob 2: Speed. The fever crosses one line a beat: 0.6 s at 2, so it goes down the 128 rows in 6.6 s and comes round again every 8.4 s; ten times slower at 0.2 and half again as fast at 3.
// Knob 3: Form. Which end of the line loses its letter, rounded to 0, 1 or 2. 0 drops the last letter, the staircase whose left column reads eleven A's; 1 drops the first, the mirrored staircase; 2 drops the last and the first in turn, the centred cone that ends on the A in the middle of the word. Every letter stays in its own column, so the three forms end on an A.
// Knob 4: Cooling. How long the heat stays behind the fever: at 0.06 a line is back to ink a beat or so after it was written and the ash of a left-out letter has crumbled to its scorch 3 to 5 beats after it caught; at 1 the cone stays pink about 4 beats behind the front and the ash crumbles over 6 to 17 beats, so about a third of it is still there when the next fever comes round.

const W = 64, H = 128, NP = W * H;
const { floor, round, min, max, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Letters. The word needs five: A B R C D. Eleven letters must fit 64
// columns, so each is 4 wide on a 5 LED pitch (54 columns, 5 spare on each
// side) and 9 tall, one stroke wide. A line has 11.64 rows, so the eleven
// lines fill the 128 rows with 2 or 3 dark rows between them.
const GLYPH = {
  A: [".##.", "#..#", "#..#", "#..#", "####", "#..#", "#..#", "#..#", "#..#"],
  B: ["###.", "#..#", "#..#", "#..#", "###.", "#..#", "#..#", "#..#", "###."],
  R: ["###.", "#..#", "#..#", "#..#", "###.", "#.#.", "#..#", "#..#", "#..#"],
  C: [".##.", "#..#", "#...", "#...", "#...", "#...", "#...", "#..#", ".##."],
  D: ["###.", "#..#", "#..#", "#..#", "#..#", "#..#", "#..#", "#..#", "###."],
};
const WORD = "ABRACADABRA", N = 11, GW = 4, GH = 9, X0 = 5, PX = 5, LH = H / N;
const TOP = [];
for (let i = 0; i < N; i++) TOP.push(round(i * LH + (LH - GH) / 2));
// Rows 1, 13, 25, 36, 48, 60, 71, 83, 94, 106, 118: the last line ends on row 126.

// Every place in the 11 by 11 grid: line i, column j holds WORD[j], always in
// the same column, so a line that loses its first letter does not shift.
// pix lists the lit LEDs of each place; rnd is a fixed number per LED that
// sets when that LED of an ash letter crumbles.
const CELL = [];
for (let i = 0; i < N; i++)
  for (let j = 0; j < N; j++) {
    const g = GLYPH[WORD[j]], pix = [];
    for (let r = 0; r < GH; r++)
      for (let c = 0; c < GW; c++) if (g[r][c] === "#") pix.push((TOP[i] + r) * W + X0 + PX * j + c);
    CELL.push({ i, j, pix });
  }
function hash(n) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const RND = new Float32Array(NP);
for (let p = 0; p < NP; p++) RND[p] = hash(p + 17);

// ---- The forms. Line i keeps the columns a..b of the word. L[j] is the line
// on which column j is left out, the line its letter burns on; the column
// that is never left out gets 11, below the last line. Staircase: line i
// keeps 0..10-i, so L = 11, 10, 9, ..., 1 and the letters burn in the order
// A R B A D A C A R B, the word backwards, with the first A left to carry the
// last of the heat. Mirrored: line i keeps i..10. Cone: the last and the
// first in turn, line i keeps floor(i/2)..10-ceil(i/2), and the middle A,
// column 5, is left.
const FORMS = [0, 1, 2].map((f) => {
  const L = new Int8Array(N).fill(N);
  for (let i = N - 1; i >= 0; i--) {
    const a = f === 0 ? 0 : f === 1 ? i : floor(i / 2), b = f === 0 ? N - 1 - i : f === 1 ? N - 1 : N - 1 - Math.ceil(i / 2);
    for (let j = 0; j < N; j++) if (j < a || j > b) L[j] = i;
  }
  let last = 0;
  for (let j = 0; j < N; j++) if (L[j] === N) last = j;
  return { L, last };
});
// Checked: every form keeps 11 - i letters on line i (66 in all), burns one
// letter on each of lines 1..10, and leaves an A: column 0, 10 or 5.
for (const F of FORMS) {
  for (let i = 0; i < N; i++) {
    let k = 0, burn = 0;
    for (let j = 0; j < N; j++) (k += i < F.L[j] ? 1 : 0), (burn += i === F.L[j] ? 1 : 0);
    if (k !== N - i || burn !== (i ? 1 : 0)) throw new Error("Abracadabra form is off at line " + i);
  }
  if (WORD[F.last] !== "A") throw new Error("Abracadabra does not end on an A");
}

// ---- Time, in beats. The fever's front is at row (beat - 0.5) * 11.64, so
// it crosses one line a beat, enters the top half a beat into the cycle and
// leaves the foot at 11.5. The cycle is 14 beats; the last 2.5 are the heat
// leaving under the last A and the ash crumbling. A fresh start comes in at
// beat 2.6, with the first two lines already written and burning.
const CYCLE = 14, ENTER = 0.5, START = 2.6;
const INLINE = new Uint8Array(H);
for (const t of TOP) for (let r = 0; r < GH; r++) INLINE[t + r] = 1;
const lineOf = (y) => {
  // The line the front is going to at row y: the gap above a line counts as that line's.
  for (let i = 0; i < N; i++) if (y <= TOP[i] + GH - 1) return i;
  return N;
};

export function setup(params) {
  params.s = {
    beat: START, hue: 0, form: 0, cool: 0.06, t: 0,
    rgb: new Float32Array(NP * 3), glow: new Float32Array(NP), tmp: new Float32Array(NP),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  const speed = cl(k[1], 0.2, 3);
  S.form = cl(round(k[2]), 0, 2);
  S.cool = cl(k[3], 0, 1);
  // One beat is 1.2 / Speed seconds: 0.6 s at 2.
  S.beat += (d * speed) / 1.2;
  S.t += d;
}

function blur(src, tmp) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      tmp[p] = (2 * src[p] + (x > 0 ? src[p - 1] : 0) + (x < W - 1 ? src[p + 1] : 0)) / 4;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      src[p] = (2 * tmp[p] + (y > 0 ? tmp[p - W] : 0) + (y < H - 1 ? tmp[p + W] : 0)) / 4;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, glow } = S, F = FORMS[S.form];
  const tau = ((S.beat % CYCLE) + CYCLE) % CYCLE, Y = (tau - ENTER) * LH;
  const hF = 0.9 + S.hue;
  const inkF = hsv(hF + 0.58, 0.45, 0.74), ember = hsv(hF, 0.85, 1), white = hsv(hF, 0.1, 1);
  const flare = hsv(hF + 0.2, 0.15, 1), flame = hsv(hF + 0.2, 0.75, 1);
  const ash = hsv(hF + 0.72, 0.3, 0.34), speck = hsv(hF + 0.04, 0.7, 0.9), scorch = hsv(hF + 0.72, 0.3, 0.125);
  // The heat in a written letter falls by a factor e every tk beats; an LED of
  // ash lasts 2.4 + ta * (0.3 + its own number 0..1) beats after it caught.
  const tk = 0.8 + 3.2 * S.cool, ta = 1.5 + 10 * S.cool;
  // Embers flicker 12 times a second, each LED on its own.
  const fl = floor(S.t * 12);
  rgb.fill(0);
  glow.fill(0);
  const put = (p, c, v) => {
    rgb[p * 3] = c[0] * v, rgb[p * 3 + 1] = c[1] * v, rgb[p * 3 + 2] = c[2] * v;
  };
  // Beats since the front last passed row y: this cycle's pass, or the last one's.
  const since = (y) => {
    const s = (Y - y) / LH;
    return s < 0 ? s + CYCLE : s;
  };

  for (const C of CELL) {
    const Lj = F.L[C.j];
    if (C.i > Lj) continue;
    if (C.i < Lj) {
      // A kept letter: written hot as the front goes through it row by row,
      // then cooling back to ink, which fades from 100% to 64% over the
      // cycle (e every 5 beats), so the lines the fever has just written
      // stand out from the ones it is coming to.
      for (const p of C.pix) {
        const s = since(floor(p / W));
        const h = s < 0.12 ? s / 0.12 : exp(-(s - 0.12) / tk), m = 0.62 + 0.38 * exp(-s / 5);
        const ink = [inkF[0] * m, inkF[1] * m, inkF[2] * m];
        let c;
        if (h > 0.55) {
          const u = (h - 0.55) / 0.45;
          c = [ember[0] + (white[0] - ember[0]) * u, ember[1] + (white[1] - ember[1]) * u, ember[2] + (white[2] - ember[2]) * u];
        } else {
          const u = h / 0.55;
          c = [ink[0] + (ember[0] - ink[0]) * u, ink[1] + (ember[1] - ink[1]) * u, ink[2] + (ember[2] - ink[2]) * u];
        }
        put(p, c, 255);
        glow[p] += h;
      }
      continue;
    }
    // The letter this line leaves out burns in a colour of its own, a fifth
    // of the wheel past the fever (amber at Hue 0): white for 0.4 beat as the
    // front reaches it, a flickering flame for a beat, then by beat 2.4 it
    // cools to ash, turning back round the wheel through the fever's pink so
    // it never passes through a dim orange. Each LED then crumbles at its own
    // time, lighting once more as it goes and leaving a scorch at 32 of 255
    // that the next fever burns again.
    for (const p of C.pix) {
      const s = since(floor(p / W)), r = RND[p], life = 2.4 + ta * (0.3 + r);
      if (s > life) put(p, scorch, 255);
      else if (s < 0.4) {
        put(p, flare, 255);
        glow[p] += 2;
      } else if (s < 1.4) {
        const f = 0.45 + 0.55 * hash(p * 31 + fl);
        put(p, flame, 255 * f);
        glow[p] += 1.4 * f;
      } else if (s < 2.4) {
        const u = s - 1.4;
        put(p, hsv(hF + 0.2 - 0.48 * u, 0.75 - 0.45 * u, 1 - 0.66 * u), 255);
        glow[p] += 0.6 * (1 - u);
      } else if (s > life - 0.3) {
        put(p, speck, 255 * (0.5 + 0.5 * hash(p * 7 + fl)));
        glow[p] += 0.4;
      } else put(p, ash, 255);
    }
  }

  // ---- The front: a drop of heat in every column still carrying it, which
  // is every column whose letter has not yet been left out above this row.
  // It shows only in the dark rows between lines (inside a line the letter
  // itself lights row by row), and the survivor's runs on off the foot.
  const lf = lineOf(Y);
  if (Y > -2 && Y < H + 2)
    for (let j = 0; j < N; j++) {
      if (F.L[j] < lf) continue;
      const cx = X0 + PX * j + 1.5;
      for (let dy = -4; dy <= 1; dy++) {
        const y = floor(Y) + dy;
        if (y < 0 || y >= H || INLINE[y]) continue;
        const v = dy > 0 ? 0.5 : exp(dy / 1.6);
        for (const x of [floor(cx), floor(cx) + 1]) {
          const p = y * W + x;
          glow[p] += 1.2 * v;
          rgb[p * 3] = max(rgb[p * 3], white[0] * 255 * v);
          rgb[p * 3 + 1] = max(rgb[p * 3 + 1], white[1] * 255 * v);
          rgb[p * 3 + 2] = max(rgb[p * 3 + 2], white[2] * 255 * v);
        }
      }
    }

  // ---- The heat off the foot: once the front has left row 127 the last of
  // the fever spreads along the foot under the last A and fades in 2 beats.
  const sb = (Y - H) / LH;
  if (sb > 0 && sb < 3) {
    const xs = X0 + PX * F.last + 1.5, wdt = 4 + 12 * sb, a = exp(-sb / 1.1) * 3;
    for (let y = H - 14; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = a * exp(-(((x + 0.5 - xs) / wdt) ** 2)) * exp(-(H - 0.5 - y) / (1.5 + 2.5 * sb));
        if (v > 0.02) glow[y * W + x] += v;
      }
  }

  // Heat glows round itself in the fever's colour.
  blur(glow, S.tmp);
  blur(glow, S.tmp);
  for (let p = 0; p < NP; p++) {
    const g = min(1.6, glow[p]) * 140, o = p * 3;
    if (g < 1) continue;
    rgb[o] += ember[0] * g, rgb[o + 1] += ember[1] * g, rgb[o + 2] += ember[2] * g;
  }

  for (let p = 0; p < NP; p++) {
    const o = p * 3, r = rgb[o], g = rgb[o + 1], b = rgb[o + 2];
    if (r < 1 && g < 1 && b < 1) continue;
    display.setPixel(p % W, (p - (p % W)) / W, min(255, r) | 0, min(255, g) | 0, min(255, b) | 0);
  }
}
