// ===== Patternflow pattern =====
// Title:   Witch Moon
// Family:  halloween
// Idea:    A huge full moon hangs in the upper middle of a purple night, ragged clouds drift across it with their edges lit by its light, bare branches sway along the bottom, and every so often a witch on a broomstick, cloak and bristles fluttering and a trail of green sparks behind her, flies across the face of the moon.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 42
// Round:   42
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Clouds=0..1, Flights=0..1
//
// Knob 1: Hue. The moon's tint, and the light on the cloud edges with it. At 0 harvest orange, at 0.25 amber, at 0.5 bone white, at 0.75 a ghostly green and at 1 lilac.
// Knob 2: Speed. The clock of the whole scene. At 2 the near clouds drift 7 LEDs a second and the far ones 3.5, a branch sways once in 3 seconds, and a witch flies 18 LEDs a second and is in sight for about 7 seconds; at 0.2 all of it is ten times slower, at 3 half as fast again.
// Knob 3: Clouds. At 0 three near and three far cloud banks take turns across the sky and a fifth of the moon is under cloud on average; at 0.5 six of each and 43% of the moon is hidden; at 1 eight of each, 30% longer and 60% thicker, and two thirds of it. Far banks let 30% of the light behind them through, near ones none.
// Knob 4: Flights. How many witches fly together and how often. Below 0.25 one witch, then two, three and from 0.75 four, the others smaller and ahead of the last in a V. The next flight leaves 8 seconds after the last one has gone at 0 and 2 seconds after at 1 (at Speed 2). The first flight leaves at once and its middle crosses the middle of the moon at 3.7 seconds.
// Buttons: K1 tap sends the next flight at once, or the moment the one in the air has gone.

