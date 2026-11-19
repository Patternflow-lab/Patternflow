// ===== Patternflow pattern =====
// Title:   Arras
// Family:  geometry
// Idea:    A small circle slides down the panel's diagonal toward a big square of another colour and goes in behind it, and one knob walks it along: the knob holds where the circle's edge first meets the square's edge, and again where the circle is wholly hidden and the square stands alone.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 178
// Round:   180
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Hide=-17..31, Aside=0.06..1
//
// Knob 1: Hue. The colour of the square, all the way round the wheel from blue. The circle is a paler tint of a colour about a third of the way off it on the wheel.
// Knob 2: Size. The side of the square, 34 LEDs at the bottom of the knob to 46 at the top. It opens at 42. The circle stays 18 LEDs across.
// Knob 3: Hide. How far the circle has gone down the diagonal, counted in clicks, 48 of them from the top left corner region to wholly behind the square. Where it opens the circle is about 10 LEDs short of the square's top edge. Turn up and in 10 clicks the circle's edge meets the square's edge, held for three clicks; after that it slides in. Turn up to the last three clicks and it is wholly hidden, only the square left. The clicks next to each hold move the circle more than a LED a click.
// Knob 4: Aside. How far the square sits off the circle's way, down and to the left, up to 8 LEDs. At the bottom the way runs through the square's middle. Both holds stay on their clicks and move with the square.

const W = 64;
const H = 128;
// The circle's way: down the panel's diagonal, 1 LED across for every 2 down, from near the top left corner.
const DX = 0.4472136;
const DY = 0.8944272;
const X0 = 9.5;
const Y0 = 19;
const R = 9;
// How far past its radius the circle's middle is inside the square's edge when it is called hidden: the half LED its soft edge spreads, so no trace of it shows.
const DEEP = 0.5;
// LEDs a click moves in the eight clicks beside a hold.
const NEAR = 1.15;
// The click the first hold starts on. It lasts three clicks, and the last three clicks hold the circle hidden.
const TOUCH = 27;
const LAST = 46;
const OFF_MAX = 8;

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

// How far down the way the circle is when its edge first meets the square's edge, and when it is first wholly inside. The square is centred on (cx, cy) with half side h.
function walk(cx, cy, h) {
  let touch = -1;
  let hide = -1;
  let before = 0;
  const step = 0.02;
  for (let s = 0; s <= 150; s += step) {
    const ax = Math.abs(X0 + DX * s - cx) - h;
    const ay = Math.abs(Y0 + DY * s - cy) - h;
    // Distance from the circle's middle to the square, minus inside.
    const d = Math.hypot(ax > 0 ? ax : 0, ay > 0 ? ay : 0) + Math.min(Math.max(ax, ay), 0);
    if (touch < 0 && d <= R) touch = s - step + (step * (before - R)) / (before - d);
    if (touch >= 0 && d <= -(R + DEEP)) {
      hide = s - step + (step * (before + R + DEEP)) / (before - d);
      break;
    }
    before = d;
  }
  return [touch, hide];
}

// How far down the way the circle is at a click of the Hide knob. Clicks 27 to 29 hold where the edges meet and clicks 46 to 48 hold it hidden; the eight clicks before the first hold go NEAR a click, the clicks from there back to the start go evenly.
function along(q, touch, hide) {
  const slow = touch - NEAR * 8;
  if (q <= TOUCH - 8) return (slow * q) / (TOUCH - 8);
  if (q <= TOUCH) return touch - NEAR * (TOUCH - q);
  if (q <= TOUCH + 2) return touch;
  if (q < LAST) return touch + ((hide - touch) * (q - TOUCH - 2)) / (LAST - TOUCH - 2);
  return hide;
}

export function setup(params) {
  params.t = 0;
  params.big = new Float32Array(3);
  params.small = new Float32Array(3);
  params.cx = 32;
  params.cy = 64;
  params.h = 21;
  params.px = X0;
  params.py = Y0;
  params.touch = 0;
  params.hide = 0;
  params.key = "";
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const h = 17 + (6 * clamp(k[1], 0, 3)) / 3;
  const off = OFF_MAX * clamp((k[3] - 0.06) / 0.94, 0, 1);
  const cx = 32 - DY * off;
  const cy = 64 + DX * off;
  const key = h + "," + off;
  if (key !== params.key) {
    const [touch, hide] = walk(cx, cy, h);
    params.key = key;
    params.touch = touch;
    params.hide = hide;
  }
  const q = clamp(k[2], -17, 31) + 17;
  const s = along(q, params.touch, params.hide);
  params.h = h;
  params.cx = cx;
  params.cy = cy;
  params.px = X0 + DX * s;
  params.py = Y0 + DY * s;
  // Nothing on the panel moves on the clock. The light swells and falls and the colours wander a few degrees, the two out of step, so the panel is never quite still.
  hsv(k[0] + 0.62 + 0.02 * Math.sin(t * 0.43), 0.75, 0.9 * (0.9 + 0.1 * Math.sin(t * 0.9 + 2.9)), params.big);
  hsv(k[0] + 0.95 + 0.02 * Math.sin(t * 0.37 + 1.3), 0.4, 0.9 + 0.1 * Math.sin(t * 0.7 + 0.6), params.small);
}

export function draw(display, params, time) {
  const { cx, cy, h, px, py, big, small } = params;
  for (let y = 0; y < H; y++) {
    const my = span(cy - h, cy + h, y);
    for (let x = 0; x < W; x++) {
      // The square is in front: where it covers an LED, the circle behind it is not seen.
      const sq = my * span(cx - h, cx + h, x);
      const dist = Math.hypot(x + 0.5 - px, y + 0.5 - py);
      const c = clamp(R + 0.5 - dist, 0, 1) * (1 - sq);
      display.setPixel(x, y, big[0] * sq + small[0] * c, big[1] * sq + small[1] * c, big[2] * sq + small[2] * c);
    }
  }
}
