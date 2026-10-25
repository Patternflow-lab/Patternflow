// ===== Patternflow pattern =====
// Title:   Vampire Coffin
// Family:  halloween
// Idea:    An upright wooden coffin stands in a dim purple crypt under a moonlit lancet window, between two candles on iron stands and under cobwebbed vaulting, and every few seconds its lid creaks open a few degrees at a time on its hinge while cold green mist pours from the black crack and two red eyes peer out, then the lid swings wide towards us and a swarm of bats bursts out and wheels up through the vault and out of the top, the eyes blink and the lid slams shut, mist puffs from the seams, dust sifts down and the candle flames flatten in the draught and recover.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 46
// Round:   46
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Bats=24..72, Mist=0..1
//
// Knob 1: Hue. The mist and its light, with the eyes a third of the wheel behind; the candles, wood and stone keep their colours. At 0 toxic green mist and red eyes, at 0.25 sky-blue mist and lime eyes, at 0.5 magenta mist and cyan eyes, at 0.75 orange mist and violet eyes.
// Knob 2: Speed. The crypt's clock. At 2 an opening takes about 6.5 s: four creaks 0.6 to 0.75 s apart, the swing wide 0.45 s, the slam 2.7 s after it, and the bats all gone out of the top within about 4 s; the first burst comes at 1.3 s. At 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Bats. How many bats burst out each time: 24 at the start, 36 at a quarter, 48 at half, 72 at the end. One in three swings close past us as a big 13-LED bat; the far side of each turn is small and dark.
// Knob 4: Mist. How much mist pours while the lid is open, in puffs a second: 21 at 0, a thin stream that fades on the floor; 33 at 0.06 (the start); 46 at 0.25, a steady fall spreading both ways along the flagstones; 70 at 1, a glowing bank across the whole floor. Each burst adds a rush of 1.7 times as much for 1.2 s.
// Buttons: K1 tap swings the lid wide and lets the bats out at once.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vn = (x, sd) => {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return (hash(i * 7919 + sd) * (1 - u) + hash((i + 1) * 7919 + sd) * u) * 2 - 1;
};
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return out;
}
// Colour buffers, three floats an LED: set, blend towards, add.
const set = (C, p, r, g, b) => ((C[3 * p] = r), (C[3 * p + 1] = g), (C[3 * p + 2] = b));
const mix = (C, p, r, g, b, a) => ((C[3 * p] += (r - C[3 * p]) * a), (C[3 * p + 1] += (g - C[3 * p + 1]) * a), (C[3 * p + 2] += (b - C[3 * p + 2]) * a));
const add = (C, p, r, g, b, a) => ((C[3 * p] += r * a), (C[3 * p + 1] += g * a), (C[3 * p + 2] += b * a));

// The crypt: the floor starts at row 108. The coffin stands on it, a
// six-sided box from row 26 (head) through its shoulders at 46 to its foot
// at 106, centred on x = 32; hw gives its half width on a row.
const FLOOR = 108, CT = 26, CS = 46, CB = 106, CX = 32;
const hw = (y) => (y < CS ? 8 + (6 * (y - CT)) / (CS - CT) : 14 - (6 * (y - CS)) / (CB - CS));
// The lid hinges on the vertical line through the left shoulder, is 2.5
// LEDs thick, and comes towards a viewer 150 LEDs away at eye height 66.
const HX = CX - 14, THK = 2.5, VIEW = 150, VY = 66;
// The candles: flame x, the row the flame stands on, and which way it
// leans in the draught from the coffin.
const CANDLE = [[6, 53, -1], [58, 53, 1]];

