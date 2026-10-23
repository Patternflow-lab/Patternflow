// ===== Patternflow pattern =====
// Title:   Woodpecker
// Family:  bird
// Idea:    A great spotted woodpecker hops up a tree trunk that runs the full height of the panel, braced on its stiff tail, stops to drum a hole with bark chips flying, and at the top drops off in a bounding flight to the foot of the trunk to start again, in a wood lit through the canopy.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 21, after field-guide plates of the great spotted woodpecker (Dendrocopos major)
// Round:   21
// ===============================
// @matrix 64x128
// @knobs Tree=0..2, Speed=0.2..3, Birds=1..4, Light=0..1
//
// Knob 1: Tree. A silver birch at 0, white with black lenticels and a fissured black foot; a Scots pine at 1, grey plates low down and thin orange bark higher up; an oak at 2, deeply furrowed and grey with lichen. The wood behind is of the same tree.
// Knob 2: Speed. How fast the bird, the wind and the light go: at 2 all of it runs in real time, the bird takes 15 to 20 s up the trunk with its stops to drum and under 3 s back down; 0.2 is ten times slower.
// Knob 3: Birds. One male at 1; at 2 his mate works a nearer trunk that comes in on the right; at 3 a red-capped young bird of the year climbs another at the left, and at 4 a second one climbs the right-hand edge of his trunk.
// Knob 4: Light. Dawn at 0 with the sun low in the east and shafts through the mist, noon at 0.5, dusk at 1 with the sun low in the west.
// Buttons: K1 tap makes the male stop and drum after his next hop.

