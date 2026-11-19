// ===== Patternflow pattern =====
// Title:   Ferry
// Family:  geometry
// Idea:    One disc crosses a bare dark panel from side to side low down, at a steady pace, and turns back: the knob sets how far it swings and holds where the swing just reaches the walls, and past that the disc gets to the wall early and waits against it until the swing comes back, longer with every click.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 193
// Round:   195
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0..3, Swing=-34..14, Lean=0.06..1
//
// Knob 1: Hue. The colour of the disc, all the way round the wheel from aqua.
// Knob 2: Speed. How fast the disc crosses, from standing still at the bottom of the knob to 30 LEDs a second at the top; it opens at 20. The pace is the same all the way across, with no easing into the turn. Two slow clocks, one 1.618 times the other, bend it by a quarter either way, so no two crossings and no two waits take quite the same time.
// Knob 3: Swing. How far the disc swings either side of the middle of its run, counted in clicks. On clicks -12, -11 and -10 the swing is exactly the room there is, and the rim touches the wall as the disc turns. Each click below that turns it back 1.1 LEDs sooner for eight clicks, then more slowly down to a swing of 3 LEDs at the bottom of the knob. Above the hold the swing is wider than the room: the disc reaches the wall with 2 LEDs of swing left over on click -9 and one more for every click after, and it stays against the wall while the swing spends them and comes back. The knob opens on 0 with 11 LEDs left over, a wait of about a second at each wall.
// Knob 4: Lean. How far the middle of the run sits to the right of the middle of the panel, from none where the knob opens to 9 LEDs at the top. The hold of Knob 3 is always the swing that just reaches the nearer wall, so with any lean the disc touches the right wall first and turns back short of the left one.

const W = 64;
const H = 128;

// The disc is 24 LEDs across and its middle rides 20 LEDs above the floor.
const R = 12;
const CY = 108;
// The middle of the run with no lean, how far the disc's middle can go either side of it before the rim is on a wall, and how far Knob 4 moves the middle of the run.
const MID = 32;
const REACH = MID - R;
const LEAN = 9;
// Knob 3 has 48 clicks, from BOTTOM to TOP, and opens on click 0. The swing is the room to the nearer wall from HOLD_LO to HOLD_HI. For NEAR clicks below the hold it is STEP LEDs less a click, and from there it runs down evenly to SMALL at the bottom. Above the hold it is FIRST LEDs more on the first click and MORE on each one after.
const BOTTOM = -34;
const TOP = 14;
const HOLD_LO = -12;
const HOLD_HI = -10;
const NEAR = 8;
const STEP = 1.1;
const SMALL = 3;
const FIRST = 2;
const MORE = 1;
// LEDs a second at Speed 1, how much the two slow clocks bend that, how fast the first of them runs, and where in its swing the disc starts.
const PACE = 10;
const BEND = 0.25;
const SLOW = 0.21;
const TURN0 = 0.6;

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

// A steady to and fro between -1 and 1, once for every whole turn, starting from the middle on its way up.
function wave(turn) {
  const f = turn - Math.floor(turn);
  return f < 0.25 ? 4 * f : f < 0.75 ? 2 - 4 * f : 4 * f - 4;
}

export function setup(params) {
  params.t = 0;
  params.turn = TURN0;
  params.x = MID;
  params.rgb = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const lean = LEAN * clamp((k[3] - 0.06) / 0.94, 0, 1);
  const a = swing(clamp(k[2], BOTTOM, TOP), REACH - lean);
  // The pace is bent by two slow clocks that never come round together. Both ride the time the Lab hands in, and the pace is zero when Speed is.
  const bend = 1 + (BEND * (Math.sin(SLOW * t) + 0.6 * Math.sin(SLOW * 1.618 * t + 1.1))) / 1.6;
  // The turn is counted in whole swings, so the pace in LEDs a second is the same whatever the swing, and a click of Knob 3 stretches the swing about its middle instead of making the disc jump.
  params.turn += (dt * PACE * clamp(k[1], 0, 3) * bend) / (4 * a);
  // The wall stops the disc. Whatever swing is left over runs out and comes back while it waits there.
  params.x = clamp(MID + lean + a * wave(params.turn), R, W - R);
  hsv(k[0] + 0.5, 0.85, 0.95, params.rgb);
}

export function draw(display, params, time) {
  const { rgb, x } = params;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - CY;
    for (let px = 0; px < W; px++) {
      const dx = px + 0.5 - x;
      const m = clamp(R + 0.5 - Math.sqrt(dx * dx + dy * dy), 0, 1);
      display.setPixel(px, y, rgb[0] * m, rgb[1] * m, rgb[2] * m);
    }
  }
}
