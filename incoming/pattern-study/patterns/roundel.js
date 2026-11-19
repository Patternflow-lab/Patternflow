// ===== Patternflow pattern =====
// Title:   Roundel
// Family:  geometry
// Idea:    A column of circles down the middle of the panel and a lit half rising from the floor, and every circle the edge has passed swaps: lit on the dark half, a dark hole in the lit one; the knob holds wherever the edge stands in a gap between two circles and no circle is cut.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 174
// Round:   176
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=5..7, Edge=-24..24, Tone=0.06..1
//
// Knob 1: Hue. The colour of the circles and of the lit half, one colour.
// Knob 2: Count. Five circles 20 LEDs across with 4 LEDs between them, or past the middle of the knob seven circles 12 across with 6 between. The column is 116 or 120 LEDs tall.
// Knob 3: Edge. Where the top of the lit half is, counted in clicks. At -24 nothing is lit and every circle is lit on the dark; turned up, the lit half rises from the floor, and at 24 the panel is lit and every circle is a hole. It opens at 0 with the edge across the middle circle. With five circles the knob holds for two clicks in each gap, at -20 and -19, -10 and -9, 9 and 10, 19 and 20, so the nearest gaps are nine clicks from the opening; with seven at -20, -13, -6, 5, 12 and 19 and the click after each, so the nearest gaps are five clicks from the opening. The click into a gap and the click out of it go at least three LEDs, so the click before has a circle cut and the click after cuts the next one.
// Knob 4: Tone. How far the lit half is dimmer than the circles. At 0.06 they are the same brightness and a circle over the lit half is a black hole; at 1 the lit half is half as bright and a circle over it cannot be seen.

const W = 64;
const H = 128;
const CX = 32;
// The circles' brightness, and the lit half's when Tone has not moved. Under half, so a dim LED is not pushed to white.
const LEVEL = 0.44;
// How far into a circle the edge is on the click before a gap and the click after it.
const IN = 1;
// Each count: the circles' diameter and the gap, and the clicks (0 to 48 from the bottom of the knob) where the edge holds in each gap, where it first cuts the lowest circle and where it leaves the top one.
const PLANS = {
  5: { d: 20, gap: 4, holds: [4, 14, 33, 43], enter: 1, leave: 47 },
  7: { d: 12, gap: 6, holds: [4, 11, 18, 29, 36, 43], enter: 1, leave: 47 },
};

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

// The column for a count: each circle's centre row, and the edge's height above the floor at every corner of the knob, corners joined by straight lines.
function build(n) {
  const p = PLANS[n];
  const pitch = p.d + p.gap;
  const cy = [];
  const lo = [];
  const hi = [];
  for (let i = 0; i < n; i++) {
    cy.push(H / 2 + (i - (n - 1) / 2) * pitch);
    // Height above the floor of the circle's lower and upper ends, lowest circle first.
    const up = H - (H / 2 + ((n - 1) / 2 - i) * pitch);
    lo.push(up - p.d / 2);
    hi.push(up + p.d / 2);
  }
  const qs = [0, p.enter];
  const es = [0, lo[0] + IN];
  p.holds.forEach((h, k) => {
    const g = (hi[k] + lo[k + 1]) / 2;
    qs.push(h - 1, h, h + 1, h + 2);
    es.push(hi[k] - IN, g, g, lo[k + 1] + IN);
  });
  qs.push(p.leave, 48);
  es.push(hi[n - 1] - IN, H);
  return { n, r: p.d / 2, cy, qs, es };
}

function edgeAt(plan, q) {
  const { qs, es } = plan;
  if (q <= 0) return es[0];
  for (let i = 1; i < qs.length; i++) {
    if (q <= qs[i]) return es[i - 1] + ((es[i] - es[i - 1]) * (q - qs[i - 1])) / (qs[i] - qs[i - 1]);
  }
  return es[es.length - 1];
}

export function setup(params) {
  params.t = 0;
  params.col = [0, 0, 0];
  params.plans = { 5: build(5), 7: build(7) };
  params.plan = params.plans[5];
  params.edge = H / 2;
  params.lit = LEVEL;
  params.gain = 1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 5, 0, 0.06];
  params.t += dt;
  // A hue of 0 is red, and a dim red is brown; the colour starts round the wheel, on azure.
  hsv(k[0] + 0.54, 0.85, 1, params.col);
  params.plan = params.plans[k[1] < 6 ? 5 : 7];
  // The edge as a row: the lit half is everything below it.
  params.edge = H - edgeAt(params.plan, clamp(k[2], -24, 24) + 24);
  const away = (clamp(k[3], 0.06, 1) - 0.06) / 0.94;
  params.lit = LEVEL * (1 - 0.5 * away);
  // Nothing moves on the clock. The whole panel breathes together, so the circles and the lit half stay the same brightness when they have met.
  params.gain = 0.9 + 0.1 * Math.sin(params.t * 0.71);
}

export function draw(display, params, time) {
  const col = params.col;
  const g = params.gain;
  const shape = LEVEL * g;
  const lit = params.lit * g;
  const { n, r, cy } = params.plan;
  const edge = params.edge;
  for (let y = 0; y < H; y++) {
    let m = y + 1 - edge;
    m = m < 0 ? 0 : m > 1 ? 1 : m;
    const ground = lit * m;
    const swapped = Math.abs(ground - shape);
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX;
      let c = 0;
      for (let i = 0; i < n; i++) {
        const dy = py - cy[i];
        if (dy > r + 1 || dy < -r - 1) continue;
        const v = r + 0.5 - Math.sqrt(dx * dx + dy * dy);
        if (v > c) c = v > 1 ? 1 : v;
      }
      // Inside a circle the level is how far the ground is from the circle's own, so over the dark the circle is lit and over a ground as bright as it is, it is gone.
      const v = ground + (swapped - ground) * c;
      display.setPixel(x, y, col[0] * v, col[1] * v, col[2] * v);
    }
  }
}
