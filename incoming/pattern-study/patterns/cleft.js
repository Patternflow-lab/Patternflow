// ===== Patternflow pattern =====
// Title:   Cleft
// Family:  geometry
// Idea:    Two tall bars stand side by side, each cut down its middle, and one knob pulls the halves of both bars apart until the inner halves meet in the middle as one whole bar and, on the same click, the outer halves reach the two walls.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 184
// Round:   186
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Width=0..3, Part=-12..36, Cut=0..1
//
// Knob 1: Hue. The colour of the bars, all the way round the wheel from a warm orange.
// Knob 2: Width. How wide the bars are, 10 LEDs at the bottom of the knob, 16 where it opens at 2 and 20 at the top. Their middles stay 32 LEDs apart, so the gap between them is what the bars leave, and the halves still reach the walls on the click they meet.
// Knob 3: Part. How far the two halves of each bar have moved apart, in clicks. At the bottom of the knob the bars are whole for three clicks. It opens with each bar split by a slit of 3.2 LEDs. Nine clicks up, the slit has grown by 1.4 LEDs a click until the two inner halves meet in the middle with no seam and the two outer halves stand against the walls: two bars have become one bar between two halves, and the knob holds there for three clicks. Past the hold the outer halves go out through the walls and the inner halves slide over each other, until at the top of the knob they lie exactly on one another.
// Knob 4: Cut. Where the cut runs down each bar, from the middle where it opens at 0.06 to a sixth of the width from its right side at the top. The halves are no longer equal, but the bar they make in the middle is still whole.

const W = 64;
const H = 128;
const TOP = 16;
const BOTTOM = 112;
// The middles of the two bars.
const C0 = 16;
const C1 = 48;
// Knob 3 has 48 clicks and opens 12 above its bottom.
const OPEN = 12;
const HOLD = 21;

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

function lerp(a, b, u) {
  return a + (b - a) * u;
}

// The whole distance between the two halves of a bar, for a click q of knob 3.
function partAt(q, gap, end) {
  // A narrow slit where the knob opens, so the two halves still read as one bar, and more than a LED a click from there to the hold.
  const open = Math.max(gap * 0.2, Math.min(3.2, gap - 9 * 1.05));
  if (q <= 2) return 0;
  if (q <= OPEN) return lerp(0, open, (q - 2) / (OPEN - 2));
  if (q <= HOLD) return lerp(open, gap, (q - OPEN) / (HOLD - OPEN));
  if (q <= HOLD + 2) return gap;
  return lerp(gap, end, (q - HOLD - 2) / (48 - HOLD - 2));
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.lo = new Float32Array(4);
  params.hi = new Float32Array(4);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const z = clamp(k[1], 0, 3);
  const widthRaw = z < 2 ? 10 + 3 * z : 16 + 4 * (z - 2);
  // An even width, so the halves start on whole LEDs.
  const width = 2 * Math.round(widthRaw / 2);
  // The bars' middles are half the panel apart, so when the gap between them has closed, each outer half has moved a quarter of the panel less half a bar and stands on its wall.
  const gap = C1 - C0 - width;
  const q = clamp(k[2], -OPEN, 48 - OPEN) + OPEN;
  const d = partAt(q, gap, gap + width / 2) / 2;
  // A quarter LED right of the middle where it opens, so the cut's edges cross the LEDs between the clicks where the outer edges do, and no click near the hold leaves the picture as it was.
  const cut = 0.25 + ((clamp(k[3], 0, 1) - 0.06) / 0.94) * (width / 3);
  for (let i = 0; i < 2; i++) {
    const c = i === 0 ? C0 : C1;
    const left = c - width / 2;
    const mid = c + cut;
    params.lo[2 * i] = left - d;
    params.hi[2 * i] = mid - d;
    params.lo[2 * i + 1] = mid + d;
    params.hi[2 * i + 1] = c + width / 2 + d;
  }
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.07 + 0.02 * Math.sin(t * 0.43), 0.6, 0.92 + 0.08 * Math.sin(t * 0.83 + 1.9), params.col);
}

export function draw(display, params, time) {
  const { col, lo, hi } = params;
  for (let x = 0; x < W; x++) {
    const cx = x + 0.5;
    let m = 0;
    for (let j = 0; j < 4 && !m; j++) if (cx > lo[j] && cx < hi[j]) m = 1;
    for (let y = 0; y < H; y++) {
      const on = m && y >= TOP && y < BOTTOM ? 1 : 0;
      display.setPixel(x, y, col[0] * on, col[1] * on, col[2] * on);
    }
  }
}
