// ===== Patternflow pattern =====
// Title:   Sash
// Family:  geometry
// Idea:    One upright bar near the left wall of a bare dark panel runs up and down at a steady pace and turns back: the knob sets how far it swings and holds where the swing just reaches the ceiling and the floor, and past that the bar gets to the wall early and waits flat against it until the swing comes back, longer with every click.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 193
// Round:   195
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0..3, Swing=-34..14, Lean=0.06..1
//
// Knob 1: Hue. The colour of the bar, all the way round the wheel from rose.
// Knob 2: Speed. How fast the bar runs, from standing still at the bottom of the knob to 42 LEDs a second at the top; it opens at 28. The pace is the same all the way along, with no easing into the turn. Two slow clocks, one 1.618 times the other, bend it by a quarter either way, so no two runs and no two waits take quite the same time.
// Knob 3: Swing. How far the bar swings either side of the middle of its run, counted in clicks. On clicks -12, -11 and -10 the swing is exactly the room there is, and the end of the bar lies on the ceiling or the floor as it turns. Each click below that turns it back 1.1 LEDs sooner for eight clicks, then more slowly down to a swing of 3 LEDs at the bottom of the knob. Above the hold the swing is longer than the room: the bar reaches the wall with 2 LEDs of swing left over on click -9 and 1.2 more for every click after, and it stays against the wall while the swing spends them and comes back. The knob opens on 0 with 12.8 LEDs left over, a wait of about a second at each end.
// Knob 4: Lean. How far the middle of the run sits below the middle of the panel, from none where the knob opens to 18 LEDs at the top. The hold of Knob 3 is always the swing that just reaches the nearer wall, so with any lean the bar touches the floor first and turns back short of the ceiling.

const W = 64;
const H = 128;

// The bar is 14 LEDs wide and 46 tall and stands 6 LEDs in from the left wall.
const BW = 14;
const BH = 46;
const X0 = 6;
// The middle of the run with no lean, how far the bar's middle can go either side of it before an end is on a wall, and how far Knob 4 moves the middle of the run.
const MID = 64;
const REACH = MID - BH / 2;
const LEAN = 18;
// Knob 3 has 48 clicks, from BOTTOM to TOP, and opens on click 0. The swing is the room to the nearer wall from HOLD_LO to HOLD_HI. For NEAR clicks below the hold it is STEP LEDs less a click, and from there it runs down evenly to SMALL at the bottom. Above the hold it is FIRST LEDs more on the first click and MORE on each one after.
const BOTTOM = -34;
const TOP = 14;
const HOLD_LO = -12;
const HOLD_HI = -10;
const NEAR = 8;
const STEP = 1.1;
const SMALL = 3;
const FIRST = 2;
const MORE = 1.2;
// LEDs a second at Speed 1, how much the two slow clocks bend that, how fast the first of them runs, and where in its swing the bar starts.
const PACE = 14;
const BEND = 0.25;
const SLOW = 0.19;
const TURN0 = 0.3;

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

// How far the swing reaches either side of its middle on click c of Knob 3, when the nearer wall is d LEDs from that middle.
function swing(c, d) {
  if (c > HOLD_HI) {
    const k = c - HOLD_HI;
    return d + (k < 1 ? FIRST * k : FIRST + MORE * (k - 1));
  }
  if (c >= HOLD_LO) return d;
  const near = d - STEP * NEAR;
  if (c >= HOLD_LO - NEAR) return d - STEP * (HOLD_LO - c);
  const small = Math.min(SMALL, near / 2);
  return small + ((near - small) * (c - BOTTOM)) / (HOLD_LO - NEAR - BOTTOM);
}

// A steady to and fro between -1 and 1, once for every whole turn, starting from the middle on its way down the panel.
function wave(turn) {
  const f = turn - Math.floor(turn);
  return f < 0.25 ? 4 * f : f < 0.75 ? 2 - 4 * f : 4 * f - 4;
}

export function setup(params) {
  params.t = 0;
  params.turn = TURN0;
  params.rgb = new Float32Array(3);
  params.rows = new Float32Array(H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const lean = LEAN * clamp((k[3] - 0.06) / 0.94, 0, 1);
  const a = swing(clamp(k[2], BOTTOM, TOP), REACH - lean);
  // The pace is bent by two slow clocks that never come round together. Both ride the time the Lab hands in, and the pace is zero when Speed is.
  const bend = 1 + (BEND * (Math.sin(SLOW * t) + 0.6 * Math.sin(SLOW * 1.618 * t + 2.3))) / 1.6;
  // The turn is counted in whole swings, so the pace in LEDs a second is the same whatever the swing, and a click of Knob 3 stretches the swing about its middle instead of making the bar jump.
  params.turn += (dt * PACE * clamp(k[1], 0, 3) * bend) / (4 * a);
  // The ceiling and the floor stop the bar. Whatever swing is left over runs out and comes back while it waits there.
  const top = clamp(MID + lean + a * wave(params.turn) - BH / 2, 0, H - BH);
  for (let y = 0; y < H; y++) params.rows[y] = span(top, top + BH, y);
  hsv(k[0] + 0.93, 0.8, 0.95, params.rgb);
}

export function draw(display, params, time) {
  const { rgb, rows } = params;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = x >= X0 && x < X0 + BW ? rows[y] : 0;
      display.setPixel(x, y, rgb[0] * m, rgb[1] * m, rgb[2] * m);
    }
  }
}
