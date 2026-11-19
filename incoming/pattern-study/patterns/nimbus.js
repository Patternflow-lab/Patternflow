// ===== Patternflow pattern =====
// Title:   Nimbus
// Family:  geometry
// Idea:    A square stands in front of a disc of another colour, high on the panel, and one knob grows the disc: the knob holds where the disc first shows past the square's four sides as four pieces, and again where the four pieces meet round the corners and are one rim.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 192
// Round:   194
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Out=-12..36, Aside=0.06..1
//
// Knob 1: Hue. The colour of the square, all the way round the wheel from teal. The disc behind it is a colour a little under half the wheel away, and dimmer.
// Knob 2: Size. The side of the square, 24 LEDs at the bottom of the knob, 32 where it opens at 2 and 34 at the top. Both holds are worked out from the square, so they stay on their clicks and the disc grows with the square.
// Knob 3: Out. How big the disc behind the square is, counted in clicks. On the bottom click it is wholly hidden and the square stands alone. Click 1 brings it out 1.5 LEDs past the middle of each side, four pieces 14 LEDs wide, and the knob holds there for two clicks. Each click from there adds a fifth of a LED to the radius, and it opens ten clicks on with the pieces 22 LEDs wide and 3.5 thick. Eight clicks up from where it opens 3 LEDs of dark are left at each corner, and the ninth takes the radius 3 LEDs on and closes all four at once: one rim, 1.5 LEDs thick at the corners and 8 at the sides. The knob holds there for two clicks. From there the rim thickens a quarter of a LED a click to the top of the knob, where the disc stops 1 LED short of both walls.
// Knob 4: Aside. How far the square has slid down and to the right off the disc's middle, up to 5 LEDs each way. The disc stays put. The disc shows first on the two sides the square has left and the corner the square has slid toward closes last; both holds stay on their clicks. With the square slid all the way, a disc at the top of the third knob runs up to 3 LEDs into the walls.

const W = 64;
const H = 128;
// The disc's middle. The square's middle is on it until the last knob slides the square off.
const BX = 32;
const BY = 40;
// Knob 3 has 48 clicks and opens on click OPEN. The disc is hidden on click 0, shows first on click 1 and is a whole rim on click RIM.
const CLICKS = 48;
const OPEN = 12;
const RIM = 21;
// How far the disc stands out past a side when it first shows, and how thick the rim is at the far corner when it closes.
const SHOW = 1.5;
const SEAL = 1.5;
// The pieces stop growing with this much dark left between their ends at the far corner; the next click closes it in one go.
const GAP = 3;
// The biggest disc: 1 LED short of both walls. A rim that closes later than that, behind a square slid far aside, still gets SPARE LEDs of growing, and the walls cut those.
const TOP = 31;
const SPARE = 2;
// How far the last knob slides the square, each way.
const SLIDE = 5;

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

// The dark left at the square's far corner between the ends of the two pieces beside it. The two sides that meet there are a and b LEDs from the disc's middle and the disc's radius is r.
function gapAt(a, b, r) {
  return Math.hypot(b - Math.sqrt(Math.max(0, r * r - a * a)), a - Math.sqrt(Math.max(0, r * r - b * b)));
}

// The radius of the disc at each corner of the click to radius map, joined by straight lines. The square's half side is h and it has slid s LEDs each way.
function plan(P, h, s) {
  const qs = P.qs;
  const rs = P.rs;
  const far = Math.hypot(h + s, h + s);
  // The biggest disc that still leaves GAP dark at the far corner.
  let lo = h - s;
  let hi = far;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (gapAt(h + s, h + s, mid) > GAP) lo = mid;
    else hi = mid;
  }
  const first = h - s + SHOW;
  qs[0] = 0;
  rs[0] = h - s - 1;
  qs[1] = 1;
  rs[1] = first;
  qs[2] = 2;
  rs[2] = first;
  qs[3] = RIM - 1;
  rs[3] = Math.max(first, lo);
  qs[4] = RIM;
  rs[4] = far + SEAL;
  qs[5] = RIM + 1;
  rs[5] = far + SEAL;
  qs[6] = CLICKS;
  rs[6] = Math.max(TOP, far + SEAL + SPARE);
}

function radiusAt(P, q) {
  const qs = P.qs;
  const rs = P.rs;
  if (q <= qs[0]) return rs[0];
  for (let i = 1; i < 7; i++) if (q <= qs[i]) return rs[i - 1] + ((rs[i] - rs[i - 1]) * (q - qs[i - 1])) / (qs[i] - qs[i - 1]);
  return rs[6];
}

export function setup(params) {
  params.t = 0;
  params.front = new Float32Array(3);
  params.back = new Float32Array(3);
  params.P = { qs: new Float32Array(7), rs: new Float32Array(7) };
  params.key = "";
  params.h = 16;
  params.s = 0;
  params.r = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const z = clamp(k[1], 0, 3);
  const h = z < 2 ? 12 + 2 * z : 16 + (z - 2);
  // The last knob opens at 0.06, the bottom of its travel, where the square sits on the disc's middle.
  const s = SLIDE * clamp((k[3] - 0.06) / 0.94, 0, 1);
  const key = h + "/" + s;
  if (key !== params.key) {
    params.key = key;
    plan(params.P, h, s);
  }
  params.h = h;
  params.s = s;
  params.r = radiusAt(params.P, clamp(k[2], -OPEN, CLICKS - OPEN) + OPEN);
  // Nothing on the panel moves on the clock. The light swells and falls over both shapes together, so the panel is never quite still.
  const breath = 0.9 + 0.1 * Math.sin(t * 0.9 + 0.89);
  hsv(k[0] + 0.47 + 0.015 * Math.sin(t * 0.43), 0.5, 0.95 * breath, params.front);
  hsv(k[0] + 0.89 + 0.015 * Math.sin(t * 0.37 + 1.3), 0.5, 0.72 * breath, params.back);
}

export function draw(display, params, time) {
  const { h, s, r, front, back } = params;
  const fx = BX + s;
  const fy = BY + s;
  for (let y = 0; y < H; y++) {
    const my = span(fy - h, fy + h, y);
    for (let x = 0; x < W; x++) {
      // The square is in front: where it covers an LED, the disc behind it is not seen.
      const sq = my * span(fx - h, fx + h, x);
      const dist = Math.hypot(x + 0.5 - BX, y + 0.5 - BY);
      const c = clamp(r + 0.5 - dist, 0, 1) * (1 - sq);
      // An LED the two share takes the colour of the one that has more of it, so no LED on the line between them is a mix of the two.
      const lit = sq + c;
      const col = sq >= c ? front : back;
      display.setPixel(x, y, col[0] * lit, col[1] * lit, col[2] * lit);
    }
  }
}
