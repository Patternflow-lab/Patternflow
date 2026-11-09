// ===== Patternflow pattern =====
// Title:   Inertial Dust
// Family:  particle
// Idea:    Eighty thousand grains of dust heavier than the air they float in are thrown about by forced two-dimensional turbulence solved on the panel's own 64 by 128 torus and drawn as a density, so the grains are flung out of the vortices into round voids, pile up along the strain between them in thin bright filaments, and where streams of grains with different velocities cross they fold into sharp caustic lines that keep breaking and re-forming as the flow turns over.
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: preferential concentration of inertial particles in turbulence (Martin Maxey, 1987; Kyle Squires and John Eaton, 1991), the sling effect and caustics of their velocity field (Gregory Falkovich, Alexander Fouxon and Michael Stepanov, 2002; Michael Wilkinson and Bernhard Mehlig, 2005), the Okubo-Weiss criterion for strain against rotation (Akira Okubo, 1970; John Weiss, 1991), the carrier flow forced two-dimensional turbulence with an inverse energy cascade (Robert Kraichnan, 1967) solved pseudo-spectrally with the FFT, two-thirds rule and Adams-Bashforth step of Inverse Cascade, an Ornstein-Uhlenbeck force (1930), Oklab (Bjorn Ottosson, 2020); every name and year here is from memory
// Round:   120
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.6..4, Scale=-1..1, Stokes=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the Oklab hue of every stop of both ramps, so one turn comes back. At 0 the dust runs from deep indigo at the thin halos through blue and azure to ice, and the densest caustic cores go pale gold; the voids glow faint indigo where the flow turns anticlockwise on the panel and plum where it turns clockwise. At 0.25 magenta to mint on dark red, at 0.5 orange with pale pink cores on olive (the dark haze reads brown there), at 0.75 green to lemon on teal.
// Knob 2: Flow. How fast the flow turns over. Model time runs 0.4 times Flow times kf over 6 units per panel second, kf being the forcing wavenumber that Scale sets, so the speed in LEDs does not follow Scale. At Scale 0 and Flow 2 one turnover (1 over the rms vorticity) takes 1.2 s and the rms speed is 2.7 LEDs a second (median 2.3, one in a hundred above 5.8, the fastest in 90 s of samples 8.5); at 0.6 that is 3.9 s and 0.8 LEDs a second, at 4 it is 0.6 s and 5.4. Flow only sets the step length, and Stokes is measured in turnovers, so it never changes how clustered the dust is.
// Knob 3: Scale. The wavenumber of the force, kf = 6 times 2 to the minus half the knob: 8.5 at -1 (a wavelength of 7.5 LEDs), 6 at 0 (10.7), 4.2 at 1 (15). The eddies that hold the energy are larger, 64 over the energy-weighted mean wavenumber 3.5, 2.5 and 1.8 of the running flow: 18, 26 and 35 LEDs in wavelength, so a vortex is about 9, 13 and 17 LEDs across. The rms speed stays 2.5, 2.7 and 2.9 LEDs a second at Flow 2. Turning it by more than 0.17 starts a fresh flow at the new scale, run 8 time units at four steps a frame (1.3 to 1.9 s) while the grains keep their places; smaller turns only slide the force.
// Knob 4: Stokes. The Stokes number St = tau times the rms vorticity, 0.9 times 4.5 to the knob: 0.2 at -1, 0.99 at the opening 0.06, 4.0 at 1. At 0.2 the dust is an almost even cloud with thin filaments and the vortices show as faint coloured discs; near 1 the clustering is at its strongest, a web of filaments round voids 5 to 15 LEDs across; at 4 the grains are too heavy to follow the flow and the web smears into smoke with soft edges.

