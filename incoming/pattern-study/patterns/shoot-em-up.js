// ===== Patternflow pattern =====
// Title:   Shoot 'em Up
// Family:  pixel
// Idea:    A vertical arcade shooter plays itself on a tall cabinet screen: a white fighter weaves over a scrolling sea of islands, a coast, fields, a little town and a river, shooting down waves of enemy craft and gunboats, until a boss ship fills the top of the screen and sprays rings, spirals and fans of bullets for it to thread through.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 24, after the vertically scrolling arcade shooters of the 1980s
// Round:   24
// ===============================
// @matrix 64x128
// @knobs Stage=0..1, Speed=0.2..3, Waves=1..5, Bullets=0..1
//
// Knob 1: Stage. Which stage the cabinet plays, in four steps: a tropical sea with green fields at 0, a red desert canyon, a city at night with lit windows and neon roofs, and deep space past a ringed planet.
// Knob 2: Speed. The pace of the game: at 2 the ground scrolls 12 LEDs a second and the first boss arrives two seconds in, and at 0.2 everything plays ten times slower.
// Knob 3: Waves. How many enemies come: at 1 a formation of five or six every three seconds, at 5 a bigger one every second, more gunboats on the sea, and waves that keep coming while the boss is there.
// Knob 4: Bullets. How thick the enemy fire is and how furious the boss: at 0.06 a ring of nine and a slow spiral, at 1 rings of thirty, a three-armed spiral and wide fans, with the boss's core burning red.
// Buttons: K1 tap drops a bomb: a white flash and a shock ring that clears the bullets and hurts everything it crosses. K4 tap calls the boss now.

const W = 64;
const H = 128;
const N = W * H;
const { min, max, sin, cos, abs, atan2, hypot, floor, round, sqrt, PI } = Math;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + (b - a) * Math.random();
// Ground scroll at Speed 2, in LEDs a second; the clouds pass 1.8 times as fast.
const V0 = 12;
const CLOUD = 1.8;
// The map repeats every 1024 rows: sea and islands, coast, fields, town, river, coast, sea.
const PERIOD = 1024;

const hash = (x, y, s) => {
  let h = Math.imul((x * 374761393 + y * 668265263 + s * 982451653) | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function noise(x, y, s) {
  const ix = floor(x);
  const iy = floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s);
  const b = hash(ix + 1, iy, s);
  const c = hash(ix, iy + 1, s);
  const d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Ground types, one palette entry each per stage.
const DEEP = 0;
const WAVE = 1;
const CAP = 2;
const SHAL = 3;
const SAND = 4;
const GRASS = 5;
const TREE = 6;
const FLDA = 7;
const FLDB = 8;
const ROAD = 9;
const ROOF = 10;
const WALL = 11;
const TRUNK = 12;
const RIVER = 13;
const LIGHT = 14;
const HEDGE = 15;
const PALS = [
  [0x123c9a, 0x1e5cc4, 0xd2ecff, 0x2aa8cc, 0xf0d488, 0x4aae3c, 0x1f6a2a, 0x9ccc4a, 0x6e9a30, 0x76706a, 0xd8482e, 0xf2e6c8, 0x8a5a2a, 0x2c7ed8, 0xfff2c0, 0x2e5226],
  [0x5c2018, 0x8a3a22, 0xd8966a, 0xb4502a, 0xf0b464, 0xdc9a4c, 0x4a8a3c, 0xf2c278, 0xc8843e, 0x6e4630, 0xc8602e, 0xf6dcaa, 0x5a3418, 0x2aa89a, 0xffe6aa, 0x7a2c1a],
  [0x0c1846, 0x172a62, 0x8ca8e6, 0x1c386a, 0x50506a, 0x163e34, 0x0e2c24, 0x40446a, 0x2a2c48, 0x1e1e30, 0xb43c96, 0xffd25a, 0x2e2224, 0x12265e, 0xffa83c, 0x1c1c2c],
  [0x08061c, 0x1e0e40, 0xe6e6ff, 0x34185e, 0x9a9088, 0x5a6280, 0x4c4440, 0x868ca8, 0x464c66, 0x1c2034, 0xff3c3c, 0xb8c2d8, 0x3c3432, 0x28dcff, 0x78ffc8, 0x2a2e40],
].map((p) => {
  const a = new Float32Array(48);
  p.forEach((c, i) => {
    a[i * 3] = c >> 16;
    a[i * 3 + 1] = (c >> 8) & 255;
    a[i * 3 + 2] = c & 255;
  });
  return a;
});
// Clouds per stage: colour, how dark the underside is, alpha, and the shade of their shadow.
const CLOUDS = [
  [236, 242, 255, 0.74, 0.72, 0.62],
  [236, 200, 156, 0.78, 0.6, 0.7],
  [84, 96, 146, 0.7, 0.66, 0.72],
  [150, 76, 214, 0.6, 0.5, 1],
];

// Sprites as rows of letters; "." is clear. Colours are hex, -1 is the boss's glowing core.
function mk(rows, pal, mirror) {
  const w0 = rows[0].length;
  const w = mirror ? w0 * 2 : w0;
  const px = [];
  const mask = new Uint8Array(w * rows.length);
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      if (r[i] === ".") continue;
      px.push(i, j, pal[r[i]]);
      mask[j * w + i] = 1;
      if (mirror) {
        px.push(w - 1 - i, j, pal[r[i]]);
        mask[j * w + w - 1 - i] = 1;
      }
    }
  });
  return { w, h: rows.length, px, mask };
}
const PLAYER = mk(
  ["....w....", "...wcw...", "...wbw...", "..gwbwg..", "..gwwwg..", ".wgwwwgw.", "wwwwgwwww", "rww.g.wwr", "r..www..r", "...r.r..."],
  { w: 0xdce4f0, c: 0x96f0ff, b: 0x286ee6, g: 0x828ca0, r: 0xe62832 },
);
const FIGHTER = mk(["o.....o", "oo.d.oo", "ooodooo", ".odwdo.", "..ddd..", "...d..."], { o: 0xff8c1e, d: 0xaa3214, w: 0xfff0c8 });
const DART = mk(["mm...mm", "mmm.mmm", ".mmmmm.", ".mmcmm.", "..mmm..", "..mdm..", "...m..."], { m: 0xd246e6, c: 0x78f0ff, d: 0x6e1e8c });
const BOAT = mk(
  [".kkkkk.", "kbbbbbk", "kbaaabk", "kbaaabk", "kbbbbbk", "kbbbbbk", "kbaaabk", "kbbbbbk", ".kbbbk.", ".kbbbk.", "..kbk..", "...k..."],
  { k: 0x1e2028, b: 0x969baa, a: 0x5a5f6e },
);
const LIFE = mk(["..w..", ".www.", "wwwww", "r.w.r"], { w: 0xdce4f0, r: 0xe62832 });
const BOSS = mk(
  [
    ".............kkgggk..kkkkkkk",
    "kk...........kacccc..kbbbbbb",
    "kykkk........kabbbc..kbbrrbb",
    "kybbbkkk.....kabbbc..kbbrrbb",
    "kbbbbbbbkk...kabbbc..kbbbbbb",
    "kbbbbbbbbbkkkbabbbc..kbbbbbb",
    "kbbrrrbbbbbbbbabbbc..kbbbkkk",
    "kaarrrrrrbbbbbabbbc..kbbbkee",
    "kccabbrrrrrrbbabbbckkbbbbkee",
    ".kkcaabgggrrrrabbbcbbbbbbkee",
    "...kcaagygbbrrrrrrbbbbbbbkee",
    "....kacgggbbbbbrrrrrrbbbbkee",
    "......kkcaabbbbbbbrrrbbbbkee",
    "........kacaaabgggbbbbbbbkee",
    ".........akccabgygbbbbbbbkee",
    "...........kkaagggbbbbbbbkee",
    ".............kccaabbbbbbbkkk",
    "..............kkccabbbbbbbbb",
    "................kkcaabbbbbbb",
    "..................kccbbyybbb",
    "...................kkabbbbbb",
    ".....................kabbbbb",
    ".....................kcbbbbb",
    "......................kabbbb",
    ".......................kabbg",
    ".......................kcbbg",
    "........................kabg",
    ".........................kag",
    ".........................kcg",
    "..........................kg",
  ],
  { k: 0x14141e, c: 0x464a60, a: 0x787e96, b: 0xb4bacc, r: 0xdc323c, y: 0xffd646, g: 0x2c2c38, e: -1 },
  true,
);
const PALM = ["t.t.t", ".ttt.", "ttktt", ".ttt.", "t.t.t"];
// 3x5 digits and a P, one octal digit per row from the top.
const GLYPH = [0o75557, 0o26227, 0o71747, 0o71317, 0o55711, 0o74717, 0o74757, 0o71122, 0o75757, 0o75717, 0o75744];
// Enemy bullet colours: the boss's rings, its spirals, and aimed shots.
const BUL = [
  [255, 70, 170],
  [70, 220, 255],
  [255, 170, 40],
];

