// ===== Patternflow pattern =====
// Title:   Slinky
// Family:  toy
// Idea:    A Slinky walks end over end down a zigzag stairwell the height of the panel, its coils pouring through a bow from step to step, springing off the wall at each landing and waking each step light it lands by, until a hand carries it dangling back up to the top.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 21, after the Slinky, Richard James's steel spring toy of 1945
// Round:   21
// ===============================
// @matrix 64x128
// @knobs Spring=0..1, Speed=0.2..3, Rise=6..12, Lamp=-1..1
//
// Knob 1: Spring. Which Slinky comes out of the box: polished steel at 0, then gold plate, the rainbow plastic one that walks lazier, a neon one under a blacklight, and at 1 a glow-in-the-dark one with the lights out.
// Knob 2: Speed. How fast the film runs: at 2 a step takes under half a second and the walk from top to bottom about seven; at 0.2 it is ten times slower.
// Knob 3: Rise. How tall each step is, from 6 rows to 12: low steps make three flights and small quick bows, tall ones two flights and long reaches down.
// Knob 4: Lamp. The daylight in the stairwell: morning at -1, dusk at 0, night at 1, when only the step lights the spring has woken light the stairs and it glints as it passes them.

const [W, H] = [64, 128];
const N = W * H;
const { min, max, abs, floor, round, sin, cos, sqrt, exp, hypot, tan, PI, sign } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (x) => ((x = cl(x, 0, 1)), x * x * (3 - 2 * x));
const mix = (a, b, t) => a + (b - a) * t;
const quad = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

// The stairwell: side walls on columns 0..1 and 62..63, landings 12 wide against
// them, flights of three 12-wide treads between, the hall floor on row 120.
const [T, FLOOR, TH] = [12, 120, 3];
// The spring: 36 coils 10 LEDs across, 5.4 rows tall when they all sit closed.
const [NC, RAD, PITCH, CAP] = [36, 5, 0.15, 4];
const HS = NC * PITCH;
const [MOVE, BOUNCE, SETTLE, REACH, LIFT, CARRY, LOWER] = [0, 1, 2, 3, 4, 5, 6];
const DUR = [0, 0.5, 1.5, 0.8, 0.9, 1.5, 1.5];
// The step lights' warm light; daylight comes from a window up to the left.
const LAMP = [255, 206, 150];
const [LX, LY, LZ, HX, HY, HZ] = [-0.5, -0.6, 0.62, -0.278, -0.334, 0.9];
// The eye is a little above and to one side: a ring's near half shows lower right.
const [ZX, ZY, KS] = [0.22, 0.3, 28];
const [CS, SN] = [cos, sin].map((f) => Float32Array.from({ length: KS }, (_, j) => f(((j + 0.5) / KS) * 2 * PI)));
const kern = (r, s) => Float32Array.from({ length: (2 * r + 1) ** 2 }, (_, i) => exp(-(((i % (2 * r + 1)) - r) ** 2 + (floor(i / (2 * r + 1)) - r) ** 2) / s));
const [KSH, KGL] = [kern(3, 3), kern(8, 18)];
const RAIN = [[236, 44, 52], [250, 142, 34], [246, 222, 54], [62, 200, 84], [44, 124, 240], [152, 74, 222]];
// Colour (null: rainbow bands), shine, highlight sharpness, band width, own light,
// room light, whether the step lights work, and how lazily it walks.
const MAT = [
  [[172, 180, 196], 1, 16, 0, 0, [1, 1, 1], 1, 1],
  [[232, 174, 62], 1, 9, 0, 0, [1, 0.96, 0.9], 1, 1.06],
  [null, 0.45, 5, 0.9, 0, [1, 1, 1], 1, 1.22],
  [[255, 56, 180], 0.3, 5, 0.9, 0.8, [0.34, 0.2, 0.66], 0, 1.22],
  [[140, 255, 116], 0.15, 5, 0.7, 1, [0.13, 0.16, 0.28], 0, 1.16],
];
// The hand as capsules from the pinch: x1, y1, x2, y2, radius, sleeve.
const HAND = [[-1.6, -0.8, -4.6, -7.6, 2, 0], [1.3, -1, 4.4, -8.2, 1.8, 0], [6.2, -6.8, 8.4, -12.4, 2.4, 0], [2, -12.4, 2.3, -12.7, 6.6, 0], [4, -16, 8.8, -24, 4.4, 0], [7.4, -23.6, 13.5, -36, 6.2, 1]];

