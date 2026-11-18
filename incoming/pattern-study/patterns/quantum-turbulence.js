// ===== Patternflow pattern =====
// Title:   Quantum Turbulence
// Family:  physics
// Idea:    A two-dimensional superfluid, the Gross-Pitaevskii equation solved by split-step Fourier on the panel's own 64 by 128 torus, is stirred by four wandering laser spots that shed vortex dipoles once they move faster than about 0.45 times the speed of sound, and its phase is drawn as hue and its density as brightness, so each quantised vortex is a dark core round which every hue turns once, dipoles swim off, meet and annihilate, faint arcs of sound ring out from the spots, and the panel keeps boiling with vortices of both signs for as long as it runs.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Gross-Pitaevskii equation for a weakly interacting Bose gas (Eugene Gross, 1961, and Lev Pitaevskii, 1961, from memory), i psi_t = [-1/2 del^2 + V + g |psi|^2 - mu] psi with hbar = m = 1; vortex dipoles shed by an obstacle that moves through a superfluid faster than a critical speed (Thomas Frisch, Yves Pomeau and Sergio Rica, 1992, from memory); the phenomenological damping (1 - i gamma) on the whole generator (Makoto Tsubota, Kenichi Kasamatsu and Masahito Ueda, 2002, from memory); split-step Fourier integration (Richard Hardin and Frederick Tappert, 1973, from memory) with the two-thirds rule for a cubic term (Steven Orszag, 1971, from memory)
// Round:   115
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Stir=1.6..2.8, Scale=-0.5..1, Damping=0.035..0.1
//
// Knob 1: Hue. Turns the colour ramp the phase is drawn on, and one full turn comes back to where it began. At 0 phase zero is peach, and as the phase grows the colour runs peach, rose, violet, indigo, azure, cyan, mint, pale gold. The ramp is a curve in Oklab through indigo, cyan, pale gold and magenta, from lightness 0.50 to 0.92, kept far enough inside the gamut that the panel's 1.62 saturation lift clips no channel; the dark side of a ripple is drawn toward indigo rather than darkened. On top of the knob the whole ramp drifts forward by 0.04 of a turn a second on average (between 0.005 and 0.075), one turn in 25 s, and the phase is read against a reference wave of 1.1 turns of colour across 64 LEDs whose heading swings by up to 1.5 radians either way over minutes.
// Knob 2: Stir. How fast the four laser spots are dragged through the fluid. Their mean speed is 3.6 LEDs a second times Stir, 5.8 at 1.6, 7.2 at 2 and 10.1 at 2.8, which is 0.52, 0.65 and 0.92 of the speed of sound (11 LEDs a second), and each spot's speed swings between 0.5 and 1.5 of that. Measured over 300 s with the other knobs at the opening, the panel holds a mean of 17 vortices at 1.6, 24 at 2 and 30 at 2.8, and the density in the bulk is rougher the harder the stirring (standard deviation 0.14, 0.16 and 0.21 of the mean).
// Knob 3: Scale. The healing length xi = 1.5 LEDs times 1.6 to the Scale: 1.2 at -0.5, 1.5 at the opening 0, 2.4 at 1. A core is 3.6, 4.5 and 7.0 LEDs across at half the bulk density, and the spots, whose Gaussians have sigma 1.5 xi, grow with it. The clock follows xi so the speed of sound stays 11 LEDs a second, and the mean vortex count is 24, 24 and 17. A change eases in over 0.3 s.
// Knob 4: Damping. The gamma of the (1 - i gamma) damping. Mean vortices on the panel are 29 at 0.035, 24 at the opening 0.06 and 15 at 0.1, and the density in the bulk is rougher the less damping there is (standard deviation 0.20, 0.16 and 0.13), so at 0.035 the ripples run longer and the surface is busier.

