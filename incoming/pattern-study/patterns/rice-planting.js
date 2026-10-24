// ===== Patternflow pattern =====
// Title:   Rice Planting
// Family:  farm
// Idea:    Seen straight down over a flooded paddy, a line of planters in straw hats steps backward along a guide rope with red markers, pushing seedlings into the mud hill by hill, so the field behind them fills with rows of green while the open water ahead mirrors drifting clouds, an egret stalks there and bundles of seedlings land with a splash.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 26, after monaegi, the hand transplanting of rice along a marked rope (motjul) in Korea
// Round:   26
// ===============================
// @matrix 64x128
// @knobs Hour=0..1, Speed=0.2..3, Planters=4..8, Wind=0..1
//
// Knob 1: Hour. A misty morning at 0, a deep blue noon with the sun's glint in the paddy, a gold afternoon, and at 1 dusk, when the clouds in the water turn orange.
// Knob 2: Speed. At 2 a planter pushes in a hill every third of a second and the rope moves a row about every two seconds; 0.2 is ten times slower.
// Knob 3: Planters. Four to eight in the line, sharing the fourteen hills of a row, so more hands move the rope sooner and the field is further along when you look.
// Knob 4: Wind. Calm water is a mirror; turned up, cat's paws darken it and break it into glitter, the clouds run faster and the seedlings lean.
// Buttons: K1 tap and the crew pushes in the rest of the row at once and the rope moves on.

const W = 64, H = 128, N = W * H, PW = 61, NH = 14, NR = 25;
const { min, max, floor, ceil, round, sin, cos, abs, exp, sqrt, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Value noise that wraps every p cells, so the sky texture tiles.
function vnp(x, y, p, o) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const g = (a, b) => hash(a % p, (b % p) + o);
  const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + g(xi + 1, yi + 1)) * su * sv;
}

// A paddy and its left bund are 61 columns of the world; the hills of a row
// stand every four columns, and the rows every four LEDs from row 5 to 101.
const HX = (j) => 5 + 4 * j;
const rowY = (r, dn) => (dn > 0 ? 5 + 4 * r : 101 - 4 * r);
// The light by the hour: sky overhead, sky toward the sun, sunlit cloud,
// cloud underside, light on the people and the fields, and mist.
const HOURS = [
  [0, 46, 92, 168, 116, 150, 204, 250, 242, 236, 150, 162, 192, 0.88, 0.92, 0.98, 0.32],
  [0.25, 36, 92, 186, 110, 160, 218, 254, 250, 244, 156, 172, 204, 0.96, 0.98, 1, 0.12],
  [0.5, 18, 66, 176, 64, 126, 210, 255, 255, 255, 168, 180, 206, 1.05, 1.05, 1, 0],
  [0.75, 44, 92, 176, 176, 164, 150, 255, 224, 170, 160, 140, 156, 1, 0.9, 0.74, 0],
  [1, 36, 34, 98, 170, 86, 96, 255, 150, 70, 112, 64, 100, 0.82, 0.56, 0.46, 0.12],
];
function key(u) {
  let i = 0;
  while (i < HOURS.length - 2 && u > HOURS[i + 1][0]) i++;
  const a = HOURS[i], b = HOURS[i + 1], f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
  return a.map((v, c) => mix(v, b[c], f));
}
const HAT = [234, 190, 102], SKIN = [226, 176, 136], PANTS = [[60, 62, 120], [126, 62, 110], [70, 84, 72]];
const SHIRTS = [[236, 236, 228], [104, 144, 224], [238, 136, 164], [150, 208, 96], [184, 152, 228], [214, 78, 70], [112, 204, 204], [70, 96, 176]];
const SEED = [134, 222, 72], LEAF = [70, 166, 56], ROOT = [168, 136, 100], TIE = [230, 200, 112], NUR = [96, 196, 66];
const ROPE = [200, 170, 116], MARK = [[240, 52, 40], [252, 216, 60]], GRASS = [62, 116, 40], EARTH = [134, 106, 74], MUD = [120, 92, 58];
const WHITE = [248, 248, 242], BILL = [244, 196, 40];

