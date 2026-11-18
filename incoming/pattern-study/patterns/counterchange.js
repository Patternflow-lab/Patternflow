// ===== Patternflow pattern =====
// Title:   Counterchange
// Family:  geometry
// Idea:    One wide rectangle and a lit half of the panel whose edge sweeps up over it, and wherever the edge has crossed the rectangle the rectangle swaps: lit on the dark side, a dark hole on the lit side.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 161
// Round:   163
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Edge=-1..1, Tone=0.06..1
//
// Knob 1: Hue. The colour of the rectangle and of the lit half, one colour.
// Knob 2: Size. How big the rectangle is, from 24 by 18 LEDs at 0 to 54 by 42 at 3; the knob's 2 is 44 by 34.
// Knob 3: Edge. Where the edge of the lit half is. At -1 it is below the rectangle with a gap, and turning up it climbs. At -0.417 it touches the rectangle's lower side and the knob holds there for three clicks. It cuts the rectangle across, the upper part lit and the lower part a hole, and at 0.417 it is one LED above the rectangle's top and the hole has a rim all round, held for three clicks again. It opens at 0, nine clicks from both.
// Knob 4: Tone. How far the lit half is dimmer than the rectangle. At 0.06 they are the same brightness and the rectangle is a black hole where it is over the lit half; at 1 the lit half is half as bright and the rectangle cannot be seen over it at all.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = 48;
// The rectangle's brightness, and the lit half's when the knob has not moved. Under half so a dim LED is not pushed to white.
const LEVEL = 0.44;
// The third knob turns 48 clicks across its range of 2. The edge touches the rectangle at click 14 and stands one LED past it at click 34, and holds the click either side of each.
const CLICK = 2 / 48;
const TOUCH = 14;
const RIM = 34;
// LEDs the edge goes per click before the touch and after the rim, which is more than one so the clicks beside the holds are felt.
const OUT = 2;

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

// How far the edge has gone from the touching place, in LEDs, towards the far side of the rectangle. Travel is the rectangle's height plus the one LED of rim.
function advance(u, travel) {
  const n = (u + 1) / CLICK;
  if (n <= TOUCH - 1) return -(TOUCH - 1 - n) * OUT;
  if (n <= TOUCH + 1) return 0;
  if (n < RIM - 1) return ((n - TOUCH - 1) / (RIM - TOUCH - 2)) * travel;
  if (n <= RIM + 1) return travel;
  return travel + (n - RIM - 1) * OUT;
}

export function setup(params) {
  params.t = 0;
  params.col = [255, 120, 0];
  params.w = 44;
  params.h = 34;
  params.edge = 80;
  params.lit = LEVEL;
  params.gain = 1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // A hue of 0 is red, and a dim red is brown; the colour starts a little round the wheel, on azure.
  hsv(k[0] + 0.55, 0.85, 1, params.col);
  // Both sides are even so every edge of the rectangle falls between two LEDs.
  params.w = 2 * Math.round((24 + 10 * k[1]) / 2);
  params.h = 2 * Math.round((18 + 8 * k[1]) / 2);
  // The lit half lies below the edge. The edge touches the rectangle's lower side first and climbs through it.
  const lower = CY + params.h / 2;
  params.edge = lower - advance(k[2], params.h + 1);
  const away = (k[3] - 0.06) / 0.94;
  params.lit = LEVEL * (1 - 0.5 * away);
  // The whole panel breathes together, so the rectangle and the lit half stay the same brightness when they have met.
  params.gain = 1 + 0.1 * Math.sin(params.t * 0.83);
}

export function draw(display, params, time) {
  const col = params.col;
  const g = params.gain;
  const shape = LEVEL * g;
  const lit = params.lit * g;
  const x0 = CX - params.w / 2;
  const x1 = CX + params.w / 2;
  const y0 = CY - params.h / 2;
  const y1 = CY + params.h / 2;
  const edge = params.edge;
  for (let y = 0; y < H; y++) {
    let cv = Math.min(y + 1, y1) - Math.max(y, y0);
    cv = cv < 0 ? 0 : cv > 1 ? 1 : cv;
    let m = y + 1 - edge;
    m = m < 0 ? 0 : m > 1 ? 1 : m;
    const ground = lit * m;
    const swapped = Math.abs(ground - shape);
    for (let x = 0; x < W; x++) {
      let ch = Math.min(x + 1, x1) - Math.max(x, x0);
      ch = ch < 0 ? 0 : ch > 1 ? 1 : ch;
      const c = ch * cv;
      // Inside the rectangle the level is how far the ground is from the rectangle's own, so over the dark the rectangle is lit and over a ground as bright as it is, it is gone.
      const v = ground + (swapped - ground) * c;
      display.setPixel(x, y, col[0] * v, col[1] * v, col[2] * v);
    }
  }
}
