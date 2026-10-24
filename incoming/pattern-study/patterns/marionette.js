// ===== Patternflow pattern =====
// Title:   Marionette
// Family:  stage
// Idea:    A jester marionette dances in a follow spot on a little stage, every joint hanging from a thread that runs up to the wooden cross in the puppeteer's hand on the lamplit bridge, so each tilt of the cross shows in the threads and the limbs they pull.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 25, after the string marionettes of the European puppet theatres
// Round:   25
// ===============================
// @matrix 64x128
// @knobs Costume=0..1, Speed=0.2..3, Number=0..4, Spot=-1..1
//
// Knob 1: Costume. The jester's motley: emerald at 0, then blue, magenta, scarlet and amber. The painted backcloth changes with it, a blue night behind the emerald.
// Knob 2: Speed. The tempo: at 2 the jig goes at 144 beats a minute and the five numbers take 22.5 s; at 0.2 ten times slower.
// Knob 3: Number. The number the show opens on, each in its own light: the jig in warm light, the bow under a pin spot, the flop in moonlight, the stamping dance over footlights, the strut across the stage. The rest follow in order.
// Knob 4: Spot. Where the follow spot stands out front, left at -1 to right at 1. The pool slides away from it, and the shadow of the puppet and its threads falls on the backcloth on the other side.
// Buttons: K1 tap: the puppeteer jerks the cross up, the puppet leaps with its knees tucked, lands and bows.

