// ===== Patternflow pattern =====
// Title:   Slump
// Family:  geometry
// Idea:    A bar 64 LEDs long slides down a wall in the dark with one end on the wall and the other on the floor, and the knob holds where it lies on the floor touching both side walls and where it stands against the left wall.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 175
// Round:   177
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Weight=1..3, Height=-24..24, Lift=0.06..1
//
// Knob 1: Hue. The colour of the bar, turned all the way round the wheel from a pale green.
// Knob 2: Weight. How thick the bar is, 5 LEDs at 1, 12 where it opens at 2 and 19 at 3; its length stays 64.
// Knob 3: Height. How high the end on the left wall is, counted in clicks of about one and a half LEDs, 44 of them from the floor to 64 LEDs. Where it opens it is 32 LEDs up and the bar leans at 30 degrees. Turn down and in 22 clicks it lies on the floor from one side wall to the other, held for the bottom three clicks. Turn up and in 22 clicks it stands against the left wall with its foot in the corner, held for the top three. Next to each hold the end on the wall moves about a LED and a half a click.
// Knob 4: Lift. How far above the floor the whole bar is held, up to 48 LEDs. At the bottom its low end is on the floor; raised, it no longer touches the floor, but it is still level where it lies, still upright where it stands, and still reaches the walls it reached.

const W = 64;
const H = 128;
const LEN = 64;
const LIFT_MAX = 48;
// Knob 3 has 48 clicks and opens 24 above its bottom.
const OPEN = 24;
const EPS = 1e-6;

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

// How high the end on the wall is at a click: on the floor for the bottom three, the full length for the top three, and an even climb between.
function heightAt(q) {
  if (q <= 2) return 0;
  if (q >= 46) return LEN;
  return (LEN * (q - 2)) / 44;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.h = 32;
  params.thick = 12;
  params.lift = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  params.thick = 12 + 7 * (clamp(k[1], 1, 3) - 2);
  params.h = heightAt(clamp(k[2], -OPEN, 48 - OPEN) + OPEN);
  params.lift = (LIFT_MAX * clamp(k[3] - 0.06, 0, 0.94)) / 0.94;
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still. The bar lights few LEDs, so the swell is wide.
  hsv(k[0] + 0.4 + 0.02 * Math.sin(t * 0.37), 0.75, 0.95 * (0.8 + 0.2 * Math.sin(t * 0.9 + 2.1)), params.col);
}

export function draw(display, params, time) {
  const { col, h, thick, lift } = params;
  // The bar leans by phi from the floor: its underside runs from the wall to the floor, LEN long, and the thickness is laid on top of it.
  const phi = Math.asin(clamp(h / LEN, 0, 1));
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const x0 = thick * s;
  const y0 = H - lift - LEN * s - thick * c;
  for (let y = 0; y < H; y++) {
    const ry = y + 0.5 - y0;
    for (let x = 0; x < W; x++) {
      const rx = x + 0.5 - x0;
      // The LED in the bar's own frame: a along its length, b across it from the upper edge to the underside.
      const a = rx * c + ry * s;
      const b = -rx * s + ry * c;
      const m = a >= -EPS && a <= LEN + EPS && b >= -EPS && b <= thick + EPS ? 1 : 0;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
