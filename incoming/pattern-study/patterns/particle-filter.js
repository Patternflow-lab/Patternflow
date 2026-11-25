// ===== Patternflow pattern =====
// Title:   Particle Filter
// Family:  particlefilter
// Idea:    Four fixed beacons ping a hidden robot that wanders the panel, each ping a thin additive ring of its own colour whose radius is the noisy range to the robot and which fades in about a second, while nine hundred pale lilac particles, the filter's hypotheses of where the robot is, are weighted by the range likelihood and resampled at every ping, so with three beacons the cloud is one blob on the ring crossings, with two it splits into two lobes either side of the line between them, and each time the robot is kidnapped to a new place the cloud blows out to a haze and collapses on to the new rings within a few pings.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: bootstrap particle filter, weights from the measurement likelihood and resampling of the whole set at every measurement (Gordon, Salmond and Smith 1993, "Novel approach to nonlinear/non-Gaussian Bayesian state estimation"), systematic resampling and roughening of the resampled set (from memory), the kidnapped robot problem of mobile robot localisation (from memory); the beacons, the rings, the haze and the reflected lobes are original, pattern round 243
// Round:   243
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Noise=0..6, Beacons=-1..1, Speed=-1..1
//
// Knob 1: Hue. Turns the beacon colours and the cloud round the wheel together. At 0 the first three beacons are cyan, magenta and a warm yellow, the fourth a periwinkle blue, and the cloud is pale lilac. Where two rings cross the sum goes nearly white.
// Knob 2: Noise. 0 to 6, opening at 2. The spread of the range sensor: 1 LED at 0, 3.7 at 2 and 9 at 6. Low, the rings are thin and sharp, the cloud a tight blob 3 LED across. High, the rings are 7 LED wide and soft, the crossings are patches, and the cloud is a big loose ball.
// Knob 3: Beacons. -1 to 1, opening at 0. How many beacons ping: 2 at -1, 3 at 0 and 4 at 1, the third and fourth fading in or out as the knob passes them. With 2 the rings cross at two points and the cloud holds two lobes either side of the diagonal between the beacons; with 3 or 4 it is one blob.
// Knob 4: Speed. -1 to 1, opening at about 0. How fast the robot goes, 0.3 times at -1, 1 at 0 and 3 times at 1, from 1.6 LED a second to 5.5 to 16, and how often it is kidnapped, every 20 to 40 s at 1 times and every 7 to 13 s at 3 times. Fast, the cloud smears out behind the robot and loses it now and then.

const W = 64, H = 128, N = 900;
const { floor, min, max, abs, exp, sqrt, sin, cos, atan2, hypot, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fr = (v) => v - floor(v);
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

const BX = [10, 54, 54, 12], BY = [16, 112, 40, 90]; // beacons, LED
const BH = [0.5, 0.833, 0.167, 0.667];                // hue of each at knob 0
const BS = [0.9, 0.9, 0.85, 0.72];
const PER = [0.78, 0.98, 0.86, 1.08];                 // mean seconds between pings
const AX0 = 2, AX1 = W - 2, AY0 = 2, AY1 = H - 2;     // the arena the particles live in
const RM = 7;                                         // the robot turns back this far from the edge
const LAND = 0.14;                                    // seconds a ping takes to reach its radius
const FADE = 1.35;                                    // seconds a ring lasts
const PR = 1.75, PR2 = PR * PR;                       // particle disc radius, LED

function hsv(h, s, v, out) {
  h = fr(h) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const m = i % 6;
  out[0] = m === 0 || m === 5 ? v : m === 1 ? q : m === 4 ? t : p;
  out[1] = m === 1 || m === 2 ? v : m === 0 ? t : m === 3 ? q : p;
  out[2] = m === 3 || m === 4 ? v : m === 2 ? t : m === 5 ? q : p;
}

export function setup(params) {
  const f = (n) => new Float32Array(n);
  const st = (params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, sg: 3.7, scale: 1, nb: 3,
    px: f(N), py: f(N), vx: f(N), vy: f(N), ox: f(N), oy: f(N), al: f(N),
    qx: f(N), qy: f(N), qvx: f(N), qvy: f(N), qox: f(N), qoy: f(N), qal: f(N),
    L: f(N), idx: new Int32Array(N),
    rx: 32, ry: 64, hd: rnd() * 2 * PI, om: 0, spm: 1, kt: 20 + 20 * rnd(),
    act: [1, 1, 1, 0], tm: [0.1, 0.5, 0.8, 0.3], fl: [0, 0, 0, 0],
    rings: [], hz: 0,
    fb: f(W * H * 3), P: f(W * H), col: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], lil: [0, 0, 0],
  });
  for (let i = 0; i < N; i++) {
    st.px[i] = AX0 + rnd() * (AX1 - AX0);
    st.py[i] = AY0 + rnd() * (AY1 - AY0);
    st.al[i] = 1;
  }
  st.rx = RM + rnd() * (W - 2 * RM);
  st.ry = RM + rnd() * (H - 2 * RM);
  return st;
}

