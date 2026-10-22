// ===== Patternflow pattern =====
// Title:   Climber
// Family:  pixel
// Idea:    A hooded climber with a red scarf plays its own platform game up an endless tower: it runs to the edge of a ledge, jumps for the next one, grabs the odd coin, and the brick wall and the sky through its windows slide past at their own depths.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// Round:   2
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.3..3.5, Gap=16..34, Sky=0..1
//
// Knob 1: Hue. The stone of the tower and its ledges; the climber keeps its own colours.
// Knob 2: Speed. How fast the climber runs and jumps, and with it how fast the tower goes by.
// Knob 3: Gap. How far apart the ledges are, from quick hops to long leaps with the climber high in the air.
// Knob 4: Sky. The time of day through the windows, from noon through sunset to night, when the torches on the wall are lit.
// Buttons: K1 tap makes the climber jump now, and again in the air.

const W = 64;
const H = 128;
const LEDGES = 24;
const COIN_SPARKS = 24;
const GRAVITY = 300;
const RUN = 24;
// Height of the wall pattern's repeat: one window and one torch per band.
const BAND = 44;

const IDLE = 0;
const RUN1 = 1;
const RUN2 = 2;
const RUN3 = 3;
const JUMP = 4;
const FALL = 5;

// The climber faces right; 8 wide, 8 tall, feet on the bottom row.
const POSES = [
  [
    "...ooo..",
    "..ooooo.",
    "..osses.",
    "..oosss.",
    "rrrggg..",
    ".r.gggs.",
    "...p.p..",
    "...b.b..",
  ],
  [
    "...ooo..",
    "..ooooo.",
    "..osses.",
    "..oosss.",
    "rrrggg..",
    "r..gggs.",
    "..pp..p.",
    ".bb....b",
  ],
  [
    "...ooo..",
    "..ooooo.",
    "..osses.",
    "..oosss.",
    ".rrggg..",
    "rr.ggs..",
    "...pp...",
    "...bb...",
  ],
  [
    "...ooo..",
    "..ooooo.",
    "..osses.",
    "..oosss.",
    "rrrggg..",
    ".r.gggs.",
    "...p.pp.",
    "..b...bb",
  ],
  [
    "...ooo.s",
    "..ooooos",
    "..ossse.",
    "r.oosss.",
    "rrrggg..",
    "...ggg..",
    "..pp.pp.",
    "..b...b.",
  ],
  [
    "rr.ooo..",
    ".rooooo.",
    "..osses.",
    "..oosss.",
    "s..ggg.s",
    "...ggg..",
    "...p.p..",
    "...b.b..",
  ],
];
const CLIMBER = { o: 0xeaf0fa, s: 0xffac6a, e: 0x141414, r: 0xff2a2a, g: 0x2fa85a, p: 0x2a3a8a, b: 0x8a4a1e };

const COIN = [
  [".yyy.", "yhyyd", "yhyyd", "yyyyd", ".ddd."],
  ["..y..", ".hyd.", ".hyd.", ".yyd.", "..d.."],
  ["..y..", "..h..", "..y..", "..y..", "..d.."],
];
const COIN_PAL = { y: 0xffc818, h: 0xfff6b0, d: 0xc08000 };

// 3x5 digits for the coin count, one octal digit per row from the top.
const DIGITS = [0o75557, 0o26227, 0o71747, 0o71317, 0o55711, 0o74717, 0o74757, 0o71122, 0o75757, 0o75717];

// Sky through the windows, top and bottom colour, at noon, sunset and night.
const SKIES = [
  [0x3a8cf0, 0x9ad4ff],
  [0x4a2a86, 0xff8a4a],
  [0x040822, 0x101c50],
];

