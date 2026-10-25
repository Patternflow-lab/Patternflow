// ===== Patternflow pattern =====
// Title:   Barn Owl
// Family:  halloween
// Idea:    A gnarled dead tree stands the full height of a purple night, roots in the grass and bare branches across a big full moon, where a pale barn owl swivels its heart-shaped face far round and back and blinks, then drops off and swoops down the whole panel with big wingbeats to grab a mouse in the grass or miss it, then beats back up as dead leaves fall.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 48
// Round:   48
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Hunger=0..1, Wind=0..1
//
// Knob 1: Hue. The sky's colour; moon, owl, tree and leaves stay. At 0 a violet night, at 0.25 a deep red one, at 0.5 a dark olive green one and at 0.75 a dark teal one, each a little paler towards the grass.
// Knob 2: Speed. At 2 the swoop from branch to grass takes 1.4 s, the owl stands over its catch 0.55 s and the climb back takes 2.3 s at three wingbeats a second; a leaf falls from the branches to the grass in 6 to 10 s. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Hunger. How long the owl sits between hunts at Speed 2: 6 s at 0, 4 s at half and 1.5 s at 1, give or take 15%, the first hunt at 2.4 s, 1.6 s and 0.7 s. It goes for the further mouse and catches two in three; a caught one hangs from its talons and is swallowed on the branch 2 s later.
// Knob 4: Wind. At 0.06 the crown stirs by a LED, a tenth of the sky up top is cloud drifting right at 5 LEDs a second and a leaf comes off about every 2 s; at 0.5 the crown sways up to 5 LEDs, a quarter is cloud at 15 a second and a leaf comes off each second; at 1 the crown sways up to 10 LEDs, two fifths is cloud racing over the moon at 25 a second and the leaves blow sideways at 22.
// Buttons: K1 tap sends the owl down now, if it is on its branch.

const W = 64, H = 128, N = W * H;
const { floor, round, ceil, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const rnd = (a, b) => a + (b - a) * Math.random();
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return out;
}

// The moon, behind the upper branches on the right.
const MX = 43, MY = 26, MR = 17;
const groundY = (x) => 121 + round(1.2 * sin(x / 6 + 0.5) + 0.7 * sin(x / 2.3));

// The tree: limbs as [parent limb, point on it, x, y, half width for each
// point]. The trunk kinks up the left third; the owl sits on limb 2.
const LIMBS = [
  [-1, 0, [14, 128, 5.6, 14, 121, 4.6, 16, 112, 3.9, 13, 101, 3.6, 17, 90, 3.3, 15, 79, 3.1, 19, 68, 2.8, 18, 58, 2.5, 21, 49, 2.2, 20, 39, 1.9, 24, 29, 1.6, 23, 19, 1.2, 26, 9, 0.8, 25, 3, 0.5]],
  [0, 1, [14, 121, 3, 8, 123, 2.2, 3, 126, 1.5, 0, 128, 1.2]],
  [0, 8, [21, 49, 1.8, 28, 47, 1.6, 35, 47, 1.3, 42, 45, 1, 48, 42, 0.7, 52, 37, 0.5]],
  [0, 1, [15, 121, 2.8, 22, 124, 2, 28, 127, 1.3]],
  [0, 9, [20, 40, 1.4, 27, 34, 1.2, 34, 31, 1, 41, 26, 0.8, 47, 24, 0.6, 54, 19, 0.5]],
  [0, 11, [23, 21, 1, 28, 15, 0.8, 33, 12, 0.6, 37, 6, 0.5]],
  [0, 7, [18, 60, 1.5, 11, 55, 1.2, 6, 50, 0.9, 3, 43, 0.6, 1, 38, 0.5]],
  [0, 10, [24, 31, 1.2, 17, 26, 0.9, 11, 21, 0.7, 7, 14, 0.5]],
  [0, 5, [15, 80, 1.6, 9, 75, 1.1, 5, 69, 0.7]],
  [4, 2, [34, 31, 0.7, 37, 37, 0.5, 41, 39, 0.5]],
  [4, 3, [41, 26, 0.6, 45, 31, 0.5, 49, 32, 0.4]],
  [2, 3, [42, 45, 0.6, 46, 50, 0.5, 49, 51, 0.4]],
  [5, 1, [28, 15, 0.6, 31, 7, 0.5, 30, 2, 0.4]],
  [7, 2, [11, 21, 0.6, 14, 15, 0.5, 13, 9, 0.4]],
  [6, 2, [6, 50, 0.6, 1, 52, 0.4]],
  [4, 4, [47, 24, 0.5, 52, 27, 0.4, 57, 26, 0.4]],
  [0, 12, [26, 9, 0.6, 30, 4, 0.4]],
  [8, 1, [9, 75, 0.7, 4, 78, 0.5, 1, 77, 0.4]],
];
// Each point's distance up the tree from the root, for the sway.
const TREE = LIMBS.map(([par, at, P]) => ({ par, at, P, n: P.length / 3, s: new Float32Array(P.length / 3) }));
for (const L of TREE) {
  if (L.par >= 0) L.s[0] = TREE[L.par].s[L.at];
  for (let i = 1; i < L.n; i++) L.s[i] = L.s[i - 1] + Math.hypot(L.P[i * 3] - L.P[i * 3 - 3], L.P[i * 3 + 1] - L.P[i * 3 - 2]);
}
// The perch: on limb 2 between its second and third points.
const PERCH = [2, 1, 0.55];

