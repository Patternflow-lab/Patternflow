// ===== Patternflow pattern =====
// Title:   Bifoil
// Family:  geometry
// Idea:    Two discs of one diameter overlap on a bare dark ground, the lower one drawn over the upper, and the four knobs are the first colour, the diameter, how far round the colour wheel the lower disc's colour is from the first, and how much darker the lower is: turned round to the same colour the edge of the lower disc inside the upper is gone and the pair is one blob with a waist, and at the ends of the knob the two colours are opposite.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 156
// Round:   158
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..4, Turn=-1..1, Dim=0..1
//
// Knob 1: Hue. The colour of the upper disc, all the way round the wheel from orange.
// Knob 2: Size. The diameter of both discs, 16 LEDs at 0 to 60 LEDs at 4; its 2 is 38 LEDs. The two middles stay 0.6 of a diameter apart, so the pair stands 1.6 diameters tall.
// Knob 3: Turn. How far round the colour wheel the lower disc's colour stands from the upper one's. At -1 and at 1 it is half a turn, the opposite colour; moving the knob from -1 the lower colour comes round to the upper one, and at 0.375 it is the same colour and the knob holds there for three clicks, with the arc of the lower disc inside the upper gone; past that it goes round the other way, back to the opposite colour at 1. Its 0 is 45 degrees short of the same colour.
// Knob 4: Dim. How much darker the lower disc is than the upper one: the same light at 0, a quarter of it at 1. Its 0.06 leaves 95.5 percent of it.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = H / 2;
// One click of a knob that has 48 clicks over -1..1. The place the knob holds at is a whole number of clicks from its middle.
const CLICK = 2 / 48;
const SAME = 9 * CLICK;
// How far apart the two middles stand, in diameters.
const APART = 0.6;

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

// How far round the wheel, in turns, the second colour stands from the first for a knob at k: half a turn back at -1, none at SAME where it holds for three clicks, half a turn on at 1.
function turn(k) {
  const d = k - SAME;
  if (Math.abs(d) <= CLICK + 1e-6) return 0;
  if (d < 0) return (-0.5 * (-d - CLICK)) / (SAME + 1 - CLICK);
  return (0.5 * (d - CLICK)) / (1 - SAME - CLICK);
}

export function setup(params) {
  params.t = 0;
  params.a = new Float32Array(3);
  params.b = new Float32Array(3);
  params.dia = 38;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  params.dia = 16 + 11 * clamp(k[1], 0, 4);
  // The size and the place of the discs do not move on the clock, so the two colours meet where the knob says. The colour wanders a few degrees and the light swells and falls, both discs together, only so the panel is never quite still.
  const hue = k[0] + 0.08 + 0.03 * Math.sin(t * 0.43);
  const light = 0.92 + 0.08 * Math.sin(t * 0.61 + 1);
  hsv(hue, 0.85, light, params.a);
  hsv(hue + turn(clamp(k[2], -1, 1)), 0.85, light * (1 - 0.75 * clamp(k[3], 0, 1)), params.b);
}

export function draw(display, params, time) {
  const r = params.dia / 2;
  const { a, b } = params;
  // The upper disc's middle is above the middle of the panel, the lower one's below it, the pair centred.
  const ya = CY - (APART * params.dia) / 2;
  const yb = CY + (APART * params.dia) / 2;
  for (let y = 0; y < H; y++) {
    const dya = y + 0.5 - ya;
    const dyb = y + 0.5 - yb;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX;
      // What each disc covers of this LED, a ramp one LED wide across its rim.
      const ma = clamp(r + 0.5 - Math.sqrt(dx * dx + dya * dya), 0, 1);
      const mb = clamp(r + 0.5 - Math.sqrt(dx * dx + dyb * dyb), 0, 1);
      // The lower disc lies over the upper, so the upper shows through only where the lower is not.
      const ka = ma * (1 - mb);
      display.setPixel(x, y, a[0] * ka + b[0] * mb, a[1] * ka + b[1] * mb, a[2] * ka + b[2] * mb);
    }
  }
}
