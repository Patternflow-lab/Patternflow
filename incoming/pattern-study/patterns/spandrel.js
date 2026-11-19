// ===== Patternflow pattern =====
// Title:   Spandrel
// Family:  geometry
// Idea:    A disc 200 LEDs across, far bigger than the panel, comes up from below with only its rim in view, a shallow arc under a dark band, and the knob raises it: it holds where the top of the rim lands on the ceiling and the band is two dark corners, and again where the rim clears both corners and the panel is lit all over.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 190
// Round:   192
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Rise=-30..18, Path=0.06..1
//
// Knob 1: Hue. The colour of the disc, all the way round the wheel from green.
// Knob 2: Size. How big the disc is: 192 LEDs across at the bottom of the knob, 200 where it opens at 2 and 220 at the top. It grows about its middle, which stays where the Rise knob has put it, so a bigger disc stands higher on the panel, a little flatter, and lands on the ceiling sooner.
// Knob 3: Rise. How far the disc has come up, counted in clicks of 1.25 LEDs. Where it opens the top of the rim is 12 LEDs under the ceiling and the dark band over it is 17 LEDs deep at the walls; turned down it sinks to 49 LEDs under at the bottom of the knob. On click 9 the top of the rim lands on the ceiling, ten LEDs wide, and what was a dark band is two dark corners, 27 LEDs along the ceiling and 5 down the wall; the knob holds there for two clicks. Over the next two clicks the corners shrink to 9 LEDs by 3, and on click 13 the rim clears them both: the panel is lit all over and stays so to the top of the knob. The smallest disc lands three clicks later and the biggest eight sooner, and the corners are out three clicks after the hold ends.
// Knob 4: Path. How far to the right of the middle the disc comes up: up the middle where it opens, and at the top of the knob as far over as it can go and still cover the whole panel, 45 LEDs at the size it opens with, which puts its top 13 LEDs past the right wall. Off the middle the rim slopes down to the left, the left corner is the deeper one and the last to go out, and the corners take up to seven clicks to go out, on click 17 at the latest. Past about two thirds of the knob the rim lands against the right wall and the dark stays one piece, a corner on the left, all the way up.

const W = 64;
const H = 128;
// The disc comes up this column when the last knob is at the bottom: the middle of the panel, between two LEDs.
const MID = 32;
// The disc's radius, in LEDs, where Size is 0 and where it is 2, and how much a whole turn of Size adds above 2.
const R0 = 96;
const R2 = 100;
const R_UP = 10;
// Knob 3 is counted in clicks and the knob has 48 of them. Each click raises the disc this many LEDs until it lands.
const LOW = -30;
const HIGH = LOW + 48;
const STEP = 1.25;
// At the size it opens with, the rim first touches the ceiling this many clicks above where the knob opens, so click 9 is the landing.
const FIRST = 9.1;
// The click before the landing is at least this much of a click short of the first touch, so the dark band is still a whole LED thick over the top of the rim.
const CLEAR = 0.8;
// The rim has landed when this many LEDs of the top row are lit.
const LAND = 10;
// From the end of the first hold the corners go out in at least this many clicks, and in more of them when the far corner is deep, so that a click raises the disc about GO LEDs.
const OUT = 3;
const GO = 2;
// The last of those clicks puts out a sliver of about this many LEDs in one go. A thinner one under a curved rim breaks up into loose LEDs.
const SLIVER = 14;
// Half the panel's height, in LEDs. A disc whose rim is on the top corners still covers the bottom ones only while its middle is this far under the ceiling or further.
const COVER = 64;
// A hair's breadth, to stand on one side of an LED's middle or the other.
const EPS = 0.01;
// The disc is lit to this much of full at most, under half so a panel lit nearly all over stays inside the current budget.
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

// The row the disc's middle is on when its rim has just lit the top row's LEDs out to d LEDs either side of its column.
function rowFor(r, d) {
  return 0.5 + Math.sqrt(Math.max(0, r * r - d * d)) - EPS;
}