// What the field is. A flow and 81,920 grains in it, on one torus 2 pi wide and 4 pi tall with a grid step of 2 pi / 64 either way (one point to an LED).
//
// The flow is two-dimensional incompressible turbulence in vorticity form,
//   dw/dt + u.grad w = f - mu w - nu (k / 21)^8 w,   u = (-psi_y, psi_x),   w = lap psi,
// solved in Fourier space on the 3,655 modes with kx and ky at most 21 (Orszag's two-thirds rule). One inverse transform brings u and v back from
// w^ (u^ = i ky w^ / k^2, v^ = -i kx w^ / k^2), a second brings w, a forward transform takes u w and v w, and the step is third-order
// Adams-Bashforth with the decay folded in exactly and a step length that may change from frame to frame, all as in Inverse Cascade. mu = 0.01
// holds the large scales, nu is 12 at k = 21. The force f is a bump of width 0.2 kf round |k| = kf whose modes are complex Ornstein-Uhlenbeck
// processes of correlation time 0.3, rms 0.42, so the flow never repeats and settles to a steady level. Time is in units of about one turnover:
// the rms vorticity is 1.06 at Scale 0 and 0.93 and 1.15 at -1 and 1.
//
// A grain obeys dv/dt = (u(x, t) - v) / tau and dx/dt = v. u is bilinear in the four grid points round the grain, v is relaxed exactly over a
// step (v += (u - v)(1 - exp(-h / tau))), x takes an Euler step and wraps. Grains are never made or lost, so the picture cannot thin out. tau is
// St over the rms vorticity as it is measured on the grid (a running mean with a time constant of 3), which is why Flow cannot change St. It is
// drawn as cloud in cell: each grain adds to the four LEDs nearest it, rho is that sum over its mean of 10, and the brightness is
// (1 - exp(-rho / 2.5))^1.2. Colour is a table of brightness against the sign of w. The voids get a faint glow where Okubo-Weiss W =
// s_n^2 + s_s^2 - w^2 is negative (rotation beats strain, 26 per cent of the panel), stronger at small St where the dust is even and the vortices
// are what there is to see.
//
// Checks, each run on this file (a unit is one flow time unit, an LED cell is the CIC density at one LED):
// 1. div u. The spectral divergence of the grid velocity over |k u^| is 1.8e-15 in double precision and 1.3e-7 in the single precision copy the
//    grains read. A central difference on the LED grid gives 1.7e-2 of the rms gradient, which is the stencil and not the flow.
// 2. Energy. 900 units at Scale -1, 0 and 1: mean energy 0.0225, 0.0577 and 0.1256, no drift, block means within 6 per cent. Injection (the force the
//    step used against w) is 6.83e-4, 1.357e-3 and 2.672e-3; friction 2 mu E plus hyperviscosity is 6.85e-4, 1.352e-3 and 2.684e-3. 0.4 per cent.
// 3. Spectrum. E(k) goes as k^-1.3 over k 2 to 4 and k^-1.8 over 3 to 5 (Kraichnan: -5/3), then falls as k^-6 over 9 to 15 and k^-8 over 10 to
//    18, which is the hyperviscous range and not the -3 of the enstrophy cascade: there is only about one octave between kf and the cut.
// 4. Even dust. At St 0.002 the variance of the LED-cell density over its mean squared is 0.077, against 0.0445 for 81,920 grains placed at random
//    (Poisson alone would be 0.100, the cloud-in-cell kernel takes it down). The 0.032 left over is the Euler position step: it compresses
//    like a Stokes number of h w / 2 = 0.015 (an 80-unit run with 65,536 grains: 0.024 above the floor at this step, 0.006 at a quarter of it).
// 5. Variance against St, 150 units, 15 values: 0.077 (0.002), 0.081 (0.01), 0.196 (0.05), 0.381 (0.1), 0.831 (0.2), 1.65 (0.35), 2.62 (0.5),
//    3.83 (0.75), 4.11 (1), 3.78 (1.5), 3.05 (2), 1.93 (3), 1.08 (5), 0.51 (10), 0.17 (30). It rises from the floor, peaks at St 1 to 1.5 in
//    turnovers (4 by 4 LED boxes peak at 1.5) and falls back towards it as the grains turn ballistic, 0.17 against 0.0445 at 30. Densest cell:
//    2.1 times the mean at 0.002, 7.4 at 0.2, 32 at 1, 3.1 at 30.
// 6. Small tau. div v = -tau d_i u_j d_j u_i = -(tau / 2) W = tau (Omega_ij Omega_ij - S_ij S_ij): grains pile where strain beats rotation. The
//    identity div((u.grad)u) = d_i u_j d_j u_i holds to 3e-16 on a snapshot cut at k 10 (so the products fit the grid). Frozen flow, grains
//    relaxed for 12 tau: (u - v) / tau against (u.grad)u of the bilinear field is off by a median 2.6 per cent at St 0.005, 3.6 at 0.02, 7.4 at
//    0.05 and 28 at 0.2 (the next term in tau); against the spectral field the bilinear interpolation of 64 by 128 points leaves 11 to 13 per cent.
// 7. Voids. Pearson correlation of rho and W, with W from central differences, averaged over 122 samples: 0.38 (St 0.05), 0.34 (0.1), 0.27 (0.2),
//    0.17 (0.5), 0.13 (1), 0.12 (2). Mean rho where W < -0.2 sd (the cores, 26 per cent of the area): 0.74, 0.64, 0.54, 0.47, 0.50, 0.61; where
//    W > 0.2 sd (strain, 41 per cent): 1.10, 1.14, 1.18, 1.21, 1.19, 1.13. Vortex cores are the voids and the strain holds the dust.
// 8. Frame cost in Node, runs alone of 120 s: 4.7 ms at the opening, 5.0 at all knobs at minimum, 6.1 to 6.6 at Flow 3.4 and over. A flow step takes
//    1.0 to 1.5 ms, the grains 0.9 to 1.5 and the draw 1.3. The first frame spins the flow up for 10 units and the dust for 5 (0.6 s, once).
//
// Weak spots. The carrier is a weakly turbulent field (kurtosis of w 3.2 to 4.6) and not a developed cascade (check 3). A caustic is thinner than
// an LED, so the lines show as a one-LED blur and the densest cell stops at about 30 times the mean. The Euler step puts a floor under the tracer
// end that a midpoint step would remove (check 4) and the grains see a bilinear flow (check 6). A velocity-slip |u - v| tint was tried for the hue
// and dropped: its correlation with log rho was -0.03 and it showed patches, not caustics. Turning Scale restarts the flow at the new size.

