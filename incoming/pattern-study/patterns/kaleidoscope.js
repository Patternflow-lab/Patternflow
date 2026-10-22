// ===== Patternflow pattern =====
// Title:   Kaleidoscope
// Family:  geometry
// Idea:    Three sets of moving lines cut one wedge of glass into shards, and mirrors fold that wedge round the centre until it reads as a flower.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.1..4, Segments=6..16, Twist=-1..1
//
// Knob 1: Hue. Turns the glass colours around the colour wheel.
// Knob 2: Speed. How fast the shards slide and the mirrors turn.
// Knob 3: Segments. How many mirrored wedges, in whole numbers; 6 is a snowflake, 16 a fine rosette.
// Knob 4: Twist. Bends the wedges into a spiral, one way below 0 and the other way above.
// Buttons: K1 tap reverses the turn.

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

// Hue offset, saturation and brightness of each kind of glass. A brightness
// of 0 is dark glass, which leaves the gaps that let the symmetry read.
const GLASS = [
  [0.0, 0.9, 1.0],
  [0.0, 0.95, 0.5],
  [0.07, 0.85, 0.9],
  [-0.07, 0.9, 0.75],
  [0.5, 0.75, 0.85],
  [0.03, 0.35, 1.0],
  [-0.15, 0.85, 0.85],
  [0.0, 0.0, 0.0],
  [0.0, 0.0, 0.0],
  [0.0, 0.0, 0.0],
];

// Angle and spacing in LEDs of the three line families, in the folded wedge.
const LINES = [
  [0.35, 11, 1.0],
  [1.45, 13, -0.8],
  [2.5, 9, 0.55],
];

export function setup(params) {
  const w = 64;
  const h = 128;
  params.radius = new Float32Array(w * h);
  params.angle = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - 31.5;
      const dy = y - 63.5;
      params.radius[y * w + x] = Math.hypot(dx, dy);
      params.angle[y * w + x] = Math.atan2(dy, dx);
    }
  }
  params.palette = new Float32Array(GLASS.length * 3);
  params.turn = 0;
  params.slide = 0;
  params.dir = 1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 6, 0.06];
  params.hue = k[0];
  params.speed = k[1];
  params.segments = Math.max(2, Math.round(k[2]));
  params.twist = k[3];
  if (input.btnPressed && input.btnPressed[0]) params.dir = -params.dir;
  params.turn += dt * params.speed * 0.1 * params.dir;
  params.slide += dt * params.speed * 1.4;
  for (let i = 0; i < GLASS.length; i++) {
    const c = hsv(params.hue + GLASS[i][0], GLASS[i][1], GLASS[i][2]);
    params.palette[i * 3] = c[0];
    params.palette[i * 3 + 1] = c[1];
    params.palette[i * 3 + 2] = c[2];
  }
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const wedge = (Math.PI * 2) / params.segments;
  const half = wedge / 2;
  const twist = params.twist * 0.032;
  const pal = params.palette;
  const c0 = Math.cos(LINES[0][0]), s0 = Math.sin(LINES[0][0]);
  const c1 = Math.cos(LINES[1][0]), s1 = Math.sin(LINES[1][0]);
  const c2 = Math.cos(LINES[2][0]), s2 = Math.sin(LINES[2][0]);
  const o0 = params.slide * LINES[0][2];
  const o1 = params.slide * LINES[1][2];
  const o2 = params.slide * LINES[2][2];
  const g0 = LINES[0][1], g1 = LINES[1][1], g2 = LINES[2][1];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const r = params.radius[p];
      let a = params.angle[p] + params.turn + twist * r;
      a -= Math.floor(a / wedge) * wedge;
      if (a > half) a = wedge - a;
      const u = r * Math.cos(a);
      const v = r * Math.sin(a);
      const q0 = (u * c0 + v * s0 + o0) / g0;
      const q1 = (u * c1 + v * s1 + o1) / g1;
      const q2 = (u * c2 + v * s2 + o2) / g2;
      const i0 = Math.floor(q0), i1 = Math.floor(q1), i2 = Math.floor(q2);
      // Distance in LEDs to the nearest line of lead between shards.
      const e0 = Math.min(q0 - i0, i0 + 1 - q0) * g0;
      const e1 = Math.min(q1 - i1, i1 + 1 - q1) * g1;
      const e2 = Math.min(q2 - i2, i2 + 1 - q2) * g2;
      const e = Math.min(e0, e1, e2);
      if (e < 0.45) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      let n = Math.imul(i0, 73856093) ^ Math.imul(i1, 19349663) ^ Math.imul(i2, 83492791);
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      n = (n ^ (n >>> 16)) >>> 0;
      const kind = n % GLASS.length;
      if (GLASS[kind][2] === 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      // Each shard is brightest in its middle, like light through a bevel.
      let lift = 0.5 + 0.5 * Math.min(1, (e - 0.45) / 3.5);
      if (e < 1.3) lift *= (e - 0.45) / 0.85;
      display.setPixel(x, y, pal[kind * 3] * lift, pal[kind * 3 + 1] * lift, pal[kind * 3 + 2] * lift);
    }
  }
}