const W = 64, H = 128;
const { floor, min, max, sqrt, abs, sin, cos, exp, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// A fixed hash, so the clouds, stars and trees are the same on every run.
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// The moon: centre and radius in LEDs.
const MX = 32, MY = 42, MR = 24;
// Moon tints along Hue: harvest orange, amber, bone white, ghost green, lilac.
const TINTS = [[1, 0.57, 0.16], [1, 0.79, 0.36], [0.94, 0.9, 0.8], [0.69, 1, 0.6], [0.8, 0.67, 1]];

// Value noise on a 64 x 64 table that wraps, for ragged cloud edges and
// the shores of the moon's seas.
const NT = new Float32Array(64 * 64);
for (let i = 0; i < NT.length; i++) NT[i] = hash(i * 7 + 3);
function vnoise(x, y) {
  const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const i0 = xi & 63, i1 = (xi + 1) & 63, j0 = (yi & 63) << 6, j1 = ((yi + 1) & 63) << 6;
  const a = NT[j0 + i0], b = NT[j0 + i1], c = NT[j1 + i0], d = NT[j1 + i1];
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// Cloud streaks in two layers, both drifting left: far ones thin, slow and
// letting 30% of what is behind them through, near ones thicker, faster and
// dark. Each is [row, length, thickness, where it is at the start]; the
// Clouds knob brings in more of each list and fattens them. Speeds are
// LEDs a second at Speed 2.
const LAYERS = [
  { v: 3.5, body: [0.1, 0.065, 0.15], op: 0.7, list: [[28, 56, 6, 40], [64, 60, 6, 0], [46, 48, 5, 100], [14, 44, 5, 75], [36, 52, 6, 130], [72, 40, 5, 60], [54, 50, 6, 20], [20, 46, 5, 115]] },
  { v: 7, body: [0.04, 0.028, 0.075], op: 1, list: [[61, 46, 10, 74], [32, 38, 9, 18], [70, 52, 11, 110], [84, 44, 10, 40], [42, 34, 8, 128], [24, 30, 8, 95], [60, 40, 9, -10], [92, 50, 11, 130]] },
];
const CLOUDS = [];
LAYERS.forEach((L, l) =>
  L.list.forEach(([y, len, th, x], i) => {
    const puffs = [];
    for (let k = 0; k < 5; k++) {
      const hs = (n) => hash(l * 1000 + i * 50 + k * 7 + n);
      puffs.push([(k + 0.5) / 5 - 0.5 + (hs(1) - 0.5) / 10, (0.75 + 0.5 * hs(2)) / 5, 0.55 + 0.45 * sin((PI * (k + 0.5)) / 5) * hs(3)]);
    }
    CLOUDS.push({ l, i, y, len, th, x, puffs, seed: l * 13 + i * 5.7 });
  }),
);

// The moon's face, fixed and drawn in four tones like pixel art: bright
// highland, the shore of a sea, the seas and crater floors. Six seas are
// ellipses with wobbly edges, placed roughly where they are on the Moon;
// a ring at the limb is one tone darker, and each crater is a dark floor
// with a lit rim on its lower right.
const TONES = [1, 0.88, 0.76, 0.66];
const SEAS = [[-7, -8, 8, 6], [6, -10, 6, 5], [10, -2, 6, 5], [-12, 4, 6, 9], [3, 7, 5, 4], [15, 8, 3.5, 3]];
const CRATERS = [[-4, 15, 2.6], [14, -14, 2.2], [-16, -7, 2], [9, 16, 2.2], [-1, -18, 1.8]];
const FACE = new Float32Array(W * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const dx = x + 0.5 - MX, dy = y + 0.5 - MY, r = sqrt(dx * dx + dy * dy);
    if (r > MR + 1) continue;
    let e = 9;
    for (const [cx, cy, rx, ry] of SEAS) e = min(e, ((dx - cx) / rx) ** 2 + ((dy - cy) / ry) ** 2);
    e += 0.6 * (vnoise(x / 3.1 + 7, y / 3.1 + 2) - 0.5);
    let tone = e < 1 ? 2 : e < 1.35 ? 1 : 0;
    if (r > MR - 2.2) tone++;
    for (const [cx, cy, cr] of CRATERS) {
      const qx = dx - cx, qy = dy - cy, d = sqrt(qx * qx + qy * qy);
      if (d < cr) tone = max(tone + 1, 2);
      else if (d < cr + 1.2 && qx + qy > 0.6 * cr) tone = 0;
    }
    FACE[y * W + x] = TONES[min(3, tone)];
  }

// The sky by row: deep blue-violet at the top, a purple glow at the horizon.
const SKY = [[0, 0.02, 0.016, 0.08], [60, 0.065, 0.032, 0.135], [98, 0.19, 0.065, 0.25], [120, 0.33, 0.11, 0.33]];
const SKYROW = new Float32Array(H * 3);
for (let y = 0; y < H; y++) {
  let k = 0;
  while (k < SKY.length - 2 && y > SKY[k + 1][0]) k++;
  const [y0, r0, g0, b0] = SKY[k], [y1, r1, g1, b1] = SKY[k + 1], t = sm(0, 1, cl((y - y0) / (y1 - y0), 0, 1));
  SKYROW[3 * y] = r0 + (r1 - r0) * t;
  SKYROW[3 * y + 1] = g0 + (g1 - g0) * t;
  SKYROW[3 * y + 2] = b0 + (b1 - b0) * t;
}

// Stars in the dark upper sky, clear of the moon's glow.
const STARS = [];
for (let i = 0; STARS.length < 14 && i < 400; i++) {
  const x = floor(hash(i * 3 + 101) * W), y = floor(hash(i * 3 + 102) * 80);
  if ((x + 0.5 - MX) ** 2 + (y + 0.5 - MY) ** 2 < (MR + 9) ** 2) continue;
  STARS.push([x, y, hash(i * 3 + 103) * 6.28]);
}

// The trees: two bare trees grown from fixed numbers. Each branch is
// [parent, angle to its parent, length, start radius, end radius, depth,
// sway phase]; angle 0 is straight up.
const TREES = [];
function grow(root, x, y, angle, len, r, depth, maxD, seed) {
  const id = TREES.length;
  TREES.push({ parent: root, x, y, a: angle, len, r0: r, r1: max(0.5, r * 0.66), depth, ph: hash(seed) * 6.28 });
  if (depth >= maxD) return;
  const kids = depth < 2 ? 2 : hash(seed + 1) < 0.65 ? 2 : 1;
  for (let k = 0; k < kids; k++) {
    const s = seed * 5 + k * 17 + 3, side = kids === 1 ? (hash(s) < 0.5 ? -1 : 1) : k === 0 ? -1 : 1;
    const da = side * (0.3 + 0.45 * hash(s + 1)) + (hash(s + 2) - 0.5) * 0.3;
    grow(id, 0, 0, da, len * (0.62 + 0.22 * hash(s + 3)), max(0.5, r * 0.66), depth + 1, maxD, s + 9);
  }
}
grow(-1, 3, 131, 0.32, 24, 3.6, 0, 6, 5);
grow(-1, 62, 131, -0.42, 18, 2.8, 0, 5, 77);

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, clouds: 0, flights: 0.06,
    // Scene clock (seconds at Speed 2; the clouds are placed from it), the
    // flight under way and the wait for the next, sparks behind the brooms.
    t: 0, flight: null, wait: 0, nflight: 0, sparks: [],
    rgb: new Float32Array(W * H * 3), mask: new Float32Array(W * H), tint: [1, 0.6, 0.2],
    bx: new Float32Array(TREES.length), by: new Float32Array(TREES.length), ex: new Float32Array(TREES.length), ey: new Float32Array(TREES.length),
    begun: false, queued: false,
  };
}

