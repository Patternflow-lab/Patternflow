// ===== Patternflow pattern =====
// Title:   Fluoroscope
// Family:  body
// Idea:    On the dark screen of a fluoroscope a skeleton walks in profile on a treadmill, skull to toes, its far leg and arm dimmer behind the near ones, while every moving bone leaves a faint afterglow on the phosphor.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 27, after cineradiography, the X-ray motion pictures of the 1950s
// Round:   27
// ===============================
// @matrix 64x128
// @knobs Screen=0..1, Speed=0.2..3, Gait=0..1, Dose=0..1
//
// Knob 1: Screen. The colour of the phosphor: blue-white at 0 with a green afterglow, then green, amber and violet at 1. The densest bone glows toward white in every colour.
// Knob 2: Speed. The cadence: at 2 a stride of two steps takes 1.08 s walking and 0.71 s running; at 0.2 it is ten times slower.
// Knob 3: Gait. A walk at 0, heel strike to toe-off, through a jog to a run at 1: the elbows bend to a right angle and both feet leave the belt between steps.
// Knob 4: Dose. The exposure: bones alone at 0 and a faint haze of flesh at 0.06. Toward 1 the soft tissue fills in: the dark lungs and windpipe, the heart's shadow, gas in the gut, the outline of the body.
// Buttons: K1 tap: the walker stops, turns to face you, so the skeleton is seen from the front, waves and turns back to walk on. K2 tap: a jump in place.

const W = 64, H = 128, N = W * H;
const { min, max, sin, cos, sqrt, exp, floor, ceil, atan2, hypot, PI } = Math;
const D = PI / 180;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// A figure 114 LEDs tall: limb lengths and half spans of hips and shoulders.
// FLOOR is the top of the belt. Bones are drawn half again as thick as life.
const LT = 27.5, LS = 27.5, LU = 20.5, LF = 16, HZ = 5.2, SZ = 12.4, FLOOR = 122.5;

// For the walk (toe-off at 60%) and then the run (toe-off at 40%), the thigh's
// angle from vertical and the flexion of knee and ankle, in degrees every 10%
// of a stride from heel strike, after clinical gait curves.
const GT = [
  [24, 20, 12, 3, -6, -14, -10, 6, 19, 25],
  [4, 16, 18, 10, 5, 14, 38, 60, 45, 15],
  [0, -5, 3, 6, 8, 0, -16, -10, -2, 1],
  [30, 18, 5, -5, -12, -6, 12, 30, 42, 40],
  [20, 38, 40, 28, 18, 50, 90, 104, 76, 36],
  [6, 16, 20, 10, -18, -14, -2, 6, 8, 6],
];
// A periodic Catmull-Rom spline through a row.
function curve(r, p) {
  const f = (p - floor(p)) * 10, i = floor(f) % 10, u = f - floor(f);
  const a = r[(i + 9) % 10], b = r[i], c = r[(i + 1) % 10], d = r[(i + 2) % 10];
  return b + 0.5 * u * (c - a + u * (2 * a - 5 * b + 4 * c - d + u * (3 * (b - c) + d - a)));
}
const ang = (k, q, g) => mix(curve(GT[k], q), curve(GT[k + 3], q), g);
// The jump, keyed in seconds: thigh, knee, ankle, shoulder, elbow, lean.
const JT = [0, 0.3, 0.46, 0.7, 0.9, 1.1, 1.5];
const JK = [
  [0, 50, 2, 30, 10, 42, 0],
  [0, 95, 4, 58, 16, 76, 0],
  [0, 24, -34, -18, -6, 20, 0],
  [0, -40, 58, 50, 25, 10, 0],
  [10, 15, 45, 50, 35, 30, 10],
  [0, 24, 2, 4, 8, 20, 0],
];
function key(r, u) {
  let i = 0;
  while (i < 5 && u > JT[i + 1]) i++;
  return mix(r[i], r[i + 1], sm(JT[i], JT[i + 1], u));
}

