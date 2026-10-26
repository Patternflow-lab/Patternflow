// ===== Patternflow pattern =====
// Title:   Creaking Door
// Family:  halloween
// Idea:    A door at the end of a purple-dark hallway creaks open in lurches and candlelight from the room behind spills out as a widening wedge across the floorboards and up the left wall, dust glittering in it, while the shadow of a long-fingered hand, or of someone in a pointed hat, reaches across the light from somewhere out of sight; then the door slams with a jolt that shakes the panel and brings dust down from the lintel, and in the dark two feet cross the line of light under the door before it begins again.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 52
// Round:   52
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Reach=0..1, Haze=0..1
//
// Knob 1: Hue. The colour of the light in the room. At 0 a candle's, deep red where it is faint and pale gold where it is strong, orange between. At 0.33 toxic green turning towards cyan where it is strong, at 0.67 blue turning violet. The hallway's purple stays.
// Knob 2: Speed. At 2 a round lasts 10 to 11.5 seconds: the door lurches open over 3.4 to 4.8 s to between 54 and 69 degrees, the shadow comes 2.2 to 2.8 s in and stays 4 s, the door slams 6.2 to 7 s in, shut in 0.14 s, and the dark lasts 3.6 to 4.2 s. The first round starts with the door already ajar. At 1 everything takes twice as long, at 0.2 ten times.
// Knob 3: Reach. How far the candle's light carries before it falls to half: 0.9 m (30 LEDs across at the door) at 0, 2.3 m at 1. At 0 the boards near the eye stay deep red and the hallway outside the wedge stays purple; at 1 the wedge burns orange down to the bottom of the panel and the left wall glows gold.
// Knob 4: Haze. Dust in the air. At 0 the light shows only where it lands, with a few motes; at the opening 0.06 a faint glow over the wedge and 140 motes glittering in it; at 1 the beam stands in the air as a glowing wedge with the shadow cut through it.
// Buttons: K1 tap slams the door while it is opening or open; while it is shut, a tap opens it again.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, sqrt, sin, cos, exp, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vn = (x, sd) => {
  const i = floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return (hash(i * 7919 + sd) * (1 - u) + hash((i + 1) * 7919 + sd) * u) * 2 - 1;
};

// World in metres: x to the right, y up, z away from the eye. The eye stands
// EYE above the floor and ZC in front of the far wall (z = 0). F is the focal
// length in LEDs, and the horizon sits on row CY.
const EYE = 1.2, ZC = 3, F = 100, CX = 32, CY = 42;
// The hallway is 2 HW wide under a ceiling HC high. The doorway in the far
// wall is 2 DW wide and DH high inside a trim TRIM wide, with a gap GAP
// under the door.
const HW = 0.6, HC = 2.4, DW = 0.45, DH = 2, TRIM = 0.07, GAP = 0.02;
// The room behind is 2 RW wide, RD deep and RH high. The candle stands in it
// at (LX, LY, LZ), round the corner to the right where the eye cannot see it.
const RW = 1.4, RD = 2.6, RH = 2.5, LX = 0.75, LY = 0.85, LZ = 1.4;
// Light strength, and its strength on the room's own walls.
const LI = 8, RI = 2;
// Kinds of LED.
const CEIL = 0, WALL = 1, TRM = 2, LEFT = 3, RIGHT = 4, FLOOR = 5, DOOR = 6;
const NRM = [[0, -1, 0], [0, 0, -1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0]];