// A flight: direction alternates; the leader's centre runs from 35 LEDs off
// one side to 35 off the other, rising gently, at 18 LEDs a second at Speed 2.
function launch(S) {
  const dir = S.nflight % 2 === 0 ? 1 : -1, n = 1 + min(3, floor(4 * S.flights));
  // The flight is placed by its middle, so whatever the number of witches
  // the group is centred on the moon 3.7 s after it leaves (at Speed 2).
  let mid = 0;
  for (let j = 0; j < n; j++) mid += COVEN[j][0] / n;
  S.flight = { dir, age: 0, n, mid };
  S.nflight++;
}
// Places of the witches in a flight, as [LEDs ahead of the last one, LEDs
// up or down, scale]: the last is the biggest, the others fly ahead of her
// in a V, smaller as if farther off.
const COVEN = [[0, 0, 0.88], [22, -19, 0.7], [22, 19, 0.72], [44, 0, 0.64]];
const FLY = 18, MARGIN = 35;

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.clouds = cl(k[2], 0, 1);
  S.flights = cl(k[3], 0, 1);
  // The first flight leaves at once, with as many witches as the knob asks.
  if (!S.begun) {
    launch(S);
    S.begun = true;
  }
  const ds = (d * S.speed) / 2;
  S.t += ds;
  // A tap sends the next flight at once, or straight after the one in the air.
  if (input.btnPressed && input.btnPressed[0]) {
    if (S.flight) S.queued = true;
    else launch(S);
  }
  if (S.flight) {
    const f = S.flight;
    f.age += ds;
    const span = W + 2 * MARGIN + f.mid;
    if (f.age * FLY > span) {
      S.flight = null;
      S.wait = S.queued ? 0 : 8 - 6 * S.flights;
      S.queued = false;
    } else {
      // Sparks from each broom's bristles, 40 a second each.
      for (let j = 0; j < f.n; j++) {
        const w = witchPlace(S, f, j), bx = w.x - w.dir * 20 * w.s, by = w.y + 2 * w.s;
        for (let e = ds * 40; e > 0 && S.sparks.length < 400; e--) {
          if (e < 1 && Math.random() > e) break;
          S.sparks.push({ x: bx + (Math.random() - 0.5) * 4, y: by + (Math.random() - 0.5) * 4, vx: -w.dir * (1 + 4 * Math.random()), vy: 1.5 + 4 * Math.random(), life: 1, ph: Math.random() * 6.28 });
        }
      }
    }
  } else {
    S.wait -= ds;
    if (S.wait <= 0) launch(S);
  }
  for (const p of S.sparks) {
    p.x += p.vx * ds;
    p.y += p.vy * ds;
    p.life -= ds / 2;
  }
  S.sparks = S.sparks.filter((p) => p.life > 0);
}