export function setup(params) {
  const F32 = (n) => new Float32Array(n);
  const P = (params.s = {
    t: 0, f: F32(N * 3), rip: F32(N), tb: F32(H), ht: F32(16384), bm: new Uint8Array(W), cd: F32(16384), cs: F32(16384), nz: F32(16384), k: 0, dn: 1, r: 0, fl: new Uint8Array(NH),
    mv: -1.5, sl: -1.5, cam: 0.5, n: 0, h: 0.5, w: 0.5, ox: rnd() * 128, oy: rnd() * 128, rp: [], bu: [], init: false,
  });
  // The sky: clouds with steep edges, the size of a few drift blocks, and a
  // slower field that says where the wind roughens the water and where mist lies.
  for (let i = 0; i < 16384; i++) {
    const x = i & 127, y = i >> 7, q = (f, o) => vnp((x * f) / 128, (y * f) / 128, f, o);
    const v = 0.55 * q(6, 0) + 0.3 * q(14, 50) + 0.15 * q(32, 90);
    P.cd[i] = sm(0.5, 0.6, v);
    P.cs[i] = cl((v - 0.5) * 4, 0, 1);
    P.nz[i] = 0.6 * q(5, 130) + 0.4 * q(12, 170);
    P.ht[i] = hash(x, y);
  }
  P.crew = SHIRTS.map((s, i) => ({ sh: (i * 3 + floor(rnd() * 8)) % 8, pa: floor(rnd() * 3), sp: 0.85 + rnd() * 0.3, list: [], q: 0, ph: 0.5, home: 32.5, wig: rnd() * 7 }));
  P.eg = { x: 10 + rnd() * 44, y: 84 + rnd() * 14, a: rnd() * 6.28, m: 0, t: 1 + rnd(), st: -1.5, sx: 0.5, sy: 0.5, tx: 0.5, ty: 0.5, sk: -1.5 };
  P.ca = { x: 14 + rnd() * 36, tx: 32.5, w: 0.6 + rnd(), tt: -0.5 };
  P.pu = { x: 18 + rnd() * 30, x1: 0, old: [] };
  P.pu.x1 = P.pu.x + 10 + rnd() * 12;
}

