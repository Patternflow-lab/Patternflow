// ===== Patternflow pattern =====
// Title:   Wake Forest
// Family:  sim
// Idea:    Water runs down the panel through a stand of round posts, every post sheds a street of eddies that runs into the posts behind it, and twelve lines of dye let in at the top are split, caught in the wakes and braided
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Flow past circular cylinders and the vortex street behind them (Strouhal, 1878; von Karman, 1911; the Strouhal number against the Reynolds number as fitted by Roshko, 1954, and Williamson, 1989); an array of cylinders in a periodic box by a pseudo-spectral solver with Brinkman penalization (Angot, Bruneau and Fabrie, 1999; Kevlahan and Ghidaglia, 2001); Shu and Osher's third order scheme (1988); the dye in flux form with the monotonised central limiter (van Leer, 1977). The screen at the top, the drag on the largest eddies and the wandering push are mine.
// Round:   125
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..3.2, Scale=-1..1, Lean=-1..1
//
// Knob 1: Hue. Turns every colour round the grey axis by the knob times 360 degrees; at 0 the dyes are coral red and gold on a dark plum ground, and the ground warms where the water turns one way and cools where it turns the other.
// Knob 2: Flow. Model seconds per panel second. The water is pushed at 3 LEDs per model second, so 1.5 LEDs a second at 0.5, 6 at the opening 2 and 9.6 at 3.2. A post of the opening size sheds an eddy every 9.3 model seconds, 4.6 s at the opening.
// Knob 3: Scale. The size and the number of the posts together. The radius is 2.9 LEDs times 1.2 to the knob (2.4 at -1, 2.9 at 0, 3.5 at 1) and the posts number 15 minus 3 times the knob (18, 15, 12). The ones that come or go grow from, or shrink to, nothing over about a second.
// Knob 4: Lean. The direction of the push. At 0 the water runs straight down; the knob turns the push by 0.25 radian (14 degrees) to the left at -1 and to the right at 1, on top of the wander of 6 degrees rms. The mean flow follows in about 2 model seconds, 1 s at the opening, the wakes swing sideways with it and a different set of posts stands in the wake of each post.