// The spine's curve in the trunk's frame (x forward, y down from the hips).
const CY = [-41, -36.5, -32.5, -28, -23.5, -19, -15.5, -11.5, -7.5, -4.5];
const CX = [-2.2, -1.9, -3, -4.6, -5.3, -4.8, -3.8, -2.4, -2, -2.8];
function spx(y) {
  let i = 0;
  while (i < 8 && y > CY[i + 1]) i++;
  return mix(CX[i], CX[i + 1], (y - CY[i]) / (CY[i + 1] - CY[i]));
}
// 24 vertebral bodies from the neck down: x, y, half sizes, tilt.
const VT = new Float64Array(144);
for (let v = 0, y = -40.8; v < 24; v++) {
  const k = v < 7 ? 0 : v < 19 ? 1 : 2, h = [1.25, 1.3, 2.3][k], c = y + h / 2;
  VT.set([spx(c), c, [1.3, 1.6, 2.2][k], h * 0.4, [1.6, 1.9, 2.6][k], -atan2(spx(c + 0.5) - spx(c - 0.5), 1)], v * 6);
  y += h;
}
// Seven ribs stand for twelve: half depth and width of the cage, drop of the
// front end, sag, and how far round the bone goes before the cartilage, which
// the beam passes through.
const RIB = [
  [4, 5.5, 4, 0.6, 0.95], [5.4, 8.2, 6.2, 0.9, 0.92], [6.1, 10, 7.6, 1.1, 0.88], [6.6, 11.2, 8.4, 1.2, 0.82],
  [6.7, 11.6, 8.6, 1.2, 0.75], [6.5, 11.4, 8.2, 1.1, 0.64], [6, 10.6, 7, 1, 0.5],
];
// The hip bone as lines split by NaN: the iliac crest, the front border down
// to the socket, the back border, the brim from sacrum to pubis.
const IL = [
  -6.6, -5.5, 4, -5.6, -9.4, 6.2, -3.6, -11.6, 7.8, -1, -11.8, 8.8, 1.8, -10.4, 9.2, 3.8, -8, 9, 4.2, -7.4, 9, 3, -3.6, 7.5, 1.8, -2.6, 6,
  NaN, 0, 0, -6.6, -5.5, 4, -5.4, -2.6, 4.6, -4.6, -1.2, 4.8, -3.2, 1.2, 4.2, -2.8, 4, 4.2, -2.4, 6.4, 4.2,
  NaN, 0, 0, -4.2, -3.4, 3.6, -1.6, -1.6, 4.4, 0.5, -1, 4.6, 2.6, 0.6, 3.6, 4.4, 3, 1.2,
];
// Gas pockets in the gut: x, y, z, size.
const GAS = [2.6, -13.6, -5, 1.4, 3.2, -7, 3, 1, -0.4, -5, -2.4, 0.9, 4.4, -3.6, -4.4, 0.85];
// Fingers: offset across the palm and length; the share of each phalanx.
const FO = [1.25, 0.42, -0.42, -1.2], FLN = [5.4, 6, 5.6, 4.6], PHL = [0.45, 0.32, 0.23];
// Phosphors: the glow and its afterglow.
const PAL = [
  [0.45, 0.7, 1, 0.35, 1, 0.55],
  [0.3, 1, 0.4, 0.15, 0.7, 0.25],
  [1, 0.62, 0.18, 0.9, 0.3, 0.05],
  [0.72, 0.38, 1, 0.35, 0.3, 1],
];

// Bone and flesh add up apart as path length along the beam; G is afterglow.
const B = new Float32Array(N), T = new Float32Array(N), G = new Float32Array(N), GB = new Float32Array(N);
const LA = new Float64Array(6), AR = new Float64Array(4), PC = new Float64Array(6), MO = new Float64Array(6), MI = new Float64Array(6);
const FR = new Float64Array(13), AV = new Float64Array(9);
let TG = B;
let PSI = 0, CP = 1, SP = 0, OX = 25, OY = 63, LAM = 0, LC = 1, LSN = 0;
let HX = 0, HY = 0, ETA = 0, HC = 1, HS = 0, JA = 0, JC = 1, JS = 0;
let gx = 0, gy = 0, gz = 0, qx = 0, qy = 0, qz = 0, FROT = 0;
let e1x = 1, e1y = 0, e1z = 0, e2x = 0, e2y = 1, e2z = 0, e3x = 0, e3z = 1;

// Frames: body, with x forward and y down, trunk, head, jaw, and a limb's
// own, whose first axis runs along the bone.
const FB = (x, y, z) => ((gx = x), (gy = y), (gz = z), (FROT = 0));
const FT = (x, y, z) => ((gx = x * LC - y * LSN), (gy = x * LSN + y * LC), (gz = z), (FROT = LAM));
const FH = (x, y, z) => ((gx = HX + x * HC - y * HS), (gy = HY + x * HS + y * HC), (gz = z), (FROT = ETA));
const FL = (u, v, w) => (
  (gx = FR[0] + FR[3] * u + FR[6] * v + FR[9] * w), (gy = FR[1] + FR[4] * u + FR[7] * v + FR[10] * w), (gz = FR[2] + FR[5] * u + FR[8] * v + FR[11] * w), (FROT = FR[12])
);
function FJ(x, y, z) {
  const dx = x - 1.3, dy = y + 2.6;
  FH(1.3 + dx * JC - dy * JS, -2.6 + dx * JS + dy * JC, z);
  FROT += JA;
}
function P() {
  qx = OX + gx * CP - gz * SP;
  qy = OY + gy;
  qz = gx * SP + gz * CP;
}

