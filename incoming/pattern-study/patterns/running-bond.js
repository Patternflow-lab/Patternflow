// ===== Patternflow pattern =====
// Title:   Running Bond
// Family:  geometry
// Idea:    Courses of equal rectangles stand on one another and each course slides sideways by the same fraction of a rectangle against the one under it, so at one half the joints stagger like a masonry wall, at one third they climb in a stair, and at none they stack in a grid.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the running bond and the stack bond of masonry with the slide of a course as the one number, original, pattern round 134
// Round:   134
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Slide=0..3, Length=-1..1, Course=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. The colour also drifts a little round the wheel from the top of the panel to the bottom.
// Knob 2: Slide. How far each course slides against the one below, from none (a stack, joints in straight columns) through one third of a rectangle (joints climb in a stair, the knob's 2) to one half at the right (every joint over the middle of the rectangle below).
// Knob 3: Length. How long a rectangle is along the course, from 12 LEDs to 40; the middle is 22.
// Knob 4: Course. How tall a course is, from 4.7 LEDs to 13.6; the middle is 8.

const W = 64;
const H = 128;
const JOINT = 1;
const ROWS = 40;

function hsv(h, s, v, out, at) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[at] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[at + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[at + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

export function setup(params) {
  params.t = 0;
  params.len = 22;
  params.course = 8;
  params.slide = 1 / 3;
  params.hue = 0;
  // A rectangle's colour for each course and for which of two tones it takes.
  params.tone = new Float32Array(ROWS * 2 * 3);
  params.joint = new Float32Array(3);
  params.rgb = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The knob's 0 to 3 is a slide of 0 to half a rectangle. The slow breath lengthens and shortens the rectangles and the courses.
  params.slide = k[1] / 6 + 0.006 * Math.sin(t * 0.5 + 2);
  params.len = 22 * Math.pow(1.8, k[2]) * (1 + 0.03 * Math.sin(t * 0.43));
  params.course = 8 * Math.pow(1.7, k[3]) * (1 + 0.03 * Math.sin(t * 0.37 + 1));
  hsv(k[0] + 0.6, 0.6, 0.06, params.joint, 0);
  params.hue = k[0];
}

export function draw(display, params, time) {
  const len = params.len;
  const course = params.course;
  const slide = params.slide;
  const hue = params.hue;
  const joint = params.joint;
  const tone = params.tone;
  const half = (JOINT + 1) / 2;
  const rgb = params.rgb;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    const r = Math.floor(dy / course + 0.5);
    const edge = course / 2 - Math.abs(dy - r * course);
    let ay = half - edge;
    ay = ay < 0 ? 0 : ay > 1 ? 1 : ay;
    const row = Math.max(0, Math.min(ROWS - 1, r + ROWS / 2));
    // The two tones of this course, a light rectangle and a dim one. The hue runs a little round the wheel with the course's height on the panel.
    const base = hue + 0.52 + 0.0012 * r * course;
    hsv(base, 0.75, 1, rgb, 0);
    tone[row * 6] = rgb[0];
    tone[row * 6 + 1] = rgb[1];
    tone[row * 6 + 2] = rgb[2];
    hsv(base + 0.07, 0.85, 0.5, rgb, 0);
    tone[row * 6 + 3] = rgb[0];
    tone[row * 6 + 4] = rgb[1];
    tone[row * 6 + 5] = rgb[2];
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - W / 2) / len - r * slide;
      const n = Math.floor(u);
      const frac = u - n;
      const edgeX = (frac < 0.5 ? frac : 1 - frac) * len;
      let ax = half - edgeX;
      ax = ax < 0 ? 0 : ax > 1 ? 1 : ax;
      const a = 1 - (1 - ax) * (1 - ay);
      const par = ((n % 2) + 2) % 2;
      const o = row * 6 + par * 3;
      display.setPixel(
        x,
        y,
        tone[o] + (joint[0] - tone[o]) * a,
        tone[o + 1] + (joint[1] - tone[o + 1]) * a,
        tone[o + 2] + (joint[2] - tone[o + 2]) * a
      );
    }
  }
}
