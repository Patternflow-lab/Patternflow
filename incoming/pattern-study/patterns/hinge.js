// ===== Patternflow pattern =====
// Title:   Hinge
// Family:  geometry
// Idea:    One thick line is pinned in the bottom left corner of a bare dark panel and its far end rides the right wall and the ceiling, and the four knobs are the colour, how thick the line is, how far its end has gone round the frame and how far up the left wall the pin has come off the corner: turned one way the line swings up from the floor, and at the top right corner its end is pinned there too and the line is the panel's diagonal.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 164
// Round:   166
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Thick=0..3, Swing=-0.3..0.7, Lift=0.06..1
//
// Knob 1: Hue. The colour of the line, all the way round the wheel from azure.
// Knob 2: Thick. The thickness of the line, 4 LEDs at 0 to 13 LEDs at 3; its 2 is 10 LEDs.
// Knob 3: Swing. How far the line's far end has gone round the frame, from the bottom right corner up the right wall and along the ceiling to the top left corner: at the bottom of the knob the line lies along the floor, at the top it stands along the left wall. The knob opens with the end on the right wall, a little under halfway up. When the end reaches the top right corner it is pinned in that corner as well, the line is the panel's diagonal, and the knob holds there for three clicks. The end goes 4 LEDs a click on the way in and a little more on the way out.
// Knob 4: Lift. How far up the left wall the pin has come off the bottom left corner, none at the bottom of the knob, where it opens, and 40 LEDs at 1. The line then runs a little steeper to the same far end.

const W = 64;
const H = 128;
// The Swing knob has 48 clicks over its range of one. KC are the clicks at which the far end has been round the frame by KP LEDs: out of the bottom right corner, up the 128 LEDs of the right wall to the top right corner at 32 clicks, held there for three clicks, and on along the 64 LEDs of the ceiling to the top left corner.
const KC = [0, 32, 34, 48];
const KP = [0, 128, 128, 192];
const SWING_LO = -0.3;
const SWING_HI = 0.7;
const LIFT_MAX = 40;

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

// How far round the frame the knob has put the far end, for a knob a number of clicks from its low end.
function along(c) {
  if (c <= KC[0]) return KP[0];
  for (let i = 1; i < KC.length; i++) {
    if (c <= KC[i]) return KP[i - 1] + ((KP[i] - KP[i - 1]) * (c - KC[i - 1])) / (KC[i] - KC[i - 1]);
  }
  return KP[KP.length - 1];
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.px = 0;
  params.py = H;
  params.ex = W;
  params.ey = 0;
  params.half = 5;
  params.light = 1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const thick = 4 + 3 * clamp(k[1], 0, 3);
  const lift = (LIFT_MAX * (clamp(k[3], 0.06, 1) - 0.06)) / 0.94;
  const p = along((clamp(k[2], SWING_LO, SWING_HI) - SWING_LO) * 48);
  // The far end sits on the wall it rides.
  const fx = p <= 128 ? W : W - (p - 128);
  const fy = p <= 128 ? H - p : 0;
  const px = 0;
  const py = H - lift;
  const dx = fx - px;
  const dy = fy - py;
  const len = Math.sqrt(dx * dx + dy * dy);
  // The line runs on past the wall by its thickness, so the panel's edge cuts it off square to the wall it rides and in the corner it is cut by both.
  params.px = px;
  params.py = py;
  params.ex = fx + (dx / len) * thick;
  params.ey = fy + (dy / len) * thick;
  params.half = thick / 2;
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.82 + 0.18 * Math.sin(t * 0.67 + 1.3);
  hsv(k[0] + 0.58, 0.85, params.light, params.c);
}

export function draw(display, params, time) {
  const { px, py, ex, ey, half, c } = params;
  const ax = ex - px;
  const ay = ey - py;
  const aa = ax * ax + ay * ay;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const qx = x + 0.5 - px;
      const qy = y + 0.5 - py;
      const s = clamp((qx * ax + qy * ay) / aa, 0, 1);
      const ox = qx - s * ax;
      const oy = qy - s * ay;
      // Distance to the line's spine; the pinned end is round, so a half or a quarter of its disc stands on the wall.
      const m = clamp(half + 0.5 - Math.sqrt(ox * ox + oy * oy), 0, 1);
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
