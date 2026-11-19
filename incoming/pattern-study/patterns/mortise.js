// ===== Patternflow pattern =====
// Title:   Mortise
// Family:  geometry
// Idea:    A lit band stands from ceiling to floor on the right with a square hole in it and a square the size of the hole waits at the left wall, and the knob slides the square across: it holds where the square meets the band's edge and the two pieces are one, and again where the square sits in the hole and the hole is gone.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 189
// Round:   191
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Reach=0..48, Turn=0.06..1
//
// Knob 1: Hue. The colour of the band and the square, all the way round the wheel from violet.
// Knob 2: Size. The hole, the square and the band grow together: an 18 LED square in a band 26 LEDs wide at the bottom of the knob, 22 in 30 where it opens at 2 and 26 in 34 at the top. The band keeps 4 LEDs either side of the hole and its right edge stays 3 LEDs off the right wall.
// Knob 3: Reach. How far the square has come across, counted in clicks. It opens at the bottom of the knob with the square 10 LEDs short of the band, nine clicks before it meets it, and each click brings it 1.1 LEDs. Where it opens the square stands against the left wall with one column of it still behind the wall. On click 9 it stands flush against the band's edge and the two pieces are one; the knob holds there for two clicks. It then goes in under the 4 LEDs of band, where it cannot be seen, and comes out into the hole, 1.3 LEDs a click where the knob opens, 1.08 at the smallest size and 1.5 at the biggest. On click 29 a slit 2 LEDs wide is left down the far side of the hole and click 30 closes it: the square sits in the hole, the hole is gone and the band is plain. The knob holds there for two clicks again. Click 32 takes the square 2 LEDs on and each click after it 1.2, the hole opens again behind it and the square goes out through the right wall. It stops no further than where the whole hole is open again.
// Knob 4: Turn. How far the square and the line it comes along are turned about the hole's middle, 30 degrees at the top of the knob. Where it opens the square comes straight across and fits. Turned, it comes down from the upper left, meets the band corner first, and on click 30 it lies across the hole with its corners under the band and the hole's own corners still dark, so the hole never closes.

const W = 64;
const H = 128;
// The band's right edge, how much band is left either side of the hole, and the row the hole's middle is on.
const RIGHT = 61;
const RIM = 4;
const HY = 72;
// Knob 3 has 48 clicks and opens at the bottom of the knob, FIRST clicks short of the band. The square sits in the hole on click FIT.
const CLICKS = 48;
const FIRST = 9;
const FIT = 30;
// How many LEDs the square comes in a click before it meets the band and after it has sat in the hole.
const STEP = 1.1;
const PAST = 1.2;
// The last click into the hole closes a slit this many LEDs wide in one go.
const SNAP = 2;
// The knob holds where at least this many of the square's LEDs are on or against the band, and no further than REACH LEDs past the first of them.
const PAIRS = 6;
const REACH = 2;
// The coarse and the fine step of the search for the meeting, in LEDs, and where the search starts: this many LEDs short of the hole.
const COARSE = 0.5;
const FINE = 0.05;
const FAR = 70;
// The furthest Turn turns the square, in radians.
const TURN = (30 * Math.PI) / 180;
// The band and the square are lit to this much of full at most, under half so the band stays inside the current budget.
const LEVEL = 0.49;
const SAT = 0.45;

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Whether the LED at (x, y) is inside the square when it is d LEDs along its line from the hole's middle. The line and the square are turned together about that middle, so with no turn and d at 0 the square is the hole.
function inSquare(P, x, y, d) {
  const dx = x + 0.5 - P.hx - d * P.c;
  const dy = y + 0.5 - P.hy - d * P.s;
  const u = dx * P.c + dy * P.s;
  const v = dy * P.c - dx * P.s;
  const h = P.side / 2;
  return u > -h && u < h && v > -h && v < h;
}

// Lights the plate: the band from ceiling to floor, less the hole.
function cut(P) {
  const g = P.plate;
  const x0 = RIGHT - RIM - P.side;
  const y0 = Math.round(HY - P.side / 2);
  const left = x0 - RIM;
  P.hx = x0 + P.side / 2;
  P.hy = y0 + P.side / 2;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const hole = x >= x0 && x < x0 + P.side && y >= y0 && y < y0 + P.side;
      g[y * W + x] = x >= left && x < RIGHT && !hole ? 1 : 0;
    }
}

