// ===== Patternflow pattern =====
// Title:   Lozenge
// Family:  geometry
// Idea:    A panel lit all over, dimly, with one diamond-shaped hole cut out of it low down, and the four knobs are the colour, how tall the diamond stretches, how wide it has grown and how low it sits: the diamond widens until its side points reach both walls, and the lit panel, one piece until then, is a top and a bottom.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 168
// Round:   170
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tall=2..4, Hole=-24..24, Rise=-0.88..1
//
// Knob 1: Hue. The colour of the lit panel, all the way round the wheel from violet.
// Knob 2: Tall. How much taller than wide the diamond is, 1 to 1 at 2 (where it opens, a square stood on a corner) to 1 to 2 at 4. At 4, with the diamond as wide as the panel, its four points are on the four walls.
// Knob 3: Hole. How wide the diamond is from side point to side point, 44 LEDs where it opens, 2.1 LEDs wider with every click up to 65 LEDs, ten clicks on, and down to 4 LEDs at the bottom of the knob. At 65 LEDs the side points are a half LED past the walls, the lit panel is a top and a bottom where it was one piece a click before, and the knob holds that for three clicks. Past it the diamond grows a click at a time by a LED and a half.
// Knob 4: Rise. How high the diamond sits, up to 18 LEDs up at 1 and up to 18 LEDs down at -0.88; where it opens, 0.06, it is in the lower half. The diamond keeps 6 LEDs from the top and bottom walls, so a bigger one has less room and the same turn carries it less far, none at all once it is as tall as the panel.

const W = 64;
const H = 128;
// Where the diamond's middle is when Rise is at its own middle, and how far Rise carries it either way.
const REST = 82;
const SHIFT = 18;
// The diamond keeps this far from the top and bottom walls unless it is too tall for that.
const MARGIN = 6;
// Knob 3 is counted in clicks and the knob has 48 of them, 24 below where it opens and 24 above. The diamond reaches past the walls on clicks 10, 11 and 12.
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

// Where the diamond's middle is for a Rise of -1 to 1, and a diamond this many LEDs from its middle to its top: REST at 0, and carried up or down by up to SHIFT LEDs. It keeps MARGIN LEDs from the top and bottom walls, so the bigger it is the less room it has and the less far the same turn carries it; a diamond too tall for the margin stays in the middle.
function centreFor(rise, half) {
  const lo = half + MARGIN;
  const hi = H - half - MARGIN;
  if (lo > hi) return H / 2;
  const base = clamp(REST, lo, hi);
  return rise >= 0 ? base - rise * Math.min(SHIFT, base - lo) : base - rise * Math.min(SHIFT, hi - base);
}

// The diamond's width in LEDs for a knob this many clicks from where it opens: 4 at the bottom, 44 where it opens, 65 on the three held clicks, 83 at the top. A point is one LED wide where it meets a wall, so the diamond goes a half LED past each wall to cut the lit panel there; 64 would leave a faint thread.
function widthAt(c) {
  if (c <= 0) return 44 + ((44 - 4) / 24) * c;
  if (c < STOP) return 44 + 2.1 * c;
  if (c <= STOP_END + 1e-6) return 65;
  return 65 + 1.5 * (c - STOP_END);
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.rx = 22;
  params.ry = 22;
  params.cy = REST;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const wide = widthAt(clamp(k[2], -24, 24));
  const tall = 1 + (clamp(k[1], 2, 4) - 2) / 2;
  params.rx = wide / 2;
  params.ry = (tall * wide) / 2;
  // Rise is -1 to 1 either side of its middle, 0.06.
  const rise = clamp((k[3] - 0.06) / 0.94, -1, 1);
  params.cy = centreFor(rise, params.ry);
  // The diamond does not move on the clock. The colour wanders a few degrees and the light swells and falls over the whole panel, so the panel is never quite still. The lit part stays under half strength.
  hsv(k[0] + 0.74 + 0.03 * Math.sin(t * 0.43), 0.62, 0.49 * (0.92 + 0.08 * Math.sin(t * 0.57 + 2)), params.col);
}

export function draw(display, params, time) {
  const { rx, ry, cy, col } = params;
  // How far this LED's middle is outside the diamond's edge, in LEDs: the level of |dx| / rx + |dy| / ry over the slope of that sum, which is the same all round the edge.
  const slope = Math.sqrt(1 / (rx * rx) + 1 / (ry * ry));
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - cy;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      let lit = 1;
      if (Math.abs(dx) < rx + 1 && Math.abs(dy) < ry + 1) {
        const sd = (Math.abs(dx) / rx + Math.abs(dy) / ry - 1) / slope;
        // The diamond covers this much of the LED, so the lit panel is that much less.
        lit = clamp(0.5 + sd, 0, 1);
      }
      display.setPixel(x, y, col[0] * lit, col[1] * lit, col[2] * lit);
    }
  }
}
