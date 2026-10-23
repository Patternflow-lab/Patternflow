// ===== Patternflow pattern =====
// Title:   Slinky
// Family:  toy
// Idea:    A Slinky walks end over end down a stairwell that zigzags the full height of the panel, its coils pouring through a bow from each step to the next and springing off the wall at every landing, until a hand lifts it dangling off the hall floor and sets it back on the top step.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 21, after the Slinky, the steel spring toy Richard James brought out in 1945, walking down the stairs
// Round:   21
// ===============================
// @matrix 64x128
// @knobs Spring=0..1, Speed=0.2..3, Rise=6..12, Lamp=-1..1
//
// Knob 1: Spring. Which Slinky comes out of the box: polished steel at 0, then gold plate, the rainbow plastic one that walks lazier, a neon one under a blacklight, and at 1 a glow-in-the-dark one with the lights out.
// Knob 2: Speed. How fast the film runs: at 2 a step takes under half a second and the walk from top to bottom about seven; at 0.2 it is ten times slower.
// Knob 3: Rise. How tall each step is, from 6 rows to 12: low steps make three flights and small quick bows, tall ones two flights and long reaches down.
// Knob 4: Lamp. The light in the stairwell: morning at -1, late afternoon at 0 with the wall lamps just on, and night at 1, the stairs lit only in warm pools round the lamps and the spring flashing as it walks through them.

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
// Daylight from a window up to the left; the wall lamps' warm light.
const LAMP = [255, 206, 150];
const [LX, LY, LZ, HX, HY, HZ] = [-0.5, -0.6, 0.62, -0.278, -0.334, 0.9];
// The eye is a little above the stairs and to one side, so a ring's near half
// shows a little below and right of its far half.
const [ZX, ZY, KS] = [0.22, 0.3, 28];
const CS = Float32Array.from({ length: KS }, (_, j) => cos(((j + 0.5) / KS) * 2 * PI));
const SN = Float32Array.from({ length: KS }, (_, j) => sin(((j + 0.5) / KS) * 2 * PI));
const kern = (r, s) => Float32Array.from({ length: (2 * r + 1) ** 2 }, (_, i) => exp(-(((i % (2 * r + 1)) - r) ** 2 + (floor(i / (2 * r + 1)) - r) ** 2) / s));
const [KSH, KGL] = [kern(3, 3), kern(8, 18)];
const RAIN = [[236, 44, 52], [250, 142, 34], [246, 222, 54], [62, 200, 84], [44, 124, 240], [152, 74, 222]];
// Colour (null: rainbow bands), shine, highlight sharpness, band width, own light,
// room light, whether the lamps stay on, and how lazily it walks.
const MAT = [
  [[172, 180, 196], 1, 16, 0, 0, [1, 1, 1], 1, 1],
  [[232, 174, 62], 1, 9, 0, 0, [1, 0.96, 0.9], 1, 1.06],
  [null, 0.45, 5, 0.9, 0, [1, 1, 1], 1, 1.22],
  [[255, 56, 180], 0.3, 5, 0.9, 0.8, [0.34, 0.2, 0.66], 0, 1.22],
  [[140, 255, 116], 0.15, 5, 0.7, 1, [0.13, 0.16, 0.28], 0, 1.16],
];
// The hand as capsules from the pinch: x1, y1, x2, y2, radius, sleeve.
const HAND = [[-1.6, -0.8, -4.6, -7.6, 2, 0], [1.3, -1, 4.4, -8.2, 1.8, 0], [6.2, -6.8, 8.4, -12.4, 2.4, 0], [2, -12.4, 2.3, -12.7, 6.6, 0], [4, -16, 8.8, -24, 4.4, 0], [7.4, -23.6, 13.5, -36, 6.2, 1]];

// ---- the staircase ----

