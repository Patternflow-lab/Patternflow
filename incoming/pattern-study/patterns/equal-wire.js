// ===== Patternflow pattern =====
// Title:   Equal Wire
// Family:  geometry
// Idea:    Rectangles bent from the same length of wire, tall bands at one end and wide ones at the other with a square between, stand frame inside frame on one centre, and their corners all land on one diamond because a rectangle with a fixed perimeter has width plus height fixed.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the isoperimetric problem for rectangles, of all rectangles with one perimeter the square has the most area (Pappus of Alexandria, c. 340), original, pattern round 135
// Round:   135
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wire=0..3, Frames=-1..1, Spread=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. Tall bands and wide ones differ by a quarter of a turn, so the square in the middle sits halfway between them.
// Knob 2: Wire. How long the wire is, as width plus height of every frame, from 48 LEDs to 96; the knob's 2 is 80, so the square is 40 across. The corners ride out along the diamond as it grows.
// Knob 3: Frames. How many frames are bent from the wire, from 5 to 15, always an odd number so one of them is the square.
// Knob 4: Spread. How far the frames stray from the square. At the left they are nearly square, and at the right the thinnest frame is a band about two LEDs wide, the tallest a pole and the widest a bar, each running off the panel.

const W = 64;
const H = 128;
const MAX = 15;
const LINE = 1.15;

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
  params.n = 9;
  params.hw = new Float32Array(MAX);
  params.hh = new Float32Array(MAX);
  params.line = new Float32Array(MAX * 3);
  params.fill = new Float32Array(MAX * 3);
  params.rgb = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath lengthens and shortens the wire and moves the frames a little nearer the square and away again.
  const wire = (48 + 16 * k[1]) * (1 + 0.025 * Math.sin(t * 0.43));
  const spread = Math.min(0.96, 0.7 * Math.pow(1.5, k[3]) * (1 + 0.03 * Math.sin(t * 0.31 + 1)));
  const n = 2 * Math.round((9 * Math.pow(1.6, k[2]) - 1) / 2) + 1;
  params.n = n;
  const rgb = params.rgb;
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? (2 * i) / (n - 1) - 1 : 0;
    const w = wire * (0.5 + 0.5 * spread * u);
    params.hw[i] = w / 2;
    params.hh[i] = (wire - w) / 2;
    // Tall bands are one colour and wide ones a quarter of a turn on.
    const hue = k[0] + 0.46 + 0.25 * (u + 1) * 0.5;
    hsv(hue, 0.8, 0.6, rgb, 0);
    params.line[i * 3] = rgb[0];
    params.line[i * 3 + 1] = rgb[1];
    params.line[i * 3 + 2] = rgb[2];
    hsv(hue, 0.85, 0.075, rgb, 0);
    params.fill[i * 3] = rgb[0];
    params.fill[i * 3 + 1] = rgb[1];
    params.fill[i * 3 + 2] = rgb[2];
  }
}

export function draw(display, params, time) {
  const n = params.n;
  const hw = params.hw;
  const hh = params.hh;
  const line = params.line;
  const fill = params.fill;
  for (let y = 0; y < H; y++) {
    const py = Math.abs(y + 0.5 - H / 2);
    for (let x = 0; x < W; x++) {
      const px = Math.abs(x + 0.5 - W / 2);
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < n; i++) {
        const dx = px - hw[i];
        const dy = py - hh[i];
        const ox = dx > 0 ? dx : 0;
        const oy = dy > 0 ? dy : 0;
        const inner = dx > dy ? dx : dy;
        // Signed distance to the frame's edge, negative inside.
        const sd = Math.sqrt(ox * ox + oy * oy) + (inner < 0 ? inner : 0);
        const a = Math.abs(sd);
        let l = LINE / 2 + 0.5 - a;
        l = l < 0 ? 0 : l > 1 ? 1 : l;
        let f = 0.5 - sd;
        f = f < 0 ? 0 : f > 1 ? 1 : f;
        r += line[i * 3] * l + fill[i * 3] * f;
        g += line[i * 3 + 1] * l + fill[i * 3 + 1] * f;
        b += line[i * 3 + 2] * l + fill[i * 3 + 2] * f;
      }
      display.setPixel(x, y, r > 255 ? 255 : r, g > 255 ? 255 : g, b > 255 ? 255 : b);
    }
  }
}
