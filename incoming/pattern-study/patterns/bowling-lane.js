// ===== Patternflow pattern =====
// Title:   Bowling Lane
// Family:  sport
// Idea:    A ten-pin lane seen from behind the bowler, foul line to pinsetter, where a hooking ball rolls up through the oil over its reflection, scatters the pins and the sweep clears them for the next rack, under house lights or blacklight.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 22, after cosmic bowling on ten-pin lanes with ball-tracking lane lights
// Round:   22
// ===============================
// @matrix 64x128
// @knobs Ball=0..1, Speed=0.2..3, Hook=0..1, Lights=0..1
//
// Knob 1: Ball. The colour of the ball, which the lane lights and the projected trail follow: cyan at 0, round through blue, pink, red, orange and green.
// Knob 2: Speed. How fast everything goes: at 2 the ball takes about 2.5 s from the foul line to the pins.
// Knob 3: Hook. How far the oil runs and how much the ball curves: at 0 the oil runs 46 ft and a straight ball hits the head pin on the nose and leaves pins. Near 0.6 it hooks into the pocket and strikes; at 1 the oil stops at 30 ft and it crosses to the Brooklyn side.
// Knob 4: Lights. Cosmic bowling at 0, the pins, arrows and oil glowing under blacklight, up to the full house lights on the wood at 1.
// Buttons: K1 tap throws the next ball now.

