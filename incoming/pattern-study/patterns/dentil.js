// ===== Patternflow pattern =====
// Title:   Dentil
// Family:  geometry
// Idea:    Five tall lines stand side by side in a row across the lower half of the panel and one knob trades their thickness between the odd ones and the even ones, so every other line thins to nothing: at the end of the knob three lines, or two, are left, and the knob holds there for three clicks.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 173
// Round:   175
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=5..7, Balance=-37..11, Stray=0.06..1
//
// Knob 1: Hue. The colour of the lines, all the way round the wheel from magenta.
// Knob 2: Count. How many lines stand in the row, five in the lower half of the knob and seven in the upper half; it opens on five. They are 9 LEDs thick at five and 5.5 at seven, 52 LEDs tall, and the row reaches nearly from wall to wall either way.
// Knob 3: Balance. How the thickness is shared between the odd lines (the 1st, 3rd and 5th, counted from the left) and the even ones. It opens with the even lines about two thirds as thick as the odd. Turned up, the even lines thin, less than a LED wide 8 clicks on, and are gone for the last three clicks of the knob, which hold: only the odd lines are left. Turned down, they thicken until all are alike 13 clicks on. Past that the odd lines thin the same way and are gone at the bottom of the knob, held for three clicks. A line thins by less than a LED a click next to a hold, because it has so little thickness to lose.
// Knob 4: Stray. How far the even lines have moved up the panel, up to 46 LEDs. It opens with them in line.

const W = 64;
const H = 128;
// Knob 3 has 48 clicks and opens 37 above its bottom, 9 clicks short of the top.
const OPEN = 37;
const STRAY_MAX = 46;
// The lines run from here down.
const TOP = 68;
const LENGTH = 52;
// Thickness, in LEDs, at five lines and at seven: full, and the thickness 8 clicks from a hold. The spacing from one line to the next is 13 and 9.
const FULL = [9, 5.5];
const KNEE = [6, 3.6];
const PITCH = [13, 9];

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

// The thickness of a line that is u clicks from a hold: nothing at the hold, then up to its size 8 clicks out and slower on to full thickness 22 clicks out.
function grow(u, full, knee) {
  if (u <= 0) return 0;
  if (u <= 8) return (knee * u) / 8;
  if (u >= 22) return full;
  return knee + ((full - knee) * (u - 8)) / 14;
}

export function setup(params) {
  params.t = 0;
  params.col = new Float32Array(3);
  params.m = new Float32Array(W * H);
  params.n = 5;
  params.odd = 10;
  params.even = 10;
  params.stray = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 5, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const n = k[1] < 6 ? 5 : 7;
  const w = n === 5 ? 0 : 1;
  const c = clamp(k[2] + OPEN, 0, 48);
  params.n = n;
  // Counted from the left, the first line is odd. At the top of the knob the even ones are gone and at the bottom the odd ones are.
  params.odd = c <= 24 ? grow(c - 2, FULL[w], KNEE[w]) : FULL[w];
  params.even = c >= 24 ? grow(46 - c, FULL[w], KNEE[w]) : FULL[w];
  params.stray = (STRAY_MAX * clamp(k[3] - 0.06, 0, 0.94)) / 0.94;
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.83 + 0.02 * Math.sin(t * 0.41), 0.8, 0.8 + 0.16 * Math.sin(t * 0.63 + 0.7), params.col);
}

export function draw(display, params, time) {
  const { col, m, n, odd, even, stray } = params;
  m.fill(0);
  const w = n === 5 ? 0 : 1;
  for (let i = 0; i < n; i++) {
    const s = i % 2 === 0 ? odd : even;
    if (s < 0.05) continue;
    const cx = W / 2 + (i - (n - 1) / 2) * PITCH[w];
    const ya = TOP - (i % 2 === 1 ? stray : 0);
    const yb = ya + LENGTH;
    const xa = cx - s / 2;
    const xb = cx + s / 2;
    const x0 = Math.max(0, Math.floor(xa));
    const x1 = Math.min(W - 1, Math.floor(xb));
    const y0 = Math.max(0, Math.floor(ya));
    const y1 = Math.min(H - 1, Math.floor(yb));
    for (let y = y0; y <= y1; y++) {
      const ay = span(ya, yb, y);
      for (let x = x0; x <= x1; x++) m[y * W + x] = ay * span(xa, xb, x);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = m[y * W + x];
      display.setPixel(x, y, col[0] * a, col[1] * a, col[2] * a);
    }
  }
}
