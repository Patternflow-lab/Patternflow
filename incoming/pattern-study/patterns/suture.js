// ===== Patternflow pattern =====
// Title:   Suture
// Family:  geometry
// Idea:    Two thick lines come in from the ceiling and the floor of a bare dark panel, off to one side, and stop short of each other, and the four knobs are the colour, how thick the lines are, how far apart they stop and where along the panel they meet: the gap narrows until the tips touch, and two lines are one line from the floor to the ceiling.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 170
// Round:   172
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Thick=1..3, Close=-36..12, Slide=0.06..1
//
// Knob 1: Hue. The colour of the lines, all the way round the wheel from pink.
// Knob 2: Thick. How thick the lines are, 10 LEDs at 1, 20 where it opens at 2 and 30 at 3. Their middle stands 40 LEDs from the left wall whatever their thickness.
// Knob 3: Close. How far apart the two tips stop, counted in clicks; turn it up and they come together. Where it opens, 0, the tips are 24 LEDs apart. Ten clicks on they touch: the two lines are one line from the floor to the ceiling, and the knob holds for three clicks to the top end. The eight clicks before that each close the gap by more than 2 LEDs.
// Knob 4: Slide. Where along the panel the tips meet, up to as far as the lines are thick below the middle. At its bottom, where it opens, they meet in the middle, so the upper line is as long as the lower one; turned up the upper line is longer and the lower shorter. The tips never come nearer the floor than 5 LEDs on the way, so the lower line always shows.

const W = 64;
const H = 128;
const CX = 40;
// Knob 3 is counted in clicks and the knob has 48 of them, 36 below where it opens and 12 above.
const OPEN = 36;
// Half the gap between the tips where Close opens, and at its bottom, where each line is 12 LEDs long.
const R_OPEN = 12;
const R_END = 52;

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

// Half the gap between the tips for every point of the Close knob, as corners (clicks, LEDs) joined by straight lines. The tips touch on the knob's top three clicks. The eight clicks before that move each tip more than a LED, and the click right before moves it 2.1 LEDs, so the last picture before the touch still has a column of LEDs dark between them.
const QS = [0, OPEN, 38, 45, 46, 48];
const RS = [R_END, R_OPEN, 9.8, 2.1, 0, 0];

function halfAt(q) {
  if (q <= QS[0]) return RS[0];
  for (let i = 1; i < QS.length; i++) {
    if (q <= QS[i]) return RS[i - 1] + ((RS[i] - RS[i - 1]) * (q - QS[i - 1])) / (QS[i] - QS[i - 1]);
  }
  return RS[RS.length - 1];
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.cols = new Float32Array(W);
  params.rows = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The lines are 10 * Thick LEDs thick, snapped to an even number so they stay centred on whole LEDs.
  const thick = 2 * Math.round(5 * clamp(k[1], 1, 3));
  const half = halfAt(clamp(k[2], -OPEN, 48 - OPEN) + OPEN);
  // Where the tips meet: the middle of the panel, moved down by up to one thick. The lower line keeps 5 LEDs.
  const slide = clamp((k[3] - 0.06) / 0.94, 0, 1);
  const meet = H / 2 + slide * Math.min(thick, Math.max(0, H / 2 - 5 - half));
  const cols = params.cols;
  const rows = params.rows;
  for (let x = 0; x < W; x++) cols[x] = span(CX - thick / 2, CX + thick / 2, x);
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.86 + 0.02 * Math.sin(t * 0.37), 0.7, 0.92 * (0.82 + 0.18 * Math.sin(t * 0.59 + 1.3)), params.col);
  for (let y = 0; y < H; y++) {
    const c = span(0, meet - half, y) + span(meet + half, H, y);
    rows[y] = c > 1 ? 1 : c;
  }
}

export function draw(display, params, time) {
  const { cols, rows, col } = params;
  for (let y = 0; y < H; y++) {
    const r = rows[y];
    for (let x = 0; x < W; x++) {
      const m = cols[x] * r;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