const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, round, sin, cos, abs, sqrt, exp, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function hsv(h, s, v) {
  h = fr(h) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// Rows: bridge rail, grip, top of the backcloth, its foot, the ankles' floor, the apron.
const [RAIL, GRIP, CLOTH, BACK, FLOOR, APRON] = [3, 11, 28, 108, 117, 124];
// Gravity in LEDs/s² (the 46 LED puppet is about 60 cm), damping per step, beats a second at Speed 2.
const [G, DAMP, BPS] = [700, 0.992, 2.4];
// The puppet standing, x from its middle: temples, shoulders, hips, elbows, hands, knees, ankles.
const REST = [-3, 74, 3, 74, -5, 80, 5, 80, -3, 94, 3, 94, -6, 88, 6, 88, -7, 96, 7, 96, -3, 106, 3, 106, -3, 117, 3, 117];
// Bones and their stiffness. The neck's diagonals are soft so the head can nod.
const BONES = "01 02 13 03. 12. 23 45 24 35 25 34 26 68 37 79 4a ac 5b bd".split(" ").map((s) => [parseInt(s[0], 16), parseInt(s[1], 16), s[2] ? 0.2 : 1]);
// The threads in the order of their anchors: temples, hands, the small of the back, knees.
const STR = [[0], [1], [8], [9], [4, 5], [10], [11]];
// How low each particle may go.
const LIM = [3.5, 3.5, 2, 2, 2, 2, 1.5, 1.5, 1.3, 1.3, 1.6, 1.6, 0, 0].map((v) => FLOOR - v);
// Beats in each number.
const LEN = [14, 8, 10, 10, 12];
// Each number's light: wash, follow spot, its radius, footlights, pin spot, rail lamps.
const CUES = [
  [0.5, 0.42, 0.34, 1, 0.9, 0.72, 21, 0.5, 0, 1],
  [0.05, 0.05, 0.1, 0.3, 0.3, 0.34, 13, 0.12, 1, 0.8],
  [0.12, 0.2, 0.42, 0.72, 0.84, 1, 20, 0.08, 0, 0.7],
  [0.42, 0.1, 0.16, 1, 0.66, 0.36, 17, 1.2, 0, 1],
  [0.58, 0.55, 0.46, 1, 1, 0.94, 25, 0.45, 0, 1],
];
const WOOD = [205, 150, 95], FACE = [232, 194, 156], GOLD = [255, 200, 80], FT = [1, 0.72, 0.42], LM = [1, 0.78, 0.52], PK = [1, 0.97, 0.9];

export function setup(params) {
  const F32 = (n) => new Float32Array(n);
  const P = (params.s = {
    p: F32(42), q: F32(42), f: F32(N * 3), lt: F32(N * 3), m: F32(N), alb: F32(N * 3), pi: new Int8Array(N),
    b: 0, num: 0, nk: -1, cue: CUES[0].slice(), leap: -1, walk: 0, sx: 32, sy: 92, bell: [38, 62, 0, 0], dust: [], k1: 0, s4: 0.06, flash: 0, stc: [0, 0],
    C: { x: 32, y: GRIP, r: 0, p: 0, w: 0, kL: 0, kR: 0, hL: 0, hR: 0, sH: 0, sB: 0, lean: 0 },
  });
  for (let i = 0; i < 14; i++) (P.p[i * 3] = P.q[i * 3] = 32 + REST[i * 2]), (P.p[i * 3 + 1] = P.q[i * 3 + 1] = REST[i * 2 + 1]);
  const p = P.p, A = (P.A = anchors(P.C));
  P.bl = BONES.map(([a, b]) => sqrt((p[a * 3] - p[b * 3]) ** 2 + (p[a * 3 + 1] - p[b * 3 + 1]) ** 2));
  P.sl = STR.map((s, j) => {
    const m = mid(p, s);
    return sqrt((m[0] - A[j][0]) ** 2 + (m[1] - A[j][1]) ** 2 + (m[2] - A[j][2]) ** 2) + (j > 4 ? 2 : 1);
  });
  paint(P);
  phys(P, A, A, 1 / 120, 150);
}

const mid = (p, s) => [0, 1, 2].map((c) => (p[s[0] * 3 + c] + p[s[s.length - 1] * 3 + c]) / 2);

// The cross: a stick from the grip with a bar across it. The leg bar is in the other hand below it.
function anchors(C) {
  const cp = cos(C.p), sp = sin(C.p), cr = cos(C.r), sr = sin(C.r), cw = cos(C.w), sw = sin(C.w);
  const T = (lx, ly) => {
    const y1 = ly * cp, z1 = ly * sp, x2 = lx * cr - y1 * sr, y2 = lx * sr + y1 * cr;
    return [C.x + x2 * cw + z1 * sw, C.y + y2, -x2 * sw + z1 * cw];
  };
  const L = (s, k) => [C.x + s * 7 * cw, C.y + 19 - k, 3 - s * 7 * sw];
  return [T(-4, 5), T(4, 5), T(-12, 5), T(12, 5), T(0, 16), L(-1, C.kL), L(1, C.kR), T(0, 0)];
}

// Verlet steps: gravity, bones, threads that pull only when taut, the floor.
function phys(P, A0, A1, h, n) {
  const p = P.p, q = P.q, C = P.C, h2 = h * h, d = [0, 0, 0];
  for (let st = 0; st < n; st++) {
    const f = (st + 1) / n;
    let rx = p[9] - p[6], rz = p[11] - p[8];
    const rl = sqrt(rx * rx + rz * rz) || 1;
    (rx /= rl), (rz /= rl);
    for (let i = 0; i < 14; i++) {
      // Knees bend forward, elbows out and back, the head leans in a bow.
      const sd = i & 1 ? 30 : -30, a = i > 9 && i < 12 ? [-90 * rz, 90 * rx] : i === 6 || i === 7 ? [sd * rx + 25 * rz, sd * rz - 25 * rx] : i < 2 ? [-C.lean * 400 * rz, C.lean * 400 * rx] : [0, 0];
      for (let c = 0, o = i * 3; c < 3; c++, o++) {
        const v = (p[o] - q[o]) * DAMP;
        (q[o] = p[o]), (p[o] += v + (c === 1 ? G : a[c >> 1]) * h2);
      }
    }
    for (let it = 0; it < 6; it++) {
      BONES.forEach(([a, b, k], j) => {
        let l = 0;
        for (let c = 0; c < 3; c++) (d[c] = p[b * 3 + c] - p[a * 3 + c]), (l += d[c] * d[c]);
        const m = (1 - P.bl[j] / (sqrt(l) || 1e-6)) * 0.5 * k;
        for (let c = 0; c < 3; c++) (p[a * 3 + c] += d[c] * m), (p[b * 3 + c] -= d[c] * m);
      });
      for (let s = 0; s < 7; s++) {
        const m = mid(p, STR[s]), L = max(4, P.sl[s] + (s < 2 ? C.sH : s === 2 ? -C.hL : s === 3 ? -C.hR : s === 4 ? C.sB : 0));
        let l = 0;
        for (let c = 0; c < 3; c++) (d[c] = m[c] - mix(A0[s][c], A1[s][c], f)), (l += d[c] * d[c]);
        if ((l = sqrt(l)) > L) for (const i of STR[s]) for (let c = 0; c < 3; c++) p[i * 3 + c] -= (d[c] * (l - L)) / l;
      }
      for (let i = 0; i < 14; i++) {
        const o = i * 3;
        if (p[o + 1] > LIM[i]) {
          // A foot that comes down hard raises dust.
          if (i > 11 && it === 0 && p[o + 1] - q[o + 1] > 0.45 && P.stc[i - 12] <= 0) stamp(P, p[o], p[o + 1] - q[o + 1]), (P.stc[i - 12] = 0.25);
          (p[o + 1] = q[o + 1] = LIM[i]), (q[o] = p[o] - (p[o] - q[o]) * 0.5), (q[o + 2] = p[o + 2] - (p[o + 2] - q[o + 2]) * 0.5);
        }
        (p[o] = cl(p[o], 3, 60)), (p[o + 2] = cl(p[o + 2], -14, 14));
      }
    }
  }
}

function stamp(P, x, v) {
  for (let i = 0; i < 7; i++) P.dust.push([x + (Math.random() - 0.5) * 4, FLOOR + 1, (Math.random() - 0.5) * 40, -6 - Math.random() * 14 * v, 0.5 + Math.random() * 0.5]);
}

// What the puppeteer does with the cross in each number, beat by beat.
function script(n, b) {
  const T = { x: 32, y: GRIP, r: 0, p: 0, w: 0, kL: 0, kR: 0, hL: 0, hR: 0, sH: 0, sB: 0, lean: 0, au: 0 };
  const ph = fr(b), bu = sin(PI * ph), odd = floor(b) & 1;
  if (n === 0) {
    // The jig: a hop on every beat, knees and arms up in turn, across and back.
    const tr = (TAU * b) / 8, sw = sin((PI * b) / 2), e = 1 - sm(LEN[0] - 1.5, LEN[0], b);
    (T.x = 32 + 10 * sin(tr) * e), (T.w = 0.5 * cos(tr) * e), (T.y -= 3.5 * bu * e), (T[odd ? "kR" : "kL"] = 9 * bu * bu * e);
    (T.r = 0.3 * sw), (T.hL = 13 * max(0, sw) * e), (T.hR = 13 * max(0, -sw) * e);
  } else if (n === 1) {
    // The bow: the head threads let out, the back thread holds, the cross tips over.
    const u = sm(1, 2.4, b) * (1 - sm(5, 6.6, b));
    (T.y += u), (T.p = -0.5 * u), (T.sH = 11 * u), (T.sB = -3 * u), (T.lean = 1.3 * u), (T.w = 0.6 * u), (T.hR = 12 * sm(0.2, 1.2, b) * (1 - sm(4.6, 6.2, b))), (T.au = 1);
  } else if (n === 2) {
    // The flop: all let go, a heap on the floor, the head comes up to look round, lifted back up, a shake.
    const dr = sm(0.8, 1.15, b) * (1 - sm(5.2, 6.8, b)), lk = sm(2.2, 2.9, b) * (1 - sm(4.4, 5, b));
    (T.x = 27), (T.y += 26 * dr), (T.sH = -14 * lk * dr), (T.w = 0.7 * dr + 0.6 * sin((TAU * (b - 2.2)) / 2.2) * lk), (T.au = 1);
    T.r = 0.35 * sin(TAU * b) * sm(6.8, 7.3, b) * (1 - sm(9, 9.8, b));
  } else if (n === 3) {
    // The stamp: a knee drawn up slowly and let drop hard on the beat.
    (T.x = 37), (T[odd ? "kR" : "kL"] = 11 * sm(0.1, 0.6, ph) * (1 - sm(0.82, 0.9, ph))), (T.r = (odd ? 0.22 : -0.22) * bu);
    (T.lean = -0.25), (T.hL = T.hR = 5), (T.w = 0.3 * sin((TAU * b) / 4)), (T.au = 1);
  } else {
    // The strut: across the stage and back, facing the way it goes.
    const tr = (TAU * b) / 12;
    (T.x = 32 + 12 * cos(tr)), (T.w = -0.8 * sin(tr)), (T.y -= 1.5 * bu), (T[odd ? "kR" : "kL"] = 6 * bu), (T.r = 0.25 * sin(PI * b)), (T.p = -0.1);
  }
  return T;
}

// K1's leap, in seconds: crouch, jerk up, fly, land, bow.
function leap(P, T, rd) {
  const u = P.leap, a = 1 - sm(2.7, 3.3, u), air = sm(0.25, 0.4, u) * (1 - sm(0.55, 0.95, u)), tuck = sm(0.3, 0.45, u) * (1 - sm(0.75, 0.95, u));
  const bow = sm(1.2, 1.7, u) * (1 - sm(2.4, 3, u)), cr = sm(0, 0.2, u) * (1 - sm(0.22, 0.32, u));
  (T.y = mix(T.y, GRIP + 4 * cr - 10 * air + 4 * bow, a)), (T.kL = T.kR = mix(T.kL, 7 * tuck, a)), (T.hL = T.hR = mix(T.hL, 15 * tuck, a));
  (T.sH = mix(T.sH, 10 * bow, a)), (T.lean = mix(T.lean, bow, a)), (T.p = mix(T.p, -0.5 * bow, a)), (T.r *= 1 - a), (T.w *= 1 - a), (T.x = mix(T.x, P.C.x, a));
  if (u < 0.4 && u + rd >= 0.4) P.flash = 1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], rd = cl(dt || 0, 0, 0.05), d = (rd * cl(k[1], 0.2, 3)) / 2;
  (P.k1 = cl(k[0], 0, 1)), (P.s4 = cl(k[3], -1, 1));
  const nk = round(cl(k[2], 0, 4));
  if (nk !== P.nk) {
    if (P.nk < 0) P.cue = CUES[nk].slice();
    (P.nk = P.num = nk), (P.b = 0);
  }
  if ((P.b += d * BPS) >= LEN[P.num]) (P.b -= LEN[P.num]), (P.num = (P.num + 1) % 5);
  if (input.btnPressed && input.btnPressed[0] && P.leap < 0) P.leap = 0;
  const T = script(P.num, P.b), C = P.C, x0 = C.x;
  if (P.leap >= 0 && (leap(P, T, rd), (P.leap += rd) > 3.3)) P.leap = -1;
  const ex = min(1, rd / 0.45), e = min(1, rd / 0.05);
  for (const key in C) C[key] = mix(C[key], T[key], key === "x" ? ex : e);
  // Steps wherever the cross travels in a number without its own.
  const dx = abs(C.x - x0);
  P.walk += dx / 5;
  if (T.au && rd > 0) {
    const lift = min(1, dx / rd / 6) * 6 * sin(PI * fr(P.walk)) ** 2;
    floor(P.walk) & 1 ? (C.kR = max(C.kR, lift)) : (C.kL = max(C.kL, lift));
  }
  const A = anchors(C), n = max(1, ceil(rd * 120 - 1e-6));
  if (rd > 0) phys(P, P.A, A, rd / n, n);
  P.A = A;
  for (let i = 0; i < 10; i++) P.cue[i] = mix(P.cue[i], CUES[P.num][i], min(1, rd * 2.2));
  // The follow spot keeps to the body.
  const p = P.p;
  (P.sx = mix(P.sx, (p[6] + p[9] + p[12] + p[15]) / 4, min(1, rd * 3.5))), (P.sy = mix(P.sy, (p[7] + p[10] + p[13] + p[16]) / 4 + 3, min(1, rd * 2.5)));
  // The bell on the cap swings after the head.
  const hd = head(p), B = P.bell, gx = hd.x + hd.ux * 7 - hd.uy * 6, gy = hd.y + hd.uy * 7 + hd.ux * 6 + 2;
  (B[2] += ((gx - B[0]) * 160 - B[2] * 7) * rd), (B[3] += ((gy - B[1]) * 160 - B[3] * 7 + 60) * rd), (B[0] += B[2] * rd), (B[1] += B[3] * rd);
  (B[0] = cl(B[0], gx - 6, gx + 6)), (B[1] = cl(B[1], gy - 6, gy + 6));
  P.dust = P.dust.filter((s) => ((s[3] += 50 * rd), (s[0] += s[2] * rd), (s[1] = min(FLOOR + 2, s[1] + s[3] * rd)), (s[4] -= rd) > 0));
  (P.stc[0] -= rd), (P.stc[1] -= rd), (P.flash = max(0, P.flash - rd * 1.5));
}

