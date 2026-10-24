// ===== Patternflow pattern =====
// Title:   Aztec Diamond
// Family:  cells
// Idea:    Aztec diamonds tile the panel, two whole and six cut by its edges, and each grows by domino shuffling: every domino slides one LED out in its own direction, the holes fill with fresh pairs, and at full size the four corners have frozen into brick walls of one colour each while the dominoes churn on inside the arctic circle.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: domino shuffling on the Aztec diamond (Elkies, Kuperberg, Larsen and Propp, 1992) and the arctic circle theorem (Jockusch, Propp and Shor, 1995), pattern round 28
// Round:   28
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Bias=-1..1, Checker=-1..1
//
// Knob 1: Hue. Turns the four domino colours round the wheel together. At 0 the north-going dominoes are orange, east green, south blue and west magenta; each quarter turn hands the same four colours on to the next direction, and in between come other sets, at 0.15 lime, cyan, violet and red.
// Knob 2: Speed. At 2 a diamond grows one order every 0.45 s, so order 1 to 32 takes 14 seconds, and a grown one churns for 15 seconds (the six cut ones for 40 to 60) before it fades and grows again; at 0.2 it all runs ten times slower.
// Knob 3: Bias. The odds that a fresh 2x2 block gets two horizontal dominoes rather than two vertical ones. At 0 they are even and every arctic boundary is a circle. Turned right, the two whole diamonds lean horizontal (0.9 at 1) and their circles flatten into wide ellipses while the six round them lean vertical into tall ones; turned left it goes the other way.
// Knob 4: Checker. How dark the dark squares of the checkerboard under the tiling burn; every domino covers one light and one dark square. At -1 both burn alike and the dominoes merge into flat fields of colour, at the start the dark squares burn at 60%, and at 1 at a quarter, so each domino shows as one bright LED.
// Buttons: K1 tap fades every diamond and grows all eight again from order 1 at once; after that the bottom diamond waits half a cycle, so the two whole ones take turns again.

