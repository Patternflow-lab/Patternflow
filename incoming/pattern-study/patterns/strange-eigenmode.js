// ===== Patternflow pattern =====
// Title:   Strange Eigenmode
// Family:  sim
// Idea:    A dye on a torus stirred by Pierrehumbert's alternating sine flow, the rows sliding sideways for half a period and the columns sliding up and down for the other half, with a little diffusion, and rescaled every frame so it never fades: the striated picture is the flow's slowest decaying Floquet mode, the strange eigenmode, so it comes back in exactly the same shape every period while its true contrast falls to 39% each time.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: strange eigenmodes (Raymond Pierrehumbert, 1994), in his alternating sine flow
// Round:   54
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Stir=-1..1, Diffusion=0..1
//
// Knob 1: Hue. The colour of the dye. At 0 the positive half runs from violet where it is faint to pale aqua where it is strongest, and the negative half shows as dim indigo level lines; 0.25 turns it crimson to lilac, 0.5 olive through amber to rose, 0.75 teal through green to pale gold, and 1 is back at violet and aqua.
// Knob 2: Speed. One period of the flow takes 6 / Speed seconds: 3 s at the opening 2, each half 1.5 s with the slide easing in and out and resting a fifth of a second at either end. At 0.2 a period takes 30 s and at 3 it takes 2 s. The dye takes the same path at any speed.
// Knob 3: Stir. The amplitude A of both sines in units of the torus, which the panel draws 64 LEDs wide and 128 tall, so a row slides up to 64 A LEDs and a column up to 128 A. At 0, A = 1.2 (77 and 154 LEDs): global chaos, the leading Floquet multiplier 0.39 well ahead of the next, 0.28, so one shape returns every period at 39% of its contrast, a decay rate of 0.95 a period. At -1, A = 0.45: islands of regular flow keep their dye, which leaves only by diffusion, and the pattern fades only 10% a period. At -0.5 (A = 0.82) and +0.5 (A = 1.4) the leading multipliers are a complex pair, 137 and 136 degrees round, and the pattern swings between shapes without repeating. At +1 (A = 1.6) the leading multiplier is negative, -0.41: the pattern returns as its own negative every period, bright where it was dark.
// Knob 4: Diffusion. The diffusivity, 4 A times 30 to the power of the knob, in LED^2 a period: 5.9 at the opening 0.06, where the stripes are 2.9 LEDs across (rms over rms gradient). At 0.5 it is 26 (6 LEDs). At 1 it is 144 (12 LEDs): a few broad bands are left, and the decay rate rises to 1.6 a period. Any thinner than at 0 and the stripes would be finer than the LEDs.
// Buttons: K1 tap pours fresh dye, a few random waves, which the flow stirs on screen until, after about a dozen periods, the same mode is back.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, exp, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return o;
}

// Radix-2 FFT of n points. The forward transform takes its input in
// bit-reversed order and the inverse leaves its output so, which the loads
// and stores in shear do for free. Twiddles of the stage with half width h
// sit at h - 1 .. 2h - 2.
function plan(n) {
  const bits = Math.round(log(n) / log(2)), rev = new Uint16Array(n), wr = new Float64Array(n), wi = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  for (let h = 1; h < n; h <<= 1) for (let j = 0; j < h; j++) (wr[h - 1 + j] = cos((PI * j) / h)), (wi[h - 1 + j] = -sin((PI * j) / h));
  return { n, rev, wr, wi, re: new Float64Array(n), im: new Float64Array(n), d: new Float64Array(n) };
}
function fwd(P) {
  const n = P.n, re = P.re, im = P.im, wr = P.wr, wi = P.wi;
  for (let h = 1; h < n; h <<= 1)
    for (let j = 0, m = h << 1; j < h; j++) {
      const cr = wr[h - 1 + j], ci = wi[h - 1 + j];
      for (let a = j; a < n; a += m) {
        const b = a + h, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr, im[b] = im[a] - ti;
        re[a] += tr, im[a] += ti;
      }
    }
}
function inv(P) {
  const n = P.n, re = P.re, im = P.im, wr = P.wr, wi = P.wi;
  for (let h = n >> 1; h >= 1; h >>= 1)
    for (let j = 0, m = h << 1; j < h; j++) {
      const cr = wr[h - 1 + j], ci = -wi[h - 1 + j];
      for (let a = j; a < n; a += m) {
        const b = a + h, xr = re[a] - re[b], xi = im[a] - im[b];
        re[a] += re[b], im[a] += im[b];
        re[b] = xr * cr - xi * ci, im[b] = xr * ci + xi * cr;
      }
    }
}
const PX = plan(W), PY = plan(H);

