// ===== Patternflow pattern =====
// Title:   Salient
// Family:  geometry
// Idea:    A disc stands in front of a square of another colour, low on the panel, and one knob grows the square: the knob holds where the square's four corners first show past the disc as four pieces, and again where the square's sides clear the disc and the four pieces are one frame.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 192
// Round:   194
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Out=-11..37, Aside=0.06..1
//
// Knob 1: Hue. The colour of the disc, all the way round the wheel from lime. The square behind it is a colour about half the wheel away, and dimmer.
// Knob 2: Size. How wide the disc is, 36 LEDs at the bottom of the knob, 44 where it opens at 2 and 47 at the top. Both holds are worked out from the disc, so they stay on their clicks and the square grows with the disc.
// Knob 3: Out. How big the square behind the disc is, counted in clicks. On the bottom click it is wholly hidden and the disc stands alone. Click 1 brings its four corners out 3.5 LEDs past the disc's edge, four pieces, and the knob holds there for two clicks. Each click from there adds a little under half a LED to the side, and it opens nine clicks on with the corners 6 LEDs out and each piece reaching 11 LEDs along both of its sides. Eight clicks up from where it opens 6 LEDs of the disc's edge still cross the middle of each side, and the ninth takes the side 3.4 LEDs on and clears all four at once: one frame, 1.5 LEDs thick at its thinnest. The knob holds there for two clicks. From there the frame thickens a little over a quarter of a LED a click to the top of the knob, where the square stops 1 LED short of both walls.
// Knob 4: Aside. How far the disc has slid up and to the left off the square's middle, up to 5.5 LEDs each way. The square stays put. The corner the disc has left shows first and the two sides the disc has slid toward clear last; both holds stay on their clicks. With the biggest disc slid all the way, a square at the top of the third knob reaches both walls.

const W = 64;
const H = 128;
// The square's middle. The disc's middle is on it until the last knob slides the disc off.
const BX = 32;
const BY = 88;
// Knob 3 has 48 clicks and opens on click OPEN. The square is hidden on click 0, shows first on click 1 and is a whole frame on click RIM.
const CLICKS = 48;
const OPEN = 11;
const RIM = 20;
// How far a corner stands out past the disc when it first shows, and how thick the frame is at its thinnest when it closes.
const SHOW = 3.5;
const SEAL = 1.5;
// The corner pieces stop growing with this much of the disc's edge still showing through the nearest side; the next click closes it in one go.
const GAP = 6;
// The biggest square: 1 LED short of both walls. A frame that closes later than that, behind a disc slid far aside, still gets SPARE LEDs of growing, and the walls cut those.
const TOP = 31;
const SPARE = 1.5;
// How far the last knob slides the disc, each way.
const SLIDE = 5.5;

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

// How much of the LED between p and p + 1 the span from lo to hi covers.
function span(lo, hi, p) {
  const v = (hi < p + 1 ? hi : p + 1) - (lo > p ? lo : p);
  return v < 0 ? 0 : v;
}

// The half side of the square whose far corner is d LEDs from the middle of a disc that has slid s LEDs each way.
function reach(d, s) {
  return Math.sqrt(d * d / 2) - s;
}

// The half side of the square at each corner of the click to size map, joined by straight lines. The disc's radius is R and it has slid s LEDs each way.
function plan(P, R, s) {
  const qs = P.qs;
  const as = P.as;
  const first = reach(R + SHOW, s);
  qs[0] = 0;
  as[0] = Math.max(0, reach(R - 1, s));
  qs[1] = 1;
  as[1] = first;
  qs[2] = 2;
  as[2] = first;
  // The nearest side is the last to clear the disc: GAP of the disc's edge still crosses it.
  qs[3] = RIM - 1;
  as[3] = Math.max(first, s + Math.sqrt(R * R - (GAP * GAP) / 4));
  qs[4] = RIM;
  as[4] = R + s + SEAL;
  qs[5] = RIM + 1;
  as[5] = R + s + SEAL;
  qs[6] = CLICKS;
  as[6] = Math.max(TOP, R + s + SEAL + SPARE);
}

function sizeAt(P, q) {
  const qs = P.qs;
  const as = P.as;
  if (q <= qs[0]) return as[0];
  for (let i = 1; i < 7; i++) if (q <= qs[i]) return as[i - 1] + ((as[i] - as[i - 1]) * (q - qs[i - 1])) / (qs[i] - qs[i - 1]);
  return as[6];
}

export function setup(params) {
  params.t = 0;
  params.front = new Float32Array(3);
  params.back = new Float32Array(3);
  params.P = { qs: new Float32Array(7), as: new Float32Array(7) };
  params.key = "";
  params.R = 22;
  params.s = 0;
  params.a = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const z = clamp(k[1], 0, 3);
  const R = z < 2 ? 18 + 2 * z : 22 + 1.5 * (z - 2);
  // The last knob opens at 0.06, the bottom of its travel, where the disc sits on the square's middle.
  const s = SLIDE * clamp((k[3] - 0.06) / 0.94, 0, 1);
  const key = R + "/" + s;
  if (key !== params.key) {
    params.key = key;
    plan(params.P, R, s);
  }
  params.R = R;
  params.s = s;
  params.a = sizeAt(params.P, clamp(k[2], -OPEN, CLICKS - OPEN) + OPEN);
  // Nothing on the panel moves on the clock. The light swells and falls over both shapes together, so the panel is never quite still.
  const breath = 0.9 + 0.1 * Math.sin(t * 0.83 + 1.07);
  hsv(k[0] + 0.22 + 0.015 * Math.sin(t * 0.41), 0.5, 0.95 * breath, params.front);
  hsv(k[0] + 0.74 + 0.015 * Math.sin(t * 0.35 + 1.1), 0.5, 0.7 * breath, params.back);
}

export function draw(display, params, time) {
  const { R, s, a, front, back } = params;
  const fx = BX - s;
  const fy = BY - s;
  for (let y = 0; y < H; y++) {
    const my = span(BY - a, BY + a, y);
    for (let x = 0; x < W; x++) {
      // The disc is in front: where it covers an LED, the square behind it is not seen.
      const disc = clamp(R + 0.5 - Math.hypot(x + 0.5 - fx, y + 0.5 - fy), 0, 1);
      const c = my * span(BX - a, BX + a, x) * (1 - disc);
      // An LED the two share takes the colour of the one that has more of it, so no LED on the line between them is a mix of the two.
      const lit = disc + c;
      const col = disc >= c ? front : back;
      display.setPixel(x, y, col[0] * lit, col[1] * lit, col[2] * lit);
    }
  }
}
