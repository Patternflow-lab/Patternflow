// ===== Patternflow pattern =====
// Title:   Chemical Garden
// Family:  chemistry
// Idea:    Metal-salt crystals dropped into a tall glass of water-glass solution on a lab bench sprout hollow mineral tubes in cobalt blue, copper turquoise, rust, nickel green, manganese pink and calcium white that wobble up towards the surface, burst and bud sideways, until the glass is full and a fresh one slides in.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 21, after the chemical garden (silicate garden) of the school chemistry lab
// Round:   21
// ===============================
// @matrix 64x128
// @knobs Salts=0..4, Speed=0.2..3, Crystals=5..20, Strength=-1..1
//
// Knob 1: Salts. What goes into the glass: all six salts at 0 (cobalt chloride's blue-violet, copper sulfate's turquoise, iron(III) chloride's rust, nickel sulfate's green, manganese chloride's pink, calcium chloride's white), the cool cobalt, copper and calcium at 1, the warm iron, manganese and calcium at 2, the greens of nickel and copper at 3, cobalt alone at 4.
// Knob 2: Speed. How fast the garden grows: at 2 a tube that races takes about 11 s from its crystal to the surface and a glass lasts about half a minute before the next slides in; at 0.2 it creeps.
// Knob 3: Crystals. How many crystals are dropped in, 5 to 20; each sends up four to six tubes as it dissolves, and those bud more. Turned up mid-glass, the extra crystals drop in at once.
// Knob 4: Strength. How strong the water glass is: near 0 the usual mix, towards -1 a thin solution where hair-fine threads shoot up in 6 s and wriggle, towards 1 a thick one where fat tubes take 18 s and bud into knobbly branches.
// Buttons: K1 tap slides the glass away and brings in a fresh one.

const W = 64;
const H = 128;
const N = W * H;
const { min, max, floor, round, ceil, sin, abs, sqrt, exp, hypot } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (x) => ((x = cl(x, 0, 1)), x * x * (3 - 2 * x));

// The glass in its own columns (walls at 3..4 and 59..60), so sliding it is
// one offset. The rim, the solution's surface and the sand's top are
// ellipses seen from a little above; z is depth, 0 at the front pane.
const GL = 3;
const GR = 60;
const IL = 5;
const IR = 58;
const RIM = 4;
const SY = 13;
const SAND = 104;
const BOT = 110;
const BENCH = 114;
const [HR, HS, HD] = [2.2, 2.2, 2.6];
const ell = (x) => sqrt(max(0, 1 - ((x - 31.5) / 28) ** 2));
const surfAt = (x, z) => SY + HS * ell(x) * (1 - 2 * z);
const sandAt = (x, z) => SAND + HD * ell(x) * (1 - 2 * z);
const [OUT, AIR, SOL, TOPS, SIDE, WALL, SHEET, BASE] = [0, 1, 2, 3, 4, 5, 6, 7];
const GROWS = [0, 0, 1, 1, 1, 0, 1, 0];
const [GROW, HOLD, SWAP] = [0, 1, 2];
const SLIDE = 70;
const MAXT = 900;

// Each salt: the colour of its silicate tube, the colour of the crystal as
// it goes in (cobalt chloride goes in pink and grows blue), and how fast and
// how fat its tubes grow: iron's rust threads shoot up, calcium's white tubes
// push up slow and thick.
const SALT = [
  [[96, 76, 246], [222, 52, 112], 1.1, 0.9],
  [[30, 184, 214], [40, 108, 255], 0.95, 1],
  [[255, 122, 30], [200, 150, 34], 1.3, 0.72],
  [[118, 224, 74], [58, 198, 126], 0.85, 1.15],
  [[255, 168, 184], [240, 170, 186], 0.8, 1.05],
  [[232, 234, 224], [244, 244, 238], 0.72, 1.4],
];
const SETS = [[0, 1, 2, 3, 4, 5], [0, 1, 5], [2, 4, 5], [3, 1], [0]];
const saltOf = (P, J, si) => SALT[SETS[P.set][J.seeds[si].slot % SETS[P.set].length]];

