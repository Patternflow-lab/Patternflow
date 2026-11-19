// ===== Patternflow pattern =====
// Title:   Lockstep
// Family:  geometry
// Idea:    Four squares stand in a column down the middle of the dark with the same gap between each, and one knob turns all four in place by the same angle: the gaps never widen or move, yet turning alone closes them, and the knob holds where the corners first reach their neighbours and the column becomes one piece.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 182
// Round:   184
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Turn=-26..22, Lag=-1..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from rose.
// Knob 2: Size. The squares and the step between them grow together, a side of 14.7 LEDs on a 19 LED step at the bottom of the knob, 21 on 27 where it opens and 24.2 on 31 at the top, so the gap is always about two ninths of the step.
// Knob 3: Turn. How far all four have turned, clockwise up and anticlockwise down, counted in clicks. It opens upright, 9 clicks from the hold. Turn up and every click turns them a ninth of the way to the angle where the corners first touch their neighbours, worked out from the size by lighting the squares LED by LED: about 35 degrees, where the four become one piece. The knob holds there for three clicks and then goes on more slowly to 42 degrees, short of the diamonds that would stand point to point. Turned down it goes back to 24 degrees the other way, and the gaps stay open.
// Knob 4: Lag. How much further each square down the column has turned than the one above it, up to 8 degrees more at either end, the opposite way at the bottom. Where it opens they turn as one; away from there the corners meet one pair at a time instead of all at once.

const W = 64;
const H = 128;
const CX = 32;
const CY = 64;
const N = 4;
// Knob 3 has 48 clicks and opens 28 above its bottom.
const OPEN = 26;
const DEG = Math.PI / 180;
const LOW = -24 * DEG;
const HIGH = 42 * DEG;
// How fine the search for the touching angle steps.
const SCAN = 0.02 * DEG;

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

// For every click of the Turn knob, how far the squares have turned: corners (click, turn) joined by straight lines.
function plan(P, touch) {
  const step = touch / 9;
  P.qs[0] = 0;
  P.as[0] = LOW;
  P.qs[1] = OPEN - 1;
  P.as[1] = -step;
  P.qs[2] = OPEN;
  P.as[2] = 0;
  P.qs[3] = OPEN + 9;
  P.as[3] = touch;
  P.qs[4] = OPEN + 11;
  P.as[4] = touch;
  P.qs[5] = 48;
  P.as[5] = Math.max(HIGH, touch + 2 * DEG);
  P.count = 6;
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
  params.P = { qs: new Float32Array(8), as: new Float32Array(8), count: 0 };
  params.grid = new Uint8Array(80 * 80);
  params.key = "";
  params.touch = 0;
  params.hw = 10.5;
  params.pitch = 27;
  params.th = new Float32Array(N);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const scale = 0.7 + 0.15 * clamp(k[1], 0, 3);
  const hw = (21 * scale) / 2;
  // The step is kept to whole LEDs, so every square lights the same LEDs as the one above it moved down, and all the gaps close on the same click.
  const pitch = Math.round(27 * scale);
  const key = hw.toFixed(4) + "/" + pitch;
  if (key !== params.key) {
    // The angle from which two neighbours light LEDs side by side all the way to the top of the knob. Small squares can touch a degree or two sooner and part again where the steps of their edges only meet corner to corner, so the search walks down from the top.
    let a = HIGH;
    while (a > 0 && joined(a - SCAN, hw, CX, CY - 0.5 * pitch, 0, pitch, params.grid)) a -= SCAN;
    params.touch = a;
    params.key = key;
    plan(params.P, a);
  }
  const base = turnAt(params.P, clamp(k[2], -OPEN, 48 - OPEN) + OPEN);
  // The knob opens at 0.06, where they turn as one. Up from there each square turns further than the one above, down from there less.
  const u = clamp(k[3], -1, 1) - 0.06;
  const lag = (8 * DEG * u) / (u > 0 ? 0.94 : 1.06);
  for (let i = 0; i < N; i++) params.th[i] = base + i * lag;
  params.hw = hw;
  params.pitch = pitch;
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.93 + 0.02 * Math.sin(t * 0.41), 0.4, 1.0 * (0.92 + 0.08 * Math.sin(t * 0.9 + 1.3)), params.col);
}

export function draw(display, params, time) {
  const { col, th, hw, pitch } = params;
  const y0 = CY - 1.5 * pitch;
  const cs = [];
  for (let i = 0; i < N; i++) cs.push([Math.cos(th[i]), Math.sin(th[i]), y0 + i * pitch]);
  const reach = hw * Math.SQRT2 + 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 0;
      for (let i = 0; i < N && !m; i++) {
        const cy = cs[i][2];
        if (y + 0.5 < cy - reach || y + 0.5 > cy + reach) continue;
        if (inside(x, y, CX, cy, cs[i][0], cs[i][1], hw)) m = 1;
      }
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