const W = 64;
const H = 128;
const N = W * H;
const CX = 31.5;
const { min, max, floor, ceil, round, sin, cos, abs, sqrt, exp, atan2, sign, hypot, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function hsv(h, s, v) {
  h = (((h % 1) + 1) % 1) * 6;
  const k = (n) => v * (1 - s * cl(min((n + h) % 6, 4 - ((n + h) % 6)), 0, 1));
  return [k(5), k(3), k(1)];
}

// d is feet past the foul line, x inches from the middle board. The lane
// narrows in perspective; the pin deck is drawn nearer, 4.7 rows a foot.
const Z0 = 255.8;
const sc = (d) => 246.6 / (d + Z0);
const RD = 4.7;
const D0 = -16;
const NT = 1312;
const YT = new Float32Array(NT + 1);
{
  const ramp = (d) => sm(57, 59.5, d);
  let i1 = 0;
  let i2 = 0;
  for (let k = 0; k < 960; k++) {
    const d = (k + 0.5) / 16;
    i1 += (1 - ramp(d)) / (d + Z0) ** 2 / 16;
    i2 += ramp(d) / 16;
  }
  // Foul line on row 106, head pin on row 36.
  const G = (70 - RD * i2) / i1;
  const rate = (d) => (G / (d + Z0) ** 2) * (1 - ramp(d)) + RD * ramp(d);
  YT[1216] = 36;
  for (let i = 1216; i < NT; i++) YT[i + 1] = YT[i] - rate(D0 + (i + 0.5) / 16) / 16;
  for (let i = 1216; i > 0; i--) YT[i - 1] = YT[i] + rate(D0 + (i - 0.5) / 16) / 16;
}
const rowOf = (d) => {
  const f = cl((d - D0) * 16, 0, NT - 0.001);
  const i = f | 0;
  return YT[i] + (YT[i + 1] - YT[i]) * (f - i);
};
const DR = new Float32Array(H);
for (let y = 0, i = NT; y < H; y++) {
  while (i > 0 && YT[i] < y) i--;
  DR[y] = i >= NT ? 66 : D0 + (i + (YT[i] - y) / (YT[i] - YT[i + 1])) / 16;
}
// The pit edge and the row under the masking unit.
const PIT = round(rowOf(62.85));
const MB = 11;
const proj = (x, d, h) => {
  const s = sc(d);
  return [CX + x * s, rowOf(d) - h * 0.85 * s, s];
};
const SPOT = [];
for (let r = 0; r < 4; r++) for (let i = 0; i <= r; i++) SPOT.push([(i - r / 2) * 12, r * 10.392]);
const bx = (b) => 20.75 - (b - 0.5) * 1.064;
const DOTS = [3, 5, 8, 11, 14, 26, 29, 32, 35, 37];
// Pin radius in inches, base to crown.
const PROF = [1.0, 1.7, 2.38, 2.15, 1.6, 1.0, 0.92, 1.2, 1.15, 0.6];
const HOLES = [[-0.3, 0.5, 0.81], [0.3, 0.5, 0.81], [0, -0.4, 0.92]];
// Maple approach, maple heads, pine, maple pin deck.
const WOOD = [[234, 178, 112], [228, 168, 100], [212, 134, 68], [238, 188, 124]];
const OILC = [0.4, 0.7, 1.4];
const SEG = [0.45, 0.55, 0.8, 0.6, 0.6, 0.45];

// The still picture: house light colour A, blacklight glow F, wash share WM.
function paint(P) {
  const A = (P.A = new Float32Array(N * 3)), F = (P.F = new Float32Array(N * 3)), WM = (P.WM = new Float32Array(N));
  const put = (x, y, a, f, wm = WM[y * W + x]) => {
    if (x < 0 || x >= W || y < MB || y >= H) return;
    const o = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) {
      A[o + c] = a[c];
      F[o + c] = f[c];
    }
    WM[y * W + x] = wm;
  };
  for (let y = MB; y < H; y++) {
    const d = DR[y], s = sc(d);
    const lit = d < 57 ? 0.9 + 0.08 * cos((2 * PI * (d + 3)) / 15) : 1.12;
    const oil = sm(44, 36, d) * (d > 0 ? 1 : 0);
    for (let x = 0; x < W; x++) {
      const X = (x - CX) / s, ax = abs(X);
      if (y < PIT || (d > 57 && ax > 30.5)) {
        // Kickbacks and the pit curtain.
        const k = (x * 2 + y) % 11;
        if (ax > 30.5) put(x, y, k < 2 ? [70, 70, 80] : [28, 28, 34], k < 1 ? [200, 30, 150] : k < 2 ? [60, 20, 140] : [14, 6, 34], 0);
        else put(x, y, [10, 10, 12], [6, 3, 16], 0);
      } else if (ax <= 20.75 || ax > 43.75 || (d < 0 && (ax <= 30 || ax > 34.5))) {
        const far = ax > 43.75, lx = far ? ax - 64.5 : X, a = [0, 0, 0];
        let tone = 0;
        for (const e of [-0.25, 0.25]) {
          const k = floor((20.75 - lx - e / s) / 1.064);
          const kind = d < 0 ? 0 : d < 15.2 + (k & 3) * 0.7 ? 1 : d < 56 + (k % 3) * 0.6 ? 2 : 3;
          const t = 0.88 + 0.14 * hash(k + 40, kind) + 0.06 * (hash(k + 40, floor(d * 2.5) + 99) - 0.5);
          for (let c = 0; c < 3; c++) a[c] += WOOD[kind][c] * t * (far ? 0.7 : 1) * lit * 0.5;
          tone += t / 2;
        }
        // Ceiling lights mirrored in the oil.
        const glare = far ? 0 : 70 * oil * (exp(-(((X - 9) / 3.5) ** 2)) + exp(-(((X + 9) / 3.5) ** 2))) * (0.5 + 0.5 * cos((2 * PI * d) / 15)) ** 2;
        const u = (far ? 0.7 : 1) * (d < 0 ? 0.8 : 1) * tone;
        let f = [22 * u, 8 * u, 46 * u];
        if (!far && d > 2 && d < 55 && hash(x, y * 7 + 3) < 0.014) f = hsv(hash(y, x), 0.7, 180);
        put(x, y, a.map((v) => v + glare), f, far ? 0.4 : 1);
      } else if (ax <= 30 || ax > 34.5) {
        const g = ((ax <= 30 ? ax - 25.375 : ax - 39.125) / 4.625) ** 2, v = (0.4 + 0.6 * g) * lit;
        put(x, y, [70 * v, 72 * v, 84 * v], g > 0.75 ? [30, 12, 80] : [8, 4, 22], 0.5);
      } else put(x, y, [50 * lit, 38 * lit, 32 * lit], [10, 5, 20], 0);
    }
  }
  for (let x = 0; x < W; x++) {
    const ax = abs((x - CX) / sc(0));
    if (ax <= 30 || ax > 34.5) put(x, round(rowOf(0)), [16, 16, 18], [255, 30, 90]);
  }
  // Foul line, arrows, dots, range finders and pin spots.
  for (let b = 5; b <= 35; b += 5) {
    const dt = 16 - abs(20 - b) * 0.267, ty = round(rowOf(dt)), ax = round(CX + bx(b) * sc(dt));
    for (let j = 0; j < 4; j++) for (let i = -(j >> 1); i <= j >> 1; i++) put(ax + i, ty + j, [96, 34, 22], [255, 120, 24]);
  }
  for (const b of DOTS) put(round(CX + bx(b) * sc(7)), round(rowOf(7)), [96, 40, 26], [80, 255, 110]);
  for (const b of [...DOTS, 20]) put(round(CX + bx(b) * sc(-12)), round(rowOf(-12)), [90, 50, 30], [70, 220, 100]);
  for (let y = round(rowOf(40)); y <= round(rowOf(34)); y++) for (const b of [10, 30]) put(round(CX + bx(b) * sc(DR[y])), y, [100, 46, 30], [40, 190, 255]);
  for (const [X, Z] of SPOT) put(round(CX + X * sc(60 + Z / 12)), round(rowOf(60 + Z / 12)), [70, 46, 30], [60, 40, 130]);
}

