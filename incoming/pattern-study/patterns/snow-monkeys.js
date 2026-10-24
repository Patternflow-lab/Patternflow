// ===== Patternflow pattern =====
// Title:   Snow Monkeys
// Family:  mammal
// Idea:    At dusk in the snow at Jigokudani, Japanese macaques soak to the shoulders in a steaming hot spring, dozing with snow on their heads and grooming each other, while a mother wades in off a boulder, her baby leaps in after her with a splash, and clumps of steam roll up the valley through the falling snow.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 25, after the Japanese macaques (Macaca fuscata) that bathe in the hot spring at Jigokudani, Nagano
// Round:   25
// ===============================
// @matrix 64x128
// @knobs Light=0..1, Speed=0.2..3, Monkeys=3..14, Wind=-1..1
//
// Knob 1: Light. The blue snow light of early evening at 0, through a violet dusk, to night at 1, when the stone lantern by the pool burns orange and lights the steam, the water and the monkeys near it.
// Knob 2: Speed. At 2 the steam takes about ten seconds to climb from the water to the top of the panel, and the mother soaks for about twenty seconds, then sits on her boulder about as long; at 0.2 it all runs ten times slower.
// Knob 3: Monkeys. How many soak in the pool or sit on the rim rocks besides the mother and her baby, from three (a pair grooming and one asleep up to its chin) to a crowded fourteen. Turned up, they surface one by one; turned down, they sink away and the ones on the rim slip down behind their rocks. Wet fur steams, so more monkeys put up more steam.
// Knob 4: Wind. Calm in the middle, where the steam rises in clumps and sways; turned either way it leans the steam over and tears it off downwind, slants the snow and thickens it.
// Buttons: K1 tap sends the baby on the boulder leaping into the water with a splash; it paddles back and climbs out again. On its own it jumps about six seconds in, then every half minute or so.

const W = 64, H = 128, N = W * H, GW = 32, GH = 64;
const { min, max, floor, round, sin, cos, sqrt, exp, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + hash(xi + 1, yi + 1)) * su * sv;
}

// The back edge of the pool, and how big a monkey stands at a depth row.
const PB = 67;
const scl = (y) => 0.74 + (y - PB) * 0.0135;
// The stone lantern's fire box.
const [LX, LY] = [8.5, 50.5];
// The light from evening to night: ambient, sky overhead, sky at the ridge,
// lit steam, and the lantern's strength.
const LIGHT = [
  [0, 0.5, 0.6, 0.86, 24, 44, 104, 70, 98, 160, 196, 212, 240, 0.25],
  [0.5, 0.36, 0.4, 0.66, 16, 20, 62, 84, 66, 118, 150, 156, 196, 0.65],
  [1, 0.2, 0.24, 0.42, 5, 8, 24, 18, 24, 54, 84, 92, 130, 1.1],
];
const LC = [1, 0.62, 0.3];
const SNOW = [232, 238, 250], FUR = [218, 184, 150], FACE = [250, 96, 92], EAR = [214, 132, 124], HAND = [120, 84, 78], EYE = [40, 22, 20];
const ROCK = [70, 64, 62], NEEDLE = [24, 46, 36], TRUNK = [52, 38, 30], WATER = [34, 70, 74], STONE = [118, 114, 108];
// Boulders as half ellipses standing on their water line: centre, radii,
// depth row. The back rim, the boulder in the pool, the near rocks.
const ROCKS = [
  [2, 68, 12, 8, 66], [17, 69, 8, 6, 66], [30, 69, 9, 5, 66], [45, 68, 11, 6, 66], [61, 68, 10, 9, 66],
  [53, 92, 13, 12, 90],
  [6, 132, 15, 14, 126], [28, 133, 12, 12, 127], [48, 132, 11, 13, 126], [64, 129, 10, 15, 125],
];
// Cedars on the slope, far to near: apex x and row, height, nearness.
const TREES = [];
for (let i = 0; i < 10; i++) TREES.push([2 + i * 6.7 + 3 * hash(i, 1), 4 + 9 * hash(i, 2), 16 + 8 * hash(i, 3), 0.3]);
for (let i = 0; i < 7; i++) TREES.push([i * 10.5 + 5 * hash(i, 4), 16 + 12 * hash(i, 5), 24 + 10 * hash(i, 6), 0.6]);
TREES.push([3, 12, 52, 1], [61, 6, 56, 1]);
// Places in the order the Monkeys knob fills them: x, depth row (the seat
// row on the rim), how low it sits in the water (0 shoulders out, 1 chin in
// it), and what it does (0 looks about, 1 dozes, 2 grooms the one before
// it, 3 sits on the rim rocks).
const SLOTS = [
  [24, 101, 0.15, 1], [34, 93, 0.1, 2], [11, 117, 0.6, 1], [30, 64.5, 0, 3], [52, 119, 0.25, 0], [8, 90, 0.2, 0],
  [41, 63, 0, 3], [61, 110, 0.3, 0], [31, 79, 0.15, 0], [37, 118, 0.3, 1], [23, 121, 0.5, 1], [14, 77, 0.2, 1],
  [5, 104, 0.2, 0], [46, 86, 0.1, 0],
];
// The boulder seats and the way down into the water, as x and bottom row.
const SEAT = [52, 81], EDGE = [46, 83.5], FOOT = [44, 93], SPOT = [47, 103], BSEAT = [60, 83], BLAND = [53, 102], BFOOT = [60, 94];