// Every line (a row when rows, else a column) moves along itself by sh[line]
// LEDs, exactly, as a phase turn of each Fourier mode, and each mode is
// damped by P.d, the diffusion along that axis over the step (with the 1/n
// of the inverse folded in). Two real lines ride one complex FFT and are
// parted again in Fourier space. The Nyquist mode is dropped.
function shear(F, rows, sh) {
  const P = rows ? PX : PY, n = P.n, lines = rows ? H : W, ls = rows ? W : 1, es = rows ? 1 : W;
  const re = P.re, im = P.im, d = P.d, rev = P.rev, hn = n >> 1;
  for (let l = 0; l < lines; l += 2) {
    const o1 = l * ls, o2 = o1 + ls;
    for (let i = 0, q = 0; i < n; i++, q += es) {
      const r = rev[i];
      re[r] = F[o1 + q], im[r] = F[o2 + q];
    }
    fwd(P);
    const t1 = (-2 * PI * sh[l]) / n, t2 = (-2 * PI * sh[l + 1]) / n;
    const c1 = cos(t1), s1 = sin(t1), c2 = cos(t2), s2 = sin(t2);
    let e1r = 1, e1i = 0, e2r = 1, e2i = 0;
    for (let k = 1; k < hn; k++) {
      let q = e1r * c1 - e1i * s1;
      e1i = e1r * s1 + e1i * c1, e1r = q;
      q = e2r * c2 - e2i * s2;
      e2i = e2r * s2 + e2i * c2, e2r = q;
      const m = n - k, zr = re[k], zi = im[k], wr = re[m], wi = im[m], dk = 0.5 * d[k];
      const ar = zr + wr, ai = zi - wi, br = zi + wi, bi = wr - zr;
      const a2r = (ar * e1r - ai * e1i) * dk, a2i = (ar * e1i + ai * e1r) * dk;
      const b2r = (br * e2r - bi * e2i) * dk, b2i = (br * e2i + bi * e2r) * dk;
      re[k] = a2r - b2i, im[k] = a2i + b2r;
      re[m] = a2r + b2i, im[m] = b2r - a2i;
    }
    re[0] *= d[0], im[0] *= d[0];
    re[hn] = im[hn] = 0;
    inv(P);
    for (let i = 0, q = 0; i < n; i++, q += es) {
      const r = rev[i];
      F[o1 + q] = re[r], F[o2 + q] = im[r];
    }
  }
}

// Diffusion along one axis for tau periods at kappa LED^2 a period, as the
// damping of each Fourier mode.
function damp(P, kappa, tau) {
  const n = P.n;
  for (let k = 0; k < n; k++) {
    const w = (2 * PI * min(k, n - k)) / n;
    P.d[k] = exp(-kappa * w * w * tau) / n;
  }
}

// Diffusion across the lines while the variance v is small: three taps.
const TMP = new Float64Array(N);
function blur(F, rows, v) {
  const a = v / 2, b = 1 - v;
  TMP.set(F);
  if (rows)
    for (let y = 0; y < H; y++) {
      const o = y * W, u = ((y + H - 1) % H) * W, w = ((y + 1) % H) * W;
      for (let x = 0; x < W; x++) F[o + x] = b * TMP[o + x] + a * (TMP[u + x] + TMP[w + x]);
    }
  else
    for (let y = 0; y < H; y++) {
      const o = y * W;
      for (let x = 0; x < W; x++) F[o + x] = b * TMP[o + x] + a * (TMP[o + ((x + 63) & 63)] + TMP[o + ((x + 1) & 63)]);
    }
}

// Remove the mean and scale to unit rms; returns the log of the rms before.
function norm(F) {
  let m = 0;
  for (let i = 0; i < N; i++) m += F[i];
  m /= N;
  let q = 0;
  for (let i = 0; i < N; i++) q += (F[i] -= m) * F[i];
  const r = sqrt(q / N) || 1e-30, g = 1 / r;
  for (let i = 0; i < N; i++) F[i] *= g;
  return log(r);
}

// The torus is one unit wide and one tall, drawn 64 LEDs wide and 128
// tall, so a shift of A moves a row by 64 A LEDs and a column by 128 A. The
// phases of the two sines are fixed: the flow is periodic in time.
const P1 = 0.3, P2 = 1.9, SX = new Float64Array(H), SY = new Float64Array(W), ZERO = new Float64Array(H);
for (let y = 0; y < H; y++) SX[y] = W * sin((2 * PI * y) / H + P1);
for (let x = 0; x < W; x++) SY[x] = H * sin((2 * PI * x) / W + P2);

function fresh(S) {
  const F = S.F;
  // A few random large waves to start from; the eigenmode forgets them.
  F.fill(0);
  for (let j = 0; j < 6; j++) {
    const kx = 1 + floor(Math.random() * 3), ky = 1 + floor(Math.random() * 5), a = Math.random() * 2 * PI, b = Math.random() * 2 * PI;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) F[y * W + x] += sin((2 * PI * kx * x) / W + a) * sin((2 * PI * ky * y) / H + b);
  }
  norm(F);
  S.ph = 0, S.logsum = 0;
}

export function setup(params) {
  const S = (params.s = {
    hue: 0, speed: 2, A: 1.2, kap: 6, ph: 0, logsum: 0, gamma: 0, warm: 10,
    F: new Float64Array(N), sh: new Float64Array(H), c: [0, 0, 0],
  });
  fresh(S);
}

