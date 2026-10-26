// ===== Patternflow pattern =====
// Title:   Zombie Shamble
// Family:  halloween
// Idea:    A horde of zombies shambles toward you down a foggy country lane at night, black figures rim-lit by a sickly green glow behind the horizon with their arms reaching and heads lolling, small in the far fog and growing until the nearest fill the panel and come apart in the mist.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 51
// Round:   51
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Horde=5..18, Fog=0..1
//
// Knob 1: Hue. The glow, the fog and the green of the rims and eyes together: toxic green at 0, sea green at 0.25, sky blue at 0.5, blue violet at 0.75 and magenta at 1, while the sky leans from purple to indigo and back.
// Knob 2: Speed. At 2 each zombie closes a tenth of its distance a second, so it grows on the panel at one steady rate, at a little under two steps a second; the nearest, 1.95 m off at the start, begins to come apart in the fog two seconds later and is gone by about six. At 0.2 ten times slower with short shuffling steps, at 3 half as fast again with longer strides and harder lurches. The fog drifts on the same clock.
// Knob 3: Horde. How many walk at once, 5 to 18. They open spread from 2 m to 26 m, nearest first, a bigger horde as a wider wall of near ones, and each count puts its nearest zombie in a different place. Three in five drag a leg, and two in five have eyes that glow.
// Knob 4: Fog. How deep and thick the ground fog lies: at 0 a mist 0.3 m deep that hides the far lane and the feet of the far zombies, at 1 a bank 1.35 m deep and nearly six times as thick that swallows them to the chest.
// Buttons: K1 tap snaps every head upright to look at you, face turned to the eye and eyes lit green, for about two and a half seconds.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, exp, round, PI } = Math;
const TAU = 2 * PI;
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
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// Value noise on a 256 x 256 lattice.
const NT = new Float32Array(65536);
for (let i = 0; i < 65536; i++) NT[i] = hash(i * 7 + 3);
function vn(x, y) {
  const xi = floor(x), yi = floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) << 8, y1 = ((yi + 1) & 255) << 8;
  const a = NT[y0 + x0], b = NT[y0 + x1], c = NT[y1 + x0], d = NT[y1 + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// The eye: horizon row, vanishing column, LEDs per metre at one metre and
// eye height in metres. A point x metres to the side, h up and z ahead
// lands at column VX + F x / z and row YH + F (HC - h) / z.
const YH = 32, VX = 32, F = 100, HC = 1.45;
// The glow behind the horizon stands a little right of the lane.
const GX = 36;
// Half the lane's width; how far off zombies appear, where they are gone
// and where they start to come apart in the fog; the most there can be.
const ROAD = 1.1, ZMAX = 26, ZOUT = 1.05, ZFADE = 1.6, MAXZ = 18;
// Each zombie keeps to its line x of the lane until about ZC metres out,
// then bears in on the eye, so from there on it holds its column and only
// grows.
const ZC = 5, column = (Z) => VX + (F * Z.x) / sqrt(Z.z * Z.z + ZC * ZC);

// The glow's reach on the panel, the same every frame.
const GL = new Float32Array(N);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const dx = x + 0.5 - GX, dy = y + 0.5 - YH;
    GL[y * W + x] = exp(-(dx * dx) / 900 - (dy * dy) / 110) * 0.8 + exp(-(dx * dx) / 3000 - (dy * dy) / 700) * 0.35;
  }

