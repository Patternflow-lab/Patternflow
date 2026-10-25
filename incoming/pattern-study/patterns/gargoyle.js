// ===== Patternflow pattern =====
// Title:   Gargoyle
// Family:  halloween
// Idea:    A stone gargoyle juts from a cathedral ledge into a night storm, rain slanting across bruised purple clouds, and pours the gutter's water from its open jaws in a long arc that falls the whole height of the panel into a splashing puddle; every few seconds lightning flashes behind the spires, throws the stone into black silhouette with a bright rim, and leaves the gargoyle's eyes glowing poison green.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 49
// Round:   49
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Rain=0..1, Lightning=0..1
//
// Knob 1: Hue. The storm's tint, kept to the cool side so the dark sky never reads brown: bruised violet at 0, blue at 0.25, teal at 0.5, sea green at 0.75 and a sickly green at 1. The stone takes a little of it; the water, the stained glass and the green eyes stay as they are.
// Knob 2: Speed. At 2 a parcel of water takes 1.2 seconds from the jaws to the puddle and a raindrop crosses the panel in 0.8; at 0.2 the water hangs ten times slower, at 3 it falls half as fast again. The clouds scud on the same clock, and the gaps between strikes stretch up to 1.6 times at 0.2 and shrink by a fifth at 3. A flash always lasts the same half second.
// Knob 3: Rain. At 0 a steady rain of 90 drops and a stream three LEDs thick that frays into drops on the way down; at 1 a downpour of 280 drops slanting harder, and a gush four LEDs thick at the jaws, thrown 5 LEDs further, that frays to eight and splashes twice as high.
// Knob 4: Lightning. The first strike always comes 1.5 seconds after the start. Then at 0 one every 4.5 seconds on average, a bolt with at most one branch; at the opening 0.06 one every 4.3; at 1 one every 0.9 seconds, brighter, with up to five branches and a third return stroke. Each strike leaves the eyes glowing green for about 2.5 seconds.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, exp, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const q20 = (v) => floor(v * 20) / 20;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// A fixed generator for the stonework, so the cathedral never changes;
// Math.random is left for the weather.
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Smooth value noise on a 16 x 16 lattice that wraps, for the clouds.
const LAT = new Float32Array(256);
{
  const r = prng(11);
  for (let i = 0; i < 256; i++) LAT[i] = r();
}
function noise(x, y) {
  const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = LAT[(yi & 15) * 16 + (xi & 15)], b = LAT[(yi & 15) * 16 + ((xi + 1) & 15)];
  const c = LAT[((yi + 1) & 15) * 16 + (xi & 15)], d = LAT[((yi + 1) & 15) * 16 + ((xi + 1) & 15)];
  return mix(mix(a, b, u), mix(c, d, u), v);
}

// What each LED is: sky, the far tower, a near pinnacle, the near wall and
// ledge, the gargoyle, its open mouth, the street, the puddle, stained glass.
const SKY = 0, FAR = 1, PIN = 2, WALL = 3, GARG = 4, MOUTH = 5, STREET = 6, POOL = 7, GLASS = 8;
// The water leaves the jaws here; the street's top row; the puddle.
const MX = 34.5, MY = 25, GROUND = 120, PX = 51, PY = 123.5, PRX = 13, PRY = 3.6;
// The eye, two LEDs on the head.
const EYE = [20 * W + 29, 20 * W + 30];
// Water: gravity and the jet's speed out of the jaws at Speed 2, in LEDs.
const G = 150, VX = 14, VY = -6, WIND = 3;
// Raindrops on the panel at Rain 0 and at 1, and their fall in LEDs a second.
const RAIN0 = 90, RAIN1 = 280, FALL = 165;
// Where a new drop starts: far enough left that its slant brings it in.
const spawnX = (vx) => -((vx / FALL) * H) + (W + (vx / FALL) * H) * Math.random();

