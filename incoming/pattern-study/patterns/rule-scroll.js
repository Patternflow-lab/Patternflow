// ===== Patternflow pattern =====
// Title:   Rule Scroll
// Family:  automata
// Idea:    A row of 128 cells looks at its neighbours and writes the next row under itself, and one eight-bit number decides whether the rows grow into nested triangles or into noise.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 128x64
// @knobs Hue=0..1, Speed=0..4, Rule=0..11, Noise=0..1
//
// Knob 1: Hue. Turns the colours around the colour wheel; each colour stands for the three cells a cell was born from.
// Knob 2: Speed. Generations per second, from 3 to 24, one row each.
// Knob 3: Rule. Walks the rules 30, 45, 73, 90, 105, 110, 150, 182, 54, 18, 62 and 126.
// Knob 4: Noise. Random flips each generation, which show as white sparks and break ordered rules open.
// Buttons: K1 tap starts again from a single cell.

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

const W = 128;
const H = 64;
const RULES = [30, 45, 73, 90, 105, 110, 150, 182, 54, 18, 62, 126];
// Hue offset, saturation and brightness for each neighbourhood, left centre
// right as three bits, then one more for a cell the noise flipped. The two
// uniform ones, 000 and 111, are a rule's ground and stay dim, so the
// structure carries the light.
const LOOK = [
  [0.5, 0.85, 0.3],
  [-0.06, 0.9, 1.0],
  [0.0, 0.9, 0.75],
  [-0.03, 0.85, 0.85],
  [0.06, 0.9, 1.0],
  [0.5, 0.75, 1.0],
  [0.03, 0.85, 0.85],
  [0.0, 0.7, 0.35],
  [0.0, 0.0, 1.0],
];

function rand(params) {
  let s = params.rng | 0;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  params.rng = s;
  return (s >>> 0) / 4294967296;
}

export function setup(params) {
  params.rows = new Uint8Array(W * H);
  params.cur = new Uint8Array(W);
  params.nxt = new Uint8Array(W);
  params.back = new Uint8Array(W);
  params.palette = new Float32Array(LOOK.length * 3);
  params.rng = (Math.random() * 4294967295) | 1;
  params.head = 0;
  params.acc = 0;
  params.gen = 0;
  params.repeats = 0;
  params.started = false;
}

function restart(params, rule) {
  params.cur.fill(0);
  params.cur[W >> 1] = 1;
  params.rows.fill(0);
  // Fill the panel before the first frame, so it opens on the whole cone.
  for (let i = 0; i < H - 1; i++) step(params, rule, 0);
}

function step(params, rule, noise) {
  const cur = params.cur;
  const nxt = params.nxt;
  params.head = (params.head + 1) % H;
  const row = params.head * W;
  let lit = 0;
  for (let x = 0; x < W; x++) {
    const n = (cur[(x + W - 1) % W] << 2) | (cur[x] << 1) | cur[(x + 1) % W];
    const v = (rule >> n) & 1;
    nxt[x] = v;
    params.rows[row + x] = v ? 1 + n : 0;
    lit += v;
  }
  // Noise is the mean number of flips per generation; the fraction is a chance.
  let flips = Math.floor(noise);
  if (rand(params) < noise - flips) flips++;
  for (let f = 0; f < flips; f++) {
    const x = Math.floor(rand(params) * W);
    nxt[x] ^= 1;
    lit += nxt[x] ? 1 : -1;
    params.rows[row + x] = nxt[x] ? 9 : 0;
  }
  // A row that is all one state, or repeats the one two generations back,
  // has nothing left to show: one flipped cell starts it moving again.
  let same = true;
  for (let x = 0; x < W && same; x++) if (nxt[x] !== params.back[x]) same = false;
  params.repeats = same ? params.repeats + 1 : 0;
  if (lit === 0 || lit === W || params.repeats > 24) {
    const x = Math.floor(rand(params) * W);
    nxt[x] ^= 1;
    params.rows[row + x] = nxt[x] ? 9 : 0;
    params.repeats = 0;
  }
  params.back.set(cur);
  params.cur = nxt;
  params.nxt = cur;
  params.gen++;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  // K1 at 0 opens on green rather than the red most of the study opens on.
  params.hue = k[0] + 0.3;
  const rate = 3 * Math.pow(2, 0.75 * k[1]);
  const rule = RULES[Math.max(0, Math.min(RULES.length - 1, Math.round(k[2])))];
  const noise = 5 * k[3] * k[3];
  if (!params.started || (input.btnPressed && input.btnPressed[0])) {
    restart(params, rule);
    params.started = true;
  }
  params.acc += dt * rate;
  let steps = 0;
  while (params.acc >= 1 && steps < 4) {
    step(params, rule, noise);
    params.acc -= 1;
    steps++;
  }
  if (params.acc > 1) params.acc = 1;
  // The colours drift slowly with the generations, one turn in about 2500.
  const drift = params.gen * 0.0004;
  for (let i = 0; i < LOOK.length; i++) {
    const c = hsv(params.hue + drift + LOOK[i][0], LOOK[i][1], LOOK[i][2]);
    params.palette[i * 3] = c[0];
    params.palette[i * 3 + 1] = c[1];
    params.palette[i * 3 + 2] = c[2];
  }
}

export function draw(display, params, time) {
  const pal = params.palette;
  for (let y = 0; y < H; y++) {
    // The newest row is at the bottom; older rows dim a little as they rise.
    const ring = (params.head - (H - 1 - y) + H * 2) % H;
    const fade = 0.55 + 0.45 * (y / (H - 1));
    const row = ring * W;
    for (let x = 0; x < W; x++) {
      const v = params.rows[row + x];
      if (v === 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const c = (v - 1) * 3;
      display.setPixel(x, y, pal[c] * fade, pal[c + 1] * fade, pal[c + 2] * fade);
    }
  }
}