// Witch j of a flight: centre, scale, direction, tilt. She climbs 0.22 LEDs
// for each LED she flies and swoops 3.5 LEDs up and down every 2.6 s.
function witchPlace(S, f, j) {
  const [ahead, up, s] = COVEN[j], run = f.age * FLY - MARGIN + ahead - f.mid, x = f.dir > 0 ? run : W - run;
  const ph = f.age * 2.4 + j * 0.5, y = MY + 1 + up - 0.22 * (run - MX) + 3.5 * sin(ph);
  return { x, y, s, dir: f.dir, tilt: f.dir * (-0.14 + 0.28 * cos(ph)) };
}

// Signed distance to a capsule and to a polygon, in the witch's own units.
function capsule(px, py, ax, ay, bx, by, r) {
  const ex = bx - ax, ey = by - ay, qx = px - ax, qy = py - ay, u = cl((qx * ex + qy * ey) / (ex * ex + ey * ey), 0, 1);
  return sqrt((qx - u * ex) ** 2 + (qy - u * ey) ** 2) - r;
}
function poly(px, py, v) {
  let dd = 1e9, s = 1;
  for (let i = 0, j = v.length - 2; i < v.length; j = i, i += 2) {
    const ex = v[j] - v[i], ey = v[j + 1] - v[i + 1], wx = px - v[i], wy = py - v[i + 1];
    const u = cl((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1), bx = wx - ex * u, by = wy - ey * u;
    dd = min(dd, bx * bx + by * by);
    const c1 = py >= v[i + 1], c2 = py < v[j + 1], c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * sqrt(dd);
}

// The witch as one shape, facing +x with y down, the seat on the broom at
// the origin; fl is her own flutter clock. Generic: pointed hat with a brim
// and a bent tip, hair and cloak streaming back, a hooked nose, one arm to
// the broom, a boot hanging below it and a fan of bristles.
function witchShapes(fl) {
  const f = (k, a) => a * sin(fl * 9 + k * 1.9);
  return [
    ["c", -11, 1.2, 15, -1.2, 0.9],
    ["p", [-10, 0, -10, 2.4, -18.5, 6 + f(1, 1), -21, 3.5 + f(2, 1.2), -21, 0 + f(3, 1.2), -18.5, -2.5 + f(4, 1)]],
    ["p", [4.5, -9, 6, -2, 5, 1.5, -2, 1.5, -8 + f(5, 1), -1 + f(6, 1.4), -12.5 + f(7, 1.2), -4 + f(8, 1.8), -5, -6.5, 1, -9.5]],
    ["c", 3, 1, 6.5, 5.5, 1.2],
    ["c", 6.5, 5.5, 9.5, 5, 0.9],
    ["c", 3.5, -7, 9.5, -1.5, 1],
    ["c", 3.5, -11.5, 3.5, -11.5, 2.4],
    ["p", [5.5, -12.3, 8.4, -10.6, 5.6, -10.4]],
    ["c", 2, -11, -3.5 + f(9, 0.8), -8.5 + f(10, 0.8), 1],
    ["c", 2, -10, -4.5 + f(11, 0.8), -6.2 + f(12, 0.8), 0.8],
    ["c", -2, -13.6, 8.8, -14.6, 0.75],
    ["p", [0.5, -14, 6.5, -14.6, 3.8, -19.5, -1.5 + f(13, 0.6), -23 + f(14, 0.4), 2, -19]],
  ];
}

function drawWitch(S, w, fl) {
  const shapes = witchShapes(fl), mask = S.mask, c = cos(w.tilt), s = sin(w.tilt), R = 24 * w.s;
  for (let y = max(0, floor(w.y - R)); y <= min(H - 1, floor(w.y + R)); y++)
    for (let x = max(0, floor(w.x - R)); x <= min(W - 1, floor(w.x + R)); x++) {
      const dx = x + 0.5 - w.x, dy = y + 0.5 - w.y;
      const lx = ((c * dx + s * dy) / w.s) * w.dir, ly = (-s * dx + c * dy) / w.s;
      if (lx < -23 || lx > 17 || ly < -25 || ly > 8) continue;
      let dd = 1e9;
      for (const sh of shapes) {
        const v = sh[0] === "c" ? capsule(lx, ly, sh[1], sh[2], sh[3], sh[4], sh[5]) : poly(lx, ly, sh[1]);
        if (v < dd) dd = v;
      }
      const cov = cl(0.5 - dd * w.s, 0, 1), p = y * W + x;
      if (cov > mask[p]) mask[p] = cov;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, mask } = S;
  // Moon tint from Hue.
  const hk = S.hue * (TINTS.length - 1), i0 = min(TINTS.length - 2, floor(hk)), ht = hk - i0;
  const T = S.tint;
  for (let c = 0; c < 3; c++) T[c] = TINTS[i0][c] + (TINTS[i0 + 1][c] - TINTS[i0][c]) * ht;
  // Where each cloud is now, and how big, for the clouds the knob lets in.
  const live = [], c = S.clouds;
  for (const C of CLOUDS) {
    if (C.i >= 3 + round(5 * c)) continue;
    const len = C.len * (1 + 0.3 * c), th = C.th * (1 + 0.6 * c), m = len / 2 + 8, span = W + 2 * m;
    let u = (C.x + m - LAYERS[C.l].v * S.t) % span;
    if (u < 0) u += span;
    live.push({ C, cx: u - m, len, th });
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = 3 * p, dx = x + 0.5 - MX, dy = y + 0.5 - MY, r = sqrt(dx * dx + dy * dy);
      let R = SKYROW[3 * y], G = SKYROW[3 * y + 1], B = SKYROW[3 * y + 2];
      // Glow round the moon in rings, then the moon itself.
      const out = max(0, r - MR), glow = round((0.34 * exp(-out / 6) + 0.12 * exp(-out / 22)) * 20) / 20;
      R += T[0] * glow;
      G += T[1] * glow;
      B += T[2] * glow;
      if (r < MR + 0.5) {
        const f = FACE[p], disc = r < MR - 0.3 ? 1 : 0.6;
        R += (T[0] * f - R) * disc;
        G += (T[1] * f - G) * disc;
        B += (T[2] * f - B) * disc;
      }
      // Clouds, far then near, in flat tones: a puffy top, a flatter base
      // and a ragged edge. The edge of a cloud near the moon is lit in the
      // moon's tint; its body takes a little of that light.
      const light = round(4 * exp(-max(0, r - 0.8 * MR) / 10)) / 4;
      for (const K of live) {
        const { C, cx, len, th } = K, qx = x + 0.5 - cx, qy = y + 0.5 - C.y;
        if (abs(qx) > len / 2 + 4 || qy < -th - 2 || qy > 0.5 * th + 2) continue;
        let dd = 1e9;
        for (const [px, rx, ry] of C.puffs) {
          const ex = (qx - px * len) / (rx * len), ey = qy / (qy < 0 ? ry * th : 0.42 * th);
          dd = min(dd, (sqrt(ex * ex + ey * ey) - 1) * min(rx * len, ry * th));
        }
        dd += 2.2 * (vnoise(qx / 3.2 + C.seed, y / 2.6) - 0.5) + 1.6 * (vnoise(qx / 7 + C.seed, y / 5) - 0.5);
        if (dd >= 0) continue;
        // The lit edge is the tint halfway to white, so over the moon it
        // still shows as a line brighter than the face behind it.
        const L = LAYERS[C.l], a = L.op;
        if (dd > -1.1) {
          R += ((T[0] * 0.55 + 0.45) * light + L.body[0] - R) * a;
          G += ((T[1] * 0.55 + 0.45) * light + L.body[1] - G) * a;
          B += ((T[2] * 0.55 + 0.45) * light + L.body[2] - B) * a;
        } else {
          R += (L.body[0] + T[0] * 0.12 * light - R) * a;
          G += (L.body[1] + T[1] * 0.12 * light - G) * a;
          B += (L.body[2] + T[2] * 0.12 * light - B) * a;
        }
      }
      rgb[o] = R;
      rgb[o + 1] = G;
      rgb[o + 2] = B;
    }
  // Stars twinkle where nothing covers them.
  for (const [x, y, ph] of STARS) {
    const o = 3 * (y * W + x), v = 0.22 + 0.2 * sin(S.t * 2.3 + ph);
    if (rgb[o + 2] < 0.2) {
      rgb[o] = max(rgb[o], v);
      rgb[o + 1] = max(rgb[o + 1], v);
      rgb[o + 2] = max(rgb[o + 2], v * 1.1);
    }
  }
  // Silhouettes: the witches, then the trees and the ground, all black.
  mask.fill(0);
  if (S.flight) for (let j = 0; j < S.flight.n; j++) drawWitch(S, witchPlace(S, S.flight, j), S.t * 1.1 + j * 2.3);
  for (let p = 0; p < W * H; p++) {
    const a = mask[p];
    if (a > 0) {
      rgb[3 * p] *= 1 - a;
      rgb[3 * p + 1] *= 1 - a;
      rgb[3 * p + 2] *= 1 - a;
    }
  }
  // Sparks over the witches, under the trees: toxic green, flickering.
  for (const sp of S.sparks) {
    const x = floor(sp.x), y = floor(sp.y);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const v = min(1, sp.life * 1.3) * (0.6 + 0.4 * sin(S.t * 30 + sp.ph));
    spark(rgb, x, y, v);
    // A new spark is a small cross.
    if (sp.life > 0.75) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) spark(rgb, x + dx, y + dy, 0.45 * v);
  }
  mask.fill(0);
  drawTrees(S);
  for (let x = 0; x < W; x++) {
    const g = 119.5 + 2.6 * sin(x * 0.11 + 1.3) + 1.4 * sin(x * 0.31);
    for (let y = floor(g) - 1; y < H; y++) {
      const p = y * W + x;
      mask[p] = max(mask[p], cl(y + 0.5 - g + 0.5, 0, 1));
    }
  }
  for (let p = 0, o = 0; p < W * H; p++, o += 3) {
    const a = 1 - mask[p];
    display.setPixel(p % W, (p / W) | 0, round(255 * min(1, rgb[o] * a)), round(255 * min(1, rgb[o + 1] * a)), round(255 * min(1, rgb[o + 2] * a)));
  }
}

function spark(rgb, x, y, v) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = 3 * (y * W + x);
  rgb[o] = max(rgb[o], 0.45 * v);
  rgb[o + 1] = max(rgb[o + 1], v);
  rgb[o + 2] = max(rgb[o + 2], 0.3 * v);
}