const [W, H] = [64, 128];
const N = W * H;
const { min, max, floor, round, sin, cos, abs, sqrt, pow, asin, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (x) => ((x = cl(x, 0, 1)), x * x * (3 - 2 * x));
const mul = (c, k) => c.map((v) => v * k);
const lum = (c) => (c[0] + c[1] + c[2]) / 3;
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

// Trunks: centre, radius, the row where the foot meets the ground, haze. The near one first.
const TR = [[30, 10, 119, 0], [57, 5.4, 108, 0.16], [2.2, 5.2, 110, 0.12]];
const rad = (T, y) => T[1] * (1 + 0.7 * sm((y - T[2] + 16) / 16) ** 2);
// Who climbs where: trunk, side (-1 the left edge, so the bird faces right), kind (0 male, 1 female, 2 young), first row.
const FLOCK = [[0, -1, 0, 50], [1, -1, 1, 74], [2, 1, 2, 40], [0, 1, 2, 96]];
const TOP = 27;
// The clinging bird facing right, the bark on its right: rows 0..4 the head, then the body and the
// stiff tail. The toes on row 10 grip the bark's edge, and the bill on row 3 reaches one LED into it.
// C crown, N nape, K black, W white, w buff, R red, G bill and toes, e eye.
const HEAD = ["..CCC....", ".CCCCC...", "NCCCWWW..", "NWWeWWGG.", "KWKKKKG.."];
const UPH = ["..CCC.G..", ".CCCCCG..", "NCCCWeW..", "NWWWWW...", "KWKKKK..."];
const BODY = ["KKKWWW...", "KKKKWw...", "KWWKww...", "KWWWww...", "KWWKww...", "KKKKwwG..", "KWKWww...", ".KKKwR...", "..KKRRG..", "..KKRR...", "...KK....", "....KK...", ".....K..."];
// In flight, facing right: the bird with its wings closed for the bound, wings up, wings down.
const FLB = [".......CCC...", "KKK.KKKNCWW..", "KKKKKWWKWeWGG", "...RRwwwKKK..", ".....www....."];
const WUP = [".....W.......", "....KWKW.....", ".....KWKW...."];
const WDN = ["....KWKWw....", "...KWKW......", "....W........"];
const COL = { K: [24, 22, 28], W: [244, 240, 228], w: [222, 208, 184], G: [70, 70, 78], e: [90, 26, 26] };
// Male, female, young: crown, nape, the red under the tail.
const KIND = [{ C: "K", N: "R", R: [232, 28, 40] }, { C: "K", N: "K", R: [232, 28, 40] }, { C: "R", N: "K", R: [240, 112, 122] }];
// Birch, pine, oak: far trunk, foliage, leaf, ground.
const SP = [
  [[0.86, 0.84, 0.8], [0.36, 0.56, 0.2], [0.56, 0.82, 0.28], [0.36, 0.44, 0.16]],
  [[0.68, 0.38, 0.24], [0.14, 0.32, 0.2], [0.24, 0.48, 0.28], [0.36, 0.32, 0.16]],
  [[0.36, 0.34, 0.3], [0.24, 0.4, 0.13], [0.4, 0.62, 0.2], [0.42, 0.32, 0.16]],
];
// Dawn, morning, noon, afternoon, dusk: sky, haze, sun, shade, shafts.
const HOURS = [
  [250, 220, 172, 172, 156, 150, 255, 188, 104, 70, 80, 104, 1],
  [214, 232, 240, 150, 176, 160, 255, 230, 170, 78, 100, 108, 0.75],
  [186, 220, 252, 128, 170, 132, 255, 250, 232, 90, 116, 96, 0.45],
  [244, 220, 160, 160, 150, 104, 255, 206, 128, 90, 90, 74, 0.7],
  [252, 150, 116, 108, 78, 110, 255, 120, 60, 50, 44, 80, 0.9],
];
const [CLING, HOP, DRUM, PROBE, FLY] = [0, 1, 2, 3, 4];

// Bark colour at arc length s round the trunk and row y.
function bark(k, s, y) {
  const g = vn(s * 0.7, y * 0.35), q = 0.9 + 0.2 * g;
  let c;
  if (k === 0) {
    // Birch: white, with dark lenticels, black scars, pink where it peels, a fissured black foot.
    c = [0.92 * q, 0.9 * q, 0.85 * q];
    if (vn(s * 0.22 + 3, y * 0.13) > 0.83) c = [0.12, 0.11, 0.12];
    else if (vn(s * 0.3 + 5, y * 1.3) > 0.79) c = [0.22, 0.2, 0.2];
    else if (vn(s * 0.3 + 20, y * 0.45) > 0.82) c = [0.9, 0.66, 0.54];
    if (sm((y - 88) / 24) * (0.55 + 0.6 * vn(s * 0.25, y * 0.08 + 4)) > 0.5) c = abs(vn(s * 0.55, y * 0.11) * 2 - 1) < 0.3 ? [0.07, 0.06, 0.06] : mul([0.34, 0.33, 0.32], q);
  } else if (k === 1) {
    // Scots pine: plates split by deep fissures low down, thin orange flakes higher up.
    const up = sm((64 - y) / 22 + vn(s * 0.2, y * 0.05) - 0.5), r = abs(vn(s * 0.32, y * 0.085) * 2 - 1), i = vn(s * 0.9, y * 0.5), f = vn(s * 0.8 + 9, y * 0.9);
    const lo = r < 0.16 ? [0.09, 0.06, 0.05] : [mix(0.44, 0.6, i) * q, mix(0.38, 0.32, i) * q, mix(0.32, 0.22, i) * q];
    const hi = f > 0.7 ? [0.96, 0.68, 0.44] : f < 0.25 ? [0.52, 0.24, 0.14] : [(0.84 + 0.1 * i) * q, (0.44 + 0.08 * i) * q, 0.24 * q];
    c = lo.map((v, j) => mix(v, hi[j], up));
  } else {
    // Oak: deep furrows in a net of grey ridges.
    const r = abs(vn(s * 0.55, y * 0.04) * 2 - 1) + 0.12 * (vn(s * 1.3, y * 0.2) - 0.5);
    c = r < 0.12 || vn(s * 1.1, y * 0.5 + 9) > 0.85 ? [0.09, 0.08, 0.07] : mul([0.64, 0.6, 0.53], q * (r < 0.24 ? 0.68 : 1));
  }
  if (vn(s * 0.45 + 40, y * 0.35 + 40) > [0.86, 0.86, 0.76][k]) c = mul([0.66, 0.74, 0.54], q);
  if (k && y > 94 && vn(s * 0.3 + 60, y * 0.2) > 0.78 - (y - 94) / 90) c = [0.26 * q, 0.4 * q, 0.1];
  return c;
}

function build(P) {
  const { alb, mat, hz, nx, zb } = P, k = P.kind, [FT, FF, LF, GR] = SP[k];
  const put = (x, y, m, c, h, n, z) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const p = y * W + x;
    [mat[p], hz[p], nx[p], zb[p]] = [m, h, n, z];
    alb.set(c, p * 3);
  };
  // Leaves overhead with the sky through them, the wood fading into the haze, the ground.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = vn(x * 0.11, y * 0.14) * 0.55 + vn(x * 0.3 + 5, y * 0.3) * 0.3 + vn(x * 0.8, y * 0.8) * 0.15, q = 0.75 + 0.5 * vn(x * 0.6 + 3, y * 0.6), gl = 99 + 3 * vn(x * 0.09, 3.1);
      const b = vn(x * 0.13, y * 0.11 + 30) * 0.7 + vn(x * 0.45, y * 0.4) * 0.3 + (y - 56) / 90;
      if (d > 0.28 + 0.4 * sm((y - 4) / 26) && y < 32) put(x, y, 1, mul(FF, q * (1.25 - d * 0.6)), 0, 0, 2);
      else if (y < 12 + 8 * vn(x * 0.1, 9)) put(x, y, 0, FF, 0, 0, 2);
      else if (y < gl) put(x, y, 2, mul(FF, q), b > 0.75 && y > 54 ? 0.5 - (y - 56) / 140 : 0.2 + 0.68 * sm((y - 26) / 64) + 0.2 * (vn(x * 0.2, y * 0.08 + 60) - 0.5), 0, 2);
      else put(x, y, 4, mul(GR, q), 0.6 * (1 - sm((y - gl) / 14)), 0, 2);
    }
  // Far trunks, thin and pale, then a few nearer ones.
  for (let i = 0; i < 14; i++) {
    const near = i > 8, w = near ? 2.5 + rnd() * 2 : 1 + rnd() * 1.4, cx = rnd() * 66 - 1, h = near ? 0.32 + rnd() * 0.12 : 0.58 + rnd() * 0.18;
    for (let y = floor(rnd() * 12); y < 101 + (near ? 4 : 0); y++)
      for (let x = floor(cx - w / 2); x <= cx + w / 2; x++) {
        const u = (x + 0.5 - cx) / (w / 2 + 0.01), m = mat[y * W + x];
        if (abs(u) <= 1 && m !== 1) put(x, y, 3, k || near ? bark(k, u * 3 + i * 9, y) : y > 92 || vn(x + i * 7, y * 0.9) > 0.8 ? [0.2, 0.2, 0.2] : FT, h, u, 2);
      }
  }
  // The near trunks, full bark and rounded.
  for (let t = P.nt - 1; t >= 0; t--) {
    const T = TR[t], [cx, r0, fy, h] = T;
    for (let y = 0; y < min(H, fy + 3); y++)
      for (let r = rad(T, y), x = floor(cx - r); x <= cx + r; x++) {
        const u = (x + 0.5 - cx) / r, s = asin(cl(u, -1, 1)) * r0 + t * 40;
        // The bark's own relief tips the normal, so ridges catch a low sun on one side.
        if (abs(u) <= 1) put(x, y, 3, bark(k, s, y), h, cl(u + (lum(bark(k, s - 0.7, y)) - lum(bark(k, s + 0.7, y))) * 1.6, -1, 1), t ? 1 : 0);
      }
  }
  // Limbs off the near trunk: a live one to the right, one up into the crown, a dead stub on the left.
  const limb = (x0, y0, x1, y1, w0, w1, dead) => {
    for (let i = 0, n = abs(x1 - x0) * 2; i <= n; i++) {
      const f = i / n, x = round(mix(x0, x1, f)), yc = mix(y0, y1, f) + 3 * sin(PI * f), w = mix(w0, w1, f);
      for (let j = 0; j < w; j++) put(x, round(yc - w / 2 + j), 3, mul(bark(dead ? 2 : k, i * 0.6 + 70, j * 4 + 30), j < 1 ? 1.15 : j > w - 2 ? 0.6 : 0.9), 0, j < 1 ? -0.5 : 0.4, 0);
    }
  };
  limb(38, 57, 64, 41, 4, 2, k === 1);
  limb(46, 54, 52, 42, 1.5, 1, k === 1);
  limb(56, 48, 61, 36, 1.5, 1, k === 1);
  limb(38, 24, 62, 4, 3, 1.5);
  limb(21, 87, 15, 83, 3, 2, true);
  // The near ground: moss, litter, roots.
  for (let y = 110; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, g = vn(x * 0.4, y * 0.5), l = vn(x * 0.9 + 5, y * 0.9);
      if ((mat[p] === 3 && y < 121) || (y < 117 && hz[p] > 0.05)) continue;
      put(x, y, 4, l > 0.72 ? [0.56, 0.36, 0.16] : g > 0.6 ? [0.26, 0.46, 0.1] : mul(GR, 0.7 + 0.5 * l), 0, 0, y > 116 ? 0 : 1);
    }
  for (const [x0, dir] of [[21, -1], [24, -1], [36, 1], [39, 1], [30, 1]])
    for (let i = 0, x = x0, y = 117; i < 14; i++) {
      (x += dir * (0.7 + rnd() * 0.5)), (y += 0.35 + rnd() * 0.4);
      put(round(x), round(y), 3, bark(k, i, 100 + i), 0, -0.3, 0);
      put(round(x), round(y) + 1, 3, mul(bark(k, i, 101 + i), 0.6), 0, 0.5, 0);
    }
  // Leaves that move: on the right limb, over the top of the trunk, hanging in from the crown.
  const L = (P.leaves = []);
  const spray = (cx, cy, r, n) => {
    for (let i = 0; i < n; i++) {
      const a = rnd() * PI * 2, d = r * sqrt(rnd());
      L.push([round(cx + cos(a) * d), round(cy + sin(a) * d * 0.7), floor(rnd() * 4), 0.7 + rnd() * 0.6, rnd() * 7]);
    }
  };
  if (k !== 1) [[52, 41, 7, 60], [61, 37, 6, 50], [46, 48, 4, 18], [58, 49, 4, 20]].forEach(([x, y, r, n]) => spray(x, y, r, n * (k ? 1.3 : 1)));
  [[30, 3, 9, 70], [50, 10, 9, 70], [60, 3, 7, 50], [7, 20, 6, 40], [14, 14, 5, 24], [40, 18, 4, 16]].forEach((a) => spray(...a));
  P.leafC = LF;
  P.ferns = Array.from({ length: 12 }, (_, i) => [(i * 5.7 + rnd() * 4) % 64, 124 + rnd() * 5, 9 + rnd() * 8, (i % 2 ? 1 : -1) * (0.4 + rnd() * 0.5), rnd() * 7]);
  P.holes = P.holes.filter((h) => h[3] < P.nt);
}

