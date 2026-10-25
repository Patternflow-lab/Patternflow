// ===== Patternflow pattern =====
// Title:   Tennis Racket
// Family:  sim
// Idea:    A T-handle spinning about its middle axis turns itself over by half a turn again and again while its angular momentum stays fixed and upright, and below it the momentum seen from the handle runs round the momentum sphere along the polhodes, past the separatrix that joins the two ends of the middle axis.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the tennis racket theorem: Euler's equations of a free rigid body (Leonhard Euler, 1765) and their polhodes (Louis Poinsot, 1834), seen in a wing nut by Vladimir Dzhanibekov on Salyut 7 (1985), pattern round 49
// Round:   49
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Axis=-1..1, Nudge=0..1
//
// Knob 1: Hue. Turns the three colours round the wheel together: at 0 the crossbar and the polhodes round its axis are azure, the stem, its tip and the momentum's trail amber, and the polhodes round the third axis violet; at 0.5 they are orange, blue and green. Orange and yellow are kept bright so they never dim to brown.
// Knob 2: Speed. At 2 the handle spins at 4 radians a second, so the first flip comes at 2.3 seconds and the next ones every 3.9 seconds. At 0.2 time runs ten times slower, at 3 half as fast again.
// Knob 3: Axis. Which principal axis the throw starts near: at 0 the middle one, the stem, and the handle flips; at -1 the smallest, the crossbar, and at 1 the largest, the normal to the T, where it only wobbles round a small polhode. Between them it starts on a wider polhode and rolls over steadily instead of flipping: once every 1.5 seconds at 0.5 and every 1.0 at -0.5. A new setting throws again 0.3 seconds after the knob stops.
// Knob 4: Nudge. How far off that axis the throw starts: 0.072 radians at the opening 0.06, 1.2 radians at 1. At 0 it spins exactly about the middle axis and never flips. The time between flips grows like log(1 / nudge): 5.1, 3.9, 2.6 and 2.0 seconds at nudges of 0.017, 0.06, 0.25 and 0.5, and each e-fold smaller nudge adds 0.93 seconds.
// Buttons: any button throws again with the knobs as they are.

const W = 64, H = 128, N = W * H, HALF = 64;
const { floor, ceil, min, max, abs, sqrt, sin, cos, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}
// How near a hue is to orange and yellow, 0 to 1.
const warm = (h) => max(0, 1 - abs(h - floor(h) - 0.11) / 0.13);
const nrm = (p) => {
  const l = hypot(p[0], p[1], p[2]) || 1;
  return [p[0] / l, p[1] / l, p[2] / l];
};

// The T-handle as two boxes of one density, centre and half sizes: the
// crossbar along the body's x axis and the stem along y, both centred on
// x = z = 0, so x, y and z through the centre of mass are its principal axes.
// Worked out in setup, per unit mass, the moments are 0.160, 0.306 and
// 0.448: the crossbar's axis is the smallest, the stem's the middle, the
// normal to the T the largest, in the ratio 1 : 1.917 : 2.807.
const BOXES = [
  [0, 0, 0, 1.1, 0.17, 0.17],
  [0, 0.76, 0, 0.14, 0.59, 0.14],
];
// Spin about the middle axis at Speed 2, radians a second.
const OMEGA = 4;
// Nudge 1 starts the throw this many radians off the axis.
const NUDGE = 1.2;
// The nudge leans the start toward this body direction (made perpendicular
// to the start axis), 16 degrees off the separatrix, so it never starts on it.
const LEAN = [0.35, 0, 0.94];
// The camera over the handle: distance, LEDs per unit at the centre, the
// angle it looks down at, and the screen row of the centre of mass.
const CAMD = 11, FOC = 11 * 25, ELEV = 0.36, CY0 = 31;
// The light, a unit vector toward it in the space frame.
const LIGHT = nrm([-0.45, 0.75, 0.55]);
// The momentum sphere below: centre and radius in LEDs, and the direction
// it is seen from, in the handle's own frame.
const SX = 31.5, SY = 96.5, SR = 28;
const VIEW = nrm([0.3, 0.3, 0.9]);
// Frames of trail kept: the momentum's on the sphere, the stem tip's above.
const TRAIL = 150, TIP = 40;

