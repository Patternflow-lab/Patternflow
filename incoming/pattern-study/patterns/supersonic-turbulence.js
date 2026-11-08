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

const NX = 64, NY = 128, N = NX * NY, MX_ = NX - 1;
const { floor, ceil, exp, sqrt, abs, sin, cos, PI, min, max, pow, log, round } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// ---- tunables
const CFL = 0.55; // Courant number of each sweep
const RMIN = 2e-4; // density floor
const VCAP = 10; // no cell is faster than this, in sound speeds

// ---- the gas ---------------------------------------------------------------------------------
// Isothermal Euler on an nx by ny torus, c = 1 and one cell is one length unit. State: density R and momentum MX, MY.
// A sweep is MUSCL-Hancock along one axis: limited slopes of (rho, u, w), a half-step predictor in primitive variables,
// then the HLLE flux, with the transverse velocity w carried upwind by the sign of the mass flux.
const SCN = 520;
const gr = new Float64Array(SCN), gu = new Float64Array(SCN), gw = new Float64Array(SCN);
const rA = new Float64Array(SCN), uA = new Float64Array(SCN), wA = new Float64Array(SCN);
const rB = new Float64Array(SCN), uB = new Float64Array(SCN), wB = new Float64Array(SCN);
const fR = new Float64Array(SCN), fQ = new Float64Array(SCN), fT = new Float64Array(SCN);

// monotonised central slope of three neighbours
const mc = (a, b) => {
  if (a * b <= 0) return 0;
  const aa = a < 0 ? -a : a, bb = b < 0 ? -b : b, cc = 0.5 * (a + b), c2 = cc < 0 ? -cc : cc;
  let q = 2 * (aa < bb ? aa : bb);
  q = q < c2 ? q : c2;
  return a < 0 ? -q : q;
};

