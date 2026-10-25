// ===== Patternflow pattern =====
// Title:   Trick or Treat
// Family:  halloween
// Idea:    A narrow street on Halloween night runs up the panel to a vanishing point under a purple sky, and three small trick-or-treaters, a bedsheet ghost, a witch and a cat, walk up it away from us sweeping torch beams over the pavement and swinging pumpkin buckets, stop where a door opens a wedge of yellow light for candy, and walk on into the distance as the next group comes in, with bats over the roofs and leaves blowing through the mist.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 48
// Round:   48
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Lights=0.5..1, Wind=0..1
//
// Knob 1: Hue. Tints the night, sky, walls, roofs and road together, while lamps, pumpkins and costumes keep their colours: at 0 a violet sky over plum walls, at 0.25 a blood red night, at 0.5 a toxic green one, at 0.75 deep teal.
// Knob 2: Speed. At 2 the children walk about 1.5 m a second, wait 2.2 s at each door and sweep their torches across and back in 1.2 s, and a new group comes in every 9 to 12 s; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Lights. The share of houses with their lights on, half at the start and all at 1. A lit house has lit windows (lamps, jack-o'-lanterns, a flickering television), a porch lamp and pumpkins on the step, and only lit houses open their doors to the children.
// Knob 4: Wind. At the start 43 leaves skitter across the street and the mist drifts at 0.7 m a second; at 0.5 there are 135 leaves, at 1 there are 240, blowing across at about 5.6 m a second and up to 3.7 m high, and the mist runs at 4.3 m a second.
// Buttons: K1 tap opens the door of a lit house up the street for 3 s.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vn = (x, sd) => {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash(i * 7919 + sd) * (1 - u) + hash((i + 1) * 7919 + sd) * u;
};
// Smooth noise on a 32 x 32 wrapping grid, for the mist.
const NT = new Float32Array(1024).map((_, i) => hash(i * 7 + 11));
const vn2 = (x, y) => {
  const i = floor(x), j = floor(y), u = x - i, v = y - j, a = (j & 31) * 32, b = ((j + 1) & 31) * 32, i0 = i & 31, i1 = (i + 1) & 31;
  const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  return (NT[a + i0] * (1 - su) + NT[a + i1] * su) * (1 - sv) + (NT[b + i0] * (1 - su) + NT[b + i1] * su) * sv;
};
const hsv = (h, s, v) => [5, 3, 1].map((n) => {
  const k = (n + (h - floor(h)) * 6) % 6;
  return 255 * v * (1 - s * max(0, min(k, 4 - k, 1)));
});
const put = (b, o, r, g, bl) => ((b[o] = r), (b[o + 1] = g), (b[o + 2] = bl));
const add = (b, o, r, g, bl) => ((b[o] += r), (b[o + 1] += g), (b[o + 2] += bl));

// One-point perspective. The lane is 2 units wide between the house fronts
// (about 3.2 m), the eye HC above it and the eaves HE, a little higher, so
// the roof lines climb from the vanishing point (32, YH) to the top corners.
// A point x across, h up and z deep lands at (32 + R s x, YH + R s (HC - h))
// with s = ZN / z: the ground at depth z is row YH + G s.
const YH = 22, G = 127.5 - YH, R = 30, HC = G / R, ZN = 3, HE = HC + 0.9;
// Roof pitch, run from the eave to the ridge, and the houses' depth.
const PITCH = 1.1, RUN = 1.3, DEPTH = 2 * RUN;
const sOf = (z) => ZN / z;

// Houses along each side: [side, z0, z1, door z].
const HOUSES = [];
for (const side of [-1, 1])
  for (let z = 1 + hash(side + 5) * 1.5, k = 0; z < 80; k++) {
    const len = 3 + 1.6 * hash(k * 31 + side * 7 + 1);
    HOUSES.push([side, z, z + len, z + 0.7 + (len - 1.4) * hash(k * 17 + side * 3 + 2)]);
    z += len + 0.5 + 1.1 * hash(k * 13 + side * 11 + 3);
  }
const houseAt = (side, z) => HOUSES.findIndex((h) => h[0] === side && z >= h[1] && z < h[2]);
// Three floors of windows, by height.
const FLOORS = [[0.55, 1.3], [1.95, 2.75], [3.3, 4.0]];

