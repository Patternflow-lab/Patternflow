// ===== Patternflow pattern =====
// Title:   Sounding
// Family:  sensing
// Idea:    A sonar fan opens upwards from the foot of the dark panel and its beam swings slowly from side to side, and only where it has just passed can anything be seen: the arc of the sea floor with nothing behind it, a school of small echoes wheeling about, a faint scattering layer and two large contacts crossing, each glowing for a moment and fading before the beam comes back.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: sector-scanning sonar
// Round:   198
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sweep=0..3, Glow=-1..1, Gain=0..1
//
// Knob 1: Hue. The colour of the screen, from amber where the knob opens round the wheel; the freshest echoes run towards white.
// Knob 2: Sweep. How fast the beam swings, from standing still at the bottom of the knob, where only the line it points along is kept up and the rest fades out, to a swing across the fan in about two seconds at the top; it opens on about three and a half.
// Knob 3: Glow. How long an echo keeps glowing after the beam has passed: just over a second at the bottom, where only a wedge behind the beam is lit, four seconds where the knob opens, and twelve at the top, where the whole fan stays filled.
// Knob 4: Gain. How loud the receiver is turned up. Where the knob opens only the floor, the school and the contacts come back; turned up, the scattering layer, the noise near the surface and the soft ground behind the floor come in, and at the top the fan fills with clutter.

const W = 64;
const H = 128;
// The beam comes from a point just under the foot of the panel and reaches this far.
const OX = 32;
const OY = 131;
const RANGE = 128;
// How far the beam swings either side of straight up, and how fast at Sweep 1, in radians and radians a second.
const SWING = 1.08;
const RATE = 0.31;
// The school: how many fish.
const FISH = 52;

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i, 91) * (1 - u) + hash(i + 1, 91) * u;
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
  params.phase = 0.3;
  params.beam = 0;
  params.started = false;
  params.glow = new Float32Array(W * H);
  params.ang = new Float32Array(W * H);
  params.rad = new Float32Array(W * H);
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      const dx = x + 0.5 - OX;
      const dy = OY - (y + 0.5);
      params.ang[i] = Math.atan2(dx, dy);
      params.rad[i] = Math.sqrt(dx * dx + dy * dy);
    }
  params.fish = Array.from({ length: FISH }, () => ({
    a: 3 + Math.random() * 10,
    b: 2 + Math.random() * 7,
    w: (0.25 + Math.random() * 0.35) * (Math.random() < 0.8 ? 1 : -1),
    p: Math.random() * 6.28,
  }));
  params.fx = new Float32Array(FISH);
  params.fy = new Float32Array(FISH);
  params.col = new Float32Array(3);
}

// Where the school and the two contacts are at time t.
function place(params, t) {
  const cx = 32 + 16 * Math.sin(0.067 * t + 0.5) + 5 * Math.sin(0.19 * t);
  const cy = 70 + 26 * Math.sin(0.049 * t + 2.0) + 7 * Math.sin(0.15 * t + 1);
  // The school stretches and turns as it goes.
  const turn = 0.6 * Math.sin(0.11 * t);
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  for (let i = 0; i < FISH; i++) {
    const f = params.fish[i];
    const ox = f.a * Math.cos(f.w * t + f.p) * 1.3;
    const oy = f.b * Math.sin(f.w * t * 1.3 + f.p);
    params.fx[i] = cx + ox * c - oy * s;
    params.fy[i] = cy + ox * s + oy * c;
  }
  // Two large contacts cross the fan on straight courses and come round again.
  const u = (0.021 * t) % 1;
  const v = (0.013 * t + 0.55) % 1;
  params.c1x = -10 + 84 * u;
  params.c1y = 92 - 30 * u;
  params.c2x = 74 - 84 * v;
  params.c2y = 40 + 12 * v;
}