// Built from the floor up, flights turning at each landing. A flight ends in a drop
// deep enough that the spring can walk off its landing under the flight's end.
function build(P, R) {
  const [dL, up, fl, lands] = [R + 16, [{ x: 56, y: FLOOR }], [], []];
  for (let s = 1, base = FLOOR, f = 0; base > 0; f++, s = -s) {
    const y1 = base - (f ? dL : R) - 2 * R;
    fl.push([s, y1, y1 + R, y1 + 2 * R]);
    for (let k = 2; k >= 0; k--) up.push({ x: s > 0 ? 20 + 12 * k : 44 - 12 * k, y: y1 + k * R });
    base = y1 - R;
    lands.push([-s, base]);
    up.push({ x: s > 0 ? 8 : 56, y: base, wall: -s });
  }
  const [end, st] = [up[0], up.reverse()];
  st.forEach((a, i) => (a.id = i));
  const i0 = st.findIndex((a) => a.y >= 16);
  const seq = [{ k: LOWER, a: st[i0] }];
  for (let i = i0; i < st.length - 1; i++) {
    const [a, b] = [st[i], st[i + 1]];
    seq.push({ k: MOVE, a, b, s: sign(b.x - a.x), under: !!a.wall });
    if (b.wall) seq.push({ k: BOUNCE, a: b, s: b.wall });
  }
  seq.push({ k: SETTLE, a: end, s: 1 }, { k: REACH, a: end }, { k: LIFT, a: end }, { k: CARRY, a: end, b: st[i0] });
  Object.assign(P, { R, seq, st, ton: new Float32Array(st.length).fill(-99) });
  paint(P, R, fl, lands);
}

function paint(P, R, fl, lands) {
  const { bg, mat } = P;
  const at = (x, y) => (x < 0 || x >= W || y < 0 || y >= H ? 9 : mat[y * W + x]);
  const set = (x, y, m, c, k = 1) => {
    if (at((x = round(x)), (y = round(y))) > 8) return;
    mat[y * W + x] = m;
    for (let i = 0; i < 3; i++) bg[(y * W + x) * 3 + i] = c[i] * k;
  };
  const lum = (x, y) => 1.16 - 0.0034 * y - 0.003 * x;
  // Wallpaper: a dusty blue ground, a pale stripe every 8 columns and a lozenge
  // between; and the edges of the side walls.
  for (let p = 0; p < N; p++) {
    const [x, y] = [p & 63, p >> 6];
    const d = abs((x % 8) - 4) + abs((y % 12) - 6) * 0.7;
    if (x < 2 || x > 61) set(x, y, 4, [100, 112, 136], lum(x, y) * (x === 1 || x === 62 ? 0.72 : 1));
    else set(x, y, 0, [48, 62, 96], (x % 8 ? (d < 1.6 ? 1.7 : d < 2.4 ? 0.84 : 1) : 1.7) * lum(x, y) * (0.95 + 0.1 * rnd()));
  }
  // A step's side: the tread on top, the board's edge under it, the joint where
  // the next riser meets it, the dark underside.
  const block = (x, top, bot, e, edge) => {
    for (let y = top; y <= bot; y++) {
      let k = y === top ? (edge ? 1.12 : 1) : (0.88 + 0.1 * sin(y * 1.7 + 2 * sin(x * 0.23)) + 0.05 * rnd()) * (1.08 - y * 0.0025) * (y === top + 1 ? 0.7 : e ? 1 : 0.62);
      set(x, y, y === top ? 2 : 1, y === top ? [216, 162, 104] : [150, 94, 56], y === bot ? k * 0.55 : k);
    }
  };
  for (const [s, ...ys] of fl) {
    for (let x = 14, d; x < 50; x++) block(x, ys[floor((d = s > 0 ? x - 14 : 49 - x) / T)], round(ys[0] + TH + (d * R) / T), d % T, d % T === T - 1);
    // Each nosing overhangs the riser below it by one LED.
    for (let k = 0, x; k < 3; k++) {
      if (at((x = s > 0 ? 26 + 12 * k : 37 - 12 * k), ys[k] + 1) === 0) set(x, ys[k] + 1, 0, [20, 30, 34]);
      set(x, ys[k], 2, [226, 174, 116]);
    }
  }
  for (const [side, y] of lands) {
    for (let x = side < 0 ? 2 : 50, i = 0; i < 12; x++, i++) block(x, y, y + R + TH, side < 0 ? i : 11 - i, false);
    if (at(side < 0 ? 14 : 49, y) === 0) set(side < 0 ? 14 : 49, y, 2, [226, 174, 116]);
  }
  // Floorboards seen from a little above, the near ones brighter, and the skirting.
  for (let p = FLOOR * W, x, r; p < N; p++) set((x = p & 63), (r = (p >> 6) - FLOOR) + FLOOR, 3, r ? [176, 122, 74] : [206, 156, 104], (0.78 + 0.04 * r) * (r % 3 === 2 || (x + r * 7) % 23 === 0 ? 0.62 : 0.95 + 0.1 * rnd()));
  for (let x = 2; x < 62; x++) for (let y = FLOOR - 4; y < FLOOR; y++) if (at(x, y) === 0) set(x, y, 5, [196, 190, 172], (y === FLOOR - 4 ? 1.08 : y === FLOOR - 1 ? 0.66 : 0.94) * lum(x, y));
  // The stairs' soft shadow from the window, down and right of them.
  for (let p = 0; p < N; p++) {
    const [x, y, m] = [p & 63, p >> 6, mat[p]];
    let n = 0;
    for (let d = 0; d < 9 && (m === 0 || m === 5); d++) n += at(x - 4 + (d % 3), y - 5 + floor(d / 3)) % 8 > 0 && at(x - 4 + (d % 3), y - 5 + floor(d / 3)) < 3 ? 1 : 0;
    for (let i = 0; i < 3; i++) bg[p * 3 + i] *= 1 - 0.045 * n;
  }
  // A small step light in the wall just above each tread and landing, and a
  // framed picture on bare wall where the spring never passes.
  for (const a of P.st) for (let i = -1; i < 1; i++) set(a.x + i, a.y - 3, 5, [70, 72, 80]);
  const free = (x0, y0) => {
    for (let n = 0; n < 120; n++) if (at(x0 - 1 + (n % 10), y0 - 1 + floor(n / 10)) !== 0) return false;
    return P.st.every((a) => abs(a.x - x0 - 4) > 13 || a.y < y0 || a.y - 26 > y0 + 10);
  };
  for (let y = 4, pic = 0; y < 110 && !pic; y += 2)
    for (const x of [4, 52, 28])
      if (!pic && (pic = free(x, y)))
        for (let n = 0; n < 80; n++) {
          const [i, j] = [n & 7, n >> 3];
          const edge = !i || !j || i === 7 || j === 9;
          set(x + i, y + j, 5, i === 5 && j === 2 ? [250, 226, 130] : edge ? [196, 150, 64] : j < 5 ? [96, 150, 206] : j < 7 ? [72, 136, 86] : [48, 96, 62], edge && (i === 7 || j === 9) ? 0.7 : 1);
        }
}

