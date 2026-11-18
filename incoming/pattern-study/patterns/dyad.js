// ===== Patternflow pattern =====
// Title:   Dyad
// Family:  geometry
// Idea:    Four diamonds stand point to point in a column right of the middle of a bare dark ground, evenly spaced, and the four knobs are the colour, how big the diamonds are, how far the neighbours have drawn together in pairs and how much smaller one of each pair is: turned one way the top two meet at their points and the bottom two meet at theirs, so four pieces are two, and turned the other way the middle two meet, so four pieces are three.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 162
// Round:   164
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Pair=-1..1, Small=0.06..1
//
// Knob 1: Hue. The colour of the diamonds, all the way round the wheel from mint.
// Knob 2: Size. The width and height of the diamonds, 14 LEDs at 0 to 20 LEDs at 3; its 2 is 18 LEDs. The gaps do not change with it, so the column is 114 LEDs tall at its 2.
// Knob 3: Pair. How far the neighbours have drawn together. At 0 the four stand evenly spaced. Turned up, the top two draw together and the bottom two draw together until each pair meets at its points, and the knob stops there with two pieces on the panel. Turned down, the middle two draw together until they meet, and the knob stops there with three pieces. The diamonds draw in slowly while they are far apart and by a little over one LED a click for the last eight clicks before they meet; the last three clicks at either end hold the meeting picture.
// Knob 4: Small. How much smaller the first diamond of the top pair and the first of the bottom pair are, the same size as the others at the bottom of the knob, where it opens, and two fifths of the width at 1.

const W = 64;
const H = 128;
// The column stands right of the middle, so the left of the panel is bare.
const CX = 43;
const CY = H / 2;
// The gap from the bottom point of one diamond to the top point of the next when the four stand evenly spaced, in LEDs.
const G = 14;
// The Pair knob has 48 clicks over its range, 24 from its middle to either end. The last three clicks at each end hold the picture, so a pair has been meeting since 22 clicks out.
const REACH = 22;
// In the last eight clicks before a pair meets the gap closes a little over one LED a click. The very last click closes 2.1 LEDs, so a whole row of LEDs is dark between the two and they count as two pieces until the click they meet.
const FIRST = 2.1;
const FAST = 1.05;
const NEAR = 8;
// Each LED is sampled four across and four down, so a diamond's slanted edges are not steps.
const SUB = 4;

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

// The gap of the pair the knob is drawing together, for a knob a number of clicks from its middle. It is nothing for the last three clicks.
function pairGap(clicks) {
  const u = REACH - Math.abs(clicks);
  if (u <= 0) return 0;
  if (u <= 1) return FIRST * u;
  const near = FIRST + FAST * (NEAR - 1);
  if (u <= NEAR) return FIRST + FAST * (u - 1);
  return near + ((G - near) * (u - NEAR)) / (REACH - NEAR);
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.light = 1;
  params.lo = new Float32Array(4);
  params.hi = new Float32Array(4);
  params.cover = new Float32Array(W * H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const wide = 14 + 2 * clamp(k[1], 0, 3);
  const small = 1 - 0.6 * ((clamp(k[3], 0.06, 1) - 0.06) / 0.94);
  const size = [wide * small, wide, wide * small, wide];
  const clicks = clamp(k[2], -1, 1) * 24;
  const gap = pairGap(clicks);
  // Turned up the top two and the bottom two draw together and the gap between the pairs takes what they leave, so the column keeps its length. Turned down the middle two draw together and the outer gaps share what is left.
  let g12 = gap;
  let g23 = 3 * G - 2 * gap;
  let g34 = gap;
  if (clicks < 0) {
    g23 = gap;
    g12 = g34 = (3 * G - gap) / 2;
  }
  const gaps = [g12, g23, g34, 0];
  let total = 0;
  for (let i = 0; i < 4; i++) total += size[i] + gaps[i];
  let y = CY - total / 2;
  for (let i = 0; i < 4; i++) {
    params.lo[i] = y;
    params.hi[i] = y + size[i];
    y += size[i] + gaps[i];
  }
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.84 + 0.16 * Math.sin(t * 0.61 + 1);
  hsv(k[0] + 0.42, 0.85, params.light, params.c);
}

export function draw(display, params, time) {
  const { lo, hi, cover, c } = params;
  cover.fill(0);
  for (let i = 0; i < 4; i++) {
    const h = (hi[i] - lo[i]) / 2;
    const cy = (hi[i] + lo[i]) / 2;
    const x0 = Math.max(0, Math.floor(CX - h));
    const x1 = Math.min(W - 1, Math.ceil(CX + h));
    const y0 = Math.max(0, Math.floor(cy - h));
    const y1 = Math.min(H - 1, Math.ceil(cy + h));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let n = 0;
        for (let sy = 0; sy < SUB; sy++) {
          const dy = Math.abs(y + (sy + 0.5) / SUB - cy);
          for (let sx = 0; sx < SUB; sx++) {
            if (Math.abs(x + (sx + 0.5) / SUB - CX) + dy <= h) n++;
          }
        }
        cover[y * W + x] += n / (SUB * SUB);
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = cover[y * W + x];
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
