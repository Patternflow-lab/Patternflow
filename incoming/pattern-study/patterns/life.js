// ===== Patternflow pattern =====
// Title:   Life
// Family:  automata
// Idea:    The same eight neighbours run under six different laws, and each cell wears its age, so a law shows itself in what lasts and what flickers.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0..4, Rule=0..5, Ghosts=0..1
//
// Knob 1: Hue. Turns the whole palette, newborn to old to ghost, around the colour wheel.
// Knob 2: Speed. Generations per second, from one to about 24.
// Knob 3: Rule. 0 Conway B3/S23, 1 HighLife B36/S23, 2 2x2 B36/S125, 3 Day and Night B3678/S34678, 4 Anneal B4678/S35678, 5 Maze B3/S12345.
// Knob 4: Ghosts. How long a dead cell glows on, from a short smear to long exposure.
// Buttons: K1 tap sweeps a fresh soup down the whole panel.

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

const W = 64;
const H = 128;
const N = W * H;
// Birth and survival as bit masks over the neighbour count, the density of
// the soup each rule starts from, and the density a reseed drops in. The rules
// that grow walls get a sparse drop, so a reseed clears ground to regrow.
const RULES = [
  [1 << 3, (1 << 2) | (1 << 3), 0.33, 0.33],
  [(1 << 3) | (1 << 6), (1 << 2) | (1 << 3), 0.33, 0.33],
  [(1 << 3) | (1 << 6), (1 << 1) | (1 << 2) | (1 << 5), 0.3, 0.3],
  [(1 << 3) | (1 << 6) | (1 << 7) | (1 << 8), (1 << 3) | (1 << 4) | (1 << 6) | (1 << 7) | (1 << 8), 0.5, 0.5],
  [(1 << 4) | (1 << 6) | (1 << 7) | (1 << 8), (1 << 3) | (1 << 5) | (1 << 6) | (1 << 7) | (1 << 8), 0.5, 0.5],
  [1 << 3, (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5), 0.12, 0.05],
];
// Colours by age on a log scale: the first few generations change the colour
// fast, and a still region keeps deepening for about twenty seconds.
const AGES = 48;
const GHOST_CUT = 0.07;
const BLOCKS = 32;

function rand(params) {
  let s = params.rng | 0;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  params.rng = s;
  return (s >>> 0) / 4294967296;
}

export function setup(params) {
  params.cells = new Uint8Array(N);
  params.next = new Uint8Array(N);
  params.age = new Uint16Array(N);
  params.ghost = new Float32Array(N);
  params.ageCol = new Float32Array(AGES * 3);
  params.ageIndex = new Uint8Array(1024);
  for (let a = 0; a < 1024; a++) params.ageIndex[a] = Math.min(AGES - 1, Math.floor(Math.log2(1 + a) * 5.2));
  params.blocks = new Float32Array(BLOCKS);
  params.now = new Float32Array(BLOCKS);
  params.still = 0;
  params.gen = 0;
  params.ghostCol = [0, 0, 0];
  params.rng = (Math.random() * 4294967295) | 1;
  params.seeded = false;
  params.acc = 0;
  params.calm = 1;
  params.cooldown = 0;
  // The reseed under way: 0 none, 1 a growing drop, 2 a sweep across the panel.
  params.wipe = 0;
  params.wipeT = 0;
  params.wipeDone = 0;
}

// Kill or seed one cell as a wipe passes it; what dies there leaves a ghost.
function reseedCell(params, p, density) {
  if (params.cells[p]) params.ghost[p] = 0.5;
  const alive = rand(params) < density ? 1 : 0;
  params.cells[p] = alive;
  params.age[p] = 0;
}

function startWipe(params, kind) {
  params.wipe = kind;
  params.wipeT = 0;
  params.wipeDone = 0;
  params.wipeX = Math.floor(rand(params) * W);
  params.wipeY = Math.floor(rand(params) * H);
  params.wipeR = 16 + rand(params) * 12;
  params.cooldown = 64;
  params.still = 0;
}

function runWipe(params, dt, density) {
  if (params.wipe === 2) density = params.soup;
  params.wipeT += dt;
  if (params.wipe === 1) {
    // A disc of fresh soup grows from one point, edge first.
    const r = Math.min(1, params.wipeT / 0.8) * params.wipeR;
    const r0 = params.wipeDone;
    const reach = Math.ceil(r);
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const d = Math.hypot(dx, dy);
        if (d < r0 || d >= r) continue;
        const x = (params.wipeX + dx + W) % W;
        const y = (params.wipeY + dy + H) % H;
        reseedCell(params, y * W + x, density * (1 - 0.5 * (d / params.wipeR)));
      }
    }
    params.wipeDone = r;
    if (params.wipeT >= 0.8) params.wipe = 0;
  } else {
    // A front of fresh soup comes down the whole panel from the top.
    const to = Math.min(H, Math.floor((params.wipeT / 1.2) * H));
    for (let y = params.wipeDone; y < to; y++) {
      for (let x = 0; x < W; x++) reseedCell(params, y * W + x, density);
    }
    params.wipeDone = to;
    if (to >= H) params.wipe = 0;
  }
}

