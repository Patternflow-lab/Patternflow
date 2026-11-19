// ===== Patternflow pattern =====
// Title:   Bung
// Family:  geometry
// Idea:    The lower half of the panel is lit with a round hole in it, left of the middle, and a disc the size of the hole hangs in the dark above it, and the knob lowers the disc: it holds where the disc lands on the lit edge and the two pieces are one, and again where the disc sits in the hole and the hole is gone.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 189
// Round:   191
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Drop=0..48, Slack=0.06..1
//
// Knob 1: Hue. The colour of the lit half and the disc, all the way round the wheel from teal.
// Knob 2: Size. The hole and the disc grow together, 26 LEDs across at the bottom of the knob, 36 where it opens at 2 and 42 at the top. The top of the hole stays 4 LEDs under the lit edge and the hole grows downward.
// Knob 3: Drop. How far the disc has come down, counted in clicks. It opens at the bottom of the knob with the disc 11.6 LEDs clear of the lit edge, nine clicks short of landing, and each click lowers it 1.3 LEDs. On click 9 its lowest row, ten LEDs wide, stands on the edge and the two pieces are one; the knob holds there for two clicks. It then sinks through the 4 LEDs of rim, where it cannot be seen, and comes out into the hole from the top, 1.44 LEDs a click where the knob opens, 1.03 at the smallest size and 1.68 at the biggest. On click 35 a gap 4 LEDs deep is left along the bottom of the hole and click 36 closes it: the disc sits in the hole, the hole is gone and the lit half is plain. The knob holds there for two clicks again. Click 38 takes the disc 4 LEDs on and each click after it 1.2, and the hole opens again from the top. A small disc stops with two LEDs of it still showing in the hole.
// Knob 4: Slack. How much smaller than the hole the disc is. Where it opens they are the same size, and at the top of the knob the disc is half as wide as the hole. A smaller disc lands later, floats free inside the hole on its way down, and on click 36 it rests on the hole's lower side with a dark crescent left above it, so the hole never closes.

const W = 64;
const H = 128;
// The lit half starts at this row. The hole's middle is on this column and its top is RIM LEDs below the lit edge.
const EDGE = 64;
const HX = 26;
const RIM = 4;
// Knob 3 has 48 clicks and opens at the bottom of the knob, FIRST clicks short of landing. The disc sits in the hole on click FIT.
const CLICKS = 48;
const FIRST = 9;
const FIT = 36;
// How many LEDs the disc comes down in a click before it lands and after it has sat in the hole.
const STEP = 1.3;
const PAST = 1.2;
// The last click into the hole closes a gap this many LEDs deep in one go. A thinner sliver of a round hole breaks up into loose LEDs along its sides.
const SNAP = 4;
// The knob holds where at least this many of the disc's LEDs are on or against the lit half, and no further than REACH LEDs past the first of them.
const PAIRS = 10;
const REACH = 2;
// The coarse and the fine step of the search for the landing, in LEDs, and where the search starts: this many LEDs short of the hole.
const COARSE = 0.5;
const FINE = 0.05;
const FAR = 70;
// The lit half and the disc are lit to this much of full at most, under half so half a panel of it stays inside the current budget.
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

// Whether the LED at (x, y) is inside a disc of radius r with its middle on row cy.
function inDisc(x, y, cy, r) {
  const dx = x + 0.5 - HX;
  const dy = y + 0.5 - cy;
  return dx * dx + dy * dy < r * r;
}

// Lights the plate: the lower half, less the hole. The hole is the disc at its full size sitting on the hole's middle, so a disc that size on that spot lights exactly the LEDs the hole left dark.
function cut(P) {
  const g = P.plate;
  P.hy = EDGE + RIM + P.r;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = y >= EDGE && !inDisc(x, y, P.hy, P.r) ? 1 : 0;
}

// How many of the disc's LEDs are on the lit plate or side by side with one of its LEDs, with the disc d LEDs below the hole's middle. None means the disc and the plate are two pieces.
function meet(P, d) {
  const g = P.plate;
  const r = P.rd;
  const cy = P.hy + d;
  let n = 0;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++)
    for (let x = Math.max(0, Math.floor(HX - r)); x <= Math.min(W - 1, Math.ceil(HX + r)); x++) {
      if (!inDisc(x, y, cy, r)) continue;
      const k = y * W + x;
      if (g[k] || (x > 0 && g[k - 1]) || (x < W - 1 && g[k + 1]) || (y > 0 && g[k - W]) || (y < H - 1 && g[k + W])) n++;
    }
  return n;
}

// Where the disc lands, found by lighting the picture LED by LED, and the corners of the click to place map: (click, LEDs below the hole's middle) joined by straight lines.
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
  // One click short of landing the disc is a click's step back, as long as it is clear of the plate there.
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
  // On click FIT the disc is as far into the hole as it goes: against the hole's lower side. A disc the size of the hole fills it there. The last click in and the first click out each take SNAP LEDs.
  const seat = P.r - P.rd;
  qs[4] = FIT - 1;
  ps[4] = Math.max(hold, seat - SNAP);
  qs[5] = FIT;
  ps[5] = seat;
  qs[6] = FIT + 1;
  ps[6] = seat;
  qs[7] = FIT + 2;
  ps[7] = seat + SNAP;
  // It sinks on from there, and stops with two LEDs of the disc still showing in the hole.
  qs[8] = CLICKS;
  ps[8] = Math.min(seat + SNAP + PAST * (CLICKS - FIT - 2), Math.max(seat + SNAP, P.r + P.rd - 2));
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
    r: 0,
    rd: 0,
    hy: 0,
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
  // The radius goes in twentieths of a LED, so every click of Size changes a few LEDs of the rim.
  const r = Math.round((z < 2 ? 13 + 2.5 * z : 18 + 3 * (z - 2)) * 20) / 20;
  // The last knob opens at 0.06, the bottom of its travel, where the disc is the size of the hole.
  const slack = clamp((k[3] - 0.06) / 0.94, 0, 1);
  const rd = slack > 0 ? Math.round(r * (1 - 0.5 * slack) * 20) / 20 : r;
  const key = r + "/" + rd;
  if (key !== params.key) {
    params.key = key;
    P.r = r;
    P.rd = rd;
    cut(P);
    plan(P);
  }
  params.d = placeAt(P, clamp(k[2], 0, CLICKS));
  // Nothing on the panel moves on the clock. The light swells and falls over the lit half and the disc together, so the panel is never quite still and a disc in its hole stays out of sight.
  hsv(k[0] + 0.5, SAT, LEVEL * (0.92 + 0.08 * Math.sin(t * 0.67 + 0.4)), params.col);
}

export function draw(display, params, time) {
  const { P, col, d } = params;
  const g = P.plate;
  const r = P.rd;
  const cy = P.hy + d;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = g[y * W + x] || inDisc(x, y, cy, r) ? 1 : 0;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