// What the field is. A torus of 64 by 128 cells, one to an LED, with the vorticity w of an incompressible flow (u = (psi_y, -psi_x), w = -lap psi) and the mean velocity U that vorticity cannot carry, in model seconds:
//   w_t + (u + U).grad w = -nu k^2 w - nu4 k^4 w - mu(k) w + the curl of the posts' drag,   nu 0.109 (a post of 5.8 LEDs in a push of 3 is at Reynolds 160), nu4 0.004, mu(k) = 0.5 / (1 + (k / 0.12)^4)
// mu is 0.49 a second at the panel's own size and 0.23 at a wavelength of 50 LEDs, 0.025 at 25 and nothing below 12: the largest eddies are drained and the wake eddies, 6 to 25 LEDs, are left alone, which keeps the wakes of 15 posts from piling into one vortex the size of the panel.
// The posts are disks of a mask chi = (1 - tanh((r - R) / 0.75)) / 2, up to 18 of them in rows 21 to 118. Each step ends with the Brinkman step of penalization: the whole velocity u + U is multiplied by 1 / (1 + dt chi / eta), eta = 0.002 model seconds,
// which holds it near zero inside a post and is stable at any step. The product is not free of divergence, but its curl is the vorticity the next step starts from, so no pressure is solved: what the curl leaves out is the part a pressure would take away.
// U is the mean of that product, then pulled toward the push at a rate of 1 / 2 per second, which is the body force. The push is u0 (1 + s) (sin(theta + lean), cos(theta + lean)), u0 = 3 LEDs per model second, theta an Ornstein-Uhlenbeck process (rms 0.11 rad, 6 degrees, correlation time 14 s, so 20 degrees is a rare lean) and lean the knob's 0.25 rad and s another
// (rms 0.22, correlation 9 s, kept between -0.55 and 0.6), so the wakes lean and surge and none of them settles into a beat. The top 12 rows are a screen: the velocity is pulled to the mean flow there, at 0.4 a second at the top row and down to 0 by row 12, so what enters the stand is calm and every street starts on a post.
// The scheme: u and the gradient of w by two inverse transforms (the pairs packed in one), (u + U).grad w by one forward, that term times exp(-36 (k / 1.8)^16), Shu and Osher's third order scheme at a step of 0.1 (half of it when 1.8 times the fastest speed times the step passes 1.4), nine transforms a step; then the Brinkman step by two more. The dye is two scalars
// carried by the velocity at the start of the step (cell values averaged to the faces) in x, y, x sweeps of the flux-form second order upwind scheme with the monotonised central limiter, at most 0.8 of a cell a sweep, with a diffusion of 0.03. Twelve stripes, spacing 5.3 LEDs and 2.6 wide at half height, are let in over the top 8 rows
// (relaxed to the stripes at up to 3 a second), alternately dye A and dye B, each with a strength 0.72 plus an Ornstein-Uhlenbeck wander (rms 0.5, correlation 3 s, kept between 0.2 and 1) and a sideways wander (rms 0.8 LED, correlation 6 s); the last 9 rows relax the dye to 0 at up to 1.4 a second, so the water comes round to the top clean.
// Dye is taken out where chi is above 0.55. Before the first frame 28 model seconds run from straight stripes and a little vorticity at the wavelengths of the wakes (0.02 per mode, 0.12 < k < 0.9). Each LED is the ground plus the two dyes through a curve that lifts thin dye (1 - exp(-c / 0.34))^1.8, with a soft shoulder over 170,
// lit by the vorticity (z = 1.5 w / its rms, w' = z / (1 + |z|), the colour times 1 + 0.3 w' and a tint of (18, 6, -8) times w'), and the posts a dark disk (10, 8, 12) with a rim of (150, 118, 64) times 2.4 chi (1 - chi).
//
// What was checked, with the file's own step (scripts of mine, not in the repo):
// - The Strouhal number of one post. A single post of the opening size (diameter 5.8 LEDs) alone in the 64 by 128 torus, no wander, the same screen and drag, the cross-stream velocity 16 LEDs behind it read from 96 to 240 model seconds, the strongest line of its spectrum: f = 0.0930, 0.1075 and 0.1070 per model second at the push of 3,
//   Reynolds 100, 160 and 256, so f D / U = 0.180, 0.208 and 0.207. Williamson's fit for a cylinder in open water (-3.3265 / Re + 0.1816 + 1.6e-4 Re, from memory) gives 0.164 and 0.186 at 100 and 160 and Roshko's 0.212 (1 - 21.2 / Re) 0.167, 0.184 and 0.195 at 100, 160 and 256: the panel's post is 6 to 11 per cent fast. I did
//   not separate the causes; the post is 9 per cent of the width of the torus, which raises the number, and the edge of the mask is 1.5 LEDs soft. The number does not move with the step (0.208, 0.208 and 0.209 at 0.1, 0.05 and 0.025), with eta from 0.0005 to 0.008 (0.208 to 0.209) or with the edge half width from 0.5 to 1.0 (0.210).
// - The posts hold. In the open set from 20 to 70 s the water inside the posts (chi above 0.9) goes at 0.15 LEDs a second on average and 0.5 at most, against a push of 2.8 (5 and 18 per cent). The mean velocity follows the push within 13 per cent (0.27, 2.45 against 0.22, 2.81 at 70 s), the lag being the posts' drag and the push moving.
// - The stand. For twelve seeds of the layout, 67 to 83 per cent of the posts have another post 12 to 52 LEDs downstream inside a cone of half width 6 + 0.12 times the distance, whether 12, 15 or 18 stand; centres are 12 to 18 LEDs apart at the nearest (diameter 5.8 at most 7).
// - 900 s, the open, all-minimum and all-maximum sets through update(): see the table below; no frame was non-finite.
// - flowcheck, 240 s, six sets (open; all minimum; all maximum; three random): recur 0.62 to 0.75, dim 0.67 to 0.72, quiet 0.36 to 0.54 (the last quarter 0.36 to 0.52), luma +0.0 to 6.5 per cent first to last quarter.
// - Cost: see the table below.
//
// What failed first. 1. No drag at all: one post alone in the torus did not make a street, it made a flow. The cross-stream speed 16 LEDs behind it had an rms of 2.1 LEDs a second against a push of 3, the vorticity of the wake piled into eddies as big as the panel. Drag of 0.1 on every mode went the other way: no street at all, a standing wake (rms 0.000) at Reynolds 197. Drag on the largest scales only, the mu(k) above, gave a street at f D / U 0.21. 2. The screen at 4 a second made the stand too calm: the same picture at Reynolds 83, 228 and 418, no street behind most posts (the rms of the
// cross-stream speed 10 LEDs behind a post was 0.2 to 2.3, against 0.5 to 3.0 with no screen). At 0.4 enough noise gets through to keep the posts shedding while the stripes still come in straight. 3. The dye was one scalar on a ramp from coral through the ground to gold, and the two
// dyes cancelled where they mixed: below the first few posts the picture was the dark middle of the ramp. Two dyes that add give a glow where they mix. 4. Dye was killed in the whole soft edge of a post, 0.05 < chi, and every post trailed a dye-free tail; killing above 0.55 only left the water at the edge its dye. 5. The tile that
// changed least in flowcheck was at the bottom, with the dye gone and the posts ending at row 113: the all-minimum set had quiet 0.31 (0.28 in the last quarter). Posts to row 118, the ground tinted by the sign of the vorticity and the curve that lifts thin dye took it to 0.52 and 0.50. 6. The fourth knob was Reynolds, 100 to 256 on the same viscosity law. Over that range the rms vorticity moved 8 per cent (0.94 to 1.02 per model second) and the spread of the dye in rows 10 to 30 and 90 to 118 about 5 per cent, which nobody turning a knob would see in 3 s; the pictures at the ends were two draws of one picture. It is Lean now, which swings every wake in about a second, and the Reynolds number stays at 160.
// What was not checked. A grid finer than the panel's: a post is 5.8 cells across, so the boundary layer, 0.4 of a cell at Reynolds 200, is not resolved and the Reynolds number is the viscosity's, not a measured drag (I did not compare the drag coefficient of one post with the 1.3 to 1.4 a cylinder has at 100 to 200, from memory). The
// time order of the Brinkman step, which is first order (the Strouhal number did not move from 0.1 to 0.025). Three dimensions, where the street goes oblique and then irregular from about Reynolds 190. A post that moves. The drag, the screen, the wandering push, the dye's rows of inlet and outlet and the lighting by vorticity are the picture's own: none of them is in the
// equation of a flow past a post.