// Light for the hour: what lies in shade, and what the sun adds where it gets through.
function paint(P) {
  const f = P.h * 4, i = min(3, floor(f)), q = HOURS[i].map((v, c) => mix(v, HOURS[i + 1][c], f - i)), { alb, mat, hz, nx, bg, sa } = P;
  const sky = q.slice(0, 3), haze = q.slice(3, 6), sun = (P.sun = q.slice(6, 9)), amb = (P.amb = q.slice(9, 12));
  const sx = (P.sx = -0.85 + 1.7 * P.h), sz = 0.55, sl = sqrt(sx * sx + sz * sz);
  for (let p = 0; p < N; p++) {
    const m = mat[p], y = p >> 6, h = hz[p], n = nx[p], nz = sqrt(max(0, 1 - n * n)), d = m === 3 ? max(0, (n * sx + nz * sz) / sl) : m === 4 ? 0.8 : m === 1 ? 0.7 : 0.2;
    const sh = m === 3 ? 0.35 + 0.65 * nz : m === 1 ? 0.8 : 0.9, hk = 1.1 - y / 180;
    // How strongly the shafts show here: most in the haze, faint in front of the near trunk.
    P.sw[p] = m ? (q[12] * 100 * (0.25 + 0.75 * h) * (1.1 - y / 160)) / 255 : 0;
    for (let c = 0, o = p * 3; c < 3; c++) {
      const a = alb[o + c];
      bg[o + c] = m ? mix(a * amb[c] * sh * 1.1, haze[c] * hk, h) : mix(sky[c], 255, 0.3);
      sa[o + c] = m ? a * sun[c] * d * (1 - h) : 0;
    }
  }
}