const rack = (h) => SPOT.map(([X, Z]) => ({ X, Z, vx: 0, vz: 0, th: 0, om: 0, ph: 0, w: 0, h, vh: 0, st: h ? 4 : 0 }));

export function setup(params) {
  paint(params);
  Object.assign(params, {
    buf: new Float32Array(N * 3),
    tx: new Float32Array(H),
    tt: new Float32Array(H).fill(-99),
    t: 0, ph: 0, tm: 1.5, first: true, ball: 1, full: true, fl: 0, mark: 0, seg: -1, pins: rack(0), B: null,
    ra: 0, ax: [-1, 0, 0], hs: 46, zs: -9, pt: 0, path: [0, 0, 0, 0, 40], bd: -13, bh: 0, bt: 0,
    m: 1, hook: 0, oil: 46, Hh: 0.1, U: 1, c1: [0, 1, 1], c2: [0, 0, 1],
  });
}

const pathX = (P, d) => {
  const [x0, xb, sb, a, db] = P.path;
  return d < db ? x0 + sb * d : xb + sb * (d - db) - (a * (d - db) ** 2) / 2;
};
const pathS = (P, d) => (d < P.path[4] ? P.path[2] : P.path[2] - P.path[3] * (d - P.path[4]));

// Out toward the gutter until the oil thins, then the hook back. A spare ball
// moves the whole line onto the standing pins.
function throwBall(P) {
  const h = P.hook, db = P.oil - 6, e = 60 - db;
  let x60 = (h < 0.55 ? 0.4 + (2.3 * h) / 0.55 : 2.7 - (4.7 * (h - 0.55)) / 0.45) + (rnd() - 0.5) * 1.6;
  let x0 = 12 - 24 * h;
  const xs = x0 + ((x60 - x0) * db) / 60;
  let xb = xs + (16 - xs) * min(1, h * 1.4);
  const line = () => {
    const sb = (xb - x0) / db;
    return [sb, ((xb + e * sb - x60) * 2) / (e * e)];
  };
  const up = P.pins.filter((p) => p.st === 0);
  if (P.ball === 2 && up.length) {
    const z = min(...up.map((p) => p.Z)), front = up.filter((p) => p.Z < z + 11), [sb, a] = line();
    const shift = front.reduce((s, p) => s + p.X, 0) / front.length - x60 - ((sb - a * e) * z) / 12 + (rnd() - 0.5) * 2;
    x0 += shift;
    xb += shift;
    x60 += shift;
  }
  x0 = cl(x0, -17, 17);
  xb = cl(xb, -17, 17);
  P.path = [x0, xb, ...line(), db];
  Object.assign(P, { ph: 1, bt: 0, bd: -13, ra: 0 });
  const b = 0.9 * h;
  const k = [-cos(b), 0.3 * sin(b), sin(b)];
  P.ax = k.map((v) => v / hypot(...k));
}