const W = 64, H = 128, N = W * H, WM = W - 1, HM = H - 1;
const { floor, ceil, abs, sqrt, exp, log, cos, sin, tanh, PI, min, max, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];

const CFG = {
  u0: 3.0, // mean flow, LEDs per model second
  tauU: 2.0, // the mean flow is pulled to its target at this rate
  angS: 0.11, // rms of the direction of the push, radians
  angT: 14, // its correlation time, model seconds
  spdS: 0.22, // rms of the push's strength as a share of u0
  spdT: 9,
  re0: 160, // Reynolds number of a post of the nominal diameter at the push u0
  d0: 5.8, // nominal post diameter
  lean: 0.25, // radians the push turns at Lean 1
  hyp: 0.004,
  fric: 0.5, // drag on the largest eddies, fric / (1 + (k / fricK)^4), so that wakes do not pile into one big vortex
  fricK: 0.12,
  eta: 0.002, // Brinkman time
  delta: 0.75, // half width of a post's edge, LEDs
  dt: 0.1,
  pre: 20,
  cfl: 0.8,
  nStripe: 12,
  stripeS: 1.1,
  rin: 3.0,
  spg: 0.4, // rate of the screen at the top, 1 / model second, which pulls every eddy back to the mean flow
  ysp: 12,
  yin: 8,
  rout: 1.4,
  yout: 5,
  postTop: 21,
  postBot: 121,
  cdiff: 0.03,
};

// ---- radix-2 FFT, rows contiguous, columns by butterflies across rows ----
function plan(n) {
  const lg = Math.round(Math.log2(n)), rev = new Uint16Array(n), c = new Float64Array(n / 2), s = new Float64Array(n / 2);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) if (i & (1 << b)) r |= 1 << (lg - 1 - b);
    rev[i] = r;
  }
  for (let i = 0; i < n / 2; i++) (c[i] = cos((TAU * i) / n)), (s[i] = -sin((TAU * i) / n));
  return { n, rev, c, s };
}
const PW = plan(W), PH = plan(H);
function fftRows(re, im, inv) {
  const { n, rev, c, s } = PW, sg = inv ? -1 : 1;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[o + i];
        re[o + i] = re[o + j];
        re[o + j] = t;
        t = im[o + i];
        im[o + i] = im[o + j];
        im[o + j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1, step = n / len;
      for (let i = o; i < o + n; i += len)
        for (let k = 0, t = 0; k < half; k++, t += step) {
          const wr = c[t], wi = sg * s[t], a = i + k, b = a + half;
          const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
    }
  }
}
function fftCols(re, im, inv) {
  const { n, rev, c, s } = PH, sg = inv ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      const a = i * W, b = j * W;
      for (let x = 0; x < W; x++) {
        let t = re[a + x];
        re[a + x] = re[b + x];
        re[b + x] = t;
        t = im[a + x];
        im[a + x] = im[b + x];
        im[b + x] = t;
      }
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const wr = c[t], wi = sg * s[t], a = (i + k) * W, b = a + half * W;
        for (let x = 0; x < W; x++) {
          const xr = re[b + x] * wr - im[b + x] * wi, xi = re[b + x] * wi + im[b + x] * wr;
          re[b + x] = re[a + x] - xr;
          im[b + x] = im[a + x] - xi;
          re[a + x] += xr;
          im[a + x] += xi;
        }
      }
  }
}
function fft2(re, im, inv) {
  fftRows(re, im, inv);
  fftCols(re, im, inv);
}

