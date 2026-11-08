// ===== Patternflow pattern =====
// Title:   Supersonic Turbulence
// Family:  sim
// Idea:    Gas moving at two and a half times the speed of sound on the panel's own 64 by 128 torus, stirred at large scale without a pause, so that its shocks cross and sweep it into a web of thin hot sheets round teal and violet voids, and the stirring rebuilds the web as fast as the shocks take it apart.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the isothermal Euler equations as the model of supersonic turbulence in gas clouds, driven in a periodic box (Stone, Ostriker and Gammie, 1998, and Mac Low and others, 1998, both from memory), with the log-normal density that such flows keep (Padoan and Nordlund, 2002, and Federrath and others, 2008, from memory); MUSCL reconstruction (Bram van Leer, 1979, from memory) with a Hancock half step and a monotonised central limiter; the HLL flux (Harten, Lax and van Leer, 1983) with Einfeldt's wave speeds (1988, from memory); solenoidal stirring as an Ornstein-Uhlenbeck process (Eswaran and Pope, 1988, from memory); colour mixed in OKLab (Bjorn Ottosson, 2020, from memory); pattern round 118
// Round:   118
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Mach=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the Oklab hue of both colour layers, so one turn comes back. At 0 the field runs from teal (hue 195, lightness 0.30) in the voids through blue and violet to magenta in the dense gas, and the shocks run from pink through orange and gold to white. The sign of the vorticity bends the field's hue by up to 24 degrees, so the eddies in the voids show. Warm hues are lifted to lightness 0.6 so that nothing dark goes brown.
// Knob 2: Flow. The model time that passes in a panel second, 1.3 times Flow: 0.65 time units at 0.5, 2.6 at the opening 2 and 5.2 at 4. A time unit is one LED travelled at the speed of sound. The gas moves at 1.7, 7.3 and 14.4 LEDs a second (rms, measured at Mach 2.5), and the solver takes 0.28, 1.08 and 2.17 sub-steps a frame. The Mach number and the statistics of the picture do not move with it (Mach 2.43, 2.51, 2.50).
// Knob 3: Scale. The wavelength of the stirring, 24 times 1.7 to the Scale LEDs: 14, 24 and 41, which is 4.5, 2.7 and 1.6 waves across the 64 LEDs. The density's autocorrelation falls to 1/e at 4.8, 6.8 and 9.8 LEDs, and 38, 25 and 15 per cent of the panel is steeper than 0.5 in ln rho per LED. The Mach number holds (2.49, 2.51, 2.52).
// Knob 4: Mach. The rms Mach number of the gas, 2.4 times 1.8 to the Mach: 1.33 at -1, 2.49 at the opening 0.06 and 4.32 at 1. Measured, mass weighted, they are 1.34, 2.51 and 4.35 (1.49, 2.80 and 4.63 by volume), and the variance of ln rho is 0.48, 1.41 and 2.91. At 1.3 the shocks are weak, the field is wavy and filled with soft lines (8 per cent of the panel steeper than 0.5 per LED); at 4.3 it is a sharp web round large voids (37 per cent). Turning it scales the gas that is already there and the stirring follows: stepping the knob from 0.06 to 1, the Mach number is within 12 per cent of the new value after 2 s and within 7 per cent after 4 s; stepping it from 1 to -1, within 5 per cent after 2 s.

