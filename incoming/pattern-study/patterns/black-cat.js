// ===== Patternflow pattern =====
// Title:   Black Cat
// Family:  halloween
// Idea:    A big black cat sits in profile on a garden wall against a low harvest moon, its tail swishing in slow S-curves, its ears twitching and its glowing eyes blinking and looking round, and now and then it arches its back, its fur bristling and its mouth open in a hiss, before it settles again.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 44
// Round:   44
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Mood=0..1, Startle=0..1
//
// Knob 1: Hue. The moon and the light it throws round the cat's edges, with the eyes in the colour opposite. At 0 a harvest orange moon and toxic green eyes; at 0.25 a green moon and violet eyes, at 0.5 a cold blue moon and amber eyes, at 0.75 a purple moon.
// Knob 2: Speed. The cat's clock. At 2 the tail swings through one S-curve in 2.6 seconds and the cat blinks every 2 to 5 seconds; at 0.2 everything is ten times slower, at 3 half as fast again.
// Knob 3: Mood. At 0 the cat is watchful: the tail swishes 0.35 rad a joint, the ears stand up, the pupils are wide. At 1 it is furious: the tail lashes 1.7 times as fast and wide, the ears are laid back, the pupils are slits and the fur along its back stands up.
// Knob 4: Startle. How often it arches and hisses. At 0.06 the first arch comes at 3.3 s and the next 11.5 s after the last; at 1 the first is at 0.5 s and one follows another every 3 s.
// Buttons: K4 tap startles it into an arch at once.