// ---- Scenery: dead trees, a fence and a far treeline, drawn once as
// coverage with the depth of what covers each LED.
function capsuleInto(A, Z, x0, y0, x1, y1, r0, r1, z0, z1) {
  const ex = x1 - x0, ey = y1 - y0, ll = ex * ex + ey * ey || 1e-9, R = max(r0, r1) + 1;
  const X0 = max(0, floor(min(x0, x1) - R)), X1 = min(W - 1, floor(max(x0, x1) + R));
  const Y0 = max(0, floor(min(y0, y1) - R)), Y1 = min(H - 1, floor(max(y0, y1) + R));
  for (let y = Y0; y <= Y1; y++)
    for (let x = X0; x <= X1; x++) {
      let c = 0, uu = 0;
      for (let j = 0; j < 3; j++)
        for (let i = 0; i < 3; i++) {
          const px = x + (i + 0.5) / 3 - x0, py = y + (j + 0.5) / 3 - y0, u = cl((px * ex + py * ey) / ll, 0, 1);
          const dx = px - u * ex, dy = py - u * ey;
          if (dx * dx + dy * dy <= (r0 + (r1 - r0) * u) ** 2) c++, (uu = u);
        }
      if (!c) continue;
      const q = y * W + x, zz = z0 + (z1 - z0) * uu;
      A[q] = max(A[q], c / 9);
      if (zz < Z[q]) Z[q] = zz;
    }
}
// A crooked limb in the tree's own plane, in metres: from (x, h) at angle a
// from upright, len long, radius r, walked in short kinked steps that give
// off side limbs, mostly toward the lane (side tow).
function limb(A, Z, bx, z, x, h, a, len, r, depth, seed, tow) {
  const s = F / z, n = max(2, round(len / 0.4));
  for (let i = 0; i < n; i++) {
    const k = seed * 13 + i * 7, l = len / n, r0 = r * (1 - (0.5 * i) / n), r1 = r * (1 - (0.5 * (i + 1)) / n);
    a += (hash(k) - 0.5) * 0.9;
    const x2 = x + l * sin(a), h2 = h + l * cos(a);
    capsuleInto(A, Z, VX + s * (bx + x), YH + s * (HC - h), VX + s * (bx + x2), YH + s * (HC - h2), max(0.3, r0 * s), max(0.28, r1 * s), z, z);
    if (depth > 0 && i > 0 && hash(k + 1) < 0.55) {
      const side = hash(k + 2) < 0.65 ? tow : -tow;
      limb(A, Z, bx, z, x2, h2, a + side * (0.6 + 0.6 * hash(k + 3)), (len - i * l) * (0.45 + 0.35 * hash(k + 4)), r1 * 0.6, depth - 1, k + 5, tow);
    }
    (x = x2), (h = h2);
  }
}
function blur(A) {
  const T = new Float32Array(N);
  for (let q = 0; q < N; q++) {
    const x = q % W;
    T[q] = (2 * A[q] + A[x > 0 ? q - 1 : q] + A[x < W - 1 ? q + 1 : q]) / 4;
  }
  for (let q = 0; q < N; q++) A[q] = (2 * T[q] + T[q >= W ? q - W : q] + T[q < N - W ? q + W : q]) / 4;
}
function scenery() {
  const A = new Float32Array(N), Z = new Float32Array(N).fill(1e9);
  // Trees: side, distance, lean, height, seed.
  const trees = [[-2.3, 8.5, 0.15, 4.2, 1], [2.5, 11, -0.12, 4.4, 2], [-2.6, 16, 0.1, 4.6, 3], [2.9, 23, -0.1, 4.2, 4], [-3.1, 33, 0.05, 4.8, 5], [3.4, 48, -0.1, 4.5, 6]];
  for (const [bx, z, lean, ht, sd] of trees) {
    const s = F / z, tow = bx < 0 ? 1 : -1;
    // Root flare, then the trunk and its crown.
    capsuleInto(A, Z, VX + s * (bx - 0.25), YH + s * HC, VX + s * bx, YH + s * (HC - 0.45), 0.18 * s, 0.17 * s, z, z);
    capsuleInto(A, Z, VX + s * (bx + 0.25), YH + s * HC, VX + s * bx, YH + s * (HC - 0.45), 0.14 * s, 0.17 * s, z, z);
    limb(A, Z, bx, z, 0, 0.3, lean, ht, 0.13, 3, sd * 31, tow);
  }
  // The fence on the left: posts every 2.6 m, two rails, one post leaning
  // and one rail fallen.
  for (let i = 0; i < 14; i++) {
    const z = 4.4 + 2.6 * i, s = F / z, x = -2.2, lean = i === 2 ? 0.25 : (hash(i + 40) - 0.5) * 0.1;
    capsuleInto(A, Z, VX + s * x, YH + s * HC, VX + s * (x + lean), YH + s * (HC - 1.15), 0.06 * s, 0.05 * s, z, z);
    if (i === 13) break;
    const z2 = z + 2.6, s2 = F / z2;
    for (const [h, k] of [[0.5, 0], [0.95, 1]]) {
      const drop = i === 4 && k === 1 ? 0.7 : 0;
      capsuleInto(A, Z, VX + s * x, YH + s * (HC - h), VX + s2 * x, YH + s2 * (HC - h + drop), 0.025 * s, 0.025 * s2, z, z2);
    }
  }
  // A far treeline on the horizon.
  for (let x = 0; x < W; x++) {
    const ht = 1.5 + 2.2 * vn(x / 5, 7) + 1.6 * max(0, vn(x / 2.3, 11) - 0.55);
    for (let y = YH - 6; y < YH + 1; y++) {
      const c = cl(ht - (YH + 0.5 - y), 0, 1), q = y * W + x;
      if (c > A[q]) (A[q] = c), (Z[q] = 60);
    }
  }
  blur(A);
  return { A, Z };
}

