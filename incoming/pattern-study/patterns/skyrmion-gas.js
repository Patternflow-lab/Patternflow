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
// @knobs Hue=0..1, Drive=0.5..3.5, Pitch=-1..1, Field=-1..1
//
// Knob 1: Hue.
// Knob 2: Drive.
// Knob 3: Pitch.
// Knob 4: Field.

const { floor, ceil, sqrt, sin, cos, exp, abs, min, max, PI, pow, tan } = Math;
const W = 64, H = 128, NC = W * H;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- tunables. Lengths are LEDs, times are story time (Drive sets how much of it passes in a second).
const A_EX = 1;           // exchange stiffness, the unit of energy
const ALPHA = 0.4;        // Gilbert damping
const BETA = 0.6;         // non-adiabatic spin torque coefficient
const DT = 0.07;          // story time step
const T_BATH = 0.08;      // temperature in units of A
const LAM_MIN = 11, LAM_OPEN = 15, LAM_MAX = 28; // helix period at Pitch -1, 0, 1
const N_AREA = 7000;      // skyrmions seeded: N_AREA / lambda^2
const TS_BASE = 3, TS_PER_DRIVE = 4.5; // story time per second: TS_BASE + TS_PER_DRIVE * Drive
const AMP_PER_DRIVE = 0.09; // strength of the wandering current, per unit of the Drive knob
const B_OPEN = 0.58, B_KNOB = 0.12; // B / B_D at the centre of the swing, and what the Field knob moves it by
const SW1 = 0.12, SW2 = 0.08;      // the two swings of the field
const P1 = 23.7, P2 = 38.3;        // their periods in seconds
const KNOB = [0, 2, 0, 0.06];
const PREROLL = 60;       // story time run before the first frame

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
    A: A_EX, D: 1, B: 0.3, alpha: ALPHA, beta: BETA, T: T_BATH, amp: 0, uxa: new Float64Array(NC), uya: new Float64Array(NC),
    // stream function modes of the wandering current: wavenumber counts, phase rates (rad / s), phases, weight
    sm: [[1, 1, 0.37, 0.11, 1.3, 2.1, 1], [1, 2, 0.23, 0.17, 0.4, 5.3, 0.7], [2, 1, 0.31, 0.07, 2.2, 3.9, 0.7]],
    lam: LAM_OPEN, clock: 0, par: 0, bb: 0.5,
    tx: new Float32Array(NC * 3), sx: new Float32Array(NC), sy: new Float32Array(NC), sz: new Float32Array(NC),
    lut: new Uint8Array(NZ * NH * 3), lutDone: 0, hs: 0,
  };
}

function dOfLam(lam) { return 2 * A_EX * tan((2 * PI) / lam); }

