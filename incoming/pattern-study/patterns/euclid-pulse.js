// ===== Patternflow pattern =====
// Title:   Euclid Pulse
// Family:  rhythm
// Idea:    Spread a few beats as evenly as they will go over a ring of steps and a good many of the world's drum patterns fall out, so the panel plays three of them at once.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tempo=80..180, Pulses=3..13, Steps=8..16
//
// Knob 1: Hue. Turns the three rings around the colour wheel together.
// Knob 2: Tempo. Beats per minute; the hand goes round once every four beats.
// Knob 3: Pulses. Hits on the outer ring; the middle ring takes about half as many.
// Knob 4: Steps. Steps on the outer ring; the middle ring has three for every four of them. Each outer step owns a slice of the panel and a hit fires a beam down it, so more steps make narrower beams.
// Buttons: K3 tap turns the outer rhythm one step later.

const W = 64;
const H = 128;
const CX = 31.5;
const CY = 63.5;
const MAX_STEPS = 32;
const RIPPLES = 24;

// Ring bands in LEDs from the centre: outer, middle, inner. The outer ring
// stops three LEDs short of the panel's sides so a ripple can be seen leaving it.
const R_IN = [23, 15.5, 8.5];
const R_OUT = [28.5, 20, 12];
// Beams start just outside the outer ring. The far corners are 71 LEDs out.
const BEAM_FROM = R_OUT[0] + 1.5;
// A hit rings out as four arcs, one every 0.09 s, each a little dimmer,
// running out at 64 LEDs a second: five or six LEDs apart.
const ARCS = 4;
const ARC_GAP = 0.09;
const ARC_SPEED = 64;
const BEND = 0.75;
// The outer ring's beams and the middle ring's, which are a little dimmer so
// the outer rhythm leads.
const FLASH = [0.4, 0.3];
const GLOW = [0.34, 0.24];
const ARC_POWER = [1, 0.7];

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

// How brightly a ring's slice s lights a point r LEDs out, with the share of
// it that is white left in p.white. A hit rings out as a burst of arcs, and
// the slice fills in behind the first: a flash that settles to a glow and
// dims through the next three beats. A rest on the outer ring sends one dim
// arc, so the panel ticks out every step as the hand reaches it.
function beam(p, ring, s, r) {
  const at = ring * MAX_STEPS + s;
  const since = p.beam[at];
  const age = since / p.life;
  let v = 0;
  p.white = 0;
  if (ring === 0 && !p.hits[at] && p.pass[s] < 1) {
    const front = BEAM_FROM + ARC_SPEED * p.pass[s];
    const d = Math.abs(r - front);
    if (d < 1.4) v = 0.45 * (1 - d / 1.4) * Math.max(0.25, 1 - (front - BEAM_FROM) / 60);
  }
  if (age < 1) {
    if (r < BEAM_FROM + ARC_SPEED * since) v = Math.max(v, FLASH[ring] * Math.exp(-6 * since) + GLOW[ring] * Math.pow(1 - age, 1.3));
    for (let k = 0; k < ARCS; k++) {
      const front = BEAM_FROM + ARC_SPEED * (since - k * ARC_GAP);
      const d = Math.abs(r - front);
      if (front < BEAM_FROM - 1 || d > 1.4) continue;
      const arc = ARC_POWER[ring] * (1 - d / 1.4) * Math.pow(0.78, k) * Math.max(0.25, 1 - (front - BEAM_FROM) / 60);
      if (arc > v) {
        v = arc;
        p.white = k === 0 ? arc * 0.45 : 0;
      }
    }
  }
  return v;
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
  // Seconds since each step of the outer two rings last hit, and since the
  // hand last reached each outer step.
  p.beam = new Float32Array(2 * MAX_STEPS).fill(99);
  p.pass = new Float32Array(MAX_STEPS).fill(99);
  p.white = 0;
  p.rAge = new Float32Array(RIPPLES).fill(1);
  p.rRing = new Uint8Array(RIPPLES);
  p.rPower = new Float32Array(RIPPLES);
  p.rAngle = new Float32Array(RIPPLES);
  p.rAim = new Float32Array(RIPPLES);
  p.rWide = new Float32Array(RIPPLES);
  p.dist = new Float32Array(W * H);
  p.turn = new Float32Array(W * H);
  p.slice = new Float32Array(W * H);
  p.across = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const dx = x - CX;
      const dy = y - CY;
      const r = Math.hypot(dx, dy);
      p.dist[i] = r;
      // 0 at twelve o'clock, growing clockwise.
      let a = Math.atan2(dx, -dy) / 6.2832;
      if (a < 0) a += 1;
      p.turn[i] = a;
      // Outside the rings the slices bend toward twelve and six as they go
      // out, the way the arcs do: a slice that leaves at three o'clock would
      // reach the side of the panel in three LEDs. The bend squeezes the turn
      // around the sides and stretches it above and below, so every slice
      // keeps a share of the open space. across turns a fraction of a slice
      // into LEDs at this radius.
      const u = Math.max(0, Math.min(1, (r - BEAM_FROM) / 24));
      const bend = BEND * u * u * (3 - 2 * u);
      const w = a + (bend * Math.sin(12.566 * a)) / 12.566;
      p.slice[i] = w - Math.floor(w);
      p.across[i] = (6.2832 * r) / (1 + bend * Math.cos(12.566 * a));
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
  // A slice glows for three beats after its hit, so the beams of a bar are
  // still there, fading, as the next one leaves.
  p.life = 180 / p.bpm;
  for (let i = 0; i < 2 * MAX_STEPS; i++) p.beam[i] = Math.min(99, p.beam[i] + dt);
  for (let s = 0; s < MAX_STEPS; s++) p.pass[s] = Math.min(99, p.pass[s] + dt);
  for (let ring = 0; ring < 3; ring++) {
    const n = p.n[ring];
    const step = Math.floor(p.hand * n);
    if (step !== p.last[ring]) {
      p.last[ring] = step;
      if (ring === 0) p.pass[step] = 0;
      if (p.hits[ring * MAX_STEPS + step]) {
        p.env[ring * MAX_STEPS + step] = 1;
        if (ring < 2) p.beam[ring * MAX_STEPS + step] = 0;
        else if (step === 0) {
          p.down = 1;
          spawn(p, 2, 0.8, 0, 0);
        } else spawn(p, 2, 0.6, (step + 0.5) / n, 0.2);
      }
    }
  }
  for (let i = 0; i < RIPPLES; i++) {
    p.rAge[i] = Math.min(1, p.rAge[i] + dt / 1.4);
    // The panel stands, so the open space is above and below the rings. An
    // arc leaves facing its step and bends toward the nearer of the two as it
    // goes; one sent straight sideways would be off the panel at once.
    const a = p.rAngle[i];
    const to = a < 0.25 ? a * 0.4 : a < 0.5 ? 0.5 - (0.5 - a) * 0.4 : a < 0.75 ? 0.5 + (a - 0.5) * 0.4 : 1 - (1 - a) * 0.4;
    p.rAim[i] = a + (to - a) * Math.min(1, p.rAge[i] * 2.5);
  }
}