// The moon's tone (limb, sea, bright) and its glow in rings.
const MOONT = new Uint8Array(N), GLOW = new Float32Array(N);
const SEAS = [[-6, -5, 5, 4], [5, -2, 4, 5], [-2, 6, 6, 3], [7, 8, 3, 3]];
for (let p = 0; p < N; p++) {
  const dx = (p % W) + 0.5 - MX, dy = floor(p / W) + 0.5 - MY, r = sqrt(dx * dx + dy * dy);
  if (r < MR) {
    const sea = SEAS.some(([cx, cy, rx, ry]) => ((dx - cx) / rx) ** 2 + ((dy - cy) / ry) ** 2 < 1);
    MOONT[p] = r > MR - 1.2 ? 1 : sea ? 2 : 3;
  } else GLOW[p] = r < MR + 3 ? 0.26 : r < MR + 7 ? 0.15 : r < MR + 13 ? 0.08 : r < MR + 22 ? 0.035 : 0;
}
const MOONC = [0, [240, 196, 120], [255, 238, 196], [255, 222, 150]];
// Clouds: a noise sheet that wraps round, slid along by the wind; CQ is it
// sorted, so a cover maps straight to a threshold.
const CW = 128, CH = 24, CN = new Float32Array(CW * CH);
for (let p = 0; p < CW * CH; p++)
  for (const [c, a] of [[8, 0.6], [4, 0.3], [2, 0.15]]) {
    const n = CW / c, u = (p % CW) / c, w = floor(p / CW) / (c / 2), iu = floor(u), iw = floor(w), su = sm(u - iu), sw = sm(w - iw);
    const hh = (x, y) => hash((((x % n) + n) % n) * 131 + y * 977 + c * 7);
    CN[p] += a * ((hh(iu, iw) * (1 - su) + hh(iu + 1, iw) * su) * (1 - sw) + (hh(iu, iw + 1) * (1 - su) + hh(iu + 1, iw + 1) * su) * sw);
  }
const CQ = Float32Array.from(CN).sort();
const STARS = [];
for (let k = 0, x, y; STARS.length < 26; k++) if (((x = floor(hash(k * 3 + 1) * W)) - MX) ** 2 + ((y = floor(hash(k * 3 + 2) * 84)) - MY) ** 2 > 625) STARS.push([x, y, hash(k * 3 + 3) * TAU]);

const CREAM = [250, 240, 220], BUFF = [238, 176, 96], GOLD = [242, 196, 128], FACE = [255, 252, 246], RIM = [222, 140, 76];
const DOT = [196, 160, 136], EYE = [18, 6, 12], LID = [214, 168, 140], BEAK = [236, 198, 168], LEG = [214, 180, 168], LINE = [26, 10, 34];
const LEAFC = [[255, 148, 36], [255, 196, 64], [250, 108, 40]], GRASS = [70, 150, 64], BLADE = [34, 86, 44], EARTH = [14, 10, 18];