// The head: its middle, which way is up, how far it is turned and nodded.
function head(p) {
  const x = (p[0] + p[3]) / 2, y = (p[1] + p[4]) / 2 - 0.5, z = (p[2] + p[5]) / 2, sx = (p[6] + p[9]) / 2, sy = (p[7] + p[10]) / 2, sz = (p[8] + p[11]) / 2;
  const l = Math.hypot(x - sx, y - sy) || 1;
  return { x, y, ux: (x - sx) / l, uy: (y - sy) / l, yaw: atan2(-(p[5] - p[2]), p[3] - p[0]), nod: (z - sz) / 6.3 };
}

// What does not move: velvet, rail, backcloth, boards, apron.
function paint(P) {
  const A = P.alb, I = P.pi;
  for (let i = 0; i < N; i++) {
    const x = i & 63, y = i >> 6, o = i * 3, n = hash(x, y);
    let c = [0.05, 0.045, 0.06];
    I[i] = -1;
    if (y >= RAIL && y <= RAIL + 3) {
      const g = (0.8 + 0.3 * hash(floor((x + y * 7) / 11), y)) * (y === RAIL ? 1.2 : y === RAIL + 3 ? 0.6 : 1) * (0.92 + 0.08 * n);
      c = [0.55 * g, 0.36 * g, 0.22 * g];
    } else if (y >= CLOTH - 2 && y < CLOTH) c = [0.13, 0.1, 0.08];
    else if (y >= CLOTH && y < BACK) {
      // Painted night: stars over two rows of hills, in soft folds.
      const hf = 86 + 4 * sin(x * 0.09 + 0.5) + 2 * sin(x * 0.27 + 1), hn = 97 + 3 * sin(x * 0.13 + 2) + 1.5 * sin(x * 0.41);
      const cx = floor(x / 7), cy = floor(y / 8), r = hash(cx, cy + 50), sx = cx * 7 + 1 + floor(r * 5), sy = cy * 8 + 1 + floor(hash(cx + 9, cy) * 6);
      I[i] = y >= hn ? 2 : y >= hf ? 1 : r < 0.5 && y < hf - 3 ? (x === sx && y === sy ? 3 : abs(x - sx) + abs(y - sy) === 1 ? 4 : 0) : 0;
      c = [(0.8 + 0.2 * (0.5 + 0.5 * sin(x * 0.95 + 0.6 * sin(y * 0.05)))) * (0.95 + 0.1 * n), 0, 0];
    } else if (y >= BACK && y < APRON) {
      // Boards running towards you.
      const u = (x - 31.5) / ((y - 30) / (APRON - 30)) / 6 + 0.5, bd = floor(u), g = (0.8 + 0.2 * hash(bd, 3)) * mix(0.45, 1, cl(min(fr(u), 1 - fr(u)) * 9 - 0.3, 0, 1)) * (y > APRON - 3 ? 1.12 : 1) * (0.92 + 0.14 * hash(x, bd * 31 + floor(y / 3)));
      c = [0.6 * g, 0.42 * g, 0.27 * g];
    } else if (y >= APRON) c = y === APRON ? [0.4, 0.28, 0.18] : [0.14, 0.09, 0.07];
    (A[o] = c[0]), (A[o + 1] = c[1]), (A[o + 2] = c[2]);
  }
}

