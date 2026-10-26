// ===== Patternflow pattern =====
// Title:   Euler's Officers
// Family:  cells
// Idea:    Two officer squares stand one above the other, each cell a ring in the colour of its rank and a core in the colour of its regiment: on top Euler's 36 officers in a best attempt where four cells at the corners of a rectangle repeat two pairs and pulse white, below an order-10 Graeco-Latin square where all 100 colour pairs appear once, while one regiment after another lights up to show it is a transversal of the ranks, one cell in every row, column and rank.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Euler's 36 officers problem (Leonhard Euler, 1782), no pair of order 6 (Gaston Tarry, 1900), orthogonal Latin squares of order 10, "Euler's spoilers" (R. C. Bose, S. S. Shrikhande and E. T. Parker, 1959), pattern round 60
// Round:   60
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Core=-1..1, Shuffle=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the ten ranks and regiments of the bottom square are red, orange, yellow, lime, green, teal, azure, blue, violet and magenta, and the six of the top square red, amber, green, teal, azure and purple, spread round the same wheel. Each 0.1 moves the bottom square's colours one place on; at 0.5 every colour stands opposite where it was, red turned teal.
// Knob 2: Speed. At 2 the next regiment lights up every 1.5 s, so the ten transversals of the order-10 square come round in 15 s and the six regiments of the order-6 attempt in 9 s, and the clash cells fade to white and back every 2.4 s. At 0.2 all of it is ten times slower, at 3 half as fast again.
// Knob 3: Core. How much of a cell the regiment's core takes. At -1 there is no core and each square shows only its ranks, a Latin square on its own; at -0.5 the core is the centre LED of the 5 x 5 cells below and 3 x 3 of the 9 x 9 cells on top; at 0 3 x 3 and 5 x 5; at 0.5 the bottom square shows only regiments and the top one a 7 x 7 core in a ring one LED wide; at 1 both show only the regiments, the second Latin square.
// Knob 4: Shuffle. Swaps two rows or two columns of one square, both of its Latin squares together, which keeps every pair it had: 2.4 x K4 swaps a second at Speed 2, so one every 7 s at the opening 0.06 and none at 0. A swap fades the colours of the two lines into each other over 0.4 s, round the wheel so no LED dims, and puts white ticks at their ends.

