// ===== Patternflow pattern =====
// Title:   Buffer
// Family:  geometry
// Idea:    A row of upright lines stands evenly spaced across a bare dark panel, short of its right wall, and the four knobs are the colour, how many lines there are, how far the row has been pushed right and how the gaps give: pushed right, the last line meets the wall first and the gaps then shut one at a time from the wall leftwards, and the knob holds for two clicks at each meeting.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 167
// Round:   169
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=1..4, Push=-12..36, Order=0.06..1
//
// Knob 1: Hue. The colour of the lines, all the way round the wheel from violet.
// Knob 2: Count. How many lines stand in the row, 4 at 1 to 7 at 4; its 2 is five. Each line is 4 LEDs wide and 72 tall, and the row spans the same 48 LEDs whatever the count, so the gaps are 10.7 LEDs between four lines, 7 between five and 3.3 between seven.
// Knob 3: Push. How far the row has been pushed right, counted in clicks. At -12 the row is even, its first line one LED off the left wall and its last 15 LEDs off the right wall; the knob opens at 0 with the row 4 LEDs further right. With five lines the last one meets the wall at 11 and each gap after it shuts six clicks later, at 17, 23, 29 and 35, the top end of the knob, where the lines are one block against the wall. At each meeting the knob holds for two clicks. The eight clicks before the wall and every click while a gap shuts move the lines more than one LED, and the click that shuts a gap moves them at least 2.1.
// Knob 4: Order. How the gaps give. At its bottom, where it opens, the row moves as one until the last line meets the wall, and then the gaps shut one at a time from the wall leftwards. Turned up, the row also squeezes as it moves, the lines further from the wall travelling faster, and the meetings crowd towards the top end of the Push knob; at the top every gap and the wall close on the same click.

const W = 64;
const H = 128;
const SIZE = 4;
const TALL = 72;
const Y0 = (H - TALL) / 2;
// Pushed none, the last line stands 15 LEDs off the right wall and the first line one LED off the left wall.
const WALL_GAP = 15;
const SPAN = W - WALL_GAP - 1;
// The Push knob has 48 clicks. MOVE is how many clicks a gap takes to shut, by count, before its two held clicks; the last meeting is the top end of the knob, so the wall is met 47 - (count - 1) * (MOVE + 1) clicks up.
const MOVE = { 4: 7, 5: 5, 6: 3, 7: 2 };
const PUSH_LO = -12;
// The eight clicks before the wall: seven of 1.1 LEDs and a last one of 2.3, so a dark column is still showing one click before the line lands. The click that shuts a gap is at least 2.1 for the same reason.
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

// The row's push for every point of the Push knob, as corners (clicks, push) joined by straight lines. The push is counted on the line that travels furthest, which with Order at its bottom is every line until the wall is met. Line i, counted from the wall, has to travel trav[i] to its rest and gets there when the push reaches arrive[i].
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
  params.cols = new Float32Array(W);
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
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = 3 + Math.round(clamp(k[1], 1, 4));
  const a = (clamp(k[3], ORDER_LO, 1) - ORDER_LO) / (1 - ORDER_LO);
  const P = params.P;
  plan(n, a, P);
  const push = pushAt(P, clamp(k[2], PUSH_LO, PUSH_LO + 48) - PUSH_LO);
  const cols = params.cols;
  cols.fill(0);
  for (let i = 0; i < n; i++) {
    const moved = P.arrive[i] > 0 ? P.trav[i] * Math.min(1, push / P.arrive[i]) : 0;
    const right = W - WALL_GAP - i * (SIZE + P.gap) + moved;
    const left = right - SIZE;
    const x0 = Math.max(0, Math.floor(left));
    const x1 = Math.min(W - 1, Math.ceil(right));
    for (let x = x0; x <= x1; x++) cols[x] += span(left, right, x);
  }
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.88 + 0.12 * Math.sin(t * 0.57 + 0.4);
  hsv(k[0] + 0.78, 0.72, params.light, params.c);
}

export function draw(display, params, time) {
  const { cols, c } = params;
  for (let y = 0; y < H; y++) {
    const inside = y >= Y0 && y < Y0 + TALL;
    for (let x = 0; x < W; x++) {
      const on = inside ? (cols[x] > 1 ? 1 : cols[x]) : 0;
      display.setPixel(x, y, c[0] * on, c[1] * on, c[2] * on);
    }
  }
}
