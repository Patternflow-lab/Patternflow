// ===== Patternflow pattern =====
// Title:   Graze
// Family:  geometry
// Idea:    One disc on a bare dark ground that grows until its rim just grazes both side walls, and goes on growing into a disc with flat sides where the walls cut it, with the knobs for its colour, its size and how far it is slid down and across.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 148
// Round:   150
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Down=-1..1, Across=-1..1
//
// Knob 1: Hue. The colour of the disc, turned round the wheel from sky blue.
// Knob 2: Size. The disc's diameter, 12 LEDs at 0 to 90 at 3. At 64 LEDs the rim just grazes both side walls and the knob holds there for three clicks; past that the walls cut a flat side into the disc, short at first and growing fast. The knob's 2 is 56 LEDs, four LEDs short of the walls on each side.
// Knob 3: Down. Where the disc stands from top to bottom, from the top wall at -1 to the bottom wall at 1, with its middle on the wall at either end, so a half disc. It grazes the top or bottom wall for three clicks before the wall starts to cut it.
// Knob 4: Across. The same from side to side. It grazes the left or right wall for three clicks first. Its 0.06 is two LEDs to the right of the middle.

const W = 64;
const H = 128;
// Three clicks of a knob that has 48 clicks over its range: how long a wall holds the disc.
const HOLD = 3 / 48;

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

// The shape's place goes one for one with a knob that runs from -1 to 1 until the shape touches a wall at |p| = touch, stays there for `run` of the knob, then goes on to the end of the knob.
function hold(v, touch, run) {
  const a = Math.abs(v);
  const room = Math.min(run, (1 - touch) / 2);
  let p;
  if (a <= touch) p = a;
  else if (a <= touch + room) p = touch;
  else p = touch + ((a - touch - room) * (1 - touch)) / (1 - touch - room);
  return v < 0 ? -p : p;
}

export function setup(params) {
  params.t = 0;
  params.r = 28;
  params.cx = W / 2;
  params.cy = H / 2;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The diameter runs 12 to 64 LEDs over the first 2.36 of the knob, stays at 64 for three clicks (0.1875), then runs to 90 at 3.
  const kn = k[1] < 0 ? 0 : k[1] > 3 ? 3 : k[1];
  const flat = 2.36;
  const d = kn < flat ? 12 + (52 * kn) / flat : kn < flat + 0.1875 ? 64 : 64 + (26 * (kn - flat - 0.1875)) / (3 - flat - 0.1875);
  params.r = d / 2;
  // The disc grazes the top and bottom walls when its middle is d / 2 from them, and a side wall at |64 - d| / 64 of the way across.
  const down = hold(k[2], 1 - d / H, HOLD * 2);
  const across = hold(k[3], Math.abs(1 - d / W), HOLD * 2);
  params.cy = H / 2 + (H / 2) * down;
  params.cx = W / 2 + (W / 2) * across;
  // Nothing about the disc's size or place moves on the clock, so that every wall touches it where the knob says. The colour wanders a few degrees and the light swells and falls, only so the panel is never quite still.
  hsv(k[0] + 0.5 + 0.03 * Math.sin(t * 0.43), 0.8, 0.92 + 0.08 * Math.sin(t * 0.61 + 1), params.col);
}

export function draw(display, params, time) {
  const r = params.r;
  const cx = params.cx;
  const cy = params.cy;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - cy;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      let m = r + 0.5 - Math.sqrt(dx * dx + dy * dy);
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
