// ===== Patternflow pattern =====
// Title:   Werewolf
// Family:  halloween
// Idea:    Clouds slide off a huge full moon and the black figure of a man standing on a rock in front of it bends forward with his back arching, his arms stretching down into forelegs and his face into a muzzle, until a wolf with pricked ears stands there and howls rings into the night; then the clouds come back over the moon and the wolf shrinks into the man again.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 49
// Round:   49
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Clouds=0..1, Moon=-1..1
//
// Knob 1: Hue. The night sky and the clouds, through the cold colours only: at 0 purple, at 0.25 indigo, at 0.5 deep sea blue, at 0.75 teal and at 1 poison green. The moon stays pale gold.
// Knob 2: Speed. At 2 one night takes 15 seconds: the bank of clouds is past the man by 2 s, the change runs from 0.4 s to 4.4 s, the wolf raises its head at 5 s and howls from 5.5 s to 8.6 s with a ring every 0.3 s, the clouds are back over the moon by 12 s and the wolf is a man again by 13.5 s. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Clouds. At 0 four thin clouds veil the moon, letting about half its light through, and two wisps cross the high sky; at 1 the four are heavy, three more trail behind them across the moon until 4 s into the night, and six thick wisps fill the high sky.
// Knob 4: Moon. Its radius: 22 LEDs at -1, 27 at the opening 0.06 and 32 at 1, where it fills the panel's width.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, abs, sqrt, sin, cos, atan2, acos, round, PI } = Math;
const hypot = (x, y) => sqrt(x * x + y * y);
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => ((t = cl(t, 0, 1)), t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}
// Channels in steps of 4 of 255: flat areas stay flat for the panel.
const q4 = (v) => (v <= 0 ? 0 : v >= 1 ? 252 : round(v * 63) * 4);

