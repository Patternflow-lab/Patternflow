// ===== Patternflow pattern =====
// Title:   Flipdot
// Family:  type
// Idea:    A bus destination sign of fluorescent flip discs stands on end, the route number in its own box above the destination, and between pages a wave of discs flips the whole board yellow and back, each disc showing a thin edge as it turns.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 22, after the electromagnetic flip-disc destination signs on buses and trams from the 1970s on
// Round:   22
// ===============================
// @matrix 64x128
// @knobs Disc=0..1, Speed=0.2..3, Route=0..3, Wipe=0..3
//
// Knob 1: Disc. The colour painted on the bright side of the discs: fluorescent yellow at 0, then lime green, white, amber and red at 1.
// Knob 2: Speed. How fast the sign runs its pages and its waves: at 2 the destination holds three seconds, the stops a little over two, and a wave crosses the board in under a second.
// Knob 3: Route. Which bus the sign is set for, each with its own number, destination and stops: the 17 to Pier Head, the 7 to Dock Yard, the N9 night bus and the X3 express to Sea Wall.
// Knob 4: Wipe. How the controller drives the discs between pages: column by column at 0, a diagonal at 1, a scatter of single discs at 2, row by row at 3.
// Buttons: K1 tap ends the page now and the next wave starts.

const W = 64;
const H = 128;
const N = W * H;
const { min, max, floor, round } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The board: 20 discs across and 40 down on a 3 LED pitch, each disc 2 by 2
// LEDs with one dark LED between. The top box holds 16 rows for the route
// number; a housing bar; then 24 rows for the destination.
const COLS = 20;
const R1 = 16;
const R2 = 24;
const ROWS = R1 + R2;
const ND = COLS * ROWS;
const discX = (c) => 3 + 3 * c;
const discY = (r) => (r < R1 ? 2 + 3 * r : 55 + 3 * (r - R1));

// One disc's turn, in sign seconds. The first quarter shows the old face, the
// second a thin edge of it on the top row, the third a thin edge of the new
// face on the bottom row, the last the new face.
const FD = 0.14;
const FIRST = 2.15;
const HOLD = 3.0;
const HOLD_INV = 2.2;
const WAVE = [0.8, 1.05, 0.9, 1.0];

// A condensed 7 row dot face. Each glyph is its rows left to right, top to
// bottom; the width is the length over 7. Most letters are 4 discs wide, the
// I and the 1 are 3, M T V W X Y are 5.
const FONT = {
  A: ".##.#..##..######..##..##..#", B: "###.#..##..####.#..##..####.", C: ".##.#..##...#...#...#..#.##.",
  D: "###.#..##..##..##..##..####.", E: "#####...#...###.#...#...####", F: "#####...#...###.#...#...#...",
  G: ".##.#..##...#.###..##..#.###", H: "#..##..##..######..##..##..#", I: "###.#..#..#..#..#.###",
  J: "...#...#...#...##..##..#.##.", K: "#..##..##.#.##..#.#.#..##..#", L: "#...#...#...#...#...#...####",
  M: "#...###.###.#.##.#.##...##...##...#", N: "#..###.###.##.###.###..##..#", O: ".##.#..##..##..##..##..#.##.",
  P: "###.#..##..####.#...#...#...", R: "###.#..##..####.#.#.#..##..#", S: ".##.#..##....##....##..#.##.",
  T: "#####..#....#....#....#....#....#..", U: "#..##..##..##..##..##..#.##.", V: "#...##...##...#.#.#..#.#..#.#...#..",
  W: "#...##...##...##.#.##.#.###.###...#", X: "#...##...#.#.#...#...#.#.#...##...#", Y: "#...##...#.#.#...#....#....#....#..",
  Z: "####...#..#...#..#..#...####",
  0: ".##.#..##.###..###.##..#.##.", 1: ".#.##..#..#..#..#.###", 2: ".##.#..#...#..#..#..#...####",
  3: ".##.#..#...#.##....##..#.##.", 4: "..#..##.#.#.#.#.####..#...#.", 5: "#####...###....#...##..#.##.",
  6: ".##.#...#...###.#..##..#.##.", 7: "####...#..#...#..#...#...#..", 8: ".##.#..##..#.##.#..##..#.##.",
  9: ".##.#..##..#.###...#...#.##.", "-": ".........###.........", ":": "..#..#.", ".": "......#",
};

