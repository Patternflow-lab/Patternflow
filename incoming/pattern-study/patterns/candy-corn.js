// ===== Patternflow pattern =====
// Title:   Candy Corn
// Family:  halloween
// Idea:    Candy corn kernels, white tip, orange middle and yellow base, pour in three wandering streams from above the panel, tumble end over end down all 128 rows, bounce off a growing heap, slide down its slopes and settle at random angles, and when the heap stands high the floor splits into a trapdoor and the whole heap drops out the bottom while the pour goes on.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 45
// Round:   45
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Pour=14..44, Bounce=0..1
//
// Knob 1: Hue. The night behind the candy and the trapdoor floor, kept to the cool side so the night never turns brown: deep purple at 0, blue at 0.25, teal at 0.5, green at 0.75 and a toxic yellow-green at 1. The candy keeps its own colours.
// Knob 2: Speed. Runs the whole scene faster or slower: at 2 a kernel takes about 2.6 seconds to fall the panel, and at the lowest pour the heap fills in 4.5 to 6 seconds and drains in about 2; at 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Pour. Kernels a second at Speed 2, 14 to 44. At 14 about 40 kernels are in the air at once and the heap fills and drops every 6.5 to 8 seconds; at 44 about 120 are in the air and it goes every 4.5 seconds.
// Knob 4: Bounce. How hard a kernel bounces off the heap: at 0.06 it keeps a fifth of its speed, hops less than a row and skids; at 1 it keeps nine tenths, springs back up 4 to 10 rows and skitters sideways up to 25 LEDs, so the heap spreads flatter.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, sin, cos, abs, round, random, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + (b - a) * random();
const gauss = () => (random() + random() + random() - 1.5) * 1.15;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The three bands of a kernel, base to tip. The orange is full and bright:
// any darker and it reads brown on LEDs.
const YELLOW = [255, 205, 18], ORANGE = [255, 112, 0], WHITE = [255, 248, 232];
// A kernel is 8 LEDs from base to tip and 5.8 across the base, give or
// take the 0.98 to 1.14 size each kernel draws.
const LEN = 8, BASE = 2.9;
// The floor: its top row, and the rows under it where the trapdoor swings.
const FLOOR = 120;
// Fall: gravity and the speed drag holds a kernel to, in LEDs per second at
// Speed 2. Candy is light; at 55 a second a kernel stays about a second in
// the top third, and that is what keeps the top of the panel busy.
const G = 150, VT = 55;
// The heap is full when its mean height over the middle columns reaches
// this many rows, or one peak reaches PEAK.
const FULL = 40, PEAK = 66;
// The trapdoor opens and closes in this many seconds.
const DOOR = 0.35;
// Rows a kernel may overlap those under it, and the drop over 4 columns
// past which a kernel slides on: about the angle a heap of candy holds.
const OVERLAP = 3, SLOPE = 4;

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, pour: 14, bounce: 0.06,
    kernels: [], acc: 0,
    // Height of the heap's surface: the top lit row in each column.
    surf: new Float32Array(W).fill(FLOOR),
    // The settled heap, drawn once into a buffer as each kernel comes to rest.
    heap: new Uint8Array(N * 3), mask: new Uint8Array(N),
    door: 0, open: false, held: 0, warm: 0,
    bg: null, bgHue: NaN,
  };
}

// The corners of a kernel at angle a, in panel offsets from its centre: the
// two base corners and the two sides of the blunt tip. The tip points up at
// angle 0.
function extent(k) {
  const L = LEN * k.sz, B = BASE * k.sz, sa = sin(k.a), ca = cos(k.a);
  let x0 = 9, x1 = -9, y1 = -9;
  for (const [s, t] of [[-L / 2, -B], [-L / 2, B], [L / 2, -0.3 * B], [L / 2, 0.3 * B]]) {
    const dx = s * sa + t * ca, dy = -s * ca + t * sa;
    x0 = min(x0, dx);
    x1 = max(x1, dx);
    y1 = max(y1, dy);
  }
  return [x0, x1, y1];
}

// Every LED the kernel covers, with its colour: a blunt triangle with a
// rounded base, banded yellow, orange and white from base to tip.
function raster(k, out) {
  const L = LEN * k.sz, B = BASE * k.sz, sa = sin(k.a), ca = cos(k.a), R = L / 2 + 1;
  for (let py = floor(k.y - R); py <= ceil(k.y + R); py++) {
    if (py < 0 || py >= H) continue;
    for (let px = floor(k.x - R); px <= ceil(k.x + R); px++) {
      if (px < 0 || px >= W) continue;
      const dx = px + 0.5 - k.x, dy = py + 0.5 - k.y;
      const s = dx * sa - dy * ca, t = dx * ca + dy * sa, q = (s + L / 2) / L;
      if (q < 0 || q > 1) continue;
      let hw = B * (1 - 0.74 * q);
      if (q < 0.16) hw *= 0.78 + 1.375 * q;
      if (abs(t) > hw) continue;
      out(px, py, q < 0.37 ? YELLOW : q < 0.7 ? ORANGE : WHITE);
    }
  }
}