// ---- the ground -------------------------------------------------------------

// -1 is open sea and 1 is land; the coasts run a little slanted across the screen.
function profile(x, wy) {
  const v = (wy % PERIOD) + 0.3 * (x - 32);
  if (v < 250 || v > 830) return -1;
  if (v < 290) return -1 + (v - 250) / 20;
  if (v < 790) return 1;
  return 1 - (v - 790) / 20;
}
const ISL = { x: 0, y: 0, r: 0 };
function islands(sd, x, wy) {
  const cx = floor(x / 32);
  const cy = floor(wy / 44);
  let best = 0;
  for (let j = cy - 1; j <= cy + 1; j++)
    for (let i = cx - 1; i <= cx + 1; i++) {
      if (hash(i, j, sd + 1) > 0.7) continue;
      const ix = i * 32 + 4 + hash(i, j, sd + 2) * 24;
      const iy = j * 44 + 6 + hash(i, j, sd + 3) * 32;
      const r = 12 + hash(i, j, sd + 4) * 10;
      const b = 1.9 * (1 - hypot(x - ix, wy - iy) / r);
      if (b > best) {
        best = b;
        ISL.x = ix;
        ISL.y = iy;
        ISL.r = r;
      }
    }
  return best;
}
function terrain(sd, x, wy) {
  const pr = profile(x, wy);
  let e = pr + 0.5 * (noise(x / 11, wy / 11, sd) - 0.5) + 0.24 * (noise(x / 4.5, wy / 4.5, sd + 9) - 0.5);
  if (pr < 0) e += islands(sd, x, wy) * min(1, -pr);
  if (e < -0.08) {
    if (e > -0.12) return CAP;
    if (e > -0.21) return SHAL;
    const cx = x >> 3;
    const cy = floor(wy / 5);
    const h = hash(cx, cy, sd + 21);
    if (h < 0.4 && wy === cy * 5 + floor(hash(cx, cy, sd + 23) * 4)) {
      const c0 = cx * 8 + floor(hash(cx, cy, sd + 22) * 6);
      if (x >= c0 && x < c0 + (h < 0.15 ? 3 : 2)) return CAP;
    }
    if (e > -0.36) return WAVE;
    return noise(x / 6, wy / 2, sd + 5) > 0.78 ? WAVE : DEEP;
  }
  if (e < 0.08) return SAND;
  if (pr < -0.5) {
    // An island: grass, and a palm at the middle of a big one.
    const dx = round(x - ISL.x);
    const dy = round(wy - ISL.y);
    if (ISL.r > 13 && abs(dx) <= 2 && abs(dy) <= 2) {
      const c = PALM[dy + 2][dx + 2];
      if (c !== ".") return c === "k" ? TRUNK : TREE;
    }
    return GRASS;
  }
  return land(sd, x, wy, wy % PERIOD);
}
function land(sd, x, wy, u) {
  const dr = abs(x - 30 - 9 * sin(wy / 70));
  if (u > 560 && u < 770) {
    const a = (u - 560) / 34;
    const dv = abs(x - 32 - 23 * sin(a)) / sqrt(1 + (0.68 * cos(a)) ** 2);
    if (dv < 4.4) {
      if (dr < 2.6) return dr > 1.6 ? WALL : ROAD;
      return dv < 3.3 ? RIVER : SAND;
    }
  }
  if (dr < 1.6) return dr < 0.6 && wy % 6 < 3 ? LIGHT : ROAD;
  if (u > 420 && u < 540) {
    // The town: a grid of streets, houses with roofs, and a tree in each empty plot.
    const gx = x + 4;
    const px = floor(gx / 9);
    const py = floor(wy / 9);
    const lx = gx - px * 9;
    const ly = wy - py * 9;
    if (lx === 0 || ly === 0) return ROAD;
    if (hash(px, py, sd + 41) < 0.72) {
      if (lx >= 2 && lx <= 6 && ly >= 3 && ly <= 7) return lx === 4 ? TRUNK : ROOF;
      if (lx >= 2 && lx <= 6 && ly === 2) return WALL;
      if ((lx === 7 && ly >= 2 && ly <= 6) || (ly === 1 && lx >= 3 && lx <= 7)) return HEDGE;
      return GRASS;
    }
    return hypot(lx - 4.5, ly - 4.5) < 2.7 ? TREE : GRASS;
  }
  // Fields: a patchwork of crops, meadows and woods with hedges between.
  const band = floor(wy / 14);
  const gx = x + floor(hash(band, 0, sd + 51) * 16);
  const cx = floor(gx / 16);
  const lx = gx - cx * 16;
  const ly = wy - band * 14;
  const h = hash(cx, band, sd + 52);
  if (lx === 0 || ly === 0) return h < 0.6 ? HEDGE : GRASS;
  const kind = floor(h * 5);
  if (kind === 0) return wy % 3 === 0 ? FLDB : FLDA;
  if (kind === 1) return gx % 3 === 0 ? FLDB : FLDA;
  if (kind === 2) return hash(gx, wy, sd + 53) < 0.12 ? FLDB : FLDA;
  const tx = floor(gx / 5);
  const ty = floor(wy / 5);
  if (kind === 4 && hash(tx, ty, sd + 54) < 0.6) return GRASS;
  const d = hypot(gx - tx * 5 - 1 - hash(tx, ty, sd + 55) * 3, wy - ty * 5 - 1 - hash(tx, ty, sd + 56) * 3);
  return d < 1.9 ? TREE : GRASS;
}
// A cloud: round puffs on a flat base, 3 where the sun lights its top, 2 its body, 1 its grey underside.
function newCloud(S, cw) {
  const w = floor(rnd(22, 40));
  const h = floor(rnd(10, 16));
  const n = 3 + floor(w / 9);
  const P = [];
  for (let i = 0; i < n; i++) {
    const r = h * 0.5 * (0.5 + 0.5 * sin((PI * (i + 0.5)) / n)) + rnd(-0.6, 0.8);
    P.push((w * (i + 0.5)) / n + rnd(-1.5, 1.5), h - 1.5 - r * 0.55, r);
  }
  const inn = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y > h - 1.5) return false;
    for (let i = 0; i < P.length; i += 3) if (hypot(x + 0.5 - P[i], y + 0.5 - P[i + 1]) < P[i + 2]) return true;
    return false;
  };
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inn(x, y)) m[y * w + x] = !inn(x, y + 2) ? 1 : !inn(x - 1, y - 2) ? 3 : 2;
  S.clouds.push({ x: floor(rnd(-14, 56 - w / 2)), cw: cw + h, w, h, m });
}
function fill(S) {
  const top = floor(S.scroll) + H + 24;
  while (S.gen < top) {
    const o = (S.gen & 255) * W;
    for (let x = 0; x < W; x++) S.ter[o + x] = terrain(S.sd, x, S.gen);
    S.gen++;
  }
  const cb = floor(S.scroll * CLOUD);
  while (S.cnext < cb + H + 20) {
    newCloud(S, S.cnext);
    S.cnext += floor(rnd(24, 52));
  }
  S.clouds = S.clouds.filter((c) => cb + H - 1 - c.cw < H);
}