function newBird(i) {
  const [tr, side, kind, y] = FLOCK[i];
  return { tr, side, face: -side, kind, y, st: CLING, t: 0, dur: 0.2 + i * 0.35, hops: 2, work: 4 + i * 11, head: 0, out: 0, look: 0 };
}
// The bark's edge pixel at row y, where the toes grip.
const feetX = (B, y) => round(TR[B.tr][0] + B.side * (rad(TR[B.tr], y) - 0.5));
const footRow = (B) => TR[B.tr][2] - 17;

function stepBird(P, B, d) {
  const go = (s, dur) => ((B.st = s), (B.t = 0), (B.dur = dur));
  B.t += d;
  switch (B.st) {
    case CLING:
      B.head = B.t > 0.15 && B.t < B.dur - 0.1 ? B.look : 0;
      B.out = 0;
      if (B.t < B.dur) break;
      if (B.y <= TOP) [B.x0, B.y0] = [feetX(B, B.y), B.y], go(FLY, 2.6);
      else if (B.work <= 0) {
        // Drum where an old hole is, or start a new one.
        const hx = feetX(B, B.y) + B.face * 2, hy = round(B.y) - 7;
        B.hole = P.holes.find((h) => h[3] === B.tr && abs(h[0] - hx) < 2 && abs(h[1] - hy) < 3);
        if (!B.hole) P.holes.push((B.hole = [hx, hy, 0.4, B.tr])), P.holes.length > 30 && P.holes.shift();
        go(DRUM, 1.3 + rnd() * 1.2);
      } else (B.y0 = B.y), (B.len = 2.5 + rnd() * 2.5), go(HOP, 0.15);
      break;
    case HOP: {
      const u = B.t / B.dur;
      B.y = mix(B.y0, B.y0 - B.len, sm(u / 0.5));
      B.out = u < 0.6 ? 1 : 0;
      if (u < 1) break;
      B.work -= B.len;
      if (--B.hops > 0) (B.look = 0), go(CLING, 0.04 + rnd() * 0.1);
      else (B.hops = 2 + floor(rnd() * 4)), (B.look = rnd() < 0.6 ? 1 + floor(rnd() * 2) : 0), go(CLING, 0.3 + rnd() * 0.8);
      break;
    }
    case DRUM: {
      // Bursts of strikes too fast to see: the head is a blur and chips fly.
      const on = B.t % 0.62 < 0.42;
      B.head = on ? 3 : 0;
      if (on) {
        B.hole[2] = min(2.2, B.hole[2] + d * 0.5);
        for (let n = rnd() < d * 30 ? 1 + (rnd() < 0.5) : 0; n > 0; n--) P.chips.push([B.hole[0] + B.side, B.hole[1] + (rnd() - 0.5) * 2, B.side * (12 + rnd() * 30), -(4 + rnd() * 26), floor(rnd() * 3), 0, B.tr ? 1 : 0]);
      }
      if (B.t >= B.dur) go(PROBE, 0.7 + rnd() * 0.6);
      break;
    }
    case PROBE:
      B.head = floor(B.t / 0.18) % 3 ? 4 : 0;
      if (B.t >= B.dur) (B.work = 16 + rnd() * 24), (B.look = 1), go(CLING, 0.5);
      break;
    case FLY:
      if (B.t >= B.dur) (B.y = footRow(B)), (B.look = 0), go(CLING, 0.5);
  }
}