function step(params, rule) {
  const cells = params.cells;
  const next = params.next;
  const age = params.age;
  const birth = rule[0];
  const survive = rule[1];
  let changed = 0;
  let population = 0;
  for (let y = 0; y < H; y++) {
    const up = ((y + H - 1) % H) * W;
    const row = y * W;
    const down = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const l = (x + W - 1) % W;
      const r = (x + 1) % W;
      const n =
        cells[up + l] + cells[up + x] + cells[up + r] +
        cells[row + l] + cells[row + r] +
        cells[down + l] + cells[down + x] + cells[down + r];
      const p = row + x;
      const was = cells[p];
      const now = ((was ? survive : birth) >> n) & 1;
      next[p] = now;
      if (now) {
        age[p] = was ? Math.min(age[p] + 1, 65535) : 0;
        population++;
      } else if (was) params.ghost[p] = 0.5;
      if (now !== was) changed++;
    }
  }
  params.cells = next;
  params.next = cells;
  params.calm = params.calm * 0.9 + 0.1 * (changed / N);
  params.gen++;
  // Every sixteen generations, measure how far the layout has moved from the
  // last one that counted as new; flicker along an edge never adds up to that.
  if (params.gen % 16 === 0) {
    let moved = 0;
    for (let b = 0; b < BLOCKS; b++) {
      const bx = (b % 4) * 16;
      const by = Math.floor(b / 4) * 16;
      let sum = 0;
      for (let y = by; y < by + 16; y++) for (let x = bx; x < bx + 16; x++) sum += next[y * W + x];
      params.now[b] = sum / 256;
      moved += Math.abs(params.now[b] - params.blocks[b]);
    }
    // Measured against the population, so a sparse field and a crowded one
    // are held to the same standard.
    if (moved / BLOCKS / (population / N + 0.02) > 0.12) {
      params.blocks.set(params.now);
      params.still = 0;
    } else params.still++;
  }
  if (params.cooldown > 0) params.cooldown--;
  if (params.wipe) return;
  if (population < N * 0.004) startWipe(params, 2);
  else if ((params.calm < 0.006 || params.still >= 4) && params.cooldown === 0) startWipe(params, 1);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.hue = k[0];
  const rate = 1 + 5.5 * k[1];
  const ruleIndex = Math.max(0, Math.min(RULES.length - 1, Math.round(k[2])));
  const rule = RULES[ruleIndex];
  params.trail = 0.25 + 3 * Math.pow(k[3], 1.5);

  if (!params.seeded) {
    for (let p = 0; p < N; p++) params.cells[p] = rand(params) < rule[2] ? 1 : 0;
    // Run the soup past its first boil, so even the slowest speed opens on shapes.
    for (let i = 0; i < 24; i++) step(params, rule);
    params.ghost.fill(0);
    params.seeded = true;
  }
  if (input.btnPressed && input.btnPressed[0]) startWipe(params, 2);
  params.soup = rule[2];
  if (params.wipe) runWipe(params, dt, rule[3]);

  params.acc += dt * rate;
  let steps = 0;
  while (params.acc >= 1 && steps < 4) {
    step(params, rule);
    params.acc -= 1;
    steps++;
  }
  if (params.acc > 1) params.acc = 1;

  const fade = Math.exp(-dt / params.trail);
  const ghost = params.ghost;
  for (let p = 0; p < N; p++) if (ghost[p] > 0) ghost[p] = ghost[p] > GHOST_CUT ? ghost[p] * fade : 0;

  // Newborn cells are pale and hot, the young ones the full hue, and the old
  // ones sink to a deeper, darker colour; ghosts sit further round the wheel.
  for (let a = 0; a < AGES; a++) {
    const young = Math.min(1, a / 8);
    const old = Math.max(0, (a - 8) / (AGES - 9));
    const c = hsv(params.hue + 0.1 * (1 - young) - 0.2 * old, 0.55 + 0.35 * young, 1 - 0.55 * old);
    params.ageCol[a * 3] = c[0];
    params.ageCol[a * 3 + 1] = c[1];
    params.ageCol[a * 3 + 2] = c[2];
  }
  params.ghostCol = hsv(params.hue + 0.62, 0.85, 1);
}

export function draw(display, params, time) {
  const cells = params.cells;
  const age = params.age;
  const ghost = params.ghost;
  const col = params.ageCol;
  const g = params.ghostCol;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (cells[p]) {
        const a = params.ageIndex[Math.min(age[p], 1023)] * 3;
        display.setPixel(x, y, col[a], col[a + 1], col[a + 2]);
      } else if (ghost[p] > GHOST_CUT) {
        const v = ghost[p];
        display.setPixel(x, y, g[0] * v, g[1] * v, g[2] * v);
      } else display.setPixel(x, y, 0, 0, 0);
    }
  }
}
