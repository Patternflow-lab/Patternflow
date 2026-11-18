// ===== Patternflow pattern =====
// Title:   Crowd
// Family:  geometry
// Idea:    A column of small squares stands evenly spaced down a bare dark panel, short of its ceiling, and the four knobs are the colour, how many squares there are, how far the column has been pushed up and how the gaps give: pushed up, the top square meets the ceiling first and the gaps then shut one at a time from the ceiling down, and the knob holds for two clicks at each meeting.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 167
// Round:   169
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=4..7, Push=-12..36, Order=0.06..1
//
// Knob 1: Hue. The colour of the squares, all the way round the wheel from cyan.
// Knob 2: Count. How many squares stand in the column, 4 to 7; it opens on four. Each square is 14 LEDs a side, and the column spans the same 110 LEDs whatever the count, so the gaps are 18 LEDs between four squares, 10 between five and 2 between seven.
// Knob 3: Push. How far the column has been pushed up, counted in clicks. At -12 the column is even, its top square 15 LEDs under the ceiling and its bottom square 3 LEDs over the floor; the knob opens at 0 with the column 4 LEDs higher. With four squares the top one meets the ceiling at 11 and each gap after it shuts eight clicks later, at 19, 27 and 35, the top end of the knob, where the squares are one bar hanging from the ceiling. At each meeting the knob holds for two clicks. The eight clicks before the ceiling and every click while a gap shuts move the squares more than one LED, and the click that shuts a gap moves them at least 2.1, or the whole gap of 2 LEDs between seven.
// Knob 4: Order. How the gaps give. At its bottom, where it opens, the column moves as one until the top square meets the ceiling, and then the gaps shut one at a time from the ceiling down. Turned up, the column also squeezes as it moves, the squares further down travelling faster, and the meetings crowd towards the top end of the Push knob; at the top every gap and the ceiling close on the same click.

const W = 64;
const H = 128;
const SIZE = 14;
const X0 = (W - SIZE) / 2;
// Pushed none, the top square stands 15 LEDs under the ceiling and the bottom square 3 LEDs over the floor.
const WALL_GAP = 15;
const SPAN = H - WALL_GAP - 3;
// The Push knob has 48 clicks. MOVE is how many clicks a gap takes to shut, by count, before its two held clicks; the last meeting is the top end of the knob, so the ceiling is met 47 - (count - 1) * (MOVE + 1) clicks up.
const MOVE = { 4: 7, 5: 5, 6: 3, 7: 1 };
const PUSH_LO = -12;
// The eight clicks before the ceiling: seven of 1.1 LEDs and a last one of 2.3, so a dark row is still showing one click before the square lands. The click that shuts a gap is at least 2.1 for the same reason, or the whole gap when it is narrower.
const NEAR = 1.1;
const LAND = 2.3;
const SHUT = 2.1;
const ORDER_LO = 0.06;

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

