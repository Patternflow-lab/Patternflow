// ===== Patternflow pattern =====
// Title:   Ripple Tank
// Family:  sim
// Idea:    Rain on a shallow tank, where every drop's ring runs into the walls and into every other ring and the panel shows where they agree.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rain=0.5..6, Damping=0..1, Drop=2.5..6
//
// Knob 1: Hue. Turns the crests round the colour wheel; the troughs stay deep blue.
// Knob 2: Rain. Drops per second.
// Knob 3: Damping. How long a ring keeps going; low rings on and bounces off the walls, high fades before it gets far.
// Knob 4: Drop. Size of each drop; small drops throw fine rings, big ones a slow swell.

const W = 64;
const H = 128;
// Wave speed squared, in cells per step; this stencil blows up above 0.75.
const C2 = 0.55;
const NU = 0.008;
const DEPTH = 2.5;
const STEPS_PER_SECOND = 64;

function hsv(h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  const r = k === 0 ? v : k === 1 ? q : k === 2 ? p : k === 3 ? p : k === 4 ? t : v;
  const g = k === 0 ? t : k === 1 ? v : k === 2 ? v : k === 3 ? q : k === 4 ? p : p;
  const b = k === 0 ? p : k === 1 ? p : k === 2 ? t : k === 3 ? v : k === 4 ? v : q;
  return [r * 255, g * 255, b * 255];
}

function rand(params) {
  let s = params.seed | 0;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  params.seed = s;
  return (s >>> 0) / 4294967296;
}

function drop(params, size) {
  const cx = 4 + rand(params) * (W - 8);
  const cy = 4 + rand(params) * (H - 8);
  const r = Math.ceil(size * 3);
  // Big drops hold more water, so each one falls a little shallower.
  const depth = DEPTH * 2.5 / size;
  const u = params.u;
  const p = params.p;
  // A dimple with a raised lip round it. The two hold the same water, so a
  // drop adds no level to the tank and leaves no slow wake behind its ring.
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, cy + r); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, cx + r); x++) {
      const dx = (x - cx) / size;
      const dy = (y - cy) / size;
      const d2 = dx * dx + dy * dy;
      if (d2 > 9) continue;
      const v = depth * (1 - d2) * Math.exp(-d2);
      u[y * W + x] -= v;
      p[y * W + x] -= v;
    }
  }
}

function step(params, damp) {
  const u = params.u;
  const p = params.p;
  // p is overwritten with the next state, then the two swap.
  for (let y = 0; y < H; y++) {
    const up = (y === 0 ? 0 : y - 1) * W;
    const row = y * W;
    const down = (y === H - 1 ? H - 1 : y + 1) * W;
    for (let x = 0; x < W; x++) {
      // The walls mirror the cell beside them, so rings bounce back whole.
      const l = x === 0 ? 0 : x - 1;
      const r = x === W - 1 ? W - 1 : x + 1;
      const i = row + x;
      const c = u[i];
      const sides = u[up + x] + u[down + x] + u[row + l] + u[row + r];
      const corners = u[up + l] + u[up + r] + u[down + l] + u[down + r];
      // The nine-point Laplacian keeps rings round instead of square.
      const lap = (4 * sides + corners - 20 * c) / 6;
      // Viscosity: ripples finer than a few cells die first, so the grid's
      // own chequered wake never builds up.
      const was = p[i];
      const blur = sides - (p[up + x] + p[down + x] + p[row + l] + p[row + r]) - 4 * (c - was);
      p[i] = (2 * c - was + C2 * lap + NU * blur) * damp;
    }
  }
  params.u = p;
  params.p = u;
}

export function setup(params) {
  params.u = new Float32Array(W * H);
  params.p = new Float32Array(W * H);
  params.lut = new Uint8Array(512 * 3);
  params.lutHue = -1;
  params.seed = 0x5bd1e995;
  params.pending = 0;
  params.next = 0.1;
  params.clock = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 2.5];
  params.hue = k[0];
  const rain = k[1];
  // Decay per second, from about three seconds of ringing down to a quarter of one.
  const gamma = 0.33 * Math.pow(12, Math.max(0, Math.min(1, k[2])));
  const size = k[3];

  params.clock += dt;
  while (params.clock >= params.next) {
    drop(params, size);
    // Irregular, but never a long dry spell.
    params.next += (0.35 + rand(params) * 1.3) / Math.max(0.1, rain);
  }

  params.pending += dt * STEPS_PER_SECOND;
  let steps = Math.floor(params.pending);
  params.pending -= steps;
  if (steps > 8) steps = 8;
  const damp = Math.exp(-gamma / STEPS_PER_SECOND);
  for (let s = 0; s < steps; s++) step(params, damp);
}

export function draw(display, params, time) {
  // One table for troughs (first half) and crests (second half). Troughs
  // stay blue at every hue: a dim orange trough would read as brown.
  if (params.lutHue !== params.hue) {
    params.lutHue = params.hue;
    const lut = params.lut;
    for (let i = 0; i < 512; i++) {
      const t = Math.abs(i - 255.5) / 255.5;
      // Rings lose height fast as they spread, so the brightness curve lifts
      // the low end, and the faintest ripples still sink into the dark.
      const e = Math.pow(Math.max(0, (t - 0.1) / 0.9), 0.6);
      const c = i > 255
        ? hsv(params.hue + 0.52 - t * 0.04, 0.9 - t * t * 0.6, e)
        : hsv(0.64, 0.95, e * 0.5);
      lut[i * 3] = c[0];
      lut[i * 3 + 1] = c[1];
      lut[i * 3 + 2] = c[2];
    }
  }
  const u = params.u;
  const lut = params.lut;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = u[y * W + x] * 14;
      v = v < -1 ? -1 : v > 1 ? 1 : v;
      const li = Math.round(255.5 + v * 255.5) * 3;
      display.setPixel(x, y, lut[li], lut[li + 1], lut[li + 2]);
    }
  }
}