// One step of the flow: a share f of the half period's shear along one
// axis, with tau periods of diffusion along both. The step is cut so that
// no piece tilts a line by more than one LED for each LED across, and the
// diffusion across the lines runs after each piece, as three taps or, when
// that much would be too wide for three, as damping in Fourier space. The
// log of what norm took away adds up over a period to minus its decay rate.
function step(S, rows, f, tau) {
  const tilt = abs(f) * S.A * (rows ? (2 * PI * W) / H : (2 * PI * H) / W), n = max(1, Math.ceil(tilt));
  const prof = rows ? SX : SY, sh = S.sh, len = rows ? H : W, v = (2 * S.kap * tau) / n;
  for (let i = 0; i < len; i++) sh[i] = (f / n) * S.A * prof[i];
  damp(rows ? PX : PY, S.kap, tau / n);
  if (v > 0.8) damp(rows ? PY : PX, S.kap, tau / n);
  for (let i = 0; i < n; i++) {
    shear(S.F, rows, sh);
    if (v > 0.8) shear(S.F, !rows, ZERO);
    else blur(S.F, rows, v);
  }
  S.logsum += norm(S.F);
}

// Within each half period the shear starts and stops smoothly and rests a
// little at either end.
const ease = (u) => {
  const t = cl((u - 0.15) / 0.7, 0, 1);
  return t * t * (3 - 2 * t);
};

// Advance the flow by dp of a period from phase ph.
function advance(S, dp) {
  while (dp > 1e-9) {
    const inX = S.ph < 0.5, end = inX ? 0.5 : 1, st = min(dp, end - S.ph);
    const u0 = 2 * S.ph - (inX ? 0 : 1), f = ease(u0 + 2 * st) - ease(u0);
    step(S, inX, f, st);
    S.ph += st;
    dp -= st;
    if (S.ph >= 1 - 1e-9) {
      S.ph = 0;
      S.gamma = -S.logsum;
      S.logsum = 0;
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const st = cl(k[2], -1, 1);
  S.A = 1.2 + st * (st < 0 ? 0.75 : 0.4);
  S.kap = 4 * S.A * 30 ** cl(k[3], 0, 1);
  // K1 tap: fresh dye, stirred from here on screen.
  if (input.btnPressed && input.btnPressed[0]) fresh(S), (S.warm = 0);
  if (S.warm > 0) {
    // At the start the flow runs ahead unseen, steady shears whole periods
    // at a time, two periods before the first frame and one more in each
    // of the next eight, so the panel opens on the mode itself.
    const n = S.warm === 10 ? 2 : 1;
    for (let i = 0; i < 2 * n; i++) step(S, i % 2 === 0, 1, 0.5);
    S.warm -= n;
    S.logsum = 0;
    if (!S.warm) {
      // The equation is linear, so the mode and its negative are the same
      // mode. Draw it with its long tail on the bright side.
      let m3 = 0;
      for (let i = 0; i < N; i++) m3 += S.F[i] * S.F[i] * S.F[i];
      if (m3 < 0) for (let i = 0; i < N; i++) S.F[i] = -S.F[i];
    }
  }
  advance(S, (d * S.speed) / 6);
}

// A triangle wave of period 1, 0 at whole numbers and 1 halfway.
const tri = (u) => 1 - abs(2 * (u - floor(u)) - 1);

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const F = S.F, c = S.c, h0 = 0.45 + S.hue, V0 = -0.05;
  for (let y = 0; y < H; y++) {
    const o = y * W, u = ((y + H - 1) % H) * W, w = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const p = o + x, v = F[p];
      // Relief: the field as a height lit from the upper left.
      const gx = F[o + ((x + 1) & 63)] - F[o + ((x + 63) & 63)], gy = F[w + x] - F[u + x];
      const g = -(gx + gy) * 0.6, sh = g / (1 + abs(g));
      // Above a cut just under zero, about half the panel, the dye lights
      // from violet to pale aqua; level lines every 0.35 shade it a little.
      if (v > V0) {
        const t = 1 - exp(-(v - V0) / 0.9), b = tri(v / 0.35);
        hsv(h0 + 0.3 - 0.3 * t + 0.06 * sh - 0.03 * b, 0.9 - 0.5 * t - 0.15 * sh, 0.11 + (0.06 + 0.83 * t) * (0.78 + 0.3 * sh) * (0.9 + 0.1 * b), c);
      } else {
        // Below the cut, the level lines of the mode every 0.15, dim.
        const t = exp((v - V0) / 1.2), b = tri(v / 0.15);
        hsv(h0 + 0.32 - 0.12 * t + 0.05 * sh, 0.55 + 0.3 * b, min(0.09, (0.02 + 0.045 * t + 0.03 * b) * (1 + 0.3 * sh)), c);
      }
      display.setPixel(x, y, cl(c[0], 0, 255) | 0, cl(c[1], 0, 255) | 0, cl(c[2], 0, 255) | 0);
    }
  }
}
