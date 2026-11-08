// ===== Patternflow pattern =====
// Title:   Supersonic Turbulence
// Family:  sim
// Idea:    draft
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 118
// Round:   118
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Mach=-1..1
//
// Knob 1: Hue. draft
// Knob 2: Flow. draft
// Knob 3: Scale. draft
// Knob 4: Mach. draft

const NX = 64, NY = 128, N = NX * NY;
const { floor, ceil, exp, sqrt, abs, sin, cos, PI, min, max, pow, log, round } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ---- tunables
const CFL = 0.45; // Courant number of each sweep
const RMIN = 1e-3; // density floor
const VCAP = 9; // no cell is faster than this, in sound speeds

// ---- the gas ---------------------------------------------------------------------------------
// Isothermal Euler on an nx by ny torus, c = 1 and one cell is one length unit. State: density R and momentum MX, MY.
// A sweep is MUSCL-Hancock along one axis: limited slopes of (rho, u, w), a half-step predictor in primitive variables,
// then the HLLE flux, with the transverse velocity w carried upwind by the sign of the mass flux.
const SCN = 520;
const gr = new Float64Array(SCN), gu = new Float64Array(SCN), gw = new Float64Array(SCN);
const rA = new Float64Array(SCN), uA = new Float64Array(SCN), wA = new Float64Array(SCN);
const rB = new Float64Array(SCN), uB = new Float64Array(SCN), wB = new Float64Array(SCN);
const fR = new Float64Array(SCN), fQ = new Float64Array(SCN), fT = new Float64Array(SCN);

function line(R, Q, T, base, stride, n, lam, lim, G) {
  const m = n + 4;
  for (let s = 0; s < m; s++) {
    let c = s - 2;
    if (c < 0) c += n;
    else if (c >= n) c -= n;
    const k = base + c * stride, r = R[k], ir = 1 / r;
    gr[s] = r;
    gu[s] = Q[k] * ir;
    gw[s] = T[k] * ir;
  }
  const h = 0.5 * lam;
  let fb = 0;
  for (let s = 1; s < m - 1; s++) {
    const rc = gr[s], uc = gu[s], wc = gw[s];
    let a = rc - gr[s - 1], b = gr[s + 1] - rc, ab = a * b, dr, du, dw;
    if (lim) {
      // monotonised central
      if (ab > 0) {
        const aa = a < 0 ? -a : a, bb = b < 0 ? -b : b, cc = 0.5 * (a + b), c2 = cc < 0 ? -cc : cc;
        let q = aa < bb ? aa : bb;
        q *= 2;
        q = q < c2 ? q : c2;
        dr = a < 0 ? -q : q;
      } else dr = 0;
      a = uc - gu[s - 1];
      b = gu[s + 1] - uc;
      ab = a * b;
      if (ab > 0) {
        const aa = a < 0 ? -a : a, bb = b < 0 ? -b : b, cc = 0.5 * (a + b), c2 = cc < 0 ? -cc : cc;
        let q = aa < bb ? aa : bb;
        q *= 2;
        q = q < c2 ? q : c2;
        du = a < 0 ? -q : q;
      } else du = 0;
      a = wc - gw[s - 1];
      b = gw[s + 1] - wc;
      ab = a * b;
      if (ab > 0) {
        const aa = a < 0 ? -a : a, bb = b < 0 ? -b : b, cc = 0.5 * (a + b), c2 = cc < 0 ? -cc : cc;
        let q = aa < bb ? aa : bb;
        q *= 2;
        q = q < c2 ? q : c2;
        dw = a < 0 ? -q : q;
      } else dw = 0;
    } else {
      // van Leer
      dr = ab > 0 ? (2 * ab) / (a + b) : 0;
      a = uc - gu[s - 1];
      b = gu[s + 1] - uc;
      ab = a * b;
      du = ab > 0 ? (2 * ab) / (a + b) : 0;
      a = wc - gw[s - 1];
      b = gw[s + 1] - wc;
      ab = a * b;
      dw = ab > 0 ? (2 * ab) / (a + b) : 0;
    }
    const rm = rc - h * (uc * dr + rc * du), um = uc - h * (uc * du + dr / rc), wm = wc - h * uc * dw;
    const ra = rm + 0.5 * dr, rb = rm - 0.5 * dr;
    if (ra < RMIN || rb < RMIN) {
      rA[s] = rB[s] = rc;
      uA[s] = uB[s] = uc;
      wA[s] = wB[s] = wc;
      fb++;
    } else {
      rA[s] = ra;
      rB[s] = rb;
      uA[s] = um + 0.5 * du;
      uB[s] = um - 0.5 * du;
      wA[s] = wm + 0.5 * dw;
      wB[s] = wm - 0.5 * dw;
    }
  }
  G.fallback += fb;
  for (let s = 1; s < m - 2; s++) {
    const rl = rA[s], ul = uA[s], wl = wA[s], rr = rB[s + 1], ur = uB[s + 1], wr = wB[s + 1];
    const ml = rl * ul, mr = rr * ur, sl = sqrt(rl), sr = sqrt(rr), ub = (sl * ul + sr * ur) / (sl + sr);
    let bm = (ul < ub ? ul : ub) - 1, bp = (ur > ub ? ur : ub) + 1;
    if (bm > 0) bm = 0;
    if (bp < 0) bp = 0;
    const d = 1 / (bp - bm), bb = bm * bp;
    const f0 = (bp * ml - bm * mr + bb * (rr - rl)) * d;
    fR[s] = f0;
    fQ[s] = (bp * (ml * ul + rl) - bm * (mr * ur + rr) + bb * (mr - ml)) * d;
    fT[s] = f0 > 0 ? f0 * wl : f0 * wr;
  }
  for (let c = 0; c < n; c++) {
    const s = c + 2, k = base + c * stride;
    R[k] -= lam * (fR[s] - fR[s - 1]);
    Q[k] -= lam * (fQ[s] - fQ[s - 1]);
    T[k] -= lam * (fT[s] - fT[s - 1]);
  }
}

