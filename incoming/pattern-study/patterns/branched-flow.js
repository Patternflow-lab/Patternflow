// ===== Patternflow pattern =====
// Title:   Branched Flow
// Family:  particle
// Idea:    A cold beam of 35,000 rays is sent down through a smooth random landscape that drifts and breathes, and where the rays focus they pile into thin bright veins that fork, cross and sway down the panel, cyan where a vein leans left of the beam, magenta where it leans right and white where the two cross.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: branched flow, the way a cold stream of rays or particles in a smooth weak random potential stays in channels that fork where neighbouring paths focus, after a depth of about xi times s to the minus two thirds (Eric Heller and colleagues; Kaplan 2002; Metzger, Jacobsen and Heller 2010), seen in electrons leaving a quantum point contact (Topinka et al., Nature 2001), in tsunami focusing (Michael Berry 2007) and in microwave freak waves (Hohmann et al. 2010), all names and years from memory; the rays follow the eikonal equations of a medium of index 1 + V, leapfrogged on H = |p| - n(x), through a Gaussian random field summed from plane waves
// Round:   117
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=1..4, Scale=-1..1, Strength=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the hue of the whole ramp, and one turn comes back. At 0 a ray that leans left of the beam is cyan (0, 255, 255), a straight one lavender (206, 195, 246) and one that leans right magenta (255, 0, 255), and where the two meet the light adds up to white. At 0.25 the ends are magenta and amber with a pink middle, at 0.5 orange-red and green with a pale lime middle, at 0.75 lime and azure with an aqua middle. Every stop is drawn at one luma, so no hue is the dim one.
// Knob 2: Flow. The speed of the rays, v0, is 6 LEDs a second at Flow 1, 12 at 2 and 24 at 4, so a ray takes 27, 13.5 and 6.8 s to run the 162 LEDs from where the landscape begins, 32 above the panel, to its bottom edge. The landscape's drift, its waves' own frequencies and their breathing are scaled by the same factor, so Flow only plays the same picture faster or slower. The trail is 2.5 LEDs of path at every speed, so it lasts 0.42 s at Flow 1 and 0.10 s at Flow 4.
// Knob 3: Scale. The correlation length of the landscape, xi = 14 LEDs times 1.5 to the knob: 9.3, 14 and 21, a spectrum centred on 0.67, 0.45 and 0.30 radians per LED, with about 115, 80 and 50 of the 160 pooled waves carrying weight. The veins lie 10, 14 and 16 LEDs apart (twice the first minimum of the horizontal autocorrelation of the luma). At the opening strength the first rays cross 20, 28 and 39 LEDs into the landscape, which begins 32 above the panel, so at 9.3 and 14 the veins have forked before they reach the top edge and at 21 they fork 7 LEDs in. A vein is 3.7 LEDs wide across a row (median width at half height) at all three, because the splat, the blur and the trail set that, not xi.
// Knob 4: Strength. The rms of V, 0.032 times 1.6 to the knob: 0.020, 0.033 at the opening and 0.051. At xi = 14 the rays of a static field first cross 39, 28 and 22 LEDs into the landscape at s = 0.021, 0.035 and 0.054, so a stronger landscape forks earlier. The rms deflection of the rays from vertical, over six random landscapes between 20 and 60 s, is 0.06 rad in the top quarter of the panel and 0.10 in the bottom quarter at -1, 0.12 and 0.25 at the opening and 0.27 and 0.51 at 1. At -1 the veins run nearly straight and parallel; at the opening they fork and cross; at 1 the beam is hot before the top quarter ends and the picture is a web of fine cross-threads.