export function setup(params) {
  const P = params, F = (n) => new Float32Array(n);
  Object.assign(P, { alb: F(N * 3), hz: F(N), nx: F(N), zb: new Uint8Array(N), mat: new Uint8Array(N), bg: F(N * 3), sa: F(N * 3), sw: F(N), buf: F(N * 3), lit: F(N), kind: -1, nt: 0, h: -1, t: 0, holes: [], chips: [], falls: [] });
  P.birds = FLOCK.map((_, i) => newBird(i));
  // Sun flecks: a tile of soft blobs the crown lets through, wrapped both ways.
  const FT = (P.ft = F(16384));
  for (const [c, a] of [[16, 0.3], [8, 0.45], [4, 0.25]]) {
    const n = 128 / c, g = Array.from({ length: n * n }, rnd);
    for (let i = 0; i < 16384; i++) {
      const x = (i & 127) / c, y = (i >> 7) / c, x0 = floor(x), y0 = floor(y), u = sm(x - x0), v = sm(y - y0), X = (x0 + 1) % n, Y = (y0 + 1) % n;
      FT[i] += a * mix(mix(g[y0 * n + x0], g[y0 * n + X], u), mix(g[Y * n + x0], g[Y * n + X], u), v);
    }
  }
  const S = (P.shafts = F(256));
  for (let n = 0; n < 7; n++) {
    const c = rnd() * 256, w = 3 + rnd() * 9, a = 0.4 + rnd() * 0.6;
    for (let i = 0; i < 256; i++) S[i] = min(1, S[i] + a * Math.exp(-((abs(((i - c + 384) % 256) - 128) / w) ** 2)));
  }
}

