// ===== Patternflow pattern =====
// Title:   Reaction Diffusion
// Family:  sim
// Idea:    Two chemicals that only feed and spread grow coral and spots on their own, and one knob decides which.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Species=0..5, Grain=0..1
//
// Knob 1: Hue. Turns the culture's colour around the wheel.
// Knob 2: Speed. How fast the culture grows; at 2 it runs 240 steps a second.
// Knob 3: Species. Walks the feed and kill rates through coral, maze, holes, spots, mitosis and worms.
// Knob 4: Grain. Slows the spreading against the reaction, so every species grows finer, from fat tubes to filigree.
// Buttons: K1 tap reseeds the dish.

// Gray-Scott feed and kill rates, one pair per species, in knob order.
const SPECIES = [
  [0.0545, 0.062],
  [0.029, 0.057],
  [0.039, 0.058],
  [0.03, 0.062],
  [0.0367, 0.0649],
  [0.078, 0.061],
];

const W = 64;
const H = 128;

function rand(params) {
  let s = params.seed | 0;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  params.seed = s;
  return (s >>> 0) / 4294967296;
}

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

// Pearson's perturbation, a disc of half-used feed with some catalyst in it.
function dab(params, cx, cy, r, mix) {
  const a = params.a;
  const b = params.b;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const i = ((cy + dy + H * 4) % H) * W + ((cx + dx + W * 4) % W);
      a[i] += (0.5 - a[i]) * mix;
      b[i] += (0.25 + rand(params) * 0.05 - b[i]) * mix;
    }
  }
}

// Seeds grow with the spreading rate: smaller ones fade in the spot species,
// and bigger or closer ones starve each other.
function seedSize(params) {
  return Math.round(6 * Math.sqrt(params.d));
}

function seedDish(params) {
  params.a.fill(1);
  params.b.fill(0);
  // One seed in each cell of a 3 by 6 grid, jittered, so the dish fills evenly.
  for (let n = 0; n < 18; n++) {
    const cx = Math.floor(((n % 3) + 0.15 + rand(params) * 0.7) * (W / 3));
    const cy = Math.floor((Math.floor(n / 3) + 0.15 + rand(params) * 0.7) * (H / 6));
    dab(params, cx, cy, seedSize(params) + Math.floor(rand(params) * 2), 1);
  }
  params.young = 1;
  params.fresh = false;
}

function step(params, F, K, D) {
  const tsx = params.tsx;
  const tcx = params.tcx;
  const a = params.a;
  const b = params.b;
  const na = params.na;
  const nb = params.nb;
  for (let y = 0; y < H; y++) {
    const up = ((y + H - 1) % H) * W;
    const row = y * W;
    const down = ((y + 1) % H) * W;
    const tcy = params.tcy[y];
    const tsy = params.tsy[y];
    for (let x = 0; x < W; x++) {
      const l = x === 0 ? W - 1 : x - 1;
      const r = x === W - 1 ? 0 : x + 1;
      const i = row + x;
      const av = a[i];
      const bv = b[i];
      const la =
        0.2 * (a[up + x] + a[down + x] + a[row + l] + a[row + r]) +
        0.05 * (a[up + l] + a[up + r] + a[down + l] + a[down + r]) -
        av;
      const lb =
        0.2 * (b[up + x] + b[down + x] + b[row + l] + b[row + r]) +
        0.05 * (b[up + l] + b[up + r] + b[down + l] + b[down + r]) -
        bv;
      const abb = av * bv * bv;
      // The tide, sin(ax + by + phase), split into a row part and a column part.
      const fx = F + tsx[x] * tcy + tcx[x] * tsy;
      na[i] = av + D * la - abb + fx * (1 - av);
      // Catalyst that has all but gone is set to zero, which keeps the float maths fast.
      const nv = bv + 0.5 * D * lb + abb - (K + fx) * bv;
      nb[i] = nv > 1e-5 ? nv : 0;
    }
  }
  params.a = na;
  params.b = nb;
  params.na = a;
  params.nb = b;
}