function ramp(g, c) {
  let j = 0;
  while (j < LIGHT.length - 2 && g > LIGHT[j + 1][0]) j++;
  const a = LIGHT[j], b = LIGHT[j + 1];
  return mix(a[c + 1], b[c + 1], cl((g - a[0]) / (b[0] - a[0]), 0, 1));
}

export function setup(params) {
  const F32 = (n) => new Float32Array(n);
  const P = (params.s = {
    t: 0, init: false, f: F32(N * 3), bg: F32(N * 3), il: F32(N * 3), lm: F32(N), z: new Uint8Array(N), G: F32(GW * GH), key: -1,
    puffs: [], drops: [], acc: 0, vent: 0.5, fx: 0, fy: 0, gust: 0, w: 0, k1: 0, n: 3, spl: null,
    R: { st: 0, t: 0, dur: 3, lk: 0, lt: 0, lc: 1 }, B: { st: 0, t: 0, nj: 6.2, lk: 0, lt: 0, lc: 2 },
  });
  P.sd = 7;
  P.mk = SLOTS.map(([x, y, sk, pose], i) => ({ x, y, sk, pose, s: pose > 2 ? 0.86 : scl(y), p: 0, sw: i * 0.3, hy: y - 8, lk: pose === 2 ? -0.8 : 0, lt: 0, lc: 1 + rnd() * 3, e: pose === 1 ? 1 : 0, bl: 2 + rnd() * 3, ph: rnd() * 7, i }));
  P.flakes = Array.from({ length: 180 }, () => {
    const z = rnd();
    return { x: rnd() * W, y: rnd() * H, z, ph: rnd() * 7, land: 40 + z * 88 };
  });
  P.flakes.forEach((f) => (f.y = rnd() * f.land));
  P.rg = Array.from({ length: W }, (_, x) => 8 + 5 * vn(x * 0.07, 1.3) - 0.06 * x);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) P.lm[y * W + x] = exp(-((x + 0.5 - LX) ** 2 + (y + 0.5 - LY) ** 2 * 0.8) / 1500);
}

function spawn(P, x, y, a, g = rnd) {
  P.puffs.push({ x, y, a, r: 2.5 + 2.5 * g(), age: 0, life: 7 + 5 * g(), vy: -(6 + 5 * g()), ph: g() * 7 });
}