// Built from the floor up: the bottom flight runs right, each one above runs the
// other way. A flight ends in a deep drop to its landing, deep enough that the
// spring can walk off the landing under the end of the flight above.
function build(P, R) {
  const dL = R + 16;
  const up = [{ x: 56, y: FLOOR }];
  const fl = [];
  const lands = [];
  for (let s = 1, base = FLOOR, f = 0; base > 0; f++, s = -s) {
    const y1 = base - (f ? dL : R) - 2 * R;
    fl.push([s, y1, y1 + R, y1 + 2 * R]);
    for (let k = 2; k >= 0; k--) up.push({ x: s > 0 ? 20 + 12 * k : 44 - 12 * k, y: y1 + k * R });
    base = y1 - R;
    lands.push([-s, base]);
    up.push({ x: s > 0 ? 8 : 56, y: base, wall: -s });
  }
  const st = up.reverse();
  const i0 = st.findIndex((a) => a.y >= 16);
  const seq = [{ k: LOWER, a: st[i0] }];
  for (let i = i0; i < st.length - 1; i++) {
    const [a, b] = [st[i], st[i + 1]];
    seq.push({ k: MOVE, a, b, s: sign(b.x - a.x), under: !!a.wall });
    if (b.wall) seq.push({ k: BOUNCE, a: b, s: b.wall });
  }
  const end = st[st.length - 1];
  seq.push({ k: SETTLE, a: end, s: 1 }, { k: REACH, a: end }, { k: LIFT, a: end }, { k: CARRY, a: end, b: st[i0] });
  Object.assign(P, { R, seq });
  paint(P, R, fl, lands, seq);
}