// Daylight fades from -1 to 1 and turns blue.
function lampLevel(P, k4) {
  const u = (k4 + 1) / 2;
  P.amb = [0.98, 1, 1.04].map((t, i) => t * (1.16 - 1.02 * u) * mix(1, [0.6, 0.74, 1][i], u));
  P.lampAtK = k4;
}

const [BZ, LT, FT, PT] = [new Float32Array(8), new Float32Array(17), new Float32Array(33), new Float32Array(4)];

function bez(t) {
  const u = 1 - t;
  const [a, b, c, d] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  for (let i = 0; i < 2; i++) {
    PT[i] = a * BZ[i] + b * BZ[2 + i] + c * BZ[4 + i] + d * BZ[6 + i];
    PT[2 + i] = 3 * (u * u * (BZ[2 + i] - BZ[i]) + 2 * u * t * (BZ[4 + i] - BZ[2 + i]) + t * t * (BZ[6 + i] - BZ[4 + i]));
  }
}

function setCurve(x0, y0, t0x, t0y, x3, y3, t3x, t3y, h0, h3) {
  BZ.set([x0, y0, x0 + t0x * h0, y0 + t0y * h0, x3 - t3x * h3, y3 - t3y * h3, x3, y3]);
  let [L, px, py] = [0, x0, y0];
  for (let i = 1; i <= 16; i++) {
    bez(i / 16);
    L += hypot(PT[0] - px, PT[1] - py);
    [LT[i], px, py] = [L, PT[0], PT[1]];
  }
  return L;
}

