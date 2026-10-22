// ===== Patternflow pattern =====
// Title:   Aquarium
// Family:  pixel
// Idea:    A tall tank in hand-drawn sprites: clownfish, a tang, an angelfish and a school of neon tetras wag their tails across it and turn at the glass, weed sways from the sand, bubbles climb from a stone and the surface throws a moving net of light down the water.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// Round:   2
// ===============================
// @matrix 64x128
// @knobs Water=0..1, Swim=0.2..4, Fish=6..18, Light=-1..1
//
// Knob 1: Water. The tint of the water, from clear blue through lagoon teal and planted green to tea-brown blackwater and violet.
// Knob 2: Swim. How fast the whole tank moves, fish, weed, bubbles and light, from slow motion to a feeding rush.
// Knob 3: Fish. How many fish live in the tank; new ones swim in from the side and spare ones swim out.
// Knob 4: Light. Below 0 the lamp dims towards night and the deep water goes dark; above 0 the sun is out and the net of light reaches the sand.
// Buttons: K1 tap drops a pinch of food at the surface, and every fish goes for it.

const W = 64;
const H = 128;
// The water line; above it is the air under the lid.
const SURFACE = 7;
// The mean height of the sand.
const FLOOR = 117;
const MAX_FISH = 18;
const FLAKES = 24;
const BUBBLES = 40;
const WEEDS = 6;
const SIN_N = 1024;
const SIN_K = SIN_N / (Math.PI * 2);

const CLOWN = 0;
const TANG = 1;
const ANGEL = 2;
const TETRA = 3;

// Sprites face right. Two frames each: the tail spread, then edge-on.
const KINDS = [
  {
    pal: { o: 0xff6810, w: 0xf6f4ee, f: 0xc83c06, k: 0x101010 },
    speed: 9,
    a: [
      "......ff....",
      "f...wooowo..",
      "ff.owooowok.",
      "fffowooowooo",
      "ff.owooowoo.",
      "f...wooowo..",
      "......f.....",
    ],
    b: [
      "......ff....",
      "....wooowo..",
      "f..owooowok.",
      "ffffwooowooo",
      "f..owooowoo.",
      "....wooowo..",
      ".....f......",
    ],
  },
  {
    pal: { b: 0x1e5cff, n: 0x0c1c78, y: 0xffd21a, l: 0x6aa8ff, k: 0x080808 },
    speed: 11,
    a: [
      ".....lllll...",
      "y..lbbbbbbb..",
      "yy.bnnnbbbbb.",
      "yyybbbnnnbbkb",
      "yyybbbbbnnbbb",
      "yy.bbbbbbnbb.",
      "y..lbbbbbbb..",
      ".....lllll...",
    ],
    b: [
      ".....lllll...",
      "...lbbbbbbb..",
      "y..bnnnbbbbb.",
      "yyybbbnnnbbkb",
      "yyybbbbbnnbbb",
      "y..bbbbbbnbb.",
      "...lbbbbbbb..",
      ".....lllll...",
    ],
  },
  {
    pal: { s: 0xdce6f0, d: 0x46505e, f: 0xa8bccc, k: 0x0a0a0a, a: 0xf2cc50 },
    speed: 6,
    a: [
      "...f.......",
      "...ff......",
      "....ff.....",
      "....fss....",
      "...sdssa...",
      "f.ssdssds..",
      "ffssdssdsks",
      "f.ssdssds..",
      "...sdsss...",
      "....fss....",
      "....ff.....",
      "...ff......",
      "...f.......",
    ],
    b: [
      "....f......",
      "...ff......",
      "...ff......",
      "....fss....",
      "...sdssa...",
      "..ssdssds..",
      "fsssdssdsks",
      "..ssdssds..",
      "...sdsss...",
      "....fss....",
      "...ff......",
      "...ff......",
      "....f......",
    ],
  },
  {
    pal: { s: 0xc4ccd6, t: 0x22d4ff, r: 0xff2234, k: 0x0a0a0a },
    speed: 13,
    a: [
      "...sss..",
      "s.ttttks",
      "ssrrrsss",
      "s..sss..",
    ],
    b: [
      "...sss..",
      "..ttttks",
      "ssrrrsss",
      "...sss..",
    ],
  },
];