// Signed distances in LEDs, negative inside.
const circle = (px, py, cx, cy, r) => hypot(px - cx, py - cy) - r;
function capsule(px, py, ax, ay, bx, by, ra, rb) {
  const ex = bx - ax, ey = by - ay, qx = px - ax, qy = py - ay, u = cl((qx * ex + qy * ey) / (ex * ex + ey * ey || 1), 0, 1);
  return hypot(qx - u * ex, qy - u * ey) - (ra + (rb - ra) * u);
}
const smin = (a, b, k) => {
  const h = cl(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
};

// The moon, the ground line the figure stands on, and one night in story seconds.
const MX = 32, MY = 74, G = 104, NIGHT = 15;
const MOON = [1, 0.9, 0.6];
// The rock's top edge per column, flat under the figure and falling away in
// steps at both ends, and the far hills, hidden behind the rock in the middle.
const CREST = new Float32Array(W), RIDGE = new Float32Array(W);
for (let x = 0; x < W; x++) {
  const l = max(0, 14 - x), r = max(0, x - 50);
  // Boulders at both ends of the top, clear of where the feet go.
  const knob = -2.2 * max(0, 1 - abs(x - 14.5) / 3) - 1.6 * max(0, 1 - abs(x - 50) / 2.5);
  CREST[x] = G + knob + 0.95 * l + 1.15 * r + min(1, (l + r) / 3) * (2.2 * abs(sin(x * 0.75)) + 0.8 * sin(x * 2.1));
  RIDGE[x] = 96 + 9 * cos((PI * (x - 32)) / 64) ** 2 + 1.3 * sin(x * 0.37) + 0.6 * sin(x * 1.3);
}
// Seas on the moon as [dx, dy, rx, ry] in units of its radius.
const SEAS = [[-0.3, -0.3, 0.22, 0.18], [0.27, -0.4, 0.18, 0.15], [0.36, 0.1, 0.22, 0.22], [-0.42, 0.22, 0.18, 0.22], [0.04, 0.45, 0.22, 0.14]];
// Stars: LED and twinkle phase, in the high sky.
const STARS = [];
for (let i = 0; STARS.length < 24; i++) {
  const x = floor(hash(3 * i + 1) * W), y = floor(2 + hash(3 * i + 2) * 40);
  STARS.push([y * W + x, hash(3 * i + 3) * TAU]);
}
// The bank of clouds that covers and uncovers the moon, [dx, dy, half length,
// thickness] about the moon's centre, most important first; and the wisps of
// the high sky, [row, start, half length, thickness]. Each is a row of puffs
// with a flat foot. The first four always come; the other three trail to the
// right, so on a cloudy night they are still crossing the moon while the
// change begins.
const BANK = [[-4, -9, 22, 9], [9, 10, 22, 8], [-12, 27, 18, 7], [10, -28, 17, 6], [46, -16, 18, 8], [58, 6, 20, 9], [70, 24, 20, 8]];
const WISPS = [[14, 0.1, 16, 3.5], [31, 0.55, 19, 4], [6, 0.8, 12, 3], [41, 0.3, 14, 3.5], [23, 0.95, 17, 3], [49, 0.7, 12, 3]];
[...BANK, ...WISPS].forEach((C, j) => {
  const L = C[2], T = C[3], n = 1 + Math.ceil((2 * L) / (0.8 * T));
  C.puffs = [];
  for (let i = 0; i < n; i++) {
    const e = (2 * i) / (n - 1) - 1, r = T * (0.7 + 0.55 * hash(j * 31 + i)) * (1 - 0.45 * e * e);
    C.puffs.push([L * e, 0.35 * T - 0.55 * r, r]);
  }
});

// A cloud's distance field: its puffs blended, its foot cut flat.
function puff(C, px, py, th) {
  let d = 99;
  for (const [ux, uy, ur] of C.puffs) d = smin(d, hypot(px - ux, py - uy * th) - ur * th, 0.5 * C[3]);
  return max(d, py - C[3] * 0.45 * th);
}

// A cloud's shape at thickness th as a mask over its box, its centre on an
// LED: 1 edge, 2 body, plus 4 along the lit top.
function shape(C, th) {
  const L = C[2], T = C[3], ox = -ceil(L + T) - 1, oy = -ceil(2 * T * th) - 1, w = 1 - 2 * ox, h = 2 - oy + ceil(T);
  const m = new Uint8Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const px = ox + i + 0.5, py = oy + j + 0.5, d = puff(C, px, py, th);
      if (d <= 0) m[j * w + i] = (d > -1.2 ? 1 : 2) | (puff(C, px, py - 1.3, th) > 0 ? 4 : 0);
    }
  C.mask = { th, ox, oy, w, h, m };
}

// Two poses for the one skeleton, facing right: a man standing and a wolf on
// four legs. Points are LEDs on the panel, angles in radians (0 right, pi/2
// down), radii in LEDs. The legs are placed by where the feet go, so the
// change keeps them on the rock. hip: where it is; spine: the back's angle
// and length; rad: the body's radius at hip, middle and shoulder; head: angle
// and distance from the shoulder; arm: where the arm leaves the shoulder;
// up, fore: arm bones; wrists and hand: where the hands go and the hand
// itself; toes and foot: where the toes go and the foot back to the ankle.
const MAN = {
  hip: [31.5, 80.5], spine: -1.5, len: 18, rad: [3.4, 3.3, 3.9], chest: 0,
  head: [-1.38, 7.8], face: 0.05, neck: [1.6, 1.6],
  arm: [0.3, 1.5], up: 9.5, fore: 8.5, wrists: [[2.6, 16.6], [-2.4, 16.2]], hand: [[0.7, 3.2], [-0.3, 3.2]], ar: [1.6, 1.25, 1],
  thigh: 12, shin: 11.5, toes: [[36.5, G], [33, G]], foot: [[4.3, 1.4], [4.3, 1.4]], lr: [2.4, 1.7, 1.15],
};
const WOLF = {
  hip: [21, 82.5], spine: -0.07, len: 21, rad: [4.2, 4.4, 5.4], chest: 4.8,
  head: [-0.8, 10.5], face: 0.15, neck: [3.9, 2.7],
  arm: [1.5, 2.5], up: 9, fore: 10, wrists: [[46.5, 101], [40.5, 101]], hand: [[1.6, 2.8], [1.6, 2.8]], ar: [2.2, 1.35, 1.05],
  thigh: 9.5, shin: 9, toes: [[25.5, G], [18.5, G]], foot: [[2.5, 6.6], [2.5, 6.6]], lr: [3.2, 1.6, 1.05],
};