const inEl = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
function inCap(x, y, ax, ay, bx, by, r) {
  const dx = bx - ax, dy = by - ay, t = cl(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return hypot(x - ax - t * dx, y - ay - t * dy) < r;
}
function inPoly(x, y, P) {
  let c = false;
  for (let i = 0, j = P.length - 2; i < P.length; j = i, i += 2)
    if (P[i + 1] > y !== P[j + 1] > y && x < ((P[j] - P[i]) * (y - P[i + 1])) / (P[j + 1] - P[i + 1]) + P[i]) c = !c;
  return c;
}
// The gargoyle, crouched on the ledge facing right: haunch, back, chest,
// neck, head, snout and jaw, horn and ear, legs, and a folded bat wing.
const WING = [17, 24.5, 14, 19, 10.5, 13.5, 10, 18, 6.8, 14.5, 6, 19.5, 2.6, 17.5, 3.4, 24, 8, 27.5];
function gargoyle(x, y) {
  if (inPoly(x, y, [27.4, 24.3, 34.8, 23.7, 34.3, 26.1, 27.6, 25.7])) return MOUTH;
  const body =
    inEl(x, y, 9, 31.5, 7.5, 6.5) || inCap(x, y, 9, 28, 20, 26.5, 5) || inEl(x, y, 21, 29.5, 4, 5) ||
    inCap(x, y, 22, 26, 26.5, 22.5, 3.3) || inEl(x, y, 28, 21.5, 4.2, 3.6) || inCap(x, y, 29, 21.6, 34.2, 22.6, 1.7) ||
    inCap(x, y, 27.5, 26.4, 32.8, 27.2, 1.2) || inPoly(x, y, [25.2, 19.5, 27.6, 18.6, 22, 11.5]) || inPoly(x, y, [29, 18.8, 31, 19.2, 31.6, 14.6]) ||
    inCap(x, y, 21.5, 32, 22.5, 37, 2.1) || inEl(x, y, 23.6, 37.4, 2.7, 1.3) || inCap(x, y, 5.5, 33, 7.5, 37.2, 2.4) ||
    inEl(x, y, 9.2, 37.6, 3, 1) || inPoly(x, y, WING);
  return body ? GARG : -1;
}

export function setup(params) {
  const kind = new Uint8Array(N), tone = new Float32Array(N), rnd = prng(5);
  const blk = new Float32Array(64);
  for (let i = 0; i < 64; i++) blk[i] = 0.42 + 0.16 * rnd();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, cx = x + 0.5, cy = y + 0.5;
      let k = SKY, t = 0;
      // The far tower: a spire with crockets every 8 rows on a square tower,
      // corner pinnacles where they meet.
      const ax = abs(cx - 52);
      if (y >= 72 && ax <= 6.5) k = FAR;
      else if (y >= 12 && y < 72 && ax <= 0.6 + (5.4 * (y - 12)) / 60 + ((y - 12) % 8 < 2 ? 1 : 0)) k = FAR;
      else if (y >= 62 && y < 72 && (abs(cx - 45.5) <= ((y - 62) * 1.2) / 10 || abs(cx - 58.5) <= ((y - 62) * 1.2) / 10)) k = FAR;
      // Two near pinnacles on the parapet, then the parapet, the ledge
      // and the wall with its blocks.
      for (const [px, tip, hw] of [[4.5, 1, 4.2], [20, 4, 3.2]]) {
        if (y >= tip && y < 30) {
          const u = y - tip, w = u < 3 ? (u === 1 ? 1.4 : 0.6) : 0.5 + (hw * (u - 3)) / (27 - tip) + (u % 5 === 3 ? 1 : 0);
          if (abs(cx - px) <= w) (k = PIN), (t = cx < px ? 0.66 : 0.42);
        }
      }
      if (y >= 30 && y < 38 && x <= 22) (k = WALL), (t = y >= 32 && y <= 35 && x % 5 >= 2 && x % 5 <= 3 ? 0.08 : 0.5);
      if (y >= 38 && y < 42 && x <= 24) (k = WALL), (t = [0.85, 0.62, 0.45, 0.25][y - 38]);
      if (y >= 42 && y < GROUND && x <= 14) {
        k = WALL;
        const row = floor((y - 42) / 6), bx = x + (row & 1 ? 4 : 0);
        t = (y - 42) % 6 === 5 || bx % 8 === 7 ? 0.22 : blk[(row * 3 + floor(bx / 8)) & 63];
        if (x === 14) t *= 0.6;
        // A lancet window with a pointed head and diamond leading.
        const wy = y - 58, hwin = wy < 0 ? -1 : wy < 6 ? 3 * sqrt(1 - ((6 - wy) / 6.5) ** 2) - 0.3 : 3;
        if (y <= 92 && abs(cx - 7.5) <= hwin) (k = GLASS), (t = (x + y) % 4 === 0 || (x - y + 400) % 4 === 0 ? 0 : 1 + ((floor((x + y) / 4) + floor((x - y + 400) / 4)) % 3));
        else if (y <= 93 && abs(cx - 7.5) <= hwin + 1.2 && wy >= -1) t = 0.75;
      }
      // Cobbles in rows two LEDs deep, wider toward us, each row offset by
      // half a stone, the top of each stone wet and lighter.
      if (y >= GROUND) {
        const row = (y - GROUND) >> 1, sw = 3 + (row >> 1), sx = x + (row & 1 ? sw >> 1 : 0);
        k = STREET;
        t = sx % sw === 0 ? 0.06 : (y - GROUND) & 1 ? 0.16 : 0.27 + 0.08 * ((floor(sx / sw) * 5 + row) % 3 === 0);
      }
      if (y >= GROUND && inEl(cx, cy, PX, PY, PRX, PRY)) k = POOL;
      const g = gargoyle(cx, cy);
      if (g >= 0) k = g;
      (kind[p] = k), (tone[p] = t);
    }
  // The gargoyle's stone shaded by how deep each LED lies inside it (a
  // chamfer distance) and which way the edge faces: lit from the upper left
  // in four steps; the wing ribs and the mouth dark, teeth pale.
  const d = new Float32Array(N);
  for (let p = 0; p < N; p++) d[p] = kind[p] === GARG || kind[p] === MOUTH ? 99 : 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const p = y * W + x; d[p] = min(d[p], d[p - 1] + 1, d[p - W] + 1, d[p - W - 1] + 1.4, d[p - W + 1] + 1.4); }
  for (let y = H - 2; y > 0; y--) for (let x = W - 2; x > 0; x--) { const p = y * W + x; d[p] = min(d[p], d[p + 1] + 1, d[p + W] + 1, d[p + W + 1] + 1.4, d[p + W - 1] + 1.4); }
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (kind[p] !== GARG) continue;
      const gx = min(d[p + 1], 4) - min(d[p - 1], 4), gy = min(d[p + W], 4) - min(d[p - W], 4), gl = hypot(gx, gy) || 1;
      const face = d[p] < 3.5 ? (0.55 * gx + 0.8 * gy) / gl : 0, lit = 0.6 + 0.4 * face * (1 - min(d[p], 3) / 4);
      tone[p] = [0.32, 0.48, 0.64, 0.82][cl(floor(lit * 4 - 0.6), 0, 3)];
    }
  const rib = (ax, ay, bx, by) => {
    for (let s = 0; s <= 20; s++) {
      const p = floor(mix(ay, by, s / 20)) * W + floor(mix(ax, bx, s / 20));
      if (kind[p] === GARG) tone[p] = 0.2;
    }
  };
  rib(16, 24, 10.5, 14.5), rib(15.5, 24.5, 7, 15.5), rib(15, 25, 3, 18.5);
  for (let x = 28; x <= 34; x += 2) {
    if (kind[24 * W + x] === MOUTH) (tone[24 * W + x] = 1), (kind[24 * W + x] = GARG);
    if (kind[25 * W + x + 1] === MOUTH) (tone[25 * W + x + 1] = 1), (kind[25 * W + x + 1] = GARG);
  }
  for (const p of EYE) tone[p] = 0.06;
  tone[19 * W + 29] = tone[19 * W + 30] = 0.9;
  // The trough along the gargoyle's back that carries the gutter's water to
  // its jaws: the top LED of its stone in each column from the wing to the head.
  const trough = [];
  for (let x = 17; x <= 26; x++)
    for (let y = 14; y < 40; y++)
      if (inCap(x + 0.5, y + 0.5, 9, 28, 20, 26.5, 5) || inCap(x + 0.5, y + 0.5, 22, 26, 26.5, 22.5, 3.3)) {
        if (kind[y * W + x] === GARG) trough.push(y * W + x);
        break;
      }
  // The puddle's far edge, where it meets the cobbles, catches the light.
  for (let p = W; p < N; p++) if (kind[p] === POOL && kind[p - W] !== POOL) tone[p] = 1;
  // Stone that touches the sky catches the flash behind it.
  const rim = new Uint8Array(N);
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x, k = kind[p];
      if (k === SKY || k >= STREET) continue;
      if (kind[p - W] === SKY || kind[p + 1] === SKY || kind[p - 1] === SKY) rim[p] = 1;
    }
  params.s = {
    kind, tone, rim, trough,
    hue: 0, speed: 2, rain: 0, bolt: 0.06, t: 0, clock: 0, flow: 0,
    landX: 50, strikeAt: -9, next: 1.5, strokes: [0], boltMask: new Float32Array(N), boltX: 40, amp: 0.6, eye: 0,
    jet: new Float32Array(1200 * 4), nj: 0, emit: 0,
    drops: new Float32Array(RAIN1 * 3), spl: new Float32Array(300 * 4), ns: 0,
    rip: new Float32Array(48 * 3), nr: 0, ripAt: 0,
    rgb: new Float32Array(N * 3), pal: new Float32Array(21 * 11 * 3), palH: -1, near: new Float32Array(W),
  };
  const S = params.s;
  for (let i = 0; i < RAIN1; i++) (S.drops[i * 3] = spawnX(28)), (S.drops[i * 3 + 1] = -8 + 136 * Math.random()), (S.drops[i * 3 + 2] = 0.8 + 0.4 * Math.random());
  // The stream is already falling when the picture opens.
  for (let i = 0; i < 45; i++) water(S, 1 / 30);
}