function paint(P, R, fl, lands, seq) {
  const { bg, mat } = P;
  const set = (x, y, m, c, k = 1) => {
    if ((x = round(x)) < 0 || x >= W || (y = round(y)) < 0 || y >= H) return;
    const p = y * W + x;
    mat[p] = m;
    for (let i = 0; i < 3; i++) bg[p * 3 + i] = c[i] * k;
  };
  const at = (x, y) => (x < 0 || x >= W || y < 0 || y >= H ? 9 : mat[y * W + x]);
  const lum = (x, y) => 1.16 - 0.0034 * y - 0.003 * x;
  // Wallpaper: a teal ground, a pale stripe every 8 columns and a lozenge between.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = x % 8;
      const d = abs(sx - 4) + abs((y % 12) - 6) * 0.7;
      set(x, y, 0, [38, 70, 80], (sx === 0 ? 1.3 : d < 1.6 ? 1.38 : d < 2.4 ? 0.84 : 1) * lum(x, y) * (0.95 + 0.1 * rnd()));
    }
  for (let y = 0; y < H; y++) for (const x of [0, 1, 62, 63]) set(x, y, 4, [92, 120, 124], lum(x, y) * (x === 1 || x === 62 ? 0.72 : 1));
  // A step's side: the tread on top, the board's edge under it, the joint where
  // the next riser meets it, the dark underside.
  const block = (x, top, bot, e, edge) => {
    for (let y = top; y <= bot; y++) {
      let k = (0.88 + 0.1 * sin(y * 1.7 + 2 * sin(x * 0.23)) + 0.05 * rnd()) * (1.08 - y * 0.0025);
      if (y === top) k = edge ? 1.12 : 1;
      else if (y === top + 1) k *= 0.7;
      else if (e === 0) k *= 0.62;
      if (y === bot) k *= 0.55;
      set(x, y, y === top ? 2 : 1, y === top ? [216, 162, 104] : [150, 94, 56], k);
    }
  };
  for (const [s, ...ys] of fl) {
    for (let x = 14; x < 50; x++) {
      const d = s > 0 ? x - 14 : 49 - x;
      block(x, ys[floor(d / T)], round(ys[0] + TH + (d * R) / T), d % T, d % T === T - 1);
    }
    // Each nosing overhangs the riser below it by one LED.
    for (let k = 0; k < 3; k++) {
      const x = s > 0 ? 26 + 12 * k : 37 - 12 * k;
      set(x, ys[k], 2, [226, 174, 116]);
      if (at(x, ys[k] + 1) === 0) set(x, ys[k] + 1, 0, [20, 30, 34]);
    }
  }
  for (const [side, y] of lands) {
    const x0 = side < 0 ? 2 : 50;
    for (let x = x0; x < x0 + 12; x++) block(x, y, y + R + TH, side < 0 ? x - 2 : 61 - x, false);
    if (at(side < 0 ? 14 : 49, y) === 0) set(side < 0 ? 14 : 49, y, 2, [226, 174, 116]);
  }
  // Floorboards seen from a little above, the near ones brighter.
  for (let y = FLOOR; y < H; y++)
    for (let x = 0, r = y - FLOOR; x < W; x++) set(x, y, 3, r ? [176, 122, 74] : [206, 156, 104], (0.78 + 0.04 * r) * (r % 3 === 2 || (x + r * 7) % 23 === 0 ? 0.62 : 0.95 + 0.1 * rnd()));
  for (let x = 2; x < 62; x++) for (let y = FLOOR - 4; y < FLOOR; y++) if (at(x, y) === 0) set(x, y, 5, [196, 190, 172], (y === FLOOR - 4 ? 1.08 : y === FLOOR - 1 ? 0.66 : 0.94) * lum(x, y));
  // A handrail on the wall above each flight, on brackets.
  for (const [s, y1] of fl)
    for (let x = 15; x < 49; x++) {
      const y = round(y1 + ((s > 0 ? x - 26 : 37 - x) * R) / T - 9);
      if (at(x, y) === 0) set(x, y, 5, [104, 66, 42]);
      if (at(x, y - 1) === 0) set(x, y - 1, 5, [150, 108, 72]);
      if ((s > 0 ? x - 14 : 49 - x) % T === 6 && at(x, y + 1) === 0) set(x, y + 1, 5, [60, 60, 68]);
    }
  // The stairs' soft shadow from the room light, down and right of them.
  const solid = (x, y) => (at(x, y) === 1 || at(x, y) === 2 ? 1 : 0);
  for (let y = 0; y < H; y++)
    for (let x = 2; x < 62; x++) {
      if (at(x, y) !== 0 && at(x, y) !== 5) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += solid(x - 3 + dx, y - 4 + dy);
      for (let i = 0, p = (y * W + x) * 3; i < 3; i++) bg[p + i] *= 1 - 0.045 * n;
    }
  // Where the spring never goes, a framed picture and a light switch.
  const keep = new Uint8Array(N);
  for (const S of seq) {
    if (S.k > SETTLE) continue;
    const b = S.b || { x: S.s > 0 ? 62 : 2, y: S.a.y };
    for (let y = max(0, min(S.a.y, b.y) - 22); y <= min(H - 1, max(S.a.y, b.y)); y++) for (let x = max(0, min(S.a.x, b.x) - 8); x <= min(W - 1, max(S.a.x, b.x) + 8); x++) keep[y * W + x] = 1;
  }
  const free = (x0, y0, w, h) => {
    for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) if (at(x, y) !== 0 || keep[y * W + x]) return false;
    return true;
  };
  // Up to three wall lamps where there is room, each a shade on a brass arm.
  const lamps = [];
  for (let y = 6; y < 112 && lamps.length < 3; y += 2)
    for (const x of [7, 56, 31])
      if (lamps.every((l) => abs(l[1] - y) > 26) && free(x - 3, y - 4, 7, 9)) {
        lamps.push([x, y]);
        for (let j = -3; j <= 4; j++)
          for (let i = -3; i <= 3; i++) {
            const shade = j >= -3 && j <= 0 && abs(i) <= 2 + (j + 3) / 3;
            if (shade) set(x + i, y + j, 6, [255, 226, 170], 1 - 0.12 * abs(i));
            else if ((i === 0 && j > 0 && j < 4) || (j === 4 && abs(i) < 2)) set(x + i, y + j, 5, [176, 140, 70]);
          }
        break;
      }
  const L = P.lamp;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      L[p] = 0;
      for (const [lx, ly] of lamps) L[p] += 1.6 * exp(-((x - lx) ** 2 + (y - ly) ** 2) / 380) + 0.5 * exp(-((x - lx) ** 2 + (y - ly) ** 2) / 40);
    }
  P.lampAt = (x, y) => L[cl(round(y), 0, H - 1) * W + cl(round(x), 0, W - 1)];
  let [pic, sw] = [0, 0];
  for (let y = 4; y < 110; y += 2)
    for (const x of [4, 52, 28]) {
      if (!pic && free(x, y, 8, 10)) {
        pic = 1;
        for (let j = 0; j < 10; j++)
          for (let i = 0; i < 8; i++) {
            const edge = i === 0 || j === 0 || i === 7 || j === 9;
            const c = edge ? [196, 150, 64] : j < 5 ? [96, 150, 206] : j < 7 ? [72, 136, 86] : [48, 96, 62];
            set(x + i, y + j, 5, i === 5 && j === 2 ? [250, 226, 130] : c, edge && (i === 7 || j === 9) ? 0.7 : 1);
          }
      } else if (pic && !sw && free(x + 3, y + 14, 2, 3)) {
        sw = 1;
        for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) set(x + 3 + i, y + 14 + j, 5, [206, 200, 184], j === 1 && i === 0 ? 0.6 : 1);
      }
    }
}

