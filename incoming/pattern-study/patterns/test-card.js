// ===== Patternflow pattern =====
// Title:   Test Card
// Family:  glitch
// Idea:    A television's colour bars, as a set that is losing its hold would show them.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Bursts=0.2..6, Damage=0.15..1, Roll=0..1
//
// Knob 1: Hue. Turns the whole set of bars round the colour wheel.
// Knob 2: Bursts. How often the picture tears.
// Knob 3: Damage. From a clean card with the odd twitch to bars torn apart and smeared.
// Knob 4: Roll. The vertical hold: the picture starts to slip and roll.
// Buttons: K1 tap tears the picture now.

const BARS = [
  [235, 235, 235],
  [235, 235, 16],
  [16, 235, 235],
  [16, 235, 16],
  [235, 16, 235],
  [235, 16, 16],
  [16, 16, 235],
];
// The bottom row of the broadcast card: -I blue, white, +Q purple, then black.
const FOOT = [
  [16, 60, 120],
  [235, 235, 235],
  [72, 16, 130],
];

// The card stands as tall as the panel: bars, the reversed strip under them,
// a grey ramp, and the broadcast card's bottom row, as shares of the height.
const BARS_END = 0.6;
const STRIP_END = 0.68;
const RAMP_END = 0.84;

function hash(a, b) {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function turn(c, hue, out, o) {
  // Rotate an RGB colour round the grey axis.
  const a = hue * Math.PI * 2;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const k = (1 - cos) / 3;
  const s3 = Math.sqrt(1 / 3) * sin;
  out[o] = c[0] * (cos + k) + c[1] * (k - s3) + c[2] * (k + s3);
  out[o + 1] = c[0] * (k + s3) + c[1] * (cos + k) + c[2] * (k - s3);
  out[o + 2] = c[0] * (k - s3) + c[1] * (k + s3) + c[2] * (cos + k);
}

// One channel of the clean card at column xx of a row in the given part.
function channel(p, part, xx, w, c) {
  const pal = p.palette;
  if (part === 0) return pal[Math.floor((xx / w) * 7) * 3 + c];
  if (part === 1) {
    const i = 6 - Math.floor((xx / w) * 7);
    return i % 2 === 0 ? pal[i * 3 + c] : 10;
  }
  if (part === 2) return Math.floor((xx / w) * 6) * 40 + 20;
  const f = (xx / w) * 7;
  if (f < 3.75) return p.foot[Math.floor(f / 1.25) * 3 + c];
  return 10;
}

export function setup(params) {
  params.t = 0;
  params.tear = 0;
  params.slot = -1;
  params.seed = 0;
  params.roll = 0;
  params.hue = -1;
  params.palette = new Float32Array(7 * 3);
  params.foot = new Float32Array(3 * 3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0.15, 0.06];
  params.damage = k[2];
  params.rollAmount = k[3];
  params.t += dt;
  const slot = Math.floor(params.t * k[1]);
  if (slot !== params.slot) {
    params.slot = slot;
    if (hash(slot, 3.1) < 0.7) {
      params.tear = 0.25 + hash(slot, 7.7) * 0.5;
      params.seed = slot;
    }
  }
  if (input.btnPressed && input.btnPressed[0]) {
    params.tear = 0.9;
    params.seed = params.slot + 1000 + Math.floor(params.t * 10);
  }
  params.tear = Math.max(0, params.tear - dt * 1.1);
  // The roll eases up to speed and back, like a hold that drifts. It turns
  // the picture over about as often a second as it did lying down.
  params.roll += dt * params.rollAmount * params.rollAmount * 180;
  if (k[0] !== params.hue) {
    params.hue = k[0];
    for (let i = 0; i < 7; i++) turn(BARS[i], k[0], params.palette, i * 3);
    for (let i = 0; i < 3; i++) turn(FOOT[i], k[0], params.foot, i * 3);
  }
}

export function draw(display, params, time) {
  const p = params;
  const w = display.width;
  const h = display.height;
  // Damage sets how hard a burst tears, and past the middle the card never
  // quite settles.
  const tear = Math.max(p.tear * (0.35 + 0.65 * p.damage), Math.max(0, p.damage - 0.45) * 0.5);
  const seed = p.seed;
  // Torn bands keep the height in LEDs they had on the panel lying down.
  const bands = Math.round(((6 + Math.floor(p.damage * 10)) * h) / 64);
  const split = Math.round(tear * 3);
  const blank = Math.round(h * 0.094);
  const hold = p.rollAmount > 0.02 ? p.roll : 0;
  const frame = Math.floor(p.t * 24);
  const fizz = Math.floor(p.t * 30);
  for (let y = 0; y < h; y++) {
    // Torn bands slide sideways; a quiet card still twitches a line now and then.
    const band = Math.floor((y / h) * bands);
    const kick = hash(seed, band) < tear * 1.4 ? (hash(seed + 1, band) - 0.5) * w * 0.55 * tear : 0;
    const twitch = hash(frame, y) < 0.012 + p.damage * 0.02 ? (hash(y, p.t) - 0.5) * 3 : 0;
    const shift = Math.round(kick + twitch);
    const sy = Math.floor(y + hold) % (h + blank);
    const part = sy >= h ? -1 : sy < h * BARS_END ? 0 : sy < h * STRIP_END ? 1 : sy < h * RAMP_END ? 2 : 3;
    // Scanlines dim every other row a touch, more when the picture tears.
    const dim = y & 1 ? 1 - 0.18 - tear * 0.3 : 1;
    for (let x = 0; x < w; x++) {
      if (part < 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const base = x - shift;
      const xr = (((base - split) % w) + w) % w;
      const xg = ((base % w) + w) % w;
      const xb = (((base + split) % w) + w) % w;
      const r = channel(p, part, xr, w, 0);
      const g = channel(p, part, xg, w, 1);
      const b = channel(p, part, xb, w, 2);
      const snow = hash(x + y * 131, fizz) < tear * 0.25 ? 120 : 0;
      display.setPixel(x, y, r * dim + snow, g * dim + snow, b * dim + snow);
    }
  }
}