// What the field is. Density rho and velocity (u, v) of an isothermal gas on a torus 64 LEDs wide and 128 tall, one cell to the LED, one length unit
// to the LED and the speed of sound c = 1, so the pressure is p = rho:
//   rho_t + div(rho u) = 0,    (rho u)_t + div(rho u u) + grad rho = rho f.
// The mean density is 1. The scheme is finite volume, MUSCL-Hancock along one axis at a time, the order of the two axes swapped every step. Per
// cell it takes slopes of (rho, u, w) with the monotonised central limiter (w is the velocity along the cell face), moves the cell's edge states
// half a step with the primitive equations, and gives each face the HLL flux with Einfeldt's speeds, taken from the Roe-average velocity. The
// momentum along the face is upwinded by the sign of the mass flux. A cell whose predicted edge density falls under 2e-4 drops to first order for
// that sweep. The step is 0.55 over (1 + the largest |u| or |v|); a frame runs as many as an accumulator holds (the part of a step that does not
// fit waits for the next frame, so the pace does not depend on the frame rate), at most 6, and the gas is capped at ten sound speeds. The density
// is floored at 2e-4, and what the floor adds is taken off again by scaling rho and the momenta alike, so the total stays 8192.
//
// The stirring f is the curl of a stream function that is a sum of plane waves of the torus, wave (nx, ny) with nx = 0 to 7 and ny = -14 to 14, so
// f is solenoidal by construction. The weight of a wave is a Gaussian of its wave number round kf = 64 / (24 * 1.7^Scale) waves across the panel,
// 0.5 wide, and the weights are normalised so that the rms of f is A. The two amplitudes of each wave are Ornstein-Uhlenbeck processes with
// correlation time the stirring wavelength over the Mach number, 3 to 25 time units, stepped exactly once a frame. The net momentum is taken off every step. A is the one
// thing that adapts: it is multiplied by exp(dt / 5 * (target / measured - 1)), the measured rms Mach number smoothed over 3 time units, clamped to
// 0.01..8, so that the Mach number is the knob and not a thing the knob hopes for. At 2.5 and 24 LEDs A is 0.40.
//
// The picture has two layers over the same cells. The first is the density, ln rho against its surroundings (the mean of a 13 by 13 box and the
// global mean, half and half, scaled by the standard deviation and passed through tanh), a teal to magenta ramp. The second is the shocks:
// the steepness of ln rho and the squeeze -div u, taken as the larger, weighted by the density, run through a pink to orange to white ramp and
// mixed over the first. A faint raking light from the upper left, on the slope of ln rho, gives the sheets their relief. The voids are never dark:
// they are the cool end of the ramp, lightness 0.30, and their relief comes from the exposure following the local density.
//
// What was checked, with the file's own sweep and step:
// - Riemann problems against the exact isothermal solution, at 0.55 Courant on 256 and 512 cells: a tube from rho 4 to 1 (a rarefaction and a shock),
//   a tube from 40 to 1, and two Mach 3 streams meeting (two shocks). The error in rho, relative to the density behind the shock, is 5.1e-3, 2.0e-2
//   and 9.8e-3 at 256 cells and exactly half of that at 512: first order at the jump, as the limiter makes it. The shock speed is 1.410 against the
//   exact 1.409 (4 to 1) and 2.421 against 2.377 (40 to 1); the slow shock of the meeting streams is within half a cell. Each shock is 2 cells
//   wide, measured as the jump over the steepest slope: 1.87, 2.10 and 2.15 cells. Mass is conserved to 9e-16.
// - Mass, momentum and positivity, 900 s of panel time through update(), at the opening knobs and with all knobs at their minimum and maximum
//   (2364, 609 and 4704 time units, 29189, 4793 and 85687 steps). The total mass stays 8192 to 7e-15, 8e-15 and 1.2e-14. The lowest density is
//   3.3e-4, 1.6e-2 and 2.0e-4, the highest 77, 14 and 176. The floor never fires at the opening and the minimum; at the maximum it fires in 1.1e-4
//   of the cell-steps and adds 3.4e-5 of the mass over the 900 s, which the scaling takes off again. 0.08 per cent of the cell sweeps fall to
//   first order at the maximum, 0.005 per cent at the opening. The guard that seeds the state again if it ever stops being a state never fired. The
//   net velocity taken off a step is 0.008, 0.002 and 0.022 sound speeds at most.
// - The Mach number and the density. Over 400 time units at the opening (a sample every 1.5 after 60), the mass-weighted Mach number is 2.51 against
//   the 2.49 asked, 2.80 by volume. ln rho has variance 1.40, skewness -0.16 and kurtosis 3.07, a Gaussian's 0 and 3, and the variance fits
//   ln(1 + b^2 M^2) with b = 0.70. Across Mach 1.34, 2.51 and 4.35 (the three Mach knob stops) b is 0.59, 0.70 and 0.96, higher than the
//   0.3 to 0.5 quoted for solenoidal stirring in three dimensions (from memory); a flat flow has no third axis to be squeezed along.
// - Stationary. Mean kinetic energy per cell over the four quarters of the 900 s, in units of the mean density times the sound speed squared: 3.148, 3.152, 3.142 and 3.139 at the opening;
//   9.725, 9.729, 9.703 and 9.748 at the maximum; 0.918, 0.905, 0.888 and 0.892 at the minimum, which is 2.8 per cent down from first to last. The
//   controller holds the Mach number, so the telling numbers are the forcing amplitude A it needs and the variance of ln rho: A is 0.396, 0.396,
//   0.403, 0.405 and the variance 1.43, 1.39, 1.44, 1.41 at the opening.
// - Resolution. The same stirring at the opening on 128 by 256 cells, two to the LED, 400 time units: Mach 2.50 against 2.51, ln rho
//   variance 1.28 against 1.40, and the same share of the panel, 24.3 per cent, steeper than 0.5 in ln rho per LED. The shocks are thinner:
//   the 99th percentile of that slope is 2.84 per LED against 1.72, the steepest 7.4 against 3.6, the mean square of div u is 0.72 against 0.37 and
//   of the curl 0.58 against 0.42. So the panel's grid costs the shocks a factor of 1.7 to 2 in thickness, which is two LEDs against
//   one, and leaves the Mach number and the shape of the density alone.
// - It cannot die. The velocity and density were wiped at 40 s (rho = 1, u = 0): the Mach number is back at 0.8 of its aim after 1.8 s and
//   holds 2.51 over the last 10 s of the next minute. The momenta times 6 (Mach 15, capped at 10): 0.2 s, peak 8.5, then 2.41. The density times
//   a random 0.2 to 5, and a hole of density 1e-3 over 20 by 40 LEDs: 0.2 s. With all knobs at the maximum, 0.7 s; at Scale -1 and Mach 1, 1.1 s.
//   The state was not reseeded in any of them.
// - Cost in Node, update and draw: 1.5 + 1.1 ms at the opening, 3.4 + 1.1 at the maximum, 0.7 + 1.1 at the minimum. The first frame takes 0.45 s, for
//   24 time units run before it, so that the shocks are there.

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
    xc: new Float64Array(nm), xs: new Float64Array(nm), w: new Float64Array(nm), lastSteps: 0, Mm: 0, resets: 0,
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
  // a state that is not a state any more is thrown away and seeded again; this has not fired in any run of the header
  if (!(g.mass > 0) || !(g.ek < 1e4)) {
    seedField(S, kf, mt);
    S.acc = 0;
    S.resets++;
    return;
  }
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