function makeGas(nx, ny) {
  const n = nx * ny;
  const G = {
    nx, ny, n, R: new Float64Array(n), MX: new Float64Array(n), MY: new Float64Array(n),
    fx: new Float64Array(n), fy: new Float64Array(n),
    par: 0, fallback: 0, floored: 0, added: 0, lim: 1,
    vmax: 0, ucx: 0, ucy: 0, mass: 0, ek: 0, ekv: 0, capped: 0, steps: 0,
  };
  return G;
}

// One pass over the state: net momentum, kinetic energy, the fastest cell, a cap on speed. Returns the largest |u| or |v|.
function prep(G, vcap) {
  const { R, MX, MY, n } = G;
  let sm_ = 0, sx = 0, sy = 0, ke = 0, kv = 0, vm = 0, cap = 0;
  const v2 = vcap * vcap;
  for (let k = 0; k < n; k++) {
    const r = R[k];
    let qx = MX[k], qy = MY[k];
    const ir = 1 / r, u = qx * ir, v = qy * ir, s2 = u * u + v * v;
    if (s2 > v2) {
      const f = vcap / sqrt(s2);
      qx *= f;
      qy *= f;
      MX[k] = qx;
      MY[k] = qy;
      cap++;
    }
    sm_ += r;
    sx += qx;
    sy += qy;
    const au = abs(qx * ir), av = abs(qy * ir);
    const e = qx * qx + qy * qy;
    ke += e * ir;
    kv += e * ir * ir;
    if (au > vm) vm = au;
    if (av > vm) vm = av;
  }
  G.mass = sm_;
  G.ucx = sx / sm_;
  G.ucy = sy / sm_;
  G.ek = (0.5 * ke) / n; // kinetic energy per cell
  G.ekv = (0.5 * kv) / n; // 0.5 u^2 averaged by volume
  G.capped = cap;
  G.vmax = vm;
  return vm;
}

function step(G, dt, lam) {
  const { R, MX, MY, fx, fy, n, nx, ny } = G;
  const ux = G.ucx, uy = G.ucy;
  for (let k = 0; k < n; k++) {
    const r = R[k];
    MX[k] += r * (dt * fx[k] - ux);
    MY[k] += r * (dt * fy[k] - uy);
  }
  const sx = () => {
    for (let j = 0; j < ny; j++) line(R, MX, MY, j * nx, 1, nx, lam, G.lim, G);
  };
  const sy = () => {
    for (let i = 0; i < nx; i++) line(R, MY, MX, i, nx, ny, lam, G.lim, G);
  };
  if (G.par) {
    sy();
    sx();
  } else {
    sx();
    sy();
  }
  G.par ^= 1;
  let fl = 0;
  for (let k = 0; k < n; k++)
    if (R[k] < RMIN) {
      G.added += RMIN - R[k];
      R[k] = RMIN;
      fl++;
    }
  G.floored += fl;
  G.steps++;
}