// The swing brings the ball in from below the panel, then it rolls.
function roll(P, h) {
  P.bt += h;
  const y0 = rowOf(P.bd), v = 25 - 0.07 * P.bd;
  if (P.bt < 0.45) {
    P.bd = -13 + 30 * P.bt;
    P.bh = 10 * (1 - P.bt / 0.45) ** 2;
  } else {
    P.bd += v * h;
    P.bh = 0;
    P.ra += v * 0.36 * h;
  }
  const d = P.bd, x = CX + pathX(P, max(0, d)) * sc(d);
  for (let y = max(0, round(rowOf(d))); y <= round(y0) && y < H; y++) {
    P.tx[y] = x;
    P.tt[y] = P.t;
  }
  if (d >= 58.6) {
    P.B = { X: pathX(P, d), Z: (d - 60) * 12, vx: pathS(P, d) * v, vz: 12 * v, h: 0, vh: 0, st: -1 };
    P.ph = 2;
    P.pt = 0;
  }
}

function pts(p) {
  if (p.th < 0.35) return [[p.X, p.Z, 0.5]];
  const L = 15 * sin(p.th);
  return [0.12, 0.5, 0.88].map((f) => [p.X + cos(p.ph) * L * f, p.Z + sin(p.ph) * L * f, f]);
}

function kick(p, dvx, dvz, f) {
  p.vx += dvx;
  p.vz += dvz;
  if (p.st < 0) return;
  const dv = sqrt(dvx * dvx + dvz * dvz);
  if (p.st === 0) {
    if (p.th < 0.05) p.ph = atan2(dvz, dvx);
    p.om += dv / 7;
    if (dv > 130) Object.assign(p, { vh: dv * 0.28, om: dv / 7 + 5, st: 1, th: max(p.th, 0.05) });
  } else p.w += (15 * sin(p.th) * (f - 0.5) * (cos(p.ph) * dvz - sin(p.ph) * dvx)) / 70;
}

// Ball and pins are discs on the deck; pins rock, topple past 11 degrees, fly
// when hit hard and spin off the kickbacks.
function collide(P) {
  const bodies = [];
  if (P.B && P.B.h > -3) bodies.push([P.B, 15, 4.3, [[P.B.X, P.B.Z, 0.5]]]);
  for (const p of P.pins) if (p.st < 2 && p.h < 14) bodies.push([p, 3.5, 2.4, pts(p)]);
  for (let i = 0; i < bodies.length; i++) {
    const [a, ma, ra, pa] = bodies[i];
    for (const [qx] of pa) {
      const sg = sign(qx), lim = 30.5 - ra;
      if (abs(qx) > lim) {
        a.X -= qx - sg * lim;
        if (a.vx * sg > 0) a.vx *= -0.5;
      }
    }
    for (let j = i + 1; j < bodies.length; j++) {
      const [b, mb, rb, pb] = bodies[j];
      const R = ra + rb, ia = 1 / ma, ib = 1 / mb;
      for (const qa of pa)
        for (const qb of pb) {
          const dx = qb[0] - qa[0], dz = qb[1] - qa[1], dd = dx * dx + dz * dz;
          if (dd >= R * R || dd < 1e-6) continue;
          const D = sqrt(dd), nx = dx / D, nz = dz / D, pen = (R - D) / (ia + ib);
          a.X -= nx * pen * ia;
          a.Z -= nz * pen * ia;
          b.X += nx * pen * ib;
          b.Z += nz * pen * ib;
          const vn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
          if (vn >= 0) continue;
          const J = (-1.5 * vn) / (ia + ib);
          kick(a, -J * nx * ia, -J * nz * ia, qa[2]);
          kick(b, J * nx * ib, J * nz * ib, qb[2]);
        }
    }
  }
}