// Each planter takes a run of the fourteen hills; on alternate rows they work it the other way.
function assign(P) {
  const n = P.n;
  P.crew.forEach((c, i) => {
    const a = floor((i * NH) / n), b = floor(((i + 1) * NH) / n);
    c.list = [];
    if (i < n) for (let j = a; j < b; j++) if (!P.fl[j]) c.list.push(j);
    if (P.r & 1) c.list.reverse();
    c.q = 0;
    c.ph = 0;
    if (i < n) c.home = (HX(a) + HX(b - 1)) / 2;
  });
}
const fresh = (P) => (P.fl.fill(0), assign(P));
const ropeY = (P) => (P.mv >= 0 ? mix(rowY(P.r, P.dn), rowY(P.r + 1, P.dn), sm(0, 1, P.mv)) : rowY(P.r, P.dn));
const ring = (P, x, y, s, life = 0.9) => P.rp.length < 48 && P.rp.push({ x: x + 1e-6, y: y + 1e-6, s, a: 1e-6, life });
function plant(P, j) {
  P.fl[j] = 1;
  ring(P, P.k * PW + HX(j), rowY(P.r, P.dn), 0.9);
}
// Bundles of seedlings lie about the open water, waiting for the line; ft
// is how far through its flight a thrown one is, below 0 once it floats.
const bun = (x, y, ft, tx, ty) => ({ x, y, fx: x, fy: y, tx, ty, a: floor(rnd() * 8), ft });
function scatter(P, k, lo, hi) {
  for (let i = 0; i < 12; i++) P.bu.push(bun(k * PW + 8 + rnd() * 46, lo + rnd() * (hi - lo), -1.5, 0.5, 0.5));
}
// Where open water lies ahead of the line in this paddy, as rows lo..hi.
function open(P, gap) {
  const ry = ropeY(P);
  return P.dn > 0 ? [ry + gap, 99] : [7, ry - gap];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, kv = input.knobValues || [0, 2, 4, 0.06];
  const d = (cl(dt || 0, 0, 0.1) * cl(kv[1], 0.2, 3)) / 2, n = round(cl(kv[2], 4, 8));
  P.h = cl(kv[0], 0, 1);
  P.w = cl(kv[3], 0, 1);
  if (!P.init) {
    // They have been at it since dawn: the more hands, the further along.
    P.n = n;
    P.r = 8 + round((n - 4) * 1.5) + floor(rnd() * 2);
    assign(P);
    scatter(P, 0, rowY(P.r, 1) + 10, 99);
    P.init = true;
  }
  if (n !== P.n) (P.n = n), assign(P);
  P.t += d;
  P.ox += (3.4 + 5 * P.w) * d;
  P.oy += (1.4 + 2 * P.w) * d;
  const btn = input.btnPressed && input.btnPressed[0];
  if (P.sl < 0) {
    if (btn && P.mv < 0) for (let j = 0; j < NH; j++) if (!P.fl[j]) plant(P, j);
    if (P.mv < 0) {
      for (let i = 0; i < P.n; i++) {
        const c = P.crew[i];
        if (c.q >= c.list.length) continue;
        const j = c.list[c.q], p0 = c.ph;
        if (P.fl[j] && p0 < 0.6) {
          c.q++;
          continue;
        }
        c.ph += (d * c.sp) / 0.36;
        if (p0 < 0.6 && c.ph >= 0.6) plant(P, j);
        if (c.ph >= 1) (c.ph = 0), c.q++;
      }
      if (P.fl.every((v) => v)) {
        if (P.r >= NR - 1) {
          // The last row is in: the crew crosses the bund to the next paddy,
          // where the carrier has already thrown the bundles.
          P.sl = 0;
          scatter(P, P.k + 1, 10, 96);
          P.eg.m === 0 && fly(P, P.k + 1);
        } else P.mv = 0;
      }
    } else if ((P.mv += d / 0.5) >= 1) {
      (P.mv = -1), P.r++, fresh(P);
      for (let i = 0; i < P.n; i++) ring(P, P.k * PW + P.crew[i].home, rowY(P.r, P.dn) + P.dn * 10, 0.5);
    }
  } else if ((P.sl += d / 3.5) >= 1) (P.sl = -1), P.k++, (P.dn = -P.dn), (P.r = 0), fresh(P);
  P.cam = P.k * PW + (P.sl >= 0 ? PW * sm(0, 1, P.sl) : 0);
  const ry = ropeY(P), dn = P.dn;
  // The line picks up the bundles it reaches.
  P.bu = P.bu.filter((b) => {
    const k = floor(b.x / PW);
    return b.ft >= 0 || k > P.k || (k === P.k && (P.sl >= 0 || (b.y - ry) * dn > 5));
  });
  for (const b of P.bu)
    if (b.ft >= 0 && (b.ft += d / 0.75) >= 1) (b.ft = -1.5), (b.x = b.tx), (b.y = b.ty), ring(P, b.x, b.y, 1.2, 1.2);
  // The carrier on the levee throws a bundle ahead of the line now and then.
  const C = P.ca;
  if (C.tt > 0) C.tt -= d;
  else if (abs(C.tx - C.x) > 0.6) C.x += Math.sign(C.tx - C.x) * 7 * d;
  else if ((C.w -= d) < 0) {
    const [lo, hi] = open(P, 10);
    if (P.sl < 0 && hi - lo > 6 && P.bu.length < 16) {
      const ty = max(lo, hi - 46) + rnd() * (hi - max(lo, hi - 46));
      P.bu.push(bun(C.x, 104.5, 1e-6, P.k * PW + 8 + rnd() * 46, ty));
      C.tt = 0.5;
    }
    C.w = 1.6 + rnd() * 2.4;
    C.tx = P.cam + 6 + rnd() * 52;
  }
  // The seedling puller works left along the nursery bed.
  const U = P.pu;
  U.x -= 0.5 * d;
  if (U.x < P.cam - 8) U.old.push([U.x + 2, U.x1]) > 3 && U.old.shift(), (U.x1 = (U.x = P.cam + 70) + 2);
  egret(P, d, ry);
  for (const q of P.rp) q.a += d;
  P.rp = P.rp.filter((q) => q.a < q.life);
}