// A tapered rod, hollow when sh > 0: the chord through a tube of cortex.
function tube(ax, ay, bx, by, ra, rb, w, sh) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-6, m = max(ra, rb) + 0.8;
  const x0 = max(0, ceil(min(ax, bx) - m)), x1 = min(W - 1, floor(max(ax, bx) + m));
  const y0 = max(0, ceil(min(ay, by) - m)), y1 = min(H - 1, floor(max(ay, by) + m));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const ux = x - ax, uy = y - ay, t = cl((ux * dx + uy * dy) / l2, 0, 1);
      const ex = ux - t * dx, ey = uy - t * dy, d2 = ex * ex + ey * ey, R = ra + (rb - ra) * t + 0.3, o = R * R - d2;
      if (o <= 0) continue;
      const ri = R - 0.85, i = ri * ri - d2;
      TG[y * W + x] += 2 * w * (sqrt(o) - (sh && ri > 0 && i > 0 ? sh * sqrt(i) : 0));
    }
}
// An ellipsoid seen along the beam: its quadric, and the chord through it.
function quad(M, a, b, c) {
  const A = 1 / (a * a), Bq = 1 / (b * b), C = 1 / (c * c);
  M[0] = e1x * e1x * A + e2x * e2x * Bq + e3x * e3x * C;
  M[1] = e1x * e1y * A + e2x * e2y * Bq;
  M[2] = e1y * e1y * A + e2y * e2y * Bq;
  M[3] = e1x * e1z * A + e2x * e2z * Bq + e3x * e3z * C;
  M[4] = e1y * e1z * A + e2y * e2z * Bq;
  M[5] = e1z * e1z * A + e2z * e2z * Bq + e3z * e3z * C;
}
function chord(M, u, v) {
  const b = M[3] * u + M[4] * v, d = b * b - M[5] * (M[0] * u * u + 2 * M[1] * u * v + M[2] * v * v - 1);
  return d > 0 ? (2 * sqrt(d)) / M[5] : 0;
}
// Tilted th in the side plane, turned yaw about the vertical. With a shell t
// the inside counts k less, so a skull's edge glows brighter than its face.
function ell(cx, cy, a, b, c, th, yaw, w, t, k) {
  (a += 0.3), (b += 0.3), (c += 0.3);
  const ph = PSI + yaw, cp = cos(ph), sp = sin(ph), ct = cos(th), st = sin(th);
  (e1x = ct * cp), (e1y = st), (e1z = ct * sp), (e2x = -st * cp), (e2y = ct), (e2z = -st * sp), (e3x = -sp), (e3z = cp);
  quad(MO, a, b, c);
  if (t) quad(MI, a - t, b - t, c - t);
  const rx = hypot(e1x * a, e2x * b, e3x * c) + 0.5, ry = hypot(e1y * a, e2y * b) + 0.5;
  const x0 = max(0, ceil(cx - rx)), x1 = min(W - 1, floor(cx + rx)), y0 = max(0, ceil(cy - ry)), y1 = min(H - 1, floor(cy + ry));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let s = chord(MO, x - cx, y - cy);
      if (s > 0 && t) s -= k * chord(MI, x - cx, y - cy);
      if (s > 0) TG[y * W + x] += s * w;
    }
}
// The far side of the body glows dimmer than the near side.
const wz = () => (TG === B ? cl(1 + 0.09 * qz, 0.45, 1.15) : 1);
function E(F, x, y, z, a, b, c, th, yaw, w, t = 0, k = 0) {
  F(x, y, z);
  P();
  ell(qx, qy, a, b, c, th + FROT, yaw, w * wz(), t, k);
}
function Tb(F, x1, y1, z1, x2, y2, z2, ra, rb, w, sh = 0) {
  F(x1, y1, z1);
  P();
  const ax = qx, ay = qy, az = qz;
  F(x2, y2, z2);
  P();
  qz = (qz + az) / 2;
  tube(ax, ay, qx, qy, ra, rb, w * wz(), sh);
}

