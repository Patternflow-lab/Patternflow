// ===== Patternflow pattern =====
// Title:   Rayleigh-Benard
// Family:  sim
// Idea:    DRAFT
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: DRAFT
// Round:   115
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.8..3.2, Scale=-1..1, Prandtl=-1..1

const { floor, ceil, exp, sqrt, abs, sin, cos, PI, min, max, pow, log, round } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- tunables
const NX = 64, NZ = 128;
const KAP0 = 2.0; // thermal diffusivity at Pace 1, Scale 0, LED^2/s
const RA0 = 2e6; // Rayleigh number at Scale 0
const DRAG0 = 0.5; // drag on the horizontal-mean wind, 1/s at Pace 1

// ---- in-place complex FFT, N a power of two
function makeFft(N) {
  const rev = new Uint16Array(N), cs = new Float64Array(N / 2), sn = new Float64Array(N / 2);
  const bits = Math.round(Math.log2(N));
  for (let i = 0; i < N; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
    rev[i] = r;
  }
  for (let k = 0; k < N / 2; k++) {
    cs[k] = cos((TAU * k) / N);
    sn[k] = sin((TAU * k) / N);
  }
  // sign = -1 forward, +1 inverse (unnormalised)
  return function fft(re, im, sign) {
    for (let i = 0; i < N; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }
    for (let len = 2; len <= N; len <<= 1) {
      const half = len >> 1, step = N / len;
      for (let s = 0; s < N; s += len)
        for (let k = 0, t = 0; k < half; k++, t += step) {
          const wr = cs[t], wi = sign * sn[t];
          const a = s + k, b = a + half;
          const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
    }
  };
}

function newState(nx, nz) {
  const n = nx * nz, F = () => new Float64Array(n), h = nx / 2 + 1;
  const S = {
    nx, nz, n, d: nz - 1,
    T: F(), W: F(), P: F(), U: F(), V: F(), T2: F(), W2: F(),
    Tp: new Float64Array(nx * (nz + 4)), Wp: new Float64Array(nx * (nz + 4)),
    fft: makeFft(nx), zr: new Float64Array(nx), zi: new Float64Array(nx),
    Wr: new Float64Array(nz * h), Wi: new Float64Array(nz * h),
    Tr: new Float64Array(nz * h), Ti: new Float64Array(nz * h),
    Pr: new Float64Array(nz * h), Pi: new Float64Array(nz * h),
    cp: new Float64Array(nz), dp: new Float64Array(nz), dq: new Float64Array(nz),
    R: 1, ct: 1, cw: 1, drag: 0, gB: 4, kap: KAP0, nu: KAP0, time: 0, lut: new Float32Array(3 * 512), hueDone: -1, sig: 0.1, mean: new Float64Array(nz),  lin: new Float64Array(nz), cx: new Float64Array(h),
  };
  for (let j = 0; j < nz; j++) {
    S.lin[j] = j / (nz - 1);
    for (let i = 0; i < nx; i++) S.T[j * nx + i] = S.lin[j];
  }
  for (let k = 0; k < h; k++) S.cx[k] = 2 * cos((TAU * k) / nx) - 2;
  return S;
}

// Cubic (Catmull-Rom) weights
function sampleBoth(Tp, Wp, nx, fi, fj, out, ct, cw) {
  // Tp, Wp are padded: row index r = j + 2
  const mx = nx - 1;
  const i1 = floor(fi), j1 = floor(fj), tx = fi - i1, ty = fj - j1;
  const xa = (i1 - 1) & mx, xb = i1 & mx, xc = (i1 + 1) & mx, xd = (i1 + 2) & mx;
  const t2 = tx * tx, t3 = t2 * tx;
  const ax = -0.5 * t3 + t2 - 0.5 * tx, bx = 1.5 * t3 - 2.5 * t2 + 1, cx = -1.5 * t3 + 2 * t2 + 0.5 * tx, dx = 0.5 * t3 - 0.5 * t2;
  const s2 = ty * ty, s3 = s2 * ty;
  const ay = -0.5 * s3 + s2 - 0.5 * ty, by = 1.5 * s3 - 2.5 * s2 + 1, cy = -1.5 * s3 + 2 * s2 + 0.5 * ty, dy = 0.5 * s3 - 0.5 * s2;
  const ra = (j1 + 1) * nx, rb = ra + nx, rc = rb + nx, rd = rc + nx;
  for (let f = 0; f < 2; f++) {
    const A = f ? Wp : Tp;
    const va = ax * A[ra + xa] + bx * A[ra + xb] + cx * A[ra + xc] + dx * A[ra + xd];
    const vb = ax * A[rb + xa] + bx * A[rb + xb] + cx * A[rb + xc] + dx * A[rb + xd];
    const vc = ax * A[rc + xa] + bx * A[rc + xb] + cx * A[rc + xc] + dx * A[rc + xd];
    const vd = ax * A[rd + xa] + bx * A[rd + xb] + cx * A[rd + xc] + dx * A[rd + xd];
    const r = ay * va + by * vb + cy * vc + dy * vd;
    const p = A[rb + xb], q = A[rb + xc], s = A[rc + xb], u = A[rc + xc];
    const lo = min(min(p, q), min(s, u)), hi = max(max(p, q), max(s, u));
    out[f] = (f ? cw : ct) ? (r < lo ? lo : r > hi ? hi : r) : r;
  }
}

const OUT = [0, 0];

function velocities(S) {
  const { nx, nz, P, U, V } = S, mx = nx - 1, ir = 1 / S.R;
  for (let j = 1; j < nz - 1; j++) {
    const o = j * nx, up = o + nx, dn = o - nx;
    for (let i = 0; i < nx; i++) {
      U[o + i] = 0.5 * (P[up + i] - P[dn + i]);
      V[o + i] = -0.5 * ir * (P[o + ((i + 1) & mx)] - P[o + ((i - 1) & mx)]);
    }
  }
  const o1 = nx, oN = (nz - 1) * nx;
  for (let i = 0; i < nx; i++) {
    U[i] = U[o1 + i]; // free-slip: no shear at the wall, so the speed along it is the one a cell off it
    V[i] = 0;
    U[oN + i] = U[oN - nx + i];
    V[oN + i] = 0;
  }
}

function advect(S, dt) {
  const { nx, nz, T, W, U, V, T2, W2, Tp, Wp } = S, mx = nx - 1, ymax = nz - 1, ir = 1 / S.R;
  // padded copies, two ghost rows each side, odd about the wall value
  for (let j = 0; j < nz; j++) {
    const o = j * nx, q = (j + 2) * nx;
    for (let i = 0; i < nx; i++) {
      Tp[q + i] = T[o + i];
      Wp[q + i] = W[o + i];
    }
  }
  for (let g = 1; g <= 2; g++) {
    const a = (2 - g) * nx, b = (2 + g) * nx, c = (nz + 1 + g) * nx, e = (nz + 1 - g) * nx;
    for (let i = 0; i < nx; i++) {
      Tp[a + i] = 0 - T[g * nx + i];
      Wp[a + i] = -W[g * nx + i];
      Tp[c + i] = 2 - T[(nz - 1 - g) * nx + i];
      Wp[c + i] = -W[(nz - 1 - g) * nx + i];
    }
  }
  for (let j = 1; j < nz - 1; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      let xm = i - 0.5 * dt * ir * U[k], ym = j - 0.5 * dt * V[k];
      ym = ym < 0 ? 0 : ym > ymax ? ymax : ym;
      // bilinear velocity at the midpoint
      const i0 = floor(xm), j0 = min(floor(ym), ymax - 1), a = xm - i0, b = ym - j0;
      const x0 = i0 & mx, x1 = (i0 + 1) & mx, r0 = j0 * nx, r1 = r0 + nx;
      const w00 = (1 - a) * (1 - b), w10 = a * (1 - b), w01 = (1 - a) * b, w11 = a * b;
      const u1 = w00 * U[r0 + x0] + w10 * U[r0 + x1] + w01 * U[r1 + x0] + w11 * U[r1 + x1];
      const v1 = w00 * V[r0 + x0] + w10 * V[r0 + x1] + w01 * V[r1 + x0] + w11 * V[r1 + x1];
      let xf = i - dt * ir * u1, yf = j - dt * v1;
      yf = yf < 0 ? 0 : yf > ymax ? ymax : yf;
      sampleBoth(Tp, Wp, nx, xf, yf, OUT, S.ct, S.cw);
      T2[k] = OUT[0];
      W2[k] = OUT[1];
    }
  }
  for (let i = 0; i < nx; i++) {
    T2[i] = 0;
    W2[i] = 0;
    T2[(nz - 1) * nx + i] = 1;
    W2[(nz - 1) * nx + i] = 0;
  }
}

