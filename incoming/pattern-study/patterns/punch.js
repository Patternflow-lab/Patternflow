// ===== Patternflow pattern =====
// Title:   Punch
// Family:  geometry
// Idea:    One disc on a ground that is lit a little, and the third knob dims the disc and lifts the ground until the disc is the same brightness as the ground and cannot be seen, then carries on until it is a dark hole.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 149
// Round:   151
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Diameter=0..3, Ground=-1..1, Drop=0..1
//
// Knob 1: Hue. The colour of the disc and of the ground, which are the same colour at different brightness.
// Knob 2: Diameter. How wide the disc is, from 16 LEDs at 0 to 52 at 3; the knob's 2 is 40.
// Knob 3: Ground. At -1 the disc is full bright on black. Turning up, the ground lifts and the disc dims. At 0.5 they meet at the same brightness and the disc is gone, and the knob holds there for three clicks (0.458 to 0.542). Past that the disc goes on dimming to a black hole in the lit ground at 1. It opens at 0, twelve clicks before the disc vanishes.
// Knob 4: Drop. How far the disc has slid down the panel, from the middle at 0 to 3 LEDs short of the bottom edge at 1. Its 0.06 is just below the middle.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = H / 2;
// How bright the ground gets at most, as a share of the disc's full brightness.
const GROUND = 0.3;
// The disc vanishes at this value of the third knob. The knob turns 48 clicks across its range of 2, and the hold is the click either side of the vanishing one as well.
const STOP = 0.5;
const HOLD = 2 / 48;
// How close the disc may come to the bottom edge.
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

// The ground's level and the disc's level, each 0..1, for the third knob.
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
  params.full = [0, 200, 255];
  params.lv = [0.2, 0.5];
  params.gain = 1;
  params.r = 20;
  params.cy = CY;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // At 0 the hue knob would open on red, and a dim red is brown; the colour starts a little round the wheel, on cyan.
  hsv(k[0] + 0.5, 0.85, 1, params.full);
  levels(k[2], params.lv);
  // The whole panel swells and dims a few percent together, so the disc and the ground stay the same brightness when they have met.
  params.gain = 1 + 0.06 * Math.sin(params.t * 0.83);
  const r = (16 + 12 * k[1]) / 2;
  params.r = r;
  params.cy = CY + k[3] * (H / 2 - r - MARGIN);
}

export function draw(display, params, time) {
  const full = params.full;
  const g = params.gain;
  const ground = params.lv[0] * g;
  const disc = params.lv[1] * g;
  const r = params.r;
  const cy = params.cy;
  const gr = full[0] * ground;
  const gg = full[1] * ground;
  const gb = full[2] * ground;
  const dr = full[0] * disc - gr;
  const dg = full[1] * disc - gg;
  const db = full[2] * disc - gb;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - cy;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX;
      let c = 0.5 - (Math.sqrt(dx * dx + dy * dy) - r);
      c = c < 0 ? 0 : c > 1 ? 1 : c;
      // The ground plus the difference scaled by cover: when the two levels are equal the difference is zero and the disc is not there.
      display.setPixel(x, y, gr + dr * c, gg + dg * c, gb + db * c);
    }
  }
}