const W = 64, H = 128, N = W * H;
const { floor, min, max, exp, sqrt, abs, cos, sin, PI, log, log2, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The panel is a periodic box 2 pi wide and 4 pi tall, one grid step 2 pi / 64 either way.
const KXC = 21, KYC = 42, DX = (2 * PI) / W;
const CFL = 0.5;
const KF0 = 6, BW = 0.2, TF = 0.3, FRMS = 0.42, MU = 0.01, NU = 12;
const NP = 81920;
const RHO0 = 2.5, GM = 1.2, HZ = 0.12, RATE = 0.4, ST0 = 0.9, STR = 4.5, PRE = 10, SEEDK = 2, SEEDW = 1, SPIN = 8, SPINK = 0.06;

// ---- radix-2 FFT, in place on (re, im) at off, off + st, off + 2 st, ...
function plan(n) {
  const lg = log2(n), rev = new Uint16Array(n), c = new Float64Array(n >> 1), s = new Float64Array(n >> 1);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) r |= ((i >> b) & 1) << (lg - 1 - b);
    rev[i] = r;
  }
  for (let i = 0; i < n >> 1; i++) (c[i] = cos((2 * PI * i) / n)), (s[i] = sin((2 * PI * i) / n));
  return { n, rev, c, s, br: new Float64Array(n), bi: new Float64Array(n) };
}
function fft1(P, re, im, off, st, sign) {
  const { n, rev, c, s, br, bi } = P;
  for (let i = 0; i < n; i++) {
    const j = off + rev[i] * st;
    br[i] = re[j];
    bi[i] = im[j];
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let a0 = 0; a0 < n; a0 += size)
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const wr = c[t], wi = sign * s[t], a = a0 + k, b = a + half;
        const xr = br[b] * wr - bi[b] * wi, xi = br[b] * wi + bi[b] * wr;
        br[b] = br[a] - xr;
        bi[b] = bi[a] - xi;
        br[a] += xr;
        bi[a] += xi;
      }
  }
  for (let i = 0; i < n; i++) (re[off + i * st] = br[i]), (im[off + i * st] = bi[i]);
}
const COLS = [];
for (let x = 0; x < W; x++) if ((x < W / 2 ? x : W - x) <= KXC) COLS.push(x);
function fft2(S, re, im, sign) {
  if (sign < 0) for (let y = 0; y < H; y++) fft1(S.px, re, im, y * W, 1, sign);
  for (let t = 0; t < COLS.length; t++) fft1(S.py, re, im, COLS[t], W, sign);
  if (sign > 0) for (let y = 0; y < H; y++) fft1(S.px, re, im, y * W, 1, sign);
}