// A new bolt: a jagged channel from above the panel down behind the far
// tower or the wall, with branches; drawn into a mask the sky reads.
function strike(S) {
  const m = S.boltMask, n = 1 + floor(4 * S.bolt);
  m.fill(0);
  let x = 22 + 40 * Math.random(), y = -2;
  S.boltX = x;
  const end = 70 + 35 * Math.random(), lean = (Math.random() - 0.5) * 1.2;
  const put = (px, py, v) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = floor(px) + dx, yy = floor(py) + dy;
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const w = dx || dy ? v * 0.3 : v;
        if (m[yy * W + xx] < w) m[yy * W + xx] = w;
      }
  };
  const seg = (x0, y0, x1, y1, v) => {
    const s = ceil1(max(abs(x1 - x0), abs(y1 - y0)));
    for (let i = 0; i <= s; i++) put(mix(x0, x1, i / s), mix(y0, y1, i / s), v);
  };
  const forks = [];
  while (y < end) {
    const nx = x + lean + (Math.random() - 0.5) * 5, ny = y + 2 + 3 * Math.random();
    seg(x, y, nx, ny, 1);
    if (forks.length < n && Math.random() < 0.12) forks.push([nx, ny, Math.random() < 0.5 ? -1 : 1]);
    (x = nx), (y = ny);
  }
  for (const [fx, fy, sg] of forks) {
    let bx = fx, by = fy;
    const len = 6 + floor(10 * Math.random());
    for (let i = 0; i < len; i++) {
      const nx = bx + sg * (1 + 2 * Math.random()), ny = by + 1.5 + 2 * Math.random();
      seg(bx, by, nx, ny, 0.6);
      (bx = nx), (by = ny);
    }
  }
  S.strokes = S.bolt > 0.5 ? [0, 0.16, 0.31] : [0, 0.16];
  S.amp = 0.72 + 0.28 * S.bolt;
  S.strikeAt = S.t;
}
const ceil1 = (v) => Math.max(1, Math.ceil(v));

