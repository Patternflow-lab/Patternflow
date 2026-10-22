// ===== Patternflow pattern =====
// Title:   Fire
// Family:  sim
// Idea:    The demoscene fire: heat poured in along the bottom rises a row at a time, each LED the average of the ones below it less a little cooling, and the cooling itself rides up with the flames.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 128x64
// @knobs Colour=0..1, Height=0.6..4, Wind=-1..1, Crackle=0..1
//
// Knob 1: Colour. What is burning: wood, then potassium lilac, gas blue, copper teal and boron green.
// Knob 2: Height. How far the flames climb before they cool, from low licks along the bottom to a wall that leaves the top.
// Knob 3: Wind. At 0 the flames stand up; either way they lean and the gusts come with it.
// Knob 4: Crackle. Rougher air in the flames, pops of heat in the bed, and sparks thrown up out of them, from the odd one to a shower.
// Buttons: K1 tap drops a log on, and the fire flares and throws sparks.

const W = 128;
const H = 64;
// Two rows below the panel hold the fuel.
const BH = H + 2;
const STEPS = 60;
const E = 160;
const POPS = 6;

// Heat to colour: the same nine heats for every palette, one palette per thing burning.
const HEATS = [0, 0.08, 0.18, 0.3, 0.42, 0.55, 0.7, 0.84, 1];
const PALETTES = [
  [0x000000, 0x000000, 0x3a0400, 0xa01000, 0xe83a00, 0xff7a00, 0xffb41c, 0xffe070, 0xfff6d0],
  [0x000000, 0x000000, 0x26003a, 0x6410a0, 0xa830e0, 0xd868ff, 0xf0a0ff, 0xffd0ff, 0xfff2ff],
  [0x000000, 0x000000, 0x00083a, 0x001ca0, 0x0848ff, 0x2888ff, 0x60c0ff, 0xa8e8ff, 0xf0fcff],
  [0x000000, 0x000000, 0x002428, 0x006070, 0x00a0a8, 0x10d8c8, 0x60f8e0, 0xb0fff0, 0xf2fffc],
  [0x000000, 0x000000, 0x002a06, 0x00701a, 0x08b030, 0x40e840, 0x98ff60, 0xd0ffa0, 0xf6fff0],
];

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smooth value noise over x and time.
function noise(x, t) {
  const ix = Math.floor(x);
  const it = Math.floor(t);
  const fx = x - ix;
  const ft = t - it;
  const ux = fx * fx * (3 - 2 * fx);
  const ut = ft * ft * (3 - 2 * ft);
  const a = hash(ix, it) * (1 - ux) + hash(ix + 1, it) * ux;
  const b = hash(ix, it + 1) * (1 - ux) + hash(ix + 1, it + 1) * ux;
  return a * (1 - ut) + b * ut;
}

function buildPalette(colours) {
  const lut = new Float32Array(256 * 3);
  let s = 0;
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    while (s < HEATS.length - 2 && v > HEATS[s + 1]) s++;
    const c0 = colours[s];
    const c1 = colours[s + 1];
    const f = Math.max(0, Math.min(1, (v - HEATS[s]) / (HEATS[s + 1] - HEATS[s])));
    lut[i * 3] = ((c0 >> 16) & 255) * (1 - f) + ((c1 >> 16) & 255) * f;
    lut[i * 3 + 1] = ((c0 >> 8) & 255) * (1 - f) + ((c1 >> 8) & 255) * f;
    lut[i * 3 + 2] = (c0 & 255) * (1 - f) + (c1 & 255) * f;
  }
  return lut;
}

export function setup(params) {
  params.heat = new Float32Array(W * BH);
  params.next = new Float32Array(W * BH);
  params.cool = new Float32Array(W * BH);
  params.luts = PALETTES.map(buildPalette);
  params.lut = new Float32Array(256 * 3);
  params.lutKey = -1;
  params.ex = new Float32Array(E);
  params.ey = new Float32Array(E);
  params.evx = new Float32Array(E);
  params.evy = new Float32Array(E);
  params.eage = new Float32Array(E);
  params.elife = new Float32Array(E);
  params.enext = 0;
  params.n = 0;
  params.acc = 0;
  params.spark = 0;
  params.flare = 0;
  params.t = 0;
  params.shift = new Float32Array(BH);
  params.popX = new Float32Array(POPS);
  params.popS = new Float32Array(POPS);
  params.popClock = 0;
  params.buf = new Float32Array(W * H * 3);
}