// Standard normal pair
function gauss2(out) {
  const r = sqrt(-2 * log(1 - Math.random())), a = 2 * PI * Math.random();
  out[0] = r * cos(a);
  out[1] = r * sin(a);
}

// ---- the carrier flow
// dw/dt = -div(u w) - MU w - NU (k/21)^8 w + f, u = (-psi_y, psi_x), w = lap psi
function tendency(S, sr, si, or, oi) {
  const { kx, ky, ik2, keep, neg, ar, ai, br, bi, gu, gv } = S, nk = keep.length;
  ar.fill(0);
  ai.fill(0);
  br.fill(0);
  bi.fill(0);
  for (let t = 0; t < nk; t++) {
    const i = keep[t], r = sr[i] / N, m = si[i] / N, q = ik2[i];
    ar[i] = (kx[i] * r - ky[i] * m) * q;
    ai[i] = (ky[i] * r + kx[i] * m) * q;
    br[i] = r;
    bi[i] = m;
  }
  fft2(S, ar, ai, 1);
  fft2(S, br, bi, 1);
  let vmax = 0, wsum = 0;
  const gs = 1 / DX;
  for (let i = 0; i < N; i++) {
    const u = ar[i], v = ai[i], w = br[i];
    gu[i] = u * gs;
    gv[i] = v * gs;
    const sp = abs(u) + abs(v);
    if (sp > vmax) vmax = sp;
    wsum += w * w;
    ar[i] = u * w;
    ai[i] = v * w;
  }
  S.wrms = sqrt(wsum / N);
  fft2(S, ar, ai, -1);
  for (let t = 0; t < nk; t++) {
    const i = keep[t], j = neg[i], cr = ar[i], ci = ai[i], dr = ar[j], di = ai[j], a = kx[i], b = ky[i];
    or[i] = 0.5 * (a * (ci - di) - b * (cr - dr));
    oi[i] = -0.5 * (a * (cr + dr) + b * (ci + di));
  }
  return vmax;
}

// Forcing: a unit complex Ornstein-Uhlenbeck amplitude zeta (fr, fi) on every mode between kappa 2.4
// and 12.5 that has a conjugate partner, and the force is N gc zeta, where gc is a bump about kf.
function forceStep(S, h) {
  const { fr, fi, fl, neg } = S, a = exp(-h / TF), b = sqrt(1 - a * a), g = [0, 0];
  for (let t = 0; t < fl.length; t++) {
    const i = fl[t], j = neg[i];
    gauss2(g);
    fr[i] = a * fr[i] + b * g[0];
    fi[i] = a * fi[i] + b * g[1];
    fr[j] = fr[i];
    fi[j] = -fi[i];
  }
}

