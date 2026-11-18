// ===== Patternflow pattern =====
// Title:   Gnomon Bands
// Family:  geometry
// Idea:    Rectangles of one shape grow from the lower left corner, and the L shaped band each one adds to the one before it, its gnomon, takes a tone of its own, so the bands are equally thick at one end of the Growth knob and all have the same area at the other.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the gnomon, the L shaped figure that a rectangle adds to become a larger one of the same shape (Euclid, Elements II, c. 300 BC), original, pattern round 136
// Round:   136
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Bands=0..3, Shape=-1..1, Growth=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. The colour also runs a little round the wheel from the innermost band to the outermost.
// Knob 2: Bands. How many bands there are, from 4 at the left to 16 at the right; the knob's 2 is 12. Every band keeps its place in the order as the count changes, so the bands slide towards the corner as they get more numerous.
// Knob 3: Shape. The width of each rectangle against its height, from a quarter at the left through one half in the middle, the shape of the panel, to a square at the right. The two arms of an L are thick in the other direction, and they are of the same thickness only when the rectangle is a square.
// Knob 4: Growth. How the rectangle's size climbs from band to band, from the square root of the band's number at the left to the number itself at the right. At the left every band has the same area, so the arms thin out away from the corner. At the right every band is equally thick.

const W = 64;
const H = 128;
const JOINT = 1;
const KMAX = 24;

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
  params.n = 12;
  params.inv = 1 / 0.77;
  params.pow = 0.77;
  params.wf = 64;
  params.hf = 128;
  params.hue = 0;
  params.tone = new Float32Array((KMAX + 1) * 3);
  params.joint = new Float32Array(3);
  params.rgb = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath changes the count a little, bends the growth and stretches the rectangle, so the joints creep.
  const n = (4 + 4 * k[1]) * (1 + 0.015 * Math.sin(t * 0.43));
  params.n = n;
  params.pow = 0.75 + 0.25 * k[3] + 0.012 * Math.sin(t * 0.31 + 1);
  params.inv = 1 / params.pow;
  const a = 0.5 * Math.pow(2, k[2]) * (1 + 0.012 * Math.sin(t * 0.37 + 2));
  // The outermost rectangle always covers the panel.
  const hf = Math.max(H, W / a);
  params.hf = hf;
  params.wf = a * hf;
  params.hue = k[0];
  hsv(k[0] + 0.6, 0.6, 0.05, params.joint, 0);
  const tone = params.tone;
  const rgb = params.rgb;
  for (let b = 1; b <= KMAX; b++) {
    const run = (b - 1) / n;
    const dark = b % 2 === 0;
    hsv(k[0] + 0.5 + 0.36 * (run > 1 ? 1 : run), dark ? 0.8 : 0.7, dark ? 1 : 0.5, rgb, 0);
    tone[b * 3] = rgb[0];
    tone[b * 3 + 1] = rgb[1];
    tone[b * 3 + 2] = rgb[2];
  }
}

export function draw(display, params, time) {
  const n = params.n;
  const p = params.pow;
  const inv = params.inv;
  const wf = params.wf;
  const hf = params.hf;
  const tone = params.tone;
  const joint = params.joint;
  const half = (JOINT + 1) / 2;
  for (let y = 0; y < H; y++) {
    const v = (H - y - 0.5) / hf;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / wf;
      const wide = u > v;
      const m = wide ? u : v;
      // The band this point lies in is the first one whose rectangle holds it.
      let b = Math.ceil(n * Math.pow(m, inv));
      if (b < 1) b = 1;
      if (b > KMAX) b = KMAX;
      const hi = Math.pow(b / n, p);
      const lo = b > 1 ? Math.pow((b - 1) / n, p) : 0;
      const scale = wide ? wf : hf;
      let d = (hi - m) * scale;
      if (b > 1) {
        const din = (m - lo) * scale;
        if (din < d) d = din;
      }
      let a = half - d;
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      const o = b * 3;
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
