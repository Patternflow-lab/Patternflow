// ===== Patternflow pattern =====
// Title:   Lava Lamp
// Family:  sim
// Idea:    A tall lava lamp: wax warms in the pool over the bulb, pulls up on a neck, rises as a drop, cools against the glass at the top and sinks back, glowing soft against coloured liquid.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Edward Craven Walker's Astro lamp (1963), drawn as metaballs
// Round:   3
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Heat=0.3..3, Wax=4..10, Stretch=0..1
//
// Knob 1: Hue. Turns the liquid and the wax together, starting from blue liquid and wax that runs from orange when cool to yellow when hot.
// Knob 2: Heat. How hot the bulb runs: the wax barely stirs at the bottom of the range and circulates in a few seconds at the top.
// Knob 3: Wax. How many drops are loose in the lamp; drops past the count sink into the pool and melt into it.
// Knob 4: Stretch. At 0 the wax travels as round drops; turned up, moving wax pulls out into teardrops and long necks, and the pool reaches up after it.
// Buttons: K1 tap flares the bulb, and the lowest drop heats through and lets go.

const W = 64;
const H = 128;
const MAX = 10;
// A drop is wax where its field passes EDGE. The field of an isolated drop
// reaches EDGE at 0.644 of its kernel radius, so the kernel is 1.55 times the
// drop's radius.
const EDGE = 0.22;
const KERNEL = 1.55;
// The pool's surface row. Drops that reach the top rest under the glass at CAP.
const POOL = 114;
const CAP = 2;

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise1(x, seed) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
}

function smooth(a, b, v) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function hsvInto(out, o, h, s, v) {
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
  params.x = new Float32Array(MAX);
  params.y = new Float32Array(MAX);
  params.vx = new Float32Array(MAX);
  params.vy = new Float32Array(MAX);
  params.r = new Float32Array(MAX);
  params.temp = new Float32Array(MAX);
  params.size = new Float32Array(MAX);
  // How slowly each drop gives up its heat to the liquid on the way, in seconds.
  params.hold = new Float32Array(MAX);
  for (let i = 0; i < MAX; i++) {
    params.r[i] = 7 + Math.random() * 7;
    params.hold[i] = 9 + Math.random() * 20;
    params.x[i] = 10 + Math.random() * (W - 20);
    params.y[i] = 20 + Math.random() * 90;
    params.temp[i] = Math.random();
    params.size[i] = i < 4 ? 1 : 0;
  }
  params.surfB = new Float32Array(W);
  params.liquid = new Float32Array(H * 3);
  params.side = new Float32Array(W);
  params.lut = new Float32Array(65 * 3);
  params.t = 0;
  params.flare = 0;
  params.started = false;
  params.heat = 2;
  params.stretch = 0;
  params.count = 4;
}