export function setup(params) {
  const bg = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = (x - 31.5) / 36, v = (y - 63.5) / 72;
      bg[y * W + x] = (0.03 + 0.025 * Math.random()) * max(0, 1 - 0.8 * (u * u + v * v) ** 2);
    }
  params.s = { ph: 0.05, br: 0, belt: 0, turn: -1, jump: -1, dt: 1 / 30, scr: 0, spd: 2, gait: 0, dose: 0.06, amp: 1, bg };
  G.fill(0);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], b = input.btnPressed || [];
  dt = cl(dt || 0, 0, 0.1);
  S.dt = dt || 1 / 30;
  S.scr = cl(k[0], 0, 1);
  S.spd = cl(k[1], 0.2, 3);
  const g = (S.gait = cl(k[2], 0, 1));
  S.dose = cl(k[3], 0, 1);
  if (b[0] && S.turn < 0) S.turn = 0;
  if (b[1] && S.jump < 0) S.jump = 0;
  if (S.turn >= 0 && (S.turn += dt) > 5) S.turn = -1;
  if (S.jump >= 0 && (S.jump += dt) > 1.5) S.jump = -1;
  const a = (S.amp = S.turn < 0 ? 1 : 1 - sm(0, 0.7, S.turn) * (1 - sm(4.3, 5, S.turn)));
  const f = (mix(0.93, 1.4, g) * S.spd) / 2, to = mix(0.6, 0.4, g);
  S.ph = (S.ph + dt * f * a) % 1;
  // The belt runs as fast as the foot on it goes back, from strike to toe-off.
  const ax = (q) => LT * sin(ang(0, q, g) * D) + LS * sin((ang(0, q, g) - ang(1, q, g)) * D);
  S.belt += (dt * a * a * f * (ax(0) - ax(to))) / to;
  S.br = (S.br + dt * mix(0.25, 0.5, g)) % 1;
}

function treadmill(belt) {
  const y = FLOOR + 1.7, an = -belt / 2.3, c = 1.8 * cos(an), s = 1.8 * sin(an);
  tube(4.5, y, 59.5, y, 0.8, 0.8, 0.45, 0.5);
  tube(4.5, FLOOR + 0.1, 59.5, FLOOR + 0.1, 0.2, 0.2, 0.3, 0);
  for (let x = 4.5; x < 60; x += 55) {
    ell(x, y, 2.1, 2.1, 2.1, 0, 0, 0.45, 0.6, 1);
    tube(x - c, y - s, x + c, y + s, 0.35, 0.35, 0.5, 0);
  }
  for (let j = 0; j < 8; j++) {
    const x = 5 + ((((j * 7 - belt) % 56) + 56) % 56);
    tube(x, FLOOR - 0.2, x + 1, FLOOR - 0.2, 0.3, 0.3, 0.5, 0);
  }
}

function skull() {
  // The vault, upper jaw, chin and hollow eye sockets; then the dense bone of
  // the ear, the cheekbone, the teeth and the jaw.
  E(FH, 1.8, -7.2, 0, 7, 6.1, 5.8, -0.12, 0, 0.7, 0.5, 1);
  E(FH, 6.4, -1.6, 0, 2.6, 1.6, 3.4, 0.1, 0, 0.4, 0.5, 0.5);
  E(FJ, 7.9, 3.2, 0, 1.4, 1.3, 2, 0, 0, 0.7, 0.5, 0.5);
  Tb(FH, 7.6, -5.6, 0, 8.7, -3, 0, 0.45, 0.4, 0.9);
  for (let s = -1; s <= 1; s += 2) {
    E(FH, 6.2, -4.6, s * 2.7, 1.9, 2, 1.4, 0, s * 0.5, 0.7, 0.55, 1);
    E(FH, 6, -4.6, s * 2.4, 1.6, 1.7, 1.6, 0, 0, -0.35);
    E(FH, 6.2, -1.9, s * 2, 1.5, 1.1, 1.4, 0, 0, -0.3);
    E(FH, 0.3, -3.4, s * 3.4, 1.7, 1.3, 1.4, 0.3, 0, 0.8);
    Tb(FH, 2.2, -2.4, s * 5, 6.2, -2.9, s * 4.2, 0.55, 0.65, 0.8);
    Tb(FH, 8.6, 0.1, 0, 7.4, 0.1, s * 2.3, 0.75, 0.7, 1);
    Tb(FH, 7.4, 0.1, s * 2.3, 4.6, 0.2, s * 3.2, 0.7, 0.75, 1);
    Tb(FJ, 8.2, 1.3, 0, 7.2, 1.3, s * 2.3, 0.7, 0.65, 1);
    Tb(FJ, 7.2, 1.3, s * 2.3, 4.6, 1.2, s * 3.1, 0.65, 0.7, 1);
    Tb(FJ, 8.3, 3.7, 0, 6.6, 3.5, s * 2.8, 1, 0.9, 0.9, 0.5);
    Tb(FJ, 6.6, 3.5, s * 2.8, 2, 3.1, s * 4.7, 0.9, 0.85, 0.9, 0.5);
    Tb(FJ, 2, 3.1, s * 4.7, 1.3, -2.2, s * 4.7, 0.85, 0.7, 0.9, 0.4);
    Tb(FJ, 2.7, 0.8, s * 4.5, 3.5, -1.8, s * 4.3, 0.55, 0.35, 0.8);
  }
}