export function setup(params) {
  params.s = {
    t: 0, cloud: 282, begun: false, mice: [], leaves: [], leafT: 0.3,
    mode: 0, mt: 0, ox: 0, oy: 0, tilt: 0, spread: 0, flap: 0, talons: 0, face: 0, blink: 0, carry: 0, eat: 0, look: [], lt: 0,
    sky: new Float32Array(H * 3), skyKey: -1, buf: new Float32Array(N * 3), tm: new Uint8Array(N), ob: new Float32Array(48 * 48 * 3), om: new Uint8Array(48 * 48),
  };
}

// Limb k at point i and a share f on, swayed: tips most, a wave up the tree.
function limbAt(S, k, i, f, out) {
  const L = TREE[k], P = L.P, j = min(i + 1, L.n - 1);
  const x = P[i * 3] + (P[j * 3] - P[i * 3]) * f, y = P[i * 3 + 1] + (P[j * 3 + 1] - P[i * 3 + 1]) * f, s = L.s[i] + (L.s[j] - L.s[i]) * f;
  const a = ((s * s) / 12000) * (0.3 + 5.7 * S.wind);
  const g = sin(S.t * 1.7 - s * 0.035) + 0.45 * sin(S.t * 4.1 + s * 0.11 + k);
  out[0] = x + a * g;
  out[1] = y + a * g * 0.25 * (x < 20 ? -1 : 1) * 0.5;
  return out;
}

const tmp = [0, 0], tmp2 = [0, 0];
function perch(S) {
  limbAt(S, PERCH[0], PERCH[1], PERCH[2], tmp);
  return [tmp[0], tmp[1] - 1.2];
}

const mouse = (x) => ({ x, tx: x, y: 0, wait: rnd(0.2, 1.2), dir: 1, hide: 0, run: 0, flee: 0 });
const leaf = (x, y, c) => ({ x, y, c, ph: rnd(0, TAU), w: rnd(2.5, 4.5), vy: rnd(10, 15) });

// A cubic Bézier through four points.
const bez = (p, t, k) => {
  const u = 1 - t;
  return u * u * u * p[k] + 3 * u * u * t * p[2 + k] + 3 * u * t * t * p[4 + k] + t * t * t * p[6 + k];
};

function startHunt(S) {
  const live = S.mice.filter((m) => m.hide <= 0 && !m.flee);
  if (!live.length) return false;
  const [px, py] = perch(S);
  let m = live[0];
  for (const q of live) if (abs(q.x - px) > abs(m.x - px)) m = q;
  Object.assign(S, { prey: m, catchIt: Math.random() < 0.67, mode: 1, mt: 0, px, py });
  return true;
}

// The path down: off the branch, out wide on the side away from the mouse,
// and in low over the grass to it.
function swoopPath(S) {
  const m = S.prey, ex = cl(m.x + m.dir * 6, 8, 56), ey = groundY(round(ex)) - 8, side = ex > S.ox ? -1 : 1;
  S.path = [S.ox, S.oy, S.ox + side * 26, S.oy + 34, ex - side * 30, ey - 26, ex, ey];
}

function climbPath(S) {
  const [px, py] = perch(S), side = S.ox < 32 ? 1 : -1;
  S.path = [S.ox, S.oy, S.ox + side * 22, S.oy - 40, px + side * 30, py + 30, px, py - 10];
}

const T_DROP = 0.35, T_SWOOP = 1.4, T_STRIKE = 0.55, T_CLIMB = 2.3, T_LAND = 0.5;

