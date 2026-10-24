// ===== Patternflow pattern =====
// Title:   Dark Field
// Family:  microbe
// Idea:    A drop of pond water under a dark-field microscope, everything alive glowing on black by the light it scatters: Volvox roll with daughters inside, paramecia glide in a shimmer of cilia, diatoms slide and stop, Vorticella bells feed on long stalks that snap into coils, and what lies outside the focal plane blurs to a soft halo.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 26, after dark-field and Rheinberg illumination in the light microscope
// Round:   26
// ===============================
// @matrix 64x128
// @knobs Light=0..1, Speed=0.2..3, Crowd=0..1, Focus=-1..1
//
// Knob 1: Light. At 0 classic dark field, white and gold on black. At 0.5 a Rheinberg filter: a deep blue field, each edge yellow where it faces sideways and red where it faces up or down. At 1 phase contrast: a grey field, the bodies dark inside bright halos.
// Knob 2: Speed. At 2 a paramecium crosses the panel in about six seconds; at 0.2 the drop runs ten times slower.
// Knob 3: Crowd. At 0 three Volvox, three paramecia, five diatoms, five Vorticella bells, a rotifer and a few hundred bacteria; at 1 more of each, fading in.
// Knob 4: Focus. Which depth is sharp: near 0 the algal thread with its Vorticella and rotifer, toward -1 the water under the coverslip, toward 1 the slide's glass, where diatoms glide among settled grit.
// Buttons: K1 tap knocks the slide: the view jolts, every Vorticella snaps its stalk into a coil and the rotifer pulls in its crown. On its own one bell snaps four seconds in, then one every ten seconds or so.

const W = 64, H = 128, N = W * H, HW = 32, HH = 64;
const { min, max, floor, round, ceil, sin, cos, sqrt, exp, abs, PI, atan2 } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
const rr = (a, b) => a + (b - a) * rnd();
function h32(a, b) {
  let h = Math.imul(a ^ Math.imul(b, 0x27d4eb2d), 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca77);
  h ^= h >>> 13;
  return (h ^ (h >>> 16)) >>> 0;
}

// Small things live on a torus a little larger than the view, so what leaves
// one side comes back at the other out of sight. Big swimmers turn back
// toward the middle near an edge.
const wrap = (o, m = 12) => ((o.x -= (W + 2 * m) * floor((o.x + m) / (W + 2 * m))), (o.y -= (H + 2 * m) * floor((o.y + m) / (H + 2 * m))));
const go = (o, v) => ((o.x += cos(o.h) * v), (o.y += sin(o.h) * v));
function swim(o, d) {
  if ((o.z += o.vz * d) > 1 || o.z < -1) o.vz = -o.vz;
  if (o.x > 8 && o.x < 56 && o.y > 12 && o.y < 116) return;
  let e = atan2(64 - o.y, 32 - o.x) - o.h;
  o.h += cl(e - TAU * round(e / TAU), -1, 1) * 1.2 * d;
}
// Colours each thing scatters in dark field.
const C = {
  cell: [110, 255, 118], vrim: [175, 255, 165], dau: [64, 255, 92], par: [200, 222, 255], gran: [255, 236, 196], dia: [255, 194, 72],
  vor: [222, 236, 255], rot: [255, 226, 186], eug: [132, 255, 140], amb: [255, 184, 100], gry: [212, 206, 198], wall: [205, 242, 182],
  chl: [84, 236, 90], osc: [120, 250, 222],
};
// Rheinberg: an annular filter yellow at its sides and red top and bottom, so
// an edge's colour follows the way it faces (q = nx² - ny²), on a blue field.
const RA = [255, 220, 46], RB = [255, 44, 40];
const RM = RA.map((v, i) => (v + RB[i]) / 2), RH = RA.map((v, i) => (v - RB[i]) / 2);
const FIELD = [4, 16, 60], PHASE = [74, 82, 72];

// The algal thread, a Spirogyra filament across the lower third: its centre
// at arc length s and its unit tangent.
const FL = 136;
let fx = 0, fy = 0, ftx = 1, fty = 0;
function fil(s) {
  const dy = -0.2 + 0.225 * cos(s * 0.045 + 0.3), l = sqrt(1 + dy * dy);
  (fx = s - 30), (fy = 109 - 0.2 * s + 5 * sin(s * 0.045 + 0.3)), (ftx = 1 / l), (fty = dy / l);
}

