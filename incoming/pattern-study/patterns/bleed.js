// ===== Patternflow pattern =====
// Title:   Bleed
// Family:  geometry
// Idea:    A slab wider and taller than the panel lights all of it, and the knob turns the slab about the middle of the panel so its two long sides swing in over two opposite corners and leave them dark: it holds where the panel is last lit all over, and again where the sides reach the other two corners and the slab lets go of the ceiling and the floor.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 190
// Round:   192
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Turn=-13..35, Axis=0.06..1
//
// Knob 1: Hue. The colour of the slab, all the way round the wheel from blue.
// Knob 2: Size. How wide the slab is: 68 LEDs at the bottom of the knob, 80 where it opens at 2 and 86 at the top, always wider than the panel's 64. It is three times as long as it is wide, so its short sides never come onto the panel. A wider slab has to turn further before its sides reach a corner.
// Knob 3: Turn. How far the slab has turned, clockwise, counted in clicks of 1.875 degrees. At the bottom of the knob it stands upright and lights every LED. Where it opens it has turned 24.7 degrees and two corners are dark, top left and bottom right, each 17 LEDs along the short wall and 37 along the long one. Turned down, the dark corners shrink into slivers against the long walls, 2 LEDs by 11 on the eighth click, and on the ninth they are gone: the panel is lit all over from there to the bottom of the knob. Turned up, the long sides swing on until, at 60.7 degrees, they pass through the other two corners at once: the ceiling and the floor are dark from wall to wall and the knob holds for two clicks, 19 and 20 at the size it opens with. It then goes on to a level band 80 LEDs tall at the top of the knob.
// Knob 4: Axis. How far below the middle of the panel the point sits that the slab turns about: on the middle where it opens, 28 LEDs under it at the top of the knob. Moved down, the top left corner goes dark sooner and deeper than the bottom right one, and the ceiling is dark from wall to wall sooner, on clicks 10 and 11 at the top of the knob, which is where the knob then holds. The floor follows later or not at all, and with the axis all the way down the bottom right corner is lit again before the slab is level.

const W = 64;
const H = 128;
const DEG = Math.PI / 180;
// The slab turns about this point when the last knob is at the bottom: the middle of the panel, where four LEDs meet.
const PX = 32;
const PY = 64;
// Half the slab's width, in LEDs, where Size is 0 and where it is 2, and how much a whole turn of Size adds on either side of 2.
const E0 = 34;
const E2 = 40;
const E_UP = 3;
// The slab is this many times as long as it is wide.
const LONG = 3;
// The furthest the last knob moves the axis down, in LEDs.
const SINK = 28;
// Knob 3 is counted in clicks and the knob has 48 of them. Each click turns the slab this far.
const LOW = -13;
const STEP = 1.875 * DEG;
// At the size and the axis it opens with, the corners go dark this many clicks below where the knob opens, so the last click lit all over is nine clicks down.
const FIRST = 8.9;
// The first click that shows a dark corner is at least this much of a click past the angle where the corner goes dark, so the sliver is more than one LED thick.
const CLEAR = 0.8;
// The corner LEDs sit half a LED in from the corners of the panel.
const CX = 31.5;
const CY = 63.5;
// A hair's breadth of angle, to stand on one side of a corner or the other.
const EPS = 0.02 * DEG;
// The slab is lit to this much of full at most, under half so a panel lit nearly all over stays inside the current budget.
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

// The first angle, turning up from upright, at which a * cos + b * sin reaches e: where a long side of the slab passes through the middle of the LED that sits (a, b) from the axis. A quarter turn if it never does.
function reach(a, b, e) {
  const far = Math.hypot(a, b);
  if (far <= e) return 90 * DEG;
  return clamp(Math.atan2(b, a) - Math.acos(e / far), 0, 90 * DEG);
}

// Where the knob holds for a slab of half width e turning about a point s LEDs under the middle: the corners of the click to angle map.
function plan(P, e, s) {
  // The top left corner LED is the first to go dark, and the top right one the last LED of the top row to. With the axis on the middle the bottom corners go with them.
  const dark = reach(CX, CY + s, e);
  const across = reach(-CX, CY + s, e);
  const from = reach(CX, CY, E2);
  // The click each of those angles falls on if every click were one step.
  const qd = (dark - from) / STEP - FIRST;
  const qa = (across - from) / STEP - FIRST;
  P.from = from;
  P.dark = dark - EPS;
  P.across = across + EPS;
  P.show = Math.ceil(qd + CLEAR);
  P.hold = Math.floor(qa + 1 - CLEAR);
}

// The angle a click of the Turn knob would be if every click were one step.
function even(P, q) {
  return clamp(P.from + STEP * (q + FIRST), 0, 90 * DEG);
}

// How far the slab has turned at a click of the Turn knob.
function turnAt(P, q) {
  // Up to the last click before a corner shows, the slab never turns far enough to darken one.
  if (q <= P.show - 1) return Math.min(even(P, q), P.dark);
  if (q < P.show) {
    const a = Math.min(even(P, P.show - 1), P.dark);
    return a + (even(P, P.show) - a) * (q - (P.show - 1));
  }
  if (q <= P.hold - 1) return even(P, q);
  if (q < P.hold) {
    const a = even(P, P.hold - 1);
    return a + (P.across - a) * (q - (P.hold - 1));
  }
  if (q <= P.hold + 1) return P.across;
  if (q < P.hold + 2) return P.across + (Math.max(P.across, even(P, P.hold + 2)) - P.across) * (q - (P.hold + 1));
  return Math.max(P.across, even(P, q));
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.P = { from: 0, dark: 0, across: 0, show: 0, hold: 0 };
  params.key = "";
  params.e = E2;
  params.s = 0;
  params.th = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const z = clamp(k[1], 0, 3);
  // Half the width goes in twentieths of a LED, so every click of Size moves the long sides.
  const e = Math.round((z < 2 ? E0 + ((E2 - E0) * z) / 2 : E2 + E_UP * (z - 2)) * 20) / 20;
  // The last knob opens at 0.06, the bottom of its travel, where the axis is on the middle of the panel.
  const s = Math.round(SINK * clamp((k[3] - 0.06) / 0.94, 0, 1) * 20) / 20;
  const key = e + "/" + s;
  if (key !== params.key) {
    params.key = key;
    plan(params.P, e, s);
  }
  params.e = e;
  params.s = s;
  params.th = turnAt(params.P, clamp(k[2], LOW, LOW + 48));
  // Nothing on the panel moves on the clock. The light swells and falls over the whole slab, so the panel is never quite still.
  hsv(k[0] + 0.6, SAT, LEVEL * (0.92 + 0.08 * Math.sin(t * 0.71 + 0.3)), params.col);
}

export function draw(display, params, time) {
  const { col, e, s, th } = params;
  const c = Math.cos(th);
  const sn = Math.sin(th);
  const far = LONG * e;
  for (let y = 0; y < H; y++) {
    const ry = y + 0.5 - PY - s;
    for (let x = 0; x < W; x++) {
      const rx = x + 0.5 - PX;
      // Across the slab and along it, from the axis.
      const u = rx * c + ry * sn;
      const v = ry * c - rx * sn;
      const m = u > -e && u < e && v > -far && v < far ? 1 : 0;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
