// ===== Patternflow pattern =====
// Title:   Skyrmion Gas
// Family:  physics
// Idea:    draft
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: draft (from memory)
// Round:   127
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drive=0.5..4, Pitch=-1..1, Field=-1..1
//
// Knob 1: Hue.
// Knob 2: Drive.
// Knob 3: Pitch.
// Knob 4: Field.

const { floor, ceil, sqrt, sin, cos, exp, abs, min, max, PI, pow, log, atan2, tan, atan } = Math;
const W = 64, H = 128, NC = W * H;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- tunables
const A_EX = 1;
const ALPHA = 0.3;
const BETA = 0.45;
const DT = 0.3;
const TEMP = 0.12;
const LAM_MIN = 12, LAM_OPEN = 18, LAM_MAX = 30;
const KNOB = [0, 2, 0, 0.06];
const TS0 = 12;
const B_CENTER = 0.5, B_SPAN = 0.3;
const SWING = 0.12;
const DRIFT = 0.0;

let RS = 2463534242;

function rnd() {
  RS ^= RS << 13; RS >>>= 0;
  RS ^= RS >>> 17;
  RS ^= RS << 5; RS >>>= 0;
  return RS / 4294967296;
}

function newState() {
  return {
    mx: new Float64Array(NC), my: new Float64Array(NC), mz: new Float64Array(NC),
    A: A_EX, D: 1, B: 0.3, alpha: ALPHA, beta: BETA, T: TEMP, amp: 0, uxa: new Float64Array(NC), uya: new Float64Array(NC),
    sm: [[1, 1, 0.37, 0.11, 1.3, 2.1, 1], [1, 2, 0.23, 0.17, 0.4, 5.3, 0.7], [2, 1, 0.31, 0.07, 2.2, 3.9, 0.7]],
    lam: LAM_OPEN, clock: 0, par: 0,
  };
}

function dOfLam(lam) { return 2 * A_EX * tan((2 * PI) / lam); }

// One half step: the cells of one colour of the checkerboard are advanced by dt. Each one first feels its field B for dt / 2 (exactly:
// a turn about z and a slide of the polar angle, tan(theta / 2) times a constant), then takes a Cayley turn about the part of the
// exchange, Dzyaloshinskii, spin-torque and thermal field that lies across the spin, which depends on the other colour only, then
// feels B again for dt / 2.
function zeeman(a, b, c, zc, zs, ze2, ze, out) {
  const p = 1 + c, q = 1 - c, den = p + ze2 * q, gs = (2 * ze) / den;
  out[2] = (p - ze2 * q) / den;
  out[0] = gs * (zc * a - zs * b);
  out[1] = gs * (zs * a + zc * b);
}
const ZT = [0, 0, 0];
function sweep(S, par, dt) {
  const mx = S.mx, my = S.my, mz = S.mz;
  const A2 = 2 * S.A, Dd = S.D, B = S.B, al = S.alpha, be = S.beta;
  const gp = 1 / (1 + al * al);
  const sig = S.T > 0 ? sqrt((2 * al * S.T) / dt) * 3.4641016 : 0;
  const uxa = S.uxa, uya = S.uya, drift = S.amp > 0;
  const hdt = 0.5 * dt;
  let rs = RS;
  const ph = gp * B * hdt, zc = cos(ph), zs = sin(ph), ze = exp(-al * ph), ze2 = ze * ze;
  for (let y = 0; y < H; y++) {
    const r = y * W, ru = ((y - 1) & 127) * W, rd = ((y + 1) & 127) * W;
    for (let x = (y + par) & 1; x < W; x += 2) {
      const i = r + x, il = r + ((x - 1) & 63), ir = r + ((x + 1) & 63), iu = ru + x, id = rd + x;
      zeeman(mx[i], my[i], mz[i], zc, zs, ze2, ze, ZT);
      const a = ZT[0], b = ZT[1], c = ZT[2];
      let hx = A2 * (mx[il] + mx[ir] + mx[iu] + mx[id] - 4 * a) - Dd * (mz[id] - mz[iu]);
      let hy = A2 * (my[il] + my[ir] + my[iu] + my[id] - 4 * b) + Dd * (mz[ir] - mz[il]);
      let hz = A2 * (mz[il] + mz[ir] + mz[iu] + mz[id] - 4 * c) - Dd * (my[ir] - my[il] - mx[id] + mx[iu]);
      if (sig > 0) {
        rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
        hx += ((rs & 1023) * 0.0009765625 - 0.5) * sig;
        hy += (((rs >>> 10) & 2047) * 0.00048828125 - 0.5) * sig;
        hz += (((rs >>> 21) & 2047) * 0.00048828125 - 0.5) * sig;
      }
      const hp = hx * a + hy * b + hz * c;
      hx -= hp * a; hy -= hp * b; hz -= hp * c;
      let wx = gp * (hx + al * (b * hz - c * hy));
      let wy = gp * (hy + al * (c * hx - a * hz));
      let wz = gp * (hz + al * (a * hy - b * hx));
      if (drift) {
        const ux = uxa[i], uy = uya[i];
        const vx = 0.5 * (ux * (mx[ir] - mx[il]) + uy * (mx[id] - mx[iu]));
        const vy = 0.5 * (ux * (my[ir] - my[il]) + uy * (my[id] - my[iu]));
        const vz = 0.5 * (ux * (mz[ir] - mz[il]) + uy * (mz[id] - mz[iu]));
        wx -= b * vz - c * vy + be * vx;
        wy -= c * vx - a * vz + be * vy;
        wz -= a * vy - b * vx + be * vz;
      }
      const kx = hdt * wx, ky = hdt * wy, kz = hdt * wz;
      const k2 = kx * kx + ky * ky + kz * kz, kd = kx * a + ky * b + kz * c, f = 1 / (1 + k2);
      const f1 = 1 - k2, f2 = 2 * kd;
      const na = (f1 * a + 2 * (ky * c - kz * b) + f2 * kx) * f;
      const nb = (f1 * b + 2 * (kz * a - kx * c) + f2 * ky) * f;
      const nc = (f1 * c + 2 * (kx * b - ky * a) + f2 * kz) * f;
      zeeman(na, nb, nc, zc, zs, ze2, ze, ZT);
      mx[i] = ZT[0]; my[i] = ZT[1]; mz[i] = ZT[2];
    }
  }
  RS = rs >>> 0;
}

