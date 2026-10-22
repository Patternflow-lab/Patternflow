// ===== Patternflow pattern =====
// Title:   Tunnel
// Family:  space
// Idea:    Divide by the distance from the centre and a flat checkerboard becomes a tube you fly down.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 128x64
// @knobs Hue=0..1, Speed=-3..8, Twist=-1..1, Tiles=8..24
//
// Knob 1: Hue. The colour of the near rings; the far ones drift round the wheel from it.
// Knob 2: Speed. Flying forward, and below 0 backing out of the tube.
// Knob 3: Twist. Winds the tiles into a spiral, either way round.
// Knob 4: Tiles. How many tiles go round the tube.
// Buttons: K1 tap throws the far end of the tube to a new place.

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
  params.z = 0;
  params.wander = 0;
  params.kick = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 8];
  // K1 at 0 opens on violet rather than the red most of the study opens on.
  params.hue = k[0] + 0.72;
  params.speed = k[1];
  params.twist = k[2];
  params.tiles = Math.round(k[3]);
  params.z += dt * params.speed * 0.6;
  params.wander += dt * (0.35 + Math.abs(params.speed) * 0.05);
  if (input.btnPressed && input.btnPressed[0]) params.kick = 1;
  params.kick = Math.max(0, params.kick - dt * 0.8);
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  // The far end of the tube wanders, so it reads as a bend rather than a target.
  const swing = 1 + params.kick * 2.5;
  const cx = w / 2 + Math.sin(params.wander * 0.9) * w * 0.16 * swing;
  const cy = h / 2 + Math.sin(params.wander * 1.3 + 1) * h * 0.2 * swing;
  const tiles = params.tiles;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - cy) * 1.6;
      const r = Math.sqrt(dx * dx + dy * dy) + 0.001;
      const depth = 40 / r;
      const u = depth + params.z;
      const a = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;
      const v = a * tiles + params.twist * depth * 0.8;
      const ring = Math.floor(u * 3);
      const check = (ring + Math.floor(v)) & 1;
      // Fog: the far end fades to black, which also hides the centre's aliasing.
      const fog = Math.min(1, Math.max(0, (r - 4) / 34));
      const near = fog * fog;
      const c = hsv(params.hue + depth * 0.06, check ? 0.9 : 0.55, check ? near : near * 0.22);
      display.setPixel(x, y, c[0], c[1], c[2]);
    }
  }
}