// The water for h seconds of the story: parcels leave the jaws, fall under
// gravity with a little wind and land in the puddle, throwing up splashes
// and rings; the rain falls and rings the puddle too.
function water(S, h) {
  const jet = S.jet, rain = S.rain;
  S.emit += h * (190 + 170 * rain);
  while (S.emit >= 1 && S.nj < 1200) {
    S.emit--;
    const o = S.nj++ * 4, gs = () => Math.random() + Math.random() - 1;
    jet[o] = MX + 2 * Math.random() - 1;
    jet[o + 1] = MY + (Math.random() - 0.5) * (2.2 + 2.2 * rain);
    jet[o + 2] = VX * (1 + 0.3 * rain) + gs() * (2.2 + 1.6 * rain);
    jet[o + 3] = VY + gs() * (1.2 + rain);
  }
  for (let i = 0; i < S.nj; i++) {
    const o = i * 4;
    jet[o + 3] += G * h;
    jet[o + 2] += WIND * h;
    jet[o] += jet[o + 2] * h;
    jet[o + 1] += jet[o + 3] * h;
    const x = jet[o], y = jet[o + 1];
    if (y >= GROUND + 1 || x > W + 4) {
      if (inEl(x, y, PX, PY, PRX, PRY)) {
        S.landX = mix(S.landX, x, 0.05);
        const n = Math.random() < 0.5 + 0.4 * rain ? 1 + floor(Math.random() * 2) : 0;
        for (let k = 0; k < n && S.ns < 300; k++) {
          const s = S.ns++ * 4;
          (S.spl[s] = x), (S.spl[s + 1] = GROUND + 1), (S.spl[s + 2] = (Math.random() - 0.5) * 50), (S.spl[s + 3] = -(25 + 45 * Math.random()) * (1 + rain));
        }
        if (S.t >= S.ripAt) (S.ripAt = S.t + 0.12), ring(S, x, y);
      }
      // Removed by moving the last parcel into its slot.
      S.nj--;
      for (let k = 0; k < 4; k++) jet[o + k] = jet[S.nj * 4 + k];
      i--;
    }
  }
  for (let i = 0; i < S.ns; i++) {
    const o = i * 4, sp = S.spl;
    sp[o + 3] += G * h;
    sp[o] += sp[o + 2] * h;
    sp[o + 1] += sp[o + 3] * h;
    if (sp[o + 1] > GROUND + 2) {
      S.ns--;
      for (let k = 0; k < 4; k++) sp[o + k] = sp[S.ns * 4 + k];
      i--;
    }
  }
  const dr = S.drops, live = RAIN0 + floor((RAIN1 - RAIN0) * rain), vx = 28 + 34 * rain;
  for (let i = 0; i < RAIN1; i++) {
    const o = i * 3;
    dr[o] += vx * h * dr[o + 2];
    dr[o + 1] += FALL * h * dr[o + 2];
    if (dr[o + 1] > GROUND + 1 + 7 * ((i * 0.37) % 1)) {
      if (i < live && inEl(dr[o], dr[o + 1], PX, PY, PRX, PRY) && Math.random() < 0.5) ring(S, dr[o], dr[o + 1]);
      (dr[o] = spawnX(vx)), (dr[o + 1] = -6 - 6 * Math.random()), (dr[o + 2] = 0.8 + 0.4 * Math.random());
    }
  }
  for (let i = 0; i < S.nr; i++) {
    S.rip[i * 3 + 2] += h;
    if (S.rip[i * 3 + 2] > 0.55) {
      S.nr--;
      for (let k = 0; k < 3; k++) S.rip[i * 3 + k] = S.rip[S.nr * 3 + k];
      i--;
    }
  }
}
function ring(S, x, y) {
  if (S.nr >= 48) return;
  const o = S.nr++ * 3;
  (S.rip[o] = x), (S.rip[o + 1] = y), (S.rip[o + 2] = 0);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.rain = cl(k[2], 0, 1);
  S.bolt = cl(k[3], 0, 1);
  const h = (d * S.speed) / 2;
  S.t += d;
  S.clock += h;
  S.flow += h;
  water(S, h);
  // Strikes: the first at 1.5 s, then gaps round the Lightning knob's mean.
  if (S.t >= S.next || (input.btnPressed && input.btnPressed.some(Boolean))) {
    strike(S);
    S.next = S.t + mix(4.5, 0.9, S.bolt) * (0.7 + 0.6 * Math.random()) * min(2.5, 2 / S.speed) ** 0.5;
  }
  // The eyes kindle a quarter second after each strike, glow, and fade.
  const e = S.t - S.strikeAt;
  S.eye = e < 0.25 ? max(0, S.eye - d) : e < 0.45 ? max(S.eye, sm(0.25, 0.45, e)) : e < 2 ? 1 : 1 - sm(2, 3, e);
}