// Light goes into a sharp buffer and, by how far the thing lies from the
// focal plane, into a halo buffer at half resolution that is blurred and
// spread back over the LEDs.
let S, Q, ox = 0, oy = 0, foc = 0, m1 = 0, wS = 1, wQ = 0, lastP = -1;
const K0 = [0, 0, 0], K1 = [0, 0, 0];
function col(c, g = 1) {
  for (let i = 0; i < 3; i++) (K0[i] = (g * (c[i] + m1 * (RM[i] - c[i]))) / 255), (K1[i] = (g * m1 * RH[i]) / 255);
}
function dep(z) {
  const b = max(0, abs(z - foc) - 0.15) * 2.4;
  wS = max(0, 1 - b);
  wQ = min(1, b) / (1 + 0.5 * max(0, b - 1));
}
function put(x, y, s, q = 0) {
  const xi = round(x - ox), yi = round(y - oy), o = (yi * W + xi) * 3;
  if (xi < 0 || yi < 0 || xi >= W || yi >= H || o === lastP) return;
  lastP = o;
  const r = s * (K0[0] + q * K1[0]), g = s * (K0[1] + q * K1[1]), b = s * (K0[2] + q * K1[2]), h = ((yi >> 1) * HW + (xi >> 1)) * 3;
  if (wS) (S[o] += r * wS), (S[o + 1] += g * wS), (S[o + 2] += b * wS);
  if (wQ) (Q[h] += r * wQ), (Q[h + 1] += g * wQ), (Q[h + 2] += b * wQ);
}
// A point: small things lose themselves out of focus, so less goes to the halo.
function dot(x, y, s, q = 0) {
  const k = wQ;
  (lastP = -1), (wQ *= 0.4);
  put(x, y, s, q);
  wQ = k;
}
function line(x0, y0, x1, y1, s) {
  const dx = x1 - x0, dy = y1 - y0, n = max(1, ceil(max(abs(dx), abs(dy)))), q = (dy * dy - dx * dx) / (dx * dx + dy * dy + 1e-6);
  for (let k = 0; k < n; k++) put(x0 + (dx * k) / n, y0 + (dy * k) / n, s, q);
}
function ring(cx, cy, r, s) {
  lastP = -1;
  for (let k = 0, n = max(8, ceil(TAU * r * 1.4)); k < n; k++) {
    const c = cos((k / n) * TAU), sn = sin((k / n) * TAU);
    put(cx + r * c, cy + r * sn, s, c * c - sn * sn);
  }
}
// A body's own frame: at(u, v) is u along its axis and v across it.
let FX = 0, FY = 0, FC = 1, FS = 0;
const frame = (x, y, a) => ((FX = x), (FY = y), (FC = cos(a)), (FS = sin(a)));
const at = (u, v, s, f = put, q = FS * FS - FC * FC) => f(FX + u * FC - v * FS, FY + u * FS + v * FC, s, q);
// A three-wide box blur run twice, on the half-resolution grid.
function blur(A, T) {
  for (let pass = 0; pass < 4; pass++) {
    const [a, b, s, n] = pass & 1 ? [T, A, HW * 3, HH] : [A, T, 3, HW];
    for (let y = 0, o = 0; y < HH; y++)
      for (let x = 0; x < HW; x++)
        for (let c = 0, i = pass & 1 ? y : x; c < 3; c++, o++) b[o] = (a[o - (i > 0 ? s : 0)] + a[o] + a[o + (i < n - 1 ? s : 0)]) / 3;
  }
}
// Light to LED level: black below 0.1, a gain of 3, a soft shoulder above 0.8.
const LUT = Float32Array.from({ length: 1024 }, (_, i) => {
  const v = max(0, i / 256 - 0.1) * 3;
  return 255 * (v < 0.8 ? v : 1 - 0.2 * exp(-(v - 0.8) / 0.2));
});