export function update(dt, input, params) {
  const P = params, k = input.knobValues || [0, 2, 1, 0.06], kind = round(cl(k[0], 0, 2)), nb = round(cl(k[2], 1, 4)), nt = min(3, nb), h = cl(k[3], 0, 1);
  const d = (cl(dt, 0, 0.1) * cl(k[1], 0.2, 3)) / 2;
  if (kind !== P.kind || nt !== P.nt) (P.kind = kind), (P.nt = nt), build(P), (P.h = -1);
  if (abs(h - P.h) > 0.0005) (P.h = h), paint(P);
  P.nb = nb;
  // K1 tap: the male stops to drum after his next hop.
  if (input.btnPressed?.[0]) P.birds[0].work = 0;
  P.t += d;
  for (let i = 0; i < nb; i++) stepBird(P, P.birds[i], d);
  P.chips = P.chips.filter((c) => {
    if (c[5]) return (c[5] += d) < 6;
    c[3] += 110 * d;
    c[2] *= 1 - 1.6 * d;
    c[0] += c[2] * d;
    c[1] += c[3] * d;
    if (c[1] >= 118 + (c[6] ? -8 : (c[0] * 7) % 9)) c[5] = d;
    return c[0] > -2 && c[0] < W + 2;
  });
  // Now and then a leaf lets go up in the crown.
  if (rnd() < d * 0.6) P.falls.push([rnd() * W, 8 + rnd() * 10, 7 + rnd() * 6, rnd() * 7]);
  P.falls = P.falls.filter((f) => ((f[1] += f[2] * d), (f[0] += sin(P.t * 2.2 + f[3]) * 9 * d + 2 * d), f[1] < 121));
}

let BUF;
const A = (x, y, r, g, b, a = 1) => {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  BUF[o] += (r - BUF[o]) * a;
  BUF[o + 1] += (g - BUF[o + 1]) * a;
  BUF[o + 2] += (b - BUF[o + 2]) * a;
};