// What the field is. psi(x, y, t) on a 64 by 128 torus, with mean density n = 1. Lengths are LEDs. The healing length xi = 1 / sqrt(2 g n) fixes g,
// and the speed of sound is c = sqrt(g n). One panel second is a number of model time units picked so that c is 11 LEDs a second at every xi, which
// holds the sound's pace on the panel while Scale changes the grain. Each step is a free flight in k space, exp(-i (1 - i gamma) dt k^2 / 2), then a
// kick in x, exp(-i (1 - i gamma) dt (V + g |psi|^2 - mu)), twice a frame. The k-space factor drops every mode beyond a circle of radius 2 pi / 3, the
// two-thirds rule that keeps the cubic term from aliasing. After each step psi is scaled back to mean density 1, and mu is re-measured as the mean of
// kinetic + V + g |psi|^2 per unit of mass, so the global phase does not turn and the damping does not change the norm to first order.
//
// What was checked, with the file's own step:
// - Norm. With gamma = 0 and the mask off the norm holds to 5e-14 over 1800 steps with four spots running. With the mask on, the modes it drops are
//   the only loss; the restoring factor at gamma 0.06 is 3.5e-6 a step.
// - Sound. A 2 per cent density ripple of wavelength 128 LEDs rings at 0.5407 rad/s at xi = 1.5 and 0.5418 at 2.4, the Bogoliubov value
//   omega = sqrt(g k^2 + k^4 / 4) to four digits, a phase speed of 11.01 and 11.04 LEDs a second against the designed 11.00. At wavelength 32 it is
//   0.9996 and 0.9999 of the Bogoliubov value.
// - Core. The exact vortex solves f'' + f'/r - f/r^2 + f - f^3 = 0 in units of xi, f = 0.583 r near the middle, and reaches half the bulk density at
//   1.555 xi. Cores taken from a dipole 44 LEDs apart with its periodic images, relaxed for 1 s at gamma 0.3, the nearest a torus comes to one vortex,
//   reach it at 1.48 xi (xi = 1.2), 1.50 xi (1.5) and 1.47 xi (2.4), 4 to 6 per cent narrower.
// - Critical speed. A spot with sigma 1.5 xi and height 3 mu, dragged through still fluid for 14 s at steps of 0.04 c, first sheds a dipole between
//   0.44 c and 0.48 c at xi = 1.5 and between 0.40 c and 0.44 c at xi = 2.4. Frisch, Pomeau and Rica's figure for a large cylinder, about 0.4 c,
//   is from memory.
// - Time step. Against a run at dt / 32, the state after 3 s differs by 8.7e-3 (relative, global phase removed) at the shipped dt, 4.2e-3 at dt / 2 and
//   2.0e-3 at dt / 4, with the same vortex count at every dt. That is first order. The shown state sits half a kick ahead of the Strang state, and a
//   spot's potential is read at the end of the step; with no spots, no damping and no mask the splitting alone falls by 4.05 and 4.20 a halving.
// - Staying alive. Vortices counted every second over 900 s, mean and range: 23.8 (12 to 38) at the opening, 26.4 (12 to 40) with every knob at its
//   minimum, 18.5 (4 to 30) at its maximum, 25.4, 25.1 and 12.3 (2 to 22) at three random places, and 9.3 (2 to 16) and 47.8 (30 to 66) at the
//   two corners that are furthest apart (Stir 1.6, Scale 1, Damping 0.1 and Stir 2.8, Scale -0.5, Damping 0.035). The thirds of each run differ
//   by at most 2.4 vortices. Frame cost in Node is 1.7 ms to step and 0.25 ms to draw; the first frame takes 0.3 s, for the 84 frames run before it.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, atan2, exp, min, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- radix-2 FFT ----------------------------------------------------------------------------
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
const PX = plan(W), PY = plan(H);
const TR = new Float64Array(H), TI = new Float64Array(H);

