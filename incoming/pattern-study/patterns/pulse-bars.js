// ===== Patternflow pattern =====
// Title:   Pulse Bars
// Family:  rhythm
// Idea:    A hi-fi meter with no music behind it: a small drum machine plays to itself and the bars dance as if they were hearing it.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 128x64
// @knobs Hue=0..1, Tempo=90..180, Bars=16..48, Decay=0..1
//
// Knob 1: Hue. Where the colour starts at the bass end; it climbs a third of the wheel to the treble end.
// Knob 2: Tempo. Beats per minute of the drum machine, with sixteenth-note hats.
// Knob 3: Bars. How many bands the meter splits into, from sixteen fat ones to a fine comb.
// Knob 4: Decay. How long each hit rings; low is tight and punchy, high swells and hangs.
// Buttons: K1 tap grows the bars from the middle line both ways instead of from the floor.

const W = 128;
const H = 64;
const MAX_BARS = 48;

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

function hash(n) {
  let x = (Math.imul(n | 0, 374761393) + 668265263) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function band(f, centre, width) {
  const d = (f - centre) / width;
  return Math.exp(-d * d);
}

// One sixteenth of the drum machine. The bar number seeds small changes,
// so no two bars play quite the same groove.
function play(p, bar, step) {
  const seed = bar * 16 + step;
  let kick = step === 0 ? 1 : 0;
  if (step === 8 && hash(seed + 101) < 0.85) kick = 1;
  if ((step === 3 || step === 6 || step === 10 || step === 11 || step === 14) && hash(seed + 202) < 0.22) kick = 0.8;
  let snare = step === 4 || step === 12 ? 1 : 0;
  if ((step === 7 || step === 9 || step === 15) && hash(seed + 303) < 0.18) snare = 0.45;
  if (bar % 4 === 3 && step >= 13 && hash(seed + 404) < 0.7) snare = 0.75;
  let open = (step === 6 || step === 14) && hash(seed + 505) < 0.3 ? 1 : 0;
  let hat = open ? 0 : step % 4 === 2 ? 1 : step % 2 === 0 ? 0.75 : hash(seed + 606) < 0.5 ? 0.5 : 0;
  if (kick) p.env[0] = kick;
  if (snare) p.env[1] = snare;
  if (hat) p.env[2] = hat;
  if (open) p.env[3] = open;
  // A bass note on every eighth, stepping between a few low bands.
  if (step % 2 === 0) {
    p.env[4] = 0.85;
    p.bassAt = 0.06 + 0.12 * Math.floor(hash(bar * 8 + (step >> 1) + 707) * 4) / 3;
  }
  // Every hit gives each band its own small loudness, so the comb is never flat.
  for (let i = 0; i < MAX_BARS; i++) p.jitter[i] = 0.72 + 0.56 * hash(seed * 64 + i);
}

export function setup(params) {
  const p = params;
  p.beats = 0;
  p.step = -1;
  p.mirror = false;
  p.env = new Float32Array(5);
  p.bassAt = 0.1;
  p.jitter = new Float32Array(MAX_BARS).fill(1);
  p.level = new Float32Array(MAX_BARS);
  p.peak = new Float32Array(MAX_BARS);
  p.hold = new Float32Array(MAX_BARS);
  p.fall = new Float32Array(MAX_BARS);
  p.cap = [0, 0, 0];
}

export function update(dt, input, params) {
  const p = params;
  const k = input.knobValues || [0, 90, 16, 0.06];
  p.hue = k[0];
  p.bpm = k[1];
  p.bars = Math.round(k[2]);
  const decay = k[3];
  if (input.btnPressed && input.btnPressed[0]) p.mirror = !p.mirror;

  p.beats += (dt * p.bpm) / 60;
  const sixteenth = Math.floor(p.beats * 4);
  if (sixteenth !== p.step) {
    p.step = sixteenth;
    play(p, Math.floor(sixteenth / 16), sixteenth % 16);
  }
  // Time constants in seconds for kick, snare, closed hat, open hat and bass.
  p.env[0] *= Math.exp(-dt / (0.17 + 0.6 * decay));
  p.env[1] *= Math.exp(-dt / (0.12 + 0.5 * decay));
  p.env[2] *= Math.exp(-dt / (0.05 + 0.22 * decay));
  p.env[3] *= Math.exp(-dt / (0.25 + 0.5 * decay));
  p.env[4] *= Math.exp(-dt / (0.14 + 0.4 * decay));

  const n = p.bars;
  const e = p.env;
  for (let i = 0; i < n; i++) {
    const f = n > 1 ? i / (n - 1) : 0;
    // The kick's weight slides down the low bands as it dies, like its pitch.
    let sum = e[0] * 1.15 * band(f, 0.03 + 0.12 * e[0], 0.17);
    sum += e[1] * (0.75 * band(f, 0.42, 0.2) + 0.3 * band(f, 0.7, 0.3));
    sum += e[2] * 0.7 * band(f, 0.86, 0.13);
    sum += e[3] * 0.75 * band(f, 0.78, 0.2);
    // A pad under everything that ducks when the kick lands, and the bass note.
    const duck = 1 - 0.65 * e[0];
    const pad = 0.2 * (1 - 0.45 * f) * (0.75 + 0.25 * Math.sin(p.beats * 0.785 + f * 6));
    sum += duck * (pad + e[4] * 0.45 * band(f, p.bassAt, 0.08));
    sum += 0.03 + 0.04 * hash(p.step * 97 + i);
    const target = (1 - Math.exp(-sum * p.jitter[i] * 1.7)) * 0.98;
    const lv = p.level[i];
    p.level[i] = target > lv ? lv + (target - lv) * Math.min(1, dt * 45) : target;
    if (p.level[i] >= p.peak[i]) {
      p.peak[i] = p.level[i];
      p.hold[i] = 0.25;
      p.fall[i] = 0;
    } else if (p.hold[i] > 0) {
      p.hold[i] -= dt;
    } else {
      p.fall[i] += dt * 1.5;
      p.peak[i] = Math.max(p.level[i], p.peak[i] - p.fall[i] * dt);
    }
  }
}

export function draw(display, params, time) {
  const p = params;
  const n = p.bars;
  const gap = n <= 24 ? 2 : 1;
  const mirror = p.mirror;
  // Rows from the floor (or from the middle line), in segments of two LEDs and a gap.
  const reach = mirror ? 32 : H;
  // At 0 the bass end starts in blue.
  const hue = p.hue + 0.64;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const x0 = Math.floor((i * W) / n);
    const x1 = Math.floor(((i + 1) * W) / n) - gap;
    const f = n > 1 ? i / (n - 1) : 0;
    const top = Math.floor(p.level[i] * reach);
    const peak = Math.floor(p.peak[i] * reach / 3) * 3;
    for (let lv = 0; lv < reach; lv++) {
      if (lv % 3 === 2) continue;
      const lit = lv < top;
      const isPeak = lv >= peak && lv < peak + 2 && peak > 2;
      if (!lit && !isPeak) continue;
      const u = lv / reach;
      if (isPeak && !lit) {
        hsv(hue + f * 0.33 + 0.06, 0.35, 1, p.cap);
      } else {
        hsv(hue + f * 0.33 + u * 0.08, 0.95 - u * 0.2, 0.45 + 0.55 * u, p.cap);
      }
      const c = p.cap;
      for (let x = x0; x < x1; x++) {
        if (mirror) {
          display.setPixel(x, 31 - lv, c[0], c[1], c[2]);
          display.setPixel(x, 32 + lv, c[0], c[1], c[2]);
        } else {
          display.setPixel(x, H - 1 - lv, c[0], c[1], c[2]);
        }
      }
    }
  }
}
