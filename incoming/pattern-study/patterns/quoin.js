// ===== Patternflow pattern =====
// Title:   Quoin
// Family:  geometry
// Idea:    Squares stand one above the next on the dark, the first against the left wall, the next against the right wall and so on down the panel, and one knob sends each across to the opposite wall: the two sets pass one another without touching, and the knob holds where their leading edges meet on one line down the middle and the valley between them closes, and again where the squares reach the opposite wall.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 176
// Round:   178
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=0..4, Cross=-27..21, Behind=0.06..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from violet.
// Knob 2: Count. How many squares, 3 at the bottom of the knob to 7 at the top. It opens on five. They are 16 LEDs on a side up to five, 14 at six and 12 at seven, so each has at least 48 LEDs to cross.
// Knob 3: Cross. How far each square has gone from its own wall toward the opposite one, counted in clicks, 48 of them from every square against its wall to every square against the opposite wall. Where it opens the squares have crossed 27 LEDs, so the two sets overlap by 10 LEDs across the middle. Turn down and in 10 clicks the leading edges of the two sets meet on one line down the middle and the valley between them is shut, held for three clicks; below that the valley is open. Turn up and in 19 clicks the squares touch the opposite wall, held for the top three clicks. The clicks next to each hold move the squares more than a LED a click.
// Knob 4: Behind. How much less the squares from the right wall have crossed than the ones from the left, up to four tenths of the way. At the bottom they cross alike. The first hold stays on its three clicks and moves out with it, from 16 LEDs crossed to 20, wherever the leading edges still meet on one line.

const W = 64;
const H = 128;
// Side and gap in LEDs for three squares to seven. The stack of squares is an even number of LEDs tall, so it sits on whole LEDs about the middle.
const SIDE = [16, 16, 16, 14, 12];
const GAP = [28, 16, 8, 6, 5];
const KINK_MAX = 0.4;
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

// How far the left squares have crossed at a click of the Cross knob. Clicks 15 to 17 hold the crossing where the leading edges meet, clicks 46 to 48 hold the whole way across, and the crossing goes evenly between.
function crossAt(q, hold, full) {
  if (q <= 15) return (hold * q) / 15;
  if (q <= 17) return hold;
  if (q < 46) return hold + ((full - hold) * (q - 17)) / 29;
  return full;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.n = 5;
  params.s = 16;
  params.top = 8;
  params.pitch = 24;
  params.left = 27;
  params.right = 27;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = 3 + Math.round(clamp(k[1], 0, 4));
  const s = SIDE[n - 3];
  const g = GAP[n - 3];
  const kink = (KINK_MAX * clamp(k[3] - 0.06, 0, 0.94)) / 0.94;
  // The leading edges meet on one line when the two crossings and the two sides add up to the panel's width.
  const hold = (W - 2 * s) / (2 - kink);
  const left = crossAt(clamp(k[2], -27, 21) + 27, hold, W - s);
  params.n = n;
  params.s = s;
  params.pitch = s + g;
  params.top = (H - (n * s + (n - 1) * g)) / 2;
  params.left = left;
  params.right = left * (1 - kink);
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.78 + 0.02 * Math.sin(t * 0.43), 0.75, 0.95 * (0.9 + 0.1 * Math.sin(t * 0.9 + 2.9)), params.col);
}

export function draw(display, params, time) {
  const { n, s, top, pitch, left, right, col } = params;
  for (let y = 0; y < H; y++) {
    const rel = y + 0.5 - top;
    let sq = -1;
    if (rel > 0 && rel < n * pitch) {
      const i = Math.floor(rel / pitch);
      if (rel - i * pitch < s - EPS) sq = i;
    }
    for (let x = 0; x < W; x++) {
      let m = 0;
      if (sq >= 0) m = sq % 2 === 0 ? span(left, left + s, x) : span(W - s - right, W - right, x);
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
