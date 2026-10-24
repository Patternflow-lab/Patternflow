// ===== Patternflow pattern =====
// Title:   Shoot 'em Up
// Family:  pixel
// Idea:    An arcade shooter plays itself: a fighter weaves over a scrolling sea, coast, fields and town, shooting down waves of craft and gunboats, until a boss fills the top and sprays rings and spirals of bullets.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 24, after the vertically scrolling arcade shooters of the 1980s
// Round:   24
// ===============================
// @matrix 64x128
// @knobs Stage=0..1, Speed=0.2..3, Waves=1..5, Bullets=0..1
//
// Knob 1: Stage. Four stages: a tropical sea and green fields at 0, a red desert canyon, a city at night, a space station among stars.
// Knob 2: Speed. The pace of the game; at 2 the ground scrolls 12 LEDs a second and the first boss comes two seconds in.
// Knob 3: Waves. From a formation every three seconds at 1 to a bigger one every second at 5, with more gunboats.
// Knob 4: Bullets. How thick the fire is, from rings of twelve at 0.06 to rings of thirty and three-armed spirals at 1, with the ground dimmed so they read.
// Buttons: K1 tap drops a bomb: a white flash and a shock ring that clears the bullets.

const W = 64;
const H = 128;
const N = W * H;
const { min, max, sin, cos, abs, atan2, hypot, floor, round, sqrt, PI } = Math;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + (b - a) * Math.random();
// Ground scroll at Speed 2 in LEDs a second; clouds go 1.8 times as fast.
const V0 = 12;
const CLOUD = 1.8;

const hash = (x, y, s) => {
  let h = Math.imul((x * 374761393 + y * 668265263 + s * 982451653) | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function noise(x, y, s) {
  const ix = floor(x), iy = floor(y), u = (x -= ix) * x * (3 - 2 * x), v = (y -= iy) * y * (3 - 2 * y), a = hash(ix, iy, s), b = hash(ix + 1, iy, s);
  const c = hash(ix, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + hash(ix + 1, iy + 1, s)) * u * v;
}

// Ground types, one colour each in every stage's palette.
const [DEEP, WAVE, CAP, SHAL, SAND, GRASS, TREE, FLDA, FLDB, ROAD, ROOF, WALL, TRUNK, RIVER, LIGHT, HEDGE] = [...Array(16).keys()];
const PALS = [
  "123c9a1e5cc4d2ecff2aa8ccf0d4884aae3c1f6a2a9ccc4a6e9a3076706ad8482ef2e6c88a5a2a2c7ed8fff2c02e5226",
  "5c20188a3a22d8966ab4502af0b464dc9a4c4a8a3cf2c278c8843e6e4630c8602ef6dcaa5a34182aa89affe6aa7a2c1a",
  "0c1846172a628ca8e61c386a50506a163e340e2c2440446a2a2c481e1e30b43c96ffd25a2e222412265effa83c1c1c2c",
  "08061c1e0e40e6e6ff34185e9a90885a62804c4440868ca8464c661c2034ff3c3cb8c2d83c343228dcff78ffc82a2e40",
].map((s) => s.match(/../g).map((h) => parseInt(h, 16)));
// Clouds per stage: colour, underside shade, alpha, shadow shade.
const CLOUDS = [
  [236, 242, 255, 0.74, 0.72, 0.62],
  [236, 200, 156, 0.78, 0.6, 0.7],
  [84, 96, 146, 0.7, 0.66, 0.72],
  [150, 76, 214, 0.6, 0.5, 1],
];

// Sprites are rows of letters, "." clear; a mirrored one is its left half.
function mk(src, pal, mirror) {
  const rows = src.trim().split(/\s+/), w = rows[0].length * (mirror ? 2 : 1), px = [], mask = new Uint8Array(w * rows.length);
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++)
      if (r[i] !== ".") for (const x of mirror ? [i, w - 1 - i] : [i]) px.push(x, j, pal[r[i]]), (mask[j * w + x] = 1);
  });
  return { px, mask };
}
const PLAYER = mk("....w.... ...wcw... ...wbw... ..gwbwg.. ..gwwwg.. .wgwwwgw. wwwwgwwww rww.g.wwr r..www..r ...r.r...", { w: 0xdce4f0, c: 0x96f0ff, b: 0x286ee6, g: 0x828ca0, r: 0xe62832 });
const FIGHTER = mk("o.....o oo.d.oo ooodooo .odwdo. ..ddd.. ...d...", { o: 0xff8c1e, d: 0xaa3214, w: 0xfff0c8 });
const DART = mk("mm...mm mmm.mmm .mmmmm. .mmcmm. ..mmm.. ..mdm.. ...m...", { m: 0xd246e6, c: 0x78f0ff, d: 0x6e1e8c });
const BOAT = mk(".kkkkk. kbbbbbk kbaaabk kbaaabk kbbbbbk kbbbbbk kbaaabk kbbbbbk .kbbbk. .kbbbk. ..kbk.. ...k...", { k: 0x1e2028, b: 0x969baa, a: 0x5a5f6e });
// The boss, 56 wide; "e" is its glowing core.
const BOSS = mk(
  `
.............kkgggk..kkkkkkk
kk...........kacccc..kbbbbbb
kykkk........kabbbc..kbbrrbb
kybbbkkk.....kabbbc..kbbrrbb
kbbbbbbbkk...kabbbc..kbbbbbb
kbbbbbbbbbkkkbabbbc..kbbbbbb
kbbrrrbbbbbbbbabbbc..kbbbkkk
kaarrrrrrbbbbbabbbc..kbbbkee
kccabbrrrrrrbbabbbckkbbbbkee
.kkcaabgggrrrrabbbcbbbbbbkee
...kcaagygbbrrrrrrbbbbbbbkee
....kacgggbbbbbrrrrrrbbbbkee
......kkcaabbbbbbbrrrbbbbkee
........kacaaabgggbbbbbbbkee
.........kkccabgygbbbbbbbkee
...........kkaagggbbbbbbbkee
.............kccaabbbbbbbkkk
..............kkccabbbbbbbbb
................kkcaabbbbbbb
..................kccbbyybbb
...................kkabbbbbb
.....................kabbbbb
.....................kcbbbbb
......................kabbbb
.......................kabbg
.......................kcbbg
........................kabg
.........................kag
.........................kcg
..........................kg`,
  { k: 0x14141e, c: 0x464a60, a: 0x787e96, b: 0xb4bacc, r: 0xdc323c, y: 0xffd646, g: 0x2c2c38, e: -1 },
  true,
);
const PALM = "t.t.t .ttt. ttktt .ttt. t.t.t".split(" ");
// 3x5 digits, a P, and a ship for the lives; one octal digit per row.
const GLYPH = [0o75557, 0o26227, 0o71747, 0o71317, 0o55711, 0o74717, 0o74757, 0o71122, 0o75757, 0o75717, 0o75744, 0o22775];
const BUL = [
  [255, 70, 170],
  [70, 220, 255],
  [255, 170, 40],
];