// ---- the forcing -----------------------------------------------------------------------------
// Solenoidal by construction: f = curl of a stream function that is a sum of plane waves with whole-number wave
// vectors (nx, ny) of the torus, each an Ornstein-Uhlenbeck process. Wave (nx, ny) has wavelength 1 / sqrt((nx/64)^2 + (ny/128)^2).
const MXN = 7, MYN = 14, NGRP = MXN + 1;
const MODES = [];
for (let a = 0; a <= MXN; a++)
  for (let b = -MYN; b <= MYN; b++) {
    if (a === 0 && b <= 0) continue;
    const k = sqrt(a * a + (b * b) / 4);
    if (k > 7.2) continue;
    MODES.push({ a, b, k, nxh: b / 2 / k, nyh: -a / k, xc: 0, xs: 0, w: 0 });
  }

function makeForce(G, fac) {
  const nx = G.nx, ny = G.ny;
  const F = { nx, ny, fac, cx: [], sx: [], cy: [], sy: [], pxc: [], pxs: [], pyc: [], pys: [] };
  for (let a = 0; a <= MXN; a++) {
    const c = new Float64Array(nx), s = new Float64Array(nx);
    for (let i = 0; i < nx; i++) (c[i] = cos((TAU * a * (i + 0.5)) / nx)), (s[i] = sin((TAU * a * (i + 0.5)) / nx));
    F.cx.push(c);
    F.sx.push(s);
    F.pxc.push(new Float64Array(ny));
    F.pxs.push(new Float64Array(ny));
    F.pyc.push(new Float64Array(ny));
    F.pys.push(new Float64Array(ny));
  }
  for (let b = -MYN; b <= MYN; b++) {
    const c = new Float64Array(ny), s = new Float64Array(ny);
    for (let j = 0; j < ny; j++) (c[j] = cos((TAU * b * (j + 0.5)) / ny)), (s[j] = sin((TAU * b * (j + 0.5)) / ny));
    F.cy.push(c);
    F.sy.push(s);
  }
  return F;
}

// weights of the wave vectors round the ring of radius kf (cycles across the 64 LEDs), then the force field at amplitude A
function forceField(G, F, kf, A) {
  const { nx, ny } = F;
  let sw = 0;
  const sg = 0.5;
  for (const m of MODES) {
    const d = (m.k - kf) / sg;
    m.w = d * d < 18 ? exp(-0.5 * d * d) : 0;
    sw += m.w * m.w;
  }
  const norm = A / sqrt(sw);
  for (let g = 0; g < NGRP; g++) {
    F.pxc[g].fill(0);
    F.pxs[g].fill(0);
    F.pyc[g].fill(0);
    F.pys[g].fill(0);
  }
  let gmax = 0;
  for (const m of MODES) {
    if (m.w < 1e-3) continue;
    if (m.a > gmax) gmax = m.a;
    const cm = norm * m.w, ax = cm * m.nxh, ay = cm * m.nyh, CY = F.cy[m.b + MYN], SY = F.sy[m.b + MYN];
    const pxc = F.pxc[m.a], pxs = F.pxs[m.a], pyc = F.pyc[m.a], pys = F.pys[m.a], xs = m.xs, xc = m.xc;
    for (let j = 0; j < ny; j++) {
      const gc = xs * CY[j] - xc * SY[j], gs = -xs * SY[j] - xc * CY[j];
      pxc[j] += ax * gc;
      pxs[j] += ax * gs;
      pyc[j] += ay * gc;
      pys[j] += ay * gs;
    }
  }
  const { fx, fy } = G;
  for (let j = 0; j < ny; j++) {
    const o = j * nx;
    for (let i = 0; i < nx; i++) {
      let u = 0, v = 0;
      for (let g = 0; g <= gmax; g++) {
        const c = F.cx[g][i], s = F.sx[g][i];
        u += c * F.pxc[g][j] + s * F.pxs[g][j];
        v += c * F.pyc[g][j] + s * F.pys[g][j];
      }
      fx[o + i] = u;
      fy[o + i] = v;
    }
  }
}

function randn() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