function move(P, dt) {
  const B = P.B;
  if (B) {
    B.X += B.vx * dt;
    B.Z += B.vz * dt;
    P.ra += B.vz * 0.03 * dt;
    if (B.Z > 34.2) {
      B.vh -= 386 * dt;
      B.h += B.vh * dt;
      if (B.Z > 44) B.vz = 0;
    }
  }
  for (const p of P.pins) {
    if (p.st >= 3) continue;
    if (p.st === 2 || p.h > 0 || p.vh > 0) {
      p.vh -= 386 * dt;
      p.h += p.vh * dt;
      p.th += p.om * dt;
      if (p.st === 2) {
        if (p.Z > 46) p.vz = 0;
        if (p.h < -40) p.st = 3;
      } else if (p.h <= 0) {
        if (sin(p.th) < 0) p.ph += PI;
        Object.assign(p, { h: 0, vh: p.vh < -80 ? -p.vh * 0.3 : 0, th: PI / 2, om: 0, st: 1 });
      }
    } else if (p.st === 0) {
      if (p.th > 0 || p.om > 0) {
        p.om += 60 * sin(p.th - 0.2) * dt;
        p.th += p.om * dt;
        if (p.th < 0) {
          p.th = -p.th;
          p.om *= -0.4;
          p.ph += PI;
          if (abs(p.om) < 0.3) p.th = p.om = 0;
        }
        if (p.th > 0.2) p.st = 1;
      }
    } else if (p.th < PI / 2) {
      p.om += 64 * sin(p.th) * dt;
      p.th += p.om * dt;
      if (p.th >= PI / 2) {
        p.th = PI / 2;
        p.om = 0;
      }
    }
    if (p.st < 2 && p.h <= 0) {
      const v = hypot(p.vx, p.vz), dec = (p.st ? 110 : 400) * dt, k = v > dec ? (v - dec) / v : 0;
      p.vx *= k;
      p.vz *= k;
      p.w *= exp(-2.5 * dt);
    }
    p.X += p.vx * dt;
    p.Z += p.vz * dt;
    p.ph += p.w * dt;
    if (p.st < 2 && p.h < 8 && p.Z + 7.5 * sin(p.th) * sin(p.ph) > 34.2) p.st = 2;
  }
}

function physics(P, h) {
  for (let s = 0, n = ceil(h / 0.004); s < n; s++) {
    move(P, h / n);
    collide(P);
  }
}

function endPins(P) {
  const up = P.pins.filter((p) => p.st === 0).length;
  if (!up) {
    P.fl = P.ball === 1 ? 1 : 0.8;
    P.mark = P.ball;
  }
  Object.assign(P, { full: !up || P.ball === 2, ph: 3, tm: 0, seg: -1, B: null });
}

// Sweep drops, table lifts standing pins, sweep rakes the deadwood into the
// pit and returns, table sets the pins or a new rack, sweep lifts.
function sweep(P, h) {
  let u = (P.tm += h), k = 0;
  while (k < 6 && u > SEG[k]) u -= SEG[k++];
  if (k >= 6) return Object.assign(P, { ph: 0, tm: 0.7, ball: P.full ? 1 : 2, hs: 46 });
  const e = sm(0, 1, u / SEG[k]);
  if (k !== P.seg) {
    P.seg = k;
    if (k === 4 && P.full) P.pins = rack(46);
    if (k === 5) for (const p of P.pins) if (p.st === 4) p.st = p.h = 0;
  }
  if (k === 0) P.hs = 46 - 45 * e;
  else if (k === 1) {
    if (!P.full) for (const p of P.pins) if (p.st === 0 || p.st === 4) Object.assign(p, { st: 4, h: 46 * e, th: 0, om: 0, vx: 0, vz: 0 });
  } else if (k === 2) {
    P.zs = -9 + 47 * e;
    for (const p of P.pins)
      if (p.st < 2 && p.h < 12 && p.Z < P.zs + 3) {
        p.Z = P.zs + 3;
        p.vz = max(p.vz, 0);
        if (p.st === 0) Object.assign(p, { st: 1, th: 1.3, ph: PI / 2 });
      }
  } else if (k === 3) P.zs = 38 - 47 * e;
  else if (k === 4) {
    for (const p of P.pins) if (p.st === 4) p.h = 46 * (1 - e);
  } else P.hs = 1 + 45 * e;
}

function throwNow(P) {
  if (P.ph === 1) return;
  if (P.ph >= 2) {
    if (P.ph === 2) endPins(P);
    P.pins = P.full ? rack(0) : P.pins.filter((p) => p.st === 0 || p.st === 4).map((p) => Object.assign(p, { st: 0, h: 0, th: 0, om: 0 }));
    Object.assign(P, { ball: P.full ? 1 : 2, hs: 46, B: null });
  }
  throwBall(P);
}

