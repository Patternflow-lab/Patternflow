// ===== Patternflow pattern =====
// Title:   Slip
// Family:  geometry
// Idea:    One thick vertical line stands on a bare dark ground, cut across by a crack, and the four knobs are the colour, how thick the line is, how far the lower half has slid sideways along the crack and where along the line the crack falls: slid back to nothing the steps either side of the crack are gone and the line is whole, and slid by exactly its thickness the two halves touch at one corner and the next click parts them.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 160
// Round:   162
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Thick=0..3, Slide=-1.375..0.625, Crack=0..1
//
// Knob 1: Hue. The colour of the line, all the way round the wheel from sky blue.
// Knob 2: Thick. How thick the line is, 16 LEDs at 0 to 26.5 LEDs at 3; its 2 is 23 LEDs. The line is 100 LEDs long.
// Knob 3: Slide. How far the lower half has slid along the crack, a little over one LED a click, both ways. It holds for three clicks where the slide is nothing and the line is whole, and for three clicks at each place the slide is as much as the thickness, with the halves touching at one corner. Past that the halves are apart. It opens halfway between whole and touching, so the line stands with a step.
// Knob 4: Crack. Where along the line the crack falls, from the middle at 0 to a quarter of the length below the middle at 1, which leaves the shorter half a quarter of the line. It opens at 0.06.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = H / 2;
const LEN = 100;
// The Slide knob has 48 clicks over its range of 2, and the whole line sits at click 24. Touching is 18 clicks to either side, so the knob opens, at click 33, nine clicks from both.
const MID = 24;
const REACH = 18;
// How far the halves part on each click past touching.
const PART = 1.5;

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

// How far the lower half has slid for a knob at k, given the thickness. Nothing for the click the knob rests on and one either side; then a straight run to the thickness at 17 clicks out, held there for three clicks; then the halves part.
function slide(k, thick) {
  const d = (clamp(k, -1.375, 0.625) + 1.375) * 24 - MID;
  const a = Math.abs(d);
  let s;
  if (a <= 1 + 1e-6) s = 0;
  else if (a <= REACH - 1) s = (thick * (a - 1)) / (REACH - 2);
  else if (a <= REACH + 1 + 1e-6) s = thick;
  else s = thick + PART * (a - REACH - 1);
  return d < 0 ? -s : s;
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.thick = 23;
  params.s = 0;
  params.cut = CY;
  params.light = 1;
  params.cu = new Float32Array(W);
  params.cl = new Float32Array(W);
  params.ru = new Float32Array(H);
  params.rl = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const thick = 16 + 3.5 * clamp(k[1], 0, 3);
  params.thick = thick;
  params.s = slide(k[2], thick);
  // The crack falls between two rows of LEDs, so touching at a corner is touching at one point and no LED holds a piece of both halves.
  params.cut = Math.round(CY + (LEN / 4) * clamp(k[3], 0, 1));
  // Nothing about the line moves on the clock. Its light swells and falls a little, so the panel is never quite still.
  params.light = 0.9 + 0.1 * Math.sin(t * 0.61 + 1);
  hsv(k[0] + 0.55, 0.85, params.light, params.c);
}

export function draw(display, params, time) {
  const { thick, s, cut, cu, cl, ru, rl, c } = params;
  // The upper half and the lower half slide the same distance either way, so the pair stays about the middle of the panel.
  for (let x = 0; x < W; x++) {
    cu[x] = span(CX - s / 2 - thick / 2, CX - s / 2 + thick / 2, x);
    cl[x] = span(CX + s / 2 - thick / 2, CX + s / 2 + thick / 2, x);
  }
  // The upper half ends on the crack and the lower half starts there, so no LED holds both.
  for (let y = 0; y < H; y++) {
    ru[y] = span(CY - LEN / 2, cut, y);
    rl[y] = span(cut, CY + LEN / 2, y);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = cu[x] * ru[y] + cl[x] * rl[y];
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