// The column's push for every point of the Push knob, as corners (clicks, push) joined by straight lines. The push is counted on the square that travels furthest, which with Order at its bottom is every square until the ceiling is met. Square i, counted from the ceiling, has to travel trav[i] to its rest and gets there when the push reaches arrive[i].
function plan(n, a, P) {
  const gap = (SPAN - n * SIZE) / (n - 1);
  const move = MOVE[n];
  const first = 47 - (n - 1) * (move + 1);
  const last = WALL_GAP + (n - 1) * gap;
  for (let i = 0; i < n; i++) {
    P.trav[i] = WALL_GAP + i * gap;
    P.arrive[i] = (1 - a) * P.trav[i] + a * last;
  }
  // Each meeting holds for one click (two clicks show the same picture), less as the next meeting crowds onto it.
  let held = 1;
  for (let i = 0; i + 1 < n; i++) {
    P.hold[i] = clamp((P.arrive[i + 1] - P.arrive[i]) / 2, 0, 1);
    held += P.hold[i];
  }
  P.hold[n - 1] = 1;
  const shut = (1 - a) * move;
  const approach = 48 - held - (n - 1) * shut;
  const qs = P.qs;
  const ds = P.ds;
  let c = 0;
  qs[c] = 0;
  ds[c++] = 0;
  // The way to the wall: slow at first, then the eight near clicks. Turned up, Order straightens it.
  const u1 = (first - 8) / first;
  const u2 = (first - 1) / first;
  const f1 = (1 - a) * ((WALL_GAP - 7 * NEAR - LAND) / WALL_GAP) + a * u1;
  const f2 = (1 - a) * ((WALL_GAP - LAND) / WALL_GAP) + a * u2;
  const a0 = P.arrive[0];
  qs[c] = approach * u1;
  ds[c++] = a0 * f1;
  qs[c] = approach * u2;
  ds[c++] = a0 * f2;
  let q = approach;
  qs[c] = q;
  ds[c++] = a0;
  q += P.hold[0];
  qs[c] = q;
  ds[c++] = a0;
  // Each gap: its clicks shared evenly, except that the last one moves at least SHUT, or the whole gap when it is narrower.
  const end = Math.min(gap, Math.max(SHUT, gap / move));
  const fg = (gap - end) / gap;
  for (let k = 1; k < n; k++) {
    const from = P.arrive[k - 1];
    const to = P.arrive[k];
    qs[c] = q + (shut * (move - 1)) / move;
    ds[c++] = from + (to - from) * fg;
    q += shut;
    qs[c] = q;
    ds[c++] = to;
    q += P.hold[k];
    qs[c] = q;
    ds[c++] = to;
  }
  P.count = c;
  P.gap = gap;
}

function pushAt(P, q) {
  const qs = P.qs;
  const ds = P.ds;
  if (q <= qs[0]) return ds[0];
  for (let i = 1; i < P.count; i++) {
    if (q <= qs[i]) {
      const w = qs[i] - qs[i - 1];
      return w > 0 ? ds[i - 1] + ((ds[i] - ds[i - 1]) * (q - qs[i - 1])) / w : ds[i];
    }
  }
  return ds[P.count - 1];
}

export function setup(params) {
  params.t = 0;
  params.c = new Float32Array(3);
  params.light = 1;
  params.rows = new Float32Array(H);
  params.P = {
    trav: new Float32Array(7),
    arrive: new Float32Array(7),
    hold: new Float32Array(7),
    qs: new Float32Array(32),
    ds: new Float32Array(32),
    count: 0,
    gap: 0,
  };
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 4, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = Math.round(clamp(k[1], 4, 7));
  const a = (clamp(k[3], ORDER_LO, 1) - ORDER_LO) / (1 - ORDER_LO);
  const P = params.P;
  plan(n, a, P);
  const push = pushAt(P, clamp(k[2], PUSH_LO, PUSH_LO + 48) - PUSH_LO);
  const rows = params.rows;
  rows.fill(0);
  for (let i = 0; i < n; i++) {
    const moved = P.arrive[i] > 0 ? P.trav[i] * Math.min(1, push / P.arrive[i]) : 0;
    const top = WALL_GAP + i * (SIZE + P.gap) - moved;
    const bottom = top + SIZE;
    const y0 = Math.max(0, Math.floor(top));
    const y1 = Math.min(H - 1, Math.ceil(bottom));
    for (let y = y0; y <= y1; y++) rows[y] += span(top, bottom, y);
  }
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.84 + 0.16 * Math.sin(t * 0.57 + 0.4);
  hsv(k[0] + 0.5, 0.8, params.light, params.c);
}

export function draw(display, params, time) {
  const { rows, c } = params;
  for (let y = 0; y < H; y++) {
    const m = rows[y] > 1 ? 1 : rows[y];
    for (let x = 0; x < W; x++) {
      const on = x >= X0 && x < X0 + SIZE ? m : 0;
      display.setPixel(x, y, c[0] * on, c[1] * on, c[2] * on);
    }
  }
}