export function setup(params) {
  const F = (n) => new Float32Array(n), side = () => (rnd() < 0.5 ? -1 : 1), A = (n, f) => Array.from({ length: n }, (_, i) => ({ x: rr(-12, 76), y: rr(-12, 140), h: rnd() * TAU, ...f(i) }));
  const P = (params.s = { t: 0, fr: 0, S: F(N * 3), Q: F(HW * HH * 3), T: F(HW * HH * 3), QS: F(HW * HH), O: F(N * 3), L: F(N), V: F(N), OP: F(140), nx: 0, ny: 0, ex: 0, ey: 0, nt: 3.2, ja: 0, jt: 9, jx: 0, jy: 0, s1: rnd() * 7, s2: rnd() * 7 });
  // The round field stop of the eyepiece clips the panel's two ends.
  for (let p = 0; p < N; p++) P.V[p] = sm(67.5, 62, sqrt(((p & 63) - 31.5) ** 2 + (((p >> 6) - 63.5) * 1.02) ** 2));
  // Volvox: cells on a sphere (a Fibonacci spiral) and daughter colonies inside.
  P.vol = [[0.18, 12, 21], [-0.8, 9, 57], [0.2, 9.5, 112], [0.62, 11, 80]].map(([z, R, y]) => {
    const n = round(0.7 * R * R), pts = F(n * 3), d = [];
    for (let k = 0; k < n; k++) {
      const yv = 1 - (2 * k + 1) / n, q = sqrt(1 - yv * yv);
      pts.set([cos(k * 2.4) * q, yv, sin(k * 2.4) * q], k * 3);
    }
    for (let k = 0, m = 3 + rnd() * 3; k < m; k++) {
      const a = rnd() * TAU, b = rr(-1, 1), r = rr(0.2, 0.52), q = sqrt(1 - b * b) * r;
      d.push([cos(a) * q, b * r, sin(a) * q, rr(0.17, 0.25) * R]);
    }
    return { x: rr(16, 48), y: y + rr(-9, 9), z, vz: rr(-0.025, 0.025), R, h: rnd() * TAU, v: rr(1.6, 2.8), ph: 0, w: rr(0.4, 0.7) * side(), pts, d };
  });
  // Paramecia: slippers with an oral groove that swaps sides as they spin.
  P.par = [[0.05, 42], [0.14, 115], [-0.12, 70], [0.75, 20], [-0.85, 92]].map(([z, y]) => ({
    x: rr(14, 50), y: y + rr(-10, 10), z, vz: rr(-0.05, 0.05), h: rnd() * TAU, v: rr(8, 11), a: rr(11.5, 13.5), B: rr(4.4, 5.2), spin: 0, ws: rr(1.6, 2.4),
    rev: 0, tt: rr(3, 8), cy: 0, cv: [rnd(), rnd()],
  }));
  // Diatoms: two glide along the thread, two on floating debris, the rest on
  // the slide's glass, deeper down.
  P.dia = A(9, (i) => ({ z: i < 2 ? 0 : i < 4 ? rr(-0.05, 0.2) : rr(0.75, 0.92), a: rr(6, 9), B: rr(2.1, 2.6), go: rnd() < 0.6, tt: rr(0.5, 3), dir: side(), v: rr(3.5, 6), f: i < 2 ? 44 + 34 * i + rr(-6, 6) : -1 }));
  // Oscillatoria: blue-green threads that glide along their length and wave both ends.
  P.osc = [[18, 17, -0.04], [46, 40, 0.1], [30, 117, 0.3]].map(([x, y, z], i) => ({ x: x + rr(-9, 9), y: y + rr(-9, 9), z, h: rr(-0.6, 0.6) + (i & 1) * PI, L: 2 * round(rr(17, 24)), k: rr(-0.015, 0.015), ph: rnd() * 7, v: rr(1.2, 2.2) }));
  // Vorticella bells on the thread: anchor, lean, stalk length. Bell 0 snaps first.
  P.vor = [[46, -0.22, 46], [50, 0.16, 36], [41, -0.55, 30], [56, 0.45, 42], [36, -0.05, 52], [62, 0.1, 28], [30, -0.4, 40]].map(([s, a, L], i) => ({ s, a: a - PI / 2, L, ext: 1, st: 0, tt: i ? rr(9, 18) : 4.1, cp: 0 }));
  P.rot = [[84, -2.05], [16, -1.15]].map(([s, a]) => ({ s, a, L: 21, ext: 1, st: 0, tt: rr(7, 12), cp: 0, sw: rnd() * 7 }));
  P.fla = A(44, (i) => ({ z: rr(-0.9, 0.9), v: rr(6, 18), tt: 0, k: i % 3, ph: rnd() * 7 }));
  // Detritus: grains and glittering flakes, amber plant matter or grey grit,
  // a third of it settled on the slide. Bacteria: points crowding near the
  // thread they feed on, most jiggling, some swimming.
  P.det = A(48, (i) => {
    const pts = [], m = 1 + floor(rnd() * rnd() * 9), e = m > 3 ? 2 : 1;
    for (let k = 0; k < m; k++) pts.push([e * round(rr(-1.5, 1.5)), e * round(rr(-1.5, 1.5)), rr(0.35, 0.8)]);
    return { z: i % 3 ? rr(-1, 1) * rnd() : rr(0.8, 1), pts, k: rnd() < 0.55 };
  });
  P.bac = A(580, () => ({ z: rr(-1, 1) * rnd(), s: rr(0.4, 0.8), m: rnd() < 0.3 }));
}