function setup0(S) {
  const g = (S.geo = {
    kind: new Uint8Array(N), P: new Float32Array(N * 3), amb: new Float32Array(N * 3), alb: new Float32Array(N),
    d: new Float32Array(N * 2), R: new Float32Array(N * 3), rn: new Float32Array(N * 3), ramb: new Float32Array(N * 3), tz: new Float32Array(N),
  });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, dx = (x + 0.5 - CX) / F, dy = -(y + 0.5 - CY) / F;
      // The nearest of the hallway's six faces along the ray from the eye.
      let t = ZC, k = WALL;
      if (dy < 0 && -EYE / dy < t) (t = -EYE / dy), (k = FLOOR);
      if (dy > 0 && (HC - EYE) / dy < t) (t = (HC - EYE) / dy), (k = CEIL);
      if (dx < 0 && -HW / dx < t) (t = -HW / dx), (k = LEFT);
      if (dx > 0 && HW / dx < t) (t = HW / dx), (k = RIGHT);
      const X = dx * t, Y = EYE + dy * t, Z = -ZC + t;
      if (k === WALL && abs(X) < DW && Y < DH) k = DOOR;
      else if (k === WALL && abs(X) < DW + TRIM && Y < DH + TRIM) k = TRM;
      g.kind[p] = k;
      g.P[p * 3] = X;
      g.P[p * 3 + 1] = Y;
      g.P[p * 3 + 2] = Z;
      g.d[p * 2] = dx;
      g.d[p * 2 + 1] = dy;
      g.tz[p] = Z;
      let r = 0, gg = 0, b = 0, a = 1;
      if (k === FLOOR) {
        // Boards 0.12 wide running away from the eye.
        const bi = floor((X + 3) / 0.12), u = (X + 3) / 0.12 - bi;
        const seam = u < 0.14 ? 0.55 : 1, tone = 0.85 + 0.3 * hash(bi * 13);
        r = 26 * seam * tone;
        gg = 11 * seam * tone;
        b = 30 * seam * tone;
        a = 0.85 * seam * tone;
      } else if (k === CEIL) (r = 14), (gg = 6), (b = 22), (a = 0.8);
      else if (k === TRM) (r = 54), (gg = 30), (b = 58), (a = 1);
      else {
        // Wallpaper in stripes above the dado rail, panelling below it.
        const u = k === WALL ? X : Z, st = 0.5 + 0.5 * cos(u * 2 * PI * 7), lo = Y < 0.9, rail = abs(Y - 0.9) < 0.03 || Y < 0.1;
        const f = rail ? 1.12 : lo ? 0.8 : 0.85 + 0.25 * st;
        r = 36 * f;
        gg = 14 * f;
        b = 50 * f;
        a = f;
      }
      g.amb[p * 3] = r;
      g.amb[p * 3 + 1] = gg;
      g.amb[p * 3 + 2] = b;
      g.alb[p] = a;
      if (k === DOOR) {
        // Where the ray lands in the room if the door is not in the way.
        let tr = 1e9, kk = 0;
        const c = [[0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0], [0, 0, -1]];
        const ts = [dy > 0 ? (RH - EYE) / dy : 1e9, dy < 0 ? -EYE / dy : 1e9, dx > 0 ? RW / dx : 1e9, dx < 0 ? -RW / dx : 1e9, ZC + RD];
        for (let i = 0; i < 5; i++) if (ts[i] > ZC && ts[i] < tr) (tr = ts[i]), (kk = i);
        const RX = dx * tr, RY = EYE + dy * tr, RZ = -ZC + tr;
        g.R[p * 3] = RX;
        g.R[p * 3 + 1] = RY;
        g.R[p * 3 + 2] = RZ;
        g.rn[p * 3] = c[kk][0];
        g.rn[p * 3 + 1] = c[kk][1];
        g.rn[p * 3 + 2] = c[kk][2];
        // A picture on the back wall; plain plaster elsewhere.
        const pic = kk === 4 && abs(RX + 0.1) < 0.35 && abs(RY - 1.45) < 0.3, fr = pic && (abs(RX + 0.1) > 0.29 || abs(RY - 1.45) > 0.24);
        const f = fr ? 0.35 : pic ? 0.6 : kk === 1 ? 0.7 : 1;
        g.ramb[p * 3] = 40 * f;
        g.ramb[p * 3 + 1] = 18 * f;
        g.ramb[p * 3 + 2] = 40 * f;
      }
    }
}

// The door turns by th about its hinge at the left jamb, into the room.
// Does the segment from A to the candle cross it?
function doorBlocks(S, ax, ay, az) {
  const s = S.sn, c = S.cs, na = s * (ax + DW) - c * az, nb = s * (LX + DW) - c * LZ;
  if ((na > 0) === (nb > 0)) return false;
  const t = na / (na - nb), X = ax + (LX - ax) * t, Y = ay + (LY - ay) * t, Z = az + (LZ - az) * t, u = (X + DW) * c + Z * s;
  return u >= 0 && u <= 2 * DW && Y >= GAP && Y <= DH;
}

