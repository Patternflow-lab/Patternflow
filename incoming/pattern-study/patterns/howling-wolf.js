// ===== Patternflow pattern =====
// Title:   Howling Wolf
// Family:  halloween
// Idea:    A black wolf on a rocky crag before a huge rising moon, orange at its foot and pale gold above, lifts its muzzle and howls, throat swelling, breath puffing off on the wind and faint toxic green rings spreading from its jaws, and the small wolves on the far ridge answer one after another in a green glow, while clouds drift, a dead tree bends and the wolf breathes, flicks its ears and sways its tail.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 46
// Round:   46
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Pack=2..6, Wind=0..1
//
// Knob 1: Hue. The moon, its glow and the rims of light: at 0 orange rising to pale gold, at 0.25 green to mint, at 0.5 azure to ice, at 0.75 magenta to pink. Rings and glow stay toxic green.
// Knob 2: Speed. At 2 the wolf raises its head in 0.9 s, howls 3.6 s with a ring every 0.3 s, lowers it in 1 s and howls again 3.2 to 4.8 s after the pack falls quiet; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Pack. How many far wolves answer: 2 at the start, then 3, 4, 5 and 6, four against the moon. The first comes in 1.2 s into the howl at 2 and 0.4 s at 6, the rest every 1.1 s or 0.3 s, each howling 3.3 s in a green glow with rings.
// Knob 4: Wind. At 0 two thin clouds drift 2.5 LEDs a second and the tree barely stirs; at 0.06 they drift at 3; at 0.5 five thicker clouds at 6.8, the tree leaning; at 1 eight heavy clouds at 11, the tree bent hard.
// Buttons: K1 tap makes the wolf howl at once (and the pack answer) unless it already is.

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
function hsv(h, s, v, out) {
  for (let i = 0; i < 3; i++) {
    const k = (5 - 2 * i + 6 * (h - floor(h))) % 6;
    out[i] = v - v * s * max(0, min(k, 4 - k, 1));
  }
}
// Channels in steps of 4 of 255: no banding on the panel, flat areas stay flat.
const q4 = (v) => (v <= 0 ? 0 : v >= 1 ? 252 : round(v * 63) * 4);