// Knocking the slide.
function knock(P) {
  const a = rnd() * TAU;
  (P.ja = 3.5), (P.jt = 0), (P.jx = cos(a)), (P.jy = sin(a));
  for (const o of [...P.vor, ...P.rot]) if (o.st !== 1) o.st = 1;
  for (const o of P.par) (o.rev = 0.6), (o.tr = rr(-3, 3));
  for (const o of [...P.vol, ...P.fla, ...P.det]) (o.x += P.jx * rr(1, 4)), (o.y += P.jy * rr(1, 4));
}

// A stalk or body that waits, snaps in to lo, holds, and stretches out again.
function cycle(o, d, down, lo, up, hold, wait) {
  if (o.st === 0 && (o.tt -= d) < 0) o.st = 1;
  else if (o.st === 1 && (o.ext -= d * down) <= lo) (o.ext = lo), (o.st = 2), (o.tt = hold * rr(1, 2));
  else if (o.st === 2 && (o.tt -= d) < 0) o.st = 3;
  else if (o.st === 3 && (o.ext += d * up * (1.12 - o.ext)) >= 1) (o.ext = 1), (o.st = 0), (o.tt = wait * rr(1, 2.2));
}

function life(P, d, crowd, first) {
  // Each kind fades its members in and out by the Crowd knob.
  const each = (L, k, f) =>
    L.forEach((o, i) => {
      const tg = i < k ? 1 : 0;
      o.p = first ? tg : o.p + (tg - o.p) * min(1, d * 2.5);
      f(o, i);
    });
  const t = P.t;
  each(P.vol, 3 + round(crowd), (o, i) => {
    o.h += sin(t * 0.21 + i * 2) * 0.15 * d;
    go(o, o.v * d);
    o.ph += o.w * d;
    swim(o, d);
  });
  each(P.par, 3 + round(2 * crowd), (o, i) => {
    o.spin += o.ws * d;
    if (o.rev > 0) (o.rev -= d), (o.h += o.tr * d), go(o, -o.v * 0.5 * d);
    else {
      o.h += sin(t * 0.5 + i * 2.3) * 0.25 * d;
      if ((o.tt -= d) < 0) (o.rev = 0.7), (o.tr = rr(-3, 3)), (o.tt = rr(4, 9));
      go(o, o.v * d);
    }
    o.cy += d * 0.7;
    (o.cv[0] = (o.cv[0] + d * 0.24) % 1), (o.cv[1] = (o.cv[1] + d * 0.21) % 1);
    swim(o, d);
  });
  // Diatoms glide on their raphe, stop, and set off again, often backwards.
  each(P.dia, 5 + round(4 * crowd), (o) => {
    if ((o.tt -= d) < 0) (o.go = !o.go), (o.tt = o.go ? rr(2, 4) : rr(0.8, 2.2)), o.go && rnd() < 0.4 && (o.dir = -o.dir);
    const v = o.go ? o.v * o.dir * d * sm(0, 0.4, o.tt) : 0;
    if (o.f < 0) go(o, v), wrap(o);
    else if ((o.f += v) < 8 || o.f > FL - 8) (o.dir = -o.dir), (o.f = cl(o.f, 8, FL - 8));
  });
  // Oscillatoria reverse when their front end runs out toward an edge.
  each(P.osc, 2 + round(crowd), (o) => {
    o.ph += d * 1.4;
    go(o, o.v * d);
    if ((o.x < 6 || o.x > 58 || o.y < 8 || o.y > 120) && cos(o.h) * (32 - o.x) + sin(o.h) * (64 - o.y) < 0) o.h += PI;
  });
  each(P.vor, 5 + round(2 * crowd), (b) => ((b.cp += d * 7), cycle(b, d, 14, 0.13, 0.38, 0.5, 8)));
  each(P.rot, 1 + round(crowd), (r) => ((r.cp += d * 9), cycle(r, d, 4, 0.5, 1.3, 1, 6)));
  each(P.fla, 20 + round(24 * crowd), (o) => {
    if ((o.tt -= d) < 0) (o.h += rr(-2, 2)), (o.v = rr(5, 20)), (o.tt = rr(0.25, 1.4));
    o.h += sin(o.ph + t * 3) * d * 1.2;
    go(o, o.v * d);
    wrap(o);
  });
  // The slow current carries grit and bacteria up and to the right, fastest
  // midway between the coverslip (z -1) and the slide (z 1).
  const j = sqrt(d * 30);
  for (const [L, k, jj] of [[P.det, 28 + round(20 * crowd), 0.06], [P.bac, 460 + round(120 * crowd), 0.5]])
    each(L, k, (o) => {
      const f = 1 - o.z * o.z;
      o.x += 1.7 * f * d + (rnd() - 0.5) * jj * j;
      o.y -= f * d + (rnd() - 0.5) * jj * j;
      if (o.m) rnd() < d * 0.8 && (o.h += rr(-2.5, 2.5)), go(o, 9 * d);
      wrap(o);
    });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const rd = cl(dt || 0, 0, 0.1), d = (rd * cl(k[1], 0.2, 3)) / 2, l = cl(k[0], 0, 1);
  (P.m1 = cl(l * 2, 0, 1)), (P.m2 = cl(l * 2 - 1, 0, 1)), (P.foc = cl(k[3], -1, 1));
  if (input.btnPressed && input.btnPressed[0]) knock(P);
  const t = (P.t += d);
  // The stage is never quite still: a slow creep, a nudge now and then, and
  // the shake of a knock.
  if ((P.nt -= d) < 0) (P.nt = rr(6, 11)), (P.nx = cl(P.nx + rr(-6, 6), -5, 5)), (P.ny = cl(P.ny + rr(-8, 8), -7, 7));
  const e = min(1, d * 3), sh = P.ja * exp(-(P.jt += rd) * 5) * sin(P.jt * 40);
  (P.ex += (P.nx - P.ex) * e), (P.ey += (P.ny - P.ey) * e);
  P.ox = 2.5 * sin(t * 0.13 + P.s1) + 1.2 * sin(t * 0.31 + 2) + P.ex + sh * P.jx;
  P.oy = 3.5 * sin(t * 0.09 + P.s2) + 1.5 * sin(t * 0.23) + P.ey + sh * P.jy;
  life(P, d, cl(k[2], 0, 1), !P.init);
  P.init = true;
}

