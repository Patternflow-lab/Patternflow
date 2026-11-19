// ===== Patternflow pattern =====
// Title:   Halfstep
// Family:  geometry
// Idea:    Four squares stand in a column down the middle of the dark, each cut across its middle, and one knob pulls the halves of every square apart until each lower half meets the upper half of the square below and the column stands again half a step on, as three whole squares between two halves.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 184
// Round:   186
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Part=-12..36, Cut=0..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from a sea green.
// Knob 2: Size. The squares and the gaps between them: sides of 10 LEDs with gaps of 8 at the bottom of the knob, 16 with gaps of 12 where it opens at 2, and at the top the sides grow to 20 while the gaps close to 8.
// Knob 3: Part. How far the two halves of every square have moved apart, in clicks. At the bottom of the knob the squares are whole for three clicks. It opens with each square split by a slit of 2.6 LEDs. Nine clicks up, the slit has grown by more than a LED a click until each lower half meets the upper half of the square below with no seam: four squares have become three whole squares with a half at each end, and the knob holds there for three clicks. Past the hold the meeting halves slide over each other until at the top of the knob the column is five equal half squares, evenly spaced.
// Knob 4: Cut. Where the cut crosses each square, from the middle where it opens at 0.06 to a sixth of the side above its bottom at the top of the knob. The halves are no longer equal, but the squares they form when they meet are still whole.

const W = 64;
const H = 128;
const CX = 32;
const CY = 64;
const N = 4;
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
// gap is where they meet the neighbours' halves, end the top of the knob.
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
  params.lo = new Float32Array(2 * N);
  params.hi = new Float32Array(2 * N);
  params.side = 16;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // Below 2 the squares and gaps shrink together; above 2 the squares grow into the gaps, so the column at the top of knob 3 still fits the panel.
  const z = clamp(k[1], 0, 3);
  const sideRaw = z < 2 ? 16 * (0.6 + 0.2 * z) : 16 + 4 * (z - 2);
  const gapRaw = z < 2 ? 12 * (0.6 + 0.2 * z) : 28 - sideRaw;
  // Even sides and gaps, so the halves end on whole LEDs.
  const side = 2 * Math.round(sideRaw / 2);
  const gap = 2 * Math.round(gapRaw / 2);
  const pitch = side + gap;
  const q = clamp(k[2], -OPEN, 48 - OPEN) + OPEN;
  // At the top of the knob the meeting halves lie exactly on each other.
  const part = partAt(q, gap, gap + side / 2);
  const d = part / 2;
  // The cut, from the middle at 0.06 to a sixth of the side above the bottom at 1.
  const cut = ((clamp(k[3], 0, 1) - 0.06) / 0.94) * (side / 3);
  const top0 = CY - (3 * pitch + side) / 2;
  for (let i = 0; i < N; i++) {
    const top = top0 + i * pitch;
    const mid = top + side / 2 + cut;
    params.lo[2 * i] = top - d;
    params.hi[2 * i] = mid - d;
    params.lo[2 * i + 1] = mid + d;
    params.hi[2 * i + 1] = top + side + d;
  }
  params.side = side;
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.45 + 0.02 * Math.sin(t * 0.37), 0.55, 0.9 + 0.1 * Math.sin(t * 1.1 + 0.7), params.col);
}

export function draw(display, params, time) {
  const { col, lo, hi, side } = params;
  const x0 = CX - side / 2;
  const x1 = CX + side / 2;
  for (let y = 0; y < H; y++) {
    const cy = y + 0.5;
    let m = 0;
    for (let j = 0; j < 2 * N && !m; j++) if (cy > lo[j] && cy < hi[j]) m = 1;
    for (let x = 0; x < W; x++) {
      const cx = x + 0.5;
      const on = m && cx > x0 && cx < x1 ? 1 : 0;
      display.setPixel(x, y, col[0] * on, col[1] * on, col[2] * on);
    }
  }
}
