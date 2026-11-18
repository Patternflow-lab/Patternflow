// ===== Patternflow pattern =====
// Title:   Throw
// Family:  geometry
// Idea:    One band runs from wall to wall low on a bare dark ground, cut across by a crack, and the four knobs are the colour, how thick the band is, how far the right half has slid up or down along the crack and where across the band the crack falls: slid back to nothing the steps either side of the crack are gone and the band is whole, and slid by exactly its thickness the two halves touch at one corner and the next click parts them.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 160
// Round:   162
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Thick=0..3, Slide=-1.375..0.625, Crack=0..1
//
// Knob 1: Hue. The colour of the band, all the way round the wheel from magenta.
// Knob 2: Thick. How thick the band is, 17 LEDs at 0 to 32 LEDs at 3; its 2 is 27 LEDs. The band is the whole 64 LEDs between the side walls.
// Knob 3: Slide. How far the right half has slid along the crack, more than one LED a click, both ways. It holds for three clicks where the slide is nothing and the band is whole, and for three clicks at each place the slide is as much as the thickness, with the halves touching at one corner. Past that the halves are apart. It opens nine clicks from whole and nine from touching, so the band stands with a step.
// Knob 4: Crack. Where across the band the crack falls, from the middle at 0 to a quarter of the width to the right of the middle at 1, which leaves the shorter half a quarter of the band. It opens at 0.06.

const W = 64;
const H = 128;
const CX = W / 2;
// The band sits low, its middle on this row, so it is not the middle of the panel.
const BY = 92;
// The Slide knob has 48 clicks over its range of 2, and the whole band sits at click 24. Touching is 18 clicks to either side, so the knob opens, at click 33, nine clicks from both.
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

// How far the right half has slid for a knob at k, given the thickness. Nothing for the click the knob rests on and one either side; then a run out to the slide the knob opens at, nine clicks from the middle; then a run to the thickness at 17 clicks out, held there for three clicks; then the halves part. The opening slide is the thickness less 9.6 LEDs, which is 1.2 LEDs for each of the eight clicks before touching, and at 17 LEDs thick it is half the thickness, so every click on either run is more than one LED.
function slide(k, thick) {
  const d = (clamp(k, -1.375, 0.625) + 1.375) * 24 - MID;
  const a = Math.abs(d);
  const open = clamp(thick - 9.6, 8.5, thick - 8.5);
  let s;
  if (a <= 1 + 1e-6) s = 0;
  else if (a <= 9) s = (open * (a - 1)) / 8;
  else if (a <= REACH - 1) s = open + ((thick - open) * (a - 9)) / 8;
  else if (a <= REACH + 1 + 1e-6) s = thick;
  else s = thick + PART * (a - REACH - 1);
  return d < 0 ? -s : s;
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.thick = 27;
  params.s = 0;
  params.cut = CX;
  params.light = 1;
  params.cl = new Float32Array(W);
  params.cr = new Float32Array(W);
  params.rl = new Float32Array(H);
  params.rr = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const thick = 17 + 5 * clamp(k[1], 0, 3);
  params.thick = thick;
  params.s = slide(k[2], thick);
  // The crack falls between two columns of LEDs, so touching at a corner is touching at one point and no LED holds a piece of both halves.
  params.cut = Math.round(CX + (W / 4) * clamp(k[3], 0, 1));
  // Nothing about the band moves on the clock. Its light swells and falls a little, so the panel is never quite still. The band is a smaller share of the panel than the line is, so the swell is wider.
  params.light = 0.86 + 0.14 * Math.sin(t * 0.53 + 2);
  hsv(k[0] + 0.83, 0.85, params.light, params.c);
}

export function draw(display, params, time) {
  const { thick, s, cut, cl, cr, rl, rr, c } = params;
  // Each half slides the same distance, one up and one down, so the pair stays about the same row.
  for (let x = 0; x < W; x++) {
    cl[x] = span(0, cut, x);
    cr[x] = span(cut, W, x);
  }
  // The left half ends on the crack and the right half starts there, so no LED holds both.
  for (let y = 0; y < H; y++) {
    rl[y] = span(BY - s / 2 - thick / 2, BY - s / 2 + thick / 2, y);
    rr[y] = span(BY + s / 2 - thick / 2, BY + s / 2 + thick / 2, y);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = cl[x] * rl[y] + cr[x] * rr[y];
      display.setPixel(x, y, c[0] * m, c[1] * m, c[2] * m);
    }
  }
}