// Two-bone reach from (ax, ay) toward (tx, ty); bend 1 puts the middle joint
// on the clockwise side. Writes joint and end into out.
function reach(ax, ay, tx, ty, l1, l2, bend, out) {
  const dx = tx - ax, dy = ty - ay, d = cl(hypot(dx, dy), abs(l1 - l2) + 0.01, l1 + l2 - 0.01), a = atan2(dy, dx);
  const th = acos(cl((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), a1 = a + bend * th;
  out[0] = ax + l1 * cos(a1);
  out[1] = ay + l1 * sin(a1);
  const b = atan2(ty - out[1], tx - out[0]);
  out[2] = out[0] + l2 * cos(b);
  out[3] = out[1] + l2 * sin(b);
}

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, clouds: 0, moon: 0.06, key: "", m: 0, lift: 0, bankX: 0, howling: false, night: 0,
    rings: [], ringClock: 0, P: null,
    base: new Float32Array(N * 3), mc: new Float32Array(N), nm: new Float32Array(N), buf: new Float32Array(N * 3), sil: new Float32Array(N), ra: new Float32Array(N), info: { u: 0, v: 0 },
  };
}

// Where the story is at story time t of the night: the change m (0 man, 1
// wolf), the howl's lift and the bank's offset from the moon.
function story(S) {
  const t = S.t % NIGHT;
  S.m = t < 10.5 ? ease((t - 0.4) / 4) : 1 - ease((t - 10.5) / 3);
  S.lift = ease((t - 5) / 0.6) - ease((t - 8.6) / 0.6);
  S.bankX = t < 9 ? -130 * ease(t / 5) : 130 * (1 - ease((t - 9) / 3));
  S.howling = t > 5.5 && t < 8.6;
  S.night = t;
}