export function draw(display, params, time) {
  const p = params;
  // Hue 0 opens on an azure outer ring, a pink middle and a gold centre.
  hsv(p.hue + 0.55, 0.85, 1, p.col[0]);
  hsv(p.hue + 0.88, 0.7, 1, p.col[1]);
  hsv(p.hue + 0.15, 0.7, 1, p.col[2]);
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
        // A gap of about one LED between neighbouring steps.
        const gap = (0.6 * n) / (6.2832 * r);
        const edge = Math.min(r - R_IN[ring], R_OUT[ring] - r) + 0.5;
        if (local > gap && local < 1 - gap) {
          const hit = p.hits[ring * MAX_STEPS + s];
          const env = p.env[ring * MAX_STEPS + s];
          const here = s === Math.floor(hand * n);
          const soft = Math.max(0, Math.min(1, edge));
          let v;
          let white = 0;
          if (hit) {
            v = Math.max(0.5 + 0.5 * env, here ? 0.7 : 0) * soft;
            white = env * env * 0.55;
          } else {
            // A rest is a dim cell, so the steps can be counted between hits.
            v = (here ? 0.4 : 0.12) * soft;
          }
          const c = p.col[ring];
          R = (c[0] * (1 - white) + 255 * white) * v;
          G = (c[1] * (1 - white) + 255 * white) * v;
          B = (c[2] * (1 - white) + 255 * white) * v;
        }
      } else if (r < 5) {
        const v = 0.18 + 0.82 * p.down;
        const c = p.col[2];
        R = c[0] * v + (255 - c[0]) * v * p.down;
        G = c[1] * v + (255 - c[1]) * v * p.down;
        B = c[2] * v + (255 - c[2]) * v * p.down;
      } else if (r > R_OUT[0] + 1) {
        // Outside the rings each step of the outer two owns a slice of the
        // panel, the middle ring's three for every four of the outer's, and
        // a hit sends a beam out along its slice. Where beams of the two
        // overlap their colours add.
        for (let j = 0; j < 2; j++) {
          const n = p.n[j];
          const pos = p.slice[i] * n;
          const s = Math.floor(pos);
          // A slice with nothing in it is dark.
          if (p.beam[j * MAX_STEPS + s] >= p.life && (j > 0 || p.pass[s] >= 1)) continue;
          const local = pos - s;
          // LEDs to the nearer side of the slice, with a dark LED between slices.
          const soft = Math.max(0, Math.min(1, (Math.min(local, 1 - local) * p.across[i]) / n - 0.6));
          if (soft <= 0) continue;
          const v = beam(p, j, s, r) * soft;
          if (v <= 0) continue;
          const white = p.white;
          const c = p.col[j];
          R += (c[0] * (1 - white) + 255 * white) * v;
          G += (c[1] * (1 - white) + 255 * white) * v;
          B += (c[2] * (1 - white) + 255 * white) * v;
        }
        for (let q = 0; q < RIPPLES; q++) {
          const age = p.rAge[q];
          if (age >= 1) continue;
          const front = R_OUT[0] + 1 + age * 62;
          const d = Math.abs(r - front);
          if (d > 2.2) continue;
          let v = p.rPower[q] * (1 - age) * Math.sqrt(1 - age) * (1 - d / 2.2);
          const wide = p.rWide[q];
          if (wide > 0) {
            let da = Math.abs(a - p.rAim[q]);
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
      display.setPixel(x, y, Math.min(255, R), Math.min(255, G), Math.min(255, B));
    }
  }
}