// In place on re[o .. o+n), im[o .. o+n). The forward transform is e^(-i k x); inv flips the sign and leaves the 1/n to the caller.
function fft(p, re, im, o, inv) {
  const { n, rev, c, s } = p, sg = inv ? -1 : 1;
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
function fft2(re, im, inv) {
  for (let y = 0; y < H; y++) fft(PX, re, im, y * W, inv);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) (TR[y] = re[y * W + x]), (TI[y] = im[y * W + x]);
    fft(PY, TR, TI, 0, inv);
    for (let y = 0; y < H; y++) (re[y * W + x] = TR[y]), (im[y * W + x] = TI[y]);
  }
}

// ---- the fluid ------------------------------------------------------------------------------
const CS = 11; // speed of sound, LEDs per second, at every Scale
const NS = 2; // split steps per frame
const DTP = 1 / (30 * NS); // panel seconds per step
const KC = TAU / 3; // radius of the circle of k kept
const NSP = 4; // laser spots
const SPEED = 3.6; // mean spot speed per unit of Stir, LEDs a second
const XI0 = 1.5; // healing length at Scale 0, LEDs
const SW = 1.5, SV = 3, SPULSE = 0.35; // spot width in xi, height in mu, and the swing of its height
const OPEN = [0, 2, 0, 0.06];

// The spots: the heading is 2.2 sin + 1.3 sin and the speed 1 + 0.3 sin + 0.2 sin, each sine at its own rate in rad/s, and the height swings on one
// more. The 20 rates were searched so that no two come near a ratio of small integers (the closest pair is 0.1 per cent off p/q with q up to 12, a
// beat of days). The phases are drawn at the start. A spot that leaves one side comes in on the other.
const SPH = [[0.0701, 0.116], [0.0932, 0.082], [0.1166, 0.0758], [0.0989, 0.0665]];
const SPS = [[0.2157, 0.2053], [0.2618, 0.2756], [0.2409, 0.2702], [0.2863, 0.2819]];
const SPV = [3.233, 2.987, 3.974, 3.2];

function setup(params) {
  const S = {
    t: 0, acc: 0, xi: XI0, xt: XI0, g: 0, mu: 0, gam: 0.06, dt: 0, kdt: 0, kgam: -1, nrm: 1, me: 0, hd: 0, U: 7, warm: false, hue: 0,
    re: new Float64Array(N), im: new Float64Array(N), V: new Float64Array(N), RR: new Float32Array(N),
    Kr: new Float64Array(N), Ki: new Float64Array(N), K2: new Float64Array(N),
    sx: new Float64Array(NSP), sy: new Float64Array(NSP), ph: new Float64Array(NSP * 4), cph: [Math.random() * TAU, Math.random() * TAU],
    gx: new Float64Array(64), gy: new Float64Array(64),
  };
  for (let i = 0; i < S.ph.length; i++) S.ph[i] = Math.random() * TAU;
  for (let i = 0; i < NSP; i++) (S.sx[i] = Math.random() * W), (S.sy[i] = Math.random() * H);
  params.s = S;
  return S;
}

// Everything that depends on the healing length and the damping: g, the step, the k-space factor.
function constants(S) {
  const xi = S.xi;
  S.g = 1 / (2 * xi * xi);
  S.mu = S.g;
  if (!S.me) S.me = S.g;
  S.dt = (CS * sqrt(2) * xi) / 30 / NS; // model time per step, so that c is CS LEDs a panel second
  if (S.dt === S.kdt && S.gam === S.kgam) return;
  S.kdt = S.dt;
  S.kgam = S.gam;
  for (let y = 0; y < H; y++) {
    const ny = y < H / 2 ? y : y - H, ky = (TAU * ny) / H;
    for (let x = 0; x < W; x++) {
      const nx = x < W / 2 ? x : x - W, kx = (TAU * nx) / W, k2 = kx * kx + ky * ky, p = y * W + x;
      S.K2[p] = k2;
      if (k2 > KC * KC) {
        S.Kr[p] = 0;
        S.Ki[p] = 0;
      } else {
        const th = 0.5 * S.dt * k2, d = exp(-S.gam * th);
        S.Kr[p] = d * cos(th);
        S.Ki[p] = -d * sin(th);
      }
    }
  }
}