// The steam: puffs off the water, thick clumps from the spring's mouth, all
// rising, growing and fading, swayed by the gusts and leaned by the wind.
function steam(P, d) {
  const w = P.w;
  P.gust = 0.55 * sin(P.t * 0.31) + 0.3 * sin(P.t * 0.83 + 2);
  for (P.acc += d * 1.8; P.acc > 1; P.acc--) spawn(P, 2 + rnd() * 60 - w * 22, 74 + rnd() * 44, 0.2 + 0.25 * rnd());
  if ((P.vent -= d) < 0) {
    P.vent = 0.7 + rnd() * 1.1;
    const vx = [9, 22, 36][floor(rnd() * 3)] + rnd() * 6 - 3 - w * 14, vy = 72 + rnd() * 16;
    for (let n = 0; n < 3; n++) spawn(P, vx + rnd() * 8 - 4, vy + rnd() * 6, 0.4 + 0.25 * rnd());
  }
  // Wet fur steams in the cold: a wisp off each monkey's head now and then,
  // from a generator of its own so the rest of the steam keeps its course.
  for (const m of P.mk)
    if (m.p > 0.5 && (m.sw -= d) < 0) {
      const g = () => ((P.sd = (Math.imul(P.sd, 1103515245) + 12345) >>> 0) / 4294967296);
      m.sw = 0.35 + g() * 0.6;
      spawn(P, m.x + (g() - 0.5) * 6 * m.s, m.hy - 3 * m.s, 0.25 + 0.2 * g(), g);
    }
  const wx = w * 15 + P.gust * 7;
  for (const q of P.puffs) {
    q.age += d;
    const up = sm(84, 20, q.y);
    q.x += (wx * (0.3 + 0.7 * up) + 1.6 * sin(q.age * 1.3 + q.ph)) * d;
    q.y += q.vy * (0.5 + 0.5 * sm(0, 2.5, q.age)) * d;
    q.r += (0.9 + 0.8 * abs(w)) * d;
  }
  P.puffs = P.puffs.filter((q) => q.age < q.life * (1 - 0.35 * abs(w)) && q.y + q.r > -4 && q.x > -30 && q.x < 94);
  P.fx -= wx * 0.2 * d;
  P.fy += 1.8 * d;
}

// Where the mother is on her way between the boulder and the pool, u 0..1.
function path(u) {
  if (u < 0.3) {
    const q = sm(0, 0.3, u);
    return [mix(SEAT[0], EDGE[0], q), mix(SEAT[1], EDGE[1], q), 999, 90];
  }
  if (u < 0.55) {
    const q = sm(0.3, 0.55, u);
    return [mix(EDGE[0], FOOT[0], q), mix(EDGE[1], FOOT[1], q), 999, 90 + 3 * q];
  }
  const q = sm(0.55, 1, u), wl = mix(FOOT[1], SPOT[1], q);
  return [mix(FOOT[0], SPOT[0], q), wl + 9.5 * q * scl(wl), wl, wl];
}

function look(m, d) {
  if ((m.lc -= d) < 0) (m.lc = 1.2 + rnd() * 3), (m.lt = floor(rnd() * 3) - 1);
  m.lk += (m.lt - m.lk) * min(1, d * 5);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const d = (cl(dt || 0, 0, 0.1) * cl(k[1], 0.2, 3)) / 2;
  P.k1 = cl(k[0], 0, 1);
  P.n = round(cl(k[2], 3, 14));
  P.w = cl(k[3], -1, 1);
  if (!P.init) {
    // Open on a pool already steaming.
    for (let i = 0; i < 120; i++) (P.t += 0.1), steam(P, 0.1);
    P.t = 0;
    for (const m of P.mk) m.p = m.i < P.n ? 1 : 0;
    P.init = true;
  }
  const T = (P.t += d);
  steam(P, d);
  for (const m of P.mk) {
    m.p = cl(m.p + (m.i < P.n ? d : -d) * 0.8, 0, 1);
    if (m.pose % 3 === 0) {
      look(m, d);
      if ((m.bl -= d) < 0) m.bl = 2 + rnd() * 4;
      m.e = m.bl < 0.15 ? 1 : 0;
    }
  }
  // The mother sits on the boulder until she wades in to soak. Later she climbs out again.
  const R = P.R;
  if ((R.t += d) >= R.dur) {
    R.st = (R.st + 1) % 4;
    (R.t = 0), (R.dur = [16 + rnd() * 6, 3, 18 + rnd() * 6, 3.4][R.st]);
  }
  look(R, d);
  // The baby on the boulder: a leap, a splash, a paddle back and a climb.
  const B = P.B;
  if (input.btnPressed && input.btnPressed[0] && B.st === 0) B.nj = 0;
  if (B.st === 0 && (B.nj -= d) <= 0) (B.st = 1), (B.t = 0);
  if (B.st) B.t += d;
  if (B.st === 1 && B.t >= 0.7) {
    (B.st = 2), (B.t = 0), (P.spl = { x: BLAND[0], y: BLAND[1], t: 0 });
    for (let n = 0; n < 34; n++) {
      const a = (rnd() - 0.5) * 2.4;
      P.drops.push([BLAND[0] + a * 2, BLAND[1] - 1, a * 14 + (rnd() - 0.5) * 6, -12 - rnd() * 22, BLAND[1] + (rnd() - 0.3) * 6]);
    }
    for (let n = 0; n < 4; n++) spawn(P, BLAND[0] + rnd() * 10 - 5, BLAND[1] - 4, 0.8);
  }
  if (B.st === 2 && B.t >= 4.2) (B.st = 3), (B.t = 0);
  if (B.st === 3 && B.t >= 1.3) (B.st = 0), (B.t = 0), (B.nj = 24 + rnd() * 10);
  look(B, d);
  if (P.spl && (P.spl.t += d) > 2) P.spl = null;
  P.drops = P.drops.filter((q) => {
    (q[0] += q[2] * d), (q[1] += q[3] * d), (q[3] += 70 * d);
    return !(q[3] > 0 && q[1] > q[4]);
  });
  for (const f of P.flakes) {
    f.y += (5 + 9 * f.z) * (1 + 0.6 * abs(P.w)) * d;
    f.x += ((P.w * 18 + P.gust * 4) * (0.4 + 0.6 * f.z) + 0.9 * sin(T * 1.7 + f.ph)) * d;
    if (f.y > f.land) (f.y = -2 - rnd() * 4), (f.x = rnd() * W);
    f.x = ((f.x % W) + W) % W;
  }
}

