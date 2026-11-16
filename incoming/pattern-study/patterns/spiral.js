// ===== Patternflow pattern =====
// Title:   Spiral
// Family:  geometry
// Idea:    One line winds out from the middle of a bare dark ground at an even pitch, and how many times it winds, how thick the line is and where its tail ends are the knobs.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Archimedes, On Spirals (c. 225 BC), the spiral whose pitch stays the same
// Round:   146
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Turns=0..4, Line=-1..1, Turn=0..1
//
// Knob 1: Hue. The colour of the line, turned round the wheel.
// Knob 2: Turns. How many times the line winds round on its way out, from 1.8 at the left to 4.2 at the right; the knob's 2 is 3. The outer edge stays put, so more turns pack the line closer.
// Knob 3: Line. How thick the line is as a share of the gap from one turn to the next, from 24 percent at the left to 52 at the right; its 0 is 38. The outer edge of the line stays on a circle of 62 LEDs, so a thicker line never runs off the panel.
// Knob 4: Turn. The whole spiral turned about the middle, once round from the left end back to the left end; its 0.06 is a twentieth of a turn.

const W = 64;
const H = 128;
const TAU = Math.PI * 2;
// The outside of the line stays on a circle of 62 LEDs, so the spiral never leaves the 64 LEDs of width.
const EDGE = 31;
const INNER = 2;

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
  params.turns = 3;
  params.pitch = 9;
  params.half = 1.5;
  params.phase = 0;
  // The two ends of the line, where the round caps sit.
  params.end = new Float32Array(4);
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const turns = 1.8 + 0.6 * k[1];
  // The slow breath thickens and thins the line a little and rocks the spiral a few degrees.
  const share = (0.38 + 0.14 * k[2]) * (1 + 0.12 * Math.sin(t * 0.53 + 1));
  // The line's own thickness counts in the room: turns of the pitch, plus half a line at the far end, fill the radius from the start to the edge.
  const pitch = (EDGE - INNER) / (turns + share / 2);
  const phase = TAU * k[3] + 0.14 * Math.sin(t * 0.31 + 2);
  params.turns = turns;
  params.pitch = pitch;
  params.half = (share * pitch) / 2;
  params.phase = phase;
  // Where the line starts, and where it ends after all its turns.
  const a1 = TAU * turns + phase;
  params.end[0] = INNER * Math.cos(phase);
  params.end[1] = INNER * Math.sin(phase);
  const reach = EDGE - params.half;
  params.end[2] = reach * Math.cos(a1);
  params.end[3] = reach * Math.sin(a1);
  // At 0 the hue knob would open on red; the line starts on rose.
  hsv(k[0] + 0.94, 0.75, 1, params.col, 0);
}

export function draw(display, params, time) {
  const turns = params.turns;
  const gap = params.pitch / TAU;
  const half = params.half;
  const phase = params.phase;
  const e = params.end;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      const r = Math.sqrt(dx * dx + dy * dy);
      // Where along the line this LED's direction from the middle falls, in turns from the start, 0 up to 1.
      let f = (Math.atan2(dy, dx) - phase) / TAU;
      f -= Math.floor(f);
      // Every turn the line makes through this direction, nearest one wins. Its radius there is the inner end plus the pitch per turn.
      let near = 1e9;
      const last = Math.floor(turns - f);
      for (let n = 0; n <= last; n++) {
        const gapHere = r - (INNER + gap * TAU * (f + n));
        const d = gapHere < 0 ? -gapHere : gapHere;
        if (d < near) near = d;
      }
      // The line leans against the circle by pitch over circumference, so the gap along a radius runs a little long.
      let sd = near / Math.sqrt(1 + (gap / (r + 0.5)) * (gap / (r + 0.5))) - half;
      // Round caps: the LED's distance to either end of the line.
      const d0 = Math.sqrt((dx - e[0]) * (dx - e[0]) + (dy - e[1]) * (dy - e[1])) - half;
      const d1 = Math.sqrt((dx - e[2]) * (dx - e[2]) + (dy - e[3]) * (dy - e[3])) - half;
      if (d0 < sd) sd = d0;
      if (d1 < sd) sd = d1;
      let m = 0.5 - sd;
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