// What the field is. A beam of rays runs down a medium of index n = 1 + V(x, y, t), where V is a smooth Gaussian random field
// that never stops moving. A ray keeps the speed 1 and bends toward high n: dx/dl = p / |p|, dp/dl = grad V, the eikonal equations
// of geometrical optics, with H = |p| - n(x) the quantity the leapfrog keeps. A beam that starts cold, every ray heading down,
// does not diffuse. Where neighbouring rays are focused by the same bump of V they cross, and the crossings are the
// caustics, thin lines of high density that fork where the landscape's next bump bends them again: the veins. The panel shows
// the density of the rays at one moment, with a short trail. The sides wrap, and 35,000 rays run at 3.4 to the LED^2.
//
// The landscape. V is the sum of the active waves of a pool of 160 plane waves, cos(kx x + ky y + phase): |k| log-uniform
// between 0.3 and 2.0 radians per LED, the direction uniform in a half plane, kx rounded to a multiple of 2 pi / 64 so that the
// field wraps from the left edge to the right. The Scale knob sets the centre of a Gaussian in ln k, 0.3 wide, that weights the
// pool, and the amplitudes are scaled so that V has the variance s^2 (Strength). Each wave's phase runs at -w.k plus its own rate
// of up to 0.08 radians a second, where w is a drift of 0.6 LED a second on average (0.3 to 0.9) that wanders in direction on sines of
// 0.021 and 0.0077 radians a second, and each wave's amplitude swells and fades by 45 % at a rate of its own, 0.03 to 0.14 radians a
// second. The beam's direction also wanders, by 0.08 radians at most, on four sines. Every rate is a model-time rate, and no time is ever wrapped.
// The field is evaluated on a grid of 0.5 LED with the separable form cos(a + b) = cos a cos b - sin a sin b, so a node costs a
// multiply-add per wave and no trigonometry: 129 by 329 nodes, a snapshot every 10 frames, nine frames of rows and one of central
// differences, then a linear blend of two snapshots every frame. The force on a ray is the bilinear value of the blend.
//
// Two things the first versions needed. First, the landscape fades in over 14 LEDs (smoothstep), above the panel. Switched on at
// the edge of the beam it leaves each ray with a tilt of a kx / ky that depends on where along its wave the ray started, which is
// a phase screen: the beam broke into long straight columns and never into branches. Second, the waves with k nearly across the
// beam, ky small, lens it as (kx / ky)^2, and one of them among the 80 or so that are active could set the whole picture: at weak
// strength the beam became a grating of evenly spaced columns in some random landscapes. Leaving a gap in the pool around ky = 0
// (|ky| >= 0.3 |k|) made the grating take the gap's edge, and cooled the beam too far (rms heading 0.08 against 0.55 after 130
// LEDs at s = 0.05, xi = 8). The pool is isotropic again, and the weak end shows the grating when the landscape has such a wave.
//
// The beam. Rays enter 32 LEDs above the panel, at a constant rate of 3.4 * 64 * h per step, at positions of a low-discrepancy
// sequence (the R2 sequence of Martin Roberts, 2018, from memory) with a jitter of 0.1 of the spacing, so the beam is even to
// better than shot noise. They leave through y = 130 and are not brought back. A ray that went round again would meet the same
// landscape and its heading would only spread, and the veins would melt: in a static field the density contrast (rms over the
// mean of the ray density on the panel) falls 0.86, 0.58, 0.34, 0.21 for the first four passes, and the rms heading rises 0.34,
// 0.45, 0.53, 0.59. A fresh beam every time keeps the first-pass picture for ever. The first frame is laid down from 305 rays
// traced through the landscape as it stands, each carrying a train of particles 1.4 LEDs apart, with their trails.
//
// Colour. A ray's heading, relative to the mean heading of all rays (smoothed over 1.5 s), picks a place on a ramp from cyan on
// the left through lavender to magenta on the right, at +-0.25 in sin of the angle. A moving landscape drags the mean heading
// by up to 0.1, which is why the ramp is centred on it. Light is added per channel, so where a left and a right vein cross it
// is white.
//
// Checks, each run on this file with its internals exported (Node, the study's seeded Math.random).
// 1. Branching depth. A cold beam of 4096 rays in a static field, the depth at which 0.2 % of the neighbouring pairs have crossed,
//    mean of 16 fields, xi = 14: 93, 64, 45, 33, 26, 21 LEDs at s = 0.008, 0.012, 0.018, 0.027, 0.04, 0.06. A line through
//    them is L ~ s^-0.74, not -2/3: the local exponent is -0.91 at the weak end and -0.46 at the strong, and passes -2/3 near
//    s = 0.03. At s = 0.03 the depth goes as xi^0.81 for xi = 6 to 24 (17 to 52 LEDs), where scaling says xi^1.
// 2. The integrator. In a static field H = |p| - 1 - V, with V summed exactly, changes by 5.4e-4 rms (1.6 % of s) over 1000
//    steps of 0.1 LED at xi = 14, s = 0.035, and by 2.5e-3 at xi = 9.3, s = 0.054. It is the same for steps of 0.4, 0.2 and 0.1,
//    and it grows only slowly with the path, 3.2e-4 after 10 LEDs and 5.4e-4 after 100: the grid's force, 0.5 LED nodes with a
//    bilinear lookup, sets it, not the step. Against RK4 with the exact force the position after 150 LEDs is out by 0.86 LED rms
//    (xi = 14, s = 0.035) and by 15 LEDs in the hot case, the same for every step, so it is the grid's force error amplified by
//    the rays' divergence. It is a slightly smoothed landscape, not a wrong one.
// 3. The flux. In 900 s at the opening 2,349,120 rays went in and 2,349,296 came out, a ratio of 1.0001, with 35,295 in flight
//    (35,179 to 35,657) and the density, by quarters of the panel, 1.00 to 1.01 times the beam's, rising 0.3 % toward the bottom
//    where the rays are a little oblique.
//
const W = 64, H = 128;
const { floor, ceil, min, max, sqrt, sin, cos, exp, log, pow, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- the landscape grid ---------------------------------------------------------------------
const GH = 0.5, GI = 1 / GH; // grid spacing in LEDs
const PAD = 32; // LEDs of beam and landscape above the panel
const YT = -PAD - 1, YB = H + 3; // top and bottom row of the grid, in LED coordinates
const YEXIT = H + 2, YTURN = -PAD - 0.5;
const NR = Math.round((YB - YT) / GH), NC = Math.round(W / GH); // cells: nodes are NR+1 by NC+1
const NN = (NR + 1) * (NC + 1), NCN = NC + 1;
const NRE = NR + 3, NCE = NC + 3; // extended rows and columns for the central differences

// ---- wave pool ------------------------------------------------------------------------------
const NP = 160;
const KMIN = 0.3, KMAX = 2.0;
const DKX = TAU / W;
const SIGK = 0.3; // width of the spectrum in ln k

// ---- the particles --------------------------------------------------------------------------
const RHO0 = 3.4; // particles per LED^2 in the beam
const V0 = 12; // LEDs a second at Flow 2
const HMAX = 0.42; // longest step, LEDs
const CAP = Math.round(RHO0 * W * (H + PAD + 4) * 1.5);
const TRAIL = 2.5; // e-folding length of a particle's light along its path, LEDs
const DTRAIN = 1.4; // spacing of particles along a ray when the first frame is laid down

// The landscape fades in over the first TAPER LEDs of the beam's run, above the panel. Switched on all at once, a wave
// leaves each ray with a tilt of a kx / ky that depends on where along the wave it started, and the beam gets a phase
// screen of long straight columns instead of branches.
const TAPER = 14;
const TAPER_G = new Float64Array(NRE);
for (let e = 0; e < NRE; e++) {
  const t = cl((YT + (e - 1) * GH - YT) / TAPER, 0, 1);
  TAPER_G[e] = t * t * (3 - 2 * t);
}

const OPEN = [0, 2, 0, 0.06];
const NF = 10; // frames between two snapshots of the landscape
const NSL = 9; // of which this many compute rows of the next one

const WD = 0.8; // LEDs a second the whole landscape drifts at Flow 2
const OMS = 0.08; // spread of the waves' own frequencies, rad a second
const BREATH = 0.45, MU0 = 0.07; // each wave's amplitude swells and fades by 45 % at its own rate around 0.07 rad a second

function mkpool(n) {
  return {
    n,
    x: new Float32Array(n), y: new Float32Array(n),
    px: new Float32Array(n), py: new Float32Array(n),
    ax: new Float32Array(n), ay: new Float32Array(n),
    alive: new Uint8Array(n), free: new Int32Array(n), nfree: 0,
  };
}
function clearpool(P) {
  P.alive.fill(0);
  for (let i = 0; i < P.n; i++) P.free[i] = P.n - 1 - i;
  P.nfree = P.n;
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Strength knob (-1..1) to the rms of V, and Scale knob to the correlation length in LEDs.
const strengthOf = (k) => 0.032 * pow(1.6, cl(k, -1, 1));
const xiOf = (k) => 14 * pow(1.5, cl(k, -1, 1));

export function setup(params, knobs) {
  const k = knobs || OPEN;
  const S = {
    tau: 0, f: 0, ft: 1 / 30, pace: cl(k[1], 1, 4) / 2,
    ks: TAU / xiOf(k[2]), ss: strengthOf(k[3]), // smoothed spectrum centre and strength
    ph: new Float64Array(NP), om: new Float64Array(NP), mu: new Float64Array(NP), ze: new Float64Array(NP),
    pk: new Float64Array(NP), pkx: new Float64Array(NP), pky: new Float64Array(NP),
    cx: new Float32Array(NP * NCE), sx: new Float32Array(NP * NCE),
    cy: new Float32Array(NP * NRE), sy: new Float32Array(NP * NRE),
    vext: new Float32Array(NRE * NCE),
    X0: new Float32Array(NN), X1: new Float32Array(NN), XN: new Float32Array(NN),
    Y0: new Float32Array(NN), Y1: new Float32Array(NN), YN: new Float32Array(NN),
    GX: new Float32Array(NN), GY: new Float32Array(NN),
    act: new Int32Array(NP), nact: 0, amp: new Float64Array(NP), tcos: new Float64Array(NP), tsin: new Float64Array(NP),
    wx: 0, wy: 0, tilt: 0, w: 0,
    P: mkpool(CAP),
    buf: new Float32Array(W * H * 3), tmp: new Float32Array(W * H * 3),
    ramp: new Float32Array(256 * 3), hue: -1,
    births: 0, nspawn: 0, nin: 0, nout: 0, mh: 0,
  };
  clearpool(S.P);
  // The pool: wavenumbers log-uniform between KMIN and KMAX, directions uniform in a half plane, kx on the box's lattice.
  for (let j = 0; j < NP; j++) {
    const kk = KMIN * exp(Math.random() * log(KMAX / KMIN));
    let m = Math.round((kk * cos(Math.random() * PI)) / DKX);
    while (abs(m) * DKX > kk) m -= m > 0 ? 1 : -1; // rounding must not push kx past k
    const kx = m * DKX, ky = sqrt(max(0, kk * kk - kx * kx));
    S.pk[j] = sqrt(kx * kx + ky * ky);
    S.pkx[j] = kx;
    S.pky[j] = ky;
    S.ph[j] = Math.random() * TAU;
    S.om[j] = (Math.random() * 2 - 1) * OMS;
    S.mu[j] = MU0 * (0.4 + 1.6 * Math.random());
    S.ze[j] = Math.random() * TAU;
    for (let c = 0; c < NCE; c++) {
      S.cx[j * NCE + c] = cos(kx * (c - 1) * GH);
      S.sx[j * NCE + c] = sin(kx * (c - 1) * GH);
    }
    for (let r = 0; r < NRE; r++) {
      S.cy[j * NRE + r] = cos(ky * (YT + (r - 1) * GH));
      S.sy[j * NRE + r] = sin(ky * (YT + (r - 1) * GH));
    }
  }
  drive(S);
  selectWaves(S, 0);
  targetPhases(S, 0);
  vrows(S, 0, NRE);
  gradient(S, S.X0, S.Y0);
  S.X1.set(S.X0);
  S.Y1.set(S.Y0);
  params.s = S;
  blend(S, 0);
  preroll(S);
  buildRamp(S, k[0]);
  tailfill(S, cl(k[1], 1, 4));
  S.nin = 0;
  S.nout = 0;
  return S;
}

// Where the landscape drifts and where the beam points at model time tau.
function drive(S) {
  const t = S.tau, psi = 0.6 + 1.9 * sin(0.021 * t + 0.4) + 1.3 * sin(0.0077 * t + 1.1);
  const sp = WD * (0.75 + 0.25 * sin(0.0153 * t + 2.0) + 0.1 * sin(0.0271 * t));
  S.wx = sp * cos(psi);
  S.wy = sp * sin(psi);
  S.tilt = 0.025 * sin(0.19 * t + 1.3) + 0.02 * sin(0.113 * t + 4.1) + 0.02 * sin(0.067 * t + 2.2) + 0.015 * sin(0.29 * t + 0.7);
}

// Pick the waves that carry weight at the current centre of the spectrum and give each its amplitude, so the field has
// the variance ss^2.
function selectWaves(S, tt) {
  let n = 0, e = 0;
  for (let j = 0; j < NP; j++) {
    const z = log(S.pk[j] / S.ks) / SIGK, w = exp(-0.5 * z * z) * (1 + BREATH * sin(S.mu[j] * tt + S.ze[j]));
    if (w < 0.08) continue;
    S.act[n] = j;
    S.amp[n] = w;
    e += w * w;
    n++;
  }
  const g = (S.ss * sqrt(2)) / sqrt(e);
  for (let m = 0; m < n; m++) S.amp[m] *= g;
  S.nact = n;
}

// The phases the active waves will have after `frames` more frames at the present pace.
function targetPhases(S, frames) {
  const dtau = frames * S.ft * S.pace;
  for (let m = 0; m < S.nact; m++) {
    const j = S.act[m], p = S.ph[j] + (S.om[j] - S.wx * S.pkx[j] - S.wy * S.pky[j]) * dtau;
    S.tcos[m] = cos(p);
    S.tsin[m] = sin(p);
  }
}

function vrows(S, e0, e1) {
  const { vext, act, amp, tcos, tsin, cx, sx, cy, sy } = S, nact = S.nact;
  for (let e = e0; e < e1; e++) {
    const o = e * NCE;
    for (let c = 0; c < NCE; c++) vext[o + c] = 0;
    const g = TAPER_G[e];
    for (let m = 0; m < nact; m++) {
      const j = act[m], a = amp[m], cyy = cy[j * NRE + e], syy = sy[j * NRE + e];
      const A = g * a * (cyy * tcos[m] - syy * tsin[m]), B = g * a * (syy * tcos[m] + cyy * tsin[m]);
      const q = j * NCE;
      for (let c = 0; c < NCE; c++) vext[o + c] += A * cx[q + c] - B * sx[q + c];
    }
  }
}

function gradient(S, X, Y) {
  const { vext } = S;
  for (let r = 0; r <= NR; r++)
    for (let c = 0; c <= NC; c++) {
      const e = (r + 1) * NCE + c + 1, o = r * NCN + c;
      X[o] = (vext[e + 1] - vext[e - 1]) * (0.5 * GI);
      Y[o] = (vext[e + NCE] - vext[e - NCE]) * (0.5 * GI);
    }
}

// Blend the two snapshots at weight w into the field the particles read.
function blend(S, w) {
  const { X0, X1, Y0, Y1, GX, GY } = S, a = 1 - w;
  S.w = w;
  for (let i = 0; i < NN; i++) {
    GX[i] = a * X0[i] + w * X1[i];
    GY[i] = a * Y0[i] + w * Y1[i];
  }
}

// Leapfrog on H = |p| - n(x), n = 1 + V: unit speed, p kicked by grad V.
function move(P, i0, i1, h, GX, GY) {
  const { x, y, px, py, ax, ay, alive } = P, hh = 0.5 * h;
  for (let i = i0; i < i1; i++) {
    if (!alive[i]) continue;
    const qx = px[i] + hh * ax[i], qy = py[i] + hh * ay[i];
    const inv = h / sqrt(qx * qx + qy * qy);
    let X = x[i] + qx * inv;
    const Y = y[i] + qy * inv;
    if (X >= W) X -= W;
    else if (X < 0) X += W;
    if (Y >= YEXIT || Y < YTURN) {
      alive[i] = 0;
      P.free[P.nfree++] = i;
      continue;
    }
    const u = X * GI, v = (Y - YT) * GI, ix = u | 0, iy = v | 0, fx = u - ix, fy = v - iy, o = iy * NCN + ix;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    const gx = GX[o] * w00 + GX[o + 1] * w10 + GX[o + NCN] * w01 + GX[o + NCN + 1] * w11;
    const gy = GY[o] * w00 + GY[o + 1] * w10 + GY[o + NCN] * w01 + GY[o + NCN + 1] * w11;
    x[i] = X;
    y[i] = Y;
    ax[i] = gx;
    ay[i] = gy;
    px[i] = qx + hh * gx;
    py[i] = qy + hh * gy;
  }
}

function spawn(S, P, X, Y, tilt) {
  if (!P.nfree) return -1;
  const j = P.free[--P.nfree], n = 1;
  P.alive[j] = 1;
  P.x[j] = X;
  P.y[j] = Y;
  P.px[j] = n * sin(tilt);
  P.py[j] = n * cos(tilt);
  P.ax[j] = 0;
  P.ay[j] = 0;
  return j;
}

// The first frame: rays from the top edge through the landscape as it stands, each carrying a train of particles
// DTRAIN apart, so the beam is already branched down the whole panel.
function preroll(S) {
  const NRAY = Math.round(RHO0 * W * DTRAIN), R = mkpool(NRAY), P = S.P, h = HMAX;
  clearpool(R);
  const nxt = new Float64Array(NRAY);
  for (let j = 0; j < NRAY; j++) {
    spawn(S, R, ((j + Math.random()) * W) / NRAY, -PAD, S.tilt);
    nxt[j] = Math.random() * DTRAIN;
  }
  let l = 0;
  for (let step = 0; step < 2000 && R.nfree < NRAY; step++) {
    move(R, 0, NRAY, h, S.GX, S.GY);
    l += h;
    for (let j = 0; j < NRAY; j++) {
      if (!R.alive[j]) continue;
      while (l >= nxt[j]) {
        nxt[j] += DTRAIN;
        if (!P.nfree) break;
        const i = P.free[--P.nfree];
        P.alive[i] = 1;
        P.x[i] = R.x[j];
        P.y[i] = R.y[j];
        P.px[i] = R.px[j];
        P.py[i] = R.py[j];
        P.ax[i] = R.ax[j];
        P.ay[i] = R.ay[j];
      }
    }
  }
}

const SINMAX = 0.25;
function buildRamp(S, hue) {
  S.hue = hue;
  for (let i = 0; i < 256; i++) {
    const u = i / 127.5 - 1, a = pow(abs(u), 0.8);
    const h = 0.7 + (u < 0 ? -0.18 : 0.18) * a + hue, sat = 0.2 + 0.8 * a;
    hsv(h, sat, 1, S.ramp, i * 3);
    const y = 0.299 * S.ramp[i * 3] + 0.587 * S.ramp[i * 3 + 1] + 0.114 * S.ramp[i * 3 + 2], g = 0.8 / y;
    for (let c = 0; c < 3; c++) S.ramp[i * 3 + c] *= g;
  }
}

export function update(dt, input, params) {
  const k = (input && input.knobValues) || OPEN;
  if (!params.s) setup(params, k);
  advance(params.s, cl(dt || 0, 0, 0.1), k);
}

function advance(S, ft, k) {
  const pace = cl(k[1], 1, 4) / 2, dtau = ft * pace;
  S.ft = ft;
  S.pace = pace;
  const aa = 1 - exp(-ft / 0.5);
  S.ks += (TAU / xiOf(k[2]) - S.ks) * aa;
  S.ss += (strengthOf(k[3]) - S.ss) * aa;
  S.tau += dtau;
  drive(S);
  for (let j = 0; j < NP; j++) S.ph[j] += (S.om[j] - S.wx * S.pkx[j] - S.wy * S.pky[j]) * dtau;
  // the next snapshot is computed a slice a frame
  const f = S.f;
  if (f === 0) {
    selectWaves(S, S.tau + 2 * NF * ft * pace);
    targetPhases(S, 2 * NF);
  }
  if (f < NSL) {
    const n = ceil(NRE / NSL);
    vrows(S, f * n, min(NRE, (f + 1) * n));
  } else if (f === NSL) gradient(S, S.XN, S.YN);
  blend(S, (f + 1) / NF);
  if (f === NF - 1) {
    let t = S.X0; S.X0 = S.X1; S.X1 = S.XN; S.XN = t;
    t = S.Y0; S.Y0 = S.Y1; S.Y1 = S.YN; S.YN = t;
    S.f = 0;
  } else S.f = f + 1;
  if (S.hue !== k[0]) buildRamp(S, k[0]);
  // particles
  const dl = V0 * dtau, ns = ceil(dl / HMAX), h = dl / ns, P = S.P;
  for (let s = 0; s < ns; s++) {
    S.births += RHO0 * W * h * cos(S.tilt);
    while (S.births >= 1) {
      S.births -= 1;
      // positions come from a low-discrepancy sequence (the R2 sequence of Roberts, 2018, from memory) with a little jitter, so
      // the beam is even to the shot noise's better, not Poisson
      const n = ++S.nspawn;
      if (spawn(S, P, W * (((n * 0.7548776662466927 + 0.1 * Math.random()) % 1) + 1) % W, -PAD + h * ((n * 0.5698402909980532) % 1), S.tilt) >= 0) S.nin++;
    }
    const before = P.nfree;
    move(P, 0, CAP, h, S.GX, S.GY);
    S.nout += P.nfree - before;
  }
  deposit(S, exp(-dl / TRAIL));
}

// One particle's light, spread over the four LEDs round (X, Y). The panel wraps along x.
function splat(buf, X, Y, R, G, B) {
  X -= 0.5;
  Y -= 0.5;
  let ix = floor(X), iy = floor(Y);
  const fx = X - ix, fy = Y - iy;
  if (ix < 0) ix += W;
  const ix1 = ix + 1 === W ? 0 : ix + 1;
  for (let dy = 0; dy < 2; dy++) {
    const yy = iy + dy;
    if (yy < 0 || yy >= H) continue;
    const wy = dy ? fy : 1 - fy, a = (1 - fx) * wy, b = fx * wy, o0 = (yy * W + ix) * 3, o1 = (yy * W + ix1) * 3;
    buf[o0] += R * a; buf[o0 + 1] += G * a; buf[o0 + 2] += B * a;
    buf[o1] += R * b; buf[o1 + 1] += G * b; buf[o1 + 2] += B * b;
  }
}

function deposit(S, decay) {
  const { buf, ramp } = S, { x, y, px, py, alive } = S.P, q0 = 1 - decay;
  for (let i = 0; i < buf.length; i++) buf[i] *= decay;
  const C1 = 1 / SINMAX, ct = cos(S.tilt), st = sin(S.tilt), mh0 = S.mh;
  let hs = 0, nh = 0;
  for (let i = 0; i < CAP; i++) {
    if (!alive[i] || y[i] < -0.5 || y[i] >= H + 0.5) continue;
    const dxv = (px[i] * ct - py[i] * st) / sqrt(px[i] * px[i] + py[i] * py[i]);
    hs += dxv;
    nh++;
    let ri = (((dxv - mh0) * C1 + 1) * 127.5) | 0;
    ri = ri < 0 ? 0 : ri > 255 ? 255 : ri;
    splat(buf, x[i], y[i], ramp[ri * 3] * q0, ramp[ri * 3 + 1] * q0, ramp[ri * 3 + 2] * q0);
  }
  if (nh) S.mh += (hs / nh - S.mh) * (1 - exp(-S.ft / 1.5));
}

// The first frame's trails: each particle's light is laid back along its heading at every second frame's step, as it
// would stand after a few frames of running.
function tailfill(S, flow) {
  const { buf, ramp } = S, { x, y, px, py, alive } = S.P, dl = (V0 * flow) / 60, decay = exp(-dl / TRAIL);
  const ct = cos(S.tilt), st = sin(S.tilt);
  let hs = 0, nh = 0;
  for (let i = 0; i < CAP; i++)
    if (alive[i]) {
      hs += (px[i] * ct - py[i] * st) / sqrt(px[i] * px[i] + py[i] * py[i]);
      nh++;
    }
  S.mh = hs / nh;
  for (let i = 0; i < CAP; i++) {
    if (!alive[i]) continue;
    const q = sqrt(px[i] * px[i] + py[i] * py[i]), ri = ((((px[i] * ct - py[i] * st) / q - S.mh) / SINMAX + 1) * 127.5) | 0;
    const r = ri < 0 ? 0 : ri > 255 ? 255 : ri, ux = px[i] / q, uy = py[i] / q;
    for (let j = 0; j < 24; j += 2) {
      const X = x[i] - ux * dl * j, Y = y[i] - uy * dl * j;
      if (Y < -0.5 || Y >= H + 0.5) continue;
      const w = 2 * (1 - decay) * pow(decay, j);
      splat(buf, X, Y, ramp[r * 3] * w, ramp[r * 3 + 1] * w, ramp[r * 3 + 2] * w);
    }
  }
}

const GAIN = 0.6, THR = 0.3, BX = 0.18, BY = 0.25;
export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { buf, tmp } = S, cx = 1 - 2 * BX, cy = 1 - 2 * BY;
  // a light blur, wider along y than along x because the veins mostly run down the panel: [bx 1-2bx bx] along x
  // (the panel wraps), [by 1-2by by] along y
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, ol = (y * W + (x === 0 ? W - 1 : x - 1)) * 3, or = (y * W + (x === W - 1 ? 0 : x + 1)) * 3;
      tmp[o] = BX * buf[ol] + cx * buf[o] + BX * buf[or];
      tmp[o + 1] = BX * buf[ol + 1] + cx * buf[o + 1] + BX * buf[or + 1];
      tmp[o + 2] = BX * buf[ol + 2] + cx * buf[o + 2] + BX * buf[or + 2];
    }
  const k = 1 / RHO0;
  for (let y = 0; y < H; y++) {
    const yu = y === 0 ? 0 : y - 1, yd = y === H - 1 ? H - 1 : y + 1;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, ou = (yu * W + x) * 3, od = (yd * W + x) * 3;
      const r0 = (BY * tmp[ou] + cy * tmp[o] + BY * tmp[od]) * k, r1 = (BY * tmp[ou + 1] + cy * tmp[o + 1] + BY * tmp[od + 1]) * k;
      const r2 = (BY * tmp[ou + 2] + cy * tmp[o + 2] + BY * tmp[od + 2]) * k;
      const q0 = 1 - exp(-GAIN * max(0, r0 - THR)), q1 = 1 - exp(-GAIN * max(0, r1 - THR)), q2 = 1 - exp(-GAIN * max(0, r2 - THR));
      display.setPixel(x, y, 235 * q0 + 20 * min(1, q0 * 25), 235 * q1 + 20 * min(1, q1 * 25), 235 * q2 + 20 * min(1, q2 * 25));
    }
  }
}