// The egret flies to open water in paddy k, away from the line.
function fly(P, k) {
  const E = P.eg, [lo, hi] = k === P.k ? open(P, 26) : [12, 92];
  if (hi - lo < 8) return fly(P, k + 1);
  Object.assign(E, { m: 1, t: 0, sx: E.x, sy: E.y, tx: k * PW + 8 + rnd() * 46, ty: lo + rnd() * (hi - lo) });
  E.a = Math.atan2(E.ty - E.sy, E.tx - E.sx);
}
function egret(P, d, ry) {
  const E = P.eg;
  if (E.m === 1) {
    if ((E.t += d / 2.4) >= 1) (E.m = 0), (E.x = E.tx), (E.y = E.ty), (E.t = 1.5), ring(P, E.x, E.y, 0.8);
    return;
  }
  if (E.sk >= 0 && (E.sk += d / 0.35) >= 1) E.sk = -1;
  // Too near the line, or left behind in a planted paddy: off it goes.
  if (P.sl < 0 && (floor(E.x / PW) < P.k || (floor(E.x / PW) === P.k && (E.y - ry) * P.dn < 15))) return fly(P, P.k);
  if (E.st >= 0) {
    E.st += d / 0.45;
    const q = sm(0, 1, E.st);
    E.x = mix(E.sx, E.tx, q);
    E.y = mix(E.sy, E.ty, q);
    if (E.st >= 1) (E.st = -1), ring(P, E.x - 1.5 * cos(E.a), E.y - 1.5 * sin(E.a), 0.45, 0.7);
  } else if ((E.t -= d) < 0) {
    // A slow step, now and then a strike at something in the mud.
    if (rnd() < 0.25) (E.sk = 0), ring(P, E.x + 5 * cos(E.a), E.y + 5 * sin(E.a), 0.7);
    else {
      const lx = E.x - P.k * PW;
      E.a += (rnd() - 0.5) * 1.4;
      if (lx < 10) E.a = 0.2 * (rnd() - 0.5);
      if (lx > 52) E.a = PI + 0.2 * (rnd() - 0.5);
      if (E.y > 96 || E.y < 10) E.a = (E.y > 50 ? -PI : PI) / 2 + (rnd() - 0.5);
      Object.assign(E, { st: 0, sx: E.x, sy: E.y, tx: E.x + 1.6 * cos(E.a), ty: E.y + 1.6 * sin(E.a) });
    }
    E.t = 0.6 + rnd() * 1.8;
  }
}

let F, L;
function put(x, y, c, k = 1, a = 1) {
  x = round(x);
  y = round(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  for (let j = 0; j < 3; j++) F[o + j] = mix(F[o + j], c[j] * k * L[j], a);
}
// Points given along a heading (u forward, v to the side), turned to angle a.
function spr(x, y, a, pts) {
  const c = cos(a), s = sin(a);
  for (const [u, v, col, k] of pts) {
    const px = round(x + u * c - v * s), py = round(y + u * s + v * c), o = (py * W + px) * 3;
    if (col) put(px, py, col, k);
    else if (px >= 0 && px < W && py >= 0 && py < H) (F[o] *= k), (F[o + 1] *= k), (F[o + 2] *= k);
  }
}
function disc(x, y, r, col, sh) {
  x = round(x);
  y = round(y);
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      const e = sqrt(dx * dx + dy * dy);
      if (e > r + 0.35) continue;
      put(x + dx, y + dy, col, (1.14 - 0.32 * (e / r) ** 2) * (e > r - 0.55 ? 0.82 : 1) - (sh * 0.1 * (dx + dy)) / r);
    }
}
function line(ax, ay, bx, by, c, k) {
  const n = max(1, round(max(abs(bx - ax), abs(by - ay))));
  for (let i = 0; i <= n; i++) put(mix(ax, bx, i / n), mix(ay, by, i / n), c, k);
}
const BUNDLE = [[-2, 0, ROOT, 0.9], [-1, 0, TIE, 1], [0, 0, SEED, 0.95], [1, 0, LEAF, 1], [2, 0, LEAF, 0.8], [1, -1, LEAF, 0.75], [1, 1, LEAF, 0.75]];