// What comes back from the sea at LED i at time t, before the gain.
function echo(params, i, t) {
  const a = params.ang[i];
  const r = params.rad[i];
  const x = (i % W) + 0.5;
  const y = Math.floor(i / W) + 0.5;
  // The floor: a bright arc, soft ground just behind it, and an acoustic shadow beyond.
  const floor = 100 + 14 * (noise1(a * 2.6 + t * 0.045) - 0.5) * 2 + 6 * (noise1(a * 9 - t * 0.03 + 20) - 0.5) * 2;
  if (r > floor + 18) return 0;
  const speck = hash(i, Math.floor(t * 3));
  let e = 1.2 * Math.exp(-((r - floor) * (r - floor)) / 3);
  if (r > floor) e += 0.55 * Math.exp(-(r - floor) / 7) * (0.4 + 0.6 * speck);
  // The scattering layer, a faint band that rises and sinks.
  const layer = 58 + 7 * Math.sin(a * 2.1 + t * 0.037);
  e += 0.4 * Math.exp(-((r - layer) * (r - layer)) / 24) * speck;
  // Reverberation near the surface the beam goes out from.
  if (r < 22) e += 0.3 * (1 - r / 22) * speck;
  // The school and the contacts.
  for (let k = 0; k < FISH; k++) {
    const dx = x - params.fx[k];
    const dy = y - params.fy[k];
    const d = dx * dx + dy * dy;
    if (d < 8) e += 0.9 * Math.exp(-d / 1.3);
  }
  for (const [cx, cy] of [
    [params.c1x, params.c1y],
    [params.c2x, params.c2y],
  ]) {
    const dx = x - cx;
    const dy = y - cy;
    const d = dx * dx + dy * dy;
    if (d < 36) e += 1.3 * Math.exp(-d / 6);
  }
  // Sound fades over its way out and back.
  return e * (1 - 0.35 * (r / RANGE)) + 0.08 * speck;
}

function sweep(params, dt, rate, life, gain) {
  params.t += dt;
  const t = params.t;
  place(params, t);
  const before = params.beam;
  params.phase += (dt * rate) / (4 * SWING);
  // The beam swings at an even pace from one edge of the fan to the other and back.
  const f = params.phase - Math.floor(params.phase);
  params.beam = SWING * (f < 0.25 ? 4 * f : f < 0.75 ? 2 - 4 * f : 4 * f - 4);
  const lo = Math.min(before, params.beam) - 0.004;
  const hi = Math.max(before, params.beam) + 0.004;
  const fade = Math.exp(-dt / life);
  const { glow, ang, rad } = params;
  for (let i = 0; i < W * H; i++) {
    glow[i] *= fade;
    const a = ang[i];
    if (a >= lo && a <= hi && rad[i] < RANGE && Math.abs(a) <= SWING) {
      const e = clamp((echo(params, i, t) * gain - 0.16) / 0.84, 0, 1);
      if (e > glow[i]) glow[i] = e;
    }
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  const rate = RATE * clamp(k[1], 0, 3);
  const life = 4 * Math.pow(2, 1.6 * clamp(k[2], -1, 1));
  const gain = 0.85 + 1.6 * clamp(k[3], 0, 1);
  hsv(k[0] + 0.09, 0.85, 1, params.col);
  // The beam has already been swinging for a while when the panel opens.
  if (!params.started) {
    params.started = true;
    for (let s = 0; s < 240; s++) sweep(params, 1 / 30, Math.max(rate, RATE), life, gain);
  }
  sweep(params, dt, rate, life, gain);
}

export function draw(display, params) {
  const { glow, ang, rad, col, beam } = params;
  for (let i = 0; i < W * H; i++) {
    const a = ang[i];
    const r = rad[i];
    let v = glow[i];
    let white = v > 0.6 ? (v - 0.6) * 1.2 : 0;
    const inside = Math.abs(a) <= SWING && r < RANGE;
    if (inside) {
      // Faint rings every 32 LEDs of range, and the beam itself.
      const ring = Math.abs(r - Math.round(r / 32) * 32);
      if (ring < 0.5 && r > 8) v += 0.09;
      const off = Math.abs(a - beam) * r;
      if (off < 0.8) {
        v += 0.18 * (1 - off / 0.8);
        white += 0.1 * (1 - off / 0.8);
      }
    } else if (Math.abs(Math.abs(a) - SWING) * r < 0.6 && r < RANGE) v += 0.09;
    v = Math.pow(Math.min(1, v), 0.75);
    const x = i % W;
    const y = (i / W) | 0;
    display.setPixel(
      x,
      y,
      clamp((col[0] * v + white) * 255, 0, 255),
      clamp((col[1] * v + white) * 255, 0, 255),
      clamp((col[2] * v + white) * 255, 0, 255),
    );
  }
}