// Signed distances in LEDs, negative inside, and a smooth union.
const circle = (px, py, cx, cy, r) => sqrt((px - cx) ** 2 + (py - cy) ** 2) - r;
function capsule(px, py, ax, ay, bx, by, ra, rb) {
  const ex = bx - ax, ey = by - ay, qx = px - ax, qy = py - ay, u = cl((qx * ex + qy * ey) / (ex * ex + ey * ey || 1), 0, 1);
  return sqrt((qx - u * ex) ** 2 + (qy - u * ey) ** 2) - (ra + (rb - ra) * u);
}
const smin = (a, b, k) => {
  const h = cl(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
};
// Blend a colour into buf at LED p by a.
function mix(buf, p, r, g, b, a) {
  const q = 3 * p;
  buf[q] += (r - buf[q]) * a;
  buf[q + 1] += (g - buf[q + 1]) * a;
  buf[q + 2] += (b - buf[q + 2]) * a;
}
// A black silhouette covering LED p by a, with a rim of the moon's colour mc.
const black = (buf, mc, p, a, rim) => mix(buf, p, 0.012 + mc[3 * p] * rim, 0.008 + mc[3 * p + 1] * rim, 0.02 + mc[3 * p + 2] * rim, a);

// The moon low on the horizon, its seas, its glow, and per row its blend
// from orange at the foot (0) to gold near the top (1).
const MX = 33, MY = 55, MR = 26;
const SEAS = [[-8, -8, 6, 5], [7, -11, 5, 4], [10, 3, 6, 6], [-11, 6, 5, 6], [1, 12, 6, 4], [-3, -1, 3, 3]];
const MOONT = new Float32Array(N), GLOW = new Float32Array(N), MROW = new Float32Array(H);
for (let p = 0; p < N; p++) {
  const dx = (p % W) + 0.5 - MX, dy = floor(p / W) + 0.5 - MY, r = sqrt(dx * dx + dy * dy);
  if (r < MR + 1) {
    let e = 9;
    for (const [cx, cy, rx, ry] of SEAS) e = min(e, ((dx - cx) / rx) ** 2 + ((dy - cy) / ry) ** 2 + 0.25 * sin(dx + dy));
    MOONT[p] = (e < 1 ? 0.86 : e < 1.6 ? 0.93 : 1) * cl(MR + 0.5 - r, 0, 1);
  }
  const out = max(0, r - MR);
  GLOW[p] = round((0.3 * exp(-out / 4) + 0.1 * exp(-out / 14)) * 16) / 16;
}
for (let y = 0; y < H; y++) MROW[y] = sm(MY + MR, MY - MR * 0.6, y + 0.5);
// Stars: [LED, twinkle phase], clear of the moon.
const STARS = [];
for (let i = 0; STARS.length < 22; i++) {
  const x = floor(hash(i * 3 + 1) * W), y = floor(2 + hash(i * 3 + 2) * 62);
  if ((x + 0.5 - MX) ** 2 + (y + 0.5 - MY) ** 2 > (MR + 5) ** 2) STARS.push([y * W + x, hash(i * 3 + 3) * 6.28]);
}

// Three far ridges as the row of their crest in each column, the far one
// across the moon's foot; the wolf's crag ends in a cliff at x = 42.
const R = [new Float32Array(W), new Float32Array(W), new Float32Array(W)], CRAG = new Float32Array(W);
for (let x = 0; x < W; x++) {
  R[0][x] = 79.5 + 3 * sm(44, 64, x) - 2 * sm(12, 0, x) + 1.1 * sin(x * 0.45) + 0.6 * sin(x * 1.3 + 2);
  R[1][x] = 94 - 3 * sm(46, 64, x) + 1.4 * sin(x * 0.55 + 1) + 0.6 * sin(x * 1.6);
  R[2][x] = 110 - 2 * sm(44, 64, x) + 1.6 * sin(x * 0.4 + 2) + 0.6 * sin(x * 1.4);
  CRAG[x] = x < 42 ? 104 - 1.1 * sin(x * 0.7) - 0.7 * sin(x * 1.9 + 1) - 2.5 * sm(10, 0, x) : 104 + (x - 42) * 3.2 + 1.4 * sin(x * 2.1);
}
const RC = [[0.17, 0.062, 0.25], [0.095, 0.034, 0.15], [0.05, 0.018, 0.085]], ROCK = [0.012, 0.008, 0.022];
// The ridge in front at each LED (-1 none), and the crag (2 on its top).
const RIDX = new Int8Array(N).fill(-1), CRG = new Uint8Array(N);
for (let p = 0; p < N; p++) {
  const x = p % W, py = floor(p / W) + 0.5;
  for (let i = 0; i < 3; i++) if (py > R[i][x]) RIDX[p] = i;
  if (py > CRAG[x]) CRG[p] = py - CRAG[x] < 1.2 ? 2 : 1;
}

// The far wolves, [x of their feet, ridge], in the order they answer, a
// shade darker than their ridge, facing left.
const PACK = [[26, 0], [57, 0], [49, 0], [17, 0], [56, 1], [8, 0]];
const FC = [[0.075, 0.026, 0.12], [0.035, 0.012, 0.06]];
// A far wolf facing right, standing and howling.
const FAR = [
  [".........", ".........", "......#..", ".....####", ".######..", "#######..", "##.#..##.", ".#.#...#."],
  [".......#.", "......##.", ".....##..", "....###..", ".#####...", "#######..", "##.#..##.", ".#.#...#."],
];
// The glow round a howling far wolf: offsets within 5 LEDs, with weights.
const KERN = [];
for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (dx * dx + dy * dy <= 26) KERN.push([dx, dy, exp(-sqrt(dx * dx + dy * dy) / 2.2)]);

// The dead tree as branches [parent, length, angle from the parent
// (clockwise from up), base and tip radius].
const TREE = [
  [-1, 13, 0.06, 2.2, 1.6], [0, 11, -0.1, 1.6, 1.1], [1, 9, 0.3, 1.1, 0.75], [2, 7, 0.35, 0.75, 0.5],
  [1, 7, -0.7, 0.9, 0.55], [4, 5, -0.35, 0.55, 0.4], [0, 9, 0.95, 1.0, 0.55], [6, 6, 0.45, 0.55, 0.4],
  [2, 6, -0.6, 0.65, 0.4], [3, 5, 0.95, 0.5, 0.35], [6, 4, -0.5, 0.5, 0.35], [7, 4, 0.7, 0.4, 0.3],
];
const TREEX = 4, TREEY = 104;
// Clouds: [row, length, where on its lap it starts].
const CLOUDS = [[66, 30, 0.47], [40, 26, 0.3], [52, 34, 0.85], [28, 24, 0.62], [72, 28, 0.12], [46, 36, 0.05], [60, 30, 0.7], [34, 28, 0.95]];
const CST = new Float64Array(15), RING = [1, 0.45, 0.2];

// The wolf is laid out with paws on row 101 and drawn at 0.8 size, (30, 101) on (26, 104).
const SC = 0.8, AX = 30, AY = 101, WX = 26, WY = 104;
const L1 = 0.9, L2 = 3.6, L3 = 1.0, F1 = 0.3, F2 = 2.6, F3 = 0.4;
// How far a head is up at age a of a howl: up in u s, held h s, down in w s.
const env = (a, u, h, w) => (a < 0 ? 0 : sm(0, u, a) - sm(u + h, u + h + w, a));
const farLift = (a) => env(a, F1, F2, F3);

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, pack: 2, wind: 0.06, cloudX: 0,
    // The howl's age (-1 none), the wait for the next, ring and breath clocks.
    howl: -1, wait: 0.05, ring: 0, puff: 0, lift: 0,
    // Each far wolf: wait, howl age (-1 none), ring clock, first ring still to go.
    fs: new Float32Array(6).fill(-1), fh: new Float32Array(6).fill(-1), fr: new Float32Array(6), fc: new Uint8Array(6),
    rings: [], vap: [], earAge: [9, 9], earWait: [2.2, 3.6],
    buf: new Float32Array(N * 3), bg: new Float32Array(N * 3), mc: new Float32Array(N * 3), bgHue: -1,
    sil: new Float32Array(N), wd: new Float32Array(N), glow: new Float32Array(N), tree: new Float32Array(N),
    moon: [0, 0, 0], gold: [0, 0, 0], tb: [0, 0, 0, 0], tail: new Float32Array(20), seg: new Float32Array(TREE.length * 6),
  };
}

