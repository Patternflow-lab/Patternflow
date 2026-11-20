// ===== Patternflow pattern =====
// Title:   Cusp
// Family:  geometry
// Idea:    A disc stands in front of a triangle of another colour, and one knob grows the triangle: the knob holds where the triangle's three points first show past the disc as three pieces, and again where the triangle's sides clear the disc and the three pieces are one frame.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 192
// Round:   194
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Out=-15..33, Aside=0.06..1
//
// Knob 1: Hue. The colour of the disc, all the way round the wheel from orange. The triangle behind it is a colour half the wheel away, and dimmer.
// Knob 2: Size. How wide the disc is, 20 LEDs at the bottom of the knob, 28 where it opens at 2 and 30 at the top. Both holds are worked out from the disc, so they stay on their clicks and the triangle grows with the disc.
// Knob 3: Out. How big the triangle behind the disc is, counted in clicks. On the bottom click it is wholly hidden and the disc stands alone. Click 1 brings its three points out 4 LEDs past the disc's edge, three pieces, and the knob holds there for two clicks. Each click from there moves the points out three eighths of a LED, and it opens thirteen clicks on with the points 9 LEDs out. Twelve clicks up from where it opens 6 LEDs of the disc's edge still cross the middle of each side, and the thirteenth takes the points 3.7 LEDs on and clears all three sides at once: one frame, 1.5 LEDs thick at its thinnest. The knob holds there for two clicks. From there the points move out a quarter of a LED a click to the top of the knob, where the two lower points stop 1 LED short of the walls.
// Knob 4: Aside. How far the disc has slid toward the triangle's lower right point, up to 10 LEDs, or 6 with the smallest disc. The triangle stays put. The two points the disc has left show first and the two sides beside the lower right point clear last; both holds stay on their clicks. With the disc slid past halfway the triangle that closes the frame is wider than the panel and the walls cut its two lower points, 3.5 LEDs off each with the disc slid all the way.

const W = 64;
const H = 128;
// The triangle's middle: all three points are the same distance from it. The disc's middle is on it until the last knob slides the disc off.
const BX = 32;
const BY = 70;
// Knob 3 has 48 clicks and opens on click OPEN. The triangle is hidden on click 0, shows first on click 1 and is a whole frame on click RIM.
const CLICKS = 48;
const OPEN = 15;
const RIM = 28;
// How far a point stands out past the disc when it first shows, and how thick the frame is at its thinnest when it closes.
const SHOW = 4;
const SEAL = 1.5;
// The three pieces stop growing with this much of the disc's edge still showing through the nearest side; the next click closes it in one go.
const GAP = 6;
// The biggest triangle, from its middle to a point: its lower points stop 1 LED short of the walls. A frame that closes later than that, behind a disc slid far aside, still gets SPARE LEDs of growing, and the walls cut those.
const HALF = 0.8660254;
const TOP = 31 / HALF;
const SPARE = 2;
// How far the last knob slides the disc.
const SLIDE = 10;

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

// How far from the triangle's middle a point is when it is d LEDs from the middle of the disc. The disc has slid u LEDs, and along is how much of that slide is toward this point: all of it for the lower right point, minus half for the other two.
function reach(d, u, along) {
  const a = along * u;
  return a + Math.sqrt(Math.max(0, a * a - u * u + d * d));
}

// The triangle's size, middle to point, at each corner of the click to size map, joined by straight lines. The disc's radius is R and it has slid u LEDs.
function plan(P, R, u) {
  const qs = P.qs;
  const ps = P.ps;
  // The two points the disc slides away from come out first.
  const first = reach(R + SHOW, u, -0.5);
  qs[0] = 0;
  ps[0] = reach(R - 1, u, -0.5);
  qs[1] = 1;
  ps[1] = first;
  qs[2] = 2;
  ps[2] = first;
  // The two sides beside the lower right point are the last to clear the disc: GAP of the disc's edge still crosses them.
  qs[3] = RIM - 1;
  ps[3] = Math.max(first, u + 2 * Math.sqrt(R * R - (GAP * GAP) / 4));
  qs[4] = RIM;
  ps[4] = 2 * (R + SEAL) + u;
  qs[5] = RIM + 1;
  ps[5] = 2 * (R + SEAL) + u;
  qs[6] = CLICKS;
  ps[6] = Math.max(TOP, 2 * (R + SEAL) + u + SPARE);
}

function sizeAt(P, q) {
  const qs = P.qs;
  const ps = P.ps;
  if (q <= qs[0]) return ps[0];
  for (let i = 1; i < 7; i++) if (q <= qs[i]) return ps[i - 1] + ((ps[i] - ps[i - 1]) * (q - qs[i - 1])) / (qs[i] - qs[i - 1]);
  return ps[6];
}

export function setup(params) {
  params.t = 0;
  params.front = new Float32Array(3);
  params.back = new Float32Array(3);
  params.P = { qs: new Float32Array(7), ps: new Float32Array(7) };
  params.key = "";
  params.R = 14;
  params.u = 0;
  params.p = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const z = clamp(k[1], 0, 3);
  const R = z < 2 ? 10 + 2 * z : 14 + (z - 2);
  // The last knob opens at 0.06, the bottom of its travel, where the disc sits on the triangle's middle. A small disc slides less, so that it still covers the triangle's middle.
  const u = Math.min(SLIDE, R - 4) * clamp((k[3] - 0.06) / 0.94, 0, 1);
  const key = R + "/" + u;
  if (key !== params.key) {
    params.key = key;
    plan(params.P, R, u);
  }
  params.R = R;
  params.u = u;
  params.p = sizeAt(params.P, clamp(k[2], -OPEN, CLICKS - OPEN) + OPEN);
  // Nothing on the panel moves on the clock. The light swells and falls over both shapes together, so the panel is never quite still.
  const breath = 0.88 + 0.12 * Math.sin(t + 0.64);
  hsv(k[0] + 0.07 + 0.015 * Math.sin(t * 0.39), 0.5, 0.97 * breath, params.front);
  hsv(k[0] + 0.57 + 0.015 * Math.sin(t * 0.33 + 0.9), 0.5, 0.8 * breath, params.back);
}

export function draw(display, params, time) {
  const { R, u, p, front, back } = params;
  const fx = BX + HALF * u;
  const fy = BY + 0.5 * u;
  const inner = p / 2;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - BY;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - BX;
      // The disc is in front: where it covers an LED, the triangle behind it is not seen.
      const disc = clamp(R + 0.5 - Math.hypot(x + 0.5 - fx, y + 0.5 - fy), 0, 1);
      // How far outside the nearest of the triangle's three sides the LED is: the base, the right side, the left side.
      const out = Math.max(dy, HALF * dx - 0.5 * dy, -HALF * dx - 0.5 * dy) - inner;
      const c = clamp(0.5 - out, 0, 1) * (1 - disc);
      // An LED the two share takes the colour of the one that has more of it, so no LED on the line between them is a mix of the two.
      const lit = disc + c;
      const col = disc >= c ? front : back;
      display.setPixel(x, y, col[0] * lit, col[1] * lit, col[2] * lit);
    }
  }
}
