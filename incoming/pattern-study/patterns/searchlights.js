// ===== Patternflow pattern =====
// Title:   Searchlights
// Family:  light
// Idea:    Searchlights behind a night skyline swing slow, hard-edged beams across the sky, and where two beams cross the light runs white.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the searchlights that sweep a city's sky over a premiere or a grand opening
// Round:   7
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sweep=0.2..4, Lights=3..7, Haze=0..1
//
// Knob 1: Hue. The tint of the lamps, starting from the cold blue-white of a xenon arc.
// Knob 2: Sweep. How fast the beams patrol the sky: at the bottom of the range they barely drift, at the top each one crosses its arc in about six seconds.
// Knob 3: Lights. How many searchlights stand behind the skyline; a light that joins strikes up and one that leaves fades out.
// Knob 4: Haze. How much the air holds the light: clear at 0, each beam cut sharp against the dark; turned up, the beams grow soft halos and the city glows on the low sky.
// Buttons: K1 tap sends a plane across the sky; every beam swings onto it, holds it a few seconds and lets it go.

const W = 64;
const H = 128;
const N = W * H;
const MAX = 7;
// The lamps stand at the foot of the panel, behind the buildings. Their slots
// fill in this order, so three lights are spread across the city and each one
// added lands between two that are already burning.
const SLOTS = [10, 54, 31, 21, 43, 3, 61];
const BASE = 126;
// A beam is the lamp's width at the lamp and opens by this many LEDs per LED
// it travels: three and a half degrees across, eleven LEDs wide at the top.
const LAMP = 1.5;
const SPREAD = 0.03;
// The sweep: a triangle wave with its corners rounded off, so a beam crosses
// its arc at an even pace and turns at the ends without stopping dead.
const ROUND = 0.985;
const ROUND_NORM = Math.asin(ROUND);
// The plane K1 sends, nose first: x along its heading, y down.
const PLANE = [2, 0, 1, 0, 0, 0, -1, 0, -2, 0, -3, 0, 0, -1, 0, 1, -1, 2, -3, -1];

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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

// The skyline, the same on every load: blocks of five to twelve LEDs and now
// and then a tower with a mast. Each block has a grid of one-LED windows, a
// light of its own (lamplight, paler office light, a bluish tube) and its own
// share of windows lit.
const WINDOW_LIGHT = [
  [0.09, 0.6],
  [0.12, 0.35],
  [0.55, 0.25],
];

function buildCity(P) {
  const roof = P.roof;
  roof.fill(H);
  P.winOn.fill(0);
  P.winCol.fill(0);
  const slots = [];
  const masts = [];
  let x = 0;
  let b = 0;
  while (x < W) {
    const w = 5 + Math.floor(hash(b, 1) * 8);
    const tower = b > 0 && hash(b, 2) < 0.22;
    const top = tower ? 84 + Math.floor(hash(b, 3) * 10) : 100 + Math.floor(hash(b, 3) * 15);
    const x1 = Math.min(W, x + w);
    for (let c = x; c < x1; c++) roof[c] = top;
    if (tower) {
      const m = x + (w >> 1);
      if (m < W) {
        roof[m] = top - 6;
        masts.push((top - 6) * W + m);
      }
    }
    const [hue, sat] = WINDOW_LIGHT[Math.floor(hash(b, 4) * WINDOW_LIGHT.length)];
    const lit = 0.3 + 0.45 * hash(b, 5);
    for (let y = top + 2; y < H; y += 2) {
      for (let c = x + 1; c < x1 - 1; c += 2) {
        const p = y * W + c;
        slots.push(p);
        hsvInto(P.winCol, p * 3, hue, sat, 0.62 + 0.3 * hash(c, y));
        if (hash(c * 131 + y, b + 7) < lit) P.winOn[p] = 1;
      }
    }
    x = x1;
    b++;
  }
  P.slots = Int32Array.from(slots);
  P.masts = Int32Array.from(masts);
  // Stars: a few dozen, never brighter than a dim window.
  P.stars.fill(0);
  for (let i = 0; i < 34; i++) {
    const sx = Math.floor(hash(i, 11) * W);
    const sy = Math.floor(hash(i, 12) * 84);
    P.stars[sy * W + sx] = 0.22 + 0.16 * hash(i, 13);
  }
}

