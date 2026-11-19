// ===== Patternflow pattern =====
// Title:   Swivel
// Family:  geometry
// Idea:    Three squares stand in a row along the panel's diagonal from the top left to the bottom right, and one knob turns all three in place by the same angle: their middles never move, yet turning alone first closes the gaps, where the corners meet and the row becomes one piece, and then opens them again, where the corners slip past, and the knob holds at both.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 182
// Round:   184
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..2, Turn=-18..30, Lag=-1..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from amber.
// Knob 2: Size. The squares and the step between them grow together: a side of 17.5 LEDs on a step of 10 across and 20 down at the bottom of the knob, and 24 on 13 and 26 at the top, where it opens. The step is kept to whole LEDs.
// Knob 3: Turn. How far all three have turned, clockwise up and anticlockwise down, counted in clicks. Where it opens they have turned 31.8 degrees anticlockwise and stand apart, 9 clicks below the first hold. Turn up 4 degrees a click and at 4.2 degrees their corners meet and the row is one piece on a single click; the knob holds for three. Five clicks on, at 32.0 degrees, the corners are about to slip past each other; the knob holds for three more and on the next click the row is three again. Both angles are found from the size by lighting the squares LED by LED. Four more clicks of 4 degrees and then a degree a click to the top; below the opening it goes a degree a click to the bottom.
// Knob 4: Lag. How much further each square down the row has turned than the one before it, up to 12 degrees more at the top of the knob and 12 degrees less at the bottom, so the last square is as far behind as in a column of four turning 8 degrees apart. Where it opens they turn as one; away from there the corners meet and part one pair at a time.

const W = 64;
const H = 128;
const CX = 32.25;
const CY = 64.25;
const N = 3;
// Knob 3 has 48 clicks and opens 18 above its bottom.
const OPEN = 18;
const DEG = Math.PI / 180;
// How fine the search for the touching angles steps.
const SCAN = 0.02 * DEG;
// The turn at which a square's corners point along the row, which runs one LED across for two down.
const ALONG = Math.atan2(2, 1) - Math.PI / 4;

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

// Whether an LED's middle falls inside a square of half side hw, centred at (cx, cy) and turned clockwise by th.
function inside(x, y, cx, cy, c, s, hw) {
  const rx = x + 0.5 - cx;
  const ry = y + 0.5 - cy;
  const u = rx * c + ry * s;
  const v = ry * c - rx * s;
  return u > -hw && u < hw && v > -hw && v < hw;
}

// Whether a square and the same square moved (dx, dy) whole LEDs light the same LED or two LEDs side by side, which is the column becoming one piece. Being whole LEDs apart, the second square lights exactly the first one's LEDs moved over.
function joined(th, hw, cx, cy, dx, dy, grid) {
  const c = Math.cos(th);
  const s = Math.sin(th);
  const r = Math.ceil(hw * Math.SQRT2) + 1;
  const x0 = Math.floor(cx) - r;
  const y0 = Math.floor(cy) - r;
  const n = 2 * r + 1;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) grid[j * n + i] = inside(x0 + i, y0 + j, cx, cy, c, s, hw) ? 1 : 0;
  const lit = (i, j) => i >= 0 && j >= 0 && i < n && j < n && grid[j * n + i] === 1;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      if (grid[j * n + i] !== 1) continue;
      const a = i - dx;
      const b = j - dy;
      if (lit(a, b) || lit(a + 1, b) || lit(a - 1, b) || lit(a, b + 1) || lit(a, b - 1)) return true;
    }
  return false;
}