// Each route runs four pages: the destination, a page of stops shown
// inverse, the destination again, and a second inverse page.
const ROUTES = [
  { no: "17", pages: [["PIER", "HEAD"], ["VIA", "OLD", "MILL"], ["PIER", "HEAD"], ["VIA", "FISH", "DOCK"]] },
  { no: "7", pages: [["DOCK", "YARD"], ["VIA", "FAIR", "LANE"], ["DOCK", "YARD"], ["VIA", "ROPE", "WALK"]] },
  { no: "N9", pages: [["ZOO", "GATE"], ["LAST", "BUS", "0115"], ["ZOO", "GATE"], ["VIA", "ELM", "PARK"]] },
  { no: "X3", pages: [["SEA", "WALL"], ["VIA", "HIGH", "ST"], ["SEA", "WALL"], ["VIA", "LIDO"]] },
];

// Disc paint, from the yellow most of these signs carried to the red a few did.
const PAINT = [
  [255, 226, 20],
  [110, 255, 40],
  [236, 240, 226],
  [255, 150, 12],
  [255, 58, 34],
];
const BLACK = [13, 13, 12];
const GAP = [3, 3, 4];

const textWidth = (s, k) => {
  let w = 0;
  for (const ch of s) w += (ch === " " ? 2 : FONT[ch].length / 7) * k + k;
  return max(0, w - k);
};

// Sets the discs of one line of text, k times size, its top left at disc
// (c0, r0).
function stamp(bits, s, c0, r0, k) {
  let c = c0;
  for (const ch of s) {
    if (ch === " ") {
      c += 3 * k;
      continue;
    }
    const g = FONT[ch];
    const gw = g.length / 7;
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < gw; x++) {
        if (g[y * gw + x] !== "#") continue;
        for (let a = 0; a < k; a++)
          for (let b = 0; b < k; b++) {
            const cc = c + x * k + b;
            const rr = r0 + y * k + a;
            if (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS) bits[rr * COLS + cc] = 1;
          }
      }
    c += (gw + 1) * k;
  }
}

// A page as the discs it wants yellow. Odd pages are inverse: yellow ground,
// black letters, the route box with them.
function pageBits(route, n) {
  const R = ROUTES[route];
  const lines = R.pages[n % R.pages.length];
  const bits = new Uint8Array(ND);
  stamp(bits, R.no, floor((COLS - textWidth(R.no, 2)) / 2), 1, 2);
  const h = lines.length * 8 - 1;
  const top = R1 + floor((R2 - h) / 2);
  lines.forEach((s, j) => stamp(bits, s, floor((COLS - textWidth(s, 1) + 1) / 2), top + j * 8, 1));
  if (n & 1) for (let i = 0; i < ND; i++) bits[i] ^= 1;
  return bits;
}

const ALL = [new Uint8Array(ND), new Uint8Array(ND).fill(1)];

function palette(P, u) {
  P.hue = u;
  const t = u * 4;
  const j = min(3, floor(t));
  const f = t - j;
  for (let c = 0; c < 3; c++) P.col[c] = PAINT[j][c] + (PAINT[j + 1][c] - PAINT[j][c]) * f;
}