// One step: free flight in k space, then the kick of the potential and of g |psi|^2.
function step(S) {
  const { re, im, V, Kr, Ki, K2 } = S;
  fft2(re, im, false);
  const n0 = S.nrm, sc = n0 / N;
  let tk = 0;
  for (let p = 0; p < N; p++) {
    const a = re[p], b = im[p], kr = Kr[p] * sc, ki = Ki[p] * sc;
    tk += K2[p] * (a * a + b * b);
    re[p] = a * kr - b * ki;
    im[p] = a * ki + b * kr;
  }
  fft2(re, im, true);
  const g = S.g, me = S.me, dt = S.dt, gd = S.gam * dt;
  let sum = 0, sv = 0, sg = 0;
  for (let p = 0; p < N; p++) {
    const a = re[p], b = im[p], r = a * a + b * b, U = V[p] + g * r - me, th = dt * U, c = cos(th), s = sin(th), f = 1 - gd * U;
    const na = f * (a * c + b * s), nb = f * (b * c - a * s);
    re[p] = na;
    im[p] = nb;
    sum += na * na + nb * nb;
    sv += V[p] * r;
    sg += r * r;
  }
  S.nrm = sqrt(N / sum);
  // mu for the next step, the mean per unit of mass of kinetic + V + g rho
  S.me = (0.5 * tk * n0 * n0 / N + sv + g * sg) / sum;
}

// Move the spots by h seconds and lay their Gaussians into V, which wraps round the torus.
function spots(S, h) {
  const V = S.V, w = SW * S.xi, v0 = SV * S.mu, t = S.t, gx = S.gx, gy = S.gy, q = S.ph, R = Math.ceil(3.2 * w);
  V.fill(0);
  for (let i = 0; i < NSP; i++) {
    const a = SPH[i], b = SPS[i], o = i * 4;
    const th = i * 2.1 + 2.2 * sin(a[0] * t + q[o]) + 1.3 * sin(a[1] * t + q[o + 1]);
    const sp = S.U * (1 + 0.3 * sin(b[0] * t + q[o + 2]) + 0.2 * sin(b[1] * t + q[o + 3]));
    S.sx[i] = (S.sx[i] + sp * cos(th) * h + W) % W;
    S.sy[i] = (S.sy[i] + sp * sin(th) * h + H) % H;
    const amp = v0 * (1 + SPULSE * sin(SPV[i] * t + q[o]));
    const cx = floor(S.sx[i]), cy = floor(S.sy[i]);
    for (let d = -R; d <= R; d++) {
      const dx = cx + d - S.sx[i], dy = cy + d - S.sy[i];
      gx[d + R] = exp(-(dx * dx) / (2 * w * w));
      gy[d + R] = exp(-(dy * dy) / (2 * w * w));
    }
    for (let dy = -R; dy <= R; dy++) {
      const y = (cy + dy + H) % H;
      for (let dx = -R; dx <= R; dx++) {
        const x = (cx + dx + W) % W;
        V[y * W + x] += amp * gx[dx + R] * gy[dy + R];
      }
    }
  }
}