const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());

// ---- wavenumbers of the torus ----
const KX = new Float64Array(N), KY = new Float64Array(N), K2 = new Float64Array(N), FIL = new Float64Array(N), MIR = new Int32Array(N);
for (let j = 0; j < H; j++)
  for (let i = 0; i < W; i++) {
    const p = j * W + i, nx = i < W / 2 ? i : i - W, ny = j < H / 2 ? j : j - H;
    KX[p] = (TAU * nx) / W;
    KY[p] = (TAU * ny) / H;
    K2[p] = KX[p] * KX[p] + KY[p] * KY[p];
    FIL[p] = exp(-36 * pow(sqrt(K2[p]) / 1.8, 16));
    MIR[p] = ((H - j) & HM) * W + ((W - i) & WM);
  }
// distance across the seam of a torus
const wrapd = (d, L) => {
  d = ((d % L) + L) % L;
  return d > L / 2 ? d - L : d;
};

// ---- where the posts stand ----
// 18 sites. x comes from the golden-ratio sequence so that any first n of them leave no wide lane,
// y from the best of 24 tries (the farthest from the posts already placed); of 30 such stands
// the one in which most posts have another in their wake is kept.
function makeLayout() {
  const PHI = 0.6180339887498949;
  let best = null, bestScore = -1;
  for (let tries = 0; tries < 30; tries++) {
    const off = Math.random() * W, pts = [];
    for (let i = 0; i < 18; i++) {
      const x = (off + i * PHI * W + (Math.random() - 0.5) * 3 + W * 4) % W;
      let by = 0, bd = -1;
      for (let k = 0; k < 24; k++) {
        const y = CFG.postTop + Math.random() * (CFG.postBot - CFG.postTop);
        let d = 1e9;
        for (const q of pts) {
          const dx = wrapd(x - q.x, W), dy = y - q.y;
          d = min(d, dx * dx + dy * dy);
        }
        if (d > bd) (bd = d), (by = y);
      }
      pts.push({ x, y: by });
    }
    let sc = 0;
    for (const n of [12, 15, 18]) {
      let hit = 0;
      for (let i = 0; i < n; i++) {
        let h = 0;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const dx = wrapd(pts[j].x - pts[i].x, W), dy = pts[j].y - pts[i].y;
          if (dy > 12 && dy < 52 && abs(dx) < 6 + 0.12 * dy) h = 1;
        }
        hit += h;
      }
      sc += hit / n;
    }
    if (sc > bestScore) (bestScore = sc), (best = pts);
  }
  return best;
}

function buildMask(S) {
  const chi = S.chi, d = CFG.delta;
  chi.fill(0);
  for (let j = 0; j < S.posts.length; j++) {
    const q = S.posts[j], R = S.R * S.grow[j];
    if (R < 0.9) continue;
    const ext = ceil(R + 4 * d), x0 = floor(q.x), y0 = floor(q.y);
    for (let dy = -ext; dy <= ext; dy++) {
      const yy = y0 + dy;
      if (yy < 0 || yy > HM) continue;
      for (let dx = -ext; dx <= ext; dx++) {
        const xx = (x0 + dx + W * 4) & WM, ry = yy - q.y, rx = x0 + dx - q.x;
        const v = 0.5 * (1 - tanh((sqrt(rx * rx + ry * ry) - R) / d));
        const p = yy * W + xx;
        if (v > chi[p]) chi[p] = v;
      }
    }
  }
}