// For every click of the Turn knob, how far the squares have turned: corners (click, turn) joined by straight lines. step is the turn of a click next to either hold.
function plan(P, meet, part, step) {
  const open = meet - 9 * step;
  // A quarter turn round, the squares are back where they were. The bottom of the knob stays 4 degrees short of where they parted a quarter turn before.
  const pts = [
    [0, Math.max(open - OPEN * DEG, part - 86 * DEG)],
    [OPEN, open],
    [OPEN + 9, meet],
    [OPEN + 11, meet],
    [OPEN + 16, part],
    [OPEN + 18, part],
    [OPEN + 22, part + 4 * step],
    [48, part + 4 * step + (30 - 22) * DEG],
  ];
  for (let i = 0; i < pts.length; i++) {
    P.qs[i] = pts[i][0];
    P.as[i] = pts[i][1];
  }
  P.count = pts.length;
}

function turnAt(P, q) {
  const qs = P.qs;
  const as = P.as;
  if (q <= qs[0]) return as[0];
  for (let i = 1; i < P.count; i++) {
    if (q <= qs[i]) {
      const w = qs[i] - qs[i - 1];
      return w > 0 ? as[i - 1] + ((as[i] - as[i - 1]) * (q - qs[i - 1])) / w : as[i];
    }
  }
  return as[P.count - 1];
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.P = { qs: new Float32Array(10), as: new Float32Array(10), count: 0 };
  params.grid = new Uint8Array(48 * 48);
  params.key = "";
  params.meet = 0;
  params.part = 0;
  params.hw = 12.5;
  params.a = 14;
  params.th = new Float32Array(N);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // 0.7 of the size at the bottom of the knob and 0.96 at the top, where it opens: a side of 24 LEDs on a step of 13 across and 26 down. At 25 LEDs a turned corner reaches the LEDs of the right wall.
  const scale = 0.7 + 0.13 * clamp(k[1], 0, 2);
  const hw = (25 * scale) / 2;
  // The step along the row is kept to whole LEDs, so every square lights the same LEDs as the one before it moved over, and both gaps close and open on the same click.
  const a = Math.round(14 * scale);
  const key = hw.toFixed(4) + "/" + a;
  if (key !== params.key) {
    // Turned so their corners point along the row, neighbours overlap. From there the search walks each way to the last angle at which they still light LEDs side by side.
    const x0 = CX - a;
    const y0 = CY - 2 * a;
    let lo = ALONG;
    while (lo > ALONG - 45 * DEG && joined(lo - SCAN, hw, x0, y0, a, 2 * a, params.grid)) lo -= SCAN;
    let hi = ALONG;
    while (hi < ALONG + 45 * DEG && joined(hi + SCAN, hw, x0, y0, a, 2 * a, params.grid)) hi += SCAN;
    params.meet = lo;
    params.part = hi;
    params.key = key;
    // A click next to a hold turns far enough to move the far corner a LED, and never less than 4 degrees.
    plan(params.P, lo, hi, Math.max(4 * DEG, 1.05 / (hw * Math.SQRT2)));
  }
  const base = turnAt(params.P, clamp(k[2], -OPEN, 48 - OPEN) + OPEN);
  // The knob opens at 0.06, where they turn as one. Up from there each square down the row turns further than the one before it, down from there less.
  const u = clamp(k[3], -1, 1) - 0.06;
  const lag = (12 * DEG * u) / (u > 0 ? 0.94 : 1.06);
  for (let i = 0; i < N; i++) params.th[i] = base + i * lag;
  params.hw = hw;
  params.a = a;
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.11 + 0.02 * Math.sin(t * 0.41), 0.4, 0.92 + 0.08 * Math.sin(t * 0.9 + 1.3), params.col);
}

export function draw(display, params, time) {
  const { col, th, hw, a } = params;
  const cs = [];
  for (let i = 0; i < N; i++) cs.push([Math.cos(th[i]), Math.sin(th[i]), CX + (i - 1) * a, CY + 2 * (i - 1) * a]);
  const reach = hw * Math.SQRT2 + 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 0;
      for (let i = 0; i < N && !m; i++) {
        const cy = cs[i][3];
        if (y + 0.5 < cy - reach || y + 0.5 > cy + reach) continue;
        if (inside(x, y, cs[i][2], cy, cs[i][0], cs[i][1], hw)) m = 1;
      }
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