// The chest on the sand, shut and open. Every few seconds its lid lifts and lets out a burst of air.
const CHEST = {
  pal: { g: 0xe8b42a, w: 0x8c4c1a, d: 0x5a2c0c, y: 0xfff09a },
  a: [
    ".........",
    ".........",
    ".ggggggg.",
    "gwwwwwwwg",
    "ggggkgggg",
    "gwwwgwwwg",
    "gdddgdddg",
    "ggggggggg",
  ],
  b: [
    ".ggggggg.",
    "gwwwwwwwg",
    ".gyyyyyg.",
    "gyyyyyyyg",
    "ggggggggg",
    "gwwwgwwwg",
    "gdddgdddg",
    "ggggggggg",
  ],
};
const CHEST_X = 28;

const DRAW_ORDER = [TETRA, ANGEL, TANG, CLOWN];

// Which kind each fish is, in the order they arrive as the knob turns up.
const ORDER = [CLOWN, ANGEL, TETRA, TETRA, TANG, TETRA, TETRA, CLOWN, TETRA, ANGEL, TETRA, TETRA, TANG, TETRA, CLOWN, TETRA, TETRA, ANGEL];

// Water at the top and at the bottom of the tank, one pair per tint.
const WATERS = [
  [0x2a7ce0, 0x0c2a78],
  [0x18b0b4, 0x084450],
  [0x50a83a, 0x123c16],
  [0xc08428, 0x3c1c08],
  [0x8456dc, 0x24104e],
];

const WEED_STEM = [0x1c8a2a, 0x1c8a2a, 0x8a1e3c, 0x6a9418, 0x1c8a2a, 0x1c8a2a];
const WEED_LEAF = [0x46cc4e, 0x46cc4e, 0xe0506e, 0xa8d030, 0x46cc4e, 0x46cc4e];
const WEED_X = [4, 16, 26, 45, 57, 62];
const WEED_H = [66, 40, 84, 30, 94, 52];
// Rows between leaves, so no two weeds look stamped from one.
const WEED_GAP = [6, 5, 4, 7, 6, 5];

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function rgbOf(c, out, o) {
  out[o] = (c >> 16) & 255;
  out[o + 1] = (c >> 8) & 255;
  out[o + 2] = c & 255;
}

// Turns the sprite strings into palette indices once, so the draw loop only reads numbers.
function bake(kind) {
  const keys = Object.keys(kind.pal);
  const h = kind.a.length;
  const w = kind.a[0].length;
  const pix = new Uint8Array(2 * w * h);
  const frames = [kind.a, kind.b];
  for (let f = 0; f < 2; f++)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) pix[f * w * h + y * w + x] = keys.indexOf(frames[f][y][x]) + 1;
  const pal = new Float32Array((keys.length + 1) * 3);
  for (let i = 0; i < keys.length; i++) rgbOf(kind.pal[keys[i]], pal, (i + 1) * 3);
  return { w, h, pix, pal, speed: kind.speed };
}

function sinAt(p, a) {
  return p.sin[Math.floor(a * SIN_K) & (SIN_N - 1)];
}

function sandTop(x) {
  return FLOOR + Math.round(1.6 * Math.sin(x * 0.13 + 0.7) + 0.9 * Math.sin(x * 0.41 + 2));
}

function newCruise(p, i) {
  const s = p.sprite[p.kind[i]];
  p.cruise[i] = 0.6 + Math.random() * 0.6;
  p.ty[i] = SURFACE + 6 + Math.random() * (FLOOR - SURFACE - 16 - s.h);
  p.clock[i] = 2 + Math.random() * 5;
}

function placeFish(p, i, entering) {
  const s = p.sprite[p.kind[i]];
  p.state[i] = entering ? 3 : 1;
  const dir = Math.random() < 0.5 ? -1 : 1;
  p.dir[i] = dir;
  if (entering) p.x[i] = dir > 0 ? -s.w - 1 : W + 1;
  else p.x[i] = 1 + Math.random() * (W - s.w - 2);
  newCruise(p, i);
  p.y[i] = entering ? p.ty[i] : SURFACE + 6 + Math.random() * (FLOOR - SURFACE - 16 - s.h);
  p.v[i] = dir * s.speed * p.cruise[i];
  p.vy[i] = 0;
  p.face[i] = dir;
  p.wag[i] = Math.random() * 2;
}