// The room: a dark wall with a frosted globe lamp behind the glass. The
// solution seen against it is faintly yellow-green and a little cloudy.
function paint(P) {
  const WL = (P.wl = new Float32Array(N * 3));
  const LA = (P.la = new Float32Array(N));
  const SO = (P.so = new Float32Array(N * 3));
  for (let y = 0; y < BENCH; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const d = hypot((x + 0.5 - 32) * 1.15, y + 0.5 - 44);
      const bulb = exp(-((d / 9) ** 2));
      const glow = exp(-((d / 24) ** 2));
      LA[p] = 0.45 * bulb + 0.75 * glow;
      const n = (rnd() - 0.5) * 3;
      const a = 0.12 * bulb + 0.25 * glow;
      WL.set([11 + 255 * a + n, 12 + 234 * a + n, 17 + 194 * a + n], p * 3);
      const deep = 1 - (0.16 * max(0, y - SY)) / 95;
      SO.set([(WL[p * 3] * 0.9 + 7) * deep, (WL[p * 3 + 1] * 0.98 + 10) * deep, (WL[p * 3 + 2] * 0.78 + 7) * deep], p * 3);
    }
}

// The glass, its sand and its base, in the glass's own columns. C holds the
// opaque colours, M darkens the solution towards the walls, O is the front
// pane's reflections, added last.
function glass(P) {
  const K = (P.jk = new Uint8Array(N));
  const C = (P.jc = new Float32Array(N * 3));
  const M = (P.jm = new Float32Array(N));
  const O = (P.jo = new Float32Array(N * 3));
  const put = (A, x, y, c) => A.set(c, (y * W + x) * 3);
  for (let y = 0; y < BENCH; y++)
    for (let x = GL; x <= GR; x++) {
      const p = y * W + x;
      const e = ell(x);
      const u = (x + 0.5 - 31.5) / 28;
      const lamp = exp(-(((y - 46) / 30) ** 2));
      M[p] = 0.7 + 0.3 * sqrt(max(0, 1 - u * u));
      const yc = y + 0.5;
      let k = OUT;
      if (y >= BOT) {
        k = BASE;
        if (y === BENCH - 1 && (x === GL || x === GR)) k = OUT;
      } else if (x < IL || x > IR) k = y >= RIM ? WALL : OUT;
      else if (yc < RIM - HR * e - 0.6) k = OUT;
      else if (yc < SY - HS * e) k = AIR;
      else if (yc < SY + HS * e) k = SHEET;
      else if (yc < SAND - HD * e) k = SOL;
      else if (yc < SAND + HD * e) k = TOPS;
      else k = SIDE;
      K[p] = k;
      const gr = 0.8 + 0.4 * rnd();
      if (k === WALL) {
        // The outer edge of each wall catches the lamp; the glass's thickness, seen edge on, is dark.
        const c = x === GL ? 0.55 + 0.75 * lamp : x === GR ? 0.4 + 0.5 * lamp : x === GL + 1 ? 0.1 : 0.14;
        put(C, x, y, [110 * c, 140 * c, 134 * c]);
      } else if (k === BASE) {
        const c = y === BOT ? 0.95 - 0.35 * abs(u) : y === BENCH - 1 ? 0.62 : 0.3 + 0.1 * sin(x * 0.7);
        put(C, x, y, [100 * c, 136 * c, 126 * c]);
      } else if (k === TOPS) put(C, x, y, [176 * gr, 160 * gr, 124 * gr]);
      else if (k === SIDE) {
        // Sand through the front pane, darker low down, in faint layers.
        const f = (0.8 - (0.32 * (y - SAND)) / 6 + 0.08 * sin(y * 2.1 + x * 0.15)) * gr;
        put(C, x, y, [150 * f, 134 * f, 100 * f]);
      } else if (k === SHEET) put(C, x, y, [34, 44, 42]);
    }
  // The rim's lips and the meniscus, smoothed over two rows, with the room's
  // window caught on the left.
  const line = (x, yc, c) => {
    for (let y = floor(yc - 1); y <= floor(yc + 1); y++) {
      const w = max(0, 1 - abs(y + 0.5 - yc));
      for (let i = 0; i < 3; i++) O[(y * W + x) * 3 + i] += c[i] * w;
    }
  };
  for (let x = IL; x <= IR; x++) {
    const e = ell(x);
    const gl = x > 8 && x < 19 ? 1.6 : 1;
    line(x, RIM - HR * e, [56, 70, 68]);
    line(x, RIM + HR * e, [140 * gl, 158 * gl, 152 * gl]);
    line(x, RIM + HR * e + 1, [26, 34, 32]);
    line(x, SY - HS * e, [26, 36, 34]);
    line(x, SY + HS * e, [100 * gl, 124 * gl, 116 * gl]);
  }
  for (let y = 16; y < 100; y++) {
    const f = sin((Math.PI * (y - 16)) / 84);
    for (let c = 0; c < 3; c++) {
      O[(y * W + 9) * 3 + c] += 16 * f;
      O[(y * W + 10) * 3 + c] += 9 * f;
      O[(y * W + 52) * 3 + c] += 8 * f;
    }
  }
}

