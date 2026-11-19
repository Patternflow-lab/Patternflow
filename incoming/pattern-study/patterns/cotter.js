// ===== Patternflow pattern =====
// Title:   Cotter
// Family:  geometry
// Idea:    A lit band runs wall to wall across the top of the panel with a triangular hole in it, point up, and a triangle the size of the hole stands in the dark below, and the knob raises the triangle: it holds where its point goes into the band's lower edge and the two pieces are one, and again where the triangle sits in the hole and the hole is gone.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 189
// Round:   191
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Rise=0..48, Lean=0.06..1
//
// Knob 1: Hue. The colour of the band and the triangle, all the way round the wheel from green.
// Knob 2: Size. The hole and the triangle grow together, 32 LEDs along the base and 27 tall at the bottom of the knob, 40 by 34 where it opens at 2 and 48 by 41 at the top. The hole's base stays 6 LEDs above the band's lower edge and the band stays where it is, 58 LEDs deep.
// Knob 3: Rise. How far the triangle has come up, counted in clicks. It opens at the bottom of the knob with its point 11 LEDs below the band, nine clicks short of going in, and each click raises it 1.2 LEDs. On click 9 the point is two LEDs into the band's lower edge and the two pieces are one; the knob holds there for two clicks. The point then goes up under the 6 LEDs of band, where it cannot be seen, and comes out into the hole from the base, 1.3 LEDs a click where the knob opens. On click 39 the triangle sits in the hole, the hole is gone and the band is plain, and the knob holds for two clicks again. Past that it rises on by 1.1 LEDs a click and the hole opens again along its base.
// Knob 4: Lean. How far the triangle and the line it comes along are turned about the hole's middle, 24 degrees at the top of the knob. Where it opens the triangle comes straight up and fits. Leaned, it comes up from the lower left with its point ahead of it, and on click 39 it lies across the hole with its corners under the band and three slivers of the hole still dark, so the hole never closes.

const W = 64;
const H = 128;
// The row after the band's last, the column the hole's point is on, and how much band is left under the hole's base and over its point.
const BOTTOM = 62;
const HX = 32;
const RIM = 4;
const OVER = 14;
// The triangle is this many times as tall as its base is long.
const TALL = 0.85;
// Knob 3 has 48 clicks and opens at the bottom of the knob, FIRST clicks short of the band. The triangle sits in the hole on click FIT.
const CLICKS = 48;
const FIRST = 9;
const FIT = 37;
// How many LEDs the triangle comes up in a click before it meets the band and after it has sat in the hole.
const STEP = 1.2;
const PAST = 1.1;
// The last click into the hole closes a gap this many LEDs deep in one go. A thinner sliver of a slanted hole breaks up into loose LEDs.
const SNAP = 3;
// The knob holds where at least this many of the triangle's LEDs are on or against the band, and no further than REACH LEDs past the first of them. A point that has only just reached the edge meets it in a pair of LEDs.
const PAIRS = 6;
const REACH = 2.5;
// The coarse and the fine step of the search for the meeting, in LEDs, and where the search starts: this many LEDs short of the hole.
const COARSE = 0.5;
const FINE = 0.05;
const FAR = 90;
// The furthest Lean turns the triangle, in radians.
const LEAN = (18 * Math.PI) / 180;
// The band and the triangle are lit to this much of full at most, under half so the band stays inside the current budget.
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

// Whether the LED at (x, y) is inside the triangle when it is d LEDs along its line from the hole's middle. The middle is a third of the way up from the base. The line and the triangle are turned together about that middle, so with no turn and d at 0 the triangle is the hole.
function inTriangle(P, x, y, d) {
  const dx = x + 0.5 - HX - d * P.s;
  const dy = y + 0.5 - P.hy + d * P.c;
  const u = dx * P.c + dy * P.s;
  const v = dy * P.c - dx * P.s + (2 * P.tall) / 3;
  if (v < 0 || v >= P.tall) return false;
  const w = (v * P.base) / (2 * P.tall);
  return u > -w && u < w;
}

// Lights the plate: the band from wall to wall, less the hole. The hole's base is RIM LEDs above the band's lower edge.
function cut(P) {
  const g = P.plate;
  const c = P.c;
  const s = P.s;
  const top = BOTTOM - RIM - P.tall - OVER;
  P.hy = BOTTOM - RIM - P.tall / 3;
  P.c = 1;
  P.s = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = y >= top && y < BOTTOM && !inTriangle(P, x, y, 0) ? 1 : 0;
  P.c = c;
  P.s = s;
}

// How many of the triangle's LEDs are on the band or side by side with one of its LEDs, with the triangle d LEDs along its line. None means the triangle and the band are two pieces.
function meet(P, d) {
  const g = P.plate;
  const cx = HX + d * P.s;
  const cy = P.hy - d * P.c;
  const reach = Math.max((2 * P.tall) / 3, P.base * 0.6) + 2;
  let n = 0;
  for (let y = Math.max(0, Math.floor(cy - reach)); y <= Math.min(H - 1, Math.ceil(cy + reach)); y++)
    for (let x = Math.max(0, Math.floor(cx - reach)); x <= Math.min(W - 1, Math.ceil(cx + reach)); x++) {
      if (!inTriangle(P, x, y, d)) continue;
      const k = y * W + x;
      if (g[k] || (x > 0 && g[k - 1]) || (x < W - 1 && g[k + 1]) || (y > 0 && g[k - W]) || (y < H - 1 && g[k + W])) n++;
    }
  return n;
}

// Where the triangle meets the band, found by lighting the picture LED by LED, and the corners of the click to place map: (click, LEDs along the line from the hole's middle) joined by straight lines.
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
  // One click short of the band the triangle is a click's step back, as long as it is clear of the band there.
  let pre = hold - STEP;
  for (let i = 0; i < 80 && meet(P, pre) > 0; i++) pre -= FINE;
  // Past the hole the point stops two LEDs short of the band's upper edge, so it never stands out above the band.
  const room = OVER - 2;
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
  qs[8] = CLICKS;
  ps[8] = clamp(SNAP + PAST * (CLICKS - FIT - 2), SNAP, Math.max(SNAP, room));
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
    base: 0,
    tall: 0,
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
  // The base goes in whole LEDs and the height in whole LEDs after it.
  const base = Math.round(z < 2 ? 34 + 3 * z : 40 + 8 * (z - 2));
  // The last knob opens at 0.06, the bottom of its travel, where the triangle comes straight up. The lean goes in two hundredths of its range.
  const lean = Math.round(clamp((k[3] - 0.06) / 0.94, 0, 1) * 200) / 200;
  const key = base + "/" + lean;
  if (key !== params.key) {
    params.key = key;
    P.base = base;
    P.tall = Math.round(base * TALL);
    P.c = Math.cos(LEAN * lean);
    P.s = Math.sin(LEAN * lean);
    cut(P);
    plan(P);
  }
  params.d = placeAt(P, clamp(k[2], 0, CLICKS));
  // Nothing on the panel moves on the clock. The light swells and falls over the band and the triangle together, so the panel is never quite still and a triangle in its hole stays out of sight.
  hsv(k[0] + 0.36, SAT, LEVEL * (0.92 + 0.08 * Math.sin(t * 0.59 + 2.1)), params.col);
}

export function draw(display, params, time) {
  const { P, col, d } = params;
  const g = P.plate;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = g[y * W + x] || inTriangle(P, x, y, d) ? 1 : 0;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