// One Thomas solve on rows 1..nz-2 of a mode's column, constant coefficients a (off-diagonal), b (diagonal)
// Solves a x(j-1) + b x(j) + a x(j+1) = r(j), x(0) = x(nz-1) = 0. re and im solved together.
function thomas2(S, a, b, re, im, o, stride) {
  const { nz, cp, dp, dq } = S;
  // forward
  let m = b;
  cp[1] = a / m;
  dp[1] = re[o + stride] / m;
  dq[1] = im[o + stride] / m;
  for (let j = 2; j < nz - 1; j++) {
    m = b - a * cp[j - 1];
    cp[j] = a / m;
    dp[j] = (re[o + j * stride] - a * dp[j - 1]) / m;
    dq[j] = (im[o + j * stride] - a * dq[j - 1]) / m;
  }
  re[o + (nz - 2) * stride] = dp[nz - 2];
  im[o + (nz - 2) * stride] = dq[nz - 2];
  for (let j = nz - 3; j >= 1; j--) {
    re[o + j * stride] = dp[j] - cp[j] * re[o + (j + 1) * stride];
    im[o + j * stride] = dq[j] - cp[j] * im[o + (j + 1) * stride];
  }
}

// Buoyancy, then implicit diffusion of vorticity and temperature and the Poisson solve for the stream function, all in
// x-Fourier space with finite differences in z.
function diffuseSolve(S, dt) {
  const { nx, nz, W2, T2, lin, fft, zr, zi, Wr, Wi, Tr, Ti, Pr, Pi, cx, gB, kap, nu } = S, h = nx / 2 + 1, mx = nx - 1, ir = 1 / S.R, ir2 = ir * ir;
  // buoyancy: dW/dt = -gB dT/dx at the vertices
  for (let j = 1; j < nz - 1; j++) {
    const o = j * nx;
    for (let i = 0; i < nx; i++) W2[o + i] -= dt * gB * 0.5 * ir * (T2[o + ((i + 1) & mx)] - T2[o + ((i - 1) & mx)]);
  }
  // forward: re = vorticity, im = temperature minus its conduction profile
  for (let j = 0; j < nz; j++) {
    const o = j * nx;
    for (let i = 0; i < nx; i++) {
      zr[i] = W2[o + i];
      zi[i] = T2[o + i] - lin[j];
    }
    fft(zr, zi, -1);
    const q = j * h;
    for (let k = 0; k < h; k++) {
      const k2 = (nx - k) & mx;
      const ar = 0.5 * (zr[k] + zr[k2]), ai = 0.5 * (zi[k] - zi[k2]);
      const br = 0.5 * (zi[k] + zi[k2]), bi = -0.5 * (zr[k] - zr[k2]);
      Wr[q + k] = ar;
      Wi[q + k] = ai;
      Tr[q + k] = br;
      Ti[q + k] = bi;
    }
  }
  const cn = nu * dt, ck = kap * dt;
  for (let k = 0; k < h; k++) {
    const ax = cx[k] * ir2;
    thomas2(S, -cn, 1 + cn * (2 - ax) + (k ? 0 : dt * S.drag), Wr, Wi, k, h);
    thomas2(S, -ck, 1 + ck * (2 - ax), Tr, Ti, k, h);
    // Poisson: psi(j+1) + psi(j-1) + (ax - 2) psi(j) = -omega
    for (let j = 1; j < nz - 1; j++) {
      Pr[j * h + k] = -Wr[j * h + k];
      Pi[j * h + k] = -Wi[j * h + k];
    }
    Pr[k] = Pi[k] = Pr[(nz - 1) * h + k] = Pi[(nz - 1) * h + k] = 0;
    thomas2(S, 1, ax - 2, Pr, Pi, k, h);
  }
  // inverse: omega and theta together, then psi two rows at a time
  const { W, T, P } = S;
  for (let j = 0; j < nz; j++) {
    const q = j * h;
    for (let k = 0; k < h; k++) {
      const k2 = (nx - k) & mx;
      // Z_k = A_k + i B_k, Z_(N-k) = conj(A_k) + i conj(B_k)
      zr[k] = Wr[q + k] - Ti[q + k];
      zi[k] = Wi[q + k] + Tr[q + k];
      if (k2 !== k) {
        zr[k2] = Wr[q + k] + Ti[q + k];
        zi[k2] = -Wi[q + k] + Tr[q + k];
      }
    }
    fft(zr, zi, 1);
    const o = j * nx, s = 1 / nx;
    for (let i = 0; i < nx; i++) {
      W[o + i] = zr[i] * s;
      T[o + i] = zi[i] * s + lin[j];
    }
  }
  for (let j = 0; j < nz; j += 2) {
    const q = j * h, q2 = q + h;
    for (let k = 0; k < h; k++) {
      const k2 = (nx - k) & mx;
      zr[k] = Pr[q + k] - Pi[q2 + k];
      zi[k] = Pi[q + k] + Pr[q2 + k];
      if (k2 !== k) {
        zr[k2] = Pr[q + k] + Pi[q2 + k];
        zi[k2] = -Pi[q + k] + Pr[q2 + k];
      }
    }
    fft(zr, zi, 1);
    const o = j * nx, s = 1 / nx;
    for (let i = 0; i < nx; i++) {
      P[o + i] = zr[i] * s;
      P[o + nx + i] = zi[i] * s;
    }
  }
}