// A current that wanders: u = (d psi / dy, -d psi / dx) for a stream function of three standing modes whose phases drift at their
// own rates, so the current is divergence free, never uniform, and does not repeat.
const SX = new Float64Array(W * 3), SY = new Float64Array(H * 3);
function stir(S, t) {
  const amp = S.amp, uxa = S.uxa, uya = S.uya;
  uxa.fill(0); uya.fill(0);
  for (let j = 0; j < 3; j++) {
    const m = S.sm[j], kx = (2 * PI * m[0]) / W, ky = (2 * PI * m[1]) / H, ax = m[4] + m[2] * t, ay = m[5] + m[3] * t, g = m[6] * amp;
    for (let x = 0; x < W; x++) { SX[x] = sin(kx * x + ax); SX[W + x] = cos(kx * x + ax); }
    for (let y = 0; y < H; y++) { SY[y] = sin(ky * y + ay); SY[H + y] = cos(ky * y + ay); }
    // psi = g sin(kx x + ax) sin(ky y + ay);  ux = dpsi/dy = g ky sin(.) cos(.),  uy = -dpsi/dx = -g kx cos(.) sin(.)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        uxa[y * W + x] += g * ky * SX[x] * SY[H + y] * 8;
        uya[y * W + x] -= g * kx * SX[W + x] * SY[y] * 8;
      }
  }
}

function step(S, dt) {
  if (S.par) { sweep(S, 1, dt); sweep(S, 0, dt); } else { sweep(S, 0, dt); sweep(S, 1, dt); }
  S.par ^= 1;
}

function normalise(S) {
  const mx = S.mx, my = S.my, mz = S.mz;
  for (let i = 0; i < NC; i++) {
    const n = 1 / sqrt(mx[i] * mx[i] + my[i] * my[i] + mz[i] * mz[i]);
    mx[i] *= n; my[i] *= n; mz[i] *= n;
  }
}

