// ===== Patternflow pattern =====
// Title:   Topple
// Family:  geometry
// Idea:    A square stands on the floor of the dark and tips over on its bottom corner as you turn a knob, so its edges climb the LED grid in steps: the knob holds where a side lies flat on the floor, and where the diagonal stands straight up and the square balances on a point.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 175
// Round:   177
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=1..3, Tilt=-12..36, Lift=0.06..1
//
// Knob 1: Hue. The colour of the square, turned all the way round the wheel from sky blue.
// Knob 2: Size. The side of the square, 20 LEDs at 1, 26 where it opens at 2 and 32 at 3.
// Knob 3: Tilt. How far the square has tipped over its bottom right corner, counted in clicks, 48 of them for a quarter turn. Where it opens it has tipped about 21 degrees. Turn down and in 10 clicks it lies flat on the floor to the left of the corner, the bottom three clicks held there. Turn up and in 11 clicks its diagonal stands straight up at 45 degrees and the square balances on one corner, held for three clicks. Twenty-one clicks further it lies flat to the right of the corner, the top three clicks held there. The clicks next to each hold swing the far corner more than a LED a click.
// Knob 4: Lift. How far above the floor the corner it turns on is held, up to 48 LEDs. At the bottom the corner is on the floor and the square lies flat there; raised, the side is still level at the holds but nothing touches the floor.

const W = 64;
const H = 128;
// The corner the square turns on: 32 columns in, on the floor.
const PX = 32;
const LIFT_MAX = 48;
// Knob 3 has 48 clicks and opens 12 above its bottom.
const OPEN = 12;
// Clicks where each hold begins; every hold lasts three clicks, the last of the three being the next number up.
const HOLD_MID = 23;
const HOLD_TOP = 46;
const EPS = 1e-6;

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

// The tip at a click: level at the bottom three, 45 degrees across the middle three, a quarter turn across the top three, and an even swing between the holds.
function tipAt(q) {
  if (q <= 2) return 0;
  if (q < HOLD_MID) return (Math.PI / 4) * ((q - 2) / (HOLD_MID - 2));
  if (q <= HOLD_MID + 2) return Math.PI / 4;
  if (q < HOLD_TOP) return Math.PI / 4 + (Math.PI / 4) * ((q - HOLD_MID - 2) / (HOLD_TOP - HOLD_MID - 2));
  return Math.PI / 2;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.th = 0;
  params.side = 26;
  params.lift = 0;
  params.glow = 1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  params.side = 26 + 6 * (clamp(k[1], 1, 3) - 2);
  params.th = tipAt(clamp(k[2], -OPEN, 48 - OPEN) + OPEN);
  params.lift = (LIFT_MAX * clamp(k[3] - 0.06, 0, 0.94)) / 0.94;
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.55 + 0.02 * Math.sin(t * 0.43), 0.7, 0.86 * (0.8 + 0.2 * Math.sin(t * 0.9 + 0.4)), params.col);
}

export function draw(display, params, time) {
  const { col, th, side, lift } = params;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const px = PX;
  const py = H - lift;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - py;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - px;
      // The LED in the square's own frame: u along its bottom side from the corner it turns on, v up from that side.
      const u = c * dx + s * dy;
      const v = s * dx - c * dy;
      const m = u >= -side - EPS && u <= EPS && v >= -EPS && v <= side + EPS ? 1 : 0;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