// The skeleton at the change m, each part on its own schedule: the back bends
// first and arches most half way, the arms and legs follow, then the face,
// and last the ears, tail and fur.
function pose(S) {
  const m = S.m, l = S.lift, sp = ease(m / 0.6), fl = ease((m - 0.12) / 0.6), hl = ease((m - 0.2) / 0.6);
  const hd = ease((m - 0.3) / 0.5), late = ease((m - 0.5) / 0.45), bulk = ease((m - 0.1) / 0.7);
  // A shudder while it changes.
  const sh = sin(PI * m) * sin(S.t * 23) * 0.05, A = MAN, B = WOLF;
  const P = (S.P = S.P || { leg: [[0, 0, 0, 0], [0, 0, 0, 0]], arm: [[0, 0, 0, 0], [0, 0, 0, 0]], ft: [[0, 0], [0, 0]], hn: [[0, 0], [0, 0]], tail: new Float32Array(10) });
  P.hd = hd;
  P.late = late;
  P.fur = ease((m - 0.35) / 0.6);
  P.bulk = bulk;
  const hx = lerp(A.hip[0], B.hip[0], sp), hy = lerp(A.hip[1], B.hip[1], hl) - 1.2 * l;
  const sa = lerp(A.spine, B.spine, sp) + sh - 0.12 * l, ln = lerp(A.len, B.len, sp);
  const arch = 4.5 * sin(PI * cl(m / 0.85, 0, 1)) + 1.2 * bulk;
  P.hip = [hx, hy];
  P.sh = [hx + ln * cos(sa), hy + ln * sin(sa)];
  // The middle of the back bulges away from the belly: behind him while he
  // stands, up once the back is level.
  P.mid = [hx + 0.5 * ln * cos(sa) + arch * sin(sa), hy + 0.5 * ln * sin(sa) - arch * cos(sa)];
  P.rad = A.rad.map((r, i) => lerp(r, B.rad[i], bulk));
  P.chest = lerp(A.chest, B.chest, bulk);
  // The head: up and back in the howl, thrown back once in the middle of the change.
  const throwBack = 0.5 * sin(PI * cl((m - 0.25) / 0.5, 0, 1));
  const ha = lerp(A.head[0], B.head[0], hd) - 0.5 * l - throwBack, hl2 = lerp(A.head[1], B.head[1], hd);
  P.head = [P.sh[0] + hl2 * cos(ha), P.sh[1] + hl2 * sin(ha)];
  P.face = lerp(A.face, B.face, hd) - 1.25 * l - 0.9 * throwBack;
  P.neck = A.neck.map((r, i) => lerp(r, B.neck[i], bulk));
  P.jaw = 0.35 * ease((S.night - 5.4) / 0.3) * (1 - ease((S.night - 8.5) / 0.3)) + 0.25 * throwBack;
  // Arms to forelegs: the wrists go from beside the thighs to the rock ahead.
  const ax = P.sh[0] + lerp(A.arm[0], B.arm[0], fl), ay = P.sh[1] + lerp(A.arm[1], B.arm[1], fl) - 1.5 * l;
  P.ar = A.ar.map((r, i) => lerp(r, B.ar[i], fl));
  for (let k = 0; k < 2; k++) {
    const wa = A.wrists[k], wb = B.wrists[k];
    const tx = lerp(P.sh[0] + wa[0], wb[0], fl), ty = lerp(P.sh[1] + wa[1], wb[1], fl) + sh * 20 * (k ? -1 : 1);
    reach(ax, ay, tx, ty, lerp(A.up, B.up, fl), lerp(A.fore, B.fore, fl), 1, P.arm[k]);
    const hv = A.hand[k], wv = B.hand[k];
    P.hn[k] = [P.arm[k][2] + lerp(hv[0], wv[0], fl), P.arm[k][3] + lerp(hv[1], wv[1], fl)];
  }
  P.root = [ax, ay];
  // Legs: the man's foot becomes the wolf's long hind foot, the heel rising to a hock.
  P.lr = A.lr.map((r, i) => lerp(r, B.lr[i], hl));
  for (let k = 0; k < 2; k++) {
    const ta = A.toes[k], tb = B.toes[k], fa = A.foot[k], fb = B.foot[k];
    const tx = lerp(ta[0], tb[0], hl), fx = lerp(fa[0], fb[0], hl), fy = lerp(fa[1], fb[1], hl);
    P.ft[k] = [tx, G];
    reach(hx, hy + 1, tx - fx, G - fy, lerp(A.thigh, B.thigh, hl), lerp(A.shin, B.shin, hl), -1, P.leg[k]);
  }
  // The box the figure lies in: every joint, the muzzle's tip and the ears.
  const fc = cos(P.face), fs = sin(P.face), pts = [P.hip, P.mid, P.sh, P.head, P.root, ...P.hn, ...P.ft, [P.head[0] + 10 * fc, P.head[1] + 10 * fs], [P.head[0] + 7 * fs, P.head[1] - 7 * fc]];
  for (const a of [...P.arm, ...P.leg]) pts.push([a[0], a[1]], [a[2], a[3]]);
  let x0 = 99, x1 = -99, y0 = 999, y1 = -99;
  for (const [x, y] of pts) (x0 = min(x0, x)), (x1 = max(x1, x)), (y0 = min(y0, y)), (y1 = max(y1, y));
  P.box = [x0 - 6, x1 + 6, y0 - 6, y1 + 3];
  // The tail grows from the rump and hangs, swaying.
  const T = P.tail;
  let x = hx - 2.5 * sp, y = hy - 1, a = 2.45;
  T[0] = x;
  T[1] = y;
  for (let i = 1; i < 5; i++) {
    a -= 0.12 + 0.05 * sin(S.t * 2.1 + i);
    x += 4.2 * late * cos(a);
    y += 4.2 * late * sin(a);
    T[2 * i] = x;
    T[2 * i + 1] = y;
    P.box[0] = min(P.box[0], x - 4);
  }
}

