// ===== Patternflow pattern =====
// Title:   Rejoin
// Family:  geometry
// Idea:    Three squares stand in a row near the floor, each cut down its middle, and one knob pulls the halves of every square apart until the inner halves meet their neighbours' as two whole squares and the outer halves reach the walls, so the row stands again half a step on.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 184
// Round:   186
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Part=-12..36, Step=0..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from a cool blue.
// Knob 2: Size. The side of the squares, 8 LEDs at the bottom of the knob, 14 where it opens at 2 and 16 at the top. Their middles stay a third of the panel apart, so the halves still meet and reach the walls on the same click.
// Knob 3: Part. How far the two halves of every square have moved apart, in clicks. At the bottom of the knob the squares are whole for three clicks. It opens with each square split by a slit of 1.5 LEDs. Nine clicks up, the inner halves meet their neighbours' with no seam and the outer halves stand against the walls: three squares have become two whole squares between two halves, and the knob holds there for three clicks. The row is only 64 LEDs wide, so the slit grows by two thirds of a LED a click. Past the hold the outer halves go out through the walls and the meeting halves slide over each other.
// Knob 4: Step. How much higher each square stands than the one to its left, from level where it opens at 0.06 to half a side at the top. Away from level, the halves still meet on the same click, but the squares they make carry a step where the two halves sit at different heights.

const W = 64;
const H = 128;
const FLOOR = 120;
// The middles of the three squares, a third of the panel apart.
const STEP = W / 3;
const MIDS = [W / 2 - STEP, W / 2, W / 2 + STEP];
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

// The whole distance between the two halves of a square, for a click q of knob 3.
function partAt(q, gap, end) {
  const open = Math.max(gap - 9 * 1.05, gap * 0.2);
  if (q <= 2) return 0;
  if (q <= OPEN) return lerp(0, open, (q - 2) / (OPEN - 2));
  if (q <= HOLD) return lerp(open, gap, (q - OPEN) / (HOLD - OPEN));
  if (q <= HOLD + 2) return gap;
  return lerp(gap, end, (q - HOLD - 2) / (48 - HOLD - 2));
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.lo = new Float32Array(6);
  params.hi = new Float32Array(6);
  params.step = 0;
  params.side = 14;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const z = clamp(k[1], 0, 3);
  const sideRaw = z < 2 ? 8 + 3 * z : 14 + 2 * (z - 2);
  const side = 2 * Math.round(sideRaw / 2);
  const gap = STEP - side;
  const q = clamp(k[2], -OPEN, 48 - OPEN) + OPEN;
  const d = partAt(q, gap, gap + side / 2) / 2;
  const step = ((clamp(k[3], 0, 1) - 0.06) / 0.94) * (side / 2);
  for (let i = 0; i < 3; i++) {
    const c = MIDS[i];
    const mid = c;
    params.lo[2 * i] = c - side / 2 - d;
    params.hi[2 * i] = mid - d;
    params.lo[2 * i + 1] = mid + d;
    params.hi[2 * i + 1] = c + side / 2 + d;
  }
  params.side = side;
  params.step = step;
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still. The squares light little of the panel, so the swell is deep.
  hsv(k[0] + 0.58 + 0.02 * Math.sin(t * 0.39), 0.6, 0.88 + 0.12 * Math.sin(t * 1.2 + 0.4), params.col);
}

export function draw(display, params, time) {
  const { col, lo, hi, side, step } = params;
  for (let x = 0; x < W; x++) {
    const cx = x + 0.5;
    for (let y = 0; y < H; y++) {
      const cy = y + 0.5;
      let on = 0;
      // Both halves of square i stand i steps above the floor line.
      for (let j = 0; j < 6 && !on; j++) {
        const bottom = FLOOR - (j >> 1) * step;
        if (cx > lo[j] && cx < hi[j] && cy > bottom - side && cy < bottom) on = 1;
      }
      display.setPixel(x, y, col[0] * on, col[1] * on, col[2] * on);
    }
  }
}