// ---- the game ---------------------------------------------------------------

export function setup(params) {
  const S = {
    t: 0,
    scroll: 85,
    sd: floor(Math.random() * 9000),
    ter: new Uint8Array(256 * W),
    cb: new Uint8Array(N),
    clouds: [],
    buf: new Float32Array(N * 3),
    sh: new Float32Array(N),
    en: [],
    boats: [],
    eb: [],
    ps: [],
    fx: [],
    pop: [],
    caps: [],
    boss: null,
    bossAt: 3.2,
    bossN: 0,
    waveAt: 0.4,
    waveN: 0,
    boatAt: 0.2,
    kills: 0,
    score: 0,
    flash: 0,
    bomb: null,
    pl: { x: 32, y: 112, inv: 0, dead: 0, lvl: 0, lvlT: 0, lives: 3, ft: 0, pu: -9 },
    stage: 0,
    tempo: 1,
    waves: 1,
    fury: 0.06,
    started: false,
  };
  S.gen = floor(S.scroll) - 2;
  S.cnext = floor(S.scroll * CLOUD) - 6;
  fill(S);
  params.s = S;
}

function shoot(S, x, y, a, v, c, big) {
  if (S.eb.length < 380) S.eb.push({ x, y, vx: cos(a) * v, vy: sin(a) * v, c, big });
}
const aim = (S, x, y) => atan2(S.pl.y - y, S.pl.x - x);
function boom(S, x, y, s) {
  const sp = [];
  for (let i = 0; i < 4 + s * 3; i++) {
    const a = Math.random() * 6.283;
    const v = (20 + Math.random() * 30) * s;
    sp.push(cos(a) * v, sin(a) * v);
  }
  S.fx.push({ x, y, t0: S.t, s, sp, d: 0.45 + 0.12 * s });
}
function popup(S, x, y, v) {
  S.pop.push({ x, y, v, t0: S.t });
}