export function setup(params) {
  params.a = new Float32Array(W * H);
  params.b = new Float32Array(W * H);
  params.na = new Float32Array(W * H);
  params.nb = new Float32Array(W * H);
  params.lut = new Uint8Array(256 * 3);
  params.lutHue = -1;
  params.seed = 0x2545f491;
  params.pending = 0;
  params.check = 0;
  params.drip = 0;
  params.tsx = new Float32Array(W);
  params.tcx = new Float32Array(W);
  params.tsy = new Float32Array(H);
  params.tcy = new Float32Array(H);
  params.tideT = 0;
  params.young = 0;
  params.d = 1;
  // The first update seeds the dish, once the knobs are known.
  params.fresh = true;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.hue = k[0];
  const species = Math.max(0, Math.min(SPECIES.length - 1, k[2]));
  const i = Math.min(SPECIES.length - 2, Math.floor(species));
  const f = species - i;
  const F = SPECIES[i][0] + (SPECIES[i + 1][0] - SPECIES[i][0]) * f;
  const K = SPECIES[i][1] + (SPECIES[i + 1][1] - SPECIES[i][1]) * f;

  params.d = 1 - 0.45 * Math.max(0, Math.min(1, k[3]));
  if (params.fresh || (input.btnPressed && input.btnPressed[0])) seedDish(params);

  // A fresh dish runs fast for its first second, so the species shows sooner.
  params.young = Math.max(0, params.young - dt);
  params.pending += dt * k[1] * 120 * (1 + params.young * 2);
  let steps = Math.floor(params.pending);
  params.pending -= steps;
  if (steps > 32) steps = 32;

  // A slow tide of feed rolls across the dish and turns as it goes, and now
  // and then a drop of fresh culture lands, so a dish that has settled keeps
  // changing.
  params.drip += steps;
  if (params.drip > 600) {
    params.drip = 0;
    dab(params, Math.floor(rand(params) * W), Math.floor(rand(params) * H), seedSize(params), 0.8);
  }
  params.tideT += steps / 7200;
  const turn = params.tideT * 1.3;
  // About 85 cells from crest to crest, the same whichever way the tide faces.
  const ax = (Math.cos(turn) * 9.42) / 128;
  const by = (Math.sin(turn) * 9.42) / 128;
  const phase = params.tideT * 6.2832;
  for (let x = 0; x < W; x++) {
    params.tsx[x] = Math.sin(ax * x);
    params.tcx[x] = Math.cos(ax * x);
  }
  for (let y = 0; y < H; y++) {
    params.tcy[y] = 0.0035 * Math.cos(by * y + phase);
    params.tsy[y] = 0.0035 * Math.sin(by * y + phase);
  }
  for (let s = 0; s < steps; s++) step(params, F, K, params.d);

  // A dish that died out, or filled one flat colour, starts again.
  params.check += dt;
  if (params.check > 0.5) {
    params.check = 0;
    let lo = 1;
    let hi = 0;
    const b = params.b;
    for (let j = 0; j < b.length; j += 5) {
      if (b[j] < lo) lo = b[j];
      if (b[j] > hi) hi = b[j];
    }
    if (hi < 0.04 || hi - lo < 0.04) seedDish(params);
  }
}

export function draw(display, params, time) {
  if (params.lutHue !== params.hue) {
    params.lutHue = params.hue;
    const lut = params.lut;
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      // A deep rim a step round the wheel, then a bright, paler core.
      const c = hsv(params.hue + 0.72 - t * 0.22, 1 - t * t * 0.4, Math.min(1, t * 1.8));
      lut[i * 3] = c[0];
      lut[i * 3 + 1] = c[1];
      lut[i * 3 + 2] = c[2];
    }
  }
  const b = params.b;
  const lut = params.lut;
  for (let y = 0; y < H; y++) {
    const up = (y === 0 ? 0 : y - 1) * W;
    const down = (y === H - 1 ? H - 1 : y + 1) * W;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = (b[i] - 0.05) * 2.7;
      if (v <= 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      if (v > 1) v = 1;
      // Light from the top left, so each blob reads as a raised bead.
      const l = x === 0 ? 0 : x - 1;
      const r = x === W - 1 ? W - 1 : x + 1;
      let shade = 0.8 + (b[up + l] - b[down + r]) * 5;
      shade = shade < 0.35 ? 0.35 : shade > 1.25 ? 1.25 : shade;
      const li = Math.round(v * 255) * 3;
      display.setPixel(x, y, lut[li] * shade, lut[li + 1] * shade, lut[li + 2] * shade);
    }
  }
}
