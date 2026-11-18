// ===== Patternflow pattern =====
// Title:   Antiphase
// Family:  geometry
// Idea:    One upright triangle and a lit left half of the panel whose upright edge sweeps right over it, and wherever the edge has crossed the triangle the triangle swaps: lit on the dark side, a dark hole on the lit side.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 161
// Round:   163
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Edge=-1..1, Tone=0.06..1
//
// Knob 1: Hue. The colour of the triangle and of the lit half, one colour.
// Knob 2: Size. How wide the triangle's base is, from 18 LEDs at 0 to 44 at 3, and it is a quarter taller than wide; the knob's 2 is 36 wide and 46 tall.
// Knob 3: Edge. Where the edge of the lit half is. At -1 it is at the left of the triangle with a gap, and turning up it moves right. At -0.417 it touches the triangle's lower left corner and the knob holds there for three clicks. It cuts the triangle down, the left part a hole and the right part lit, and at 0.417 it is one LED right of the triangle's lower right corner and the hole has a rim all round, held for three clicks again. It opens at 0, nine clicks from both.
// Knob 4: Tone. How far the lit half is dimmer than the triangle. At 0.06 they are the same brightness and the triangle is a black hole where it is over the lit half; at 1 the lit half is half as bright and the triangle cannot be seen over it at all.

const W = 64;
const H = 128;
const CX = 34;
const CY = 66;
// The triangle's brightness, and the lit half's when the knob has not moved. Under half so a dim LED is not pushed to white.
const LEVEL = 0.44;
// The third knob turns 48 clicks across its range of 2. The edge touches the triangle at click 14 and stands one LED past it at click 34, and holds the click either side of each.
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

// How far the edge has gone from the touching place, in LEDs, towards the far side of the triangle. Travel is the triangle's base plus the one LED of rim.
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
  params.base = 36;
  params.tall = 46;
  params.edge = 52;
  params.lit = LEVEL;
  params.gain = 1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // A hue of 0 is red, and a dim red is brown; the colour starts a long way round the wheel, on magenta.
  hsv(k[0] + 0.83, 0.85, 1, params.col);
  // The base and the height are even so the corners fall between two LEDs; the height is a quarter more than the base.
  params.base = 2 * Math.round((18 + 8.5 * k[1]) / 2);
  params.tall = 2 * Math.round((params.base * 1.25) / 2);
  // The lit half lies left of the edge. The edge touches the lower left corner first and moves right through the triangle.
  const left = CX - params.base / 2;
  params.edge = left + advance(k[2], params.base + 1);
  const away = (k[3] - 0.06) / 0.94;
  params.lit = LEVEL * (1 - 0.5 * away);
  // The whole panel breathes together, so the triangle and the lit half stay the same brightness when they have met.
  params.gain = 1 + 0.1 * Math.sin(params.t * 0.97);
}

export function draw(display, params, time) {
  const col = params.col;
  const g = params.gain;
  const shape = LEVEL * g;
  const lit = params.lit * g;
  const half = params.base / 2;
  const foot = CY + params.tall / 2;
  const edge = params.edge;
  // Each slanted side as a distance, positive inside: its normal times how far the LED centre is from the side's foot.
  const run = Math.sqrt(params.tall * params.tall + half * half);
  for (let x = 0; x < W; x++) {
    let m = edge - x;
    m = m < 0 ? 0 : m > 1 ? 1 : m;
    const ground = lit * m;
    const swapped = Math.abs(ground - shape);
    for (let y = 0; y < H; y++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const dl = ((px - (CX - half)) * params.tall + (py - foot) * half) / run;
      const dr = ((px - (CX + half)) * -params.tall + (py - foot) * half) / run;
      const db = foot - py;
      let c = 0.5 + Math.min(dl, dr, db);
      c = c < 0 ? 0 : c > 1 ? 1 : c;
      // Inside the triangle the level is how far the ground is from the triangle's own, so over the dark the triangle is lit and over a ground as bright as it is, it is gone.
      const v = ground + (swapped - ground) * c;
      display.setPixel(x, y, col[0] * v, col[1] * v, col[2] * v);
    }
  }
}