function step(S, dt) {
  velocities(S);
  advect(S, dt);
  diffuseSolve(S, dt);
  S.time += dt;
}

// Analytic start: the conduction profile plus a few plume-shaped swells, then a short spin-up.
function seedState(S) {
  const { nx, nz, T, d } = S;
  const M = 7, c = [], ph = [];
  for (let m = 0; m < M; m++) {
    c.push((0.22 * (Math.random() + 0.4)) / (1 + 0.25 * m));
    ph.push(Math.random() * TAU);
  }
  for (let j = 1; j < nz - 1; j++) {
    const sj = sin((PI * j) / d);
    for (let i = 0; i < nx; i++) {
      let a = 0;
      for (let m = 0; m < M; m++) a += c[m] * cos((TAU * (m + 1) * i) / nx + ph[m]);
      T[j * nx + i] = S.lin[j] + sj * a;
    }
  }
  S.W.fill(0);
  S.P.fill(0);
}

function setParams(S, ra, pr, R, pace) {
  S.R = R;
  S.kap = KAP0 * pace;
  S.nu = pr * S.kap;
  S.gB = (ra * S.nu * S.kap) / (S.d * S.d * S.d);
  S.drag = DRAG0 * pace;
}

const KNOB = [0, 2, 0, 0.06];
const PARAM_WR = 1.0, PARAM_SCH = 0.06, PARAM_DEL = 0.04, PARAM_FA = 0.12;

