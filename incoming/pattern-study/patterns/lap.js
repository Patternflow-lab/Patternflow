// ===== Patternflow pattern =====
// Title:   Lap
// Family:  geometry
// Idea:    Two squares of one size stand low on a bare dark ground, one up and to the left of the other, and overlap by a corner, each lit at half strength, and the four knobs are the colour, the side, how bright the part they share is and how far apart they stand: the shared part runs from dark to the two lights added together, and where it is as bright as one square the corner inside is gone and the pair is one shape.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 166
// Round:   168
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Overlap=-32..16, Apart=0..1
//
// Knob 1: Hue. The colour of both squares, all the way round the wheel from pink.
// Knob 2: Size. The side of both squares, 24 LEDs at 0 to 42 LEDs at 3; its 2 is 36 LEDs.
// Knob 3: Overlap. How bright the part the two squares share is, counted in clicks from where it opens. A square alone is lit at half strength. At the bottom of the knob the shared part is dark and the two are left touching at two corners. At the top it is the two lights added, twice as bright as a square. It opens with the shared part half as bright again as a square. Ten clicks down it is exactly as bright as a square, the corner of each square inside the other is gone and the pair is one shape, and the knob holds that picture for three clicks. The first click past it either way moves the shared part by a fifth of a square's light, so the corners are back at once.
// Knob 4: Apart. How far the second square stands from the first, 2 LEDs across for every 3 down. Where it opens it is a third of a side across and half a side down, and a third of each square lies under the other. Turned up, the squares draw apart until the shared part is a low strip.

const W = 64;
const H = 128;
// The pair stands below the middle of the panel, so the top of the panel is bare.
const CX = 32;
const CY = 76;
// Knob 3 is counted in clicks and the knob has 48 of them, 32 below where it opens and 16 above. Clicks -12, -11 and -10 are the picture with no corner inside.
const LOW = -32;
const HIGH = 16;
const HOLD = -12;
const HOLD_END = -10;
// One click either side of that picture the shared part is this much of a square's light brighter or darker. At the dimmest of the breath that is 21 of the 255 steps an LED has, and five steps, an even share of the knob, left the corner too faint to see.
const STEP = 0.22;
// As far apart as the knob takes them, in opening distances, where the panel is wide enough.
const FAR = 1.6;

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

// How bright the shared part is, in squares' worth of light, for a knob this many clicks from where it opens: 0 at the bottom, 1 on the three held clicks, 2 at the top.
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
  params.side = 36;
  params.ax = 8;
  params.ay = 49;
  params.bx = 20;
  params.by = 67;
  params.extra = -0.5;
  params.colA = new Float32Array(W);
  params.colB = new Float32Array(W);
  params.colBoth = new Float32Array(W);
  params.rowA = new Float32Array(H);
  params.rowB = new Float32Array(H);
  params.rowBoth = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const side = 24 + 6 * clamp(k[1], 0, 3);
  // The second square stands a third of a side across and half a side down where the knob opens: what the two share is then two thirds of a side wide and half a side tall, a third of a square. The biggest squares cannot go the whole way apart, the pair would be wider than the panel.
  const far = Math.min(FAR, (3 * (W - 2 - side)) / side);
  const apart = 1 + ((clamp(k[3], 0, 1) - 0.06) / 0.94) * (far - 1);
  const dx = (side / 3) * apart;
  const dy = (side / 2) * apart;
  params.side = side;
  params.ax = CX - (side + dx) / 2;
  params.ay = CY - (side + dy) / 2;
  params.bx = params.ax + dx;
  params.by = params.ay + dy;
  // What the shared part gets on top of the two squares' own light. Both squares are drawn everywhere they stand, so the shared part starts at two squares' worth.
  params.extra = shared(clamp(k[2], LOW, HIGH)) - 2;
  // Nothing on the panel moves on the clock. Its light swells and falls, both squares and the shared part together, so the panel is never quite still. A square is lit at half of that, which leaves room for two.
  const light = 0.88 + 0.12 * Math.sin(t * 0.57 + 0.15);
  hsv(k[0] + 0.89, 0.66, 0.5 * light, params.c);
}

export function draw(display, params, time) {
  const { side, ax, ay, bx, by, extra, c, colA, colB, colBoth, rowA, rowB, rowBoth } = params;
  for (let x = 0; x < W; x++) {
    colA[x] = span(ax, ax + side, x);
    colB[x] = span(bx, bx + side, x);
    colBoth[x] = span(bx, ax + side, x);
  }
  for (let y = 0; y < H; y++) {
    rowA[y] = span(ay, ay + side, y);
    rowB[y] = span(by, by + side, y);
    rowBoth[y] = span(by, ay + side, y);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = colA[x] * rowA[y] + colB[x] * rowB[y] + extra * colBoth[x] * rowBoth[y];
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