function owl(S, ds) {
  S.mt += ds;
  const [px, py] = perch(S);
  const bx = S.ox, by = S.oy;
  if (S.mode === 0) {
    // On the branch: feet on the limb, the head looking about.
    Object.assign(S, { ox: px, oy: py - 9, spread: max(0, S.spread - ds * 3), talons: 0, flap: 0, tilt: S.tilt * 0.8 });
    if (S.carry && (S.eat += ds) > 2.2) (S.carry = 0), (S.eat = 0);
    // The head: a turn far round to one side, back, a glance the other way.
    S.lt += ds;
    if (!S.look.length || S.lt > S.look[S.look.length - 1][0]) {
      const far = rnd(0.5, 1) < 0.5 ? -1 : 1;
      S.look = [[0, S.face], [0.5, far * rnd(1.8, 2.6)], [1.6, far * rnd(1.8, 2.6)], [2.2, 0], [2.9, 0], [3.3, -far * rnd(0.6, 1.1)], [3.9, -far * 0.8], [4.3, 0], [5.4, 0]];
      S.lt = 0;
    }
    let k = 1;
    while (k < S.look.length - 1 && S.look[k][0] < S.lt) k++;
    const [t0, a0] = S.look[k - 1], [t1, a1] = S.look[k];
    S.face = a0 + (a1 - a0) * sm((S.lt - t0) / max(1e-6, t1 - t0));
    S.blink = (S.lt % 2.7) > 2.55 ? 1 : 0;
    if ((S.wait -= ds) < 0 && !S.carry && !startHunt(S)) S.wait = 1;
    return;
  }
  S.blink = 0;
  S.face *= exp(-ds * 10);
  const t = S.mt;
  if (S.mode === 1) {
    // Off the branch: the wings open as it falls.
    const f = t / T_DROP;
    Object.assign(S, { spread: sm(f * 1.4), flap: 0.8 - 0.6 * f, ox: S.px + 3 * f, oy: S.py - 9 + 6 * f * f });
    if (t >= T_DROP) (S.mode = 2), (S.mt = 0), swoopPath(S);
  } else if (S.mode === 2) {
    // The swoop: two beats, then a long glide; the end follows the mouse.
    const f = min(1, t / T_SWOOP), u = f * f * (3 - 2 * f) * 0.6 + f * 0.4, m = S.prey;
    S.path[6] += (cl(m.x, 6, 58) - S.path[6]) * min(1, ds * 3);
    Object.assign(S, { ox: bez(S.path, u, 0), oy: bez(S.path, u, 1), spread: 1, talons: sm((f - 0.7) / 0.3) });
    S.flap = t < 0.75 ? 0.15 + 0.7 * sin(TAU * 2.6 * t) : 0.1 + 0.25 * sm((f - 0.8) / 0.2);
    if (f >= 1) {
      (S.mode = 3), (S.mt = 0);
      if (S.catchIt && abs(m.x - S.ox) < 6 && !m.flee) (S.carry = 1), (m.hide = rnd(3, 6)), (m.x = rnd(0, 1) < 0.5 ? -4 : 68);
      else (m.flee = 1), (m.dir = m.x < S.ox ? -1 : 1);
    }
  } else if (S.mode === 3) {
    // On the grass: wings held high over the catch, a beat, and off.
    Object.assign(S, { spread: 1, talons: 1, flap: 0.95 - 0.4 * sin(PI * cl(t / T_STRIKE, 0, 1)), oy: S.oy + sin(t * 9) * ds * 3 });
    if (t >= T_STRIKE) (S.mode = 4), (S.mt = 0), climbPath(S);
  } else if (S.mode === 4) {
    // The climb back up: hard wingbeats, three a second.
    const f = min(1, t / T_CLIMB), u = f * f * (3 - 2 * f);
    (S.path[6] = px), (S.path[7] = py - 10);
    Object.assign(S, { ox: bez(S.path, u, 0), oy: bez(S.path, u, 1), spread: 1, flap: 0.2 + 0.75 * sin(TAU * 3 * t), talons: S.carry ? 1 : max(0, 1 - t * 3) });
    if (f >= 1) (S.mode = 5), (S.mt = 0);
  } else {
    // Landing: a flare and the wings fold.
    const f = min(1, t / T_LAND);
    Object.assign(S, { ox: px, oy: py - 10 + f, flap: 0.9, spread: 1 - sm(f), talons: S.carry ? 1 - f : 0 });
    if (f >= 1) (S.mode = 0), (S.mt = 0), (S.wait = waitOf(S)), (S.look = []), (S.eat = 0);
  }
  const vx = (S.ox - bx) / max(1e-4, ds);
  S.tilt += (cl(vx * 0.012, -0.45, 0.45) - S.tilt) * min(1, ds * 6);
}

const waitOf = (S) => 6 - 4.5 * S.hunger * (1 - 0.25 * (1 - S.hunger)) * rnd(0.85, 1.15);