// Where the opening zombies stand across the panel, nearest first, so a
// bigger horde opens as a wider wall of them.
const COLS = [-0.45, 0.5, -0.92, 0.95, 0.08, -0.7, 0.75, -0.2, 0.3, -1, 1, -0.55, 0.6, -0.1, 0.15, -0.85, 0.85, -0.35];

export function setup(params) {
  const zs = [];
  for (let i = 0; i < MAXZ; i++) zs.push({ z: 0, seed: i * 17 + 5 });
  const sc = scenery(), A = (n) => new Float32Array(n);
  params.s = {
    t: 0, gait: 1, hue: 0, fog: 0.06, count: 5, look: 0, lookT: 0, started: false, zs, sA: sc.A, sZ: sc.Z,
    col: A(N * 3), base: A(N * 3), fogC: A(N * 3), fc: A(N * 3), nb: A(33 * 65), bg: A(N), nz: A(N), dist: A(N), R: A(65), caps: A(20 * 6),
    sky: [0, 0, 0], glow: [0, 0, 0], fogHue: [0, 0, 0], palHue: -1,
  };
}

function spawn(Z, z, x) {
  Z.seed += 101;
  const r = (j) => hash(Z.seed * 3 + j);
  Z.z = z || ZMAX - 4 * r(0);
  // x: the column to stand in now, or none for a line drawn at random.
  Z.x = x === undefined ? (r(1) - 0.5) * 2.6 : ((x - VX) * sqrt(Z.z * Z.z + ZC * ZC)) / F;
  Z.ph = r(2);
  Z.rate = 0.75 + 0.35 * r(3);
  // Which leg drags (-1 left, 1 right, 0 neither), how the arms go, which
  // way the head hangs and how far.
  Z.drag = r(4) < 0.6 ? (r(5) < 0.5 ? -1 : 1) : 0;
  Z.arms = floor(r(6) * 3);
  Z.loll = (r(7) < 0.5 ? -1 : 1) * (0.3 + 0.35 * r(8));
  Z.size = 0.92 + 0.2 * r(9);
  Z.eyes = r(10) < 0.4;
  Z.raiseL = (r(11) - 0.4) * 0.18;
  Z.raiseR = (r(12) - 0.4) * 0.18;
  // Half turned one way or the other, and stooped.
  Z.yaw = (r(13) < 0.5 ? -1 : 1) * (0.45 + 0.4 * r(14));
  Z.stoop = 0.12 + 0.2 * r(15);
  Z.fade = z ? 1 : 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 5, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(k[0], 0, 1);
  const sp = cl(k[1], 0.2, 3);
  s.count = round(cl(k[2], 5, MAXZ));
  s.fog = cl(k[3], 0, 1);
  if (!s.started) {
    // The opening horde, nearest first: one already close, the rest spread
    // evenly in the log of distance, which is how walking at a speed in
    // proportion to distance spreads them.
    for (let i = 0; i < s.count; i++) spawn(s.zs[i], 1.95 * (ZMAX / 1.95) ** ((i + 0.6 * hash(i + 9) * (i > 0)) / s.count), VX + (i ? 26 * COLS[i] : 13 * sin(s.count * 2.4)));
    s.started = true;
  }
  const dd = (d * sp) / 2;
  s.t += dd;
  // A faster walk takes longer strides and lurches harder.
  s.gait = 0.5 + 0.25 * sp;
  const b = input.btnPressed || [];
  if (b[0]) s.lookT = 3;
  s.lookT = max(0, s.lookT - d);
  s.look = cl(s.look + (s.lookT > 0.6 ? d / 0.12 : -d / 0.8), 0, 1);
  for (let i = 0; i < MAXZ; i++) {
    const Z = s.zs[i];
    if (i < s.count && !Z.z) spawn(Z, 0);
    if (!Z.z) continue;
    // They come on at a tenth of their distance a second at Speed 2, so
    // each grows on the panel at the same steady rate and the near ones
    // linger; slower again while a dragged leg comes through.
    const u = (Z.ph + Z.rate * s.t) % 1;
    Z.z -= dd * 0.1 * Z.z * (Z.drag ? 0.6 + 0.8 * abs(sin(TAU * u)) : 1);
    Z.fade = i < s.count ? min(1, Z.fade + d * 0.5) : Z.fade - d;
    if (Z.z < ZOUT || Z.fade < 0) i < s.count ? spawn(Z, 0) : (Z.z = 0);
  }
}