// ---- the state -------------------------------------------------------------------------------
function newState(fac, k) {
  const g = makeGas(NX * fac, NY * fac);
  const S = {
    g, F: makeForce(g, fac), fac, A: 0.3, Ms: 2.5, tcorr: 8, kf: 2.7, mt: 2.5, acc: 0, mtime: 0, hue: 0, flowS: 2,
  };
  return S;
}

function seedField(S, kf, mach) {
  const g = S.g, { nx, ny, R, MX, MY } = g;
  const u = new Float64Array(nx * ny), v = new Float64Array(nx * ny);
  for (const m of MODES) {
    const d = (m.k - kf) / 0.8, w = exp(-0.5 * d * d);
    if (w < 1e-2) continue;
    const kx = (TAU * m.a) / nx, ky = (TAU * m.b) / ny, kk = sqrt(kx * kx + ky * ky), q = w * randn(), ph = Math.random() * TAU;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const s = q * sin(kx * (i + 0.5) + ky * (j + 0.5) + ph);
        u[j * nx + i] -= (ky / kk) * s;
        v[j * nx + i] += (kx / kk) * s;
      }
  }
  let e = 0;
  for (let k = 0; k < nx * ny; k++) e += u[k] * u[k] + v[k] * v[k];
  const sc = mach / sqrt(e / (nx * ny));
  for (let k = 0; k < nx * ny; k++) {
    R[k] = 1;
    MX[k] = u[k] * sc;
    MY[k] = v[k] * sc;
  }
}

// ---- one frame of model time ----------------------------------------------------------------
const MS_MAX = 6; // sub-steps a frame may take
function advance(S, tm, kf, mt, hue) {
  const g = S.g, F = S.F, fac = S.fac;
  if (tm <= 0) return;
  // the forcing process, once per frame
  const ex = exp(-tm / S.tcorr), sg = sqrt(1 - ex * ex);
  for (const m of MODES) {
    m.xc = m.xc * ex + sg * randn();
    m.xs = m.xs * ex + sg * randn();
  }
  forceField(g, F, kf, S.A);
  S.acc += tm;
  const dx = 1 / fac;
  let n = 0;
  while (n < MS_MAX) {
    const vm = prep(g, VCAP);
    const dtc = (CFL * dx) / (vm + 1);
    if (S.acc < dtc) break;
    step(g, dtc, dtc / dx);
    S.acc -= dtc;
    S.mtime += dtc;
    n++;
  }
  if (n >= MS_MAX) S.acc = 0;
  S.lastSteps = n;
  // controller: the forcing amplitude chases the rms Mach number (mass weighted)
  const mm = sqrt((2 * g.ek * g.n) / g.mass);
  S.Mm = mm;
  S.Ms += (mm - S.Ms) * (1 - exp(-tm / 3));
  S.A = cl(S.A * exp((tm / 10) * (mt / S.Ms - 1)), 0.01, 3);
}

// ---- colour ----------------------------------------------------------------------------------
function okLin(L, C, h, out) {
  const hr = (h * PI) / 180;
  for (let k = 1; k >= 0; k -= 0.05) {
    const a = C * k * cos(hr), b = C * k * sin(hr);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    if (k < 0.01 || (r > -0.002 && r < 1.002 && g > -0.002 && g < 1.002 && bb > -0.002 && bb < 1.002)) {
      out[0] = r < 0 ? 0 : r;
      out[1] = g < 0 ? 0 : g;
      out[2] = bb < 0 ? 0 : bb;
      return;
    }
  }
}
const GAM = new Uint8Array(4097);
for (let k = 0; k <= 4096; k++) {
  const x = k / 4096;
  GAM[k] = 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055) + 0.5;
}
const gam = (x) => GAM[x <= 0 ? 0 : x >= 1 ? 4096 : (x * 4096 + 0.5) | 0];
// stops of the density ramp: [position, L, C, h]
const RAMP = [
  [0.0, 0.3, 0.09, 285],
  [0.25, 0.42, 0.11, 262],
  [0.5, 0.58, 0.11, 215],
  [0.72, 0.72, 0.12, 165],
  [0.86, 0.84, 0.13, 95],
  [1.0, 0.97, 0.05, 90],
];
const LN = 256;
function buildLut(S, hue) {
  const lut = S.lut, o = [0, 0, 0];
  for (let i = 0; i < LN; i++) {
    const v = i / (LN - 1);
    let j = 1;
    while (j < RAMP.length - 1 && v > RAMP[j][0]) j++;
    const A = RAMP[j - 1], B = RAMP[j], t = cl((v - A[0]) / (B[0] - A[0]), 0, 1);
    const L = A[1] + (B[1] - A[1]) * t;
    const aa = A[2] * cos((A[3] * PI) / 180), ab = A[2] * sin((A[3] * PI) / 180), ba = B[2] * cos((B[3] * PI) / 180), bb = B[2] * sin((B[3] * PI) / 180);
    const a = aa + (ba - aa) * t, b = ab + (bb - ab) * t;
    okLin(L, sqrt(a * a + b * b), (Math.atan2(b, a) * 180) / PI + hue * 360, o);
    lut[3 * i] = o[0];
    lut[3 * i + 1] = o[1];
    lut[3 * i + 2] = o[2];
  }
  S.lutHue = hue;
}