// ---- the flow ----
function rhs(S, wr, wi, oR, oI, save) {
  const { ar, ai, br, bi } = S, Um = S.Um, Vm = S.Vm;
  for (let p = 0; p < N; p++) {
    const k2 = K2[p];
    if (k2 === 0) {
      ar[p] = ai[p] = 0;
    } else {
      const sr = wr[p] / k2, si = wi[p] / k2;
      ar[p] = KX[p] * sr - KY[p] * si;
      ai[p] = KY[p] * sr + KX[p] * si;
    }
    br[p] = -KX[p] * wi[p] - KY[p] * wr[p];
    bi[p] = KX[p] * wr[p] - KY[p] * wi[p];
  }
  fft2(ar, ai, true);
  fft2(br, bi, true);
  if (save) {
    // the velocity of the start of the step, which the dye is carried by
    let mx = 0.5;
    for (let p = 0; p < N; p++) {
      const a = ar[p] + Um, b = ai[p] + Vm;
      S.U[p] = a;
      S.V[p] = b;
      if (abs(a) > mx) mx = abs(a);
      if (abs(b) > mx) mx = abs(b);
    }
    S.um = mx;
  }
  for (let p = 0; p < N; p++) {
    ar[p] = (ar[p] + Um) * br[p] + (ai[p] + Vm) * bi[p];
    ai[p] = 0;
  }
  fft2(ar, ai, false);
  const inv = 1 / N, nu = S.nu, hy = CFG.hyp, fr = CFG.fric;
  for (let p = 0; p < N; p++) {
    const q = K2[p] / (CFG.fricK * CFG.fricK), d = nu * K2[p] + hy * K2[p] * K2[p] + fr / (1 + q * q);
    oR[p] = -ar[p] * inv * FIL[p] - d * wr[p];
    oI[p] = -ai[p] * inv * FIL[p] - d * wi[p];
  }
}

// Brinkman step: the total velocity times 1 / (1 + dt chi / eta), then back to the vorticity of that field
// (which is the projection: what the curl leaves out is the part a pressure would take away)
function penalize(S, dt) {
  const { wr, wi, ar, ai, chi } = S;
  for (let p = 0; p < N; p++) {
    const k2 = K2[p];
    if (k2 === 0) {
      ar[p] = ai[p] = 0;
    } else {
      const sr = wr[p] / k2, si = wi[p] / k2;
      ar[p] = KX[p] * sr - KY[p] * si;
      ai[p] = KY[p] * sr + KX[p] * si;
    }
  }
  fft2(ar, ai, true);
  const a = dt / CFG.eta, Um = S.Um, Vm = S.Vm, spg = S.spg;
  let su = 0, sv = 0;
  for (let p = 0; p < N; p++) {
    const q = spg[p >> 6] * dt, f = 1 / (1 + q + a * chi[p]), u = (ar[p] + Um + q * Um) * f, v = (ai[p] + Vm + q * Vm) * f;
    ar[p] = u;
    ai[p] = v;
    su += u;
    sv += v;
  }
  S.Um = su / N;
  S.Vm = sv / N;
  fft2(ar, ai, false);
  const inv = 1 / N;
  for (let p = 0; p < N; p++) {
    const q = MIR[p], Pr = ar[p], Pi = ai[p], Qr = ar[q], Qi = ai[q];
    const ur = 0.5 * (Pr + Qr), ui = 0.5 * (Pi - Qi), vr = 0.5 * (Pi + Qi), vi = -0.5 * (Pr - Qr);
    // the transform of the packed pair is read before this loop overwrites it, so go through temporaries
    S.tr[p] = (-KX[p] * vi + KY[p] * ui) * inv * FIL[p];
    S.ti[p] = (KX[p] * vr - KY[p] * ur) * inv * FIL[p];
  }
  wr.set(S.tr);
  wi.set(S.ti);
  wr[0] = wi[0] = 0;
}