// The first frame has to be full of vortices already. About 13 dipoles at xi = 1.5, each 6 to 14 LEDs across at a random angle, are written in as
// the phase of a plane vortex and its eight periodic images with a core of f^2 = r^2 / (r^2 + 2 xi^2), and the first few frames run at gamma 0.4 to heal them.
function imprint(S) {
  const xi = S.xi, vs = [], nd = Math.round(13 * (XI0 / xi) * (XI0 / xi));
  for (let d = 0; d < nd; d++) {
    const cx = Math.random() * W, cy = Math.random() * H, an = Math.random() * TAU, sep = 6 + 8 * Math.random(), sg = Math.random() < 0.5 ? 1 : -1;
    vs.push([cx + 0.5 * sep * cos(an), cy + 0.5 * sep * sin(an), sg], [cx - 0.5 * sep * cos(an), cy - 0.5 * sep * sin(an), -sg]);
  }
  let sum = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let ph = 0, rho = 1;
      for (const [vx, vy, sg] of vs) {
        for (let my = -1; my <= 1; my++)
          for (let mx = -1; mx <= 1; mx++) ph += sg * atan2(y - vy - my * H, x - vx - mx * W);
        let dx = x - vx, dy = y - vy;
        dx -= W * Math.round(dx / W);
        dy -= H * Math.round(dy / H);
        const r2 = dx * dx + dy * dy;
        rho *= r2 / (r2 + 2 * xi * xi);
      }
      const p = y * W + x, a = sqrt(rho);
      S.re[p] = a * cos(ph);
      S.im[p] = a * sin(ph);
      sum += rho;
    }
  const s = sqrt(N / sum);
  for (let p = 0; p < N; p++) (S.re[p] *= s), (S.im[p] *= s);
  S.nrm = 1;
}

// One panel frame of ft seconds with the knobs in k. The steps are fixed, so a slow frame runs more of them (at most 8 steps of 1/60 s).
function advance(S, ft, k) {
  S.hue = cl(k[0], 0, 1);
  S.U = SPEED * cl(k[1], 0.2, 5);
  S.xt = XI0 * pow(1.6, cl(k[2], -1, 1));
  S.gam = cl(k[3], 0, 0.5);
  S.xi += (S.xt - S.xi) * (1 - exp(-ft / 0.3));
  constants(S);
  S.hd += ft * (0.04 + 0.02 * sin(0.0731 * S.t) + 0.015 * sin(0.1913 * S.t + 1));
  S.acc = min(S.acc + ft + 1e-9, 8 * DTP);
  while (S.acc >= DTP) {
    S.acc -= DTP;
    S.t += DTP;
    spots(S, DTP);
    step(S);
  }
}

// ---- colour ---------------------------------------------------------------------------------
// A cyclic ramp in Oklab (Bjorn Ottosson, 2020), three-quarters of the way round through four stops, each [lightness, chroma, hue in degrees]: indigo, cyan,
// pale gold, magenta, at 0, 0.15, 0.42 and 0.72 of the cycle, joined by a Catmull-Rom curve. Lightness runs from 0.50 to 0.92, so neighbouring hues differ in
// brightness too. The second axis is the shadow: the colour is drawn toward a deep indigo, [0.20, 0.08, 275], by the relief, not dimmed where it stands, so
// gold does not go brown. Chroma is pulled in until the colour fits sRGB after the panel's 1.62 saturation lift, which keeps the lift from clipping a channel.
const STOPS = [[0.5, 0.19, 272], [0.8, 0.13, 215], [0.92, 0.1, 95], [0.68, 0.21, 345]], POS = [0, 0.15, 0.42, 0.72, 1], SHADOW = [0.2, 0.08, 275];
const PU = 512, PS = 24;
function oklab2rgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const e = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
  return [e(r), e(g), e(bb)];
}
function fit(L, a, b) {
  for (let k = 0; k < 40; k++) {
    const c = oklab2rgb(L, a, b), y = (c[0] * 77 + c[1] * 150 + c[2] * 29) / 256;
    if (c.every((v) => v >= 0 && v <= 1 && y + (v - y) * 1.62 >= -0.01 && y + (v - y) * 1.62 <= 1.01)) return c;
    a *= 0.96;
    b *= 0.96;
  }
  return oklab2rgb(L, a, b).map((v) => cl(v, 0, 1));
}
// PAL[(shadow level * PU + place on the ramp) * 3]: 23 is lit, 0 is all the way to indigo, and the shadow comes in as the square of the distance from lit.
const PAL = new Float32Array(PU * PS * 3);
{
  const lab = STOPS.map(([L, C, h]) => [L, C * cos((h * PI) / 180), C * sin((h * PI) / 180)]), n = lab.length;
  const sh = [SHADOW[0], SHADOW[1] * cos((SHADOW[2] * PI) / 180), SHADOW[1] * sin((SHADOW[2] * PI) / 180)];
  for (let ui = 0; ui < PU; ui++) {
    let j = 0;
    while (ui / PU >= POS[j + 1]) j++;
    const q = j + (ui / PU - POS[j]) / (POS[j + 1] - POS[j]), i = floor(q), f = q - i, P = [0, 0, 0];
    const p0 = lab[(i + n - 1) % n], p1 = lab[i % n], p2 = lab[(i + 1) % n], p3 = lab[(i + 2) % n];
    for (let k = 0; k < 3; k++) {
      const m1 = 0.5 * (p2[k] - p0[k]), m2 = 0.5 * (p3[k] - p1[k]);
      P[k] = (2 * f * f * f - 3 * f * f + 1) * p1[k] + (f * f * f - 2 * f * f + f) * m1 + (-2 * f * f * f + 3 * f * f) * p2[k] + (f * f * f - f * f) * m2;
    }
    for (let si = 0; si < PS; si++) {
      const w = (1 - si / (PS - 1)) ** 2, c = fit(P[0] + (sh[0] - P[0]) * w, P[1] + (sh[1] - P[1]) * w, P[2] + (sh[2] - P[2]) * w), o = (si * PU + ui) * 3;
      PAL[o] = c[0];
      PAL[o + 1] = c[1];
      PAL[o + 2] = c[2];
    }
  }
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  if (!S.warm) {
    // 14 frames at gamma 0.4 heal the imprinted cores, then 70 frames of stirring, 3 s of panel time, run before the first frame is shown (about 0.3 s)
    S.warm = true;
    S.xi = S.xt = XI0 * pow(1.6, cl(k[2], -1, 1));
    imprint(S);
    constants(S);
    for (let i = 0; i < 14; i++) advance(S, 1 / 30, [k[0], k[1], k[2], 0.4]);
    for (let i = 0; i < 70; i++) advance(S, 1 / 30, k);
  }
  advance(S, cl(dt || 0, 0, 0.1), k);
}