function step(params, dt) {
  const heat = params.heat;
  const stretch = params.stretch;
  const t = (params.t += dt);
  params.flare = Math.max(0, params.flare - dt * 0.6);
  // Rising wax is faster the hotter the lamp runs, never quick.
  const V = 11 * Math.pow(heat, 0.7);
  const relax = Math.min(1, dt / 0.6);
  const n = params.count;
  for (let i = 0; i < MAX; i++) {
    // Drops past the count shrink away into the pool; new ones grow out of it.
    const target = i < n ? 1 : 0;
    const s = params.size[i];
    params.size[i] = s + (target - s) * Math.min(1, dt * 0.5);
    if (s < 0.02 && target === 0) {
      params.size[i] = 0;
      params.y[i] = H + 4;
      continue;
    }
    if (s < 0.05 && target === 1 && params.y[i] < POOL) {
      // A drop that comes back starts warm in the pool.
      params.y[i] = H - 4;
      params.temp[i] = 0.5;
    }
    const r = params.r[i] * (0.4 + 0.6 * s);
    const y = params.y[i];
    let T = params.temp[i];
    // Only the bulb heats, through the pool; the liquid is cooler than melted wax
    // all the way up, and coolest under the glass at the top.
    const bottom = smooth(POOL - 8, POOL + 6, y + r * 0.6);
    const top = smooth(CAP + 24, CAP + 4, y - r * 0.6);
    const ambient = 0.2 + 0.15 * (y / H);
    T += dt * heat * (bottom * (1.05 - T) * (0.6 + params.flare * 2) - top * (T + 0.05) * 0.35);
    T -= (dt * (T - ambient)) / params.hold[i];
    params.temp[i] = Math.max(0, Math.min(1, T));

    // Bigger drops push harder; a drop's speed follows its warmth.
    const vyTarget = -Math.tanh((params.temp[i] - 0.5) * 4) * V * (0.6 + r / 22);
    params.vy[i] += (vyTarget - params.vy[i]) * relax;
    const rising = params.vy[i] < 0;
    const wander = (noise1(t * 0.12 + i * 7.3, i) - 0.5) * 6;
    // Warm wax drifts in over the bulb, cool wax slides out along the glass.
    const lane = rising ? (W / 2 - params.x[i]) * 0.05 : (params.x[i] < W / 2 ? -1 : 1) * 1.2;
    let push = 0;
    for (let j = 0; j < MAX; j++) {
      if (j === i || params.size[j] < 0.05) continue;
      const dx = params.x[i] - params.x[j];
      const dy = params.y[i] - params.y[j];
      const reach = (params.r[i] + params.r[j]) * 0.65;
      const d2 = dx * dx + dy * dy;
      if (d2 < reach * reach && d2 > 1e-4) push += (dx / Math.sqrt(d2)) * (1 - Math.sqrt(d2) / reach) * 3;
    }
    params.vx[i] += (wander + lane + push - params.vx[i]) * relax;
    params.x[i] += params.vx[i] * dt;
    params.y[i] += params.vy[i] * dt;
    const m = r * 0.7;
    if (params.x[i] < m) {
      params.x[i] = m;
      params.vx[i] = Math.abs(params.vx[i]) * 0.3;
    } else if (params.x[i] > W - m) {
      params.x[i] = W - m;
      params.vx[i] = -Math.abs(params.vx[i]) * 0.3;
    }
    // Wax that reaches the top rests against the glass until it cools; wax in the pool sinks half into it.
    const ceiling = CAP + r * 0.45;
    const floor = POOL + r * 0.55;
    if (params.y[i] < ceiling) {
      params.y[i] = ceiling;
      params.vy[i] = Math.max(0, params.vy[i]);
    } else if (params.y[i] > floor) {
      params.y[i] = floor;
      params.vy[i] = Math.min(0, params.vy[i]);
    }
  }
  // The pool breathes slowly.
  for (let x = 0; x < W; x++)
    params.surfB[x] = POOL + 2.2 * Math.sin(x * 0.11 + t * 0.35) + 1.4 * Math.sin(x * 0.27 - t * 0.6 + 1) - stretch * 2;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 4, 0.06];
  dt = Math.min(dt, 0.1);
  params.hue = k[0];
  params.heat = Math.max(0.1, k[1]);
  params.count = Math.max(1, Math.min(MAX, Math.round(k[2])));
  params.stretch = Math.max(0, Math.min(1, k[3]));
  if (!params.started) {
    params.started = true;
    for (let i = 0; i < MAX; i++) params.size[i] = i < params.count ? 1 : 0;
    // A lamp that has been on for a while: the wax is already moving.
    for (let i = 0; i < 600; i++) step(params, 1 / 30);
  }
  if (input.btnPressed && input.btnPressed[0]) {
    params.flare = 1;
    let best = -1;
    for (let i = 0; i < params.count; i++) if (best < 0 || params.y[i] > params.y[best]) best = i;
    if (best >= 0) {
      params.temp[best] = 1;
      params.vy[best] = -12;
    }
  }
  step(params, dt);
}