// What each LED sees, worked out once by casting its ray at the ground, the
// two rows of house fronts, their roofs and the end walls facing us; the
// nearest hit wins. A window's id is its house, floor and slot.
const SKY = 0, GROUND = 1, WALL = 2, WIN = 3, DOOR = 4, END = 5, ROOF = 6;
const MAT = new Uint8Array(N), REF = new Int16Array(N), ZB = new Float32Array(N), XB = new Float32Array(N), HB = new Float32Array(N);
for (let p = 0; p < N; p++) {
  const q = ((p % W) + 0.5 - 32) / R, e = (floor(p / W) + 0.5 - YH) / R, side = q < 0 ? -1 : 1, aq = abs(q);
  let best = 0, m = SKY, ref = -1, zz = 0, xx = 0, hh = 0, s;
  // The ground, unless a house stands on that spot.
  if (e > 0 && (abs(q / (s = e / HC)) <= 1 || !(abs(q / s) <= 1 + DEPTH && houseAt(side, ZN / s) >= 0))) [best, m, zz, xx] = [s, GROUND, ZN / s, q / s];
  // The house front on this side, then the near slope of a roof.
  let i = houseAt(side, ZN / aq), h = HC - e / aq;
  if (i >= 0 && h >= 0 && h <= HE && aq > best) [best, m, ref, zz, hh] = [aq, WALL, i, ZN / aq, h];
  s = (-e - PITCH * aq) / (HE - HC - PITCH);
  if (s > best && (i = houseAt(side, ZN / s)) >= 0 && aq / s >= 1 && aq / s <= 1 + RUN) [best, m, ref, zz] = [s, ROOF, i, ZN / s];
  // End walls facing us, with their gables.
  HOUSES.forEach(([sd, z0], i) => {
    const s = sOf(z0), d = aq / s - 1, h = HC - e / s;
    if (sd === side && s > best && d >= 0 && d <= DEPTH && h >= 0 && h <= HE + PITCH * min(d, DEPTH - d)) [best, m, ref, zz, xx, hh] = [s, END, i, z0, d, h];
  });
  if (m === WALL) {
    const [, z0, z1, zd] = HOUSES[ref], f = FLOORS.findIndex(([a, b]) => hh > a && hh < b), c = f ? (zz - z0 - 0.75) / 1.25 : (zz - zd) / 1.25, k = round(c);
    if (abs(zz - zd) < 0.3 && hh < 1.35) m = DOOR;
    else if (f >= 0 && abs(c - k) < 0.24 && (f || k) && zz > z0 + 0.3 && zz < z1 - 0.3) [m, ref] = [WIN, ref * 32 + f * 5 + ((k + 5) % 5)];
  }
  [MAT[p], REF[p], ZB[p], XB[p], HB[p]] = [m, ref, zz, xx, hh];
}
// Fixed shading: a wall's tone, each house a little different and darker
// far off, a window's fade, each door's porch lamp on the wall, the stars.
const TONE = new Float32Array(N), LAMP = new Float32Array(N), STAR = new Uint8Array(N), WIDS = new Set(), GL = [], WL = [];
for (let p = 0; p < N; p++) {
  const m = MAT[p], fog = min(1, 7 / ZB[p]);
  if (m === WALL || m === END) TONE[p] = (0.85 + 0.3 * hash(REF[p] * 7 + 2)) * (0.5 + 0.5 * fog);
  if (m === WALL) {
    const dz = ZB[p] - HOUSES[REF[p]][3] - 0.42, dh = HB[p] - 1.6;
    LAMP[p] = abs(dz) < 0.09 && abs(dh) < 0.12 ? 3 : exp(-(dz * dz + dh * dh) / 0.35) * 0.9;
  }
  if (m === WIN) (TONE[p] = 0.15 + 0.85 * fog * fog), WIDS.add(REF[p]);
  STAR[p] = m === SKY && hash(p * 3 + 1) < 0.015;
  // The ground and the walls, the only LEDs the lights walk.
  if (m === GROUND) GL.push(p);
  else if (m !== SKY && m !== ROOF) WL.push(p);
}
// The walls in order of depth, and where each quarter unit of depth starts.
WL.sort((a, b) => ZB[a] - ZB[b]);
const WZ = new Int32Array(330);
for (let i = 0, j = 0; i < 330; i++) {
  while (j < WL.length && ZB[WL[j]] < i / 4) j++;
  WZ[i] = j;
}
const wallFrom = (z) => WZ[min(329, floor(z * 4))];
// Where each row starts among the ground LEDs, and those between two depths.
const GROW = new Int32Array(H + 1);
for (let y = 0, j = 0; y <= H; y++) {
  while (j < GL.length && GL[j] < y * W) j++;
  GROW[y] = j;
}
const rowsFor = (za, zb) => [GROW[cl(floor(YH + (G * ZN) / zb), 0, H)], GROW[cl(floor(YH + (G * ZN) / max(za, 0.1)) + 2, 0, H)]];