// ---- the filter ---------------------------------------------------------------
function uniformAt(st, i, sv) {
  st.px[i] = AX0 + rnd() * (AX1 - AX0);
  st.py[i] = AY0 + rnd() * (AY1 - AY0);
  st.vx[i] = gauss() * sv;
  st.vy[i] = gauss() * sv;
  st.ox[i] = 0;
  st.oy[i] = 0;
  st.al[i] = 0;
}

// One range measurement z from beacon b with spread sg: weight, resample, roughen.
function pfUpdate(st, b, z, sg) {
  const { px, py, L } = st, bx = BX[b], by = BY[b];
  let s1 = 1.1 * sg + 0.4, sum = 0;
  for (let i = 0; i < N; i++) {
    const e = (hypot(px[i] - bx, py[i] - by) - z) / s1;
    sum += L[i] = exp(-0.5 * e * e);
  }
  // nearly every weight near zero: the robot has gone somewhere the cloud is not. Widen the likelihood, mix in uniform particles.
  const deg = sum / N < 0.02;
  if (deg) {
    s1 = 3.2 * s1 + 3;
    sum = 0;
    for (let i = 0; i < N; i++) {
      const e = (hypot(px[i] - bx, py[i] - by) - z) / s1;
      sum += L[i] = exp(-0.5 * e * e);
    }
    st.hz = 1;
  }
  if (!(sum > 1e-12)) {
    for (let i = 0; i < N; i++) L[i] = 1;
    sum = N;
  }
  // systematic resampling
  const step = sum / N, idx = st.idx;
  let c = L[0], j = 0;
  const u0 = rnd() * step;
  for (let k = 0; k < N; k++) {
    const tg = u0 + k * step;
    while (c < tg && j < N - 1) c += L[++j];
    idx[k] = j;
  }
  const sv = (0.55 * 5.5 * st.scale + 1) * (1 + 2.2 * st.hz), sr = (0.35 + 0.06 * sg) * (1 + 3 * st.hz);
  const { vx, vy, ox, oy, al, qx, qy, qvx, qvy, qox, qoy, qal } = st;
  for (let k = 0; k < N; k++) {
    const j2 = idx[k];
    const nx = px[j2] + gauss() * sr, ny = py[j2] + gauss() * sr;
    qx[k] = nx;
    qy[k] = ny;
    qox[k] = px[j2] + ox[j2] - nx; // the copy starts where its parent is drawn and glides out
    qoy[k] = py[j2] + oy[j2] - ny;
    qvx[k] = 0.75 * vx[j2] + 0.66 * sv * gauss();
    qvy[k] = 0.75 * vy[j2] + 0.66 * sv * gauss();
    qal[k] = al[j2];
  }
  st.px = qx; st.py = qy; st.vx = qvx; st.vy = qvy; st.ox = qox; st.oy = qoy; st.al = qal;
  st.qx = px; st.qy = py; st.qvx = vx; st.qvy = vy; st.qox = ox; st.qoy = oy; st.qal = al;
  if (deg) for (let k = 0; k < N; k++) if (rnd() < 0.3) uniformAt(st, k, sv);
  // two beacons: the rings cross twice and the posterior is symmetric about the line between them, so a few particles
  // are moved across it. Without that the drift of resampling would sooner or later empty one lobe.
  if (st.act[2] < 0.5) {
    let dx = BX[1] - BX[0], dy = BY[1] - BY[0];
    const dl = hypot(dx, dy);
    dx /= dl;
    dy /= dl;
    for (let k = 0; k < N; k++) {
      if (rnd() > 0.035) continue;
      const ax = st.px[k] - BX[0], ay = st.py[k] - BY[0], along = ax * dx + ay * dy;
      const mx = BX[0] + 2 * along * dx - ax, my = BY[0] + 2 * along * dy - ay;
      if (mx < AX0 || mx > AX1 || my < AY0 || my > AY1) continue;
      st.px[k] = mx;
      st.py[k] = my;
      st.vx[k] = 0;
      st.vy[k] = 0;
      st.ox[k] = 0;
      st.oy[k] = 0;
      st.al[k] = 0.3;
    }
  }
}

// ---- the world ----------------------------------------------------------------
function kidnap(st) {
  let x = 0, y = 0;
  for (let tries = 0; tries < 30; tries++) {
    x = RM + rnd() * (W - 2 * RM);
    y = RM + rnd() * (H - 2 * RM);
    if (hypot(x - st.rx, y - st.ry) > 40) break;
  }
  st.rx = x;
  st.ry = y;
  st.hd = rnd() * 2 * PI;
}

