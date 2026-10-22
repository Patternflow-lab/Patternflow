// ===== Patternflow pattern =====
// Title:   Test Card
// Family:  glitch
// Idea:    A television's colour bars, as a set that is losing its hold would show them.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 128x64
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

function hash(a, b) {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function turn(c, hue) {
  // Rotate an RGB colour round the grey axis.
  const a = hue * Math.PI * 2;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const k = (1 - cos) / 3;
  const s3 = Math.sqrt(1 / 3) * sin;
  const r = c[0] * (cos + k) + c[1] * (k - s3) + c[2] * (k + s3);
  const g = c[0] * (k + s3) + c[1] * (cos + k) + c[2] * (k - s3);
  const b = c[0] * (k - s3) + c[1] * (k + s3) + c[2] * (cos + k);
  return [r, g, b];
}

export function setup(params) {
  params.t = 0;
  params.tear = 0;
  params.slot = -1;
  params.seed = 0;
  params.roll = 0;
  params.palette = BARS.map((c) => c.slice());
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
  // The roll eases up to speed and back, like a hold that drifts.
  params.roll += dt * params.rollAmount * params.rollAmount * 90;
  params.palette = BARS.map((c) => turn(c, k[0]));
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  // Damage sets how hard a burst tears, and past the middle the card never
  // quite settles.
  const tear = Math.max(params.tear * (0.35 + 0.65 * params.damage), Math.max(0, params.damage - 0.45) * 0.5);
  const seed = params.seed;
  const bands = 6 + Math.floor(params.damage * 10);
  const split = Math.round(tear * 6);
  const hold = params.rollAmount > 0.02 ? params.roll : 0;
  for (let y = 0; y < h; y++) {
    // Torn bands slide sideways; a quiet card still twitches a line now and then.
    const band = Math.floor((y / h) * bands);
    const kick = hash(seed, band) < tear * 1.4 ? (hash(seed + 1, band) - 0.5) * 70 * tear : 0;
    const twitch = hash(Math.floor(params.t * 24), y) < 0.012 + params.damage * 0.02 ? (hash(y, params.t) - 0.5) * 6 : 0;
    const shift = Math.round(kick + twitch);
    const sy = Math.floor(y + hold) % (h + 6);
    for (let x = 0; x < w; x++) {
      if (sy >= h) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const sample = (sx) => {
        const xx = ((sx % w) + w) % w;
        if (sy < h * 0.72) return params.palette[Math.floor((xx / w) * 7)];
        if (sy < h * 0.8) {
          const i = 6 - Math.floor((xx / w) * 7);
          return i % 2 === 0 ? params.palette[i] : [10, 10, 10];
        }
        // A grey ramp along the foot of the card.
        const g = Math.floor((xx / w) * 6) * 40 + 20;
        return [g, g, g];
      };
      const base = x - shift;
      const r = sample(base - split)[0];
      const g = sample(base)[1];
      const b = sample(base + split)[2];
      // Scanlines dim every other row a touch, more when the picture tears.
      const dim = y & 1 ? 1 - 0.18 - tear * 0.3 : 1;
      const snow = hash(x + y * 131, Math.floor(params.t * 30)) < tear * 0.25 ? 120 : 0;
      display.setPixel(x, y, r * dim + snow, g * dim + snow, b * dim + snow);
    }
  }
}