// How bright the strike is t seconds after it began: a spike for each return
// stroke and an afterglow; and how strongly the channel itself shows.
function flashAt(S, t) {
  if (t < 0 || t > 2) return [0, 0];
  let spike = 0, chan = 0;
  for (const s of S.strokes)
    if (t >= s) (spike = max(spike, exp(-(t - s) / 0.05))), (chan = max(chan, exp(-(t - s) / 0.1)));
  return [min(1, 0.7 * spike + 0.3 * exp(-t / 0.4)) * S.amp, chan];
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { kind, tone, rim, rgb } = S;
  const [flash, chan] = flashAt(S, S.t - S.strikeAt), fq = q20(flash);
  const skyH = 0.78 - 0.45 * S.hue, lite = hsv(skyH, 0.28, 0.86), stone = hsv(skyH - 0.04, 0.16, 0.62);
  const dark = 1 - min(1, flash * 2.4), far = hsv(skyH, 0.55, 0.1);
  const glass = [[0.04, 0.02, 0.05], [1, 0.74, 0.16], [0.86, 0.1, 0.2], [0.36, 0.3, 0.95]];
  const flick = 0.62 + 0.08 * floor(3 * noise(S.clock * 3, 4.5));
  // The sky's colours for this hue by brightness step and cloud step, and
  // how much of the flash each column gets from the bolt's place.
  const pal = S.pal, near = S.near;
  if (S.palH !== skyH) {
    S.palH = skyH;
    for (let vi = 0; vi <= 20; vi++) for (let ci = 0; ci <= 10; ci++) pal.set(hsv(skyH + 0.003 * ci, 0.72 - 0.03 * ci, vi / 20), (vi * 11 + ci) * 3);
  }
  for (let x = 0; x < W; x++) near[x] = 0.55 + 0.45 * exp(-((x - S.boltX) ** 2) / 500);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = p * 3, k = kind[p];
      let r, g, b;
      if (k === SKY || k === POOL) {
        // Bruised clouds drifting right, in 1/20 steps, lighter toward the
        // street; the puddle shows the sky over it, darker.
        const yy = k === POOL ? 2 * GROUND - y - 30 : y;
        const c1 = noise(x / 17 + S.clock * 0.3, yy / 11 + 1 + S.clock * 0.04), c2 = noise(x / 8 + S.clock * 0.55 + 5, yy / 6);
        const ci = floor(cl((0.7 * c1 + 0.3 * c2 - 0.32) * 1.8, 0, 0.99) * 10), cq = ci / 10;
        const vi = floor((0.15 + 0.13 * (yy / H) + 0.22 * cq * cq) * (k === POOL ? 15 : 20)), po = (vi * 11 + ci) * 3;
        const f = q20(fq * near[x] * (0.8 + 0.3 * cq)) * (k === POOL ? 0.6 : 1);
        (r = mix(pal[po], lite[0], f)), (g = mix(pal[po + 1], lite[1], f)), (b = mix(pal[po + 2], lite[2], f));
        const bl = k === SKY ? S.boltMask[p] * chan : 0;
        if (bl > 0.05) (r = mix(r, 1, bl)), (g = mix(g, 1, bl)), (b = mix(b, 1, bl));
        // In the puddle: the lit far edge, and the falling stream mirrored
        // under the place it lands.
        if (k === POOL) {
          const e = tone[p] ? 0.4 : abs(x + 0.5 - S.landX) < 1.6 ? 0.3 : 0;
          if (e) (r = mix(r, 0.7, e)), (g = mix(g, 0.86, e)), (b = mix(b, 1, e));
        }
      } else if (k === FAR) {
        (r = far[0] * dark), (g = far[1] * dark), (b = far[2] * dark);
        if (rim[p]) (r += lite[0] * fq * 0.7), (g += lite[1] * fq * 0.7), (b += lite[2] * fq * 0.7);
      } else if (k === GLASS) {
        const c = glass[tone[p]], v = flick;
        (r = c[0] * v), (g = c[1] * v), (b = c[2] * v);
      } else if (k === STREET) {
        const v = tone[p] * (1 + fq);
        (r = stone[0] * v), (g = stone[1] * v), (b = stone[2] * v);
      } else {
        // Stone: lit dimly by the storm, black against the flash, its edges
        // catching the light behind it.
        const v = k === MOUTH ? 0.04 : tone[p] * (k === PIN ? 0.8 : 1), dk = k === PIN ? dark : mix(dark, 1, 0.25);
        (r = stone[0] * v * dk), (g = stone[1] * v * dk), (b = stone[2] * v * dk);
        if (rim[p]) (r += lite[0] * fq), (g += lite[1] * fq), (b += lite[2] * fq);
      }
      (rgb[o] = r), (rgb[o + 1] = g), (rgb[o + 2] = b);
    }
  const add = (x, y, c, v) => {
    x = floor(x), y = floor(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    (rgb[o] = max(rgb[o], c[0] * v)), (rgb[o + 1] = max(rgb[o + 1], c[1] * v)), (rgb[o + 2] = max(rgb[o + 2], c[2] * v));
  };
  // The trough on its back: water glinting as it runs to the jaws.
  const wat = [0.66, 0.86, 1];
  S.trough.forEach((p, i) => add(p % W, floor(p / W), wat, (i - S.flow * 14) % 5 < -3.5 || (i - S.flow * 14) % 5 > 3.5 ? 0.85 : 0.42));
  // The puddle's rings, flattened by the angle we see it at.
  for (let i = 0; i < S.nr; i++) {
    const cx = S.rip[i * 3], cy = S.rip[i * 3 + 1], a = S.rip[i * 3 + 2], rr = 1 + a * 14, v = 0.6 - 0.15 * floor(a * 6);
    for (let s = 0; s < 24; s++) {
      const x = cx + rr * cos((s * PI) / 12), y = cy + 0.3 * rr * sin((s * PI) / 12);
      if (inEl(x, y, PX, PY, PRX, PRY)) add(x, y, lite, v);
    }
  }
  // The stream: each parcel a streak over the way it came in the last frame,
  // or at slow speeds over the way it comes in a frame at Speed 1.2, so the
  // slowed stream still reads as water and not as beads.
  const step = (1 / 30) * (max(1.2, S.speed) / 2), wc = [mix(0.72, 1, fq), mix(0.88, 1, fq), 1];
  for (let i = 0; i < S.nj; i++) {
    const o = i * 4, x = S.jet[o], y = S.jet[o + 1], vx = S.jet[o + 2], vy = S.jet[o + 3];
    const n = ceil1(abs(vy * step));
    for (let s = 0; s < n; s++) add(x - (vx * step * s) / n, y - (vy * step * s) / n, wc, s ? 0.7 : 0.92);
  }
  for (let i = 0; i < S.ns; i++) add(S.spl[i * 4], S.spl[i * 4 + 1], wc, 0.8);
  // Rain in front of it all, a bright head and a fainter tail along its slant.
  const live = RAIN0 + floor((RAIN1 - RAIN0) * S.rain), vx = 28 + 34 * S.rain, rc = hsv(skyH, 0.22, 1), len = 4 + floor(S.speed / 1.5);
  for (let i = 0; i < live; i++) {
    const o = i * 3, x = S.drops[o], y = S.drops[o + 1];
    for (let s = 0; s < len; s++) add(x - (vx / FALL) * s, y - s, rc, (s ? 0.34 : 0.55) + 0.3 * fq);
  }
  // The eyes, poison green, with a stepped glow round them.
  if (S.eye > 0) {
    const e = q20(S.eye), gc = [0.42, 1, 0.12];
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 3; dx++) {
        const r2 = hypot(dx - 0.5, dy), v = r2 < 0.9 ? 1 : r2 < 1.8 ? 0.4 : r2 < 2.6 ? 0.18 : 0;
        if (v) add(29 + dx, 20 + dy, gc, v * e);
      }
  }
  for (let i = 0; i < N; i++) display.setPixel(i % W, floor(i / W), (255 * cl(rgb[i * 3], 0, 1)) | 0, (255 * cl(rgb[i * 3 + 1], 0, 1)) | 0, (255 * cl(rgb[i * 3 + 2], 0, 1)) | 0);
}