function mice(S, ds) {
  for (const m of S.mice) {
    m.y = groundY(cl(round(m.x), 0, W - 1)) - 1;
    if (m.hide > 0) {
      if ((m.hide -= ds) <= 0) Object.assign(m, { x: rnd(0, 1) < 0.5 ? -3 : 67, tx: rnd(12, 52), flee: 0, wait: 0 });
    } else if (m.flee) {
      (m.x += m.dir * 60 * ds), (m.run += ds * 14);
      if (m.x < -6 || m.x > 70) (m.hide = rnd(1.5, 3)), (m.flee = 0);
    } else if (m === S.prey && S.mode === 2) {
      // A last dash as the owl comes in.
      (m.x += m.dir * 18 * ds), (m.run += ds * 12);
      if (m.x < 6 || m.x > 58) m.dir = -m.dir;
    } else if ((m.wait -= ds) < 0) {
      const d = m.tx - m.x;
      m.dir = d < 0 ? -1 : 1;
      (m.x += m.dir * min(abs(d), 26 * ds)), (m.run += ds * 12);
      if (abs(d) < 0.5) (m.wait = rnd(0.3, 1.6)), (m.tx = cl(m.x + rnd(-24, 24), 6, 58));
    }
  }
}

function leaves(S, ds) {
  S.leafT -= ds * (0.4 + 1.6 * S.wind);
  if (S.leafT < 0 && S.leaves.length < 4 + floor(6 * S.wind)) {
    S.leafT += rnd(0.6, 1.4);
    const k = [2, 4, 5, 6, 7, 9, 10, 11, 13, 15][floor(rnd(0, 10))], L = TREE[k];
    limbAt(S, k, floor(rnd(1, L.n - 1)), rnd(0, 1), tmp2);
    S.leaves.push(leaf(tmp2[0], tmp2[1], floor(rnd(0, 3))));
  }
  S.leaves = S.leaves.filter((l) => {
    l.ph += ds * l.w;
    l.x += (S.wind * 22 + 7 * sin(l.ph)) * ds;
    l.y += l.vy * (0.65 + 0.35 * abs(cos(l.ph))) * ds;
    return l.y < groundY(cl(round(l.x), 0, W - 1)) && l.x > -4 && l.x < 68;
  });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  [S.hue, S.speed, S.hunger, S.wind] = [cl(k[0], 0, 1), cl(k[1], 0.2, 3), cl(k[2], 0, 1), cl(k[3], 0, 1)];
  const ds = (d * S.speed) / 2;
  if (!S.begun) {
    S.begun = true;
    S.mice = [mouse(14), mouse(46)];
    S.wait = 2.4 - 1.7 * S.hunger;
    // A few leaves already on their way down.
    for (let i = 0; i < 3; i++) S.leaves.push(leaf(rnd(8, 56), rnd(20, 110), i));
  }
  S.t += ds;
  S.cloud += ds * (4 + 21 * S.wind);
  if (input.btnPressed && input.btnPressed[0] && S.mode === 0) (S.carry = 0), startHunt(S);
  owl(S, ds);
  mice(S, ds);
  leaves(S, ds);
}

// The sky by row, in ten flat steps: deep overhead, paler low down.
function skyRows(S) {
  if (S.skyKey === S.hue) return;
  S.skyKey = S.hue;
  for (let y = 0, t; y < H; y++) (t = floor((y / H) * 10) / 9), S.sky.set(hsv(0.76 + S.hue + 0.03 * t, 0.84 - 0.2 * t, 0.2 + 0.2 * t, [0, 0, 0]), 3 * y);
}

function put(buf, x, y, c, f = 1) {
  (x = round(x)), (y = round(y));
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  (buf[o] = c[0] * f), (buf[o + 1] = c[1] * f), (buf[o + 2] = c[2] * f);
}