// How the coils spread along the curve: a0 keeps the ends open, b leans the spread
// one way, rip is a pulse running up the bow, c opens the top of a hanging spring.
function setDist(G) {
  const w = (v) => G.a0 + G.sn * sin(PI * v) ** 1.2 * (1 + G.b * (v - 0.5)) * (1 + G.rip * sin(2 * PI * (1.5 * v + 2 * G.ph))) + G.c * v;
  let [prev, acc] = [w(0), 0];
  for (let i = 1; i <= 32; i++) {
    const cur = w(i / 32);
    acc += prev + cur;
    [FT[i], prev] = [acc, cur];
  }
  for (let i = 1; i <= 32; i++) FT[i] /= acc;
}

function onCurve(v, L) {
  const [f, i] = [v * 32, min(31, floor(v * 32))];
  const s = (FT[i] + (FT[i + 1] - FT[i]) * (f - i)) * L;
  let j = 0;
  while (j < 15 && LT[j + 1] < s) j++;
  bez((j + cl((s - LT[j]) / max(1e-6, LT[j + 1] - LT[j]), 0, 1)) / 16);
}

// A free end's last coils stay closed and turn together like a lid.
function cap(G, x, y, tx, ty, tail) {
  const d = CAP * PITCH;
  if (tail) [G.nA, G.ax, G.ay, G.aux, G.auy] = [CAP, x, y, tx, ty];
  else [G.nB, G.bx, G.by, G.bux, G.buy] = [CAP, x, y, -tx, -ty];
  return tail ? [x + tx * d, y + ty * d] : [x - tx * d, y - ty * d];
}

// One step: the top end tips over onto the step below (p < 0.3), the coils pour
// over the bow from stack to stack, then the far end lifts and follows (p > 0.74).
function move(P, S, p, G) {
  const { a, b, s } = S;
  const [k, dx, hb, p1, p2] = [P.kf, abs(b.x - a.x), S.under ? 0.5 : 1, 0.3, 0.74];
  G.a0 = p < 0.5 ? mix(0.36, 0.18, p / 0.5) : mix(0.18, 0.12, (p - 0.5) / 0.5);
  G.b = p < p2 ? mix(0.9, 0.2, p / p2) : mix(0.2, 0, (p - p2) / (1 - p2));
  [G.bx, G.by] = [b.x, b.y];
  let C;
  if (p < p1) {
    const t = p / p1;
    const e = t * t * (1.7 - 0.7 * t);
    const [ex, ey, tx, ty] = [quad(a.x, a.x + s * dx * 0.55, b.x, e), quad(a.y - HS, min(a.y - HS, b.y) - (4 + 4 * k) * hb, b.y, e), s * sin(PI * e), -cos(PI * e)];
    G.nA = NC - CAP - (0.36 * NC - CAP) * (0.25 * t + 0.75 * e);
    C = [a.x, a.y - G.nA * PITCH, 0, -1, ...cap(G, ex, ey, tx, ty), tx, ty];
    if (P.seg === 1 && p < 0.2) [P.hx, P.hy] = [ex, ey];
  } else if (p < p2) {
    // The two stacks lean toward each other while the bow pulls on them.
    const t = (p - p1) / (p2 - p1);
    const lean = 0.16 * sin(PI * t) * k;
    [G.nA, G.nB, G.aux, G.auy] = [CAP + (0.64 * NC - CAP) * (1 - t), CAP + (0.66 * NC - CAP) * t, s * sin(lean), -cos(lean)];
    [G.bux, G.buy] = [-G.aux, G.auy];
    C = [a.x + G.aux * G.nA * PITCH, a.y + G.auy * G.nA * PITCH, G.aux, G.auy, b.x + G.bux * G.nB * PITCH, b.y + G.buy * G.nB * PITCH, -G.bux, -G.buy];
    G.rip = 0.45 * sin(PI * t) * exp(-2 * t) * k;
    G.ph = t;
  } else {
    const t = (p - p2) / (1 - p2);
    const e = t * t * (2 - t);
    const [fx, fy, tx, ty] = [quad(a.x, a.x + s * dx * 0.35, b.x, e), quad(a.y, min(a.y, b.y - HS) - (3 + 3 * k) * hb, b.y - HS, e), s * sin(PI * e), -cos(PI * e)];
    G.nB = NC - CAP - (0.34 * NC - CAP) * (1 - e);
    C = [...cap(G, fx, fy, tx, ty, 1), tx, ty, b.x, b.y - G.nB * PITCH, 0, 1];
  }
  const ch = hypot(C[4] - C[0], C[5] - C[1]);
  const h = (0.45 * ch + 4.5 * k * min(1, ch / 10)) * hb;
  G.curve = [...C, h, h];
}

