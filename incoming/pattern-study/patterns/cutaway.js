// ===== Patternflow pattern =====
// Title:   Cutaway
// Family:  geometry
// Idea:    One triangle on a ground that is lit a little, and the third knob dims the triangle and lifts the ground until the triangle is the same brightness as the ground and cannot be seen, then carries on until it is a dark hole.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 149
// Round:   151
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Edge=0..3, Ground=-1..1, Rise=0..1
//
// Knob 1: Hue. The colour of the triangle and of the ground, which are the same colour at different brightness.
// Knob 2: Edge. How long each side of the triangle is, from 18 LEDs at 0 to 57 at 3; the knob's 2 is 44. The apex is up.
// Knob 3: Ground. At -1 the triangle is full bright on black. Turning up, the ground lifts and the triangle dims. At 0.5 they meet at the same brightness and the triangle is gone, and the knob holds there for three clicks (0.458 to 0.542). Past that the triangle goes on dimming to a black hole in the lit ground at 1. It opens at 0, twelve clicks before the triangle vanishes.
// Knob 4: Rise. How far the triangle has slid up the panel, from the middle at 0 to its apex 3 LEDs short of the top edge at 1. Its 0.06 is just above the middle.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = H / 2;
// How bright the ground gets at most, as a share of the triangle's full brightness.
const GROUND = 0.3;
// The triangle vanishes at this value of the third knob. The knob turns 48 clicks across its range of 2, and the hold is the click either side of the vanishing one as well.
const STOP = 0.5;
const HOLD = 2 / 48;
// How close the apex may come to the top edge.
const MARGIN = 3;
const SIN60 = Math.sqrt(3) / 2;

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

// The ground's level and the triangle's level, each 0..1, for the third knob.
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
  params.edge = 34;
  params.cy = CY;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // At 0 the hue knob would open on red, and a dim red is brown; the colour starts a little round the wheel, on violet.
  hsv(k[0] + 0.78, 0.8, 1, params.full);
  levels(k[2], params.lv);
  // The whole panel swells and dims a few percent together, so the triangle and the ground stay the same brightness when they have met.
  params.gain = 1 + 0.06 * Math.sin(params.t * 0.83);
  const edge = 18 + 13 * k[1];
  params.edge = edge;
  // The middle of the triangle's weight slides up until the apex is 3 LEDs from the top edge: the apex is two thirds of the height above that middle.
  params.cy = CY - k[3] * (CY - (2 * edge * SIN60) / 3 - MARGIN);
}

export function draw(display, params, time) {
  const full = params.full;
  const g = params.gain;
  const ground = params.lv[0] * g;
  const tri = params.lv[1] * g;
  const edge = params.edge;
  const cy = params.cy;
  const height = edge * SIN60;
  const apex = cy - (2 * height) / 3;
  const base = cy + height / 3;
  const gr = full[0] * ground;
  const gg = full[1] * ground;
  const gb = full[2] * ground;
  const dr = full[0] * tri - gr;
  const dg = full[1] * tri - gg;
  const db = full[2] * tri - gb;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    const down = py - apex;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - CX;
      // How far inside each of the three sides the LED's middle is: the base, then the two slanted sides at 60 degrees.
      const inBase = base - py;
      const inLeft = SIN60 * px + 0.5 * down;
      const inRight = -SIN60 * px + 0.5 * down;
      let d = inBase < inLeft ? inBase : inLeft;
      d = d < inRight ? d : inRight;
      let c = 0.5 + d;
      c = c < 0 ? 0 : c > 1 ? 1 : c;
      // The ground plus the difference scaled by cover: when the two levels are equal the difference is zero and the triangle is not there.
      display.setPixel(x, y, gr + dr * c, gg + dg * c, gb + db * c);
    }
  }
}