// One planter bent over, seen from above: the hat, the back and hips
// behind it, the arms reaching out past the brim to the water, a bundle in
// one hand and the other pushing a hill in at the rope.
const BACK = [3.4, 3.4, 3, 2.6, 2.1];
function planter(P, c, x, y, dn, ry, x0, hr, walk) {
  const sh = SHIRTS[c.sh], pa = PANTS[c.pa], st = walk ? round(sin(P.t * 9 + c.wig)) : 0;
  let side = c.home < 32 ? 1 : -1, e = 0, tx = x + side * 3, ty = y - dn * 3.6;
  if (!walk && c.q < c.list.length) {
    const hx = x0 + HX(c.list[c.q]);
    side = hx >= x ? 1 : -1;
    e = c.ph < 0.6 ? sm(0, 0.5, c.ph) : 1 - sm(0.65, 1, c.ph);
    tx = mix(x + side * 3, hx, e);
    ty = mix(y - dn * 3.6, ry + dn * 0.6, e);
  }
  for (let s = -1; s <= 1; s += 2) {
    put(x + s, y + dn * (8 + (s * st > 0 ? 1 : 0)), pa, 0.7);
    for (let dx = -1; dx <= 1; dx++) put(x + dx, y + dn * 7, pa, 0.9 - 0.1 * abs(dx));
  }
  BACK.forEach((hw, j) => {
    for (let dx = -3; dx <= 3; dx++) if (abs(dx) <= hw) put(x + dx, y + dn * (2 + j), sh, (0.98 - 0.07 * j) * (abs(dx) > hw - 1 ? 0.85 : 1));
  });
  line(x + side * 2.8, y + dn * 1.5, tx, ty, sh, 0.9);
  put(tx, ty, SKIN);
  const bx = x - side * 3.2, by = y - dn * 3;
  line(x - side * 2.8, y + dn * 1.5, bx, by, sh, 0.9);
  put(bx, by, SKIN);
  put(bx, by - dn, SEED);
  put(bx + side, by - dn * 1.6, LEAF, 0.9);
  put(bx - side, by - dn, LEAF, 0.8);
  disc(x + (tx - x) * 0.15, y - dn * e * 0.8, hr, HAT, 1);
}

// Ripple rings from every push, step and splash, summed per LED.
function ripples(P, cam) {
  const RIP = P.rip;
  RIP.fill(0);
  for (const q of P.rp) {
    const R = 0.6 + q.a * 6.5, a = q.s * (1 - q.a / q.life), qx = q.x - cam;
    for (let y = max(0, floor(q.y - R - 1)); y <= min(H - 1, q.y + R + 1); y++)
      for (let x = max(0, floor(qx - R - 1)); x <= min(W - 1, qx + R + 1); x++) {
        const e = abs(sqrt((x - qx) ** 2 + (y - q.y) ** 2) - R);
        if (e < 0.8) RIP[y * W + x] += a * (1 - e / 0.8);
      }
  }
}

