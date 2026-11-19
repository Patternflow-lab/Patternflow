// ===== Patternflow pattern =====
// Title:   Teeter
// Family:  geometry
// Idea:    A bar one wide and two tall stands on its short side on the floor of the dark and tips over to the left on its bottom corner as you turn a knob, and the knob holds where a side lies flat and at the one lean, about 26.6 degrees, where its long diagonal stands straight up and it balances on that corner.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 175
// Round:   177
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=1..3, Tilt=-28..20, Lift=0.06..1
//
// Knob 1: Hue. The colour of the bar, turned all the way round the wheel from magenta.
// Knob 2: Size. The width of the bar, 12 LEDs at 1, 16 where it opens at 2 and 21 at 3; it is always twice as tall.
// Knob 3: Tilt. How far the bar has tipped to the left over its bottom left corner, counted in clicks, 48 of them for a quarter turn. Where it opens it has tipped about 52 degrees. Turn down and in 12 clicks it balances at 26.6 degrees with its long diagonal straight up, held for three clicks, and 12 more it stands on its short side, held for the bottom three. Turn up and in 18 clicks it lies on its long side, held for the top three. Between the holds it swings about two degrees a click.
// Knob 4: Lift. How far above the floor the corner it turns on is held, up to 48 LEDs. At the bottom the corner is on the floor; raised, the sides are still level at the holds but nothing touches the floor.

const W = 64;
const H = 128;
// The corner the bar turns on: 43 columns in, on the floor. At rest the bar is to its right and lying down it is 2 widths to its left, so the widest bar, 21, spans the panel from column 1 to its right edge.
const PX = 43;
const LIFT_MAX = 48;
// Knob 3 has 48 clicks and opens 28 above its bottom.
const OPEN = 28;
// The lean at which the diagonal from the corner to the far top corner stands straight up: atan(1 / 2).
const BALANCE = Math.atan(0.5);
const HOLD_BALANCE = 14;
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

// The lean at a click: upright for the bottom three, the balance across the three at 14, lying down across the top three, and an even swing between the holds. The balance falls between clicks, so the hold at 14 is given its own angle. The eight clicks next to the balance and the eight next to the top hold swing the far corner of the narrowest bar a LED or more; the fourteen between them swing it a little less.
const NEAR = 0.0388;
const FAR = (Math.PI / 2 - Math.atan(0.5) - 16 * NEAR) / 14;

function tipAt(q) {
  if (q <= 2) return 0;
  if (q < HOLD_BALANCE) return BALANCE * ((q - 2) / (HOLD_BALANCE - 2));
  if (q <= HOLD_BALANCE + 2) return BALANCE;
  if (q >= HOLD_TOP) return Math.PI / 2;
  const d = q - HOLD_BALANCE - 2;
  if (d <= 8) return BALANCE + NEAR * d;
  if (d <= 22) return BALANCE + 8 * NEAR + FAR * (d - 8);
  return BALANCE + 8 * NEAR + 14 * FAR + NEAR * (d - 22);
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.th = 0;
  params.w = 16;
  params.lift = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const size = clamp(k[1], 1, 3);
  params.w = size < 2 ? 12 + 4 * (size - 1) : 16 + 5 * (size - 2);
  params.th = tipAt(clamp(k[2], -OPEN, 48 - OPEN) + OPEN);
  params.lift = (LIFT_MAX * clamp(k[3] - 0.06, 0, 0.94)) / 0.94;
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.83 + 0.02 * Math.sin(t * 0.39), 0.8, 0.95 * (0.8 + 0.2 * Math.sin(t * 0.9 + 1.1)), params.col);
}

export function draw(display, params, time) {
  const { col, th, w, lift } = params;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const py = H - lift;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - py;
    for (let x = 0; x < W; x++) {
      // The bar tips to the left, so the LED is looked at in a mirror of the panel where it tips to the right.
      const dx = PX - (x + 0.5);
      // The LED in the bar's own frame: u along its short side from the corner it turns on, v up from that side.
      const u = c * dx + s * dy;
      const v = s * dx - c * dy;
      const m = u >= -w - EPS && u <= EPS && v >= -EPS && v <= 2 * w + EPS ? 1 : 0;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