export function draw(display, params, time) {
  const hue = params.hue;
  const stretch = params.stretch;
  const flare = params.flare;
  const liquid = params.liquid;
  const lut = params.lut;
  const side = params.side;
  // The liquid glows brightest just over the bulb, bluer there and more violet at the top.
  // Yellow liquid is lit brighter and paler, since dim yellow reads as olive.
  for (let y = 0; y < H; y++) {
    const d = y / (H - 1);
    const lh = hue + 0.74 - 0.1 * d;
    const warm = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * (lh - 0.14)), 3);
    const v = (0.5 + 0.38 * Math.pow(d, 1.6)) * (1 + 0.45 * warm) + flare * 0.12 * d;
    hsvInto(liquid, y * 3, lh, 0.9 - 0.2 * warm, Math.min(1, v));
  }
  // The glass is round, so the liquid dims a little towards its sides.
  for (let x = 0; x < W; x++) {
    const u = (x - (W - 1) / 2) / (W / 2);
    side[x] = 1 - 0.16 * u * u;
  }
  // Wax colour by warmth: orange when cool, yellow when hot. It stays bright, since dim orange reads as brown.
  for (let i = 0; i <= 64; i++) {
    const T = i / 64;
    hsvInto(lut, i * 3, hue + 0.055 + 0.08 * T, 0.95 - 0.25 * T * T, 1);
  }

  const n = MAX;
  const bx = params.x;
  const by = params.y;
  const vy = params.vy;
  const temp = params.temp;
  // Each drop's kernel, drawn out into a teardrop along the way it moves and
  // flattened on top where it rests against the glass.
  const R = new Float32Array(n);
  const lead = new Float32Array(n);
  const tail = new Float32Array(n);
  const wide = new Float32Array(n);
  const up = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    const s = params.size[i];
    if (s < 0.02) {
      R[i] = 0;
      continue;
    }
    const r = params.r[i] * (0.4 + 0.6 * s) * (0.94 + 0.12 * temp[i]);
    R[i] = r * KERNEL;
    const speed = Math.min(1, Math.abs(vy[i]) / 14);
    const rest = smooth(CAP + r * 0.45 + 5, CAP + r * 0.45, by[i]);
    lead[i] = (1 + 0.15 * speed) * (1 - 0.3 * rest);
    tail[i] = 1 + 0.4 * speed + stretch * (0.4 + 1.4 * speed);
    wide[i] = (1 + 0.2 * rest) / Math.sqrt((lead[i] + tail[i]) / 2);
    up[i] = vy[i] < 0 || rest > 0.5 ? 1 : 0;
  }
  const reach = 3.5 + 8 * stretch;
  const surfB = params.surfB;

  for (let y = 0; y < H; y++) {
    const lr = liquid[y * 3];
    const lg = liquid[y * 3 + 1];
    const lb = liquid[y * 3 + 2];
    for (let x = 0; x < W; x++) {
      // The pool is a wall of wax whose field fades over a few LEDs above it,
      // so a drop leaving it pulls up a neck.
      const fb = EDGE * Math.exp(Math.min(3, (y - surfB[x]) / reach));
      let F = fb;
      let FT = fb;
      for (let i = 0; i < n; i++) {
        const Ri = R[i];
        if (Ri === 0) continue;
        const dx = (x - bx[i]) / wide[i];
        if (dx > Ri || dx < -Ri) continue;
        let dy = y - by[i];
        // Rising wax trails below; sinking wax trails above.
        dy /= (dy > 0) === (up[i] === 1) ? tail[i] : lead[i];
        if (dy > Ri || dy < -Ri) continue;
        const u = (dx * dx + dy * dy) / (Ri * Ri);
        if (u >= 1) continue;
        const f = (1 - u) * (1 - u) * (1 - u);
        F += f;
        FT += f * temp[i];
      }
      // A ramp of a few LEDs around EDGE: the wax shades into the liquid instead of cutting it.
      const m = smooth(EDGE - 0.1, EDGE + 0.14, F);
      const T = F > 1e-6 ? Math.min(1, FT / F) : 0;
      const li = Math.round(T * 64) * 3;
      // Deep wax glows brighter than its rim.
      const core = 0.88 + 0.12 * smooth(EDGE, EDGE + 0.8, F);
      // Liquid close to wax catches its glow.
      const glow = side[x] * (1 + 0.3 * smooth(0, EDGE, F)) * (1 - m);
      const r = lr * glow + lut[li] * core * m;
      const g = lg * glow + lut[li + 1] * core * m;
      const b = lb * glow + lut[li + 2] * core * m;
      display.setPixel(x, y, Math.min(255, r), Math.min(255, g), Math.min(255, b));
    }
  }
}