function thread() {
  dep(0);
  col(C.wall);
  for (const sd of [-2.6, 2.6]) {
    lastP = -1;
    for (let s = 0; s <= FL; s += 0.7) fil(s), put(fx - fty * sd, fy + ftx * sd, 0.62, fty * fty - ftx * ftx);
  }
  for (let s = 5; s < FL; s += 9) fil(s), line(fx - fty * 1.6, fy + ftx * 1.6, fx + fty * 1.6, fy - ftx * 1.6, 0.3);
  // The chloroplast, a green ribbon winding round inside the cell wall.
  col(C.chl);
  for (let s = 0; s <= FL; s += 1.3) fil(s), dot(fx - fty * 1.7 * sin(s * 0.5), fy + ftx * 1.7 * sin(s * 0.5), 0.5 + 0.25 * cos(s * 0.5));
}

// Frames a thing standing on the thread at arc length s, leaning by a.
function foot(s, a) {
  fil(s);
  frame(fx + fty * 2.6, fy - ftx * 2.6, a);
}

function vorticella(b, i, t) {
  foot(b.s, b.a + 0.07 * sin(t * 0.6 + i * 1.7));
  const L = b.L * b.ext, amp = 2 * (1 - b.ext) ** 0.6, bend = 3 * sin(t * 0.45 + i) * b.ext, m = ceil(L * 1.5) + 4;
  dep(0);
  col(C.par, b.p);
  // The stalk, straight while it feeds and a tight coil when it has snapped.
  let x = FX, y = FY;
  for (let j = 1; j <= m; j++) {
    const u = (j / m) * L, v = bend * sin((PI * j) / m) + amp * sin((j / m) * 6 * TAU), X = FX + u * FC - v * FS, Y = FY + u * FS + v * FC;
    line(x, y, X, Y, 0.5);
    (x = X), (y = Y);
  }
  // The bell, a cup that closes to a ball when the stalk snaps; the cilia
  // whirl round its lip while it feeds.
  frame(x, y, atan2(FS, FC));
  const open = sm(0.55, 0.95, b.ext), lb = 6 + 2 * open;
  const hwOf = (u) => {
    const ball = 3.1 * sqrt(max(0, 1 - ((2 * u) / lb - 1) ** 2));
    return ball + (0.8 + 4 * (u / lb) ** 0.9 - ball) * open;
  };
  col(C.vor, b.p);
  for (const sd of [-1, 1]) {
    lastP = -1;
    for (let u = 0; u <= lb; u += 0.5) at(u, hwOf(u) * sd, 0.75);
  }
  for (let k = -1; k < 2; k++) at(4.1 + k * 1.6, k * 1.2, 0.4, dot);
  const hw = hwOf(lb);
  if (open < 0.1) return;
  lastP = -1;
  for (let k = 0; k < 24; k++) at(lb + 1.3 * sin((k / 24) * TAU), hw * cos((k / 24) * TAU), 0.55 * open);
  for (let k = 0; k < 9; k++) {
    const th = (k / 9) * TAU + b.cp, s = sin(th);
    at(lb + 2.3 + 0.9 * s, (hw + 0.9) * cos(th), (s > 0 ? 0.85 : 0.35) * open, dot);
  }
}

