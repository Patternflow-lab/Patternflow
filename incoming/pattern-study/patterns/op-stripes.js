// ===== Patternflow pattern =====
// Title:   Op Stripes
// Family:  wave
// Idea:    Flat stripes in two colours open wider wherever a slow bulge passes under them, the trick Bridget Riley painted by hand, so a flat panel seems to swell towards you.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drift=0.1..6, Stripes=14..26, Swell=0..1
//
// Knob 1: Hue. Turns the stripe pair around the colour wheel; the second stripe is a deep colour from across the wheel, and goes black where that would be brown.
// Knob 2: Drift. How fast the bulges travel under the stripes and the bend rolls along them.
// Knob 3: Stripes. Stripe pairs from top to bottom where nothing is swelling.
// Knob 4: Swell. How far the stripes open over a bulge, from a soft swell to a wide flat lens.

const W = 64;
const H = 128;
const BULGES = 2;

function hsv(h, s, v, out, o) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

export function setup(params) {
  const p = params;
  p.gx = new Float32Array(BULGES * W);
  p.gy = new Float32Array(BULGES * H);
  p.cx = new Float32Array(BULGES);
  p.cy = new Float32Array(BULGES);
  p.u = new Float32Array(H);
  p.col = new Float32Array(6);
  // Each bulge has its own pace, size and lane. sy runs along its path down
  // the panel, sx across it.
  p.speed = new Float32Array([1, 0.62]);
  p.sx = new Float32Array([36, 22]);
  p.sy = new Float32Array([24, 17]);
  p.bend = new Float32Array(W);
  // Each phase wraps on its own, so a long run keeps its precision.
  p.along = new Float32Array([0, 99]);
  p.lanePhase = new Float32Array([0.4, 3.3]);
  p.roll = 0;
  p.hue = -1;
}

export function update(dt, input, params) {
  const p = params;
  const k = input.knobValues || [0, 2, 14, 0.06];
  p.pairs = k[2];
  p.depth = 0.5 + 0.42 * k[3];
  if (k[0] !== p.hue) {
    p.hue = k[0];
    hsv(0.96 + p.hue, 0.72, 1, p.col, 0);
    // The partner sits across the wheel, deep and dark. A dark orange or
    // yellow is brown or olive, so over that stretch it sinks to black.
    let hb = 0.53 + p.hue;
    hb -= Math.floor(hb);
    const d = Math.abs(hb - 0.16) / 0.16;
    const m = d >= 1 ? 1 : d * d * (3 - 2 * d);
    hsv(hb, 1, 0.36 * m, p.col, 3);
  }
  const go = dt * k[1];

  // The stripes lie across the 64 LEDs and stack up the 128, so a bulge has
  // the long side of the panel to open in. The bulges travel down the panel
  // and come round again, each drifting from side to side in its own lane.
  const span = H + 70;
  for (let i = 0; i < BULGES; i++) {
    const s = p.speed[i];
    p.along[i] = (p.along[i] + go * 0.75 * s) % span;
    p.lanePhase[i] = (p.lanePhase[i] + go * 0.06 * s) % (Math.PI * 2);
    p.cy[i] = p.along[i] - 35;
    p.cx[i] = W / 2 + Math.sin(p.lanePhase[i]) * 20;
    const sx = p.sx[i];
    const sy = p.sy[i];
    for (let x = 0; x < W; x++) {
      const d = (x + 0.5 - p.cx[i]) / sx;
      p.gx[i * W + x] = Math.exp(-d * d);
    }
    for (let y = 0; y < H; y++) {
      const d = (y + 0.5 - p.cy[i]) / sy;
      p.gy[i * H + y] = Math.exp(-d * d);
    }
  }
  // Every stripe follows the same slow bend across the panel.
  p.roll = (p.roll + go * 0.14) % (Math.PI * 2);
  for (let x = 0; x < W; x++) p.bend[x] = 2.6 * Math.sin(((x + 0.5) / W) * Math.PI * 2 - p.roll);
}

export function draw(display, params, time) {
  const p = params;
  const u = p.u;
  const D = p.depth;
  const period = H / p.pairs;
  const a = p.col;
  for (let x = 0; x < W; x++) {
    // Walk the column adding up stripe phase; over a bulge the phase climbs
    // slower, so the stripes there are wider. It never runs backwards, so a
    // stripe never folds over itself.
    let sum = 0;
    for (let y = 0; y < H; y++) {
      let keep = 1;
      for (let i = 0; i < BULGES; i++) keep *= 1 - p.gx[i * W + x] * p.gy[i * H + y];
      const rho = 1 - D * (1 - keep);
      u[y] = sum + rho * 0.5;
      sum += rho;
    }
    // Centre the column so a swelling column opens out both ways.
    const shift = -sum / 2;
    for (let y = 0; y < H; y++) {
      const s = Math.floor(((u[y] + shift + p.bend[x]) * 2) / period);
      const o = (s & 1) * 3;
      display.setPixel(x, y, a[o], a[o + 1], a[o + 2]);
    }
  }
}