// ---- the dye: flux form, second order upwind with the monotonised central limiter ----
const SL = new Float64Array(max(W, H) + 2), FX = new Float64Array(max(W, H) + 2);
const mc = (a, b) => {
  if (a * b <= 0) return 0;
  const s = a > 0 ? 1 : -1, x = abs(a), y = abs(b), z = 0.5 * (x + y);
  return s * min(2 * x, 2 * y, z);
};
function sweepX(R, U, dt) {
  for (let j = 0; j < H; j++) {
    const o = j * W;
    for (let i = 0; i < W; i++) SL[i] = mc(R[o + i] - R[o + ((i - 1) & WM)], R[o + ((i + 1) & WM)] - R[o + i]);
    for (let i = 0; i < W; i++) {
      const ip = (i + 1) & WM, u = 0.5 * (U[o + i] + U[o + ip]), nu = u * dt;
      FX[i] = u > 0 ? u * (R[o + i] + 0.5 * (1 - nu) * SL[i]) : u * (R[o + ip] - 0.5 * (1 + nu) * SL[ip]);
    }
    for (let i = 0; i < W; i++) R[o + i] -= dt * (FX[i] - FX[(i - 1) & WM]);
  }
}
function sweepY(R, V, dt) {
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < H; j++) SL[j] = mc(R[j * W + i] - R[((j - 1) & HM) * W + i], R[((j + 1) & HM) * W + i] - R[j * W + i]);
    for (let j = 0; j < H; j++) {
      const jp = (j + 1) & HM, v = 0.5 * (V[j * W + i] + V[jp * W + i]), nu = v * dt;
      FX[j] = v > 0 ? v * (R[j * W + i] + 0.5 * (1 - nu) * SL[j]) : v * (R[jp * W + i] - 0.5 * (1 + nu) * SL[jp]);
    }
    for (let j = 0; j < H; j++) R[j * W + i] -= dt * (FX[j] - FX[(j - 1) & HM]);
  }
}

// ---- the push, the inlet stripes ----
function ou(x, T, s, dt) {
  const d = exp(-dt / T);
  return x * d + s * sqrt(1 - d * d) * gauss();
}
function drift(S, dt) {
  S.th = ou(S.th, CFG.angT, CFG.angS, dt);
  S.sp = ou(S.sp, CFG.spdT, CFG.spdS, dt);
  const u = CFG.u0 * cl(1 + S.sp, 0.45, 1.6);
  S.Ux = u * sin(S.th + S.lean);
  S.Uy = u * cos(S.th + S.lean);
  for (let i = 0; i < CFG.nStripe; i++) {
    S.sv[i] = ou(S.sv[i], 3.0, 0.2, dt);
    S.sj[i] = ou(S.sj[i], 6.0, 0.3, dt);
  }
}
function stripes(S) {
  const n = CFG.nStripe, sp = W / n, ca = S.c0a, cb = S.c0b, sg = CFG.stripeS;
  ca.fill(0);
  cb.fill(0);
  for (let i = 0; i < n; i++) {
    const xc = (i + 0.5) * sp + S.sj[i], v = cl(0.72 + S.sv[i], 0.2, 1), dst = i % 2 ? cb : ca;
    for (let k = -5; k <= 5; k++) {
      const x = floor(xc) + k, d = x - xc;
      dst[(x + W * 4) & WM] += v * exp(-(d * d) / (2 * sg * sg));
    }
  }
  for (let x = 0; x < W; x++) (ca[x] = min(ca[x], 1)), (cb[x] = min(cb[x], 1));
}

function step(S, dt) {
  const { wr, wi, k1r, k1i, k2r, k2i, tr, ti } = S;
  // Shu and Osher's third order scheme
  rhs(S, wr, wi, k1r, k1i, true);
  for (let p = 0; p < N; p++) (tr[p] = wr[p] + dt * k1r[p]), (ti[p] = wi[p] + dt * k1i[p]);
  rhs(S, tr, ti, k2r, k2i);
  for (let p = 0; p < N; p++) (tr[p] = 0.75 * wr[p] + 0.25 * (tr[p] + dt * k2r[p])), (ti[p] = 0.75 * wi[p] + 0.25 * (ti[p] + dt * k2i[p]));
  rhs(S, tr, ti, k2r, k2i);
  for (let p = 0; p < N; p++) (wr[p] = (wr[p] + 2 * (tr[p] + dt * k2r[p])) / 3), (wi[p] = (wi[p] + 2 * (ti[p] + dt * k2i[p])) / 3);
  // the dye goes with the velocity at the start of the step
  const n = max(1, ceil((S.um * dt) / CFG.cfl)), ds = dt / n;
  for (let i = 0; i < n; i++)
    for (const c of [S.ca, S.cb]) {
      sweepX(c, S.U, 0.5 * ds);
      sweepY(c, S.V, ds);
      sweepX(c, S.U, 0.5 * ds);
    }
  penalize(S, dt);
  // the push: the mean velocity is pulled to its target
  const a = dt / CFG.tauU;
  S.Um += a * (S.Ux - S.Um);
  S.Vm += a * (S.Uy - S.Vm);
  // dye: stripes let in at the top, taken out at the bottom, no dye in a post, a little diffusion
  const cd = CFG.cdiff * dt, t = S.t2, ch = S.chi;
  for (let d = 0; d < 2; d++) {
    const c = d ? S.cb : S.ca, c0 = d ? S.c0b : S.c0a;
    for (let j = 0; j < H; j++) {
      const o = j * W, up = ((j - 1) & HM) * W, dn = ((j + 1) & HM) * W, ri = S.rin[j], ro = S.rout[j];
      for (let i = 0; i < W; i++) {
        const p = o + i;
        let v = c[p] + cd * (c[o + ((i - 1) & WM)] + c[o + ((i + 1) & WM)] + c[up + i] + c[dn + i] - 4 * c[p]);
        if (ri > 0) v += min(1, ri * dt) * (c0[i] - v);
        if (ro > 0) v -= min(1, ro * dt) * v;
        const cx = ch[p];
        t[p] = cx > 0.55 ? v / (1 + 40 * dt * (cx - 0.55) / 0.45) : v;
      }
    }
    c.set(t);
  }
}