// The body as a list of tapered capsules, 11 numbers each: two ends, two
// radii, how softly it joins what came before (0 a hard union), and a box
// beyond which it cannot change the field where it matters, within 3 LEDs of
// the edge.
const PART = 11, MAXP = 24;
function parts(S) {
  const P = S.P, L = (S.parts = S.parts || new Float32Array(PART * MAXP));
  let n = 0;
  const add = (ax, ay, bx, by, ra, rb, k) => {
    const o = PART * n++, r = max(ra, rb) + 3 + k;
    L.set([ax, ay, bx, by, ra, rb, k, min(ax, bx) - r, max(ax, bx) + r, min(ay, by) - r, max(ay, by) + r], o);
  };
  const [rh, rm, rs] = P.rad;
  add(P.hip[0], P.hip[1], P.mid[0], P.mid[1], rh, rm, 0);
  add(P.mid[0], P.mid[1], P.sh[0], P.sh[1], rm, rs, 2);
  if (P.chest > 0.1) add(P.sh[0] + 1.5, P.sh[1] + 2.6, P.sh[0] + 1.5, P.sh[1] + 2.6, P.chest, P.chest, 2);
  add(P.sh[0], P.sh[1], P.head[0], P.head[1], P.neck[0], P.neck[1], 1.5);
  for (let k = 0; k < 2; k++) {
    const a = P.arm[k], r = P.ar;
    add(P.root[0] - k * 1.5, P.root[1], a[0], a[1], r[0] + P.bulk * 0.8, r[1], 1.2);
    add(a[0], a[1], a[2], a[3], r[1], r[2], 0);
    add(a[2], a[3], P.hn[k][0], P.hn[k][1], r[2], 0.8 + 0.2 * P.late, 0);
  }
  for (let k = 0; k < 2; k++) {
    const g = P.leg[k], r = P.lr;
    add(P.hip[0] - k, P.hip[1] + 1, g[0], g[1], r[0] + P.bulk, r[1], 1.5);
    add(g[0], g[1], g[2], g[3], r[1], r[2], 0);
    add(g[2], g[3], P.ft[k][0], P.ft[k][1] - 0.6, r[2], 0.9, 0);
  }
  if (P.late > 0.02) {
    const T = P.tail, f = (i) => 1.2 + 1.3 * P.late * sin((PI * (i + 0.6)) / 4.6);
    for (let i = 0; i < 4; i++) add(T[2 * i], T[2 * i + 1], T[2 * i + 2], T[2 * i + 3], f(i), f(i + 1), 1);
  }
  S.np = n;
  P.fc = cos(P.face);
  P.fs = sin(P.face);
  P.jc = cos(P.jaw);
  P.js = sin(P.jaw);
}