// How many of the square's LEDs are on the band or side by side with one of its LEDs, with the square d LEDs along its line. None means the square and the band are two pieces.
function meet(P, d) {
  const g = P.plate;
  const cx = P.hx + d * P.c;
  const cy = P.hy + d * P.s;
  const reach = P.side * 0.7072 + 1;
  let n = 0;
  for (let y = Math.max(0, Math.floor(cy - reach)); y <= Math.min(H - 1, Math.ceil(cy + reach)); y++)
    for (let x = Math.max(0, Math.floor(cx - reach)); x <= Math.min(W - 1, Math.ceil(cx + reach)); x++) {
      if (!inSquare(P, x, y, d)) continue;
      const k = y * W + x;
      if (g[k] || (x > 0 && g[k - 1]) || (x < W - 1 && g[k + 1]) || (y > 0 && g[k - W]) || (y < H - 1 && g[k + W])) n++;
    }
  return n;
}

// Where the square meets the band, found by lighting the picture LED by LED, and the corners of the click to place map: (click, LEDs along the line from the hole's middle) joined by straight lines.
function plan(P) {
  let a = -FAR;
  while (a < -1 && meet(P, a) === 0) a += COARSE;
  let land = a;
  for (let d = a - COARSE + FINE; d < a; d += FINE)
    if (meet(P, d) > 0) {
      land = d;
      break;
    }
  let hold = land;
  while (hold < land + REACH && hold < -1 && meet(P, hold) < PAIRS) hold += FINE;
  // One click short of the band the square is a click's step back, as long as it is clear of the band there.
  let pre = hold - STEP;
  for (let i = 0; i < 80 && meet(P, pre) > 0; i++) pre -= FINE;
  const qs = P.qs;
  const ps = P.ps;
  qs[0] = 0;
  ps[0] = pre - STEP * (FIRST - 1);
  qs[1] = FIRST - 1;
  ps[1] = pre;
  qs[2] = FIRST;
  ps[2] = hold;
  qs[3] = FIRST + 1;
  ps[3] = hold;
  // The last click into the hole and the first click out of it each take SNAP LEDs.
  qs[4] = FIT - 1;
  ps[4] = Math.max(hold, -SNAP);
  qs[5] = FIT;
  ps[5] = 0;
  qs[6] = FIT + 1;
  ps[6] = 0;
  qs[7] = FIT + 2;
  ps[7] = SNAP;
  // It goes on from there, and no further than where the whole hole is open again.
  qs[8] = CLICKS;
  ps[8] = Math.min(SNAP + PAST * (CLICKS - FIT - 2), P.side);
}

function placeAt(P, q) {
  const qs = P.qs;
  const ps = P.ps;
  if (q <= qs[0]) return ps[0];
  for (let i = 1; i < 9; i++) if (q <= qs[i]) return ps[i - 1] + ((ps[i] - ps[i - 1]) * (q - qs[i - 1])) / (qs[i] - qs[i - 1]);
  return ps[8];
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.P = {
    plate: new Uint8Array(W * H),
    qs: new Float32Array(9),
    ps: new Float32Array(9),
    side: 0,
    hx: 0,
    hy: 0,
    c: 1,
    s: 0,
  };
  params.key = "";
  params.d = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const P = params.P;
  const z = clamp(k[1], 0, 3);
  const side = Math.round(z < 2 ? 18 + 2 * z : 22 + 4 * (z - 2));
  // The last knob opens at 0.06, the bottom of its travel, where the square comes straight across. The turn goes in two hundredths of its range.
  const turn = Math.round(clamp((k[3] - 0.06) / 0.94, 0, 1) * 200) / 200;
  const key = side + "/" + turn;
  if (key !== params.key) {
    params.key = key;
    P.side = side;
    P.c = Math.cos(TURN * turn);
    P.s = Math.sin(TURN * turn);
    cut(P);
    plan(P);
  }
  params.d = placeAt(P, clamp(k[2], 0, CLICKS));
  // Nothing on the panel moves on the clock. The light swells and falls over the band and the square together, so the panel is never quite still and a square in its hole stays out of sight.
  hsv(k[0] + 0.76, SAT, LEVEL * (0.92 + 0.08 * Math.sin(t * 0.71 + 1.3)), params.col);
}

export function draw(display, params, time) {
  const { P, col, d } = params;
  const g = P.plate;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = g[y * W + x] || inSquare(P, x, y, d) ? 1 : 0;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