// The owl, drawn in its own frame: u across, v down its body, origin at
// the middle of the body, turned by its tilt.
function owlPixel(S, u, v) {
  const sp = S.spread, hx = u, hy = v + 6.4;
  // The head: square on, the face is a white heart with a tan rim; turned,
  // it narrows and slides aside, and past a right angle the back shows.
  if ((hx / 5.4) ** 2 + (hy / 4.9) ** 2 < 1) {
    const c = cos(S.face), fu = sin(S.face) * 3.8, sx = max(0.2, c);
    if (c > -0.05) {
      const uf = (u - fu) / sx, vf = v + 5.9;
      const heart = (d) => (uf - 2) ** 2 + (vf + 1.1) ** 2 < (2.6 + d) ** 2 || (uf + 2) ** 2 + (vf + 1.1) ** 2 < (2.6 + d) ** 2 || (vf > -1.1 && vf < 3.8 + d && abs(uf) < ((3.8 + d - vf) * 4.6) / 4.9);
      if (heart(0)) {
        for (const e of [-1, 1]) if ((u - fu - e * 1.9 * sx) ** 2 + (v + 5.9) ** 2 < 0.7) return S.blink ? LID : EYE;
        if ((u - fu) ** 2 + (v + 4.1) ** 2 < 0.55) return BEAK;
        return FACE;
      }
      if (heart(0.9 / sx)) return RIM;
    }
    // A darker collar, and turned away a ruff, so the head reads as a head.
    const e = (hx / 5.4) ** 2 + (hy / 4.9) ** 2;
    if (e > 0.72 && (hy > 1.5 || c < 0)) return DOT;
    return hash(round(u * 3) * 31 + round(v * 3) * 7) < 0.16 ? DOT : GOLD;
  }
  // Turned side on, the beak shows past the edge of the head.
  if (abs(sin(S.face)) > 0.85 && cos(S.face) > -0.3 && abs(v + 4.6) < 0.6 && abs(u - sin(S.face) * 5.6) < 0.7) return BEAK;
  // The body, an egg wider below: a cream breast between folded buff wings.
  const ry = 6.4 - 0.8 * sp, cy = 2.2 - 0.4 * sp, rx = (5.4 - 1.4 * sp) * (1 + 0.1 * cl((v - cy) / ry, -1, 1));
  if ((u / rx) ** 2 + ((v - cy) / ry) ** 2 < 1) {
    const breast = abs(u) < 2.7 - 0.5 * sp + (0.8 * (v - cy)) / ry;
    if (breast) return hash(round(u * 2) * 13 + round(v * 2) * 5) < 0.08 ? DOT : CREAM;
    return hash(round(u * 2) * 17 + round(v * 2) * 3) < 0.22 ? DOT : BUFF;
  }
  if (sp < 0.3 && v > 8.2 && v < 10.4 && abs(u) < (10.4 - v) * 0.9) return DOT;
  // Legs and talons, reaching down when it strikes or carries.
  if (S.talons > 0.05) for (const e of [-1, 1]) if (abs(u - e * 1.5) < 0.6 && v > 5 && v < 5.5 + 4.5 * S.talons) return LEG;
  // The wings: a buff leading edge, cream behind, dark bars near the tip.
  if (sp > 0.02)
    for (const e of [-1, 1]) {
      const sx = e * 2.6, sy = -1.6, L = 13 * sp, a = S.flap, tx = sx + e * L * cos(a), ty = sy - L * sin(a) * 0.9;
      const ax = tx - sx, ay = ty - sy, l2 = ax * ax + ay * ay;
      if (l2 < 1) continue;
      const t = ((u - sx) * ax + (v - sy) * ay) / l2;
      if (t < -0.05 || t > 1.04) continue;
      const qx = u - (sx + ax * t), qy = v - (sy + ay * t), il = 1 / sqrt(l2);
      // The trailing side is the one away from the head.
      let nx = -ay * il, ny = ax * il;
      if (ny < 0) (nx = -nx), (ny = -ny);
      const dn = qx * nx + qy * ny, tc = cl(t, 0, 1), ch = 1.1 + 4.2 * sqrt(max(0, 1 - tc * tc)) * (1 - 0.25 * tc);
      if (dn < -0.9 || dn > ch) continue;
      if (tc > 0.7 && (tc * 12) % 1 < 0.3 && dn > 0.6) return DOT;
      return dn < 0.7 ? BUFF : dn < ch * 0.55 ? GOLD : CREAM;
    }
  return null;
}