// ---------- the still crypt, drawn once ----------
const BG = new Float32Array(N * 3), LIT = new Float32Array(N), HALO = [new Float32Array(N), new Float32Array(N)];
const put = (x, y, r, g, b, a) => x >= 0 && x < W && y >= 0 && y < H && mix(BG, y * W + x, r, g, b, a);
function line(x0, y0, x1, y1, r, g, b, a) {
  const n = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1;
  for (let i = 0; i <= n; i++) put(round(x0 + ((x1 - x0) * i) / n), round(y0 + ((y1 - y0) * i) / n), r, g, b, a);
}
// Inside the pointed arch of the vault (springing at row 44), and inside the
// lancet window above the coffin, grown by g.
const inVault = (x, y) => y >= 44 || ((x - 63.5) ** 2 + (y - 44) ** 2 <= 3969 && (x - 0.5) ** 2 + (y - 44) ** 2 <= 3969);
const inWindow = (x, y, g) => y <= 24 + g && x >= 24 - g && x <= 40 + g && (y >= 14 || ((x - 40 - g) ** 2 + (y - 14) ** 2 <= (16 + 2 * g) ** 2 && (x - 24 + g) ** 2 + (y - 14) ** 2 <= (16 + 2 * g) ** 2));
const ROWS = [108, 111, 115, 120, 126];
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const p = y * W + x, px = x + 0.5, py = y + 0.5;
    let r = 14, g = 8, b = 21, lit = 0.6;
    if (y >= FLOOR) {
      // Flagstones in perspective towards (32, 70).
      const k = ROWS.filter((v) => y >= v).length - 1, sc = (py - 70) / 38, u = (px - 32) / (11 * sc) + (k % 2) * 0.5;
      const v = ROWS.includes(y) || u - floor(u) < 0.09 / sc ? 0.45 : 0.8 + 0.25 * round(hash(k * 97 + floor(u) + 50) * 3) / 3;
      (r = 30 * v), (g = 22 * v), (b = 40 * v), (lit = 1);
    } else if (inVault(px, py)) {
      // Stone blocks, 7 rows high and 12 wide, every other course offset,
      // darker towards the vault; the arch's rib paler.
      const k = floor(y / 7), u = x + (k % 2) * 6;
      const v = (y % 7 === 0 || u % 12 === 0 ? 0.5 : 0.82 + 0.24 * round(hash(k * 131 + floor(u / 12)) * 3) / 3) * (0.62 + 0.38 * sm(0, 100, y));
      (r = 36 * v), (g = 23 * v), (b = 50 * v), (lit = 1);
      if (!inVault(px - 2, py - 2) || !inVault(px + 2, py - 2)) (r = 46), (g = 32), (b = 60);
    }
    if (y === FLOOR - 1) (r *= 0.5), (g *= 0.5), (b *= 0.5);
    // The window: night sky, the moon, a mullion and a ring of tracery, in
    // a frame of paler stone.
    if (inWindow(px, py, 1.5)) (r = 58), (g = 44), (b = 74);
    if (inWindow(px, py, 0)) {
      const md = sqrt((px - 36) ** 2 + (py - 10.5) ** 2), sky = 0.75 + 0.25 * sm(24, 2, py);
      (r = 44 * sky), (g = 40 * sky), (b = 92 * sky), (lit = 0);
      if (md < 4) (r = 205), (g = 196), (b = 225);
      else if (md < 6) (r += 30), (g += 28), (b += 36);
      if ((abs(px - 32) < 0.8 && py > 8.5) || abs(sqrt((px - 32) ** 2 + (py - 6) ** 2) - 2.6) < 0.7) (r = 30), (g = 22), (b = 40);
    }
    // Moonlight falling from the window down the wall, in two steps.
    if (y > 25 && y < 64 && abs(px - 33) < 9 + (py - 25) * 0.35) {
      const m = py < 44 ? 1 : 0.5;
      (r += 9 * m), (g += 8 * m), (b += 16 * m);
    }
    set(BG, p, r, g, b);
    LIT[p] = lit;
  }