const W = 64, H = 128, N = W * H, WALL = 102;
const { floor, round, min, max, abs, sqrt, sin, cos, atan2, exp, PI } = Math;
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
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// Signed distances in LEDs: negative inside.
const circle = (px, py, cx, cy, r) => sqrt((px - cx) ** 2 + (py - cy) ** 2) - r;
function capsule(px, py, ax, ay, bx, by, ra, rb) {
  const ex = bx - ax, ey = by - ay, qx = px - ax, qy = py - ay, u = cl((qx * ex + qy * ey) / (ex * ex + ey * ey || 1), 0, 1);
  return sqrt((qx - u * ex) ** 2 + (qy - u * ey) ** 2) - (ra + (rb - ra) * u);
}
function tri(px, py, v) {
  let dd = 1e9, s = 1;
  for (let i = 0, j = 4; i < 6; j = i, i += 2) {
    const ex = v[j] - v[i], ey = v[j + 1] - v[i + 1], wx = px - v[i], wy = py - v[i + 1];
    const u = cl((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1), bx = wx - ex * u, by = wy - ey * u;
    dd = min(dd, bx * bx + by * by);
    const c1 = py >= v[i + 1], c2 = py < v[j + 1], c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * sqrt(dd);
}
// Smooth union, so the parts of the cat grow into one another.
const smin = (a, b, k) => {
  const h = cl(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
};

// The moon: centre and radius, and its seas in three tones.
const MX = 43, MY = 47, MR = 26;
const SEAS = [[-9, -9, 7, 5], [6, -12, 6, 4], [11, 2, 6, 7], [-12, 6, 5, 7], [2, 12, 7, 4]];
const MOONT = new Float32Array(N);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const dx = x + 0.5 - MX, dy = y + 0.5 - MY, r = sqrt(dx * dx + dy * dy);
    if (r > MR + 1) continue;
    let e = 9;
    for (const [cx, cy, rx, ry] of SEAS) e = min(e, ((dx - cx) / rx) ** 2 + ((dy - cy) / ry) ** 2);
    MOONT[y * W + x] = (e < 1 ? 0.8 : e < 1.6 ? 0.9 : 1) * cl(MR + 0.5 - r, 0, 1);
  }
// Sky by row, in eight steps: near black at the top, a purple band over the wall.
const SKY = new Float32Array(H * 3);
for (let y = 0; y < H; y++) {
  const t = round(8 * sm(10, WALL, y)) / 8;
  SKY[3 * y] = 0.02 + 0.17 * t;
  SKY[3 * y + 1] = 0.008 + 0.05 * t;
  SKY[3 * y + 2] = 0.05 + 0.22 * t;
}
// Stars, as each LED's twinkle phase (or -1); and the moon's glow by LED.
const STAR = new Float32Array(N).fill(-1), GLOW = new Float32Array(N);
for (let i = 0, n = 0; n < 16 && i < 400; i++) {
  const x = floor(hash(i * 3 + 11) * W), y = floor(hash(i * 3 + 12) * 92);
  if ((x + 0.5 - MX) ** 2 + (y + 0.5 - MY) ** 2 < (MR + 6) ** 2) continue;
  STAR[y * W + x] = hash(i * 3 + 13) * 6.28;
  n++;
}
for (let p = 0; p < N; p++) {
  const out = max(0, sqrt(((p % W) + 0.5 - MX) ** 2 + (floor(p / W) + 0.5 - MY) ** 2) - MR);
  GLOW[p] = round((0.22 * exp(-out / 5) + 0.08 * exp(-out / 16)) * 16) / 16;
}

// A jack-o'-lantern on the wall by the cat's front paws, as pixel art:
// s stem, o skin, f the carved face lit from inside.
const PUMPKIN = [
  "........ss.......",
  ".......ss........",
  "....ooooooooo....",
  "..ooooooooooooo..",
  ".ooooooooooooooo.",
  ".oooofooooofoooo.",
  "ooooffoooooffoooo",
  "oooffffooofffffoo",
  "oooooooofoooooooo",
  "oofoooooooooooofo",
  "ooffffofffoffffoo",
  ".oofffffffffffoo.",
  "..ooooffffoooo...",
  "....ooooooooo....",
];
const FLAME = [1, 0.5, 0.08];
const PX0 = 0, PY0 = WALL - PUMPKIN.length, PCX = 8.5, PCY = WALL - 7;
// How far its light reaches each LED, before the flame's flicker.
const WARM = new Float32Array(N);
for (let p = 0; p < N; p++) WARM[p] = 0.5 * exp(-sqrt(((p % W) + 0.5 - PCX) ** 2 + ((floor(p / W) + 0.5 - PCY) * 1.3) ** 2) / 9);
const vn = (x, sd) => {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return (hash(i * 7919 + sd) * (1 - u) + hash((i + 1) * 7919 + sd) * u) * 2 - 1;
};

// Bats flitting round the moon, behind the cat: each loops on its own
// figure of eight [centre x, centre y, half width, half height, rate x,
// rate y, phase], with a jitter on top, and flaps about 4.5 times a second.
const BATS = [[50, 32, 11, 10, 0.53, 0.97, 0], [44, 19, 16, 7, 0.41, 0.83, 2.1], [54, 58, 7, 12, 0.67, 0.59, 4.2]];
const batAt = (b, t) => [b[0] + b[2] * sin(b[4] * t + b[6]) + 1.5 * vn(t * 1.7, b[6] * 9), b[1] + b[3] * sin(b[5] * t + b[6] * 1.3) + 1.5 * vn(t * 1.9, b[6] * 9 + 3)];
function batDist(px, py, bx, by, dir, flap) {
  const x = (px - bx) * dir, y = py - by, ax = abs(x), tip = -1.2 + 3.2 * flap;
  let d = sqrt((x / 1.2) ** 2 + (y / 1.7) ** 2) - 1;
  d = min(d, tri(ax, y, [0.6, -0.9, 0.6, 0.7, 5.6, tip]));
  d = min(d, tri(ax, y, [0.6, 0.4, 3.4, 0.6 + 1.6 * flap, 5.6, tip]));
  d = min(d, tri(x, y, [-0.9, -1.2, 0.1, -1.4, -0.6, -2.6]));
  return min(d, tri(x, y, [0.9, -1.2, -0.1, -1.4, 0.6, -2.6]));
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, mood: 0, startle: 0.06, t: 0, begun: false, fl: 0.72,
    // The arch: its age (-1 when none), the wait for the next.
    arch: -1, wait: 3.3,
    // Eyes: blink clock, look target and where they look now; ear twitches.
    blink: 1.5, blinkAge: 9, look: 0, lookTo: 0.6, lookWait: 1.2, tilt: 0,
    ear: [0, 0], earWait: [2.5, 4], earAge: [9, 9], lash: 9, lashWait: 0.8,
    tail: new Float32Array(2 * 15), cat: new Float32Array(N), blk: new Uint8Array(16 * 32), tb: [0, 0, 0, 0], flap: 0, bats: BATS.map(() => [0, 0, 1]),
    c: [0, 0, 0], e: [0, 0, 0],
  };
}

// How far the cat is arched at an arch's age: up in 0.35 s, held 1.6 s, down in 1.2 s.
const archOf = (a) => (a < 0 ? 0 : a < 0.35 ? sm(0, 0.35, a) : a < 1.95 ? 1 : 1 - sm(1.95, 3.15, a));

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.mood = cl(k[2], 0, 1);
  S.startle = cl(k[3], 0, 1);
  if (!S.begun) {
    S.wait = 3.3 - 2.8 * S.startle;
    S.begun = true;
  }
  const ds = (d * S.speed) / 2;
  S.t += ds;
  // The candle in the pumpkin: two noises, about 3 and 9 times a second.
  S.fl = 0.72 + 0.17 * vn(S.t * 2.8, 5) + 0.11 * vn(S.t * 9, 11);
  if (input.btnPressed && input.btnPressed[3] && S.arch < 0) S.arch = 0;
  if (S.arch >= 0) {
    S.arch += ds;
    if (S.arch > 3.15) {
      S.arch = -1;
      S.wait = 12 - 9 * S.startle;
    }
  } else {
    S.wait -= ds;
    if (S.wait <= 0) S.arch = 0;
  }
  // The bats, and which way each is flying.
  S.flap += ds * 2 * PI * 4.5;
  BATS.forEach((b, i) => {
    const [x, y] = batAt(b, S.t * 1.6), [x2] = batAt(b, S.t * 1.6 + 0.05);
    S.bats[i] = [x, y, x2 >= x ? 1 : -1];
  });
  // Blinks every 2 to 5 s, each 0.18 s shut.
  S.blink -= ds;
  S.blinkAge += ds;
  if (S.blink <= 0) {
    S.blinkAge = 0;
    S.blink = 2 + 3 * Math.random();
  }
  // The eyes pick somewhere new to look every 1 to 3 s and get there in about 0.3 s; the head follows a little.
  S.lookWait -= ds;
  if (S.lookWait <= 0) {
    S.lookTo = Math.random() * 2 - 1;
    S.lookWait = 1 + 2 * Math.random();
  }
  S.look += (S.lookTo - S.look) * min(1, ds * 10);
  // The head follows the nearest bat up and down.
  let near = 1e9, aim = 0;
  for (const [bx, by] of S.bats) {
    const dd = (bx - 20) ** 2 + (by - 40) ** 2;
    if (dd < near) (near = dd), (aim = cl((by - 40) / 25, -1, 1));
  }
  S.tilt += (-0.3 * aim + 0.06 * S.lookTo - S.tilt) * min(1, ds * 4);
  // Now and then the tail lashes: it whips out straight in a quarter of a
  // second and curls back over a second. Every 2.5 to 4.5 s when watchful,
  // more than twice as often when cross.
  S.lash += ds;
  S.lashWait -= ds * (1 + 1.4 * S.mood);
  if (S.lashWait <= 0 && S.arch < 0) {
    S.lash = 0;
    S.lashWait = 1.6 + 1.6 * Math.random();
  }
  // Each ear flicks back now and then, quicker and more often when cross.
  for (let i = 0; i < 2; i++) {
    S.earWait[i] -= ds * (1 + S.mood);
    S.earAge[i] += ds;
    if (S.earWait[i] <= 0) {
      S.earAge[i] = 0;
      S.earWait[i] = 1.5 + 3 * Math.random();
    }
  }
}