function drawOwl(S, buf) {
  const { ob, om } = S, cx = round(S.ox), cy = round(S.oy), ct = cos(S.tilt), st = sin(S.tilt);
  om.fill(0);
  for (let j = 0; j < 48; j++)
    for (let i = 0; i < 48; i++) {
      const dx = i - 24 + 0.5 + cx - S.ox, dy = j - 24 + 0.5 + cy - S.oy;
      const c = owlPixel(S, dx * ct + dy * st, -dx * st + dy * ct);
      if (!c) continue;
      const o = j * 48 + i;
      om[o] = 1;
      (ob[o * 3] = c[0]), (ob[o * 3 + 1] = c[1]), (ob[o * 3 + 2] = c[2]);
    }
  for (let j = 0; j < 48; j++)
    for (let i = 0; i < 48; i++) {
      const x = cx - 24 + i, y = cy - 24 + j;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const o = j * 48 + i, p = (y * W + x) * 3;
      if (om[o]) (buf[p] = ob[o * 3]), (buf[p + 1] = ob[o * 3 + 1]), (buf[p + 2] = ob[o * 3 + 2]);
      // A dark line round it, so a pale owl stands off a pale moon.
      else if ((i > 0 && om[o - 1]) || (i < 47 && om[o + 1]) || (j > 0 && om[o - 48]) || (j < 47 && om[o + 48])) (buf[p] = LINE[0]), (buf[p + 1] = LINE[1]), (buf[p + 2] = LINE[2]);
    }
}