function rotifer(r, i, t) {
  foot(r.s, r.a + 0.22 * sin(t * 0.4 + r.sw));
  const L = r.L * r.ext, g = r.p, cr = sm(0.82, 0.97, r.ext);
  dep(0);
  col(C.rot, g);
  // A foot of three telescoping joints, a swollen trunk, a neck, the head,
  // and inside it the jaws of the mastax, chewing.
  const hwOf = (u) => (u < 0.36 ? 0.9 + 0.4 * floor(u / 0.12) : u < 0.8 ? 2.1 + 2.5 * sin((PI * (u - 0.36)) / 0.44) : u < 0.88 ? 2 : 2.9);
  for (const sd of [-1, 1]) {
    lastP = -1;
    for (let u = 0; u <= L; u += 0.5) at(u, hwOf(u / L) * sd, 0.75);
    at(-1.2, sd * 1.3, 0.7, dot);
    at(0.72 * L, sd * (0.6 + 0.5 * sin(r.cp * 0.45)), 0.85, dot);
  }
  for (let k = 0; k < 7; k++) at(L * (0.42 + 0.05 * k), 1.8 * sin(k * 2.4 + t * 0.6), 0.38 + 0.2 * sin(k * 1.7 + t * 2), dot);
  // The crown: two discs of cilia whirling the opposite way to each other.
  lastP = -1;
  if (cr < 0.02) for (let v = -2.8; v <= 2.8; v += 0.7) at(L, v, 0.6);
  else
    for (const sd of [-1, 1]) {
      const cx = FX + FC * (L + 1.8) - FS * sd * 2.9, cy = FY + FS * (L + 1.8) + FC * sd * 2.9;
      ring(cx, cy, 2.4 * cr, 0.3 * cr);
      for (let k = 0; k < 10; k++) {
        const th = (k / 10) * TAU + sd * r.cp;
        dot(cx + cos(th) * 3.2 * cr, cy + sin(th) * 3.2 * cr, (0.55 + 0.45 * sin(th * 3 + t * 5)) * cr * g);
      }
    }
}

function volvox(o) {
  const { x, y, R, pts } = o, g = o.p, ax = cos(o.h), ay = sin(o.h), c = cos(o.ph), s = sin(o.ph), c1 = 1 - c;
  // Rolling about its swimming axis, which lies in the view plane (Rodrigues).
  const rot = (px, py, pz, k) => {
    const kd = (ax * px + ay * py) * c1, u = px * c + ay * pz * s + ax * kd, v = py * c - ax * pz * s + ay * kd;
    return k ? dot(x + R * u, y + R * v, pz * c + (ax * py - ay * px) * s > 0 ? 0.85 : 0.5, u * u - v * v) : frame(x + R * u, y + R * v, 0);
  };
  dep(o.z);
  col(C.cell, g);
  for (let k = 0; k < pts.length; k += 3) rot(pts[k], pts[k + 1], pts[k + 2], 1);
  col(C.vrim, g);
  ring(x, y, R + 0.4, 0.55);
  // The faint diffraction fringe outside the rim.
  ring(x, y, R + 2.6, 0.3);
  col(C.dau, g);
  for (const [px, py, pz, r] of o.d) rot(px, py, pz, 0), ring(FX, FY, r, 0.95), dot(FX, FY, 0.7);
}