export function setup(params) {
  // Moments of inertia from the boxes, about the centre of mass.
  let M = 0, cy = 0;
  for (const b of BOXES) (M += b[3] * b[4] * b[5]), (cy += b[3] * b[4] * b[5] * b[1]);
  cy /= M;
  const I = [0, 0, 0];
  for (const b of BOXES) {
    const m = b[3] * b[4] * b[5], x = 2 * b[3], y = 2 * b[4], z = 2 * b[5], d = b[1] - cy;
    I[0] += (m * (y * y + z * z)) / 12 + m * d * d;
    I[1] += (m * (x * x + z * z)) / 12;
    I[2] += (m * (x * x + y * y)) / 12 + m * d * d;
  }
  for (let k = 0; k < 3; k++) I[k] /= M;
  // The boxes' faces round the centre of mass, each as four corners, its
  // outward normal and which box it is on; face 1 of box 1 is the stem's tip.
  const faces = [];
  BOXES.forEach((b, bi) => {
    for (let ax = 0; ax < 3; ax++)
      for (const sg of [1, -1]) {
        const u = (ax + 1) % 3, v = (ax + 2) % 3, h = [b[3], b[4], b[5]], c = [b[0], b[1] - cy, b[2]];
        const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([pu, pv]) => {
          const p = c.slice();
          (p[ax] += sg * h[ax]), (p[u] += pu * h[u]), (p[v] += pv * h[v]);
          return p;
        });
        if (sg < 0) pts.reverse();
        const n = [0, 0, 0];
        n[ax] = sg;
        faces.push({ pts, n, part: bi === 1 && ax === 1 && sg > 0 ? 2 : bi });
      }
  });
  // The sphere's look, fixed because the handle's frame is: for every LED of
  // the disc, the point of the sphere in front and the one behind, which of
  // the four regions the separatrices cut it into each lies in, and which of
  // three polhodes per region it lies past. The polhodes are curves of
  // constant energy e = L1^2 / I1 + L2^2 / I2 + L3^2 / I3 on |L| = 1;
  // rho runs from 0 at a region's pole to 1 at its separatrix.
  const B = VIEW, U = nrm([-B[1] * B[0], 1 - B[1] * B[1], -B[1] * B[2]]);
  const R = [U[1] * B[2] - U[2] * B[1], U[2] * B[0] - U[0] * B[2], U[0] * B[1] - U[1] * B[0]];
  const iI = I.map((v) => 1 / v), eS = iI[1];
  const code = (p) => {
    const e = p[0] * p[0] * iI[0] + p[1] * p[1] * iI[1] + p[2] * p[2] * iI[2];
    const s = e > eS ? (e - eS) / (iI[0] - eS) : (eS - e) / (eS - iI[2]);
    const reg = e > eS ? (p[0] > 0 ? 0 : 1) : p[2] > 0 ? 2 : 3;
    return reg * 4 + floor(sqrt(cl(1 - s, 0, 0.9999)) * 4);
  };
  const front = new Int16Array(W * HALF).fill(-1), back = new Int16Array(W * HALF).fill(-1);
  const eF = new Float32Array(W * HALF), eB = new Float32Array(W * HALF);
  const en = (p) => p[0] * p[0] * iI[0] + p[1] * p[1] * iI[1] + p[2] * p[2] * iI[2];
  for (let y = 0; y < HALF; y++)
    for (let x = 0; x < W; x++) {
      const px = (x + 0.5 - SX) / SR, py = (SY - (y + HALF + 0.5)) / SR, r2 = px * px + py * py;
      if (r2 >= 1) continue;
      const pz = sqrt(1 - r2), i = y * W + x;
      const at = (z) => [px * R[0] + py * U[0] + z * B[0], px * R[1] + py * U[1] + z * B[1], px * R[2] + py * U[2] + z * B[2]];
      const pf = at(pz), pb = at(-pz);
      (front[i] = code(pf)), (back[i] = code(pb)), (eF[i] = en(pf)), (eB[i] = en(pb));
    }
  // Classes: 1 and 2 the front fill round the e1 and e3 poles, 4 the
  // separatrix behind, 5 and 6 a polhode in front round e1 and e3, 7 the
  // separatrix in front, 8 the rim. A line is where the code changes to a
  // neighbour; a change of region is the separatrix. The polhodes behind
  // (class 3) are left out: drawn, they crowded the ones in front.
  const cls = new Uint8Array(W * HALF);
  const edge = (A, i, x, y) => {
    let c = 0;
    for (const j of [x + 1 < W ? i + 1 : -1, y + 1 < HALF ? i + W : -1, x > 0 ? i - 1 : -1, y > 0 ? i - W : -1]) {
      if (j < 0 || A[j] < 0 || A[j] === A[i]) continue;
      if (A[j] >> 2 !== A[i] >> 2) c = 2;
      else if ((A[j] & 3) > (A[i] & 3)) c = max(c, 1);
    }
    return c;
  };
  for (let y = 0; y < HALF; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (front[i] < 0) continue;
      const rim = (x > 0 && front[i - 1] < 0) || (x < W - 1 && front[i + 1] < 0) || (y > 0 && front[i - W] < 0) || (y < HALF - 1 && front[i + W] < 0);
      const ef = edge(front, i, x, y), eb = edge(back, i, x, y), reg = front[i] >> 2;
      cls[i] = rim ? 8 : ef === 2 ? 7 : ef === 1 ? (reg < 2 ? 5 : 6) : eb === 2 ? 4 : reg < 2 ? 1 : 2;
    }
  params.s = {
    I, iI, faces, cls, R, U, B, tipY: 1.35 - cy, front, back, eF, eB, cap: new Uint8Array(W * HALF),
    hue: 0, speed: 2, axis: 0, nudge: 0.06, a0: 0, n0: 0.06, pend: 0, t: 0, flips: 0,
    L: new Float64Array(3), q: new Float64Array(4), m: new Float64Array(9),
    trail: new Float32Array(TRAIL * 3), tn: 0, tip: new Float32Array(TIP * 9), pn: 0,
    zb: new Float32Array(W * HALF), rgb: new Float32Array(N * 3),
  };
  launch(params.s, 0, 0.06);
}