// The valley, the rocks, the lantern and the still water, kept until the light changes.
function backdrop(P) {
  P.key = round(P.k1 * 60);
  const g = P.k1, A = [0, 1, 2].map((c) => ramp(g, c)), top = [3, 4, 5].map((c) => ramp(g, c)), low = [6, 7, 8].map((c) => ramp(g, c));
  const lamp = ramp(g, 12), BG = P.bg, IL = P.il, Z = P.z;
  P.steamC = [9, 10, 11].map((c) => ramp(g, c));
  P.lamp = lamp;
  P.low = low;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 3, lm = P.lm[i];
      for (let c = 0; c < 3; c++) IL[o + c] = A[c] + LC[c] * lamp * lm;
      let col = null, k = 1, z = 0;
      const rg = P.rg[x];
      if (y >= rg) {
        // Snow on the slope, darker where scrub and rock break through.
        col = SNOW;
        k = 0.3 + 0.16 * vn(x * 0.12, y * 0.07) + 0.12 * (y / 66);
        if (vn(x * 0.45 + 3, y * 0.28) > 0.7) k *= 0.45;
      }
      for (const [tx, ty, th, f] of TREES) {
        // Tiers of drooping branches, each loaded with snow along its top.
        const dx = abs(x + 0.5 - tx), ts = 3.2 + 2.6 * f, yy = y - ty - dx * 0.5, kq = floor(yy / ts), wi = yy - kq * ts;
        if (yy < 0 || y > ty + th + 3) continue;
        if (y > ty + th) {
          if (dx < 0.4 + f) (col = TRUNK), (k = 0.6);
          continue;
        }
        if (dx >= 0.5 + (y - ty) * 0.34 * (0.68 + 0.32 * (wi / ts)) * (0.85 + 0.3 * hash(kq, tx | 0))) continue;
        if (wi < 1 + 0.6 * f && hash(x, y) > 0.12) (col = SNOW), (k = 0.4 + 0.32 * f - 0.1 * (dx / th));
        else (col = NEEDLE), (k = wi > ts - 0.7 ? 0.5 : 0.9 + 0.2 * hash(x + 7, y));
        if (f < 1) k = mix(k, 0.34, (1 - f) * 0.45);
      }
      if (y >= PB) (col = WATER), (z = 1), (k = 0.5 + 0.6 * ((y - PB) / 54));
      for (const [cx, cy, rx, ry, dz] of ROCKS) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, dd = nx * nx + ny * ny;
        if (dd > 1 || y + 0.5 > cy) continue;
        z = dz;
        const nz = sqrt(1 - dd);
        if (ny < -0.42 - 0.22 * nz + 0.25 * (vn(x * 0.6, cy) - 0.5)) (col = SNOW), (k = 0.5 + 0.28 * nz - 0.12 * ny);
        else (col = ROCK), (k = (0.6 + 0.5 * nz - 0.3 * nx) * (0.75 + 0.4 * vn(x * 0.5, y * 0.5)));
      }
      Z[i] = z;
      if (!col) {
        const v = (y / rg) ** 1.5;
        for (let c = 0; c < 3; c++) BG[o + c] = mix(top[c], low[c], v);
        continue;
      }
      for (let c = 0; c < 3; c++) BG[o + c] = col[c] * k * IL[o + c] + (z === 1 ? low[c] * 0.12 : 0);
    }
  // The stone lantern: finial, snowed roof, fire box with its glowing window,
  // pillar and foot, standing on the rim rock.
  const ROWS = [[42, 0.6, 1], [44, 3.6, 0], [46, 5, 1], [48, 2.6, 2], [54, 3.6, 1], [55, 1.3, 1], [60, 2.8, 1], [62, 0, 1]];
  for (let r = 0; r < ROWS.length - 1; r++)
    for (let y = ROWS[r][0]; y < ROWS[r + 1][0]; y++)
      for (let x = 0; x < 18; x++) {
        const dx = abs(x + 0.5 - LX), hw = ROWS[r][1] + (r === 2 ? y - 46 : 0) * 0.6, o = (y * W + x) * 3;
        if (dx > hw) continue;
        const kind = ROWS[r][2], win = kind === 2 && dx < 1.6 && y > 48 && y < 53;
        for (let c = 0; c < 3; c++)
          BG[o + c] = win ? [255, 200, 120][c] * min(1, 0.72 + 0.3 * lamp) : (kind ? STONE[c] * (0.6 + 0.25 * (LX - x) / hw) : SNOW[c] * 0.75) * IL[o + c];
      }
}