function throwEmber(params, wind, x) {
  const i = params.enext;
  params.enext = (i + 1) % E;
  params.ex[i] = x + (Math.random() - 0.5) * 8;
  params.ey[i] = H - 4 - Math.random() * 10;
  params.evx[i] = wind * 26 + (Math.random() - 0.5) * 14;
  params.evy[i] = -(24 + Math.random() * 30);
  params.eage[i] = 0;
  params.elife[i] = 0.7 + Math.random() * 1.3;
}

function step(params, height, wind, crackle) {
  const heat = params.heat;
  const next = params.next;
  const cool = params.cool;
  const n = ++params.n;
  const T = n / STEPS;

  // A new row of cooling enters at the bottom; the rows above it moved up one with the flames.
  const row = ((BH - 1 + n) % BH) * W;
  for (let x = 0; x < W; x++) {
    const c = noise(x * 0.16, T * 3.5) * 0.6 + noise(x * 0.42 + 40, T * 8) * 0.4;
    cool[row + x] = c * c * c * 3.2 + 0.08;
  }

  // Fuel along the bottom: a slow swell of hot and less hot places, and a fast flicker on top.
  const flare = 1 + params.flare * 0.2;
  for (let x = 0; x < W; x++) {
    const bed = 0.72 + 0.28 * noise(x * 0.07, T * 0.3 + 9);
    const flick = 0.82 + 0.18 * noise(x * 0.35, T * 9);
    let pop = 0;
    for (let j = 0; j < POPS; j++) {
      if (params.popS[j] < 0.02) continue;
      const d = x - params.popX[j];
      pop += params.popS[j] * Math.exp(-d * d * 0.03);
    }
    const f = Math.min(1, 0.95 * bed * flick * flare + pop * 0.4);
    heat[(BH - 1) * W + x] = f;
    heat[(BH - 2) * W + x] = f;
  }

  // Wind leans the flames, more at the top than at the base, and gusts with its strength.
  const gust = wind * (0.65 + 0.7 * noise(T * 0.6, 3.3));
  const shift = params.shift;
  for (let y = 0; y < BH - 2; y++) {
    const up = 1 - y / BH;
    // Turbulence: a sideways shove that changes smoothly from row to row, so the tongues writhe without tearing.
    const slow = (noise(y * 0.13, T * 3.1) - 0.5) * 1.3 * (0.9 + crackle * 0.6);
    const fast = (noise(y * 0.37 + 17, T * 7.3) - 0.5) * 0.7 * (0.9 + crackle * 2.4);
    shift[y] = gust * (0.25 + 0.6 * up) + slow + fast;
  }

  const lose = 1.7 / (6 + height * 16);
  for (let y = 0; y < BH - 2; y++) {
    const below = (y + 1) * W;
    const below2 = (y + 2) * W;
    const crow = ((y + n) % BH) * W;
    const sx = shift[y];
    const i0 = Math.floor(sx);
    const f = sx - i0;
    for (let x = 0; x < W; x++) {
      // Sample the row below, moved sideways by the wind, with a soft three-tap blur.
      const b = x - i0;
      const am = heat[below + ((b - 1 + W * 4) % W)];
      const a0 = heat[below + ((b + W * 4) % W)];
      const a1 = heat[below + ((b + 1 + W * 4) % W)];
      const ap = heat[below + ((b - 2 + W * 4) % W)];
      const l = am * (1 - f) + ap * f;
      const c = a0 * (1 - f) + am * f;
      const r = a1 * (1 - f) + a0 * f;
      const d = heat[below2 + ((b + W * 4) % W)] * (1 - f) + heat[below2 + ((b - 1 + W * 4) % W)] * f;
      const v = (l + 6 * c + r) * 0.09375 + d * 0.25 - cool[crow + x] * lose;
      next[y * W + x] = v > 0 ? v : 0;
    }
  }
  for (let i = 0; i < (BH - 2) * W; i++) heat[i] = next[i];
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(dt, 0.1);
  params.t += dt;
  const height = Math.max(0.1, k[1]);
  const wind = Math.max(-1, Math.min(1, k[2]));
  const crackle = Math.max(0, Math.min(1, k[3]));

  // Colour: five palettes in a row, each held for a while before it blends into the next.
  const pos = Math.max(0, Math.min(1, k[0])) * (PALETTES.length - 1);
  if (pos !== params.lutKey) {
    params.lutKey = pos;
    const a = Math.min(PALETTES.length - 2, Math.floor(pos));
    const u = pos - a;
    const g = Math.max(0, Math.min(1, (u - 0.2) / 0.6));
    const m = g * g * (3 - 2 * g);
    const la = params.luts[a];
    const lb = params.luts[a + 1];
    for (let i = 0; i < la.length; i++) params.lut[i] = la[i] * (1 - m) + lb[i] * m;
  }

  if (input.btnPressed && input.btnPressed[0]) {
    params.flare = 1;
    for (let j = 0; j < 30; j++) throwEmber(params, wind, Math.random() * W);
  }
  params.flare = Math.max(0, params.flare - dt * 0.6);

  params.acc += dt * STEPS;
  let steps = Math.floor(params.acc);
  params.acc -= steps;
  if (steps > 6) steps = 6;
  // A pop: a knot in the wood bursts, a hot spot flares in the bed and spits a handful of sparks.
  params.popClock += dt * crackle * crackle * 4;
  for (let j = 0; j < POPS; j++) params.popS[j] *= Math.exp(-dt * 4);
  while (params.popClock >= 1) {
    params.popClock -= 1;
    let j = 0;
    for (let m = 1; m < POPS; m++) if (params.popS[m] < params.popS[j]) j = m;
    params.popX[j] = 6 + Math.random() * (W - 12);
    params.popS[j] = 1;
    const n = 4 + Math.floor(Math.random() * 8);
    for (let m = 0; m < n; m++) throwEmber(params, wind, params.popX[j]);
  }
  for (let s = 0; s < steps; s++) step(params, height + params.flare * 1.2, wind, crackle);

  params.spark += dt * (crackle * crackle * 40 + crackle * 6);
  while (params.spark >= 1) {
    params.spark -= 1;
    throwEmber(params, wind, Math.random() * W);
  }
  const t = params.t;
  for (let i = 0; i < E; i++) {
    if (params.eage[i] >= params.elife[i]) continue;
    params.eage[i] += dt;
    // Sparks ride the hot air: they wander, slow as they cool, and drift with the wind.
    params.evx[i] += ((Math.sin(t * 7 + i * 1.7) * 30) + (wind * 26 - params.evx[i]) * 1.2) * dt;
    params.evy[i] += (-params.evy[i] * 0.6 - 6) * dt;
    params.ex[i] += params.evx[i] * dt;
    params.ey[i] += params.evy[i] * dt;
    if (params.ey[i] < -2) params.eage[i] = params.elife[i];
  }
}