// A throw: |L| set so the handle would spin about the middle axis at OMEGA,
// the start direction moved from the middle axis toward e1 (Axis -1) or e3
// (Axis 1), then tipped by the nudge; the orientation is the least turn that
// sets that direction upright, so the angular momentum points straight up.
function launch(S, axis, nudge) {
  const t = (axis * PI) / 2, c0 = [max(0, -sin(t)), cos(t), max(0, sin(t))];
  let d = LEAN.map((v, k) => v - (LEAN[0] * c0[0] + LEAN[1] * c0[1] + LEAN[2] * c0[2]) * c0[k]);
  if (hypot(d[0], d[1], d[2]) < 1e-6) d = [1, 0, 0];
  d = nrm(d);
  const a = nudge * NUDGE, l = nrm(c0.map((v, k) => v * cos(a) + d[k] * sin(a))), Lm = OMEGA * S.I[1];
  for (let k = 0; k < 3; k++) S.L[k] = l[k] * Lm;
  // The least turn taking l to (0, 1, 0): about l x up, by the angle between.
  const ax = [-l[2], 0, l[0]], s = hypot(ax[0], ax[2]), ang = Math.atan2(s, l[1]);
  if (s < 1e-9) (S.q[0] = 1), (S.q[1] = S.q[2] = S.q[3] = 0);
  else (S.q[0] = cos(ang / 2)), (S.q[1] = (sin(ang / 2) * ax[0]) / s), (S.q[2] = 0), (S.q[3] = (sin(ang / 2) * ax[2]) / s);
  (S.a0 = axis), (S.n0 = nudge), (S.tn = 0), (S.pn = 0), (S.pend = 0), (S.flips = 0);
  // The polhode this throw rides: its energy is fixed, so it is fixed too.
  // The cap it bounds round its pole is tinted (1), the curve drawn in front
  // (2) and behind (3). The region code names the pole: 0 and 1 are +e1 and
  // -e1, 2 and 3 are +e3 and -e3.
  const iI = S.iI, e = l[0] * l[0] * iI[0] + l[1] * l[1] * iI[1] + l[2] * l[2] * iI[2], eS = iI[1];
  const reg = e > eS ? (l[0] > 0 ? 0 : 1) : l[2] > 0 ? 2 : 3, sg = e > eS ? 1 : -1;
  const { front, back, eF, eB, cap } = S;
  const inF = (i) => front[i] >= 0 && front[i] >> 2 === reg && sg * (eF[i] - e) > 0;
  const inB = (i) => back[i] >= 0 && back[i] >> 2 === reg && sg * (eB[i] - e) > 0;
  cap.fill(0);
  for (let y = 0; y < HALF; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (front[i] < 0) continue;
      const nb = [x + 1 < W ? i + 1 : -1, y + 1 < HALF ? i + W : -1, x > 0 ? i - 1 : -1, y > 0 ? i - W : -1];
      const f = inF(i), b = inB(i);
      if (f && nb.some((j) => j >= 0 && front[j] >= 0 && !inF(j))) cap[i] = 2;
      else if (f) cap[i] = 1;
      else if (b && nb.some((j) => j >= 0 && back[j] >= 0 && !inB(j))) cap[i] = 3;
    }
}

