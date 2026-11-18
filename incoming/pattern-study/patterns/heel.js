// ===== Patternflow pattern =====
// Title:   Heel
// Family:  geometry
// Idea:    A 32 by 64 LED rectangle stands upright in the middle of the dark and heels over as you turn a knob, so every edge climbs the LED grid at once: the steps along the edges come out all alike where the lean matches the grid, at one column to two rows and at one to one, and the knob holds there and where two corners reach the walls.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 172
// Round:   174
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=1..3, Tilt=-11..37, Axis=0.06..1
//
// Knob 1: Hue. The colour of the rectangle, turned all the way round the wheel from amber.
// Knob 2: Size. How wide the rectangle is, 29 LEDs at 1, 32 where it opens at 2 and 35 at 3; it is always twice as tall.
// Knob 3: Tilt. How far the rectangle has heeled over from upright, one way only, counted in clicks. Where it opens it has leant about 13 degrees and the steps along its edges are uneven. Turn up and it comes to 26.6 degrees, where the short edges rise one row in two columns and the long edges two rows in a column and every step is the same; the knob holds there for three clicks. Six clicks on two corners reach the walls at the same moment, and four clicks after that it comes to 45 degrees, the steps one to one, and each of those holds for three clicks. At the top, 63.4 degrees, it is the 26.6 degree picture turned over and holds for the last three clicks. Turn down and it comes upright over 18 clicks and holds for the bottom three. The eight clicks before each hold turn it so that its far corners move about a LED a click.
// Knob 4: Axis. How far below the middle, and to the right, the point the rectangle turns about has been moved, up to 17 LEDs each way. At the bottom it turns about its own middle; further up it swings away from the middle as it tilts, down and a little to the left, and the corners reach the walls sooner.

const W = 64;
const H = 128;
const CX = 32;
const CY = 64;
// Knob 3 has 48 clicks and opens 11 above its bottom.
const OPEN = 11;
const AXIS_MAX = 17;
// The lean at which the short edges rise one row in two columns, and the steps of the long edges come out the same, then one to one, then the 26.6 degree picture turned over.
const A1 = Math.atan(0.5);
const A45 = Math.PI / 4;
const A2 = Math.atan(2);
// Two stops closer together than this many LEDs of a far corner's travel are one.
const NEAR = 2.6;

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

// Where the middle of the rectangle is once it has heeled by th about a point a to the right of and a below its middle.
function centreX(th, a) {
  return CX + a * (1 - Math.cos(th) - Math.sin(th));
}

function centreY(th, a) {
  return CY + a * (1 + Math.sin(th) - Math.cos(th));
}

// How far past a wall, in LEDs, the nearest corner has gone once the rectangle has heeled by th; negative while both corners are clear of the walls.
function over(th, hw, hh, a) {
  const e = hw * Math.cos(th) + hh * Math.sin(th);
  const x = centreX(th, a);
  return Math.max(x + e - 64, 0 - (x - e));
}

// The heel at which a corner first reaches a wall, or -1 where none does before the last stop.
function contact(hw, hh, a) {
  for (let th = 0.004; th <= A2; th += 0.004) {
    if (over(th, hw, hh, a) >= 0) {
      let lo = th - 0.004;
      let hi = th;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        if (over(mid, hw, hh, a) >= 0) hi = mid;
        else lo = mid;
      }
      return hi;
    }
  }
  return -1;
}

// Where the knob holds, in order, and how many clicks lie between: the clicks hold the heel of every stop for three; the 18 clicks from level to the first stop are 16 that turn the far corner a LED and 2 that turn it less; the other clicks are shared out by how far the corner has to go.
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

function heelAt(P, q) {
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
  params.evs = [0, 0, 0, 0, 0, 0];
  params.th = 0;
  params.hw = 16;
  params.hh = 32;
  params.a = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const hw = (32 + 3 * (clamp(k[1], 1, 3) - 2)) / 2;
  const hh = 2 * hw;
  const a = (AXIS_MAX * clamp(k[3] - 0.06, 0, 0.94)) / 0.94;
  const R = Math.sqrt(hw * hw + hh * hh);
  const near = NEAR / R;
  const evs = params.evs;
  evs.length = 0;
  evs.push(0);
  const c = contact(hw, hh, a);
  const stops = [A1, A45, A2];
  // The contact is a stop of its own unless it falls within a stop that is there already.
  let placed = c < near || c > A2 - near;
  for (const e of stops) if (Math.abs(c - e) < near) placed = true;
  for (const e of stops) {
    if (!placed && c < e) {
      evs.push(c);
      placed = true;
    }
    evs.push(e);
  }
  plan(params.P, evs, R);
  params.th = heelAt(params.P, clamp(k[2], -OPEN, 48 - OPEN) + OPEN);
  params.hw = hw;
  params.hh = hh;
  params.a = a;
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.1 + 0.02 * Math.sin(t * 0.41), 0.9, 0.86 * (0.88 + 0.12 * Math.sin(t * 0.63 + 0.7)), params.col);
}

export function draw(display, params, time) {
  const { col, th, hw, hh, a } = params;
  const c = th < 1e-9 ? 1 : Math.cos(th);
  const s = Math.sin(th);
  const cx = centreX(th, a);
  const cy = centreY(th, a);
  for (let y = 0; y < H; y++) {
    const ry = y + 0.5 - cy;
    for (let x = 0; x < W; x++) {
      const rx = x + 0.5 - cx;
      // The LED in the rectangle's own frame: along its short edges and along its long ones.
      const u = rx * c - ry * s;
      const v = rx * s + ry * c;
      const m = u > -hw && u < hw && v > -hh && v < hh ? 1 : 0;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