function spawnWave(S) {
  const n = S.waveN++;
  if (n % 2 === 0) {
    // A line that swoops in an S, down from the top or across from a side.
    const m = 4 + round(S.waves);
    const side = n % 4 === 0 ? 1 : -1;
    const top = n % 6 === 4;
    const cx = rnd(26, 38);
    const A = side * rnd(14, 19);
    const f = rnd(0.036, 0.048);
    const y0 = rnd(8, 30);
    for (let i = 0; i < m; i++) S.en.push({ k: 0, top, side, y0, born: S.t + i * 0.3, cx, A, f, x: -99, y: -99, hp: 6, fl: 0, ft: rnd(0.4, 2.4) });
  } else {
    // A V that comes down, holds, and dives at the fighter one by one.
    const m = 2 * floor(2 + S.waves * 0.55) + 1;
    const cx = rnd(24, 40);
    for (let i = 0; i < m; i++) {
      const r = (i + 1) >> 1;
      const s = i & 1 ? -1 : 1;
      S.en.push({ k: 1, born: S.t, x: cx + s * r * 6, y: -8 - r * 6, hy: 34 - r * 6, st: 0, vx: 0, vy: 50, hp: 7, fl: 0, hold: 0.5 + r * 0.25 + Math.random() * 0.2 });
    }
  }
}
function spawnBoat(S) {
  const wy = floor(S.scroll) + H + 8;
  for (let n = 0; n < 6; n++) {
    const x = floor(rnd(6, 58));
    let ok = true;
    for (let j = -7; j <= 7 && ok; j += 2)
      for (let i = -4; i <= 4; i += 2) if (S.ter[((wy + j) & 255) * W + clamp(x + i, 0, 63)] > CAP) ok = false;
    if (ok) {
      S.boats.push({ x, wy, hp: 6, fl: 0, ft: rnd(0.6, 1.6), a: PI / 2 });
      return;
    }
  }
}
const boatY = (S, b) => floor(S.scroll) + H - 1 - round(b.wy);

function kill(S, x, y, v, s) {
  boom(S, x, y, s);
  popup(S, x, y - 4, v);
  S.score += v;
  if (++S.kills % 9 === 0) S.caps.push({ x, y, t0: S.t });
}

function stepEnemies(S, d) {
  const P = S.pl;
  const f = S.fury;
  for (const e of S.en) {
    e.fl = max(0, e.fl - d);
    const a = S.t - e.born;
    if (a < 0) continue;
    if (e.k === 0) {
      if (e.top) {
        e.y = -6 + 34 * a;
        e.x = e.cx + e.A * sin(e.f * e.y);
      } else {
        e.x = e.side > 0 ? -6 + 38 * a : 70 - 38 * a;
        e.y = e.y0 + 14 * a + 13 * sin(3.2 * a);
      }
      e.ft -= d;
      if (e.ft <= 0) {
        e.ft = rnd(1.2, 2.6);
        if (e.y > 0 && e.y < 80 && Math.random() < 0.3 + 0.7 * f) shoot(S, e.x, e.y + 3, aim(S, e.x, e.y), 34, 2, 0);
      }
    } else {
      if (e.st === 0) {
        e.y += 50 * d;
        if (e.y >= e.hy) {
          e.st = 1;
          e.t1 = S.t;
        }
      } else if (e.st === 1) {
        e.x += sin(S.t * 3 + e.hy) * 4 * d;
        if (S.t - e.t1 > e.hold) {
          e.st = 2;
          const g = aim(S, e.x, e.y);
          e.vx = cos(g) * 30;
          e.vy = sin(g) * 30;
          if (Math.random() < 0.35 + 0.65 * f) shoot(S, e.x, e.y + 3, g, 42, 2, 0);
        }
      } else {
        const sp = hypot(e.vx, e.vy);
        const k = min(130, sp + 110 * d) / sp;
        e.vx *= k;
        e.vy *= k;
        e.x += e.vx * d;
        e.y += e.vy * d;
      }
    }
  }
  S.en = S.en.filter((e) => e.hp > 0 && e.y < 140 && e.x > -20 && e.x < 84);
  for (const b of S.boats) {
    b.fl = max(0, b.fl - d);
    const sy = boatY(S, b);
    if (S.ter[((round(b.wy) - 8) & 255) * W + clamp(b.x, 0, 63)] <= CAP) b.wy -= 3 * d;
    let g = aim(S, b.x, sy - 2) - b.a;
    g = ((g + 3 * PI) % (2 * PI)) - PI;
    b.a += clamp(g, -2 * d, 2 * d);
    b.ft -= d;
    if (b.ft <= 0 && sy > 2 && sy < 96) {
      b.ft = 2.2 - 1.3 * f;
      const m = f > 0.5 ? 3 : 1;
      for (let i = 0; i < m; i++) shoot(S, b.x + cos(b.a) * 4, sy - 2 + sin(b.a) * 4, b.a + (i - (m - 1) / 2) * 0.25, 38, 2, 0);
    }
  }
  S.boats = S.boats.filter((b) => b.hp > 0 && boatY(S, b) < 140);
}

function stepBoss(S, d) {
  let B = S.boss;
  if (!B) {
    if (S.t < S.bossAt) return;
    B = S.boss = { x: 32, y: -34, t0: S.t, st: 0, hp: S.bossN ? 320 + 40 * S.bossN : 60, ph: S.bossN ? 2.8 : 1.6, fl: 0, ang: 0, nx: 0, nr: 0, nf: 0, nd: 0 };
  }
  const f = S.fury;
  const a = S.t - B.t0;
  B.fl = max(0, B.fl - d);
  if (B.st === 2) {
    // Blowing apart: explosions all over the hull, then one big one.
    if (S.t >= B.nd) {
      B.nd = S.t + 0.07;
      const i = floor(Math.random() * BOSS.px.length / 3) * 3;
      boom(S, B.x - 28 + BOSS.px[i], B.y + BOSS.px[i + 1], rnd(0.7, 1.4));
    }
    if (S.t - B.t2 > 1.7) {
      boom(S, B.x, B.y + 12, 3.2);
      for (let i = 0; i < 6; i++) boom(S, B.x + rnd(-24, 24), B.y + rnd(4, 26), rnd(1, 1.8));
      popup(S, B.x - 6, B.y + 14, 5000);
      S.score += 5000;
      S.flash = 0.75;
      S.caps.push({ x: B.x, y: B.y + 20, t0: S.t });
      S.boss = null;
      S.bossAt = S.t + rnd(18, 30);
      S.bossN++;
    }
    return;
  }
  if (B.st === 0) {
    const u = min(1, a / 1.4);
    B.y = -34 + 40 * (1 - (1 - u) * (1 - u));
    if (u >= 1) {
      B.st = 1;
      B.t1 = S.t;
    }
    return;
  }
  B.x = 32 + 3 * sin((S.t - B.t1) * 0.8);
  const cy = B.y + 11;
  const ph = floor((S.t - B.t1) / B.ph) % 3;
  if (ph === 0 && S.t >= B.nr) {
    B.nr = S.t + 1.5 - 0.8 * f;
    const n = round(12 + 18 * f);
    const a0 = Math.random() * 6.283;
    for (let i = 0; i < n; i++) shoot(S, B.x, cy, a0 + (i * 2 * PI) / n, 28, 0, 1);
  }
  if (ph === 1 && S.t >= B.nx) {
    B.nx = S.t + 1 / (7 + 23 * f);
    B.ang += 0.37;
    const arms = f > 0.5 ? 3 : 2;
    for (let i = 0; i < arms; i++) shoot(S, B.x, cy, B.ang + (i * 2 * PI) / arms, 32, 1, 0);
  }
  if (ph === 2 && S.t >= B.nf) {
    B.nf = S.t + 1.05 - 0.55 * f;
    const m = 3 + round(6 * f);
    for (const s of [-1, 1]) {
      const tx = B.x + s * 19.5;
      const ty = B.y + 10;
      const g = aim(S, tx, ty);
      for (let i = 0; i < m; i++) shoot(S, tx, ty, g + (i - (m - 1) / 2) * (0.12 + 0.1 * f), 42, 2, 0);
    }
  }
}