function jar() {
  return { tid: new Int16Array(N), sh: new Float32Array(N), zb: new Float32Array(N), bo: new Float32Array(N), on: false, off: 0, g: 0, tips: [], tubes: [], seeds: [], bub: [], pops: [], motes: [], done: false };
}

function addSeed(P, J, x, t0) {
  const z = rnd();
  J.seeds.push({ x, z, y: -2, rest: sandAt(x, z) - 0.6, slot: J.seeds.length + J.rot, t0, land: -1, wet: 0, m: 0, mid: -1, next: 0, left: 4 + floor(rnd() * 3), sz: rnd() });
}

// A fresh glass: clean sand and the crystals waiting to go in.
function fresh(P, J) {
  J.tid.fill(-1);
  J.zb.fill(9);
  Object.assign(J, { g: 0, tips: [], tubes: [], seeds: [], bub: [], pops: [], done: false, up: 0, full: 50, rot: floor(rnd() * 6) });
  const n = P.nc;
  const order = Array.from({ length: n }, (_, i) => i).sort(() => rnd() - 0.5);
  for (let i = 0; i < n; i++) addSeed(P, J, IL + 4 + ((i + 0.5 + (rnd() - 0.5) * 0.7) * (IR - IL - 8)) / n, 0.3 + order[i] * (2.2 / n + 0.1));
  J.motes = Array.from({ length: 14 }, () => [IL + rnd() * (IR - IL), SY + 4 + rnd() * 86, 0.6 + rnd() * 1.6, rnd() * 7]);
}

// One disc of membrane, shaded across the tube's direction (dx, dy): the
// wall seen edge on at each side, a sheen on the left.
function stamp(P, J, x, y, r, dx, dy, id, z, ring) {
  const K = P.jk;
  for (let py = max(RIM, floor(y - r)); py <= min(BOT - 1, ceil(y + r)); py++)
    for (let px = max(IL, floor(x - r)); px <= min(IR, ceil(x + r)); px++) {
      const ex = px + 0.5 - x;
      const ey = py + 0.5 - y;
      if (ex * ex + ey * ey > r * r) continue;
      const q = py * W + px;
      if (!GROWS[K[q]] || z > J.zb[q] + 0.002) continue;
      const s = (ex * dy - ey * dx) / r;
      J.tid[q] = id;
      J.zb[q] = z;
      J.bo[q] = J.g;
      J.sh[q] = (0.42 + 0.58 * sqrt(max(0, 1 - s * s))) * ring * (0.9 + 0.2 * rnd()) + 0.3 * exp(-(((s - 0.45) / 0.3) ** 2));
    }
}