let F, L, M, MODE, SIDE;
// One LED of the puppet or cross: the shadow mask, or its colour in the light there.
function dot(x, y, c, nx = 0, flat = 0) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = y * W + x, o = i * 3;
  if (MODE === 0) return void (M[i] = 1);
  const k = 1 - 0.2 * nx * nx + 0.4 * SIDE * nx;
  for (let j = 0; j < 3; j++) F[o + j] = c[j] * max(flat, L[o + j]) * k;
}
// A capsule; the colour may be a function of how far along.
function seg(x0, y0, x1, y1, r, c, flat = 0) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1e-6;
  for (let y = floor(min(y0, y1) - r); y <= ceil(max(y0, y1) + r); y++)
    for (let x = floor(min(x0, x1) - r); x <= ceil(max(x0, x1) + r); x++) {
      const px = x - x0, py = y - y0, t = cl((px * dx + py * dy) / l2, 0, 1), ex = px - dx * t, ey = py - dy * t;
      if (ex * ex + ey * ey <= r * r) dot(x, y, typeof c === "function" ? c(t) : c, cl(ex / r, -1, 1), flat);
    }
}
const disc = (x, y, r, c, flat) => seg(x, y, x, y, r, c, flat);

// A thread: one LED wide over two columns, a faint halo, a glint that slides as it tilts.
function thread(ax, ay, bx, by, gl) {
  const n = ceil(abs(by - ay)) + 1, tilt = (bx - ax) / (by - ay || 1), g0 = 0.5 + 6 * (tilt + SIDE * 0.06);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = mix(ax, bx, t), y = round(mix(ay, by, t)), x0 = floor(x), f = x - x0;
    if (y < 0 || y >= H) continue;
    if (MODE === 0) {
      if (x0 >= 0 && x0 < W) M[y * W + x0] = max(M[y * W + x0], 0.45);
      continue;
    }
    const o = (y * W + cl(x0, 0, W - 1)) * 3, gls = gl * 150 * exp(-((((t - g0) * n) / 5) ** 2));
    for (let e = -1; e < 3; e++) {
      const xx = x0 + e, a = e < 0 ? 0.12 - 0.12 * f : e ? (e > 1 ? 0.12 * f : 0.12 + 0.88 * f) : 1 - 0.88 * f, q = (y * W + xx) * 3;
      if (xx < 0 || xx >= W) continue;
      for (let j = 0; j < 3; j++) F[q + j] += a * (24 + 64 * L[o + j] + gls);
    }
  }
}