// One half step: the cells of one colour of the checkerboard are advanced by dt. Each one first feels its field B for dt (exactly: a
// turn about z and a slide of the polar angle, tan(theta / 2) times a constant), then takes a Cayley turn about the part of the
// exchange, Dzyaloshinskii, spin-torque and thermal field that lies across the spin, which depends on the other colour only. Run on
// step after step, B for dt then the rest is B for dt / 2, the rest, B for dt / 2 with the halves joined.
function sweep(S, par, dt) {
  const mx = S.mx, my = S.my, mz = S.mz;
  const A2 = 2 * S.A, Dd = S.D, B = S.B, al = S.alpha, be = S.beta;
  const gp = 1 / (1 + al * al);
  // the Gilbert form of the Zhang-Li torque, -v + beta m x v, in the Landau-Lifshitz form: (-(1 + alpha beta) v + (beta - alpha) m x v) / (1 + alpha^2)
  const c1 = (1 + al * be) * gp, c2 = (be - al) * gp;
  const sig = S.T > 0 ? sqrt((2 * al * S.T) / dt) * 3.4641016 : 0;
  const uxa = S.uxa, uya = S.uya, drift = S.amp > 0;
  const hdt = 0.5 * dt;
  let rs = RS;
  const ph = gp * B * dt, zc = cos(ph), zs = sin(ph), ze = exp(-al * ph), ze2 = ze * ze, ze2x2 = 2 * ze;
  for (let y = 0; y < H; y++) {
    const r = y * W, ru = ((y - 1) & 127) * W, rd = ((y + 1) & 127) * W;
    for (let x = (y + par) & 1; x < W; x += 2) {
      const i = r + x, il = r + ((x - 1) & 63), ir = r + ((x + 1) & 63), iu = ru + x, id = rd + x;
      const p0 = 1 + mz[i], q0 = 1 - mz[i], den = p0 + ze2 * q0, gs = ze2x2 / den, c = (p0 - ze2 * q0) / den;
      const a = gs * (zc * mx[i] - zs * my[i]), b = gs * (zs * mx[i] + zc * my[i]);
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
        wx -= c1 * (b * vz - c * vy) + c2 * vx;
        wy -= c1 * (c * vx - a * vz) + c2 * vy;
        wz -= c1 * (a * vy - b * vx) + c2 * vz;
      }
      const kx = hdt * wx, ky = hdt * wy, kz = hdt * wz;
      const k2 = kx * kx + ky * ky + kz * kz, f = 1 / (1 + k2), f1 = (1 - k2) * f, f2 = 2 * (kx * a + ky * b + kz * c) * f, f3 = 2 * f;
      mx[i] = f1 * a + f3 * (ky * c - kz * b) + f2 * kx;
      my[i] = f1 * b + f3 * (kz * a - kx * c) + f2 * ky;
      mz[i] = f1 * c + f3 * (kx * b - ky * a) + f2 * kz;
    }
  }
  RS = rs >>> 0;
}