function step(P, h) {
  P.t += h;
  P.fl = max(0, P.fl - h * 0.5);
  let ph = h;
  if (P.ph === 0) {
    // The first ball goes at 1.5 s at any speed.
    if ((P.tm -= P.first ? h / P.m : h) <= 0) {
      P.first = false;
      throwBall(P);
    }
  } else if (P.ph === 1) roll(P, h);
  else if (P.ph === 2) {
    // Pin action in slow motion at first.
    ph = h * (0.45 + 0.55 * sm(0.5, 1, P.pt));
    P.pt += ph;
    if (P.pt > 1.6) endPins(P);
  } else sweep(P, h);
  physics(P, ph);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  P.c1 = hsv(0.52 + k[0], 0.9, 1);
  P.c2 = hsv(0.66 + k[0], 0.7, 1);
  P.m = cl(k[1], 0.2, 3) / 2;
  P.hook = cl(k[2], 0, 1);
  P.oil = 46 - 16 * P.hook;
  const L = cl(k[3], 0, 1);
  P.Hh = 0.1 + 0.9 * L * L;
  P.U = 1 - L;
  if (input.btnPressed && input.btnPressed[0]) throwNow(P);
  step(P, cl(dt, 0, 0.1) * P.m);
}

function add(buf, x, y, c, v) {
  if (x < 0 || x >= W || y < MB || y >= H) return;
  const o = (y * W + x) * 3;
  for (let i = 0; i < 3; i++) buf[o + i] += c[i] * v;
}
function blend(buf, x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < MB || y >= H) return;
  const o = (y * W + x) * 3;
  [r, g, b].forEach((v, i) => (buf[o + i] += (v - buf[o + i]) * a));
}

// Capping lights that chase, follow the ball and light the gutters, and the
// projected trail.
function lights(P) {
  const { buf, c1, t, U, fl, tx, tt } = P;
  const db = P.ph === 1 ? P.bd : P.ph === 2 ? 70 : -99;
  for (let y = round(rowOf(57)); y < H; y++) {
    const d = DR[y], s = sc(d);
    let v = 0.16 + 0.34 * max(0, sin(2 * PI * (d / 9 - t * 0.55))) ** 6;
    if (db > -50) v += d < db ? 0.9 * exp((d - db) / 7) : exp(-(d - db) * 1.5);
    v = (v + fl * (0.5 + 0.5 * sin(d * 0.7 - t * 14))) * 200 * (0.45 + 0.55 * U);
    for (const sg of [-1, 1]) {
      const xs = CX + sg * 32.25 * s, x = floor(xs), f = xs - x;
      [0.2, 1 - f * 0.8, 0.2 + f * 0.8, 0.2].forEach((k, i) => add(buf, x + i - 1, y, c1, v * k));
      if (d > 0) for (let X = 21; X < 30; X += 1 / s) add(buf, round(CX + sg * X * s), y, c1, v * 0.4 * ((X - 20.75) / 9.25) ** 1.5);
    }
    const age = t - tt[y];
    if (age < 4) {
      const I = min(1, age * 8) * exp(-age / 1.2) * 140 * U, w = 4.3 * s + 0.8;
      for (let x = max(0, floor(tx[y] - w)); x <= min(W - 1, tx[y] + w); x++) {
        const f = 1 - ((x - tx[y]) / w) ** 2;
        if (f > 0) add(buf, x, y, c1, I * f);
      }
    }
  }
}

// Marbled shell and holes turning with the roll.
function drawBall(P, cx, cy, r, alpha, mirror, clip) {
  const { buf, c1, c2, Hh, U } = P;
  const [k0, k1, k2] = P.ax, ca = cos(P.ra), sa = sin(P.ra);
  for (let y = floor(cy - r - 1); y <= cy + r + 1 && y < clip; y++)
    for (let x = floor(cx - r - 1); x <= cx + r + 1; x++) {
      const u = (x - cx) / r, v = (y - cy) / r, q = u * u + v * v;
      const cov = cl((1 - sqrt(q)) * r + 0.5, 0, 1);
      if (cov <= 0) continue;
      const nz = sqrt(max(0, 1 - q)), ny = mirror ? v : -v;
      const kd = (k0 * u + k1 * ny + k2 * nz) * (1 - ca);
      const X = u * ca + (k1 * nz - k2 * ny) * sa + k0 * kd;
      const Y = ny * ca + (k2 * u - k0 * nz) * sa + k1 * kd;
      const Z = nz * ca + (k0 * ny - k1 * u) * sa + k2 * kd;
      const sw = (0.5 + 0.5 * sin(3.2 * X + 2.4 * sin(2.6 * Y + 1.8 * Z) + 2 * Z * X)) ** 2;
      let hole = 1;
      for (const [hx, hy, hz] of HOLES) if (hx * X + hy * Y + hz * Z > 0.972) hole = 0.12;
      const lit = (0.25 + 0.75 * max(0, -0.35 * u + 0.6 * ny + 0.72 * nz)) * Hh * 1.15 + U * (0.45 + 0.6 * nz);
      const sp = mirror ? 0 : 230 * Hh * max(0, -0.2 * u + 0.5 * ny + 0.84 * nz) ** 24;
      const col = [0, 1, 2].map((c) => (c1[c] * (1 - sw) * 0.9 + c2[c] * sw) * 255 * lit * hole + sp);
      blend(buf, x, y, col[0], col[1], col[2], cov * (mirror ? alpha * max(0, 1 - (y - cy + r) / (2 * r)) : alpha));
    }
}

