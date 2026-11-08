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
// @knobs Hue=0..1, Pace=0.5..3.5, Scale=-1..1, Prandtl=-1..1
//
// Knob 1: DRAFT
// Knob 2: DRAFT
// Knob 3: DRAFT
// Knob 4: DRAFT

// What the field is. Convection in a box 127 LEDs deep, the plates being the top row (T = 0) and the bottom row (T = 1), and
// 64 columns wide, periodic across. With the stream function psi, u = dpsi/dy and v = -dpsi/dx (y runs down), the vorticity w
// and the temperature T obey
//   dw/dt + u.grad w = nu del^2 w - gB dT/dx - drag (mean of w over x)
//   dT/dt + u.grad T = kappa del^2 T,        del^2 psi = -w.
// The plates are free-slip, psi = 0 and w = 0 on them, so Rayleigh's linear theory holds exactly: the conduction state is
// unstable above Ra = gB d^3 / (nu kappa) = 27 pi^4 / 4 = 657.5, at a wavelength of 2 sqrt 2 depths.
// One step: trace T and w back along the velocity (midpoint, Catmull-Rom look-up held between the four nearest values), add the
// buoyancy to w, then in Fourier space across the columns and finite differences down the rows diffuse w and T implicitly and
// solve del^2 psi = -w, one tridiagonal system per wavenumber. psi sits on the LEDs and u, v are central differences of it, so
// div u is zero to rounding.
// A column is R LEDs of depth wide, not one. With square cells the box would be half as wide as it is deep, and then only a
// wavelength of half a depth fits across: the first instability is at Ra = 29,900 and the flow is one pair of stripes.
// Stretching x by R = 2.6 makes the box 1.3 depths wide, so plumes have room to stand beside each other and to lean.

const { floor, ceil, exp, sqrt, abs, sin, cos, PI, min, max, pow, tanh } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- tunables
const NX = 64, NZ = 128;
const RA0 = 3e7; // Rayleigh number at every knob place
const PR0 = 0.3; // Prandtl number at Prandtl 0
const R0 = 2.6; // how many LEDs of depth one column is wide, at Scale 0
const GB0 = 4.7; // gB = g alpha dT at Pace 1, LEDs/s^2. Free fall over the depth, sqrt(gB d), is 24 LEDs a second
const DRAG0 = 0.15; // drag on the wind that blows along the plates, 1/s at Pace 1
const AMP0 = 0.15; // how far the spots on the plates swing, as a share of the plate difference
const PACE_OPEN = 1.5; // Pace at the Lab's opening K2 of 2

// ---- the picture
const GAIN = 0.9; // how hard the anomaly of T is pushed through the palette
const WALL = 0.5; // how much of the raw T, and so of the hot floor and cold ceiling, is kept
const RIM = 0.22; // the shadowgraph term, lightness per unit of laplacian of T
const LFLOOR = 0.6; // smallest local rms of the anomaly, as a share of the whole panel's, that the contrast is stretched by

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
  // sign -1 forward, +1 inverse, neither divided by N
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

// ---- state. Everything lives on the nx x nz LEDs: T, w, psi, u, v.
function newState(nx, nz) {
  const n = nx * nz, F = () => new Float64Array(n), h = nx / 2 + 1, pad = () => new Float64Array(nx * (nz + 4));
  const S = {
    nx, nz, n, d: nz - 1,
    T: F(), W: F(), P: F(), U: F(), V: F(), T2: F(), W2: F(), Tp: pad(), Wp: pad(),
    fft: makeFft(nx), zr: new Float64Array(nx), zi: new Float64Array(nx),
    Wr: new Float64Array(nz * h), Wi: new Float64Array(nz * h), Tr: new Float64Array(nz * h), Ti: new Float64Array(nz * h),
    Pr: new Float64Array(nz * h), Pi: new Float64Array(nz * h),
    cp: new Float64Array(nz), dp: new Float64Array(nz), dq: new Float64Array(nz),
    lin: new Float64Array(nz), cx: new Float64Array(h),
    // the numbers the knobs set
    R: 1, gB: 4, kap: 2, nu: 1, drag: 0, amp: 0, pace: 1, time: 0, kp: 1.5, ks: 0, kq: 0.06,
    pat: newPatches(),
    // what the picture reads
    lut: new Float32Array(3 * 512), hueDone: -1, mean: new Float64Array(nz), loc: F(), bq: F(), bh: F(), sig: 0.1, grm: 0.05, first: 1,
  };
  for (let j = 0; j < nz; j++) {
    S.lin[j] = j / (nz - 1);
    for (let i = 0; i < nx; i++) S.T[j * nx + i] = S.lin[j];
  }
  for (let k = 0; k < h; k++) S.cx[k] = 2 * cos((TAU * k) / nx) - 2;
  return S;
}