// The head: centre and muzzle angle (0 level, negative up).
const headPose = (S, l = S.lift) => ({ hx: 46.5 - 1.2 * l, hy: 76 - 4.5 * l, a: 0.2 - 1.32 * l });

// A ring: place, heading, half width, speed, strength, reach, depth, pack's.
const ring = (x, y, a, w, v, s, lim, rows, far) => ({ x, y, r: 1.5, a, w, v, s, lim, rows, far });

function startHowl(S) {
  S.howl = 0;
  S.ring = 0.05;
  S.puff = 0;
  // A bigger pack comes in sooner and closer together.
  for (let k = 0; k < 6; k++) (S.fs[k] = 1.6 - 0.2 * S.pack + (2.4 / S.pack - 0.1) * k + 0.1 * Math.random()), (S.fh[k] = -1);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 2, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.pack = round(cl(kv[2], 2, 6));
  S.wind = cl(kv[3], 0, 1);
  const ds = (d * S.speed) / 2, wv = 2.5 + 8.5 * S.wind;
  S.t += ds;
  S.cloudX += ds * wv;
  if (input.btnPressed && input.btnPressed[0] && S.howl < 0) startHowl(S);
  if (S.howl >= 0) {
    S.howl += ds;
    // Rings and breath leave the nose tip while it holds the note.
    const hp = headPose(S), ca = cos(hp.a), sa = sin(hp.a);
    const nx = WX + (hp.hx + 9.8 * ca - 0.5 * sa - AX) * SC, ny = WY + (hp.hy + 9.8 * sa + 0.5 * ca - AY) * SC;
    if (S.howl > L1 && S.howl < L1 + L2) {
      if ((S.ring -= ds) <= 0) (S.ring += 0.3), S.rings.push(ring(nx, ny, hp.a, 1.45, 18, 0.9, 62, 3, 0));
      if ((S.puff -= ds) <= 0) (S.puff += 0.22), S.vap.push({ x: nx, y: ny, vx: 5 * ca, vy: 5 * sa, age: 0, life: 1.5 + 0.6 * Math.random() });
    }
    if (S.howl > L1 + L2 + L3) (S.howl = -1), (S.wait = 1e9);
  }
  // The pack, counted from the start of the main howl.
  let busy = false;
  for (let k = 0; k < 6; k++) {
    if (k >= S.pack) S.fs[k] = S.fh[k] = -1;
    if (S.fs[k] >= 0 && (busy = true) && (S.fs[k] -= ds) < 0) (S.fh[k] = 0), (S.fr[k] = 0), (S.fc[k] = 1);
    if (S.fh[k] < 0) continue;
    busy = true;
    S.fh[k] += ds;
    if (S.fh[k] > F1 && S.fh[k] < F1 + F2 && (S.fr[k] -= ds) <= 0) {
      S.fr[k] += 0.45;
      const [fx, ridge] = PACK[k], x = fx - 3.5, y = round(R[ridge][fx]) - 6.5;
      S.rings.push(ring(x, y, -1.92, 1.5, 10, 0.85, 28, 2, 1));
      // The first note of each answer carries: one wide, faint ring.
      if (S.fc[k]) S.rings.push(ring(x, y, -1.77, 1.6, 24, 0.55, 64, 2, 1)), (S.fc[k] = 0);
    }
    if (S.fh[k] > F1 + F2 + F3) S.fh[k] = -1;
  }
  // The next howl 3.2 to 4.8 s after the pack has done.
  if (S.howl < 0 && !busy) {
    if (S.wait > 100) S.wait = 3.2 + 1.6 * Math.random();
    if ((S.wait -= ds) <= 0) startHowl(S);
  }
  S.lift = env(S.howl, L1, L2, L3);
  // Rings spread; breath drifts off on the wind, rising.
  for (const r of S.rings) r.r += r.v * ds;
  S.rings = S.rings.filter((r) => r.r < r.lim);
  for (const v of S.vap) {
    const e = min(1, ds * 1.5);
    v.age += ds;
    v.x += (v.vx += (wv * 0.9 - v.vx) * e) * ds;
    v.y += (v.vy += (-1.6 - v.vy) * e) * ds;
  }
  S.vap = S.vap.filter((v) => v.age < v.life);
  for (let i = 0; i < 2; i++) {
    S.earAge[i] += ds;
    if ((S.earWait[i] -= ds) <= 0) (S.earAge[i] = 0), (S.earWait[i] = 1.8 + 3.5 * Math.random());
  }
}