function paramecium(o, i, t) {
  const { a, B } = o, gs = cos(o.spin), n = ceil(TAU * sqrt((a * a + B * B) / 2) * 1.3);
  frame(o.x, o.y, o.h);
  dep(o.z);
  col(C.par, o.p);
  // Outline and cilia: a metachronal wave runs back along the body.
  for (let pass = 0; pass < 2; pass++) {
    lastP = -1;
    for (let k = 0; k < n; k++) {
      const th = (k / n) * TAU, ct = cos(th), st = sin(th), bw = B * (1 + 0.16 * ct - 0.08 * ct * ct), wv = sin(th * 9 - t * 10);
      let nu = ct / a, nv = st / bw, nl = sqrt(nu * nu + nv * nv);
      const nx = nu * FC - nv * FS, ny = nu * FS + nv * FC, q = (nx * nx - ny * ny) / (nl * nl);
      (nu = (1.5 * nu) / nl), (nv = (1.5 * nv) / nl);
      if (!pass) at(a * ct, bw * st, 0.62 + 0.25 * wv, put, q);
      else if (wv > 0.2) at(a * ct + nu, bw * st + nv, 0.6 * wv, dot, q);
    }
  }
  // The oral groove, a bright furrow from the front to the middle that swaps
  // sides as the cell spins on its long axis.
  lastP = -1;
  for (let u = 0.05; u < 0.62; u += 0.06) at(u * a, gs * B * (0.3 + 0.75 * u) * (u < 0.5 ? 1 : 1 - (u - 0.5) * 6), 0.5 * abs(gs) + 0.12, put, 0);
  // Granules and food vacuoles carried round by cyclosis, and the two
  // contractile vacuoles filling and emptying.
  col(C.gran, o.p);
  for (let k = 0; k < 23; k++) {
    const th = k * 2.4 + o.cy * (k % 3 ? 0.6 : 1), r = 0.25 + 0.6 * ((k * 0.618) % 1);
    at(0.8 * a * r * cos(th), 0.62 * B * r * sin(th), k % 3 ? 0.36 + 0.16 * sin(t * 3 + k) : 0.6, dot, 0);
  }
  col(C.par, o.p);
  o.cv.forEach((c, j) => c > 0.31 && c < 0.85 && ring(FX + (j ? -0.55 : 0.55) * a * FC, FY + (j ? -0.55 : 0.55) * a * FS, 1.6 * c, 0.55));
}

function diatom(o) {
  const { a, B } = o;
  if (o.f < 0) frame(o.x, o.y, o.h);
  else fil(o.f), frame(fx + fty * (3.4 + B), fy - ftx * (3.4 + B), atan2(fty, ftx));
  dep(o.z);
  col(C.dia, o.p);
  // The rim glints at each stria; the raphe runs down the middle, broken at
  // the central nodule.
  for (const sd of [-1, 1]) {
    lastP = -1;
    for (let u = -a; u <= a; u += 0.6) at(u, sd * B * (1 - (u / a) ** 2) ** 0.75, 0.62 + 0.3 * cos(u * PI));
  }
  for (let u = -0.8 * a; u <= 0.8 * a; u += 1.6) if (abs(u) > 1) at(u, 0, 0.6, dot);
  at(0, 0, 0.8, dot);
}