// ---- colour. OKLab (Ottosson 2020, constants from memory)
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
const STOPS = [
  [0.0, 0.3, 0.13, 275],
  [0.18, 0.42, 0.17, 268],
  [0.38, 0.52, 0.19, 305],
  [0.55, 0.62, 0.2, 345],
  [0.72, 0.74, 0.17, 395],
  [0.86, 0.83, 0.15, 430],
  [1.0, 0.94, 0.09, 455],
];
const LN = 512;
const TMP = [0, 0, 0];
function buildLut(S, shift) {
  const lut = S.lut;
  for (let k = 0; k < LN; k++) {
    const t = k / (LN - 1);
    let q = 1;
    while (q < STOPS.length - 1 && STOPS[q][0] < t) q++;
    const A = STOPS[q - 1], B = STOPS[q], u = (t - A[0]) / (B[0] - A[0]), w = u * u * (3 - 2 * u);
    const L = A[1] + (B[1] - A[1]) * w, h = ((A[3] + (B[3] - A[3]) * w + shift) * PI) / 180;
    let C = A[2] + (B[2] - A[2]) * w;
    for (let it = 0; it < 8; it++) {
      lin(L, C * cos(h), C * sin(h), TMP);
      if (TMP[0] >= -0.002 && TMP[1] >= -0.002 && TMP[2] >= -0.002 && TMP[0] <= 1.002 && TMP[1] <= 1.002 && TMP[2] <= 1.002) break;
      C *= 0.9;
    }
    lut[3 * k] = L;
    lut[3 * k + 1] = C * cos(h);
    lut[3 * k + 2] = C * sin(h);
  }
  S.hueDone = shift;
}