function line(R, Q, T, base, stride, n, lam, G) {
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
    const dr = mc(rc - gr[s - 1], gr[s + 1] - rc), du = mc(uc - gu[s - 1], gu[s + 1] - uc), dw = mc(wc - gw[s - 1], gw[s + 1] - wc);
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
    par: 0, fallback: 0, floored: 0, added: 0, renorm: 0,
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
  for (let pass = 0; pass < 2; pass++) {
    if (pass ^ G.par) for (let i = 0; i < nx; i++) line(R, MY, MX, i, nx, ny, lam, G);
    else for (let j = 0; j < ny; j++) line(R, MX, MY, j * nx, 1, nx, lam, G);
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
  if (fl) {
    // the floor added mass: give it back, so the total stays n and the velocities stay what they were
    let m = 0;
    for (let k = 0; k < n; k++) m += R[k];
    const f = n / m;
    for (let k = 0; k < n; k++) {
      R[k] *= f;
      MX[k] *= f;
      MY[k] *= f;
    }
    G.renorm += abs(f - 1);
  }
  G.steps++;
}


// ---- the forcing -----------------------------------------------------------------------------
// Solenoidal by construction: f = curl of a stream function that is a sum of plane waves with whole-number wave
// vectors (nx, ny) of the torus, each an Ornstein-Uhlenbeck process. Wave (nx, ny) has wavelength 1 / sqrt((nx/64)^2 + (ny/128)^2).
const MXN = 7, MYN = 14, NGRP = MXN + 1;
const MODES = []; // geometry only; the amplitudes live in the state, one pair per wave
for (let a = 0; a <= MXN; a++)
  for (let b = -MYN; b <= MYN; b++) {
    if (a === 0 && b <= 0) continue;
    const k = sqrt(a * a + (b * b) / 4);
    if (k > 7.2) continue;
    MODES.push({ a, b, k, nxh: b / 2 / k, nyh: -a / k });
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
function forceField(S, kf, A) {
  const G = S.g, F = S.F, { nx, ny } = F, W = S.w;
  let sw = 0;
  for (let n = 0; n < MODES.length; n++) {
    const d = (MODES[n].k - kf) / 0.5;
    W[n] = d * d < 18 ? exp(-0.5 * d * d) : 0;
    sw += W[n] * W[n];
  }
  const norm = A / sqrt(sw);
  for (let g = 0; g < NGRP; g++) {
    F.pxc[g].fill(0);
    F.pxs[g].fill(0);
    F.pyc[g].fill(0);
    F.pys[g].fill(0);
  }
  let gmax = 0;
  for (let n = 0; n < MODES.length; n++) {
    if (W[n] < 1e-3) continue;
    const m = MODES[n];
    if (m.a > gmax) gmax = m.a;
    const cm = norm * W[n], ax = cm * m.nxh, ay = cm * m.nyh, CY = F.cy[m.b + MYN], SY = F.sy[m.b + MYN];
    const pxc = F.pxc[m.a], pxs = F.pxs[m.a], pyc = F.pyc[m.a], pys = F.pys[m.a], xs = S.xs[n], xc = S.xc[n];
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
function newState(fac) {
  const g = makeGas(NX * fac, NY * fac);
  const nm = MODES.length;
  return {
    g, F: makeForce(g, fac), fac, A: 0.3, Ms: 2.5, tcorr: 8, kf: 2.7, mt: 2.5, acc: 0, mtime: 0, hue: 0,
    xc: new Float64Array(nm), xs: new Float64Array(nm), w: new Float64Array(nm), lastSteps: 0, Mm: 0,
  };
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
function advance(S, tm, kf, mt) {
  const g = S.g, fac = S.fac;
  if (tm <= 0) return;
  // the forcing process, once per frame
  const ex = exp(-tm / S.tcorr), sg = sqrt(1 - ex * ex);
  for (let n = 0; n < MODES.length; n++) {
    S.xc[n] = S.xc[n] * ex + sg * randn();
    S.xs[n] = S.xs[n] * ex + sg * randn();
  }
  forceField(S, kf, S.A);
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
  S.A = cl(S.A * exp((tm / 5) * cl(mt / S.Ms - 1, -0.7, 1)), 0.01, 8);
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
// The picture has two layers. The cool layer is the density, ln rho against its local surroundings, teal in the voids, blue and violet
// as the gas thickens. The warm layer is the shocks: where the gas is steep or being squeezed it passes through magenta and orange to white.
// stops: [position, L, C, h] in Oklab
const COOL = [
  [0.0, 0.3, 0.075, 195],
  [0.3, 0.42, 0.1, 228],
  [0.6, 0.52, 0.13, 270],
  [0.85, 0.6, 0.15, 315],
  [1.0, 0.68, 0.16, 345],
];
const WARM = [
  [0.0, 0.55, 0.14, 320],
  [0.3, 0.64, 0.19, 350],
  [0.6, 0.76, 0.16, 45],
  [0.85, 0.88, 0.1, 80],
  [1.0, 0.98, 0.03, 90],
];
const BROWN = 0.6; // lightness a warm hue is brought up to
const TN = 128, VN = 17, VH = 24; // density steps, vorticity steps, degrees of hue the vorticity moves
function ramp(stops, v, hueOff, out) {
  let j = 1;
  while (j < stops.length - 1 && v > stops[j][0]) j++;
  const A = stops[j - 1], B = stops[j], t = cl((v - A[0]) / (B[0] - A[0]), 0, 1);
  let L = A[1] + (B[1] - A[1]) * t;
  const aa = A[2] * cos((A[3] * PI) / 180), ab = A[2] * sin((A[3] * PI) / 180), ba = B[2] * cos((B[3] * PI) / 180), bb = B[2] * sin((B[3] * PI) / 180);
  const a = aa + (ba - aa) * t, b = ab + (bb - ab) * t;
  const h = (Math.atan2(b, a) * 180) / PI + hueOff;
  // a dark orange or olive is brown on the panel: lift those hues until they read as amber and gold
  let d = (((h - 62) % 360) + 540) % 360 - 180;
  d /= 40;
  if (L < BROWN) L += (BROWN - L) * exp(-d * d);
  okLin(L, sqrt(a * a + b * b), h, out);
}
function buildLut(S, hue) {
  const o = [0, 0, 0], H = hue * 360;
  for (let v = 0; v < VN; v++) {
    const dh = VH * (v / ((VN - 1) / 2) - 1);
    for (let i = 0; i < TN; i++) {
      ramp(COOL, i / (TN - 1), H + dh, o);
      const q = 3 * (v * TN + i);
      S.cool[q] = o[0];
      S.cool[q + 1] = o[1];
      S.cool[q + 2] = o[2];
    }
  }
  for (let i = 0; i < TN; i++) {
    ramp(WARM, i / (TN - 1), H, o);
    S.warm[3 * i] = o[0];
    S.warm[3 * i + 1] = o[1];
    S.warm[3 * i + 2] = o[2];
  }
  S.lutHue = hue;
}

const OPEN = [0, 2, 0, 0.06];
function start(params, k) {
  const S = newState(1);
  S.cool = new Float32Array(3 * TN * VN);
  S.warm = new Float32Array(3 * TN);
  S.lnr = new Float32Array(N);
  S.tmp = new Float32Array(N);
  S.mu = new Float32Array(N);
  S.u = new Float32Array(N);
  S.v = new Float32Array(N);
  S.m1 = 0;
  S.sd = 0;
  params.s = S;
  readKnobs(S, k);
  S.kf = S.kft;
  S.mt = S.mtt;
  S.A = ampOf(S.mt, S.kf);
  S.tcorr = tcorrOf(S.mt, S.kf);
  S.Ms = S.mt;
  seedField(S, S.kf, S.mt);
  buildLut(S, S.hue);
  // let the shocks form before the first frame
  for (let n = 0; n < 120; n++) advance(S, 0.2, S.kf, S.mt);
}
// the forcing amplitude that holds a Mach number at a forcing wave number (fits from the runs in the header; the controller does the rest)
const ampOf = (mach, kf) => 0.066 * mach * mach * pow(kf / 2.67, 0.6);
const tcorrOf = (mach, kf) => cl(64 / (kf * mach), 3, 25);
function readKnobs(S, k) {
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
  const f = 1 - exp(-h / 0.4), m0 = S.mt, k0 = S.kf;
  S.kf += (S.kft - S.kf) * f;
  S.mt += (S.mtt - S.mt) * f;
  S.tcorr = tcorrOf(S.mt, S.kf);
  if (S.mt !== m0) {
    // Mach is the gas speed over the sound speed: the knob scales the speed of what is already there and the forcing that keeps it
    const r = S.mt / m0, g = S.g;
    for (let i = 0; i < N; i++) {
      g.MX[i] *= r;
      g.MY[i] *= r;
    }
    S.A = cl(S.A * r * r * pow(S.kf / k0, 0.6), 0.01, 8);
    S.Ms *= r;
  }
  advance(S, h * S.rate, S.kf, S.mt);
  if (abs(S.hue - S.lutHue) > 0.002) buildLut(S, S.hue);
}

// box mean of half-width r on the torus, rows then columns
function blurBox(src, dst, tmp, r) {
  const w = 1 / (2 * r + 1);
  for (let y = 0; y < NY; y++) {
    const o = y * NX;
    let a = 0;
    for (let d = -r; d <= r; d++) a += src[o + (d & (NX - 1))];
    for (let x = 0; x < NX; x++) {
      tmp[o + x] = a * w;
      a += src[o + ((x + r + 1) & (NX - 1))] - src[o + ((x - r) & (NX - 1))];
    }
  }
  for (let x = 0; x < NX; x++) {
    let a = 0;
    for (let d = -r; d <= r; d++) a += tmp[(((d + NY) % NY) * NX) + x];
    for (let y = 0; y < NY; y++) {
      dst[y * NX + x] = a * w;
      a += tmp[((y + r + 1) % NY) * NX + x] - tmp[((y - r + NY) % NY) * NX + x];
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const g = S.g, R = g.R, MX = g.MX, MY = g.MY, L = S.lnr, u = S.u, v = S.v, cool = S.cool, warm = S.warm, mu = S.mu;
  let m1 = 0, m2 = 0;
  for (let k = 0; k < N; k++) {
    const l = log(R[k]), ir = 1 / R[k];
    L[k] = l;
    u[k] = MX[k] * ir;
    v[k] = MY[k] * ir;
    m1 += l;
    m2 += l * l;
  }
  m1 /= N;
  const sd = sqrt(max(0.05, m2 / N - m1 * m1));
  if (!S.sd) {
    S.m1 = m1;
    S.sd = sd;
  } else {
    S.m1 += (m1 - S.m1) * 0.1;
    S.sd += (sd - S.sd) * 0.1;
  }
  blurBox(L, mu, S.tmp, 6);
  const isd = 0.9 / S.sd, m0 = 0.5 * S.m1, vk = 5 / S.mt;
  for (let y = 0; y < NY; y++) {
    const y0 = y * NX, ym = ((y + NY - 1) % NY) * NX, yp = ((y + 1) % NY) * NX;
    for (let x = 0; x < NX; x++) {
      const k = y0 + x, xm = y0 + ((x + NX - 1) & MX_), xp = y0 + ((x + 1) & MX_);
      const gx = 0.5 * (L[xp] - L[xm]), gy = 0.5 * (L[yp + x] - L[ym + x]);
      const dux = 0.5 * (u[xp] - u[xm]), dvy = 0.5 * (v[yp + x] - v[ym + x]);
      const omg = 0.5 * (v[xp] - v[xm]) - 0.5 * (u[yp + x] - u[ym + x]);
      const t = 0.5 + 0.5 * Math.tanh((L[k] - 0.5 * mu[k] - m0) * isd);
      const sch = sqrt(gx * gx + gy * gy), comp = -(dux + dvy);
      let q = max(sm(0.3, 1.15, sch), sm(0.3, 0.95, comp) * (0.35 + 0.65 * t)) * (0.4 + 0.6 * t);
      const vi = ((0.5 + 0.5 * Math.tanh(omg * vk)) * (VN - 1) + 0.5) | 0;
      const ci = 3 * (vi * TN + ((t * (TN - 1) + 0.5) | 0));
      let r = cool[ci], gg = cool[ci + 1], b = cool[ci + 2];
      if (q > 0.01) {
        const wi = 3 * ((q * (TN - 1) + 0.5) | 0), m = sm(0, 0.3, q);
        r += (warm[wi] - r) * m;
        gg += (warm[wi + 1] - gg) * m;
        b += (warm[wi + 2] - b) * m;
      }
      const e = exp(0.25 * Math.tanh(-1.5 * 0.7071 * (gx + gy)));
      display.setPixel(x, y, gam(r * e), gam(gg * e), gam(b * e));
    }
  }
}