function bomb(S) {
  if (S.pl.dead > 0) return;
  S.bomb = { x: S.pl.x, y: S.pl.y, t0: S.t, id: S.t };
  S.flash = max(S.flash, 0.9);
}

function stepPlayer(S, d) {
  const P = S.pl;
  if (P.dead > 0) {
    P.dead -= d;
    if (P.dead <= 0) {
      P.x = 32;
      P.y = 134;
      P.inv = 2.5;
    }
    return;
  }
  P.inv = max(0, P.inv - d);
  P.lvlT -= d;
  if (P.lvlT <= 0 && P.lvl > 0) {
    P.lvl--;
    P.lvlT = 14;
  }
  // Where the fighter would like to be: under the boss, under the nearest enemy, on a capsule.
  const wv = 32 + 18 * sin(S.t * 0.53);
  let ax = wv;
  const B = S.boss;
  if (B && B.st > 0) ax = B.x + 10 * sin(S.t * 1.1);
  else if (S.caps.length) ax = S.caps[0].x;
  else {
    let by = -99;
    for (const e of S.en) if (e.y > by && e.y < P.y - 14 && e.y > 0) ((by = e.y), (ax = e.x));
    for (const b of S.boats) {
      const y = boatY(S, b);
      if (y > by && y < P.y - 14 && y > 0) ((by = y), (ax = b.x));
    }
    ax = 0.55 * ax + 0.45 * wv;
  }
  // Then it picks the nearby spot that the bullets will miss.
  let best = 1e9;
  let bx = P.x;
  let byy = P.y;
  for (const ox of [-12, -7, -3, 0, 3, 7, 12])
    for (const oy of [-6, 0, 6]) {
      const cx = clamp(P.x + ox, 5, 58);
      const cy = clamp(P.y + oy, 98, 116);
      let c = 0.05 * abs(cx - ax) + 0.04 * abs(cy - 111) + 0.02 * abs(ox);
      for (const b of S.eb) {
        if (abs(b.y - cy) > 40) continue;
        for (const tau of [0.06, 0.18, 0.34]) {
          const dx = b.x + b.vx * tau - cx;
          const dy = b.y + b.vy * tau - cy;
          const q = dx * dx + 0.6 * dy * dy;
          if (q < 42) c += ((42 - q) / 42) * (tau < 0.1 ? 4 : 2);
        }
      }
      if (c < best) ((best = c), (bx = cx), (byy = cy));
    }
  const sp = 52 * d;
  P.x += clamp(bx - P.x, -sp, sp);
  P.y += clamp(byy - P.y, -sp, sp);
  P.ft -= d;
  while (P.ft <= 0) {
    P.ft += 0.1;
    const v = 170;
    const add = (x, vx) => S.ps.push({ x: P.x + x, y: P.y - 5, vx, vy: -v });
    add(-2, 0);
    add(2, 0);
    if (P.lvl >= 1) add(0, 0);
    if (P.lvl >= 2) {
      add(-3, -38);
      add(3, 38);
    }
  }
}

function stepShots(S, d) {
  const B = S.boss;
  for (const s of S.ps) {
    s.x += s.vx * d;
    s.y += s.vy * d;
    if (s.y < -4) {
      s.dead = 1;
      continue;
    }
    for (const e of S.en) {
      if (e.hp <= 0 || abs(s.x - e.x) > 4 || abs(s.y - e.y) > 4) continue;
      s.dead = 1;
      e.fl = 0.06;
      if (--e.hp <= 0) kill(S, e.x, e.y, e.k ? 150 : 100, 1);
      break;
    }
    if (s.dead) continue;
    for (const b of S.boats) {
      const by = boatY(S, b);
      if (b.hp <= 0 || abs(s.x - b.x) > 3.5 || abs(s.y - by) > 6) continue;
      s.dead = 1;
      b.fl = 0.06;
      if (--b.hp <= 0) kill(S, b.x, by, 300, 1.3);
      break;
    }
    if (s.dead || !B || B.st !== 1) continue;
    const ix = round(s.x - B.x + 28);
    const iy = round(s.y - B.y);
    if (ix >= 0 && ix < 56 && iy >= 0 && iy < 30 && BOSS.mask[iy * 56 + ix]) {
      s.dead = 1;
      B.fl = 0.05;
      S.score += 10;
      if (--B.hp <= 0) {
        B.st = 2;
        B.t2 = S.t;
        S.eb.length = 0;
      }
    }
  }
  S.ps = S.ps.filter((s) => !s.dead);
}