// On a landing the top end swings out, meets the wall and springs back over.
// On the floor the same swing just rocks and dies away.
function bounce(P, S, u, G) {
  const [a, phc] = [S.a, PI / 2];
  let ph = S.k === SETTLE ? 1.3 * phc * exp(-3 * u) * sin(2 * PI * 2.2 * u) * (1 - sm((u - 0.7) / 0.3)) : u < 0.42 ? phc * (u / 0.42) ** 1.7 : u < 0.56 ? phc : phc * (1 - ((u - 0.56) / 0.44) ** 0.85);
  let w = S.s;
  if (ph < 0) [ph, w] = [-ph, -w];
  const sq = S.k === BOUNCE && u > 0.4 && u < 0.6 ? 0.16 * sin((PI * (u - 0.4)) / 0.2) : 0;
  const La = (((abs((S.s > 0 ? 62 : 2) - a.x) - 1.6) * PI) / 2) * (ph / phc) ** 0.7 * (1 - sq);
  G.nA = NC - CAP - min(NC * 0.4, La / 1.1);
  const [x0, y0, r, tx, ty] = [a.x, a.y - G.nA * PITCH, La / max(ph, 1e-3), w * sin(ph), -cos(ph)];
  const [qx, qy] = [x0 + w * r * (1 - cos(ph)), y0 - r * sin(ph)];
  const h = ph < 1e-3 ? La / 3 : (4 / 3) * tan(ph / 4) * r;
  cap(G, qx + tx * CAP * PITCH, qy + ty * CAP * PITCH, tx, ty);
  G.curve = [x0, y0, 0, -1, qx, qy, tx, ty, h, h];
  [G.a0, G.sn, G.b] = [0.6, 0.6, -sq * 3];
}

const hangLen = (P, m) => m * PITCH + P.lext * (m / NC) ** 2;

// Held by its top coil the spring hangs open at the top and closed at the bottom,
// each gap carrying the weight of the coils below it.
function hang(P, S, u, G) {
  let [a, x0, y0, m] = [S.a, S.a.x, 0, NC];
  if (S.k === CARRY) {
    [P.hx, P.hy] = carry(P, S, u);
    [x0, y0] = P.pb;
    G.nA = 0;
  } else {
    m = NC * (S.k === LIFT ? sm(u) : 1 - sm(u));
    G.nA = NC - m;
    y0 = a.y - G.nA * PITCH;
    [P.hx, P.hy] = [x0, y0 - hangLen(P, m)];
  }
  [G.sn, G.c, G.a0] = [0, 1, min(50, (m * PITCH) / max(1e-3, 2 * P.lext * (m / NC) ** 2))];
  const L = max(1e-3, hypot(P.hx - x0, P.hy - y0));
  G.curve = [x0, y0, (P.hx - x0) / L, (P.hy - y0) / L, P.hx, P.hy, 0, -1, L / 3, L / 3];
}

function carry(P, S, u) {
  const [e, L] = [sm(u), hangLen(P, NC)];
  return [mix(S.a.x, S.b.x, e) + 6 * sin(PI * e), mix(FLOOR - L, S.b.y - L, e)];
}

function dur(P, S) {
  if (S.k === MOVE) return 0.44 * sqrt((S.b.y - S.a.y + 6) / 12) * P.kf;
  return S.k === BOUNCE ? DUR[1] * P.kf : DUR[S.k];
}