// The bunds, the levee, the nursery, and the water mirroring the sky.
function ground(P, K, cam, ry) {
  const f = F, k = P.k, dn = P.dn, t = P.t, w = P.w, h = P.h, RIP = P.rip, CD = P.cd, CS = P.cs, NZ = P.nz, HT = P.ht, TB = P.tb;
  const ox = floor(P.ox), oy = floor(P.oy), wo = floor(t * (3 + 6 * w)), ws = 0.75 - 0.6 * w, wa1 = min(1, w * 4);
  // The sun's glint, near noon, sliding across the paddy with the hour.
  const gu = cl((h - 0.22) / 0.56, 0, 1), gs = sm(0.22, 0.38, h) * (1 - sm(0.62, 0.8, h)), gx = 6 + 52 * gu, gy = 70 - 30 * sin(PI * gu);
  // The nursery bed is bare where the seedlings have been pulled.
  const BM = P.bm;
  BM.fill(0);
  for (const [a, b] of [...P.pu.old, [P.pu.x + 2, P.pu.x1]]) for (let x = max(0, ceil(a - cam)); x <= min(W - 1, b - cam); x++) BM[x] = 1;
  // How muddy the water is on each row of this paddy: churned round the
  // crew's feet and behind them, settling further back.
  for (let y = 0; y < H; y++) {
    const ds = (ry - y) * dn;
    TB[y] = P.sl >= 0 ? 0.22 : sm(-14, -9, ds) * (0.16 + 0.3 * exp(-max(0, ds) / 14));
  }
  const [z0, z1, z2, s0, s1, s2, l0, l1, l2, h0, h1, h2, , , , mist] = K.slice(1), L0 = L[0], L1 = L[1], L2 = L[2], M0 = MUD[0] * L0, M1 = MUD[1] * L1, M2 = MUD[2] * L2;
  const m0 = mix(s0, 250, 0.6), m1 = mix(s1, 250, 0.6), m2 = mix(s2, 250, 0.6), my = floor(t * 1.5), mx = floor(t * 2.5) + 40;
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, wx = x + cam, kk = floor(wx / PW), lx = wx - kk * PW, o = i * 3, hv = HT[(wx & 127) | (y << 7)];
    const wet = y >= 3 && y <= 103 && lx >= 3 ? 1 : y === 110 || y === 116 || y === 122 ? 0.7 : 0;
    if (!wet) {
      let c = GRASS, v = 0.8 + 0.4 * hv;
      if (y >= 110) {
        const bare = y >= 117 && y <= 121 && BM[x];
        (c = bare ? MUD : NUR), (v = bare ? 0.55 + 0.3 * hv : (y === 111 || y === 115 || y === 117 || y === 121 || y === 123 ? 0.62 : 0.72) + 0.45 * hv);
      } else if (y >= 104) (c = y >= 106 && y <= 108 ? EARTH : GRASS), (v = y === 104 ? 0.6 + 0.3 * hv : v);
      else if (y < 3 ? y === 1 : lx === 1) (c = EARTH), (v = 0.75 + 0.35 * hv);
      else if (y === 2 || (y > 2 && lx === 2)) v *= 0.7;
      f[o] = c[0] * v * L0;
      f[o + 1] = c[1] * v * L1;
      f[o + 2] = c[2] * v * L2;
      continue;
    }
    const ci = ((y + oy) & 127) * 128 + ((x + ox) & 127), cd = CD[ci], cs = CS[ci], g = (0.28 * x) / 63 + 0.52 * (1 - y / 127);
    let br = 0.9;
    if (wa1 > 0) {
      const nz = NZ[(((y >> 1) + wo) & 127) | ((((x >> 1) + (wo >> 1)) & 127) << 7)];
      // A cat's paw darkens the mirror and breaks it into glitter.
      if (nz > ws) {
        const wa = sm(ws, ws + 0.16, nz) * wa1;
        br *= 1 - 0.3 * wa;
        if (HT[((x * 5 + wo * 3) & 127) | (((y + wo) & 127) << 7)] > 0.87) br += 0.45 * wa;
      }
    }
    const tb = kk < k ? 0.22 : kk === k && wet === 1 ? TB[y] : 0, rp = RIP[i];
    let gl = 0;
    if (gs > 0 && abs(x - gx) < 16) {
      gl = gs * exp(-((x - gx) ** 2 + ((y - gy) * 0.8) ** 2) / 40) * (1 - tb);
      if (w > 0.1) gl *= mix(1, HT[((x * 7 + wo) & 127) | (y << 7)] > 0.75 ? 2.6 : 0.25, w);
    }
    const r0 = z0 + (s0 - z0) * g, r1 = z1 + (s1 - z1) * g, r2 = z2 + (s2 - z2) * g;
    const q0 = (r0 + (h0 + (l0 - h0) * cs - r0) * cd) * br, q1 = (r1 + (h1 + (l1 - h1) * cs - r1) * cd) * br, q2 = (r2 + (h2 + (l2 - h2) * cs - r2) * cd) * br;
    // Morning mist lies over the water in drifting banks.
    let ms = mist > 0.01 ? (NZ[((((y >> 1) + my) & 127) << 7) | ((x + mx) & 127)] - 0.5) * 2.4 : 0;
    ms = ms > 0 ? mist * min(ms, 0.7) : 0;
    const m = 0.7 + 0.4 * hv, wk = wet < 1 ? 0.8 : 1, c0 = (q0 + (M0 * m - q0) * tb + rp * (60 + 0.35 * q0) + 255 * L0 * gl) * wk;
    const c1 = (q1 + (M1 * m - q1) * tb + rp * (60 + 0.35 * q1) + 255 * L1 * gl) * wk, c2 = (q2 + (M2 * m - q2) * tb + rp * (60 + 0.35 * q2) + 255 * L2 * gl) * wk;
    f[o] = c0 + (m0 - c0) * ms;
    f[o + 1] = c1 + (m1 - c1) * ms;
    f[o + 2] = c2 + (m2 - c2) * ms;
  }
}