// The cat, built from its pose: arch a, mood m, the head's tilt and the ears.
function pose(S) {
  const a = archOf(S.arch), m = S.mood, t = S.t;
  // The tail: fifteen joints from the root behind the haunch. It rises,
  // then curls forward over the back like a question mark; the whole curl
  // swings to and fro while a wave runs out to the tip. Arched, it stands
  // straight up from the raised haunch and puffs.
  const amp = (0.3 + 0.22 * m) * (1 - 0.7 * a), w = (2 * PI) / (2.6 / (1 + 0.7 * m));
  const swing = (0.38 + 0.25 * m) * sin(w * 0.5 * t), la = S.lash;
  const lash = la < 0.25 ? sm(0, 0.25, la) : 1 - sm(0.25, 1.3, la);
  let x = 48 - 2 * a, y = WALL - 6 - 26 * a, head = 0;
  const T = S.tail;
  for (let i = 0; i < 15; i++) {
    const u = i / 14;
    const calm = -0.8 + swing * (1 - 0.4 * u) - 0.8 * sm(0, 0.35, u) - 1.1 * sm(0.45, 1, u) + amp * sin(w * t - 0.6 * i) * (0.25 + 0.75 * u);
    const up = -1.5 - 0.15 * u + 0.08 * sin(w * 2 * t - 0.4 * i);
    head = calm + (up - calm) * max(a, 0.85 * lash);
    T[2 * i] = x;
    T[2 * i + 1] = y;
    x += cos(head) * 3.4;
    y += sin(head) * 3.4;
  }
  // The tail's box, with room for its fur.
  const tb = S.tb;
  tb[0] = tb[1] = 1e9;
  tb[2] = tb[3] = -1e9;
  for (let i = 0; i < 15; i++) {
    tb[0] = min(tb[0], T[2 * i] - 8);
    tb[1] = min(tb[1], T[2 * i + 1] - 8);
    tb[2] = max(tb[2], T[2 * i] + 8);
    tb[3] = max(tb[3], T[2 * i + 1] + 8);
  }
  return a;
}