function swim(p, i, dt) {
  const s = p.sprite[p.kind[i]];
  const st = p.state[i];
  let target;
  let ty = p.ty[i];
  let tx = -1;
  if (st === 1 && p.food > 0) {
    // Nearest flake, from the mouth.
    const mx = p.x[i] + (p.face[i] > 0 ? s.w : 0);
    const my = p.y[i] + s.h * 0.5;
    let best = 1e9;
    let bi = -1;
    for (let f = 0; f < FLAKES; f++) {
      if (p.flakeLife[f] <= 0) continue;
      const dx = p.fx[f] - mx;
      const dy = p.fy[f] - my;
      // A flake another fish is already after counts as further away, so a pinch spreads the fish out.
      const d = dx * dx + dy * dy + (p.claim[f] ? 400 : 0);
      if (d < best) {
        best = d;
        bi = f;
      }
    }
    if (bi >= 0) {
      p.claim[bi] = 1;
      if (best < 6) {
        p.flakeLife[bi] = 0;
        p.food--;
      } else {
        tx = p.fx[bi] - (p.face[i] > 0 ? s.w : 0);
        ty = p.fy[bi] - s.h * 0.5;
      }
    }
  }
  if (tx >= 0) {
    target = clamp((tx - p.x[i]) * 2, -s.speed * 1.9, s.speed * 1.9);
  } else if (st === 1 && p.kind[i] === TETRA) {
    // Tetras keep station behind a leader nobody sees, so they turn as one.
    tx = p.lx - p.ldir * p.ox[i];
    ty = p.ly + p.oy[i];
    target = p.ldir * p.lv + (tx - p.x[i]) * 1.2;
    target = clamp(target, -s.speed * 1.6, s.speed * 1.6);
  } else {
    if (st === 1) {
      p.clock[i] -= dt;
      if (p.clock[i] <= 0) {
        newCruise(p, i);
        if (Math.random() < 0.3) p.dir[i] = -p.dir[i];
      }
      const m = 2 + Math.abs(p.v[i]) * 0.5;
      if (p.x[i] < m && p.dir[i] < 0) p.dir[i] = 1;
      if (p.x[i] > W - s.w - m && p.dir[i] > 0) p.dir[i] = -1;
    }
    target = p.dir[i] * s.speed * (st === 2 ? 1.4 : p.cruise[i]);
  }
  p.v[i] += (target - p.v[i]) * Math.min(1, dt * 2.2);
  p.x[i] += p.v[i] * dt;
  // Fish that share a stretch of water drift apart in depth instead of swimming through each other.
  let push = 0;
  if (p.food <= 0) {
    for (let j = 0; j < MAX_FISH; j++) {
      if (j === i || !p.state[j]) continue;
      if (p.kind[i] === TETRA && p.kind[j] === TETRA) continue;
      const o = p.sprite[p.kind[j]];
      if (p.x[j] > p.x[i] + s.w + 2 || p.x[j] + o.w + 2 < p.x[i]) continue;
      const dy = p.y[i] + s.h * 0.5 - (p.y[j] + o.h * 0.5);
      const room = (s.h + o.h) * 0.5 + 2;
      if (Math.abs(dy) < room) push += (dy >= 0 ? 1 : -1) * (room - Math.abs(dy));
    }
  }
  // A cruising fish takes the new depth as its own, so the two do not drift back together.
  if (push !== 0 && st === 1 && p.kind[i] !== TETRA && tx < 0) {
    p.ty[i] = clamp(p.ty[i] + push * dt * 6, SURFACE + 4, FLOOR - 8 - s.h);
    ty = p.ty[i];
  } else ty += push * 3;
  p.vy[i] += ((ty - p.y[i]) * 0.7 - p.vy[i]) * Math.min(1, dt * 1.5);
  p.vy[i] = clamp(p.vy[i], -s.speed * 0.6, s.speed * 0.6);
  p.y[i] = clamp(p.y[i] + p.vy[i] * dt, SURFACE + 2, FLOOR - 4 - s.h);
  if (Math.abs(p.v[i]) > 0.8) p.face[i] = p.v[i] > 0 ? 1 : -1;
  p.wag[i] += dt * (2.5 + Math.abs(p.v[i]) * 0.35);
  if (st === 1) p.x[i] = clamp(p.x[i], 0, W - s.w);
  else if (st === 3 && p.x[i] >= 0 && p.x[i] <= W - s.w) p.state[i] = 1;
  else if (st === 2 && (p.x[i] < -s.w - 2 || p.x[i] > W + 2)) p.state[i] = 0;
}

