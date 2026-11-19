// ===== Patternflow pattern =====
// Title:   Tenon
// Family:  geometry
// Idea:    Bars lie across the dark, the first reaching in from the left wall, the next from the right wall and so on down the panel, and one knob pushes them toward each other: they slide past one another without touching, and the knob holds where the two sets end on one line down the middle and the valley between them closes, and again where the bars reach the opposite wall.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 176
// Round:   178
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=-2..2, Reach=-36..12, Short=0.06..1
//
// Knob 1: Hue. The colour of the bars, all the way round the wheel from cyan.
// Knob 2: Count. How many bars, 3 at the bottom of the knob to 7 at the top, where it opens. The bars are 16 LEDs thick at three and 8 at seven, so the ink at the middle hold is a fifth to a quarter of the panel at any count.
// Knob 3: Reach. How far the bars reach in from their walls, counted in clicks, 48 of them from a stub of 6 LEDs to a bar that spans the panel. Where it opens the bars from the left wall reach 48 LEDs and the right ones the same, so the two sets lap by 32. Turn down and in 10 clicks the two sets end on one line at the middle of the panel and the dark valley between them is shut, held for three clicks; below that the valley is open. Turn up and in 10 clicks the bars touch the walls opposite, held for the top three clicks. The clicks next to each hold move the bar ends more than a LED a click.
// Knob 4: Short. How much shorter the bars from the right wall reach than the ones from the left, up to a half. At the bottom they reach alike. The middle hold stays on its three clicks and moves out with it, from 32 LEDs to 43, wherever the two sets still end on one line.

const W = 64;
const H = 128;
// Thickness and gap in LEDs for three bars to seven. The two even numbers of LEDs make the first and last bar sit on whole LEDs, and the stack is centred.
const THICK = [16, 14, 12, 10, 8];
const GAP = [28, 18, 12, 10, 9];
const KINK_MAX = 0.5;
const LEAD = 6;
const EPS = 1e-6;

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

// How far the left bars reach at a click of the Reach knob. The right bars reach kink less, so the two sets end on one line when the reaches add up to the panel's width. Clicks 24 to 26 hold that, clicks 46 to 48 hold the full width, and the reach goes evenly between.
function reachAt(q, hold) {
  if (q <= 24) return LEAD + ((hold - LEAD) * q) / 24;
  if (q <= 26) return hold;
  if (q < 46) return hold + ((W - hold) * (q - 26)) / 20;
  return W;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.n = 7;
  params.top = 9;
  params.thick = 8;
  params.pitch = 17;
  params.left = 48;
  params.right = 48;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = 5 + Math.round(clamp(k[1], -2, 2));
  const kink = (KINK_MAX * clamp(k[3] - 0.06, 0, 0.94)) / 0.94;
  const hold = W / (2 - kink);
  const left = reachAt(clamp(k[2], -36, 12) + 36, hold);
  params.n = n;
  params.thick = THICK[n - 3];
  params.pitch = THICK[n - 3] + GAP[n - 3];
  params.top = (H - (n * THICK[n - 3] + (n - 1) * GAP[n - 3])) / 2;
  params.left = left;
  params.right = left * (1 - kink);
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.5 + 0.02 * Math.sin(t * 0.43), 0.75, 0.95 * (0.9 + 0.1 * Math.sin(t * 0.9 + 0.4)), params.col);
}

export function draw(display, params, time) {
  const { n, top, thick, pitch, left, right, col } = params;
  for (let y = 0; y < H; y++) {
    const rel = y + 0.5 - top;
    let bar = -1;
    if (rel > 0 && rel < n * pitch) {
      const i = Math.floor(rel / pitch);
      if (rel - i * pitch < thick - EPS) bar = i;
    }
    for (let x = 0; x < W; x++) {
      let m = 0;
      if (bar >= 0) m = bar % 2 === 0 ? span(0, left, x) : span(W - right, W, x);
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