const radOf = (v) => 2.9 * pow(1.2, cl(v, -1.2, 1.2));
const cntOf = (v) => 15 - 3 * cl(v, -1.2, 1.2);

function start(params, k) {
  const mk = () => new Float64Array(N);
  const S = {
    wr: mk(), wi: mk(), ar: mk(), ai: mk(), br: mk(), bi: mk(), k1r: mk(), k1i: mk(), k2r: mk(), k2i: mk(), tr: mk(), ti: mk(),
    U: mk(), V: mk(), ca: mk(), cb: mk(), t2: mk(), chi: mk(), om: new Float32Array(N), os: 0, c0a: new Float64Array(W), c0b: new Float64Array(W),
    rin: new Float64Array(H), spg: new Float64Array(H), rout: new Float64Array(H), sv: new Float64Array(CFG.nStripe), sj: new Float64Array(CFG.nStripe),
    um: 0, Um: 0, Vm: CFG.u0, Ux: 0, Uy: CFG.u0, th: 0, sp: 0,
    nu: (CFG.u0 * CFG.d0) / CFG.re0, lean: cl(k[3], -1.2, 1.2) * CFG.lean, R: radOf(k[2]), cnt: cntOf(k[2]), grow: new Float64Array(18), posts: null, hue: 0, lutHue: -9, col: null, acc: 0, ready: false,
  };
  params.s = S;
  S.posts = makeLayout();
  for (let y = 0; y < H; y++) {
    if (y < CFG.yin) S.rin[y] = CFG.rin * 0.5 * (1 + cos((PI * y) / CFG.yin));
    if (y < CFG.ysp) S.spg[y] = CFG.spg * 0.5 * (1 + cos((PI * y) / CFG.ysp));
    const e = y - (H - CFG.yout);
    if (e >= 0) S.rout[y] = CFG.rout * 0.5 * (1 - cos((PI * (e + 0.5)) / CFG.yout));
  }
  for (let i = 0; i < CFG.nStripe; i++) (S.sv[i] = gauss() * 0.2), (S.sj[i] = gauss() * 0.3);
  S.th = gauss() * CFG.angS;
  S.sp = gauss() * CFG.spdS;
  drift(S, 0);
  S.Um = S.Ux;
  S.Vm = S.Uy;
  for (let j = 0; j < 18; j++) S.grow[j] = cl(S.cnt - j, 0, 1);
  buildMask(S);
  // a little vorticity at the scale of the wakes to start the first eddies
  for (let p = 1; p < N; p++) {
    const kk = sqrt(K2[p]);
    if (kk > 0.12 && kk < 0.9 && p < MIR[p]) {
      const gr = 0.02 * gauss(), gi = 0.02 * gauss();
      S.wr[p] = gr;
      S.wi[p] = gi;
      S.wr[MIR[p]] = gr;
      S.wi[MIR[p]] = -gi;
    }
  }
  stripes(S);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) (S.ca[j * W + i] = j < H - CFG.yout ? S.c0a[i] : 0), (S.cb[j * W + i] = j < H - CFG.yout ? S.c0b[i] : 0);
  S.um = CFG.u0;
  for (let t = 0; t < CFG.pre; ) {
    const h = S.um * 1.8 * CFG.dt > 1.4 ? 0.5 * CFG.dt : CFG.dt;
    drift(S, h);
    stripes(S);
    step(S, h);
    t += h;
  }
  S.ready = true;
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.1, 8);
  S.hue = cl(k[0], 0, 1);
  const f = 1 - exp(-ft / 0.5);
  S.lean += (cl(k[3], -1.2, 1.2) * CFG.lean - S.lean) * f;
  const Rt = radOf(k[2]), nt = cntOf(k[2]);
  S.R += (Rt - S.R) * f;
  S.cnt += (nt - S.cnt) * f;
  let ch = false;
  for (let j = 0; j < 18; j++) {
    const g = S.grow[j], tg = cl(S.cnt - j, 0, 1), ng = g + (tg - g) * f;
    if (abs(ng - g) > 1e-4 || tg !== g) ch = true;
    S.grow[j] = ng;
  }
  if (ch || abs(Rt - S.R) > 1e-3) buildMask(S);
  S.acc += ft * flow;
  let steps = 0;
  while (steps < 24) {
    // half a step when the fastest water would cross more than 1.4 / 1.8 of a cell, the limit of the scheme in time
    const h = S.um * 1.8 * CFG.dt > 1.4 ? 0.5 * CFG.dt : CFG.dt;
    if (S.acc < h) break;
    drift(S, h);
    stripes(S);
    step(S, h);
    S.acc -= h;
    steps++;
  }
  if (steps === 24) S.acc = min(S.acc, CFG.dt);
  S.ar.set(S.wr);
  S.ai.set(S.wi);
  fft2(S.ar, S.ai, true);
  let e = 0;
  for (let p = 0; p < N; p++) e += S.ar[p] * S.ar[p];
  S.os = S.os ? S.os + (sqrt(e / N) - S.os) * 0.05 : sqrt(e / N);
  for (let p = 0; p < N; p++) S.om[p] = S.ar[p];
  const chk = S.wr[1] + S.ca[N >> 1] + S.cb[N >> 1] + S.Um;
  if (!isFinite(chk) || S.um > 40) start(params, k);
}

