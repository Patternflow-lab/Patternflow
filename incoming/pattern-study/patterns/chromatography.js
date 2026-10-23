// ===== Patternflow pattern =====
// Title:   Chromatography
// Family:  chemistry
// Idea:    Strips of filter paper hang from a glass rod in a tall glass tank on a lab bench, the solvent climbs them from a shallow pool, and the ink spot on each pencil start line splits into coloured bands that rise at their own speeds until the strips are lifted out and fresh ones go in.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 20, after the paper chromatography of the school chemistry lab
// Round:   20
// ===============================
// @matrix 64x128
// @knobs Inks=0..3, Speed=0.2..3, Strips=3..6, Solvent=-1..1
//
// Knob 1: Inks. What is spotted on the strips: felt-tip pens at 0 (black splits into yellow, magenta, cyan and violet, green into yellow and blue, brown into orange and blue-grey), the food dyes of sugar-coated sweets at 1, a leaf extract at 2 (orange carotene running near the front, yellow xanthophyll, blue-green and olive chlorophylls), fountain-pen inks at 3.
// Knob 2: Speed. How fast the solvent climbs: at 2 the front takes about 15 s from the pool to the top, slowing as it goes as a wick does, and fresh strips go in every 19 s; at 0.2 it creeps.
// Knob 3: Strips. How many strips hang from the rod, three wide ones at 3 up to six narrow ones at 6.
// Knob 4: Solvent. How polar the solvent is: near 0 the bands spread out over the whole run; towards -1 most of the dyes stay down by the start line, towards 1 they all crowd up behind the front, and the wetter paper of a watery solvent reads darker.
// Buttons: K1 tap lifts the strips out of the tank now and hangs fresh ones.

const W = 64;
const H = 128;
const N = W * H;
// Inside the glass, and the rows things sit on. Strips are drawn in their own
// rows, so lifting them is one offset.
const XL = 3;
const XR = 60;
const TOP = 2;
const ROD = 3;
const RIM = 7;
const LABEL = 13;
const Y0 = 99;
const YS = 106;
const FOOT = 110;
const YB = 113;
const BENCH = 117;
// The front climbs from the solvent surface; it stops HMAX rows above it.
const HO = YS - Y0;
const HMAX = 84;
const T = 15;
const EXP = 0.7;
const [RUN, LIFT, EMPTY, LOWER] = [0, 1, 2, 3];
const DUR = [0, 1.8, 0.9, 1.7];
const LIFT_H = 126;
const DRY = [238, 236, 226];
const WET = [100, 114, 130];
// Pencil digits, 3x5, one hex digit a row.
const DIG = ["26227", "71747", "71717", "55711", "74717", "74757"];

