// ===== Patternflow pattern =====
// Title:   Domain Warp
// Family:  noise
// Idea:    Noise that is pushed around by its own noise twice over stops looking like noise and starts looking like stone being poured.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 64x128
// @knobs Cycle=0..1, Speed=0..5, Warp=1..6, Zoom=0.035..0.095
// @ramp oklab wrap 0:#05030f 0.16:#0e1450 0.22:#2a7ac0 0.27:#100c44 0.5:#2c1478 0.62:#c83888 0.68:#ffd890 0.74:#ff6a3a 0.84:#4a0a3a 1:#05030f
//
// Knob 1: Cycle. Slides the palette through the stone, so the gold veins move onto other contours; one turn comes back.
// Knob 2: Speed. How fast the marble pours; 0 holds it still.
// Knob 3: Warp. How hard the noise is folded into itself, from loose marble to tight swirls.
// Knob 4: Zoom. Size of the stone; low is a few big swirls, high is fine grain.

// The noise is built once into a tileable texture, so each stage of the
// warp is one lookup instead of four octaves of noise.
const N = 128;

function hash(x, y, s) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function tap(tex, u, v) {
  const fu = Math.floor(u);
  const fv = Math.floor(v);
  const x0 = fu & (N - 1);
  const y0 = fv & (N - 1);
  const x1 = (x0 + 1) & (N - 1);
  const y1 = (y0 + 1) & (N - 1);
  const tx = u - fu;
  const ty = v - fv;
  const a = tex[y0 * N + x0];
  const b = tex[y0 * N + x1];
  const c = tex[y1 * N + x0];
  const d = tex[y1 * N + x1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

export function setup(params) {
  const tex = new Float32Array(N * N);
  let amp = 1;
  for (let o = 0; o < 4; o++) {
    const cells = 4 << o;
    const size = N / cells;
    for (let y = 0; y < N; y++) {
      const gy = Math.floor(y / size);
      const fy = fade(y / size - gy);
      for (let x = 0; x < N; x++) {
        const gx = Math.floor(x / size);
        const fx = fade(x / size - gx);
        const x1 = (gx + 1) % cells;
        const y1 = (gy + 1) % cells;
        const a = hash(gx, gy, o);
        const b = hash(x1, gy, o);
        const c = hash(gx, y1, o);
        const d = hash(x1, y1, o);
        const top = a + (b - a) * fx;
        const bottom = c + (d - c) * fx;
        tex[y * N + x] += (top + (bottom - top) * fy) * amp;
      }
    }
    amp *= 0.5;
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < tex.length; i++) {
    lo = Math.min(lo, tex[i]);
    hi = Math.max(hi, tex[i]);
  }
  for (let i = 0; i < tex.length; i++) tex[i] = (tex[i] - lo) / (hi - lo);
  params.tex = tex;
  params.clock = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 1, 0.06];
  params.colour = k[0];
  params.speed = k[1];
  params.warp = k[2];
  params.zoom = k[3];
  params.clock += dt * params.speed * 0.4;
}

export function draw(display, params, time) {
  const tex = params.tex;
  const w = display.width;
  const h = display.height;
  const t = params.clock;
  // Texels per LED; the texture's coarsest noise cell is 32 texels wide.
  const s = params.zoom * 12;
  const amount = 36 + (params.warp - 1) * 5.5;
  const ox = t * 3.1;
  const oy = t * 1.7;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = (x - w / 2) * s + 64 + t * 1.3;
      const py = (y - h / 2) * s + 64 + t * 0.4;
      const qx = tap(tex, px + ox, py) - 0.5;
      const qy = tap(tex, px + 41.3, py + 17.9 - oy) - 0.5;
      const rx = tap(tex, px + amount * qx + 23.7 - oy, py + amount * qy + 91.1) - 0.5;
      const ry = tap(tex, px + amount * qx + 77.2, py + amount * qy + 5.3 + ox * 0.6) - 0.5;
      const f = tap(tex, px + amount * rx, py + amount * ry);
      let v = f * 3 + params.colour;
      v -= Math.floor(v);
      display.setValue(x, y, v);
    }
  }
}