function spawn(S) {
  // Three streams whose mouths wander slowly across the top, out of step.
  const i = floor(random() * 3), c = 32 + 21 * sin(S.t * (0.23 + 0.07 * i) + 2.1 * i);
  S.kernels.push({
    x: cl(c + gauss() * 3.5, 4, 60), y: -5, vx: gauss() * 7, vy: rnd(4, 16),
    a: rnd(0, TAU), w: gauss() * 6, st: 0, slide: 0, delay: 0, drop: 0, sz: rnd(0.98, 1.14), sh: rnd(0.86, 1),
  });
}

// How far a kernel has sunk into the heap: the most any of its LEDs lies
// below the surface row of its column, less the three rows a kernel may
// overlap the ones it rests on. The overlap packs the heap the way a jumble
// of candy looks; resting on the top row alone left it full of holes. Also
// notes the column where the kernel sank deepest.
function sink(S, k) {
  let p = -1e9;
  const surf = S.surf;
  raster(k, (x, y) => {
    const v = y - surf[x] + 1 - OVERLAP;
    if (v > p) (p = v), (S.deep = x);
  });
  return p;
}

// Stamp a kernel into the heap and raise the surface under it.
function settle(S, k) {
  k.st = 2;
  const heap = S.heap, mask = S.mask, surf = S.surf, sh = k.sh;
  raster(k, (x, y, c) => {
    const i = y * W + x;
    heap[i * 3] = c[0] * sh;
    heap[i * 3 + 1] = c[1] * sh;
    heap[i * 3 + 2] = c[2] * sh;
    mask[i] = 1;
    if (y < surf[x]) surf[x] = y;
  });
}

function step(S, k, d) {
  const e = 0.15 + 0.75 * S.bounce;
  if (k.st === 3) {
    // Waiting on the open trapdoor: the bottom of the heap goes first.
    k.delay -= d;
    if (k.delay <= 0) k.st = 0;
    return;
  }
  const ox = k.x, oy = k.y, oa = k.a;
  if (k.st === 0) {
    k.vy += (G - (G / VT) * k.vy) * d;
    k.vx -= k.vx * 0.8 * d;
    k.x += k.vx * d;
    k.y += k.vy * d;
    k.a += k.w * d;
  }
  const [x0, x1] = extent(k);
  // The side walls of the panel.
  if (k.x + x0 < 0) (k.x = -x0), (k.vx = abs(k.vx) * 0.4);
  if (k.x + x1 > W) (k.x = W - x1), (k.vx = -abs(k.vx) * 0.4);
  // Under the floor line, or with the trapdoor open, nothing holds a kernel.
  if (S.open || k.y > FLOOR + 3) return;
  if (k.st === 0) {
    let p = sink(S, k);
    if (p <= 0) return;
    // Sunk deeper than this step's fall: it ran into the side of a peak, not
    // onto it. Take back the sideways move and the turn and glance off;
    // lifting it to the top instead built the heap into thin towers.
    const fair = max(0, k.y - oy) + 1.5;
    if (p > fair) {
      k.x = ox;
      k.a = oa;
      k.vx = -k.vx * 0.5;
      k.w = -k.w * 0.5;
      p = sink(S, k);
      if (p > fair) {
        k.x += k.x < S.deep + 0.5 ? -1 : 1;
        k.vx += k.x < S.deep + 0.5 ? -6 : 6;
        return;
      }
      if (p <= 0) return;
    }
    k.y -= p;
    if (k.vy > 20) {
      // A bounce: back up with some of its speed, kicked sideways and spun.
      k.vy = -k.vy * e * rnd(0.7, 1.1);
      k.vx = k.vx * 0.4 + gauss() * (6 + 40 * e);
      k.w = gauss() * (6 + 12 * e);
      return;
    }
    k.st = 1;
    k.slide = 0;
  }
  // On the heap: slide down the steeper side while the slope is steeper
  // than the candy can hold, rolling as it goes, then come to rest.
  const c = cl(floor(k.x), 0, W - 1), surf = S.surf;
  const top = min(surf[max(0, c - 1)], surf[c], surf[min(W - 1, c + 1)]);
  const l = c >= 4 ? surf[c - 4] : -1e9, r = c <= W - 5 ? surf[c + 4] : -1e9;
  const drop = max(l, r) - top, dir = r > l ? 1 : -1;
  k.slide += d;
  if (drop >= SLOPE && k.slide < 1.6) {
    const sx = k.x, sa = k.a;
    k.x += dir * 22 * d;
    k.a += dir * 5 * d;
    const p = sink(S, k);
    if (p > 1.5) {
      // Slid into something higher: stop where it was.
      k.x = sx;
      k.a = sa;
      settle(S, k);
    } else if (p < -2) {
      // Off the edge of a step it falls again.
      (k.st = 0), (k.vy = 0), (k.vx = dir * 16);
    } else k.y -= p;
    return;
  }
  settle(S, k);
}