// Daylight fades from -1 to 1 and turns blue; the lamps come on past dusk.
function lampLevel(P, k4) {
  const u = (k4 + 1) / 2;
  const d = sm((u - 0.5) / 0.5);
  P.amb = [0.98, 1, 1.04].map((t, i) => t * (1.16 - 0.2 * u - 0.8 * d) * mix(1, [0.6, 0.74, 1][i], d));
  P.lampI = sm((u - 0.3) / 0.5);
  P.lampAtK = k4;
}

// ---- the spring's shape ----

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

// How the coils spread along the curve: a0 keeps the ends from closing up, b
// leans the spread toward one end, rip is a pulse running back up the bow, c
// opens the gaps toward the top when the spring hangs.
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
  const f = v * 32;
  const i = min(31, floor(f));
  const s = (FT[i] + (FT[i + 1] - FT[i]) * (f - i)) * L;
  let j = 0;
  while (j < 15 && LT[j + 1] < s) j++;
  bez((j + cl((s - LT[j]) / max(1e-6, LT[j + 1] - LT[j]), 0, 1)) / 16);
}

// A free end: its last few coils stay closed and turn together, like a lid.
// Returns where the open part of the spring meets them.
function cap(G, x, y, tx, ty, tail) {
  const d = CAP * PITCH;
  if (tail) [G.nA, G.ax, G.ay, G.aux, G.auy] = [CAP, x, y, tx, ty];
  else [G.nB, G.bx, G.by, G.bux, G.buy] = [CAP, x, y, -tx, -ty];
  return tail ? [x + tx * d, y + ty * d] : [x - tx * d, y - ty * d];
}

// One step down: the top end tips over and lands on the step below (p < 0.3),
// the coils pour over the bow from one stack to the other, then the far end
// lifts off and follows over the top (p > 0.74).
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
  const a = S.a;
  const phc = PI / 2;
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