const { min, max, round, floor, exp, sin, abs, sqrt } = Math;
const rnd = () => Math.random();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Each ink: the colour of the spot as it goes on, how much of it stays behind
// at the start line, and its dyes as [r, g, b, affinity, strength]. Affinity
// is the dye's Rf in a balanced solvent: how far up the wet paper it gets as
// a share of the solvent front.
const SETS = [
  // Felt-tip pens, run in water.
  [
    [[34, 30, 40], 0.28, [[255, 212, 0, 0.88, 1], [255, 40, 160, 0.64, 1], [0, 190, 255, 0.44, 1], [130, 56, 255, 0.22, 1]]],
    [[24, 120, 52], 0.15, [[220, 240, 0, 0.8, 1], [20, 90, 255, 0.38, 1]]],
    [[100, 56, 24], 0.32, [[255, 128, 0, 0.74, 1], [104, 134, 196, 0.3, 1]]],
    [[30, 60, 200], 0.15, [[0, 204, 255, 0.68, 1], [126, 64, 255, 0.3, 1]]],
    [[100, 30, 130], 0.2, [[255, 40, 176, 0.7, 1], [40, 84, 255, 0.36, 1]]],
    [[240, 110, 20], 0.12, [[255, 222, 0, 0.82, 1], [255, 64, 112, 0.52, 1]]],
  ],
  // The sugar shells of sweets, run in salt water.
  [
    [[40, 170, 60], 0.1, [[240, 232, 0, 0.82, 1], [0, 112, 255, 0.62, 1]]],
    [[220, 30, 50], 0.12, [[255, 30, 72, 0.5, 1], [255, 172, 0, 0.78, 0.9]]],
    [[130, 40, 140], 0.12, [[255, 40, 92, 0.48, 1], [30, 92, 255, 0.66, 1]]],
    [[255, 120, 20], 0.1, [[255, 216, 0, 0.84, 1], [255, 52, 60, 0.52, 0.9]]],
    [[110, 60, 30], 0.18, [[255, 40, 72, 0.46, 0.9], [255, 210, 0, 0.8, 1], [20, 100, 255, 0.64, 0.9]]],
    [[20, 90, 230], 0.1, [[0, 120, 255, 0.66, 1], [0, 224, 200, 0.9, 0.55]]],
  ],
  // Leaves ground in acetone and run in petroleum ether.
  [
    [[30, 90, 30], 0.22, [[255, 150, 0, 0.95, 0.8], [240, 222, 30, 0.62, 0.9], [0, 190, 130, 0.42, 1], [130, 200, 20, 0.28, 0.9]]],
    [[110, 20, 60], 0.3, [[230, 0, 120, 0.06, 1], [240, 222, 30, 0.62, 0.7], [0, 190, 130, 0.42, 0.8]]],
    [[170, 80, 20], 0.26, [[255, 140, 0, 0.95, 1], [250, 224, 20, 0.62, 1], [160, 84, 30, 0.1, 0.8]]],
    [[40, 120, 30], 0.18, [[0, 196, 120, 0.42, 1], [140, 210, 20, 0.28, 1], [255, 160, 0, 0.95, 0.6]]],
    [[90, 30, 50], 0.28, [[200, 0, 140, 0.08, 0.9], [0, 180, 130, 0.42, 0.9], [255, 150, 0, 0.95, 0.6]]],
    [[36, 100, 36], 0.2, [[255, 150, 0, 0.95, 0.7], [240, 222, 30, 0.62, 0.8], [0, 190, 130, 0.42, 0.9], [130, 200, 20, 0.28, 0.8]]],
  ],
  // Fountain-pen inks, run in water.
  [
    [[30, 50, 200], 0.15, [[40, 90, 255, 0.55, 1], [150, 60, 255, 0.3, 0.9], [255, 90, 200, 0.82, 0.5]]],
    [[30, 30, 36], 0.25, [[255, 200, 0, 0.78, 0.9], [0, 180, 255, 0.56, 1], [230, 30, 150, 0.38, 1]]],
    [[0, 150, 190], 0.1, [[0, 220, 255, 0.62, 1], [180, 255, 40, 0.86, 0.5]]],
    [[200, 20, 40], 0.12, [[255, 30, 120, 0.72, 1], [255, 120, 0, 0.48, 1]]],
    [[20, 140, 90], 0.12, [[0, 200, 230, 0.68, 1], [230, 230, 0, 0.44, 1]]],
    [[110, 30, 200], 0.15, [[255, 40, 200, 0.66, 1], [60, 60, 255, 0.4, 1]]],
  ],
];

// How far each kind of ink streaks back to the start line: leaf extracts
// smear the most.
const TAIL = [0.4, 0.32, 0.6, 0.45];

function layout(P, n) {
  P.n = n;
  P.sw = [12, 10, 8, 7][n - 3];
  const gap = (XR - XL + 1 - n * P.sw) / (n + 1);
  for (let j = 0; j < n; j++) P.sx[j] = XL + round(gap * (j + 1) + P.sw * j);
}

// Fresh strips: each wicks at its own rate, with its own ragged front and
// spot, and after the first set the inks go on in a new order.
function fresh(P, shuffle) {
  P.t = 0;
  P.maxf = 0;
  for (const S of P.st) {
    S.f = 0.93 + rnd() * 0.13;
    P.maxf = max(P.maxf, S.f);
    S.spot = rnd();
    S.ph = rnd() * 6.28;
    let a = 0;
    for (let i = 0; i < 14; i++) S.rag[i] = a = a * 0.55 + (rnd() - 0.5) * 1.8;
    for (let i = 0; i < 5; i++) S.jit[i] = (rnd() - 0.5) * 0.05;
  }
  if (shuffle)
    for (let j = 5; j > 0; j--) {
      const i = floor(rnd() * (j + 1));
      [P.perm[i], P.perm[j]] = [P.perm[j], P.perm[i]];
    }
}