// One step of the scene, d seconds of scene time.
function advance(S, d) {
  S.t += d;
  S.acc += S.pour * d;
  while (S.acc >= 1) {
    S.acc -= 1;
    spawn(S);
  }
  // Two sub-steps a frame keep a fast kernel from passing through a peak.
  for (let n = 0; n < 2; n++) for (const k of S.kernels) if (k.st !== 2) step(S, k, d / 2);
  S.kernels = S.kernels.filter((k) => k.y < H + 10);
  // The trapdoor.
  if (!S.open) {
    S.door = max(0, S.door - d / DOOR);
    let sum = 0, peak = FLOOR;
    for (let x = 6; x < W - 6; x++) (sum += FLOOR - S.surf[x]), (peak = min(peak, S.surf[x]));
    if (sum / (W - 12) >= FULL || FLOOR - peak >= PEAK) {
      S.open = true;
      S.held = 0;
      // Every kernel in the heap lets go, the lowest first and the top ones
      // up to 0.4 seconds later, each with a little spin, so the heap pours
      // out from below instead of dropping as one block.
      for (const k of S.kernels) if (k.st === 2 || k.st === 1) (k.st = 3), (k.drop = 1), (k.delay = (FLOOR - k.y) * 0.009 + random() * 0.06), (k.vy = 0), (k.vx = gauss() * 5), (k.w = gauss() * 4);
      S.heap.fill(0);
      S.mask.fill(0);
    }
  } else {
    S.door = min(1, S.door + d / DOOR);
    S.held += d;
    if (S.held > 0.6 && !S.kernels.some((k) => k.drop)) {
      S.open = false;
      S.surf.fill(FLOOR);
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 14, 0.06];
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  S.pour = cl(kv[2], 14, 44);
  S.bounce = cl(kv[3], 0, 1);
  // The pattern opens on a pour already under way: the first 2.2 seconds
  // of candy have fallen and the heap has begun.
  if (!S.warm) {
    S.warm = 1;
    for (let n = 0; n < 66; n++) advance(S, 1 / 30);
  }
  advance(S, cl(dt || 0, 0, 0.1) * (S.speed / 2));
}

function backdrop(S) {
  // Night behind the candy, kept at or under 24 of 255 so only the candy
  // and the floor count as lit, a little lighter toward the floor.
  const h = 0.78 - 0.55 * S.hue;
  S.bg = new Uint8Array(H * 3);
  for (let y = 0; y < H; y++) {
    const c = hsv(h, 0.85, 0.05 + 0.044 * (y / H));
    for (let j = 0; j < 3; j++) S.bg[y * 3 + j] = round(255 * c[j]);
  }
  S.floor = hsv(h, 0.55, 0.85);
  S.floorDark = hsv(h, 0.7, 0.5);
  S.bgHue = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.bgHue !== S.hue) backdrop(S);
  const bg = S.bg, heap = S.heap, mask = S.mask;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (mask[i]) display.setPixel(x, y, heap[i * 3], heap[i * 3 + 1], heap[i * 3 + 2]);
      else display.setPixel(x, y, bg[y * 3], bg[y * 3 + 1], bg[y * 3 + 2]);
    }
  // The trapdoor: two leaves hinged at the walls, swinging down from the
  // floor line as it opens. Drawn under the candy so kernels fall in front.
  const th = (S.door * PI) / 2, fc = S.floor, fd = S.floorDark;
  for (let side = 0; side < 2; side++)
    for (let r = 0; r < 32; r += 0.5)
      for (let w = 0; w < 2; w++) {
        const px = side ? W - 1 - r * cos(th) : r * cos(th), py = FLOOR + w + r * sin(th);
        const x = round(px), y = round(py);
        if (y >= H || x < 0 || x >= W || mask[y * W + x]) continue;
        const c = w ? fd : fc;
        display.setPixel(x, y, round(255 * c[0]), round(255 * c[1]), round(255 * c[2]));
      }
  // Kernels in the air and on the move, over the heap.
  for (const k of S.kernels) {
    if (k.st === 2) continue;
    const sh = k.sh;
    raster(k, (x, y, c) => display.setPixel(x, y, round(c[0] * sh), round(c[1] * sh), round(c[2] * sh)));
  }
}