function spawnBubble(p, x, y, age) {
  for (let b = 0; b < BUBBLES; b++) {
    if (p.by[b] > 0) continue;
    p.bx[b] = x;
    p.by[b] = y;
    p.bage[b] = age;
    p.bph[b] = Math.random() * 6.28;
    return;
  }
}

function stepWorld(p, dt) {
  p.t += dt;
  // The school's leader cruises like a fish and turns at the glass.
  p.lclock -= dt;
  if (p.lclock <= 0) {
    p.lclock = 3 + Math.random() * 4;
    p.lty = SURFACE + 16 + Math.random() * (FLOOR - SURFACE - 40);
    p.lv = 8 + Math.random() * 6;
    if (Math.random() < 0.35) p.ldir = -p.ldir;
  }
  if (p.lx < 10 && p.ldir < 0) p.ldir = 1;
  if (p.lx > W - 4 && p.ldir > 0) p.ldir = -1;
  p.lx += p.ldir * p.lv * dt;
  p.ly += (p.lty - p.ly) * Math.min(1, dt * 0.6);

  p.claim.fill(0);
  for (let i = 0; i < MAX_FISH; i++) if (p.state[i]) swim(p, i, dt);

  for (let f = 0; f < FLAKES; f++) {
    if (p.flakeLife[f] <= 0) continue;
    const ground = sandTop(clamp(Math.floor(p.fx[f]), 0, W - 1)) - 1;
    if (p.fy[f] < ground) {
      p.fy[f] = Math.min(ground, p.fy[f] + dt * (4 + 1.5 * Math.sin(p.t * 3 + f)));
      p.fx[f] = clamp(p.fx[f] + dt * Math.sin(p.t * 1.7 + f * 2.1) * 2.5, 1, W - 2);
    } else {
      p.flakeLife[f] -= dt;
      if (p.flakeLife[f] <= 0) p.food--;
    }
  }

  p.chestClock -= dt;
  if (p.chestClock <= 0) {
    if (p.chestOpen > 0) {
      p.chestOpen = 0;
      p.chestClock = 4 + Math.random() * 5;
    } else {
      p.chestOpen = 1;
      p.chestClock = 1.3;
      p.burst = 5 + Math.floor(Math.random() * 4);
    }
  }
  if (p.chestOpen && p.burst > 0) {
    p.burstClock -= dt;
    if (p.burstClock <= 0) {
      p.burstClock = 0.09 + Math.random() * 0.1;
      p.burst--;
      spawnBubble(p, CHEST_X + 3.5 + (Math.random() - 0.5) * 4, p.chestY - 1, 1.2 + Math.random() * 1.8);
    }
  }
  // Now and then a fish lets a small bubble go.
  p.bclock -= dt;
  if (p.bclock <= 0) {
    p.bclock = 1.5 + Math.random() * 3;
    const i = Math.floor(Math.random() * MAX_FISH);
    if (p.state[i] === 1) {
      const s = p.sprite[p.kind[i]];
      spawnBubble(p, p.x[i] + (p.face[i] > 0 ? s.w : -1), p.y[i] + s.h * 0.4, 0);
    }
  }
  for (let b = 0; b < BUBBLES; b++) {
    if (p.by[b] <= 0) continue;
    p.bage[b] += dt;
    p.by[b] -= dt * (13 + Math.min(2, p.bage[b] * 0.5) * 4);
    if (p.by[b] <= SURFACE + 1) p.by[b] = 0;
  }
}