// Sun flecks moving with the crown, and shafts through the haze.
function light(P) {
  const { buf, bg, sa, ft, lit, sw, shafts: S, t, sx } = P, w = 0.6 + 0.4 * sin(t * 0.31) * sin(t * 0.17 + 2);
  const ax = 4 * sin(t * 0.5) + 2 * sin(t * 1.3) * w + t * 0.6, ay = 2 * sin(t * 0.4 + 1), bx = -t * 1.1 + 3 * sin(t * 0.8) * w, by = 1.5 * sin(t * 0.6) + 40;
  const [ix, iy, jx, jy] = [floor(ax), floor(ay), floor(bx), floor(by)], [fx, fy, gx, gy] = [ax - ix, ay - iy, bx - jx, by - jy];
  const so = t * 0.9 + 3 * sin(t * 0.23), [sr, sg, sb] = P.sun;
  for (let y = 0, p = 0; y < H; y++) {
    const r0 = ((y + iy) & 127) << 7, r1 = ((y + iy + 1) & 127) << 7, q0 = ((y + jy) & 127) << 7, q1 = ((y + jy + 1) & 127) << 7, bo = y * sx * 0.8 + so;
    for (let x = 0; x < W; x++, p++) {
      const x0 = (x + ix) & 127, x1 = (x0 + 1) & 127, z0 = (x + jx) & 127, z1 = (z0 + 1) & 127, u = ft[r0 + x0], v = ft[r1 + x0], e = ft[q0 + z0], g = ft[q1 + z0];
      const a = u + (ft[r0 + x1] - u) * fx, c = v + (ft[r1 + x1] - v) * fx, b = e + (ft[q0 + z1] - e) * gx, d = g + (ft[q1 + z1] - g) * gx;
      let f = ((a + (c - a) * fy) * 0.55 + (b + (d - b) * gy) * 0.45 - 0.47) * 9;
      f = f <= 0 ? 0 : f >= 1 ? 1 : f * f * (3 - 2 * f);
      const l = (lit[p] = 0.15 + 0.85 * f), s = S[(x + bo) & 255] * sw[p], o = p * 3;
      buf[o] = bg[o] + sa[o] * l + s * sr;
      buf[o + 1] = bg[o + 1] + sa[o + 1] * l + s * sg;
      buf[o + 2] = bg[o + 2] + sa[o + 2] * l + s * sb;
    }
  }
}

function lightAt(P, x, y) {
  const l = P.lit[cl(round(y), 0, H - 1) * W + cl(round(x), 0, W - 1)];
  return [0, 1, 2].map((c) => (P.amb[c] + 96 + P.sun[c] * 0.65 * l) / 255);
}

function sprite(P, rows, x0, y0, face, cmap, L, a, z, dx = 0) {
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c], col = ch === "R" ? cmap.R : COL[cmap[ch] || ch], x = x0 + (c + dx) * face, y = y0 + r;
      if (!col || (z && P.zb[cl(y, 0, H - 1) * W + cl(x, 0, W - 1)] < 1)) continue;
      A(x, y, min(255, col[0] * L[0]), min(255, col[1] * L[1]), min(255, col[2] * L[2]), a);
    }
  });
}

function drawBird(P, B) {
  const cm = KIND[B.kind], z = B.tr > 0, hk = 1 - TR[B.tr][3] * 0.6;
  if (B.st === FLY) {
    // Three bounds out from the trunk and down to its foot: wings beating on the rise, shut on the drop.
    const u = B.t / B.dur, b = (u * 3) % 1, f = u < 0.5 ? B.side : -B.side, x = cl(B.x0 + B.side * 17 * pow(sin(PI * u), 0.7), 3, 60), y = mix(B.y0 - 8, footRow(B) - 6, sm(u)) - 6 * sin(PI * b);
    const L = mul(lightAt(P, x, y), hk), xi = round(x - f * 6), yi = round(y) - 2, up = floor(B.t / 0.06) & 1;
    if (u > 0.94) return sprite(P, [...HEAD, ...BODY], feetX(B, footRow(B)) - B.face * 6, footRow(B) - 10, B.face, cm, L, 1, z);
    sprite(P, FLB, xi, yi, f, cm, L, 1, z);
    if (b < 0.45) sprite(P, up ? WUP : WDN, xi, up ? yi - 3 : yi + 4, f, cm, L, 1, z);
    return;
  }
  const L = mul(lightAt(P, feetX(B, B.y), B.y - 4), hk), x0 = feetX(B, B.y) - B.face * (6 + B.out), y0 = round(B.y) - 10;
  sprite(P, BODY, x0, y0 + 5, B.face, cm, L, 1, z);
  if (B.head === 3) for (let i = 0, f = floor(P.t * 30) & 1; i < 2; i++) sprite(P, HEAD, x0, y0, B.face, cm, L, i ? 0.45 : 1, z, i ^ f);
  else if (B.head === 2) sprite(P, HEAD, x0 + B.face * 6, y0, -B.face, cm, L, 1, z);
  else sprite(P, B.head === 1 ? UPH : HEAD, x0, y0, B.face, cm, L, 1, z, B.head === 4 ? 1 : 0);
}

