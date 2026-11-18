// ===== Patternflow pattern =====
// Title:   Lean
// Family:  geometry
// Idea:    One triangle stands on the floor of a bare dark panel with its tip on the wall, and the four knobs are the colour, how wide its base is, how far up the frame the tip has climbed and how far the tip stands in from the wall: turned through its range the knob takes the tip up the left wall, along the ceiling and down the right wall, and at each top corner the tip is pinned in the corner for three clicks.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 164
// Round:   166
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Base=0..3, Climb=-0.17..0.83, Inset=0.06..1
//
// Knob 1: Hue. The colour of the triangle, all the way round the wheel from violet.
// Knob 2: Base. The width of the base on the floor, 16 LEDs at 0 to the whole 64 LEDs of the panel at 3; its 2 is 48 LEDs. At 3 the base is the whole floor, and with the tip in a top corner the triangle covers half the panel.
// Knob 3: Climb. How far the tip has gone round the frame. It starts at the foot of the left wall, a flat sliver 16 LEDs tall, climbs the left wall, crosses the ceiling and comes down the right wall to the same height. The knob opens with the tip on the left wall a little over halfway up. At each top corner the tip is pinned in the corner and the knob holds for three clicks. The clicks move the tip between 6 and 7 LEDs each.
// Knob 4: Inset. How far the tip stands in from the wall, none at the bottom of the knob, where it opens, and 20 LEDs at 1. The tip still turns at the corners of the track it follows, but it no longer touches the walls there.

const W = 64;
const H = 128;
// The tip does not start at the floor: at its lowest it is 16 LEDs up, so the triangle is a sliver and not a line.
const LOW = 16;
// The Climb knob has 48 clicks over its range of one. KC are the clicks at which the tip is in a corner of the track, and KU is where along it the tip is: 0 is the foot of the left wall, 1 the top left corner, 2 the top right corner and 3 the foot of the right wall. Two equal values in a row are a stop, three clicks that hold the picture.
const KC = [0, 18, 20, 29, 31, 48];
const KU = [0, 1, 1, 2, 2, 3];
const CLIMB_LO = -0.17;
const CLIMB_HI = 0.83;
const INSET_MAX = 20;

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

// Where along the track the knob has put the tip, for a knob a number of clicks from its low end.
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
  params.v = new Float32Array(6);
  params.light = 1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const base = 16 + 16 * clamp(k[1], 0, 3);
  const inset = (INSET_MAX * (clamp(k[3], 0.06, 1) - 0.06)) / 0.94;
  const u = along((clamp(k[2], CLIMB_LO, CLIMB_HI) - CLIMB_LO) * 48);
  let ax;
  let ay;
  if (u < 1) {
    ax = inset;
    ay = H - LOW + (inset - (H - LOW)) * u;
  } else if (u < 2) {
    ax = inset + (W - 2 * inset) * (u - 1);
    ay = inset;
  } else {
    ax = W - inset;
    ay = inset + (H - LOW - inset) * (u - 2);
  }
  const v = params.v;
  v[0] = ax;
  v[1] = ay;
  v[2] = W / 2 - base / 2;
  v[3] = H;
  v[4] = W / 2 + base / 2;
  v[5] = H;
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.84 + 0.16 * Math.sin(t * 0.73 + 2.1);
  hsv(k[0] + 0.8, 0.85, params.light, params.c);
}

export function draw(display, params, time) {
  const { v, c } = params;
  // Which way round the three corners go, so that inside is the same side of every edge.
  const area = (v[2] - v[0]) * (v[5] - v[1]) - (v[4] - v[0]) * (v[3] - v[1]);
  const o = area < 0 ? -1 : 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const qx = x + 0.5;
      const qy = y + 0.5;
      let d = 1e9;
      for (let i = 0; i < 3; i++) {
        const x0 = v[2 * i];
        const y0 = v[2 * i + 1];
        const x1 = v[2 * ((i + 1) % 3)];
        const y1 = v[2 * ((i + 1) % 3) + 1];
        const ex = x1 - x0;
        const ey = y1 - y0;
        const e = (o * (ex * (qy - y0) - ey * (qx - x0))) / Math.sqrt(ex * ex + ey * ey);
        if (e < d) d = e;
      }
      const m = clamp(d + 0.5, 0, 1);
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