export function setup(params) {
  const p = params;
  p.sin = new Float32Array(SIN_N);
  for (let i = 0; i < SIN_N; i++) p.sin[i] = Math.sin((i / SIN_N) * Math.PI * 2);
  p.sprite = KINDS.map(bake);
  p.kind = new Uint8Array(MAX_FISH);
  for (let i = 0; i < MAX_FISH; i++) p.kind[i] = ORDER[i];
  p.ox = new Float32Array(MAX_FISH);
  p.oy = new Float32Array(MAX_FISH);
  // Each tetra has its own place in the school, three abreast and staggered.
  let n = 0;
  for (let i = 0; i < MAX_FISH; i++) {
    if (p.kind[i] !== TETRA) continue;
    const col = n % 3;
    const rank = Math.floor(n / 3);
    p.ox[i] = 1 + col * 9 + (rank & 1) * 4;
    p.oy[i] = (col - 1) * 6 + ((rank % 3) - 1) * 2.5;
    n++;
  }
  p.state = new Uint8Array(MAX_FISH);
  p.x = new Float32Array(MAX_FISH);
  p.y = new Float32Array(MAX_FISH);
  p.v = new Float32Array(MAX_FISH);
  p.vy = new Float32Array(MAX_FISH);
  p.ty = new Float32Array(MAX_FISH);
  p.dir = new Int8Array(MAX_FISH);
  p.face = new Int8Array(MAX_FISH);
  p.cruise = new Float32Array(MAX_FISH);
  p.clock = new Float32Array(MAX_FISH);
  p.wag = new Float32Array(MAX_FISH);
  p.fx = new Float32Array(FLAKES);
  p.fy = new Float32Array(FLAKES);
  p.flakeLife = new Float32Array(FLAKES);
  p.claim = new Uint8Array(FLAKES);
  p.food = 0;
  p.bx = new Float32Array(BUBBLES);
  p.by = new Float32Array(BUBBLES);
  p.bage = new Float32Array(BUBBLES);
  p.bph = new Float32Array(BUBBLES);
  p.bclock = 1;
  p.chestOpen = 0;
  p.chestClock = 1.5;
  p.burst = 0;
  p.burstClock = 0;
  p.chest = bake(CHEST);
  p.chestY = sandTop(CHEST_X + 4) - 7;
  p.lx = W / 2;
  p.ly = 60;
  p.lty = 60;
  p.ldir = 1;
  p.lv = 10;
  p.lclock = 0;
  p.t = 0;
  p.ready = false;

  // The sand, the rocks and where each weed stands never change, so they are baked here.
  p.ground = new Float32Array(W * H * 3);
  p.solid = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    const top = sandTop(x);
    for (let y = top; y < H; y++) {
      const n = hash(x, y);
      const o = (y * W + x) * 3;
      const v = 0.5 + 0.18 * n - (y - top) * 0.012 + (y === top ? 0.12 : 0);
      const pebble = n > 0.93 ? 0.6 : 1;
      p.ground[o] = 214 * v * pebble;
      p.ground[o + 1] = 176 * v * pebble;
      p.ground[o + 2] = 118 * v * (n > 0.97 ? 1.6 : pebble);
      p.solid[y * W + x] = 1;
    }
  }
  const rocks = [
    [52, FLOOR - 4, 10, 8],
    [42, FLOOR - 1, 6, 4.5],
    [9, FLOOR, 6, 3.5],
  ];
  for (const [cx, cy, rx, ry] of rocks) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        if (x < 0 || x >= W || y >= H) continue;
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        // Lit from above left in three flat steps, the way a sprite is shaded by hand.
        const lit = -dx * 0.5 - dy * 0.8;
        const step = lit > 0.45 ? 1.25 : lit > -0.25 ? 1 : 0.72;
        const v = step * (0.92 + 0.12 * hash(x * 7, y * 3));
        const o = (y * W + x) * 3;
        p.ground[o] = 104 * v;
        p.ground[o + 1] = 110 * v;
        p.ground[o + 2] = 120 * v;
        p.solid[y * W + x] = 1;
      }
    }
  }
  p.weedX = new Float32Array(WEEDS);
  p.weedH = new Float32Array(WEEDS);
  p.weedPh = new Float32Array(WEEDS);
  for (let i = 0; i < WEEDS; i++) {
    p.weedX[i] = WEED_X[i];
    p.weedH[i] = WEED_H[i];
    p.weedPh[i] = Math.random() * 6.28;
  }
  p.weedStem = new Float32Array(WEEDS * 3);
  p.weedLeaf = new Float32Array(WEEDS * 3);
  for (let i = 0; i < WEEDS; i++) {
    rgbOf(WEED_STEM[i], p.weedStem, i * 3);
    rgbOf(WEED_LEAF[i], p.weedLeaf, i * 3);
  }
  p.row = new Float32Array(H * 3);
  p.fade = new Float32Array(H);
  p.buf = new Float32Array(W * H * 3);
  p.top = new Float32Array(3);
  p.deep = new Float32Array(3);
  p.cc = new Float32Array(3);
}