// ---- Catmull-Rom look-up of T and w at one foot point, on arrays padded with two rows above and below. Each value is held
// between the four nearest ones, so T never leaves the range of what it was.
function sampleBoth(Tp, Wp, nx, fi, fj, out) {
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
    out[f] = r < lo ? lo : r > hi ? hi : r;
  }
}
const OUT = [0, 0];

// u and v at the LEDs. In LEDs of depth a second: a row is 1 deep and a column R deep.
function velocities(S) {
  const { nx, nz, P, U, V } = S, mx = nx - 1, ir = 1 / S.R;
  for (let j = 1; j < nz - 1; j++) {
    const o = j * nx;
    for (let i = 0; i < nx; i++) {
      U[o + i] = 0.5 * (P[o + nx + i] - P[o - nx + i]);
      V[o + i] = -0.5 * ir * (P[o + ((i + 1) & mx)] - P[o + ((i - 1) & mx)]);
    }
  }
  const o1 = nx, oN = (nz - 1) * nx;
  for (let i = 0; i < nx; i++) {
    U[i] = U[o1 + i]; // free-slip: no shear at the plate, so the speed along it is the one a row off it
    V[i] = 0;
    U[oN + i] = U[oN - nx + i];
    V[oN + i] = 0;
  }
}

function advect(S, dt) {
  const { nx, nz, T, W, U, V, T2, W2, Tp, Wp } = S, mx = nx - 1, ymax = nz - 1, ir = 1 / S.R;
  // two ghost rows beyond each plate, odd about the plate's value, so a straight profile stays straight up to the plate
  for (let j = 0; j < nz; j++) {
    const o = j * nx, q = (j + 2) * nx;
    for (let i = 0; i < nx; i++) {
      Tp[q + i] = T[o + i];
      Wp[q + i] = W[o + i];
    }
  }
  for (let g = 1; g <= 2; g++) {
    const a = (2 - g) * nx, c = (nz + 1 + g) * nx;
    for (let i = 0; i < nx; i++) {
      Tp[a + i] = 2 * T[i] - T[g * nx + i];
      Wp[a + i] = -W[g * nx + i];
      Tp[c + i] = 2 * T[(nz - 1) * nx + i] - T[(nz - 1 - g) * nx + i];
      Wp[c + i] = -W[(nz - 1 - g) * nx + i];
    }
  }
  for (let j = 1; j < nz - 1; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      // midpoint back-trace, with the velocity at the midpoint looked up bilinearly
      const xm = i - 0.5 * dt * ir * U[k];
      let ym = j - 0.5 * dt * V[k];
      ym = ym < 0 ? 0 : ym > ymax ? ymax : ym;
      const i0 = floor(xm), j0 = min(floor(ym), ymax - 1), a = xm - i0, b = ym - j0;
      const x0 = i0 & mx, x1 = (i0 + 1) & mx, r0 = j0 * nx, r1 = r0 + nx;
      const w00 = (1 - a) * (1 - b), w10 = a * (1 - b), w01 = (1 - a) * b, w11 = a * b;
      const u1 = w00 * U[r0 + x0] + w10 * U[r0 + x1] + w01 * U[r1 + x0] + w11 * U[r1 + x1];
      const v1 = w00 * V[r0 + x0] + w10 * V[r0 + x1] + w01 * V[r1 + x0] + w11 * V[r1 + x1];
      let yf = j - dt * v1;
      yf = yf < 0 ? 0 : yf > ymax ? ymax : yf;
      sampleBoth(Tp, Wp, nx, i - dt * ir * u1, yf, OUT);
      T2[k] = OUT[0];
      W2[k] = OUT[1];
    }
  for (let i = 0; i < nx; i++) {
    T2[i] = T[i];
    W2[i] = 0;
    T2[(nz - 1) * nx + i] = T[(nz - 1) * nx + i];
    W2[(nz - 1) * nx + i] = 0;
  }
}