// The map repeats every 1024 rows: sea, coast, fields, town, river, coast. -1 is sea, 1 land.
function profile(x, wy) {
  const v = (wy % 1024) + 0.3 * (x - 32);
  return v < 250 || v > 830 ? -1 : v < 290 ? (v - 270) / 20 : v < 790 ? 1 : (810 - v) / 20;
}
const ISL = {};
function islands(sd, x, wy) {
  let best = 0;
  for (let j = floor(wy / 44) - 1, j1 = j + 2; j <= j1; j++)
    for (let i = floor(x / 32) - 1, i1 = i + 2; i <= i1; i++) {
      const ix = i * 32 + 4 + hash(i, j, sd + 2) * 24, iy = j * 44 + 6 + hash(i, j, sd + 3) * 32, r = 12 + hash(i, j, sd + 4) * 10;
      const b = 1.9 * (1 - hypot(x - ix, wy - iy) / r);
      if (b > best && hash(i, j, sd + 1) < 0.7) ((best = b), (ISL.x = ix), (ISL.y = iy), (ISL.r = r));
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
    const cx = x >> 3, cy = floor(wy / 5), h = hash(cx, cy, sd + 21), c0 = cx * 8 + floor(hash(cx, cy, sd + 22) * 6);
    if (h < 0.4 && wy === cy * 5 + floor(hash(cx, cy, sd + 23) * 4) && x >= c0 && x < c0 + (h < 0.15 ? 3 : 2)) return CAP;
    return e > -0.36 || noise(x / 6, wy / 2, sd + 5) > 0.78 ? WAVE : DEEP;
  }
  if (e < 0.08) return SAND;
  if (pr < -0.5) {
    const dx = round(x - ISL.x), dy = round(wy - ISL.y), c = ISL.r > 13 && abs(dx) <= 2 && abs(dy) <= 2 ? PALM[dy + 2][dx + 2] : ".";
    return c === "." ? GRASS : c === "k" ? TRUNK : TREE;
  }
  const u = wy % 1024, dr = abs(x - 30 - 9 * sin(wy / 70));
  if (u > 560 && u < 770) {
    const a = (u - 560) / 34, dv = abs(x - 32 - 23 * sin(a)) / sqrt(1 + (0.68 * cos(a)) ** 2);
    if (dv < 4.4) return dr < 2.6 ? (dr > 1.6 ? WALL : ROAD) : dv < 3.3 ? RIVER : SAND;
  }
  if (dr < 1.6) return dr < 0.6 && wy % 6 < 3 ? LIGHT : ROAD;
  if (u > 420 && u < 510 && dr < 22 + 6 * sin(wy / 9)) {
    // The town: in each plot a house (roof, front wall, shadow) or a tree.
    const lx = (x + 4) % 9, ly = wy % 9;
    if (lx === 0 || ly === 0) return ROAD;
    if (hash(floor((x + 4) / 9), floor(wy / 9), sd + 41) > 0.6) return hypot(lx - 4.5, ly - 4.5) < 2.7 ? TREE : GRASS;
    if (lx >= 2 && lx <= 6 && ly >= 2) return ly === 2 ? WALL : ly > 7 ? GRASS : lx === 4 ? TRUNK : ROOF;
    return (lx === 7 && ly >= 2 && ly <= 6) || (ly === 1 && lx >= 3) ? HEDGE : GRASS;
  }
  const band = floor(wy / 14), gx = x + floor(hash(band, 0, sd + 51) * 16), h = hash(floor(gx / 16), band, sd + 52);
  if (gx % 16 === 0 || wy % 14 === 0) return h < 0.6 ? HEDGE : GRASS;
  const kind = floor(h * 4);
  if (kind < 3) return (kind ? (kind > 1 ? hash(gx, wy, sd + 53) < 0.12 : gx % 3 === 0) : wy % 3 === 0) ? FLDB : FLDA;
  const tx = floor(gx / 5), ty = floor(wy / 5);
  return hypot(gx - tx * 5 - 1 - hash(tx, ty, sd + 55) * 3, wy - ty * 5 - 1 - hash(tx, ty, sd + 56) * 3) < 1.9 ? TREE : GRASS;
}
// A cloud: puffs on a flat base, 2 its body and 1 its underside.
function newCloud(S, cw) {
  const w = floor(rnd(22, 40)), h = floor(rnd(10, 16)), n = 3 + floor(w / 9), P = [];
  for (let i = 0; i < n; i++) {
    const r = h * 0.5 * (0.5 + 0.5 * sin((PI * (i + 0.5)) / n)) + rnd(-0.6, 0.8);
    P.push((w * (i + 0.5)) / n + rnd(-1.5, 1.5), h - 1.5 - r * 0.55, r);
  }
  const inn = (x, y) => x >= 0 && y >= 0 && x < w && y <= h - 1.5 && P.some((_, i) => i % 3 === 0 && hypot(x + 0.5 - P[i], y + 0.5 - P[i + 1]) < P[i + 2]);
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inn(x, y)) m[y * w + x] = inn(x, y + 2) ? 2 : 1;
  S.clouds.push({ x: floor(rnd(-14, 56 - w / 2)), cw: cw + h, w, h, m });
}
function fill(S) {
  for (const top = floor(S.scroll) + H + 24; S.gen < top; S.gen++) for (let x = 0; x < W; x++) S.ter[(S.gen & 255) * W + x] = terrain(S.sd, x, S.gen);
  const cb = floor(S.scroll * CLOUD);
  for (; S.cnext < cb + H + 20; S.cnext += floor(rnd(24, 52))) newCloud(S, S.cnext);
  S.clouds = S.clouds.filter((c) => cb + H - 1 - c.cw < H);
}

