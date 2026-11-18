// ===== Patternflow pattern =====
// Title:   Inlay
// Family:  geometry
// Idea:    One square on a ground that is lit a little, and the third knob dims the square and lifts the ground until the square is the same brightness as the ground and cannot be seen, then carries on until it is a dark hole.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 149
// Round:   151
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Side=0..3, Ground=-1..1, Corner=0..1
//
// Knob 1: Hue. The colour of the square and of the ground, which are the same colour at different brightness.
// Knob 2: Side. How long a side of the square is, from 16 LEDs at 0 to 52 at 3; the knob's 2 is 40.
// Knob 3: Ground. At -1 the square is full bright on black. Turning up, the ground lifts and the square dims. At 0.5 they meet at the same brightness and the square is gone, and the knob holds there for three clicks (0.458 to 0.542). Past that the square goes on dimming to a black hole in the lit ground at 1. It opens at 0, twelve clicks before the square vanishes.
// Knob 4: Corner. How far the square has slid from the middle towards the lower right corner, from the middle at 0 to 3 LEDs short of both edges at 1. Its 0.06 is just off the middle.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = H / 2;
// How bright the ground gets at most, as a share of the square's full brightness.
const GROUND = 0.3;
// The square vanishes at this value of the third knob. The knob turns 48 clicks across its range of 2, and the hold is the click either side of the vanishing one as well.
const STOP = 0.5;
const HOLD = 2 / 48;
// How close the square may come to an edge.
const MARGIN = 3;

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

// The ground's level and the square's level, each 0..1, for the third knob.
function levels(u, out) {
  const lo = STOP - HOLD;
  const hi = STOP + HOLD;
  if (u < lo) {
    const p = (u + 1) / (lo + 1);
    out[0] = GROUND * p;
    out[1] = 1 - (1 - GROUND) * p;
  } else if (u <= hi) {
    out[0] = GROUND;
    out[1] = GROUND;
  } else {
    out[0] = GROUND;
    out[1] = GROUND * (1 - (u - hi) / (1 - hi));
  }
}

export function setup(params) {
  params.t = 0;
  params.full = [255, 120, 0];
  params.lv = [0.2, 0.5];
  params.gain = 1;
  params.half = 20;
  params.cx = CX;
  params.cy = CY;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // At 0 the hue knob would open on red, and a dim red is brown; the colour starts a little round the wheel, on green.
  hsv(k[0] + 0.38, 0.85, 1, params.full);
  levels(k[2], params.lv);
  // The whole panel swells and dims a few percent together, so the square and the ground stay the same brightness when they have met.
  params.gain = 1 + 0.06 * Math.sin(params.t * 0.83);
  const half = (16 + 12 * k[1]) / 2;
  params.half = half;
  params.cx = CX + k[3] * (W / 2 - half - MARGIN);
  params.cy = CY + k[3] * (H / 2 - half - MARGIN);
}

export function draw(display, params, time) {
  const full = params.full;
  const g = params.gain;
  const ground = params.lv[0] * g;
  const sq = params.lv[1] * g;
  const half = params.half;
  const cx = params.cx;
  const cy = params.cy;
  const gr = full[0] * ground;
  const gg = full[1] * ground;
  const gb = full[2] * ground;
  const dr = full[0] * sq - gr;
  const dg = full[1] * sq - gg;
  const db = full[2] * sq - gb;
  for (let y = 0; y < H; y++) {
    let cv = half + 0.5 - Math.abs(y + 0.5 - cy);
    cv = cv < 0 ? 0 : cv > 1 ? 1 : cv;
    for (let x = 0; x < W; x++) {
      let ch = half + 0.5 - Math.abs(x + 0.5 - cx);
      ch = ch < 0 ? 0 : ch > 1 ? 1 : ch;
      const c = ch * cv;
      // The ground plus the difference scaled by cover: when the two levels are equal the difference is zero and the square is not there.
      display.setPixel(x, y, gr + dr * c, gg + dg * c, gb + db * c);
    }
  }
}