// The colours, and everything on the panel that only they change: the sky
// and the lane before fog, and the fog's own light at each LED.
function palette(s) {
  const h = s.hue, { sky, glow, fogHue, base, fogC } = s;
  // At 0 a toxic green glow under a purple sky; the glow turns through
  // cyan and blue to magenta and the sky leans toward indigo on the way.
  hsv(0.3 + 0.52 * h, 0.85, 1, glow);
  hsv(0.78 - 0.14 * sin(PI * h), 0.82, 1, sky);
  hsv(0.32 + 0.52 * h, 0.55, 1, fogHue);
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5, dy = yc - YH;
    for (let x = 0; x < W; x++) {
      const q = y * W + x, o = q * 3, gl = GL[q], dx = x + 0.5 - GX;
      let v, sh;
      if (dy < 0) {
        const u = yc / YH;
        (v = 0.19 + 0.16 * u * u), (sh = gl);
      } else {
        // A wet lane between dark fields, mirroring the glow, brightest far
        // off where the eye meets it at a graze: two wheel ruts full of water
        // and a dark strip of grass between them.
        const z = (F * HC) / dy, ax = abs(((x + 0.5 - VX) * z) / F);
        const road = (1 - sm(ROAD - 0.12, ROAD + 0.12, ax)) * (0.45 + 0.55 * sm(0.12, 0.3, ax)), rut = exp(-(((ax - 0.55) / 0.16) ** 2));
        v = 0.05 + 0.05 * road;
        sh = road * (0.7 + 0.5 * rut) * (0.12 + 0.4 * exp(-dy / 26) + 0.25 * exp(-(dx * dx) / (60 + 4 * dy)));
      }
      const fl = 0.42 + 0.65 * gl;
      for (let c = 0; c < 3; c++) {
        base[o + c] = (sky[c] * v + glow[c] * sh) * 255;
        fogC[o + c] = fogHue[c] * 255 * fl;
      }
    }
  }
  s.palHue = h;
}