export function setup(params) {
  const S = { t: 0, scroll: 85, gen: 83, cnext: 147, sd: floor(Math.random() * 9000), ter: new Uint8Array(256 * W), cb: new Uint8Array(N), buf: new Float32Array(N * 3), sh: new Float32Array(N) };
  Object.assign(S, { clouds: [], en: [], boats: [], eb: [], ps: [], fx: [], pop: [], caps: [], bossAt: 3.2, bossN: 0, waveAt: 0.4, waveN: 0, boatAt: 0.2, kills: 0, score: 0, flash: 0 });
  S.pl = { x: 32, y: 112, lvl: 0, lvlT: 0, ft: 0 };
  fill(S);
  params.s = S;
}

function shoot(S, x, y, a, v, c, big) {
  if (S.eb.length < 380) S.eb.push({ x, y, vx: cos(a) * v, vy: sin(a) * v, c, big });
}
function fan(S, x, y, m, gap, v) {
  const g = atan2(S.pl.y - y, S.pl.x - x);
  for (let i = 0; i < m; i++) shoot(S, x, y, g + (i - (m - 1) / 2) * gap, v, 2, 0);
}
function boom(S, x, y, s) {
  const sp = [];
  for (let i = 0; i < 4 + s * 3; i++) {
    const a = rnd(0, 6.283);
    sp.push(cos(a) * rnd(20, 50) * s, sin(a) * rnd(20, 50) * s);
  }
  S.fx.push({ x, y, t0: S.t, s, sp, d: 0.45 + 0.12 * s });
}
function score(S, x, y, v) {
  S.pop.push({ x, y, v, t0: S.t });
  S.score += v;
}
// A hit; a kill leaves an explosion, its score, and every ninth a capsule.
function hurt(S, e, n, x, y) {
  e.fl = 0.06;
  if ((e.hp -= n) > 0) return;
  boom(S, x, y, e.boat ? 1.3 : 1);
  score(S, x, y - 4, e.boat ? 300 : e.k ? 150 : 100);
  if (++S.kills % 9 === 0) S.caps.push({ x, y });
}
const boatY = (S, b) => floor(S.scroll) + H - 1 - round(b.wy);
const yOf = (S, e) => (e.boat ? boatY(S, e) : e.y);