// ---- colour: a ground and two dyes that add, with a soft shoulder ----
const GROUND = [36, 32, 44], DYE_A = [255, 80, 66], DYE_B = [255, 212, 90], POST = [10, 8, 12], RIM = [150, 118, 64], TINT = [18, 6, -8];
function setColors(S, hue) {
  const a = hue * TAU, c = cos(a), s = sin(a), k1 = (1 - c) / 3, k2 = sqrt(1 / 3) * s;
  const m = [c + k1, k1 - k2, k1 + k2, k1 + k2, c + k1, k1 - k2, k1 - k2, k1 + k2, c + k1];
  const rot = (v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  S.col = [rot(GROUND), rot(DYE_A), rot(DYE_B), rot(POST), rot(RIM), rot(TINT)];
}
const EASE = new Float32Array(1025);
for (let i = 0; i <= 1024; i++) EASE[i] = pow(1 - exp(-(i / 1024) * 1.25 / 0.34), 1.8);
const ease = (c) => (c <= 0 ? 0 : EASE[min(1024, (c * 819.2) | 0)]);
const shoulder = (v) => (v < 0 ? 0 : v < 170 ? v : 170 + 85 * tanh((v - 170) / 85));

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.lutHue !== S.hue) (S.lutHue = S.hue), setColors(S, S.hue);
  const { ca, cb, chi, col } = S, il = 1.5 / max(1e-6, S.os), [G, A, B, P, R, T] = col;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const x2 = chi[p], z = S.om[p] * il, w = (z / (1 + (z < 0 ? -z : z))) * (1 - x2), sh = 1 + 0.3 * w, a = ease(ca[p]), b = ease(cb[p]);
      let r = (G[0] + T[0] * w + A[0] * a + B[0] * b) * sh, g = (G[1] + T[1] * w + A[1] * a + B[1] * b) * sh, bl = (G[2] + T[2] * w + A[2] * a + B[2] * b) * sh;
      r = shoulder(r);
      g = shoulder(g);
      bl = shoulder(bl);
      if (x2 > 0.01) {
        const rim = 2.4 * x2 * (1 - x2), d = cl((x2 - 0.3) / 0.6, 0, 1);
        r = r * (1 - d) + P[0] * d + R[0] * rim;
        g = g * (1 - d) + P[1] * d + R[1] * rim;
        bl = bl * (1 - d) + P[2] * d + R[2] * rim;
      }
      display.setPixel(x, y, cl(r, 0, 255), cl(g, 0, 255), cl(bl, 0, 255));
    }
}
