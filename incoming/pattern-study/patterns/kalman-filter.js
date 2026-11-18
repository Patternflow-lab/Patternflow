// ===== Patternflow pattern =====
// Title:   Kalman Filter
// Family:  sim
// Idea:    A hidden target wanders the panel while a sensor whose error is wide across its line of sight sends one noisy cross at a time, and a 4-state Kalman filter follows it: between crosses the position covariance swells as an ellipse drawn from its eigen-decomposition, and at each cross the Kalman gain pulls the bright estimate part of the way to the cross and the ellipse snaps smaller, so the estimate stays near the faint true path while the crosses scatter around it.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kalman filter (Rudolf Kalman, 1960), constant-velocity model with white-noise acceleration, covariance update in the Joseph form; hsv and tint helpers from de-casteljau; pattern round 111
// Round:   111
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..5, Noise=-1..1, Manoeuvre=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the estimate is pale cyan, the ellipse and the confidence tube behind it magenta, the crosses orange, the true path green and the sensor in the middle of the panel blue-grey. Orange and yellow are made paler so they do not dim to brown.
// Knob 2: Speed. The rate of the simulated clock, Speed / 2 seconds a second, so 2 is real time. A cross arrives every 0.6 s of simulated time: every 0.6 s at 2, every 2.4 s at 0.5 and every 0.24 s at 5. The target, the filter and the life of a cross (5.4 s) all run at that rate.
// Knob 3: Noise. The sensor's error, the R of the filter. Across its line of sight the standard deviation is 6 LEDs at 0 and along it a third of that, 2 LEDs. At -1 that is 2.6 and 0.9, the crosses sit close to the path and the 95 percent ellipse is 10 by 4 LEDs once a cross has landed; at 1 it is 13.8 and 4.6, the crosses scatter far, the ellipse is 38 by 16 and the estimate lags behind the target.
// Knob 4: Manoeuvre. How hard the target accelerates at random, the Q of the filter, given as the change of speed after one second, one standard deviation on each axis: 0.54 LEDs a second at -1, 2.0 at 0 and 7.5 at 1. At -1 the path is a long lazy curve; at 1 the target swerves every second, its speed limit rises from 8.5 to 15.5 LEDs a second, the ellipse swells further between crosses and the estimate catches up in jumps.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, sin, cos, sqrt, exp, atan2, hypot, PI, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fr = (v) => v - floor(v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A colour that does not go brown: orange and yellow are paler and a little lighter.
function tint(h, s, v, out) {
  const f = fr(h);
  if (f > 0.02 && f < 0.2) {
    s *= 0.6;
    v = min(1, v * 1.2);
  }
  hsv(h, s, v, out);
}

// For the washes that are drawn dim: the warm hues, where a dim orange turns brown, are paled further.
function wash(h, s, v, out) {
  const f = fr(h);
  tint(h, f > 0.97 || f < 0.2 ? s * 0.3 : s, v, out);
}

const TM = 0.6; // seconds of simulated time between two measurements
const CLOCK = 0.5; // simulated seconds per second at Speed 1, so Speed 2 runs the clock at real time
const SUB = 1 / 24; // longest step of the simulation, in simulated seconds
const SENSOR = [32, 64]; // where the sensor stands: it sees the target's bearing sharply and its range hardly at all
const FAN = 3; // the error across the line of sight is this many times the error along it
const CHI95 = 5.991; // the chi-square value with 2 degrees of freedom that holds 95 percent
const CHI68 = 2.279; // and 68 percent
const LIFE = 5.4; // a cross lives this many simulated seconds: full size, then short arms, then gone
const GHOST = 0.45; // the ellipse before an update lingers this long
const WALL = [4, 59, 6, 121]; // the target bounces inside this box: x0, x1, y0, y1
const PREROLL = 24; // simulated seconds run before the first frame so the filter has settled
const NT = 200; // true path and confidence tube points, one every 0.1 s
const NE = 36; // estimate trail points, one every 0.05 s