// Euler's equations dL/dt = L x w with w = L / I in the handle's frame, and
// the orientation dq/dt = q (0, w) / 2, stepped together by RK4.
function deriv(S, s, o) {
  const iI = S.iI, wx = s[0] * iI[0], wy = s[1] * iI[1], wz = s[2] * iI[2], w = s[3], x = s[4], y = s[5], z = s[6];
  o[0] = s[1] * wz - s[2] * wy;
  o[1] = s[2] * wx - s[0] * wz;
  o[2] = s[0] * wy - s[1] * wx;
  o[3] = -0.5 * (x * wx + y * wy + z * wz);
  o[4] = 0.5 * (w * wx + y * wz - z * wy);
  o[5] = 0.5 * (w * wy + z * wx - x * wz);
  o[6] = 0.5 * (w * wz + x * wy - y * wx);
}
const ST = new Float64Array(7), K1 = new Float64Array(7), K2 = new Float64Array(7), K3 = new Float64Array(7), K4 = new Float64Array(7), TMP = new Float64Array(7);
function step(S, h) {
  for (let k = 0; k < 3; k++) ST[k] = S.L[k];
  for (let k = 0; k < 4; k++) ST[3 + k] = S.q[k];
  deriv(S, ST, K1);
  for (let k = 0; k < 7; k++) TMP[k] = ST[k] + 0.5 * h * K1[k];
  deriv(S, TMP, K2);
  for (let k = 0; k < 7; k++) TMP[k] = ST[k] + 0.5 * h * K2[k];
  deriv(S, TMP, K3);
  for (let k = 0; k < 7; k++) TMP[k] = ST[k] + h * K3[k];
  deriv(S, TMP, K4);
  for (let k = 0; k < 7; k++) ST[k] += (h / 6) * (K1[k] + 2 * K2[k] + 2 * K3[k] + K4[k]);
  for (let k = 0; k < 3; k++) S.L[k] = ST[k];
  // Only the quaternion is renormalised; L is left as RK4 leaves it.
  const l = hypot(ST[3], ST[4], ST[5], ST[6]);
  for (let k = 0; k < 4; k++) S.q[k] = ST[3 + k] / l;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.axis = cl(k[2], -1, 1);
  S.nudge = cl(k[3], 0, 1);
  // A turned Axis or Nudge throws again once the knob has rested 0.3 s; the
  // first frame throws at once with the knobs it is handed.
  if (S.t === 0 && (S.axis !== S.a0 || S.nudge !== S.n0)) launch(S, S.axis, S.nudge);
  else if (abs(S.axis - S.a0) > 1e-4 || abs(S.nudge - S.n0) > 1e-4) {
    if (S.pend <= 0) S.pend = 0.3;
    if (abs(S.axis - (S.ax1 ?? S.axis)) > 1e-4 || abs(S.nudge - (S.nu1 ?? S.nudge)) > 1e-4) S.pend = 0.3;
    S.pend -= d;
    if (S.pend <= 0) launch(S, S.axis, S.nudge);
  }
  (S.ax1 = S.axis), (S.nu1 = S.nudge);
  if (input.btnPressed && input.btnPressed.some(Boolean)) launch(S, S.axis, S.nudge);
  // Speed 2 is real time; steps of at most 1/240 s of the handle's time.
  const span = (d * S.speed) / 2, n = max(1, ceil(span * 240));
  const was = S.L[1];
  for (let i = 0; i < n; i++) step(S, span / n);
  if (was > 0 !== S.L[1] > 0) S.flips++;
  S.t += d;
  const q = S.q, m = S.m, w = q[0], x = q[1], y = q[2], z = q[3];
  m[0] = 1 - 2 * (y * y + z * z), m[1] = 2 * (x * y - w * z), m[2] = 2 * (x * z + w * y);
  m[3] = 2 * (x * y + w * z), m[4] = 1 - 2 * (x * x + z * z), m[5] = 2 * (y * z - w * x);
  m[6] = 2 * (x * z - w * y), m[7] = 2 * (y * z + w * x), m[8] = 1 - 2 * (x * x + y * y);
  // The trails: the momentum's direction in the handle's frame, and where
  // the stem's tip is in space.
  const Lm = hypot(S.L[0], S.L[1], S.L[2]) || 1, o = (S.tn % TRAIL) * 3;
  for (let j = 0; j < 3; j++) S.trail[o + j] = S.L[j] / Lm;
  S.tn++;
  const ty = S.tipY, p = (S.pn % TIP) * 9;
  for (let j = 0; j < 3; j++) {
    S.tip[p + j] = m[j * 3 + 1] * ty;
    S.tip[p + 3 + j] = m[j * 3] * 1.1 - m[j * 3 + 1] * (1.35 - ty);
    S.tip[p + 6 + j] = -m[j * 3] * 1.1 - m[j * 3 + 1] * (1.35 - ty);
  }
  S.pn++;
}