function tip(P, J, o) {
  if (J.tubes.length >= MAXT) return;
  o.id = J.tubes.push(o.seed) - 1;
  J.tips.push(Object.assign({ age: 0, len: 0, cap: 0, dir: 1, ph: rnd() * 7, rt: o.r, wan: 0 }, o));
}

// A crystal sends up a new tube from its skin: one in three races for the
// surface, the rest give out somewhere on the way.
function sprout(P, J, S, si) {
  const race = rnd() < 0.32;
  const rs = (0.75 + 0.5 * rnd()) * (1.12 - 0.25 * S.z);
  tip(P, J, {
    seed: si, x: S.x + (rnd() - 0.5) * (2 * S.m + 3), y: S.rest - S.m * 0.8, a: (rnd() - 0.5) * 0.9, a0: (rnd() - 0.5) * 0.8,
    r: P.r0 * rs * saltOf(P, J, si)[3], rs, v: race ? 0.95 + 0.3 * rnd() : 0.45 + 0.55 * rnd(), fuel: race ? 999 : 10 + 75 * rnd() ** 1.3,
    z: cl(S.z + (rnd() - 0.5) * 0.08, 0, 1), y0: S.rest, bub: rnd() < 0.22,
  });
}

function grow(P, J, d) {
  const g = (J.g += d);
  if (J.seeds.length < P.nc && g < 30) addSeed(P, J, IL + 4 + rnd() * (IR - IL - 8), g + 0.1);
  J.seeds.forEach((S, si) => {
    if (g < S.t0) return;
    if (S.land < 0) {
      // Through the air to the surface, then sinking slowly through the thick solution.
      const surf = surfAt(S.x, S.z);
      if (S.y < surf) S.y += 110 * d;
      else {
        if (!S.wet) (S.wet = 1), J.pops.push([S.x, surf, 0, 4]);
        S.y += (38 + 14 * S.sz) * d;
      }
      if (S.y >= S.rest) [S.y, S.land, S.next] = [S.rest, g, g + 0.6 + rnd() * 0.9];
      return;
    }
    // The crystal coats in a skin of silicate that swells as it dissolves.
    if (S.mid < 0) S.mid = J.tubes.push(si) - 1;
    const m = min(1, (g - S.land) / 1.8 + (g - S.land) * 0.025) * P.mr * (0.8 + 0.4 * S.sz) * saltOf(P, J, si)[3];
    if (m > S.m + 0.25) {
      S.m = m;
      stamp(P, J, S.x, S.rest - m * 0.45, m, 0, -1, S.mid, S.z, 0.9);
      stamp(P, J, S.x + (S.sz - 0.5) * m, S.rest - m * 0.9, m * 0.7, 0, -1, S.mid, S.z, 1);
    }
    // Air caught in the crystal now and then lets go as a bubble.
    if (rnd() < d * 0.12) J.bub.push([S.x + (rnd() - 0.5) * 2 * m, S.rest - m - 1, S.z]);
    if (S.left > 0 && g >= S.next && g < J.full - 4 && J.tips.length < 80) {
      sprout(P, J, S, si);
      S.left--;
      S.next = g + 1.2 + rnd() * 3.2;
    }
  });
  const born = [];
  for (const T of J.tips) {
    T.age += d;
    // Growth comes in spurts, each time the skin at the open tip splits and seals again.
    const pulse = 0.4 + 0.6 * sqrt(max(0, sin(T.age * 2.6 + T.ph)));
    const sa = saltOf(P, J, T.seed);
    const dist = P.v0 * T.v * sa[2] * (T.bub ? 1.6 : 1) * pulse * d;
    // Each tube wanders off on its own way, back towards upright.
    T.wan = cl(T.wan + (rnd() - 0.5) * 2.4 * d - T.wan * 0.4 * d, -0.3, 0.3);
    let aim = T.wan + T.a0 * exp(-T.age * 0.8) + P.wob * (T.bub ? 0.25 : 1) * (0.7 * sin(T.ph + T.age * 1.9) + 0.3 * sin(T.ph * 1.7 + T.age * 4.3));
    if (T.x < IL + 3) aim += 0.6;
    if (T.x > IR - 3) aim -= 0.6;
    T.a += (aim - T.a) * min(1, d * 4);
    if (T.cap) T.a = T.dir * 1.45;
    if (rnd() < d * 0.6) T.rt = P.r0 * T.rs * sa[3] * (0.6 + 0.9 * rnd());
    T.r += (cl(T.rt, 0.5, 4.2) - T.r) * min(1, d * 1.3);
    const n = max(1, ceil(dist / 0.5));
    const dx = sin(T.a);
    const dy = -Math.cos(T.a);
    for (let i = 0; i < n; i++) {
      T.x = cl(T.x + (dx * dist) / n, IL + 0.5, IR + 0.5);
      if (!T.cap) T.y += (dy * dist) / n;
      T.len += dist / n;
      stamp(P, J, T.x, T.y, T.r, dx, dy, T.id, T.z, 0.92 + 0.1 * sin(T.len * 0.9 + T.ph));
    }
    T.fuel -= dist;
    const top = surfAt(T.x, T.z) + 1.4 + T.r;
    if (!T.cap && T.y <= top) {
      // At the surface it spreads a little way under the skin of the solution.
      Object.assign(T, { cap: 1, y: top, dir: T.a > 0.05 ? 1 : T.a < -0.05 ? -1 : rnd() < 0.5 ? -1 : 1, fuel: 7 + rnd() * 11 });
      if (++J.up === 3) J.full = g + 7;
      if (T.bub) J.pops.push([T.x, surfAt(T.x, T.z), 0, 3]), (T.bub = 0);
    }
    if (T.bub && rnd() < d * 0.22) J.bub.push([T.x, T.y - T.r - 0.5, T.z]), (T.bub = 0);
    // A tube bursts and buds sideways; often the old tip seals over.
    if (!T.cap && g < 34 && J.tips.length + born.length < 80 && T.y < T.y0 - 6 && rnd() < P.bud * d) {
      const sd = rnd() < 0.5 ? -1 : 1;
      stamp(P, J, T.x, T.y, T.r * 1.5, dx, dy, T.id, T.z, 1);
      born.push({ seed: J.tubes[T.id], x: T.x + sd * T.r, y: T.y + rnd() * 2, a: sd * (0.9 + 0.6 * rnd()), a0: sd * (0.9 + 0.5 * rnd()), r: T.r * 0.75, rs: T.rs * 0.75, v: T.v * (0.6 + 0.5 * rnd()), fuel: 8 + rnd() * 40, z: cl(T.z + (rnd() - 0.5) * 0.06, 0, 1), y0: T.y + 6, bub: false });
      if (rnd() < 0.35) T.fuel = 0;
    }
    if (g > J.full) T.fuel = 0;
  }
  J.tips = J.tips.filter((T) => T.fuel > 0);
  for (const o of born) tip(P, J, o);
  J.done = g > J.full || (!J.tips.length && g > 6 && J.seeds.every((S) => S.land >= 0 && !S.left));
  // Bubbles let go of their tubes and rise; rings where things meet the surface.
  J.bub = J.bub.filter((b) => {
    b[1] -= 26 * d;
    b[0] += sin(b[1] * 0.5) * 2 * d;
    if (b[1] > surfAt(b[0], b[2]) + 1) return true;
    J.pops.push([b[0], surfAt(b[0], b[2]), 0, 3]);
    return false;
  });
  for (const p of J.pops) p[2] += d;
  J.pops = J.pops.filter((p) => p[2] < 0.7);
  for (const m of J.motes) {
    m[1] += m[2] * d;
    m[0] += sin(P.clock * 0.7 + m[3]) * 0.8 * d;
    if (m[1] > SAND - 3) [m[0], m[1]] = [IL + rnd() * (IR - IL), SY + 4];
  }
}