// The figure's distance field at (px, py).
function figure(S, px, py) {
  const P = S.P, info = S.info, L = S.parts;
  let d = 99;
  for (let i = 0, o = 0; i < S.np; i++, o += PART) {
    if (px < L[o + 7] || px > L[o + 8] || py < L[o + 9] || py > L[o + 10]) continue;
    const c = capsule(px, py, L[o], L[o + 1], L[o + 2], L[o + 3], L[o + 4], L[o + 5]), k = L[o + 6];
    d = k > 0 && d < 50 ? smin(d, c, k) : min(d, c);
  }
  // The head in its own frame (u along the face, v down): the man's head and
  // the wolf's head blended as distance fields, so the muzzle grows out of the
  // face and the ears rise out of the skull.
  const qx = px - P.head[0], qy = py - P.head[1], u = qx * P.fc + qy * P.fs, v = -qx * P.fs + qy * P.fc;
  info.u = u;
  info.v = v;
  if (u > -9 && u < 14 && v > -12 && v < 8) {
    const man = min(circle(u, v, 0, -0.3, 3.5), capsule(u, v, 2.4, 0.6, 3.9, 1.2, 1, 0.7), capsule(u, v, 0.5, 2.2, 2.6, 2.8, 1.4, 0.9));
    let wolf = smin(circle(u, v, -0.5, -0.4, 3.4), capsule(u, v, 1.5, -0.6, 9, 0.5, 2.3, 1.15), 1.2);
    const ju = 1.5 + (u - 1.5) * P.jc + (v - 1.6) * P.js, jv = 1.6 - (u - 1.5) * P.js + (v - 1.6) * P.jc;
    wolf = smin(wolf, capsule(ju, jv, 1.5, 1.6, 8, 1.8, 1.5, 0.75), 0.8);
    // Ears grow out of the skull late in the change, laid back in the howl.
    const e = P.late, back = (0.9 + 0.4 * S.lift) * e, up = 6.4 * e;
    wolf = min(wolf, capsule(u, v, -2, -1.6, -2 - back, -1.6 - up, 1.5, 0.15), capsule(u, v, 0.1, -1.6, 0.1 - back, -1.6 - up, 1.5, 0.15));
    d = min(d, man + (wolf - man) * P.hd);
  }
  // Fur: a ragged edge that grows with the change.
  if (P.fur > 0 && d > -2 && d < 2) d -= P.fur * 0.8 * max(0, sin(px * 1.9 + py * 0.8) * sin(py * 1.7 - px * 0.6) + 0.2);
  return d;
}

