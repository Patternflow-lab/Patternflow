// ===== Patternflow pattern =====
// Title:   Consort
// Family:  geometry
// Idea:    Two circles run round the inside of the frame of a bare dark panel, touching the walls, each on its own clock, and the four knobs are the colour, how fast the first one runs, how much faster or slower the second one runs and how far the second one falls short of straight across the panel when both keep the same pace: there the two run round as one body and keep their distance, and near straight across they reach opposite corners together.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 177
// Round:   179
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0..3, Ratio=-35..13, Offset=0..1
//
// Knob 1: Hue. The colour of both circles, all the way round the wheel from magenta.
// Knob 2: Pace. How fast the first circle runs round the frame, clockwise: still at 0, once round every 18 seconds at its 2, and every 12 seconds at 3.
// Knob 3: Ratio. How much faster the second circle runs than the first, counted in clicks. At the bottom it takes 0.618 times the first one's pace and at the top 1.618 times, the golden ratio either way, with every click in between the same step on a log scale. The three clicks -12, -11 and -10 hold it at exactly the first one's pace: the two then run round as one and keep the distance Offset sets. The knob opens ten clicks above the hold, where the second circle runs 1.233 times as fast, catches the first and runs through it. The click either side of the hold moves it about 6 LEDs along the frame every lap, and turned back onto the hold it falls back to the set distance at once.
// Knob 4: Offset. How far along the frame the second circle falls short of straight across the panel when the two keep the same pace: straight across at 0, 7 LEDs short at 0.06 where the knob opens, and at 1 just ahead of the first circle, touching it on a straight wall.

const W = 64;
const H = 128;
// The circles are 24 LEDs across, so their middles run on a path 12 LEDs in from every wall.
const R = 12;
const X0 = R;
const X1 = W - R;
const Y0 = R;
const Y1 = H - R;
const ACROSS = X1 - X0;
const DOWN = Y1 - Y0;
const LAP = 2 * (ACROSS + DOWN);
const HALF = LAP / 2;
// LEDs along the path a second at a Pace of 1.
const SPEED = 8;
// Knob 3: the hold runs from HOLD_LO to HOLD_HI clicks, and 23 clicks each side of it reach the golden ratio.
const HOLD_LO = -12;
const HOLD_HI = -10;
const SIDE_CLICKS = 23;
const PHI = 1.6180339887;

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

// The second clock's pace over the first one's for a click of the Ratio knob.
function ratioAt(c) {
  let u = 0;
  if (c > HOLD_HI) u = (c - HOLD_HI) / SIDE_CLICKS;
  else if (c < HOLD_LO) u = (c - HOLD_LO) / SIDE_CLICKS;
  return Math.pow(PHI, u);
}

// Where on the panel a middle s LEDs along the path stands, clockwise from the top left corner.
function along(s, out, i) {
  s = s - Math.floor(s / LAP) * LAP;
  let x;
  let y;
  if (s < ACROSS) {
    x = X0 + s;
    y = Y0;
  } else if (s < ACROSS + DOWN) {
    x = X1;
    y = Y0 + s - ACROSS;
  } else if (s < 2 * ACROSS + DOWN) {
    x = X1 - (s - ACROSS - DOWN);
    y = Y1;
  } else {
    x = X0;
    y = Y1 - (s - 2 * ACROSS - DOWN);
  }
  out[i] = x;
  out[i + 1] = y;
}

export function setup(params) {
  params.run = 0;
  params.gain = 0;
  params.rgb = new Float32Array(3);
  params.at = new Float32Array(4);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const r = ratioAt(clamp(k[2], -35, 13));
  const step = dt * SPEED * clamp(k[1], 0, 3);
  params.run += step;
  const behind = (HALF - 2 * R) * clamp(k[3], 0, 1);
  // The second circle's run is the first one's run and what it has gained on it, the ratio less 1 of
  // every step. With the knobs left alone that is the first one's run times the ratio. On the hold the
  // gain is cleared, so the two come back the set distance apart instead of keeping whatever gap they
  // had, and a click off the hold starts from there instead of jumping.
  params.gain = r === 1 ? 0 : params.gain + step * (r - 1);
  along(params.run, params.at, 0);
  along(params.run + params.gain + HALF - behind, params.at, 2);
  hsv(k[0] + 0.88, 0.75, 0.95, params.rgb);
}

export function draw(display, params, time) {
  const { at, rgb } = params;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ax = x + 0.5 - at[0];
      const ay = y + 0.5 - at[1];
      const bx = x + 0.5 - at[2];
      const by = y + 0.5 - at[3];
      const a = clamp(R + 0.5 - Math.sqrt(ax * ax + ay * ay), 0, 1);
      const b = clamp(R + 0.5 - Math.sqrt(bx * bx + by * by), 0, 1);
      const m = a > b ? a : b;
      display.setPixel(x, y, rgb[0] * m, rgb[1] * m, rgb[2] * m);
    }
  }
}