function slideIn(P) {
  const nw = P.jars[1 - P.cur];
  fresh(P, nw);
  [nw.on, nw.off, P.phase, P.pt] = [true, -SLIDE, SWAP, 0];
}

export function setup(params) {
  const P = params;
  paint(P);
  glass(P);
  P.jars = [jar(), jar()];
  P.tc = new Float32Array(3 * MAXT);
  P.buf = new Float32Array(N * 3);
  P.cc = new Float32Array(W * 3);
  Object.assign(P, { cur: 0, phase: GROW, pt: 0, clock: 0, started: false, set: 0, rate: 1, nc: 5, str: 0 });
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 5, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  P.set = cl(round(k[0]), 0, 4);
  P.rate = cl(k[1], 0.2, 3) / 2;
  P.nc = cl(round(k[2]), 5, 20);
  const s = (P.str = cl(k[3], -1, 1));
  P.v0 = 11.5 * 1.8 ** -s;
  P.r0 = 1.2 * 1.9 ** s;
  P.wob = 0.3 * 1.8 ** -s;
  P.bud = 0.1 * 1.5 ** s;
  P.mr = 1.7 + 0.9 * (s + 1);
  const d = dt * P.rate;
  P.clock += d;
  const J = P.jars[P.cur];
  if (!P.started) {
    // Open on a garden already some seconds old, further on the faster it grows.
    P.started = true;
    fresh(P, J);
    J.on = true;
    for (let g = 10 + 2.5 * P.rate; g > 0; g -= 1 / 30) grow(P, J, 1 / 30);
  }
  if (input.btnPressed && input.btnPressed[0] && P.phase !== SWAP) slideIn(P);
  if (P.phase !== SWAP) grow(P, J, d);
  if (P.phase === GROW && J.done) [P.phase, P.pt] = [HOLD, 0];
  else if (P.phase === HOLD && (P.pt += d) > 2.5) slideIn(P);
  else if (P.phase === SWAP) {
    const nw = P.jars[1 - P.cur];
    const q = min(1, (P.pt += dt * max(P.rate, 0.6)) / 2.4);
    J.off = round(SLIDE * q * q * (3 - 2 * q));
    nw.off = J.off - SLIDE;
    if (q >= 1) [J.on, nw.off, P.cur, P.phase] = [false, 0, 1 - P.cur, GROW];
  }
}