function sim(st, dt) {
  const k = st.k;
  st.sg = 1 + (8 * cl(k[1], 0, 6)) / 6;
  st.scale = 0.95 * pow(3.1623, cl(k[3], -1, 1));
  st.nb = 3 + cl(k[2], -1, 1);
  st.t += dt;
  const sg = st.sg, scale = st.scale;
  // beacons fade in and out
  const ka = 1 - exp(-dt / 0.45);
  for (let b = 0; b < 4; b++) st.act[b] += ((b < 2 ? 1 : cl(st.nb - b, 0, 1)) - st.act[b]) * ka;
  st.hz *= exp(-dt / 1.1);
  // the hidden robot: smooth heading, speed 3 to 8 LED a second at 1 times, turns back at the margins
  st.om += -st.om * dt / 2 + 0.55 * sqrt(dt) * gauss();
  st.spm = cl(st.spm + (1 - st.spm) * dt / 5 + 0.2 * sqrt(dt) * gauss(), 0.55, 1.45);
  st.hd += st.om * scale * dt;
  const sp = 5.5 * st.spm * scale;
  let cx = cos(st.hd), cy = sin(st.hd);
  st.rx += cx * sp * dt;
  st.ry += cy * sp * dt;
  if (st.rx < RM) { st.rx = 2 * RM - st.rx; cx = abs(cx); }
  if (st.rx > W - RM) { st.rx = 2 * (W - RM) - st.rx; cx = -abs(cx); }
  if (st.ry < RM) { st.ry = 2 * RM - st.ry; cy = abs(cy); }
  if (st.ry > H - RM) { st.ry = 2 * (H - RM) - st.ry; cy = -abs(cy); }
  st.rx = cl(st.rx, RM, W - RM);
  st.ry = cl(st.ry, RM, H - RM);
  st.hd = atan2(cy, cx);
  st.kt -= dt * scale;
  if (st.kt <= 0) {
    kidnap(st);
    st.kt = 20 + 20 * rnd();
  }
  // the hypotheses drift on their own velocities and bounce off the arena
  const { px, py, vx, vy, ox, oy, al } = st, dec = exp(-dt / 0.1);
  for (let i = 0; i < N; i++) {
    let x = px[i] + vx[i] * dt, y = py[i] + vy[i] * dt;
    if (x < AX0) { x = 2 * AX0 - x; vx[i] = abs(vx[i]); }
    if (x > AX1) { x = 2 * AX1 - x; vx[i] = -abs(vx[i]); }
    if (y < AY0) { y = 2 * AY0 - y; vy[i] = abs(vy[i]); }
    if (y > AY1) { y = 2 * AY1 - y; vy[i] = -abs(vy[i]); }
    px[i] = cl(x, AX0, AX1);
    py[i] = cl(y, AY0, AY1);
    ox[i] *= dec;
    oy[i] *= dec;
    if (al[i] < 1) al[i] = min(1, al[i] + dt * 4);
  }
  // pings
  for (let b = 0; b < 4; b++) {
    st.fl[b] *= exp(-dt / 0.25);
    if (st.act[b] < 0.3) {
      st.tm[b] = 0.3 + 0.3 * rnd();
      continue;
    }
    st.tm[b] -= dt;
    if (st.tm[b] > 0) continue;
    st.tm[b] += PER[b] * (0.9 + 0.2 * rnd());
    const d = hypot(st.rx - BX[b], st.ry - BY[b]);
    st.rings.push({ b, z: max(1.5, d + sg * gauss()), age: 0, s: 0.75 + 0.2 * sg, str: min(1, st.act[b] * 1.5), sg, done: false });
    st.fl[b] = 1;
  }
  const rings = st.rings;
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.age += dt;
    if (!r.done && r.age >= LAND) {
      r.done = true;
      pfUpdate(st, r.b, r.z, r.sg);
    }
    if (r.age > FADE) rings.splice(i, 1);
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || st.k;
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  if (!st.init) {
    st.init = true;
    for (let b = 0; b < 4; b++) st.act[b] = b < 2 ? 1 : cl(3 + cl(st.k[2], -1, 1) - b, 0, 1);
    // a few seconds already gone, so the first frame has rings and a cloud that has found the robot
    for (let i = 0; i < 150; i++) sim(st, 1 / 30);
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  if (dt > 0) sim(st, dt);
}

// ---- the picture --------------------------------------------------------------
function colours(st) {
  const h0 = st.k[0], tmp = [0, 0, 0];
  for (let b = 0; b < 4; b++) {
    hsv(h0 + BH[b], BS[b], 1, tmp);
    const lum = 0.2126 * tmp[0] + 0.7152 * tmp[1] + 0.0722 * tmp[2], g = cl(sqrt(0.62 / lum), 0.8, 1.5);
    st.col[b][0] = tmp[0] * g;
    st.col[b][1] = tmp[1] * g;
    st.col[b][2] = tmp[2] * g;
  }
  hsv(h0 + 0.77, 0.3, 1, st.lil);
}

function drawRing(st, r) {
  const fb = st.fb, col = st.col[r.b], u = r.age / FADE;
  if (u >= 1) return;
  const e = min(1, r.age / LAND), R = r.z * (1 - (1 - e) * (1 - e)), s = r.s, i2 = 1 / (2 * s * s);
  const str = r.str * pow(1 - u, 1.6), ext = 3.1 * s;
  const bx = BX[r.b], by = BY[r.b], ro = R + ext, ri = R - ext;
  const y0 = max(0, floor(by - ro)), y1 = min(H - 1, floor(by + ro));
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - by, o2 = ro * ro - dy * dy;
    if (o2 <= 0) continue;
    const xo = sqrt(o2), xi = ri > abs(dy) ? sqrt(ri * ri - dy * dy) : 0;
    for (let side = 0; side < 2; side++) {
      let xa, xb;
      if (xi === 0) {
        if (side) break;
        xa = bx - xo;
        xb = bx + xo;
      } else if (side) {
        xa = bx + xi;
        xb = bx + xo;
      } else {
        xa = bx - xo;
        xb = bx - xi;
      }
      const x0 = max(0, floor(xa)), x1 = min(W - 1, floor(xb));
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - bx, d = sqrt(dx * dx + dy * dy) - R, a = str * exp(-d * d * i2);
        if (a < 0.008) continue;
        const p = (y * W + x) * 3;
        fb[p] += col[0] * a;
        fb[p + 1] += col[1] * a;
        fb[p + 2] += col[2] * a;
      }
    }
  }
}