// One Thomas solve down the rows of one wavenumber: a x(j-1) + b x(j) + a x(j+1) = r(j) for rows 1 to nz-2, the plate rows 0
// and nz-1 keeping the x they hold. The real and imaginary parts go together.
function thomas2(S, a, b, re, im, o, st) {
  const { nz, cp, dp, dq } = S, e = (nz - 1) * st, l = nz - 2;
  let m = b, rr = re[o + st] - a * re[o], qq = im[o + st] - a * im[o];
  cp[1] = a / m;
  dp[1] = rr / m;
  dq[1] = qq / m;
  for (let j = 2; j < nz - 1; j++) {
    m = b - a * cp[j - 1];
    rr = re[o + j * st];
    qq = im[o + j * st];
    if (j === l) {
      rr -= a * re[o + e];
      qq -= a * im[o + e];
    }
    cp[j] = a / m;
    dp[j] = (rr - a * dp[j - 1]) / m;
    dq[j] = (qq - a * dq[j - 1]) / m;
  }
  re[o + l * st] = dp[l];
  im[o + l * st] = dq[l];
  for (let j = l - 1; j >= 1; j--) {
    re[o + j * st] = dp[j] - cp[j] * re[o + (j + 1) * st];
    im[o + j * st] = dq[j] - cp[j] * im[o + (j + 1) * st];
  }
}