export function setup(params) {
  const P = params;
  P.roof = new Int16Array(W);
  P.winOn = new Float32Array(N);
  P.winCol = new Float32Array(N * 3);
  P.stars = new Float32Array(N);
  P.phase = new Float32Array(MAX);
  P.rate = new Float32Array(MAX);
  P.amp = new Float32Array(MAX);
  P.centre = new Float32Array(MAX);
  P.on = new Float32Array(MAX);
  P.angle = new Float32Array(MAX);
  P.light = new Float32Array(N);
  P.halo = new Float32Array(N);
  P.col = new Float32Array(6);
  // Where each lamp's sweep begins: four seconds in, the first three beams
  // cross over the city, and from two seconds to eight every one of them is
  // crossing its arc rather than turning at an end.
  const start = [-0.27, -1.4, 2.85, 2.55, 0.15, -1.1, 2.0];
  for (let i = 0; i < MAX; i++) {
    const x = SLOTS[i];
    P.phase[i] = start[i];
    P.rate[i] = 0.85 + 0.3 * hash(i, 21);
    P.amp[i] = 0.32 + 0.08 * hash(i, 22);
    // Lamps on the left lean right and the other way round, so the beams cross.
    P.centre[i] = ((32 - x) / 32) * 0.22 + (hash(i, 23) - 0.5) * 0.08;
    P.on[i] = i < 3 ? 1 : 0;
  }
  P.count = 3;
  P.sweep = 2;
  P.hue = 0;
  P.haze = 0.06;
  // The plane K1 sends: seconds since it was sent, or -1.
  P.plane = -1;
  P.px = 0;
  P.py = 0;
  P.pvx = 0;
  P.t = 0;
  P.flick = 0;
  buildCity(P);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 3, 0.06];
  dt = Math.min(dt, 0.1);
  P.hue = k[0];
  P.sweep = Math.max(0.2, Math.min(4, k[1]));
  P.count = Math.max(3, Math.min(MAX, Math.round(k[2])));
  P.haze = Math.max(0, Math.min(1, k[3]));

  if (input.btnPressed && input.btnPressed[0]) {
    P.plane = 0;
    const fromLeft = Math.random() < 0.5;
    P.px = fromLeft ? 6 : W - 6;
    P.py = 16 + Math.random() * 26;
    P.pvx = (fromLeft ? 1 : -1) * (5 + Math.random() * 3);
  }
  if (P.plane >= 0) {
    P.plane += dt;
    P.px += P.pvx * dt;
    if (P.plane > 7) P.plane = -1;
  }
  // How hard the beams hold the plane: they swing on over a second, hold it,
  // and let go over a second and a half.
  const hold = P.plane >= 0 ? smooth(0, 1.2, P.plane) * (1 - smooth(5, 6.5, P.plane)) : 0;

  // Sweep 2 crosses an arc at about two and a half degrees a second; the
  // knob's top end is three times that, its bottom end nearly still.
  const speed = 0.17 * Math.pow(P.sweep / 2, 1.6);
  for (let i = 0; i < MAX; i++) {
    const target = i < P.count ? 1 : 0;
    // A lamp strikes up in half a second and fades out in one.
    P.on[i] += (target - P.on[i]) * Math.min(1, dt * (target ? 4 : 2.5));
    P.phase[i] += dt * speed * P.rate[i];
    const sweep = P.centre[i] + P.amp[i] * (Math.asin(ROUND * Math.sin(P.phase[i])) / ROUND_NORM);
    const aim = Math.atan2(P.px - SLOTS[i], BASE - P.py);
    P.angle[i] = sweep + (aim - sweep) * hold;
  }
  P.hold = hold;

  // Now and then someone in the city switches a light on or off.
  P.t += dt;
  P.flick += dt;
  if (P.flick > 0.8) {
    P.flick = 0;
    const p = P.slots[Math.floor(Math.random() * P.slots.length)];
    P.winOn[p] = P.winOn[p] > 0 ? 0 : 1;
  }
}