// The fog's density at height h: thick at the ground and gone above a soft
// top that the Fog knob raises from 0.3 m to the chest. R is its integral
// up from the ground, in 64 steps to 2.4 m.
function fogTable(s) {
  const top = 0.3 + 1.05 * s.fog, rho = 0.55 + 2.6 * s.fog, R = s.R;
  let acc = 0;
  R[0] = 0;
  for (let i = 1; i <= 64; i++) {
    acc += (rho * (1 - sm(top * 0.45, top * 1.15, ((i - 0.5) / 64) * 2.4)) * 2.4) / 64;
    R[i] = acc;
  }
}
const Rat = (R, h) => {
  const u = cl((h / 2.4) * 64, 0, 64), i = min(63, floor(u));
  return R[i] + (R[i + 1] - R[i]) * (u - i);
};
// Optical depth from the eye to a point z ahead at height h: z times the
// mean density between the two heights.
function tau(R, z, h) {
  const dh = HC - h;
  if (abs(dh) < 0.02) return (z * (Rat(R, HC + 0.02) - Rat(R, HC - 0.02))) / 0.04;
  return (z * (Rat(R, HC) - Rat(R, h))) / dh;
}

// One zombie's pose as capsules in LEDs, [x0, y0, x1, y1, r0, r1] each.
// The body is built in metres, feet at 0, x to its right, y up and z
// forward toward the eye, then turned by its yaw: a zombie half turned
// shows both its reaching arms off to one side.
function pose(s, Z, out) {
  const z = Z.z, sc = (F / z) * Z.size, X = (Z.X = column(Z)), Y = YH + (F * HC) / z;
  const u = (Z.ph + Z.rate * s.t) % 1, w = TAU * u, cy = cos(Z.yaw), sy = sin(Z.yaw), G = s.gait;
  // The lurch: the trunk rolls over the planted leg, more so onto the good
  // one when the other drags; it stoops forward by Z.stoop.
  const roll = G * (0.08 * sin(w + 0.6) + (Z.drag ? 0.08 * Z.drag * max(0, sin(w * -Z.drag)) : 0)), cr = cos(roll), sr = sin(roll);
  const hipY = 0.92 - 0.035 * abs(cos(w)), hx = 0.04 * sin(w), cs = cos(Z.stoop), ss = sin(Z.stoop);
  let n = 0;
  const q = [0, 0, 0, 0];
  // A point of the upper body: stoop about the hips, then roll.
  const up = (x, y, f) => {
    const y1 = y * cs, z1 = y * ss + f;
    return [hx + x * cr + y1 * sr, hipY + y1 * cr - x * sr, z1];
  };
  const P = (a, b, r0, r1) => {
    out[n++] = X + (a[0] * cy + a[2] * sy) * sc;
    out[n++] = Y - a[1] * sc;
    out[n++] = X + (b[0] * cy + b[2] * sy) * sc;
    out[n++] = Y - b[1] * sc;
    out[n++] = r0 * sc;
    out[n++] = r1 * sc;
  };
  for (const side of [-1, 1]) {
    // Each leg swings forward in its half of the cycle; a dragged leg
    // barely lifts and trails behind.
    const dragged = Z.drag === side, ph = side < 0 ? w : w + PI, l = max(0, sin(ph)) * (dragged ? 0.15 : G);
    const fz = (dragged ? 0.08 : 0.24 * G) * cos(ph - PI / 2) - (dragged ? 0.12 : 0), fy = 0.05 + 0.13 * l;
    const hip = [hx + side * 0.1, hipY, 0], knee = [hx + side * 0.115, 0.5 + 0.06 * l, fz * 0.5 + 0.1 * l], foot = [side * 0.13, fy, fz];
    P(hip, knee, 0.09, 0.066);
    P(knee, foot, 0.066, 0.05);
    P(foot, [foot[0], foot[1] - 0.02, foot[2] + 0.1], 0.055, 0.05);
  }
  const neck = up(0, 0.5, 0), chest = up(0, 0.28, 0), sl = up(-0.17, 0.44, 0), sr2 = up(0.17, 0.44, 0);
  P(up(0, 0.04, 0), chest, 0.15, 0.18);
  P(chest, up(0, 0.44, 0), 0.18, 0.13);
  P(sl, sr2, 0.08, 0.08);
  // Rags of a shirt hanging below the waist.
  for (const [a, b, c] of [[-0.13, -0.17, 0.13], [0.02, 0.05, 0.11], [0.12, 0.15, 0.09]]) P(up(a, 0.06, 0), up(b, -c, 0), 0.05, 0.022);
  for (const side of [-1, 1]) {
    // Arms reach forward at shoulder height with the hands hanging limp;
    // some carry one arm dead at the side.
    const sh = side < 0 ? sl : sr2, bob = 0.035 * G * sin(w + side * 1.3), raise = side < 0 ? Z.raiseL : Z.raiseR;
    if (Z.arms === 2 && side > 0) {
      const el = [sh[0] + 0.05, sh[1] - 0.3, sh[2] + 0.03], wr = [sh[0] + 0.07, sh[1] - 0.56, sh[2] + 0.06];
      P(sh, el, 0.065, 0.05);
      P(el, wr, 0.05, 0.04);
      P(wr, [wr[0] + 0.01, wr[1] - 0.1, wr[2]], 0.042, 0.03);
    } else {
      const el = [sh[0] + side * 0.09, sh[1] - 0.04 + raise + bob, sh[2] + 0.27], wr = [el[0] + side * 0.07, el[1] + 0.02 + raise * 0.5 + bob, el[2] + 0.25];
      P(sh, el, 0.07, 0.056);
      P(el, wr, 0.056, 0.042);
      P(wr, [wr[0], wr[1] - 0.13, wr[2] + 0.05], 0.046, 0.028);
    }
  }
  // The head hangs to one side and swings with the step, unless it has
  // snapped up to look; its jaw hangs open below it.
  const la = (Z.loll + 0.2 * sin(w + 1.3)) * (1 - s.look) + roll, nk = [neck[0], neck[1] - 0.06, neck[2]];
  const hc = [neck[0] + 0.13 * sin(la), neck[1] + 0.13 * cos(la), neck[2] + 0.04];
  P(nk, hc, 0.065, 0.055);
  P(hc, [hc[0] - 0.06 * sin(la), hc[1] - 0.06 * cos(la), hc[2] + 0.02], 0.11, 0.085);
  return n;
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  if (s.palHue !== s.hue) palette(s);
  fogTable(s);
  const { col, base, bg, fogC, fc, nz, nb, dist, R, sA, sZ, glow, caps } = s, t = s.t;
  // The fog's billows, on every other LED each way: they drift across and
  // the bank breathes slowly.
  for (let j = 0; j <= H / 2; j++)
    for (let i = 0; i <= W / 2; i++) {
      const x = 2 * i, yc = 2 * j + 0.5;
      nb[j * 33 + i] = 0.6 + 0.8 * vn((x + 9 * t) / 13, yc / 5 + 0.3 * t) * (0.6 + 0.4 * vn((x - 4 * t) / 9, yc / 4 + 50));
    }
  // The sky, the lane under its fog, and the scenery, fogged at its depth.
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5, dy = yc - YH, tg = dy > 0 ? tau(R, (F * HC) / dy, 0) : 0, j = y >> 1, fy = (y & 1) * 0.5;
    for (let x = 0; x < W; x++) {
      const q = y * W + x, o = q * 3, i = j * 33 + (x >> 1), fx = (x & 1) * 0.5;
      const n0 = nb[i] + (nb[i + 1] - nb[i]) * fx, n1 = nb[i + 33] + (nb[i + 34] - nb[i + 33]) * fx, n = n0 + (n1 - n0) * fy, L = 0.45 + 0.55 * n;
      nz[q] = n;
      // The billows catch the light unevenly too.
      (fc[o] = fogC[o] * L), (fc[o + 1] = fogC[o + 1] * L), (fc[o + 2] = fogC[o + 2] * L);
      let r = base[o], g = base[o + 1], b = base[o + 2];
      if (tg > 0) {
        const f = 1 - exp(-tg * n);
        r += (fc[o] - r) * f;
        g += (fc[o + 1] - g) * f;
        b += (fc[o + 2] - b) * f;
      }
      const a = sA[q];
      if (a > 0) {
        const z = sZ[q], gl = GL[q], f = 1 - exp(-tau(R, z, HC - (dy * z) / F) * n) * (z > 50 ? 0.45 : 1);
        const tr = 10 + glow[0] * 40 * gl, tgr = 6 + glow[1] * 40 * gl, tb = 14 + glow[2] * 40 * gl;
        r += (tr + (fc[o] - tr) * f - r) * a;
        g += (tgr + (fc[o + 1] - tgr) * f - g) * a;
        b += (tb + (fc[o + 2] - tb) * f - b) * a;
      }
      col[o] = r;
      col[o + 1] = g;
      col[o + 2] = b;
      bg[q] = max(r, g, b);
    }
  }
  // Zombies, far to near, each as a soft distance field of its capsules.
  const order = s.zs.filter((Z) => Z.z > 0).sort((a, b) => b.z - a.z);
  for (const Z of order) {
    const nc = pose(s, Z, caps), z = Z.z, scl = (F / z) * Z.size, fw = cl(0.6 + scl / 50, 0.8, 1.45);
    let X0 = W, X1 = -1, Y0 = H, Y1 = -1;
    for (let c = 0; c < nc; c += 6) {
      const r = max(caps[c + 4], caps[c + 5]) + fw + 1;
      X0 = min(X0, caps[c] - r, caps[c + 2] - r);
      X1 = max(X1, caps[c] + r, caps[c + 2] + r);
      Y0 = min(Y0, caps[c + 1] - r, caps[c + 3] - r);
      Y1 = max(Y1, caps[c + 1] + r, caps[c + 3] + r);
    }
    (X0 = max(0, floor(X0))), (X1 = min(W - 1, floor(X1))), (Y0 = max(0, floor(Y0))), (Y1 = min(H - 1, floor(Y1)));
    if (X0 > X1 || Y0 > Y1) continue;
    for (let y = Y0; y <= Y1; y++) dist.fill(1e9, y * W + X0, y * W + X1 + 1);
    for (let c = 0; c < nc; c += 6) {
      const x0 = caps[c], y0 = caps[c + 1], x1 = caps[c + 2], y1 = caps[c + 3], r0 = caps[c + 4], r1 = caps[c + 5];
      const ex = x1 - x0, ey = y1 - y0, ll = ex * ex + ey * ey || 1e-9, R2 = max(r0, r1) + fw + 1;
      const xa = max(X0, floor(min(x0, x1) - R2)), xb = min(X1, floor(max(x0, x1) + R2)), ya = max(Y0, floor(min(y0, y1) - R2)), yb = min(Y1, floor(max(y0, y1) + R2));
      for (let y = ya; y <= yb; y++)
        for (let x = xa, q = y * W + xa; x <= xb; x++, q++) {
          const px = x + 0.5 - x0, py = y + 0.5 - y0, u = cl((px * ex + py * ey) / ll, 0, 1), dx = px - u * ex, dy = py - u * ey;
          const rr = r0 + (r1 - r0) * u, d2 = dx * dx + dy * dy, far = rr + fw;
          if (d2 > far * far) continue;
          const dd = sqrt(d2) - rr;
          if (dd < dist[q]) dist[q] = dd;
        }
    }
    // Black with a rim of the glow behind it, as bright as what it stands
    // against, then fogged by the air between.
    const fade = Z.fade * sm(ZOUT, ZFADE, z);
    for (let y = Y0; y <= Y1; y++) {
      const h = HC - ((y + 0.5 - YH) * z) / F, th = tau(R, z, h);
      for (let x = X0, q = y * W + X0; x <= X1; x++, q++) {
        const dd = dist[q];
        if (dd > fw) continue;
        // A fading zombie comes apart where the fog billows thickest first.
        let a = sm(fw, -fw, dd) * (fade > 0.99 ? 1 : sm(0, 0.35, fade * 1.4 - 0.5 * (nz[q] - 0.6)));
        if (sZ[q] < z) a *= 1 - sA[q];
        if (a <= 0) continue;
        const o = q * 3, rim = dd < -6 ? 0 : exp(min(0, dd) / 1.4) * min(1, bg[q] / 150) * 0.85, f = 1 - exp(-th * nz[q]) * (0.6 + 0.4 * fade);
        const r = 18 + glow[0] * 200 * rim, g = 9 + glow[1] * 200 * rim, b = 32 + glow[2] * 200 * rim;
        col[o] += (r + (fc[o] - r) * f - col[o]) * a;
        col[o + 1] += (g + (fc[o + 1] - g) * f - col[o + 1]) * a;
        col[o + 2] += (b + (fc[o + 2] - b) * f - col[o + 2]) * a;
      }
    }
    // Eyes: some always, every one while the heads are up.
    const eo = (Z.eyes ? 0.7 : 0) + s.look * 0.6;
    if (eo > 0 && scl > 9) {
      // On the face, which turns to the eye as the head comes up.
      const yw = Z.yaw * (1 - s.look), hx = (caps[nc - 6] - Z.X) / scl + 0.08 * sin(yw), ey = caps[nc - 5] + 0.01 * scl;
      const e = min(1, eo) * exp(-tau(R, z, 1.62)) * fade;
      for (const side of [-1, 1]) glowDot(col, Z.X + (hx + side * 0.045 * cos(yw)) * scl, ey, max(0.5, 0.022 * scl), glow, e);
    }
  }
  grain(display, col, nz);
}

