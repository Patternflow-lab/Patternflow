// ===== Patternflow pattern =====
// Title:   Incline
// Family:  geometry
// Idea:    One right triangle, a half-size copy of the half of the panel below its diagonal, slides up and down that diagonal at a steady pace with its long side on it: the knob sets how far it swings and holds where the swing just reaches the corners, and past that the triangle gets to the wall early and waits flat against it until the swing comes back, longer with every click.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 193
// Round:   195
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0..3, Swing=-34..14, Lean=0.06..1
//
// Knob 1: Hue. The colour of the triangle, all the way round the wheel from amber.
// Knob 2: Speed. How fast the triangle slides, from standing still at the bottom of the knob to 42 LEDs a second along the diagonal at the top; it opens at 28. The pace is the same all the way along, with no easing into the turn. Two slow clocks, one 1.618 times the other, bend it by a quarter either way, so no two runs and no two waits take quite the same time.
// Knob 3: Swing. How far the triangle swings either side of the middle of its run, counted in clicks and measured along the diagonal. On clicks -12, -11 and -10 the swing is exactly the room there is: at the top of the run the upright side lies on the right wall with its upper corner in the corner of the panel, and at the bottom the level side lies on the floor with its left corner in the other corner. Each click below that turns it back 1.3 LEDs sooner for eight clicks, then more slowly down to a swing of 3 LEDs at the bottom of the knob. Above the hold the swing is longer than the room: the triangle reaches the wall with 2.2 LEDs of swing left over on click -9 and 1.3 more for every click after, and it stays against the wall while the swing spends them and comes back. The knob opens on 0 with 13.9 LEDs left over, a wait of about a second at each end.
// Knob 4: Lean. How far the middle of the run sits up the diagonal from the middle of the panel, from none where the knob opens to 14 LEDs at the top. The hold of Knob 3 is always the swing that just reaches the nearer wall, so with any lean the triangle touches the right wall first and turns back short of the floor.

const W = 64;
const H = 128;

// The triangle's level side is 32 LEDs and its upright side 64. Its long side lies on the diagonal of the panel from the bottom left corner to the top right, and the right angle is below and to the right of it.
const LEG = 32;
// One LED along the diagonal is this much of an LED across; it is twice that up.
const ACROSS = 1 / Math.sqrt(5);
// Where the upright side stands in the middle of the run with no lean, how far along the diagonal the triangle can go either side of that before a side is on a wall, and how far Knob 4 moves the middle of the run.
const MID = 48;
const REACH = (W - MID) / ACROSS;
const LEAN = 14;
// Knob 3 has 48 clicks, from BOTTOM to TOP, and opens on click 0. The swing is the room to the nearer wall from HOLD_LO to HOLD_HI. For NEAR clicks below the hold it is STEP LEDs less a click, and from there it runs down evenly to SMALL at the bottom. Above the hold it is FIRST LEDs more on the first click and MORE on each one after.
const BOTTOM = -34;
const TOP = 14;
const HOLD_LO = -12;
const HOLD_HI = -10;
const NEAR = 8;
const STEP = 1.3;
const SMALL = 3;
const FIRST = 2.2;
const MORE = 1.3;
// LEDs a second along the diagonal at Speed 1, how much the two slow clocks bend that, how fast the first of them runs, and where in its swing the triangle starts.
const PACE = 14;
const BEND = 0.25;
const SLOW = 0.23;
const TURN0 = 0.7;

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

// A steady to and fro between -1 and 1, once for every whole turn, starting from the middle on its way up the diagonal.
function wave(turn) {
  const f = turn - Math.floor(turn);
  return f < 0.25 ? 4 * f : f < 0.75 ? 2 - 4 * f : 4 * f - 4;
}

export function setup(params) {
  params.t = 0;
  params.turn = TURN0;
  params.right = MID;
  params.rgb = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const lean = LEAN * clamp((k[3] - 0.06) / 0.94, 0, 1);
  const a = swing(clamp(k[2], BOTTOM, TOP), REACH - lean);
  // The pace is bent by two slow clocks that never come round together. Both ride the time the Lab hands in, and the pace is zero when Speed is.
  const bend = 1 + (BEND * (Math.sin(SLOW * t) + 0.6 * Math.sin(SLOW * 1.618 * t + 0.4))) / 1.6;
  // The turn is counted in whole swings, so the pace in LEDs a second is the same whatever the swing, and a click of Knob 3 stretches the swing about its middle instead of making the triangle jump.
  params.turn += (dt * PACE * clamp(k[1], 0, 3) * bend) / (4 * a);
  // The right wall stops the triangle at the top of its run and the floor at the bottom. Whatever swing is left over runs out and comes back while it waits there.
  params.right = clamp(MID + (lean + a * wave(params.turn)) * ACROSS, LEG, W);
  hsv(k[0] + 0.11, 0.85, 0.95, params.rgb);
}

export function draw(display, params, time) {
  const { rgb, right } = params;
  // The level side is two LEDs lower for every LED the upright side stands further left.
  const floor = H + 2 * (LEG - right);
  for (let y = 0; y < H; y++) {
    const row = clamp(floor - y, 0, 1);
    for (let x = 0; x < W; x++) {
      // The long side stays on the diagonal, two LEDs down for each one across, so its steps never move. A column lights once the upright side is half way over it.
      const m = right - x >= 0.5 && 2 * x + y >= 127 ? row : 0;
      display.setPixel(x, y, rgb[0] * m, rgb[1] * m, rgb[2] * m);
    }
  }
}