// The room behind, the tank and the bench, painted once. Glass in front of
// the strips goes in an overlay added last.
function paint(P) {
  const B = (P.bg = new Float32Array(N * 3));
  const O = (P.ov = new Float32Array(N * 3));
  const put = (A, x, y, c) => A.set(c, (y * W + x) * 3);
  for (let y = 0; y < BENCH; y++)
    for (let x = 0; x < W; x++) {
      // White wall tiles of the lab, dim, and dimmer still through two panes.
      const grout = x % 9 === 4 || y % 9 === 2;
      const inTank = x >= 1 && x <= 62 && y >= RIM;
      let c = grout ? [12, 12, 14] : [27, 27, 30];
      if (inTank) c = grout ? [8, 12, 13] : [15, 21, 23];
      put(B, x, y, c);
    }
  // The pool: shallow solvent over the glass floor.
  for (let y = YS; y < YB; y++)
    for (let x = XL; x <= XR; x++) {
      const d = (y - YS) / (YB - YS);
      put(B, x, y, [24 + 6 * d, 42 + 8 * d, 54 + 6 * d]);
    }
  for (let x = 1; x <= 62; x++) {
    put(B, x, YB, [92, 132, 122]);
    put(B, x, YB + 1, [40, 70, 62]);
    put(B, x, YB + 2, [34, 60, 53]);
    put(B, x, YB + 3, [74, 104, 96]);
  }
  for (let y = YS; y < YB; y++) for (const x of [1, 2, 61, 62]) put(B, x, y, x === 1 || x === 62 ? [44, 70, 64] : [30, 50, 56]);
  // The bench: a varnished hardwood top and its front edge.
  for (let y = BENCH; y < H; y++)
    for (let x = 0; x < W; x++) {
      const g = 0.86 + 0.14 * sin(x * 0.23 + y * 2.9 + 2.2 * sin(x * 0.07 + y)) + ((x * 7 + y * 13) % 5) * 0.012;
      let c;
      if (y === 122) c = [178, 114, 62];
      else if (y < 122) c = [132 * g, 80 * g, 40 * g];
      else c = [88 * g, 50 * g, 24 * g];
      if (y === BENCH && x >= 1 && x <= 62) c = [60, 34, 17];
      if (y === BENCH + 1 && x >= 2 && x <= 61) c = c.map((v) => v * 0.8);
      put(B, x, y, c);
    }
  // Glass: the front rim, the side walls catching the lab light from the left,
  // and two faint streaks of reflection on the front pane.
  for (let x = 1; x <= 62; x++) {
    put(O, x, RIM, [46, 66, 62]);
    put(O, x, RIM + 1, [12, 18, 17]);
  }
  for (let y = RIM; y < YB; y++) {
    const fall = 1 - y / 200;
    const streak = y > 14 && y < 52 ? 1 : 0;
    put(O, 1, y, [(40 + 44 * streak) * fall, (62 + 60 * streak) * fall, (58 + 56 * streak) * fall]);
    put(O, 2, y, [12, 18, 17]);
    put(O, 61, y, [8, 12, 12]);
    put(O, 62, y, [28, 42, 40]);
  }
  for (let y = 16; y < 84; y++) {
    const x = round(56 - (y - 16) * 0.32);
    for (let i = 0; i < 3; i++) {
      O[(y * W + x) * 3 + i] += 9;
      O[(y * W + x - 3) * 3 + i] += 5;
    }
  }
}