// The rope with its markers, one per hill still to plant, and every hill
// planted so far, leaning and swaying with the wind.
function field(P, cam, ry) {
  const k = P.k, dn = P.dn, t = P.t, w = P.w, x0 = k * PW - cam;
  if (P.sl < 0) {
    const yr = round(ry);
    for (let x = 1; x <= 62; x++) put(x0 + x, yr, ROPE, 0.85);
    if (P.mv < 0) for (let j = 0; j < NH; j++) if (!P.fl[j]) put(x0 + HX(j), yr, MARK[j % 3 === 2 ? 1 : 0]);
  }
  for (let kk = floor(cam / PW); kk <= floor((cam + 63) / PW) && kk <= k; kk++) {
    const xk = kk * PW - cam;
    for (let gi = 0; gi < NR; gi++) {
      const y = 5 + 4 * gi, ord = kk < k ? -1 : dn > 0 ? gi : NR - 1 - gi;
      if (kk === k && ord > P.r) continue;
      for (let j = 0; j < NH; j++) {
        if (kk === k && ord === P.r && !P.fl[j]) continue;
        const x = xk + HX(j), v = 0.85 + 0.3 * hash(kk * 31 + j, gi), sw = sin(t * 2.6 + x * 0.3 + y * 0.15) * (0.25 + 0.9 * w) + 0.9 * w, ln = round(cl(sw, -1, 1));
        put(x, y, SEED, v);
        put(x + ln, y - 1, LEAF, v);
        put(x + (v > 1 ? 1 : -1), y, LEAF, 0.75 * v);
      }
    }
  }
}

// The egret: wading with its neck folded (out in a strike), or on the wing.
function egretDraw(P, cam) {
  const E = P.eg, pts = [];
  if (E.m === 0) {
    const nk = E.sk >= 0 ? 1.8 + 2.4 * sin(PI * E.sk) : 1.8;
    for (let u = -3.5; u <= 1.5; u += 0.5)
      for (let v = -1.5; v <= 1.5; v += 0.5) if ((u + 1) ** 2 / 6.5 + (v * v) / 2.1 <= 1) pts.push([u, v, WHITE, 0.9 + 0.06 * v]);
    for (let u = 2; u <= nk + 0.5; u += 0.5) pts.push([u, 0.5 * sin(u * 1.6), WHITE, 1]);
    pts.push([nk + 1, 0, WHITE, 1], [nk + 2, 0, BILL, 1], [nk + 2.8, 0, BILL, 0.8]);
    spr(E.x - cam + 1, E.y + 1, E.a, pts.map(([u, v]) => [u, v, 0, 0.7]));
    spr(E.x - cam, E.y, E.a, pts);
    return;
  }
  const q = sm(0, 1, E.t), ex = mix(E.sx, E.tx, q) - cam, ey = mix(E.sy, E.ty, q) - 8 * sin(PI * E.t), sp = 3 + 3 * abs(sin(P.t * 8));
  for (let u = -2; u <= 1; u += 0.5) pts.push([u, 0, WHITE, 1], [u, 0.6, WHITE, 0.9], [u, -0.6, WHITE, 0.9]);
  for (let v = 1; v <= sp; v += 0.5) for (let s = -1; s <= 1; s += 2) pts.push([-0.4 * (v / sp) ** 2, s * v, WHITE, v > sp - 1 ? 0.75 : 1], [0.6 - 0.6 * (v / sp), s * v, WHITE, 0.85]);
  pts.push([2, 0, WHITE, 1], [3, 0, WHITE, 1], [4, 0, BILL, 1]);
  spr(ex, ey, E.a, pts);
}

