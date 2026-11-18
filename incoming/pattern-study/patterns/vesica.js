// ===== Patternflow pattern =====
// Title:   Vesica
// Family:  geometry
// Idea:    Two discs of one size stand one above the other high on a bare dark ground and overlap, each lit at half strength, and the four knobs are the colour, the diameter, how bright the part they share is and how far apart they stand: the shared part runs from dark to the two lights added together, and where it is as bright as one disc the two arcs inside are gone and the pair is one shape.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 166
// Round:   168
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Overlap=-14..34, Apart=0..1
//
// Knob 1: Hue. The colour of both discs, all the way round the wheel from sky blue.
// Knob 2: Size. The diameter of both discs, 24 LEDs at 0 to 54 LEDs at 3; its 2 is 44 LEDs.
// Knob 3: Overlap. How bright the part the two discs share is, counted in clicks from where it opens. A disc alone is lit at half strength. At the bottom of the knob the shared part is dark and two crescents are left. At the top it is the two lights added, twice as bright as a disc. It opens with the shared part about half as bright as a disc. Ten clicks up it is exactly as bright as a disc, the two arcs inside are gone and the pair is one shape, and the knob holds that picture for three clicks. The first click past it either way moves the shared part by a fifth of a disc's light, so the arcs are back at once.
// Knob 4: Apart. How far apart the two middles stand. Where it opens, a third of each disc lies under the other. Turned up, the discs draw apart until the shared part is a thin lens.

const W = 64;
const H = 128;
// The pair stands above the middle of the panel, so the bottom of the panel is bare.
const CX = 32;
const CY = 54;
// Knob 3 is counted in clicks and the knob has 48 of them, 14 below where it opens and 34 above. Clicks 10, 11 and 12 are the picture with no arcs inside.
const LOW = -14;
const HIGH = 34;
const HOLD = 10;
const HOLD_END = 12;
// One click either side of that picture the shared part is this much of a disc's light brighter or darker. At the dimmest of the breath that is 21 of the 255 steps an LED has, and five steps, an even share of the knob, left the arcs too faint to see.
const STEP = 0.22;
// Middles this many diameters apart put exactly a third of each disc under the other.
const THIRD = 0.5533;
// As far apart as the knob takes them. The lens left is about a seventh of a diameter deep.
const THIN = 0.86;

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

// How bright the shared part is, in discs' worth of light, for a knob this many clicks from where it opens: 0 at the bottom, 1 on the three held clicks, 2 at the top.
function shared(clicks) {
  if (clicks < HOLD) {
    const u = HOLD - clicks;
    return u <= 1 ? 1 - STEP * u : (1 - STEP) * (1 - (u - 1) / (HOLD - 1 - LOW));
  }
  if (clicks <= HOLD_END) return 1;
  const u = clicks - HOLD_END;
  return u <= 1 ? 1 + STEP * u : 1 + STEP + ((1 - STEP) * (u - 1)) / (HIGH - HOLD_END - 1);
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.radius = 22;
  params.gap = 24.3;
  params.extra = -1.5;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const d = 24 + 10 * clamp(k[1], 0, 3);
  params.radius = d / 2;
  params.gap = d * (THIRD + ((clamp(k[3], 0, 1) - 0.06) / 0.94) * (THIN - THIRD));
  // What the shared part gets on top of the two discs' own light. Both discs are drawn everywhere they stand, so the shared part starts at two discs' worth.
  params.extra = shared(clamp(k[2], LOW, HIGH)) - 2;
  // Nothing on the panel moves on the clock. Its light swells and falls, both discs and the shared part together, so the panel is never quite still. A disc is lit at half of that, which leaves room for two.
  const light = 0.88 + 0.12 * Math.sin(t * 0.6);
  hsv(k[0] + 0.56, 0.7, 0.5 * light, params.c);
}

export function draw(display, params, time) {
  const { radius, gap, extra, c } = params;
  const ya = CY - gap / 2;
  const yb = CY + gap / 2;
  for (let y = 0; y < H; y++) {
    const dya = y + 0.5 - ya;
    const dyb = y + 0.5 - yb;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX;
      let a = 0.5 - (Math.sqrt(dx * dx + dya * dya) - radius);
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      let b = 0.5 - (Math.sqrt(dx * dx + dyb * dyb) - radius);
      b = b < 0 ? 0 : b > 1 ? 1 : b;
      // What both discs cover of this LED. Between the two middles the rims face each other and what one leaves the other takes; outside them the smaller cover lies within the larger.
      let both;
      if (dya * dyb < 0) both = a + b - 1 > 0 ? a + b - 1 : 0;
      else both = a < b ? a : b;
      const m = a + b + extra * both;
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