export function draw(display, params) {
  const P = params, { t, leafC, sun, amb, lit } = P, w = 0.6 + 0.4 * sin(t * 0.31) * sin(t * 0.17 + 2);
  BUF = P.buf;
  light(P);
  // Holes: dark, with a rim of fresh pale wood below.
  for (const [hx, hy, r, tr] of P.holes) {
    const L = mul(lightAt(P, hx, hy), 1 - TR[tr][3] * 0.5);
    for (let y = floor(hy - r - 1); y <= hy + r + 1; y++)
      for (let x = floor(hx - r - 1); x <= hx + r + 1; x++) {
        const e = sqrt(((x - hx) / max(0.6, r * 0.8)) ** 2 + ((y - hy) / max(0.6, r)) ** 2);
        if (e < 1) A(x, y, 12, 8, 6);
        else if (e < 1.6) A(x, y, 240 * L[0], 212 * L[1], 156 * L[2], y > hy ? 0.9 : 0.5);
      }
  }
  for (let i = 0; i < P.nb; i++) if (P.birds[i].tr) drawBird(P, P.birds[i]);
  // Leaves stir in the wind and catch the sun as they turn.
  for (const [lx, ly, s, tone, ph] of P.leaves) {
    const x = lx + round(sin(t * (1.2 + w) + ph) * w), q = max(0, sin(t * (2 + 2 * w) + ph * 3)) ** 6, l = lit[cl(ly, 0, H - 1) * W + cl(x, 0, W - 1)] * (0.85 + 0.6 * q);
    const r = leafC[0] * tone * (amb[0] * 0.9 + sun[0] * l), g = leafC[1] * tone * (amb[1] * 0.9 + sun[1] * l), b = leafC[2] * tone * (amb[2] * 0.9 + sun[2] * l) + 20 * q;
    A(x, ly, r, g, b);
    if (s & 1) A(x + 1, ly, r * 0.8, g * 0.8, b * 0.8);
    if (s > 1) A(x, ly + 1, r * 0.7, g * 0.7, b * 0.7);
  }
  for (let i = 0; i < P.nb; i++) if (!P.birds[i].tr) drawBird(P, P.birds[i]);
  for (const [x, y, , , c, , z] of P.chips) {
    const L = lightAt(P, x, y), col = [[236, 210, 160], [200, 170, 120], [120, 96, 80]][c], xi = round(x), yi = round(y);
    if (!z || P.zb[cl(yi, 0, H - 1) * W + cl(xi, 0, W - 1)]) A(xi, yi, col[0] * L[0], col[1] * L[1], col[2] * L[2]);
  }
  for (const [x, y, , ph] of P.falls) {
    const L = lightAt(P, x, y), k = 255 * (0.8 + 0.4 * sin(t * 6 + ph));
    A(round(x), round(y), leafC[0] * k * L[0], leafC[1] * k * L[1], leafC[2] * k * L[2]);
  }
  // Bracken in front, arching and swaying, the fronds narrowing to the tip.
  for (const [fx, fy, len, lean, ph] of P.ferns)
    for (let s = 0, x = fx, y = fy, sw = sin(t * 1.4 + ph) * 0.12 * w; s < len; s++) {
      const f = s / len, a = (lean + sw) * f * 1.8 - 0.2 * lean, ca = cos(a), sa = sin(a), L = mul(lightAt(P, (x += sa), (y -= ca)), 0.6 + 0.4 * f);
      A(round(x), round(y), 70 * L[0], 120 * L[1], 36 * L[2]);
      if (s > 2) for (let j = 1, n = round(3.2 * (1 - f)) + (s & 1); j <= n; j++) for (const e of [-1, 1]) A(round(x + e * j * ca), round(y + e * j * sa + j * 0.35), 96 * L[0], 168 * L[1], 52 * L[2], 0.9);
    }
  show(display, P.buf);
}

function show(display, buf) {
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const r = buf[o], g = buf[o + 1], b = buf[o + 2];
    display.setPixel(p & 63, p >> 6, r > 255 ? 255 : r < 0 ? 0 : r, g > 255 ? 255 : g < 0 ? 0 : g, b > 255 ? 255 : b < 0 ? 0 : b);
  }
}