function puppet(P, C1, C2) {
  const p = P.p, X = (i) => p[i * 3], Y = (i) => p[i * 3 + 1], Z = (i) => p[i * 3 + 2], tz = (Z(2) + Z(3) + Z(4) + Z(5)) / 4;
  const stock = (t) => (floor(t * 5) & 1 ? C1 : [235, 228, 210]);
  const limb = (a, b, c, up, low, r1, r2) => {
    seg(X(a), Y(a), X(b), Y(b), r1, up), seg(X(b), Y(b), X(c), Y(c), r2, low);
  };
  const arm = (s) => (limb(2 + s, 6 + s, 8 + s, C2, C1, 1.6, 1.2), disc(X(8 + s), Y(8 + s), 1.4, FACE));
  const leg = (s) => {
    limb(4 + s, 10 + s, 12 + s, C2, stock, 1.8, 1.2);
    const fx = X(12 + s), fy = Y(12 + s) + 1.2, yw = atan2(-(Z(3) - Z(2)), X(3) - X(2));
    seg(fx - 1.2, fy, fx + 1.2 + 2.4 * sin(yw), fy, 1.1, C2.map((v) => v * 0.55)), dot(round(fx + 2.4 + 2.6 * sin(yw)), round(fy - 1), GOLD);
  };
  const parts = [[(Z(6) + Z(8)) / 2, () => arm(0)], [(Z(7) + Z(9)) / 2, () => arm(1)], [(Z(10) + Z(12)) / 2, () => leg(0)], [(Z(11) + Z(13)) / 2, () => leg(1)]];
  for (const [z, f] of parts) if (z < tz - 1) f();
  // The doublet in diamonds, flaring to a hem of points, with a belt.
  const sx = (X(2) + X(3)) / 2, sy = (Y(2) + Y(3)) / 2, hx = (X(4) + X(5)) / 2, hy = (Y(4) + Y(5)) / 2, ax = hx - sx, ay = hy - sy, al = ax * ax + ay * ay || 1;
  let ex = X(3) - X(2) + X(5) - X(4), ey = Y(3) - Y(2) + Y(5) - Y(4);
  const el = Math.hypot(ex, ey) || 1, hwS = max(2.5, Math.hypot(X(3) - X(2), Y(3) - Y(2)) / 2), hwH = max(2.5, Math.hypot(X(5) - X(4), Y(5) - Y(4)) * 0.62);
  (ex /= el), (ey /= el);
  for (let y = floor(min(sy, hy) - 6); y <= ceil(max(sy, hy) + 6); y++)
    for (let x = floor(min(sx, hx) - 7); x <= ceil(max(sx, hx) + 7); x++) {
      const v = ((x - sx) * ax + (y - sy) * ay) / al, hw = mix(hwS, hwH, v), u = ((x - sx - ax * v) * ex + (y - sy - ay * v) * ey) / hw;
      if (v < -0.05 || abs(u) > 1 || v > 1.1 + 0.12 * abs(fr(u * 2.5) - 0.5) * 2) continue;
      const belt = v > 0.84 && v < 0.94, dia = (floor(u * 1.6 + v * 3.2) + floor(u * 1.6 - v * 3.2)) & 1;
      dot(x, y, belt ? (abs(u) < 0.22 ? GOLD : [60, 40, 30]) : dia ? C1 : C2, u);
    }
  for (const [z, f] of parts) if (z >= tz - 1) f();
  // The ruff, the head, the face, the cap and its bell.
  seg(X(2), Y(2) - 1, X(3), Y(3) - 1, 1.7, (t) => (floor(t * 9) & 1 ? [250, 246, 236] : [205, 200, 192]));
  const hd = head(p), R = 4.3, px = -hd.uy, py = hd.ux;
  disc(hd.x, hd.y, R, FACE);
  if (MODE && hd.nod < 0.7)
    for (const [ph, hy, c] of [[0.5, -0.4, [30, 22, 34]], [0.8, 1.2, [240, 120, 110]], [0, 2.1, [150, 40, 46]], [-0.5, -0.4, [30, 22, 34]], [-0.8, 1.2, [240, 120, 110]]]) {
      const a = ph + hd.yaw;
      if (cos(a) > 0.25) dot(round(hd.x + R * 0.85 * sin(a)), round(hd.y + hy + hd.nod * 3), c);
    }
  const b0x = hd.x + hd.ux * 3.1, b0y = hd.y + hd.uy * 3.1, b1x = hd.x + hd.ux * 8 + px, b1y = hd.y + hd.uy * 8 + py, [bx, by] = P.bell;
  for (let i = 0, lx = b0x, ly = b0y; i <= 8; i++) {
    const t = i / 8, x = mix(mix(b0x, b1x, t), mix(b1x, bx, t), t), y = mix(mix(b0y, b1y, t), mix(b1y, by, t), t);
    seg(lx, ly, x, y, mix(3.3, 0.8, t), C1), (lx = x), (ly = y);
  }
  seg(hd.x + hd.ux * 2.3 - px * 4, hd.y + hd.uy * 2.3 - py * 4, hd.x + hd.ux * 2.3 + px * 4, hd.y + hd.uy * 2.3 + py * 4, 0.9, C2);
  disc(bx, by, 1.3, GOLD);
}