let F, IL, Z, M;
// An ellipse of fur or skin on the monkey being drawn, under its water line
// and behind any rock nearer than it.
function blob(cx, cy, rx, ry, col, sn, fur) {
  for (let y = max(0, floor(cy - ry)), y1 = min(H - 1, cy + ry); y <= y1 && y + 0.5 < M.wl; y++) {
    const ny = (y + 0.5 - cy) / ry;
    for (let x = max(0, floor(cx - rx)), x1 = min(W - 1, cx + rx); x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx, dd = nx * nx + ny * ny, i = y * W + x;
      if (dd > 1 || Z[i] > M.z) continue;
      const nz = sqrt(1 - dd);
      let k, c = col;
      if (fur) {
        k = (0.36 + 0.55 * nz - 0.25 * ny - 0.12 * nx) * (0.84 + 0.3 * hash(x - M.x0, y - M.y0));
        if (sn && ny < sn * 0.5 - 1.05 + 0.25 * hash(x - M.x0, 9)) (c = SNOW), (k = 0.75 + 0.25 * nz);
        else k *= 0.6 + 0.4 * sm(0.3, 2.2, M.wl - y - 0.5);
      } else k = 0.72 + 0.3 * nz - 0.15 * ny;
      paint(i, c, k);
    }
  }
}
function paint(i, c, k) {
  const o = i * 3;
  for (let n = 0; n < 3; n++) F[o + n] = c[n] * k * (IL[o + n] * 0.6 + 0.4);
}
function dot(x, y, c, k) {
  (x = floor(x)), (y = floor(y));
  if (x >= 0 && x < W && y >= 0 && y + 0.5 < M.wl && Z[y * W + x] <= M.z) paint(y * W + x, c, k);
}
// A limb of fur from a to b.
function rod(ax, ay, bx, by, r, col) {
  const dx = bx - ax, dy = by - ay, ll = dx * dx + dy * dy || 1;
  for (let y = max(0, floor(min(ay, by) - r)); y <= min(H - 1, max(ay, by) + r) && y + 0.5 < M.wl; y++)
    for (let x = max(0, floor(min(ax, bx) - r)); x <= min(W - 1, max(ax, bx) + r); x++) {
      const qx = x + 0.5 - ax, qy = y + 0.5 - ay, t = cl((qx * dx + qy * dy) / ll, 0, 1), ex = qx - dx * t, ey = qy - dy * t;
      if (ex * ex + ey * ey > r * r || Z[y * W + x] > M.z) continue;
      paint(y * W + x, col, (0.75 - 0.2 * (ey / r)) * (0.84 + 0.3 * hash(x, y)));
    }
}