// Cobwebs in both upper corners: radial threads with sagging cross threads.
for (const side of [0, 1]) {
  const X = (x) => (side ? 63 - x : x), A = [0.08, 0.42, 0.78, 1.1, 1.45], at = (r, a) => [X(round(r * cos(a))), round(r * sin(a))];
  for (const a of A) line(X(0), 0, ...at(24, a), 92, 86, 110, 0.55);
  for (const rr of [6, 11, 16, 21])
    for (let i = 0; i < 4; i++) {
      const m = at(rr * 0.86, (A[i] + A[i + 1]) / 2);
      line(...at(rr, A[i]), ...m, 92, 86, 110, 0.4);
      line(...m, ...at(rr, A[i + 1]), 92, 86, 110, 0.4);
    }
}
// The iron stands, and on each a pillar of wax 4 wide, lit from above,
// with drips down its side.
for (const [cx] of CANDLE) {
  const x0 = cx - 1;
  for (let y = 64; y < FLOOR + 2; y++) put(x0, y, 24, 22, 28, 1), put(x0 + 1, y, 44, 40, 50, 1);
  line(x0, FLOOR, x0 - 4, FLOOR + 5, 30, 28, 34, 1);
  line(x0 + 1, FLOOR, x0 + 5, FLOOR + 5, 30, 28, 34, 1);
  for (let x = cx - 4; x <= cx + 3; x++) put(x, 63, 40, 36, 44, 1), put(x, 64, 28, 26, 32, x > cx - 4 && x < cx + 3 ? 1 : 0);
  for (let y = 54; y < 63; y++)
    for (let x = cx - 2; x <= cx + 1; x++) {
      const v = (x === cx - 2 ? 0.75 : x === cx + 1 ? 0.62 : 0.9) * (1.05 - (y - 54) * 0.04);
      put(x, y, 200 * v, 178 * v, 140 * v, 1);
    }
  put(cx - 3, 56, 170, 150, 120, 1);
  put(cx - 3, 57, 150, 132, 104, 1);
  put(cx + 2, 55, 160, 140, 112, 1);
}
// The warm light each candle throws, in rings 3.5 LEDs apart.
const RING = [0.55, 0.42, 0.31, 0.22, 0.15, 0.09, 0.05];
CANDLE.forEach(([cx, cy], i) => {
  for (let p = 0; p < N; p++) HALO[i][p] = RING[floor(sqrt(((p % W) + 0.5 - cx) ** 2 + ((floor(p / W) + 2.5 - cy) * 0.8) ** 2) / 3.5)] || 0;
});

// Bats in three sizes, three wing poses each: up, level, down.
const SPR = [
  [["#.....#", ".#.#.#.", "..###..", "...#..."], ["..#.#..", "#######", "#..#..#", "......."], ["..#.#..", ".#####.", "#..#..#", "#.....#"]],
  [["#.......#", "##.#.#.##", ".#######.", "...###...", "....#...."], ["...#.#...", ".#######.", "#########", "#..###..#", "....#...."], ["...#.#...", "...###...", ".#######.", "##.###.##", "#...#...#"]],
  [
    ["##.........##", ".##..#.#..##.", "..##.###.##..", "...#######...", ".....###.....", "......#......"],
    [".....#.#.....", ".....###.....", ".###########.", "#############", "##...###...##", "#.....#.....#"],
    [".....#.#.....", ".....###.....", "....#####....", "..#########..", ".##..###..##.", "##....#....##"],
  ],
];
const MAXB = 72, MAXM = 360, DUST = 30;
const F32 = (n) => new Float32Array(n);

export function setup(params) {
  params.s = {
    t: 0, c: 0, hue: 0, speed: 2, bats: 24, mist: 0.06,
    // The lid: its angle in degrees and the move it is making.
    th: 0, seg: null, plan: null, draft: 0, shake: 0, eyes: 0, fl: [1, 1], fh: [6, 6], fx: [0, 0],
    bt: F32(MAXB).fill(-9), bp: F32(4 * MAXB), nb: 0,
    // Mist puffs: x, y, vx, vy, age, life; dust motes: x, y, age.
    m: F32(6 * MAXM), nm: 0, macc: 0, dust: F32(3 * DUST).fill(9),
    C: F32(3 * N), M: F32(N), GL: F32(N), K: new Uint8Array(N), mc: [0, 0, 0], ec: [0, 0, 0],
  };
}