function glowDot(col, cx, cy, r, c, e) {
  for (let y = max(0, floor(cy - 4)); y <= min(H - 1, floor(cy + 4)); y++)
    for (let x = max(0, floor(cx - 4)); x <= min(W - 1, floor(cx + 4)); x++) {
      const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2, k = e * (exp(-d2 / (r * r)) + 0.35 * exp(-d2 / (5 * r * r))), o = (y * W + x) * 3;
      col[o] += (120 + c[0] * 135) * k;
      col[o + 1] += (120 + c[1] * 135) * k;
      col[o + 2] += (120 + c[2] * 135) * k;
    }
}

// Grain: a fine checker half a step above and below each LED's level, the
// mist's droplets, as strong as the picture around it allows so it never
// makes a step of more than 40 levels, and a little stronger where the fog
// billows thick.
const lv = new Float32Array(N);
function grain(display, col, nz) {
  for (let q = 0; q < N; q++) lv[q] = min(255, max(col[q * 3], col[q * 3 + 1], col[q * 3 + 2]));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = y * W + x, m = lv[q], o = q * 3;
      let g = 0;
      if (x > 0) g = max(g, abs(m - lv[q - 1]));
      if (x < W - 1) g = max(g, abs(m - lv[q + 1]));
      if (y > 0) g = max(g, abs(m - lv[q - W]));
      if (y < H - 1) g = max(g, abs(m - lv[q + W]));
      const amp = max(0, min(19.5 * (0.8 + 0.15 * nz[q]), 0.45 * m, 0.45 * (255 - m), (39 - g) / 2));
      const f = m > 0.5 ? (m + ((x + y) & 1 ? amp : -amp)) / m : 1;
      display.setPixel(x, y, min(255, round(col[o] * f)), min(255, round(col[o + 1] * f)), min(255, round(col[o + 2] * f)));
    }
}