export function draw(display, params, time) {
  const P = params;
  const light = P.light;
  const halo = P.halo;
  const roof = P.roof;
  const haze = P.haze;
  light.fill(0);
  halo.fill(0);

  // The beams. Each LED takes the share of it the beam covers, rounded to
  // thirds: a beam glides across the LEDs without a soft ramp at its edge.
  const reach = 1.5 + 5 * haze;
  const out = 1 + reach * 4;
  for (let i = 0; i < MAX; i++) {
    const on = P.on[i];
    if (on < 0.01) continue;
    const a = P.angle[i];
    const sa = Math.sin(a);
    const ca = Math.cos(a);
    const bx = SLOTS[i] + 0.5;
    for (let y = 0; y < BASE; y++) {
      const dy = y + 0.5 - BASE;
      // Where the beam's middle crosses this row, and how wide it is there.
      const s0 = -dy / ca;
      if (s0 <= 0) continue;
      const mid = bx + s0 * sa;
      const half = (LAMP + s0 * SPREAD) / ca;
      const x0 = Math.max(0, Math.floor(mid - half - out));
      const x1 = Math.min(W - 1, Math.ceil(mid + half + out));
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - bx;
        const s = dx * sa - dy * ca;
        if (s <= 0) continue;
        const q = Math.abs(dx * ca + dy * sa);
        const h = LAMP + s * SPREAD;
        // Bright at the lamp, still well lit at the top of the panel.
        const b = on * (0.8 + 0.2 * Math.exp(-s / 40) - 0.25 * haze * (1 - Math.exp(-s / 60)));
        const cover = Math.max(0, Math.min(1, h - q + 0.5));
        const p = y * W + x;
        if (cover > 0) light[p] += b * (Math.round(cover * 3) / 3);
        if (q > h - 0.5) halo[p] += b * Math.exp(-(q - h + 0.5) / reach);
      }
    }
  }

  const col = P.col;
  hsvInto(col, 0, P.hue + 0.58, 0.38, 1);
  // The city's glow on a hazy night: sodium orange whatever the lamps are.
  hsvInto(col, 3, 0.08, 0.7, 1);
  const glowAmp = 0.22 * haze;
  const haloAmp = 0.32 * haze;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let r;
      let g;
      let b;
      if (y >= roof[x]) {
        // Windows keep their own light whatever the lamps are; the rest of a building is black.
        const w = P.winOn[p];
        r = w * P.winCol[p * 3];
        g = w * P.winCol[p * 3 + 1];
        b = w * P.winCol[p * 3 + 2];
      } else {
        const L = light[p] + haloAmp * halo[p] + P.stars[p];
        const glow = glowAmp * Math.exp(-(roof[x] - y) / 18);
        r = L * col[0] + glow * col[3];
        g = L * col[1] + glow * col[4];
        b = L * col[2] + glow * col[5];
      }
      display.setPixel(x, y, Math.min(255, r), Math.min(255, g), Math.min(255, b));
    }
  }

  // The warning lamp on each mast, red whatever the searchlights are.
  if (P.t % 1.6 < 0.5) {
    for (let i = 0; i < P.masts.length; i++) {
      const p = P.masts[i];
      display.setPixel(p % W, Math.floor(p / W), 230, 30, 20);
    }
  }

  // The plane: a dark shape that only shows against the beams, and a strobe
  // on its tail that blinks once a second.
  if (P.plane >= 0) {
    const cx = Math.round(P.px);
    const cy = Math.round(P.py);
    const dir = P.pvx > 0 ? 1 : -1;
    for (let i = 0; i < PLANE.length; i += 2) {
      const x = cx + dir * PLANE[i];
      const y = cy + PLANE[i + 1];
      if (x >= 0 && x < W && y >= 0 && y < H) display.setPixel(x, y, 10, 10, 14);
    }
    const tx = cx - 3 * dir;
    if (P.plane % 1 < 0.12 && tx >= 0 && tx < W && cy - 1 >= 0) display.setPixel(tx, cy - 1, 255, 255, 255);
  }
}