// gc = c exp(-((|k| - kf) / (BW kf))^2), scaled so the forcing's grid variance is FRMS^2
function forceBand(S) {
  const { kk, keep, neg, gc, fl } = S, kf = S.kf;
  let z = 0;
  gc.fill(0);
  for (let t = 0; t < keep.length; t++) {
    const i = keep[t], q = (kk[i] - kf) / (BW * kf), g = exp(-q * q);
    if (g > 0.01) gc[i] = g;
  }
  for (let t = 0; t < fl.length; t++) z += gc[fl[t]] * gc[fl[t]];
  const c = (N * FRMS) / (2 * sqrt(z));
  for (let t = 0; t < keep.length; t++) gc[keep[t]] *= c;
}

function step(S, h) {
  const { wr, wi, nr, ni, p1r, p1i, p2r, p2i, lin, keep, fr, fi, gc } = S;
  forceStep(S, h);
  S.vmax = tendency(S, wr, wi, nr, ni);
  const nk = keep.length;
  const h1 = S.h1, h2 = S.h2;
  let c0 = h, c1 = 0, c2 = 0;
  if (h1 && h2) {
    const a = (h * h * h) / 3, b = (h * h) / 2;
    c0 = (a + (2 * h1 + h2) * b + h1 * (h1 + h2) * h) / (h1 * (h1 + h2));
    c1 = -(a + (h1 + h2) * b) / (h1 * h2);
    c2 = (a + h1 * b) / ((h1 + h2) * h2);
  } else if (h1) (c0 = h * (1 + h / (2 * h1))), (c1 = -(h * h) / (2 * h1));
  for (let t = 0; t < nk; t++) {
    const i = keep[t], e = exp(-h * lin[i]);
    const tr = nr[i] + gc[i] * fr[i], ti = ni[i] + gc[i] * fi[i];
    wr[i] = e * (wr[i] + c0 * tr + c1 * p1r[i] + c2 * p2r[i]);
    wi[i] = e * (wi[i] + c0 * ti + c1 * p1i[i] + c2 * p2i[i]);
    p2r[i] = e * p1r[i];
    p2i[i] = e * p1i[i];
    p1r[i] = e * tr;
    p1i[i] = e * ti;
  }
  S.h2 = h1;
  S.h1 = h;
}

// ---- the grains
function grains(S, h) {
  const { gx, gy, hx, hy, gu, gv } = S;
  const a = 1 - exp(-h / S.tau);
  for (let i = 0; i < NP; i++) {
    let x = gx[i], y = gy[i];
    const i0 = x | 0, j0 = y | 0, fx = x - i0, fy = y - j0, i1 = (i0 + 1) & (W - 1), j1 = (j0 + 1) & (H - 1);
    const a00 = j0 * W + i0, a10 = j0 * W + i1, a01 = j1 * W + i0, a11 = j1 * W + i1;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    const ux = gu[a00] * w00 + gu[a10] * w10 + gu[a01] * w01 + gu[a11] * w11;
    const uy = gv[a00] * w00 + gv[a10] * w10 + gv[a01] * w01 + gv[a11] * w11;
    let vx = hx[i], vy = hy[i];
    const dx = ux - vx, dy = uy - vy;
    vx += dx * a;
    vy += dy * a;
    hx[i] = vx;
    hy[i] = vy;
    x += vx * h;
    y += vy * h;
    if (x < 0) x += W;
    else if (x >= W) x -= W;
    if (y < 0) y += H;
    else if (y >= H) y -= H;
    gx[i] = x;
    gy[i] = y;
  }
}