// ---- the filter: state (x, y, vx, vy), 4 x 4 matrices, row-major ----------
function mul(A, B, C) {
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += A[i * 4 + k] * B[k * 4 + j];
      C[i * 4 + j] = s;
    }
}
function mulT(A, B, C) {
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += A[i * 4 + k] * B[j * 4 + k];
      C[i * 4 + j] = s;
    }
}
function kfNew() {
  return {
    x: new Float64Array(4), P: new Float64Array(16), F: new Float64Array(16), A: new Float64Array(16),
    T1: new Float64Array(16), T2: new Float64Array(16), K: new Float64Array(8),
  };
}
// x <- F x and P <- F P F^T + Q for a step of h seconds. F = [[I, hI], [0, I]];
// Q = q [[h^3/3 I, h^2/2 I], [h^2/2 I, h I]] is the white-noise acceleration
// model, and it composes: two half steps make the one whole step.
function kfPredict(kf, h, q) {
  const { x, P, F, T1, T2 } = kf;
  F.fill(0);
  F[0] = F[5] = F[10] = F[15] = 1;
  F[2] = h;
  F[7] = h;
  mul(F, P, T1);
  mulT(T1, F, T2);
  const h2 = h * h, h3 = h2 * h;
  T2[0] += (q * h3) / 3;
  T2[5] += (q * h3) / 3;
  T2[2] += (q * h2) / 2;
  T2[8] += (q * h2) / 2;
  T2[7] += (q * h2) / 2;
  T2[13] += (q * h2) / 2;
  T2[10] += q * h;
  T2[15] += q * h;
  P.set(T2);
  x[0] += h * x[2];
  x[1] += h * x[3];
}
// A measurement z of the position, with error covariance R = [r00, r01, r11].
// H picks the first two states, so S = P[0..1, 0..1] + R, K = P H^T S^-1, and
// the covariance goes through the Joseph form (I - K H) P (I - K H)^T + K R K^T.
function kfUpdate(kf, z0, z1, R) {
  const { x, P, A, T1, T2, K } = kf;
  const s00 = P[0] + R[0], s01 = P[1] + R[1], s11 = P[5] + R[2];
  const det = s00 * s11 - s01 * s01, i00 = s11 / det, i01 = -s01 / det, i11 = s00 / det;
  for (let i = 0; i < 4; i++) {
    K[i * 2] = P[i * 4] * i00 + P[i * 4 + 1] * i01;
    K[i * 2 + 1] = P[i * 4] * i01 + P[i * 4 + 1] * i11;
  }
  const y0 = z0 - x[0], y1 = z1 - x[1];
  for (let i = 0; i < 4; i++) x[i] += K[i * 2] * y0 + K[i * 2 + 1] * y1;
  A.fill(0);
  for (let i = 0; i < 4; i++) {
    A[i * 5] = 1;
    A[i * 4] -= K[i * 2];
    A[i * 4 + 1] -= K[i * 2 + 1];
  }
  mul(A, P, T1);
  mulT(T1, A, T2);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
      T2[i * 4 + j] +=
        K[i * 2] * (R[0] * K[j * 2] + R[1] * K[j * 2 + 1]) + K[i * 2 + 1] * (R[1] * K[j * 2] + R[2] * K[j * 2 + 1]);
  P.set(T2);
}
// The sensor's error covariance for a target seen from SENSOR at (ex, ey):
// sr along the line of sight, sc = FAN sr across it.
function noiseR(ex, ey, sr, sc, out) {
  const a = atan2(ey - SENSOR[1], ex - SENSOR[0]), c = cos(a), s = sin(a);
  out[0] = sr * sr * c * c + sc * sc * s * s;
  out[1] = (sr * sr - sc * sc) * c * s;
  out[2] = sr * sr * s * s + sc * sc * c * c;
}
// The ellipse of a position covariance [[a, b], [b, c]]: the eigenvalues and
// the angle of the major axis, and the semi-axes that hold 95 percent.
function eigen(a, b, c, out) {
  const m = (a + c) / 2, d = sqrt(((a - c) / 2) ** 2 + b * b);
  const l1 = m + d, l2 = max(m - d, 1e-9);
  out[0] = 0.5 * atan2(2 * b, a - c);
  out[1] = sqrt(CHI95 * l1);
  out[2] = sqrt(CHI95 * l2);
}

