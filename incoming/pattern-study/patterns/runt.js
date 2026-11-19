// ===== Patternflow pattern =====
// Title:   Runt
// Family:  geometry
// Idea:    Seven circles stand in columns on the floor against the right wall and one knob lowers the ceiling they fill, and where the ceiling is exactly four circles high the first column is a chain of touching circles and the next click sends its top circle to the column beside it.
// Author:  patternflow-lab
// Date:    2026-11-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 185
// Round:   187
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Ceiling=-25..23, Lean=0.06..1
//
// Knob 1: Hue. The colour of the circles, all the way round the wheel from a violet.
// Knob 2: Size. The diameter of each circle, 12 LEDs at the bottom of the knob to 18 at the top; it opens at 16. The ceiling at the hold is always four diameters high.
// Knob 3: Ceiling. How high the columns may stand above the floor, in clicks, 48 of them; turning up lowers it. It opens with four LEDs between the circles of the first column. Eight clicks on, the gaps have shut and the four circles touch from the floor up; the knob holds there for three clicks. The click after, the ceiling is one LED too low for four, the top circle goes to the next column, and the three left in the first spread up to the ceiling.
// Knob 4: Lean. How far each column to the left stands above the one to its right, 0 to 10 LEDs a column. It opens at 0.06, which is no lean.

const W = 64;
const H = 128;
// The knob has 48 clicks. The ceiling is four circles high for three of them.
const CLICKS = 48;
const HOLD = 34;
const OPEN = 25;
// LEDs a click lowers the ceiling in the eight clicks beside the hold.
const STEP = 1;
const NEAR = 8;
const COUNT = 7;
const PER = 4;
// The empty columns between one column and the next.
const GAP_C = 3;
const SAT = 0.75;
const PEAK = 0.95;
// The first colour: a violet.
const BASE = 0.78;
const LEAN = 10;
const SUB = 4;

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

// LEDs the ceiling has gone from the hold after m clicks: a click each for eight, then the walk slows and ends at far.
function reach(m, far, rest) {
  return m <= NEAR ? STEP * m : STEP * NEAR + ((far - STEP * NEAR) * (m - NEAR)) / rest;
}

// The ceiling's height above the floor at click q, higher than four circles before the hold, four circles for its three clicks and lower after.
function ceiling(q, hold, high, low) {
  if (q < HOLD) return hold + reach(HOLD - q, high, HOLD - NEAR);
  if (q <= HOLD + 2) return hold;
  return hold - reach(q - HOLD - 2, low, CLICKS - HOLD - 2 - NEAR);
}

export function setup(params) {
  params.t = 0;
  params.key = "";
  params.col = new Float32Array(3);
  params.lum = new Float32Array(W * H);
}

// Adds the share of each LED a circle covers, by sixteen samples.
function disc(lum, cx, cy, r) {
  for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(H, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(W, Math.ceil(cx + r)); x++) {
      let hit = 0;
      for (let j = 0; j < SUB; j++) {
        for (let i = 0; i < SUB; i++) {
          const dx = x + (i + 0.5) / SUB - cx;
          const dy = y + (j + 0.5) / SUB - cy;
          if (dx * dx + dy * dy <= r * r) hit++;
        }
      }
      lum[y * W + x] += hit / (SUB * SUB);
    }
  }
}

// Four circles to a column while they fit under the ceiling, three once they do not. The circles are spread from the floor to the ceiling, and a short last column keeps the gaps of the columns before it.
function lay(params, d, h, lean) {
  const n = h >= PER * d ? PER : PER - 1;
  const gap = (h - n * d) / (n - 1);
  const cols = Math.ceil(COUNT / n);
  params.lum.fill(0);
  let i = 0;
  for (let c = 0; c < cols; c++) {
    const rows = Math.min(n, COUNT - i);
    const cx = W - d / 2 - c * (d + GAP_C);
    for (let r = 0; r < rows; r++, i++) disc(params.lum, cx, H - d / 2 - r * (d + gap) - lean * c, d / 2);
  }
  for (let j = 0; j < params.lum.length; j++) if (params.lum[j] > 1) params.lum[j] = 1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const d = 12 + 2 * clamp(k[1], 0, 3);
  const q = clamp(k[2], -OPEN, CLICKS - OPEN) + OPEN;
  const lean = ((clamp(k[3], 0.06, 1) - 0.06) / 0.94) * LEAN;
  const key = d + "," + q + "," + lean;
  if (key !== params.key) {
    params.key = key;
    const hold = PER * d;
    // The ceiling goes up 22 LEDs at most, and down until three circles are left a gap of at least 3 LEDs.
    const high = Math.min(22, H - 24 - hold);
    const low = Math.min(12, d - 3);
    lay(params, d, ceiling(q, hold, high, low), lean);
  }
  // One colour and one breath for every circle.
  hsv(k[0] + BASE + 0.02 * Math.sin(t * 0.43), SAT, PEAK * (0.84 + 0.16 * Math.sin(t * 1.2 + 2.1)), params.col);
}

export function draw(display, params, time) {
  const { col, lum } = params;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = lum[y * W + x];
      display.setPixel(x, y, col[0] * c, col[1] * c, col[2] * c);
    }
  }
}
