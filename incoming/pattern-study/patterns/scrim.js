// ===== Patternflow pattern =====
// Title:   Scrim
// Family:  geometry
// Idea:    A small square climbs the panel's other diagonal toward a big circle of another colour and goes in behind it, and one knob walks it along: the knob holds where the square's corner first meets the circle's edge, and again where the square is wholly hidden and the circle stands alone.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 178
// Round:   180
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Hide=-20..28, Aside=0.06..1
//
// Knob 1: Hue. The colour of the circle, all the way round the wheel from magenta. The square is a paler tint of a colour about a third of the way off it on the wheel.
// Knob 2: Size. The width of the circle, 36 LEDs at the bottom of the knob to 48 at the top. It opens on 44. The square stays 14 LEDs on a side.
// Knob 3: Hide. How far the square has gone up the diagonal, counted in clicks, 48 of them from the bottom left corner region to wholly behind the circle. Where it opens the square's corner is about 10 LEDs short of the circle. Turn up and in 10 clicks the corner meets the circle's edge, held for three clicks; after that the square slides in. Turn up to the last three clicks and it is wholly hidden, only the circle left. The clicks next to each hold move the square more than a LED a click.
// Knob 4: Aside. How far the circle sits off the square's way, up and to the left, up to 6.5 LEDs. At the bottom the way runs through the circle's middle. Both holds stay on their clicks and move with the circle.

const W = 64;
const H = 128;
// The square's way: up the panel's other diagonal, 1 LED across for every 2 up, from near the bottom left corner.
const DX = 0.4472136;
const DY = -0.8944272;
const X0 = 8.5;
const Y0 = 112;
const U = 7;
// How far past its corner the circle's edge sits when the square is called hidden: the half LED the soft edge spreads, so no trace of it shows.
const DEEP = 0.5;
// LEDs a click moves in the eight clicks beside a hold.
const NEAR = 1.15;
// The click the first hold starts on. It lasts three clicks, and the last three clicks hold the square hidden.
const TOUCH = 30;
const LAST = 46;
const OFF_MAX = 6.5;

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

// How far up the way the square is when it first meets the circle's edge, and when it is first wholly inside. The circle is centred on (cx, cy) with radius r.
function walk(cx, cy, r) {
  let touch = -1;
  let hide = -1;
  let before = 0;
  let behind = 0;
  const step = 0.02;
  for (let s = 0; s <= 150; s += step) {
    const dx = Math.abs(X0 + DX * s - cx);
    const dy = Math.abs(Y0 + DY * s - cy);
    // Gap from the circle's middle to the square, and how far the square's far corner is from that middle.
    const gap = Math.hypot(dx > U ? dx - U : 0, dy > U ? dy - U : 0);
    const far = Math.hypot(dx + U, dy + U);
    if (touch < 0 && gap <= r) touch = s - step + (step * (before - r)) / (before - gap);
    if (touch >= 0 && far <= r - DEEP) {
      hide = s - step + (step * (behind - (r - DEEP))) / (behind - far);
      break;
    }
    before = gap;
    behind = far;
  }
  return [touch, hide];
}

// How far up the way the square is at a click of the Hide knob. Clicks 30 to 32 hold where the corner meets the edge and clicks 46 to 48 hold it hidden; the eight clicks before the first hold go NEAR a click, the clicks from there back to the start go evenly.
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
  params.cx = 36;
  params.cy = 57;
  params.r = 22;
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
  const r = 18 + (6 * clamp(k[1], 0, 3)) / 3;
  const off = OFF_MAX * clamp((k[3] - 0.06) / 0.94, 0, 1);
  const cx = 36 + DY * off;
  const cy = 57 - DX * off;
  const key = r + "," + off;
  if (key !== params.key) {
    const [touch, hide] = walk(cx, cy, r);
    params.key = key;
    params.touch = touch;
    params.hide = hide;
  }
  const q = clamp(k[2], -20, 28) + 20;
  const s = along(q, params.touch, params.hide);
  params.r = r;
  params.cx = cx;
  params.cy = cy;
  params.px = X0 + DX * s;
  params.py = Y0 + DY * s;
  // Nothing on the panel moves on the clock. The light swells and falls and the colours wander a few degrees, the two out of step, so the panel is never quite still.
  hsv(k[0] + 0.86 + 0.02 * Math.sin(t * 0.41), 0.75, 0.9 * (0.9 + 0.1 * Math.sin(t * 0.8 + 1.7)), params.big);
  hsv(k[0] + 0.2 + 0.02 * Math.sin(t * 0.35 + 2.1), 0.4, 0.9 + 0.1 * Math.sin(t * 0.6 + 4.2), params.small);
}

export function draw(display, params, time) {
  const { cx, cy, r, px, py, big, small } = params;
  for (let y = 0; y < H; y++) {
    const sy = span(py - U, py + U, y);
    for (let x = 0; x < W; x++) {
      // The circle is in front: where it covers an LED, the square behind it is not seen.
      const disc = clamp(r + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy), 0, 1);
      const c = sy * span(px - U, px + U, x) * (1 - disc);
      display.setPixel(x, y, big[0] * disc + small[0] * c, big[1] * disc + small[1] * c, big[2] * disc + small[2] * c);
    }
  }
}