// A house is lit while its rank is under Lights, and only lit houses open
// their doors to the children.
const RANK = HOUSES.map((h, i) => hash(i * 29 + 185));
// Jack-o'-lanterns on the step at each door, one or two: [x, z, seed, house].
const PUMPKINS = [];
HOUSES.forEach(([side, , , zd], i) => {
  PUMPKINS.push([side * 0.84, zd - 0.42, i * 2, i]);
  if (hash(i * 5 + 9) < 0.5) PUMPKINS.push([side * 0.86, zd + 0.42, i * 2 + 1, i]);
});
// Their glow on the ground and the porch lamps', laid down once with whose
// light it is, for the flicker and for Lights.
const PG = new Float32Array(N), PS = new Int16Array(N), LG = new Float32Array(N), LS = new Int16Array(N);
for (const p of GL) {
  PUMPKINS.forEach(([px, pz], i) => {
    const r2 = (XB[p] - px) ** 2 + (ZB[p] - pz) ** 2, f = r2 < 0.4 ? (1 - r2 / 0.4) * 0.6 : 0;
    if (f > PG[p]) (PG[p] = f), (PS[p] = i);
  });
  HOUSES.forEach(([side, , , zd], i) => {
    const r2 = (XB[p] - side) ** 2 * 0.6 + (ZB[p] - zd - 0.4) ** 2, f = r2 < 1.1 ? (1 - r2 / 1.1) ** 2 * 0.42 : 0;
    if (f > LG[p]) (LG[p] = f), (LS[p] = i);
  });
}

export function setup(params) {
  params.s = {
    t: 0, mx: 0, hue: 0, speed: 2, lights: 0.5, wind: 0.06, begun: false, groups: [], leaves: [], tap: -1, tapT: 0,
    open: new Float32Array(HOUSES.length), rgb: new Float32Array(N * 3), lit: new Float32Array(N * 3), wc: new Float32Array(96 * HOUSES.length), hueKey: -1,
  };
}

// A group of three, a bedsheet ghost, a little witch and a cat, walking
// together from one lit door to the next, zigzagging up the street.
const SLOTS = [[-0.34, 0.1], [0, -0.05], [0.34, 0.18]];
const newGroup = (z) => ({
  x: 0, z, tx: 0, tz: z, wait: 0, door: -1, side: -1, done: false,
  kids: SLOTS.map(([x, dz], type) => ({ type, x, z: z + dz, ph: Math.random() * TAU, sw: Math.random() * TAU, candy: 0 })),
});
// The next lit door at least 1.6 ahead of z on one side, and its depth.
function nextDoor(S, side, z) {
  let best = -1;
  HOUSES.forEach(([sd, , , zd], i) => {
    if (sd === side && RANK[i] < S.lights && zd > z + 1.6 && (best < 0 || zd < HOUSES[best][3])) best = i;
  });
  return best;
}
const doorZ = (i) => (i < 0 ? 1e9 : HOUSES[i][3]);

