// ===== Patternflow pattern =====
// Title:   Converse
// Family:  geometry
// Idea:    One circle low on the left and a lit right half of the panel whose upright edge sweeps left over it, and wherever the edge has crossed the circle the circle swaps: lit on the dark side, a dark hole on the lit side.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 161
// Round:   163
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Edge=-1..1, Tone=0.06..1
//
// Knob 1: Hue. The colour of the circle and of the lit half, one colour.
// Knob 2: Size. How wide the circle is, from 18 LEDs at 0 to 44 at 3; the knob's 2 is 36.
// Knob 3: Edge. Where the edge of the lit half is. At -1 it is at the right of the circle with a gap, and turning up it moves left. At -0.417 it touches the circle's right side and the knob holds there for three clicks. It cuts the circle down, the left part lit and the right part a hole, and at 0.417 it is one LED left of the circle and the hole has a rim all round, held for three clicks again. It opens at 0, nine clicks from both.
// Knob 4: Tone. How far the lit half is dimmer than the circle. At 0.06 they are the same brightness and the circle is a black hole where it is over the lit half; at 1 the lit half is half as bright and the circle cannot be seen over it at all.

const W = 64;
const H = 128;
const CX = 30;
const CY = 96;
// The circle's brightness, and the lit half's when the knob has not moved. Under half so a dim LED is not pushed to white.
const LEVEL = 0.44;
// The third knob turns 48 clicks across its range of 2. The edge touches the circle at click 14 and stands one LED past it at click 34, and holds the click either side of each.
const CLICK = 2 / 48;
const TOUCH = 14;
const RIM = 34;
// LEDs the edge goes per click before the touch and after the rim. The panel is only 64 wide, so it is just over one, which is what the clicks beside the holds need.
const OUT = 1.15;

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

// How far the edge has gone from the touching place, in LEDs, towards the far side of the circle. Travel is the circle's width plus the one LED of rim.
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
  params.d = 36;
  params.edge = 47;
  params.lit = LEVEL;
  params.gain = 1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // A hue of 0 is red, and a dim red is brown; the colour starts a little round the wheel, on spring green.
  hsv(k[0] + 0.43, 0.85, 1, params.col);
  // The width is even so the circle's sides fall between two LEDs.
  params.d = 2 * Math.round((18 + 8.5 * k[1]) / 2);
  // The lit half lies right of the edge. The edge touches the circle's right side first and moves left through it.
  const right = CX + params.d / 2;
  params.edge = right - advance(k[2], params.d + 1);
  const away = (k[3] - 0.06) / 0.94;
  params.lit = LEVEL * (1 - 0.5 * away);
  // The whole panel breathes together, so the circle and the lit half stay the same brightness when they have met.
  params.gain = 1 + 0.1 * Math.sin(params.t * 0.71);
}

export function draw(display, params, time) {
  const col = params.col;
  const g = params.gain;
  const shape = LEVEL * g;
  const lit = params.lit * g;
  const r = params.d / 2;
  const edge = params.edge;
  for (let x = 0; x < W; x++) {
    let m = x + 1 - edge;
    m = m < 0 ? 0 : m > 1 ? 1 : m;
    const ground = lit * m;
    const swapped = Math.abs(ground - shape);
    const dx = x + 0.5 - CX;
    for (let y = 0; y < H; y++) {
      const dy = y + 0.5 - CY;
      let c = r + 0.5 - Math.sqrt(dx * dx + dy * dy);
      c = c < 0 ? 0 : c > 1 ? 1 : c;
      // Inside the circle the level is how far the ground is from the circle's own, so over the dark the circle is lit and over a ground as bright as it is, it is gone.
      const v = ground + (swapped - ground) * c;
      display.setPixel(x, y, col[0] * v, col[1] * v, col[2] * v);
    }
  }
}
