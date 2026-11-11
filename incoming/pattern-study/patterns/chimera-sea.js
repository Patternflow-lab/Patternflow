// ===== Patternflow pattern =====
// Title:   Chimera Sea
// Family:  rhythm
// Idea:    Every LED is the same phase oscillator, pulled by all the LEDs within a radius with a phase lag a little short of a quarter turn, so the sheet splits by itself into islands that move in step, drawn as smooth glowing colour, and a sea whose phases scatter, drawn as dim speckle, and the islands drift, spiral, merge and dissolve for as long as it runs.
// Author:  patternflow-lab
// Date:    2026-11-11
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: chimera states in a sheet of identical phase oscillators with nonlocal coupling and a phase lag: Yoshiki Kuramoto and Dorjsuren Battogtokh (2002) for the first chimera, Daniel Abrams and Steven Strogatz (2004) for the name, Hidetsugu Sakaguchi and Yoshiki Kuramoto (1986) for the phase-lagged coupling, Shima and Kuramoto (2004) and Erik Martens, Carlo Laing and Steven Strogatz (2010) for the spiral waves with an incoherent core in two dimensions; all from memory
// Round:   128
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.8..3, Scale=-1..1, Lag=-1..1
//
// Knob 1: Hue. Turns a colour ramp round the wheel. The ramp stays inside an arc 0.3 of the wheel wide and is a closed loop in phase, so there is no seam where the phase wraps. At 0 the phase runs violet, bright blue, cyan, dim blue and back to violet; at 0.5 the same loop runs from red through orange and yellow to green and back.
// Knob 2: Speed. The equation runs 2 of its time units a panel second times Speed: 1.6 at 0.8, 4 at the opening 2 and 6 at 3. A scattered LED turns once round the ramp every 6.35 time units, so every 4.0 s at 0.8, every 1.6 s at the opening and every 1.1 s at 3, while an island that moves in step stands still in colour, because the colours are drawn in the frame that turns with it. TIMING
// Knob 3: Scale. The coupling radius R = 8 exp(0.4 Scale) LEDs: 5.4 at -1, 8 at the opening 0, 11.9 at 1. It sets how big the islands are. At the opening lag the patches where |Z| is above 0.6 and cover at least 12 LEDs are on average 12.8 LEDs across at -1 (about 12 of them on the panel at once), 19.9 at 0 (5 or 6) and 25.0 at 1 (3). A change eases in over 0.3 s.
// Knob 4: Lag. The lag beta = pi/2 - alpha = 0.145 exp(0.5 Lag) radians: 0.088 at -1, 0.149 at the opening 0.06, 0.239 at 1. It sets how much of the panel moves in step. The share of LEDs with |Z| above 0.6 is 6% at -1, 21% at the opening and 39% at 1, where the islands join into one network with ring-shaped incoherent cores. The knob stops at 0.239 because the sheet does not stay a chimera much beyond: at R = 14 with beta 0.3, and at R = 12 with beta 0.35, two of two starts fell into one state in step. A change eases in over 0.3 s.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, atan2, exp, max, abs, PI } = Math;
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

// What the sheet is. A phase theta on every LED of the panel's own 64 by 128 torus, the same law for all of them, each pulled by every LED within a
// radius R, a disc that is 1 inside and falls to 0 across the last LED and is normalised to sum to 1, with a lag alpha in the pull:
//   d theta / dt = omega - sum_x' G(x - x') sin(theta(x) - theta(x') + alpha) = omega - Im(e^{i (theta + alpha)} conj(Z)),   Z = G * e^{i theta},
// and alpha = pi/2 - beta. Z is the local order parameter. |Z| is 1 where the neighbours agree and about sqrt(pi)/2 / sqrt(n) where their phases
// are random, 0.06 at R = 8, where n = 1 / sum G^2 = 210 LEDs. The sum is a convolution on a torus, so it is two complex FFTs a stage
// (radix-2 transforms for 64 and 128, as in Plate Turbulence and Quantum Turbulence) against the transform of G, which is real because G is even.
// A lag short of a quarter turn
// (alpha below pi/2, beta above 0) makes the state in step stable, and makes the state of scattered phases stable too, and they live side by side.
// omega = cos beta = sin alpha, so the state in step turns at omega - sin alpha = 0: the frame stands still with the islands, and a scattered
// LED turns at about omega = 0.99 radians a time unit. The sheet starts from smooth random waves under noise and is run 72 time units before
// the first frame (0.4 s in Node); the islands are made by then and the state has no memory of its start.
//
// The time stepping is Heun's (RK2) with a step of at most 0.3 time units, so a frame is one step (2 FFT pairs) at every Speed.
// What was checked, with the file's own code:
// CHECKS