function spawn(S) {
  const w = S.waves;
  if (S.t >= S.waveAt) {
    const n = S.waveN++, m = 4 + round(w);
    if (n % 2 === 0) {
      const o = { k: 0, side: n % 4 ? -1 : 1, y0: rnd(8, 30) };
      for (let i = 0; i < m; i++) S.en.push({ ...o, born: S.t + i * 0.3, x: -99, y: -99, hp: 6 });
    } else {
      const cx = rnd(24, 40);
      for (let i = 0; i < (m | 1); i++) {
        const r = (i + 1) >> 1;
        S.en.push({ k: 1, born: S.t, x: cx + (i & 1 ? r : -r) * 6, y: -8 - r * 6, hy: 34 - r * 6, st: 0, hp: 7, hold: 0.5 + r * 0.25 + rnd(0, 0.2) });
      }
    }
    S.waveAt = S.t + (n === 0 ? 0.45 : S.boss ? 2 : 1) * (3.3 / w ** 0.75);
  }
  if (S.t < S.boatAt) return;
  // A gunboat, where its hull fits on open water.
  const wy = floor(S.scroll) + H + 8;
  S.boatAt = S.t + 0.3;
  for (let n = 0; n < 6; n++) {
    const x = floor(rnd(6, 58));
    let ok = true;
    for (let j = -7; j <= 7; j += 2) for (let i = -4; i <= 4; i += 2) ok &&= S.ter[((wy + j) & 255) * W + x + i] <= CAP;
    if (ok) return S.boats.push({ boat: 1, x, wy, hp: 10, ft: rnd(0.6, 1.6) }), (S.boatAt += rnd(1.1, 2.7) / w ** 0.7);
  }
}

function stepEnemies(S, d) {
  const f = S.fury;
  for (const e of S.en) {
    const a = S.t - e.born;
    e.fl -= d;
    if (a < 0) continue;
    if (e.k === 0) {
      e.x = e.side > 0 ? -6 + 38 * a : 70 - 38 * a;
      e.y = e.y0 + 14 * a + 13 * sin(3.2 * a);
    } else if (e.st === 0) {
      if ((e.y += 50 * d) >= e.hy) ((e.st = 1), (e.t1 = S.t));
    } else if (e.st === 1) {
      if (S.t - e.t1 > e.hold) {
        const g = atan2(S.pl.y - e.y, S.pl.x - e.x);
        ((e.st = 2), (e.vx = cos(g) * 30), (e.vy = sin(g) * 30));
        if (Math.random() < 0.35 + 0.65 * f) fan(S, e.x, e.y + 3, 1 + 2 * round(f * 1.5), 0.25, 42);
      }
    } else {
      const k = min(130, hypot(e.vx, e.vy) + 110 * d) / hypot(e.vx, e.vy);
      e.x += (e.vx *= k) * d;
      e.y += (e.vy *= k) * d;
    }
  }
  S.en = S.en.filter((e) => e.hp > 0 && e.y < 140 && e.x > -20 && e.x < 84);
  for (const b of S.boats) {
    const sy = boatY(S, b);
    b.fl -= d;
    b.a = atan2(S.pl.y - sy + 3, S.pl.x - b.x);
    if ((b.ft -= d) <= 0 && sy > 2 && sy < 96) {
      b.ft = 2.2 - 1.3 * f;
      for (let i = f > 0.5 ? -1 : 0; i <= (f > 0.5 ? 1 : 0); i++) shoot(S, b.x + cos(b.a) * 4, sy - 3 + sin(b.a) * 4, b.a + i * 0.25, 38, 2, 0);
    }
  }
  S.boats = S.boats.filter((b) => b.hp > 0 && boatY(S, b) < 140);
}