function gauss() {
  return sqrt(-2 * Math.log(1 - Math.random())) * cos(2 * PI * Math.random());
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, noise: 0, manu: 0.06, sc: 6, sr: 2, q: 6, vmax: 15,
    init: true, time: 0, nextM: TM, nextT: 0, nextE: 0,
    kf: kfNew(),
    tr: new Float64Array(4), // true x, y, vx, vy
    ht: new Float32Array(NT * 2), nt: 0, // true path ring: points, count so far
    hc: new Float32Array(NT * 5), // the estimate and its inverse position covariance at those times: the confidence tube
    he: new Float32Array(NE * 2), ne: 0,
    crosses: [], // {x, y, t}
    ghost: null, // the ellipse just before the last update
    jump: null, // prior estimate to the cross, for the line that shows the gain
    gain: [0, 0],
    buf: new Float32Array(W * H * 3),
  };
}

// The target for h seconds: the same white-noise acceleration the filter assumes,
// drawn exactly (Cholesky of Q(h)); walls turn it back and a speed limit holds it.
function truthStep(S, h) {
  const q = S.q, t = S.tr;
  const l11 = sqrt((q * h * h * h) / 3), l21 = (q * h * h) / 2 / l11, l22 = 0.5 * sqrt(q * h);
  for (let a = 0; a < 2; a++) {
    const z1 = gauss(), z2 = gauss();
    t[a] += h * t[a + 2] + l11 * z1;
    t[a + 2] += l21 * z1 + l22 * z2;
  }
  const sp = hypot(t[2], t[3]);
  if (sp > S.vmax) {
    t[2] *= S.vmax / sp;
    t[3] *= S.vmax / sp;
  }
  if (t[0] < WALL[0]) { t[0] = 2 * WALL[0] - t[0]; t[2] = abs(t[2]); }
  if (t[0] > WALL[1]) { t[0] = 2 * WALL[1] - t[0]; t[2] = -abs(t[2]); }
  if (t[1] < WALL[2]) { t[1] = 2 * WALL[2] - t[1]; t[3] = abs(t[3]); }
  if (t[1] > WALL[3]) { t[1] = 2 * WALL[3] - t[1]; t[3] = -abs(t[3]); }
}

const R2 = [0, 0, 0], EG = [0, 0, 0];
function measure(S) {
  const t = S.tr, kf = S.kf;
  // The cross: the true position plus the sensor's error, wide across the line of sight.
  const a = atan2(t[1] - SENSOR[1], t[0] - SENSOR[0]), c = cos(a), s = sin(a);
  const nr = S.sr * gauss(), nc = S.sc * gauss();
  const z0 = t[0] + nr * c - nc * s, z1 = t[1] + nr * s + nc * c;
  // The filter knows the sensor's fan but not the true position, so it lays the
  // fan along the bearing of the cross it received.
  noiseR(z0, z1, S.sr, S.sc, R2);
  eigen(kf.P[0], kf.P[1], kf.P[5], EG);
  S.ghost = { x: kf.x[0], y: kf.x[1], a: EG[0], p: EG[1], q: EG[2], t: S.time };
  S.jump = { x: kf.x[0], y: kf.x[1], t: S.time };
  kfUpdate(kf, z0, z1, R2);
  S.crosses.push({ x: z0, y: z1, t: S.time });
  if (S.crosses.length > 14) S.crosses.shift();
  // Gain along and across the line of sight: u^T K u for the unit vectors u.
  const K = kf.K;
  const ug = (ux, uy) => ux * (K[0] * ux + K[1] * uy) + uy * (K[2] * ux + K[3] * uy);
  S.gain[0] = ug(c, s);
  S.gain[1] = ug(-s, c);
}