function seed(S) {
  const { wr, wi, k2, mask } = S, k0 = S.kf / SEEDK;
  for (let i = 0; i < N; i++) (wr[i] = Math.random() * 2 - 1), (wi[i] = 0);
  fft2(S, wr, wi, -1);
  let z = 0;
  for (let i = 0; i < N; i++) {
    const q = k2[i] / (k0 * k0), a = mask[i] && k2[i] > 0 ? q * exp(-q) : 0;
    wr[i] *= a;
    wi[i] *= a;
    z += wr[i] * wr[i] + wi[i] * wi[i];
  }
  const g = (SEEDW * N) / sqrt(z);
  for (let i = 0; i < N; i++) (wr[i] *= g), (wi[i] *= g);
  S.h1 = S.h2 = 0;
  const gg = [0, 0], { fl, neg, fr, fi } = S;
  for (let t = 0; t < fl.length; t++) {
    const i = fl[t], j = neg[i];
    gauss2(gg);
    fr[i] = fr[j] = gg[0];
    fi[i] = gg[1];
    fi[j] = -gg[1];
  }
  forceBand(S);
}

export function setup(params) {
  const F = () => new Float64Array(N);
  const S = (params.s = {
    kf: KF0, tau: 1, h1: 0, h2: 0, vmax: 1, vs: 1, wrms: 1, om: 1, ready: 0,
    px: plan(W), py: plan(H),
    kx: F(), ky: F(), k2: F(), kk: F(), ik2: F(), lin: F(), mask: new Uint8Array(N), neg: new Int32Array(N),
    wr: F(), wi: F(), nr: F(), ni: F(), p1r: F(), p1i: F(), p2r: F(), p2i: F(), ar: F(), ai: F(), br: F(), bi: F(), fr: F(), fi: F(), gc: F(), spin: 0, ks: 0,
    gu: new Float32Array(N), gv: new Float32Array(N),
    gx: new Float64Array(NP), gy: new Float64Array(NP), hx: new Float32Array(NP), hy: new Float32Array(NP),
    D: new Float32Array(N),
  });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, jx = x < W / 2 ? x : x - W, jy = y < H / 2 ? y : y - H;
      S.kx[i] = jx;
      S.ky[i] = jy / 2;
      S.k2[i] = jx * jx + (jy * jy) / 4;
      S.kk[i] = sqrt(S.k2[i]);
      S.ik2[i] = S.k2[i] > 0 ? 1 / S.k2[i] : 0;
      S.mask[i] = abs(jx) <= KXC && abs(jy) <= KYC ? 1 : 0;
      S.neg[i] = ((H - y) % H) * W + ((W - x) % W);
      const q = S.k2[i] / (KXC * KXC);
      S.lin[i] = MU + NU * q * q * q * q;
    }
  const keep = [];
  for (let i = 0; i < N; i++) if (S.mask[i]) keep.push(i);
  S.keep = Int32Array.from(keep);
  const fl = [];
  for (const i of keep) if (S.kk[i] >= 2.4 && S.kk[i] <= 12.5 && S.neg[i] > i) fl.push(i);
  S.fl = Int32Array.from(fl);
}

function wrmsSpec(S) {
  const { wr, wi, keep } = S;
  let z = 0;
  for (let t = 0; t < keep.length; t++) z += wr[keep[t]] ** 2 + wi[keep[t]] ** 2;
  return sqrt(z) / N;
}

