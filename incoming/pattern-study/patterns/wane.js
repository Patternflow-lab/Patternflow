// ===== Patternflow pattern =====
// Title:   Wane
// Family:  geometry
// Idea:    One square on a ground that the clock slowly lifts and drops, so the square dims into the ground until it is the same brightness and cannot be seen, lingers there, and comes back as a dark hole, with the knobs for its colour, how fast the clock runs, how far it swings either side of the vanishing point and how far the square is slid.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 157; Inlay (pattern round 151) with the clock turning its ground knob
// Round:   159
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0..3, Swing=-1..1, Corner=0..1
//
// Knob 1: Hue. The colour of the square and of the ground, which are the same colour at different brightness.
// Knob 2: Pace. How fast the clock runs: nothing at 0, where the square holds whatever brightness it has, and a swing of about half a minute at its 2. Two clocks run at once, one 1.618 times as fast as the other, and no whole numbers divide that, so the square never comes back to the same sequence.
// Knob 3: Swing. How far the clock goes either side of the point where the square is the same brightness as the ground: a quarter of the way to a full bright square on black one way and to a black hole in the lit ground the other at -1, all the way at 1. Its 0 is a little over half. The square is gone whenever the clock passes the middle of the swing, and there it is slowest.
// Knob 4: Corner. How far the square has slid from the middle towards the lower right corner, from the middle at 0 to 3 LEDs short of both edges at 1. Its 0.06 is just off the middle.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = H / 2;
// How bright the ground gets at most, as a share of the square's full brightness.
const GROUND = 0.3;
// The square is 40 LEDs on a side, and may come no nearer an edge than this.
const HALF = 20;
const MARGIN = 3;
// How many radians a second the first clock runs at the knob's 1. The second runs PHI times as fast.
const RATE = 0.1;
const PHI = 1.6180339887;
// How hard the sum is bent towards 0: 1 would leave it alone, 2 would hold it nearly still there.
const DWELL = 1.6;

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

// Keeps the sign of s and raises its size to DWELL, so the value moves slowest where it is 0.
function bend(s) {
  return s < 0 ? -Math.pow(-s, DWELL) : Math.pow(s, DWELL);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// The ground's level and the square's level, each 0..1, for a balance b from -1 to 1. At -1 the square is full bright on black. At 0 they are both GROUND and the square is gone. At 1 the square is black in the lit ground.
function levels(b, out) {
  if (b < 0) {
    out[0] = GROUND * (1 + b);
    out[1] = GROUND - (1 - GROUND) * b;
  } else {
    out[0] = GROUND;
    out[1] = GROUND * (1 - b);
  }
}

export function setup(params) {
  params.t = 0;
  // The clocks start part of the way through, so the square opens bright and fading towards the ground.
  params.pa = -1.4;
  params.pb = -1.0;
  params.full = [255, 120, 0];
  params.lv = [0.2, 0.5];
  params.cx = CX;
  params.cy = CY;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const pace = clamp(k[1], 0, 3);
  params.pa += dt * RATE * pace;
  params.pb += dt * RATE * PHI * pace;
  // The two clocks added and scaled to -1..1. Bending it keeps the sign and makes it move slowest where it is 0, which is the middle of the swing.
  const s = (Math.sin(params.pa) + 0.6 * Math.sin(params.pb)) / 1.6;
  const swing = 0.25 + 0.75 * ((clamp(k[2], -1, 1) + 1) / 2);
  levels(swing * bend(s), params.lv);
  // At 0 the hue knob would open on red, and a dim red is brown; the colour starts a little round the wheel, on green.
  hsv(k[0] + 0.38, 0.85, 1, params.full);
  const slide = clamp(k[3], 0, 1);
  params.cx = CX + slide * (W / 2 - HALF - MARGIN);
  params.cy = CY + slide * (H / 2 - HALF - MARGIN);
}

export function draw(display, params, time) {
  const full = params.full;
  const ground = params.lv[0];
  const sq = params.lv[1];
  const cx = params.cx;
  const cy = params.cy;
  const gr = full[0] * ground;
  const gg = full[1] * ground;
  const gb = full[2] * ground;
  const dr = full[0] * sq - gr;
  const dg = full[1] * sq - gg;
  const db = full[2] * sq - gb;
  for (let y = 0; y < H; y++) {
    let cv = HALF + 0.5 - Math.abs(y + 0.5 - cy);
    cv = cv < 0 ? 0 : cv > 1 ? 1 : cv;
    for (let x = 0; x < W; x++) {
      let ch = HALF + 0.5 - Math.abs(x + 0.5 - cx);
      ch = ch < 0 ? 0 : ch > 1 ? 1 : ch;
      const c = ch * cv;
      // The ground plus the difference scaled by cover: when the two levels are equal the difference is zero and the square is not there.
      display.setPixel(x, y, gr + dr * c, gg + dg * c, gb + db * c);
    }
  }
}