// The housing: a grey bezel round the edge, the dark backplate the discs sit
// on, and the bar between the two boxes with its four screws.
function housing(P) {
  const b = P.base;
  for (let p = 0; p < N; p++) [b[p * 3], b[p * 3 + 1], b[p * 3 + 2]] = GAP;
  const put = (x, y, v, t) => {
    const o = (y * W + x) * 3;
    b[o] = v;
    b[o + 1] = v;
    b[o + 2] = v + t;
  };
  for (let x = 0; x < W; x++) {
    put(x, 0, 40, 4);
    put(x, H - 1, 34, 4);
    put(x, 50, 40, 4);
    for (let y = 51; y < 53; y++) put(x, y, 26, 3);
    put(x, 53, 32, 3);
  }
  for (let y = 0; y < H; y++) {
    put(0, y, 38, 4);
    put(W - 1, y, 34, 4);
  }
  for (const sx of [5, 57]) for (let y = 51; y < 53; y++) for (let x = sx; x < sx + 2; x++) put(x, y, x === sx && y === 51 ? 86 : 58, 2);
}

function init(P, route) {
  P.route = route;
  P.base = new Float32Array(N * 3);
  P.out = new Float32Array(N * 3);
  P.col = [0, 0, 0];
  P.fa = new Uint8Array(ND);
  P.fb = new Uint8Array(ND);
  P.ts = new Float32Array(ND).fill(-9);
  // How bright each disc's paint still is, and how much light falls on its
  // row from the strip under the top of each box.
  P.lit = new Float32Array(ND);
  P.dim = new Float32Array(ND);
  P.q = new Int32Array(ND);
  for (let i = 0; i < ND; i++) {
    const r = floor(i / COLS);
    const c = i % COLS;
    const shade = r < R1 ? 1 - 0.04 * (r / (R1 - 1)) : 1 - 0.06 * ((r - R1) / (R2 - 1));
    P.lit[i] = (0.96 + 0.04 * rnd()) * shade;
    P.dim[i] = 0.85 + 0.3 * rnd();
    P.q[i] = discY(r) * W + discX(c);
  }
  // One disc jammed on its edge, and a few loose ones that flutter as the bus
  // idles.
  P.stuck = (R1 + 2 + floor(rnd() * (R2 - 4))) * COLS + 1 + floor(rnd() * (COLS - 2));
  P.loose = [0, 1, 2, 3].map(() => floor(rnd() * ND));
  P.fli = -1;
  P.flt = 0;
  housing(P);
  P.st = 0;
  P.pg = 0;
  const bits = pageBits(route, 0);
  P.fa.set(bits);
  P.fb.set(bits);
  P.k = 0;
  P.kt = 0;
  P.kd = FIRST;
}

const face = (P, i) => (P.st >= P.ts[i] ? P.fb[i] : P.fa[i]);

// Starts a wave towards the target at sign time t0. Discs already showing
// the right face do not move; two random ones in each wave are sticky and
// turn late.
function wave(P, target, t0, dir) {
  const mode = P.mode;
  const wd = WAVE[mode];
  const sticky = [floor(rnd() * ND), floor(rnd() * ND)];
  P.fli = -1;
  for (let i = 0; i < ND; i++) {
    const cur = face(P, i);
    const tgt = target[i];
    P.fa[i] = cur;
    P.fb[i] = tgt;
    if (cur === tgt) {
      P.ts[i] = -9;
      continue;
    }
    const r = floor(i / COLS);
    const c = dir > 0 ? i % COLS : COLS - 1 - (i % COLS);
    const rr = dir > 0 ? r : ROWS - 1 - r;
    let u;
    if (mode === 0) u = c / (COLS - 1) + r * 0.0012;
    else if (mode === 1) u = (c + rr) / (COLS + ROWS - 2);
    else if (mode === 2) u = rnd();
    else u = rr / (ROWS - 1) + c * 0.0015;
    P.ts[i] = t0 + u * wd + (i === sticky[0] || i === sticky[1] ? 0.12 + 0.15 * rnd() : 0);
  }
  return wd + FD + 0.03;
}