let B;
function add(x, y, r, g, b, a = 1) {
  if (x < 0 || x >= W || y < 0 || y >= BENCH) return;
  const o = (y * W + x) * 3;
  B[o] += r * a;
  B[o + 1] += g * a;
  B[o + 2] += b * a;
}
function mixp(x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= BENCH) return;
  const o = (y * W + x) * 3;
  for (let i = 0; i < 3; i++) B[o + i] += (c[i] - B[o + i]) * a;
}

// The moving things of one glass, drawn in screen columns.
function life(P, J, cols) {
  const o = J.off;
  const set = SETS[P.set];
  const t = P.clock;
  for (const m of J.motes) add(round(m[0]) + o, round(m[1]), 34, 36, 32, 0.6 + 0.4 * sin(t * 3 + m[3]));
  // Above each open tip, the salt solution it pushes out rises as a faint wavering thread.
  const L = round(6 + 4 * (1 - P.str));
  for (const T of J.tips) {
    if (T.cap) continue;
    const c = cols(T.id);
    for (let i = 1; i <= L; i++) {
      const x = round(T.x + sin(t * 2.4 + T.ph + i * 0.45) * i * 0.12) + o;
      const y = round(T.y - T.r - i);
      if (y > SY + 2) add(x, y, c[0] + 40, c[1] + 40, c[2] + 40, 0.16 * (1 - i / (L + 1)));
    }
    if (T.bub) {
      const x = round(T.x) + o;
      const y = round(T.y - T.r - 0.6);
      mixp(x, y, [210, 228, 226], 0.9);
      mixp(x - 1, y, [120, 140, 140], 0.4);
      mixp(x + 1, y, [120, 140, 140], 0.4);
    }
  }
  for (const b of J.bub) {
    const x = round(b[0]) + o;
    const y = round(b[1]);
    mixp(x, y, [220, 236, 234], 0.85);
    mixp(x, y + 1, [90, 110, 110], 0.3);
  }
  for (const [px, py, age, w] of J.pops) {
    const k = 1 - age / 0.7;
    const r = w * (0.5 + age * 2);
    for (let x = round(px - r); x <= round(px + r); x++) add(x + o, round(py), 90 * k, 104 * k, 100 * k);
  }
  for (const S of J.seeds) {
    if (J.g < S.t0) continue;
    const sc = SALT[set[S.slot % set.length]];
    // Salt leaking from the crystal's skin tints the solution round it.
    if (S.land >= 0) {
      const R = min(9, 2 + (J.g - S.land) * 0.7);
      const [hr, hg, hb] = sc[0];
      for (let y = round(S.rest - R * 1.3); y <= S.rest + 1; y++) {
        const v = (y - S.rest) / (R * 1.3);
        for (let x = max(-o, round(S.x - R)); x <= S.x + R && x + o < W; x++) {
          const u = (x - S.x) / R;
          const f = 0.08 * (1 - u * u - v * v);
          if (f > 0) {
            const q = (y * W + x + o) * 3;
            B[q] += hr * f;
            B[q + 1] += hg * f;
            B[q + 2] += hb * f;
          }
        }
      }
    }
    // A falling crystal leaves a faint streak of dissolving salt.
    const surf = surfAt(S.x, S.z);
    const fade = S.land < 0 ? 1 : max(0, 1 - (J.g - S.land) / 2.5);
    if (fade > 0 && S.y > surf)
      for (let y = round(surf) + 1; y < S.y - 1; y++) add(round(S.x) + o, y, sc[0][0], sc[0][1], sc[0][2], 0.22 * fade * exp(-(S.y - y) / 14));
    const a = S.land < 0 || J.g - S.land < 1 ? 1 : 0.5;
    const x = round(S.x - 1) + o;
    const y = round(S.y) - 1;
    mixp(x, y, sc[1], a);
    mixp(x + 1, y, sc[1].map((v) => min(255, v * 1.15 + 30)), a);
    mixp(x, y + 1, sc[1].map((v) => v * 0.7), a);
    mixp(x + 1, y + 1, sc[1].map((v) => v * 0.85), a);
    if (S.sz > 0.5) mixp(x + 2, y + 1, sc[1].map((v) => v * 0.75), a);
  }
}