export function update(dt, input, params) {
  const p = params;
  const k = input.knobValues || [0, 2, 6, 0.06];
  dt = Math.min(dt, 0.1);
  p.water = clamp(k[0], 0, 1);
  p.light = clamp(k[3], -1, 1);
  const pace = Math.max(0.05, k[1] * 0.36);
  const want = Math.round(clamp(k[2], 0, MAX_FISH));
  if (!p.ready) {
    p.ready = true;
    for (let i = 0; i < want; i++) placeFish(p, i, false);
    p.ly = 40 + Math.random() * 40;
    p.lty = p.ly;
    // Fill the bubble column before the first frame.
    for (let s = 0; s < 120; s++) stepWorld(p, 1 / 30);
  }
  for (let i = 0; i < MAX_FISH; i++) {
    const st = p.state[i];
    if (i < want && (st === 0 || st === 2)) {
      if (st === 0) placeFish(p, i, true);
      else p.state[i] = 1;
    } else if (i >= want && (st === 1 || st === 3)) {
      const s = p.sprite[p.kind[i]];
      p.state[i] = 2;
      p.dir[i] = p.x[i] + s.w * 0.5 < W / 2 ? -1 : 1;
    }
  }
  if (input.btnPressed && input.btnPressed[0]) {
    const cx = 8 + Math.random() * (W - 16);
    for (let n = 0; n < 7; n++) {
      for (let f = 0; f < FLAKES; f++) {
        if (p.flakeLife[f] > 0) continue;
        p.fx[f] = cx + (Math.random() - 0.5) * 10;
        p.fy[f] = SURFACE + 1 + Math.random() * 2;
        p.flakeLife[f] = 5 + Math.random() * 3;
        p.food++;
        break;
      }
    }
  }
  stepWorld(p, dt * pace);
}