// How far from column cx the nearest LED of a row is, the LAND-th nearest and the furthest.
function spans(P, cx) {
  const d = P.dist;
  for (let x = 0; x < W; x++) d[x] = Math.abs(x + 0.5 - cx);
  d.sort();
  P.first = d[0];
  P.near = d[LAND - 1];
  P.far = d[W - 1];
}

// Where the knob holds for a disc of radius r coming up column cx: the rows of the landing and of the panel lit all over, and the click the landing falls on.
function plan(P, r, cx) {
  spans(P, cx);
  P.land = rowFor(r, P.near);
  P.clear = rowFor(r, P.far);
  // The row its middle would be on at click 0 if every click were one step: the size and the path it opens with touch the ceiling FIRST clicks up.
  P.from = rowFor(R2, 0.5) + STEP * FIRST;
  // The hold falls on a whole click, and the click before it is short of the rim's first touch.
  P.hold = Math.min(HIGH - OUT - 2, Math.floor((P.from - rowFor(r, P.first)) / STEP + 1 - CLEAR));
  // The last sliver is a wedge against the far wall: as tall as it takes, under the slope the rim has there, to hold SLIVER LEDs.
  const run = Math.sqrt(Math.max(1, r * r - P.far * P.far));
  P.snap = Math.min(Math.sqrt((2 * SLIVER * P.far) / run), (P.land - P.clear) / 2);
  P.out = clamp(Math.ceil((P.land - P.clear - P.snap) / GO) + 1, OUT, HIGH - P.hold - 2);
}

// The row the disc's middle is on at a click of the Rise knob.
function rowAt(P, q) {
  const h = P.hold;
  if (q <= h - 1) return P.from - STEP * q;
  if (q < h) {
    const a = P.from - STEP * (h - 1);
    return a + (P.land - a) * (q - (h - 1));
  }
  if (q <= h + 1) return P.land;
  // The corners go out: evenly down to the last sliver, then all at once.
  const last = P.clear + P.snap;
  if (q <= h + P.out) return P.land + ((last - P.land) * (q - (h + 1))) / (P.out - 1);
  if (q < h + P.out + 1) return last + (P.clear - last) * (q - (h + P.out));
  return P.clear;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.P = { dist: new Float64Array(W), first: 0, near: 0, far: 0, land: 0, clear: 0, from: 0, hold: 0, snap: 0, out: OUT };
  params.key = "";
  params.r = R2;
  params.cx = MID;
  params.cy = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The radius goes in twentieths of a LED, so every click of Size moves the rim.
  const z = clamp(k[1], 0, 3);
  const r = Math.round((z < 2 ? R0 + ((R2 - R0) * z) / 2 : R2 + R_UP * (z - 2)) * 20) / 20;
  // The last knob opens at 0.06, the bottom of its travel, where the disc comes up the middle. At the top it is as far over as a disc this size can go and still reach all four corners at once.
  const reach = Math.sqrt(r * r - COVER * COVER) - MID;
  const cx = MID + Math.round(reach * clamp((k[3] - 0.06) / 0.94, 0, 1) * 20) / 20;
  const key = r + "/" + cx;
  if (key !== params.key) {
    params.key = key;
    plan(params.P, r, cx);
  }
  params.r = r;
  params.cx = cx;
  params.cy = rowAt(params.P, clamp(k[2], LOW, HIGH));
  // Nothing on the panel moves on the clock. The light swells and falls over the whole disc, so the panel is never quite still.
  hsv(k[0] + 0.4, SAT, LEVEL * (0.92 + 0.08 * Math.sin(t * 0.63 + 0.7)), params.col);
}

export function draw(display, params, time) {
  const { col, r, cx, cy } = params;
  const rr = r * r;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - cy;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      const m = dx * dx + dy * dy < rr ? 1 : 0;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