export function draw(display, params) {
  const P = params;
  B = P.buf;
  const { wl: WL, la: LA, so: SO, jk: K, jc: C, jm: M, jo: O, tc: TC } = P;
  const on = P.jars.filter((J) => J.on);
  for (const J of on) {
    // This frame's colour for every tube, from its crystal's salt.
    J.tubes.forEach((si, id) => TC.set(saltOf(P, J, si)[0], id * 3));
    J.tc = TC.slice(0, J.tubes.length * 3);
  }
  for (let y = 0; y < BENCH; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const o = p * 3;
      let J = null;
      for (let i = 0; i < on.length; i++) if (x - on[i].off >= GL && x - on[i].off <= GR) J = on[i];
      const q = J ? p - J.off : 0;
      const qo = q * 3;
      const kind = J ? K[q] : OUT;
      const l = 0.62 + 0.25 * LA[p];
      for (let c = 0; c < 3; c++) {
        let v = WL[o + c];
        if (kind === AIR) v = v * 0.9 + 5;
        else if (kind === WALL || kind === BASE) v = C[qo + c] + v * 0.25;
        else if (kind === SOL) v = SO[o + c] * M[q];
        else if (kind === SHEET) v = SO[o + c] * 0.5 + C[qo + c];
        else if (kind) v = C[qo + c] * l;
        B[o + c] = v;
      }
      if (J && GROWS[kind] && J.tid[q] >= 0) {
        // A tube: lit through from the lamp behind, paler where its skin is
        // fresh, and fading into the solution the further back it stands.
        const id = J.tid[q] * 3;
        const s = J.sh[q];
        const fr = 0.3 * max(0, 1 - (J.g - J.bo[q]) / 1.4);
        const fog = 0.06 + 0.5 * J.zb[q];
        const hl = max(0, s - 1);
        const sv = min(1, s) * (0.68 + 0.48 * LA[p]);
        for (let c = 0; c < 3; c++) {
          let v = J.tc[id + c] * sv;
          v += (255 - v) * hl;
          v += (235 - v) * fr;
          v += (B[o + c] - v) * fog;
          B[o + c] = kind === SHEET ? v * 0.75 + 11 : v;
        }
      }
      if (kind) for (let c = 0; c < 3; c++) B[o + c] += O[qo + c];
    }
  for (const J of on) life(P, J, (id) => J.tc.subarray(id * 3, id * 3 + 3));
  for (let p = 0, o = 0; p < BENCH * W; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, max(0, B[o])), min(255, max(0, B[o + 1])), min(255, max(0, B[o + 2])));
  bench(P, display, on);
}