// Light at P from the candle, 0 when something is in the way. Points in the
// hallway see the candle only through the doorway, and there the shadow
// mask (the hand, or the figure) can stand in it. A door ajar by less than
// 0.03 rad counts as shut: the slit would light a dotted line.
function vis(S, x, y, z) {
  if (z < 0) {
    if (S.th < 0.03) return 0;
    const k = -z / (LZ - z), qx = x + (LX - x) * k, qy = y + (LY - y) * k;
    if (abs(qx) >= DW || qy <= 0 || qy >= DH) return 0;
    if (doorBlocks(S, x, y, z)) return 0;
    return 1 - mask(S, qx, qy);
  }
  return doorBlocks(S, x, y, z) ? 0 : 1;
}

// The shadow, kept as the shape it throws on the boards: a grid over the
// hallway floor. A ray from the candle through the doorway is in shadow when
// the floor it would reach is dark, so the haze shows the same shadow as the
// floor does.
const MS = 0.02, MW = 60, MH = 80;
function mask(S, qx, qy) {
  if (qy >= LY * 0.99) return 0;
  const m = LY / (LY - qy), i = floor((LX + (qx - LX) * m + HW) / MS), j = floor((LZ * (m - 1)) / MS);
  return j < MH && i >= 0 && i < MW ? S.mk[j * MW + i] : 0;
}
// A round-ended stroke from (ax, az) to (bx, bz) on the floor, r wide. The
// shapes are drawn upright and sheared along the light, which crosses the
// boards leaning SH to the left for every metre it comes towards the eye.
const SH = 0.3;
function capsule(S, ax, az, bx, bz, r) {
  (ax += SH * az), (bx += SH * bz);
  const M = S.mk, x0 = max(0, floor((min(ax, bx) - r - 0.03 + HW) / MS)), x1 = min(MW - 1, floor((max(ax, bx) + r + 0.03 + HW) / MS));
  const y0 = max(0, floor((-max(az, bz) - r - 0.03) / MS)), y1 = min(MH - 1, floor((-min(az, bz) + r + 0.03) / MS));
  const ex = bx - ax, ey = bz - az, ee = ex * ex + ey * ey || 1;
  for (let j = y0; j <= y1; j++)
    for (let i = x0; i <= x1; i++) {
      const px = (i + 0.5) * MS - HW, py = -(j + 0.5) * MS, t = cl(((px - ax) * ex + (py - az) * ey) / ee, 0, 1);
      const d = sqrt((px - ax - ex * t) ** 2 + (py - az - ey * t) ** 2), v = cl((r - d) / 0.03 + 0.5, 0, 1);
      if (v > M[j * MW + i]) M[j * MW + i] = v;
    }
}
// A long-fingered hand lying in the light: the wrist at (wx, wz), the
// fingers reaching towards the eye, turned by a, curled by c.
function hand(S, wx, wz, a, c) {
  const ca = cos(a), sa = sin(a), P = (u, v) => [wx + u * ca + v * sa, wz - v * ca + u * sa];
  capsule(S, ...P(0, -0.6), ...P(0, 0), 0.1);
  capsule(S, ...P(-0.03, 0.03), ...P(0, 0.16), 0.15);
  for (let f = 0; f < 4; f++) {
    let [px, pz] = P(-0.15 + f * 0.1, 0.24), an = -PI / 2 + a + (f - 1.5) * 0.12;
    const len = [0.19, 0.24, 0.23, 0.17][f], wig = 0.12 * sin(S.t * 5 + f * 1.7) * (1 - c);
    for (let seg = 0; seg < 3; seg++) {
      an += (c * (0.3 + 0.15 * seg) * (1.5 - f) * 0.5 + wig * (f < 2 ? 1 : -1)) * 0.7;
      const nx = px + cos(an) * len * (1 - 0.45 * c), nz = pz + sin(an) * len * (1 - 0.45 * c);
      capsule(S, px, pz, nx, nz, 0.045 - seg * 0.009);
      (px = nx), (pz = nz);
    }
  }
  const t0 = P(0.17, 0.05), t1 = P(0.31, 0.19);
  capsule(S, ...t0, ...t1, 0.045);
  capsule(S, ...t1, ...P(0.35, 0.33), 0.035);
}
// Someone in a pointed hat crossing the room between the candle and the
// door: a long shadow from the threshold, the legs walking, the hat nearest
// the eye.
function figure(S, x, walk) {
  const l = 0.07 * sin(walk);
  capsule(S, x - 0.05 - l, 0.15, x - 0.05, -0.36, 0.05);
  capsule(S, x + 0.05 + l, 0.15, x + 0.05, -0.36, 0.05);
  capsule(S, x, -0.38, x, -0.6, 0.13);
  capsule(S, x - 0.06, -0.66, x + 0.06, -0.66, 0.11);
  capsule(S, x, -0.76, x, -0.84, 0.085);
  capsule(S, x - 0.17, -0.92, x + 0.17, -0.92, 0.035);
  for (let i = 0; i < 6; i++) capsule(S, x - 0.006 * i * i, -0.95 - 0.06 * i, x - 0.006 * (i + 1) * (i + 1), -1.01 - 0.06 * i, 0.08 - 0.013 * i);
}