function trunk(b) {
  // Vertebrae, sacrum, tailbone, and the breastbone moving out on the breath.
  for (let v = 0; v < 24; v++) {
    const o = v * 6, x = VT[o], y = VT[o + 1], a = VT[o + 2], k = v < 7 ? 0 : v < 19 ? 1 : 2;
    E(FT, x, y, 0, a, VT[o + 3], VT[o + 4], VT[o + 5], 0, 0.55, 0.45, 0.7);
    Tb(FT, x - a + 0.2, y, 0, x - a - (v === 6 ? 3.6 : [2.2, 3, 3.4][k]), y + [0.5, 1.6, 0.4][k], 0, 0.45, 0.3, k === 1 ? 0.4 : 0.7);
  }
  Tb(FT, -3.6, -4.8, 0, -6.6, 2.6, 0, 2.5, 1, 0.8, 0.5);
  Tb(FT, -6.6, 2.6, 0, -5.2, 5.6, 0, 0.8, 0.45, 0.8);
  const sb = 0.5 * b;
  Tb(FT, 5 + sb, -31, 0, 6.6 + sb, -23.5, 0, 1.2, 0.9, 0.9, 0.5);
  Tb(FT, 6.6 + sb, -23.5, 0, 7 + sb, -19.5, 0, 0.9, 0.45, 0.8);
  E(FT, 5.2 + sb, -29.8, 0, 1.3, 1.9, 2.4, -0.2, 0, 0.7, 0.5, 0.6);
  for (let s = -1; s <= 1; s += 2) {
    // Hip bone: faint wing, its lines, socket, obturator ring.
    E(FT, -1.5, -6.5, s * 6, 5.4, 4.8, 2.6, -0.35, s * 0.55, 0.2, 0.5, 1);
    for (let i = 3; i < IL.length; i += 3)
      if (IL[i] === IL[i] && IL[i - 3] === IL[i - 3]) Tb(FT, IL[i - 3], IL[i - 2], s * IL[i - 1], IL[i], IL[i + 1], s * IL[i + 2], 0.45, 0.45, 0.85);
    E(FT, 0, 0, s * HZ, 3.2, 3.2, 3, 0, 0, 0.4, 0.6, 1);
    E(FT, 1, 4.6, s * 3.8, 3.2, 2.2, 1.6, 0.3, s * 0.3, 0.4, 0.5, 1);
    // Collarbone, shoulder blade, the spine of the blade and the coracoid.
    Tb(FT, 4.6, -32.2, s * 1.6, 2.2, -33.3, s * 7.4, 0.85, 0.8, 0.9, 0.4);
    Tb(FT, 2.2, -33.3, s * 7.4, -1, -34.6, s * 12, 0.8, 0.9, 0.9, 0.4);
    E(FT, -5.6, -27.5, s * 8.3, 2, 6.2, 4.6, 0.1, s * 0.6, 0.2, 0.4, 1);
    Tb(FT, -7.4, -30.6, s * 5.4, -1.4, -35, s * 11.6, 0.6, 0.75, 0.9);
    Tb(FT, 0.4, -32.4, s * 10, 2.4, -31.6, s * 9, 0.5, 0.45, 0.8);
    // The ribs swing up and out on the breath.
    for (let i = 0; i < 7; i++) {
      const r = RIB[i], ya = -31.5 + 2.4 * i, xa = spx(ya) - 1.3, rx = r[0] * (1 + 0.06 * b), rz = r[1] * (1 + 0.04 * b), dr = r[2] - 1.3 * b;
      let px = xa, py = ya, pz = s * 1.6;
      for (let j = 1; j <= 5; j++) {
        const al = (r[4] * PI * j) / 5, ca = 1 - cos(al), x = xa + rx * ca, y = ya + (dr * ca) / 2 + r[3] * sin(al), z = s * (1.6 + rz * sin(al));
        Tb(FT, px, py, pz, x, y, z, 0.3, 0.25, 0.9);
        (px = x), (py = y), (pz = z);
      }
    }
  }
}

function flesh(b) {
  E(FH, 2.4, -6, 0, 8, 8.4, 6.8, -0.1, 0, 1);
  Tb(FT, -1.6, -31, 0, -0.6, -41, 0, 4.6, 4.2, 1);
  E(FT, -0.2 + 0.3 * b, -23.5, 0, 9.4 + 0.4 * b, 11.5, 12.6, 0.05, 0, 1);
  E(FT, 1.4, -9.5, 0, 8.8, 8.6, 11.4, 0, 0, 1);
  E(FT, -1.6, -0.8, 0, 8.8, 8, 12.4, 0, 0, 1);
  // Air in the lungs and windpipe and in the gut; heart and liver a little denser.
  for (let s = -1; s <= 1; s += 2) E(FT, -0.3, -24.4 + 0.6 * b, s * 5.8, 5.6 + 0.3 * b, 8 + 0.5 * b, 5.4, 0.1, s * 0.15, -1);
  Tb(FT, 2.4, -40.5, 0, 0.8, -28.6, 0, 1, 1, -1);
  E(FT, 3.6, -19.4, -1.6, 4, 4.6, 4.2, 0.6, 0, 0.55);
  E(FT, 1.4, -12.6, 3.2, 6, 4.2, 6.8, 0.3, 0, 0.3);
  for (let i = 0; i < 16; i += 4) E(FT, GAS[i], GAS[i + 1], GAS[i + 2], 1.8 * GAS[i + 3], 1.4 * GAS[i + 3], 1.8 * GAS[i + 3], 0, 0, -0.8);
}