function stepBoss(S, d) {
  const f = S.fury;
  // The first boss is short, so its fight fits the first seconds.
  if (!S.boss && S.t >= S.bossAt) S.boss = { x: 32, y: -34, t0: S.t, st: 0, hp: S.bossN ? 320 + 40 * S.bossN : 60, ph: S.bossN ? 2.8 : 1.6, ang: 0 };
  const B = S.boss;
  if (!B) return;
  B.fl -= d;
  if (B.st === 2) {
    if (!(S.t < B.nd)) {
      boom(S, B.x + rnd(-22, 22), B.y + rnd(4, 24), rnd(0.7, 1.4));
      B.nd = S.t + 0.07;
    }
    if (S.t - B.t2 > 1.7) {
      boom(S, B.x, B.y + 12, 3.2);
      for (let i = 0; i < 6; i++) boom(S, B.x + rnd(-24, 24), B.y + rnd(4, 26), rnd(1, 1.8));
      score(S, B.x - 6, B.y + 14, 5000);
      S.caps.push({ x: B.x, y: B.y + 20 });
      Object.assign(S, { flash: 0.75, boss: null, bossAt: S.t + rnd(18, 30), bossN: S.bossN + 1 });
    }
  } else if (B.st === 0) {
    const u = min(1, (S.t - B.t0) / 1.4);
    B.y = -34 + 40 * (1 - (1 - u) * (1 - u));
    if (u >= 1) ((B.st = 1), (B.t1 = S.t));
  } else {
    // In turns: a ring, a spiral, aimed fans from the wing guns.
    B.x = 32 + 3 * sin((S.t - B.t1) * 0.8);
    const ph = floor((S.t - B.t1) / B.ph) % 3;
    if (ph === 0 && !(S.t < B.nr)) {
      const n = round(12 + 18 * f), a0 = rnd(0, 6.283);
      B.nr = S.t + 1.5 - 0.8 * f;
      for (let i = 0; i < n; i++) shoot(S, B.x, B.y + 11, a0 + (i * 2 * PI) / n, 28, 0, 1);
    }
    if (ph === 1 && !(S.t < B.nx)) {
      const arms = f > 0.5 ? 3 : 2;
      B.nx = S.t + 1 / (7 + 23 * f);
      B.ang += 0.37;
      for (let i = 0; i < arms; i++) shoot(S, B.x, B.y + 11, B.ang + (i * 2 * PI) / arms, 32, 1, 0);
    }
    if (ph === 2 && !(S.t < B.nf)) {
      B.nf = S.t + 1.05 - 0.55 * f;
      for (const s of [-1, 1]) fan(S, B.x + s * 19.5, B.y + 10, 3 + round(6 * f), 0.12 + 0.1 * f, 42);
    }
  }
}

