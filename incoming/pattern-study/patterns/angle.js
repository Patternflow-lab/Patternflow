// ===== Patternflow pattern =====
// Title:   Angle
// Family:  geometry
// Idea:    Two straight arms of one thickness meet at a point on a bare dark ground, and how wide the angle between them opens, how far apart their ends stand and which way the point faces are the knobs.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 145
// Round:   147
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Span=0..3, Open=-1..1, Turn=0..1
//
// Knob 1: Hue. The colour of the arms, turned round the wheel.
// Knob 2: Span. How far apart the two ends stand, from 16 LEDs at the left to 58 at the right; the knob's 2 is 44. The ends stay on a circle that fits the panel, so a narrow angle stops short of the full span.
// Knob 3: Open. The angle between the arms, from 45 degrees at the left to 155 at the right; its 0 is 100. The span stays put, so a narrower angle makes longer arms.
// Knob 4: Turn. Which way the point faces, once round from straight up at the left and back to straight up at the right; its 0.06 is just right of up.

const W = 64;
const H = 128;
const RAD = Math.PI / 180;
// The arms are 12 LEDs thick, and the knobs leave that alone.
const THICK = 12;

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
  params.half = 22;
  params.alpha = 0.87;
  params.sn = 0;
  params.cs = 1;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swells the span a few percent, opens and closes the angle a few degrees and rocks the point, so the two arms are never quite still.
  const alpha = ((100 + 55 * k[2] + 5 * Math.sin(t * 0.53)) * RAD) / 2;
  let span = (16 + (42 * k[1]) / 3) * (1 + 0.07 * Math.sin(t * 0.47));
  // The pair turns about the middle of the panel, so the ends must stay on a circle that fits it: a narrow angle holds the ends further down the arms, and the span stops where they would leave the circle.
  const cot = Math.cos(alpha) / Math.sin(alpha);
  const cap = (2 * (31 - THICK / 2)) / Math.sqrt(1 + (cot * cot) / 4);
  if (span > cap) span = cap;
  params.half = span / 2;
  params.alpha = alpha;
  const turn = (360 * k[3] + 8 * Math.sin(t * 0.31 + 2)) * RAD;
  params.sn = Math.sin(turn);
  params.cs = Math.cos(turn);
  // At 0 the hue knob would open on red; the arms start on indigo.
  hsv(k[0] + 0.72, 0.8, 1, params.col, 0);
}

// Signed distance from a point to a rectangle with half sides hw and hh, negative inside.
function box(dx, dy, hw, hh) {
  const qx = (dx < 0 ? -dx : dx) - hw;
  const qy = (dy < 0 ? -dy : dy) - hh;
  const ox = qx > 0 ? qx : 0;
  const oy = qy > 0 ? qy : 0;
  const m = qx > qy ? qx : qy;
  return Math.sqrt(ox * ox + oy * oy) + (m < 0 ? m : 0);
}

export function draw(display, params, time) {
  const half = params.half;
  const sa = Math.sin(params.alpha);
  const ca = Math.cos(params.alpha);
  const sn = params.sn;
  const cs = params.cs;
  const th = THICK / 2;
  const col = params.col;
  // Each arm runs from the point to an end that stands half a span out and half a height down from the point. Facing up, the pair is centred on the panel: the point sits half a height above the middle and the ends half a height below.
  const len = half / sa;
  const height = half / (sa / ca);
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      // Turn the pixel back into the frame where the point faces up, then measure from the point.
      const px = dx * cs + dy * sn;
      const py = -dx * sn + dy * cs + height / 2;
      // The right arm in its own frame: s along it, q across it. The left arm is the same test on the mirrored point.
      const s1 = px * sa + py * ca;
      const q1 = px * ca - py * sa;
      const s2 = -px * sa + py * ca;
      const q2 = -px * ca - py * sa;
      const d1 = box(s1 - len / 2, q1, len / 2, th);
      const d2 = box(s2 - len / 2, q2, len / 2, th);
      // A round join at the point fills the notch the two flat arms leave on the outside of the bend.
      const dj = Math.sqrt(px * px + py * py) - th;
      let sd = d1 < d2 ? d1 : d2;
      if (dj < sd) sd = dj;
      let m = 0.5 - sd;
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