const DTMAX = 0.3; // largest model step, time units
const PREROLL = 240; // steps of DTMAX run before the first frame
const RATE = 2; // model time units a panel second at Speed 1
const OPEN = [0, 2, 0, 0.06];

function setup(params) {
  const f = () => new Float64Array(N);
  const S = {
    th: f(), tp: f(), f1: f(), f2: f(), c1: f(), s1: f(), z1r: f(), z1i: f(), c2: f(), s2: f(), z2r: f(), z2i: f(),
    G: f(), Gi: f(), bc: f(), bs: f(), tm: f(), R: 8, Rk: -1, beta: 0.15, om: 0, ca: 0, sa: 0, hue: 0, speed: 2, warm: false,
  };
  params.s = S;
  return S;
}

// The disc G, laid out from the origin with its wrap round the torus: 1 within R - 0.5, 0 beyond R + 0.5, linear between, so that R can change
// smoothly. S.G keeps its transform divided by N, ready for the inverse.
function disc(R, g) {
  let sum = 0;
  for (let y = 0; y < H; y++) {
    const dy = y < H / 2 ? y : y - H;
    for (let x = 0; x < W; x++) {
      const dx = x < W / 2 ? x : x - W, w = cl(R + 0.5 - sqrt(dx * dx + dy * dy), 0, 1);
      g[y * W + x] = w;
      sum += w;
    }
  }
  for (let p = 0; p < N; p++) g[p] /= sum;
}
function kernel(S) {
  const g = S.G, gi = S.Gi;
  disc(S.R, g);
  gi.fill(0);
  fft2(g, gi, false);
  for (let p = 0; p < N; p++) g[p] /= N;
  S.Rk = S.R;
}

// The right side. c, s, zr, zi receive cos theta, sin theta and Z, so the first stage's Z is still there to draw.
function deriv(S, th, out, c, s, zr, zi) {
  const G = S.G, ca = S.ca, sa = S.sa, om = S.om;
  for (let p = 0; p < N; p++) {
    c[p] = zr[p] = cos(th[p]);
    s[p] = zi[p] = sin(th[p]);
  }
  fft2(zr, zi, false);
  for (let p = 0; p < N; p++) (zr[p] *= G[p]), (zi[p] *= G[p]);
  fft2(zr, zi, true);
  for (let p = 0; p < N; p++) out[p] = om - ((s[p] * ca + c[p] * sa) * zr[p] - (c[p] * ca - s[p] * sa) * zi[p]);
}

// One Heun step of h.
function step(S, h) {
  const { th, tp, f1, f2 } = S;
  deriv(S, th, f1, S.c1, S.s1, S.z1r, S.z1i);
  for (let p = 0; p < N; p++) tp[p] = th[p] + h * f1[p];
  deriv(S, tp, f2, S.c2, S.s2, S.z2r, S.z2i);
  for (let p = 0; p < N; p++) th[p] += 0.5 * h * (f1[p] + f2[p]);
}

// Knobs to parameters. R and beta follow the knobs with a 0.3 s lag, so turning one moves the state along instead of jumping it.
function knobs(S, ft, k) {
  S.hue = k[0];
  S.speed = cl(k[1], 0.8, 3);
  const Rt = 8 * exp(0.4 * cl(k[2], -1, 1)), bt = 0.145 * exp(0.5 * cl(k[3], -1, 1)), a = 1 - exp(-ft / 0.3);
  S.R += (Rt - S.R) * a;
  S.beta += (bt - S.beta) * a;
  if (abs(S.R - S.Rk) > 0.03) kernel(S);
  S.ca = sin(S.beta);
  S.sa = cos(S.beta);
  S.om = S.sa;
}

