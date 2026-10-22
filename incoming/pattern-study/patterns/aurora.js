// ===== Patternflow pattern =====
// Title:   Aurora
// Family:  light
// Idea:    Curtains of light hang from a line that wanders, and their rays shimmer slower than they sway.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 128x64
// @knobs Sway=0..1, Speed=0.1..5, Curtains=1..4, Rays=0..1
// @ramp oklab 0:#000000 0.18:#04122e 0.45:#0b6b5a 0.72:#3dff9a 0.9:#b8ffd9 1:#f0c8ff
//
// Knob 1: Sway. How far the curtains swing from side to side.
// Knob 2: Speed. How fast everything drifts.
// Knob 3: Curtains. One curtain or a sky of up to four, each its own height.
// Knob 4: Rays. From a smooth glow to sharp vertical rays.

function hash(n) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function noise(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

export function setup(params) {
  params.t = 0;
  params.field = new Float32Array(128 * 64);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 1, 0.06];
  params.sway = k[0];
  params.speed = k[1];
  params.curtains = k[2];
  params.rays = k[3];
  params.t += dt * params.speed * 0.25;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.t;
  const field = params.field;
  field.fill(0);
  const count = Math.max(1, Math.min(4, Math.round(params.curtains)));
  const swing = 6 + params.sway * 22;
  // A few stars behind it all, each on its own slow twinkle.
  for (let s = 0; s < 46; s++) {
    const sx = Math.floor(hash(s * 3.7) * w);
    const sy = Math.floor(hash(s * 9.1) * h * 0.8);
    field[sy * w + sx] = 0.2 + 0.14 * Math.sin(t * 6 + s * 2.3);
  }
  const sharp = 1 + params.rays * 3;
  for (let c = 0; c < count; c++) {
    const seed = c * 17.3;
    // One curtain hangs low; more of them stack up the sky, the far ones dimmer.
    const base = count === 1 ? h * 0.66 : h * (0.78 - 0.5 * (c / (count - 1)));
    const strength = (1 - c * 0.14) / Math.sqrt(count * 0.8);
    const height = 38 - c * 4;
    for (let x = 0; x < w; x++) {
      const fold = noise(x * 0.035 + t * 0.9 + seed) * 2 - 1;
      const line = base + fold * swing * 0.5 + Math.sin(x * 0.05 + t * 1.7 + seed) * swing * 0.25;
      const ray = noise(x * 0.32 + t * 0.35 + seed * 3);
      const streak = Math.pow(ray, sharp) * (0.7 + params.rays * 0.6) + (1 - params.rays) * 0.3;
      const glow = (0.6 + 0.4 * noise(x * 0.02 - t * 0.6 + seed)) * strength;
      const top = line - height - ray * 14;
      for (let y = 0; y < h; y++) {
        let v = 0;
        if (y <= line) {
          // Bright at the hem, fading upward into the rays.
          const up = (line - y) / (line - top);
          v = up < 1 ? Math.pow(1 - up, 1.3) * streak * 1.25 : 0;
        } else {
          v = Math.exp(-(y - line) * 0.5) * 0.9;
        }
        const i = y * w + x;
        field[i] = Math.min(1, field[i] + v * glow);
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) display.setValue(x, y, field[y * w + x]);
  }
}