function steer(S, g) {
  if (g.z > 15 || g.done) return Object.assign(g, { done: true, door: -1, tx: 0, tz: 200 });
  g.door = nextDoor(S, g.side, g.z);
  // A dark stretch on this side: cross over, or walk on.
  if (doorZ(g.door) > g.z + 6) g.door = nextDoor(S, (g.side = -g.side), g.z);
  if (doorZ(g.door) > g.z + 6) Object.assign(g, { door: -1, tx: 0, tz: g.z + 3 });
  // They wait on the path just short of the door, so it shows past them.
  else Object.assign(g, { tx: g.side * 0.3, tz: doorZ(g.door) - 0.55 });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.5, 0.06], ds = (cl(dt || 0, 0, 0.1) * cl(k[1], 0.2, 3)) / 2;
  [S.hue, S.lights, S.wind] = [cl(k[0], 0, 1), cl(k[2], 0.5, 1), cl(k[3], 0, 1)];
  S.t += ds;
  const gust = 0.5 + vn(S.t * 0.4, 9);
  S.mx += ds * (0.3 + 2.4 * S.wind) * gust;
  if (!S.begun) {
    S.begun = true;
    // One group already far up the street, one halfway, one just come in.
    const far = newGroup(16), mid = newGroup(9.2), near = newGroup(2.7);
    far.done = true;
    near.side = doorZ(nextDoor(S, -1, 2.7)) < doorZ(nextDoor(S, 1, 2.7)) ? -1 : 1;
    for (const g of [far, mid, near]) steer(S, g), S.groups.push(g);
  }
  // A new group comes in from the bottom once the last is far enough on.
  const last = S.groups[S.groups.length - 1];
  if (!last || last.z > 9) {
    const g = newGroup(2.4);
    steer(S, g);
    S.groups.push(g);
  }
  if (input.btnPressed && input.btnPressed[0]) {
    const c = HOUSES.map((h, i) => i).filter((i) => HOUSES[i][3] > 4 && HOUSES[i][3] < 14 && RANK[i] < S.lights);
    S.tap = c[floor(Math.random() * c.length)];
    S.tapT = 3;
  }
  const want = new Float32Array(HOUSES.length);
  if ((S.tapT -= ds) > 0) want[S.tap] = 1;
  for (const g of S.groups) {
    if (g.wait > 0) {
      want[g.door] = 1;
      if ((g.wait -= ds) <= 0) {
        for (const kd of g.kids) kd.candy++;
        g.side = -g.side;
        steer(S, g);
      }
    } else {
      // 0.95 lane widths a second at Speed 2; the door opens as they come.
      const dx = g.tx - g.x, dz = g.tz - g.z, l = sqrt(dx * dx + dz * dz), st = 0.95 * ds;
      if (l <= st) {
        [g.x, g.z] = [g.tx, g.tz];
        if (g.door >= 0) g.wait = 2.2;
        else steer(S, g);
      } else (g.x += (dx / l) * st), (g.z += (dz / l) * st);
      if (g.door >= 0 && l < 0.5) want[g.door] = 1;
    }
    const walk = g.wait <= 0, f = min(1, ds * 4);
    g.kids.forEach((kd, i) => {
      // Each child trails its place in the group a little.
      kd.x += (g.x + SLOTS[i][0] * (walk ? 1 : 0.8) - kd.x) * f;
      kd.z += (g.z + SLOTS[i][1] - kd.z) * f;
      if (walk) kd.ph += ds * TAU * 1.9;
      kd.sw += ds * (walk ? 2.3 : 0.9);
      [kd.walk, kd.side] = [walk, g.side];
    });
  }
  S.groups = S.groups.filter((g) => g.z < 40);
  for (let i = 0; i < HOUSES.length; i++) S.open[i] += (want[i] - S.open[i]) * min(1, ds * (want[i] ? 5 : 2));
  // Leaves blown across the street, tumbling; more, faster and higher with wind.
  const n = round(30 + 210 * S.wind);
  while (S.leaves.length < n) S.leaves.push(leaf(Math.random() * 2 - 1));
  S.leaves.length = n;
  for (const lf of S.leaves) {
    lf.x += ds * (0.3 + 3.2 * S.wind) * lf.sp * gust;
    lf.ph += ds * (7 + 10 * S.wind) * lf.sp;
    lf.h = abs(sin(lf.ph * 0.4)) * (0.06 + 1.6 * S.wind) * lf.sp;
    if (lf.x > 1) Object.assign(lf, leaf(-1));
  }
}
const leaf = (x) => ({ x, z: 2.4 + Math.random() * Math.random() * 11, h: 0, ph: Math.random() * TAU, c: floor(Math.random() * 3), sp: 0.6 + 0.8 * Math.random() });