// The crew and the rope holders on the bunds, all in straw hats.
function crew(P, cam, ry) {
  const dn = P.dn, x0 = P.k * PW - cam, hr = P.n > 6 ? 2.6 : 3;
  if (P.sl < 0) {
    for (let i = 0; i < P.n; i++) {
      const c = P.crew[i], lag = P.mv >= 0 ? sm(0.15, 1, P.mv) : 1, cy = mix(rowY(P.r, dn), ry, lag) + dn * 4;
      planter(P, c, x0 + c.home, cy, dn, ry, x0, hr, false);
    }
    for (let hx = 1; hx < 63; hx += 61) {
      put(x0 + hx + (hx < 9 ? -2 : 2), ry + dn * 2, SHIRTS[hx & 7], 0.8);
      disc(x0 + hx, ry + dn * 0.5, 2, HAT, 1);
    }
    return;
  }
  const q = sm(0, 1, P.sl), y0 = rowY(NR - 1, dn) + dn * 4, y1 = rowY(0, -dn) - dn * 4, fd = q < 0.5 ? dn : -dn;
  for (let i = 0; i < P.n; i++) planter(P, P.crew[i], P.crew[i].home, mix(y0, y1, q), fd, 0, 0, hr, true);
  for (let hx = 1; hx < 63; hx += 61) disc(hx, mix(y0, y1, q) - fd * 4, 2, HAT, 1);
}

// The carrier on the levee with bundles on his A-frame, the puller in the
// nursery with the bundles he has tied laid in the channel, and every bundle
// afloat or in the air.
function helpers(P, cam) {
  const C = P.ca, cx = C.x - cam, U = P.pu, ux = U.x - cam, pull = sin(P.t * 7);
  for (const b of P.bu) if (b.ft < 0) spr(b.x - cam, b.y, (b.a * PI) / 4, BUNDLE);
  // Trays of seedlings from the nursery wait on the levee path.
  for (let kk = floor(cam / PW); kk <= floor((cam + 63) / PW); kk++)
    for (let tx = 9; tx < 60; tx += 36)
      for (let dx = 0; dx < 8; dx++)
        for (let dy = 0; dy < 3; dy++) put(kk * PW + tx + dx - cam, 106 + dy, dx % 7 ? NUR : ROOT, dx % 7 ? 0.75 + 0.4 * hash(dx + tx, dy + kk * 5) : 0.6);
  for (let dx = -2; dx <= 2; dx++) for (let dy = 2; dy <= 4; dy++) put(cx + dx, 106 + dy, (dx + dy) & 1 ? SEED : LEAF, dy === 2 ? 0.75 : 0.95);
  put(cx - 2, 109, TIE), put(cx + 2, 109, TIE);
  if (C.tt > 0) line(cx + 1, 105, cx + 2, 101 + 2 * C.tt, SKIN, 0.9);
  disc(cx, 106, 2, HAT, 1);
  for (let bx = U.x + 6; bx < U.x1 - 1; bx += 5) spr(bx - cam, 116, PI / 2, BUNDLE);
  for (let dy = -1; dy <= 1; dy++) for (let dx = 2; dx <= 4; dx++) put(ux + dx, 119 + dy, SHIRTS[5], 0.85);
  line(ux - 1, 118, ux - 2.5 - pull, 118, SKIN, 0.9);
  line(ux - 1, 120, ux - 2.5 + pull, 120, SKIN, 0.9);
  disc(ux, 119, 2, HAT, 1);
}
function thrown(P, cam) {
  for (const b of P.bu) if (b.ft >= 0) spr(mix(b.fx, b.tx, b.ft) - cam, mix(b.fy, b.ty, b.ft) - 7 * sin(PI * b.ft), b.ft * 9, BUNDLE);
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.init) return;
  const K = key(P.h), cam = floor(P.cam), ry = ropeY(P), f = (F = P.f);
  L = [K[13], K[14], K[15]];
  ripples(P, cam);
  ground(P, K, cam, ry);
  field(P, cam, ry);
  if (P.eg.m === 0) egretDraw(P, cam);
  crew(P, cam, ry);
  helpers(P, cam);
  thrown(P, cam);
  if (P.eg.m === 1) egretDraw(P, cam);
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, f[o]) | 0, min(255, f[o + 1]) | 0, min(255, f[o + 2]) | 0);
}