// One round of the door. Times in seconds at Speed 2.
function plan(S, first) {
  const r = Math.random;
  // Now and then the door gets only half way before it slams.
  const part = !first && r() < 0.3;
  S.cy = {
    t0: first ? 0.8 : 0, open0: 0.8, dur: part ? 2.4 : 3.4 + r() * 1.4, thMax: part ? 0.5 + r() * 0.15 : 0.95 + r() * 0.25, kind: S.round % 2,
    steps: [0, 1, 2, 3, 4].map(() => r()).sort(), sh0: 2.2 + r() * 0.6, slam: part ? 4.6 + r() * 0.6 : 6.2 + r() * 0.8,
  };
  S.cy.end = S.cy.slam + 3.6 + r() * 0.6;
  S.ct = S.cy.t0;
  S.round++;
}
// The angle as the door creaks open: five lurches with sticking between.
function creak(c, u) {
  let a = 0;
  for (let i = 0; i < 5; i++) a += sm((u - c.steps[i] * 0.85) / 0.12) * 0.2;
  return 0.12 + (c.thMax - 0.12) * (0.25 * u + 0.75 * a);
}

export function setup(params) {
  const S = (params.s = { t: 0, ct: 0, round: 0, hue: 0, speed: 2, reach: 0, haze: 0.06, th: 0.12, sn: 0, cs: 1, slamT: -9, shake: [0, 0], flick: 1, D0: -1, feet: -1, peep: true,
    mk: new Float32Array(MW * MH), lf: new Float32Array(N), buf: new Float32Array(N * 3), hz: new Float32Array(32 * 64), motes: [], falls: [] });
  setup0(S);
  plan(S, true);
  for (let i = 0; i < 140; i++) S.motes.push({ x: (Math.random() * 2 - 1) * HW, y: Math.random() * HC, z: -Math.random() * 1.6, ph: Math.random() * 6.3, f: 0.5 + Math.random() });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.reach = cl(k[2], 0, 1);
  S.haze = cl(k[3], 0, 1);
  const ft = cl(dt || 0, 0, 0.1), st = (ft * S.speed) / 2, c = S.cy;
  S.t += st;
  S.ct += st;
  if (input.btnPressed && input.btnPressed[0]) {
    if (S.ct < c.slam && S.ct > c.open0) c.slam = S.ct;
    else if (S.ct > c.slam + 0.3) S.ct = c.end + 1;
  }
  if (S.ct > c.end) {
    plan(S, false);
    if (input.btnPressed && input.btnPressed[0]) S.ct = S.cy.open0;
  }
  const ct = S.ct, cc = S.cy;
  // The door's angle.
  let th = 0;
  if (ct < cc.open0) th = 0;
  else if (ct < cc.slam) th = creak(cc, cl((ct - cc.open0) / cc.dur, 0, 1));
  else {
    const e = ct - cc.slam, a0 = creak(cc, cl((cc.slam - cc.open0) / cc.dur, 0, 1));
    th = e < 0.14 ? a0 * (1 - (e / 0.14) ** 2) : 0.025 * exp(-(e - 0.14) * 9) * abs(sin((e - 0.14) * 30));
    if (e >= 0.14 && S.slamT < cc.slam) {
      S.slamT = cc.slam;
      for (let i = 0; i < 28; i++) S.falls.push({ x: (Math.random() * 2 - 1) * (DW + TRIM), y: DH + TRIM + Math.random() * 0.05, z: -0.01 - Math.random() * 0.1, v: -Math.random() * 2.5, m: 0.2 + Math.random() * 0.45, a: 1.3 + Math.random(), w: Math.random() * 6 });
    }
  }
  S.th = th;
  S.sn = sin(th);
  S.cs = cos(th);
  // Shake after the slam.
  const e = ct - cc.slam - 0.14;
  if (e > 0 && e < 0.8) {
    const A = 3 * exp(-e * 3.5);
    S.shake = [round(A * sin(e * 83)), round(0.6 * A * sin(e * 61 + 1))];
  } else S.shake = [0, 0];
  // After the slam two feet cross the light under the door, right to left,
  // and a while later the keyhole goes dark: an eye on the other side.
  S.feet = e > 1 && e < 2.8 ? (e - 1) / 1.8 : -1;
  S.peep = !(e > 3 && e < 3.5);
  // Candle flicker.
  S.flick = 1 + 0.13 * vn(S.t * 9, 3) + 0.06 * vn(S.t * 23, 5);
  // The shadow.
  S.mk.fill(0);
  const sh = ct - cc.sh0;
  if (sh > 0 && sh < 4) {
    const u = sh / 4;
    if (cc.kind === 0) {
      const reach = sm(u / 0.4) - 1.5 * sm((u - 0.78) / 0.22);
      hand(S, 0.05 + 0.08 * sin(sh * 0.9), 0.6 - 1.1 * reach, 0.12 * sin(sh * 1.3), 0.75 * sm((u - 0.45) / 0.2) - 0.75 * sm((u - 0.72) / 0.1));
    } else figure(S, 0.75 - 1.3 * u, sh * 7);
  }
  // Dust falling from the lintel after the slam.
  for (const f of S.falls) {
    f.v = min(f.m, f.v + 1.5 * st);
    f.y -= max(0, f.v) * st;
    f.x += 0.04 * sin(S.t * 3 + f.w) * st;
    f.z -= 0.03 * st;
    f.a -= st * 0.45;
  }
  S.falls = S.falls.filter((f) => f.y > 0 && f.a > 0);
  for (const m of S.motes) {
    m.x += 0.03 * vn(S.t * 0.5 + m.ph * 10, 1) * st;
    m.y += (0.02 * vn(S.t * 0.4 + m.ph * 7, 2) - 0.01) * st;
    if (m.y < 0) m.y += HC;
    if (abs(m.x) > HW) m.x = -m.x * 0.98;
  }
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}
// Warm light by amount: deep red when faint, orange, then pale gold, so it
// never sinks to brown.
const RAMP = 256, RMAX = 2;
function ramp(S) {
  if (S.rh === S.hue) return;
  S.rh = S.hue;
  const T = (S.rt = S.rt || new Float32Array(RAMP * 3)), o = [0, 0, 0];
  for (let j = 0; j < RAMP; j++) {
    const w = (j / (RAMP - 1)) * RMAX;
    hsv(S.hue + 0.11 * min(1, w), 1 - 0.55 * cl(w - 0.9, 0, 1), pow(min(1, w * 1.6), 0.7), o);
    T[j * 3] = o[0];
    T[j * 3 + 1] = o[1];
    T[j * 3 + 2] = o[2];
  }
}