export function setup(params) {
  const P = params;
  P.buf = new Float32Array(N * 3);
  P.st = Array.from({ length: 6 }, () => ({ rag: new Float32Array(14), jit: new Float32Array(5) }));
  P.perm = [0, 1, 2, 3, 4, 5];
  P.sx = [0, 0, 0, 0, 0, 0];
  P.h = new Float32Array(6);
  P.fa = new Float32Array(14);
  P.dye = new Float32Array(5 * 6);
  P.mask = new Uint8Array(N);
  P.drops = [];
  P.rip = [];
  paint(P);
  fresh(P, false);
  // Open with the front 32 rows up the strips, so the bands have begun to part.
  P.t = 0.25 * T;
  Object.assign(P, { n: 0, sw: 12, phase: RUN, pt: 0, dy: 0, clock: 0, set: 0, rate: 1, sol: 0 });
}

// Fresh strips are dry until their feet are in the pool.
function fronts(P) {
  for (let j = 0; j < 6; j++) P.h[j] = P.phase === LOWER ? -9 : HMAX * min(1, (P.t * P.st[j].f) / T) ** EXP;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 3, 0.06];
  dt = clamp(dt, 0, 0.1);
  P.set = clamp(round(k[0]), 0, 3);
  P.rate = clamp(k[1], 0.2, 3) / 2;
  const n = clamp(round(k[2]), 3, 6);
  if (n !== P.n) layout(P, n);
  P.sol = clamp(k[3], -1, 1);
  P.clock += dt;
  if (input.btnPressed && input.btnPressed[0] && P.phase === RUN) [P.phase, P.pt] = [LIFT, 0];
  const r = P.rate;
  if (P.phase === RUN) {
    P.t += dt * r;
    if (P.t * P.maxf >= T) [P.phase, P.pt] = [LIFT, 0];
  } else {
    P.pt += dt * max(r, 0.7);
    const q = min(1, P.pt / DUR[P.phase]);
    if (P.phase === LIFT) {
      P.dy = LIFT_H * q * q;
      // The feet drip as they come out of the pool.
      const foot = FOOT - P.dy;
      if (foot < YS && foot > YS - 30)
        for (let j = 0; j < P.n; j++)
          if (rnd() < dt * 7) P.drops.push([P.sx[j] + 1 + rnd() * (P.sw - 2), foot, 0]);
    } else if (P.phase === LOWER) P.dy = LIFT_H * (1 - q) * (1 - q);
    if (q >= 1) {
      if (P.phase === EMPTY) fresh(P, true);
      if (P.phase === LOWER) for (let j = 0; j < P.n; j++) P.rip.push([P.sx[j] + P.sw / 2, 0]);
      P.phase = (P.phase + 1) % 4;
      P.pt = 0;
      if (P.phase === RUN) P.dy = 0;
    }
  }
  fronts(P);
  for (const d of P.drops) {
    d[2] += 160 * dt;
    d[1] += d[2] * dt;
    if (d[1] >= YS) P.rip.push([d[0], 0]);
  }
  P.drops = P.drops.filter((d) => d[1] < YS);
  for (const p of P.rip) p[1] += dt;
  P.rip = P.rip.filter((p) => p[1] < 0.9);
}

