// ===== Patternflow pattern =====
// Title:   Careen
// Family:  geometry
// Idea:    A square 46 LEDs across stands upright in the middle of the dark and is turned a quarter turn as you turn a knob, so the steps along its edges are uneven everywhere except at the leans that match the LED grid: one column to two rows, one to one at the diamond where its points reach the walls, and the knob holds at each.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 172
// Round:   174
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=1..3, Turn=-11..37, Axis=0.06..1
//
// Knob 1: Hue. The colour of the square, turned all the way round the wheel from violet.
// Knob 2: Size. How wide the square is, 42 LEDs at 1, 46 where it opens at 2 and 50 at 3.
// Knob 3: Turn. How far the square has turned from upright, one way, counted in clicks, up to a quarter turn. Where it opens it has turned about 13 degrees and the steps along its edges are uneven. Turn up and it comes to 26.6 degrees, where every edge rises one row in two columns or two rows in a column and the steps are all alike; the knob holds for three clicks. Eight clicks on it is a diamond at 45 degrees with its four points against the walls, and the steps are one to one; that holds for three clicks, and 63.4 degrees, the 26.6 degree picture turned over, holds for three more. At the top it is upright again and holds for the last three clicks. Turn down and it comes upright over 18 clicks and holds for the bottom three. Between the holds the far corners move 1 to 1.8 LEDs a click, and slightly less for the 18 clicks above upright.
// Knob 4: Axis. How far below the middle, and to the right, the point the square turns about has been moved, up to 17 LEDs each way. At the bottom it turns about its own middle; further up it swings away as it turns, down and to the left, and at the top of Turn it stands up to 34 LEDs lower than where it began.

const W = 64;
const H = 128;
const CX = 32;
const CY = 64;
// Knob 3 has 48 clicks and opens 11 above its bottom.
const OPEN = 11;
const AXIS_MAX = 17;
// The turns at which the steps along every edge come out all alike: a row in two columns, one to one, two rows in a column, and the quarter turn, which is upright again.
const A1 = Math.atan(0.5);
const A45 = Math.PI / 4;
const A2 = Math.atan(2);
const A90 = Math.PI / 2;

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

// Where the middle of the square is once it has turned by th about a point a to the right of and a below its middle.
function centreX(th, a) {
  return CX + a * (1 - Math.cos(th) - Math.sin(th));
}

function centreY(th, a) {
  return CY + a * (1 + Math.sin(th) - Math.cos(th));
}

// For every click of the Turn knob, how far the square has turned: corners (click, turn) joined by straight lines. Each stop holds for three clicks. The 18 clicks from upright to the first stop are 16 that move the far corner nearly a LED and 2 that move it less; the other clicks are shared out by how far the corner has to go.
function plan(P, evs, R) {
  const m = evs.length - 1;
  const rest = 48 - 2 * (m + 1) - 18;
  let sum = 0;
  for (let i = 1; i < m; i++) sum += evs[i + 1] - evs[i];
  const rs = [];
  let used = 0;
  for (let i = 1; i < m; i++) {
    const r = Math.max(2, Math.round((rest * (evs[i + 1] - evs[i])) / sum));
    rs.push(r);
    used += r;
  }
  let big = 0;
  for (let i = 1; i < rs.length; i++) if (rs[i] > rs[big]) big = i;
  rs[big] += rest - used;
  let c = 0;
  P.qs[c] = 0;
  P.as[c++] = 0;
  P.qs[c] = 2;
  P.as[c++] = 0;
  const slow = 0.3 / R;
  const fast = (evs[1] - 2 * slow) / 16;
  P.qs[c] = 10;
  P.as[c++] = 8 * fast;
  P.qs[c] = 12;
  P.as[c++] = 8 * fast + 2 * slow;
  let start = 20;
  for (let i = 1; i <= m; i++) {
    P.qs[c] = start;
    P.as[c++] = evs[i];
    P.qs[c] = start + 2;
    P.as[c++] = evs[i];
    if (i < m) start += 2 + rs[i - 1];
  }
  P.count = c;
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
  params.P = { qs: new Float32Array(16), as: new Float32Array(16), count: 0 };
  params.th = 0;
  params.hw = 23;
  params.a = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const hw = (46 + 4 * (clamp(k[1], 1, 3) - 2)) / 2;
  const a = (AXIS_MAX * clamp(k[3] - 0.06, 0, 0.94)) / 0.94;
  plan(params.P, [0, A1, A45, A2, A90], hw * Math.SQRT2);
  params.th = turnAt(params.P, clamp(k[2], -OPEN, 48 - OPEN) + OPEN);
  params.hw = hw;
  params.a = a;
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.78 + 0.02 * Math.sin(t * 0.41), 0.78, 0.86 * (0.88 + 0.12 * Math.sin(t * 0.63 + 0.7)), params.col);
}

export function draw(display, params, time) {
  const { col, th, hw, a } = params;
  // A quarter turn is exactly upright again.
  const c = th < 1e-9 ? 1 : Math.abs(th - A90) < 1e-9 ? 0 : Math.cos(th);
  const s = Math.abs(th - A90) < 1e-9 ? 1 : Math.sin(th);
  const cx = CX + a * (1 - c - s);
  const cy = CY + a * (1 + s - c);
  for (let y = 0; y < H; y++) {
    const ry = y + 0.5 - cy;
    for (let x = 0; x < W; x++) {
      const rx = x + 0.5 - cx;
      // The LED in the square's own frame.
      const u = rx * c - ry * s;
      const v = rx * s + ry * c;
      const m = u > -hw && u < hw && v > -hw && v < hw ? 1 : 0;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