function oscillatoria(o, i, t, OP) {
  const n = o.L, hl = n / 2;
  // The centre line, from the middle out to each end, bending as the ends wave.
  for (const sd of [-1, 1]) {
    let x = o.x, y = o.y;
    for (let s = 1; s <= hl; s++) {
      const a = o.h + o.k * s * sd + 0.6 * sin(o.ph + sd) * (s / hl) ** 3;
      (x += cos(a) * sd), (y += sin(a) * sd), (OP[(hl + s * sd) * 2] = x), (OP[(hl + s * sd) * 2 + 1] = y);
    }
  }
  (OP[n] = o.x), (OP[n + 1] = o.y);
  dep(o.z);
  col(C.osc, o.p);
  for (const e of [-1.2, 1.2]) {
    lastP = -1;
    for (let k = 0; k < n; k++) {
      const x = OP[k * 2], y = OP[k * 2 + 1], dx = OP[k * 2 + 2] - x, dy = OP[k * 2 + 3] - y;
      put(x - dy * e, y + dx * e, 0.6, dy * dy - dx * dx);
    }
  }
  // Cross walls between the cells.
  for (let k = 1; k < n; k += 2) dot(OP[k * 2], OP[k * 2 + 1], 0.4);
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.init) return;
  (S = P.S), (Q = P.Q), (ox = P.ox), (oy = P.oy), (foc = P.foc), (m1 = P.m1);
  S.fill(0);
  Q.fill(0);
  const t = P.t, show = (L, f) => L.forEach((o, i) => o.p > 0.02 && f(o, i, t, P.OP));
  thread();
  show(P.vor, vorticella);
  show(P.rot, rotifer);
  show(P.dia, diatom);
  show(P.osc, oscillatoria);
  show(P.vol, volvox);
  show(P.par, paramecium);
  show(P.fla, (o) => {
    const c = cos(o.h), s = sin(o.h);
    dep(o.z);
    col(o.k ? C.par : C.eug, o.p);
    dot(o.x, o.y, 0.9);
    dot(o.x - c * 1.2, o.y - s * 1.2, 0.55);
    for (let k = 1; k <= 3; k++) dot(o.x + c * (1 + k) - s * sin(t * 20 + k * 1.3) * 0.7, o.y + s * (1 + k) + c * sin(t * 20 + k * 1.3) * 0.7, 0.3);
  });
  show(P.det, (o) => {
    dep(o.z);
    col(o.k ? C.amb : C.gry, o.p);
    for (const [dx, dy, s] of o.pts) dot(o.x + dx, o.y + dy, s);
  });
  col(C.par);
  show(P.bac, (o) => (dep(o.z), dot(o.x, o.y, o.s * o.p)));
  blur(Q, P.T);
  // Light into LEDs, toned by the brightest channel so a green stays green,
  // each lit LED scintillating a little, and under it all the shimmer of
  // particles too small to resolve, below 24/255.
  const fr = (P.fr = (P.fr + 1) | 0), m2 = P.m2, { V, L, O, QS } = P, c3 = K0;
  for (let i = 0; i < HW * HH; i++) QS[i] = Q[i * 3] + Q[i * 3 + 1] + Q[i * 3 + 2];
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      // The halo cell under the LED and its neighbours toward it, bilinear.
      const o = p * 3, i = x >> 1, j = (y >> 1) * HW, i2 = cl(i + (x & 1) * 2 - 1, 0, HW - 1), j2 = cl((y >> 1) + (y & 1) * 2 - 1, 0, HH - 1) * HW;
      const A = j + i, B = j + i2, c = j2 + i, e = j2 + i2, hl = QS[A] + QS[B] + QS[c] + QS[e] > 0, hh = h32(p, fr), sh = hh >>> 24;
      for (let n = 0; n < 3; n++) c3[n] = S[o + n] + (hl ? 0.17 * Q[A * 3 + n] + 0.056 * (Q[B * 3 + n] + Q[c * 3 + n]) + 0.019 * Q[e * 3 + n] : 0);
      const mx = max(c3[0], c3[1], c3[2]), k = mx > 0.001 ? (LUT[min(1023, (mx * 256) | 0)] / mx) * (0.8 + sh / 640) : 0;
      for (let n = 0, hb; n < 3; n++) (hb = (hh >>> (n * 8)) & 255), (c3[n] = V[p] * (c3[n] * k * (1 + hb / 2200) + sh * (0.062 + (hb & 15) / 500) + m1 * FIELD[n]));
      if (!m2) display.setPixel(x, y, min(255, c3[0]) | 0, min(255, c3[1]) | 0, min(255, c3[2]) | 0);
      else O.set(c3, o), (L[p] = (mx * k) / 255);
    }
  if (!m2) return;
  // Phase contrast: the field grey, each body darker than it, and a bright
  // halo on the LEDs beside it.
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const l = L[p], o = p * 3, dk = 1 - 0.8 * cl(l * 1.6, 0, 1), hl = max(0, max(L[p - (x > 0)], L[p + (x < 63)], L[p - (y > 0) * W], L[p + (y < 127) * W]) - l) * 160;
      const v = (i) => min(255, O[o + i] + m2 * (V[p] * (PHASE[i] * dk + hl + (h32(p, fr + i) & 15)) - O[o + i])) | 0;
      display.setPixel(x, y, v(0), v(1), v(2));
    }
}