// The tail's joints: it hangs, sways and lifts a little in the howl; tb boxes it.
function tailPose(S) {
  const T = S.tail, tb = S.tb, t = S.t;
  let x = 19.4, y = 81.5, a = 2.0 - 0.25 * S.lift;
  const sw = 0.16 * sin(t * ((2 * PI) / 3.4)), w = 0.07 * sin(t * ((2 * PI) / 1.7) + 1);
  tb[0] = tb[1] = 1e9;
  tb[2] = tb[3] = -1e9;
  for (let i = 0; i <= 9; i++) {
    T[2 * i] = x;
    T[2 * i + 1] = y;
    (tb[0] = min(tb[0], x - 5)), (tb[1] = min(tb[1], y - 5)), (tb[2] = max(tb[2], x + 5)), (tb[3] = max(tb[3], y + 5));
    a += 0.07 + sw * (0.4 + i / 9) * 0.5 + (w * i) / 9;
    x += cos(a) * 1.75;
    y += sin(a) * 1.75;
  }
}
const tailR = (u) => 1.3 + 2.1 * sin(PI * min(1, u * 1.1) ** 0.8) * (0.55 + 0.45 * u);

// Legs [from, to, radii, blend (0 plain)]: front near and far (forearm, cannon,
// paw), hind near and far (thigh, shin back to the hock, foot, paw).
const LEGS = [
  [[39.6, 87, 40.4, 95, 2.6, 1.6, 1.5], [40.4, 95, 40.8, 100.2, 1.5, 1.25, 0], [40.6, 100.3, 43, 100.5, 1.1, 1, 0],
    [35.8, 88, 35.6, 95, 2.1, 1.3, 1], [35.6, 95, 35.4, 100.2, 1.25, 1.1, 0], [35.2, 100.3, 37.4, 100.5, 1, 0.95, 0]],
  [[23.5, 84, 26, 91.5, 4.8, 2.4, 1.5], [26, 91.5, 21.6, 96.2, 2, 1.4, 0.8], [21.6, 96.2, 22.4, 100.2, 1.3, 1.15, 0], [22.2, 100.3, 24.6, 100.5, 1.05, 1, 0],
    [27.5, 85.5, 29.5, 91.5, 3.2, 1.8, 1], [29.5, 91.5, 25.8, 96.2, 1.6, 1.2, 0.6], [25.8, 96.2, 26.4, 100.2, 1.15, 1.05, 0], [26.2, 100.3, 28.4, 100.5, 0.95, 0.9, 0]],
];
// The wolf, facing right; info gets the head's frame (u along the muzzle, v down) for the eye.
function wolfDist(S, px, py, hp, info) {
  const l = S.lift, br = sin(S.t * ((2 * PI) / 2.8)) * (1 - l);
  // Body: the chest rises and falls with the breath.
  let d = capsule(px, py, 24, 83.5, 37, 82.8 - 0.2 * br, 5, 6.2);
  d = smin(d, circle(px, py, 39, 85 - 0.3 * br, 6.2 + 0.3 * br), 2.5);
  d = smin(d, circle(px, py, 22.5, 83, 5), 1.5);
  // Legs, below row 78: the front pair right of column 33, the hind pair left.
  if (py > 78)
    for (const [ax, ay, bx, by, ra, rb, k] of LEGS[px > 33 ? 0 : 1]) {
      const c = capsule(px, py, ax, ay, bx, by, ra, rb);
      d = k ? smin(d, c, k) : min(d, c);
    }
  // The tail, a bushy chain from the rump.
  const T = S.tail, tb = S.tb;
  if (px > tb[0] && px < tb[2] && py > tb[1] && py < tb[3])
    for (let i = 0; i < 9; i++) d = smin(d, capsule(px, py, T[2 * i], T[2 * i + 1], T[2 * i + 2], T[2 * i + 3], tailR(i / 9), tailR((i + 1) / 9)), 1.2);
  // Neck and throat; the throat swells while it howls.
  const ca = cos(hp.a), sa = sin(hp.a), hx = hp.hx, hy = hp.hy, sw = l > 0.9 ? 0.8 + 0.4 * sin(S.howl * 9) : l * 0.8;
  d = smin(d, capsule(px, py, 37, 81.5, hx - 0.5 * ca, hy - 0.5 * sa, 5.2, 4), 2);
  d = smin(d, capsule(px, py, 41.5, 87, hx + 1.2 * ca - 3.2 * sa, hy + 1.2 * sa + 3.2 * ca, 3.2 + 0.4 * sw, 2.2 + 1.1 * sw), 2);
  // The ruff down the front of the neck, a row of tufts.
  if (d < 2.5 && d > -2.5 && px > 36 && py < 90 && px < hx + 4) d -= 0.7 * max(0, 1 - 2.6 * abs((((px + py * 0.6) / 2.3) % 1) - 0.5));
  // The head in its own frame: skull, cheek, muzzle.
  const qx = px - hx, qy = py - hy, u = qx * ca + qy * sa, v = -qx * sa + qy * ca;
  info.u = u;
  info.v = v;
  if (u > 14 || u < -10 || v > 9 || v < -12) return d;
  let dh = smin(circle(u, v, 0, 0, 4.2), circle(u, v, 1.8, 1.5, 3.2), 1.5);
  dh = smin(dh, capsule(u, v, 2.5, -0.5, 9.4, 0.8, 2.3, 1.2), 1.2);
  // The lower jaw drops while it howls, opening the mouth.
  const jw = 0.32 * sm(L1, L1 + 0.3, S.howl) * (S.howl < L1 + L2 ? 1 : 1 - sm(L1 + L2, L1 + L2 + 0.4, S.howl));
  const jc = cos(jw), js = sin(jw);
  dh = smin(dh, capsule(2.5 + (u - 2.5) * jc + (v - 2.2) * js, 2.2 - (u - 2.5) * js + (v - 2.2) * jc, 2.5, 2.2, 8.4, 2.4, 1.5, 0.8), 0.8);
  // Ears, the far one behind: laid back in the howl, each flicking now and then.
  for (let i = 0; i < 2; i++) {
    const ag = S.earAge[i], back = 0.3 * l + (ag < 0.25 ? 0.45 * sin((PI * ag) / 0.25) : 0) + (i ? 0 : 0.15);
    const bx = i ? -0.2 : -2.5, by = i ? -3.6 : -3.3, ec = cos(back), es = sin(back);
    dh = min(dh, capsule(bx + (u - bx) * ec + (v - by) * es, by - (u - bx) * es + (v - by) * ec, bx + 0.2, by + 0.3, bx - 0.2, by - 4.8, 1.7, 0.15));
  }
  return min(d, dh);
}