function advance(S, ds) {
  let rem = ds;
  const kf = S.kf;
  while (rem > 1e-9) {
    const h = max(1e-6, min(rem, SUB, S.nextM - S.time));
    truthStep(S, h);
    kfPredict(kf, h, S.q);
    S.time += h;
    rem -= h;
    if (S.time >= S.nextM - 1e-9) {
      measure(S);
      S.nextM += TM;
    }
    while (S.time >= S.nextT) {
      const i = S.nt % NT;
      S.ht[i * 2] = S.tr[0];
      S.ht[i * 2 + 1] = S.tr[1];
      const a = kf.P[0], b = kf.P[1], c = kf.P[5], det = max(a * c - b * b, 1e-9);
      S.hc[i * 5] = kf.x[0];
      S.hc[i * 5 + 1] = kf.x[1];
      S.hc[i * 5 + 2] = c / det;
      S.hc[i * 5 + 3] = -b / det;
      S.hc[i * 5 + 4] = a / det;
      S.nt++;
      S.nextT += 0.1;
    }
    while (S.time >= S.nextE) {
      const i = S.ne % NE;
      S.he[i * 2] = kf.x[0];
      S.he[i * 2 + 1] = kf.x[1];
      S.ne++;
      S.nextE += 0.05;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 5);
  S.noise = cl(k[2], -1, 1);
  S.manu = cl(k[3], -1, 1);
  S.sc = 6 * pow(2, 1.2 * S.noise);
  S.sr = S.sc / FAN;
  S.q = pow(2 * pow(2, 1.9 * S.manu), 2); // the change of speed in one second, squared
  S.vmax = 8 + sqrt(S.q);
  if (S.init) {
    S.init = false;
    const a = Math.random() * 2 * PI;
    S.tr[0] = 32; S.tr[1] = 64; S.tr[2] = 7 * cos(a); S.tr[3] = 7 * sin(a);
    const x = S.kf.x, P = S.kf.P;
    x[0] = S.tr[0]; x[1] = S.tr[1]; x[2] = 0; x[3] = 0;
    P.fill(0);
    P[0] = P[5] = S.sc * S.sc;
    P[10] = P[15] = 100;
    advance(S, PREROLL);
  }
  advance(S, d * S.speed * CLOCK);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, kf = S.kf;
  buf.fill(0);
  const put = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    const r = c[0] * a, g = c[1] * a, b = c[2] * a;
    if (r > buf[o]) buf[o] = r;
    if (g > buf[o + 1]) buf[o + 1] = g;
    if (b > buf[o + 2]) buf[o + 2] = b;
  };
  const splat = (x, y, c, a) => {
    const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
    put(xi, yi, c, a * (1 - fx) * (1 - fy));
    put(xi + 1, yi, c, a * fx * (1 - fy));
    put(xi, yi + 1, c, a * (1 - fx) * fy);
    put(xi + 1, yi + 1, c, a * fx * fy);
  };
  // A line anti-aliased along its longer axis, one column or row at a time.
  const line = (x0, y0, x1, y1, c, a) => {
    const dx = x1 - x0, dy = y1 - y0;
    if (abs(dx) >= abs(dy)) {
      if (x0 > x1) return line(x1, y1, x0, y0, c, a);
      const g = dx === 0 ? 0 : dy / dx;
      for (let x = ceil(x0); x <= floor(x1); x++) {
        const y = y0 + g * (x - x0), yi = floor(y), f = y - yi;
        put(x, yi, c, a * (1 - f));
        put(x, yi + 1, c, a * f);
      }
    } else {
      if (y0 > y1) return line(x1, y1, x0, y0, c, a);
      const g = dx / dy;
      for (let y = ceil(y0); y <= floor(y1); y++) {
        const x = x0 + g * (y - y0), xi = floor(x), f = x - xi;
        put(xi, y, c, a * (1 - f));
        put(xi + 1, y, c, a * f);
      }
    }
    splat(x0, y0, c, a * 0.5);
    splat(x1, y1, c, a * 0.5);
  };
  const disc = (cx, cy, r, c, a) => {
    for (let y = floor(cy - r - 1); y <= ceil(cy + r + 1); y++)
      for (let x = floor(cx - r - 1); x <= ceil(cx + r + 1); x++) {
        const dd = hypot(x - cx, y - cy);
        put(x, y, c, a * cl(r + 0.6 - dd, 0, 1));
      }
  };
  // The ellipse centred on (mx, my), major axis at angle an, semi-axes p and q.
  const ring = (mx, my, an, p, q, c, a) => {
    const ca = cos(an), sa = sin(an), N = 44;
    let px = 0, py = 0;
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * 2 * PI, u = p * cos(th), v = q * sin(th);
      const x = mx + u * ca - v * sa, y = my + u * sa + v * ca;
      if (i) line(px, py, x, y, c, a);
      px = x;
      py = y;
    }
  };

  const hb = 0.5 + S.hue;
  const CC = [0, 0, 0], GH = [0, 0, 0], EST = [0, 0, 0], ELL = [0, 0, 0], ELLD = [0, 0, 0], CRS = [0, 0, 0], FLASH = [0, 0, 0], TRUE = [0, 0, 0], SENS = [0, 0, 0];
  tint(hb, 0.3, 1, EST);
  tint(hb + 0.32, 0.85, 1, ELL);
  wash(hb + 0.32, 0.9, 1, ELLD);
  tint(hb + 0.32, 0.3, 1, GH);
  tint(hb + 0.58, 0.9, 1, CRS);
  tint(hb + 0.58, 0.25, 1, FLASH);
  tint(hb - 0.17, 0.55, 1, TRUE);
  tint(hb + 0.05, 0.4, 1, SENS);

  const T = S.time, ex = kf.x[0], ey = kf.x[1];
  eigen(kf.P[0], kf.P[1], kf.P[5], EG);
  const an = EG[0], pa = max(1.1, EG[1]), pb = max(0.8, EG[2]);

  // The confidence tube: the 95 percent ellipse the filter held every 0.1 s, a
  // dim wash that fades with age, so the width of the path is how sure it was.
  {
    const n = min(S.nt, NT);
    for (let j = n - 1; j >= 1; j--) {
      const i = (S.nt - 1 - j) % NT, mx = S.hc[i * 5], my = S.hc[i * 5 + 1], i00 = S.hc[i * 5 + 2], i01 = S.hc[i * 5 + 3], i11 = S.hc[i * 5 + 4];
      const det = max(i00 * i11 - i01 * i01, 1e-12), p00 = i11 / det, p11 = i00 / det;
      const rx = sqrt(CHI68 * p00) + 1, ry = sqrt(CHI68 * p11) + 1, al = 0.2 * (1 - j / n) + 0.05;
      for (let y = max(0, floor(my - ry)); y <= min(H - 1, ceil(my + ry)); y++)
        for (let x = max(0, floor(mx - rx)); x <= min(W - 1, ceil(mx + rx)); x++) {
          const dx = x + 0.5 - mx, dy = y + 0.5 - my;
          if (dx * (i00 * dx + i01 * dy) + dy * (i01 * dx + i11 * dy) < CHI68) put(x, y, ELLD, al);
        }
    }
  }

  // The belief as a glow: Gaussian density of the position, brightest at the estimate.
  {
    const a = kf.P[0], b = kf.P[1], c = kf.P[5], det = max(a * c - b * b, 1e-9);
    const i00 = c / det, i01 = -b / det, i11 = a / det;
    const rr = ceil(max(pa, pb)) + 1;
    for (let y = max(0, floor(ey - rr)); y <= min(H - 1, ceil(ey + rr)); y++)
      for (let x = max(0, floor(ex - rr)); x <= min(W - 1, ceil(ex + rr)); x++) {
        const dx = x + 0.5 - ex, dy = y + 0.5 - ey, d2 = dx * (i00 * dx + i01 * dy) + dy * (i01 * dx + i11 * dy);
        if (d2 < CHI95) put(x, y, ELLD, 0.34 * exp(-0.225 * d2));
      }
  }

  // The sensor, and the line of sight to the estimate.
  {
    const dx = ex - SENSOR[0], dy = ey - SENSOR[1], l = hypot(dx, dy) || 1;
    for (let r = 4; r < l - 6; r += 4) put(floor(SENSOR[0] + (dx * r) / l), floor(SENSOR[1] + (dy * r) / l), SENS, 0.3);
    put(SENSOR[0], SENSOR[1], SENS, 0.6);
    put(SENSOR[0] - 1, SENSOR[1], SENS, 0.5);
    put(SENSOR[0] + 1, SENSOR[1], SENS, 0.5);
    put(SENSOR[0], SENSOR[1] - 1, SENS, 0.5);
    put(SENSOR[0], SENSOR[1] + 1, SENS, 0.5);
  }

  // The true path, dotted: one LED every 0.2 s, older ones fainter.
  {
    const n = min(S.nt, NT);
    for (let j = 0; j < n; j += 2) {
      const i = (S.nt - 1 - j) % NT, age = j / NT;
      put(floor(S.ht[i * 2]), floor(S.ht[i * 2 + 1]), TRUE, 0.62 * (1 - age) + 0.16);
    }
    disc(S.tr[0], S.tr[1], 0.4, TRUE, 0.8);
  }

  // The crosses, newest in a flash and then the colour of the sensor, fading.
  for (const c of S.crosses) {
    const age = (T - c.t) / LIFE;
    if (age >= 1) continue;
    const a = 1 - 0.55 * age, x = round(c.x), y = round(c.y), reach = age < 0.6 ? 2 : age < 0.85 ? 1 : 0;
    let col = FLASH;
    if (T - c.t >= 0.25) {
      tint(hb + 0.58, 0.9 - 0.45 * age, 1, CC);
      col = CC;
    }
    for (let k = -reach; k <= reach; k++) {
      put(x + k, y, col, a);
      if (k) put(x, y + k, col, a);
    }
  }

  // The pull of the update: from the estimate as it stood to the cross.
  if (S.jump && T - S.jump.t < 0.5 && S.crosses.length) {
    const c = S.crosses[S.crosses.length - 1], f = 1 - (T - S.jump.t) / 0.5;
    line(S.jump.x, S.jump.y, c.x, c.y, CRS, 0.5 * f);
  }

  // The ellipse before the last update, fading as the new one takes over.
  if (S.ghost && T - S.ghost.t < GHOST) {
    const f = 1 - (T - S.ghost.t) / GHOST;
    ring(S.ghost.x, S.ghost.y, S.ghost.a, max(1.1, S.ghost.p), max(0.8, S.ghost.q), GH, 0.75 * f);
  }

  // The ellipse now: the 95 percent contour, with its two axes from the eigen-decomposition.
  ring(ex, ey, an, pa, pb, ELL, 0.95);
  {
    const ca = cos(an), sa = sin(an);
    line(ex - pa * ca, ey - pa * sa, ex + pa * ca, ey + pa * sa, ELL, 0.4);
    line(ex + pb * sa, ey - pb * ca, ex - pb * sa, ey + pb * ca, ELL, 0.4);
  }

  // The estimate: a short trail and a bright dot.
  {
    const n = min(S.ne, NE);
    let px = ex, py = ey;
    for (let j = 0; j < n; j++) {
      const i = (S.ne - 1 - j) % NE, x = S.he[i * 2], y = S.he[i * 2 + 1];
      line(px, py, x, y, EST, 0.9 * (1 - j / NE));
      px = x;
      py = y;
    }
    disc(ex, ey, 1.5, EST, 1);
  }

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3] * 255), min(255, buf[p * 3 + 1] * 255), min(255, buf[p * 3 + 2] * 255));
}
