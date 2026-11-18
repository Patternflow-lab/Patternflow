// ===== Patternflow pattern =====
// Title:   Skirt
// Family:  geometry
// Idea:    One circle rides the frame of a bare dark panel with its edge on the wall, and the four knobs are the colour, how big the circle is, how far round the frame it has gone and how far it rides from the wall: turned through its range the knob takes the circle round all four corners, and in each corner it sits touching two walls at once for three clicks.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 164
// Round:   166
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Lap=-0.25..0.75, Gap=0.06..1
//
// Knob 1: Hue. The colour of the circle, all the way round the wheel from green-blue.
// Knob 2: Size. The circle's diameter, 18 LEDs at 0 to 36 LEDs at 3; its 2 is 30 LEDs.
// Knob 3: Lap. How far round the frame the circle has gone. It starts in the bottom right corner, goes up the right wall, along the ceiling, down the left wall and along the floor, and is back in the bottom right corner at the far end of the knob. The knob opens a little above the middle of the right wall. In each corner the circle touches two walls at once and holds there for three clicks. The right wall takes 19 clicks and the clicks near each corner move the circle several LEDs each.
// Knob 4: Gap. How far the circle rides from the wall, none at the bottom of the knob, where it opens, and 10 LEDs at 1. The circle still stops in the corners of the track it rides, but it no longer touches the walls there.

const W = 64;
const H = 128;
// The Lap knob has 48 clicks over its range of one. KC are the clicks at which the circle is in each corner (twice at the ends of the knob, which are the same corner), and KU is where along the track it is: 0 is the bottom right corner, 1 the top right, 2 the top left, 3 the bottom left and 4 the bottom right again. Two equal values in a row are a stop, three clicks that hold the picture. The long walls take 19 and 10 clicks, the short ones 4 and 5.
const KC = [0, 2, 21, 23, 27, 29, 39, 41, 46, 48];
const KU = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
const LAP_LO = -0.25;
const LAP_HI = 0.75;
const GAP_MAX = 10;

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

// Where along the track the knob has put the circle, for a knob a number of clicks from its low end.
function along(c) {
  if (c <= KC[0]) return KU[0];
  for (let i = 1; i < KC.length; i++) {
    if (c <= KC[i]) return KU[i - 1] + ((KU[i] - KU[i - 1]) * (c - KC[i - 1])) / (KC[i] - KC[i - 1]);
  }
  return KU[KU.length - 1];
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.cx = 0;
  params.cy = 0;
  params.r = 16;
  params.light = 1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const r = (18 + 6 * clamp(k[1], 0, 3)) / 2;
  const gap = (GAP_MAX * (clamp(k[3], 0.06, 1) - 0.06)) / 0.94;
  // The circle's centre rides a rectangle that keeps the circle's edge on the wall, or the gap from it.
  const xl = r + gap;
  const xr = W - r - gap;
  const yt = r + gap;
  const yb = H - r - gap;
  const u = along((clamp(k[2], LAP_LO, LAP_HI) - LAP_LO) * 48);
  if (u < 1) {
    params.cx = xr;
    params.cy = yb + (yt - yb) * u;
  } else if (u < 2) {
    params.cx = xr + (xl - xr) * (u - 1);
    params.cy = yt;
  } else if (u < 3) {
    params.cx = xl;
    params.cy = yt + (yb - yt) * (u - 2);
  } else {
    params.cx = xl + (xr - xl) * (u - 3);
    params.cy = yb;
  }
  params.r = r;
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.82 + 0.18 * Math.sin(t * 0.57 + 0.4);
  hsv(k[0] + 0.45, 0.85, params.light, params.c);
}

export function draw(display, params, time) {
  const { cx, cy, r, c } = params;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const m = clamp(r + 0.5 - Math.sqrt(dx * dx + dy * dy), 0, 1);
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