// Held by its top coil the spring hangs open at the top and closed at the
// bottom, every gap carrying the weight of the coils below it.
function hang(P, S, u, G) {
  const a = S.a;
  let [x0, y0, m] = [a.x, 0, NC];
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
  const S = P.seq[P.seg];
  const u = cl(P.sp / dur(P, S), 0, 1);
  const G = Object.assign(P.G, { ax: S.a.x, ay: S.a.y, aux: 0, auy: -1, nA: NC, bx: 0, by: 0, bux: 0, buy: -1, nB: 0, a0: 0.3, sn: 1, b: 0, rip: 0, ph: 0, c: 0, curve: null });
  P.hx = -99;
  if (S.k === MOVE) move(P, S, u, G);
  else if (S.k === BOUNCE || S.k === SETTLE) bounce(P, S, u, G);
  else if (S.k === REACH) {
    const e = 1 - (1 - u) ** 2;
    [P.hx, P.hy] = [mix(80, S.a.x, e), mix(FLOOR - 46, S.a.y - HS, e)];
  } else hang(P, S, u, G);
  if (P.ht >= 0 && P.ht < 0.8) {
    const e = sm(P.ht / 0.8);
    [P.hx, P.hy] = [P.rx + 12 * e, P.ry - 44 * e];
  }
  // Every coil: its centre and the way the spring runs through it.
  const { cx, cy, tx, ty } = P;
  const nc = NC - G.nA - G.nB;
  let L = 0;
  if (G.curve && nc > 1e-3) {
    L = setCurve(...G.curve);
    setDist(G);
  }
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

// ---- running ----

function restart(P) {
  Object.assign(P, { seg: 0, sp: 0.9, par: 0, ht: -1, pb: [0, 0], pv: [0, 0] });
}

function advance(P, h) {
  P.sp += h;
  if (P.ht >= 0) P.ht += h;
  let S = P.seq[P.seg];
  if (P.seg === 1 && P.ht < 0 && P.sp >= 0.2 * dur(P, S)) [P.ht, P.rx, P.ry] = [0, P.hx, P.hy];
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
  const [hx, hy] = carry(P, S, u);
  const L = hangLen(P, NC);
  const damp = 3.5 + 30 * sm((u - 0.65) / 0.35);
  for (let c = 0; c < 2; c++) {
    P.pv[c] += (48 * ((c ? hy + L : hx) - P.pb[c]) - damp * P.pv[c]) * h;
    P.pb[c] += P.pv[c] * h;
  }
  const [dx, dy] = [P.pb[0] - hx, P.pb[1] - hy - L];
  const r = hypot(dx, dy);
  if (r > 0.6 * L) P.pb = [hx + (dx * 0.6 * L) / r, hy + L + (dy * 0.6 * L) / r];
}

export function setup(params) {
  const P = params;
  const F = (n) => new Float32Array(n);
  Object.assign(P, { bg: F(N * 3), out: F(N * 3), lamp: F(N), mat: new Uint8Array(N), sh: F(N), gl: F(N), fa: F(N * 4), ba: F(N * 4) });
  Object.assign(P, { hit: new Uint8Array(N), list: new Int32Array(N), nl: 0, cx: F(NC), cy: F(NC), tx: F(NC), ty: F(NC), G: {}, k1: 0, kf: 1, lext: 24, hx: -99, hy: 0 });
  build(P, 6);
  lampLevel(P, 0.06);
  P.M = material(0);
  restart(P);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 6, 0.06];
  dt = cl(dt, 0, 0.1);
  P.M = material((P.k1 = cl(k[0], 0, 1)));
  P.kf = P.M.lazy;
  P.lext = 38 / P.M.lazy ** 2;
  const R = round(cl(k[2], 6, 12));
  if (R !== P.R) {
    build(P, R);
    restart(P);
  }
  const k4 = cl(k[3], -1, 1);
  if (k4 !== P.lampAtK) lampLevel(P, k4);
  const h = dt * (cl(k[1], 0.2, 3) / 2);
  const n = Math.ceil(h / 0.01);
  for (let i = 0; i < n; i++) advance(P, h / n);
}

// ---- drawing ----