// One opening: the lid creaks a few degrees at a time, the eyes come, it
// swings wide and the bats burst out, the eyes blink, it slams. The panel
// opens on a lid already creaking, the first burst at 1.3 s; from the third
// opening on, the coffin sometimes rests up to 2.5 s more.
const timesFrom = (P, b) => Object.assign(P, { burst: b, blink2: b + 2.2, slam: b + 2.7, end: b + 3.3 });
function plan(S) {
  const j = (a) => a + (Math.random() - 0.5) * 3, n = S.plan ? S.plan.n + 1 : 0;
  let P;
  if (!n) P = { creaks: [[0.2, j(16)], [0.7, j(34)]], eyes: 0.55, blink: 1, b: 1.3 };
  else {
    const t0 = 0.3 + Math.random() * 0.5 + (n > 1 && Math.random() < 0.5 ? 2.5 * Math.random() : 0);
    P = { creaks: [[t0, j(10)], [t0 + 0.6, j(21)], [t0 + 1.25, j(32)], [t0 + 2, j(44)]], eyes: t0 + 1.3, blink: t0 + 2.3, b: t0 + 2.7 };
  }
  S.plan = timesFrom(Object.assign(P, { n, k: 0, burstDone: false, slamDone: false }), P.b);
}

const backOut = (u) => 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2;
function lidAngle(S) {
  const g = S.seg;
  if (!g) return S.th;
  const u = cl((S.c - g.t0) / g.d, 0, 1);
  // A creak: quick, then slower, with a stick-slip judder.
  if (g.kind === 0) return g.a0 + (g.a1 - g.a0) * (1 - (1 - u) ** 3) + 0.9 * sin(u * PI * 6) * (1 - u);
  if (g.kind === 1) return g.a0 + (g.a1 - g.a0) * backOut(u);
  if (g.kind === 2) return g.a0 * (1 - u * u);
  return 3.5 * sin(PI * u);
}
const move = (S, d, a1, kind) => (S.seg = { t0: S.c, d, a0: S.th, a1, kind });

// A puff of mist; when the pool is full, a random old one is reused.
function puff(S, x, y, vx, vy) {
  const o = 6 * (S.nm < MAXM ? S.nm++ : floor(Math.random() * MAXM));
  S.m.set([x, y, vx, vy, 0, 3.5 + Math.random() * 2.5], o);
}