// One macaque: x, bottom row, scale, water line, depth, the turn of its head
// (-1..1), how far it bows, eyes shut, snow on its head, sat on a rock.
function monkey(x, yb, s, wl, z, lk, bow, shut, sn, sat) {
  M = { wl, z, x0: floor(x), y0: floor(yb) };
  blob(x, yb - 6.6 * s, 6.8 * s, 6.6 * s, FUR, sat ? 0.3 : 0, 1);
  if (sat) {
    for (const sd of [-1, 1]) {
      blob(x + sd * 3.4 * s, yb - 2.6 * s, 2.7 * s, 2.3 * s, FUR, 0, 1);
      blob(x + sd * 4.2 * s, yb - 0.6 * s, 1.5 * s, 0.9 * s, HAND, 0, 0);
    }
    for (const sd of [-1, 1]) rod(x + sd * 5 * s, yb - 10 * s, x + sd * 1.4 * s, yb - 4.8 * s, 1.4 * s, FUR);
    blob(x, yb - 4.7 * s, 2 * s, 1 * s, HAND, 0, 0);
  }
  const R = 4.4 * s, hx = x + lk * 0.5 * s, hy = yb - (15.2 - bow) * s;
  for (const sd of [-1, 1]) blob(hx + sd * R * (1 - 0.2 * lk * sd), hy - 0.3 * s, 1.1 * s + 0.2, 1.3 * s + 0.2, EAR, 0, 0);
  blob(hx, hy, R * 1.05, R * 0.97, FUR, sn, 1);
  const fx = hx + lk * 1.4 * s, fy = hy + (0.9 + bow * 0.25) * s;
  blob(fx, fy, 2.2 * s * (1 - 0.2 * abs(lk)), 2.6 * s, FACE, 0, 0);
  for (const sd of [-1, 1]) dot(fx + sd * 0.95 * s, fy - 0.6 * s, shut > 0.5 ? FACE : EYE, shut > 0.5 ? 0.45 : 1);
  dot(fx, fy + 1.2 * s, FACE, 0.5);
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.init) return;
  if (P.key !== round(P.k1 * 60)) backdrop(P);
  (F = P.f), (IL = P.il), (Z = P.z);
  F.set(P.bg);
  const T = P.t, lamp = P.lamp, BG = P.bg;
  // The water: a slow shiver over it and the lantern's broken reflection.
  for (let y = PB; y < H; y++) {
    const sx = 0.7 * sin(y * 0.5 + T * 1.3), rx = LX + 1.4 * sin(y * 0.9 + T * 3), rk = lamp * 140 * sm(104, 70, y);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (Z[i] !== 1) continue;
      const r = vn(x * 0.3 + sx, y * 0.9 - T * 0.8), o = i * 3, dx = x + 0.5 - rx, ref = dx * dx < 30 && rk ? rk * r * exp((-dx * dx) / 5) : 0;
      for (let c = 0; c < 3; c++) F[o + c] = BG[o + c] * (0.75 + 0.55 * r) + ref * LC[c];
    }
  }
  // Who is where, back to front.
  const L = [];
  for (const m of P.mk) {
    if (m.p <= 0) continue;
    if (m.pose > 2) {
      // On the rim it slides down behind its rock as it goes.
      const yb = m.y + 20 * (1 - m.p) * m.s;
      m.hy = yb - 15.2 * m.s;
      L.push([65, () => monkey(m.x, yb, m.s, 999, 65, m.lk, 0, m.e, 0.6, 1)]);
      continue;
    }
    const wl = m.y + 0.35 * sin(T * 0.7 + m.ph), sk = m.sk + (m.pose === 1 ? 0.08 * sin(T * 0.5 + m.ph) : 0);
    const yb = wl + (9.5 + 3.4 * sk + 20 * (1 - m.p)) * m.s;
    m.hy = yb - (15.2 - (m.pose ? 1 : 0)) * m.s;
    L.push([m.y, () => monkey(m.x, yb, m.s, wl, m.y, m.lk, m.pose ? 1 : 0, m.e, m.pose === 1 ? 1 : 0.55, 0), m]);
  }
  const R = P.R, u = R.st === 0 ? 0 : R.st === 2 ? 1 : R.st === 1 ? R.t / 3 : 1 - R.t / 3.4;
  const [rx, ryb, rwl, rz] = path(u), rs = scl(rz);
  L.push([rz, () => monkey(rx, ryb, rs, rwl, rz, R.lk, 0, R.st === 2 ? 1 : 0, 0.7, rwl > 900), rwl < 900 && { x: rx, s: rs, p: 1, pose: 0, ph: 0 }]);
  const B = P.B, bs = 0.64;
  let bx, byb, bwl = 999, bz = 90;
  if (B.st === 0) [bx, byb] = BSEAT;
  else if (B.st === 1) {
    const q = B.t / 0.7;
    (bx = mix(BSEAT[0], BLAND[0], q)), (byb = mix(BSEAT[1], BLAND[1], q) - 14 * sin(PI * q)), (bz = mix(90, BLAND[1], q));
  } else if (B.st === 2) {
    const q = sm(0.8, 4.2, B.t);
    (bwl = mix(BLAND[1], BFOOT[1], q)), (bx = mix(BLAND[0], BFOOT[0], q)), (bz = bwl);
    byb = bwl + (12.5 + 14 * (1 - sm(0.15, 0.6, B.t))) * bs * scl(bwl);
  } else {
    const q = sm(0, 1.3, B.t);
    (bx = mix(BFOOT[0], BSEAT[0], q)), (byb = mix(BFOOT[1], BSEAT[1], q)), (bz = mix(94, 90, q));
  }
  L.push([bz, () => monkey(bx, byb, bs * scl(bz), bwl, bz, B.lk, 0, 0, 0.4, B.st !== 2), B.st === 2 && { x: bx, s: 0.6, p: 1, pose: 0, ph: 3 }]);
  L.sort((a, b) => a[0] - b[0]);
  // Rings on the water round everyone in it.
  for (const [z, , m] of L) {
    if (!m) continue;
    const s = m.s * m.p;
    for (let n = 0; n < 3; n++) {
      const r = 6.5 * s + ((T * (m.pose === 1 ? 1.6 : 3) + n * 4.4 + m.ph) % 13), a = (1 - (r - 6.5 * s) / 13) * 0.8 * m.p;
      for (let y = floor(z - r * 0.3 - 1); y <= z + r * 0.3 + 1; y++)
        for (let x = max(0, floor(m.x - r - 1)); x <= min(W - 1, m.x + r + 1); x++) {
          const i = y * W + x;
          if (y >= H || Z[i] !== 1) continue;
          const e = sqrt(((x + 0.5 - m.x) / r) ** 2 + ((y + 0.5 - z) / (r * 0.3)) ** 2);
          if (abs(e - 1) * r < 0.7) for (let c = 0; c < 3; c++) F[i * 3 + c] += (P.low[c] * 0.6 + 60 * IL[i * 3 + c]) * a;
        }
    }
  }
  for (const [, fn, m] of L) {
    fn();
    // The groomer's hands in the fur of the one in front of it.
    if (m && m.i === 0 && P.mk[1].p > 0.5) {
      const g = P.mk[1], gs = g.s, hx = m.x + 2 * m.s, hy = m.hy - 3 * m.s;
      M = { wl: g.y, z: m.y + 1, x0: 0, y0: 0 };
      rod(g.x - 4.8 * gs, g.y - 1.5 * gs, hx + 1.4 * sin(T * 3.1), hy + 0.8 * cos(T * 3.1), 1.3 * gs, FUR);
      rod(g.x - 2 * gs, g.y - 1.5 * gs, hx + 4 * m.s, hy + 5 * m.s + sin(T * 2.3), 1.3 * gs, FUR);
      M.wl = 999;
      blob(hx + 1.4 * sin(T * 3.1), hy + 0.8 * cos(T * 3.1), 1.2 * gs, 1 * gs, HAND, 0, 0);
    }
  }
  // The splash: a plume, foam spreading and fading, a ring running out, and
  // the drops falling back.
  M = { wl: 999, z: 200, x0: 0, y0: 0 };
  if (P.spl) {
    const q = P.spl.t, { x: sx, y: sy } = P.spl, h = 7 * (1 - sm(0, 0.45, q));
    if (h > 0.5) blob(sx, sy - h, 1.6 + 2 * q, h + 0.5, SNOW, 0, 0);
    for (let y = floor(sy - 3), rx = 3 + 6 * q, ry = 1.4 + 1.2 * q; y <= sy + 3 && q < 1.4; y++)
      for (let x = max(0, floor(sx - rx)); x <= min(W - 1, sx + rx); x++) {
        const e = 1 - ((x + 0.5 - sx) / rx) ** 2 - ((y + 0.5 - sy) / ry) ** 2, o = (y * W + x) * 3;
        if (e > 0) for (let c = 0; c < 3; c++) F[o + c] += (SNOW[c] * IL[o + c] * 1.2 - F[o + c]) * min(1, e * 3) * (1 - q / 1.4);
      }
    const r = 4 + 20 * q;
    for (let x = 0; x < W; x++)
      for (const sd of [-1, 1]) {
        const dx = (x + 0.5 - P.spl.x) / r, y = floor(P.spl.y + sd * r * 0.3 * sqrt(max(0, 1 - dx * dx)));
        if (abs(dx) < 1 && y < H && Z[y * W + x] === 1) for (let c = 0; c < 3; c++) F[(y * W + x) * 3 + c] += 120 * (1 - q / 2) * IL[(y * W + x) * 3 + c];
      }
  }
  for (const [x, y] of P.drops) dot(x, y, SNOW, 1);
  // The steam over everything, lit by the sky and the lantern.
  const G = P.G, SC = P.steamC;
  G.fill(0);
  for (const q of P.puffs) {
    const a = q.a * sm(0, 0.9, q.age) * (1 - sm(q.life * 0.5, q.life, q.age)), gx = q.x / 2, gy = q.y / 2, rr = q.r * 0.75;
    for (let j = max(0, floor(gy - rr * 1.3)); j <= min(GH - 1, gy + rr * 1.3); j++)
      for (let i = max(0, floor(gx - rr)); i <= min(GW - 1, gx + rr); i++) {
        const e = 1 - (i + 0.5 - gx) ** 2 / (rr * rr) - (j + 0.5 - gy) ** 2 / (rr * rr * 1.6);
        if (e > 0) G[j * GW + i] += a * e * e;
      }
  }
  // A low mist on the water, and the steam torn into wisps.
  for (let j = 0, c = 0; j < GH; j++)
    for (let i = 0, mist = 0.2 * sm(PB - 8, PB + 14, j * 2 + 1); i < GW; i++, c++)
      if ((G[c] += mist) > 0.01) G[c] *= 0.2 + 0.85 * vn(i * 0.24 + P.fx, j * 0.17 + P.fy) + 0.45 * vn(i * 0.62 - P.fx, j * 0.44 + P.fy * 2);
  for (let y = 0; y < H; y++) {
    const v = y / 2 - 0.25, j0 = cl(floor(v), 0, GH - 1), j1 = min(GH - 1, j0 + 1), fv = cl(v - j0, 0, 1), ay = 0.4 + 0.45 * sm(108, 56, y);
    for (let x = 0; x < W; x++) {
      const u2 = x / 2 - 0.25, i0 = cl(floor(u2), 0, GW - 1), i1 = min(GW - 1, i0 + 1), fu = cl(u2 - i0, 0, 1);
      const D = mix(mix(G[j0 * GW + i0], G[j0 * GW + i1], fu), mix(G[j1 * GW + i0], G[j1 * GW + i1], fu), fv);
      if (D < 0.05) continue;
      const a = ay * sm(0.05, 1.3, D), i = y * W + x, o = i * 3, lm = P.lm[i] * lamp * 200;
      for (let c = 0; c < 3; c++) F[o + c] += (SC[c] + LC[c] * lm - F[o + c]) * a;
    }
  }
  // Snow falling, thicker in the wind.
  const nf = floor(110 + 70 * abs(P.w));
  for (let n = 0; n < nf; n++) {
    const f = P.flakes[n], x = floor(f.x), y = floor(f.y);
    if (y < 0 || y >= H) continue;
    const i = y * W + x, o = i * 3, b = 0.45 + 0.5 * f.z;
    for (let c = 0; c < 3; c++) F[o + c] += (SNOW[c] * (IL[o + c] * 0.6 + 0.4) - F[o + c]) * b;
  }
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, F[o]) | 0, min(255, F[o + 1]) | 0, min(255, F[o + 2]) | 0);
}