// One strip, in its own rows v (screen row y = v - dy).
function strip(P, j, ink, ex) {
  const B = P.buf;
  const S = P.st[j];
  const x0 = P.sx[j];
  const w = P.sw;
  const hw = w / 2;
  const h = P.h[j];
  const D = max(0, h - HO);
  const dy = round(P.dy);
  const wet = WET.map((c) => c * (1 - 0.2 * P.sol));
  for (let i = 0; i < w; i++) {
    const e = (i + 0.5 - hw) / hw;
    // Faster in the middle, and more ragged the further it has come.
    P.fa[i] = h + (0.5 + 0.04 * h) * (1 - e * e) + S.rag[i] * (0.25 + h / HMAX) + 0.3 * sin(i * 1.3 + P.clock * 0.8 + S.ph);
  }
  const dyes = ink[2];
  const nd = dyes.length;
  const dv = P.dye;
  for (let q = 0; q < nd; q++) {
    const rf = clamp(dyes[q][3] + S.jit[q], 0.02, 0.97) ** ex;
    const c = rf * D;
    const sig = 1.2 + 0.065 * c + 0.6 * S.spot;
    dv.set([rf, 1 / (0.6 * sig), dyes[q][4] * min(1, 2.4 / (1.4 + 0.35 * sig)), min(hw - 0.6, 2.6 + 0.12 * c + S.spot), 1 / (1.7 * sig), sig], q * 6);
  }
  const spotC = ink[0];
  const fade = D <= 0 ? 1 : max(ink[1], exp(-D / 4));
  const rs = 1.2 + 0.9 * S.spot;
  const dig = DIG[j];
  const tail = TAIL[P.set];
  for (let v = TOP; v <= FOOT; v++) {
    const y = v - dy;
    if (y < 0 || y >= YB) continue;
    const ly = 1 - (0.1 * v) / 110;
    for (let i = 0; i < w; i++) {
      const x = x0 + i;
      const p = y * W + x;
      const o = p * 3;
      P.mask[p] = 1;
      const e = (i + 0.5 - hw) / hw;
      let L = (1.03 - 0.07 * e - (i === w - 1 ? 0.12 : 0)) * ly;
      // The fold over the rod and the shade the clip throws.
      if (v === TOP) L *= 1.06;
      else if (v <= RIM + 1) L *= 0.9;
      else if (v === RIM + 2) L *= 0.78;
      const fa = P.fa[i];
      const dist = v - (YS - fa);
      const wt = clamp((dist + 0.5) / 2.5, 0, 1);
      let r = (DRY[0] + (wet[0] - DRY[0]) * wt) * L;
      let g = (DRY[1] + (wet[1] - DRY[1]) * wt) * L;
      let b = (DRY[2] + (wet[2] - DRY[2]) * wt) * L;
      // The front itself: a thin darker line where the dirt in the solvent
      // collects.
      if (dist > -2 && dist < 3.2) {
        const fl = exp(-(((dist - 0.6) / 0.8) ** 2));
        r *= 1 - 0.22 * fl;
        g *= 1 - 0.24 * fl;
        b *= 1 - 0.34 * fl;
      }
      // Wet paper lets the grout of the wall behind show through.
      if (wt > 0 && (x % 9 === 4 || y % 9 === 2)) {
        r *= 1 - 0.1 * wt;
        g *= 1 - 0.1 * wt;
        b *= 1 - 0.08 * wt;
      }
      if (v > Y0) {
        r *= 1 - 0.08 * wt;
        g *= 1 - 0.08 * wt;
        b *= 1 - 0.06 * wt;
      }
      // Pencil: the start line and the strip's number.
      if (v === Y0 && (i + j) % 7 !== 3) [r, g, b] = [r * 0.6 + 24, g * 0.6 + 24, b * 0.6 + 28];
      const di = i - floor(hw) + 1;
      if (v >= LABEL && v < LABEL + 5 && di >= 0 && di < 3 && (parseInt(dig[v - LABEL], 16) >> (2 - di)) & 1) [r, g, b] = [r * 0.5 + 20, g * 0.5 + 20, b * 0.5 + 24];
      // The spot as it went on, dissolving once the solvent reaches it.
      const ds = abs(v - Y0) < 3 ? clamp(rs + 0.5 - sqrt((i + 0.5 - hw) ** 2 + ((v - Y0) * 1.15) ** 2), 0, 1) * fade * 0.9 : 0;
      if (ds > 0) {
        r += (spotC[0] * L - r) * ds;
        g += (spotC[1] * L - g) * ds;
        b += (spotC[2] * L - b) * ds;
      }
      // The bands: a sharp, bright leading edge and a long soft tail back to
      // the start line.
      if (D > 0 && wt > 0) {
        const u = Y0 - v;
        const Dx = max(0, fa - HO);
        const ax = abs(i + 0.5 - hw);
        for (let q = 0, k = 0; q < nd; q++, k += 6) {
          const hx = clamp((dv[k + 3] + 0.6 - ax) / 1.2, 0, 1);
          if (hx <= 0) continue;
          const c = dv[k] * Dx;
          const du = u - c;
          let pr = 0;
          if (du >= 0) {
            const z = du * dv[k + 1];
            if (z < 3) pr = exp(-z * z);
          } else {
            const z = du * dv[k + 4];
            pr = (z > -3 ? exp(-z * z) : 0) + (u > 0 ? tail * sqrt(u / c) : 0);
          }
          const A = dv[k + 2] * hx;
          const d = A * pr * wt;
          if (d < 0.01) continue;
          const m = min(0.95, d);
          const V = dyes[q];
          const sig = dv[k + 5];
          const zg = (du - 0.35 * sig) / (0.45 * sig);
          const gl = zg > -3 && zg < 3 ? 0.3 * A * exp(-zg * zg) : 0;
          r += (V[0] * 0.92 * L - r) * m + V[0] * gl;
          g += (V[1] * 0.92 * L - g) * m + V[1] * gl;
          b += (V[2] * 0.92 * L - b) * m + V[2] * gl;
        }
      }
      // Under the solvent the paper takes the pool's colour.
      if (y >= YS) [r, g, b] = [r * 0.6, g * 0.76, b * 0.9];
      B[o] = r;
      B[o + 1] = g;
      B[o + 2] = b;
    }
  }
  // A bulldog clip holds the fold to the rod.
  const cw = min(6, w - 2);
  const c0 = x0 + round((w - cw) / 2);
  for (let v = ROD - 1; v <= RIM + 1; v++) {
    const y = v - dy;
    if (y < 0 || y >= H) continue;
    for (let x = c0; x < c0 + cw; x++) {
      let c;
      if (v < ROD + 1) c = x === c0 + 1 || x === c0 + cw - 2 ? [176, 180, 190] : null;
      else if (v === ROD + 1) c = [150, 154, 166];
      else c = [64 - (v - ROD) * 4, 66 - (v - ROD) * 4, 76 - (v - ROD) * 4];
      if (c) B.set(c, (y * W + x) * 3);
    }
  }
}