function stepBullets(S, d) {
  const P = S.pl;
  for (const b of S.eb) {
    b.x += b.vx * d;
    b.y += b.vy * d;
    if (b.x < -3 || b.x > 66 || b.y < -3 || b.y > 130) b.dead = 1;
    else if (P.dead <= 0 && P.inv <= 0 && abs(b.x - P.x) < 2 && abs(b.y - P.y) < 3) {
      b.dead = 1;
      boom(S, P.x, P.y, 1.6);
      P.dead = 1.2;
      P.lvl = 0;
      if (--P.lives < 0) P.lives = 3;
    }
  }
  const M = S.bomb;
  if (M) {
    const r = (S.t - M.t0) * 150;
    for (const b of S.eb) if (hypot(b.x - M.x, b.y - M.y) < r) b.dead = 1;
    for (const e of S.en)
      if (e.y > 0 && e.hp > 0 && e.bombed !== M.id && hypot(e.x - M.x, e.y - M.y) < r) {
        e.bombed = M.id;
        e.hp -= 4;
        if (e.hp <= 0) kill(S, e.x, e.y, e.k ? 150 : 100, 1);
      }
    for (const b of S.boats) {
      const by = boatY(S, b);
      if (by > 0 && b.hp > 0 && b.bombed !== M.id && hypot(b.x - M.x, by - M.y) < r) {
        b.bombed = M.id;
        b.hp -= 4;
        if (b.hp <= 0) kill(S, b.x, by, 300, 1.3);
      }
    }
    const B = S.boss;
    if (B && B.st === 1 && B.bombed !== M.id && r > P.y - B.y - 20) {
      B.bombed = M.id;
      B.fl = 0.2;
      B.hp -= 15;
      if (B.hp <= 0) ((B.st = 2), (B.t2 = S.t));
    }
    if (r > 160) S.bomb = null;
  }
  S.eb = S.eb.filter((b) => !b.dead);
  for (const c of S.caps) {
    c.y += 14 * d;
    if (P.dead <= 0 && abs(c.x - P.x) < 6 && abs(c.y - P.y) < 7) {
      c.dead = 1;
      P.lvl = min(2, P.lvl + 1);
      P.lvlT = 16;
      P.pu = S.t;
    }
  }
  S.caps = S.caps.filter((c) => !c.dead && c.y < 134);
  S.fx = S.fx.filter((f) => S.t - f.t0 < f.d);
  S.pop = S.pop.filter((p) => S.t - p.t0 < 0.9);
}

function step(S, d) {
  S.t += d;
  S.scroll += V0 * d;
  S.flash = max(0, S.flash - 2.6 * d);
  fill(S);
  const w = S.waves;
  if (S.t >= S.waveAt) {
    const busy = S.boss && S.boss.st < 2;
    spawnWave(S);
    S.waveAt = S.t + (S.waveN === 1 ? 0.45 : busy ? 2 : 1) * (3.3 / w ** 0.75);
  }
  if (S.t >= S.boatAt) {
    spawnBoat(S);
    S.boatAt = S.t + rnd(3.5, 6) / w;
  }
  stepEnemies(S, d);
  stepBoss(S, d);
  stepPlayer(S, d);
  stepShots(S, d);
  stepBullets(S, d);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = clamp(dt || 0, 0, 0.1);
  S.stage = clamp(k[0], 0, 1);
  S.tempo = clamp(k[1], 0.2, 3) / 2;
  S.waves = clamp(k[2], 1, 5);
  S.fury = clamp(k[3], 0, 1);
  if (!S.started) {
    // The first second is played before the first frame, so the screen opens busy.
    S.started = true;
    for (let i = 0; i < 30; i++) step(S, 1 / 30);
  }
  const bp = input.btnPressed || [];
  if (bp[0]) bomb(S);
  if (bp[3] && !S.boss) S.bossAt = S.t;
  let d = dt * S.tempo;
  while (d > 0) {
    const s = min(d, 1 / 30);
    step(S, s);
    d -= s;
  }
}

// ---- drawing ------------------------------------------------------------------

function put(buf, x, y, r, g, b) {
  x = round(x);
  y = round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const q = (y * W + x) * 3;
  buf[q] = r;
  buf[q + 1] = g;
  buf[q + 2] = b;
}
// mode 0 draws, 1 draws it white, 2 stamps its shadow, 3 draws it lit up by a hit.
function spr(S, sp, x0, y0, mode, glow) {
  const p = sp.px;
  const buf = S.buf;
  for (let i = 0; i < p.length; i += 3) {
    const x = x0 + p[i];
    const y = y0 + p[i + 1];
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    if (mode === 2) {
      S.sh[y * W + x] = min(S.sh[y * W + x], 0.55);
      continue;
    }
    const c = p[i + 2];
    const q = (y * W + x) * 3;
    if (mode === 1) {
      buf[q] = 255;
      buf[q + 1] = 255;
      buf[q + 2] = 255;
    } else if (mode === 3) {
      buf[q] = min(255, (c >> 16) + 60);
      buf[q + 1] = min(255, ((c >> 8) & 255) + 45);
      buf[q + 2] = min(255, (c & 255) + 20);
    } else if (c < 0) {
      buf[q] = glow[0];
      buf[q + 1] = glow[1];
      buf[q + 2] = glow[2];
    } else {
      buf[q] = c >> 16;
      buf[q + 1] = (c >> 8) & 255;
      buf[q + 2] = c & 255;
    }
  }
}
function glyph(buf, code, x0, y0, r, g, b) {
  for (let j = 0; j < 5; j++) {
    const bits = (code >> (3 * (4 - j))) & 7;
    for (let i = 0; i < 3; i++) if ((bits >> (2 - i)) & 1) put(buf, x0 + i, y0 + j, r, g, b);
  }
}
function number(buf, v, x0, y0, r, g, b, len) {
  let s = String(v);
  while (s.length < len) s = "0" + s;
  for (let i = 0; i < s.length; i++) glyph(buf, GLYPH[s.charCodeAt(i) - 48], x0 + i * 4, y0, r, g, b);
}
function ring(buf, cx, cy, R, w, c) {
  for (let y = floor(cy - R - w); y <= cy + R + w; y++)
    for (let x = floor(cx - R - w); x <= cx + R + w; x++) {
      const d = hypot(x - cx, y - cy);
      if (abs(d - R) < w) put(buf, x, y, c[0], c[1], c[2]);
    }
}
function disc(buf, cx, cy, R, r, g, b) {
  for (let y = floor(cy - R); y <= cy + R; y++)
    for (let x = floor(cx - R); x <= cx + R; x++) if (hypot(x - cx, y - cy) <= R) put(buf, x, y, r, g, b);
}