export function draw(display, params, time) {
  const heat = params.heat;
  const lut = params.lut;
  const buf = params.buf;
  for (let i = 0; i < W * H; i++) {
    let v = heat[i];
    if (v > 1) v = 1;
    const c = Math.floor(v * 255) * 3;
    buf[i * 3] = lut[c];
    buf[i * 3 + 1] = lut[c + 1];
    buf[i * 3 + 2] = lut[c + 2];
  }
  for (let i = 0; i < E; i++) {
    if (params.eage[i] >= params.elife[i]) continue;
    const life = 1 - params.eage[i] / params.elife[i];
    // An ember is drawn with the palette as it cools: white-hot, then its own colour, then out.
    const c = Math.floor((0.35 + 0.65 * life) * 255) * 3;
    const ex = params.ex[i];
    const ey = params.ey[i];
    const x0 = Math.floor(ex - 0.5);
    const y0 = Math.floor(ey - 0.5);
    for (let yy = y0; yy <= y0 + 1; yy++) {
      if (yy < 0 || yy >= H) continue;
      const wy = 1 - Math.abs(yy + 0.5 - ey);
      for (let xx = x0; xx <= x0 + 1; xx++) {
        if (xx < 0 || xx >= W) continue;
        const w = wy * (1 - Math.abs(xx + 0.5 - ex)) * Math.min(1, life * 3);
        if (w <= 0) continue;
        const o = (yy * W + xx) * 3;
        buf[o] = Math.min(255, buf[o] + lut[c] * w);
        buf[o + 1] = Math.min(255, buf[o + 1] + lut[c + 1] * w);
        buf[o + 2] = Math.min(255, buf[o + 2] + lut[c + 2] * w);
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, buf[o], buf[o + 1], buf[o + 2]);
    }
  }
}