// Buoyancy, then the implicit diffusion of w and T and the solve for psi, in Fourier space across the columns. Two real rows
// share one complex transform: w in the real part, T minus its conduction profile in the imaginary part.
function diffuseSolve(S, dt) {
  const { nx, nz, W2, T2, lin, fft, zr, zi, Wr, Wi, Tr, Ti, Pr, Pi, cx, gB, kap, nu, W, T, P } = S;
  const h = nx / 2 + 1, mx = nx - 1, ir = 1 / S.R, ir2 = ir * ir;
  for (let j = 1; j < nz - 1; j++) {
    const o = j * nx;
    for (let i = 0; i < nx; i++) W2[o + i] -= dt * gB * 0.5 * ir * (T2[o + ((i + 1) & mx)] - T2[o + ((i - 1) & mx)]);
  }
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
      Wr[q + k] = 0.5 * (zr[k] + zr[k2]);
      Wi[q + k] = 0.5 * (zi[k] - zi[k2]);
      Tr[q + k] = 0.5 * (zi[k] + zi[k2]);
      Ti[q + k] = -0.5 * (zr[k] - zr[k2]);
    }
  }
  const cn = nu * dt, ck = kap * dt;
  for (let k = 0; k < h; k++) {
    const ax = cx[k] * ir2;
    // wavenumber 0 is the wind along the plates: it also feels the drag
    thomas2(S, -cn, 1 + cn * (2 - ax) + (k ? 0 : dt * S.drag), Wr, Wi, k, h);
    thomas2(S, -ck, 1 + ck * (2 - ax), Tr, Ti, k, h);
    for (let j = 1; j < nz - 1; j++) {
      Pr[j * h + k] = -Wr[j * h + k];
      Pi[j * h + k] = -Wi[j * h + k];
    }
    Pr[k] = Pi[k] = Pr[(nz - 1) * h + k] = Pi[(nz - 1) * h + k] = 0;
    thomas2(S, 1, ax - 2, Pr, Pi, k, h); // psi(j+1) + psi(j-1) + (ax - 2) psi(j) = -w(j)
  }
  for (let j = 0; j < nz; j++) {
    const q = j * h;
    for (let k = 0; k < h; k++) {
      const k2 = (nx - k) & mx;
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

// The plates are not quite uniform. Three warm and cool spots on each, plane waves across the 64 columns, drift along the floor
// and the ceiling at their own slow rates. Plumes start where the floor is warm, so they keep starting in new places and the
// flow cannot settle into one steady set. Each plate's mean is unchanged, 1 and 0.
function newPatches() {
  const P = [];
  for (let side = 0; side < 2; side++)
    for (let m = 0; m < 3; m++)
      P.push({
        side, k: 2 + ((m * 2 + side + floor(Math.random() * 2)) % 6), a: [1, 0.8, 0.6][m] / 1.9,
        w: (0.06 + 0.13 * Math.random()) * (Math.random() < 0.5 ? -1 : 1), ph: Math.random() * TAU,
      });
  return P;
}
function wallTemps(S, dt) {
  const { nx, nz, T } = S, o = (nz - 1) * nx;
  for (let i = 0; i < nx; i++) {
    T[i] = 0;
    T[o + i] = 1;
  }
  for (const q of S.pat) {
    q.ph = (q.ph + q.w * S.pace * dt) % TAU;
    const A = S.amp * q.a, base = q.side ? o : 0;
    for (let i = 0; i < nx; i++) T[base + i] += A * cos((TAU * q.k * i) / nx + q.ph);
  }
}

function step(S, dt) {
  wallTemps(S, dt);
  velocities(S);
  advect(S, dt);
  diffuseSolve(S, dt);
  S.time += dt;
}

// Analytic start: the conduction profile plus seven plume-shaped swells of random phase, standing on the whole depth.
function seedState(S) {
  const { nx, nz, T, d } = S, M = 7, c = [], ph = [];
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

// ---- the knobs. Pace, Scale and Prandtl in; gB, kappa, nu, the column width and the drag out. gB scales with the square of
// Pace and kappa with Pace, so Ra = gB d^3 / (nu kappa) does not move: Pace is a clock. Prandtl is set at that Ra and that gB,
// so a different Prandtl changes the fluid and leaves the free-fall speed alone.
function setParams(S, ra, pr, R, pace) {
  S.R = R;
  S.pace = pace;
  S.gB = GB0 * pace * pace;
  S.kap = sqrt((S.gB * S.d * S.d * S.d) / (ra * pr));
  S.nu = pr * S.kap;
  S.drag = DRAG0 * pace;
  S.amp = AMP0;
}
const KNOB = [0, 2, 0, 0.06];
function knobTargets(k) {
  return [(cl(k[1], 0.5, 3.5) * PACE_OPEN) / 2, cl(k[2], -1, 1), cl(k[3], -1, 1)];
}
function applyKnobs(S) {
  setParams(S, RA0, PR0 * pow(10, S.kq), R0 * pow(1.55, -S.ks), S.kp);
}

// ---- colour. OKLab (Bjorn Ottosson, 2020, constants from memory), one ramp from cold to hot. The middle is the darkest part of
// it: the bulk of a convecting layer is mixed to one temperature, and a dark ground lets the plumes stand in it.
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
// t, lightness, chroma, hue in degrees
const STOPS = [
  [0.0, 0.5, 0.15, 250],
  [0.2, 0.38, 0.17, 262],
  [0.38, 0.27, 0.14, 280],
  [0.5, 0.22, 0.1, 295],
  [0.62, 0.32, 0.15, 335],
  [0.76, 0.55, 0.17, 380],
  [0.88, 0.78, 0.15, 425],
  [1.0, 0.95, 0.09, 455],
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
    let L = A[1] + (B[1] - A[1]) * w, C = A[2] + (B[2] - A[2]) * w;
    const hd = A[3] + (B[3] - A[3]) * w + shift, h = (hd * PI) / 180;
    // a dark orange or olive reads as brown on the panel, so the warm hues come up in lightness when the ramp is low
    let dh = (((hd - 75) % 360) + 360) % 360;
    if (dh > 180) dh -= 360;
    L += 0.17 * exp(-(dh * dh) / 2500) * (1 - sm(0.4, 0.75, L));
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
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

export function setup(params, knobValues) {
  const S = (params.s = newState(NX, NZ));
  buildLut(S, 0);
  [S.kp, S.ks, S.kq] = knobTargets(knobValues || KNOB);
  applyKnobs(S);
  seedState(S);
  // a spin-up of 22.5 s of flow time at Pace 1.5, so that the first frame already has plumes standing
  const dt = 22.5 / (S.kp * 150);
  for (let n = 0; n < 150; n++) step(S, dt);
  S.time = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || KNOB;
  if (!params.s) setup(params, k);
  const S = params.s, h = cl(dt || 0, 0, 0.1);
  const hue = cl(k[0], 0, 1) * 360;
  if (abs(hue - S.hueDone) > 0.5) buildLut(S, hue);
  if (h <= 0) return;
  const tg = knobTargets(k), f = 1 - exp(-4 * h);
  S.kp += (tg[0] - S.kp) * f;
  S.ks += (tg[1] - S.ks) * f;
  S.kq += (tg[2] - S.kq) * f;
  applyKnobs(S);
  const n = max(1, ceil(h * 30 - 1e-6));
  for (let i = 0; i < n; i++) step(S, h / n);
  if (!isFinite(S.P[S.n >> 1] + S.T[S.n >> 1] + S.W[S.n >> 2])) {
    // never reached in the runs below; if a value ever went bad, start the box over rather than stay dark
    S.T.fill(0.5);
    seedState(S);
  }
}

// ---- the picture. A temperature in the middle of a layer tells little: it is mixed to about one value, with thin warm and
// cold plumes standing in it. So the colour is read from the anomaly of T against its mean along the row, divided by the rms
// of that anomaly in the neighbourhood (9 columns by 21 rows, never less than LFLOOR of the whole panel's), with a share of the
// raw T added back so that the hot floor and the cold ceiling still read. The lightness gets a rim from the laplacian of T,
// which is the shadowgraph of the experiment: it is bright on the side of a plume where the temperature curves up.
export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { nx, nz, T, mean, lut, R, loc, bq, bh } = S, mx = nx - 1, o = [0, 0, 0], ir2 = 1 / (R * R), cnt = nx * (nz - 2);
  let ss = 0, gs = 0;
  for (let j = 0; j < nz; j++) {
    let m = 0;
    for (let i = 0; i < nx; i++) m += T[j * nx + i];
    mean[j] = m / nx;
  }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i, q = T[k] - mean[j];
      bq[k] = q * q;
      if (j > 0 && j < nz - 1) {
        ss += q * q;
        gs += ((T[j * nx + ((i + 1) & mx)] - T[j * nx + ((i - 1) & mx)]) * ir2) ** 2 * 0.25 + (T[k + nx] - T[k - nx]) ** 2 * 0.25;
      }
    }
  const a = S.first ? 1 : 0.05;
  S.first = 0;
  S.sig += (sqrt(ss / cnt) - S.sig) * a;
  S.grm += (sqrt(gs / cnt) - S.grm) * a;
  // local rms: a running box of 9 columns along each row, then of 21 rows down each column
  for (let j = 0; j < nz; j++) {
    const o0 = j * nx;
    let s = 0;
    for (let d = -4; d <= 4; d++) s += bq[o0 + ((d + nx) & mx)];
    for (let i = 0; i < nx; i++) {
      bh[o0 + i] = s;
      s += bq[o0 + ((i + 5) & mx)] - bq[o0 + ((i - 4 + nx) & mx)];
    }
  }
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      let s = 0, n = 0;
      for (let d = -10; d <= 10; d++) {
        const jj = j + d;
        if (jj >= 0 && jj < nz) {
          s += bh[jj * nx + i];
          n++;
        }
      }
      loc[j * nx + i] = sqrt(s / (n * 9));
    }
  const floorLoc = LFLOOR * S.sig, il = 1 / (1.5 * max(1e-4, S.grm));
  for (let y = 0; y < nz; y++)
    for (let x = 0; x < nx; x++) {
      const k = y * nx + x, q = (T[k] - mean[y]) / max(loc[k], floorLoc);
      let t = 0.5 + 0.45 * tanh(GAIN * q) + WALL * (T[k] - 0.5);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const idx = 3 * ((t * (LN - 1) + 0.5) | 0);
      let L = lut[idx];
      if (y > 0 && y < nz - 1) {
        const lap = (T[y * nx + ((x + 1) & mx)] + T[y * nx + ((x - 1) & mx)] - 2 * T[k]) * ir2 + T[k + nx] + T[k - nx] - 2 * T[k];
        L += RIM * tanh(lap * il);
      }
      L = L < 0.05 ? 0.05 : L > 0.98 ? 0.98 : L;
      lin(L, lut[idx + 1], lut[idx + 2], o);
      display.setPixel(x, y, gam(o[0]), gam(o[1]), gam(o[2]));
    }
}