// A fresh flow at the knob's scale, then the grains in it: the flow alone for PRE model time units at the largest step
// the speed limit allows, then uniform grains starting at the flow's own velocity for 3 + 2 St more, long enough for
// the filaments to form.
function spinUp(S) {
  S.ks = S.kf;
  S.spin = 0;
  S.om = 1;
  seed(S);
  const hs = () => min(0.1, (CFL * DX) / max(1e-6, S.vmax));
  for (let t = 0, n = 0; t < PRE && n < 4000; n++) {
    const h = hs();
    step(S, h);
    S.om += (wrmsSpec(S) - S.om) * min(1, h / 3);
    t += h;
  }
  for (let i = 0; i < NP; i++) {
    const x = Math.random() * W, y = Math.random() * H, o = (y | 0) * W + (x | 0);
    S.gx[i] = x;
    S.gy[i] = y;
    S.hx[i] = S.gu[o];
    S.hy[i] = S.gv[o];
  }
  for (let t = 0, n = 0; t < 3 + 2 * S.stokes && n < 4000; n++) {
    const h = hs();
    step(S, h);
    S.om += (wrmsSpec(S) - S.om) * min(1, h / 3);
    S.tau = S.stokes / S.om;
    grains(S, h);
    t += h;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.6, 4);
  S.scale = cl(k[2], -1, 1);
  S.stokes = ST0 * pow(STR, cl(k[3], -1, 1));
  const kf = KF0 * pow(2, -0.5 * S.scale);
  // a flow that has gone out of range (it has not, in any run) starts over
  if (!S.ready || !(S.wrms < 20 && S.om < 20)) {
    S.ready = 1;
    S.kf = kf;
    spinUp(S);
  }
  const ft = cl(dt || 0, 0, 0.1);
  if (abs(log(kf / S.ks)) > SPINK && S.spin <= 0) {
    // a new scale: a fresh field at it, spun up four steps a frame so the new eddies are there in about 1.5 seconds
    S.kf = S.ks = kf;
    seed(S);
    S.spin = SPIN;
  } else if (kf !== S.kf) {
    S.kf = kf;
    forceBand(S);
  }
  let adv = ft * RATE * S.speed * (kf / KF0);
  if (adv <= 0) return;
  const hmax = (CFL * DX) / max(1e-6, S.vmax);
  let n = min(3, Math.ceil(adv / hmax)), h = adv / n;
  if (S.spin > 0) (n = 4), (h = min(0.1, hmax)), (adv = n * h), (S.spin -= adv);
  // The grains move once a frame, however many steps the flow took, in the velocity of the last of them.
  for (let j = 0; j < n; j++) {
    step(S, h);
    S.om += (wrmsSpec(S) - S.om) * min(1, h / 3);
    if (S.spin > 0) (S.tau = S.stokes / S.om), grains(S, h);
  }
  if (S.spin <= 0) (S.tau = S.stokes / S.om), grains(S, adv);
}