// Fur standing up: a row of teeth every 2.4 LEDs along a coordinate.
const teeth = (v) => max(0, 1 - 3 * abs(v / 2.4 - floor(v / 2.4) - 0.5));

// The cat is drawn 1.1 times the size it is laid out at, standing on the
// wall, its middle (38 as laid out) at x = 35.
const SC = 1.1, AX = 35;
const ARC = [];
for (let k = 0; k <= 6; k++) {
  const th = PI + 0.25 + (k * (PI - 0.5)) / 6;
  ARC.push([34 + 14 * cos(th), 82 + 24 * sin(th), 7.5 - 1.5 * sin((k * PI) / 6)]);
}
function catDist(S, sx, sy, a) {
  const px = 38 + (sx - AX) / SC, py = WALL + (sy - WALL) / SC;
  const m = S.mood, hiss = sm(0.3, 0.8, a) * (S.arch >= 0 ? 0.6 + 0.4 * sin(S.arch * 14) : 0);
  let d = 1e9;
  // A cross cat leans forward over its front paws, about the root of its
  // tail: the sitting body and the head are drawn turned by up to 0.12 rad.
  const ln = -0.12 * m * (1 - a), lc = cos(ln), ls = sin(ln);
  const lx = 40 + lc * (px - 40) + ls * (py - 100), ly = 100 - ls * (px - 40) + lc * (py - 100);
  // Sitting: haunch, back and chest from the wall up to the neck, the front
  // legs and the paws.
  if (a < 1) {
    const px = lx, py = ly;
    let ds = circle(px, py, 38, WALL - 14, 14);
    ds = smin(ds, capsule(px, py, 37, WALL - 16, 27, 63, 13, 9), 2);
    ds = smin(ds, circle(px, py, 25, 74, 9), 3);
    ds = min(ds, capsule(px, py, 22, 76, 21, WALL - 1, 3.4, 2.6));
    ds = min(ds, capsule(px, py, 27.5, 78, 27, WALL - 1, 3, 2.4));
    ds = min(ds, capsule(px, py, 17.5, WALL - 1, 23, WALL - 1, 1.8, 1.8));
    ds = min(ds, capsule(px, py, 31, WALL - 1.5, 44, WALL - 1.5, 2.2, 2.2));
    // A cross cat's fur rises along its back.
    if (m > 0) ds -= 1.4 * m * sm(36, 44, px) * sm(96, 80, py) * teeth(py);
    d = ds;
  }
  // Arched: up on straight legs, the back bowed high, the fur on end.
  if (a > 0) {
    let da = 1e9;
    for (let k = 0; k < 6; k++) da = min(da, capsule(px, py, ARC[k][0], ARC[k][1], ARC[k + 1][0], ARC[k + 1][1], ARC[k][2], ARC[k + 1][2]));
    da = smin(da, circle(px, py, 21, 74, 7), 2);
    da = smin(da, circle(px, py, 46, 74, 8), 2);
    da = min(da, capsule(px, py, 21, 78, 20, WALL - 1, 3, 2.4));
    da = min(da, capsule(px, py, 25, 80, 26, WALL - 1, 2.6, 2.2));
    da = min(da, capsule(px, py, 46, 78, 45, WALL - 1, 3.4, 2.4));
    da = min(da, capsule(px, py, 49, 80, 50, WALL - 1, 2.8, 2.2));
    if (py < 80) da -= 1.8 * teeth(atan2(py - 82, px - 34) * 18);
    d = a < 1 ? d + (da - d) * a : da;
  }
  // The tail.
  const T = S.tail, puff = 1 + 0.7 * a;
  if (px > S.tb[0] && px < S.tb[2] && py > S.tb[1] && py < S.tb[3]) for (let i = 0; i < 14; i++) {
    const r0 = (3.2 - 1.3 * (i / 14)) * puff, r1 = (3.2 - 1.3 * ((i + 1) / 14)) * puff;
    let dt = capsule(px, py, T[2 * i], T[2 * i + 1], T[2 * i + 2], T[2 * i + 3], r0, r1);
    if (a > 0.05) dt -= a * 1.4 * teeth(py);
    d = smin(d, dt, 1.5);
  }
  // The head, turned about the neck by its tilt; arched, it comes down and
  // forward with the chest and dips its nose.
  const tl = S.tilt + 0.3 * a, c = cos(tl), s = sin(tl), nx = 28 - 5 * a, ny = 58 + 13 * a;
  const qx = 28 + c * (lx - nx) + s * (ly - ny), qy = 58 - s * (lx - nx) + c * (ly - ny);
  let dh = circle(qx, qy, 24, 47, 9.5);
  dh = smin(dh, circle(qx, qy, 16, 50, 5), 3);
  dh = smin(dh, circle(qx, qy, 19.5, 53.5, 5), 2.5);
  dh = smin(dh, capsule(qx, qy, 24, 47, 28, 60, 7, 8), 3);
  // Ears: laid back by mood and arch, each flicking back now and then.
  for (let i = 0; i < 2; i++) {
    const fl = S.earAge[i] < 0.3 ? sin((PI * S.earAge[i]) / 0.3) : 0;
    const ang = (0.55 * m + 0.7 * a + 0.5 * fl) * (i ? 1 : 0.8);
    const bx = i ? 28 : 20, by = 40, ec = cos(ang), es = sin(ang);
    const ex = bx + ec * (qx - bx) + es * (qy - by), ey = by - es * (qx - bx) + ec * (qy - by);
    dh = min(dh, tri(ex, ey, i ? [24, 41, 32.5, 43, 29.5, 30] : [15.5, 44, 23.5, 40, 17.5, 30]) - 0.6);
  }
  // A hiss opens the mouth: a wedge cut from the muzzle.
  if (hiss > 0.05) dh = max(dh, -tri(qx, qy, [10, 51.5 - 1.5 * hiss, 19, 52.5, 10, 53.5 + 3 * hiss]));
  return { d: min(d, dh) * SC, qx, qy, hiss };
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const a = pose(S), L = S.c, E = S.e, cat = S.cat;
  // The light: moon and rim in one hue, the eyes in the opposite one.
  hsv(0.075 + S.hue, 0.78, 1, L);
  hsv(0.33 + S.hue, 0.85, 1, E);
  // Eye: open, blinking, narrowed by mood or a hiss.
  const bl = S.blinkAge < 0.18 ? abs(1 - S.blinkAge / 0.09) : 1;
  const open = bl * (1 - 0.45 * max(S.mood, sm(0.3, 0.8, a)));
  const slit = 1.1 - 0.75 * max(S.mood, a);
  // The cat's distance is worked out only near its outline and its eye: a
  // first pass over 4 x 4 blocks marks each as clear of the cat (0), deep
  // inside it (1) or near its edge (2). The fur's teeth make the distance
  // change up to 3.3 times faster than the LEDs, hence the wider margin.
  const blk = S.blk, margin = a > 0.01 || S.mood > 0 ? 11 : 5;
  for (let by = 0; by < 32; by++)
    for (let bx = 0; bx < 16; bx++) {
      const y0 = by * 4;
      if (y0 + 4 <= 8 || y0 > WALL) {
        blk[by * 16 + bx] = 0;
        continue;
      }
      const C = catDist(S, bx * 4 + 2, y0 + 2, a), nearEye = (C.qx - 19.5) ** 2 + (C.qy - 46) ** 2 < 64;
      blk[by * 16 + bx] = C.d > margin ? 0 : C.d < -margin && !nearEye ? 1 : 2;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, px = x + 0.5, py = y + 0.5;
      let R = SKY[3 * y], G = SKY[3 * y + 1], B = SKY[3 * y + 2];
      // Moon glow in rings, then the moon.
      const glow = GLOW[p];
      R += L[0] * glow;
      G += L[1] * glow;
      B += L[2] * glow;
      const mt = MOONT[p];
      if (mt > 0) {
        R += (L[0] * 0.95 * mt - R) * mt;
        G += (L[1] * 0.95 * mt - G) * mt;
        B += (L[2] * 0.95 * mt - B) * mt;
      }
      if (STAR[p] >= 0) {
        const v = 0.25 + 0.2 * sin(S.t * 2.1 + STAR[p]);
        R = max(R, v);
        G = max(G, v);
        B = max(B, v * 1.1);
      }
      // Bats: black against the moon, a shade lighter than the night sky.
      for (let i = 0; i < 3; i++) {
        const [bx, by, dir] = S.bats[i];
        if (abs(px - bx) > 7 || abs(py - by) > 6) continue;
        const cov = cl(0.5 - batDist(px, py, bx, by, dir, sin(S.flap + i * 2.2)), 0, 1);
        if (cov > 0) {
          R += (0.03 - R) * cov;
          G += (0.01 - G) * cov;
          B += (0.05 - B) * cov;
        }
      }
      // The pumpkin's candlelight, in rings that breathe with the flame.
      const warm = round(S.fl * WARM[p] * 20) / 20;
      // The wall: a coping stone lit along its top, bricks below in shadow.
      if (y >= WALL) {
        if (y < WALL + 3) {
          const top = y === WALL ? 0.55 : 0.12;
          R = 0.1 + L[0] * top;
          G = 0.07 + L[1] * top;
          B = 0.13 + L[2] * top;
        } else {
          const row = floor((y - WALL - 3) / 5), bx = (x + (row & 1) * 5) % 10, by = (y - WALL - 3) % 5;
          const tone = 0.7 + 0.3 * hash(row * 17 + floor((x + (row & 1) * 5) / 10));
          const mortar = by === 4 || bx === 9;
          R = mortar ? 0.03 : 0.13 * tone;
          G = mortar ? 0.02 : 0.08 * tone;
          B = mortar ? 0.05 : 0.17 * tone;
        }
      }
      R += FLAME[0] * warm;
      G += FLAME[1] * warm;
      B += FLAME[2] * warm;
      // The jack-o'-lantern itself.
      const sx = x - PX0, sy = y - PY0;
      if (sy >= 0 && sy < PUMPKIN.length && sx >= 0 && sx < 17) {
        const ch = PUMPKIN[sy][sx];
        if (ch === "f") {
          const v = min(1, S.fl * 1.25);
          R = v;
          G = 0.78 * v * v;
          B = 0.2 * v * v * v;
        } else if (ch === "o") {
          const edge = PUMPKIN[sy - 1] === undefined || PUMPKIN[sy - 1][sx] === "." || PUMPKIN[sy - 1][sx] === "s" || sx === 0 || PUMPKIN[sy][sx - 1] === "." || PUMPKIN[sy][sx + 1] === "." || sx === 16;
          R = edge ? 0.62 : 0.3 + 0.14 * S.fl;
          G = edge ? 0.24 : 0.09 + 0.04 * S.fl;
          B = edge ? 0.04 : 0.02;
        } else if (ch === "s") {
          R = 0.16;
          G = 0.2;
          B = 0.05;
        }
      }
      cat[p] = 0;
      const bk = blk[(y >> 2) * 16 + (x >> 2)];
      if (bk === 1) {
        cat[p] = 1;
        R = 0.012;
        G = 0.008;
        B = 0.02;
      } else if (bk === 2 && y > 8 && y < WALL + 1) {
        const C = catDist(S, px, py, a), cov = cl(0.5 - C.d, 0, 1);
        if (cov > 0) {
          cat[p] = 1;
          // Rim light: the first LED inside the edge in the moon's colour,
          // the second at a third, strongest away from the moon's face.
          const rim = (C.d > -1.2 ? 1 : C.d > -2.2 ? 0.35 : 0) * (0.35 + 0.65 * (1 - MOONT[p]));
          const k = 1 - cov;
          // Where the pumpkin's light reaches, its warm rim joins the moon's.
          const rw = C.d > -1.2 ? min(1, 1.6 * warm) : 0;
          R = R * k + cov * (0.012 + L[0] * 0.9 * rim + FLAME[0] * rw);
          G = G * k + cov * (0.008 + L[1] * 0.9 * rim + FLAME[1] * rw);
          B = B * k + cov * (0.02 + L[2] * 0.9 * rim + FLAME[2] * rw);
          // The eye: an almond of light with a slit pupil that looks round.
          const ex = (C.qx - 19.5) / 2.6, ey = (C.qy - 46) / (1.8 * open + 0.01);
          if (open > 0.1 && ex * ex + ey * ey < 1) {
            const pup = abs(C.qx - (19.3 + 1.1 * S.look)) < slit * 0.6 + 0.2;
            R = pup ? 0 : E[0];
            G = pup ? 0 : E[1];
            B = pup ? 0 : E[2];
          }
        }
      }
      display.setPixel(x, y, round(255 * min(1, R)), round(255 * min(1, G)), round(255 * min(1, B)));
    }
}