function stepPlayer(S, d) {
  const P = S.pl, B = S.boss;
  if ((P.lvlT -= d) <= 0 && P.lvl > 0) ((P.lvl -= 1), (P.lvlT = 14));
  // Its aim: the boss, a capsule, or half way from its weave to the nearest enemy.
  const wv = 32 + 18 * sin(S.t * 0.53);
  let ax = wv, ny = -99;
  if (B && B.st > 0) ax = B.x + 10 * sin(S.t * 1.1);
  else if (S.caps.length) ax = S.caps[0].x;
  else for (const e of [...S.en, ...S.boats]) if (yOf(S, e) > max(0, ny) && yOf(S, e) < P.y - 14) ((ny = yOf(S, e)), (ax = 0.55 * e.x + 0.45 * wv));
  // Then the nearby spot the bullets will miss on its way there.
  let best = 1e9, bx = P.x, by = P.y;
  for (const ox of [-14, -9, -5, -2, 0, 2, 5, 9, 14])
    for (const oy of [-8, -3, 0, 4]) {
      const cx = clamp(P.x + ox, 5, 58), cy = clamp(P.y + oy, 96, 116), dist = max(0.01, hypot(cx - P.x, cy - P.y));
      let c = 0.05 * abs(cx - ax) + 0.04 * abs(cy - 111) + 0.015 * dist;
      for (const b of S.eb)
        for (const tau of abs(b.y - cy) < 45 ? [0.05, 0.12, 0.2, 0.3, 0.42] : []) {
          const k = min(1, (60 * tau) / dist), dx = b.x + b.vx * tau - P.x - (cx - P.x) * k, dy = b.y + b.vy * tau - P.y - (cy - P.y) * k;
          c += max(0, 30 - dx * dx - 0.7 * dy * dy) / (tau < 0.15 ? 6 : 15);
        }
      if (c < best) ((best = c), (bx = cx), (by = cy));
    }
  P.x += clamp(bx - P.x, -60 * d, 60 * d);
  P.y += clamp(by - P.y, -60 * d, 60 * d);
  // Two streams, three after a capsule, five after two.
  for (P.ft -= d; P.ft <= 0; P.ft += 0.1)
    for (const [x, vx] of [[-2, 0], [2, 0], [0, 0], [-3, -38], [3, 38]].slice(0, [2, 3, 5][P.lvl])) S.ps.push({ x: P.x + x, y: P.y - 5, vx, vy: -170 });
}

function stepShots(S, d) {
  const B = S.boss, P = S.pl;
  for (const s of S.ps) {
    s.x += s.vx * d;
    s.y += s.vy * d;
    if (s.y < -4) s.dead = 1;
    for (const e of [...S.en, ...S.boats]) if (!s.dead && e.hp > 0 && abs(s.x - e.x) <= 4 && abs(s.y - yOf(S, e)) <= (e.boat ? 6 : 4)) ((s.dead = 1), hurt(S, e, 1, e.x, yOf(S, e)));
    const ix = round(s.x - B?.x + 28), iy = round(s.y - B?.y);
    if (!s.dead && B?.st === 1 && ix >= 0 && ix < 56 && iy >= 0 && iy < 30 && BOSS.mask[iy * 56 + ix]) ((s.dead = 1), (B.fl = 0.05), (S.score += 10), --B.hp);
  }
  // A bullet that reaches the fighter bursts on its shield.
  for (const b of S.eb) {
    b.x += b.vx * d;
    b.y += b.vy * d;
    if (b.x < -3 || b.x > 66 || b.y < -3 || b.y > 130) b.dead = 1;
    else if (abs(b.x - P.x) < 1.6 && abs(b.y - P.y) < 2.5) ((b.dead = 1), boom(S, b.x, b.y, 0.4));
  }
  if (B?.st === 1 && B.hp <= 0) ((B.st = 2), (B.t2 = S.t), (S.eb.length = 0));
  for (const c of S.caps) {
    c.y += 14 * d;
    if (abs(c.x - P.x) < 6 && abs(c.y - P.y) < 7) ((c.dead = 1), (P.lvl = min(2, P.lvl + 1)), (P.lvlT = 16));
  }
  for (const k of ["ps", "eb", "caps"]) S[k] = S[k].filter((o) => !o.dead && o.y < 134);
  S.fx = S.fx.filter((f) => S.t - f.t0 < f.d);
  S.pop = S.pop.filter((p) => S.t - p.t0 < 0.9);
}

function step(S, d) {
  S.t += d;
  S.scroll += V0 * d;
  S.flash = max(0, S.flash - 2.6 * d);
  fill(S);
  spawn(S);
  stepEnemies(S, d);
  stepBoss(S, d);
  stepPlayer(S, d);
  stepShots(S, d);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  [S.stage, S.waves, S.fury] = [clamp(k[0], 0, 1), clamp(k[2], 1, 5), clamp(k[3], 0, 1)];
  // The first second plays before the first frame.
  if (!S.started) {
    S.started = 1;
    for (let i = 0; i < 30; i++) step(S, 1 / 30);
  }
  // The bomb clears the bullets and hurts everything on the screen.
  if (input.btnPressed?.[0]) {
    Object.assign(S, { flash: 0.9, bomb: S.t, eb: [] });
    for (const e of [...S.en, ...S.boats]) if (e.hp > 0 && yOf(S, e) > 0) hurt(S, e, 4, e.x, yOf(S, e));
    if (S.boss?.st === 1) S.boss.hp -= 15;
  }
  for (let d = (clamp(dt || 0, 0, 0.1) * clamp(k[1], 0.2, 3)) / 2; d > 0; d -= 1 / 30) step(S, min(d, 1 / 30));
}