function blob(fb, bx, by, s, amp, col, ext) {
  const i2 = 1 / (2 * s * s), y0 = max(0, floor(by - ext)), y1 = min(H - 1, floor(by + ext));
  const x0 = max(0, floor(bx - ext)), x1 = min(W - 1, floor(bx + ext));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - bx, dy = y + 0.5 - by, a = amp * exp(-(dx * dx + dy * dy) * i2);
      if (a < 0.006) continue;
      const p = (y * W + x) * 3;
      fb[p] += col[0] * a;
      fb[p + 1] += col[1] * a;
      fb[p + 2] += col[2] * a;
    }
  }
}

export function draw(display, params) {
  let st = params.st;
  if (!st) st = setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  colours(st);
  const { fb, P, px, py, ox, oy, al, lil } = st;
  fb.fill(0);
  P.fill(0);
  for (const r of st.rings) drawRing(st, r);
  // the hypotheses, soft discs that add up where they stack
  const CP = 0.2;
  for (let i = 0; i < N; i++) {
    const cx = px[i] + ox[i], cy = py[i] + oy[i], a = CP * al[i];
    const x0 = max(0, floor(cx - PR)), x1 = min(W - 1, floor(cx + PR)), y0 = max(0, floor(cy - PR)), y1 = min(H - 1, floor(cy + PR));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, r2 = dx * dx + dy * dy;
        if (r2 >= PR2) continue;
        const t = 1 - r2 / PR2;
        P[y * W + x] += a * t * t;
      }
    }
  }
  for (let i = 0; i < W * H; i++) {
    const v = P[i];
    if (v < 0.004) continue;
    const m = 1 - exp(-0.8 * v), p = i * 3;
    fb[p] += lil[0] * m;
    fb[p + 1] += lil[1] * m;
    fb[p + 2] += lil[2] * m;
  }
  // the beacons: a small soft node and a faint halo, a flash when it pings
  for (let b = 0; b < 4; b++) {
    const a = st.act[b];
    if (a < 0.02) continue;
    const f = st.fl[b];
    blob(fb, BX[b], BY[b], 1.05, a * (0.85 + 0.9 * f), st.col[b], 5);
    blob(fb, BX[b], BY[b], 2.6 + 1.5 * f, a * 0.16 * (1 + 1.5 * f), st.col[b], 9);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3, d = BAYER[((y & 3) << 2) | (x & 3)];
      display.setPixel(
        x, y,
        cl(floor(255 * (1 - exp(-1.45 * fb[p])) + d), 0, 255),
        cl(floor(255 * (1 - exp(-1.45 * fb[p + 1])) + d), 0, 255),
        cl(floor(255 * (1 - exp(-1.45 * fb[p + 2])) + d), 0, 255),
      );
    }
  }
}