function leg(i, s) {
  const t1 = LA[i * 3], t2 = LA[i * 3 + 1], t3 = LA[i * 3 + 2], z = s * HZ, bone = TG === B;
  const dx = sin(t1), dy = cos(t1), kx = LT * dx, ky = LT * dy, ex = sin(t2), ey = cos(t2), ax = kx + LS * ex, ay = ky + LS * ey, fx = cos(t3), fy = -sin(t3);
  // Femur: head in its socket, neck, greater trochanter, shaft, condyles.
  FR.set([0, 0, z, dx, dy, 0, dy, -dx, 0, 0, 0, s, -t1]);
  if (!bone) Tb(FL, -1, 0, 0, LT, 0, 0, 6.4, 4.4, 1);
  else {
    E(FL, 0, 0, 0, 2.3, 2.3, 2.3, 0, 0, 0.6, 0.6, 0.6);
    Tb(FL, 0, 0, 0, 2.6, 0, 2.6, 1.3, 1.4, 0.6);
    E(FL, 1.6, -1.5, 3.2, 1.7, 2.1, 1.5, 0, 0, 0.6, 0.6, 0.6);
    Tb(FL, 2.8, 0, 2.6, LT - 2.4, 0, 0.4, 1.75, 1.6, 1, 0.85);
    E(FL, LT - 1.2, -0.3, 0, 2.5, 2.4, 3.4, 0, 0, 0.7, 0.6, 0.6);
    // The kneecap rides over the joint, halfway between thigh and shank.
    const h = (t1 + t2) / 2;
    E(FB, kx + cos(h) * 3.2, ky - sin(h) * 3.2, z, 1, 1.8, 1.5, -h, 0, 0.85, 0.45, 0.5);
  }
  // Tibia and the thinner fibula behind it.
  FR.set([kx, ky, z, ex, ey, 0, ey, -ex, 0, 0, 0, s, -t2]);
  if (!bone) Tb(FL, 0, 0, 0, LS, 0, 0, 4.2, 2.4, 1), E(FL, 8, -1.6, 0, 3, 6.5, 3.2, 0, 0, 1);
  else {
    E(FL, 1.9, 0, 0, 2.8, 1.4, 3.3, 0, 0, 0.7, 0.5, 0.5);
    Tb(FL, 3, 0.3, 0, LS - 1.8, 0, 0, 1.75, 1.2, 1, 0.85);
    E(FL, LS - 1, 0, -0.4, 1.6, 1.7, 2.2, 0, 0, 0.75, 0.5, 0.4);
    E(FL, 3.6, -1.9, 2, 1, 1, 1, 0, 0, 0.8);
    Tb(FL, 4, -1.9, 2, LS - 0.8, -1, 2.4, 0.7, 0.6, 0.95, 0.3);
    E(FL, LS + 0.3, -1, 2.6, 1, 1.5, 1, 0, 0, 0.8);
  }
  // Foot: talus, heel, arch, two metatarsals for five, and toes that stay flat
  // on the belt as the heel lifts.
  FR.set([ax, ay, z, fx, fy, 0, -fy, fx, 0, 0, 0, s, -t3]);
  if (!bone) return Tb(FL, -3, 2.6, 0, 10, 3, 0, 2.3, 1.6, 1);
  E(FL, 0.6, 1, 0, 2.2, 1.5, 1.6, 0, 0, 0.8, 0.5, 0.5);
  E(FL, -2.4, 2.9, 0, 3.3, 1.8, 1.6, -0.3, 0, 0.8, 0.6, 0.55);
  E(FL, 3.3, 1.7, 0, 1.5, 1.3, 1.8, 0, 0, 0.85);
  E(FL, 2.6, 3.1, 0, 1.2, 1, 1.2, 0, 0, 0.8);
  Tb(FL, 4.4, 1.9, 0, 9.2, 3.5, 0, 0.65, 0.6, 1, 0.3);
  Tb(FL, 3.6, 3.4, 1, 8.4, 3.9, 1, 0.55, 0.5, 0.9);
  FL(9.2, 3.5, 0);
  const d = t3 < 0 ? -t3 * (1 - sm(0.4, 3, FLOOR - OY - gy - 1.1)) : 0, c = cos(d), n = -sin(d);
  Tb(FL, 9.2, 3.5, 0, 9.2 + c * 2.3, 3.5 + n * 2.3, 0, 0.5, 0.45, 0.95);
  Tb(FL, 9.2 + c * 2.3, 3.5 + n * 2.3, 0, 9.2 + c * 4.2, 3.5 + n * 4.2, 0, 0.45, 0.4, 0.9);
}

