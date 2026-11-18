// ===== Patternflow pattern =====
// Title:   Embrasure
// Family:  geometry
// Idea:    One thick band runs wall to wall just below the middle of a bare dark panel with a round hole cut in it, and the four knobs are the colour, how thick the band is, how wide the hole has grown and how far it has slid along the band: the hole widens until it is as wide as the band and touches both edges, and the band, one piece until then, is two.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 163
// Round:   165
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Thick=0..3, Hole=-32..16, Slide=-0.88..1
//
// Knob 1: Hue. The colour of the band, all the way round the wheel from amber.
// Knob 2: Thick. How thick the band is, 32 LEDs at 0 to 44 LEDs at 3; its 2 is 40 LEDs. The band always runs from the left wall to the right wall.
// Knob 3: Hole. How wide the round hole is, counted in clicks: it opens ten clicks short of touching. Turned up the hole widens, slowly at first and by a little over one LED of rim a click for the last eight clicks, until it is as wide as the band is thick and touches both edges at once. The knob holds that picture for three clicks, two bars on the panel, then the hole goes on widening for the last four clicks. Turned down it shrinks to a small hole.
// Knob 4: Slide. How far the hole has slid along the band, to the right at the top of the knob and to the left at the bottom, 8 LEDs at most; where it opens it is in the middle.

const W = 64;
const H = 128;
// The band runs just below the middle, so there is more bare panel above it than below.
const CX = 32;
const CY = 70;
// Knob 3 is counted in clicks and the knob has 48 of them. It opens at 0, ten clicks before the hole touches both edges: clicks 10, 11 and 12 are the touching picture.
const HOLD = 10;
const HOLD_END = 12;
// The smallest the hole gets, in LEDs across.
const PIN = 6;

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

// How much of the LED between p and p + 1 the span from lo to hi covers.
function span(lo, hi, p) {
  const v = (hi < p + 1 ? hi : p + 1) - (lo > p ? lo : p);
  return v < 0 ? 0 : v;
}

// How wide the hole is for a knob a number of clicks from where it opens, for a band this thick. Before it touches, the wall between the hole and an edge thins by 2.05 LEDs on the last click, which keeps a whole lit row between the two and so keeps the band one piece up to that click, and by 1.05 LEDs a click for the seven before it.
function holeWidth(clicks, thick) {
  let wide;
  if (clicks > HOLD_END) wide = thick + 2.1 * (clicks - HOLD_END);
  else if (clicks >= HOLD) wide = thick;
  else {
    const u = HOLD - clicks;
    const wall = u <= 1 ? 2.05 * u : u <= 8 ? 2.05 + 1.05 * (u - 1) : 9.4 + 0.3 * (u - 8);
    wide = thick - 2 * wall;
  }
  return wide < PIN ? PIN : wide;
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.light = 1;
  params.thick = 40;
  params.radius = 10;
  params.hx = CX;
  params.row = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const thick = 32 + 4 * clamp(k[1], 0, 3);
  params.thick = thick;
  params.radius = holeWidth(clamp(k[2], -32, 16), thick) / 2;
  // The slide knob opens at 0.06, so 0.06 is the middle of its travel and the hole sits dead centre there.
  params.hx = CX + 8 * clamp((k[3] - 0.06) / 0.94, -1, 1);
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.84 + 0.16 * Math.sin(t * 0.47 + 2);
  hsv(k[0] + 0.09, 0.7, params.light, params.c);
}

export function draw(display, params, time) {
  const { thick, radius, hx, row, c } = params;
  for (let y = 0; y < H; y++) row[y] = span(CY - thick / 2, CY + thick / 2, y);
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - CY;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - hx;
      // The band, less the hole, which is a whole LED dark when it is a whole LED inside.
      const sd = Math.sqrt(dx * dx + dy * dy) - radius;
      let hole = 0.5 - sd;
      hole = hole < 0 ? 0 : hole > 1 ? 1 : hole;
      const m = row[y] * (1 - hole);
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