function drawGround(S, si) {
  const buf = S.buf;
  const pal = PALS[si];
  const base = floor(S.scroll);
  const t = S.t;
  for (let y = 0; y < H; y++) {
    const wy = base + H - 1 - y;
    const ro = (wy & 255) * W;
    for (let x = 0; x < W; x++) {
      let k = S.ter[ro + x];
      if (k === CAP && (t * 1.6 + hash(x, wy, 3) * 4) % 2 > 1.55) k = WAVE;
      const q = (y * W + x) * 3;
      let r = pal[k * 3];
      let g = pal[k * 3 + 1];
      let b = pal[k * 3 + 2];
      if (si === 2 && (k === FLDA || k === ROOF) && (x + wy) % 2 === 0 && hash(x, wy, 5) < 0.4) ((r = 255), (g = 214), (b = 110));
      if (si === 3 && k === DEEP) {
        const h = hash(x, wy, 6);
        if (h < 0.035) r = g = b = 90 + 4600 * h * (0.7 + 0.3 * sin(t * 4 + h * 900));
      }
      buf[q] = r;
      buf[q + 1] = g;
      buf[q + 2] = b;
    }
  }
  if (si === 3) {
    // A ringed planet far below, drifting by slower than the station.
    const py = ((S.scroll * 0.4) % 330) - 60;
    const px = 44;
    for (let y = max(0, floor(py - 26)); y < min(H, py + 26); y++)
      for (let x = 0; x < W; x++) {
        const k = S.ter[((base + H - 1 - y) & 255) * W + x];
        if (k > SHAL && k !== CAP) continue;
        const dx = x - px;
        const dy = y - py;
        const u = (dx * 0.94 + dy * 0.34) / 31;
        const v = (dy * 0.94 - dx * 0.34) / 6;
        const onRing = abs(u * u + v * v - 1) < 0.16;
        const inside = dx * dx + dy * dy < 19 * 19;
        const q = (y * W + x) * 3;
        if (inside && !(onRing && v > 0)) {
          const band = floor((dy + 40) / 5) % 2;
          const lit = dx * 0.7 + dy * 0.5 > 8 ? 0.5 : 1;
          buf[q] = (band ? 220 : 186) * lit;
          buf[q + 1] = (band ? 150 : 104) * lit;
          buf[q + 2] = (band ? 96 : 62) * lit;
        } else if (onRing) {
          buf[q] = 210;
          buf[q + 1] = 196;
          buf[q + 2] = 160;
        }
      }
  }
}

