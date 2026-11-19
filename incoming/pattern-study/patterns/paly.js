// ===== Patternflow pattern =====
// Title:   Paly
// Family:  geometry
// Idea:    A row of upright lines low on the panel and a lit half coming in from the right wall, and every line the edge has passed swaps: lit on the dark half, a dark slot in the lit one; the knob holds wherever the edge stands in a gap between two lines and no line is cut.
// Author:  patternflow-lab
// Date:    2026-11-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 174
// Round:   176
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Count=5..7, Edge=-24..24, Tone=0.06..1
//
// Knob 1: Hue. The colour of the lines and of the lit half, one colour.
// Knob 2: Count. Five lines 8 LEDs thick with 4 LEDs between them, or past the middle of the knob seven lines 6 thick with 2 between. Either way the row is 56 or 54 LEDs wide and the lines are 64 tall, standing 8 LEDs off the floor.
// Knob 3: Edge. Where the left side of the lit half is, counted in clicks. At -24 nothing is lit and every line is lit on the dark; turned up, the lit half comes in from the right wall, and at 24 the panel is lit and every line is a slot. It opens at 0 with the edge down the middle line. With five lines the knob holds for two clicks in each gap, at -14, -5, 4 and 13 and the click after each, so the nearest gaps are four clicks from the opening; with seven at -18, -11, -4, 3, 10 and 17, three clicks from it. Every click moves the edge more than one LED, and the click into a gap and the click out of it go at least 1.75, so the click before has a line cut and the click after cuts the next one.
// Knob 4: Tone. How far the lit half is dimmer than the lines. At 0.06 they are the same brightness and a line over the lit half is a black slot; at 1 the lit half is half as bright and a line over it cannot be seen.

const W = 64;
const H = 128;
const TOP = 56;
const BOTTOM = 120;
// The lines' brightness, and the lit half's when Tone has not moved. Under half, so a dim LED is not pushed to white.
const LEVEL = 0.44;
// How far into a line the edge is on the click before a gap and the click after it.
const IN = 0.75;
// Each count: the lines' thickness and the gap, the clicks (0 to 48 from the bottom of the knob) where the edge holds in each gap, where it first cuts the rightmost line and where it leaves the leftmost one.
const PLANS = {
  5: { t: 8, gap: 4, holds: [10, 19, 28, 37], enter: 3, leave: 45 },
  7: { t: 6, gap: 2, holds: [6, 13, 20, 27, 34, 41], enter: 1, leave: 47 },
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

// The row for a count: each line's left and right column, and how far the edge has come in from the right wall at every corner of the knob, corners joined by straight lines.
function build(n) {
  const p = PLANS[n];
  const pitch = p.t + p.gap;
  const x0 = (W - n * p.t - (n - 1) * p.gap) / 2;
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    left.push(x0 + i * pitch);
    right.push(x0 + i * pitch + p.t);
  }
  // Seen from the right wall the row is the same, since it stands in the middle: line i's near side is as far in as line i's left side is from the left wall.
  const lo = left;
  const hi = right;
  const qs = [0, p.enter];
  const es = [0, lo[0] + IN];
  p.holds.forEach((h, k) => {
    const g = (hi[k] + lo[k + 1]) / 2;
    qs.push(h - 1, h, h + 1, h + 2);
    es.push(hi[k] - IN, g, g, lo[k + 1] + IN);
  });
  qs.push(p.leave, 48);
  es.push(hi[n - 1] - IN, W);
  return { n, left, right, qs, es };
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
  params.edge = W / 2;
  params.lit = LEVEL;
  params.gain = 1;
  params.cover = new Float32Array(W);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 5, 0, 0.06];
  params.t += dt;
  // A hue of 0 is red; the colour starts round the wheel, on a yellowish green.
  hsv(k[0] + 0.27, 0.85, 1, params.col);
  const plan = (params.plan = params.plans[k[1] < 6 ? 5 : 7]);
  // The edge as a column: the lit half is everything right of it.
  params.edge = W - edgeAt(plan, clamp(k[2], -24, 24) + 24);
  const away = (clamp(k[3], 0.06, 1) - 0.06) / 0.94;
  params.lit = LEVEL * (1 - 0.5 * away);
  // How much of each column the lines cover, across.
  const cover = params.cover;
  cover.fill(0);
  for (let i = 0; i < plan.n; i++) {
    for (let x = Math.floor(plan.left[i]); x < Math.ceil(plan.right[i]); x++) {
      cover[x] += Math.min(x + 1, plan.right[i]) - Math.max(x, plan.left[i]);
    }
  }
  // Nothing moves on the clock. The whole panel breathes together, so the lines and the lit half stay the same brightness when they have met.
  params.gain = 0.9 + 0.1 * Math.sin(params.t * 0.62 + 1.1);
}

export function draw(display, params, time) {
  const col = params.col;
  const g = params.gain;
  const shape = LEVEL * g;
  const lit = params.lit * g;
  const edge = params.edge;
  const cover = params.cover;
  for (let x = 0; x < W; x++) {
    let m = x + 1 - edge;
    m = m < 0 ? 0 : m > 1 ? 1 : m;
    const ground = lit * m;
    const swapped = Math.abs(ground - shape);
    const c = cover[x] > 1 ? 1 : cover[x];
    for (let y = 0; y < H; y++) {
      // Inside a line the level is how far the ground is from the line's own, so over the dark the line is lit and over a ground as bright as it is, it is gone.
      const v = y >= TOP && y < BOTTOM ? ground + (swapped - ground) * c : ground;
      display.setPixel(x, y, col[0] * v, col[1] * v, col[2] * v);
    }
  }
}