// Bats over the roofs, each on its own path through the sky, beating its
// wings 6 to 9 times a second; every third is nearer and twice the size.
const BATW = [["x...x", ".xxx.", "..x.."], ["xxxxx", ".xxx."], [".xxx.", "x.x.x"]];
function drawBats(buf, t) {
  for (let i = 0; i < 9; i++) {
    const x = round(32 + 26 * (vn(t * 0.35 + i * 3.1, i * 5 + 1) * 2 - 1)), y = round(3 + 20 * vn(t * 0.3 + i * 1.7, i * 5 + 2));
    const w = BATW[floor((t * (6 + i * 0.7) + i * 0.37) * 3) % 3], z = i % 3 ? 1 : 2;
    for (let j = 0; j < w.length * z; j++)
      for (let k = 0; k < 5 * z; k++) {
        const px = x - 2 * z + k;
        if (w[(j / z) | 0][(k / z) | 0] === "x" && px >= 0 && px < W) put(buf, ((y + j) * W + px) * 3, 10, 4, 16);
      }
  }
}

// Costumes seen from behind, in units of the child's height: u across, v up
// from the feet. Each returns a colour or null.
const WHITE = [236, 232, 255], SHADE = [176, 170, 214], SHOE = [40, 30, 50], SOCK = [255, 150, 30];
const HAT = [24, 14, 36], BAND = [170, 70, 240], CAPE = [112, 44, 168], HAIR = [120, 230, 60], BROOM = [150, 104, 60], STRAW = [236, 196, 90];
const CAT = [30, 24, 40], RIM = [110, 92, 146], BUCKET = [255, 136, 16], CANDY = [255, 70, 190];
function costume(type, u, v, ph, sw) {
  if (v < 0.09 && abs(abs(u) - 0.07) < 0.05 && v >= 0.04 * max(0, u < 0 ? sin(ph) : -sin(ph))) return type === 1 ? (floor(v * 50) & 1 ? SOCK : HAT) : SHOE;
  if (type === 0) {
    // The sheet: a round top, wider to a hem that ripples as they walk.
    if (v < 0.08 + 0.03 * sin(u * 34 + ph * 2) || v > 0.95) return null;
    const half = v > 0.72 ? sqrt(max(0, 0.042 - (v - 0.72) ** 2)) : 0.205 + 0.1 * (0.72 - v);
    return abs(u) > half ? null : u > half - 0.07 ? SHADE : WHITE;
  }
  if (type === 1) {
    // The witch: a bent hat with band and brim, green hair, a broom.
    const t = (v - 0.81) / 0.33, a = 0.13 * ((0.64 - v) / 0.55), bu = u + 0.3 - 0.55 * (v - 0.1);
    if (t >= 0 && t <= 1 && abs(u - 0.07 * t * t) < 0.13 * (1 - t)) return t < 0.12 ? BAND : HAT;
    if (v >= 0.76 && v < 0.81 && abs(u) < 0.25) return HAT;
    if ((u * u) / 0.012 + (v - 0.69) ** 2 / 0.009 < 1) return HAIR;
    if (v >= 0.09 && v < 0.64 && abs(u) < 0.12 + a) return abs(u) > 0.09 + a ? RIM : CAPE;
    if (v > 0.22 && v < 0.98 && abs(bu) < 0.03) return BROOM;
    return v >= 0.04 && v <= 0.22 && abs(bu) < 0.02 + 0.5 * (0.22 - v) ? STRAW : null;
  }
  // The cat: a black suit, round head, two ears and a tail that sways.
  if (u > 0.06 && u < 0.38 && v > 0.17 && v < 0.69)
    for (let i = 0; i <= 12; i++) {
      const a = i / 12;
      if ((u - 0.12 - 0.17 * a - 0.04 * sin(a * 3 + sw)) ** 2 + (v - 0.22 - 0.42 * a * a) ** 2 < 0.0011) return RIM;
    }
  const ear = v >= 0.84 && v < 0.99 && abs(abs(u) - 0.085) < 0.055 * ((0.99 - v) / 0.15);
  return u * u + (v - 0.76) ** 2 < 0.018 || ear || (v >= 0.09 && v < 0.68 && abs(u) < 0.135 + 0.03 * sin(v * 5)) ? CAT : null;
}