// The puppeteer's sleeves and hands, the cross and the leg bar.
function cross(P) {
  const A = P.A, [gx, gy] = A[7], sleeve = [46, 38, 60], skin = [232, 176, 140], cuff = [236, 232, 222];
  const arm = (x0, x1, y1) => seg(x0, -3, x1, y1, 2.6, (t) => (t > 0.84 ? cuff : sleeve), 0.32);
  seg(A[5][0] - 1.5, A[5][1], A[6][0] + 1.5, A[6][1], 0.7, WOOD, 0.35);
  seg(gx, gy, A[4][0], A[4][1], 0.9, WOOD, 0.35), seg(A[2][0], A[2][1], A[3][0], A[3][1], 0.8, WOOD, 0.35);
  for (let j = 0; j < 7; j++) dot(round(A[j][0]), round(A[j][1]), [220, 220, 230], 0, 0.5);
  arm(gx + 17, gx + 1.5, gy - 1.5), disc(gx + 0.5, gy - 0.5, 2.2, skin, 0.4);
  arm(A[5][0] - 22, A[5][0] - 2.5, A[5][1] - 1), disc(A[5][0] - 2, A[5][1] - 0.5, 2, skin, 0.4);
}

function stage(P, pal) {
  const [wr, wg, wb, sr0, sg0, sb0, rad0, foot, pin, lamp] = P.cue, s = P.s4, A = P.alb, I = P.pi, p = P.p;
  const fl = 1 + 0.5 * P.flash, rad = rad0 + 7 * P.flash, S = [sr0 * fl, sg0 * fl, sb0 * fl], WS = [wr, wg, wb];
  const px = P.sx - s * 11, py = P.sy, rx = rad * (1 + 0.45 * abs(s)), ry = rad * 1.35, sdx = -s * 15, fx = (p[36] + p[39]) / 2, pinX = P.sx;
  const lift = [0, 1].map((j) => 1 - sm(0, 8, FLOOR - p[37 + j * 3]));
  for (let y = 0; y < H; y++) {
    const ft = y < APRON ? foot * exp((y - APRON) / 14) : 0, wash = y < CLOTH - 2 ? (y >= RAIL && y <= RAIL + 3 ? 0.3 : 0.08) : 1, cw = 2 + (y + 12) * 0.085;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 3, dx = (x - px) / rx, dy = (y - py) / ry, pool = 1 - sm(0.84, 1, sqrt(dx * dx + dy * dy));
      const lm = lamp * (1 / (1 + ((x - 4.5) ** 2 + (y - 10) ** 2) / 260) + 1 / (1 + ((x - 59.5) ** 2 + (y - 10) ** 2) / 260));
      let cone = 0;
      if (pin > 0.01) cone = y >= BACK ? pin * (1 - sm(0.7, 1, sqrt(((x - pinX) / 12) ** 2 + ((y - FLOOR - 1) / 4) ** 2))) : pin * (1 - sm(0.6, 1, abs(x - pinX) / cw));
      for (let j = 0; j < 3; j++) L[o + j] = wash * WS[j] + pool * S[j] + ft * FT[j] + lm * LM[j] + cone * PK[j];
      // The shadow stands up from the feet, larger, away from the spot.
      let sh = 0, k = 1;
      if (y >= CLOTH && y < APRON && pool > 0) {
        const mx = round(fx + (x - fx - sdx) / 1.12), my = round(FLOOR + (y - FLOOR + 3) / 1.12);
        if (mx >= 0 && mx < W && my >= 0 && my < H) sh = M[my * W + mx] * pool * 0.8;
      }
      if (y > BACK && y < APRON) for (let j = 0; j < 2; j++) k *= 1 - 0.6 * lift[j] * exp(-1.5 * (((x - p[36 + j * 3]) / 3.5) ** 2 + ((y - FLOOR - 1.5) / 1.3) ** 2));
      const c = I[i] >= 0 ? pal[I[i]] : null, f = c ? A[o] : 1, cf = c ? 0.8 * cone : 0;
      for (let j = 0; j < 3; j++) F[o + j] = (c ? c[j] : A[o + j]) * f * k * (L[o + j] - sh * S[j] - cf * PK[j]) * 255;
    }
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  [F, L, M, SIDE] = [P.f, P.lt, P.m, P.s4];
  const h = 0.36 + P.k1, hc = 0.61 + 0.3 * sin(TAU * P.k1), A = P.A, p = P.p;
  const C1 = hsv(h, 0.8, 0.8).map((v) => v * 255), C2 = hsv(h + 0.06, 0.75, 0.42).map((v) => v * 255);
  const sky = hsv(hc, 0.62, 0.34), star = [0.95, 0.78, 0.4], pal = [sky, hsv(hc + 0.06, 0.55, 0.46), hsv(hc + 0.12, 0.6, 0.58), star, sky.map((v, j) => mix(v, star[j], 0.4))];
  const threads = (from, to) => {
    for (let s = from; s < to; s++) {
      const m = mid(p, STR[s]), side = s < 2 ? (s ? 2 : -2) * cos(head(p).yaw) : 0;
      thread(A[s][0], A[s][1], m[0] + side, m[1] - (s < 2 ? 1 : 0), s === 4 ? 0.4 : 1);
    }
  };
  // The shadow first: the puppet and its threads as a mask.
  M.fill(0), (MODE = 0), threads(0, 7), puppet(P, C1, C2);
  (MODE = 1), stage(P, pal);
  threads(0, 7), puppet(P, C1, C2), cross(P);
  // Dust from the stamps, the haze in the pin beam, the footlights.
  for (const [x, y, , , l] of P.dust) {
    const o = (round(y) * W + round(x)) * 3;
    if (x >= 0 && x < W && y >= 0 && y < H) for (let j = 0; j < 3; j++) F[o + j] += [190, 160, 130][j] * l * 0.6 * max(0.4, L[o + j]);
  }
  const pin = P.cue[8];
  if (pin > 0.01)
    for (let y = 0; y < BACK; y++) {
      const cw = 2 + (y + 12) * 0.085;
      for (let x = 0; x < W; x++) {
        const c = pin * 0.09 * (1 - sm(0.6, 1, abs(x - P.sx) / cw)) * 255;
        for (let j = 0; j < 3; j++) F[(y * W + x) * 3 + j] += c * PK[j];
      }
    }
  // The clip lamps on the rail and the footlights.
  for (const x of [4.5, 59.5]) {
    seg(x - 2, 7.5, x + 2, 7.5, 1.2, [40, 80, 58], 0.5), seg(x - 0.5, 9.2, x + 0.5, 9.2, 0.6, [255, 226, 170], P.cue[9]);
    for (let i = -3; i < 4; i++) for (let j = 0; j < 3; j++) F[(10 * W + round(x + i)) * 3 + j] += (80 * P.cue[9] * LM[j]) / (1 + i * i);
  }
  const fb = min(1, P.cue[7] * 1.2 + 0.15);
  for (const x of [6, 19, 32, 45, 57])
    for (let i = -2; i <= 3; i++) {
      const a = i === 0 || i === 1 ? fb : fb * 0.25;
      for (let j = 0; j < 3; j++) F[(125 * W + x + i) * 3 + j] += 255 * a * FT[j];
    }
  for (let i = 0, o = 0; i < N; i++, o += 3) display.setPixel(i & 63, i >> 6, min(255, max(0, F[o])) | 0, min(255, max(0, F[o + 1])) | 0, min(255, max(0, F[o + 2])) | 0);
}