function material(k1) {
  const f = k1 * 4;
  const i = min(3, floor(f));
  const t = f - i;
  const [A, B] = [MAT[i], MAT[i + 1]];
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
  add(P, A, ix, iy, c, w * (1 - fx) * (1 - fy));
  add(P, A, ix + 1, iy, c, w * fx * (1 - fy));
  add(P, A, ix, iy + 1, c, w * (1 - fx) * fy);
  add(P, A, ix + 1, iy + 1, c, w * fx * fy);
}

// Each coil a thin ring seen nearly side-on: the far half dim inside the
// spring, the near half lit by the window and the lamps, with a glint.
function rings(P, M) {
  const { cx, cy, tx, ty, fa, ba } = P;
  const v = [0, 0, 0];
  for (let q = 0; q < NC; q++) {
    const col = colour(M, P.par ? NC - 1 - q : q);
    const [nx, ny] = [-ty[q], tx[q]];
    const [nl, nh] = [nx * LX + ny * LY, nx * HX + ny * HY];
    const lamp = M.lamps * P.lampI * P.lampAt(cx[q], cy[q]) * 1.3;
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

// The room: daylight and lamplight, the spring's soft shadow, and the light a
// glowing spring throws round it. The lamp shades shine by themselves.
function lighting(P, M) {
  const { cx, cy, tx, ty, sh, gl, out, bg, lamp, mat, amb } = P;
  sh.fill(0);
  gl.fill(0);
  for (let q = 0; q < NC; q += 2) {
    const [nx, ny] = [-ty[q] * RAD * 0.65, tx[q] * RAD * 0.65];
    for (const f of [-1, 0, 1]) stamp(sh, KSH, 3, cx[q] + 3 + nx * f, cy[q] + 4 + ny * f, 0.3);
    if (M.emit > 0 && q % 6 === 0) stamp(gl, KGL, 8, cx[q], cy[q], 0.12 * M.emit);
  }
  const li = P.lampI * M.lamps;
  const c = [0, 1, 2].map((i) => M.room[i] * amb[i]);
  const e = [0, 1, 2].map((i) => (M.room[i] * li * LAMP[i]) / 255);
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const m = mat[p];
    const s = min(1, sh[p]) * (m === 0 || m === 5 ? 0.7 : m === 2 || m === 3 ? 0.45 : 0);
    const g = min(1.5, gl[p]);
    const l = lamp[p] * (1 - s);
    for (let i = 0; i < 3; i++) {
      const gc = M.glow[i];
      out[o + i] = m === 6 ? bg[o + i] * (0.3 * c[i] + 0.9 * e[i] * 255 / LAMP[i]) : bg[o + i] * (c[i] * (1 - s) + e[i] * l + (gc / 255) * g * 1.3) + gc * g * 0.1;
    }
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
      let c;
      let k;
      if (ds < 0) [c, k] = [[238, 184, 148], (ds > -0.8 ? 0.68 : 0.86 + 0.18 * cl(-ds / 2.5, 0, 1)) * (1.06 - 0.02 * (x - hx))];
      else if (dc < 0) [c, k] = [floor((y - hy + (x - hx) * 0.5) / 2) % 2 ? [206, 56, 62] : [232, 222, 206], dc > -0.8 ? 0.62 : 0.92];
      else continue;
      for (let i = 0; i < 3; i++) out[(y * W + x) * 3 + i] = c[i] * k * M.room[i] * (0.15 + 0.85 * P.amb[i] + M.lamps * P.lampI * P.lampAt(x, y) * 0.6);
    }
}

export function draw(display, params) {
  const P = params;
  const M = P.M;
  shape(P);
  lighting(P, M);
  rings(P, M);
  composite(P);
  if (P.hx > -20 && P.hx < 90 && P.hy > -2) hand(P, M);
  const o = P.out;
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i += 3) display.setPixel(x, y, min(255, o[i]), min(255, o[i + 1]), min(255, o[i + 2]));
}
