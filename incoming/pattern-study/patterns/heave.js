// ===== Patternflow pattern =====
// Title:   Heave
// Family:  geometry
// Idea:    One triangle stands point up on a bare dark ground, split by a crack that drops straight down from its point, and the four knobs are the colour, the size, how far the right half has slid up or down along the crack and where along the base the crack lands: slid back to nothing the steps either side of the crack are gone and the triangle is whole.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 160
// Round:   162
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Slide=-1.375..0.625, Crack=0..1
//
// Knob 1: Hue. The colour of the triangle, all the way round the wheel from yellow.
// Knob 2: Size. The base of the triangle, 32 LEDs at 0 to 59 LEDs at 3; its 2 is 50 LEDs. The height is 0.65 of the base, so the triangle stands broad and low.
// Knob 3: Slide. How far the right half has slid along the crack, 1.5 LEDs a click, both ways, and farther to the right than to the left. It holds for three clicks where the slide is nothing and the triangle is whole. It opens fourteen clicks from there, so the triangle stands with a step of 19.5 LEDs.
// Knob 4: Crack. Where along the base the crack lands, and so where the point of the triangle is, from the middle at 0 to a quarter of the base to the right of the middle at 1. It opens at 0.06.

const W = 64;
const H = 128;
const CX = W / 2;
// The triangle's middle row, well above the middle of the panel. The halves slide up and down, so the room above and below it is left for them.
const TY = 48;
// The Slide knob has 48 clicks over its range of 2, and the whole triangle sits at click 19. The knob opens at click 33, fourteen clicks from it, where the halves are far enough apart to read as two halves and not as a notch.
const MID = 19;
// LEDs the halves slide on each click.
const STEP = 1.5;
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

// How much of the LED between p and p + 1 the span from lo to hi covers.
function span(lo, hi, p) {
  const v = (hi < p + 1 ? hi : p + 1) - (lo > p ? lo : p);
  return v < 0 ? 0 : v;
}

// How far the right half has slid for a knob at k. Nothing for the click the knob rests on and one either side, then a straight run.
function slide(k) {
  const d = (clamp(k, -1.375, 0.625) + 1.375) * 24 - MID;
  const a = Math.abs(d);
  const s = a <= 1 + 1e-6 ? 0 : STEP * (a - 1);
  return d < 0 ? -s : s;
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.base = 50;
  params.height = 32.5;
  params.s = 0;
  params.apex = CX;
  params.light = 1;
  params.row = new Float32Array(W);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const base = 32 + 9 * clamp(k[1], 0, 3);
  params.base = base;
  params.height = base * 0.65;
  params.s = slide(k[2]);
  // The crack drops between two columns of LEDs, so no LED holds a piece of both halves at the top of a step.
  params.apex = Math.round(CX + (base / 4) * clamp(k[3], 0, 1));
  // Nothing about the triangle moves on the clock. Its light swells and falls a little, so the panel is never quite still. The triangle is a small share of the panel, so the swell is wide.
  params.light = 0.78 + 0.22 * Math.sin(t * 0.47 + 3);
  hsv(k[0] + 0.16, 0.85, params.light, params.c);
}

export function draw(display, params, time) {
  const { base, height, s, apex, row, c } = params;
  const top = TY - height / 2;
  const left = CX - base / 2;
  const right = CX + base / 2;
  // The left half has slid down by half the slide and the right half up by half, so the pair stays about the same height. Each row is read at four heights inside the LED, and in each one the half is as wide as its distance down from its own point.
  for (let y = 0; y < H; y++) {
    row.fill(0);
    for (let j = 0; j < SUB; j++) {
      const yy = y + (j + 0.5) / SUB;
      const ul = (yy - s / 2 - top) / height;
      const ur = (yy + s / 2 - top) / height;
      if (ul > 0 && ul <= 1) {
        const lo = apex - ul * (apex - left);
        for (let x = Math.max(0, Math.floor(lo)); x <= Math.min(W - 1, Math.ceil(apex)); x++) row[x] += span(lo, apex, x) / SUB;
      }
      if (ur > 0 && ur <= 1) {
        const hi = apex + ur * (right - apex);
        for (let x = Math.max(0, Math.floor(apex)); x <= Math.min(W - 1, Math.ceil(hi)); x++) row[x] += span(apex, hi, x) / SUB;
      }
    }
    for (let x = 0; x < W; x++) display.setPixel(x, y, c[0] * row[x], c[1] * row[x], c[2] * row[x]);
  }
}
