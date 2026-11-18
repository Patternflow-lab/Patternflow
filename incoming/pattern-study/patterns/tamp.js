// ===== Patternflow pattern =====
// Title:   Tamp
// Family:  geometry
// Idea:    A row of flat bars stands evenly spaced over the floor of a bare dark panel, and the four knobs are the colour, how many bars there are, how far the row has been pushed down and how the gaps give: pushed down, the lowest bar meets the floor first and the gaps then shut one at a time from the floor up, and the knob holds for two clicks at each meeting.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 167
// Round:   169
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=1..4, Push=-12..36, Order=0.06..1
//
// Knob 1: Hue. The colour of the bars, all the way round the wheel from yellow.
// Knob 2: Count. How many bars stand in the row, 4 at 1 to 7 at 4; its 2 is five. Each bar is 40 LEDs long and 8 thick, and the row spans the same 88 LEDs whatever the count, so the gaps are 18.7 LEDs between four bars, 12 between five and 5.3 between seven.
// Knob 3: Push. How far the row has been pushed down, counted in clicks. At -12 the row is even and its lowest bar stands 20 LEDs off the floor; the knob opens at 0 with the row 8 LEDs lower. With five bars the lowest one meets the floor at 11 and each gap after it shuts six clicks later, at 17, 23, 29 and 35, the top end of the knob, where the bars are one block on the floor. At each meeting the knob holds for two clicks. The eight clicks before the floor and every click while a gap shuts move the bars more than one LED, and the click that shuts a gap moves them at least 2.1.
// Knob 4: Order. How the gaps give. At its bottom, where it opens, the row moves as one until the lowest bar meets the floor, and then the gaps shut one at a time from the floor up. Turned up, the row also squeezes as it moves, the bars further up travelling faster, and the meetings crowd towards the top end of the Push knob; at the top every gap and the floor close on the same click.

const W = 64;
const H = 128;
const LONG = 40;
const THICK = 8;
const X0 = (W - LONG) / 2;
// Pushed none, the lowest bar stands 20 LEDs off the floor and the top bar's top edge is 20 LEDs under the ceiling.
const FLOOR_GAP = 20;
const SPAN = H - FLOOR_GAP - 20;
// The Push knob has 48 clicks. MOVE is how many clicks a gap takes to shut, by count, before its two held clicks; the last meeting is the top end of the knob, so the floor is met 47 - (count - 1) * (MOVE + 1) clicks up.
const MOVE = { 4: 7, 5: 5, 6: 4, 7: 3 };
const PUSH_LO = -12;
// The eight clicks before the floor: seven of 1.1 LEDs and a last one of 2.3, so a dark row is still showing one click before the bar lands. The click that shuts a gap is at least 2.1 for the same reason.
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

// The row's push for every point of the Push knob, as corners (clicks, push) joined by straight lines. The push is counted on the bar that travels furthest, which with Order at its bottom is every bar until the floor is met. Bar i has to travel trav[i] to its rest and gets there when the push reaches arrive[i].
function plan(n, a, P) {
  const gap = (SPAN - n * THICK) / (n - 1);
  const move = MOVE[n];
  const first = 47 - (n - 1) * (move + 1);
  const last = FLOOR_GAP + (n - 1) * gap;
  for (let i = 0; i < n; i++) {
    P.trav[i] = FLOOR_GAP + i * gap;
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
  // The way down to the floor: slow at first, then the eight near clicks. Turned up, Order straightens it.
  const u1 = (first - 8) / first;
  const u2 = (first - 1) / first;
  const f1 = (1 - a) * ((FLOOR_GAP - 7 * NEAR - LAND) / FLOOR_GAP) + a * u1;
  const f2 = (1 - a) * ((FLOOR_GAP - LAND) / FLOOR_GAP) + a * u2;
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
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = 3 + Math.round(clamp(k[1], 1, 4));
  const a = (clamp(k[3], ORDER_LO, 1) - ORDER_LO) / (1 - ORDER_LO);
  const P = params.P;
  plan(n, a, P);
  const push = pushAt(P, clamp(k[2], PUSH_LO, PUSH_LO + 48) - PUSH_LO);
  const rows = params.rows;
  rows.fill(0);
  for (let i = 0; i < n; i++) {
    const moved = P.arrive[i] > 0 ? P.trav[i] * Math.min(1, push / P.arrive[i]) : 0;
    const bottom = H - FLOOR_GAP - i * (THICK + P.gap) + moved;
    const top = bottom - THICK;
    const y0 = Math.max(0, Math.floor(top));
    const y1 = Math.min(H - 1, Math.ceil(bottom));
    for (let y = y0; y <= y1; y++) rows[y] += span(top, bottom, y);
  }
  // Nothing on the panel moves on the clock. Its light swells and falls, so the panel is never quite still.
  params.light = 0.88 + 0.12 * Math.sin(t * 0.57 + 0.4);
  hsv(k[0] + 0.14, 0.8, params.light, params.c);
}

export function draw(display, params, time) {
  const { rows, c } = params;
  for (let y = 0; y < H; y++) {
    const m = rows[y] > 1 ? 1 : rows[y];
    for (let x = 0; x < W; x++) {
      const on = x >= X0 && x < X0 + LONG ? m : 0;
      display.setPixel(x, y, c[0] * on, c[1] * on, c[2] * on);
    }
  }
}