const OPEN = [0, 2, 0, 0.06];
function start(params, k) {
  const S = newState(1);
  S.lut = new Float32Array(3 * LN);
  S.lnr = new Float32Array(N);
  S.sch = new Float32Array(N);
  S.div = new Float32Array(N);
  S.tmp = new Float32Array(N);
  S.mu = new Float32Array(N);
  params.s = S;
  readKnobs(S, k, 1e9);
  S.kf = S.kft;
  S.mt = S.mtt;
  seedField(S, S.kf, S.mt);
  S.tcorr = 24 / S.mt;
  S.Ms = S.mt;
  buildLut(S, 0);
  for (let n = 0; n < 40; n++) advance(S, 0.2, S.kf, S.mt);
}
function readKnobs(S, k, f) {
  S.hue = cl(k[0], 0, 1);
  S.rate = 1.3 * cl(k[1], 0.5, 4);
  const sc = cl(k[2], -1, 1), q = cl(k[3], -1, 1);
  S.kft = 64 / (24 * pow(1.7, sc));
  S.mtt = 2.4 * pow(1.8, q);
}
export function setup(params) {
  start(params, OPEN);
}
export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, h = cl(dt || 0, 0, 0.1);
  readKnobs(S, k);
  const f = 1 - exp(-h / 0.4);
  const m0 = S.mt;
  S.kf += (S.kft - S.kf) * f;
  S.mt += (S.mtt - S.mt) * f;
  S.tcorr = 24 / S.mt;
  if (S.mt !== m0) {
    const r = S.mt / m0, g = S.g;
    for (let i = 0; i < N; i++) {
      g.MX[i] *= r;
      g.MY[i] *= r;
    }
  }
  advance(S, h * S.rate, S.kf, S.mt);
  if (abs(S.hue - S.lutHue) > 0.002) buildLut(S, S.hue);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const g = S.g, R = g.R, MX = g.MX, MY = g.MY, L = S.lnr, sch = S.sch, lut = S.lut;
  let m1 = 0, m2 = 0;
  for (let k = 0; k < N; k++) {
    const l = log(R[k]);
    L[k] = l;
    m1 += l;
    m2 += l * l;
  }
  m1 /= N;
  const sd = sqrt(max(0.05, m2 / N - m1 * m1));
  for (let y = 0; y < NY; y++) {
    const ym = ((y + NY - 1) % NY) * NX, y0 = y * NX, yp = ((y + 1) % NY) * NX;
    for (let x = 0; x < NX; x++) {
      const xm = (x + NX - 1) & (NX - 1), xp = (x + 1) & (NX - 1);
      const gx = L[y0 + xp] - L[y0 + xm], gy = L[yp + x] - L[ym + x];
      sch[y0 + x] = 0.5 * sqrt(gx * gx + gy * gy);
    }
  }
  for (let y = 0; y < NY; y++)
    for (let x = 0; x < NX; x++) {
      const k = y * NX + x;
      const t = cl(0.5 + (L[k] - m1) / (4.5 * sd), 0, 1);
      const idx = ((t * (LN - 1) + 0.5) | 0) * 3;
      const w = sm(0.15, 0.9, sch[k]);
      let r = lut[idx], gg = lut[idx + 1], b = lut[idx + 2];
      r += w * (1 - r) * 0.8;
      gg += w * (1 - gg) * 0.8;
      b += w * (1 - b) * 0.8;
      display.setPixel(x, y, gam(r), gam(gg), gam(b));
    }
}