// A pin's profile swept from base to crown, tilted by th toward ph.
function drawPin(P, p) {
  const { buf, Hh, U } = P;
  const [x0, y0, s] = proj(p.X, 60 + p.Z / 12, p.h - (abs(p.X) > 21 && p.st === 1 ? 2.5 : 0));
  const hx = cos(p.ph) * 15 * sin(p.th) * s;
  const hy = (-sin(p.ph) * 15 * sin(p.th) * RD) / 12 - 15 * cos(p.th) * 0.85 * s;
  const L2 = hx * hx + hy * hy, clip = p.Z > 34.2 ? PIT : H;
  for (let y = floor(min(y0, y0 + hy) - 3); y <= max(y0, y0 + hy) + 3 && y < clip; y++)
    for (let x = floor(min(x0, x0 + hx) - 3); x <= max(x0, x0 + hx) + 3; x++) {
      const px = x - x0, py = y - y0;
      const t = L2 > 0.01 ? cl((px * hx + py * hy) / L2, 0, 1) : 0;
      const ex = px - t * hx, ey = py - t * hy, f = t * 9, i = min(8, f | 0);
      const rw = (PROF[i] + (PROF[i + 1] - PROF[i]) * (f - i)) * s;
      const cov = cl(rw - sqrt(ex * ex + ey * ey) + 0.5, 0, 1);
      if (cov <= 0) continue;
      const lit = (0.82 - (0.18 * ex) / (rw + 0.3)) * Hh;
      if (t > 0.6 && t < 0.73) blend(buf, x, y, 215 * Hh + 255 * U, 30 * Hh + 40 * U, 40 * Hh + 150 * U, cov);
      else blend(buf, x, y, 240 * lit + 180 * U, 240 * lit + 192 * U, 234 * lit + 255 * U, cov);
    }
}

function drawSweep(P) {
  const { buf, Hh, U, hs, zs } = P;
  const [xl, yb, s] = proj(-31, 60 + zs / 12, hs);
  const th = 3.4 * s;
  for (let y = floor(yb - th); y <= yb; y++)
    for (let x = round(xl); x <= round(2 * CX - xl); x++) {
      const top = y < yb - th + 1 ? 60 : 0;
      const hz = ((x + 64) >> 1) % 3 === 0;
      blend(buf, x, y, (140 + top) * Hh + (hz ? 255 : 40) * U, (142 + top) * Hh + (hz ? 210 : 20) * U, (152 + top) * Hh + (hz ? 40 : 70) * U, 1);
    }
  for (const x of [round(CX - 29.5 * s), round(CX + 29.5 * s)]) for (let y = MB; y < yb - th; y++) blend(buf, x, y, 80 * Hh + 50 * U, 80 * Hh + 30 * U, 92 * Hh + 120 * U, 1);
}