// The tree's branches: a lean in the wind plus gusts, more the higher the branch.
function treePose(S) {
  const seg = S.seg, t = S.t, wind = S.wind, lean = (0.03 + 0.3 * wind) * (0.4 + 0.6 * (0.5 + 0.5 * sin(t * 1.3) * sin(t * 0.47 + 1)));
  for (let i = 0; i < TREE.length; i++) {
    const [par, len, ang] = TREE[i], o = par * 6;
    const x0 = par < 0 ? TREEX : seg[o + 2], y0 = par < 0 ? TREEY : seg[o + 3], depth = par < 0 ? 0 : seg[o + 5] + 1;
    const a = (par < 0 ? 0 : seg[o + 4]) + ang + lean * (0.5 + depth * 0.5) + 0.03 * (1 + 2 * wind) * sin(t * 2.3 + i * 1.7) * depth;
    seg.set([x0, y0, x0 + sin(a) * len, y0 - cos(a) * len, a, depth], i * 6);
  }
}

// Sky, moon, ridges and crag, kept until Hue moves; mc is the moon's colour
// at each LED, for the rims of light.
function background(S) {
  const bg = S.bg, mc = S.mc, M = S.moon, G = S.gold;
  for (let p = 0; p < N; p++) {
    const x = p % W, y = floor(p / W), k = MROW[y], gl = GLOW[p], mt = MOONT[p];
    const mr = M[0] + (G[0] - M[0]) * k, mg = M[1] + (G[1] - M[1]) * k, mb = M[2] + (G[2] - M[2]) * k;
    mc.set([mr, mg, mb], 3 * p);
    // The sky in ten steps, near black at the top and purple at the horizon.
    const t = round(10 * sm(0, 86, y)) / 10;
    let r = 0.025 + 0.2 * t + mr * gl * 0.8, g = 0.01 + 0.055 * t + mg * gl * 0.8, b = 0.06 + 0.24 * t + mb * gl * 0.8;
    r += (mr * mt - r) * mt;
    g += (mg * mt - g) * mt;
    b += (mb * mt - b) * mt;
    if (RIDX[p] >= 0) [r, g, b] = RC[RIDX[p]];
    if (CRG[p]) {
      // Black rock: moonlit top and cliff edges, faint slanting ledges.
      const top = CRG[p] === 2, ledge = !top && (x * 0.45 + y + 3 * hash(floor(x / 6))) % 9 < 1;
      const lit = top ? 0.22 : x >= 41 && !CRG[p - 1] ? 0.14 : ledge ? 0.05 : 0, f = top || ledge ? 1 : 0;
      [r, g, b] = [ROCK[0] + 0.03 * f + mr * lit, ROCK[1] + 0.012 * f + mg * lit * 0.7, ROCK[2] + 0.04 * f + mb * lit * 0.4];
    }
    bg.set([r, g, b], 3 * p);
  }
}

