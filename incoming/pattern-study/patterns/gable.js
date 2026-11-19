// ===== Patternflow pattern =====
// Title:   Gable
// Family:  geometry
// Idea:    A small square slides down the panel from its top right corner toward a big triangle of another colour and goes in behind it, and one knob walks it along: the knob holds where the square's corner first meets the triangle's slanted side, and again where the square is wholly hidden and the triangle stands alone.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 178
// Round:   180
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Hide=-14..34, Aside=0.06..1
//
// Knob 1: Hue. The colour of the triangle, all the way round the wheel from teal. The square is a paler tint of the colour half way round the wheel from it.
// Knob 2: Size. The base of the triangle, 36 LEDs at the bottom of the knob to 46 at the top, with the height a quarter more than the base. It opens on 43. The square stays 14 LEDs on a side.
// Knob 3: Hide. How far the square has gone along its slope, counted in clicks, 48 of them from near the top right corner to wholly behind the triangle. Where it opens the square is about 10 LEDs short of the triangle's slanted side. Turn up and in 10 clicks the square's corner meets the side, held for three clicks; after that the square slides in. Turn up to the last three clicks and it is wholly hidden, only the triangle left. The clicks next to each hold move the square more than a LED a click.
// Knob 4: Aside. How far the triangle sits off the square's way, up and to the left, up to 11 LEDs on the biggest triangle and 5.5 on the smallest, which has less room to hide a square. At the bottom the way runs through the triangle's middle. Both holds stay on their clicks and move with the triangle.

const W = 64;
const H = 128;
// The square's way: down the panel from near its top right corner, 2 LEDs across to the left for every 5 down.
const DX = -0.38;
const DY = 0.925;
const X0 = 56;
const Y0 = 36.3;
const U = 7;
// How far inside each side of the triangle the square's far corner sits when it is called hidden: the half LED the soft edges spread, so no trace of it shows.
const DEEP = 0.5;
// LEDs a click moves in the eight clicks beside a hold.
const NEAR = 1.15;
// The click the first hold starts on. It lasts three clicks, and the last three clicks hold the square hidden.
const TOUCH = 24;
const LAST = 46;

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

// The triangle stands on its base with its apex up, centred on (cx, cy) as its three corners' mean. Its three sides as a unit normal pointing out and the value of normal . point along the side: left, right, base.
function sides(cx, cy, b, h) {
  const len = Math.hypot(h, b / 2);
  const ax = cx;
  const ay = cy - (2 * h) / 3;
  const left = [-h / len, -b / 2 / len];
  const right = [h / len, -b / 2 / len];
  return [
    [left[0], left[1], left[0] * ax + left[1] * ay],
    [right[0], right[1], right[0] * ax + right[1] * ay],
    [0, 1, cy + h / 3],
  ];
}

// How far along the slope the square is when its corner first meets the triangle, and when it is first wholly inside.
function walk(cx, cy, b, h) {
  const tri = sides(cx, cy, b, h);
  const top = cy - (2 * h) / 3;
  const bottom = cy + h / 3;
  let touch = -1;
  let hide = -1;
  let before = 0;
  let behind = 0;
  const step = 0.02;
  for (let s = 0; s <= 150; s += step) {
    const px = X0 + DX * s;
    const py = Y0 + DY * s;
    // Apart while the biggest gap along any one of five axes is above zero.
    let gap = Math.max(cx - b / 2 - (px + U), px - U - (cx + b / 2), top - (py + U), py - U - bottom);
    let deep = 1e9;
    for (const [nx, ny, c] of tri) {
      const reach = U * (Math.abs(nx) + Math.abs(ny));
      gap = Math.max(gap, nx * px + ny * py - reach - c);
      deep = Math.min(deep, c - DEEP - (nx * px + ny * py + reach));
    }
    if (touch < 0 && gap <= 0) touch = s - step + (step * before) / (before - gap);
    if (touch >= 0 && deep >= 0) {
      hide = s - step + (step * -behind) / (deep - behind);
      break;
    }
    before = gap;
    behind = deep;
  }
  return [touch, hide];
}

// How far along the slope the square is at a click of the Hide knob. Clicks 24 to 26 hold where the corner meets the side and clicks 46 to 48 hold it hidden; the eight clicks before the first hold go NEAR a click, the clicks from there back to the start go evenly.
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
  params.tri = sides(34, 90, 41, 51);
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
  const size = clamp(k[1], 0, 3) / 3;
  const b = 36 + 10 * size;
  const h = b * 1.25;
  // The triangle can sit off the way by as much as its size leaves room for.
  const off = (5.5 + (b - 36) * 0.55) * clamp((k[3] - 0.06) / 0.94, 0, 1);
  const cx = 34 - DY * off;
  const cy = 90 + DX * off;
  const key = b + "," + off;
  if (key !== params.key) {
    const [touch, hide] = walk(cx, cy, b, h);
    params.key = key;
    params.touch = touch;
    params.hide = hide;
    params.tri = sides(cx, cy, b, h);
  }
  const q = clamp(k[2], -14, 34) + 14;
  const s = along(q, params.touch, params.hide);
  params.px = X0 + DX * s;
  params.py = Y0 + DY * s;
  // Nothing on the panel moves on the clock. The light swells and falls and the colours wander a few degrees, the two out of step, so the panel is never quite still.
  hsv(k[0] + 0.5 + 0.02 * Math.sin(t * 0.39), 0.75, 0.9 * (0.9 + 0.1 * Math.sin(t * 0.85 + 0.4)), params.big);
  hsv(k[0] + 0.98 + 0.02 * Math.sin(t * 0.33 + 3.2), 0.4, 0.9 + 0.1 * Math.sin(t * 0.65 + 5.1), params.small);
}

export function draw(display, params, time) {
  const { tri, px, py, big, small } = params;
  for (let y = 0; y < H; y++) {
    const sy = span(py - U, py + U, y);
    for (let x = 0; x < W; x++) {
      // The triangle is in front: where it covers an LED, the square behind it is not seen.
      let out = -1e9;
      for (const [nx, ny, c] of tri) {
        const d = nx * (x + 0.5) + ny * (y + 0.5) - c;
        if (d > out) out = d;
      }
      const wedge = clamp(0.5 - out, 0, 1);
      const c = sy * span(px - U, px + U, x) * (1 - wedge);
      display.setPixel(x, y, big[0] * wedge + small[0] * c, big[1] * wedge + small[1] * c, big[2] * wedge + small[2] * c);
    }
  }
}