// Phase is the place on the colour ramp, read against a reference wave tilted across the panel, as an interferometer reads a condensate; the wave's heading
// turns slowly, and it gives a calm stretch of fluid a slow band of colour to be seen through. Density is the brightness, 0 under 0.03 of the bulk and full
// from 0.5, so a core is dark and sharp. The density's slope is a light relief on top of that, lit from the lower right: it is what shows the sound, and it
// gives the jet between two vortices a dark side. Its dark side is drawn toward indigo, and it only bites where the slope is steep, so a flat sea stays lit.
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  const { re, im, RR } = S, h0 = S.hue + 0.55 + S.hd;
  const ga = 0.9 * sin(0.0213 * S.t + S.cph[0]) + 0.6 * sin(0.0517 * S.t + S.cph[1]), gm = 1.1, gx = (gm * cos(ga)) / 64, gy = (gm * sin(ga)) / 64;
  for (let q = 0; q < N; q++) RR[q] = re[q] * re[q] + im[q] * im[q];
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      let hu = atan2(im[p], re[p]) / TAU + h0 + gx * (x - 31.5) + gy * (y - 63.5);
      hu -= floor(hu);
      let v = cl((RR[p] - 0.03) / 0.47, 0, 1);
      v *= v * (3 - 2 * v);
      const xp = y * W + (x + 1) % W, xm = y * W + (x + W - 1) % W, yp = ((y + 1) % H) * W + x, ym = ((y + H - 1) % H) * W + x;
      const lit = cl((cl(0.9 + 3 * (RR[xm] - RR[xp] + RR[ym] - RR[yp]), 0.25, 1) - 0.25) / 0.75, 0, 1);
      const o = (((lit * (PS - 1) + 0.5) | 0) * PU + (((hu * PU) | 0) & (PU - 1))) * 3;
      v *= 255;
      display.setPixel(x, y, v * PAL[o], v * PAL[o + 1], v * PAL[o + 2]);
    }
}