// A black resin bench top. The jar's foot is reflected in it, and the lamp,
// focused through the full glass, throws a pool of light on it that takes the
// colours of the garden it passed through, left for right.
function bench(P, display, on) {
  const B2 = P.buf;
  const cc = P.cc.fill(0);
  for (const J of on)
    for (let lx = IL; lx <= IR; lx++) {
      const x = lx + J.off;
      const xm = 63 - lx + J.off;
      if (x < 0 || x >= W || xm < 0 || xm >= W) continue;
      for (let y = 30; y < 100; y += 5) for (let i = 0; i < 3; i++) cc[x * 3 + i] += B2[(y * W + xm) * 3 + i] / 14;
    }
  for (let y = BENCH; y < H; y++)
    for (let x = 0; x < W; x++) {
      const gr = ((x * 7 + y * 13) % 5) * 0.6;
      const f = 1 - (y - BENCH) / 9;
      let r = 16 + 10 * f + gr;
      let g = 17 + 10 * f + gr;
      let b = 21 + 11 * f + gr;
      if (y === 123) [r, g, b] = [66, 68, 76];
      else if (y > 123) [r, g, b] = [26 - (y - 124) * 3 + gr, 27 - (y - 124) * 3 + gr, 31 - (y - 124) * 3 + gr];
      else
        for (const J of on) {
          const lx = x - J.off;
          if (lx < GL || lx > GR) continue;
          if (y === BENCH) {
            [r, g, b] = [7, 7, 9];
            continue;
          }
          const m = (2 * BENCH - 1 - y) * W + x;
          const ex = (lx - 31.5) / 23;
          const ey = (y - 118.5) / 3.4;
          const a = 0.9 * sm(1 - ex * ex - ey * ey) + 0.7 * exp(-(((y - 117.5) / 1.1) ** 2)) * sm(1 - ex * ex * 1.4);
          r += B2[m * 3] * 0.22 * f + (cc[x * 3] * 1.15 + 26) * a;
          g += B2[m * 3 + 1] * 0.22 * f + (cc[x * 3 + 1] * 1.15 + 28) * a;
          b += B2[m * 3 + 2] * 0.22 * f + (cc[x * 3 + 2] * 1.15 + 18) * a;
        }
      display.setPixel(x, y, min(255, r), min(255, g), min(255, b));
    }
}
