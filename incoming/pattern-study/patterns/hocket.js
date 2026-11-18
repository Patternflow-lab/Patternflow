// ===== Patternflow pattern =====
// Title:   Hocket
// Family:  geometry
// Idea:    Five circles stand in a row along the panel's diagonal and one knob trades their size between the odd ones and the even ones, so every other circle shrinks to nothing: at the end of the knob three circles, or two, are left, and the knob holds there for three clicks.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 173
// Round:   175
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=5..7, Balance=-11..37, Stray=0.06..1
//
// Knob 1: Hue. The colour of the circles, all the way round the wheel from cyan.
// Knob 2: Count. How many circles stand in the row, five in the lower half of the knob and seven in the upper half; it opens on five. They are 22 LEDs across at five and 13 at seven, so the row still runs from the top left to the bottom right.
// Knob 3: Balance. How the size is shared between the odd circles (the 1st, 3rd and 5th, counted from the top left) and the even ones. It opens with the odd circles about half as wide as the even. Turned down, they shrink and in 9 clicks they are small dots; they are gone for the last three clicks of the knob, which hold, and the even circles stand alone. Turned up, the odd circles grow until all are alike 13 clicks on, and then the even circles shrink the same way and are gone at the top of the knob, held for three clicks. The eight clicks next to each hold change the small circles by more than a LED a click.
// Knob 4: Stray. How far the even circles have moved off the diagonal, sideways, up to 11 LEDs. It opens with them on the line.

const W = 64;
const H = 128;
// Knob 3 has 48 clicks and opens 11 above its bottom.
const OPEN = 11;
const STRAY_MAX = 11;
// Across, in LEDs, at five circles and at seven: full size, and the size 8 clicks from a hold.
const FULL = [22, 13];
const KNEE = [11, 8.5];

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

// The size of a circle that is u clicks from a hold: nothing at the hold, more than a LED a click for the next eight, then slower up to full size 22 clicks out.
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
  params.odd = 22;
  params.even = 22;
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
  // Counted from the top left, the first circle is odd. At the bottom of the knob the odd ones are gone and at the top the even ones are.
  params.odd = c <= 24 ? grow(c - 2, FULL[w], KNEE[w]) : FULL[w];
  params.even = c >= 24 ? grow(46 - c, FULL[w], KNEE[w]) : FULL[w];
  params.stray = (STRAY_MAX * clamp(k[3] - 0.06, 0, 0.94)) / 0.94;
  // Nothing on the panel moves on the clock. The light swells and falls and the colour wanders a few degrees, so the panel is never quite still.
  hsv(k[0] + 0.5 + 0.02 * Math.sin(t * 0.41), 0.82, 0.82 + 0.18 * Math.sin(t * 0.63 + 0.7), params.col);
}

export function draw(display, params, time) {
  const { col, m, n, odd, even, stray } = params;
  m.fill(0);
  const step = 42 / (n - 1);
  for (let i = 0; i < n; i++) {
    const d = i % 2 === 0 ? odd : even;
    if (d < 0.05) continue;
    const r = d / 2;
    // The row runs corner to corner, two rows down for every column across. The even circles move off it at right angles, up and to the right.
    let cx = 11 + step * i;
    let cy = 22 + 2 * step * i;
    if (i % 2 === 1) {
      cx += stray * 0.894;
      cy -= stray * 0.447;
    }
    const x0 = Math.max(0, Math.floor(cx - r - 1));
    const x1 = Math.min(W - 1, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1));
    const y1 = Math.min(H - 1, Math.ceil(cy + r + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const v = r + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (v > 0) m[y * W + x] = v > 1 ? 1 : v;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = m[y * W + x];
      display.setPixel(x, y, col[0] * a, col[1] * a, col[2] * a);
    }
  }
}
