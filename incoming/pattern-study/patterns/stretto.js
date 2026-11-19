// ===== Patternflow pattern =====
// Title:   Stretto
// Family:  geometry
// Idea:    Upright bars stand across the dark, the first hanging from the ceiling, the next rising from the floor and so on along the panel, and one knob lengthens them toward each other: they pass one another side by side without touching, and the knob holds where the hanging bars and the rising bars end on one line across the middle and the valley between them closes, and again where the bars reach the opposite end of the panel.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 176
// Round:   178
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=0..4, Reach=-35..13, Short=0.06..1
//
// Knob 1: Hue. The colour of the bars, all the way round the wheel from gold.
// Knob 2: Count. How many bars, 3 at the bottom of the knob to 7 at the top. It opens on five. The bars are 10 LEDs wide at three and 4 at seven, so the ink at the middle hold is about a quarter of the panel at any count.
// Knob 3: Reach. How far the bars grow from the ceiling and the floor, counted in clicks, 48 of them from a stub of 16 LEDs to a bar that spans the panel's height. Where it opens the hanging bars are 93 LEDs long and so are the rising ones, so the two sets lap by 58. Turn down and in 9 clicks the two sets end on one line across the middle of the panel and the dark valley between them is shut, held for three clicks; below that the valley is open. Turn up and in 11 clicks the bars touch the opposite end of the panel, held for the top three clicks. The clicks next to each hold move the bar ends two LEDs or more a click.
// Knob 4: Short. How much shorter the bars from the floor grow than the ones from the ceiling, up to a half. At the bottom they grow alike. The middle hold stays on its three clicks and moves out with it, from 64 LEDs to 85, wherever the two sets still end on one line.

const W = 64;
const H = 128;
// Width and gap in LEDs for three bars to seven. The whole row is an even number of LEDs, so it sits on whole LEDs about the middle.
const WIDE = [10, 8, 6, 6, 4];
const GAP = [12, 8, 6, 4, 4];
const KINK_MAX = 0.5;
const LEAD = 16;
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

// How far the hanging bars reach at a click of the Reach knob. The rising bars reach kink less, so the two sets end on one line when the reaches add up to the panel's height. Clicks 24 to 26 hold that, clicks 46 to 48 hold the full height, and the reach goes evenly between.
function reachAt(q, hold) {
  if (q <= 24) return LEAD + ((hold - LEAD) * q) / 24;
  if (q <= 26) return hold;
  if (q < 46) return hold + ((H - hold) * (q - 26)) / 20;
  return H;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.n = 5;
  params.x0 = 5;
  params.wide = 6;
  params.pitch = 12;
  params.down = 93;
  params.up = 93;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = 3 + Math.round(clamp(k[1], 0, 4));
  const kink = (KINK_MAX * clamp(k[3] - 0.06, 0, 0.94)) / 0.94;
  const hold = H / (2 - kink);
  const down = reachAt(clamp(k[2], -35, 13) + 35, hold);
  params.n = n;
  params.wide = WIDE[n - 3];
  params.pitch = WIDE[n - 3] + GAP[n - 3];
  params.x0 = (W - (n * WIDE[n - 3] + (n - 1) * GAP[n - 3])) / 2;
  params.down = down;
  params.up = down * (1 - kink);
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.15 + 0.02 * Math.sin(t * 0.43), 0.75, 0.95 * (0.9 + 0.1 * Math.sin(t * 0.9 + 1.7)), params.col);
}

export function draw(display, params, time) {
  const { n, x0, wide, pitch, down, up, col } = params;
  for (let x = 0; x < W; x++) {
    const rel = x + 0.5 - x0;
    let bar = -1;
    if (rel > 0 && rel < n * pitch) {
      const i = Math.floor(rel / pitch);
      if (rel - i * pitch < wide - EPS) bar = i;
    }
    for (let y = 0; y < H; y++) {
      let m = 0;
      if (bar >= 0) m = bar % 2 === 0 ? span(0, down, y) : span(H - up, H, y);
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