// ---- colour: two ramps in Oklab, one for the strain side and one for the rotation side
const RGB = [0, 0, 0];
function lin(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  RGB[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  RGB[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  RGB[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const inside = (e) => RGB[0] > -e && RGB[0] < 1 + e && RGB[1] > -e && RGB[1] < 1 + e && RGB[2] > -e && RGB[2] < 1 + e;
function okLab(L, a0, b0) {
  for (let i = 0; i <= 20; i++) {
    lin(L, a0 * (1 - i / 20), b0 * (1 - i / 20));
    if (i === 20 || inside(0.002)) return;
  }
}
const enc = (v) => ((((v = cl(v, 0, 1)) <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055) * 255 + 0.5) | 0);
// stops [v, L, C, hue degrees]
const RA = [[0, 0.14, 0.06, 272], [0.2, 0.34, 0.14, 268], [0.45, 0.6, 0.14, 240], [0.7, 0.84, 0.09, 205], [0.88, 0.93, 0.07, 95], [1, 0.99, 0.03, 100]];
const RB = [[0, 0.14, 0.06, 335], [0.2, 0.34, 0.14, 325], [0.45, 0.6, 0.14, 250], [0.7, 0.84, 0.09, 205], [0.88, 0.93, 0.07, 95], [1, 0.99, 0.03, 100]];
const NB = 128, NT = 17, LUT = new Uint8Array(NB * NT * 3);
// the largest chroma sRGB holds at lightness L and hue h (radians), by bisection
function cmax(L, h) {
  let lo = 0, hi = 0.4;
  for (let i = 0; i < 12; i++) {
    const c = 0.5 * (lo + hi);
    lin(L, c * cos(h), c * sin(h));
    if (inside(0)) lo = c;
    else hi = c;
  }
  return lo;
}
// the stops as [v, L, a, b] with Hue added to every hue; a dark stop whose hue cannot hold its chroma (a dark yellow
// reads as olive or brown on the panel) is lifted in lightness, by 0.1 at most, until it holds 80 per cent of it
function stops(st, hue) {
  return st.map(([v, L0, C, h0]) => {
    const h = ((h0 + hue) * PI) / 180;
    let L = L0;
    while (L < L0 + 0.1 && cmax(L, h) < 0.8 * C) L += 0.015;
    return [v, L, C * cos(h), C * sin(h)];
  });
}
function ramp(st, v, o) {
  let j = 1;
  while (j < st.length - 1 && v > st[j][0]) j++;
  const A = st[j - 1], B = st[j], t = cl((v - A[0]) / (B[0] - A[0]), 0, 1);
  o[0] = A[1] + (B[1] - A[1]) * t;
  o[1] = A[2] + (B[2] - A[2]) * t;
  o[2] = A[3] + (B[3] - A[3]) * t;
}
const PA = [0, 0, 0], PB = [0, 0, 0];
function buildLut(hue) {
  const sa = stops(RA, hue * 360), sb = stops(RB, hue * 360);
  for (let i = 0; i < NB; i++) {
    const v = i / (NB - 1);
    ramp(sa, v, PA);
    ramp(sb, v, PB);
    for (let k = 0; k < NT; k++) {
      const m = k / (NT - 1);
      okLab(PA[0] + (PB[0] - PA[0]) * m, PA[1] + (PB[1] - PA[1]) * m, PA[2] + (PB[2] - PA[2]) * m);
      const o = (i * NT + k) * 3;
      LUT[o] = enc(RGB[0]);
      LUT[o + 1] = enc(RGB[1]);
      LUT[o + 2] = enc(RGB[2]);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.lutHue !== S.hue) (S.lutHue = S.hue), buildLut(S.hue);
  const { gx, gy, D, gu, gv } = S;
  D.fill(0);
  for (let i = 0; i < NP; i++) {
    const x = gx[i], y = gy[i], i0 = x | 0, j0 = y | 0, fx = x - i0, fy = y - j0, i1 = (i0 + 1) & (W - 1), j1 = (j0 + 1) & (H - 1);
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    const a00 = j0 * W + i0, a10 = j0 * W + i1, a01 = j1 * W + i0, a11 = j1 * W + i1;
    D[a00] += w00;
    D[a10] += w10;
    D[a01] += w01;
    D[a11] += w11;
  }
  const mean = NP / N, om2 = S.om * S.om, hz = HZ + 0.4 * exp(-(S.stokes * S.stokes) / 0.12);
  for (let y = 0; y < H; y++) {
    const u1 = ((y + 1) & (H - 1)) * W, d1 = ((y - 1) & (H - 1)) * W, o = y * W;
    for (let x = 0; x < W; x++) {
      const i = o + x, r1 = (x + 1) & (W - 1), l1 = (x - 1) & (W - 1);
      const rho = D[i] / mean;
      // Okubo-Weiss: W = s_n^2 + s_s^2 - w^2 from the grid velocity (cells per model time)
      const ux = 0.5 * (gu[o + r1] - gu[o + l1]), vx = 0.5 * (gv[o + r1] - gv[o + l1]), uy = 0.5 * (gu[u1 + x] - gu[d1 + x]), vy = 0.5 * (gv[u1 + x] - gv[d1 + x]);
      const sn = ux - vy, ss = vx + uy, wz = vx - uy, OW = (sn * sn + ss * ss - wz * wz) / om2;
      let a = pow(1 - exp(-rho / RHO0), GM);
      const t = 0.5 + 0.5 * Math.tanh(wz / (0.7 * sqrt(om2)));
      a += (1 - a) * hz * cl(-OW / 1.5, 0, 1);
      const j = ((a * (NB - 1) + 0.5) | 0) * NT * 3 + ((t * (NT - 1) + 0.5) | 0) * 3;
      display.setPixel(x, y, LUT[j], LUT[j + 1], LUT[j + 2]);
    }
  }
}
