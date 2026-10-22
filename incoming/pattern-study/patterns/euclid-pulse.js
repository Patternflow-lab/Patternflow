// ===== Patternflow pattern =====
// Title:   Euclid Pulse
// Family:  rhythm
// Idea:    Spread a few beats as evenly as they will go over a ring of steps and a good many of the world's drum patterns fall out, so the panel plays three of them at once.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 128x64
// @knobs Hue=0..1, Tempo=80..180, Pulses=3..13, Steps=8..16
//
// Knob 1: Hue. Turns the three rings around the colour wheel together.
// Knob 2: Tempo. Beats per minute; the hand goes round once every four beats.
// Knob 3: Pulses. Hits on the outer ring; the middle ring takes about half as many.
// Knob 4: Steps. Steps on the outer ring; the middle ring has three for every four of them.
// Buttons: K3 tap turns the outer rhythm one step later.

const W = 128;
const H = 64;
const CX = 63.5;
const CY = 31.5;
const MAX_STEPS = 32;
const RIPPLES = 24;

// Ring bands in LEDs from the centre: outer, middle, inner.
const R_IN = [24.5, 16.5, 9];
const R_OUT = [30.5, 21.5, 13];

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

// k hits over n steps, as evenly as they go. This is the same necklace
// Bjorklund's algorithm builds, read off with a modulo instead of recursion.
function euclid(p, ring, k, n, rot) {
  p.n[ring] = n;
  for (let s = 0; s < n; s++) {
    const t = (s - rot + n * 4) % n;
    p.hits[ring * MAX_STEPS + s] = (t * k) % n < k ? 1 : 0;
  }
}

// A ripple leaves the outer edge as an arc facing the step that fired; wide 0
// sends it all the way round.
function spawn(p, ring, strength, angle, wide) {
  let slot = 0;
  for (let i = 0; i < RIPPLES; i++) {
    if (p.rAge[i] >= 1) {
      slot = i;
      break;
    }
    if (p.rAge[i] > p.rAge[slot]) slot = i;
  }
  p.rAge[slot] = 0;
  p.rRing[slot] = ring;
  p.rPower[slot] = strength;
  p.rAngle[slot] = angle;
  p.rWide[slot] = wide;
}

export function setup(params) {
  const p = params;
  p.beats = 0;
  p.rot = 0;
  p.n = new Int32Array(3);
  p.hits = new Uint8Array(3 * MAX_STEPS);
  p.env = new Float32Array(3 * MAX_STEPS);
  p.last = new Int32Array([-1, -1, -1]);
  p.down = 0;
  p.rAge = new Float32Array(RIPPLES).fill(1);
  p.rRing = new Uint8Array(RIPPLES);
  p.rPower = new Float32Array(RIPPLES);
  p.rAngle = new Float32Array(RIPPLES);
  p.rWide = new Float32Array(RIPPLES);
  p.dist = new Float32Array(W * H);
  p.turn = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - CX;
      const dy = y - CY;
      p.dist[y * W + x] = Math.hypot(dx, dy);
      // 0 at twelve o'clock, growing clockwise.
      const a = Math.atan2(dx, -dy) / 6.2832;
      p.turn[y * W + x] = a < 0 ? a + 1 : a;
    }
  }
  p.col = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
}

export function update(dt, input, params) {
  const p = params;
  const k = input.knobValues || [0, 80, 3, 8];
  p.hue = k[0];
  p.bpm = k[1];
  if (input.btnPressed && input.btnPressed[2]) p.rot++;
  const pulses = Math.round(k[2]);
  const steps = Math.max(Math.round(k[3]), pulses + 1);
  const mid = Math.max(3, Math.round(steps * 0.75));
  euclid(p, 0, pulses, steps, p.rot % steps);
  euclid(p, 1, Math.min(mid - 1, Math.round(pulses * 0.5) + 1), mid, 1);
  euclid(p, 2, 4, 4, 0);

  p.beats += (dt * p.bpm) / 60;
  const bar = p.beats / 4;
  p.hand = bar - Math.floor(bar);
  const fade = Math.exp(-dt * 5.5);
  for (let i = 0; i < 3 * MAX_STEPS; i++) p.env[i] *= fade;
  p.down *= Math.exp(-dt * 4);
  for (let ring = 0; ring < 3; ring++) {
    const n = p.n[ring];
    const step = Math.floor(p.hand * n);
    if (step !== p.last[ring]) {
      p.last[ring] = step;
      if (p.hits[ring * MAX_STEPS + step]) {
        p.env[ring * MAX_STEPS + step] = 1;
        const angle = (step + 0.5) / n;
        if (ring === 2 && step === 0) {
          p.down = 1;
          spawn(p, 2, 0.8, 0, 0);
        } else spawn(p, ring, ring === 0 ? 1 : ring === 1 ? 0.85 : 0.6, angle, ring === 2 ? 0.2 : 0.13);
      }
    }
  }
  for (let i = 0; i < RIPPLES; i++) p.rAge[i] = Math.min(1, p.rAge[i] + dt / 1.4);
}