// World (centre of mass at the origin, y up, z toward the camera) to the
// screen: [x, y, 1 / depth].
const CE = cos(ELEV), SE = sin(ELEV);
function proj(p, out, o) {
  const vx = p[0], vy = p[1] - CAMD * SE, vz = p[2] - CAMD * CE;
  const zc = -(vy * SE + vz * CE), ux = vx, uy = vy * CE - vz * SE;
  out[o] = 32 + (FOC * ux) / zc;
  out[o + 1] = CY0 - (FOC * uy) / zc;
  out[o + 2] = 1 / zc;
}

function tri(S, ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b) {
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (abs(area) < 1e-6) return;
  const x0 = max(0, floor(min(ax, bx, cx))), x1 = min(W - 1, ceil(max(ax, bx, cx)));
  const y0 = max(0, floor(min(ay, by, cy))), y1 = min(HALF - 2, ceil(max(ay, by, cy)));
  const zb = S.zb, rgb = S.rgb;
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area, w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const iz = w0 * az + w1 * bz + w2 * cz, i = y * W + x;
      if (iz <= zb[i]) continue;
      zb[i] = iz;
      (rgb[i * 3] = r), (rgb[i * 3 + 1] = g), (rgb[i * 3 + 2] = b);
    }
  }
}

// A line of LEDs from a to b in colour c times v, kept off LEDs the handle
// covers when depth is given.
function line(S, ax, ay, bx, by, c, v, y0, y1) {
  const steps = ceil(max(abs(bx - ax), abs(by - ay))) + 1, rgb = S.rgb;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps, x = floor(mix(ax, bx, t)), y = floor(mix(ay, by, t));
    if (x < 0 || x >= W || y < y0 || y > y1) continue;
    const i = y * W + x;
    if (y < HALF && S.zb[i] > 0) continue;
    (rgb[i * 3] = max(rgb[i * 3], c[0] * v)), (rgb[i * 3 + 1] = max(rgb[i * 3 + 1], c[1] * v)), (rgb[i * 3 + 2] = max(rgb[i * 3 + 2], c[2] * v));
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { m, zb, rgb, faces, cls } = S;
  // The three colours: A the crossbar and the e1 polhodes, B the stem, its
  // tip and the momentum, C the e3 polhodes. Warm ones are lifted.
  const hA = 0.58 + S.hue, hB = 0.09 + S.hue, hC = 0.79 + S.hue;
  const cA = hsv(hA, 0.8, 1), cB = hsv(hB, 0.82, 1), cC = hsv(hC, 0.62, 1), wB = warm(hB), wA = warm(hA), wC = warm(hC);
  const tipC = hsv(hB, 0.35, 1);
  rgb.fill(0);
  zb.fill(0);
  // The handle: each face that looks toward the camera, flat shaded.
  const wp = [0, 0, 0], sp = new Float64Array(12);
  for (const f of faces) {
    const n = f.n, nx = m[0] * n[0] + m[1] * n[1] + m[2] * n[2], ny = m[3] * n[0] + m[4] * n[1] + m[5] * n[2], nz = m[6] * n[0] + m[7] * n[1] + m[8] * n[2];
    const p0 = f.pts[0], cx = m[0] * p0[0] + m[1] * p0[1] + m[2] * p0[2], cy = m[3] * p0[0] + m[4] * p0[1] + m[5] * p0[2], cz = m[6] * p0[0] + m[7] * p0[1] + m[8] * p0[2];
    if (nx * cx + ny * (cy - CAMD * SE) + nz * (cz - CAMD * CE) >= 0) continue;
    for (let j = 0; j < 4; j++) {
      const p = f.pts[j];
      wp[0] = m[0] * p[0] + m[1] * p[1] + m[2] * p[2];
      wp[1] = m[3] * p[0] + m[4] * p[1] + m[5] * p[2];
      wp[2] = m[6] * p[0] + m[7] * p[1] + m[8] * p[2];
      proj(wp, sp, j * 3);
    }
    const lit = max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]), wm = f.part === 0 ? wA : wB;
    const sh = floor((0.3 + 0.45 * wm + (0.7 - 0.45 * wm) * lit) * 10) / 10, col = f.part === 0 ? cA : f.part === 1 ? cB : tipC;
    tri(S, sp[0], sp[1], sp[2], sp[3], sp[4], sp[5], sp[6], sp[7], sp[8], col[0] * sh, col[1] * sh, col[2] * sh);
    tri(S, sp[0], sp[1], sp[2], sp[6], sp[7], sp[8], sp[9], sp[10], sp[11], col[0] * sh, col[1] * sh, col[2] * sh);
  }
  // The angular momentum, fixed and upright: a dim line through the centre
  // of mass with an arrowhead at the top, where the handle does not cover it.
  const grey = [0.5, 0.5, 0.56];
  line(S, 32, 61, 32, 1, grey, 0.42, 0, HALF - 2);
  line(S, 32, 1, 28, 5, grey, 0.42, 0, HALF - 2), line(S, 32, 1, 36, 5, grey, 0.42, 0, HALF - 2);
  // The stem tip's path over the last 1.3 s and the crossbar ends' over the
  // last 0.3 s, older steps dimmer.
  const a = new Float64Array(3), b2 = new Float64Array(3);
  for (let j = 1; j < min(S.pn, TIP); j++)
    for (let e = 0; e < 3; e++) {
      if (e && j > 10) break;
      const i0 = ((S.pn - j) % TIP) * 9 + e * 3, i1 = ((S.pn - j - 1) % TIP) * 9 + e * 3;
      const v = e ? 0.15 + 0.45 * floor((1 - j / 10) * 4) / 4 : 0.2 + 0.6 * floor((1 - j / TIP) * 5) / 5;
      proj(S.tip.subarray(i0, i0 + 3), a, 0);
      proj(S.tip.subarray(i1, i1 + 3), b2, 0);
      line(S, a[0], a[1], b2[0], b2[1], e ? cA : cB, v, 0, HALF - 2);
    }
  // The momentum sphere, its classes coloured for this hue.
  const lift = (c, v, w) => [c[0] * v * (1 + 0.5 * w), c[1] * v * (1 + 0.5 * w), c[2] * v * (1 + 0.5 * w)];
  const pal = [
    [0, 0, 0], lift(cA, 0.17, wA), lift(cC, 0.17, wC), [0.27, 0.27, 0.32], [0.48, 0.48, 0.54],
    lift(cA, 0.62, wA), lift(cC, 0.62, wC), [0.7, 0.7, 0.76], [0.34, 0.34, 0.4],
  ];
  const capA = lift(cA, 0.3, wA), capC = lift(cC, 0.3, wC), orb = lift(cB, 0.5, 0), orbB = lift(cB, 0.27, 0), cap = S.cap;
  for (let i = 0; i < W * HALF; i++) {
    const k = cls[i], o = (i + W * HALF) * 3, f = cap[i];
    let c = pal[k];
    if (f === 2 && k !== 8) c = orb;
    else if (f === 1 && k < 3) c = k === 1 ? capA : capC;
    else if (f === 3 && k < 3) c = orbB;
    (rgb[o] = c[0]), (rgb[o + 1] = c[1]), (rgb[o + 2] = c[2]);
  }
  // The two ends of the middle axis, where the separatrices cross, ringed in
  // the stem's colour.
  const { R, U, B } = S, scr = (p) => [SX + SR * (p[0] * R[0] + p[1] * R[1] + p[2] * R[2]), SY - SR * (p[0] * U[0] + p[1] * U[1] + p[2] * U[2]), p[0] * B[0] + p[1] * B[1] + p[2] * B[2]];
  for (const sg of [1, -1]) {
    const [x, y, z] = scr([0, sg, 0]), v = z > 0 ? 0.9 : 0.5;
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) line(S, x + dx, y + dy, x + dx, y + dy, cB, v, HALF, H - 1);
  }
  // The momentum's trail in the handle's frame over the last 5 s: in front
  // of the sphere bright, behind it dimmer, older steps dimmer still.
  const cnt = min(S.tn, TRAIL), tr = S.trail;
  for (let j = 1; j < cnt; j++) {
    const i0 = ((S.tn - j) % TRAIL) * 3, i1 = ((S.tn - j - 1) % TRAIL) * 3;
    const p = scr([tr[i0], tr[i0 + 1], tr[i0 + 2]]), q = scr([tr[i1], tr[i1 + 1], tr[i1 + 2]]);
    const v = (0.3 + 0.7 * floor((1 - j / TRAIL) * 5) / 5) * (p[2] + q[2] > 0 ? 1 : 0.45) * (1 + 0.3 * wB);
    line(S, p[0], p[1], q[0], q[1], cB, v, HALF, H - 1);
    line(S, p[0] + 1, p[1], q[0] + 1, q[1], cB, v * 0.8, HALF, H - 1);
  }
  // The momentum now: a bright dot, white at the centre.
  const nowI = ((S.tn - 1 + TRAIL) % TRAIL) * 3, now = scr([tr[nowI], tr[nowI + 1], tr[nowI + 2]]);
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const x = floor(now[0]) + dx, y = floor(now[1]) + dy, r = abs(dx) + abs(dy);
      if (r > 2 || x < 0 || x >= W || y < HALF || y >= H) continue;
      const o = (y * W + x) * 3, c = r === 0 ? [1, 1, 1] : r === 1 ? tipC : cB;
      (rgb[o] = c[0]), (rgb[o + 1] = c[1]), (rgb[o + 2] = c[2]);
    }
  for (let i = 0; i < N; i++)
    display.setPixel(i % W, floor(i / W), (255 * cl(rgb[i * 3], 0, 1)) | 0, (255 * cl(rgb[i * 3 + 1], 0, 1)) | 0, (255 * cl(rgb[i * 3 + 2], 0, 1)) | 0);
}