// Rings of sound: arcs about the muzzle's line, fading as they spread and
// toward their ends, mixed towards toxic green (not added) so they show on
// the moon too. far picks the pack's rings or the wolf's own.
function rings(S, buf, far) {
  for (const rg of S.rings) {
    if (rg.far !== far) continue;
    const fade = (1 - rg.r / rg.lim) * rg.s, steps = max(6, round(rg.r * rg.w * 1.6));
    for (let j = 0; j < rg.rows; j++) {
      const rr = rg.r - j;
      if (rr < 0.5) continue;
      for (let i = -steps; i <= steps; i++) {
        const u = i / steps, a = rg.a + u * rg.w, ix = floor(rg.x + rr * cos(a)), iy = floor(rg.y + rr * sin(a));
        if (ix >= 0 && ix < W && iy >= 0 && iy < H) mix(buf, iy * W + ix, 0.3, 0.95, 0.22, fade * (1 - u * u) * 0.7 * RING[j]);
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, sil = S.sil, wd = S.wd, mc = S.mc, glow = S.glow, tree = S.tree, wind = S.wind;
  if (S.bgHue !== S.hue) {
    // The moon: orange at its foot, pale gold at the top.
    hsv(0.07 + S.hue, 0.85, 1, S.moon);
    hsv(0.12 + S.hue, 0.42, 1, S.gold);
    background(S);
    S.bgHue = S.hue;
  }
  buf.set(S.bg);
  for (const [p, ph] of STARS) {
    const v = 0.22 + 0.22 * sin(S.t * 2.4 + ph), q = 3 * p;
    buf[q] = max(buf[q], v);
    buf[q + 1] = max(buf[q + 1], v);
    buf[q + 2] = max(buf[q + 2], v * 1.15);
  }
  // Clouds: two or three ragged strands each, slowly boiling, purple, their
  // edges lit where the moon is behind.
  const nc = 2 + round(6 * wind), thick = 1.05 + 1.1 * wind, st = CST;
  for (let i = 0; i < nc; i++) {
    const [cy0, len0, ph] = CLOUDS[i], len = len0 * (0.85 + 0.8 * wind), span = W + len + 20;
    const x0 = ((S.cloudX * (0.85 + 0.3 * hash(i + 40)) + ph * span) % span) - len - 15, cy = cy0 + 1.5 * sin(S.t * 0.2 + i), ns = 2 + (i % 2);
    for (let j = 0; j < ns; j++) {
      const h1 = hash(i * 17 + j), h3 = hash(i * 17 + j + 11);
      st.set([x0 + (h1 - 0.3) * len * 0.35, len * (0.55 + 0.45 * hash(i * 17 + j + 5)), cy + j * 2.8 - 2 + h3, thick * (1.1 + 1.5 * h3), h1 * 6.28], 5 * j);
    }
    for (let y = max(0, floor(cy - 14)); y < min(90, cy + 14); y++)
      for (let x = max(0, floor(x0 - 10)); x < min(W, x0 + len * 1.3); x++) {
        const p = y * W + x;
        if (RIDX[p] >= 0) continue;
        const px = x + 0.5, py = y + 0.5, lx = px - x0;
        let dc = 1e9;
        for (let o = 0; o < 5 * ns; o += 5) {
          const u = (px - st[o]) / st[o + 1], sd = st[o + 4], dy = abs(py - st[o + 2]);
          if (u <= 0 || u >= 1 || dy - st[o + 3] > 1) continue;
          dc = min(dc, dy - st[o + 3] * sin(PI * u) ** 0.6 * (0.75 + 0.2 * sin(lx * 0.8 + sd) + 0.15 * sin(lx * 1.9 + 2 * sd + S.t * 0.9)));
        }
        const cov = cl(0.5 - dc, 0, 1);
        if (cov <= 0) continue;
        const near = min(1, GLOW[p] * 1.5 + MOONT[p]), rim = dc > -1 ? near * 0.4 : 0;
        mix(buf, p, 0.13 + 0.07 * near + mc[3 * p] * rim, 0.045 + 0.03 * near + mc[3 * p + 1] * rim * 0.8, 0.2 + 0.07 * near + mc[3 * p + 2] * rim * 0.6, cov * 0.92);
      }
  }
  // The far wolves, a green glow kindling round each one that howls.
  glow.fill(0);
  const fw = [];
  for (let k = 0; k < S.pack; k++) {
    const g = 0.6 * farLift(S.fh[k]), [fx, ridge] = PACK[k], top = round(R[ridge][fx]) - 7, bm = FAR[g > 0.3 ? 1 : 0];
    for (let q = 0; q < 72; q++) {
      const x = fx + 3 - (q % 9), y = top + floor(q / 9);
      if (bm[floor(q / 9)][q % 9] !== "#" || x < 0 || x >= W) continue;
      fw.push([y * W + x, ridge]);
      if (g > 0.01) for (const [dx, dy, w] of KERN) if (x + dx >= 0 && x + dx < W) glow[(y + dy) * W + x + dx] = max(glow[(y + dy) * W + x + dx], g * w);
    }
  }
  for (let p = 60 * W; p < 100 * W; p++) if (glow[p] > 0) mix(buf, p, 0.3, 0.95, 0.22, glow[p]);
  for (const [p, ridge] of fw) buf.set(FC[ridge], 3 * p);
  // Their rings go behind the tree and the wolf.
  rings(S, buf, 1);
  // The tree, black with moonlight on its upper edges.
  tailPose(S);
  treePose(S);
  const seg = S.seg;
  tree.fill(0);
  for (let i = 0; i < TREE.length; i++) {
    const [x0, y0, x1, y1] = seg.subarray(i * 6, i * 6 + 4), [, , , r0, r1] = TREE[i];
    for (let y = max(0, floor(min(y0, y1) - r0 - 1)); y <= floor(max(y0, y1) + r0 + 1); y++)
      for (let x = max(0, floor(min(x0, x1) - r0 - 1)); x <= floor(max(x0, x1) + r0 + 1); x++)
        tree[y * W + x] = max(tree[y * W + x], cl(0.5 - capsule(x + 0.5, y + 0.5, x0, y0, x1, y1, r0, r1), 0, 1));
  }
  for (let p = 30 * W; p < 105 * W; p++) {
    const tc = tree[p], rim = tc < 0.99 || tree[p - W] < 0.5 ? 0.45 * (1 - MOONT[p]) * min(1, GLOW[p] * 2 + 0.3) : 0;
    if (tc > 0) black(buf, mc, p, tc, rim);
  }
  // The wolf: blocks of 4 x 4 clear of it or deep inside are settled at
  // once; only edge blocks and the eye's are worked out LED by LED.
  const hp = headPose(S), info = { u: 0, v: 0 }, eyeOpen = 1 - sm(0.15, 0.5, S.lift);
  const eyeX = WX + (hp.hx + 1.3 * cos(hp.a) + 0.9 * sin(hp.a) - AX) * SC, eyeY = WY + (hp.hy + 1.3 * sin(hp.a) - 0.9 * cos(hp.a) - AY) * SC;
  const lx = (x) => AX + (x - WX) / SC, ly = (y) => AY + (y - WY) / SC;
  sil.fill(0);
  wd.fill(9);
  for (let by = 64; by < 108; by += 4)
    for (let bx = 4; bx < 52; bx += 4) {
      const dc = wolfDist(S, lx(bx + 2), ly(by + 2), hp, info) * SC, nearEye = abs(bx + 2 - eyeX) < 5 && abs(by + 2 - eyeY) < 5;
      if (dc > 5 && !nearEye) continue;
      for (let y = by; y < by + 4; y++)
        for (let x = bx; x < bx + 4; x++) {
          const p = y * W + x;
          const dd = dc < -5 && !nearEye ? -9 : wolfDist(S, lx(x + 0.5), ly(y + 0.5), hp, info) * SC;
          wd[p] = dd;
          sil[p] = cl(0.5 - dd, 0, 1);
          // The eye, a toxic green glint, shut while it howls.
          if (dd < -0.5 && eyeOpen > 0.1 && ((info.u - 1.3) / 1.15) ** 2 + ((info.v + 0.9) / (0.8 * eyeOpen)) ** 2 < 1) sil[p] = -1;
        }
    }
  for (let y = 64; y < 108; y++)
    for (let x = 4; x < 52; x++) {
      const p = y * W + x, sv = sil[p];
      if (sv < 0) buf.set([0.45, 1, 0.25], 3 * p);
      if (sv <= 0) continue;
      // Moonlight rims edges facing up, half the sides, none on the moon's face.
      const up = sil[p - W], side = min(sil[p - 1], sil[p + 1]);
      const edge = wd[p] > -1.1 ? (up < 0.5 && up >= 0 ? 1 : side < 0.5 && side >= 0 ? 0.55 : 0.2) : 0;
      black(buf, mc, p, sv, edge * (1 - 0.85 * MOONT[p]) * min(1, GLOW[p] * 2.2 + 0.25) * 0.8);
    }
  // Breath: pale puffs that swell and fade as they drift.
  for (const v of S.vap) {
    const f = 1 - v.age / v.life, a = 0.34 * f * f, rr = 3.2 - 2.4 * f;
    for (let y = max(0, floor(v.y - rr - 1)); y <= min(H - 1, floor(v.y + rr + 1)); y++)
      for (let x = max(0, floor(v.x - rr - 1)); x <= min(W - 1, floor(v.x + rr + 1)); x++) {
        const c = cl(rr + 0.5 - sqrt((x + 0.5 - v.x) ** 2 + (y + 0.5 - v.y) ** 2), 0, 1) * a;
        if (c > 0) mix(buf, y * W + x, 0.85, 0.8, 0.95, c);
      }
  }
  // The wolf's own rings, in front of everything.
  rings(S, buf, 0);
  for (let p = 0; p < N; p++) display.setPixel(p % W, floor(p / W), q4(buf[3 * p]), q4(buf[3 * p + 1]), q4(buf[3 * p + 2]));
}