export function draw(display, params, time) {
  const p = params;
  const buf = p.buf;
  const L = p.light;
  const t = p.t;

  // Water: the tint's two colours, darker with depth, and darker still at night.
  const pos = p.water * (WATERS.length - 1);
  const a = Math.min(WATERS.length - 2, Math.floor(pos));
  const u = pos - a;
  const top = p.top;
  const deep = p.deep;
  for (let c = 0; c < 3; c++) {
    const sh = 16 - c * 8;
    top[c] = ((WATERS[a][0] >> sh) & 255) * (1 - u) + ((WATERS[a + 1][0] >> sh) & 255) * u;
    deep[c] = ((WATERS[a][1] >> sh) & 255) * (1 - u) + ((WATERS[a + 1][1] >> sh) & 255) * u;
  }
  const lamp = L < 0 ? 1 + 0.62 * L : 1;
  const dark = 0.5 - 0.25 * L;
  const glint = L < 0 ? 0.4 * (1 + L) : 0.4 + 0.25 * L;
  const reach = 17 + 60 * Math.max(0, L);
  const cc = p.cc;
  for (let c = 0; c < 3; c++) cc[c] = 150 + top[c] * 0.45;
  const row = p.row;
  const fade = p.fade;
  for (let y = 0; y < H; y++) {
    const d = clamp((y - SURFACE) / (FLOOR - SURFACE), 0, 1);
    const v = 0.5 * lamp * (1 - dark * d);
    for (let c = 0; c < 3; c++) row[y * 3 + c] = (top[c] * (1 - d) + deep[c] * d) * v;
    fade[y] = glint * Math.exp(-(y - SURFACE) / reach);
  }

  const sandLight = 0.55 + 0.45 * lamp - 0.15 * Math.max(0, -L);
  for (let y = 0; y < H; y++) {
    const f = fade[y];
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const o = i * 3;
      let r;
      let g;
      let b;
      if (y < SURFACE) {
        r = 0;
        g = 0;
        b = 0;
      } else if (p.solid[i]) {
        r = p.ground[o] * sandLight;
        g = p.ground[o + 1] * sandLight;
        b = p.ground[o + 2] * sandLight;
      } else {
        r = row[y * 3];
        g = row[y * 3 + 1];
        b = row[y * 3 + 2];
      }
      if (y >= SURFACE && f > 0.03) {
        // The net of light: bright where three slow waves cancel, cut into two flat steps.
        const w1 = sinAt(p, x * 0.55 + t * 0.55 + 1.6 * sinAt(p, y * 0.17 + t * 0.3));
        const w2 = sinAt(p, x * 0.31 - y * 0.42 - t * 0.45);
        const w3 = sinAt(p, x * 0.16 + y * 0.27 + t * 0.23);
        const s = 1 - Math.abs(w1 + w2 + w3 * 0.7) * 2.3;
        if (s > 0) {
          const step = (s > 0.45 ? 1 : 0.4) * f;
          r += cc[0] * step;
          g += cc[1] * step;
          b += cc[2] * step;
        }
      }
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
    }
  }

  // The surface: a pale line that lifts a LED where a ripple passes.
  for (let x = 0; x < W; x++) {
    const lift = sinAt(p, x * 0.35 - t * 2.1) + sinAt(p, x * 0.17 + t * 1.3) > 1.1 ? 1 : 0;
    const o = ((SURFACE - lift) * W + x) * 3;
    const v = 0.35 + 0.4 * lamp;
    buf[o] = 120 * v + top[0] * 0.5;
    buf[o + 1] = 150 * v + top[1] * 0.5;
    buf[o + 2] = 170 * v + top[2] * 0.5;
  }

  const plant = 0.45 + 0.55 * lamp;
  for (let i = 0; i < WEEDS; i++) if (i !== 1 && i !== 5) drawWeed(p, i, plant);
  drawSprite(p, p.chest, CHEST_X, p.chestY, p.chestOpen, true, 0.5 + 0.5 * lamp);

  const fishLight = 0.5 + 0.5 * lamp;
  // The school swims furthest back and the clownfish nearest, so a fish crossing another reads as depth.
  for (let n = 0; n < DRAW_ORDER.length; n++) {
    const kind = DRAW_ORDER[n];
    for (let i = 0; i < MAX_FISH; i++) if (p.state[i] && p.kind[i] === kind) drawFish(p, i, fishLight);
  }

  // Two weeds stand in front of the fish, so a fish can pass behind them.
  drawWeed(p, 1, plant);
  drawWeed(p, 5, plant);

  for (let f = 0; f < FLAKES; f++) {
    if (p.flakeLife[f] <= 0) continue;
    put(buf, Math.floor(p.fx[f]), Math.floor(p.fy[f]), 255 * fishLight, 196 * fishLight, 96 * fishLight);
  }

  for (let bI = 0; bI < BUBBLES; bI++) {
    const by = p.by[bI];
    if (by <= 0) continue;
    const bx = p.bx[bI] + 1.1 * sinAt(p, p.bph[bI] + by * 0.27);
    const size = p.bage[bI] < 1.2 ? 0 : p.bage[bI] < 2.8 ? 1 : 2;
    const v = 0.55 + 0.35 * lamp;
    if (size === 0) splat(buf, bx, by, 170 * v, 220 * v, 255 * v, 1);
    else ring(buf, Math.round(bx), Math.round(by), size, 170 * v, 220 * v, 255 * v);
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(255, buf[o]), Math.min(255, buf[o + 1]), Math.min(255, buf[o + 2]));
    }
  }
}

function put(buf, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = r;
  buf[o + 1] = g;
  buf[o + 2] = b;
}