// One frame of ft seconds: the time is cut into equal steps no longer than DTMAX, so a slow frame costs more steps and the flow keeps its pace.
function advance(S, ft, k) {
  knobs(S, ft, k);
  const h = ft * RATE * S.speed, n = max(1, Math.ceil(h / DTMAX - 1e-9));
  for (let i = 0; i < n; i++) step(S, h / n);
  // the phase turns without bound in the frame of the islands: keep it small
  for (let p = 0; p < N; p++) if (S.th[p] > 100 || S.th[p] < -100) S.th[p] -= TAU * Math.round(S.th[p] / TAU);
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  if (!S.warm) {
    S.warm = true;
    S.R = 8 * exp(0.4 * cl(k[2], -1, 1));
    S.beta = 0.145 * exp(0.5 * cl(k[3], -1, 1));
    // 40 smooth random waves of up to 4 cycles across the width and 8 down the height, under white noise of half a turn
    for (let m = 0; m < 40; m++) {
      const kx = (TAU * (floor(Math.random() * 9) - 4)) / W, ky = (TAU * (floor(Math.random() * 17) - 8)) / H, ph = Math.random() * TAU, am = 2 * Math.random() - 1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) S.th[y * W + x] += am * cos(kx * x + ky * y + ph);
    }
    for (let p = 0; p < N; p++) S.th[p] += (Math.random() - 0.5) * PI;
    kernel(S);
    knobs(S, 10, k);
    for (let i = 0; i < PREROLL; i++) step(S, DTMAX);
  }
  advance(S, cl(dt || 0, 0, 0.1), k);
}

// ---- colour ---------------------------------------------------------------------------------
// The phase is drawn on a closed ramp that stays inside an arc of hue 0.3 wide, 0.15 either side of a centre: hue = centre + 0.15 cos(phase), and the
// value runs 0.8 + 0.2 sin(phase), so every phase is its own pair of hue and lightness and the ramp is a loop, with no seam where the phase wraps.
// At Hue 0 the centre is 0.66 of the wheel: phase 0 is violet, a quarter turn on is bright blue, half a turn is cyan, three quarters is dim blue.
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
const LUT = new Float32Array(1024 * 3);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// 1-2-1 blur on the torus of a (re, im) pair, in place, through tm.
function blur(a, b, tm) {
  for (const f of [a, b]) {
    for (let y = 0; y < H; y++) {
      const o = y * W;
      for (let x = 0; x < W; x++) tm[o + x] = 0.25 * f[o + (x + W - 1) % W] + 0.5 * f[o + x] + 0.25 * f[o + (x + 1) % W];
    }
    for (let y = 0; y < H; y++) {
      const o = y * W, om = ((y + H - 1) % H) * W, op = ((y + 1) % H) * W;
      for (let x = 0; x < W; x++) f[o + x] = 0.25 * tm[om + x] + 0.5 * tm[o + x] + 0.25 * tm[op + x];
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  const { z1r, z1i, bc, bs, tm } = S, h0 = S.hue + 0.66;
  for (let i = 0; i < 1024; i++) {
    const u = (i / 1024) * TAU;
    hsv(h0 + 0.15 * cos(u), 0.82, 0.8 + 0.2 * sin(u), LUT, i * 3);
  }
  bc.set(S.c1);
  bs.set(S.s1);
  blur(bc, bs, tm);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      let u = atan2(bs[p], bc[p]) / TAU;
      u -= floor(u);
      const m = sqrt(bc[p] * bc[p] + bs[p] * bs[p]), z = sqrt(z1r[p] * z1r[p] + z1i[p] * z1i[p]);
      const v = 255 * (0.27 + 0.73 * sstep(0.3, 0.78, z)) * (0.15 + 0.85 * sqrt(m)), o = ((u * 1024) | 0) * 3;
      display.setPixel(x, y, v * LUT[o], v * LUT[o + 1], v * LUT[o + 2]);
    }
}