function drawKid(buf, kd) {
  const s = sOf(kd.z), hp = 0.92 * R * s, xs = 32 + kd.x * R * s, ys = YH + G * s, bob = kd.walk ? 0.025 * abs(sin(kd.ph)) : 0;
  // The pumpkin bucket swings from one hand, the cat's left and the others' right.
  const ba = kd.walk ? 0.45 * sin(kd.ph) : 0.15 * sin(kd.sw * 3), bcx = (kd.type === 2 ? -0.25 : 0.25) + 0.12 * sin(ba), bcy = 0.42 - 0.12 * cos(ba);
  for (let y = max(0, floor(ys - 1.18 * hp)); y <= min(H - 1, floor(ys)); y++)
    for (let x = max(0, floor(xs - 0.5 * hp)); x <= min(W - 1, floor(xs + 0.5 * hp)); x++) {
      const u = (x + 0.5 - xs) / hp, v = (ys - y - 0.5) / hp - bob, o = (y * W + x) * 3;
      let c = (u - bcx) ** 2 + (v - bcy) ** 2 < 0.0064 ? (kd.candy && v > bcy + 0.03 ? CANDY : BUCKET) : costume(kd.type, u, v, kd.ph, kd.sw);
      if (!c) continue;
      // Black cloth gets a moonlit outline, or it vanishes on the street.
      if (c === CAT || c === HAT) {
        const e = 1 / hp, out = (du, dv) => !costume(kd.type, u + du, v + dv, kd.ph, kd.sw);
        if (out(e, 0) || out(-e, 0) || out(0, e)) c = RIM;
      }
      put(buf, o, c[0], c[1], c[2]);
    }
}

function drawPumpkin(buf, [px, pz, sd], t) {
  const s = sOf(pz), w = 0.17 * R * s, xs = 32 + px * R * s, ys = YH + G * s, fl = 0.72 + 0.28 * vn(t * 9, sd);
  for (let y = max(0, floor(ys - 1.9 * w)); y <= min(H - 1, floor(ys)); y++)
    for (let x = max(0, floor(xs - w - 1)); x <= min(W - 1, floor(xs + w + 1)); x++) {
      const u = (x + 0.5 - xs) / w, v = (ys - y - 0.5) / w, o = (y * W + x) * 3;
      if (u * u + (v - 0.78) ** 2 / 0.6 < 1) {
        // Ribbed bright orange; from 5 LEDs across, two eyes and a grin.
        const face = w > 2.4 && ((abs(abs(u) - 0.38) < 0.17 && v > 0.95 && v < 1.25) || (abs(u) < 0.55 && v > 0.42 && v < 0.62 && abs(u * 4) % 1 < 0.75));
        if (face) put(buf, o, 255, 236 * fl, 120 * fl);
        else put(buf, o, 255 * fl, (abs(u) % 0.5 < 0.12 ? 108 : 140) * fl, 12);
      } else if (abs(u) < 0.14 && v >= 1.4 && v < 1.75) put(buf, o, 90, 120, 30);
    }
}