// 0 where a foot stands in the gap under the door, 1 elsewhere.
function feet(S, x, d) {
  if (S.feet < 0) return 1;
  const r = 0.05 + 0.3 * d;
  const u = S.feet, step = u * 5, a = DW + 0.15 - (2 * DW + 0.3) * (floor(step) + sm((step % 1) * 2)) / 5;
  const b = DW + 0.15 - (2 * DW + 0.3) * (floor(step + 0.5) + sm(((step + 0.5) % 1) * 2) - 0.5) / 5 + 0.13;
  return abs(x - a) < r || abs(x - b) < r ? 0.08 : 1;
}

// Candle light at a point facing (nx, ny, nz); nx = 2 for a mote or a speck
// of haze, which faces every way.
function lightAt(S, x, y, z, nx, ny, nz) {
  const lx = LX - x, ly = LY - y, lz = LZ - z, d2 = lx * lx + ly * ly + lz * lz, d = sqrt(d2), lam = nx === 2 ? 1 : (nx * lx + ny * ly + nz * lz) / d;
  if (lam <= 0) return 0;
  return lam / (1 + d2 / (S.D * S.D));
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  ramp(S);
  const g = S.geo, T = S.rt, buf = S.buf, lf = S.lf, I = LI * S.flick;
  S.D = 0.9 * pow(2.6, S.reach);
  if (S.D0 !== S.D) {
    S.D0 = S.D;
    for (let p = 0; p < N; p++) {
      const k = g.kind[p];
      if (k === DOOR) continue;
      const n = NRM[k];
      lf[p] = lightAt(S, g.P[p * 3], g.P[p * 3 + 1], g.P[p * 3 + 2], n[0], n[1], n[2]) * g.alb[p];
    }
  }
  const s = S.sn, c = S.cs, shut = S.th < 0.03;
  // Haze: light scattered towards the eye along each ray, at half size.
  const hz = S.hz, hk = 0.02 + 0.3 * S.haze * S.haze;
  for (let j = 0; j < 64; j++)
    for (let i = 0; i < 32; i++) {
      const p = (j * 2) * W + i * 2, dx = g.d[p * 2], dy = g.d[p * 2 + 1], tz = min(0, g.tz[p]);
      let a = 0;
      if (!shut) {
        const t0 = 1.2, t1 = tz + ZC, n = 8, h = (t1 - t0) / n;
        for (let q = 0; q < n; q++) {
          const t = t0 + (q + 0.5) * h, x = dx * t, y = EYE + dy * t, z = -ZC + t;
          if (z > -1.8) a += vis(S, x, y, z) * lightAt(S, x, y, z, 2, 0, 0) * h;
        }
      }
      hz[j * 32 + i] = a * hk;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, k = g.kind[p];
      let w = 0, ar = g.amb[p * 3], ag = g.amb[p * 3 + 1], ab = g.amb[p * 3 + 2];
      if (k === DOOR) {
        const dx = g.d[p * 2], dy = g.d[p * 2 + 1], nC = s * DW + c * ZC, nd = s * dx - c, t = -nC / nd;
        let hit = false;
        if (t > ZC - 1e-6 && t < 1e8) {
          const X = dx * t, Y = EYE + dy * t, Z = -ZC + t, u = (X + DW) * c + Z * s;
          if (u >= 0 && u <= 2 * DW && Y >= GAP && Y <= DH && Z <= g.R[p * 3 + 2]) {
            hit = true;
            // The door's face: stiles, rails and four sunk panels.
            const pu = u / (2 * DW), pv = Y / DH, inP = pu > 0.13 && pu < 0.87 && ((pv > 0.08 && pv < 0.43) || (pv > 0.52 && pv < 0.93)) && abs(pu - 0.5) > 0.04;
            const edge = inP && (pu < 0.16 || pu > 0.84 || abs(pu - 0.5) < 0.07 || abs(pv - 0.08) < 0.02 || abs(pv - 0.43) < 0.02 || abs(pv - 0.52) < 0.02 || abs(pv - 0.93) < 0.02);
            const knob = (pu - 0.88) ** 2 * 4 + (pv - 0.48) ** 2 < 0.0004, key = shut && S.peep && abs(pu - 0.88) < 0.012 && abs(pv - 0.44) < 0.012;
            const f = knob ? 1.8 : edge ? 0.55 : inP ? 1.12 : 1;
            ar = 42 * f;
            ag = 20 * f;
            ab = 38 * f;
            w = lightAt(S, X, Y, Z, s, 0, -c) * 0.7 * f;
            if (key) w = 0.8 * S.flick;
          }
        }
        if (!hit) {
          const R = g.R, X = R[p * 3], Y = R[p * 3 + 1], Z = R[p * 3 + 2];
          ar = g.ramb[p * 3];
          ag = g.ramb[p * 3 + 1];
          ab = g.ramb[p * 3 + 2];
          w = shut ? 0 : (doorBlocks(S, X, Y, Z) ? 0.08 : (lightAt(S, X, Y, Z, g.rn[p * 3], g.rn[p * 3 + 1], g.rn[p * 3 + 2]) * RI) / LI) * (ar / 40);
          if (Y < GAP * 2 && shut) w = 0.9 * feet(S, X, 0);
        }
        w *= I;
      } else if (lf[p] > 0) w = lf[p] * I * vis(S, g.P[p * 3], g.P[p * 3 + 1], g.P[p * 3 + 2]);
      // Light leaking under a shut door onto the boards just in front.
      if (k === FLOOR && shut && g.P[p * 3 + 2] > -0.3 && abs(g.P[p * 3]) < DW + 0.1) {
        const z = g.P[p * 3 + 2], e = 1 + z / 0.3;
        w += 0.55 * S.flick * e * e * cl((DW + 0.1 - abs(g.P[p * 3])) / 0.1, 0, 1) * feet(S, g.P[p * 3], -z);
      }
      // The haze, laid back over the full panel between its four nearest.
      const hy = cl((y - 0.5) / 2, 0, 62.999), hx = cl((x - 0.5) / 2, 0, 30.999), iy = floor(hy), ix = floor(hx), fy = hy - iy, fx = hx - ix, q = iy * 32 + ix;
      w += (hz[q] * (1 - fx) * (1 - fy) + hz[q + 1] * fx * (1 - fy) + hz[q + 32] * (1 - fx) * fy + hz[q + 33] * fx * fy) * I;
      const j = 3 * min(RAMP - 1, round((w / RMAX) * (RAMP - 1))), keep = max(0, 1 - 2 * w);
      buf[p * 3] = ar * keep + T[j];
      buf[p * 3 + 1] = ag * keep + T[j + 1];
      buf[p * 3 + 2] = ab * keep + T[j + 2];
    }
  // Dust in the beam.
  for (const m of shut ? [] : S.motes) {
    const v = vis(S, m.x, m.y, m.z);
    if (!v) continue;
    const t = m.z + ZC, x = floor(CX + (F * m.x) / t), y = floor(CY - (F * (m.y - EYE)) / t);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const a = lightAt(S, m.x, m.y, m.z, 2, 0, 0) * I * (0.5 + 0.5 * sin(S.t * 6 * m.f + m.ph * 9)) * (0.5 + 2 * S.haze), p = (y * W + x) * 3;
    buf[p] += 255 * a;
    buf[p + 1] += 170 * a;
    buf[p + 2] += 90 * a;
  }
  for (const f of S.falls) {
    const t = f.z + ZC, x = floor(CX + (F * f.x) / t), y = floor(CY - (F * (f.y - EYE)) / t);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const p = (y * W + x) * 3, a = min(1, f.a) * (0.6 + 0.4 * sin(S.t * 7 + f.w * 5));
    buf[p] += 90 * a;
    buf[p + 1] += 78 * a;
    buf[p + 2] += 110 * a;
  }
  const [ox, oy] = S.shake;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = x - ox, sy = y - oy;
      if (sx < 0 || sx >= W || sy < 0 || sy >= H) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const p = (sy * W + sx) * 3;
      display.setPixel(x, y, min(252, round(buf[p] / 4) * 4), min(252, round(buf[p + 1] / 4) * 4), min(252, round(buf[p + 2] / 4) * 4));
    }
}
