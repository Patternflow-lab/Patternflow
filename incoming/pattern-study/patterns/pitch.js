// ===== Patternflow pattern =====
// Title:   Pitch
// Family:  geometry
// Idea:    A triangle far bigger than the panel comes up from below, point first, with only its two sloping sides in view under two dark corners, and the knob raises it: it holds where the point lands on the ceiling and the dark above it is cut in two, and again where the sides clear both corners and the panel is lit all over.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 190
// Round:   192
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Base=0..3, Rise=-23..25, Path=0.06..1
//
// Knob 1: Hue. The colour of the triangle, all the way round the wheel from violet.
// Knob 2: Base. How wide the triangle's base is: 274 LEDs at the bottom of the knob, 480 where it opens at 2 and 640 at the top, always wider than the panel's 64. The triangle stays 240 LEDs tall and its point stays where it is, so a wider base lays the two sides flatter: they drop 7 LEDs in 4 across at the bottom of the knob, one for one where it opens and 3 in 4 at the top.
// Knob 3: Rise. How far the triangle has come up, counted in clicks. Where it opens the point is 18 LEDs under the ceiling, and each click before the landing moves it 2 LEDs, down to 64 LEDs under, half way down the panel, at the bottom of the knob. On click 9 the point lands on the ceiling, six LEDs wide, and the dark above it is two corners, 29 LEDs along the ceiling and 29 down the wall where it opens; the knob holds there for two clicks. Each click after that lights two more LEDs of ceiling on either side, and on click 24 the last three on each side go out together: the panel is lit all over and the knob holds to its top.
// Knob 4: Path. How far to the left of the middle the triangle comes up: up the middle where it opens, 24 LEDs left of it at the top of the knob. Off the middle the left corner is small and goes out first, the right one is big, 53 LEDs along the ceiling at the top of the knob, and goes out last, on click 24 as before, so each click after the landing raises the triangle further.

const W = 64;
const H = 128;
// The triangle comes up this column when the last knob is at the bottom: the middle of the panel, between two LEDs.
const MID = 32;
// The triangle's height, and half its base where Base is 0 and where it is 2, and how much half the base gains in a whole turn of Base above 2. All in LEDs.
const TALL = 240;
const B0 = 137;
const B2 = 240;
const B_UP = 80;
// The furthest the last knob moves the path to the left, in LEDs.
const ASIDE = 24;
// Knob 3 is counted in clicks and the knob has 48 of them. It opens at 0, and the point lands on click LANDS and the sides clear the corners on click CLEARS.
const LOW = -23;
const LANDS = 9;
const CLEARS = 24;
// How many LEDs the point comes up in a click before it lands.
const STEP = 2;
// The point has landed when this many LEDs of the top row are lit, and one click before it the dark over the point is still this many LEDs thick.
const LAND = 6;
const BAND = 1;
// The last click puts out the last of the far corner in one go: a piece this many LEDs along the ceiling. A thinner one under a sloping side breaks up into loose LEDs.
const SNAP = 3;
// A hair's breadth, to stand on one side of an LED's middle or the other.
const EPS = 0.01;
// The triangle is lit to this much of full at most, under half so a panel lit nearly all over stays inside the current budget.
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

// The row the point is on when the sides, dropping m LEDs for each LED across, have just lit the top row's LEDs out to d LEDs either side of the point's column.
function rowFor(m, d) {
  return 0.5 - m * d - EPS;
}

// Where the knob holds for sides of slope m about column ax: the corners of the click to row map.
function plan(P, m, ax) {
  const d = P.dist;
  for (let x = 0; x < W; x++) d[x] = Math.abs(x + 0.5 - ax);
  d.sort();
  const far = d[W - 1];
  P.land = rowFor(m, d[LAND - 1]);
  P.clear = rowFor(m, far);
  // One click before the landing the top row is dark and so is the row under it, over the point.
  P.pre = 0.5 - m * d[0] + BAND;
  // One click before the corners clear, SNAP LEDs of ceiling are still dark in the far corner.
  P.last = Math.min(rowFor(m, far - SNAP), P.land);
}

// The row the point is on at a click of the Rise knob.
function rowAt(P, q) {
  if (q <= LANDS - 1) return P.pre + STEP * (LANDS - 1 - q);
  if (q < LANDS) return P.pre + (P.land - P.pre) * (q - (LANDS - 1));
  if (q <= LANDS + 1) return P.land;
  if (q <= CLEARS - 1) return P.land + ((P.last - P.land) * (q - (LANDS + 1))) / (CLEARS - LANDS - 2);
  if (q < CLEARS) return P.last + (P.clear - P.last) * (q - (CLEARS - 1));
  return P.clear;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.P = { dist: new Float64Array(W), land: 0, clear: 0, pre: 0, last: 0 };
  params.key = "";
  params.m = 1;
  params.ax = MID;
  params.ay = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const z = clamp(k[1], 0, 3);
  // Half the base goes in whole LEDs, and the slope of the sides is the height over it.
  const b = Math.round(z < 2 ? B0 + ((B2 - B0) * z) / 2 : B2 + B_UP * (z - 2));
  const m = TALL / b;
  // The last knob opens at 0.06, the bottom of its travel, where the triangle comes up the middle.
  const ax = MID - Math.round(ASIDE * clamp((k[3] - 0.06) / 0.94, 0, 1) * 20) / 20;
  const key = b + "/" + ax;
  if (key !== params.key) {
    params.key = key;
    plan(params.P, m, ax);
  }
  params.m = m;
  params.ax = ax;
  params.ay = rowAt(params.P, clamp(k[2], LOW, LOW + 48));
  // Nothing on the panel moves on the clock. The light swells and falls over the whole triangle, so the panel is never quite still.
  hsv(k[0] + 0.76, SAT, LEVEL * (0.92 + 0.08 * Math.sin(t * 0.77 + 0.5)), params.col);
}

export function draw(display, params, time) {
  const { col, m, ax, ay } = params;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - ay;
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x + 0.5 - ax);
      const lit = dy > m * dx && dy < TALL ? 1 : 0;
      display.setPixel(x, y, col[0] * lit, col[1] * lit, col[2] * lit);
    }
  }
}