// A current that wanders: u = (d psi / dy, -d psi / dx) for a stream function of three standing modes whose phases drift at their
// own rates, so the current is divergence free, never uniform, and does not repeat.
const SX = new Float64Array(W * 2), SY = new Float64Array(H * 2);
function stir(S, t) {
  const amp = S.amp, uxa = S.uxa, uya = S.uya;
  uxa.fill(0); uya.fill(0);
  for (let j = 0; j < 3; j++) {
    const m = S.sm[j], kx = (2 * PI * m[0]) / W, ky = (2 * PI * m[1]) / H, ax = m[4] + m[2] * t, ay = m[5] + m[3] * t, g = m[6] * amp * 8;
    for (let x = 0; x < W; x++) { SX[x] = sin(kx * x + ax); SX[W + x] = cos(kx * x + ax); }
    for (let y = 0; y < H; y++) { SY[y] = sin(ky * y + ay); SY[H + y] = cos(ky * y + ay); }
    // psi = g sin(kx x + ax) sin(ky y + ay);  ux = dpsi/dy = g ky sin(.) cos(.),  uy = -dpsi/dx = -g kx cos(.) sin(.)
    for (let y = 0; y < H; y++) {
      const gy1 = g * ky * SY[H + y], gy2 = g * kx * SY[y];
      for (let x = 0; x < W; x++) {
        uxa[y * W + x] += gy1 * SX[x];
        uya[y * W + x] -= gy2 * SX[W + x];
      }
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
      if (dx * dx + dy * dy < 0.64 * lam * lam) { ok = false; break; }
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
        const th = 2 * Math.atan2(Math.sinh(R / w), Math.sinh(max(r, 1e-6) / w));
        const psi = Math.atan2(dy, dx) + helicity;
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
  const qx = (2 * PI * nx) / W, qy = (2 * PI * ny) / H, q = sqrt(qx * qx + qy * qy), ex = qx / q, ey = qy / q;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ph = qx * x + qy * y + phase, i = y * W + x;
      S.mx[i] = -ey * sin(ph); S.my[i] = ex * sin(ph); S.mz[i] = cos(ph);
    }
}

// ---- colour. OKLab: lightness and chroma from m_z, hue from the in-plane angle. The LUT is indexed by (hue, m_z).
const NZ = 48, NH = 256;
function lin(L, a, b, o) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  o[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  o[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  o[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const GAM = new Float32Array(4097);
for (let k = 0; k <= 4096; k++) {
  const x = k / 4096;
  GAM[k] = 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
}
const gam = (x) => GAM[x <= 0 ? 0 : x >= 1 ? 4096 : (x * 4096 + 0.5) | 0];
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
// t = (1 - m_z) / 2: 0 where the spin points with the field (the ground), 1 in the core
const LSTOPS = [[0, 0.17], [0.1, 0.18], [0.3, 0.43], [0.5, 0.63], [0.8, 0.8], [1, 0.94]];
const TMP = [0, 0, 0];
function buildLut(S) {
  const lut = S.lut;
  for (let zi = 0; zi < NZ; zi++) {
    const t = zi / (NZ - 1), mzv = 1 - 2 * t, sn = sqrt(max(0, 1 - mzv * mzv));
    let n = 1;
    while (n < LSTOPS.length - 1 && LSTOPS[n][0] < t) n++;
    const A = LSTOPS[n - 1], B = LSTOPS[n], u = (t - A[0]) / (B[0] - A[0]), w = u * u * (3 - 2 * u);
    const L0 = A[1] + (B[1] - A[1]) * w;
    for (let hi = 0; hi < NH; hi++) {
      const hue = ((hi + 0.5) / NH) * 2 * PI, hd = (hi / NH) * 360;
      let L = L0, C = 0.16 * pow(sn, 1.1) * sm(0.04, 0.3, t);
      let dh = (((hd - 75) % 360) + 360) % 360;
      if (dh > 180) dh -= 360;
      const warm = exp(-(dh * dh) / 4000);
      L += 0.2 * warm * (1 - sm(0.45, 0.8, L));
      C *= 1 - 0.7 * warm * (1 - sm(0.3, 0.62, L));
      // ink tint of the ground
      const tint = 0.03 * (1 - t) * (1 - t), th = (265 * PI) / 180;
      let a = C * cos(hue) + tint * cos(th), b = C * sin(hue) + tint * sin(th);
      for (let it = 0; it < 8; it++) {
        lin(L, a, b, TMP);
        if (TMP[0] >= -0.002 && TMP[1] >= -0.002 && TMP[2] >= -0.002 && TMP[0] <= 1.002 && TMP[1] <= 1.002 && TMP[2] <= 1.002) break;
        a *= 0.9; b *= 0.9;
      }
      lin(L, a, b, TMP);
      const q = 3 * (hi * NZ + zi);
      lut[q] = gam(TMP[0]);
      lut[q + 1] = gam(TMP[1]);
      lut[q + 2] = gam(TMP[2]);
    }
  }
  S.lutDone = 1;
}

// angle of (y, x) as a fraction of a turn, 0..1 (polynomial arctangent, 1e-5 rad)
function turn(y, x) {
  const ax = abs(x), ay = abs(y);
  if (ax + ay < 1e-9) return 0;
  const sw = ay > ax, r = sw ? ax / ay : ay / ax, r2 = r * r;
  let a = r * (0.999866 - r2 * (0.3302995 - r2 * (0.180141 - r2 * (0.085133 - r2 * 0.0208351)))); // atan(r) in 0..pi/4
  if (sw) a = 1.5707963 - a;
  if (x < 0) a = 3.1415927 - a;
  if (y < 0) a = -a;
  const f = a * 0.15915494;
  return f < 0 ? f + 1 : f;
}

function targets(k) {
  const lam = LAM_OPEN * pow(k[2] < 0 ? LAM_MIN / LAM_OPEN : LAM_MAX / LAM_OPEN, abs(cl(k[2], -1, 1)));
  const dr = cl(k[1], 0.5, 3.5);
  return { lam, b0: B_OPEN + B_KNOB * cl(k[3], -1, 1), ts: TS_BASE + TS_PER_DRIVE * dr, amp: AMP_PER_DRIVE * dr };
}

// the field in units of B_D = 2 A q^2: two slow swings that never line up
function fieldNow(S, b0) {
  return b0 + SW1 * sin((2 * PI * S.clock) / P1 + 0.7) + SW2 * sin((2 * PI * S.clock) / P2 + 2.9);
}

function applyField(S, b) {
  const q0 = (2 * PI) / S.lam;
  S.D = dOfLam(S.lam);
  S.B = b * 2 * A_EX * q0 * q0;
  S.T = T_BATH * (LAM_OPEN / S.lam) * (LAM_OPEN / S.lam);
  S.bb = b;
}

export function setup(params, knobValues) {
  const S = (params.s = newState());
  RS = (floor(Math.random() * 4294967295) | 1) >>> 0;
  const k = knobValues || KNOB, tg = targets(k);
  S.lam = tg.lam;
  S.hs = floor(cl(k[0], 0, 1) * NH + 0.5);
  applyField(S, tg.b0);
  S.amp = tg.amp * (LAM_OPEN / S.lam);
  seedGas(S, Math.round((N_AREA / (S.lam * S.lam)) * sqrt(S.lam / LAM_OPEN)), PI / 2);
  stir(S, 0);
  const n = ceil(PREROLL / DT);
  for (let i = 0; i < n; i++) step(S, DT);
  buildLut(S);
}

export function update(dt, input, params) {
  const k = input.knobValues || KNOB;
  if (!params.s) setup(params, k);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  if (d <= 0) return;
  const tg = targets(k);
  S.clock += d;
  S.lam += (tg.lam - S.lam) * (1 - exp(-2 * d));
  S.amp = tg.amp * (LAM_OPEN / S.lam);
  S.hs = floor(cl(k[0], 0, 1) * NH + 0.5);
  applyField(S, fieldNow(S, tg.b0));
  stir(S, S.clock);
  const total = d * tg.ts, n = min(40, max(1, ceil(total / DT))), ds = total / n;
  for (let i = 0; i < n; i++) step(S, ds);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const mx = S.mx, my = S.my, mz = S.mz, tx = S.tx, lut = S.lut;
  const shift = S.hs;
  // 1-2-1 smoothing in x, then in y, of the three components: the cell-sized thermal speckle goes, the texture stays
  for (let y = 0; y < H; y++) {
    const r = y * W;
    for (let x = 0; x < W; x++) {
      const l = r + ((x - 1) & 63), c = r + x, rr = r + ((x + 1) & 63), o = 3 * c;
      tx[o] = mx[l] + 2 * mx[c] + mx[rr];
      tx[o + 1] = my[l] + 2 * my[c] + my[rr];
      tx[o + 2] = mz[l] + 2 * mz[c] + mz[rr];
    }
  }
  for (let y = 0; y < H; y++) {
    const r = y * W, ru = ((y - 1) & 127) * W, rd = ((y + 1) & 127) * W;
    for (let x = 0; x < W; x++) {
      const o = 3 * (r + x), u = 3 * (ru + x), dn = 3 * (rd + x);
      const sx = tx[u] + 2 * tx[o] + tx[dn], sy = tx[u + 1] + 2 * tx[o + 1] + tx[dn + 1], sz = tx[u + 2] + 2 * tx[o + 2] + tx[dn + 2];
      const n = sqrt(sx * sx + sy * sy + sz * sz) + 1e-9;
      let zi = ((1 - sz / n) * 0.5 * (NZ - 1) + 0.5) | 0;
      const hi = (floor(turn(sy, sx) * NH) + shift) & (NH - 1);
      const q = 3 * (hi * NZ + zi);
      display.setPixel(x, y, lut[q], lut[q + 1], lut[q + 2]);
    }
  }
}