// Each branch is placed from its parent's end every frame, its angle swayed
// by the wind: more at the twigs, a slow sway and a faster shiver.
function drawTrees(S) {
  const { bx, by, ex, ey, mask } = S, t = S.t, ang = new Float32Array(TREES.length);
  for (let i = 0; i < TREES.length; i++) {
    const b = TREES[i], w = (b.depth / 6) ** 1.5;
    const sway = w * (0.15 * sin(t * 2.1 + b.ph) + 0.05 * sin(t * 5.3 + 2 * b.ph)) + 0.04 * (b.depth / 6) * sin(t * 0.9);
    ang[i] = (b.parent < 0 ? b.a : ang[b.parent] + b.a) + sway;
    if (b.parent < 0) {
      bx[i] = b.x;
      by[i] = b.y;
    } else {
      bx[i] = ex[b.parent];
      by[i] = ey[b.parent];
    }
    ex[i] = bx[i] + sin(ang[i]) * b.len;
    ey[i] = by[i] - cos(ang[i]) * b.len;
    const x0 = bx[i], y0 = by[i], x1 = ex[i], y1 = ey[i], R = b.r0 + 1;
    const exx = x1 - x0, eyy = y1 - y0, L2 = exx * exx + eyy * eyy || 1;
    for (let y = max(0, floor(min(y0, y1) - R)); y <= min(H - 1, floor(max(y0, y1) + R)); y++)
      for (let x = max(0, floor(min(x0, x1) - R)); x <= min(W - 1, floor(max(x0, x1) + R)); x++) {
        const qx = x + 0.5 - x0, qy = y + 0.5 - y0, u = cl((qx * exx + qy * eyy) / L2, 0, 1);
        const dd = sqrt((qx - u * exx) ** 2 + (qy - u * eyy) ** 2), rr = b.r0 + (b.r1 - b.r0) * u;
        const cov = cl(rr + 0.5 - dd, 0, 1), p = y * W + x;
        if (cov > mask[p]) mask[p] = cov;
      }
  }
}