export function draw(display, params, time) {
  const S = params.s;
  if (!S || !S.started) return;
  const buf = S.buf;
  const sh = S.sh;
  const si = min(3, floor(S.stage * 4));
  const t = S.t;
  drawGround(S, si);
  // Gunboats on the water, each with its wake and a turret that follows the fighter.
  for (const b of S.boats) {
    const y = boatY(S, b);
    for (let j = 1; j < 8; j++) {
      const o = 1 + (j >> 1);
      const a = 1 - j / 9;
      for (const s of [-1, 1]) put(buf, b.x + s * o, y - 6 - j, 200 * a + 30, 225 * a + 40, 255 * a);
    }
    spr(S, BOAT, b.x - 3, y - 6, b.fl > 0 ? 1 : 0);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) put(buf, b.x + i, y - 3 + j, 90, 95, 110);
    for (let i = 1; i <= 3; i++) put(buf, b.x + cos(b.a) * i, y - 3 + sin(b.a) * i, 30, 30, 40);
  }
  // Shadows: the clouds' and the aircraft's, a little below and to the right.
  // Thick fire dims the ground, the way bullet-hell shooters dim their backdrops so the bullets read.
  const C = CLOUDS[si];
  const cbase = floor(S.scroll * CLOUD);
  const dim = 1 - 0.36 * S.fury;
  const cb = S.cb;
  cb.fill(0);
  for (const c of S.clouds) {
    const sy = cbase + H - 1 - c.cw;
    for (let j = 0; j < c.h; j++) {
      const y = sy + j;
      if (y < 0 || y >= H) continue;
      for (let i = 0; i < c.w; i++) {
        const x = c.x + i;
        if (x >= 0 && x < W && c.m[j * c.w + i]) cb[y * W + x] = c.m[j * c.w + i];
      }
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) sh[y * W + x] = (x >= 6 && y >= 9 && cb[(y - 9) * W + x - 6] ? C[5] : 1) * dim;
  const B = S.boss;
  for (const e of S.en) if (e.y > -9) spr(S, e.k ? DART : FIGHTER, round(e.x) + 2, round(e.y) + 6, 2);
  if (B) spr(S, BOSS, round(B.x) - 22, round(B.y) + 9, 2);
  const P = S.pl;
  if (P.dead <= 0) spr(S, PLAYER, round(P.x) + 1, round(P.y) + 3, 2);
  for (let i = 0; i < N; i++) {
    const s = sh[i];
    if (s < 1) {
      buf[i * 3] *= s;
      buf[i * 3 + 1] *= s;
      buf[i * 3 + 2] *= s;
    }
  }
  // Clouds.
  for (let i = 0; i < N; i++) {
    const l = cb[i];
    if (!l) continue;
    const k = l === 1 ? C[3] : l === 3 ? 1.12 : 1;
    const a = l === 3 ? C[4] + 0.12 : C[4];
    const q = i * 3;
    buf[q] += (min(255, C[0] * k) - buf[q]) * a;
    buf[q + 1] += (min(255, C[1] * k) - buf[q + 1]) * a;
    buf[q + 2] += (min(255, C[2] * k) - buf[q + 2]) * a;
  }
  // Capsules: they blink red and blue and carry a P.
  for (const c of S.caps) {
    const red = floor(t * 7) % 2;
    for (let j = 0; j < 7; j++)
      for (let i = 0; i < 5; i++) {
        if ((i === 0 || i === 4) && (j === 0 || j === 6)) continue;
        put(buf, c.x - 2 + i, c.y - 3 + j, red ? 230 : 40, red ? 40 : 90, red ? 50 : 240);
      }
    glyph(buf, GLYPH[10], round(c.x) - 1, round(c.y) - 2, 255, 255, 255);
  }
  for (const e of S.en) if (e.y > -9) spr(S, e.k ? DART : FIGHTER, round(e.x) - 3, round(e.y) - 3, e.fl > 0 ? 1 : 0);
  if (B) {
    const p = 0.5 + 0.5 * sin(t * 9);
    const f = S.fury;
    const glow = [120 + 135 * f + 60 * p, 230 - 170 * f + 25 * p * (1 - f), 255 - 215 * f];
    const dying = B.st === 2 && floor(t * 16) % 2 === 0;
    const bx = round(B.x) - 28;
    const by = round(B.y);
    // Engine flames from its four nozzles, upwards.
    for (const ex of [15, 16, 17, 38, 39, 40])
      for (let j = 1; j <= 2 + ((t * 20 + ex) % 3 | 0); j++) put(buf, bx + ex, by - j, 255, 230 - j * 50, 120 - j * 40);
    spr(S, BOSS, bx, by, dying ? 1 : B.fl > 0 && floor(t * 20) % 3 === 0 ? 3 : 0, glow);
  }
  if (P.dead <= 0 && (P.inv <= 0 || floor(t * 12) % 2 === 0)) {
    const x0 = round(P.x) - 4;
    const y0 = round(P.y) - 5;
    const FL = [
      [255, 255, 220],
      [255, 220, 80],
      [255, 140, 30],
      [200, 60, 20],
    ];
    for (const ex of [3, 5]) {
      const L = 2 + ((t * 24 + ex) % 3 | 0);
      for (let j = 0; j < L; j++) put(buf, x0 + ex, y0 + 10 + j, ...FL[min(3, j + (L < 3 ? 1 : 0))]);
    }
    spr(S, PLAYER, x0, y0, 0);
    const a = (t - P.pu) / 0.35;
    if (a < 1) ring(buf, P.x, P.y, 3 + a * 9, 0.7, [180, 255, 255]);
  }
  for (const s of S.ps) {
    put(buf, s.x, s.y, 255, 255, 230);
    put(buf, s.x, s.y + 1, 255, 240, 120);
    put(buf, s.x, s.y + 2, 255, 200, 60);
  }
  // Explosions: a white flash, then a ring that cools from yellow to red, and sparks.
  for (const f of S.fx) {
    const a = (t - f.t0) / f.d;
    if (a < 0 || a >= 1) continue;
    const R = (1.5 + 4.5 * a) * f.s;
    if (a < 0.16) disc(buf, f.x, f.y, (1 + 1.6 * (a / 0.16)) * f.s, 255, 255, 235);
    else {
      if (a < 0.5) disc(buf, f.x, f.y, R * 0.5, 255, a < 0.3 ? 210 : 120, 40);
      ring(buf, f.x, f.y, R, 0.75, a < 0.45 ? [255, 220, 80] : a < 0.72 ? [255, 130, 30] : [180, 46, 24]);
    }
    if (a < 0.85) for (let i = 0; i < f.sp.length; i += 2) put(buf, f.x + f.sp[i] * a * f.d, f.y + f.sp[i + 1] * a * f.d, 255, 245, 170);
  }
  // Enemy bullets, bright on top of everything, in a glow that grows with the fire.
  const hr = 1 + round(2.4 * S.fury);
  if (hr > 1)
    for (const b of S.eb) {
      const c = BUL[b.c];
      for (let j = -hr; j <= hr; j++)
        for (let i = -hr; i <= hr; i++) {
          const x = round(b.x) + i;
          const y = round(b.y) + j;
          if (abs(i) + abs(j) > hr || x < 0 || y < 0 || x >= W || y >= H) continue;
          const q = (y * W + x) * 3;
          buf[q] += (c[0] - buf[q]) * 0.4;
          buf[q + 1] += (c[1] - buf[q + 1]) * 0.4;
          buf[q + 2] += (c[2] - buf[q + 2]) * 0.4;
        }
    }
  for (const b of S.eb) {
    const c = BUL[b.c];
    const x = round(b.x);
    const y = round(b.y);
    put(buf, x - 1, y, ...c);
    put(buf, x + 1, y, ...c);
    put(buf, x, y - 1, ...c);
    put(buf, x, y + 1, ...c);
    if (b.big) for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(buf, x + i, y + j, c[0] * 0.6, c[1] * 0.6, c[2] * 0.6);
    put(buf, x, y, 255, 255, 255);
  }
  for (const p of S.pop) {
    const a = (t - p.t0) / 0.9;
    if (a > 0.75 && floor(t * 20) % 2) continue;
    const s = String(p.v);
    number(buf, p.v, round(p.x - s.length * 2), round(p.y - a * 9), 255, 240, 120, 0);
  }
  // The bomb: a shock ring from the fighter, and the whole screen flashes white.
  if (S.bomb) {
    const r = (t - S.bomb.t0) * 150;
    ring(buf, S.bomb.x, S.bomb.y, r, 1.6, [200, 250, 255]);
  }
  if (S.flash > 0) {
    const a = min(1, S.flash);
    for (let i = 0; i < N * 3; i++) buf[i] += (255 - buf[i]) * a * 0.85;
  }
  // The score and the lives, small, on a dark strip.
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < W; x++) {
      if (x > 25 && x < 62 - 6 * P.lives) continue;
      const q = (y * W + x) * 3;
      buf[q] *= 0.18;
      buf[q + 1] *= 0.18;
      buf[q + 2] *= 0.18;
    }
  number(buf, S.score % 1000000, 1, 1, 255, 255, 255, 6);
  for (let i = 0; i < P.lives; i++) spr(S, LIFE, 58 - i * 6, 2, 0);
  for (let p = 0; p < N; p++) {
    const q = p * 3;
    display.setPixel(p % W, (p / W) | 0, min(255, buf[q]) | 0, min(255, buf[q + 1]) | 0, min(255, buf[q + 2]) | 0);
  }
}