// ---- seeds
function seedGas(S, count, helicity) {
  const lam = S.lam, R = 0.28 * lam, w = 0.14 * lam;
  const cx = [], cy = [];
  let tries = 0;
  while (cx.length < count && tries++ < 4000) {
    const x = rnd() * W, y = rnd() * H;
    let ok = true;
    for (let j = 0; j < cx.length; j++) {
      let dx = abs(x - cx[j]), dy = abs(y - cy[j]);
      dx = min(dx, W - dx); dy = min(dy, H - dy);
      if (dx * dx + dy * dy < 0.8 * lam * 0.8 * lam) { ok = false; break; }
    }
    if (ok) { cx.push(x); cy.push(y); }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let sx = 0, sy = 0, sz = 0;
      for (let j = 0; j < cx.length; j++) {
        let dx = x - cx[j], dy = y - cy[j];
        dx -= W * Math.round(dx / W); dy -= H * Math.round(dy / H);
        const r = sqrt(dx * dx + dy * dy);
        if (r > 3 * lam) continue;
        const th = 2 * atan2(Math.sinh(R / w), Math.sinh(max(r, 1e-6) / w));
        const psi = atan2(dy, dx) + helicity;
        sx += sin(th) * cos(psi);
        sy += sin(th) * sin(psi);
        sz += cos(th) - 1;
      }
      const i = y * W + x;
      S.mx[i] = sx; S.my[i] = sy; S.mz[i] = 1 + sz;
    }
  normalise(S);
}

function seedRandom(S) {
  for (let i = 0; i < NC; i++) {
    S.mx[i] = rnd() - 0.5; S.my[i] = rnd() - 0.5; S.mz[i] = rnd() - 0.5;
  }
  normalise(S);
}

function seedStripes(S, nx, ny, phase) {
  // helix with wave vector (2 pi nx / W, 2 pi ny / H); spins rotate in the plane holding the wave vector and z
  const qx = (2 * PI * nx) / W, qy = (2 * PI * ny) / H, q = sqrt(qx * qx + qy * qy), ex = qx / q, ey = qy / q;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ph = qx * x + qy * y + phase;
      // in-plane unit vector perpendicular to the wave vector: (-ey, ex)
      const i = y * W + x;
      S.mx[i] = -ey * sin(ph); S.my[i] = ex * sin(ph); S.mz[i] = cos(ph);
    }
}

function targets(k, S) {
  const lam = LAM_OPEN * pow(k[2] < 0 ? LAM_MIN / LAM_OPEN : LAM_MAX / LAM_OPEN, abs(cl(k[2], -1, 1)));
  return { lam, b: B_CENTER + B_SPAN * cl(k[3], -1, 1), ts: TS0 * cl(k[1], 0.5, 4) / 2 };
}

function applyParams(S, k, b) {
  S.lam = S.lam; S.D = dOfLam(S.lam);
  S.B = b * 2 * A_EX * pow((2 * PI) / S.lam, 2);
}

export function setup(params, knobValues) {
  const S = (params.s = newState());
  RS = (floor(Math.random() * 4294967295) | 1) >>> 0;
  const k = knobValues || KNOB, tg = targets(k, S);
  S.lam = tg.lam;
  applyParams(S, k, tg.b);
  seedGas(S, 12, PI / 2);
  S.sim = tg;
}

export function update(dt, input, params) {
  const k = input.knobValues || KNOB;
  if (!params.s) setup(params, k);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  if (d <= 0) return;
  const tg = targets(k, S);
  S.clock += d;
  applyParams(S, k, tg.b);
  const total = d * tg.ts, n = max(1, ceil(total / DT)), ds = total / n;
  for (let i = 0; i < n; i++) step(S, ds);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const mz = S.mz[i];
      const hue = atan2(S.my[i], S.mx[i]);
      const s = sqrt(max(0, 1 - mz * mz));
      const L = 0.2 + 0.7 * (1 - mz) / 2;
      const r = L + s * 0.5 * cos(hue), g = L + s * 0.5 * cos(hue - 2.09), b = L + s * 0.5 * cos(hue + 2.09);
      display.setPixel(x, y, cl(r, 0, 1) * 255, cl(g, 0, 1) * 255, cl(b, 0, 1) * 255);
    }
}