// A mouse, five LEDs long with an ear, an eye and a tail, legs going.
const MOUSE = [204, 186, 172], TAIL = [226, 160, 168];
function drawMouse(buf, x, y, dir, run) {
  for (let i = -2; i <= 2; i++) put(buf, x + dir * i, y, MOUSE);
  for (let i = -1; i <= 1; i++) put(buf, x + dir * i, y - 1, MOUSE);
  put(buf, x + dir * 3, y, MOUSE, 0.85);
  put(buf, x + dir * 1, y - 2, TAIL);
  put(buf, x + dir * 2, y - 1, EYE);
  for (let i = 0; i < 4; i++) put(buf, x - dir * (3 + i), y + (i > 1 ? -1 : 0), TAIL, 0.85);
  put(buf, x + (floor(run) % 2 ? -1 : 1), y + 1, MOUSE, 0.7);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.begun) return;
  skyRows(S);
  const { buf, sky, tm } = S;
  const cover = 0.08 + 0.3 * S.wind, thr = CQ[floor((1 - cover) * (CQ.length - 1))], off = S.cloud;
  // Sky, stars, moon and clouds.
  for (let y = 0; y < H; y++) {
    const fy = y / 3.2, j0 = floor(fy) % CH, j1 = (j0 + 1) % CH, ty = fy - floor(fy);
    const band = y > 60 ? (y - 60) * 0.012 : 0;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = 3 * p, mt = MOONT[p], gl = GLOW[p];
      let R = sky[3 * y], G = sky[3 * y + 1], B = sky[3 * y + 2];
      if (mt) {
        const c = MOONC[mt];
        (R = c[0]), (G = c[1]), (B = c[2]);
      } else if (gl) (R += 255 * gl), (G += 210 * gl), (B += 140 * gl);
      if (y < 90) {
        const fx = (x - off) * 0.3, i0 = floor(fx), tx = fx - i0, a0 = ((i0 % CW) + CW) % CW, a1 = (a0 + 1) % CW;
        const n = (CN[j0 * CW + a0] * (1 - tx) + CN[j0 * CW + a1] * tx) * (1 - ty) + (CN[j1 * CW + a0] * (1 - tx) + CN[j1 * CW + a1] * tx) * ty;
        const e = n - band - thr;
        if (e > 0) {
          const lit = min(1, (mt ? 1 : gl * 3.2) + 0.15);
          if (e < 0.02) (R = 70 + 150 * lit), (G = 40 + 130 * lit), (B = 92 + 80 * lit);
          else if (e < 0.06) (R = 50 + 60 * lit), (G = 26 + 50 * lit), (B = 70 + 34 * lit);
          else (R = 36 + 20 * lit), (G = 16 + 14 * lit), (B = 52 + 12 * lit);
        }
      }
      (buf[o] = R), (buf[o + 1] = G), (buf[o + 2] = B);
    }
  }
  for (const [x, y, ph] of STARS) {
    const tw = 0.5 + 0.5 * sin(S.t * 3 + ph * 5), o = (y * W + x) * 3;
    if (buf[o + 2] < 120 && tw > 0.3) (buf[o] += 120 * tw), (buf[o + 1] += 110 * tw), (buf[o + 2] += 130 * tw);
  }
  // Leaves behind the tree.
  drawLeaves(S, buf, 0);
  // The tree: each limb a run of round-ended strokes, swayed.
  tm.fill(0);
  for (let k = 0; k < TREE.length; k++) {
    const L = TREE[k];
    let ax = 0, ay = 0, aw = 0;
    for (let i = 0; i < L.n; i++) {
      limbAt(S, k, i, 0, tmp);
      const bx = tmp[0], by = tmp[1], bw = L.P[i * 3 + 2];
      if (i) {
        const x0 = max(0, floor(min(ax, bx) - 5)), x1 = min(W - 1, ceil(max(ax, bx) + 5)), y0 = max(0, floor(min(ay, by) - 5)), y1 = min(H - 1, ceil(max(ay, by) + 5));
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) {
            const px = x + 0.5 - ax, py = y + 0.5 - ay, t = cl((px * dx + py * dy) / l2, 0, 1), w = aw + (bw - aw) * t;
            if ((px - dx * t) ** 2 + (py - dy * t) ** 2 < w * w + 0.15) tm[y * W + x] = 1;
          }
      }
      (ax = bx), (ay = by), (aw = bw);
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (!tm[p]) continue;
      const o = p * 3;
      // Bark is black; an edge that faces the moon catches its light.
      const right = x < W - 1 && !tm[p + 1], top = y > 0 && !tm[p - W];
      const towards = (MX - x) * (right ? 1 : 0) + (MY - y) * (top ? -1 : 0);
      if ((right || top) && towards > 0) {
        const f = min(1, 0.45 + GLOW[p] * 2.5 + (MOONT[p] ? 0.6 : 0));
        (buf[o] = 92 * f), (buf[o + 1] = 58 * f), (buf[o + 2] = 120 * f);
      } else (buf[o] = 8), (buf[o + 1] = 3), (buf[o + 2] = 12);
    }
  // The ground, where the roots go in, and the grass in front of the mice.
  for (let x = 0; x < W; x++) {
    const g = groundY(x), h = 2 + floor(hash(x * 7 + 3) * 5), lean = (S.wind * 2.2 + 0.6 * sin(S.t * 2.3 + x * 0.4) * (0.3 + S.wind)) * 0.5;
    for (let y = g; y < H; y++) if (!tm[y * W + x] || y >= g + 2) put(buf, x, y, EARTH);
    for (let i = 1; i <= h; i++) {
      if (hash(x * 13 + i) < 0.4 && i < h - 1) continue;
      put(buf, x + lean * (i / h) * 2, g - i, i === h ? GRASS : BLADE);
    }
  }
  for (const m of S.mice) if (m.hide <= 0) drawMouse(buf, m.x, m.y, m.dir, m.run);
  // The owl, and the mouse it carries.
  drawOwl(S, buf);
  if (S.carry) {
    if (S.mode !== 0 || S.eat < 1.3) drawMouse(buf, S.ox, S.oy + 5 + 4.5 * S.talons + 1, 1, 0);
    else if (S.eat < 2.2) for (let i = 0; i < 3; i++) put(buf, S.ox + 0.5, S.oy - 3 + i, TAIL);
  }
  drawLeaves(S, buf, 1);
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    // Channels in steps of 4 of 255, too fine to see.
    display.setPixel(p % W, (p / W) | 0, min(255, round(buf[o] / 4) * 4), min(255, round(buf[o + 1] / 4) * 4), min(255, round(buf[o + 2] / 4) * 4));
  }
}

// Leaves: three LEDs that turn over as they fall, half behind the tree.
function drawLeaves(S, buf, front) {
  S.leaves.forEach((l, i) => {
    if ((i & 1) !== front) return;
    const c = LEAFC[l.c], k = floor((((l.ph % TAU) + TAU) % TAU) / (PI / 2)), f = 0.8 + 0.2 * abs(sin(l.ph));
    const [dx, dy] = [[1, 0], [1, 1], [0, 1], [-1, 1]][k];
    put(buf, l.x, l.y, c, f);
    put(buf, l.x + dx, l.y + dy, c, f * 0.9);
    put(buf, l.x - dx, l.y - dy, c, f * 0.8);
  });
}