// The sign's cycle: page, fill to yellow, hold, inverse page, clear to
// black, hold, next page.
function enter(P, k, t0) {
  P.k = k;
  P.kt = t0;
  if (k === 0) P.kd = HOLD;
  else if (k === 1) P.kd = wave(P, ALL[1], t0, 1);
  else if (k === 2) P.kd = 0.4;
  else if (k === 3) P.kd = wave(P, pageBits(P.route, ++P.pg), t0, 1);
  else if (k === 4) P.kd = HOLD_INV;
  else if (k === 5) P.kd = wave(P, ALL[0], t0, -1);
  else if (k === 6) P.kd = 0.25;
  else P.kd = wave(P, pageBits(P.route, ++P.pg), t0, -1);
}

export function setup(params) {
  params.base = null;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt, 0, 0.1);
  const hue = cl(k[0], 0, 1);
  const sp = cl(k[1], 0.2, 3) / 2;
  const route = cl(round(k[2]), 0, 3);
  P.mode = cl(round(k[3]), 0, 3);
  if (!P.base) init(P, route);
  else if (route !== P.route) {
    P.route = route;
    P.pg = -1;
    enter(P, 7, P.st);
  }
  if (hue !== P.hue) palette(P, hue);
  P.st += dt * sp;
  const hold = P.k % 2 === 0;
  if (input.btnPressed && input.btnPressed[0] && hold) P.kd = P.st - P.kt;
  while (P.st - P.kt >= P.kd) enter(P, (P.k + 1) % 8, P.kt + P.kd);
  if (P.fli >= 0 && P.st - P.flt > 3 * FD) P.fli = -1;
  if (P.k % 2 === 0 && P.fli < 0 && rnd() < dt * sp * 1.1) {
    P.fli = P.loose[floor(rnd() * P.loose.length)];
    P.flt = P.st;
  }
}

// Paints one disc part way through a turn from face a to face b.
function paint(P, i, a, b, p) {
  const o = P.out;
  const q = P.q[i];
  let f = p < 0.5 ? a : b;
  let rows = 3;
  let s = 1;
  if (p >= 0.25 && p < 0.5) [rows, s] = [1, 0.6];
  else if (p >= 0.5 && p < 0.75) [rows, s] = [2, 0.6];
  if (i === P.stuck) [f, rows, s] = [1, 1, 0.5];
  const c = P.col;
  const L = P.lit[i] * s;
  const D = P.dim[i] * s;
  const cr = f ? c[0] * L : BLACK[0] * D;
  const cg = f ? c[1] * L : BLACK[1] * D;
  const cb = f ? c[2] * L : BLACK[2] * D;
  for (let y = 0; y < 2; y++) {
    if (!(rows & (1 << y))) continue;
    for (let x = 0; x < 2; x++) {
      const j = (q + y * W + x) * 3;
      // The face is not quite flat: its top left catches a little more of
      // the light than its bottom right.
      const g = 1.03 - 0.03 * (x + y);
      o[j] = cr * g;
      o[j + 1] = cg * g;
      o[j + 2] = cb * g;
    }
  }
}

export function draw(display, params) {
  const P = params;
  if (!P.base) return;
  const o = P.out;
  o.set(P.base);
  const st = P.st;
  for (let i = 0; i < ND; i++) {
    const a = P.fa[i];
    const b = P.fb[i];
    let p = a === b ? 1 : (st - P.ts[i]) / FD;
    if (i === P.fli) {
      const e = (st - P.flt) / FD;
      const cur = face(P, i);
      if (e < 1) paint(P, i, cur, 1 - cur, e);
      else if (e < 2) paint(P, i, 1 - cur, 1 - cur, 1);
      else paint(P, i, 1 - cur, cur, e - 2);
      continue;
    }
    paint(P, i, a, b, p < 0 ? 0 : p > 1 ? 1 : p);
  }
  for (let y = 0, j = 0; y < H; y++)
    for (let x = 0; x < W; x++, j += 3) display.setPixel(x, y, min(255, o[j]) | 0, min(255, o[j + 1]) | 0, min(255, o[j + 2]) | 0);
}