function burst(S) {
  const P = S.plan;
  P.burstDone = true;
  P.k = P.creaks.length;
  move(S, 0.45, 106, 1);
  S.draft = 1;
  // The swarm: each bat starts somewhere in the dark of the coffin, at its
  // own moment in the first 0.8 s, and wheels up round a rising centre.
  S.nb = min(MAXB, round(S.bats));
  for (let i = 0; i < S.nb; i++) {
    S.bt[i] = -(i / S.nb) * 0.7 - Math.random() * 0.1;
    S.bp.set([32 + (Math.random() - 0.5) * 14, 40 + Math.random() * 50, Math.random() * 2 * PI, (Math.random() < 0.8 ? 1 : -1) * (2.2 + Math.random() * 1.4)], 4 * i);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 24, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.bats = cl(k[2], 24, 72);
  S.mist = cl(k[3], 0, 1);
  if (!S.plan) plan(S);
  const ds = (d * S.speed) / 2, P = S.plan;
  S.t += ds;
  S.c += ds;
  if (input.btnPressed && input.btnPressed[0] && !P.burstDone) timesFrom(P, S.c), (P.eyes = min(P.eyes, S.c));
  // Each creak stirs the air: the flames duck and the coffin breathes out
  // a little mist.
  while (P.k < P.creaks.length && S.c >= P.creaks[P.k][0] && S.c < P.burst) {
    move(S, 0.3, P.creaks[P.k++][1], 0);
    S.draft = max(S.draft, 0.35);
    S.macc += 6;
  }
  if (!P.burstDone && S.c >= P.burst) burst(S);
  if (P.burstDone && !P.slamDone && S.c >= P.slam) (P.slamDone = true), move(S, 0.2, 0, 2);
  if (S.seg && S.seg.kind === 2 && S.c >= S.seg.t0 + S.seg.d) {
    // The slam lands: the coffin shudders, the lid bounces once, the
    // flames flatten again, mist squeezes out of the seams and dust is
    // shaken down from the vault.
    move(S, 0.3, 0, 3);
    S.shake = 1;
    S.draft = max(S.draft, 0.7);
    for (let i = 0; i < 26; i++) {
      const y = CT + 4 + Math.random() * (CB - CT - 4), sd = i % 2 ? 1 : -1;
      puff(S, CX + sd * hw(y), y, sd * (6 + Math.random() * 8), Math.random() * 2);
    }
    for (let i = 0; i < DUST; i++) S.dust.set([Math.random() * W, Math.random() * 26, -Math.random() * 0.6], 3 * i);
  }
  S.th = lidAngle(S);
  if (S.c >= P.end) (S.c = 0), plan(S);
  // The eyes: fade in after the third creak, blink twice, gone at the slam.
  const blink = (t) => S.c > t && S.c < t + 0.16;
  S.eyes = S.c < P.eyes || P.slamDone ? 0 : sm(P.eyes, P.eyes + 0.45, S.c) * (blink(P.blink) || blink(P.blink2) ? 0 : 1);
  S.draft *= exp(-ds * 1.3);
  S.shake *= exp(-ds * 9);
  // The flames: two noises each, flattened and pushed outwards by the draught.
  for (let i = 0; i < 2; i++) {
    const n1 = vn(S.t * 4.3, 11 + i * 5), n2 = vn(S.t * 11, 23 + i * 7), dr = S.draft;
    S.fh[i] = 7 + 1.3 * n1 + 0.6 * n2 - 4 * dr;
    S.fx[i] = 0.7 * vn(S.t * 2.2, 41 + i) + CANDLE[i][2] * dr * (3.5 + 0.8 * sin(S.t * 13));
    S.fl[i] = 0.82 + 0.16 * n1 + 0.1 * n2 - 0.45 * dr;
  }
  for (let i = 0; i < S.nb; i++) if (S.bt[i] > -5) S.bt[i] += ds;
  // Mist: poured from the gap while the lid is open, a wisp now and then
  // through the seams when it is shut.
  const ca = cos((min(S.th, 90) * PI) / 180), open = sm(0, 0.3, sqrt(1 - ca * ca));
  const amount = 0.3 + 0.7 * sqrt(S.mist), surge = P.burstDone && S.c < P.burst + 1.2 ? 1 : 0;
  S.macc += ds * amount * (70 * open + 120 * surge + 3);
  const gapL = HX + 28 * ca;
  for (; S.macc >= 1; S.macc--) {
    const x = S.th > 50 ? CX + (Math.random() - 0.5) * 16 : min(gapL + Math.random() * (CX + 14 - gapL), CX + 10);
    puff(S, x, open > 0.05 ? 70 + Math.random() * 34 : CB - 1, (Math.random() - 0.3) * 4, 3 + Math.random() * 6);
  }
  const D = S.dust;
  for (let i = 0; i < DUST; i++)
    if (D[3 * i + 2] < 3) (D[3 * i + 2] += ds), (D[3 * i + 1] += ds * (7 + (i % 4))), (D[3 * i] += ds * 3 * sin(S.t * 2 + i));
  const m = S.m;
  for (let i = 0; i < S.nm; i++) {
    const o = 6 * i;
    if (m[o + 4] >= m[o + 5]) continue;
    m[o + 4] += ds;
    if (m[o + 1] < FLOOR + 2 + (i % 9)) {
      // Cold mist sinks down the coffin's front.
      m[o + 3] = min(16, m[o + 3] + 20 * ds);
    } else {
      // On the floor it spreads outwards and lifts a little as it thins.
      m[o + 3] += (-1.5 - m[o + 3]) * min(1, 4 * ds);
      m[o + 2] += ((m[o] < CX ? -1 : 1) * (7 + (i % 5) * 2.5) - m[o + 2]) * min(1, 1.5 * ds);
    }
    m[o] += (m[o + 2] + 2.4 * vn(S.t * 1.3 + i, 77)) * ds;
    m[o + 1] += m[o + 3] * ds;
  }
}

// Where the lid face at offset off (0 front, THK back) meets the LED, in
// the lid's own closed coordinates, or null.
function lidHit(px, py, off, c, s) {
  const u = (px - HX - off * s) / (abs(c) < 0.03 ? (c < 0 ? -0.03 : 0.03) : c);
  if (u < 0 || u > 29) return null;
  const y = VY + ((py - VY) * (VIEW - (u * s - off * c))) / VIEW, x = HX + u;
  return y < CT || y > CB || abs(x - CX) > hw(y) ? null : [x, y];
}
// Distance inside the coffin's outline.
const inset = (x, y) => min(hw(y) - abs(x - CX), y - CT, CB - y);
// Buttoned satin, on a diamond grid 4 LEDs across, times v.
function satin(x, y, v) {
  const a = (x + y) / 4, b = (x - y) / 4, fa = a - floor(a) - 0.5, fb = b - floor(b) - 0.5;
  v *= fa * fa + fb * fb < 0.03 ? 0.45 : abs(fa) + abs(fb) < 0.3 ? 1.05 : 0.75;
  return [84 * v, 10 * v, 30 * v];
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const C = S.C, M = S.M, GL = S.GL, K = S.K, MC = hsv(0.33 + S.hue, 0.62, 1, S.mc), EC = hsv(S.hue, 0.9, 1, S.ec);
  C.set(BG);
  K.fill(0);
  const th = (S.th * PI) / 180, c = cos(th), s = sin(th), sx = round(S.shake * 1.4 * sin(S.t * 70));
  const open = sm(0, 0.4, sin(min(th, PI / 2))), shade = 0.2 + 0.8 * sm(45, 95, S.th);
  // The coffin's box: its right side, then the inside, which only shows
  // where the lid is not. Barely open, the lid keeps the inside in shadow,
  // a black crack.
  for (let y = CT; y < CB; y++)
    for (let x = 14; x < 50; x++) {
      const p = y * W + x, px = x + 0.5 - sx, py = y + 0.5, e = hw(py), dx = px - CX;
      if (dx > e && dx < e + 2.2) {
        const v = py < CT + 1.5 ? 1.4 : 1;
        set(C, p, 36 * v, 17 * v, 15 * v);
        K[p] = 1;
      } else if (abs(dx) <= e) {
        const d = inset(px, py), gl = open * 0.3 * sm(50, CB, py);
        K[p] = 2;
        if (d < 1) set(C, p, 60 * shade, 28 * shade, 22 * shade);
        else if (d < 3.4) set(C, p, ...satin(px, py, shade));
        // The black inside, with the mist's glow rising from the bottom.
        else set(C, p, 4 + MC[0] * gl, 2 + MC[1] * gl, 6 + MC[2] * gl);
      }
    }
  // The eyes, at head height in the dark: peering out of the gap while it
  // is narrow, in the middle once the lid is wide.
  if (S.eyes > 0.01) {
    const e = CX + hw(37), mid = max(CX, (HX + (e - HX) * c + e) / 2 - 0.5), ex = CX + (mid - CX) * (1 - sm(35, 70, S.th));
    for (const ox of [-1.5, 1.5])
      for (let yy = -2; yy <= 2; yy++)
        for (let xx = -2; xx <= 2; xx++) {
          const p = (37 + yy) * W + floor(ex + ox + sx) + xx;
          if (K[p] === 2) mix(C, p, EC[0], EC[1] * 0.6, EC[2] * 0.6, (xx || yy ? 0.4 / (xx * xx + yy * yy + 0.5) : 1) * S.eyes);
        }
  }
  // The lid, swung th about its hinge: the face towards us (wood in front,
  // satin behind), and the slab's edge where only the other face reaches.
  const front = c >= 0;
  for (let y = CT - 10; y <= CB + 10; y++)
    for (let x = front ? HX - 2 : 6; x < 50; x++) {
      const p = y * W + x, px = x + 0.5 - sx, py = y + 0.5, h = lidHit(px, py, front ? 0 : THK, c, s);
      if (h) {
        const [lx, ly] = h, d = inset(lx, ly);
        if (front) {
          // Planks running the length of the lid, a carved moulding 3 in
          // from the edge, two iron hinge straps and a ring; it darkens as
          // it turns from the light.
          const sh = 0.6 + 0.4 * c, v = (d > 2.5 && d < 3.5 ? 1.35 : d >= 3.5 && d < 4.5 ? 0.6 : 0.85 + 0.2 * round(hash(floor(lx) * 31 + floor(ly / 13)) * 2) / 2) * sh;
          if (lx - (CX - hw(ly)) < 3.5 && lx - HX < 4 && ((ly > 36 && ly < 39) || (ly > 92 && ly < 95))) set(C, p, 46 * sh, 44 * sh, 54 * sh);
          else if (abs(lx - (CX + hw(ly) - 3)) < 1 && abs(ly - 68) < 1.5) set(C, p, 56 * sh, 52 * sh, 62 * sh);
          else set(C, p, 76 * v, 37 * v, 29 * v);
        } else {
          const sh = 0.55 - 0.45 * c;
          if (d < 1.6) set(C, p, 50 * sh, 24 * sh, 20 * sh);
          else set(C, p, ...satin(lx, ly, sh));
        }
      } else if (lidHit(px, py, front ? THK : 0, c, s)) set(C, p, 92, 50, 36);
      else continue;
      K[p] = 1;
    }
  // Candlelight on everything but the dark inside of the coffin.
  for (let p = 0; p < N; p++) {
    const l = (HALO[0][p] * S.fl[0] + HALO[1][p] * S.fl[1]) * (K[p] === 2 ? 0.1 : K[p] === 1 ? 0.8 : LIT[p]);
    if (l > 0) add(C, p, 255, 120, 40, l);
  }
  // Mist: each puff a soft disc that grows as it ages and flattens into a
  // low bank on the floor, and throws its light twice as far as it reaches.
  M.fill(0);
  GL.fill(0);
  const m = S.m;
  for (let i = 0; i < S.nm; i++) {
    const o = 6 * i, a = m[o + 4], L = m[o + 5], mx = m[o], my = m[o + 1];
    if (a >= L) continue;
    const al = sm(0, 0.4, a) * (1 - sm(L * 0.55, L, a)) * 0.19, r = 2.5 + 6 * (a / L), fl = my > FLOOR ? 0.55 : 1, rx = r * (2 - fl), ry = r * fl;
    for (let y = max(0, floor(my - 2 * ry)); y <= min(H - 1, floor(my + 2 * ry)); y++)
      for (let x = max(0, floor(mx - 2 * rx)); x <= min(W - 1, floor(mx + 2 * rx)); x++) {
        const dd = ((x + 0.5 - mx) / rx) ** 2 + ((y + 0.5 - my) / ry) ** 2;
        if (dd < 4) GL[y * W + x] += al * (1 - dd / 4);
        if (dd < 1) M[y * W + x] += al * (1 - dd);
      }
  }
  // The light where puffs crowd, in three steps; the mist itself as light
  // in six: thin mist tints what is behind it, thick mist glows pale.
  for (let p = 0; p < N; p++) {
    const q = min(5, floor(M[p] * 6)) / 5, w = max(0, q - 0.6) * 200;
    add(C, p, MC[0], MC[1], MC[2], min(3, floor(GL[p] * 6)) * 0.06);
    if (M[p] >= 0.04) add(C, p, MC[0] + w, MC[1] + w, MC[2] + w, 0.1 + 0.5 * q);
  }
  // Bats, wheeling up round a rising centre and out of the top. The far
  // side of each turn is drawn small and dark purple, the near side black
  // with moonlight on the top edge of its wings; one bat in three swings
  // close past us there.
  const bats = [];
  for (let i = 0; i < S.nb; i++) {
    const t = S.bt[i], o = 4 * i;
    if (t < 0) continue;
    const rad = (10 + (i % 7) * 2.6) * (1 - exp(-t / 0.45)), a = S.bp[o + 2] + S.bp[o + 3] * t;
    const x = CX + 4 * sin(0.7 * t + i) + rad * sin(a) + 1.5 * vn(t * 3 + i * 7, 5), y = S.bp[o + 1] - (12 * t + 6 * t * t) + rad * 0.35 * cos(a) + 1.2 * vn(t * 3 + i * 7, 9);
    if (y < -10) S.bt[i] = -9;
    else bats.push([x, y, cos(a) < -0.2 ? 0 : i % 3 === 0 && cos(a) > 0.5 ? 2 : 1, floor((t * (7 + (i % 3)) + i * 0.3) * 4) % 4]);
  }
  const blit = (bt) => {
    const spr = SPR[bt[2]][[0, 1, 2, 1][bt[3]]], h = spr.length, w = spr[0].length, x0 = round(bt[0] - w / 2), y0 = round(bt[1] - h / 2);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const x = x0 + i, y = y0 + j;
        if (spr[j][i] !== "#" || x < 0 || x >= W || y < 0 || y >= H) continue;
        if (!bt[2]) set(C, y * W + x, 26, 14, 36);
        else if (!j || spr[j - 1][i] !== "#") set(C, y * W + x, 84, 68, 104);
        else set(C, y * W + x, 6, 3, 10);
      }
  };
  const D = S.dust;
  for (let i = 0; i < DUST; i++) {
    const a = D[3 * i + 2], x = floor(D[3 * i]), y = floor(D[3 * i + 1]);
    if (a >= 0 && a < 3 && x >= 0 && x < W && y < H) mix(C, y * W + x, 150, 140, 160, 0.55 * (1 - a / 3));
  }
  for (const b of bats) if (!b[2]) blit(b);
  // Flames: teardrops with a white core, leaning in the draught.
  for (let i = 0; i < 2; i++) {
    const [fx, fy] = CANDLE[i], h = max(1.5, S.fh[i]), L = S.fx[i], f = S.fl[i];
    for (let y = floor(fy - h - 1); y <= fy + 1; y++)
      for (let x = fx - 6; x <= fx + 5; x++) {
        const t = (fy - y) / h, wv = 2.74 * sqrt(max(0, (t + 0.25) * (1 - t))), dx = abs(x + 0.5 - fx - L * t * t);
        if (t < -0.25 || t > 1 || dx > wv) continue;
        const col = t < 0.55 && dx < 0.5 * wv ? [255, 240, 200] : t > 0.7 ? [235, 105, 30] : [255, 175, 60];
        set(C, y * W + x, col[0] * f + 30, col[1] * f + 10, col[2] * f);
      }
  }
  for (const b of bats) if (b[2]) blit(b);
  // Channels go out in steps of 6, which the eye does not see on the panel
  // and which keeps the soft light from turning into noise.
  const q6 = (v) => min(255, round(v / 6) * 6);
  for (let p = 0; p < N; p++) display.setPixel(p % W, floor(p / W), q6(C[3 * p]), q6(C[3 * p + 1]), q6(C[3 * p + 2]));
}
