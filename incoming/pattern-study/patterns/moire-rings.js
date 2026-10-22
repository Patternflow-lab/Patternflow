// ===== Patternflow pattern =====
// Title:   Moire Rings
// Family:  wave
// Idea:    Two sets of rings slide past each other, and where they disagree the panel draws a third shape nobody drew.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 128x64
// @knobs Hue=0..1, Speed=0.1..6, Rings=5..16, Spread=-1..1
//
// Knob 1: Hue. Turns the two-colour pair around the colour wheel.
// Knob 2: Speed. How fast the two centres orbit.
// Knob 3: Rings. Ring spacing in LEDs; small is a fine moire, large is a few fat bands.
// Knob 4: Spread. How far apart the two centres travel, and below 0 the second one turns the other way.
// Buttons: K1 tap swaps which set of rings is drawn bright.

function hsv(h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  const r = k === 0 ? v : k === 1 ? q : k === 2 ? p : k === 3 ? p : k === 4 ? t : v;
  const g = k === 0 ? t : k === 1 ? v : k === 2 ? v : k === 3 ? q : k === 4 ? p : p;
  const b = k === 0 ? p : k === 1 ? p : k === 2 ? t : k === 3 ? v : k === 4 ? v : q;
  return [r * 255, g * 255, b * 255];
}

export function setup(params) {
  params.phase = 0;
  params.swap = false;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 3, 0.06];
  params.hue = k[0];
  params.speed = k[1];
  params.spacing = k[2];
  params.spread = k[3];
  params.phase += dt * params.speed * 0.35;
  if (input.btnPressed && input.btnPressed[0]) params.swap = !params.swap;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const reach = 0.15 + Math.abs(params.spread) * 0.85;
  // Below 0 the second centre runs the other way round.
  const dir = params.spread < 0 ? -1 : 1;
  const ax = w / 2 + Math.cos(params.phase) * w * 0.3 * reach;
  const ay = h / 2 + Math.sin(params.phase * 1.3) * h * 0.35 * reach;
  const bx = w / 2 - Math.cos(params.phase * 0.8) * w * 0.3 * reach;
  const by = h / 2 - Math.sin(params.phase * 1.1) * h * 0.35 * reach * dir;
  const s = params.spacing;
  const a = hsv(params.hue, 0.85, 1);
  const b = hsv(params.hue + 0.5, 0.7, 1);
  const front = params.swap ? b : a;
  const back = params.swap ? a : b;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const da = Math.hypot(x - ax, y - ay) / s;
      const db = Math.hypot(x - bx, y - by) / s;
      const ra = da - Math.floor(da) < 0.5 ? 1 : 0;
      const rb = db - Math.floor(db) < 0.5 ? 1 : 0;
      if (ra && rb) display.setPixel(x, y, front[0], front[1], front[2]);
      else if (ra !== rb) display.setPixel(x, y, back[0] * 0.18, back[1] * 0.18, back[2] * 0.18);
      else display.setPixel(x, y, 0, 0, 0);
    }
  }
}
