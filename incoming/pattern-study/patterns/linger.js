// ===== Patternflow pattern =====
// Title:   Linger
// Family:  geometry
// Idea:    One disc on a bare dark ground that the clock slowly grows and shrinks, easing almost to a stop where its rim just grazes the side wall and hurrying where it is small or where the wall cuts it, with the knobs for its colour, how fast the clock runs, how far the disc swings either side of the wall and how far it leans across.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 157; Graze (pattern round 150) with the clock turning its size knob
// Round:   159
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0..3, Swing=-1..1, Across=-1..1
//
// Knob 1: Hue. The colour of the disc, turned round the wheel from sky blue.
// Knob 2: Pace. How fast the clock runs: nothing at 0, where the disc holds whatever size it has, and a swing of about half a minute at its 2. Two clocks run at once, one 1.618 times as fast as the other, and no whole numbers divide that, so the disc never comes back to the same sequence.
// Knob 3: Swing. How far the disc goes either side of the size at which its rim grazes the wall: a quarter of the way to its smallest and largest at -1, all the way at 1. Its 0 is a little over half. The wall touches the disc whenever the clock passes the middle of the swing, and there it is slowest.
// Knob 4: Across. How far the disc has leaned towards the left or right wall, up to 14 LEDs at either end; the size at which the nearer wall grazes it is smaller the further it leans, and the slow place moves with it. Its 0.06 is under one LED to the right of the middle.

const W = 64;
const H = 128;
// How many radians a second the first clock runs at the knob's 1. The second runs PHI times as fast.
const RATE = 0.1;
const PHI = 1.6180339887;
// How hard the sum is bent towards 0: 1 would leave it alone, 2 would hold it nearly still there.
const DWELL = 1.6;
// The diameter at its smallest and at its biggest, and the most the disc leans to the side.
const SMALL = 26;
const BIG = 90;
const LEAN = 14;

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

export function setup(params) {
  params.t = 0;
  // The clocks start part of the way through, so the disc opens small and growing towards the wall.
  params.pa = -1.4;
  params.pb = -1.0;
  params.r = 25;
  params.cx = W / 2;
  params.cy = H / 2;
  params.col = new Float32Array(3);
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
  const q = swing * bend(s);
  // The disc grazes the nearer side wall when its diameter is the panel's width less twice the lean. That size is the middle of the swing.
  const lean = clamp(k[3], -1, 1) * LEAN;
  const graze = W - 2 * Math.abs(lean);
  const d = q < 0 ? graze + q * (graze - SMALL) : graze + q * (BIG - graze);
  params.r = d / 2;
  params.cx = W / 2 + lean;
  params.cy = H / 2;
  // Nothing wanders on the clock but the size, so the wall touches the disc where the knob says.
  hsv(k[0] + 0.5, 0.8, 0.92, params.col);
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