// The masking unit, with the blacklight tube along its lip.
function hood(P) {
  const { buf, Hh, U, c1, c2, fl, t } = P;
  for (let y = 0; y < MB; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, wy = 4.4 + 2.4 * sin(x * 0.11 + 0.8), b1 = max(0, 1 - abs(y - wy));
      const b2 = max(0, 1 - abs(y - wy - 2.5) * 1.3) * sm(4, 14, x), pulse = 0.55 + 0.45 * sin(x * 0.35 - t * 5);
      const tw = hash(x, y) < 0.07 ? (0.5 + 0.5 * sin(t * 4 + hash(y, x) * 40)) * 150 * U : 0;
      const fx = fl > 0 ? hsv(x / 40 - t * 2, 1, fl * 200) : [0, 0, 0];
      for (let c = 0; c < 3; c++)
        buf[o + c] =
          y === MB - 1
            ? 150 * Hh + [110, 50, 255][c] * U
            : [20, 30, 88][c] * Hh * (0.85 + y * 0.03) + [12, 4, 30][c] * U + b1 * ([190, 220, 255][c] * Hh + c1[c] * 255 * U * pulse) + b2 * ([255, 140, 40][c] * Hh + c2[c] * 230 * U) + tw + fx[c];
    }
  // X for a strike, a slash for a spare.
  if (fl > 0.05)
    for (let j = -3; j <= 3; j++)
      for (const i of P.mark === 1 ? [j, -j] : [-j]) {
        const o = ((5 + j) * W + 32 + i) * 3;
        for (let c = 0; c < 3; c++) buf[o + c] = 255 * min(1, fl * 2);
      }
}

export function draw(display, params) {
  const P = params;
  const { buf, A, F, WM, Hh, U, c1 } = P;
  // The lane lights wash the boards in slow waves; the oil glows.
  for (let y = MB; y < H; y++) {
    const d = DR[y], s = sc(d), wave = 16 + 9 * sin(2 * PI * (d / 14 - P.t * 0.5));
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 3, wm = WM[i] * wave * U;
      const ax = abs(x - CX) / s;
      const oil = WM[i] === 1 && d > 0 ? sm(P.oil + 3, P.oil - 4, d + ax * 0.2) * (64 - ax * ax * 0.08) * U : 0;
      for (let c = 0; c < 3; c++) buf[o + c] = A[o + c] * Hh + F[o + c] * U + c1[c] * wm + oil * OILC[c];
    }
  }
  lights(P);
  let ball = null;
  if (P.ph === 1) ball = [pathX(P, max(0, P.bd)), P.bd, P.bh, H];
  else if (P.B && P.B.h > -14) ball = [P.B.X, 60 + P.B.Z / 12, P.B.h, P.B.Z > 34.2 ? PIT : H];
  let bs = null;
  if (ball) {
    const [x, d, h, clip] = ball;
    const [cx, cy, s] = proj(x, d, 4.3 + h), fy = rowOf(d), r = 4.3 * s, R = r * 3.4;
    bs = [cx, cy, r, clip, d];
    // Halo, shadow, reflection.
    for (let y = floor(cy - R); y <= cy + R && y < clip; y++)
      for (let x2 = floor(cx - R); x2 <= cx + R; x2++) {
        const q = 1 - hypot(x2 - cx, (y - cy) * 1.2) / R;
        if (q > 0) add(buf, x2, y, c1, q * q * 110 * U);
        const e = ((x2 - cx) / (r * 1.1)) ** 2 + ((y - fy) / (r * 0.45)) ** 2;
        if (e < 1 && clip === H && y >= MB && y < H && x2 >= 0 && x2 < W)
          for (let c = 0; c < 3; c++) buf[(y * W + x2) * 3 + c] *= 1 - 0.55 * Hh * (1 - e) * exp(-h / 6);
      }
    if (d > 0 && d < P.oil + 2) drawBall(P, cx, 2 * fy - cy + h * 1.7 * s, r, 0.15 + 0.4 * sm(P.oil + 2, P.oil - 8, d), true, H);
  }
  // Deck objects far to near.
  const items = P.pins.filter((p) => p.st < 3).map((p) => [p.Z + (p.st === 1 ? 7 * sin(p.ph) : 0), p]);
  if (P.hs < 45) items.push([P.zs - 0.5, 0]);
  if (bs && bs[4] > 57) items.push([(bs[4] - 60) * 12, 1]);
  items.sort((a, b) => b[0] - a[0]);
  for (const [, it] of items) {
    if (it === 0) drawSweep(P);
    else if (it === 1) drawBall(P, bs[0], bs[1], bs[2], 1, false, bs[3]);
    else drawPin(P, it);
  }
  if (bs && bs[4] <= 57) drawBall(P, bs[0], bs[1], bs[2], 1, false, bs[3]);
  hood(P);
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p % W, (p / W) | 0, min(255, buf[o]), min(255, buf[o + 1]), min(255, buf[o + 2]));
}
