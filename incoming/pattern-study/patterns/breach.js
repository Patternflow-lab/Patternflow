// ===== Patternflow pattern =====
// Title:   Breach
// Family:  geometry
// Idea:    A panel lit all over, dimly, with one rectangular hole cut out of it a little above the middle, and the four knobs are the colour, how tall the hole stretches, how wide it has grown and how high it sits: the hole widens until it runs from wall to wall, and the lit panel, one piece until then, is a strip above it and a strip below.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 168
// Round:   170
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tall=2..4, Hole=-32..16, Rise=-0.88..1
//
// Knob 1: Hue. The colour of the lit panel, all the way round the wheel from pink.
// Knob 2: Tall. How much taller than wide the hole is, 1 to 1 at 2 (where it opens, a square) to 1 to 1.75 at 4. A hole as wide as the panel and that tall leaves a strip of 8 LEDs above it and below.
// Knob 3: Hole. How wide the hole is, 43 LEDs where it opens, 2.1 LEDs wider with every click up to 64 LEDs, ten clicks on, and down to 4 LEDs at the bottom of the knob. At 64 LEDs the hole runs from wall to wall, the lit panel is two strips where it was one piece a click before, and the knob holds that for three clicks. Past it the hole is wider than the panel and only grows taller, 2.1 LEDs a click, until it is 6 LEDs from the top and bottom walls.
// Knob 4: Rise. How high the hole sits, 22 LEDs up at 1 and 22 LEDs down at -0.88; where it opens, 0.06, it is a little above the middle. A tall hole cannot go far: it keeps 6 LEDs from the top and bottom walls.

const W = 64;
const H = 128;
// Where the hole's middle is when Rise is at its own middle, and how far Rise carries it either way.
const REST = 46;
const SHIFT = 22;
// The hole keeps this far from the top and bottom walls unless it is too tall for that.
const MARGIN = 6;
// Knob 3 is counted in clicks and the knob has 48 of them, 32 below where it opens and 16 above. The hole is as wide as the panel on clicks 10, 11 and 12.
const STOP = 10;
const STOP_END = 12;

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

// The hole's width in LEDs for a knob this many clicks from where it opens: 4 at the bottom, 43 where it opens, 64 on the three held clicks. Past them the width is 2.1 LEDs a click more, which the panel's walls hide; it is only what the height follows.
function widthAt(c) {
  if (c <= 0) return 43 + ((43 - 4) / 32) * c;
  if (c < STOP) return 43 + 2.1 * c;
  if (c <= STOP_END + 1e-6) return 64;
  return 64 + 2.1 * (c - STOP_END);
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.x0 = 10.5;
  params.x1 = 53.5;
  params.y0 = 24.5;
  params.y1 = 67.5;
  params.colHole = new Float32Array(W);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const wide = widthAt(clamp(k[2], -32, 16));
  const tall = 1 + (0.75 * (clamp(k[1], 2, 4) - 2)) / 2;
  // The hole is as tall as it is wide times the stretch, but never so tall that less than 6 LEDs of the lit panel are left above and below it.
  const high = Math.min(tall * wide, H - 2 * MARGIN);
  params.x0 = W / 2 - wide / 2;
  params.x1 = W / 2 + wide / 2;
  // Rise is -1 to 1 either side of its middle, 0.06.
  const rise = clamp((k[3] - 0.06) / 0.94, -1, 1);
  const lo = high / 2 + MARGIN;
  const hi = H - high / 2 - MARGIN;
  const cy = lo > hi ? H / 2 : clamp(REST - rise * SHIFT, lo, hi);
  params.y0 = cy - high / 2;
  params.y1 = cy + high / 2;
  // The hole does not move on the clock. The colour wanders a few degrees and the light swells and falls over the whole panel, so the panel is never quite still. The lit part stays under half strength.
  hsv(k[0] + 0.93 + 0.03 * Math.sin(t * 0.43), 0.66, 0.49 * (0.92 + 0.08 * Math.sin(t * 0.67 + 0.5)), params.col);
}

export function draw(display, params, time) {
  const { x0, x1, y0, y1, col, colHole } = params;
  for (let x = 0; x < W; x++) colHole[x] = span(x0, x1, x);
  for (let y = 0; y < H; y++) {
    const row = span(y0, y1, y);
    for (let x = 0; x < W; x++) {
      // The hole covers this much of the LED, so the lit panel is that much less.
      const lit = 1 - colHole[x] * row;
      display.setPixel(x, y, col[0] * lit, col[1] * lit, col[2] * lit);
    }
  }
}