// A point shared over its four nearest LEDs, so it glides instead of hopping.
function splat(buf, px, py, r, g, b, amount) {
  const x0 = Math.floor(px - 0.5);
  const y0 = Math.floor(py - 0.5);
  for (let yy = y0; yy <= y0 + 1; yy++) {
    if (yy < SURFACE || yy >= H) continue;
    const wy = 1 - Math.abs(yy + 0.5 - py);
    for (let xx = x0; xx <= x0 + 1; xx++) {
      if (xx < 0 || xx >= W) continue;
      const w = wy * (1 - Math.abs(xx + 0.5 - px)) * amount;
      if (w <= 0) continue;
      const o = (yy * W + xx) * 3;
      buf[o] += (r - buf[o]) * w;
      buf[o + 1] += (g - buf[o + 1]) * w;
      buf[o + 2] += (b - buf[o + 2]) * w;
    }
  }
}

// A bubble: a diamond of four LEDs, or a round one of eight with a glint.
function ring(buf, cx, cy, size, r, g, b) {
  if (size === 1) {
    put(buf, cx, cy - 1, r, g, b);
    put(buf, cx - 1, cy, r, g, b);
    put(buf, cx + 1, cy, r, g, b);
    put(buf, cx, cy + 1, r, g, b);
  } else {
    put(buf, cx, cy - 1, r, g, b);
    put(buf, cx + 1, cy - 1, r, g, b);
    put(buf, cx - 1, cy, r, g, b);
    put(buf, cx + 2, cy, r, g, b);
    put(buf, cx - 1, cy + 1, r, g, b);
    put(buf, cx + 2, cy + 1, r, g, b);
    put(buf, cx, cy + 2, r, g, b);
    put(buf, cx + 1, cy + 2, r, g, b);
    put(buf, cx, cy, 255, 255, 255);
  }
}

function drawFish(p, i, light) {
  drawSprite(p, p.sprite[p.kind[i]], Math.round(p.x[i]), Math.round(p.y[i]), Math.floor(p.wag[i]) & 1, p.face[i] > 0, light);
}

function drawSprite(p, s, ix, iy, frame, right, light) {
  const buf = p.buf;
  const base = frame * s.w * s.h;
  for (let y = 0; y < s.h; y++) {
    const yy = iy + y;
    if (yy < SURFACE || yy >= H) continue;
    for (let x = 0; x < s.w; x++) {
      const c = s.pix[base + y * s.w + x];
      if (!c) continue;
      const xx = ix + (right ? x : s.w - 1 - x);
      if (xx < 0 || xx >= W) continue;
      const o = (yy * W + xx) * 3;
      buf[o] = s.pal[c * 3] * light;
      buf[o + 1] = s.pal[c * 3 + 1] * light;
      buf[o + 2] = s.pal[c * 3 + 2] * light;
    }
  }
}

function drawWeed(p, i, light) {
  const buf = p.buf;
  const h = p.weedH[i];
  const bx = p.weedX[i];
  const base = sandTop(bx) + 1;
  const sr = p.weedStem[i * 3] * light;
  const sg = p.weedStem[i * 3 + 1] * light;
  const sb = p.weedStem[i * 3 + 2] * light;
  const lr = p.weedLeaf[i * 3] * light;
  const lg = p.weedLeaf[i * 3 + 1] * light;
  const lb = p.weedLeaf[i * 3 + 2] * light;
  const t = p.t;
  for (let r = 0; r < h; r++) {
    const y = base - r;
    if (y < SURFACE + 2) break;
    const s = r / h;
    // The tip sways most, and the sway runs up the stem a little late.
    const off = 4.2 * s * s * sinAt(p, t * 0.85 + p.weedPh[i] - s * 2.4);
    const x = Math.round(bx + off);
    put(buf, x, y, sr, sg, sb);
    if (r < h - 8) put(buf, x + 1, y, sr, sg, sb);
    const gap = WEED_GAP[i];
    if (r > 3 && r % gap === 0 && r < h - 2) {
      const side = (r / gap) & 1 ? 1 : -1;
      const lx = side > 0 ? x + (r < h - 8 ? 2 : 1) : x - 1;
      put(buf, lx, y, lr, lg, lb);
      put(buf, lx + side, y - 1, lr, lg, lb);
      // Lower leaves are longer.
      if (s < 0.6) put(buf, lx + side * 2, y - 2, lr, lg, lb);
    }
  }
}
