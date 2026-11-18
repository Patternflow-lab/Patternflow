// ===== Patternflow pattern =====
// Title:   Cant
// Family:  geometry
// Idea:    One straight edge splits the panel into a lit half and a dark half and leans over as you turn a knob, so the steps along it are uneven everywhere except where the lean matches the LED grid: at two columns to a row, one to one, and one column to two rows the steps come out all alike, and the knob holds there.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 172
// Round:   174
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Light=0.2..0.48, Lean=-36..12, Pivot=0.06..1
//
// Knob 1: Hue. The colour of the lit half, turned all the way round the wheel from teal.
// Knob 2: Light. How bright the lit half is, from a fifth up to just under half; the dark half stays dark.
// Knob 3: Lean. How far the edge has leant over from level, one way only, counted in clicks. Where it opens it is steeper than one to one, and the steps along it are uneven. Turn down and it comes to one column to two rows, 10 clicks below, and the steps are all alike; the knob holds for three clicks and the edge then slows to a level pace for the 10 clicks before one to one, where it holds again. Ten clicks below that is two columns to a row, held again, and then level, held for the last three clicks. Turn up and the edge steepens until it runs corner to corner, one column to two rows, in the last three clicks. The eight clicks before each of these move the ends of the edge more than a LED a click.
// Knob 4: Pivot. How far the point the edge turns about has moved from the middle of the panel, along the level line to the right, up to 20 LEDs. At the bottom the edge turns about the middle and at the steepest runs into both corners; further up it lies lower once it leans, and the turn of the edge makes the lit half smaller.

const W = 64;
const H = 128;
const CX = 32;
const CY = 64;
// Knob 3 has 48 clicks and opens 36 above its bottom.
const OPEN = 36;
const PIVOT_MAX = 20;
const HARD = true;

// How steep the edge is for every click of the Lean knob, as corners (click, steepness in rows a column) joined by straight lines. The clicks that hold are 0 to 2 (level), 12 to 14 (one row in two columns), 24 to 26 (one to one) and 46 to 48 (two rows in a column).
const QS = [0, 2, 12, 14, 24, 26, 34, 38, 46, 48];
const SS = [0, 0, 0.5, 0.5, 1, 1, 1.32, 1.44, 2, 2];

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

function steep(q) {
  if (q <= QS[0]) return SS[0];
  for (let i = 1; i < QS.length; i++) {
    if (q <= QS[i]) {
      const w = QS[i] - QS[i - 1];
      return w > 0 ? SS[i - 1] + ((SS[i] - SS[i - 1]) * (q - QS[i - 1])) / w : SS[i];
    }
  }
  return SS[SS.length - 1];
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.s = 0;
  params.d = 0;
  params.v = 0.48;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 0.48, 0, 0.06];
  params.t += dt;
  const t = params.t;
  params.s = steep(clamp(k[2], -OPEN, 48 - OPEN) + OPEN);
  params.d = (PIVOT_MAX * clamp(k[3] - 0.06, 0, 0.94)) / 0.94;
  params.v = clamp(k[1], 0.2, 0.48);
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.5 + 0.02 * Math.sin(t * 0.41), 0.8, params.v * (0.88 + 0.12 * Math.sin(t * 0.63 + 0.7)), params.col);
}

export function draw(display, params, time) {
  const { col, s, d } = params;
  const norm = 1 / Math.sqrt(1 + s * s);
  for (let x = 0; x < W; x++) {
    // The edge's height above this column's middle, counted from the top; it rises to the right.
    const yl = CY - s * (x + 0.5 - (CX + d));
    for (let y = 0; y < H; y++) {
      let m;
      if (HARD) m = y + 0.5 > yl + 1e-4 ? 1 : 0;
      else m = clamp(0.5 + (y + 0.5 - yl) * norm, 0, 1);
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