function knobs(S, k) {
  const heat = cl(k[1], 0.5, 4), scale = cl(k[2], -1, 1), pk = cl(k[3], -1, 1);
  const ra = RA0 * pow(2, 1.2 * (heat - 2));
  const R = 2.1 * pow(1.7, -scale);
  const pr = pow(6, pk);
  setParams(S, ra, pr, R, 1);
}

export function setup(params) {
  const S = (params.s = newState(NX, NZ));
  buildLut(S, 0);
  knobs(S, KNOB);
  seedState(S);
  for (let n = 0; n < 150; n++) step(S, 0.1);
  S.time = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || KNOB, h = cl(dt || 0, 0, 0.1);
  knobs(S, k);
  const hue = cl(k[0], 0, 1) * 360;
  if (abs(hue - S.hueDone) > 0.5) buildLut(S, hue);
  step(S, h);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { nx, nz, T, mean, lut } = S, mx = nx - 1, o = [0, 0, 0];
  let ss = 0;
  for (let j = 0; j < nz; j++) {
    let m = 0;
    for (let i = 0; i < nx; i++) m += T[j * nx + i];
    mean[j] = m / nx;
  }
  for (let j = 1; j < nz - 1; j++) for (let i = 0; i < nx; i++) ss += (T[j * nx + i] - mean[j]) ** 2;
  S.sig += (sqrt(ss / (nx * (nz - 2))) - S.sig) * 0.05;
  const is = 1 / max(1e-3, S.sig);
  for (let y = 0; y < nz; y++)
    for (let x = 0; x < nx; x++) {
      const k = y * nx + x, q = (T[k] - mean[y]) * is;
      let t = 0.5 + 0.5 * Math.tanh(0.9 * q) * 0.95 + 0.5 * (T[k] - 0.5) * PARAM_WR;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const idx = 3 * ((t * (LN - 1) + 0.5) | 0);
      let L = lut[idx];
      const g = (T[y * nx + ((x + 1) & mx)] - T[y * nx + ((x - 1) & mx)]) * is;
      L += PARAM_SCH * Math.tanh(g);
      const gx = 0.5 * (T[k + ((x + 1) & mx) - x] - T[k + ((x - 1) & mx) - x]), gy = 0.5 * (T[min(nz - 1, y + 1) * nx + x] - T[max(0, y - 1) * nx + x]);
      const gm = sqrt(gx * gx + gy * gy) + 1e-6;
      const fd = (PARAM_DEL / gm - 2) * 0.5;
      L += PARAM_FA * cos((TAU * T[k]) / PARAM_DEL) * (fd < 0 ? 0 : fd > 1 ? 1 : fd);
      lin(L, lut[idx + 1], lut[idx + 2], o);
      display.setPixel(x, y, gam(o[0]), gam(o[1]), gam(o[2]));
    }
}