function shape(P) {
  const [S, G] = [P.seq[P.seg], P.G];
  const u = cl(P.sp / dur(P, S), 0, 1);
  Object.assign(P.G, { ax: S.a.x, ay: S.a.y, aux: 0, auy: -1, nA: NC, bx: 0, by: 0, bux: 0, buy: -1, nB: 0, a0: 0.3, sn: 1, b: 0, rip: 0, ph: 0, c: 0, curve: null });
  P.hx = -99;
  if (S.k === MOVE) move(P, S, u, G);
  else if (S.k === BOUNCE || S.k === SETTLE) bounce(P, S, u, G);
  else if (S.k === REACH) [P.hx, P.hy] = [mix(80, S.a.x, 1 - (1 - u) ** 2), mix(FLOOR - 46, S.a.y - HS, 1 - (1 - u) ** 2)];
  else hang(P, S, u, G);
  if (P.ht >= 0 && P.ht < 0.8) [P.hx, P.hy] = [P.rx + 12 * sm(P.ht / 0.8), P.ry - 44 * sm(P.ht / 0.8)];
  // Every coil: its centre and the way the spring runs through it.
  const { cx, cy, tx, ty } = P;
  const nc = NC - G.nA - G.nB;
  const L = G.curve && nc > 1e-3 ? setCurve(...G.curve) : 0;
  if (L) setDist(G);
  for (let q = 0; q < NC; q++) {
    const u = q + 0.5;
    if (u <= G.nA || !L) [cx[q], cy[q], tx[q], ty[q]] = [G.ax + G.aux * u * PITCH, G.ay + G.auy * u * PITCH, G.aux, G.auy];
    else if (u >= NC - G.nB) [cx[q], cy[q], tx[q], ty[q]] = [G.bx + G.bux * (NC - u) * PITCH, G.by + G.buy * (NC - u) * PITCH, -G.bux, -G.buy];
    else {
      onCurve((u - G.nA) / nc, L);
      const d = hypot(PT[2], PT[3]) || 1;
      [cx[q], cy[q], tx[q], ty[q]] = [PT[0], PT[1], PT[2] / d, PT[3] / d];
    }
  }
}

function restart(P) {
  Object.assign(P, { seg: 0, sp: 0.9, par: 0, ht: -1, pb: [0, 0], pv: [0, 0], clock: 0 });
  P.ton.fill(-99);
}

function advance(P, h) {
  P.sp += h;
  P.clock += h;
  if (P.ht >= 0) P.ht += h;
  let S = P.seq[P.seg];
  if (P.seg === 1 && P.ht < 0 && P.sp >= 0.2 * dur(P, S)) [P.ht, P.rx, P.ry] = [0, P.hx, P.hy];
  // A step light wakes when the spring lands by it, and stays on for 8 seconds.
  const b = S.k === MOVE ? S.b : S.k === LOWER ? S.a : null;
  if (b && P.sp >= 0.3 * dur(P, S) && P.ton[b.id] < P.clock - 9.5) P.ton[b.id] = P.clock;
  while (P.sp >= dur(P, S)) {
    P.sp -= dur(P, S);
    if (S.k === MOVE) P.par ^= 1;
    S = P.seq[(P.seg = (P.seg + 1) % P.seq.length)];
    if (S.k === CARRY) [P.pb, P.pv] = [[S.a.x, FLOOR], [0, 0]];
    if (S.k === LOWER) P.ht = -1;
  }
  // Carried, the bottom of the spring hangs back and swings under the hand.
  if (S.k !== CARRY) return;
  const u = P.sp / dur(P, S);
  const [[hx, hy], L, damp] = [carry(P, S, u), hangLen(P, NC), 3.5 + 30 * sm((u - 0.65) / 0.35)];
  for (let c = 0; c < 2; c++) {
    P.pv[c] += (48 * ((c ? hy + L : hx) - P.pb[c]) - damp * P.pv[c]) * h;
    P.pb[c] += P.pv[c] * h;
  }
  const [dx, dy, r] = [P.pb[0] - hx, P.pb[1] - hy - L, hypot(P.pb[0] - hx, P.pb[1] - hy - L)];
  if (r > 0.6 * L) P.pb = [hx + (dx * 0.6 * L) / r, hy + L + (dy * 0.6 * L) / r];
}

export function setup(params) {
  const [P, F] = [params, (n) => new Float32Array(n)];
  Object.assign(P, { bg: F(N * 3), out: F(N * 3), pl: F(N), mat: new Uint8Array(N), sh: F(N), gl: F(N), fa: F(N * 4), ba: F(N * 4) });
  Object.assign(P, { hit: new Uint8Array(N), list: new Int32Array(N), nl: 0, cx: F(NC), cy: F(NC), tx: F(NC), ty: F(NC), G: {}, kf: 1, lext: 38, hx: -99, hy: 0, M: material(0) });
  build(P, 6);
  lampLevel(P, 0.06);
  restart(P);
}

export function update(dt, input, params) {
  const [P, k] = [params, input.knobValues || [0, 2, 6, 0.06]];
  P.M = material(cl(k[0], 0, 1));
  [P.kf, P.lext] = [P.M.lazy, 38 / P.M.lazy ** 2];
  const R = round(cl(k[2], 6, 12));
  if (R !== P.R) build(P, R), restart(P);
  if (cl(k[3], -1, 1) !== P.lampAtK) lampLevel(P, cl(k[3], -1, 1));
  const h = cl(dt, 0, 0.1) * (cl(k[1], 0.2, 3) / 2);
  const n = Math.ceil(h / 0.01);
  for (let i = 0; i < n; i++) advance(P, h / n);
}