const W = 64, H = 128;
const { floor, min, max, round, cos, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The squares: R gives each cell's rank row by row, G its regiment.
// Order 6 (top) is the best a search found for Euler's officers. It took 40
// random rank squares and split each one every way into six regiments, and
// 15 of them reached 34 of the 36 pairs, 15 reached 32, three 31 and seven
// 30: a square with no transversal cannot do better than 6 x 5. 34 is the
// most there can be. Tarry's 1900 search of every case rules out 36, and 35
// cannot happen either, since five regiments that are transversals leave a
// sixth that is one too. Here the four cells in rows 1 and 5, columns 3 and
// 6 (from the top left) hold only two pairs between them, amber with green
// and red with purple at Hue 0, each twice; red with green and amber with
// purple never appear. The code below counts the pairs and marks the cells
// of every pair it meets twice.
const R6 = "231450523104015243104532450321342015";
const G6 = "012345253401301254140523435012524130";
// Order 10 (bottom): the fifth random rank square the search drew had 872
// transversals, and an exact-cover search picked 10 disjoint ones out of
// them; transversal k is regiment k. (The first four, with 804 to 892
// transversals, gave no cover inside two million steps.) All 100 pairs
// appear once, which the same count finds here.
const R10 = "8054267913170842536951360427983285679041041953867268921504379647803125792138450645739162802360791854";
const G10 = "3621054789217486039595034286171365792840573864902180429715636290135478795628310404873169524819507236";

// Ten hues placed by eye on the LED wheel, which crowds the greens: rank or
// regiment k of an order-n square sits at slot k / n + Hue, and a slot maps
// to a hue through these stops.
const STOPS = [0, 0.075, 0.15, 0.25, 0.37, 0.47, 0.56, 0.65, 0.76, 0.87, 1];
function slotHue(t) {
  t -= floor(t);
  const i = floor(t * 10), f = t * 10 - i;
  return STOPS[i] + (STOPS[i + 1] - STOPS[i]) * f;
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Both squares are 59 LEDs square at columns 2..60. The top one has cells of
// 9 x 9 LEDs at a pitch of 10, rows 2..60; the bottom one 5 x 5 at a pitch
// of 6, rows 67..125. A dark LED line runs between the cells.
function makeSquare(n, ranks, regs, oy) {
  const pitch = n === 6 ? 10 : 6, lit = pitch - 1, nn = n * n;
  const A = new Int8Array(nn), B = new Int8Array(nn), clash = new Uint8Array(nn);
  for (let i = 0; i < nn; i++) (A[i] = +ranks[i]), (B[i] = +regs[i]);
  // Orthogonality, counted: a pair met twice marks both of its cells.
  const seen = new Int16Array(nn);
  for (let i = 0; i < nn; i++) seen[A[i] * n + B[i]]++;
  let clashes = 0;
  for (let i = 0; i < nn; i++) if (seen[A[i] * n + B[i]] > 1) (clash[i] = 1), clashes++;
  const perm = () => Array.from({ length: n }, (_, i) => i);
  return {
    n, pitch, lit, ox: 2, oy, A, B, clash, clashes, rowP: perm(), colP: perm(),
    // Display cell colours as slots, with the fade of a swap.
    fromA: new Float32Array(nn), fromB: new Float32Array(nn), t0: new Float32Array(nn).fill(-9),
  };
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, core: 0, shuffle: 0.06, clock: 0, swapAcc: 0.5,
    sq: [makeSquare(6, R6, G6, 2), makeSquare(10, R10, G10, 67)],
    ticks: [], rgb: new Float32Array(W * H * 3), c: new Float32Array(6),
  };
}

const FADE = 0.4;

// The slot a display cell shows now, part way through a swap's fade.
function slotNow(S, q, i, from, to) {
  const a = cl((S.clock - q.t0[i]) / FADE, 0, 1);
  if (a >= 1) return to;
  let d = to - from;
  d -= round(d);
  return from + d * (0.5 - 0.5 * cos(PI * a));
}

function swap(S) {
  const q = S.sq[random() < 0.5 ? 0 : 1], n = q.n, rows = random() < 0.5;
  const i = floor(random() * n);
  let j = floor(random() * (n - 1));
  if (j >= i) j++;
  const P = rows ? q.rowP : q.colP;
  // Note where each touched cell's colours are, then swap the two lines.
  for (let k = 0; k < n; k++)
    for (const l of [i, j]) {
      const d = rows ? l * n + k : k * n + l;
      const r = rows ? P[l] : q.rowP[k], c = rows ? q.colP[k] : P[l];
      q.fromA[d] = slotNow(S, q, d, q.fromA[d], q.A[r * n + c] / n);
      q.fromB[d] = slotNow(S, q, d, q.fromB[d], q.B[r * n + c] / n);
      q.t0[d] = S.clock;
    }
  const t = P[i];
  P[i] = P[j];
  P[j] = t;
  S.ticks.push({ q, rows, i, j, t0: S.clock });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.core = cl(k[2], -1, 1);
  S.shuffle = cl(k[3], 0, 1);
  const ds = (d * S.speed) / 2;
  S.clock += ds;
  S.swapAcc += ds * 2.4 * S.shuffle;
  while (S.swapAcc >= 1) {
    S.swapAcc -= 1;
    swap(S);
  }
  S.ticks = S.ticks.filter((t) => S.clock - t.t0 < FADE + 0.2);
}

// How lit a regiment is: each one in turn for 1.5 s, rising and falling
// over the first and last 0.4 s.
const STEP = 1.5, FRAME = 0.25, BASE = 0.88, SAT = 0.88;
function glow(S, n, reg) {
  const u = S.clock / STEP, now = floor(u) % n;
  if (reg !== now) return 0;
  const f = u - floor(u), e = min(f, 1 - f) / (0.4 / STEP);
  return e >= 1 ? 1 : 0.5 - 0.5 * cos(PI * e);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, c = S.c;
  rgb.fill(0);
  // A cell's LED lies in the core when its square ring (Chebyshev distance
  // from the cell's centre) is under rho times half the pitch.
  const rho = (1 + S.core) / 2;
  // The clash cells fade to white and back every 2.4 s; white keeps the
  // LED at the level it had, so the pulse moves nothing on the map.
  const pulse = 0.5 - 0.5 * cos((2 * PI * S.clock) / 2.4);
  for (const q of S.sq) {
    const n = q.n, half = (q.lit - 1) / 2, rc = rho * (half + 1);
    for (let r = 0; r < n; r++)
      for (let col = 0; col < n; col++) {
        const d = r * n + col, cell = q.rowP[r] * n + q.colP[col];
        const sa = slotNow(S, q, d, q.fromA[d], q.A[cell] / n);
        const sb = slotNow(S, q, d, q.fromB[d], q.B[cell] / n);
        const g = glow(S, n, q.B[cell]);
        // Cells stand at 0.88 of full and the lit regiment at full, with a
        // faint white frame in the dark line round each of its cells.
        const v = BASE + (1 - BASE) * g;
        const whiten = q.clash[cell] ? pulse : 0;
        hsv(slotHue(sa + S.hue), SAT * (1 - whiten), v, c, 0);
        hsv(slotHue(sb + S.hue), SAT, v, c, 3);
        const x0 = q.ox + col * q.pitch, y0 = q.oy + r * q.pitch, L = q.lit;
        for (let yy = 0; yy < L; yy++)
          for (let xx = 0; xx < L; xx++) {
            const cheb = max(Math.abs(xx - half), Math.abs(yy - half));
            const p = ((y0 + yy) * W + x0 + xx) * 3, o = cheb < rc ? 3 : 0;
            // The lit regiment's centre LED turns white: one white point in
            // every row and every column.
            const wh = cheb === 0 ? g : 0;
            rgb[p] = wh * v + c[o] * (1 - wh);
            rgb[p + 1] = wh * v + c[o + 1] * (1 - wh);
            rgb[p + 2] = wh * v + c[o + 2] * (1 - wh);
          }
        if (g > 0)
          for (let k = -1; k <= L; k++)
            for (const [x, y] of [[x0 + k, y0 - 1], [x0 + k, y0 + L], [x0 - 1, y0 + k], [x0 + L, y0 + k]]) {
              const p = (y * W + x) * 3;
              rgb[p] = rgb[p + 1] = rgb[p + 2] = max(rgb[p], FRAME * g);
            }
      }
  }
  // White ticks at the two ends of each swapped row or column.
  for (const t of S.ticks) {
    const q = t.q, a = cl(1 - (S.clock - t.t0 - FADE) / 0.2, 0, 1) * 0.8;
    const span = q.n * q.pitch - 1;
    for (const l of [t.i, t.j])
      for (let s = 0; s < q.lit; s++) {
        const along = l * q.pitch + s;
        const ends = t.rows
          ? [[0, q.oy + along], [1, q.oy + along], [q.ox + span + 1, q.oy + along], [q.ox + span + 2, q.oy + along]]
          : [[q.ox + along, q.oy - 1], [q.ox + along, q.oy + span + 1]];
        for (const [x, y] of ends) {
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const p = (y * W + x) * 3;
          rgb[p] = rgb[p + 1] = rgb[p + 2] = max(rgb[p], a);
        }
      }
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3)
      display.setPixel(x, y, round(rgb[p] * 255), round(rgb[p + 1] * 255), round(rgb[p + 2] * 255));
}