function arm(s, sig, eps, k, wv) {
  FT(-1, -33, s * SZ);
  const sx = gx, sy = gy, sz = gz, au = sig + LAM, af = au + eps, V = AV;
  // Axes of the upper arm and forearm, and the thumb side of the hand. In the
  // wave the elbow goes out to the side and the forearm up, palm to you.
  V.set([sin(au), cos(au), s * 0.1, sin(af), cos(af), s * 0.04, cos(af), -sin(af), 0]);
  if (k > 0) {
    const A = [0.2, 0.62, s * 0.76, 0.15, -cos(wv), s * (sin(wv) - 0.1), 0, 0, -s];
    for (let j = 0; j < 9; j++) V[j] = mix(V[j], A[j], k);
  }
  for (let j = 0; j < 9; j += 3) {
    const d = j === 6 ? V[6] * V[3] + V[7] * V[4] + V[8] * V[5] : 0;
    for (let c = 0; c < 3; c++) V[j + c] -= d * V[3 + c];
    const l = hypot(V[j], V[j + 1], V[j + 2]) || 1;
    for (let c = 0; c < 3; c++) V[j + c] /= l;
  }
  const [ux, uy, uz, fx, fy, fz, px, py, pz] = V, ex = sx + LU * ux, ey = sy + LU * uy, ez = sz + LU * uz;
  // The forearm's frame from the elbow, its third axis toward the palm.
  FR.set([ex, ey, ez, fx, fy, fz, px, py, pz, s * (fy * pz - fz * py), s * (fz * px - fx * pz), s * (fx * py - fy * px), -af]);
  if (TG === T) {
    Tb(FB, sx, sy, sz, ex, ey, ez, 2.8, 2.2, 1);
    Tb(FL, 0, 0, 0, LF, 0, 0, 2.2, 1.6, 1);
    return Tb(FL, LF, 0, 0, LF + 7, 0, 0, 1.5, 1.1, 1);
  }
  // Humerus, ulna with the point of the elbow, radius, wrist, four fingers
  // curled a little toward the palm, thumb.
  E(FB, sx, sy, sz, 2.2, 2.2, 2.2, 0, 0, 0.8, 0.7, 0.5);
  Tb(FB, sx + ux * 1.8, sy + uy * 1.8, sz + uz * 1.8, ex - ux * 1.3, ey - uy * 1.3, ez - uz * 1.3, 1.35, 1.15, 1, 0.85);
  E(FB, ex - ux * 0.8, ey - uy * 0.8, ez - uz * 0.8, 1.3, 1.5, 2.5, -au, 0, 0.8, 0.5, 0.5);
  E(FL, 0.3, -1, 0, 1, 1, 1, 0, 0, 0.9);
  Tb(FL, 0.8, -0.5, 0, LF, -0.5, 0, 0.75, 0.55, 1, 0.5);
  Tb(FL, 1.2, 0.5, 0, LF, 0.55, 0, 0.6, 0.95, 1, 0.5);
  E(FL, LF + 1.4, 0, 0, 1.5, 1.3, 1.5, 0, 0, 0.9, 0.5, 0.4);
  const c0 = mix(0.3, 0.06, k);
  for (let j = 0; j < 5; j++) {
    const th = j > 3, o = th ? 2.2 : FO[j];
    let x = LF + (th ? 3.2 : 5.8), y = o, z = 0, c = 0;
    Tb(FL, LF + (th ? 1 : 2.2), th ? 0.9 : o / 2, 0, x, y, z, 0.5, 0.45, 0.95);
    for (let m = 0; m < (th ? 2 : 3); m++) {
      c += c0;
      const L = th ? 2 - 0.4 * m : FLN[j] * PHL[m], X = x + cos(c) * L, Y = y + (th ? 0.7 * L : 0), Z = z + sin(c) * L;
      Tb(FL, x, y, z, X, Y, Z, 0.42, 0.36, 0.9);
      (x = X), (y = Y), (z = Z);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const g = S.gait, a = S.amp, p = S.ph, u = S.jump, tt = S.turn, b = sin(2 * PI * S.br);
  const wj = u < 0 ? 0 : sm(0, 0.2, u) * (1 - sm(1.15, 1.5, u));
  const tf = tt < 0 ? 0 : sm(0.5, 1.4, tt) * (1 - sm(3.8, 4.7, tt));
  const wave = tt < 0 ? 0 : sm(1.4, 1.9, tt) * (1 - sm(3.3, 3.8, tt));
  PSI = (PI / 2) * tf;
  (CP = cos(PSI)), (SP = sin(PSI));
  LAM = (mix(4, 11, g) * a + (wj ? key(JK[5], u) * wj : 0)) * D;
  (LC = cos(LAM)), (LSN = sin(LAM));
  // Legs half a stride apart, arms swinging against them; the lowest heel or
  // ball stands on the belt.
  let low = 0;
  for (let i = 0; i < 2; i++) {
    const q = p + 0.5 * i, c = cos(2 * PI * q);
    let th = ang(0, q, g) * a, kn = ang(1, q, g) * a + 3, an = ang(2, q, g) * a;
    let sg = mix(-5 - 17 * c, -12 - 28 * c, g) * a, ep = mix(8, mix(14 + 8 * (1 - c), 80 + 9 * (1 - c), g), a);
    if (wj) {
      (th = mix(th, key(JK[0], u), wj)), (kn = mix(kn, key(JK[1], u), wj)), (an = mix(an, key(JK[2], u), wj));
      (sg = mix(sg, key(JK[3], u), wj)), (ep = mix(ep, key(JK[4], u), wj));
    }
    const t1 = (LA[i * 3] = th * D), t2 = (LA[i * 3 + 1] = (th - kn) * D), t3 = (LA[i * 3 + 2] = (th - kn + an) * D);
    const ay = LT * cos(t1) + LS * cos(t2);
    low = max(low, ay + 4 * sin(t3) + 4.9 * cos(t3), ay - 9.2 * sin(t3) + 4.6 * cos(t3));
    (AR[i * 2] = sg * D), (AR[i * 2 + 1] = ep * D);
  }
  // A run leaves the belt between steps; a jump leaves it higher.
  const fl = g * g * a * 3.2 * max(0, (cos(4 * PI * (p - 0.45)) - 0.75) * 4) ** 1.5;
  const v = (u - 0.46) / 0.44;
  OY = FLOOR - low - fl - (v > 0 && v < 1 ? 32 * v * (1 - v) : 0);
  OX = mix(26.5 + 2.5 * g, 35, tf);
  FT(-2.1, -41.4, 0);
  (HX = gx), (HY = gy);
  ETA = -LAM * 0.85 + 0.035 * sin(4 * PI * p) * a;
  (HC = cos(ETA)), (HS = sin(ETA));
  JA = 0.2 * wave * (0.6 + 0.4 * sin(tt * 9));
  (JC = cos(JA)), (JS = sin(JA));
  const wv = 0.3 * sin((tt - 1.9) * 2 * PI * 1.7) * sm(1.6, 2, tt);

  B.fill(0);
  T.fill(0);
  TG = B;
  treadmill(S.belt);
  skull();
  trunk(b);
  for (let r = 0; r < 2; r++) {
    TG = r ? T : B;
    leg(0, 1);
    leg(1, -1);
    arm(1, AR[0], AR[1], wave, wv);
    arm(-1, AR[2], AR[3], 0, 0);
  }
  if (S.dose > 0.001) flesh(b);

  // The screen turns bone and flesh to light. An afterglow fades behind what
  // moves, and bright bone blooms a little.
  const x3 = S.scr * 3, pi = min(2, floor(x3));
  for (let j = 0; j < 6; j++) PC[j] = mix(PAL[pi][j], PAL[pi + 1][j], x3 - pi);
  const dec = exp(-S.dt / 0.07), gd = 0.62 * sqrt(S.dose), bg = S.bg;
  for (let y = 0; y < H; y++)
    for (let x = 0, r = y * W; x < W; x++) GB[r + x] = 0.5 * G[r + x] + 0.25 * (G[r + (x ? x - 1 : x)] + G[r + (x < W - 1 ? x + 1 : x)]);
  for (let q = 0; q < N; q++) {
    const e = B[q] > 0 ? (1 - exp(-0.3 * B[q])) ** 1.35 : 0, t = T[q] > 0 ? gd * (1 - exp(-T[q] / 12)) : 0;
    B[q] = e + t * (1 - e);
    G[q] = max(B[q], GB[q] * dec);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0, r = y * W; x < W; x++) {
      let a = 0;
      for (let d = -2; d <= 2; d++) a += B[r + cl(x + d, 0, W - 1)];
      T[r + x] = a / 5;
    }
  const ch = (j, lv, w, ag) => min(255, 255 * (lv * (PC[j] + (1 - PC[j]) * w) + ag * PC[j + 3]));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let a = 0;
      for (let d = -2; d <= 2; d++) a += T[cl(y + d, 0, H - 1) * W + x];
      const q = y * W + x, L = B[q], ag = (G[q] - L) * 0.3, lv = L + bg[q] + 0.045 * a, w = L * L * L * 0.75;
      display.setPixel(x, y, ch(0, lv, w, ag), ch(1, lv, w, ag), ch(2, lv, w, ag));
    }
}
