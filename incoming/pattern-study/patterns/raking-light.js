// ===== Patternflow pattern =====
// Title:   Raking Light
// Family:  shadow
// Idea:    A range of bare ridges seen straight down slides slowly under the panel while a low sun goes round it, so the long blue shadows of the peaks swing across the valleys and the slopes that face the sun catch a warm light, never the same ground under the same sun twice.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 196
// Round:   198
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0..3, Sun=-1..1, Rough=0..1
//
// Knob 1: Hue. The colour of the light: a warm sun and a blue sky where the knob opens, and the pair turned together round the wheel as it goes up.
// Knob 2: Pace. How fast the sun goes round and the ground slides by, from both standing still at the bottom of the knob; where it opens the sun goes round once in about a minute.
// Knob 3: Sun. How high the sun stands. It opens at 18 degrees, where a peak throws a shadow three times its height; down to 3 degrees at the bottom, where almost all the ground is in shadow and only the slopes turned to the sun are lit, and up to 60 degrees at the top, where the shadows shrink under the ridges.
// Knob 4: Rough. How broken the ground is, from long smooth ridges where the knob opens to crags, gullies and scree at the top.

const W = 64;
const H = 128;
// The ground is worked out a margin wider than the panel on every side, so shadows can fall in from peaks off the edge.
const M = 28;
const GW = W + 2 * M;
const GH = H + 2 * M;
// The tallest peak, in LEDs of height, and the size of the broadest ridges.
const TALL = 16;
const SCALE = 34;
// Shadow rays step this far at a time and give up after this many steps.
const STEP = 1.4;
const STEPS = 44;
// The ground slides this many LEDs a second at Pace 1, and the sun turns at this many radians a second.
const SLIDE = 0.9;
const TURN = 0.05;

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Gradient noise, between about -1 and 1.
function noise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const g = (ix, iy, dx, dy) => {
    const a = hash(ix, iy) * Math.PI * 2;
    return Math.cos(a) * dx + Math.sin(a) * dy;
  };
  const n00 = g(xi, yi, xf, yf);
  const n10 = g(xi + 1, yi, xf - 1, yf);
  const n01 = g(xi, yi + 1, xf, yf - 1);
  const n11 = g(xi + 1, yi + 1, xf - 1, yf - 1);
  const a = n00 + (n10 - n00) * u;
  const b = n01 + (n11 - n01) * u;
  return (a + (b - a) * v) * 1.6;
}

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function setup(params) {
  params.t = 0;
  params.slide = 0;
  params.az = 2.2;
  params.ground = new Float32Array(GW * GH);
  params.sun = new Float32Array(3);
  params.sky = new Float32Array(3);
  params.elev = 0.31;
  params.rough = 0.06;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const pace = clamp(k[1], 0, 3);
  params.slide += dt * pace * SLIDE;
  params.az += dt * pace * TURN;
  const u = clamp(k[2], -1, 1);
  params.elev = ((u < 0 ? 18 + 15 * u : 18 + 42 * u) * Math.PI) / 180;
  params.rough = clamp(k[3], 0, 1);
  // A low sun is a deep orange and a high one nearly white; the sky stays blue. Knob 1 turns both round the wheel together.
  const low = clamp(1 - (params.elev - 0.05) / 0.6, 0, 1);
  hsv(k[0] + 0.075, 0.2 + 0.55 * low, 1, params.sun);
  hsv(k[0] + 0.6, 0.62, 1, params.sky);
}

function buildGround(params) {
  const g = params.ground;
  const rough = params.rough;
  // The ground slides up the panel and a little to the left, so new ridges come in from the lower right.
  const ox = params.slide * 0.35;
  const oy = params.slide;
  for (let j = 0; j < GH; j++) {
    const wy = (j - M + oy) / SCALE;
    for (let i = 0; i < GW; i++) {
      const wx = (i - M + ox) / SCALE;
      // Ridges: the creases of the noise turned upside down, sharpened, in three octaves; Knob 4 lifts the small ones.
      let h = 0;
      let amp = 1;
      let f = 1;
      let wsum = 0;
      for (let o = 0; o < 4; o++) {
        const r = 1 - Math.abs(noise(wx * f + o * 17.3, wy * f - o * 9.1));
        h += r * r * r * amp;
        wsum += amp;
        f *= 2.03;
        amp *= o === 0 ? 0.28 + 0.3 * rough : 0.3 + 0.32 * rough;
      }
      // A broad swell under the ridges, so the range has high ground and low ground.
      const swell = 0.5 + 0.5 * noise(wx * 0.37 + 40, wy * 0.37 - 13);
      g[j * GW + i] = (h / wsum) * (0.55 + 0.45 * swell) * TALL;
    }
  }
}

export function draw(display, params) {
  buildGround(params);
  const g = params.ground;
  const { sun, sky, elev, az } = params;
  const sx = Math.cos(az);
  const sy = Math.sin(az);
  const rise = Math.tan(elev) * STEP;
  const lx = sx * Math.cos(elev);
  const ly = sy * Math.cos(elev);
  const lz = Math.sin(elev);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y + M) * GW + (x + M);
      const h = g[i];
      // The slope from the neighbours, and how squarely the ground faces the sun.
      const nx = (g[i - 1] - g[i + 1]) * 0.5;
      const ny = (g[i - GW] - g[i + GW]) * 0.5;
      const nl = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const face = Math.max(0, (nx * lx + ny * ly + lz) * nl);
      // Walk towards the sun until the ray clears the ground or a peak gets in the way. The closest call softens the edge of the shadow.
      let light = 1;
      let px = x + M + 0.5;
      let py = y + M + 0.5;
      let ray = h + 0.15;
      for (let s = 0; s < STEPS; s++) {
        px += sx * STEP;
        py += sy * STEP;
        ray += rise;
        if (px < 0 || py < 0 || px >= GW - 1 || py >= GH - 1) break;
        const ix = px | 0;
        const iy = py | 0;
        const fx = px - ix;
        const fy = py - iy;
        const j = iy * GW + ix;
        const gh = (g[j] * (1 - fx) + g[j + 1] * fx) * (1 - fy) + (g[j + GW] * (1 - fx) + g[j + GW + 1] * fx) * fy;
        const clear = (ray - gh) / (s + 1);
        if (clear < light) light = clear;
        if (light <= 0) break;
        if (ray > TALL + 1) break;
      }
      light = clamp(light * 2.2, 0, 1);
      const lit = face * light;
      // How much open sky the ground sees: less in the bottom of a valley.
      const open = 0.75 + 0.25 * clamp(h / TALL, 0, 1);
      // The shadowed ground is lit by the sky alone, a little more where it faces up.
      const sh = 0.22 * open * (0.55 + 0.45 * nl);
      const r = (sun[0] * lit * 0.95 + sky[0] * sh) * 255;
      const gg = (sun[1] * lit * 0.95 + sky[1] * sh) * 255;
      const b = (sun[2] * lit * 0.95 + sky[2] * sh) * 255;
      display.setPixel(x, y, clamp(r, 0, 255), clamp(gg, 0, 255), clamp(b, 0, 255));
    }
  }
}
