// ===== Patternflow pattern =====
// Title:   Eyelet
// Family:  geometry
// Idea:    A panel lit all over, dimly, with one round hole cut out of it in the upper half, and the four knobs are the colour, how tall the hole stretches, how wide it has grown and how high it sits: the hole widens until it is as wide as the panel and touches both walls, and the lit panel, one piece until then, is a top and a bottom.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 168
// Round:   170
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tall=2..4, Hole=-22..26, Rise=-0.88..1
//
// Knob 1: Hue. The colour of the lit panel, all the way round the wheel from teal.
// Knob 2: Tall. How much taller than wide the hole is, 1 to 1 at 2 (where it opens, a circle) to 1 to 2 at 4. At 4, with the hole as wide as the panel, it is as tall as the panel too and touches all four walls.
// Knob 3: Hole. How wide the hole is, 38.8 LEDs where it opens, 2.1 LEDs wider with every click up to 64 LEDs, twelve clicks on, and down to 4 LEDs at the bottom of the knob. At 64 LEDs the hole is as wide as the panel and touches both walls, the lit panel is a top and a bottom where it was one piece a click before, and the knob holds that for three clicks. Past it the hole grows a click at a time by a LED and a half, off the walls.
// Knob 4: Rise. How high the hole sits, 22 LEDs up at 1 and 22 LEDs down at -0.88; where it opens, 0.06, it is in the upper half. A tall hole cannot go far: it keeps 6 LEDs from the top and bottom walls until it is as tall as the panel.

const W = 64;
const H = 128;
// Where the hole's middle is when Rise is at its own middle, and how far Rise carries it either way.
const REST = 52;
const SHIFT = 22;
// The hole keeps this far from the top and bottom walls unless it is too tall for that.
const MARGIN = 6;
// Knob 3 is counted in clicks and the knob has 48 of them, 22 below where it opens and 26 above. The hole is as wide as the panel on clicks 12, 13 and 14.
const STOP = 12;
const STOP_END = 14;

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

// The hole's width in LEDs for a knob this many clicks from where it opens: 4 at the bottom, 38.8 where it opens, 64 on the three held clicks, 82 at the top. Each click up to the walls moves the hole's edge by 1.05 LEDs.
function widthAt(c) {
  if (c <= 0) return 38.8 + ((38.8 - 4) / 22) * c;
  if (c < STOP) return 38.8 + 2.1 * c;
  if (c <= STOP_END + 1e-6) return 64;
  return 64 + 1.5 * (c - STOP_END);
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.rx = 20;
  params.ry = 20;
  params.cy = REST;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const wide = widthAt(clamp(k[2], -22, 26));
  const tall = 1 + (clamp(k[1], 2, 4) - 2) / 2;
  params.rx = wide / 2;
  params.ry = (tall * wide) / 2;
  // Rise is -1 to 1 either side of its middle, 0.06.
  const rise = clamp((k[3] - 0.06) / 0.94, -1, 1);
  const lo = params.ry + MARGIN;
  const hi = H - params.ry - MARGIN;
  params.cy = lo > hi ? H / 2 : clamp(REST - rise * SHIFT, lo, hi);
  // The hole does not move on the clock. The colour wanders a few degrees and the light swells and falls over the whole panel, so the panel is never quite still. The lit part stays under half strength.
  hsv(k[0] + 0.52 + 0.03 * Math.sin(t * 0.43), 0.68, 0.49 * (0.92 + 0.08 * Math.sin(t * 0.61 + 1)), params.col);
}

export function draw(display, params, time) {
  const { rx, ry, cy, col } = params;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - cy;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      let lit = 1;
      if (Math.abs(dx) < rx + 1 && Math.abs(dy) < ry + 1) {
        // How far this LED's middle is outside the hole's edge, in LEDs, from the ellipse's own equation: the level of the equation over its slope.
        const f = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
        let sd = -Math.min(rx, ry);
        if (f > 1e-6) {
          const gx = dx / (rx * rx);
          const gy = dy / (ry * ry);
          sd = ((f - 1) * f) / Math.sqrt(gx * gx + gy * gy);
        }
        // The hole covers this much of the LED, so the lit panel is that much less.
        lit = clamp(0.5 + sd, 0, 1);
      }
      display.setPixel(x, y, col[0] * lit, col[1] * lit, col[2] * lit);
    }
  }
}