// A dead leaf, catching the light as it tumbles.
const LEAF = [[240, 124, 30], [230, 176, 50], [214, 76, 34]];
function drawLeaf(buf, lf, wind) {
  const s = sOf(lf.z), xs = floor(32 + lf.x * R * s), ys = floor(YH + G * s - lf.h * R * s), sz = max(1, round((0.11 + 0.04 * wind) * R * s));
  const c = LEAF[lf.c], f = 0.55 + 0.4 * abs(sin(lf.ph * 2)), th = max(1, round(sz * 0.6 * abs(cos(lf.ph))));
  for (let j = 0; j < th; j++)
    for (let i = 0; i < sz; i++) if (xs + i >= 0 && xs + i < W && ys - j >= 0 && ys - j < H) put(buf, ((ys - j) * W + xs + i) * 3, c[0] * f, c[1] * f, c[2] * f);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.begun) return;
  const { rgb, lit, open, wc } = S, t = S.t, on = (i) => RANK[i] < S.lights;
  // A stepped sky, lighter towards the vanishing point, walls, roofs, road.
  if (S.hueKey !== S.hue) {
    const h = 0.76 + (S.hueKey = S.hue);
    S.sky = Array.from({ length: YH + 1 }, (_, y) => hsv(h + 0.01, 0.75 - floor((y / YH) * 6) / 24, 0.3 + (floor((y / YH) * 6) / 6) * 0.42));
    [S.wall, S.end, S.roof] = [hsv(h, 0.55, 0.19), hsv(h, 0.5, 0.29), hsv(h, 0.5, 0.06)];
    S.road = [hsv(h - 0.06, 0.45, 0.14), hsv(h - 0.04, 0.4, 0.2), hsv(h - 0.04, 0.35, 0.3), hsv(h - 0.31, 0.3, 0.07)];
  }
  lit.fill(0);
  // Torch beams: the ghost and the cat wave a cone of light from the hand,
  // mostly over the street ahead, now and then up the house fronts.
  for (const g of S.groups)
    for (const kd of g.kids) {
      if (kd.type === 1 || kd.z > 14) continue;
      const ang = (kd.walk ? 0 : kd.side * 0.7) + 0.7 * sin(kd.sw * 2.2 + kd.type * 2) + 0.22 * sin(kd.sw * 5.1 + kd.type);
      const pit = -0.19 + 0.36 * max(0, sin(kd.sw * 1.1 + kd.type * 1.3)) ** 2, dx = sin(ang) * cos(pit), dy = sin(pit), dz = cos(ang) * cos(pit);
      const cone = (p, wx, wy, wz) => {
        const f = wx * dx + wy * dy + wz * dz, r = sqrt(max(0, wx * wx + wy * wy + wz * wz - f * f)) / f;
        if (f < 0.3 || f > 5 || r > 0.24) return;
        const v = (r < 0.12 ? 1 : 0.55) * min(1, (0.24 - r) * 25) * min(1, (f - 0.3) * 2) * min(1, 2.6 / (f + 0.5));
        add(lit, p * 3, 255 * v, 236 * v, 190 * v);
      };
      const [j0, j1] = rowsFor(kd.z + 0.3, kd.z + 5);
      for (let j = j0; j < j1; j++) cone(GL[j], XB[GL[j]] - kd.x, -0.4, ZB[GL[j]] - kd.z);
      for (let j = wallFrom(kd.z + 0.2), j2 = wallFrom(kd.z + 5.2); j < j2; j++) {
        const p = WL[j], side = (p & 63) < 32 ? -1 : 1;
        cone(p, (MAT[p] === END ? side * (1 + XB[p]) : side) - kd.x, HB[p] - 0.4, ZB[p] - kd.z);
      }
    }
  // Open doors throw a wedge of yellow light across the street.
  HOUSES.forEach(([side, , , zd], i) => {
    if (open[i] < 0.02) return;
    const [j0, j1] = rowsFor(zd - 1.4, zd + 1.4);
    for (let j = j0; j < j1; j++) {
      const p = GL[j], dd = 1 - XB[p] * side, w = 0.28 + 0.4 * dd, dz = abs(ZB[p] - zd);
      if (dd < 0 || dd > 1.9 || dz > w) continue;
      const f = open[i] * (1 - dd / 2.1) * min(1, (w - dz) * 8) * 1.2;
      add(lit, p * 3, 255 * f, 196 * f, 70 * f);
    }
  });
  // This frame's flicker of each pumpkin and colour of each window: a lamp,
  // a guttering jack-o'-lantern, or a television cutting from shot to shot.
  const PF = PUMPKINS.map(([, , , i], k) => (on(i) ? 0.3 + 0.7 * vn(t * 11, k) : 0));
  for (const id of WIDS) {
    let c = [S.wall[0] * 0.6, S.wall[1] * 0.6, S.wall[2] * 0.6], f;
    if (on(id >> 5) && hash(id * 3 + 7) <= 0.3 + 0.7 * S.lights) {
      if (hash(id * 11 + 3) < 0.25) (f = 0.35 + 0.65 * hash(floor(t * 5 + hash(id)) * 31 + id)), (c = [140 * f, 166 * f, 255 * f]);
      else if (hash(id * 5 + 1) < 0.3) (f = 0.5 + 0.5 * vn(t * 9, id)), (c = [255 * f, 132 * f, 20 * f]);
      else (f = 0.85 + 0.15 * vn(t * 1.5, id)), (c = [255 * f, 200 * f, 96 * f]);
    }
    put(wc, id * 3, c[0], c[1], c[2]);
  }
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const m = MAT[p];
    if (m === SKY) {
      const c = S.sky[min(YH, (p / W) | 0)], st = STAR[p] ? 0.3 + 0.7 * vn(t * 3, p) : 0;
      put(rgb, o, c[0] + 160 * st, c[1] + 150 * st, c[2] + 170 * st);
    } else if (m === GROUND) {
      // Road, curb, pavement and dark yards, the pumpkins' and porch lamps'
      // light, and a low mist drifting with the wind, glowing where lit.
      const z = ZB[p], ax = abs(XB[p]), pg = PG[p] * PF[PS[p]], lg = on(LS[p]) ? LG[p] : 0, base = S.road[ax > 1 ? 3 : ax > 0.8 ? 1 : ax > 0.74 ? 2 : 0], fg = min(1, 2.4 / z);
      const mn = 0.65 * vn2((XB[p] - S.mx) * 1.6, z * 0.7 + t * 0.05) + 0.35 * vn2((XB[p] - S.mx * 1.4) * 3.3 + 7, z * 1.5), mi = cl((mn - 0.42) * 2.2, 0, 1) * min(1, 3.5 / z) * (ax > 1 ? 0.3 : 0.7);
      const R0 = base[0] * fg + 255 * pg + 250 * lg, G0 = base[1] * fg + 118 * pg + 190 * lg, B0 = base[2] * fg + 20 * pg + 110 * lg, k = 0.4 * mi;
      put(rgb, o, R0 + lit[o] * (0.8 + k) + (52 + R0 * 0.5) * mi, G0 + lit[o + 1] * (0.78 + k) + (44 + G0 * 0.5) * mi, B0 + lit[o + 2] * (0.88 + k) + (78 + B0 * 0.3) * mi);
    } else if (m === WALL || m === END) {
      const c = m === END ? S.end : S.wall, tone = TONE[p], r = on(REF[p]) ? LAMP[p] : 0;
      put(rgb, o, c[0] * tone + 255 * r + lit[o] * 0.42, c[1] * tone + 196 * r + lit[o + 1] * 0.36, c[2] * tone + 110 * r + lit[o + 2] * 0.26);
    } else if (m === ROOF) put(rgb, o, S.roof[0], S.roof[1], S.roof[2]);
    else if (m === DOOR) put(rgb, o, 44 + 211 * open[REF[p]], 28 + 198 * open[REF[p]], 38 + 92 * open[REF[p]]);
    else put(rgb, o, wc[REF[p] * 3] * TONE[p], wc[REF[p] * 3 + 1] * TONE[p], wc[REF[p] * 3 + 2] * TONE[p]);
  }
  drawBats(rgb, t);
  // Pumpkins, children and leaves, far to near.
  const sp = [];
  for (const pk of PUMPKINS) if (pk[1] > 2.6 && pk[1] < 22 && on(pk[3])) sp.push([pk[1], 0, pk]);
  for (const g of S.groups) for (const kd of g.kids) sp.push([kd.z, 1, kd]);
  for (const lf of S.leaves) sp.push([lf.z, 2, lf]);
  sp.sort((a, b) => b[0] - a[0]);
  for (const [, kind, obj] of sp) kind ? (kind === 1 ? drawKid(rgb, obj) : drawLeaf(rgb, obj, S.wind)) : drawPumpkin(rgb, obj, t);
  // Each channel in steps of 4 of 255.
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, rgb[o]) & 252, min(255, rgb[o + 1]) & 252, min(255, rgb[o + 2]) & 252);
}