function hash(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function hsv(h, s, v, out, o) {
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

// Sprite strings become palette indices once, in setup.
function bake(frames, colours) {
  const keys = Object.keys(colours);
  const h = frames[0].length;
  const w = frames[0][0].length;
  const pix = new Uint8Array(frames.length * w * h);
  for (let f = 0; f < frames.length; f++)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) pix[(f * h + y) * w + x] = keys.indexOf(frames[f][y][x]) + 1;
  const pal = new Float32Array((keys.length + 1) * 3);
  for (let i = 0; i < keys.length; i++) {
    const c = colours[keys[i]];
    pal[(i + 1) * 3] = (c >> 16) & 255;
    pal[(i + 1) * 3 + 1] = (c >> 8) & 255;
    pal[(i + 1) * 3 + 2] = c & 255;
  }
  return { w, h, pix, pal };
}

// The topmost ledge gets a new one above it, a gap up and to one side.
function addLedge(p) {
  const top = p.top;
  const i = (top + 1) % LEDGES;
  const gap = p.gap * (0.85 + Math.random() * 0.3);
  const width = 12 + Math.floor(Math.random() * 13);
  const prevMid = (p.lx0[top] + p.lx1[top]) * 0.5;
  let mid = prevMid + (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 18);
  if (mid < 2 + width / 2 || mid > W - 2 - width / 2) mid = prevMid + (prevMid < W / 2 ? 1 : -1) * (8 + Math.random() * 18);
  const x0 = Math.round(clamp(mid - width / 2, 2, W - 2 - width));
  p.lx0[i] = x0;
  p.lx1[i] = x0 + width;
  p.ly[i] = Math.round(p.ly[top] - gap);
  p.coin[i] = Math.random() < 0.4 ? 1 : 0;
  p.coinX[i] = x0 + 2 + Math.random() * (width - 4);
  p.top = i;
}

function next(i) {
  return (i + 1) % LEDGES;
}

// Plans the next jump: where on the ledge above to land, and where to take off from.
function plan(p) {
  const n = next(p.on);
  p.target = n;
  const landX = p.coin[n] ? p.coinX[n] : p.lx0[n] + 2 + Math.random() * (p.lx1[n] - p.lx0[n] - 4);
  p.landX = landX;
  let dir = Math.sign(landX - p.cx);
  if (dir === 0) dir = Math.random() < 0.5 ? -1 : 1;
  p.takeoff = clamp(landX - dir * (5 + Math.random() * 9), p.lx0[p.on] + 1, p.lx1[p.on] - 1);
}

function jump(p, from) {
  const n = p.target;
  const rise = Math.max(4, p.cy - p.ly[n]) + 5;
  const up = Math.sqrt((2 * rise) / GRAVITY);
  const down = Math.sqrt((2 * 5) / GRAVITY);
  p.vy = -GRAVITY * up;
  p.vx = clamp((p.landX - from) / (up + down), -70, 70);
  p.air = true;
  p.doubled = false;
  if (p.vx !== 0) p.face = p.vx > 0 ? 1 : -1;
}

function step(p, dt) {
  p.t += dt;
  // Keep ledges above the top of the screen, and recycle the ones that left the bottom.
  while (p.ly[p.top] > p.cam - 40) addLedge(p);

  if (!p.air && p.land > 0) {
    // Catching its breath after a landing.
  } else if (!p.air) {
    const dx = p.takeoff - p.cx;
    if (Math.abs(dx) <= RUN * dt + 0.01) {
      p.cx = p.takeoff;
      jump(p, p.cx);
    } else {
      p.face = dx > 0 ? 1 : -1;
      p.cx += p.face * RUN * dt;
      p.runPhase += dt * RUN * 0.22;
    }
  } else {
    const before = p.cy;
    p.vy += GRAVITY * dt;
    p.cx = clamp(p.cx + p.vx * dt, 3, W - 4);
    p.cy += p.vy * dt;
    if (p.vy > 0) {
      for (let i = 0; i < LEDGES; i++) {
        const y = p.ly[i];
        if (before <= y && p.cy >= y && p.cx >= p.lx0[i] - 1 && p.cx <= p.lx1[i] + 1) {
          p.cy = y;
          p.air = false;
          p.on = i;
          p.land = Math.random() < 0.2 ? 0.5 : 0.1;
          plan(p);
          break;
        }
      }
    }
    // Fell past the bottom of the screen: drop back in on a ledge in view.
    if (p.air && p.cy > p.cam + H + 12) {
      let best = -1;
      for (let i = 0; i < LEDGES; i++) {
        if (p.ly[i] < p.cam + 30 || p.ly[i] > p.cam + H - 20) continue;
        if (best < 0 || p.ly[i] > p.ly[best]) best = i;
      }
      if (best >= 0) {
        p.on = best;
        p.cx = (p.lx0[best] + p.lx1[best]) * 0.5;
        p.cy = p.ly[best];
        p.air = false;
        plan(p);
      }
    }
  }
  p.land = Math.max(0, p.land - dt);

  // A coin is taken when the climber's body passes over it.
  for (let i = 0; i < LEDGES; i++) {
    if (!p.coin[i]) continue;
    const cy = p.ly[i] - 6;
    if (Math.abs(p.coinX[i] - p.cx) < 4 && cy > p.cy - 10 && cy < p.cy + 2) {
      p.coin[i] = 0;
      p.coins = (p.coins + 1) % 1000;
      for (let s = 0; s < 6; s++) {
        const k = p.sparkNext;
        p.sparkNext = (k + 1) % COIN_SPARKS;
        const a = (s / 6) * Math.PI * 2 + 0.3;
        p.sx[k] = p.coinX[i];
        p.sy[k] = cy;
        p.svx[k] = Math.cos(a) * 30;
        p.svy[k] = Math.sin(a) * 30 - 10;
        p.slife[k] = 0.45;
      }
    }
  }
  for (let k = 0; k < COIN_SPARKS; k++) {
    if (p.slife[k] <= 0) continue;
    p.slife[k] -= dt;
    p.sx[k] += p.svx[k] * dt;
    p.sy[k] += p.svy[k] * dt;
  }

  // The camera only climbs; it keeps the climber a little below the middle.
  const want = p.cy - H * 0.6;
  if (want < p.cam) p.cam += (want - p.cam) * Math.min(1, dt * 2.5);
}

export function setup(params) {
  const p = params;
  p.climber = bake(POSES, CLIMBER);
  p.coinArt = bake(COIN, COIN_PAL);
  p.lx0 = new Int16Array(LEDGES);
  p.lx1 = new Int16Array(LEDGES);
  p.ly = new Float64Array(LEDGES);
  p.coin = new Uint8Array(LEDGES);
  p.coinX = new Float32Array(LEDGES);
  p.sx = new Float32Array(COIN_SPARKS);
  p.sy = new Float32Array(COIN_SPARKS);
  p.svx = new Float32Array(COIN_SPARKS);
  p.svy = new Float32Array(COIN_SPARKS);
  p.slife = new Float32Array(COIN_SPARKS);
  p.sparkNext = 0;
  p.buf = new Float32Array(W * H * 3);
  p.stone = new Float32Array(3);
  p.ledge = new Float32Array(3);
  p.skyTop = new Float32Array(3);
  p.skyLow = new Float32Array(3);
  p.ready = false;
  p.t = 0;
  p.coins = 0;
  p.gap = 20;
}

function start(p) {
  // The ground floor, full width, then ledges above it.
  p.top = 0;
  p.lx0[0] = 2;
  p.lx1[0] = W - 2;
  p.ly[0] = 0;
  p.coin[0] = 0;
  for (let i = 1; i < LEDGES; i++) p.ly[i] = 1e9;
  p.cam = -H + 6;
  p.cx = 12;
  p.cy = 0;
  p.vx = 0;
  p.vy = 0;
  p.air = false;
  p.face = 1;
  p.on = 0;
  p.land = 0;
  p.runPhase = 0;
  for (let i = 0; i < 12; i++) addLedge(p);
  plan(p);
  // Climb a while before the first frame, so the tower is already under way.
  for (let s = 0; s < 150; s++) step(p, 1 / 30);
  p.coins = 0;
}

export function update(dt, input, params) {
  const p = params;
  const k = input.knobValues || [0, 2, 16, 0.06];
  dt = Math.min(dt, 0.1);
  p.hue = k[0];
  p.gap = clamp(k[2], 8, 60);
  p.sky = clamp(k[3], 0, 1);
  if (!p.ready) {
    p.ready = true;
    start(p);
  }
  if (input.btnPressed && input.btnPressed[0]) {
    if (!p.air) jump(p, p.cx);
    else if (!p.doubled) {
      p.doubled = true;
      p.vy = -GRAVITY * 0.32;
    }
  }
  step(p, dt * Math.max(0.1, k[1] * 0.5));
}

export function draw(display, params, time) {
  const p = params;
  const buf = p.buf;
  const night = p.sky;
  // Noon to sunset over the first half of the knob, sunset to night over the second.
  const u = night * 2;
  const a = Math.min(1, Math.floor(u));
  const f = u - a;
  for (let c = 0; c < 3; c++) {
    const sh = 16 - c * 8;
    p.skyTop[c] = ((SKIES[a][0] >> sh) & 255) * (1 - f) + ((SKIES[a + 1][0] >> sh) & 255) * f;
    p.skyLow[c] = ((SKIES[a][1] >> sh) & 255) * (1 - f) + ((SKIES[a + 1][1] >> sh) & 255) * f;
  }
  const dusk = clamp((night - 0.35) / 0.5, 0, 1);
  const lightness = 1 - 0.55 * dusk;
  const hue = p.hue + 0.72;
  hsv(hue, 0.32, 0.3 * lightness, p.stone, 0);
  hsv(hue + 0.02, 0.42, 0.8 * (1 - 0.35 * dusk), p.ledge, 0);
  const stone = p.stone;
  const cam = Math.round(p.cam);
  const wall = Math.round(p.cam * 0.5);
  const far = Math.round(p.cam * 0.2);

  for (let y = 0; y < H; y++) {
    const ly = y + wall;
    const band = Math.floor(ly / BAND);
    const by = ly - band * BAND;
    const brickRow = Math.floor(ly / 4);
    const seam = (ly & 3) === 0;
    // One arched window a band, on alternate sides.
    const wx = (band & 1 ? 9 : 43) + Math.floor(hash(band, 1) * 5);
    const wy = by - 10;
    let w0 = 99;
    let w1 = -99;
    if (wy >= 0 && wy < 16) {
      const inset = wy === 0 ? 3 : wy === 1 ? 1 : 0;
      w0 = wx + inset;
      w1 = wx + 10 - inset;
    }
    const sky = clamp(wy / 15, 0, 1);
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      if (x >= w0 && x < w1) {
        // Through the window: the sky, its clouds or its stars, much further away.
        let r = p.skyTop[0] * (1 - sky) + p.skyLow[0] * sky;
        let g = p.skyTop[1] * (1 - sky) + p.skyLow[1] * sky;
        let b = p.skyTop[2] * (1 - sky) + p.skyLow[2] * sky;
        const fy = y + far;
        const fx = x + Math.floor(p.t * 3);
        const cell = Math.floor(fy / 18);
        const cx = Math.floor(hash(cell, 7) * 64);
        const dx = ((fx - cx) % 64 + 96) % 64 - 32;
        const dy = fy - cell * 18 - 9;
        const cloud = dx * dx * 0.08 + dy * dy * 0.6 < 4 + 3 * hash(cell, 9);
        if (cloud && night < 0.85) {
          const cv = 1 - night * 0.7;
          r = 235 * cv + r * 0.1;
          g = 225 * cv + g * 0.1;
          b = 235 * cv + b * 0.1;
        } else if (night > 0.6 && hash(fx, fy) > 0.965) {
          const s = (night - 0.6) * 2.5 * (0.6 + 0.4 * Math.sin(p.t * 3 + fx));
          r += 220 * s;
          g += 220 * s;
          b += 200 * s;
        }
        buf[o] = r;
        buf[o + 1] = g;
        buf[o + 2] = b;
      } else {
        const col = Math.floor((x + (brickRow & 1) * 4) / 8);
        const seamX = ((x + (brickRow & 1) * 4) & 7) === 0;
        // Flat bricks and dark mortar, the way a tile set draws a wall.
        let v = seam || seamX ? 0.32 : 0.97 + 0.06 * hash(brickRow, col);
        // The window's frame and sill.
        if (wy >= -1 && wy <= 16 && x >= wx - 1 && x <= wx + 10) v = wy === 16 ? 1.7 : 1.35;
        buf[o] = stone[0] * v;
        buf[o + 1] = stone[1] * v;
        buf[o + 2] = stone[2] * v;
      }
    }
  }

  // Torches, one a band opposite the window, lit as the sky darkens.
  const firstBand = Math.floor(wall / BAND) - 1;
  for (let band = firstBand; band <= firstBand + 4; band++) {
    const tx = band & 1 ? 47 : 13;
    const ty = band * BAND + 22 - wall;
    if (ty < -12 || ty > H + 12) continue;
    const lit = clamp((night - 0.3) / 0.4, 0, 1);
    if (lit > 0) {
      const flick = 0.85 + 0.15 * Math.sin(p.t * 11 + band * 3) * Math.sin(p.t * 7.3 + band);
      for (let y = ty - 12; y <= ty + 12; y++) {
        if (y < 0 || y >= H) continue;
        for (let x = tx - 12; x <= tx + 12; x++) {
          if (x < 0 || x >= W) continue;
          const d = Math.sqrt((x - tx) * (x - tx) + (y - ty + 2) * (y - ty + 2)) / 12;
          if (d >= 1) continue;
          const g = (1 - d) * (1 - d) * lit * flick;
          const o = (y * W + x) * 3;
          buf[o] += 150 * g;
          buf[o + 1] += 80 * g;
          buf[o + 2] += 20 * g;
        }
      }
    }
    // An iron sconce, and the torch's wooden head in it.
    const iron = 70 + 60 * (1 - dusk);
    put(buf, tx, ty + 2, iron, iron, iron * 1.1);
    put(buf, tx, ty + 3, iron, iron, iron * 1.1);
    put(buf, tx - 1, ty + 1, iron, iron, iron * 1.1);
    put(buf, tx + 1, ty + 1, iron, iron, iron * 1.1);
    put(buf, tx, ty + 1, 150, 90, 40);
    if (lit > 0) {
      const tip = Math.sin(p.t * 9 + band) > 0 ? 1 : 0;
      put(buf, tx, ty, 255, 200 * lit + 40, 60);
      put(buf, tx, ty - 1, 255, 150, 30);
      put(buf, tx - 1 + tip * 2, ty - 1, 230, 110, 20);
      put(buf, tx, ty - 2 - tip, 255, 230, 120);
    }
  }

  // The tower's own walls left and right move with the ledges.
  for (let y = 0; y < H; y++) {
    const wy = y + cam;
    const row = Math.floor(wy / 3);
    for (let x = 0; x < 2; x++) {
      const v = (wy % 3 + 3) % 3 === 0 ? 0.6 : 1.1 + 0.2 * hash(row, x);
      put(buf, x, y, p.ledge[0] * v * 0.6, p.ledge[1] * v * 0.6, p.ledge[2] * v * 0.6);
      put(buf, W - 1 - x, y, p.ledge[0] * v * 0.6, p.ledge[1] * v * 0.6, p.ledge[2] * v * 0.6);
    }
  }

  const ledge = p.ledge;
  for (let i = 0; i < LEDGES; i++) {
    const y0 = Math.round(p.ly[i]) - cam;
    if (y0 < -4 || y0 >= H) continue;
    // A slab four LEDs deep: a lit top edge, two rows of face cut into blocks, and a shadow under a bevel.
    for (let r = 0; r < 4; r++) {
      const v = r === 0 ? 1.25 : r === 1 ? 0.9 : r === 2 ? 0.72 : 0.42;
      const inset = r === 3 ? 1 : 0;
      for (let x = p.lx0[i] + inset; x < p.lx1[i] - inset; x++) {
        const s = (r === 1 || r === 2) && (x - p.lx0[i]) % 6 === 5 ? 0.55 : 1;
        put(buf, x, y0 + r, ledge[0] * v * s, ledge[1] * v * s, ledge[2] * v * s);
      }
    }
    if (p.coin[i]) {
      const frame = [0, 1, 2, 1][Math.floor(p.t * 8 + i) & 3];
      const bob = Math.sin(p.t * 4 + i) > 0 ? 1 : 0;
      sprite(p, p.coinArt, frame, Math.round(p.coinX[i]) - 2, y0 - 8 - bob, true, 1);
    }
  }

  let pose = IDLE;
  if (p.air) pose = p.vy < 0 ? JUMP : FALL;
  else if (p.land <= 0) pose = [RUN1, RUN2, RUN3, RUN2][Math.floor(p.runPhase) & 3];
  const light = 1 - 0.25 * dusk;
  sprite(p, p.climber, pose, Math.round(p.cx) - 4, Math.round(p.cy) - cam - 8, p.face > 0, light);

  for (let k = 0; k < COIN_SPARKS; k++) {
    if (p.slife[k] <= 0) continue;
    put(buf, Math.round(p.sx[k]), Math.round(p.sy[k]) - cam, 255, 240, 150);
  }

  // The coin count, top left.
  sprite(p, p.coinArt, 0, 3, 3, true, 1);
  let n = p.coins;
  let digits = 1;
  while (n >= Math.pow(10, digits)) digits++;
  for (let d = 0; d < digits; d++) {
    const v = Math.floor(n / Math.pow(10, digits - 1 - d)) % 10;
    const bits = DIGITS[v];
    for (let gy = 0; gy < 5; gy++) {
      const row = (bits >> ((4 - gy) * 3)) & 7;
      for (let gx = 0; gx < 3; gx++) if (row & (4 >> gx)) put(buf, 10 + d * 4 + gx, 3 + gy, 255, 236, 160);
    }
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

function sprite(p, s, frame, ix, iy, right, light) {
  const base = frame * s.w * s.h;
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const c = s.pix[base + y * s.w + x];
      if (!c) continue;
      put(p.buf, ix + (right ? x : s.w - 1 - x), iy + y, s.pal[c * 3] * light, s.pal[c * 3 + 1] * light, s.pal[c * 3 + 2] * light);
    }
  }
}