const W = 64, H = 128, NP = W * H;
const { min, floor, abs, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => u * u * (3 - 2 * u);

// The four kinds of domino, by orientation and by the colour of the
// checkerboard square under their first cell: 0 north, 1 east, 2 south,
// 3 west. At order k a horizontal domino whose left cell is (x, y) goes north
// when x + y + k is odd and south when it is even; a vertical one goes west
// when odd and east when even.
const kind = (x, y, v, k) => ((x + y + k) & 1 ? (v ? 3 : 0) : v ? 1 : 2);
const STEP = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// Aztec diamonds tile the plane. Two of order 32 stand whole on the panel,
// one above the other; the gaps round them are diamonds of order 31, halved
// by the sides and quartered by the corners. Those grow only to order 30, so
// a one-LED diagonal of dark runs between every two diamonds.
// [centre x, centre y, order, hold in seconds at Speed 2, clock at the start, order at the start]
const LAYOUT = [
  [32, 32, 32, 15, -21, 32],
  [32, 96, 32, 15, 0, 18],
  [0, 64, 30, 50, 39, 30],
  [64, 64, 30, 50, 25, 30],
  [0, 0, 30, 50, 4, 30],
  [64, 0, 30, 50, 32, 30],
  [0, 128, 30, 50, 18, 30],
  [64, 128, 30, 50, 11, 30],
];

// A diamond keeps its dominoes as lists (left or top cell, vertical or not,
// grain) and two pictures of its cells to fade between: per cell 0 for empty
// or 1 + the kind of the domino on it, and that domino's grain, 204 to 255.
function makeDiamond([cx, cy, N, hold]) {
  const F = 2 * N, M = N * (N + 1) + 4, C = F * F;
  return {
    cx, cy, N, F, hold, k: 0, n: 0, p: 0.5, wait: 0,
    dx: new Int16Array(M), dy: new Int16Array(M), dv: new Uint8Array(M), dg: new Uint8Array(M),
    grid: new Int16Array(C).fill(-1),
    ft: new Uint8Array(C), fg: new Uint8Array(C), tt: new Uint8Array(C), tg: new Uint8Array(C),
    stage: 0, sub: 1, u: 1, dur: 0.1, clock: 0,
  };
}

function regrid(D) {
  const g = D.grid, F = D.F;
  g.fill(-1);
  for (let i = 0; i < D.n; i++) {
    const c = D.dx[i] + D.dy[i] * F;
    g[c] = i;
    g[D.dv[i] ? c + F : c + 1] = i;
  }
}

function add(D, x, y, v) {
  const i = D.n++;
  (D.dx[i] = x), (D.dy[i] = y), (D.dv[i] = v), (D.dg[i] = 204 + floor(random() * 52));
  return i;
}

// Shuffling, order k to k + 1, in three moves. First the bad blocks go: a
// south-going domino right above a north-going one, or an east-going one
// right left of a west-going one, would pass through each other.
function destroy(D) {
  regrid(D);
  const { dx, dy, dv, grid: g, k, F } = D;
  const dead = new Uint8Array(D.n);
  for (let i = 0; i < D.n; i++) {
    const t = kind(dx[i], dy[i], dv[i], k), c = dx[i] + dy[i] * F;
    if (t === 2) {
      const j = g[c + F];
      if (j >= 0 && !dv[j] && dx[j] === dx[i] && dy[j] === dy[i] + 1) dead[i] = dead[j] = 1;
    } else if (t === 1) {
      const j = g[c + 1];
      if (j >= 0 && dv[j] && dx[j] === dx[i] + 1 && dy[j] === dy[i]) dead[i] = dead[j] = 1;
    }
  }
  let m = 0;
  for (let i = 0; i < D.n; i++)
    if (!dead[i]) (dx[m] = dx[i]), (dy[m] = dy[i]), (dv[m] = dv[i]), (D.dg[m] = D.dg[i]), m++;
  D.n = m;
}

// Then every domino slides one cell in its own direction.
function slide(D) {
  const { dx, dy, dv, k } = D;
  for (let i = 0; i < D.n; i++) {
    const s = STEP[kind(dx[i], dy[i], dv[i], k)];
    (dx[i] += s[0]), (dy[i] += s[1]);
  }
  D.k = k + 1;
  regrid(D);
}

// And the holes left in the bigger diamond, which always come as 2x2
// blocks, each take a random pair: two horizontal with probability p,
// two vertical otherwise.
function create(D) {
  const { grid: g, k, p, N, F } = D;
  for (let y = N - k; y < N + k; y++) {
    const r = k - abs(2 * y + 1 - F) / 2 + 0.5;
    for (let x = N - r; x < N + r; x++) {
      const c = x + y * F;
      if (g[c] >= 0) continue;
      if (random() < p) {
        g[c] = g[c + 1] = add(D, x, y, 0);
        g[c + F] = g[c + F + 1] = add(D, x, y + 1, 0);
      } else {
        g[c] = g[c + F] = add(D, x, y, 1);
        g[c + 1] = g[c + F + 1] = add(D, x + 1, y, 1);
      }
    }
  }
}

// At full size the tiling keeps moving by flips: a 2x2 block covered by two
// parallel dominoes turns over to the other pair with the same odds as a
// fresh block. The weighted uniform measure stays put under it, so the
// frozen corners hold still and only the arctic circle churns.
function flips(D, tries) {
  const { dx, dy, dv, grid: g, p, F } = D;
  for (let t = 0; t < tries; t++) {
    const x = floor(random() * (F - 1)), y = floor(random() * (F - 1)), c = x + y * F, a = g[c];
    if (a < 0 || dx[a] !== x || dy[a] !== y) continue;
    const h = random() < p;
    if (!dv[a]) {
      const b = g[c + F];
      if (b < 0 || dv[b] || dx[b] !== x || dy[b] !== y + 1 || h) continue;
      (dv[a] = dv[b] = 1), (dx[b] = x + 1), (dy[b] = y);
      (g[c + F] = a), (g[c + 1] = b);
    } else {
      const b = g[c + 1];
      if (b < 0 || !dv[b] || dx[b] !== x + 1 || dy[b] !== y || !h) continue;
      (dv[a] = dv[b] = 0), (dx[b] = x), (dy[b] = y + 1);
      (g[c + 1] = a), (g[c + F] = b);
    }
  }
}

// The picture a diamond fades to.
function paint(D) {
  const { dx, dy, dv, dg, k, F, tt, tg } = D;
  tt.fill(0);
  for (let i = 0; i < D.n; i++) {
    const t = kind(dx[i], dy[i], dv[i], k), c = dx[i] + dy[i] * F, c2 = dv[i] ? c + F : c + 1;
    (tt[c] = tt[c2] = t + 1), (tg[c] = tg[c2] = dg[i]);
  }
}

function retire(D, dur) {
  D.ft.set(D.tt), D.fg.set(D.tg);
  (D.u = 0), (D.stage = 2), (D.dur = dur), (D.n = 0);
  paint(D);
}

// One move of a diamond's life. Growing, a step from order k to k + 1 takes
// two fades: the bad pairs go out while every other domino slides, then the
// holes fill. Grown, it flips blocks a batch at a time until its hold runs
// out, fades and grows again from order 1.
function begin(D, P) {
  D.ft.set(D.tt), D.fg.set(D.tg);
  D.u = 0;
  const s = P.speed, T = 0.9 / s;
  if (D.stage === 0) {
    if (D.sub === 0) create(D), (D.sub = 1), (D.dur = 0.4 * T);
    else if (D.k >= D.N) {
      (D.stage = 1), (D.clock = -D.wait), (D.wait = 0);
      return begin(D, P);
    } else if (D.k === 0) (D.k = 1), regrid(D), create(D), (D.dur = 0.4 * T);
    else destroy(D), slide(D), (D.sub = 0), (D.dur = 0.6 * T);
  } else if (D.stage === 1) {
    if (D.clock > (D.hold * 2) / s) {
      if (D.N < 32) D.hold = 40 + 20 * random();
      return retire(D, 0.8);
    }
    flips(D, 500), (D.dur = 0.35 / s);
  } else {
    (D.stage = 0), (D.sub = 1), (D.k = 0), (D.n = 0);
    return begin(D, P);
  }
  paint(D);
}

// Which diamond and which of its cells each LED shows; -1 is the dark seam.
const OWN = new Int8Array(NP).fill(-1), CELL = new Int32Array(NP);
LAYOUT.forEach(([cx, cy, N], d) => {
  for (let y = 0; y < 2 * N; y++)
    for (let x = 0; x < 2 * N; x++) {
      const X = cx - N + x, Y = cy - N + y;
      if (X < 0 || X >= W || Y < 0 || Y >= H || abs(2 * x + 1 - 2 * N) + abs(2 * y + 1 - 2 * N) > 2 * N) continue;
      (OWN[X + Y * W] = d), (CELL[X + Y * W] = x + y * 2 * N);
    }
});

export function setup(params) {
  params.s = { fresh: true, speed: 2, hue: 0, dark: 0.4, D: LAYOUT.map(makeDiamond), col: new Float32Array(12) };
}

// The top diamond opens grown and churning, the bottom one at order 18 and
// still growing, the six round them grown and due to regrow one by one,
// the first after 11 seconds. They grow on the first frame, once Bias is known.
function opening(P) {
  P.D.forEach((D, i) => {
    begin(D, P);
    while (D.k < LAYOUT[i][5] || (D.k >= D.N && D.stage === 0)) begin(D, P);
    D.clock = LAYOUT[i][4];
  });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const bias = cl(k[2], -1, 1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.dark = 0.38 * (1 + cl(k[3], -1, 1));
  P.D.forEach((D, i) => (D.p = 0.5 + (i < 2 ? 0.4 : -0.4) * bias));
  if (P.fresh) (P.fresh = false), opening(P);
  // K1: every diamond fades and grows again from order 1, all together; the
  // bottom one then holds half a cycle longer, so the two take turns again.
  if (input.btnPressed && input.btnPressed[0])
    P.D.forEach((D, i) => {
      D.wait = ((i === 1 ? 15 : i > 1 ? 30 * random() : 0) * 2) / P.speed;
      retire(D, 0.4);
    });
  for (const D of P.D) {
    D.clock += d;
    D.u += d / D.dur;
    if (D.u >= 1) begin(D, P);
  }
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c];
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const col = P.col, sm = 1 - P.dark, E = P.D.map((D) => ease(cl(D.u, 0, 1)));
  // Orange north, green east, blue south, magenta west at Hue 0.
  for (let t = 0; t < 4; t++) hsv(P.hue + 0.1 + t * 0.25, 0.94, 1, col, t * 3);
  for (let p = 0; p < NP; p++) {
    const d = OWN[p], x = p % W, y = (p / W) | 0;
    if (d < 0) {
      display.setPixel(x, y, 0, 0, 0);
      continue;
    }
    // The checkerboard stays put on the LEDs while the dominoes slide over it.
    const D = P.D[d], c = CELL[p], a = D.ft[c], b = D.tt[c], e = E[d], lv = (x + y) & 1 ? sm : 1;
    let r = 0, g = 0, bl = 0;
    if (a) {
      const w = D.fg[c] * lv * (1 - e), q = (a - 1) * 3;
      (r += w * col[q]), (g += w * col[q + 1]), (bl += w * col[q + 2]);
    }
    if (b) {
      const w = D.tg[c] * lv * e, q = (b - 1) * 3;
      (r += w * col[q]), (g += w * col[q + 1]), (bl += w * col[q + 2]);
    }
    display.setPixel(x, y, min(255, r), min(255, g), min(255, bl));
  }
}