function material(k1) {
  const i = min(3, floor(k1 * 4));
  const [t, A, B] = [k1 * 4 - i, MAT[i], MAT[i + 1]];
  const M = { i, t, shine: mix(A[1], B[1], t), pw: mix(A[2], B[2], t), wide: mix(A[3], B[3], t), emit: mix(A[4], B[4], t), lamps: mix(A[6], B[6], t), lazy: mix(A[7], B[7], t) };
  M.room = A[5].map((v, c) => mix(v, B[5][c], t));
  const g = (m) => MAT[m][0] || [230, 200, 190];
  M.glow = g(i).map((v, c) => mix(v, g(i + 1)[c], t) * M.emit);
  return M;
}

function colour(M, id) {
  const pick = (m) => MAT[m][0] || RAIN[floor((id * 6) / NC)];
  const [a, b] = [pick(M.i), pick(M.i + 1)];
  return [0, 1, 2].map((c) => mix(a[c], b[c], M.t));
}

function stamp(F, K, r, x, y, w) {
  const [ix, iy, n] = [round(x), round(y), 2 * r + 1];
  for (let j = -r; j <= r; j++) {
    const yy = iy + j;
    if (yy < 0 || yy >= H) continue;
    for (let i = -r; i <= r; i++) if (ix + i >= 0 && ix + i < W) F[yy * W + ix + i] += K[(j + r) * n + i + r] * w;
  }
}

function add(P, A, x, y, c, w) {
  if (x < 0 || x >= W || y < 0 || y >= H || w <= 0) return;
  const p = y * W + x;
  if (!P.hit[p]) P.list[P.nl++] = p;
  P.hit[p] = 1;
  for (let i = 0; i < 3; i++) A[p * 4 + i] += c[i] * w;
  A[p * 4 + 3] += w;
}

function splat(P, A, x, y, c, w) {
  const [ix, iy] = [floor((x -= 0.5)), floor((y -= 0.5))];
  const [fx, fy] = [x - ix, y - iy];
  for (let n = 0; n < 4; n++) add(P, A, ix + (n & 1), iy + (n >> 1), c, w * (n & 1 ? fx : 1 - fx) * (n >> 1 ? fy : 1 - fy));
}

// Each coil a thin ring seen nearly side-on: the far half dim inside the
// spring, the near half lit by the window and the step lights, with a glint.
function rings(P, M) {
  const { cx, cy, tx, ty, fa, ba } = P;
  const v = [0, 0, 0];
  for (let q = 0; q < NC; q++) {
    const col = colour(M, P.par ? NC - 1 - q : q);
    const [nx, ny] = [-ty[q], tx[q]];
    const [nl, nh] = [nx * LX + ny * LY, nx * HX + ny * HY];
    const lamp = P.pl[cl(round(cy[q]), 0, H - 1) * W + cl(round(cx[q]), 0, W - 1)] * 0.3;
    const lt = M.room.map((r, i) => r * (P.amb[i] + (lamp * LAMP[i]) / 255));
    for (let j = 0; j < KS; j++) {
      const [c, s] = [CS[j], SN[j]];
      const dif = max(0, c * nl + s * LZ);
      const spe = M.shine * max(0, c * nh + s * HZ) ** M.pw;
      const k = s > 0 ? 1 : 0.42;
      for (let i = 0; i < 3; i++) v[i] = (col[i] * (M.emit + lt[i] * (0.28 + 0.85 * dif)) + 255 * spe * lt[i]) * k;
      const [x, y, A] = [cx[q] + (nx * c + ZX * s) * RAD, cy[q] + (ny * c + ZY * s) * RAD, s > 0 ? fa : ba];
      splat(P, A, x, y, v, 1);
      if (M.wide > 0) splat(P, A, x + tx[q] * 0.7, y + ty[q] * 0.7, v, M.wide);
    }
  }
}