// Sky, moon, glow, ridge and rock, kept until Hue or Moon move. mc is 1 where
// the moon shows, for the rim light and the rings; nm is how near the moon an
// LED is (1 on it, 0 from 14 LEDs off), for lighting the clouds.
function background(S, R) {
  const { base, mc, nm } = S, sky = 0.76 - 0.42 * S.hue, halo = hsv(sky, 0.85, 1);
  for (let p = 0; p < N; p++) {
    const x = p % W, y = floor(p / W), dx = x + 0.5 - MX, dy = y + 0.5 - MY, r = hypot(dx, dy);
    const t = round(12 * cl(y / G, 0, 1) ** 1.3) / 12;
    let [cr, cg, cb] = hsv(sky, 0.78, 0.05 + 0.36 * t);
    // The halo: half moonlight, half the sky's own colour at full strength.
    const gl = r > R ? round((0.42 * Math.exp(-(r - R) / 5) + 0.12 * Math.exp(-(r - R) / 18)) * 20) / 20 : 0;
    cr += (MOON[0] + halo[0]) * gl * 0.4;
    cg += (MOON[1] + halo[1]) * gl * 0.35;
    cb += (MOON[2] + halo[2]) * gl * 0.35;
    let moon = 0;
    if (r < R) {
      let e = 9;
      for (const [sx, sy, rx, ry] of SEAS) e = min(e, ((dx / R - sx) / rx) ** 2 + ((dy / R - sy) / ry) ** 2 + 0.2 * sin(dx * 0.9 + dy));
      const k = e < 1 ? 0.84 : e < 1.5 ? 0.92 : 1;
      [cr, cg, cb] = [MOON[0] * k, MOON[1] * k, MOON[2] * k];
      moon = 1;
    }
    // The far ridge across the moon's foot, then the rock, its top moonlit.
    if (y + 0.5 > RIDGE[x]) {
      [cr, cg, cb] = hsv(sky, 0.7, y + 0.5 - RIDGE[x] < 1.2 ? 0.2 : 0.12);
      moon = 0;
    }
    if (y + 0.5 > CREST[x]) {
      // Black rock, its top edge moonlit, split by three long cracks.
      const top = y + 0.5 - CREST[x] < 1.3, dy = y + 0.5 - G;
      let crack = false;
      for (const c of [19, 34, 47]) if (abs(x + 0.5 - c + 0.55 * dy - 2 * sin(dy * 0.3)) < 0.5 && dy > 2 && dy < 20) crack = true;
      const flat = CREST[x] - G < 1.5;
      [cr, cg, cb] = top ? (flat ? [0.42, 0.37, 0.3] : [0.16, 0.13, 0.15]) : crack ? [0.09, 0.07, 0.11] : [0.025, 0.015, 0.04];
      moon = 0;
    }
    mc[p] = moon;
    nm[p] = moon ? 1 : y + 0.5 > RIDGE[x] ? 0 : round(cl(1 - (r - R) / 14, 0, 1) * 4) / 4;
    base[3 * p] = cr;
    base[3 * p + 1] = cg;
    base[3 * p + 2] = cb;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.clouds = cl(k[2], 0, 1);
  S.moon = cl(k[3], -1, 1);
  const ds = (d * S.speed) / 2;
  S.t += ds;
  story(S);
  pose(S);
  parts(S);
  // Rings leave the nose every 0.3 s while it holds the note, and spread.
  if (S.howling && (S.ringClock -= ds) <= 0) {
    S.ringClock = 0.3;
    const P = S.P, ca = cos(P.face), sa = sin(P.face);
    S.rings.push({ x: P.head[0] + 9.5 * ca - 0.5 * sa, y: P.head[1] + 9.5 * sa + 0.5 * ca, a: P.face, r: 1 });
  }
  for (const r of S.rings) r.r += 20 * ds;
  S.rings = S.rings.filter((r) => r.r < 56);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.P) return;
  const R = 27 + 5 * S.moon, key = `${S.hue.toFixed(3)} ${R.toFixed(2)}`;
  if (key !== S.key) {
    S.key = key;
    background(S, R);
  }
  const { base, mc, nm, buf, sil } = S, sky = 0.76 - 0.42 * S.hue;
  buf.set(base);
  // Stars twinkle in the high sky.
  for (const [p, ph] of STARS) {
    const v = 0.35 + 0.3 * sin(S.t * 2.3 + ph);
    if (buf[3 * p + 2] < 0.3) buf.fill(v, 3 * p, 3 * p + 3);
  }
  // Clouds: dark bodies that let some of the moon through, their edges lit
  // where they cross it or pass near it.
  const nb = 4 + round(3 * S.clouds), nw = 2 + round(4 * S.clouds), op = 0.55 + 0.37 * S.clouds;
  const body = hsv(sky, 0.35, 0.27), lit = [0.72, 0.66, 0.54];
  const cloud = (C, cx, cy, a, th) => {
    if (!C.mask || C.mask.th !== th) shape(C, th);
    const { ox, oy, w, h, m } = C.mask, x0 = round(cx) + ox, y0 = round(cy) + oy;
    if (x0 >= W || x0 + w <= 0) return;
    for (let j = 0; j < h; j++) {
      const y = y0 + j;
      if (y < 0 || y > G) continue;
      for (let i = 0; i < w; i++) {
        const x = x0 + i, k = m[j * w + i];
        if (!k || x < 0 || x >= W) continue;
        const p = y * W + x, o = 3 * p, near = nm[p], rim = k & 4 ? 0.25 + 0.6 * near : 0, al = k & 1 ? a * 0.75 : a;
        for (let c = 0; c < 3; c++) buf[o + c] += (body[c] + 0.12 * near + (lit[c] - body[c]) * rim - buf[o + c]) * al;
      }
    }
  };
  const tb = round((0.8 + 0.45 * S.clouds) * 20) / 20, tw = round((0.7 + 1.1 * S.clouds) * 20) / 20;
  for (let i = 0; i < nb; i++) cloud(BANK[i], MX + BANK[i][0] + S.bankX, MY + BANK[i][1], op, tb);
  for (let i = 0; i < nw; i++) {
    const C = WISPS[i], span = W + 2 * C[2] + 24, x = (((C[1] * span - S.t * (2.5 + i * 0.4)) % span) + span) % span - C[2] - 12;
    cloud(C, x, C[0], op * 0.8, tw);
  }
  // Rings of the howl: arcs about the muzzle's line, pale on the sky and a
  // cool shadow on the moon, fading as they spread.
  const ra = S.ra, hit = [];
  for (const g of S.rings) {
    const fade = 1 - g.r / 56;
    for (const rad of [g.r - 0.4, g.r + 0.4]) {
      const n = ceil(3 * rad) + 2;
      for (let i = 0; i < n; i++) {
        const th = -0.75 + (1.5 * i) / (n - 1), x = floor(g.x + rad * cos(g.a + th)), y = floor(g.y + rad * sin(g.a + th));
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const p = y * W + x, a = fade * (1 - abs(th) / 0.75) * 0.9;
        if (!ra[p]) hit.push(p);
        ra[p] = max(ra[p], a);
      }
    }
  }
  for (const p of hit) {
    const o = 3 * p, a = ra[p], on = mc[p] > 0;
    buf[o] += ((on ? 0.42 : 0.6) - buf[o]) * a;
    buf[o + 1] += ((on ? 0.66 : 1) - buf[o + 1]) * a;
    buf[o + 2] += ((on ? 0.5 : 0.7) - buf[o + 2]) * a;
    ra[p] = 0;
  }
  // The figure, black. Its edge takes a rim of moonlight one LED wide, but
  // only where the figure is thicker than that, so a thin leg stays black.
  const P = S.P, bx0 = max(1, floor(P.box[0])), bx1 = min(W - 1, ceil(P.box[1])), by0 = max(1, floor(P.box[2])), by1 = min(G + 1, ceil(P.box[3]));
  let eyeP = -1, eyeU = 9;
  sil.fill(1);
  for (let y = by0; y < by1; y++)
    for (let x = bx0; x < bx1; x++) {
      const p = y * W + x, dd = (sil[p] = figure(S, x + 0.5, y + 0.5));
      // The eye: the LED nearest its place in the head's frame.
      const eu = S.info.u - 1.3, ev = S.info.v + 1.1, e2 = eu * eu + ev * ev;
      if (dd < -0.6 && e2 < eyeU) (eyeU = e2), (eyeP = p);
    }
  for (let y = by0; y < by1; y++)
    for (let x = bx0; x < bx1; x++) {
      const p = y * W + x, dd = sil[p];
      if (dd >= 0) continue;
      const deep = min(sil[p - 1], sil[p + 1], sil[p - W], sil[p + W]) < -1.3;
      const o = 3 * p, rim = dd > -1 && deep ? (mc[p] > 0 ? 0.42 : 0.3) : 0;
      buf[o] = 0.02 + MOON[0] * rim;
      buf[o + 1] = 0.012 + MOON[1] * rim;
      buf[o + 2] = 0.03 + MOON[2] * rim;
    }
  // The eye kindles amber as the face changes.
  if (eyeP >= 0 && P.hd > 0.15) {
    const e = ease((P.hd - 0.15) / 0.4);
    buf[3 * eyeP] = e;
    buf[3 * eyeP + 1] = 0.72 * e;
    buf[3 * eyeP + 2] = 0.1 * e;
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) display.setPixel(x, y, q4(buf[3 * p]), q4(buf[3 * p + 1]), q4(buf[3 * p + 2]));
}