function put(buf, x, y, r, g, b) {
  const q = (round(y) * W + round(x)) * 3;
  if (x > -0.5 && y > -0.5 && x < W - 0.5 && y < H - 0.5) ((buf[q] = r), (buf[q + 1] = g), (buf[q + 2] = b));
}
function mix(buf, q, r, g, b, a) {
  buf[q] += (r - buf[q]) * a;
  buf[q + 1] += (g - buf[q + 1]) * a;
  buf[q + 2] += (b - buf[q + 2]) * a;
}
// Mode 1 draws a sprite white, 2 stamps its shadow.
function spr(S, sp, x0, y0, mode, glow) {
  const p = sp.px;
  for (let i = 0; i < p.length; i += 3) {
    const x = x0 + p[i], y = y0 + p[i + 1], c = mode ? 0xffffff : p[i + 2];
    if (mode === 2) {
      if (x >= 0 && y >= 0 && x < W && y < H) S.sh[y * W + x] = min(S.sh[y * W + x], 0.55);
    } else if (c < 0) put(S.buf, x, y, ...glow);
    else put(S.buf, x, y, c >> 16, (c >> 8) & 255, c & 255);
  }
}
function number(buf, v, x0, y0, r, g, b) {
  const s = String(v);
  for (let n = 0; n < s.length; n++)
    for (let j = 0; j < 15; j++) if ((GLYPH["0123456789PA".indexOf(s[n])] >> (14 - j)) & 1) put(buf, x0 + n * 4 + (j % 3), y0 + floor(j / 3), r, g, b);
}
// A ring of width w, or a disc for w 0.
function ring(buf, cx, cy, R, w, c) {
  for (let y = floor(cy - R - w); y <= cy + R + w; y++)
    for (let x = floor(cx - R - w); x <= cx + R + w; x++) if (w ? abs(hypot(x - cx, y - cy) - R) < w : hypot(x - cx, y - cy) <= R) put(buf, x, y, ...c);
}

