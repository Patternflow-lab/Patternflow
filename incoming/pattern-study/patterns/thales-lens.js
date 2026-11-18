// ===== Patternflow pattern =====
// Title:   Thales Lens
// Family:  geometry
// Idea:    Every point on an arc through two ends sees the segment between them at the same angle, so the panel is cut into lens shaped bands of equal viewing angle, and one bright arc marks the angle you pick, which at a right angle is the circle on the segment as its diameter.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Thales's theorem, that an angle in a semicircle is a right angle (Thales of Miletus, c. 600 BC), and the inscribed angle theorem it is a case of (Euclid, Elements III.21, c. 300 BC), original, pattern round 137
// Round:   137
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Span=0..3, Tilt=-1..1, Angle=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. The colour also runs a little round it as the viewing angle grows from the far field up to the segment itself.
// Knob 2: Span. The length of the segment between the two white ends, from 12 LEDs to 60; the knob's 2 is 44. The bands are drawn for every 15 degrees of the angle the two ends are seen at, and they pinch together at the ends.
// Knob 3: Tilt. How far the segment is turned from standing up the panel, 80 degrees either way. The whole picture turns with it about the middle of the panel.
// Knob 4: Angle. The viewing angle of the bright arc, from 18 degrees at the left to 154 degrees at the right. The knob's start is 90 degrees, where the two arcs join into the circle that has the segment as its diameter; below it they swell past a circle and above it they shrink to a lens.

const W = 64;
const H = 128;
const BANDS = 12;

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
  params.ax = 32;
  params.ay = 42;
  params.bx = 32;
  params.by = 86;
  params.len = 44;
  params.alpha = Math.PI / 2;
  params.col = new Float32Array((BANDS + 2) * 3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath lengthens the segment, turns it and sweeps the viewing angle a little.
  const len = (12 + 16 * k[1]) * (1 + 0.04 * Math.sin(t * 0.43));
  const tilt = (80 * k[2] * Math.PI) / 180 + 0.05 * Math.sin(t * 0.31 + 1);
  const alpha = ((90 + 68 * (k[3] - 0.06)) * Math.PI) / 180 + 0.07 * Math.sin(t * 0.37 + 2);
  const sx = Math.sin(tilt) * len * 0.5;
  const sy = Math.cos(tilt) * len * 0.5;
  params.ax = W / 2 - sx;
  params.ay = H / 2 - sy;
  params.bx = W / 2 + sx;
  params.by = H / 2 + sy;
  params.len = len;
  params.alpha = alpha;
  // One colour a band, dark and light in turn, running round the wheel with the angle.
  for (let i = 0; i < BANDS + 2; i++) {
    const f = (i + 0.5) / BANDS;
    hsv(k[0] + 0.55 + 0.4 * f, 0.8 - 0.15 * f, i % 2 === 0 ? 0.32 + 0.1 * f : 0.62 + 0.15 * f, params.col, i * 3);
  }
}

export function draw(display, params, time) {
  const ax = params.ax;
  const ay = params.ay;
  const bx = params.bx;
  const by = params.by;
  const len = params.len;
  const alpha = params.alpha;
  const col = params.col;
  const step = Math.PI / BANDS;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      // The angle at this point between the directions to the two ends, and how quickly it changes, in radians a LED.
      const ux = ax - px;
      const uy = ay - py;
      const vx = bx - px;
      const vy = by - py;
      const lu = Math.sqrt(ux * ux + uy * uy);
      const lv = Math.sqrt(vx * vx + vy * vy);
      const theta = Math.atan2(Math.abs(ux * vy - uy * vx), ux * vx + uy * vy);
      const slope = len / Math.max(0.5, lu * lv);
      const f = theta / step;
      let band = Math.floor(f);
      const frac = f - band;
      // The band's own colour, mixed with the next band's across a seam a LED wide.
      const edge = Math.min(frac, 1 - frac) / slope * step;
      const other = frac < 0.5 ? band - 1 : band + 1;
      let mix = 0.5 + edge;
      if (mix > 1) mix = 1;
      const bi = band < 0 ? 0 : band > BANDS ? BANDS : band;
      const oi = other < 0 ? 0 : other > BANDS ? BANDS : other;
      let r = col[oi * 3] + (col[bi * 3] - col[oi * 3]) * mix;
      let g = col[oi * 3 + 1] + (col[bi * 3 + 1] - col[oi * 3 + 1]) * mix;
      let b = col[oi * 3 + 2] + (col[bi * 3 + 2] - col[oi * 3 + 2]) * mix;
      // The arc where the viewing angle is the one the Angle knob picks, drawn the same width everywhere.
      const da = Math.abs(theta - alpha) / slope;
      let ca = 1.7 - da;
      if (ca > 0) {
        if (ca > 1) ca = 1;
        r += (255 - r) * ca;
        g += (245 - g) * ca;
        b += (230 - b) * ca;
      }
      // The two ends.
      const ea = 2.6 - Math.min(lu, lv);
      if (ea > 0) {
        const c = ea > 1 ? 1 : ea;
        r += (255 - r) * c;
        g += (255 - g) * c;
        b += (255 - b) * c;
      }
      display.setPixel(x, y, r, g, b);
    }
  }
}
