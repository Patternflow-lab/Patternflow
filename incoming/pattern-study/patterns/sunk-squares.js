// ===== Patternflow pattern =====
// Title:   Sunk Squares
// Family:  geometry
// Idea:    Nested frames, each a step smaller and squarer than the one outside it, sink toward the floor of the panel so the margin under every frame is narrower than the margin over it, and the colour steps round the wheel one frame at a time.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Josef Albers, Homage to the Square (begun 1950, year from memory), where every square sits low in the one outside it, original, pattern round 133
// Round:   133
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Frames=0..4, Sink=-1..1, Squeeze=0..1
//
// Knob 1: Hue. Turns the whole run of colours round the wheel; the outer frame is a cool dark and each frame inward is a step warmer and lighter.
// Knob 2: Frames. How many frames sit inside the panel, from 3 to 9. The core stays 20 LEDs wide, so more frames mean thinner bands.
// Knob 3: Sink. How low each frame sits in the one outside it. At the left of the knob every frame is centred; in the middle the margin under it is a third of the margin over it; at the right it rests on the floor of its parent.
// Knob 4: Squeeze. How tall the core is against how wide. At the left it is a square; at the right it is as tall as the panel is, twice its width, and the frames between steal the shape one step at a time.

const W = 64;
const H = 128;
const CORE = 20;
const MAX_FRAMES = 9;

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

export function setup(params) {
  params.t = 0;
  params.n = 6;
  params.rect = new Float32Array((MAX_FRAMES + 1) * 4);
  params.col = new Float32Array((MAX_FRAMES + 1) * 3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const n = Math.max(3, Math.min(MAX_FRAMES, Math.round(3 + 1.5 * k[1])));
  params.n = n;
  // Sink 0 puts the frame low, a quarter of its spare height under it and the rest over it. -1 centres it and 1 rests it on the floor.
  const sink = Math.max(0, Math.min(1, 0.5 + 0.5 * k[2] + 0.05 * Math.sin(params.t * 0.5)));
  const coreAspect = 1 + k[3] + 0.05 * Math.sin(params.t * 0.37 + 1);
  const rect = params.rect;
  // The panel itself is frame 0: 64 wide, 128 tall, twice as tall as wide.
  rect[0] = 0;
  rect[1] = 0;
  rect[2] = W;
  rect[3] = H;
  let prevH = H;
  let prevBottom = H;
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    const w = W + (CORE - W) * f;
    const asp = 2 + (coreAspect - 2) * f;
    const h = w * asp;
    const free = prevH - h;
    const bottom = prevBottom - free * (0.5 - 0.5 * sink);
    rect[i * 4] = (W - w) / 2;
    rect[i * 4 + 1] = bottom - h;
    rect[i * 4 + 2] = (W + w) / 2;
    rect[i * 4 + 3] = bottom;
    prevH = h;
    prevBottom = bottom;
  }
  // Frames take turns between two hues a third of a wheel apart, so each one sits against a colour it is not, and they grow lighter toward the core.
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const warm = i % 2 === 1;
    hsv(k[0] + 0.62 - 0.18 * f + (warm ? 0.36 : 0), warm ? 0.88 : 0.8, 0.3 + 0.7 * Math.pow(f, 0.9), params.col.subarray(i * 3, i * 3 + 3));
  }
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function draw(display, params, time) {
  const n = params.n;
  const rect = params.rect;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      let r = col[0];
      let g = col[1];
      let b = col[2];
      for (let i = 1; i <= n; i++) {
        const o = i * 4;
        const cx = clamp01(Math.min(px - rect[o], rect[o + 2] - px) + 0.5);
        if (cx <= 0) break;
        const cy = clamp01(Math.min(py - rect[o + 1], rect[o + 3] - py) + 0.5);
        if (cy <= 0) break;
        const c = cx * cy;
        r += (col[i * 3] - r) * c;
        g += (col[i * 3 + 1] - g) * c;
        b += (col[i * 3 + 2] - b) * c;
      }
      display.setPixel(x, y, r, g, b);
    }
  }
}