export function draw(display, params, time) {
  const p = params;
  hsv(p.hue, 0.9, 1, p.col[0]);
  hsv(p.hue + 0.12, 0.85, 1, p.col[1]);
  hsv(p.hue + 0.5, 0.7, 1, p.col[2]);
  const hand = p.hand;
  const hx = Math.sin(hand * 6.2832);
  const hy = -Math.cos(hand * 6.2832);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const r = p.dist[i];
      const a = p.turn[i];
      let R = 0;
      let G = 0;
      let B = 0;
      let ring = -1;
      for (let j = 0; j < 3; j++) if (r >= R_IN[j] - 0.5 && r <= R_OUT[j] + 0.5) ring = j;
      if (ring >= 0) {
        const n = p.n[ring];
        const pos = a * n;
        const s = Math.floor(pos);
        const local = pos - s;
        const mid = (R_IN[ring] + R_OUT[ring]) / 2;
        // A gap of about one LED between neighbouring steps.
        const gap = (0.6 * n) / (6.2832 * r);
        const edge = Math.min(r - R_IN[ring], R_OUT[ring] - r) + 0.5;
        if (local > gap && local < 1 - gap) {
          const hit = p.hits[ring * MAX_STEPS + s];
          const env = p.env[ring * MAX_STEPS + s];
          const here = s === Math.floor(hand * n);
          const soft = Math.max(0, Math.min(1, edge));
          let v = 0;
          let white = 0;
          if (hit) {
            v = Math.max(0.3 + 0.7 * env, here ? 0.5 : 0) * soft;
            white = env * env * 0.55;
          } else if (Math.abs(r - mid) < 1) {
            // A rest is a thin line, lit up while the hand is on it.
            v = here ? 0.5 : 0.16;
          }
          const c = p.col[ring];
          R = (c[0] * (1 - white) + 255 * white) * v;
          G = (c[1] * (1 - white) + 255 * white) * v;
          B = (c[2] * (1 - white) + 255 * white) * v;
        }
      } else if (r < 5) {
        const v = 0.18 + 0.82 * p.down;
        R = 255 * v;
        G = 255 * v;
        B = 255 * v;
      } else if (r > R_OUT[0] + 1) {
        for (let q = 0; q < RIPPLES; q++) {
          const age = p.rAge[q];
          if (age >= 1) continue;
          const front = R_OUT[0] + 1 + age * 62;
          const d = Math.abs(r - front);
          if (d > 2.2) continue;
          let v = p.rPower[q] * (1 - age) * Math.sqrt(1 - age) * (1 - d / 2.2);
          const wide = p.rWide[q];
          if (wide > 0) {
            let da = Math.abs(a - p.rAngle[q]);
            if (da > 0.5) da = 1 - da;
            const span = wide * (0.8 + age * 1.4);
            if (da > span) continue;
            v *= 1 - (da / span) * (da / span);
          }
          const c = p.col[p.rRing[q]];
          R += c[0] * v;
          G += c[1] * v;
          B += c[2] * v;
        }
      }
      // The hand: a thin spoke through the rings.
      if (r > 5 && r < R_OUT[0] + 0.5) {
        const dx = x - CX;
        const dy = y - CY;
        const along = dx * hx + dy * hy;
        const v = along > 0 ? 1 - Math.abs(dx * hy - dy * hx) / 0.9 : 0;
        if (v > 0) {
          R = Math.max(R, 170 * v);
          G = Math.max(G, 170 * v);
          B = Math.max(B, 170 * v);
        }
      }
      display.setPixel(x, y, R, G, B);
    }
  }
}