export function draw(display, params) {
  const P = params;
  const B = P.buf;
  B.set(P.bg);
  P.mask.fill(0);
  const dy = round(P.dy);
  const set = SETS[P.set];
  const ex = 2 ** (-1.6 * P.sol);
  // The glass rod across the rim, lifted with the strips.
  const ROW = [[150, 180, 175], [70, 96, 92], [34, 48, 46]];
  for (let r = 0; r < 3; r++) {
    const y = ROD + r - dy;
    if (y < 0) continue;
    for (let x = 0; x < W; x++) B.set(r === 0 && x > 6 && x < 20 ? [226, 244, 238] : ROW[r], (y * W + x) * 3);
  }
  if (P.phase !== EMPTY) for (let j = 0; j < P.n; j++) strip(P, j, set[P.perm[j]], ex);
  // The solvent surface glints, and rings run out where drops land and feet
  // go in.
  const t = P.clock;
  for (let x = XL; x <= XR; x++) {
    let s = 0.55 + 0.45 * sin(x * 0.8 + t * 2.1) * sin(x * 0.31 - t * 1.3 + 1);
    for (const [rx, age] of P.rip) s += 1.4 * (1 - age / 0.9) * exp(-((abs(x - rx) - 4 - 16 * age) ** 2) / 3);
    const o = (YS * W + x) * 3;
    const k = P.mask[YS * W + x] ? 0.4 : 1;
    B[o] += 54 * s * k;
    B[o + 1] += 80 * s * k;
    B[o + 2] += 92 * s * k;
    for (let y = YS + 1; y < YB; y++) {
      const c = 6 * sin(x * 0.6 + y * 1.7 - t * 1.6) * sin(x * 0.23 + t * 0.9);
      const q = (y * W + x) * 3;
      B[q] += c;
      B[q + 1] += c * 1.4;
      B[q + 2] += c * 1.6;
    }
  }
  for (const [x, y] of P.drops) {
    const o = (round(y) * W + round(x)) * 3;
    if (y >= 0) B.set([170, 200, 220], o);
  }
  const O = P.ov;
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    display.setPixel(p % W, (p / W) | 0, min(255, B[o] + O[o]), min(255, B[o + 1] + O[o + 1]), min(255, B[o + 2] + O[o + 2]));
  }
}