export function draw(display, params, time) {
  const S = params.s;
  if (!S || !S.started) return;
  const { buf, sh, cb, pl: P, boss: B, t } = S,
    si = min(3, floor(S.stage * 4)), pal = PALS[si];
  for (let y = 0; y < H; y++)
    for (let x = 0, wy = floor(S.scroll) + H - 1 - y; x < W; x++) {
      let k = S.ter[(wy & 255) * W + x];
      if (k === CAP && (t * 1.6 + hash(x, wy, 3) * 4) % 2 > 1.55) k = WAVE;
      put(buf, x, y, pal[k * 3], pal[k * 3 + 1], pal[k * 3 + 2]);
      if (si === 2 && k === FLDA && (x + wy) % 2 === 0 && hash(x, wy, 5) < 0.4) put(buf, x, y, 255, 214, 110);
      const h = si === 3 && k === DEEP ? hash(x, wy, 6) : 1;
      if (h < 0.035) put(buf, x, y, ...Array(3).fill(90 + 4600 * h * (0.7 + 0.3 * sin(t * 4 + x * y))));
    }
  for (const b of S.boats) {
    const y = boatY(S, b);
    spr(S, BOAT, b.x - 3, y - 6, b.fl > 0 ? 1 : 0);
    for (let i = 1; i <= 3; i++) put(buf, b.x + cos(b.a) * i, y - 3 + sin(b.a) * i, 30, 30, 40);
  }
  // Shadows, then the clouds. Thick fire dims the ground as bullet-hell games do.
  const C = CLOUDS[si];
  cb.fill(0);
  for (const c of S.clouds)
    for (let j = 0, sy = floor(S.scroll * CLOUD) + H - 1 - c.cw; j < c.h; j++)
      for (let i = 0, x = c.x, y = sy + j; i < c.w; i++, x++) if (x >= 0 && x < W && y >= 0 && y < H && c.m[j * c.w + i]) cb[y * W + x] = c.m[j * c.w + i];
  for (let i = 0; i < N; i++) sh[i] = (i % W >= 6 && i >= 9 * W && cb[i - 9 * W - 6] ? C[5] : 1) * (1 - 0.36 * S.fury);
  for (const e of S.en) spr(S, e.k ? DART : FIGHTER, round(e.x) + 2, round(e.y) + 6, 2);
  if (B) spr(S, BOSS, round(B.x) - 22, round(B.y) + 9, 2);
  spr(S, PLAYER, round(P.x) + 1, round(P.y) + 3, 2);
  for (let i = 0; i < N; i++) {
    const l = cb[i], k = l === 1 ? C[3] : 1;
    mix(buf, i * 3, 0, 0, 0, 1 - sh[i]);
    if (l) mix(buf, i * 3, C[0] * k, C[1] * k, C[2] * k, C[4]);
  }
  for (const c of S.caps) ring(buf, c.x, c.y, 2.9, 0, floor(t * 7) % 2 ? [230, 40, 50] : [40, 90, 240]), number(buf, "P", c.x - 1, c.y - 2, 255, 255, 255);
  for (const e of S.en) spr(S, e.k ? DART : FIGHTER, round(e.x) - 3, round(e.y) - 3, e.fl > 0 ? 1 : 0);
  // The boss's core pulses cyan, or red as the fury rises.
  const f = S.fury, p = 0.5 + 0.5 * sin(t * 9);
  if (B) spr(S, BOSS, round(B.x) - 28, round(B.y), floor(t * 16) % 3 === 0 && (B.st === 2 || B.fl > 0) ? 1 : 0, [120 + 135 * f + 60 * p, 230 - 170 * f + 25 * p * (1 - f), 255 - 215 * f]);
  for (const ex of [3, 5])
    for (let j = 0, L = 2 + ((t * 24 + ex) % 3 | 0), c; j < L; j++) put(buf, round(P.x) - 4 + ex, round(P.y) + 5 + j, 255 - 12 * (c = min(3, j + (L < 3))) * c, 255 - 65 * c, 220 - 70 * c);
  spr(S, PLAYER, round(P.x) - 4, round(P.y) - 5, 0);
  for (const s of S.ps) for (let j = 0; j < 3; j++) put(buf, s.x, s.y + j, 255, 255 - 28 * j, 230 - 85 * j);
  // Explosions: a white flash, a ring cooling from yellow to red, sparks.
  for (const f of S.fx) {
    const a = (t - f.t0) / f.d, R = (1.5 + 4.5 * a) * f.s;
    if (a < 0.16) ring(buf, f.x, f.y, (1 + 10 * a) * f.s, 0, [255, 255, 235]);
    else if (a < 0.5) ring(buf, f.x, f.y, R * 0.5, 0, [255, a < 0.3 ? 210 : 120, 40]);
    if (a >= 0.16) ring(buf, f.x, f.y, R, 0.75, a < 0.45 ? [255, 220, 80] : a < 0.72 ? [255, 130, 30] : [180, 46, 24]);
    for (let i = 0; a < 0.85 && i < f.sp.length; i += 2) put(buf, f.x + f.sp[i] * a * f.d, f.y + f.sp[i + 1] * a * f.d, 255, 245, 170);
  }
  for (const b of S.eb) {
    const c = BUL[b.c];
    for (let i = 0; i < 9; i++) if (i % 2 || (b.big && i !== 4)) put(buf, b.x + (i % 3) - 1, b.y + floor(i / 3) - 1, ...c.map((v) => (i % 2 ? v : v * 0.6)));
    put(buf, b.x, b.y, 255, 255, 255);
  }
  for (const p of S.pop) {
    const a = (t - p.t0) / 0.9;
    if (a < 0.75 || floor(t * 20) % 2) number(buf, p.v, round(p.x - String(p.v).length * 2), round(p.y - a * 9), 255, 240, 120);
  }
  if (t - S.bomb < 1) ring(buf, P.x, P.y, (t - S.bomb) * 150, 1.6, [200, 250, 255]);
  for (let i = 0; S.flash > 0 && i < N * 3; i++) buf[i] += (255 - buf[i]) * min(1, S.flash) * 0.85;
  for (let i = 0; i < 7 * W; i++) if (i % W < 26 || i % W >= 50) mix(buf, i * 3, 0, 0, 0, 0.82);
  number(buf, String(S.score % 1e6).padStart(6, "0"), 1, 1, 255, 255, 255);
  number(buf, "AAA", 52, 1, 220, 228, 240);
  for (let p = 0; p < N; p++) display.setPixel(p % W, (p / W) | 0, min(255, buf[p * 3]) | 0, min(255, buf[p * 3 + 1]) | 0, min(255, buf[p * 3 + 2]) | 0);
}