// The room: daylight, the pools of the step lights that are on, the spring's
// soft shadow, and the light a glowing spring throws round it.
function lighting(P, M) {
  const { cx, cy, tx, ty, sh, gl, pl, out, bg, mat, amb } = P;
  sh.fill(0);
  gl.fill(0);
  pl.fill(0);
  for (let q = 0; q < NC; q += 2) {
    const [nx, ny] = [-ty[q] * RAD * 0.65, tx[q] * RAD * 0.65];
    for (const f of [-1, 0, 1]) stamp(sh, KSH, 3, cx[q] + 3 + nx * f, cy[q] + 4 + ny * f, 0.3);
    if (M.emit > 0 && q % 6 === 0) stamp(gl, KGL, 8, cx[q], cy[q], 0.12 * M.emit);
  }
  for (const a of P.st) {
    const d = P.clock - P.ton[a.id];
    const I = M.lamps * sm(d / 0.3) * (1 - sm((d - 8) / 1.5));
    if (I <= 0) continue;
    for (let y = max(0, a.y - 13); y <= min(H - 1, a.y); y++)
      for (let x = max(0, a.x - 13); x < min(W, a.x + 13); x++) if (mat[y * W + x] % 3 !== 1) pl[y * W + x] += 1.5 * I * exp(-(((x + 0.5 - a.x) / 9) ** 2) - ((y - a.y + 3) / 6) ** 2);
    for (let i = -1; i < 1; i++) if (a.y > 3 && a.y < H + 2) pl[(a.y - 3) * W + a.x + i] += 6 * I;
  }
  const K = [0, 1, 2].map((i) => [M.room[i] * amb[i], (M.room[i] * LAMP[i]) / 300, (M.glow[i] / 255) * 1.3, M.glow[i] * 0.1, M.room[i] * [60, 34, 6][i]]);
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const m = mat[p];
    const s = 1 - min(1, sh[p]) * (m === 0 || m === 5 ? 0.7 : m === 2 || m === 3 ? 0.45 : 0);
    const [g, l] = [min(1.5, gl[p]), pl[p]];
    for (let i = 0, k; i < 3; i++) out[o + i] = bg[o + i] * ((k = K[i])[0] * s + k[1] * l + k[2] * g) + k[3] * g + k[4] * l;
  }
}

function composite(P) {
  const { out, fa, ba, hit, list } = P;
  for (let i = 0; i < P.nl; i++) {
    const [p, q] = [list[i], list[i] * 4];
    for (const A of [ba, fa]) {
      const a = A[q + 3];
      if (a > 0) for (let c = 0, k = min(1, a); c < 3; c++) out[p * 3 + c] = out[p * 3 + c] * (1 - k) + (A[q + c] / a) * k;
      A[q] = A[q + 1] = A[q + 2] = A[q + 3] = 0;
    }
    hit[p] = 0;
  }
  P.nl = 0;
}

function capsule(px, py, x1, y1, x2, y2) {
  const [dx, dy] = [x2 - x1, y2 - y1];
  const t = cl(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return hypot(px - x1 - dx * t, py - y1 - dy * t);
}

// A child's hand pinching the top coil, a striped sleeve running off up and right.
function hand(P, M) {
  const { out, hx, hy } = P;
  for (let y = max(0, floor(hy - 44)); y <= min(H - 1, hy + 2); y++)
    for (let x = max(0, floor(hx - 8)); x <= min(W - 1, hx + 21); x++) {
      let [ds, dc] = [9, 9];
      for (const [x1, y1, x2, y2, r, sl] of HAND) {
        const d = capsule(x + 0.5 - hx, y + 0.5 - hy, x1, y1, x2, y2) - r;
        if (sl) dc = min(dc, d);
        else ds = min(ds, d);
      }
      let [c, k] = [0, 0];
      if (ds < 0) [c, k] = [[238, 184, 148], (ds > -0.8 ? 0.68 : 0.86 + 0.18 * cl(-ds / 2.5, 0, 1)) * (1.06 - 0.02 * (x - hx))];
      else if (dc < 0) [c, k] = [floor((y - hy + (x - hx) * 0.5) / 2) % 2 ? [206, 56, 62] : [232, 222, 206], dc > -0.8 ? 0.62 : 0.92];
      else continue;
      for (let i = 0; i < 3; i++) out[(y * W + x) * 3 + i] = c[i] * k * M.room[i] * (0.15 + 0.85 * P.amb[i] + P.pl[y * W + x] * 0.5);
    }
}

export function draw(display, params) {
  const [P, M] = [params, params.M];
  shape(P);
  lighting(P, M);
  rings(P, M);
  composite(P);
  if (P.hx > -20 && P.hx < 90 && P.hy > -2) hand(P, M);
  const o = P.out;
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i += 3) display.setPixel(x, y, min(255, o[i]), min(255, o[i + 1]), min(255, o[i + 2]));
}
